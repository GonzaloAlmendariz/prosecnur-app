# =============================================================================
# Catálogo de entregables (ADR 0133 §2)
# =============================================================================
# Una fila por `kind` registrado en el file store: el rótulo (en palabras, con
# tildes; el nombre de archivo lo translitera), la carpeta de módulo del §4, si
# el nombre lleva la base (`por_base`) y si se copia junto al proyecto
# (`guardar`). Un kind literal que se pase al registro sin fila aquí es un error
# de contrato que vigila test-entregables-catalogo.R; en ejecución cae al rótulo
# derivado del kind y no se guarda.
#
# `guardar = FALSE`: vistas previas y miniaturas, assets de estilo, manifiestos,
# evidencias e intercambio (naturaleza distinta de «entregable» en el censo de
# descargas 2026-11-07) y, de forma transitoria (ADR 0133, Consecuencias), los
# kinds cuyos flujos del front ya guardan a mano en la raíz del proyecto: el
# export del Editor XLSForm y los ZIP de Correos con «Junto al proyecto».
#
# Regla del lead (2026-11-07): sólo se copia lo que el usuario pidió descargar.
# Hasta la fase 5 van con guardar = FALSE los archivos que se registran sin que
# la UI los ofrezca o que ya viajan dentro de otro entregable: el XLSForm de
# ocurrencias (lo registra «Subir Kobo»), los tres de la limpieza (base limpia,
# revisión HTML y decisiones) y los dos archivos que contiene el ZIP del handoff.

.ENTREGABLES_MODULOS <- c(
  cm = "Cálculo de muestra", fo = "Formularios", hr = "Hojas de ruta", mc = "Material de campo",
  mo = "Monitoreo", pr = "Procesamiento", da = "Dashboard", py = "Proyecto"
)

# kind | rótulo | módulo (clave de .ENTREGABLES_MODULOS) | por_base | guardar
.ENTREGABLES_FILAS <- c(
  # Cálculo de muestra
  "calc_muestra_general_sorteo|Sorteo de muestra|cm|0|1",
  "calc_muestra_aulas_seleccion|Selección de aulas|cm|0|1",
  "calc_muestra_solicitud_dti|Solicitud DTI|cm|0|1",
  # Formularios (el flujo del Editor guarda a mano: transitorio)
  "formulario_pdf|Cuestionario|fo|0|0",
  "formulario_word|Cuestionario|fo|0|0",
  # Hojas de ruta
  "hojas_ruta_population_matrix|Matriz poblacional|hr|0|1",
  "hojas_ruta_random_pdf|Hoja de ruta de prueba|hr|0|0",
  "hojas_ruta_reemplazos_puntuales|Reemplazos puntuales|hr|0|1",
  "hojas_ruta_operativo|Libro operativo de rutas|hr|0|1",
  "hojas_ruta_zip|Hojas de ruta|hr|0|1",
  "hojas_ruta_ficha_ump|Ficha de reemplazo UMP|hr|0|0",
  # Material de campo
  "hojas_ruta_hoja_dia|Hoja del día|mc|0|1",
  "asignacion_encuestadores|Asignación de encuestadores|mc|0|1",
  "plantilla_barrido|Plantilla de barrido|mc|0|1",
  "supervision_base|Base de supervisión|mc|0|1",
  "aulas_disponibilidad_plantilla|Plantilla de disponibilidad de aplicadores|mc|0|1",
  "aulas_asignacion_plantilla|Plantilla de asignación de aplicadores|mc|0|1",
  "aulas_libro_plantilla|Plantilla del libro de aulas|mc|0|1",
  "material_ruteo|Hoja de ruteo|mc|0|1",
  "material_consolidados|Hoja de consolidados|mc|0|1",
  "material_conteo|Hoja de conteo|mc|0|1",
  "mail_revision|Correos para revisar|mc|0|1",
  "mail_textos|Textos de los correos|mc|0|1",
  "collection_mail_zip|Correo para Mailchimp|mc|0|0",
  "collection_mail_template_zip|Plantilla de correo para Mailchimp|mc|0|0",
  "collection_mail_sm_zip|Correo para SurveyMonkey|mc|0|0",
  "collection_mail_manifest|Correo para Mailchimp manifiesto|mc|0|0",
  "collection_material_png|Vista previa de fichas|mc|0|0",
  "collection_material_pdf|Fichas con QR|mc|0|1",
  "collection_material_bundle|Fichas con QR|mc|0|1",
  # Monitoreo
  "aulas_libro|Libro de aulas|mo|0|1",
  "monitoreo_reporte|Reporte de monitoreo|mo|0|1",
  "monitoreo_ump_export|UMP faltantes|mo|0|1",
  "monitoreo_processing_handoff_data|Data procesable|mo|0|0",
  "monitoreo_processing_handoff_xlsform|XLSForm procesable|mo|0|0",
  "monitoreo_processing_handoff_zip|Entrega a procesamiento|mo|0|1",
  "monitoreo_ocurrencias_xlsform|XLSForm de ocurrencias|mo|0|0",
  "monitoreo_territorial_operational_package_template|Paquete operativo plantilla|mo|0|0",
  "monitoreo_territorial_operational_package_review_csv|Paquete operativo revisión|mo|0|0",
  "monitoreo_territorial_operational_package_review_json|Paquete operativo revisión|mo|0|0",
  "monitoreo_territorial_operational_package_review_md|Paquete operativo revisión|mo|0|0",
  "monitoreo_publication_evidence_pack|Evidencia para el cliente|mo|0|0",
  "monitoreo_publication_operational_package_request_csv|Evidencia para el cliente solicitud|mo|0|0",
  "monitoreo_publication_operational_package_request_json|Evidencia para el cliente solicitud|mo|0|0",
  "monitoreo_publication_operational_package_status|Evidencia para el cliente estado|mo|0|0",
  "monitoreo_publication_decision|Decisión de publicación|mo|0|0",
  # Procesamiento: carga y validación
  "data_normalizada|Base normalizada|pr|1|1",
  "validacion_report_html|Reporte de validación|pr|1|1",
  "plan_limpieza_export|Plan de limpieza|pr|1|1",
  "validacion_limpieza_base_limpia|Base limpia|pr|1|0",
  "validacion_limpieza_html|Revisión de limpieza|pr|1|0",
  "validacion_limpieza_excel|Decisiones de limpieza|pr|1|0",
  # Procesamiento: codificación
  "familias_template|Plantilla de familias|pr|0|1",
  "plantilla_codif_template|Plantilla de codificación|pr|0|1",
  "data_adaptada|Data adaptada|pr|0|1",
  "instrumento_adaptado|Instrumento adaptado|pr|0|1",
  "codificacion_matriz_work|Matriz de codificación de trabajo|pr|0|1",
  "codificacion_matriz_internal|Matriz de codificación interna|pr|0|1",
  "codificacion_matriz_client|Matriz de codificación para el cliente|pr|0|1",
  # Procesamiento: analítica
  "codebook|Libro de códigos|pr|1|1",
  "codebook_pdf|Libro de códigos|pr|1|1",
  "codebook_zip|Libros de códigos Excel por base|pr|0|1",
  "codebook_pdf_zip|Libros de códigos PDF por base|pr|0|1",
  "xlsform_final|XLSForm final|pr|1|1",
  "xlsform_final_zip|XLSForm final por base|pr|0|1",
  "frecuencias|Frecuencias|pr|1|1",
  "frecuencias_zip|Frecuencias por base|pr|0|1",
  "cruces|Cruces|pr|1|1",
  "cruces_zip|Cruces por base|pr|0|1",
  "bases_csv|Datos|pr|1|1",
  "bases_csv_zip|Datos CSV por base|pr|0|1",
  "bases_xlsx|Datos|pr|1|1",
  "bases_xlsx_zip|Datos Excel por base|pr|0|1",
  "bases_sav|Datos|pr|1|1",
  "bases_sav_bundle|Datos SPSS por base|pr|0|1",
  "spss_bundle|Datos SPSS con sintaxis|pr|1|1",
  "bases_xlsx_relacional|Base relacional|pr|0|1",
  "bases_unificadas|Bases unificadas|pr|0|1",
  "bases_script_r|Script de replicación|pr|1|1",
  "bases_script_r_zip|Script de replicación|pr|1|1",
  "bases_data|Data|pr|1|1",
  "bases_data_codificada|Data codificada|pr|1|1",
  "bases_instrumento|Instrumento|pr|1|1",
  "bases_instrumento_codificado|Instrumento codificado|pr|1|1",
  "bases_data_zip|Data por base|pr|0|1",
  "bases_data_codificada_zip|Data codificada por base|pr|0|1",
  "bases_instrumento_zip|Instrumentos por base|pr|0|1",
  "bases_instrumento_codificado_zip|Instrumentos codificados por base|pr|0|1",
  "enumeradores|Reporte de enumeradores|pr|1|1",
  "enumeradores_zip|Reporte de enumeradores por base|pr|0|1",
  "base_panel|Base panel|pr|0|1",
  "base_panel_wide|Base panel ancha|pr|0|1",
  "base_panel_sav|Base panel|pr|0|1",
  "base_panel_sav_bundle|Base panel SPSS con sintaxis|pr|0|1",
  "base_panel_libro_codigos|Base panel libro de códigos|pr|0|1",
  "base_panel_frecuencias|Base panel frecuencias|pr|0|1",
  "base_panel_cruces|Base panel cruces|pr|0|1",
  "base_panel_auditoria|Base panel auditoría|pr|0|1",
  "ficha_tecnica|Ficha técnica|pr|0|1",
  "ficha_tecnica_panel|Ficha técnica del panel|pr|0|1",
  "tablas_multibase|Tablas multibase|pr|0|1",
  "comparativo_simple|Comparativo de frecuencias|pr|0|1",
  "comparativo_simple_manifest|Comparativo de frecuencias manifiesto|pr|0|0",
  "comparativo_cruces|Comparativo de cruces|pr|0|1",
  "comparativo_cruces_manifest|Comparativo de cruces manifiesto|pr|0|0",
  # Procesamiento: gráficos
  "reporte_ppt|Informe|pr|1|1",
  "reporte_word|Informe|pr|1|1",
  "graficos_ppt_zip|Informe por base|pr|0|1",
  "graficos_ppt_consolidado|Informe consolidado|pr|0|1",
  "graficos_ppt_consolidado_manifest|Informe consolidado manifiesto|pr|0|0",
  "graficos_share|Plan de gráficos|pr|0|0",
  "graficos_preview|Vista previa de lámina|pr|0|0",
  "graficos_miniatura|Miniatura de lámina|pr|0|0",
  "graficos_logo|Logo del cliente|pr|0|0",
  "graficos_icon|Ícono de gráficos|pr|0|0",
  # Proyecto
  "plan_trabajo_xlsx|Plan de trabajo|py|0|1",
  "audit_project_analitica_csv|Auditoría de analítica|py|0|0",
  "audit_project_analitica_sav|Auditoría de analítica|py|0|0",
  "audit_project_processing_xlsx|Auditoría de procesamiento|py|0|0",
  "audit_project_validation_html|Auditoría de validación|py|0|0",
  "audit_project_processing_evidence_pack|Auditoría evidencia de procesamiento|py|0|0",
  "audit_project_client_evidence_pack|Auditoría evidencia para el cliente|py|0|0",
  "audit_project_internal_evidence_pack|Auditoría evidencia interna|py|0|0",
  "audit_project_deliverables_manifest|Auditoría manifiesto de entregables|py|0|0"
)

# Rótulos de `.export_filename()` que no son un kind: el mismo entregable con otra
# palabra (alias → kind) o un archivo que se entrega sin pasar por el file store
# (rótulo y por_base propios).
.ENTREGABLES_ALIAS <- c(
  calc_muestra_sorteo = "calc_muestra_general_sorteo",
  solicitud_dti = "calc_muestra_solicitud_dti",
  libro_aulas = "aulas_libro",
  disponibilidad_aplicadores_PLANTILLA = "aulas_disponibilidad_plantilla",
  asignacion_aplicadores_PLANTILLA = "aulas_asignacion_plantilla",
  libro_aulas_PLANTILLA = "aulas_libro_plantilla",
  informe_consolidado = "graficos_ppt_consolidado",
  base_relacional = "bases_xlsx_relacional",
  plan_trabajo = "plan_trabajo_xlsx",
  reporte_ppt_todas_bases = "graficos_ppt_zip",
  replicar_base = "bases_script_r",
  fichas_recopiladores = "collection_material_pdf",
  preview_material = "collection_material_png"
)

.ENTREGABLES_SUELTOS <- c(
  "avance_territorial_monitoreo|Avance territorial|0",
  "avance_telefonico_monitoreo|Avance telefónico|0",
  "avance_aulas_monitoreo|Avance de aulas|0",
  "reporte_cliente_monitoreo|Reporte de avance para el cliente|0",
  "produccion_responsable_monitoreo|Producción por responsable|0",
  "metodologia_validacion|Metodología de validación|1",
  "base_datos|Base de datos del dashboard|0"
)

.entregables_cache <- new.env(parent = emptyenv())

.entregables_partir <- function(filas) {
  partes <- strsplit(filas, "|", fixed = TRUE)
  lapply(seq_len(max(lengths(partes))), function(i) vapply(partes, `[`, character(1), i))
}

#' El catálogo de entregables: un data.frame con kind, rotulo, modulo, por_base y guardar
#' @keywords internal
entregables_catalogo <- function() {
  if (is.null(.entregables_cache$catalogo)) {
    p <- .entregables_partir(.ENTREGABLES_FILAS)
    .entregables_cache$catalogo <- data.frame(
      kind = p[[1]], rotulo = p[[2]], modulo = unname(.ENTREGABLES_MODULOS[p[[3]]]),
      por_base = p[[4]] == "1", guardar = p[[5]] == "1", stringsAsFactors = FALSE
    )
  }
  .entregables_cache$catalogo
}

# Rótulo legible de un kind sin fila: «kind_que_nadie_cataloga» → «Kind que nadie cataloga».
.entregable_rotulo_derivado <- function(kind) {
  x <- trimws(gsub("[_-]+", " ", as.character(kind %||% "")[1]))
  if (is.na(x) || !nzchar(x)) x <- "Archivo"
  paste0(toupper(substr(x, 1L, 1L)), substr(x, 2L, nchar(x)))
}

#' Fila del catálogo para un kind; sin fila, el rótulo derivado, módulo «Proyecto» y sin guardar
#' @keywords internal
.entregable_fila <- function(kind) {
  cat <- entregables_catalogo()
  i <- match(as.character(kind %||% "")[1], cat$kind)
  if (is.na(i)) {
    return(list(kind = kind, rotulo = .entregable_rotulo_derivado(kind), modulo = "Proyecto",
                por_base = TRUE, guardar = FALSE, catalogado = FALSE))
  }
  c(as.list(cat[i, , drop = FALSE]), list(catalogado = TRUE))
}

#' Rótulo y por_base del entregable que nombra un label de `.export_filename()`
#'
#' Orden: kind del catálogo, alias de un kind, archivo suelto conocido y, si no, el
#' label en palabras (que conserva la base si quien llama la pasó).
#' @keywords internal
.entregable_por_label <- function(label) {
  label <- as.character(label %||% "")[1]
  kind <- if (label %in% names(.ENTREGABLES_ALIAS)) .ENTREGABLES_ALIAS[[label]] else label
  fila <- .entregable_fila(kind)
  if (isTRUE(fila$catalogado)) return(list(rotulo = fila$rotulo, por_base = isTRUE(fila$por_base)))
  sueltos <- .entregables_partir(.ENTREGABLES_SUELTOS)
  j <- match(label, sueltos[[1]])
  if (!is.na(j)) return(list(rotulo = sueltos[[2]][j], por_base = sueltos[[3]][j] == "1"))
  list(rotulo = fila$rotulo, por_base = TRUE)
}
