# ADR 0101 — La matriz de equivalencias sólo declara equivalencias

- **Estado**: Propuesto — decisión de Gonzalo del 2026-10-14; falta ratificar este texto
- **Ámbito**: Carga › Equivalencias entre públicos y Gráficos (plan del informe)
- **Fecha**: 2026-10-14
- **Implementación**: Pendiente — piezas E1 a E6 (abajo). Seguimiento en
  `docs/qa/checklist-matriz-equivalencias-pura-2026-10-14.md`
- **Relación**: enmienda [ADR 0062](0062-matriz-de-equivalencias-entre-publicos.md) (quita de la forma plana la
  columna `diapositiva`; su decisión —la equivalencia se declara, no se adivina— queda entera),
  [ADR 0063](0063-el-mazo-se-deriva-de-la-declaracion.md) (el mazo comparativo ya no se deriva de la matriz) y
  [ADR 0064](0064-el-enunciado-vive-en-la-diapositiva.md) (el enunciado, el gráfico, el corte y el estilo dejan
  la matriz y pasan a la lámina, en Gráficos).

## Contexto

La matriz de equivalencias nació para decir qué pregunta de un público equivale a cuál de otro (ADR 0062). Con
los ADR 0063 y 0064 fue acumulando decisiones que no son de equivalencia sino del informe: a qué **diapositiva**
va cada pregunta, el **enunciado** de esa diapositiva, el **gráfico** («radar» o barras), el **corte** del
indicador y el **estilo** del radar. El plan consolidado arma su bloque comparativo con esas columnas
(`.graficos_plan_desde_equivalencias`, `graficos_plan_consolidado.R`).

Gonzalo, 2026-10-14: «la matriz de equivalencia no debería decir ni el tipo de gráfico ni la lámina en la que va o
diapositiva, es solo una matriz de equivalencias». Y sobre el plan: «el plan sugerido se va a ir o tengo intenciones
de que se vaya porque siento que el analista tiene que detenerse a pensar en cómo hacer sus diapositivas y no
dárselo todo en la mano». Con una salvedad: «para el caso de los PPT de ACNUR sí es necesario en apariencia o algo
tener sus configuraciones activables, porque un PPT de ACNUR es bastante diferente a uno de PULSO por defecto».

## Decisión

1. **La matriz declara equivalencias y nada más**: la `etiqueta_estandar`, la variable de cada público y la
   `seccion` (que agrupa preguntas para leer la matriz, no láminas). Salen de la matriz `diapositiva`,
   `enunciado`, `grafico`, `corte` y `estilo`.
2. **Las láminas se arman en Gráficos.** Qué preguntas van juntas, con qué gráfico, qué corte y qué enunciado se
   decide al armar cada lámina; la matriz es la fuente de qué preguntas son equivalentes (los selectores de
   «Públicos por tema», el radar y la brecha entre públicos, y la serie temporal la siguen leyendo).
3. **El bloque comparativo del plan consolidado ya no se deriva de la matriz.** El informe compartido parte de lo
   que el analista arma.
4. **Lo que llega en un Excel con esas columnas no se descarta en silencio**: la importación las ignora y lo
   avisa con cuántas filas traían cada una. Un `.pulso` que ya las tiene las conserva sin usarlas hasta la próxima
   escritura de la matriz, que ya no las escribe; los planes que ya se generaron con ellas quedan como están.
5. **ACNUR conserva sus configuraciones activables** (perfil `acnur_kobo_cruncher_plus`: apariencia, composición y
   su plan propio). Este ADR no toca el plan sugerido en general: retirarlo es otra decisión, con su propio ADR,
   y cuando ocurra lo de ACNUR sigue siendo activable.

## Consecuencias

- La matriz es más corta de leer y de llenar: deja de mezclar dos trabajos (equivalencia e informe).
- Quien usaba la matriz para armar el mazo de Acreditación (133 de 154 filas asignadas a 44 diapositivas en
  Contabilidad) lo arma ahora en Gráficos. Es el cambio buscado: pensar cada lámina.
- `.graficos_plan_desde_equivalencias` y la vista de reparto en diapositivas (`EquivalenciasDiapositivas.tsx`) se
  retiran; el borrado va respaldado por este ADR (regla de borrados de CLAUDE.md).

## Piezas

| # | Pieza |
|---|---|
| E1 | Modelo: la forma plana y su lectura/escritura sin `diapositiva`, `enunciado`, `grafico`, `corte`, `estilo` (`equivalencias_publicos.R`) |
| E2 | Importación de Excel: ignora esas columnas y avisa cuántas filas traían cada una (`router_equivalencias.R`) |
| E3 | Plan consolidado sin bloque derivado de la matriz; retiro de `.graficos_plan_desde_equivalencias` |
| E4 | Front: la matriz sin columnas de lámina ni gráfico; retiro de `EquivalenciasDiapositivas.tsx` |
| E5 | Los selectores de Gráficos que leen equivalencias siguen funcionando (públicos por tema, radar, brecha, serie) |
| E6 | ACNUR: su perfil y su plan propio siguen activables (prueba que lo fija) |

## Cumplimiento

Lo verifican las pruebas de cada pieza (E1–E6) y el seguimiento en
`docs/qa/checklist-matriz-equivalencias-pura-2026-10-14.md`.

## Notas

Este ADR no retira el plan sugerido en general; esa decisión, si llega, va en otro ADR y conserva lo de ACNUR.
