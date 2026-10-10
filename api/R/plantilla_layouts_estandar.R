# =============================================================================
# plantilla_layouts_estandar.R — los layouts de la ruta anterior se escriben desde el estándar (K15)
# =============================================================================
#
# Ocho tipos de lámina no tienen renderer nativo: el motor pone cada gráfico (y el texto) en un placeholder de un layout de
# `inst/plantillas/plantilla_16_9.pptx`. Esos placeholders tenían la geometría vieja (la de las fichas del recetario, o
# anterior) y el estándar ya tiene la de las láminas de ejemplo (K15). Aquí está la única correspondencia placeholder ↔
# ranura del estándar; `api/scripts/plantilla_layouts_desde_estandar.R` reescribe los layouts con ella y
# test-plantilla-layouts-estandar.R verifica la conformidad.
#
# El motor elige el placeholder por `type_idx` de officer, que ordena por (y, x). Cada entrada declara el `type_idx` que
# el contrato del motor espera (reporte_plan_helpers.R, reporte_plan_slides.R): en cinco y seis gráficos `pic1` es el
# del centro de arriba y `pic4` el de la derecha de abajo, así que esos placeholders llevan un desempate de hasta 0.002 in en y
# para que el orden siga siendo ése sin tocar el contrato. El ícono del público va a la cabecera, donde lo dibuja el
# recetario (p158, p164, p166: círculo de 0.3 en 0.495, 0.165), 0.015 más abajo para seguir siendo el segundo `body`.

.PLANTILLA_ICONO_CABECERA <- c(x = 0.495, y = 0.18, w = 0.3, h = 0.3)

#' Correspondencia placeholder ↔ ranura del estándar por layout
#'
#' @return Lista nombrada por layout; cada entrada, filas con `idx` (atributo `idx` del placeholder), `tipo` (id del tipo
#'   de lámina) y `ranura` (posición en `ranuras`; `NA` para el ícono), `ph` y `type_idx` (lo que el contrato espera de
#'   officer) y `dy` (desempate en y, pulgadas).
#' @keywords internal
.plantilla_layouts_estandar <- function() {
  f <- function(idx, tipo, ranura, ph, type_idx, dy = 0) data.frame(idx = idx, tipo = tipo, ranura = ranura, ph = ph,
                                                                  type_idx = type_idx, dy = dy, stringsAsFactors = FALSE)
  t3 <- "p_slide_grafico_texto_derecha"; t4 <- "p_slide_grafico_texto_izquierda"; t8 <- "p_slide_2_graficos_texto_izquierda"
  t9 <- "p_slide_2_graficos_texto_derecha"; t11 <- "p_slide_2_graficos_asimetrico"; t16 <- "p_slide_3_graficos_poblacion_tira"
  t19 <- "p_slide_5_graficos_poblacion"; t20 <- "p_slide_6_graficos_poblacion"
  list(
    right_grafico_texto = rbind(f(10, t3, 1, "pic", 1), f(13, t3, 2, "body", 2)),
    left_grafico_texto = rbind(f(13, t4, 1, "body", 2), f(10, t4, 2, "pic", 1)),
    left_2graficos_texto = rbind(f(13, t8, 1, "body", 2), f(10, t8, 2, "pic", 1), f(14, t8, 3, "pic", 2)),
    right_2graficos_texto = rbind(f(10, t9, 1, "pic", 1), f(14, t9, 2, "pic", 2), f(13, t9, 3, "body", 2)),
    graficos_2_asimetrico = rbind(f(10, t11, 1, "pic", 1), f(11, t11, 2, "pic", 2)),
    poblacion_3_tira = rbind(f(10, t16, 1, "pic", 1), f(11, t16, 2, "pic", 2), f(12, t16, 3, "pic", 3), f(15, t16, NA, "body", 2)),
    # pic1 = superior_2, pic2 = superior_1, pic3 = superior_3, pic4 = inferior_2, pic5 = inferior_1 (reporte_plan_slides.R)
    poblacion_5 = rbind(f(15, t19, 2, "pic", 1, -0.001), f(10, t19, 1, "pic", 2), f(12, t19, 3, "pic", 3),
                        f(13, t19, 5, "pic", 4, -0.001), f(11, t19, 4, "pic", 5), f(16, t19, NA, "body", 2)),
    # pic4 = inferior_3, pic5 = inferior_1, pic6 = inferior_2
    poblacion_6 = rbind(f(15, t20, 2, "pic", 1, -0.001), f(10, t20, 1, "pic", 2), f(12, t20, 3, "pic", 3),
                        f(13, t20, 6, "pic", 4, -0.002), f(11, t20, 4, "pic", 5, -0.001), f(16, t20, 5, "pic", 6),
                        f(17, t20, NA, "body", 2))
  )
}

#' Caja esperada de una fila de la correspondencia (pulgadas)
#' @keywords internal
.plantilla_layout_caja <- function(fila) {
  if (is.na(fila$ranura)) return(.PLANTILLA_ICONO_CABECERA)
  r <- .std_tipo_lamina(fila$tipo)$ranuras[[fila$ranura]]
  c(x = r$x, y = r$y + fila$dy, w = r$w, h = r$h)
}

#' Reescribe la geometría de los placeholders de los layouts de la ruta anterior desde el estándar
#'
#' @param entrada,salida Rutas del `.pptx` (pueden ser la misma).
#' @return `salida`, invisible.
#' @keywords internal
.plantilla_layouts_desde_estandar <- function(entrada, salida = entrada) {
  dir <- tempfile("plantilla_"); dir.create(dir); on.exit(unlink(dir, recursive = TRUE), add = TRUE)
  utils::unzip(entrada, exdir = dir)
  ns <- c(p = "http://schemas.openxmlformats.org/presentationml/2006/main", a = "http://schemas.openxmlformats.org/drawingml/2006/main")
  mapa <- .plantilla_layouts_estandar()
  emu <- function(v) format(round(v * 914400), scientific = FALSE, trim = TRUE)
  for (f in list.files(file.path(dir, "ppt", "slideLayouts"), pattern = "\\.xml$", full.names = TRUE)) {
    x <- xml2::read_xml(f)
    nombre <- xml2::xml_attr(xml2::xml_find_first(x, "//p:cSld", ns), "name")
    if (!nombre %in% names(mapa)) next
    filas <- mapa[[nombre]]
    for (i in seq_len(nrow(filas))) {
      sp <- xml2::xml_find_first(x, sprintf("//p:sp[p:nvSpPr/p:nvPr/p:ph[@idx='%d']]", as.integer(filas$idx[i])), ns)
      if (inherits(sp, "xml_missing")) stop(sprintf("Layout %s sin placeholder idx %d", nombre, filas$idx[i]), call. = FALSE)
      caja <- .plantilla_layout_caja(filas[i, , drop = FALSE])
      sppr <- xml2::xml_find_first(sp, "p:spPr", ns)
      xfrm <- xml2::xml_find_first(sppr, "a:xfrm", ns)
      if (inherits(xfrm, "xml_missing")) {
        xml2::xml_add_child(sppr, "a:xfrm", .where = 0)
        xfrm <- xml2::xml_find_first(sppr, "a:xfrm", ns)
        xml2::xml_add_child(xfrm, "a:off"); xml2::xml_add_child(xfrm, "a:ext")
      }
      off <- xml2::xml_find_first(xfrm, "a:off", ns); ext <- xml2::xml_find_first(xfrm, "a:ext", ns)
      xml2::xml_set_attrs(off, c(x = emu(caja[["x"]]), y = emu(caja[["y"]])))
      xml2::xml_set_attrs(ext, c(cx = emu(caja[["w"]]), cy = emu(caja[["h"]])))
    }
    xml2::write_xml(x, f)
  }
  archivos <- list.files(dir, recursive = TRUE, all.files = TRUE)
  archivos <- c("[Content_Types].xml", setdiff(archivos, "[Content_Types].xml"))
  tmp <- tempfile(fileext = ".pptx")
  viejo <- setwd(dir); on.exit(setwd(viejo), add = TRUE)
  utils::zip(tmp, archivos, flags = "-X -q")
  setwd(viejo)
  file.copy(tmp, salida, overwrite = TRUE)
  invisible(salida)
}
