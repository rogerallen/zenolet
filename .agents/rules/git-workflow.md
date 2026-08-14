# Git & Safety Workflow Rules

- **Commit & Push Confirmation**:
  - **NEVER** run `git push` without asking for explicit user confirmation first.
  - **ALWAYS** summarize the exact modified files and proposed commit message before making git commits or pushing.
- **Automated Verification**:
  - Run `npx vitest run` and `npm run build` to verify clean compilation and zero failing tests before proposing a commit or release.
- **Local Testing**:
  - Use `npm run dev:local` for single-command local testing (runs local Cloudflare Worker proxy on port 8787 and Vite UI on port 5173 concurrently).
