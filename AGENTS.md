# Prosecnur Codex Instructions

This repository uses the internal repair protocol in
[`docs/codex/repair_loop.md`](docs/codex/repair_loop.md).

Before changing product code, Codex must:

- inspect the current repo state and preserve unrelated user changes;
- write a scope lock with the affected module, intended files, explicitly
  excluded files, main risk, and minimum validation command;
- run or justify the available baseline checks for the task type;
- make one focused change per iteration;
- validate again and record evidence in the iteration contract;
- stop when the documented stopping rule is met.

Prosecnur is a local-first desktop app: Electron + React/Vite/TypeScript +
R/Plumber in `api/`, with portable `.pulso` projects and secrets kept outside
`.pulso`. Do not reference or modify the deprecated `../prosecnur/` directory.
