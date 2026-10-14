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

# Reescribe la lógica que cita los códigos de `var` (checklist ítem 12). Formas
# reconocidas, con comillas simples o dobles:
#
#   ${var} = 'x'   ${var} != 'x'   'x' = ${var}   'x' != ${var}
#   selected(${var}, 'x')
#
# y, sin depender del código (se dejan tal cual): `count-selected(${var})`,
# `string-length(${var})` y las comparaciones con la cadena vacía.
#
# `propia = TRUE` cuando la expresión es el constraint o el relevant de la
# fila de `var`: ahí `.` es la propia variable y valen las mismas formas con
# `.` (`selected(., 'x')`, `. = 'x'`, `count-selected(.)`…).
#
# Devuelve NULL si queda alguna referencia a la variable en una forma que no
# es ninguna de esas (p. ej. `${var} > 2`, `${var} = 1` sin comillas, un
# `choice_filter` que la compara con otra columna): nunca reescribe a ciegas.
.carga_sm_orden_reescribir_expr <- function(expr, var, recode, propia = FALSE) {
  if (is.na(expr) || !nzchar(expr)) return(expr)
  v <- gsub("([.\\\\|()\\[\\]{}^$*+?])", "\\\\\\1", var, perl = TRUE)
  ref_var <- paste0("\\$\\{", v, "\\}")
  # `.` suelto: ni decimal, ni `..`, ni ruta, ni dentro de un literal pegado.
  ref_punto <- "(?<![\\w.}/'\"$])\\.(?![\\w./'\"])"
  ref <- if (isTRUE(propia)) paste0("(?:", ref_var, "|", ref_punto, ")") else ref_var
  hay_ref <- function(x) grepl(ref, x, perl = TRUE)
  if (!hay_ref(expr)) return(expr)

  lit <- "('[^']*'|\"[^\"]*\")"
  # Conserva la comilla del literal; solo cambia el código de adentro.
  recodificar <- function(literal) {
    comilla <- substr(literal, 1L, 1L)
    viejo <- substr(literal, 2L, nchar(literal) - 1L)
    nuevo <- if (viejo %in% names(recode)) recode[[viejo]] else viejo
    paste0(comilla, nuevo, comilla)
  }
  # Cada forma reconocida se aparta en un marcador para que la siguiente no la
  # vuelva a leer y para contar después si quedó alguna referencia suelta.
  apartados <- character(0)
  apartar <- function(x, pat, construir) {
    m <- gregexpr(pat, x, perl = TRUE)
    if (m[[1]][1] == -1L) return(x)
    trozos <- regmatches(x, m)[[1]]
    marcas <- vapply(trozos, function(trozo) {
      partes <- regmatches(trozo, regexec(pat, trozo, perl = TRUE))[[1]]
      apartados[[length(apartados) + 1L]] <<- construir(partes)
      paste0("\001", length(apartados), "\001")
    }, character(1), USE.NAMES = FALSE)
    regmatches(x, m) <- list(marcas)
    x
  }
  sel <- paste0("(selected\\(\\s*", ref, "\\s*,\\s*)", lit, "(\\s*\\))")
  cmp <- paste0("(", ref, "\\s*!?=\\s*)", lit)
  inv <- paste0(lit, "(\\s*!?=\\s*", ref, ")")
  neutra <- paste0("(?:count-selected|string-length)\\(\\s*", ref, "\\s*\\)")

  x <- apartar(expr, neutra, function(p) p[1])
  x <- apartar(x, sel, function(p) paste0(p[2], recodificar(p[3]), p[4]))
  x <- apartar(x, cmp, function(p) paste0(p[2], recodificar(p[3])))
  x <- apartar(x, inv, function(p) paste0(recodificar(p[2]), p[3]))
  if (hay_ref(x)) return(NULL)
  for (i in rev(seq_along(apartados))) {
    x <- gsub(paste0("\001", i, "\001"), apartados[[i]], x, fixed = TRUE)
  }
  x
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
    nombres <- as.character(nuevo_survey$name)
    for (cc in expr_cols) {
      col <- as.character(nuevo_survey[[cc]])
      # `.` es la propia variable solo en su constraint o su relevant.
      admite_punto <- cc %in% c("constraint", "relevant")
      for (v in usan) {
        col <- vapply(seq_along(col), function(i) {
          e <- col[[i]]
          propia <- admite_punto && identical(nombres[[i]], v)
          out <- .carga_sm_orden_reescribir_expr(e, v, entrada$recode, propia = propia)
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

# --- Receta: el orden se fija al importar (ADR 0099, decisión 7) -------------
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

# --- Receta implícita: sin receta, manda el instrumento guardado --------------
#
# ADR 0099, decisión 7. Una base sin receta del editor tiene igual sus códigos:
# los del instrumento con que se importó (`original_xlsform_file_id`). El
# traductor puede cambiar cómo codifica SurveyMonkey (H3: el peso de la opción
# pasó a ser el código, «SIN INF» peso 99 -> 99, antes 4 por posición), y el
# refresh suma filas nuevas a las viejas sin recodificarlas: si el instrumento
# regenerado no conserva los códigos guardados, la misma etiqueta queda con dos
# códigos en la base (o dos etiquetas cambian de código entre sí).
#
# Por cada variable de opción, el código de toda etiqueta que ya estaba en el
# instrumento guardado sale de ahí; una opción nueva de SurveyMonkey entra con
# su código si está libre, o con el siguiente libre. Si una etiqueta guardada
# ya no existe en la encuesta (renombrada o quitada) no se adivina: la variable
# queda en `no_calzan` y el refresh se bloquea con la causa.

# Opciones de `var` en un modelo: data.frame code / label / norm.
.carga_sm_orden_opciones <- function(model, var) {
  vacio <- data.frame(code = character(0), label = character(0), norm = character(0), stringsAsFactors = FALSE)
  survey <- model$survey
  choices <- model$choices
  if (is.null(survey) || is.null(choices)) return(vacio)
  lab_col <- .carga_sm_orden_label_col(choices)
  if (is.na(lab_col)) return(vacio)
  fila <- which(as.character(survey$name) == var)
  if (!length(fila)) return(vacio)
  tipo <- trimws(as.character(survey$type[fila[1]]))
  if (!grepl("^select_(one|multiple)\\s+", tipo)) return(vacio)
  ln <- trimws(sub("^select_(one|multiple)\\s+", "", tipo))
  idx <- which(as.character(choices$list_name) == ln)
  lab <- as.character(choices[[lab_col]][idx])
  lab[is.na(lab)] <- ""
  data.frame(code = as.character(choices$name[idx]), label = lab, norm = .sm_mb_norm(lab), stringsAsFactors = FALSE)
}

.carga_sm_orden_lista_de <- function(survey, var) {
  fila <- which(as.character(survey$name) == var)
  if (!length(fila)) return("")
  trimws(sub("^select_(one|multiple)\\s+", "", trimws(as.character(survey$type[fila[1]]))))
}

# Instrumento leído (`reporte_instrumento`) o modelo -> modelo survey/choices.
.carga_sm_orden_modelo_de_instrumento <- function(inst) {
  if (is.null(inst)) return(NULL)
  survey <- as.data.frame(inst$survey %||% data.frame(), stringsAsFactors = FALSE)
  choices <- as.data.frame(inst$choices %||% data.frame(), stringsAsFactors = FALSE)
  if (!all(c("type", "name") %in% names(survey)) || !all(c("list_name", "name") %in% names(choices))) return(NULL)
  lab_col <- as.character(inst$label_col_choices %||% "")[1]
  if (is.na(lab_col) || !nzchar(lab_col) || !lab_col %in% names(choices)) lab_col <- .carga_sm_orden_label_col(choices)
  if (is.na(lab_col)) return(NULL)
  # `reporte_instrumento` separa el tipo base (`select_one`) de `list_name`.
  tipo <- trimws(as.character(survey$type))
  if ("list_name" %in% names(survey)) {
    ln <- trimws(as.character(survey$list_name))
    pegar <- grepl("^select_(one|multiple)$", tipo) & !is.na(ln) & nzchar(ln)
    tipo[pegar] <- paste(tipo[pegar], ln[pegar])
  }
  list(
    survey = data.frame(type = tipo, name = as.character(survey$name), stringsAsFactors = FALSE),
    choices = data.frame(list_name = as.character(choices$list_name), name = as.character(choices$name),
                         `label::es` = as.character(choices[[lab_col]]), check.names = FALSE, stringsAsFactors = FALSE)
  )
}

# Empareja opciones guardadas con generadas, de la clave más estricta a la más
# laxa: etiqueta literal, `.sm_mb_norm` y, por último, sin ningún espacio
# (bases importadas antes de b374804bc guardan «Muy de acuer do», partida por
# el HTML en línea, y hoy se genera «Muy de acuerdo»). En cada nivel solo se
# aceptan pares 1 a 1 entre lo que queda sin emparejar. Devuelve, por opción
# guardada, el índice de la generada (NA si no hay una equivalente inequívoca).
.carga_sm_orden_emparejar <- function(sav_lab, gen_lab) {
  m <- rep(NA_integer_, length(sav_lab))
  claves <- list(
    function(x) trimws(x),
    function(x) .sm_mb_norm(x),
    function(x) gsub(" ", "", .sm_mb_norm(x), fixed = TRUE)
  )
  for (clave in claves) {
    libres_s <- which(is.na(m))
    libres_g <- setdiff(seq_along(gen_lab), m[!is.na(m)])
    if (!length(libres_s) || !length(libres_g)) break
    ks <- clave(sav_lab[libres_s])
    kg <- clave(gen_lab[libres_g])
    for (j in seq_along(libres_s)) {
      k <- ks[j]
      if (is.na(k) || !nzchar(k) || sum(ks == k, na.rm = TRUE) != 1L) next
      hit <- which(kg == k)
      if (length(hit) == 1L) m[libres_s[j]] <- libres_g[hit]
    }
  }
  m
}

# Código para una opción nueva que choca: el siguiente libre tras el mayor
# código sustantivo (< 90, fuera de los especiales 96-99), sin pisar uno usado.
# Mismo criterio que `.sm_api_codigo_libre`.
.carga_sm_orden_codigo_libre <- function(usados) {
  num <- suppressWarnings(as.integer(usados))
  num <- num[!is.na(num)]
  siguiente <- max(c(num[num < 90L], 0L)) + 1L
  while (as.character(siguiente) %in% usados) siguiente <- siguiente + 1L
  as.character(siguiente)
}

# Mapa (formato del editor) que lleva `gen` a los códigos de `sav`, NULL si la
# lista no cambia, o el motivo si una opción guardada no tiene equivalente.
.carga_sm_orden_mapa_implicito <- function(var, ln, gen, sav) {
  # Lista idéntica (mismos códigos con las mismas etiquetas literales): nada
  # que conservar, aunque sus etiquetas normalizadas se repitan.
  par <- function(d) paste(d$code, trimws(d$label), sep = "\r")
  if (nrow(gen) == nrow(sav) && setequal(par(gen), par(sav)) && !anyDuplicated(par(sav))) {
    return(list(map = NULL))
  }
  m <- .carga_sm_orden_emparejar(sav$label, gen$label)
  if (anyNA(m)) {
    return(list(
      motivo = "la encuesta actual no trae una opción equivalente a opciones que la base tiene guardadas",
      etiquetas = sav$label[is.na(m)]
    ))
  }
  codigo <- rep(NA_character_, nrow(gen))
  codigo[m] <- sav$code
  usados <- sav$code
  for (i in which(is.na(codigo))) {
    codigo[i] <- if (!gen$code[i] %in% usados) gen$code[i] else .carga_sm_orden_codigo_libre(usados)
    usados <- c(usados, codigo[i])
  }
  list(map = list(
    variable = var,
    list_name = ln,
    mappings = lapply(seq_len(nrow(gen)), function(i) list(
      xls_code = codigo[i], xls_label = gen$label[i], source_label = gen$label[i]
    ))
  ))
}

# model: XLSForm regenerado (ya con la receta explícita). inst_guardado: el
# instrumento guardado de la base. excluir: variables que fijó la receta.
.carga_sm_orden_conservar_guardado <- function(model, inst_guardado, excluir = character(0)) {
  resumen <- list(conservadas = list(), no_calzan = list())
  guardado <- .carga_sm_orden_modelo_de_instrumento(inst_guardado)
  survey <- model$survey
  if (is.null(guardado) || is.null(survey) || is.null(model$choices)) return(list(model = model, resumen = resumen))
  tipos <- trimws(as.character(survey$type))
  vars <- as.character(survey$name)[grepl("^select_(one|multiple)\\s+", tipos)]
  listas_receta <- vapply(excluir, function(v) .carga_sm_orden_lista_de(survey, v), character(1))
  no_calza <- function(var, motivo, etiquetas = character(0)) {
    resumen$no_calzan[[length(resumen$no_calzan) + 1L]] <<- list(
      variable = var, motivo = motivo, etiquetas = as.list(etiquetas)
    )
  }
  mapas <- list()
  distintas <- character(0)
  for (v in setdiff(vars, excluir)) {
    ln <- .carga_sm_orden_lista_de(survey, v)
    if (ln %in% listas_receta) next
    gen <- .carga_sm_orden_opciones(model, v)
    sav <- .carga_sm_orden_opciones(guardado, v)
    if (!nrow(gen) || !nrow(sav)) next
    r <- .carga_sm_orden_mapa_implicito(v, ln, gen, sav)
    if (!is.null(r$motivo)) { no_calza(v, r$motivo, r$etiquetas %||% character(0)); next }
    # Sin cambios: mapa identidad, que solo se usa si comparte lista con otra
    # variable que sí cambia.
    mapas[[v]] <- r$map %||% list(variable = v, list_name = ln, mappings = lapply(seq_len(nrow(gen)), function(i) list(
      xls_code = gen$code[i], xls_label = gen$label[i], source_label = gen$label[i]
    )))
    nuevos <- vapply(mapas[[v]]$mappings, function(m) m$xls_code, character(1))
    if (!identical(nuevos, gen$code)) distintas <- c(distintas, v)
  }
  # Solo se tocan las listas que cambian; una lista compartida entra entera,
  # con todas sus variables, para que la adopción detecte un conflicto.
  listas <- unique(vapply(distintas, function(v) .carga_sm_orden_lista_de(survey, v), character(1)))
  aplicar <- Filter(function(m) m$list_name %in% listas, mapas)
  if (!length(aplicar)) return(list(model = model, resumen = resumen))
  res <- .carga_sm_adoptar_orden_editor(model, unname(aplicar))
  for (o in res$resumen$omitidas %||% list()) {
    no_calza(o$variable, paste("no se pudieron conservar sus códigos:", o$motivo))
  }
  resumen$conservadas <- as.list(intersect(distintas, as.character(unlist(res$resumen$adoptadas %||% list()))))
  list(model = res$model, resumen = resumen)
}

# Instrumento guardado de una base (el original, contra el que está su data).
.carga_sm_orden_instrumento_guardado <- function(sid, base) {
  fid <- .sm_mb_scalar((base %||% list())$original_xlsform_file_id %||% base$xlsform_file_id, "")
  if (!nzchar(fid)) return(NULL)
  tryCatch(reporte_instrumento(path = get_file(sid, fid)$path), error = function(e) NULL)
}

# Refresh: receta explícita primero (manda), receta implícita después.
.carga_sm_orden_reaplicar_y_conservar <- function(sid, base_name, model, editor_maps = NULL) {
  base <- session_get(sid)$estudio$bases[[base_name]]
  res <- .carga_sm_orden_reaplicar(model, base$choice_order_editor, editor_maps)
  receta_vars <- vapply(res$resumen$receta %||% list(), function(r) as.character(r$variable %||% "")[1], character(1))
  guard <- .carga_sm_orden_conservar_guardado(
    res$model,
    .carga_sm_orden_instrumento_guardado(sid, base),
    excluir = receta_vars[!is.na(receta_vars) & nzchar(receta_vars)]
  )
  list(model = guard$model, resumen = res$resumen, codigos_guardados = guard$resumen)
}
