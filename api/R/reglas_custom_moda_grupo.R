# =============================================================================
# Regla propia "Valor distinto del más frecuente en su grupo" (tipo `moda_en_grupo`)
# =============================================================================
# Marca las encuestas cuyo valor en una pregunta difiere del valor más
# frecuente (la moda) entre las encuestas de su mismo grupo: el ubigeo que no
# es el que casi todas las encuestas del mismo distrito traen. Quien la escribe
# elige dos preguntas, con cualquier nombre:
#
#   params$grupo      pregunta que define el grupo (distrito, sede, aula)
#   params$valor      pregunta cuyo valor se compara con el más frecuente
#   params$apoyo_min  porcentaje mínimo del grupo que debe reunir el más
#                     frecuente para que cuente como referencia (por defecto 60)
#   params$n_min      encuestas mínimas con respuesta en el grupo (por defecto 5)
#
# Grano: fila de la tabla principal (la encuesta). Base de cada grupo: las
# encuestas de la tabla con grupo y valor respondidos; una encuesta con alguno
# de los dos vacío no entra en el grupo ni se marca. Los textos se comparan sin
# tildes, sin distinguir mayúsculas ni signos (catalogo_ubigeo_normalizar()),
# así "COMAs" y "COMAS" son el mismo grupo. Un valor escrito solo con dígitos se
# compara sin los ceros iniciales: Excel y las planillas digitadas los pierden
# ("80105" es "080105"), y esa diferencia de escritura no es un valor distinto.
#
# Un grupo no da referencia, y por eso no marca a nadie, en tres casos que se
# cuentan aparte: tiene menos de `n_min` encuestas ("grupo_chico"), dos valores
# empatan como los más frecuentes ("empate") o el más frecuente reúne menos de
# `apoyo_min` por ciento ("sin_apoyo").
#
# La medida sale de una sola función (`moda_grupo_revisar()`); el texto R del
# plan, el conteo previo, la frase y el enunciado del caso la llaman. La cifra
# de la regla es la del motor: encuestas marcadas sobre las filas que evalúa la
# auditoría (o las que cumplen el "Solo revisar cuando"); el filtro no cambia
# los grupos, que se miden sobre toda la tabla.

.REGLA_MODA_TIPO <- "moda_en_grupo"
.REGLA_MODA_APOYO_DEFECTO <- 60
.REGLA_MODA_N_DEFECTO <- 5L
.REGLA_MODA_ESTADOS <- c("ok", "marca", "grupo_chico", "empate", "sin_apoyo", "sin_datos")

.regla_moda_es <- function(r) {
  identical(as.character((r %||% list())$tipo %||% "")[1], .REGLA_MODA_TIPO)
}

# Los parámetros normalizados, sin validar: lo que no se puede leer cae al
# valor por defecto. La validación (`.regla_moda_validar()`) rechaza antes lo
# mal escrito, así que el defecto solo cubre reglas guardadas sin esos campos.
.regla_moda_params <- function(params) {
  params <- params %||% list()
  txt <- function(x) {
    v <- trimws(calc_str(x, ""))
    if (is.na(v)) "" else v
  }
  list(
    grupo = txt(params$grupo),
    valor = txt(params$valor),
    apoyo_min = calc_num(params$apoyo_min, .REGLA_MODA_APOYO_DEFECTO, min = 1, max = 100),
    n_min = as.integer(calc_num(params$n_min, .REGLA_MODA_N_DEFECTO, min = 2, max = 1e6))
  )
}

# Las preguntas que lee la regla: la revisada (valor) primero, luego el grupo.
.regla_moda_variables <- function(params) {
  p <- .regla_moda_params(params)
  v <- c(p$valor, p$grupo)
  unique(v[nzchar(v)])
}

# Esquema: se llama desde `.validar_regla_custom()` con la regla entera.
.regla_moda_validar <- function(r) {
  raw <- r$params %||% list()
  p <- .regla_moda_params(raw)
  if (!nzchar(p$grupo) || !nzchar(p$valor)) {
    stop_api(400, "E_REGLA_SIN_VARS",
             "Elige la pregunta que define el grupo y la pregunta cuyo valor se compara.",
             details = list(grupo = p$grupo, valor = p$valor))
  }
  if (identical(p$grupo, p$valor)) {
    stop_api(400, "E_REGLA_INVALIDA",
             sprintf("La pregunta %s está elegida como grupo y como valor: deben ser dos preguntas distintas.", p$valor),
             details = list(pregunta = p$valor))
  }
  num <- function(x) if (is.null(x) || !length(x) || identical(trimws(as.character(x[[1]])), "")) NA_real_ else suppressWarnings(as.numeric(x[[1]]))
  apoyo <- num(raw$apoyo_min)
  if (!is.null(raw$apoyo_min) && nzchar(trimws(as.character(raw$apoyo_min[[1]]))) && (is.na(apoyo) || apoyo < 1 || apoyo > 100)) {
    stop_api(400, "E_REGLA_INVALIDA", "El apoyo mínimo es un porcentaje entre 1 y 100.",
             details = list(apoyo_min = raw$apoyo_min))
  }
  n <- num(raw$n_min)
  if (!is.null(raw$n_min) && nzchar(trimws(as.character(raw$n_min[[1]]))) && (is.na(n) || n < 2 || n != round(n))) {
    stop_api(400, "E_REGLA_INVALIDA", "El mínimo de encuestas por grupo es un número entero desde 2.",
             details = list(n_min = raw$n_min))
  }
  invisible(TRUE)
}

# --- La medida ----------------------------------------------------------------

# El valor de una columna como texto estable: un número entero no pasa por
# notación científica (150110, no 1.5011e+05) y un valor etiquetado va por código.
.regla_moda_texto <- function(x) {
  if (is.null(x)) return(character(0))
  x <- unclass(x)
  if (is.factor(x)) x <- as.character(x)
  if (is.numeric(x)) {
    entero <- !is.na(x) & is.finite(x) & x == round(x)
    out <- as.character(x)
    out[entero] <- sprintf("%.0f", x[entero])
    return(out)
  }
  as.character(x)
}

# La forma más escrita de cada clave ("Comas" si 40 encuestas dicen COMAS y 2 dicen COMAs).
.regla_moda_forma <- function(clave, original) {
  ok <- !is.na(clave)
  if (!any(ok)) return(stats::setNames(character(0), character(0)))
  d <- data.frame(k = clave[ok], o = trimws(original[ok]), stringsAsFactors = FALSE)
  d$n <- stats::ave(seq_len(nrow(d)), d$k, d$o, FUN = length)
  d <- d[order(-d$n), , drop = FALSE]
  d <- d[!duplicated(d$k), , drop = FALSE]
  stats::setNames(d$o, d$k)
}

#' Revisa cuántas encuestas se alejan del valor más frecuente de su grupo
#'
#' Base: las encuestas con grupo y valor respondidos. Una sola función mide para
#' el texto R del plan, el conteo previo, la frase y el enunciado del caso.
#'
#' @param grupo,valor vectores del mismo largo: el grupo de cada encuesta y su valor.
#' @param apoyo_min porcentaje mínimo del grupo que debe reunir el más frecuente.
#' @param n_min encuestas mínimas con respuesta en un grupo.
#' @return lista con, por fila, `estado` (`ok`, `marca`, `grupo_chico`, `empate`,
#'   `sin_apoyo`, `sin_datos`), `marca`, `grupo` y `valor` (como se escribieron),
#'   `moda` (el valor más frecuente de su grupo, si hay referencia), `n_moda` y
#'   `n_grupo`; y `grupos`, un data.frame por grupo con su estado.
#' @keywords internal
moda_grupo_revisar <- function(grupo, valor, apoyo_min = .REGLA_MODA_APOYO_DEFECTO,
                               n_min = .REGLA_MODA_N_DEFECTO) {
  n <- length(grupo)
  if (length(valor) != n) {
    stop("moda_grupo_revisar(): grupo y valor deben tener el mismo largo.", call. = FALSE)
  }
  g_txt <- .regla_moda_texto(grupo)
  v_txt <- .regla_moda_texto(valor)
  gk <- catalogo_ubigeo_normalizar(g_txt)
  vk <- catalogo_ubigeo_normalizar(v_txt)
  solo_digitos <- !is.na(vk) & grepl("^[0-9]+$", vk)
  vk[solo_digitos] <- sub("^0+(?=[0-9])", "", vk[solo_digitos], perl = TRUE)
  valido <- !is.na(gk) & !is.na(vk)

  estado <- ifelse(valido, NA_character_, "sin_datos")
  n_grupo <- rep(NA_integer_, n)
  n_moda <- rep(NA_integer_, n)
  moda <- rep(NA_character_, n)
  grupos <- data.frame(clave = character(0), nombre = character(0), n = integer(0),
                       n_moda = integer(0), moda = character(0), estado = character(0),
                       stringsAsFactors = FALSE)

  if (any(valido)) {
    ix <- which(valido)
    sep <- "\r"
    par <- paste(gk[ix], vk[ix], sep = sep)
    cnt_par <- stats::ave(seq_along(ix), par, FUN = length)
    unico <- !duplicated(par)
    pares <- data.frame(gk = gk[ix][unico], vk = vk[ix][unico], n = cnt_par[unico], stringsAsFactors = FALSE)
    pares$n_grupo <- stats::ave(pares$n, pares$gk, FUN = sum)
    pares$max <- stats::ave(pares$n, pares$gk, FUN = max)
    pares$top <- pares$n == pares$max
    pares$n_top <- stats::ave(as.integer(pares$top), pares$gk, FUN = sum)

    por_grupo <- pares[pares$top, , drop = FALSE]
    por_grupo <- por_grupo[!duplicated(por_grupo$gk), , drop = FALSE]
    est_g <- ifelse(por_grupo$n_grupo < n_min, "grupo_chico",
              ifelse(por_grupo$n_top > 1L, "empate",
               ifelse(por_grupo$max / por_grupo$n_grupo * 100 < apoyo_min, "sin_apoyo", "evaluable")))
    forma_g <- .regla_moda_forma(gk[ix], g_txt[ix])
    forma_v <- .regla_moda_forma(vk[ix], v_txt[ix])
    grupos <- data.frame(
      clave = por_grupo$gk, nombre = unname(forma_g[por_grupo$gk]), n = as.integer(por_grupo$n_grupo),
      n_moda = as.integer(por_grupo$max),
      moda = ifelse(est_g == "evaluable", unname(forma_v[por_grupo$vk]), NA_character_),
      estado = est_g, stringsAsFactors = FALSE
    )
    m <- match(gk[ix], por_grupo$gk)
    est <- est_g[m]
    est[est == "evaluable"] <- ifelse(vk[ix][est == "evaluable"] == por_grupo$vk[m][est == "evaluable"], "ok", "marca")
    estado[ix] <- est
    n_grupo[ix] <- as.integer(por_grupo$n_grupo[m])
    n_moda[ix] <- as.integer(por_grupo$max[m])
    moda[ix] <- grupos$moda[m]
  }

  list(
    estado = estado, marca = estado %in% "marca",
    grupo = trimws(g_txt), valor = trimws(v_txt),
    grupo_forma = unname(.regla_moda_forma(gk, g_txt)[gk]),
    moda = moda, n_moda = n_moda, n_grupo = n_grupo,
    grupos = grupos, apoyo_min = apoyo_min, n_min = n_min
  )
}

# El texto R del plan llama a esta función: devuelve un lógico por fila.
#' Marca de la regla "Valor distinto del más frecuente en su grupo" para una tabla
#' @param grupo,valor columnas.
#' @param apoyo_min,n_min umbrales.
#' @return logical, una por fila.
#' @keywords internal
.regla_moda_marca <- function(grupo, valor, apoyo_min, n_min) {
  moda_grupo_revisar(grupo, valor, apoyo_min, n_min)$marca
}

# --- Texto R del plan y regla del motor ------------------------------------------

.regla_moda_col <- function(v) sprintf("`%s`", gsub("`", "\\\\`", v))

.regla_expr_moda <- function(params) {
  p <- .regla_moda_params(params)
  sprintf("prosecnurapp:::.regla_moda_marca(%s, %s, %s, %dL)",
          .regla_moda_col(p$grupo), .regla_moda_col(p$valor),
          format(p$apoyo_min, scientific = FALSE, trim = TRUE), p$n_min)
}

.regla_moda_rule <- function(params, gate, nombre, objetivo, severidad) {
  vars <- .regla_moda_variables(params)
  out <- .rule_custom_raw_expr(
    vars = vars, expr = .regla_expr_moda(params),
    gate = gate, tipo_regla = "coherence",
    nombre = nombre, objetivo = objetivo, severidad = severidad
  )
  out$presentation <- utils::modifyList(out$presentation %||% list(),
                                        list(subtipo_semantico = "moda_en_grupo"))
  out
}

# --- Conteo previo --------------------------------------------------------------

.regla_moda_revisar_df <- function(df, params) {
  p <- .regla_moda_params(params)
  col <- function(v) if (v %in% names(df)) df[[v]] else rep(NA_character_, nrow(df))
  moda_grupo_revisar(col(p$grupo), col(p$valor), p$apoyo_min, p$n_min)
}

# Rótulo corto de una pregunta: su etiqueta si cabe en una frase, si no el nombre.
.regla_moda_rotulo <- function(var, etiquetas = NULL, mayuscula = FALSE) {
  lab <- trimws(as.character((etiquetas %||% list())[[var]] %||% "")[1])
  # Un nombre de columna (p1_3) se deja como está; un rótulo en palabras toma
  # la mayúscula inicial que pide su lugar en la frase.
  if (is.na(lab) || !nzchar(lab) || nchar(lab) > 30L || identical(lab, var)) return(var)
  paste0(if (mayuscula) toupper(substr(lab, 1L, 1L)) else tolower(substr(lab, 1L, 1L)), substring(lab, 2L))
}

# La causa de una encuesta marcada, con la moda y su peso en el grupo:
# "Ubigeo 150133 en Comas; en ese distrito 41 de 45 encuestas tienen 150110".
.regla_moda_causa <- function(med, i, params, etiquetas = NULL) {
  p <- .regla_moda_params(params)
  rv <- .regla_moda_rotulo(p$valor, etiquetas, mayuscula = TRUE)
  rg <- .regla_moda_rotulo(p$grupo, etiquetas)
  sprintf("%s %s en %s; en ese %s %d de %d encuestas tienen %s",
          rv, med$valor[i], med$grupo_forma[i], rg, med$n_moda[i], med$n_grupo[i], med$moda[i])
}

.regla_moda_resumen <- function(med, i, params, etiquetas = NULL) {
  est <- med$estado[i]
  list(estado = est,
       causa = if (identical(est, "marca")) .regla_moda_causa(med, i, params, etiquetas) else NA_character_,
       moda = med$moda[i], n_moda = med$n_moda[i], n_grupo = med$n_grupo[i])
}

.regla_moda_ejemplo <- function(ejemplo, df, i, regla, etiquetas = NULL) {
  med <- .regla_moda_revisar_df(df, regla$params)
  ejemplo$moda <- .regla_moda_resumen(med, i, regla$params, etiquetas)
  ejemplo
}

#' Cómo se leyó una regla de valor más frecuente por grupo, sobre todas las filas
#'
#' Base: las filas que evalúa la auditoría (`n_filas`), sin el filtro. Cuenta
#' encuestas por estado, y grupos por estado, para decir cuántas no tienen
#' referencia y por qué.
#'
#' @return lista con `n_filas`, `n_ok`, `n_marcadas`, `n_grupo_chico`,
#'   `n_empate`, `n_sin_apoyo`, `n_sin_datos` (encuestas, suman `n_filas`),
#'   `n_grupos`, `n_grupos_evaluables`, `n_grupos_chicos`, `n_grupos_empate`,
#'   `n_grupos_sin_apoyo` y los umbrales `apoyo_min` y `n_min`.
#' @keywords internal
.regla_moda_lectura <- function(df, regla) {
  med <- .regla_moda_revisar_df(df, regla$params)
  cuenta <- function(e) sum(med$estado == e)
  gr <- med$grupos
  list(
    n_filas = length(med$estado),
    n_ok = cuenta("ok"), n_marcadas = cuenta("marca"),
    n_grupo_chico = cuenta("grupo_chico"), n_empate = cuenta("empate"),
    n_sin_apoyo = cuenta("sin_apoyo"), n_sin_datos = cuenta("sin_datos"),
    n_grupos = nrow(gr), n_grupos_evaluables = sum(gr$estado == "evaluable"),
    n_grupos_chicos = sum(gr$estado == "grupo_chico"),
    n_grupos_empate = sum(gr$estado == "empate"),
    n_grupos_sin_apoyo = sum(gr$estado == "sin_apoyo"),
    apoyo_min = med$apoyo_min, n_min = med$n_min
  )
}

# --- Frase --------------------------------------------------------------------

#' Frase de una regla de valor más frecuente por grupo
#'
#' "Se marca cuando ubigeo (p1_4) es distinto del valor más frecuente entre las
#' encuestas del mismo distrito (p1_3), si ese valor reúne al menos 60 % del
#' grupo y el grupo tiene al menos 5 encuestas."
#' @param info lo que arma el catálogo de reglas (`propia` es la regla guardada).
#' @param ctx contexto de redacción.
#' @return fichas de la frase (sin el filtro).
#' @keywords internal
.vrf_frase_moda <- function(info, ctx) {
  propia <- info$propia %||% list()
  p <- .regla_moda_params(propia$params)
  if (!nzchar(p$grupo) || !nzchar(p$valor)) {
    .vrf_marcar_incompleta(ctx)
    return(.vrf_t(.VRF_TEXTO_ILEGIBLE))
  }
  c(.vrf_t("Se marca cuando "), .vrf_q(p$valor, ctx),
    .vrf_t(" es distinto del valor más frecuente entre las encuestas con la misma respuesta en "),
    .vrf_q(p$grupo, ctx),
    .vrf_t(sprintf(", si ese valor reúne al menos %s %% del grupo y el grupo tiene al menos %d encuestas con respuesta.",
                   format(p$apoyo_min, scientific = FALSE, trim = TRUE), p$n_min)))
}

# --- Enunciado del hallazgo ---------------------------------------------------

.regla_moda_contexto <- function(propia) {
  if (is.null(propia) || !.regla_moda_es(propia)) return(NULL)
  list(params = propia$params %||% list())
}

#' Enunciado del caso marcado por una regla de valor más frecuente por grupo
#'
#' La causa necesita el grupo entero, que el caso no trae: el llamador
#' (`.validacion_esperado_por_fila()`) mide la tabla una vez y deja en
#' `moda$caso` la medida de esta fila (`.regla_moda_resumen()` más `valor` y
#' `grupo`).
#'
#' @param moda contexto (`.regla_moda_contexto()`), con `caso` si ya se midió.
#' @param valores valores del caso por pregunta.
#' @param regla contexto de la regla (rótulos).
#' @return lista con `hecho` y `choque`; vacíos si el caso no se marca.
#' @keywords internal
.regla_moda_enunciado <- function(moda, valores, regla = list()) {
  caso <- moda$caso
  if (is.null(caso) || !identical(caso$estado, "marca")) return(list(hecho = "", choque = ""))
  list(hecho = "", choque = caso$causa %||% "", estado = "marca")
}
