# GOAL — Fase 0: Quality vuelve a verde y se queda en verde

Tipo: GOAL
Estado: En curso
Fecha: 2026-10-10
Autoridad: pedido de Gonzalo, «primero arreglar el CI y la calidad», en [plan-traspaso-tres-sesiones-2026-10-10.md](plan-traspaso-tres-sesiones-2026-10-10.md).

## Vara

Un run de `Quality` (`.github/workflows/quality.yml`) en verde sobre un SHA de `main`, con sus cuatro jobs (agentic-os,
frontend, backend-r, ui-contracts) y **sin relajar** ningún test, política, lista de excepciones ni nivel de auditoría.
Cerrado eso, se abren las metas A y B.

## Punto de partida

Último Quality verde en `origin/main`: 2026-08-24 (0.8.0). El 2026-10-10 se subieron unos 2 460 commits con los rojos
documentados gate por gate en [estado-ci-traspaso-2026-10-10.md](estado-ci-traspaso-2026-10-10.md). El veredicto que manda
es el del run de Quality del SHA subido (`e3f6be469`, run 38085932506): léelo primero con `gh run view <id> --log-failed`.

## Tablero (dibújalo entero cada vez)

| # | Gate | Estado | Causa conocida y cierre |
|---|---|---|---|
| Q1 | `check-docs-governance` | ☑ | Reparado en `679160f82` y `26df848b7` |
| Q2 | `vaults-check --check` (27) | ☐ | G1 ×3 índices desactualizados (`make vaults-index`); V1 ×1 nota que declara el nodo inexistente `monitoreo/aulas/avance/estratos`; V3 ×21 nodos del contrato sin nota (casi todos de Cálculo de muestra); V5 ×2 notas «completa» con sello caducado |
| Q3 | Contratos de scripts (2) | ☐ | Caen por Q2 («vaults-check es silencioso, serializable y bloqueante», «la convergencia tiene cobertura real»); se reverifican al cerrar Q2 |
| Q4 | vitest (1 de 9 973) | ☐ | `profiles/territorial/estadosAtadosAlMotor.contract.test.ts`: el motor ya publica `en_zona`; quitarlo de `VOCABULARIO_PROPIO` y atarlo al motor |
| Q5 | `pnpm audit` frontend (3 high) | ☐ | `browserslist` ≤ 4.28.6 (×2) y `source-map-js` < 1.2.2: overrides en `frontend/package.json` o subir Vite; re-correr build y vitest |
| Q6 | `pnpm audit` desktop (6 high) | ☐ | `fast-uri` (×4), `xmldom`, `extract-zip`: overrides en `desktop/package.json` o subir electron-builder; re-correr `pnpm -C desktop test` |
| Q7 | Suite testthat completa | ☐ | Local (worktree limpio, `load_all`): 9 fallos en 5 archivos, detallados en la fila backend-r de [estado-ci-traspaso-2026-10-10.md](estado-ci-traspaso-2026-10-10.md): `test-aulas-libro-riesgo.R` (fechas, probable fixture caducado), `test-graficador-titulo-grupo-altura.R` (texto del aviso de recorte), `test-graficos-deriva-catalogo-ui.R` (26 graficadores vs 24; `p_cifra.titulo` sin receptor; zona de la Meta A), `test-http-contract-monitoreo-aulas-config.R` (`activation_origin`/`activated_at` al agendar), `test-router-monitoreo-emite-lo-que-importa.R` (tres campos del importador que el endpoint no emite). Confirmar contra el run; localizar con `test_file` uno por uno |
| Q8 | ui-contracts | ? | Solo corre en CI; leer su log |
| Q9 | Run de Quality verde en `main` | ☐ | La vara |

## Reglas

- Una causa por iteración: diagnosticar, arreglar, re-correr el gate local afectado, commitear por nombre y pushear. Luego
  seguir el run hasta su estado terminal (skill `/publicar` §3).
- Un audit que no puede consultar su servicio queda «no ejecutado», nunca verde.
- Si un rojo nace de trabajo de A o de B, se arregla igual aquí y se avisa en el documento rector de esa meta.
- Al cerrar Q9 se marca este GOAL como hecho y se avisa a las sesiones A y B que pueden empezar.
