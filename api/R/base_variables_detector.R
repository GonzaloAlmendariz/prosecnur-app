# **Las columnas que la base trae y el instrumento no declara.** ADR 0106, punto 1.
#
# Una base preparada fuera (HSyVbG 2024/2025) trae columnas que el XLSForm no
# declara: recodificadas, índices, la facultad. Se conservan en la data
# (data_normalizer.R) pero ningún consumidor que lista variables las ve, porque
# todos parten del instrumento.
#
# El universo de «columna propia» es el mismo que el de la reconciliación de
# variables extra (`.reconciliacion_variables_extra`): columna cuyo nombre no es
# una pregunta del instrumento, que no es metadato de Kobo ni identificador de
# caso de otra plataforma ni plumbing interno, y que no es una dummy de una
# opción múltiple (la normalización las pliega antes). Se suman los metadatos de
# SurveyMonkey que no son preguntas.
#
# Para cada una se PROPONE cómo declararla: en un `.sav`, la etiqueta y las
# opciones salen del archivo; si no trae etiquetas de valor, los valores
# observados son las opciones cuando hay a lo sumo 30 distintos (la persona
# escribe las etiquetas), y si hay más, numérica o texto.

.BASE_VARIABLES_MAX_OPCIONES <- 30L
# Un valor de texto más largo que esto no es una categoría.
.BASE_VARIABLES_MAX_CHARS_OPCION <- 40L

# Metadatos de SurveyMonkey que no son preguntas (la reconciliación los deja
# reconciliables porque a veces viajan al cliente; aquí no son variables).
.BASE_VARIABLES_METADATOS_SM <- c(
  "collectornm", "date_created", "date_modified", "ip_address", "email_address",
  "first_name", "last_name", "custom_1"
)

.base_variables_n_validos <- function(x) {
  v <- trimws(as.character(haven::zap_labels(x)))
  as.integer(sum(!is.na(x) & !is.na(v) & nzchar(v)))
}

# Valores observados distintos, en orden numérico si todos lo son.
.base_variables_observados <- function(x) {
  v <- .codif_agrupar_codigo_chr(haven::zap_labels(x))
  v <- unique(v[!is.na(v)])
  num <- suppressWarnings(as.numeric(v))
  if (length(v) && !anyNA(num)) v[order(num)] else sort(v)
}

#' Propuesta de declaración de una columna.
#'
#' @param x la columna (con atributos de haven si viene de un `.sav`).
#' @param nombre su nombre en la base.
#' @return `list(label, tipo, opciones)`.
#' @keywords internal
base_variables_proponer <- function(x, nombre) {
  label <- .carga_sav_var_label(x, nombre)
  labs <- attr(x, "labels", exact = TRUE)
  pares <- .panel_choice_rows_from_labels(labs, "")
  opciones <- function(codigos, etiquetas = codigos) {
    lapply(seq_along(codigos), function(i) list(codigo = as.character(codigos[[i]]),
                                                etiqueta = as.character(etiquetas[[i]])))
  }
  if (nrow(pares)) {
    if (!.carga_sav_solo_especiales_con_valores(x, pares$name)) {
      return(list(label = label, tipo = "select_one", opciones = opciones(pares$name, pares$label)))
    }
    # Sólo especiales etiquetados con valores reales sin etiqueta: es numérica.
    return(list(label = label, tipo = .carga_sav_tipo_plano(x), opciones = list()))
  }
  plano <- .carga_sav_tipo_plano(x)
  if (plano %in% c("date", "datetime")) return(list(label = label, tipo = plano, opciones = list()))
  obs <- .base_variables_observados(x)
  # Privacidad: una columna de texto libre (nombres, correos, comentarios) no
  # se propone como lista: sus valores irían a la meta de la base y al .pulso.
  # Texto con casi un valor por caso, o con algún valor largo, es texto.
  if (identical(plano, "text") && length(obs) &&
      (length(obs) > 0.5 * .base_variables_n_validos(x) ||
       any(nchar(obs, type = "chars") > .BASE_VARIABLES_MAX_CHARS_OPCION))) {
    return(list(label = label, tipo = "text", opciones = list()))
  }
  if (length(obs) && length(obs) <= .BASE_VARIABLES_MAX_OPCIONES) {
    return(list(label = label, tipo = "select_one", opciones = opciones(obs)))
  }
  list(label = label, tipo = plano, opciones = list())
}

#' Columnas propias de una base, con su propuesta y lo ya declarado.
#'
#' Pura: recibe la data normalizada al instrumento ORIGINAL de la base (sin sus
#' declaraciones) y las columnas ya declaradas.
#' @return lista de `list(name, label, tipo, opciones, n_validos, declarada)`;
#'   en una declarada, `label`/`tipo`/`opciones` son los declarados.
#' @keywords internal
base_variables_detectar_columnas <- function(data, inst, declaradas = list()) {
  if (!is.data.frame(data) || !ncol(data)) return(list())
  extra <- .reconciliacion_variables_extra(data, inst)
  nombres <- as.character(extra$name)
  nombres <- nombres[!(tolower(nombres) %in% .BASE_VARIABLES_METADATOS_SM)]
  # La reconciliación ordena por llenado; aquí manda el orden de la base.
  nombres <- names(data)[names(data) %in% nombres]
  por_nombre <- stats::setNames(declaradas %||% list(),
                                vapply(declaradas %||% list(), function(d) .origen_externo_chr(d[["name"]]), character(1)))
  lapply(nombres, function(nm) {
    d <- por_nombre[[nm]]
    prop <- if (is.null(d)) base_variables_proponer(data[[nm]], nm) else
      list(label = .origen_externo_chr(d[["label"]], nm), tipo = .origen_externo_chr(d[["tipo"]], "text"),
           opciones = d[["opciones"]] %||% list())
    list(name = nm, label = prop$label, tipo = prop$tipo, opciones = prop$opciones,
         n_validos = .base_variables_n_validos(data[[nm]]), declarada = !is.null(d))
  })
}
