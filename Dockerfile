FROM busybox@sha256:1487d0af5f52b4ba31c7e465126ee2123fe3f2305d638e7827681e7cf6c83d5e

COPY kubescape-plugin /plugins/kubescape-plugin/

USER 1001 
