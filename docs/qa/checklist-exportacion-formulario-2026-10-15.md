# Checklist — exportación del formulario a PDF y Word (motor + diálogo)

Tipo: Checklist de lote
Estado: En curso
Fecha: 2026-10-15
Autoridad: Evidencia de QA; las decisiones B1/B2/B5 las delegó Gonzalo el 2026-10-15 («toma todas las decisiones por mí»)

**Origen:** revisión del estado del motor de formulario en papel y del diálogo
«Configurar PDF» del editor XLSForm (2026-10-15). Continúa
`goal-formulario-replica-ser-adolescente-2026-09-24.md` y
`checklist-motor-formulario-papel-2026-09-24.md`.

## Decisiones (delegadas por Gonzalo)

| | Decisión | Por qué |
|---|---|---|
| **B1** | **Word respeta `columns`.** `1` → una columna (como hoy); `2` → tramos por ancho: las corridas de bloques `full_width` (portada, bandas, matrices anchas) van a una columna y el resto a dos, lo mismo que hace el PDF; `auto` → sin cambio | El diálogo trae «Dos columnas» por defecto y el `.docx` salía a una sin avisar: elegir una cosa y recibir otra es peor que cambiar la forma de los exports futuros. Los `.docx` ya exportados no cambian: son archivos |
| **B2** | **`n_questions` = números de pregunta de primer nivel que imprime el instrumento.** Las notas no cuentan; una matriz con tenor cuenta 1 (sus filas son X.1, X.2…); una matriz sin tenor cuenta sus filas. Se conserva el nombre del campo | Ningún consumidor del frontend lo lee; el grano nuevo es el que un aplicador reconoce («P1…PN»). Renombrar no aporta nada |
| **B5** | **Opción (b): sin leyenda; la esquina conserva el enunciado entero.** L18 se cierra como descartada | La leyenda existía para cuando la cabecera no podía rotular todas las categorías, y desde `2b027c6d2` la cabecera las rotula siempre (baja el cuerpo, parte la palabra o rota el rótulo). Un campo `rotulo` nuevo en `matrix_groups` sería contrato público para un caso que ya no ocurre |

## Los ítems

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | Word honra `columns = 2` (B1) | `reporte_formulario_word.R` | **cerrado** — tramos por ancho con `columns = 2`; render LibreOffice: ops_salud 34→27 págs, hsvg2026 18→14, acnur_pdm 9→8, sin derrames |
| 2 | `n_questions` con grano declarado (B2) | `reporte_formulario_pdf.R` (summary del modelo) + tests | **cerrado** — `.form_pdf_numeros_impresos()`; ops_salud 317→349, hsvg2026 109→118, acnur_pdm 65→54 |
| 3 | L18 cerrada como descartada (B5) | GOAL doc | **cerrado** — L18, B1, B2 y B5 anotadas en el GOAL |
| 4 | El título impreso sale de `form_title` y sólo cae al nombre del archivo si no hay | `router_xlsform_editor.R` | **cerrado** — `options$title` → `form_title` → nombre del archivo |
| 5 | Las dos rutas de exportación comparten un helper; un error no expone el mensaje crudo de R salvo que sea un `stop_api` del motor | `xlsform_editor_export.R` (nuevo) | **cerrado** — error con `error_id`, sin mensaje crudo |
| 6 | `paper_subgroup` y `paper_subletter` viajan del editor al motor sin perderse | router (columnas por defecto) + `types.ts` | **cerrado** — además `.xlsform_editor_empty_df` devolvía 0 columnas y nunca entregaba los encabezados por defecto |
| 7 | U2/U3: `paper_subgroup` y `paper_subletter` tienen campo en el inspector | `inspector/MoreTab.tsx`, `FocusedWorkspace.tsx` | **cerrado** — `canvas/PaperSettingsBlock.tsx`: «Ajustes de papel» plegable en toda fila de pregunta, nota, sección y repetición; verificado montado en un formulario sin `paper_*` hasta el payload. `MoreTab.tsx` queda como código muerto (su `ContextPanel` no se monta) |
| 8 | U4: el diálogo ofrece `max_options_per_question`, `no_default_intro` y `show_header_title` | `ConfigurarPdfDialog.tsx`, `pdfExportPreference.ts` | **cerrado** — sección «Contenido» + switch «Título en la cabecera»; payload verificado por el wire |
| 9 | La configuración del diálogo sobrevive a recargar y reabrir el proyecto (por proyecto + formulario; matrices por nombres de miembros, no por fila) | `pdfExportPreference.ts` + localStorage | **cerrado** — clave por hash de ruta + formulario; verificado tras `reload()` |
| 10 | El aviso de exportación dice la advertencia real, no «salto(s) o regla(s)» genérico; el estado ya no dice «plantilla impresa Pulso» | `XlsformEditorPage.tsx` | **cerrado** |
| 11 | Medir cuánto tarda exportar un instrumento largo; si pasa de ~5 s, pasar a job | medición | **medido → pasa a job (ítem 13)**: Word 62 s en ops_salud, 15 s en hsvg2026, 6 s en acnur_pdm; PDF 10 / 5 / 2 s |
| 12 | **`.docx` grandes salen corruptos**: `.docx_conformar_parte()` usa `substring(txt, corte)`, que corta en el carácter 1 000 000. Afecta a todo consumidor de `.docx_conformar` | `docx_conformar.R` | **cerrado** — `substring(txt, corte, nchar(txt))`; test con document.xml de 1,5M caracteres que falla con el código viejo; 15 suites consumidoras en verde |
| 13 | Exportar formulario como job (`callr`) con progreso | `xlsform_editor_export.R` + `onExportForm` | **cerrado** — las rutas devuelven `job_id`; la respuesta de antes llega en `result_data` de `GET /api/jobs/<id>` (no en `/result`, que es descarga); el editor muestra la fase («Exportando Word… Dibujando»), verificado por el wire con PDF y Word. Pendiente verificar el camino de producción con el paquete instalado (corte de release) |

**Fuera de este lote, con su motivo:** L21 (reserva de más en `integer`/`paper`; acotada por el techo 1.35 del contrato de L19), L15 en el PDF (énfasis declarado exclusivo de Word), §17 (ancho útil por sección; latente). La sobrescritura del entregable en el proyecto se conserva: un formulario tiene un único impreso vigente.
