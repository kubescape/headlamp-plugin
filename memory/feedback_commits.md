---
name: Commits must be signed by the author
description: Always use -S flag when committing so commits are GPG-signed by the author
type: feedback
---

Always use `git commit -s` so commits include a `Signed-off-by` trailer.

**Why:** User's preference; keeps commit authorship explicit.

**How to apply:** Add `-s` to every `git commit` invocation.
