# ADR 0059: Calendario único de binarios R y reuso del gate por linaje

Estado: Aceptado

Implementacion: Completa

Fecha: 2026-08-04

Fecha de decision: 2026-08-04

Reemplaza: —

Extiende: [0050](0050-entorno-r-reproducible-ci-inmutable.md) y
[0056](0056-como-se-publica-prosecnur.md)

## Contexto

El corte `v0.7.0` pagó dos veces el mismo defecto estructural, uno por cada
plataforma, y ambos rebotes están documentados en el run de Release.

**Dos calendarios de binarios.** El ADR 0050 fija `api/renv.lock` con
versiones exactas y checksums, pero los dos descargadores de binarios leen
fuentes con relojes distintos: Windows
(`packaging/windows/download-r-win-binaries.R`) usa un snapshot fechado de
Posit congelado en el script, y macOS
(`packaging/macos/download-r-mac-binaries.R`) lee los índices vivos de
`cloud.r-project.org`. Cuando CRAN retira una versión, una de las dos puntas
rompe mientras la otra sigue en verde:

- En el corte `0.6.3`, CRAN publicó `class` 7.3-24 y dejó de servir la 7.3-23;
  macOS (vivo) rebotó y Windows (snapshot) pasó. El fix `d9f4ce76` subió el
  lock a 7.3-24.
- En `v0.7.0`, esa misma subida rompió Windows: su snapshot (2026-07-30)
  seguía sirviendo 7.3-23. Y no existía fecha que satisficiera el lock tal
  cual, porque CRAN ya había publicado `bslib` 0.12.0 y `renv` 1.2.4; hubo que
  actualizar el lock y avanzar el snapshot en el mismo commit.
- En el reintento, el DMG x86_64 rebotó por deriva **intra-día**: a las 21:30
  UTC el índice vivo satisfacía el lock 174/174 (verificado), y a las 23:04 el
  build encontró `stringi` 1.8.9 donde el lock pide 1.8.7. El índice cambió
  durante el propio run.

Un lock exacto contra un índice vivo caduca sin que ningún commit cambie; con
dos fuentes desincronizadas caduca en dos calendarios distintos y cada
caducidad se descubre en el peor momento: dentro de un release.

**El gate no distingue linaje.** El precheck del ADR 0056 reusa un Quality
verde solo si es del mismo SHA. El fix de Windows para `v0.7.0` tocó 2
archivos y 5 líneas (`api/renv.lock` y el snapshot del script), cero código de
producto, y aún así el tag nuevo pagó el gate completo: 1 h 23 min de backend
R, agravados porque cambiar el lock invalida el cache de paquetes. Para un
hotfix de packaging dentro de un release en curso, ese costo no compra
confianza adicional sobre el producto: el árbol de `api/R`, `frontend` y
`desktop` es idéntico al del padre ya verificado.

Se verificó que Posit sirve snapshots fechados también para binarios macOS
(`bin/macosx/big-sur-{arm64,x86_64}/contrib/4.5`) y que el snapshot
2026-08-04 satisface el lock 174/174 en las tres plataformas.

## Decision

1. **Un solo calendario.** macOS descarga binarios del mismo snapshot fechado
   de Posit que Windows, en ambas arquitecturas. La fecha del snapshot vive en
   un único lugar compartido por los dos scripts (no una copia por plataforma).
   Avanzar la fecha es un acto deliberado que acompaña a toda actualización del
   lock, y viceversa: lock y snapshot se mueven juntos en el mismo commit,
   verificando el lock completo contra los tres índices del snapshot nuevo
   antes de commitear.
2. **Reuso del gate por linaje para diffs de packaging.** El precheck de
   `release.yml`, cuando no encuentra Quality verde del SHA exacto, camina la
   ancestría por primer padre (profundidad máxima 5) mientras cada diff
   acumulado toque únicamente la lista blanca `api/renv.lock` y
   `packaging/**`. Si encuentra un ancestro con Quality verde y el diff
   acumulado no sale de la lista, reusa ese verde y lo dice en el log del job
   (`skip_gate` con el SHA del ancestro y los archivos del diff). Cualquier
   archivo fuera de la lista, incluida cualquier ruta de `.github/`, corta la
   caminata y el gate corre completo. La lista blanca es cerrada: ampliarla
   exige revisar este ADR.

La lista excluye deliberadamente las cinco superficies de identidad y
`.github/workflows/**`: las notas viven en código frontend con tests que las
cuentan, y la definición del propio gate solo puede validarse corriéndolo.

## Consecuencias

- Las dos plataformas caducan el mismo día y por la misma causa; el fix es un
  solo commit (lock + fecha) verificable offline en minutos, en vez de dos
  incidentes separados por días descubiertos dentro de sendos releases.
- Desaparece la deriva intra-run: un snapshot fechado no cambia entre el
  chequeo local y el build en CI.
- Un hotfix de packaging dentro de un release re-taggea y construye en ~20
  minutos en lugar de ~1 h 45 min, sin debilitar el gate sobre código de
  producto: el árbol verificado es idéntico por construcción.
- Costo: los binarios de macOS dejan de seguir a CRAN vivo, así que una
  versión nueva de un paquete no llega hasta que alguien avanza lock y fecha a
  la vez. Es el mismo trade-off que Windows ya paga y es el comportamiento
  deseado bajo el ADR 0050.
- Riesgo: la caminata por linaje reusa un verde de hasta 5 commits atrás. La
  lista blanca cerrada y el corte ante `.github/` acotan el riesgo a archivos
  que los builds de release ejercitan de todos modos (el descargador falla
  fail-closed si el lock o el snapshot mienten).

## Cumplimiento

- `packaging/macos/download-r-mac-binaries.R` no contiene
  `cloud.r-project.org` (`rg cloud.r-project.org packaging/` limpio) y ambos
  scripts leen la fecha desde la misma fuente única.
- `scripts/tests/check-r-lock.test.mjs` cubre que la fecha compartida existe y
  que ambos descargadores la usan.
- El precheck de `release.yml` registra en el log qué SHA verde reusó y por
  qué diff; un reuso sin esa evidencia es un bug del precheck.
- Tests del precheck (fixtures de diff dentro y fuera de la lista blanca) en
  el job agentic-os o en `scripts/tests/`, corriendo en Quality.
- Al avanzar la fecha del snapshot, el commit que la mueve incluye en su
  mensaje la verificación 174/174 contra los tres índices.

## Notas

- Evidencia del incidente: runs 30949211227 (Windows rebota por `class`) y
  30952814683 (DMG x86_64 rebota por `stringi` intra-día; Windows y publish en
  verde) sobre los tags `v0.7.0` (`e98a47d9` fallido, `737b22a6` publicado).
- El DMG ausente de `v0.7.0` es el comportamiento best-effort del ADR 0056;
  puede reponerse con un build posterior bajo este ADR sin re-taggear.
- Artefactos de la implementación: la fuente única de la fecha es
  `packaging/r-snapshot-date.txt`, leída por
  `packaging/windows/download-r-win-binaries.R` y
  `packaging/macos/download-r-mac-binaries.R` (ambos contra
  `packagemanager.posit.co`, con checksum MD5 autoritativo del índice —
  `Hash`/`MD5sum` — y fail-closed si falta); el precheck por linaje vive en
  `scripts/release-precheck-lineage.mjs`, invocado por el job `precheck` de
  `release.yml` con checkout de historia, y sus fixtures deterministas en
  `scripts/tests/release-precheck-lineage.test.mjs`; la fuente única y la
  ausencia de fecha inline las afirma `scripts/tests/check-r-lock.test.mjs`.
- Los instaladores del runtime base de R (`R-<ver>-win.exe`, `R-<ver>-<arch>.pkg`
  en los build scripts) siguen viniendo de `cloud.r-project.org`: Posit no
  sirve esos instaladores en el snapshot (404 verificado) y son archivos
  inmutables anclados a versión exacta, no un índice que derive. El criterio
  «`rg cloud.r-project.org packaging/` limpio» aplica a los descargadores de
  binarios de paquetes, que eran los dos calendarios del incidente.
