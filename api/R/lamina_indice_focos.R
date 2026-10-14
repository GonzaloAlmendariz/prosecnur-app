# Índice con íconos «de foco» por el motor nativo (F6.4; Gonzalo, 2026-10-09: «en especial para láminas que lo usan como
# el de los íconos del índice»).
#
# La ruta anterior pinta cinco focos (bombillas) fijos de la plantilla con un ícono blanco cada uno, sin relación con el
# número de capítulos. El recetario (31-50) pone un ícono navy por capítulo en la lista, junto a su número y su título.
# Aquí se traducen los ajustes `iconos_focos…` a esa composición:
#
# - `iconos_focos[k]` es el ícono del capítulo k. Un nombre de la biblioteca de íconos va tal cual; uno del catálogo
#   anterior (`ppt_assets/indice_icons`) va por su equivalente del recetario cuando el motivo es el mismo y, si no lo hay,
#   el mismo dibujo del usuario en navy; una ruta a un archivo va tal cual. Lo que no se resuelve se avisa
#   (`[PULSO-AVISO]`) y su capítulo toma la elección automática: nunca se reemplaza en silencio.
# - `mostrar_iconos_focos = FALSE` quita los íconos de la lista.
# - Los ajustes del dibujo del foco (color del círculo, diámetro, escala interna, posición) no tienen equivalente en el
#   recetario —allí el ícono no lleva círculo y su tamaño lo fija la geometría de la lista—: se avisan por nombre.
# - La composición es la que se declare en `meta$composicion`; si el plan pidió focos sin declararla, «círculos» (41):
#   el foco es un círculo con su ícono. `meta$composicion = "focos"` es la elección explícita del estilo de bombillas,
#   que no está en el recetario, y conserva su ruta.

#' Equivalentes del catálogo anterior en la biblioteca de íconos, comprobados a ojo (mismo motivo: diana con flecha,
#' diana, columnas, persona). Los que comparten nombre (`clipboard-list`, `chart-column`, `lightbulb`) no hacen falta.
#' @keywords internal
.LAM_INDICE_ICONOS_EQUIVALENTES <- c(`target-arrow` = "diana-flecha", bullseye = "target", `bar-chart-line-fill` = "chart-column",
                                     `circle-user-round` = "user-round")

#' Ajustes del foco sin equivalente en el recetario (se avisan si traen valor; los lógicos, sólo si valen TRUE)
#' @keywords internal
.LAM_INDICE_FOCOS_SIN_EQUIVALENTE <- c("iconos_focos_fill", "iconos_focos_diametro_cm", "iconos_focos_icon_scale",
                                       "iconos_focos_left_cm", "iconos_focos_top_cm", "iconos_focos_objeto_unico",
                                       "redibujar_focos")

#' ¿El índice conserva la ruta anterior? Sólo si se eligió explícitamente el estilo de focos (`meta$composicion = "focos"`)
#' @keywords internal
.lam_indice_ruta_focos <- function(meta = list()) identical(tolower(as.character(meta$composicion %||% "")[1]), "focos")

#' Composición del índice nativo: la declarada; si no, «círculos» cuando el plan pide focos y «arcos» (la 31) si no
#' @keywords internal
.lam_indice_composicion <- function(slots, meta = list()) {
  declarada <- as.character(meta$composicion %||% "")[1]
  if (!is.na(declarada) && nzchar(declarada)) return(declarada)
  if (.lam_indice_focos(slots)) "circulos" else "arcos"
}

#' Ranuras de íconos por posición: vector, lista de nombres o texto con una por línea (como lo manda la app); los huecos
#' quedan como ""
#' @keywords internal
.lam_indice_ranuras <- function(x) {
  if (is.null(x) || !length(x)) return(character(0))
  if (is.list(x)) x <- vapply(x, function(e) if (is.list(e)) as.character(e$icono %||% e$name %||% e$ruta %||% e$path %||% "")[1] else as.character(e %||% "")[1], "")
  x <- as.character(x); x[is.na(x)] <- ""
  if (length(x) == 1L) x <- strsplit(x, "\r?\n", perl = TRUE)[[1]] %||% ""
  trimws(x)
}

#' Un dibujo blanco del catálogo anterior repintado en el navy de los íconos del recetario
#' @keywords internal
.lam_icono_navy_desde <- function(ruta) {
  navy <- grDevices::col2rgb(.std_color("azul"))[, 1] / 255
  # Un archivo por dibujo de origen, reutilizado: repintar el mismo ícono en cada exportación no acumula temporales en
  # la sesión de Plumber (verificador de 8d6fc3d66).
  out <- file.path(tempdir(), paste0("indice_icono_", unname(tools::md5sum(ruta)), ".png"))
  if (file.exists(out)) return(out)
  if (grepl("\\.svg$", ruta, ignore.case = TRUE)) {
    svg <- tempfile(fileext = ".svg"); on.exit(unlink(svg), add = TRUE); hex <- .std_color("azul")
    txt <- gsub("#FFFFFF|#FFF(?![0-9A-F])", hex, readLines(ruta, warn = FALSE), ignore.case = TRUE, perl = TRUE)
    writeLines(gsub("\"white\"", paste0("\"", hex, "\""), txt, ignore.case = TRUE), svg)
    rsvg::rsvg_png(svg, file = out, width = 512, height = 512)
    return(out)
  }
  p <- png::readPNG(ruta)
  if (length(dim(p)) != 3L || dim(p)[3] != 4L) return(ruta)
  for (k in 1:3) p[, , k] <- navy[k]
  png::writePNG(p, out); out
}

#' Ícono de cada capítulo del índice nativo: lo que eligió el usuario (`meta$iconos` del editor y, si no, `iconos_focos`)
#' resuelto contra la biblioteca; los huecos con la elección automática; "" donde no va ícono
#'
#' @return Vector de largo `length(secciones)` con nombres de la biblioteca o rutas a archivos.
#' @keywords internal
.lam_indice_iconos <- function(slots, meta = list(), secciones) {
  caps <- as.character(secciones); n <- length(caps); estilo <- slots[["estilo"]] %||% list()
  auto <- vapply(caps, .lam_icono_capitulo, "", USE.NAMES = FALSE)
  avisar <- function(...) message("[PULSO-AVISO] Índice: ", ...)
  lleno <- function(x) {
    if (is.logical(x)) return(isTRUE(any(x)))
    !is.null(x) && length(x) && any(!is.na(unlist(x)) & nzchar(trimws(as.character(unlist(x)))))
  }
  # `[[` y no `$`: `$` completa nombres parciales y `slots$iconos_focos` devolvía `iconos_focos_fill` (verificador de 8d6fc3d66).
  sin_eq <- .LAM_INDICE_FOCOS_SIN_EQUIVALENTE[vapply(.LAM_INDICE_FOCOS_SIN_EQUIVALENTE, function(k) lleno(slots[[k]]) || lleno(estilo[[k]]), TRUE)]
  if (length(sin_eq)) avisar("el diseño del índice no dibuja el foco (el ícono va sin círculo y su tamaño lo fija la lista); no se aplica ",
                             paste(sin_eq, collapse = ", "), ".")
  if (identical(slots[["mostrar_iconos_focos"]], FALSE) || identical(estilo[["mostrar_iconos_focos"]], FALSE)) return(rep("", n))
  editor <- .lam_indice_ranuras(meta[["iconos"]]); focos <- .lam_indice_ranuras(slots[["iconos_focos"]] %||% estilo[["iconos_focos"]])
  pedido <- vapply(seq_len(n), function(k) { e <- editor[k] %||% ""; if (is.na(e) || !nzchar(e)) focos[k] %||% "" else e }, "")
  pedido[is.na(pedido)] <- ""
  sobran <- max(length(editor), length(focos)) - n
  if (sobran > 0L) avisar(sobran, if (sobran == 1L) " ícono queda" else " íconos quedan", " sin capítulo (el índice tiene ", n, ").")
  biblioteca <- .lam_iconos_catalogo()$nombres
  anterior <- system.file("ppt_assets", "indice_icons", package = "prosecnurapp")
  vapply(seq_len(n), function(k) {
    p <- pedido[k]
    if (!nzchar(p) || tolower(p) %in% c("plantilla", "template")) return(auto[k])
    if (tolower(p) %in% c("none", "sin_icono", "sin-icono")) return("")
    if (p %in% biblioteca) return(p)
    base <- sub("\\.(svg|png)$", "", p, ignore.case = TRUE)
    if (!is.na(.LAM_INDICE_ICONOS_EQUIVALENTES[base])) return(unname(.LAM_INDICE_ICONOS_EQUIVALENTES[base]))
    if (file.exists(p) && !dir.exists(p)) return(normalizePath(p, winslash = "/"))
    hit <- if (nzchar(anterior)) file.path(anterior, paste0(base, c(".png", ".svg"))) else character(0)
    hit <- hit[file.exists(hit)]
    if (length(hit)) return(.lam_icono_navy_desde(hit[1]))
    avisar("el ícono «", p, "» del capítulo «", caps[k], "» no está en la biblioteca de íconos; va el que elige el motor («",
           auto[k], "»).")
    auto[k]
  }, "")
}

#' Capítulos del informe (separadores de nivel capítulo, en orden) para un índice que no declara los suyos
#'
#' Sin esto, un índice vacío caía a la lámina de la plantilla (cinco bombillas fijas), que no es del recetario.
#' @keywords internal
.lam_indice_capitulos_del_plan <- function(plan) {
  caps <- vapply(plan %||% list(), function(slide) {
    if (!identical(slide$.slide_type, "section") || identical((slide$meta %||% list())$nivel, "subcapitulo")) return(NA_character_)
    trimws(as.character(slide$slots$title %||% slide$title %||% "")[1])
  }, character(1))
  caps[!is.na(caps) & nzchar(caps)]
}
