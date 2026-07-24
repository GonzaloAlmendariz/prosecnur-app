---
name: publicar
description: Publica cambios de Prosecnur sin sorpresas - pre-flight local idéntico al CI, push, monitoreo del run con gh y auto-diagnóstico si falla. Usar cuando el usuario diga "publica", "haz push", "sube los cambios", "saca el release" o cuando llegue un correo de "all jobs have failed" que haya que diagnosticar.
---

# Publicar

El historial de este repo: 11 de 12 fallos de CI fueron tests que nadie corrió localmente antes del push — main estuvo rojo 36 horas seguidas heredando el mismo test roto, y cada Release pagaba el gate de ~20 min para morir en lo mismo. Este skill hace el publish predecible: **lo que va a correr el CI se corre primero acá**.

## Fase 1 — Pre-flight local (obligatorio, espejo del CI)

Corre exactamente lo que corre `quality.yml`, en este orden (lo barato primero):

1. `pnpm --dir frontend typecheck` (~1 min — detecta la clase TS2307 que mató 2 releases)
2. `pnpm --dir frontend test`
3. `pnpm --dir frontend exec vite build --outDir /tmp/prosecnur-vite-build --emptyOutDir`
4. Suite R **completa** (la parcial no sirve para publicar; es el 78% del CI y donde vive el 90% de los fallos históricos):
   `LC_ALL=en_US.UTF-8 Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_dir("api/tests/testthat", reporter="summary")'`
   (~10-15 min local; lánzala en background y sigue con otras verificaciones mientras corre)
5. Auditorías de dependencias (baratas, ~10 s c/u; córrelas mientras la suite R está en background):
   `pnpm -C frontend audit --audit-level=high` y `pnpm -C desktop audit --audit-level=high`.
   El job Frontend del CI corre AMBAS y falla el gate ante cualquier HIGH. Es **advisory drift**: un advisory nuevo publicado entre cortes enrojece `main` sin que cambies una línea (el corte 0.5.19 rebotó 3 veces por esto: postcss `<8.5.12` vía vite, y `app-builder-lib`/`builder-util-runtime` vía electron-builder). Fix: override de la versión parcheada en el `package.json` correspondiente (`pnpm.overrides`) + `pnpm install --no-frozen-lockfile` para actualizar el lock, y verifica que `--frozen-lockfile` quede consistente (lo que usa el CI). Reglas de la casa del desktop audit: `docs/qa/deuda-baseline.md` y la memoria del advisory drift.
6. Node del CI: el runner usa Node 24, que **escala a fatal** warnings que tu Node local puede tragar (ej. un comentario CSS con `*/` prematuro rompió el `esbuild css minify` solo en CI). Si el `vite build` local pasa pero dudas, revisa que no haya warnings de `css-syntax-error`/`Unexpected` en su salida.

Cualquier fallo → se arregla ANTES de pushear. Sin excepciones: un push con la suite roja le cuesta 20 min a cada push posterior hasta que alguien lo arregle.

## Fase 2 — Push y monitoreo

1. `git push` (o el tag si vino de `/preparar-release` — pregunta antes de pushear tags: disparan builds y release público).
2. Monitorea el run SIN quedarte ciego: obtén el run con `gh run list --branch main --limit 1 --json databaseId,status` y usa el tool Monitor con un poll de ~60-90 s sobre `gh run view <id> --json status,conclusion` que emita línea al llegar a `completed` (cubriendo success Y failure).
3. Tiempos esperados post-optimización: Quality ~15-17 min (frontend y R en paralelo; typecheck roto avisa en ~4 min), Release con gate omitido por precheck ~10 min de builds.

## Fase 3 — Auto-diagnóstico si falla

1. `gh run view <id> --log-failed` y localiza el error real (busca `Error:`, `Failure (`, `! Test failures`, `TS[0-9]+:`).
2. Clasifica contra las clases conocidas del repo:
   - **Test R roto** → correr ese `test_file` local, arreglar código o test, repetir fase 1 focalizada + push.
   - **TS2307 import muerto** → típico tras borrar páginas; buscar imports huérfanos en `App.tsx`/`warmupRegistry.ts`.
   - **Golden no portable** (calc-muestra-aulas RDS macOS≠Linux) → regenerar el golden en el runner (patrón del workflow "TMP Gen Golden Aulas"), no ajustar el test a ciegas.
   - **Contrato QA de monitoreo** → pestañas/vistas nuevas sin registrar en el QA contract del cliente.
   - **Advisory drift** (`X vulnerabilities found` con un HIGH en el paso de audit) → override de la versión parcheada en `pnpm.overrides` del `package.json` (frontend o desktop) + actualizar el lock; NO tocar código de producto. Si el paso 5 del pre-flight se hubiera corrido, no llega acá.
3. Aplica el fix, repite pre-flight focalizado en lo tocado, push, y vuelve a monitorear. Máximo contexto en cada iteración: el correo "all jobs have failed" casi siempre es UNA causa raíz repetida.

## Fase 4 — Si fue un tag (release público): verifica el release, no solo el run

El workflow Release sube los instaladores con `softprops/action-gh-release`. Su paso final de *policy* (immutable releases) puede tirar `Error creating policy` y/o GitHub puede devolver 504 en la publicación — dejando el release como **draft** o con **assets faltantes** aunque los builds hayan pasado. Verifica el resultado REAL, no el color del job:

1. `gh api repos/<owner>/<repo>/releases/tags/<tag> --jq '"draft=\(.draft) assets=\([.assets[].name]|join(","))"'` (más liviano que `gh release view`, que 504ea con assets grandes).
2. Deben estar **AMBOS** manifiestos de auto-update: `latest.yml` (Windows) y `latest-mac.yml` (macOS). Si falta uno, el auto-update de esa plataforma no ve la versión. Recupéralo re-ejecutando el job de publicación (`gh run rerun <run> --failed`): re-descarga los artefactos y re-sube lo que falte; la infra suele recuperarse del 504/policy en el reintento.
3. Si quedó draft: `gh release edit <tag> --draft=false --latest` (reintenta ante 504). Las notas del Release salen de `/notas-parche`, no del `generate_release_notes` genérico ni del `.github/RELEASE_NOTES.md` (que puede estar congelado en una versión vieja).

## Reglas

- Nunca pushear con el pre-flight en rojo ni "para ver si en CI pasa".
- Nunca pushear un tag sin que el push a main del MISMO SHA esté en verde (el precheck del Release omite el gate solo si Quality ya pasó — verde previo = release ~20 min más rápido).
- Si main ya está rojo por un push anterior, arreglar main PRIMERO (el rojo se hereda).
- Reportar al final: SHA publicado, duración del run, link al run/release.
