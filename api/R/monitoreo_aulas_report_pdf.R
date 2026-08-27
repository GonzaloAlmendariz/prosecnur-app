# El reporte de avance a cliente del perfil de aulas universitarias.
#
# Gonzalo pidió la misma tabla en tres soportes: «una en avance y las otras dos
# en un PDF para poder enviarlos a sus correos y un excel para poder
# compartírselos». El Excel es la hoja «Cómo va el campo» del libro y la
# pantalla es `AulasAvanceParaCliente`; esto es el tercero.
#
# POR QUÉ HACE FALTA UN MODELO PROPIO
#
# `.monitoreo_client_report_model_for_snapshot()` ramifica en tres y aulas caía
# al de ACREDITACIÓN por descarte —no a un genérico—. Ese modelo y su
# renderizador hablan de `actors`, `daily_actor` y `channel_labels`: reusarlo
# obligaría a llamar «actores» a las facultades, que es el defecto que este
# perfil ya arrastra con las tasas homónimas. Ver
# `docs/qa/checklist-monitoreo-criterios-2026-08-26.md` § T8c.
#
# EL CONTENIDO NO SE RECALCULA
#
# La tabla la decide `.calaf_avance_por_facultad()`, la misma que escribe la
# hoja del libro. Si este modelo la rehiciera, habría tres tablas del mismo
# nombre con cifras distintas — exactamente lo que las tres formas existen para
# evitar.

#' Modelo del PDF de avance de aulas.
#'
#' @param snapshot snapshot de Monitoreo (`data`, `synced_at`).
#' @param cfg config de Monitoreo ya normalizada o normalizable.
#' @param include_targets si el documento incluye metas.
#' @return lista con `report_kind`, `facultades`, `total` y la procedencia.
#' @export
build_monitoreo_aulas_report_model <- function(snapshot, cfg, include_targets = FALSE) {
  if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) {
    stop_api(409, "E_NO_MONITOREO_DATA", "Sincroniza datos antes de generar el reporte de avance.")
  }
  aulas_cfg <- (cfg$aulas_universitarias %||% cfg)
  plan <- aulas_cfg$plan %||% list()
  if (!length(plan)) {
    stop_api(409, "E_AULAS_SIN_PLAN", "El estudio no trae plan de cursos-horario del que informar.")
  }
  data <- snapshot$data
  efectivas <- monitoreo_aulas_efectivas_por_aula(plan, data, aulas_cfg)
  validas <- .monitoreo_aulas_valid_response(data, aulas_cfg)

  # UNA sola fuente del contenido: la misma función que escribe la hoja del
  # libro. No se recalcula aquí.
  facultades <- .calaf_avance_por_facultad(
    plan, efectivas = efectivas, cuotas = aulas_cfg$design_targets,
    responses = data, validas = validas, cfg = aulas_cfg
  )

  # Sin cuotas del diseño no hay avance que informar a un cliente: se dice, no
  # se publica un documento con ceros que se leerían como medidos.
  if (is.null(facultades) || !nrow(facultades)) {
    stop_api(409, "E_AULAS_SIN_CUOTAS",
             "El estudio no trae la cuota del diseño por facultad: sin ella el reporte de avance no se puede afirmar.")
  }

  suma <- function(col) sum(suppressWarnings(as.numeric(facultades[[col]])), na.rm = TRUE)
  muestra <- suma("Muestra")
  conseguidas <- suma("Conseguidas")

  list(
    report_kind = "aulas_advance_pdf",
    family = "aulas_universitarias",
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    synced_at = .monitoreo_scalar(snapshot$synced_at %||% "", ""),
    include_targets = isTRUE(include_targets),
    facultades = facultades,
    total = list(
      muestra = muestra,
      conseguidas = conseguidas,
      avance = if (muestra > 0) conseguidas / muestra else NA_real_,
      # Los faltantes se SUMAN por facultad y no se netean: pasarse en una no
      # cubre lo que falta en otra (ADR 0079). Un neto siempre sale más
      # favorable y es el número que un cliente citaría.
      faltan = suma("Faltan"),
      facultades_abiertas = sum(suppressWarnings(as.numeric(facultades$Faltan)) > 0, na.rm = TRUE),
      aulas_aplicadas = suma("Aulas aplicadas"),
      aulas_del_plan = suma("Aulas del plan")
    ),
    # La procedencia viaja con el documento: quien lo reciba tiene que poder
    # saber contra qué se midió sin preguntar.
    criterio = list(
      denominador = "la cuota de alumnos que el diseño fijó por facultad",
      numerador = "las respuestas que llegaron a la plataforma y pasaron los filtros del estudio",
      no_cubre = "La sobremuestra operativa no viaja a Monitoreo, así que este reporte no la compara."
    )
  )
}
