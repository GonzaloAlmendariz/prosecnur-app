# =============================================================================
# Sugeridas al mirar la base: atributos del recopilador y respuestas repetidas
# (ítem 51, puntos 5 y 6)
# =============================================================================
# Atributos del recopilador. Con el rol de recopilador declarado
# (`operational_config$identity$agent_variable`), una columna es un atributo
# de quien recolecta (su sexo, su DNI, su sede) si casi siempre trae un solo
# valor por persona: en el 98 % o más de los casos el valor es el más
# frecuente de su recopilador, y no es el mismo para todos (al menos dos
# valores distintos entre recopiladores). Se propone "Valor distinto al
# habitual en su grupo" con el recopilador como grupo. La medida es la de la
# regla (`moda_grupo_revisar()`), con sus umbrales por defecto. Sin el rol
# declarado no se propone: adivinar la columna del recopilador obligaría a
# nombrar variables de un estudio.
#
# Respuestas repetidas. Una columna que por su contenido parece teléfono o DNI
# (la función de Carga, `.recon_personal_por_contenido()`) y cuyos valores
# son casi únicos (el 90 % o más distintos) identifica a una persona: un mismo
# número en dos encuestas es una persona encuestada dos veces o un número mal
# copiado. Se propone "Respuestas repetidas" sin contar los vacíos.
#
# Base y cifra: ver reglas_custom_semilla_comun.R.
# =============================================================================

.SEMILLA_RECOP_CONSTANCIA <- 0.98   # parte de casos con el valor habitual de su recopilador
.SEMILLA_RECOP_MIN_GRUPOS <- 3L     # recopiladores con referencia
.SEMILLA_REPETIDOS_UNICOS <- 0.9    # parte de valores distintos para tratar la columna como identificador

#' Proponer "Valor distinto al habitual" para los atributos del recopilador
#'
#' @param data data.frame de la base cargada.
#' @param config `operational_config` de la base.
#' @param survey hoja `survey`; opcional, solo para nombrar.
#' @param reglas_existentes reglas propias ya definidas en el scope.
#' @return lista de propuestas sin cifra.
#' @keywords internal
reglas_semilla_recopilador <- function(data, config = NULL, survey = NULL, reglas_existentes = list()) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  rec <- as.character((config$identity %||% list())$agent_variable %||% "")[1]
  if (is.na(rec) || !nzchar(rec) || !(rec %in% names(data))) return(list())
  llaves <- as.character(unlist((config$identity %||% list())$variables %||% list()))
  cols <- setdiff(.semilla_columnas_mirables(data), c(rec, llaves))
  out <- list()
  g_txt <- .semilla_texto(data[[rec]])
  for (v in cols) {
    # Criba rápida con el texto tal cual; la medida que decide es la de la regla.
    x <- .semilla_texto(data[[v]])
    ok <- !is.na(x) & !is.na(g_txt)
    if (sum(ok) < .SEMILLA_FECHAS_MIN) next
    tab <- table(g_txt[ok], x[ok])
    if (sum(apply(tab, 1L, max)) / sum(tab) < .SEMILLA_RECOP_CONSTANCIA - 0.05) next
    med <- moda_grupo_revisar(data[[rec]], data[[v]])
    g <- med$grupos[med$grupos$estado == "evaluable", , drop = FALSE]
    if (nrow(g) < .SEMILLA_RECOP_MIN_GRUPOS) next
    if (length(unique(g$moda)) < 2L) next
    n_ok <- sum(med$estado == "ok"); n_marca <- sum(med$estado == "marca")
    if (!n_marca || n_ok / (n_ok + n_marca) < .SEMILLA_RECOP_CONSTANCIA) next
    if (.semilla_moda_cubierta(reglas_existentes, rec, v)) next
    tv <- .semilla_nombrar_var(v, survey); tr <- .semilla_nombrar_var(rec, survey)
    out[[length(out) + 1L]] <- list(
      tipo = "moda_en_grupo",
      variables = list(),
      params = list(grupo = rec, valor = v),
      nombre = sprintf("%s distinto al habitual de su recopilador", tv),
      mensaje = sprintf("%s no es el que trae casi siempre su recopilador.", tv),
      severidad = "advertencia", activa = TRUE, hallazgo_kind = "caso_validar",
      planned_action_type = "ignore_rule", origen = "sembrado",
      semilla = list(
        origen = "recopilador_moda", variable = v, grupo = rec, valor = v,
        n_grupos = as.integer(nrow(g)),
        porque = sprintf(paste("%s es un dato de quien recolecta: en %d de %d casos (%s) es el valor más frecuente de su recopilador (%s),",
                               "y cambia entre recopiladores. La regla marca los casos con otro valor."),
                         v, n_ok, n_ok + n_marca, .semilla_pct(n_ok, n_ok + n_marca), rec))
    )
  }
  out
}

# "teléfono" o "DNI" si la columna lo parece por su contenido; NULL si no.
.semilla_repetidos_tipo <- function(x) {
  causa <- .recon_personal_por_contenido(.recon_personal_valores(x))
  if (is.null(causa)) return(NULL)
  if (startsWith(causa, "Parece teléfono")) return("teléfono")
  if (startsWith(causa, "Parece DNI")) return("DNI")
  NULL
}

#' Proponer "Respuestas repetidas" en teléfonos y documentos
#'
#' @param data data.frame de la base cargada.
#' @param config `operational_config`; sus llaves de caso no se proponen (ya
#'   las revisa el control de duplicados).
#' @param survey hoja `survey`; opcional, solo para nombrar.
#' @param reglas_existentes reglas propias ya definidas en el scope.
#' @return lista de propuestas sin cifra.
#' @keywords internal
reglas_semilla_repetidos <- function(data, config = NULL, survey = NULL, reglas_existentes = list()) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  llaves <- as.character(unlist((config$identity %||% list())$variables %||% list()))
  out <- list()
  for (v in setdiff(.semilla_columnas_mirables(data), llaves)) {
    x <- .semilla_texto(data[[v]])
    con <- x[!is.na(x)]
    if (length(con) < .SEMILLA_FECHAS_MIN) next
    tipo <- .semilla_repetidos_tipo(data[[v]])
    if (is.null(tipo)) next
    n_dist <- length(unique(con))
    if (n_dist / length(con) < .SEMILLA_REPETIDOS_UNICOS || n_dist == length(con)) next
    if (.semilla_ya_cubierta(reglas_existentes, "duplicados", v)) next
    tv <- .semilla_nombrar_var(v, survey)
    out[[length(out) + 1L]] <- list(
      tipo = "duplicados",
      variables = list(v),
      params = list(missing_key_policy = "ignore_missing"),
      nombre = sprintf("%s repetido", tv),
      mensaje = sprintf("El mismo %s aparece en otra encuesta.", tipo),
      severidad = "advertencia", activa = TRUE, hallazgo_kind = "caso_validar",
      planned_action_type = "ignore_rule", origen = "sembrado",
      semilla = list(
        origen = "repetidos", variable = v, parece = tipo,
        porque = sprintf(paste("%s parece %s por su contenido y casi no se repite: %d valores distintos en %d casos con dato.",
                               "Un mismo número en dos encuestas es la misma persona encuestada dos veces o un número mal copiado."),
                         v, tipo, n_dist, length(con)))
    )
  }
  out
}
