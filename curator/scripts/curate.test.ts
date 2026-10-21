import { describe, it, expect } from 'vitest';
import {
  normalizeAuthorKey,
  normalizeTitleKey,
  isAudioBookOrNonEpub,
  isNonEnglish,
  scoreCandidate,
  curateCatalog,
  generateMarkdownReport,
  type CatalogBook,
  type CurationConfig
} from './curate.ts';

describe('Curation Pipeline (curator/scripts/curate.ts)', () => {
  it('normalizes author names to primary lowercase alphanumeric surname', () => {
    expect(normalizeAuthorKey('Austen, Jane')).toBe('austen');
    expect(normalizeAuthorKey('Doyle, Arthur Conan')).toBe('doyle');
    expect(normalizeAuthorKey('Shakespeare, William')).toBe('shakespeare');
    expect(normalizeAuthorKey('Homer')).toBe('homer');
  });

  it('normalizes titles by stripping leading articles, subtitles, and punctuation', () => {
    expect(normalizeTitleKey('The Adventures of Sherlock Holmes')).toBe('adventures of sherlock holmes');
    expect(normalizeTitleKey('Adventures of Sherlock Holmes: Illustrated')).toBe('adventures of sherlock holmes');
    expect(normalizeTitleKey('Sense and Sensibility')).toBe('sense and sensibility');
    expect(normalizeTitleKey('Moby Dick; Or, The Whale')).toBe('moby dick');
    expect(normalizeTitleKey('Little Women; Or, Meg, Jo, Beth, and Amy')).toBe('little women');
  });

  it('detects audiobooks and sound recordings', () => {
    const audioBook: CatalogBook = {
      id: '22964',
      title: 'Sense and Sensibility (Audiobook)',
      author: 'Austen, Jane',
      subjects: ['Audio book', 'Domestic fiction'],
      downloads: 1000,
      epubUrl: 'https://example.com/audio.mp3'
    };
    expect(isAudioBookOrNonEpub(audioBook).isAudio).toBe(true);

    const normalBook: CatalogBook = {
      id: '21839',
      title: 'Sense and Sensibility',
      author: 'Austen, Jane',
      subjects: ['Domestic fiction'],
      downloads: 100000,
      epubUrl: 'https://www.gutenberg.org/ebooks/21839.epub3.images'
    };
    expect(isAudioBookOrNonEpub(normalBook).isAudio).toBe(false);
  });

  it('detects non-English books by metadata and known identifiers', () => {
    const frenchBook: CatalogBook = {
      id: '62215',
      title: "Le Fantôme de l'Opéra",
      author: 'Leroux, Gaston',
      subjects: ['French fiction'],
      downloads: 15000,
      languages: ['fr']
    };
    expect(isNonEnglish(frenchBook).isNonEnglish).toBe(true);

    const englishBook: CatalogBook = {
      id: '1342',
      title: 'Pride and Prejudice',
      author: 'Austen, Jane',
      subjects: ['Classic'],
      downloads: 180000,
      languages: ['en']
    };
    expect(isNonEnglish(englishBook).isNonEnglish).toBe(false);
  });

  it('scores illustrated and improved editions higher than obsolete plain text', () => {
    const plainText: CatalogBook = {
      id: '1661',
      title: 'The Adventures of Sherlock Holmes',
      author: 'Doyle, Arthur Conan',
      subjects: ['Detective and mystery stories'],
      downloads: 100000,
      epubUrl: 'https://www.gutenberg.org/ebooks/1661.epub3.images'
    };
    const illustrated: CatalogBook = {
      id: '48320',
      title: 'Adventures of Sherlock Holmes: Illustrated',
      author: 'Doyle, Arthur Conan',
      subjects: ['Detective and mystery stories'],
      downloads: 40000,
      epubUrl: 'https://www.gutenberg.org/ebooks/48320.epub3.images'
    };

    const plainScore = scoreCandidate(plainText, [illustrated]);
    const illusScore = scoreCandidate(illustrated, [plainText]);

    expect(illusScore.score).toBeGreaterThan(plainScore.score);
  });

  it('resolves duplicate clusters and selects the recommended edition', () => {
    const rawBooks: CatalogBook[] = [
      {
        id: '1661',
        title: 'The Adventures of Sherlock Holmes',
        author: 'Doyle, Arthur Conan',
        subjects: ['Mystery'],
        downloads: 100000,
        epubUrl: 'https://www.gutenberg.org/ebooks/1661.epub3.images'
      },
      {
        id: '48320',
        title: 'Adventures of Sherlock Holmes: Illustrated',
        author: 'Doyle, Arthur Conan',
        subjects: ['Mystery'],
        downloads: 40000,
        epubUrl: 'https://www.gutenberg.org/ebooks/48320.epub3.images'
      },
      {
        id: '2701',
        title: 'Moby Dick; Or, The Whale',
        author: 'Melville, Herman',
        subjects: ['Sea stories'],
        downloads: 180000,
        epubUrl: 'https://www.gutenberg.org/ebooks/2701.epub3.images'
      }
    ];

    const { curatedBooks, curationConfig, hasCurationDiff } = curateCatalog(rawBooks, null);

    expect(hasCurationDiff).toBe(true);
    expect(curatedBooks.length).toBe(2);
    // Sherlock Holmes cluster selected illustrated #48320
    expect(curatedBooks.some((b) => b.id === '48320')).toBe(true);
    expect(curatedBooks.some((b) => b.id === '1661')).toBe(false);
    // Moby Dick preserved
    expect(curatedBooks.some((b) => b.id === '2701')).toBe(true);

    const cluster = curationConfig.clusters.find((c) => c.key === 'doyle ::: adventures of sherlock holmes');
    expect(cluster).toBeDefined();
    expect(cluster?.selectedId).toBe('48320');
  });

  it('honors manualOverride when specified by curator', () => {
    const rawBooks: CatalogBook[] = [
      {
        id: '1661',
        title: 'The Adventures of Sherlock Holmes',
        author: 'Doyle, Arthur Conan',
        subjects: ['Mystery'],
        downloads: 100000,
        epubUrl: 'https://www.gutenberg.org/ebooks/1661.epub3.images'
      },
      {
        id: '48320',
        title: 'Adventures of Sherlock Holmes: Illustrated',
        author: 'Doyle, Arthur Conan',
        subjects: ['Mystery'],
        downloads: 40000,
        epubUrl: 'https://www.gutenberg.org/ebooks/48320.epub3.images'
      }
    ];

    const existingConfig: CurationConfig = {
      version: '1.0',
      rules: {
        language: 'en',
        preferIllustrated: true,
        preferLaterEditions: true,
        preferUnabridged: true,
        aggregateWorkDownloads: true
      },
      clusters: [
        {
          key: 'doyle ::: adventures of sherlock holmes',
          workTitle: 'The Adventures of Sherlock Holmes',
          author: 'Doyle, Arthur Conan',
          recommendedId: '48320',
          manualOverride: '1661', // Curator specifically requests #1661
          selectedId: '1661',
          totalWorkDownloads: 140000,
          reason: 'Manual override by curator',
          candidates: []
        }
      ],
      excludedIds: {}
    };

    const { curatedBooks, curationConfig } = curateCatalog(rawBooks, existingConfig);

    expect(curatedBooks.length).toBe(1);
    expect(curatedBooks[0].id).toBe('1661');
    const cluster = curationConfig.clusters.find((c) => c.key === 'doyle ::: adventures of sherlock holmes');
    expect(cluster?.selectedId).toBe('1661');
    expect(cluster?.manualOverride).toBe('1661');
  });

  it('aggregates work downloads across duplicate editions to preserve popularity rank', () => {
    const rawBooks: CatalogBook[] = [
      {
        id: '1661',
        title: 'The Adventures of Sherlock Holmes',
        author: 'Doyle, Arthur Conan',
        subjects: ['Mystery'],
        downloads: 100000,
        epubUrl: 'https://www.gutenberg.org/ebooks/1661.epub3.images'
      },
      {
        id: '48320',
        title: 'Adventures of Sherlock Holmes: Illustrated',
        author: 'Doyle, Arthur Conan',
        subjects: ['Mystery'],
        downloads: 40000,
        epubUrl: 'https://www.gutenberg.org/ebooks/48320.epub3.images'
      },
      {
        id: '999',
        title: 'Middle Popularity Novel',
        author: 'Smith, John',
        subjects: ['Fiction'],
        downloads: 80000,
        epubUrl: 'https://www.gutenberg.org/ebooks/999.epub3.images'
      }
    ];

    const { curatedBooks } = curateCatalog(rawBooks, null);
    // Sherlock Holmes selected edition (#48320) had 40,000 downloads originally, but with aggregation
    // it gets 140,000 downloads (100,000 + 40,000) and outranks Middle Novel (80,000 downloads)
    expect(curatedBooks[0].id).toBe('48320');
    expect(curatedBooks[0].downloads).toBe(140000);
    expect(curatedBooks[1].id).toBe('999');
  });

  it('generates a comprehensive markdown curation report', () => {
    const config: CurationConfig = {
      version: '1.0',
      rules: {
        language: 'en',
        preferIllustrated: true,
        preferLaterEditions: true,
        preferUnabridged: true,
        aggregateWorkDownloads: true
      },
      clusters: [
        {
          key: 'doyle ::: adventures of sherlock holmes',
          workTitle: 'The Adventures of Sherlock Holmes',
          author: 'Doyle, Arthur Conan',
          recommendedId: '48320',
          manualOverride: null,
          selectedId: '48320',
          totalWorkDownloads: 140000,
          reason: 'Iconic historical illustrations (30 plates)',
          candidates: [
            {
              id: '48320',
              title: 'Adventures of Sherlock Holmes: Illustrated',
              downloads: 40000,
              score: 85,
              isRecommended: true
            },
            {
              id: '1661',
              title: 'The Adventures of Sherlock Holmes',
              downloads: 100000,
              score: 15,
              isRecommended: false
            }
          ]
        }
      ],
      excludedIds: {
        '22964': 'Audio recording format'
      }
    };

    const report = generateMarkdownReport(config, 850);
    expect(report).toContain('# 📚 Zenolet Library Curation Report');
    expect(report).toContain('**[#48320] Adventures of Sherlock Holmes: Illustrated**');
    expect(report).toContain('Iconic historical illustrations (30 plates)');
    expect(report).toContain('**#22964**');
    expect(report).toContain('Audio recording format');
  });
});
