# Formato en Hojas de ruta (4 nov 2026, noche)

Cuarta tanda del encargo de coordinación (Meta B) de la noche del 3 al 4 de noviembre. Receta de
`formato-monitoreo-2026-11-02.md` y `formato-calculo-graficos-2026-11-02.md`. Alcance de escritura:
`frontend/src/features/hojasRuta/` y este doc. Decisiones «decididas por coordinación, revisables por Gonzalo».

P3 ya estaba hecho (9e07233ef, 3 nov: 84 líneas, guard `puntoMedio.contract` en meta 0).

## Medición (4 nov, 02:40)

| # | Patrón | Antes | Después | Nota |
|---|---|---|---|---|
| P1 | `font-size` en px | 174 en 10 hojas (`mapaPage.css` 123, `atlas.css` 16) | **2** | La cifra héroe del resultado de Muestra (30 px; 24 px bajo 1280), declarada: el rol `kpi` (21) la achicaría. Hojas de ruta no estaba en `app/letraPorRol`; el guard es del módulo |
| P4 | `toLocaleString("es-PE", …)` de cifra | 38 | **0** | `formatoDecimal(x, d)` donde había `maximumFractionDigits: d` (mismo resultado) y `formatoConteo` en los conteos. Quedan los decimales FIJOS (`minimumFractionDigits`: «±3.0 %», «DEFF 1.5 en uso») y las fechas |
| P4 | Coma decimal escrita a mano | 3 | **0** | Los botones de DEFF («1,5») y el ICC («ICC 0,05 → 1,2») en Muestra cosían `.replace(".", ",")`: es-PE usa punto (`feedback_es_pe_usa_punto_decimal`) |
| P5 | Vacíos y cargas con receta propia | 10 (`hr-mapa-vacio` 6, `hr-atlas-vacio` 2, `hr-bitacora-vacio` 2) y 3 esperas a mano | **0** | El vacío de la lista de distritos del mapa mezclaba error, vacío y carga en una línea: ahora son `ErrorBlock`, `EstadoVacio` y `LoadingBlock` |
| P6 | Estados con píldora propia | 2 | **0** | El estado de la ruta en el inspector de Selección y la columna Revisión de la evidencia, a `EstadoChip` (error → peligro, aviso → aviso, ok → éxito) |
| P2 | Cajas propias / `h2–h4` | 30 / 45 | 29 / 45 | Línea base: el lienzo del mapa con sus inspectores es un banco de trabajo propio (ADR del lienzo, fase 3) |

## Guard

`features/hojasRuta/formatoDelModulo.contract.test.ts`, meta 0: P1 (salvo la cifra héroe), P4 (cifra a mano y coma
decimal), P5, P6, con el caso que prueba cada detector.

## Vistas (capturas «después», `acnur_acg`, 1440×1000 y 1024×600)

Corrida «después» (`cap/hr-despues`): 10 capturas, 10 md5 distintos. Territorio, Población y Muestra sin hallazgos.

| # | Vista | Qué se ve | Estado |
|---|---|---|---|
| 1 | Manzanas › Piloto | «Evita las del piloto / No las evita» con su explicación dentro de un botón segmentado de 28 px: la explicación se salía 120–164 px (defecto previo a esta pasada) | ☑ la regla usa la tarjeta apilada de los métodos de sorteo (`hr-sorteo-metodos`), sin diagrama |
| 2 | Manzanas a 1024 | «Sortear de nuevo con el método vigente» se salía 5 px de su botón | ☑ «Sortear con el método vigente» |
| 3 | Selección a 1024 | El placeholder «Buscar UMP, zona o manzana» no cabía (179 de 165 px) | ☑ «UMP, zona o manzana» (la lupa ya dice buscar) |

Tras el arreglo, Manzanas y Selección a 1440 y 1024: `ok=true`, `issues=0` (`cap/hr-2`).

## Estado

| Paso | Estado | Commit | Nota |
|---|---|---|---|
| Medición | ☑ | (este doc) | |
| P1, P4, P5, P6 | ☑ | | P6 suma el estado del envío (4 nov mediodía) |
| P2 | ☑ (acotado) | (ver «P2 y P6, 4 nov mediodía») | Los tres cajones inferiores son `Panel`; lo demás queda anotado |
| Capturas después | ☑ | | Ver «Vistas»; los tres arreglos van en el commit siguiente |
| Gate | ☑ | | `tsc` 0; `make gate-front AREA=hojasRuta` 68 suites, 874 tests |

## P2 y P6, 4 nov mediodía (decidido por coordinación, revisable por Gonzalo)

Pedido: «los estados con píldora propia pasan a `EstadoChip`; las cajas con título fuera del lienzo pasan a `Panel`.
El lienzo del atlas, el mapa y sus controles flotantes no se tocan».

### Qué es bloque y qué no

Se midió con la regla del ratchet de Analítica (borde sólido, radio y relleno en la misma regla): 30 cajas en 10
hojas. Revisadas una por una:

| Qué | Dónde | Decisión |
|---|---|---|
| Cajón inferior de Población («Matriz poblacional») | `poblacion/PoblacionCajon.tsx` | **`Panel`**. Gana un título; las dos lecturas, Excel, CSV y cerrar van en `actions` |
| Cajón inferior de Muestra («Cuotas por distrito, totales por edad y por sexo») | `muestra/MuestraCajon.tsx` | **`Panel`**. El título era un `strong` propio (`hr-sel-cajon-titulo`, retirado) |
| Cajón inferior de Selección («Tablas de la selección») | `seleccion/SeleccionPaneles.tsx` | **`Panel`**. Gana un título; titulares, reemplazos y cuotas, más cerrar, en `actions` |
| Grupos del inspector (`hr-muestra-grupo`: Método, Carga de la ruta, Piloto, Marco elegible, Envío a Material…) | inspector de cada sección | **No**: son divisiones con filete de una sola columna, no cajas; hacerlos `Panel` encajonaría la columna entera |
| Tarjetas de observación de Selección (`hr-sel-grupo`), ficha del distrito (`hr-ter-ficha`), jornadas del plan, ajustes por distrito | Selección, Territorio, Muestra | **No**: son tarjetas de dato (una por entidad), como la ficha de manzana |
| Avisos (`hr-sorteo-v1`, `hr-bitacora-aviso`), recomendación de la guía, escenarios | Manzanas, Selección, Muestra | **No**: avisos y listas, no bloques con título |
| Controles (buscador, zonas, chips de distrito, atajos, pasos, campos) | toda la página | **No**: controles |
| Zoom, cursor, leyenda, migas del lienzo | `lienzo/` | **No se tocan**: banco de trabajo del revamp aprobado |

Manzanas no tiene cajón: su inspector es una columna de grupos, así que no cambia en esta pasada.

### P6

El estado del envío a Material de campo («Enviada» / «La muestra cambió desde el envío», en Selección por UMP y en
Entrega por cuotas) era un `strong` dentro de una caja teñida: pasa a `EstadoChip` («Al día» en éxito, «Desactualizado»
en aviso), y la frase que dice qué cambió sigue debajo cuando aplica. Los «+ distrito / − distrito» de los cambios sin
confirmar, el contador de Avisos y los semáforos (consejos de la guía, cobertura del marco, rangos de edad) son datos y
conteos, no estados con píldora: se quedan.

### Capturas (`--url` contra la pila de la sesión, 1440×1000 y 1024×600)

Dos proyectos: la copia de `acnur_acg` (Lima y Callao) y otra con tres ciudades en el estudio (Lima, Arequipa y
Trujillo, sumadas por la misma llamada que el Atlas y guardadas en la copia). Vistas: Población con la matriz abierta,
Muestra con las cuotas, Selección con las tablas y el panel de salidas (Entrega). 16 capturas, 16 md5 distintos.

| # | Vista | Qué se ve | Estado |
|---|---|---|---|
| 1 | Los tres cajones a 1440 | El título del Panel y sus controles; la tabla conserva su alto | ☑ |
| 2 | Cajón de Población y de Selección a 1024 | Con el título, la cabecera de Población llegaba a cuatro renglones y la tabla mostraba sólo su cabecera | ☑ en un cajón de menos de 620 px el título cede su renglón (`@container hr-cajon`) y quedan los tres renglones de controles de antes |
| 3 | Población a 1024 | La cabecera fija de la matriz tapa 15 px de una fila: el cajón deja una sola fila a la vista bajo tres renglones de controles | ☐ previo (los tres renglones ya estaban sin Panel); pide que el cajón crezca en alturas bajas o que los controles se plieguen en un menú |
| 4 | Entrega (panel de salidas) a 1440 | `capacity-drift` del `Sideover`: 156 px vacíos al pie | ☐ previo, del kit; el estado del envío sólo aparece tras enviar y en estas copias no hay envío (lo cubre el test de `EntregaCuotas`) |
| 5 | Tablas de los cajones | Columnas a la derecha tras desplazar en horizontal (`alcanzable`) | no es defecto: las tablas desplazan |

Entrega por cuotas (`EntregaCuotas`) sólo existe en un estudio por cuotas; ninguna de las dos copias lo es.

### Guard

`formatoDelModulo.contract.test.ts` suma a P6 el estado del envío y estrena P2 (`<section className="hr-sel-cajon"`,
meta 0), con los casos que prueban los detectores.
