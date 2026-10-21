# Zenolet

The most convenient way to read a curated selection of free ebooks: a serverless, privacy-first, horizontal page-flowing Progressive Web Application for reading online and offline.

## Language

**Bookshelf**:
A dynamic responsive grid holding the user's currently downloaded offline reading books, terminating in a single Add Book Trigger.
_Avoid_: Fixed shelf, library grid, slot grid

**Add Book Trigger**:
The single trailing action card on the Bookshelf used to open the catalog search and download an additional book.
_Avoid_: Empty slot, blank card, placeholder slot

**Bookshelf Card**:
A visual card on the Bookshelf representing a single downloaded book, displaying title, author, cover art, reading progress, and a deletion trigger.
_Avoid_: Slot, shelf item, book slot

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

**Spine**:
The linear document reading order defined in an EPUB package (`<spine>`), specifying the sequential array of content documents that compose the book.
_Avoid_: Chapter order, book manifest, playlist

**Spine Item**:
A discrete XHTML document referenced by the Spine (packaged as `ParsedChapter` in Zenolet) that is mounted individually into the reader viewport during chapter virtualization.
_Avoid_: Chunk, HTML section, page file, chapter file

**Table of Contents Chapter**:
A navigation entry defined in the EPUB navigation document (`nav.xhtml` or `toc.ncx`), mapped to an anchor or relative target within a Spine Item.
_Avoid_: Subchapter, TOC link, heading target

**Chapter Boundary**:
The transition point between adjacent chapters where reading advances to page spread 1 of the next chapter.
_Avoid_: Chapter break, page gap

**State Handoff**:
A compressed, URL-safe hash payload (`#s=...`) encoding point-in-time book coordinates (book ID, chapter, progress fraction, reader preferences) for one-shot cross-device transfer via QR code or link.
_Avoid_: Sync, cloud sync, file transfer, share link, sync token, deep link

**Curated Micro-Library**:
A lightweight, distraction-free collection of literary classics focused on reading quality and sovereign offline portability, distinct from an all-in-one personal ebook archive.
_Avoid_: Ebook archive, Calibre replacement, reader cloud, library database

**Storage Durability**:
The browser-governed persistence lifecycle of offline Cache API book assets and reading progress, protected against disk pressure eviction via persistent storage permissions (`navigator.storage.persist()`) and standalone PWA installation.
_Avoid_: Permanent storage, cloud backup, guaranteed cache
