# ADR 0055: El canal stable publica sin firma de distribucion

Estado: Aceptado

Implementacion: Completa

Fecha: 2026-08-01

Fecha de decision: 2026-08-01

Reemplaza: —

Enmienda: [0048](0048-identidad-version-y-canales-distribucion.md)

## Contexto

El ADR 0048, decidido el 2026-07-30, separo los canales `internal-preview` y
`stable` y declaro al segundo fail-closed. El commit `32aa1ec5` implemento esa
decision agregando a `release.yml` tres verificaciones que antes no existian:

- `osslsigncode verify` sobre el instalador Windows;
- `codesign --verify` mas `Authority=Developer ID Application:` sobre la `.app`
  de macOS;
- la exigencia de dos ZIP macOS, su `latest-mac.yml` y sus blockmaps, tanto en
  el job de build como en el de publicacion.

El repositorio no puede satisfacer ninguna de las tres. `gh secret list` esta
vacio, `desktop/package.json` declara `mac.identity: null` y `mac.target`
contiene unicamente `dmg`, de modo que los ZIP y blockmaps que el gate pide no
se generan. La ultima condicion no es un defecto del build que se pueda
reparar: es una exigencia sobre artefactos que el empaquetado nunca produce.

El efecto practico fue que `stable` quedo inalcanzable. Las diecinueve releases
publicadas entre `v0.2.1` y `v0.5.19` salieron sin firma, con el workflow
anotando que Gatekeeper pediria «Open Anyway», y nadie reporto el problema como
un obstaculo. El corte `0.6.0` fue el primero en chocar contra el bloqueo y se
resolvio con el ADR 0054: construir por `internal-preview` y adjuntar los
binarios a mano, sin auto-updater.

Sostener el gate significaba repetir esa maniobra manual en cada corte. La
alternativa de adquirir los certificados (Developer ID de Apple, mas un
certificado Authenticode de una CA) sigue siendo el arreglo correcto, pero es
una compra con costo anual y plazo de emision, no algo que destrabe el corte
pendiente.

## Decision

`stable` deja de exigir firma de distribucion. Se retiran de `release.yml` la
verificacion Authenticode de Windows, la verificacion Developer ID de macOS y
la exigencia de payloads de updater para macOS, junto con la instalacion de
`osslsigncode` que solo servia al gate retirado.

Se conserva todo lo que no depende de un certificado: la validacion de
identidad y monotonicidad por `release-contract.mjs`, la dependencia de Quality
verde, la verificacion del contenido y la version canonica del ZIP Windows,
`hdiutil verify` sobre los dos DMG, la exigencia de exactamente dos DMG en la
publicacion y `fail_on_unmatched_files: true`.

macOS se distribuye por DMG y **no participa del auto-updater**: sin ZIP no hay
`latest-mac.yml` ni blockmaps que publicar. Windows conserva su `latest.yml` y
su updater sigue funcionando.

La ausencia de los gates se afirma en `scripts/tests/release-contract.test.mjs`
en positivo, con `doesNotMatch`, y no borrando la afirmacion contraria:
reintroducir la firma sin haber cargado antes los certificados debe romper en
el test, que tarda milisegundos, y no a los veinte minutos dentro del runner de
macOS.

## Consecuencias

- El corte `0.6.1` y los siguientes se publican por push de tag `vX.Y.Z`, sin
  la maniobra manual del ADR 0054.
- Los instalables salen sin firmar. SmartScreen advertira en Windows y
  Gatekeeper pedira «Open Anyway» en macOS, exactamente como en las diecinueve
  releases previas a `32aa1ec5`.
- Quien haya instalado una version de macOS no recibira actualizaciones
  automaticas. Ya era asi antes de este ADR, porque `mac.target` nunca emitio
  los ZIP que el updater necesita; aqui queda documentado en vez de implicito.
- El ADR 0048 conserva su arquitectura de dos canales. Lo unico que se enmienda
  es el requisito de firma, no la separacion ni el caracter fail-closed del
  resto de sus gates.
- El ADR 0054 queda como registro historico de como se publico `0.6.0`. Su
  procedimiento manual deja de ser necesario.

## Cumplimiento

- `scripts/tests/release-contract.test.mjs` afirma la ausencia de
  `osslsigncode`, de `codesign --verify` y de `Authority=Developer ID
  Application`, la presencia de la cita `ADR 0055` en el workflow, y que la
  publicacion no vuelva a exigir `artifacts/mac/latest-mac.yml`.
- El mismo test conserva las afirmaciones que no dependen de certificados: un
  solo `contents: write`, ausencia de `continue-on-error`,
  `fail_on_unmatched_files: true` y la cadena de `needs` completa.
- `node scripts/release-contract.mjs stable --tag vX.Y.Z` sigue siendo el gate
  de identidad del tag y no se modifica.

## Notas

Este ADR no cierra la discusion sobre firmar. Cuando existan los certificados,
el camino es cargarlos como secrets, agregar `zip` a `mac.target` para que
electron-builder emita los payloads del updater, restituir las tres
verificaciones y enmendar este documento. La decision de hoy es que la firma no
bloquee la distribucion mientras esos certificados no existan, no que firmar
sea prescindible.
