## How to release

#### Github workflow

Run github workflow `pre-release`

- Specify the version, e.g. v1.0.0.
- Build will run and generate a tar and container image 
- artifacthub-pkg.yml and package.json are updated and commit to GitHub.
- The workflow will generate a tag and a release.

### Finalize release

After the release has been prepared:

- Update release notes
- Unflag pre-release
