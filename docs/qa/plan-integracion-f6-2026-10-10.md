# Plan de integración F6 — editor de Procesamiento › Gráficos

Tipo: Plan de construcción (arquitecto-integracion, solo lectura, 2026-10-10)
Estado: Vigente para F6.1–F6.5. Autoridad: `direccion-diseno-editor-graficos-f6-2026-10-09.md` (aprobada por Gonzalo) manda
sobre este plan; aquí sólo se decide cómo se construye. Decisiones provisionales de §10: el inspector abre en Contenido;
la composición de índice/cierre vive en el inspector (y también como valor por defecto en Estilo si Gonzalo dice sí a E2);
«Destacar cifras» visible.

## 0. Hallazgos verificados en el código antes de construir

- La maqueta usa tokens que no existen (`--pulso-warning-*`, `--pulso-control-h`, `--pulso-font`, `--pulso-mono`): el
  contrato `tokensDefinidos` los rechazaría. Mapeo correcto en §2.1.
- Dentro de `.pulso-graficos-frame`, `--pulso-primary` ya es el teal del módulo, no el navy.
- La sección Gráficos no tiene pestañas en el catálogo de navegación (`ProcesamientoSeccionId` no incluye `graficos`).
- `config.documento_word`: el backend lo acepta (`router_graficos.R` ~1537) pero arma la config desde lo que llega; el
  frontend (`buildGraficosConfigFromStore`) no lo envía, así que **el autosave lo borra**. Se corrige antes de F6.4 (§5.4).
- `SlideType` del frontend tiene 22 tipos; el registro del backend 33 (faltan `p_slide_redondeo`, `2_graficos_vertical`,
  `asimetrico`, los `3_graficos_*`, `cifras_y_graficos`, entre otros).

## 1. Arquitectura

### 1.0 Navegación

- Catálogo (`lib/navegacion/catalogos/procesamiento.ts`): `graficos` en `ProcesamientoSeccionId`, ruta `/graficos` y
  pestañas `laminas` (por defecto), `vista-general`, `word`, `estilo` y `clasico` (transición, condicional). En
  `lib/modules.ts` la sección gana `tabs`. Lo cubre `modulesNavigation.test.ts`.
- `pestana` se lee con `PARAMS_DIRECCION` (patrón `AnaliticaPage.tsx:105-134`); `foco` con una función pura en
  `f6/direccionF6.ts` (`l-<id>`, `l-<id>:g<n>`, `p-<n>`). `tab` y `stage` sólo se leen.
- Paneles en `panelesGraficos.ts`: `tipo-lamina`, `tipo-grafico`, `iconos`, `paleta-propia` (diálogo); `inspector`,
  `avisos` (sideover); `regenerar` (popover). `biblioteca-slides` y `biblioteca-graficadores` quedan como alias.
- `GraficosPage.tsx` sigue siendo dueño de la página: `layout="workbench"`, `scrollOwner="panels"`, `AdaptiveSplitView`
  con `ContextTabRail` como Analítica. La exportación sale a hooks propios (`f6/useExportarInforme.ts`,
  `f6/useInformeCompartido.ts`). `GraficosPrepBlocked` y la carga siguen por encima de las pestañas.

### 1.1 Componentes (todo en `frontend/src/features/graficos/f6/`, un componente por archivo, CSS propio)

`editor-v2.css` y `GraficosHeader.tsx` no crecen.

- **Común (`f6/comun/`)**: `BarraPestana` (título, chip de bases, «N láminas · M partes», `SaveStatusIndicator`,
  deshacer/rehacer extraído de `GraficosHeader:1596`, «Avisos N», «Exportar ▾» reusando `GraficosHeader:773-812,
  1119-1200` y `apiSaveFileAs`, menú ⋯), `ChipEstado`, `PuntoEstado`, `LineaRecetario`, `SelloOrigen`,
  `ComposicionLamina` (SVG desde ranuras), `GlifoGrafico` (SVG por graficador), `DialogoF6`, `SideoverF6`.
- **Pestaña `laminas` (`f6/laminas/`)**: `PestanaLaminas` (rejilla 280 / minmax(0,1fr) / 360 desde 1280; 232 / 1fr +
  sideover debajo; cabecera fija de 40 px y scroll propio por columna, C4); `EstructuraInforme` (+ `BuscadorEstructura`,
  `NodoBloque`, `NodoCapitulo`, `FilaLamina`, `AccionesFila`) con datos de `derivarEstructura(plan.slides)` (función pura:
  capítulo = `p_slide_seccion` sin `nivel: "subcapitulo"`; Apertura/Cómo leer/Cierre por tipo; numeración calculada; sin
  migrar datos); `VisorLamina` (+ `BarraVisor`, `LienzoLamina`, `RanurasSobreLamina`, `PartesLamina`, `TiraMiniaturas`)
  con `crearCoordinadorPreviewLamina` + `apiGraficosPreviewSlide(..., {render_slide_preview, preview_partes})`,
  `apiGraficosPreviewRenderer()` y `useSlideCompositions`; `InspectorLamina` (`CabeceraTipoLamina` + `GlidingTabList`):
  `SeccionContenido` (antetítulo heredado vía `conSlideMeta`, título, lectura, base, pie, `introduccion_word`),
  `SeccionComposicion` (variantes por `meta.variante`/`meta.composicion`, íconos por capítulo, separador, redondeo),
  `SeccionGraficos` (`TarjetaGrafico` + `DatosGrafico`: pregunta, orden, máximo de categorías, paleta, `Top2BoxSelector`,
  Bottom Two Box, `FiltersPanel`, `BaseLabelsField`, «En el Word», `MultiApiladasBuilder` envuelto; argumentos filtrados
  por `f6/argsVisibles.ts` sin los de la Parte B), `SeccionEstado` (motivo, avisos, «usar la ruta anterior»);
  `PanelAvisos` (`usePlanValidator` + avisos por lámina).
- **Paneles (`f6/paneles/`)**: `SelectorTipoLamina` (por intención, `ComposicionLamina` con los gráficos actuales,
  Ejemplo/Medidas con `TablaMedidas`), `SelectorTipoGrafico`, `BibliotecaIconos` (`apiGraficosIconosRecetario`,
  `apiGraficosElegirIconos` con motivo; pestaña «Del cliente» con `IconosEditor`).
- **Pestaña `vista-general`**: `PestanaVistaGeneral`, `FilaCapitulo`, `TarjetaLaminaGeneral` (176×99, equal);
  `PlanCoverageBadge`, «Armar desde…» (`SuggestedPlanButton` + equivalencias), `Switch` de «Otros» automáticos.
- **Pestaña `word`**: `PestanaWord`, `EsquemaWord`, `VisorPaginasWord`, `OpcionesDocumento`; «Regenerar» = job
  `apiGraficosWord(..., opciones_documento)` y luego `apiGraficosWordVisor(fileId)` con `JobProgress`. En consolidado,
  deshabilitada con motivo.
- **Pestaña `estilo`**: `PestanaEstilo` con Identidad (`PptStyleProfilesPanel`), ColoresMarca, Paletas
  (`PaletasEditor`), Tipografía, CifrasRedondeo (`CalculosEditor`), DocumentoWordDefaults; `PreviewEstilo` en HTML/SVG.

### 1.2 Estado

| Dato | Dónde vive |
|---|---|
| Plan, slides, payload, meta, presets, paletas, íconos, `autoOtrosSlides`, deshacer | `usePlanStore` (autosave existente) |
| Opciones del Word | Nuevo `documentoWord` en `usePlanStore` + `configSnapshot.ts` + normalizador (obligatorio, §5.4) |
| Imágenes de vista previa, partes, avisos | Backend; caché no persistida por `(slideId, clave)` |
| Visor Word | Backend por job; el store guarda el último de la sesión |
| Estado UI | Nuevo `f6/useEditorF6Store.ts` (zustand): sección del inspector, ranura, parte, zoom, guías, nodos abiertos, búsqueda, previews y miniaturas por lámina, página/zoom del Word, sección de Estilo |

Pestaña y panel viven en la URL, no en el store.

### 1.3 Convivencia y retiro

Durante F6.1–F6.4 el editor actual queda como pestaña `clasico` («Editor anterior», condicional, al final del rail) sobre
el mismo `usePlanStore`. Se aterriza en `laminas`. El retiro (F6.5) exige la checklist de paridad 1–22 en verde, un ADR
«Retiro del editor V2 de Gráficos» y la confirmación de Gonzalo; antes de borrar, `rg` de importadores y de contract tests
que nombren `pulso-gv2-*`.

## 2. Sistema visual

### 2.1 Maqueta → tokens existentes

| Maqueta | Token real |
|---|---|
| `--pulso-primary` (uso app) | `--module-accent`, `--module-accent-soft`, `--module-accent-border` |
| surface, bg, border, text y variantes | mismos nombres |
| sombras | existentes; flotantes con `--pulso-shadow-popover` |
| radios 10 / 14 / 16 / 999 | existentes; los 8 px de la maqueta pasan a `--pulso-radius` |
| espaciado | `--pulso-space-1..9` (6→2, 10→3, 14→3 o 4) |
| `--pulso-warning-*` | `--pulso-warn-bg`, `--pulso-warn-border`, `--pulso-warn-fg`; punto de aviso `--pulso-warn-accent` |
| `--pulso-control-h` 28 / 36 | `--pulso-control-height-md` / `-lg` (botones de 24–26 suben a 28, `PulsoButton sm`) |
| `.12s`/`.15s` ease | `--motion-dur-press` (120) / `--motion-dur-fast` (160) con `--motion-ease-out` |
| pesos literales | `--pulso-weight-medium/-semibold/-bold/-heavy` |
| foco 2 px | `outline: var(--pulso-nav-focus-outline-width) solid var(--module-accent)` |
| `#fff` sobre acento / papel | `--pulso-nav-selected-fg` / `--pulso-surface` |
| translúcidos | `color-mix(in srgb, var(--module-accent) 5%, transparent)` y equivalentes |
| overlay con blur | `--pulso-material-bg-strong` |
| shell de la maqueta (56+44) | no se replica: chrome real (58 + 52) |

### 2.2 Tokens nuevos (en `frontend/src/app/tokens.css`; geometría y tipografía también en `branding/identity.json`)

- Tipografía: `--pulso-font-size-panel-title` 15, `-body` 13, `-control` 12.5, `-meta` 11.5, `-micro` 11 (mayúsculas,
  semibold, .04em), `-display` 28. El 9,5 de la maqueta sube a 11.
- `--pulso-font-mono`, `--pulso-radius-media: 4px`, `--pulso-workbench-bar-h: 44px`, `--pulso-panel-head-h: 40px`.
- Colores del recetario `--pulso-recetario-*` espejo de `estandar_pulso.json` `ppt.colores`, sólo dentro de láminas o
  páginas dibujadas; contract test `f6/recetarioTokens.contract.test.ts` contra el JSON.

### 2.3–2.5 Jerarquía, estados, interacción

- Lámina o página al centro con el máximo alto posible (`container-type: size`); a 1024×600, ≥380 px de lienzo.
- Títulos de panel 15 semibold; ajustes 13/12,5; metadatos 11,5 tenues; números en mono con `tabular-nums`.
- Grupos `equal`: filas de lámina 44 px, tira 128×72, tarjetas de tipo de lámina 236×201, de gráfico 16:10, íconos 72×72,
  páginas A4, tarjetas de Vista general 176×99.
- Estados dentro de su caja (C3): cargando (esqueleto 16:9 «Generando la lámina»), desactualizada (imagen anterior con
  blur y chip), error (banner con `error_id` y Reintentar), sin renderer (banner informativo; el resto sigue operativo),
  vacíos con acción, muchos elementos (virtualizar >80 filas), prep bloqueado, consolidado.
- Movimiento 120/160 ms ease-out; nada con `prefers-reduced-motion`. Teclado: ←/→ lámina, ↑/↓ parte, Esc, Alt+↑↓,
  Cmd+D, Supr con deshacer, Cmd+Z, «/», «?»; J/K como alias. ARIA: árbol `role=tree`, tablists, nombres accesibles por
  ranura y miniatura, `aria-live` para la vista previa.

## 3. Reuso

- **Tal cual**: `PageFrame`, `AdaptiveSplitView`, `ContextTabRail`, `PulsoButton`, `GlidingTabList`,
  `GlidingRadioGroup`, `Switch`, `Popover`, `Panel`, `States`, `Alert`, `SaveStatusIndicator`, `JobProgress`,
  `ChromeBaseSelector`, `Top2BoxSelector`, `PlanCoverageBadge`, `SuggestedPlanButton`, `useLibraryDialogA11y`,
  `previewLaminaCoordinador`, `slideMeta`, `graficosRecursos`, `useSlideCompositions`, `usePlanValidator`,
  `useGraficosAutosave`, `humanizeExportError`.
- **Se envuelven**: `FiltersPanel`, `MultiApiladasBuilder` (congelado), `BaseLabelsField`, `CalculosEditor`,
  `PaletasEditor`, `IconosEditor`, `PptStyleProfilesPanel`, `WordPresetsEditor`, `ArgGroup`/`ArgField` filtrados;
  `UndoRedoButtons` y el menú de exportar/compartir se extraen de `GraficosHeader`.
- **Se retiran en F6.5 (con ADR)**: `v2/` completo y `editor-v2.css`, `ChartLayoutPopover`, `buscarAjustes`,
  `GraficadorPicker`, `SlidePreview`/`SlidePreviewMockup`, `ContenidoEditor`, y los ya muertos `ConfiguracionGlobal`,
  `DefaultsModal`, `SlideEditor`, `TimelinePanel`.
- **Choques maqueta/primitivas**: gana la primitiva (tabs, segmentados, switch, chips, botones de 28, diálogo y sideover
  propios de la casa, un solo botón primario por vista).
- **Paridad (riesgos 1–22 del auditor-ui)**: 1, 2, 14, 15 → `BarraPestana`; 3 → `AccionesFila`; 4, 5, 18, 19 →
  `DatosGrafico`; 6, 8, 11 → Vista general; 7 → ámbito consolidado en `laminas` y `vista-general`; 9, 10, 17 → Estilo;
  12 → `panel=avisos`; 13 → chip de modo multibase; 16 → íconos del cliente; 20 → `derivarEstructura`; 21 →
  `GraficosPrepBlocked`; 22 → atajos.

## 4. Rebanadas

Gate común por rebanada: `tsc -b`, `vitest run src/features/graficos`, `make gate-front AREA=graficos`, `--audit`,
`ui-quick-check --ir procesamiento/graficos/<pestaña>` a 1440×1000 y 1024×600 con `--require-geometry --fail-on-issues`
y comparación con la captura homóloga de `tmp/f6-diseno/capturas/`. Verde por conformidad.

- **F6.1 Láminas (núcleo)**: pestañas y `clasico`; rejilla; Estructura (leer, seleccionar, buscar, duplicar, eliminar,
  mover, insertar); Visor (vista previa real, partes, estados, ranuras, guías, teclado); Inspector (Contenido y Estado
  completos, Gráficos con datos, filtros y T2B); barra con exportar, deshacer, guardado y avisos; store F6; tokens §2.2;
  `panel=inspector` a 1024. Listo cuando en acrconta se edita el título de la escala 13, la lámina se regenera con su
  antetítulo, se ven sus 2 partes, la ranura 2 abre sus datos y se exporta el PPT desde la barra.
- **F6.2 Selectores de tipo**: `ComposicionLamina`, `GlifoGrafico`, selectores de lámina y de gráfico, variantes;
  cambiar de lámina conserva los gráficos y avisa ranuras sobrantes; `SlideType` a 33 tipos.
- **F6.3 Vista general, íconos y estructura**: clasificador con arrastre, capítulos y subcapítulos, cobertura, «Armar
  desde…», biblioteca de íconos, miniaturas reales.
- **F6.4 Word y Estilo**: esquema, páginas, opciones, regenerar; `documentoWord` en store y config; Estilo con «Del
  recetario»/«Propio» y vista previa.
- **F6.5 Paridad y retiro**: checklist 1–22 con evidencia, matriz completa de viewports, evaluador UX y revisor
  metodológico, ADR y confirmación de Gonzalo; luego borrar §3 y bajar líneas base.

## 5. Contratos frontend↔backend pendientes

| # | Qué pide la UI | Contrato que falta |
|---|---|---|
| 5.1 | Composiciones desde ranuras, Medidas, «cuándo se usa» | `estandar` (uso, familia, ranuras) por slide en el registry, o `GET /api/graficos/estandar` (tipos de lámina, paletas, colores) |
| 5.2 | Familias del selector de gráfico y salida nativa por tipo | `familia_editor` y `salida` (+ motivo) por graficador en el registry |
| 5.3 | Punto de estado y miniaturas de 60 láminas | Job `POST /api/graficos/miniaturas` (estado y partes por `slide.id`, hash por lámina) o subproducto del export PPT |
| 5.4 | Opciones del Word persistentes | `documentoWord` en store, snapshot y normalizador con test de ida y vuelta; el backend hoy reemplaza la config |
| 5.5 | Estilo del cliente con procedencia | `config.estilo_cliente` con procedencia por clave; definir dónde viven los logos |
| 5.6 | Pestaña «Ejemplo» del recetario | Empaquetar ejemplos (`api/inst/recetario/ejemplos/`) y `GET /api/graficos/recetario/ejemplo?pagina=N`; sin esto la pestaña se oculta |
| 5.7 | «Destacar cifras» | La pieza Cifra está hecha en nativa y Word (graficos_cifra.R, lamina_cifras.R): chip «requiere backend» innecesario |
| 5.8 | Folio real en la vista previa | Verificar el número de lámina real; si no, pasar `slide_index` |
| 5.9 | Avisos del plan completo | Opcional: `POST /api/graficos/plan/avisos` |
| 5.10 | Visor Word | Hecho (`/word/visor`, `/word` con `opciones_documento`) |

## 6. Íconos por tipo (requisito de Gonzalo, 2026-10-10) — rebanada F6.1b

«Que cada tipo de lámina y cada tipo de gráfico tenga además de los gráficos que ya muestra un ícono profesional y pulido
[…] para que sea fácilmente distinguible en contextos donde se quiere mostrar con poco espacio.»

- **Inventario**: 33 tipos de lámina en `.SLIDES_META` (22 con ranuras en `estandar_pulso.json`, 11 de estructura sin
  ranuras) y 26 graficadores en `.GRAFICADORES_META`. Hoy `SlideTypeIcon.tsx` cubre 16/33 (nueve tipos comparten el mismo
  `LayoutGrid` de lucide) y `GraficadorTypeIcon.tsx` 15/26 (con dos tipos que ya no existen: `p_barras`,
  `p_dim_radar_tabla`). Sirven de base de estilo, no de arquitectura.
- **Dibujo**: `viewBox 0 0 24 24` mostrado a 16/20/24; trazo 1,5 redondeado; marco de lámina 16:9 con `rx` 1,5, bloques
  `rx` 0,75; ningún rasgo menor a 1,5 unidades; todo en `currentColor` (lleno .28, apoyo .45) y **un solo acento**
  `var(--icono-acento, currentColor)` que el contexto enciende con `--module-accent` (fila seleccionada, cabecera del
  inspector). Sin hex ni colores del recetario. La marca «ruta anterior» nunca va dentro del ícono.
- **Método híbrido**: las 22 láminas con ranuras se generan desde el estándar (`scripts/generar-ranuras-iconos.mjs` →
  `iconos/ranurasEstandar.generated.ts`, medianil fijo de 1); encima, rasgos a mano (círculo de población, banda de
  cifras), porque `corona` y `2mas1` tienen las mismas ranuras. Las 11 de estructura (portada, índice, separador,
  objetivo, ficha técnica, Top Two Box, redondeo, cierre, población 2/3/4) se dibujan a mano en el mismo marco. Los 26
  gráficos son esqueletos del tipo con la categoría mayor en acento.
- **Dónde**: fila de Estructura 20 px; cabecera del inspector 24; tarjeta de gráfico 20; barra del visor, tira,
  Vista general, menús, selectores y avisos 16. Distinto de `ComposicionLamina`/`GlifoGrafico` (≥64 px).
- **Componente**: `features/graficos/iconos/IconoTipo.tsx` — `IconoTipo({ clase: "lamina" | "grafico", tipo, size?:
  16 | 20 | 24, titulo?, ranuraActiva?, className? })` y `tieneIcono(clase, tipo)`; con `titulo` → `role="img"` +
  `<title>`, sin él → `aria-hidden`; tipo desconocido → marco con ranura punteada, nunca lucide. Archivos:
  `iconosLamina.tsx`, `rasgosLamina.tsx`, `iconosGrafico.tsx`, `iconoTipo.css`. `SlideTypeIcon` y `GraficadorTypeIcon`
  pasan a envoltorios que delegan (se borran en F6.5).
- **Contrato** `iconos/iconosTipo.contract.test.ts`: falla si falta o sobra un ícono respecto de `graficos_metadata.R`,
  si lo generado se desvió del estándar, si dos íconos de la misma clase son geométricamente iguales, si aparece un color
  fuera de regla o un rasgo menor a 1,5.
- **Rebanada**: en F6.1 un marcador con la API definitiva (`data-icono-provisional="true"`); en F6.1b los 59 íconos, el
  contrato y un pliego 16/20/24 sobre superficie normal y sobre `--module-accent-soft` **aprobado por Gonzalo** antes de
  dibujarlos todos. Riesgo: densidad de 5 y 6 gráficos a 16 px.
- **Bocetos**: seis SVG de ejemplo (cuatro gráficos, corona, separador, barras categóricas, dumbbell, divergentes) en el
  informe del arquitecto; se convierten en el pliego para que Gonzalo juzgue el estilo.

**Riesgo de navegación señalado por el arquitecto**: `foco=l-<posición>` apunta a otra lámina tras reordenar; decidir
id estable antes de F6.3.

## 7. Auditoría del editor actual (auditor-ui, 2026-10-10)

43 capacidades inventariadas; capturas a 1440×1000 y 1024×600 en el scratchpad de la sesión
(`auditoria-graficos/`). Sin `--require-geometry` (el runner no puede correr junto a la app de Gonzalo): medidas a mano.

Estado medido (acrconta, 4 bases, 67 láminas, cobertura 283/286):
- 1440×1000: sin scroll de página; dos scrollers anidados de 288 px en el inspector (posible scroll jail).
- 1024×600: **C4 falla** — la barra de comando desborda 31 px y corta «Exportar»; la timeline queda en 209 px (3 de 67
  láminas visibles); la fila de chips desborda 60 px.
- «Ver lámina» tardó **17,4 s** por la ruta `artifact-tool` (no los 4–7 s supuestos); el pie dice folio «1»; la consola
  repite «two children with the same key».

Top 10 riesgos de pérdida con la nueva UI (destino en §3 «Paridad»):
1. Exportar, guardar al lado del proyecto, deshacer, duplicar y eliminar → `BarraPestana` y `AccionesFila`.
2. Informe consolidado (preflight, siembra, gate) → la pestaña Láminas debe funcionar con `reportScope=consolidated`.
3. Planes sugeridos y sincronizar equivalencias (el mazo de acrconta nace ahí) → «Armar desde…».
4. MultiApiladasBuilder, filtros por gráfico, nombres por base, textos base/pie/subtítulo/`introduccion_word` → envueltos
   en `DatosGrafico` y `SeccionContenido`.
5. `auto_otros_slides` (ya costó una entrega) → Vista general.
6. Args con efecto nativo escondidos en el «Estilo global» que se va: `formato`, `sufijo_auto`, `nota_redondeo`, la
   matriz de Cálculos por familia y las paletas por lista. El corte se hace arg por arg contra el inventario Parte B.
7. Rendimiento: render sólo de la lámina activa, cola cancelable, caché por hash, miniaturas SVG (`ComposicionLamina`)
   para la Estructura y la tira; nunca render masivo al montar. Investigar por qué la vista previa va por `artifact-tool`.
8. Migración de estructura e índice: derivar capítulos de los `p_slide_seccion` sin reescribir datos; no perder un
   índice editado a mano.
9. Validación y cobertura con contador visible en la barra de Láminas.
10. 1024×600 y scroll (C4): desborde de la barra a menú, un solo dueño de scroll por columna, lienzo ≥ 380 px.

Otros: accesibilidad de ranuras sobre imagen rasterizada y conflicto de ←/→ con inputs (`isEditable`); vacíos (C3);
proyecto sin plan con «Armar desde…»; verificar que el editor no se monte en modo público.

## 8. Guías del visor por capas (pedido de Gonzalo, 2026-10-10)

Textual: «a las guías les faltan más cosas o poder filtrar, o agregar; se pueden agregar los espacios de cada sección o se
puede mostrar el tamaño de la letra de cada elemento». D17: las guías ya no se hornean en el entregable (533c19935).

Diseño: las guías dejan de ser marcas dibujadas por ggplot dentro de la imagen y pasan a ser una **capa del visor**,
encima de la lámina, que funciona igual para láminas nativas y de ruta anterior:

- **Backend (contrato nuevo K11)**: la vista previa devuelve, por parte, las formas de la lámina leídas del XML del PPTX:
  nombre (`prosecnur:*`, ranura), rol (gráfico, texto, cifra, título, pie, ícono), caja x/y/w/h en pulgadas y cm,
  tamaño de letra en pt (mínimo y máximo de sus párrafos) y si el texto está recortado; y las ranuras del estándar del
  tipo (`/api/graficos/estandar`) para comparar contra el recetario.
- **Frontend**: botón «Guías» en la barra del visor con capas activables y combinables:
  1. **Cajas** de cada elemento, con su nombre al pasar el mouse;
  2. **Espacios**: separaciones entre secciones y márgenes a los bordes, con su medida en cm;
  3. **Tipografía**: el tamaño en pt de cada texto, en rojo si se aparta del recetario;
  4. **Medidas**: ancho y alto de cada caja;
  5. **Recetario**: las ranuras del estándar superpuestas, para ver desvíos;
  y un filtro por rol (sólo gráficos, sólo textos…). Estado de las capas en el store del editor, no en la config del
  proyecto.
- Rebanada: después de F6.1b; requiere K11.
