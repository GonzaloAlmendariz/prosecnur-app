# La representatividad que declara el estudio — ADR 0121, fase F1.
#
# Gonzalo, 2026-10-31: «a nivel de universidad la variable de cuota es el sexo y
# la facultad; a nivel de facultad puede ser el nivel curricular. Tiene que
# tener esa generalidad, no hardcodear».
#
# El bloque `representatividad` dice tres cosas que hasta hoy estaban repartidas
# o implícitas:
#
#   - el UNIVERSO del estudio (toda la universidad o una facultad);
#   - las VARIABLES de cuota, en orden, cada una con su atribución (aula,
#     persona o respuesta) y sus categorías;
#   - las CELDAS con meta: sólo las combinaciones que el diseño fijó.
#
# F1 no cambia ninguna cifra. Ningún estudio trae todavía el bloque —Cálculo de
# muestra lo escribirá en F4—, así que esta fase lo TRADUCE desde el contrato
# v1 de `design_targets` (`facultades[]` con `cuota_sexo {F, M}`, ADR 0079) y
# del eje declarado (ADR 0086). Lo que se infiere se marca `inferido = TRUE`
# con su motivo: un universo deducido del plan no es uno declarado.

# El sexo como dimensión de pleno derecho. Vive aquí y no en
# `.MONITOREO_AULAS_EJES` porque en F1 sólo existe como segunda variable de las
# celdas del contrato v1; F2 decidirá si entra al catálogo de ejes.
.MRDEC_SEXO <- list(
  clave = "sexo",
  etiqueta = "Sexo",
  etiqueta_plural = "Sexos",
  etiqueta_sin = "Sin sexo",
  # Lo declara el alumno en su respuesta; el plan sólo trae la composición del
  # aula, que es referencial (ADR 0081).
  atribucion = "respuesta",
  fuente_valor = "respuesta",
  categorias = list(
    list(valor = "F", etiqueta = "Mujeres", orden = 1L),
    list(valor = "M", etiqueta = "Hombres", orden = 2L)
  )
)

.mrdec_num <- function(x) {
  v <- suppressWarnings(as.numeric(.monitoreo_scalar(x, NA)))
  if (length(v) == 1L && is.finite(v)) v else NA_real_
}

.mrdec_variable_del_eje <- function(eje, categorias) {
  list(
    clave = .monitoreo_scalar(eje$clave, "facultad"),
    etiqueta = .monitoreo_scalar(eje$etiqueta, "Facultad"),
    etiqueta_plural = .monitoreo_scalar(eje$etiqueta_plural, "Facultades"),
    etiqueta_sin = .monitoreo_scalar(eje$etiqueta_sin, "Sin facultad"),
    atribucion = .monitoreo_scalar(eje$atribucion, "aula"),
    fuente_valor = .monitoreo_scalar(eje$fuente_valor, "plan"),
    categorias = categorias
  )
}

# El universo, deducido del plan cuando el diseño no lo declara. Un plan con
# una sola facultad es un estudio de esa facultad (CCSS); con varias, de la
# universidad (HSVG). Sin plan no se adivina: se dice.
.mrdec_universo_inferido <- function(plan, padron) {
  facultades <- character(0)
  if (is.data.frame(plan) && nrow(plan)) {
    col <- .monitoreo_aulas_col(plan, c("faculty", "facultad"))
    if (nzchar(col)) {
      v <- trimws(as.character(plan[[col]]))
      facultades <- unique(v[!is.na(v) & nzchar(v)])
    }
  }
  poblacion <- .mrdec_num((padron %||% list())[["personas"]])
  if (length(facultades) == 1L) {
    return(list(nivel = "facultad", valor = facultades[[1]], etiqueta = facultades[[1]],
                poblacion = poblacion, inferido = TRUE,
                motivo = "El plan tiene cursos-horario de una sola facultad."))
  }
  if (length(facultades) > 1L) {
    return(list(nivel = "universidad", valor = NULL, etiqueta = "Universidad",
                poblacion = poblacion, inferido = TRUE,
                motivo = sprintf("El plan reparte cursos-horario en %d facultades.", length(facultades))))
  }
  list(nivel = "", valor = NULL, etiqueta = "", poblacion = poblacion, inferido = TRUE,
       motivo = "Sin plan no se puede deducir el universo del estudio.")
}

#' La representatividad que declara el estudio (ADR 0121).
#'
#' No confundir con `monitoreo_aulas_representatividad.R`, que mide si la
#' muestra EFECTIVA se parece a la planificada: aquí se dice qué universo y qué
#' variables de cuota prometió el diseño.
#'
#' Si `design_targets` ya trae el bloque `representatividad` (Cálculo de
#' muestra, fase F4), se devuelve tal cual, con `origen = "diseno"`. Si no, se
#' traduce del contrato v1: el eje declarado es la primera variable; el sexo es
#' la segunda sólo si alguna facultad trae `cuota_sexo` con cifras. Cada fila de
#' `facultades[]` da una celda por sexo con meta o, sin sexo, una sola celda.
#'
#' @param cfg config de aulas (o la completa: se acepta cualquiera de las dos).
#' @param plan data.frame del plan, sólo para deducir el universo.
#' @param padron resumen del padrón, sólo para la población del universo.
#' @return lista `representatividad_v1`, o `NULL` si no hay metas del diseño.
#' @export
monitoreo_aulas_representatividad_declarada <- function(cfg = list(), plan = NULL, padron = NULL) {
  if (!is.list(cfg)) cfg <- list()
  aulas <- if (is.list(cfg[["aulas_universitarias"]])) cfg[["aulas_universitarias"]] else cfg
  # F4: si el Planner declara universo y variables, mandan sobre lo traducido;
  # las celdas siguen saliendo del diseño (monitoreo_aulas_representatividad_planner.R).
  planner <- aulas[["representatividad_planner"]]
  if (is.list(planner)) {
    aulas$representatividad_planner <- NULL
    return(.mrpl_combinar(monitoreo_aulas_representatividad_declarada(aulas, plan, padron), planner))
  }
  dt <- aulas[["design_targets"]]
  if (!is.list(dt)) return(NULL)
  declarada <- dt[["representatividad"]]
  if (is.list(declarada) && length(declarada[["variables"]]) && length(declarada[["celdas"]])) {
    declarada$origen <- "diseno"
    return(declarada)
  }
  facultades <- dt[["facultades"]]
  if (!is.list(facultades) || !length(facultades)) return(NULL)

  eje <- monitoreo_aulas_eje(aulas)
  clave_eje <- .monitoreo_scalar(eje$clave, "facultad")
  con_sexo <- any(vapply(facultades, function(f) {
    cs <- f[["cuota_sexo"]]
    is.list(cs) && any(is.finite(vapply(cs, .mrdec_num, numeric(1))))
  }, logical(1)))

  categorias <- list(); celdas <- list()
  for (i in seq_along(facultades)) {
    f <- facultades[[i]]
    valor <- .monitoreo_scalar(f[["facultad"]], "")
    if (!nzchar(valor)) next
    categorias[[length(categorias) + 1L]] <- list(
      valor = valor, clave = .monitoreo_scalar(f[["faculty_key"]], monitoreo_aulas_eje_key(valor)),
      etiqueta = valor, orden = length(categorias) + 1L)
    tau <- .mrdec_num(f[["tau"]])
    cs <- f[["cuota_sexo"]]
    if (con_sexo && is.list(cs)) {
      for (s in c("F", "M")) {
        meta <- .mrdec_num(cs[[s]])
        if (!is.finite(meta)) next
        valores <- list(); valores[[clave_eje]] <- valor; valores[["sexo"]] <- s
        celdas[[length(celdas) + 1L]] <- list(valores = valores, cuota = meta, sobremuestra = NA_real_, tau = tau)
      }
    } else {
      valores <- list(); valores[[clave_eje]] <- valor
      celdas[[length(celdas) + 1L]] <- list(valores = valores, cuota = .mrdec_num(f[["cuota"]]),
                                             sobremuestra = NA_real_, tau = tau)
    }
  }
  if (!length(celdas)) return(NULL)

  variables <- list(.mrdec_variable_del_eje(eje, categorias))
  if (con_sexo) variables[[2L]] <- .MRDEC_SEXO

  list(
    schema = "representatividad_v1",
    origen = "traducida_v1",
    universo = .mrdec_universo_inferido(plan, padron),
    variables = variables,
    celdas = celdas,
    agrupacion_operativa = .monitoreo_scalar(aulas[["agrupacion_operativa"]] %||% "", "")
  )
}
