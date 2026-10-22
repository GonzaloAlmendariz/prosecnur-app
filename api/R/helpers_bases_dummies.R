# helpers_bases_dummies.R — las dummies de selección múltiple salen al SAV como 0 = No, 1 = Sí
# ============================================================================================
#
# HSyVbG 2026 (2026-10-22): la base 2026 llega con sus dummies ya nombradas `P26.1` y con
# 1 = la opción («Angustia»), y las de una recodificada declarada (`P26_recod.1`) llegaban
# etiquetadas sólo con la opción. El estándar de las BD entregadas (2025) es 0 = No,
# 1 = Sí y etiqueta = pregunta + opción. Sólo se tocan columnas `madre.código` o
# `madre/código` de una `select_multiple` del instrumento cuyas etiquetas de valor son
# exactamente los códigos 0 y 1.

.bases_dummy_texto_pregunta <- function(rp_inst, madre) {
  vl <- rp_inst$var_labels
  lab <- if (!is.null(vl) && madre %in% names(vl)) as.character(vl[[madre]])[1L] else NA_character_
  sv <- rp_inst$survey
  if ((is.na(lab) || !nzchar(trimws(lab))) && is.data.frame(sv) && "name" %in% names(sv)) {
    col <- grep("^label", names(sv), value = TRUE)[1L]
    if (!is.na(col)) lab <- as.character(sv[[col]][match(madre, sv$name)])
  }
  lab <- trimws(lab %||% "")
  if (is.na(lab)) "" else lab
}

.bases_dummies_si_no <- function(df, rp_inst) {
  sv <- rp_inst$survey
  if (!is.data.frame(sv) || !all(c("name", "type") %in% names(sv))) return(df)
  madres <- unique(as.character(sv$name[grepl("^select_multiple", sv$type)]))
  # En la ruta del SAV la madre original puede llegar como texto («1 4») y sólo su
  # recodificada declarada como múltiple: la original también es madre de sus dummies.
  madres <- unique(c(madres, sub("_recod$", "", madres)))
  if (!length(madres)) return(df)
  for (v in names(df)) {
    m <- sub("[./][^./]+$", "", v)
    if (identical(m, v)) next
    labs <- attr(df[[v]], "labels", exact = TRUE)
    if (is.null(labs) || length(labs) != 2L) next
    pares <- .bases_label_pairs(labs)
    codigos <- suppressWarnings(as.numeric(pares$code))
    if (anyNA(codigos) || !setequal(codigos, c(0, 1))) next
    opcion <- as.character(pares$label[codigos == 1])
    # Sin madre múltiple en el instrumento (llega como texto y sin recodificada), la
    # columna es dummy si 0 = No y su etiqueta es la pregunta terminada en la opción.
    if (!m %in% madres) {
      rotulo <- trimws(as.character(attr(df[[v]], "label", exact = TRUE) %||% "")[1L])
      cero <- as.character(pares$label[codigos == 0])
      if (!identical(cero, "No") || is.na(rotulo) || !endsWith(rotulo, opcion)) next
    }
    nuevas <- if (is.character(labs)) c(`0` = "No", `1` = "Sí") else c(No = 0, `Sí` = 1)
    attr(df[[v]], "labels") <- nuevas
    # Una recodificada sin rótulo propio por dummy lleva la pregunta de la variable original.
    if (grepl("_recod$", m)) {
      lab <- trimws(as.character(attr(df[[v]], "label", exact = TRUE) %||% opcion)[1L])
      pregunta <- .bases_dummy_texto_pregunta(rp_inst, sub("_recod$", "", m))
      if (nzchar(pregunta) && !startsWith(lab, pregunta)) attr(df[[v]], "label") <- paste(pregunta, lab)
    }
  }
  df
}
