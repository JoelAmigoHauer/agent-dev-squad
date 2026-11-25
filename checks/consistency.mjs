#!/usr/bin/env node
// consistency-gate (v0.4, B3-21, PRIOR-ART §1): the contract, the copy deck and the design agree on
// screens, routes and strings. Gates the Engineer's start and every amendment set's Engineer line.
// design-freshness (WW-1) lives here too: design.md indexes the design round the state file names.
// Run by hand: node .squad/checks/consistency.mjs <build-dir>, which runs both.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const clean = (c) => c.replace(/`/g, '').trim();
const placeholder = (c) => !c || /[<>]/.test(c);

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

const normRoute = (r) => clean(r).replace(/\[([^\]]+)\]|\{([^}]+)\}/g, ':$1$2').replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':p');

export function consistency(buildDir) {
  const contract = (f) => read(path.join(buildDir, 'contract', f)) ?? '';
  const bindings = contract('bindings.md');
  const api = contract('api.md');
  const copy = read(path.join(buildDir, 'copy.md'));
  const design = read(path.join(buildDir, 'design.md'));
  const out = [];
  const fail = (msg) => out.push({ check: 'consistency-gate', msg });

  const surfaces = tableAfter(bindings, /^#{2,6}\s+screen bindings/i).filter((r) => !placeholder(r.surface));
  const screens = surfaces.filter((r) => clean(r.kind) === 'screen' && !placeholder(r.routes)).map((r) => clean(r.routes));
  const flows = tableAfter(bindings, /^#{2,6}\s+flow bindings/i).filter((r) => !placeholder(r.flow));
  if (!surfaces.length) fail('contract/bindings.md has no screen bindings rows');

  // C1, C2: every flow row lands on a bound screen and calls a route the API section defines.
  const apiRoutes = new Set([...api.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/g)].map((m) => `${m[1]} ${normRoute(m[2])}`));
  for (const f of flows) {
    if (!placeholder(f.screen) && !screens.some((s) => normRoute(s) === normRoute(f.screen))) {
      fail(`flow "${clean(f.flow)}": screen ${clean(f.screen)} has no screen binding row`);
    }
    const call = !placeholder(f.calls) && clean(f.calls).match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/);
    if (call && !apiRoutes.has(`${call[1]} ${normRoute(call[2])}`)) {
      fail(`flow "${clean(f.flow)}": ${call[1]} ${call[2]} is not a route in contract/api.md`);
    }
  }

  // C3: the copy deck has a section for every bound screen.
  if (copy !== null) {
    const copySections = new Set([...copy.matchAll(/^##\s+(\/\S*)/gm)].map((m) => normRoute(m[1])));
    for (const s of screens) if (!copySections.has(normRoute(s))) fail(`copy.md has no section for ${s}`);
  } else fail('copy.md is missing');

  if (design !== null) {
    // C4: every bound surface has a frame index row. C5, C7: inventory and bindings match.
    const frames = new Set(tableAfter(design, /^#{2,6}\s+frame index/i).map((r) => clean(r.surface)));
    for (const s of surfaces) if (!frames.has(clean(s.surface))) fail(`design.md frame index has no row for "${clean(s.surface)}"`);
    const inventory = [...design.matchAll(/^###\s+`(\/[^`]*)`/gm)].map((m) => m[1]).filter((p) => !placeholder(p));
    for (const s of screens) if (!inventory.some((p) => normRoute(p) === normRoute(s))) fail(`design.md screen inventory has no entry for ${s}`);
    for (const p of inventory) if (!screens.some((s) => normRoute(s) === normRoute(p))) fail(`design.md designs ${p}, which no screen binding names`);

    // C6: every string id the design cites exists in the deck.
    if (copy !== null) {
      const ids = new Set([...copy.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]));
      for (const line of design.split('\n').filter((l) => /^\s*-\s*Strings:/.test(l))) {
        for (const m of line.matchAll(/`([^`]+)`/g)) {
          if (!placeholder(m[1]) && !ids.has(m[1])) fail(`design.md cites string id ${m[1]}, which copy.md does not define`);
        }
      }
    }
  } else fail('design.md is missing');
  return out;
}

// design-freshness (WW-1): design.md indexes the design round the state file names, on its header
// and on every frame index row. Gates an Engineer or QA line moving into running, because both
// build or test from the frame index and neither has another design source.
export function designFreshness(buildDir, round) {
  const out = [];
  const fail = (msg) => out.push({ check: 'design-freshness', msg });
  if (round === null || round === undefined) {
    fail('the state file names no design round. The Orchestrator sets "design-round: <n> (...)" when the Designer finishes');
    return out;
  }
  const design = read(path.join(buildDir, 'design.md'));
  if (design === null) {
    fail('design.md is missing');
    return out;
  }
  const head = design.match(/^Design round:\s*(\S+)/m);
  const indexed = head && /^\d+$/.test(head[1]) ? Number(head[1]) : null;
  if (indexed === null) fail(`design.md has no "Design round: <n>" line, so nothing says which round it indexes. The state file names round ${round}`);
  else if (indexed !== round) fail(`design.md indexes design round ${indexed}; the state file names round ${round}. Re-index before building from it`);
  const rows = tableAfter(design, /^#{2,6}\s+frame index/i).filter((r) => !placeholder(r.surface));
  if (rows.length && !('round' in rows[0])) fail('design.md frame index has no Round column');
  else {
    const stale = rows.filter((r) => clean(r.round) !== String(round));
    if (stale.length) {
      const list = stale.slice(0, 5).map((r) => `"${clean(r.surface)}" ${clean(r.state)} ${clean(r.width)} (round ${clean(r.round) || 'blank'})`);
      fail(`design.md frame index has ${stale.length} row(s) not on round ${round}: ${list.join(', ')}${stale.length > 5 ? ', ...' : ''}`);
    }
  }
  return out;
}

// The round a build's state file names, for the CLI: <root>/state/<build-name>.md beside <root>/builds/.
function roundFor(buildDir) {
  const state = read(path.join(buildDir, '..', '..', 'state', `${path.basename(buildDir)}.md`));
  const m = state && state.match(/^design-round:\s*(\d+)\b/m);
  return m ? Number(m[1]) : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node consistency.mjs <build-dir>');
    process.exit(64);
  }
  const fs = [...consistency(path.resolve(dir)), ...designFreshness(path.resolve(dir), roundFor(path.resolve(dir)))];
  for (const f of fs) console.log(`- ${f.msg}`);
  console.log(fs.length ? `${fs.length} mismatch(es)` : 'consistent');
  process.exit(fs.length ? 1 : 0);
}
