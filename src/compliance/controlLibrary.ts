import { Control } from "./Control" 
export const controlLibrary: Control[] = 
[
    {
        "name": "PSP enabled",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "PSP enable fine-grained authorization of pod creation and it is important to enable it",
        "remediation": "Turn Pod Security Policies on in your cluster, if you use other admission controllers to control the behavior that PSP controls, exclude this control from your scans",
        "rulesNames": [
            "psp-enabled-cloud",
            "psp-enabled-native"
        ],
        "long_description": "Pod Security Policies enable fine-grained authorization of pod creation and updates and it extends authorization  beyond RBAC. It is an important to use PSP to control the creation of sensitive pods in your cluster.",
        "test": "Reading the cluster description from the managed cloud API (EKS, GKE), or the API server pod configuration for native K8s and checking if PSP is enabled",
        "controlID": "C-0068",
        "baseScore": 1.0,
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Deprecated Kubernetes image registry",
        "attributes": {},
        "description": "Kubernetes team has deprecated GCR (k8s.gcr.io) registry and recommends pulling Kubernetes components from the new registry (registry.k8s.io). This is mandatory from 1.27",
        "remediation": "Change the images to be pulled from the new registry (registry.k8s.io).",
        "rulesNames": [
            "rule-identify-old-k8s-registry"
        ],
        "long_description": "Kubernetes team has deprecated GCR (k8s.gcr.io) registry and recommends pulling Kubernetes components from the new registry (registry.k8s.io). This is mandatory from 1.27",
        "test": "Checking images in kube-system namespace, if the registry of the image is from the old registry we raise an alert.",
        "controlID": "C-0253",
        "baseScore": 5.0,
        "example": "@controls/examples/c239.yaml",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "CVE-2021-25741 - Using symlink for arbitrary host file system access.",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "A user may be able to create a container with subPath or subPathExpr volume mounts to access files & directories anywhere on the host filesystem. Following Kubernetes versions are affected: v1.22.0 - v1.22.1, v1.21.0 - v1.21.4, v1.20.0 - v1.20.10, version v1.19.14 and lower. This control checks the vulnerable versions and the actual usage of the subPath feature in all Pods in the cluster. If you want to learn more about the CVE, please refer to the CVE link: https://nvd.nist.gov/vuln/detail/CVE-2021-25741",
        "remediation": "To mitigate this vulnerability without upgrading kubelet, you can disable the VolumeSubpath feature gate on kubelet and kube-apiserver, or remove any existing Pods using subPath or subPathExpr feature.",
        "rulesNames": [
            "Symlink-Exchange-Can-Allow-Host-Filesystem-Access"
        ],
        "controlID": "C-0058",
        "baseScore": 6.0,
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0158",
        "name": "Ensure that the --peer-auto-tls argument is not set to true",
        "description": "Do not use automatically generated self-signed certificates for TLS connections between peers.",
        "long_description": "etcd is a highly-available key value store used by Kubernetes deployments for persistent storage of all of its REST API objects. These objects are sensitive in nature and should be accessible only by authenticated etcd peers in the etcd cluster. Hence, do not use self-signed certificates for authentication.",
        "remediation": "Edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and either remove the `--peer-auto-tls` parameter or set it to `false`.\n\n \n```\n--peer-auto-tls=false\n\n```",
        "manual_test": "Run the following command on the etcd server node:\n\n \n```\nps -ef | grep etcd\n\n```\n Verify that if the `--peer-auto-tls` argument exists, it is not set to `true`.\n**Note:** This recommendation is applicable only for etcd clusters. If you are using only one etcd server in your environment then this recommendation is not applicable.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126654/recommendations/1838575"
        ],
        "attributes": {},
        "rulesNames": [
            "etcd-peer-auto-tls-disabled"
        ],
        "baseScore": 6,
        "impact_statement": "All peers attempting to communicate with the etcd server will require a valid client certificate for authentication.",
        "default_value": "**Note:** This recommendation is applicable only for etcd clusters. If you are using only one etcd server in your environment then this recommendation is not applicable.\n\n By default, `--peer-auto-tls` argument is set to `false`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0160",
        "name": "Ensure that a minimal audit policy is created",
        "description": "Kubernetes can audit the details of requests made to the API server. The `--audit-policy-file` flag must be set for this logging to be enabled.",
        "long_description": "Logging is an important detective control for all systems, to detect potential unauthorised access.",
        "remediation": "Create an audit policy file for your cluster.",
        "manual_test": "Run the following command on one of the cluster master nodes:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--audit-policy-file` is set. Review the contents of the file specified and ensure that it contains a valid audit policy.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126657/recommendations/1838582"
        ],
        "attributes": {},
        "rulesNames": [
            "k8s-audit-logs-enabled-native-cis"
        ],
        "baseScore": 5,
        "impact_statement": "Audit logs will be created on the master nodes, which will consume disk space. Care should be taken to avoid generating too large volumes of log information as this could impact the available of the cluster nodes.",
        "default_value": "Unless the `--audit-policy-file` flag is specified, no auditing will be carried out.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0247",
        "name": "Restrict Access to the Control Plane Endpoint",
        "description": "Enable Endpoint Private Access to restrict access to the cluster's control plane to only an allowlist of authorized IPs.",
        "long_description": "Authorized networks are a way of specifying a restricted range of IP addresses that are permitted to access your cluster's control plane. Kubernetes Engine uses both Transport Layer Security (TLS) and authentication to provide secure access to your cluster's control plane from the public internet. This provides you the flexibility to administer your cluster from anywhere; however, you might want to further restrict access to a set of IP addresses that you control. You can set this restriction by specifying an authorized network.\n\n Restricting access to an authorized network can provide additional security benefits for your container cluster, including:\n\n * Better protection from outsider attacks: Authorized networks provide an additional layer of security by limiting external access to a specific set of addresses you designate, such as those that originate from your premises. This helps protect access to your cluster in the case of a vulnerability in the cluster's authentication or authorization mechanism.\n* Better protection from insider attacks: Authorized networks help protect your cluster from accidental leaks of master certificates from your company's premises. Leaked certificates used from outside Azure virtual machines and outside the authorized IP ranges (for example, from addresses outside your company) are still denied access.",
        "remediation": "",
        "manual_test": "",
        "references": [
            "<https://docs.microsoft.com/security/benchmark/azure/security-controls-v2-network-security#ns-1-implement-security-for-internal-traffic>"
        ],
        "attributes": {},
        "rulesNames": [
            "restrict-access-to-the-control-plane-endpoint"
        ],
        "baseScore": 8,
        "impact_statement": "When implementing Endpoint Private Access, be careful to ensure all desired networks are on the allowlist (whitelist) to prevent inadvertently blocking external access to your cluster's control plane.\n\n Limitations\nIP authorized ranges can't be applied to the private api server endpoint, they only apply to the public API server\nAvailability Zones are currently supported for certain regions.\nAzure Private Link service limitations apply to private clusters.\nNo support for Azure DevOps Microsoft-hosted Agents with private clusters. Consider to use Self-hosted Agents.\nFor customers that need to enable Azure Container Registry to work with private AKS, the Container Registry virtual network must be peered with the agent cluster virtual network.",
        "default_value": "By default, Endpoint Private Access is disabled.",
        "scanningScope": {
            "matches": [
                "AKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0152",
        "name": "Ensure that the Scheduler --bind-address argument is set to 127.0.0.1",
        "description": "Do not bind the scheduler service to non-loopback insecure addresses.",
        "long_description": "The Scheduler API service which runs on port 10251/TCP by default is used for health and metrics information and is available without authentication or encryption. As such it should only be bound to a localhost interface, to minimize the cluster's attack surface",
        "remediation": "Edit the Scheduler pod specification file `/etc/kubernetes/manifests/kube-scheduler.yaml` on the Control Plane node and ensure the correct value for the `--bind-address` parameter",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-scheduler\n\n```\n Verify that the `--bind-address` argument is set to 127.0.0.1",
        "references": [
            "https://workbench.cisecurity.org/sections/1126670/recommendations/1838685"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-scheduler-bind-address-argument-is-set-to-127.0.0.1"
        ],
        "baseScore": 5,
        "impact_statement": "None",
        "default_value": "By default, the `--bind-address` parameter is set to 0.0.0.0",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "CVE-2022-3172-aggregated-API-server-redirect",
        "attributes": {
            "controlTypeTags": [
                "security"
            ],
            "attackTracks": []
        },
        "description": "The API server allows an aggregated API to redirect client traffic to any URL. This could lead to the client performing unexpected actions as well as forwarding the client's API server credentials to third parties",
        "remediation": "Upgrade the Kubernetes version to one of the following versions (or higher patchs): `v1.25.1`, `v1.24.5`, `v1.23.11`, `v1.22.14`",
        "rulesNames": [
            "CVE-2022-3172"
        ],
        "long_description": "The API server allows an aggregated API  to redirect client traffic to any URL. This could lead to the client performing unexpected actions as well as forwarding the client's API server credentials to third parties",
        "test": "List the aggregated-API-server services that could potentially be used to redirect client traffic to any URL, if the API server version is vulnerable to CVE-2022-3172",
        "controlID": "C-0089",
        "baseScore": 3.0,
        "example": "",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "ServiceAccount token mounted",
        "attributes": {
            "controlTypeTags": [
                "security"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Credential access"
                    ]
                }
            ]
        },
        "description": "Potential attacker may gain access to a workload and steal its ServiceAccount token. Therefore, it is recommended to disable automatic mapping of the ServiceAccount tokens in ServiceAccount configuration. Enable it only for workloads that need to use them and ensure that this ServiceAccount is not bound to an unnecessary ClusterRoleBinding or RoleBinding.",
        "remediation": "Disable automatic mounting of service account tokens to pods at the workload level, by specifying automountServiceAccountToken: false. Enable it only for workloads that need to use them and ensure that this ServiceAccount doesn't have unnecessary permissions",
        "rulesNames": [
            "serviceaccount-token-mount"
        ],
        "test": "test if ServiceAccount token is mounted on workload and it has at least one binding.",
        "controlID": "C-0261",
        "baseScore": 7.0,
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Configured liveness probe",
        "attributes": {
            "controlTypeTags": [
                "devops"
            ]
        },
        "description": "Liveness probe is intended to ensure that workload remains healthy during its entire execution lifecycle, or otherwise restrat the container. It is highly recommended to define liveness probe for every worker container. This control finds all the pods where the Liveness probe is not configured.",
        "remediation": "Ensure Liveness probes are configured wherever possible.",
        "rulesNames": [
            "configured-liveness-probe"
        ],
        "long_description": "Liveness probe is intended to ensure that workload remains healthy during its entire execution lifecycle, or otherwise restrat the container. It is highly recommended to define liveness probe for every worker container. This control finds all the pods where the Liveness probe is not configured.",
        "controlID": "C-0056",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "baseScore": 4.0,
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0221",
        "name": "Ensure Image Vulnerability Scanning using Amazon ECR image scanning or a third party provider",
        "description": "Scan images being deployed to Amazon EKS for vulnerabilities.",
        "long_description": "Vulnerabilities in software packages can be exploited by hackers or malicious users to obtain unauthorized access to local cloud resources. Amazon ECR and other third party products allow images to be scanned for known vulnerabilities.",
        "remediation": "To utilize AWS ECR for Image scanning please follow the steps below:\n\n To create a repository configured for scan on push (AWS CLI)\n\n \n```\naws ecr create-repository --repository-name $REPO_NAME --image-scanning-configuration scanOnPush=true --region $REGION_CODE\n\n```\n To edit the settings of an existing repository (AWS CLI)\n\n \n```\naws ecr put-image-scanning-configuration --repository-name $REPO_NAME --image-scanning-configuration scanOnPush=true --region $REGION_CODE\n\n```\n Use the following steps to start a manual image scan using the AWS Management Console.2. Open the Amazon ECR console at<https://console.aws.amazon.com/ecr/repositories>.\n3. From the navigation bar, choose the Region to create your repository in.\n4. In the navigation pane, choose Repositories.\n5. On the Repositories page, choose the repository that contains the image to scan.\n6. On the Images page, select the image to scan and then choose Scan.",
        "manual_test": "Please follow AWS ECS or your 3rd party image scanning provider's guidelines for enabling Image Scanning.",
        "references": [
            "https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning.html"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-image-scanning-enabled-cloud"
        ],
        "baseScore": 5,
        "impact_statement": "If you are utilizing AWS ECR The following are common image scan failures. You can view errors like this in the Amazon ECR console by displaying the image details or through the API or AWS CLI by using the DescribeImageScanFindings API. UnsupportedImageErrorYou may get an UnsupportedImageError error when attempting to scan an image that was built using an operating system that Amazon ECR doesn't support image scanning for. Amazon ECR supports package vulnerability scanning for major versions of Amazon Linux, Amazon Linux 2, Debian, Ubuntu, CentOS, Oracle Linux, Alpine, and RHEL Linux distributions. Amazon ECR does not support scanning images built from the Docker scratch image. An UNDEFINED severity level is returnedYou may receive a scan finding that has a severity level of UNDEFINED. The following are the common causes for this: The vulnerability was not assigned a priority by the CVE source. The vulnerability was assigned a priority that Amazon ECR did not recognize. To determine the severity and description of a vulnerability, you can view the CVE directly from the source.",
        "default_value": "Images are not scanned by Default.",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0240",
        "name": "Ensure Network Policy is Enabled and set as appropriate",
        "description": "When you run modern, microservices-based applications in Kubernetes, you often want to control which components can communicate with each other. The principle of least privilege should be applied to how traffic can flow between pods in an Azure Kubernetes Service (AKS) cluster. Let's say you likely want to block traffic directly to back-end applications. The Network Policy feature in Kubernetes lets you define rules for ingress and egress traffic between pods in a cluster.",
        "long_description": "All pods in an AKS cluster can send and receive traffic without limitations, by default. To improve security, you can define rules that control the flow of traffic. Back-end applications are often only exposed to required front-end services, for example. Or, database components are only accessible to the application tiers that connect to them.\n\n Network Policy is a Kubernetes specification that defines access policies for communication between Pods. Using Network Policies, you define an ordered set of rules to send and receive traffic and apply them to a collection of pods that match one or more label selectors.\n\n These network policy rules are defined as YAML manifests. Network policies can be included as part of a wider manifest that also creates a deployment or service.",
        "remediation": "",
        "manual_test": "",
        "references": [
            "<https://docs.microsoft.com/security/benchmark/azure/security-controls-v2-network-security#ns-2-connect-private-networks-together>\n\n  <https://docs.microsoft.com/en-us/azure/aks/use-network-policies>"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-cni-enabled-aks"
        ],
        "baseScore": 6,
        "impact_statement": "Network Policy requires the Network Policy add-on. This add-on is included automatically when a cluster with Network Policy is created, but for an existing cluster, needs to be added prior to enabling Network Policy.\n\n Enabling/Disabling Network Policy causes a rolling update of all cluster nodes, similar to performing a cluster upgrade. This operation is long-running and will block other operations on the cluster (including delete) until it has run to completion.\n\n If Network Policy is used, a cluster must have at least 2 nodes of type `n1-standard-1` or higher. The recommended minimum size cluster to run Network Policy enforcement is 3 `n1-standard-1` instances.\n\n Enabling Network Policy enforcement consumes additional resources in nodes. Specifically, it increases the memory footprint of the `kube-system` process by approximately 128MB, and requires approximately 300 millicores of CPU.",
        "default_value": "By default, Network Policy is disabled.",
        "scanningScope": {
            "matches": [
                "AKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0239",
        "name": "Prefer using dedicated AKS Service Accounts",
        "description": "Kubernetes workloads should not use cluster node service accounts to authenticate to Azure AKS APIs. Each Kubernetes workload that needs to authenticate to other Azure Web Services using IAM should be provisioned with a dedicated Service account.",
        "long_description": "Manual approaches for authenticating Kubernetes workloads running on Azure AKS against Azure APIs are: storing service account keys as a Kubernetes secret (which introduces manual key rotation and potential for key compromise); or use of the underlying nodes' IAM Service account, which violates the principle of least privilege on a multi-tenanted node, when one pod needs to have access to a service, but every other pod on the node that uses the Service account does not.",
        "remediation": "Azure Active Directory integration\nThe security of AKS clusters can be enhanced with the integration of Azure Active Directory (AD). Built on decades of enterprise identity management, Azure AD is a multi-tenant, cloud-based directory, and identity management service that combines core directory services, application access management, and identity protection. With Azure AD, you can integrate on-premises identities into AKS clusters to provide a single source for account management and security.\n\n Azure Active Directory integration with AKS clusters\n\n With Azure AD-integrated AKS clusters, you can grant users or groups access to Kubernetes resources within a namespace or across the cluster. To obtain a kubectl configuration context, a user can run the az aks get-credentials command. When a user then interacts with the AKS cluster with kubectl, they're prompted to sign in with their Azure AD credentials. This approach provides a single source for user account management and password credentials. The user can only access the resources as defined by the cluster administrator.\n\n Azure AD authentication is provided to AKS clusters with OpenID Connect. OpenID Connect is an identity layer built on top of the OAuth 2.0 protocol. For more information on OpenID Connect, see the Open ID connect documentation. From inside of the Kubernetes cluster, Webhook Token Authentication is used to verify authentication tokens. Webhook token authentication is configured and managed as part of the AKS cluster.",
        "manual_test": "For each namespace in the cluster, review the rights assigned to the default service account and ensure that it has no roles or cluster roles bound to it apart from the defaults.",
        "references": [
            "<https://docs.microsoft.com/security/benchmark/azure/security-controls-v2-identity-management#im-2-manage-application-identities-securely-and-automatically>"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-default-service-accounts-has-only-default-roles"
        ],
        "baseScore": 7,
        "impact_statement": "",
        "default_value": "",
        "scanningScope": {
            "matches": [
                "AKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0114",
        "name": "Ensure that the API Server --token-auth-file parameter is not set",
        "description": "Do not use token based authentication.",
        "long_description": "The token-based authentication utilizes static tokens to authenticate requests to the apiserver. The tokens are stored in clear-text in a file on the apiserver, and cannot be revoked or rotated without restarting the apiserver. Hence, do not use static token-based authentication.",
        "remediation": "Follow the documentation and configure alternate mechanisms for authentication. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and remove the `--token-auth-file=<filename>` parameter.",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--token-auth-file` argument does not exist.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838611"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-token-auth-file-parameter-is-not-set"
        ],
        "baseScore": 8,
        "impact_statement": "You will have to configure and use alternate authentication mechanisms such as certificates. Static token based authentication could not be used.",
        "default_value": "By default, `--token-auth-file` argument is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0108",
        "name": "Ensure that the controller-manager.conf file permissions are set to 600 or more restrictive",
        "description": "Ensure that the `controller-manager.conf` file has permissions of 600 or more restrictive.",
        "long_description": "The `controller-manager.conf` file is the kubeconfig file for the Controller Manager. You should restrict its file permissions to maintain the integrity of the file. The file should be writable by only the administrators on the system.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/controller-manager.conf\n\n```",
        "manual_test": "Run the following command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %a /etc/kubernetes/controller-manager.conf\n\n```\n Verify that the permissions are `600` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838593"
        ],
        "rulesNames": [
            "ensure-that-the-controller-manager.conf-file-permissions-are-set-to-600-or-more-restrictive"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `controller-manager.conf` has permissions of `640`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "The default namespace should not be used",
        "controlID": "C-0212",
        "description": "Kubernetes provides a default namespace, where objects are placed if no namespace is specified for them. Placing objects in this namespace makes application of RBAC and other controls more difficult.",
        "long_description": "Resources in a Kubernetes cluster should be segregated by namespace, to allow for security controls to be applied at that level and to make it easier to manage resources.",
        "remediation": "Ensure that namespaces are created to allow for appropriate segregation of Kubernetes resources and that all new resources are created in a specific namespace.",
        "manual_test": "Run this command to list objects in default namespace\n\n \n```\nkubectl get $(kubectl api-resources --verbs=list --namespaced=true -o name | paste -sd, -) --ignore-not-found -n default\n\n```\n The only entries there should be system managed resources such as the `kubernetes` service",
        "test": "Lists all resources in default namespace for user to review and approve.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126667/recommendations/1838637"
        ],
        "attributes": {},
        "rulesNames": [
            "pods-in-default-namespace",
            "rolebinding-in-default-namespace",
            "role-in-default-namespace",
            "configmap-in-default-namespace",
            "endpoints-in-default-namespace",
            "persistentvolumeclaim-in-default-namespace",
            "podtemplate-in-default-namespace",
            "replicationcontroller-in-default-namespace",
            "service-in-default-namespace",
            "serviceaccount-in-default-namespace",
            "endpointslice-in-default-namespace",
            "horizontalpodautoscaler-in-default-namespace",
            "lease-in-default-namespace",
            "csistoragecapacity-in-default-namespace",
            "ingress-in-default-namespace",
            "poddisruptionbudget-in-default-namespace",
            "resources-secret-in-default-namespace"
        ],
        "baseScore": 4,
        "impact_statement": "None",
        "default_value": "Unless a namespace is specific on object creation, the `default` namespace will be used",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0155",
        "name": "Ensure that the --auto-tls argument is not set to true",
        "description": "Do not use self-signed certificates for TLS.",
        "long_description": "etcd is a highly-available key value store used by Kubernetes deployments for persistent storage of all of its REST API objects. These objects are sensitive in nature and should not be available to unauthenticated clients. You should enable the client authentication via valid certificates to secure the access to the etcd service.",
        "remediation": "Edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and either remove the `--auto-tls` parameter or set it to `false`.\n\n \n```\n--auto-tls=false\n\n```",
        "manual_test": "Run the following command on the etcd server node:\n\n \n```\nps -ef | grep etcd\n\n```\n Verify that if the `--auto-tls` argument exists, it is not set to `true`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126654/recommendations/1838567"
        ],
        "attributes": {},
        "rulesNames": [
            "etcd-auto-tls-disabled"
        ],
        "baseScore": 6,
        "impact_statement": "Clients will not be able to use self-signed certificates for TLS.",
        "default_value": "By default, `--auto-tls` is set to `false`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0098",
        "name": "Ensure that the etcd pod specification file permissions are set to 600 or more restrictive",
        "description": "Ensure that the `/etc/kubernetes/manifests/etcd.yaml` file has permissions of `600` or more restrictive.",
        "long_description": "The etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` controls various parameters that set the behavior of the `etcd` service in the master node. etcd is a highly-available key-value store which Kubernetes uses for persistent storage of all of its REST API object. You should restrict its file permissions to maintain the integrity of the file. The file should be writable by only the administrators on the system.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/manifests/etcd.yaml\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %a /etc/kubernetes/manifests/etcd.yaml\n\n```\n Verify that the permissions are `600` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838571"
        ],
        "rulesNames": [
            "ensure-that-the-etcd-pod-specification-file-permissions-are-set-to-600-or-more-restrictive"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `/etc/kubernetes/manifests/etcd.yaml` file has permissions of `640`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Ensure that default service accounts are not actively used",
        "controlID": "C-0189",
        "description": "The `default` service account should not be used to ensure that rights granted to applications can be more easily audited and reviewed.",
        "long_description": "Kubernetes provides a `default` service account which is used by cluster workloads where no specific service account is assigned to the pod.\n\n Where access to the Kubernetes API from a pod is required, a specific service account should be created for that pod, and rights granted to that service account.\n\n The default service account should be configured such that it does not provide a service account token and does not have any explicit rights assignments.",
        "remediation": "Create explicit service accounts wherever a Kubernetes workload requires specific access to the Kubernetes API server.\n\n Modify the configuration of each default service account to include this value\n\n \n```\nautomountServiceAccountToken: false\n\n```",
        "manual_test": "For each namespace in the cluster, review the rights assigned to the default service account and ensure that it has no roles or cluster roles bound to it apart from the defaults.\n\n Additionally ensure that the `automountServiceAccountToken: false` setting is in place for each default service account.",
        "test": "Checks that each namespace has at least one service account that isn't the default, and checks that the default service accounts have 'automountServiceAccountToken: false' set",
        "references": [
            "https://workbench.cisecurity.org/sections/1126661/recommendations/1838594"
        ],
        "attributes": {},
        "rulesNames": [
            "automount-default-service-account",
            "namespace-without-service-account"
        ],
        "baseScore": 5,
        "impact_statement": "All workloads which require access to the Kubernetes API will require an explicit service account to be created.",
        "default_value": "By default the `default` service account allows for its service account token to be mounted in pods in its namespace.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Access container service account",
        "attributes": {
            "microsoftMitreColumns": [
                "Credential access"
            ],
            "rbacQuery": "Container service account mapping",
            "controlTypeTags": [
                "compliance",
                "security-impact"
            ]
        },
        "description": "Attackers who obtain access to a pod can use its SA token to communicate with KubeAPI server. All pods with SA token mounted (if such token has a Role or a ClusterRole binding) are considerred potentially dangerous.",
        "remediation": "Verify that RBAC is enabled. Follow the least privilege principle and ensure that only necessary pods have SA token mounted into them.",
        "rulesNames": [
            "access-container-service-account-v1"
        ],
        "long_description": "Service account (SA) represents an application identity in Kubernetes. By default, an SA is mounted to every created pod in the cluster. Using the SA, containers in the pod can send requests to the Kubernetes API server. Attackers who get access to a pod can access the SA token (located in /var/run/secrets/kubernetes.io/serviceaccount/token) and perform actions in the cluster, according to the SA permissions. If RBAC is not enabled, the SA has unlimited permissions in the cluster. If RBAC is enabled, its permissions are determined by the RoleBindings\\\\ClusterRoleBindings that are associated with it.",
        "test": "Control checks if RBAC is enabled. If it's not, the SA has unlimited permissions. If RBAC is enabled, it lists  all permissions for each SA.",
        "controlID": "C-0053",
        "baseScore": 6.0,
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0233",
        "name": "Consider Fargate for running untrusted workloads",
        "description": "It is Best Practice to restrict or fence untrusted workloads when running in a multi-tenant environment.",
        "long_description": "",
        "remediation": "**Create a Fargate profile for your cluster**\nBefore you can schedule pods running on Fargate in your cluster, you must define a Fargate profile that specifies which pods should use Fargate when they are launched. For more information, see AWS Fargate profile.\n\n **Note**\nIf you created your cluster with eksctl using the --fargate option, then a Fargate profile has already been created for your cluster with selectors for all pods in the kube-system and default namespaces. Use the following procedure to create Fargate profiles for any other namespaces you would like to use with Fargate.\n\n **via eksctl CLI**\nCreate your Fargate profile with the following eksctl command, replacing the variable text with your own values. You must specify a namespace, but the labels option is not required.\n\n \n```\neksctl create fargateprofile --cluster cluster_name --name fargate_profile_name --namespace kubernetes_namespace --labels key=value\n\n```\n **via AWS Management Console**\n\n To create a Fargate profile for a cluster with the AWS Management Console\n\n 1. Open the Amazon EKS console at <https://console.aws.amazon.com/eks/home#/clusters>.\n2. Choose the cluster to create a Fargate profile for.\n3. Under Fargate profiles, choose Add Fargate profile.\n4. On the Configure Fargate profile page, enter the following information and choose Next.\n\n * For Name, enter a unique name for your Fargate profile.\n* For Pod execution role, choose the pod execution role to use with your Fargate profile. Only IAM roles with the eks-fargate-pods.amazonaws.com service principal are shown. If you do not see any roles listed here, you must create one. For more information, see Pod execution role.\n* For Subnets, choose the subnets to use for your pods. By default, all subnets in your cluster's VPC are selected. Only private subnets are supported for pods running on Fargate; you must deselect any public subnets.\n* For Tags, you can optionally tag your Fargate profile. These tags do not propagate to other resources associated with the profile, such as its pods.\n\n 5. On the Configure pods selection page, enter the following information and choose Next.\n\n * list text hereFor Namespace, enter a namespace to match for pods, such as kube-system or default.\n* Add Kubernetes labels to the selector that pods in the specified namespace must have to match the selector. For example, you could add the label infrastructure: fargate to the selector so that only pods in the specified namespace that also have the infrastructure: fargate Kubernetes label match the selector.\n\n 6. On the Review and create page, review the information for your Fargate profile and choose Create.",
        "manual_test": "",
        "references": [
            "https://docs.aws.amazon.com/eks/latest/userguide/fargate.html"
        ],
        "attributes": {},
        "rulesNames": [
            "alert-fargate-not-in-use"
        ],
        "baseScore": 3,
        "impact_statement": "",
        "default_value": "By default, AWS Fargate is not utilized.",
        "scanningScope": {
            "matches": [
                "EKS"
            ]
        },
        "rules": []
    },
    {
        "name": "Host PID/IPC privileges",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Containers should be isolated from the host machine as much as possible. The hostPID and hostIPC fields in deployment yaml may allow cross-container influence and may expose the host itself to potentially malicious or destructive actions. This control identifies all pods using hostPID or hostIPC privileges.",
        "remediation": "Remove hostPID and hostIPC from the yaml file(s) privileges unless they are absolutely necessary.",
        "rulesNames": [
            "host-pid-ipc-privileges"
        ],
        "long_description": "Containers should be isolated from the host machine as much as possible. The hostPID and hostIPC fields in deployment yaml may allow cross-container influence and may expose the host itself to potentially malicious or destructive actions. This control identifies all pods using hostPID or hostIPC privileges.",
        "controlID": "C-0038",
        "baseScore": 7.0,
        "example": "@controls/examples/c038.yaml",
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Node escape",
                "id": "Cat-9"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0120",
        "name": "Ensure that the API Server --authorization-mode argument includes RBAC",
        "description": "Turn on Role Based Access Control.",
        "long_description": "Role Based Access Control (RBAC) allows fine-grained control over the operations that different entities can perform on different objects in the cluster. It is recommended to use the RBAC authorization mode.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--authorization-mode` parameter to a value that includes `RBAC`, for example:\n\n \n```\n--authorization-mode=Node,RBAC\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--authorization-mode` argument exists and is set to a value to include `RBAC`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838642"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-authorization-mode-argument-includes-RBAC"
        ],
        "baseScore": 8,
        "impact_statement": "When RBAC is enabled you will need to ensure that appropriate RBAC settings (including Roles, RoleBindings and ClusterRoleBindings) are configured to allow appropriate access.",
        "default_value": "By default, `RBAC` authorization is not enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Workloads with Critical vulnerabilities exposed to external traffic",
        "attributes": {
            "controlTypeTags": [
                "security"
            ]
        },
        "description": "Container images with known critical vulnerabilities pose elevated risk if they are exposed to the external traffic. This control lists all images with such vulnerabilities if either LoadBalancer or NodePort service is assigned to them.",
        "remediation": "Either update the container image to fix the vulnerabilities (if such fix is available) or reassess if this workload must be exposed to the outseide traffic. If no fix is available, consider periodic restart of the pod to minimize the risk of persistant intrusion. Use exception mechanism if you don't want to see this report again.",
        "rulesNames": [
            "exposed-critical-pods"
        ],
        "long_description": "Container images with known critical vulnerabilities pose elevated risk if they are exposed to the external traffic. This control lists all images with such vulnerabilities if either LoadBalancer or NodePort service assigned to them.",
        "test": "This control enumerates external facing workloads, that have LoadBalancer or NodePort services and checks image vulnerability information to see if the image has critical vulnerabilities.",
        "controlID": "C-0083",
        "baseScore": 8.0,
        "example": "@controls/examples/c83.yaml",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Minimize access to the service account token creation",
        "controlID": "C-0282",
        "description": "Users with rights to create new service account tokens at a cluster level, can create long-lived privileged credentials in the cluster. This could allow for privilege escalation and persistent access to the cluster, even if the users account has been revoked.",
        "long_description": "Users with rights to create new service account tokens at a cluster level, can create long-lived privileged credentials in the cluster. This could allow for privilege escalation and persistent access to the cluster, even if the users account has been revoked.",
        "remediation": "Where possible, remove access to the token sub-resource of serviceaccount objects.",
        "manual_test": "Review the users who have access to create the token sub-resource of serviceaccount objects in the Kubernetes API.",
        "test": "Check which subjects have RBAC permissions to create the token sub-resource of serviceaccount objects.",
        "references": [
            "https://workbench.cisecurity.org/sections/2633388/recommendations/4261965"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-can-create-service-account-token"
        ],
        "baseScore": 5,
        "impact_statement": "Users with rights to create new service account tokens at a cluster level, can create long-lived privileged credentials in the cluster. This could allow for privilege escalation and persistent access to the cluster, even if the users account has been revoked.",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "default_value": "By default in a kubeadm cluster the following list of principals have `create` privileges on `serviceaccount/token` objects ```CLUSTERROLEBINDING                                    SUBJECT                             TYPE            SA-NAMESPACEcluster-admin                                         system:masters                      Group           system:controller:clusterrole-aggregation-controller  clusterrole-aggregation-controller  ServiceAccount  kube-systemsystem:controller:daemon-set-controller               daemon-set-controller               ServiceAccount  kube-systemsystem:controller:job-controller                      job-controller                      ServiceAccount  kube-systemsystem:controller:persistent-volume-binder            persistent-volume-binder            ServiceAccount  kube-systemsystem:controller:replicaset-controller               replicaset-controller               ServiceAccount  kube-systemsystem:controller:replication-controller              replication-controller              ServiceAccount  kube-systemsystem:controller:statefulset-controller              statefulset-controller              ServiceAccount  kube-system```",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Minimize access to create persistent volumes",
        "controlID": "C-0278",
        "description": "The ability to create persistent volumes in a cluster can provide an opportunity for privilege escalation, via the creation of hostPath volumes. ",
        "long_description": "The ability to create persistent volumes in a cluster can provide an opportunity for privilege escalation, via the creation of hostPath volumes. As persistent volumes are not covered by Pod Security Admission, a user with access to create persistent volumes may be able to get access to sensitive files from the underlying host even where restrictive Pod Security Admission policies are in place.",
        "remediation": "Where possible, remove `create` access to `persistentvolume` objects in the cluster.",
        "manual_test": "Review the users who have create access to persistentvolume objects in the Kubernetes API.",
        "test": "Check which subjects have RBAC permissions to create persistentvolumes.",
        "references": [
            "https://workbench.cisecurity.org/sections/2633388/recommendations/4261959"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-can-create-pv"
        ],
        "baseScore": 5,
        "impact_statement": "Care should be taken not to remove access to pods to system components which require this for their operation",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "default_value": "By default in a kubeadm cluster the following list of principals have `create` privileges on `persistentvolume` objects ```CLUSTERROLEBINDING                                    SUBJECT                             TYPE            SA-NAMESPACEcluster-admin                                         system:masters                      Group           system:controller:clusterrole-aggregation-controller  clusterrole-aggregation-controller  ServiceAccount  kube-systemsystem:controller:daemon-set-controller               daemon-set-controller               ServiceAccount  kube-systemsystem:controller:job-controller                      job-controller                      ServiceAccount  kube-systemsystem:controller:persistent-volume-binder            persistent-volume-binder            ServiceAccount  kube-systemsystem:controller:replicaset-controller               replicaset-controller               ServiceAccount  kube-systemsystem:controller:replication-controller              replication-controller              ServiceAccount  kube-systemsystem:controller:statefulset-controller              statefulset-controller              ServiceAccount  kube-system```",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0225",
        "name": "Prefer using dedicated EKS Service Accounts",
        "description": "Kubernetes workloads should not use cluster node service accounts to authenticate to Amazon EKS APIs. Each Kubernetes workload that needs to authenticate to other AWS services using AWS IAM should be provisioned with a dedicated Service account.",
        "long_description": "Manual approaches for authenticating Kubernetes workloads running on Amazon EKS against AWS APIs are: storing service account keys as a Kubernetes secret (which introduces manual key rotation and potential for key compromise); or use of the underlying nodes' IAM Service account, which violates the principle of least privilege on a multi-tenanted node, when one pod needs to have access to a service, but every other pod on the node that uses the Service account does not.",
        "remediation": "With IAM roles for service accounts on Amazon EKS clusters, you can associate an IAM role with a Kubernetes service account. This service account can then provide AWS permissions to the containers in any pod that uses that service account. With this feature, you no longer need to provide extended permissions to the worker node IAM role so that pods on that node can call AWS APIs.\n\n Applications must sign their AWS API requests with AWS credentials. This feature provides a strategy for managing credentials for your applications, similar to the way that Amazon EC2 instance profiles provide credentials to Amazon EC2 instances. Instead of creating and distributing your AWS credentials to the containers or using the Amazon EC2 instance\u2019s role, you can associate an IAM role with a Kubernetes service account. The applications in the pod\u2019s containers can then use an AWS SDK or the AWS CLI to make API requests to authorized AWS services.\n\n The IAM roles for service accounts feature provides the following benefits:\n\n * Least privilege \u2014 By using the IAM roles for service accounts feature, you no longer need to provide extended permissions to the worker node IAM role so that pods on that node can call AWS APIs. You can scope IAM permissions to a service account, and only pods that use that service account have access to those permissions. This feature also eliminates the need for third-party solutions such as kiam or kube2iam.\n* Credential isolation \u2014 A container can only retrieve credentials for the IAM role that is associated with the service account to which it belongs. A container never has access to credentials that are intended for another container that belongs to another pod.\n* Audit-ability \u2014 Access and event logging is available through CloudTrail to help ensure retrospective auditing.\n\n To get started, see list text hereEnabling IAM roles for service accounts on your cluster.\n\n For an end-to-end walkthrough using eksctl, see Walkthrough: Updating a DaemonSet to use IAM for service accounts.",
        "manual_test": "For each namespace in the cluster, review the rights assigned to the default service account and ensure that it has no roles or cluster roles bound to it apart from the defaults.\n\n Additionally ensure that the automountServiceAccountToken: false setting is in place for each default service account.",
        "references": [
            "https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html",
            "https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts-cni-walkthrough.html",
            "https://aws.github.io/aws-eks-best-practices/security/docs/iam/#scope-the-iam-role-trust-policy-for-irsa-to-the-service-account-name"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-default-service-accounts-has-only-default-roles",
            "automount-default-service-account"
        ],
        "baseScore": 7,
        "impact_statement": "",
        "default_value": "",
        "scanningScope": {
            "matches": [
                "EKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0140",
        "name": "Ensure that the API Server --etcd-cafile argument is set as appropriate",
        "description": "etcd should be configured to make use of TLS encryption for client connections.",
        "long_description": "etcd is a highly-available key value store used by Kubernetes deployments for persistent storage of all of its REST API objects. These objects are sensitive in nature and should be protected by client authentication. This requires the API server to identify itself to the etcd server using a SSL Certificate Authority file.",
        "remediation": "Follow the Kubernetes documentation and set up the TLS connection between the apiserver and etcd. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and set the etcd certificate authority file parameter.\n\n \n```\n--etcd-cafile=<path/to/ca-file>\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--etcd-cafile` argument exists and it is set as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838673"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-etcd-cafile-argument-is-set-as-appropriate"
        ],
        "baseScore": 8,
        "impact_statement": "TLS and client certificate authentication must be configured for etcd.",
        "default_value": "By default, `--etcd-cafile` is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Workload with cluster takeover roles",
        "attributes": {
            "controlTypeTags": [
                "security"
            ],
            "attackTracks": [
                {
                    "attackTrack": "external-workload-with-cluster-takeover-roles",
                    "categories": [
                        "Cluster Access"
                    ],
                    "displayRelatedResources": true,
                    "clickableResourceKind": "ServiceAccount"
                }
            ]
        },
        "description": "Cluster takeover roles include workload creation or update and secret access. They can easily lead to super privileges in the cluster. If an attacker can exploit this workload then the attacker can take over the cluster using the RBAC privileges this workload is assigned to.",
        "remediation": "You should apply least privilege principle. Make sure each service account has only the permissions that are absolutely necessary.",
        "rulesNames": [
            "workload-with-cluster-takeover-roles"
        ],
        "long_description": "In Kubernetes, workloads with overly permissive roles pose a significant security risk. When a workload is granted roles that exceed the necessities of its operation, it creates an attack surface for privilege escalation within the cluster. This is especially critical if the roles include permissions for creating, updating, or accessing sensitive resources or secrets. An attacker exploiting such a workload can leverage these excessive privileges to perform unauthorized actions, potentially leading to a full cluster takeover. Ensuring that each service account associated with a workload is limited to permissions that are strictly necessary for its function is crucial in mitigating the risk of cluster takeovers.",
        "test": "Check if the service account used by a workload has cluster takeover roles.",
        "controlID": "C-0267",
        "baseScore": 6.0,
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0250",
        "name": "Minimize cluster access to read-only for Azure Container Registry (ACR)",
        "description": "Configure the Cluster Service Account with Storage Object Viewer Role to only allow read-only access to Azure Container Registry (ACR)",
        "long_description": "The Cluster Service Account does not require administrative access to Azure ACR, only requiring pull access to containers to deploy onto Azure AKS. Restricting permissions follows the principles of least privilege and prevents credentials from being abused beyond the required role.",
        "remediation": "",
        "manual_test": "",
        "references": [
            "<https://docs.microsoft.com/security/benchmark/azure/security-controls-v2-data-protection#dp-2-protect-sensitive-data>"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-service-principle-has-read-only-permissions"
        ],
        "baseScore": 6,
        "impact_statement": "A separate dedicated service account may be required for use by build servers and other robot users pushing or managing container images.",
        "default_value": "",
        "scanningScope": {
            "matches": [
                "AKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0229",
        "name": "Ensure clusters are created with Private Nodes",
        "description": "Disable public IP addresses for cluster nodes, so that they only have private IP addresses. Private Nodes are nodes with no public IP addresses.",
        "long_description": "Disabling public IP addresses on cluster nodes restricts access to only internal networks, forcing attackers to obtain local network access before attempting to compromise the underlying Kubernetes hosts.",
        "remediation": "\n```\naws eks update-cluster-config \\\n    --region region-code \\\n    --name my-cluster \\\n    --resources-vpc-config endpointPublicAccess=true,publicAccessCidrs=\"203.0.113.5/32\",endpointPrivateAccess=true\n\n```",
        "manual_test": "",
        "references": [],
        "attributes": {},
        "rulesNames": [
            "ensure-endpointpublicaccess-is-disabled-on-private-nodes-eks"
        ],
        "baseScore": 8.0,
        "impact_statement": "To enable Private Nodes, the cluster has to also be configured with a private master IP range and IP Aliasing enabled.\n\n Private Nodes do not have outbound access to the public internet. If you want to provide outbound Internet access for your private nodes, you can use Cloud NAT or you can manage your own NAT gateway.",
        "default_value": "",
        "scanningScope": {
            "matches": [
                "EKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0216",
        "name": "Minimize the admission of containers wishing to share the host network namespace",
        "description": "Do not generally permit containers to be run with the `hostNetwork` flag set to true.",
        "long_description": "A container running in the host's network namespace could access the local loopback device, and could access network traffic to and from other pods.\n\n There should be at least one PodSecurityPolicy (PSP) defined which does not permit containers to share the host network namespace.\n\n If you have need to run containers which require hostNetwork, this should be defined in a separate PSP and you should carefully check RBAC controls to ensure that only limited service accounts and users are given permission to access that PSP.",
        "remediation": "Create a PSP as described in the Kubernetes documentation, ensuring that the `.spec.hostNetwork` field is omitted or set to false.",
        "manual_test": "Get the set of PSPs with the following command:\n\n \n```\nkubectl get psp\n\n```\n For each PSP, check whether privileged is enabled:\n\n \n```\nkubectl get psp <name> -o=jsonpath='{.spec.hostNetwork}'\n\n```\n Verify that there is at least one PSP which does not return true.",
        "references": [
            "https://kubernetes.io/docs/concepts/policy/pod-security-policy"
        ],
        "attributes": {},
        "rulesNames": [
            "psp-deny-hostnetwork"
        ],
        "baseScore": 5.0,
        "impact_statement": "Pods defined with `spec.hostNetwork: true` will not be permitted unless they are run under a specific PSP.",
        "default_value": "By default, PodSecurityPolicies are not defined.",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Workload with PVC access",
        "attributes": {
            "controlTypeTags": [
                "security"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Data Collection"
                    ]
                }
            ]
        },
        "description": "This control detects workloads that have mounted PVC. Workloads with PVC access can potentially expose sensitive information and elevate the risk of unauthorized access to critical resources.",
        "remediation": "Review the workloads identified by this control and assess whether it's necessary to mount these PVCs. Remove PVC access from workloads that don't require it or ensure appropriate access controls are in place to protect sensitive information.",
        "rulesNames": [
            "workload-mounted-pvc"
        ],
        "test": "Check if any workload has mounted PVCs by inspecting their specifications and verifying if PVC volumes are defined",
        "controlID": "C-0257",
        "baseScore": 4.0,
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Storage",
                "id": "Cat-8"
            },
            "id": "Cat-5"
        },
        "rules": []
    },
    {
        "name": "Workload with credential access",
        "attributes": {
            "controlTypeTags": [
                "security"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Credential access"
                    ]
                }
            ]
        },
        "description": "This control checks if workloads specifications have sensitive information in their environment variables.",
        "remediation": "Use Kubernetes secrets or Key Management Systems to store credentials.",
        "rulesNames": [
            "rule-credentials-in-env-var"
        ],
        "test": "Check if the workload has sensitive information in environment variables, by using list of known sensitive key names.",
        "controlID": "C-0259",
        "baseScore": 8.0,
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0203",
        "name": "Minimize the admission of HostPath volumes",
        "description": "Do not generally admit containers which make use of `hostPath` volumes.",
        "long_description": "A container which mounts a `hostPath` volume as part of its specification will have access to the filesystem of the underlying cluster node. The use of `hostPath` volumes may allow containers access to privileged areas of the node filesystem.\n\n There should be at least one admission control policy defined which does not permit containers to mount `hostPath` volumes.\n\n If you need to run containers which require `hostPath` volumes, this should be defined in a separate policy and you should carefully check to ensure that only limited service accounts and users are given permission to use that policy.",
        "remediation": "Add policies to each namespace in the cluster which has user workloads to restrict the admission of containers which use `hostPath` volumes.",
        "manual_test": "List the policies in use for each namespace in the cluster, ensure that each policy disallows the admission of containers with `hostPath` volumes.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126662/recommendations/1838625"
        ],
        "attributes": {},
        "rulesNames": [
            "pod-security-admission-baseline-applied-1",
            "pod-security-admission-baseline-applied-2"
        ],
        "baseScore": 6,
        "impact_statement": "Pods defined which make use of `hostPath` volumes will not be permitted unless they are run under a spefific policy.",
        "default_value": "By default, there are no restrictions on the creation of `hostPath` volumes.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Mount service principal",
        "attributes": {
            "microsoftMitreColumns": [
                "Credential Access"
            ],
            "controlTypeTags": [
                "compliance"
            ]
        },
        "description": "When a cluster is deployed in the cloud, in some cases attackers can leverage their access to a container in the cluster to gain cloud credentials. This control determines if any workload contains a volume with potential access to cloud credential.",
        "example": "apiVersion: v1\nkind: Pod\nmetadata:\n  name: test-pd\nspec:\n  containers:\n  - image: k8s.gcr.io/test-webserver\n    name: test-container\n    volumeMounts:\n    - mountPath: /test-pd\n      name: test-volume\n  volumes:\n  - name: test-volume\n    hostPath: # This field triggers failure!\n      path: /data\n      type: Directory\n",
        "remediation": "Refrain from using path mount to known cloud credentials folders or files .",
        "rulesNames": [
            "alert-mount-potential-credentials-paths"
        ],
        "long_description": "When the cluster is deployed in the cloud, in some cases attackers can leverage their access to a container in the cluster to gain cloud credentials. For example, in AKS each node contains service principal credential.",
        "test": "Check which workloads have volumes with potential access to known cloud credentials folders or files in node, like \u201c/etc/kubernetes/azure.json\u201d for Azure.",
        "controlID": "C-0020",
        "baseScore": 4.0,
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Audit logs enabled",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Audit logging is an important security feature in Kubernetes, it enables the operator to track requests to the cluster. It is important to use it so the operator has a record of events happened in Kubernetes",
        "remediation": "Turn on audit logging for your cluster. Look at the vendor guidelines for more details",
        "rulesNames": [
            "k8s-audit-logs-enabled-cloud",
            "k8s-audit-logs-enabled-native"
        ],
        "long_description": "Audit logging is an important security feature in Kubernetes, it enables the operator to track requests to the cluster. It is important to use it so the operator has a record of events happened in Kubernetes",
        "test": "Reading the cluster description from the managed cloud API (EKS, GKE), or the API server pod configuration for native K8s and checking if audit logging is enabled",
        "controlID": "C-0067",
        "baseScore": 5.0,
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0119",
        "name": "Ensure that the API Server --authorization-mode argument includes Node",
        "description": "Restrict kubelet nodes to reading only objects associated with them.",
        "long_description": "The `Node` authorization mode only allows kubelets to read `Secret`, `ConfigMap`, `PersistentVolume`, and `PersistentVolumeClaim` objects associated with their nodes.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--authorization-mode` parameter to a value that includes `Node`.\n\n \n```\n--authorization-mode=Node,RBAC\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--authorization-mode` argument exists and is set to a value to include `Node`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838641"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-authorization-mode-argument-includes-Node"
        ],
        "baseScore": 5,
        "impact_statement": "None",
        "default_value": "By default, `Node` authorization is not enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "HostPath mount",
        "attributes": {
            "microsoftMitreColumns": [
                "Privilege escalation"
            ],
            "controlTypeTags": [
                "security",
                "compliance",
                "smartRemediation"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Privilege Escalation (Node)"
                    ]
                }
            ]
        },
        "description": "Mounting host directory to the container can be used by attackers to get access to the underlying host. This control identifies all the pods using hostPath mount.",
        "example": "apiVersion: v1\nkind: Pod\nmetadata:\n  name: test-pd\nspec:\n  containers:\n  - image: k8s.gcr.io/test-webserver\n    name: test-container\n    volumeMounts:\n    - mountPath: /test-pd\n      name: test-volume\n  volumes:\n  - name: test-volume\n    hostPath: # This field triggers failure!\n      path: /data\n      type: Directory\n",
        "remediation": "Remove hostPath mounts unless they are absolutely necessary and use exception mechanism to remove notifications.",
        "rulesNames": [
            "alert-any-hostpath"
        ],
        "controlID": "C-0048",
        "baseScore": 7.0,
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Storage",
                "id": "Cat-8"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0223",
        "name": "Minimize cluster access to read-only for Amazon ECR",
        "description": "Configure the Cluster Service Account with Storage Object Viewer Role to only allow read-only access to Amazon ECR.",
        "long_description": "The Cluster Service Account does not require administrative access to Amazon ECR, only requiring pull access to containers to deploy onto Amazon EKS. Restricting permissions follows the principles of least privilege and prevents credentials from being abused beyond the required role.",
        "remediation": "You can use your Amazon ECR images with Amazon EKS, but you need to satisfy the following prerequisites.\n\n The Amazon EKS worker node IAM role (NodeInstanceRole) that you use with your worker nodes must possess the following IAM policy permissions for Amazon ECR.\n\n \n```\n{\n    \"Version\": \"2012-10-17\",\n    \"Statement\": [\n        {\n            \"Effect\": \"Allow\",\n            \"Action\": [\n                \"ecr:BatchCheckLayerAvailability\",\n                \"ecr:BatchGetImage\",\n                \"ecr:GetDownloadUrlForLayer\",\n                \"ecr:GetAuthorizationToken\"\n            ],\n            \"Resource\": \"*\"\n        }\n    ]\n}\n\n```",
        "manual_test": "Review AWS ECS worker node IAM role (NodeInstanceRole) IAM Policy Permissions to verify that they are set and the minimum required level.\n\n If utilizing a 3rd party tool to scan images utilize the minimum required permission level required to interact with the cluster - generally this should be read-only.",
        "references": [
            "https://docs.aws.amazon.com/AmazonECR/latest/userguide/ECR_on_EKS.html"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure_nodeinstancerole_has_right_permissions_for_ecr"
        ],
        "baseScore": 6,
        "impact_statement": "A separate dedicated service account may be required for use by build servers and other robot users pushing or managing container images.",
        "default_value": "If you used eksctl or the AWS CloudFormation templates in Getting Started with Amazon EKS to create your cluster and worker node groups, these IAM permissions are applied to your worker node IAM role by default.",
        "scanningScope": {
            "matches": [
                "cloud"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0161",
        "name": "Ensure that the audit policy covers key security concerns",
        "description": "Ensure that the audit policy created for the cluster covers key security concerns.",
        "long_description": "Security audit logs should cover access and modification of key resources in the cluster, to enable them to form an effective part of a security environment.",
        "remediation": "Consider modification of the audit policy in use on the cluster to include these items, at a minimum.",
        "manual_test": "Review the audit policy provided for the cluster and ensure that it covers at least the following areas :-\n\n * Access to Secrets managed by the cluster. Care should be taken to only log Metadata for requests to Secrets, ConfigMaps, and TokenReviews, in order to avoid the risk of logging sensitive data.\n* Modification of `pod` and `deployment` objects.\n* Use of `pods/exec`, `pods/portforward`, `pods/proxy` and `services/proxy`.\n\n For most requests, minimally logging at the Metadata level is recommended (the most basic level of logging).",
        "references": [
            "https://workbench.cisecurity.org/sections/1126657/recommendations/1838583"
        ],
        "attributes": {},
        "rulesNames": [
            "audit-policy-content"
        ],
        "baseScore": 5,
        "impact_statement": "Increasing audit logging will consume resources on the nodes or other log destination.",
        "default_value": "By default Kubernetes clusters do not log audit information.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Minimize access to secrets",
        "controlID": "C-0186",
        "description": "The Kubernetes API stores secrets, which may be service account tokens for the Kubernetes API or credentials used by workloads in the cluster. Access to these secrets should be restricted to the smallest possible group of users to reduce the risk of privilege escalation.",
        "long_description": "Inappropriate access to secrets stored within the Kubernetes cluster can allow for an attacker to gain additional access to the Kubernetes cluster or external resources whose credentials are stored as secrets.",
        "remediation": "Where possible, remove `get`, `list` and `watch` access to `secret` objects in the cluster.",
        "manual_test": "Review the users who have `get`, `list` or `watch` access to `secrets` objects in the Kubernetes API.",
        "test": "Check which subjects have RBAC permissions to get, list or watch Kubernetes secrets.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126661/recommendations/1838590"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-can-list-get-secrets-v1"
        ],
        "baseScore": 6,
        "impact_statement": "Care should be taken not to remove access to secrets to system components which require this for their operation",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "default_value": "By default in a kubeadm cluster the following list of principals have `get` privileges on `secret` objects ```CLUSTERROLEBINDING                                    SUBJECT                             TYPE            SA-NAMESPACEcluster-admin                                         system:masters                      Group           system:controller:clusterrole-aggregation-controller  clusterrole-aggregation-controller  ServiceAccount  kube-systemsystem:controller:expand-controller                   expand-controller                   ServiceAccount  kube-systemsystem:controller:generic-garbage-collector           generic-garbage-collector           ServiceAccount  kube-systemsystem:controller:namespace-controller                namespace-controller                ServiceAccount  kube-systemsystem:controller:persistent-volume-binder            persistent-volume-binder            ServiceAccount  kube-systemsystem:kube-controller-manager                        system:kube-controller-manager      User ```",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0241",
        "name": "Use Azure RBAC for Kubernetes Authorization.",
        "description": "The ability to manage RBAC for Kubernetes resources from Azure gives you the choice to manage RBAC for the cluster resources either using Azure or native Kubernetes mechanisms.",
        "long_description": "The ability to manage RBAC for Kubernetes resources from Azure gives you the choice to manage RBAC for the cluster resources either using Azure or native Kubernetes mechanisms. When enabled, Azure AD principals will be validated exclusively by Azure RBAC while regular Kubernetes users and service accounts are exclusively validated by Kubernetes RBAC. Azure role-based access control (RBAC) is an authorization system built on Azure Resource Manager that provides fine-grained access management of Azure resources.With Azure RBAC, you create a role definition that outlines the permissions to be applied. You then assign a user or group this role definition via a role assignment for a particular scope. The scope can be an individual resource, a resource group, or across the subscription.",
        "remediation": "Set Azure RBAC as access system.",
        "manual_test": "",
        "references": [
            "<https://docs.microsoft.com/en-us/azure/aks/manage-azure-rbac>"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-azure-rbac-is-set"
        ],
        "baseScore": 7,
        "impact_statement": "",
        "default_value": "",
        "scanningScope": {
            "matches": [
                "AKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0195",
        "name": "Minimize the admission of containers wishing to share the host IPC namespace",
        "description": "Do not generally permit containers to be run with the `hostIPC` flag set to true.",
        "long_description": "A container running in the host's IPC namespace can use IPC to interact with processes outside the container.\n\n There should be at least one admission control policy defined which does not permit containers to share the host IPC namespace.\n\n If you need to run containers which require hostIPC, this should be definited in a separate policy and you should carefully check to ensure that only limited service accounts and users are given permission to use that policy.",
        "remediation": "Add policies to each namespace in the cluster which has user workloads to restrict the admission of `hostIPC` containers.",
        "manual_test": "List the policies in use for each namespace in the cluster, ensure that each policy disallows the admission of `hostIPC` containers",
        "references": [
            "https://workbench.cisecurity.org/sections/1126662/recommendations/1838605"
        ],
        "attributes": {},
        "rulesNames": [
            "pod-security-admission-baseline-applied-1",
            "pod-security-admission-baseline-applied-2"
        ],
        "baseScore": 5,
        "impact_statement": "Pods defined with `spec.hostIPC: true` will not be permitted unless they are run under a specific policy.",
        "default_value": "By default, there are no restrictions on the creation of `hostIPC` containers.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Ensure memory requests are set",
        "attributes": {
            "controlTypeTags": [
                "compliance",
                "devops"
            ]
        },
        "description": "This control identifies all Pods for which the memory requests are not set.",
        "remediation": "Set the memory requests or use exception mechanism to avoid unnecessary notifications.",
        "rulesNames": [
            "resources-memory-requests"
        ],
        "controlID": "C-0269",
        "baseScore": 3.0,
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Resource management",
                "id": "Cat-7"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0183",
        "name": "Verify that the RotateKubeletServerCertificate argument is set to true",
        "description": "Enable kubelet server certificate rotation.",
        "long_description": "`RotateKubeletServerCertificate` causes the kubelet to both request a serving certificate after bootstrapping its client credentials and rotate the certificate as its existing credentials expire. This automated periodic rotation ensures that the there are no downtimes due to expired certificates and thus addressing availability in the CIA security triad.\n\n Note: This recommendation only applies if you let kubelets get their certificates from the API server. In case your kubelet certificates come from an outside authority/tool (e.g. Vault) then you need to take care of rotation yourself.",
        "remediation": "Edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the below parameter in `KUBELET_CERTIFICATE_ARGS` variable.\n\n \n```\n--feature-gates=RotateKubeletServerCertificate=true\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```",
        "manual_test": "Ignore this check if serverTLSBootstrap is true in the kubelet config file or if the --rotate-server-certificates parameter is set on kubelet\n\n Run the following command on each node:\n\n \n```\nps -ef | grep kubelet\n\n```\n Verify that `RotateKubeletServerCertificate` argument exists and is set to `true`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126668/recommendations/1838661"
        ],
        "attributes": {},
        "rulesNames": [
            "kubelet-rotate-kubelet-server-certificate"
        ],
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, kubelet server certificate rotation is enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0113",
        "name": "Ensure that the API Server --anonymous-auth argument is set to false",
        "description": "Disable anonymous requests to the API server.",
        "long_description": "When enabled, requests that are not rejected by other configured authentication methods are treated as anonymous requests. These requests are then served by the API server. You should rely on authentication to authorize access and disallow anonymous requests.\n\n If you are using RBAC authorization, it is generally considered reasonable to allow anonymous access to the API Server for health checks and discovery purposes, and hence this recommendation is not scored. However, you should consider whether anonymous discovery is an acceptable risk for your purposes.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the below parameter.\n\n \n```\n--anonymous-auth=false\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--anonymous-auth` argument is set to `false`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838609"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-anonymous-auth-argument-is-set-to-false"
        ],
        "baseScore": 8,
        "impact_statement": "Anonymous requests will be rejected.",
        "default_value": "By default, anonymous access is enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Ensure that Service Account Tokens are only mounted where necessary",
        "controlID": "C-0190",
        "description": "Service accounts tokens should not be mounted in pods except where the workload running in the pod explicitly needs to communicate with the API server",
        "long_description": "Mounting service account tokens inside pods can provide an avenue for privilege escalation attacks where an attacker is able to compromise a single pod in the cluster.\n\n Avoiding mounting these tokens removes this attack avenue.",
        "remediation": "Modify the definition of pods and service accounts which do not need to mount service account tokens to disable it.",
        "manual_test": "Review pod and service account objects in the cluster and ensure that the option below is set, unless the resource explicitly requires this access.\n\n \n```\nautomountServiceAccountToken: false\n\n```",
        "test": "Check that all service accounts and workloads disable automount of service account tokens.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126661/recommendations/1838595"
        ],
        "attributes": {},
        "rulesNames": [
            "automount-service-account"
        ],
        "baseScore": 5,
        "impact_statement": "Pods mounted without service account tokens will not be able to communicate with the API server, except where the resource is available to unauthenticated principals.",
        "default_value": "By default, all pods get a service account token mounted in them.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0220",
        "name": "Minimize the admission of containers with capabilities assigned",
        "description": "Do not generally permit containers with capabilities",
        "long_description": "Containers run with a default set of capabilities as assigned by the Container Runtime. Capabilities are parts of the rights generally granted on a Linux system to the root user.\n\n In many cases applications running in containers do not require any capabilities to operate, so from the perspective of the principal of least privilege use of capabilities should be minimized.",
        "remediation": "Review the use of capabilities in applications running on your cluster. Where a namespace contains applications which do not require any Linux capabilities to operate consider adding a PSP which forbids the admission of containers which do not drop all capabilities.",
        "manual_test": "Get the set of PSPs with the following command:\n\n \n```\nkubectl get psp\n\n```\n For each PSP, check whether capabilities have been forbidden:\n\n \n```\nkubectl get psp <name> -o=jsonpath='{.spec.requiredDropCapabilities}'\n\n```",
        "references": [
            "https://kubernetes.io/docs/concepts/policy/pod-security-policy/#enabling-pod-security-policies",
            "https://www.nccgroup.trust/uk/our-research/abusing-privileged-and-unprivileged-linux-containers/"
        ],
        "attributes": {},
        "rulesNames": [
            "psp-required-drop-capabilities"
        ],
        "baseScore": 5.0,
        "impact_statement": "Pods with containers require capabilities to operate will not be permitted.",
        "default_value": "By default, PodSecurityPolicies are not defined.",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Immutable container filesystem",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance",
                "smartRemediation"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Persistence"
                    ]
                }
            ]
        },
        "description": "Mutable container filesystem can be abused to inject malicious code or data into containers. Use immutable (read-only) filesystem to limit potential attacks.",
        "remediation": "Set the filesystem of the container to read-only when possible (pod securityContext, readOnlyRootFilesystem: true). If containers application needs to write into the filesystem, it is recommended to mount secondary filesystems for specific directories where application require write access.",
        "rulesNames": [
            "immutable-container-filesystem"
        ],
        "long_description": "By default, containers are permitted mostly unrestricted execution within their own context. An attacker who has access to a container, can create files and download scripts as he wishes, and modify the underlying application running on the container. ",
        "test": "Check whether the readOnlyRootFilesystem field in the SecurityContext is set to true. ",
        "controlID": "C-0017",
        "baseScore": 3.0,
        "example": "@controls/examples/c017.yaml",
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Node escape",
                "id": "Cat-9"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0144",
        "name": "Ensure that the Controller Manager --terminated-pod-gc-threshold argument is set as appropriate",
        "description": "Activate garbage collector on pod termination, as appropriate.",
        "long_description": "Garbage collection is important to ensure sufficient resource availability and avoiding degraded performance and availability. In the worst case, the system might crash or just be unusable for a long period of time. The current setting for garbage collection is 12,500 terminated pods which might be too high for your system to sustain. Based on your system resources and tests, choose an appropriate threshold value to activate garbage collection.",
        "remediation": "Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node and set the `--terminated-pod-gc-threshold` to an appropriate threshold, for example:\n\n \n```\n--terminated-pod-gc-threshold=10\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-controller-manager\n\n```\n Verify that the `--terminated-pod-gc-threshold` argument is set as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126669/recommendations/1838677"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-controller-manager-terminated-pod-gc-threshold-argument-is-set-as-appropriate"
        ],
        "baseScore": 4,
        "impact_statement": "None",
        "default_value": "By default, `--terminated-pod-gc-threshold` is set to `12500`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0275",
        "name": "Minimize the admission of containers wishing to share the host process ID namespace",
        "description": "Do not generally permit containers to be run with the hostPID flag set to true.",
        "long_description": "A container running in the host's PID namespace can inspect processes running outside the container. If the container also has access to ptrace capabilities this can be used to escalate privileges outside of the container.\n\n There should be at least one admission control policy defined which does not permit containers to share the host PID namespace.\n\n If you need to run containers which require hostPID, this should be defined in a separate policy and you should carefully check to ensure that only limited service accounts and users are given permission to use that policy.",
        "remediation": "Configure the Admission Controller to restrict the admission of `hostPID` containers.",
        "manual_test": "Fetch hostPID from each pod with\n\n \n```\nget pods -A -o=jsonpath=$'{range .items[*]}{@.metadata.name}: {@.spec.hostPID}\n{end}'\n```",
        "references": [
            "https://workbench.cisecurity.org/sections/2633390/recommendations/4261968"
        ],
        "attributes": {},
        "rulesNames": [
            "host-pid-privileges"
        ],
        "baseScore": 5,
        "impact_statement": "Pods defined with `spec.hostPID: true` will not be permitted unless they are run under a specific policy.",
        "default_value": "By default, there are no restrictions on the creation of `hostPID` containers.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0167",
        "name": "Ensure that the --kubeconfig kubelet.conf file ownership is set to root:root",
        "description": "Ensure that the `kubelet.conf` file ownership is set to `root:root`.",
        "long_description": "The `kubelet.conf` file is the kubeconfig file for the node, and controls various parameters that set the behavior and identity of the worker node. You should set its file ownership to maintain the integrity of the file. The file should be owned by `root:root`.",
        "remediation": "Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nchown root:root /etc/kubernetes/kubelet.conf\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nstat -c %U %G /etc/kubernetes/kubelet.conf\n\n```\n Verify that the ownership is set to `root:root`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126659/recommendations/1838613"
        ],
        "rulesNames": [
            "ensure-that-the-kubeconfig-kubelet.conf-file-ownership-is-set-to-root-root"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `kubelet.conf` file ownership is set to `root:root`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0244",
        "name": "Ensure Kubernetes Secrets are encrypted",
        "description": "Encryption at Rest is a common security requirement. In Azure, organizations can encrypt data at rest without the risk or cost of a custom key management solution. Organizations have the option of letting Azure completely manage Encryption at Rest. Additionally, organizations have various options to closely manage encryption or encryption keys.",
        "long_description": "",
        "remediation": "",
        "manual_test": "",
        "references": [
            "<https://docs.microsoft.com/security/benchmark/azure/security-controls-v2-data-protection#dp-5-encrypt-sensitive-data-at-rest>"
        ],
        "attributes": {},
        "rulesNames": [
            "secret-etcd-encryption-cloud"
        ],
        "baseScore": 6,
        "impact_statement": "",
        "default_value": "",
        "scanningScope": {
            "matches": [
                "AKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0217",
        "name": "Minimize the admission of containers with allowPrivilegeEscalation",
        "description": "Do not generally permit containers to be run with the `allowPrivilegeEscalation` flag set to true.",
        "long_description": "A container running with the `allowPrivilegeEscalation` flag set to `true` may have processes that can gain more privileges than their parent.\n\n There should be at least one PodSecurityPolicy (PSP) defined which does not permit containers to allow privilege escalation. The option exists (and is defaulted to true) to permit setuid binaries to run.\n\n If you have need to run containers which use setuid binaries or require privilege escalation, this should be defined in a separate PSP and you should carefully check RBAC controls to ensure that only limited service accounts and users are given permission to access that PSP.",
        "remediation": "Create a PSP as described in the Kubernetes documentation, ensuring that the `.spec.allowPrivilegeEscalation` field is omitted or set to false.",
        "manual_test": "Get the set of PSPs with the following command:\n\n \n```\nkubectl get psp\n\n```\n For each PSP, check whether privileged is enabled:\n\n \n```\nkubectl get psp <name> -o=jsonpath='{.spec.allowPrivilegeEscalation}'\n\n```\n Verify that there is at least one PSP which does not return true.",
        "references": [
            "https://kubernetes.io/docs/concepts/policy/pod-security-policy"
        ],
        "attributes": {},
        "rulesNames": [
            "psp-deny-allowprivilegeescalation"
        ],
        "baseScore": 6.0,
        "impact_statement": "Pods defined with `spec.allowPrivilegeEscalation: true` will not be permitted unless they are run under a specific PSP.",
        "default_value": "By default, PodSecurityPolicies are not defined.",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0168",
        "name": "Ensure that the certificate authorities file permissions are set to 600 or more restrictive",
        "description": "Ensure that the certificate authorities file has permissions of `600` or more restrictive.",
        "long_description": "The certificate authorities file controls the authorities used to validate API requests. You should restrict its file permissions to maintain the integrity of the file. The file should be writable by only the administrators on the system.",
        "remediation": "Run the following command to modify the file permissions of the `--client-ca-file`\n\n \n```\nchmod 600 <filename>\n\n```",
        "manual_test": "Run the following command:\n\n \n```\nps -ef | grep kubelet\n\n```\n Find the file specified by the `--client-ca-file` argument.\n\n Run the following command:\n\n \n```\nstat -c %a <filename>\n\n```\n Verify that the permissions are `644` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126659/recommendations/1838618"
        ],
        "rulesNames": [
            "ensure-that-the-certificate-authorities-file-permissions-are-set-to-600-or-more-restrictive"
        ],
        "attributes": {},
        "baseScore": 7,
        "impact_statement": "None",
        "default_value": "By default no `--client-ca-file` is specified.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Sudo in container entrypoint",
        "attributes": {
            "controlTypeTags": [
                "security"
            ]
        },
        "description": "Adding sudo to a container entry point command may escalate process privileges and allow access to forbidden resources. This control checks all the entry point commands in all containers in the pod to find those that have sudo command.",
        "remediation": "Remove sudo from the command line and use Kubernetes native root and capabilities controls to provide necessary privileges where they are required.",
        "rulesNames": [
            "sudo-in-container-entrypoint"
        ],
        "long_description": "Adding sudo to a container entry point command may escalate process privileges and allow access to forbidden resources. This control checks all the entry point commands in all containers in the pod to find those that have sudo command.",
        "test": "Check that there is no 'sudo' in the container entrypoint",
        "controlID": "C-0062",
        "baseScore": 5.0,
        "example": "@controls/examples/c062.yaml",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0157",
        "name": "Ensure that the --peer-client-cert-auth argument is set to true",
        "description": "etcd should be configured for peer authentication.",
        "long_description": "etcd is a highly-available key value store used by Kubernetes deployments for persistent storage of all of its REST API objects. These objects are sensitive in nature and should be accessible only by authenticated etcd peers in the etcd cluster.",
        "remediation": "Edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and set the below parameter. ```--peer-client-cert-auth=true```",
        "manual_test": "Run the following command on the etcd server node: ```ps -ef | grep etcd``` Verify that the `--peer-client-cert-auth` argument is set to `true`. **Note:** This recommendation is applicable only for etcd clusters. If you are using only one etcd server in your environment then this recommendation is not applicable.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126654/recommendations/1838572"
        ],
        "attributes": {},
        "rulesNames": [
            "etcd-peer-client-auth-cert"
        ],
        "baseScore": 7,
        "impact_statement": "All peers attempting to communicate with the etcd server will require a valid client certificate for authentication.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "default_value": "**Note:** This recommendation is applicable only for etcd clusters. If you are using only one etcd server in your environment then this recommendation is not applicable. By default, `--peer-client-cert-auth` argument is set to `false`.",
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Allow privilege escalation",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance",
                "smartRemediation"
            ]
        },
        "description": "Attackers may gain access to a container and uplift its privilege to enable excessive capabilities.",
        "remediation": "If your application does not need it, make sure the allowPrivilegeEscalation field of the securityContext is set to false.",
        "rulesNames": [
            "rule-allow-privilege-escalation"
        ],
        "test": " Check that the allowPrivilegeEscalation field in securityContext of container is set to false.   ",
        "controlID": "C-0016",
        "baseScore": 6.0,
        "example": "@controls/examples/allowprivilegeescalation.yaml",
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Node escape",
                "id": "Cat-9"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0154",
        "name": "Ensure that the --client-cert-auth argument is set to true",
        "description": "Enable client authentication on etcd service.",
        "long_description": "etcd is a highly-available key value store used by Kubernetes deployments for persistent storage of all of its REST API objects. These objects are sensitive in nature and should not be available to unauthenticated clients. You should enable the client authentication via valid certificates to secure the access to the etcd service.",
        "remediation": "Edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and set the below parameter.\n\n \n```\n--client-cert-auth=\"true\"\n\n```",
        "manual_test": "Run the following command on the etcd server node:\n\n \n```\nps -ef | grep etcd\n\n```\n Verify that the `--client-cert-auth` argument is set to `true`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126654/recommendations/1838565"
        ],
        "attributes": {},
        "rulesNames": [
            "etcd-client-auth-cert"
        ],
        "baseScore": 8,
        "impact_statement": "All clients attempting to access the etcd server will require a valid client certificate.",
        "default_value": "By default, the etcd service can be queried by unauthenticated clients.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Non-root containers",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Potential attackers may gain access to a container and leverage its existing privileges to conduct an attack. Therefore, it is not recommended to deploy containers with root privileges unless it is absolutely necessary. This control identifies all the pods running as root or can escalate to root.",
        "remediation": "If your application does not need root privileges, make sure to define runAsNonRoot as true or explicitly set the runAsUser using ID 1000 or higher under the PodSecurityContext or container securityContext. In addition, set an explicit value for runAsGroup using ID 1000 or higher.",
        "rulesNames": [
            "non-root-containers"
        ],
        "long_description": "Container engines allow containers to run applications as a non-root user with non-root group membership. Typically, this non-default setting is configured when the container image is built. Alternatively, Kubernetes can load containers into a Pod with SecurityContext:runAsUser specifying a non-zero user. While the runAsUser directive effectively forces non-root execution at deployment, NSA and CISA encourage developers to build container applications to execute as a non-root user. Having non-root execution integrated at build time provides better assurance that applications will function correctly without root privileges.",
        "test": "Verify that runAsUser is set to a user id greater than 0 or that runAsNonRoot is set to true, and that runAsGroup is set to an id greater than 0. Check all the combinations with PodSecurityContext and SecurityContext (for containers).",
        "controlID": "C-0013",
        "baseScore": 6.0,
        "example": "@controls/examples/c013.yaml",
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Node escape",
                "id": "Cat-9"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Pods in default namespace",
        "attributes": {
            "controlTypeTags": [
                "compliance",
                "devops"
            ]
        },
        "description": "It is recommended to avoid running pods in cluster without explicit namespace assignment. This control identifies all the pods running in the default namespace.",
        "remediation": "Create necessary namespaces and move all the pods from default namespace there.",
        "rulesNames": [
            "pods-in-default-namespace"
        ],
        "long_description": "It is recommended to avoid running pods in cluster without explicit namespace assignment. This may lead to wrong capabilities and permissions assignment and potential compromises. This control identifies all the pods running in the default namespace.",
        "test": "Check that there are no pods in the 'default' namespace",
        "controlID": "C-0061",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "baseScore": 3.0,
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0134",
        "name": "Ensure that the API Server --request-timeout argument is set as appropriate",
        "description": "Set global request timeout for API server requests as appropriate.",
        "long_description": "Setting global request timeout allows extending the API server request timeout limit to a duration appropriate to the user's connection speed. By default, it is set to 60 seconds which might be problematic on slower connections making cluster resources inaccessible once the data volume for requests exceeds what can be transmitted in 60 seconds. But, setting this timeout limit to be too large can exhaust the API server resources making it prone to Denial-of-Service attack. Hence, it is recommended to set this limit as appropriate and change the default limit of 60 seconds only if needed.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` and set the below parameter as appropriate and if needed. For example,\n\n \n```\n--request-timeout=300s\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--request-timeout` argument is either not set or set to an appropriate value.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838667"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-request-timeout-argument-is-set-as-appropriate"
        ],
        "baseScore": 4,
        "impact_statement": "None",
        "default_value": "By default, `--request-timeout` is set to 60 seconds.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0115",
        "name": "Ensure that the API Server --DenyServiceExternalIPs is not set",
        "description": "This admission controller rejects all net-new usage of the Service field externalIPs.",
        "long_description": "This admission controller rejects all net-new usage of the Service field externalIPs. This feature is very powerful (allows network traffic interception) and not well controlled by policy. When enabled, users of the cluster may not create new Services which use externalIPs and may not add new values to externalIPs on existing Service objects. Existing uses of externalIPs are not affected, and users may remove values from externalIPs on existing Service objects.\n\n Most users do not need this feature at all, and cluster admins should consider disabling it. Clusters that do need to use this feature should consider using some custom policy to manage usage of it.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and remove the `--DenyServiceExternalIPs'parameter\n\n or\n\n The Kubernetes API server flag disable-admission-plugins takes a comma-delimited list of admission control plugins to be disabled, even if they are in the list of plugins enabled by default.\n\n `kube-apiserver --disable-admission-plugins=DenyServiceExternalIPs,AlwaysDeny ...`",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--DenyServiceExternalIPs argument does not exist.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838614"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-DenyServiceExternalIPs-is-not-set"
        ],
        "baseScore": 4,
        "impact_statement": "When enabled, users of the cluster may not create new Services which use externalIPs and may not add new values to externalIPs on existing Service objects.",
        "default_value": "By default, `--token-auth-file` argument is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "External facing",
        "attributes": {
            "controlTypeTags": [
                "security"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Initial Access"
                    ]
                },
                {
                    "attackTrack": "service-destruction",
                    "categories": [
                        "Initial Access"
                    ]
                },
                {
                    "attackTrack": "external-workload-with-cluster-takeover-roles",
                    "categories": [
                        "Initial Access"
                    ]
                },
                {
                    "attackTrack": "external-database-without-authentication",
                    "categories": [
                        "Initial Access"
                    ]
                },
                {
                    "attackTrack": "workload-unauthenticated-service",
                    "categories": [
                        "Initial Access"
                    ]
                }
            ]
        },
        "description": "This control detect workloads that are exposed on Internet through a Service (NodePort or LoadBalancer) or Ingress. It fails in case it find workloads connected with these resources.",
        "remediation": "The user can evaluate its exposed resources and apply relevant changes wherever needed.",
        "rulesNames": [
            "exposure-to-internet"
        ],
        "test": "Checks if workloads are exposed through the use of NodePort, LoadBalancer or Ingress",
        "controlID": "C-0256",
        "baseScore": 7.0,
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "CoreDNS poisoning",
        "attributes": {
            "microsoftMitreColumns": [
                "Lateral Movement"
            ],
            "controlTypeTags": [
                "compliance"
            ]
        },
        "description": "If attackers have permissions to modify the coredns ConfigMap they can change the behavior of the cluster\u2019s DNS, poison it, and override the network identity of other services. This control identifies all subjects allowed to update the 'coredns' configmap.",
        "remediation": "You should follow the least privilege principle. Monitor and approve all the subjects allowed to modify the 'coredns' configmap. It is also recommended to remove this permission from the users/service accounts used in the daily operations.",
        "rulesNames": [
            "rule-can-update-configmap-v1"
        ],
        "long_description": "CoreDNS is a modular Domain Name System (DNS) server written in Go, hosted by Cloud Native Computing Foundation (CNCF). CoreDNS is the main DNS service that is being used in Kubernetes. The configuration of CoreDNS can be modified by a file named corefile. In Kubernetes, this file is stored in a ConfigMap object, located at the kube-system namespace. If attackers have permissions to modify the ConfigMap, for example by using the container\u2019s service account, they can change the behavior of the cluster\u2019s DNS, poison it, and take the network identity of other services.",
        "test": "Check who has update/patch RBAC permissions on \u2018coredns\u2019 configmaps, or to all configmaps.",
        "controlID": "C-0037",
        "baseScore": 4.0,
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0230",
        "name": "Ensure Network Policy is Enabled and set as appropriate",
        "description": "Amazon EKS provides two ways to implement network policy. You choose a network policy option when you create an EKS cluster. The policy option can't be changed after the cluster is created:\nCalico Network Policies, an open-source network and network security solution founded by Tigera.\nBoth implementations use Linux IPTables to enforce the specified policies. Policies are translated into sets of allowed and disallowed IP pairs. These pairs are then programmed as IPTable filter rules.",
        "long_description": "By default, all pod to pod traffic within a cluster is allowed. Network Policy creates a pod-level firewall that can be used to restrict traffic between sources. Pod traffic is restricted by having a Network Policy that selects it (through the use of labels). Once there is any Network Policy in a namespace selecting a particular pod, that pod will reject any connections that are not allowed by any Network Policy. Other pods in the namespace that are not selected by any Network Policy will continue to accept all traffic.\n\n Network Policies are managed via the Kubernetes Network Policy API and enforced by a network plugin, simply creating the resource without a compatible network plugin to implement it will have no effect.",
        "remediation": "",
        "manual_test": "",
        "references": [],
        "attributes": {},
        "rulesNames": [
            "ensure-network-policy-is-enabled-eks"
        ],
        "baseScore": 6.0,
        "impact_statement": "Network Policy requires the Network Policy add-on. This add-on is included automatically when a cluster with Network Policy is created, but for an existing cluster, needs to be added prior to enabling Network Policy.\n\n Enabling/Disabling Network Policy causes a rolling update of all cluster nodes, similar to performing a cluster upgrade. This operation is long-running and will block other operations on the cluster (including delete) until it has run to completion.\n\n Enabling Network Policy enforcement consumes additional resources in nodes. Specifically, it increases the memory footprint of the kube-system process by approximately 128MB, and requires approximately 300 millicores of CPU.",
        "default_value": "By default, Network Policy is disabled.",
        "scanningScope": {
            "matches": [
                "EKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0101",
        "name": "Ensure that the Container Network Interface file ownership is set to root:root",
        "description": "Ensure that the Container Network Interface files have ownership set to `root:root`.",
        "long_description": "Container Network Interface provides various networking options for overlay networking. You should consult their documentation and restrict their respective file permissions to maintain the integrity of those files. Those files should be owned by `root:root`.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root <path/to/cni/files>\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %U:%G <path/to/cni/files>\n\n```\n Verify that the ownership is set to `root:root`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838576"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-Container-Network-Interface-file-ownership-is-set-to-root-root"
        ],
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "NA",
        "category": {
            "name": "Network",
            "id": "Cat-4"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0132",
        "name": "Ensure that the API Server --audit-log-maxbackup argument is set to 10 or as appropriate",
        "description": "Retain 10 or an appropriate number of old log files.",
        "long_description": "Kubernetes automatically rotates the log files. Retaining old log files ensures that you would have sufficient log data available for carrying out any investigation or correlation. For example, if you have set file size of 100 MB and the number of old log files to keep as 10, you would approximate have 1 GB of log data that you could potentially use for your analysis.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--audit-log-maxbackup` parameter to 10 or to an appropriate value.\n\n \n```\n--audit-log-maxbackup=10\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--audit-log-maxbackup` argument is set to `10` or as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838665"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-audit-log-maxbackup-argument-is-set-to-10-or-as-appropriate"
        ],
        "baseScore": 4,
        "impact_statement": "None",
        "default_value": "By default, auditing is not enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0164",
        "name": "If proxy kubeconfig file exists ensure permissions are set to 600 or more restrictive",
        "description": "If `kube-proxy` is running, and if it is using a file-based kubeconfig file, ensure that the proxy kubeconfig file has permissions of `600` or more restrictive.",
        "long_description": "The `kube-proxy` kubeconfig file controls various parameters of the `kube-proxy` service in the worker node. You should restrict its file permissions to maintain the integrity of the file. The file should be writable by only the administrators on the system.\n\n It is possible to run `kube-proxy` with the kubeconfig parameters configured as a Kubernetes ConfigMap instead of a file. In this case, there is no proxy kubeconfig file.",
        "remediation": "Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nchmod 600 <proxy kubeconfig file>\n\n```",
        "manual_test": "Find the kubeconfig file being used by `kube-proxy` by running the following command:\n\n \n```\nps -ef | grep kube-proxy\n\n```\n If `kube-proxy` is running, get the kubeconfig file location from the `--kubeconfig` parameter.\n\n To perform the audit:\n\n Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nstat -c %a <path><filename>\n\n```\n Verify that a file is specified and it exists with permissions are `600` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126659/recommendations/1838598"
        ],
        "rulesNames": [
            "if-proxy-kubeconfig-file-exists-ensure-permissions-are-set-to-600-or-more-restrictive"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, proxy file has permissions of `640`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Instance Metadata API",
        "attributes": {
            "microsoftMitreColumns": [
                "Discovery"
            ],
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Attackers who gain access to a container, may query the metadata API service for getting information about the underlying node. This control checks if there is access from the nodes to cloud providers instance metadata services.",
        "remediation": "Disable metadata services for pods in cloud provider settings.",
        "rulesNames": [
            "instance-metadata-api-access"
        ],
        "long_description": "Cloud providers provide instance metadata service for retrieving information about the virtual machine, such as network configuration, disks, and SSH public keys. This service is accessible to the VMs via a non-routable IP address that can be accessed from within the VM only. Attackers who gain access to a container, may query the metadata API service for getting information about the underlying node. For example, in Azure, the following request would retrieve all the metadata information of an instance: http:///metadata/instance?api-version=2019-06-01\\n\\n",
        "test": "Check which nodes have access to instance metadata services. The check is for AWS, GCP and Azure.",
        "controlID": "C-0052",
        "baseScore": 7.0,
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cloud"
            ]
        },
        "rules": []
    },
    {
        "name": "Validate admission controller (validating)",
        "attributes": {
            "microsoftMitreColumns": [
                "Credential access"
            ],
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Attackers can use validating webhooks to intercept and discover all the resources in the cluster. This control lists all the validating webhook configurations that must be verified.",
        "remediation": "Ensure all the webhooks are necessary. Use exception mechanism to prevent repititive notifications.",
        "rulesNames": [
            "list-all-validating-webhooks"
        ],
        "controlID": "C-0036",
        "baseScore": 3.0,
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Access Kubernetes dashboard",
        "attributes": {
            "microsoftMitreColumns": [
                "Discovery",
                "Lateral Movement"
            ],
            "rbacQuery": "Access k8s Dashboard",
            "controlTypeTags": [
                "compliance"
            ]
        },
        "description": "Attackers who gain access to the dashboard service account or have its RBAC permissions can use its network access to retrieve information about resources in the cluster or change them. This control checks if a subject that is not dashboard service account is bound to dashboard role/clusterrole, or - if anyone that is not the dashboard pod is associated with dashboard service account.",
        "remediation": "Make sure that the \u201cKubernetes Dashboard\u201d service account is only bound to the Kubernetes dashboard following the least privilege principle.",
        "rulesNames": [
            "rule-access-dashboard-subject-v1",
            "rule-access-dashboard-wl-v1"
        ],
        "long_description": "The Kubernetes dashboard is a web-based UI that is used for monitoring and managing the Kubernetes cluster. The dashboard allows users to perform actions in the cluster using its service account (Kubernetes-dashboard) with the permissions that are determined by the binding or cluster-binding for this service account. Attackers who gain access to a container in the cluster, can use its network access to the dashboard pod. Consequently, attackers may retrieve information about the various resources in the cluster using the dashboard\u2019s identity.",
        "test": "Check who is associated with the dashboard service account or bound to dashboard role/clusterrole.",
        "controlID": "C-0014",
        "baseScore": 2.0,
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0174",
        "name": "Ensure that the --client-ca-file argument is set as appropriate",
        "description": "Enable Kubelet authentication using certificates.",
        "long_description": "The connections from the apiserver to the kubelet are used for fetching logs for pods, attaching (through kubectl) to running pods, and using the kubelet\u2019s port-forwarding functionality. These connections terminate at the kubelet\u2019s HTTPS endpoint. By default, the apiserver does not verify the kubelet\u2019s serving certificate, which makes the connection subject to man-in-the-middle attacks, and unsafe to run over untrusted and/or public networks. Enabling Kubelet certificate authentication ensures that the apiserver could authenticate the Kubelet before submitting any requests.",
        "remediation": "If using a Kubelet config file, edit the file to set `authentication: x509: clientCAFile` to the location of the client CA file.\n\n If using command line arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the below parameter in `KUBELET_AUTHZ_ARGS` variable.\n\n \n```\n--client-ca-file=<path/to/client-ca-file>\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```",
        "manual_test": "Run the following command on each node:\n\n \n```\nps -ef | grep kubelet\n\n```\n Verify that the `--client-ca-file` argument exists and is set to the location of the client certificate authority file.\n\n If the `--client-ca-file` argument is not present, check that there is a Kubelet config file specified by `--config`, and that the file sets `authentication: x509: clientCAFile` to the location of the client certificate authority file.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126668/recommendations/1838643"
        ],
        "attributes": {},
        "rulesNames": [
            "enforce-kubelet-client-tls-authentication-updated"
        ],
        "baseScore": 6,
        "impact_statement": "You require TLS to be configured on apiserver as well as kubelets.",
        "default_value": "By default, `--client-ca-file` argument is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Ensure that the cluster-admin role is only used where required",
        "controlID": "C-0185",
        "description": "The RBAC role `cluster-admin` provides wide-ranging powers over the environment and should be used only where and when needed.",
        "long_description": "Kubernetes provides a set of default roles where RBAC is used. Some of these roles such as `cluster-admin` provide wide-ranging privileges which should only be applied where absolutely necessary. Roles such as `cluster-admin` allow super-user access to perform any action on any resource. When used in a `ClusterRoleBinding`, it gives full control over every resource in the cluster and in all namespaces. When used in a `RoleBinding`, it gives full control over every resource in the rolebinding's namespace, including the namespace itself.",
        "remediation": "Identify all clusterrolebindings to the cluster-admin role. Check if they are used and if they need this role or if they could use a role with fewer privileges.\n\n Where possible, first bind users to a lower privileged role and then remove the clusterrolebinding to the cluster-admin role :\n\n \n```\nkubectl delete clusterrolebinding [name]\n\n```",
        "manual_test": "Obtain a list of the principals who have access to the `cluster-admin` role by reviewing the `clusterrolebinding` output for each role binding that has access to the `cluster-admin` role.\n\n \n```\nkubectl get clusterrolebindings -o=custom-columns=NAME:.metadata.name,ROLE:.roleRef.name,SUBJECT:.subjects[*].name\n\n```\n Review each principal listed and ensure that `cluster-admin` privilege is required for it.",
        "test": "Check which subjects have are bound to the cluster-admin role with a clusterrolebinding.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126661/recommendations/1838588"
        ],
        "attributes": {},
        "rulesNames": [
            "cluster-admin-role"
        ],
        "baseScore": 8,
        "impact_statement": "Care should be taken before removing any `clusterrolebindings` from the environment to ensure they were not required for operation of the cluster. Specifically, modifications should not be made to `clusterrolebindings` with the `system:` prefix as they are required for the operation of system components.",
        "default_value": "By default a single `clusterrolebinding` called `cluster-admin` is provided with the `system:masters` group as its principal.",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0162",
        "name": "Ensure that the kubelet service file permissions are set to 600 or more restrictive",
        "description": "Ensure that the `kubelet` service file has permissions of `600` or more restrictive.",
        "long_description": "The `kubelet` service file controls various parameters that set the behavior of the `kubelet` service in the worker node. You should restrict its file permissions to maintain the integrity of the file. The file should be writable by only the administrators on the system.",
        "remediation": "Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nchmod 600 /etc/systemd/system/kubelet.service.d/kubeadm.conf\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nstat -c %a /etc/systemd/system/kubelet.service.d/10-kubeadm.conf\n\n```\n Verify that the permissions are `600` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126659/recommendations/1838585"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-kubelet-service-file-permissions-are-set-to-600-or-more-restrictive"
        ],
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, the `kubelet` service file has permissions of `640`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Secret/etcd encryption enabled",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "All Kubernetes Secrets are stored primarily in etcd therefore it is important to encrypt it.",
        "remediation": "Turn on the etcd encryption in your cluster, for more see the vendor documentation.",
        "rulesNames": [
            "secret-etcd-encryption-cloud",
            "etcd-encryption-native"
        ],
        "long_description": "etcd is a consistent and highly-available key value store used as Kubernetes' backing store for all cluster data. All object data in Kubernetes, like secrets, are stored there. This is the reason why it is important to protect the contents of etcd and use its data encryption feature.",
        "test": "Reading the cluster description from the managed cloud API (EKS, GKE), or the API server pod configuration for native K8s and checking if etcd encryption is enabled",
        "controlID": "C-0066",
        "baseScore": 6.0,
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "K8s common labels usage",
        "attributes": {
            "actionRequired": "configuration",
            "controlTypeTags": [
                "devops"
            ]
        },
        "description": "Kubernetes common labels help manage and monitor Kubernetes cluster using different tools such as kubectl, dashboard and others in an interoperable way. Refer to https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels/ for more information. This control helps you find objects that don't have any of these labels defined.",
        "remediation": "Define applicable labels or use the exception mechanism to prevent further notifications.",
        "rulesNames": [
            "k8s-common-labels-usage"
        ],
        "long_description": "Kubernetes common labels help manage and monitor Kubernetes cluster using different tools such as kubectl, dashboard and others in an interoperable way. Refer to https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels/ for more information. This control helps you find objects that don't have any of these labels defined.",
        "test": "Test will check if the list of label that start with app.kubernetes.io/ are defined.",
        "controlID": "C-0077",
        "baseScore": 2.0,
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Outdated Kubernetes version",
        "attributes": {},
        "description": "Identifies Kubernetes clusters running on outdated versions. Using old versions can expose clusters to known vulnerabilities, compatibility issues, and miss out on improved features and security patches. Keeping Kubernetes up-to-date is crucial for maintaining security and operational efficiency.",
        "remediation": "Regularly update Kubernetes clusters to the latest stable version to mitigate known vulnerabilities and enhance functionality. Plan and execute upgrades considering workload compatibility, testing in a staging environment before applying changes to production. Follow Kubernetes' best practices for version management and upgrades to ensure a smooth transition and minimal downtime.",
        "rulesNames": [
            "outdated-k8s-version"
        ],
        "long_description": "Running an outdated version of Kubernetes poses significant security risks and operational challenges. Older versions may contain unpatched vulnerabilities, leading to potential security breaches and unauthorized access. Additionally, outdated clusters might not support newer, more secure, and efficient features, impacting both performance and security. Regularly updating Kubernetes ensures compliance with the latest security standards and access to enhanced functionalities.",
        "test": "Verifies the current Kubernetes version against the latest stable releases.",
        "controlID": "C-0273",
        "baseScore": 2.0,
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Network mapping",
        "attributes": {
            "microsoftMitreColumns": [
                "Discovery"
            ],
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "If no network policy is defined, attackers who gain access to a single container may use it to probe the network. This control lists all namespaces in which no network policies are defined.",
        "remediation": "Define network policies or use similar network protection mechanisms.",
        "rulesNames": [
            "internal-networking"
        ],
        "long_description": "Attackers may try to map the cluster network to get information on the running applications, including scanning for known vulnerabilities. By default, there is no restriction on pods communication in Kubernetes. Therefore, attackers who gain access to a single container, may use it to probe the network.",
        "test": "Check for each namespace if there is a network policy defined.",
        "controlID": "C-0049",
        "baseScore": 3.0,
        "example": "@controls/examples/c049.yaml",
        "category": {
            "name": "Network",
            "id": "Cat-4"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Delete Kubernetes events",
        "attributes": {
            "microsoftMitreColumns": [
                "Defense evasion"
            ],
            "rbacQuery": "Show who can delete k8s events",
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Attackers may delete Kubernetes events to avoid detection of their activity in the cluster. This control identifies all the subjects that can delete Kubernetes events.",
        "remediation": "You should follow the least privilege principle. Minimize the number of subjects who can delete Kubernetes events. Avoid using these subjects in the daily operations.",
        "rulesNames": [
            "rule-can-delete-k8s-events-v1"
        ],
        "long_description": "A Kubernetes event is a Kubernetes object that logs state changes and failures of the resources in the cluster. Example events are a container creation, an image pull, or a pod scheduling on a node. Kubernetes events can be very useful for identifying changes that occur in the cluster. Therefore, attackers may want to delete these events (e.g., by using: \u201ckubectl delete events\u2013all\u201d) in an attempt to avoid detection of their activity in the cluster.",
        "test": "List who has delete/deletecollection RBAC permissions on events.",
        "controlID": "C-0031",
        "baseScore": 4.0,
        "example": "@controls/examples/c031.yaml",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Minimize access to webhook configuration objects",
        "controlID": "C-0281",
        "description": "Users with rights to create/modify/delete validatingwebhookconfigurations or mutatingwebhookconfigurations can control webhooks that can read any object admitted to the cluster, and in the case of mutating webhooks, also mutate admitted objects. This could allow for privilege escalation or disruption of the operation of the cluster.",
        "long_description": "Users with rights to create/modify/delete validatingwebhookconfigurations or mutatingwebhookconfigurations can control webhooks that can read any object admitted to the cluster, and in the case of mutating webhooks, also mutate admitted objects. This could allow for privilege escalation or disruption of the operation of the cluster.",
        "remediation": "Where possible, remove access to the validatingwebhookconfigurations or mutatingwebhookconfigurations objects",
        "manual_test": "Review the users who have access to validatingwebhookconfigurations or mutatingwebhookconfigurations objects in the Kubernetes API.",
        "test": "Check which subjects have RBAC permissions to create/modify/delete validatingwebhookconfigurations or mutatingwebhookconfigurations objects.",
        "references": [
            "https://workbench.cisecurity.org/sections/2633388/recommendations/4261963"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-can-modify-admission-webhooks"
        ],
        "baseScore": 5,
        "impact_statement": "Users with rights to create/modify/delete validatingwebhookconfigurations or mutatingwebhookconfigurations can control webhooks that can read any object admitted to the cluster, and in the case of mutating webhooks, also mutate admitted objects. This could allow for privilege escalation or disruption of the operation of the cluster.",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "default_value": "By default in a kubeadm cluster the following list of principals have `create/modify/delete` privileges on `validatingwebhookconfigurations/mutatingwebhookconfigurations` objects ```CLUSTERROLEBINDING                                    SUBJECT                             TYPE            SA-NAMESPACEcluster-admin                                         system:masters                      Group           system:controller:clusterrole-aggregation-controller  clusterrole-aggregation-controller  ServiceAccount  kube-systemsystem:controller:daemon-set-controller               daemon-set-controller               ServiceAccount  kube-systemsystem:controller:job-controller                      job-controller                      ServiceAccount  kube-systemsystem:controller:persistent-volume-binder            persistent-volume-binder            ServiceAccount  kube-systemsystem:controller:replicaset-controller               replicaset-controller               ServiceAccount  kube-systemsystem:controller:replication-controller              replication-controller              ServiceAccount  kube-systemsystem:controller:statefulset-controller              statefulset-controller              ServiceAccount  kube-system```",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "CVE-2022-0185-linux-kernel-container-escape",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "CVE-2022-0185 is a kernel vulnerability enabling privilege escalation and it can lead attackers to escape containers and take control over nodes. This control alerts on vulnerable kernel versions of Kubernetes nodes",
        "remediation": "Patch Linux kernel version to 5.16.2 or above",
        "rulesNames": [
            "CVE-2022-0185"
        ],
        "long_description": "Linux maintainers disclosed a broadly available Linux kernel vulnerability (CVE-2022-0185) which enables attackers to escape containers and get full control over the node. In order to be able to exploit this vulnerability, the attacker needs to be able to run code on in the container and the container must have CAP_SYS_ADMIN privileges. Linux kernel and all major distro maintainers have released patches. This control alerts on vulnerable kernel versions of Kubernetes nodes.",
        "test": "Checking Linux kernel version of the Node objects, if it is above 5.1 or below 5.16.2 it fires an alert",
        "controlID": "C-0079",
        "baseScore": 4.0,
        "example": "",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0107",
        "name": "Ensure that the scheduler.conf file ownership is set to root:root",
        "description": "Ensure that the `scheduler.conf` file ownership is set to `root:root`.",
        "long_description": "The `scheduler.conf` file is the kubeconfig file for the Scheduler. You should set its file ownership to maintain the integrity of the file. The file should be owned by `root:root`.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/scheduler.conf\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %U:%G /etc/kubernetes/scheduler.conf\n\n```\n Verify that the ownership is set to `root:root`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838587"
        ],
        "rulesNames": [
            "ensure-that-the-scheduler.conf-file-ownership-is-set-to-root-root"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `scheduler.conf` file ownership is set to `root:root`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "RBAC enabled",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "RBAC is the most advanced and well accepted mode of authorizing users of the Kubernetes API",
        "remediation": "Enable RBAC either in the API server configuration or with the Kubernetes provider API",
        "rulesNames": [
            "rbac-enabled-cloud",
            "rbac-enabled-native"
        ],
        "long_description": "RBAC is the most advanced and well accepted mode of authorizing users of the Kubernetes API",
        "test": "Testing API server or managed Kubernetes vendor API to determine if RBAC is enabled",
        "controlID": "C-0088",
        "baseScore": 7.0,
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0097",
        "name": "Ensure that the scheduler pod specification file ownership is set to root:root",
        "description": "Ensure that the scheduler pod specification file ownership is set to `root:root`.",
        "long_description": "The scheduler pod specification file controls various parameters that set the behavior of the `kube-scheduler` service in the master node. You should set its file ownership to maintain the integrity of the file. The file should be owned by `root:root`.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/manifests/kube-scheduler.yaml\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %U:%G /etc/kubernetes/manifests/kube-scheduler.yaml\n\n```\n Verify that the ownership is set to `root:root`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838570"
        ],
        "rulesNames": [
            "ensure-that-the-scheduler-pod-specification-file-ownership-is-set-to-root-root"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `kube-scheduler.yaml` file ownership is set to `root:root`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0136",
        "name": "Ensure that the API Server --service-account-key-file argument is set as appropriate",
        "description": "Explicitly set a service account public key file for service accounts on the apiserver.",
        "long_description": "By default, if no `--service-account-key-file` is specified to the apiserver, it uses the private key from the TLS serving certificate to verify service account tokens. To ensure that the keys for service account tokens could be rotated as needed, a separate public/private key pair should be used for signing service account tokens. Hence, the public key should be specified to the apiserver with `--service-account-key-file`.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--service-account-key-file` parameter to the public key file for service accounts:\n\n \n```\n--service-account-key-file=<filename>\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--service-account-key-file` argument exists and is set as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838669"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-service-account-key-file-argument-is-set-as-appropriate"
        ],
        "baseScore": 5,
        "impact_statement": "The corresponding private key must be provided to the controller manager. You would need to securely maintain the key file and rotate the keys based on your organization's key rotation policy.",
        "default_value": "By default, `--service-account-key-file` argument is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0135",
        "name": "Ensure that the API Server --service-account-lookup argument is set to true",
        "description": "Validate service account before validating token.",
        "long_description": "If `--service-account-lookup` is not enabled, the apiserver only verifies that the authentication token is valid, and does not validate that the service account token mentioned in the request is actually present in etcd. This allows using a service account token even after the corresponding service account is deleted. This is an example of time of check to time of use security issue.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the below parameter.\n\n \n```\n--service-account-lookup=true\n\n```\n Alternatively, you can delete the `--service-account-lookup` parameter from this file so that the default takes effect.",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that if the `--service-account-lookup` argument exists it is set to `true`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838668"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-service-account-lookup-argument-is-set-to-true"
        ],
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `--service-account-lookup` argument is set to `true`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Ingress and Egress blocked",
        "attributes": {
            "controlTypeTags": [
                "compliance"
            ]
        },
        "description": "Disable Ingress and Egress traffic on all pods wherever possible. It is recommended to define restrictive network policy on all new pods, and then enable sources/destinations that this pod must communicate with.",
        "remediation": "Define a network policy that restricts ingress and egress connections.",
        "rulesNames": [
            "ingress-and-egress-blocked"
        ],
        "long_description": "Network policies control traffic flow between Pods, namespaces, and external IP addresses. By default, no network policies are applied to Pods or namespaces, resulting in unrestricted ingress and egress traffic within the Pod network. Pods become isolated through a network policy that applies to the Pod or the Pod\u2019s namespace. Once a Pod is selected in a network policy, it rejects any connections that are not specifically allowed by any applicable policy object.Administrators should use a default policy selecting all Pods to deny all ingress and egress traffic and ensure any unselected Pods are isolated. Additional policies could then relax these restrictions for permissible connections.",
        "test": "Check for each Pod whether there is an ingress and egress policy defined (whether using Pod or Namespace). ",
        "controlID": "C-0030",
        "baseScore": 6.0,
        "example": "@controls/examples/c030.yaml",
        "category": {
            "name": "Network",
            "id": "Cat-4"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0234",
        "name": "Consider external secret storage",
        "description": "Consider the use of an external secrets storage and management system, instead of using Kubernetes Secrets directly, if you have more complex secret management needs. Ensure the solution requires authentication to access secrets, has auditing of access to and use of secrets, and encrypts secrets. Some solutions also make it easier to rotate secrets.",
        "long_description": "Kubernetes supports secrets as first-class objects, but care needs to be taken to ensure that access to secrets is carefully limited. Using an external secrets provider can ease the management of access to secrets, especially where secrests are used across both Kubernetes and non-Kubernetes environments.",
        "remediation": "Refer to the secrets management options offered by your cloud provider or a third-party secrets management solution.",
        "manual_test": "Review your secrets management implementation.",
        "references": [],
        "attributes": {},
        "rulesNames": [
            "ensure-external-secrets-storage-is-in-use"
        ],
        "baseScore": 6.0,
        "impact_statement": "None",
        "default_value": "By default, no external secret management is configured.",
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0228",
        "name": "Ensure clusters are created with Private Endpoint Enabled and Public Access Disabled",
        "description": "Disable access to the Kubernetes API from outside the node network if it is not required.",
        "long_description": "In a private cluster, the master node has two endpoints, a private and public endpoint. The private endpoint is the internal IP address of the master, behind an internal load balancer in the master's VPC network. Nodes communicate with the master using the private endpoint. The public endpoint enables the Kubernetes API to be accessed from outside the master's VPC network.\n\n Although Kubernetes API requires an authorized token to perform sensitive actions, a vulnerability could potentially expose the Kubernetes publically with unrestricted access. Additionally, an attacker may be able to identify the current cluster and Kubernetes API version and determine whether it is vulnerable to an attack. Unless required, disabling public endpoint will help prevent such threats, and require the attacker to be on the master's VPC network to perform any attack on the Kubernetes API.",
        "remediation": "By enabling private endpoint access to the Kubernetes API server, all communication between your nodes and the API server stays within your VPC.\n\n With this in mind, you can update your cluster accordingly using the AWS CLI to ensure that Private Endpoint Access is enabled.\n\n For example, the following command would enable private access to the Kubernetes API and ensure that no public access is permitted:\n\n `aws eks update-cluster-config --region $AWS_REGION --name $CLUSTER_NAME --resources-vpc-config endpointPrivateAccess=true, endpointPublicAccess=false`\n\n Note: For more detailed information, see the EKS Cluster Endpoint documentation link in the references section.",
        "manual_test": "Check for private endpoint access to the Kubernetes API server",
        "references": [
            "https://docs.aws.amazon.com/eks/latest/userguide/cluster-endpoint.html"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-endpointprivateaccess-is-enabled-and-endpointpublicaccess-is-disabled-eks"
        ],
        "baseScore": 8.0,
        "impact_statement": "Configure the EKS cluster endpoint to be private.\n\n 1. Leave the cluster endpoint public and specify which CIDR blocks can communicate with the cluster endpoint. The blocks are effectively a whitelisted set of public IP addresses that are allowed to access the cluster endpoint.\n2. Configure public access with a set of whitelisted CIDR blocks and set private endpoint access to enabled. This will allow public access from a specific range of public IPs while forcing all network traffic between the kubelets (workers) and the Kubernetes API through the cross-account ENIs that get provisioned into the cluster VPC when the control plane is provisioned.",
        "default_value": "By default, the Public Endpoint is disabled.",
        "scanningScope": {
            "matches": [
                "EKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0156",
        "name": "Ensure that the --peer-cert-file and --peer-key-file arguments are set as appropriate",
        "description": "etcd should be configured to make use of TLS encryption for peer connections.",
        "long_description": "etcd is a highly-available key value store used by Kubernetes deployments for persistent storage of all of its REST API objects. These objects are sensitive in nature and should be encrypted in transit and also amongst peers in the etcd clusters.",
        "remediation": "Follow the etcd service documentation and configure peer TLS encryption as appropriate for your etcd cluster.\n\n Then, edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and set the below parameters.\n\n \n```\n--peer-client-file=</path/to/peer-cert-file>\n--peer-key-file=</path/to/peer-key-file>\n\n```",
        "manual_test": "Run the following command on the etcd server node:\n\n \n```\nps -ef | grep etcd\n\n```\n Verify that the `--peer-cert-file` and `--peer-key-file` arguments are set as appropriate.\n\n **Note:** This recommendation is applicable only for etcd clusters. If you are using only one etcd server in your environment then this recommendation is not applicable.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126654/recommendations/1838569"
        ],
        "attributes": {},
        "rulesNames": [
            "etcd-peer-tls-enabled"
        ],
        "baseScore": 7,
        "impact_statement": "etcd cluster peers would need to set up TLS for their communication.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "default_value": "**Note:** This recommendation is applicable only for etcd clusters. If you are using only one etcd server in your environment then this recommendation is not applicable. By default, peer communication over TLS is not configured.",
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0127",
        "name": "Ensure that the admission control plugin NodeRestriction is set",
        "description": "Limit the `Node` and `Pod` objects that a kubelet could modify.",
        "long_description": "Using the `NodeRestriction` plug-in ensures that the kubelet is restricted to the `Node` and `Pod` objects that it could modify as defined. Such kubelets will only be allowed to modify their own `Node` API object, and only modify `Pod` API objects that are bound to their node.",
        "remediation": "Follow the Kubernetes documentation and configure `NodeRestriction` plug-in on kubelets. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and set the `--enable-admission-plugins` parameter to a value that includes `NodeRestriction`.\n\n \n```\n--enable-admission-plugins=...,NodeRestriction,...\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--enable-admission-plugins` argument is set to a value that includes `NodeRestriction`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838655"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-admission-control-plugin-NodeRestriction-is-set"
        ],
        "baseScore": 4,
        "impact_statement": "None",
        "default_value": "By default, `NodeRestriction` is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0277",
        "name": "Ensure that the API Server only makes use of Strong Cryptographic Ciphers",
        "description": "Ensure that the API server is configured to only use strong cryptographic ciphers.",
        "long_description": "TLS ciphers have had a number of known vulnerabilities and weaknesses, which can reduce the protection provided by them. By default Kubernetes supports a number of TLS ciphersuites including some that have security concerns, weakening the protection provided.",
        "remediation": "Edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml on the Control Plane node and set the below parameter.\n\n \n```\n--tls-cipher-suites=TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256, TLS_ECDHE_ECDSA_WITH_RC4_128_SHA, TLS_ECDHE_RSA_WITH_3DES_EDE_CBC_SHA, TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256, TLS_ECDHE_RSA_WITH_RC4_128_SHA, TLS_RSA_WITH_3DES_EDE_CBC_SHA, TLS_RSA_WITH_AES_128_CBC_SHA, TLS_RSA_WITH_AES_128_CBC_SHA256, TLS_RSA_WITH_AES_128_GCM_SHA256, TLS_RSA_WITH_AES_256_CBC_SHA, TLS_RSA_WITH_AES_256_GCM_SHA384, TLS_RSA_WITH_RC4_128_SHA.\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--tls-cipher-suites` argument is set as outlined in the remediation procedure below.",
        "references": [
            "https://workbench.cisecurity.org/sections/2633389/recommendations/4262031"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-API-Server-only-makes-use-of-Strong-Cryptographic-Ciphers-cis1-10"
        ],
        "baseScore": 5,
        "impact_statement": "API server clients that cannot support modern cryptographic ciphers will not be able to make connections to the API server.",
        "default_value": "By default the Kubernetes API server supports a wide range of TLS ciphers",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0146",
        "name": "Ensure that the Controller Manager --use-service-account-credentials argument is set to true",
        "description": "Use individual service account credentials for each controller.",
        "long_description": "The controller manager creates a service account per controller in the `kube-system` namespace, generates a credential for it, and builds a dedicated API client with that service account credential for each controller loop to use. Setting the `--use-service-account-credentials` to `true` runs each control loop within the controller manager using a separate service account credential. When used in combination with RBAC, this ensures that the control loops run with the minimum permissions required to perform their intended tasks.",
        "remediation": "Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node to set the below parameter.\n\n \n```\n--use-service-account-credentials=true\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-controller-manager\n\n```\n Verify that the `--use-service-account-credentials` argument is set to `true`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126669/recommendations/1838679"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-controller-manager-use-service-account-credentials-argument-is-set-to-true"
        ],
        "baseScore": 4,
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "impact_statement": "Whatever authorizer is configured for the cluster, it must grant sufficient permissions to the service accounts to perform their intended tasks. When using the RBAC authorizer, those roles are created and bound to the appropriate service accounts in the `kube-system` namespace automatically with default roles and rolebindings that are auto-reconciled on startup. If using other authorization methods (ABAC, Webhook, etc), the cluster deployer is responsible for granting appropriate permissions to the service accounts (the required permissions can be seen by inspecting the `controller-roles.yaml` and `controller-role-bindings.yaml` files for the RBAC roles.",
        "default_value": "By default, `--use-service-account-credentials` is set to false.",
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0176",
        "name": "Ensure that the --streaming-connection-idle-timeout argument is not set to 0",
        "description": "Do not disable timeouts on streaming connections.",
        "long_description": "Setting idle timeouts ensures that you are protected against Denial-of-Service attacks, inactive connections and running out of ephemeral ports.\n\n **Note:** By default, `--streaming-connection-idle-timeout` is set to 4 hours which might be too high for your environment. Setting this as appropriate would additionally ensure that such streaming connections are timed out after serving legitimate use cases.",
        "remediation": "If using a Kubelet config file, edit the file to set `streamingConnectionIdleTimeout` to a value other than 0.\n\n If using command line arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the below parameter in `KUBELET_SYSTEM_PODS_ARGS` variable.\n\n \n```\n--streaming-connection-idle-timeout=5m\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```",
        "manual_test": "Run the following command on each node:\n\n \n```\nps -ef | grep kubelet\n\n```\n Verify that the `--streaming-connection-idle-timeout` argument is not set to `0`.\n\n If the argument is not present, and there is a Kubelet config file specified by `--config`, check that it does not set `streamingConnectionIdleTimeout` to 0.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126668/recommendations/1838646"
        ],
        "attributes": {},
        "rulesNames": [
            "kubelet-streaming-connection-idle-timeout"
        ],
        "baseScore": 3,
        "impact_statement": "Long-lived connections could be interrupted.",
        "default_value": "By default, `--streaming-connection-idle-timeout` is set to 4 hours.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0122",
        "name": "Ensure that the admission control plugin AlwaysAdmit is not set",
        "description": "Do not allow all requests.",
        "long_description": "Setting admission control plugin `AlwaysAdmit` allows all requests and do not filter any requests.\n\n The `AlwaysAdmit` admission controller was deprecated in Kubernetes v1.13. Its behavior was equivalent to turning off all admission controllers.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and either remove the `--enable-admission-plugins` parameter, or set it to a value that does not include `AlwaysAdmit`.",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that if the `--enable-admission-plugins` argument is set, its value does not include `AlwaysAdmit`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838647"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-admission-control-plugin-AlwaysAdmit-is-not-set"
        ],
        "baseScore": 8,
        "impact_statement": "Only requests explicitly allowed by the admissions control plugins would be served.",
        "default_value": "`AlwaysAdmit` is not in the list of default admission plugins.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0196",
        "name": "Minimize the admission of containers wishing to share the host network namespace",
        "description": "Do not generally permit containers to be run with the `hostNetwork` flag set to true.",
        "long_description": "A container running in the host's network namespace could access the local loopback device, and could access network traffic to and from other pods.\n\n There should be at least one admission control policy defined which does not permit containers to share the host network namespace.\n\n If you need to run containers which require access to the host's network namesapces, this should be defined in a separate policy and you should carefully check to ensure that only limited service accounts and users are given permission to use that policy.",
        "remediation": "Add policies to each namespace in the cluster which has user workloads to restrict the admission of `hostNetwork` containers.",
        "manual_test": "List the policies in use for each namespace in the cluster, ensure that each policy disallows the admission of `hostNetwork` containers",
        "references": [
            "https://workbench.cisecurity.org/sections/1126662/recommendations/1838610"
        ],
        "attributes": {},
        "rulesNames": [
            "pod-security-admission-baseline-applied-1",
            "pod-security-admission-baseline-applied-2"
        ],
        "baseScore": 5,
        "impact_statement": "Pods defined with `spec.hostNetwork: true` will not be permitted unless they are run under a specific policy.",
        "default_value": "By default, there are no restrictions on the creation of `hostNetwork` containers.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0117",
        "name": "Ensure that the API Server --kubelet-certificate-authority argument is set as appropriate",
        "description": "Verify kubelet's certificate before establishing connection.",
        "long_description": "The connections from the apiserver to the kubelet are used for fetching logs for pods, attaching (through kubectl) to running pods, and using the kubelet\u2019s port-forwarding functionality. These connections terminate at the kubelet\u2019s HTTPS endpoint. By default, the apiserver does not verify the kubelet\u2019s serving certificate, which makes the connection subject to man-in-the-middle attacks, and unsafe to run over untrusted and/or public networks.",
        "remediation": "Follow the Kubernetes documentation and setup the TLS connection between the apiserver and kubelets. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--kubelet-certificate-authority` parameter to the path to the cert file for the certificate authority.\n\n \n```\n--kubelet-certificate-authority=<ca-string>\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--kubelet-certificate-authority` argument exists and is set as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838634"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-kubelet-certificate-authority-argument-is-set-as-appropriate"
        ],
        "baseScore": 8,
        "impact_statement": "You require TLS to be configured on apiserver as well as kubelets.",
        "default_value": "By default, `--kubelet-certificate-authority` argument is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0213",
        "name": "Minimize the admission of privileged containers",
        "description": "Do not generally permit containers to be run with the `securityContext.privileged` flag set to `true`.",
        "long_description": "Privileged containers have access to all Linux Kernel capabilities and devices. A container running with full privileges can do almost everything that the host can do. This flag exists to allow special use-cases, like manipulating the network stack and accessing devices.\n\n There should be at least one PodSecurityPolicy (PSP) defined which does not permit privileged containers.\n\n If you need to run privileged containers, this should be defined in a separate PSP and you should carefully check RBAC controls to ensure that only limited service accounts and users are given permission to access that PSP.",
        "remediation": "Create a PSP as described in the Kubernetes documentation, ensuring that the `.spec.privileged` field is set to `false`.",
        "manual_test": "Get the set of PSPs with the following command:\n\n \n```\nkubectl get psp\n\n```\n For each PSP, check whether privileged is enabled:\n\n \n```\nkubectl get psp -o json\n\n```\n Verify that there is at least one PSP which does not return `true`.\n\n `kubectl get psp <name> -o=jsonpath='{.spec.privileged}'`",
        "references": [
            "https://kubernetes.io/docs/concepts/policy/pod-security-policy/#enabling-pod-security-policies",
            "https://aws.github.io/aws-eks-best-practices/pods/#restrict-the-containers-that-can-run-as-privileged"
        ],
        "attributes": {},
        "rulesNames": [
            "psp-deny-privileged-container"
        ],
        "baseScore": 8.0,
        "impact_statement": "Pods defined with `spec.containers[].securityContext.privileged: true` will not be permitted.",
        "default_value": "By default, when you provision an EKS cluster, a pod security policy called `eks.privileged` is automatically created. The manifest for that policy appears below:\n\n \n```\napiVersion: extensions/v1beta1\nkind: PodSecurityPolicy\nmetadata:\n  annotations:\n    kubernetes.io/description: privileged allows full unrestricted access to pod features,\n      as if the PodSecurityPolicy controller was not enabled.\n    seccomp.security.alpha.kubernetes.io/allowedProfileNames: '*'\n  labels:\n    eks.amazonaws.com/component: pod-security-policy\n    kubernetes.io/cluster-service: \"true\"\n  name: eks.privileged\nspec:\n  allowPrivilegeEscalation: true\n  allowedCapabilities:\n  - '*'\n  fsGroup:\n    rule: RunAsAny\n  hostIPC: true\n  hostNetwork: true\n  hostPID: true\n  hostPorts:\n  - max: 65535\n    min: 0\n  privileged: true\n  runAsUser:\n    rule: RunAsAny\n  seLinux:\n    rule: RunAsAny\n  supplementalGroups:\n    rule: RunAsAny\n  volumes:\n  - '*'\n\n```",
        "scanningScope": {
            "matches": [
                "EKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0109",
        "name": "Ensure that the controller-manager.conf file ownership is set to root:root",
        "description": "Ensure that the `controller-manager.conf` file ownership is set to `root:root`.",
        "long_description": "The `controller-manager.conf` file is the kubeconfig file for the Controller Manager. You should set its file ownership to maintain the integrity of the file. The file should be owned by `root:root`.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/controller-manager.conf\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %U:%G /etc/kubernetes/controller-manager.conf\n\n```\n Verify that the ownership is set to `root:root`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838599"
        ],
        "rulesNames": [
            "ensure-that-the-controller-manager.conf-file-ownership-is-set-to-root-root"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `controller-manager.conf` file ownership is set to `root:root`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Privileged container",
        "attributes": {
            "microsoftMitreColumns": [
                "Privilege escalation"
            ],
            "controlTypeTags": [
                "security",
                "smartRemediation"
            ]
        },
        "description": "Potential attackers may gain access to privileged containers and inherit access to the host resources. Therefore, it is not recommended to deploy privileged containers unless it is absolutely necessary. This control identifies all the privileged Pods.",
        "example": "apiVersion: v1\nkind: Pod\nmetadata:\n  name: privileged\nspec:\n  containers:\n    - name: pause\n      image: k8s.gcr.io/pause\n      securityContext:\n          privileged: true # This field triggers failure!\n",
        "remediation": "Remove privileged capabilities by setting the securityContext.privileged to false. If you must deploy a Pod as privileged, add other restriction to it, such as network policy, Seccomp etc and still remove all unnecessary capabilities. Use the exception mechanism to remove unnecessary notifications.",
        "rulesNames": [
            "rule-privilege-escalation"
        ],
        "long_description": "A privileged container is a container that has all the capabilities of the host machine, which lifts all the limitations regular containers have. Practically, this means that privileged containers can do almost every action that can be performed directly on the host. Attackers who gain access to a privileged container or have permissions to create a new privileged container (by using the compromised pod\u2019s service account, for example), can get access to the host\u2019s resources.",
        "test": "Check in Pod spec if securityContext.privileged == true, if so raise an alert.",
        "controlID": "C-0057",
        "baseScore": 8.0,
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Node escape",
                "id": "Cat-9"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0118",
        "name": "Ensure that the API Server --authorization-mode argument is not set to AlwaysAllow",
        "description": "Do not always authorize all requests.",
        "long_description": "The API Server, can be configured to allow all requests. This mode should not be used on any production cluster.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--authorization-mode` parameter to values other than `AlwaysAllow`. One such example could be as below.\n\n \n```\n--authorization-mode=RBAC\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--authorization-mode` argument exists and is not set to `AlwaysAllow`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838639"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-authorization-mode-argument-is-not-set-to-AlwaysAllow"
        ],
        "baseScore": 7,
        "impact_statement": "Only authorized requests will be served.",
        "default_value": "By default, `AlwaysAllow` is not enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Image pull policy on latest tag",
        "attributes": {
            "controlTypeTags": [
                "devops"
            ]
        },
        "description": "While usage of the latest tag is not generally recommended, in some cases this is necessary. If it is, the ImagePullPolicy must be set to Always, otherwise Kubernetes may run an older image with the same name that happens to be present in the node cache. Note that using Always will not cause additional image downloads because Kubernetes will check the image hash of the local local against the registry and only pull the image if this hash has changed, which is exactly what users want when use the latest tag. This control will identify all pods with latest tag that have ImagePullSecret not set to Always.",
        "remediation": "Set ImagePullPolicy to Always in all pods found by this control.",
        "rulesNames": [
            "image-pull-policy-is-not-set-to-always"
        ],
        "long_description": "While usage of the latest tag is not generally recommended, in some cases this is necessary. If it is, the ImagePullPolicy must be set to Always, otherwise Kubernetes may run an older image with the same name that happens to be present in the node cache. Note that using Always will not cause additional image downloads because Kubernetes will check the image hash of the local local against the registry and only pull the image if this hash has changed, which is exactly what users want when use the latest tag. This control will identify all pods with latest tag that have ImagePullSecret not set to Always. Note as well that some vendors don't use the word latest in the tag. Some other word may also behave like the latest. For example, Redis uses redis:alpine to signify the latest. Therefore, this control treats any word that does not contain digits as the latest. If no tag is specified, the image is treated as latests too.",
        "test": "If  imagePullPolicy = always pass, else fail.",
        "controlID": "C-0075",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "baseScore": 2.0,
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0093",
        "name": "Ensure that the API server pod specification file ownership is set to root:root",
        "description": "Ensure that the API server pod specification file ownership is set to `root:root`.",
        "long_description": "The API server pod specification file controls various parameters that set the behavior of the API server. You should set its file ownership to maintain the integrity of the file. The file should be owned by `root:root`.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/manifests/kube-apiserver.yaml\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %U:%G /etc/kubernetes/manifests/kube-apiserver.yaml\n\n```\n Verify that the ownership is set to `root:root`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838563"
        ],
        "rulesNames": [
            "ensure-that-the-API-server-pod-specification-file-ownership-is-set-to-root-root"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, the `kube-apiserver.yaml` file ownership is set to `root:root`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0199",
        "name": "Minimize the admission of containers with the NET_RAW capability",
        "description": "Do not generally permit containers with the potentially dangerous NET\\_RAW capability.",
        "long_description": "Containers run with a default set of capabilities as assigned by the Container Runtime. By default this can include potentially dangerous capabilities. With Docker as the container runtime the NET\\_RAW capability is enabled which may be misused by malicious containers.\n\n Ideally, all containers should drop this capability.\n\n There should be at least one admission control policy defined which does not permit containers with the NET\\_RAW capability.\n\n If you need to run containers with this capability, this should be defined in a separate policy and you should carefully check to ensure that only limited service accounts and users are given permission to use that policy.",
        "remediation": "Add policies to each namespace in the cluster which has user workloads to restrict the admission of containers with the `NET_RAW` capability.",
        "manual_test": "List the policies in use for each namespace in the cluster, ensure that at least one policy disallows the admission of containers with the `NET_RAW` capability.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126662/recommendations/1838617"
        ],
        "attributes": {},
        "rulesNames": [
            "pod-security-admission-baseline-applied-1",
            "pod-security-admission-baseline-applied-2"
        ],
        "baseScore": 6,
        "impact_statement": "Pods with containers which run with the NET\\_RAW capability will not be permitted.",
        "default_value": "By default, there are no restrictions on the creation of containers with the `NET_RAW` capability.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0116",
        "name": "Ensure that the API Server --kubelet-client-certificate and --kubelet-client-key arguments are set as appropriate",
        "description": "Enable certificate based kubelet authentication.",
        "long_description": "The apiserver, by default, does not authenticate itself to the kubelet's HTTPS endpoints. The requests from the apiserver are treated anonymously. You should set up certificate-based kubelet authentication to ensure that the apiserver authenticates itself to kubelets when submitting requests.",
        "remediation": "Follow the Kubernetes documentation and set up the TLS connection between the apiserver and kubelets. Then, edit API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the kubelet client certificate and key parameters as below.\n\n \n```\n--kubelet-client-certificate=<path/to/client-certificate-file>\n--kubelet-client-key=<path/to/client-key-file>\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--kubelet-client-certificate` and `--kubelet-client-key` arguments exist and they are set as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838624"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-kubelet-client-certificate-and-kubelet-client-key-arguments-are-set-as-appropriate"
        ],
        "baseScore": 7,
        "impact_statement": "You require TLS to be configured on apiserver as well as kubelets.",
        "default_value": "By default, certificate-based kubelet authentication is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0163",
        "name": "Ensure that the kubelet service file ownership is set to root:root",
        "description": "Ensure that the `kubelet` service file ownership is set to `root:root`.",
        "long_description": "The `kubelet` service file controls various parameters that set the behavior of the `kubelet` service in the worker node. You should set its file ownership to maintain the integrity of the file. The file should be owned by `root:root`.",
        "remediation": "Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nchown root:root /etc/systemd/system/kubelet.service.d/kubeadm.conf\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nstat -c %a /etc/systemd/system/kubelet.service.d/10-kubeadm.conf\n\n```\n Verify that the ownership is set to `root:root`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126659/recommendations/1838589"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-kubelet-service-file-ownership-is-set-to-root-root"
        ],
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `kubelet` service file ownership is set to `root:root`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0236",
        "name": "Verify image signature",
        "description": "Verifies the signature of each image with given public keys",
        "long_description": "Verifies the signature of each image with given public keys",
        "remediation": "Replace the image with an image that is signed correctly",
        "manual_test": "",
        "references": [],
        "attributes": {
            "actionRequired": "configuration"
        },
        "rulesNames": [
            "verify-image-signature"
        ],
        "baseScore": 7,
        "impact_statement": "",
        "default_value": "",
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Supply chain",
                "id": "Cat-6"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0232",
        "name": "Manage Kubernetes RBAC users with AWS IAM Authenticator for Kubernetes or Upgrade to AWS CLI v1.16.156",
        "description": "Amazon EKS uses IAM to provide authentication to your Kubernetes cluster through the AWS IAM Authenticator for Kubernetes. You can configure the stock kubectl client to work with Amazon EKS by installing the AWS IAM Authenticator for Kubernetes and modifying your kubectl configuration file to use it for authentication.",
        "long_description": "On- and off-boarding users is often difficult to automate and prone to error. Using a single source of truth for user permissions reduces the number of locations that an individual must be off-boarded from, and prevents users gaining unique permissions sets that increase the cost of audit.",
        "remediation": "Refer to the '[Managing users or IAM roles for your cluster](https://docs.aws.amazon.com/eks/latest/userguide/add-user-role.html)' in Amazon EKS documentation.\n\n Note: If using AWS CLI version 1.16.156 or later there is no need to install the AWS IAM Authenticator anymore.\n\n The relevant AWS CLI commands, depending on the use case, are:\n\n \n```\naws eks update-kubeconfig\naws eks get-token\n\n```",
        "manual_test": "To Audit access to the namespace $NAMESPACE, assume the IAM role yourIAMRoleName for a user that you created, and then run the following command:\n\n \n```\n$ kubectl get role -n $NAMESPACE\n\n```\n The response lists the RBAC role that has access to this Namespace.",
        "references": [
            "https://docs.aws.amazon.com/eks/latest/userguide/add-user-role.html",
            "https://docs.aws.amazon.com/eks/latest/userguide/add-user-role.html"
        ],
        "attributes": {},
        "rulesNames": [
            "review-roles-with-aws-iam-authenticator"
        ],
        "baseScore": 7,
        "impact_statement": "Users must now be assigned to the IAM group created to use this namespace and deploy applications. If they are not they will not be able to access the namespace or deploy.",
        "default_value": "For role-based access control (RBAC), system:masters permissions are configured in the Amazon EKS control plane",
        "scanningScope": {
            "matches": [
                "EKS"
            ]
        },
        "rules": []
    },
    {
        "name": "Ensure that the seccomp profile is set to docker/default in your pod definitions",
        "controlID": "C-0210",
        "description": "Enable `docker/default` seccomp profile in your pod definitions.",
        "long_description": "Seccomp (secure computing mode) is used to restrict the set of system calls applications can make, allowing cluster administrators greater control over the security of workloads running in the cluster. Kubernetes disables seccomp profiles by default for historical reasons. You should enable it to ensure that the workloads have restricted actions available within the container.",
        "remediation": "Use security context to enable the `docker/default` seccomp profile in your pod definitions. An example is as below:\n\n \n```\n  securityContext:\n    seccompProfile:\n      type: RuntimeDefault\n\n```",
        "manual_test": "Review the pod definitions in your cluster. It should create a line as below:\n\n \n```\n  securityContext:\n    seccompProfile:\n      type: RuntimeDefault\n\n```",
        "test": "Checks if seccomp profile is defined as type RuntimeDefault in security context of workload or container level",
        "references": [
            "https://workbench.cisecurity.org/sections/1126667/recommendations/1838635"
        ],
        "attributes": {},
        "rulesNames": [
            "set-seccomp-profile-RuntimeDefault"
        ],
        "baseScore": 4,
        "impact_statement": "If the `docker/default` seccomp profile is too restrictive for you, you would have to create/manage your own seccomp profiles.",
        "default_value": "By default, seccomp profile is set to `unconfined` which means that no seccomp profiles are enabled.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Container hostPort",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance",
                "devops"
            ]
        },
        "description": "Configuring hostPort requires a particular port number. If two objects specify the same HostPort, they could not be deployed to the same node. It may prevent the second object from starting, even if Kubernetes will try reschedule it on another node, provided there are available nodes with sufficient amount of resources. Also, if the number of replicas of such workload is higher than the number of nodes, the deployment will consistently fail.",
        "remediation": "Avoid usage of hostPort unless it is absolutely necessary, in which case define appropriate exception. Use NodePort / ClusterIP instead.",
        "rulesNames": [
            "container-hostPort"
        ],
        "long_description": "Workloads (like pod, deployment, etc) that contain a container with hostport. The problem that arises is that if the scale of your workload is larger than the number of nodes in your Kubernetes cluster, the deployment fails. And any two workloads that specify the same HostPort cannot be deployed to the same node. In addition, if the host where your pods are running becomes unavailable, Kubernetes reschedules the pods to different nodes. Thus, if the IP address for your workload changes, external clients of your application will lose access to the pod. The same thing happens when you restart your pods \u2014 Kubernetes reschedules them to a different node if available.\u00a0",
        "test": "Check for each workload (with container) if it exists inside the container hostPort.\u00a0\u00a0",
        "controlID": "C-0044",
        "baseScore": 4.0,
        "example": "@controls/examples/c044.yaml",
        "category": {
            "name": "Network",
            "id": "Cat-4"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0112",
        "name": "Ensure that the Kubernetes PKI key file permissions are set to 600",
        "description": "Ensure that Kubernetes PKI key files have permissions of `600`.",
        "long_description": "Kubernetes makes use of a number of key files as part of the operation of its components. The permissions on these files should be set to `600` to protect their integrity and confidentiality.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod -R 600 /etc/kubernetes/pki/*.key\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nls -laR /etc/kubernetes/pki/*.key\n\n```\n Verify that the permissions are `600`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838608"
        ],
        "rulesNames": [
            "ensure-that-the-Kubernetes-PKI-key-file-permissions-are-set-to-600"
        ],
        "attributes": {},
        "baseScore": 8,
        "impact_statement": "None",
        "default_value": "By default, the keys used by Kubernetes are set to have permissions of `600`",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0178",
        "name": "Ensure that the --make-iptables-util-chains argument is set to true",
        "description": "Allow Kubelet to manage iptables.",
        "long_description": "Kubelets can automatically manage the required changes to iptables based on how you choose your networking options for the pods. It is recommended to let kubelets manage the changes to iptables. This ensures that the iptables configuration remains in sync with pods networking configuration. Manually configuring iptables with dynamic pod network configuration changes might hamper the communication between pods/containers and to the outside world. You might have iptables rules too restrictive or too open.",
        "remediation": "If using a Kubelet config file, edit the file to set `makeIPTablesUtilChains: true`.\n\n If using command line arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and remove the `--make-iptables-util-chains` argument from the `KUBELET_SYSTEM_PODS_ARGS` variable.\n\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```",
        "manual_test": "Run the following command on each node:\n\n \n```\nps -ef | grep kubelet\n\n```\n Verify that if the `--make-iptables-util-chains` argument exists then it is set to `true`.\n\n If the `--make-iptables-util-chains` argument does not exist, and there is a Kubelet config file specified by `--config`, verify that the file does not set `makeIPTablesUtilChains` to `false`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126668/recommendations/1838651"
        ],
        "attributes": {},
        "rulesNames": [
            "kubelet-ip-tables"
        ],
        "baseScore": 3,
        "impact_statement": "Kubelet would manage the iptables on the system and keep it in sync. If you are using any other iptables management solution, then there might be some conflicts.",
        "default_value": "By default, `--make-iptables-util-chains` argument is set to `true`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Roles with delete capabilities",
        "attributes": {
            "microsoftMitreColumns": [
                "Impact"
            ],
            "rbacQuery": "Data destruction",
            "controlTypeTags": [
                "compliance"
            ]
        },
        "description": "Attackers may attempt to destroy data and resources in the cluster. This includes deleting deployments, configurations, storage, and compute resources. This control identifies all subjects that can delete resources.",
        "remediation": "You should follow the least privilege principle and minimize the number of subjects that can delete resources.",
        "rulesNames": [
            "rule-excessive-delete-rights-v1"
        ],
        "long_description": "Attackers may attempt to destroy data and resources in the cluster. This includes deleting deployments, configurations, storage, and compute resources.",
        "test": "Check which subjects have delete/deletecollection RBAC permissions on workloads.",
        "controlID": "C-0007",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "baseScore": 5,
        "example": "@controls/examples/c007.yaml",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0226",
        "name": "Prefer using a container-optimized OS when possible",
        "description": "A container-optimized OS is an operating system image that is designed for secure managed hosting of containers on compute instances.\n\n Use cases for container-optimized OSes might include:\n\n * Docker container or Kubernetes support with minimal setup.\n* A small-secure container footprint.\n* An OS that is tested, hardened and verified for running Kubernetes nodes in your compute instances.",
        "long_description": "Container-optimized OSes have a smaller footprint which will reduce the instance's potential attack surface. The container runtime is pre-installed and security settings like locked-down firewall is configured by default. Container-optimized images may also be configured to automatically update on a regular period in the background.",
        "remediation": "",
        "manual_test": "If a container-optimized OS is required examine the nodes in EC2 and click on their AMI to ensure that it is a container-optimized OS like Amazon Bottlerocket; or connect to the worker node and check its OS.",
        "references": [
            "https://aws.amazon.com/blogs/containers/bottlerocket-a-special-purpose-container-operating-system/",
            "https://aws.amazon.com/bottlerocket/"
        ],
        "attributes": {},
        "rulesNames": [
            "alert-container-optimized-os-not-in-use"
        ],
        "baseScore": 3,
        "impact_statement": "A container-optimized OS may have limited or no support for package managers, execution of non-containerized applications, or ability to install third-party drivers or kernel modules. Conventional remote access to the host (i.e. ssh) may not be possible, with access and debugging being intended via a management tool.",
        "default_value": "A container-optimized OS is not the default.",
        "scanningScope": {
            "matches": [
                "EKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0124",
        "name": "Ensure that the admission control plugin SecurityContextDeny is set if PodSecurityPolicy is not used",
        "description": "The SecurityContextDeny admission controller can be used to deny pods which make use of some SecurityContext fields which could allow for privilege escalation in the cluster. This should be used where PodSecurityPolicy is not in place within the cluster.",
        "long_description": "SecurityContextDeny can be used to provide a layer of security for clusters which do not have PodSecurityPolicies enabled.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--enable-admission-plugins` parameter to include `SecurityContextDeny`, unless `PodSecurityPolicy` is already in place.\n\n \n```\n--enable-admission-plugins=...,SecurityContextDeny,...\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--enable-admission-plugins` argument is set to a value that includes `SecurityContextDeny`, if `PodSecurityPolicy` is not included.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838650"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-admission-control-plugin-SecurityContextDeny-is-set-if-PodSecurityPolicy-is-not-used"
        ],
        "baseScore": 4,
        "impact_statement": "This admission controller should only be used where Pod Security Policies cannot be used on the cluster, as it can interact poorly with certain Pod Security Policies",
        "default_value": "By default, `SecurityContextDeny` is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Ensure CPU requests are set",
        "attributes": {
            "controlTypeTags": [
                "compliance",
                "devops"
            ]
        },
        "description": "This control identifies all Pods for which the CPU requests are not set.",
        "remediation": "Set the CPU requests or use exception mechanism to avoid unnecessary notifications.",
        "rulesNames": [
            "resources-cpu-requests"
        ],
        "controlID": "C-0268",
        "baseScore": 3.0,
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Resource management",
                "id": "Cat-7"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "API server insecure port is enabled",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Kubernetes control plane API is running with non-secure port enabled which allows attackers to gain unprotected access to the cluster.",
        "remediation": "Set the insecure-port flag of the API server to zero.",
        "rulesNames": [
            "insecure-port-flag"
        ],
        "long_description": "The control plane is the core of Kubernetes and gives users the ability to view containers, schedule new Pods, read Secrets, and execute commands in the cluster. Therefore, it should be protected. It is recommended to avoid control plane exposure to the Internet or to an untrusted network. The API server runs on ports 6443 and 8080. We recommend to block them in the firewall. Note also that port 8080, when accessed through the local machine, does not require TLS encryption, and the requests bypass authentication and authorization modules.",
        "test": "Check if the insecure-port flag is set (in case of cloud vendor hosted Kubernetes service this verification will not be effective).",
        "controlID": "C-0005",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "baseScore": 9,
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0180",
        "name": "Ensure that the --event-qps argument is set to 0 or a level which ensures appropriate event capture",
        "description": "Security relevant information should be captured. The `--event-qps` flag on the Kubelet can be used to limit the rate at which events are gathered. Setting this too low could result in relevant events not being logged, however the unlimited setting of `0` could result in a denial of service on the kubelet.",
        "long_description": "It is important to capture all events and not restrict event creation. Events are an important source of security information and analytics that ensure that your environment is consistently monitored using the event data.",
        "remediation": "If using a Kubelet config file, edit the file to set `eventRecordQPS:` to an appropriate level.\n\n If using command line arguments, edit the kubelet service file `/etc/systemd/system/kubelet.service.d/10-kubeadm.conf` on each worker node and set the below parameter in `KUBELET_SYSTEM_PODS_ARGS` variable.\n\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```",
        "manual_test": "Run the following command on each node:\n\n \n```\nps -ef | grep kubelet\n\n```\n Review the value set for the `--event-qps` argument and determine whether this has been set to an appropriate level for the cluster. The value of `0` can be used to ensure that all events are captured.\n\n If the `--event-qps` argument does not exist, check that there is a Kubelet config file specified by `--config` and review the value in this location.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126668/recommendations/1838656"
        ],
        "attributes": {},
        "rulesNames": [
            "kubelet-event-qps"
        ],
        "baseScore": 2,
        "impact_statement": "Setting this parameter to `0` could result in a denial of service condition due to excessive events being created. The cluster's event processing and storage systems should be scaled to handle expected event loads.",
        "default_value": "By default, `--event-qps` argument is set to `5`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Insecure capabilities",
        "attributes": {
            "actionRequired": "configuration",
            "controlTypeTags": [
                "security",
                "compliance",
                "smartRemediation"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Privilege Escalation (Node)"
                    ]
                }
            ]
        },
        "description": "Giving insecure or excessive capabilities to a container can increase the impact of the container compromise. This control identifies all the pods with dangerous capabilities (see documentation pages for details).",
        "remediation": "Remove all insecure capabilities which are not necessary for the container.",
        "rulesNames": [
            "insecure-capabilities"
        ],
        "long_description": "Giving  insecure and unnecessary capabilities for a container can increase the impact of a container compromise.",
        "test": "Check capabilities given against a configurable blacklist of insecure capabilities (https://man7.org/linux/man-pages/man7/capabilities.7.html). ",
        "controlID": "C-0046",
        "baseScore": 7.0,
        "example": "@controls/examples/c046.yaml",
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Node escape",
                "id": "Cat-9"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0248",
        "name": "Ensure clusters are created with Private Nodes",
        "description": "Disable public IP addresses for cluster nodes, so that they only have private IP addresses. Private Nodes are nodes with no public IP addresses.",
        "long_description": "Disabling public IP addresses on cluster nodes restricts access to only internal networks, forcing attackers to obtain local network access before attempting to compromise the underlying Kubernetes hosts.",
        "remediation": "\n```\naz aks create \\\n--resource-group <private-cluster-resource-group> \\\n--name <private-cluster-name> \\\n--load-balancer-sku standard \\\n--enable-private-cluster \\\n--network-plugin azure \\\n--vnet-subnet-id <subnet-id> \\\n--docker-bridge-address \\\n--dns-service-ip \\\n--service-cidr \n\n```\n Where `--enable-private-cluster` is a mandatory flag for a private cluster.",
        "manual_test": "",
        "references": [
            "<https://learn.microsoft.com/en-us/azure/aks/private-clusters>"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-clusters-are-created-with-private-nodes"
        ],
        "baseScore": 8,
        "impact_statement": "To enable Private Nodes, the cluster has to also be configured with a private master IP range and IP Aliasing enabled.\n\n Private Nodes do not have outbound access to the public internet. If you want to provide outbound Internet access for your private nodes, you can use Cloud NAT or you can manage your own NAT gateway.",
        "default_value": "",
        "scanningScope": {
            "matches": [
                "AKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0246",
        "name": "Avoid use of system:masters group",
        "description": "The special group `system:masters` should not be used to grant permissions to any user or service account, except where strictly necessary (e.g. bootstrapping access prior to RBAC being fully available)",
        "long_description": "The `system:masters` group has unrestricted access to the Kubernetes API hard-coded into the API server source code. An authenticated user who is a member of this group cannot have their access reduced, even if all bindings and cluster role bindings which mention it, are removed.\n\n When combined with client certificate authentication, use of this group can allow for irrevocable cluster-admin level credentials to exist for a cluster.",
        "remediation": "Remove the `system:masters` group from all users in the cluster.",
        "manual_test": "Review a list of all credentials which have access to the cluster and ensure that the group `system:masters` is not used.",
        "references": [
            "https://github.com/kubernetes/kubernetes/blob/master/pkg/registry/rbac/escalation_check.go#L38"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-manual"
        ],
        "baseScore": 8,
        "impact_statement": "Once the RBAC system is operational in a cluster `system:masters` should not be specifically required, as ordinary bindings from principals to the `cluster-admin` cluster role can be made where unrestricted access is required.",
        "default_value": "By default some clusters will create a \"break glass\" client certificate which is a member of this group. Access to this client certificate should be carefully controlled and it should not be used for general cluster operations.",
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Prevent containers from allowing command execution",
        "attributes": {
            "microsoftMitreColumns": [
                "Execution"
            ],
            "rbacQuery": "Show who can access into pods",
            "controlTypeTags": [
                "compliance",
                "security-impact"
            ]
        },
        "description": "Attackers with relevant permissions can run malicious commands in the context of legitimate containers in the cluster using \u201ckubectl exec\u201d command. This control determines which subjects have permissions to use this command.",
        "remediation": "It is recommended to prohibit \u201ckubectl exec\u201d command in production environments. It is also recommended not to use subjects with this permission for daily cluster operations.",
        "rulesNames": [
            "exec-into-container-v1"
        ],
        "long_description": "Attackers who have permissions, can run malicious commands in containers in the cluster using exec command (\u201ckubectl exec\u201d). In this method, attackers can use legitimate images, such as an OS image (e.g., Ubuntu) as a backdoor container, and run their malicious code remotely by using \u201ckubectl exec\u201d.",
        "test": "Check which subjects have RBAC permissions to exec into pods\u2013 if they have the \u201cpods/exec\u201d verb.",
        "controlID": "C-0002",
        "baseScore": 5.0,
        "example": "@controls/examples/c002.yaml",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0181",
        "name": "Ensure that the --tls-cert-file and --tls-private-key-file arguments are set as appropriate",
        "description": "Setup TLS connection on the Kubelets.",
        "long_description": "The connections from the apiserver to the kubelet are used for fetching logs for pods, attaching (through kubectl) to running pods, and using the kubelet\u2019s port-forwarding functionality. These connections terminate at the kubelet\u2019s HTTPS endpoint. By default, the apiserver does not verify the kubelet\u2019s serving certificate, which makes the connection subject to man-in-the-middle attacks, and unsafe to run over untrusted and/or public networks.",
        "remediation": "If using a Kubelet config file, edit the file to set tlsCertFile to the location of the certificate file to use to identify this Kubelet, and tlsPrivateKeyFile to the location of the corresponding private key file.\n\n If using command line arguments, edit the kubelet service file /etc/kubernetes/kubelet.conf on each worker node and set the below parameters in KUBELET\\_CERTIFICATE\\_ARGS variable.\n\n --tls-cert-file=<path/to/tls-certificate-file> --tls-private-key-file=<path/to/tls-key-file>\nBased on your system, restart the kubelet service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```",
        "manual_test": "Run the following command on each node:\n\n \n```\nps -ef | grep kubelet\n\n```\n Verify that the --tls-cert-file and --tls-private-key-file arguments exist and they are set as appropriate.\n\n If these arguments are not present, check that there is a Kubelet config specified by --config and that it contains appropriate settings for tlsCertFile and tlsPrivateKeyFile.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126668/recommendations/1838657"
        ],
        "attributes": {},
        "rulesNames": [
            "validate-kubelet-tls-configuration-updated"
        ],
        "baseScore": 7,
        "impact_statement": "",
        "default_value": "",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Configured readiness probe",
        "attributes": {
            "controlTypeTags": [
                "devops"
            ]
        },
        "description": "Readiness probe is intended to ensure that workload is ready to process network traffic. It is highly recommended to define readiness probe for every worker container. This control finds all the pods where the readiness probe is not configured.",
        "remediation": "Ensure Readiness probes are configured wherever possible.",
        "rulesNames": [
            "configured-readiness-probe"
        ],
        "long_description": "Readiness probe is intended to ensure that workload is ready to process network traffic. It is highly recommended to define readiness probe for every worker container. This control finds all the pods where the readiness probe is not configured.",
        "controlID": "C-0018",
        "example": "@controls/examples/c018.yaml",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "baseScore": 3.0,
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0121",
        "name": "Ensure that the admission control plugin EventRateLimit is set",
        "description": "Limit the rate at which the API server accepts requests.",
        "long_description": "Using `EventRateLimit` admission control enforces a limit on the number of events that the API Server will accept in a given time slice. A misbehaving workload could overwhelm and DoS the API Server, making it unavailable. This particularly applies to a multi-tenant cluster, where there might be a small percentage of misbehaving tenants which could have a significant impact on the performance of the cluster overall. Hence, it is recommended to limit the rate of events that the API server will accept.\n\n Note: This is an Alpha feature in the Kubernetes 1.15 release.",
        "remediation": "Follow the Kubernetes documentation and set the desired limits in a configuration file.\n\n Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` and set the below parameters.\n\n \n```\n--enable-admission-plugins=...,EventRateLimit,...\n--admission-control-config-file=<path/to/configuration/file>\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--enable-admission-plugins` argument is set to a value that includes `EventRateLimit`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838644"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-admission-control-plugin-EventRateLimit-is-set"
        ],
        "baseScore": 4,
        "impact_statement": "You need to carefully tune in limits as per your environment.",
        "default_value": "By default, `EventRateLimit` is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0159",
        "name": "Ensure that a unique Certificate Authority is used for etcd",
        "description": "Use a different certificate authority for etcd from the one used for Kubernetes.",
        "long_description": "etcd is a highly available key-value store used by Kubernetes deployments for persistent storage of all of its REST API objects. Its access should be restricted to specifically designated clients and peers only.\n\n Authentication to etcd is based on whether the certificate presented was issued by a trusted certificate authority. There is no checking of certificate attributes such as common name or subject alternative name. As such, if any attackers were able to gain access to any certificate issued by the trusted certificate authority, they would be able to gain full access to the etcd database.",
        "remediation": "Follow the etcd documentation and create a dedicated certificate authority setup for the etcd service.\n\n Then, edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and set the below parameter.\n\n \n```\n--trusted-ca-file=</path/to/ca-file>\n\n```",
        "manual_test": "Review the CA used by the etcd environment and ensure that it does not match the CA certificate file used for the management of the overall Kubernetes cluster.\n\n Run the following command on the master node:\n\n \n```\nps -ef | grep etcd\n\n```\n Note the file referenced by the `--trusted-ca-file` argument.\n\n Run the following command on the master node:\n\n \n```\nps -ef | grep apiserver\n\n```\n Verify that the file referenced by the `--client-ca-file` for apiserver is different from the `--trusted-ca-file` used by etcd.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126654/recommendations/1838578"
        ],
        "attributes": {},
        "rulesNames": [
            "etcd-unique-ca"
        ],
        "baseScore": 8,
        "impact_statement": "Additional management of the certificates and keys for the dedicated certificate authority will be required.",
        "default_value": "By default, no etcd certificate is created and used.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0129",
        "name": "Ensure that the API Server --profiling argument is set to false",
        "description": "Disable profiling, if not needed.",
        "long_description": "Profiling allows for the identification of specific performance bottlenecks. It generates a significant amount of program data that could potentially be exploited to uncover system and program details. If you are not experiencing any bottlenecks and do not need the profiler for troubleshooting purposes, it is recommended to turn it off to reduce the potential attack surface.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the below parameter.\n\n \n```\n--profiling=false\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--profiling` argument is set to `false`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838660"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-profiling-argument-is-set-to-false"
        ],
        "baseScore": 3,
        "impact_statement": "Profiling information would not be available.",
        "default_value": "By default, profiling is enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Workload with administrative roles",
        "attributes": {},
        "description": "This control identifies workloads where the associated service accounts have roles that grant administrative-level access across the cluster. Granting a workload such expansive permissions equates to providing it cluster admin roles. This level of access can pose a significant security risk, as it allows the workload to perform any action on any resource, potentially leading to unauthorized data access or cluster modifications.",
        "remediation": "You should apply least privilege principle. Make sure cluster admin permissions are granted only when it is absolutely necessary. Don't use service accounts with such high permissions for daily operations.",
        "rulesNames": [
            "workload-with-administrative-roles"
        ],
        "long_description": "In Kubernetes environments, workloads granted administrative-level privileges without restrictions represent a critical security vulnerability. When a service account associated with a workload is configured with permissions to perform any action on any resource, it essentially holds unrestricted access within the cluster, akin to cluster admin privileges. This configuration dramatically increases the risk of security breaches, including data theft, unauthorized modifications, and potentially full cluster takeovers. Such privileges allow attackers to exploit the workload for wide-ranging malicious activities, bypassing the principle of least privilege. Therefore, it's essential to follow the least privilege principle and make sure cluster admin permissions are granted only when it is absolutely necessary.",
        "test": "Check if the service account used by a workload has cluster admin roles, either by being bound to the cluster-admin clusterrole, or by having equivalent high privileges.",
        "controlID": "C-0272",
        "baseScore": 6.0,
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0265",
        "name": "system:authenticated user has elevated roles",
        "description": "Granting permissions to the system:authenticated group is generally not recommended and can introduce security risks. This control ensures that system:authenticated users do not have cluster risking permissions.",
        "remediation": "Review and modify your cluster's RBAC configuration to ensure that system:authenticated will have minimal permissions.",
        "test": "Checks if ClusterRoleBinding/RoleBinding resources give permissions to system:authenticated group.",
        "attributes": {},
        "rulesNames": [
            "system-authenticated-allowed-to-take-over-cluster"
        ],
        "baseScore": 7,
        "category": {
            "name": "Control plane",
            "subCategory": {
                "name": "Supply chain",
                "id": "Cat-6"
            },
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "CVE-2022-47633-kyverno-signature-bypass",
        "attributes": {
            "controlTypeTags": [
                "security"
            ]
        },
        "description": "CVE-2022-47633 is a high severity vulnerability in Kyverno, it enables attackers to bypass the image signature validation of policies using a malicious image repository or MITM proxy",
        "remediation": "Update your Grafana to 9.2.4 or above",
        "rulesNames": [
            "CVE-2022-47633"
        ],
        "long_description": "CVE-2022-47633 is a high severity vulnerability in Kyverno, it enables attackers to bypass the image signature validation of policies using a malicious image repository or MITM proxy. Image signature verification process is used to verify the integrity of the image and prevent the execution of malicious images. The verification process was pull image manifest twice, once for verification and once for the actual execution. The verification process was bypassed by using a malicious image repository or MITM proxy to return a different manifest for the verification process. This vulnerability was fixed in Kyverno 1.8.5. This issue can be mitigated by using only trusted image repositories and by using a secure connection to the image repository. See C-0001 and C-0078 for limiting the use of trusted repositories.",
        "test": "This control test for vulnerable versions of Grafana (between 1.8.3 and 1.8.4)",
        "controlID": "C-0091",
        "baseScore": 8.0,
        "example": "",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0151",
        "name": "Ensure that the Scheduler --profiling argument is set to false",
        "description": "Disable profiling, if not needed.",
        "long_description": "Profiling allows for the identification of specific performance bottlenecks. It generates a significant amount of program data that could potentially be exploited to uncover system and program details. If you are not experiencing any bottlenecks and do not need the profiler for troubleshooting purposes, it is recommended to turn it off to reduce the potential attack surface.",
        "remediation": "Edit the Scheduler pod specification file `/etc/kubernetes/manifests/kube-scheduler.yaml` file on the Control Plane node and set the below parameter.\n\n \n```\n--profiling=false\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-scheduler\n\n```\n Verify that the `--profiling` argument is set to `false`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126670/recommendations/1838684"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-scheduler-profiling-argument-is-set-to-false"
        ],
        "baseScore": 3,
        "impact_statement": "Profiling information would not be available.",
        "default_value": "By default, profiling is enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "CVE-2022-23648-containerd-fs-escape",
        "attributes": {
            "controlTypeTags": [
                "security"
            ]
        },
        "description": "CVE-2022-23648 is a vulnerability of containerd enabling attacker to gain access to read-only copies of arbitrary files from the host using specially-crafted manifests",
        "remediation": "Patch containerd to 1.6.1, 1.5.10, 1.4.12  or above",
        "rulesNames": [
            "CVE-2022-23648"
        ],
        "long_description": "Containerd is a container runtime available as a daemon for Linux and Windows. A bug was found in containerd prior to versions 1.6.1, 1.5.10, and 1.4.12 where containers launched through containerd\u2019s CRI implementation on Linux with a specially-crafted image configuration could gain access to read-only copies of arbitrary files and directories on the host. This may bypass any policy-based enforcement on container setup (including a Kubernetes Pod Security Policy) and expose potentially sensitive information. This bug was fixed in containerd versions 1.6.1, 1.5.10, and 1.4.12. Users should update to these versions to resolve the issue.",
        "test": "Checking containerd version to see if it is a vulnerable version (where the container runtime is containerd)",
        "controlID": "C-0087",
        "baseScore": 7.0,
        "example": "",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0125",
        "name": "Ensure that the admission control plugin ServiceAccount is set",
        "description": "Automate service accounts management.",
        "long_description": "When you create a pod, if you do not specify a service account, it is automatically assigned the `default` service account in the same namespace. You should create your own service account and let the API server manage its security tokens.",
        "remediation": "Follow the documentation and create `ServiceAccount` objects as per your environment. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and ensure that the `--disable-admission-plugins` parameter is set to a value that does not include `ServiceAccount`.",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--disable-admission-plugins` argument is set to a value that does not includes `ServiceAccount`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838652"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-admission-control-plugin-ServiceAccount-is-set"
        ],
        "baseScore": 3,
        "impact_statement": "None.",
        "default_value": "By default, `ServiceAccount` is set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Cluster internal networking",
        "attributes": {
            "microsoftMitreColumns": [
                "Lateral movement"
            ],
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "If no network policy is defined, attackers who gain access to a container may use it to move laterally in the cluster. This control lists namespaces in which no network policy is defined.",
        "remediation": "Define Kubernetes network policies or use alternative products to protect cluster network.",
        "rulesNames": [
            "internal-networking"
        ],
        "long_description": "Kubernetes networking behavior allows traffic between pods in the cluster as a default behavior. Attackers who gain access to a single container may use it for network reachability to another container in the cluster.",
        "test": "Check for each namespace if there is a network policy defined.",
        "controlID": "C-0054",
        "baseScore": 4.0,
        "category": {
            "name": "Network",
            "id": "Cat-4"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Resources memory limit and request",
        "attributes": {
            "controlTypeTags": [
                "compliance",
                "devops"
            ],
            "actionRequired": "configuration"
        },
        "description": "This control identifies all Pods for which the memory limit is not set.",
        "remediation": "Set the memory limit or use exception mechanism to avoid unnecessary notifications.",
        "rulesNames": [
            "resources-memory-limit-and-request"
        ],
        "controlID": "C-0004",
        "example": "@controls/examples/c004.yaml",
        "baseScore": 8.0,
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Resource management",
                "id": "Cat-7"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Exposed sensitive interfaces",
        "attributes": {
            "actionRequired": "configuration",
            "microsoftMitreColumns": [
                "Initial access"
            ],
            "controlTypeTags": [
                "compliance"
            ]
        },
        "description": "Exposing a sensitive interface to the internet poses a security risk. It might enable attackers to run malicious code or deploy containers in the cluster. This control checks if known components (e.g. Kubeflow, Argo Workflows, etc.) are deployed and exposed services externally.",
        "remediation": "Consider blocking external interfaces or protect them with appropriate security tools.",
        "rulesNames": [
            "exposed-sensitive-interfaces-v1"
        ],
        "long_description": "Exposing a sensitive interface to the internet poses a security risk. Some popular frameworks were not intended to be exposed to the internet, and therefore don\u2019t require authentication by default. Thus, exposing them to the internet allows unauthenticated access to a sensitive interface which might enable running code or deploying containers in the cluster by a malicious actor. Examples of such interfaces that were seen exploited include Apache NiFi, Kubeflow, Argo Workflows, Weave Scope, and the Kubernetes dashboard.",
        "test": "Checking if a service of type nodeport/loadbalancer to one of the known exploited interfaces (Apache NiFi, Kubeflow, Argo Workflows, Weave Scope Kubernetes dashboard) exists. Needs to add user config",
        "controlID": "C-0021",
        "baseScore": 6.0,
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0170",
        "name": "If the kubelet config.yaml configuration file is being used validate permissions set to 600 or more restrictive",
        "description": "Ensure that if the kubelet refers to a configuration file with the `--config` argument, that file has permissions of 600 or more restrictive.",
        "long_description": "The kubelet reads various parameters, including security settings, from a config file specified by the `--config` argument. If this file is specified you should restrict its file permissions to maintain the integrity of the file. The file should be writable by only the administrators on the system.",
        "remediation": "Run the following command (using the config file location identied in the Audit step)\n\n \n```\nchmod 600 /var/lib/kubelet/config.yaml\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nstat -c %a /var/lib/kubelet/config.yaml\n\n```\n Verify that the permissions are `600` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126659/recommendations/1838620"
        ],
        "rulesNames": [
            "if-the-kubelet-config.yaml-configuration-file-is-being-used-validate-permissions-set-to-600-or-more-restrictive"
        ],
        "attributes": {},
        "baseScore": 7,
        "impact_statement": "None",
        "default_value": "By default, the /var/lib/kubelet/config.yaml file as set up by `kubeadm` has permissions of 600.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Create administrative boundaries between resources using namespaces",
        "controlID": "C-0209",
        "description": "Use namespaces to isolate your Kubernetes objects.",
        "long_description": "Limiting the scope of user permissions can reduce the impact of mistakes or malicious activities. A Kubernetes namespace allows you to partition created resources into logically named groups. Resources created in one namespace can be hidden from other namespaces. By default, each resource created by a user in Kubernetes cluster runs in a default namespace, called `default`. You can create additional namespaces and attach resources and users to them. You can use Kubernetes Authorization plugins to create policies that segregate access to namespace resources between different users.",
        "remediation": "Follow the documentation and create namespaces for objects in your deployment as you need them.",
        "manual_test": "Run the below command and review the namespaces created in the cluster.\n\n \n```\nkubectl get namespaces\n\n```\n Ensure that these namespaces are the ones you need and are adequately administered as per your requirements.",
        "test": "Lists all namespaces in cluster for user to review",
        "references": [
            "https://workbench.cisecurity.org/sections/1126667/recommendations/1838633"
        ],
        "attributes": {},
        "rulesNames": [
            "list-all-namespaces"
        ],
        "baseScore": 5,
        "impact_statement": "You need to switch between namespaces for administration.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "default_value": "By default, Kubernetes starts with two initial namespaces: 1. `default` - The default namespace for objects with no other namespace2. `kube-system` - The namespace for objects created by the Kubernetes system3. `kube-node-lease` - Namespace used for node heartbeats4. `kube-public` - Namespace used for public information in a cluster",
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0149",
        "name": "Ensure that the Controller Manager RotateKubeletServerCertificate argument is set to true",
        "description": "Enable kubelet server certificate rotation on controller-manager.",
        "long_description": "`RotateKubeletServerCertificate` causes the kubelet to both request a serving certificate after bootstrapping its client credentials and rotate the certificate as its existing credentials expire. This automated periodic rotation ensures that the there are no downtimes due to expired certificates and thus addressing availability in the CIA security triad.\n\n Note: This recommendation only applies if you let kubelets get their certificates from the API server. In case your kubelet certificates come from an outside authority/tool (e.g. Vault) then you need to take care of rotation yourself.",
        "remediation": "Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node and set the `--feature-gates` parameter to include `RotateKubeletServerCertificate=true`.\n\n \n```\n--feature-gates=RotateKubeletServerCertificate=true\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-controller-manager\n\n```\n Verify that `RotateKubeletServerCertificate` argument exists and is set to `true`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126669/recommendations/1838682"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-controller-manager-RotateKubeletServerCertificate-argument-is-set-to-true"
        ],
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `RotateKubeletServerCertificate` is set to \"true\" this recommendation verifies that it has not been disabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0184",
        "name": "Ensure that the Kubelet only makes use of Strong Cryptographic Ciphers",
        "description": "Ensure that the Kubelet is configured to only use strong cryptographic ciphers.",
        "long_description": "TLS ciphers have had a number of known vulnerabilities and weaknesses, which can reduce the protection provided by them. By default Kubernetes supports a number of TLS ciphersuites including some that have security concerns, weakening the protection provided.",
        "remediation": "If using a Kubelet config file, edit the file to set `TLSCipherSuites:` to `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,TLS_RSA_WITH_AES_256_GCM_SHA384,TLS_RSA_WITH_AES_128_GCM_SHA256` or to a subset of these values.\n\n If using executable arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the `--tls-cipher-suites` parameter as follows, or to a subset of these values.\n\n \n```\n --tls-cipher-suites=TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,TLS_RSA_WITH_AES_256_GCM_SHA384,TLS_RSA_WITH_AES_128_GCM_SHA256\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```",
        "manual_test": "The set of cryptographic ciphers currently considered secure is the following:\n\n * `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256`\n* `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`\n* `TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305`\n* `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`\n* `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305`\n* `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384`\n* `TLS_RSA_WITH_AES_256_GCM_SHA384`\n* `TLS_RSA_WITH_AES_128_GCM_SHA256`\n\n Run the following command on each node:\n\n \n```\nps -ef | grep kubelet\n\n```\n If the `--tls-cipher-suites` argument is present, ensure it only contains values included in this set.\n\n If it is not present check that there is a Kubelet config file specified by `--config`, and that file sets `TLSCipherSuites:` to only include values from this set.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126668/recommendations/1838663"
        ],
        "attributes": {},
        "rulesNames": [
            "kubelet-strong-cryptographics-ciphers"
        ],
        "baseScore": 5,
        "impact_statement": "Kubelet clients that cannot support modern cryptographic ciphers will not be able to make connections to the Kubelet API.",
        "default_value": "By default the Kubernetes API server supports a wide range of TLS ciphers",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0169",
        "name": "Ensure that the client certificate authorities file ownership is set to root:root",
        "description": "Ensure that the certificate authorities file ownership is set to `root:root`.",
        "long_description": "The certificate authorities file controls the authorities used to validate API requests. You should set its file ownership to maintain the integrity of the file. The file should be owned by `root:root`.",
        "remediation": "Run the following command to modify the ownership of the `--client-ca-file`.\n\n \n```\nchown root:root <filename>\n\n```",
        "manual_test": "Run the following command:\n\n \n```\nps -ef | grep kubelet\n\n```\n Find the file specified by the `--client-ca-file` argument.\n\n Run the following command:\n\n \n```\nstat -c %U:%G <filename>\n\n```\n Verify that the ownership is set to `root:root`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126659/recommendations/1838619"
        ],
        "rulesNames": [
            "ensure-that-the-client-certificate-authorities-file-ownership-is-set-to-root-root"
        ],
        "attributes": {},
        "baseScore": 7,
        "impact_statement": "None",
        "default_value": "By default no `--client-ca-file` is specified.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0131",
        "name": "Ensure that the API Server --audit-log-maxage argument is set to 30 or as appropriate",
        "description": "Retain the logs for at least 30 days or as appropriate.",
        "long_description": "Retaining logs for at least 30 days ensures that you can go back in time and investigate or correlate any events. Set your audit log retention period to 30 days or as per your business requirements.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--audit-log-maxage` parameter to 30 or as an appropriate number of days:\n\n \n```\n--audit-log-maxage=30\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--audit-log-maxage` argument is set to `30` or as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838664"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-audit-log-maxage-argument-is-set-to-30-or-as-appropriate"
        ],
        "baseScore": 4,
        "impact_statement": "None",
        "default_value": "By default, auditing is not enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0133",
        "name": "Ensure that the API Server --audit-log-maxsize argument is set to 100 or as appropriate",
        "description": "Rotate log files on reaching 100 MB or as appropriate.",
        "long_description": "Kubernetes automatically rotates the log files. Retaining old log files ensures that you would have sufficient log data available for carrying out any investigation or correlation. If you have set file size of 100 MB and the number of old log files to keep as 10, you would approximate have 1 GB of log data that you could potentially use for your analysis.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--audit-log-maxsize` parameter to an appropriate size in MB. For example, to set it as 100 MB:\n\n \n```\n--audit-log-maxsize=100\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--audit-log-maxsize` argument is set to `100` or as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838666"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-audit-log-maxsize-argument-is-set-to-100-or-as-appropriate"
        ],
        "baseScore": 4,
        "impact_statement": "None",
        "default_value": "By default, auditing is not enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Applications credentials in configuration files",
        "attributes": {
            "actionRequired": "configuration",
            "microsoftMitreColumns": [
                "Credential access",
                "Lateral Movement"
            ],
            "controlTypeTags": [
                "security",
                "compliance",
                "security-impact"
            ]
        },
        "description": "Attackers who have access to configuration files can steal the stored secrets and use them. This control checks if ConfigMaps or pod specifications have sensitive information in their configuration.",
        "remediation": "Use Kubernetes secrets or Key Management Systems to store credentials.",
        "rulesNames": [
            "rule-credentials-in-env-var",
            "rule-credentials-configmap"
        ],
        "long_description": "Developers store secrets in the Kubernetes configuration files, such as environment variables in the pod configuration. Such behavior is commonly seen in clusters that are monitored by Azure Security Center. Attackers who have access to those configurations, by querying the API server or by accessing those files on the developer\u2019s endpoint, can steal the stored secrets and use them.",
        "test": "Check if the pod has sensitive information in environment variables, by using list of known sensitive key names. Check if there are configmaps with sensitive information.",
        "controlID": "C-0012",
        "baseScore": 8.0,
        "category": {
            "name": "Secrets",
            "id": "Cat-3"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Minimize access to the proxy sub-resource of nodes",
        "controlID": "C-0279",
        "description": "Users with access to the Proxy sub-resource of Node objects automatically have permissions to use the Kubelet API, which may allow for privilege escalation or bypass cluster security controls such as audit logs.",
        "long_description": "Users with access to the Proxy sub-resource of Node objects automatically have permissions to use the Kubelet API, which may allow for privilege escalation or bypass cluster security controls such as audit logs. The Kubelet provides an API which includes rights to execute commands in any container running on the node. Access to this API is covered by permissions to the main Kubernetes API via the node object. The proxy sub-resource specifically allows wide ranging access to the Kubelet API. Direct access to the Kubelet API bypasses controls like audit logging (there is no audit log of Kubelet API access) and admission control.",
        "remediation": "Where possible, remove access to the proxy sub-resource of node objects.",
        "manual_test": "Review the users who have access to the proxy sub-resource of node objects in the Kubernetes API.",
        "test": "Check which subjects have RBAC permissions to access the proxy sub-resource of node objects.",
        "references": [
            "https://workbench.cisecurity.org/sections/2633388/recommendations/4261961"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-can-access-proxy-subresource"
        ],
        "baseScore": 5,
        "impact_statement": "Users with access to the proxy sub-resource of node objects automatically have permissions to use the Kubelet API, which may allow for privilege escalation or bypass cluster security controls such as audit logs.",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "default_value": "By default in a kubeadm cluster the following list of principals have `create` privileges on `node/proxy` objects ```CLUSTERROLEBINDING                                    SUBJECT                             TYPE            SA-NAMESPACEcluster-admin                                         system:masters                      Group           system:controller:clusterrole-aggregation-controller  clusterrole-aggregation-controller  ServiceAccount  kube-systemsystem:controller:daemon-set-controller               daemon-set-controller               ServiceAccount  kube-systemsystem:controller:job-controller                      job-controller                      ServiceAccount  kube-systemsystem:controller:persistent-volume-binder            persistent-volume-binder            ServiceAccount  kube-systemsystem:controller:replicaset-controller               replicaset-controller               ServiceAccount  kube-systemsystem:controller:replication-controller              replication-controller              ServiceAccount  kube-systemsystem:controller:statefulset-controller              statefulset-controller              ServiceAccount  kube-system```",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Verify Authenticated Service",
        "controlID": "C-0274",
        "description": "Verifies if the service is authenticated",
        "long_description": "Verifies that in order to access the service, the user must be authenticated.",
        "remediation": "Configure the service to require authentication.",
        "manual_test": "",
        "attributes": {
            "controlTypeTags": [
                "security"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-unauthenticated-service",
                    "categories": [
                        "Execution"
                    ]
                }
            ]
        },
        "rulesNames": [
            "unauthenticated-service"
        ],
        "baseScore": 7,
        "impact_statement": "",
        "default_value": "",
        "category": {
            "name": "Network",
            "id": "Cat-4"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0222",
        "name": "Minimize user access to Amazon ECR",
        "description": "Restrict user access to Amazon ECR, limiting interaction with build images to only authorized personnel and service accounts.",
        "long_description": "Weak access control to Amazon ECR may allow malicious users to replace built images with vulnerable containers.",
        "remediation": "Before you use IAM to manage access to Amazon ECR, you should understand what IAM features are available to use with Amazon ECR. To get a high-level view of how Amazon ECR and other AWS services work with IAM, see AWS Services That Work with IAM in the IAM User Guide.\n\n **Topics**\n\n * Amazon ECR Identity-Based Policies\n* Amazon ECR Resource-Based Policies\n* Authorization Based on Amazon ECR Tags\n* Amazon ECR IAM Roles\n\n **Amazon ECR Identity-Based Policies**\n\n With IAM identity-based policies, you can specify allowed or denied actions and resources as well as the conditions under which actions are allowed or denied. Amazon ECR supports specific actions, resources, and condition keys. To learn about all of the elements that you use in a JSON policy, see IAM JSON Policy Elements Reference in the IAM User Guide.\n\n **Actions**\nThe Action element of an IAM identity-based policy describes the specific action or actions that will be allowed or denied by the policy. Policy actions usually have the same name as the associated AWS API operation. The action is used in a policy to grant permissions to perform the associated operation.\n\n Policy actions in Amazon ECR use the following prefix before the action: ecr:. For example, to grant someone permission to create an Amazon ECR repository with the Amazon ECR CreateRepository API operation, you include the ecr:CreateRepository action in their policy. Policy statements must include either an Action or NotAction element. Amazon ECR defines its own set of actions that describe tasks that you can perform with this service.\n\n To specify multiple actions in a single statement, separate them with commas as follows:\n\n `\"Action\": [ \"ecr:action1\", \"ecr:action2\"`\n\n You can specify multiple actions using wildcards (\\*). For example, to specify all actions that begin with the word Describe, include the following action:\n\n `\"Action\": \"ecr:Describe*\"`\n\n To see a list of Amazon ECR actions, see Actions, Resources, and Condition Keys for Amazon Elastic Container Registry in the IAM User Guide.\n\n **Resources**\nThe Resource element specifies the object or objects to which the action applies. Statements must include either a Resource or a NotResource element. You specify a resource using an ARN or using the wildcard (\\*) to indicate that the statement applies to all resources.\n\n An Amazon ECR repository resource has the following ARN:\n\n `arn:${Partition}:ecr:${Region}:${Account}:repository/${Repository-name}`\n\n For more information about the format of ARNs, see Amazon Resource Names (ARNs) and AWS Service Namespaces.\n\n For example, to specify the my-repo repository in the us-east-1 Region in your statement, use the following ARN:\n\n `\"Resource\": \"arn:aws:ecr:us-east-1:123456789012:repository/my-repo\"`\n\n To specify all repositories that belong to a specific account, use the wildcard (\\*):\n\n `\"Resource\": \"arn:aws:ecr:us-east-1:123456789012:repository/*\"`\n\n To specify multiple resources in a single statement, separate the ARNs with commas.\n\n `\"Resource\": [ \"resource1\", \"resource2\"`\n\n To see a list of Amazon ECR resource types and their ARNs, see Resources Defined by Amazon Elastic Container Registry in the IAM User Guide. To learn with which actions you can specify the ARN of each resource, see Actions Defined by Amazon Elastic Container Registry.\n\n **Condition Keys**\nThe Condition element (or Condition block) lets you specify conditions in which a statement is in effect. The Condition element is optional. You can build conditional expressions that use condition operators, such as equals or less than, to match the condition in the policy with values in the request.\n\n If you specify multiple Condition elements in a statement, or multiple keys in a single Condition element, AWS evaluates them using a logical AND operation. If you specify multiple values for a single condition key, AWS evaluates the condition using a logical OR operation. All of the conditions must be met before the statement's permissions are granted.\n\n You can also use placeholder variables when you specify conditions. For example, you can grant an IAM user permission to access a resource only if it is tagged with their IAM user name. For more information, see IAM Policy Elements: Variables and Tags in the IAM User Guide.\n\n Amazon ECR defines its own set of condition keys and also supports using some global condition keys. To see all AWS global condition keys, see AWS Global Condition Context Keys in the IAM User Guide.\n\n Most Amazon ECR actions support the aws:ResourceTag and ecr:ResourceTag condition keys. For more information, see Using Tag-Based Access Control.\n\n To see a list of Amazon ECR condition keys, see Condition Keys Defined by Amazon Elastic Container Registry in the IAM User Guide. To learn with which actions and resources you can use a condition key, see Actions Defined by Amazon Elastic Container Registry.",
        "manual_test": "",
        "references": [
            "https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning.html#scanning-repository"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-aws-policies-are-present"
        ],
        "baseScore": 6,
        "impact_statement": "Care should be taken not to remove access to Amazon ECR for accounts that require this for their operation.",
        "default_value": "",
        "scanningScope": {
            "matches": [
                "EKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0172",
        "name": "Ensure that the --anonymous-auth argument is set to false",
        "description": "Disable anonymous requests to the Kubelet server.",
        "long_description": "When enabled, requests that are not rejected by other configured authentication methods are treated as anonymous requests. These requests are then served by the Kubelet server. You should rely on authentication to authorize access and disallow anonymous requests.",
        "remediation": "If using a Kubelet config file, edit the file to set `authentication: anonymous: enabled` to `false`.\n\n If using executable arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the below parameter in `KUBELET_SYSTEM_PODS_ARGS` variable.\n\n \n```\n--anonymous-auth=false\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```",
        "manual_test": "If using a Kubelet configuration file, check that there is an entry for `authentication: anonymous: enabled` set to `false`.\n\n Run the following command on each node:\n\n \n```\nps -ef | grep kubelet\n\n```\n Verify that the `--anonymous-auth` argument is set to `false`.\n\n This executable argument may be omitted, provided there is a corresponding entry set to `false` in the Kubelet config file.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126668/recommendations/1838638"
        ],
        "attributes": {},
        "rulesNames": [
            "anonymous-requests-to-kubelet-service-updated"
        ],
        "baseScore": 7,
        "impact_statement": "Anonymous requests will be rejected.",
        "default_value": "By default, anonymous access is enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0148",
        "name": "Ensure that the Controller Manager --root-ca-file argument is set as appropriate",
        "description": "Allow pods to verify the API server's serving certificate before establishing connections.",
        "long_description": "Processes running within pods that need to contact the API server must verify the API server's serving certificate. Failing to do so could be a subject to man-in-the-middle attacks.\n\n Providing the root certificate for the API server's serving certificate to the controller manager with the `--root-ca-file` argument allows the controller manager to inject the trusted bundle into pods so that they can verify TLS connections to the API server.",
        "remediation": "Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node and set the `--root-ca-file` parameter to the certificate bundle file`.\n\n \n```\n--root-ca-file=<path/to/file>\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-controller-manager\n\n```\n Verify that the `--root-ca-file` argument exists and is set to a certificate bundle file containing the root certificate for the API server's serving certificate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126669/recommendations/1838681"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-controller-manager-root-ca-file-argument-is-set-as-appropriate"
        ],
        "baseScore": 7,
        "impact_statement": "You need to setup and maintain root certificate authority file.",
        "default_value": "By default, `--root-ca-file` is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Automatic mapping of service account",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance",
                "smartRemediation"
            ]
        },
        "description": "Potential attacker may gain access to a pod and steal its service account token. Therefore, it is recommended to disable automatic mapping of the service account tokens in service account configuration and enable it only for pods that need to use them.",
        "remediation": "Disable automatic mounting of service account tokens to pods either at the service account level or at the individual pod level, by specifying the automountServiceAccountToken: false. Note that pod level takes precedence.",
        "rulesNames": [
            "automount-service-account"
        ],
        "long_description": "We have it in Armo best (Automatic mapping of service account token).",
        "test": "Check all service accounts on which automount is not disabled.  Check all workloads on which they and their service account don't disable automount ",
        "controlID": "C-0034",
        "baseScore": 6.0,
        "example": "@controls/examples/c034.yaml",
        "category": {
            "name": "Secrets",
            "id": "Cat-3"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0173",
        "name": "Ensure that the --authorization-mode argument is not set to AlwaysAllow",
        "description": "Do not allow all requests. Enable explicit authorization.",
        "long_description": "Kubelets, by default, allow all authenticated requests (even anonymous ones) without needing explicit authorization checks from the apiserver. You should restrict this behavior and only allow explicitly authorized requests.",
        "remediation": "If using a Kubelet config file, edit the file to set `authorization: mode` to `Webhook`.\n\n If using executable arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the below parameter in `KUBELET_AUTHZ_ARGS` variable.\n\n \n```\n--authorization-mode=Webhook\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```",
        "manual_test": "Run the following command on each node:\n\n \n```\nps -ef | grep kubelet\n\n```\n If the `--authorization-mode` argument is present check that it is not set to `AlwaysAllow`. If it is not present check that there is a Kubelet config file specified by `--config`, and that file sets `authorization: mode` to something other than `AlwaysAllow`.\n\n It is also possible to review the running configuration of a Kubelet via the `/configz` endpoint on the Kubelet API port (typically `10250/TCP`). Accessing these with appropriate credentials will provide details of the Kubelet's configuration.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126668/recommendations/1838640"
        ],
        "attributes": {},
        "rulesNames": [
            "kubelet-authorization-mode-alwaysAllow"
        ],
        "baseScore": 6,
        "impact_statement": "Unauthorized requests will be denied.",
        "default_value": "By default, `--authorization-mode` argument is set to `AlwaysAllow`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0249",
        "name": "Restrict untrusted workloads",
        "description": "Restricting unstrusted workloads can be achieved by using ACI along with AKS.\n\n What is ACI?\nACI lets you quickly deploy container instances without additional infrastructure overhead. When you connect with AKS, ACI becomes a secured, logical extension of your AKS cluster. The virtual nodes component, which is based on Virtual Kubelet, is installed in your AKS cluster that presents ACI as a virtual Kubernetes node. Kubernetes can then schedule pods that run as ACI instances through virtual nodes, not as pods on VM nodes directly in your AKS cluster.\n\n Your application requires no modification to use virtual nodes. Deployments can scale across AKS and ACI and with no delay as cluster autoscaler deploys new nodes in your AKS cluster.\n\n Virtual nodes are deployed to an additional subnet in the same virtual network as your AKS cluster. This virtual network configuration allows the traffic between ACI and AKS to be secured. Like an AKS cluster, an ACI instance is a secure, logical compute resource that is isolated from other users.",
        "long_description": "It is Best Practice to restrict or fence untrusted workloads when running in a multi-tenant environment. Azure Container Instances is a great solution for any scenario that can operate in isolated containers, including simple applications, task automation, and build jobs.",
        "remediation": "",
        "manual_test": "",
        "references": [
            "<https://docs.microsoft.com/en-us/azure/aks/operator-best-practices-cluster-isolation>\n\n  <https://azure.microsoft.com/en-us/blog/azure-container-instances-now-generally-available/>\n\n  <https://azure.microsoft.com/en-us/resources/videos/ignite-2018-run-a-serverless-kubernetes-cluster-by-bridging-aks-and-aci-through-the-virtual-kubelet/>"
        ],
        "attributes": {
            "actionRequired": "manual review"
        },
        "rulesNames": [
            "rule-manual"
        ],
        "baseScore": 5,
        "impact_statement": "",
        "default_value": "ACI is not a default component of the AKS",
        "scanningScope": {
            "matches": [
                "AKS"
            ]
        },
        "rules": []
    },
    {
        "name": "Ensure memory limits are set",
        "attributes": {
            "controlTypeTags": [
                "compliance",
                "devops",
                "security"
            ],
            "attackTracks": [
                {
                    "attackTrack": "service-destruction",
                    "categories": [
                        "Denial of service"
                    ]
                }
            ]
        },
        "description": "This control identifies all Pods for which the memory limits are not set.",
        "remediation": "Set the memory limits or use exception mechanism to avoid unnecessary notifications.",
        "rulesNames": [
            "resources-memory-limits"
        ],
        "controlID": "C-0271",
        "baseScore": 8.0,
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Resource management",
                "id": "Cat-7"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0100",
        "name": "Ensure that the Container Network Interface file permissions are set to 600 or more restrictive",
        "description": "Ensure that the Container Network Interface files have permissions of `600` or more restrictive.",
        "long_description": "Container Network Interface provides various networking options for overlay networking. You should consult their documentation and restrict their respective file permissions to maintain the integrity of those files. Those files should be writable by only the administrators on the system.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 <path/to/cni/files>\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %a <path/to/cni/files>\n\n```\n Verify that the permissions are `600` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838574"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-Container-Network-Interface-file-permissions-are-set-to-600-or-more-restrictive"
        ],
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "NA",
        "category": {
            "name": "Network",
            "id": "Cat-4"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0139",
        "name": "Ensure that the API Server --client-ca-file argument is set as appropriate",
        "description": "Setup TLS connection on the API server.",
        "long_description": "API server communication contains sensitive parameters that should remain encrypted in transit. Configure the API server to serve only HTTPS traffic. If `--client-ca-file` argument is set, any request presenting a client certificate signed by one of the authorities in the `client-ca-file` is authenticated with an identity corresponding to the CommonName of the client certificate.",
        "remediation": "Follow the Kubernetes documentation and set up the TLS connection on the apiserver. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and set the client certificate authority file.\n\n \n```\n--client-ca-file=<path/to/client-ca-file>\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--client-ca-file` argument exists and it is set as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838672"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-client-ca-file-argument-is-set-as-appropriate"
        ],
        "baseScore": 8,
        "impact_statement": "TLS and client certificate authentication must be configured for your Kubernetes cluster deployment.",
        "default_value": "By default, `--client-ca-file` argument is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0202",
        "name": "Minimize the admission of Windows HostProcess Containers",
        "description": "Do not generally permit Windows containers to be run with the `hostProcess` flag set to true.",
        "long_description": "A Windows container making use of the `hostProcess` flag can interact with the underlying Windows cluster node. As per the Kubernetes documentation, this provides \"privileged access\" to the Windows node.\n\n Where Windows containers are used inside a Kubernetes cluster, there should be at least one admission control policy which does not permit `hostProcess` Windows containers.\n\n If you need to run Windows containers which require `hostProcess`, this should be defined in a separate policy and you should carefully check to ensure that only limited service accounts and users are given permission to use that policy.",
        "remediation": "Add policies to each namespace in the cluster which has user workloads to restrict the admission of `hostProcess` containers.",
        "manual_test": "List the policies in use for each namespace in the cluster, ensure that each policy disallows the admission of `hostProcess` containers",
        "references": [
            "https://workbench.cisecurity.org/sections/1126662/recommendations/1838623"
        ],
        "attributes": {},
        "rulesNames": [
            "pod-security-admission-baseline-applied-1",
            "pod-security-admission-baseline-applied-2"
        ],
        "baseScore": 7,
        "impact_statement": "Pods defined with `securityContext.windowsOptions.hostProcess: true` will not be permitted unless they are run under a specific policy.",
        "default_value": "By default, there are no restrictions on the creation of `hostProcess` containers.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0193",
        "name": "Minimize the admission of privileged containers",
        "description": "Do not generally permit containers to be run with the `securityContext.privileged` flag set to `true`.",
        "long_description": "Privileged containers have access to all Linux Kernel capabilities and devices. A container running with full privileges can do almost everything that the host can do. This flag exists to allow special use-cases, like manipulating the network stack and accessing devices.\n\n There should be at least one admission control policy defined which does not permit privileged containers.\n\n If you need to run privileged containers, this should be defined in a separate policy and you should carefully check to ensure that only limited service accounts and users are given permission to use that policy.",
        "remediation": "Add policies to each namespace in the cluster which has user workloads to restrict the admission of privileged containers.",
        "manual_test": "List the policies in use for each namespace in the cluster, ensure that each policy disallows the admission of privileged containers.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126662/recommendations/1838601"
        ],
        "attributes": {},
        "rulesNames": [
            "pod-security-admission-baseline-applied-1",
            "pod-security-admission-baseline-applied-2"
        ],
        "baseScore": 8,
        "impact_statement": "Pods defined with `spec.containers[].securityContext.privileged: true`, `spec.initContainers[].securityContext.privileged: true` and `spec.ephemeralContainers[].securityContext.privileged: true` will not be permitted.",
        "default_value": "By default, there are no restrictions on the creation of privileged containers.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0110",
        "name": "Ensure that the Kubernetes PKI directory and file ownership is set to root:root",
        "description": "Ensure that the Kubernetes PKI directory and file ownership is set to `root:root`.",
        "long_description": "Kubernetes makes use of a number of certificates as part of its operation. You should set the ownership of the directory containing the PKI information and all files in that directory to maintain their integrity. The directory and files should be owned by `root:root`.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown -R root:root /etc/kubernetes/pki/\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nls -laR /etc/kubernetes/pki/\n\n```\n Verify that the ownership of all files and directories in this hierarchy is set to `root:root`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838604"
        ],
        "rulesNames": [
            "ensure-that-the-Kubernetes-PKI-directory-and-file-ownership-is-set-to-root-root"
        ],
        "attributes": {},
        "baseScore": 8,
        "impact_statement": "None",
        "default_value": "By default, the /etc/kubernetes/pki/ directory and all of the files and directories contained within it, are set to be owned by the root user.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0214",
        "name": "Minimize the admission of containers wishing to share the host process ID namespace",
        "description": "Do not generally permit containers to be run with the `hostPID` flag set to true.",
        "long_description": "A container running in the host's PID namespace can inspect processes running outside the container. If the container also has access to ptrace capabilities this can be used to escalate privileges outside of the container.\n\n There should be at least one PodSecurityPolicy (PSP) defined which does not permit containers to share the host PID namespace.\n\n If you need to run containers which require hostPID, this should be defined in a separate PSP and you should carefully check RBAC controls to ensure that only limited service accounts and users are given permission to access that PSP.",
        "remediation": "Create a PSP as described in the Kubernetes documentation, ensuring that the `.spec.hostPID` field is omitted or set to false.",
        "manual_test": "Get the set of PSPs with the following command:\n\n \n```\nkubectl get psp\n\n```\n For each PSP, check whether privileged is enabled:\n\n \n```\nkubectl get psp <name> -o=jsonpath='{.spec.hostPID}'\n\n```\n Verify that there is at least one PSP which does not return true.",
        "references": [
            "https://kubernetes.io/docs/concepts/policy/pod-security-policy"
        ],
        "attributes": {},
        "rulesNames": [
            "psp-deny-hostpid"
        ],
        "baseScore": 5.0,
        "impact_statement": "Pods defined with `spec.hostPID: true` will not be permitted unless they are run under a specific PSP.",
        "default_value": "By default, PodSecurityPolicies are not defined.",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0130",
        "name": "Ensure that the API Server --audit-log-path argument is set",
        "description": "Enable auditing on the Kubernetes API Server and set the desired audit log path.",
        "long_description": "Auditing the Kubernetes API Server provides a security-relevant chronological set of records documenting the sequence of activities that have affected system by individual users, administrators or other components of the system. Even though currently, Kubernetes provides only basic audit capabilities, it should be enabled. You can enable it by setting an appropriate audit log path.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--audit-log-path` parameter to a suitable path and file where you would like audit logs to be written, for example:\n\n \n```\n--audit-log-path=/var/log/apiserver/audit.log\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--audit-log-path` argument is set as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838662"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-audit-log-path-argument-is-set"
        ],
        "baseScore": 7,
        "impact_statement": "None",
        "default_value": "By default, auditing is not enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0145",
        "name": "Ensure that the Controller Manager --profiling argument is set to false",
        "description": "Disable profiling, if not needed.",
        "long_description": "Profiling allows for the identification of specific performance bottlenecks. It generates a significant amount of program data that could potentially be exploited to uncover system and program details. If you are not experiencing any bottlenecks and do not need the profiler for troubleshooting purposes, it is recommended to turn it off to reduce the potential attack surface.",
        "remediation": "Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node and set the below parameter.\n\n \n```\n--profiling=false\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-controller-manager\n\n```\n Verify that the `--profiling` argument is set to `false`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126669/recommendations/1838678"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-controller-manager-profiling-argument-is-set-to-false"
        ],
        "baseScore": 3,
        "impact_statement": "Profiling information would not be available.",
        "default_value": "By default, profiling is enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0251",
        "name": "Minimize user access to Azure Container Registry (ACR)",
        "description": "Restrict user access to Azure Container Registry (ACR), limiting interaction with build images to only authorized personnel and service accounts.",
        "long_description": "Weak access control to Azure Container Registry (ACR) may allow malicious users to replace built images with vulnerable containers.",
        "remediation": "Azure Container Registry\nIf you use Azure Container Registry (ACR) as your container image store, you need to grant permissions to the service principal for your AKS cluster to read and pull images. Currently, the recommended configuration is to use the az aks create or az aks update command to integrate with a registry and assign the appropriate role for the service principal. For detailed steps, see Authenticate with Azure Container Registry from Azure Kubernetes Service.\n\n To avoid needing an Owner or Azure account administrator role, you can configure a service principal manually or use an existing service principal to authenticate ACR from AKS. For more information, see ACR authentication with service principals or Authenticate from Kubernetes with a pull secret.",
        "manual_test": "",
        "references": [
            "<https://docs.microsoft.com/security/benchmark/azure/security-controls-v2-privileged-access#pa-7-follow-just-enough-administration-least-privilege-principle>"
        ],
        "attributes": {},
        "rulesNames": [
            "list-role-definitions-in-acr"
        ],
        "baseScore": 6,
        "impact_statement": "Care should be taken not to remove access to Azure ACR for accounts that require this for their operation.",
        "default_value": "",
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0283",
        "name": "Ensure that the API Server --DenyServiceExternalIPs is set",
        "description": "This admission controller rejects all net-new usage of the Service field externalIPs.",
        "long_description": "This admission controller rejects all net-new usage of the Service field externalIPs. This feature is very powerful (allows network traffic interception) and not well controlled by policy. When enabled, users of the cluster may not create new Services which use externalIPs and may not add new values to externalIPs on existing Service objects. Existing uses of externalIPs are not affected, and users may remove values from externalIPs on existing Service objects.\n\n Most users do not need this feature at all, and cluster admins should consider disabling it. Clusters that do need to use this feature should consider using some custom policy to manage usage of it.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and add the `--enable-admission-plugins=DenyServiceExternalIPs` parameter\n\n or\n\n The Kubernetes API server flag disable-admission-plugins takes a comma-delimited list of admission control plugins to be disabled, even if they are in the list of plugins enabled by default.\n\n `kube-apiserver --disable-admission-plugins=DenyServiceExternalIPs,AlwaysDeny ...`",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--enable-admission-plugins=DenyServiceExternalIPs argument exists.",
        "references": [
            "https://workbench.cisecurity.org/sections/2633389/recommendations/4261958"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-DenyServiceExternalIPs-is-set"
        ],
        "baseScore": 4,
        "impact_statement": "When not enabled, users of the cluster may create new Services which use externalIPs and may add new values to externalIPs on existing Service objects.",
        "default_value": "By default, `--enable-admission-plugins=DenyServiceExternalIPs` argument is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0254",
        "name": "Enable audit Logs",
        "description": "With Azure Kubernetes Service (AKS), the control plane components such as the kube-apiserver and kube-controller-manager are provided as a managed service. You create and manage the nodes that run the kubelet and container runtime, and deploy your applications through the managed Kubernetes API server. To help troubleshoot your application and services, you may need to view the logs generated by these control plane components.\n\n To help collect and review data from multiple sources, Azure Monitor logs provides a query language and analytics engine that provides insights to your environment. A workspace is used to collate and analyze the data, and can integrate with other Azure services such as Application Insights and Security Center.",
        "long_description": "Exporting logs and metrics to a dedicated, persistent datastore ensures availability of audit data following a cluster security event, and provides a central location for analysis of log and metric data collated from multiple sources.",
        "remediation": "Azure audit logs are enabled and managed in the Azure portal. To enable log collection for the Kubernetes master components in your AKS cluster, open the Azure portal in a web browser and complete the following steps:\n\n 1. Select the resource group for your AKS cluster, such as myResourceGroup. Don't select the resource group that contains your individual AKS cluster resources, such as MC\\_myResourceGroup\\_myAKSCluster\\_eastus.\n2. On the left-hand side, choose Diagnostic settings.\n3. Select your AKS cluster, such as myAKSCluster, then choose to Add diagnostic setting.\n4. Enter a name, such as myAKSClusterLogs, then select the option to Send to Log Analytics.\n5. Select an existing workspace or create a new one. If you create a workspace, provide a workspace name, a resource group, and a location.\n6. In the list of available logs, select the logs you wish to enable. For this example, enable the kube-audit and kube-audit-admin logs. Common logs include the kube-apiserver, kube-controller-manager, and kube-scheduler. You can return and change the collected logs once Log Analytics workspaces are enabled.\n7. When ready, select Save to enable collection of the selected logs.",
        "manual_test": "",
        "references": [
            "<https://kubernetes.io/docs/tasks/debug-application-cluster/audit/>\n\n  <https://docs.microsoft.com/en-us/azure/aks/view-master-logs>\n\n  <https://docs.microsoft.com/security/benchmark/azure/security-controls-v2-logging-threat-detection#lt-4-enable-logging-for-azure-resources>"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-manual"
        ],
        "baseScore": 5,
        "impact_statement": "What is collected from Kubernetes clusters\nContainer insights includes a predefined set of metrics and inventory items collected that are written as log data in your Log Analytics workspace. All metrics listed below are collected by default every one minute.\n\n Node metrics collected\nThe following list is the 24 metrics per node that are collected:\n\n cpuUsageNanoCores\ncpuCapacityNanoCores\ncpuAllocatableNanoCores\nmemoryRssBytes\nmemoryWorkingSetBytes\nmemoryCapacityBytes\nmemoryAllocatableBytes\nrestartTimeEpoch\nused (disk)\nfree (disk)\nused\\_percent (disk)\nio\\_time (diskio)\nwrites (diskio)\nreads (diskio)\nwrite\\_bytes (diskio)\nwrite\\_time (diskio)\niops\\_in\\_progress (diskio)\nread\\_bytes (diskio)\nread\\_time (diskio)\nerr\\_in (net)\nerr\\_out (net)\nbytes\\_recv (net)\nbytes\\_sent (net)\nKubelet\\_docker\\_operations (kubelet)\nContainer metrics\nThe following list is the eight metrics per container collected:\n\n cpuUsageNanoCores\ncpuRequestNanoCores\ncpuLimitNanoCores\nmemoryRssBytes\nmemoryWorkingSetBytes\nmemoryRequestBytes\nmemoryLimitBytes\nrestartTimeEpoch\nCluster inventory\nThe following list is the cluster inventory data collected by default:\n\n KubePodInventory \u2013 1 per minute per container\nKubeNodeInventory \u2013 1 per node per minute\nKubeServices \u2013 1 per service per minute\nContainerInventory \u2013 1 per container per minute",
        "default_value": "By default, cluster control plane logs aren't sent to be Logged.",
        "scanningScope": {
            "matches": [
                "AKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0262",
        "name": "Anonymous user has RoleBinding",
        "description": "Granting permissions to the system:unauthenticated or system:anonymous user is generally not recommended and can introduce security risks. Allowing unauthenticated access to your Kubernetes cluster can lead to unauthorized access, potential data breaches, and abuse of cluster resources.",
        "remediation": "Review and modify your cluster's RBAC configuration to ensure that only authenticated and authorized users have appropriate permissions based on their roles and responsibilities within your system.",
        "test": "Checks if ClusterRoleBinding/RoleBinding resources give permissions to anonymous user. Also checks in the apiserver if the --anonymous-auth flag is set to false",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "rulesNames": [
            "anonymous-access-enabled"
        ],
        "baseScore": 7,
        "category": {
            "name": "Control plane",
            "subCategory": {
                "name": "Supply chain",
                "id": "Cat-6"
            },
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0198",
        "name": "Minimize the admission of root containers",
        "description": "Do not generally permit containers to be run as the root user.",
        "long_description": "Containers may run as any Linux user. Containers which run as the root user, whilst constrained by Container Runtime security features still have a escalated likelihood of container breakout.\n\n Ideally, all containers should run as a defined non-UID 0 user.\n\n There should be at least one admission control policy defined which does not permit root containers.\n\n If you need to run root containers, this should be defined in a separate policy and you should carefully check to ensure that only limited service accounts and users are given permission to use that policy.",
        "remediation": "Create a policy for each namespace in the cluster, ensuring that either `MustRunAsNonRoot` or `MustRunAs` with the range of UIDs not including 0, is set.",
        "manual_test": "List the policies in use for each namespace in the cluster, ensure that each policy restricts the use of root containers by setting `MustRunAsNonRoot` or `MustRunAs` with the range of UIDs not including 0.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126662/recommendations/1838615"
        ],
        "attributes": {},
        "rulesNames": [
            "pod-security-admission-restricted-applied-1",
            "pod-security-admission-restricted-applied-2"
        ],
        "baseScore": 6,
        "impact_statement": "Pods with containers which run as the root user will not be permitted.",
        "default_value": "By default, there are no restrictions on the use of root containers and if a User is not specified in the image, the container will run as root.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0166",
        "name": "Ensure that the --kubeconfig kubelet.conf file permissions are set to 600 or more restrictive",
        "description": "Ensure that the `kubelet.conf` file has permissions of `600` or more restrictive.",
        "long_description": "The `kubelet.conf` file is the kubeconfig file for the node, and controls various parameters that set the behavior and identity of the worker node. You should restrict its file permissions to maintain the integrity of the file. The file should be writable by only the administrators on the system.",
        "remediation": "Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/kubelet.conf\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nstat -c %a /etc/kubernetes/kubelet.conf\n\n```\n Verify that the ownership is set to `root:root`.Verify that the permissions are `600` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126659/recommendations/1838607"
        ],
        "rulesNames": [
            "ensure-that-the-kubeconfig-kubelet.conf-file-permissions-are-set-to-600-or-more-restrictive"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `kubelet.conf` file has permissions of `600`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Disable anonymous access to Kubelet service",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "By default, requests to the kubelet's HTTPS endpoint that are not rejected by other configured authentication methods are treated as anonymous requests, and given a username of system:anonymous and a group of system:unauthenticated.",
        "remediation": "Start the kubelet with the --anonymous-auth=false flag.",
        "rulesNames": [
            "anonymous-requests-to-kubelet-service-updated"
        ],
        "long_description": "By default, requests to the kubelet's HTTPS endpoint that are not rejected by other configured authentication methods are treated as anonymous requests, and given a username of system:anonymous and a group of system:unauthenticated.",
        "test": "Reading the kubelet command lines and configuration file looking for anonymous-auth configuration. If this configuration is set on both, the command line values take precedence over it.",
        "controlID": "C-0069",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "baseScore": 10.0,
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Images from allowed registry",
        "attributes": {
            "actionRequired": "configuration",
            "microsoftMitreColumns": [
                "Collection"
            ],
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "This control is intended to ensure that all the used container images are taken from the authorized repositories. It allows user to list all the approved repositories and will fail all the images taken from any repository outside of this list.",
        "remediation": "You should enable all trusted repositories in the parameters of this control.",
        "rulesNames": [
            "container-image-repository",
            "container-image-repository-v1"
        ],
        "long_description": "If attackers get access to the cluster, they can re-point kubernetes to a compromized container repository. This control is intended to ensure that all the container images are taken from the authorized repositories only. User should list all the approved repositories in the parameters of this control so that any potential dangerous image can be identified.",
        "test": "Checks if image is from allowed listed registry.",
        "controlID": "C-0078",
        "baseScore": 5.0,
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Supply chain",
                "id": "Cat-6"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Naked pods",
        "attributes": {
            "controlTypeTags": [
                "devops"
            ]
        },
        "description": "It is not recommended to create pods without parental Deployment, ReplicaSet, StatefulSet etc.Manual creation if pods may lead to a configuration drifts and other untracked changes in the system. Such pods won't be automatically rescheduled by Kubernetes in case of a crash or infrastructure failure. This control identifies every pod that does not have corresponding parental object.",
        "remediation": "Create necessary Deployment object for every pod making any pod a first class citizen in your IaC architecture.",
        "rulesNames": [
            "naked-pods"
        ],
        "long_description": "It is not recommended to create pods without parental Deployment, ReplicaSet, StatefulSet etc.Manual creation if pods may lead to a configuration drifts and other untracked changes in the system. Such pods won't be automatically rescheduled by Kubernetes in case of a crash or infrastructure failure. This control identifies every pod that does not have corresponding parental object.",
        "test": "Test if pods are not associated with Deployment, ReplicaSet etc. If not, fail.",
        "controlID": "C-0073",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "baseScore": 3.0,
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0231",
        "name": "Encrypt traffic to HTTPS load balancers with TLS certificates",
        "description": "Encrypt traffic to HTTPS load balancers using TLS certificates.",
        "long_description": "Encrypting traffic between users and your Kubernetes workload is fundamental to protecting data sent over the web.",
        "remediation": "",
        "manual_test": "",
        "references": [
            "https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/data-protection.html"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-https-loadbalancers-encrypted-with-tls-aws"
        ],
        "baseScore": 5.0,
        "impact_statement": "",
        "default_value": "",
        "scanningScope": {
            "matches": [
                "EKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0219",
        "name": "Minimize the admission of containers with added capabilities",
        "description": "Do not generally permit containers with capabilities assigned beyond the default set.",
        "long_description": "Containers run with a default set of capabilities as assigned by the Container Runtime. Capabilities outside this set can be added to containers which could expose them to risks of container breakout attacks.\n\n There should be at least one PodSecurityPolicy (PSP) defined which prevents containers with capabilities beyond the default set from launching.\n\n If you need to run containers with additional capabilities, this should be defined in a separate PSP and you should carefully check RBAC controls to ensure that only limited service accounts and users are given permission to access that PSP.",
        "remediation": "Ensure that `allowedCapabilities` is not present in PSPs for the cluster unless it is set to an empty array.",
        "manual_test": "Get the set of PSPs with the following command:\n\n \n```\nkubectl get psp\n\n```\n Verify that there are no PSPs present which have `allowedCapabilities` set to anything other than an empty array.",
        "references": [
            "https://kubernetes.io/docs/concepts/policy/pod-security-policy/#enabling-pod-security-policies",
            "https://www.nccgroup.trust/uk/our-research/abusing-privileged-and-unprivileged-linux-containers/"
        ],
        "attributes": {},
        "rulesNames": [
            "psp-deny-allowed-capabilities"
        ],
        "baseScore": 5.0,
        "impact_statement": "Pods with containers which require capabilities outwith the default set will not be permitted.",
        "default_value": "By default, PodSecurityPolicies are not defined. If a PSP is created 'allowedCapabilities' is set by default.",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Portforwarding privileges",
        "attributes": {
            "rbacQuery": "Port Forwarding",
            "controlTypeTags": [
                "security-impact",
                "compliance"
            ]
        },
        "description": "Attackers with relevant RBAC permission can use \u201ckubectl portforward\u201d command to establish direct communication with pods from within the cluster or even remotely. Such communication will most likely bypass existing security measures in the cluster. This control determines which subjects have permissions to use this command.",
        "remediation": "It is recommended to prohibit \u201ckubectl portforward\u201d command in production environments. It is also recommended not to use subjects with this permission for daily cluster operations.",
        "rulesNames": [
            "rule-can-portforward-v1"
        ],
        "long_description": "Attackers who have relevant RBAC permissions, can run open a backdoor communication channel directly to the sockets inside target container using exec command \u201ckubectl portforward\u201d command. Using this method, attackers can bypass network security restrictions and communicate directly with software in the containers.",
        "test": "Check which subjects have RBAC permissions to portforward into pods\u2013 if they have the \u201cpods/portforward\u201d resource.",
        "controlID": "C-0063",
        "baseScore": 5.0,
        "example": "@controls/examples/c063.yaml",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Minimize access to create pods",
        "controlID": "C-0188",
        "description": "The ability to create pods in a namespace can provide a number of opportunities for privilege escalation, such as assigning privileged service accounts to these pods or mounting hostPaths with access to sensitive data (unless Pod Security Policies are implemented to restrict this access)\n\n As such, access to create new pods should be restricted to the smallest possible group of users.",
        "long_description": "The ability to create pods in a cluster opens up possibilities for privilege escalation and should be restricted, where possible.",
        "remediation": "Where possible, remove `create` access to `pod` objects in the cluster.",
        "manual_test": "Review the users who have create access to pod objects in the Kubernetes API.",
        "test": "Check which subjects have RBAC permissions to create pods.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126661/recommendations/1838592"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-can-create-pod"
        ],
        "baseScore": 5,
        "impact_statement": "Care should be taken not to remove access to pods to system components which require this for their operation",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "default_value": "By default in a kubeadm cluster the following list of principals have `create` privileges on `pod` objects ```CLUSTERROLEBINDING                                    SUBJECT                             TYPE            SA-NAMESPACEcluster-admin                                         system:masters                      Group           system:controller:clusterrole-aggregation-controller  clusterrole-aggregation-controller  ServiceAccount  kube-systemsystem:controller:daemon-set-controller               daemon-set-controller               ServiceAccount  kube-systemsystem:controller:job-controller                      job-controller                      ServiceAccount  kube-systemsystem:controller:persistent-volume-binder            persistent-volume-binder            ServiceAccount  kube-systemsystem:controller:replicaset-controller               replicaset-controller               ServiceAccount  kube-systemsystem:controller:replication-controller              replication-controller              ServiceAccount  kube-systemsystem:controller:statefulset-controller              statefulset-controller              ServiceAccount  kube-system```",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Ensure that all Namespaces have Network Policies defined",
        "controlID": "C-0206",
        "description": "Use network policies to isolate traffic in your cluster network.",
        "long_description": "Running different applications on the same Kubernetes cluster creates a risk of one compromised application attacking a neighboring application. Network segmentation is important to ensure that containers can communicate only with those they are supposed to. A network policy is a specification of how selections of pods are allowed to communicate with each other and other network endpoints.\n\n Network Policies are namespace scoped. When a network policy is introduced to a given namespace, all traffic not allowed by the policy is denied. However, if there are no network policies in a namespace all traffic will be allowed into and out of the pods in that namespace.",
        "remediation": "Follow the documentation and create `NetworkPolicy` objects as you need them.",
        "manual_test": "Run the below command and review the `NetworkPolicy` objects created in the cluster.\n\n \n```\nkubectl --all-namespaces get networkpolicy\n\n```\n Ensure that each namespace defined in the cluster has at least one Network Policy.",
        "test": "Check for each namespace if there is a network policy defined.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126664/recommendations/1838628"
        ],
        "attributes": {},
        "rulesNames": [
            "internal-networking"
        ],
        "baseScore": 4,
        "impact_statement": "Once network policies are in use within a given namespace, traffic not explicitly allowed by a network policy will be denied. As such it is important to ensure that, when introducing network policies, legitimate traffic is not blocked.",
        "default_value": "By default, network policies are not created.",
        "category": {
            "name": "Network",
            "id": "Cat-4"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Container runtime socket mounted",
        "attributes": {
            "controlTypeTags": [
                "devops",
                "smartRemediation"
            ]
        },
        "description": "Mounting Container runtime socket (Unix socket) enables container to access Container runtime, retrieve sensitive information and execute commands, if Container runtime is available. This control identifies pods that attempt to mount Container runtime socket for accessing Container runtime.",
        "remediation": "Remove container runtime socket mount request or define an exception.",
        "rulesNames": [
            "containers-mounting-docker-socket"
        ],
        "long_description": "Mounting Docker socket (Unix socket) enables container to access Docker internals, retrieve sensitive information and execute Docker commands, if Docker runtime is available. This control identifies pods that attempt to mount Docker socket for accessing Docker runtime.",
        "test": "Check hostpath. If the path is set to one of the container runtime socket, the container has access to container runtime - fail.",
        "controlID": "C-0074",
        "baseScore": 5.0,
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0179",
        "name": "Ensure that the --hostname-override argument is not set",
        "description": "Do not override node hostnames.",
        "long_description": "Overriding hostnames could potentially break TLS setup between the kubelet and the apiserver. Additionally, with overridden hostnames, it becomes increasingly difficult to associate logs with a particular node and process them for security analytics. Hence, you should setup your kubelet nodes with resolvable FQDNs and avoid overriding the hostnames with IPs.",
        "remediation": "Edit the kubelet service file `/etc/systemd/system/kubelet.service.d/10-kubeadm.conf` on each worker node and remove the `--hostname-override` argument from the `KUBELET_SYSTEM_PODS_ARGS` variable.\n\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```",
        "manual_test": "Run the following command on each node:\n\n \n```\nps -ef | grep kubelet\n\n```\n Verify that `--hostname-override` argument does not exist.\n\n **Note** This setting is not configurable via the Kubelet config file.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126668/recommendations/1838654"
        ],
        "attributes": {},
        "rulesNames": [
            "kubelet-hostname-override"
        ],
        "baseScore": 3,
        "impact_statement": "Some cloud providers may require this flag to ensure that hostname matches names issued by the cloud provider. In these environments, this recommendation should not apply.",
        "default_value": "By default, `--hostname-override` argument is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0197",
        "name": "Minimize the admission of containers with allowPrivilegeEscalation",
        "description": "Do not generally permit containers to be run with the `allowPrivilegeEscalation` flag set to true. Allowing this right can lead to a process running a container getting more rights than it started with.\n\n It's important to note that these rights are still constrained by the overall container sandbox, and this setting does not relate to the use of privileged containers.",
        "long_description": "A container running with the `allowPrivilegeEscalation` flag set to `true` may have processes that can gain more privileges than their parent.\n\n There should be at least one admission control policy defined which does not permit containers to allow privilege escalation. The option exists (and is defaulted to true) to permit setuid binaries to run.\n\n If you have need to run containers which use setuid binaries or require privilege escalation, this should be defined in a separate policy and you should carefully check to ensure that only limited service accounts and users are given permission to use that policy.",
        "remediation": "Add policies to each namespace in the cluster which has user workloads to restrict the admission of conatiners with `.spec.allowPrivilegeEscalation`set to `true`.",
        "manual_test": "List the policies in use for each namespace in the cluster, ensure that each policy disallows the admission of containers which allow privilege escalation.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126662/recommendations/1838612"
        ],
        "attributes": {},
        "rulesNames": [
            "pod-security-admission-restricted-applied-1",
            "pod-security-admission-restricted-applied-2"
        ],
        "baseScore": 6,
        "impact_statement": "Pods defined with `spec.allowPrivilegeEscalation: true` will not be permitted unless they are run under a specific policy.",
        "default_value": "By default, there are no restrictions on contained process ability to escalate privileges, within the context of the container.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Consider external secret storage",
        "controlID": "C-0208",
        "description": "Consider the use of an external secrets storage and management system, instead of using Kubernetes Secrets directly, if you have more complex secret management needs. Ensure the solution requires authentication to access secrets, has auditing of access to and use of secrets, and encrypts secrets. Some solutions also make it easier to rotate secrets.",
        "long_description": "Kubernetes supports secrets as first-class objects, but care needs to be taken to ensure that access to secrets is carefully limited. Using an external secrets provider can ease the management of access to secrets, especially where secrets are used across both Kubernetes and non-Kubernetes environments.",
        "remediation": "Refer to the secrets management options offered by your cloud provider or a third-party secrets management solution.",
        "impact_statement": "None",
        "default_value": "By default, no external secret management is configured.",
        "manual_test": "Review your secrets management implementation.",
        "test": "Checking encryption configuration to see if secrets are managed externally by kms using aws, azure, or akeyless vault",
        "references": [
            "https://workbench.cisecurity.org/sections/1126665/recommendations/1838631"
        ],
        "attributes": {},
        "rulesNames": [
            "external-secret-storage"
        ],
        "baseScore": 5,
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Limit use of the Bind, Impersonate and Escalate permissions in the Kubernetes cluster",
        "controlID": "C-0191",
        "description": "Cluster roles and roles with the impersonate, bind or escalate permissions should not be granted unless strictly required. Each of these permissions allow a particular subject to escalate their privileges beyond those explicitly granted by cluster administrators",
        "long_description": "The impersonate privilege allows a subject to impersonate other users gaining their rights to the cluster. The bind privilege allows the subject to add a binding to a cluster role or role which escalates their effective permissions in the cluster. The escalate privilege allows a subject to modify cluster roles to which they are bound, increasing their rights to that level.\n\n Each of these permissions has the potential to allow for privilege escalation to cluster-admin level.",
        "remediation": "Where possible, remove the impersonate, bind and escalate rights from subjects.",
        "manual_test": "Review the users who have access to cluster roles or roles which provide the impersonate, bind or escalate privileges.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126661/recommendations/1838597"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-can-bind-escalate",
            "rule-can-impersonate-users-groups-v1"
        ],
        "baseScore": 6,
        "impact_statement": "There are some cases where these permissions are required for cluster service operation, and care should be taken before removing these permissions from system service accounts.",
        "default_value": "In a default kubeadm cluster, the system:masters group and clusterrole-aggregation-controller service account have access to the escalate privilege. The system:masters group also has access to bind and impersonate.",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "No impersonation",
        "attributes": {
            "rbacQuery": "Impersonation",
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Impersonation is an explicit RBAC permission to use other roles rather than the one assigned to a user, group or service account. This is sometimes needed for testing purposes. However, it is highly recommended not to use this capability in the production environments for daily operations. This control identifies all subjects whose roles include impersonate verb.",
        "remediation": "Either remove the impersonate verb from the role where it was found or make sure that this role is not bound to users, groups or service accounts used for ongoing cluster operations. If necessary, bind this role to a subject only for specific needs for limited time period.",
        "long_description": "Impersonation is an explicit RBAC permission to use other roles rather than the one assigned to a user, group or service account. This is sometimes needed for testing purposes. However, it is highly recommended not to use this capability in the production environments for daily operations. This control identifies all subjects whose roles include impersonate verb.",
        "test": "Check for RBACs giving 'impersonate' verb to users/groups/uids/serviceaccounts",
        "rulesNames": [
            "rule-can-impersonate-users-groups-v1"
        ],
        "controlID": "C-0065",
        "baseScore": 6.0,
        "example": "@controls/examples/c065.yaml",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0150",
        "name": "Ensure that the Controller Manager --bind-address argument is set to 127.0.0.1",
        "description": "Do not bind the Controller Manager service to non-loopback insecure addresses.",
        "long_description": "The Controller Manager API service which runs on port 10252/TCP by default is used for health and metrics information and is available without authentication or encryption. As such it should only be bound to a localhost interface, to minimize the cluster's attack surface",
        "remediation": "Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node and ensure the correct value for the `--bind-address` parameter",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-controller-manager\n\n```\n Verify that the `--bind-address` argument is set to 127.0.0.1",
        "references": [
            "https://workbench.cisecurity.org/sections/1126669/recommendations/1838683"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-controller-manager-bind-address-argument-is-set-to-127.0.0.1"
        ],
        "baseScore": 5,
        "impact_statement": "None",
        "default_value": "By default, the `--bind-address` parameter is set to 0.0.0.0",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Resources CPU limit and request",
        "attributes": {
            "actionRequired": "configuration",
            "controlTypeTags": [
                "compliance",
                "devops"
            ]
        },
        "description": "This control identifies all Pods for which the CPU limit is not set.",
        "remediation": "Set the CPU limit or use exception mechanism to avoid unnecessary notifications.",
        "rulesNames": [
            "resources-cpu-limit-and-request"
        ],
        "controlID": "C-0050",
        "baseScore": 8.0,
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Resource management",
                "id": "Cat-7"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0147",
        "name": "Ensure that the Controller Manager --service-account-private-key-file argument is set as appropriate",
        "description": "Explicitly set a service account private key file for service accounts on the controller manager.",
        "long_description": "To ensure that keys for service account tokens can be rotated as needed, a separate public/private key pair should be used for signing service account tokens. The private key should be specified to the controller manager with `--service-account-private-key-file` as appropriate.",
        "remediation": "Edit the Controller Manager pod specification file `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the Control Plane node and set the `--service-account-private-key-file` parameter to the private key file for service accounts.\n\n \n```\n--service-account-private-key-file=<filename>\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-controller-manager\n\n```\n Verify that the `--service-account-private-key-file` argument is set as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126669/recommendations/1838680"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-controller-manager-service-account-private-key-file-argument-is-set-as-appropriate"
        ],
        "baseScore": 6,
        "impact_statement": "You would need to securely maintain the key file and rotate the keys based on your organization's key rotation policy.",
        "default_value": "By default, `--service-account-private-key-file` it not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "PersistentVolume without encyption",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "This control detects PersistentVolumes without encyption",
        "remediation": "Enable encryption on the PersistentVolume using the configuration in StorageClass",
        "rulesNames": [
            "pv-without-encryption"
        ],
        "test": "Checking all PersistentVolumes via their StorageClass for encryption",
        "controlID": "C-0264",
        "baseScore": 5.0,
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0165",
        "name": "If proxy kubeconfig file exists ensure ownership is set to root:root",
        "description": "If `kube-proxy` is running, ensure that the file ownership of its kubeconfig file is set to `root:root`.",
        "long_description": "The kubeconfig file for `kube-proxy` controls various parameters for the `kube-proxy` service in the worker node. You should set its file ownership to maintain the integrity of the file. The file should be owned by `root:root`.",
        "remediation": "Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nchown root:root <proxy kubeconfig file>\n\n```",
        "manual_test": "Find the kubeconfig file being used by `kube-proxy` by running the following command:\n\n \n```\nps -ef | grep kube-proxy\n\n```\n If `kube-proxy` is running, get the kubeconfig file location from the `--kubeconfig` parameter.\n\n To perform the audit:\n\n Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nstat -c %U:%G <path><filename>\n\n```\n Verify that the ownership is set to `root:root`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126659/recommendations/1838603"
        ],
        "rulesNames": [
            "if-proxy-kubeconfig-file-exists-ensure-ownership-is-set-to-root-root"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `proxy` file ownership is set to `root:root`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Linux hardening",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Containers may be given more privileges than they actually need. This can increase the potential impact of a container compromise.",
        "remediation": "You can use AppArmor, Seccomp, SELinux and Linux Capabilities mechanisms to restrict containers abilities to utilize unwanted privileges.",
        "rulesNames": [
            "linux-hardening"
        ],
        "long_description": "In order to reduce the attack surface, it is recommend, when it is possible, to harden your application using security services such as SELinux\u00ae, AppArmor\u00ae, and seccomp. Starting from Kubernetes version 22, SELinux is enabled by default. ",
        "test": "Check if there is AppArmor or Seccomp or SELinux or Capabilities are defined in the securityContext of container and pod. If none of these fields are defined for both the container and pod, alert.",
        "controlID": "C-0055",
        "baseScore": 4.0,
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Node escape",
                "id": "Cat-9"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Minimize access to the approval sub-resource of certificatesigningrequests objects",
        "controlID": "C-0280",
        "description": "Users with access to the update the approval sub-resource of certificateaigningrequests objects can approve new client certificates for the Kubernetes API effectively allowing them to create new high-privileged user accounts.",
        "long_description": "Users with access to the update the approval sub-resource of certificateaigningrequests objects can approve new client certificates for the Kubernetes API effectively allowing them to create new high-privileged user accounts. This can allow for privilege escalation to full cluster administrator, depending on users configured in the cluster",
        "remediation": "Where possible, remove access to the approval sub-resource of certificatesigningrequests objects.",
        "manual_test": "Review the users who have access to update the approval sub-resource of certificatesigningrequests objects in the Kubernetes API.",
        "test": "Check which subjects have RBAC permissions to update the approval sub-resource of certificatesigningrequests objects.",
        "references": [
            "https://workbench.cisecurity.org/sections/2633388/recommendations/4261962"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-can-approve-cert-signing-request"
        ],
        "baseScore": 5,
        "impact_statement": "Users with access to the approval sub-resource of certificatesigningrequests objects can approve new client certificates for the Kubernetes API effectively allowing them to create new high-privileged user accounts.",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "default_value": "By default in a kubeadm cluster the following list of principals have `update` privileges on `certificatesigningrequests/approval` objects ```CLUSTERROLEBINDING                                    SUBJECT                             TYPE            SA-NAMESPACEcluster-admin                                         system:masters                      Group           system:controller:clusterrole-aggregation-controller  clusterrole-aggregation-controller  ServiceAccount  kube-systemsystem:controller:daemon-set-controller               daemon-set-controller               ServiceAccount  kube-systemsystem:controller:job-controller                      job-controller                      ServiceAccount  kube-systemsystem:controller:persistent-volume-binder            persistent-volume-binder            ServiceAccount  kube-systemsystem:controller:replicaset-controller               replicaset-controller               ServiceAccount  kube-systemsystem:controller:replication-controller              replication-controller              ServiceAccount  kube-systemsystem:controller:statefulset-controller              statefulset-controller              ServiceAccount  kube-system```",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Missing network policy",
        "attributes": {
            "controlTypeTags": [
                "security"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Lateral Movement (Network)"
                    ]
                }
            ],
            "isFixedByNetworkPolicy": true
        },
        "description": "This control detects workloads that has no NetworkPolicy configured in labels. If a network policy is not configured, it means that your applications might not have necessary control over the traffic to and from the pods, possibly leading to a security vulnerability.",
        "remediation": "Review the workloads identified by this control and assess whether it's necessary to configure a network policy for them.",
        "rulesNames": [
            "ensure_network_policy_configured_in_labels"
        ],
        "test": "Check that all workloads has a network policy configured in labels.",
        "controlID": "C-0260",
        "baseScore": 5.0,
        "category": {
            "name": "Network",
            "id": "Cat-4"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0171",
        "name": "If the kubelet config.yaml configuration file is being used validate file ownership is set to root:root",
        "description": "Ensure that if the kubelet refers to a configuration file with the `--config` argument, that file is owned by root:root.",
        "long_description": "The kubelet reads various parameters, including security settings, from a config file specified by the `--config` argument. If this file is specified you should restrict its file permissions to maintain the integrity of the file. The file should be owned by root:root.",
        "remediation": "Run the following command (using the config file location identied in the Audit step)\n\n \n```\nchown root:root /etc/kubernetes/kubelet.conf\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the each worker node. For example,\n\n \n```\nstat -c %a /var/lib/kubelet/config.yaml\n```Verify that the ownership is set to `root:root`.\n\n```",
        "references": [
            "https://workbench.cisecurity.org/sections/1126659/recommendations/1838629"
        ],
        "rulesNames": [
            "ensure-that-the-kubelet-configuration-file-ownership-is-set-to-root-root"
        ],
        "attributes": {},
        "baseScore": 7,
        "impact_statement": "None",
        "default_value": "By default, `/var/lib/kubelet/config.yaml` file as set up by `kubeadm` is owned by `root:root`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "HostNetwork access",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Lateral Movement (Network)"
                    ]
                }
            ]
        },
        "description": "Potential attackers may gain access to a pod and inherit access to the entire host network. For example, in AWS case, they will have access to the entire VPC. This control identifies all the pods with host network access enabled.",
        "remediation": "Only connect pods to host network when it is necessary. If not, set the hostNetwork field of the pod spec to false, or completely remove it (false is the default). Whitelist only those pods that must have access to host network by design.",
        "rulesNames": [
            "host-network-access"
        ],
        "long_description": "We have it in ArmoBest",
        "test": "",
        "controlID": "C-0041",
        "baseScore": 7.0,
        "example": "@controls/examples/c041.yaml",
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Network",
                "id": "Cat-4"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0227",
        "name": "Restrict Access to the Control Plane Endpoint",
        "description": "Enable Endpoint Private Access to restrict access to the cluster's control plane to only an allowlist of authorized IPs.",
        "long_description": "Authorized networks are a way of specifying a restricted range of IP addresses that are permitted to access your cluster's control plane. Kubernetes Engine uses both Transport Layer Security (TLS) and authentication to provide secure access to your cluster's control plane from the public internet. This provides you the flexibility to administer your cluster from anywhere; however, you might want to further restrict access to a set of IP addresses that you control. You can set this restriction by specifying an authorized network.\n\n Restricting access to an authorized network can provide additional security benefits for your container cluster, including:\n\n * Better protection from outsider attacks: Authorized networks provide an additional layer of security by limiting external access to a specific set of addresses you designate, such as those that originate from your premises. This helps protect access to your cluster in the case of a vulnerability in the cluster's authentication or authorization mechanism.\n* Better protection from insider attacks: Authorized networks help protect your cluster from accidental leaks of master certificates from your company's premises. Leaked certificates used from outside Cloud Services and outside the authorized IP ranges (for example, from addresses outside your company) are still denied access.",
        "remediation": "By enabling private endpoint access to the Kubernetes API server, all communication between your nodes and the API server stays within your VPC. You can also limit the IP addresses that can access your API server from the internet, or completely disable internet access to the API server.\n\n With this in mind, you can update your cluster accordingly using the AWS CLI to ensure that Private Endpoint Access is enabled.\n\n If you choose to also enable Public Endpoint Access then you should also configure a list of allowable CIDR blocks, resulting in restricted access from the internet. If you specify no CIDR blocks, then the public API server endpoint is able to receive and process requests from all IP addresses by defaulting to ['0.0.0.0/0'].\n\n For example, the following command would enable private access to the Kubernetes API as well as limited public access over the internet from a single IP address (noting the /32 CIDR suffix):\n\n `aws eks update-cluster-config --region $AWS_REGION --name $CLUSTER_NAME --resources-vpc-config endpointPrivateAccess=true,endpointPublicAccess=true,publicAccessCidrs=\"203.0.113.5/32\"`\n\n Note:\n\n The CIDR blocks specified cannot include reserved addresses.\nThere is a maximum number of CIDR blocks that you can specify. For more information, see the EKS Service Quotas link in the references section.\nFor more detailed information, see the EKS Cluster Endpoint documentation link in the references section.",
        "manual_test": "",
        "references": [
            "https://docs.aws.amazon.com/eks/latest/userguide/cluster-endpoint.html"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-endpointprivateaccess-is-enabled"
        ],
        "baseScore": 8.0,
        "impact_statement": "When implementing Endpoint Private Access, be careful to ensure all desired networks are on the allowlist (whitelist) to prevent inadvertently blocking external access to your cluster's control plane.",
        "default_value": "By default, Endpoint Public Access is disabled.",
        "scanningScope": {
            "matches": [
                "cloud"
            ]
        },
        "rules": []
    },
    {
        "name": "Exposure to internet via Gateway API or Istio Ingress",
        "attributes": {
            "controlTypeTags": [
                "security"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Initial Access"
                    ]
                },
                {
                    "attackTrack": "service-destruction",
                    "categories": [
                        "Initial Access"
                    ]
                },
                {
                    "attackTrack": "external-workload-with-cluster-takeover-roles",
                    "categories": [
                        "Initial Access"
                    ]
                },
                {
                    "attackTrack": "workload-unauthenticated-service",
                    "categories": [
                        "Initial Access"
                    ]
                }
            ]
        },
        "description": "This control detect workloads that are exposed on Internet through a Gateway API (HTTPRoute,TCPRoute, UDPRoute) or Istio Gateway. It fails in case it find workloads connected with these resources.",
        "remediation": "The user can evaluate its exposed resources and apply relevant changes wherever needed.",
        "rulesNames": [
            "exposure-to-internet-via-gateway-api",
            "exposure-to-internet-via-istio-ingress"
        ],
        "test": "Checks if workloads are exposed through the use of Gateway API (HTTPRoute,TCPRoute, UDPRoute) or Istio Gateway.",
        "controlID": "C-0266",
        "baseScore": 7.0,
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0143",
        "name": "Ensure that the API Server only makes use of Strong Cryptographic Ciphers",
        "description": "Ensure that the API server is configured to only use strong cryptographic ciphers.",
        "long_description": "TLS ciphers have had a number of known vulnerabilities and weaknesses, which can reduce the protection provided by them. By default Kubernetes supports a number of TLS ciphersuites including some that have security concerns, weakening the protection provided.",
        "remediation": "Edit the API server pod specification file /etc/kubernetes/manifests/kube-apiserver.yaml on the Control Plane node and set the below parameter.\n\n \n```\n--tls-cipher-suites=TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256, TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA, TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256, TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA, TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384, TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305, TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256, TLS_ECDHE_RSA_WITH_3DES_EDE_CBC_SHA, TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA, TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256, TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA, TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384, TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305, TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256, TLS_RSA_WITH_3DES_EDE_CBC_SHA, TLS_RSA_WITH_AES_128_CBC_SHA, TLS_RSA_WITH_AES_128_GCM_SHA256, TLS_RSA_WITH_AES_256_CBC_SHA, TLS_RSA_WITH_AES_256_GCM_SHA384.\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--tls-cipher-suites` argument is set as outlined in the remediation procedure below.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838676"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-API-Server-only-makes-use-of-Strong-Cryptographic-Ciphers"
        ],
        "baseScore": 5,
        "impact_statement": "API server clients that cannot support modern cryptographic ciphers will not be able to make connections to the API server.",
        "default_value": "By default the Kubernetes API server supports a wide range of TLS ciphers",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0105",
        "name": "Ensure that the admin.conf file ownership is set to root:root",
        "description": "Ensure that the `admin.conf` file ownership is set to `root:root`.",
        "long_description": "The `admin.conf` file contains the admin credentials for the cluster. You should set its file ownership to maintain the integrity and confidentiality of the file. The file should be owned by root:root.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/admin.conf\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %U:%G /etc/kubernetes/admin.conf\n\n```\n Verify that the ownership is set to `root:root`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838584"
        ],
        "rulesNames": [
            "ensure-that-the-admin.conf-file-ownership-is-set-to-root-root"
        ],
        "attributes": {},
        "baseScore": 7,
        "impact_statement": "None.",
        "default_value": "By default, `admin.conf` file ownership is set to `root:root`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0099",
        "name": "Ensure that the etcd pod specification file ownership is set to root:root",
        "description": "Ensure that the `/etc/kubernetes/manifests/etcd.yaml` file ownership is set to `root:root`.",
        "long_description": "The etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` controls various parameters that set the behavior of the `etcd` service in the master node. etcd is a highly-available key-value store which Kubernetes uses for persistent storage of all of its REST API object. You should set its file ownership to maintain the integrity of the file. The file should be owned by `root:root`.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/manifests/etcd.yaml\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %U:%G /etc/kubernetes/manifests/etcd.yaml\n\n```\n Verify that the ownership is set to `root:root`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838573"
        ],
        "rulesNames": [
            "ensure-that-the-etcd-pod-specification-file-ownership-is-set-to-root-root"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `/etc/kubernetes/manifests/etcd.yaml` file ownership is set to `root:root`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0243",
        "name": "Ensure Image Vulnerability Scanning using Azure Defender image scanning or a third party provider",
        "description": "Scan images being deployed to Azure (AKS) for vulnerabilities.\n\n Vulnerability scanning for images stored in Azure Container Registry is generally available in Azure Security Center. This capability is powered by Qualys, a leading provider of information security.\n\n When you push an image to Container Registry, Security Center automatically scans it, then checks for known vulnerabilities in packages or dependencies defined in the file.\n\n When the scan completes (after about 10 minutes), Security Center provides details and a security classification for each vulnerability detected, along with guidance on how to remediate issues and protect vulnerable attack surfaces.",
        "long_description": "Vulnerabilities in software packages can be exploited by hackers or malicious users to obtain unauthorized access to local cloud resources. Azure Defender and other third party products allow images to be scanned for known vulnerabilities.",
        "remediation": "",
        "manual_test": "",
        "references": [
            "<https://docs.microsoft.com/en-us/azure/security-center/defender-for-container-registries-usage>\n\n  <https://docs.microsoft.com/en-us/azure/container-registry/container-registry-check-health>\n\n  <https://docs.microsoft.com/security/benchmark/azure/security-controls-v2-posture-vulnerability-management#pv-6-perform-software-vulnerability-assessments>"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-image-vulnerability-scanning-using-azure-defender-image-scanning-or-a-third-party-provider"
        ],
        "baseScore": 5,
        "impact_statement": "When using an Azure container registry, you might occasionally encounter problems. For example, you might not be able to pull a container image because of an issue with Docker in your local environment. Or, a network issue might prevent you from connecting to the registry.",
        "default_value": "Images are not scanned by Default.",
        "scanningScope": {
            "matches": [
                "AKS"
            ]
        },
        "rules": []
    },
    {
        "name": "Forbidden Container Registries",
        "attributes": {
            "microsoftMitreColumns": [
                "Initial Access"
            ],
            "controlTypeTags": [
                "security",
                "compliance"
            ],
            "actionRequired": "configuration"
        },
        "description": "In cases where the Kubernetes cluster is provided by a CSP (e.g., AKS in Azure, GKE in GCP, or EKS in AWS), compromised cloud credential can lead to the cluster takeover. Attackers may abuse cloud account credentials or IAM mechanism to the cluster\u2019s management layer.",
        "remediation": "Limit the registries from which you pull container images from",
        "rulesNames": [
            "rule-identify-blocklisted-image-registries",
            "rule-identify-blocklisted-image-registries-v1"
        ],
        "long_description": "Running a compromised image in a cluster can compromise the cluster. Attackers who get access to a private registry can plant their own compromised images in the registry. The latter can then be pulled by a user. In addition, users often use untrusted images from public registries (such as Docker Hub) that may be malicious. Building images based on untrusted base images can also lead to similar results.",
        "test": "Checking image from pod spec, if the registry of the image is from the list of blocked registries we raise an alert.",
        "controlID": "C-0001",
        "baseScore": 7.0,
        "example": "@controls/examples/c001.yaml",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0204",
        "name": "Minimize the admission of containers which use HostPorts",
        "description": "Do not generally permit containers which require the use of HostPorts.",
        "long_description": "Host ports connect containers directly to the host's network. This can bypass controls such as network policy.\n\n There should be at least one admission control policy defined which does not permit containers which require the use of HostPorts.\n\n If you need to run containers which require HostPorts, this should be defined in a separate policy and you should carefully check to ensure that only limited service accounts and users are given permission to use that policy.",
        "remediation": "Add policies to each namespace in the cluster which has user workloads to restrict the admission of containers which use `hostPort` sections.",
        "manual_test": "List the policies in use for each namespace in the cluster, ensure that each policy disallows the admission of containers which have `hostPort` sections.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126662/recommendations/1838626"
        ],
        "attributes": {},
        "rulesNames": [
            "pod-security-admission-baseline-applied-1",
            "pod-security-admission-baseline-applied-2"
        ],
        "baseScore": 4,
        "impact_statement": "Pods defined with `hostPort` settings in either the container, initContainer or ephemeralContainer sections will not be permitted unless they are run under a specific policy.",
        "default_value": "By default, there are no restrictions on the use of HostPorts.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0245",
        "name": "Encrypt traffic to HTTPS load balancers with TLS certificates",
        "description": "Encrypt traffic to HTTPS load balancers using TLS certificates.",
        "long_description": "Encrypting traffic between users and your Kubernetes workload is fundamental to protecting data sent over the web.",
        "remediation": "",
        "manual_test": "",
        "references": [
            "<https://docs.microsoft.com/security/benchmark/azure/security-controls-v2-data-protection#dp-4-encrypt-sensitive-information-in-transit>"
        ],
        "attributes": {},
        "rulesNames": [
            "encrypt-traffic-to-https-load-balancers-with-tls-certificates"
        ],
        "baseScore": 8,
        "impact_statement": "",
        "default_value": "",
        "scanningScope": {
            "matches": [
                "AKS"
            ]
        },
        "rules": []
    },
    {
        "name": "Writable hostPath mount",
        "attributes": {
            "microsoftMitreColumns": [
                "Persistence",
                "Lateral Movement"
            ],
            "controlTypeTags": [
                "security",
                "compliance",
                "devops",
                "security-impact",
                "smartRemediation"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Privilege Escalation (Node)"
                    ]
                }
            ]
        },
        "description": "Mounting host directory to the container can be used by attackers to get access to the underlying host and gain persistence.",
        "remediation": "Refrain from using the hostPath mount or use the exception mechanism to remove unnecessary notifications.",
        "rulesNames": [
            "alert-rw-hostpath"
        ],
        "long_description": "hostPath volume mounts a directory or a file from the host to the container. Attackers who have permissions to create a new container in the cluster may create one with a writable hostPath volume and gain persistence on the underlying host. For example, the latter can be achieved by creating a cron job on the host.",
        "test": "Checking in Pod spec if there is a hostPath volume, if it has the section mount.readOnly == false (or doesn\u2019t exist) we raise an alert.",
        "controlID": "C-0045",
        "baseScore": 8.0,
        "example": "@controls/examples/c045.yaml",
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Storage",
                "id": "Cat-8"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Ingress uses TLS",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "This control detect Ingress resources that do not use TLS",
        "remediation": "The user needs to implement TLS for the Ingress resource in order to encrypt the incoming traffic",
        "rulesNames": [
            "ingress-no-tls"
        ],
        "test": "Check if the Ingress resource has TLS configured",
        "controlID": "C-0263",
        "baseScore": 7.0,
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0095",
        "name": "Ensure that the controller manager pod specification file ownership is set to root:root",
        "description": "Ensure that the controller manager pod specification file ownership is set to `root:root`.",
        "long_description": "The controller manager pod specification file controls various parameters that set the behavior of various components of the master node. You should set its file ownership to maintain the integrity of the file. The file should be owned by `root:root`.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchown root:root /etc/kubernetes/manifests/kube-controller-manager.yaml\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %U:%G /etc/kubernetes/manifests/kube-controller-manager.yaml\n\n```\n Verify that the ownership is set to `root:root`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838566"
        ],
        "rulesNames": [
            "ensure-that-the-controller-manager-pod-specification-file-ownership-is-set-to-root-root"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `kube-controller-manager.yaml` file ownership is set to `root:root`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "SSH server running inside container",
        "attributes": {
            "microsoftMitreColumns": [
                "Execution"
            ],
            "controlTypeTags": [
                "compliance"
            ]
        },
        "description": "An SSH server that is running inside a container may be used by attackers to get remote access to the container. This control checks if pods have an open SSH port (22/2222).",
        "remediation": "Remove SSH from the container image or limit the access to the SSH server using network policies.",
        "rulesNames": [
            "rule-can-ssh-to-pod-v1"
        ],
        "long_description": "SSH server that is running inside a container may be used by attackers. If attackers gain valid credentials to a container, whether by brute force attempts or by other methods (such as phishing), they can use it to get remote access to the container by SSH.",
        "test": "Check if service connected to some workload has an SSH port (22/2222). If so we raise an alert. ",
        "controlID": "C-0042",
        "baseScore": 3.0,
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Label usage for resources",
        "attributes": {
            "actionRequired": "configuration",
            "controlTypeTags": [
                "devops"
            ]
        },
        "description": "It is recommended to set labels that identify semantic attributes of your application or deployment. For example, { app: myapp, tier: frontend, phase: test, deployment: v3 }. These labels can used to assign policies to logical groups of the deployments as well as for presentation and tracking purposes. This control helps you find deployments without any of the expected labels.",
        "remediation": "Define labels that are most suitable to your needs of use the exceptions to prevent further notifications.",
        "rulesNames": [
            "label-usage-for-resources"
        ],
        "long_description": "It is recommended to set labels that identify semantic attributes of your application or deployment. For example, { app: myapp, tier: frontend, phase: test, deployment: v3 }. These labels can used to assign policies to logical groups of the deployments as well as for presentation and tracking purposes. This control helps you find deployments without any of the expected labels.",
        "test": "Test will check if a certain set of labels is defined, this is a configurable control. Initial list: app, tier, phase, version, owner, env.",
        "controlID": "C-0076",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "baseScore": 2.0,
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0235",
        "name": "Ensure that the kubelet configuration file has permissions set to 644 or more restrictive",
        "description": "Ensure that if the kubelet refers to a configuration file with the `--config` argument, that file has permissions of 644 or more restrictive.",
        "long_description": "The kubelet reads various parameters, including security settings, from a config file specified by the `--config` argument. If this file is specified you should restrict its file permissions to maintain the integrity of the file. The file should be writable by only the administrators on the system.",
        "remediation": "Run the following command (using the config file location identified in the Audit step)\n\n \n```\nchmod 644 /etc/kubernetes/kubelet/kubelet-config.json\n\n```",
        "manual_test": "First, SSH to the relevant worker node:\n\n To check to see if the Kubelet Service is running:\n\n \n```\nsudo systemctl status kubelet\n\n```\n The output should return `Active: active (running) since..`\n\n Run the following command on each node to find the appropriate Kubelet config file:\n\n \n```\nps -ef | grep kubelet\n\n```\n The output of the above command should return something similar to `--config /etc/kubernetes/kubelet/kubelet-config.json` which is the location of the Kubelet config file.\n\n Run the following command:\n\n \n```\nstat -c %a /etc/kubernetes/kubelet/kubelet-config.json\n\n```\n The output of the above command is the Kubelet config file's permissions. Verify that the permissions are `644` or more restrictive.",
        "references": [
            "https://kubernetes.io/docs/tasks/administer-cluster/kubelet-config-file/"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-kubelet-configuration-file-has-permissions-set-to-644-or-more-restrictive"
        ],
        "baseScore": 6.0,
        "impact_statement": "None.",
        "default_value": "See the AWS EKS documentation for the default value.",
        "scanningScope": {
            "matches": [
                "EKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0128",
        "name": "Ensure that the API Server --secure-port argument is not set to 0",
        "description": "Do not disable the secure port.",
        "long_description": "The secure port is used to serve https with authentication and authorization. If you disable it, no https traffic is served and all traffic is served unencrypted.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and either remove the `--secure-port` parameter or set it to a different (non-zero) desired port.",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--secure-port` argument is either not set or is set to an integer value between 1 and 65535.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838659"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-secure-port-argument-is-not-set-to-0"
        ],
        "baseScore": 8,
        "impact_statement": "You need to set the API Server up with the right TLS certificates.",
        "default_value": "By default, port 6443 is used as the secure port.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0175",
        "name": "Verify that the --read-only-port argument is set to 0",
        "description": "Disable the read-only port.",
        "long_description": "The Kubelet process provides a read-only API in addition to the main Kubelet API. Unauthenticated access is provided to this read-only API which could possibly retrieve potentially sensitive information about the cluster.",
        "remediation": "If using a Kubelet config file, edit the file to set `readOnlyPort` to `0`.\n\n If using command line arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the below parameter in `KUBELET_SYSTEM_PODS_ARGS` variable.\n\n \n```\n--read-only-port=0\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```",
        "manual_test": "Run the following command on each node:\n\n \n```\nps -ef | grep kubelet\n\n```\n Verify that the `--read-only-port` argument exists and is set to `0`.\n\n If the `--read-only-port` argument is not present, check that there is a Kubelet config file specified by `--config`. Check that if there is a `readOnlyPort` entry in the file, it is set to `0`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126668/recommendations/1838645"
        ],
        "attributes": {},
        "rulesNames": [
            "read-only-port-enabled-updated"
        ],
        "baseScore": 4,
        "impact_statement": "Removal of the read-only port will require that any service which made use of it will need to be re-configured to use the main Kubelet API.",
        "default_value": "By default, `--read-only-port` is set to `10255/TCP`. However, if a config file is specified by `--config` the default value for `readOnlyPort` is 0.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "CVE-2022-24348-argocddirtraversal",
        "attributes": {
            "controlTypeTags": [
                "security"
            ]
        },
        "description": "CVE-2022-24348 is a major software supply chain 0-day vulnerability in the popular open source CD platform Argo CD which can lead to privilege escalation and information disclosure.",
        "remediation": "Update your ArgoCD deployment to fixed versions (v2.1.9,v2.2.4 or v2.3.0)",
        "rulesNames": [
            "CVE-2022-24348"
        ],
        "long_description": "CVE-2022-24348 is a major software supply chain 0-day vulnerability in the popular open source CD platform Argo CD. Exploiting it enables attackers to obtain sensitive information like credentials, secrets, API keys from other applications on the platform. This in turn can lead to privilege escalation, lateral movements and information disclosure.",
        "test": "Checking Linux kernel version of the Node objects, if it is above 5.1 or below 5.16.2 it fires an alert",
        "controlID": "C-0081",
        "baseScore": 4.0,
        "example": "",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "CVE-2022-39328-grafana-auth-bypass",
        "attributes": {
            "controlTypeTags": [
                "security"
            ]
        },
        "description": "CVE-2022-39328 is a critical vulnerability in Grafana, it might enable attacker to access unauthorized endpoints under heavy load.",
        "remediation": "Update your Grafana to 9.2.4 or above",
        "rulesNames": [
            "CVE-2022-39328"
        ],
        "long_description": "An internal security audit identified a race condition in the Grafana codebase, which allowed an unauthenticated user to query an arbitrary endpoint in Grafana. A race condition in the HTTP context creation could result in an HTTP request being assigned the authentication/authorization middlewares of another call. Under heavy load, it is possible that a call protected by a privileged middleware receives the middleware of a public query instead. As a result, an unauthenticated user can successfully query protected endpoints. The CVSS score for this vulnerability is 9.8 Critical.",
        "test": "This control test for vulnerable versions of Grafana (between 9.2 and 9.2.3)",
        "controlID": "C-0090",
        "baseScore": 9.0,
        "example": "",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0123",
        "name": "Ensure that the admission control plugin AlwaysPullImages is set",
        "description": "Always pull images.",
        "long_description": "Setting admission control policy to `AlwaysPullImages` forces every new pod to pull the required images every time. In a multi-tenant cluster users can be assured that their private images can only be used by those who have the credentials to pull them. Without this admission control policy, once an image has been pulled to a node, any pod from any user can use it simply by knowing the image\u2019s name, without any authorization check against the image ownership. When this plug-in is enabled, images are always pulled prior to starting containers, which means valid credentials are required.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--enable-admission-plugins` parameter to include `AlwaysPullImages`.\n\n \n```\n--enable-admission-plugins=...,AlwaysPullImages,...\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--enable-admission-plugins` argument is set to a value that includes `AlwaysPullImages`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838649"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-admission-control-plugin-AlwaysPullImages-is-set"
        ],
        "baseScore": 4,
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "impact_statement": "Credentials would be required to pull the private images every time. Also, in trusted environments, this might increases load on network, registry, and decreases speed. This setting could impact offline or isolated clusters, which have images pre-loaded and do not have access to a registry to pull in-use images. This setting is not appropriate for clusters which use this configuration.",
        "default_value": "By default, `AlwaysPullImages` is not set.",
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0153",
        "name": "Ensure that the --cert-file and --key-file arguments are set as appropriate",
        "description": "Configure TLS encryption for the etcd service.",
        "long_description": "etcd is a highly-available key value store used by Kubernetes deployments for persistent storage of all of its REST API objects. These objects are sensitive in nature and should be encrypted in transit.",
        "remediation": "Follow the etcd service documentation and configure TLS encryption.\n\n Then, edit the etcd pod specification file `/etc/kubernetes/manifests/etcd.yaml` on the master node and set the below parameters.\n\n \n```\n--cert-file=</path/to/ca-file>\n--key-file=</path/to/key-file>\n\n```",
        "manual_test": "Run the following command on the etcd server node\n\n \n```\nps -ef | grep etcd\n\n```\n Verify that the `--cert-file` and the `--key-file` arguments are set as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126654/recommendations/1838562"
        ],
        "attributes": {},
        "rulesNames": [
            "etcd-tls-enabled"
        ],
        "baseScore": 8,
        "impact_statement": "Client connections only over TLS would be served.",
        "default_value": "By default, TLS encryption is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0194",
        "name": "Minimize the admission of containers wishing to share the host process ID namespace",
        "description": "Do not generally permit containers to be run with the `hostPID` flag set to true.",
        "long_description": "A container running in the host's PID namespace can inspect processes running outside the container. If the container also has access to ptrace capabilities this can be used to escalate privileges outside of the container.\n\n There should be at least one admission control policy defined which does not permit containers to share the host PID namespace.\n\n If you need to run containers which require hostPID, this should be defined in a separate policy and you should carefully check to ensure that only limited service accounts and users are given permission to use that policy.",
        "remediation": "Add policies to each namespace in the cluster which has user workloads to restrict the admission of `hostPID` containers.",
        "manual_test": "List the policies in use for each namespace in the cluster, ensure that each policy disallows the admission of `hostPID` containers",
        "references": [
            "https://workbench.cisecurity.org/sections/1126662/recommendations/1838602"
        ],
        "attributes": {},
        "rulesNames": [
            "pod-security-admission-baseline-applied-1",
            "pod-security-admission-baseline-applied-2"
        ],
        "baseScore": 5,
        "impact_statement": "Pods defined with `spec.hostPID: true` will not be permitted unless they are run under a specific policy.",
        "default_value": "By default, there are no restrictions on the creation of `hostPID` containers.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0237",
        "name": "Check if signature exists",
        "description": "Ensures that all images contain some signature",
        "long_description": "Verifies that each image is signed",
        "remediation": "Replace the image with a signed image",
        "manual_test": "",
        "references": [],
        "attributes": {},
        "rulesNames": [
            "has-image-signature"
        ],
        "baseScore": 7,
        "impact_statement": "",
        "default_value": "",
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Supply chain",
                "id": "Cat-6"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0102",
        "name": "Ensure that the etcd data directory permissions are set to 700 or more restrictive",
        "description": "Ensure that the etcd data directory has permissions of `700` or more restrictive.",
        "long_description": "etcd is a highly-available key-value store used by Kubernetes deployments for persistent storage of all of its REST API objects. This data directory should be protected from any unauthorized reads or writes. It should not be readable or writable by any group members or the world.",
        "remediation": "On the etcd server node, get the etcd data directory, passed as an argument `--data-dir`, from the below command:\n\n \n```\nps -ef | grep etcd\n\n```\n Run the below command (based on the etcd data directory found above). For example,\n\n \n```\nchmod 700 /var/lib/etcd\n\n```",
        "manual_test": "On the etcd server node, get the etcd data directory, passed as an argument `--data-dir`, from the below command:\n\n \n```\nps -ef | grep etcd\n\n```\n Run the below command (based on the etcd data directory found above). For example,\n\n \n```\nstat -c %a /var/lib/etcd\n\n```\n Verify that the permissions are `700` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838577"
        ],
        "rulesNames": [
            "ensure-that-the-etcd-data-directory-permissions-are-set-to-700-or-more-restrictive"
        ],
        "attributes": {},
        "baseScore": 7,
        "impact_statement": "None",
        "default_value": "By default, etcd data directory has permissions of `755`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Workloads with RCE vulnerabilities exposed to external traffic",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Container images with known Remote Code Execution (RCE) vulnerabilities pose significantly higher risk if they are exposed to the external traffic. This control lists all images with such vulnerabilities if their pod has either LoadBalancer or NodePort service.",
        "remediation": "Either update the container image to fix the vulnerabilities (if such fix is available) or reassess if this workload must be exposed to the outseide traffic. If no fix is available, consider periodic restart of the pod to minimize the risk of persistant intrusion. Use exception mechanism if you don't want to see this report again.",
        "rulesNames": [
            "exposed-rce-pods"
        ],
        "long_description": "Container images with known Remote Code Execution (RCE) vulnerabilities pose significantly higher risk if they are exposed to the external traffic. This control lists all images with such vulnerabilities if their pod has either LoadBalancer or NodePort service.",
        "test": "This control enumerates external facing workloads, that have LoadBalancer or NodePort service and checks the image vulnerability information for the RCE vulnerability.",
        "controlID": "C-0084",
        "baseScore": 8.0,
        "example": "@controls/examples/c84.yaml",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Enforce Kubelet client TLS authentication",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Kubelets are the node level orchestrator in Kubernetes control plane. They are publishing service port 10250 where they accept commands from API server. Operator must make sure that only API server is allowed to submit commands to Kubelet. This is done through client certificate verification, must configure Kubelet with client CA file to use for this purpose.",
        "remediation": "Start the kubelet with the --client-ca-file flag, providing a CA bundle to verify client certificates with.",
        "rulesNames": [
            "enforce-kubelet-client-tls-authentication-updated"
        ],
        "long_description": "Kubelets are the node level orchestrator in Kubernetes control plane. They are publishing service port 10250 where they accept commands from API server. Operator must make sure that only API server is allowed to submit commands to Kubelet. This is done through client certificate verification, must configure Kubelet with client CA file to use for this purpose.",
        "test": "Reading the kubelet command lines and configuration file looking for client TLS configuration.",
        "controlID": "C-0070",
        "baseScore": 9.0,
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0201",
        "name": "Minimize the admission of containers with capabilities assigned",
        "description": "Do not generally permit containers with capabilities",
        "long_description": "Containers run with a default set of capabilities as assigned by the Container Runtime. Capabilities are parts of the rights generally granted on a Linux system to the root user.\n\n In many cases applications running in containers do not require any capabilities to operate, so from the perspective of the principal of least privilege use of capabilities should be minimized.",
        "remediation": "Review the use of capabilites in applications runnning on your cluster. Where a namespace contains applicaions which do not require any Linux capabities to operate consider adding a policy which forbids the admission of containers which do not drop all capabilities.",
        "manual_test": "List the policies in use for each namespace in the cluster, ensure that at least one policy requires that capabilities are dropped by all containers.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126662/recommendations/1838622"
        ],
        "attributes": {},
        "rulesNames": [
            "pod-security-admission-restricted-applied-1",
            "pod-security-admission-restricted-applied-2"
        ],
        "baseScore": 5,
        "impact_statement": "Pods with containers require capabilities to operate will not be permitted.",
        "default_value": "By default, there are no restrictions on the creation of containers with additional capabilities",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0276",
        "name": "Minimize the admission of containers wishing to share the host IPC namespace",
        "description": "Do not generally permit containers to be run with the hostIPC flag set to true.",
        "long_description": "A container running in the host's IPC namespace can use IPC to interact with processes outside the container.\n\n There should be at least one admission control policy defined which does not permit containers to share the host IPC namespace.\n\n If you need to run containers which require hostIPC, this should be definited in a separate policy and you should carefully check to ensure that only limited service accounts and users are given permission to use that policy.",
        "remediation": "Add policies to each namespace in the cluster which has user workloads to restrict the admission of `hostIPC` containers.",
        "manual_test": "To fetch hostIPC from each pod.\n\n```\nget pods -A -o=jsonpath=$'{range .items[*]}{@.metadata.name}: {@.spec.hostIPC}\n{end}'\n```",
        "references": [
            "https://workbench.cisecurity.org/sections/2633390/recommendations/4261969"
        ],
        "attributes": {},
        "rulesNames": [
            "host-ipc-privileges"
        ],
        "baseScore": 5,
        "impact_statement": "Pods defined with `spec.hostIPC: true` will not be permitted unless they are run under a specific policy.",
        "default_value": "By default, there are no restrictions on the creation of `hostIPC` containers.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0092",
        "name": "Ensure that the API server pod specification file permissions are set to 600 or more restrictive",
        "description": "Ensure that the API server pod specification file has permissions of `600` or more restrictive.",
        "long_description": "The API server pod specification file controls various parameters that set the behavior of the API server. You should restrict its file permissions to maintain the integrity of the file. The file should be writable by only the administrators on the system.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/manifests/kube-apiserver.yaml\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %a /etc/kubernetes/manifests/kube-apiserver.yaml\n\n```\n Verify that the permissions are `600` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838561"
        ],
        "rulesNames": [
            "ensure-that-the-API-server-pod-specification-file-permissions-are-set-to-600-or-more-restrictive"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, the `kube-apiserver.yaml` file has permissions of `640`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Minimize wildcard use in Roles and ClusterRoles",
        "controlID": "C-0187",
        "description": "Kubernetes Roles and ClusterRoles provide access to resources based on sets of objects and actions that can be taken on those objects. It is possible to set either of these to be the wildcard \"\\*\" which matches all items.\n\n Use of wildcards is not optimal from a security perspective as it may allow for inadvertent access to be granted when new resources are added to the Kubernetes API either as CRDs or in later versions of the product.",
        "long_description": "The principle of least privilege recommends that users are provided only the access required for their role and nothing more. The use of wildcard rights grants is likely to provide excessive rights to the Kubernetes API.",
        "remediation": "Where possible replace any use of wildcards in clusterroles and roles with specific objects or actions.",
        "manual_test": "Retrieve the roles defined across each namespaces in the cluster and review for wildcards\n\n \n```\nkubectl get roles --all-namespaces -o yaml\n\n```\n Retrieve the cluster roles defined in the cluster and review for wildcards\n\n \n```\nkubectl get clusterroles -o yaml\n\n```",
        "test": "Check which subjects have wildcard RBAC permissions.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126661/recommendations/1838591"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-list-all-cluster-admins-v1"
        ],
        "baseScore": 7,
        "impact_statement": "",
        "default_value": "",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0200",
        "name": "Minimize the admission of containers with added capabilities",
        "description": "Do not generally permit containers with capabilities assigned beyond the default set.",
        "long_description": "Containers run with a default set of capabilities as assigned by the Container Runtime. Capabilities outside this set can be added to containers which could expose them to risks of container breakout attacks.\n\n There should be at least one policy defined which prevents containers with capabilities beyond the default set from launching.\n\n If you need to run containers with additional capabilities, this should be defined in a separate policy and you should carefully check to ensure that only limited service accounts and users are given permission to use that policy.",
        "remediation": "Ensure that `allowedCapabilities` is not present in policies for the cluster unless it is set to an empty array.",
        "manual_test": "List the policies in use for each namespace in the cluster, ensure that policies are present which prevent `allowedCapabilities` to be set to anything other than an empty array.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126662/recommendations/1838621"
        ],
        "attributes": {},
        "rulesNames": [
            "pod-security-admission-restricted-applied-1",
            "pod-security-admission-restricted-applied-2"
        ],
        "baseScore": 5,
        "impact_statement": "Pods with containers which require capabilities outwith the default set will not be permitted.",
        "default_value": "By default, there are no restrictions on adding capabilities to containers.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0094",
        "name": "Ensure that the controller manager pod specification file permissions are set to 600 or more restrictive",
        "description": "Ensure that the controller manager pod specification file has permissions of `600` or more restrictive.",
        "long_description": "The controller manager pod specification file controls various parameters that set the behavior of the Controller Manager on the master node. You should restrict its file permissions to maintain the integrity of the file. The file should be writable by only the administrators on the system.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/manifests/kube-controller-manager.yaml\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %a /etc/kubernetes/manifests/kube-controller-manager.yaml\n\n```\n Verify that the permissions are `600` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838564"
        ],
        "rulesNames": [
            "ensure-that-the-controller-manager-pod-specification-file-permissions-are-set-to-600-or-more-restrictive"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, the `kube-controller-manager.yaml` file has permissions of `640`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0126",
        "name": "Ensure that the admission control plugin NamespaceLifecycle is set",
        "description": "Reject creating objects in a namespace that is undergoing termination.",
        "long_description": "Setting admission control policy to `NamespaceLifecycle` ensures that objects cannot be created in non-existent namespaces, and that namespaces undergoing termination are not used for creating the new objects. This is recommended to enforce the integrity of the namespace termination process and also for the availability of the newer objects.",
        "remediation": "Edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the Control Plane node and set the `--disable-admission-plugins` parameter to ensure it does not include `NamespaceLifecycle`.",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--disable-admission-plugins` argument is set to a value that does not include `NamespaceLifecycle`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838653"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-admission-control-plugin-NamespaceLifecycle-is-set"
        ],
        "baseScore": 3,
        "impact_statement": "None",
        "default_value": "By default, `NamespaceLifecycle` is set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Apply Security Context to Your Pods and Containers",
        "controlID": "C-0211",
        "description": "Apply Security Context to Your Pods and Containers",
        "long_description": "A security context defines the operating system security settings (uid, gid, capabilities, SELinux role, etc..) applied to a container. When designing your containers and pods, make sure that you configure the security context for your pods, containers, and volumes. A security context is a property defined in the deployment yaml. It controls the security parameters that will be assigned to the pod/container/volume. There are two levels of security context: pod level security context, and container level security context.",
        "remediation": "Follow the Kubernetes documentation and apply security contexts to your pods. For a suggested list of security contexts, you may refer to the CIS Security Benchmark for Docker Containers.",
        "test": "Check that pod and container security context fields according to recommendations in CIS Security Benchmark for Docker Containers",
        "manual_test": "Review the pod definitions in your cluster and verify that you have security contexts defined as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126667/recommendations/1838636"
        ],
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Privilege Escalation (Node)"
                    ]
                }
            ]
        },
        "rulesNames": [
            "rule-privilege-escalation",
            "immutable-container-filesystem",
            "non-root-containers",
            "drop-capability-netraw",
            "set-seLinuxOptions",
            "set-seccomp-profile",
            "set-procmount-default",
            "set-fsgroup-value",
            "set-fsgroupchangepolicy-value",
            "set-sysctls-params",
            "set-supplementalgroups-values",
            "rule-allow-privilege-escalation"
        ],
        "baseScore": 8,
        "impact_statement": "If you incorrectly apply security contexts, you may have trouble running the pods.",
        "default_value": "By default, no security contexts are automatically applied to pods.",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0252",
        "name": "Ensure clusters are created with Private Endpoint Enabled and Public Access Disabled",
        "description": "Disable access to the Kubernetes API from outside the node network if it is not required.",
        "long_description": "In a private cluster, the master node has two endpoints, a private and public endpoint. The private endpoint is the internal IP address of the master, behind an internal load balancer in the master's wirtual network. Nodes communicate with the master using the private endpoint. The public endpoint enables the Kubernetes API to be accessed from outside the master's virtual network.\n\n Although Kubernetes API requires an authorized token to perform sensitive actions, a vulnerability could potentially expose the Kubernetes publically with unrestricted access. Additionally, an attacker may be able to identify the current cluster and Kubernetes API version and determine whether it is vulnerable to an attack. Unless required, disabling public endpoint will help prevent such threats, and require the attacker to be on the master's virtual network to perform any attack on the Kubernetes API.",
        "remediation": "To use a private endpoint, create a new private endpoint in your virtual network then create a link between your virtual network and a new private DNS zone",
        "manual_test": "",
        "references": [
            "<https://docs.microsoft.com/security/benchmark/azure/security-controls-v2-network-security#ns-2-connect-private-networks-together>\n\n  <https://learn.microsoft.com/en-us/azure/aks/private-clusters>"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-clusters-are-created-with-private-endpoint-enabled-and-public-access-disabled"
        ],
        "baseScore": 8,
        "impact_statement": "",
        "default_value": "",
        "scanningScope": {
            "matches": [
                "AKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0215",
        "name": "Minimize the admission of containers wishing to share the host IPC namespace",
        "description": "Do not generally permit containers to be run with the `hostIPC` flag set to true.",
        "long_description": "A container running in the host's IPC namespace can use IPC to interact with processes outside the container.\n\n There should be at least one PodSecurityPolicy (PSP) defined which does not permit containers to share the host IPC namespace.\n\n If you have a requirement to containers which require hostIPC, this should be defined in a separate PSP and you should carefully check RBAC controls to ensure that only limited service accounts and users are given permission to access that PSP.",
        "remediation": "Create a PSP as described in the Kubernetes documentation, ensuring that the `.spec.hostIPC` field is omitted or set to false.",
        "manual_test": "Get the set of PSPs with the following command:\n\n \n```\nkubectl get psp\n\n```\n For each PSP, check whether privileged is enabled:\n\n \n```\nkubectl get psp <name> -o=jsonpath='{.spec.hostIPC}'\n\n```\n Verify that there is at least one PSP which does not return true.",
        "references": [
            "https://kubernetes.io/docs/concepts/policy/pod-security-policy"
        ],
        "attributes": {},
        "rulesNames": [
            "psp-deny-hostipc"
        ],
        "baseScore": 5.0,
        "impact_statement": "Pods defined with `spec.hostIPC: true` will not be permitted unless they are run under a specific PSP.",
        "default_value": "By default, PodSecurityPolicies are not defined.",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0238",
        "name": "Ensure that the kubeconfig file permissions are set to 644 or more restrictive",
        "description": "If kubelet is running, and if it is configured by a kubeconfig file, ensure that the proxy kubeconfig file has permissions of 644 or more restrictive.",
        "long_description": "The `kubelet` kubeconfig file controls various parameters of the `kubelet` service in the worker node. You should restrict its file permissions to maintain the integrity of the file. The file should be writable by only the administrators on the system.\n\n It is possible to run `kubelet` with the kubeconfig parameters configured as a Kubernetes ConfigMap instead of a file. In this case, there is no proxy kubeconfig file.",
        "remediation": "Run the below command (based on the file location on your system) on the each worker\nnode. For example,\n\n \n```\nchmod 644 <kubeconfig file>\n\n```",
        "manual_test": "SSH to the worker nodes\n\n To check to see if the Kubelet Service is running:\n\n \n```\nsudo systemctl status kubelet\n\n```\n The output should return `Active: active (running) since..`\n\n Run the following command on each node to find the appropriate kubeconfig file:\n\n \n```\nps -ef | grep kubelet\n\n```\n The output of the above command should return something similar to `--kubeconfig /var/lib/kubelet/kubeconfig` which is the location of the kubeconfig file.\n\n Run this command to obtain the kubeconfig file permissions:\n\n \n```\nstat -c %a /var/lib/kubelet/kubeconfig\n\n```\n The output of the above command gives you the kubeconfig file's permissions.\n\n Verify that if a file is specified and it exists, the permissions are `644` or more restrictive.",
        "references": [
            "https://kubernetes.io/docs/admin/kube-proxy/"
        ],
        "attributes": {},
        "rulesNames": [
            "Ensure-that-the-kubeconfig-file-permissions-are-set-to-644-or-more-restrictive"
        ],
        "baseScore": 6,
        "impact_statement": "None.",
        "default_value": "See the AWS EKS documentation for the default value.",
        "scanningScope": {
            "matches": [
                "EKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0284",
        "name": "Ensure that the Kubelet is configured to limit pod PIDS",
        "description": "Ensure that the Kubelet sets limits on the number of PIDs that can be created by pods running on the node.",
        "long_description": "Ensure that the Kubelet sets limits on the number of PIDs that can be created by pods running on the node. By default pods running in a cluster can consume any number of PIDs, potentially exhausting the resources available on the node. Setting an appropriate limit reduces the risk of a denial of service attack on cluster nodes.",
        "remediation": "Decide on an appropriate level for this parameter and set it, either via the `--pod-max-pids` command line parameter or the `PodPidsLimit` configuration file setting.",
        "manual_test": "Review the Kubelet's start-up parameters for the value of --pod-max-pids, and check the Kubelet configuration file for the PodPidsLimit . If neither of these values is set, then there is no limit in place.",
        "references": [
            "https://workbench.cisecurity.org/sections/2633393/recommendations/4262020"
        ],
        "attributes": {},
        "rulesNames": [
            "kubelet-set-pod-limit"
        ],
        "baseScore": 2,
        "impact_statement": "Setting this value will restrict the number of processes per pod. If this limit is lower than the number of PIDs required by a pod it will not operate.",
        "default_value": "By default the number of PIDs is not limited.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0177",
        "name": "Ensure that the --protect-kernel-defaults argument is set to true",
        "description": "Protect tuned kernel parameters from overriding kubelet default kernel parameter values.",
        "long_description": "Kernel parameters are usually tuned and hardened by the system administrators before putting the systems into production. These parameters protect the kernel and the system. Your kubelet kernel defaults that rely on such parameters should be appropriately set to match the desired secured system state. Ignoring this could potentially lead to running pods with undesired kernel behavior.",
        "remediation": "If using a Kubelet config file, edit the file to set `protectKernelDefaults: true`.\n\n If using command line arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and set the below parameter in `KUBELET_SYSTEM_PODS_ARGS` variable.\n\n \n```\n--protect-kernel-defaults=true\n\n```\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```",
        "manual_test": "Run the following command on each node:\n\n \n```\nps -ef | grep kubelet\n\n```\n Verify that the `--protect-kernel-defaults` argument is set to `true`.\n\n If the `--protect-kernel-defaults` argument is not present, check that there is a Kubelet config file specified by `--config`, and that the file sets `protectKernelDefaults` to `true`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126668/recommendations/1838648"
        ],
        "attributes": {},
        "rulesNames": [
            "kubelet-protect-kernel-defaults"
        ],
        "baseScore": 2,
        "impact_statement": "You would have to re-tune kernel parameters to match kubelet parameters.",
        "default_value": "By default, `--protect-kernel-defaults` is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0096",
        "name": "Ensure that the scheduler pod specification file permissions are set to 600 or more restrictive",
        "description": "Ensure that the scheduler pod specification file has permissions of `600` or more restrictive.",
        "long_description": "The scheduler pod specification file controls various parameters that set the behavior of the Scheduler service in the master node. You should restrict its file permissions to maintain the integrity of the file. The file should be writable by only the administrators on the system.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/manifests/kube-scheduler.yaml\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %a /etc/kubernetes/manifests/kube-scheduler.yaml\n\n```\n Verify that the permissions are `600` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838568"
        ],
        "rulesNames": [
            "ensure-that-the-scheduler-pod-specification-file-permissions-are-set-to-600-or-more-restrictive"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `kube-scheduler.yaml` file has permissions of `640`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "CVE-2021-25742-nginx-ingress-snippet-annotation-vulnerability",
        "attributes": {
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Security issue in ingress-nginx where a user that can create or update ingress objects can use the custom snippets feature to obtain all secrets in the cluster (see more at https://github.com/kubernetes/ingress-nginx/issues/7837)",
        "remediation": "To mitigate this vulnerability: 1. Upgrade to a version that allows mitigation (>= v0.49.1 or >= v1.0.1), 2. Set allow-snippet-annotations to false in your ingress-nginx ConfigMap based on how you deploy ingress-nginx",
        "test": "The control checks if the nginx-ingress-controller contains the ability to disable allowSnippetAnnotations and that indeed this feature is turned off",
        "rulesNames": [
            "nginx-ingress-snippet-annotation-vulnerability"
        ],
        "controlID": "C-0059",
        "baseScore": 8.0,
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0141",
        "name": "Ensure that the API Server --encryption-provider-config argument is set as appropriate",
        "description": "Encrypt etcd key-value store.",
        "long_description": "etcd is a highly available key-value store used by Kubernetes deployments for persistent storage of all of its REST API objects. These objects are sensitive in nature and should be encrypted at rest to avoid any disclosures.",
        "remediation": "Follow the Kubernetes documentation and configure a `EncryptionConfig` file. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and set the `--encryption-provider-config` parameter to the path of that file:\n\n \n```\n--encryption-provider-config=</path/to/EncryptionConfig/File>\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--encryption-provider-config` argument is set to a `EncryptionConfig` file. Additionally, ensure that the `EncryptionConfig` file has all the desired `resources` covered especially any secrets.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838674"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-encryption-provider-config-argument-is-set-as-appropriate"
        ],
        "baseScore": 7,
        "impact_statement": "None",
        "default_value": "By default, `--encryption-provider-config` is not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Workload with ConfigMap access",
        "attributes": {
            "controlTypeTags": [
                "security"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Data Collection"
                    ]
                }
            ]
        },
        "description": "This control detects workloads that have mounted ConfigMaps. Workloads with ConfigMap access can potentially expose sensitive information and elevate the risk of unauthorized access to critical resources.",
        "remediation": "Review the workloads identified by this control and assess whether it's necessary to mount these configMaps. Remove configMaps access from workloads that don't require it or ensure appropriate access controls are in place to protect sensitive information.",
        "rulesNames": [
            "workload-mounted-configmap"
        ],
        "test": "Check if any workload has mounted secrets by inspecting their specifications and verifying if secret volumes are defined",
        "controlID": "C-0258",
        "baseScore": 5.0,
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0142",
        "name": "Ensure that encryption providers are appropriately configured",
        "description": "Where `etcd` encryption is used, appropriate providers should be configured.",
        "long_description": "Where `etcd` encryption is used, it is important to ensure that the appropriate set of encryption providers is used. Currently, the `aescbc`, `kms` and `secretbox` are likely to be appropriate options.",
        "remediation": "Follow the Kubernetes documentation and configure a `EncryptionConfig` file. In this file, choose `aescbc`, `kms` or `secretbox` as the encryption provider.",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Get the `EncryptionConfig` file set for `--encryption-provider-config` argument. Verify that `aescbc`, `kms` or `secretbox` is set as the encryption provider for all the desired `resources`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838675"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-encryption-providers-are-appropriately-configured"
        ],
        "baseScore": 7,
        "impact_statement": "None",
        "default_value": "By default, no encryption provider is set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0104",
        "name": "Ensure that the admin.conf file permissions are set to 600",
        "description": "Ensure that the `admin.conf` file has permissions of `600`.",
        "long_description": "The `admin.conf` is the administrator kubeconfig file defining various settings for the administration of the cluster. This file contains private key and respective certificate allowed to fully manage the cluster. You should restrict its file permissions to maintain the integrity and confidentiality of the file. The file should be readable and writable by only the administrators on the system.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/admin.conf\n\n```",
        "manual_test": "Run the following command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %a /etc/kubernetes/admin.conf\n\n```\n Verify that the permissions are `600` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838580"
        ],
        "rulesNames": [
            "ensure-that-the-admin.conf-file-permissions-are-set-to-600"
        ],
        "attributes": {},
        "baseScore": 7,
        "impact_statement": "None.",
        "default_value": "By default, admin.conf has permissions of `600`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Administrative Roles",
        "attributes": {
            "microsoftMitreColumns": [
                "Privilege escalation"
            ],
            "rbacQuery": "Show cluster_admin",
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Attackers who have cluster admin permissions (can perform any action on any resource), can take advantage of their privileges for malicious activities. This control determines which subjects have cluster admin permissions.",
        "remediation": "You should apply least privilege principle. Make sure cluster admin permissions are granted only when it is absolutely necessary. Don't use subjects with such high permissions for daily operations.",
        "rulesNames": [
            "rule-list-all-cluster-admins-v1"
        ],
        "long_description": "Role-based access control (RBAC) is a key security feature in Kubernetes. RBAC can restrict the allowed actions of the various identities in the cluster. Cluster-admin is a built-in high privileged role in Kubernetes. Attackers who have permissions to create bindings and cluster-bindings in the cluster can create a binding to the cluster-admin ClusterRole or to other high privileges roles.",
        "test": "Check which subjects have cluster-admin RBAC permissions \u2013 either by being bound to the cluster-admin clusterrole, or by having equivalent high privileges.  ",
        "controlID": "C-0035",
        "baseScore": 6.0,
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0182",
        "name": "Ensure that the --rotate-certificates argument is not set to false",
        "description": "Enable kubelet client certificate rotation.",
        "long_description": "The `--rotate-certificates` setting causes the kubelet to rotate its client certificates by creating new CSRs as its existing credentials expire. This automated periodic rotation ensures that the there is no downtime due to expired certificates and thus addressing availability in the CIA security triad.\n\n **Note:** This recommendation only applies if you let kubelets get their certificates from the API server. In case your kubelet certificates come from an outside authority/tool (e.g. Vault) then you need to take care of rotation yourself.\n\n **Note:** This feature also require the `RotateKubeletClientCertificate` feature gate to be enabled (which is the default since Kubernetes v1.7)",
        "remediation": "If using a Kubelet config file, edit the file to add the line `rotateCertificates: true` or remove it altogether to use the default value.\n\n If using command line arguments, edit the kubelet service file `/etc/kubernetes/kubelet.conf` on each worker node and remove `--rotate-certificates=false` argument from the `KUBELET_CERTIFICATE_ARGS` variable.\n\n Based on your system, restart the `kubelet` service. For example:\n\n \n```\nsystemctl daemon-reload\nsystemctl restart kubelet.service\n\n```",
        "manual_test": "Run the following command on each node:\n\n \n```\nps -ef | grep kubelet\n\n```\n Verify that the `--rotate-certificates` argument is not present, or is set to `true`.\n\n If the `--rotate-certificates` argument is not present, verify that if there is a Kubelet config file specified by `--config`, that file does not contain `rotateCertificates: false`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126668/recommendations/1838658"
        ],
        "attributes": {},
        "rulesNames": [
            "kubelet-rotate-certificates"
        ],
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, kubelet client certificate rotation is enabled.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0137",
        "name": "Ensure that the API Server --etcd-certfile and --etcd-keyfile arguments are set as appropriate",
        "description": "etcd should be configured to make use of TLS encryption for client connections.",
        "long_description": "etcd is a highly-available key value store used by Kubernetes deployments for persistent storage of all of its REST API objects. These objects are sensitive in nature and should be protected by client authentication. This requires the API server to identify itself to the etcd server using a client certificate and key.",
        "remediation": "Follow the Kubernetes documentation and set up the TLS connection between the apiserver and etcd. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and set the etcd certificate and key file parameters.\n\n \n```\n--etcd-certfile=<path/to/client-certificate-file> \n--etcd-keyfile=<path/to/client-key-file>\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--etcd-certfile` and `--etcd-keyfile` arguments exist and they are set as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838670"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-etcd-certfile-and-etcd-keyfile-arguments-are-set-as-appropriate"
        ],
        "baseScore": 8,
        "impact_statement": "TLS and client certificate authentication must be configured for etcd.",
        "default_value": "By default, `--etcd-certfile` and `--etcd-keyfile` arguments are not set",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0218",
        "name": "Minimize the admission of root containers",
        "description": "Do not generally permit containers to be run as the root user.",
        "long_description": "Containers may run as any Linux user. Containers which run as the root user, whilst constrained by Container Runtime security features still have a escalated likelihood of container breakout.\n\n Ideally, all containers should run as a defined non-UID 0 user.\n\n There should be at least one PodSecurityPolicy (PSP) defined which does not permit root users in a container.\n\n If you need to run root containers, this should be defined in a separate PSP and you should carefully check RBAC controls to ensure that only limited service accounts and users are given permission to access that PSP.",
        "remediation": "Create a PSP as described in the Kubernetes documentation, ensuring that the `.spec.runAsUser.rule` is set to either `MustRunAsNonRoot` or `MustRunAs` with the range of UIDs not including 0.",
        "manual_test": "Get the set of PSPs with the following command:\n\n \n```\nkubectl get psp\n\n```\n For each PSP, check whether running containers as root is enabled:\n\n \n```\nkubectl get psp <name> -o=jsonpath='{.spec.runAsUser.rule}'\n\n```\n Verify that there is at least one PSP which returns `MustRunAsNonRoot` or `MustRunAs` with the range of UIDs not including 0.",
        "references": [
            "https://kubernetes.io/docs/concepts/policy/pod-security-policy/#enabling-pod-security-policies"
        ],
        "attributes": {},
        "rulesNames": [
            "psp-deny-root-container"
        ],
        "baseScore": 6.0,
        "impact_statement": "Pods with containers which run as the root user will not be permitted.",
        "default_value": "By default, PodSecurityPolicies are not defined.",
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "List Kubernetes secrets",
        "attributes": {
            "microsoftMitreColumns": [
                "Credential access"
            ],
            "rbacQuery": "Show who can access secrets",
            "controlTypeTags": [
                "security-impact",
                "compliance"
            ]
        },
        "description": "Attackers who have permissions to access secrets can access sensitive information that might include credentials to various services. This control determines which user, group or service account can list/get secrets.",
        "remediation": "Monitor and approve list of users, groups and service accounts that can access secrets. Use exception mechanism to prevent repetitive the notifications.",
        "rulesNames": [
            "rule-can-list-get-secrets-v1"
        ],
        "long_description": "A Kubernetes secret is an object that lets users store and manage sensitive information, such as passwords and connection strings in the cluster. Secrets can be consumed by reference in the pod configuration. Attackers who have permissions to retrieve the secrets from the API server (by using the pod service account, for example) can access sensitive information that might include credentials to various services.",
        "test": "Alerting on users  which have get/list/watch RBAC permissions on secrets. ",
        "controlID": "C-0015",
        "baseScore": 7.0,
        "example": "@controls/examples/c015.yaml",
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0111",
        "name": "Ensure that the Kubernetes PKI certificate file permissions are set to 600 or more restrictive",
        "description": "Ensure that Kubernetes PKI certificate files have permissions of `600` or more restrictive.",
        "long_description": "Kubernetes makes use of a number of certificate files as part of the operation of its components. The permissions on these files should be set to `600` or more restrictive to protect their integrity.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod -R 600 /etc/kubernetes/pki/*.crt\n\n```",
        "manual_test": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nls -laR /etc/kubernetes/pki/*.crt\n\n```\n Verify that the permissions are `600` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838606"
        ],
        "rulesNames": [
            "ensure-that-the-Kubernetes-PKI-certificate-file-permissions-are-set-to-600-or-more-restrictive"
        ],
        "attributes": {},
        "baseScore": 8,
        "impact_statement": "None",
        "default_value": "By default, the certificates used by Kubernetes are set to have permissions of `644`",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Prefer using secrets as files over secrets as environment variables",
        "controlID": "C-0207",
        "description": "Kubernetes supports mounting secrets as data volumes or as environment variables. Minimize the use of environment variable secrets.",
        "long_description": "It is reasonably common for application code to log out its environment (particularly in the event of an error). This will include any secret values passed in as environment variables, so secrets can easily be exposed to any user or entity who has access to the logs.",
        "remediation": "If possible, rewrite application code to read secrets from mounted secret files, rather than from environment variables.",
        "manual_test": "Run the following command to find references to objects which use environment variables defined from secrets.\n\n \n```\nkubectl get all -o jsonpath='{range .items[?(@..secretKeyRef)]} {.kind} {.metadata.name} {\"\\n\"}{end}' -A\n\n```",
        "test": "Check if pods have secrets in their environment variables",
        "references": [
            "https://workbench.cisecurity.org/sections/1126665/recommendations/1838630"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-secrets-in-env-var"
        ],
        "baseScore": 4,
        "impact_statement": "Application code which expects to read secrets in the form of environment variables would need modification",
        "default_value": "By default, secrets are not defined",
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Secrets",
                "id": "Cat-3"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Workloads with excessive amount of vulnerabilities",
        "attributes": {
            "actionRequired": "configuration",
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Container images with multiple Critical and High sevirity vulnerabilities increase the risk of potential exploit. This control lists all such images according to the threashold provided by the customer.",
        "remediation": "Update your workload images as soon as possible when fixes become available.",
        "rulesNames": [
            "excessive_amount_of_vulnerabilities_pods"
        ],
        "long_description": "Container images with multiple Critical and High sevirity vulnerabilities increase the risk of potential exploit. This control lists all such images according to the threashold provided by the customer.",
        "test": "This control enumerates workloads and checks if they have excessive amount of vulnerabilities in their container images. The threshold of \u201cexcessive number\u201d is configurable.",
        "controlID": "C-0085",
        "baseScore": 6.0,
        "example": "@controls/examples/c85.yaml",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0205",
        "name": "Ensure that the CNI in use supports Network Policies",
        "description": "There are a variety of CNI plugins available for Kubernetes. If the CNI in use does not support Network Policies it may not be possible to effectively restrict traffic in the cluster.",
        "long_description": "Kubernetes network policies are enforced by the CNI plugin in use. As such it is important to ensure that the CNI plugin supports both Ingress and Egress network policies.",
        "remediation": "If the CNI plugin in use does not support network policies, consideration should be given to making use of a different plugin, or finding an alternate mechanism for restricting traffic in the Kubernetes cluster.",
        "manual_test": "Review the documentation of CNI plugin in use by the cluster, and confirm that it supports Ingress and Egress network policies.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126664/recommendations/1838627"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-cni-in-use-supports-network-policies"
        ],
        "baseScore": 4,
        "impact_statement": "None",
        "default_value": "This will depend on the CNI plugin in use.",
        "category": {
            "name": "Network",
            "id": "Cat-4"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Validate admission controller (mutating)",
        "attributes": {
            "microsoftMitreColumns": [
                "Persistence"
            ],
            "controlTypeTags": [
                "security",
                "compliance"
            ]
        },
        "description": "Attackers may use mutating webhooks to intercept and modify all the resources in the cluster. This control lists all mutating webhook configurations that must be verified.",
        "remediation": "Ensure all the webhooks are necessary. Use exception mechanism to prevent repititive notifications.",
        "rulesNames": [
            "list-all-mutating-webhooks"
        ],
        "controlID": "C-0039",
        "baseScore": 4.0,
        "category": {
            "name": "Access control",
            "id": "Cat-2"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Resource limits",
        "attributes": {
            "controlTypeTags": [
                "security"
            ]
        },
        "description": "CPU and memory resources should have a limit set for every container or a namespace to prevent resource exhaustion. This control identifies all the pods without resource limit definitions by checking their yaml definition file as well as their namespace LimitRange objects. It is also recommended to use ResourceQuota object to restrict overall namespace resources, but this is not verified by this control.",
        "remediation": "Define LimitRange and Resource Limits in the namespace or in the deployment/pod manifests.",
        "rulesNames": [
            "resource-policies"
        ],
        "long_description": "CPU and memory resources should have a limit set for every container or a namespace to prevent resource exhaustion. This control identifies all the pods without resource limit definitions by checking their yaml definition file as well as their namespace LimitRange objects. It is also recommended to use ResourceQuota object to restrict overall namespace resources, but this is not verified by this control.",
        "test": " Check for each container if there is a \u2018limits\u2019 field defined for both cpu and memory",
        "controlID": "C-0009",
        "baseScore": 7.0,
        "example": "@controls/examples/c009.yaml",
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0106",
        "name": "Ensure that the scheduler.conf file permissions are set to 600 or more restrictive",
        "description": "Ensure that the `scheduler.conf` file has permissions of `600` or more restrictive.",
        "long_description": "The `scheduler.conf` file is the kubeconfig file for the Scheduler. You should restrict its file permissions to maintain the integrity of the file. The file should be writable by only the administrators on the system.",
        "remediation": "Run the below command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nchmod 600 /etc/kubernetes/scheduler.conf\n\n```",
        "manual_test": "Run the following command (based on the file location on your system) on the Control Plane node. For example,\n\n \n```\nstat -c %a /etc/kubernetes/scheduler.conf\n\n```\n Verify that the permissions are `600` or more restrictive.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838586"
        ],
        "rulesNames": [
            "ensure-that-the-scheduler.conf-file-permissions-are-set-to-600-or-more-restrictive"
        ],
        "attributes": {},
        "baseScore": 6,
        "impact_statement": "None",
        "default_value": "By default, `scheduler.conf` has permissions of `640`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0103",
        "name": "Ensure that the etcd data directory ownership is set to etcd:etcd",
        "description": "Ensure that the etcd data directory ownership is set to `etcd:etcd`.",
        "long_description": "etcd is a highly-available key-value store used by Kubernetes deployments for persistent storage of all of its REST API objects. This data directory should be protected from any unauthorized reads or writes. It should be owned by `etcd:etcd`.",
        "remediation": "On the etcd server node, get the etcd data directory, passed as an argument `--data-dir`, from the below command:\n\n \n```\nps -ef | grep etcd\n\n```\n Run the below command (based on the etcd data directory found above). For example,\n\n \n```\nchown etcd:etcd /var/lib/etcd\n\n```",
        "manual_test": "On the etcd server node, get the etcd data directory, passed as an argument `--data-dir`, from the below command:\n\n \n```\nps -ef | grep etcd\n\n```\n Run the below command (based on the etcd data directory found above). For example,\n\n \n```\nstat -c %U:%G /var/lib/etcd\n\n```\n Verify that the ownership is set to `etcd:etcd`.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126653/recommendations/1838579"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-etcd-data-directory-ownership-is-set-to-etcd-etcd"
        ],
        "baseScore": 7,
        "impact_statement": "None",
        "default_value": "By default, etcd data directory ownership is set to `etcd:etcd`.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0242",
        "name": "Hostile multi-tenant workloads",
        "description": "Currently, Kubernetes environments aren't safe for hostile multi-tenant usage. Extra security features, like Pod Security Policies or Kubernetes RBAC for nodes, efficiently block exploits. For true security when running hostile multi-tenant workloads, only trust a hypervisor. The security domain for Kubernetes becomes the entire cluster, not an individual node.\n\n For these types of hostile multi-tenant workloads, you should use physically isolated clusters. For more information on ways to isolate workloads, see Best practices for cluster isolation in AKS.",
        "long_description": "",
        "remediation": "",
        "manual_test": "",
        "references": [
            "<https://docs.microsoft.com/en-us/azure/aks/operator-best-practices-cluster-isolation>"
        ],
        "attributes": {},
        "rulesNames": [
            "rule-hostile-multitenant-workloads"
        ],
        "baseScore": 5,
        "impact_statement": "",
        "default_value": "",
        "scanningScope": {
            "matches": [
                "AKS"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0138",
        "name": "Ensure that the API Server --tls-cert-file and --tls-private-key-file arguments are set as appropriate",
        "description": "Setup TLS connection on the API server.",
        "long_description": "API server communication contains sensitive parameters that should remain encrypted in transit. Configure the API server to serve only HTTPS traffic.",
        "remediation": "Follow the Kubernetes documentation and set up the TLS connection on the apiserver. Then, edit the API server pod specification file `/etc/kubernetes/manifests/kube-apiserver.yaml` on the master node and set the TLS certificate and private key file parameters.\n\n \n```\n--tls-cert-file=<path/to/tls-certificate-file> \n--tls-private-key-file=<path/to/tls-key-file>\n\n```",
        "manual_test": "Run the following command on the Control Plane node:\n\n \n```\nps -ef | grep kube-apiserver\n\n```\n Verify that the `--tls-cert-file` and `--tls-private-key-file` arguments exist and they are set as appropriate.",
        "references": [
            "https://workbench.cisecurity.org/sections/1126663/recommendations/1838671"
        ],
        "attributes": {},
        "rulesNames": [
            "ensure-that-the-api-server-tls-cert-file-and-tls-private-key-file-arguments-are-set-as-appropriate"
        ],
        "baseScore": 8,
        "impact_statement": "TLS and client certificate authentication must be configured for your Kubernetes cluster deployment.",
        "default_value": "By default, `--tls-cert-file` and `--tls-private-key-file` arguments are not set.",
        "category": {
            "name": "Control plane",
            "id": "Cat-1"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Kubernetes CronJob",
        "attributes": {
            "microsoftMitreColumns": [
                "Persistence"
            ],
            "controlTypeTags": [
                "compliance"
            ]
        },
        "description": "Attackers may use Kubernetes CronJob for scheduling execution of malicious code that would run as a pod in the cluster. This control lists all the CronJobs that exist in the cluster for the user to approve.",
        "remediation": "Watch Kubernetes CronJobs and make sure they are legitimate.",
        "rulesNames": [
            "rule-deny-cronjobs"
        ],
        "long_description": "Kubernetes Job is a controller that creates one or more pods and ensures that a specified number of them successfully terminate. Kubernetes Job can be used to run containers that perform finite tasks for batch jobs. Kubernetes CronJob is used to schedule Jobs. Attackers may use Kubernetes CronJob for scheduling execution of malicious code that would run as a container in the cluster.",
        "test": "We list all CronJobs that exist in cluster for the user to approve.",
        "controlID": "C-0026",
        "baseScore": 1.0,
        "category": {
            "name": "Workload",
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster"
            ]
        },
        "rules": []
    },
    {
        "name": "Ensure CPU limits are set",
        "attributes": {
            "controlTypeTags": [
                "compliance",
                "devops",
                "security"
            ],
            "attackTracks": [
                {
                    "attackTrack": "service-destruction",
                    "categories": [
                        "Denial of service"
                    ]
                }
            ]
        },
        "description": "This control identifies all Pods for which the CPU limits are not set.",
        "remediation": "Set the CPU limits or use exception mechanism to avoid unnecessary notifications.",
        "rulesNames": [
            "resources-cpu-limits"
        ],
        "controlID": "C-0270",
        "baseScore": 8.0,
        "category": {
            "name": "Workload",
            "subCategory": {
                "name": "Resource management",
                "id": "Cat-7"
            },
            "id": "Cat-5"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "name": "Workload with secret access",
        "attributes": {
            "controlTypeTags": [
                "security"
            ],
            "attackTracks": [
                {
                    "attackTrack": "workload-external-track",
                    "categories": [
                        "Secret Access"
                    ]
                }
            ]
        },
        "description": "This control identifies workloads that have mounted secrets. Workloads with secret access can potentially expose sensitive information and increase the risk of unauthorized access to critical resources.",
        "remediation": "Review the workloads identified by this control and assess whether it's necessary to mount these secrets. Remove secret access from workloads that don't require it or ensure appropriate access controls are in place to protect sensitive information.",
        "rulesNames": [
            "workload-mounted-secrets"
        ],
        "test": "Check if any workload has mounted secrets by inspecting their specifications and verifying if secret volumes are defined.",
        "controlID": "C-0255",
        "baseScore": 8.0,
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    },
    {
        "controlID": "C-0192",
        "name": "Ensure that the cluster has at least one active policy control mechanism in place",
        "description": "Every Kubernetes cluster should have at least one policy control mechanism in place to enforce the other requirements in this section. This could be the in-built Pod Security Admission controller, or a third party policy control system.",
        "long_description": "Without an active policy control mechanism, it is not possible to limit the use of containers with access to underlying cluster nodes, via mechanisms like privileged containers, or the use of hostPath volume mounts.",
        "remediation": "Ensure that either Pod Security Admission or an external policy control system is in place for every namespace which contains user workloads.",
        "manual_test": "Pod Security Admission is enabled by default on all clusters using Kubernetes 1.23 or higher. To assess what controls, if any, are in place using this mechanism, review the namespaces in the cluster to see if the[required labels](https://kubernetes.io/docs/concepts/security/pod-security-admission/#pod-security-admission-labels-for-namespaces) have been applied\n\n \n```\nkubectl get namespaces -o yaml\n\n```\n To confirm if any external policy control system is in use, review the cluster for the presence of `validatingadmissionwebhook` and `mutatingadmissionwebhook` objects.\n\n \n```\nkubectl get validatingwebhookconfigurations\n\n```\n \n```\nkubectl get mutatingwebhookconfigurations\n\n```",
        "test": "Checks that every namespace enabled pod security admission, or if there are external policies applied for namespaced resources (validating/mutating webhooks)",
        "references": [
            "https://workbench.cisecurity.org/sections/1126662/recommendations/1838600"
        ],
        "attributes": {},
        "rulesNames": [
            "pod-security-admission-applied-1",
            "pod-security-admission-applied-2"
        ],
        "baseScore": 4,
        "impact_statement": "Where policy control systems are in place, there is a risk that workloads required for the operation of the cluster may be stopped from running. Care is required when implementing admission control policies to ensure that this does not occur.",
        "default_value": "By default, Pod Security Admission is enabled but no policies are in place.",
        "category": {
            "name": "Network",
            "id": "Cat-4"
        },
        "scanningScope": {
            "matches": [
                "cluster",
                "file"
            ]
        },
        "rules": []
    }
]