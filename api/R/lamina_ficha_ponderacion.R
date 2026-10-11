# =============================================================================
# lamina_ficha_ponderacion.R — la ficha técnica declara la ponderación (contrato base-sin-ponderar F6, S2/S4, D-b, D-c)
# =============================================================================
#
# Con S2 el sello por lámina se apagó: la base de cada lámina es casos sin ponderar y la ponderación se declara UNA vez,
# en la ficha técnica, con su n efectivo (S4, `reporte_ponderacion_sello()`). La ficha del Word ya trae su fila
# «Ponderación» (`reporte_ficha_tecnica.R`); la del PPT es la tabla que el analista escribe en el plan, así que aquí se
# le agrega la fila cuando la corrida trae información de ponderación y la tabla no la declara. El texto del usuario
# manda: si su tabla ya tiene una fila «Ponderación», queda intacta.
#
# Un entregable ponderado que no lo declara en ninguna parte (ni ficha ni «Cómo leer») da advertencia al exportar (D-b,
# `graficos_avisos_ponderacion_mazo()` en graficos_verificar_mazo.R y `.word_avisos_ponderacion()` en
# reporte_word_avisos_ponderacion.R). Sin ponderación configurada nada cambia: ni fila ni aviso.

#' Las fuentes de una corrida como lista nombrada de data frames (una base suelta es `default`)
#' @keywords internal
.lam_pond_fuentes <- function(data) {
  if (is.data.frame(data)) return(list(default = data))
  if (!is.list(data) || !length(data)) return(list())
  data[vapply(data, is.data.frame, logical(1))]
}

#' Estados de ponderación de la corrida que dicen algo (aplicada o configurada y no aplicada), por fuente
#' @keywords internal
.lam_pond_estados_con_info <- function(data_sources) {
  estados <- tryCatch(.reporte_plan_pond_estados(.lam_pond_fuentes(data_sources)), error = function(e) list())
  Filter(function(e) is.list(e) && length(e) && as.character(e$status %||% "")[1] %in% c("aplicada", "no_aplicada"), estados)
}

#' ¿La corrida está ponderada? Alguna de sus bases aplicó pesos
#' @keywords internal
.lam_corrida_ponderada <- function(data_sources) {
  any(vapply(.lam_pond_estados_con_info(data_sources), function(e) identical(as.character(e$status)[1], "aplicada"), logical(1)))
}

#' ¿Una fila de la ficha es la de ponderación? («Ponderación», «Ponderacion», en mayúsculas o no)
#' @keywords internal
.lam_ficha_es_fila_ponderacion <- function(criterio) {
  x <- tolower(trimws(as.character(criterio)))
  x <- chartr("ó", "o", x)
  !is.na(x) & grepl("^ponderacion$", x)
}

#' Texto de la fila «Ponderación»: el sello S4 de la corrida; en multibase, uno por base («docentes: …; estudiantes: …»)
#' @keywords internal
.lam_ficha_texto_ponderacion <- function(data_sources) {
  con <- .lam_pond_estados_con_info(data_sources)
  if (!length(con)) return(NULL)
  textos <- vapply(con, reporte_ponderacion_sello, character(1))
  nms <- names(con) %||% rep("", length(con))
  if (length(con) == 1L || !all(nzchar(nms))) return(unname(textos[1]))
  paste(sprintf("%s: %s", nms, textos), collapse = "; ")
}

#' La tabla técnica del PPT con su fila «Ponderación» (enganche de `reporte_ppt_plan`, rama TECHNICAL_TABLE)
#'
#' @param table Tabla de la lámina (`slots$table`): la primera columna es el criterio y la segunda el detalle.
#' @param data_sources Fuentes de la corrida.
#' @return `table` con la fila «Ponderación» al final cuando la corrida trae ponderación y la tabla no la declara; si
#'   no, `table` tal cual (también si no es una tabla: la rama del motor valida y aborta como siempre).
#' @keywords internal
.lam_ficha_con_ponderacion <- function(table, data_sources) {
  if (!is.data.frame(table) || ncol(table) < 2L || !nrow(table)) return(table)
  if (any(.lam_ficha_es_fila_ponderacion(table[[1]]))) return(table)   # el texto del usuario manda
  texto <- .lam_ficha_texto_ponderacion(data_sources)
  if (is.null(texto) || !nzchar(texto)) return(table)
  for (j in seq_along(table)) if (is.factor(table[[j]])) table[[j]] <- as.character(table[[j]])
  fila <- table[1, , drop = FALSE]
  for (j in seq_along(fila)) fila[[j]] <- if (is.character(table[[j]])) "" else NA
  fila[[1]] <- "Ponderación"
  fila[[2]] <- texto
  out <- rbind(table, fila)
  rownames(out) <- NULL
  out
}

#' ¿Una tabla técnica declara la ponderación? (tiene la fila «Ponderación»)
#' @keywords internal
.lam_ficha_declara_ponderacion <- function(table) {
  is.data.frame(table) && ncol(table) >= 2L && any(.lam_ficha_es_fila_ponderacion(table[[1]]))
}

#' D-c: la ponderación configurada que no se aplicó deja de ir en cada pie y sube a advertencia de la corrida
#' @return Un texto por base en fallback (con su nombre en multibase); vacío si no hay.
#' @keywords internal
.lam_ponderacion_avisos_fallback <- function(data_sources) {
  fallback <- tryCatch(.reporte_plan_pond_avisos_corrida(.lam_pond_fuentes(data_sources)), error = function(e) character(0))
  if (!length(fallback)) return(character(0))
  sprintf("%s: los porcentajes de esta base salen sin el peso del estudio.", fallback)
}

#' D-b: el entregable está ponderado y no lo declara en ninguna parte
#' @param entregable «PPT» o «Word», para decir dónde se declara.
#' @keywords internal
.lam_ponderacion_aviso_sin_declarar <- function(entregable = c("PPT", "Word")) {
  entregable <- match.arg(entregable)
  donde <- if (identical(entregable, "PPT")) "Agrega una lámina de ficha técnica: su fila «Ponderación» lo dice con el n efectivo."
           else "Enciende «Cómo leer este informe» o agrega la ficha técnica: cualquiera de las dos lo declara."
  paste("El informe está ponderado y no lo declara: los porcentajes van ponderados y las bases son casos sin ponderar,",
        "y el lector no tiene cómo saberlo.", donde)
}

#' Advertencias de export de ponderación (D-b, D-c) de una corrida
#'
#' @param data_sources Fuentes de la corrida.
#' @param declarada ¿El entregable declara la ponderación (ficha técnica o «Cómo leer»)?
#' @param entregable «PPT» o «Word».
#' @return Vector de textos para `.pulso_aviso()`; vacío sin ponderación configurada.
#' @keywords internal
.lam_ponderacion_avisos <- function(data_sources, declarada, entregable = c("PPT", "Word")) {
  c(.lam_ponderacion_avisos_fallback(data_sources),
    if (.lam_corrida_ponderada(data_sources) && !isTRUE(declarada)) .lam_ponderacion_aviso_sin_declarar(entregable))
}
