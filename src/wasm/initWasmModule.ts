import './wasm_exec.js';
import './wasmTypes.d.ts';
import { getKubescapePluginUrl } from '../common/PluginHelper';

export async function loadWasm(): Promise<void> {
  if (!window.AdmissionEval) {
    console.log('Loading Kubescape WASM module');
    const goWasm = new window.Go();
    const result = await WebAssembly.instantiateStreaming(
      fetch((await getKubescapePluginUrl()) + '/main.wasm'),
      goWasm.importObject
    );
    goWasm.run(result.instance);
  }
}
