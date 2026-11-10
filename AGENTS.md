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

The canonical `orquestar-trabajo` skill is the single source for wave limits,
the ORCHESTRATION CONTRACT, the `ownedFiles` collision preflight and the
fallback cascade. Load it whenever a wave has two writers or more than one
agent on the same module; a single line of work does not need it. Only the lead
delegates, and the final `verificador` runs serially after every wave.

## Writing

All user-facing text (UI labels, deliverables, emails, commit subjects, chat
replies) follows the "Redacción" section of `CLAUDE.md`. Run
`node scripts/revisar-redaccion.mjs` on new text before delivering it.
