SHELL := /bin/bash

vap_test_files:=\
	deployment.yaml \
	deployment-for-list-items.yaml \
	pod-capabilities.yaml \
	service-account.yaml \
	deployment-with-common-label-1.yaml  \
	pod-for-list-items.yaml  \
	service.yaml \
	deployment-with-common-label-2.yaml  \
	pod.yaml

.PHONY: wasm-download kubescape-cel-admission-library-download kubescape-rego-download download build local

wasm-download:
	curl -fL https://raw.githubusercontent.com/golang/go/refs/heads/master/lib/wasm/wasm_exec.js -o src/wasm/wasm_exec.js

kubescape-cel-admission-library-download:
	mkdir -p public
	curl -fL https://github.com/kubescape/cel-admission-library/releases/latest/download/basic-control-configuration.yaml -o public/basic-control-configuration.yaml
	curl -fL https://github.com/kubescape/cel-admission-library/releases/latest/download/kubescape-validating-admission-policies.yaml -o public/validating-admission-policies.yaml
	rm -f public/vap-test-files*
	set -o pipefail; for word in ${vap_test_files}; do \
		printf '\n---\n' >> public/vap-test-files.yaml; \
		curl -fL https://raw.githubusercontent.com/kubescape/cel-admission-library/refs/heads/main/test-resources/$$word >> public/vap-test-files.yaml || exit 1; \
		echo $$word >> public/vap-test-files-index.yaml; \
	done

kubescape-rego-download:
	mkdir -p public
	curl -fL https://github.com/kubescape/regolibrary/releases/download/v2/frameworks \
	    | jq '.[].controls = []' > public/frameworks.json
	curl -fL https://github.com/kubescape/regolibrary/releases/download/v2/controls \
	    -o public/controls.json
	curl -fL https://github.com/kubescape/regolibrary/releases/download/v2/rules \
	    -o public/rego-rules.json

download: wasm-download kubescape-cel-admission-library-download kubescape-rego-download

build:
	GOOS=js GOARCH=wasm go -C go build -ldflags="-s -w" -o ../dist/main.wasm cmd/main.go

local: build
	cp dist/main.wasm public/*.yaml public/*.json ~/.config/Headlamp/plugins/kubescape-plugin/
