# La regla y la familia llegan al render: export, Word y vista previa (ADR 0128 «Consecuencias»)
# =============================================================================================
#
# El render no recibe la regla por argumentos (`reporte_plan_ppt.R` está congelado). La lee de la opción
# `prosecnur.sig_informe`, que fijan:
#
# - el worker del export PPT y del Word (`.sig_informe_preparar`), con la familia calculada en el propio worker sobre
#   la base que va a renderizar;
# - la vista previa, que la incluye en `opciones_motor`: entra a la huella de la miniatura (cambiar la regla
#   invalida la caché) y viaja al worker asíncrono, que ya aplica esas opciones.
#
# La opción lleva solo la regla y la tabla de BH (vector de p y q), nunca las evaluaciones: pesa unos pocos KB.

#' Argumento que el router pasa al worker: lo que determina la regla y la familia
#' @keywords internal
.sig_arg_job <- function(sid, cfg, plan = NULL) {
  ac <- tryCatch(.analitica_get_config(sid), error = function(e) list())
  list(significancia = list(
    equivalencias_publicos = .tpub_equivalencias_sesion(sid),   # ADR 0138: qué temas están declarados entre públicos
    graficos_config = list(significancia = cfg$significancia %||% NULL, plan = plan %||% cfg$plan),
    analitica_config = list(cruces_vars = ac$cruces_vars %||% list(), secciones = ac$secciones %||% list(),
                            cruces = list(cruces_vars = ac$cruces$cruces_vars %||% list(),
                                          significancia = ac$cruces$significancia %||% NULL))
  ))
}

#' Contexto liviano para la opción del proceso
#' @keywords internal
.sig_contexto_liviano <- function(ctx) {
  if (is.null(ctx)) return(NULL)
  out <- list(regla = ctx$regla, origen = ctx$origen, familia = ctx$familia, m = ctx$m, cruces = ctx$cruces)
  if (!is.null(ctx$familias)) out$familias <- ctx$familias   # «Familia por base»: sólo si el plan lee otras bases
  out
}

#' Fija la regla y la familia en el worker; devuelve las opciones previas para `on.exit(options(...))`
#' @keywords internal
.sig_informe_preparar <- function(significancia, data_sources, inst_sources, base = "") {
  previa <- list(prosecnur.sig_informe = getOption("prosecnur.sig_informe"))
  .tarjetas_fuente_fijar(NULL, NULL)   # ADR 0129: cada export empieza sin tarjetas registradas de otro
  if (!is.list(significancia)) {
    message("[diferencias] el worker no recibió la regla del estudio: cada entregable usa la prueba de siempre.")
    return(previa)
  }
  ds <- if (is.character(data_sources)) readRDS(data_sources) else data_sources
  is <- if (is.character(inst_sources)) readRDS(inst_sources) else inst_sources
  if (is.data.frame(ds)) { ds <- list(default = ds); is <- list(default = is) }
  nombre <- if (nzchar(base %||% "") && base %in% names(ds)) base else names(ds)[[1]]
  .tarjetas_fuente_fijar(ds[[nombre]], is[[nombre]])   # ADR 0129: la tarjeta de ejemplo de la lectura
  ctx <- tryCatch(
    .sig_contexto_estudio_base(ds[[nombre]], is[[nombre]], significancia$graficos_config, significancia$analitica_config,
                               nombre, nombre, names(ds)),
    error = function(e) {
      message("[diferencias] no se pudo calcular la familia: ", conditionMessage(e))
      if (exists(".pulso_aviso", mode = "function")) {
        .pulso_aviso(sprintf("Diferencias: no se pudo calcular la familia del informe (%s); cada lámina se corrige sola.",
                             conditionMessage(e)))
      }
      NULL
    }
  )
  if (!is.null(ctx)) {
    # «Familia por base» (ADR 0128): la ranura de otra base se marca contra la familia de SU base, no la de la activa.
    ctx$familias <- tryCatch(
      .sig_familias_otras_bases(ds, is, significancia$graficos_config, significancia$analitica_config, nombre),
      error = function(e) { message("[diferencias] no se pudo calcular la familia de otra base: ", conditionMessage(e)); NULL })
    message(sprintf("[diferencias] base %s: %s con %s, familia de %d comparaciones.", nombre, ctx$regla$prueba,
                    ctx$regla$correccion, as.integer(ctx$m %||% 0L)))
  }
  # H14: las preguntas clave del plan del pedido viajan en el mismo contexto (graficos_preguntas_clave.R).
  ctx_l <- .preguntas_clave_en_contexto(.sig_contexto_liviano(ctx), significancia$graficos_config$plan$preguntas_clave, nombre)
  # ADR 0138: la matriz de equivalencias y la familia entre públicos (propia, nunca la de la base) viajan al render.
  .sig_informe_activar(.tpub_en_contexto(ctx_l, significancia$graficos_config$plan, list(data_sources = ds, inst_sources = is),
                                         significancia$equivalencias_publicos))
  previa
}

#' Opciones del motor para la vista previa, con el contexto de diferencias de la sesión
#' @keywords internal
.sig_opciones_preview <- function(sid, opciones) {
  ctx <- tryCatch({
    sc <- .sig_contexto_sesion(sid)
    .tpub_en_contexto(.sig_contexto_liviano(sc$ctx), sc$cfg$plan, function() .graficos_processing_sources(sid), .tpub_equivalencias_sesion(sid))   # ADR 0138
  }, error = function(e) NULL)
  opciones[["prosecnur.sig_informe"]] <- ctx
  opciones[order(names(opciones), method = "radix")]
}
