import { describe, it, expect } from 'vitest';

describe('Gutenberg Metadata & Boilerplate Processing', () => {
  it('extracts Title and Author correctly from plain text Gutenberg headers', () => {
    const rawHeader = `
The Project Gutenberg eBook of Frankenstein; Or, The Modern Prometheus
Title: Frankenstein; Or, The Modern Prometheus
Author: Mary Wollstonecraft (Shelley) Shelley
Release Date: October 31, 1993 [eBook #84]
Language: English

*** START OF THE PROJECT GUTENBERG EBOOK FRANKENSTEIN ***
Chapter 1
It was a dark and stormy night...
`;

    let title = 'Unknown Title';
    let author = 'Unknown Author';

    const startMarker = rawHeader.indexOf('*** START OF');
    const header = startMarker > 0 ? rawHeader.substring(0, startMarker) : rawHeader.substring(0, 2000);

    const titleMatch = header.match(/^Title:\s*(.+)$/m);
    if (titleMatch) title = titleMatch[1].trim();

    const authorMatch = header.match(/^Author:\s*(.+)$/m);
    if (authorMatch) author = authorMatch[1].trim();

    expect(title).toBe('Frankenstein; Or, The Modern Prometheus');
    expect(author).toBe('Mary Wollstonecraft (Shelley) Shelley');
  });

  it('strips Gutenberg license boilerplate cleanly', () => {
    const textWithBoilerplate = `
Boilerplate Header
*** START OF THE PROJECT GUTENBERG EBOOK ALICE ***
Chapter 1: Down the Rabbit Hole
Alice was beginning to get very tired of sitting by her sister...
*** END OF THE PROJECT GUTENBERG EBOOK ALICE ***
Boilerplate Footer
`;

    const startMatch = textWithBoilerplate.match(/\*\*\*\s*START OF TH(?:IS|E) PROJECT GUTENBERG EBOOK[^\r\n]*\*\*\*/i);
    const endMatch = textWithBoilerplate.match(/\*\*\*\s*END OF TH(?:IS|E) PROJECT GUTENBERG EBOOK[^\r\n]*\*\*\*/i);

    let content = textWithBoilerplate;
    if (startMatch && startMatch.index !== undefined) {
      content = content.substring(startMatch.index + startMatch[0].length);
    }
    if (endMatch && endMatch.index !== undefined) {
      const endPosInContent = content.search(/\*\*\*\s*END OF TH(?:IS|E) PROJECT GUTENBERG EBOOK/i);
      if (endPosInContent !== -1) {
        content = content.substring(0, endPosInContent);
      }
    }

    expect(content.trim()).toBe(
      'Chapter 1: Down the Rabbit Hole\nAlice was beginning to get very tired of sitting by her sister...'
    );
  });
});
