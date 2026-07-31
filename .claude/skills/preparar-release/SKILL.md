---
name: preparar-release
description: Prepara un corte de Prosecnur con identidad alineada, notas completas y gates locales equivalentes a los canales internal-preview y stable. Usar al pedir un release, un corte o un instalable para entregar.
---

# Preparar release

La fuente editable de versión es `api/DESCRIPTION`. El contrato
`scripts/release-contract.mjs` exige que coincida con cuatro espejos:
`desktop/package.json`, la primera entrada de
`frontend/src/features/home/releaseNotes.ts`, `docs/versiones-app.md` y
`.github/RELEASE_NOTES.md`.

El siguiente candidato estable recomendado por el ADR 0048 es `4.0.0`, porque
debe superar el máximo histórico `v3.4.2`. Confírmalo contra el historial real;
no hagas el bump por inferencia ni para “probar” el workflow.

## 1. Precondiciones

- Lee `docs/adrs/0048-identidad-version-y-canales-distribucion.md`,
  `.github/workflows/release.yml` y `.github/workflows/quality.yml`.
- Exige working tree limpio y una unidad cerrada. Conserva cambios ajenos y no
  incorpores artefactos de QA o build.
- Congela versión objetivo, rango de commits, plataformas y canal. Tag, push,
  ejecución remota y publicación requieren autoridad explícita; sólo el lead
  controla esos efectos externos.

## 2. Identidad y notas

1. Ejecuta `node scripts/release-contract.mjs preview`.
2. Actualiza las cinco superficies en una sola iteración.
3. Usa `/notas-parche` para mapear commits y sincronizar las tres superficies
   de notas.
4. Ejecuta `node scripts/release-contract.mjs prepare`. Debe probar que las
   cinco versiones coinciden, el candidato supera todos los tags SemVer y su
   tag objetivo todavía está libre.

`preview` es sólo lectura: permite advertir deuda histórica. `prepare` es el
gate local estricto. `stable --tag vX.Y.Z` es el gate del tag existente: exige
identidad exacta, monotonicidad y que el tag apunte a `HEAD`.

## 3. Gate local

Ejecuta lo que declaran los workflows vigentes, no una lista recordada. El
mínimo de gobierno y release es:

```bash
node --test agentic/tests/*.test.mjs
node agentic/sync-agentic-os.mjs --check --platform=none
node agentic/sync-agentic-os.mjs --audit --platform=none
node scripts/check-docs-governance.mjs
node --test scripts/tests/release-contract.test.mjs
pnpm -C desktop test
pnpm -C frontend exec tsc --noEmit --pretty false
pnpm -C frontend test
pnpm -C frontend exec vite build --outDir /tmp/prosecnur-vite-build --emptyOutDir
Rscript -e "pkgload::load_all('api', quiet=TRUE); testthat::test_dir('api/tests/testthat', reporter='summary')"
```

Completa los audits de dependencias que figuren en `quality.yml`. Un endpoint
de advisories inaccesible no convierte un candidato estable en verde: se
registra como gate no ejecutado y detiene el corte. Si hubo UI, añade el gate
visual proporcional con proyecto de referencia.

## 4. Canales

### `internal-preview`

- Se inicia únicamente mediante `workflow_dispatch`.
- Corre contrato `preview`, Quality y ambos builds bloqueantes.
- Conserva instalables internos; elimina metadata y payloads del updater.
- Nunca crea ni modifica GitHub Releases y no recibe `contents: write`.

### `stable`

- Se inicia únicamente por push de un tag `vX.Y.Z`.
- Corre `stable --tag`, Quality y ambos builds sin tolerancias.
- Exige Authenticode en Windows, Developer ID en macOS, integridad de
  instaladores/ZIP y payloads completos del updater.
- Publica sólo después de todos los gates; un archivo, firma, plataforma o
  manifest ausente detiene el release.

El canal estable está bloqueado mientras packaging no produzca y valide todo
ese contrato. No rebajes el gate ni describas la firma como opcional.

## 5. Entrega

Prepara el commit `release: prepara corte X.Y.Z` sólo con identidad, notas y
ajustes deliberados del corte. No crees tag, no hagas push y no publiques sin
la autorización correspondiente. Cierra con SHA candidato, cinco versiones,
resultado de `prepare`, checks ejecutados y bloqueos pendientes de firma o
distribución.
