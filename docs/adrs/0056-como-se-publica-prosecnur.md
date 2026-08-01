# ADR 0056: Como se publica Prosecnur

Estado: Aceptado

Implementacion: Completa

Fecha: 2026-08-01

Fecha de decision: 2026-08-01

Reemplaza: [0048](0048-identidad-version-y-canales-distribucion.md),
[0053](0053-serie-3x-como-deuda-historica-de-versionado.md),
[0054](0054-publicacion-manual-sin-firma-0-6-0.md),
[0055](0055-retiro-de-la-firma-de-distribucion.md)

Extiende: —

## Contexto

Entre el 2026-07-30 y el 2026-08-01 la mecanica de publicacion acumulo cuatro
ADRs: 0048 fijo identidad y canales, 0053 cerro la serie 3.x, 0054 documento la
publicacion manual de la 0.6.0 y 0055 retiro la firma de distribucion. Leidos en
orden se contradicen en superficie: 0048 declara que stable exige Authenticode y
Developer ID, y 0055 los retira; 0048 recomienda saltar a `4.0.0`, y 0053 lo
desmiente. Ninguna de esas contradicciones es real (cada ADR enmienda al
anterior), pero para saber como se publica hoy habia que leer los cuatro y
reconstruir el orden.

El costo fue concreto. Al preparar el corte 0.6.1 el texto vigente de 0048 y de
los skills seguia recomendando `4.0.0`, y estuvo a punto de fijarse el numero
equivocado. El objetivo real del proyecto es mas simple que su documentacion:
publicar rapido, que Windows funcione bien, y que macOS funcione en lo que se
pueda sin cumplir todo lo que Apple pide.

Este ADR reemplaza a los cuatro por un enunciado unico. Los originales se
conservan como registro historico de cada decision y de su fecha.

## Decision

### Identidad de version

`api/DESCRIPTION` es la unica fuente editable. Cuatro espejos obligatorios:
`desktop/package.json`, la primera entrada de
`frontend/src/features/home/releaseNotes.ts`, `docs/versiones-app.md` (fila
historica y seccion `Version actual` coherentes entre si) y el encabezado de
`.github/RELEASE_NOTES.md`. El tag `vX.Y.Z` debe coincidir con las cinco.

`scripts/release-contract.mjs` es el gate: `preview` audita sin escribir,
`prepare` es el gate local estricto del corte, y `stable --tag` exige identidad
exacta, monotonicidad y que el tag apunte a `HEAD`.

El encabezado de `.github/RELEASE_NOTES.md` separa la version del titulo con un
espacio (`# Prosecnur 0.6.1 · titulo`): el extractor toma el token siguiente a
`Prosecnur`, y pegarle dos puntos produce `0.6.1:`, que no es SemVer valido y en
modo `prepare` es error.

### Linea de versionado

La linea del producto es la serie `0.x`. Los siete tags `v3.3.1`–`v3.4.2`,
publicados entre el 2026-06-05 y el 2026-06-18, nacieron de nombrar «Corte 3.1»
a la version `0.3.1` y de que en algun momento el numero del corte se escribio
como numero de version. Son deuda historica cerrada: `LEGACY_RELEASE_TAGS` los
excluye del calculo de monotonicidad por lista explicita, nunca por el patron
`^v3\.`, de modo que un 3.x futuro no pueda colarse sin decision humana. Agregar
una entrada a esa lista exige modificar este ADR.

No se borran: son publicaciones reales con nueve artefactos cada una y
eliminarlas romperia enlaces de descarga existentes. La monotonicidad sigue
siendo estricta dentro de la serie vigente, y **el candidato no es `4.0.0`**:
basta con superar el maximo de la serie `0.x`. Ojo con el campo `recomendada`
que imprime el contrato, que es un `nextMajor()` informativo y no un requisito.

### Canales

**`internal-preview`** — solo `workflow_dispatch`, sin inputs. Corre el contrato
`preview` y Quality. Conserva el `.exe`, el ZIP portable de Windows y los DMG.
No transporta `latest*.yml`, ZIP de macOS ni blockmaps, no toca GitHub Releases
y no recibe `contents: write`.

**`stable`** — solo por push de un tag `v*`. Corre `stable --tag` antes de
construir, luego Quality y ambos builds, y publica.

### Sin firma de distribucion

El repositorio no tiene certificados: `gh secret list` esta vacio,
`desktop/package.json` declara `mac.identity: null` y `mac.target` solo emite
`dmg`. Exigir Authenticode, Developer ID o los payloads de updater de macOS
dejaba `stable` inalcanzable por construccion y no por un defecto del build, al
punto de que la 0.6.0 tuvo que publicarse a mano adjuntando binarios del
preview.

Stable no verifica firmas. Los instalables salen sin firmar: SmartScreen
advierte en Windows y Gatekeeper pide «Open Anyway» en macOS, igual que en las
diecinueve releases anteriores a `32aa1ec5`. Windows conserva su `latest.yml` y
su auto-updater; macOS se distribuye por DMG y se actualiza a mano, porque sin
ZIP no hay `latest-mac.yml` ni blockmaps que publicar.

### Windows bloquea, macOS es best-effort

`publish` exige exito de `build-windows` y **no** de `build-mac`. El DMG se
adjunta cuando existe y su ausencia deja un warning en el log, no un fallo. Un
runner de macOS caido no puede dejar sin release a los usuarios de Windows, que
son la mayoria.

La lista de assets se compone en un paso previo para conservar
`fail_on_unmatched_files: true`: los tres archivos de Windows se listan siempre
y los DMG solo si existen. Bajar la bandera a `false` habria tolerado tambien un
error de nombre del lado Windows, que es lo unico que no se tolera.

### Quality se reusa por SHA

`precheck` busca un run verde de `quality.yml` sobre el mismo commit y omite el
gate cuando lo encuentra. El SHA fija el arbol entero, incluida la definicion de
`quality.yml`, de modo que el run omitido no puede diferir del reusado. El flujo
rapido es: pushear `main`, esperar Quality verde, taggear **ese mismo** commit.
Taggear antes de que Quality termine paga el gate dos veces.

Los builds siguen detras del gate. Desengancharlos para ganar paralelismo
dejaria `internal-preview` sin verificacion alguna, porque ahi no corre
`publish`, que es el unico job que comprueba Quality.

## Consecuencias

- Se publica por push de tag, sin maniobras manuales.
- El release vuelve al orden de magnitud de los ~9 minutos cuando hay Quality
  verde previo sobre el commit taggeado.
- Los instalables no estan firmados y el usuario ve las advertencias del sistema
  operativo al instalar.
- Quien instale en macOS no recibe actualizaciones automaticas.
- Un fallo de macOS produce un release solo-Windows, con warning visible.
- Un tag desalineado, no monotono, en otro commit, con notas incompletas o con
  Windows fallido no alcanza la publicacion.

## Cumplimiento

- `node --test scripts/tests/release-contract.test.mjs` cubre las cinco
  superficies, la comparacion SemVer, el tag en `HEAD`, la exclusion de la serie
  3.x, la ausencia de los gates de firma, el reuso de Quality por SHA, que los
  builds sigan detras del gate y la asimetria Windows/macOS en las dos
  direcciones.
- `node scripts/release-contract.mjs stable --tag vX.Y.Z` es el preflight
  obligatorio antes de pushear un tag.
- `.github/workflows/release.yml` no declara inputs bajo `workflow_dispatch`, no
  tolera errores de paso y concede `contents: write` unicamente en `publish`.
- `node scripts/check-docs-governance.mjs` verifica que este ADR este indexado y
  sea alcanzable desde la portada documental.

## Notas

Si algun dia se adquieren certificados, el camino es: cargarlos como secrets,
agregar `zip` a `mac.target` para que electron-builder emita los payloads del
updater, restituir las verificaciones de firma y enmendar este ADR. Retirar la
firma fue una decision sobre el bloqueo, no sobre su valor.

Los cuatro ADRs reemplazados conservan el detalle de cada decision y su fecha.
Para saber como se publica hoy, alcanza con este.
