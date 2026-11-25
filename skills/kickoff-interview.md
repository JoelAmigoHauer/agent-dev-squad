# Skill: kickoff interview (Stage 0)

**Loads when:** the Orchestrator starts Stage 0 of a build, by path, in its own context. On a
brownfield build that is after the Surveyor reports; on every build it is before Preflight.
**Does not load:** in a stage subagent (a subagent cannot put a card in front of Joel), on keyword
match, or after `stage-0-intake` is `done`.
**Writes:** `/builds/<build-name>/intake.md`, from `/builds/_template/intake.md`, and the state
file's `mode:`, `format:` and `stage-0-intake` lines.
**Checked by:** `intake-gate` in [../checks/lib.mjs](../checks/lib.mjs). The row IDs, the guard
rows and the format vocabulary below are bound there too, and a test fails when this file and the
code disagree.

Added 2026-11-25 at Joel's request. Before it, Stage 0 was a sketch, an app name and a voice note
read in one turn, and a build that started from less than that had nowhere to grow. Two learnings
sit behind the guard rows: a brief that named the design of record twice, in two messages, built
every page to a superseded round (WW-1), and a deck with nobody holding its figure sources shipped
invented numbers (WS-1).

---

## What the interview is for

It turns whatever Joel brings into one brief, `intake.md`, that every later stage can trust. Joel
might bring a repo, a Figma file, a written brief, a sketch and a voice note, or a single line
naming a topic. The interview reads what exists first, then asks only what the material cannot
answer, one question at a time, on a card with a recommended answer.

It is Stage 0, not a check-in. The brief's rule against invented check-ins starts once
`stage-0-intake` is `done`.

---

## Step 1: name the start

Record on the `**Start:**` line what the build starts from. Pick the richest that applies.

| Start | Joel brought | The read pass reads |
|---|---|---|
| `repo` | An existing codebase. Brownfield | `survey.md`, all of it, §10 above all |
| `design` | A design file, with or without a brief | The design file's pages and their dates, plus anything else he gave |
| `brief` | A written brief, a sketch, a voice note, notes | Every one of them. Transcribe the voice note, read the sketch by vision |
| `idea` | A topic or an idea and nothing else | The topic. Nothing else exists, so every row is drafted (Step 4) |

The build name defaults to the host repository's name. Do not ask it.

## Step 2: the read pass

Before the first card, read everything that exists and fill each row it answers, with
`read: <file, link or message>` as the source. Then post one message listing what you read and the
rows you filled, so Joel can correct any of them in words. Do not ask a row the material answers,
unless it is a guard row (Step 3) or the start is `idea` (Step 4).

A row answered by the material in two different ways is not answered: ask it, and put both
readings on the card.

## Step 3: guard rows, always asked

Eight rows are asked on every build, even when the read pass filled them. A filled guard row goes
on its card with the read answer as the recommended option, and Joel confirms or corrects it. The
gate refuses a guard row whose source is still `read:`.

| Row | Why it is always asked |
|---|---|
| P4 scope, P5 out of scope | Everything downstream is held to the scope. A scope read off a sketch is a guess Joel never made |
| F8 not software at all | The cheapest build is the one that never runs. Asked even when everything says "app" |
| F9 format | It sets the stack, the device matrix and which stages run |
| D1 design round | WW-1: two messages named two rounds and the stale one won |
| C1 voice, C2 banned words | The Copywriter writes in a voice nobody else checks; the banned list is enforced by the gate |
| C3 figure sources | WS-1: figures with no named source were invented |

## Step 4: starting from an idea, grow it into a brief

When the start is `idea` there is nothing to read, so the interview builds the brief. Two rules:

1. **Order.** Ask the problem, the user and the success metric first (P1, P2, P3), then the format
   rows (F1 to F9), and only then scope (P4, P5) and the rest. Scope drafted before the problem is
   known is a feature list for a problem nobody has named.
2. **Draft, never leave a blank.** Every card's recommended option is a full drafted answer, built
   from the topic and every answer so far, using the *Draft from* column of the bank. Never offer
   "TBD", "not sure" or an empty option. A draft Joel picks is recorded `confirmed: drafted`.

On an `idea` start the gate also refuses P1 to P3 and F1 to F7 sourced `read:`: with nothing to
read, a filled row means a question was skipped.

## Step 5: the format

For an `idea` start, and for any start whose material does not settle what kind of thing this is,
ask F1 to F8, then recommend a format on F9 with the reasoning in one or two sentences, and Joel
confirms. F8 and F9 are asked on every build.

Read the answers against this table. Recommend the row the answers point to most; when two fit,
recommend the one with the smaller build and name the other as the card's second option.

| Format | Points to it | Stack | Device matrix (Q1 draft) | Stages |
|---|---|---|---|---|
| `web-app` | Used at a desk or on the move, by one person, a job done | The default stack, `skills/stack-decision.md` | Phone and desktop widths, Chromium in tests | All |
| `saas` | F5: a team sharing data; F6: a subscription | The default stack, with accounts and tenancy bound in the data model | Desktop first, phone width second, Chromium in tests | All |
| `game` | F4: the reward is play and progress | The default stack, in the browser | The widths F1 names, Chromium in tests | All |
| `iphone` | F3: camera, GPS, notifications, offline or Health data; F1: on the move, many times a day | Not the default stack. Stage 1 escalates it (stack decision, trigger 4) | iPhone, current iOS and the one before | Stage 1 halts for Joel before Design |
| `integration` | F7: it lives inside Slack, Shopify, the browser or Excel | The host platform's SDK. Stage 1 escalates it (trigger 4) | The host app's own clients | Stage 1 halts for Joel before Design |
| `not-software` | F8: a person, a spreadsheet or an automation would do it | None | None | None. See below |

**`not-software` ends the build at Stage 0.** Write the alternative into F9's answer (who or what
does the job, and the first step), set every later stage line `skipped (format: not-software)`,
and close the build as *On completion* in `CLAUDE.md` says. The gate refuses Preflight on this
format. Recommending it is a result, not a failure: say so on the card.

## Step 6: one question per card

Use the session's decision card: `request_decision` in a Claude project thread, `AskUserQuestion`
in a terminal session.

- **One card open at a time.** Wait for the answer before the next card, because the next draft is
  built from it. Never batch questions into one card or one message.
- **The card's shape.** The question in about twelve words, two to four options, one recommended.
  Option labels at most 40 bytes; each option's consequence one sentence, at most 200 bytes.
- **Free text where the answer is long.** Scope, out of scope, voice, banned words and figure
  sources do not fit a label. Post the drafted answer as a message, then put a card with "Use this
  draft" (recommended), a shorter or wider alternative, and "I'll write my own". An answer Joel
  types in words answers the open card: record it, and close the card.
- **Write the row as soon as the answer lands**, with Edit on `intake.md`. A restart resumes from
  the first row still holding a placeholder, never from the conversation.
- **A row Joel cannot answer yet** takes your draft as `confirmed: drafted` if he accepts it, or
  his words as `Joel`. No row is left blank and no row carries `[DRAFT]` at the end.

## The question bank

The IDs and the Guard column are bound by `checks/lib.mjs`. Ask in this order, skipping rows the
read pass answered unless Step 3 or Step 4 says otherwise.

| ID | Discipline | Question | Guard | Draft from, when nothing answers it | Read by |
|---|---|---|---|---|---|
| P1 | Product | What problem does this solve, and who feels it most? | no | The topic, restated as one problem one kind of person has | Architect, Copywriter |
| P2 | Product | Who uses it, and what are they doing the moment before? | no | One kind of user and the moment they reach for it | Architect, Copywriter, Designer |
| P3 | Product | Which one number moves if this works? | no | One number: where it is counted, its value now if known, the target | Architect, Retro |
| F1 | Format | Where is the person when they need it? | no | Desk, on the move or a shared screen, from P2's moment | Format, Designer |
| F2 | Format | How often do they use it? | no | Once, weekly or many times a day, from P2 and P3 | Format |
| F3 | Format | Does it need camera, GPS, notifications, offline or Health data? | no | None, unless P2's moment needs one | Format, Architect |
| F4 | Format | Is the reward play and progress, or a finished job? | no | A finished job, unless the topic is a game | Format |
| F5 | Format | Is it one person, or a team sharing data? | no | One person, unless P2 names a team | Format, Architect |
| F6 | Format | Who pays for it, and how? | no | Nobody yet: free while P3 is proven | Format, Architect |
| F7 | Format | Does it live inside Slack, Shopify, the browser or Excel? | no | No, it stands alone | Format, Architect |
| F8 | Format | Could a person, spreadsheet or automation do this instead? | yes | Your honest answer: name the cheapest non-software way and why it falls short, or recommend it | Format |
| F9 | Format | Which format should it be? | yes | The *Format* table above: one backticked format, then the reasoning | State file `format:`, Architect, QA |
| P4 | Product | What must v1 do, flow by flow? | yes | The fewest flows that move P3, in the order a user meets them | Architect |
| P5 | Product | What is out of scope for v1? | yes | What an idea like this tends to pull in that P3 does not need | Architect |
| D1 | Design | Which design round is final, and what is still open? | yes | No design yet: the Designer draws from the copy deck and the contract | Designer, Engineer, consistency check |
| D2 | Design | Which design system or brand rules bind the screens? | no | The stack's default components, tokens derived by the Designer | Designer |
| D3 | Design | Which worst states matter: empty, error, loading, offline? | no | Empty, error and loading on every screen that fetches; offline only if F3 says so | Designer, Copywriter |
| C1 | Copy | Whose voice does it speak in? | yes | Plain and direct, second person, Australian spelling | Copywriter |
| C2 | Copy | Which words must never appear? | yes | The banned list in Joel's own writing rules, when this session can read them | Copywriter, intake gate |
| C3 | Copy | Where does every number on screen come from? | yes | `no figures`: the copy states no figures, so any it needs is `[NEEDS SOURCE]` | Copywriter, figure check |
| E1 | Engineering | Is this new code or an existing repo, and what must not break? | no | Read the repo: empty is greenfield; otherwise brownfield, and the survey's working bindings must not break | State file `mode:`, Architect |
| E2 | Engineering | Which data is real at launch, and which is mocked? | no | Real for everything a P4 flow writes; mocked only where a third party is not yet connected | Architect |
| E3 | Engineering | Who signs in, how, and what can each role do? | no | One role, email sign-in, sees only their own data | Architect |
| E4 | Engineering | What personal data does it hold, and which rules apply? | no | Only what the P4 flows collect; data and functions in Sydney (B3-22); no named regulation | Architect, Security |
| Q1 | QA | Which devices and browsers must it work on? | no | The F9 format's row in the *Format* table | Architect, QA |
| Q2 | QA | What accessibility bar must it clear? | no | No automated serious or critical axe violations, `agents/qa.md` coverage item 7 | Architect, QA |
| O1 | Orchestrator | When is it due, and what gets cut first? | no | No date; the last P4 flow is cut first | Architect, Orchestrator |
| O2 | Orchestrator | Who answers a halt, and how fast? | no | Joel, within a working day | Orchestrator, for every escalation |

**Never draft a figure.** C3's draft is a list of sources or `no figures`, never a number. P3's
draft names where the number is counted; its value now is Joel's to give or to leave as "not
known yet".

## Writing it down

| Answer | Where it goes | Read by |
|---|---|---|
| Every row | `intake.md`'s *Answers* table: answer and source | The Architect, whole; the Copywriter and Designer, for their rows |
| D1 | `intake.md`'s `**Design of record:**` line, in the shape below | The Designer copies it to `design.md`; the consistency check compares the two before the Engineer starts |
| C2 | Backticked words or phrases in C2's answer, or `none`. A trailing `*` matches any ending, as in `leverag*` | `intake-gate` refuses a Designer start while `copy.md` holds one |
| E1 | The state file's `mode:` line, `greenfield` or `brownfield` | Every stage |
| F9 | The state file's `format:` line, the same word as F9's first backticked word | `intake-gate`, the Architect's stack decision, QA's device matrix |
| Done | `stage-0-intake: done (/builds/<build-name>/intake.md, <n> asked, <n> read, <n> drafted)` | The state lint |

In the done line, asked and read add up to the bank's 28 rows; drafted counts the asked rows Joel
took as you drafted them.

The design of record line, as `README.md` gives it:

```
**Design of record:** Figma <key>, page "<name>" (<date>), plus route pages <list>.
**Design of record:** none (the Designer draws from the copy deck and the contract)
```

Source values, one per row:

| Source | Means |
|---|---|
| `read: <where>` | The read pass filled it and it was not asked. Never on a guard row |
| `Joel` | Joel's own words, typed or picked as written |
| `confirmed: drafted` | You drafted it, Joel picked it |
| `confirmed: read <where>` | The read pass filled it and Joel confirmed it on a card |

## Done when

`intake-gate` refuses `stage-0-intake: done`, and refuses `stage-0.5-preflight: running`, until all
of these hold. Its message names the row.

- `intake.md` exists, with a `**Start:**` of `idea`, `brief`, `design` or `repo`.
- Every bank ID has one row, with an answer and a source, and no placeholder or `[DRAFT]` left.
- No guard row is sourced `read:`; on an `idea` start, neither is P1 to P3 or F1 to F7.
- C2 is `none` or names at least one backticked word.
- F9 names one format from the table, and the state file's `format:` line says the same.
- The `**Design of record:**` line is filled, or says `none`.
- For Preflight: `stage-0-intake` is `done`, and the format is not `not-software`.

Then fire Preflight. The interview does not reopen. A change Joel asks for later, to anything the
contract binds, is an amendment (B3-16).

## What the interview never does

- Choose the stack. F9 names the format; the Architect decides the stack, by
  `skills/stack-decision.md`.
- Invent a figure, a date or a name.
- Ask a non-guard row the material answers, or open a second card while one is open.
- Run in a stage subagent, or count as a halt.
