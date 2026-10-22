# collection_mail_trae_logos.R — banners que ya traen los logos incrustados.
#
# Pedido de Gonzalo (2026-10-22): «a veces el logo puede venir en el banner»,
# «a veces sí viene con logos a veces no». La app no lo adivina mirando la
# imagen: lo declara el usuario por imagen con `template.images[id].trae_logos`
# (lógico opcional, ampliación sin cambio de esquema). Ausente = «no se sabe».
#
# Chequeo de revisión `logos_duplicados` (AVISO, no error: el usuario puede
# querer las dos cosas). Salta cuando la cabecera es la franja de logos
# (`header.kind == "logos"`) y además se muestra una imagen con
# `trae_logos: true` en la cabecera (entre los `logo_ids` de la franja) o como
# imagen a sangre (bloque `image` con `bleed: true`). Con `header.kind ==
# "banner"` y un banner que trae los logos no hay aviso: es el caso correcto.
# El render no cambia; esto es solo dato y chequeo.
#
# Con los banners reales de Acreditación PUCP 2026 («Ejemplos banner/»):
#   - Contabilidad MAILLING (1200 × 810) trae la fila de logos de los
#     organizadores incrustada abajo: `trae_logos: true`. Como cabecera banner,
#     sin aviso; a sangre bajo la franja de logos, aviso.
#   - Derecho Encabezado (3201 × 1801) trae los logos arriba: `trae_logos:
#     true`, mismos dos casos que Contabilidad.
#   - FG FAD (1200 × 600 y 960 × 400) no trae logos: queda sin ese dato (o
#     `false`) y nunca avisa. Es el correo de Acreditación que se envió: franja
#     de logos oscura con Pulso y debajo el banner FG a sangre.

.CMAIL_TRAE_LOGOS_DETAIL <- "Los logos podrían salir dos veces: el banner ya los trae y además está la franja de logos."

.cmail_trae_logos_flag_ok <- function(x) {
  v <- unlist(x)
  length(v) == 1L && is.logical(v) && !is.na(v)
}

# Problema de validación de `images[id].trae_logos` (lista vacía si está bien o ausente).
.cmail_trae_logos_problems <- function(img, path) {
  if (is.null(img$trae_logos) || .cmail_trae_logos_flag_ok(img$trae_logos)) return(list())
  list(.cmail_problem(paste0(path, ".trae_logos"), "bad_flag", "trae_logos es verdadero o falso."))
}

# Normaliza el flag de cada imagen a un lógico escalar (el JSON lo trae en caja).
.cmail_trae_logos_normalize <- function(images) {
  if (!is.list(images) || !length(images)) return(images)
  for (id in names(images)) {
    img <- images[[id]]
    if (is.list(img) && !is.null(img$trae_logos) && .cmail_trae_logos_flag_ok(img$trae_logos)) {
      images[[id]]$trae_logos <- isTRUE(unlist(img$trae_logos))
    }
  }
  images
}

.cmail_trae_logos_true <- function(tpl, id) {
  img <- (tpl$images %||% list())[[id]]
  is.list(img) && isTRUE(unlist(img$trae_logos))
}

#' Chequeo `logos_duplicados`: NULL cuando no aplica (no se publica un «ok»).
#' @keywords internal
.cmail_logos_duplicados_check <- function(tpl) {
  h <- tpl$header %||% list()
  if (!identical(.cmail_one(h$kind), "logos")) return(NULL)
  ids <- character(0)
  targets <- list()
  head_ids <- as.character(unlist(h$logo_ids %||% list(), use.names = FALSE))
  head_hit <- Filter(function(id) .cmail_trae_logos_true(tpl, id), head_ids)
  if (length(head_hit)) ids <- c(ids, head_hit)
  # La franja siempre se señala: es la otra mitad de la duplicación.
  for (b in tpl$blocks %||% list()) {
    if (!is.list(b) || !identical(b$type, "image") || !isTRUE(unlist(b$bleed))) next
    id <- as.character(.cmail_one(b$image_ref) %||% "")
    if (!nzchar(id) || !.cmail_trae_logos_true(tpl, id)) next
    ids <- c(ids, id)
    targets[[length(targets) + 1L]] <- .cmail_target(as.character(b$block_id))
  }
  if (!length(ids)) return(NULL)
  ids <- unique(ids)
  .cmail_check("logos_duplicados", "warning", length(ids), .CMAIL_TRAE_LOGOS_DETAIL,
               extra = as.list(ids), targets = c(list(.cmail_target("__cabecera")), targets))
}
