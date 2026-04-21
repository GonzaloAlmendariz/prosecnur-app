# =============================================================================
# CONSTRUCTORES DE INDICADORES CATEGÓRICOS
# =============================================================================

.ind_migration_nivel_msg <- function() {
  paste0(
    "API actualizada: usa `nivel(..., cuando = ~ ...)`.\n",
    "Ejemplo:\n",
    "  nivel(\"1\", \"Conoce\", cuando = ~ ind_es(P1, \"1\"))"
  )
}

.ind_migration_indicador_msg <- function() {
  paste0(
    "API actualizada: define reglas directamente en cada nivel con `cuando = ~ ...`.\n",
    "Ejemplo:\n",
    "  indicador(\n",
    "    nombre = \"demo\",\n",
    "    niveles = list(\n",
    "      nivel(\"1\", \"Reciente\", cuando = ~ ind_alguna(ind_es(P17_1, \"1\"), ind_es(P17_2, \"1\"))),\n",
    "      nivel(\"2\", \"No reciente\", cuando = ~ !nivel_1 & ind_es(P18, \"1\"))\n",
    "    )\n",
    "  )"
  )
}

.ind_deprecated_usa_msg <- function() {
  paste0(
    "La API `definidores + usa + grupo` está deprecada.\n",
    "Usa `nivel(..., cuando = ~ ...)` y helpers `ind_*` con variables directas."
  )
}

#' @keywords internal
.ind_removed_prioridad_msg <- function() {
  paste0(
    "`prioridad` fue eliminado; los niveles deben ser excluyentes ",
    "y se asignan en el orden declarado."
  )
}

#' @keywords internal
.ind_nivel_ref <- function(code) {
  paste0("nivel_", as.character(code)[1])
}

#' Definir un nivel de un indicador
#'
#' Constructor de un nivel individual dentro de un indicador categórico.
#' Cada nivel tiene un código interno, una etiqueta humana y una condición
#' lógica en `cuando = ~ ...`.
#'
#' @param code Código interno del nivel (character). Debe ser único dentro
#'   del indicador.
#' @param label Etiqueta humana del nivel. Por defecto usa \\code{code}.
#' @param cuando Fórmula de un lado (`~ ...`) con la condición del nivel.
#'   Puede referenciar niveles previos con `nivel_<code>` (ejemplo: `nivel_1`).
#' @param usa Campo de compatibilidad con API antigua (deprecado).
#'
#' @return Lista de clase \\code{"prosecnur_nivel"}.
#' @family indicador
#' @export
nivel <- function(code, label = code, cuando = NULL, usa = NULL) {
  code  <- as.character(code)[1]
  label <- as.character(label)[1]

  if (!nzchar(code)) stop("`code` no puede estar vacío.", call. = FALSE)

  # Compatibilidad: tercer argumento posicional antiguo (`usa` character)
  if (is.null(usa) && !is.null(cuando) && !inherits(cuando, "formula")) {
    usa <- cuando
    cuando <- NULL
  }

  # Compatibilidad: si llega fórmula por `usa=`, interpretarla como `cuando=`
  if (is.null(cuando) && inherits(usa, "formula")) {
    cuando <- usa
    usa <- NULL
  }

  if (!is.null(cuando)) {
    if (!inherits(cuando, "formula") || length(cuando) != 2L) {
      stop("`cuando` debe ser una fórmula de un lado (`~ ...`).", call. = FALSE)
    }
    if (!is.null(usa)) {
      warning("`nivel()`: se recibieron `cuando` y `usa`; se usará `cuando`.", call. = FALSE)
      usa <- NULL
    }
    out <- list(code = code, label = label, cuando = cuando, usa = NULL)
    class(out) <- c("prosecnur_nivel", "list")
    return(out)
  }

  if (is.null(usa)) {
    stop(.ind_migration_nivel_msg(), call. = FALSE)
  }

  usa <- as.character(usa)[1]
  if (is.na(usa) || !nzchar(trimws(usa))) {
    stop("`usa` debe ser el nombre de un bloque (por ejemplo `\"A\"`).", call. = FALSE)
  }

  out <- list(code = code, label = label, cuando = NULL, usa = trimws(usa))
  class(out) <- c("prosecnur_nivel", "list")
  out
}

#' Definir un indicador categórico
#'
#' Constructor de la especificación completa de un indicador categórico.
#' Vía recomendada (nueva):
#' \\itemize{
#'   \\item \\code{niveles} con \\code{cuando = ~ ...}.
#'   \\item Referencias entre niveles con \\code{nivel_<code>} (solo niveles previos).
#' }
#'
#' Compatibilidad (deprecada): también acepta la vía antigua
#' \\code{definidores + usa + grupo}.
#'
#' @param nombre Nombre de la variable resultante (sin prefijo).
#' @param etiqueta Etiqueta humana del indicador. Por defecto usa \\code{nombre}.
#' @param niveles Lista de objetos \\code{\\link{nivel}()}.
#' @param definidores Compatibilidad deprecada con API antigua.
#' @param grupos Compatibilidad deprecada con API antigua.
#' @param solo_observados Si \\code{TRUE} (default), no asigna nivel cuando
#'   una fila no tiene ningún dato observado en las variables evaluadas.
#' @param measure Nivel de medición: \\code{"NOMINAL"} (default) u
#'   \\code{"ORDINAL"}.
#' @param ... Argumentos no soportados. Si se pasa \\code{prioridad}, se detiene
#'   con mensaje de migración.
#'
#' @return Lista de clase \\code{"prosecnur_indicador"}.
#' @family indicador
#' @export
indicador <- function(
    nombre,
    etiqueta        = nombre,
    niveles,
    definidores     = NULL,
    grupos          = NULL,
    solo_observados = TRUE,
    measure         = c("NOMINAL", "ORDINAL"),
    ...
) {
  dots <- list(...)
  if ("prioridad" %in% names(dots)) {
    stop(.ind_removed_prioridad_msg(), call. = FALSE)
  }
  if (length(dots)) {
    stop(
      sprintf("Argumentos no soportados en `indicador()`: %s", paste(names(dots), collapse = ", ")),
      call. = FALSE
    )
  }

  nombre    <- as.character(nombre)[1]
  etiqueta  <- as.character(etiqueta)[1]
  measure   <- match.arg(measure)

  if (!nzchar(nombre)) stop("`nombre` no puede estar vacío.", call. = FALSE)

  if (!is.list(niveles) || !length(niveles)) {
    stop("`niveles` debe ser una lista no vacía de objetos `nivel()`.", call. = FALSE)
  }
  for (i in seq_along(niveles)) {
    if (!inherits(niveles[[i]], "prosecnur_nivel")) {
      if (is.list(niveles[[i]]) && !is.null(niveles[[i]]$regla)) {
        stop(.ind_migration_nivel_msg(), call. = FALSE)
      }
      stop(
        sprintf("`niveles[[%d]]` no es un objeto `nivel()`. Usa nivel() para construirlo.", i),
        call. = FALSE
      )
    }
  }

  codes <- vapply(niveles, function(n) n$code, character(1))
  if (anyDuplicated(codes)) {
    dups <- unique(codes[duplicated(codes)])
    stop(
      sprintf("Códigos duplicados en indicador '%s': %s", nombre, paste(dups, collapse = ", ")),
      call. = FALSE
    )
  }

  has_cuando <- vapply(niveles, function(n) !is.null(n$cuando), logical(1))
  has_usa <- vapply(niveles, function(n) !is.null(n$usa) && nzchar(trimws(as.character(n$usa)[1])), logical(1))

  if (any(has_cuando) && any(has_usa)) {
    stop(
      "No mezcles `cuando` y `usa` en un mismo indicador. Usa una sola vía.",
      call. = FALSE
    )
  }

  if (!any(has_cuando) && !any(has_usa)) {
    stop(.ind_migration_indicador_msg(), call. = FALSE)
  }

  if (any(has_cuando)) {
    if (!all(has_cuando)) {
      stop("Todos los niveles deben usar `cuando` en la vía nueva.", call. = FALSE)
    }

    refs_names <- vapply(codes, .ind_nivel_ref, character(1))
    for (i in seq_along(niveles)) {
      frm <- niveles[[i]]$cuando
      if (!inherits(frm, "formula") || length(frm) != 2L) {
        stop(
          sprintf("`niveles[[%d]]$cuando` debe ser fórmula de un lado (~ ...).", i),
          call. = FALSE
        )
      }

      refs <- all.vars(frm[[2]])
      refs_nivel <- refs[grepl("^nivel_", refs)]
      permitidos <- refs_names[seq_len(max(i - 1L, 0L))]
      bad <- setdiff(refs_nivel, permitidos)
      if (length(bad)) {
        stop(
          sprintf(
            paste0(
              "Indicador '%s', nivel '%s': referencia niveles no permitidos (%s). ",
              "Solo puedes usar niveles previos."
            ),
            nombre, niveles[[i]]$code, paste(bad, collapse = ", ")
          ),
          call. = FALSE
        )
      }
    }

    if (!is.null(definidores) && length(definidores)) {
      warning("`definidores` se ignora porque este indicador usa `cuando`.", call. = FALSE)
    }
    if (!is.null(grupos) && length(grupos)) {
      warning("`grupos` se ignora porque este indicador usa `cuando`.", call. = FALSE)
    }

    if (!is.logical(solo_observados) || length(solo_observados) != 1L || is.na(solo_observados)) {
      stop("`solo_observados` debe ser TRUE o FALSE.", call. = FALSE)
    }

    out <- list(
      nombre          = nombre,
      etiqueta        = etiqueta,
      niveles         = niveles,
      definidores     = list(),
      grupos          = list(),
      solo_observados = solo_observados,
      measure         = measure,
      modo_reglas     = "cuando"
    )
    class(out) <- c("prosecnur_indicador", "list")
    return(out)
  }

  # Vía antigua (deprecada): usa + definidores + grupos
  .Deprecated(msg = .ind_deprecated_usa_msg())

  if (!all(has_usa)) {
    stop("Todos los niveles deben usar `usa` en la vía antigua.", call. = FALSE)
  }

  if (is.null(definidores)) {
    stop("En la vía `usa`, `definidores` es obligatorio.", call. = FALSE)
  }
  if (!is.list(definidores) || !length(definidores)) {
    stop("`definidores` debe ser una lista no vacía de fórmulas nombradas.", call. = FALSE)
  }

  def_names <- names(definidores)
  if (is.null(def_names) || any(is.na(def_names)) || any(!nzchar(trimws(def_names)))) {
    stop("`definidores` debe tener nombres (por ejemplo A, B, C).", call. = FALSE)
  }
  def_names <- trimws(def_names)
  if (anyDuplicated(def_names)) {
    dups <- unique(def_names[duplicated(def_names)])
    stop("Definidores duplicados: ", paste(dups, collapse = ", "), call. = FALSE)
  }
  names(definidores) <- def_names
  for (i in seq_along(definidores)) {
    di <- definidores[[i]]
    nm <- def_names[i]
    if (!inherits(di, "formula") || length(di) != 2L) {
      stop(sprintf("`definidores[['%s']]` debe ser fórmula de un lado (~ ...).", nm), call. = FALSE)
    }

    refs <- all.vars(di[[2]])
    future <- intersect(refs, def_names[seq.int(i + 1L, length(def_names))])
    if (length(future)) {
      stop(
        sprintf(
          "`definidores[['%s']]` referencia bloques futuros (%s). Solo se permiten bloques previos.",
          nm, paste(future, collapse = ", ")
        ),
        call. = FALSE
      )
    }
  }

  if (is.null(grupos)) grupos <- list()
  if (!is.list(grupos)) {
    stop("`grupos` debe ser una lista nombrada de `grupo(...)`.", call. = FALSE)
  }
  if (length(grupos)) {
    g_names <- names(grupos)
    if (is.null(g_names) || any(is.na(g_names)) || any(!nzchar(trimws(g_names)))) {
      stop("`grupos` debe tener nombres (por ejemplo P17, P33).", call. = FALSE)
    }
    g_names <- trimws(g_names)
    if (anyDuplicated(g_names)) {
      dups <- unique(g_names[duplicated(g_names)])
      stop("Grupos duplicados: ", paste(dups, collapse = ", "), call. = FALSE)
    }
    names(grupos) <- g_names
  }

  grupos_norm <- lapply(seq_along(grupos), function(i) {
    g <- grupos[[i]]
    nm <- names(grupos)[i]

    if (inherits(g, "prosecnur_grupo")) {
      vars <- g$vars
    } else if (is.character(g)) {
      vars <- g
    } else {
      stop(sprintf("`grupos[['%s']]` debe venir de `grupo(...)`.", nm), call. = FALSE)
    }

    vars <- trimws(as.character(vars))
    vars <- vars[!is.na(vars) & nzchar(vars)]
    vars <- unique(vars)
    if (!length(vars)) {
      stop(sprintf("`grupos[['%s']]` no contiene variables válidas.", nm), call. = FALSE)
    }

    outg <- list(vars = vars)
    class(outg) <- c("prosecnur_grupo", "list")
    outg
  })
  names(grupos_norm) <- names(grupos)

  usa_levels <- vapply(niveles, function(n) as.character(n$usa)[1], character(1))
  missing_defs <- setdiff(usa_levels, def_names)
  if (length(missing_defs)) {
    stop(
      sprintf(
        "Niveles referencian definidores no declarados: %s",
        paste(unique(missing_defs), collapse = ", ")
      ),
      call. = FALSE
    )
  }

  if (!is.logical(solo_observados) || length(solo_observados) != 1L || is.na(solo_observados)) {
    stop("`solo_observados` debe ser TRUE o FALSE.", call. = FALSE)
  }

  out <- list(
    nombre          = nombre,
    etiqueta        = etiqueta,
    niveles         = niveles,
    definidores     = definidores,
    grupos          = grupos_norm,
    solo_observados = solo_observados,
    measure         = measure,
    modo_reglas     = "usa"
  )
  class(out) <- c("prosecnur_indicador", "list")
  out
}

# =============================================================================
# FUNCIÓN PRINCIPAL
# =============================================================================

#' Construir indicadores categóricos
#'
#' Evalúa indicadores en dos vías:
#' \\itemize{
#'   \\item Vía nueva (recomendada): \\code{nivel(..., cuando = ~ ...)}
#'   con referencias \\code{nivel_<code>} entre niveles previos.
#'   \\item Vía antigua (deprecada): \\code{definidores + usa + grupo}.
#' }
#'
#' @param data \\code{data.frame} o \\code{tibble}, típicamente la salida de
#'   \\code{\\link{reporte_data}()}.
#' @param indicadores Lista de objetos \\code{\\link{indicador}()}.
#' @param instrumento Objeto devuelto por \\code{\\link{reporte_instrumento}()}.
#'   Si es \\code{NULL}, se toma desde \\code{attr(data, "instrumento_reporte")}.
#' @param prefijo Prefijo para las columnas creadas. Por defecto \\code{"ind_"}.
#' @param verbose Si \\code{TRUE} (default), imprime mensajes de validación por
#'   indicador y nivel, en lenguaje claro.
#'
#' @return El mismo \\code{data.frame} con las nuevas columnas categóricas.
#'   Además actualiza el instrumento en \\code{attr(data, "instrumento_reporte")}
#'   y agrega el atributo \\code{indicadores_meta} con trazabilidad.
#'
#' @details
#' Los niveles deben ser excluyentes. Si dos niveles aplican a la misma fila,
#' la función se detiene con error claro para corregir el diseño del indicador.
#'
#' Si \\code{solo_observados = TRUE} (por indicador), filas sin datos observados
#' en variables evaluadas no reciben nivel (quedan \\code{NA}).
#'
#' @examples
#' d <- data.frame(
#'   P17_1 = c("1", NA, "2"),
#'   P17_2 = c(NA, "1", NA),
#'   P18 = c("2", "1", "1"),
#'   stringsAsFactors = FALSE
#' )
#'
#' ind_demo <- indicador(
#'   nombre = "acceso_salud",
#'   niveles = list(
#'     nivel("1", "Reciente",
#'       cuando = ~ ind_alguna(ind_es(P17_1, "1"), ind_es(P17_2, "1"))
#'     ),
#'     nivel("2", "No reciente",
#'       cuando = ~ !nivel_1 & ind_es(P18, "1")
#'     ),
#'     nivel("3", "No atendido",
#'       cuando = ~ !nivel_1 & ind_es(P18, "2")
#'     )
#'   )
#' )
#'
#' reporte_indicadores(d, list(ind_demo), prefijo = "")
#'
#' @seealso \\code{\\link{indicador}}, \\code{\\link{nivel}},
#'   \\code{\\link{reporte_dimensiones}},
#'   \\code{\\link{reporte_frecuencias}}, \\code{\\link{reporte_cruces}}
#' @family indicador
#' @export
reporte_indicadores <- function(
    data,
    indicadores,
    instrumento = NULL,
    prefijo     = "ind_",
    verbose     = TRUE
) {
  .ind_validate_data_frame(data, caller = "reporte_indicadores()")

  if (!is.list(indicadores) || !length(indicadores)) {
    stop("`indicadores` debe ser una lista no vacía de objetos `indicador()`.", call. = FALSE)
  }

  for (i in seq_along(indicadores)) {
    if (!inherits(indicadores[[i]], "prosecnur_indicador")) {
      stop(
        sprintf("`indicadores[[%d]]` no es un objeto `indicador()`. Usa indicador() para construirlo.", i),
        call. = FALSE
      )
    }
  }

  instrumento <- .ind_resolve_instrumento(
    data = data,
    instrumento = instrumento,
    caller = "reporte_indicadores()",
    required = FALSE
  )

  prefijo <- as.character(.ind_or(prefijo, "ind_"))[1]
  n_rows  <- nrow(data)
  meta    <- list()

  .msg <- function(...) if (isTRUE(verbose)) message(...)
  .obs <- function(x) .ind_observado(x)

  .fmt_vars <- function(x) {
    x <- unique(as.character(x))
    x <- x[!is.na(x) & nzchar(trimws(x))]
    if (!length(x)) return("(ninguna)")
    paste(x, collapse = ", ")
  }

  .fmt_value <- function(x) {
    txt <- paste(deparse(x, width.cutoff = 500L), collapse = " ")
    txt <- gsub("^c\\((.*)\\)$", "\\1", txt)
    txt
  }

  .strip_quotes <- function(x) {
    x <- as.character(x)
    x <- gsub("^['\"]|['\"]$", "", x)
    trimws(x)
  }

  .choice_label_col <- function(ch) {
    if (is.null(ch) || !is.data.frame(ch)) return(NULL)
    if ("label" %in% names(ch)) return("label")
    cand <- grep("^label(::|$)", names(ch), value = TRUE)
    if (length(cand)) cand[1] else NULL
  }

  .choice_map_cache <- new.env(parent = emptyenv())
  .choice_map_var <- function(var) {
    key <- as.character(var)[1]
    if (exists(key, envir = .choice_map_cache, inherits = FALSE)) {
      return(get(key, envir = .choice_map_cache, inherits = FALSE))
    }

    out <- stats::setNames(character(0), character(0))
    if (!is.null(instrumento) && is.list(instrumento)) {
      surv <- .ind_or(instrumento$survey, NULL)
      ch <- .ind_or(instrumento$choices, NULL)
      if (!is.null(surv) && is.data.frame(surv) &&
          !is.null(ch) && is.data.frame(ch) &&
          all(c("name", "list_name") %in% names(surv)) &&
          all(c("list_name", "name") %in% names(ch))) {
        ln <- get_list_name(key, surv)
        lab_col <- .choice_label_col(ch)
        if (!is.na(ln) && nzchar(ln) && !is.null(lab_col) && lab_col %in% names(ch)) {
          chv <- ch[ch$list_name == ln, , drop = FALSE]
          if (nrow(chv)) {
            out <- stats::setNames(as.character(chv[[lab_col]]), as.character(chv$name))
          }
        }
      }
    }

    assign(key, out, envir = .choice_map_cache)
    out
  }

  .fmt_codes_with_label <- function(var, codes) {
    codes <- .strip_quotes(as.character(codes))
    codes <- codes[!is.na(codes) & nzchar(codes)]
    if (!length(codes)) return("(sin código)")

    map <- .choice_map_var(var)
    out <- vapply(codes, function(cd) {
      lab <- as.character(map[cd])[1]
      if (!is.na(lab) && nzchar(trimws(lab))) paste0(trimws(lab), "(", cd, ")") else cd
    }, character(1))
    paste(out, collapse = ", ")
  }

  group_vars_map_current <- list()
  block_names_current <- character(0)

  .target_name <- function(expr) {
    if (is.name(expr)) return(as.character(expr))
    .strip_quotes(.fmt_value(expr))
  }

  .target_code_var <- function(target_name) {
    if (target_name %in% names(group_vars_map_current)) {
      vars <- group_vars_map_current[[target_name]]
      if (length(vars)) return(vars[1])
    }
    target_name
  }

  .target_display <- function(target_name) {
    if (target_name %in% names(group_vars_map_current)) {
      vars <- group_vars_map_current[[target_name]]
      return(sprintf("grupo `%s` (%s)", target_name, paste(vars, collapse = ", ")))
    }
    sprintf("`%s`", target_name)
  }

  .expr_codes <- function(expr) {
    if (is.atomic(expr)) return(.strip_quotes(as.character(expr)))
    if (is.call(expr) && identical(as.character(expr[[1]]), "c")) {
      vals <- unlist(lapply(as.list(expr)[-1], .expr_codes), use.names = FALSE)
      return(.strip_quotes(vals))
    }
    txt <- .strip_quotes(.fmt_value(expr))
    if (!nzchar(txt)) return(character(0))
    .strip_quotes(strsplit(txt, ",", fixed = TRUE)[[1]])
  }

  .expr_text <- function(expr) {
    if (is.null(expr)) return("condición vacía")

    if (is.name(expr)) {
      nm <- as.character(expr)
      if (grepl("^nivel_", nm)) return(paste0("Cumple el nivel ", sub("^nivel_", "", nm)))
      if (nm %in% block_names_current) return(paste0("bloque ", nm))
      if (nm %in% names(group_vars_map_current)) return(.target_display(nm))
      return(sprintf("`%s`", nm))
    }

    if (is.atomic(expr)) return(.fmt_value(expr))
    if (!is.call(expr)) return(paste(deparse(expr, width.cutoff = 500L), collapse = " "))

    fn <- as.character(expr[[1]])
    args <- as.list(expr)[-1]
    fn_is <- function(x) fn %in% x

    if (identical(fn, "!")) {
      if (is.name(args[[1]])) {
        nm <- as.character(args[[1]])
        if (grepl("^nivel_", nm)) return(paste0("No cumple el nivel ", sub("^nivel_", "", nm)))
      }
      return(paste0("No ", .expr_text(args[[1]])))
    }
    if (identical(fn, "&")) return(paste(.expr_text(args[[1]]), "y", .expr_text(args[[2]])))
    if (identical(fn, "|")) return(paste(.expr_text(args[[1]]), "o", .expr_text(args[[2]])))

    if (fn_is(c("es", "ind_es"))) {
      target <- .target_name(args[[1]])
      code_var <- .target_code_var(target)
      cods <- .expr_codes(args[[2]])
      return(sprintf("%s es %s", .target_display(target), .fmt_codes_with_label(code_var, cods)))
    }

    if (fn_is(c("en", "ind_en"))) {
      target <- .target_name(args[[1]])
      code_var <- .target_code_var(target)
      cods <- .expr_codes(args[[2]])
      return(sprintf("%s está en [%s]", .target_display(target), .fmt_codes_with_label(code_var, cods)))
    }

    if (fn_is(c("alguna", "ind_alguna"))) {
      partes <- vapply(args, .expr_text, character(1))
      return(sprintf("se cumple al menos una condición: %s", paste(partes, collapse = " ; ")))
    }

    if (fn_is(c("todas", "ind_todas"))) {
      partes <- vapply(args, .expr_text, character(1))
      return(sprintf("se cumplen todas las condiciones: %s", paste(partes, collapse = " ; ")))
    }

    if (fn_is(c("ninguna", "ind_ninguna"))) {
      partes <- vapply(args, .expr_text, character(1))
      return(sprintf("no se cumple ninguna condición: %s", paste(partes, collapse = " ; ")))
    }

    if (fn_is(c("alguna_en", "ind_alguna_en"))) {
      nms <- names(args)
      idx_cod <- which(!is.na(nms) & nms == "codigos")
      if (length(idx_cod)) {
        cods <- .expr_codes(args[[idx_cod[1]]])
        vars_args <- args[-idx_cod[1]]
      } else {
        cods <- if (length(args) >= 2L) .expr_codes(args[[2]]) else character(0)
        vars_args <- if (length(args) >= 2L) list(args[[1]]) else args
      }
      vars_target <- if (length(vars_args)) vapply(vars_args, .target_name, character(1)) else character(0)
      vars_txt <- if (length(vars_target)) {
        paste(vapply(vars_target, .target_display, character(1)), collapse = ", ")
      } else {
        "(sin variables)"
      }
      code_var <- if (length(vars_target)) .target_code_var(vars_target[1]) else ""
      cods_txt <- .fmt_codes_with_label(code_var, cods)
      return(sprintf("Al menos una de %s es %s", vars_txt, cods_txt))
    }

    if (fn_is(c("todas_en", "ind_todas_en"))) {
      nms <- names(args)
      idx_cod <- which(!is.na(nms) & nms == "codigos")
      if (length(idx_cod)) {
        cods <- .expr_codes(args[[idx_cod[1]]])
        vars_args <- args[-idx_cod[1]]
      } else {
        cods <- if (length(args) >= 2L) .expr_codes(args[[2]]) else character(0)
        vars_args <- if (length(args) >= 2L) list(args[[1]]) else args
      }
      vars_target <- if (length(vars_args)) vapply(vars_args, .target_name, character(1)) else character(0)
      vars_txt <- if (length(vars_target)) {
        paste(vapply(vars_target, .target_display, character(1)), collapse = ", ")
      } else {
        "(sin variables)"
      }
      code_var <- if (length(vars_target)) .target_code_var(vars_target[1]) else ""
      cods_txt <- .fmt_codes_with_label(code_var, cods)
      return(sprintf("Todas de %s son %s", vars_txt, cods_txt))
    }

    if (fn_is(c("alguna_obs", "ind_alguna_obs"))) {
      vars_txt <- paste(vapply(args, .expr_text, character(1)), collapse = ", ")
      return(sprintf("Al menos una de %s tiene respuesta", vars_txt))
    }

    if (fn_is(c("todas_obs", "ind_todas_obs"))) {
      vars_txt <- paste(vapply(args, .expr_text, character(1)), collapse = ", ")
      return(sprintf("Todas de %s tienen respuesta", vars_txt))
    }

    paste(deparse(expr, width.cutoff = 500L), collapse = " ")
  }

  for (ind in indicadores) {
    modo <- as.character(.ind_or(ind$modo_reglas, ""))[1]
    if (!nzchar(modo)) {
      has_cuando <- vapply(ind$niveles, function(n) !is.null(n$cuando), logical(1))
      has_usa <- vapply(ind$niveles, function(n) !is.null(n$usa), logical(1))
      if (all(has_cuando)) {
        modo <- "cuando"
      } else if (all(has_usa)) {
        modo <- "usa"
      } else {
        stop(
          sprintf("Indicador '%s': no se pudo determinar si usa `cuando` o `usa`.", ind$nombre),
          call. = FALSE
        )
      }
    }

    var_name <- paste0(prefijo, ind$nombre)
    list_name_sintetico <- paste0(ind$nombre, "_list")
    n_niveles <- length(ind$niveles)

    group_vars_map_current <- if (identical(modo, "usa")) lapply(ind$grupos, function(g) g$vars) else list()
    block_names_current <- if (identical(modo, "usa")) names(ind$definidores) else character(0)

    vars_grupos <- unique(unlist(group_vars_map_current, use.names = FALSE))
    if (identical(modo, "usa")) {
      faltantes_grupos <- setdiff(vars_grupos, names(data))
      if (length(faltantes_grupos)) {
        stop(
          sprintf(
            "Indicador '%s': variables de grupos no encontradas en data: %s",
            ind$nombre, paste(faltantes_grupos, collapse = ", ")
          ),
          call. = FALSE
        )
      }
    }

    vars_def_data <- if (identical(modo, "usa")) {
      unique(unlist(lapply(ind$definidores, function(df) {
        refs <- all.vars(df[[2]])
        refs[refs %in% names(data)]
      }), use.names = FALSE))
    } else {
      unique(unlist(lapply(ind$niveles, function(nv) {
        refs <- all.vars(nv$cuando[[2]])
        refs[refs %in% names(data)]
      }), use.names = FALSE))
    }

    vars_eval <- unique(c(vars_grupos, vars_def_data))
    row_any_obs <- if (length(vars_eval)) {
      Reduce(`|`, lapply(vars_eval, function(v) .obs(data[[v]])), init = rep(FALSE, n_rows))
    } else {
      rep(TRUE, n_rows)
    }

    .msg("")
    .msg("========================================")
    .msg(sprintf("Indicador: %s (%s)", ind$etiqueta, ind$nombre))
    .msg(sprintf("Columna destino: %s", var_name))
    .msg(sprintf("Base evaluada: %d fila(s)", n_rows))
    .msg(sprintf("Variables usadas: %s", .fmt_vars(vars_eval)))
    .msg(sprintf("Niveles declarados: %d", n_niveles))
    .msg(sprintf(
      "Solo se asigna nivel cuando hay respuesta: %s",
      if (isTRUE(ind$solo_observados)) "Sí" else "No"
    ))

    eval_base <- as.list(data)

    # API nueva
    eval_base$ind_es <- ind_es
    eval_base$ind_en <- ind_en
    eval_base$ind_alguna <- ind_alguna
    eval_base$ind_todas <- ind_todas
    eval_base$ind_ninguna <- ind_ninguna
    eval_base$ind_alguna_en <- ind_alguna_en
    eval_base$ind_todas_en <- ind_todas_en
    eval_base$ind_alguna_obs <- ind_alguna_obs
    eval_base$ind_todas_obs <- ind_todas_obs
    .alias_retirado <- function(old, nuevo) {
      force(old); force(nuevo)
      function(...) {
        stop(
          sprintf("`%s()` fue retirado. Usa `%s()`.", old, nuevo),
          call. = FALSE
        )
      }
    }
    eval_base$es <- .alias_retirado("es", "ind_es")
    eval_base$en <- .alias_retirado("en", "ind_en")
    eval_base$alguna <- .alias_retirado("alguna", "ind_alguna")
    eval_base$todas <- .alias_retirado("todas", "ind_todas")
    eval_base$ninguna <- .alias_retirado("ninguna", "ind_ninguna")
    eval_base$alguna_en <- .alias_retirado("alguna_en", "ind_alguna_en")
    eval_base$todas_en <- .alias_retirado("todas_en", "ind_todas_en")
    eval_base$alguna_obs <- .alias_retirado("alguna_obs", "ind_alguna_obs")
    eval_base$todas_obs <- .alias_retirado("todas_obs", "ind_todas_obs")

    if (length(group_vars_map_current)) {
      for (gname in names(group_vars_map_current)) {
        eval_base[[gname]] <- .ind_group_from_data(gname, group_vars_map_current[[gname]], data)
      }
    }

    masks_def <- list()
    masks_niveles_raw <- vector("list", n_niveles)
    condiciones_niveles <- rep("", n_niveles)
    condiciones_def <- list()

    if (identical(modo, "usa")) {
      if (is.null(ind$definidores) || !is.list(ind$definidores)) {
        stop(
          sprintf("Indicador '%s': en modo `usa`, `definidores` es obligatorio.", ind$nombre),
          call. = FALSE
        )
      }

      for (k in seq_along(ind$definidores)) {
        dname <- names(ind$definidores)[k]
        dform <- ind$definidores[[k]]

        refs <- all.vars(dform[[2]])
        prev_blocks <- names(masks_def)
        future_blocks <- intersect(refs, setdiff(block_names_current, prev_blocks))
        if (length(future_blocks)) {
          stop(
            sprintf(
              "Indicador '%s', definidor '%s': referencia bloques no definidos previamente: %s",
              ind$nombre, dname, paste(future_blocks, collapse = ", ")
            ),
            call. = FALSE
          )
        }

        unknown_refs <- setdiff(refs, c(names(data), names(group_vars_map_current), block_names_current))
        if (length(unknown_refs)) {
          stop(
            sprintf(
              "Indicador '%s', definidor '%s': referencias no encontradas en data/grupos: %s",
              ind$nombre, dname, paste(unknown_refs, collapse = ", ")
            ),
            call. = FALSE
          )
        }

        eval_ctx <- c(eval_base, masks_def)
        mask <- tryCatch(
          eval(dform[[2]], envir = eval_ctx, enclos = environment(dform)),
          error = function(e) {
            stop(
              sprintf(
                "Indicador '%s', definidor '%s': error al evaluar condición: %s",
                ind$nombre, dname, conditionMessage(e)
              ),
              call. = FALSE
            )
          }
        )

        if (!is.logical(mask) || length(mask) != n_rows) {
          stop(
            sprintf(
              "Indicador '%s', definidor '%s': la condición debe retornar un vector lógico de largo %d.",
              ind$nombre, dname, n_rows
            ),
            call. = FALSE
          )
        }

        mask[is.na(mask)] <- FALSE
        masks_def[[dname]] <- mask
        condiciones_def[[dname]] <- .expr_text(dform[[2]])
      }

      for (j in seq_along(ind$niveles)) {
        niv <- ind$niveles[[j]]
        bname <- niv$usa
        mask_raw <- masks_def[[bname]]
        if (is.null(mask_raw)) {
          stop(
            sprintf(
              "Indicador '%s', nivel '%s': bloque '%s' no existe en `definidores`.",
              ind$nombre, niv$code, bname
            ),
            call. = FALSE
          )
        }
        masks_niveles_raw[[j]] <- mask_raw
        condiciones_niveles[[j]] <- .ind_or(condiciones_def[[bname]], paste0("bloque ", bname))
      }
    } else if (identical(modo, "cuando")) {
      masks_niveles_prev <- list()

      for (k in seq_along(ind$niveles)) {
        niv <- ind$niveles[[k]]
        frm <- niv$cuando

        refs <- all.vars(frm[[2]])
        refs_nivel <- refs[grepl("^nivel_", refs)]
        prev_niv_refs <- names(masks_niveles_prev)
        no_prev <- setdiff(refs_nivel, prev_niv_refs)
        if (length(no_prev)) {
          stop(
            sprintf(
              paste0(
                "Indicador '%s', nivel '%s': referencias a niveles no definidos previamente: %s.\n",
                "Usa solo niveles previos (ej: `nivel_1`)."
              ),
              ind$nombre, niv$code, paste(no_prev, collapse = ", ")
            ),
            call. = FALSE
          )
        }

        unknown_refs <- setdiff(refs, c(names(data), prev_niv_refs))
        if (length(unknown_refs)) {
          stop(
            sprintf(
              "Indicador '%s', nivel '%s': referencias no encontradas en data/niveles previos: %s",
              ind$nombre, niv$code, paste(unknown_refs, collapse = ", ")
            ),
            call. = FALSE
          )
        }

        eval_ctx <- c(eval_base, masks_niveles_prev)
        mask <- tryCatch(
          eval(frm[[2]], envir = eval_ctx, enclos = environment(frm)),
          error = function(e) {
            stop(
              sprintf(
                "Indicador '%s', nivel '%s': error al evaluar condición: %s",
                ind$nombre, niv$code, conditionMessage(e)
              ),
              call. = FALSE
            )
          }
        )

        if (!is.logical(mask) || length(mask) != n_rows) {
          stop(
            sprintf(
              "Indicador '%s', nivel '%s': la condición debe retornar un vector lógico de largo %d.",
              ind$nombre, niv$code, n_rows
            ),
            call. = FALSE
          )
        }

        mask[is.na(mask)] <- FALSE
        ref_name <- .ind_nivel_ref(niv$code)
        masks_niveles_prev[[ref_name]] <- mask
        masks_niveles_raw[[k]] <- mask
        condiciones_niveles[[k]] <- .expr_text(frm[[2]])
      }
    } else {
      stop(sprintf("Indicador '%s': modo de reglas no soportado: %s", ind$nombre, modo), call. = FALSE)
    }

    resultado <- rep(NA_character_, n_rows)
    asignado <- rep(FALSE, n_rows)
    conteos <- c(n_total = n_rows)

    for (j in seq_along(ind$niveles)) {
      niv <- ind$niveles[[j]]
      mask_raw <- masks_niveles_raw[[j]]
      if (is.null(mask_raw)) {
        stop(
          sprintf("Indicador '%s', nivel '%s': no se pudo resolver la condición.", ind$nombre, niv$code),
          call. = FALSE
        )
      }

      if (j > 1L) {
        prev_union <- Reduce(`|`, masks_niveles_raw[seq_len(j - 1L)], init = rep(FALSE, n_rows))
        idx_overlap <- which(mask_raw & prev_union)
        if (length(idx_overlap)) {
          prev_hit <- vapply(seq_len(j - 1L), function(k) any(masks_niveles_raw[[k]][idx_overlap]), logical(1))
          prev_niv <- ind$niveles[seq_len(j - 1L)][prev_hit]
          prev_txt <- if (length(prev_niv)) {
            paste(vapply(prev_niv, function(nn) paste0(nn$label, " (", nn$code, ")"), character(1)), collapse = ", ")
          } else {
            "(no identificado)"
          }
          ejemplos <- paste(head(idx_overlap, 5), collapse = ", ")

          cond_txt <- if (identical(modo, "usa")) {
            paste0("bloque ", niv$usa)
          } else {
            .expr_text(niv$cuando[[2]])
          }

          stop(
            sprintf(
              paste0(
                "Indicador '%s': los niveles deben ser excluyentes.\n",
                "  Conflicto detectado en %d fila(s).\n",
                "  Nivel actual: %s (%s)\n",
                "  Condición actual: %s\n",
                "  También coincide con: %s\n",
                "  Filas ejemplo: %s"
              ),
              ind$nombre, length(idx_overlap), niv$label, niv$code, cond_txt, prev_txt, ejemplos
            ),
            call. = FALSE
          )
        }
      }

      mask <- if (isTRUE(ind$solo_observados)) mask_raw & row_any_obs else mask_raw
      eligible <- mask & !asignado

      resultado[eligible] <- niv$code
      asignado[eligible] <- TRUE

      n_cumplen <- sum(mask)
      n_asign <- sum(eligible)
      conteos[paste0("n_", niv$code)] <- n_asign

      .msg(sprintf("  Nivel %d de %d: %s (%s)", j, n_niveles, niv$label, niv$code))
      .msg(sprintf("    Condición: %s", condiciones_niveles[[j]]))
      .msg(sprintf("    Resultado: cumplen = %d | asignadas = %d", n_cumplen, n_asign))
    }

    conteos["n_sin_nivel"] <- sum(!asignado)
    .msg(sprintf("  Resumen: %d de %d fila(s) con nivel.", sum(asignado), n_rows))

    if (conteos["n_sin_nivel"] > 0L) {
      n_sin_datos <- sum(!asignado & !row_any_obs)
      n_con_datos_sin_regla <- sum(!asignado & row_any_obs)
      ejemplos <- which(!asignado & row_any_obs)
      ejemplos <- head(ejemplos, 5)
      .msg(sprintf("  No se asignó nivel a %d fila(s).", conteos["n_sin_nivel"]))
      .msg(sprintf("  - Sin respuesta en variables evaluadas: %d", n_sin_datos))
      .msg(sprintf("  - Con respuesta pero sin cumplir reglas: %d", n_con_datos_sin_regla))
      if (length(ejemplos)) {
        .msg(sprintf("  - Filas ejemplo (con respuesta y sin nivel): %s", paste(ejemplos, collapse = ", ")))
      }
    } else {
      .msg("  Todas las filas evaluadas recibieron un nivel.")
    }

    codes  <- vapply(ind$niveles, function(n) n$code, character(1))
    labels <- vapply(ind$niveles, function(n) n$label, character(1))
    labs_attr <- stats::setNames(labels, codes)

    data[[var_name]] <- resultado
    attr(data[[var_name]], "label")   <- ind$etiqueta
    attr(data[[var_name]], "labels")  <- labs_attr
    attr(data[[var_name]], "measure") <- tolower(ind$measure)

    if (!is.null(instrumento) && is.list(instrumento)) {
      if (is.data.frame(instrumento$survey)) {
        new_survey_row <- data.frame(
          name      = var_name,
          type      = paste0("select_one ", list_name_sintetico),
          list_name = list_name_sintetico,
          label     = ind$etiqueta,
          stringsAsFactors = FALSE
        )

        for (col in setdiff(names(instrumento$survey), names(new_survey_row))) {
          new_survey_row[[col]] <- NA
        }
        new_survey_row <- new_survey_row[, names(instrumento$survey), drop = FALSE]
        instrumento$survey <- rbind(instrumento$survey, new_survey_row)
      }

      if (is.list(instrumento$orders_list)) {
        instrumento$orders_list[[var_name]] <- list(
          names  = codes,
          labels = labels,
          label  = ind$etiqueta
        )
      }

      if (is.list(instrumento$dicc_code_to_label)) {
        instrumento$dicc_code_to_label[[list_name_sintetico]] <- labs_attr
      }

      if (is.list(instrumento$dicc_label_to_code)) {
        instrumento$dicc_label_to_code[[list_name_sintetico]] <- stats::setNames(codes, labels)
      }

      if (!is.null(instrumento$var_labels)) {
        instrumento$var_labels[var_name] <- ind$etiqueta
      }

      if (is.data.frame(instrumento$choices)) {
        new_choices_rows <- data.frame(
          list_name = list_name_sintetico,
          name      = codes,
          label     = labels,
          stringsAsFactors = FALSE
        )
        for (col in setdiff(names(instrumento$choices), names(new_choices_rows))) {
          new_choices_rows[[col]] <- NA
        }
        new_choices_rows <- new_choices_rows[, names(instrumento$choices), drop = FALSE]
        instrumento$choices <- rbind(instrumento$choices, new_choices_rows)
      }

      if (is.data.frame(instrumento$measure_rules)) {
        new_mr_row <- data.frame(
          name             = var_name,
          type             = paste0("select_one ", list_name_sintetico),
          list_name        = list_name_sintetico,
          measure_sugerida = tolower(ind$measure),
          stringsAsFactors = FALSE
        )
        for (col in setdiff(names(instrumento$measure_rules), names(new_mr_row))) {
          new_mr_row[[col]] <- NA
        }
        new_mr_row <- new_mr_row[, names(instrumento$measure_rules), drop = FALSE]
        instrumento$measure_rules <- rbind(instrumento$measure_rules, new_mr_row)
      }
    }

    definidores_texto <- if (identical(modo, "usa") && length(ind$definidores)) {
      stats::setNames(vapply(ind$definidores, function(df) {
        paste(deparse(df[[2]], width.cutoff = 500L), collapse = " ")
      }, character(1)), names(ind$definidores))
    } else {
      stats::setNames(character(0), character(0))
    }

    meta[[ind$nombre]] <- list(
      nombre          = ind$nombre,
      etiqueta        = ind$etiqueta,
      variable        = var_name,
      measure         = ind$measure,
      modo_reglas     = modo,
      solo_observados = ind$solo_observados,
      grupos          = if (length(ind$grupos)) lapply(ind$grupos, function(g) g$vars) else list(),
      definidores     = definidores_texto,
      niveles         = lapply(ind$niveles, function(niv) {
        list(
          code = niv$code,
          label = niv$label,
          usa = .ind_or(niv$usa, NA_character_),
          cuando = if (!is.null(niv$cuando)) paste(deparse(niv$cuando[[2]], width.cutoff = 500L), collapse = " ") else NA_character_
        )
      }),
      conteos         = conteos
    )
  }

  if (!is.null(instrumento)) {
    attr(data, "instrumento_reporte") <- instrumento
  }

  existing_meta <- .ind_or(attr(data, "indicadores_meta", exact = TRUE), list())
  attr(data, "indicadores_meta") <- c(existing_meta, meta)

  data
}
