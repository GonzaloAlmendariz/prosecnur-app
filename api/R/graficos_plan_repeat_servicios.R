# =============================================================================
# Apertura POR SERVICIO del plan de Gráficos para bases hija repeat (ADR 0030).
# =============================================================================
#
# Contexto. Una base hija de un `begin_repeat` a grano de INSTANCIA (p.ej.
# `rep_servicios`, 668 filas de servicio aportadas por 427 personas) agrupa sus
# preguntas nativas (`srv_*`) sobre TODAS las instancias mezclando servicios. En
# ACNUR eso es metodológicamente incorrecto: cada `srv_*` evalúa un servicio
# concreto y debe leerse POR SERVICIO, con el NOMBRE del servicio como título.
#
# Diseño (acordado, evita tocar el motor PPT congelado). El render de Gráficos
# aplica FILTROS por valor por lámina (`filtros = list(current_code = <código>)`,
# que `p_barras_*` resuelven contra la data de la fuente). Por eso NO creamos
# columnas sintéticas (como hace el frecuencias/entregable): para cada servicio S
# emitimos sus `srv_*` con `filtros = list(current_code = <código de S>)` bajo una
# sección titulada con el `current_label` de S. El motor PPT lo renderiza sin
# cambios.
#
# Reusa la maquinaria canónica de `entregables_repeats.R`
# (`.repeat_service_labels_from_raw`, `.repeat_native_tabulable_vars`,
# `.repeat_strip_inherited`) — no la reimplementa. Espeja la integración de
# `analitica_frecuencias_export.R`.
#
# Este archivo lo invoca `.graficos_suggested_plan` con una línea; la lógica no
# engorda `graficos_plan_coverage.R`.

# --- P2: título seguro (nunca el ref técnico `rep_servicios$srv_*`) ----------

#' Título editorial de una `srv_*` bajo un servicio. Cadena de fallback: label ya
#' resuelto de la pregunta → label original sin el token `${current_label}` →
#' nombre del servicio (sección). NUNCA cae al `ref` crudo, que expondría
#' `rep_servicios$srv_*`.
#' @keywords internal
.graficos_repeat_service_var_title <- function(v, service_label) {
  lbl <- .graficos_scalar_chr(v$label, "")
  if (!nzchar(lbl)) {
    lbl <- .graficos_clean_dynamic_label(.graficos_scalar_chr(v$label_original, ""))
  }
  if (!nzchar(lbl)) lbl <- .graficos_scalar_chr(service_label, "")
  lbl
}

#' Nota de base por servicio. Reusa el N ya calculado por la semantics ACNUR sobre
#' el subconjunto del servicio (refleja el N del servicio, no el pooled 668) y
#' anexa el nombre del servicio para dejar explícito a qué servicio corresponde.
#' @keywords internal
.graficos_repeat_service_note <- function(base_note, label) {
  base_note <- .graficos_scalar_chr(base_note, "")
  label <- .graficos_scalar_chr(label, "")
  if (!nzchar(base_note) || !nzchar(label)) return(base_note)
  paste0(sub("[.]\\s*$", "", base_note), " · ", label, ".")
}

#' Orden de servicios por frecuencia (desc), estable ante empates por primer
#' avistamiento. Devuelve una lista de `list(code, label, n)`; el `label` de cada
#' código es la primera etiqueta no vacía de sus filas.
#' @keywords internal
.graficos_repeat_service_order <- function(svc_code, svc_label) {
  code <- as.character(svc_code)
  label <- as.character(svc_label)
  keep <- !is.na(code) & nzchar(code)
  if (!any(keep)) return(list())
  uniq <- unique(code[keep])
  counts <- vapply(uniq, function(c) sum(keep & code == c), integer(1))
  labels <- vapply(uniq, function(c) {
    ls <- label[keep & code == c]
    ls <- ls[!is.na(ls) & nzchar(ls)]
    if (length(ls)) ls[[1L]] else ""
  }, character(1))
  # `order` es estable: los empates conservan el orden de `uniq` (primer avistamiento).
  ord <- order(-counts)
  lapply(ord, function(i) list(code = uniq[[i]], label = labels[[i]], n = counts[[i]]))
}

#' NÚCLEO puro (sin sesión) de la apertura por servicio. Dado el vector de servicio
#' por fila (`svc_code`/`svc_label`), las variables nativas `vars` (con metadata de
#' graficabilidad) y la `data`, construye las láminas: una sección por servicio
#' (título = nombre del servicio) y, dentro, una lámina por `srv_*` que APLICA a
#' ese servicio (tiene respuestas en sus filas), filtrada por `current_code`.
#'
#' `semantics_fn(v, code, mask, label)` devuelve `list(note, exclude_options,
#' source_note)` para la lámina; se inyecta para poder testear sin sesión. Reglas
#' de borde cubiertas: servicio sin label → sin sección (no crea "" ); `srv_*`
#' toda-NA en el servicio → sin lámina; título nunca al ref técnico (P2).
#' @keywords internal
.graficos_repeat_service_slides_core <- function(vars, data, svc_code, svc_label,
                                                 ref_prefix = "", profile_id = "",
                                                 categories_per_slide = 8L,
                                                 semantics_fn = NULL) {
  if (!is.data.frame(data) || !length(vars)) return(list())
  svc_code <- as.character(svc_code)
  order <- .graficos_repeat_service_order(svc_code, svc_label)
  slides <- list()
  for (svc in order) {
    code <- svc$code
    label <- svc$label
    if (!nzchar(label)) next  # borde: no crear sección ""
    mask <- !is.na(svc_code) & svc_code == code
    if (!any(mask)) next
    graphs <- list()
    for (v in vars) {
      name <- .graficos_scalar_chr(v$name, "")
      if (!nzchar(name) || !(name %in% names(data))) next
      # Esta srv_ sólo aplica al servicio si tiene alguna respuesta en sus filas.
      if (!any(!.graficos_is_blank_cell(data[[name]][mask]))) next
      ref <- if (nzchar(ref_prefix)) paste0(ref_prefix, "$", name) else name
      sem <- if (is.function(semantics_fn)) {
        semantics_fn(v, code, mask, label)
      } else {
        list(note = "", exclude_options = NULL, source_note = "")
      }
      title <- .graficos_repeat_service_var_title(v, label)
      choice_pages <- .graficos_acnur_choice_pages(v, max_per_slide = categories_per_slide)
      for (page_spec in choice_pages) {
        page_excl <- .graficos_collect_strings(page_spec$exclude_options %||% NULL)
        graphs[[length(graphs) + 1L]] <- list(
          title = title,
          source_note = .graficos_scalar_chr(sem$source_note, ""),
          graf = .graficos_chart_for_var(
            v,
            ref,
            profile_id = profile_id,
            base_label = .graficos_scalar_chr(sem$note, ""),
            exclude_options = unique(c(sem$exclude_options, page_excl)),
            filtros = list(current_code = code),
            subtitulo = .graficos_acnur_page_subtitle("", page_spec)
          )
        )
      }
    }
    if (!length(graphs)) next
    slides <- .graficos_add_section_slide(slides, label)
    slides <- c(slides, .graficos_pack_acnur_graphs(graphs))
  }
  slides
}

#' Orquestador con sesión: prepara servicio + variables nativas y delega en el
#' núcleo. Devuelve `list(slides, handled = TRUE)` si abrió por servicio, o `NULL`
#' para DEGRADAR al comportamiento pooled (grano instancia) del caller — nunca
#' rompe. Sólo actúa en perfil ACNUR sobre fuentes hija a grano de instancia.
#' @keywords internal
.graficos_repeat_service_plan <- function(sid, source, vars, ctx, profile_id,
                                          categories_per_slide = 8L) {
  if (!identical(.graficos_scalar_chr(profile_id, ""), "acnur_kobo_cruncher_plus")) return(NULL)
  # `ctx$is_repeat` es la señal canónica de base hija repeat (base con
  # parent_base/repeat_group, o grano de instancia). El runtime de Gráficos no
  # siempre adjunta `attr(inst,"repeat_grain")`, así que no exigimos `kind`
  # poblado; la resolución del servicio (columna `current_label`) es el guard real.
  if (!is.list(ctx) || !isTRUE(ctx$is_repeat)) return(NULL)
  grain <- attr(ctx$inst, "repeat_grain", exact = TRUE) %||%
    (ctx$inst %||% list())$repeat_grain %||% list()
  data <- ctx$data
  if (!is.data.frame(data) || !nrow(data)) return(NULL)

  base_name <- .graficos_scalar_chr(grain$base_name %||% grain$repeat_group, "")
  if (!nzchar(base_name)) base_name <- .graficos_scalar_chr(source, "")

  # Servicio (código y nombre) por fila, re-anclado desde la data cruda con la
  # maquinaria canónica de entregables_repeats. NULL en cualquiera de los dos =>
  # degradar (no se puede resolver el servicio).
  svc_code <- .repeat_service_labels_from_raw(sid, base_name, data, "current_code")
  svc_label <- .repeat_service_labels_from_raw(sid, base_name, data, "current_label")
  if (is.null(svc_code) || is.null(svc_label)) return(NULL)

  # P3: quitar heredadas de la madre y quedarnos con las nativas tabulables del
  # bloque; intersectar con las `vars` graficables ya filtradas por el caller.
  stripped <- .repeat_strip_inherited(data, ctx$inst)
  native <- .repeat_native_tabulable_vars(
    stripped$data, stripped$inst,
    exclude = c("current_label", "current_code")
  )
  vars_native <- Filter(function(v) .graficos_scalar_chr(v$name, "") %in% native, vars)
  if (!length(vars_native)) return(NULL)

  # Nota de base POR SERVICIO: semantics ACNUR sobre el subconjunto del servicio.
  semantics_fn <- function(v, code, mask, label) {
    ctx_s <- ctx
    ctx_s$data <- data[mask, , drop = FALSE]
    sem <- .graficos_acnur_question_semantics(sid, source, v, ctx = ctx_s)
    sem$note <- .graficos_repeat_service_note(sem$note, label)
    sem
  }

  ref_prefix <- if (identical(.graficos_scalar_chr(source, "default"), "default")) "" else source
  slides <- .graficos_repeat_service_slides_core(
    vars_native, data, svc_code, svc_label,
    ref_prefix = ref_prefix,
    profile_id = profile_id,
    categories_per_slide = categories_per_slide,
    semantics_fn = semantics_fn
  )
  if (!length(slides)) return(NULL)
  list(slides = slides, handled = TRUE)
}
