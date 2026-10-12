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

**Chapter Virtualization**:
The rendering architecture that mounts only the active chapter into the reader DOM, bounded memory usage and eliminating multi-column layout thrashing on large books.
_Avoid_: Lazy loading, DOM pagination, infinite scroll

**Spine Chapter**:
A discrete XHTML document element defined in the EPUB spine (`<spine>`), packaged in `ParsedChapter` and mounted individually into the reader viewport during virtualization.
_Avoid_: Chunk, HTML section, page file

**Table of Contents Chapter**:
A navigation entry defined in the EPUB navigation document (`nav.xhtml` or `toc.ncx`), mapped to an anchor or relative target within a Spine Chapter.
_Avoid_: Subchapter, TOC link, heading target

**Chapter Boundary**:
The transition point between adjacent chapters where reading advances to page spread 1 of the next chapter.
_Avoid_: Chapter break, page gap

**State Handoff**:
A compressed, URL-safe hash payload (`#s=...`) encoding book ID, progress fraction, and reader preferences for QR code or cross-device transfer.
_Avoid_: Share link, sync token, deep link
