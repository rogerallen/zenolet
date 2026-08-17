// --- Gutenberg EPUB3 Unpacker & Document Stitcher for Zenolet ---
import { unzipSync, strFromU8 } from 'fflate';

export interface EpubChapter {
  title: string;
  href: string;
  anchorId: string;
}

export interface ParsedEpub {
  title: string;
  author: string;
  htmlContent: string;
  chapters: EpubChapter[];
  coverDataUrl?: string;
}

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
  fullPath: string;
}

/**
 * Normalizes relative paths inside a zip archive.
 */
function resolveZipPath(baseDir: string, relativePath: string): string {
  if (!relativePath) return '';
  if (relativePath.startsWith('/')) {
    return relativePath.slice(1);
  }

  const combined = baseDir ? `${baseDir}/${relativePath}` : relativePath;
  const parts = combined.split('/');
  const resolved: string[] = [];

  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  return resolved.join('/');
}

/**
 * Converts a Uint8Array byte buffer to a base64 Data URL.
 */
function uint8ArrayToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = '';
  const len = bytes.byteLength;
  const CHUNK_SIZE = 8192;

  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}

/**
 * Parses an EPUB archive ArrayBuffer into clean, unified HTML with inlined assets and chapter TOC.
 */
export function parseEpubArchive(buffer: ArrayBuffer): ParsedEpub {
  const zipEntries = unzipSync(new Uint8Array(buffer));
  const fileKeys = Object.keys(zipEntries);

  // 1. Locate META-INF/container.xml
  const containerKey = fileKeys.find((k) => k.toLowerCase() === 'meta-inf/container.xml');
  if (!containerKey || !zipEntries[containerKey]) {
    throw new Error('[Zenolet EPUB] Invalid EPUB archive: missing META-INF/container.xml');
  }

  const containerXml = strFromU8(zipEntries[containerKey]);
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, 'application/xml');

  const rootfileEl = containerDoc.querySelector('rootfile[full-path]');
  const opfPath = rootfileEl ? rootfileEl.getAttribute('full-path') : null;
  if (!opfPath) {
    throw new Error('[Zenolet EPUB] Invalid container.xml: missing rootfile path');
  }

  // 2. Locate and parse OPF Package document
  const opfKey = fileKeys.find((k) => k.toLowerCase() === opfPath.toLowerCase());
  if (!opfKey || !zipEntries[opfKey]) {
    throw new Error(`[Zenolet EPUB] Missing OPF package document at: ${opfPath}`);
  }

  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : '';
  const opfXml = strFromU8(zipEntries[opfKey]);
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');

  // 3. Extract Metadata
  const titleEl = opfDoc.querySelector('title, dc\\:title');
  const creatorEl = opfDoc.querySelector('creator, dc\\:creator');
  const title = titleEl?.textContent?.trim() || 'Untitled Book';
  const author = creatorEl?.textContent?.trim() || 'Project Gutenberg';

  // 4. Extract Manifest Items
  const manifestMap = new Map<string, ManifestItem>();
  const itemEls = Array.from(opfDoc.querySelectorAll('manifest > item'));

  for (const item of itemEls) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const mediaType = item.getAttribute('media-type') || '';
    const properties = item.getAttribute('properties') || undefined;

    if (id && href) {
      const fullPath = resolveZipPath(opfDir, href);
      manifestMap.set(id, { id, href, mediaType, properties, fullPath });
    }
  }

  // 5. Extract Images and convert to in-memory Base64 Data URLs
  const imageMap = new Map<string, string>();
  let coverDataUrl: string | undefined;

  for (const [, item] of manifestMap) {
    if (item.mediaType.startsWith('image/')) {
      const matchedKey = fileKeys.find((k) => k.toLowerCase() === item.fullPath.toLowerCase());
      if (matchedKey && zipEntries[matchedKey]) {
        const dataUrl = uint8ArrayToDataUrl(zipEntries[matchedKey], item.mediaType);
        imageMap.set(item.fullPath.toLowerCase(), dataUrl);
        imageMap.set(item.href.toLowerCase(), dataUrl);

        // Check if item is designated as cover
        if (item.properties?.includes('cover-image') || item.id.toLowerCase().includes('cover')) {
          coverDataUrl = dataUrl;
        }
      }
    }
  }

  // 6. Extract Spine Reading Order
  const spineItemRefs = Array.from(opfDoc.querySelectorAll('spine > itemref'));
  const spineItems: ManifestItem[] = [];

  for (const ref of spineItemRefs) {
    const idref = ref.getAttribute('idref');
    if (idref && manifestMap.has(idref)) {
      spineItems.push(manifestMap.get(idref)!);
    }
  }

  // 7. Extract Table of Contents (nav.xhtml or toc.ncx)
  const chapters: EpubChapter[] = [];

  // 7a. Check for EPUB3 nav.xhtml (properties="nav")
  const navItem = Array.from(manifestMap.values()).find((item) => item.properties?.includes('nav'));
  if (navItem) {
    const navKey = fileKeys.find((k) => k.toLowerCase() === navItem.fullPath.toLowerCase());
    if (navKey && zipEntries[navKey]) {
      const navHtml = strFromU8(zipEntries[navKey]);
      const navDoc = parser.parseFromString(navHtml, 'text/html');
      const navLinks = Array.from(navDoc.querySelectorAll('nav[epub\\:type="toc"] a, nav a'));

      for (const link of navLinks) {
        const linkTitle = link.textContent?.trim() || '';
        const href = link.getAttribute('href') || '';
        if (linkTitle && href) {
          const cleanHref = href.includes('#') ? href.split('#')[1] : href;
          chapters.push({
            title: linkTitle,
            href,
            anchorId: `ch-target-${cleanHref}`
          });
        }
      }
    }
  }

  // 7b. Fallback: Check for EPUB2 toc.ncx
  if (chapters.length === 0) {
    const ncxItem = Array.from(manifestMap.values()).find(
      (item) => item.mediaType === 'application/x-dtbncx+xml' || item.href.endsWith('.ncx')
    );
    if (ncxItem) {
      const ncxKey = fileKeys.find((k) => k.toLowerCase() === ncxItem.fullPath.toLowerCase());
      if (ncxKey && zipEntries[ncxKey]) {
        const ncxXml = strFromU8(zipEntries[ncxKey]);
        const ncxDoc = parser.parseFromString(ncxXml, 'application/xml');
        const navPoints = Array.from(ncxDoc.querySelectorAll('navPoint'));

        for (const np of navPoints) {
          const label = np.querySelector('navLabel > text')?.textContent?.trim();
          const src = np.querySelector('content')?.getAttribute('src') || '';
          if (label && src) {
            const cleanHref = src.includes('#') ? src.split('#')[1] : src;
            chapters.push({
              title: label,
              href: src,
              anchorId: `ch-target-${cleanHref}`
            });
          }
        }
      }
    }
  }

  /**
   * Parses an XHTML chapter document, preserving self-closing elements (like <a id="..."/>)
   * and falling back cleanly to HTML5 with pre-expanded non-void self-closing tags.
   */
  function parseChapterDoc(rawText: string, parser: DOMParser): Document {
    try {
      const doc = parser.parseFromString(rawText, 'application/xhtml+xml');
      if (!doc.querySelector('parsererror')) {
        return doc;
      }
    } catch (_) {
      // Fallback to HTML parser below
    }

    // Pre-expand self-closing non-void tags (e.g. <a id="..."/> -> <a id="..."></a>) so HTML5 parser doesn't wrap the rest of the chapter
    const expandedHtml = rawText.replace(
      /<(a|span|div|p|h1|h2|h3|h4|h5|h6|li|ol|ul|i|b|em|strong)([^>]*?)\/>/gi,
      '<$1$2></$1>'
    );
    return parser.parseFromString(expandedHtml, 'text/html');
  }

  // 8. Stitch Spine XHTML Chapters into Unified Clean HTML
  const chapterHtmlSections: string[] = [];

  spineItems.forEach((spineItem, chapterIndex) => {
    const chapterKey = fileKeys.find((k) => k.toLowerCase() === spineItem.fullPath.toLowerCase());
    if (!chapterKey || !zipEntries[chapterKey]) return;

    const chapterRawText = strFromU8(zipEntries[chapterKey]);
    const chapterDoc = parseChapterDoc(chapterRawText, parser);

    // Remove legacy scripts, external styles, and publisher headers
    chapterDoc.querySelectorAll('script, link[rel="stylesheet"], style').forEach((n) => n.remove());

    const chapterDir = spineItem.fullPath.includes('/')
      ? spineItem.fullPath.substring(0, spineItem.fullPath.lastIndexOf('/'))
      : '';

    // Rewrite inline <img> sources with inlined Data URLs
    chapterDoc.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src');
      if (src) {
        const resolvedImgPath = resolveZipPath(chapterDir, src).toLowerCase();
        const dataUrl = imageMap.get(resolvedImgPath) || imageMap.get(src.toLowerCase());
        if (dataUrl) {
          img.setAttribute('src', dataUrl);
          img.removeAttribute('width');
          img.removeAttribute('height');
          img.style.maxWidth = '100%';
          img.style.maxHeight = 'calc(100vh - 160px)';
          img.style.height = 'auto';
          img.style.objectFit = 'contain';
        }
      }
    });

    // Normalize SVG-wrapped cover images into standard <img>
    chapterDoc.querySelectorAll('svg').forEach((svg) => {
      const svgImage = svg.querySelector('image');
      if (svgImage) {
        const href = svgImage.getAttribute('xlink:href') || svgImage.getAttribute('href');
        if (href) {
          const resolvedImgPath = resolveZipPath(chapterDir, href).toLowerCase();
          const dataUrl = imageMap.get(resolvedImgPath) || imageMap.get(href.toLowerCase());
          if (dataUrl) {
            const newImg = document.createElement('img');
            newImg.setAttribute('src', dataUrl);
            newImg.style.maxWidth = '100%';
            newImg.style.maxHeight = 'calc(100vh - 160px)';
            newImg.style.height = 'auto';
            newImg.style.objectFit = 'contain';
            svg.replaceWith(newImg);
          }
        }
      }
    });

    // Prefix element IDs to avoid collisions between chapters
    chapterDoc.querySelectorAll('[id]').forEach((el) => {
      const origId = el.getAttribute('id');
      if (origId) {
        el.setAttribute('id', `c${chapterIndex}_${origId}`);
        // Register chapter marker target
        el.classList.add('epub-anchor-target');
      }
    });

    // Rewrite intra-chapter anchor links (#anchor and rel.xhtml#anchor)
    chapterDoc.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (href) {
        if (href.startsWith('#')) {
          a.setAttribute('href', `#c${chapterIndex}_${href.slice(1)}`);
        } else if (href.includes('#')) {
          const [filePart, anchorPart] = href.split('#');
          const targetSpineIdx = spineItems.findIndex((s) => s.href.endsWith(filePart));
          if (targetSpineIdx !== -1) {
            a.setAttribute('href', `#c${targetSpineIdx}_${anchorPart}`);
          }
        }
      }
    });

    const bodyContent = chapterDoc.body ? chapterDoc.body.innerHTML : chapterRawText;
    if (bodyContent.trim().length > 0) {
      chapterHtmlSections.push(
        `<section class="epub-chapter" id="ch-${chapterIndex}" data-chapter-index="${chapterIndex}">\n${bodyContent}\n</section>`
      );
    }
  });

  const htmlContent = chapterHtmlSections.join('\n<hr class="epub-chapter-separator">\n');

  return {
    title,
    author,
    htmlContent,
    chapters,
    coverDataUrl
  };
}
