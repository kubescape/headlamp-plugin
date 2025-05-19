export interface Rule {
  name: string;
  attributes?: any;
  ruleLanguage: string;
  match?: any[];
  description: string;
  remediation: string;
  ruleQuery?: string;
  rule: string;
  dynamicMatch?: any;
  relevantCloudProviders?: any;
  ruleDependencies?: any;
  resourceEnumerator?: any;
  configInputs?: any;
  controlConfigInputs?: any;
  resourceCount?: any;
}
