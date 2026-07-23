# =============================================================================
# Entregables / Dashboard / PDF conscientes de grupos repeat (ADR 0030, Fase 4)
# =============================================================================
#
# La Fase 1 dejó cada `begin_repeat` como una base HIJA long, vinculada a su base
# MADRE ancha con las llaves canónicas ODK/Kobo (`.KOBO_CHILD_META_COLS`) y
# `extra_meta` (`source_kind="kobo_repeat"`, `parent_base`, `repeat_group`,
# `link_key`, `grain`). La Fase 3 llevó ese enlace a Analítica (enriquecimiento
# hija×madre + meta de grano, dejada en `attr(inst, "repeat_grain")`).
#
# Esta fase asegura que la CAPA DE SALIDA no fugue basura técnica ni fantasmas y
# que anote la cardinalidad/grano. Cubre cuatro cosas:
#
#   A. Export/preview de Bases: suprimir las llaves técnicas de repeat
#      (`_index`/`_parent_index`/`_parent_table_name`/`_submission__id`) del SAV/
#      CSV/XLSX y del preview de metadata SPSS, SIN tocar las columnas heredadas
#      de la madre (`attr(col, "repeat_inherited") == TRUE`), que SÍ son variables
#      de análisis válidas.
#   B. Dashboard: reusa el filtro de fantasmas de la Fase 3
#      (`.analitica_repeat_phantom_names`, `repeat_depth > 0`) al construir las
#      secciones de la MADRE, para que no liste las preguntas del repeat.
#   C. PDF de formulario/codebook: marca "(repetible)" las secciones abiertas por
#      un `begin_repeat` (contenido/estructura; el naranja de UI es la Fase 5).
#   D. Ficha técnica / grano: nota de N a grano de instancia
#      (N=instancias ... de N personas) sobre una base hija.
#
# La lógica de repeats de la capa de entregables vive aquí (no engorda
# `helpers_bases.R`, `dashboard_secciones.R`, `reporte_formulario_pdf.R` ni
# `reporte_ficha_tecnica.R`); esos archivos la llaman con una línea. Reusa
# `.KOBO_CHILD_META_COLS` (`carga_kobo_repeats.R`) como fuente única de las llaves
# técnicas — un solo lugar para la lista.

# --- A. Supresión de llaves técnicas de repeat en export/preview ------------

#' Llaves técnicas de enlace repeat (ODK/Kobo) que NO deben aparecer en un
#' entregable de datos. Fuente única: `.KOBO_CHILD_META_COLS`.
#' @keywords internal
.repeat_technical_cols <- function() {
  if (exists(".KOBO_CHILD_META_COLS", inherits = TRUE)) {
    return(.KOBO_CHILD_META_COLS)
  }
  # Fallback defensivo si el módulo de carga no está cargado (mismo contrato).
  c("_index", "_parent_index", "_parent_table_name", "_submission__id")
}

#' Quita de un data.frame las llaves técnicas de repeat, preservando TODO lo
#' demás: las columnas de análisis, las heredadas de la madre
#' (`attr(col, "repeat_inherited") == TRUE`) y los atributos a nivel de
#' data.frame (p.ej. `instrumento_reporte`, que la ficha técnica lee). Idempotente
#' y seguro sobre bases sin repeats (no encuentra nada que quitar).
#' @keywords internal
.repeat_drop_technical_cols <- function(df) {
  if (!is.data.frame(df)) return(df)
  drop <- intersect(names(df), .repeat_technical_cols())
  if (!length(drop)) return(df)
  keep <- setdiff(names(df), drop)
  out <- df[, keep, drop = FALSE]
  # `[` conserva atributos de columna (labels, repeat_inherited) pero dropea los
  # atributos a nivel de data.frame; los restauramos para no romper la ficha.
  preserved <- setdiff(names(attributes(df)), c("names", "row.names", "class"))
  for (a in preserved) attr(out, a) <- attr(df, a)
  out
}

#' Filtra un vector de nombres de columna dejando fuera las llaves técnicas de
#' repeat (para el preview de metadata, que itera `names(df)`).
#' @keywords internal
.repeat_visible_col_names <- function(nms) {
  setdiff(as.character(nms), .repeat_technical_cols())
}

# --- C. Marca "(repetible)" para secciones repeat en el PDF/codebook ---------

#' Sufijo textual para una sección abierta por un `begin_repeat` en el
#' formulario/codebook (ADR 0030, Fase 4). Si el instrumento trae un
#' `repeat_count` entero se anota la cardinalidad máxima; si es una expresión
#' dinámica (`${var}`) o está ausente, se marca sólo "(repetible)". El color
#' naranja de la UI interactiva es la Fase 5: aquí basta la marca textual.
#' @keywords internal
.repeat_pdf_section_suffix <- function(repeatable = FALSE, repeat_count = NULL) {
  if (!isTRUE(repeatable)) return("")
  rc <- suppressWarnings(as.integer(repeat_count))
  if (length(rc) == 1L && !is.na(rc) && rc > 0L) {
    sprintf(" (repetible, hasta %d)", rc)
  } else {
    " (repetible)"
  }
}

# --- D. Nota de grano de instancia para la ficha técnica --------------------

#' Nota metodológica de grano de INSTANCIA para la ficha técnica de una base hija
#' repeat. Reusa el meta de grano de la Fase 3 (`.analitica_repeat_grain`, que se
#' deja en `attr(inst, "repeat_grain")`). Devuelve "" si no hay grano de repeat,
#' de modo que las bases normales no reciben ninguna nota.
#' @keywords internal
.repeat_grain_ficha_nota <- function(grain) {
  if (!is.list(grain) || !identical(as.character(grain$kind %||% ""), "instancia")) {
    return("")
  }
  n_inst <- suppressWarnings(as.integer(grain$n_instancias))
  n_pers <- suppressWarnings(as.integer(grain$n_personas))
  if (length(n_inst) != 1L || is.na(n_inst)) return("")
  grupo <- as.character(grain$repeat_group %||% "")
  grupo_txt <- if (nzchar(grupo)) sprintf(" del grupo repetible «%s»", grupo) else ""
  encuesta_txt <- if (length(n_pers) == 1L && !is.na(n_pers)) {
    sprintf(" correspondientes a %s encuestas", format(n_pers, big.mark = ","))
  } else {
    ""
  }
  sprintf(
    paste0(
      "%s respuestas%s%s. Cada fila representa una respuesta del bloque; ",
      "los porcentajes se calculan sobre respuestas, no sobre encuestas."
    ),
    format(n_inst, big.mark = ","), grupo_txt, encuesta_txt
  )
}

#' Grano de repeat asociado a un instrumento, si la Fase 3 lo dejó en
#' `attr(inst, "repeat_grain")`. NULL si no aplica.
#' @keywords internal
.repeat_grain_from_inst <- function(instrumento) {
  if (is.null(instrumento)) return(NULL)
  attr(instrumento, "repeat_grain", exact = TRUE) %||%
    (instrumento$repeat_grain %||% NULL)
}

# --- E. Univariados de la HIJA a grano de INSTANCIA (ADR 0030, Fase 4) --------
#
# El enriquecimiento hija×madre (Fase 3, `.analitica_enrich_child_pair`) inyecta
# en la hija las variables de caracterización de la MADRE (`repeat_inherited=TRUE`
# en la columna, `parent_inherited=TRUE` en la fila de survey) para que los CRUCES
# hija×madre existan. Pero esas variables son a grano de PERSONA (430) y, si se
# reportan en un frecuencias/codebook UNIVARIADO de la hija (668 filas), se
# inflan (doble-conteo: transport bus 236 personas → 366 instancias). La madre ya
# las reporta bien a su grano. El filtro de fantasmas de esta capa (Parte B, arriba)
# era UNIDIRECCIONAL — la madre excluye las preguntas del repeat; faltaba la
# recíproca. Aquí va:
#
#   PARTE A — Los univariados (frecuencias/codebook) de una base hija repeat
#             reportan SOLO las variables NATIVAS del bloque; las heredadas de la
#             madre se excluyen del reporte (NO se borran del dato: siguen
#             disponibles para cruces).
#   PARTE B — Las preguntas nativas del bloque (`srv_*`) NO van en un total plano;
#             se reportan DESGLOSADAS POR SERVICIO usando la etiqueta del roster
#             (`current_label`) como condicional. Cada fila es un caso único
#             persona×servicio (una persona no repite el mismo servicio), así que
#             condicionar por servicio no dobla-cuenta. Una `srv_*` que sólo aplica
#             a ciertos servicios aparece SÓLO bajo ese/esos servicio(s) (las filas
#             de otros servicios tienen NA para esa pregunta y no suman ahí).

#' ¿El par (data, inst) es una base HIJA repeat a grano instancia? Señal robusta:
#' `attr(inst,"repeat_grain")$kind == "instancia"` (lo deja la Fase 3). Devuelve el
#' grain (list) o NULL. Reusa `.repeat_grain_from_inst`.
#' @keywords internal
.repeat_child_instancia_grain <- function(inst) {
  g <- .repeat_grain_from_inst(inst)
  if (is.list(g) && identical(as.character(g$kind %||% ""), "instancia")) return(g)
  NULL
}

#' Nombres de variables HEREDADAS de la madre presentes en el par (data,inst) de
#' la hija: columnas con `attr(col,"repeat_inherited")==TRUE` ∪ filas de survey con
#' `parent_inherited==TRUE`. Fuente única de la marca que dejó el enriquecimiento.
#' @keywords internal
.repeat_inherited_var_names <- function(data, inst = NULL) {
  nms <- character(0)
  if (is.data.frame(data) && length(data)) {
    inh <- vapply(names(data), function(cn) {
      isTRUE(attr(data[[cn]], "repeat_inherited", exact = TRUE))
    }, logical(1))
    nms <- names(data)[inh]
  }
  sv <- inst$survey
  if (is.data.frame(sv) && all(c("name", "parent_inherited") %in% names(sv))) {
    flag <- sv$parent_inherited
    is_inh <- !is.na(flag) & (flag %in% TRUE | as.character(flag) %in% c("TRUE", "true"))
    nms <- union(nms, as.character(sv$name)[is_inh])
  }
  unique(nms[nzchar(nms)])
}

#' PARTE A — quita del par (data, inst) las variables heredadas de la madre, para
#' que los univariados de la hija no las reporten (ni las inflen). Preserva los
#' atributos a nivel de data.frame (instrumento_reporte, repeat_grain) y las filas
#' de survey nativas. Idempotente y seguro sobre bases sin heredadas.
#' @keywords internal
.repeat_strip_inherited <- function(data, inst) {
  inh <- .repeat_inherited_var_names(data, inst)
  if (!length(inh)) return(list(data = data, inst = inst))
  out <- data
  if (is.data.frame(data)) {
    keep <- setdiff(names(data), inh)
    out <- data[, keep, drop = FALSE]
    preserved <- setdiff(names(attributes(data)), c("names", "row.names", "class"))
    for (a in preserved) attr(out, a) <- attr(data, a)
  }
  inst2 <- inst
  sv <- inst2$survey
  if (is.data.frame(sv) && "name" %in% names(sv)) {
    inst2$survey <- sv[!(as.character(sv$name) %in% inh), , drop = FALSE]
  }
  if (is.data.frame(inst2$survey_raw) && "name" %in% names(inst2$survey_raw)) {
    sr <- inst2$survey_raw
    inst2$survey_raw <- sr[!(as.character(sr$name) %in% inh), , drop = FALSE]
  }
  list(data = out, inst = inst2)
}

#' Etiqueta de servicio del roster (`current_label`) por fila de la hija. Los
#' campos `calculate` (current_code/current_label) se pierden en la preparación
#' analítica; se re-anclan aquí desde la data CRUDA de la propia hija por `_index`
#' (fallback `_submission__id`). Devuelve un character alineado a `nrow(data)` o
#' NULL si no se puede resolver (degradar sin romper).
#' @keywords internal
.repeat_service_labels_from_raw <- function(sid, base_name, data,
                                            service_col = "current_label") {
  base_name <- as.character(base_name %||% "")
  if (!nzchar(base_name) || !is.data.frame(data)) return(NULL)
  sources <- tryCatch(estudio_data_sources(sid), error = function(e) list())
  raw <- sources[[base_name]]
  # Back-compat: grains antiguos sólo llevaban `repeat_group`. Si la base fue
  # renombrada o el nombre colisionó durante la carga, resolver la key real por
  # metadata relacional en vez de asumir repeat_group == nombre de base.
  if (!is.data.frame(raw)) {
    s <- session_get(sid, required = FALSE)
    bases <- ((s %||% list())$estudio %||% list())$bases %||% list()
    hits <- names(Filter(function(b) {
      identical(as.character((b %||% list())$repeat_group %||% ""), base_name)
    }, bases))
    hits <- intersect(hits, names(sources))
    if (length(hits)) raw <- sources[[hits[[1]]]]
  }
  if (!is.data.frame(raw) || !(service_col %in% names(raw))) return(NULL)
  key <- if ("_index" %in% names(data) && "_index" %in% names(raw)) {
    "_index"
  } else if ("_submission__id" %in% names(data) && "_submission__id" %in% names(raw)) {
    "_submission__id"
  } else {
    NULL
  }
  if (is.null(key)) return(NULL)
  # `_submission__id` NO es llave de instancia: una submission puede tener
  # varias filas hija (una por servicio) y `match()` tomaria siempre la
  # PRIMERA — todas las instancias heredarian el servicio de la primera fila,
  # produciendo laminas "por servicio" con datos de otro servicio. Con
  # multiplicidad >1 se aborta el re-anclaje (mejor "Sin datos" que un
  # servicio equivocado). `_index` si es llave de instancia y no se toca.
  if (identical(key, "_submission__id")) {
    raw_keys <- as.character(raw[[key]])
    raw_keys <- raw_keys[!is.na(raw_keys) & nzchar(raw_keys)]
    if (anyDuplicated(raw_keys) > 0L) return(NULL)
  }
  pos <- match(as.character(data[[key]]), as.character(raw[[key]]))
  if (all(is.na(pos))) return(NULL)
  svc <- as.character(raw[[service_col]][pos])
  svc[is.na(svc)] <- ""
  svc
}

#' Nombre seguro y único para la columna sintética de una `srv_*` restringida a un
#' servicio. Determinístico por (var, índice de servicio) para no colisionar.
#' @keywords internal
.repeat_service_syn_name <- function(var, svc_idx) {
  sprintf("%s__svc%02d", as.character(var), as.integer(svc_idx))
}

#' Clona en el instrumento de la hija la fila de survey (y survey_raw) de `from`
#' bajo el nombre `to`, conservando `type`/`label`/`list_name` para que
#' `reporte_frecuencias` resuelva sus etiquetas de valor igual que la original.
#' @keywords internal
.repeat_clone_survey_row <- function(inst, from, to) {
  clone_in <- function(df) {
    if (!is.data.frame(df) || !("name" %in% names(df))) return(df)
    idx <- which(as.character(df$name) == as.character(from))
    if (!length(idx)) return(df)
    row <- df[idx[1], , drop = FALSE]
    row$name <- to
    rbind(df, row)
  }
  inst$survey <- clone_in(inst$survey)
  if (!is.null(inst$survey_raw)) inst$survey_raw <- clone_in(inst$survey_raw)
  inst
}

#' Registra `service_col` (character del roster) como un `select_one` con lista de
#' opciones inline construida de sus propios valores, para que la sección de
#' composición del roster ("Servicios evaluados") se tabule con etiquetas.
#' @keywords internal
.repeat_register_service_dict <- function(inst, service_col, values,
                                          label = "Servicio evaluado") {
  vals <- unique(as.character(values))
  vals <- vals[!is.na(vals) & nzchar(vals)]
  if (!length(vals)) return(inst)
  ln <- "svc_roster_list"
  # survey: fila select_one; si ya existe, no duplicar.
  sv <- inst$survey %||% data.frame(type = character(0), name = character(0), label = character(0))
  if (!(service_col %in% as.character(sv$name %||% character(0)))) {
    row <- sv[0, , drop = FALSE]
    row[1, ] <- NA
    row$type[1] <- paste("select_one", ln)
    row$name[1] <- service_col
    row$label[1] <- label
    if ("list_name" %in% names(row)) row$list_name[1] <- ln
    inst$survey <- rbind(sv, row)
  }
  # choices: name = value (autocodigo), label = value.
  ch <- inst$choices
  add <- data.frame(list_name = ln, name = vals, label = vals, stringsAsFactors = FALSE)
  if (is.data.frame(ch) && all(c("list_name", "name", "label") %in% names(ch))) {
    extra <- setdiff(names(ch), names(add))
    for (e in extra) add[[e]] <- NA
    inst$choices <- rbind(ch[, union(names(ch), names(add)), drop = FALSE][, names(ch), drop = FALSE],
                          add[, names(ch), drop = FALSE])
  } else {
    inst$choices <- add
  }
  inst
}

#' Variables NATIVAS del bloque repeat que se tabulan por servicio: `select_one`/
#' `select_multiple` y numéricas (integer/decimal), excluyendo texto (`_why`), las
#' llaves técnicas y las columnas de `exclude`. Se leen del survey ya sin heredadas.
#' @keywords internal
.repeat_native_tabulable_vars <- function(data, inst, exclude = character(0)) {
  sv <- inst$survey
  if (!is.data.frame(sv) || !all(c("type", "name") %in% names(sv))) return(character(0))
  base_type <- function(t) tolower(trimws(sub("\\s.*$", "", as.character(t))))
  keep_types <- c("select_one", "select_multiple", "integer", "decimal")
  ok <- base_type(sv$type) %in% keep_types
  nms <- as.character(sv$name)[ok]
  nms <- setdiff(nms, c(.repeat_technical_cols(), as.character(exclude)))
  nms <- nms[nms %in% names(data)]
  unique(nms[nzchar(nms)])
}

#' NÚCLEO de la PARTE B (puro, sin sesión): dado un vector de servicio `svc`
#' alineado a las filas y las variables nativas `native`, construye
#' `list(data, inst, secciones)` con una sección "Servicios evaluados" (roster) y
#' una sección por servicio con columnas sintéticas de sus `srv_*` (restringidas a
#' las filas de ese servicio). Testeable sin sesión.
#' @keywords internal
.repeat_build_service_sections <- function(data, inst, svc, native,
                                           service_col = "current_label") {
  svc <- as.character(svc)
  data[[service_col]] <- svc
  inst <- .repeat_register_service_dict(inst, service_col, svc)

  secciones <- list()
  secciones[["Servicios evaluados"]] <- service_col

  # Orden de servicios por frecuencia (desc), estable.
  tab <- sort(table(svc[!is.na(svc) & nzchar(svc)]), decreasing = TRUE)
  servicios <- names(tab)

  for (i in seq_along(servicios)) {
    S <- servicios[i]
    en_S <- !is.na(svc) & svc == S
    sec_vars <- character(0)
    for (V in native) {
      resp <- !is.na(data[[V]]) & as.character(data[[V]]) != ""
      if (!any(resp & en_S)) next  # esta srv_ no aplica a este servicio
      newn <- .repeat_service_syn_name(V, i)
      col <- data[[V]]
      col[!en_S] <- NA  # restringe a las filas del servicio (preserva labels/attrs)
      data[[newn]] <- col
      inst <- .repeat_clone_survey_row(inst, V, newn)
      sec_vars <- c(sec_vars, newn)
    }
    if (length(sec_vars)) secciones[[S]] <- sec_vars
  }

  list(data = data, inst = inst, secciones = secciones)
}

#' PARTE B — plan de frecuencias de la hija DESGLOSADO POR SERVICIO. Devuelve
#' `list(data, inst, secciones)` listo para `reporte_frecuencias`:
#'   - aplica PARTE A (sin heredadas),
#'   - re-ancla `current_label` (servicio) desde la data cruda,
#'   - delega en `.repeat_build_service_sections` la construcción por servicio.
#' Si no se resuelve el servicio, degrada a univariado nativo plano (mejor que
#' romper): reporta las `srv_*` nativas sin desglose.
#' @keywords internal
.repeat_frecuencias_plan_por_servicio <- function(sid, data, inst, grain,
                                                  service_col = "current_label") {
  stripped <- .repeat_strip_inherited(data, inst)
  data <- stripped$data
  inst <- stripped$inst
  # `reporte_frecuencias()` reconstruye una lista mínima del instrumento para
  # la ficha técnica. Guardar el grano también como campo evita perderlo en el
  # merge y permite declarar respuestas y encuestas con su unidad correcta.
  inst$repeat_grain <- grain
  base_name <- as.character((grain %||% list())$base_name %||%
                              (grain %||% list())$repeat_group %||% "")

  native <- .repeat_native_tabulable_vars(data, inst, exclude = c(service_col, "current_code"))
  svc <- .repeat_service_labels_from_raw(sid, base_name, data, service_col)

  if (is.null(svc) || !length(native)) {
    # Degradación: univariado nativo plano (sin heredadas). Correcto en grano
    # (668) aunque no desglosado — nunca peor que el estado previo.
    secs <- if (length(native)) stats::setNames(list(native), "Bloque repetible") else list()
    return(list(data = data, inst = inst, secciones = secs))
  }

  .repeat_build_service_sections(data, inst, svc, native, service_col)
}

#' Plan compartido por los codebooks XLSX/PDF de una base hija repeat.
#'
#' Parte del mismo modelo por roster que frecuencias, pero devuelve únicamente
#' las columnas que el codebook debe documentar: composición del roster y
#' variables nativas restringidas a cada servicio. Las variables heredadas y
#' las originales sin condicionar quedan fuera para evitar documentar dos veces
#' la misma pregunta (total plano + servicio).
#' @keywords internal
.repeat_codebook_plan_por_servicio <- function(sid, data, inst, grain,
                                               service_col = "current_label") {
  stripped <- .repeat_strip_inherited(data, inst)
  data <- stripped$data
  inst <- stripped$inst
  inst$repeat_grain <- grain
  base_name <- as.character((grain %||% list())$base_name %||%
                              (grain %||% list())$repeat_group %||% "")

  native <- .repeat_native_tabulable_vars(
    data, inst, exclude = c(service_col, "current_code")
  )
  svc <- .repeat_service_labels_from_raw(sid, base_name, data, service_col)

  if (is.null(svc) || !length(native)) {
    secs <- if (length(native)) stats::setNames(list(native), "Bloque repetible") else list()
    return(list(data = data, inst = inst, secciones = secs))
  }

  plan <- .repeat_build_service_sections(data, inst, svc, native, service_col)

  # En el codebook no existe un renderer de encabezados de sección. Hacemos la
  # organización visible en la etiqueta de cada bloque y ordenamos físicamente
  # las columnas según `secciones`; XLSX y PDF consumen exactamente este data.
  attr(plan$data[[service_col]], "label") <- "Servicio evaluado"
  service_values <- unique(as.character(plan$data[[service_col]]))
  service_values <- service_values[!is.na(service_values) & nzchar(service_values)]
  attr(plan$data[[service_col]], "labels") <- stats::setNames(service_values, service_values)
  for (section in setdiff(names(plan$secciones), "Servicios evaluados")) {
    for (v in plan$secciones[[section]]) {
      old_label <- as.character(attr(plan$data[[v]], "label", exact = TRUE) %||% v)
      attr(plan$data[[v]], "label") <- sprintf("%s — %s", section, old_label)
    }
  }

  keep <- unique(as.character(unlist(plan$secciones, use.names = FALSE)))
  keep <- intersect(keep, names(plan$data))
  out <- plan$data[, keep, drop = FALSE]
  preserved <- setdiff(names(attributes(plan$data)), c("names", "row.names", "class"))
  for (a in preserved) attr(out, a) <- attr(plan$data, a)

  trim_inst <- function(df) {
    if (!is.data.frame(df) || !("name" %in% names(df))) return(df)
    df[as.character(df$name) %in% keep, , drop = FALSE]
  }
  plan$inst$survey <- trim_inst(plan$inst$survey)
  if (!is.null(plan$inst$survey_raw)) plan$inst$survey_raw <- trim_inst(plan$inst$survey_raw)
  plan$data <- out
  plan
}
