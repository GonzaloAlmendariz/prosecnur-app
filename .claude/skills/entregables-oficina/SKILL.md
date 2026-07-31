---
name: entregables-oficina
description: Motores de entregables de Prosecnur - PDF, PPT, Word, XLSX, SAV, HTML, gráficos, interactivos y cronogramas; estética Pulso, contrato de artefactos, jobs y verificación estructural/visual. Usar al crear o modificar cualquier export o render.
---

# Entregables de Prosecnur

Este skill es la autoridad local para PDF, PPT, Word, XLSX, SAV, HTML,
gráficos, interactivos y cronogramas exportables. El formato cambia; el
contrato de entrada, audiencia, artefacto y evidencia no.

## Antes de implementar

1. Declara audiencia (`client` o `internal`), grano, denominadores, idioma,
   formato y si la salida es single-base o multibase.
2. Ubica el motor local que ya posee ese formato; extiéndelo sin crear otra
   capa estética o un segundo contrato de artefactos.
3. Congela estructura mínima verificable: hojas/slides/páginas/secciones,
   nombres de archivo, manifest, hash y conducta ante datos vacíos.
4. Si renderiza archivos o tarda más de unos segundos, aplica
   `jobs-asincronos`.

## PPT — el motor principal

- El DSL vive en `api/R/reporte_plan_slides.R`: `p_plan(...)` y constructores
  `p_slide_*`. Los planes JSON se normalizan y validan antes del render.
- `reporte_ppt_plan(...)` vive en `api/R/reporte_plan_ppt.R`, archivo
  congelado a crecimiento por `agentic/manifest.json`. Helpers nuevos van a
  `reporte_plan_helpers.R`, `reporte_ppt_cruces_helpers.R` o archivo propio.
- Ejecuta `.validate_plan()`, `.collect_diapo_objects()` y
  `.ppt_contract_with_semantic_labels()` antes de renderizar.
- OOXML crudo solo en `api/R/construir_plantilla_ppt.R`, dueño de
  layouts/masters. Los gráficos embebidos pasan por `graficar_ppt()` y el
  registro de graficadores.

## Word

`api/R/reporte_plan_word.R` expone `reporte_word_plan(...)` y comparte presets
de gráfico con PPT. Un cambio de preset se valida en ambos formatos. Formularios
Word viven en `api/R/reporte_formulario_word.R`.

## PDF

- La familia visual compartida vive en `api/R/pulso_pdf_theme.R`: tokens,
  tipografía, geometría, cabecera, pie, logo y calibración de ancho. El layout
  de contenido sigue perteneciendo a cada motor.
- Motores actuales incluyen `reporte_codebook_pdf.R`,
  `reporte_formulario_pdf.R`, `monitoreo_telefonico_report_pdf.R` y los PDF de
  Hojas de ruta. Reutiliza el theme; no abras otra paleta local.
- Toda entrada se convierte primero en un modelo puro que pueda testearse sin
  dibujar. Después renderiza con tamaño y orientación explícitos.
- Verificación mínima: archivo no vacío, conteo de páginas razonable, texto o
  estructura esperada y render visual de páginas representativas. Cabecera,
  pie, logo, cortes, desbordes y páginas vacías se inspeccionan de verdad.

## XLSX, SAV y HTML

- La capa XLSX común vive en `api/R/xlsx_theme.R`. Usa
  `pulso_xlsx_styles()`, `pulso_xlsx_new_sheet()`, `pulso_xlsx_box()` y los
  helpers compartidos; no disperses `openxlsx::createStyle` por motores.
- El Excel de codificación pertenece a `api/R/codificacion_config_excel.R`;
  los operativos de campo, a sus motores de Hojas de ruta.
- SAV conserva códigos, labels, missing values y linaje de revisión; rutas
  relevantes están en `carga_acreditacion_sav.R` y
  `surveymonkey_sav_bundle.R`.
- HTML debe ser autocontenido cuando el contrato lo exige, escapar texto de
  usuario y preservar tablas/gráficos accesibles. La validación HTML vive en
  `api/R/validacion_report_html.R`.

## Contrato de artefactos

Toda salida descargable es un artefacto registrado mediante
`.register_output_file()` de `api/R/io.R`:

- `file_id`, nombre público, tamaño y `sha256`;
- exactamente un artefacto con `role = "manifest"` por entrega compuesta;
- roles diferenciados para deliverable, evidencia y manifest;
- archivos temporales fuera del estado persistido del `.pulso`.

Los evidence packs de auditoría y publicación agregan sus sentinels y
`report.json` según audiencia. `api/tests/testthat/test-audit-projects.R`
contiene el patrón `expect_report_artifacts_registered()`. No devuelvas un path
local como si fuera un artefacto.

## Ejecución como job

PPT, Word, PDF costoso, ZIP y exports voluminosos corren como jobs con `kind`
scopeado al módulo. El closure aplica las reglas de `jobs-asincronos`: payload
grande por RDS, namespace resuelto en el worker, progreso, cancelación,
resultado registrado y error de dominio estructurado.

## Cronograma, Gantt y export Excel

El cronograma es parte de Bitácora, no una utilidad aislada:

- `api/R/bitacora_cronograma.R` posee edición, dependencias, ciclos y vista por
  fases; `api/R/bitacora_fases.R` ancla cada fase a un módulo real.
- `api/R/router_plan_trabajo.R` conserva import/export Excel y compatibilidad
  con cronogramas anteriores; `.plan_export_xlsx()` registra la salida.
- `frontend/src/features/bitacora/CronogramaSection.tsx` ofrece compositor de
  fases, lectura Gantt y lista. La fase elegida por el usuario manda sobre la
  heurística textual.

Al cambiar import/export, conserva IDs, dependencias, fase manual, fechas,
hitos, responsables, ventanas sincronizables y round-trip. Valida engine,
XLSX resultante y vista Gantt con un plan no trivial.

## Gráficos e interactivos

Los `graficador_*.R`, `graficos_*.R` e `interactivo_*.R` comparten paleta,
metadatos, denominadores y tratamiento de valores especiales. Un gráfico no
aprueba solo porque abre: revisa escala, leyenda, etiquetas, orden, contraste,
datos vacíos y consistencia con la tabla fuente. Un interactivo además debe
abrir sin red cuando su contrato sea local.

## Checklist de cierre

1. Input, audiencia, grano y denominador declarados.
2. Multibase resuelto con `run_report_multibase()`, no con motor duplicado.
3. Artefactos registrados con hash y manifest único.
4. Test estructural del formato y contrato de artefactos en verde.
5. Render visual real de una muestra representativa sin cortes ni vacíos
   accidentales.
6. Contenido de cliente sin detalle interno; contenido interno sin secretos.
7. Job, progreso, cancelación y error verificados cuando aplica.
