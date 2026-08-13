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
| R2 | **Ningún control declarado puede no llegar** — el CI lo detecta | una tarde | ☑ **hecho** · 705 args cubiertos en los tres registros |
| R3 | **La geometría se calcula, no se calibra** | medio | ◐ helper hecho y probado; **falta cablearlo** (ver abajo) |

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

## R3 — dónde se quedó

El wrap del título de bloque es hoy `0.36 + (w - 0.13) * 0.857`: un factor
ajustado con dos puntos medidos. Extrapolar a 0.28 se sale por la izquierda.

`.barras_wrap_titulo_grupo()` mide el texto real —`grobWidth` sobre ESE título a
SU cuerpo— en vez de asumir un ancho medio de carácter. Está escrito y probado
en aislamiento, incluido el aserto que un factor fijo no puede pasar: `MMMM…`
da menos caracteres por línea que `iiii…` en el mismo canal.

**No está cableado, y a propósito.** Con los insumos que puedo leer de la
declaración —`ancho = 12.75` del slot de lámina completa, cuerpo 11–13 pt— el
cálculo da ~24 caracteres a `w = 0.13`, y el factor calibrado usa 14. Peor: a
`w = 0.20` el cálculo da ~30 y empíricamente **22 ya se salía por la izquierda**.
Alguno de esos insumos no es el que recibe el graficador.

Falta trazar `ancho` y `size_titulos_grupo` **en el render**. Lo intenté tres
veces y no salió: la llamada va envuelta en `suppressMessages(suppressWarnings(…))`
y se come tanto `message()` como el `cat()` del tracer. La vía que queda es
instrumentar el graficador temporalmente y escribir a un fichero, o exponer la
geometría resuelta como atributo del objeto devuelto.

Cablearlo sin eso sería cambiar una constante calibrada por un cálculo con
entradas equivocadas —y esta vez con la lámina 66 delante para desmentirme.

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
