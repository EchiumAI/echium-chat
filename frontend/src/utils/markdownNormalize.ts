/**
 * Make model-written Markdown render the way it was meant to.
 *
 * Models often omit the blank line Markdown needs before a block. Two cases
 * break rendering badly:
 *
 * 1. A table right after a list item or paragraph. Without a blank line the
 *    table rows become "lazy continuation" text of the previous block, so the
 *    pipes and dashes show up as raw text instead of a table.
 * 2. A `---` line right after a paragraph. Markdown reads that as a setext
 *    heading underline and turns the whole paragraph into a large heading,
 *    when the model meant a horizontal rule.
 *
 * Both are fixed by inserting a blank line before the block. Fenced code
 * blocks are left untouched.
 *
 * Keep in sync with echium-docs/web/src/lib/markdown.ts (same logic).
 */

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const RULE = /^\s{0,3}-{3,}\s*$/;

/** `|---|:--:|` style row: only pipes, colons, dashes and spaces. */
const isDelimiterRow = (line: string): boolean => {
  const t = line.trim();
  return t.includes('|') && t.includes('-') && /^[|:\-\s]+$/.test(t);
};

const isBlank = (line: string | undefined): boolean =>
  line === undefined || line.trim() === '';

export const normalizeMarkdown = (markdown: string): string => {
  if (!markdown) {
    return markdown;
  }
  const lines = markdown.split('\n');
  const out: string[] = [];
  let fence: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) {
        fence = marker;
      } else if (fence === marker) {
        fence = null;
      }
      out.push(line);
      continue;
    }
    if (fence !== null) {
      out.push(line);
      continue;
    }

    const prev = out[out.length - 1];

    // Table header row followed by its delimiter row.
    const startsTable =
      line.includes('|') && !isDelimiterRow(line) && isDelimiterRow(lines[i + 1] ?? '');
    if (startsTable && !isBlank(prev) && !prev.includes('|')) {
      out.push('');
    }

    // A bare `---` under text: make it a horizontal rule, not a heading.
    if (RULE.test(line) && !isBlank(prev) && !prev.includes('|')) {
      out.push('');
    }

    out.push(line);
  }
  return out.join('\n');
};
