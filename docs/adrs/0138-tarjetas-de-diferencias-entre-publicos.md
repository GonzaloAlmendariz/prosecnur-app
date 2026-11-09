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
   por par marcado («Docentes 78% frente a Estudiantes 64%: +14 pp ▲»), primero los del 99 % y luego por diferencia, con
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

## Revisión metodológica del 2026-11-09 (enmienda)

La revisión de las entregas 1 y 2 dio «aprobado con pendientes». Se corrigió lo siguiente:

- **P1, base de la z.** La z tomaba la suma de pesos de cada público como su n. Ahora el peso se lleva a media 1 sobre
  las respuestas válidas con peso positivo, dentro de cada público, sólo para la base de la z. El arreglo vive en
  `.sig_contrastes` (`unidad_pesos`), así que lo heredan todos los usos de la z (ver «Cambio de comportamiento»).
- **P2, regla propuesta.** Sin regla guardada, la regla entre públicos se propone sobre todas las bases y no sobre la
  activa: Rao-Scott con BH si alguna base trae el conglomerado. No depende del orden de las bases. Una regla guardada
  manda tal cual.
- **P3, p fuera de la familia.** Con la familia del plan, un p que no está en ella queda `fuera_de_familia`, no se marca
  y el tema lo dice.
- **P4, unidad de la familia.** La familia cuenta pares, no temas: la clave es el par de refs, los códigos del corte en
  cualquier orden y los filtros.
- **P5, línea del par.** «Docentes 78% frente a Estudiantes 64%: +14 pp ▲», con espacios duros que unen el público con su
  cifra y la diferencia con «pp ▲».
- **P6, pie.** El pie dice el nivel, el alcance de la corrección y qué es △:
  «Diferencias entre públicos (muestras independientes): prueba z, p < 0.05 con corrección de Bonferroni dentro de cada
  tema, al menos 10 puntos y 30 casos por público. △ Frágil: p ajustado entre 0.01 y 0.05.» Con BH dice «sobre las
  comparaciones entre públicos del informe», o «de esta lámina» si el informe no trae su familia.
- **P7, indicador.** El inspector dice qué se probó: el indicador de la meta, el `corte_etiqueta` del gráfico o los
  rótulos del corte («De acuerdo + totalmente de acuerdo»). El encabezado de la tarjeta lo nombra, como en el ADR 0129,
  sólo cuando el gráfico no lo muestra (sin `corte_etiqueta` no hay subtítulo) o cuando la meta lo declara.
- **P8, conciliación.** Si no se pueden leer las cifras del gráfico, el tema se abstiene con ese motivo. Una fila de la
  matriz con indicador compuesto se abstiene en el panorama con su propio motivo.
- **P9, cifras que se leen iguales.** Una marca cuyas cifras redondeadas coinciden (78.4% y 77.6% se leen 78% y 78%)
  baja a «bajo_umbral»: la tarjeta no escribe «+0 pp ▲».

Precisiones sobre lo decidido:

- **Grados de libertad (§2).** Se usa el mínimo del par (conglomerados menos estratos de cada público): es una cota
  conservadora. Satterthwaite queda pendiente.
- **Alcance de la corrección (§4).** Con `bonferroni_fila` la familia es el tema (los pares de públicos de ese tema). Con
  `bh_informe` es el conjunto de comparaciones entre públicos del plan, o las de la lámina si el contexto no trae familia.
- **Conglomerado.** La columna de la regla se aplica por nombre en cada base que la tiene. Las que no la tienen entran
  como muestreo aleatorio simple.
- **Denominador.** Las respuestas válidas de cada público, incluidas «Sin información» y «No sabe» cuando son respuestas
  registradas. «Base:» muestra las filas de cada base, no las válidas.

## Cambio de comportamiento (P1)

En proyectos ponderados cuyos pesos no promedian 1 sobre las respuestas válidas, la prueba z da otros p y puede poner o
quitar marcas. Afecta a todo lo que prueba con z por `.sig_evaluar` y `.sig_contrastes`: las tarjetas entre públicos, las
tarjetas de una base (ADR 0129), las letras de las láminas, la serie, las líneas por nivel y los cruces del reporte con z.
Sin pesos, o con pesos de media 1 exacta sobre los válidos, nada cambia. La proporción dibujada y la conciliación no
cambian, porque normalizar no mueve una proporción ponderada. Rao-Scott no cambia (es invariante a la escala del peso).
El deff que informa Rao-Scott ahora se mide contra la varianza simple con pesos de media 1 y deja de crecer con la escala
de los pesos. Ninguno de los cinco proyectos de referencia lleva pesos.

En la sonda de la revisión (pesos U(0.4, 2.5) en tres públicos) la z daba p = 4.4e-05, 0.050 y 4.9e-07. Ahora da
6.3e-04, 0.106 y 3.3e-05, y los mismos con los pesos de un público multiplicados por 100 (antes 5.9e-130). Test:
`api/tests/testthat/test-graficos-significancia-pesos-escala.R`.

El mismo criterio alcanza a la tabla de cruces clásica, que no pasa por `.sig_evaluar`: `comparar_columnas_sig` recibía
la base ponderada de `nN_para_sig_simple` y la tomaba como n. Ahora `.sig_nN_media_uno` lleva los conteos de la tabla a
pesos de media 1 sobre sus respuestas válidas con peso positivo antes de la prueba, en las letras z del XLSX de cruces
sin regla del estudio (`.cruces_sig_comparar`), en la serie por niveles sin regla (`.graficos_sig_calcular` con
`n_casos`) y en el comparativo armonizado (`.armz_letras`). Los porcentajes de la tabla no cambian. Las agrupadas y
apiladas sin microdatos no conocen sus casos y conservan la base que dibujan. En el caso 2×2 del test (55% frente a 40%,
60 casos por columna, A pesa 2 y B pesa 1) la z daba p = 0.058 y ahora 0.121; con pesos ×100 iguales daba 8.1e-61 y
ahora 0.0999, lo mismo que sin pesos. Test: `api/tests/testthat/test-reporte-cruces-pesos-escala.R`.

## Supuestos

- Los públicos son muestras disjuntas: nadie respondió en dos bases.
- La diferencia mide público más contexto del instrumento; la equivalencia declarada es responsabilidad del analista.
- En una base sin conglomerado se asume muestreo aleatorio simple sin corrección por población finita.

## Consecuencias

- La brecha descriptiva del contraste de públicos queda acompañada por una prueba; la nota aclara que la brecha es
  descriptiva y la marca es la prueba.
- Se bloquea para las tarjetas el emparejado por nombre que hoy hace `p_dumbbell` con `base$*`.
- Tamaño: mediano con el contraste de dos públicos; grande con radar, panorama, PPT, Word y la interfaz.
