# ADR 0048: Identidad de versión y canales de distribución

Estado: Aceptado

Implementacion: En curso

Fecha: 2026-07-30

Fecha de decision: 2026-07-30

Reemplaza: —

Extiende: —

## Contexto

La versión de Prosecnur se consume en cinco superficies locales: la fuente
canónica `api/DESCRIPTION`, `desktop/package.json`, la primera entrada de
Novedades dentro de la app, `docs/versiones-app.md` y las notas para GitHub
Release. Dentro del documento de versiones, la última fila del historial y la
sección `Version actual` forman una sola superficie y deben coincidir. Antes de
esta decisión no había un gate único que comparara las cinco.

Esa falta de contrato dejó dos derivas observables. La aplicación declara
`0.5.19`, mientras las notas de GitHub todavía declaran `0.5.16`. Además, el
historial de tags no es monótono: el máximo SemVer publicado es `v3.4.2`, aunque
después se usó la serie `0.4.x`/`0.5.x`. Un updater que compara SemVer no puede
tratar una versión menor como sucesora de `3.4.2`.

El workflow de release también mezclaba dos propósitos. Una ejecución manual
podía terminar creando o actualizando una GitHub Release, conservaba permisos
de escritura globales, toleraba un fallo de macOS y admitía assets ausentes.
Eso impedía usar el mismo workflow para probar instaladores internos sin abrir
por accidente un canal público.

## Decision

`api/DESCRIPTION` es la única fuente editable de la versión de producto. Las
otras cuatro superficies locales son espejos obligatorios:

1. `desktop/package.json`;
2. la primera entrada de
   `frontend/src/features/home/releaseNotes.ts`;
3. `docs/versiones-app.md`, con su fila histórica y su sección
   `Version actual` internamente coherentes;
4. el encabezado de `.github/RELEASE_NOTES.md`.

El tag estable `vX.Y.Z` es la identidad de distribución y debe coincidir con
esas cinco superficies. Los modos `prepare` y `stable` fallan si alguna
diverge. `stable` acepta solamente tags exactos `vMAJOR.MINOR.PATCH`, exige que
el tag apunte al commit construido y que su versión supere todos los demás tags
SemVer válidos.

El próximo candidato estable recomendado es `4.0.0`: el máximo histórico es
`3.4.2` y saltar al siguiente major restablece una secuencia inequívoca. Esta
decisión no cambia ninguna versión ni crea el tag; el corte debe hacerse con el
flujo de preparación de release y sus notas completas.

Se establecen dos canales mutuamente excluyentes:

### `internal-preview`

- Sólo se inicia con `workflow_dispatch`, sin inputs de versión.
- Ejecuta `node scripts/release-contract.mjs preview` y el Quality gate.
- Windows y macOS son builds bloqueantes.
- Conserva en GitHub Actions únicamente el instalador `.exe`, el ZIP portable
  de Windows y los `.dmg`.
- No transporta `latest*.yml`, ZIP macOS ni `*.blockmap`, no ejecuta la acción
  de GitHub Release y no recibe `contents: write`.

### `stable`

- Sólo se inicia por el push de un tag `v*`; el contrato ejecuta
  `node scripts/release-contract.mjs stable --tag "$GITHUB_REF_NAME"` antes de
  construir.
- Quality, Windows y macOS son bloqueantes y no usan tolerancias
  `continue-on-error`.
- El instalador Windows debe tener una firma Authenticode válida y su ZIP
  portable debe ser íntegro y contener el payload mínimo esperado.
- macOS debe entregar dos DMG íntegros y dos ZIP de updater, uno por
  arquitectura. Cada ZIP debe estar referenciado por `latest-mac.yml`, tener
  blockmap y contener una única `.app` con firma Developer ID válida.
- Sólo después de esos gates se descargan los assets y se publica. Los globs
  incompletos fallan con `fail_on_unmatched_files: true`.

El workflow concede globalmente sólo `actions: read` y `contents: read`.
`contents: write` existe únicamente en el job `publish`, condicionado al canal
stable y a los dos builds exitosos. El workflow verifica firmas pero no define,
inventa ni documenta valores de secretos.

## Consecuencias

Una ejecución manual queda disponible para QA interno sin poder alterar GitHub
Releases ni alimentar el auto-updater. A cambio, siempre paga el Quality gate y
ambos builds; ese costo preserva la equivalencia técnica con el corte estable.

Un tag desalineado, no monótono, ubicado en otro commit, con notas incompletas,
con una plataforma fallida o con payloads sin firma no alcanza el job de
publicación. No existe ya un release público parcial sólo para Windows.

El canal stable queda deliberadamente bloqueado con el packaging actual:
todavía no se producen los ZIP macOS requeridos por el updater ni existen las
firmas de distribución. La fase de seguridad deberá incorporar esas
capacidades fuera de este ADR; no se debilitarán los gates para publicar
artefactos provisionales.

Los artefactos de preview no sirven como fuente del updater. Si se decide
promover una preview, se debe preparar un nuevo corte estable desde una
identidad alineada y volver a construirlo bajo los gates de firma.

## Cumplimiento

Las siguientes invariantes son verificables:

- `node --test scripts/tests/release-contract.test.mjs` cubre comparación
  SemVer, alineación de las cinco superficies, tag en `HEAD` y fallo por
  regresión respecto del máximo histórico.
- `node scripts/release-contract.mjs preview` audita el estado sin escribir;
  `stable --tag` es el preflight obligatorio de tags.
- `.github/workflows/release.yml` no declara inputs bajo `workflow_dispatch`,
  no contiene `continue-on-error` y sólo concede `contents: write` dentro de
  `publish`.
- Los steps de preview enumeran exclusivamente `.exe`, el ZIP portable de
  Windows y `.dmg`; los manifests, ZIP macOS y blockmaps aparecen sólo en el
  payload stable.
- `publish` depende de ambos builds y usa
  `fail_on_unmatched_files: true`; una firma o un payload requerido ausente
  produce un exit code distinto de cero antes de subir assets.
- `node scripts/check-docs-governance.mjs` verifica que este ADR esté indexado
  y sea alcanzable desde la portada documental.

## Notas

- [Versiones de la aplicación](../versiones-app.md) conserva el historial
  humano de cortes; no reemplaza la fuente canónica.
- El workflow ejecutable vive en
  [`.github/workflows/release.yml`](../../.github/workflows/release.yml).
- El contrato de identidad vive en
  [`scripts/release-contract.mjs`](../../scripts/release-contract.mjs).
- La implementación permanece `En curso` hasta que la fase de firma produzca
  y valide todos los payloads stable en ambas plataformas.
