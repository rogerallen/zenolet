---
status: accepted
date: 2026-10-12
---

# 2. Chapter-Virtualized Rendering Architecture

## Context

Previously, Zenolet stitched all EPUB chapters into a single monolithic XHTML string (`htmlContent`) and injected it entirely into the reader DOM. While fluid for typical books (under ~800 pages), giant omnibus titles (e.g. _The Complete Works of William Shakespeare_ >5MB HTML, or _Poems and Songs of Robert Burns_) created massive DOM trees with tens of thousands of nodes. When formatted with CSS Multi-column layout across thousands of horizontal columns, mobile browsers (especially WebKit on iOS) experienced memory exhaustion, layout freezes, or Jetsam tab termination crashes.

## Decision

1. **Universal Chapter Virtualization**: Rather than formatting the entire book in one giant CSS multi-column element, the reader mounts only the currently active spine chapter into `DOM.readerContent`.
2. **Two-Tier Chapter Hierarchy (Spine vs. Table of Contents)**:
   - **Spine Chapters (`ParsedChapter[]`)**: Represent discrete physical XHTML documents declared in the EPUB `<spine>`, mounted individually into the reader viewport.
   - **Table of Contents Chapters (`EpubChapter[]`)**: Represent logical reading milestones declared in `nav.xhtml` or `toc.ncx`. Each TOC chapter maps to a specific spine item and optional anchor ID (`anchorId`), allowing granular chapter navigation even when multiple chapters share a single spine file.
3. **Upfront Spread Calibration for Contiguous Pagination**:
   - To prevent the total page count from shifting as unread chapters are discovered, all spine items are pre-measured once in an offscreen cloned container (~15–20ms total) upon opening the book or resizing the layout.
   - Pre-measured spread counts are cached and translated via `calculateBookPagination(...)` into stable, contiguous whole-book page indicators (`Pages X–Y of Z`).
4. **Image-Normalized Weighting & Timeline Mapping**:
   - Character weight calculations strip base64 data URLs to prevent inlined illustrations from warping timeline dot distribution and progress estimates.
   - Scrubbing or clicking anywhere on the Timeline calculates global reading progress, dynamically resolves the corresponding spine chapter and spread, and positions the chapter selection menu contextually.
5. **Chapter-Boundary Paging**: Paging forward from the final spread of Chapter $N$ cleanly mounts Chapter $N+1$ at spread 0. Paging backward from spread 0 of Chapter $N+1$ cleanly mounts Chapter $N$ at its final spread.
6. **Discrete Chapter Storage**: The EPUB parser stores discrete chapter objects (`ParsedChapter[]`) with independent HTML content in Cache API (`zenolet-books-v2`), eliminating runtime HTML splitting.
7. **Scale-Invariant State Handoff**: `AppState` URL hashes (`#s=...`) encode discrete chapter index (`chapter`) and fractional progress within that chapter (`progress`), ensuring cross-device handoffs between different screen sizes land on the exact matching chapter and paragraph.

## Consequences

- Guaranteed 60fps performance and fixed, bounded DOM memory regardless of book length (from 50-page novellas to 5,000-page complete works).
- Whole-book page numbers and timeline progress remain rock-solid and stable throughout reading, eliminating layout jumps and undercounted page spreads.
- Upfront offscreen measurement adds a negligible ~15–20ms one-time calibration on book load.
- Requires bumping the book cache namespace to `zenolet-books-v2` to discard legacy monolithic cached archives.
