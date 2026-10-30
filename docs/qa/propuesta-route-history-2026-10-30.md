# Propuesta: el historial de ruteos deja de guardar la muestra entera

Fecha: 2026-10-30. Loop de Hojas de ruta, pendiente de fondo del checklist `checklist-flujo-analista-2026-10-30.md`.
Estado: **propuesta, revisada por `guardian-contratos` antes de tocar código.**

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
