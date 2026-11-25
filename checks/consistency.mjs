#!/usr/bin/env node
// consistency-gate (v0.4, B3-21, PRIOR-ART §1): the contract, the copy deck and the design agree on
// screens, routes and strings, and design.md indexes the design of record intake.md names (WW-1).
// Gates the Engineer's start and every amendment set's Engineer line.
// Run by hand: node .squad/checks/consistency.mjs <build-dir>

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tableAfter } from './md.mjs';
import { parseIntake } from './intake.mjs';

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const clean = (c) => c.replace(/`/g, '').trim();
const placeholder = (c) => !c || /[<>]/.test(c);

export { tableAfter };

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

  // C8 (WW-1): design.md indexes the design of record the kickoff interview settled.
  const intake = read(path.join(buildDir, 'intake.md'));
  const want = intake === null ? null : parseIntake(intake).designOfRecord;
  if (design !== null && want && !placeholder(want) && !/^none\b/i.test(clean(want))) {
    const have = (design.match(/^\*\*Design of record:\*\*[ \t]*(.*)$/m) || [])[1];
    if (!have || placeholder(have)) fail(`design.md has no Design of record line; intake.md names "${clean(want)}"`);
    else if (!sameDesign(want, have)) fail(`design.md indexes "${clean(have)}", but intake.md names "${clean(want)}" as the design of record (WW-1)`);
  }
  return out;
}

// Two design-of-record lines name the same design when the Figma key and the page agree. A line
// with neither is compared whole, ignoring case, backticks and spacing.
export function sameDesign(a, b) {
  const key = (s) => (clean(s).match(/figma\s+(?:file\s+)?([A-Za-z0-9]{6,})/i) || [])[1];
  const page = (s) => ((s.match(/page\s+"([^"]+)"/i) || [])[1] || '').trim().toLowerCase() || undefined;
  const norm = (s) => clean(s).toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '');
  if (!key(a) && !page(a)) return norm(a) === norm(b);
  return (!key(a) || key(a) === key(b)) && (!page(a) || page(a) === page(b));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node consistency.mjs <build-dir>');
    process.exit(64);
  }
  const fs = consistency(path.resolve(dir));
  for (const f of fs) console.log(`- ${f.msg}`);
  console.log(fs.length ? `${fs.length} mismatch(es)` : 'consistent');
  process.exit(fs.length ? 1 : 0);
}
