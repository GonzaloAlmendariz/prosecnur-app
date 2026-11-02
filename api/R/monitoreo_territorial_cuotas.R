# Avance territorial por cuotas: por zona y por celda, no por UMP (ADR 0125,
# anexo A1).
#
# Gonzalo (2026-11-02): «Monitoreo debería recibir cuál es la relación de UMP
# titulares y reemplazos porque sin eso no puede definir avance», también en
# cuotas, donde Hojas de ruta no sortea manzanas: envía ZONAS (hoy el distrito)
# con su N y su cuota por celda (sexo × rango de edad). La foto llega en
# `runs[[fase]]$envio` con `kind = "cuotas"`:
#   zonas = list(list(id_zona, ubigeo, nombre, n,
#                     cuotas = list(list(sexo, rango_id, rango_edad, n))))
#
# Cuenta las mismas efectivas que el resto del avance
# (`.monitoreo_territorial_mascaras_efectivas`): las en observación incluidas,
# las declaradas por coordinación nunca.

#' Sexo normalizado a «hombre» / «mujer» / «».
#' @keywords internal
.mtcu_sexo <- function(x) {
  # El mismo rotulador que el cruce por celda del motor: el sexo llega con el
  # código de Kobo (1 hombre, 2 mujer) o con su etiqueta.
  lab <- .monitoreo_territorial_quota_sex_label(as.character(x %||% ""))
  ifelse(lab == "Hombre", "hombre", ifelse(lab == "Mujer", "mujer", ""))
}

#' Límites de un rango de edad escrito como «18 a 29», «18-29» o «60 o más».
#' @keywords internal
.mtcu_rango <- function(rango) {
  nums <- suppressWarnings(as.numeric(regmatches(rango, gregexpr("[0-9]+", rango))[[1]]))
  if (!length(nums)) return(c(NA_real_, NA_real_))
  if (length(nums) == 1L) return(c(nums[[1]], Inf))
  c(nums[[1]], nums[[2]])
}

#' Avance por zona y celda de un envío por cuotas.
#'
#' @param envio la foto `runs[[fase]]$envio` de Hojas de ruta.
#' @param audit el audit territorial (ubigeo, sex, age, advance_valid,
#'   observation_status), ya sin anuladas.
#' @param asignacion filas de la asignación por zona que arma Material
#'   (`GET /api/recopiladores/campaigns/territorial/asignacion`, 2d6b8d6d1):
#'   `{id_zona, codigo, parte}`, con un `id_zona` que puede repetirse cuando dos
#'   o más personas se reparten la cuota (decisión de Gonzalo).
#' @return `NULL` si el envío no es por cuotas; si no, `list(kind, zonas, total,
#'   sin_zona, sin_celda)`; cada zona trae `personas` con su parte y sus efectivas.
#' @keywords internal
monitoreo_territorial_avance_cuotas <- function(envio, audit, asignacion = list()) {
  if (!is.list(envio) || !identical(.monitoreo_scalar(envio$kind, ""), "cuotas")) return(NULL)
  zonas <- Filter(is.list, envio$zonas %||% list())
  n <- if (is.data.frame(audit)) nrow(audit) else 0L
  m <- .monitoreo_territorial_mascaras_efectivas(audit)
  ubigeo <- if (n) trimws(as.character(audit$ubigeo %||% rep("", n))) else character(0)
  sexo <- if (n) .mtcu_sexo(audit$sex %||% rep("", n)) else character(0)
  edad <- if (n) suppressWarnings(as.numeric(audit$age %||% rep(NA, n))) else numeric(0)
  # Quién levantó cada caso: el código Pulso normalizado, el mismo de la lista de códigos.
  codigo <- if (n) toupper(trimws(as.character(audit$pulso_code_normalized %||% audit$pulso_code %||% rep("", n)))) else character(0)
  filas_asig <- Filter(function(a) is.list(a) && nzchar(.monitoreo_scalar(a$id_zona %||% a$id_manzana, "")),
                       asignacion %||% list())

  en_alguna_celda <- rep(FALSE, n)
  ubigeos <- character(0)
  salida <- lapply(zonas, function(z) {
    u <- trimws(.monitoreo_scalar(z$ubigeo %||% z$id_zona, ""))
    ubigeos <<- c(ubigeos, u)
    de_la_zona <- ubigeo == u
    celdas <- lapply(Filter(is.list, z$cuotas %||% list()), function(cu) {
      lim <- .mtcu_rango(.monitoreo_scalar(cu$rango_edad %||% cu$rango_id, ""))
      s <- .mtcu_sexo(.monitoreo_scalar(cu$sexo, ""))
      cae <- de_la_zona & m$efectiva & sexo == s & is.finite(edad) & edad >= lim[[1]] & edad <= lim[[2]]
      en_alguna_celda <<- en_alguna_celda | cae
      meta <- suppressWarnings(as.integer(.monitoreo_scalar(cu$n, 0L)))
      if (is.na(meta)) meta <- 0L
      ef <- as.integer(sum(cae))
      list(sexo = .monitoreo_scalar(cu$sexo, ""), rango_edad = .monitoreo_scalar(cu$rango_edad %||% cu$rango_id, ""),
           meta = meta, efectivas = ef, en_observacion = as.integer(sum(cae & m$observacion)),
           falta = as.integer(max(0L, meta - ef)))
    })
    meta <- suppressWarnings(as.integer(.monitoreo_scalar(z$n, 0L)))
    if (is.na(meta)) meta <- 0L
    id_z <- .monitoreo_scalar(z$id_zona %||% u, "")
    suyas <- Filter(function(a) identical(.monitoreo_scalar(a$id_zona %||% a$id_manzana, ""), id_z), filas_asig)
    personas <- lapply(suyas, function(a) {
      cod <- toupper(trimws(.monitoreo_scalar(a$codigo, "")))
      parte <- suppressWarnings(as.integer(.monitoreo_scalar(a$parte, NA)))
      ef <- as.integer(sum(de_la_zona & m$efectiva & nzchar(cod) & codigo == cod))
      list(codigo = .monitoreo_scalar(a$codigo, ""), parte = if (is.na(parte)) NA_integer_ else parte,
           efectivas = ef, falta = if (is.na(parte)) NA_integer_ else as.integer(max(0L, parte - ef)))
    })
    list(
      id_zona = id_z, ubigeo = u, nombre = .monitoreo_scalar(z$nombre, ""),
      meta = meta,
      personas = personas,
      efectivas = as.integer(sum(de_la_zona & m$efectiva)),
      en_observacion = as.integer(sum(de_la_zona & m$observacion)),
      celdas = celdas,
      celdas_completas = as.integer(sum(vapply(celdas, function(c) c$falta == 0L, logical(1))))
    )
  })
  efectivas_total <- as.integer(sum(vapply(salida, function(z) z$efectivas, integer(1))))
  list(
    kind = "cuotas",
    zonas = salida,
    total = list(
      meta = as.integer(sum(vapply(salida, function(z) z$meta, integer(1)))),
      efectivas = efectivas_total,
      celdas = as.integer(sum(vapply(salida, function(z) length(z$celdas), integer(1)))),
      celdas_completas = as.integer(sum(vapply(salida, function(z) z$celdas_completas, integer(1))))
    ),
    # Lo que no cae en ninguna zona del envío, o cae en su zona sin celda (sin
    # sexo o edad legibles, o fuera de los rangos): se declara, no se pierde.
    sin_zona = as.integer(sum(m$efectiva & !(ubigeo %in% ubigeos))),
    sin_celda = as.integer(sum(m$efectiva & ubigeo %in% ubigeos & !en_alguna_celda))
  )
}
