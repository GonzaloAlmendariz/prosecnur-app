# collection_mail_checks.R — chequeos de imágenes y de contraste de la
# revisión del correo (ADR 0110 §B y E1g §1/§3).
#
# Cada chequeo trae `code`, `status` (ok | warning | error), su cifra (`value`)
# y, cuando se ve en un lugar del correo, `targets: [{block_id, prop?}]`
# (`__cabecera` es la cabecera).

.CMAIL_BANNER_W <- 1200L
.CMAIL_BANNER_H <- 600L
.CMAIL_BANNER_MAX_BYTES <- 1024L * 1024L

.cmail_target <- function(block_id, prop = NULL) .cmc_drop_nulls_deep(list(block_id = block_id, prop = prop))

# Imágenes de la plantilla con dónde se ven: cabecera e imágenes de bloque.
.cmail_image_uses <- function(tpl) {
  uses <- list()
  h <- tpl$header %||% list()
  head_ids <- if (identical(h$kind, "banner")) as.character(h$image_ref) else
    as.character(unlist(h$logo_ids %||% list(), use.names = FALSE))
  for (id in head_ids) {
    uses[[length(uses) + 1L]] <- list(id = id, target = .cmail_target("__cabecera"),
                                      alt = .cmail_one((tpl$images %||% list())[[id]]$alt) %||% "")
  }
  for (b in tpl$blocks %||% list()) {
    if (!identical(b$type, "image")) next
    uses[[length(uses) + 1L]] <- list(id = as.character(.cmail_one(b$image_ref) %||% ""),
                                      target = .cmail_target(as.character(b$block_id), "alt"),
                                      alt = .cmail_one(b$alt) %||% "", block = b)
  }
  uses
}

#' Chequeos de imagen. `push` agrega un chequeo a la lista de la revisión.
#' @keywords internal
.cmail_image_checks <- function(tpl, images, html, html_bytes, push) {
  # Alojamiento: cada imagen tiene URL https o va dentro del ZIP importable.
  data_uris <- lengths(regmatches(html, gregexpr("data:[a-z]+/", html)))
  in_zip <- vapply(images, function(i) is.null(i$url) && !is.null(i$path), NA)
  push(if (data_uris > 0L) {
    .cmail_check("images_hosted", "error", as.integer(data_uris), "Hay imágenes incrustadas (data:); deben ir alojadas.")
  } else {
    .cmail_check("images_hosted", "ok", as.integer(sum(in_zip)),
                 sprintf("%d imágenes van en %s (Mailchimp las sube al importar) y %d tienen URL pública.",
                         as.integer(sum(in_zip)), .CMAIL_IMPORT_ZIP_NAME, as.integer(sum(!in_zip & vapply(images, function(i) !is.null(i$url), NA)))))
  })

  uses <- .cmail_image_uses(tpl)
  missing <- vapply(images, function(i) is.null(i$path) && is.null(i$url), NA)
  miss_ids <- names(images)[missing]
  push(if (any(missing)) {
    .cmail_check("images_available", "error", as.integer(sum(missing)),
                 "Imágenes que no están en el proyecto ni tienen URL.", extra = as.list(miss_ids),
                 targets = lapply(Filter(function(u) u$id %in% miss_ids, uses), `[[`, "target"))
  } else {
    .cmail_check("images_available", "ok", 0L, "Todas las imágenes están disponibles.")
  })

  no_alt <- Filter(function(u) !nzchar(trimws(u$alt)), uses)
  push(if (length(no_alt)) {
    .cmail_check("images_alt", "error", length(no_alt), "Imágenes sin texto alternativo.",
                 extra = as.list(unique(vapply(no_alt, `[[`, "", "id"))), targets = lapply(no_alt, `[[`, "target"))
  } else {
    .cmail_check("images_alt", "ok", 0L, "Toda imagen lleva texto alternativo.")
  })

  # Nitidez: el ancho mostrado a 2x no debe pasar el natural.
  blurry <- list()
  for (u in Filter(function(u) !is.null(u$block), uses)) {
    natural <- images[[u$id]]$size$width
    if (is.null(natural)) next
    shown <- .cmail_image_width(u$block, images[[u$id]])
    if (shown * 2L > natural) {
      blurry[[length(blurry) + 1L]] <- list(id = u$id, block_id = u$target$block_id, width = shown, natural = as.integer(natural))
    }
  }
  if (any(vapply(uses, function(u) !is.null(u$block), NA))) {
    push(if (length(blurry)) {
      .cmail_check("image_width", "warning", length(blurry),
                   "Imágenes mostradas a más de la mitad de su ancho natural: se verán borrosas en pantallas de alta densidad.",
                   extra = blurry, targets = lapply(blurry, function(x) .cmail_target(x$block_id, "width")))
    } else {
      .cmail_check("image_width", "ok", 0L, "Cada imagen tiene resolución para mostrarse a 2x.")
    })
  }

  heavy <- Filter(function(i) isTRUE(i$bytes > .CMAIL_IMAGE_WARN_BYTES), images)
  if (length(heavy)) {
    push(.cmail_check("image_weight", "warning", length(heavy),
                      "Imágenes de más de 200 KB: tardan en cargar en el teléfono.",
                      extra = lapply(heavy, function(i) list(id = i$id, size_bytes = as.integer(i$bytes)))))
  }

  est <- .cmail_import_zip_estimate(html_bytes, images)
  push(if (est$bytes >= .CMAIL_IMPORT_ZIP_MAX) {
    .cmail_check("import_zip_weight", "error", est$bytes,
                 "El ZIP importable pesaría 1 MB o más y Mailchimp lo rechaza. Da una URL https a las imágenes más pesadas: las que tienen URL no entran al ZIP.",
                 extra = est$images)
  } else if (est$bytes > .CMAIL_IMPORT_ZIP_WARN) {
    .cmail_check("import_zip_weight", "warning", est$bytes,
                 "El ZIP importable se acerca a 1 MB (el tope de Mailchimp). Considera dar una URL https a las imágenes más pesadas.",
                 extra = est$images)
  } else {
    .cmail_check("import_zip_weight", "ok", est$bytes, "El ZIP importable queda bajo 1 MB.", extra = est$images)
  })

  if (identical(tpl$header$kind, "banner")) {
    img <- images[[as.character(tpl$header$image_ref)]]
    size <- img$size
    push(if (is.null(size)) {
      .cmail_check("banner_size", if (is.null(img$url)) "error" else "warning", NULL,
                   "No se pudo medir el banner (se espera una imagen de 1200 × 600 en el proyecto).",
                   targets = list(.cmail_target("__cabecera")))
    } else if (!identical(as.integer(size$width), .CMAIL_BANNER_W) || !identical(as.integer(size$height), .CMAIL_BANNER_H)) {
      .cmail_check("banner_size", "error", sprintf("%d×%d", as.integer(size$width), as.integer(size$height)),
                   "El banner de mailing mide 1200 × 600.", targets = list(.cmail_target("__cabecera")))
    } else if (isTRUE(img$bytes > .CMAIL_BANNER_MAX_BYTES)) {
      .cmail_check("banner_size", "warning", as.integer(img$bytes), "El banner supera 1 MB; tarda en cargar.")
    } else {
      .cmail_check("banner_size", "ok", "1200×600", "Banner de 1200 × 600.")
    })
  }
  push
}

#' Contraste del texto blanco sobre el acento (botón sólido, cabecera oscura).
#' Bajo 4,5:1 avisa; bajo 3:1 bloquea.
#' @keywords internal
.cmail_accent_check <- function(tpl) {
  accent <- .cmail_one(tpl$theme$accent) %||% .CMAIL_DEFAULT_ACCENT
  targets <- list()
  if (identical(tpl$header$kind, "logos") && identical(tpl$header$background %||% "light", "dark")) {
    targets[[length(targets) + 1L]] <- .cmail_target("__cabecera")
  }
  for (b in tpl$blocks %||% list()) {
    if (identical(b$type, "button") && identical(.cmail_style(b, "fill", "solido"), "solido")) {
      targets[[length(targets) + 1L]] <- .cmail_target(as.character(b$block_id))
    }
  }
  ratio <- round(.cmail_contrast("#ffffff", accent), 2)
  if (!length(targets)) {
    return(.cmail_check("accent_contrast", "ok", ratio, "Ningún texto blanco va sobre el acento."))
  }
  if (ratio < 3) {
    .cmail_check("accent_contrast", "error", ratio,
                 sprintf("El texto blanco sobre el acento %s tiene contraste %.2f:1 (mínimo 3:1); elige un acento más oscuro.", accent, ratio),
                 targets = targets)
  } else if (ratio < 4.5) {
    .cmail_check("accent_contrast", "warning", ratio,
                 sprintf("El texto blanco sobre el acento %s tiene contraste %.2f:1; se recomienda 4,5:1.", accent, ratio),
                 targets = targets)
  } else {
    .cmail_check("accent_contrast", "ok", ratio, sprintf("Contraste del texto blanco sobre el acento: %.2f:1.", ratio))
  }
}
