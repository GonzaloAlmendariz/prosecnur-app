# =============================================================================
# Regla propia "Formato de la respuesta" (tipo `formato`)
# =============================================================================
# Revisa cómo está escrita una respuesta, no su valor: un teléfono con 9
# dígitos que empiezan con 9, un ubigeo de 6 dígitos, un correo, o un patrón
# libre para quien sabe escribir expresiones regulares. Tres modos:
#
#   digitos    la respuesta está escrita solo con dígitos, con una cantidad
#              exacta o un rango (`largo_min`, `largo_max`, opcionales) y, si
#              se pide, empieza con alguno de `empieza_con`. Con
#              `sin_separadores` se quitan antes espacios, guiones, puntos y
#              paréntesis ("916 856 301" pasa).
#   correo     la respuesta tiene la forma nombre@dominio.algo.
#   expresion  la respuesta entera calza con `expresion` (expresión regular,
#              PCRE). Se compara la respuesta entera: no hace falta ^ ni $.
#
# La respuesta se revisa como texto aunque el formulario declare la pregunta
# como número: "080105" tiene 6 dígitos y "80105" tiene 5. Si la base ya trae
# la columna como número, el cero inicial se perdió al cargar y no se
# recupera; el conteo previo lo dice (`como_numero`).
#
# Una respuesta vacía no se marca (para eso está "Respuesta obligatoria").
#
# Grano: fila de la tabla principal (el caso). La cifra de la regla es la del
# motor: casos marcados sobre las filas que evalúa la auditoría (o las que
# cumplen el "Solo revisar cuando"); este archivo solo decide la marca de cada
# fila y su motivo.
#
# Una sola función mide (`.regla_formato_medir()`): el texto R que va al plan,
# a la auditoría y al script de limpieza es esa función escrita en línea
# (deparse); el conteo previo, la frase y Hallazgos la llaman directamente. La
# función no lleva ningún "=" ni argumentos con nombre (`evaluar_consistencia()`
# convierte "=" en "=="), y los textos que escribe el usuario (la expresión)
# viajan como códigos de carácter (`intToUtf8()`), para que la normalización
# del plan no toque sus "=", comillas o paréntesis.

.REGLA_FORMATO_MODOS <- c("digitos", "correo", "expresion")

# Motivos de una respuesta marcada, en el orden en que se revisan.
#   sin_digitos  no tiene ningún dígito ("NO QUISO DAR")
#   no_digitos   tiene dígitos y otros signos ("01-4567890", "16.45")
#   largo        solo dígitos, pero no la cantidad pedida
#   inicio       solo dígitos y la cantidad, pero no empieza como se pide
#   correo       no tiene la forma de un correo
#   expresion    no calza con el patrón

#' Mide el formato de cada respuesta de una pregunta
#'
#' @param x la columna.
#' @param modo "digitos", "correo" o "expresion".
#' @param largo_min,largo_max cantidad de dígitos admitida (NA = sin límite).
#' @param empieza prefijos admitidos (character(0) = cualquiera).
#' @param expresion expresión regular (modo "expresion").
#' @param sin_separadores si TRUE, se quitan espacios, guiones, puntos y
#'   paréntesis antes de revisar los dígitos.
#' @return lista con, por fila, `texto` (la respuesta como texto), `revisado`
#'   (lo que se revisa), `n_digitos`, `motivo` (NA si pasa o está vacía) y
#'   `marca`; además `como_numero` (la columna llegó como número).
#' @keywords internal
.regla_formato_medir <- function(x, modo, largo_min, largo_max, empieza, expresion, sin_separadores) {
  if (is.factor(x)) x <- as.character(x)
  como_numero <- is.numeric(x)
  if (como_numero) {
    entero <- !is.na(x) & is.finite(x) & x == round(x) & abs(x) < 1e15
    texto <- as.character(x)
    texto[entero] <- sprintf("%.0f", x[entero])
  } else {
    texto <- as.character(unclass(x))
  }
  texto <- trimws(texto)
  vacia <- is.na(texto) | texto %in% c("", "NA")
  texto[vacia] <- NA_character_
  revisado <- texto
  if (identical(modo, "digitos") && isTRUE(sin_separadores)) revisado <- gsub("[[:space:]().-]", "", revisado)
  n <- length(texto)
  motivo <- rep(NA_character_, n)
  n_digitos <- nchar(gsub("[^0-9]", "", texto))
  n_digitos[vacia] <- NA_integer_
  if (identical(modo, "digitos")) {
    solo <- !vacia & grepl("^[0-9]+$", revisado)
    largo <- nchar(revisado)
    fuera <- (!is.na(largo_min) & largo < largo_min) | (!is.na(largo_max) & largo > largo_max)
    inicio <- rep(TRUE, n)
    if (length(empieza)) {
      inicio <- rep(FALSE, n)
      for (p in empieza) inicio <- inicio | (!vacia & substr(revisado, 1L, nchar(p)) == p)
    }
    motivo[solo & !fuera & !inicio] <- "inicio"
    motivo[solo & fuera] <- "largo"
    motivo[!vacia & !solo & n_digitos > 0L] <- "no_digitos"
    motivo[!vacia & !solo & n_digitos == 0L] <- "sin_digitos"
  } else if (identical(modo, "correo")) {
    ok <- grepl("^[^@[:space:]]+@[^@[:space:]]+[.][^@.[:space:]]+$", revisado)
    motivo[!vacia & !ok] <- "correo"
  } else if (identical(modo, "expresion")) {
    ok <- grepl(paste0("^(?:", expresion, ")$"), revisado, FALSE, TRUE)
    motivo[!vacia & !ok] <- "expresion"
  } else {
    stop("modo de formato desconocido: ", modo)
  }
  marca <- !is.na(motivo)
  stats::setNames(list(texto, revisado, n_digitos, motivo, marca, como_numero),
                  c("texto", "revisado", "n_digitos", "motivo", "marca", "como_numero"))
}

# Los parámetros de la regla, normalizados, sin validar. Un número que no se
# puede leer queda en `*_crudo` para que el esquema lo rechace.
.regla_formato_params <- function(params) {
  params <- params %||% list()
  entero <- function(x) {
    crudo <- unlist(x, use.names = FALSE)
    if (!length(crudo) || is.na(crudo[1]) || !nzchar(trimws(as.character(crudo[1])))) {
      return(list(valor = NA_real_, crudo = NA))
    }
    list(valor = suppressWarnings(as.numeric(crudo[1])), crudo = crudo[1])
  }
  mn <- entero(params$largo_min); mx <- entero(params$largo_max)
  list(
    modo = trimws(calc_str(params$modo, "digitos")),
    largo_min = mn$valor, largo_max = mx$valor,
    largo_min_crudo = mn$crudo, largo_max_crudo = mx$crudo,
    empieza = .regla_chr_values(params$empieza_con),
    expresion = calc_str(params$expresion, ""),
    sin_separadores = isTRUE(calc_bool(params$sin_separadores, FALSE))
  )
}

# Esquema: se llama desde `.validar_regla_custom()` con la regla entera.
.regla_formato_validar <- function(r) {
  vars <- as.character(unlist(r$variables %||% list(), use.names = FALSE))
  vars <- trimws(vars[!is.na(vars) & nzchar(trimws(vars))])
  if (length(vars) != 1L) {
    stop_api(400, "E_REGLA_FORMATO_PREGUNTA",
             "El formato de la respuesta se revisa en una sola pregunta.",
             details = list(n_preguntas = length(vars)))
  }
  p <- .regla_formato_params(r$params)
  if (!(p$modo %in% .REGLA_FORMATO_MODOS)) {
    stop_api(400, "E_REGLA_FORMATO_MODO",
             sprintf("Formato '%s' no válido. Válidos: %s.", p$modo, paste(.REGLA_FORMATO_MODOS, collapse = ", ")))
  }
  if (identical(p$modo, "digitos")) {
    for (lado in c("largo_min", "largo_max")) {
      v <- p[[lado]]; crudo <- p[[paste0(lado, "_crudo")]]
      if (!is.na(crudo) && (is.na(v) || v != round(v) || v < 1)) {
        stop_api(400, "E_REGLA_FORMATO_LARGO",
                 sprintf("La cantidad de dígitos debe ser un número entero desde 1; llegó \"%s\".", crudo),
                 details = list(lado = lado, valor = as.character(crudo)))
      }
    }
    if (!is.na(p$largo_min) && !is.na(p$largo_max) && p$largo_min > p$largo_max) {
      stop_api(400, "E_REGLA_FORMATO_LARGO",
               sprintf("La cantidad mínima de dígitos (%d) es mayor que la máxima (%d).",
                       as.integer(p$largo_min), as.integer(p$largo_max)))
    }
    malos <- p$empieza[!grepl("^[0-9]+$", p$empieza)]
    if (length(malos)) {
      stop_api(400, "E_REGLA_FORMATO_INICIO",
               sprintf("El inicio de la respuesta se escribe con dígitos; llegó \"%s\".", malos[1]),
               details = list(inicio = as.list(malos)))
    }
    if (!is.na(p$largo_max) && length(p$empieza) && any(nchar(p$empieza) > p$largo_max)) {
      stop_api(400, "E_REGLA_FORMATO_INICIO",
               sprintf("El inicio \"%s\" tiene más dígitos que la cantidad máxima (%d).",
                       p$empieza[nchar(p$empieza) > p$largo_max][1], as.integer(p$largo_max)))
    }
  }
  if (identical(p$modo, "expresion")) {
    if (!nzchar(trimws(p$expresion))) {
      stop_api(400, "E_REGLA_FORMATO_EXPRESION", "Escribe el patrón que debe cumplir la respuesta.")
    }
    error <- tryCatch({ grepl(paste0("^(?:", p$expresion, ")$"), "", perl = TRUE); NULL },
                      error = function(e) conditionMessage(e), warning = function(w) conditionMessage(w))
    if (!is.null(error)) {
      stop_api(400, "E_REGLA_FORMATO_EXPRESION",
               sprintf("El patrón \"%s\" no se puede leer: revisa que cada paréntesis, corchete o llave esté cerrado.",
                       p$expresion),
               details = list(expresion = p$expresion))
    }
  }
  invisible(TRUE)
}

# Un texto como llamada a intToUtf8(): sin comillas, "=" ni paréntesis sueltos
# que la normalización del plan pueda tocar.
.regla_formato_literal <- function(x) {
  if (!nzchar(x)) return("\"\"")
  sprintf("intToUtf8(c(%s))", paste(sprintf("%dL", utf8ToInt(enc2utf8(x))), collapse = ", "))
}

.regla_formato_args <- function(p) {
  ent <- function(v) if (is.na(v)) "NA_integer_" else sprintf("%dL", as.integer(v))
  c(deparse1(p$modo), ent(p$largo_min), ent(p$largo_max), deparse1(p$empieza),
    .regla_formato_literal(p$expresion), if (p$sin_separadores) "TRUE" else "FALSE")
}

# El texto R de la marca: la función de medida en línea, aplicada a la columna
# por nombre (con comillas invertidas: un nombre no siempre es sintáctico).
.regla_expr_formato <- function(var, params) {
  p <- .regla_formato_params(params)
  fn <- paste(deparse(.regla_formato_medir, width.cutoff = 500L), collapse = "\n")
  col <- sprintf("`%s`", gsub("`", "\\\\`", as.character(var)))
  sprintf("(%s)(%s)$marca", fn, paste(c(col, .regla_formato_args(p)), collapse = ", "))
}

# La regla del motor (puente de reglas propias).
.regla_formato_rule <- function(vars, params, gate, nombre, objetivo, severidad) {
  p <- .regla_formato_params(params)
  out <- .rule_custom_raw_expr(
    vars = vars[1], expr = .regla_expr_formato(vars[1], params),
    gate = gate, tipo_regla = "pattern",
    nombre = nombre, objetivo = objetivo, severidad = severidad
  )
  out$presentation <- utils::modifyList(out$presentation %||% list(),
                                        list(subtipo_semantico = paste0("formato_", p$modo)))
  out
}

# Mide una columna (o filas sueltas) con la misma función que marca.
.regla_formato_medir_col <- function(x, params) {
  p <- .regla_formato_params(params)
  .regla_formato_medir(x, p$modo, p$largo_min, p$largo_max, p$empieza, p$expresion, p$sin_separadores)
}

.regla_formato_es <- function(r) identical(as.character((r %||% list())$tipo %||% "")[1], "formato")

# --- Conteo previo --------------------------------------------------------------

# Lo que dice una respuesta medida: el texto, lo revisado, sus dígitos y el motivo.
.regla_formato_resumen <- function(med, i) {
  list(texto = med$texto[i], revisado = med$revisado[i], n_digitos = med$n_digitos[i],
       motivo = med$motivo[i] %||% NA_character_)
}

.regla_formato_ejemplo <- function(ejemplo, df, i, regla) {
  var <- .regla_variables_efectivas(regla)[1]
  x <- if (var %in% names(df)) df[[var]][i] else NA
  ejemplo$formato <- .regla_formato_resumen(.regla_formato_medir_col(x, regla$params), 1L)
  ejemplo
}

#' Cómo se leyó la pregunta de una regla de formato, sobre todas las filas
#'
#' Base: las filas que evalúa la auditoría (`n_filas`), sin el filtro. Las
#' respuestas distintas más frecuentes que pasan y que no pasan, con su motivo,
#' son los ejemplos del panel: salen de la misma medida que marca.
#'
#' @return lista con `variable`, `n_filas`, `n_vacias`, `n_pasan`, `n_no_pasan`,
#'   `como_numero`, `pasan` (hasta 3: `valor`, `n`) y `no_pasan` (hasta 5:
#'   `valor`, `n`, `motivo`, `n_digitos`).
#' @keywords internal
.regla_formato_lectura <- function(df, regla) {
  var <- .regla_variables_efectivas(regla)[1]
  x <- if (!is.na(var) && var %in% names(df)) df[[var]] else rep(NA, nrow(df))
  med <- .regla_formato_medir_col(x, regla$params)
  vacia <- is.na(med$texto)
  frecuentes <- function(sel, k, con_motivo) {
    if (!any(sel)) return(list())
    tab <- sort(table(med$texto[sel]), decreasing = TRUE)
    tab <- utils::head(tab, k)
    lapply(names(tab), function(v) {
      out <- list(valor = v, n = as.integer(tab[[v]]))
      if (con_motivo) {
        k <- match(v, med$texto[sel])
        out$motivo <- med$motivo[sel][k]
        out$n_digitos <- med$n_digitos[sel][k]
      }
      out
    })
  }
  list(
    variable = var %||% NA_character_,
    n_filas = length(med$texto),
    n_vacias = sum(vacia),
    n_pasan = sum(!vacia & !med$marca),
    n_no_pasan = sum(med$marca),
    como_numero = isTRUE(med$como_numero),
    pasan = frecuentes(!vacia & !med$marca, 3L, FALSE),
    no_pasan = frecuentes(med$marca, 5L, TRUE)
  )
}

# --- Frase del catálogo -------------------------------------------------------

# "un número de 9 dígitos que empieza con 9", "un número de 8 a 9 dígitos".
.regla_formato_descripcion <- function(p) {
  if (identical(p$modo, "correo")) return("un correo electrónico, como nombre@dominio.pe")
  if (identical(p$modo, "expresion")) return(sprintf("una respuesta que sigue el patrón \"%s\"", p$expresion))
  mn <- p$largo_min; mx <- p$largo_max
  dig <- function(k) sprintf("%d %s", as.integer(k), if (as.integer(k) == 1L) "dígito" else "dígitos")
  base <- if (!is.na(mn) && !is.na(mx) && mn == mx) sprintf("un número de %s", dig(mn))
          else if (!is.na(mn) && !is.na(mx)) sprintf("un número de %d a %s", as.integer(mn), dig(mx))
          else if (!is.na(mn)) sprintf("un número de al menos %s", dig(mn))
          else if (!is.na(mx)) sprintf("un número de hasta %s", dig(mx))
          else "un número escrito solo con dígitos"
  if (length(p$empieza)) {
    pre <- if (length(p$empieza) == 1L) p$empieza else
      paste(paste(p$empieza[-length(p$empieza)], collapse = ", "), "o", p$empieza[length(p$empieza)])
    base <- sprintf("%s que empieza con %s", base, pre)
  }
  base
}

#' Frase de una regla de formato
#'
#' @param info lo que arma el catálogo (`propia` es la regla guardada).
#' @param ctx contexto de redacción.
#' @return fichas de la frase (sin el filtro).
#' @keywords internal
.vrf_frase_formato <- function(info, ctx) {
  propia <- info$propia %||% list()
  var <- .regla_variables_efectivas(propia)[1]
  p <- .regla_formato_params(propia$params)
  if (is.na(var) || !nzchar(var) || !(p$modo %in% .REGLA_FORMATO_MODOS) ||
      (identical(p$modo, "expresion") && !nzchar(trimws(p$expresion)))) {
    .vrf_marcar_incompleta(ctx)
    return(.vrf_t(.VRF_TEXTO_ILEGIBLE))
  }
  out <- c(.vrf_t("Se marca cuando "), .vrf_q(var, ctx),
           .vrf_t(sprintf(" no es %s.", .regla_formato_descripcion(p))))
  if (identical(p$modo, "digitos") && p$sin_separadores) {
    out <- c(out, .vrf_t(" Antes se quitan espacios, guiones, puntos y paréntesis."))
  }
  # El formulario puede declararla como número: aquí se revisa el texto.
  c(out, .vrf_t(" La respuesta se revisa como texto, así que un cero inicial cuenta como dígito."))
}

# --- Enunciado del hallazgo ---------------------------------------------------

.regla_formato_contexto <- function(propia) {
  if (is.null(propia) || !.regla_formato_es(propia)) return(NULL)
  list(var = .regla_variables_efectivas(propia)[1], params = propia$params %||% list())
}

#' Enunciado del caso marcado por una regla de formato
#'
#' @param formato contexto (`.regla_formato_contexto()`).
#' @param valores valores del caso por pregunta.
#' @param regla contexto de la regla (rótulos).
#' @return lista con `hecho` y `choque`.
#' @keywords internal
.regla_formato_enunciado <- function(formato, valores, regla = list()) {
  x <- valores[[formato$var]]
  x <- if (is.null(x) || !length(x)) NA_character_ else x[1]
  med <- .regla_formato_medir_col(x, formato$params)
  mot <- med$motivo[1]
  if (is.na(mot)) return(list(hecho = "", choque = ""))
  p <- .regla_formato_params(formato$params)
  detalle <- switch(mot,
    sin_digitos = " (sin dígitos)",
    no_digitos = " (con signos que no son dígitos)",
    largo = sprintf(" (%d %s)", med$n_digitos[1], if (identical(med$n_digitos[1], 1L)) "dígito" else "dígitos"),
    inicio = sprintf(" (empieza con %s)", substr(med$revisado[1], 1L, max(1L, nchar(p$empieza[1])))),
    "")
  list(hecho = sprintf("respondió \"%s\" en %s%s", med$texto[1], .enun_rotulo(formato$var, regla), detalle),
       choque = sprintf("que no es %s", .regla_formato_descripcion(p)))
}
