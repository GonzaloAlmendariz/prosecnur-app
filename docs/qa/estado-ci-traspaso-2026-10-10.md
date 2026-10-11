# Estado del CI en el traspaso del 2026-10-10

Tipo: Nota de traspaso
Estado: Vigente
Fecha: 2026-10-10
Autoridad: Pre-flight local del skill `/publicar` ejecutado el 2026-10-10 sobre el SHA que se sube a `origin/main`, gate por gate según `.github/workflows/quality.yml`; el dueño autorizó subir con los gates rojos documentados aquí para que una sesión en la nube tome el control

## 1. Por qué existe esta nota

`main` local acumuló 2.463 commits desde la última publicación (`728f35137`,
0.8.0, 2026-08-24). El dueño pidió subirlos para que una sesión en la nube
continúe el trabajo. El pre-flight se corrió entero; varios gates salen rojos
por trabajo previo que ninguna sesión había pasado por el CI. Se sube con esos
rojos **documentados**, no ignorados: quien tome el control empieza por aquí.

## 2. Gate por gate (sobre el SHA candidato, en un worktree limpio)

| Job | Gate | Resultado | Causa / qué hacer |
|---|---|---|---|
| agentic-os | tests del sincronizador y política | verde | — |
| agentic-os | `--check` y `--audit` de adaptadores | verde | — |
| agentic-os | `check-r-lock` | verde | — |
| agentic-os | `check-docs-governance` | **verde** | reparado en `679160f82` y `26df848b7` (metadatos de 71 docs e índice de ADRs) |
| agentic-os | `release-contract preview` | verde (aviso: 0.8.0 no supera el tag máximo) | — |
| frontend | tests de escritorio | verde | — |
| frontend | contratos de scripts | **rojo: 2** | «vaults-check es silencioso, serializable y bloqueante» y «la convergencia tiene cobertura real»: ambos caen por la deriva de bóvedas (fila siguiente) |
| frontend | `vaults-check --check` | **rojo: 27** | G1 ×3 (índices generados desactualizados: `make vaults-index`), V1 ×1 (nota de bóveda que declara `monitoreo/aulas/avance/estratos`, nodo inexistente), V3 ×21 (nodos del contrato sin nota, casi todos de Cálculo de muestra), V5 ×2 (notas «completa» con sello caducado) |
| frontend | `debt-audit --check` | verde | — |
| frontend | typecheck | verde | — |
| frontend | vitest | **rojo: 1 de 9.973** | `profiles/territorial/estadosAtadosAlMotor.contract.test.ts`: el motor ya publica `en_zona`; quitarlo de `VOCABULARIO_PROPIO` y atarlo al motor |
| frontend | build de producción | verde | — |
| frontend | `pnpm audit` frontend | **rojo: 3 high** | advisories nuevas en dependencias transitivas: `browserslist` ≤ 4.28.6 (×2) y `source-map-js` < 1.2.2; resolver con overrides en `frontend/package.json` o subiendo Vite |
| frontend | `pnpm audit` desktop | **rojo: 6 high** | `fast-uri` (×4), `xmldom`, `extract-zip`; overrides en `desktop/package.json` o subir electron-builder |
| backend-r | suite testthat completa | **rojo: 9 fallos en 5 archivos** (local, worktree limpio en `ee1aa8400`, `load_all` sin instalar; 14 saltados por fixtures locales o Quarto) | `test-aulas-libro-riesgo.R:49,53` (fechas de la hoja: `codigos_pendientes` 1 ≠ `agendadas` 0, `vencidas` 2 ≠ 1; sospecha de fixture con fecha a mano que caducó) · `test-graficador-titulo-grupo-altura.R:76,77` (el aviso de recorte ya no dice «3 linea»/«4 lineas») · `test-graficos-deriva-catalogo-ui.R:66,88` (26 graficadores donde el contrato espera 24; `p_cifra` ofrece `titulo` y nadie lo recibe) · `test-http-contract-monitoreo-aulas-config.R:155,156` (al agendar, `activation_origin` vacío en vez de `adicional_inferido` y sin `activated_at`) · `test-router-monitoreo-emite-lo-que-importa.R:57` (el endpoint no emite `reservas_sin_cadena`, `codigos_sin_plan`, `estados_desconocidos`). Localizar cada uno con `test_file` antes de tocar nada; el veredicto vinculante sigue siendo el del run de Quality |
| ui-contracts | quick-check y visual QA | no ejecutado localmente | lo corre el CI |

Dos rojos que se vieron en el árbol de trabajo y **no** están en el SHA: los
tests `componentesSinMontar` y `cssSinDuenoTests` caían por archivos sin
commitear de la sesión del motor PPT, no por el commit.

## 3. Qué hay que saber para tomar el control

- **Remasterización de la UI** (esta sesión): el censo
  `censo-ui-2026-10-10.md`, el GOAL `goal-modernizacion-ui-2026-10-10.md`,
  el plan `plan-trabajo-remasterizacion-ui-2026-10-10.md`, el maestro
  `remasterizacion-ui-2026-10-10.md`, el censo de animaciones
  `censo-animaciones-2026-10-10.md` (L37) y el censo de acciones de datos de
  Monitoreo `censo-acciones-datos-monitoreo-2026-10-10.md` (L38). La maqueta
  de las 29 páginas vive en `maqueta-remasterizacion-2026-10-10/`: se sirve
  con `node docs/qa/maqueta-remasterizacion-2026-10-10/serve.mjs 8933` (hay
  una entrada en `.claude/launch.json`) y las capturas «después» se regeneran
  con `capturar.mjs` (Playwright desde `frontend/`); las capturas «hoy» van
  versionadas porque son evidencia del censo y exigen warm start de cuatro
  proyectos. Decisiones que esperan al dueño: D1–D13 en el GOAL.
- **Motor PPT y editor de láminas F6** (sesión «Continuación del MotorPPT»):
  encargo y tablero en `encargo-loop-f6-2026-10-10.md`.
- **Primera tarea sugerida para la sesión en la nube**: dejar Quality en
  verde con la tabla de §2 como lista, una causa por iteración, sin relajar
  tests ni políticas (skill `/publicar`, §3).

## 4. Comandos del pre-flight que se usaron

```bash
node --test agentic/tests/*.test.mjs
node agentic/sync-agentic-os.mjs --check --platform=none
node agentic/sync-agentic-os.mjs --audit --platform=none
node scripts/check-r-lock.mjs
node scripts/check-docs-governance.mjs
node scripts/release-contract.mjs preview
pnpm -C desktop test
node --test $(ls scripts/tests/*.test.mjs | grep -vE 'check-r-lock|ui-quick-check-|visual-qa-readiness')
node scripts/vaults-check.mjs --check
node scripts/debt-audit.mjs --check
pnpm -C frontend exec tsc --noEmit --pretty false
pnpm -C frontend test
pnpm -C frontend exec vite build --outDir "$TMPDIR/prosecnur-vite-build" --emptyOutDir
pnpm -C frontend audit --audit-level=high
pnpm -C desktop audit --audit-level=high
Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_dir("api/tests/testthat", reporter = "summary")'
```
