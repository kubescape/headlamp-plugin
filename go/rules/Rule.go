package rules

type Rules struct {
	Spec RulesSpec `json:"spec" yaml:"spec"`
}

type RulesSpec struct {
	Rules []Rule `json:"rules" yaml:"rules"`
}

type Rule struct {
	Name              string          `json:"name" yaml:"name"`
	ID                string          `json:"id" yaml:"id"`
	Enabled           bool            `json:"enabled" yaml:"enabled"`
	Description       string          `json:"description" yaml:"description"`
	Expressions       RuleExpressions `json:"expressions" yaml:"expressions"`
	ProfileDependency int             `json:"profileDependency" yaml:"profileDependency"`
	Severity          int             `json:"severity" yaml:"severity"`
	SupportPolicy     bool            `json:"supportPolicy" yaml:"supportPolicy"`
	IsTriggerAlert    bool            `json:"isTriggerAlert" yaml:"isTriggerAlert"`
	MitreTactic       string          `json:"mitreTactic" yaml:"mitreTactic"`
	MitreTechnique    string          `json:"mitreTechnique" yaml:"mitreTechnique"`
	Tags              []string        `json:"tags" yaml:"tags"`
}

type RuleExpressions struct {
	Message        string           `json:"message" yaml:"message"`
	UniqueID       string           `json:"uniqueId" yaml:"uniqueId"`
	RuleExpression []RuleExpression `json:"ruleExpression" yaml:"ruleExpression"`
}

type RuleExpression struct {
	EventType  string `json:"eventType" yaml:"eventType"`
	Expression string `json:"expression" yaml:"expression"`
}
