# A0 — Inventario de cierre del Editor anterior de Gráficos frente a Láminas

Tipo: Inventario (solo lectura) · Estado: Vigente · Fecha: 2026-10-11 · Meta A, unidad A0
Fuente: lectura del código en `c97eb3a` (agente Explore, sin escribir). Encargo: `encargo-loop-f6-2026-10-10.md`.

## Advertencia de partida

Las «43 capacidades» del plan de integración (`plan-integracion-f6-2026-10-10.md:225`) **no están versionadas**: quedaron
en el scratchpad local del auditor-ui. Tampoco está el texto de los riesgos de paridad 1–22 (`plan:146-149` solo trae
números y destino). Este inventario se reconstruyó desde el código del Editor anterior (`GraficosHeader.tsx`,
`GraficosPage.tsx`, `v2/**`, `EstiloGlobalDialog.tsx`, `InspectorV2.tsx`, `ArgField.tsx`, atajos): **55 capacidades
(C1–C55)**, más los 10 riesgos de §7 (R1–R10) y los «Otros» de §7 (O1–O5). La lista es más larga que 43 porque separa las
8 pestañas del Estilo global y lo que es de página. Si aparece el informe del auditor-ui, se cruza fila por fila.

Rutas relativas a `frontend/src/features/graficos/`. Leyenda: ☑ existe en Láminas · ◐ parcial · ☐ falta.

| # | Capacidad / riesgo | Editor anterior | Estado en Láminas (evidencia) | Destino |
|---|---|---|---|---|
| C1 | Estado del plan / guardado | `GraficosHeader.tsx:758,1104` | ☑ `laminas/BarraLaminas.tsx:70` | A10 retirar badge |
| C2 | Chip «Informe compartido» | `GraficosHeader.tsx:763` | ◐ solo chip multibase; `isSharedReport` solo en Exportar | A7 |
| C3 | Chip de modo multibase | `GraficosHeader.tsx:766,1084` | ☑ `BarraLaminas.tsx:51,61-67` | — |
| C4 | Vista Timeline/Canvas + densidad | `GraficosHeader.tsx:1193-1270`, `v2/shell/ModeToolbar.tsx` | ☐ a propósito | retirar (Estructura + Vista general) |
| C5 | Deshacer/rehacer | `GraficosHeader.tsx:1438-1470` | ☑ `BarraLaminas.tsx:75-84,133-138` | — |
| C6 | Salud/validación del plan | `GraficosHeader.tsx:777` | ☑ `BarraLaminas.tsx:85-94`, `laminas/PanelAvisos.tsx` | A10 retirar badge |
| C7 | Cobertura del plan | `GraficosHeader.tsx:778` | ☑ `BarraLaminas.tsx:95` | A5 (por base) |
| C8 | Plan sugerido + equivalencias | `SuggestedPlanButton.tsx:105,217` | ☑ reuso `BarraLaminas.tsx:96` | A5 «Armar desde…» |
| C9 | Guías de edición | `GraficosHeader.tsx:787,1276-1430` | ◐ DebugPhToggle viejo como «Guías (beta)» `laminas/VisorLamina.tsx:22,158-160` | A3 |
| C10 | Diálogo «Estilo global» (8 pestañas) | `v2/shell/EstiloGlobalDialog.tsx:25-90` | ☐ ⋯ manda al Editor anterior `BarraLaminas.tsx:139-142` | A6 (C48–C55) |
| C11 | Plan portátil .zip | `GraficosHeader.tsx:624-684,844-947` | ☐ ⋯ manda al Editor anterior | ⛔ sin unidad: A1 o A9 |
| C12 | Exportar/importar JSON por secciones | `GraficosHeader.tsx:40-53,686-742,949-1035` | ☐ igual | ⛔ sin unidad: A1 o A9 |
| C13 | Exportar PPT/Word + guardar al lado | `ExportarInformeMenu.tsx:81` | ☑ `BarraLaminas.tsx:97` | — |
| C14 | Vaciar plan | `GraficosHeader.tsx:744-747,1054-1063` | ☐ | A1 (ítem del ⋯) |
| C15 | Bloqueo sin base preparada | `GraficosPage.tsx:285-289` | ☑ + `VisorLamina.tsx:268-273` | — |
| C16 | Informe consolidado | `GraficosPage.tsx:132-186,291-330` | ◐ `usePreviewLamina.ts:57`, `LaminasWorkbench.tsx:136`; `/ppt-all` sin verificar | A7 |
| C17 | Job de exportación y avisos | `GraficosPage.tsx:363-424` | ☑ compartido | — |
| C18 | Aviso de equivalencias desfasadas | `GraficosPage.tsx:88-94,390` | ☑ compartido | — |
| C19 | Selector de base | `GraficosPage.tsx:433-437` | ☑ compartido | — |
| C20 | Atajos globales | `useGraficosShortcuts.ts` | ☑ | — |
| C21 | Atajos V2 (J/K, Alt+↑↓, «/», V/T, 1–4) | `v2/shortcuts/useShortcutsV2.ts:25-77` | ◐ «/» busca un id que no existe en Láminas; V/T y 1–4 tocan estado del clásico | A1 + A10 |
| C22 | Modal de atajos «?» | `ShortcutsModal.tsx:11-37` | ◐ lista atajos del clásico | A1 |
| C23 | Resumen del plan | `TimelinePanelV2.tsx:124-150` | ☑ `EstructuraInforme.tsx:70`, `BarraLaminas.tsx:68` | — |
| C24 | Búsqueda por título o tipo | `TimelinePanelV2.tsx:175` | ☑ `EstructuraInforme.tsx:91-103` | — |
| C25 | Filtro por categoría | `v2/timeline/categoryOf.ts` | ☐ | ⛔ A5 o retirar |
| C26 | Reordenar arrastrando | `SlideCard.tsx:40,84` | ◐ solo subir/bajar `AccionesLamina.tsx:31-38` | A5 |
| C27 | Duplicar/eliminar | `SlideCard.tsx:157,165` | ☑ `AccionesLamina.tsx:27-42`, toast Deshacer | — |
| C28 | Marcas de error por lámina | `SlideCard.tsx:92` | ☑ `EstructuraInforme.tsx:215-227` | — |
| C29 | Glifos de gráficos por tarjeta | `SlideCard.tsx:125-131` | ◐ solo «N de M con gráfico» | A5 |
| C30 | Miniaturas de maqueta | `v2/canvas/PlanNodeCard.tsx:63-65` | ◐ `TiraMiniaturas.tsx` solo láminas vistas | A4 (K7) + A5 |
| C31 | Multiselección y acciones en bloque | `v2/canvas/PlanCanvas.tsx` | ☐ | A5 |
| C32 | Primer slide con plan vacío | `PlanCanvas.tsx:456,526`, `InspectorV2.tsx:103` | ◐ el vacío remite al Editor anterior `LaminasWorkbench.tsx:219-231` | A1 + A5 |
| C33 | Insertar desde la biblioteca | `v2/timeline/SlidePicker.tsx` | ☑ `LaminasWorkbench.tsx:107-123` | A2 |
| C34 | Cabecera del inspector | `InspectorV2.tsx:140-160` | ☑ `InspectorLamina.tsx:58-73` | — |
| C35 | Título automático desde la variable | `InspectorV2.tsx:136` | ☐ `InspectorLamina.tsx:160` | A1 |
| C36 | Textos de la lámina | `InspectorV2.tsx:232` | ☑ `InspectorLamina.tsx:155-163` | — |
| C37 | Editor del índice | `IndiceBuilder.tsx` | ☐ `InspectorLamina.tsx:32,125` | A5 |
| C38 | Args con editor propio (ficha, íconos, variables, códigos) | `ArgField.tsx:328,364,413,445` | ☐ `contenidoLamina.ts:29-31` | A1 / A5 / A2 |
| C39 | Elegir el gráfico de una ranura | `GraficadorPicker.tsx` | ☑ `InspectorLamina.tsx:270-279`, `RanurasSobreLamina.tsx` | A2 |
| C40 | Datos del gráfico (todos los args) | `InspectorV2.tsx:245` | ◐ lista blanca `argsDatosGrafico.ts:15-37` | A2 (+ A9 D9) |
| C41 | Top/Bottom Two Box | `Top2BoxSelector.tsx` | ◐ solo multiapiladas `InspectorLamina.tsx:300-306` | A2 |
| C42 | MultiApiladasBuilder | `GraficadorSlot.tsx:214` | ☑ `EditorAmplio.tsx:47-49` | — |
| C43 | Filtros por gráfico | `InspectorV2.tsx:267` | ☑ `DatosGrafico.tsx:74-81` | — |
| C44 | Nombres por base y «Base del gráfico» | `ArgField.tsx:398,457`, `BaseLabelsField.tsx` | ☐ `argsDatosGrafico.ts:40-48` | A2 |
| C45 | Paleta / colores por categoría | `ArgField.tsx:388,401,433` | ☐ | A2 + A6 |
| C46 | Estilo por gráfico (ggplot) | `v2/inspector/StylePanel.tsx` | ☐ a propósito | retirar (la salida nativa no lo lee) |
| C47 | «Ver lámina» + maqueta | `SlidePreview.tsx` | ☑ visor real `VisorLamina.tsx:91-228` | A10 retirar |
| C48 | Estilo › Base PPT | `PresetsEditor.tsx:399` | ☐ | retirar salvo `formato`, `sufijo_auto`, `nota_redondeo` → A6 |
| C49 | Estilo › Base Word | `WordPresetsEditor.tsx` | ☐ | A6 |
| C50 | Estilo › Cálculos | `CalculosEditor.tsx` | ☐ | A6 |
| C51 | Estilo › Color e identidad | `PaletasEditor.tsx` | ☐ | A6 |
| C52 | Estilo › Líneas visuales | `PptStyleProfilesPanel.tsx` | ☐ | A6 + A9 (ACNUR) |
| C53 | Estilo › Íconos propios | `IconosEditor.tsx` | ☐ | A5 + A6 (K6) |
| C54 | Estilo › Estilos guardados | `OverridesEditor.tsx` | ☐ | ⛔ retirar (ggplot) — confirmar |
| C55 | Estilo › «Otros» automáticos | `ContenidoEditor.tsx:14-25` | ☐ | A5 |
| R1 | Exportar, guardar, deshacer, duplicar, eliminar | C5, C13, C27 | ☑ | — |
| R2 | Informe consolidado | C16 | ◐ | A7 |
| R3 | Planes sugeridos y equivalencias | C8 | ☑ | A5 |
| R4 | Multiapiladas, filtros, nombres por base, textos | C36, C42–C44 | ◐ faltan nombres por base y `base_config` | A2 |
| R5 | `auto_otros_slides` | C55 | ☐ | A5 |
| R6 | Args nativos del «Estilo global» | C48, C50, C51 | ☐ | A6 |
| R7 | Rendimiento | `SlidePreview.tsx` | ◐ render de la activa, cola y caché ☑; miniaturas SVG, caché backend, `artifact-tool` ☐ | A4 |
| R8 | Migración de estructura e índice | `IndiceBuilder.tsx` | ◐ `modeloEstructura.ts:83-131`; índice manual no editable (C37) | A5 |
| R9 | Validación y cobertura en la barra | C6, C7 | ☑ | — |
| R10 | 1024×600 y scroll | `GraficosHeader.tsx:750` | ◐ rechazo frontend-3 a 1024 → corregido en A1 (2026-10-11) | A1 |
| O1 | Accesibilidad de ranuras | — | ☑ `RanurasSobreLamina.tsx:19-37` | A3 |
| O2 | ←/→ chocando con inputs | `useShortcutsV2` | ☑ `VisorLamina.tsx:83` | — |
| O3 | Vacíos dentro de su caja (C3) | — | ◐ remiten al Editor anterior | A1 |
| O4 | Sin plan con «Armar desde…» | — | ◐ CTA del vacío al Editor anterior | A1 / A5 |
| O5 | El editor no se monta en modo público | — | ☐ sin guarda visible en `GraficosPage.tsx` | A10 (verificar) |

## Dudas abiertas

1. Las 43 del auditor-ui y el texto de los riesgos de paridad 1–22 no están versionados; A10 necesita el texto real o
   adopta esta lista como la de paridad (decisión de Gonzalo).
2. Args nativos sin control en Láminas (`api/R/graficos_metadata.R`): `metodo_redondeo`, `mostrar_ceros`,
   `invertir_barras`/`invertir_leyenda` (D9), `mostrar_barra_extra`, `barra_extra_preset`, `top2box_labels`,
   `bottom2box_labels`, `tipo_pie`, `mostrar_brecha`/`etiqueta_brecha`, `eje_min`, `mostrar_tabla`/`tabla_titulo`/
   `tabla_encabezados`, `cortes_chip`, `tipo_rango`, `top_n`, `limite_superior`, `scope`/`ubigeo`/`unit`/`coverage_mode`.
   Cada uno va a A2 o A8.
3. Retiros que confirma Gonzalo (A9): C54 Estilos guardados, C25 filtro por categoría, C11 plan portátil, C12 JSON por
   secciones (hoy solo los alcanza el Editor anterior; retirarlos sin superficie nueva los pierde), y `scope_rules` /
   «Vista de trabajo» (secciones del JSON sin editor visible).
4. `usePreviewLamina.ts:57-63` no pasa `slide_index`: el folio de la vista previa sigue sin verificar (§5.8).
5. `useShortcutsV2` sigue montado en Láminas (`GraficosPage.tsx:104`): V/T y 1–4 cambian estado invisible y «/» no hace
   nada; el modal «?» describe el editor viejo.
6. Sin medir en ejecución: consola «two children with the same key» y 17,4 s de «Ver lámina» por `artifact-tool`.
