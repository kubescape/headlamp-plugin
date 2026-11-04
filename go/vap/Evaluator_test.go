package vap

import (
	"strings"
	"testing"

	"google.golang.org/protobuf/types/known/structpb"
)

const deployment = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: shop
spec:
  replicas: 5
`

func policyWith(spec string) string {
	return `
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: test
spec:
  matchConstraints:
    resourceRules:
    - apiGroups: ["apps"]
      apiVersions: ["v1"]
      operations: ["CREATE", "UPDATE"]
      resources: ["deployments"]
` + spec
}

func evaluate(t *testing.T, policy, object, oldObject, request string) EvaluationResults {
	t.Helper()
	evaluator, err := NewAdmissionPolicyEvaluator([]byte(policy), []byte(object), []byte(oldObject), []byte(request), nil, nil)
	if err != nil {
		t.Fatalf("NewAdmissionPolicyEvaluator: %v", err)
	}
	evaluator.CheckMatchConstraints()
	if !evaluator.Results.MatchConstraints {
		t.Fatal("policy does not match the object")
	}
	evaluator.Evaluate()
	return evaluator.Results
}

func validation(t *testing.T, results EvaluationResults, index int) *EvalResult {
	t.Helper()
	if len(results.Validations) <= index {
		t.Fatalf("expected at least %d validations, got %+v", index+1, results)
	}
	return results.Validations[index]
}

// expectBool fails unless the expression evaluated without error to the given boolean
func expectBool(t *testing.T, name string, result *EvalResult, expected bool) {
	t.Helper()
	value, ok := result.Result.(*structpb.Value)
	if ok {
		_, ok = value.GetKind().(*structpb.Value_BoolValue)
	}
	if result.Error != "" || !ok || value.GetBoolValue() != expected {
		t.Errorf("%s: expected %v, got result %v, error %q", name, expected, result.Result, result.Error)
	}
}

func TestDefaultRequestIsCreateWithoutOldObject(t *testing.T) {
	policy := policyWith(`
  validations:
  - expression: "request.operation == 'CREATE' && oldObject == null"
  - expression: "request.kind.kind == 'Deployment' && request.resource.resource == 'deployments'"
  - expression: "request.name == 'web' && request.namespace == 'shop'"
`)
	results := evaluate(t, policy, deployment, "", "")

	for i, v := range results.Validations {
		expectBool(t, v.Expression, validation(t, results, i), true)
	}
}

func TestDefaultRequestIsUpdateWithOldObject(t *testing.T) {
	policy := policyWith(`
  validations:
  - expression: "request.operation == 'UPDATE'"
  - expression: "object.spec.replicas > oldObject.spec.replicas"
`)
	oldDeployment := strings.Replace(deployment, "replicas: 5", "replicas: 2", 1)
	results := evaluate(t, policy, deployment, oldDeployment, "")

	for i, v := range results.Validations {
		expectBool(t, v.Expression, validation(t, results, i), true)
	}
}

func TestExplicitRequest(t *testing.T) {
	policy := policyWith(`
  validations:
  - expression: "request.userInfo.username == 'alice'"
`)
	results := evaluate(t, policy, deployment, "", "userInfo:\n  username: alice\noperation: CREATE\n")

	expectBool(t, "username", validation(t, results, 0), true)
}

func TestVariablesReferToEarlierVariables(t *testing.T) {
	policy := policyWith(`
  variables:
  - name: replicas
    expression: "object.spec.replicas"
  - name: tooMany
    expression: "variables.replicas > 3"
  validations:
  - expression: "!variables.tooMany"
`)
	results := evaluate(t, policy, deployment, "", "")

	expectBool(t, "validation", validation(t, results, 0), false)
}

func TestMatchConditions(t *testing.T) {
	for _, tc := range []struct {
		condition       string
		wantValidations int
	}{
		{"object.metadata.namespace == 'shop'", 1},
		{"object.metadata.namespace == 'billing'", 0},
	} {
		policy := policyWith(`
  matchConditions:
  - name: namespace
    expression: "` + tc.condition + `"
  validations:
  - expression: "object.spec.replicas < 10"
`)
		results := evaluate(t, policy, deployment, "", "")

		if len(results.Validations) != tc.wantValidations {
			t.Errorf("%s: expected %d validations, got %d", tc.condition, tc.wantValidations, len(results.Validations))
		}
	}
}

func TestVariableErrorsPropagate(t *testing.T) {
	policy := policyWith(`
  variables:
  - name: missing
    expression: "object.spec.template.spec.containers"
  validations:
  - expression: "size(variables.missing) > 0"
`)
	results := evaluate(t, policy, deployment, "", "")

	if results.Variables[0].Error == "" {
		t.Error("expected the variable to fail")
	}
	if v := validation(t, results, 0); !strings.Contains(v.Error, "no such key") {
		t.Errorf("expected the validation to fail with the variable error, got result %v, error %q", v.Result, v.Error)
	}
}

func TestUndeclaredReferencesFail(t *testing.T) {
	policy := policyWith(`
  validations:
  - expression: "objet.spec.replicas < 10"
`)
	results := evaluate(t, policy, deployment, "", "")

	if v := validation(t, results, 0); !strings.Contains(v.Error, "objet") {
		t.Errorf("expected an error about 'objet', got result %v, error %q", v.Result, v.Error)
	}
}
