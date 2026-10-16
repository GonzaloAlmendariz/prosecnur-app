# **Los códigos que una variable de una base trae en su data.**
#
# Contrato de `GET /api/carga/codigos-observados?base=&variable=`: qué valores
# no vacíos tiene la variable, con la etiqueta que les da el instrumento de la
# base (o la etiqueta de valor del .sav) y su conteo SIN ponderar. Lo consume el
# editor que mapea códigos de origen a una escala (segmentos de cruce, ADR 0107)
# y cualquier panel que necesite ver la escala real de una base.
#
# Lectura: la memoizada de Analítica (`.analitica_read_pair`), la misma que se
# analiza. Trae las columnas propias y las calculadas del ADR 0106 ya
# materializadas (una `cruce_*` es una calculada), las columnas que la base trae
# y el instrumento no declara, y respeta el universo de caso válido de la base.
# Sólo lee: no cambia la base activa ni toca la sesión.
#
# Privacidad (mismo criterio que base_variables_detector.R): una variable de
# texto libre —tipo `text` del instrumento, o texto con más de un valor distinto
# por cada dos casos, o con algún valor largo— no devuelve valores. Excepción:
# una `text` cuyos valores son todos números y no supera ese umbral (la edad
# tecleada) sale `numerica` con sus códigos.

.CODIGOS_OBSERVADOS_TOPE <- 500L
.CODIGOS_OBSERVADOS_TIPOS_CATEGORICOS <- c("select_one", "select_multiple", "select_one_from_file",
                                           "select_multiple_from_file", "rank")
.CODIGOS_OBSERVADOS_TIPOS_NUMERICOS <- c("integer", "decimal", "range")
.CODIGOS_OBSERVADOS_TIPOS_TEXTO <- c("text", "date", "datetime", "time", "geopoint", "geotrace",
                                     "geoshape", "barcode", "image", "audio", "video", "file")

# Data e instrumento de la base en la lectura memoizada de Analítica.
.codigos_observados_lectura <- function(s, nombre) {
  meta <- s$estudio$bases[[nombre]]
  pair <- .analitica_pair_for_base(s, meta, "adaptados", nombre)
  if (is.null(pair)) {
    stop_api(409, "E_ANALITICA_SOURCE_MISSING",
             sprintf("No se pudo resolver el par XLSForm/Data para la base '%s'.", nombre))
  }
  parsed <- .analitica_read_pair(pair, meta)
  list(data = parsed$data, inst = parsed$inst)
}

# Fila del survey de la variable: tipo base y lista de opciones ("" si no está).
.codigos_observados_survey <- function(inst, variable) {
  sv <- (inst %||% list())$survey
  vacio <- list(tipo = "", list_name = "")
  if (!is.data.frame(sv) || !nrow(sv)) return(vacio)
  i <- match(variable, .dn_survey_names(sv))
  if (is.na(i)) return(vacio)
  ln <- if ("list_name" %in% names(sv)) as.character(sv$list_name[[i]]) else ""
  list(tipo = .dn_survey_type_base(sv)[[i]], list_name = if (is.na(ln)) "" else trimws(ln))
}

# Diccionario código -> etiqueta: el instrumento primero, la etiqueta de valor
# de la columna (.sav, o la que reporte_data adjuntó) después.
.codigos_observados_etiquetas <- function(inst, list_name, x) {
  out <- character(0)
  dicc <- ((inst %||% list())$dicc_code_to_label %||% list())[[list_name %||% ""]]
  if (nzchar(list_name %||% "") && length(dicc) && !is.null(names(dicc))) {
    out <- stats::setNames(as.character(unname(dicc)), names(dicc))
  }
  pares <- .bases_label_pairs(attr(x, "labels", exact = TRUE))
  if (nrow(pares)) {
    faltan <- !(pares$code %in% names(out))
    out <- c(out, stats::setNames(pares$label[faltan], pares$code[faltan]))
  }
  out
}

# Códigos por caso. Una opción múltiple se cuenta por opción (casos que la
# marcan), no por combinación.
.codigos_observados_por_caso <- function(x, tipo) {
  v <- .codif_agrupar_codigo_chr(x)
  if (!identical(tipo, "select_multiple")) return(as.list(v))
  lapply(v, function(z) if (is.na(z)) NA_character_ else unique(strsplit(z, "[[:space:]]+")[[1]]))
}

# ¿Todos los códigos observados son números finitos?
.codigos_observados_todos_numericos <- function(codigos) {
  length(codigos) > 0L && all(is.finite(suppressWarnings(as.numeric(codigos))))
}

# Umbral de texto libre de la propuesta de columnas propias: más de un valor
# distinto por cada dos casos, o algún valor largo.
.codigos_observados_supera_umbral_libre <- function(codigos, n_validos) {
  length(codigos) > 0.5 * n_validos ||
    any(nchar(codigos, type = "chars") > .BASE_VARIABLES_MAX_CHARS_OPCION)
}

# ¿Es texto libre? Mismo umbral que la propuesta de columnas propias.
.codigos_observados_es_texto_libre <- function(x, codigos, n_validos) {
  if (is.numeric(haven::zap_labels(x))) return(FALSE)
  if (!length(codigos)) return(FALSE)
  if (.codigos_observados_todos_numericos(codigos)) return(FALSE)
  .codigos_observados_supera_umbral_libre(codigos, n_validos)
}

# Una pregunta `text` que sólo trae números con repetición (la edad tecleada
# con constraint regex) es una escala numérica: el editor de segmentos necesita
# sus códigos para armar rangos. Un número casi único por caso (un id, un DNI)
# sigue siendo texto y no devuelve valores.
.codigos_observados_text_numerico <- function(codigos, n_validos) {
  .codigos_observados_todos_numericos(codigos) &&
    !.codigos_observados_supera_umbral_libre(codigos, n_validos)
}

.codigos_observados_tipo <- function(tipo_inst, x, codigos, n_validos, etiquetas) {
  if (identical(tipo_inst, "text") && .codigos_observados_text_numerico(codigos, n_validos)) {
    return("numerica")
  }
  if (tipo_inst %in% .CODIGOS_OBSERVADOS_TIPOS_TEXTO) return("texto")
  if (tipo_inst %in% .CODIGOS_OBSERVADOS_TIPOS_CATEGORICOS) return("categorica")
  if (tipo_inst %in% .CODIGOS_OBSERVADOS_TIPOS_NUMERICOS) return("numerica")
  # Sin tipo declarado (columna no declarada, calculate, metadato): se infiere.
  if (length(etiquetas)) return("categorica")
  if (.codigos_observados_es_texto_libre(x, codigos, n_validos)) return("texto")
  if (.codigos_observados_todos_numericos(codigos)) return("numerica")
  "categorica"
}

#' Códigos observados de una variable de una base.
#'
#' @param sid sesión.
#' @param base nombre de la base (obligatorio: no cae en la activa).
#' @param variable nombre de la variable en la data de la base.
#' @param tope máximo de códigos devueltos; por encima, `truncado = TRUE`.
#' @return `list(base, variable, tipo, codigos = [{codigo, etiqueta, n}],
#'   n_validos, n_sin_dato, truncado)`. Conteos sin ponderar.
#' @keywords internal
codigos_observados_consultar <- function(sid, base, variable, tope = .CODIGOS_OBSERVADOS_TOPE) {
  s <- session_get(sid)
  nombre <- .base_variables_base(s, base)
  variable <- .origen_externo_chr(variable)
  if (!nzchar(variable)) {
    stop_api(400, "E_BAD_REQUEST", "Indica la variable ('variable').")
  }
  lectura <- .codigos_observados_lectura(s, nombre)
  df <- lectura$data
  if (!is.data.frame(df) || !(variable %in% names(df))) {
    stop_api(404, "E_CODIGOS_VARIABLE_NOT_FOUND",
             sprintf("La base «%s» no tiene una variable «%s».", nombre, variable),
             list(base = nombre, variable = variable))
  }
  x <- df[[variable]]
  sv <- .codigos_observados_survey(lectura$inst, variable)
  por_caso <- .codigos_observados_por_caso(x, sv$tipo)
  con_dato <- vapply(por_caso, function(z) length(z) > 0L && !all(is.na(z)), logical(1))
  n_validos <- as.integer(sum(con_dato))
  todos <- unlist(por_caso[con_dato], use.names = FALSE)
  todos <- todos[!is.na(todos) & nzchar(todos)]
  conteo <- table(todos)
  codigos <- .equiv_armon_orden_codigos(names(conteo))
  etiquetas <- .codigos_observados_etiquetas(lectura$inst, sv$list_name, x)
  tipo <- .codigos_observados_tipo(sv$tipo, x, codigos, n_validos, etiquetas)
  if (identical(tipo, "texto")) codigos <- character(0)
  truncado <- length(codigos) > tope
  if (truncado) codigos <- codigos[seq_len(tope)]
  list(
    base = nombre,
    variable = variable,
    tipo = tipo,
    codigos = lapply(codigos, function(cod) list(
      codigo = cod,
      etiqueta = if (cod %in% names(etiquetas)) unname(etiquetas[[cod]]) else NULL,
      n = as.integer(conteo[[cod]])
    )),
    n_validos = n_validos,
    n_sin_dato = as.integer(nrow(df) - n_validos),
    truncado = truncado
  )
}
