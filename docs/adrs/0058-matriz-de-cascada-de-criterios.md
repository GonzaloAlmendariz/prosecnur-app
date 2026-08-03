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
