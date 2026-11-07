# =============================================================================
# graficos_cierre_hallazgos.R — el cierre con hallazgos del resumen ejecutivo (ADR 0135, punto 6)
# =============================================================================
#
# De tres a cinco hallazgos `{lamina, cifra, texto}`. La cifra es una REFERENCIA VIVA: `lamina` es el id de la lámina de
# origen en el plan y `cifra` la clave estable de una de sus cifras (graficos_cifras_clave.R). Al exportar, el cierre
# busca esa lámina en el plan del motor, la renderiza con el mismo despachador que la dibuja (`.render_element` de
# `reporte_ppt_plan`, con sus presets) y lee la cifra de su especificación: nunca la recalcula aparte. El texto lo escribe
# el analista.
#
# Si la lámina de origen ya no está, o ya no tiene esa cifra, el hallazgo sale con su aviso en la tarjeta y sin cifra:
# no se inventa. Si el hallazgo guarda la cifra que se leyó al escribir el texto (`cifra_al_escribir`) y la de hoy es
# otra, la tarjeta lo dice.
#
# El id de cada lámina llega al motor en `meta$lamina_id`: los rearmados del plan JSON lo copian de `s$id`
# (`.graficos_slide_con_id`, graficos_slide_meta.R). En un plan escrito en R se declara igual: `meta = list(lamina_id =
# "...")`.
#
# Se engancha por convención (`.render_cierre_hallazgos`, lámina nativa en lamina_cierre_hallazgos.R): reporte_plan_ppt.R
# no crece.

.CIERRE_HALLAZGOS_MAX <- 5L
.CIERRE_HALLAZGOS_MIN <- 3L
.CIERRE_SIN_ORIGEN <- "La lámina de origen ya no está."
.CIERRE_SIN_CIFRA <- "La cifra ya no está en su lámina de origen."

#' Normaliza los hallazgos del payload: lista de `{lamina, cifra, texto, cifra_al_escribir?}`
#' @keywords internal
.cierre_hallazgos_normalizar <- function(hallazgos) {
  hs <- .dif_lista_registros(hallazgos %||% list(), c("lamina", "cifra", "texto"))
  if (is.data.frame(hs)) hs <- lapply(seq_len(nrow(hs)), function(i) as.list(hs[i, , drop = FALSE]))
  chr <- function(x) { v <- as.character(unlist(x %||% ""))[1]; if (is.na(v)) "" else trimws(v) }
  hs <- lapply(hs, function(h) {
    h <- as.list(h)
    list(lamina = chr(h$lamina), cifra = chr(h$cifra), texto = chr(h$texto), cifra_al_escribir = chr(h$cifra_al_escribir))
  })
  Filter(function(h) nzchar(h$lamina) || nzchar(h$cifra) || nzchar(h$texto), hs)
}

#' Cierre con hallazgos: de tres a cinco cifras tomadas de otras láminas del mazo, cada una con la frase del analista
#'
#' @param hallazgos Lista de `list(lamina, cifra, texto)`: `lamina` es el id de la lámina de origen en el plan,
#'   `cifra` la clave de una de sus cifras («diferencia:Biblioteca», «mediana:Docentes», «tasa:Estudiantes»…) y `texto`
#'   la frase del analista. `cifra_al_escribir` (opcional) es la cifra que se leyó al escribir la frase.
#' @param titulo Título de la lámina.
#' @param etiqueta Antetítulo; «Resumen ejecutivo» por defecto.
#' @param base Nota de base, texto.
#' @param meta Metadatos de la lámina.
#' @family reporte
#' @export
p_slide_cierre_hallazgos <- function(hallazgos = list(), titulo = NULL, etiqueta = NULL, base = NULL, meta = list()) {
  .ppt_chk_meta(meta)
  hs <- .cierre_hallazgos_normalizar(hallazgos)
  if (!length(hs)) .plan_spec_abort("Cierre con hallazgos: escribe al menos un hallazgo con su lámina, su cifra y su frase.")
  if (length(hs) > .CIERRE_HALLAZGOS_MAX) .plan_spec_abort("Cierre con hallazgos: van de tres a cinco hallazgos y llegaron ", length(hs), ".")
  etiqueta <- .ppt_norm_text1(etiqueta, blank = NULL) %||% "Resumen ejecutivo"
  meta$antetitulo <- meta$antetitulo %||% etiqueta
  el <- list(.element_type = "cierre_hallazgos", hallazgos = hs, overrides = list())
  class(el) <- c("ppt_element", "list")
  p_slide_1_grafico(el, titulo = titulo %||% "Principales hallazgos", base = base, meta = meta)
}

#' La lámina del plan con ese id (`meta$lamina_id`), o `NULL`
#' @keywords internal
.cierre_buscar_lamina <- function(plan, id) {
  if (!nzchar(id %||% "")) return(NULL)
  for (s in plan %||% list()) if (identical(as.character((s$meta %||% list())$lamina_id %||% "")[1], id)) return(s)
  NULL
}

#' La especificación que dibuja una lámina de origen: su gráfico renderizado por el despachador del motor
#'
#' `render` es `.render_element` de `reporte_ppt_plan` (mismos presets que la lámina); sin motor, el renderer por
#' convención con el preset de fábrica. Una lámina de cierre no se toma como origen.
#' @keywords internal
.cierre_espec_de_lamina <- function(slide, render = NULL) {
  slots <- slide$slots %||% list()
  els <- Filter(function(x) inherits(x, "ppt_element") && !identical(x$.element_type, "cierre_hallazgos"),
                c(list(slots$plot), slots[setdiff(names(slots), "plot")]))
  for (el in els) {
    p <- tryCatch(if (is.function(render)) render(el) else get(paste0(".render_", el$.element_type), mode = "function")(el),
                  error = function(e) NULL)
    esp <- attr(p, "pulso_espec", exact = TRUE)
    if (length(.cifras_clave(esp))) return(esp)
  }
  NULL
}

#' Resuelve cada hallazgo contra el plan: su cifra leída de la lámina de origen, o su aviso
#' @return Lista de `list(texto, cifra, unidad, rotulo, valor, aviso)`.
#' @keywords internal
.cierre_resolver <- function(hallazgos, plan, render = NULL) {
  cache <- list()
  lapply(hallazgos, function(h) {
    out <- list(texto = h$texto, cifra = NULL, unidad = "", rotulo = "", valor = NULL, aviso = NULL, lamina = h$lamina, clave = h$cifra)
    s <- .cierre_buscar_lamina(plan, h$lamina)
    if (is.null(s)) { out$aviso <- .CIERRE_SIN_ORIGEN; return(out) }
    if (is.null(cache[[h$lamina]])) cache[[h$lamina]] <<- list(cifras = .cifras_clave(.cierre_espec_de_lamina(s, render)))
    cs <- cache[[h$lamina]]$cifras
    c1 <- Filter(function(cf) identical(cf$clave, h$cifra), cs)
    if (!length(c1)) { out$aviso <- .CIERRE_SIN_CIFRA; return(out) }
    c1 <- c1[[1]]
    out$cifra <- c1$texto; out$unidad <- c1$unidad; out$rotulo <- c1$rotulo; out$valor <- c1$valor
    if (nzchar(h$cifra_al_escribir) && !identical(h$cifra_al_escribir, c1$texto)) {
      out$aviso <- sprintf("La cifra cambió desde que se escribió el texto: era %s y hoy es %s.", h$cifra_al_escribir, c1$texto)
    }
    out
  })
}

#' Especificación del cierre (`cierre_hallazgos/1`)
#' @keywords internal
.espec_cierre_hallazgos <- function(resueltos) {
  avisos <- character(0)
  n <- length(resueltos)
  if (n < .CIERRE_HALLAZGOS_MIN) avisos <- c(avisos, sprintf("El cierre lleva de tres a cinco hallazgos y tiene %d.", n))
  for (r in resueltos) if (!is.null(r$aviso)) avisos <- c(avisos, sprintf("«%s»: %s", r$texto, r$aviso))
  list(version = "cierre_hallazgos/1", tipo = "cierre_hallazgos", hallazgos = resueltos, avisos = unique(avisos))
}

#' Renderer del motor: resuelve las referencias vivas y devuelve el respaldo ggplot con la especificación
#' @keywords internal
.render_cierre_hallazgos <- function(el, preset_args = list()) {
  plan <- .dif_plan_render()   # antes de cualquier otra llamada: dentro, `plan` es una promesa y dynGet la encontraría
  # La vista previa de una sola lámina: su mini-plan no tiene las de origen, que llegan rearmadas por opción (detrás: en
  # el export manda el plan del motor).
  plan <- c(plan, getOption("prosecnur.cierre_plan", list()))
  render <- dynGet(".render_element", ifnotfound = NULL)
  esp <- .espec_cierre_hallazgos(.cierre_resolver(el$hallazgos %||% list(), plan, if (is.function(render)) render else NULL))
  for (a in esp$avisos) warning(paste0("Cierre con hallazgos: ", a), call. = FALSE)
  .cierre_ggplot(esp)
}

#' Respaldo en ggplot (Word y `motor_nativo = FALSE`): una fila por hallazgo con su cifra y su frase
#' @keywords internal
.cierre_ggplot <- function(esp) {
  hs <- esp$hallazgos
  etq <- vapply(hs, function(h) {
    cifra <- if (is.null(h$cifra)) "—" else paste(c(h$cifra, if (nzchar(h$unidad) && !grepl("%$", h$cifra)) h$unidad), collapse = " ")
    paste0(cifra, "  ", h$texto, if (!is.null(h$aviso)) paste0("\n(", h$aviso, ")") else "")
  }, "")
  df <- data.frame(y = rev(seq_along(etq)), etq = etq, stringsAsFactors = FALSE)
  p <- ggplot2::ggplot(df, ggplot2::aes(x = 0, y = .data$y, label = .data$etq)) +
    ggplot2::geom_text(hjust = 0, size = 4, colour = .std_color("azul")) +
    ggplot2::scale_x_continuous(limits = c(0, 1)) + ggplot2::theme_void()
  attr(p, "pulso_espec") <- esp
  p
}

#' Láminas de origen de un cierre para la vista previa de una sola lámina (el mini-plan no tiene las demás)
#'
#' @param slide_json La lámina de cierre como la manda el editor.
#' @param plan_slides Las láminas del plan del editor.
#' @param rearmar Función que rearma una lámina JSON como objeto del DSL.
#' @return Lista de `ppt_slide` con su `meta$lamina_id` (las que el cierre referencia y se pudieron rearmar).
#' @keywords internal
.cierre_plan_preview <- function(slide_json, plan_slides, rearmar) {
  if (!identical(as.character(slide_json$tipo %||% "")[1], "p_slide_cierre_hallazgos")) return(list())
  hs <- .cierre_hallazgos_normalizar((slide_json$payload %||% list())$hallazgos)
  ids <- unique(vapply(hs, `[[`, "", "lamina"))
  out <- list()
  for (s in plan_slides %||% list()) {
    id <- as.character(s$id %||% "")[1]
    if (is.na(id) || !id %in% ids || identical(as.character(s$tipo %||% "")[1], "p_slide_cierre_hallazgos")) next
    r <- tryCatch(rearmar(s), error = function(e) NULL)
    if (inherits(r, "ppt_slide")) out[[length(out) + 1L]] <- .graficos_slide_con_id(r, id)
  }
  out
}
