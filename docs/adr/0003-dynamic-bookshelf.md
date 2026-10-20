---
status: accepted
date: 2026-10-19
---

# 3. Dynamic Bookshelf with Single Append Trigger

## Context

Originally, Zenolet enforced a rigid 8-slot bookshelf layout (`(BookMetadata | null)[]` of fixed length 8). Empty slots were labeled with ordinal indicators ("Slot 1", "Slot 2", ..., "Slot 8"), and deleting a book from an interior position left an empty slot placeholder behind to maintain index stability.

While this provided spatial stability in the early prototype, it introduced several user experience and architectural limitations:

1. **Arbitrary 8-Book Limit**: Readers who wanted more than 8 books offline were artificially blocked, even when abundant browser storage quota remained.
2. **Visual Clutter & Sparsity**: An empty library displayed eight empty slot cards, and deleting a book left disconnected gaps between books.
3. **Clunky Numbered Slot Vocabulary**: Labeling positions as "Slot 3" exposed internal mechanical indices to users instead of treating the bookshelf as a natural personal library.

## Decision

1. **Dynamic Bookshelf Collection**: The Bookshelf is modeled as a dynamic list of downloaded offline books (`BookMetadata[]`), removing the 8-book cap. Storage is bounded only by the host browser's available storage quota.
2. **Single Append Trigger**: When empty, the shelf displays exactly one card: the **Add Book Trigger** (`+ Add Book`). When books are present, the shelf renders all active books followed by exactly one trailing Add Book Trigger.
3. **Compacting on Deletion**: Removing a book removes its card and compacts the shelf forward, ensuring no empty gaps exist between books.
4. **Explicit Deletion Confirmation Modal**: Clicking the "X" button on a book card opens an accessible in-app confirmation modal dialog (`role="dialog"`, `aria-modal="true"`, focus trapped, default focus on "Cancel") requiring user confirmation before purging cached EPUB assets and reading progress.
5. **Elimination of "Slot N" Vocabulary**: All user-facing references to "Slot N" are removed from UI labels, sub-text, tooltips, and accessibility strings in favor of book titles and clean library actions.
6. **Backward-Compatible Migration**: Existing sparse 8-slot arrays in `zenolet-slots` localStorage are migrated seamlessly on read by filtering out `null` entries.
7. **Append-Only State Handoff**: Opening a book via URL hash (`#s=...`) or QR code handoff that is not yet on the shelf appends it to the end without replacing or shifting existing books.

## Consequences

- The user experience is significantly simpler and more welcoming: an initial clean single "+ Add Book" card that grows naturally as books are added.
- Deleting books with confirmation prevents accidental data loss and keeps the shelf tidy and contiguous.
- Storage capacity scales with user device capabilities rather than an arbitrary constant.
- Existing tests and documentation referencing fixed 8 slots are updated to the dynamic bookshelf specification.
