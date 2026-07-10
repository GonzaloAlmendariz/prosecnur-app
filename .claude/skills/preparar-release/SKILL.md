---
name: preparar-release
description: Prepara un corte de release de Prosecnur - working tree limpio, quality gate completo, bump de versión en api/DESCRIPTION (fuente única), tag v* y notas de release desde los commits. Usar cuando el usuario diga "prepara el corte", "release", "saca la versión X" o "empaqueta para entregar".
---

# Preparar release

Formaliza los commits `release: prepara corte X.Y.Z` que hoy se hacen a mano. La fuente única de versión es `api/DESCRIPTION`; el pipeline `release.yml` se dispara con tags `v*` y reusa `quality.yml` como gate.

## Flujo

1. **Tree limpio primero**: si hay trabajo sin commitear, corre `/cerrar-trabajo` antes. Un release nunca empaqueta un working tree sucio ni artefactos generados (gate 4: no versionar PNG/XLSX/HTML de QA — los "cortes" históricos arrastraron cientos).
2. **Quality gate local completo** (lo mismo que CI, antes de crear el tag):
   - `pnpm --dir frontend typecheck` y `pnpm --dir frontend test`
   - `pnpm --dir frontend build` (build de producción real, no `build:fast`)
   - Suite R completa: `Rscript -e 'pkgload::load_all("api"); testthat::test_dir("api/tests/testthat")'`
   - Si hubo cambios de UI desde el último release: `make ui-quick-check`.
   Cualquier fallo detiene el release; reporta el output literal.
3. **Bump de versión**: actualiza `Version:` en `api/DESCRIPTION` (fuente única; verifica si hay otros lugares que la espejen, ej. package.json del frontend/desktop, y mantenlos coherentes). Registra el corte en `docs/versiones-app.md` si existe la sección.
4. **Notas de release**: delega la redacción al skill `notas-parche` — produce las notas de GitHub Y actualiza las dos superficies de la app (RELEASE_NOTES in-app y `docs/versiones-app.md`), saldando de paso cualquier versión anterior sin mapear. Las tres superficies se actualizan en el MISMO corte, nunca después.
5. **Commit + tag**: `release: prepara corte X.Y.Z` con el bump y las notas; luego `git tag vX.Y.Z`. **Pregunta antes de hacer push del tag** — el push dispara el build de Windows/macOS y publica el GitHub Release. Orden óptimo: push a main PRIMERO, espera el Quality verde, y recién entonces push del tag — el precheck del Release detecta el Quality verde del mismo SHA y omite el gate (~20 min menos). El push y el monitoreo se hacen con el skill `/publicar`.
6. **Post-release**: recuerda los pendientes conocidos de distribución (macOS sin code-signing es best-effort; validar `/tablero` y chunks pesados de plotly en el Electron empaquetado).
