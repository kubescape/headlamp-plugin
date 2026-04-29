---
name: Always run format and lint-fix after changes
description: After any code change, run npm run format and npm run lint-fix before considering work done
type: feedback
---

Always run `npm run format` and `npm run lint-fix` after making code changes.

**Why:** Keeps code style consistent and avoids leaving lint warnings from new code.

**How to apply:** After editing any TypeScript/TSX files, run both commands before reporting the task complete.
