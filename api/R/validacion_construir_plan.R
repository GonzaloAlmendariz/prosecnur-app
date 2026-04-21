# construir_plan.R
# ------------------------------------------------------------------------------
# Orquestador en español para generar el Plan de Limpieza en una sola llamada.
# Requiere:
#   - read_xlsform()        [read_xlsform.R]
#   - acnur_config()        [plan_config.R]
#   - make_cleaning_plan()  [rule_factory.R]
#   - export_cleaning_plan() [export_plan.R] (opcional, recomendado)
# ------------------------------------------------------------------------------

#' Construir plan de limpieza desde un XLSForm
#'
#' @param ruta_xlsform Ruta al archivo XLSForm (.xlsx).
#' @param idioma Código de idioma para labels (ej. "es").
#' @param config Lista de configuración (por defecto acnur_config()).
#' @param incluir Lista de banderas para incluir bloques de reglas:
#'        list(requeridos=TRUE, otros=TRUE, relevantes=TRUE, restricciones=TRUE,
#'             calculos=TRUE, controles=TRUE, constantes=TRUE, atipicos=TRUE)
#' @param ruta_salida (opcional) Ruta para exportar a Excel. Si NULL, no exporta.
#' @param silencioso Si TRUE, reduce mensajes informativos.
#'
#' @return Lista con:
#'         - plan: tibble con el plan
#'         - resumen: tibble con conteo por tipo de observación
#'         - secciones: mapa de secciones/prefijos
#'         - meta: metadata del XLSForm
#' @family validacion
#' @export
construir_plan_limpieza <- function(
    ruta_xlsform,
    idioma = "es",
    config = acnur_config(),
    incluir = list(
      requeridos   = TRUE,
      otros        = TRUE,
      relevantes   = TRUE,
      restricciones = TRUE,
      calculos     = TRUE,
      controles    = TRUE,
      constantes   = TRUE,
      atipicos     = TRUE
    ),
    ruta_salida = NULL,
    silencioso = FALSE
) {
  # 1) Leer XLSForm
  if (!silencioso) message("Leyendo XLSForm: ", ruta_xlsform)
  x <- read_xlsform(ruta_xlsform, lang = idioma)

  # 2) Generar plan
  if (!silencioso) message("Generando plan de limpieza…")
  plan <- make_cleaning_plan(x, config = config, include = list(
    required   = incluir$requeridos,
    other      = incluir$otros,
    relevant   = incluir$relevantes,
    constraint = incluir$restricciones,
    calculate  = incluir$calculos,
    controls   = incluir$controles,
    constants  = incluir$constantes,
    outliers   = incluir$atipicos
  ))

  # 3) Resumen por tipo
  resumen <- plan %>%
    dplyr::count(`Tipo de observación`, name = "n_reglas") %>%
    dplyr::arrange(desc(n_reglas))

  if (!silencioso) {
    message("Total de reglas: ", nrow(plan))
    for (i in seq_len(nrow(resumen))) {
      message("  - ", resumen$`Tipo de observación`[i], ": ",
              resumen$n_reglas[i])
    }
  }

  # 4) Exportar si corresponde
  if (!is.null(ruta_salida)) {
    if (!silencioso) message("Exportando a Excel: ", ruta_salida)
    export_cleaning_plan(plan, x, path = ruta_salida)
  }

  # 5) Devolver
  list(
    plan = plan,
    resumen = resumen,
    secciones = x$meta$section_map,
    meta = x$meta
  )
}
