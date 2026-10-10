# Dirección de diseño — el editor de Gráficos remasterizado (F6.0)

Tipo: Dirección de diseño (propuesta)
Estado: Propuesta para aprobación de Gonzalo; no aprobada
Fecha: 2026-10-09
Autoridad: Los hechos del motor están medidos en `inventario-f6-editor-2026-10-09.md`; las decisiones de Gonzalo
citadas ahí mandan sobre este documento. La maqueta vive en `tmp/f6-diseno/maqueta/` (no versionada) y sus capturas en
`tmp/f6-diseno/capturas/`.

## 1. Problema

El editor de Procesamiento › Gráficos sigue siendo el de la era ggplot. Ofrece 61 ajustes de estilo por gráfico que la
salida nativa no lee, esconde la lámina real detrás de un botón «Ver lámina», no deja insertar 12 de los 33 tipos del
registro, no sabe decir si una lámina sale nativa o por la ruta anterior, no muestra las partes «(cont.)», no tiene una
sola opción del documento Word y confunde dos decisiones distintas: **qué lámina** (cuántos gráficos y dónde) y **qué
gráfico** (cómo se dibuja cada pregunta). Mientras tanto, los dos motores ya dibujan como el recetario (ADR 0092 y 0093):
22 tipos de lámina con ranuras fijas, variantes de portada, índice, separador y cierre, una biblioteca de 124 íconos y un
documento Word completo.

**Tarea primaria** del analista: armar el informe viendo la lámina que va a salir y decidiendo sólo lo que el motor usa.

## 2. Principios

1. **La lámina es la protagonista.** Ocupa el centro, siempre visible, con todas sus partes. Los ajustes acompañan.
2. **Todo control visible cambia la salida.** Lo que fija el recetario se ve como fijo (una línea «Lo fija el recetario»
   con candado) o no se ve. Los controles del inventario Parte B salen del editor.
3. **Dos preguntas, dos selectores.** «¿Qué lámina?» (composición: cuántos gráficos y dónde) y «¿Qué gráfico?» (cómo
   se dibuja una pregunta). Se eligen por separado; cambiar la lámina conserva los gráficos configurados.
4. **Didáctico, no calcado.** Los tipos se explican con composiciones propias dibujadas desde las ranuras del estándar
   (SVG vivos, con los gráficos de la lámina actual acomodados en la composición candidata), agrupados por lo que el
   analista quiere mostrar. El ejemplo real del recetario queda como respaldo en el detalle, nunca como ficha de medidas
   confundida con un tipo. Todo lo dibujado sigue las reglas del estándar (`estandar_pulso.json`, `ppt.reglas`): antetítulo
   gris de 10 pt y título coral de 24 pt sobre la barra navy; cifras «31%» sin espacio, en azul y en negrita dentro de la
   barra; la cifra chica sube con guía y las contiguas se escalonan (lámina 15); premisas y actores en azul con su «n
   respuestas» en gris; columna «Top Two Box» verde con «x de y»; la categoría mayor en azul y las demás en el tono de
   apoyo; SIN INF gris al final; coral sólo en títulos y en el filete de la narrativa. En Word las cifras también van
   sin espacio («35%»); el rótulo es «Gráfico N» en negrita y, en la línea siguiente, el título en cursiva; la base y la
   fuente van centradas bajo la figura, como están dibujadas en la propuesta Word (página 9).
5. **Honesto con el tiempo.** La vista previa tarda 4–7 s por lámina: hay estados «regenerando» y «desactualizada», y
   el Word se muestra como «última versión exportada», no en vivo.
6. **La estructura es un documento.** Capítulo → subcapítulo → lámina, con separadores, numeración automática y el
   antetítulo heredado; de ahí se renumeran el índice y el Word.
7. **Una sola gramática.** Módulo → sección → pestaña → panel. Nada nuevo fuera de esas dimensiones.

## 3. Mapa de superficies (gramática de navegación v3)

Módulo **Procesamiento** (`/procesamiento`, acento `--pulso-module-processing`) → sección **Gráficos**
(`seccion=graficos`) → cuatro pestañas en el rail icon-only del módulo → paneles direccionables.

| Pestaña (`pestana=`) | Qué es | Paneles (`panel=`) |
|---|---|---|
| `laminas` (por defecto) | El editor: Estructura · Visor · Inspector | `tipo-lamina`, `tipo-grafico`, `iconos`, `inspector` (sideover a 1024), `avisos` |
| `vista-general` | Clasificador por capítulos: reordenar, insertar, saltar a editar | `tipo-lamina` |
| `word` | Visor del documento Word: esquema, páginas, opciones | `regenerar` (progreso) |
| `estilo` | Estilo del cliente con vista previa viva | `iconos`, `paleta-propia` |

`foco=` señala la lámina (`foco=l-07`), la ranura (`foco=l-07:g2`) o la página del Word (`foco=p-14`). Los nombres viejos
(`tab`, `stage`) sólo se leen. Ejemplos:

- `/procesamiento?seccion=graficos&pestana=laminas&foco=l-07:g2&panel=tipo-grafico`
- `/procesamiento?seccion=graficos&pestana=word&foco=p-14`

**Se conserva** (R4): navegación v3 y top bar del módulo (ADR 0042), rail icon-only de pestañas, `PageFrame workbench`
con `scrollOwner="panels"`, la idea de línea de tiempo (ahora árbol de estructura), el inspector por secciones, el
autoguardado con `SaveStatusIndicator`, el selector de base del chrome y el flujo de exportación por jobs.

**Se va**: Timeline / Canvas / Cómodo como modos, «Ver lámina», «Buscar entre 61 ajustes», ChartLayoutPopover, Estilo
global de 8 pestañas, el selector de slide como lista de fichas de texto.

## 4. Las superficies

### 4.1 Pestaña Láminas (el editor)

Tres columnas: **Estructura** (280 px, rail), **Visor** (flexible), **Inspector** (360 px). A 1024 × 600 la estructura se
compacta a 232 px, el inspector pasa a sideover (`panel=inspector`) con un botón «Ajustes» en la barra del visor, la tira
de miniaturas se pliega (la estructura ya las muestra) y las partes «(cont.)» pasan a la cabecera del visor: el lienzo
conserva al menos 380 px de alto.

- **Estructura.** Árbol vivo: bloques sin número (Apertura, Cómo leer este informe, Cierre) y capítulos numerados con
  subcapítulos. Cada fila de lámina: asa de arrastre, tipo (ícono de composición), título, contador de partes y punto de
  estado (nativa · ruta anterior · aviso · sin gráfico). Acciones al pasar: insertar lámina, insertar subcapítulo,
  insertar capítulo. Abrir/cerrar todo. Buscar. La numeración (1, 1.1, 1.2…) y el conteo se recalculan solos.
- **Visor.** Barra: anterior/siguiente, «Lámina 7 de 22 · parte 1 de 2», estado nativa/ruta anterior con motivo y acción,
  zoom, guías, «Cambiar lámina». Al centro la lámina 16:9 rasterizada por el motor real; debajo, las partes «(cont.)»
  como pestañas de página; al pie, la tira de miniaturas agrupada por capítulo. Los gráficos de la lámina son ranuras
  seleccionables sobre la imagen: clic → Datos de ese gráfico en el inspector; doble clic o «Cambiar gráfico» → selector.
  Teclado: ← → lámina, ↑ ↓ parte, Esc deselecciona la ranura.
- **Inspector.** Cabecera con el tipo de lámina (composición en miniatura + nombre + «Cambiar»). Secciones fijas:
  **Contenido** (antetítulo heredado y editable, título, lectura/narrativa que también alimenta la «Lectura» del Word),
  **Composición** (variantes con miniaturas reales cuando el tipo las tiene), **Gráficos** (una tarjeta por ranura; la
  seleccionada se expande con sus datos) y **Estado** (cómo sale, motivo, avisos del motor, «usar la ruta anterior»
  como opción avanzada). Lo que fija el recetario aparece en una línea cerrada con candado.

### 4.2 Pestaña Vista general

Clasificador por capítulos: cada capítulo es una fila con su separador y sus láminas como tarjetas 16:9 pares; se
reordena arrastrando láminas y capítulos; conteos por capítulo; doble clic lleva a editar (`pestana=laminas&foco=`).

### 4.3 Panel «Tipo de lámina» (`panel=tipo-lamina`)

Diálogo grande. Izquierda, la pregunta del analista: **Una sola pregunta · Dos preguntas juntas · Varias preguntas de
un tema · Describir a un público · Destacar cifras · Dejar un mensaje**, más el grupo **Estructura del informe**
(portada, índice, objetivo, ficha técnica, cómo leer, separador, cierre). Centro, tarjetas pares con la **composición
dibujada en vivo desde las ranuras del estándar** y, si hay lámina actual, **sus gráficos acomodados en la composición
candidata** («así quedaría»); nombre, cuántos gráficos y cuándo se usa. Derecha, el detalle: composición en grande,
«Admite», escala de la cifra, pestañas **Ejemplo** (la lámina real del recetario) y **Medidas** (la ficha), y el botón
«Usar esta lámina». Si el tipo tiene menos ranuras que gráficos configurados, lo dice antes de aplicar.

### 4.4 Panel «Tipo de gráfico» (`panel=tipo-grafico`)

Diálogo. Izquierda, familias: **Categorías · Escalas · Números · Comparar · Dimensiones · Territorio · Texto**. Centro,
tarjetas pares con un glifo propio del gráfico dibujado con la paleta vigente (no una captura), nombre y para qué sirve;
marca «ruta anterior» en los que no salen nativos (nube de palabras, serie de 3 o más mediciones, mapa de calor de
criterios). Derecha, detalle: qué muestra, qué pide (una pregunta, una escala, dos públicos…), si cabe en la ranura
actual, el ejemplo real del recetario y «Usar este gráfico».

### 4.5 Panel «Íconos» (`panel=iconos`)

Catálogo de los 124 íconos en grupo `equal` cuadrado, con búsqueda por palabra clave y color (navy, blanco, coral,
verde). Muestra qué eligió el motor y por qué («elegido por “Perfil del encuestado”») y permite reemplazarlo. Primer
consumidor: el índice; después objetivo (actores), ficha técnica y población.

### 4.6 Pestaña Estilo del cliente

Izquierda, secciones: **Identidad** (nombre, logos izquierda/derecha), **Colores de marca** (azul, coral del recetario),
**Paletas** (Likert del recetario por defecto, Likert con punto medio, azules, dicotómica, actores, calor, mapa, paleta
propia), **Tipografía**, **Cifras y redondeo** (estándar / resto mayor, decimales, bases chicas), **Documento Word**
(valores por defecto). Derecha, **vista previa viva**: una lámina y una página de Word dibujadas con el estilo elegido.
Cada grupo distingue «Del recetario» (sello) de «Propio de este cliente»; «Volver al recetario» siempre visible.

### 4.7 Pestaña Documento Word

Cabecera: «Última versión exportada · hoy 21:14 · 60 páginas» y «Regenerar» con progreso (≈3 min). Izquierda, esquema de
capítulos y subcapítulos (abrir/cerrar; clic lleva a la página; marca dónde estás). Centro, páginas reales, una o dos
por vista, con zoom. Derecha, opciones del documento: portada (A clásica, B banda, C partida), apertura de capítulo (A
lista, B número grande), «Cómo leer este informe» (Top Two Box, Bottom Two Box, redondeo, redacciones, cifras pequeñas,
bases chicas), índices (contenido, gráficos, tablas), contacto de la contraportada, título corto, fuente.

### 4.8 Estados (todas las superficies)

Vacío (sin informe, sin lámina, sin ranura), cargando (regenerando 4–7 s), desactualizada (cambió el plan y la lámina no se
regeneró), error del motor (con `error_id`), sin renderer (LibreOffice ausente: aviso y qué hacer; desde la decisión del
2026-10-09 viaja en el instalador, así que es un estado excepcional) y muchos elementos (60 láminas, 12 capítulos).

## 5. Contrato de armonía (govern-visual-harmony, modo Direct)

- **Rejilla.** Workbench de tres columnas 280 / 1fr / 360 a 1440; 232 / 1fr / sideover a 1024. Un dueño de scroll por
  columna (C4). Barras de 44 px, controles de 28 px, cabeceras de panel de 40 px.
- **Espaciado.** Sólo `--pulso-space-1..9`; tarjetas con `--pulso-radius-card`, paneles `--pulso-radius-panel`, chips
  `--pulso-radius-chip`.
- **Grupos pares (C1/C2).** Tarjetas de tipo de lámina: `equal`, 16:9 interior de 180 × 101 px, marco de alto fijo.
  Tarjetas de tipo de gráfico: `equal`, 16:10. Íconos: `equal`, 72 × 72. Miniaturas de la tira: `equal`, 128 × 72.
  Páginas del Word: `equal`, A4. Capacidad 0 / 1 / pocos / muchos: el marco no cambia con `items.length`; el vacío se
  dibuja dentro de la caja (C3) con su mensaje y su acción.
- **Jerarquía.** Lámina y página de Word al centro, a tamaño real relativo; los ajustes a 13/12,5 px; títulos de panel
  15 px / 600; metadatos 11,5 px en `--pulso-text-faint`.
- **Color.** La app usa sólo tokens `--pulso-*` (acento del módulo para selección, foco y rail; semánticos para estados).
  Los colores del recetario (`#081F5C`, `#CA5651`, Likert) sólo aparecen **dentro** de las láminas y páginas dibujadas.
- **Movimiento.** 120–180 ms, `ease-out`; el árbol y las partes animan altura; sin movimiento con `prefers-reduced-motion`.
- **Accesibilidad.** Foco visible de 2 px con el acento, nombres accesibles en ranuras y miniaturas (`Gráfico 2 de 4:
  Rango de edades`), tabs ARIA en inspector y Word, flechas en láminas y páginas, contraste AA.

## 6. Componentes

Reutilizados: `PageFrame` (`layout="workbench"`, `scrollOwner="panels"`), `AdaptiveSplitView`, `PulsoButton`,
`GlidingTabList` (secciones del inspector y pestañas del Word), `Panel`, `Popover`, `Switch`, `SaveStatusIndicator`,
`JobProgress` (regenerar Word), `States` (vacíos), `FilterChip`, `Top2BoxSelector` (ya elige exactamente dos categorías).

Nuevos (archivo propio, hoja CSS propia, sin crecer `editor-v2.css`):

| Componente | Función |
|---|---|
| `EstructuraInforme` | Árbol capítulo → subcapítulo → lámina con arrastre, numeración y estado |
| `VisorLamina` | Lámina rasterizada, partes, ranuras seleccionables, guías, estado nativa/respaldo |
| `TiraMiniaturas` | Miniaturas por capítulo |
| `ComposicionLamina` (SVG) | Dibuja una composición desde las ranuras del estándar; acepta los gráficos actuales |
| `GlifoGrafico` (SVG) | Glifo de cada tipo de gráfico con la paleta vigente |
| `SelectorTipoLamina` · `SelectorTipoGrafico` · `BibliotecaIconos` | Los tres paneles |
| `InspectorLamina` · `InspectorGrafico` · `InspectorEstructura` | Secciones Contenido · Composición · Gráficos · Estado |
| `EstiloCliente` + `PreviewEstilo` | Perfil y vista previa viva |
| `VisorWord` + `EsquemaWord` + `OpcionesDocumento` | Pestaña Word |

## 7. Lo que se va y lo que entra

**Se va del editor** (inventario Parte B; decisión 1 de Gonzalo): `size_*`, `color_*` sueltos, `font_family`, `canvas_*`,
`legend_*`, `grosor_*`, `alto_por_categoria`, `textos_negrita`, `umbral_*`, `debug_ph_*`, `mostrar_valores`, conectores,
wrap/ancho de eje, títulos de grupo, `donut_hole`, estilo de tabla del radar, semáforos; ChartLayoutPopover (R3) y el
«Estilo global» de 8 pestañas (A20). La ruta anterior usa sus valores por defecto.

**Entra** (inventario Parte A):

| Control nuevo | Ítem |
|---|---|
| Selector de 22 tipos + estructura desde el registro, con composición y ranuras | A1, A2 |
| Opciones del documento Word (portada, apertura, cómo leer, redondeo, contacto, título corto, fuente) | A3, A4 (hecho), A10 |
| Orden de filas: Top Two Box (recetario) / instrumento | A5 |
| Bottom Two Box con dos chips, al lado del Top Two Box | A6, R14 |
| Fila Total | A7 |
| Variantes de portada con aviso si el título no cabe | A8 |
| Índice: composición (arcos, facetas, círculos, bloques) e ícono por capítulo; se retiran los «focos» | A9 |
| Cierre: variante y contacto compartido con la contraportada Word | A10 |
| Antetítulo por lámina con el heredado como marcador | A11 |
| Separador: nivel, número, rótulo, bajada | A12 |
| Lámina de redondeo con el método del informe | A13 |
| Top Two Box: chips de categorías, sin args de estilo | A14, A23 |
| Objetivo: lista de actores | A15 |
| Marcas 0-25-50-75-100 % y eje libre | A16 |
| Biblioteca de íconos (124) con elección automática visible | A17 |
| Lectura bajo figura y secciones en la apertura Word | A18 |
| Paletas del estándar (dicotómica, actores, categorías, calor, mapa, Likert con neutro) | A21 |
| Indicador nativa / ruta anterior por lámina y «usar la ruta anterior» avanzado | A22 |
| Fila «Muestra» de la ficha técnica con su formato de ejemplo | A24 |

## 8. Requiere backend (no lo resuelve la UI)

Medido en la Parte C del inventario; cada punto se marca «requiere backend» en la maqueta:

1. Antetítulo y folio reales en la vista previa (hoy faltan en el mini-plan) y captura de los `[PULSO-AVISO]` por lámina.
2. Estado «desactualizada» y cancelación: debounce y hash del plan por lámina; soffice persistente para bajar a 1–2 s.
3. Canal `slide.meta` de punta a punta (variante, composición, íconos, actores, antetítulo, nivel, número, rótulo,
   `motor_nativo`).
4. `opciones_documento` del job de Word y endpoint de visor: DOCX → PDF → PNG por job, mapa de capítulos por página,
   TOC rellenado o aviso.
5. Empaquetar los 124 íconos y exponer la elección automática (palabra clave → ícono).
6. Pieza «Cifra» del motor (A19) antes de ofrecer «Destacar cifras» con datos reales.
7. LibreOffice y el paso PDF → PNG dentro del instalador (decisión del 2026-10-09); el estado «sin renderer» queda como
   excepción.

## 9. Cómo ver la maqueta

```bash
cd tmp/f6-diseno/maqueta && python3 -m http.server 8932 --bind 127.0.0.1
```

Abre `http://127.0.0.1:8932`. La barra superior cambia el viewport (1440 / 1024) y el estado (normal, cargando,
desactualizada, error, sin renderer, sin informe, muchas láminas); la dirección canónica se ve a la derecha y en el hash.
Las capturas de `tmp/f6-diseno/capturas/` se regeneran con `node tmp/f6-diseno/capturar.mjs` (usa el Playwright de
`frontend/`). Los assets (`assets/`) salen del PDF del recetario y de la propuesta Word convertidos con LibreOffice; no se
versionan.

## 10. Preguntas para Gonzalo

1. En la pestaña Láminas, ¿el inspector por defecto abre en **Gráficos** (datos) o en **Contenido**?
2. «Destacar cifras» (tipos 21 y 22 y las láminas 172–175) depende de la pieza «Cifra» del motor: ¿se muestra ya en el
   selector marcado «requiere backend» o se oculta hasta que exista?
3. El cambio de composición de índice y cierre, ¿vive en el inspector de esa lámina (como propongo) o también en Estilo
   del cliente como valor por defecto para informes nuevos?
