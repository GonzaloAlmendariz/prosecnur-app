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
      # El rótulo del segmento: el que pide el cuerpo, la columna del archivo de marco o, sin archivo, el nombre
      # declarado con los estratos.
      c$segmentacion <- calc_str(rotulo_seg[[c$id]], if (nzchar(calc_str(cols$estrato, ""))) calc_str(cols$estrato, "") else calc_str(c$marco$variable_estrato, ""))
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
    # Cómo se reparte la meta de cada actor con base por persona o tabla de conteos (D8), elegido en Meta › Reparto.
    reparto = .cm_normalize_reparto(p$reparto),
    # Múltiplo al que se redondea una meta calculada desde un margen.
    redondeo = {
      r <- calc_int(p$redondeo, 1L, min = 1L)
      if (r %in% c(1L, 10L, 50L, 100L)) r else 1L
    }
  )
}

# Reparto por actor: list(<componente_id> = list(modo = celda|control|minimo, columna = "")).
.cm_normalize_reparto <- function(r) {
  if (!is.list(r) || is.null(names(r))) return(structure(list(), names = character(0)))
  r <- r[nzchar(names(r))]
  lapply(r, function(x) {
    x <- if (is.list(x)) x else list()
    list(modo = calc_enum(x$modo, c("celda", "control", "minimo"), "celda"), columna = calc_str(x$columna, ""))
  })
}

#' Cuotas de cada actor con marco y receta, por escenario, en la forma elegida en Meta (D8), como tabla larga.
#'
#' Cada fila lleva `componente_id` y `escenario` (posición de la propuesta) para cruzarla con su actor y su propuesta
#' sin depender de nombres. En control, la meta de cada segmento es la del reparto por fila (suma exacta) y la segunda
#' variable solo se mira, así que las filas van sin columna.
#'
#' @param ids componentes que entran en la propuesta (los demás no se reparten).
#' @param leer function(marco) -> data.frame del archivo del marco (el router lo lee de la sesión).
#' @return data.frame(componente_id, escenario, Público, Propuesta, Segmento, Columna, Población, Cuota, Forma) con
#'   attr "resumen" = data.frame(componente_id, escenario, meta, total, extra, poblacion, aviso), o NULL.
calc_muestra_propuesta_cuotas <- function(estudio, marcos, escenarios, reparto, leer, ids = NULL) {
  reparto <- .cm_normalize_reparto(reparto)
  filas <- list(); resumen <- list()
  for (comp in estudio$componentes %||% list()) {
    if (!is.null(ids) && !(comp$id %in% ids)) next
    marco <- marcos[[comp$id %||% ""]]
    if (is.null(marco) || is.null(marco$receta)) next
    r <- reparto[[comp$id]] %||% list(modo = "celda", columna = "")
    datos <- leer(marco)
    conteos <- identical(calc_str(marco$receta$tipo, ""), "conteos")
    cuotas_de <- function(meta, columna) if (conteos) calc_muestra_marco_cuotas_conteos(datos, marco$receta, meta, r$modo, 10L, columna) else
      calc_muestra_marco_cuotas(datos, marco$receta, meta, r$modo, 10L, columna)
    for (k in seq_along(escenarios %||% list())) {
      e <- escenarios[[k]]
      meta <- calc_int((e$metas %||% list())[[comp$id]], 0L, min = 0L)
      if (meta <= 0L) next
      aviso <- ""
      # Una segunda variable guardada que el marco ya no tiene no rompe la exportación: se reparte sin ella y se dice.
      out <- tryCatch(cuotas_de(meta, r$columna), api_error = function(err) {
        if (!nzchar(r$columna)) stop(err)
        aviso <<- sprintf("%s ya no tiene la variable %s: sus cuotas van sin ella.", calc_str(comp$actor, comp$id), r$columna)
        cuotas_de(meta, "")
      })
      cr <- out$cruce; cu <- out$cuotas
      control <- identical(cu$modo, "control")
      nombre_esc <- calc_str(e$nombre, "Escenario")
      forma <- switch(cu$modo, celda = "Por celda", minimo = "Por celda, mínimo 10",
                      control = sprintf("Por segmento, con control de %s", calc_str(cr$columna_variable, r$columna)))
      if (control) {
        for (f in cu$por_fila) filas[[length(filas) + 1L]] <- data.frame(
          componente_id = comp$id, escenario = k, `Público` = calc_str(comp$actor, comp$id), Propuesta = nombre_esc,
          Segmento = f$categoria, Columna = "", `Población` = as.integer(f$N), Cuota = as.integer(f$n), Forma = forma,
          check.names = FALSE)
      } else {
        cols <- if (length(cr$columnas)) cr$columnas else "Total"
        for (i in seq_along(cr$filas)) for (j in seq_along(cols)) {
          filas[[length(filas) + 1L]] <- data.frame(
            componente_id = comp$id, escenario = k, `Público` = calc_str(comp$actor, comp$id), Propuesta = nombre_esc,
            Segmento = cr$filas[i], Columna = if (nzchar(calc_str(cr$columna_variable, ""))) cols[j] else "",
            `Población` = as.integer(cr$conteos[i, j]), Cuota = as.integer(cu$cuotas[i, j]), Forma = forma, check.names = FALSE)
        }
      }
      resumen[[length(resumen) + 1L]] <- data.frame(
        componente_id = comp$id, escenario = k, meta = meta, total = as.integer(cu$total), extra = as.integer(cu$extra %||% 0L),
        poblacion = as.integer(sum(cr$conteos)), aviso = aviso, stringsAsFactors = FALSE)
    }
  }
  if (!length(filas)) return(NULL)
  out <- do.call(rbind, filas)
  attr(out, "resumen") <- do.call(rbind, resumen)
  out
}
