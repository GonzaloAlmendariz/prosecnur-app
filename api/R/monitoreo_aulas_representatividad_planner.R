# La representatividad declarada en el Planner — ADR 0121, fase F4.
#
# Desde el ADR 0122 el universo y las variables de cuota se declaran en el
# Planner (`planner$perfiles[[i]]$poblaciones[[j]]$representatividad`); las
# CELDAS con meta siguen siendo del diseñador (el escenario de Cálculo de
# muestra, `design_targets`). Este archivo junta las dos mitades para Monitoreo:
#
#   - lee del Planner SÓLO lo declarado, nunca lo proyectado. La proyección del
#     Planner sale de `monitoreo_aulas_representatividad_declarada()`; leerla
#     aquí sería un círculo que se confirma a sí mismo;
#   - toma universo y variables del Planner y las celdas del diseño, y dice
#     dónde no casan (una variable declarada que ninguna celda usa, o una celda
#     que reparte por una variable que el Planner no declara). No corrige nada:
#     ninguna cifra cambia por declarar en el Planner.
#
# El Planner es de su sesión dueña (planner_*.R): aquí sólo se llama a su
# normalizador de lectura, sin escribir la clave.

#' Lo que el Planner declara para la población de aulas, o `NULL`.
#'
#' @param planner el valor crudo de la clave `planner` de la sesión.
#' @return lista `{universo, variables, poblacion, declarado_en}` o `NULL` si el
#'   Planner no declara perfiles, no declara el de aulas o su población no trae
#'   variables.
#' @keywords internal
.mrpl_declarado <- function(planner) {
  p <- tryCatch(.planner_normalizar(planner), error = function(e) NULL)
  perfiles <- p$secciones$perfiles
  if (!is.list(perfiles) || !is.list(perfiles$valor)) return(NULL)
  for (perfil in perfiles$valor) {
    if (!identical(.monitoreo_scalar(perfil$tipo, ""), "aulas")) next
    for (pob in perfil$poblaciones %||% list()) {
      rep <- pob$representatividad
      if (is.list(rep) && length(rep$variables)) {
        return(list(
          universo = rep$universo,
          variables = rep$variables,
          poblacion = .monitoreo_scalar(pob$id, ""),
          declarado_en = .monitoreo_scalar(perfiles$declarado_en, "")
        ))
      }
    }
  }
  NULL
}

#' Lo declarado en el Planner de una sesión (sin sesión, `NULL`).
#' @keywords internal
.mrpl_de_sesion <- function(sid) {
  if (!nzchar(sid %||% "")) return(NULL)
  s <- session_get(sid, required = FALSE)
  if (!is.list(s)) return(NULL)
  .mrpl_declarado(s[["planner"]])
}

#' Su marca para el token de la cache del tablero: cambiar lo declarado en el
#' Planner tiene que recalcular el tablero.
#' @keywords internal
.mrpl_marca <- function(declarado) {
  if (!is.list(declarado)) return("sin_planner")
  claves <- vapply(declarado$variables, function(v) .monitoreo_scalar(v$clave, ""), "")
  paste0("planner:", declarado$declarado_en, ":", paste(claves, collapse = "+"))
}

#' Combina la declaración del Planner con las celdas del diseño.
#'
#' @param rep la representatividad del diseño (traducida o del escenario).
#' @param declarado lo que devuelve `.mrpl_declarado()`.
#' @return `rep` con universo y variables del Planner, `origen = "planner"` y
#'   `discrepancias` (lista, vacía si todo casa). Sin `declarado`, `rep` tal cual.
#' @keywords internal
.mrpl_combinar <- function(rep, declarado) {
  if (!is.list(declarado) || !length(declarado$variables)) return(rep)
  claves_planner <- vapply(declarado$variables, function(v) .monitoreo_scalar(v$clave, ""), "")
  celdas <- if (is.list(rep)) rep$celdas %||% list() else list()
  claves_celdas <- unique(unlist(lapply(celdas, function(c) names(c$valores %||% list()))))
  discrepancias <- list()
  for (k in setdiff(claves_planner, claves_celdas)) {
    discrepancias[[length(discrepancias) + 1L]] <- list(
      tipo = "variable_sin_celdas", variable = k,
      texto = sprintf("El Planner declara «%s» como variable de cuota y el diseño no reparte metas por ella.", k))
  }
  for (k in setdiff(claves_celdas, claves_planner)) {
    discrepancias[[length(discrepancias) + 1L]] <- list(
      tipo = "celdas_sin_variable", variable = k,
      texto = sprintf("El diseño reparte metas por «%s» y el Planner no la declara.", k))
  }
  base <- if (is.list(rep)) rep else list(schema = "representatividad_v1", celdas = list())
  base$universo <- declarado$universo %||% base$universo
  # Una variable del Planner sin categorías hereda las del diseño con la misma
  # clave: el Planner dice POR QUÉ se reparte; los valores los trae el marco.
  del_diseno <- if (is.list(rep)) rep$variables %||% list() else list()
  base$variables <- lapply(declarado$variables, function(v) {
    if (length(v$categorias)) return(v)
    par <- Filter(function(d) identical(.monitoreo_scalar(d$clave, ""), .monitoreo_scalar(v$clave, "")), del_diseno)
    if (length(par)) v$categorias <- par[[1L]]$categorias
    v
  })
  base$origen <- "planner"
  base$origen_celdas <- if (is.list(rep)) .monitoreo_scalar(rep$origen, "") else ""
  base$planner <- list(poblacion = declarado$poblacion, declarado_en = declarado$declarado_en)
  base$discrepancias <- discrepancias
  base
}
