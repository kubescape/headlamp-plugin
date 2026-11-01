package vap

import (
	"log"
	"strings"
)

// requestAttributes are the attributes of the admission request that resource rules match on
type requestAttributes struct {
	operation   string
	group       string
	version     string
	resource    string
	subResource string
}

func stringField(data map[string]any, key string) string {
	value, _ := data[key].(string)
	return value
}

// CheckMatchConstraints matches the request against the resource rules of the policy like the
// API server does: on operation, API group, API version and resource, where '*' matches any value.
func (evaluator *AdmissionPolicyEvaluator) CheckMatchConstraints() {

	if value, ok := evaluator.object["apiVersion"]; !ok || value == nil {
		return
	}
	if value, ok := evaluator.object["kind"]; !ok || value == nil {
		return
	}
	if evaluator.policy.Spec.MatchConstraints == nil {
		return
	}

	resource, _ := evaluator.request["resource"].(map[string]any)
	attributes := requestAttributes{
		operation:   stringField(evaluator.request, "operation"),
		group:       stringField(resource, "group"),
		version:     stringField(resource, "version"),
		resource:    stringField(resource, "resource"),
		subResource: stringField(evaluator.request, "subResource"),
	}

	for _, resourceRule := range evaluator.policy.Spec.MatchConstraints.ResourceRules {
		if match(resourceRule, attributes) {
			evaluator.Results.MatchConstraints = true
			return
		}
	}
	log.Printf("Request %+v NOT matched", attributes)
}

func makePlural(kind string) string {

	if strings.HasSuffix(kind, "y") {
		r := []rune(kind)
		return string(r[:len(r)-1]) + "ies"
	}
	return kind + "s"
}

func match(resourceRule NamedRuleWithOperations, attributes requestAttributes) bool {
	return matchesAny(resourceRule.Operations, attributes.operation) &&
		matchesAny(resourceRule.APIGroups, attributes.group) &&
		matchesAny(resourceRule.APIVersions, attributes.version) &&
		matchesResource(resourceRule.Resources, attributes.resource, attributes.subResource)
}

// matchesAny reports whether one of the values is '*' or the given value
func matchesAny[T ~string](values []T, value string) bool {
	for _, v := range values {
		if string(v) == "*" || string(v) == value {
			return true
		}
	}
	return false
}

// matchesResource reports whether the resource and subresource match one of the patterns:
// 'pods' matches pods, 'pods/log' its log subresource, 'pods/*' pods and all its subresources,
// '*' all resources but no subresources, '*/scale' all scale subresources and '*/*' everything.
func matchesResource(patterns []string, resource, subResource string) bool {
	for _, pattern := range patterns {
		patternResource, patternSubResource, _ := strings.Cut(pattern, "/")
		if (patternResource == "*" || strings.EqualFold(patternResource, resource)) &&
			(patternSubResource == "*" || patternSubResource == subResource) {
			return true
		}
	}
	return false
}
