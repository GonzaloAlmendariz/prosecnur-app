source("setup-load-all.R")

.mm_ctx <- function(con_manzanas = TRUE, n_ap = 6L) {
  ub <- "150142"
  z <- hojas_ruta_zone_map_preview(ub)$geojson$features
  cods <- vapply(z, .graficos_geojson_zone_code, ""); ap <- cods[seq_len(n_ap)]
  zones <- lapply(z, function(f) { zc <- .graficos_geojson_zone_code(f); list(ubigeo = ub, distrito = "VILLA EL SALVADOR", zona = zc,
    status = if (zc %in% ap) "efectiva" else "no_intervenido", effective = zc %in% ap, rings = .graficos_geojson_rings_payload(f$geometry)) })
  feats <- .hojas_ruta_pdf_block_features_for_ubigeo(ub)
  en <- Filter(function(f) f$zona %in% ap, feats)
  aplic <- vapply(en, function(f) f$id, "")[c(TRUE, FALSE, FALSE)]
  list(ctx = list(scope = "district", ubigeo = ub, distrito = "VILLA EL SALVADOR", zones = zones, mostrar_manzanas = TRUE,
                  summary = list(list(ubigeo = ub, zonas_efectivas = n_ap, zonas_ruta = n_ap)),
                  manzanas = if (con_manzanas) list(aplicadas = aplic, visitadas = aplic)),
       n_aplic = length(aplic), n_en = length(en), n_zonas = length(z))
}

test_that("la 106 pinta las manzanas del distrito por estado, contornea las zonas y cuenta zonas y manzanas aplicadas", {
  fx <- .mm_ctx()
  e <- .espec_mapa(fx$ctx)
  expect_true(isTRUE(e$manzanas)); expect_null(e$ubicacion)
  expect_length(e$capas, 3L)
  expect_true(isTRUE(e$capas[[2]]$sin_relleno)); expect_true(isTRUE(e$capas[[3]]$sin_relleno))
  manz <- e$capas[[1]]$datos
  expect_setequal(unique(manz$fill), c(.std_color("azul"), .std_color("mapa_medio"), "#FFFFFF"))
  expect_identical(e$cifra$valor, "6"); expect_identical(e$cifra$detalle, sprintf("de %d zonas del distrito", fx$n_zonas))
  expect_identical(e$cifra2$valor, format(fx$n_aplic, big.mark = ","))
  expect_identical(e$cifra2$detalle, sprintf("de %s manzanas en esas zonas", format(fx$n_en, big.mark = ",")))
  expect_identical(e$leyenda$rotulos, c("Manzana aplicada", "Otra manzana de una zona aplicada", "Fuera de la muestra"))
})

test_that("sin avance por manzana o sin pedir manzanas, el distrito sigue siendo la 105", {
  sin <- .espec_mapa(.mm_ctx(con_manzanas = FALSE)$ctx)
  expect_null(sin$manzanas); expect_identical(sin$leyenda$titulo, "Zonas")
  ctx <- .mm_ctx()$ctx; ctx$mostrar_manzanas <- NULL
  expect_null(.espec_mapa(ctx)$manzanas)
})

test_that("la 106 sale nativa con sus dos cifras en el motor", {
  fx <- .mm_ctx()
  out <- tempfile(fileext = ".pptx")
  el <- p_mapa_cobertura_territorial("district", ubigeo = "150142", contexto = fx$ctx[setdiff(names(fx$ctx), "mostrar_manzanas")], mostrar_manzanas = TRUE)
  df <- data.frame(x = 1); inst <- list(survey = data.frame(name = "x", type = "integer", list_name = NA_character_), choices = NULL, orders_list = NULL)
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, plan = list(p_slide_1_grafico(el, titulo = "Zonas y manzanas")),
                                                     path_ppt = out, mensajes_progreso = FALSE)))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  txt <- function(n) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
  expect_identical(txt("mapa:cifra"), "6")
  expect_identical(txt("mapa:cifra2_rotulo"), "manzanas aplicadas")
  expect_identical(txt("leyenda:texto"), c("Manzana aplicada", "Otra manzana de una zona aplicada", "Fuera de la muestra"))
})
