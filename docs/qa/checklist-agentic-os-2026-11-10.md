# Checklist: puesta al día del agentic OS (2026-11-10)

Tipo: Checklist de pedido
Estado: En curso
Fecha: 2026-11-10
Autoridad: pedido del dueño del 2026-11-10 y relevamiento de solo lectura del mismo día (historial git, sesiones y memorias)

Pedido del dueño: revisar el diagnóstico del agentic OS, proponer mejoras de claridad y de calidad, y revisar a fondo el trabajo del repo (estilo, errores más comunes, correcciones más recurrentes, como la redacción) para llevar el agentic OS a su mejor versión.

## Ítems

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| C1 | `CLAUDE.md` sin datos que caducan: versión, rango de ADRs y conteos de skills y agentes se derivan, no se copian | `CLAUDE.md` | ☑ Hecho. Pendiente: la comprobación automática en `--audit` que impida que vuelvan |
| C2 | Adelgazar `CLAUDE.md`: las trampas de QA visual pasan a `/ver-ui` | `CLAUDE.md`, `.claude/skills/ver-ui/SKILL.md` (sección 7) | ☑ Trampas movidas y gates acortados. El archivo no adelgazó: pasó de 28,3 a unos 30 KB porque ganó Redacción y Errores que más se repiten |
| C3 | Una sola fuente para la regla de orquestación | `.claude/skills/orquestar-trabajo/`; punteros en `CLAUDE.md` y `AGENTS.md` | ☑ Hecho en `CLAUDE.md`, `AGENTS.md` y el skill. ☐ Falta revisar `scope-lock` y `docs/agentic-os.md`, que aún repiten los límites |
| C4 | `AGENTS.md` al día: sin Loops.so ni regla de orquestación duplicada | `AGENTS.md` | ☑ Hecho |
| C5 | Índice de memoria: una entrada por línea con gancho completo y bajo el límite de carga; fusionar duplicados y archivar estado cerrado | `~/.claude/projects/…/memory/` (fuera del repo) | ☐ Bloqueado: requiere confirmación del dueño por lista. Propuesta lista: 92 a archivar, 77 a fusionar en 38 grupos, 46 a revisar |
| C6 | Retirar del global los skills `prosecnur-*` y los skills y agentes `agentic-core-*` | `~/.claude/skills`, `~/.claude/agents` (fuera del repo) | ☐ Bloqueado: borrado, decide el dueño |
| Q1 | Contrato de orquestación con disparador estrecho (dos writers) | `.claude/skills/orquestar-trabajo/`, `CLAUDE.md` | ☑ Disparador reescrito. ☐ Sin comprobación automática |
| Q2 | Precargar skills de dominio en los agentes con `skills:` | `.claude/agents/{backend-r,frontend-react,especialista-entregables,especialista-integraciones,revisor-metodologico}.md` | ☑ Hecho; el sincronizador lo tolera. ☐ Sin verificar en una sesión nueva que el agente arranca con el skill cargado |
| Q3 | Medir el gate por veredictos del `verificador` | medición sobre transcripciones | ☑ Medición parcial (ver abajo). ☑ Vocabulario del veredicto fijado en `verificador.md` para poder contarlo |
| Q4 | Gate 2 (árbol con una sola unidad de trabajo) con más fuerza que un aviso a 1.500 líneas | hook `Stop` en `.claude/settings.json` | ☐ Sin tocar: el visto bueno del 2026-11-10 cubrió las guardas de git, R y adaptadores, no este aviso |
| Q5 | Bloquear por hook la edición manual de `.codex/` y `.agents/` | `agentic/hooks/guardas.mjs`, `.claude/settings.json` | ☑ Hecho y probado en vivo |
| Q6 | Conteo de uso de skills y agentes dentro de la auditoría mensual, con worktrees | `agentic/`, `.claude/skills/auditoria-deuda/` | ☐ |
| R1 | Revisión del historial git | informe de investigación | ☑ |
| R2 | Revisión de las sesiones | informe de investigación | ☑ |
| R3 | Revisión del corpus de memorias | informe de investigación | ☑ |
| R4a | Redacción: regla ampliada (nombrar, tipografía, textos para terceros, explicar en el chat) y comprobación mecánica | `CLAUDE.md`, `scripts/revisar-redaccion.mjs`, `scripts/tests/revisarRedaccion.test.mjs`, agentes que escriben texto | ☑ Hecho, test 7 de 7 |
| R4b | Errores que más se repiten, como reglas con su mecanismo | `CLAUDE.md` | ☑ Hecho |
| R4c | Render real obligatorio en entregables, con receta y páginas vistas | `.claude/agents/especialista-entregables.md`, `.claude/skills/entregables-oficina/SKILL.md`, `verificador.md` | ☑ Hecho |
| R4d | Aspecto: no entregar el mínimo literal, mirar la captura, lista de textos nuevos en la salida | `.claude/agents/frontend-react.md` | ☑ Hecho |
| R4e | Backend: cruzar por identificador, no tragar en silencio, una cifra una función | `.claude/agents/backend-r.md`, `revisor-metodologico.md`, `autor-regresiones.md` | ☑ Hecho |
| R4f | Hooks contra `git add -A`, `git commit -a` y `git stash` sin ruta en árbol compartido; guarda de `R CMD INSTALL`; confirmación antes de escribir en un Sheets del equipo | `agentic/hooks/guardas.mjs`, `.claude/settings.json`, `agentic/tests/guardas-hooks.test.mjs` | ☑ Hecho con visto bueno del dueño. Git: bloquea, salvo en un worktree propio. R: bloquea solo si hay otra instalación o un lock; no pide permiso en cada instalación, que sigue siendo decisión pendiente (R4i). Sheets: pide confirmación. Límites conocidos, sin cubrir: `bash -c` y `eval` con el comando entre comillas, `xargs git add`, agregar directorios enteros por nombre, `install.packages` o `devtools::install` desde Rscript, y escribir en `.codex/` por redirección de shell |
| R4g | Contratos automáticos que faltan: casillas que deben ser Switch (70 `type="checkbox"`), franja lateral de acento (139 coincidencias), punto medio en los features sin guard y en cadenas de `api/R`, listas productor y consumidor de Gráficos | tests nuevos en `frontend/src` y `api/tests/testthat`, con ratchet | ☐ Es trabajo de producto: rama Construir, con `verificador` |
| R4h | Gobierno de docs en rojo: `check-docs-governance.mjs` da 369 errores en 75 archivos y corre en `quality.yml` | `docs/adrs/README.md`, `docs/qa/*.md` | ☐ Hallazgo nuevo, sin tocar |
| R4i | Contradicciones entre memorias que piden decisión del dueño | memoria | ☐ Bloqueado: cuatro preguntas (ver abajo) |

## Lo que se sabe (no reinvestigar)

Medido el 2026-11-10.

- Versión real 0.9.6 (`api/DESCRIPTION`). `docs/adrs/` tiene 142 archivos.
- `sync-agentic-os.mjs --check` y `--audit` pasan tras los cambios; `node --test agentic/tests/*.test.mjs` da 60 de 60.
- Historial: 10.502 commits; desde agosto hay más fix que feat cada mes. Monitoreo concentra el 35 % de los fix. Causas en una muestra de 247 fix: layout y CSS 20 %, lógica de motor 17 %, redacción 15 %, entregables 14 % (la única que crece), cifra con base equivocada 11 %.
- Las reglas que frenaron su error (NAMESPACE, navegación, `any`) tienen un contrato barato que corre en cada cierre. Las que no lo frenaron (layout, redacción, entregables) dependen de mirar el resultado.
- Sesiones: 6.548 mensajes del dueño en 258 sesiones; cerca de uno de cada cinco corrige algo. Lo más repetido: no se entiende la explicación (61 sesiones), cliché y jerga (55), "puede verse mucho mejor" (51), "sigue roto" tras darlo por hecho (51), cifra o base discutida (48).
- El punto medio como separador era la queja tipográfica más repetida (18 sesiones) y no figuraba en ninguna regla del repo; `CLAUDE.md` estaba escrito con comillas angulares, contra la regla global.
- `verificador`: de 337 llamadas se pudo leer el veredicto en 52 (unas 8 rechazadas, 24 aprobadas con pendientes). Hay corridas de 44 a 64 minutos.
- Memoria: 474 archivos; `MEMORY.md` carga unas 166 de 327 líneas (corte cerca de 25 KB) y deja fuera casi todo lo escrito desde mediados de octubre.
- Decisiones pendientes del dueño por memorias que se contradicen: reinstalar el paquete R sin preguntar o con visto bueno cada vez; cuándo se pregunta y cuándo no; cuándo sí va una frase de ayuda en la UI; letras de significancia en el mazo de CCSS.
- No verificado: que `skills:` en el frontmatter precargue el skill en la versión instalada de Claude Code; en Codex no surte efecto y por eso cada agente lo dice también en su cuerpo.
