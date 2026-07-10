---
name: entregables-oficina
description: Motores de entregables de oficina de Prosecnur - PPT (DSL de slides), Word y XLSX con estética Pulso, contrato de artefactos y su ejecución como jobs. Usar al tocar reporte_plan_ppt/slides/word, construir_plantilla_ppt, graficador_ppt, xlsx_theme, o al crear/modificar cualquier export PPT/Word/XLSX. Para PDF usar prosecnur-pdf-engine.
---

# Entregables de oficina (PPT / Word / XLSX)

El PDF tiene su propio sistema (skill global `prosecnur-pdf-engine`). Esta capa cubre lo demás.

## PPT — el motor principal

- **DSL de slides** en `reporte_plan_slides.R`: `p_plan(...)` + constructores `p_slide_portada`, `p_slide_indice`, `p_slide_seccion`, `p_slide_texto`, `p_slide_tabla_tecnica`, `p_slide_top_two_box`, `p_slide_objetivo_icono`, `p_slide_1_grafico`… Los planes llegan también como JSON y se normalizan (`.normalize_plan`/`.validar_plan_json` en `router_graficos.R`).
- **Entrada del render**: `reporte_ppt_plan(...)` en `reporte_plan_ppt.R` (9.6k líneas, **congelado a crecimiento** — helpers nuevos van a `reporte_plan_helpers.R`, `reporte_ppt_cruces_helpers.R` o archivo nuevo).
- **Validación previa**: `.validate_plan()` + `.collect_diapo_objects()` + `.ppt_contract_with_semantic_labels()` SIEMPRE antes de renderizar.
- **OOXML crudo** solo en `construir_plantilla_ppt.R` (clonado de layouts/masters de la plantilla); en ningún otro lugar se manipula XML a mano.
- Gráfico embebido: `graficar_ppt()`; registro de graficadores vía `.graf_names()`.

## Word

`reporte_plan_word.R` → `reporte_word_plan(...)`. Reusa los presets de gráfico de PPT (merge `.apply_word_chart_presets` / `.word_chart_presets_merge_defaults`) — si cambias un preset PPT, revisa el efecto en Word.

## XLSX

Capa estética en `xlsx_theme.R` (⚠️ superficie NUEVA): `pulso_xlsx_styles(context = "freq"|"cruces"|"codebook")`, `pulso_xlsx_new_sheet()`, `pulso_xlsx_box()`, `pulso_xlsx_hide_gridlines()`, `pulso_xlsx_ignore_number_warnings(path)` (silencia el warning "número como texto" de Excel). Tipografía fija Arial. Todo estilo XLSX nuevo se canaliza por aquí, no con `openxlsx::createStyle` suelto por módulo. Excel de codificación: `codificacion_config_excel.R`.

## Contrato de artefactos

Toda salida es un **artefacto registrado**: `file_id` (UUID en el file store vía `save_upload`/`.register_output_file` de `io.R`) + `sha256` + exactamente **un** artefacto con `role="manifest"` por entrega. El contrato se verifica con `expect_report_artifacts_registered(result, slug)` (`test-audit-projects.R:398`) sobre `audit_project_deliverables()`. Los evidence packs client/internal exigen `manifest.json`, `generated.xlsx`, `report.json` (client además `generated.pdf` + sentinel). Nunca generes entregables "sueltos" fuera del registro.

## Ejecución como job

PPT/Word corren como jobs (`kind="graficos.ppt_all"`, etc.) → aplican TODAS las reglas del skill `jobs-asincronos`: resolver funciones del paquete dinámicamente dentro del closure (`get(nm, envir=asNamespace("prosecnurapp"))`), no recargar el paquete, no tocar la config de locale.

## Reglas de la casa

1. Slides por DSL, validadas antes de renderizar; OOXML a mano solo en `construir_plantilla_ppt.R`.
2. Multibase = envolver con `run_report_multibase` (ZIP si >1 base), no duplicar el motor.
3. Artefactos siempre registrados (file_id + sha256 + manifest único).
4. Render nuevo sin test completo mínimo exige contrato de artefactos o golden.
5. Recuerda la audiencia: PDFs/PPTs de avance para cliente llevan meta/cuotas/ritmo/perfil, sin detalle interno; codebook/formulario priorizan la estructura visual.
