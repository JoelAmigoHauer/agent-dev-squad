# Copy deck — <build-name>

Written by: Copywriter, Stage 1.5. Every string a user of this build reads, before any screen is
drawn. The Designer designs with these words; the Engineer ships them verbatim, by id.

This template is a scaffold. [../../agents/copywriter.md](../../agents/copywriter.md) is the binding
copy: validate against it, not against this file.

---

```
COPY DECK — <build-name>, <YYYY-MM-DD>
SURFACES: <n>   STRINGS: <n>   FIGURES: <n> sourced, <n> bound, <n> NEEDS SOURCE
```

Every figure is marked where it is written: `[source: <path or URL>, <date read>]`,
`[bound: contract §<n>]` or `[NEEDS SOURCE]`. The Orchestrator verifies each `source` mark before
Stage 2 and records it in `log.md`. A `NEEDS SOURCE` figure does not ship.

---

## /<path> — <surface name>

Diagnosis: <one line>. Pass: <pass name(s)>

| id | element | state | text |
|---|---|---|---|
| `<path>.<element>` | heading | default | |
| `<path>.<element>` | button | default | |
| `<path>.empty` | body | empty | |
| `<path>.error` | body | error | |

---

## Errors

One message per status the contract's common error shape can return.

| id | status | field | text |
|---|---|---|---|
| `error.401` | 401 | | |
| `error.400.<field>` | 400 | `<field>` | |
| `error.403` | 403 | | |
| `error.404` | 404 | | |
| `error.500` | 500 | | |

---

## Emails and notifications

| id | element | text |
|---|---|---|
| `email.<name>.subject` | subject | |
| `email.<name>.body` | body | |

---

## Metadata

| id | element | text |
|---|---|---|
| `meta.<path>.title` | `<title>` | |
| `meta.<path>.description` | description | |
| `meta.<path>.share` | share-card title and text | |
