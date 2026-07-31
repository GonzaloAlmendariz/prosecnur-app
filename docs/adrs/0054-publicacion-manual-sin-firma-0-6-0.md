# ADR 0054: Publicacion manual sin firma para el corte 0.6.0

Estado: Aceptado

Implementacion: Completa

Fecha: 2026-07-31

Fecha de decision: 2026-07-31

Reemplaza: —

Enmienda: [0048](0048-identidad-version-y-canales-distribucion.md)

## Contexto

El ADR 0048 declaro el canal `stable` fail-closed y dejo escrito que quedaba
«deliberadamente bloqueado» hasta que packaging produjera firmas de
distribucion y los ZIP de macOS del updater. Esa decision se tomo el
2026-07-30, un dia despues de la ultima publicacion.

Al preparar el corte 0.6.0 ese bloqueo se materializo por primera vez. El
estado verificado del repositorio es:

- `gh secret list` vacio: no hay certificados cargados.
- `packaging/windows/build-self-contained.sh` no firma; el workflow ejecuta
  `osslsigncode verify` y falla.
- `desktop/package.json` declara `mac.identity: null`, de modo que
  electron-builder salta la firma, y el workflow exige
  `Authority=Developer ID Application:`.
- El target de macOS es solo `dmg`: no se generan los ZIP ni sus blockmaps que
  el job de publicacion exige.

Hasta `v0.5.19` inclusive no existia ninguno de esos gates —el workflow traia
el comentario «Sin firma Apple Developer todavia: Gatekeeper pedira Open
Anyway»— y las diecinueve releases previas se publicaron sin firma.

El corte 0.6.0 esta completo y verificado: cinco superficies alineadas,
`release-contract prepare` en verde, Quality verde en los cuatro jobs sobre
`8cc6ea39` y ambos builds de plataforma exitosos en el canal
`internal-preview`. Lo unico que impide publicarlo son gates que describen una
capacidad futura, no un defecto del corte.

## Decision

El corte 0.6.0 se publica **manualmente**, adjuntando a la GitHub Release los
binarios ya construidos por el run de `internal-preview`, sin pasar por el job
`Publish stable GitHub Release`.

Los gates del ADR 0048 **no se modifican**: el workflow conserva sus
verificaciones de firma y de payload intactas. Esta es una excepcion acotada a
una version, no una relajacion del canal.

La publicacion se entrega **sin auto-updater**: los artefactos de preview
tienen `latest.yml`, `latest-mac.yml` y los blockmaps eliminados por un gate
propio, y el ADR 0048 es explicito en que un preview no sirve como fuente del
updater. La 0.6.0 se instala a mano.

## Consecuencias

- La 0.6.0 queda visible y descargable en Releases, con instalador de Windows
  y los dos DMG de macOS.
- Quien tenga 0.5.19 instalada **no recibira la actualizacion automatica**;
  debe descargar e instalar manualmente.
- Los binarios van sin firmar: Windows mostrara SmartScreen y macOS exigira
  abrir con clic derecho la primera vez.
- El push del tag `v0.6.0` disparara el workflow `Release`, que fallara en la
  verificacion de firma. Ese run rojo es esperado y no afecta a la release ya
  publicada, porque el job de publicacion depende de builds que no completan.
- La deuda no se disimula: sigue registrada en el ADR 0048 y ahora tambien
  aqui, con su condicion de salida.

## Cumplimiento

- Esta excepcion cubre **unicamente** la version 0.6.0. Otra version que quiera
  publicarse sin firma exige un ADR propio.
- No se admite modificar `release.yml` para debilitar `osslsigncode verify`, la
  comprobacion de `Developer ID Application` ni los gates de payload.
- La excepcion se cierra cuando existan las tres capacidades ausentes:
  certificado Authenticode, Developer ID y target `zip` en macOS con sus
  blockmaps. A partir de ahi el canal `stable` vuelve a ser la unica via.
- `node scripts/release-contract.mjs prepare` debe seguir en verde: la
  identidad de las cinco superficies no se relaja por publicar a mano.

## Notas

La alternativa evaluada fue enmendar los gates y dejar que el workflow
publicara por si mismo. Se descarto por costo de tiempo —el ciclo completo
ronda los 45 minutos— y porque habria implicado debilitar verificaciones de
seguridad de forma permanente para resolver una entrega puntual. Publicar a
mano deja el gate intacto y hace visible que se tomo un atajo.
