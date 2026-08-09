# Constructores y renders de la ola 4: divergentes, dumbbell y lollipop
# =====================================================================
#
# Los tres se enganchan por convencion de nombre (`.render_<etype>`), asi que
# `reporte_plan_ppt.R` —congelado a crecimiento— no crece ni una linea. El
# preset del tipo se lee con `dynGet`, igual que hacen el radar entre publicos y
# la serie temporal.

.ola4_preset <- function(clave) {
  presets <- dynGet("presets", ifnotfound = NULL)
  if (!is.list(presets)) return(list())
  presets[[clave]]$args %||% list()
}

# --- Barras divergentes -----------------------------------------------------

#' Barras divergentes de una escala Likert
#'
#' @param vars Preguntas que comparten escala; cada una es una barra.
#' @param n_negativas Niveles que van a la izquierda del cero, contados desde el
#'   primero de la escala.
#' @export
p_barras_divergentes <- function(vars = NULL,
                                 var = NULL,
                                 n_negativas = 2L,
                                 incluir_neutro = TRUE,
                                 mostrar_saldo = TRUE,
                                 titulo = NULL,
                                 overrides = list(),
                                 base = list(),
                                 filtros = list(),
                                 umbral_etiqueta_pct = 3,
                                 excluir_opciones = NULL,
                                 direccion_escala = c("negativo_positivo", "positivo_negativo")) {
  direccion_escala <- match.arg(direccion_escala)
  refs <- as.character(unlist(vars %||% var %||% character(0)))
  refs <- refs[!is.na(refs) & nzchar(trimws(refs))]
  if (!length(refs)) {
    .plan_spec_abort("p_barras_divergentes(): declara `vars` (o `var`) con al menos una pregunta.")
  }
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")

  ov <- overrides
  ov$n_negativas <- suppressWarnings(as.integer(n_negativas)[1])
  ov$incluir_neutro <- isTRUE(incluir_neutro)
  ov$mostrar_saldo <- isTRUE(mostrar_saldo)
  ov$umbral_etiqueta_pct <- suppressWarnings(as.numeric(umbral_etiqueta_pct)[1])
  ov$direccion_escala <- direccion_escala
  if (!is.null(excluir_opciones)) {
    ov$excluir_opciones <- .reporte_plan_excluir_opciones(excluir_opciones)
  }

  el <- list(
    .element_type = "barras_divergentes",
    var  = if (length(refs) == 1L) refs else NULL,
    vars = refs,
    title_slide = titulo,
    overrides = ov,
    base = base,
    filtros = .ppt_norm_filters(filtros)
  )
  class(el) <- c("ppt_element", "list")
  el
}

.ola4_metodologia_ctx <- function(ctx, ref) {
  inst <- ctx$instrumento %||% ctx$inst %||% NULL
  # Los tests unitarios del render pueden ofrecer un resolvedor minimo para
  # probar exclusiones. Sin instrumento no se inventa una firma: la bateria
  # conserva el fallback historico por etiquetas.
  if (is.null(inst)) return(NULL)

  survey <- ctx$survey %||% inst$survey %||% inst$survey_raw %||% NULL
  var <- as.character(ctx$var %||% ctx$resolved_variable %||%
                        ctx$var_requested %||% "")[1]
  fila <- if (is.data.frame(survey) && "name" %in% names(survey)) {
    which(as.character(survey$name) == var)[1]
  } else {
    NA_integer_
  }
  tipo <- if (!is.na(fila) && "type" %in% names(survey)) {
    trimws(as.character(survey$type[[fila]]))
  } else {
    NA_character_
  }
  if (is.na(tipo) || !grepl("^select_one(?:\\s|$)", tipo, perl = TRUE)) {
    stop(
      "La referencia `", as.character(ref)[1],
      "` debe resolver una variable select_one; el tipo es ",
      if (is.na(tipo) || !nzchar(tipo)) "desconocido" else paste0("`", tipo, "`"),
      ".",
      call. = FALSE
    )
  }

  diseno <- .graficos_sig_diseno_de_fuente(inst, var)
  if (!identical(diseno, "independiente")) {
    stop(
      "La referencia `", as.character(ref)[1],
      "` debe ser plana y de diseño independiente; se detectó `", diseno,
      "` (repeat/cluster).",
      call. = FALSE
    )
  }

  list(
    firma = .equiv_firma_escala(inst, var),
    opciones = .equiv_escala_opciones(inst, var)
  )
}

# Tabla ancha (una fila por pregunta, una columna por nivel de la escala) desde
# los helpers del motor.
#
# `.tab_freq()` es local a `reporte_ppt_plan()`, asi que se toma con `dynGet` —
# el mismo camino por el que los otros renders de convencion leen las fuentes—.
# Usar el helper del motor y no una consulta propia es lo que garantiza que la
# divergente y la apilada del mismo dato no puedan discrepar: mismas
# exclusiones, mismo denominador, mismo orden de escala.
.ola4_tabla_opciones <- function(ref, filtros, excluir_opciones = NULL,
                                 n_negativas = NULL,
                                 incluir_neutro = TRUE) {
  tab_freq <- dynGet(".tab_freq", ifnotfound = NULL)
  if (!is.function(tab_freq)) {
    stop("El render no expone `.tab_freq()` del motor.", call. = FALSE)
  }

  tab <- tab_freq(ref, filtros = filtros)
  ref_txt <- as.character(ref)[1]
  if (is.null(tab) || !is.data.frame(tab) || !nrow(tab) ||
      !all(c("Opciones", "n") %in% names(tab))) {
    stop(
      "La pregunta `", ref_txt, "` no devolvio frecuencias utilizables.",
      call. = FALSE
    )
  }

  # La tabla sin "Total" conserva el orden completo de la escala de origen,
  # incluidos los niveles con cero observaciones.
  if (identical(trimws(as.character(tab$Opciones[[nrow(tab)]])), "Total")) {
    tab <- tab[-nrow(tab), , drop = FALSE]
  }
  opciones_originales <- as.character(tab$Opciones)
  n_original <- suppressWarnings(as.numeric(tab$n))
  if (!nrow(tab) || anyNA(opciones_originales) ||
      any(!nzchar(opciones_originales)) || anyDuplicated(opciones_originales) ||
      any(!is.finite(n_original)) || any(n_original < 0)) {
    stop(
      "La pregunta `", ref_txt, "` no devolvio frecuencias utilizables.",
      call. = FALSE
    )
  }
  total_original <- sum(n_original)
  if (!is.finite(total_original) || total_original <= 0) {
    stop(
      "La pregunta `", ref_txt, "` no devolvio frecuencias utilizables.",
      call. = FALSE
    )
  }

  # La semantica ordinal se fija sobre la escala ORIGINAL antes de quitar una
  # opcion. Asi Neutral y los lados restantes no cambian por reindexacion.
  reparto_original <- NULL
  if (!is.null(n_negativas)) {
    reparto_original <- .divergentes_reparto(
      opciones_originales,
      n_negativas,
      incluir_neutro
    )
  }

  # Los codigos curados por la UI se traducen por ref con el mismo contexto que
  # usa el resto del motor.
  resolve_ref <- dynGet(".resolve_ref", ifnotfound = NULL)
  exclusion_for_ctx <- dynGet(".exclusion_for_ctx", ifnotfound = NULL)
  excluir_ref <- excluir_opciones
  ctx <- if (is.function(resolve_ref)) resolve_ref(ref, arg_name = "var") else NULL
  metodologia <- if (!is.null(ctx)) .ola4_metodologia_ctx(ctx, ref) else NULL
  if (!is.null(ctx) && is.function(exclusion_for_ctx)) {
    excluir_ref <- exclusion_for_ctx(ctx, excluir_ref)
  }
  tab <- .reporte_plan_filter_freq_options(tab, excluir_ref)
  vaciada_por_exclusion <- isTRUE(attr(tab, "excluded_any", exact = TRUE))
  if (!nrow(tab)) {
    if (vaciada_por_exclusion) {
      stop(
        "La pregunta `", ref_txt, "` quedo vacia tras aplicar exclusiones.",
        call. = FALSE
      )
    }
    stop(
      "La pregunta `", ref_txt, "` no devolvio frecuencias utilizables.",
      call. = FALSE
    )
  }

  # El denominador nace aqui, despues de resolver y aplicar la exclusion de
  # esta ref. Un denominador cero tampoco autoriza omitirla de la bateria.
  total_visible <- sum(suppressWarnings(as.numeric(tab$n)), na.rm = TRUE)
  if (!is.finite(total_visible) || total_visible <= 0) {
    if (vaciada_por_exclusion) {
      stop(
        "La pregunta `", ref_txt,
        "` quedo vacia tras aplicar exclusiones (denominador cero).",
        call. = FALSE
      )
    }
    stop(
      "La pregunta `", ref_txt, "` no devolvio frecuencias utilizables.",
      call. = FALSE
    )
  }

  attr(tab, "ola4_escala_original") <- opciones_originales
  attr(tab, "ola4_reparto_original") <- reparto_original
  attr(tab, "ola4_firma_e1") <- metodologia$firma %||% NA_character_
  attr(tab, "ola4_opciones_e1") <- metodologia$opciones %||% NULL
  attr(tab, "ola4_excluir_resuelto") <- excluir_ref
  tab
}

.ola4_lollipop_completar_escala <- function(tab) {
  opciones <- attr(tab, "ola4_opciones_e1", exact = TRUE)
  if (!length(opciones)) return(tab)

  codigos <- vapply(opciones, function(x) as.character(x$codigo)[1], character(1))
  etiquetas <- vapply(opciones, function(x) as.character(x$etiqueta)[1], character(1))
  observadas <- as.character(tab$Opciones)
  idx_codigo <- match(observadas, codigos)
  idx_etiqueta <- match(
    .escala_etiqueta_normalizada(observadas),
    .escala_etiqueta_normalizada(etiquetas)
  )
  idx <- ifelse(!is.na(idx_codigo), idx_codigo, idx_etiqueta)
  # Los mocks unitarios pueden exponer un ctx mínimo cuya escala deliberadamente
  # no corresponde a la tabla. En ese caso se conserva la tabla por etiquetas;
  # en runtime real los códigos/labels del instrumento sí deben resolver.
  if (anyNA(idx)) return(tab)

  excluir <- attr(tab, "ola4_excluir_resuelto", exact = TRUE) %||% character(0)
  bloqueadas <- .reporte_plan_norm_option_alias(excluir)
  mantener <- !(
    .reporte_plan_norm_option_alias(codigos) %in% bloqueadas |
      .reporte_plan_norm_option_alias(etiquetas) %in% bloqueadas
  )
  n_observado <- suppressWarnings(as.numeric(tab$n))
  n_por_indice <- stats::setNames(rep(0, length(opciones)), seq_along(opciones))
  for (i in seq_along(idx)) {
    n_por_indice[[as.character(idx[[i]])]] <-
      n_por_indice[[as.character(idx[[i]])]] + n_observado[[i]]
  }
  data.frame(
    Opciones = etiquetas[mantener],
    n = unname(n_por_indice[as.character(which(mantener))]),
    stringsAsFactors = FALSE
  )
}

.ola4_tabla_escala <- function(refs, filtros, excluir_opciones = NULL,
                               n_negativas = 2L,
                               incluir_neutro = TRUE,
                               direccion_escala = c("negativo_positivo", "positivo_negativo")) {
  direccion_escala <- match.arg(direccion_escala)
  filas <- list()
  opciones_visibles <- character(0)
  escala_original <- NULL
  reparto_original <- NULL
  ref_escala <- NULL
  firma_escala <- NULL
  opciones_e1 <- NULL

  for (ref in refs) {
    tab <- .ola4_tabla_opciones(
      ref,
      filtros,
      excluir_opciones,
      n_negativas = n_negativas,
      incluir_neutro = incluir_neutro
    )
    escala_ref <- attr(tab, "ola4_escala_original", exact = TRUE)
    firma_ref <- attr(tab, "ola4_firma_e1", exact = TRUE)
    if (!length(firma_ref) || is.na(firma_ref[[1]]) || !nzchar(firma_ref[[1]])) {
      firma_ref <- NULL
    } else {
      firma_ref <- as.character(firma_ref[[1]])
    }
    opciones_ref <- attr(tab, "ola4_opciones_e1", exact = TRUE)
    if (is.null(escala_original)) {
      firma_escala <- firma_ref
      opciones_e1 <- opciones_ref
      escala_original <- if (!is.null(firma_ref) && length(opciones_ref)) {
        vapply(opciones_ref, function(x) as.character(x$etiqueta)[1], character(1))
      } else {
        escala_ref
      }
      escala_reparto <- if (identical(direccion_escala, "positivo_negativo")) {
        rev(escala_original)
      } else {
        escala_original
      }
      reparto_original <- .divergentes_reparto(
        escala_reparto,
        n_negativas,
        incluir_neutro
      )
      ref_escala <- as.character(ref)[1]
    } else {
      if (xor(is.null(firma_escala), is.null(firma_ref))) {
        stop(
          "La pregunta `", as.character(ref)[1],
          "` no expone la misma firma E1 que `", ref_escala, "`.",
          call. = FALSE
        )
      }
      if (!is.null(firma_escala) && !identical(firma_ref, firma_escala)) {
        stop(
          "La pregunta `", as.character(ref)[1],
          "` no comparte la firma E1 código + etiqueta de `", ref_escala, "`.",
          call. = FALSE
        )
      }
      if (is.null(firma_escala) && !identical(escala_ref, escala_original)) {
        stop(
          "La pregunta `", as.character(ref)[1],
          "` no comparte la escala original de `", ref_escala, "`.",
          call. = FALSE
        )
      }
    }

    opts <- as.character(tab$Opciones)
    if (!is.null(firma_escala)) {
      etiquetas_ref <- vapply(opciones_ref, function(x) {
        as.character(x$etiqueta)[1]
      }, character(1))
      codigos_ref <- vapply(opciones_ref, function(x) {
        as.character(x$codigo)[1]
      }, character(1))
      codigos_canonicos <- vapply(opciones_e1, function(x) {
        as.character(x$codigo)[1]
      }, character(1))
      idx_codigo <- match(opts, codigos_ref)
      idx_etiqueta <- match(
        .escala_etiqueta_normalizada(opts),
        .escala_etiqueta_normalizada(etiquetas_ref)
      )
      idx_ref <- ifelse(!is.na(idx_codigo), idx_codigo, idx_etiqueta)
      idx_canonico <- match(codigos_ref[idx_ref], codigos_canonicos)
      if (anyNA(idx_ref) || anyNA(idx_canonico)) {
        stop(
          "La pregunta `", as.character(ref)[1],
          "` devolvió frecuencias que no corresponden a su firma E1.",
          call. = FALSE
        )
      }
      opts <- escala_original[idx_canonico]
    }
    reparto_ref <- reparto_original
    if (!any(reparto_ref$negativas %in% opts)) {
      stop(
        "La pregunta `", as.character(ref)[1],
        "` queda con el lado negativo vacio tras aplicar exclusiones; ",
        "no se puede inferir polaridad.",
        call. = FALSE
      )
    }
    if (!any(reparto_ref$positivas %in% opts)) {
      stop(
        "La pregunta `", as.character(ref)[1],
        "` queda con el lado positivo vacio tras aplicar exclusiones; ",
        "no se puede inferir polaridad.",
        call. = FALSE
      )
    }

    n <- suppressWarnings(as.numeric(tab$n))
    total <- sum(n, na.rm = TRUE)
    opciones_visibles <- unique(c(opciones_visibles, opts))
    filas[[length(filas) + 1L]] <- stats::setNames(n / total, opts)
    names(filas)[length(filas)] <- as.character(ref)[1]
  }
  if (!length(filas)) return(NULL)

  # La escala comun de origen gobierna el orden aunque una opcion ya no sea
  # visible en alguna ref.
  niveles <- escala_original[escala_original %in% opciones_visibles]
  cols <- paste0("niv_", seq_along(niveles))
  out <- data.frame(categoria = names(filas), stringsAsFactors = FALSE)
  for (j in seq_along(niveles)) {
    out[[cols[j]]] <- vapply(filas, function(f) unname(f[niveles[j]] %||% 0), numeric(1))
  }
  out[is.na(out)] <- 0

  id_por_nivel <- stats::setNames(cols, niveles)
  ids_visibles <- function(x) {
    x <- x[x %in% niveles]
    unname(id_por_nivel[x])
  }
  reparto_visible <- list(
    negativas = ids_visibles(reparto_original$negativas),
    neutro = ids_visibles(reparto_original$neutro),
    positivas = ids_visibles(reparto_original$positivas)
  )
  if (!length(reparto_visible$negativas)) {
    stop(
      paste0(
        "barras_divergentes: el reparto original y las exclusiones dejan ",
        "el lado negativo vacio; no se puede inferir polaridad."
      ),
      call. = FALSE
    )
  }
  if (!length(reparto_visible$positivas)) {
    stop(
      paste0(
        "barras_divergentes: el reparto original y las exclusiones dejan ",
        "el lado positivo vacio; no se puede inferir polaridad."
      ),
      call. = FALSE
    )
  }

  list(
    data = out,
    cols_porcentaje = cols,
    etiquetas_grupos = stats::setNames(niveles, cols),
    reparto = reparto_visible
  )
}

#' @keywords internal
.render_barras_divergentes <- function(el, preset_args = list()) {
  base_preset <- if (length(preset_args)) preset_args else .ola4_preset("barras_divergentes")
  args_usuario <- utils::modifyList(as.list(base_preset %||% list()),
                                    as.list(el$overrides %||% list()))
  excluir_opciones <- .reporte_plan_excluir_cascada(
    base_preset,
    el$overrides %||% list(),
    el
  )
  tabla <- .ola4_tabla_escala(
    el$vars,
    el$filtros %||% list(),
    excluir_opciones = excluir_opciones,
    n_negativas = args_usuario$n_negativas %||% 2L,
    incluir_neutro = args_usuario$incluir_neutro %||% TRUE,
    direccion_escala = args_usuario$direccion_escala %||% "negativo_positivo"
  )

  args_usuario$excluir_opciones <- NULL
  args_usuario$direccion_escala <- NULL
  base_args <- list(
    data = tabla$data,
    var_categoria = "categoria",
    cols_porcentaje = tabla$cols_porcentaje,
    etiquetas_grupos = tabla$etiquetas_grupos,
    reparto = tabla$reparto,
    escala_valor = "proporcion_1",
    titulo = el$title_slide %||% NULL
  )
  args <- utils::modifyList(base_args, args_usuario)
  # El reparto derivado de la escala original no es reemplazable por presets o
  # overrides: hacerlo reintroduciria la reclasificacion por indices visibles.
  args$reparto <- tabla$reparto
  args <- .keep_formals(graficar_barras_divergentes, args, contexto = "graficar_barras_divergentes")
  do.call(graficar_barras_divergentes, args)
}

.ola4_fuentes_de_refs <- function(refs, contexto, tema) {
  refs <- as.character(unlist(refs, use.names = FALSE))
  refs <- trimws(refs)
  if (!length(refs) || anyNA(refs) || any(!nzchar(refs))) {
    .plan_spec_abort(contexto, ": el tema `", tema, "` contiene referencias vacías.")
  }
  partes <- lapply(refs, .graficos_ref_parts)
  fuentes <- vapply(partes, `[[`, character(1), "source")
  variables <- vapply(partes, `[[`, character(1), "name")
  if (any(!nzchar(fuentes)) || any(!nzchar(variables))) {
    .plan_spec_abort(
      contexto, ": el tema `", tema,
      "` requiere referencias calificadas como `fuente$variable`."
    )
  }
  fuentes
}

.ola4_validar_matriz_multibase <- function(datos, temas, fuentes, contexto) {
  temas <- as.character(temas)
  fuentes <- as.character(fuentes)
  claves <- paste(as.character(datos$eje), as.character(datos$grupo), sep = "\r")
  esperadas <- as.vector(outer(temas, fuentes, paste, sep = "\r"))
  faltan <- setdiff(esperadas, claves)
  if (length(faltan) || anyDuplicated(claves)) {
    celda <- if (length(faltan)) strsplit(faltan[[1]], "\r", fixed = TRUE)[[1]] else c("", "")
    stop(
      contexto, ": la matriz tema × fuente debe ser completa y única",
      if (length(faltan)) paste0("; falta `", celda[[1]], "` × `", celda[[2]], "`") else "",
      ".",
      call. = FALSE
    )
  }
  invalidas <- which(!is.finite(datos$valor) | !is.finite(datos$n) | datos$n <= 0)
  if (length(invalidas)) {
    celda <- datos[invalidas[[1]], , drop = FALSE]
    stop(
      contexto, ": la celda `", as.character(celda$eje), "` × `",
      as.character(celda$grupo), "` no tiene valor finito y denominador n > 0.",
      call. = FALSE
    )
  }
  invisible(datos)
}

# --- Dumbbell ---------------------------------------------------------------

#' Brecha entre dos bases, tema por tema
#'
#' Declara lo mismo que `p_radar(modo = "publicos")` y lo dibuja como brecha.
#' @export
p_dumbbell <- function(vars,
                       corte,
                       corte_etiqueta = NULL,
                       orden = c("brecha", "valor", "declarado"),
                       mostrar_brecha = TRUE,
                       umbral_brecha_pct = 0,
                       titulo = NULL,
                       overrides = list(),
                       base = list(),
                       filtros = list()) {
  orden <- match.arg(orden)
  if (!is.list(vars) || !length(vars)) {
    .plan_spec_abort("p_dumbbell(): `vars` debe ser una lista nombrada no vacia.")
  }
  if (is.null(names(vars)) || any(!nzchar(trimws(names(vars))))) {
    .plan_spec_abort("p_dumbbell(): cada tema necesita nombre — es la etiqueta de la fila.")
  }
  if (!length(.radar_mb_codigos(corte))) {
    .plan_spec_abort("p_dumbbell(): `corte` debe traer al menos un codigo de la escala.")
  }
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")

  vars_norm <- lapply(vars, function(x) as.character(unlist(x)))
  pareja <- NULL
  tema_pareja <- NULL
  for (tema in names(vars_norm)) {
    refs_tema <- vars_norm[[tema]]
    if (length(refs_tema) != 2L) {
      .plan_spec_abort(
        "p_dumbbell(): el tema `", tema,
        "` debe declarar exactamente dos referencias de fuentes distintas."
      )
    }
    fuentes <- .ola4_fuentes_de_refs(refs_tema, "p_dumbbell()", tema)
    if (anyDuplicated(fuentes)) {
      .plan_spec_abort(
        "p_dumbbell(): el tema `", tema,
        "` debe declarar dos fuentes distintas."
      )
    }
    if (is.null(pareja)) {
      pareja <- fuentes
      tema_pareja <- tema
    } else if (!identical(fuentes, pareja)) {
      .plan_spec_abort(
        "p_dumbbell(): el tema `", tema,
        "` no conserva el orden de fuentes `", paste(pareja, collapse = " -> "),
        "` declarado por `", tema_pareja, "`."
      )
    }
  }

  ov <- overrides
  ov$orden <- orden
  ov$mostrar_brecha <- isTRUE(mostrar_brecha)
  ov$umbral_brecha_pct <- suppressWarnings(as.numeric(umbral_brecha_pct)[1])

  el <- list(
    .element_type = "dumbbell",
    var  = NULL,
    vars = vars_norm,
    corte = as.character(corte)[1],
    corte_etiqueta = as.character(corte_etiqueta %||% "")[1],
    title_slide = titulo,
    overrides = ov,
    base = base,
    filtros = .ppt_norm_filters(filtros)
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @keywords internal
.render_dumbbell <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  inst_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources) || !length(inst_sources)) {
    stop("dumbbell: el render no expone las fuentes del estudio.", call. = FALSE)
  }
  datos <- .radar_mb_datos(
    el$vars,
    el$corte,
    list(data_sources = data_sources, inst_sources = inst_sources),
    filtros = el$filtros %||% list()
  )
  fuentes <- .ola4_fuentes_de_refs(el$vars[[1]], "dumbbell", names(el$vars)[[1]])
  .ola4_validar_matriz_multibase(datos, names(el$vars), fuentes, "dumbbell")

  base_preset <- if (length(preset_args)) preset_args else .ola4_preset("dumbbell")
  args_usuario <- utils::modifyList(as.list(base_preset %||% list()),
                                    as.list(el$overrides %||% list()))
  base_args <- list(
    data = datos, var_eje = "eje", var_grupo = "grupo", var_valor = "valor",
    escala_valor = "proporcion_100",
    titulo = el$title_slide %||% NULL,
    subtitulo = el$corte_etiqueta %||% NULL
  )
  args <- utils::modifyList(base_args, args_usuario)
  args <- .keep_formals(graficar_dumbbell, args, contexto = "graficar_dumbbell")
  do.call(graficar_dumbbell, args)
}

# --- Lollipop ---------------------------------------------------------------

#' Ranking tipo lollipop de las opciones de una pregunta
#' @export
p_lollipop <- function(var,
                       orden = c("mayor_menor", "menor_mayor", "declarado"),
                       top_n = NULL,
                       resaltar = NULL,
                       titulo = NULL,
                       overrides = list(),
                       base = list(),
                       filtros = list(),
                       excluir_opciones = NULL) {
  orden <- match.arg(orden)
  if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
    .plan_spec_abort("p_lollipop(): `var` debe ser character(1) no vacio.")
  }
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")

  ov <- overrides
  ov$orden <- orden
  if (!is.null(top_n)) ov$top_n <- suppressWarnings(as.integer(top_n)[1])
  if (!is.null(resaltar)) ov$resaltar <- as.character(resaltar)
  if (!is.null(excluir_opciones)) {
    ov$excluir_opciones <- .reporte_plan_excluir_opciones(excluir_opciones)
  }

  el <- list(
    .element_type = "lollipop",
    var = var,
    title_slide = titulo,
    overrides = ov,
    base = base,
    filtros = .ppt_norm_filters(filtros)
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @keywords internal
.render_lollipop <- function(el, preset_args = list()) {
  # Misma fuente de verdad que las barras: el helper de frecuencias del motor,
  # no una consulta propia.
  base_preset <- if (length(preset_args)) preset_args else .ola4_preset("lollipop")
  excluir_opciones <- .reporte_plan_excluir_cascada(
    base_preset,
    el$overrides %||% list(),
    el
  )
  tab <- .ola4_tabla_opciones(
    el$var,
    el$filtros %||% list(),
    excluir_opciones = excluir_opciones
  )
  tab <- .ola4_lollipop_completar_escala(tab)
  if (is.null(tab) || !nrow(tab)) {
    stop("lollipop: `var` no devolvio frecuencias utilizables.", call. = FALSE)
  }
  n <- suppressWarnings(as.numeric(tab$n))
  total <- sum(n, na.rm = TRUE)
  if (!is.finite(total) || total <= 0) {
    stop("lollipop: la base de `var` es cero.", call. = FALSE)
  }
  df <- data.frame(
    categoria = as.character(tab$Opciones),
    pct = n / total,
    stringsAsFactors = FALSE
  )

  args_usuario <- utils::modifyList(as.list(base_preset %||% list()),
                                    as.list(el$overrides %||% list()))
  args_usuario$excluir_opciones <- NULL
  base_args <- list(
    data = df, var_categoria = "categoria", var_valor = "pct",
    escala_valor = "proporcion_1",
    titulo = el$title_slide %||% NULL
  )
  args <- utils::modifyList(base_args, args_usuario)
  args <- .keep_formals(graficar_lollipop, args, contexto = "graficar_lollipop")
  do.call(graficar_lollipop, args)
}
