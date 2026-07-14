# Loops de reparación

This repository uses the internal repair protocol
[`Loops de reparación`](docs/loops-reparacion.md).

Before changing product code, repair work must:

- inspect the current repo state and preserve unrelated user changes;
- write a scope lock with the affected module, intended files, explicitly
  excluded files, main risk, and minimum validation command;
- run or justify the available baseline checks for the task type;
- make one focused change per iteration;
- validate again and record evidence in the iteration contract;
- stop when the documented stopping rule is met.

Use skill-style routing for repairs: name when the loop applies, which
category/source of truth controls the task, and what output checklist proves the
work is complete.

Loops.so CLI/API/LMX tooling is optional and only applies to explicit Loops
platform tasks. It is not part of the default Prosecnur baseline.

Prosecnur is a local-first desktop app: Electron + React/Vite/TypeScript +
R/Plumber in `api/`, with portable `.pulso` projects and secrets kept outside
`.pulso`. Do not reference or modify the deprecated `../prosecnur/` directory.

House rules, verification gates and the project agentic OS (subagents in
`.claude/agents/`, skills in `.claude/skills/`) are defined in `CLAUDE.md` at
the repo root. Debt metrics baseline lives in `docs/qa/deuda-baseline.md`.

## Claude + Codex compatibility

The existing `.claude/agents/` and `.claude/skills/` paths remain the canonical
repo sources. Codex consumes generated adapters in `.codex/agents/` and
`.agents/skills/`; those adapters must point back to the canonical Claude files
instead of duplicating their instructions.

Before changing agentic-OS files, run:

```bash
node agentic/sync-agentic-os.mjs --check
```

After changing a canonical agent or skill, regenerate adapters with `--write`
and run `--check` again. Do not hand-edit generated adapters. See
`docs/agentic-os.md` and `agentic/manifest.json` for the compatibility contract.

## Adaptive orchestration

For every non-trivial task, the lead must load the canonical
`orquestar-trabajo` skill and decide whether at least two independent lanes
exist. When they do, proactively spawn 2–3 agents in the same wave; the user has
authorized this repository-level delegation. Keep at most three workers, two
writers, and depth one. The lead alone reads governing skills, freezes shared
contracts, assigns non-overlapping globs, integrates results, controls external
side effects, and launches the final `verificador` serially.

Do not delegate trivial one-file work, undefined contracts, overlapping edits,
`.pulso` migrations, destructive operations, credentials, publication, or
external services. If agents are unavailable, execute the same lanes
sequentially and report the fallback. Every delegated prompt must include the
ORCHESTRATION CONTRACT defined by the skill.
