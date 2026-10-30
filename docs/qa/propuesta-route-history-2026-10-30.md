# Propuesta: el historial de ruteos deja de guardar la muestra entera

Fecha: 2026-10-30. Loop de Hojas de ruta, pendiente de fondo del checklist `checklist-flujo-analista-2026-10-30.md`.
Estado: **revisada por `guardian-contratos` (2026-10-30): aprobada con cambios, requiere enmienda de ADR 0118 §3.** Los cambios están incorporados en «Revisión de guardian-contratos», al final; donde contradicen la propuesta original, manda esa sección.

## Qué pasa hoy (medido en acnur_acg)

`ui_state.route_history` es una lista de instantáneas de ruteo. Cada una lleva la configuración del estudio y la
**muestra completa** (`sample`: titulares, reemplazos, cuota y geometría asociada).

| Ruteo | Entrada | De eso, `sample` | `config` |
|---|---|---|---|
| 4/6 · N 1,200 · 150 manzanas | 2.722 KB | 2.701 KB | 12 KB |
| 20/5 · N 30 · 6 manzanas | 927 KB | 906 KB | 11 KB |
| 14/5 · N 385 · 77 manzanas | 1.055 KB | 1.041 KB | 9 KB |

Son tamaños de objeto en R (`object.size`). El 99 % de cada entrada es la muestra.

La misma lista se repite en tres lugares: `hojas_ruta_ui_state`, `hojas_ruta_runs$pilot$ui_state` y
`hojas_ruta_runs$field$ui_state`. Son 8 entradas y unos 10 MB en memoria, sólo para el historial.

Además, el historial viaja entero en cada `persist` del workspace: el autosave de la página clásica y el sorteo del
lienzo (`HojasRutaMapaPage.tsx:286`). Los guardados ligeros de F1 (`ligero`) ya no lo mandan, pero el sorteo sí.

## Quién lee la muestra guardada

| Consumidor | Qué usa | Dónde |
|---|---|---|
| Lienzo, «Usar» un ruteo | Sólo `config` (los parámetros del sorteo). Vuelve a sortear en R. | `HojasRutaMapaPage.tsx:301` `usarRuteo` |
| Lienzo, lista del historial | `label`, `seed`, `method`, `n_*`, `distribution`, `territories` | `ManzanasEstructura` |
| Página clásica, restaurar | **`sample` literal**: lo pone como muestra vigente sin volver a sortear | `HojasRutaPage.tsx:7437` `restoreRouteSnapshot` |
| Página clásica, normalizar | **Descarta** las entradas sin `sample.blocks` | `HojasRutaPage.tsx:360` `normalizeRouteHistory` |
| Warm start | Pasa la lista tal cual | `warmupRegistry.ts:186` |
| Router R | Tope de 12 entradas, sin mirar adentro | `router_hojas_ruta.R:89-95` |

Topes distintos: el lienzo guarda hasta 8 (`MAX_HISTORIAL`) y R acepta 12.

## Propuesta

1. **La instantánea guarda el resumen, no la muestra.** Se conservan `id`, `label`, `created_at`, `seed`, `method`,
   `route_size`, los `n_*`, `territories`, `distribution` y `config`. Se agrega `sample_fingerprint`, calculado con
   `.hojas_ruta_sample_fingerprint` (sha256, `hojas_ruta_envio.R:57`). `sample` desaparece. Cada entrada baja a unos
   12 KB, unas 200 veces menos.
2. **Restaurar es volver a sortear y comprobar.** «Usar» manda los parámetros del ruteo a R (lo que el lienzo ya
   hace). Después compara la huella nueva con `sample_fingerprint`:
   - **Si coinciden**, es el mismo ruteo, y se dice así.
   - **Si difieren** (cambió el marco, el territorio o la versión del motor), se avisa: «El marco cambió desde este
     ruteo: la muestra que sale ya no es la de entonces». Nunca se pone en silencio una muestra distinta como si
     fuera la vieja.
3. **La muestra vigente sigue entera donde ya vive**, en `workspace_outputs.sample`. Lo que se envió a Material sigue
   congelado en el envío (`hojas_ruta_envio.R`, que guarda `sample` y su huella). Ninguna muestra que haya salido a
   campo se pierde.
4. **Migración al abrir.** El normalizador de R (`router_hojas_ruta.R:89`) recorta `sample` de cada entrada vieja y
   calcula su `sample_fingerprint` a partir de ella antes de soltarla. Así los `.pulso` existentes adelgazan al primer
   guardado sin perder la verificación.
5. **Un solo tope**: R aplica `MAX_HISTORIAL` = 8, el mismo número que el front.
6. **Página clásica.** `normalizeRouteHistory` deja de exigir `sample.blocks` y exige `config`.
   `restoreRouteSnapshot` sortea con los parámetros guardados, igual que el lienzo, y aplica el mismo aviso de huella.
   `HojasRutaPage.tsx` está congelado: el cambio no puede hacerlo crecer. Lo que no quepa a líneas constantes sale a
   un helper nuevo.

## Riesgos y lo que hay que decidir

- **Reproducibilidad.** El ruteo viejo sólo se puede reconstruir si el marco y el motor no cambiaron. Hoy la página
  clásica lo restaura de forma literal aunque el marco haya cambiado, lo que también es engañoso (muestra manzanas que
  quizá ya no existen en el marco vigente). La huella convierte ese caso en un aviso explícito. Si se quiere conservar
  la muestra literal de algún ruteo, que sea sólo la del ruteo **enviado**, y esa ya vive en el envío.
- **Duplicación entre `ui_state` y `runs`.** Esta propuesta no la toca. Al adelgazar cada entrada, triplicar 8 entradas
  de 12 KB deja de pesar.
- **Contrato.** Cambia la forma de `HojasRutaRouteSnapshot` (`sample` pasa a opcional y luego desaparece) y la del
  `state.rds` dentro del `.pulso`. Por eso necesita la revisión de `guardian-contratos` antes de implementarla.

## Gate cuando se implemente

- testthat: el normalizador recorta y conserva la huella; un historial viejo con `sample` sale sin `sample` y con
  `sample_fingerprint`; tope de 8.
- vitest: `instantaneaDeSorteo` sin `sample`; aviso de huella distinta; `normalizeRouteHistory` acepta entradas sin
  muestra.
- En vivo sobre acnur_acg: abrir, guardar, medir `state.rds` antes y después; «Usar» un ruteo con el marco intacto
  debe dar la misma huella.

## Revisión de guardian-contratos (2026-10-30): cambios incorporados

**Determinismo, verificado leyendo el código.** Hay un solo `set.seed` (`hojas_ruta_engine.R:5440`), y restaura
`.Random.seed` al salir. PPS y sistemático usan orden explícito. Reemplazos y valores operativos usan
`.hojas_ruta_stable_bucket`, que no consume RNG. La huella (`hojas_ruta_envio.R:57-71`) no depende de timestamps ni de
ids generados, y sobrevive a un ida y vuelta por JSON.

Riesgos residuales aceptados:
- **Collation del locale.** `order()` y `aggregate()` sobre texto dependen del locale. Si eso cambia el orden, lo peor
  que pasa es un falso «cambió».
- **`sample(prob=)` (engine:4578).** Depende del orden de filas del marco empaquetado.

1. **La huella sale de R.** El router agrega `result$sample_fingerprint <- .hojas_ruta_sample_fingerprint(result)` en
   `/sample-preview`, antes de `.hojas_ruta_workspace_outputs_update` (`router_hojas_ruta.R:~828`; el engine no se
   toca). `HojasRutaSamplePreview` gana `sample_fingerprint?`, e `instantaneaDeSorteo` y `buildRouteSnapshot` lo
   copian. El cliente deja de subir la muestra.
2. **El aviso nombra la causa.** La instantánea guarda `algoritmo_sorteo`, `frame_version`
   (`sample$frame_meta$version`), `hash_marco` y `hash_criterios` (`hojas_ruta_marco_elegible.R:612-613`), la fase y
   los `excluded_titular_ids` efectivos. Ante una huella distinta, el aviso dice cuál de estas cuatro causas aplica:
   - cambió el motor (por ejemplo, una instantánea v1 frente a ADR 0117 v2);
   - cambió el marco o sus criterios;
   - cambió la piloto;
   - cambiaron los parámetros.

   En fase de campo, `.hojas_ruta_effective_config_for_phase` (`router_hojas_ruta.R:423-435`) reinyecta exclusiones
   desde la piloto **actual**. Re-sortear campo depende de otra corrida, y por eso existe la causa «piloto».
3. **Una sola semántica de restaurar: la del lienzo.** Se aplican los parámetros del sorteo sobre la configuración
   vigente (`HojasRutaMapaPage.tsx:301`). Es la decisión vigente del lienzo (ADR 0114) y evita que un ruteo viejo pise
   en silencio N, rangos o territorio. Las huellas se comparan solo si la config efectiva normalizada coincide con la
   guardada. Si no coincide, el estado es «parámetros distintos». La página clásica adopta la misma semántica en un
   helper aparte.
4. **La migración alcanza todo el `.pulso`.** Al cargar, o en `.hojas_ruta_ensure_runs`, se recorren
   `hojas_ruta_runs$pilot`, `$field` y `hojas_ruta_ui_state`. La huella se calcula **antes** de recortar y solo si
   `sample` tiene bloques. Si no los tiene, queda `NA` y la UI dice «sin huella: no se puede comprobar», nunca
   «coincide». La migración no marca dirty (`.hojas_ruta_runs_huella`, :268, excluye `ui_state`), así que el `.pulso`
   adelgaza en el siguiente guardado que el usuario haga por otro motivo. Es deliberado y se declara.
5. **Una huella que llega del cliente** se valida con `^sha256:[0-9a-f]{64}$`. Si no casa, queda `NA`. Es solo
   informativa.
6. **Topes (reemplaza el punto 5 de la propuesta):**
   - R y `normalizeRouteHistory` aceptan 12, así que no se descartan sin aviso entradas de historiales existentes;
   - al insertar se aplica 8 (`MAX_HISTORIAL`).
7. **Tipos.** `sample?:` es opcional durante la transición. `normalizeRouteHistory` exige `id`, `config` y `seed`.
   `restoreRouteSnapshot` deja de leer `snapshot.sample.quota` y enfoca el mapa con la muestra re-sorteada.
8. **ADR.** Hace falta una enmienda de ADR 0118 §3: el historial pasa a ser el tercer consumidor de la huella. La
   enmienda deja escritas tres cosas:
   - restaurar pasa de literal a re-sortear con aviso (ADR 0117: «nunca se vuelve a sortear en silencio»);
   - la forma persistida nueva;
   - la regla de migración.

Consumidores que faltaban y que no se afectan o pasan por el normalizador:
- `router_hojas_ruta.R:240, 336, 407, 499, 536, 641`;
- `audit_reference.R:536`;
- `store.ts:56-138`;
- `ManzanasPaneles.tsx:245-271` (solo el resumen).

Material, Monitoreo, el modo público y desktop no leen `route_history`.

**Gate adicional:**
- testthat:
  - la huella es estable en un ida y vuelta por JSON;
  - dos llamadas idénticas dan la misma huella;
  - en campo, cambiar la piloto da la causa «piloto»;
  - una entrada v1 da la causa «motor»;
  - la corrida no activa también queda migrada.
- `test-hojas-ruta-ciudades.R:73` sigue en verde.
- `make gate-area` y `make gate-front AREA=hojasRuta`.

## Orden de implementación

1. **R:** huella en `/sample-preview`, normalizador y migración de las tres ubicaciones, la causa del aviso, y un test
   nuevo `test-hojas-ruta-route-history.R`.
2. **Enmienda de ADR 0118 §3.**
3. **TS del lienzo:** instantánea sin muestra y aviso tras «Usar».
4. **Página clásica:** un helper aparte; `HojasRutaPage.tsx` a líneas constantes.
