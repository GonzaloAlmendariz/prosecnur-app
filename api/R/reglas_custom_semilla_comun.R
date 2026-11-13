# =============================================================================
# Sugeridas al mirar la base: piezas comunes de los sembradores por contenido
# =============================================================================
# Los sembradores de este grupo (baterías, fechas, horas, lugar, repetidos y
# atributos del recopilador; ítem 51 del checklist del practicante) proponen
# reglas propias de los tipos que ya existen, armadas y listas para "Añadir".
# Ninguno nombra columnas de un estudio: deciden por el contenido de la base,
# por el formulario y, en las horas, por palabras de oficio en el nombre
# ("inicio", "fin").
#
# Cifra de cada propuesta: `semilla$n_casos_hoy`, los casos que la regla
# marca sobre la base cargada. Sale del motor (`bridge_regla_custom()` y
# `evaluate_validation_bundle()`), el mismo camino que la auditoría, así que el
# número que ve el practicante antes de añadirla es el que verá después.
# Base: `semilla$n_casos`, filas de la base cargada. Nivel: el caso (la fila de
# la tabla principal). Sin ponderación.
#
# Tope de marcas: una propuesta que marca más del 30 % de los casos
# (`.SEMILLA_TOPE_MARCAS`) no es una rareza sino un patrón del estudio, o la
# regla está mal armada para esa base. No se descarta en silencio: va con
# `semilla$para_revisar = TRUE` y su causa en `semilla$causa_revision`, y la
# lista la muestra al final, rotulada "Para revisar".
# =============================================================================

.SEMILLA_TOPE_MARCAS <- 0.30

# Porcentaje con un decimal y punto: "52.6 %".
.semilla_pct <- function(k, n) {
  if (!is.finite(n) || n <= 0) return("")
  paste0(formatC(100 * k / n, format = "f", digits = 1), " %")
}

.semilla_plural <- function(n, uno, varios) if (identical(as.integer(n), 1L)) uno else varios

# Una etiqueta dentro de una frase: "Distrito" pasa a "distrito"; una sigla
# ("DNI del supervisor") o un código se dejan como están.
.semilla_en_frase <- function(x) {
  x <- as.character(x)
  minus <- grepl("^[[:upper:]][[:lower:]]", x)
  substr(x[minus], 1, 1) <- tolower(substr(x[minus], 1, 1))
  x
}

# "421 casos" / "1 caso".
.semilla_casos_txt <- function(n) sprintf("%d %s", as.integer(n), .semilla_plural(n, "caso", "casos"))

# ¿Ya hay una regla de este tipo sobre exactamente estas preguntas? Para los
# tipos cuyas preguntas viajan en `params` (catálogo, moda, fechas) se comparan
# las preguntas efectivas de la regla. Con `patron`, solo cuenta una regla con
# ese mismo `params$patron` (orden y duración sobre las mismas horas son dos
# reglas distintas).
.semilla_ya_cubierta_conjunto <- function(reglas, tipo, variables, patron = NULL) {
  variables <- sort(unique(as.character(variables)))
  for (r in reglas %||% list()) {
    if (!identical(as.character(r$tipo %||% "")[1], tipo)) next
    if (!is.null(patron) && !identical(as.character((r$params %||% list())$patron %||% "")[1], patron)) next
    vars <- tryCatch(.regla_variables_efectivas(r), error = function(e) character(0))
    if (setequal(sort(unique(as.character(vars))), variables)) return(TRUE)
  }
  FALSE
}

# Columnas que ningún sembrador por contenido mira: internas de la carga,
# metadatos de plataforma y columnas con "/" (repeats aplanados).
.semilla_columnas_mirables <- function(data) {
  nms <- names(data)
  fuera <- startsWith(nms, ".") | startsWith(nms, "_") | grepl("/", nms, fixed = TRUE) |
    tolower(nms) %in% tolower(c(.VDC_METADATOS, .semilla_fecha_plataforma))
  nms[!fuera]
}

# Valores con dato como texto, sin espacios en los bordes; NA donde no hay dato.
# Un número leído como doble ("12345.0") vuelve a su forma entera.
.semilla_texto <- function(x) {
  v <- if (is.numeric(x)) ifelse(is.na(x), NA_character_, format(x, scientific = FALSE, trim = TRUE, drop0trailing = TRUE))
       else trimws(as.character(unclass(x)))
  v[is.na(v) | !nzchar(v) | v == "NA"] <- NA_character_
  sub("^(-?[0-9]+)[.]0+$", "\\1", v)
}

#' Casos que marcan las reglas propuestas, contados con el motor
#'
#' Una sola evaluación para todas: cada propuesta se pasa por el puente de
#' reglas propias y se evalúa sobre la base, como en la auditoría.
#'
#' @param data data.frame de la base cargada (una fila por caso).
#' @param props lista de reglas propuestas.
#' @return entero por propuesta; NA si el motor no pudo evaluarla (la causa
#'   queda en el atributo `errores`).
#' @keywords internal
.semilla_contar_con_motor <- function(data, props) {
  n <- length(props)
  out <- rep(NA_integer_, n)
  errores <- rep(NA_character_, n)
  if (!n || !is.data.frame(data) || !nrow(data)) return(structure(out, errores = errores))
  reglas <- vector("list", n)
  for (i in seq_len(n)) {
    r <- props[[i]]
    r$id <- sprintf("SEMILLA_%03d", i)
    r$activa <- TRUE
    r$hallazgo_kind <- r$hallazgo_kind %||% "inconsistencia"
    reglas[[i]] <- tryCatch(bridge_regla_custom(r), error = function(e) {
      errores[i] <<- conditionMessage(e)
      NULL
    })
  }
  ok <- which(!vapply(reglas, is.null, logical(1)))
  if (!length(ok)) return(structure(out, errores = errores))
  ev <- tryCatch(
    evaluate_validation_bundle(bundle = list(rules = reglas[ok]), data_input = data, strict = FALSE),
    error = function(e) {
      errores[ok] <<- conditionMessage(e)
      NULL
    })
  if (is.null(ev)) return(structure(out, errores = errores))
  for (i in ok) {
    f <- ev$datos[[reglas[[i]]$flag_name]]
    if (is.null(f)) {
      errores[i] <- "el motor no devolvió la marca de la regla"
      next
    }
    f[is.na(f)] <- FALSE
    out[i] <- as.integer(sum(as.logical(f)))
  }
  structure(out, errores = errores)
}

#' Cifra y tope de marcas de las propuestas por contenido
#'
#' Cuenta con el motor, quita las que no marcan nada (sin evidencia en la base
#' no se propone, igual que los demás sembradores) y rotula "para revisar" las
#' que marcan más del tope. Una propuesta que el motor no puede evaluar no se
#' descarta en silencio: se avisa por `warning()` con su causa, que el router
#' deja en el log del backend, y no se ofrece (no se podría auditar).
#'
#' @param data data.frame de la base cargada.
#' @param props propuestas de un sembrador por contenido.
#' @param tope proporción máxima de casos marcados.
#' @return propuestas con `semilla$n_casos_hoy`, `semilla$n_casos` y, si pasan
#'   el tope, `semilla$para_revisar` y `semilla$causa_revision`.
#' @keywords internal
.semilla_con_cifra <- function(data, props, tope = .SEMILLA_TOPE_MARCAS) {
  if (!length(props)) return(list())
  n_base <- nrow(data)
  cuenta <- .semilla_contar_con_motor(data, props)
  errores <- attr(cuenta, "errores")
  out <- list()
  for (i in seq_along(props)) {
    p <- props[[i]]
    if (is.na(cuenta[i])) {
      warning(sprintf("Sugerida sin evaluar (%s): %s", p$nombre %||% "", errores[i] %||% "causa desconocida"),
              call. = FALSE)
      next
    }
    if (cuenta[i] == 0L) next
    p$semilla$n_casos_hoy <- cuenta[i]
    p$semilla$n_casos <- as.integer(n_base)
    if (cuenta[i] / n_base > tope) {
      p$semilla$para_revisar <- TRUE
      p$semilla$causa_revision <- sprintf(
        paste("Marca %d de %d casos (%s), más del %d %%: puede ser un patrón del estudio y no un error.",
              "Conviene revisar la regla antes de añadirla."),
        cuenta[i], n_base, .semilla_pct(cuenta[i], n_base), as.integer(round(100 * tope)))
    }
    out[[length(out) + 1L]] <- p
  }
  out
}

# --- Nombres para una persona --------------------------------------------------
# El título de una sugerida nombra la pregunta como la ve el practicante: su
# etiqueta corta (`.semilla_nombrar_var()`), el número de pregunta del
# cuestionario para una batería, nunca el código ni un formato de captura. El
# código aparece solo como dato secundario, entre paréntesis, en el porqué.

# "Fecha de entrevista (fecha_entrevista)"; solo el código si no hay etiqueta.
.semilla_nombrar_cod <- function(nombre, survey = NULL) {
  et <- .semilla_nombrar_var(nombre, survey)
  if (identical(et, as.character(nombre)[1])) et else sprintf("%s (%s)", et, nombre)
}

.semilla_unir_y <- function(x) {
  x <- as.character(x)
  if (length(x) <= 1L) return(paste(x, collapse = ""))
  paste(paste(utils::head(x, -1), collapse = ", "), "y", utils::tail(x, 1))
}

# Varias columnas en una frase: "distrito y ubigeo del distrito". Si todas las
# etiquetas comparten el encabezado antes de los dos puntos ("Lugar de
# nacimiento: región", "Lugar de nacimiento: provincia"), se dice una vez:
# "lugar de nacimiento (región y provincia)".
.semilla_nombrar_lista <- function(vars, survey = NULL) {
  et <- vapply(vars, .semilla_nombrar_var, character(1), survey = survey, USE.NAMES = FALSE)
  partes <- strsplit(et, ": ", fixed = TRUE)
  if (length(et) >= 2L && all(lengths(partes) == 2L)) {
    cab <- vapply(partes, `[`, character(1), 1L)
    if (length(unique(cab)) == 1L) {
      return(sprintf("%s (%s)", .semilla_en_frase(cab[1]),
                     .semilla_unir_y(vapply(partes, `[`, character(1), 2L))))
    }
  }
  .semilla_unir_y(.semilla_en_frase(et))
}

# Una batería por su número de pregunta: "P29, ítems 1 a 14" si los ítems son
# de una pregunta, "P11.1 a P14.5" si el bloque cruza preguntas. Sin número en
# las etiquetas, el enunciado común del grupo si es corto; en último caso el
# tramo de códigos. Devuelve `nombre` (para el título), `corto` (para una
# frase: "P29") y `codigos` (el tramo de códigos, dato secundario).
.semilla_nombrar_bateria <- function(vars, survey = NULL) {
  codigos <- if (length(vars) <= 3L) paste(vars, collapse = ", ") else sprintf("%s a %s", vars[1], vars[length(vars)])
  fallback <- list(nombre = codigos, corto = codigos, codigos = codigos)
  if (is.null(survey) || !is.data.frame(survey) || !all(c("name", "label") %in% names(survey))) return(fallback)
  fila <- match(c(vars[1], vars[length(vars)]), survey$name)
  if (anyNA(fila)) return(fallback)
  num <- lapply(as.character(survey$label[fila]), function(l)
    regmatches(l, regexec("^\\s*[Pp]\\s*([0-9]+)\\s*[._]\\s*([0-9]+)", l))[[1]])
  if (all(lengths(num) == 3L)) {
    a <- num[[1]]; b <- num[[2]]
    if (identical(a[2], b[2])) {
      return(list(nombre = sprintf("P%s, %s %s a %s", a[2], "ítems", a[3], b[3]),
                  corto = sprintf("P%s", a[2]), codigos = codigos))
    }
    nom <- sprintf("P%s.%s a P%s.%s", a[2], a[3], b[2], b[3])
    return(list(nombre = nom, corto = nom, codigos = codigos))
  }
  if ("group_label" %in% names(survey)) {
    g <- unique(as.character(survey$group_label[fila]))
    if (length(g) == 1L && !is.na(g) && nzchar(g) && nchar(g) <= .semilla_etiqueta_max && !grepl("[?¿]", g)) {
      return(list(nombre = g, corto = g, codigos = codigos))
    }
  }
  fallback
}
