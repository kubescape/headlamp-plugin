package vap

import (
	"fmt"
	"log"
	"reflect"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
	"github.com/google/cel-go/ext"
	"google.golang.org/protobuf/types/known/structpb"
	"sigs.k8s.io/yaml"
)

var celDefaultEnvOptions = []cel.EnvOption{
	cel.EagerlyValidateDeclarations(true),
	cel.DefaultUTCTimeZone(true),
	ext.Strings(ext.StringsVersion(2)),
	cel.CrossTypeNumericComparisons(true),
	cel.OptionalTypes(),

	// library.Lists(),
	// library.Regex(),
	// library.CIDR(),
	// library.IP(),
	// library.URLs(),
}

type EvalResult struct {
	Name       string `json:"name,omitempty"`
	Expression string `json:"expression,omitempty"`
	Result     any    `json:"result,omitempty"`
	Error      string `json:"error,omitempty"`
	Message    any    `json:"message,omitempty"`
}

type EvaluationResults struct {
	Error            string        `json:"error,omitempty"`
	Variables        []*EvalResult `json:"variables,omitempty"`
	MatchConstraints bool          `json:"matchConstraints"`
	MatchConditions  []*EvalResult `json:"matchConditions,omitempty"`
	Validations      []*EvalResult `json:"validations,omitempty"`
	AuditAnnotations []*EvalResult `json:"auditAnnotations,omitempty"`
}

type ObjectData map[string]any

// AdmissionPolicyEvaluator holds policy, data and results for a single validation run
type AdmissionPolicyEvaluator struct {
	policy          ValidatingAdmissionPolicy
	object          ObjectData
	oldObject       ObjectData
	paramsObject    ObjectData
	namespaceObject ObjectData

	celEnvironment *cel.Env

	Results EvaluationResults
}

// 'object' - The object from the incoming request. The value is null for DELETE requests.
// 'oldObject' - The existing object. The value is null for CREATE requests.
// 'request' - Attributes of the admission request.
// 'params' - Parameter resource referred to by the policy binding being evaluated. The value is null if ParamKind is not specified.
// namespaceObject - The namespace, as a Kubernetes resource, that the incoming object belongs to. The value is null if the incoming object is cluster-scoped.
// authorizer - A CEL Authorizer. May be used to perform authorization checks for the principal (authenticated user) of the request. See AuthzSelectors and Authz in the Kubernetes CEL library documentation for more details.
// authorizer.requestResource - A shortcut for an authorization check configured with the request resource (group, resource, (subresource), namespace, name).
func NewAdmissionPolicyEvaluator(policy, object, oldObject, request, params, namespace []byte) (*AdmissionPolicyEvaluator, error) {

	evaluator := AdmissionPolicyEvaluator{
		Results: EvaluationResults{},
	}

	if err := yaml.Unmarshal(policy, &evaluator.policy); err != nil {
		return nil, fmt.Errorf("failed to parse policy YAML: %w", err)
	}

	if err := yaml.Unmarshal(object, &evaluator.object); err != nil {
		return nil, fmt.Errorf("failed to parse object YAML: %w", err)
	}

	if err := yaml.Unmarshal(oldObject, &evaluator.oldObject); err != nil {
		return nil, fmt.Errorf("failed to parse oldObject YAML: %w", err)
	}

	if err := yaml.Unmarshal(params, &evaluator.paramsObject); err != nil {
		return nil, fmt.Errorf("failed to parse params YAML: %w", err)
	}

	if err := yaml.Unmarshal(namespace, &evaluator.namespaceObject); err != nil {
		return nil, fmt.Errorf("failed to parse namespace YAML: %w", err)
	}

	// Declare input data as variables
	envOptions := celDefaultEnvOptions
	envOptions = append(envOptions,
		cel.Variable("object", cel.DynType),
		cel.Variable("params", cel.DynType),
		cel.Variable("namespaceObject", cel.DynType))
	// Init CEL environment
	if celEnvironment, err := cel.NewEnv(envOptions...); err == nil {
		evaluator.celEnvironment = celEnvironment
	} else {
		return nil, fmt.Errorf("failed to create CEL env: %w", err)
	}
	// Declare additional variables
	var err error
	for _, variable := range evaluator.policy.Spec.Variables {
		evaluator.celEnvironment, err = evaluator.celEnvironment.Extend(cel.Variable(variable.Name, cel.DynType))
		if err != nil {
			return nil, fmt.Errorf("could not initialize variable %s: %w", variable.Name, err)
		}
	}

	return &evaluator, nil
}

func (evaluator *AdmissionPolicyEvaluator) Evaluate() {

	// Input Variables
	inputData := map[string]any{
		"object":          evaluator.object,
		"params":          evaluator.paramsObject,
		"namespaceObject": evaluator.namespaceObject,
	}

	// Policy variables
	for _, variable := range evaluator.policy.Spec.Variables {
		value, err := evaluator.evalExpression(inputData, variable.Expression)
		inputData["variables."+variable.Name] = value

		evaluator.Results.Variables = append(evaluator.Results.Variables, &EvalResult{
			Name:   variable.Name,
			Result: getResult(value),
			Error:  errorString(err),
		})
	}

	// MatchConditions
	for _, matchCondition := range evaluator.policy.Spec.MatchConditions {
		value, err := evaluator.evalExpression(inputData, matchCondition.Expression)
		evaluator.Results.MatchConditions = append(evaluator.Results.MatchConditions, &EvalResult{
			Name:   matchCondition.Name,
			Result: getResult(value),
			Error:  errorString(err),
		})
	}

	if !evaluator.matchedOnConditions() {
		return
	}

	// Validations
	for idx, validation := range evaluator.policy.Spec.Validations {
		value, err := evaluator.evalExpression(inputData, validation.Expression)
		evalResult := &EvalResult{
			Name:       fmt.Sprintf("%d", idx+1),
			Expression: validation.Expression,
			Result:     getResult(value),
			Error:      errorString(err),
		}

		if err == nil && value != nil && value.Value() != true {
			evalResult.Message = validation.Message

			if evalResult.Message == "" && validation.MessageExpression != "" {
				message, err := evaluator.evalExpression(inputData, validation.MessageExpression)
				if err != nil || !types.IsUnknownOrError(message) {
					evalResult.Message = message
				}
			}
		}

		evaluator.Results.Validations = append(evaluator.Results.Validations, evalResult)
	}

	// AuditAnnotations
	for _, auditAnnotation := range evaluator.policy.Spec.AuditAnnotations {
		value, err := evaluator.evalExpression(inputData, auditAnnotation.ValueExpression)
		evaluator.Results.AuditAnnotations = append(evaluator.Results.AuditAnnotations, &EvalResult{
			Name:       auditAnnotation.Key,
			Expression: auditAnnotation.ValueExpression,
			Result:     value,
			Error:      errorString(err),
		})
	}
}

func errorString(err error) string {
	if err != nil {
		return err.Error()
	}
	return ""
}

// Note: celEnvironment.Check returns errors for variables in expressions
func (evaluator *AdmissionPolicyEvaluator) evalExpression(inputData map[string]any, expression string) (ref.Val, error) {
	ast, issues := evaluator.celEnvironment.Parse(expression)
	if issues != nil && issues.Err() != nil {
		log.Printf("Parse: %v", issues.String())
		return nil, issues.Err()
	}
	prog, err := evaluator.celEnvironment.Program(ast)
	if err != nil {
		log.Printf("Program: %v", err)
		return nil, err
	}
	result, _, err := prog.Eval(inputData)
	if err != nil {
		log.Printf("Eval %v", err)
		return nil, err
	}
	return result, nil
}

func (evaluator *AdmissionPolicyEvaluator) matchedOnConditions() bool {
	for _, result := range evaluator.Results.MatchConditions {
		if result.Result != true {
			return false
		}
	}
	return true
}

func getResult(val ref.Val) any {
	if val == nil {
		return nil
	}
	if err, ok := val.Value().(error); ok {
		return err.Error()
	}
	if value, err := val.ConvertToNative(reflect.TypeOf(&structpb.Value{})); err != nil {
		return err.Error()
	} else {
		return value
	}
}
