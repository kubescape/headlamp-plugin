package vap

import (
	"strings"
	"testing"
)

func policyMatching(rule string) string {
	return `
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: test
spec:
  matchConstraints:
    resourceRules:
    - ` + strings.ReplaceAll(strings.TrimSpace(rule), "\n", "\n      ") + `
  validations:
  - expression: "true"
`
}

func TestCheckMatchConstraints(t *testing.T) {
	oldDeployment := strings.Replace(deployment, "replicas: 5", "replicas: 2", 1)

	for _, tc := range []struct {
		name      string
		rule      string
		oldObject string
		request   string
		want      bool
	}{
		{
			name: "matching rule",
			rule: `{apiGroups: [apps], apiVersions: [v1], operations: [CREATE], resources: [deployments]}`,
			want: true,
		},
		{
			name: "other operation on CREATE",
			rule: `{apiGroups: [apps], apiVersions: [v1], operations: [UPDATE, DELETE], resources: [deployments]}`,
			want: false,
		},
		{
			name:      "operation of an UPDATE",
			rule:      `{apiGroups: [apps], apiVersions: [v1], operations: [UPDATE], resources: [deployments]}`,
			oldObject: oldDeployment,
			want:      true,
		},
		{
			name:    "operation of an explicit request",
			rule:    `{apiGroups: [apps], apiVersions: [v1], operations: [DELETE], resources: [deployments]}`,
			request: "operation: DELETE\n",
			want:    true,
		},
		{
			name: "no operations",
			rule: `{apiGroups: [apps], apiVersions: [v1], resources: [deployments]}`,
			want: false,
		},
		{
			name: "wildcards everywhere",
			rule: `{apiGroups: ["*"], apiVersions: ["*"], operations: ["*"], resources: ["*"]}`,
			want: true,
		},
		{
			name: "other group",
			rule: `{apiGroups: [""], apiVersions: ["*"], operations: ["*"], resources: ["*"]}`,
			want: false,
		},
		{
			name: "other version",
			rule: `{apiGroups: ["*"], apiVersions: [v1beta1], operations: ["*"], resources: ["*"]}`,
			want: false,
		},
		{
			name: "other resource",
			rule: `{apiGroups: ["*"], apiVersions: ["*"], operations: ["*"], resources: [statefulsets]}`,
			want: false,
		},
		{
			name: "all subresources include the resource",
			rule: `{apiGroups: [apps], apiVersions: [v1], operations: ["*"], resources: [deployments/*]}`,
			want: true,
		},
		{
			name: "subresource only",
			rule: `{apiGroups: [apps], apiVersions: [v1], operations: ["*"], resources: [deployments/scale]}`,
			want: false,
		},
		{
			name:    "subresource of the request",
			rule:    `{apiGroups: [apps], apiVersions: [v1], operations: ["*"], resources: ["*/scale"]}`,
			request: "subResource: scale\n",
			want:    true,
		},
		{
			name:    "resource wildcard excludes subresources",
			rule:    `{apiGroups: [apps], apiVersions: [v1], operations: ["*"], resources: ["*"]}`,
			request: "subResource: scale\n",
			want:    false,
		},
		{
			name:    "everything including subresources",
			rule:    `{apiGroups: [apps], apiVersions: [v1], operations: ["*"], resources: ["*/*"]}`,
			request: "subResource: scale\n",
			want:    true,
		},
		{
			name: "resource of an explicit request",
			rule: `{apiGroups: [""], apiVersions: [v1], operations: [CONNECT], resources: [pods/exec]}`,
			request: `
operation: CONNECT
resource: {group: "", version: v1, resource: pods}
subResource: exec
`,
			want: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			evaluator, err := NewAdmissionPolicyEvaluator([]byte(policyMatching(tc.rule)), []byte(deployment), []byte(tc.oldObject), []byte(tc.request), nil, nil)
			if err != nil {
				t.Fatalf("NewAdmissionPolicyEvaluator: %v", err)
			}

			evaluator.CheckMatchConstraints()

			if evaluator.Results.MatchConstraints != tc.want {
				t.Errorf("expected match %v, got %v", tc.want, evaluator.Results.MatchConstraints)
			}
		})
	}
}

func TestPolicyWithoutMatchConstraintsMatchesNothing(t *testing.T) {
	policy := "apiVersion: admissionregistration.k8s.io/v1\nkind: ValidatingAdmissionPolicy\nspec: {}\n"
	evaluator, err := NewAdmissionPolicyEvaluator([]byte(policy), []byte(deployment), nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("NewAdmissionPolicyEvaluator: %v", err)
	}

	evaluator.CheckMatchConstraints()

	if evaluator.Results.MatchConstraints {
		t.Error("expected no match")
	}
}
