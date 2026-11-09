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
#'   primero de la escala. `NULL`: la mitad de las opciones sustantivas, con neutro si son impares
#'   (4 y 5 puntos: 2; 3: 1; 7: 3; 11: 5).
#' @param regla Cómo se eligen las preguntas entre las de `vars` (ADR 0135); sólo en el estilo resumen.
#' @param abreviaturas Con preguntas de varios públicos, la abreviatura de cada uno en el rótulo de su fila
#'   («Docentes: Doc.; Administrativos: Adm.»); sin declarar, las tres primeras letras de la base y punto.
#' @export
p_barras_divergentes <- function(vars = NULL,
                                 var = NULL,
                                 n_negativas = NULL,
                                 incluir_neutro = TRUE,
                                 mostrar_saldo = TRUE,
                                 titulo = NULL,
                                 overrides = list(),
                                 base = list(),
                                 filtros = list(),
                                 umbral_etiqueta_pct = 3,
                                 excluir_opciones = NULL,
                                 direccion_escala = c("negativo_positivo", "positivo_negativo"),
                                 estilo = NULL,
                                 orden = NULL,
                                 regla = NULL,
                                 abreviaturas = NULL) {
  direccion_escala <- match.arg(direccion_escala)
  refs <- as.character(unlist(vars %||% var %||% character(0)))
  refs <- refs[!is.na(refs) & nzchar(trimws(refs))]
  if (!length(refs)) {
    .plan_spec_abort("p_barras_divergentes(): declara `vars` (o `var`) con al menos una pregunta.")
  }
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")

  ov <- overrides
  # Sin declarar, la tabla de la escala parte las sustantivas por la mitad (`.ola4_n_negativas`).
  if (!is.null(n_negativas)) ov$n_negativas <- suppressWarnings(as.integer(n_negativas)[1])
  ov$incluir_neutro <- isTRUE(incluir_neutro)
  ov$mostrar_saldo <- isTRUE(mostrar_saldo)
  ov$umbral_etiqueta_pct <- suppressWarnings(as.numeric(umbral_etiqueta_pct)[1])
  ov$direccion_escala <- direccion_escala
  # ADR 0134: la escala del resumen ejecutivo y su orden; sólo lo que el slot declara (O7c).
  ov <- .ppt_slot_override(ov, "estilo", estilo, "opcion", opciones = c("recetario", "resumen"))
  ov <- .ppt_slot_override(ov, "orden", orden, "opcion", opciones = c("top_two_box", "sin_informacion", "declarado"))
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
  # Con preguntas de varios públicos cada fila lleva su abreviatura (graficos_divergentes_publicos.R).
  if (length(.divergentes_abreviaturas_leer(abreviaturas))) el$abreviaturas <- .divergentes_abreviaturas_leer(abreviaturas)
  class(el) <- c("ppt_element", "list")
  .regla_preguntas_en_constructor(el, regla, "p_barras_divergentes()")   # ADR 0135
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

  # ADR 0135 §3: la metadata de la lista (choices$especial sí/no) llega al detector de la escala.
  lista <- .equiv_lista_de(inst, var)$lista
  ch <- inst$choices %||% ctx$choices %||% NULL
  list(
    firma = .equiv_firma_escala(inst, var),
    opciones = .equiv_escala_opciones(inst, var),
    especiales = .graficos_no_sustantivos_especiales_meta(lista, ch),
    sustantivos = .graficos_no_sustantivos_especiales_meta(lista, ch, .NO_SUSTANTIVOS_META_NO)
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
  attr(tab, "ola4_meta_especiales") <- list(especiales = metodologia$especiales %||% character(0),
                                            sustantivos = metodologia$sustantivos %||% character(0))
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

#' Niveles del lado negativo: los declarados o, sin declarar, la mitad (piso) de las opciones sustantivas
#' @keywords internal
.ola4_n_negativas <- function(n_negativas, k_sustantivas) {
  if (!is.null(n_negativas) && length(n_negativas) && !is.na(suppressWarnings(as.integer(n_negativas)[1]))) return(n_negativas)
  as.integer(k_sustantivas) %/% 2L
}

#' Tabla de la escala divergente: una fila por pregunta sobre la escala de la leyenda
#'
#' Un fallo de una fila sale como condición `ola4_fila_fallida` (con su `ref`); `.ola4_tabla_escala_tolerante`
#' (graficos_escala_filas_fallidas.R) la saca y sigue con las demás.
#' @keywords internal
.ola4_tabla_escala <- function(refs, filtros, excluir_opciones = NULL,
                               n_negativas = NULL,
                               incluir_neutro = TRUE,
                               direccion_escala = c("negativo_positivo", "positivo_negativo"),
                               firma_leyenda = NULL) {
  direccion_escala <- match.arg(direccion_escala)
  filas <- list()
  opciones_visibles <- character(0)
  escala_original <- NULL
  reparto_original <- NULL
  ref_escala <- NULL
  firma_escala <- NULL
  opciones_e1 <- NULL
  no_sustantivas <- character(0)
  meta_ns <- list()
  hubo_exclusion <- FALSE
  forma_escala <- NULL
  forma_ref <- NULL
  armonizadas <- list()   # escalas alineadas por posición con la de la leyenda (graficos_escala_armonizada.R)
  if (!length(refs)) return(NULL)

  tabs <- lapply(seq_along(refs), function(i) .ola4_con_fila(i, refs[[i]], .ola4_tabla_opciones(
    refs[[i]],
    filtros,
    excluir_opciones,
    n_negativas = NULL,   # el reparto se fija abajo, sobre las sustantivas
    incluir_neutro = incluir_neutro
  )))
  # La escala de la leyenda es la más frecuente del universo de la regla o, sin regla, de las filas (ADR 0135, oleada 9);
  # se procesa primero y las filas conservan su orden.
  firmas_tabs <- vapply(tabs, function(t) {
    f <- attr(t, "ola4_firma_e1", exact = TRUE)
    if (!length(f) || is.na(f[[1]])) NA_character_ else as.character(f[[1]])
  }, character(1))
  i_ref <- .escala_arm_referencia(firmas_tabs, firma_leyenda)
  filas <- vector("list", length(refs))
  names(filas) <- vapply(refs, function(r) as.character(r)[1], character(1))
  bases <- vector("list", length(refs))   # base de cada fila: suma de pesos y casos (graficos_cifras_detalle.R)

  excluidas_ley <- character(0)
  # El cuerpo corre dentro de `.ola4_con_fila` (sus asignaciones quedan en este marco): un fallo nombra su fila.
  for (i in c(i_ref, setdiff(seq_along(refs), i_ref))) .ola4_con_fila(i, refs[[i]], {
    ref <- refs[[i]]
    tab <- tabs[[i]]
    escala_ref <- attr(tab, "ola4_escala_original", exact = TRUE)
    hubo_fila <- isTRUE(attr(tab, "excluded_any", exact = TRUE))
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
      # ADR 0135 §3: el reparto y el punto medio se fijan sobre las opciones SUSTANTIVAS. Las no sustantivas (el 9
      # «No tengo información suficiente» de una 1-5) van a su columna y no cuentan como un nivel más de la escala.
      codigos_escala <- if (!is.null(firma_ref) && length(opciones_ref)) {
        vapply(opciones_ref, function(x) as.character(x$codigo)[1], character(1))
      } else NULL
      meta_ns <- attr(tab, "ola4_meta_especiales", exact = TRUE) %||% list()
      es_ns <- .divergentes_especiales(escala_original, codigos_escala, especiales = meta_ns$especiales %||% character(0),
                                       sustantivos = meta_ns$sustantivos %||% character(0), direccion = direccion_escala)
      no_sustantivas <- escala_original[es_ns]
      # La especificación decide por estos códigos: la tabla ya conoce la dirección de la escala (quinta revisión, H3).
      if (length(codigos_escala)) meta_ns <- list(especiales = unique(c(meta_ns$especiales, codigos_escala[es_ns])),
                                                  sustantivos = codigos_escala[!es_ns])
      sustantivas <- setdiff(escala_reparto, no_sustantivas)
      .divergentes_avisar_direccion(as.character(ref)[1], setdiff(escala_original, no_sustantivas), direccion_escala)   # E1a (ola 2)
      reparto_original <- .divergentes_reparto(
        sustantivas,
        .ola4_n_negativas(n_negativas, length(sustantivas)),
        incluir_neutro
      )
      ref_escala <- as.character(ref)[1]
      if (!is.null(firma_ref) && length(opciones_ref)) {
        forma_escala <- .escala_arm_forma(escala_original, es_ns, n_negativas, incluir_neutro)
        excluidas_ley <- .escala_arm_excluidas(opciones_ref, attr(tab, "ola4_excluir_resuelto", exact = TRUE))
      }
    } else {
      if (xor(is.null(firma_escala), is.null(firma_ref))) {
        stop(
          "La pregunta `", as.character(ref)[1],
          "` no expone la misma firma E1 que `", ref_escala, "`.",
          call. = FALSE
        )
      }
      forma_ref <- NULL
      if (!is.null(firma_escala) && !identical(firma_ref, firma_escala) && !is.null(forma_escala)) {
        forma_ref <- .escala_arm_forma_opciones(opciones_ref, attr(tab, "ola4_meta_especiales", exact = TRUE) %||% list(),
                                                direccion_escala, n_negativas, incluir_neutro)
        motivo <- .escala_arm_motivo(forma_escala, forma_ref)
        if (!is.null(motivo)) {
          stop(.ola4_condicion_fila(paste0("La pregunta `", as.character(ref)[1], "` no se alinea con la escala de `",
                                           ref_escala, "`: ", motivo, "."), motivo))
        }
        # H4: las exclusiones de la leyenda, traducidas a esta escala; todas las filas comparten denominador.
        excl_q <- .escala_arm_traducir_exclusion(excluidas_ley, forma_ref, forma_escala)
        if (length(excluidas_ley) || length(excluir_opciones)) {
          tab <- .ola4_tabla_opciones(ref, filtros, if (length(excl_q)) excl_q else NULL, n_negativas = NULL,
                                      incluir_neutro = incluir_neutro)
          hubo_fila <- isTRUE(attr(tab, "excluded_any", exact = TRUE))
        }
      } else if (!is.null(firma_escala) && !identical(firma_ref, firma_escala)) {
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
      armonizada <- i != i_ref && !is.null(forma_ref)
      opts_canon <- if (armonizada) {
        # Por posición: el nivel j de su escala ocupa la columna j de la leyenda; lo especial, la columna especial.
        .escala_arm_mapear(etiquetas_ref[idx_ref], forma_ref, forma_escala)
      } else {
        escala_original[match(codigos_ref[idx_ref], codigos_canonicos)]
      }
      if (anyNA(idx_ref) || anyNA(opts_canon)) {
        stop(
          "La pregunta `", as.character(ref)[1],
          "` devolvió frecuencias que no corresponden a su firma E1.",
          call. = FALSE
        )
      }
      opts <- opts_canon
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
    bases[[i]] <- c(n = total, n_casos = if ("n_casos" %in% names(tab)) sum(suppressWarnings(as.numeric(tab$n_casos)), na.rm = TRUE) else NA_real_)
    opciones_visibles <- unique(c(opciones_visibles, opts))
    # Dos especiales de una escala alineada caen en la misma columna: se suman.
    por_nivel <- tapply(n, factor(opts, levels = unique(opts)), sum, na.rm = TRUE)
    filas[[i]] <- stats::setNames(as.numeric(por_nivel) / total, names(por_nivel))
    if (!is.null(forma_ref) && i != i_ref) armonizadas[[firma_ref]] <- .escala_arm_texto(forma_ref)
    if (hubo_fila) hubo_exclusion <- TRUE
  })
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
  # La base de cada pregunta (ponderada y en casos) viaja como atributo de la tabla, que sigue siendo una columna por
  # nivel: `.espec_divergentes` la lee y el detalle de cifras la publica (graficos_cifras_detalle.R).
  attr(out, "ola4_n_pond") <- vapply(bases, function(b) if (length(b)) unname(b[["n"]]) else NA_real_, numeric(1))
  attr(out, "ola4_n_casos") <- vapply(bases, function(b) if (length(b)) unname(b[["n_casos"]]) else NA_real_, numeric(1))

  id_por_nivel <- stats::setNames(cols, niveles)
  ids_visibles <- function(x) {
    x <- x[x %in% niveles]
    unname(id_por_nivel[x])
  }
  # Las no sustantivas completan el reparto (el graficador exige cubrir todas las columnas) por el lado positivo; la
  # especificación las reconoce con el mismo detector y las saca de los lados.
  reparto_visible <- list(
    negativas = ids_visibles(reparto_original$negativas),
    neutro = ids_visibles(reparto_original$neutro),
    positivas = ids_visibles(c(reparto_original$positivas, no_sustantivas))
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

  # Los códigos del instrumento de cada nivel (cuando la escala tiene firma): la lámina nativa reconoce por
  # ellos las opciones especiales 90-99 aunque su etiqueta no lo diga (ADR 0093, punto 2).
  codigos <- if (length(opciones_e1)) {
    et <- vapply(opciones_e1, function(x) as.character(x$etiqueta)[1], character(1))
    cd <- vapply(opciones_e1, function(x) as.character(x$codigo)[1], character(1))
    out_cod <- stats::setNames(unname(cd[match(niveles, et)]), cols)
    attr(out_cod, "codigos_lista") <- unname(cd)   # el rango de la escala completa, aun con exclusiones
    attr(out_cod, "especiales") <- meta_ns$especiales %||% character(0)
    attr(out_cod, "sustantivos") <- meta_ns$sustantivos %||% character(0)
    out_cod
  } else NULL
  list(
    data = out,
    cols_porcentaje = cols,
    etiquetas_grupos = stats::setNames(niveles, cols),
    codigos_grupos = codigos,
    reparto = reparto_visible,
    hubo_exclusion = hubo_exclusion,
    ref_escala = ref_escala,
    escalas_armonizadas = unname(unlist(armonizadas)),
    opciones_leyenda = opciones_e1
  )
}

# El rótulo de cada fila es el enunciado de la pregunta, no su referencia: la tabla se arma por `ref` y sin esto la
# lámina decía «estudiantes$gestion_5» (catálogo del recetario, 2026-10-14). Un nombre declarado en `vars` manda; si el
# motor no expone el resolvedor (tests del graficador), queda la referencia.
.ola4_rotulos_preguntas <- function(vars, refs) {
  refs <- as.character(refs)
  nombres <- names(vars) %||% character(0)
  vals <- vapply(vars, function(v) as.character(v)[1], character(1))
  resolver <- dynGet(".resolve_ref", ifnotfound = NULL)
  vapply(refs, function(r) {
    i <- match(r, vals)
    if (!is.na(i) && length(nombres) >= i && !is.na(nombres[i]) && nzchar(trimws(nombres[i]))) return(trimws(nombres[i]))
    corto <- .resumen_rotulo_corto(r, NA_character_)   # nombre corto de la pregunta (overrides$etiquetas_vars)
    if (!is.na(corto)) return(corto)
    if (!is.function(resolver)) return(r)
    ctx <- tryCatch(resolver(r, arg_name = "vars"), error = function(e) NULL)
    if (is.null(ctx) || !is.data.frame(ctx$survey)) return(r)
    .fsub_enunciado(ctx)
  }, character(1), USE.NAMES = FALSE)
}

#' @keywords internal
.render_barras_divergentes <- function(el, preset_args = list()) {
  base_preset <- if (length(preset_args)) preset_args else .ola4_preset("barras_divergentes")
  ap <- .regla_preguntas_aplicar_render(el, "barras divergentes", preset = base_preset); el <- ap$el   # ADR 0135
  args_usuario <- utils::modifyList(as.list(base_preset %||% list()),
                                    as.list(el$overrides %||% list()))
  el <- .divergentes_expandir_comodin(el, args_usuario, base_preset)   # sin regla: `base$*` y el recorte por la métrica (graficos_escala_comodin.R)
  ap$texto <- .tope_espacio_unir(ap$texto, el$.texto_tope)
  # E3: la escala del resumen con más filas de las que caben muestra las que caben, en el orden de la regla, y lo dice.
  tope <- if (identical(args_usuario$estilo, "resumen")) .divergentes_tope_espacio(el$vars, el$regla) else list(vars = el$vars)
  el$vars <- tope$vars
  ap$texto <- .tope_espacio_unir(ap$texto, tope$texto)
  excluir_opciones <- .reporte_plan_excluir_cascada(
    base_preset,
    el$overrides %||% list(),
    el
  )
  # Con regla, una fila que no se puede dibujar sale con aviso y no tumba la lámina (graficos_escala_filas_fallidas.R).
  tabla <- (if (is.null(el$regla) && !isTRUE(el$.comodin_expandido)) .ola4_tabla_escala else .ola4_tabla_escala_tolerante)(
    el$vars,
    el$filtros %||% list(),
    excluir_opciones = excluir_opciones,
    n_negativas = args_usuario$n_negativas,
    incluir_neutro = args_usuario$incluir_neutro %||% TRUE,
    direccion_escala = args_usuario$direccion_escala %||% "negativo_positivo",
    firma_leyenda = el$.firma_leyenda
  )
  for (av in .ola4_avisos_omitidas(tabla$omitidas)) .pulso_aviso(av)
  for (av in .escala_arm_avisos_exclusion(.escala_arm_excluir_declaradas(base_preset, el), tabla$opciones_leyenda)) .pulso_aviso(av)
  if (is.null(tabla$data)) stop("La escala no deja ninguna pregunta que se pueda dibujar.", call. = FALSE)

  refs_filas <- tabla$data$categoria
  tabla$data$categoria <- .divergentes_rotulos_publicos(.ola4_rotulos_preguntas(el$vars, refs_filas), refs_filas, el$abreviaturas)

  args_usuario$excluir_opciones <- NULL
  args_usuario$direccion_escala <- NULL
  base_args <- list(
    data = tabla$data,
    var_categoria = "categoria",
    cols_porcentaje = tabla$cols_porcentaje,
    etiquetas_grupos = tabla$etiquetas_grupos,
    codigos_grupos = tabla$codigos_grupos,
    reparto = tabla$reparto,
    escala_valor = "proporcion_1",
    titulo = el$title_slide %||% NULL
  )
  # ADR 0097: la paleta de la lista de la escala, si es del usuario, pinta cada nivel por su etiqueta (la de un
  # perfil no cambia el recetario). Un color elegido en la tarjeta (`colores_grupos`) sigue mandando.
  base_args$colores_grupos <- .ola4_paleta_niveles(tabla$ref_escala %||% el$vars[[1]], tabla$etiquetas_grupos)
  args <- utils::modifyList(base_args, args_usuario)
  # El reparto derivado de la escala original no es reemplazable por presets o
  # overrides: hacerlo reintroduciria la reclasificacion por indices visibles.
  args$reparto <- tabla$reparto
  args <- .regla_escala_orden_args(args, el)   # la regla fijó el orden: las filas van como las ordenó (ADR 0135)
  # E1b (ola 2): la cifra de la imagen al cuerpo del preset, nunca más chica (`.std_pt("cifra")`).
  args$size_valores <- max(suppressWarnings(as.numeric(args$size_valores %||% 0)[1]), .std_pt("cifra") * 25.4 / 72, na.rm = TRUE)
  args <- .keep_formals(graficar_barras_divergentes, args, contexto = "graficar_barras_divergentes")
  p <- .regla_preguntas_en_espec(do.call(graficar_barras_divergentes, args), ap$texto)
  esp <- attr(p, "pulso_espec", exact = TRUE)
  if (identical(esp$estilo, "resumen")) {
    # graficos_escala_tope.R: las dos causas del respaldo, más filas que el tope o más de una columna «Sin información»
    for (av in .divergentes_aviso_tope(length(esp$filas), ap$texto, sum(esp$categorias$lado == "sin_inf"))) .pulso_aviso(av)
  }
  .divergentes_nota_porcentaje(p, isTRUE(tabla$hubo_exclusion), tabla$escalas_armonizadas)
}

#' El denominador de la escala del resumen, para su pie (ADR 0135 §3, como el mazo de Arte)
#'
#' Sin exclusiones el porcentaje es sobre el total de respondientes (con «Sin información» en su columna); si una
#' respuesta se excluyó, sobre quienes quedan.
#' @keywords internal
.divergentes_nota_porcentaje <- function(p, hubo_exclusion = FALSE, escalas_armonizadas = character(0)) {
  esp <- attr(p, "pulso_espec", exact = TRUE)
  if (is.null(esp) || !identical(esp$estilo, "resumen")) return(p)
  esp$nota_porcentaje <- .escala_arm_nota(
    if (isTRUE(hubo_exclusion)) "Porcentaje sobre quienes respondieron, sin contar las respuestas excluidas."
    else "Porcentaje sobre el total de respondientes.", escalas_armonizadas)
  attr(p, "pulso_espec") <- esp
  # El respaldo (ggplot) escribe en su pie lo que trae `note_outside`: el denominador y la regla, como la nativa.
  attr(p, "note_outside") <- .lam_con_punto(.lam_unir_base(esp$nota_porcentaje, esp$texto_regla))
  p
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
#' @param etiqueta_brecha Unidad junto a la diferencia («+6 pts»). `NULL` hereda
#'   el preset o el motor («pts», como el recetario).
#' @param titulos_grupo Títulos de los temas, `clave -> título`; reemplazan la
#'   clave de `vars` como etiqueta de la fila (sólo sin `cruce`).
#' @param orden,mostrar_brecha,umbral_brecha_pct `NULL` no opina (O7c): rige el
#'   preset del tipo y, sin él, el defecto de `graficar_dumbbell()` («brecha»,
#'   `TRUE`, 0: los que tenía este constructor).
#' @param regla Cómo se eligen los temas entre los de `vars` (ADR 0135); sólo en el estilo resumen. Un tema cuyas dos
#'   referencias son `base$*` toma los pares del mismo nombre entre las dos bases.
#' @param leyenda_con_n "N en la leyenda": cada grupo con sus casos sin ponderar ("TC (24)"). `NULL` no opina: con tres o
#'   cuatro grupos va; con dos, como el dumbbell de siempre (graficos_dumbbell_tres_grupos.R).
#' @param universos_no_confiables Lo tecleado como padrón de un grupo con «Padrón confiable» apagado («Docentes TC:
#'   24»): se conserva en el elemento y no entra a ningún cálculo (graficos_padron_confiable.R).
#' @export
p_dumbbell <- function(vars = NULL,
                       corte,
                       corte_etiqueta = NULL,
                       orden = NULL,
                       mostrar_brecha = NULL,
                       umbral_brecha_pct = NULL,
                       titulo = NULL,
                       overrides = list(),
                       base = list(),
                       filtros = list(),
                       etiqueta_brecha = NULL,
                       cruce = NULL,
                       grupos = NULL,
                       titulos_grupo = NULL,
                       estilo = NULL,
                       universos = NULL,
                       separar_tras = NULL,
                       base_en = NULL,
                       regla = NULL,
                       universos_no_confiables = NULL,
                       bases = NULL,
                       leyenda_con_n = NULL) {
  no_confiables <- .graficos_universos_no_confiables(universos_no_confiables, "p_dumbbell()")
  # G17: con `cruce` y `grupos` la brecha es entre dos grupos de una misma base (graficos_dumbbell_grupos.R).
  if (!is.null(cruce)) {
    # ADR 0135: con regla y sin temas, las aperturas toman la base del cruce (graficos_dumbbell_auto.R).
    if (.dumbbell_sin_temas(vars) && !is.null(.regla_preguntas_normalizar(regla))) vars <- .dumbbell_vars_de_cruce(cruce)
    el <- .p_dumbbell_grupos(vars, corte, corte_etiqueta, orden, mostrar_brecha, umbral_brecha_pct, titulo,
                             overrides, base, filtros, etiqueta_brecha, cruce, grupos, estilo, universos, separar_tras, base_en, leyenda_con_n)
    el$universos_no_confiables <- no_confiables
    return(.regla_preguntas_en_constructor(el, regla, "p_dumbbell()"))   # ADR 0135
  }
  # ADR 0135: sin temas, el contraste los arma solo desde `bases` o, con una regla, desde las dos bases del estudio
  # (graficos_dumbbell_auto.R).
  diferido <- FALSE
  if (.dumbbell_sin_temas(vars)) {
    par <- .dumbbell_bases_contraste(bases)
    if (is.null(.regla_preguntas_normalizar(regla))) {
      if (is.null(par)) .plan_spec_abort("p_dumbbell(): declara los temas en `vars` o los dos públicos en `bases`.")
      regla <- list(tipo = "comunes")
    }
    if (is.null(par)) diferido <- TRUE else vars <- .dumbbell_vars_de_bases(par)
  }
  if (diferido) {
    if (!length(.radar_mb_codigos(corte))) .plan_spec_abort("p_dumbbell(): `corte` debe traer al menos un codigo de la escala.")
    if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
    ov <- .dumbbell_slot_overrides(overrides, orden, mostrar_brecha, umbral_brecha_pct, etiqueta_brecha)
    ov <- .dumbbell_resumen_overrides(ov, estilo, universos, separar_tras, base_en, leyenda_con_n)
    el <- list(.element_type = "dumbbell", var = NULL, vars = NULL, corte = .graf_corte_unido(corte),
               corte_etiqueta = as.character(corte_etiqueta %||% "")[1], title_slide = titulo, overrides = ov, base = base,
               filtros = .ppt_norm_filters(filtros), universos_no_confiables = no_confiables)
    class(el) <- c("ppt_element", "list")
    return(.regla_preguntas_en_constructor(el, regla, "p_dumbbell()"))
  }
  vars <- .graf_aplicar_titulos_grupo(vars, titulos_grupo, "p_dumbbell()")
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
    # De dos a cuatro públicos (graficos_dumbbell_tres_grupos.R): los elige el analista, tema por tema.
    if (length(refs_tema) < 2L || length(refs_tema) > .DUMBBELL_GRUPOS_MAX) {
      .plan_spec_abort(
        "p_dumbbell(): el tema `", tema,
        "` debe declarar de dos a cuatro referencias de fuentes distintas."
      )
    }
    fuentes <- .ola4_fuentes_de_refs(refs_tema, "p_dumbbell()", tema)
    if (anyDuplicated(fuentes)) {
      .plan_spec_abort(
        "p_dumbbell(): el tema `", tema,
        "` debe declarar fuentes distintas."
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

  ov <- .dumbbell_slot_overrides(overrides, orden, mostrar_brecha, umbral_brecha_pct, etiqueta_brecha)
  ov <- .dumbbell_resumen_overrides(ov, estilo, universos, separar_tras, base_en, leyenda_con_n)   # ADR 0134

  el <- list(
    .element_type = "dumbbell",
    var  = NULL,
    vars = vars_norm,
    corte = .graf_corte_unido(corte),
    corte_etiqueta = as.character(corte_etiqueta %||% "")[1],
    title_slide = titulo,
    overrides = ov,
    base = base,
    filtros = .ppt_norm_filters(filtros)
  )
  el$universos_no_confiables <- no_confiables
  class(el) <- c("ppt_element", "list")
  .regla_preguntas_en_constructor(el, regla, "p_dumbbell()")   # ADR 0135
}

# O7c: el constructor escribía SIEMPRE `orden`, `mostrar_brecha` y `umbral_brecha_pct` con sus defectos, y como el
# render mezcla `preset -> overrides`, el preset del tipo no llegaba nunca. Sólo se escribe lo que el slot declara; un
# override explícito manda sobre el formal. Compartido con la brecha entre grupos (graficos_dumbbell_grupos.R).
.DUMBBELL_ORDENES <- c("brecha", "valor", "declarado")

#' @keywords internal
.dumbbell_slot_overrides <- function(overrides, orden, mostrar_brecha, umbral_brecha_pct, etiqueta_brecha) {
  ov <- .ppt_slot_override(overrides, "orden", orden, "opcion", opciones = .DUMBBELL_ORDENES)
  ov <- .ppt_slot_override(ov, "mostrar_brecha", mostrar_brecha, "bool")
  ov <- .ppt_slot_override(ov, "umbral_brecha_pct", umbral_brecha_pct, "numero", min = 0)
  .ppt_slot_override(ov, "etiqueta_brecha", etiqueta_brecha, "texto")
}

#' @keywords internal
.render_dumbbell <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  inst_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources) || !length(inst_sources)) {
    stop("dumbbell: el render no expone las fuentes del estudio.", call. = FALSE)
  }
  sources <- list(data_sources = data_sources, inst_sources = inst_sources)
  .dumbbell_grupos_validar_render(el, sources)   # grupos en código y etiqueta (graficos_dumbbell_grupos.R)
  sin_eq <- .dumbbell_sin_equivalencia(el, sources)   # ADR 0138 §5: nunca por nombre (graficos_dumbbell_equivalencia.R)
  if (!is.null(sin_eq)) return(.dumbbell_lamina_sin_equivalencia(sin_eq))
  ap <- .regla_preguntas_aplicar_render(el, "dumbbell", sources); el <- ap$el   # ADR 0135
  if (!is.null(el$cruce)) {
    temas <- .resumen_temas_cortos(.dumbbell_grupos_temas(el$vars, sources))   # nombre corto de la pregunta (lamina_rotulo_resumen.R)
    datos <- .dumbbell_grupos_datos(temas, el$corte, el$cruce, el$grupos, sources, filtros = el$filtros %||% list())
  } else {
    el$vars <- .resumen_temas_cortos(el$vars)   # nombre corto de la pregunta (lamina_rotulo_resumen.R)
    datos <- .radar_mb_datos(el$vars, el$corte, sources, filtros = el$filtros %||% list())
    fuentes <- .ola4_fuentes_de_refs(el$vars[[1]], "dumbbell", names(el$vars)[[1]])
    .ola4_validar_matriz_multibase(datos, names(el$vars), fuentes, "dumbbell")
  }

  base_preset <- if (length(preset_args)) preset_args else .ola4_preset("dumbbell")
  args_usuario <- utils::modifyList(as.list(base_preset %||% list()),
                                    as.list(el$overrides %||% list()))
  # E3 (graficos_tope_espacio.R); en una ranura recorta la ranura con lo que de verdad cabe (P5).
  tope <- if (.tope_espacio_en_ranura(el)) list(datos = datos, texto = NULL) else .contraste_tope_espacio(datos, args_usuario$valores_decimales %||% 0L)
  datos <- tope$datos
  base_args <- list(
    data = datos, var_eje = "eje", var_grupo = "grupo", var_valor = "valor",
    escala_valor = "proporcion_100",
    titulo = el$title_slide %||% NULL,
    subtitulo = el$corte_etiqueta %||% NULL
  )
  args <- utils::modifyList(base_args, args_usuario)
  args <- .dumbbell_estilo_por_grupos(args)   # tres o cuatro grupos: el dibujo del contraste (graficos_dumbbell_tres_grupos.R)
  # ADR 0134: en el contraste del resumen los públicos se rotulan capitalizados («Docentes»), como la leyenda del radar;
  # el padrón se empareja sin mayúsculas, así que «docentes: 123» sigue casando.
  if (identical(args$estilo, "resumen") && is.null(el$cruce)) levels(args$data$grupo) <- .radar_mb_capitalizar(levels(args$data$grupo))
  args <- .regla_preguntas_orden_contraste(args, el$regla)   # «mayor diferencia»: la brecha absoluta más grande arriba
  args <- .keep_formals(graficar_dumbbell, args, contexto = "graficar_dumbbell")
  p <- .dumbbell_con_grupo_chico(do.call(graficar_dumbbell, args), el)   # «Grupo chico: 24 docentes TC.»
  if (!identical(args$estilo, "resumen")) p <- .tope_espacio_al_pie(p, el, tope$texto)   # el clásico no tiene nota de regla
  p <- .contraste_regla_en_espec(p, el, total = ap$total)   # para que una ranura que recorta reescriba la nota en una frase (P7)
  .regla_preguntas_en_espec(p, .tope_espacio_unir(ap$texto, if (identical(args$estilo, "resumen")) tope$texto))
}

# --- Lollipop ---------------------------------------------------------------

#' Ranking tipo lollipop de las opciones de una pregunta
#' @param orden `NULL` no opina (O7c): rige el preset del tipo y, sin él, el
#'   defecto de `graficar_lollipop()` («mayor_menor», el que tenía este constructor).
#' @export
p_lollipop <- function(var,
                       orden = NULL,
                       top_n = NULL,
                       resaltar = NULL,
                       titulo = NULL,
                       overrides = list(),
                       base = list(),
                       filtros = list(),
                       excluir_opciones = NULL,
                       residuales_gris = NULL) {
  if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
    .plan_spec_abort("p_lollipop(): `var` debe ser character(1) no vacio.")
  }
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")

  ov <- .ppt_slot_override(overrides, "orden", orden, "opcion", opciones = c("mayor_menor", "menor_mayor", "declarado"))
  if (!is.null(top_n)) ov$top_n <- suppressWarnings(as.integer(top_n)[1])
  if (!is.null(resaltar)) ov$resaltar <- as.character(resaltar)
  ov <- .ppt_slot_override(ov, "residuales_gris", residuales_gris, "bool")   # residuales en gris: opción del gráfico, apagada por defecto
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
  # Opción múltiple (recetario p72: «% de encuestados que marcó cada opción»): el denominador son las personas que
  # respondieron, no la suma de marcas, y no pasa por la validación de respuesta única de la escala (catálogo, H4).
  es_sm <- dynGet(".reporte_plan_is_select_multiple", ifnotfound = function(...) FALSE)
  if (isTRUE(es_sm(el$var))) {
    df <- .ola4_lollipop_sm(el$var, el$filtros %||% list(), excluir_opciones)
    total <- 1
  } else {
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
  }

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
  .paleta_en_espec(do.call(graficar_lollipop, args), .ola4_paleta_de_ref(el$var))   # ADR 0097: espec$colores
}

#' Ranking de una pregunta de opción múltiple: cada opción sobre las personas que respondieron
#'
#' Las frecuencias son las del motor (`.tab_freq`); la fila «Total» de una opción múltiple trae la base de personas
#' (`.plan_base_de_tab`), que es el denominador del recetario p72.
#' @keywords internal
.ola4_lollipop_sm <- function(ref, filtros, excluir_opciones = NULL) {
  tab_freq <- dynGet(".tab_freq", ifnotfound = NULL)
  if (!is.function(tab_freq)) stop("El render no expone `.tab_freq()` del motor.", call. = FALSE)
  crudo <- tab_freq(ref, filtros = filtros)
  if (is.null(crudo) || !nrow(crudo)) stop("lollipop: `var` no devolvio frecuencias utilizables.", call. = FALSE)
  base <- .plan_base_de_tab(crudo, crudo, es_sm = TRUE)$n
  tab <- .reporte_plan_filter_freq_options(.reporte_plan_prepare_freq_options(crudo), excluir_opciones)
  tab <- tab[as.character(tab$Opciones) != "Total", , drop = FALSE]
  if (!is.finite(base) || base <= 0 || !nrow(tab)) stop("lollipop: la base de `var` es cero.", call. = FALSE)
  data.frame(categoria = as.character(tab$Opciones), pct = suppressWarnings(as.numeric(tab$n)) / base, stringsAsFactors = FALSE)
}

#' La paleta resuelta de la lista de una pregunta (`.paleta_auto` del motor), o `NULL` fuera del motor
#' @keywords internal
.ola4_paleta_de_ref <- function(ref) {
  paleta_auto <- dynGet(".paleta_auto", ifnotfound = NULL)
  lista_de <- dynGet(".list_name_of_var", ifnotfound = NULL)
  if (!is.function(paleta_auto) || !is.function(lista_de)) return(NULL)
  ln <- tryCatch(lista_de(as.character(ref)[1]), error = function(e) NA_character_)
  if (is.null(ln) || is.na(ln) || !nzchar(ln)) return(NULL)
  tryCatch(paleta_auto(ln), error = function(e) NULL)
}

#' Colores de los niveles de una escala por columna (`pct_1` = hex), sólo si la paleta de su lista es del usuario
#' @keywords internal
.ola4_paleta_niveles <- function(ref, etiquetas) {
  pal <- .ola4_paleta_de_ref(ref)
  if (!.paleta_es_de_usuario(pal) || !length(etiquetas)) return(NULL)
  rot <- unname(as.character(etiquetas))
  por_rotulo <- .paleta_colores_para(rot, pal)
  if (is.null(por_rotulo)) return(NULL)
  .paleta_heredar_attrs(stats::setNames(unname(por_rotulo[rot]), names(etiquetas)), pal)
}
