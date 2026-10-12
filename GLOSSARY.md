# Zenolet

A serverless, privacy-first, horizontal page-flowing Progressive Web Application for reading public domain literature online and offline.

## Language

**Bookshelf**:
A fixed 8-slot discrete grid holding the user's currently downloaded or active reading books.
_Avoid_: Library grid, book list, shelf list

**Slot**:
One of exactly eight indexed positions (0 through 7) on the Bookshelf, containing either book metadata or an empty state.
_Avoid_: Shelf item, shelf index, book entry

**Curator**:
The maintainer who forks and configures a Zenolet instance with custom library metadata, branding, and a curated book catalog.
_Avoid_: Admin, librarian, site owner

**Catalog**:
The static, curated list of books bundled with the library instance and searched entirely in-memory client-side.
_Avoid_: Database, book repository, search index

**Page Spread**:
The horizontal viewport window displaying 1, 2, or 3 CSS columns of book text simultaneously.
_Avoid_: Screen, view, page flip

**Timeline**:
The scrubbable reading progress track at the bottom of the reader displaying chapter markers and current reading position.
_Avoid_: Progress bar, scrubber, seek bar

**Chapter Marker**:
A discrete visual milestone on the Timeline representing an EPUB Table of Contents chapter or major heading.
_Avoid_: Chapter dot, milestone, tick

**State Handoff**:
A compressed, URL-safe hash payload (`#s=...`) encoding book ID, progress fraction, and reader preferences for QR code or cross-device transfer.
_Avoid_: Share link, sync token, deep link
