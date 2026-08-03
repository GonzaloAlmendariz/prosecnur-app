# GOAL · La matriz de criterios cuenta cómo llegamos al marco

- **Abierto**: 2026-08-03 · **Cierra**: sólo Gonzalo
- **Alcance**: 12–15 iteraciones (G1…), no una lista lineal
- **Contexto**: ADR 0057 (la tarjeta de categoría), hojas de revisión F111–F122

## Qué se pide

> «La matriz de criterios tiene que hablar de la historia de forma al revés.
> Tiene que mostrarnos el detalle de cada facultad y hacia abajo con cuántos
> cursos-horario finalmente nos quedamos. Los criterios no hablan de cuántos
> casos agregamos, sino de cuántos quitamos: cómo pasamos de un corte universal
> de cursos-horario y, conformando cada criterio, vamos quitando más. Al final,
> con cuántos nos quedamos por facultad. Eso se suma la columna final con la
> fila final y nos da los cursos-horario elegibles.»

Y con ella: el nivelador en umbral y rango, la **confirmación por criterio**, y
el **embudo vivo animado** — al confirmar, los siguientes recalculan.

## El hallazgo que ordena el goal

**La matriz ya existe y responde otra pregunta.**
`calc_muestra_aulas_matriz_embudo` es **marginal**: cada celda quita la regla
completa sólo para su facultad y vuelve a medir. Su propio docblock lo dice —
«no agrega deltas de filas ni de segmentos»—, así que su fila Total **no es la
suma** de las facultades.

| | marginal (hoy) | cascada (lo pedido) |
|---|---|---|
| pregunta | ¿qué recuperaría si quito esta regla? | ¿cómo llegamos hasta aquí? |
| celda | CH que volverían | CH que este criterio quita |
| fila Total | se recalcula sobre todo el marco | **suma de las facultades** |
| uso | sensibilidad | procedencia |

Las dos son legítimas. La que Gonzalo pide es la segunda, y es la que falta.

## Reglas del goal

1. **Cada iteración cierra con gate.** Typecheck si hay TS, testthat si hay R,
   comprobación visual si hay UI. Nada se declara sin evidencia.
2. **Cada regla nueva nace con guard**, y el guard se prueba por mutación.
3. **La regla 1 del ADR 0057 manda**: no existe el criterio general. Todo estado
   del embudo es de una celda (facultad × criterio), nunca de una columna.
4. **Nada que codifique un valor se anima con `transform`** (patrón 12).
5. La estética es la que ya acordamos en F111–F122. Mejorar, no reinventar.

## Bitácora

