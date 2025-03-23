FROM busybox:latest

COPY kubescape-plugin /plugins/kubescape-plugin/

USER 1001 