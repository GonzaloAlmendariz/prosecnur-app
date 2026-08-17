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
| P8 | Perfil del egresado: «¿Se encuentra trabajando?» tiene guías distintas, sin los avances | tope del estirado en agrupadas | ◐ **medido y mejorado**: los cuadrantes dispersaban **0.75–0.98 cm** y el aprobado 0.12–0.29. El estirado del panel engordaba la barra del cuadrante con pocas filas hasta 1.68 cm. Con techo: máximo **0.90**, peor dispersión **0.29** (aprobado 0.22) |
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
| P23 | **La mitad inferior de muchas láminas queda vacía** (hallazgo del render) | reparto vertical | ⏸ visible en el PDF: en láminas de dos bloques el contenido ocupa la mitad superior y el resto queda en blanco. Ninguna regla lo mide |
| P24 | **La cota de la guía medía el alto nominal, no el dibujado** (hallazgo propio) | `graficador_barras_apiladas.R` ~3276 | ☑ reportaba `grosor_eff × alto_por_cat_grosor` cuando el panel **se estira después** para llenar el hueco. Cruzando lo que canta contra lo que mide el detector en 53 láminas: correlación **−0.353 → +0.588** —era **negativa**, la guía cantaba al revés— y el rango del ratio 0.507→0.912 por abajo. Antes cantaba 1.29 cm en casi todas mientras el mazo iba de 0.693 a 2.068; ahora canta 19 valores contra 22 reales. **Verificado con control**: revertida la línea, la correlación vuelve a −0.353. Explica «no sé si te estás guiando de ellas» |
| P25 | **`.grosor_con_techo_in()` no lo llama nadie** (hallazgo propio) | `graficador_grosor_piso.R` | ☐ existe, tiene tests y **cero consumidores**. Se escribió para P8, que se resolvió por otro camino. Y su comentario declara una cifra **falsa**: dice que 1.0 cm es «el grosor mayor que usa el entregable aprobado» — medido, el aprobado llega a **1.80 cm** y supera ese techo en el **59 %** de sus barras (el motor en el **71 %**, máximo 2.55). La diferencia real motor/aprobado es **2.55 vs 1.80 cm** |
| P27 | **Las metodológicas salen como texto, no recreadas** | `p_slide_top_two_box` ☑ · «Número de respuestas» ☑ | ☑ **CORRECCIÓN DE MI PROPIO INVENTARIO**. Dije que el motor las despachaba con un párrafo, contando `<a:t>` en el XML. Falso para la de **top two box**: el motor **la recrea entera** —barra de cuatro segmentos, llave sobre los dos últimos, «TOP TWO BOX / 35 % + 55 % / 90 %», flecha con las anclas y leyenda 1-2-3-4—; conté 3 textos porque el diagrama va como **imagen SVG** y sus textos no están en el XML. `p_slide_top_two_box()` ya declara `valores`, `etiquetas`, `top_two_indices` y las anclas. Le quedan tres diferencias, **ninguna del motor salvo una**: el título dice **«N»** (viene del plan del proyecto, dato de Gonzalo), los porcentajes de ejemplo son 5/5 y el aprobado usa 4/6 (configurable), y el primer segmento sale **rojo** donde el aprobado usa **naranja**. Sale como imagen y el aprobado usa 11 formas nativas. **«Número de respuestas» SÍ está sin recrear**: el motor deja el **80 % de la lámina en blanco** y el aprobado pone **dos mini-gráficos didácticos** con notas al pie numeradas ¹ ² en el párrafo que apuntan a «Base: 12 egresados» y a «N = 12» sobre el gráfico — enseña **dónde aparece cada cosa**. ☑ **construida**: `.numero_respuestas_svg()` compone los dos ejemplos del aprobado con sus dos anclas numeradas en recuadro punteado. Archivo propio (`reporte_ppt_numero_respuestas.R`) porque el renderer está congelado. ☑ **enganchada y saliendo en el mazo**. Tres piezas: (1) `p_slide_texto()` acepta `diagrama`; (2) **el título la reconoce sola** —`.slide_texto_diagrama_auto()`—, porque los planes ya guardados en los `.pulso` no traen ese campo y sin esto el diagrama existiría sin que lo viera nadie; (3) el renderer llama a `.nresp_colocar()`, que **decide dentro del archivo nuevo** para gastar 4 líneas del congelado en vez de 13 (base 9697 → 9701, subida deliberada). Geometría **remedida contra la lámina 7 del aprobado**: su diagrama son 33.48 × 10.15 cm, o sea 1000 × 303, y el lienzo iba en 1000 × 430 — al encajarlo por alto quedaba a 1.4 pulgadas de cada margen mientras el aprobado va de borde a borde. **Costó una regresión en el otro entregable**: Word llama al MISMO renderer del PPT con `solo_lista = TRUE` y `doc = NULL` solo para cosechar el `render_meta`, y el `ph_with()` sobre NULL tumbaba el informe entero con «attempt to apply non-function» — **el PPT salía perfecto**. Verificado: PPT 66 láminas OK, Word 4520 KB OK, vara 21 |
| P28 | **El radar salía con un cuadro vacío y la tabla fuera** (lo vio Gonzalo en el PDF) | `.plot_slot_recortado_por_tabla()` | ☑ **el sitio se pedía DOS veces**: el canvas reservaba un panel vacío al lado del radar *y* el renderer colocaba la tabla en el mismo cajón vía `geom_frac`. La reparación va por el **slot**, no por el canvas: éste deja de reservar pero **conserva `geom_frac`** —sin él el renderer cae al camino de «solo tabla» y el radar desaparece entero, medido en un intento previo— y el renderer recorta el slot del gráfico hasta donde empieza la tabla. Rechaza los recortes que dejarían al gráfico con menos de un tercio del cajón. **Medido: el cuadro vacío desaparece, la tabla acaba en 32.66 de 33.87 cm y la vara baja 22 → 21** (B3 de 7 a 6). Siguen abiertos en la misma lámina: **sólo se ve una de las tres series** (96/96/93 se solapan), la **leyenda en minúscula** y los encabezados partidos («Estudiant/es») |
| P29 | **Tres defectos hermanos del radar** (vistos al reparar P28) | radar + tabla nativa | ☑ **los tres cerrados**. **(b) leyenda ☑** capitalizada sólo en la copia del graficador —en el origen rompería las claves de `tabla_encabezados`—. **(c) encabezados ☑** `primera_col_frac` 0.47→0.40, partidos 2→1. **(a) una sola serie ☑ — y no era el grosor**: el radar **no estaba dibujando los datos**. `escala_valor` llegaba como `proporcion_1` con valores de **90.83 a 98.14**, y el `pmin(1, .)` los aplastaba **todos al tope**: hexágono lleno pegado al borde. Se persiguió dos ticks como problema de línea. La traza de la **entrada** de `graficar_radar()` lo destapó, y de paso mostró que esas láminas van por `p_radar → radar_tabla`, **no** por `.radar_mb_componer()` donde estaba el enganche. Reparado en `graficar_radar()`: una proporción no pasa de 1, y por encima de 1.5 se lee como porcentaje **con aviso**. Verificado en el render: las tres series salen separadas |
| P30 | **La N por barra no baja al gráfico** (pedido de Gonzalo) | `graficador_n_por_barra.R` + renderer de multilista | ☑ **cerrado**. El motor prometía en su lámina metodológica que la N baja al gráfico y tenía **0** anotaciones contra 11 del aprobado. El bloqueo no era el dato sino el **alcance**: el graficador ve una pregunta por llamada y la base de un público sólo se deduce mirando todas sus preguntas. Ahora el **renderer de multilista** —que ya recorre los bloques para el paso común de P14— recoge la N de cada variable, deduce la base por fuente y la pasa como `bases_publico`. La deducción se comprobó contra la lámina 18: los máximos por público dan **52, 172, 178 y 15**, las cuatro bases declaradas, exactas. **Medido: 4 anotaciones** (N = 47, 128, 139, 14) en la lámina 17, justo las cuatro filas cuyo N no cuadra con su base. Verificado en el render: cursiva, pequeñas, a la derecha. Criterio: la unidad es **la pregunta**, no la fila —tres de las 11 del aprobado coinciden con la base de su público—, tolerancia de un caso y sólo por debajo. **Línea base subida** de 9663 a 9697 en `agentic/manifest.json`: el bucle necesita `.tab_freq()` y `.resolve_ref()`, locales del renderer |
| P31 | **¿Comparativo con otro año en top two box y en tablas de radar?** (pregunta de Gonzalo) | `p_slide_top_two_box()` · `graficar_radar()` · no existe el acarreo de otra medición | ⛔ **BLOQUEADO — necesita decisión de Gonzalo**. Medido, no recordado. **Radar: ya compara N series hoy.** `graficar_radar(var_grupo = …)` dibuja un polígono por serie y `.make_tabla_ttb_df()` pivota grupo → columna, así que su tabla nativa saldría con una columna por año. Comprobado pasándole 2025 y 2026 como grupos: dos polígonos y su leyenda, sin tocar nada. **Top two box: no compara nada.** Recibe un solo vector `valores` y no tiene sitio para una segunda medición — y su **texto por defecto promete** «permite comparar […] con mediciones de otros años», la misma clase de defecto que P30: la lámina promete lo que el motor no hace. **Lo que falta en los dos casos es el mismo y no es de graficador**: no existe forma de traer la base del año anterior. La multibase de un `.pulso` es **por público** (estudiantes/docentes/egresados), no por medición, y no hay concepto de base de referencia ni de benchmark. Un año solo entra hoy si ya viene como columna del propio estudio. **NO es una brecha contra la vara**: el aprobado tampoco tiene comparativo interanual —sus años son categorías dentro de una medición: año de egreso, tiempo hasta el primer empleo—. La decisión que se necesita: de dónde sale la medición anterior —¿un segundo `.pulso` montado como base de referencia, un CSV de cifras ya calculadas, o columnas del mismo estudio?—, porque de eso depende si esto es trabajo de graficador o de carga |
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
