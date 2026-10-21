import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CatalogBook {
  id: string;
  title: string;
  author: string;
  subjects: string[];
  downloads: number;
  epubUrl?: string;
  coverUrl?: string;
  languages?: string[];
}

export interface ClusterCandidate {
  id: string;
  title: string;
  downloads: number;
  score: number;
  illustrations?: number;
  note?: string;
  isRecommended: boolean;
}

export interface DuplicateCluster {
  key: string;
  workTitle: string;
  author: string;
  recommendedId: string;
  manualOverride: string | null;
  selectedId: string;
  totalWorkDownloads: number;
  reason: string;
  candidates: ClusterCandidate[];
}

export interface CurationConfig {
  $schema?: string;
  version: string;
  rules: {
    language: string;
    preferIllustrated: boolean;
    preferLaterEditions: boolean;
    preferUnabridged: boolean;
    aggregateWorkDownloads: boolean;
  };
  clusters: DuplicateCluster[];
  excludedIds: Record<string, string>;
}

// Known Project Gutenberg improved edition relationships and notes
const KNOWN_IMPROVED_EDITIONS: Record<string, { betterId: string; note: string }> = {
  '1661': { betterId: '48320', note: 'Project Gutenberg note: Improved edition is eBook #48320' },
  '161': { betterId: '21839', note: 'Project Gutenberg note: Improved edition is eBook #21839' },
  '1497': { betterId: '55201', note: 'Project Gutenberg note: Improved edition is eBook #55201' },
  '42': { betterId: '43', note: 'Obsolete 1992 7-bit ASCII upload replaced by modern edition #43' },
  '514': { betterId: '37106', note: 'Unillustrated 1996 text superseded by 205-illustration edition #37106' },
  '2199': { betterId: '6130', note: 'Unillustrated 2000 text superseded by 71-illustration Flaxman edition #6130' },
  '55': {
    betterId: '43936',
    note: 'Single-cover 1993 text superseded by 148-color-illustration Denslow edition #43936'
  },
  '221': { betterId: '108', note: 'Unillustrated text superseded by 13-illustration Paget edition #108' },
  '113': { betterId: '17396', note: 'Unillustrated text superseded by 6-color-plate Maria Kirk edition #17396' },
  '3748': { betterId: '18857', note: 'Unillustrated text superseded by 4-illustration Riou edition #18857' },
  '2489': { betterId: '2701', note: 'Secondary transcription superseded by standard edition #2701' },
  '42671': { betterId: '1342', note: 'Secondary transcription superseded by 164-illustration Brock edition #1342' },
  '3070': { betterId: '2852', note: 'Secondary transcription superseded by standard edition #2852' },
  '45839': { betterId: '345', note: 'Secondary transcription superseded by classic edition #345' },
  '17157': { betterId: '829', note: 'Abridged school edition superseded by unabridged complete text #829' },
  '20': { betterId: '26', note: '1667 10-book edition superseded by 1674 12-book definitive edition #26' }
};

// Known illustration counts for notable editions
const KNOWN_ILLUSTRATIONS: Record<string, number> = {
  '48320': 30, // Sidney Paget (Sherlock Holmes)
  '21839': 39, // Hugh Thomson (Sense & Sensibility)
  '1342': 164, // C.E. Brock (Pride & Prejudice)
  '43936': 148, // W.W. Denslow (Wizard of Oz)
  '37106': 205, // Little Women
  '6130': 71, // John Flaxman (The Iliad)
  '17396': 6, // Maria L. Kirk (The Secret Garden)
  '108': 13, // Sidney Paget (Return of Sherlock Holmes)
  '18857': 4, // Édouard Riou (Journey to the Centre of the Earth)
  '47960': 9, // Romeo and Juliet illustrated
  '164': 12, // 20,000 Leagues Under the Sea
  '2488': 11 // 20,000 Leagues Under the Sea
};

// Known non-English Project Gutenberg IDs in catalog
const KNOWN_NON_ENGLISH_IDS: Record<string, string> = {
  '1012': '[Italian] La Divina Commedia di Dante',
  '2229': '[German] Faust: Der Tragödie erster Teil by Goethe',
  '2419': '[French] La dame aux camélias by Dumas',
  '2650': '[French] Du côté de chez Swann by Marcel Proust',
  '4791': '[French] Voyage au Centre de la Terre by Jules Verne',
  '13951': '[French] Les trois mousquetaires by Dumas',
  '14287': "[French] L'île mystérieuse by Jules Verne",
  '15113': '[French] Vie de Jésus by Ernest Renan',
  '17989': '[French] Le comte de Monte-Cristo, Tome I by Dumas',
  '18143': '[French] Roméo et Juliette: Tragédie by Shakespeare',
  '19919': '[French] Maman Léo: Les Habits Noirs Tome V by Paul Féval',
  '24746': '[German] Reise in die Aequinoctial-Gegenden by Alexander von Humboldt',
  '25946': '[Dutch] Gevoel en verstand by Jane Austen',
  '28718': "[French] Les crimes de l'amour by Marquis de Sade",
  '29049': '[French] Histoire amoureuse des Gaules by Roger de Rabutin',
  '31284': '[German] Josefine Mutzenbacher by Felix Salten',
  '32854': '[French] Arsène Lupin, gentleman-cambrioleur by Maurice Leblanc',
  '36635': '[French] Amitié amoureuse by Hermine Oudinot',
  '38674': '[French] De la terre à la lune by Jules Verne',
  '40739': '[German] Die Traumdeutung by Sigmund Freud',
  '48040': '[German] Das Bücher-Dekameron by Kasimir Edschmid',
  '49501': '[German] Anzeiger für Kunde der deutschen Vorzeit',
  '50285': '[German] Dr. Mabuse, der Spieler by Norbert Jacques',
  '50528': '[German] Pitt und Fox by Friedrich Huch',
  '52597': '[Spanish] Insolación y Morriña by Emilia Pardo Bazán',
  '55487': '[German] Sämmtliche Werke 5: Dramatische Werke by Nikolai Gogol',
  '57741': '[German] Der kleine Dämon by Fyodor Sologub',
  '60353': '[German] Millionen; Der Tod des Iwan Lande by Mikhail Artsybashev',
  '61851': '[Spanish] El crimen y el castigo by Fyodor Dostoyevsky',
  '62215': "[French] Le Fantôme de l'Opéra by Gaston Leroux",
  '62635': '[Swedish] Moloks leende: roman by Daniel Berg',
  '63460': '[German] Die seltsamen Geschichten des Doktor Ulebuhle by Bruno Hans Bürgel',
  '64414': '[German] Der Jäger von Fall by Ludwig Ganghofer',
  '65580': '[Swedish] Carl Svenske by Gustaf Björlin',
  '65661': '[German] Der Zauberberg. Erster Band by Thomas Mann',
  '65662': '[German] Der Zauberberg. Zweiter Band by Thomas Mann',
  '66452': '[German] Die Liebe: Novelle by Hans Kaltneker',
  '68400': '[German] Der Marquis de Sade und seine Zeit by Iwan Bloch',
  '69944': '[German] Jud Süß by Lion Feuchtwanger',
  '75802': '[German] Der Steppenwolf by Hermann Hesse',
  '76334': '[Finnish] Ikuinen rakastaja by Edgar Rice Burroughs',
  '76360': '[German] Die Elixiere des Teufels by E.T.A. Hoffmann',
  '76412': '[French] Le cas étrange du docteur Jekyll by R.L. Stevenson',
  '76433': '[French] La marque des quatre by Arthur Conan Doyle',
  '76501': '[Finnish] Ruhtinatar Aurore by Pierre Benoît',
  '76520': '[Finnish] Hänen viimeinen tervehdyksensä by Arthur Conan Doyle',
  '76540': "[French] Les Mémoires d'un Parapluie by Elisabeth Galos",
  '76543': '[Finnish] Tuhatvuotinen valtakunta by Upton Sinclair',
  '76662': '[German] Sämtliche Werke 20 by Fyodor Dostoyevsky',
  '76724': '[French] La chasse au météore by Jules Verne',
  '76729': '[Finnish] Palvelusväkeä by Roderich Benedix',
  '76896': '[Finnish] Ikuinen salaisuus by Jack London',
  '77009': '[Finnish] Ihmisten kapina by Lauri Haarla',
  '77073': '[German] Die Flucht der Beate Hoyermann by Thea von Harbou',
  '77086': '[French] Les cœurs les plus farouches by James Oliver Curwood',
  '78007': '[Finnish] Vanhaa viinaa uudessa leilissä by Tatu Valkonen',
  '78008': '[Finnish] Hauska tutustua by Tatu Pekkarinen',
  '78026': '[German] Skizzen einer Fußreise durch Oesterreich by Josef Kyselak',
  '78027': '[French] Les enchantements de la forêt by André Theuriet',
  '78036': "[French] Quand le rideau s'est baissé by Pierre Mille",
  '78037': '[French] Les trente-six vues de la Tour Eiffel',
  '78042': '[Finnish] Ihmisvihaaja by Molière',
  '78049': '[Finnish] Sointula by Arvid Järnefelt',
  '78052': '[Spanish] Andanzas y visiones españolas by Miguel de Unamuno',
  '78058': '[Finnish] Lintukoto by Joel Lehtonen',
  '78063': '[French] Le jeune Européen by Pierre Drieu La Rochelle',
  '78064': '[French] Lucifer by Maurice Magre',
  '78068': '[Spanish] Los miserables - Tomo 2 by Victor Hugo',
  '78069': '[French] Deux générations by Leo Tolstoy',
  '78070': '[Finnish] Velisurmaaja by Lauri Haarla',
  '78071': '[Finnish] Kaksi morsianta by Kaarlo Hemmo',
  '78074': '[French] Chroniques de J. Froissart, tome 09/13 by Jean Froissart',
  '78080': '[French] Journal de la société de 1789 by Condorcet',
  '78081': '[Finnish] Huligaani by Arvid Järnefelt',
  '78096': '[Finnish] Hajamuistelmia pakolaiselämästä by Aatto Sirén',
  '78097': '[Finnish] Kevättuulahduksia by Niilo Mantere',
  '78098': "[French] L'art d'aimer by Catulle Mendès",
  '78100': '[Finnish] Läpi harmaan kiven by J.A. Lehtinen',
  '78101': "[French] L'homme à l'Hispano by Pierre Frondaie",
  '78113': '[Finnish] Elämän urpuja by Viljami Vuokoski',
  '78123': '[Catalan] Un pis al ensanche by José Feliú y Codina',
  '78125': '[German] Liebe ist ewig by Wilhelm von Polenz'
};

// Known standalone volume fragments (where complete edition exists)
const KNOWN_VOLUME_FRAGMENTS: Record<string, string> = {
  '47530': 'Volume fragment: Oliver Twist, Vol. 2 (of 3) when complete novel #730 exists'
};

export function normalizeAuthorKey(author: string): string {
  if (!author) return 'unknown';
  const primary = author.split(/,|;/)[0];
  return primary
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function normalizeTitleKey(title: string): string {
  return (
    (title || '')
      .toLowerCase()
      .replace(/^(the|a|an)\s+/i, '')
      // Strip subtitle after colon, semicolon, dash, parens, brackets, or $b (MARC separator)
      .replace(/[:;\-([$].*$/, '')
      // Strip common edition/illustration qualifiers
      .replace(/\b(illustrated|illustrations|with illustrations|an edition with illustrations|complete)\b/gi, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function isAudioBookOrNonEpub(book: CatalogBook): { isAudio: boolean; reason?: string } {
  const t = (book.title || '').toLowerCase();
  const subjects = (book.subjects || []).map((s) => s.toLowerCase());

  if (
    t.includes('audio book') ||
    t.includes('audiobook') ||
    t.includes('librivox') ||
    subjects.some((s) => s.includes('audio book') || s.includes('sound recording') || s.includes('librivox'))
  ) {
    return { isAudio: true, reason: 'Audio recording format (no EPUB content)' };
  }

  if (
    book.epubUrl &&
    (book.epubUrl.includes('.ogg') || book.epubUrl.includes('.mp3') || book.epubUrl.includes('.spx'))
  ) {
    return { isAudio: true, reason: 'Sound media URL (not an EPUB)' };
  }

  return { isAudio: false };
}

export function isNonEnglish(book: CatalogBook): { isNonEnglish: boolean; reason?: string } {
  if (KNOWN_NON_ENGLISH_IDS[book.id]) {
    return { isNonEnglish: true, reason: KNOWN_NON_ENGLISH_IDS[book.id] };
  }

  if (book.languages && book.languages.length > 0 && !book.languages.includes('en')) {
    return { isNonEnglish: true, reason: `Language metadata is [${book.languages.join(', ')}]` };
  }

  return { isNonEnglish: false };
}

export function scoreCandidate(book: CatalogBook, otherCandidates: CatalogBook[]): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  const titleLower = book.title.toLowerCase();

  // 1. Known improved edition bonus / obsolete penalty
  if (KNOWN_IMPROVED_EDITIONS[book.id]) {
    score -= 80;
    reasons.push(KNOWN_IMPROVED_EDITIONS[book.id].note);
  }

  const improvedFromOther = otherCandidates.find((o) => KNOWN_IMPROVED_EDITIONS[o.id]?.betterId === book.id);
  if (improvedFromOther) {
    score += 100;
    reasons.push(`Superior edition cited by Project Gutenberg note on #${improvedFromOther.id}`);
  }

  // 2. Illustration bonus
  const knownIllus = KNOWN_ILLUSTRATIONS[book.id];
  if (knownIllus && knownIllus > 5) {
    score += 60;
    reasons.push(`Iconic historical illustrations (${knownIllus} plates)`);
  } else if (titleLower.includes('illustrated') || titleLower.includes('illustrations')) {
    score += 50;
    reasons.push('Illustrated edition');
  }

  // 3. Complete vs Abridged / Fragment
  if (KNOWN_VOLUME_FRAGMENTS[book.id]) {
    score -= 100;
    reasons.push('Standalone volume fragment');
  } else if (/\b(vol\.|volume|tome|band|part)\s*\d+/i.test(book.title) || /\(\s*of\s*\d+\s*\)/i.test(book.title)) {
    score -= 80;
    reasons.push('Multi-volume fragment');
  }

  if (titleLower.includes('complete works') || titleLower.includes('complete edition')) {
    score += 60;
    reasons.push('Complete collection');
  }

  // 4. Download popularity (log scale)
  const dlBonus = Math.round(Math.log10(Math.max(1, book.downloads)) * 5);
  score += dlBonus;

  // 5. Later Project Gutenberg release recency tiebreaker
  const idNum = parseInt(book.id, 10);
  if (!isNaN(idNum)) {
    score += Math.min(10, Math.round((idNum / 10000) * 2));
  }

  const reason =
    reasons.length > 0 ? reasons.join('; ') : `Standard edition (${book.downloads.toLocaleString()} downloads)`;
  return { score, reason };
}

export function curateCatalog(
  rawBooks: CatalogBook[],
  existingConfig?: CurationConfig | null
): {
  curatedBooks: CatalogBook[];
  curationConfig: CurationConfig;
  hasCurationDiff: boolean;
  diffSummary: string[];
} {
  const excludedIds: Record<string, string> = { ...(existingConfig?.excludedIds || {}) };

  // 1. Exclude audiobooks and non-EPUBs
  for (const b of rawBooks) {
    const audioCheck = isAudioBookOrNonEpub(b);
    if (audioCheck.isAudio) {
      excludedIds[b.id] = audioCheck.reason || 'Audiobook format';
    }
    const langCheck = isNonEnglish(b);
    if (langCheck.isNonEnglish) {
      excludedIds[b.id] = langCheck.reason || 'Non-English language';
    }
    if (KNOWN_VOLUME_FRAGMENTS[b.id]) {
      excludedIds[b.id] = KNOWN_VOLUME_FRAGMENTS[b.id];
    }
  }

  // Filter eligible English EPUB books
  const eligibleBooks = rawBooks.filter((b) => !excludedIds[b.id]);

  // 2. Cluster books by normalized author & core title
  const clusterMap = new Map<string, CatalogBook[]>();
  for (const b of eligibleBooks) {
    const aKey = normalizeAuthorKey(b.author);
    const tKey = normalizeTitleKey(b.title);
    if (tKey.length < 3) continue;

    const key = `${aKey} ::: ${tKey}`;
    if (!clusterMap.has(key)) clusterMap.set(key, []);
    clusterMap.get(key)!.push(b);
  }

  const existingClusterMap = new Map<string, DuplicateCluster>();
  if (existingConfig?.clusters) {
    for (const c of existingConfig.clusters) {
      existingClusterMap.set(c.key, c);
    }
  }

  const clusters: DuplicateCluster[] = [];
  const diffSummary: string[] = [];
  const rejectedCandidateIds = new Set<string>();
  const clusterDownloadsMap = new Map<string, number>();
  const aggregateDownloads = existingConfig?.rules?.aggregateWorkDownloads !== false;

  for (const [key, books] of clusterMap.entries()) {
    if (books.length < 2) continue;

    const previousCluster = existingClusterMap.get(key);
    const candidates: ClusterCandidate[] = [];
    let bestCandidate: CatalogBook = books[0];
    let highestScore = -Infinity;
    let winningReason = '';

    const totalWorkDownloads = books.reduce((sum, b) => sum + (b.downloads || 0), 0);

    for (const b of books) {
      const others = books.filter((x) => x.id !== b.id);
      const { score, reason } = scoreCandidate(b, others);
      if (score > highestScore) {
        highestScore = score;
        bestCandidate = b;
        winningReason = reason;
      }
      candidates.push({
        id: b.id,
        title: b.title,
        downloads: b.downloads,
        score,
        illustrations: KNOWN_ILLUSTRATIONS[b.id],
        note: KNOWN_IMPROVED_EDITIONS[b.id]?.note,
        isRecommended: false
      });
    }

    // Mark best candidate as recommended
    const recCandidate = candidates.find((c) => c.id === bestCandidate.id);
    if (recCandidate) recCandidate.isRecommended = true;

    const recommendedId = bestCandidate.id;
    // Preserve any manual override that the curator previously entered
    const manualOverride = previousCluster?.manualOverride || null;
    const selectedId = manualOverride || recommendedId;
    clusterDownloadsMap.set(selectedId, totalWorkDownloads);

    // Check for diffs vs previous configuration
    if (!previousCluster) {
      diffSummary.push(
        `[New Cluster Detected] "${bestCandidate.title}" by ${bestCandidate.author} -> selected #${selectedId}`
      );
    } else if (previousCluster.selectedId !== selectedId) {
      diffSummary.push(
        `[Selection Changed] "${bestCandidate.title}" changed from #${previousCluster.selectedId} to #${selectedId}`
      );
    }

    clusters.push({
      key,
      workTitle: bestCandidate.title,
      author: bestCandidate.author,
      recommendedId,
      manualOverride,
      selectedId,
      totalWorkDownloads,
      reason: winningReason,
      candidates
    });

    // Mark all non-selected candidates in this cluster as rejected
    for (const b of books) {
      if (b.id !== selectedId) {
        rejectedCandidateIds.add(b.id);
      }
    }
  }

  // 3. Assemble curated catalog: eligible books excluding rejected duplicate candidates
  // If aggregateWorkDownloads is enabled, attribute aggregated work downloads to selected edition
  const curatedBooks = eligibleBooks
    .filter((b) => !rejectedCandidateIds.has(b.id))
    .map((b) => {
      if (aggregateDownloads && clusterDownloadsMap.has(b.id)) {
        return {
          ...b,
          downloads: clusterDownloadsMap.get(b.id)!
        };
      }
      return b;
    });

  // Sort by downloads descending
  curatedBooks.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

  const curationConfig: CurationConfig = {
    $schema: 'https://zenolet.app/schemas/curation.v1.json',
    version: '1.0',
    rules: {
      language: 'en',
      preferIllustrated: true,
      preferLaterEditions: true,
      preferUnabridged: true,
      aggregateWorkDownloads: aggregateDownloads
    },
    clusters,
    excludedIds
  };

  const hasCurationDiff = diffSummary.length > 0;
  return { curatedBooks, curationConfig, hasCurationDiff, diffSummary };
}

export function generateMarkdownReport(config: CurationConfig, catalogCount: number): string {
  const lines: string[] = [];
  lines.push('# 📚 Zenolet Library Curation Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Active Curated Catalog: **${catalogCount} e-books** (English only, audio-free, deduplicated).`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 🎨 Duplicate Clusters & Edition Selections');
  lines.push('');
  lines.push(
    'When multiple Project Gutenberg editions of the same work exist, Zenolet scores them based on illustration presence, Project Gutenberg improved edition notices, completeness, and transcription quality.'
  );
  lines.push('');
  lines.push('| Work / Author | Selected Edition | Status | Reason & Competing Editions |');
  lines.push('| :--- | :--- | :--- | :--- |');

  for (const c of config.clusters) {
    const selected = c.candidates.find((x) => x.id === c.selectedId);
    const status = c.manualOverride ? `🔧 **Manual Override**` : `🤖 **Heuristic**`;
    const isAggregated = c.totalWorkDownloads && c.totalWorkDownloads !== selected?.downloads;
    const dlText = isAggregated
      ? `**${c.totalWorkDownloads.toLocaleString()} total dl**<br><small><em>(${selected?.downloads.toLocaleString()} edition + ${(c.totalWorkDownloads - (selected?.downloads || 0)).toLocaleString()} from duplicates)</em></small>`
      : `(${selected?.downloads.toLocaleString()} dl)`;
    const selectedText = `**[#${c.selectedId}] ${selected?.title || c.workTitle}**<br>${dlText}`;

    const othersText = c.candidates
      .filter((x) => x.id !== c.selectedId)
      .map((x) => `• *#${x.id}*: ${x.title} (${x.downloads.toLocaleString()} dl)`)
      .join('<br>');

    const reasonText = `${c.reason}<br><br><small><strong>Excluded Alternatives:</strong><br>${othersText}</small>`;
    lines.push(`| **${c.workTitle}**<br>by *${c.author}* | ${selectedText} | ${status} | ${reasonText} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 🚫 Excluded Items Summary');
  lines.push('');
  lines.push('The following items were filtered out from the curated library catalog:');
  lines.push('');
  lines.push('| ID | Reason |');
  lines.push('| :--- | :--- |');

  const excludedEntries = Object.entries(config.excludedIds);
  for (const [id, reason] of excludedEntries.slice(0, 50)) {
    lines.push(`| **#${id}** | ${reason} |`);
  }
  if (excludedEntries.length > 50) {
    lines.push(`| ... | *and ${excludedEntries.length - 50} additional non-English or audio items.* |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## ✏️ How to Customize or Override Choices');
  lines.push('');
  lines.push(
    'To change any selected edition, edit `curator/curation.json`, set `"manualOverride": "<desired_id>"` on the desired cluster, and run `npm run curate`.'
  );
  lines.push('');

  return lines.join('\n');
}

export function runCurateCli(): void {
  console.log('📖 [Zenolet Curator] Running catalog deduplication, language filtering, and edition curation...');

  const rawPath = path.resolve(__dirname, '../catalog.raw.json');
  const catalogPath = path.resolve(__dirname, '../catalog.json');
  const curationPath = path.resolve(__dirname, '../curation.json');
  const reportPath = path.resolve(__dirname, '../CURATION_REPORT.md');

  const sourcePath = fs.existsSync(rawPath) ? rawPath : catalogPath;
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Catalog file not found at ${sourcePath}`);
    process.exit(1);
  }

  const rawBooks: CatalogBook[] = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
  let existingConfig: CurationConfig | null = null;
  if (fs.existsSync(curationPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(curationPath, 'utf-8'));
    } catch {
      existingConfig = null;
    }
  }

  const { curatedBooks, curationConfig, hasCurationDiff, diffSummary } = curateCatalog(rawBooks, existingConfig);

  // Write curation configuration
  fs.writeFileSync(curationPath, JSON.stringify(curationConfig, null, 2) + '\n', 'utf-8');

  // Write human-readable markdown report
  const reportMarkdown = generateMarkdownReport(curationConfig, curatedBooks.length);
  fs.writeFileSync(reportPath, reportMarkdown, 'utf-8');

  // Write updated, curated catalog.json
  fs.writeFileSync(catalogPath, JSON.stringify(curatedBooks, null, 2) + '\n', 'utf-8');

  console.log(`✅ [Zenolet Curator] Curation complete!`);
  console.log(`   - Curated e-books remaining: ${curatedBooks.length}`);
  console.log(`   - Duplicate clusters resolved: ${curationConfig.clusters.length}`);
  console.log(
    `   - Excluded items (audio / non-English / fragments): ${Object.keys(curationConfig.excludedIds).length}`
  );
  console.log(`   - Written to: ${curationPath}`);
  console.log(`   - Written to: ${reportPath}`);
  console.log(`   - Written to: ${catalogPath}`);

  if (hasCurationDiff) {
    console.log('\n============================================================');
    console.log('⚠️  [Zenolet Curator Alert] Changes detected in duplicate clusters!');
    diffSummary.forEach((d) => console.log(`   ${d}`));
    console.log('\nPlease review curator/curation.json or curator/CURATION_REPORT.md');
    console.log('to verify choices or specify any manualOverride settings.');
    console.log('============================================================\n');
  } else {
    console.log('✨ All duplicate decisions match existing curation settings.');
  }
}

// Run CLI if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCurateCli();
}
