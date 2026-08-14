# Semantic Versioning Rules

- Follow `MAJOR.MINOR.BUGFIX` (Semantic Versioning).
- Pre-1.0: `MAJOR = 0`. Start at `0.1.0` and increment `MINOR` on feature additions and deployments (e.g. `0.1.0` -> `0.2.0` -> `0.3.0`).
- Post-1.0: Increment `MAJOR` for breaking changes, `MINOR` for backwards-compatible features, and `BUGFIX` for patches.
- Synchronize version numbers across `package.json`, `index.html` (`version-tag`), and `README.md` on every release bump.
