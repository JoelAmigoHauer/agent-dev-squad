// Markdown helpers shared by the checks (v0.4). No dependencies.

// The rows of the first markdown table after a heading matching `heading`, as objects keyed by
// lower-cased header cells.
export function tableAfter(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && heading.test(l));
  if (start < 0) return [];
  let i = start + 1;
  while (i < lines.length && !/^\s*\|/.test(lines[i])) {
    if (/^#{1,6}\s/.test(lines[i])) return [];
    i++;
  }
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const head = cells(lines[i] || '').map((h) => h.toLowerCase());
  const rows = [];
  for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) {
    const c = cells(lines[i]);
    rows.push(Object.fromEntries(head.map((h, k) => [h, c[k] ?? ''])));
  }
  return rows;
}
