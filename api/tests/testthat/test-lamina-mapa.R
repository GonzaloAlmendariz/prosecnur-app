# Mapas de cobertura del recetario (láminas 103, 105 y 106; ADR 0093, N6): el mapa sigue en ggplot, recortado a su
# caja, y el panel, la narrativa y la leyenda son nativos. Contexto sintético sobre la cartografía real del paquete.

.ctx_distrito <- function(ubigeo = "150108", distrito = "Chorrillos", n_ruta = 14, n_ef = 9, seed = 3) {
  feats <- hojas_ruta_zone_map_preview(ubigeo)$geojson$features
  set.seed(seed); idx <- sample(seq_along(feats), n_ruta); ef <- idx[seq_len(n_ef)]
  zones <- lapply(seq_along(feats), function(i) list(ubigeo = ubigeo, distrito = distrito, zona = .graficos_geojson_zone_code(feats[[i]]),
    status = if (i %in% ef) "efectiva" else if (i %in% idx) "intervencion" else "no_intervenido", rings = .graficos_geojson_rings_payload(feats[[i]]$geometry)))
  list(scope = "district", ubigeo = ubigeo, distrito = distrito, zones = zones,
       summary = list(list(ubigeo = ubigeo, distrito = distrito, grupo = "intervencion", zonas_ruta = n_ruta, zonas_efectivas = n_ef)))
}
.ctx_general <- function() {
  ds <- .graficos_acnur_koica_districts()
  list(scope = "overview_koica", zones = list(), lima_boundary = .graficos_lima_district_context(),
       summary = lapply(seq_along(ds), function(k) list(ubigeo = ds[[k]]$ubigeo, distrito = ds[[k]]$distrito, grupo = ds[[k]]$group,
                                                        zonas_ruta = 20 + k, zonas_efectivas = 10 + 2 * k)))
}
.mp_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.mp_xml <- function(doc, k = length(doc)) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))) }
.mp_txt <- function(xml, n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))

test_that("el mapa de un distrito pinta las zonas con los azules del recetario y cuenta las efectivas sobre la ruta", {
  e <- attr(suppressWarnings(graficar_mapa_cobertura_territorial(.ctx_distrito(n_ruta = 14, n_ef = 9))), "pulso_espec")
  expect_identical(e$tipo, "mapa"); expect_identical(e$forma, "distrito")
  expect_identical(e$cifra$valor, "9"); expect_identical(e$cifra$detalle, "de 14 zonas en la ruta")
  expect_identical(e$leyenda$rotulos, c("Zona con cobertura efectiva", "Zona en la ruta", "Zona fuera de la ruta"))
  expect_identical(toupper(e$leyenda$colores), toupper(c(.std_color("mapa_aplicada"), .std_color("mapa_medio"), "#FFFFFF")))
  d <- e$capas[[1]]$datos
  expect_true(all(d$x >= e$caja[["xmin"]] - 1e-9 & d$x <= e$caja[["xmax"]] + 1e-9))
})

test_that("la vista general pinta los distritos del estudio por grupo, recorta Lima a su caja y lista las zonas efectivas", {
  e <- attr(suppressWarnings(graficar_mapa_cobertura_territorial(.ctx_general())), "pulso_espec")
  expect_identical(e$forma, "general")
  expect_identical(vapply(e$grupos, `[[`, "", "titulo"), c("Distritos de intervención", "Distritos de comparación"))
  expect_equal(vapply(e$grupos, `[[`, 0, "total"), c(12 + 16 + 20, 14 + 18 + 22))
  d <- e$capas[[1]]$datos
  # Recortada como st_crop: nada sale de la caja y no quedan anillos sin área (lo que tumba a rvg).
  expect_true(all(d$x >= e$caja[["xmin"]] - 1e-9 & d$x <= e$caja[["xmax"]] + 1e-9 & d$y >= e$caja[["ymin"]] - 1e-9 & d$y <= e$caja[["ymax"]] + 1e-9))
  expect_true(toupper(.std_color("mapa_aplicada")) %in% toupper(d$fill) && toupper(.std_color("mapa_fuera")) %in% toupper(d$fill))
})

test_that("la lámina del distrito lleva la cifra, la narrativa y la leyenda en el panel, con la leyenda al pie del mapa", {
  e <- attr(suppressWarnings(graficar_mapa_cobertura_territorial(.ctx_distrito())), "pulso_espec")
  tx <- "Las zonas en azul fuerte lograron su cuota de encuestas."
  expect_true(.lam_mapa_cabe(e, tx))
  xml <- .mp_xml(.lam_laminas_mapa(.mp_doc(), e, "Cobertura en Chorrillos", texto = tx, folio = 105)$doc)
  expect_identical(.mp_txt(xml, "mapa:cifra"), "9"); expect_identical(.mp_txt(xml, "mapa:narrativa"), tx)
  expect_identical(.mp_txt(xml, "leyenda:texto"), e$leyenda$rotulos)
  nm <- xml2::xml_attr(xml2::xml_find_all(xml, "//p:cNvPr"), "name"); expect_true("prosecnur:grafico:mapa" %in% nm)
  expect_false(.lam_mapa_cabe(e, paste(rep(tx, 12), collapse = " ")))                    # una narrativa que no cabe: ruta anterior
})

test_that("en la vista general el encabezado de la cifra va en una línea y la compuerta cuenta bien la lista", {
  e <- attr(suppressWarnings(graficar_mapa_cobertura_territorial(.ctx_general())), "pulso_espec")
  expect_true(.lam_mapa_cabe(e))
  xml <- .mp_xml(.lam_laminas_mapa(.mp_doc(), e, "Distritos del estudio", folio = 103)$doc)
  ext <- xml2::xml_find_first(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='mapa:encabezado']]/p:spPr/a:xfrm/a:ext")
  expect_gte(as.numeric(xml2::xml_attr(ext, "cx")) / 914400, .lam_ancho_tinta("Zonas efectivas", 10, TRUE) + 0.2)
  expect_identical(.mp_txt(xml, "mapa:distrito")[1:3], c("San Martín de Porres", "San Juan de Lurigancho", "Chorrillos"))
})

test_that("por la ruta real el mapa sale nativo en la lámina narrativa y en la de un gráfico, y vuelve atrás si se pide", {
  df <- data.frame(x = 1:3)
  inst <- list(survey = data.frame(name = "x", type = "integer", label = "X"), choices = data.frame(list_name = character(0), name = character(0), label = character(0)))
  ctx <- .ctx_distrito()
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE, plan = list(
    a = p_slide_1_grafico_narrativo(p_mapa_cobertura_territorial(scope = "district", contexto = ctx), titulo = "Narrativa", texto = "Lectura del mapa.", base = "", pie = ""),
    b = p_slide_1_grafico(p_mapa_cobertura_territorial(scope = "district", contexto = ctx), titulo = "Un gráfico"),
    c = p_slide_1_grafico_narrativo(p_mapa_cobertura_territorial(scope = "district", contexto = ctx), titulo = "Atrás", texto = "x", base = "", pie = "",
                                    meta = list(motor_nativo = FALSE))))))
  n <- length(officer::read_pptx(out))
  lam <- lapply(seq_len(n), function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))))
  nativo <- vapply(lam, function(x) "prosecnur:grafico:mapa" %in% xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name"), TRUE)
  expect_identical(nativo, c(TRUE, TRUE, FALSE))
  expect_identical(.mp_txt(lam[[1]], "mapa:narrativa"), "Lectura del mapa.")
})
