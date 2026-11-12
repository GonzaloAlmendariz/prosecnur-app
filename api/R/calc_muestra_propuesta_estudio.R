# La propuesta (PPT y Excel de escenarios) armada desde el estudio de Cálculo de muestra de la sesión, para que la app
# la genere sin scripts (pedido de Gonzalo, 2026-11-11: "ahora asegúrate que Cálculo de muestra pueda hacer ello").
#
# Cada escenario declara la meta de cada actor; el resto sale del estudio: N, canal, respuesta esperada y los
# segmentos del archivo de marco (Selección > Archivo del marco), con el nombre de su columna como criterio.

.CMP_ACTORES_CUANTITATIVOS <- c("estudiantes", "docentes", "administrativos", "egresados")

#' Propuesta lista para `calc_muestra_propuesta_ppt()` / `_xlsx()` desde el estudio y el cuerpo de la ruta.
#'
#' @param estudio Estudio de Cálculo de muestra (con la identidad del Planner).
#' @param marcos `estado$marcos` de Muestra general (columnas declaradas por actor).
#' @param body list(escenarios = list(list(nombre, metas = list(<componente_id> = n))), minimo_segmento,
#'   incluir_portada, incluir_diseno, solicitante, referencia_rotulo, segmentacion = list(<id> = "Facultad"),
#'   control = c(<id>...)).
#' @return La propuesta.
calc_muestra_propuesta_desde_estudio <- function(estudio, marcos, body) {
  comps <- Filter(function(c) {
    calc_int(c$marco$marco_validado, 0L, min = 0L) > 0L &&
      (calc_str(c$actor_categoria, "otros") %in% .CMP_ACTORES_CUANTITATIVOS || !nzchar(calc_str(c$actor_categoria, "")))
  }, estudio$componentes %||% list())
  if (!length(comps)) {
    stop_api(409, "E_CALC_MUESTRA_PROPUESTA_SIN_ACTORES",
             "Declara el N de al menos un actor antes de armar la propuesta.")
  }
  escenarios <- body$escenarios %||% list()
  if (!length(escenarios) || length(escenarios) > 4L) {
    stop_api(400, "E_CALC_MUESTRA_PROPUESTA_ESCENARIOS", "La propuesta lleva entre uno y cuatro escenarios.")
  }
  piso <- calc_int(body$minimo_segmento, 0L, min = 0L)
  rotulo_seg <- body$segmentacion %||% list()
  control <- as.character(unlist(body$control %||% list()))
  armar <- function(esc) {
    metas <- esc$metas %||% list()
    list(nombre = calc_str(esc$nombre, "Escenario"), componentes = lapply(comps, function(c) {
      meta <- calc_int(metas[[c$id]], 0L, min = 0L)
      cols <- .cm_general_columnas((marcos[[c$id]] %||% list())$columnas)
      c$meta <- list(valor = meta, tipo = "cuota", origen = if (meta > 0L) "usuario" else "")
      c$parametros$n_minimo_estrato <- piso
      c$segmentacion <- calc_str(rotulo_seg[[c$id]], cols$estrato)
      c$uso_segmentos <- if (c$id %in% control) "control" else "reporte"
      c
    }))
  }
  list(
    # Un estudio sin nombre en la Ficha llega con titulo "": la portada no admite título vacío.
    titulo = if (nzchar(calc_str(estudio$titulo, ""))) calc_str(estudio$titulo, "") else "Diseño muestral",
    subtitulo = "Propuesta técnica: diseño muestral",
    fecha = calc_str(body$fecha, format(Sys.Date(), "%d/%m/%Y")),
    solicitante = if (nzchar(calc_str(body$solicitante, ""))) calc_str(body$solicitante, "") else NULL,
    referencia_rotulo = calc_str(body$referencia_rotulo, ""),
    minimo_segmento = piso,
    incluir_portada = !isFALSE(body$incluir_portada),
    incluir_diseno = !isFALSE(body$incluir_diseno),
    escenarios = lapply(escenarios, armar)
  )
}

# Las propuestas que el usuario arma en Acreditación › Resultados › Propuesta viajan en el workspace del estudio (y por
# eso en el `.pulso`): sin esta entrada el workspace, que es whitelist, las borraba en cada guardado. Hasta cuatro
# escenarios, cada uno con su nombre y la meta de cada actor por `componente_id`.
.cm_normalize_workspace_propuesta <- function(p) {
  if (is.null(p) || !is.list(p)) return(NULL)
  escenarios <- lapply(p$escenarios %||% list(), function(e) {
    if (!is.list(e)) return(NULL)
    metas <- e$metas
    ids <- names(metas)
    metas <- if (is.list(metas) && !is.null(ids)) {
      metas <- metas[nzchar(ids)]
      lapply(metas, function(v) calc_int(v, 0L, min = 0L))
    } else {
      structure(list(), names = character(0))
    }
    list(nombre = calc_str(e$nombre, ""), metas = metas)
  })
  escenarios <- Filter(Negate(is.null), escenarios)
  if (length(escenarios) > 4L) escenarios <- escenarios[seq_len(4L)]
  list(
    escenarios = escenarios,
    solicitante = calc_str(p$solicitante, ""),
    incluir_portada = !isFALSE(p$incluir_portada),
    incluir_diseno = !isFALSE(p$incluir_diseno),
    # Múltiplo al que se redondea una meta calculada desde un margen.
    redondeo = {
      r <- calc_int(p$redondeo, 1L, min = 1L)
      if (r %in% c(1L, 10L, 50L, 100L)) r else 1L
    }
  )
}
