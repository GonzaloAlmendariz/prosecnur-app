# Opciones de respuesta sin rótulo en el instrumento que leen los gráficos.
#
# Una lista del instrumento puede traer opciones sin texto: códigos que el
# formulario declaró y nunca rotuló, o categorías cuyo rótulo se perdió en el
# camino (ítem 48, ACNUR RMS 2026: `hacc02_recod` traía 105 a 112 vacíos y la
# lámina mostraba "105", "106" con 0.0 %; los casos de las opciones vacías que
# sí tenían respuestas desaparecían del gráfico porque la tabla de frecuencias
# los agrupaba bajo un rótulo vacío).
#
# Regla, por base y por lista, contando los casos en todas las preguntas que
# usan esa lista:
# - sin rótulo y sin casos: la opción sale del instrumento de Gráficos, así que
#   no se dibuja ni se completa con un cero;
# - sin rótulo y con casos: se rotula "Sin rótulo (código X)" y queda un aviso
#   para el plan. Nunca se dibuja como un número suelto.
#
# Corre después de las etiquetas curadas en Analítica: un rótulo que el analista
# escribió ahí ya no está vacío y no se toca.

.graficos_sin_rotulo_texto <- function(code) sprintf("Sin rótulo (código %s)", code)

.graficos_sin_rotulo_vacio <- function(x) {
  x <- as.character(x)
  is.na(x) | !nzchar(trimws(x))
}

# Columnas de rótulo de una tabla de choices: la principal del instrumento más
# las `label*` en español (las de otro idioma no se leen al graficar).
.graficos_sin_rotulo_cols <- function(choices, principal) {
  nms <- names(choices)
  es <- grep(
    "^label$|^label(::|_).*(\\(es\\)|españ|espanol|spanish|castellano|::es\\b|_es\\b)",
    nms, ignore.case = TRUE, value = TRUE
  )
  unique(c(intersect(principal, nms), es))
}

# Casos con el código `code` en las preguntas `vars` (select_one por valor;
# select_multiple por su columna indicadora o por los tokens de la madre).
.graficos_sin_rotulo_casos <- function(df, vars, code) {
  if (!is.data.frame(df) || !length(vars)) return(0L)
  n <- 0L
  for (v in vars) {
    dummies <- intersect(paste0(v, c("/", "."), code), names(df))
    if (length(dummies)) {
      x <- suppressWarnings(as.numeric(as.character(df[[dummies[1]]])))
      n <- n + sum(!is.na(x) & x == 1)
      next
    }
    if (!v %in% names(df)) next
    x <- trimws(as.character(df[[v]]))
    x <- x[!is.na(x) & nzchar(x)]
    if (!length(x)) next
    n <- n + if (any(grepl("\\s", x))) {
      sum(vapply(strsplit(x, "\\s+"), function(t) code %in% t, logical(1)))
    } else {
      sum(x == code)
    }
  }
  as.integer(n)
}

# Etiquetas de valor de la columna: con nombre = código y valor = rótulo (la
# forma de `reporte_data()`) o al revés (haven). `texto = NA` quita el código.
.graficos_sin_rotulo_attr_labels <- function(x, code, texto) {
  labs <- attr(x, "labels", exact = TRUE)
  if (!length(labs)) return(x)
  nm <- names(labs) %||% rep("", length(labs))
  por_nombre <- which(nm == code)
  por_valor <- if (length(por_nombre)) integer(0) else which(as.character(labs) == code & nm != code)
  if (length(por_nombre)) {
    if (is.na(texto)) labs <- labs[-por_nombre] else labs[por_nombre] <- texto
  } else if (length(por_valor)) {
    if (is.na(texto)) labs <- labs[-por_valor] else names(labs)[por_valor] <- texto
  } else {
    return(x)
  }
  attr(x, "labels") <- labs
  x
}

# Preguntas de selección de la base, agrupadas por lista.
.graficos_sin_rotulo_vars_por_lista <- function(survey) {
  if (!is.data.frame(survey) || !all(c("name", "type") %in% names(survey))) return(list())
  tipos <- tolower(trimws(as.character(survey$type)))
  idx <- which(grepl("^select_(one|multiple)\\b", tipos))
  out <- list()
  for (i in idx) {
    ln <- tryCatch(.bases_survey_list_name(survey[i, , drop = FALSE]), error = function(e) "")
    if (!nzchar(ln %||% "")) next
    out[[ln]] <- unique(c(out[[ln]], as.character(survey$name[[i]])))
  }
  out
}

# Aplica la regla a una base. Devuelve `list(inst, data, hallazgos)`.
.graficos_sin_rotulo_base <- function(inst, df) {
  vacio <- list(inst = inst, data = df, hallazgos = list())
  ch <- inst$choices
  if (!is.data.frame(ch) || !nrow(ch) || !all(c("list_name", "name") %in% names(ch))) return(vacio)
  principal <- as.character(inst$label_col_choices %||% "")[1]
  if (is.na(principal) || !nzchar(principal) || !principal %in% names(ch)) {
    principal <- .reporte_plan_choice_label_col(ch)
  }
  if (is.na(principal) || !principal %in% names(ch)) return(vacio)
  cols <- .graficos_sin_rotulo_cols(ch, principal)

  ln_all <- as.character(ch$list_name)
  code_all <- trimws(as.character(ch$name))
  sin <- which(!is.na(ln_all) & nzchar(ln_all) & !is.na(code_all) & nzchar(code_all) &
                 .graficos_sin_rotulo_vacio(ch[[principal]]))
  if (!length(sin)) return(vacio)

  vars_por_lista <- .graficos_sin_rotulo_vars_por_lista(inst$survey)
  quitar <- integer(0)
  hallazgos <- list()
  for (i in sin) {
    ln <- ln_all[[i]]
    code <- code_all[[i]]
    vars <- vars_por_lista[[ln]] %||% character(0)
    n <- .graficos_sin_rotulo_casos(df, vars, code)
    if (n == 0L) {
      quitar <- c(quitar, i)
      accion <- "omitida"
      texto <- NA_character_
    } else {
      texto <- .graficos_sin_rotulo_texto(code)
      for (col in cols) {
        if (.graficos_sin_rotulo_vacio(ch[[col]][[i]])) {
          ch[[col]] <- as.character(ch[[col]])
          ch[[col]][[i]] <- texto
        }
      }
      accion <- "rotulada"
    }
    hallazgos[[length(hallazgos) + 1L]] <- list(
      list_name = ln, codigo = code, variables = vars, n = n, accion = accion
    )
    for (v in vars) {
      ol <- inst$orders_list[[v]]
      if (is.list(ol) && length(ol$names)) {
        pos <- which(as.character(ol$names) == code)
        if (length(pos)) {
          if (is.na(texto)) {
            ol$names <- ol$names[-pos]
            if (length(ol$labels) >= max(pos)) ol$labels <- ol$labels[-pos]
          } else if (length(ol$labels) >= max(pos)) {
            ol$labels[pos] <- texto
          }
          inst$orders_list[[v]] <- ol
        }
      }
      if (is.data.frame(df) && v %in% names(df)) {
        df[[v]] <- .graficos_sin_rotulo_attr_labels(df[[v]], code, texto)
      }
    }
    dicc <- inst$dicc_code_to_label[[ln]]
    if (length(dicc) && code %in% names(dicc)) {
      if (is.na(texto)) {
        inst$dicc_code_to_label[[ln]] <- dicc[names(dicc) != code]
      } else {
        inst$dicc_code_to_label[[ln]][[code]] <- texto
        if (is.list(inst$dicc_label_to_code) && !is.null(inst$dicc_label_to_code[[ln]])) {
          inst$dicc_label_to_code[[ln]][[texto]] <- code
        }
      }
    }
  }
  if (length(quitar)) ch <- ch[-quitar, , drop = FALSE]
  inst$choices <- ch
  list(inst = inst, data = df, hallazgos = hallazgos)
}

#' Aplica la regla de opciones sin rótulo a todas las bases de Gráficos.
#'
#' Deja en `attr(src, "graficos_opciones_sin_rotulo")` lo encontrado, con la
#' base, la lista, el código, las preguntas, los casos y la acción.
#' @keywords internal
.graficos_opciones_sin_rotulo_sources <- function(src) {
  inst_sources <- src$inst_sources
  if (!is.list(inst_sources) || !length(inst_sources)) return(src)
  todos <- list()
  for (b in names(inst_sources)) {
    inst <- inst_sources[[b]]
    if (!is.list(inst) || is.data.frame(inst)) next
    df <- src$data_sources[[b]]
    res <- .graficos_sin_rotulo_base(inst, df)
    src$inst_sources[[b]] <- res$inst
    if (is.data.frame(res$data)) src$data_sources[[b]] <- res$data
    for (h in res$hallazgos) todos[[length(todos) + 1L]] <- c(list(base = b), h)
  }
  attr(src, "graficos_opciones_sin_rotulo") <- todos
  src
}

#' Avisos del plan por opciones sin rótulo que sí tienen respuestas.
#' @keywords internal
.graficos_opciones_sin_rotulo_avisos <- function(hallazgos) {
  con_casos <- Filter(function(h) identical(h$accion, "rotulada"), hallazgos %||% list())
  if (!length(con_casos)) return(character(0))
  # Una lista que comparten la base principal y sus grupos repetidos se avisa
  # una vez, con el conteo de la primera base (la principal va primero).
  clave <- vapply(con_casos, function(h) paste(h$list_name, h$codigo, sep = "\r"), character(1))
  con_casos <- con_casos[!duplicated(clave)]
  vapply(con_casos, function(h) {
    vars <- paste(h$variables, collapse = ", ")
    sprintf(
      paste0("La opción %s de %s no tiene rótulo en el instrumento y tiene %d %s: ",
             "sale como \"%s\". Escribe su rótulo en Codificación o en Analítica."),
      h$codigo, vars, h$n, if (h$n == 1L) "respuesta" else "respuestas",
      .graficos_sin_rotulo_texto(h$codigo)
    )
  }, character(1))
}

#' Avisos de la sesión (degrada a ninguno ante cualquier fallo).
#' @keywords internal
.graficos_opciones_sin_rotulo_avisos_session <- function(sid) {
  tryCatch({
    src <- .graficos_processing_sources(sid)
    .graficos_opciones_sin_rotulo_avisos(attr(src, "graficos_opciones_sin_rotulo"))
  }, error = function(e) character(0))
}
