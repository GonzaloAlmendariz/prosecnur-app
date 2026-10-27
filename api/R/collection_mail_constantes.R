# collection_mail_constantes.R — datos fijos de la campaña (loop editor de
# correos, L6; Acreditación Institucional 2026: seis campañas con el mismo
# cuerpo que sólo cambian los premios, la duración y la promoción de egreso, y
# que se armaron con un script).
#
# Contrato (`template.constants`, opcional, dentro de collection_mail_template/v2):
#
#   constants = [ { key, label, value } ]     # hasta 20
#
# - `key` como la de un campo (a-z, 0-9 y _; empieza con letra; hasta 30), sin
#   repetir un campo, otra constante ni una clave reservada.
# - `label` de 1 a 60 caracteres; `value` de 1 a 300, con negrita o cursiva y
#   sin campos ni enlaces.
# - En el texto se usa como un campo: `{{premios}}`. Vale lo mismo para toda la
#   campaña, así que no es una etiqueta de Mailchimp ni de SurveyMonkey: se
#   reemplaza como texto en `.cmail_template_for_send()` (la plantilla efectiva
#   de la vista previa, la revisión, la exportación y Mailchimp), también en el
#   asunto, el texto de vista previa y la apertura de cada envío.
# - Duplicar la campaña copia los datos; basta con cambiar los valores.

.CMAIL_CONSTANTS_MAX <- 20L
.CMAIL_CONSTANT_KEYS <- c("key", "label", "value")

#' Claves de las constantes declaradas.
#' @keywords internal
.cmail_constant_keys <- function(template) {
  cs <- template$constants %||% list()
  if (!is.list(cs)) return(character(0))
  out <- vapply(cs, function(c) if (is.list(c)) as.character(.cmail_one(c$key) %||% "") else "", "")
  out[nzchar(out)]
}

#' Claves que un texto puede usar: los campos de cada persona y las constantes.
#' @keywords internal
.cmail_declared_keys <- function(template) {
  fields <- vapply(template$fields %||% list(), function(f) as.character(f$key %||% ""), "")
  unique(c(fields, .cmail_constant_keys(template)))
}

#' Problemas de las constantes; `field_keys` son las claves de los campos ya validados.
#' @keywords internal
.cmail_constants_problems <- function(template, field_keys) {
  cs <- template$constants
  if (is.null(cs)) return(list())
  out <- list()
  add <- function(x) out <<- c(out, x)
  if (!is.list(cs) || (length(cs) && !is.null(names(cs)))) {
    return(list(.cmail_problem("template.constants", "not_list", "constants debe ser una lista.")))
  }
  if (length(cs) > .CMAIL_CONSTANTS_MAX) {
    add(list(.cmail_problem("template.constants", "too_many_constants", sprintf("Hasta %d datos de la campaña.", .CMAIL_CONSTANTS_MAX))))
  }
  vistas <- field_keys
  for (i in seq_along(cs)) {
    c <- cs[[i]]
    path <- sprintf("template.constants[%d]", i)
    if (!is.list(c)) { add(list(.cmail_problem(path, "not_object", "Cada dato es un objeto."))); next }
    for (k in setdiff(names(c), .CMAIL_CONSTANT_KEYS)) {
      add(list(.cmail_problem(paste0(path, ".", k), "unknown_key", sprintf("`%s` no pertenece a un dato de la campaña.", k))))
    }
    key <- .cmail_one(c$key)
    if (is.null(key) || !grepl("^[a-z][a-z0-9_]{0,29}$", key)) {
      add(list(.cmail_problem(paste0(path, ".key"), "bad_key", "La clave va en minúsculas: a-z, 0-9 y _.")))
    } else if (key %in% .CMAIL_RESERVED_KEYS) {
      add(list(.cmail_problem(paste0(path, ".key"), "reserved_key", sprintf("{{%s}} es reservado.", key))))
    } else if (key %in% vistas) {
      add(list(.cmail_problem(paste0(path, ".key"), "duplicate_key", sprintf("{{%s}} está repetido.", key))))
    } else {
      vistas <- c(vistas, key)
    }
    label <- .cmail_one(c$label)
    if (is.null(label) || !nzchar(trimws(label)) || nchar(label) > 60L) {
      add(list(.cmail_problem(paste0(path, ".label"), "bad_label", "El nombre del dato va de 1 a 60 caracteres.")))
    }
    value <- .cmail_one(c$value)
    if (is.null(value) || !nzchar(trimws(value))) {
      add(list(.cmail_problem(paste0(path, ".value"), "missing_value", "Falta el valor del dato.")))
    } else if (nchar(value) > 300L) {
      add(list(.cmail_problem(paste0(path, ".value"), "too_long", "El valor va hasta 300 caracteres.")))
    } else {
      # Texto con marcas, sin campos ni enlaces: un valor no puede pedir otro valor.
      add(.cmail_text_problems(value, paste0(path, ".value"), character(0)))
      add(.cmail_link_problems(value, paste0(path, ".value"), character(0), FALSE))
    }
  }
  out
}

# Reemplaza `{{clave}}` por su valor en un texto.
.cmail_constants_sub <- function(x, valores) {
  if (!is.character(x) || !length(x) || !any(grepl("{{", x, fixed = TRUE))) return(x)
  for (k in names(valores)) {
    pat <- sprintf("\\{\\{\\s*%s\\s*\\}\\}", k)
    x <- vapply(x, function(s) {
      m <- gregexpr(pat, s, perl = TRUE)
      regmatches(s, m) <- list(rep(valores[[k]], length(m[[1]][m[[1]] > 0])))
      s
    }, "", USE.NAMES = FALSE)
  }
  x
}

.cmail_constants_walk <- function(x, valores) {
  if (is.character(x)) return(.cmail_constants_sub(x, valores))
  if (is.list(x)) {
    nm <- names(x)
    x <- lapply(x, .cmail_constants_walk, valores = valores)
    names(x) <- nm
  }
  x
}

#' La plantilla con las constantes ya escritas en el texto.
#' @keywords internal
.cmail_constants_apply <- function(t) {
  cs <- t$constants %||% list()
  if (!is.list(cs) || !length(cs)) return(t)
  valores <- list()
  for (c in cs) {
    key <- .cmail_one(c$key); value <- .cmail_one(c$value)
    if (!is.null(key) && !is.null(value)) valores[[key]] <- value
  }
  if (!length(valores)) return(t)
  for (k in c("subject", "preheader", "blocks")) if (!is.null(t[[k]])) t[[k]] <- .cmail_constants_walk(t[[k]], valores)
  t
}
