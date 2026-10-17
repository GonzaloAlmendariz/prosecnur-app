# collection_material_layout_caps.R — qué sabe hacer cada layout con sus bloques
# y dónde cae cada uno en la página (ADR 0109 E1b, «Editor sobre la página real»).
#
# Dos contratos pequeños que el editor necesita y que el validador no da:
#
# 1. `COLLECTION_MATERIAL_LAYOUT_CAPS`: por layout, qué tipos APILA de verdad
#    (`reorder`: moverlos cambia la hoja) y qué propiedades de cada tipo cambian
#    la TINTA (`editable`). Es un subconjunto de `.cm_allowed_block_fields()`:
#    el validador admite campos que el dibujante no lee —`min_size_mm` del QR,
#    el `binding` del pie de la ficha de campo, el del croquis—, y ofrecerlos
#    en el inspector sería prometer un cambio que la imprenta no verá. Cada
#    entrada está medida contra la huella del PNG en
#    `test-collection-render-zonas.R` («la propiedad cambia la tinta»).
#
# 2. Las ZONAS: el rectángulo de página que ocupa cada bloque dibujado. No las
#    calcula nadie aparte: cada `collection_material_draw_*` las arma con las
#    mismas variables con que dibuja y las devuelve junto a `warnings` y
#    `links`. Aquí solo viven el constructor, la recorte a la página y el
#    reparto de solapes, que es geometría común a los cuatro layouts.

COLLECTION_MATERIAL_LAYOUT_CAPS <- list(
  single_sheet = list(
    reorder = c("body", "field_grid", "divider", "instructions", "application_log"),
    editable = list(
      # La careta de texto no la dibuja este layout: la cabecera la pone el
      # título. Editarla no mueve un pixel.
      brand_header = character(0),
      brand_strip = c("assets", "align", "max_height_mm"),
      status_tag = c("text"),
      # `max_lines` no: la cabecera envuelve el título a su ancho propio.
      heading = c("binding", "text"),
      body = c("binding", "text", "max_lines"),
      # `quiet_zone` no: aquí el símbolo mide `qr_side` siempre y la zona de
      # silencio es blanco derramado sobre la hoja; solo el tope de ancho, que
      # este layout no alcanza, la haría visible. `min_size_mm` no lo lee nadie.
      access_qr = c("correction"),
      field_grid = c("fields"),
      divider = character(0),
      instructions = c("binding", "text", "max_lines"),
      application_log = c("text", "rows", "labels"),
      footer = c("binding", "text")
    )
  ),
  field_form = list(
    reorder = character(0),
    editable = list(
      brand_strip = c("assets", "align", "max_height_mm"),
      # `max_lines` no: el título envuelve a 40 caracteres y dos líneas fijas.
      heading = c("binding", "text"),
      access_qr = c("correction", "quiet_zone"),
      form_lines = c("rows"),
      # El pie de la ficha de campo es solo el logo (decisión de Gonzalo,
      # 2026-09-01): ignora su dato.
      footer = character(0)
    )
  ),
  croquis_campus = list(
    reorder = character(0),
    editable = list(
      # El croquis resalta el pabellón del aula de la unidad, se ligue a lo que
      # se ligue el bloque.
      campus_map = character(0),
      footer = character(0)
    )
  ),
  poster_qr = list(
    reorder = c("heading", "body", "divider", "instructions"),
    editable = list(
      brand_strip = c("assets", "align", "max_height_mm"),
      heading = c("binding", "text", "max_lines"),
      body = c("binding", "text", "max_lines"),
      access_qr = c("correction", "quiet_zone"),
      instructions = c("binding", "text", "max_lines"),
      divider = character(0),
      footer = c("binding", "text")
    )
  )
)

#' Propiedades de un bloque que cambian la tinta en un layout.
#'
#' @param layout `layout_preset` de la cara.
#' @param type tipo del bloque.
#' @return vector de nombres de propiedad (vacío si ninguna).
#' @keywords internal
.cmz_editable <- function(layout, type) {
  caps <- COLLECTION_MATERIAL_LAYOUT_CAPS[[as.character(layout %||% "")[1]]]
  if (is.null(caps)) return(character(0))
  as.character(caps$editable[[as.character(type %||% "")[1]]] %||% character(0))
}

#' ¿El layout apila este tipo en el orden de la receta?
#' @keywords internal
.cmz_reorderable <- function(layout, type) {
  caps <- COLLECTION_MATERIAL_LAYOUT_CAPS[[as.character(layout %||% "")[1]]]
  !is.null(caps) && as.character(type %||% "")[1] %in% caps$reorder
}

#' Una zona de página, en npc (origen abajo-izquierda, como grid).
#'
#' @param block_id id del bloque dibujado; `NA` para lo que el layout dibuja
#'   sin bloque propio (enlace impreso, pie o cabecera por defecto).
#' @param kind `block` o `derived`.
#' @keywords internal
.cmz_zone <- function(block_id, type, x0, x1, y0, y1, kind = "block") {
  clamp <- function(v) max(0, min(1, as.numeric(v)))
  list(
    block_id = if (is.null(block_id) || !length(block_id)) NA_character_ else as.character(block_id)[1],
    type = as.character(type)[1],
    kind = kind,
    x0 = clamp(min(x0, x1)), x1 = clamp(max(x0, x1)),
    y0 = clamp(min(y0, y1)), y1 = clamp(max(y0, y1))
  )
}

# Alto en npc que de verdad ocupan `n` lineas de texto a `size` puntos.
#
# No es `n * size * lineheight`: medido sobre el PNG a 110 dpi, grid separa las
# lineas 1.2 veces mas de lo que esa cuenta dice (24 px entre lineas de un
# cuerpo de 11.4 pt con interlineado 1.15, contra 20 px calculados), y la ultima
# linea ocupa su cuerpo entero, no un interlineado. Los planificadores de flujo
# reservan con la cuenta corta; la zona sigue a la tinta.
.cmz_alto_lineas <- function(n, size, lineheight, geo) {
  n <- max(0, as.numeric(n))
  if (n == 0) return(0)
  ((n - 1) * 1.2 * lineheight + 1.05) * (size / 72) / geo$page_h
}

.cmz_area_comun <- function(a, b) {
  w <- min(a$x1, b$x1) - max(a$x0, b$x0)
  h <- min(a$y1, b$y1) - max(a$y0, b$y0)
  if (w <= 0 || h <= 0) 0 else w * h
}

#' Reparte los solapes entre zonas vecinas.
#'
#' La tinta de un bloque no respeta siempre la banda que el flujo le reservó:
#' el segundo renglón de un valor cuelga en el hueco de abajo, la zona de
#' silencio del QR se derrama sobre el papel. Dos zonas que se pisan harían que
#' un clic en el editor cayera en el bloque equivocado, así que el solape se
#' parte por la mitad en el eje vertical —las caras apilan de arriba abajo—.
#' Solo se mueven los bordes que se pisan; nada crece.
#'
#' @param zones lista de `.cmz_zone`.
#' @return la misma lista, sin pares con área común.
#' @keywords internal
.cmz_sin_solapes <- function(zones) {
  n <- length(zones)
  if (n < 2L) return(zones)
  for (pasada in seq_len(4L)) {
    cambio <- FALSE
    for (i in seq_len(n - 1L)) {
      for (j in seq.int(i + 1L, n)) {
        a <- zones[[i]]; b <- zones[[j]]
        if (.cmz_area_comun(a, b) <= 0) next
        arriba <- if ((a$y0 + a$y1) >= (b$y0 + b$y1)) i else j
        abajo <- if (arriba == i) j else i
        up <- zones[[arriba]]; dn <- zones[[abajo]]
        corte <- (up$y0 + dn$y1) / 2
        # Una zona contenida en la otra no tiene borde que partir por la
        # mitad: se corta la de abajo por debajo de la de arriba.
        if (corte <= dn$y0 || corte >= up$y1) corte <- max(dn$y0, min(up$y0, dn$y1))
        up$y0 <- max(up$y0, corte)
        dn$y1 <- min(dn$y1, corte)
        zones[[arriba]] <- up; zones[[abajo]] <- dn
        cambio <- TRUE
      }
    }
    if (!cambio) break
  }
  zones
}

#' Bloques de una cara que el layout no dibujó, con el porqué.
#'
#' Se deduce de las zonas y no de una tabla aparte: si otro bloque del mismo
#' tipo SÍ tiene zona, el sitio estaba ocupado (`slot_taken`); si ninguno del
#' tipo la tiene, el layout no dibuja ese tipo (`not_drawn_by_layout`).
#'
#' @param blocks bloques de la cara, en el orden de la receta.
#' @param zones zonas dibujadas de esa cara.
#' @keywords internal
.cmz_no_dibujados <- function(blocks, zones) {
  dibujados <- unique(stats::na.omit(vapply(zones, function(z) z$block_id %||% NA_character_, character(1))))
  tipos_con_zona <- unique(vapply(Filter(function(z) identical(z$kind, "block"), zones),
                                  function(z) z$type, character(1)))
  out <- list()
  for (b in blocks %||% list()) {
    if (!is.list(b) || !.cc_is_scalar_string(b$block_id)) next
    if (b$block_id %in% dibujados) next
    out[[length(out) + 1L]] <- list(
      block_id = b$block_id,
      type = as.character(b$type %||% "")[1],
      reason = if (as.character(b$type %||% "")[1] %in% tipos_con_zona) "slot_taken" else "not_drawn_by_layout"
    )
  }
  out
}

#' Datos de los que sale la tinta de un bloque, para el inspector.
#'
#' No es el `binding` a secas: la cabecera de la ficha de aula dibuja además la
#' facultad, la grilla lee un dato por campo y el croquis resalta el aula de la
#' unidad aunque el bloque se ligue a otra cosa.
#'
#' @param block bloque de la receta, o `NULL` para una zona derivada.
#' @param layout layout de la cara.
#' @param type tipo de la zona.
#' @keywords internal
.cmz_fills_from <- function(block, layout, type) {
  binding <- if (is.list(block) && .cc_is_scalar_string(block$binding)) block$binding else character(0)
  out <- switch(as.character(type)[1],
    link = "access.qr_payload",
    access_qr = "access.qr_payload",
    campus_map = "unit.venue",
    heading = if (identical(layout, "single_sheet")) c(binding, "unit.faculty") else binding,
    field_grid = vapply(block$fields %||% list(), function(f) {
      if (is.list(f) && !isTRUE(f$blank) && .cc_is_scalar_string(f$binding)) f$binding else NA_character_
    }, character(1)),
    form_lines = unlist(lapply(block$rows %||% list(), function(r) {
      vapply(r$fields %||% list(), function(f) {
        if (is.list(f) && .cc_is_scalar_string(f$binding)) f$binding else NA_character_
      }, character(1))
    }), use.names = FALSE),
    # El registro deja de pedir el aula cuando la unidad ya la trae impresa.
    application_log = "unit.venue",
    footer = if (layout %in% c("field_form", "croquis_campus")) character(0) else if (length(binding)) binding else if (is.null(block)) "project.period" else character(0),
    binding
  )
  out <- as.character(out %||% character(0))
  unique(out[!is.na(out) & nzchar(out)])
}
