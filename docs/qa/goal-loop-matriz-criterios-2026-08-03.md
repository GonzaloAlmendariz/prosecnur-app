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


### G4 — El componente, con la estética acordada

Facultades en filas, criterios en columnas, cada celda una **resta**. La última
fila suma y es la respuesta. El nombre de la facultad es `sticky`: al llegar a la
última columna hay que seguir sabiendo de qué fila es la cifra.

Resuelta la duda que quedaba abierta del mockup: **la celda en cero distingue
dos cosas** que sin marca se ven igual — un criterio que corrió y no quitó nada
(punto medio) y uno que esa facultad no aplica (guion).

### G5 — Montada después de los criterios

Va tras los bloques de facultad, como pediste: primero se decide en una facultad,
luego se mira el acumulado. **No duplica el Panorama de arriba**: aquél es
marginal —qué recuperaría si quito una regla— y sirve para elegir en qué facultad
entrar; ésta es la procedencia.

### G6 — La matriz destapó una inconsistencia de 7 cursos-horario

Medido en la app con datos reales: la matriz sumaba **2.806** y el KPI de la
cabecera decía **2.799**.

No era el motor: era **mi filtro**. Las exclusiones manuales viajan en la cascada
con `gate = false` porque no son un criterio metodológico, y al descartarlas la
matriz **aterrizaba en un número que no eran los elegibles** — prometía contar de
dónde salen y paraba un paso antes, dejando siete sin explicar.

`cuadraConElMotor` tampoco lo cazó, porque comparaba contra el total de la propia
cascada filtrada. Un guard que se compara consigo mismo siempre cuadra.

### G7 — Los pasos operativos entran, marcados

Siguen sin ser criterios, así que no se mezclan: filete de separación y rótulo en
cursiva. Lo que no pueden es faltar.

| medida | antes | después |
|---|---:|---:|
| Total de la matriz | 2.806 | **2.799** |
| Coincide con el KPI de elegibles | no | **sí** |
| Columnas operativas declaradas | 0 | **1** |

**Pendiente detectado**: de 14 columnas, **12 no recortan nada en ninguna
facultad**, y cinco de ellas son criterios de estudiante —Formación, Condición de
matrícula, Edad, Facultad, Ciclo— que filtran alumnos, no cursos-horario. Su
`excluded_ch` sólo deja de ser cero cuando vacían un curso entero. Doce columnas
de puntos son ruido, y mezclar dos unidades en un mismo eje es un problema de
fondo, no de densidad.
