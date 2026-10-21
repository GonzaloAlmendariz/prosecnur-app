# collection_mail_trato.R — «Estimado» o «Estimada» según el sexo de cada
# destinatario (ADR 0110; pedido 2026-10-20: «columna de sexo, la app traduce»).
#
# Contrato (`greeting.trato`, opcional, dentro de `collection_mail_template/v2`):
#
#   trato = { modo: "fijo" | "por_sexo",
#             columna?: "<encabezado de la lista>",   # solo por_sexo
#             masculino: "Estimado", femenino: "Estimada", respaldo: "Estimado(a)",
#             sm?: "CustomDataN" }                    # SurveyMonkey; sin él, el primero libre
#
# La palabra que cambia es `respaldo`: su PRIMERA aparición en `text` y en
# `fallback` del saludo. Así el texto sigue siendo «Estimado(a) {{nombre}}:» y
# una plantilla sin columna sale byte a byte como antes.
#
# - `fijo`, o `por_sexo` sin `columna`: la palabra queda tal cual (respaldo) en
#   los dos dialectos. En SurveyMonkey no se emite [CustomDataN] sin columna:
#   nadie lo llenaría y todos verían el saludo sin palabra.
# - `por_sexo` con `columna`: Mailchimp `*|IF:SALUDO|**|SALUDO|**|ELSE:|*respaldo*|END:IF|*`
#   y audiencia.csv con la columna SALUDO; SurveyMonkey `[CustomDataN]` y, con la
#   lista cargada, contactos_surveymonkey.csv con CustomDataN ya escrito.
#
# **El sexo de una persona no persiste.** Lo único que entra al `.pulso` es el
# NOMBRE de la columna (un encabezado); los valores se leen de la lista de la
# sesión (tempdir, collection_mail_recipients.R) al revisar, previsualizar o
# exportar, y solo salen dentro de los paquetes `personal_data`.
#
# **Lectura de la columna (mapa cerrado).** Cada celda se normaliza: sin tildes,
# en minúsculas y sin nada que no sea letra («M.», « Varón » -> m, varon).
#   masculino: masculino, hombre, h, varon, male
#   femenino:  f, femenino, mujer, female
#   «m» es ambigua en es-PE (Masculino o Mujer) y se decide por el CONJUNTO de
#   valores de la columna entera:
#     trae «f» y no «h» -> lectura `m_f`: m = masculino;
#     trae «h» y no «f» -> lectura `h_m`: m = mujer (femenino);
#     trae «h» y «f», o ni una ni otra -> `m_ambigua`: m no se reconoce;
#     no trae «m» -> `sin_m`.
# Vacío (`.cmail_is_empty`) -> `sin_dato`; lo demás -> `no_reconocido`. Los dos
# reciben el respaldo y se cuentan. El denominador de los conteos son los
# destinatarios efectivos; la lectura se decide con todas las filas de la lista.

.CMAIL_TRATO_KEYS <- c("modo", "columna", "masculino", "femenino", "respaldo", "sm")
.CMAIL_TRATO_MODES <- c("fijo", "por_sexo")
.CMAIL_TRATO_DEFAULTS <- list(masculino = "Estimado", femenino = "Estimada", respaldo = "Estimado(a)")
.CMAIL_TRATO_TAG <- "SALUDO"
.CMAIL_TRATO_MAX_WORD <- 40L
.CMAIL_TRATO_MAX_COLUMN <- 120L
.CMAIL_SEXO_MASCULINO <- c("masculino", "hombre", "h", "varon", "male")
.CMAIL_SEXO_FEMENINO <- c("f", "femenino", "mujer", "female")
# Marca interna que ocupa el lugar de la palabra mientras el texto se escapa.
.CMAIL_TRATO_MARK <- ""

# ---- contrato -------------------------------------------------------------------

#' Trato de un bloque greeting con sus valores por defecto, o NULL.
#' @keywords internal
.cmail_trato_of <- function(b) {
  tr <- b$trato
  if (!is.list(tr) || !length(tr)) return(NULL)
  out <- list(modo = .cmail_one(tr$modo) %||% "por_sexo")
  col <- .cmail_one(tr$columna)
  if (!is.null(col) && nzchar(trimws(col))) out$columna <- trimws(col)
  for (k in names(.CMAIL_TRATO_DEFAULTS)) {
    v <- .cmail_one(tr[[k]])
    out[[k]] <- if (!is.null(v) && nzchar(trimws(v))) v else .CMAIL_TRATO_DEFAULTS[[k]]
  }
  sm <- .cmail_one(tr$sm)
  if (!is.null(sm)) out$sm <- sm
  out
}

#' ¿El saludo cambia por persona? `por_sexo` con columna declarada.
#' @keywords internal
.cmail_trato_active <- function(trato) {
  !is.null(trato) && identical(trato$modo, "por_sexo") && !is.null(trato$columna)
}

# El primer saludo con trato de la plantilla: list(block, trato) o NULL.
.cmail_trato_greeting <- function(template) {
  for (b in template$blocks %||% list()) {
    if (!identical(b$type, "greeting")) next
    tr <- .cmail_trato_of(b)
    if (!is.null(tr)) return(list(block = b, trato = tr))
  }
  NULL
}

# Rellena las palabras que falten (normalización de la plantilla).
.cmail_trato_normalize <- function(tr) {
  if (!is.list(tr)) return(tr)
  for (k in names(.CMAIL_TRATO_DEFAULTS)) if (is.null(tr[[k]])) tr[[k]] <- .CMAIL_TRATO_DEFAULTS[[k]]
  if (is.null(tr$modo)) tr$modo <- "por_sexo"
  if (is.character(tr$columna) && length(tr$columna) == 1L && !is.na(tr$columna)) {
    tr$columna <- trimws(tr$columna)
    if (!nzchar(tr$columna)) tr$columna <- NULL
  }
  tr
}

#' Problemas del `trato` de un saludo. `fields` = los campos de la plantilla.
#' @keywords internal
.cmail_trato_problems <- function(tr, path, fields) {
  out <- list()
  push <- function(prop, code, detail) out[[length(out) + 1L]] <<- .cmail_problem(paste0(path, if (nzchar(prop)) ".", prop), code, detail)
  if (!is.list(tr) || is.null(names(tr))) {
    push("", "not_object", "trato es un objeto {modo, columna, masculino, femenino, respaldo}.")
    return(out)
  }
  for (k in setdiff(names(tr), .CMAIL_TRATO_KEYS)) push(k, "unknown_key", sprintf("`%s` no pertenece al trato.", k))
  modo <- .cmail_one(tr$modo)
  if (is.null(modo) || !(modo %in% .CMAIL_TRATO_MODES)) push("modo", "bad_trato_mode", "modo es fijo o por_sexo.")
  for (k in names(.CMAIL_TRATO_DEFAULTS)) {
    if (is.null(tr[[k]])) next
    v <- .cmail_one(tr[[k]])
    if (is.null(v) || !nzchar(trimws(v))) { push(k, "missing_text", "Falta la palabra."); next }
    out <- c(out, .cmail_text_problems(v, paste0(path, ".", k), character(0)))
    if (length(.cmail_tokens(v)) || grepl("{{", v, fixed = TRUE)) push(k, "trato_has_field", "La palabra del trato no admite {{campos}}.")
    if (nchar(v) > .CMAIL_TRATO_MAX_WORD) push(k, "text_too_long", sprintf("Máximo %d caracteres.", .CMAIL_TRATO_MAX_WORD))
    if (grepl("*", v, fixed = TRUE)) push(k, "trato_bad_word", "La palabra del trato no lleva **negrita**: la negrita va en el texto del saludo.")
  }
  if (!is.null(tr$columna)) {
    col <- .cmail_one(tr$columna)
    if (is.null(col)) push("columna", "not_text", "columna es el encabezado de la lista.")
    else if (nchar(col) > .CMAIL_TRATO_MAX_COLUMN) push("columna", "text_too_long", sprintf("Máximo %d caracteres.", .CMAIL_TRATO_MAX_COLUMN))
    else if (grepl(.CMAIL_EMAIL_LIKE_RE, col)) push("columna", "bad_column", "La columna es un encabezado, no un correo.")
  }
  sms <- vapply(fields %||% list(), function(f) .cmail_one(f$sm) %||% "", "")
  if (!is.null(tr$sm)) {
    sm <- .cmail_one(tr$sm)
    if (is.null(sm) || !grepl("^CustomData([1-9]|[1-4][0-9]|50)$", sm)) {
      push("sm", "bad_sm", "El trato de SurveyMonkey va en un dato personalizado: CustomData1 a CustomData50.")
    } else if (sm %in% sms) {
      push("sm", "duplicate_sm", sprintf("[%s] ya es de un campo del correo.", sm))
    }
  }
  tags <- vapply(fields %||% list(), function(f) .cmail_one(f$tag) %||% "", "")
  if (identical(modo, "por_sexo") && .CMAIL_TRATO_TAG %in% tags) {
    push("modo", "trato_tag_taken", sprintf("*|%s|* es la etiqueta del trato por sexo: cambia la del campo que la usa.", .CMAIL_TRATO_TAG))
  }
  out
}

#' Dato personalizado de SurveyMonkey del trato: el declarado o el primero libre.
#' @keywords internal
.cmail_trato_sm_slot <- function(trato, fields) {
  if (!is.null(trato$sm)) return(trato$sm)
  used <- vapply(fields %||% list(), function(f) .cmail_one(f$sm) %||% "", "")
  n <- suppressWarnings(as.integer(sub("^CustomData", "", used[grepl("^CustomData[0-9]+$", used)])))
  free <- setdiff(seq_len(50L), n)
  sprintf("CustomData%d", free[[1]])
}

# ---- lectura del sexo -----------------------------------------------------------

.cmail_sexo_token <- function(x) {
  v <- .cmail_value(x)
  v <- stringi::stri_trans_general(tolower(v), "Latin-ASCII")
  gsub("[^a-z]", "", v)
}

#' Lectura de la columna entera: m_f | h_m | m_ambigua | sin_m.
#' @keywords internal
.cmail_sexo_lectura <- function(tokens) {
  tokens <- unique(tokens[nzchar(tokens)])
  if (!("m" %in% tokens)) return("sin_m")
  has_h <- "h" %in% tokens
  has_f <- "f" %in% tokens
  if (has_f && !has_h) return("m_f")
  if (has_h && !has_f) return("h_m")
  "m_ambigua"
}

#' Clasifica una columna de sexo: list(sexo = masculino|femenino|sin_dato|no_reconocido, lectura).
#' @keywords internal
.cmail_sexo_classify <- function(values) {
  values <- as.character(values %||% character(0))
  tok <- .cmail_sexo_token(values)
  lectura <- .cmail_sexo_lectura(tok)
  sexo <- rep("no_reconocido", length(values))
  sexo[tok %in% .CMAIL_SEXO_MASCULINO] <- "masculino"
  sexo[tok %in% .CMAIL_SEXO_FEMENINO] <- "femenino"
  if (identical(lectura, "m_f")) sexo[tok == "m"] <- "masculino"
  if (identical(lectura, "h_m")) sexo[tok == "m"] <- "femenino"
  sexo[.cmail_is_empty(values)] <- "sin_dato"
  list(sexo = sexo, lectura = lectura)
}

.CMAIL_SEXO_LECTURA_LABEL <- c(
  m_f = "la columna trae M y F: M se lee como masculino",
  h_m = "la columna trae H y M: M se lee como mujer",
  m_ambigua = "la columna trae M sin que se sepa si es masculino o mujer (H y F a la vez, o ninguna de las dos): M no se reconoce",
  sin_m = "la columna no usa M"
)

#' El trato de cada destinatario de la lista.
#'
#' @return NULL sin trato por sexo con columna; si no, list(columna, presente,
#'   lectura, sexo, palabra (por fila de la lista), counts sobre los efectivos,
#'   no_reconocidos (hasta 10 valores distintos)).
#' @keywords internal
.cmail_trato_resolve <- function(store, template, resolved = NULL) {
  g <- .cmail_trato_greeting(template)
  if (is.null(g) || !.cmail_trato_active(g$trato) || is.null(store)) return(NULL)
  tr <- g$trato
  col <- tr$columna
  base <- list(block_id = as.character(g$block$block_id), trato = tr, columna = col)
  if (!(col %in% names(store$rows))) return(c(base, list(presente = FALSE)))
  resolved <- resolved %||% .cmail_recipients_resolve(store, template)
  cl <- .cmail_sexo_classify(store$rows[[col]])
  palabra <- ifelse(cl$sexo == "masculino", tr$masculino, ifelse(cl$sexo == "femenino", tr$femenino, tr$respaldo))
  eff <- cl$sexo[resolved$rows]
  raw <- .cmail_value(store$rows[[col]])
  odd <- unique(raw[cl$sexo == "no_reconocido"])
  c(base, list(
    presente = TRUE,
    lectura = cl$lectura,
    sexo = cl$sexo,
    palabra = unname(palabra),
    counts = list(
      efectivos = as.integer(length(resolved$rows)),
      masculino = as.integer(sum(eff == "masculino")),
      femenino = as.integer(sum(eff == "femenino")),
      sin_dato = as.integer(sum(eff == "sin_dato")),
      no_reconocido = as.integer(sum(eff == "no_reconocido"))
    ),
    no_reconocidos = as.list(utils::head(odd, 10L))
  ))
}

# Resumen sin datos por persona (vista de destinatarios y manifest).
.cmail_trato_summary <- function(tres) {
  if (is.null(tres)) return(NULL)
  .cmc_drop_nulls_deep(list(
    block_id = tres$block_id, columna = tres$columna, presente = tres$presente, lectura = tres$lectura,
    counts = tres$counts, no_reconocidos = tres$no_reconocidos,
    palabras = list(masculino = tres$trato$masculino, femenino = tres$trato$femenino, respaldo = tres$trato$respaldo)
  ))
}

# ---- render ---------------------------------------------------------------------

# La palabra en el HTML: respaldo fijo, etiqueta del dialecto o la de la persona.
.cmail_trato_html <- function(tr, ctx) {
  if (isTRUE(ctx$export)) {
    if (identical(ctx$dialect %||% .CMAIL_PLATFORM_DEFAULT, "surveymonkey")) {
      return(sprintf("[%s]", .cmail_trato_sm_slot(tr, ctx$fields)))
    }
    # audiencia.csv escribe SALUDO para todos (el respaldo a quien no se
    # reconoce): con esa garantía la etiqueta va sola.
    if (isTRUE(ctx$known$saludo)) return(sprintf("*|%s|*", .CMAIL_TRATO_TAG))
    return(.cmail_dialect(ctx)$conditional(.CMAIL_TRATO_TAG, sprintf("*|%s|*", .CMAIL_TRATO_TAG), .cmail_esc(tr$respaldo)))
  }
  word <- .cmail_one(ctx$values$trato) %||% tr$respaldo
  .cmail_field_span("trato", .cmail_esc(word), ctx)
}

#' Texto del saludo -> HTML con la palabra del trato en su lugar. Sin trato
#' activo es exactamente `.cmail_inline(text)` (paridad de bytes).
#' @keywords internal
.cmail_trato_inline <- function(text, tr, ctx) {
  if (!.cmail_trato_active(tr) || is.null(text) || !grepl(tr$respaldo, text, fixed = TRUE)) {
    return(.cmail_inline(text, ctx))
  }
  marked <- sub(tr$respaldo, .CMAIL_TRATO_MARK, text, fixed = TRUE)
  html <- .cmail_inline(marked, ctx)
  sub(.CMAIL_TRATO_MARK, .cmail_gsub_safe(.cmail_trato_html(tr, ctx)), html, fixed = TRUE)
}

# ---- revisión -------------------------------------------------------------------

#' Chequeos del trato. `store`/`resolved` solo cuando la revisión mira la lista.
#' @keywords internal
.cmail_trato_checks <- function(tpl, push, dialect = .CMAIL_PLATFORM_DEFAULT, store = NULL, resolved = NULL,
                                with_list = FALSE) {
  g <- .cmail_trato_greeting(tpl)
  if (is.null(g)) return(push)
  tr <- g$trato
  bid <- as.character(g$block$block_id)
  target <- list(.cmail_target(bid, "trato"))
  texts <- c(.cmail_one(g$block$text) %||% "", .cmail_one(g$block$fallback) %||% "")
  if (!any(grepl(tr$respaldo, texts, fixed = TRUE))) {
    push(.cmail_check("greeting_trato_word", "warning", 0L,
                      sprintf("El saludo no contiene «%s»: el trato no cambia nada. Escribe esa palabra en el saludo o cámbiala en el trato.", tr$respaldo),
                      targets = target))
  }
  if (!identical(tr$modo, "por_sexo")) return(push)
  if (is.null(tr$columna)) {
    push(.cmail_check("greeting_trato", "warning", 0L,
                      sprintf("El saludo dirá «%s» a todos: declara la columna de sexo.", tr$respaldo), targets = target))
    return(push)
  }
  if (identical(dialect, "surveymonkey")) {
    slot <- .cmail_trato_sm_slot(tr, tpl$fields)
    push(.cmail_check("sm_trato_blank", "warning", NULL,
                      sprintf("SurveyMonkey no tiene condicionales: un contacto del recopilador sin [%s] verá el saludo sin «%s» ni «%s». Importa contactos_surveymonkey.csv en el recopilador o llena [%s] en cada contacto.",
                              slot, tr$masculino, tr$femenino, slot),
                      extra = list(list(sm = slot)), targets = target))
  }
  if (!isTRUE(with_list) || is.null(store)) {
    push(.cmail_check("greeting_trato", "ok", NULL,
                      sprintf("El saludo dirá «%s» o «%s» según la columna «%s» de la lista; sin dato, «%s».",
                              tr$masculino, tr$femenino, tr$columna, tr$respaldo), targets = target))
    return(push)
  }
  tres <- .cmail_trato_resolve(store, tpl, resolved)
  if (!isTRUE(tres$presente)) {
    push(.cmail_check("greeting_trato", "error", 0L,
                      sprintf("La columna «%s» del saludo no está en la lista importada: elige la columna de sexo de esta lista.", tr$columna),
                      extra = list(.cmail_trato_summary(tres)), targets = target))
    return(push)
  }
  cn <- tres$counts
  unknown <- cn$sin_dato + cn$no_reconocido
  lectura <- .CMAIL_SEXO_LECTURA_LABEL[[tres$lectura]]
  push(if (unknown > 0L) {
    .cmail_check("greeting_trato", "warning", as.integer(unknown),
                 sprintf("%d de %d destinatarios recibirán «%s»: %d sin dato y %d con un valor que no se reconoce. «%s» a %d y «%s» a %d (%s).",
                         unknown, cn$efectivos, tr$respaldo, cn$sin_dato, cn$no_reconocido,
                         tr$masculino, cn$masculino, tr$femenino, cn$femenino, lectura),
                 extra = list(.cmail_trato_summary(tres)), targets = target)
  } else {
    .cmail_check("greeting_trato", "ok", 0L,
                 sprintf("«%s» a %d y «%s» a %d de %d destinatarios (%s).",
                         tr$masculino, cn$masculino, tr$femenino, cn$femenino, cn$efectivos, lectura),
                 extra = list(.cmail_trato_summary(tres)), targets = target)
  })
  push
}

# ---- paquetes -------------------------------------------------------------------

.cmail_trato_counts_line <- function(tres) {
  cn <- tres$counts
  tr <- tres$trato
  sprintf("«%s» %d, «%s» %d y «%s» %d (%d sin dato, %d con un valor que no se reconoce); %s.",
          tr$masculino, cn$masculino, tr$femenino, cn$femenino, tr$respaldo, cn$sin_dato + cn$no_reconocido,
          cn$sin_dato, cn$no_reconocido, .CMAIL_SEXO_LECTURA_LABEL[[tres$lectura]])
}

# Líneas del LEEME de Mailchimp sobre la columna SALUDO.
.cmail_leeme_trato_mc <- function(tres) {
  if (!isTRUE(tres$presente)) return(character(0))
  c(sprintf("   La columna %s trae el saludo de cada persona según la columna «%s»: %s",
            .CMAIL_TRATO_TAG, tres$columna, .cmail_trato_counts_line(tres)),
    sprintf("   El campo %s va con la etiqueta *|%s|* (tipo Texto); la plantilla lo usa tal cual.", .CMAIL_TRATO_TAG, .CMAIL_TRATO_TAG))
}

# Bloque `trato` del manifest: reglas y conteos, nunca el sexo de una persona.
.cmail_trato_manifest <- function(tpl, tres, platform) {
  g <- .cmail_trato_greeting(tpl)
  if (is.null(g)) return(NULL)
  tr <- g$trato
  active <- .cmail_trato_active(tr)
  .cmc_drop_nulls_deep(list(
    modo = tr$modo, columna = tr$columna,
    palabras = list(masculino = tr$masculino, femenino = tr$femenino, respaldo = tr$respaldo),
    emitido = if (!active) "respaldo_fijo" else if (identical(platform, "surveymonkey")) "custom_data" else "merge_tag",
    etiqueta = if (active) { if (identical(platform, "surveymonkey")) sprintf("[%s]", .cmail_trato_sm_slot(tr, tpl$fields)) else sprintf("*|%s|*", .CMAIL_TRATO_TAG) },
    lectura = tres$lectura, presente = tres$presente, counts = tres$counts
  ))
}

#' contactos_surveymonkey.csv: Email, FirstName, LastName (si un campo la
#' declara), cada CustomDataK de los campos mapeados y el CustomDataN del trato.
#' @return los encabezados escritos.
#' @keywords internal
.cmail_write_sm_contacts <- function(path, tpl, store, resolved, tres = NULL) {
  rows <- resolved$rows
  m <- store$mapping
  header <- c("Email", "FirstName")
  cols <- list(resolved$email[rows], resolved$first_name[rows])
  extra <- list()
  for (f in tpl$fields %||% list()) {
    sm <- .cmail_one(f$sm)
    col <- m$fields[[as.character(f$key)]]
    if (is.null(sm) || identical(sm, "SurveyLink") || is.null(col)) next
    extra[[sm]] <- .cmail_value(store$rows[[col]][rows])
  }
  if (isTRUE(tres$presente)) extra[[.cmail_trato_sm_slot(tres$trato, tpl$fields)]] <- tres$palabra[rows]
  num <- suppressWarnings(as.integer(sub("^CustomData", "", names(extra))))
  ord <- order(names(extra) != "LastName", num, na.last = FALSE)
  for (k in names(extra)[ord]) { header <- c(header, k); cols[[length(cols) + 1L]] <- extra[[k]] }
  .cmail_write_csv(path, header, cols, length(rows))
  header
}

# Líneas del LEEME de SurveyMonkey sobre el trato y los contactos.
.cmail_leeme_trato_sm <- function(tpl, tres = NULL, contacts = NULL) {
  g <- .cmail_trato_greeting(tpl)
  tr <- g$trato
  active <- .cmail_trato_active(tr)
  slot <- if (active) .cmail_trato_sm_slot(tr, tpl$fields)
  c(
    if (!is.null(contacts)) c(
      "",
      sprintf("Contactos: contactos_surveymonkey.csv trae a los %d destinatarios de la lista (%s).",
              as.integer(length(contacts$rows)), paste(contacts$header, collapse = ", ")),
      "   En el recopilador de la invitación, agrega los destinatarios importándolos desde un archivo CSV y sube contactos_surveymonkey.csv.",
      "   Al asociar las columnas: Email es el correo, FirstName el nombre, LastName el apellido y cada CustomDataN su dato personalizado N.",
      "   contactos_surveymonkey.csv contiene datos personales: no lo compartas ni lo guardes dentro del proyecto .pulso."
    ),
    if (active) c(
      "",
      sprintf("Saludo: [%s] lleva «%s» o «%s» según la columna «%s» de la lista; sin dato o sin reconocer, «%s».",
              slot, tr$masculino, tr$femenino, tr$columna, tr$respaldo),
      if (isTRUE(tres$presente)) sprintf("   %s", .cmail_trato_counts_line(tres)),
      if (is.null(contacts)) sprintf("   Llena [%s] en cada contacto del recopilador con «%s» o «%s» (y «%s» si no se sabe).",
                                     slot, tr$masculino, tr$femenino, tr$respaldo),
      sprintf("   SurveyMonkey no tiene respaldo: un contacto sin [%s] verá el saludo sin esa palabra.", slot)
    ) else if (!is.null(tr) && identical(tr$modo, "por_sexo")) c(
      "", sprintf("Saludo: dice «%s» a todos porque no se declaró la columna de sexo.", tr$respaldo)
    )
  )
}
