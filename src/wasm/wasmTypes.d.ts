declare global {
  export interface Window {
    Go: any;
    AdmissionEval: (
      policy: string,
      object: string,
      oldObject: string,
      request: string,
      params: string,
      namespace: string
    ) => string;
    
    /**
     * Evaluates a kubescape.io/v1 Rules CR expression against mock event data.
     * @param ruleYAML    - Full Rules CR YAML (first rule in spec.rules is evaluated)
     * @param eventType   - Event type: "exec" | "open" | "dns" | "network" | ...
     * @param eventData   - JSON/YAML object with event fields for the chosen event type
     * @param profileYAML - Optional ApplicationProfile mock YAML keyed by containerId
     * @param networkYAML - Optional NetworkNeighborhood mock YAML keyed by containerId
     * @returns JSON-encoded RuleEvalResults
     */
    RuleEval: (
      ruleYAML: string,
      eventType: string,
      eventData: string,
      profileYAML: string,
      networkYAML: string
    ) => string;
  }
}
export {};
