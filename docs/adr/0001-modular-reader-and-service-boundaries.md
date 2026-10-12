---
status: accepted
date: 2026-10-12
---

# 1. Modular Reader and Service Boundaries

To improve maintainability, reduce parameter sprawl, and eliminate untested monolithic orchestration in `main.ts`, Zenolet decomposes application logic into dedicated, independently testable boundaries:

1. **Book Loading Pipeline (`src/services/bookLoader.ts`)**: Unifies candidate URL fallback traversal, Cloudflare Worker proxy downloading, EPUB archive parsing, and Cache API offline persistence into a single isolated service with automated unit test coverage.
2. **Reader Context Encapsulation (`ReaderContext`)**: Replaces multi-argument signatures (up to 10 parameters) across layout, pagination, and timeline calculation with a cohesive context structure.
3. **Dedicated Input & Accessibility Controllers (`src/components/Navigation.ts`)**: Extracts keyboard navigation, modal focus trapping, and internal link routing into pure, testable handlers exercised directly by integration tests.
