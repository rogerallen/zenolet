# Zenolet Documentation Index

Welcome to the **Zenolet** documentation directory. This folder contains architectural guides, decision records, curation handbooks, and domain terminology for the Zenolet sovereign reader engine.

---

## 📚 Table of Contents

### 1. [Curator's Guide (`curating.md`)](./curating.md)

A comprehensive, step-by-step handbook for library curators and forkers. Explains how to customize your library identity (`curator/config.json`), manage your book catalog (`curator/catalog.json`), set up your Cloudflare Worker CORS proxy, and deploy to static hosts like GitHub Pages or Cloudflare Pages without writing reader engine code.

### 2. [Reader Engine Architecture (`reader-engine.md`)](./reader-engine.md)

The core technical and architectural breakdown of Zenolet's horizontal, book-like reading engine. Covers:

- CSS multi-column layout and column sizing
- Hardware-accelerated CSS scroll snapping
- Chapter virtualization and two-tier chapter mapping
- Scale-invariant reading progress math and continuous page indicators
- Touch gestures and keyboard navigation

### 3. [Domain Glossary (`glossary.md`)](./glossary.md)

The ubiquitous language dictionary for Zenolet. Standardizes terms such as _Bookshelf_, _Slot_, _Curator_, _Spine_, _Spine Item_, _Table of Contents Chapter_, _Page Spread_, and _State Handoff_, while clarifying terms to avoid.

### 4. [Architectural Decision Records (`adr/`)](./adr/)

Formal records documenting significant architectural and design choices:

- **[ADR-0001: Modular Reader and Service Boundaries](./adr/0001-modular-reader-and-service-boundaries.md)**: Architectural boundaries between UI components, services, and the Cloudflare proxy.
- **[ADR-0002: Chapter-Virtualized Rendering Architecture](./adr/0002-chapter-virtualized-rendering.md)**: Two-tier spine vs. TOC architecture, upfront spread calibration, and bounded memory rendering.
- **[ADR-0003: Dynamic Bookshelf with Single Append Trigger](./adr/0003-dynamic-bookshelf.md)**: Dynamic offline library sizing, single append trigger, confirmation deletion modal, and compaction.
- **[ADR-0004: One-Shot State Handoff without Backend Synchronization](./adr/0004-one-shot-state-handoff.md)**: Stateless point-in-time cross-device coordinate transfer, independent divergence, and connection requirements.
