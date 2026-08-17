# Checklist — el mazo revisado contra PowerPoint, no contra LibreOffice

**Abierto**: 2026-08-16 · **Cierra**: sólo Gonzalo.
GOAL padre: `goal-mazo-sin-retoques-2026-08-14.md`.

## Por qué existe

Toda la validación visual de este GOAL se hizo renderizando con **LibreOffice**.
PowerPoint abre el mismo archivo con **«PowerPoint found a problem with
content… Repaired and removed it»**. Es decir: el entregable se estuvo midiendo
sobre un render que el cliente no ve, y de un archivo que PowerPoint repara
quitando contenido antes de mostrarlo.

Eso invalida como evidencia todo lo que se declaró «verificado visualmente»
antes de hoy. No invalida las medidas hechas sobre el XML —esas leen el archivo
real— pero sí cualquier «lo miré y se ve bien».

**Regla nueva**: la validación visual del PPT se hace exportando a PDF **desde
PowerPoint** (`scratchpad/ppt_pdf.sh`), y siempre sobre las dos variantes: el
mazo y el mazo con la guía. La guía es la que trae las cotas.

## C0 — El archivo tiene que abrir sin reparación

Precede a todo lo demás: mientras PowerPoint repare, lo que se ve no es lo que
el motor produjo.

| | Hallazgo | Estado |
|---|---|---|
| C0.1 | 159 `<a:rPr>` con `<a:cs>` antes de `<a:ea>` — orden que el esquema no admite; el aprobado tiene 0 | ☑ **159 → 0** (`reporte_ppt_saneo_ooxml.R`) |
| C0.2 | El paquete declaraba 9 tipos de contenido para formatos que no contiene (`jpg` como `application/octet-stream`); el aprobado no trae ninguno | ☑ **9 → 0** |
| C0.3 | **La plantilla misma se abría reparada**, sin una sola lámina dentro: `plantilla_16_9` y `plantilla_acnur_16_9` tenían **dos `sldLayoutId` duplicados** en el master, heredados al añadir los diez layouts nuevos. Todo mazo hecho con ellas nacía corrupto | ☑ **2 → 0** en ambas · falta la confirmación visual |

Descartados con evidencia, para no volver sobre ellos:

- `<p:ph/>` vacíos (63): el aprobado tiene 108 y abre limpio.
- Dos relaciones `extended-properties` en `_rels/.rels`: el aprobado tiene las
  mismas dos; vienen de la plantilla.
- Orden de hijos en `spPr`, `pPr`, `bodyPr`, `ln`, `a:p`: correcto en ambos.
- XML mal formado, IDs de forma duplicados, relaciones rotas, valores fuera de
  rango, partes sin content type: cero en ambos.
- **El rezip del saneo NO es el culpable**: el entregable aprobado pasado por esa
  misma rutina abre limpio. (Sí lo fue una versión intermedia que usaba
  `zip::zip`, que marca las entradas con data descriptor y hacía que PowerPoint
  no abriera el archivo en absoluto.)
- El recortador de láminas con `python-pptx` **corrompe**: su control —el
  aprobado recortado— tampoco abre. La bisección se hizo generando parciales con
  el motor, que sí son válidos.
- Los tipos de contenido sobrantes **no eran** la causa: con los nueve quitados,
  un mazo de una lámina seguía reparándose.

**Lo que resolvió C0.3**: un mazo de UNA lámina ya se reparaba, así que el
defecto no estaba en ninguna lámina sino en algo común. La plantilla sola
—98 partes, cero láminas— confirmó el origen. El `.bak` sin commitear de la
misma plantilla dio el diff: diez layouts nuevos, dos de ellos con el id de otro
ya existente.

## Las indicaciones, una por una

| | Indicación | Dónde vive | Estado |
|---|---|---|---|
| P1 | El índice: comprobar que los elementos y encabezados salen bien | plan del `.pulso` | ☑ salía **solo el título**: `secciones`, `subtemas`, `subindices` e `iconos_focos` llegaban como cadena vacía. Ya lista las cinco entradas numeradas |
| P2 | Separación entre cuadro y cuadro del índice (comentario de Gabriela) | `.indice_fit_layout()` | ☑ **1.19 → 1.71 cm**, el paso exacto del aprobado. La fórmula topaba en `2.34/n`, que con la quinta sección apretaba todas |
| P3 | Objetivo: no se está siguiendo la referencia | render de `objetivo_icono` + plan | ☑ el texto se emitía **crudo** y heredaba **12 pt** del placeholder; el aprobado usa **20**. Y el contenido era más corto: ahora los 251 caracteres del aprobado |
| P4 | **La ficha técnica desborda la lámina** | `reporte_ppt_tabla_lineas.R` + plan | ☑ el alto de fila contaba **caracteres**, no líneas: «Muestra» llevaba cuatro públicos en 1.24 cm. Y el contenido venía pegado (`…PUCPDocentes…`). Geometría y 15 pt del aprobado |
| P5 | Escala usada y número de respuestas están puestas **como texto suelto**, no armadas como en el PPT final | tabla con color por fila + `.ppt_fpar_multilinea()` | ☑ **escala armada**: título 0.94, texto 3.74 de 31.30×2.41 y leyenda a 6.91 de 31.29 — la geometría exacta del aprobado, pero como **tabla nativa** donde él pega una imagen. Cuadros de 0.94×0.95 cm. Y «número de respuestas» deja de ir **justificada** y de pegar sus dos frases (`correspondiente.• Los porcentajes`): el cuerpo se emitía en un run único y ahí el `\n` no es salto en OOXML. Queda sin la ilustración del aprobado |
| P6 | La guía no acota como una regla: falta «de tal punto a tal punto, tantos cm» | `.guia_cota_grobs()` | ☑ cada caja lleva **cota horizontal y vertical** con línea, topes y cifra en medio. Y legible: cuerpo 4.6 → 5.6, negrita y **halo al 55 %** —con 80 % el halo tapaba la barra que había debajo, que es lo contrario de lo que la guía debe hacer— |
| P7 | Perfil del docente: el título «Sexo» sale mucho más alto que «Departamento académico» | disposición de 4 paneles | ⏸ **no se reproduce midiendo**: 15.99 pt y negrita en los cuatro, tops a 3.53 vs 3.46 (0.07 cm). La caja de «Sexo» es menor (0.42 vs 0.52) sólo porque cabe en una línea. Necesita el render |
| P8 | Perfil del egresado: «¿Se encuentra trabajando?» tiene guías distintas, sin los avances | tope del estirado en agrupadas | ◐ **medido y mejorado**: los cuadrantes dispersaban **0.75–0.98 cm** y el aprobado 0.12–0.29. El estirado del panel engordaba la barra del cuadrante con pocas filas hasta 1.68 cm. Con techo: máximo **0.90**, peor dispersión **0.29** (aprobado 0.22). **OJO — este ítem se cerró contra OTRA lectura de su propio título.** Dice «tiene guías distintas» y el trabajo se fue al grosor. Gonzalo volvió a preguntar por lo mismo el 2026-08-17 mirando esa lámina: sus dos pies no llevan cotas y sus dos barras sí. Eso es **P33**, y sigue abierto |
| P9 | Barras agrupadas muestran **columna extra** y el reporte final de Contabilidad no la tiene | suelo editorial de Pulso | ☑ era la N de la base repetida **18 veces** en una lámina; el aprobado: 0 |
| P10 | Misión y propósitos sale en **durazno**; debe ir en escala de azul celeste | paleta `lst_p10` del proyecto | ☑ la 2ª pregunta salía `081F5C`+`F4B183` y su hermana `081F5C`+`9DC3E6`; el aprobado pinta las dos en celeste |
| P11 | Estructura organizacional: porcentajes unos en blanco y otros en azul; deben ser todos azules | `graficador_contraste_texto.R` | ☑ el umbral 0.6 dejaba `#70AD47` (0.561) del lado oscuro → **7 blancas**; el aprobado usa azul ahí. Umbral a 0.52 |
| P12 | Radar: las tablas son manuales, no **tablas nativas** de PPT, y no siguen el formato del reporte | `reporte_plan_tabla_nativa.R` | ☑ **5 tablas nativas** (el aprobado 3), con anchos `[6.36, 2.39, 2.39, 2.39]` contra `[6.62, 2.45, 2.61, 2.32]` del aprobado. Antes: **el puente ya existía y nadie lo usaba con radar**: el ADR 0072 solo cubría la lámina de SOLO tabla (`tabla_nativa && ocultar_radar`). Ahora el graficador adjunta también **dónde** va (`geom_frac`) y el renderer la coloca junto al gráfico. Falta que el modo `publicos` —que compone varios sub-radares— pase por ese bloque. Antes: **medido**: el aprobado resuelve esto en **2 láminas** con `CHART` nativo + tabla nativa 7×4; el motor usa **5 láminas** con un grupo de 23/82/145/128/39 sub-formas — **417 formas a mano**. La tabla se dibuja dentro del ggplot; sacarla exige que el graficador exponga sus datos y el render emita la tabla. Unidad propia |
| P17 | **El mazo usa dos tipografías** | `graficador_radar.R` | ☑ **22 → 0**: el mazo sale con `{Arial: 5266}` y nada más. El arreglo fue en dos tiempos: primero «Arial» literal en veinte sitios —porque `graficar_radar()` no tenía parámetro de familia—, y dos de esos se escribieron como `family = font_family`, variable que **no estaba en scope**: la función abortaba sin canvas (P21). Ahora `font_family` **es parámetro** y los dieciocho literales del cuerpo lo usan; `tabla_font_family` sigue aparte porque ese texto lo gobierna su propio grob |
| P16 | **Dos láminas del mismo tipo no salen iguales** | estirado del panel | ◐ **mecanismo localizado y es de DISEÑO**. No hay escalado: `rvg::dml_pptx` abre el device con el tamaño del cajón, y el cajón es **constante** (5.5118 in de alto en 51 láminas). Lo que varía es el reparto interno: el bloque «el sobrante va al panel» **estira el panel para llenar el hueco**, y como el cromo —título de una o dos líneas, leyenda, nota— ocupa distinto en cada lámina, el panel disponible cambia y las barras engordan. **Tensión real con P23**: llenar el hueco exige estirar; que las gemelas salgan iguales exige no hacerlo. El candidato de reparación es acotar el estirado con un techo de grosor común — ver **P25**, donde ese techo ya existe sin consumidor |
| P15 | Cifras de un solo color por familia: blanco en dicotómica azul, azul Pulso en Likert | `.contraste_familia()` | ☑ un color por gráfico en vez de por luminancia de cada segmento; la paleta que no es de la casa la sigue decidiendo la luminancia |
| P14 | **Las barras no tienen el mismo grosor dentro de una lámina** | `graficador_row_step.R` | ☑ **0.29 → 0.13 cm** en Mecanismos de admisión (el aprobado: 0.22). Antes: **medido**: en «Mecanismos de admisión» la escala sale a **1.19 cm** y la dicotómica a **0.90** — 0.29 de diferencia. El motor tiene 8 láminas así (peor 0.38); el aprobado 6 (peor 0.22). Regla **B3** añadida al verificador. **Reparado**: los bloques comparten paso de fila y el reparto de alto lo sigue. Coste medido: una barra de escala de esa lámina queda en 0.66 cm contra el piso de 0.77 (R1 ×1), a cambio de que las dos dejen de diferir en 0.29 |
| P18 | **La rejilla de las tablas iba en gris claro** (hallazgo propio) | `reporte_plan_tabla_nativa.R` + `reporte_plan_ppt.R` | ☑ **248 bordes `BFBFBF` → `757070`, cero en el claro**. El aprobado declara los cuatro lados de cada celda en `757070` a 0.75 pt; el grosor ya coincidía, el color no. Hay **dos** constructores de tabla nativa y hubo que tocar los dos: cambiar solo el del plan dejaba 48 bordes claros en la ficha técnica. Los 16 bordes de 9.4 pt del índice son separadores deliberados y no se tocan |
| P19 | **Los públicos salían en minúscula en la tabla del radar** (hallazgo propio) | `.radar_mb_nombres_tabla()` | ☑ «docentes» → «Docentes». El nombre viaja como lo nombra el estudio, y ese es el nombre de la **base**: sirve de clave, no de encabezado. Solo la inicial —capitalizar palabra a palabra convertiría «I+D+i» en «I+D+I»— y los `tabla_encabezados` declarados a mano salen literales. **La otra mitad queda para Gonzalo**: el aprobado titula la primera columna «Top Two Box» y el motor «Tema»; `tabla_titulo` ya es configurable en la UI y el motor no puede saber qué métrica grafica |
| P20 | **El motor escribía un tercio más grande que el aprobado** (hallazgo propio) | `.PRESETS_DEFAULT_PULSO` | ☑ cifras **15.93 → 14 pt** y etiquetas **15.99 → 12/14**, el reparto del aprobado. Medido en tres variantes regenerando el mazo entero: la vara marca **15 en las tres** (no mide este eje) y los recortes de enunciado son **31 en las tres** —la alarma de que empeoraban era salida truncada, no un hecho—. `size_texto_barras` va en **milímetros** (×2.845); `size_ejes` en puntos. **Es calibre global de la casa**, no de este estudio |
| P21 | **`graficar_radar` abortaba sin canvas** — regresión propia de P17 | `graficador_radar.R` | ☑ `family = font_family` en dos `geom_text` del cuerpo, donde esa variable **no existe**: el único `font_family` del archivo es parámetro de una función interna. El mazo solo usa canvas, así que las 66 láminas salían bien con el motor roto. **7 errores de la suite → 0** |
| P22 | **La leyenda se parte encima del enunciado** (hallazgo del render) | `size_leyenda` | ☑ iba a **15.99 pt** contra los 12.0 del aprobado. Bajada a 12. **Corrección de mi propia medición**: el «48 de 48 no caben» era un falso positivo — mi estimador asumía una sola fila, cuando el motor ya reparte en varias con un cálculo que replica el del dibujo término a término. Medido bien, con el número de filas que el motor dibuja: **motor 3 láminas con leyenda multi-fila, aprobado 7**. Falta confirmarlo en el render de PowerPoint |
| P23 | **La mitad inferior de muchas láminas queda vacía** (hallazgo del render) | `.PLAN_RESERVA_PIE_MULTI_IN` en `reporte_plan_helpers.R` | ◐ **CUANTIFICADO — ya no es una impresión**. Medido en píxeles sobre los dos mazos pasados por el MISMO renderer, que es lo que controla las mañas de LibreOffice: se rasteriza a 40 dpi, se toma el tono más frecuente como fondo y se mira hasta dónde llega la última fila con tinta dentro de la zona útil (del 15 % al 92 % del alto). **El aprobado llega al 96.5 %** (mediana 98.7 %) y **el generado al 85.7 %** (mediana 81.8 %). En láminas: **73 % de las del motor dejan más de un décimo del alto muerto abajo, contra el 8 % del aprobado**. La densidad de filas con tinta es la MISMA en los dos (61.0 % y 60.5 %): no es que el motor tenga menos contenido, es que lo comprime hacia arriba. **Causa descartada con medición: NO es el techo de partición.** `.PARTICION_MAX_BARRAS` valía 7 porque `calibrar_umbrales()` devuelve `barras_por_grafico = 7` — pero ese 7 es el máximo del aprobado **por gráfico**, y la constante se aplica **por lámina**. Contando todas las filas de barra por lámina con la maquinaria de `.verif_graficos()` sobre las dos paletas, el aprobado llega a **12** y pone ocho o más en **nueve** de sus láminas. Subir el techo a 12 se probó: el mazo bajó de 73 láminas a 69 y el contenido pasó a morir al **86.2 %** — medio punto—, mientras la vara subía de 21 a 22 con un `R2 barras por gráfico` nuevo. Revertido y anotado en el código. **Sobra sitio con cuatro barras igual que con doce**, así que el panel no llena su hueco pase lo que pase con cuántas filas tenga: la causa está en el reparto vertical del canvas, no en cuántas barras entran. **LOCALIZADO — es la reserva de pie, no el reparto**. Trazado el presupuesto vertical de los 25 gráficos del mazo: **el canvas YA llena su hueco** (mediana 97.2 % de las 6.00 in). Las 12 que llenan menos del 95 % son de dos filas, y ahí el centrado es DELIBERADO —feedback directo de Gonzalo: «sigue escueta la barra sola»—, así que no es defecto. Segunda causa descartada con medición: subir `.BARRAS_PANEL_ESTIRA_MAX` de 1.8 a 2.6 llevó el contenido de morir al 85.7 % a morir al 86.2 % —mediana sin moverse— y subió la vara de 21 a 22 con una B3 más; el comentario que ya estaba en el código tenía razón y ahora lleva la confirmación. **Lo que queda vacío está DENTRO del canvas**: la banda que reserva para que el texto de Base no choque con la leyenda. Medido el hueco entre la última tinta del gráfico y el pie, en los dos mazos por el mismo renderer: **aprobado 0.83 in de media, mediana 0.77** · **generado 1.06 in de media, mediana 1.28**. Media pulgada de más en la mediana, que es casi toda la diferencia de P23 (el gráfico del aprobado acaba en el 87.0 % y el del motor en el 78.0 %). La traza dio `h_caption_in = 0.85` mientras `.plan_reserva_pie()` fija un mínimo de 0.34 (0.5 en multiapiladas multibase, cuya Base prorrateada envuelve a dos líneas). ☑ **REPARADO**. El 0.85 salía de tres llamadas a `.reservar_pie_para_base_slide()` en el renderer, **sin una sola línea que lo justificara**. Medido: el placeholder del gráfico acaba en **6.72 in** y la Base empieza en **6.93** —0.22 in de aire, idéntico en las 49 láminas—, así que la banda protegía de un choque que la geometría ya impide. Bajada a **0.5**, con nombre propio (`.PLAN_RESERVA_PIE_MULTI_IN`) y su medición al lado. Resultado: **vara 21 → 18**, con **B2 «hueco entre premisas» cerrada entera** (4 → 0); el contenido sube del 85.7 % al **89.0 %** de la zona útil (mediana 81.8 → **87.4**) y el hueco entre gráfico y pie baja de **1.28 in** de mediana a **0.98** —el aprobado tiene 0.78—. Comprobado en el render que la leyenda no roza la Base. **0.4 se midió y se descartó por margen, no por dato**: misma vara (18), algo mejor de relleno (89.9 %, hueco 0.82 de media contra las 0.83 del aprobado) y el mismo número de láminas por debajo de 0.15 in de separación —pero 0.5 es el valor que el propio helper documenta para una Base de dos líneas, y una de tres, que este mazo no tiene, se comería el sobrante—. La medida queda hecha por si Gonzalo quiere apurarlo. **Lo que queda de P23 no es reserva**: del 89.0 % al 96.5 % del aprobado hay que llenar con MÁS contenido, no con barras más gordas — el aprobado compone varios bloques de ≤7 barras por lámina y el motor no sabe |
| P24 | **La cota de la guía medía el alto nominal, no el dibujado** (hallazgo propio) | `graficador_barras_apiladas.R` ~3276 | ☑ reportaba `grosor_eff × alto_por_cat_grosor` cuando el panel **se estira después** para llenar el hueco. Cruzando lo que canta contra lo que mide el detector en 53 láminas: correlación **−0.353 → +0.588** —era **negativa**, la guía cantaba al revés— y el rango del ratio 0.507→0.912 por abajo. Antes cantaba 1.29 cm en casi todas mientras el mazo iba de 0.693 a 2.068; ahora canta 19 valores contra 22 reales. **Verificado con control**: revertida la línea, la correlación vuelve a −0.353. Explica «no sé si te estás guiando de ellas» |
| P25 | **`.grosor_con_techo_in()` no lo llama nadie** (hallazgo propio) | `graficador_grosor_piso.R` | ☐ existe, tiene tests y **cero consumidores**. Se escribió para P8, que se resolvió por otro camino. Y su comentario declara una cifra **falsa**: dice que 1.0 cm es «el grosor mayor que usa el entregable aprobado» — medido, el aprobado llega a **1.80 cm** y supera ese techo en el **59 %** de sus barras (el motor en el **71 %**, máximo 2.55). La diferencia real motor/aprobado es **2.55 vs 1.80 cm** |
| P27 | **Las metodológicas salen como texto, no recreadas** | `p_slide_top_two_box` ☑ · «Número de respuestas» ☑ | ☑ **CORRECCIÓN DE MI PROPIO INVENTARIO**. Dije que el motor las despachaba con un párrafo, contando `<a:t>` en el XML. Falso para la de **top two box**: el motor **la recrea entera** —barra de cuatro segmentos, llave sobre los dos últimos, «TOP TWO BOX / 35 % + 55 % / 90 %», flecha con las anclas y leyenda 1-2-3-4—; conté 3 textos porque el diagrama va como **imagen SVG** y sus textos no están en el XML. `p_slide_top_two_box()` ya declara `valores`, `etiquetas`, `top_two_indices` y las anclas. Le quedan tres diferencias, **ninguna del motor salvo una**: el título dice **«N»** (viene del plan del proyecto, dato de Gonzalo), los porcentajes de ejemplo son 5/5 y el aprobado usa 4/6 (configurable), y el primer segmento sale **rojo** donde el aprobado usa **naranja**. Sale como imagen y el aprobado usa 11 formas nativas. **«Número de respuestas» SÍ está sin recrear**: el motor deja el **80 % de la lámina en blanco** y el aprobado pone **dos mini-gráficos didácticos** con notas al pie numeradas ¹ ² en el párrafo que apuntan a «Base: 12 egresados» y a «N = 12» sobre el gráfico — enseña **dónde aparece cada cosa**. ☑ **construida**: `.numero_respuestas_svg()` compone los dos ejemplos del aprobado con sus dos anclas numeradas en recuadro punteado. Archivo propio (`reporte_ppt_numero_respuestas.R`) porque el renderer está congelado. ☑ **enganchada y saliendo en el mazo**. Tres piezas: (1) `p_slide_texto()` acepta `diagrama`; (2) **el título la reconoce sola** —`.slide_texto_diagrama_auto()`—, porque los planes ya guardados en los `.pulso` no traen ese campo y sin esto el diagrama existiría sin que lo viera nadie; (3) el renderer llama a `.nresp_colocar()`, que **decide dentro del archivo nuevo** para gastar 4 líneas del congelado en vez de 13 (base 9697 → 9701, subida deliberada). Geometría **remedida contra la lámina 7 del aprobado**: su diagrama son 33.48 × 10.15 cm, o sea 1000 × 303, y el lienzo iba en 1000 × 430 — al encajarlo por alto quedaba a 1.4 pulgadas de cada margen mientras el aprobado va de borde a borde. **Costó una regresión en el otro entregable**: Word llama al MISMO renderer del PPT con `solo_lista = TRUE` y `doc = NULL` solo para cosechar el `render_meta`, y el `ph_with()` sobre NULL tumbaba el informe entero con «attempt to apply non-function» — **el PPT salía perfecto**. Verificado: PPT 66 láminas OK, Word 4520 KB OK, vara 21 |
| P28 | **El radar salía con un cuadro vacío y la tabla fuera** (lo vio Gonzalo en el PDF) | `.plot_slot_recortado_por_tabla()` | ☑ **el sitio se pedía DOS veces**: el canvas reservaba un panel vacío al lado del radar *y* el renderer colocaba la tabla en el mismo cajón vía `geom_frac`. La reparación va por el **slot**, no por el canvas: éste deja de reservar pero **conserva `geom_frac`** —sin él el renderer cae al camino de «solo tabla» y el radar desaparece entero, medido en un intento previo— y el renderer recorta el slot del gráfico hasta donde empieza la tabla. Rechaza los recortes que dejarían al gráfico con menos de un tercio del cajón. **Medido: el cuadro vacío desaparece, la tabla acaba en 32.66 de 33.87 cm y la vara baja 22 → 21** (B3 de 7 a 6). Siguen abiertos en la misma lámina: **sólo se ve una de las tres series** (96/96/93 se solapan), la **leyenda en minúscula** y los encabezados partidos («Estudiant/es») |
| P29 | **Tres defectos hermanos del radar** (vistos al reparar P28) | radar + tabla nativa | ☑ **los tres cerrados**. **(b) leyenda ☑** capitalizada sólo en la copia del graficador —en el origen rompería las claves de `tabla_encabezados`—. **(c) encabezados ☑** `primera_col_frac` 0.47→0.40, partidos 2→1. **(a) una sola serie ☑ — y no era el grosor**: el radar **no estaba dibujando los datos**. `escala_valor` llegaba como `proporcion_1` con valores de **90.83 a 98.14**, y el `pmin(1, .)` los aplastaba **todos al tope**: hexágono lleno pegado al borde. Se persiguió dos ticks como problema de línea. La traza de la **entrada** de `graficar_radar()` lo destapó, y de paso mostró que esas láminas van por `p_radar → radar_tabla`, **no** por `.radar_mb_componer()` donde estaba el enganche. Reparado en `graficar_radar()`: una proporción no pasa de 1, y por encima de 1.5 se lee como porcentaje **con aviso**. Verificado en el render: las tres series salen separadas |
| P30 | **La N por barra no baja al gráfico** (pedido de Gonzalo) | `graficador_n_por_barra.R` + renderer de multilista | ☑ **cerrado**. El motor prometía en su lámina metodológica que la N baja al gráfico y tenía **0** anotaciones contra 11 del aprobado. El bloqueo no era el dato sino el **alcance**: el graficador ve una pregunta por llamada y la base de un público sólo se deduce mirando todas sus preguntas. Ahora el **renderer de multilista** —que ya recorre los bloques para el paso común de P14— recoge la N de cada variable, deduce la base por fuente y la pasa como `bases_publico`. La deducción se comprobó contra la lámina 18: los máximos por público dan **52, 172, 178 y 15**, las cuatro bases declaradas, exactas. **Medido: 4 anotaciones** (N = 47, 128, 139, 14) en la lámina 17, justo las cuatro filas cuyo N no cuadra con su base. Verificado en el render: cursiva, pequeñas, a la derecha. Criterio: la unidad es **la pregunta**, no la fila —tres de las 11 del aprobado coinciden con la base de su público—, tolerancia de un caso y sólo por debajo. **Línea base subida** de 9663 a 9697 en `agentic/manifest.json`: el bucle necesita `.tab_freq()` y `.resolve_ref()`, locales del renderer |
| P31 | **¿Comparativo con otro año en top two box y en tablas de radar?** (pregunta de Gonzalo) | `p_slide_top_two_box()` · `graficar_radar()` · no existe el acarreo de otra medición | ⛔ **BLOQUEADO — necesita decisión de Gonzalo**. Medido, no recordado. **Radar: ya compara N series hoy.** `graficar_radar(var_grupo = …)` dibuja un polígono por serie y `.make_tabla_ttb_df()` pivota grupo → columna, así que su tabla nativa saldría con una columna por año. Comprobado pasándole 2025 y 2026 como grupos: dos polígonos y su leyenda, sin tocar nada. **Top two box: no compara nada.** Recibe un solo vector `valores` y no tiene sitio para una segunda medición — y su **texto por defecto promete** «permite comparar […] con mediciones de otros años», la misma clase de defecto que P30: la lámina promete lo que el motor no hace. **Lo que falta en los dos casos es el mismo y no es de graficador**: no existe forma de traer la base del año anterior. La multibase de un `.pulso` es **por público** (estudiantes/docentes/egresados), no por medición, y no hay concepto de base de referencia ni de benchmark. Un año solo entra hoy si ya viene como columna del propio estudio. **NO es una brecha contra la vara**: el aprobado tampoco tiene comparativo interanual —sus años son categorías dentro de una medición: año de egreso, tiempo hasta el primer empleo—. La decisión que se necesita: de dónde sale la medición anterior —¿un segundo `.pulso` montado como base de referencia, un CSV de cifras ya calculadas, o columnas del mismo estudio?—, porque de eso depende si esto es trabajo de graficador o de carga |
| P32 | **El techo de barras es uno solo para dos paletas que el aprobado trata distinto** (hallazgo propio) | `.particion_max_barras_de()` en `reporte_plan_particion.R` | ☑ **CORRIGE UNA LECTURA MÍA**. Escribí que el motor «junta las doce barras en un bloque» y por eso saltaba `R2`. **Es falso**: mirado el render con el techo en 12, el motor compone **tres bloques** con su enunciado, su separación y su leyenda, igual que el aprobado. La capacidad ya está. Lo que dispara R2 es otra cosa y la regla tiene razón: una lámina cuyo gráfico de **rampa** pasa de siete barras, y el aprobado nunca pasa de siete en rampa. Pero en **azul dicotómico sí llega a ocho** (su lámina 18, leída por la propia maquinaria del motor), y `calibrar_umbrales()` **solo mira la rampa** — así que el techo no está calibrado para las dos paletas y el vacío en azul no lo mide nadie. Repetido el techo 12 con la reserva ya reparada, por si interactuaban: vara 18 → 19, contenido 89.0 % → 89.2 %. Sigue sin compensar, pero el único incumplimiento nuevo es ese R2. ☑ **REPARADO**. Techo por familia: `.PARTICION_MAX_BARRAS_DICOTOMICA = 12` frente a las 7 de escala, elegido con `.particion_max_barras_de()`. La señal es `top2box`, que el plan ya trae: una dicotómica no puede declararlo —no hay dos categorías superiores que sumar en un sí/no—, y comprobado sobre el plan de Conta sus tres elementos con `top2box = FALSE` son exactamente los tres dicotómicos, de 8, 13 y 13 barras. **Vara 18 → 17** (B4 baja de 8 a 7, **sin R2**) y el contenido sube de 89.0 % a 89.2 % con 3 láminas menos (73 → 70). **Un default por poco se traga lo que no reconoce**: puse «sin `top2box` → dicotómica» y tres tests previos de la suite rojearon, porque un plan viejo que no declara el campo habría empezado a juntar doce barras sin que nadie lo pidiera. Invertido: **solo un `FALSE` explícito ensancha**. Calibración de la lámina 18 del aprobado, por si hace falta afinar: 12 barras de **0.26 in** todas iguales, hueco de **0.11 in** dentro del bloque y **0.41 in** entre bloques, contenido de 1.19 a 6.61 in |
| P33 | **Las guías son distintas según el gráfico** (pregunta de Gonzalo · lectura literal de **P8**, que se cerró contra otra) | `.guia_envolver_bloque()` · `.guia_nota_pie()` | ☑ **MEDIDO — no es un ajuste, es que la guía buena solo existe para barras**. En esa lámina los dos gráficos de barras llevan la guía arquitectónica completa —marco turquesa con sus cotas: `13.21 × 1.87 cm` de cabecera, `eje 5.04 × 12.16 cm · 13 pt`, `barras 7.84 × 12.16 cm · 13.9 pt · barra 1.86 cm`— y los dos pies llevan **solo un rectángulo morado**, que es el borde de placeholder, sin una sola cota. Contado: `.guia_ph_grobs()` se llama desde **dos** graficadores —`graficador_barras_apiladas.R:2852` y `graficador_barras_agrupadas.R:1631`— de los **~20** del paquete. Pie, radar, categóricas, divergentes, boxplot, lollipop, dumbbell, serie temporal y nube de palabras no la tienen. `graficador_dimensiones.R` tiene un tercer sistema aparte (`.dim_wrap_debug_canvas()`), que solo envuelve un borde. Es exactamente el encargo de Gonzalo sobre el recetario —«no solo para un tipo de gráfico sino para todos los tipos»— visto desde el lado de las guías. ☑ **EL PIE YA LLEVA LA MISMA GUÍA**. Tres piezas: (1) `.guia_envolver_bloque()` —enganche reusable para cualquier graficador compuesto con `cowplot`, no sólo el pie—; (2) `.guia_nota_pie()`, que dice el **radio** y, en un donut, su **hueco**: la cota de la caja dice cuánto mide el hueco, pero el círculo se inscribe en su lado corto y sin eso dos pies con cajas distintas se ven distintos sin que la guía diga por qué; (3) el pie deja de dibujar en morado `#8A2BE2` de 2.8 pt y pasa al turquesa fino de la guía. Sale acotado en las cuatro bandas: `cabecera · 15.75 × 1.38 cm · 11 pt` · `panel · 15.75 × 5.44 cm · radio 2.72 cm  hueco 1.50 cm` · `leyenda · 15.75 × 1.21 cm · 8 pt` · `pie · 15.75 × 0.52 cm · 8 pt`. Dos estorbos vistos en el render y arreglados: la cota de ancho se repetía **cinco veces idéntica** en bandas apiladas a todo el ancho (`cota_ancho = FALSE`), y el rótulo pisaba el título porque los dos arrancan arriba a la izquierda (`rotulo_derecha = TRUE`). Los dos parámetros van con el comportamiento de antes por defecto, así que barras no cambia. Vara **17**, sin moverse: la guía es de depuración y el mazo la lleva apagada. **Quedan 17 graficadores sin ella**; `graficador_dimensiones.R` sigue con su tercer sistema (`.dim_wrap_debug_canvas()`), que sólo envuelve un borde |
| P34 | **El radar marcaba sus cajas sin una sola cota** (continuación de P33) | `.ph_border()` en `graficador_radar.R` · `.guia_nota_radar()` | ☑ **REPARADO**. El radar ya usaba el turquesa de la guía, pero su `.ph_border()` dibujaba **solo el rectángulo**: seis cajas marcadas y ninguna medida. Ahora llama a `.guia_ph_grobs()` y sale acotado: `cabecera · 25.40 × 2.83 cm · 12 pt` · `panel · 14.48 × 6.04 cm · 5 ejes  etiqueta 24 car.` · `tabla nativa · 10.16 × 4.72 cm` · `leyenda · 14.48 × 2.83 cm · 8 pt` · `pie · 25.40 × 1.51 cm · 8 pt`. **Una cifra falsa retirada antes de commitear**: la primera nota decía «tela 3.02 cm», que es `min(w,h)/2` —el radio inscrito en la CAJA—. Mirado el render, el polígono **no se inscribe**: en esa caja de 14.48 × 6.04 el pentágono dibujado medía la mitad, porque su tamaño sale de `radar_scale` y de la expansión de la escala, en coordenadas que la nota no ve. Es el defecto de **P24** otra vez —una cota que mide el nominal y no lo dibujado— y antes que una cifra falsa, ninguna. En su lugar van los ejes y el ancho de envoltura de sus etiquetas, que sí son datos reales de diseño. El pie **sí** declara su radio porque ahí el círculo se inscribe de verdad, comprobado en su render: por eso son dos notas distintas y no una compartida. Vara **17**, sin moverse. **Quedan 16 de ~20 graficadores sin guía** |
| P35 | **El recetario de guías, graficador por graficador** (continuación de P33 y P34) | `.guia_envolver_bandas()` · numéricas · boxplot · dimensiones · media-rango | ☑ **CORRIGE MI PROPIO PLAN, y con eso el conteo**. El encargo decía «empezar por `graficador_barras_categoricas.R`»: ese archivo **no compone canvas** —cero `cowplot`, cero `debug_ph`—, devuelve un ggplot suelto y no tiene bandas donde poner una cota. Inventario medido de los **17** archivos que definen un `graficar_*`: **ocho** componen canvas con `cowplot` y los otros **nueve** no (categóricas, divergentes, dumbbell, lollipop, nube de palabras, puntos comparativos, serie temporal, mapa de cobertura, ppt). Así que no eran «16 de ~20 sin guía»: eran **cuatro de los ocho que pueden tenerla**. **Hechos en este tick**: `barras_numericas` pasa a `.guia_envolver_bloque()` con sus cuatro bandas acotadas —`cabecera 16.51 × 1.19 cm · 11 pt`, `panel 16.51 × 6.22 cm`, `leyenda 16.51 × 1.10 cm · 8 pt`, `pie 16.51 × 0.55 cm · 8 pt`— y deja su **tercer** estilo propio (`#8A2BE2`, grosor 2); `boxplot` recibe la cota de su canvas entero y también deja el suyo. **`dimensiones` hecho**: su `.dim_wrap_debug_canvas()` —el tercer sistema, 29 apariciones— delega ahora en `.guia_envolver_bloque()`. Sus dos bloques de bandas apiladas (heatmap y FODA) salen acotados; el FODA da `panel 21.59 × 11.07 cm` y `leyenda 21.59 × 1.37 cm`. Sin `ancho_in`/`alto_in` sale solo el marco, que es el comportamiento de antes: por eso los dos llamadores que envuelven el canvas entero siguen sin tocarse. **El render cazó lo que 149 tests verdes no**: el bloque FODA no declara `size_leyenda` —su leyenda son iconos, no texto— y mi nota lo invocaba; reventaba en ejecución. Las suites pasaban porque ninguna enciende `debug_ph_bordes`. **CERRADO**: los **ocho** graficadores con canvas llevan ya la misma guía. `boxplot` y `media_rango` componen igual —acumulan `pieces` y `relh` y los apilan de una vez—, así que en vez de dos parches se hizo **un helper compartido**, `.guia_envolver_bandas()`, que envuelve la lista entera al final: un solo punto de cambio y cada banda con su alto real. Los dos dejan su marco alrededor del conjunto, que era una línea que no medía nada nuevo. Boxplot: `cabecera 20.32 × 1.60 cm` · `panel 20.32 × 9.03 cm` · `pie 20.32 × 0.69 cm`. Media-rango: las mismas tres. Vara **17**, sin moverse |
| P36 | **La vara medía una paleta y el mazo tiene dos** (hallazgo propio) | `medir_mazo()` · `calibrar_umbrales()` · reglas **R10** y **R11** | ☑ **REPARADO — y la cuenta sube porque se empieza a medir, no porque empeore**. `barras_por_grafico` salía de `barras_escala`, que sólo cuenta la **rampa**, y el techo se aplicaba luego a las dos paletas. Medido con el mismo filtro que usa la regla, los gráficos **azules** del aprobado llegan a **8 barras** y a **1.8049 cm** de grosor, y nada de eso lo miraba nadie. `medir_mazo()` gana `barras_categorico`; `calibrar_umbrales()` deriva los dos techos; **R10 grosor categórico excesivo** y **R11 barras por gráfico categórico** los aplican. Resultado: **aprobado 25 con CERO de las reglas nuevas** —cumple sus propios techos por construcción— y **motor 17 → 23, con SEIS**: cuatro barras por encima de 1.81 cm (dos de 2.75 y dos de 2.20) y dos gráficos de 9 barras donde el aprobado no pasa de 8. Defectos reales que llevaban ahí desde siempre. **Dos decisiones de calibración, cada una medida**: los techos van al **máximo** del aprobado y no a su p90 —con el p90 el de grosor marcaba **3 de los 25 gráficos del propio aprobado**, y un techo que la referencia no cumple no mide conformidad—; y el redondeo va **hacia arriba** (1.81, no 1.80) porque el valor exacto es 1.8049 y a dos decimales hacia abajo la referencia incumplía por cinco milésimas. La cola de grosor ya estaba medida y sin regla desde hace tres ticks: es la misma raíz que P23, pocas filas estirándose en un hueco alto |
| P37 | **Los seis que destapó P36** (continuación) | `.PARTICION_MAX_BARRAS_DICOTOMICA` · techo de grosor descartado de nuevo | ◐ **R11 cerrada, R10 a la mitad — vara 23 → 20**. **R11 (×2)**: `.PARTICION_MAX_BARRAS_DICOTOMICA` valía 12 y era **otra vez la unidad equivocada**. El 12 salió de medir barras **por lámina** del aprobado, donde llega a doce —su lámina 18—, pero esas doce son **ocho azules más cuatro de rampa**: dos paletas en una misma lámina. Un elemento dicotómico suyo no pasa nunca de **ocho**, que es justo lo que mide R11. Bajado a 8: **R11 2 → 0**, R10 4 → 2, vara 23 → 20, y el relleno de la zona útil no se mueve (89.2 → 89.1 %, mismas 70 láminas): no reabre P23. **R10 (×2 restantes)**: el techo de grosor se repitió con el estado de hoy —reserva ya reparada y la azul ya medida— porque un descarte sólo vale para el estado en que se midió. **Se descarta otra vez, y ahora se sabe por qué**: máximo azul 2.751 → 2.551, p90 2.20 → 2.08, **R10 4 → 4 (no quita ni uno)** y la vara sube a 24 con un R5 nuevo. La razón estructural, anotada en `graficador_grosor_piso.R`: la barra sale gruesa porque su **fracción de fila** (`grosor_eff`) es alta, no porque la fila sea alta. Recortar el panel acorta la fila —y devuelve el hueco de P23— sin bajar la fracción. El único lever que funcionaría es `grosor_eff`, y **el `geom_col(width = grosor_eff)` se construye ANTES de que se conozca el alto físico de la fila**: el graficador decide la fracción sin saber cuántos centímetros mide lo que dibuja. Arreglarlo exige **reordenar** —calcular el alto del canvas antes del geom—, no ajustar una constante |
| P38 | **El techo de grosor no tenía consumidor porque se buscaba en el sitio equivocado** (P25 cerrado de verdad) | `.grosor_con_techo_in()` junto a `.grosor_con_piso_in()` en `graficador_barras_apiladas.R:1901` | ☑ **ADOPTADO**. El techo se había intentado enganchar en el bloque de estirado, **mil líneas más abajo**, donde recorta el **panel** en vez de la fracción y devuelve el hueco vacío de P23 —descartado dos veces con medición—. Su sitio natural es la línea donde ya vive el **piso**, con el mismo alto de fila: el piso evita la cinta, el techo evita el ladrillo. Medido: el **p90 del grosor azul cae de 2.20 a 1.51 cm** (el aprobado está en 1.43) **sin mover ninguna regla** —vara 20 antes y después— y sin que aparezca ni un R5, porque piso y techo no pueden cruzarse (0.32 in siempre por debajo de 0.7087). La lámina 17 pasa a verse como el aprobado: 8 barras en dos bloques de 4. **Límite medido**: el máximo sigue en 2.75 y los **dos R10 no se mueven** — salen del estirado, que ocurre después y no ve esta fracción. Es el mismo diagnóstico de `.GROSOR_TECHO_IN` |
| P39 | **B4 gemelas desiguales: la comparación 8 contra 5 no es lo que parece** | `.verif_gemelas_desiguales()` · grupo `rampa:4` del motor | ◐ **CORRIGE LA PREMISA CON LA QUE ENTRÉ**. El encargo decía que B4 era «la única familia donde el motor está PEOR que la referencia». **No lo está**: la regla cuenta **grupos de firma**, no láminas, y en las tres medidas comparables el motor gana — max **0.879 vs 1.013**, media **0.391 vs 0.597**, mediana **0.305 vs 0.485**. Tiene más grupos (8 vs 5) porque tiene **70 láminas con más variedad de firmas** contra 63: un mazo con más tipos distintos recibe más hallazgos a igualdad de calidad. Perseguir el 8 hasta el 5 sería perseguir un artefacto de composición, y queda anotado junto a la regla. **Lo que sí es real es la dispersión dentro de un grupo.** El peor es `rampa:4`, siete láminas: **2.16 · 2.16 · 2.20 · 1.78 · 1.78 · 1.32 · 1.52 cm** — la misma clase de lámina con barras que varían casi el doble, y se agrupan en subfamilias (tres altas, dos medias, dos bajas), lo que apunta otra vez al estirado y no al número de barras. **MEDIDO Y CERRADO: la dispersión que queda tiene causa legítima.** Las siete láminas de `rampa:4` tienen **exactamente la misma geometría** —placeholder en 1.21 con 5.51 de alto, pie en 6.93, título en 0.37— y exactamente **un gráfico de cuatro barras sin azul**. No es el alto de la leyenda, ni el del pie, ni el número de bloques. Lo que cambia es el **alto de la etiqueta de eje**: las de 1.32 y 1.52 llevan cuatro premisas con enunciados de **cuatro líneas**, y el graficador les baja la fracción para dejar aire entre barras. El aprobado hace lo mismo y con más amplitud —su peor grupo dispersa 1.013—. **Y exonera a P38 con medición**: sospeché que mi techo hubiera adelgazado justo esas láminas; quitándolo, los siete grosores salen **idénticos** (2.16 · 2.16 · 2.20 · 1.78 · 1.78 · 1.32 · 1.52) y B4 da los mismos 8 grupos con max 0.879. El techo no toca este grupo — actúa en la azul, donde bajó el p90 de 2.20 a 1.51 |
| P40 | **La leyenda pisa la etiqueta del último eje** (hallazgo del render, lámina 60) | `graficador_barras_apiladas.R` · reparto de la banda de leyenda | ☐ visto al mirar la lámina 60 «Vinculación con el medio»: su cuarta premisa —«La Unidad fomenta actividades de responsabilidad social por los docentes.»— tiene cuatro líneas y **la leyenda se le monta encima**. Es la misma familia de P22 (leyenda partiéndose sobre el enunciado), que se cerró; aquí reaparece cuando el enunciado es de cuatro líneas. ◐ **DIAGNOSTICADO CON MEDICIÓN, sin reparar todavía**. No es la banda de la leyenda ni el alto de la etiqueta: **es el centro**. Medido en el render, `pos_leyenda_x <- 0.5` la centra sobre **todo el canvas**: **aprobado** — barras en 5.50 in, leyenda en **6.98**, a la derecha de las barras. **Motor** — barras en 3.45 in, leyenda en **1.95**, o sea **1.50 in dentro de la columna de etiquetas**. Y **no es problema de ancho**: la leyenda mide 9.28 in de las 13.33 del canvas, cabe de sobra. El aprobado la centra sobre el **área de barras**. **IMPLEMENTADO A MEDIAS, con el límite medido.** `pos_leyenda_x` pasa de `0.5` a `x_bars0 + w_bars / 2`, el centro del área de barras. Se tocó **sólo el centro** y no el ancho que recibe `.barras_leyenda_filas()`: cambiar ese ancho le haría ganar una fila y comerle alto al panel, que es territorio de P23 y B3. **Funciona en las apiladas**: la lámina 48 pasa de tener su leyenda centrada en el canvas a tenerla bajo las barras (5.84–7.19 in). Vara **20**, sin moverse; gate 208/208. ☑ **CERRADO, y el primer arreglo estaba en la rama muerta.** `pos_leyenda_x` vive en el **`else`** de la composición de leyenda, que este mazo no toma. La rama viva compone la leyenda **ítem a ítem** y su centro es `x_origin <- 0.5 - row_w / 2`. Lo trazado: **232 llamadas** con `canvas=TRUE leyenda=TRUE pos=abajo` y **cero** en la otra rama. Movido allí —`x_origin <- centro_barras - row_w / 2`, con recorte para que una leyenda más ancha que su área se apoye en el borde antes que desbordar— la lámina 60 queda **reparada**: la leyenda se corre **1.34 in a la derecha** y «los docentes.» se lee entero. Vara **20**, sin moverse; gate 215/215. El cambio de `ddd9d964` se conserva: es correcto para quien tome esa rama, sólo que este mazo no la toma |
| P42 | **La etiqueta de eje de dos líneas se monta sobre la fila vecina** (hallazgo del render, barrido de láminas 8–16) | `graficador_barras_agrupadas.R` en panel de cuarto de lámina | ◐ **VISTO Y LOCALIZADO, sin reparar**. En la lámina 13, «Sueldo mensual bruto»: la etiqueta **«Entre 1500 y 3000 soles»** envuelve a dos líneas y su segunda línea —«soles»— cae **encima de la siguiente**, de modo que se lee «Entre 3001 y 45**soles**». **Cuatro etiquetas ilegibles en un solo gráfico**, y el mismo defecto en la **10** (departamentos académicos) y la **12** («No he encontrado trabajo desde que egresé» sobre «Entre 6 meses y 1 año»). Todas son `p_barras_agrupadas` dentro de **láminas de cuatro paneles** (`superior_izquierda` / `superior_derecha` / `inferior_izquierda` / `inferior_derecha`): el panel es un cuarto del canvas, la etiqueta envuelve, y **el alto de fila sigue calculado para una línea**. Es justo el carril **R-H** del recetario, que nunca tuvo barrido propio. `ancho_max_eje_y` viene por defecto en las cuatro láminas. **MEDIDO: `agrupadas` no contempla el envolvimiento** —cero apariciones de `needs_tall_label_slot` contra **diez** en `apiladas`—. Todo su bloque de wrap mira el ANCHO y nada mira el alto. Construidos `.agrupadas_lineas_eje()` —cuántas líneas produce `str_wrap` de verdad, que no es dividir caracteres— y `.agrupadas_size_que_cabe()` —el cuerpo que cabe en una fila dada, con piso de 8 pt porque una etiqueta ilegible no es mejor que una solapada—, los dos con tests. **Y comprobado en la lámina que originó el hallazgo: todavía NO muerde.** Trazado sobre la 13 llega `canvas=TRUE orient=horizontal ncat=6 wrap=38 forzar=FALSE alto=6`; con esas cifras la cuenta dice que las dos líneas **caben** —0.43 in de texto en una fila de 0.62— y en el render se solapan igual. **CAUSA LOCALIZADA, y está fuera del graficador.** Medido el paso de fila en el PNG de la 13: **~0.35 in**, un **57 %** de las 0.62 estimadas. El `alto = 6` que recibe el graficador **es el default de su firma, no el alto del cajón**. `reporte_plan_ppt.R` tiene `.render_element(el, ancho_slot)`, que inyecta `overrides$ancho` con el ancho físico del cajón —eso es H22, y lo usan **25 llamadas**— pero **no existe un `alto_slot`**: el alto nunca viaja. En una lámina de cuatro paneles el graficador cree tener seis pulgadas de alto donde tiene tres, así que **cualquier** cuenta vertical suya se equivoca por ese factor. **MECANISMO CONSTRUIDO, falta enchufarlo donde toca.** `.render_element(el, ancho_slot, alto_slot)` inyecta ya `overrides$alto`, y el bloque de cuatro paneles (~8748) le pasa `.PANELES_4_ALTO_SLOT_IN = 2.56` —medido en el XML: los cuatro cajones de la 13 son **5.17 × 2.56 in**—. Línea base del congelado subida deliberadamente **9701 → 9713**. **Pero la lámina 13 sigue recibiendo `alto = 6`.** Trazado tras el cambio: de las 60 llamadas, **40 llegan con 6 y 20 con 2.95**, y la del sueldo está entre las de 6. Pasa por **otro** de los ~10 sitios que pasan `ancho_slot = 6.1` —hay bloques en 8421, 8631, 9033, 9128, 9217, 9302—, no por el que se enganchó. **☑ CERRADO — estaba enchufado en el layout equivocado.** No hizo falta trazar: el plan lo dice. Las seis láminas de cuatro paneles del mazo (9–14) son **todas** `p_slide_4_graficos_poblacion` → bloque **`poblacion_4`** (~8893, `ancho_slot = 5.2`); de **`paneles_4`** —el bloque que enganché, ~8748— **no hay ni una**, y su layout **ni siquiera existe en la plantilla**. Por eso el render salió idéntico y la vara no se movió: nada avisaba. Medido en `slide13.xml`, los cuatro grupos de nivel superior son **5.169 × 2.565 in** —el 5.2 que ya viajaba cuadra con ese 5.169—. La constante se renombra a `.POBLACION_4_ALTO_SLOT_IN = 2.565` y `paneles_4` se queda **sin** alto: su cajón no está medido. **Verificado en el render**: las seis etiquetas de «Sueldo mensual bruto» se leen enteras y el cuerpo baja de 13 a **7.99 pt**. **La vara sube de 20 a 21 y se conserva, con la medición anotada en el código**: entra un B3 en la lámina **9** con valor **0.07** —el mínimo del conjunto, empatado con los de la 30 y la 38, que ya se aceptaban— y la 10 y la 14 pasan de 0.26 a 0.28. B3 comparaba grosores sobre un lienzo **ficticio** de seis pulgadas: cuatro paneles igualmente equivocados daban grosores iguales. Con el alto real aparece una diferencia que siempre estuvo ahí; restaurar el 6 la taparía y devolvería las cuatro etiquetas ilegibles. Tests `test-poblacion-4-alto-slot.R` **10**, que miran el **código fuente** del renderer y no sólo la constante —una prueba sobre la constante pasa con el arreglo puesto en cualquiera de los dos bloques, que es justo lo que no distingue—; rojo comprobado devolviendo el `alto_slot` a `paneles_4` (2 fallos). Gate 220/220, línea base del congelado **9713 → 9716**. Commit `af6a459c` |
| P43 | **El aprobado no envuelve ninguna etiqueta: ensancha la columna, no encoge el texto** (medido al cerrar P42) | `graficador_barras_agrupadas.R` · reparto ancho entre columna de etiquetas y área de barras | ☐ **ABIERTO, con la cifra**. Misma lámina 13, mismo gráfico «Sueldo mensual bruto». Leídos los `sz` del XML: el **aprobado** pone las seis etiquetas a **13 pt en una sola línea** —«Entre 3001 y 4500 soles» entera—; el **motor** las envuelve a dos líneas y baja a **7.99 pt** para que quepan. O sea que la diferencia no está en el tamaño del texto sino en el **ancho de la columna de etiquetas**: el aprobado le da la que necesita y le quita al área de barras. Encoger es correcto como último recurso —y es lo que P42 dejó funcionando—, pero el **primer** recurso debería ser ensanchar. **Ojo al orden**: tocar el ancho de la columna mueve `x_bars0`/`w_bars`, que es lo que P40 usa para centrar la leyenda, y mueve el grosor, que es B3. **☑ CERRADO — el criterio sobraba por defecto, y por un solo carácter.** Medidas las cajas en el XML: la columna de etiquetas del **aprobado** va de 8.68 a ~10.50 (**1.82 in**) y la del **motor** de 7.78 a 9.71 (**1.93 in**) — o sea que el motor tenía **más** sitio y envolvía igual. La causa no era geométrica: el bloque **H22** decide con `char_in <- size * 0.55 / 72`, un ancho medio **estimado**. Con el cajón de 5.2 in y la fracción 0.45 la columna es **2.22 in**, y el estimado le calculaba a «Entre 1500 y 3000 soles» —23 caracteres a 13 pt— **2.28 in**: la rechazaba **por un carácter**, envolvía a dos líneas, y el ajuste de P42 bajaba el cuerpo a 7.99 pt. Medida con `systemfonts::string_width()`, esa etiqueta en Arial 13 pt mide **1.958 in** — cabía con un cuarto de pulgada de sobra. **Y el 0.55 no era arbitrario**: sobre las **1.174** formas de texto de una corrida del mazo, `ancho_caja / (n_car · pt/72)` da mediana **0.507** y p75 **0.552**; es el percentil 75 de las **cajas** —relleno y alineación incluidos—, no el ancho del texto. Se conserva como respaldo. `.chars_que_caben()` (archivo propio, `graficador_ancho_texto.R`, porque `apiladas` hace la misma cuenta) devuelve el largo entero cuando la peor etiqueta cabe y, si no, deriva el presupuesto de su ancho **medido**; la peor es la que más **ancho** pide, no la que más caracteres tiene. `systemfonts` a Suggests con guardia —ya llega por `rvg` → `gdtools`—. **Verificado en el XML**: las seis etiquetas salen a **13.00 pt en una línea** cada una. Miradas también la **10** y la **12**: las suyas siguen envolviendo porque de verdad no caben, y se leen sin solaparse. **La vara no se mueve**: 21 → 21, mismos seis grupos de regla y mismos ocho B3 lámina a lámina. Tests **23**, rojo comprobado (2 fallos). Una expectativa escrita a ojo salió al revés —«1 1 1 1 1 1 1 1 1 1» mide **más** que «MMMMMMMM»— y la medición corrigió la prueba, no el código. Commit `5c74272a` |
| P44 | **B3 en la lámina 9, valor 0.07** (lo destapó P42) | `.verif_grosores_desiguales()` en `graficos_verificar_mazo.R` | **☑ CERRADO POR MEDICIÓN, y el diagnóstico se mudó de sitio.** La regla compara todos los gráficos de una lámina vengan de la rampa o de la azul. Partiendo las láminas de dos o más gráficos en dos grupos, sobre `p45.pptx` contra el aprobado: **mixtas (rampa + azul)** motor 7 láminas / 5 sobre umbral / max **0.424** / suma **0.841**, aprobado 10 / 2 / **0.150** / **0.201**; **de una sola paleta** motor 5 / 3 / 0.279 / **0.676**, aprobado 5 / 4 / 0.221 / **0.706**. En las de una paleta **el motor ya va mejor que la vara** —tres hallazgos contra cuatro y menos suma—, y la lámina 9 es de ese grupo: está **0.23 mm** por encima de un umbral de 0.05 cm. Perseguirla sería perseguir lo que la referencia hace peor. Las cifras quedan junto a la regla para que ningún turno vuelva a apuntar ahí. Commit `b5146847` |
| P45 | **Una lámina mixta no pone de acuerdo sus dos bloques** (sale de partir P44) | los dos bloques se reparten el alto dentro del MISMO canvas | ◐ **MEDIDO, y la causa está fuera del grosor.** La lámina 41 tiene **un solo grupo de nivel superior** (12.511 × 5.512 in): los dos bloques los compone el graficador, no el renderer — así que `reporte_plan_ppt.R` **no** hace falta tocarlo. Bandas medidas: rampa **1.609→2.544 = 0.936 in** para 2 filas (paso **0.525**), azul **3.988→6.043 = 2.055 in** para 3 filas (paso **0.739**). El aprobado hace lo contrario en su peor mixta (lámina 39): rampa 1.622 in / paso **0.993**, azul 2.052 / paso 0.746, grosores 1.600 y 1.450 → dif 0.15. O sea que **al bloque que más necesita —el del enunciado de seis líneas— el motor le da menos**, y por eso sus barras adelgazan a 1.041 mientras el azul se estira a 1.466. En el render se ve además un **hueco de ~1.2 in** entre los dos bloques y el enunciado **pisando la leyenda**. Depende de P46: si el enunciado deja de necesitar seis líneas, el reparto se descomprime solo |
| P46 | **22 enunciados cortados a media frase, en 16 láminas de 66** (el aprobado tiene CERO) | `.barras_acotar_titulo_grupo()` en `graficador_helpers_titulos_grupo.R` | ☐ **ABIERTO — el hallazgo más grande de la sesión, y salió mirando la 41.** Contados los `<a:t>` que terminan en «…»: motor **22 en 16 láminas** (25, 26, 29, 30, 31, 38, 39, 41, 43, 49, 57, 59, 60, 65, 68, 69), aprobado **0**. Una de cada cuatro láminas entrega una pregunta cortada. El motor **ya lo sabe y lo avisa**: 23 `[PULSO-AVISO] Enunciado recortado…` en la corrida. **La causa no es el wrap** —`.barras_wrap_titulo_grupo()` ya mide con `textGrob`, no estima—: es el **ancho del canal**. Medido en el XML de la 41, «La Unidad facilita los medios necesarios…» vive en **1.492 in a 14 pt**; el aprobado pone sus enunciados largos en cajas de hasta **6.675 in a 13 pt** (su lámina 35, ocho líneas sin recortar). **Más de cuatro veces el ancho y un punto menos de cuerpo.** El consejo del aviso —ensanchar «Columna de grupo»— es correcto pero es global a todas las multi-apiladas y se lo lleva el analista; lo que falta es que el motor ensanche cuando no cabe, igual que P43 hizo con la etiqueta de eje, y `.chars_que_caben()` ya está para decidirlo midiendo. **MEDIDO EL MISMO ENUNCIADO EN LOS DOS MAZOS.** «La Unidad facilita los medios necesarios para que…» sale en la **lámina 39 del aprobado** en un canal de **2.678 in a 13 pt, seis líneas, entero**; en la **41 del motor**, en **1.492 in a 14 pt, recortado**. Y el aprobado **no tiene tope de líneas por fila**: su lámina 29 llega a **nueve y hasta doce líneas a 12 pt** en canales de 2.4–3.2 in. Su regla no es «tantas líneas por fila» sino «el canal que el texto necesite, y si hace falta un punto menos de cuerpo». **◐ DE 22 A 10, y las dos causas medidas.** Dos hipótesis descartadas por medición antes de acertar: **no** era `w_group / w_sum` (la 41 llega con `w_sum = **1.02**` y fracción 0.2157; el «0.22/1.85 = 0.119» era coincidencia aritmética) y el 1.492 in del XML **no** era el canal (es la caja del **texto**, que `draw_text` ajusta a lo dibujado). **Causa 1 — el cajón no llegaba al subbloque.** `ancho` valía **10** (default de la firma) mientras la lámina se dibuja a **12.511 in**, en **20 llamadas** de la pasada de PPT: el enunciado se envolvía un **22 %** más estrecho que su sitio. En `multilista` cada subbloque es un `ppt_element` propio que se renderiza sin pasar por `.render_element()`, y el bucle ya heredaba `excluir_opciones`, `row_step_forzado`, `bases_publico` y `legend_key_aspect_yx` — **el cajón no estaba en esa lista cerrada**. Reparado con `.multilista_heredar_cajon()`; caja de texto de la 41 **1.492 → 1.794 in**. **Truncados 22 → 21**: no bastaba. **Causa 2 — el cupo, y la palanca es el CUERPO.** Trazado sobre la corrida entera (191 llamadas, 21 recortes): casi todos bloques de **una fila** pidiendo 4–11 líneas contra un cupo de 2–6, con el bloque midiendo **0.399–1.302 in** y el cuerpo siempre **14 pt**. El aprobado pone **12 pt** en su lámina 29 (nueve y doce líneas) y **13** en la 35 y la 39. `.titulo_grupo_size_que_cabe()` baja el cuerpo **re-envolviendo a cada candidato**, con piso **11 pt** y **un solo cuerpo por lámina** —como el aprobado—. **Resultado: truncados 21 → 10, de 16 láminas a 8** (quedan 25, 30, 31, 38, 41, 57, 59, 69). La cuenta estática predecía cinco salvados y fueron **once**: a menor cuerpo cada línea lleva más texto. **La vara no se mueve**: 21 → 21, mismos ocho B3 lámina a lámina. **Y el coste, que era el riesgo**: probar candidatos disparó la corrida de ~235 s a **1.054 s**. `.barras_wrap_titulo_grupo()` es pura y se repetía, así que lleva cache por `(texto, columna, ancho, cuerpo, tipografía)`: la corrida baja a **154 s**, **más rápida que antes del cambio**, con render idéntico. Tests **16**, rojo comprobado (2 fallos). Commits `2af12d9b`+`8fa60752`+`5e7409e6`+**`ca8f2559`** |
| P13 | Resultados I+D+i: leyenda comprimida y sus cuadros de color **rectangulares**; deben ser más cuadrados | leyenda manual de apiladas | ◐ **medido**: lám 68 usa `0.54×0.54` (ggplot, cuadrado) y lám 69 `0.40×0.29` (manual, rel 1.38). El motor es inconsistente consigo mismo. **Pero el aprobado usa `0.29×0.21`, la misma rel 1.38**: la referencia no decide, decide Gonzalo |

### El defecto que estaba detrás de varios a la vez

`normalize_block()` decidía por presencia: si el bloque de preset traía `args`,
lo devolvía tal cual. El caso MIXTO —claves sueltas **y** `args`, que es como lo
guarda la UI— perdía **todas las sueltas sin avisar**, y el render sólo lee
`args`. En `barras_agrupadas` de Contabilidad llegaba **1 clave de 9**; en
`multi_apiladas`, 2 de 11. El analista configuraba y el mazo salía con los
defaults del motor.

Al repararlo, el mazo pasó de 9 incumplimientos a 6 y **R5 se cerró solo**
(5 → 0): el grosor categórico que llevaba tres iteraciones sin arreglarse
estaba configurado en el proyecto y no llegaba. También destapó que el proyecto
pedía `canvas_gap_grupos = 0.65`, que empeoraba B2 de 4 a 15; se subió al 0.85
calibrado contra el aprobado.

**Estado del mazo**: 6 incumplimientos —B2 ×4, R3 ×1, R7 ×1 (deliberado: la
ficha sigue al aprobado, que la pone a 0.57)—, mínimo categórico 0.70 cm y cero
cifras ilegibles.

**Los P sin marcar siguen pendientes de verse en el PDF de PowerPoint.** Los
cerrados se cerraron midiendo el XML contra el aprobado, que no depende del
render.

## P16 — dos láminas del mismo tipo no salen iguales

Medido sobre el mazo, agrupando por número de filas de barra:

| Filas | Láminas | Paso dentro del bloque | Hueco entre bloques |
|---|---|---|---|
| 3 | 4 | **1.40 – 2.59 cm** | 2.59 – 4.78 |
| 4 | 3 | 1.75 – 2.05 | 3.23 – 3.80 |
| 5 | 8 | 1.49 – 1.70 | 2.76 – 3.15 |
| 6 | 6 | 1.25 – 1.47 | 2.32 – 2.73 |
| 7 | 3 | **1.24 idéntico** | **2.29 idéntico** |

Las de siete filas salen clavadas entre sí; las de tres varían casi al doble. Es
decir: **el motor sí sabe ser consistente**, y deja de serlo cuando algo más que
el número de filas entra en el reparto —el número de bloques y su cromo—.

Es el mismo defecto raíz que P14, un escalón más arriba: allí eran dos bloques
de una lámina, aquí son dos láminas del mismo tipo. Y explica el síntoma que
abrió este punto: «veo demasiadas cosas que difieren en el mismo tipo de gráfico
y slide».

**Precisión al medir mejor**: agrupar por número de filas mezclaba casos que no
son comparables —«3 filas en un bloque» y «2+1 en dos bloques» reparten
distinto por diseño—. Agrupando por patrón exacto, **las tres láminas que
comparten patrón salen idénticas** (grosor 2.02, pasos 2.59/4.78). El motor sí
sabe ser consistente; lo que dispersa es que patrones distintos den resultados
muy separados: **0.65, 1.09, 1.65 y 2.02 cm** en láminas de tres filas.

**Una hipótesis descartada con medición**: si la dispersión fuera de redondeo,
una rejilla al milímetro la colapsaría. Aplicada a todo el mazo bajó de **22
grosores distintos a 21** —el aprobado tiene 17—, así que no hay valores casi
iguales que juntar: son grosores genuinamente distintos. La rejilla se revirtió;
el helper queda documentado con el dato que lo descarta.

El aprobado, para comparar: 408 barras, 17 valores, y **153 en un solo grosor**
(1.30 cm). El motor: 411 barras, 22 valores, 96 en el suyo. La diferencia no es
el rango —los dos van de 0.65 a ~1.8/2.0— sino la **concentración**.

### El texto más pequeño del mazo, y por qué R3 no lo veía

El mínimo del motor era **7.39 pt** —cifras blancas dentro de los segmentos de
pie en los cuadrantes de perfil, `31% (56)`— contra los **8.0 pt** que el
aprobado nunca baja. El piso vivía en `max(2.6, ...)` del graficador de pie:
2.6 unidades ggplot son exactamente 7.39 pt.

**R3 no lo detectaba** y no lo detectará: mide la PROPORCIÓN de texto bajo 12 pt,
y ocho textos sobre 2459 no la mueven. De hecho R3 sigue marcando 7.8 % contra
el 6.2 % del aprobado por una razón que no es tipográfica: el motor tiene **2459
textos y el aprobado 4186**, con un número parecido de pies «Base: …» a 11 pt.
Menos texto total, misma cantidad de texto pequeño, peor proporción.

Por eso el piso lleva su propio test que lee el literal del archivo: una
regresión ahí sería invisible para la vara.

### Por qué dos bloques de la misma lámina no comparten grosor (P14)

Una lámina `multilista` dibuja **cada bloque en su propio canvas** y luego
`plot_grid()` los escala con alturas relativas que **incluyen el cromo** de cada
uno —título, filas de leyenda, columna extra—. Como el cromo no es proporcional
al número de barras, el grosor final no puede coincidir: la guía muestra que el
graficador pide 1.29 y 1.20 cm, casi lo mismo, y salen 1.19 y 0.90.

Es el mismo defecto raíz que R5 y P13: **el grosor se decide sin saber el alto
real del cajón**. Aquí además se decide por bloque en vez de una vez por lámina.

Medido al detalle: arriba la fracción es 1.19/3.61 = **0.33** y abajo
0.90/3.43 = **0.26**. La diferencia viene de `row_step_eff`, que se infla cuando
un bloque tiene pocas categorías con etiquetas largas —`n_categorias <= 4 &&
max_lineas_eje_y >= 5`— y en multilista **cada bloque lo decide por su cuenta**.
Compartirlo exige exponerlo como override y fijarlo una vez por lámina: es la
unidad pendiente principal.

## Lo que encontró un barrido propio, sin que nadie lo señalara

Comparando tipografías, tamaños y colores del mazo entero contra el aprobado:

| | Motor | Aprobado |
|---|---|---|
| Tipografías | Arial 2378 · **Helvetica 22** | Arial 2331 · nada más |
| Tamaños dominantes | **15.93 pt ×826 · 15.99 ×651** · 14 ×472 | 14 ×799 · 12 ×700 · 13 ×436 |
| Gris `BFBFBF` | 452 | 196 |

Tres cosas que ninguna vara miraba:

1. **Dos tipografías** (P17), por textos que caen al default del device. Entraban
   por tres puertas: `cowplot::draw_text` sin `family`, `legend.text` del tema
   sin `family`, y dos sitios con **`family = "sans"`** —el alias genérico del
   device, que en el .pptx se resuelve a Helvetica—. Y una trampa: dos de esos
   `draw_text` se evalúan en un entorno que no ve el parámetro `font_family`;
   referenciarlo degradaba las dos láminas de radar a «Sin datos». Ahí va el
   literal.
2. **El motor escribe más grande**: su cuerpo dominante ronda los 16 pt y el del
   aprobado los 12–14. Y usa **15.93 y 15.99**, dos tamaños que difieren en seis
   centésimas de punto y deberían ser uno solo —la misma dispersión que P16,
   ahora en tipografía—.
3. **El gris `BFBFBF` aparecía 2,3 veces más.** Resuelto, y en el camino hubo
   que **corregir mi propia caracterización**: no era «el motor pinta más gris».
   Separando dónde vive cada uso, los 452 eran **dos poblaciones distintas**:

   | | Motor | Aprobado |
   |---|---|---|
   | Relleno de forma (`p:spPr`) | 204 | 196 |
   | Borde de celda de tabla (`a:lnL/R/T/B`) | **248** | **0** |

   En el relleno no había apenas diferencia —43 barras grises contra 35, ocho de
   más, coherente con que el estudio tenga algún «sin información» más—. Toda la
   brecha estaba en los **bordes de tabla**, que es otro asunto: el aprobado sí
   dibuja rejilla completa, pero en **`757070`** a 0.75 pt. El motor usaba el
   gris claro, que sobre el relleno `F2F2F2` del cuerpo casi no se ve. Ya son
   248 en `757070` y cero en `BFBFBF` (**P18**).

   La lección es del método: contar ocurrencias de un color en todo el XML mezcló
   rellenos con bordes y produjo un «2,3 veces más» que apuntaba al sitio
   equivocado. La cifra sólo significó algo al separar **dónde** vive cada uso.

### Tres capas entre el preset y la tabla del radar (P12)

El puente del ADR 0072 estaba entero y aun así no salía ni una tabla. Tres cosas
distintas lo cortaban, y cada una había que medirla aparte:

1. **`emitir_nativa` exigía `ocultar_radar`**: solo cubría la lámina de solo
   tabla, porque sin saber DÓNDE va, la única opción era el placeholder entero.
   Se resolvió adjuntando `geom_frac`.
2. **El modo `publicos` arma su propia tabla** con `tableGrob` y `plot_grid`, así
   que nunca pasaba por `graficar_radar()`.
3. **`el$tabla_nativa` era `FALSE`, no `NULL`**, así que el `%||%` jamás caía al
   preset del proyecto. El constructor lo forzaba con `isTRUE()`; un elemento
   tiene que poder NO opinar para que el preset decida.

Y una trampa al conectar: con geometría, `.dml_o_tabla()` devuelve la imagen —la
tabla va aparte—, pero el emisor solo está en la lámina de un gráfico. Si la
geometría se adjuntara también al caso «solo tabla», cualquier otra disposición
**perdería la tabla**. Se adjunta solo cuando el radar se ve.

### Dos accesores que truncaban en silencio

Al montar la leyenda aparecieron dos piezas que descartaban datos sin avisar, y
las dos habían pasado desapercibidas:

- **`.style_value()` devuelve `out[[1]]`**: cualquier valor vectorial declarado
  en un estilo llega truncado a su primer elemento. Los cuatro colores de la
  rampa llegaban como uno.
- **`first_col_pct` tenía piso 0.14**, pensado para la columna de criterio de la
  ficha técnica. Sobre un cajón de 31 cm eso son 4.38 cm: la primera columna no
  podía ser nunca un cuadro de leyenda.

### Por qué el marcador de leyenda se deforma (P13)

La leyenda manual calcula `aspect_yx = alto / ancho` del canvas para cuadrar la
marca, y el canvas declara **6 pulgadas de alto fijo** mientras el cajón real
mide 4.59. Con el aspecto equivocado la marca sale 1.38 veces más ancha que
alta. Es el **mismo defecto raíz que R5**: el graficador no conoce el alto de su
cajón. Repararlo de fondo es la unidad grande que sigue pendiente.

## Lo aprendido


- **Un layout no es un sitio: son diez.** El alto del cajón se enganchó en el bloque de cuatro paneles y la lámina que originó el hallazgo pasa por otro de los ~10 que inyectan `ancho_slot = 6.1`. La traza lo dijo en una corrida —40 llamadas con 6 y 20 con 2.95—, mientras que mirar el render solo decía «sigue igual». Cuando un renderer tiene una familia de bloques casi idénticos, enchufar en uno y verificar en la lámina no basta: hay que contar por cuántos pasa.

- **Un parámetro que no viaja hace mentir a todo lo que dependa de él.** El graficador recibe el ancho real de su cajón (`ancho_slot`, H22) pero nunca el alto: en una lámina de cuatro paneles cree tener seis pulgadas donde tiene tres. No es que la cuenta vertical estuviera mal escrita — es que su entrada era falsa, y eso invalida por igual cualquier fórmula que se apoye en ella. Antes de afinar una fórmula, comprobar que sus entradas son lo que dicen ser.

- **El contact sheet encuentra en un minuto lo que la vara no mide.** Nueve láminas a 45 dpi en una sola imagen bastaron para ver tres con etiquetas de eje solapadas —10, 12 y 13—, un defecto que ninguna de las once reglas toca y que un cliente lee de inmediato. Mirar barato y en bloque antes de mirar caro y de una en una.

- **Un `0.5` que parece el culpable puede ser el gemelo del culpable.** El centrado de la leyenda se reparó primero en `pos_leyenda_x`, que vive en el `else` de la composición y que este mazo no toma: el render no cambió y la vara tampoco, así que nada avisó. Lo resolvió una traza escrita EN EL CÓDIGO FUENTE —`trace()` no sirve, porque el runner hace `pkgload::load_all()` y lo borra— que contó 232 llamadas por la rama viva y cero por la otra. Cuando un arreglo no se nota, comprobar que la línea se ejecuta antes de buscar otra explicación.

- **Un `git stash pop` con conflicto deja el árbol sin parsear y el stash intacto.** A mitad de tick el paquete dejó de cargar por un argumento duplicado en `graficador_radar.R`: otra sesión había popeado `stash@{0}` («WIP tabla nativa radar»), cuyo contenido es ANTERIOR a lo commiteado, y dos archivos quedaron en `UU` sin `MERGE_HEAD`. Lo primero fue comprobar que los siete commits del loop seguían alcanzables desde HEAD —lo estaban— y que el stash seguía guardado —también—; sólo entonces se resolvió a favor de HEAD, que ya superaba a ese stash. Antes de tocar un conflicto ajeno: verificar qué lado es más nuevo y que nada quede sin respaldo.

- **Una cuenta sólo compara si las dos partes tienen el mismo denominador.** B4 marca grupos de firma, no láminas: el motor sale 8 contra 5 del aprobado y sin embargo gana en máximo, media y mediana de dispersión. Lo que le penaliza es tener más variedad de láminas, no láminas peores. Antes de perseguir un número hacia el de la referencia, comprobar que ese número mide lo mismo en los dos.

- **Una capacidad sin consumidor puede estar buscándose en el sitio equivocado.** `.grosor_con_techo_in()` llevaba dos descartes encima y ninguno era del helper: los dos habían intentado engancharlo en el bloque de estirado, mil líneas por debajo de donde ya vivía su simétrico, el piso. Puesto al lado del piso funciona a la primera. Antes de declarar que una capacidad no sirve, comprobar si su gemela ya tiene un sitio.

- **La vara puede quedarse quieta mientras la distribución mejora.** El p90 del grosor azul cayó de 2.20 a 1.51 cm sin que la cuenta se moviera de 20, porque las reglas cuentan violaciones del extremo. Un cambio que no mueve el marcador puede seguir siendo el correcto — y hay que decir por qué se conserva, no esconderlo tras un «sin cambios».

- **La misma trampa de unidad, tres veces.** Barras por gráfico contra barras por lámina: primero calibró mal `.PARTICION_MAX_BARRAS` (P32), luego dejó la paleta azul sin medir (P36), y ahora había puesto el techo de dicotómicas en 12 cuando la referencia no pasa de 8 por gráfico (P37). Cada vez la cifra era correcta —y de la unidad de al lado—. Cuando dos magnitudes comparten nombre y difieren en el denominador, el número solo no basta: hay que escribir la unidad junto al valor.

- **Que la cuenta suba puede ser la reparación, no el daño.** El motor pasó de 17 a 23 al añadir dos reglas, y ninguno de esos seis defectos es nuevo: llevaban ahí desde siempre, en la paleta que nadie medía. La regla de «si la vara empeora, revierte» supone que la vara mide lo mismo antes y después; cuando lo que cambia es la vara, hay que decirlo explícito o el propio criterio se vuelve un incentivo para no mirar.

- **Un techo se calibra al extremo de la referencia; un piso, a su percentil.** El fichero decía «p10 para los pisos y p90 para los techos», pero su único techo real salía de un `max()`. Con p90, el techo de grosor marcaba 3 de los 25 gráficos del propio aprobado. La asimetría tiene razón: un piso al mínimo dejaría pasar todo, y un techo al p90 condena a la referencia.

- **Una suite verde no cubre lo que ninguna prueba enciende.** Los 149 tests de dimensiones pasaron con una nota que invocaba una variable inexistente: reventaba sólo con `debug_ph_bordes = TRUE`, y ninguna prueba lo enciende. Lo cazó renderizar el PNG. Un interruptor que ningún test activa es código sin cobertura por mucho verde que haya alrededor.

- **Un «quedan N» sin inventario es una impresión con forma de cifra.** Se arrastró «16 de ~20 graficadores sin guía» tres ticks seguidos. Al contarlo de verdad, nueve de esos archivos ni siquiera componen canvas: no les falta la guía, no tienen dónde ponerla. Eran cuatro de ocho. El conteo cómodo se propaga solo porque nadie lo vuelve a medir.

- **Una guía nueva se estrena midiéndose a sí misma.** La nota del radar anunciaba «tela 3.02 cm» y el polígono dibujado medía la mitad: la cifra salía de la caja, no del dibujo. Lo cazó mirar el render que la propia guía acababa de producir. Es el defecto de P24 repetido en otro sitio, y la regla que lo evita es la misma: **una cota mide lo dibujado o no se escribe**.

- **`git checkout --` sobre un archivo con trabajo sin commitear se lo lleva entero.** Se usó para quitar un mutante de prueba y borró de paso la función nueva del turno. Para revertir una mutación puntual, deshacerla con el mismo reemplazo que la introdujo; `checkout` sólo cuando el archivo esté limpio de trabajo propio.

- **Una causa descartada puede volver a la mesa cuando cambia lo de al lado.** El techo de partición se descartó midiendo con la reserva de pie en 0.85. Al repararla a 0.5 el experimento ya no era el mismo, y repetirlo cambió el resultado —de +1 sobre 21 a +1 sobre 18, con la mitad de los síntomas—. Un descarte vale para el estado en el que se midió; conviene anotar contra qué estado se midió, no solo el número.

- **La vara mide una paleta y el mazo tiene dos.** `calibrar_umbrales()` deriva `barras_por_grafico` del máximo de `barras_escala`, que solo cuenta la rampa. Las dicotómicas azules del aprobado llegan a ocho por gráfico y ninguna regla las mira. Un umbral calibrado sobre una muestra parcial se aplica luego a todo, y el hueco no se ve porque el verde es real donde sí mide.

- **Antes de construir una capacidad, comprobar que no está ya.** Iba a diseñar la composición de varios bloques por lámina. Bastó rasterizar la lámina que el motor ya había generado en el experimento anterior para ver que la compone bien —tres bloques, separación y leyenda—. Lo que faltaba no era la capacidad sino el número que la deja salir.

- **Un entregable verde no dice nada del otro.** El diagrama de «Número de respuestas» salió perfecto en el PPT y tumbó el informe Word entero, porque `reporte_word_plan()` llama al **mismo renderer del PPT** con `solo_lista = TRUE` y `doc = NULL` solo para cosechar el `render_meta`. El síntoma llegó envuelto —«Base 'estudiantes': attempt to apply non-function»— a 4000 líneas del cambio. Se aisló guardando y desguardando el cambio sobre el mazo real: FALLO / OK. Cuando el motor tiene dos salidas, medir una no es medir.

- **Un test que no rojea no es un test.** La primera regresión del guardia pasaba con y sin el arreglo: la fixture mínima ni siquiera llega a esa rama del renderer. Un verde así es peor que no tener nada, porque afirma cobertura donde no la hay. Se sustituyó por el contrato de `.nresp_colocar()` —comprobado rojo al quitar el cortafuegos— y la medición sobre el mazo real quedó escrita en el comentario del código.

- **Antes de encajar algo hay que medir su hueco, no solo su contenido.** El SVG estaba bien dibujado y encajaba mal: su lienzo 1000 × 430 era proporcionalmente más alto que la banda del aprobado (1000 × 303), así que al ajustarlo por alto se quedaba a 1.4 pulgadas de cada margen. La proporción del hueco es un dato del aprobado tanto como sus colores.

- **Un plan guardado no gana campos nuevos.** El diagrama se declara con `diagrama = "numero_respuestas"`, y ningún `.pulso` de hace meses lo trae. Sin reconocerlo por el título, la capacidad existía y no la consumía nadie —el mismo patrón de siempre—.
- **Un centinela puede rechazar justo lo que venías a dejar pasar.** Se pasó
  `n_base = Inf` para saltar un segundo filtro, y su guardia `is.finite()`
  rechazaba todas las filas: cero anotaciones con el dato llegando bien. Los
  valores especiales necesitan su caso explícito, no colarse por un hueco.
- **Un dato puede estar disponible y aun así no ser alcanzable.** La base por
  público se deduce exacta de la lámina, pero el graficador ve una pregunta por
  llamada: el alcance, no el dato, era lo que faltaba. Comprobar qué VE una
  función, no sólo qué recibe.
- **Antes de fijar un criterio, cruzarlo con el caso real completo.** El de la N
  por barra parecía obvio —«anota la fila que no cuadra»— y la lámina 18 del
  aprobado lo desmiente: tres de sus siete anotaciones coinciden con la base de
  su público. La unidad era la pregunta, no la fila.
- **«Menor que el mayor» no es «menor que su base».** El criterio para anotar la
  N confundía un público pequeño con un salto de cuestionario y multiplicaba las
  anotaciones por trece. Cuando un umbral compara contra el máximo observado en
  vez de contra la referencia de cada caso, marca diferencias que son de
  naturaleza, no de defecto.
- **Antes de mover una función a otro archivo, mirar de qué depende.** Se
  intentó mudar `.top_two_parse_colors()` y usa helpers definidos *dentro* de
  una función del renderer, que no existen fuera. El archivo nuevo se apaña con
  los suyos.
- **Contar `<a:t>` en el XML no mide cuánto contenido tiene una lámina.** Se
  concluyó que el motor «despachaba las metodológicas con un párrafo» porque la
  de top two box mostraba 3 textos; el diagrama va como imagen SVG y sus textos
  no están en el XML. La lámina estaba recreada entera. Hubo que mirarla.
- **Un síntoma puede tener una causa de otra clase.** «Sólo se ve una serie»
  parecía un problema de grosor de línea —el aprobado las dibuja más finas, y
  renderizando los mismos datos a 1.2 y 0.6 se confirmaba—. Eran dos ticks
  persiguiendo lo que no era: el radar recibía todos los valores saturados al
  100 %. La evidencia que parecía confirmar la hipótesis era compatible con la
  verdadera.
- **Trazar la ENTRADA de la función que dibuja, no la del llamador que crees.**
  Fue lo que destapó a la vez la causa real y que las láminas iban por otro
  camino del que se estaba tocando.
- **Que el código se ejecute no basta: hay que comprobar que su salida llega al
  dibujo.** El tope de grosor del radar se aplicaba —trazado, 1.1 → 0.6— y la
  lámina no cambiaba una decima. La lección anterior («comprobar que el código
  que vas a tocar se ejecuta») era necesaria pero insuficiente.
- **Mover el problema de columna no es resolverlo.** El reparto proporcional
  daba a «Estudiantes» lo que pedía quitándoselo a «Docentes», y pasaron a
  partirse las tres en vez de dos. Cuando falta espacio, repartirlo distinto no
  lo crea.
- **Revisar lámina por lámina el render encuentra lo que ninguna vara mira.** El
  radar salía con un cuadro vacío, la tabla fuera del marco y una sola serie
  visible, con la vara en 22 y sin marcar nada de eso. Lo vio Gonzalo mirando el
  PDF.
- **Una herramienta de medir que no mide lo dibujado es peor que no tenerla.**
  La cota de la guía correlacionaba **negativamente** con el grosor real: no
  daba un valor impreciso, daba el contrario. Toda «medición» hecha mirando la
  guía antes de P24 hay que rehacerla.
- **Un generador que corre dos motores mezcla sus cifras en la traza.** Los tres
  altos de fila «inexplicables» eran dos motores a la vez: separando PPT de Word
  por el salto de tiempo entre ambos, el PPT usa un solo alto de preset y los
  otros dos tenían dueño conocido. Toda traza sobre este script necesita el corte.
- **Medir la salida de una pieza no es medir lo que llega al entregable.** El
  graficador produce 3 grosores y el PPT acaba con 22: entre los dos hay un
  escalado que ninguna de mis mediciones anteriores miraba, y era el único
  culpable.
- **Antes de reparar, comprobar que el código que vas a tocar se ejecuta.** Dos
  remedios seguidos de P16 —el ancla al panel impuesto y el piso del bloque de
  una fila— no movieron la vara ni una décima, y en ambos casos por lo mismo:
  tocaban ramas muertas para este mazo (`canvas_h_panel_in` es `NULL` siempre;
  `grosor_modo` es `"manual"`, así que la rama `auto` no se llama). Una traza de
  cinco minutos sobre las llamadas reales lo habría dicho antes que dos ciclos de
  regenerar y medir.
- **El XML no ve los solapes que produce el render.** El detector de cajas
  superpuestas decía «1 de 41» sobre un defecto que se ve en media baraja: en el
  XML las cajas no se tocan, y el solape aparece cuando el texto no cabe y se
  parte. La pregunta que sí medía era otra —cuánto ancho pide el texto contra el
  que tiene—, y dio 48 de 48.
- **PowerPoint sigue reparando el archivo.** El PDF llegó como
  «… - Repaired.pdf». No quitó láminas —73 entran, 73 salen— pero C0 no está
  cerrado y falta saber qué toca.
- **Un filtro geométrico casero no es un detector de barras.** Tres mediciones
  seguidas de P16 en Python dieron resultados distintos y los tres eran ruido: la
  tabla de escala y la banda del título entraban como «barras». El detector
  validado del verificador dijo lo contrario —motor 9 contra 6 del aprobado— y es
  el que vale. Una medición propia que contradice al instrumento validado es
  sospechosa de sí misma, no del instrumento.
- **Que el mazo salga bien no significa que el motor esté bien.** El mazo
  ejercita una ruta; P21 vivió commiteado porque las 66 láminas usan canvas y el
  fallo estaba en la rama sin canvas. El gate del área —`test_dir` con filtro—
  lo decía y no se corrió.
- **Un test que lee el fuente puede dar verde con el motor roto.** Los dos tests
  de P17 comprobaban que existiera algún `family = "Arial"` en el archivo. Lo
  había —en otras tres líneas— mientras las dos que importaban estaban rotas.
  El test que sirve es el que ejercita la ruta.
- **Contar ocurrencias sin separar el rol mezcla lo que no compara.** El «gris
  2,3 veces más» eran rellenos y bordes juntos; los «dos tamaños a seis
  centésimas» eran cifras y etiquetas, dos roles distintos. Ninguna de las dos
  cifras significó nada hasta separarlas.
- **Un reemplazo por patrón aplasta los valores propios.** El calibre iba a
  llevarse por delante `5.2`, `4.8` y un `size_ejes` de `10.5` que no valían lo
  que buscaba el patrón. Y un `sed` mal parseado dejó el fuente con
  `size_ejes = ,`: tres mediciones seguidas fueron del mazo viejo sin avisar.

- **Validar con la herramienta del cliente, no con la que está a mano.** El
  render de LibreOffice no es evidencia sobre un .pptx.
- **PowerPoint en macOS está en sandbox**: no lee ni escribe en `/private/tmp`;
  la carpeta de trabajo tiene que estar bajo `~/Documents`.
- **`pkill -9` sobre PowerPoint envenena las pruebas siguientes**: deja
  recuperación pendiente y todo falla igual, culpable o no. Se cierra con `quit`
  y se comprueba con un control conocido antes de creerse un resultado.
- **Toda prueba de corrupción lleva un control**: un archivo que se sabe sano
  sometido al mismo tratamiento. Sin él, dos veces habría culpado a la pieza
  equivocada.
