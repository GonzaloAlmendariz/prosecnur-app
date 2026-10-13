# **Lo que `/aplicar` no aplicó, dicho con su motivo.** ADR 0100, pieza P1.
#
# `.bridge_grupos_to_plantilla()` (router_codificacion.R) devuelve `$patched` y
# `$skipped`, y hasta el 2026-10-13 nadie leía el segundo: el handler de
# `/aplicar` lo llamaba sin capturar el resultado. Medido sobre una copia de
# HSyVBG 2026: quitando `P66_otro` de la base, P66 caía en `$skipped`, no se
# creaba `P66_recod` y su catálogo entero (13 códigos, 25 casos) dejaba de
# aplicarse sin que la respuesta ni la pantalla lo dijeran. P29_10, con un
# catálogo de texto que no le corresponde, se omitía igual.
#
# El motivo NO lo devuelve el puente, sólo el nombre. Se reconstruye aquí desde
# las mismas entradas con que el puente decide (fila de familias, tipo, modo y
# columnas presentes), en el mismo orden de sus ramas. Una omisión cuyo motivo
# no se reconoce se declara `no_se_pudo_aplicar`: mejor eso que inventar uno.
#
# Y el segundo silencio: un texto que no está en ningún grupo se queda en 88
# (P4 «Hombre» → `P4_recod` 88). Eso no es una omisión de pregunta sino de
# respuesta, y se cuenta aparte en `textos_sin_codigo`.

.CODIF_OMITIDA_MOTIVOS <- c(
  sin_grupos = "La pregunta tiene catálogo vacío.",
  sin_fila = "La pregunta no figura en las familias del instrumento vigente.",
  sin_modo = "Es de opción única y no se declaró si el texto se integra a la variable original o va en una variable aparte.",
  sin_columna_texto = "La columna de texto «%s» no está en la base.",
  sin_columna_padre = "La variable «%s» no está en la base.",
  tipo_no_soportado = "Codificación no aplica este tipo de pregunta (%s).",
  sin_variable_madre = "La agrupación no se aplica: la variable madre «%s» no está en la base.",
  no_se_pudo_aplicar = "El catálogo no se pudo volcar a la plantilla."
)

.codif_omitida_texto <- function(motivo, detalle = "") {
  plantilla <- .CODIF_OMITIDA_MOTIVOS[[motivo]] %||% .CODIF_OMITIDA_MOTIVOS[["no_se_pudo_aplicar"]]
  if (grepl("%s", plantilla, fixed = TRUE)) sprintf(plantilla, detalle) else plantilla
}

#' Motivo por el que el puente omitió cada pregunta del catálogo.
#'
#' @param skipped `$skipped` de `.bridge_grupos_to_plantilla()`.
#' @param grupos_map `grupos_recod` de la base.
#' @param rows filas de `familias_draft`.
#' @param data_cols nombres de columna de la base que se aplicó.
#' @return lista de `list(pregunta, motivo, mensaje)`, una por omitida.
#' @keywords internal
.codif_omitidas <- function(skipped, grupos_map, rows, data_cols) {
  skipped <- unique(as.character(skipped %||% character(0)))
  skipped <- skipped[nzchar(skipped)]
  if (!length(skipped)) return(list())
  data_cols <- as.character(data_cols %||% character(0))
  indexes <- .codif_group_row_indexes(rows %||% list())
  lapply(skipped, function(k) {
    grupos <- (grupos_map %||% list())[[k]]
    row <- .codif_group_owner_row(k, indexes)
    motivo <- "no_se_pudo_aplicar"
    detalle <- ""
    if (!length(grupos)) {
      motivo <- "sin_grupos"
    } else if (is.null(row)) {
      motivo <- "sin_fila"
    } else {
      tipo <- as.character(row$tipo %||% "")
      modo_so <- as.character(row$modo_so %||% "")
      text_col <- as.character(row$text_col %||% "")
      parent_col <- as.character(row$parent_col %||% "")
      parent <- as.character(row$parent %||% k)
      pc <- if (nzchar(parent_col)) parent_col else parent
      necesita_texto <- tipo %in% c("select_multiple") ||
        (identical(tipo, "select_one") && identical(modo_so, "hijo"))
      if (!tipo %in% c("text", "select_one", "select_multiple", "integer")) {
        motivo <- "tipo_no_soportado"; detalle <- if (nzchar(tipo)) tipo else "sin tipo"
      } else if (identical(tipo, "select_one") && !modo_so %in% c("padre", "hijo")) {
        motivo <- "sin_modo"
      } else if (necesita_texto && !nzchar(text_col)) {
        motivo <- "sin_columna_texto"; detalle <- "(sin declarar)"
      } else if (nzchar(text_col) && !text_col %in% data_cols) {
        motivo <- "sin_columna_texto"; detalle <- text_col
      } else if (identical(tipo, "text") && !nzchar(text_col) && !parent %in% data_cols) {
        motivo <- "sin_columna_texto"; detalle <- parent
      } else if (!identical(tipo, "text") && !pc %in% data_cols) {
        motivo <- "sin_columna_padre"; detalle <- pc
      }
    }
    list(pregunta = k, motivo = motivo, mensaje = .codif_omitida_texto(motivo, detalle))
  })
}

#' Textos de la base que no están en ningún grupo de su pregunta.
#'
#' Se comparan con `.normalize_text()`, la misma normalización con que
#' Codificación agrupa, así que «No sé» y «no se» son el mismo texto. Sólo se
#' miden preguntas que sí se aplicaron (`patched`): las omitidas ya se declaran
#' enteras en `.codif_omitidas()`.
#'
#' @param patched `$patched` de `.bridge_grupos_to_plantilla()`.
#' @param grupos_map,rows como en `.codif_omitidas()`.
#' @param data_df la base que se aplicó.
#' @param max_ejemplos cuántos textos de muestra por pregunta.
#' @return lista de `list(pregunta, columna, casos, textos, ejemplos)`, sólo las
#'   preguntas con al menos un texto sin código.
#' @keywords internal
.codif_textos_sin_codigo <- function(patched, grupos_map, rows, data_df, max_ejemplos = 5L) {
  patched <- unique(as.character(patched %||% character(0)))
  if (!length(patched) || !is.data.frame(data_df) || !nrow(data_df)) return(list())
  indexes <- .codif_group_row_indexes(rows %||% list())
  out <- list()
  for (k in patched) {
    row <- .codif_group_owner_row(k, indexes)
    if (is.null(row)) next
    tipo <- as.character(row$tipo %||% "")
    if (identical(tipo, "integer")) next
    text_col <- as.character(row$text_col %||% "")
    col <- if (nzchar(text_col)) text_col else if (identical(tipo, "text")) as.character(row$parent %||% k) else ""
    if (!nzchar(col) || !col %in% names(data_df)) next
    valores <- as.character(data_df[[col]])
    valores <- valores[!is.na(valores) & nzchar(trimws(valores))]
    if (!length(valores)) next
    respuestas <- unlist(lapply((grupos_map %||% list())[[k]] %||% list(), function(g) unlist(g$respuestas)))
    codificados <- unique(.normalize_text(as.character(respuestas %||% character(0))))
    norm <- .normalize_text(valores)
    sueltos <- !norm %in% codificados
    if (!any(sueltos)) next
    unicos <- unique(trimws(valores[sueltos]))
    out[[length(out) + 1L]] <- list(
      pregunta = k,
      columna = col,
      casos = as.integer(sum(sueltos)),
      textos = as.integer(length(unique(norm[sueltos]))),
      ejemplos = as.list(utils::head(unicos, max_ejemplos))
    )
  }
  out
}

#' Agrupaciones que no se aplicarán porque su variable madre no está en la base.
#'
#' Las agrupaciones («Agrupar categorías», `codificacion_agrupar.R`) no pasan
#' por `.bridge_grupos_to_plantilla()`: se aplican en `ppra_adaptar_data()`.
#' Guardarlas exige que la madre exista, pero una base recargada después (el
#' script en R que quitó una variable, ADR 0100) puede dejarla sin madre, y
#' entonces la variable nueva no se crea. Se declara igual que una omitida del
#' catálogo, para que `/aplicar` publique una sola lista.
#'
#' @param specs salida de `codif_agrupaciones_para_aplicar()`.
#' @param data_cols nombres de columna de la base que se aplicó.
#' @return lista de `list(pregunta, motivo, mensaje, variable_nueva)`.
#' @keywords internal
.codif_agrupaciones_omitidas <- function(specs, data_cols) {
  data_cols <- as.character(data_cols %||% character(0))
  out <- list()
  for (sp in (specs %||% list())) {
    parent <- as.character(sp$parent %||% "")[1]
    if (is.na(parent) || !nzchar(parent) || parent %in% data_cols) next
    out[[length(out) + 1L]] <- list(
      pregunta = parent,
      motivo = "sin_variable_madre",
      mensaje = .codif_omitida_texto("sin_variable_madre", parent),
      variable_nueva = as.character(sp$target %||% "")[1]
    )
  }
  out
}
