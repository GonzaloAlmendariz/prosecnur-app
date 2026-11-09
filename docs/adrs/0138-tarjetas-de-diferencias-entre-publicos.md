# ADR 0138: tarjetas de diferencias entre públicos

Estado: Aceptado (Gonzalo, 2026-11-09: «sí», a construir las tarjetas de diferencias entre públicos)
Fecha: 2026-11-09
Autoridad: Gonzalo: «¿Pero no hay forma de mostrar diferencia entre públicos de la misma forma que ahora se hacen las
tarjetas de diferencia significativa?». Revisión metodológica de viabilidad del 2026-11-08 (viable con condiciones).
Enmienda: ADR 0137 decisión 2 (la app ya no queda sin prueba entre públicos), ADR 0129 (las tarjetas cubren también
públicos) y cierra el pendiente del ADR 0127 §6 (modo entre bases).

## Contexto

El ADR 0137 retiró la tabla de letras `p_significancia_publicos`, que comparaba el mismo tema entre públicos con una
prueba z calculada fuera de la regla del estudio. Las tarjetas del ADR 0129 comparan grupos de un cruce dentro de una
base. La revisión metodológica mostró que la regla del estudio (ADR 0128) ya puede comparar bases si cada público se
trata como estrato propio con sus conglomerados anidados: con z y Bonferroni por fila reproduce exactamente los p de la
tabla retirada, y además aplica el umbral en puntos, la marca «frágil», la base mínima por público y Rao-Scott.

## Decisión

1. **Una tarjeta entre públicos** con el mismo lenguaje visual de las tarjetas del ADR 0129, activada en la meta de la
   lámina (`meta.tarjetas_diferencias.entre_publicos`).
2. **Muestras independientes.** Cada público es un estrato; los conglomerados se toman de la columna de la regla si la
   base la trae, prefijados con el nombre de la base. Pesos de cada base. Grados de libertad: el mínimo del par o
   Satterthwaite.
3. **Pares, no «frente al resto».** Con dos públicos la tarjeta es idéntica a la de dos grupos. Con tres o más, una línea
   por par marcado («Docentes 78 % frente a Estudiantes 64 %: +14 pp ▲»), primero los del 99 % y luego por diferencia, con
   tope de cuatro. Sin fila Total: un total entre públicos exigiría padrones.
4. **Familia propia.** Con `bh_informe`, las comparaciones entre públicos forman su propia familia sobre todos los temas
   emparejados con escala comparable. Nunca se mezclan con la familia de una base.
5. **Sólo temas con equivalencia declarada** (matriz de equivalencias o par confirmado en el emparejado), nunca por nombre
   de variable. Escalas de tema distinto (acuerdo frente a satisfacción) se abstienen con «escalas distintas, no se
   compara». El Top Two Box se resuelve con los códigos de cada base por posición.
6. **Abstención honesta.** Un público bajo la base mínima, un denominador cero, un filtro sobre una columna ausente en una
   base, una base repeat, o cifras de la prueba que no cuadran con el gráfico: la tarjeta se abstiene y dice por qué.
7. **Láminas donde aplica:** contraste de públicos (`p_dumbbell` con dos bases), `p_radar` por públicos, `p_panorama` en
   sus temas emparejados, y agrupadas o multiapiladas cuando cada fila es el mismo tema emparejado. No aplica a
   divergentes multibase ni a `p_dumbbell` con cruce.
8. Del código retirado sólo se reusan la declaración de temas, el intervalo de Newcombe como dato informativo del
   inspector y los textos de pares. La z reimplementada, las letras y los conteos por la fila Total no vuelven.

Pie de la tarjeta: «Diferencias entre públicos (muestras independientes): {prueba}, {corrección}, al menos {umbral}
puntos y {base_minima} casos por público.»

## Implementación (2026-11-09)

- Entrega 1 (7630fd55e): contraste de públicos, PPT y Word. Entrega 2 (ee732707e): radar por públicos y panorama en sus
  temas emparejados (sólo filas confirmadas de la matriz; sin matriz, el panorama va sin tarjetas y lo dice).
- El radar de cinco criterios o más con tarjetas cede su tabla del costado al panel de tarjetas y lo avisa: no caben las
  dos.
- Pendiente: agrupadas y multiapiladas cuando cada fila es el mismo tema emparejado; la activación en el inspector.

## Supuestos

- Los públicos son muestras disjuntas: nadie respondió en dos bases.
- La diferencia mide público más contexto del instrumento; la equivalencia declarada es responsabilidad del analista.
- En una base sin conglomerado se asume muestreo aleatorio simple sin corrección por población finita.

## Consecuencias

- La brecha descriptiva del contraste de públicos queda acompañada por una prueba; la nota aclara que la brecha es
  descriptiva y la marca es la prueba.
- Se bloquea para las tarjetas el emparejado por nombre que hoy hace `p_dumbbell` con `base$*`.
- Tamaño: mediano con el contraste de dos públicos; grande con radar, panorama, PPT, Word y la interfaz.
