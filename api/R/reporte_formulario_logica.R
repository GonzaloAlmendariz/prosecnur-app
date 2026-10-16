# Motor del formulario en papel — saltos y condiciones desde UN evaluador.
#
# Items 40, 41 y 46 (tercera tanda) con la regla vigente de
# `docs/qa/reglas-papel-numeracion-saltos-2026-10-15.md`. Antes el salto de una
# opcion era el destino del PRIMER `relevant` que la excluia («Sí, acepto ->
# Fin», «No -> P32» en CCSS) y el 29,7 % de los `relevant` (AND, OR,
# comparaciones) no se imprimia. Ahora:
#
#   - Un parser de expresiones XLSForm (`relevant`) a un arbol propio.
#   - Un evaluador con semantica ODK de TRES valores: una variable no preguntada
#     vale vacio (`=` y `selected()` dan FALSO, `!=` y `not(selected())`
#     VERDADERO); lo que depende de una respuesta no conocida queda DESCONOCIDO.
#   - De ese evaluador salen los saltos por opcion (§40), los saltos de salida
#     (§40.5) y las condiciones impresas (§41). Por construccion no se
#     contradicen (§41.6).
#   - El papel nunca pierde un filtro: lo que los saltos no cubren se imprime
#     como condicion en lenguaje llano, tambien en modo «saltos». Nunca XPath.
#   - Con origen de seleccion multiple nunca hay salto por opcion (§46): la
#     condicion va en la pregunta destino.

# --- parser ------------------------------------------------------------------

.form_logica_tokens <- function(x) {
  rx <- paste0(
    "\\$\\{[^}]*\\}|'[^']*'|\"[^\"]*\"|[0-9]+(?:\\.[0-9]+)?|",
    "!=|<=|>=|=|<|>|\\(|\\)|,|\\+|\\*|/|-|[A-Za-z_][A-Za-z0-9_:.-]*|\\.")
  m <- gregexpr(rx, x, perl = TRUE)[[1]]
  if (m[1] < 0) return(character(0))
  toks <- regmatches(x, list(m))[[1]]
  # Lo que no casa (caracteres sueltos) invalida la expresion.
  resto <- gsub(rx, "", x, perl = TRUE)
  if (nzchar(gsub("\\s+", "", resto))) attr(toks, "basura") <- TRUE
  toks
}

.form_logica_vars_texto <- function(x) {
  unique(gsub("^\\$\\{|\\}$", "", regmatches(x, gregexpr("\\$\\{[^}]*\\}", x))[[1]]))
}

# Arbol de un `relevant`. NULL si esta vacio. Si no se entiende, un nodo
# `opaco` con sus variables: el papel lo enuncia y avisa, nunca lo pierde.
.form_logica_parse <- function(expr) {
  x <- trimws(.form_pdf_chr(expr))
  if (!nzchar(x)) return(NULL)
  opaco <- list(k = "opaco", vars = .form_logica_vars_texto(x), raw = x)
  toks <- .form_logica_tokens(x)
  if (!length(toks) || isTRUE(attr(toks, "basura"))) return(opaco)
  pos <- 1L
  ver <- function() if (pos <= length(toks)) toks[pos] else ""
  tomar <- function() { t <- ver(); pos <<- pos + 1L; t }
  fallo <- function() stop("parse")
  primario <- function() {
    t <- ver()
    if (identical(t, "(")) { tomar(); e <- o(); if (!identical(tomar(), ")")) fallo(); return(e) }
    if (startsWith(t, "${")) { tomar(); return(list(k = "var", v = gsub("^\\$\\{|\\}$", "", t))) }
    if (grepl("^['\"]", t)) { tomar(); return(list(k = "lit", v = substr(t, 2L, nchar(t) - 1L))) }
    if (grepl("^[0-9]", t)) { tomar(); return(list(k = "lit", v = t)) }
    if (identical(t, "-") && grepl("^[0-9]", if (pos + 1L <= length(toks)) toks[pos + 1L] else "")) {
      tomar(); return(list(k = "lit", v = paste0("-", tomar())))
    }
    if (grepl("^[A-Za-z_]", t) && identical(if (pos + 1L <= length(toks)) toks[pos + 1L] else "", "(")) {
      fn <- tolower(tomar()); tomar()
      args <- list()
      if (!identical(ver(), ")")) {
        repeat { args[[length(args) + 1L]] <- o(); if (identical(ver(), ",")) tomar() else break }
      }
      if (!identical(tomar(), ")")) fallo()
      es_var <- function(a) identical(a$k, "var")
      if (identical(fn, "selected") && length(args) == 2L && es_var(args[[1]]) && identical(args[[2]]$k, "lit")) {
        return(list(k = "sel", var = args[[1]]$v, val = args[[2]]$v))
      }
      if (identical(fn, "not") && length(args) == 1L) return(list(k = "not", a = args[[1]]))
      if (identical(fn, "count-selected") && length(args) == 1L && es_var(args[[1]])) {
        return(list(k = "cnt", var = args[[1]]$v))
      }
      if (identical(fn, "string-length") && length(args) == 1L && es_var(args[[1]])) {
        return(list(k = "len", var = args[[1]]$v))
      }
      if (fn %in% c("true", "false") && !length(args)) return(list(k = "bool", v = identical(fn, "true")))
      return(list(k = "opaco", vars = unique(unlist(lapply(args, .form_logica_vars))), raw = fn))
    }
    fallo()
  }
  arit <- function() {
    a <- primario()
    while (ver() %in% c("+", "-", "*", "div", "mod", "/")) {
      tomar(); b <- primario()
      a <- list(k = "opaco", vars = unique(c(.form_logica_vars(a), .form_logica_vars(b))), raw = "arit")
    }
    a
  }
  cmp <- function() {
    a <- arit()
    if (ver() %in% c("=", "!=", "<", "<=", ">", ">=")) {
      op <- tomar(); b <- arit()
      return(list(k = "cmp", op = op, a = a, b = b))
    }
    a
  }
  y <- function() {
    a <- cmp(); args <- list(a)
    while (identical(tolower(ver()), "and")) { tomar(); args[[length(args) + 1L]] <- cmp() }
    if (length(args) == 1L) a else list(k = "and", args = args)
  }
  o <- function() {
    a <- y(); args <- list(a)
    while (identical(tolower(ver()), "or")) { tomar(); args[[length(args) + 1L]] <- y() }
    if (length(args) == 1L) a else list(k = "or", args = args)
  }
  res <- tryCatch({ e <- o(); if (pos <= length(toks)) fallo(); e }, error = function(e) NULL)
  res %||% opaco
}

.form_logica_vars <- function(a) {
  if (is.null(a)) return(character(0))
  switch(a$k,
    var = a$v, sel = a$var, cnt = a$var, len = a$var, opaco = a$vars %||% character(0),
    lit = character(0), bool = character(0),
    not = .form_logica_vars(a$a),
    cmp = unique(c(.form_logica_vars(a$a), .form_logica_vars(a$b))),
    and = , or = unique(unlist(lapply(a$args, .form_logica_vars))),
    character(0))
}

# Un solo atomo positivo `${v} = 'x'` o `selected(${v}, 'x')`. NULL si no.
.form_logica_atomo_simple <- function(a) {
  if (is.null(a)) return(NULL)
  if (identical(a$k, "sel")) return(list(var = a$var, valor = a$val, positivo = TRUE))
  if (identical(a$k, "cmp") && a$op %in% c("=", "!=") && identical(a$a$k, "var") && identical(a$b$k, "lit")) {
    return(list(var = a$a$v, valor = a$b$v, positivo = identical(a$op, "=")))
  }
  NULL
}

# --- evaluador de tres valores ---------------------------------------------------

# `estado(var)` devuelve list(e = "conocida" | "excluida" | "desconocida" |
# "verdadera", v = valor). "verdadera" = guarda tecnica que se asume cumplida.
.form_logica_eval <- function(a, estado) {
  if (is.null(a)) return(TRUE)
  k3 <- function(xs, op) {
    if (identical(op, "and")) { if (any(xs %in% FALSE)) return(FALSE); if (anyNA(xs)) return(NA); TRUE }
    else { if (any(xs %in% TRUE)) return(TRUE); if (anyNA(xs)) return(NA); FALSE }
  }
  valor <- function(n) {
    if (identical(n$k, "lit")) return(list(e = "conocida", v = n$v))
    if (identical(n$k, "var")) return(estado(n$v))
    if (n$k %in% c("cnt", "len")) {
      s <- estado(n$var)
      if (identical(s$e, "excluida")) return(list(e = "conocida", v = "0"))
      if (identical(s$e, "conocida")) {
        v <- if (identical(n$k, "len")) nchar(s$v) else as.integer(nzchar(s$v))
        return(list(e = "conocida", v = as.character(v)))
      }
      return(list(e = s$e, v = NA))
    }
    list(e = "desconocida", v = NA)
  }
  switch(a$k,
    bool = isTRUE(a$v),
    opaco = NA,
    var = { s <- estado(a$v); if (identical(s$e, "excluida")) FALSE else if (identical(s$e, "verdadera")) TRUE else NA },
    lit = nzchar(a$v),
    not = { r <- .form_logica_eval(a$a, estado); if (is.na(r)) NA else !r },
    and = k3(vapply(a$args, function(x) .form_logica_eval(x, estado), logical(1)), "and"),
    or = k3(vapply(a$args, function(x) .form_logica_eval(x, estado), logical(1)), "or"),
    sel = {
      s <- estado(a$var)
      if (identical(s$e, "excluida")) FALSE
      else if (identical(s$e, "verdadera")) TRUE
      else if (identical(s$e, "conocida")) identical(as.character(s$v), a$val)
      else NA
    },
    cmp = {
      x <- valor(a$a); y <- valor(a$b)
      if (identical(x$e, "verdadera") || identical(y$e, "verdadera")) return(TRUE)
      if (identical(x$e, "desconocida") || identical(y$e, "desconocida")) return(NA)
      xv <- if (identical(x$e, "excluida")) "" else as.character(x$v)
      yv <- if (identical(y$e, "excluida")) "" else as.character(y$v)
      if (a$op %in% c("=", "!=")) {
        xn <- suppressWarnings(as.numeric(xv)); yn <- suppressWarnings(as.numeric(yv))
        igual <- if (!is.na(xn) && !is.na(yn)) xn == yn else identical(xv, yv)
        return(if (identical(a$op, "=")) igual else !igual)
      }
      xn <- suppressWarnings(as.numeric(xv)); yn <- suppressWarnings(as.numeric(yv))
      if (is.na(xn) || is.na(yn)) return(FALSE)   # vacio: NaN en ODK, compara falso
      switch(a$op, "<" = xn < yn, "<=" = xn <= yn, ">" = xn > yn, ">=" = xn >= yn)
    },
    NA)
}

.form_logica_y <- function(a, b) {
  if (is.na(a) && is.na(b)) return(NA)
  if (isFALSE(a) || isFALSE(b)) return(FALSE)
  if (is.na(a) || is.na(b)) return(NA)
  TRUE
}

# --- contexto del instrumento ----------------------------------------------------

# Todo lo que el evaluador y el redactor necesitan saber de las filas.
.form_logica_contexto <- function(survey, choices_by_list, numeros, items, rol, control,
                                  matrix_keys, survey_completo = survey) {
  n <- nrow(survey)
  tipo <- vapply(survey$type, .form_pdf_type_base, character(1), USE.NAMES = FALSE)
  # Grupo padre (indice de su begin) y fin de cada grupo.
  padre <- rep(NA_integer_, n); fin <- seq_len(n); pila <- integer(0)
  for (i in seq_len(n)) {
    padre[i] <- if (length(pila)) pila[length(pila)] else NA_integer_
    if (tipo[i] %in% c("begin_group", "begin_repeat")) pila <- c(pila, i)
    if (tipo[i] %in% c("end_group", "end_repeat") && length(pila)) {
      fin[pila[length(pila)]] <- i; pila <- pila[-length(pila)]
    }
  }
  for (g in pila) fin[g] <- n
  # Etiqueta impresa de cada fila numerada (destinos): la pregunta, o la fila de
  # matriz (la 1a lleva el numero de la matriz).
  et <- rep("", n)
  for (i in seq_len(n)) {
    if (nzchar(matrix_keys[i])) {
      primera <- i == 1L || !identical(matrix_keys[i - 1L], matrix_keys[i])
      et[i] <- if (primera && nzchar(numeros[i])) numeros[i] else items[i]
    } else if (nzchar(numeros[i])) {
      et[i] <- numeros[i]
    }
  }
  nombres <- as.character(survey$name)
  tipos_completo <- stats::setNames(
    vapply(survey_completo$type, .form_pdf_type_base, character(1), USE.NAMES = FALSE),
    as.character(survey_completo$name))
  list(
    survey = survey, n = n, tipo = tipo, nombres = nombres,
    fila = stats::setNames(seq_len(n), nombres),
    lista = vapply(survey$type, .form_pdf_type_list, character(1), USE.NAMES = FALSE),
    asts = lapply(survey$relevant, .form_logica_parse),
    padre = padre, fin = fin, et = et, numerada = nzchar(et),
    rol = rol, control = control, matrix_keys = matrix_keys,
    choices = choices_by_list, tipos_completo = tipos_completo,
    etiqueta = as.character(survey$label)
  )
}

# Variables que se asumen verdaderas en el papel (§41.5): metadatos y guardas
# tecnicas. Calculados y referencias a notas NO: esos se enuncian con aviso.
.FORM_LOGICA_METADATOS <- c("start", "end", "today", "deviceid", "subscriberid", "simserial",
                            "phonenumber", "username", "email", "audit", "hidden")

.form_logica_es_tecnica <- function(ctx, var) {
  t <- ctx$tipos_completo[var]
  if (is.na(t)) return(TRUE)                  # no existe: dato, se asume y se avisa
  t %in% .FORM_LOGICA_METADATOS || grepl("collectorid|deviceid|_uuid|instanceid", var, ignore.case = TRUE)
}

# Estado de las filas con el origen `s` fijado al valor `v`. Vector logico:
# TRUE incluida, FALSE excluida, NA desconocida. Las filas anteriores a `s` son
# desconocidas (no se sabe que se respondio).
.form_logica_estados <- function(ctx, s, v) {
  n <- ctx$n
  st <- rep(NA, n)
  var_est <- list()
  var_est[[ctx$nombres[s]]] <- list(e = "conocida", v = v)
  estado <- function(var) {
    if (!is.null(var_est[[var]])) return(var_est[[var]])
    if (.form_logica_es_tecnica(ctx, var)) return(list(e = "verdadera", v = NA))
    list(e = "desconocida", v = NA)
  }
  if (s >= n) return(st)
  for (i in seq.int(s + 1L, n)) {
    if (ctx$tipo[i] %in% c("end_group", "end_repeat")) next
    propio <- .form_logica_eval(ctx$asts[[i]], estado)
    # Un grupo que abre antes del origen y contiene la fila tambien contiene al
    # origen: si se llego al origen, ese grupo esta incluido.
    grupo <- if (is.na(ctx$padre[i]) || ctx$padre[i] <= s) TRUE else st[ctx$padre[i]]
    st[i] <- .form_logica_y(grupo, propio)
    nm <- ctx$nombres[i]
    if (nzchar(nm) && is.null(var_est[[nm]]) && !identical(nm, ctx$nombres[s])) {
      var_est[[nm]] <- if (isFALSE(st[i])) list(e = "excluida", v = "") else list(e = "desconocida", v = NA)
    }
  }
  st
}

# Fin de la unidad que empieza en `i` (la matriz entera o el grupo).
.form_logica_fin_unidad <- function(ctx, i) {
  if (ctx$tipo[i] %in% c("begin_group", "begin_repeat")) return(ctx$fin[i])
  k <- ctx$matrix_keys[i]
  if (nzchar(k)) { j <- i; while (j + 1L <= ctx$n && identical(ctx$matrix_keys[j + 1L], k)) j <- j + 1L; return(j) }
  i
}

.form_logica_primera_numerada <- function(ctx, desde, st = NULL) {
  if (desde > ctx$n) return(NA_integer_)
  for (j in seq.int(desde, ctx$n)) {
    if (!ctx$numerada[j]) next
    if (!is.null(st) && isFALSE(st[j])) next
    return(j)
  }
  NA_integer_
}

.form_logica_texto_destino <- function(ctx, j) {
  if (is.na(j)) "Fin de la encuesta" else sprintf("pase a la pregunta %s", ctx$et[j])
}

# --- saltos (§40, §46) -----------------------------------------------------------

# Para cada origen `select_one` que algun `relevant` posterior nombra: estado de
# las filas por opcion y destino de cada opcion. Devuelve una lista por nombre
# de origen: list(fila, opciones = codigos, st = lista de vectores, destino).
.form_logica_origenes <- function(ctx) {
  nombrados <- unique(unlist(lapply(ctx$asts, .form_logica_vars)))
  out <- list()
  for (s in seq_len(ctx$n)) {
    nm <- ctx$nombres[s]
    if (!nzchar(nm) || !nm %in% nombrados) next
    if (!identical(ctx$tipo[s], "select_one") || !identical(ctx$rol[s], "pregunta")) next
    opts <- ctx$choices[[ctx$lista[s]]] %||% list()
    if (!length(opts)) next
    codigos <- vapply(opts, function(o) .form_pdf_chr(o$code), character(1))
    st <- lapply(codigos, function(v) .form_logica_estados(ctx, s, v))
    siguiente <- .form_logica_primera_numerada(ctx, s + 1L)
    destino <- vapply(st, function(x) {
      j <- .form_logica_primera_numerada(ctx, s + 1L, x)
      if (is.na(j)) NA_integer_ else j
    }, integer(1))
    out[[nm]] <- list(fila = s, opciones = codigos, st = stats::setNames(st, codigos),
                      destino = stats::setNames(destino, codigos), siguiente = siguiente)
  }
  out
}

# Texto del salto de cada opcion: solo si NO es la pregunta siguiente (§40.3).
.form_logica_saltos <- function(ctx, origenes) {
  skips <- list()
  for (nm in names(origenes)) {
    o <- origenes[[nm]]
    sk <- list()
    for (v in o$opciones) {
      d <- o$destino[[v]]
      if (!is.na(d) && !is.na(o$siguiente) && d == o$siguiente) next
      if (is.na(d) && is.na(o$siguiente)) next       # ultima pregunta: no hay a donde saltar
      sk[[v]] <- .form_logica_texto_destino(ctx, d)
    }
    if (length(sk)) skips[[nm]] <- sk
  }
  skips
}

# Salto de salida (§40.5): bajo una pregunta Q condicionada a un origen S, si la
# siguiente queda excluida para todas las opciones que llevan a Q.
.form_logica_salidas <- function(ctx, origenes) {
  out <- list()
  for (q in seq_len(ctx$n)) {
    if (!ctx$numerada[q] || is.null(ctx$asts[[q]])) next
    if (nzchar(ctx$matrix_keys[q]) && q > 1L && identical(ctx$matrix_keys[q - 1L], ctx$matrix_keys[q])) next
    vs <- .form_logica_vars(ctx$asts[[q]])
    if (length(vs) != 1L || is.null(origenes[[vs]])) next
    o <- origenes[[vs]]
    if (o$fila >= q) next
    dentro <- o$opciones[vapply(o$opciones, function(v) isTRUE(o$st[[v]][q]), logical(1))]
    if (!length(dentro) || length(dentro) == length(o$opciones)) next
    fq <- .form_logica_fin_unidad(ctx, q)
    r <- .form_logica_primera_numerada(ctx, fq + 1L)
    if (is.na(r)) next
    if (!all(vapply(dentro, function(v) isFALSE(o$st[[v]][r]), logical(1)))) next
    # Destino COMUN: el primero no excluido tiene que ser el mismo para todas
    # las opciones que llevan a Q. Si divergen (MDV: tras P49 la opcion 2 sigue
    # en P53 y las demas en P56), un salto unico mandaria a alguna al sitio
    # equivocado: no se imprime, y las condiciones de las siguientes resuelven.
    dests <- vapply(dentro, function(v) {
      d <- .form_logica_primera_numerada(ctx, fq + 1L, o$st[[v]]); if (is.na(d)) -1L else d
    }, integer(1))
    if (length(unique(dests)) != 1L) next
    pk <- if (dests[1] < 0L) NA_integer_ else dests[1]
    txt <- .form_logica_texto_destino(ctx, pk)
    out[[ctx$nombres[q]]] <- paste0(toupper(substring(txt, 1, 1)), substring(txt, 2))
  }
  out
}

# --- condiciones (§41) -----------------------------------------------------------

# Reduce un arbol para imprimirlo: quita guardas tecnicas (verdaderas) y, en
# modo saltos, los atomos sobre un origen que los saltos ya resuelven en esta
# fila (`implicado(var, atomo)`). Devuelve el arbol, TRUE (nada que imprimir) o
# FALSE.
.form_logica_reducir <- function(a, ctx, implicado = function(at) FALSE, avisos = NULL) {
  if (is.null(a)) return(TRUE)
  red <- function(x) {
    if (x$k %in% c("and", "or")) {
      hijos <- lapply(x$args, red)
      if (identical(x$k, "and")) {
        if (any(vapply(hijos, isFALSE, logical(1)))) return(FALSE)
        hijos <- Filter(function(h) !isTRUE(h), hijos)
        if (!length(hijos)) return(TRUE)
      } else {
        if (any(vapply(hijos, isTRUE, logical(1)))) return(TRUE)
        hijos <- Filter(function(h) !isFALSE(h), hijos)
        if (!length(hijos)) return(FALSE)
      }
      if (length(hijos) == 1L) return(hijos[[1]])
      x$args <- hijos
      return(x)
    }
    if (identical(x$k, "not")) {
      h <- red(x$a); if (isTRUE(h)) return(FALSE); if (isFALSE(h)) return(TRUE); x$a <- h; return(x)
    }
    if (identical(x$k, "bool")) return(isTRUE(x$v))
    vs <- .form_logica_vars(x)
    if (length(vs) && all(vapply(vs, function(v) .form_logica_es_tecnica(ctx, v), logical(1)))) {
      if (!is.null(avisos)) avisos$tecnicas <- unique(c(avisos$tecnicas, vs))
      return(TRUE)
    }
    if (isTRUE(implicado(x))) return(TRUE)
    x
  }
  red(a)
}

.form_logica_cita <- function(x) paste0("«", x, "»")

.form_logica_opcion <- function(ctx, var, cod, multiple = FALSE) {
  i <- ctx$fila[var]
  lbl <- ""
  if (!is.na(i)) for (o in ctx$choices[[ctx$lista[i]]] %||% list()) {
    if (identical(.form_pdf_chr(o$code), cod)) { lbl <- .form_pdf_clean_text_safe(o$label %||% ""); break }
  }
  if (multiple) {
    if (nzchar(lbl)) sprintf("%s (%s)", .form_logica_cita(lbl), cod) else .form_logica_cita(cod)
  } else {
    if (nzchar(lbl)) sprintf("%s %s", cod, .form_logica_cita(lbl)) else cod
  }
}

# Como se nombra una variable en una condicion impresa (nunca `${...}`).
.form_logica_ref <- function(ctx, var, desde = NA_integer_, avisos = NULL) {
  i <- ctx$fila[var]
  if (is.na(i)) return(.form_logica_cita(var))
  if (nzchar(ctx$et[i])) {
    if (!is.na(desde) && i > desde && !is.null(avisos)) avisos$posteriores <- unique(c(avisos$posteriores, var))
    return(.form_num_ref(ctx$et[i]))
  }
  if (nzchar(ctx$control[i])) return(ctx$control[i])
  lbl <- .form_pdf_clean_text(ctx$etiqueta[i])
  t <- ctx$tipo[i]
  if (!is.null(avisos)) {
    if (identical(t, "calculate") && !nzchar(lbl)) avisos$calculados <- unique(c(avisos$calculados, var))
    else if (t %in% c("note", "begin_group", "begin_repeat")) avisos$notas <- unique(c(avisos$notas, var))
  }
  .form_logica_cita(if (nzchar(lbl)) lbl else var)
}

.form_logica_es_multiple <- function(ctx, var) {
  i <- ctx$fila[var]; !is.na(i) && identical(ctx$tipo[i], "select_multiple")
}

# Lenguaje llano de un arbol reducido (§41.3).
.form_logica_redactar <- function(a, ctx, desde = NA_integer_, avisos = NULL) {
  ref <- function(v) .form_logica_ref(ctx, v, desde, avisos)
  num_txt <- function(x) .form_pdf_chr(x)
  atomo_igual <- function(var, vals) {
    if (.form_logica_es_multiple(ctx, var)) {
      sprintf("en %s marcó %s", ref(var),
              paste(vapply(vals, function(v) .form_logica_opcion(ctx, var, v, TRUE), ""), collapse = " o "))
    } else {
      sprintf("%s = %s", ref(var), paste(vapply(vals, function(v) .form_logica_opcion(ctx, var, v), ""), collapse = " o "))
    }
  }
  r <- function(x, nivel = 0L) {
    switch(x$k,
      sel = atomo_igual(x$var, x$val),
      en = atomo_igual(x$var, x$vals),
      cmp = {
        if (identical(x$a$k, "var") && identical(x$b$k, "lit")) {
          v <- x$a$v; lit <- x$b$v
          if (!nzchar(lit)) return(if (identical(x$op, "!=")) sprintf("respondió %s", ref(v))
                                    else sprintf("no respondió %s", ref(v)))
          i <- ctx$fila[v]
          con_lista <- !is.na(i) && ctx$tipo[i] %in% c("select_one", "select_multiple")
          switch(x$op,
            "=" = if (con_lista) atomo_igual(v, lit) else sprintf("%s = %s", ref(v), lit),
            "!=" = if (con_lista) sprintf("%s distinto de %s", ref(v), .form_logica_opcion(ctx, v, lit))
                   else sprintf("%s distinto de %s", ref(v), lit),
            ">=" = sprintf("%s es %s o más", ref(v), lit),
            ">" = sprintf("%s es mayor que %s", ref(v), lit),
            "<=" = sprintf("%s es %s o menos", ref(v), lit),
            "<" = sprintf("%s es menor que %s", ref(v), lit))
        } else if (x$a$k %in% c("cnt", "len") && identical(x$b$k, "lit")) {
          v <- x$a$var; n <- num_txt(x$b$v)
          if (identical(x$a$k, "len")) {
            if ((x$op %in% c(">", "!=") && n == "0") || (identical(x$op, ">=") && n == "1")) return(sprintf("respondió %s", ref(v)))
            if (x$op %in% c("=", "<=") && n == "0") return(sprintf("no respondió %s", ref(v)))
          }
          que <- if (identical(x$a$k, "cnt")) "opciones" else "caracteres"
          switch(x$op,
            ">=" = sprintf("en %s marcó %s o más %s", ref(v), n, que),
            ">" = sprintf("en %s marcó más de %s %s", ref(v), n, que),
            "<=" = sprintf("en %s marcó %s o menos %s", ref(v), n, que),
            "<" = sprintf("en %s marcó menos de %s %s", ref(v), n, que),
            "=" = sprintf("en %s marcó exactamente %s %s", ref(v), n, que),
            "!=" = sprintf("en %s no marcó exactamente %s %s", ref(v), n, que))
        } else if (identical(x$a$k, "var") && identical(x$b$k, "var")) {
          ops <- c("=" = "igual a", "!=" = "distinto de", ">" = "mayor que", ">=" = "mayor o igual que",
                   "<" = "menor que", "<=" = "menor o igual que")
          sprintf("%s es %s %s", ref(x$a$v), ops[[x$op]], ref(x$b$v))
        } else {
          r(list(k = "opaco", vars = .form_logica_vars(x)), nivel)
        }
      },
      not = {
        h <- x$a
        if (identical(h$k, "sel")) {
          if (.form_logica_es_multiple(ctx, h$var)) sprintf("en %s NO marcó %s", ref(h$var), .form_logica_opcion(ctx, h$var, h$val, TRUE))
          else sprintf("%s distinto de %s", ref(h$var), .form_logica_opcion(ctx, h$var, h$val))
        } else sprintf("NO se cumple que (%s)", r(h, 0L))
      },
      and = {
        partes <- vapply(x$args, function(h) { t <- r(h, 1L); if (identical(h$k, "or")) paste0("(", t, ")") else t }, "")
        paste(partes, collapse = " y ")
      },
      or = {
        partes <- vapply(x$args, function(h) { t <- r(h, 1L); if (identical(h$k, "and")) paste0("(", t, ")") else t }, "")
        paste(partes, collapse = " o ")
      },
      var = sprintf("respondió %s", ref(x$v)),
      opaco = {
        if (!is.null(avisos)) avisos$opacas <- unique(c(avisos$opacas, paste(x$vars, collapse = ",")))
        vs <- x$vars %||% character(0)
        if (length(vs)) sprintf("se cumple la condición del instrumento sobre %s (ver aviso)",
                                paste(vapply(vs, ref, ""), collapse = " y "))
        else "se cumple la condición del instrumento (ver aviso)"
      },
      lit = .form_logica_cita(x$v),
      "")
  }
  r(.form_logica_agrupar(a, ctx))
}

# §41.1: OR de igualdades o `selected()` sobre UNA variable -> conjunto; AND de
# `!=` / `not(selected())` sobre una variable con lista -> conjunto complemento.
.form_logica_agrupar <- function(a, ctx) {
  if (!a$k %in% c("and", "or")) return(a)
  a$args <- lapply(a$args, .form_logica_agrupar, ctx = ctx)
  igualdad <- function(x) {
    at <- .form_logica_atomo_simple(x)
    if (!is.null(at) && isTRUE(at$positivo)) at else NULL
  }
  distinto <- function(x) {
    if (identical(x$k, "not") && identical(x$a$k, "sel")) return(list(var = x$a$var, valor = x$a$val))
    at <- .form_logica_atomo_simple(x)
    if (!is.null(at) && !isTRUE(at$positivo)) at else NULL
  }
  if (identical(a$k, "or")) {
    ats <- lapply(a$args, igualdad)
    if (all(!vapply(ats, is.null, logical(1)))) {
      vs <- unique(vapply(ats, `[[`, "", "var"))
      if (length(vs) == 1L) return(list(k = "en", var = vs, vals = unique(vapply(ats, `[[`, "", "valor"))))
    }
  } else {
    ats <- lapply(a$args, distinto)
    if (length(ats) >= 2L && all(!vapply(ats, is.null, logical(1)))) {
      vs <- unique(vapply(ats, `[[`, "", "var"))
      i <- ctx$fila[vs[1]]
      if (length(vs) == 1L && !is.na(i) && identical(ctx$tipo[i], "select_one")) {
        cods <- vapply(ctx$choices[[ctx$lista[i]]] %||% list(), function(o) .form_pdf_chr(o$code), "")
        resto <- setdiff(cods, vapply(ats, `[[`, "", "valor"))
        if (length(resto)) return(list(k = "en", var = vs, vals = resto))
      }
    }
  }
  a
}

# TRUE si toda vez que el papel llega a la fila `i` ya paso por `s` preguntandola:
# `s` sin condicion propia y sus grupos condicionados envuelven tambien a `i`.
.form_logica_siempre_preguntada <- function(ctx, s, i) {
  if (!is.null(ctx$asts[[s]])) return(FALSE)
  anc_i <- integer(0); g <- ctx$padre[i]
  while (!is.na(g)) { anc_i <- c(anc_i, g); g <- ctx$padre[g] }
  g <- ctx$padre[s]
  while (!is.na(g)) {
    if (!is.null(ctx$asts[[g]]) && !g %in% anc_i) return(FALSE)
    g <- ctx$padre[g]
  }
  TRUE
}

# --- orquestador ------------------------------------------------------------------

# Calcula saltos, saltos de salida y condiciones del instrumento.
#   modo        "saltos" | "condiciones"
#   consent_var en «condiciones», la condicion de consentimiento no se enuncia
# Devuelve list(skips = nombre -> list(codigo -> texto), salidas = nombre ->
# texto, condiciones = texto por fila, arboles = arbol reducido por fila (para el
# simulador), avisos).
.form_pdf_logica <- function(ctx, modo = "saltos", consent_var = "") {
  avisos <- new.env()
  saltos_on <- identical(modo, "saltos")
  origenes <- if (saltos_on) .form_logica_origenes(ctx) else list()
  skips <- if (saltos_on) .form_logica_saltos(ctx, origenes) else list()
  salidas <- if (saltos_on) .form_logica_salidas(ctx, origenes) else list()

  n <- ctx$n
  conds <- rep("", n); arboles <- vector("list", n); reducidos <- vector("list", n)
  # Un atomo sobre un origen esta implicado en la fila `i` si toda opcion que lo
  # hace falso salta mas alla de `i` (o a Fin): por el papel no se llega aqui.
  implicado_en <- function(i) function(x) {
    if (!saltos_on) return(FALSE)
    vs <- .form_logica_vars(x)
    if (length(vs) != 1L || is.null(origenes[[vs]])) return(FALSE)
    o <- origenes[[vs]]
    if (o$fila >= i) return(FALSE)
    # El origen tiene que haberse preguntado siempre que se llega a `i`: si el
    # mismo puede saltarse (tiene condicion propia, o un grupo condicionado que
    # no envuelve tambien a `i`), queda vacio y el papel llegaria a `i` sin
    # instruccion (MedVida: P127 condicionada y P128 dependiente de P127).
    if (!.form_logica_siempre_preguntada(ctx, o$fila, i)) return(FALSE)
    fin_i <- .form_logica_fin_unidad(ctx, i)
    for (v in o$opciones) {
      ok <- .form_logica_eval(x, function(var) if (identical(var, vs)) list(e = "conocida", v = v) else list(e = "desconocida", v = NA))
      if (isTRUE(ok)) next
      if (is.na(ok)) return(FALSE)
      d <- o$destino[[v]]
      # El salto de la opcion tiene que existir y caer despues de la unidad.
      if (!is.na(d) && d <= fin_i) return(FALSE)
      if (is.null(skips[[vs]][[v]])) return(FALSE)
    }
    TRUE
  }
  for (i in seq_len(n)) {
    if (is.null(ctx$asts[[i]])) next
    if (ctx$tipo[i] %in% c("end_group", "end_repeat") || identical(ctx$rol[i], "omitida")) next
    red <- .form_logica_reducir(ctx$asts[[i]], ctx, implicado_en(i), avisos)
    if (isTRUE(red)) next
    if (isFALSE(red)) red <- list(k = "bool", v = FALSE)
    if (!saltos_on && nzchar(consent_var) && consent_var %in% .form_logica_vars(red)) next
    reducidos[[i]] <- red
  }
  clave <- function(x) if (is.null(x)) "" else paste(deparse(x), collapse = "")
  for (i in seq_len(n)) {
    red <- reducidos[[i]]
    if (is.null(red)) next
    # Heredada de su grupo: el grupo ya la enuncia.
    g <- ctx$padre[i]; heredada <- FALSE
    while (!is.na(g)) { if (identical(clave(reducidos[[g]]), clave(red))) { heredada <- TRUE; break }; g <- ctx$padre[g] }
    if (heredada) next
    arboles[[i]] <- red
  }
  # Cubierta por los saltos (§41.2): lo que los saltos resuelven ya salio del
  # reducido (quedo TRUE). Lo que queda se imprime. Corridas de preguntas
  # numeradas seguidas con la misma condicion -> una sola, con alcance cerrado.
  alcance <- vector("list", n)
  ref_destino <- function(d) if (is.na(d)) "termine la encuesta" else paste("pase a", .form_num_ref(ctx$et[d]))
  i <- 1L
  while (i <= n) {
    red <- arboles[[i]]
    key <- ctx$matrix_keys[i]
    if (nzchar(key)) {
      # Matriz: si todas sus filas comparten condicion, va a la matriz; si no,
      # cada fila lleva la suya.
      fin_m <- .form_logica_fin_unidad(ctx, i)
      filas <- seq.int(i, fin_m)
      claves <- vapply(filas, function(r) clave(arboles[[r]]), "")
      if (length(unique(claves)) == 1L) {
        if (nzchar(claves[1])) {
          conds[i] <- sprintf("FILTRO \u2014 Aplique s\u00f3lo si %s.", .form_logica_redactar(arboles[[i]], ctx, i, avisos))
          alcance[[i]] <- c(i, fin_m)
        }
      } else {
        for (r in filas) if (nzchar(claves[r - i + 1L])) {
          conds[r] <- sprintf("Aplique s\u00f3lo si %s.", .form_logica_redactar(arboles[[r]], ctx, r, avisos))
          alcance[[r]] <- c(r, r)
        }
      }
      i <- fin_m + 1L
      next
    }
    if (is.null(red)) { i <- i + 1L; next }
    es_grupo <- ctx$tipo[i] %in% c("begin_group", "begin_repeat")
    fin_i <- .form_logica_fin_unidad(ctx, i)
    texto <- .form_logica_redactar(red, ctx, i, avisos)
    if (es_grupo) {
      d <- .form_logica_primera_numerada(ctx, fin_i + 1L)
      conds[i] <- sprintf("FILTRO \u2014 Aplique este m\u00f3dulo s\u00f3lo si %s; si no, %s.", texto, ref_destino(d))
      alcance[[i]] <- c(i, fin_i)
      i <- i + 1L
      next
    }
    j <- fin_i; ultimo <- i
    if (ctx$numerada[i]) {
      repeat {
        sig <- .form_logica_primera_numerada(ctx, j + 1L)
        if (is.na(sig) || nzchar(ctx$matrix_keys[sig])) break
        hay_otra <- FALSE
        if (sig > j + 1L) for (m in seq.int(j + 1L, sig - 1L)) {
          if (!ctx$tipo[m] %in% c("calculate", "hidden", "")) { hay_otra <- TRUE; break }
        }
        if (hay_otra || !identical(clave(arboles[[sig]]), clave(red))) break
        arboles[sig] <- list(NULL)
        ultimo <- sig; j <- sig
      }
    }
    if (ultimo > i) {
      d <- .form_logica_primera_numerada(ctx, j + 1L)
      conds[i] <- sprintf("FILTRO \u2014 Aplique %s a %s s\u00f3lo si %s. Si no, %s.",
                          .form_num_ref(ctx$et[i]), .form_num_ref(ctx$et[ultimo]), texto, ref_destino(d))
    } else {
      conds[i] <- sprintf("FILTRO \u2014 Aplique s\u00f3lo si %s.", texto)
    }
    alcance[[i]] <- c(i, ultimo)
    i <- j + 1L
  }

  av <- character(0)
  if (length(avisos$tecnicas)) av <- c(av, sprintf(
    "Condiciones tecnicas que el papel asume cumplidas (metadatos o variables que no existen): %s.",
    paste(avisos$tecnicas, collapse = ", ")))
  if (length(avisos$calculados)) av <- c(av, sprintf(
    "AVISO BLOQUEANTE: condiciones que dependen de calculos sin rotulo (%s); el papel las nombra por su variable. Agregue un rotulo al calculo.",
    paste(avisos$calculados, collapse = ", ")))
  if (length(avisos$notas)) av <- c(av, sprintf(
    "Condiciones que apuntan a una nota o a un grupo, que no tienen respuesta (dato del instrumento): %s.",
    paste(avisos$notas, collapse = ", ")))
  if (length(avisos$posteriores)) av <- c(av, sprintf(
    "Condiciones que dependen de una pregunta posterior: %s.", paste(avisos$posteriores, collapse = ", ")))
  if (length(avisos$opacas)) av <- c(av, sprintf(
    "Condiciones que el papel no puede traducir y enuncia de forma general: sobre %s.",
    paste(avisos$opacas, collapse = "; ")))
  list(skips = skips, salidas = salidas, condiciones = conds, arboles = arboles,
       alcance = alcance, origenes = origenes, avisos = av)
}
