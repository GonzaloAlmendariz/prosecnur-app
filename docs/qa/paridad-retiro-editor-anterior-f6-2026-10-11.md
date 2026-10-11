# Paridad para el retiro del Editor anterior (A10)

Tipo: Auditoría de paridad
Estado: En curso
Fecha: 2026-10-11
Autoridad: guardian-contratos sobre HEAD 194c102; lista de paridad adoptada por Gonzalo (decisión 10); lead de la Meta A

Vara (Gonzalo): «Láminas reemplaza al Editor anterior sin perder función». Lista: `inventario-cierre-a0-2026-10-11.md`.
Veredicto en 194c102: **A10 bloqueado** (✅ 40 · ◐ 13 · ☐ 13 · ⛔ 4); requiere ADR de retiro (0095) y confirmación de Gonzalo.

## Huecos (☐ ausente, ◐ parcial)

| # | Estado | Qué falta | Rebanada |
|---|---|---|---|
| C10 | ◐ | La pestaña Estilo sólo trae logos, letra y ámbito; el resto son C48–C55 | W-E |
| C11, C12 | ☐ (en curso) | Plan portátil y JSON por secciones al menú ⋯; las secciones del JSON no incluyen `estilo_cliente`, `documento_word`, `auto_otros_slides` y siguen ofreciendo «Guías de edición»/«Vista de trabajo» | en curso + decisión 3 |
| C14 | ☐ | Vaciar el plan sólo existe en `GraficosHeader.tsx:744-747` | W-C (menú ⋯) |
| C16, R2 | ◐ | Falta la corrida en vivo de `/ppt-all` y `/consolidado/ppt` sobre `independent_siblings` (decisión 19) | evidencia |
| C21, C22 | ◐ | J/K y Alt+↑/↓ sólo salen de `v2/shortcuts/useShortcutsV2.ts`; «/» no hace nada en Láminas; `ShortcutsModal` lista atajos del clásico | W-A |
| C32, O3 | ◐ | Textos que remiten al Editor anterior: `EstructuraInforme.tsx:108`, `InspectorLamina.tsx:183,290`; `BarraLaminas.tsx:158-161` dice que la pestaña Estilo «llega» (ya existe) | W-A (+ menú ⋯ en serie) |
| C35 | ☐ | El título por defecto no usa `inferSlideVariableTitle` | W-B |
| C38, C53 | ◐/☐ | `icono` de población/objetivo, `filas` de la ficha técnica; argumentos del índice que hoy se descartan en silencio (`redibujar_focos`, `mostrar_iconos_focos`, `iconos_focos_fill`, `iconos_focos_objeto_unico`); subir íconos (IconosEditor) | W-B + decisión 5 |
| C40 | ◐ | Argumentos fuera de la lista blanca de `argsDatosGrafico.ts` (`metodo_redondeo`, `mostrar_ceros`, `invertir_*`, `tipo_pie`, `mostrar_brecha`, `eje_min`, `mostrar_tabla`, `cortes_chip`, `top_n`, …) | decisión 4 |
| C44 | ☐ (en curso) | `base_labels`/`base_config` | en curso |
| C45 | ☐ | `colores_categorias`/`colores_series` sin control (el motor nativo los lee) | W-D (tras C44) |
| C48–C52, R6 | ☐ | Presets (`formato`, `sufijo_auto`, `nota_redondeo`), Base Word, Cálculos, Paletas, línea visual ACNUR: sólo en `EstiloGlobalDialog` | W-E + decisiones 1–2 |
| R7 | ◐ | Medir la latencia de la vista previa (`artifact-tool`) y la advertencia de claves duplicadas | evidencia |
| R10 | ◐ | Matriz de viewports de `laminas`, `vista-general`, `estilo` con `--require-geometry` | evidencia |

## Prerrequisitos del borrado (en serie, antes del ADR)

- `editor-v2.css` (congelado, ~33k líneas) estila componentes que Láminas usa (`ExportarInformeMenu`, `PlanCoverageBadge`,
  `SuggestedPlanButton`, `FiltersPanel`, `VariablePicker`, `MultiApiladasBuilder`, pill-button, popover): extraer esos
  selectores a CSS propio, quitar su entrada del manifest y actualizar `ModuleChrome.contract.test.ts` y
  `TabSemanticsAudit.contract.test.ts` (W-F).
- Reubicar `v2/inspector/FiltersPanel.tsx` (lo importa `laminas/EditorAmplio.tsx`), los helpers de `GraficadorPicker.tsx`
  (`SelectorTipoGrafico.tsx`, `GraficosLibrariesHost.tsx`), `getSlotLabel` de `GraficadorSlot.tsx`
  (`laminas/selectores/etiquetas.ts`) y `SlidePicker` de `GraficosLibrariesHost.tsx`.
- Migrar QA y contratos que nombran el editor viejo (`ui-quick-check-graficos-libraries-mounted.test.mjs`,
  `visual-catalog.test.mjs`, `graficosLibrariesDirection.contract.test.ts`, `pestanaGraficos.test.ts`, `lateralLaminas.test.ts`).
- Quitar `useShortcutsV2` de `GraficosPage.tsx` tras portar los atajos (coordinado con la Meta B).
- B-i (población antigua) en el backend, conservando `graficos_migrar_poblacion*.R` (compatibilidad de `.pulso` viejos).

## Decisiones de Gonzalo (28–33)

28. Dónde viven C48–C53 (presets, Word, cálculos, paletas, línea visual, íconos): una sección «Estilo del informe»
    habilitada también en el informe compartido (paletas/cálculos/línea visual cambian el PPT consolidado), o dentro de
    «Estilo del cliente» cambiando su regla de disponibilidad. Recomendado: pestaña/sección «Estilo del informe» propia.
29. C49 Base Word: envolver `WordPresetsEditor` tal cual (arrastra `ChartLayoutPopover`) o reducirlo a lo que decide el
    recetario con candado. ¿La pestaña `word` con `documento_word` es condición del retiro? Recomendado: reducir + candado;
    `documento_word` después del retiro.
30. Claves persistidas de superficies retiradas (`overrides_reusables`, `debug_ph`, `view_mode`, `inspector_tab`,
    `density`, `canvas_viewport`, `scope_rules`): recomendado dejarlas pasar opacas (sin borrar ni migrar) para que un
    `.pulso` viejo no quede modificado; y secciones del JSON: añadir `estilo_cliente`, `documento_word`,
    `auto_otros_slides` y quitar «Guías de edición»/«Vista de trabajo».
31. Argumentos de C40 sin control: retirar o asignar (lista arriba). Recomendado: revisar uno por uno con el revisor
    metodológico; retirar los que el motor nativo no usa.
32. Argumentos del índice que hoy desaparecen en silencio: exponerlos o fijarlos por el recetario con candado.
    Recomendado: candado visible con el valor del recetario.
33. B-i: en el mismo ADR del retiro o en uno propio (doble confirmación). Recomendado: ADR propio.

## Checklist de evidencia para el ADR 0095

- [ ] C1–C55, R1–R10, O1–O5 en ✅ o ⛔ con commit y archivo:línea; correspondencia riesgos 1–22 → A0.
- [ ] `rg 'Editor anterior|irPestana\("clasico"\)|onIrEditorAnterior|pestana=clasico|pulso-gv2-'` vacío fuera de historia/alias.
- [ ] Importadores de cada archivo a borrar vacíos; `tsc -b` limpio; `make gate-front AREA=graficos` y `--audit` verdes.
- [ ] Compatibilidad `.pulso`: 4 referencias + acrconta_mazo abren con `project_dirty=FALSE` y claves de la decisión 30.
- [ ] Ida y vuelta del plan portátil `.zip` (con logos) y del JSON desde el menú ⋯.
- [ ] PPT y Word desde Láminas iguales (por huella) a los del Editor anterior en acrconta, antes del borrado.
- [ ] Consolidado en vivo (`/ppt-all`, `/consolidado/ppt`) sobre `independent_siblings`.
- [ ] Matriz de viewports 1710/1440/1366/1280/1024 de laminas, vista-general y estilo; md5 distintos.
- [ ] Latencia de vista previa medida; sin advertencia de claves duplicadas.
- [ ] Modo público: Gráficos no se monta; `POST /graficos/estilo/logos` 403.
- [ ] revisor-metodologico sobre C40, C45 y base sin ponderar; B-i con doble confirmación; confirmación de Gonzalo y verificador.
