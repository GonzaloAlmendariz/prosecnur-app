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
| P17 | **El mazo usa dos tipografías** | `graficador_radar.R` | ☑ **22 → 0**: el mazo sale con `{Arial: 2400}` y nada más. Antes: **22 textos en `Helvetica`** en las dos láminas de radar —título, subtítulo y etiquetas de eje— contra un aprobado que usa **solo Arial**. Los `geom_text` ya declaran familia; los `cowplot::draw_text` que producen esos 22 están en otra función sin acceso a `font_family` |
| P16 | **Dos láminas del mismo tipo no salen iguales** | reparto de alto en `multilista` | ◐ **medido**: con 3 filas el paso va de 1.40 a 2.59 cm entre láminas; con 7 filas es idéntico en las tres |
| P15 | Cifras de un solo color por familia: blanco en dicotómica azul, azul Pulso en Likert | `.contraste_familia()` | ☑ un color por gráfico en vez de por luminancia de cada segmento; la paleta que no es de la casa la sigue decidiendo la luminancia |
| P14 | **Las barras no tienen el mismo grosor dentro de una lámina** | `graficador_row_step.R` | ☑ **0.29 → 0.13 cm** en Mecanismos de admisión (el aprobado: 0.22). Antes: **medido**: en «Mecanismos de admisión» la escala sale a **1.19 cm** y la dicotómica a **0.90** — 0.29 de diferencia. El motor tiene 8 láminas así (peor 0.38); el aprobado 6 (peor 0.22). Regla **B3** añadida al verificador. **Reparado**: los bloques comparten paso de fila y el reparto de alto lo sigue. Coste medido: una barra de escala de esa lámina queda en 0.66 cm contra el piso de 0.77 (R1 ×1), a cambio de que las dos dejen de diferir en 0.29 |
| P18 | **La rejilla de las tablas iba en gris claro** (hallazgo propio) | `reporte_plan_tabla_nativa.R` + `reporte_plan_ppt.R` | ☑ **248 bordes `BFBFBF` → `757070`, cero en el claro**. El aprobado declara los cuatro lados de cada celda en `757070` a 0.75 pt; el grosor ya coincidía, el color no. Hay **dos** constructores de tabla nativa y hubo que tocar los dos: cambiar solo el del plan dejaba 48 bordes claros en la ficha técnica. Los 16 bordes de 9.4 pt del índice son separadores deliberados y no se tocan |
| P19 | **Los públicos salían en minúscula en la tabla del radar** (hallazgo propio) | `.radar_mb_nombres_tabla()` | ☑ «docentes» → «Docentes». El nombre viaja como lo nombra el estudio, y ese es el nombre de la **base**: sirve de clave, no de encabezado. Solo la inicial —capitalizar palabra a palabra convertiría «I+D+i» en «I+D+I»— y los `tabla_encabezados` declarados a mano salen literales. **La otra mitad queda para Gonzalo**: el aprobado titula la primera columna «Top Two Box» y el motor «Tema»; `tabla_titulo` ya es configurable en la UI y el motor no puede saber qué métrica grafica |
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
