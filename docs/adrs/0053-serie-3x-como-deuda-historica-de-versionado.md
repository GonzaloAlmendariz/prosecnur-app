# ADR 0053: La serie 3.x es deuda historica, no la linea de versionado

Estado: Aceptado

Implementacion: Completa

Fecha: 2026-07-31

Fecha de decision: 2026-07-31

Reemplaza: —

Extiende: [0048](0048-identidad-version-y-canales-distribucion.md)

## Contexto

El repositorio tiene dos series de tags conviviendo. La real —`v0.3.x`,
`v0.5.x`, hasta `v0.5.19` del 2026-07-24— y una de siete tags `v3.3.1` a
`v3.4.2`, publicados entre el 2026-06-05 y el 2026-06-18.

La serie 3.x nacio de una confusion de nomenclatura visible en
`docs/versiones-app.md`: los cortes se nombraban «Corte 3.1» para referirse a
la version **0.3.1**, «Corte 3.2» para la **0.3.2**, y en algun momento el
numero del corte se escribio como numero de version. Se publicaron siete
releases con esa numeracion y despues se retomo la serie real en `0.5.0`, sin
retirar las anteriores.

`scripts/release-contract.mjs` exige monotonicidad SemVer contra el maximo
historico. Como `v3.4.2` es el maximo absoluto, el contrato calculaba `4.0.0`
como unico candidato valido y convertia el diagnostico
`CURRENT_NOT_ABOVE_TAGS` en error en los modos `prepare` y `stable`. Es decir:
para cortar cualquier version habia que saltar de `0.5.19` a `4.0.0`,
consagrando el accidente como si fuera la linea buena del producto.

La alternativa de borrar los siete tags y sus releases se descarto: son
publicaciones reales con nueve artefactos cada una, y eliminarlas es
irreversible y rompe cualquier enlace de descarga existente.

## Decision

La serie 3.x se declara **deuda historica cerrada**. `release-contract.mjs`
mantiene una lista explicita `LEGACY_RELEASE_TAGS` con los siete tags y los
excluye del calculo de monotonicidad. La linea de versionado del producto es
la serie `0.x`, y el siguiente corte es `0.6.0`.

La lista es explicita y cerrada, no un patron `^v3\.`: excluir por forma
dejaria pasar sin decision humana cualquier tag 3.x que se creara en el
futuro. Añadir una entrada exige modificar este ADR.

La monotonicidad sigue siendo estricta dentro de la serie vigente: `0.6.0`
debe superar a `0.5.19`, y el contrato lo comprueba igual que antes.

## Consecuencias

- El corte `0.6.0` es viable sin saltar a `4.0.0` ni borrar publicaciones.
- Los siete tags y releases 3.x se conservan como registro historico.
- Un cliente que haya instalado `3.4.2` no recibira `0.6.0` por el updater,
  porque `electron-updater` compara SemVer. Esa desconexion ya existe desde el
  2026-07-13, cuando se publico `0.5.7` por debajo de `3.4.2`; este ADR la
  documenta en vez de crearla. Las descargas registradas de la serie 3.x son
  entre 1 y 3 por release, de modo que el alcance es despreciable.
- La serie 0.x queda comprometida a llegar algun dia a `1.0.0` y mas alla; al
  cruzar `3.4.2` la exclusion dejara de tener efecto por si sola y podra
  retirarse.

## Cumplimiento

- `LEGACY_RELEASE_TAGS` no admite entradas nuevas sin actualizar este ADR.
- Excluir por patron en vez de por lista explicita es una violacion, aunque
  deje el contrato en verde.
- El diagnostico `CURRENT_NOT_ABOVE_TAGS` sigue siendo error en `prepare` y
  `stable` para todo lo que no este en la lista.
- `node scripts/release-contract.mjs preview` debe seguir reportando la serie
  vigente como maximo comparable; si vuelve a recomendar `4.0.0`, la exclusion
  dejo de aplicarse.

## Notas

La decision se tomo con las descargas reales a la vista, no por estimacion:
`v3.4.2` acumula 3, `v3.4.1` una y `v3.4.0` tres. Ese dato fue lo que hizo
aceptable conservar la desconexion del updater en lugar de borrar releases
publicadas.
