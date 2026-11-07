# ADR 0129: Tarjetas de diferencias junto al gráfico del total

Estado: Aceptado (Gonzalo, 2026-11-03: formato P08 aprobado para PPT y Word; 2026-11-04: «solo p» para los dos niveles y el p de nivel frente al resto se ajusta contra la familia del informe sin agregarlo)

Fecha: 2026-11-04

Extiende: [ADR 0128](0128-una-regla-de-diferencias-por-estudio.md) (D7, «frente al resto», y la familia de BH del informe).

Diseño: `docs/qa/maqueta-total-con-diferencias-2026-11-03/propuesta.md` (§5, versiones 5 y 6). Las imágenes con datos de CCSS no se versionan: viven en la carpeta del estudio.

## Contexto

Las diferencias entre grupos se mostraban en láminas de cruce aparte: una lámina por cruce, con letras ▲A por pares. Gonzalo aprobó otro formato para el informe: el gráfico del total con, a su lado (PPT) o debajo (Word), solo las diferencias significativas de cada grupo frente al resto. Ese formato es el patrón de Ipsos y de Pew.

## Decisión

### 1. Una opción de la lámina, no un graficador

Una lámina de total (`p_slide_1_grafico` sin cruce, con un gráfico de categorías o una batería de escala) pide tarjetas con `payload.meta.tarjetas_diferencias`:

```json
{ "activo": true, "max": 6, "cruces": ["area", "nivel_curricular"],
  "rotulos": { "area": "Área" }, "cortos": { "Economía y Finanzas": "Econ. y Finanzas" }, "publico": "estudiantes" }
```

- `true` equivale a `{ "activo": true }`.
- Los cruces por defecto son los que el estudio declara en Analítica (`cruces_vars` de la raíz; si está vacía, los de la tabla de cruces).
- `rotulos` nombra cada cruce; si falta, se usa la etiqueta del instrumento.
- `cortos` acorta los rótulos de grupo.
- `publico` nombra a quienes respondieron en la lectura.

`meta` ya conserva las claves que no conoce (`graficos_slide_meta.R`). Por eso no cambia el esquema del plan ni las listas blancas de `graficos_config`.

### 2. Qué genera una tarjeta

Cada diferencia de un grupo **frente al resto** se prueba con la misma evaluación de la regla del estudio (`.sig_evaluar` + `.sig_veredictos`), forzada a `max_letras = 1`. Es la misma regla de la lámina y de la tabla: Rao-Scott por aula, al menos 10 puntos, 30 casos y 8 conglomerados por grupo.

- **Familia.** Con dos grupos, la prueba frente al resto es la del par, que ya está en la familia de BH del informe, y su p ajustado es exacto. Con más grupos (nivel), la prueba frente al resto **no entra a la familia**: su p se ajusta contra ella por interpolación monótona, como las láminas filtradas del ADR 0128. Así ninguna letra ya generada cambia.
- **Dos niveles, solo por p.** Si el p ajustado es menor que 0.01, la tarjeta lleva borde continuo y ▲▼. Si está entre 0.01 y alfa, lleva borde punteado y △▽. No se suma el criterio de 12 puntos de «Historias del informe».
- **Unidad de tarjeta:**
  - en una múltiple o una batería, una tarjeta por (opción o ítem, cruce); en la batería se prueba el *top two box*;
  - en una dicotómica, solo la opción principal;
  - en una nominal u ordinal, una por cruce con la categoría de mayor diferencia, y otra categoría solo si trae un grupo que aún no aparece.
- **Grupos que se muestran.** Con dos grupos se muestran los dos con ▲ y ▼. Con más, solo los que difieren. La primera fila de la tarjeta es el total, en gris, con la cifra del gráfico.
- **Orden y tope.** Primero las del 99% y después de mayor a menor diferencia. Se dibujan las 4 primeras y las demás no. La maqueta decía 6; Gonzalo lo bajó en la revisión del PPT v7 porque, con el nombre del grupo sobre su barra, las tarjetas son más altas.

### 3. Salidas

- **PPT.** El total lo compone el motor nativo de siempre (`.lam_slide_1_nativa`), con su estándar, en el ancho que deja el panel: `prosecnur.lam_reserva_derecha` acota la geometría de `.std_geom` (revisión v7 RV: el total redibujado a mano no seguía los estándares). Después se agrega el panel (`lamina_tarjetas_diferencias.R`):
  - el título es la pregunta y no hay subtítulo;
  - el panel ocupa el 20 % del ancho útil con una columna y el 30 % con dos; si las tarjetas no caben en alto, vuelven los anchos de la maqueta (1/3 y 1/2);
  - el nombre del grupo, completo, va encima de su barra;
  - en una batería, la tarjeta no repite la premisa: se ubica a la altura de su fila, con una línea guía desde el Top Two Box; si la escala se parte, cada tarjeta va en la lámina de su premisa;
  - con panel, la escala acota su columna de premisas al 30 % (la barra, al menos al 45 %), conserva la distancia de la barra al Top Two Box y su leyenda corre a todo el ancho;
  - no hay nota de significancia: solo base y fuente;
  - sin diferencias, la lámina sigue su camino de siempre.
- **Word.** Las tarjetas van bajo la imagen del total, dentro de la misma figura (`reporte_word_tarjetas.R`):
  - es la misma tarjeta, dibujada con `grid` a 0.8;
  - una tarjeta ocupa todo el ancho y dos van a la mitad; con número impar, la principal va sola;
  - el total de barras se compacta para que total y tarjetas quepan en una página.
- **Lectura.** Se explica una sola vez (`graficos_tarjetas_lectura.R`):
  - en el PPT, la lámina del plan titulada «Cómo leer las diferencias entre grupos» pasa a la composición nativa aprobada, con una tarjeta real del informe ampliada;
  - en el Word, el capítulo «Cómo leer este informe» suma «Pautas para la lectura del informe» en prosa.

### 4. Enganches sin crecer `reporte_plan_ppt.R`

- `.lam_con_sig_en_lamina` calcula las tarjetas y las adjunta a `attr(p, "pulso_tarjetas")`. Lo hace con la lámina y `.resolve_ref` del entorno del motor, igual que `.sig_fuente_render`.
- `.lam_citas_aplica`/`.lam_citas_slide_1_nativa` desvían la lámina hacia la composición con tarjetas.
- `.word_publico_marcar` y un registro por firma de filas llevan las tarjetas a la figura del Word.
- `.nresp_colocar` reemplaza la lámina de texto de lectura.
- `.sig_informe_preparar` deja la base para la tarjeta de ejemplo.

### 5. Extensión: todos los grupos con `todas` (2026-11-04, ítem 23 de la v7 RV)

Gonzalo pidió ver las diferencias entre las variables de corte principales aunque no sean significativas. La lámina «¿Cómo consideras que es la calidad de la educación en la Facultad?» no tenía ninguna.

- **Opción.** `meta.tarjetas_diferencias.todas = true`, apagada por defecto. Sin ella todo sigue igual.
- **Unidad.** Una tarjeta por cruce declarado, en el orden de los cruces, aunque ninguna diferencia sea significativa. En una batería va una por ítem y cruce. En una opción única la fila es la de mayor diferencia significativa y, sin ninguna, la categoría que más se aleja del total en un grupo comparable. El tope de 4 tarjetas sigue: con los cuatro cruces de CCSS caben justo.
- **Grupos.** Cada tarjeta muestra el total y todos los grupos comparables del cruce, con su cifra. La flecha y el nivel van solo donde la regla los da. Los demás grupos van sin flecha, con barra neutra (`tarjeta_barra_neutra`) y cifra sin negrita.
- **No comparables.** Los grupos que no se comparan por base o por conglomerados no se muestran. Una cifra sin prueba al lado de las probadas se leería como «sin diferencia», que es justo lo que no se sabe. Una tarjeta sin ninguna diferencia lleva el borde de la de 99% y se llama `tarjeta:sin_diferencias`.
- **Frase.** La base de la lámina (PPT) y el pie de las tarjetas (Word) dicen «Se muestran todos los grupos con base suficiente; la flecha marca solo las diferencias significativas.» La lámina de lectura no elige como ejemplo una tarjeta sin flechas.
- **La fila no repite el título.** Si la fila de la tarjeta es el título de la lámina (una batería de un solo ítem), la tarjeta no la repite. Esto vale también sin `todas`.
- **Columna con llave.** En el PPT, una batería de un solo ítem con Top Two Box y tarjetas no va en barra horizontal. Va en una columna apilada vertical, con el nombre de cada categoría a su izquierda y una llave que abarca las de la caja y rotula «TOP TWO BOX» con su cifra (`api/R/lamina_columna_llave.R`). Las tarjetas ocupan la mitad derecha (panel estándar). Gonzalo eligió esta excepción frente a las barras agrupadas.
- **Word.** El Word dibuja esa batería con la fila vacía. Su figura se reconoce además por la firma de fila vacía, que vale solo para la lámina en curso.

### 6. Extensión: tarjetas por gráfico en una lámina de dos gráficos (2026-11-04)

Las tarjetas solo se enganchaban a `p_slide_1_grafico`. Al combinar dos preguntas en `p_slide_2_graficos` se perdían: «¿Cómo solventas tus estudios?» junto al tipo de colegio (ítem 8 de Gonzalo) y las combinaciones de la maqueta de estilos. La referencia es la maqueta «Composición y línea por nivel» (2026-11-04), `07_combinada_transporte_y_tiempo`.

- **Opción.** Es un mapa por ranura en la meta de la lámina: `meta.tarjetas_diferencias = {izquierda: {...} | true, derecha: {...} | true}`. Cada valor es la opción de siempre, incluida `todas`. Una ranura ausente o en `false` va sin tarjetas. Se eligió la meta de la lámina, y no la de cada ranura, porque la meta es de la lámina en todo el plan y `payload.izquierda` es un graficador. Un mapa no cuenta como opción de una lámina de un gráfico (`.tarjetas_opcion` lo ignora).
- **Tope.** Hasta 2 tarjetas por gráfico, elegidas y ordenadas con las mismas reglas.
- **Disposición (PPT).** Cada gráfico arriba en su mitad, un filete y, debajo, sus tarjetas lado a lado dentro de la misma mitad. La mitad sin diferencias no lleva nota ni filete (ítem 18 de la v7 RV: «quedamos en que no se pone»). Su gráfico usa todo el alto de su mitad (ítem 11 de la v7.11 RV: «que uno tenga tarjetas no significa que el otro no pueda usar todo su alto»; revierte la alineación que fijó la primera versión). Si ninguna mitad tiene tarjetas, la lámina sale como siempre, sin franja. La lámina conserva su base y su pie, uno por lámina. Solo el panel con tarjetas se acorta lo que mide la franja (`prosecnur.lam_reserva_inferior`, una por mitad, que lee `.lam_mixta_geo("graficos_2")`).
- **Tarjeta compacta.** Bajo un gráfico la tarjeta lleva el nombre a la izquierda de su barra, con el corto declarado (`cortos`), como en la maqueta. Con el nombre encima medía casi 3 in y el gráfico no cabía.
- **El gráfico se adapta.** Con la franja, los paneles pueden bajar el rótulo hasta 10 pt (`perfil.rotulo_pt_con_tarjetas`) y ensanchar su columna hasta el 55 % del panel.
- **Si no caben.** Si un gráfico no cabe en piezas nativas sobre la franja, la lámina sale sin tarjetas, como siempre, y un aviso dice qué acortar. El respaldo ggplot, aplastado, encimaba sus rótulos. Pasa con «¿Cómo solventas tus estudios?» completo: siete opciones con rótulos de tres y cuatro líneas, y una tarjeta de beca de cuatro líneas de título.
- **Word.** Cada figura lleva las tarjetas de su ranura. Las calcula `.word_publico_marcar`, que llega a la lámina por el entorno del motor; `reporte_plan_ppt.R` no crece.
- **Lectura.** Los gráficos de una lámina de dos también son candidatos a la tarjeta de ejemplo.

### 7. Extensión: baterías sin columna de Top Two Box (2026-11-04, RV v7 láminas 21 y 26)

Las baterías de frecuencia de redes sociales y de IA generativa declaran su Top Two Box («Todos los días, en momentos puntuales» + «…a lo largo del día»), pero no dibujan su columna (`barra_extra = FALSE`, G17). Las tarjetas no salían.

- **Indicador.** La tarjeta compara el Top Two Box que declara el gráfico (`top2box_labels`). El total sale de la base, redondeado como el gráfico.
- **Encabezado.** Como el indicador no se ve en el gráfico, la tarjeta lo nombra. Anclada a su premisa dice solo el indicador («Todos los días»): la premisa ya está en el eje y la guía la une. En el Word y en el panel dice la fila y el indicador («Claude · Todos los días»). El nombre es el declarado (`tarjetas_diferencias.indicador`) o la parte común de las categorías que suma. Sin parte común de al menos cuatro letras, «Top Two Box».
- **Anclaje.** La guía sale del borde derecho de la barra de su premisa, porque no hay cifra del Top Two Box donde engancharse.
- **Baterías largas.** La escala se parte con su regla y cada tarjeta va en la lámina de su premisa.
- **Columna fija y cascada.** Una batería va anclada en una columna angosta, cuyo ancho no escala aunque las tarjetas no quepan en alto. El panel de dos columnas aplastaba el gráfico (Gonzalo: «estas barras están extremadamente apretadas»). Si las tarjetas no caben junto a sus premisas, se anclan compactas, con el nombre corto a la izquierda. Si tampoco, van las principales que quepan y un aviso dice cuántas.
- **Word.** El Word parte una batería larga en piezas: cada pieza toma, de su lámina, las tarjetas de sus filas. El título de la tarjeta se corta con la misma regla con que se mide.

### 8. Revisión de la v7.11 (2026-11-04)

- **Categóricas (ítem 9).** El título de la tarjeta va sin comillas en todos los tipos. En una categórica en barras, la tarjeta va junto a la barra de su categoría: la guía sale del final de esa barra (con su cifra), como en las baterías, y la columna de tarjetas se arrima a 0,6 in del fin de la barra más larga, con 3,4 in de ancho. Antes quedaba sola en el borde de la lámina. Si la categórica no está en barras (columnas, dicotomía), sigue el panel.
- **Columna con llave (ítem 15).** Los nombres de las categorías van en un solo eje a la izquierda. La cifra de un segmento chico pasa a la derecha de la columna con su guía recta. Si ese segmento está dentro de la llave, la cifra sigue junto a su nombre, porque a la derecha la tapa la llave.
- **Franja dicotómica en una mitad (ítem 14).** Una franja Sí/No con tarjetas no reserva alto. La franja se agranda (cifra de 30 pt, barra de 0,55 in, a todo el ancho de la mitad) y sus tarjetas van pegadas debajo, sin filete. El bloque se centra en el alto de la mitad. La receta del panel conserva el estilo de la lámina, para que su título sea como el de la otra mitad.
- **Lámina de lectura (ítem 1).** La tarjeta de ejemplo va a escala 1,75 desde el margen, la diferencia en puntos llena la derecha y la leyenda va en una fila de 13 pt a lo ancho. El conjunto se reparte en el alto entre la definición y el método.

### 9. Desglose en línea y cifra al lado (2026-11-04, ítem 6 de la v7.11, alternativa B)

Maqueta «Colegio y resumen ejecutivo» (2026-11-04), `02_colegio_B_cifra_y_desglose_en_linea.png`.

- **Modo en línea.** `meta.tarjetas_diferencias.modo = "en_linea"` (en una lámina de dos gráficos, en la opción de su ranura). En una categórica en barras sin cruce, bajo cada opción que difiere va el rótulo del cruce en versalitas («SEGÚN ESTUDIOS DE PADRES») y sus grupos como barras finas en la misma escala que el total, con su cifra y su marca: ▲ azul y ▼ naranja al 99%, barra clara y triángulo hueco al 95%. Los grupos van con su nombre corto. Las opciones van sobre una pista gris al 100%. La lámina lleva una fila de leyenda de las marcas.
- **Tope.** Hasta dos opciones con desglose y un cruce por opción, el de la tarjeta de mayor prioridad. Las demás diferencias se avisan («quedan en las tablas de cruces»). Con otro gráfico van las tarjetas de siempre, con aviso.
- **Alto.** Si no cabe, la letra de las opciones baja de 14 a 11 pt y su fila hasta 0,32 in; el desglose conserva su medida. Si ni así cabe, avisa que hay que acortar los rótulos (`rotulos_cortos`).
- **Cifra al lado.** Es una disposición de `p_slide_2_graficos` y no un tipo nuevo: `meta.composicion = "cifra_lateral"` con la cifra en `meta.cifra` (`fila`, `texto`, `rotulo`, `franja`, `comparacion`).
  - Un tipo nuevo exigía crecer `reporte_plan_ppt.R`, que está congelado, y el catálogo de tipos. La de dos gráficos ya trae las dos ranuras renderizadas y su Word (dos figuras con sus tarjetas).
  - Vive en `lamina_cifra_y_grafico.R` y no en `lamina_hallazgos.R`. De hallazgos reusa sin cambiarlos el modelo de la cifra (`.halla_kpi_modelo`: valor, intervalo con el diseño por aula, comparación automática con la prueba del informe) y sus piezas (marco, barra de intervalo, comparación).
  - La izquierda, un tercio de la lámina, lleva la tarjeta de la cifra: rótulo, cifra de 60 pt, lo que mide, la franja partida al 100% con el intervalo debajo y las dos opciones, y la comparación completa en hasta dos líneas. La derecha lleva la pregunta del gráfico, «Respuesta múltiple…» si suma más de 100%, y el gráfico con su desglose en línea.
  - Al pie van la leyenda de marcas y el método. Si algo falta (`meta.cifra.fila`, un gráfico que no es categórica), la lámina va como dos gráficos, con aviso.

## Consecuencias

- Una diferencia de nivel puede quedar al 95% o desaparecer frente a la maqueta, que usaba una familia propia y más chica. Pasó en CCSS con nivel 7 en «ONG» y con padres en «posgrado».
- Las láminas de cruce de una pregunta con tarjetas siguen en el plan. Ocultarlas es decisión del estudio: en CCSS v7 se ocultaron.
- Una batería que el Word parte en piezas lleva en cada pieza las tarjetas de sus filas (§7).

## Cumplimiento

- Motor: `api/R/graficos_tarjetas_diferencias.R`, `api/R/graficos_tarjetas_lectura.R`, `api/R/lamina_tarjetas_diferencias.R` y `api/R/reporte_word_tarjetas.R`.
- Tokens de color: `ppt.colores.tarjeta_*` y `verde_acuerdo` en `api/inst/estandar/estandar_pulso.json`.
- Tests: `api/tests/testthat/test-graficos-tarjetas-diferencias.R` `api/tests/testthat/test-graficos-tarjetas-todas.R` `api/tests/testthat/test-graficos-tarjetas-ranuras.R` y `api/tests/testthat/test-graficos-tarjetas-sin-ttb.R`.
- Por ranura: `api/R/graficos_tarjetas_ranuras.R` y `api/R/lamina_tarjetas_ranuras.R`.
- En línea y cifra al lado: `api/R/lamina_tarjetas_en_linea.R`, `api/R/lamina_cifra_y_grafico.R` y `api/tests/testthat/test-graficos-tarjetas-en-linea.R`.
- Columna con llave: `api/R/lamina_columna_llave.R`.
- UI: interruptor «Tarjetas de diferencias» en la sección «Diferencias entre grupos» del inspector de la lámina.
