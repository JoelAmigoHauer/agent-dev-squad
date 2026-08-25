# Design — thelma

Written by: Designer, Stage 2. Binding on Stage 3.
Date: 2026-08-24

---

## 1. Mode

```
MODE: B — production pass
```

The contract's `FIDELITY` field reads `production`, so Mode B. Not re-decided here; the Architect
made the call from the intake.

### Two conditions this stage inherited, and what each changed

**No visual source existed at intake — a Figma file was created at Stage 2 re-do.** Preflight
recorded the original condition: a written brief, no sketch, no voice note, no Figma file. Tokens
were therefore `derived` and non-binding.

That was closed on 2026-08-25. `agents/designer.md` permits the Designer to *create* a Figma file
where none exists — *"If a Figma file exists for the project, **or you create one**, pull exact
values rather than estimating them"* — and the first pass read the absence as settling the
question rather than as an instruction. Joel raised it. The file now exists:

```
Thelma — Design System v1.0
file key: JWOShrmCfUS7YVaGBArJHg
https://www.figma.com/design/JWOShrmCfUS7YVaGBArJHg
```

**Every colour, spacing, radius and type token in §5 is now `extracted`** — created as Figma
variables, pulled back as data via `get_variable_defs`, and verified against `app/globals.css`.
Per Engineer guardrail 2 they are now **binding**, not adjustable. See §5 for the round-trip
evidence and §8 for exactly how much of the design is in Figma and how much is not.

**The 21st.dev CLI install route does not work on this machine.** Discovered at this stage, not at
Preflight. The account is `paid` and unmetered — that part Preflight got right — but every
`installCommand` the catalogue returns is of the form:

```
npx shadcn@latest add "https://21st.dev/r/<author>/<component>?api_key=$API_KEY_21ST"
```

and `API_KEY_21ST` is **not set** in this environment. The command would resolve to a literal empty
key and fail at Stage 3 install time.

The MCP `get_component` route is unaffected and returns component code directly. **Stage 3
retrieves through MCP and vendors the code into `components/ui/`, rather than installing via the
CLI.** This costs nothing on a paid tier and is the same code.

Recorded for Stage 7: Preflight's 21st.dev probe checks the *tier* but not the *install path*. Those
are different failures and the second one is invisible until a component is actually needed. The
probe table needs a second cell.

---

## 2. Design intent

Three constraints from the contract drive every visual decision, and they are worth stating before
the screen list because they explain choices that would otherwise look austere.

**This is a dense numeric product read by professionals.** Basis points, allocation bands, drift
figures and dollar amounts sit next to each other in tables. Tabular figures, right-aligned numbers
and a tight vertical rhythm matter more than generous whitespace.

**Every screen is potentially evidence.** The contract's ledger is examiner-facing. Screens that
show a decision — recommendation detail, run trace, ledger — are laid out to be *read as a record*:
provenance visible without interaction, no information behind a hover, nothing that fails to print.

**The dangerous action is approval, and it must never be the easy one.** Approve is a deliberate,
single, clearly-labelled action with the projected impact adjacent to it — never a row-level
one-click in a list, which is how an advisor approves the wrong household.

---

## 3. Screen inventory

Ten screens from the contract §1. No screen is invented here and none is dropped.

### Shared components — built once, used everywhere

Build 1 cloned a nav rail across four screens; the fourth is the one that got missed. Every element
below appears on more than one screen and is **one component with variants**, named here so Stage 3
builds it once.

| Component | Variants | Appears on |
|---|---|---|
| `AppShell` | — | every authenticated screen |
| `NavRail` | collapsed, expanded | inside `AppShell` only |
| `ShadowModeBanner` | on, off (renders nothing) | inside `AppShell`, so it cannot be forgotten on a screen |
| `StatusPill` | pending, approved, rejected, modified, expired, running, failed, complete, draft, published, superseded | dashboard, household detail, recommendation, ledger, versions, run trace |
| `SeverityDot` | info, warning, critical | dashboard, household detail, run trace |
| `DriftBar` | within-band, breached | household detail, recommendation detail |
| `MoneyCell` / `BpsCell` | positive, negative, neutral | every table showing figures |
| `ProvenanceBlock` | — | recommendation detail, run trace |
| `EmptyState` | no-data, no-results, not-configured | every list |
| `DataTable` | — | households, ledger, holdings, legs, versions |
| `ConfirmDialog` | default, destructive | approve, reject, publish, shadow-mode toggle |

`ShadowModeBanner` living inside `AppShell` rather than being placed per-screen is deliberate: a
banner an engineer has to remember to add is a banner that will be missing from exactly the screen
where it mattered.

### The screens

**S1 · Sign in** — `/sign-in`. Centred card on a plain ground. Email + password, magic-link
alternative. No sign-up link, and no "create account" copy anywhere — the contract forbids public
sign-up and the UI should not imply one exists. *States:* idle, submitting, invalid credentials,
magic-link-sent, rate-limited.

**S2 · Firm dashboard** — `/`. Four `StatCard`s across the top (households, open recommendations,
households breaching bands, last cycle run). Below: a two-column split — open recommendations
ranked, and recent agent activity as a feed. Shadow-mode banner above all of it when on.
*States:* loading (skeleton mirroring the real layout, not a spinner), empty (no households yet →
prompts to add one), error, loaded.

**S3 · Household list** — `/households`. `DataTable`: name, primary advisor, market value, drift
(worst band, as a `DriftBar`), open recommendations, mandate status, last run. Sortable on every
column, filter by mandate status and breach. *States:* loading, empty, no-results-for-filter (a
distinct state from empty — the two are different problems and the fix differs), error.

**S4 · Household detail** — `/households/:id`. The densest screen. Header: name, market value,
mandate version + status, "Run monitoring cycle". Four regions:
- *Allocation* — one `DriftBar` per asset class, target/actual/band/drift, breach flagged.
- *Holdings* — `DataTable` by account, grouped, showing tax treatment per account.
- *Open recommendations* — ranked list, each a link to S7. **Not** approvable from here.
- *Run history* — compact list linking to S9.
*States:* loading, no-mandate (blocking empty state — "Configure a mandate" is the only action),
no-positions (prompts to import or sync), no-recommendations (a success state, worded as "within
mandate", never as an error), stale-prices (a warning strip, not a blocker), error.

**S5 · Mandate editor** — `/households/:id/mandate`. Six-step wizard, the `<10 minute` target.
Steps: objective & risk → allocation bands → tax → liquidity → rebalancing → autonomy. Progress rail
is clickable backwards, never forwards past an incomplete step. Each step autosaves a draft on
blur and on Next.
- *Allocation step* carries the one genuinely custom control: a band editor where each asset class
  has target/min/max in basis points, with a live running total. **The total renders red and
  Publish is disabled until it reads exactly 10000bps** — the server refuses anyway, but making the
  rule visible while editing is the difference between a 10-minute config and a frustrating one.
- *Autonomy step* shows tier per action. Choosing `auto_execute` reveals two required bound fields
  and cannot be left without them. The database refuses an unbounded tier; the UI should not let
  the advisor reach that refusal.
*States:* loading, draft-resumed (an explicit strip — "Resuming your draft from <time>"), saving,
save-failed, validation-error per field, publish-conflict (another advisor published; offers
reload), published-success.

**S6 · Mandate versions** — `/households/:id/mandate/versions`. Timeline of published versions,
newest first, each with version, status pill, published by, published at. Expanding one shows a
field-level diff against its predecessor: changed values with old struck and new emphasised.
*States:* loading, single-version (no diff to show — says so rather than rendering an empty diff),
error.

**S7 · Recommendation detail** — `/recommendations/:id`. The screen the whole product exists for,
laid out as evidence, top to bottom:
1. Header — action type, rank, status pill, expiry countdown.
2. **Rationale** — the model's prose, given room. Not truncated, not behind a "read more".
3. **Legs** — `DataTable`: account, security, side, quantity, est. price, est. amount.
4. **Projected impact** — drift before/after as paired `DriftBar`s, realised gain, tax cost.
5. **Guardrail result** — every rule evaluated, pass or fail, not only the breaches. A passing
   recommendation shows eleven green rows. That is the point: an examiner can see rule 7 was
   checked, and "checked and fine" is visually distinct from "never checked".
6. **`ProvenanceBlock`** — positions as-of, prices as-of and source, mandate version, model, run id
   (linking to S9).
7. **Actions** — Approve / Reject / Modify, in a footer bar, each opening a `ConfirmDialog`. Reject
   requires a reason before its confirm enables.
*States:* loading, pending, already-decided (actions replaced by the decision record — who, when,
note), expired (actions disabled with the reason stated), stale-data (approve disabled, explained),
guardrail-breach-on-modify (inline, naming every breached rule), error.

**S8 · Decision ledger** — `/ledger`. `DataTable`: seq, occurred at, actor (advisor name or agent
identity, visually distinct), event type, household, subject. Filters: household, actor type, event
type, date range. Row expands to show payload and data sources. Two actions in the header: "Export
CSV" and "Verify chain".
- *Verify chain* result renders inline as a strip: intact (entry count + head hash) or broken
  (first divergent seq, expected vs found). The broken state is designed, not an error toast — it
  is the most important thing this screen can ever say.
*States:* loading, empty, no-results-for-filter, verifying, verified-intact, verified-broken,
export-in-progress, error.

**S9 · Agent run trace** — `/runs/:id`. Header: household, mandate version, trigger, status,
duration. Then steps in `seq` order as a vertical timeline, each row: agent name, step type, latency,
model. Expanding shows input and output JSON.
- **`rejection` steps render distinctly** — a proposal the guardrail engine killed. It never reached
  the advisor, and the trace is the only place it exists. Rendering it as an ordinary step hides the
  single most useful thing in the run.
*States:* loading, running (live-updating, steps append), complete, failed (error surfaced at the
top, steps still shown up to the failure), error.

**S10 · Settings** — `/settings`. Four sections:
- *Custodian connections* — one row per vendor with status pill, last sync, last error. "Sync now"
  per connected vendor, "Import holdings" file drop for CSV.
- *Shadow mode* — a switch with consequence text next to it, not under it. `principal` only;
  disabled with an explanatory tooltip for other roles rather than hidden, so an advisor understands
  why they cannot.
- *Advisors* — list with roles, "Invite advisor" (`principal` only).
- *Firm* — name, CRD number.
*States:* loading, no-connections, sync-running, sync-failed (shows `last_error` verbatim — a
paraphrased vendor error is a support ticket), permission-denied per section, error.

---

## 4. Component provenance

**Retrieval route: MCP `get_component`, vendored into `components/ui/`.** Not `npx shadcn add` —
see §1. Base layer is shadcn/ui, which every component below is built on, so they compose rather
than collide.

### From 21st.dev

| Need | Component | Author / id | Screens |
|---|---|---|---|
| App shell + nav rail | `Dashboard Sidebar` | `arunjdass` / 14941 | all authenticated |
| Loading skeletons | `Sidebar Dashboard Skeleton` | `cnippet.dev` / 19009 | S2 loading |
| Tables | `Basic Data Table` — sorting, filtering, pagination solved | `preetsuthar17` / 2750 | S3, S4, S7, S8 |
| Table in card frame | `Card Frame Table` — has the totals footer S4 holdings needs | `cnippet.dev` / 22188 | S4 |
| Stat cards | `Statistics Card 1` | `sean0205` / 4220 | S2 |
| Stat card skeletons | `Stat Cards Skeleton` | `felipemenezes098` / 18999 | S2 loading |
| Six-step wizard | `Wizard Steps` — clickable rail, keyboard nav, completion state | `ddoemonn` / 23576 | S5 |
| Status pills | `Pill` | `haydenbleasel` / 1600 | everywhere |
| Severity badges | `Alert Badge` | `serafimcloud` / 522 | S2, S4, S9 |
| Shadow-mode banner | `Announcement` | `haydenbleasel` / 539 | `AppShell` |
| Expandable log rows | `Interactive Logs Table` — filters, search, expandable rows; closest match to S8 and S9 | `moumensoliman` / 10635 | S8, S9 |
| Version timeline | `Great UI Revision Timeline` | `saurabh-2607` / 23363 | S6 |

### Hand-built, and why

| Component | Why nothing in the catalogue fits |
|---|---|
| `AllocationBandEditor` | Target/min/max in basis points per asset class with a live 10000bps total and ordering constraint. Domain-specific; no generic control expresses a three-handle bounded band |
| `DriftBar` | A bar showing actual against a target *inside a tolerance band*, with breach state. Progress bars show one value against a maximum, which is a different picture |
| `GuardrailResultPanel` | Eleven named rules with pass/fail where the passes matter as much as the failures. Every catalogue result panel surfaces only failures |
| `ProvenanceBlock` | A fixed evidence block — as-of timestamps, source, mandate version, model, run link. Trivial to build, and nothing generic carries the right semantics |
| `MoneyCell` / `BpsCell` | Tabular figures, right alignment, sign colouring, and the contract's numeric policy (`numeric(20,4)`, integer bps) enforced at the render layer so no screen formats money its own way |
| `LedgerVerifyStrip` | The intact/broken chain result. Bespoke because the broken state must not read like a transient error |

---

## 5. Design tokens

```
STATUS: extracted — all tokens, as at 2026-08-25.
        Source: Figma file JWOShrmCfUS7YVaGBArJHg, collections Color / Spacing / Radius / Type.
        Pulled back as data via get_variable_defs and reconciled against app/globals.css.
        Per Engineer guardrail 2 these are BINDING. Ship the value as written; do not eyeball a
        value that exists as data.
```

**Round-trip evidence.** The pull is what makes the status `extracted` — the values below came
back *out* of Figma, they were not read off this document. All 21 colour tokens returned, keyed by
the WEB code syntax set on each variable, and all 21 matched `app/globals.css` exactly with zero
mismatches and zero missing:

```
var(--bg) #fbfbfd        var(--surface) #ffffff       var(--surface-sunken) #f4f5f8
var(--border) #e3e5ea    var(--border-strong) #c9cdd6 var(--text) #14161c
var(--text-muted) #5b6272 var(--text-subtle) #868d9d  var(--accent) #2563eb
var(--accent-hover) #1d4ed8 var(--accent-subtle) #eff4ff
var(--positive) #067647  var(--positive-subtle) #ecfdf3
var(--negative) #b42318  var(--negative-subtle) #fef3f2
var(--warning) #b54708   var(--warning-subtle) #fffaeb
var(--info) #175cd3      var(--info-subtle) #eff8ff
var(--neutral) #5b6272   var(--neutral-subtle) #f4f5f8
```

**Variable collections in the file** — 45 variables total:

| Collection | Modes | Count | Scopes |
|---|---|---|---|
| `Color` | **Light, Dark** | 21 | `FRAME_FILL`/`SHAPE_FILL`, `TEXT_FILL`, `STROKE_COLOR`, `ALL_FILLS` per token |
| `Spacing` | Default | 10 | `GAP`, `WIDTH_HEIGHT` |
| `Radius` | Default | 4 | `CORNER_RADIUS` |
| `Type` | Default | 10 | `FONT_SIZE`, `FONT_FAMILY` |

Dark is a **mode on the Color collection**, not a second set of variables — so switching the mode
on any frame previews the whole dark palette, and the two can never drift apart the way two
parallel token sets do. Every variable carries explicit `scopes` (never `ALL_SCOPES`, which
pollutes every picker) and a `WEB` code syntax equal to its CSS custom property name, so the Figma
name and the CSS name cannot diverge.

Sober, high-contrast, built for dense numerics. Blue is reserved for interactive affordances only,
so it never competes with the semantic colours that carry meaning in a table.

```css
/* colour — light */
--bg:              #FBFBFD;   --surface:        #FFFFFF;
--surface-sunken:  #F4F5F8;   --border:         #E3E5EA;
--border-strong:   #C9CDD6;
--text:            #14161C;   --text-muted:     #5B6272;
--text-subtle:     #868D9D;
--accent:          #2563EB;   --accent-hover:   #1D4ED8;   --accent-subtle: #EFF4FF;

/* semantic — these carry meaning in tables and must stay distinguishable in greyscale,
   because these screens get printed for examinations */
--positive:        #067647;   --positive-subtle: #ECFDF3;
--negative:        #B42318;   --negative-subtle: #FEF3F2;
--warning:         #B54708;   --warning-subtle:  #FFFAEB;
--info:            #175CD3;   --info-subtle:     #EFF8FF;
--neutral:         #5B6272;   --neutral-subtle:  #F4F5F8;

/* colour — dark */
--bg:              #0C0E13;   --surface:        #14171E;
--surface-sunken:  #0F1218;   --border:         #262B36;
--border-strong:   #3A414F;
--text:            #F2F4F8;   --text-muted:     #9AA2B1;
--text-subtle:     #6E7686;
--accent:          #5A8BFF;   --accent-hover:   #7BA3FF;   --accent-subtle: #16213A;
--positive:        #47CD89;   --negative:       #F97066;
--warning:         #F5A524;   --info:           #6BA6FF;

/* type — Inter for prose, tabular numerals mandatory for every figure */
--font-sans:  Inter, ui-sans-serif, system-ui, sans-serif;
--font-mono:  "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
--fs-xs: 0.75rem;   --fs-sm: 0.8125rem;  --fs-base: 0.875rem;  --fs-md: 1rem;
--fs-lg: 1.125rem;  --fs-xl: 1.375rem;   --fs-2xl: 1.75rem;    --fs-3xl: 2.25rem;
--lh-tight: 1.25;   --lh-normal: 1.5;    --lh-relaxed: 1.65;
--fw-normal: 400;   --fw-medium: 500;    --fw-semibold: 600;

/* Base is 0.875rem, not 1rem. This is a professional data tool viewed for hours; the whole
   scale steps down one notch from a marketing default so a table row fits without cramping. */

/* spacing — 4px base */
--sp-1: 0.25rem;  --sp-2: 0.5rem;   --sp-3: 0.75rem;  --sp-4: 1rem;
--sp-5: 1.25rem;  --sp-6: 1.5rem;   --sp-8: 2rem;     --sp-10: 2.5rem;  --sp-12: 3rem;
--row-height: 2.75rem;   /* table row, tuned so ~14 rows fit above the fold at 1080p */

/* radius, elevation, motion */
--r-sm: 4px;  --r-md: 6px;  --r-lg: 10px;  --r-full: 9999px;
--shadow-sm: 0 1px 2px rgb(16 24 40 / 0.05);
--shadow-md: 0 4px 8px -2px rgb(16 24 40 / 0.10), 0 2px 4px -2px rgb(16 24 40 / 0.06);
--shadow-lg: 0 12px 16px -4px rgb(16 24 40 / 0.08), 0 4px 6px -2px rgb(16 24 40 / 0.03);
--dur-fast: 120ms;  --dur-base: 200ms;  --ease: cubic-bezier(0.16, 1, 0.3, 1);
```

**Two token rules that are not cosmetic.** Semantic colours must remain distinguishable in
greyscale, because these screens get printed for examinations. And every figure uses
`font-variant-numeric: tabular-nums` — a drift column whose digits shift width between rows is
unreadable at a glance, which is the only way anyone reads it.

---

## 6. States — the completeness check

Every screen that fetches or submits, with its four mandatory states. A screen missing its empty
and error states is not designed, and QA will find it.

| Screen | Empty | Loading | Error | Success |
|---|---|---|---|---|
| S1 Sign in | n/a | button spinner, form locked | invalid credentials, rate-limited | redirect to `/` |
| S2 Dashboard | no households → add one | layout-shaped skeleton | retry strip, nav still usable | — |
| S3 Household list | no households vs no-results-for-filter, **distinct** | table skeleton | retry strip | — |
| S4 Household detail | no-mandate (blocking), no-positions, no-recommendations (**a success**) | per-region skeletons | per-region, so one failure does not blank the screen | run queued toast |
| S5 Mandate editor | fresh draft | step skeleton | per-field validation + save-failed banner | published → S6 |
| S6 Versions | single version → says so | timeline skeleton | retry strip | — |
| S7 Recommendation | n/a | detail skeleton | retry; guardrail breach inline | decision recorded in place |
| S8 Ledger | no entries vs no-results-for-filter | table skeleton | retry; **verify-broken is a designed state, not an error** | export downloaded toast |
| S9 Run trace | no steps yet (running) | timeline skeleton | failure surfaced, steps still shown | complete badge |
| S10 Settings | no connections | section skeletons | per-section; sync error shows vendor text verbatim | saved toast |

Two of these are deliberately not errors, and Stage 3 must not "helpfully" convert them: a household
**within** its mandate producing zero recommendations is the product working, and a ledger chain
verifying as broken is a successful verification reporting a true result.

---

## 7. Clarifications raised to the Architect

None. Every screen in the contract has a design, every control in the flow-bindings table maps to a
rendered element, and no screen needed a field the contract does not carry.

---

## 8. What is in the Figma file

Added at the Stage 2 re-do, 2026-08-25. All ten screens are built.

```
Thelma — Design System v1.0
https://www.figma.com/design/JWOShrmCfUS7YVaGBArJHg
Pages: Tokens · Components · Screens
```

### Screens — 10 of 10

| Screen | Route | Built |
|---|---|---|
| S1 Sign in | `/sign-in` | Yes — no sign-up affordance anywhere, invite-only copy present |
| S2 Firm dashboard | `/` | Yes — four stat cards, open recommendations, agent activity |
| S3 Household list | `/households` | Yes — drift bars per household, mandate version, open count |
| S4 Household detail | `/households/:id` | Yes — the densest screen: allocation bands, holdings, run history |
| S5 Mandate editor | `/households/:id/mandate` | Yes — six-step rail, band editor, live 100.00% total |
| S6 Mandate versions | `.../mandate/versions` | Yes — field-level diffs, and the first version says it has nothing to compare against |
| S7 Recommendation detail | `/recommendations/:id` | Yes — rationale, legs, all eleven guardrail rows, provenance, decision |
| S8 Decision ledger | `/ledger` | Yes — agent and advisor actors visually distinct, chain-intact strip |
| S9 Agent run trace | `/runs/:id` | Yes — seven steps including a guardrail `rejection` rendered distinctly |
| S10 Settings | `/settings` | Yes — connections with verbatim vendor error, shadow mode, advisors |

Every screen carries the `AppShell` nav rail and the `ShadowModeBanner`, which lives inside the
shell rather than per-screen precisely so no screen can be missing it.

### Tokens and components

| | Status |
|---|---|
| **Design tokens — all 45** | **Complete and `extracted`.** Colour (21, Light + Dark modes), Spacing (10), Radius (4), Type (10). Round-trip verified against `globals.css`, zero mismatches |
| Colour reference sheet | Complete — every token as a bound swatch |
| `StatusPill` | Complete — 11 variants |
| `SeverityDot` | Complete — 3 variants |
| `DriftBar` | Complete — 2 variants |

### Still not extracted as reusable components

Eight shared elements are **drawn on every screen but composed as frames**, not extracted into
Figma components: `AppShell`, `NavRail`, `ShadowModeBanner`, `MoneyCell`/`BpsCell`,
`ProvenanceBlock`, `EmptyState`, `DataTable`, `ConfirmDialog`, `GuardrailResultPanel`,
`LedgerVerifyStrip`. They exist in code in `components/ui/`, so the code is the single source for
them today; a later pass should extract them in Figma so the two agree structurally as well as
visually.

### Defects found and fixed while building

Three, all caught by screenshotting each screen rather than assuming it rendered:

1. **S3** — the market-value and drift columns collided with zero gap, rendering as
   `MARKET VALUEWORST DRIFT`. Cells were laid out with `itemSpacing: 0` and exact widths.
2. **S4** — drift values wrapped one character per line on breached rows only. The value was set
   to `FILL` and the `outside band` flag squeezed it to near-zero width.
3. **S4 again** — the first fix made every row wrap, because rows carrying the flag were 88px
   narrower than the rest. The columns had never summed inside the card. Fixed with widths that
   actually fit, and a slimmer recommendations card.

The second and third are the same defect the flow-bindings table exists to catch one level up: a
layout that looks right in one row and fails in another is invisible until something drives every
row.

### What this changes for the Engineer

| Layer | Binding? |
|---|---|
| **Tokens** | **Yes.** `extracted`. `tailwind.config.ts` and `globals.css` already match exactly |
| **All ten screens** | **Yes.** These are drawn; match them |
| The eight unextracted components | Code is the source of truth for now |
