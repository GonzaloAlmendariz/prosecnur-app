# =============================================================================
# Sugeridas al mirar la base: lugares en el catálogo de ubigeos (ítem 51,
# punto 3)
# =============================================================================
# Qué columna es departamento, provincia, distrito o ubigeo lo decide el
# contenido, con la misma función que propone los papeles en el editor de la
# regla (`catalogo_ubigeo_proponer_roles()`): el nombre de la columna no
# interviene. Por cada grupo de lugar con dos papeles o más y coherencia alta
# (el 80 % o más de las filas revisadas cuadran con el catálogo,
# `.SEMILLA_LUGAR_COHERENCIA`) se propone "Combinación fuera de catálogo".
#
# Si el grupo trae ubigeo y distrito, se propone además "Valor distinto al
# habitual en su grupo" con el distrito como grupo y el ubigeo como valor: el
# catálogo no ve una base que escribe todos los ubigeos de un distrito con el
# mismo código equivocado, ni un ubigeo correcto puesto en otra encuesta del
# mismo distrito; la moda sí ve lo segundo.
#
# Base y cifra: ver reglas_custom_semilla_comun.R.
# =============================================================================

.SEMILLA_LUGAR_COHERENCIA <- 0.8
.SEMILLA_LUGAR_DISTINTOS <- 0.5   # más valores distintos que esto, por caso con dato, es texto casi único

.SEMILLA_LUGAR_PAPEL_TXT <- c(departamento = "departamento", provincia = "provincia",
                              distrito = "distrito", ubigeo = "ubigeo")

# Columnas que pueden ser lugar: ni opción única o múltiple ni fecha del
# formulario, no una columna de números cortos (una escala, un conteo) y no
# texto casi único (nombres, direcciones, comentarios): un lugar se repite.
.semilla_lugar_columnas <- function(data, survey) {
  cols <- .semilla_columnas_mirables(data)
  if (is.data.frame(survey) && all(c("name", "type_base") %in% names(survey))) {
    tipo <- as.character(survey$type_base)[match(cols, survey$name)]
    cols <- cols[is.na(tipo) | !tipo %in% c("select_one", "select_multiple", "date", "datetime", "time")]
  }
  Filter(function(v) {
    x <- .semilla_texto(data[[v]])
    x <- x[!is.na(x)]
    length(x) >= 1L && !all(grepl("^[0-9]{1,4}$", x)) &&
      length(unique(x)) <= .SEMILLA_LUGAR_DISTINTOS * length(x)
  }, cols)
}

.semilla_lugar_lista_txt <- function(x) {
  if (length(x) <= 1L) return(paste(x, collapse = ""))
  paste(paste(utils::head(x, -1), collapse = ", "), "y", utils::tail(x, 1))
}

#' Proponer reglas de catálogo de ubigeos y de moda de ubigeo por distrito
#'
#' @param data data.frame de la base cargada.
#' @param survey hoja `survey`; opcional.
#' @param reglas_existentes reglas propias ya definidas en el scope.
#' @param catalogo id del catálogo.
#' @return lista de propuestas sin cifra.
#' @keywords internal
reglas_semilla_lugar <- function(data, survey = NULL, reglas_existentes = list(),
                                 catalogo = "ubigeo_peru") {
  if (!is.data.frame(data) || nrow(data) < 5L) return(list())
  cols <- .semilla_lugar_columnas(data, survey)
  if (length(cols) < 2L) return(list())
  pr <- catalogo_ubigeo_proponer_roles(data, catalogo, columnas = cols)
  partes <- stats::setNames(pr$columnas, vapply(pr$columnas, `[[`, character(1), "columna"))
  out <- list()
  for (g in pr$propuestas) {
    roles <- unlist(g$roles)
    roles <- roles[!is.na(roles)]
    if (length(roles) < 2L || !is.finite(g$coherencia) || g$coherencia < .SEMILLA_LUGAR_COHERENCIA) next
    vars <- unname(roles)
    detalle <- vapply(names(roles), function(papel) {
      p <- partes[[roles[[papel]]]]$parte[[papel]] %||% NA_real_
      sprintf("%s es %s (%s de sus valores en el catálogo)", roles[[papel]], .SEMILLA_LUGAR_PAPEL_TXT[[papel]],
              .semilla_pct(p, 1))
    }, character(1))
    if (!.semilla_ya_cubierta_conjunto(reglas_existentes, "combinacion_catalogo", vars)) {
      out[[length(out) + 1L]] <- list(
        tipo = "combinacion_catalogo",
        variables = list(),
        params = list(roles = as.list(roles), catalogo = catalogo),
        nombre = sprintf("Lugar fuera del catálogo de ubigeos: %s", .semilla_lugar_lista_txt(vars)),
        mensaje = "La combinación de lugar no existe en el catálogo de ubigeos.",
        severidad = "advertencia", activa = TRUE, hallazgo_kind = "caso_validar",
        planned_action_type = "ignore_rule", origen = "sembrado",
        semilla = list(
          origen = "lugar_catalogo", variable = vars[1], roles = as.list(roles),
          coherencia = g$coherencia,
          porque = sprintf("Por su contenido, %s. La combinación cuadra con el catálogo en el %s de los casos revisados; la regla marca los que no cuadran.",
                           .semilla_lugar_lista_txt(detalle), .semilla_pct(g$coherencia, 1)))
      )
    }
    if (all(c("ubigeo", "distrito") %in% names(roles))) {
      ub <- roles[["ubigeo"]]; di <- roles[["distrito"]]
      # Las dos direcciones: el ubigeo que no es el de su distrito (un código
      # que existe, puesto en otra encuesta) y el distrito que no es el de su
      # ubigeo (un nombre mal escrito o de otro lugar).
      for (par in list(c(grupo = di, valor = ub), c(grupo = ub, valor = di))) {
        out[[length(out) + 1L]] <- .semilla_lugar_moda(data, par[["grupo"]], par[["valor"]], survey, reglas_existentes)
      }
    }
  }
  Filter(Negate(is.null), out)
}

# ¿Ya hay una regla de moda con este grupo y este valor?
.semilla_moda_cubierta <- function(reglas, grupo, valor) {
  any(vapply(reglas %||% list(), function(r) {
    identical(as.character(r$tipo %||% "")[1], "moda_en_grupo") &&
      identical(as.character((r$params %||% list())$grupo %||% "")[1], grupo) &&
      identical(as.character((r$params %||% list())$valor %||% "")[1], valor)
  }, logical(1)))
}

.semilla_lugar_moda <- function(data, grupo, valor, survey, reglas_existentes) {
  if (.semilla_moda_cubierta(reglas_existentes, grupo, valor)) return(NULL)
  params <- list(grupo = grupo, valor = valor)
  med <- .regla_moda_revisar_df(data, params)
  n_eval <- sum(med$grupos$estado == "evaluable")
  if (!n_eval) return(NULL)
  tv <- .semilla_nombrar_var(valor, survey); tg <- .semilla_nombrar_var(grupo, survey)
  list(
    tipo = "moda_en_grupo",
    variables = list(),
    params = params,
    nombre = sprintf("%s distinto al habitual para su %s", tv, .semilla_en_frase(tg)),
    mensaje = sprintf("%s no es el que traen casi todas las encuestas con el mismo %s.", tv, .semilla_en_frase(tg)),
    severidad = "advertencia", activa = TRUE, hallazgo_kind = "caso_validar",
    planned_action_type = "ignore_rule", origen = "sembrado",
    semilla = list(
      origen = "lugar_moda", variable = valor, grupo = grupo, valor = valor,
      n_grupos = as.integer(n_eval),
      porque = sprintf(paste("%s y %s son el lugar del caso. En %d valores de %s con %d encuestas o más, el %s más frecuente reúne al menos el %d %%;",
                             "la regla marca la encuesta con otro %s. El catálogo no marca una combinación que existe aunque no sea la habitual; esta regla sí."),
                       grupo, valor, n_eval, grupo, .REGLA_MODA_N_DEFECTO, valor,
                       as.integer(.REGLA_MODA_APOYO_DEFECTO), valor))
  )
}
