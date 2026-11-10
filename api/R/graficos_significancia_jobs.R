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
  if (!is.null(ctx$base_familia)) out$base_familia <- ctx$base_familia   # «Familia por base»: sólo en multibase
  if (!is.null(ctx$familias)) out$familias <- ctx$familias
  if (!is.null(ctx$madre)) out$madre <- ctx$madre   # hija repeat: el contexto de su madre (reporte_cruces_grano.R)
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
  gc <- significancia$graficos_config; ac <- significancia$analitica_config
  ctx <- tryCatch(
    # Dos caminos que entraron por separado y aquí se juntan (fusión del 2026-11-10):
    # - hija repeat: su familia hereda la de la madre (reporte_cruces_grano.R);
    # - el resto, ADR 0128 «Familia por base»: una regla para todo el informe y la familia de la activa sobre sus ranuras.
    if (is.list(attr(ds[[nombre]], "repeat_design", exact = TRUE))) {
      .sig_contexto_de_base(ds, is, nombre, significancia)
    } else {
      .sig_contexto_estudio_base(ds[[nombre]], is[[nombre]], gc, ac, nombre, nombre, names(ds),
                                 regla_informe = .sig_regla_informe(gc, ds, ac))
    },
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
    ctx <- .sig_contexto_con_familias(ctx, ds, is, gc, ac, nombre)   # la ranura de otra base, con la familia de SU base
    message(sprintf("[diferencias] base %s: %s con %s, familia de %d comparaciones.", nombre, ctx$regla$prueba,
                    ctx$regla$correccion, as.integer(ctx$m %||% 0L)))
  }
  # H14: las preguntas clave del plan del pedido viajan en el mismo contexto (graficos_preguntas_clave.R).
  ctx_l <- .preguntas_clave_en_contexto(.sig_contexto_liviano(ctx), significancia$graficos_config$plan$preguntas_clave, nombre)
  ctx_l <- .nombres_cortos_en_contexto(ctx_l, significancia$graficos_config$plan)   # E4 (graficos_nombres_cortos_plan.R)
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
    src <- if (length(sc$bases) > 1L) .graficos_processing_sources(sid) else NULL   # «Familia por base»
    if (!is.null(src)) sc$ctx <- .sig_contexto_con_familias(sc$ctx, src$data_sources, src$inst_sources, sc$cfg, sc$analitica, sc$base)
    .tpub_en_contexto(.sig_contexto_liviano(sc$ctx), sc$cfg$plan, function() .graficos_processing_sources(sid), .tpub_equivalencias_sesion(sid))   # ADR 0138
  }, error = function(e) NULL)
  opciones[["prosecnur.sig_informe"]] <- ctx
  opciones[order(names(opciones), method = "radix")]
}
