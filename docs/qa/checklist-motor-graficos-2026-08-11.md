# Checklist — nueve arreglos al motor, los presets y el proyecto

Pedido de Gonzalo, 2026-08-11. Documento vivo: se marca sobre él y sólo él lo
cierra. Cada ítem lleva **dónde vive** (motor / preset / proyecto), porque eso
decide quién lo puede tocar y con qué gate.

Proyecto de referencia: `~/Documents/Pulso/ACRD CONTA/V3_Conta 11-08 equivalencias.pulso`.

## Decisiones tomadas

| Pregunta | Respuesta |
|---|---|
| Reparto de colores | **Naranja `#CA5651`**: título de lámina, separadores de sección y Objetivo. **Azul `#081F5C`**: título del gráfico, ejes, etiquetas y leyenda. |
| A qué se aproxima `<1%` | A **0 %**, y que el switcher de ceros sea el que revele que hay algo detrás. |
| Sobre qué actúa el 0,5 % artificial | Sobre el **ancho de la barra**. La etiqueta sigue diciendo el valor real y el resto se recalcula para sumar 100 %. |

## Estado

| # | Arreglo | Dónde | Estado |
|---|---|---|---|
| 1 | Dicotómicos **sin Top 2 Box por defecto** | preset + registro | ☐ sin empezar |
| 2 | Paleta Sí/No de los **pies**: azul y celeste, no turquesa | preset | ☐ sin empezar |
| 3 | **4×4**: cada gráfico con su base **dentro del gráfico**, no en la lámina | motor + preset | ☐ sin empezar |
| 4 | **Objetivo**: el campo de texto sale invertido | motor | ☐ sin empezar |
| 5 | **Colores**: naranja lámina/sección/objetivo, azul gráfico/ejes/etiquetas/leyenda | motor + registro + proyecto | ◐ **parcial** |
| 6 | **Todos los porcentajes** por defecto; el umbral pasa a switcher apagado | motor + registro | ☐ sin empezar |
| 7 | Tablas del **radar nativas de PPT** | motor + **ADR** | ☐ bloqueado por decisión |
| 8 | Multiapiladas de pocos bloques: **truncar leyenda** antes que exagerar la separación | motor | ☐ sin empezar |
| 9 | **`<1%` → 0 %** y switcher de ceros con 0,5 % de ancho artificial | motor + registro | ☐ sin empezar |

## Lo que ya se sabe de cada uno

### 1 · Dicotómicos sin Top 2 Box
El motor **ya lo omite** en tiempo de render y lo avisa
(`.barra_extra_minimo = c(top2box = 3L, …)` en `graficador_barras_apiladas.R`):
sumar Sí+No da 100 % en todas las filas. Lo que falta es que sea un **default
declarado** en vez de un rescate con aviso — hoy el proyecto pide la columna,
el motor la quita y emite 13 avisos por mazo.

### 2 · Paleta de los pies
Hoy los pies dicotómicos salen turquesa + azul (láminas 9 y 10). Las barras
Sí/No sí usan azul marino + celeste. Hay que igualarlas.

### 3 · Base por gráfico en el 4×4
Hoy la lámina de perfil lleva **una** base al pie («Base: 178 egresados») y los
cuatro gráficos comparten denominador aunque no siempre coincida — se vio en la
lámina 11, cuyo pie dice «52 docentes y 15 administrativos» para cuatro
gráficos de públicos distintos. Cada gráfico debe declarar la suya.

### 4 · Objetivo invertido
Es el **E-2** del registro. El rótulo vertical «OBJETIVO» se lee de abajo hacia
arriba; en castellano debería girar al otro lado.

### 5 · Colores — parcial, con una vía sin localizar
Hecho y **verificado en la lámina 8**: «PERFIL DEL EGRESADO» en naranja y
«Sexo», «Año de egreso», «Rango de edades», «Máximo grado alcanzado» en azul.

Causa que había detrás: el título de lámina y el del gráfico **compartían
`color_titulo`**, así que tocar uno movía el otro. Se separó añadiendo
`color_titulo_slide` al registro (default naranja), dejando `color_titulo` para
el gráfico (default azul), y cortando la cadena de la lámina para que ya no
caiga en `color_titulo` (`reporte_plan_ppt.R:398-404`).

**Lo que falta**: el **separador de sección sigue saliendo azul**. No pasa por
esa cadena — comprobado declarando `color_titulo_slide = "#CA5651"` en el
proyecto y volviendo a renderizar: la lámina 12 sigue azul. Toma su color por
otra vía que aún no está localizada; `grep` de `prosecnur:section:title` sólo
devuelve el punto de `reporte_plan_ppt.R:371`, así que la vía real es otra.
**Es una regresión introducida hoy** (antes el separador era naranja porque
`color_titulo` lo era) y afecta a las 13 láminas separadoras.

### 6 · Todos los porcentajes por defecto
`umbral_etiqueta` existe en cuatro sitios con defaults distintos: `p_histograma`
0.04, preset `barras_apiladas` 0.01, `multi_apiladas` sin default,
`barras_agrupadas` 0.001, y el graficador 0.001. Con 0,1 % un 4 % debería
dibujarse, así que **el umbral no explica** las etiquetas ausentes de las
láminas 24 y 42: falta identificar qué las descarta antes de tocar nada.
Descartado ya: `.limitar_una_label_fuera_por_barra_apiladas` **reubica**, no
descarta.

### 7 · Tablas nativas del radar
Contradice el **ADR 0071** (formas, no charts nativos). Exige un ADR nuevo que
lo revierta, no cambiar el motor por debajo. Es decisión de arquitectura antes
que trabajo de código.

### 8 · Leyenda vs separación entre bloques
Relacionado con el hallazgo de que **cada bloque de una multilista es una unidad
configurable**: se renderiza con sus propios `overrides` y acepta `altura_rel`
(`reporte_plan_ppt.R:4607` y `:4748`). El reparto vertical sale de
`.multilista_block_height`, que suma filas + título + **leyenda**; ahí es donde
se paga la separación. Permitir que la leyenda encoja o se trunque baja ese
coste.

### 9 · `<1%` y el switcher de ceros
El `<1%` se escribe en `.pulso_fmt_pct_unidades()`
(`helpers_calc_comunes.R:313`): cuando el valor redondea a cero pero existe,
declara `<1%` en vez de mentir con `0%`. Pasa a **`0%`**.

El switcher de ceros es lo nuevo: cuando se enciende, una categoría en 0 %
recibe **0,5 % de ancho** para que su segmento sea visible, el resto se
recalcula para seguir sumando 100 %, y la etiqueta sigue diciendo el valor real.
Combina con mostrar la cuenta al lado, que es lo que explica por qué se ve algo
donde el porcentaje dice cero.

## Trampas vigentes

Las del registro (`registro-motor-graficos-2026-08-10.md` §8) siguen todas en
pie. Las dos que más pesan aquí:

- **El registro no es el motor.** `.PRESETS_META` alimenta la UI; los defaults
  con los que dibuja el motor están en `p_presets()` y en las formals del
  graficador. Cambiar un `default` del registro **no cambia el render**.
- **Persistir no es aplicar.** Un valor guardado en el `.pulso` y visible en
  pantalla no prueba nada sobre el entregable. La prueba es el render.
