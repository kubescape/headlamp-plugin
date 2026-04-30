package rules

import (
	"fmt"
	"log"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/types/ref"
	"github.com/google/cel-go/ext"
	"sigs.k8s.io/yaml"
)

var celBaseOptions = []cel.EnvOption{
	cel.EagerlyValidateDeclarations(true),
	cel.DefaultUTCTimeZone(true),
	ext.Strings(ext.StringsVersion(2)),
	cel.CrossTypeNumericComparisons(true),
	cel.OptionalTypes(),
}

// RuleExprResult is the evaluation result for a single ruleExpression entry.
type RuleExprResult struct {
	EventType  string `json:"eventType"`
	Expression string `json:"expression"`
	Result     *bool  `json:"result"`
	Error      string `json:"error,omitempty"`
}

// StringExprResult is the evaluation result for message or uniqueId expressions.
type StringExprResult struct {
	Result string `json:"result"`
	Error  string `json:"error,omitempty"`
}

// RuleEvalResults is the top-level result returned by Evaluate().
type RuleEvalResults struct {
	Error             string           `json:"error,omitempty"`
	EventTypeMismatch string           `json:"eventTypeMismatch,omitempty"`
	RuleExpression    []RuleExprResult `json:"ruleExpression"`
	Message           StringExprResult `json:"message"`
	UniqueID          StringExprResult `json:"uniqueId"`
}

// RuleEvaluator holds everything needed for a single evaluation run.
type RuleEvaluator struct {
	rule      Rule
	eventType string
	eventData map[string]any
	celEnv    *cel.Env
}

// NewRuleEvaluator parses its raw YAML/JSON inputs and builds the CEL environment.
//
//   - ruleYAML:   full Rules CR YAML; the first rule in spec.rules is evaluated
//   - eventType:  e.g. "exec", "open", "dns"
//   - eventData:  raw JSON/YAML for the event fields
//   - profileData: optional ApplicationProfile mock (YAML keyed by containerId); empty slice → empty profile
//   - networkData: optional NetworkNeighborhood mock (YAML keyed by containerId); empty slice → empty network
func NewRuleEvaluator(ruleYAML []byte, eventType string, eventData, profileData, networkData []byte) (*RuleEvaluator, error) {
	var rulesDoc Rules
	if err := yaml.Unmarshal(ruleYAML, &rulesDoc); err != nil {
		return nil, fmt.Errorf("failed to parse rule YAML: %w", err)
	}
	if len(rulesDoc.Spec.Rules) == 0 {
		return nil, fmt.Errorf("no rules found in YAML")
	}

	var event map[string]any
	if err := yaml.Unmarshal(eventData, &event); err != nil {
		return nil, fmt.Errorf("failed to parse event data: %w", err)
	}
	if event == nil {
		event = map[string]any{}
	}

	var profile MockProfile
	if len(profileData) > 0 {
		if err := yaml.Unmarshal(profileData, &profile); err != nil {
			return nil, fmt.Errorf("failed to parse profile YAML: %w", err)
		}
	}

	var network MockNetwork
	if len(networkData) > 0 {
		if err := yaml.Unmarshal(networkData, &network); err != nil {
			return nil, fmt.Errorf("failed to parse network YAML: %w", err)
		}
	}

	envOptions := append([]cel.EnvOption{}, celBaseOptions...)
	envOptions = append(envOptions,
		cel.Variable("event", cel.DynType),
		cel.Variable("eventType", cel.StringType),
	)
	envOptions = append(envOptions, libraryEnvOptions(profile, network, MockK8s{})...)

	celEnv, err := cel.NewEnv(envOptions...)
	if err != nil {
		return nil, fmt.Errorf("failed to create CEL environment: %w", err)
	}

	return &RuleEvaluator{
		rule:      rulesDoc.Spec.Rules[0],
		eventType: eventType,
		eventData: event,
		celEnv:    celEnv,
	}, nil
}

// Evaluate runs the rule expressions, message, and uniqueId against the event data.
// message and uniqueId are only evaluated when the selected event type has at least one
// matching ruleExpression entry — otherwise those expressions reference fields that don't
// exist in the current event data.
func (e *RuleEvaluator) Evaluate() RuleEvalResults {
	results := RuleEvalResults{}

	inputData := map[string]any{
		"event":     e.eventData,
		"eventType": e.eventType,
	}

	// Collect matching ruleExpression entries.
	var matched []RuleExpression
	for _, expr := range e.rule.Expressions.RuleExpression {
		if expr.EventType == e.eventType {
			matched = append(matched, expr)
		}
	}

	// If no ruleExpression entry handles this event type, report the mismatch and stop.
	if len(matched) == 0 {
		validTypes := make([]string, 0, len(e.rule.Expressions.RuleExpression))
		seen := map[string]bool{}
		for _, expr := range e.rule.Expressions.RuleExpression {
			if !seen[expr.EventType] {
				validTypes = append(validTypes, expr.EventType)
				seen[expr.EventType] = true
			}
		}
		results.EventTypeMismatch = fmt.Sprintf(
			"rule %q handles event types %v, not %q",
			e.rule.ID, validTypes, e.eventType,
		)
		return results
	}

	// Evaluate each matching ruleExpression.
	for _, expr := range matched {
		r := RuleExprResult{
			EventType:  expr.EventType,
			Expression: expr.Expression,
		}
		val, err := e.evalExpression(inputData, expr.Expression)
		if err != nil {
			r.Error = err.Error()
		} else if val != nil {
			if b, ok := val.Value().(bool); ok {
				r.Result = &b
			}
		}
		results.RuleExpression = append(results.RuleExpression, r)
	}

	// Evaluate message.
	if e.rule.Expressions.Message != "" {
		val, err := e.evalExpression(inputData, e.rule.Expressions.Message)
		if err != nil {
			results.Message.Error = err.Error()
		} else if val != nil {
			results.Message.Result = fmt.Sprintf("%v", val.Value())
		}
	}

	// Evaluate uniqueId.
	if e.rule.Expressions.UniqueID != "" {
		val, err := e.evalExpression(inputData, e.rule.Expressions.UniqueID)
		if err != nil {
			results.UniqueID.Error = err.Error()
		} else if val != nil {
			results.UniqueID.Result = fmt.Sprintf("%v", val.Value())
		}
	}

	return results
}

func (e *RuleEvaluator) evalExpression(inputData map[string]any, expression string) (ref.Val, error) {
	ast, issues := e.celEnv.Parse(expression)
	if issues != nil && issues.Err() != nil {
		log.Printf("Parse error: %v", issues.String())
		return nil, issues.Err()
	}
	prog, err := e.celEnv.Program(ast)
	if err != nil {
		log.Printf("Program error: %v", err)
		return nil, err
	}
	result, _, err := prog.Eval(inputData)
	if err != nil {
		log.Printf("Eval error: %v", err)
		return nil, err
	}
	return result, nil
}
