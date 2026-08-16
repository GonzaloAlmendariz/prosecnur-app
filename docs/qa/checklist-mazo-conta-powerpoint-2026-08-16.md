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
| P1 | El índice: comprobar que los elementos y encabezados salen bien | render de `p_slide_indice` | ☐ |
| P2 | Separación entre cuadro y cuadro del índice (comentario de Gabriela) | ídem | ☐ |
| P3 | Objetivo: no se está siguiendo la referencia | `p_slide_objetivo_icono` | ☐ |
| P4 | **La ficha técnica desborda la lámina** | `reporte_ppt_tabla_lineas.R` + plan | ☑ el alto de fila contaba **caracteres**, no líneas: «Muestra» llevaba cuatro públicos en 1.24 cm. Y el contenido venía pegado (`…PUCPDocentes…`). Geometría y 15 pt del aprobado |
| P5 | Escala usada y número de respuestas están puestas **como texto suelto**, no armadas como en el PPT final | plan del `.pulso` + constructor | ☐ |
| P6 | La guía no acota como una regla: falta «de tal punto a tal punto, tantos cm» | `graficador_guia_arquitectonica.R` | ☐ |
| P7 | Perfil del docente: el título «Sexo» sale mucho más alto que «Departamento académico» | disposición de 4 paneles | ☐ |
| P8 | Perfil del egresado: «¿Se encuentra trabajando?» tiene guías distintas, sin los avances | ídem | ☐ |
| P9 | Barras agrupadas muestran **columna extra** y el reporte final de Contabilidad no la tiene | suelo editorial de Pulso | ☑ era la N de la base repetida **18 veces** en una lámina; el aprobado: 0 |
| P10 | Misión y propósitos sale en **durazno**; debe ir en escala de azul celeste | paletas del proyecto | ☐ |
| P11 | Estructura organizacional: porcentajes unos en blanco y otros en azul; deben ser todos azules | `graficador_contraste_texto.R` | ☑ el umbral 0.6 dejaba `#70AD47` (0.561) del lado oscuro → **7 blancas**; el aprobado usa azul ahí. Umbral a 0.52 |
| P12 | Radar: las tablas son manuales, no **tablas nativas** de PPT, y no siguen el formato del reporte | `graficos_radar_multibase.R` | ☐ |
| P13 | Resultados I+D+i: leyenda comprimida y sus cuadros de color **rectangulares**; deben ser más cuadrados | leyenda del graficador | ☐ |

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
