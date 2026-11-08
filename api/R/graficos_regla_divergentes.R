# =============================================================================
# graficos_regla_divergentes.R — la regla de la escala mide con la tabla de la lámina (ADR 0135)
# =============================================================================
#
# La regla de `p_barras_divergentes` (estilo resumen) medía su Top Two Box y su «Sin información» con un cálculo
# propio: `.graficos_no_sustantivos` y sin `excluir_opciones`. La lámina, en cambio, pinta la tabla del render
# (`.ola4_tabla_escala`, con las exclusiones de la cascada) pasada por `.espec_divergentes` (que separa la columna
# especial con `.DIVERGENTES_ESPECIAL` o un código 90-99). Una pregunta con un código 9 «No tengo información
# suficiente», o con una opción excluida, daba en la nota de la regla otra cifra que en la lámina.
#
# Aquí la regla mide DESDE ESA MISMA TABLA: las cifras de la regla son las unidades redondeadas que la lámina rotula,
# así que coinciden por construcción. Desde la oleada 3 la lámina reconoce lo no sustantivo con un solo detector
# (`.divergentes_especiales`, que suma `.graficos_no_sustantivos`): el 9 va a «Sin información», el reparto y el punto
# medio se fijan sobre las opciones sustantivas y el Top Two Box es la suma rotulada de su lado sobre el total de
# respondientes.
#
# Las frecuencias salen de `.tab_freq()`, `.resolve_ref()` y `.exclusion_for_ctx()`, que son locales de
# `reporte_ppt_plan()` y se leen con `dynGet`. Dentro del render se usan las del motor. Fuera de él (el endpoint de
# conteo no tiene render) se arma un motor equivalente sobre las mismas fuentes: mismo `.plan_freq_tabla`, mismos
# filtros (`.apply_named_filters_safe`), misma redirección a la recodificada y misma traducción de exclusiones.

.REGLA_DIV_MOTOR <- c(".tab_freq", ".resolve_ref", ".exclusion_for_ctx")

#' Motor de frecuencias equivalente al de `reporte_ppt_plan()` para cuando no hay render (endpoint de conteo)
#'
#' Replica `.resolve_ref`, `.tab_freq`, `.list_name_from_ctx` y `.exclusion_for_choices` de reporte_plan_ppt.R
#' (congelado: no se pueden promover desde ahí sin tocarlo). El test de la regla compara el render real con este
#' camino, así que una divergencia sale en rojo.
#' @keywords internal
.regla_div_motor_local <- function(sources) {
  ds <- sources$data_sources %||% list(); ins <- sources$inst_sources %||% list()
  resolve_ref <- function(ref, source = NULL, arg_name = "var") {
    q <- .regla_preguntas_calificar(as.character(ref)[1], sources)
    part <- .graficos_ref_parts(if (is.na(q)) as.character(ref)[1] else q)
    src <- source %||% part$source
    if (!nzchar(src %||% "") || is.null(ds[[src]]) || is.null(ins[[src]])) {
      stop("La referencia `", as.character(ref)[1], "` no resuelve una base del estudio.", call. = FALSE)
    }
    inst <- ins[[src]]
    list(source = src, data = ds[[src]], instrumento = inst, survey = inst$survey %||% NULL,
         choices = inst$choices %||% inst$choices_raw %||% NULL, orders_list = inst$orders_list %||% NULL,
         var_requested = part$name, var = .reporte_plan_resolve_recod_var(part$name, ds[[src]]))
  }
  tab_freq <- function(var, filtros = list(), source = NULL) {
    ctx <- resolve_ref(var, source = source)
    dsub <- .apply_named_filters_safe(ds[[ctx$source]], filters = filtros %||% list(), arg_name = "filtros")
    if (!nrow(dsub)) return(NULL)
    .plan_freq_tabla(dsub, ctx$var, survey = ctx$survey, sm_vars_force = NULL, orders_list = ctx$orders_list,
                     mostrar_todo = TRUE, casos = TRUE)
  }
  lista_de <- function(ctx) {
    surv <- ctx$survey
    for (col in c("list_name", "list_norm")) {
      if (!col %in% names(surv)) next
      x <- surv[[col]][!is.na(surv$name) & surv$name == ctx$var]
      x <- x[!is.na(x) & nzchar(x)]
      if (length(x)) return(x[1])
    }
    NA_character_
  }
  exclusion_for_ctx <- function(ctx, excluir_opciones) {
    excluir_opciones <- .reporte_plan_excluir_opciones(excluir_opciones)
    if (!length(excluir_opciones)) return(NULL)
    niveles <- .reporte_plan_choice_levels_for_list(lista_de(ctx), ctx$choices)
    if (!nrow(niveles)) return(excluir_opciones)
    bloq <- .reporte_plan_norm_option_alias(excluir_opciones)
    hit <- .reporte_plan_norm_option_alias(niveles$label) %in% bloq | .reporte_plan_norm_option_alias(niveles$code) %in% bloq
    .reporte_plan_excluir_opciones(excluir_opciones, niveles$code[hit], niveles$label[hit])
  }
  list(tab_freq = tab_freq, resolve_ref = resolve_ref, exclusion_for_ctx = exclusion_for_ctx)
}

#' Corre `f()` con el motor de frecuencias del render; si no hay render, con el equivalente local
#'
#' `dynGet` busca por la pila de llamadas: las locales de este marco las encuentra `.ola4_tabla_opciones` cuando `f`
#' la llama. Dentro del render no se definen, para no tapar las del motor.
#' @keywords internal
.regla_div_con_motor <- function(sources, f) {
  if (all(vapply(.REGLA_DIV_MOTOR, function(nm) is.function(dynGet(nm, ifnotfound = NULL)), TRUE))) return(f())
  m <- .regla_div_motor_local(sources)
  .tab_freq <- m$tab_freq; .resolve_ref <- m$resolve_ref; .exclusion_for_ctx <- m$exclusion_for_ctx
  force(.tab_freq); force(.resolve_ref); force(.exclusion_for_ctx)
  f()
}

#' Los args de la escala como los arma el render: el preset del tipo y los overrides de la lámina
#' @keywords internal
.regla_div_args <- function(el, preset = NULL) {
  base_preset <- if (length(preset)) preset else .ola4_preset("barras_divergentes")
  args <- utils::modifyList(as.list(base_preset %||% list()), as.list(el$overrides %||% list()))
  dec <- suppressWarnings(as.integer(args$valores_decimales %||% 0L)[1]); if (!is.finite(dec) || dec < 0L) dec <- 0L
  list(excluir = .reporte_plan_excluir_cascada(base_preset, el$overrides %||% list(), el),
       n_negativas = args$n_negativas, incluir_neutro = args$incluir_neutro %||% TRUE,
       direccion = args$direccion_escala %||% "negativo_positivo", decimales = dec)
}

#' La tabla de la lámina para unas preguntas: `.ola4_tabla_escala` y su especificación `divergentes/1`
#' @keywords internal
.regla_div_espec <- function(refs, el, a) {
  tabla <- .ola4_tabla_escala(refs, el$filtros %||% list(), excluir_opciones = a$excluir, n_negativas = a$n_negativas,
                              incluir_neutro = a$incluir_neutro, direccion_escala = a$direccion,
                              firma_leyenda = el$.firma_leyenda)
  particion <- .divergentes_reparto(tabla$cols_porcentaje, a$n_negativas, a$incluir_neutro, reparto = tabla$reparto)
  .espec_divergentes(tabla$data, "categoria", tabla$cols_porcentaje, tabla$etiquetas_grupos, particion, "proporcion_1",
                     decimales = a$decimales, incluir_neutro = a$incluir_neutro, reparto_explicito = TRUE,
                     codigos = tabla$codigos_grupos, orden = "declarado")
}

#' Top Two Box y «Sin información» de cada pregunta, con las cifras que la lámina rotula
#'
#' @param refs Referencias calificadas (`base$variable`) que ya pasaron el universo de candidatas.
#' @param preset Args del preset del tipo (el render los pasa; fuera del render, el preset de la pila o nada).
#' @return `list(medidas = data.frame(ref, valor, sin_info), motivos)`: `valor` y `sin_info` en 0–100, iguales a la
#'   suma de las unidades rotuladas del lado de acuerdo y de la columna especial. Una pregunta que la lámina no puede
#'   dibujar (un lado vacío tras las exclusiones) sale con su motivo.
#' @keywords internal
.regla_div_medidas <- function(refs, el, sources, preset = NULL) {
  a <- .regla_div_args(el, preset)
  vacio <- data.frame(ref = character(0), valor = numeric(0), sin_info = numeric(0), stringsAsFactors = FALSE)
  if (!length(refs)) return(list(medidas = vacio, motivos = list()))
  .regla_div_con_motor(sources, function() {
    motivos <- list()
    ok <- vapply(refs, function(r) !is.null(tryCatch(.regla_div_espec(r, el, a), error = function(e) NULL)), TRUE)
    if (any(!ok)) motivos <- as.list(rep("la escala queda sin un lado con sus exclusiones", sum(!ok)))
    validas <- refs[ok]
    if (!length(validas)) return(list(medidas = vacio, motivos = motivos))
    esp <- .regla_div_espec(validas, el, a)
    lado <- esp$categorias$lado; U <- esp$unidades; k <- 10^esp$decimales
    list(medidas = data.frame(ref = validas, valor = esp$total_pos / k,
                              sin_info = rowSums(U[, lado == "sin_inf", drop = FALSE]) / k, stringsAsFactors = FALSE),
         motivos = motivos)
  })
}
