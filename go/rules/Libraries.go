package rules

import (
	"net"
	"strings"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
	"github.com/google/cel-go/common/types/traits"
)

// MockProfile is the user-supplied ApplicationProfile mock, keyed by containerId.
type MockProfile struct {
	Containers map[string]MockContainer `json:"containers" yaml:"containers"`
}

type MockContainer struct {
	Execs        []ExecCall `json:"execs" yaml:"execs"`
	Opens        []OpenCall `json:"opens" yaml:"opens"`
	Syscalls     []string   `json:"syscalls" yaml:"syscalls"`
	Capabilities []string   `json:"capabilities" yaml:"capabilities"`
}

type ExecCall struct {
	Path string   `json:"path" yaml:"path"`
	Args []string `json:"args" yaml:"args"`
}

type OpenCall struct {
	Path  string   `json:"path" yaml:"path"`
	Flags []string `json:"flags" yaml:"flags"`
}

// MockNetwork is the user-supplied NetworkNeighborhood mock, keyed by containerId.
type MockNetwork struct {
	Containers map[string]MockNetworkContainer `json:"containers" yaml:"containers"`
}

type MockNetworkContainer struct {
	Egress  []NetworkEntry `json:"egress" yaml:"egress"`
	Ingress []NetworkEntry `json:"ingress" yaml:"ingress"`
}

type NetworkEntry struct {
	IPAddress string   `json:"ipAddress" yaml:"ipAddress"`
	DNS       []string `json:"dns" yaml:"dns"`
}

// MockK8s holds mock Kubernetes data for k8s.* CEL functions.
type MockK8s struct {
	// APIServerAddress is compared by k8s.is_api_server_address().
	APIServerAddress string `json:"apiServerAddress" yaml:"apiServerAddress"`
	// MountPaths is keyed by "namespace/pod/container" and returned by k8s.get_container_mount_paths().
	MountPaths map[string][]string `json:"mountPaths" yaml:"mountPaths"`
}

func strVal(v ref.Val) (string, bool) {
	s, ok := v.Value().(string)
	return s, ok
}

// libraryEnvOptions returns all CEL environment options for ap.*, nn.*, k8s.*, parse.*, net.*, process.*.
func libraryEnvOptions(profile MockProfile, network MockNetwork, k8sMock MockK8s) []cel.EnvOption {
	if profile.Containers == nil {
		profile.Containers = map[string]MockContainer{}
	}
	if network.Containers == nil {
		network.Containers = map[string]MockNetworkContainer{}
	}
	if k8sMock.MountPaths == nil {
		k8sMock.MountPaths = map[string][]string{}
	}

	return []cel.EnvOption{
		// ap.was_executed(containerId, path) bool
		cel.Function("ap.was_executed",
			cel.Overload("ap_was_executed",
				[]*cel.Type{cel.DynType, cel.DynType}, cel.BoolType,
				cel.FunctionBinding(func(values ...ref.Val) ref.Val {
					containerID, ok := strVal(values[0])
					if !ok {
						return types.Bool(false)
					}
					path, ok := strVal(values[1])
					if !ok {
						return types.Bool(false)
					}
					c, ok := profile.Containers[containerID]
					if !ok {
						return types.Bool(false)
					}
					for _, e := range c.Execs {
						if e.Path == path {
							return types.Bool(true)
						}
					}
					return types.Bool(false)
				}),
			),
		),
		// ap.was_path_opened(containerId, path) bool
		cel.Function("ap.was_path_opened",
			cel.Overload("ap_was_path_opened",
				[]*cel.Type{cel.DynType, cel.DynType}, cel.BoolType,
				cel.FunctionBinding(func(values ...ref.Val) ref.Val {
					containerID, ok := strVal(values[0])
					if !ok {
						return types.Bool(false)
					}
					path, ok := strVal(values[1])
					if !ok {
						return types.Bool(false)
					}
					c, ok := profile.Containers[containerID]
					if !ok {
						return types.Bool(false)
					}
					for _, o := range c.Opens {
						if o.Path == path {
							return types.Bool(true)
						}
					}
					return types.Bool(false)
				}),
			),
		),
		// ap.was_path_opened_with_suffix(containerId, suffix) bool
		cel.Function("ap.was_path_opened_with_suffix",
			cel.Overload("ap_was_path_opened_with_suffix",
				[]*cel.Type{cel.DynType, cel.DynType}, cel.BoolType,
				cel.FunctionBinding(func(values ...ref.Val) ref.Val {
					containerID, ok := strVal(values[0])
					if !ok {
						return types.Bool(false)
					}
					suffix, ok := strVal(values[1])
					if !ok {
						return types.Bool(false)
					}
					c, ok := profile.Containers[containerID]
					if !ok {
						return types.Bool(false)
					}
					for _, o := range c.Opens {
						if strings.HasSuffix(o.Path, suffix) {
							return types.Bool(true)
						}
					}
					return types.Bool(false)
				}),
			),
		),
		// ap.was_path_opened_with_prefix(containerId, prefix) bool
		cel.Function("ap.was_path_opened_with_prefix",
			cel.Overload("ap_was_path_opened_with_prefix",
				[]*cel.Type{cel.DynType, cel.DynType}, cel.BoolType,
				cel.FunctionBinding(func(values ...ref.Val) ref.Val {
					containerID, ok := strVal(values[0])
					if !ok {
						return types.Bool(false)
					}
					prefix, ok := strVal(values[1])
					if !ok {
						return types.Bool(false)
					}
					c, ok := profile.Containers[containerID]
					if !ok {
						return types.Bool(false)
					}
					for _, o := range c.Opens {
						if strings.HasPrefix(o.Path, prefix) {
							return types.Bool(true)
						}
					}
					return types.Bool(false)
				}),
			),
		),
		// ap.was_syscall_used(containerId, syscallName) bool
		cel.Function("ap.was_syscall_used",
			cel.Overload("ap_was_syscall_used",
				[]*cel.Type{cel.DynType, cel.DynType}, cel.BoolType,
				cel.FunctionBinding(func(values ...ref.Val) ref.Val {
					containerID, ok := strVal(values[0])
					if !ok {
						return types.Bool(false)
					}
					syscallName, ok := strVal(values[1])
					if !ok {
						return types.Bool(false)
					}
					c, ok := profile.Containers[containerID]
					if !ok {
						return types.Bool(false)
					}
					for _, s := range c.Syscalls {
						if s == syscallName {
							return types.Bool(true)
						}
					}
					return types.Bool(false)
				}),
			),
		),
		// ap.was_capability_used(containerId, capName) bool
		cel.Function("ap.was_capability_used",
			cel.Overload("ap_was_capability_used",
				[]*cel.Type{cel.DynType, cel.DynType}, cel.BoolType,
				cel.FunctionBinding(func(values ...ref.Val) ref.Val {
					containerID, ok := strVal(values[0])
					if !ok {
						return types.Bool(false)
					}
					capName, ok := strVal(values[1])
					if !ok {
						return types.Bool(false)
					}
					c, ok := profile.Containers[containerID]
					if !ok {
						return types.Bool(false)
					}
					for _, cap := range c.Capabilities {
						if cap == capName {
							return types.Bool(true)
						}
					}
					return types.Bool(false)
				}),
			),
		),
		// nn.is_domain_in_egress(containerId, domain) bool
		cel.Function("nn.is_domain_in_egress",
			cel.Overload("nn_is_domain_in_egress",
				[]*cel.Type{cel.DynType, cel.DynType}, cel.BoolType,
				cel.FunctionBinding(func(values ...ref.Val) ref.Val {
					containerID, ok := strVal(values[0])
					if !ok {
						return types.Bool(false)
					}
					domain, ok := strVal(values[1])
					if !ok {
						return types.Bool(false)
					}
					c, ok := network.Containers[containerID]
					if !ok {
						return types.Bool(false)
					}
					for _, e := range c.Egress {
						for _, d := range e.DNS {
							if d == domain {
								return types.Bool(true)
							}
						}
					}
					return types.Bool(false)
				}),
			),
		),
		// nn.was_address_in_egress(containerId, addr) bool
		cel.Function("nn.was_address_in_egress",
			cel.Overload("nn_was_address_in_egress",
				[]*cel.Type{cel.DynType, cel.DynType}, cel.BoolType,
				cel.FunctionBinding(func(values ...ref.Val) ref.Val {
					containerID, ok := strVal(values[0])
					if !ok {
						return types.Bool(false)
					}
					addr, ok := strVal(values[1])
					if !ok {
						return types.Bool(false)
					}
					c, ok := network.Containers[containerID]
					if !ok {
						return types.Bool(false)
					}
					for _, e := range c.Egress {
						if e.IPAddress == addr {
							return types.Bool(true)
						}
					}
					return types.Bool(false)
				}),
			),
		),
		// k8s.is_api_server_address(addr) bool
		cel.Function("k8s.is_api_server_address",
			cel.Overload("k8s_is_api_server_address",
				[]*cel.Type{cel.DynType}, cel.BoolType,
				cel.FunctionBinding(func(values ...ref.Val) ref.Val {
					addr, ok := strVal(values[0])
					if !ok {
						return types.Bool(false)
					}
					if k8sMock.APIServerAddress == "" {
						return types.Bool(false)
					}
					return types.Bool(addr == k8sMock.APIServerAddress)
				}),
			),
		),
		// k8s.get_container_mount_paths(namespace, podName, containerName) list(dyn)
		cel.Function("k8s.get_container_mount_paths",
			cel.Overload("k8s_get_container_mount_paths",
				[]*cel.Type{cel.DynType, cel.DynType, cel.DynType}, cel.ListType(cel.DynType),
				cel.FunctionBinding(func(values ...ref.Val) ref.Val {
					ns, _ := strVal(values[0])
					pod, _ := strVal(values[1])
					container, _ := strVal(values[2])
					key := ns + "/" + pod + "/" + container
					paths := k8sMock.MountPaths[key]
					vals := make([]ref.Val, len(paths))
					for i, p := range paths {
						vals[i] = types.String(p)
					}
					return types.DefaultTypeAdapter.NativeToValue(vals)
				}),
			),
		),
		// parse.get_exec_path(args, comm) string
		// Returns args[0] if non-empty, else comm.
		cel.Function("parse.get_exec_path",
			cel.Overload("parse_get_exec_path",
				[]*cel.Type{cel.DynType, cel.DynType}, cel.StringType,
				cel.FunctionBinding(func(values ...ref.Val) ref.Val {
					comm, _ := strVal(values[1])
					if indexer, ok := values[0].(traits.Indexer); ok {
						first := indexer.Get(types.Int(0))
						if !types.IsUnknownOrError(first) {
							if s, ok := strVal(first); ok && s != "" {
								return types.String(s)
							}
						}
					}
					return types.String(comm)
				}),
			),
		),
		// net.is_private_ip(ip) bool
		cel.Function("net.is_private_ip",
			cel.Overload("net_is_private_ip",
				[]*cel.Type{cel.DynType}, cel.BoolType,
				cel.FunctionBinding(func(values ...ref.Val) ref.Val {
					ipStr, ok := strVal(values[0])
					if !ok {
						return types.Bool(false)
					}
					return types.Bool(isPrivateIP(ipStr))
				}),
			),
		),
		// process.get_ld_hook_var(pid) string — always "" in the browser playground
		cel.Function("process.get_ld_hook_var",
			cel.Overload("process_get_ld_hook_var",
				[]*cel.Type{cel.DynType}, cel.StringType,
				cel.FunctionBinding(func(values ...ref.Val) ref.Val {
					return types.String("")
				}),
			),
		),
	}
}

var privateIPNets = func() []*net.IPNet {
	cidrs := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"169.254.0.0/16",
		"fc00::/7",
		"fe80::/10",
	}
	nets := make([]*net.IPNet, 0, len(cidrs))
	for _, cidr := range cidrs {
		_, n, _ := net.ParseCIDR(cidr)
		if n != nil {
			nets = append(nets, n)
		}
	}
	return nets
}()

func isPrivateIP(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}
	if ip.IsLoopback() {
		return true
	}
	for _, n := range privateIPNets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}
