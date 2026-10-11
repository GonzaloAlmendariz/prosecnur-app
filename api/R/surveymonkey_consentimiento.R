# Qué respuesta del consentimiento es «sí» (checklist codificación SM
# 2026-10-11, ítem 14).
#
# El «sí» se decide por la ETIQUETA de la opción en el instrumento que codificó
# esa respuesta, no por el código literal. Antes se tomaba el código «1» como
# sí: si el editor reordenó la lista (No = 1, Sí = 2) y la base adoptó ese
# orden (`choice_order_editor`), o si la plataforma trae «No» primero, la
# encuesta descartaba justo a quien consintió.
#
# Si la lista no trae etiquetas, o ninguna es afirmativa, se cae al criterio
# anterior (el código «1» y las palabras de sí) y se declara como respaldo en
# el filtro de respuestas (`consent_yes_criterio`, `consent_yes_motivo`).

.SM_CONSENT_CRITERIO_ETIQUETA <- "etiqueta"
.SM_CONSENT_CRITERIO_RESPALDO <- "respaldo_codigo_1"

# Etiqueta afirmativa: «Sí», «Si», «Acepto», «Sí, acepto», «De acuerdo»,
# «Sí, deseo continuar», «Autorizo», «Yes», «I agree»… Una etiqueta que empieza
# por «no» nunca es afirmativa («No acepto», «No deseo continuar»).
.sm_consent_etiqueta_afirmativa <- function(x) {
  key <- .sm_mb_norm(x)
  if (!length(key)) return(logical(0))
  key[is.na(key)] <- ""
  negativa <- grepl("^(no|not|rechazo|rechaza|declino|decline|declined)( |$)", key)
  afirmativa <- grepl(paste0(
    "^(si|yes|ok|acepto|acepta|aceptar|accept|accepted|agree|i agree|de acuerdo|estoy de acuerdo|",
    "consiento|doy mi consentimiento|autorizo|deseo continuar|deseo participar|quiero participar|",
    "continuar|participar)( |$)"
  ), key)
  afirmativa & !negativa
}

# Opciones de la variable de consentimiento en un instrumento
# (`reporte_instrumento`): data.frame(codigo, etiqueta).
.sm_consent_opciones_inst <- function(inst, consent_var) {
  ch <- tryCatch(.sm_mb_choices_for_var(inst, consent_var), error = function(e) data.frame())
  if (!is.data.frame(ch) || !nrow(ch) || !"name" %in% names(ch)) {
    return(data.frame(codigo = character(0), etiqueta = character(0), stringsAsFactors = FALSE))
  }
  etiquetas <- if ("label" %in% names(ch)) as.character(ch$label) else rep("", nrow(ch))
  # `.sm_mb_choices_for_var` rellena `label` con `name` si la lista no trae
  # etiquetas: una «etiqueta» igual al código no dice qué opción es.
  etiquetas[is.na(etiquetas) | etiquetas == as.character(ch$name)] <- ""
  data.frame(codigo = as.character(ch$name), etiqueta = etiquetas, stringsAsFactors = FALSE)
}

# Opciones de la pregunta en la traducción del proveedor (`.sm_mb_question_specs`).
.sm_consent_opciones_spec <- function(spec) {
  ch <- (spec %||% list())$choices %||% list()
  if (!length(ch)) {
    return(data.frame(codigo = character(0), etiqueta = character(0), stringsAsFactors = FALSE))
  }
  data.frame(
    codigo = vapply(ch, function(x) .sm_mb_scalar(x$code, ""), character(1)),
    etiqueta = vapply(ch, function(x) .sm_mb_scalar(x$label, ""), character(1)),
    stringsAsFactors = FALSE
  )
}

# Criterio del «sí» para una lista: códigos afirmativos por etiqueta o respaldo.
.sm_consent_criterio <- function(opciones) {
  opciones <- opciones %||% data.frame(codigo = character(0), etiqueta = character(0))
  etiquetas <- as.character(opciones$etiqueta %||% character(0))
  etiquetas[is.na(etiquetas)] <- ""
  if (!nrow(opciones) || !any(nzchar(trimws(etiquetas)))) {
    return(list(criterio = .SM_CONSENT_CRITERIO_RESPALDO, motivo = "sin_etiquetas",
                codigos_si = character(0), codigos_lista = as.character(opciones$codigo %||% character(0))))
  }
  si <- .sm_consent_etiqueta_afirmativa(etiquetas)
  if (!any(si)) {
    return(list(criterio = .SM_CONSENT_CRITERIO_RESPALDO, motivo = "sin_etiqueta_afirmativa",
                codigos_si = character(0), codigos_lista = as.character(opciones$codigo)))
  }
  list(criterio = .SM_CONSENT_CRITERIO_ETIQUETA, motivo = "",
       codigos_si = as.character(opciones$codigo[si]), codigos_lista = as.character(opciones$codigo))
}

# ¿Cada valor es un «sí»? `values` son códigos de la lista (o, si la respuesta
# llegó sin código, su etiqueta). Devuelve el lógico con el criterio en
# `attr(, "criterio")`.
.sm_consent_si <- function(values, opciones = NULL) {
  values <- as.character(values %||% character(0))
  values[is.na(values)] <- ""
  crit <- .sm_consent_criterio(opciones)
  if (identical(crit$criterio, .SM_CONSENT_CRITERIO_RESPALDO)) {
    out <- .sm_mb_consent_yes(values)
  } else {
    en_lista <- values %in% crit$codigos_lista
    out <- ifelse(en_lista, values %in% crit$codigos_si, .sm_consent_etiqueta_afirmativa(values))
    out <- as.logical(out)
  }
  attr(out, "criterio") <- crit
  out
}

# Valores aceptados como «sí» por la política de decisiones, resueltos contra la
# lista: los códigos de la lista los decide la etiqueta; las palabras que no son
# códigos (si, acepto…) se conservan porque casan con valores sin código.
.sm_consent_valores_politica <- function(valores_politica, opciones = NULL) {
  valores_politica <- as.character(unlist(valores_politica %||% list(), use.names = FALSE))
  crit <- .sm_consent_criterio(opciones)
  if (identical(crit$criterio, .SM_CONSENT_CRITERIO_RESPALDO)) {
    return(list(valores = valores_politica, criterio = crit))
  }
  lista_norm <- .sm_mb_norm(crit$codigos_lista)
  palabras <- valores_politica[!(.sm_mb_norm(valores_politica) %in% lista_norm)]
  list(valores = unique(c(crit$codigos_si, palabras)), criterio = crit)
}

# Lo que se declara en el filtro de respuestas.
.sm_consent_declarar <- function(filter_info, crit) {
  filter_info <- filter_info %||% list()
  crit <- crit %||% list()
  filter_info$consent_yes_criterio <- .sm_mb_scalar(crit$criterio, .SM_CONSENT_CRITERIO_RESPALDO)
  filter_info$consent_yes_motivo <- .sm_mb_scalar(crit$motivo, "")
  if (identical(filter_info$consent_yes_criterio, .SM_CONSENT_CRITERIO_ETIQUETA)) {
    filter_info$consent_positive_values <- as.list(crit$codigos_si)
  }
  filter_info
}

# Pregunta de la traducción del proveedor que corresponde a la variable.
.sm_consent_spec_var <- function(details, consent_var) {
  pos <- .sm_mb_question_pos_for_var(.sm_mb_scalar(consent_var, ""))
  if (is.na(pos) || pos < 1L) return(NULL)
  for (spec in .sm_mb_question_specs(details)) {
    if (identical(as.integer(spec$pos), as.integer(pos))) return(spec)
  }
  NULL
}
