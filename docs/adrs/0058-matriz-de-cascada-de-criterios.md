# ADR 0058 — La matriz de criterios cuenta cómo llegamos al marco

- **Estado**: aceptada
- **Fecha**: 2026-08-03
- **Contexto previo**: ADR 0057 (la tarjeta de categoría es la unidad de decisión), `docs/qa/goal-loop-matriz-criterios-2026-08-03.md`

## Contexto

Al cerrar el diseño de la tarjeta de categoría, Gonzalo pidió la superficie que
va **después** de los criterios:

> «La matriz de criterios tiene que hablar de la historia de forma al revés.
> Tiene que mostrarnos el detalle de cada facultad y hacia abajo con cuántos
> cursos-horario finalmente nos quedamos. Los criterios no hablan de cuántos
> casos agregamos, sino de cuántos quitamos.»

El módulo ya tenía **dos** piezas cerca de eso, y ninguna lo era:

- `calc_muestra_aulas_matriz_embudo` — matriz **marginal**: cada celda quita la
  regla completa sólo para su facultad y vuelve a medir. Su docblock lo dice:
  «no agrega deltas de filas ni de segmentos», así que su fila Total **no es la
  suma** de las facultades. Responde «¿qué recuperaría si quito esta regla?».
- `calc_muestra_aulas_criterios_cascada` — la cascada real, por **paso ×
  facultad**, con `before_ch`, `after_ch` y `excluded_ch`. El dato correcto,
  presentado como una lista de pasos filtrada a una facultad.

## Decisión

**La matriz de criterios es la transposición de la cascada: facultades en filas,
criterios en columnas, y cada celda lo que ese criterio quitó en esa facultad.**

No se calcula nada nuevo. El contrato
`calc_muestra_aulas_criterios_cascada_v1` ya publica exactamente lo que la
matriz necesita; lo que faltaba era la superficie.

Cuatro propiedades que la definen:

1. **Cada celda es una resta, no un aporte.** `excluded_ch` de ese paso en esa
   facultad. Un criterio no añade cursos-horario: los quita.
2. **La fila cierra en lo que queda.** Universo de la facultad menos todos sus
   recortes, con su porcentaje de supervivencia.
3. **La última fila suma las facultades**, y donde se cruza con la última
   columna están los **cursos-horario elegibles**. Es la diferencia con la
   matriz marginal, cuyo total se recalcula y no suma.
4. **El orden de las columnas es el del embudo**, fijado por ADR 0057
   (matriculados primero; mínimo y composición al final). No se reordena:
   reordenar cambia los recortes, porque dos criterios que se solapan quitan
   distinto según cuál va antes.

### El estado del embudo es de la celda

La regla 1 del ADR 0057 —**no existe el criterio general**— gobierna también
esta superficie. Un criterio en edición lo está **en una facultad**, así que:

- se resalta la **celda**, nunca la columna;
- «en espera» afecta sólo a los criterios **posteriores de esa misma fila**: el
  embudo de las demás facultades no se ha movido.

Repartir por columna pondría en duda las filas que nadie tocó.

### La confirmación abre la cascada

Confirmar un criterio es lo que permite recalcular los siguientes: mientras uno
está a medio ajustar, los posteriores no saben sobre qué marco actúan. Sus
cifras siguen en pantalla —son las de antes del cambio— y presentarlas con la
misma firmeza que las confirmadas sería mentir con un número viejo. Por eso el
estado no es «guardado / sin guardar» sino **hasta dónde llega lo que se puede
creer**.

El realce que marca lo recalculado entra **sólo por color y opacidad**. Nada que
codifique un valor se anima con `transform` (ADR 0057, patrón 12).

## Consecuencias

**A favor**

- La procedencia del marco queda visible: de dónde salieron los elegibles.
- Casos como «el mínimo se lleva 36 de los 45 cursos-horario de Gastronomía» se
  ven en una fila; ninguna tarjeta suelta los enseña, porque cada tarjeta mira
  un criterio y aquí lo que pesa es el acumulado.
- No hay dato nuevo que mantener: el contrato ya existía.

**En contra, y asumido**

- Con muchas facultades y muchos criterios la tabla es ancha. Se acepta con
  scroll horizontal propio (No Scroll Jail); la alternativa —recortar columnas—
  escondería criterios, que es lo que este módulo lleva un loop entero evitando.

**Invalidado**

- La matriz marginal como lectura principal. Sigue siendo válida para
  sensibilidad y se conserva, pero no es «la matriz de criterios».

## Pendiente

- **La celda en cero no distingue dos cosas**: un criterio que corrió y no quitó
  nada, y un criterio que esa facultad no aplica. Hoy se ven igual.


## Errores del goal, y cómo se previenen

Igual que en el ADR 0057, cada patrón trae el mecanismo que hoy lo impide, y ese
mecanismo es la parte vinculante.

### 1 · Un guard que se compara consigo mismo siempre cuadra

La matriz sumaba 2.806 cursos-horario cuando el KPI de la cabecera decía 2.799.
`cuadraConElMotor` existía justo para cazar eso y no lo cazó: comparaba el total
de la matriz contra el total de la **cascada ya filtrada por el mismo criterio**
que producía el error. Un guard que aplica la misma transformación que juzga no
juzga nada.

**Mecanismo**: la referencia de un guard viene de fuera de lo que valida. Aquí,
del último paso publicado sin filtrar; en la superficie, del KPI que el usuario
ya está viendo.

### 2 · Un filtro puede cortar la historia un paso antes del final

Descartar los pasos `gate = false` era defendible en abstracto —están fuera del
denominador— y rompía la única promesa de la superficie: contar **de dónde salen
los cursos-horario elegibles**. Las exclusiones manuales quitan cursos de verdad;
sin ellas la matriz aterrizaba en un número que no era el resultado.

**Mecanismo**: una superficie que promete explicar un total termina **en ese
total**. Lo que no encaje en su vocabulario se marca —aquí, columna operativa
con filete y rótulo en cursiva—, pero no se descarta.

### 3 · Replicar un orden que el motor ya decide fabrica un segundo orden

`ordenCriteriosEmbudo` era una lista escrita a mano con el orden del ADR. Los
criterios de estudiante, que en la cascada van **primero**, quedaban al final, y
el confirmador anunciaba «11 criterios quedan en espera» sobre un orden que no es
el que se aplica. Medido tras leerlo del motor: **5**.

**Mecanismo**: cuando el motor publica un orden (`order_source: "motor_r"`), se
lee. La lista del ADR queda de respaldo para cuando ese dato no está, no como
fuente paralela.

### 4 · Dos unidades en un mismo eje se ven iguales

Cinco de catorce columnas eran criterios de **estudiante**: filtran alumnos y
sólo quitan un curso-horario cuando lo vacían. Todas publican `excluded_ch`, así
que la celda medía lo mismo y nada delataba la mezcla.

**Mecanismo**: el eje declara **qué filtra** cada tramo con una fila de grupos.
No se resuelve escondiendo columnas — cinco ceros agrupados dicen algo («ninguno
vació un curso»); cinco ceros sueltos son ruido.

### 5 · El realce del embudo marca lo que cambió, no lo que se está tocando

Encender el realce en la celda en edición anunciaría un cambio que todavía no
ocurrió: confirmar un criterio no mueve ninguna cifra hasta que el marco se
reconstruye.

**Mecanismo**: el realce compara el valor con el del render anterior. El primer
render no cuenta —si contara, la matriz entera parpadearía al abrir y el realce
dejaría de significar «esto se movió»— y sólo entra por color y opacidad
(patrón 12 del ADR 0057).
