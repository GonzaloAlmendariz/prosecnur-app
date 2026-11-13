# =============================================================================
# Regla propia "Combinación fuera de catálogo" (tipo `combinacion_catalogo`)
# =============================================================================
# Revisa que un lugar declarado en varias columnas exista y calce en un
# catálogo territorial: el distrito dentro de su provincia, la provincia dentro
# de su departamento y el código (ubigeo) con sus nombres. Quien la escribe
# elige qué columna cumple cada papel, con cualquier nombre y cualquier
# subconjunto de papeles (por ejemplo solo ubigeo y distrito):
#
#   params$roles      departamento, provincia, distrito, ubigeo -> columna
#   params$catalogo   id del catálogo (por defecto "ubigeo_peru", el del INEI)
#   params$omitir     textos que no se revisan (un país extranjero, "NO
#                     RECUERDA"): la fila que trae uno en cualquier papel sale
#                     como "omitida" y se cuenta aparte
#   params$marcar_incompletos  si TRUE, también se marca la fila que calza
#                     pero deja vacío algún papel
#
# Cada caso marcado distingue dos cosas: un error (los nombres o el código
# existen pero no calzan, o un nombre está en el nivel equivocado) y un nombre
# o código no reconocido. Cada uno lleva su causa en llano y, si existe, un
# candidato de corrección con su origen ("por el ubigeo 150110", "nombre
# parecido"); el candidato nunca se aplica solo. Sin candidato, el caso queda
# "a investigar".
#
# Grano: fila de la tabla principal (la encuesta). La cifra de la regla es la
# del motor: encuestas marcadas sobre las filas que evalúa la auditoría (o las
# que cumplen el "Solo revisar cuando"). Este archivo solo decide la marca de
# cada fila y su causa; la medida sale de una sola función
# (`catalogo_ubigeo_revisar()`, catalogo_ubigeo.R), que llaman el texto R del
# plan, el conteo previo, la frase y el enunciado del caso.
#
# El texto R del plan llama a `prosecnurapp:::.regla_catalogo_marca()`: el
# catálogo es una tabla de 1,890 filas y no se escribe en línea como la regla de
# formato. Las cadenas que escribe el usuario (lo omitido) viajan como códigos
# de carácter, para que la normalización del plan no toque sus signos.

.REGLA_CATALOGO_TIPO <- "combinacion_catalogo"
# Orden de la pregunta "revisada": la más específica de las que se usan.
.REGLA_CATALOGO_PRIMARIA <- c("distrito", "provincia", "departamento", "ubigeo")

.regla_catalogo_es <- function(r) {
  identical(as.character((r %||% list())$tipo %||% "")[1], .REGLA_CATALOGO_TIPO)
}

# Los parámetros normalizados, sin validar.
.regla_catalogo_params <- function(params) {
  params <- params %||% list()
  roles_in <- params$roles %||% list()
  roles <- vapply(.CATALOGO_UBIGEO_ROLES, function(r) {
    v <- trimws(calc_str(roles_in[[r]], ""))
    if (is.na(v) || !nzchar(v)) NA_character_ else v
  }, character(1))
  extra <- setdiff(names(roles_in), .CATALOGO_UBIGEO_ROLES)
  list(
    catalogo = trimws(calc_str(params$catalogo, "ubigeo_peru")),
    roles = roles,
    papeles_desconocidos = extra,
    omitir = .regla_chr_values(params$omitir),
    marcar_incompletos = isTRUE(calc_bool(params$marcar_incompletos, FALSE))
  )
}

# Columnas de la regla por papel. Con `como = "papeles"`, lista papel a columna
# de los papeles usados (sin los vacíos); si no, las columnas sin repetir.
.regla_catalogo_columnas <- function(params, como = "columnas") {
  usados <- .regla_catalogo_params(params)$roles
  usados <- usados[!is.na(usados)]
  if (identical(como, "papeles")) return(as.list(usados))
  unique(unname(usados))
}

# Las columnas que lee la regla, la revisada primero.
.regla_catalogo_variables <- function(params) {
  p <- .regla_catalogo_params(params)
  usados <- p$roles[!is.na(p$roles)]
  primaria <- intersect(.REGLA_CATALOGO_PRIMARIA, names(usados))[1]
  if (is.na(primaria)) return(character(0))
  unique(unname(c(usados[[primaria]], usados[setdiff(names(usados), primaria)])))
}

# Esquema: se llama desde `.validar_regla_custom()` con la regla entera.
.regla_catalogo_validar <- function(r) {
  p <- .regla_catalogo_params(r$params)
  if (length(p$papeles_desconocidos)) {
    stop_api(400, "E_REGLA_INVALIDA",
             sprintf("Nivel \"%s\" no existe. Válidos: %s.", p$papeles_desconocidos[1],
                     paste(.CATALOGO_UBIGEO_ROLES, collapse = ", ")))
  }
  usados <- p$roles[!is.na(p$roles)]
  if (length(usados) < 2L) {
    stop_api(400, "E_REGLA_SIN_VARS",
             "Elige al menos dos preguntas de lugar (por ejemplo provincia y distrito, o ubigeo y distrito): la combinación se revisa entre ellas.",
             details = list(n_papeles = length(usados)))
  }
  if (anyDuplicated(unname(usados))) {
    rep <- unname(usados)[duplicated(unname(usados))][1]
    stop_api(400, "E_REGLA_INVALIDA",
             sprintf("La pregunta %s está elegida para dos niveles: cada nivel va en su propia pregunta.", rep),
             details = list(pregunta = rep))
  }
  if (!(p$catalogo %in% names(.CATALOGO_UBIGEO_INCLUIDOS))) {
    stop_api(400, "E_REGLA_INVALIDA",
             sprintf("Catálogo \"%s\" no disponible. Disponibles: %s.", p$catalogo,
                     paste(names(.CATALOGO_UBIGEO_INCLUIDOS), collapse = ", ")))
  }
  invisible(TRUE)
}

#' Marca de la regla "Combinación fuera de catálogo" para una tabla
#'
#' La llama el texto R del plan. Un papel que no se usa llega NULL.
#' @param dep,prov,dist,ubi columnas (o NULL).
#' @param catalogo id del catálogo.
#' @param omitir textos omitidos, separados por salto de línea.
#' @param incompletos si TRUE marca también las filas incompletas.
#' @return logical, una por fila.
#' @keywords internal
.regla_catalogo_marca <- function(dep, prov, dist, ubi, catalogo, omitir, incompletos) {
  valores <- list(departamento = dep, provincia = prov, distrito = dist, ubigeo = ubi)
  om <- if (nzchar(omitir)) strsplit(omitir, "\n", fixed = TRUE)[[1]] else character(0)
  catalogo_ubigeo_revisar(valores, catalogo, om, incompletos)$marca
}

.regla_catalogo_col <- function(v) {
  if (is.na(v)) "NULL" else sprintf("`%s`", gsub("`", "\\\\`", v))
}

# El texto R de la marca.
.regla_expr_catalogo <- function(params) {
  p <- .regla_catalogo_params(params)
  cols <- vapply(.CATALOGO_UBIGEO_ROLES, function(r) .regla_catalogo_col(p$roles[[r]]), character(1))
  sprintf("prosecnurapp:::.regla_catalogo_marca(%s, %s, %s, %s)",
          paste(cols, collapse = ", "), deparse1(p$catalogo),
          .regla_formato_literal(paste(p$omitir, collapse = "\n")),
          if (p$marcar_incompletos) "TRUE" else "FALSE")
}

# La regla del motor (puente de reglas propias).
.regla_catalogo_rule <- function(params, gate, nombre, objetivo, severidad) {
  vars <- .regla_catalogo_variables(params)
  out <- .rule_custom_raw_expr(
    vars = vars, expr = .regla_expr_catalogo(params),
    gate = gate, tipo_regla = "coherence",
    nombre = nombre, objetivo = objetivo, severidad = severidad
  )
  out$presentation <- utils::modifyList(out$presentation %||% list(),
                                        list(subtipo_semantico = "combinacion_catalogo"))
  out
}

# Revisa filas sueltas (o la tabla entera) con la misma función que marca.
.regla_catalogo_revisar_df <- function(df, params, filas = NULL) {
  p <- .regla_catalogo_params(params)
  idx <- filas %||% seq_len(nrow(df))
  valores <- lapply(.CATALOGO_UBIGEO_ROLES, function(r) {
    col <- p$roles[[r]]
    if (is.na(col)) return(NULL)
    if (col %in% names(df)) df[[col]][idx] else rep(NA_character_, length(idx))
  })
  names(valores) <- .CATALOGO_UBIGEO_ROLES
  catalogo_ubigeo_revisar(valores, p$catalogo, p$omitir, p$marcar_incompletos)
}

# --- Conteo previo --------------------------------------------------------------

# Lo que dice un caso revisado: estado, causa, candidatos y si queda a investigar.
.regla_catalogo_resumen <- function(rev, i) {
  list(estado = rev$estado[i], causa = rev$causa[i] %||% NA_character_,
       causas = as.list(rev$causas[[i]]), candidatos = rev$candidatos[[i]],
       a_investigar = isTRUE(rev$a_investigar[i]), notas = as.list(rev$notas[[i]]))
}

.regla_catalogo_ejemplo <- function(ejemplo, df, i, regla) {
  rev <- .regla_catalogo_revisar_df(df, regla$params, filas = i)
  ejemplo$catalogo <- .regla_catalogo_resumen(rev, 1L)
  ejemplo
}

#' Cómo se leyó una regla de catálogo, sobre todas las filas
#'
#' Base: las filas que evalúa la auditoría (`n_filas`), sin el filtro. Cuenta
#' encuestas por estado y, por papel, los textos no reconocidos más frecuentes,
#' que son los que el analista puede querer omitir (un país, "NO RECUERDA").
#'
#' @return lista con `n_filas`, `n_ok`, `n_incompletas`, `n_error`,
#'   `n_no_reconocido`, `n_omitidas`, `n_sin_datos`, `n_a_investigar`,
#'   `n_ubigeo_sin_cero` y `no_reconocidos` (hasta 8: `papel`, `valor`, `n`).
#' @keywords internal
.regla_catalogo_lectura <- function(df, regla) {
  p <- .regla_catalogo_params(regla$params)
  rev <- .regla_catalogo_revisar_df(df, regla$params)
  cat <- catalogo_ubigeo_cargar(p$catalogo)
  no_rec <- list()
  for (r in names(p$roles)[!is.na(p$roles)]) {
    col <- p$roles[[r]]
    if (!(col %in% names(df))) next
    res <- catalogo_ubigeo_resolver(df[[col]], r, cat)
    malos <- res$valor[res$estado %in% c("no_reconocido", "otro_nivel")]
    if (!length(malos)) next
    tab <- sort(table(trimws(malos)), decreasing = TRUE)
    for (v in names(tab)) no_rec[[length(no_rec) + 1L]] <- list(papel = r, valor = v, n = as.integer(tab[[v]]))
  }
  if (length(no_rec)) {
    o <- order(-vapply(no_rec, `[[`, integer(1), "n"))
    no_rec <- utils::head(no_rec[o], 8L)
  }
  cuenta <- function(e) sum(rev$estado == e)
  list(
    n_filas = length(rev$estado),
    n_ok = cuenta("ok"), n_incompletas = cuenta("incompleto"),
    n_error = cuenta("error"), n_no_reconocido = cuenta("no_reconocido"),
    n_omitidas = cuenta("omitido"), n_sin_datos = cuenta("sin_datos"),
    n_a_investigar = sum(rev$a_investigar),
    n_ubigeo_sin_cero = sum(vapply(rev$notas, length, integer(1)) > 0L),
    no_reconocidos = no_rec
  )
}

# --- Frase del catálogo -------------------------------------------------------

.REGLA_CATALOGO_ROTULO_PAPEL <- c(departamento = "departamento", provincia = "provincia",
                                  distrito = "distrito", ubigeo = "ubigeo")

#' Frase de una regla de catálogo
#'
#' "Se marca cuando el distrito (p1_3) no está en la provincia (p1_2), o la
#' provincia no está en el departamento (p1_1), según Ubigeos del Perú (INEI)."
#' @param info lo que arma el catálogo de reglas (`propia` es la regla guardada).
#' @param ctx contexto de redacción.
#' @return fichas de la frase (sin el filtro).
#' @keywords internal
.vrf_frase_catalogo <- function(info, ctx) {
  propia <- info$propia %||% list()
  p <- .regla_catalogo_params(propia$params)
  usados <- p$roles[!is.na(p$roles)]
  if (length(usados) < 2L || !(p$catalogo %in% names(.CATALOGO_UBIGEO_INCLUIDOS))) {
    .vrf_marcar_incompleta(ctx)
    return(.vrf_t(.VRF_TEXTO_ILEGIBLE))
  }
  piezas <- .vrf_t("Se marca cuando la combinación de ")
  nombres <- names(usados)
  for (i in seq_along(nombres)) {
    sep <- if (i == 1L) "" else if (i == length(nombres)) " y " else ", "
    piezas <- c(piezas, .vrf_t(sprintf("%s%s ", sep, .REGLA_CATALOGO_ROTULO_PAPEL[[nombres[i]]])),
                .vrf_q(usados[[i]], ctx))
  }
  out <- c(piezas, .vrf_t(sprintf(" no existe en %s, o algún nombre no se reconoce.",
                                  .CATALOGO_UBIGEO_INCLUIDOS[[p$catalogo]])))
  if (length(p$omitir)) {
    out <- c(out, .vrf_t(sprintf(" No se revisan los casos con %s.",
                                 paste(sprintf("\"%s\"", p$omitir), collapse = ", "))))
  }
  out
}

# --- Enunciado del hallazgo ---------------------------------------------------

.regla_catalogo_contexto <- function(propia) {
  if (is.null(propia) || !.regla_catalogo_es(propia)) return(NULL)
  list(params = propia$params %||% list())
}

#' Enunciado del caso marcado por una regla de catálogo
#'
#' @param catalogo contexto (`.regla_catalogo_contexto()`).
#' @param valores valores del caso por pregunta.
#' @param regla contexto de la regla (rótulos).
#' @return lista con `hecho`, `choque`, `estado`, `candidatos` y `a_investigar`.
#' @keywords internal
.regla_catalogo_enunciado <- function(catalogo, valores, regla = list()) {
  p <- .regla_catalogo_params(catalogo$params)
  fila <- lapply(.CATALOGO_UBIGEO_ROLES, function(r) {
    col <- p$roles[[r]]
    if (is.na(col)) return(NULL)
    v <- valores[[col]]
    if (is.null(v) || !length(v)) NA_character_ else as.character(v[1])
  })
  names(fila) <- .CATALOGO_UBIGEO_ROLES
  rev <- catalogo_ubigeo_revisar(fila, p$catalogo, p$omitir, p$marcar_incompletos)
  if (!isTRUE(rev$marca[1])) return(list(hecho = "", choque = ""))
  usados <- p$roles[!is.na(p$roles)]
  declarado <- paste(vapply(names(usados), function(r) {
    v <- fila[[r]]
    sprintf("%s \"%s\"", .REGLA_CATALOGO_ROTULO_PAPEL[[r]], if (is.na(v)) "" else trimws(v))
  }, character(1)), collapse = ", ")
  list(hecho = sprintf("declaró %s", declarado),
       choque = rev$causa[1] %||% "",
       estado = rev$estado[1],
       candidatos = rev$candidatos[[1]],
       a_investigar = isTRUE(rev$a_investigar[1]))
}
