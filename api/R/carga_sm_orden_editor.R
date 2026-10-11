# Orden de opciones del editor en el import SurveyMonkey por API
# (checklist 2026-10-11, H2/H3).
#
# El import por API codifica cada respuesta POR ETIQUETA contra el instrumento
# que registra (`.sm_mb_code_for_label`). Los mapas de códigos del editor
# nacieron para el .sav, donde SM exporta códigos por posición; aplicados
# DESPUÉS sobre datos ya codificados por etiqueta, desalineaban código y
# etiqueta (quien respondió «Nunca» quedaba con el código que el instrumento
# de la base rotula «A veces») y no alcanzaban a las select_multiple.
#
# Aquí el reordenamiento se lleva al INSTRUMENTO antes de codificar: la lista
# del XLSForm generado adopta los códigos y el orden del editor, emparejando
# por etiqueta, y la lógica generada que cita esos códigos se reescribe. Los
# datos salen ya en los códigos del editor y nada vuelve a recodificarlos.
# Una lista que no calza entera por etiquetas, o cuya lógica no se puede
# reescribir con certeza, no se toca y queda declarada en `omitidas`.

.carga_sm_orden_label_col <- function(df) {
  cols <- names(df)
  hit <- c(cols[cols == "label::es"], cols[startsWith(cols, "label")])
  if (length(hit)) hit[1] else NA_character_
}

# Valida un mapa contra la lista generada; devuelve el recode old→new o el motivo.
.carga_sm_orden_recode <- function(map, survey, choices, lab_col) {
  var <- as.character(map$variable %||% "")[1]
  fila <- which(as.character(survey$name) == var)
  if (!length(fila)) return(list(motivo = "la variable no existe en el formulario de la encuesta"))
  tipo <- as.character(survey$type[fila[1]])
  if (!grepl("^select_(one|multiple)\\s+", tipo)) return(list(motivo = "la variable no es de opción"))
  ln <- trimws(sub("^select_(one|multiple)\\s+", "", tipo))
  idx <- which(as.character(choices$list_name) == ln)
  if (!length(idx)) return(list(motivo = "la lista de opciones no existe"))
  gen_lab <- .sm_mb_norm(as.character(choices[[lab_col]][idx]))
  gen_code <- as.character(choices$name[idx])
  items <- map$mappings %||% list()
  if (!length(items)) return(list(motivo = "el mapa no trae opciones"))
  recode <- character(0)
  for (it in items) {
    nuevo <- trimws(as.character(it$xls_code %||% "")[1])
    labs <- unique(.sm_mb_norm(c(as.character(it$xls_label %||% ""), as.character(it$source_label %||% ""))))
    labs <- labs[!is.na(labs) & nzchar(labs)]
    hit <- which(gen_lab %in% labs)
    if (!nzchar(nuevo) || length(hit) != 1L) {
      return(list(motivo = "las etiquetas del mapa no calzan con las opciones de la encuesta"))
    }
    recode[[gen_code[hit]]] <- nuevo
  }
  if (length(recode) != length(gen_code) || anyDuplicated(unname(recode)) || !setequal(names(recode), gen_code)) {
    return(list(motivo = "el mapa no cubre todas las opciones con códigos distintos"))
  }
  list(var = var, list_name = ln, recode = recode)
}

# Reescribe `${var} = 'x'`, `${var} != 'x'` y `selected(${var}, 'x')`. Devuelve
# NULL si queda alguna referencia a ${var} que no sea de esas formas.
.carga_sm_orden_reescribir_expr <- function(expr, var, recode) {
  if (is.na(expr) || !nzchar(expr)) return(expr)
  ref <- paste0("${", var, "}")
  if (!grepl(ref, expr, fixed = TRUE)) return(expr)
  v <- gsub("([.\\\\|()\\[\\]{}^$*+?])", "\\\\\\1", var, perl = TRUE)
  pat_cmp <- paste0("(\\$\\{", v, "\\}\\s*!?=\\s*)'([^']*)'")
  pat_sel <- paste0("(selected\\(\\s*\\$\\{", v, "\\}\\s*,\\s*)'([^']*)'(\\s*\\))")
  n_refs <- lengths(regmatches(expr, gregexpr(paste0("\\$\\{", v, "\\}"), expr)))
  n_ok <- lengths(regmatches(expr, gregexpr(pat_cmp, expr, perl = TRUE))) +
    lengths(regmatches(expr, gregexpr(pat_sel, expr, perl = TRUE)))
  if (n_refs != n_ok) return(NULL)
  sustituir <- function(x, pat, grupo) {
    m <- gregexpr(pat, x, perl = TRUE)
    regmatches(x, m) <- list(vapply(regmatches(x, m)[[1]], function(trozo) {
      partes <- regmatches(trozo, regexec(pat, trozo, perl = TRUE))[[1]]
      viejo <- partes[grupo + 1L]
      nuevo <- if (viejo %in% names(recode)) recode[[viejo]] else viejo
      if (grupo == 2L && length(partes) == 3L) paste0(partes[2], "'", nuevo, "'")
      else paste0(partes[2], "'", nuevo, "'", partes[4])
    }, character(1)))
    x
  }
  expr <- sustituir(expr, pat_cmp, 2L)
  sustituir(expr, pat_sel, 2L)
}

# model: salida de `sm_api_xlsform`. maps: mapas del formulario del editor de
# la MISMA encuesta (`.carga_platform_choice_code_maps`). Devuelve el modelo
# con las listas adoptadas y un resumen para la metadata de la base.
.carga_sm_adoptar_orden_editor <- function(model, maps) {
  resumen <- list(adoptadas = list(), omitidas = list())
  if (!length(maps)) return(list(model = model, resumen = resumen))
  survey <- model$survey
  choices <- model$choices
  lab_col <- .carga_sm_orden_label_col(choices)
  if (is.null(survey) || is.null(choices) || is.na(lab_col)) return(list(model = model, resumen = resumen))
  expr_cols <- intersect(c("relevant", "constraint", "calculation", "choice_filter", "required"), names(survey))
  por_lista <- list()
  omitir <- function(var, motivo) resumen$omitidas[[length(resumen$omitidas) + 1L]] <<- list(variable = var, motivo = motivo)

  for (map in maps) {
    var <- as.character(map$variable %||% "")[1]
    r <- .carga_sm_orden_recode(map, survey, choices, lab_col)
    if (!is.null(r$motivo)) { omitir(var, r$motivo); next }
    previo <- por_lista[[r$list_name]]
    if (is.null(previo)) {
      por_lista[[r$list_name]] <- list(recode = r$recode, vars = var, conflicto = FALSE)
      next
    }
    por_lista[[r$list_name]]$vars <- c(previo$vars, var)
    if (!identical(previo$recode[order(names(previo$recode))], r$recode[order(names(r$recode))])) {
      por_lista[[r$list_name]]$conflicto <- TRUE
    }
  }

  for (ln in names(por_lista)) {
    entrada <- por_lista[[ln]]
    if (isTRUE(entrada$conflicto)) {
      for (v in entrada$vars) omitir(v, "otra pregunta de la misma lista pide un orden distinto")
      next
    }
    # Todas las variables que usan la lista cambian de código: su lógica también.
    usan <- as.character(survey$name)[grepl(paste0("^select_(one|multiple)\\s+", ln, "$"), trimws(as.character(survey$type)))]
    nuevo_survey <- survey
    ok <- TRUE
    for (cc in expr_cols) {
      col <- as.character(nuevo_survey[[cc]])
      for (v in usan) {
        col <- vapply(col, function(e) {
          out <- .carga_sm_orden_reescribir_expr(e, v, entrada$recode)
          if (is.null(out)) { ok <<- FALSE; return(e) }
          out
        }, character(1), USE.NAMES = FALSE)
      }
      nuevo_survey[[cc]] <- col
    }
    if (!ok) {
      for (v in entrada$vars) omitir(v, "la lógica del formulario usa sus códigos de una forma que no se puede reescribir")
      next
    }
    survey <- nuevo_survey
    idx <- which(as.character(choices$list_name) == ln)
    bloque <- choices[idx, , drop = FALSE]
    bloque$name <- unname(entrada$recode[as.character(bloque$name)])
    num <- suppressWarnings(as.numeric(bloque$name))
    bloque <- bloque[if (all(!is.na(num))) order(num) else order(bloque$name), , drop = FALSE]
    choices[idx, ] <- bloque
    for (v in entrada$vars) resumen$adoptadas[[length(resumen$adoptadas) + 1L]] <- v
  }

  model$survey <- survey
  model$choices <- choices
  list(model = model, resumen = resumen)
}

# --- Receta: el orden se fija al importar (ADR 0094, decisión 7) -------------
#
# Lo que una base adoptó del editor al importarse se guarda como receta en
# `choice_order_editor$receta`: por cada lista adoptada, la variable, su
# list_name y la correspondencia etiqueta normalizada -> código. El refresh
# reaplica ESA receta contra el XLSForm recién generado (por etiqueta) y no
# vuelve a leer los mapas del editor: un cambio posterior en el editor no
# recodifica una base que ya tiene datos. Si el editor hoy pide otro orden, se
# declara en `editor_distinto` para que Revisión avise.

# Códigos de una variable en el modelo: etiqueta normalizada -> código.
.carga_sm_orden_codigos <- function(model, var) {
  survey <- model$survey
  choices <- model$choices
  lab_col <- .carga_sm_orden_label_col(choices %||% data.frame())
  if (is.null(survey) || is.null(choices) || is.na(lab_col)) return(character(0))
  fila <- which(as.character(survey$name) == var)
  if (!length(fila)) return(character(0))
  tipo <- as.character(survey$type[fila[1]])
  if (!grepl("^select_(one|multiple)\\s+", tipo)) return(character(0))
  ln <- trimws(sub("^select_(one|multiple)\\s+", "", tipo))
  idx <- which(as.character(choices$list_name) == ln)
  stats::setNames(as.character(choices$name[idx]), .sm_mb_norm(as.character(choices[[lab_col]][idx])))
}

.carga_sm_orden_receta <- function(model, vars) {
  survey <- model$survey
  unname(lapply(unique(as.character(vars)), function(v) {
    fila <- which(as.character(survey$name) == v)[1]
    ln <- if (is.na(fila)) "" else trimws(sub("^select_(one|multiple)\\s+", "", as.character(survey$type[fila])))
    codigos <- .carga_sm_orden_codigos(model, v)
    list(
      variable = v,
      list_name = ln,
      opciones = unname(lapply(seq_along(codigos), function(i) list(etiqueta = names(codigos)[i], codigo = unname(codigos[i]))))
    )
  }))
}

# Adopta mapas y deja en el resumen la receta de lo adoptado.
.carga_sm_adoptar_y_recetar <- function(model, maps) {
  res <- .carga_sm_adoptar_orden_editor(model, maps)
  adoptadas <- as.character(unlist(res$resumen$adoptadas %||% list(), use.names = FALSE))
  res$resumen$receta <- .carga_sm_orden_receta(res$model, adoptadas)
  res
}

# La receta guardada como mapas que `.carga_sm_adoptar_orden_editor` entiende.
.carga_sm_receta_mapas <- function(receta) {
  lapply(receta %||% list(), function(r) list(
    variable = as.character(r$variable %||% "")[1],
    list_name = as.character(r$list_name %||% "")[1],
    mappings = lapply(r$opciones %||% list(), function(o) list(
      xls_code = as.character(o$codigo %||% "")[1],
      xls_label = as.character(o$etiqueta %||% "")[1],
      source_label = as.character(o$etiqueta %||% "")[1]
    ))
  ))
}

# Refresh: reaplica la receta guardada en la base; nunca la del editor de hoy.
# Sin receta no adopta nada (los códigos quedan los de la plataforma).
.carga_sm_orden_reaplicar <- function(model, orden_guardado, editor_maps = NULL) {
  receta <- (orden_guardado %||% list())$receta %||% list()
  res <- if (length(receta)) {
    .carga_sm_adoptar_orden_editor(model, .carga_sm_receta_mapas(receta))
  } else {
    list(model = model, resumen = list(adoptadas = list(), omitidas = list()))
  }
  res$resumen$receta <- receta
  distintas <- character(0)
  if (length(editor_maps)) {
    con_editor <- .carga_sm_adoptar_orden_editor(model, editor_maps)$model
    vars <- unique(c(
      vapply(editor_maps, function(m) as.character(m$variable %||% "")[1], character(1)),
      vapply(receta, function(r) as.character(r$variable %||% "")[1], character(1))
    ))
    vars <- vars[!is.na(vars) & nzchar(vars)]
    for (v in vars) {
      actual <- .carga_sm_orden_codigos(res$model, v)
      pedido <- .carga_sm_orden_codigos(con_editor, v)
      if (!identical(actual[order(names(actual))], pedido[order(names(pedido))])) {
        distintas <- c(distintas, v)
      }
    }
  }
  if (length(distintas)) {
    res$resumen$editor_distinto <- TRUE
    res$resumen$editor_distinto_variables <- as.list(distintas)
  }
  res
}
