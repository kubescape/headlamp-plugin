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

controls-download:  
	# note: controls are removed from frameworks as they are also available in controls.ts 
	curl -L https://github.com/kubescape/regolibrary/releases/download/v2/frameworks | jq '.[].controls = []' > src/rego/frameworks.ts; 
	sed -i '1s/^/export const frameworks: FrameWork[] = \n/' src/rego/frameworks.ts; 
	sed -i '1s/^/import { FrameWork } from ".\/FrameWork" \n/' src/rego/frameworks.ts; 
	curl -L https://github.com/kubescape/regolibrary/releases/download/v2/controls -o src/rego/controls.ts; 
	sed -i '1s/^/export const controls: Control[] = \n/' src/rego/controls.ts; 
	sed -i '1s/^/import { Control } from ".\/Control" \n/' src/rego/controls.ts; 

wasm-download: 
	# Download WASM exec.js 
	curl https://raw.githubusercontent.com/golang/go/refs/heads/master/lib/wasm/wasm_exec.js -o src/wasm/wasm_exec.js;

kubescape-download: 
	# Download policy files from Kubescape to dist 
	curl -L https://github.com/kubescape/cel-admission-library/releases/latest/download/basic-control-configuration.yaml -o dist/basic-control-configuration.yaml; 
	curl -L https://github.com/kubescape/cel-admission-library/releases/latest/download/kubescape-validating-admission-policies.yaml -o dist/validating-admission-policies.yaml; 

	# Download rego rules files to dist
	curl -L https://github.com/kubescape/regolibrary/releases/download/v2/rules -o dist/rego-rules.json; 

	# Download test files from KubeScape to dist 
	rm -f dist/vap-test-files*;
	for word in ${vap_test_files}; do \
		printf '\n---\n' >> dist/vap-test-files.yaml; \
		curl https://raw.githubusercontent.com/kubescape/cel-admission-library/refs/heads/main/test-resources/$$word >> dist/vap-test-files.yaml; \
		echo $$word >> dist/vap-test-files-index.yaml; \
	done; 

download: wasm-download kubescape-download controls-download

build: 
	GOOS=js GOARCH=wasm go -C go build -ldflags="-s -w" -o ../dist/main.wasm cmd/main.go 

local: build
	cp dist/main.wasm dist/*.yaml dist/*.json ~/.config/Headlamp/plugins/kubescape-plugin/
