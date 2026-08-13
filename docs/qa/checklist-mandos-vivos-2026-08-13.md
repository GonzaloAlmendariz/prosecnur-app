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
| R1 | **El proyecto guarda decisiones, no defaults** | alto | ☑ **hecho** · ADR 0074 aceptado e implementado · 253 → 32 valores |
| R2 | **Ningún control declarado puede no llegar** — el CI lo detecta | una tarde | ☑ **hecho** · 705 args cubiertos en los tres registros |
| R3 | **La geometría se calcula, no se calibra** | medio | ☑ **hecho** en el wrap del tema · queda limpiar el factor muerto del plan |

R2 primero por decisión de Gonzalo: no es la más profunda, pero convierte esta
clase entera de bug en un fallo de CI en vez de un hallazgo de sesión.

## Cola de R2

| # | Qué falta | Estado |
|---|---|---|
| C1 | Retirar `angle_x` de apiladas, multi y agrupadas | ☑ **hecho** |
| C2 | Retirar `espacio_entre_barras` de multi_apiladas | ☑ **hecho** |
| C3 | Retirar `mostrar_rango` y `tipo_rango` del preset del boxplot | ☑ **hecho** |
| C4 | Test de cobertura: **todo arg declarado llega** | ☑ **hecho** · verificado con mutante: con un arg muerto inyectado FAIL 2, sin él FAIL 0 |
| C5 | Extenderlo a `.GRAFICADORES_META` | ☑ **hecho** · 216 args, **cero muertos**; los 4 huérfanos los consume el plan |
| C6 | Extenderlo a los args de SLIDE | ☑ **hecho** · 101 args, **cero muertos**; `args_extra` no es superficie de edición |

## Por qué la lista de «traducidos» va explícita

`excluir_opciones` y `wrap_y` no son formals de su graficador y aun así
funcionan, porque el plan los convierte. Si el test los aceptara por una regla
general —«si aparece en el plan, vale»— dejaría de distinguir un arg traducido
de uno que el plan menciona por casualidad, que es como `angle_x` habría pasado:
aparece una vez en el plan, pero para OTRO preset.

La lista es corta a propósito. Añadir un nombre a ella obliga a escribir dónde
se traduce, que es justo la documentación que hoy no existe.

## Corrección: `args_extra` no era la puerta

Durante la sesión atribuí «Numerar OE» a `args_extra` —los formals sin catalogar
que el payload publica—. Es **falso**. Ese control venía de su declaración en el
registro, y lo que se veía en pantalla era la metadata vieja que la pestaña tenía
cargada en memoria desde antes de reiniciar el backend.

Medido: `args_extra` sólo lo tocan dos ficheros de producción, y ninguno lo
pinta —`api/graficos.ts` declara el tipo y `metadataSanitizers.ts` normaliza el
array—. Ningún `.tsx` lo renderiza. Los 59 formals de slide sin declarar son
estructurales (`slots`, `id`, `payload`…), no mandos del analista.

El primer aserto que escribí para esto —«ningún fichero de producción lo
menciona»— falló, y con razón: la pregunta no es si lo mencionan, es si lo
**renderizan**.

## R1 — el ADR, y por qué cambió de forma

Se planteó como «cada valor lleva una etiqueta de origen». Medir lo convirtió en
algo más simple: en «Conta 11-08», **218 de 253** valores de preset son idénticos
al default del día en que se guardó. Sólo 22 son decisiones.

Y el frontend ya resuelve esto sin guardar nada: para los overrides de un
gráfico deriva `inherited` o `custom` de si la clave está en la bolsa. Presencia
= decisión. Basta con que esa invariante valga también para los presets, y
entonces no hace falta etiquetar nada.

**ADR 0074 — el `.pulso` guarda sólo lo que difiere del default.** Propuesto, con
la consecuencia incómoda dicha: un mazo puede cambiar de aspecto al actualizar
la app, porque un default nuevo dejaría de quedar sepultado bajo la copia de
ayer. Eso es lo correcto y es un cambio de contrato que va en las notas.

**Implementado.** El filtro va en `.graficos_config_set()` al guardar y en
`.graficos_config_get()` al leer —las cuatro salidas—, para que un `.pulso`
anterior reciba el mismo trato sin migración y quede limpio en el primer
guardado. Medido sobre «Conta 11-08»: **253 → 32 valores, las 32 decisiones**.
El render de la lámina 66 sale idéntico byte a byte, o sea que nada dependía de
un default congelado.

Queda retirar las muletas que existen sólo porque antes no se podía distinguir:
la regla de «legado» de `textos_negrita` y el alias de `numerar_oe`. Ya no hacen
falta, pero tocarlas cambia el aspecto de proyectos vivos y merece su propia
vuelta.

## R3 — cerrado en el wrap del tema

El wrap se calcula ahora **dentro del graficador**, con `ancho`, cuerpo y ancho
de canal reales, midiendo la línea que se va a dibujar.

**La instrumentación fue lo que lo desbloqueó.** `message()` y `cat()` no
servían: el renderer llama envuelto en `suppressMessages(suppressWarnings(…))`.
La geometría resuelta viaja ahora como atributo `pulso_geometria_canales` y se
lee desde `reporte_ppt_plan(solo_lista = TRUE)`, que ya devuelve los objetos
renderizados. Los valores reales, que llevaba tres intentos sin ver:

```
ancho = 12.50 in · size_titulos_grupo = 14 pt · size_ejes = 16 · Arial
w_grupo = 0.216 (normalizado) · w_etiquetas = 0.098
```

Yo venía calculando con 11 pt y `ancho = 12.75`. Con esos supuestos el cálculo
daba 24 caracteres donde el factor usaba 14, y por eso no cuadraba nada.

**Dos hipótesis descartadas por el camino**, y las dos con medición:

- *métricas fuera de dispositivo*: medir sin `png()` abierto da 2.53 in donde el
  dispositivo real da 2.36 — diferente, pero conservador, no explicaba el
  desborde;
- *`draw_text(size=)` en milímetros*: mediría la caja del texto a ~40 pt. Medido
  sobre el PNG, las líneas ocupan 10–16 px a 70 px/in, o sea ~14 pt. Falsa.

Lo que faltaba era medir **la línea más ancha** que produce el wrap, no el
promedio del texto: `str_wrap` reparte por palabras y una línea puede pasarse.

VERIFICADO en la lámina 66 con dos configuraciones: con el reparto de fábrica el
texto se queda dentro de la columna, y con `canvas_w_grupo = 0.28` —la que se
salía por la izquierda con el factor calibrado— también, aprovechando el ancho
extra. **Sin retocar ninguna constante entre las dos.**

Queda un cabo: `.multiactor_wrap_tema()` sigue en el plan y ya no decide nada
—el graficador deshace ese wrap y rehace el suyo—. Retirarlo pide comprobar
antes que el camino de Word no dependa de él.

## Trampas de este checklist

- **Un mutante que no muta dice «pasa».** Dos de mis tres intentos de inyectar un
  arg muerto en `.GRAFICADORES_META` fueron a otro bloque —`s.index()` sobre dos
  espacios casa dentro de una indentación mayor, y `args = c(list(` no es
  `args = list(`— y el test daba FAIL 0. Sin comprobar que el mutante estaba
  DE VERDAD en el registro, habría dado por validado un test que no medía nada.
  El aserto del mutante necesita su propio aserto.

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
