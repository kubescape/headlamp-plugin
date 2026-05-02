//go:build js && wasm

package main

import (
	"encoding/json"
	"fmt"
	"syscall/js"

	"admission-policy-wasm/rules"
	"admission-policy-wasm/vap"
)

func main() {
	// Create a channel to keep the Go program alive
	done := make(chan struct{}, 0)

	// Expose the Go functions to JavaScript
	js.Global().Set("AdmissionEval", js.FuncOf(admissionEval))
	js.Global().Set("RuleEval", js.FuncOf(ruleEval))

	// Block the program from exiting
	<-done
}

func argVal(args []js.Value, n int) []byte {
	return []byte(args[n].String())
}

func errorToJSON(err error) string {
	results := vap.EvaluationResults{
		Error: err.Error(),
	}
	data, _ := json.Marshal(results)
	return string(data)
}

func ruleErrorToJSON(err error) string {
	data, _ := json.Marshal(rules.RuleEvalResults{Error: err.Error()})
	return string(data)
}

// admissionEval evaluates a ValidatingAdmissionPolicy against a resource.
//
// args: policy, object, oldObject, request, params, namespace (all YAML)
func admissionEval(this js.Value, args []js.Value) any {
	if len(args) < 6 {
		return errorToJSON(fmt.Errorf("Invalid number of arguments in admissionEval()"))
	}
	evaluator, err := vap.NewAdmissionPolicyEvaluator(argVal(args, 0), argVal(args, 1), argVal(args, 2), argVal(args, 3), argVal(args, 4), argVal(args, 5))
	if err != nil {
		fmt.Printf("unable to parse inputs %s\n", err)
		return errorToJSON(err)
	}
	evaluator.CheckMatchConstraints()

	if evaluator.Results.MatchConstraints {
		evaluator.Evaluate()
	}

	data, err := json.Marshal(evaluator.Results)
	if err != nil {
		return errorToJSON(err)
	}
	return string(data)
}

// ruleEval evaluates a kubescape.io/v1 Rule CEL expression against mock event data.
//
// args[0]: ruleYAML    — full Rules CR YAML (first rule in spec.rules is evaluated)
// args[1]: eventType   — e.g. "exec", "open", "dns", "network"
// args[2]: eventData   — JSON/YAML object with event fields
// args[3]: profileYAML — optional ApplicationProfile mock YAML (keyed by containerId)
// args[4]: networkYAML — optional NetworkNeighborhood mock YAML (keyed by containerId)
func ruleEval(this js.Value, args []js.Value) any {
	if len(args) < 3 {
		return ruleErrorToJSON(fmt.Errorf("RuleEval requires at least 3 arguments"))
	}

	var profileData, networkData []byte
	if len(args) > 3 {
		profileData = argVal(args, 3)
	}
	if len(args) > 4 {
		networkData = argVal(args, 4)
	}

	evaluator, err := rules.NewRuleEvaluator(
		argVal(args, 0),
		args[1].String(),
		argVal(args, 2),
		profileData,
		networkData,
	)
	if err != nil {
		return ruleErrorToJSON(err)
	}

	result := evaluator.Evaluate()
	data, err := json.Marshal(result)
	if err != nil {
		return ruleErrorToJSON(err)
	}
	return string(data)
}
