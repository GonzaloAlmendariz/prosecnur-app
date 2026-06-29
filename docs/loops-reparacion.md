# Loops de reparación

This protocol is the default way to repair Prosecnur bugs without drifting into
large, hard-to-review changes. Use it for Monitoreo, Form Editor, Sampling,
Dashboard, reports, Kobo/SurveyMonkey integration, and any other module.

The loop is operational, not academic: audit, baseline, isolate one failure,
change a small surface, validate, record evidence, and repeat only until a
stopping rule is met.

## Repository Facts

- Product shape: local-first desktop app, Electron shell, React/Vite/TypeScript
  frontend, R/Plumber backend in the `prosecnurapp` package under `api/`.
- Persistence: local sessions and portable `.pulso` files. Secrets must stay
  outside `.pulso`.
- Active repo: this monorepo only. Do not read from or write to deprecated
  `../prosecnur/`.
- Canonical architecture: see `docs/arquitectura-prosecnur.md` and
  `docs/adrs/README.md`.
- Development overview: see `README.md`.
- Canonical audit project flow: see `docs/auditoria-canonica.md`.
- PPTX preview renderer notes: see `docs/pptx-preview-renderer.md`.

## Skill Pattern To Reuse

The installed Loops skills are useful as a workflow pattern, not as a required
dependency. Reuse their structure for Prosecnur repair work:

- **When to use:** state the trigger in plain language before acting. Example:
  "Use this loop when a concrete bug, regression, failed check, or broken UI
  state has been named."
- **Working style:** prefer current local evidence over memory, keep secrets out
  of logs and files, use structured output for tool results when it feeds the
  next step, and choose the smallest command that answers the question.
- **Category routing:** route the task to the right source of truth before
  editing. Frontend repairs use `frontend/package.json` and nearby tests;
  backend repairs use `api/DESCRIPTION`, `api/R/`, and `api/tests/testthat/`;
  architecture repairs use `docs/arquitectura-prosecnur.md` and ADRs; UI
  repairs use browser or screenshot evidence when available; external-tool
  repairs use that tool's own help/docs and stay outside the default baseline.
- **Output checklist:** finish with changed files, validation evidence,
  residual risk, and whether product behavior, architecture, persistence,
  secrets, or external services were touched.

If a domain needs its own repeated repair rules later, add a short section using
this same shape instead of expanding the loop into a long playbook.

## Optional Loops.so Tooling

Loops.so CLI/API/LMX tooling is optional and only applies to explicit Loops
platform tasks. It is not part of the default Prosecnur baseline.

Use them inside a repair loop only when the task explicitly involves Loops
CLI/API/LMX/email work, or when a Loops-specific integration needs exact command
or payload context.

When Loops tooling is in scope:

- prefer `loops agent-context` for current CLI command shapes;
- use `~/.local/bin/loops` if `loops` is not on the shell `PATH`;
- keep API keys outside this repo, `.pulso`, docs, fixtures, and logs;
- prefer keyring-backed `loops auth login` or an external `LOOPS_API_KEY`;
- use `loops auth status` or `loops api-key` only when credential validation is
  explicitly needed;
- record every Loops command in the iteration contract, including whether it
  made a network call;
- treat Loops API calls as user-triggered external operations, never as a
  default local repair check.

If the repair does not involve Loops platform behavior, do not run Loops
commands. The name "Loops de reparación" refers to this repository workflow,
not to a required dependency on Loops.so.

## Verified Validation Surface

These commands and paths exist in this repo at the time this guide was added.
Prefer the narrowest command that can prove or disprove the repair.

### Makefile

- `make dev-api`
- `make dev-frontend`
- `make dev-pulso PULSO=/path/to/project.pulso`
- `make dev-electron-vite`
- `make visual-qa`
- `make ui-quick-check`
- `make monitoreo-qa PULSO=/path/to/project.pulso`
- `make audit-reference-build`
- `make audit-reference-run`
- `make audit-reference-smoke`
- `make desktop-audit`
- `make build`
- `make build-if-stale`
- `make build-if-stale-fast`
- `make desktop`
- `make desktop-fast`

There is no root `package.json` in this repo. The Node scripts live under
`frontend/` and `desktop/`.

### Frontend

Defined in `frontend/package.json`:

```bash
pnpm --dir frontend dev
pnpm --dir frontend build
pnpm --dir frontend build:fast
pnpm --dir frontend typecheck
pnpm --dir frontend preview
pnpm --dir frontend test
```

Current frontend tests are `*.test.ts` and `*.test.tsx` files under
`frontend/src/`, run by `vitest run`.

### Backend R

`api/DESCRIPTION` declares R `>= 4.1`, `testthat (>= 3.0.0)`, `pkgload`, and
`Config/testthat/edition: 3`.

Use targeted tests first:

```bash
Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-some-area.R")'
```

Use the full R test directory when the change touches shared backend behavior:

```bash
Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_dir("api/tests/testthat")'
```

R tests live in `api/tests/testthat/`.

## Scope Lock

Before editing product code, write a scope lock in the working notes or user
update:

```text
Scope lock
- Module:
- Files I plan to touch:
- Files I will not touch:
- Main risk:
- Minimum validation command:
```

If the next step would touch files outside the lock, stop and update the lock
before editing.

## Baseline

Run the available baseline before changing code, unless the task is docs-only
or the command is clearly unrelated. If skipped, record why.

- Frontend: `pnpm --dir frontend typecheck`, `pnpm --dir frontend test`, or
  `pnpm --dir frontend build` depending on risk.
- Backend R: targeted `testthat::test_file(...)` first; full
  `testthat::test_dir(...)` for shared contracts.
- Full app: Makefile targets such as `make build`, `make ui-quick-check`, or
  `make monitoreo-qa PULSO=/path/to/project.pulso`.
- UI visual: inspect the rendered app with screenshots or DOM structure when
  the environment permits.
- Data/pipeline: use a small fixture or sample. Do not run heavy production
  data unless the user explicitly asks.
- Loops.so: never part of the default baseline. Use only for Loops-specific
  tasks and document the command, credential source, and network behavior.

## Iteration Contract

Each repair iteration must be small and recorded in this format:

```text
Iteration N
- Failure or bottleneck:
- Focused change:
- Files changed:
- Validation command:
- Result:
- Better/worse/same:
- Next action:
```

One iteration should normally touch one module or one contract boundary. Avoid
combining UI polish, backend data changes, schema changes, and test rewrites in
the same iteration.

## Stopping Rules

Stop the loop when any of these is true:

- the original failure is fixed and the chosen validation passes;
- the remaining failure is unrelated to the locked scope;
- three focused iterations do not improve the result;
- the next reasonable change requires a schema, `.pulso`, architecture, or
  dependency decision;
- validation requires credentials, network access, unavailable fixtures, or a
  user project that has not been provided.

When stopping before success, report the last evidence, the suspected cause,
and the smallest next unblocker.

## Product Guardrails

- Do not modify Electron, React components, Plumber endpoints, R engines,
  `.pulso` schemas, or business logic unless the current task explicitly asks
  for that product repair.
- Future backend repairs should follow the existing error pattern, including
  `tryCatch` and normalized errors through `api/R/errors.R` when applicable.
- Future UI repairs must rebalance the screen after the fix. Do not leave empty
  voids, floating controls, duplicated hierarchy, or collage-like layouts.
- In modules with variable selectors, the repair agent may suggest candidates
  but must not autoselect them or block manual user selection.
- In Monitoreo, preserve the separation between active titular UMP and inspected
  block/manzana. Do not recalculate the base sampling design from Monitoreo.
- Keep changes local-first. Do not add external dependencies or network calls
  as part of a repair unless the task explicitly concerns an existing
  user-triggered integration.

## Evidence To Leave Behind

At the end of a repair, report:

- changed files;
- validation commands run and their results;
- known residual risk;
- whether product behavior, architecture, persistence, or secrets were touched.

For docs-only changes, a lightweight diff/format check is enough unless the doc
links or generated artifacts need deeper verification.
