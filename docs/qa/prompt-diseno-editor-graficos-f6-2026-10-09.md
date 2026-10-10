# Prompt para una sesión de diseño: el editor de Gráficos remasterizado (F6)

Tipo: Encargo de diseño (prompt)
Estado: Histórico
Consolidado en: [Dirección de diseño del editor de Gráficos (F6.0)](direccion-diseno-editor-graficos-f6-2026-10-09.md)
Uso: listo para usar como prompt; la sesión de diseño que lo ejecutó produjo la dirección aprobada.
Fecha: 2026-10-09
Autoridad: Lo pidió Gonzalo; los hechos citados están medidos en `docs/qa/inventario-f6-editor-2026-10-09.md`

> Copia todo lo que está debajo de la línea en una sesión nueva de Claude Code abierta en `~/repos/Pulso/prosecnur-app`.
> Está escrito para que la sesión no necesite esta conversación.

---

## 0. Quién eres y qué se te pide

Eres la diseñadora o el diseñador principal de producto de **Prosecnur**, la app de escritorio de PULSO PUCP (Perú) para
investigación por encuestas. Tu encargo es **diseñar, no implementar**: entregar una **maqueta interactiva de alta fidelidad**
del editor de Gráficos remasterizado, más un documento de dirección, para que Gonzalo (coordinador de PULSO PUCP y dueño del
producto) la apruebe antes de construir nada en la app.

Escribe en español neutro peruano, tuteando («tienes», «puedes», nunca «tenés», «podés», ni «dale», «che»). En la interfaz,
el español es formal y claro, sin jerga ni emojis.

Palabras de Gonzalo, textuales (son tu vara):

- «Estamos en una de las etapas mas fundamentales de el loop. La remasterizacion de la UI, Recuerda que ahora ambos motores
  usan elementos nativos y ya no ggplot y que el recetario tiene muchas funciones elementos nuevos, una biblioteca de iconos.
  Y demas y el UI tiene que estar a la altura».
- «esto debe ser una remasterización completa del diseño para que se vea mejor y sea intuitivo».
- «Cuando buscamos remasterizar, es una remasterización completa y fiel, se van» (los controles que la salida nativa no usa
  **desaparecen** del editor; no van a un desplegable escondido).
- «Debe hacer todo lo que el recetario dice que hace».
- «hacer más dinámico el visor de capítulos en Word o las secciones de capítulos y subcapítulos en PPT. Hacer que los visores
  se vean mejor, que los ajustes y el estilo del cliente se vean más sofisticados».
- «como puedo ajustar o ver como ajustar los tipos de gráficos o los tipos de láminas si no me deja seleccionarlos?» (todo
  debe ser seleccionable y editable).
- «usar el recetario para mostrar ejemplos, pero no todos los slides de ejemplo son tipos de lámina: la lámina que muestra el
  tipo de lámina con sus medidas no es un tipo de lámina real».
- «Los ejemplos no terminan de acomodarse bien» (las miniaturas deben mostrar el gráfico entero, bien encuadrado).
- «el recetario es la fuente de verdad».
- «comprueba que la app pueda realmente mostrar la lámina tal cual como lo publicitas» (no prometas en el diseño lo que la
  app no puede hacer; ver §6).

## 1. El producto en una página

- Electron + React 18/Vite/TypeScript estricto (`frontend/`) + R/Plumber (`api/`, paquete `prosecnurapp`). Proyectos
  portables `.pulso`. Lee `CLAUDE.md` y `AGENTS.md` del repo antes de empezar.
- Navegación v3, cinco dimensiones: **módulo → modo → sección → pestaña → panel**
  (`frontend/src/lib/modules.ts`, `frontend/src/lib/navegacion/direccion.ts`, `docs/adrs/0044-jerarquia-y-direcciones-de-navegacion.md`).
  El editor vive en **Procesamiento › Gráficos** (`/procesamiento?seccion=graficos`). No inventes un sexto nivel ni dupliques
  la navegación de otra dimensión; un overlay nuevo es un **panel** direccionable (`usePanelDireccionable`).
- Chrome de módulo: barra superior uniforme (`docs/adrs/0042-chrome-modulo-uniforme-topbar.md`).
- El editor actual: `frontend/src/features/graficos/` (`GraficosPage.tsx`, `v2/shell/EditorShell.tsx`, `v2/timeline/*`,
  `v2/inspector/*`, `v2/shell/EstiloGlobalDialog.tsx`, `GraficadorForm.tsx`, `ArgField.tsx`, `MultiApiladasBuilder.tsx`,
  `Top2BoxSelector.tsx`, `IndiceBuilder.tsx`, `IconosEditor.tsx`, `ChartLayoutPopover.tsx`). Captura de cómo se ve hoy:
  `tmp/n8/ui/antes-1440.png` y `tmp/n8/ui/antes-1024.png`.

### Qué cambió en los motores (por qué el editor quedó viejo)

- **ADR 0092** (`docs/adrs/0092-el-recetario-es-el-estandar-del-motor.md`): el recetario es el estándar del motor.
- **ADR 0093** (`docs/adrs/0093-el-motor-dibuja-con-formas-nativas.md`, con su enmienda del 2026-10-09): el motor PPT y el
  motor Word dibujan con **formas nativas** (editables en PowerPoint/Word), ya no con imágenes de ggplot. Tipografía,
  tamaños, márgenes, grosores, leyendas y paletas por defecto los **fija el recetario** (`api/inst/estandar/estandar_pulso.json`).
- Consecuencia: decenas de controles del editor (tamaños, colores sueltos, lienzo, leyenda, grosores, «alto por categoría»,
  ChartLayoutPopover) ya no cambian nada en la salida. Y al revés: el recetario trae capacidades nuevas (22 tipos de lámina,
  variantes de portada/índice/cierre/separador, biblioteca de íconos, documento Word completo) que el editor no ofrece.

## 2. Lee esto antes de diseñar (en este orden)

1. `docs/qa/inventario-f6-editor-2026-10-09.md`: **el documento base**. Parte A (24 capacidades del motor sin control en el
   editor, con archivo:línea), Parte B (controles sin efecto, por graficador), Parte C (lo que la vista previa puede hacer
   hoy, medido), propuesta F6.1–F6.5 y las decisiones de Gonzalo.
2. `docs/qa/checklist-remasterizacion-motor-2026-10-08.md` y `docs/qa/goal-remasterizacion-motor-2026-10-08.md` (ítems R2,
   R3, R4, R14, R16, F6).
3. ADR 0092 y ADR 0093 (arriba).
4. **El recetario** (la fuente de verdad), en `docs/qa/motor-ppt-2026-10-06/4-recetario/`:
   - `recetario-moderna.pptx`: 274 láminas. **El estándar visual de la presentación.**
   - `recetario-moderna-guias.pptx`: el mismo, con guías de layout dibujadas.
   - `propuesta-word.docx`: 81 páginas. **El estándar del documento Word.**
   - `recetario-fiel.pptx` y `recetario-fiel-guias.pptx`: variante fiel a la plantilla anterior (sólo referencia).
   - `propuestas-rescatables.pptx` y `alternativas-icono-poblacion.jpg`: propuestas descartadas o en revisión; **no** son
     estándar.
   - Generadores: `docs/qa/motor-ppt-2026-10-06/herramientas/recetario_*.R`, `recetario_estructura.json` y `README.md`.
5. La biblioteca de íconos del recetario: `docs/qa/motor-ppt-2026-10-06/herramientas/iconos/{navy,blanco,coral,verde}/`
   (277 archivos; generador `iconos.py`). En la app sólo se empaquetan 22 navy y 18 blancos
   (`api/inst/ppt_assets/iconos_recetario/`).
6. Identidad visual de la app: `branding/README.md`, `branding/direccion-creativa-v3.md`, `branding/identity.json`,
   `branding/catalogo-visual/`, `branding/manual-identidad.html`.
7. Gramática de layout y Contrato de Superficie: `docs/ui-layout-grammar.md` y `.claude/skills/contrato-superficie/SKILL.md`.
   Skills de diseño del repo: `.claude/skills/revamp-visual/SKILL.md`; transversales: `govern-visual-harmony` y
   `emil-design-eng`.
8. Tokens: `frontend/src/app/tokens.css` y `frontend/src/app/theme.css`. Escala `--pulso-space-1..9` = 4, 8, 12, 16, 20, 24,
   32, 40, 48 px; radios `--pulso-radius` 10, `--pulso-radius-card` 14, `--pulso-radius-panel` 16, `--pulso-radius-chip` 999;
   el acento del módulo Procesamiento es `--pulso-module-processing` (#0f766e); el primario de marca es navy (#002457). Los
   colores del **recetario** (salidas) son otros y viven en `estandar_pulso.json`: azul #081F5C, coral #CA5651, tenue #8E9DBD,
   Likert #F4B183 #FFD965 #ADD493 #70AD47 + gris #BFBFBF, neutro #D9D9D9, tipografía Arial. No los mezcles: la **app** usa los
   tokens `--pulso-*`; las **láminas** usan el recetario.
9. La maqueta previa, que es un punto de partida y **no** el resultado:
   `tmp/n8/ui/maqueta-f6/index.html` (seis vistas). Para verla:
   `cd tmp/n8/ui/maqueta-f6 && python3 -m http.server 8931 --bind 127.0.0.1` y abre `http://127.0.0.1:8931`. Gonzalo dijo:
   «confío en este rediseño, pero aún necesita muchísimos ajustes». Mejórala de raíz.

## 3. Lo que hay que diseñar

Una sola experiencia, coherente, con estas superficies. Para cada una: estado normal, vacío, cargando, error, con muchos
elementos, y su versión a 1440×1000 y 1024×600.

### 3.1 Estructura del informe (capítulos y subcapítulos)

- El informe es una jerarquía: **capítulo → subcapítulo → lámina**. Un capítulo empieza con un separador; un subcapítulo
  puede tener el suyo. Hay bloques sin número (Apertura, Cómo leer este informe, Cierre).
- Se ve como un árbol vivo: abrir y cerrar, reordenar arrastrando láminas y capítulos, numeración automática (1, 1.1…),
  conteo de láminas, estado de cada lámina (nativa, ruta anterior, aviso), insertar lámina en un subcapítulo, insertar
  subcapítulo o capítulo. Debe ser **dinámico** y agradable de usar.
- Una «vista general» del informe entero por capítulos (tipo clasificador de diapositivas), donde se reordena y se salta a
  editar.
- El índice y el Word se renumeran solos a partir de esta estructura (el motor ya lo hace: el índice se arma con los
  capítulos y el antetítulo de cada lámina se hereda del separador vigente).

### 3.2 El visor de láminas

- La lámina real al centro, grande, como protagonista. Navegación anterior/siguiente, teclado, zoom, tira de miniaturas
  agrupada por capítulo.
- Si la lámina se parte en «(cont.)», se ven **todas** sus partes.
- Indicador de cómo sale: **nativa** (formas editables) o **ruta anterior** (imagen), con el motivo y qué hacer.
- Guías opcionales que muestran dónde va cada gráfico.
- Los gráficos de la lámina son seleccionables: clic en un gráfico → sus datos; doble clic o «Cambiar gráfico» → selector de
  tipo de gráfico.

### 3.3 Dos selectores distintos: tipo de lámina y tipo de gráfico

Es el corazón del rediseño y la fuente de confusión de hoy. Diséñalos para que se entienda a la primera que:

- La **lámina** decide **cuántos gráficos caben y dónde** (los 22 tipos del recetario) y su **composición**.
- El **gráfico** decide **cómo se dibuja cada pregunta** (barras, escala con Top Two Box, torta, histograma…).
- Se eligen por separado. Cambiar la lámina conserva los gráficos ya configurados.

**Los 22 tipos de lámina** (de la sección «Tipos de láminas» del recetario). Cada tipo tiene en el recetario **una ficha**
(una lámina que explica el tipo y sus medidas: «TIPO DE LÁMINA n DE 22») y, a continuación, **un ejemplo real con datos**.
La ficha **no es** un tipo de lámina: es documentación. En las miniaturas usa el **ejemplo real**; la ficha va en una pestaña
«Medidas».

| # | Tipo | Id del motor | Ficha (pág.) | Ejemplo (pág.) | Gráficos | Escala | Cifra / rótulos | Admite | Cuándo se usa |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Un gráfico | `p_slide_1_grafico` | 123 | 124 | 1 | 100 % | 14 / 12 pt | Todos | La lámina estándar: una pregunta, un gráfico |
| 2 | Un gráfico con narrativa | `p_slide_1_grafico_narrativo` | 125 | 126 | 1 | 100 % | 14 / 12 | Barras, escalas y rankings | Una frase arriba dice lo que hay que retener |
| 3 | Gráfico con texto a la derecha | `p_slide_grafico_texto_derecha` | 127 | 128 | 1 | 60 % | 14 / 12 | Barras, escalas y dicotómicas | El gráfico y su lectura al costado |
| 4 | Gráfico con texto a la izquierda | `p_slide_grafico_texto_izquierda` | 129 | 130 | 1 | 60 % | 14 / 12 | Barras, escalas y dicotómicas | Para alternar con la anterior |
| 5 | Texto | `p_slide_texto` | 131 | 132 | 0 | — | — | Sin gráfico | Conclusiones o notas breves |
| 6 | Dos gráficos | `p_slide_2_graficos` | 134 | 135 | 2 | 48 % | 13 / 11.5 | Mismo tipo o misma pregunta | Dos preguntas que se leen juntas |
| 7 | Dos gráficos con narrativa | `p_slide_2_graficos_narrativo` | 137 | 138 | 2 | 48 % | 13 / 11.5 | Barras y dicotómicas | Dos gráficos con una idea común |
| 8 | Dos gráficos con texto a la izquierda | `p_slide_2_graficos_texto_izquierda` | 139 | 140 | 2 | 30–48 % | 12 / 11 | Dicotómicas y barras cortas | Perfiles breves con su lectura |
| 9 | Dos gráficos con texto a la derecha | `p_slide_2_graficos_texto_derecha` | 141 | 142 | 2 | 30–48 % | 12 / 11 | Dicotómicas y barras cortas | Para alternar |
| 10 | Dos gráficos apilados | `p_slide_2_graficos_vertical` | 143 | 144 | 2 | 100 % ancho | 14 / 12 | Escalas de pocas filas | Dos escalas que comparten leyenda |
| 11 | Gráfico principal y de apoyo | `p_slide_2_graficos_asimetrico` | 145 | 146 | 2 | 65 % y 35 % | 14·12 / 12·11 | Escala con ranking o resumen | Un gráfico manda y el otro resume |
| 12 | Tres: dos apilados y uno alto | `p_slide_3_graficos_2mas1` | 148 | 149 | 3 | 30–48 % | 12 / 11 | Dicotómicas + barras | Dos breves y una larga |
| 13 | Tres: uno alto y dos apilados | `p_slide_3_graficos_1mas2` | 150 | 151 | 3 | 30–48 % | 12 / 11 | Barras + dicotómicas | La pregunta larga primero |
| 14 | Tres: uno ancho arriba | `p_slide_3_graficos_1arriba` | 153 | 154 | 3 | 30–48 % | 12 / 11 | Escala + dos dicotómicas | Una general y dos de detalle |
| 15 | Tres en fila | `p_slide_3_graficos_fila` | 155 | 156 | 3 | 30–48 % | 12 / 11 | Barras cortas del mismo tipo | Tres variables de perfil o años |
| 16 | Tres en tira | `p_slide_3_graficos_poblacion_tira` | 157 | 158 | 3 | 100 % ancho | 14 / 12 | Dicotómicas | Tres sí/no del mismo público |
| 17 | Tres en corona | `p_slide_3_graficos_poblacion_corona` | 159 | 160 | 3 | 30–48 % | 12 / 11 | Dicotómica, barras, edad | Perfil con una variable más larga |
| 18 | Cuatro gráficos | `p_slide_4_graficos` | 161 | 162 | 4 | 30–48 % | 12 / 11 | Barras cortas y dicotómicas | Cuatro variables del mismo público |
| 19 | Cinco gráficos | `p_slide_5_graficos_poblacion` | 163 | 164 | 5 | 30 % | 12 / 10.5 | Dicotómicas arriba, barras abajo | Perfil del egresado o docente |
| 20 | Seis gráficos | `p_slide_6_graficos_poblacion` | 165 | 166 | 6 | 30 % | 12 / 10.5 | Dicotómicas y barras cortas | El máximo por lámina |
| 21 | Cifras en columna lateral | `p_slide_3_graficos_poblacion_cifras` | 168 | 169 | 3 | 30 % | 12 / 10.5 | Cifras, dicotómicas, barras | Muestra y edad dichas en cifras |
| 22 | Cifras en banda superior | `p_slide_cifras_y_graficos` | 170 | 171 | 2 | 48 % | 13 / 11.5 | Cifras, escalas y barras | Abrir un capítulo o resumir |

(Las páginas son las del PDF de `recetario-moderna.pptx`; las láminas 172–175 son más ejemplos de cifras: una cifra frente a
su gráfico, tres cifras, cinco cifras.)

Agrupa los 22 por **lo que el analista quiere mostrar**, no por número de ranuras: «Quiero mostrar una sola pregunta»,
«Quiero leer dos preguntas juntas», «Quiero reunir varias preguntas de un tema», «Quiero describir a un público», «Quiero
destacar cifras», «Quiero dejar un mensaje».

**Láminas de estructura** (no son de los 22; van en su propio grupo):

| Grupo | Lámina | Páginas del recetario | Variantes |
|---|---|---|---|
| Abrir el informe | Portada | 23–25 | centrada, izquierda, banda |
| | Índice | 31–50 | arcos (32), facetas (36), círculos (41), bloques (46); íconos por capítulo |
| | Objetivo del estudio | 26–28 | con diana y actores consultados |
| | Ficha técnica | 29 | fila «Muestra» en formato «172 estudiantes (96 %)» |
| Enseñar a leer | Explicación del Top Two Box | 19 | 3 a 5 categorías |
| | Redondeo de las cifras | 20–21 | estándar o resto mayor |
| Ordenar | Separador de capítulo / subcapítulo | 52–58, 209–215 | número grande, figuras, banda |
| Cerrar | Cierre | 61–65 | cinco variantes |

**Tipos de gráfico** (ejemplos reales en el recetario; recorta sólo el área del gráfico para las miniaturas):
barras de categorías (68), columnas (68 y 232; la 82 es el indicador numérico), torta (69), dona (70), dicotómica (76), ranking en barras (73), ranking con puntos
(72), escala con Top Two Box (78), escala por actor (184–188), escala con Top y Bottom Two Box (79), divergentes (71), mapa de calor
(94–95), histograma (81), diagrama de caja (83), media y rango (84), puntos comparativos (87), pesas / brecha (88), serie en el
tiempo (89), radar (98), tabla de dimensiones (197), mapa (105), nube de palabras (100, **sale por la ruta anterior**). Agrupa
por familia (categorías, escalas, números, comparar, dimensiones, territorio, texto).

### 3.4 Los ajustes de una lámina y de un gráfico (el inspector)

- Sólo controles que **cambian la salida**. Lo que fija el recetario (tamaños, tipografía, márgenes, leyenda) se ve como
  fijo, con candado, o no se ve.
- Por lámina: contenido (antetítulo heredado y editable, título, lectura/narrativa que también va al Word bajo la figura),
  composición (distribución y variantes con miniaturas reales) y estado.
- Por gráfico: preguntas, Top Two Box **eligiendo exactamente dos categorías** de la escala con chips (ya existe:
  `Top2BoxSelector.tsx`), Bottom Two Box al lado, orden de filas (por Top Two Box —recetario— o como en el instrumento),
  Fila Total, marcas 0-25-50-75-100 %, máximo de categorías, paleta (la del recetario por defecto; el analista puede elegir
  otra para ese gráfico), redondeo heredado del informe.
- Separador: nivel (capítulo/subcapítulo), número, rótulo, bajada. Portada: composición y textos (rótulo coral, encargo).
  Índice: composición e ícono por capítulo. Objetivo: actores consultados. Cierre: variante y contacto.
- Diseño **sofisticado**: jerarquía tipográfica clara, grupos en tarjetas con aire, vistas previas pequeñas en vivo (por
  ejemplo, la barra del Top Two Box sumando), estados claros, nada de formularios largos planos ni «Buscar entre 61 ajustes».

### 3.5 Estilo del cliente

- Un perfil por cliente que lo usan varios informes: identidad y logos (izquierda institución, derecha equipo), colores de
  marca del recetario (coral, azul), paletas (Likert del recetario por defecto, Likert con punto medio, azules,
  dicotómica, actores, mapa de calor, mapa; «paleta propia»), tipografía, cifras y redondeo (estándar / resto mayor,
  decimales, bases chicas), valores por defecto del documento Word.
- Con **vista previa viva**: una lámina y una página de Word que cambian al elegir paleta o tipografía.
- Regla de Gonzalo para el estilo: «Dejarlos disponibles para cambios particulares, pero por defecto en estilo global
  siempre debe ser el del recetario». Distingue visualmente lo impuesto por el recetario de lo editable por gráfico.

### 3.6 El documento Word

- El Word del recetario es un documento completo: portada (variantes A clásica, B banda, C partida) con logos, índices
  (contenido, gráficos, tablas), Introducción, «Cómo leer este informe» (Top Two Box, Bottom Two Box, redondeo, redacciones de
  la escala, cifras pequeñas, bases chicas), capítulos con apertura (B número grande, A con lista de secciones), figuras
  numeradas con base y «Lectura», tablas técnicas, contraportada con contacto.
- Un visor **navegable**: esquema de capítulos y subcapítulos a la izquierda (abrir y cerrar; clic lleva a la página;
  marca dónde estás al desplazarte), páginas reales al centro (una o dos por vista), minimapa, opciones del documento a la
  derecha (portada, capítulos, cierre).
- Debe «hacer todo lo que el recetario dice que hace»: cada opción del recetario Word tiene su control.

### 3.7 Biblioteca de íconos

- Catálogo navegable y con búsqueda de los 124 íconos (versiones navy, blanco, coral, verde). El motor elige el ícono por
  palabra clave (capítulo, actor, criterio de la ficha); el diseño debe mostrar **qué eligió** y permitir **reemplazarlo**.
  Primer consumidor: los íconos del índice. Después, objetivo (actores), ficha técnica y población.

## 4. Lo que el diseño no puede hacer

- No muestres controles que la salida nativa no usa (inventario, Parte B): tamaños sueltos, colores sueltos, `canvas_*`,
  `legend_*`, grosores, `alto_por_categoria`, «textos en negrita», ChartLayoutPopover. Se van.
- No uses una ficha de medidas («TIPO DE LÁMINA n DE 22») como si fuera una lámina; tampoco las páginas de explicación
  del recetario (capítulos 1.x «Identidad visual», 3.x catálogo de cajas y figuras) como ejemplos de tipo.
- No recortes las miniaturas a ciegas: recorta el área del gráfico (sin título, logo ni pie), quita los márgenes vacíos y
  encuadra sin deformar. Verifica cada una a la vista.
- No inventes datos ni textos de relleno que parezcan reales: usa los del recetario o rótulalos como ejemplo.
- No dupliques navegación entre dimensiones; no conviertas un panel en una página nueva.
- No uses hex sueltos en el CSS de la app: tokens `--pulso-*`. Los colores del recetario sólo dentro de las láminas.
- No prometas lo que la app no puede hacer (§6) sin marcarlo como «requiere backend» en la dirección.

## 5. Criterios de diseño (cómo se juzga)

- **Contrato de Superficie** (C1–C5, `docs/ui-layout-grammar.md`): cada superficie declara qué es, mantiene su marco con 0, 1,
  pocos o muchos elementos, contiene su propio vacío, deja todo alcanzable (un solo dueño de scroll por región, nada recortado)
  y entrega lo que promete.
- Geometría: escala de espaciado `--pulso-space-*`, radios del sistema, grupos pares con el mismo marco (miniaturas 16:9
  iguales, tarjetas de tipo iguales), sin vacíos sin dueño.
- Las vistas más importantes (visor de lámina, visor de Word) son las protagonistas; los ajustes acompañan.
- Viewports: 1440×1000 y 1024×600 como mínimo (también 1710×1107 y 1280×720 si cabe). A 1024 el inspector pasa a panel
  lateral superpuesto.
- Accesibilidad: foco visible, teclado (flechas para láminas y páginas), nombres accesibles, contraste AA.
- «Diseñar en grande por defecto»: el mínimo literal decepciona; propone la experiencia completa.

## 6. Realidad técnica medida (diseña para esto)

Medido el 2026-10-09 sobre una copia del proyecto acrconta (detalle en la Parte C del inventario):

- La vista previa usa **el mismo motor del export** (`POST /api/graficos/preview-slide`, `api/R/router_graficos.R`), con
  LibreOffice para rasterizar. Tarda **4–7 s por lámina**: diseña estados «regenerando» y «desactualizada»; no prometas
  tiempo real. El caché de 5 min hace instantáneo volver a una lámina vista.
- **Desde el commit 55ff0d1bf** la respuesta trae `partes` (cuántas «(cont.)», con título y estado `nativa` /
  `ruta_anterior` / `sin_grafico`) y `slide_previews` (todas las partes rasterizadas). En el mazo real de acrconta: 85
  nativas, la portada sin gráfico y **el índice por la ruta anterior** (sus argumentos de «focos» lo fuerzan; inventario A9).
- Aún falta: el antetítulo y el folio reales en la vista previa (hoy faltan en el mini-plan) y capturar los avisos del motor.
- **Word**: no hay visor hoy. Generar el DOCX tarda ~200 s (por job); convertirlo a páginas, ~17 s. LibreOffice deja los
  índices (TOC) vacíos; Word los llena al abrir. El visor del Word se diseña como «la última versión exportada», con un
  botón para regenerarla y su progreso, no como algo en vivo.
- En la app de escritorio, LibreOffice **irá incluido en el instalador** (decisión de Gonzalo, 2026-10-09: «se instala en el
  instalador de escritorio»). Aun así diseña el estado «el renderer falló» (un error puntual), con su salida.

## 7. Entregables

1. **Maqueta interactiva** en `tmp/f6-diseno/maqueta/` (HTML, CSS y JS sin dependencias; puede usar React por CDN si lo
   justificas), con **todas** las superficies de §3, navegable de punta a punta, y un interruptor de viewport 1440 / 1024.
   Todo seleccionable: láminas, capítulos, ranuras de gráfico, tipos, variantes, páginas, paletas, íconos.
   - Assets reales del recetario: convierte con
     `soffice --headless --convert-to pdf --outdir <dir> docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx`
     (usa un perfil propio: `-env:UserInstallation=file:///<dir>/perfil`) y
     `pdftoppm -r 60 -png -f N -l N <pdf> <prefijo>` para miniaturas (120–150 dpi para la lámina grande). Haz lo mismo con
     `propuesta-word.docx`. Los íconos, desde `herramientas/iconos/`. Logos: `api/inst/estandar/logos/`.
   - Antes de usar una página, **mírala** (hojas de contacto con `magick montage` y `-label '%t'`) y confirma qué es.
2. **Documento de dirección** en `docs/qa/direccion-diseno-editor-graficos-f6-<fecha>.md`: problema, principios, mapa de
   superficies en la gramática módulo → modo → sección → pestaña → panel, contrato de armonía (rejilla, espaciado, grupos
   pares y su capacidad 0/1/pocos/muchos, dueño de scroll), inventario de componentes nuevos y cuáles del repo se reutilizan
   (`PageFrame`, `AdaptiveSplitView`, `PulsoButton`, `GlidingTabList`, `Panel`, `Popover`), qué controles se van y qué
   controles se agregan (mapeados a los ítems A1–A24 y B del inventario), y la lista de lo que **requiere backend** (§6).
3. **Capturas** de cada superficie a 1440 y 1024 en `tmp/f6-diseno/capturas/`.

No toques código de producto (`frontend/src`, `api/R`). No commitees los assets generados. Si escribes el documento de
dirección dentro de `docs/`, commitealo sólo por nombre de archivo (`git add <ruta>`; nunca `git add -A`: otras sesiones
trabajan en el mismo árbol). Commits en español, conventional commits.

## 8. Cómo trabajar

1. Lee §2. Abre el editor actual con el skill `/ver-ui` (proyecto `acrconta`) para entender lo que hay, sin modificar nada.
   Nunca uses ni mates el backend del puerto 8787: es el del usuario.
2. Haz las hojas de contacto del recetario y del Word; anota la tabla página → qué es.
3. Escribe primero el documento de dirección (corto) y después la maqueta.
4. Revisa tu maqueta en el navegador integrado a 1440 y 1024: nada recortado, nada desbordado, miniaturas bien encuadradas,
   sin imágenes rotas (sirve los archivos con `python3 -m http.server`, que con muchas imágenes puede perder alguna: recarga
   y verifica que todas cargaron).
5. Presenta a Gonzalo: un resumen corto, la tabla de lo que se va y lo que entra, lo que requiere backend, y las preguntas
   que de verdad sean suyas. No declares el diseño aprobado: lo aprueba él.


> Corrección 2026-10-10: cinco páginas de la lista de tipos de gráfico estaban mal; corregidas contra las 274 páginas
> del recetario (ver `inventario-iconos-recetario-2026-10-10.md`).
