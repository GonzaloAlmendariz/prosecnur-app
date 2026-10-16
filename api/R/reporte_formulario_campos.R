# Motor del formulario en papel — que es cada fila del survey en el papel.
#
# Item 44 (tercera tanda) con la regla vigente de
# `docs/qa/reglas-papel-numeracion-saltos-2026-10-15.md` §44. Antes los campos
# sin rotulo o automaticos salian como preguntas numeradas vacias (22 en 12
# instrumentos del corpus). Cada fila recibe un ROL:
#
#   pregunta     numerable, se imprime como siempre
#   control      fecha / hora de inicio y termino / N.º de cuestionario: se anota
#                a mano en papel aunque en CAPI sea automatico. Sin numero, con
#                etiqueta `[var]`
#   cabecera     el N.º de cuestionario cuando la cabecera ya trae sus casillas:
#                se vincula a ellas y no se repite
#   especifique  «Otro, especifique» estructural: va en linea junto a la opcion
#                de la pregunta anterior, sin numero, con `[var]`
#   omitida      no tiene lugar en el papel: filas `appearance=label` (cabecera
#                de table-list, en silencio), geopuntos y variables de proceso
#                (`_recod`, `_cod`, agrupaciones `edadg`), con aviso
#   otra         el resto (estructura, notas, calculados): sin cambio

.FORM_CAMPOS_GEO <- c("geopoint", "geotrace", "geoshape", "start-geopoint",
                      "background-geopoint")

# Palabras que no dicen nada de una pregunta «Especifique»: si el rotulo solo
# tiene estas, es generico.
.FORM_CAMPOS_GENERICAS <- c("por", "favor", "especifique", "especifica", "especificar",
                            "especifiquen", "especifico", "otro", "otra", "otros", "otras",
                            "cual", "cuales", "indique", "other", "specify", "please")

.form_campos_sin_tildes <- function(x) {
  tolower(iconv(enc2utf8(as.character(x)), "UTF-8", "ASCII//TRANSLIT", sub = ""))
}

.form_campos_rotulo_generico <- function(label) {
  t <- .form_campos_sin_tildes(.form_pdf_clean_text(label))
  palabras <- strsplit(gsub("[^a-z ]", " ", t), "\\s+")[[1]]
  palabras <- palabras[nzchar(palabras)]
  !length(palabras) || all(palabras %in% .FORM_CAMPOS_GENERICAS)
}

.form_campos_es_n_cuestionario <- function(name, label) {
  n <- .form_campos_sin_tildes(name)
  l <- .form_campos_sin_tildes(.form_pdf_clean_text(label))
  grepl("^(n|nro|num|numero|no)_?(de_)?(cu?e?s?i?t?i?o?n?ario|cuest|encuesta|enc)$", n) ||
    grepl("^(n|nro|no|num|numero)\\.?\\s*(o\\s*)?(de\\s+)?(cuestionario|encuesta)\\s*:?$", l)
}

# Clasifica las filas. Devuelve list(rol, control (rotulo del campo de control),
# especifique (data.frame fila -> origen, codigo), avisos).
.form_pdf_clasificar <- function(survey, choices_by_list, cabecera_n_cuestionario = TRUE) {
  n <- nrow(survey)
  rol <- rep("otra", n)
  control <- rep("", n)
  esp <- data.frame(fila = integer(0), origen = integer(0), codigo = character(0),
                    stringsAsFactors = FALSE)
  if (!n) return(list(rol = rol, control = control, especifique = esp, avisos = character(0)))
  tipo <- vapply(survey$type, .form_pdf_type_base, character(1), USE.NAMES = FALSE)
  nombres <- as.character(survey$name)
  calc <- if ("calculation" %in% names(survey)) as.character(survey$calculation) else rep("", n)
  calc[is.na(calc)] <- ""
  apar <- tolower(as.character(survey$appearance)); apar[is.na(apar)] <- ""
  omit_geo <- character(0); omit_proc <- character(0); vinc <- character(0)

  for (i in seq_len(n)) {
    t <- tipo[i]; nm <- nombres[i]; lab <- survey$label[i]
    if (t %in% c("start", "end", "today") ||
        (identical(t, "date") && grepl("today\\(\\)", calc[i]))) {
      rol[i] <- "control"
      control[i] <- if (identical(t, "start")) "Hora de inicio"
        else if (identical(t, "end")) "Hora de término" else "Fecha de entrevista"
      next
    }
    if (t %in% .FORM_CAMPOS_GEO) { rol[i] <- "omitida"; omit_geo <- c(omit_geo, nm); next }
    if (!t %in% .form_pdf_question_bases()) next
    if (grepl("(^|\\s)label(\\s|$)", apar[i])) { rol[i] <- "omitida"; next }
    if (grepl("(_recod|_cod)$", nm, ignore.case = TRUE) ||
        (grepl("g$", nm) && sub("g$", "", nm) %in% nombres[-i])) {
      rol[i] <- "omitida"; omit_proc <- c(omit_proc, nm); next
    }
    if (.form_campos_es_n_cuestionario(nm, lab)) {
      if (isTRUE(cabecera_n_cuestionario)) { rol[i] <- "cabecera"; vinc <- c(vinc, nm) }
      else { rol[i] <- "control"; control[i] <- "N.º de cuestionario" }
      next
    }
    rol[i] <- "pregunta"
  }

  # «Otro, especifique» estructural: `text` con relevant simple sobre la
  # pregunta inmediatamente anterior y rotulo vacio o generico.
  for (i in seq_len(n)) {
    if (!identical(rol[i], "pregunta") || !identical(tipo[i], "text")) next
    if (!.form_campos_rotulo_generico(survey$label[i])) next
    ant <- i - 1L
    while (ant >= 1L && !identical(rol[ant], "pregunta") &&
           tipo[ant] %in% c("calculate", "hidden", "")) ant <- ant - 1L
    if (ant < 1L || !identical(rol[ant], "pregunta") ||
        !tipo[ant] %in% c("select_one", "select_multiple")) next
    ast <- .form_logica_parse(survey$relevant[i])
    at <- .form_logica_atomo_simple(ast)
    if (is.null(at) || !identical(at$var, nombres[ant]) || !isTRUE(at$positivo)) next
    codigos <- vapply(choices_by_list[[.form_pdf_type_list(survey$type[ant])]] %||% list(),
                      function(o) .form_pdf_chr(o$code), character(1))
    if (!at$valor %in% codigos) next
    rol[i] <- "especifique"
    esp <- rbind(esp, data.frame(fila = i, origen = ant, codigo = at$valor, stringsAsFactors = FALSE))
  }

  avisos <- character(0)
  if (length(omit_geo)) avisos <- c(avisos, sprintf(
    "Campos de ubicacion que no tienen lugar en el papel (se omiten): %s.", paste(unique(omit_geo), collapse = ", ")))
  if (length(omit_proc)) avisos <- c(avisos, sprintf(
    "Variables de proceso que no se preguntan (se omiten del papel): %s.", paste(unique(omit_proc), collapse = ", ")))
  if (length(vinc)) avisos <- c(avisos, sprintf(
    "El numero de cuestionario (%s) se anota en las casillas de la cabecera.", paste(unique(vinc), collapse = ", ")))
  list(rol = rol, control = control, especifique = esp, avisos = avisos)
}
