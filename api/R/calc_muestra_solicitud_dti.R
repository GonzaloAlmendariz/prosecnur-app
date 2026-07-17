# Exportador de la solicitud de datos a la DTI (asesoría muestral 2026-07-15).
#
# La oficina de datos de la universidad (DTI) recibe un workbook con la
# ESTRUCTURA esperada de las bases (una hoja por base: curso-horario,
# estudiantes, docentes) y los criterios de entrega en bullets. La FUENTE DE
# VERDAD de la lista de variables vive en el frontend
# (features/calcMuestra/universidad/shared/constants.ts): aquí NO se duplica
# la lista, solo se valida la forma del payload y se renderiza el XLSX.
#
# Estética: tema monocromo editorial compartido de los entregables XLSX
# (api/R/xlsx_theme.R) — mismo lenguaje visual que el workbook de selección de
# aulas, sin inventar tema nuevo.
#
# Errores API: E_CALC_MUESTRA_DTI_INPUT (400, payload sin variables válidas) y
# E_CALC_MUESTRA_DTI_EXPORT (500, fallo de render del workbook).

# Hojas canónicas de la solicitud, en el orden del flujo real de la DTI.
.cm_dti_hojas <- c("Cursos-horario", "Estudiantes", "Docentes")

# Bullets FIJOS de la entrega: lecciones del caso real (tipo de curso llegó
# agrupado, condición/nivel ausentes, estudiantes sin código deduplicable).
# Van SIEMPRE, antes de las notas del payload.
.cm_dti_bullets_fijos <- function() {
  c(
    "Entregar el TIPO DE CURSO desagregado (teórico-teórico, teórico-práctico, teórico-laboratorio, taller, laboratorio, seminario) — NO agrupar",
    "Condición del curso (obligatorio/electivo/especialidad) por curso-horario",
    "Nivel curricular Y nivel por créditos como columnas separadas",
    "Código de estudiante (para deduplicar)"
  )
}

# Bucket de hoja por el campo `hoja` del payload: se clasifica por text_key
# (tolerante a "Docentes", "docente", "hoja_docentes"...); lo no reconocido
# cae a la hoja de curso-horario (la base madre de la solicitud).
.cm_dti_bucket_hoja <- function(hoja) {
  key <- .cm_aulas_text_key(hoja)
  if (grepl("docente", key, fixed = TRUE)) return("Docentes")
  if (grepl("estudiante", key, fixed = TRUE) || grepl("alumno", key, fixed = TRUE)) {
    return("Estudiantes")
  }
  "Cursos-horario"
}

# Normaliza la lista de variables del payload a registros
# {campo, descripcion, requerida, hoja} descartando entradas ilegibles (sin
# label ni rol). Devuelve list() si nada sobrevive: el caller decide el error.
.cm_dti_normalize_variables <- function(variables) {
  if (is.null(variables) || !is.list(variables) || !length(variables)) return(list())
  out <- list()
  for (v in variables) {
    if (!is.list(v)) next
    campo <- .cm_aulas_scalar(v$label, "")
    if (!nzchar(campo)) campo <- .cm_aulas_scalar(v$rol, "")
    if (!nzchar(campo)) next
    out[[length(out) + 1L]] <- list(
      campo = campo,
      descripcion = .cm_aulas_scalar(v$descripcion, ""),
      requerida = .cm_aulas_bool(v$requerida, FALSE),
      hoja = .cm_dti_bucket_hoja(.cm_aulas_scalar(v$hoja, ""))
    )
  }
  out
}

# Tabla Campo | Qué se espera | Requerida de una hoja (df posiblemente vacío).
.cm_dti_tabla_hoja <- function(vars, hoja) {
  en_hoja <- Filter(function(v) identical(v$hoja, hoja), vars)
  data.frame(
    `Campo` = vapply(en_hoja, function(v) v$campo, character(1)),
    `Qué se espera` = vapply(en_hoja, function(v) v$descripcion, character(1)),
    `Requerida` = vapply(en_hoja, function(v) if (isTRUE(v$requerida)) "Sí" else "Opcional", character(1)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

# Escribe una hoja de estructura (título + tabla con el tema monocromo).
.cm_dti_escribir_hoja <- function(wb, hoja, tabla, estilos) {
  pulso_xlsx_new_sheet(wb, hoja)
  openxlsx::writeData(wb, hoja, sprintf("Solicitud de datos — %s", hoja), startCol = 1, startRow = 1)
  openxlsx::addStyle(wb, hoja, estilos$titulo, rows = 1, cols = 1)
  header_row <- 3L
  openxlsx::writeData(wb, hoja, tabla, startCol = 1, startRow = header_row)
  openxlsx::addStyle(wb, hoja, estilos$header, rows = header_row, cols = 1:3, gridExpand = TRUE, stack = TRUE)
  if (nrow(tabla)) {
    filas <- (header_row + 1L):(header_row + nrow(tabla))
    openxlsx::addStyle(wb, hoja, estilos$cuerpo, rows = filas, cols = 1:3, gridExpand = TRUE, stack = TRUE)
  } else {
    # Hoja sin campos pedidos: nota explícita (mejor que una tabla muda).
    openxlsx::writeData(wb, hoja, "— Sin campos solicitados en esta hoja —", startCol = 1, startRow = header_row + 1L)
    openxlsx::addStyle(wb, hoja, estilos$nota, rows = header_row + 1L, cols = 1)
  }
  pulso_xlsx_box(wb, hoja, header_row, header_row + max(nrow(tabla), 1L), 1L, 3L)
  openxlsx::setColWidths(wb, hoja, cols = 1:3, widths = c(32, 64, 12))
  invisible(NULL)
}

# Hoja de criterios: una fila por bullet (fijos primero, luego notas del
# payload).
.cm_dti_escribir_bullets <- function(wb, bullets, estilos) {
  hoja <- "Criterios (bullets)"
  pulso_xlsx_new_sheet(wb, hoja)
  openxlsx::writeData(wb, hoja, "Criterios de la entrega", startCol = 1, startRow = 1)
  openxlsx::addStyle(wb, hoja, estilos$titulo, rows = 1, cols = 1)
  tabla <- data.frame(`Criterio` = bullets, stringsAsFactors = FALSE, check.names = FALSE)
  header_row <- 3L
  openxlsx::writeData(wb, hoja, tabla, startCol = 1, startRow = header_row)
  openxlsx::addStyle(wb, hoja, estilos$header, rows = header_row, cols = 1, gridExpand = TRUE, stack = TRUE)
  filas <- (header_row + 1L):(header_row + nrow(tabla))
  openxlsx::addStyle(wb, hoja, estilos$cuerpo, rows = filas, cols = 1, gridExpand = TRUE, stack = TRUE)
  pulso_xlsx_box(wb, hoja, header_row, header_row + nrow(tabla), 1L, 1L)
  openxlsx::setColWidths(wb, hoja, cols = 1, widths = 120)
  invisible(NULL)
}

# Estilos mínimos derivados de la paleta compartida (sin duplicar literales
# de color por módulo).
.cm_dti_estilos <- function() {
  pal <- pulso_xlsx_palette()
  ft <- pulso_xlsx_font()
  list(
    titulo = openxlsx::createStyle(fontName = ft, fontSize = 13, textDecoration = "bold",
                                   fontColour = pal$ink),
    header = openxlsx::createStyle(fontName = ft, fontSize = 10, textDecoration = "bold",
                                   fontColour = pal$ink, halign = "left", valign = "center",
                                   border = "bottom", borderStyle = "thin",
                                   borderColour = pal$rule_strong),
    cuerpo = openxlsx::createStyle(fontName = ft, fontSize = 10, fontColour = pal$ink,
                                   halign = "left", valign = "top", wrapText = TRUE),
    nota = openxlsx::createStyle(fontName = ft, fontSize = 9, textDecoration = "italic",
                                 fontColour = pal$ink_soft)
  )
}

# Genera el workbook de la solicitud DTI en `path`. Valida el payload con
# stop_api (rutas alcanzables por la API): sin variables válidas no hay
# solicitud que armar.
calc_muestra_solicitud_dti_workbook <- function(payload, path) {
  if (!is.list(payload)) payload <- list()
  vars <- .cm_dti_normalize_variables(payload$variables)
  if (!length(vars)) {
    stop_api(400, "E_CALC_MUESTRA_DTI_INPUT",
             "La solicitud DTI necesita al menos una variable con label o rol (payload$variables).")
  }
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop_api(500, "E_CALC_MUESTRA_DTI_EXPORT",
             "El paquete R 'openxlsx' no está instalado para generar la solicitud DTI.")
  }
  notas <- .cm_aulas_chr_vec(payload$notas)
  bullets <- c(.cm_dti_bullets_fijos(), notas)
  tryCatch({
    estilos <- .cm_dti_estilos()
    wb <- openxlsx::createWorkbook()
    for (hoja in .cm_dti_hojas) {
      .cm_dti_escribir_hoja(wb, hoja, .cm_dti_tabla_hoja(vars, hoja), estilos)
    }
    .cm_dti_escribir_bullets(wb, bullets, estilos)
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  }, error = function(e) {
    # Un fallo de render (disco, openxlsx) no debe filtrarse como E_INTERNAL
    # sin contexto: se re-etiqueta con el código propio del exportador. Si ya
    # es un api_error (p.ej. validación anidada), se propaga tal cual.
    if (inherits(e, "api_error")) stop(e)
    stop_api(500, "E_CALC_MUESTRA_DTI_EXPORT",
             sprintf("No se pudo generar la solicitud DTI: %s", conditionMessage(e)))
  })
  invisible(path)
}
