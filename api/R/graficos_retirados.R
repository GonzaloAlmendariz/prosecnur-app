# =============================================================================
# graficos_retirados.R — los tipos de gráfico retirados por el ADR 0137 (Fase 1: compatibilidad)
# =============================================================================
#
# El ADR 0137 retira la tabla de letras entre públicos y la familia de dimensiones. En la Fase 1 nada se borra:
#
#   - un plan guardado conserva `graficador` y `args` tal cual (sin migración, sin `project_dirty`, sin cambio de
#     formato del .pulso). Nada de lo de aquí pasa por `.graficos_migrar_plan()`: un aviso emitido ahí marcaría el
#     proyecto como modificado en cada GET de la config;
#   - validar: un tipo retirado es una advertencia, no un error (el export no se bloquea);
#   - reconstruir, miniaturas y vista previa: la ranura sale en blanco con su título y un aviso de la lámina. El aviso
#     no cita el ADR (llega al analista, no al cliente, pero tampoco hace falta);
#   - los presets `dim_*` guardados se ignoran sin aviso (`.graficos_retirados_quitar_presets`).
#
# La única excepción es `p_dim_heatmap` con una pregunta de respuesta única como objetivo: su equivalente 1:1 es
# «Mapa de calor por cruce» (`p_heatmap_cruce`, graficos_heatmap_cruce.R). Al reconstruir se redirige en memoria a ese
# tipo y el render decide: pregunta, se dibuja igual que antes; dimensión, en blanco con aviso. La migración que sí
# persiste el cambio vive en graficos_heatmap_cruce_migrar.R y la llama sólo el GET de la config.
#
# La tabla es de literales congelados: no consulta el registro, para que siga valiendo cuando la Fase 2 saque estos
# tipos de `.GRAFICADORES_META`.

.GRAFICADORES_RETIRADOS <- list(
  p_significancia_publicos = list(
    titulo_humano = "Diferencias significativas entre públicos",
    adr = "0137",
    reemplazo = list(texto = "las tarjetas de diferencias de un gráfico con cruce", graficador = "")
  ),
  p_dim_radar = list(
    titulo_humano = "Radar por dimensiones",
    adr = "0137",
    reemplazo = list(texto = "Media y rango sobre la columna del índice", graficador = "p_media_rango")
  ),
  p_dim_heatmap = list(
    titulo_humano = "Heatmap de dimensiones",
    adr = "0137",
    reemplazo = list(texto = "Media y rango sobre la columna del índice", graficador = "p_media_rango")
  ),
  p_dim_heatmap_criterios = list(
    titulo_humano = "Heatmap por criterios",
    adr = "0137",
    reemplazo = list(texto = "Tabla sobre los ítems de la dimensión", graficador = "p_tabla")
  ),
  p_dim_comparativo_radarbar = list(
    titulo_humano = "Radar + barras comparativo",
    adr = "0137",
    reemplazo = list(texto = "Media y rango sobre la columna del índice", graficador = "p_media_rango")
  ),
  p_dim_foda = list(
    titulo_humano = "Matriz FODA dimensional",
    adr = "0137",
    reemplazo = list(texto = "el FODA del Dashboard", graficador = "")
  ),
  p_dim_radar_tabla = list(
    titulo_humano = "Radar + tabla de dimensiones",
    adr = "0137",
    reemplazo = list(texto = "Media y rango sobre la columna del índice", graficador = "p_media_rango")
  )
)

# Presets de la familia de dimensiones: sólo los consumían los tipos retirados.
.GRAFICOS_PRESETS_RETIRADOS <- c("dim_heatmap", "dim_heatmap_criterios", "dim_radar", "dim_comparativo_radarbar",
                                 "dim_foda", "dim_radar_tabla")

#' ¿El graficador está retirado?
#' @keywords internal
.graficos_es_retirado <- function(graficador) {
  g <- as.character(graficador %||% "")
  g <- if (length(g)) g[[1]] else ""
  !is.na(g) && nzchar(g) && g %in% names(.GRAFICADORES_RETIRADOS)
}

#' Ficha congelada de un graficador retirado, o `NULL`
#' @keywords internal
.graficos_retirado_ficha <- function(graficador) {
  if (!.graficos_es_retirado(graficador)) return(NULL)
  .GRAFICADORES_RETIRADOS[[as.character(graficador)[[1]]]]
}

#' Texto del reemplazo de un retirado («Cámbialo por …»)
#' @keywords internal
.graficos_retirado_reemplazo_texto <- function(ficha) {
  r <- ficha$reemplazo %||% list()
  as.character(r$texto %||% "otro tipo de gráfico")[1]
}

#' Campo `retirados` del payload de GET /api/graficos/registry (aditivo)
#'
#' Una entrada por tipo retirado, en el orden de la tabla:
#' `{name, titulo_humano, adr, reemplazo: {texto, graficador}}`. `reemplazo$graficador` es `""` cuando no hay un tipo
#' del registro que lo reemplace (las tarjetas de diferencias, el FODA del Dashboard), como `preset_key`.
#' @keywords internal
.graficos_retirados_payload <- function() {
  I(lapply(names(.GRAFICADORES_RETIRADOS), function(nm) {
    f <- .GRAFICADORES_RETIRADOS[[nm]]
    list(
      name = nm,
      titulo_humano = f$titulo_humano,
      adr = f$adr,
      reemplazo = list(texto = f$reemplazo$texto, graficador = f$reemplazo$graficador)
    )
  }))
}

#' Advertencia de validación de una ranura con un tipo retirado
#'
#' @param tag Rótulo de la lámina («Lámina 3, “Título”»).
#' @param espacio Nombre visible de la ranura.
#' @param slot Ranura del plan (`graficador`, `args`).
#' @param inst_sources Instrumentos por base, para reconocer el `p_dim_heatmap` que pasa a «Mapa de calor por cruce».
#' @keywords internal
.graficos_retirado_aviso_validacion <- function(tag, espacio, slot, inst_sources = NULL) {
  ficha <- .graficos_retirado_ficha(slot$graficador)
  if (is.null(ficha)) return(character(0))
  args <- .graficos_unwrap_scalar_refs(.as_json_list(slot$args) %||% list())
  if (identical(as.character(slot$graficador)[1], "p_dim_heatmap") &&
      .hm_cruce_objetivo_es_pregunta_inst(args$objetivo, args$cruce, inst_sources)) {
    return(sprintf("%s: el espacio \"%s\" usa \"%s\", que ya no existe; sale como \"%s\", con las mismas cifras.",
                   tag, espacio, ficha$titulo_humano, .HM_CRUCE_TITULO))
  }
  sprintf("%s: el espacio \"%s\" usa \"%s\", que ya no existe; sale en blanco. Cámbialo por %s.",
          tag, espacio, ficha$titulo_humano, .graficos_retirado_reemplazo_texto(ficha))
}

#' Aviso de lámina de un gráfico retirado que sale en blanco
#' @keywords internal
.graficos_retirado_avisar_blanco <- function(ficha) {
  .pulso_aviso(.aviso_en_lamina(sprintf(
    "el gráfico \"%s\" ya no existe y sale en blanco. Cámbialo por %s.",
    ficha$titulo_humano, .graficos_retirado_reemplazo_texto(ficha))))
}

#' Ranura en blanco con el título del gráfico
#' @keywords internal
.graficos_retirado_blanco <- function(args = list()) {
  t <- args$titulo
  if (is.list(t)) t <- t$text %||% t[[1]]
  t <- as.character(t %||% "")
  t <- if (length(t) && !is.na(t[1]) && nzchar(trimws(t[1]))) trimws(t[1]) else NULL
  p_ggplot_raw(ggplot2::ggplot() + ggplot2::theme_void(), titulo = t)
}

#' Qué hacer con una ranura antes de reconstruirla: nada, en blanco o redirigida a otro graficador
#'
#' Se llama ANTES del chequeo del registro y de `getExportedValue()` en los tres rearmados (`.rebuild_graf`,
#' `.graficos_rebuild_graf_json` y el de las miniaturas). No toca el plan: decide sobre una copia.
#'
#' @param graficador Nombre resuelto del graficador.
#' @param args `args` de la ranura (ya desenvueltos).
#' @return `list(accion = "seguir")`, `list(accion = "blanco", elemento)` o
#'   `list(accion = "redirigir", graficador, args, retirado_de)`.
#' @keywords internal
.graficos_retirado_resolver <- function(graficador, args) {
  ficha <- .graficos_retirado_ficha(graficador)
  if (is.null(ficha)) return(list(accion = "seguir"))
  args <- if (is.list(args)) args else list()
  if (identical(as.character(graficador)[1], "p_dim_heatmap")) {
    nuevos <- .hm_cruce_args_desde_dim_heatmap(args)
    if (!is.null(nuevos)) {
      return(list(accion = "redirigir", graficador = "p_heatmap_cruce", args = nuevos, retirado_de = "p_dim_heatmap"))
    }
  }
  .graficos_retirado_avisar_blanco(ficha)
  list(accion = "blanco", elemento = .graficos_retirado_blanco(args))
}

#' Marca el elemento armado por una redirección con el tipo retirado del que vino
#'
#' El render de `p_heatmap_cruce` lo lee: si el objetivo no es una pregunta, la ranura sale en blanco con el aviso del
#' retiro en vez de «Sin datos».
#' @keywords internal
.graficos_retirado_marcar <- function(el, decision) {
  if (identical(decision$accion, "redirigir") && is.list(el)) el$.retirado_de <- decision$retirado_de
  el
}

#' Quita de los presets guardados las familias que sólo usaban los tipos retirados, sin aviso
#' @keywords internal
.graficos_retirados_quitar_presets <- function(presets) {
  if (!is.list(presets) || is.null(names(presets))) return(presets)
  presets[setdiff(names(presets), .GRAFICOS_PRESETS_RETIRADOS)]
}
