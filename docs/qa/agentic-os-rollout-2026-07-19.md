# Auditoría y rollout de Agentic OS — 2026-07-19

Estado: núcleo global instalado y verificado; pilotos read-only completados.
Adopción project-local permanece opt-in.

Decisión aplicable: [ADR 0039](../adrs/0039-agentic-os-multirepo-provider-neutral.md).

## Resumen ejecutivo

El censo cubrió 28 repositorios y no modificó ninguno. La distribución agentic
observada fue:

| Estado | Repositorios | Lectura |
|---|---:|---|
| Agentic OS sustantivo | 3 | Prosecnur, Art_app y FlowTracker |
| Sólo configuración | 4 | Settings o launch config sin catálogo reproducible |
| Sin Agentic OS | 21 | Sin piezas agentic sustantivas |

La distribución por tipo fue 12 apps/packages, 13 repositorios de datos o
documentación, uno mixto y dos no clasificados sin leer producto. Estas cifras
describen el censo; no autorizan instalación automática.

## Inventario auditado

| Repositorio relativo al workspace | Tipo | Estado agentic | Política inicial |
|---|---|---|---|
| `Art_app` | App/package | Sustantivo | Piloto sin cambios |
| `Codex/2026-07-13/sites-plugin-sites-openai-bundled-create-2` | App/package | Ninguno | Excluir: temporal |
| `FlowTracker` | App/package | Sustantivo local | Sólo dry-run/fixture mientras esté dirty |
| `GitHub/TESIS_MD_VF` | Datos/docs | Ninguno | Excluir: tesis |
| `Guia_Prosecnur` | Datos/docs | Ninguno | Opt-in explícito |
| `HOSTIGAMIENTO` | Datos/docs | Ninguno | Excluir por defecto |
| `IcorerRWeb` | App/package | Ninguno | Candidato opt-in |
| `LaDataforaWeb` | App/package | Sólo configuración | Candidato tras auditoría local |
| `Proyectos/CV_Maker` | App/package | Ninguno | Candidato opt-in |
| `Proyectos/Curso Estadística` | Datos/docs | Sólo configuración | Excluir por defecto |
| `Proyectos/D4D` | Mixto | Ninguno | Revisión manual |
| `Proyectos/Diocesis` | Datos/docs | Ninguno | Excluir por defecto |
| `Proyectos/PNUD` | Datos/docs | Ninguno | Excluir por defecto |
| `Proyectos/TESIS_MD_VF` | Datos/docs | Ninguno | Excluir: tesis |
| `Proyectos/rparaelanalisisdedatos` | Datos/docs | Ninguno | Excluir por defecto |
| `Pulso/ACNUR` | Datos/docs | Ninguno | Excluir: estudio de cliente |
| `Pulso/COW PULSO` | No clasificado | Ninguno | Revisión manual |
| `Pulso/GIZ/vendor/prosecnur` | App/package vendorizado | Ninguno | Excluir siempre del rollout |
| `Pulso/GeneradorHojasDeZona` | App/package | Ninguno | Candidato opt-in |
| `Pulso/HST` | Datos/docs | Ninguno | Excluir: estudio de cliente |
| `Pulso/OPS` | Datos/docs | Ninguno | Excluir: estudio de cliente |
| `Pulso/PNUD` | App/package | Sólo configuración | Candidato tras auditoría local |
| `Pulso/Pruebas_Prosecnur` | App/package | Ninguno | Candidato para fixture |
| `Pulso/prosecnur-app` | App/package | Sustantivo v2 | Piloto sin cambios |
| `Taller R` | Datos/docs | Ninguno | Excluir por defecto |
| `Terracota` | No clasificado | Sólo configuración | Revisión manual |
| `Tesis-Valeria` | Datos/docs | Ninguno | Excluir: tesis |
| `incorer` | App/package | Ninguno | Candidato opt-in |

## Colisiones que justifican el namespace

Art_app y Prosecnur tienen nueve skills con los mismos nombres pero contenido y
reglas de producto divergentes:

- `auditoria-deuda`
- `cerrar-trabajo`
- `notas-parche`
- `orquestar-trabajo`
- `preparar-release`
- `publicar`
- `revamp-visual`
- `scope-lock`
- `ver-ui`

Ninguno debe copiarse globalmente. El núcleo compartido usa nombres
`agentic-core-*`; los nueve skills continúan como overlays locales bajo la
autoridad de cada proyecto.

## Pilotos y stopping rules

### Prosecnur

El piloto no debe escribir ni regenerar adaptadores. Debe conservar su Agentic
OS v2 canónico en `.claude/` y sus salidas Codex generadas, y pasar:

```bash
node agentic/sync-agentic-os.mjs --check --platform=none
node --test agentic/tests/*.test.mjs
```

Después se ejecuta la secuencia global `dry-run → init → sync → check → doctor`
del ADR 0039 contra un target explícito. El estado de producto anterior y
posterior debe ser idéntico.

### Art_app

El piloto conserva sus nueve skills locales y no adopta contenido de
Prosecnur. Antes y después del dry-run global debe pasar, sin `--write`:

```bash
node agentic/sync-agentic-os.mjs --check
node --test agentic/tests/*.test.mjs
```

Si el plan global propone reemplazar un skill local o una instrucción del
proyecto, el piloto se detiene.

### FlowTracker

No se autoriza instalación in-place mientras existan cambios en `AGENTS.md`,
`CLAUDE.md` y el skill untracked
`.claude/skills/govern-visual-harmony/`. Sí se permite el dry-run read-only del
núcleo namespaced contra el root real, porque no toca esas superficies:

```bash
node "$AGENTIC_OS_ROOT/bin/agentic-core.mjs" dry-run --scope project --target "$FLOWTRACKER_ROOT" --providers claude,codex
```

El estado dirty se captura aparte con Git; el instalador no lo interpreta ni lo
oculta. Una migración futura de los skills locales sí requiere fixture de ocho
skills de `HEAD` y nueve del overlay dirty.

## Exclusiones por defecto

Quedan fuera del rollout automático:

- vendors, en particular `Pulso/GIZ/vendor/prosecnur`;
- repositorios temporales;
- tesis, cursos, datos y estudios de cliente sin opt-in;
- repositorios dirty;
- targets sin clasificación o con autoridad local ambigua.

Una exclusión sólo se levanta mediante adopción explícita, working tree
controlado, dry-run sin colisiones y checks locales identificados. El rollback
se limita a artefactos administrados por `agentic-core` cuyo hash no haya
cambiado.

## Evidencia ejecutada por el lead

### Núcleo central y rollout global

- Suite central: 29/29 tests PASS, incluidos provenance incompleta,
  capability escalation, upgrade administrado, stale seguro, symlinks, lock y
  rollback.
- Validación de skills: 3/3 PASS con el validador de `skill-creator`.
- Dry-run global: 22 creates namespaced, cero conflictos y cero settings bajo
  ownership.
- `init`: creó sólo `.agentic-core/manifest.json`.
- `sync`: creó 22 artefactos de proveedor y `.agentic-core/state.json`.
- `check`: `clean=true`, cero acciones, 22 unchanged, estado unchanged.
- `doctor`: ambos roots de skills/agentes presentes; Codex disponible; Claude
  no disponible en `PATH`; configuración de ambos detectada y no administrada;
  cuatro perfiles reportados como contractuales.
- Inventario final: 22 artefactos + manifest + state; artefactos/manifest modo
  `0644`, state `0600`; cada salida queda registrada con hashes.

### Pilotos sin mutación

- Prosecnur: dry-run project con 22 creates y cero conflictos; snapshot Git
  anterior/posterior `22eda518e0c7d402732bbab3fbea54771321053ff25c06352e696f24b89f61b0`;
  sync local PASS y 40/40 tests PASS.
- Art_app: dry-run project con 22 creates y cero conflictos; snapshot Git
  de la fase piloto anterior/posterior
  `ddf13a64113cd8a91623561d048fd04f4a5e2ac5d5acd2844586972aedef10bf`;
  el gate final, tras cambios de producto ajenos concurrentes, conservó su
  nuevo snapshot
  `5455d0f0538e63d50e9de545d0af2898fa5435221ce2c64cf11cb9d77e1b5a02`;
  sync local PASS y 4/4 tests PASS.
- FlowTracker: dry-run project con 22 creates y cero conflictos; snapshot Git
  anterior/posterior `12b2e1508f4699863fbec74f6eb8a67b03f0f28a8e200e23ba1fcfb6924eacc7`;
  ninguna escritura in-place.

### Forward-test y limitaciones

Tres procesos Codex frescos, efímeros y read-only seleccionaron y leyeron desde
la instalación global los skills `agentic-core-scope-lock`,
`agentic-core-orchestrate` y `agentic-core-close-work`. Los tres respetaron
scope, ownership, gate final y autorización VCS.

El smoke vivo de Claude queda no ejecutado porque el binario `claude` no está
disponible en `PATH`; sus artefactos, descubrimiento y estructura sí pasaron el
renderer compartido y los tests offline. FlowTracker continúa excluido de una
instalación project-local hasta resolver su working tree. Los demás
repositorios conservan las políticas opt-in y exclusiones de la matriz.
