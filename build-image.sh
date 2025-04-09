rm -rf dist 

npm run build
make build 
make download

docker build -f Dockerfile.local . -t mgalesloot/kubescape-headlamp-plugin:latest

docker push  mgalesloot/kubescape-headlamp-plugin:latest
