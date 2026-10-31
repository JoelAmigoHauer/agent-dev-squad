# Log — <build-name>

Written by: the Orchestrator and any stage. **Append only.** Never edit or delete an entry.

Dated notes for the whole run: loop detail, validation results, overrides, decisions and their
reasons. The state file, `/state/<build-name>.md`, holds the stage block and nothing else, so it
stays small enough to read whole.

Each entry starts with its time in Australia/Sydney, computed from the clock, and says how each
fact in it was obtained: observed, counted, classified or deduced.

---

```
<YYYY-MM-DDTHH:MM AEST|AEDT> <stage or orchestrator>
<the note>
```
