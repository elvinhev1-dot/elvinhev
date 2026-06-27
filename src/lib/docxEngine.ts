import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

/**
 * docxEngine.ts
 * ------------------------------------------------------------------
 * Generic engine for:
 *   1) Converting a "raw" contract .docx into a reusable TEMPLATE
 *      .docx where literal values (company names, TINs, bank
 *      details, dates, etc.) are swapped for {{placeholders}}.
 *   2) Rendering a final contract .docx from a template + form data
 *      using docxtemplater (the standard {{placeholder}} engine).
 *
 * Why a custom "tagger" step is needed:
 * Word frequently splits a single visible line of text across many
 * <w:r> (run) XML nodes, e.g. `SR TEXNO` might be split into runs
 * "SR ", "TEX", "NO" each with their own formatting. A naive
 * string.replace() on the raw XML will silently fail to match text
 * that crosses a run boundary. To fix this, we:
 *   - Parse each <w:p> (paragraph) node
 *   - Concatenate the text of all <w:t> nodes inside it
 *   - Run our replacements against that concatenated string
 *   - If a change occurred, collapse all runs in that paragraph into
 *     a single run carrying the original (first run's) formatting,
 *     with the new text.
 * This guarantees matches regardless of how Word split the runs,
 * at the cost of losing intra-paragraph formatting (bold/italic
 * mixed within the same line) ONLY for paragraphs that were
 * actually modified. Untouched paragraphs are left byte-identical.
 * ------------------------------------------------------------------
 */

export interface RuleScope {
  /** Restrict matching to inside a <w:tbl> element, 0-indexed in document order */
  tableIndex: number;
  /** Restrict matching to a specific <w:tc> (cell) within that table's flattened cell list, 0-indexed */
  cellIndex: number;
}

export interface ReplacementRule {
  /** Stable id for the rule, used as the form field name, e.g. "buyer_company" */
  id: string;
  /** Human label shown in the dynamic form, e.g. "Buyer Company Name" */
  label: string;
  /** Placeholder inserted into the docx, e.g. "{{buyer_company}}" */
  placeholder: string;
  /**
   * The literal text actually written into the document XML in place
   * of the matched phrase. Defaults to `placeholder` if omitted.
   * Use this when the matched phrase includes a static label that
   * should be preserved in the output (e.g. matching "M/h: AZ37..."
   * but only wanting to templatize the account number, so the
   * generated document still reads "M/h: <new value>" rather than
   * losing the "M/h:" label). `placeholder` itself must always stay
   * a clean "{{field_id}}" token, since that's the key docxtemplater
   * (and our own field-id lookups) match against.
   */
  tagText?: string;
  /**
   * One or more literal strings (or regex patterns) found in the
   * ORIGINAL uploaded contract that should become this placeholder.
   * Plain strings are matched literally. By default this searches
   * the WHOLE document (body + headers/footers). Use `scope` to
   * restrict matching to a single table cell instead — essential
   * for values that are ambiguous on their own (e.g. a bank's VÖEN,
   * M/h, or SWIFT code can legitimately be identical for the buyer's
   * and seller's banks; only the cell position tells them apart).
   */
  matches: string[];
  /** Optional regex (as string, no slashes) for fuzzier matching, e.g. dates */
  matchRegex?: string;
  /**
   * If set, this rule ONLY matches inside the given table cell,
   * never elsewhere in the document. Leave unset for values that
   * are safe to replace globally (unique strings like a specific
   * company name, a contract number, a director's name).
   */
  scope?: RuleScope;
  /** Input type for the generated form */
  inputType?: 'text' | 'date' | 'textarea';
  /** Placeholder example text shown in the form input */
  example?: string;
  /** Whether the field is required */
  required?: boolean;
}

export interface DetectedField {
  id: string;
  label: string;
  placeholder: string;
  inputType: 'text' | 'date' | 'textarea';
  example?: string;
  required: boolean;
  /** How many places in the doc this placeholder will appear */
  occurrences: number;
}

const XML_PARTS_TO_SCAN = (zip: PizZip): string[] => {
  const names = Object.keys(zip.files);
  return names.filter(
    (n) =>
      n === 'word/document.xml' ||
      /^word\/header\d*\.xml$/.test(n) ||
      /^word\/footer\d*\.xml$/.test(n)
  );
};

/**
 * Escapes a string for safe use inside a RegExp.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extracts the list of <w:t> text nodes inside a single <w:p>...</w:p>
 * block, along with their start/end offsets, so we can rebuild the
 * paragraph after a text-level replace.
 */
function getParagraphBlocks(xml: string): { start: number; end: number; xml: string }[] {
  const blocks: { start: number; end: number; xml: string }[] = [];
  const re = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    blocks.push({ start: m.index, end: m.index + m[0].length, xml: m[0] });
  }
  return blocks;
}

/**
 * Given the XML of a single paragraph, returns the plain visible text
 * (concatenation of all <w:t> contents, decoded).
 */
function paragraphPlainText(paragraphXml: string): string {
  const texts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paragraphXml)) !== null) {
    texts.push(decodeXmlEntities(m[1]));
  }
  return texts.join('');
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function encodeXmlEntities(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Rebuilds a paragraph's XML so that it contains exactly one run with
 * the supplied newText, reusing the run-properties (<w:rPr>) of the
 * first run found in the original paragraph (so font/bold/size are
 * preserved). Falls back to no run-properties if none were present.
 */
function rebuildParagraphWithText(paragraphXml: string, newText: string): string {
  // Capture leading paragraph properties block <w:pPr>...</w:pPr> if present
  const pPrMatch = paragraphXml.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>|<w:pPr\s*\/>/);
  const pPr = pPrMatch ? pPrMatch[0] : '';

  // Capture the first run's properties <w:rPr>...</w:rPr>
  const rPrMatch = paragraphXml.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>|<w:rPr\s*\/>/);
  const rPr = rPrMatch ? rPrMatch[0] : '';

  // Preserve the opening <w:p ...> tag attributes exactly
  const pOpenMatch = paragraphXml.match(/^<w:p\b[^>]*>/);
  const pOpen = pOpenMatch ? pOpenMatch[0] : '<w:p>';

  const safeText = encodeXmlEntities(newText);
  // xml:space="preserve" ensures leading/trailing spaces & tabs survive
  const runXml = `<w:r>${rPr}<w:t xml:space="preserve">${safeText}</w:t></w:r>`;

  return `${pOpen}${pPr}${runXml}</w:p>`;
}

/**
 * Finds every <w:tbl>...</w:tbl> block in the given XML (document
 * order), and within each, every <w:tc>...</w:tc> cell block
 * (document order, flattened across rows). This document has no
 * nested tables, which covers the overwhelming majority of contract
 * templates; if a table IS nested, the outer <w:tc> regex below will
 * still capture correctly because regex is non-greedy and matches
 * the nearest closing tag, but a nested table's own cells won't be
 * separately indexed (they remain part of their parent cell's text).
 */
function getTables(xml: string): { start: number; end: number; cells: { start: number; end: number }[] }[] {
  const tables: { start: number; end: number; cells: { start: number; end: number }[] }[] = [];
  const tblRe = /<w:tbl\b[\s\S]*?<\/w:tbl>/g;
  let tblMatch: RegExpExecArray | null;
  while ((tblMatch = tblRe.exec(xml)) !== null) {
    const tblXml = tblMatch[0];
    const tblStart = tblMatch.index;
    const cells: { start: number; end: number }[] = [];
    const tcRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
    let tcMatch: RegExpExecArray | null;
    while ((tcMatch = tcRe.exec(tblXml)) !== null) {
      cells.push({
        start: tblStart + tcMatch.index,
        end: tblStart + tcMatch.index + tcMatch[0].length,
      });
    }
    tables.push({ start: tblStart, end: tblStart + tblXml.length, cells });
  }
  return tables;
}


/**
 * Applies a set of literal-text -> replacement-text rules across one
 * XML part (document.xml / headerN.xml / footerN.xml), operating at
 * the paragraph level so multi-run text is handled correctly.
 *
 * Each rule may optionally carry a `region` (start/end char offsets
 * within this XML part). When present, the rule is only applied to
 * paragraphs that fall entirely inside that region — this is how
 * table-cell-scoped rules avoid matching identical text that
 * happens to also appear in a different cell (e.g. the seller's
 * bank block sharing a VÖEN/SWIFT value with the buyer's).
 *
 * Returns the new XML and a count of paragraphs changed.
 */
function applyReplacementsToXml(
  xml: string,
  rules: { pattern: RegExp; replacement: string; countKey?: string; region?: { start: number; end: number } }[]
): { xml: string; changedParagraphs: number; matchCounts: Record<string, number> } {
  const blocks = getParagraphBlocks(xml);
  let result = '';
  let cursor = 0;
  let changedParagraphs = 0;
  const matchCounts: Record<string, number> = {};

  for (const block of blocks) {
    result += xml.slice(cursor, block.start);
    const plain = paragraphPlainText(block.xml);

    let newPlain = plain;
    let anyMatch = false;
    for (const rule of rules) {
      if (rule.region) {
        const inside = block.start >= rule.region.start && block.end <= rule.region.end;
        if (!inside) continue;
      }
      if (rule.pattern.test(newPlain)) {
        const before = newPlain;
        const key = rule.countKey ?? rule.replacement;
        newPlain = newPlain.replace(rule.pattern, () => {
          matchCounts[key] = (matchCounts[key] || 0) + 1;
          return rule.replacement;
        });
        if (newPlain !== before) anyMatch = true;
        // reset lastIndex for global regexes reused across paragraphs
        rule.pattern.lastIndex = 0;
      }
    }

    if (anyMatch) {
      changedParagraphs++;
      result += rebuildParagraphWithText(block.xml, newPlain);
    } else {
      result += block.xml;
    }
    cursor = block.end;
  }
  result += xml.slice(cursor);

  return { xml: result, changedParagraphs, matchCounts };
}

/**
 * STEP 1: Convert an uploaded "raw" contract docx into a reusable
 * template docx where matched literal phrases become {{placeholders}}.
 *
 * `rules` should be ordered from MOST specific to LEAST specific
 * (e.g. full bank-account lines before generic short codes) since
 * matching is first-match-wins per paragraph pass, applied in order.
 */
export async function tagTemplate(
  fileBuffer: Buffer,
  rules: ReplacementRule[]
): Promise<{ buffer: Buffer; detected: DetectedField[] }> {
  const zip = new PizZip(fileBuffer);

  // Pre-compile each rule once (pattern + replacement). The region
  // (if the rule is scoped) is resolved PER XML PART below, since
  // table offsets are specific to whichever document.xml/headerN.xml
  // the rule is being applied against.
  type Compiled = { rule: ReplacementRule; pattern: RegExp; tagText: string; placeholder: string };
  const compiledRules: Compiled[] = [];
  for (const rule of rules) {
    const literalAlternatives = [...rule.matches].sort((a, b) => b.length - a.length);
    const tagText = rule.tagText ?? rule.placeholder;
    if (literalAlternatives.length > 0) {
      const escaped = literalAlternatives.map(escapeRegExp).join('|');
      compiledRules.push({ rule, pattern: new RegExp(escaped, 'g'), tagText, placeholder: rule.placeholder });
    }
    if (rule.matchRegex) {
      compiledRules.push({
        rule,
        pattern: new RegExp(rule.matchRegex, 'g'),
        tagText,
        placeholder: rule.placeholder,
      });
    }
  }

  const parts = XML_PARTS_TO_SCAN(zip);
  const totalMatchCounts: Record<string, number> = {};

  for (const partName of parts) {
    const file = zip.file(partName);
    if (!file) continue;
    const xml = file.asText();

    // Resolve table/cell geometry once per part, only if any rule
    // actually needs scoping (cheap skip for the common unscoped case).
    const needsTables = compiledRules.some((c) => c.rule.scope);
    const tables = needsTables ? getTables(xml) : [];

    const resolvedRules = compiledRules.map((c) => {
      let region: { start: number; end: number } | undefined;
      if (c.rule.scope) {
        const table = tables[c.rule.scope.tableIndex];
        const cell = table?.cells[c.rule.scope.cellIndex];
        // If the scope doesn't resolve in THIS part (e.g. this rule's
        // table simply doesn't exist in a header/footer), give it an
        // empty/never-matching region rather than falling back to
        // unscoped — scoped rules must never leak outside their cell.
        region = cell ? { start: cell.start, end: cell.end } : { start: -1, end: -1 };
      }
      return { pattern: c.pattern, replacement: c.tagText, countKey: c.placeholder, region };
    });

    const { xml: newXml, matchCounts } = applyReplacementsToXml(xml, resolvedRules);
    zip.file(partName, newXml);
    for (const [k, v] of Object.entries(matchCounts)) {
      totalMatchCounts[k] = (totalMatchCounts[k] || 0) + v;
    }
  }

  const detected: DetectedField[] = rules
    .filter((rule) => (totalMatchCounts[rule.placeholder] || 0) > 0)
    .map((rule) => ({
      id: rule.id,
      label: rule.label,
      placeholder: rule.placeholder,
      inputType: rule.inputType || 'text',
      example: rule.example,
      required: rule.required ?? true,
      occurrences: totalMatchCounts[rule.placeholder] || 0,
    }));

  const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { buffer, detected };
}

/**
 * Scans a docx (already-tagged template OR raw upload) for any
 * {{placeholder}} tokens that already exist in it, in document order.
 * Used to auto-detect fields for templates that already use the
 * {{...}} convention (e.g. user uploads a pre-made template).
 */
export function detectExistingPlaceholders(fileBuffer: Buffer): string[] {
  const zip = new PizZip(fileBuffer);
  const parts = XML_PARTS_TO_SCAN(zip);
  const found: string[] = [];
  const seen = new Set<string>();

  for (const partName of parts) {
    const file = zip.file(partName);
    if (!file) continue;
    const xml = file.asText();
    const blocks = getParagraphBlocks(xml);
    for (const block of blocks) {
      const plain = paragraphPlainText(block.xml);
      const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(plain)) !== null) {
        if (!seen.has(m[1])) {
          seen.add(m[1]);
          found.push(m[1]);
        }
      }
    }
  }
  return found;
}

/**
 * If a raw docx already contains literal {{placeholder}} tokens
 * split across multiple runs (common when a human typed the
 * double-braces directly in Word), this normalizes each paragraph
 * containing a partial/whole {{...}} token into a single clean run,
 * WITHOUT altering paragraphs that have no such token. This should
 * be run before handing the buffer to docxtemplater, since
 * docxtemplater itself cannot see across run boundaries either.
 */
export function normalizeSplitPlaceholders(fileBuffer: Buffer): Buffer {
  const zip = new PizZip(fileBuffer);
  const parts = XML_PARTS_TO_SCAN(zip);

  for (const partName of parts) {
    const file = zip.file(partName);
    if (!file) continue;
    const xml = file.asText();
    const blocks = getParagraphBlocks(xml);
    let result = '';
    let cursor = 0;

    for (const block of blocks) {
      result += xml.slice(cursor, block.start);
      const plain = paragraphPlainText(block.xml);
      if (/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(plain)) {
        result += rebuildParagraphWithText(block.xml, plain);
      } else {
        result += block.xml;
      }
      cursor = block.end;
    }
    result += xml.slice(cursor);
    zip.file(partName, result);
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * STEP 2: Render a final .docx from a tagged template + key/value
 * data, using docxtemplater. Throws a descriptive error if rendering
 * fails (e.g. malformed template tags).
 */
export function renderDocument(templateBuffer: Buffer, data: Record<string, string>): Buffer {
  // docxtemplater cannot match tags split across runs either, so we
  // normalize first as a safety net (no-op if nothing is split).
  const normalized = normalizeSplitPlaceholders(templateBuffer);
  const zip = new PizZip(normalized);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    nullGetter: () => '', // unmatched tags render as empty string rather than throwing
  });

  try {
    doc.render(data);
  } catch (error: any) {
    const explanation =
      error?.properties?.errors
        ?.map((e: any) => e.properties?.explanation)
        .filter(Boolean)
        .join('; ') || error.message;
    throw new Error(`Failed to render document: ${explanation}`);
  }

  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}
