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

## Consecuencias

- Una diferencia de nivel puede quedar al 95% o desaparecer frente a la maqueta, que usaba una familia propia y más chica. Pasó en CCSS con nivel 7 en «ONG» y con padres en «posgrado».
- Las láminas de cruce de una pregunta con tarjetas siguen en el plan. Ocultarlas es decisión del estudio: en CCSS v7 se ocultaron.
- Una batería que el Word parte en piezas no casa con la lámina y va sin tarjetas en el Word.

## Cumplimiento

- Motor: `api/R/graficos_tarjetas_diferencias.R`, `api/R/graficos_tarjetas_lectura.R`, `api/R/lamina_tarjetas_diferencias.R` y `api/R/reporte_word_tarjetas.R`.
- Tokens de color: `ppt.colores.tarjeta_*` y `verde_acuerdo` en `api/inst/estandar/estandar_pulso.json`.
- Tests: `api/tests/testthat/test-graficos-tarjetas-diferencias.R` y `api/tests/testthat/test-graficos-tarjetas-todas.R`.
- Columna con llave: `api/R/lamina_columna_llave.R`.
- UI: interruptor «Tarjetas de diferencias» en la sección «Diferencias entre grupos» del inspector de la lámina.
