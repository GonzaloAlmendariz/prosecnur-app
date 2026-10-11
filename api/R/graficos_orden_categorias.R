# =============================================================================
# graficos_orden_categorias.R — orden de categorías por gráfico (D8; contrato docs/qa/contrato-orden-categorias-f6-2026-10-10.md)
# =============================================================================
#
# Gonzalo (D8): «ambas opciones deben ser posibles e incluso debe permitir orden personalizado». Cada gráfico de
# categorías nominales lleva `args.orden_categorias = {modo, lista, invertir}`. El modo por defecto es `recetario`: lo que
# dibuja el recetario para ese dato (ordinal y dicotomía en orden del instrumento, nominal de más de dos y opción múltiple
# por frecuencia, residuales al final).
#
# El motor lo resuelve ANTES de dibujar (`.plan_orden_categorias`, enganchado en `reporte_ppt_plan` junto a la partición)
# y lo traduce a los argumentos que el graficador ya entiende (`orden_barras`/`ordenar_categorias` y
# `orden_categorias_manual`). El graficador arma una sola espec y de ella leen la lámina nativa, la ruta anterior y el
# Word: el orden es el mismo en los tres. La `lista` de `personalizado` son CÓDIGOS de respuesta; la etiqueta sólo se usa
# al final, para hablarle al graficador en su idioma.

.GOC_MODOS <- c("recetario", "frecuencia", "instrumento", "personalizado")
.GOC_TIPOS <- c("barras_categoricas", "barras_agrupadas", "pie", "donut")
.GOC_ESCALAS <- c("p_barras_apiladas", "p_barras_multiapiladas")

#' Normaliza `orden_categorias` a `{modo, lista, invertir}` (idempotente)
#'
#' Ausente, `NULL` o `{}` es `NULL` (el modo `recetario`). Un modo desconocido se guarda en `modo_invalido` y se usa
#' `recetario`: el export no se rompe, avisa.
#' @return `NULL` o `list(modo, lista, invertir[, modo_invalido])`.
#' @keywords internal
.graficos_orden_cat_normalizar <- function(x) {
  if (is.null(x) || (is.list(x) && !length(x))) return(NULL)
  if (is.character(x)) x <- list(modo = x[1])
  x <- as.list(x)
  modo <- tolower(trimws(as.character(unlist(x$modo %||% "recetario"))[1]))
  if (is.na(modo) || !nzchar(modo)) modo <- "recetario"
  invalido <- as.character(unlist(x$modo_invalido))[1]
  if (!modo %in% .GOC_MODOS) { invalido <- modo; modo <- "recetario" }
  lista <- trimws(as.character(unlist(x$lista, use.names = FALSE)))
  lista <- unique(lista[!is.na(lista) & nzchar(lista)])
  out <- list(modo = modo, lista = lista, invertir = isTRUE(as.logical(unlist(x$invertir))[1]))
  if (length(invalido) && !is.na(invalido) && nzchar(invalido)) out$modo_invalido <- invalido
  out
}

# ---- instrumento ----------------------------------------------------------------

#' Instrumento, base y variable de una referencia (`p7` o `docentes$p7`)
#' @keywords internal
.goc_resolver_ref <- function(ref, inst_sources, default_source = NULL) {
  ref <- trimws(as.character(ref %||% "")[1])
  m <- regmatches(ref, regexec("^([^$]+)\\$(.+)$", ref))[[1]]
  base <- if (length(m) == 3L) trimws(m[2]) else (default_source %||% names(inst_sources)[1])
  var <- if (length(m) == 3L) trimws(m[3]) else ref
  list(inst = inst_sources[[base]] %||% NULL, base = base, var = var)
}

#' Fila del `survey` de una variable: tipo (`select_one`, `select_multiple`…) y `list_name`
#' @keywords internal
.goc_survey <- function(inst, var) {
  sv <- inst$survey
  if (!is.data.frame(sv) || !"name" %in% names(sv)) return(list(tipo = NA_character_, list_name = NA_character_))
  i <- match(var, as.character(sv$name))
  if (is.na(i)) return(list(tipo = NA_character_, list_name = NA_character_))
  type <- strsplit(trimws(as.character(sv$type[i])), "\\s+")[[1]]
  ln <- if ("list_name" %in% names(sv) && !is.na(sv$list_name[i]) && nzchar(sv$list_name[i])) as.character(sv$list_name[i]) else
    if (length(type) >= 2L) type[2] else NA_character_
  list(tipo = type[1], list_name = ln)
}

#' Categorías de una variable en orden del instrumento (con el orden por lista de Analítica ya aplicado)
#'
#' Sale de `orders_list[[var]]` (`names` = códigos, `labels` = etiquetas); si la variable no está ahí, de la lista de
#' opciones (`dicc_code_to_label`).
#' @return `data.frame(codigo, etiqueta, residual)`; cero filas si la variable no tiene lista.
#' @keywords internal
.goc_categorias <- function(inst, var) {
  vacio <- data.frame(codigo = character(), etiqueta = character(), residual = logical(), stringsAsFactors = FALSE)
  if (is.null(inst)) return(vacio)
  ol <- inst$orders_list[[var]]
  if (!is.null(ol) && length(ol$names)) {
    codigos <- as.character(ol$names); etiquetas <- as.character(ol$labels %||% ol$names)
  } else {
    ln <- .goc_survey(inst, var)$list_name
    d <- if (!is.na(ln)) inst$dicc_code_to_label[[ln]] else NULL
    ch <- inst$choices
    if (!is.null(d) && length(d)) {
      codigos <- names(d); etiquetas <- as.character(d)
    } else if (!is.na(ln) && is.data.frame(ch) && all(c("list_name", "name") %in% names(ch))) {
      # Instrumento crudo (survey + choices, sin `orders_list`): el orden de filas de `choices` es el del instrumento.
      f <- ch[as.character(ch$list_name) == ln, , drop = FALSE]
      if (!nrow(f)) return(vacio)
      lc <- inst$label_col_choices %||% "label"; if (!lc %in% names(f)) lc <- if ("label" %in% names(f)) "label" else "name"
      codigos <- as.character(f$name); etiquetas <- as.character(f[[lc]])
    } else {
      return(vacio)
    }
  }
  data.frame(codigo = codigos, etiqueta = etiquetas, residual = grepl(.CATEGORIAS_RESIDUALES, etiquetas, ignore.case = TRUE),
             stringsAsFactors = FALSE)
}

#' Pregunta (etiqueta de la variable) para los avisos
#' @keywords internal
.goc_pregunta <- function(inst, var) {
  l <- inst$orders_list[[var]]$label %||% inst$var_labels[[var]] %||% var
  as.character(l)[1]
}

#' ¿La lista de la variable es ordinal? (decide el modo «recetario»)
#'
#' 1. Lo que Analítica declara manda en los dos sentidos: `inst$listas_nominales` (marcadas «no ordinal») y
#'    `inst$listas_ordinales` (marcadas u autodetectadas), que estampa `.graficos_apply_orden_categorias_sources`. Sin esa
#'    marca, la heurística compartida `.orden_categorias_ordinal_auto`.
#' 2. Si con eso no es ordinal, las pistas de orden de sus etiquetas (`.goc_pistas_orden`). Medido en acrconta: la
#'    heurística compartida exige códigos crecientes y deja fuera rangos de edad recodificados antes del 11-08 (D5),
#'    años de egreso y grados académicos, que el recetario dibuja en orden del instrumento (p160, p162).
#' @keywords internal
.goc_ordinal <- function(inst, list_name, etiquetas = NULL) {
  if (is.na(list_name)) return(.goc_pistas_orden(etiquetas))
  if (list_name %in% as.character(inst$listas_nominales %||% character())) return(FALSE)
  marcada <- if (!is.null(inst$listas_ordinales)) list_name %in% as.character(inst$listas_ordinales) else
    isTRUE(tryCatch(.orden_categorias_ordinal_auto(inst)[[list_name]], error = function(e) FALSE))
  marcada || .goc_pistas_orden(etiquetas)
}

#' ¿Las etiquetas de una lista tienen un orden propio? Cifras (rangos, años, «Menos de 2 meses»), grados académicos o
#' palabras de gradación. Los residuales no cuentan.
#' @keywords internal
.goc_pistas_orden <- function(etiquetas) {
  e <- as.character(etiquetas %||% character())
  e <- e[!is.na(e) & nzchar(trimws(e)) & !grepl(.CATEGORIAS_RESIDUALES, e, ignore.case = TRUE)]
  if (length(e) < 2L) return(FALSE)
  t <- chartr("áéíóúüñ", "aeiouun", tolower(enc2utf8(e)))
  if (mean(grepl("[0-9]", t)) >= 0.5) return(TRUE)
  grados <- "\\b(bachiller|licenciad|magister|maestri|maestr|doctor|doctorado|posgrado|primaria|secundaria|tecnic|superior|inicial)"
  if (sum(grepl(grados, t, perl = TRUE)) >= 2L) return(TRUE)
  ordinales <- "\\b(primer|segund|tercer|cuart|quint|sext|septim|setim|octav|noven|decim)"   # «Quinto ciclo» … «Décimo ciclo» (p68)
  if (sum(grepl(ordinales, t, perl = TRUE)) >= 2L) return(TRUE)
  gradacion <- "\\b(nada|poco|algo|mucho|muy|totalmente|siempre|nunca|a veces|rara vez|bajo|medio|alto|acuerdo|desacuerdo|satisfech|insatisfech|malo|bueno|regular|excelente|pesimo|nivel|menos de|mas de|a mas)\\b"
  sum(grepl(gradacion, t, perl = TRUE)) >= 2L
}

#' El modo que dibuja el recetario para un dato (contrato §2)
#'
#' Opción múltiple: frecuencia (p73). Ordinal: instrumento (p68, p152 «tiempo», p160). Dos categorías sin contar las
#' residuales: instrumento (p69, p70, p164). Nominal de más de dos: frecuencia (p152 «Sector»).
#' @keywords internal
.goc_modo_recetario <- function(cats, ordinal, tipo) {
  if (identical(tipo, "select_multiple")) return("frecuencia")
  if (isTRUE(ordinal) || sum(!cats$residual) <= 2L) return("instrumento")
  "frecuencia"
}

#' Orden de los códigos según un modo (contrato §4)
#'
#' En los modos automáticos los residuales van al final; en `personalizado` manda la lista y sólo los residuales no
#' listados van al final de todo.
#' @param n Frecuencia por categoría (alineada con `cats`); sólo la usa `frecuencia`.
#' @return `list(codigos, no_listadas, ausentes)` (las dos últimas, sólo en `personalizado`).
#' @keywords internal
.goc_orden_codigos <- function(cats, modo, lista = character(), invertir = FALSE, n = NULL) {
  idx <- seq_len(nrow(cats))
  al_final <- function(o) c(o[!cats$residual[o]], o[cats$residual[o]])
  if (identical(modo, "personalizado")) {
    pos <- match(lista, cats$codigo)
    listadas <- pos[!is.na(pos)]
    if (isTRUE(invertir)) listadas <- rev(listadas)
    resto <- al_final(setdiff(idx, listadas))
    return(list(codigos = cats$codigo[c(listadas, resto)], no_listadas = cats$codigo[resto], ausentes = lista[is.na(pos)]))
  }
  o <- if (identical(modo, "frecuencia")) {
    v <- suppressWarnings(as.numeric(n %||% rep(NA_real_, length(idx)))); v[!is.finite(v)] <- 0
    order(if (isTRUE(invertir)) v else -v, idx)
  } else if (isTRUE(invertir)) rev(idx) else idx
  list(codigos = cats$codigo[al_final(o)], no_listadas = character(), ausentes = character())
}

# ---- traducción al graficador -------------------------------------------------

#' Nombres del modo y del preset del graficador de cada tipo de elemento
#' @keywords internal
.goc_arg_modo <- function(tipo) if (tipo %in% c("pie", "donut")) "ordenar_categorias" else "orden_barras"

#' ¿El gráfico trae un orden heredado explícito, o el preset global uno distinto del de fábrica? (contrato §3, pasos 2–3)
#' @keywords internal
.goc_orden_heredado <- function(el, presets) {
  tipo <- el$.element_type; arg <- .goc_arg_modo(tipo)
  ov <- el$overrides %||% list()
  if (!is.null(ov[[arg]]) || length(.orden_manual_etiquetas(ov$orden_categorias_manual))) return(TRUE)
  pa <- ((presets %||% list())[[tipo]] %||% list())$args[[arg]]
  # El de fábrica, con la misma herencia que aplica `reporte_ppt_plan` (la dona hereda del pie): sin ella, el «ninguno»
  # que la dona recibe del pie parecía un orden elegido y apagaba el recetario (verificador de D8).
  fab <- (.PRESETS_DEFAULT_PULSO[[tipo]] %||% list())[[arg]] %||% if (identical(tipo, "donut")) .PRESETS_DEFAULT_PULSO$pie[[arg]] else NULL
  !is.null(pa) && !identical(as.character(pa)[1], as.character(fab %||% "")[1])
}

#' Traduce el `orden_categorias` de un elemento a los argumentos de su graficador
#'
#' @param ctx `list(inst, var)` resuelto de la referencia del elemento.
#' @return El elemento, con `overrides` ajustados (o intacto si manda un orden heredado o la variable no tiene lista).
#' @keywords internal
.goc_traducir <- function(el, ctx, presets = NULL) {
  oc <- .graficos_orden_cat_normalizar(el$orden_categorias) %||% list(modo = "recetario", lista = character(), invertir = FALSE)
  cats <- .goc_categorias(ctx$inst, ctx$var)
  pregunta <- if (is.null(ctx$inst)) ctx$var else .goc_pregunta(ctx$inst, ctx$var)
  if (!is.null(oc$modo_invalido)) {
    .pulso_aviso(sprintf("“%s”: el orden de categorías guardado no existe en esta versión; se usa el del recetario.", pregunta))
  }
  if (!nrow(cats)) return(el)
  modo <- oc$modo
  if (identical(modo, "recetario")) {
    if (.goc_orden_heredado(el, presets)) return(el)
    sv <- .goc_survey(ctx$inst, ctx$var)
    modo <- .goc_modo_recetario(cats, .goc_ordinal(ctx$inst, sv$list_name, cats$etiqueta), sv$tipo)
  }
  tipo <- el$.element_type; arg <- .goc_arg_modo(tipo); circular <- tipo %in% c("pie", "donut")
  el$overrides <- el$overrides %||% list()
  el$overrides$orden_categorias_manual <- NULL
  el$overrides$residuales_al_final <- NULL
  if (identical(modo, "frecuencia")) {
    el$overrides[[arg]] <- if (circular) (if (oc$invertir) "asc" else "desc") else (if (oc$invertir) "menor_mayor" else "mayor_menor")
    # Torta y dona ordenan por valor en el graficador: los residuales van al final sólo si se le pide (contrato §4).
    if (circular) el$overrides$residuales_al_final <- TRUE
    return(el)
  }
  ord <- .goc_orden_codigos(cats, modo, oc$lista, oc$invertir)
  el$overrides[[arg]] <- "manual"
  # Las tablas que recibe el graficador pasan las etiquetas por `.freq_clean_other_label_es` («Otro (especifique)» → «Otros»):
  # la lista se habla con las mismas palabras o la categoría no casaría y caería al final.
  el$overrides$orden_categorias_manual <- unique(.freq_clean_other_label_es(cats$etiqueta[match(ord$codigos, cats$codigo)]))
  if (identical(modo, "personalizado")) {
    if (identical(tipo, "barras_categoricas")) el$overrides$residuales_al_final <- FALSE   # manda la lista (contrato §4)
    if (length(oc$lista) && length(ord$no_listadas)) {
      k <- length(ord$no_listadas)
      .pulso_aviso(sprintf("“%s”: %d %s en el orden personalizado y %s al final: %s.", pregunta, k,
                           if (k == 1L) "categoría no estaba" else "categorías no estaban", if (k == 1L) "va" else "van",
                           paste(cats$etiqueta[match(ord$no_listadas, cats$codigo)], collapse = ", ")))
    }
    if (length(ord$ausentes)) {
      .pulso_aviso(sprintf("“%s”: el orden personalizado nombra códigos que la pregunta no tiene: %s.", pregunta,
                           paste(ord$ausentes, collapse = ", ")))
    }
  }
  el
}

#' Resuelve el orden de categorías de todos los gráficos del plan (enganche de `reporte_ppt_plan`)
#'
#' @param plan Plan (`ppt_plan`) con sus láminas.
#' @param inst_sources Instrumentos por base.
#' @param presets Presets ya normalizados del motor.
#' @param default_source Base de las referencias sin calificar.
#' @return El plan, con cada gráfico de categorías traducido; las demás láminas intactas.
#' @keywords internal
.plan_orden_categorias <- function(plan, inst_sources, presets = NULL, default_source = NULL) {
  if (!length(plan)) return(plan)
  atr <- attributes(plan)
  out <- lapply(plan, function(slide) {
    if (!is.list(slide) || !is.list(slide$slots)) return(slide)
    for (nm in names(slide$slots)) {
      el <- slide$slots[[nm]]
      if (!inherits(el, "ppt_element") || !(el$.element_type %||% "") %in% .GOC_TIPOS) next
      ctx <- tryCatch(.goc_resolver_ref(el$var, inst_sources, default_source), error = function(e) NULL)
      if (is.null(ctx)) next
      # Un fallo al resolver el orden no corta el mazo: el gráfico sale con el orden que traía y el analista lo sabe por el
      # aviso (un export completo con un orden que no pidió es mejor que ninguno; el aviso le dice cuál y por qué).
      slide$slots[[nm]] <- tryCatch(.goc_traducir(el, ctx, presets), error = function(e) {
        .aviso_detalle("orden de categorías de ", ctx$var, ": ", conditionMessage(e))   # siempre al `.err`; al aviso si se lee
        .pulso_aviso(sprintf("«%s»: no se pudo aplicar el orden de categorías%s; sale en el orden que traía.", ctx$var,
                             .aviso_motivo(conditionMessage(e), " (%s)")))
        el
      })
    }
    slide
  })
  attributes(out) <- atr
  out
}

#' Avisos de validación de un gráfico del plan JSON (`/api/graficos/validar` y exports, en `warnings`)
#'
#' Un modo desconocido, o un orden de categorías en una escala (no aplica: las categorías son la escala, contrato §1).
#' @keywords internal
.graficos_orden_cat_avisos_slot <- function(slot, tag) {
  args <- (slot %||% list())$args %||% list()
  oc <- .graficos_orden_cat_normalizar(args$orden_categorias)
  if (is.null(oc)) return(character())
  graf <- as.character(slot$graficador %||% "")[1]
  c(if (!is.null(oc$modo_invalido)) sprintf("%s: el orden de categorías guardado no existe en esta versión; se usa el del recetario", tag),
    if (graf %in% .GOC_ESCALAS && !identical(oc$modo, "recetario"))
      sprintf("%s: el orden de categorías no aplica a una escala (%s); sus categorías van en el orden de la escala", tag, .aviso_tipo_grafico(graf)))
}

# ---- endpoint -----------------------------------------------------------------

#' Respuesta de `GET /api/graficos/categorias` (contrato §7)
#'
#' @param sources `list(data_sources, inst_sources)` de la ruta de Gráficos.
#' @param ref Referencia de la variable (`p7` o `docentes$p7`). El frontend debería mandar la calificada.
#' @param base_activa Base de una referencia sin calificar: la activa de la sesión (verificador de D8: resolvía contra
#'   la primera base y en acrconta `p7` devolvía docentes con estudiantes activa). Sin ella, la primera.
#' @keywords internal
.graficos_categorias_payload <- function(sources, ref, base_activa = NULL) {
  ref <- trimws(as.character(ref %||% "")[1])
  if (is.na(ref) || !nzchar(ref)) stop_api(400, "E_BAD_CATEGORIAS_VAR", "Falta `var`: la variable cuyas categorías se piden.")
  ctx <- .goc_resolver_ref(ref, sources$inst_sources, .goc_base_por_defecto(sources$inst_sources, base_activa, ref))
  data <- sources$data_sources[[ctx$base]]
  if (is.null(ctx$inst) || (!ctx$var %in% names(data %||% list()) && is.na(.goc_survey(ctx$inst, ctx$var)$tipo))) {
    stop_api(404, "E_CATEGORIAS_VAR_NO_EXISTE", sprintf("La variable «%s» no está en la base «%s».", ctx$var, ctx$base %||% ""))
  }
  cats <- .goc_categorias(ctx$inst, ctx$var)
  if (!nrow(cats)) stop_api(409, "E_CATEGORIAS_SIN_LISTA", sprintf("La variable «%s» no tiene lista de opciones.", ctx$var))
  sv <- .goc_survey(ctx$inst, ctx$var)
  n <- .goc_frecuencias(data, ctx$var, cats$codigo, sv$tipo)
  total <- if (identical(sv$tipo, "select_multiple")) .goc_respondentes(data, ctx$var, cats$codigo) else sum(n, na.rm = TRUE)
  ordinal <- .goc_ordinal(ctx$inst, sv$list_name, cats$etiqueta)
  modo_rec <- .goc_modo_recetario(cats, ordinal, sv$tipo)
  list(
    var = ctx$var, base = ctx$base, pregunta = .goc_pregunta(ctx$inst, ctx$var), list_name = sv$list_name,
    ordinal = ordinal, tipo = sv$tipo, modo_recetario = modo_rec,
    categorias = lapply(seq_len(nrow(cats)), function(i) list(
      codigo = cats$codigo[i], etiqueta = cats$etiqueta[i], n = as.integer(n[i]),
      pct = if (total > 0) round(n[i] / total, 4) else NA_real_, residual = cats$residual[i])),
    orden = list(
      recetario = I(.goc_orden_codigos(cats, modo_rec, n = n)$codigos),
      instrumento = I(.goc_orden_codigos(cats, "instrumento")$codigos),
      frecuencia = I(.goc_orden_codigos(cats, "frecuencia", n = n)$codigos)
    )
  )
}

#' Base de una referencia sin calificar: la activa si está entre las fuentes; si no, la primera, y lo avisa
#'
#' Verificador de D8-2: si la base activa no estaba entre las fuentes de Gráficos se caía en silencio a la primera y el
#' editor mostraba las categorías de otra base como si fueran de la activa. Sin base activa (consolidado, una sola base)
#' la primera es lo esperado y no se avisa; una referencia calificada (`docentes$p7`) no usa la base por defecto.
#' @keywords internal
.goc_base_por_defecto <- function(inst_sources, base_activa, ref) {
  bases <- names(inst_sources)
  activa <- as.character(base_activa %||% "")[1]
  if (is.na(activa) || !nzchar(activa)) return(bases[1])
  if (activa %in% bases) return(activa)
  if (!grepl("$", ref, fixed = TRUE)) {
    .pulso_aviso(sprintf("La base activa «%s» no tiene datos listos para Gráficos: las categorías de «%s» se muestran con la base «%s».",
                         activa, ref, bases[1] %||% ""))
  }
  bases[1]
}

#' Frecuencia de cada código en la base (sin filtros de lámina)
#'
#' `select_one`: cuenta el código en la columna. `select_multiple`: suma la columna indicadora `var/código` o `var_código`
#' cuando existe; si no, cuenta el código entre las respuestas separadas por espacio.
#' @keywords internal
.goc_frecuencias <- function(data, var, codigos, tipo) {
  if (!is.data.frame(data)) return(rep(0L, length(codigos)))
  if (identical(tipo, "select_multiple")) {
    return(vapply(codigos, function(k) {
      col <- intersect(c(paste0(var, "/", k), paste0(var, "_", k)), names(data))
      if (length(col)) return(as.integer(sum(suppressWarnings(as.numeric(data[[col[1]]])) == 1, na.rm = TRUE)))
      if (!var %in% names(data)) return(0L)
      as.integer(sum(vapply(strsplit(as.character(data[[var]]), "\\s+"), function(r) k %in% r, logical(1)), na.rm = TRUE))
    }, integer(1), USE.NAMES = FALSE))
  }
  if (!var %in% names(data)) return(rep(0L, length(codigos)))
  t <- table(as.character(data[[var]]))
  as.integer(ifelse(is.na(t[codigos]), 0L, t[codigos]))
}

#' Respondentes de una opción múltiple (filas con al menos una opción marcada)
#' @keywords internal
.goc_respondentes <- function(data, var, codigos) {
  cols <- intersect(c(paste0(var, "/", codigos), paste0(var, "_", codigos)), names(data))
  if (length(cols)) return(sum(rowSums(sapply(data[cols], function(x) suppressWarnings(as.numeric(x)) == 1), na.rm = TRUE) > 0))
  if (!var %in% names(data)) return(0L)
  sum(!is.na(data[[var]]) & nzchar(trimws(as.character(data[[var]]))))
}
