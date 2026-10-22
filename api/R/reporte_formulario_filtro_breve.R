# Redaccion BREVE de los filtros del formulario en papel (HSyVbG 2026,
# 2026-10-22: «los filtros citan la pregunta completa entre comillas»).
#
# El evaluador de reporte_formulario_logica.R decide QUE condicion se imprime;
# este archivo solo decide COMO se escribe. Nada cambia de significado: la misma
# condicion logica, los mismos destinos. Lo que cambia:
#
#   - Una pregunta se nombra por su numero (P12), nunca por su texto.
#   - Las preguntas de INICIO (las select_one sin numero que van antes de la
#     primera pregunta numerada: consentimiento y filtro de elegibilidad) no
#     tienen numero; se nombran por su papel: «las preguntas de consentimiento y
#     de filtro». Si la condicion nombra solo algunas, por su orden («la segunda
#     pregunta de consentimiento»): nunca se dice «todas» sin que lo sean.
#   - Varias igualdades a la misma opcion se juntan: «respondió Sí en alguna de
#     P29.2 a P29.10» (O), «no respondió Sí en ninguna de P29.2 a P29.10» (Y de
#     distintos). El rango solo se escribe si es CONTIGUO (todas las preguntas
#     numeradas entre la primera y la ultima estan en la condicion); si no, se
#     enumeran.
#   - Comillas rectas, y solo cuando la etiqueta tiene mas de una palabra o
#     signos. Nada de comillas angulares, puntos medios ni rayas largas.
#
# Semantica ODK que la redaccion respeta: `${v} != 'x'` es VERDADERO si `v` no se
# pregunto; «no respondió Sí en P5» tambien lo es (no responder no es responder
# Sí). Por eso el «distinto de» se escribe en negativo y no como «respondió otra
# opcion».

# Cita de una etiqueta: comillas rectas solo si hacen falta.
.form_filtro_cita <- function(x) {
  x <- .form_pdf_chr(x)
  if (!nzchar(x)) return(x)
  if (grepl("^[[:alnum:]À-ɏ]+$", x, perl = TRUE)) x else paste0("\"", x, "\"")
}

# Etiqueta impresa de una opcion (o su codigo si no tiene etiqueta).
.form_filtro_opcion <- function(ctx, var, cod) {
  i <- ctx$fila[var]
  if (!is.na(i)) for (o in ctx$choices[[ctx$lista[i]]] %||% list()) {
    if (identical(.form_pdf_chr(o$code), cod)) {
      lbl <- .form_pdf_clean_text_safe(o$label %||% "")
      if (nzchar(lbl)) return(.form_filtro_cita(lbl))
      break
    }
  }
  .form_filtro_cita(cod)
}

.form_filtro_opciones <- function(ctx, var, cods) {
  .form_filtro_lista(vapply(cods, function(v) .form_filtro_opcion(ctx, var, v), ""), "o")
}

# «a», «a y b», «a, b y c».
.form_filtro_lista <- function(x, conj = "y") {
  x <- as.character(x)
  n <- length(x)
  if (n <= 1L) return(paste(x, collapse = ""))
  paste0(paste(x[-n], collapse = ", "), " ", conj, " ", x[n])
}

# --- preguntas de inicio ------------------------------------------------------

.FORM_FILTRO_ORDINALES <- c("primera", "segunda", "tercera", "cuarta", "quinta",
                            "sexta", "séptima", "octava", "novena", "décima")

.form_filtro_es_consentimiento <- function(ctx, i) {
  grepl("consent|consentimiento|asentimiento",
        paste(ctx$nombres[i], ctx$etiqueta[i]), ignore.case = TRUE)
}

# Filas de inicio: select_one sin numero antes de la primera fila numerada.
# Devuelve list(consentimiento = filas, filtro = filas).
.form_filtro_inicio <- function(ctx) {
  primera <- which(ctx$numerada)
  tope <- if (length(primera)) primera[1] - 1L else ctx$n
  filas <- seq_len(max(0L, tope))
  filas <- filas[ctx$tipo[filas] == "select_one" & !ctx$numerada[filas] &
                   !nzchar(ctx$control[filas])]
  es_c <- vapply(filas, function(i) .form_filtro_es_consentimiento(ctx, i), logical(1))
  list(consentimiento = filas[es_c], filtro = filas[!es_c])
}

# Nombre de un subconjunto de preguntas de inicio de un mismo papel.
.form_filtro_nombre_papel <- function(sub, todas, papel) {
  if (!length(sub)) return(character(0))
  if (length(todas) == 1L) return(sprintf("la pregunta de %s", papel))
  if (setequal(sub, todas)) return(sprintf("las preguntas de %s", papel))
  pos <- match(sort(sub), todas)
  ord <- vapply(pos, function(p) if (p <= length(.FORM_FILTRO_ORDINALES))
    .FORM_FILTRO_ORDINALES[p] else paste0("n.º ", p), "")
  sprintf("%s pregunta de %s", .form_filtro_lista(paste("la", ord)), papel)
}

# Nombre de un conjunto de preguntas de inicio. «las preguntas de consentimiento
# y de filtro» cuando la condicion las nombra todas.
.form_filtro_nombre_inicio <- function(ctx, filas) {
  ini <- .form_filtro_inicio(ctx)
  c_sub <- intersect(ini$consentimiento, filas)
  f_sub <- intersect(ini$filtro, filas)
  n_c <- .form_filtro_nombre_papel(c_sub, ini$consentimiento, "consentimiento")
  n_f <- .form_filtro_nombre_papel(f_sub, ini$filtro, "filtro")
  if (length(n_c) && length(n_f) && startsWith(n_c, "las preguntas de") &&
      (startsWith(n_f, "las preguntas de") || startsWith(n_f, "la pregunta de"))) {
    return(sprintf("las preguntas de consentimiento y de filtro"))
  }
  .form_filtro_lista(c(n_c, n_f))
}

.form_filtro_es_inicio <- function(ctx, var) {
  i <- ctx$fila[var]
  if (is.na(i)) return(FALSE)
  ini <- .form_filtro_inicio(ctx)
  i %in% c(ini$consentimiento, ini$filtro)
}

# --- referencias -----------------------------------------------------------------

# Referencia de varias preguntas numeradas: «P1», «P1 y P2», «P29.2 a P29.10»
# (contiguas) o «P1, P3 y P5». `vars` en cualquier orden; se ordenan por fila.
.form_filtro_refs <- function(ctx, filas) {
  filas <- sort(unique(filas))
  refs <- vapply(filas, function(i) .form_num_ref(ctx$et[i]), "")
  if (length(filas) >= 3L) {
    entre <- seq.int(filas[1], filas[length(filas)])
    entre <- entre[ctx$numerada[entre]]
    if (setequal(entre, filas)) return(list(texto = sprintf("%s a %s", refs[1], refs[length(refs)]),
                                            n = length(filas)))
  }
  list(texto = .form_filtro_lista(refs), n = length(filas))
}

# --- atomos agrupables -------------------------------------------------------------

# Igualdad / desigualdad sobre una select_one: list(var, vals, positivo). NULL si
# el nodo no es de esa forma.
.form_filtro_atomo <- function(x, ctx) {
  es_one <- function(v) { i <- ctx$fila[v]; !is.na(i) && identical(ctx$tipo[i], "select_one") }
  if (identical(x$k, "sel") && es_one(x$var)) return(list(var = x$var, vals = x$val, positivo = TRUE))
  if (identical(x$k, "en") && es_one(x$var)) return(list(var = x$var, vals = x$vals, positivo = TRUE))
  if (identical(x$k, "cmp") && x$op %in% c("=", "!=") && identical(x$a$k, "var") &&
      identical(x$b$k, "lit") && nzchar(x$b$v) && es_one(x$a$v)) {
    return(list(var = x$a$v, vals = x$b$v, positivo = identical(x$op, "=")))
  }
  if (identical(x$k, "not") && identical(x$a$k, "sel") && es_one(x$a$var)) {
    return(list(var = x$a$var, vals = x$a$val, positivo = FALSE))
  }
  NULL
}

# Frase de un grupo de atomos con la misma opcion y el mismo signo, unidos por
# `conector` ("and" / "or").
.form_filtro_frase_grupo <- function(ctx, ats, conector) {
  vars <- unique(vapply(ats, `[[`, "", "var"))
  filas <- unname(ctx$fila[vars])
  opcion <- .form_filtro_opciones(ctx, ats[[1]]$var, ats[[1]]$vals)
  positivo <- isTRUE(ats[[1]]$positivo)
  inicio <- filas[vapply(vars, function(v) .form_filtro_es_inicio(ctx, v), logical(1))]
  numeradas <- filas[ctx$numerada[filas]]
  otras <- setdiff(filas, c(inicio, numeradas))
  partes <- character(0)
  if (length(inicio)) partes <- c(partes, .form_filtro_nombre_inicio(ctx, inicio))
  n_items <- length(partes)
  if (length(numeradas)) {
    r <- .form_filtro_refs(ctx, numeradas)
    partes <- c(partes, r$texto); n_items <- n_items + r$n
  }
  if (length(otras)) {
    partes <- c(partes, vapply(otras, function(i) .form_filtro_cita(.form_pdf_clean_text(ctx$etiqueta[i])), ""))
    n_items <- n_items + length(otras)
  }
  # Un nombre de papel en plural («las preguntas de...») ya cuenta como varias.
  plural <- n_items > 1L || (length(inicio) > 1L)
  donde <- .form_filtro_lista(partes)
  if (!plural) {
    return(sprintf("%s %s en %s", if (positivo) "respondió" else "no respondió", opcion, donde))
  }
  if (positivo && identical(conector, "or")) return(sprintf("respondió %s en alguna de %s", opcion, donde))
  # Y de igualdades: «respondió Sí en P1 y P2», «en las preguntas de...».
  if (positivo) return(sprintf("respondió %s en %s", opcion, donde))
  if (identical(conector, "and")) return(sprintf("no respondió %s en ninguna de %s", opcion, donde))
  sprintf("no respondió %s en alguna de %s", opcion, donde)
}

# Redacta los hijos de un Y / un O juntando los atomos agrupables. `r_hijo` es la
# redaccion de un hijo suelto (la del redactor). Devuelve el vector de partes en
# el orden de aparicion (cada grupo, donde aparecio su primer miembro).
.form_filtro_partes <- function(args, conector, ctx, r_hijo) {
  ats <- lapply(args, .form_filtro_atomo, ctx = ctx)
  clave <- vapply(ats, function(a) {
    if (is.null(a)) return("")
    paste(a$positivo, paste(a$vals, collapse = "|"), sep = "#")
  }, "")
  # Un grupo solo existe con dos o mas miembros; un atomo solo va por r_hijo.
  tam <- table(clave[nzchar(clave)])
  hecho <- rep(FALSE, length(args))
  out <- character(0)
  for (k in seq_along(args)) {
    if (hecho[k]) next
    if (nzchar(clave[k]) && tam[[clave[k]]] >= 2L) {
      miembros <- which(clave == clave[k])
      hecho[miembros] <- TRUE
      out <- c(out, .form_filtro_frase_grupo(ctx, ats[miembros], conector))
    } else if (!is.null(ats[[k]])) {
      hecho[k] <- TRUE
      out <- c(out, .form_filtro_frase_grupo(ctx, ats[k], conector))
    } else {
      hecho[k] <- TRUE
      out <- c(out, r_hijo(args[[k]]))
    }
  }
  out
}

# Enunciado del filtro: «Filtro: aplique ... solo si <condicion>; si no, <destino>.»
.form_filtro_enunciado <- function(alcance = "", condicion, destino = "") {
  que <- if (nzchar(alcance)) paste0("aplique ", alcance, " ") else "aplique "
  txt <- sprintf("Filtro: %ssolo si %s", que, condicion)
  if (nzchar(destino)) txt <- paste0(txt, "; si no, ", destino)
  paste0(txt, ".")
}

# Une las partes de un Y / un O. Si alguna parte ya lleva el mismo conector
# dentro («consentimiento y de filtro»), el ultimo se separa con coma para que se
# lea donde termina cada condicion.
.form_filtro_unir <- function(partes, conj = "y") {
  n <- length(partes)
  if (n <= 1L) return(paste(partes, collapse = ""))
  if (any(grepl(paste0(" ", conj, " "), partes, fixed = TRUE))) {
    return(paste0(paste(partes[-n], collapse = ", "), ", ", conj, " ", partes[n]))
  }
  .form_filtro_lista(partes, conj)
}
