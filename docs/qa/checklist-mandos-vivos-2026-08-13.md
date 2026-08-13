# Checklist — que ningún control declarado pueda no llegar

Abierto 2026-08-13 a partir de las tres recomendaciones que salieron del GOAL
del motor de gráficos. Documento vivo: **sólo Gonzalo lo cierra**.

Sale de un hecho medido, no de una intuición: en una sesión aparecieron **ocho
mandos muertos** —controles visibles en el inspector que no cambiaban el
entregable—, y ninguno lo habría visto una auditoría estática de nombres. El
patrón es siempre el mismo: el valor existe en dos sitios y uno gana en
silencio.

## Lo que ya se midió

388 args declarados en los presets con graficador conocido. **11 no pueden
llegar** a su graficador, y al mirarlos uno a uno son tres casos distintos:

| Arg | Dónde se declara | Qué pasa |
|---|---|---|
| `excluir_opciones` | apiladas, multi, agrupadas | **Legítimo**: el plan lo traduce (52 usos) |
| `wrap_y` | apiladas, agrupadas | **Legítimo**: el plan lo traduce a `ancho_max_eje_y` (8 usos) |
| `angle_x` | apiladas, multi, agrupadas | **Muerto ahí**: su único uso es `presets$dim_heatmap$args$angle_x`. Pertenece a `dim_heatmap` y aparece en tres inspectores donde no hace nada |
| `espacio_entre_barras` | multi_apiladas | **Muerto**: no aparece en ningún graficador ni en el plan |
| `mostrar_rango`, `tipo_rango` | boxplot | **Preset equivocado**: los implementa `graficar_media_rango()`, y `media_rango` ya los declara. El inspector del boxplot muestra dos controles de otro gráfico |

## Las tres recomendaciones, por rentabilidad

| # | Qué | Coste | Estado |
|---|---|---|---|
| R1 | **Los valores llevan su procedencia** (`fabrica` / `proyecto` / `grafico`) | alto · pide ADR | ☐ sin empezar |
| R2 | **Ningún control declarado puede no llegar** — el CI lo detecta | una tarde | ◐ presets hechos; faltan graficadores y slides |
| R3 | **La geometría se calcula, no se calibra** | medio | ☐ sin empezar |

R2 primero por decisión de Gonzalo: no es la más profunda, pero convierte esta
clase entera de bug en un fallo de CI en vez de un hallazgo de sesión.

## Cola de R2

| # | Qué falta | Estado |
|---|---|---|
| C1 | Retirar `angle_x` de apiladas, multi y agrupadas | ☑ **hecho** |
| C2 | Retirar `espacio_entre_barras` de multi_apiladas | ☑ **hecho** |
| C3 | Retirar `mostrar_rango` y `tipo_rango` del preset del boxplot | ☑ **hecho** |
| C4 | Test de cobertura: **todo arg declarado llega** | ☑ **hecho** · verificado con mutante: con un arg muerto inyectado FAIL 2, sin él FAIL 0 |
| C5 | Extenderlo a `.GRAFICADORES_META`, no sólo a `.PRESETS_META` | ☐ |
| C6 | Extenderlo a los args de SLIDE (`.SLIDES_META`), donde vive `args_extra` | ☐ |

## Por qué la lista de «traducidos» va explícita

`excluir_opciones` y `wrap_y` no son formals de su graficador y aun así
funcionan, porque el plan los convierte. Si el test los aceptara por una regla
general —«si aparece en el plan, vale»— dejaría de distinguir un arg traducido
de uno que el plan menciona por casualidad, que es como `angle_x` habría pasado:
aparece una vez en el plan, pero para OTRO preset.

La lista es corta a propósito. Añadir un nombre a ella obliga a escribir dónde
se traduce, que es justo la documentación que hoy no existe.

## Trampas heredadas del GOAL

- **Un arg cruza cuatro listas** antes de llegar al motor: registro →
  `p_presets()` → merge de presets → formals del graficador. `p_presets()`
  descarta lo que no esté en sus formals **con un warning que nadie ve**, y el
  render sale idéntico. Fue lo que mantuvo muerto el preset multiactor después
  de declararlo.
- **La cadena de QA visual no ve lo que ve PowerPoint** (LibreOffice iguala
  `vert` y `vert270`, y resuelve un `<p:ph/>` vacío a horizontal).
- **Un test estático puede acusar en falso**: cuando la regla del subtítulo salió
  a un helper compartido, el aserto de cobertura lo dio por muerto porque la
  cadena literal desapareció del motor.
