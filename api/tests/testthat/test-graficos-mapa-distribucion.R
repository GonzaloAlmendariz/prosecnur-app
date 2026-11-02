# Mapa de distribución de encuestados (CCSS Perfil 2026, láminas 12, 14, 18 y 23): conteo y porcentaje por distrito de
# Lima y Callao o por departamento del Perú, con encuadre a las áreas con datos. Fixture sintético.

.md_fx <- function() {
  set.seed(3)
  dist <- c("San Miguel", "Santiago de Surco", "Lince", "Comas", "Callao", "Chorrillos", "Extranjero")
  deps <- c("Lima Metropolitana", "Arequipa", "Cusco", "Piura", "Callao", "No sabe")
  n <- 300
  d <- data.frame(dist = as.character(sample(seq_along(dist), n, TRUE, prob = c(9, 8, 6, 5, 4, 3, 1))),
                  dep = as.character(sample(seq_along(deps), n, TRUE, prob = c(60, 8, 6, 4, 5, 2))), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("dist", "dep"), type = c("select_one ld", "select_one lp"), list_name = c("ld", "lp"),
                                   label = c("Distrito", "Lugar de nacimiento"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c(rep("ld", length(dist)), rep("lp", length(deps))),
                                    name = c(seq_along(dist), seq_along(deps)), label = c(dist, deps), stringsAsFactors = FALSE),
               orders_list = NULL)
  list(data = d, inst = inst)
}

test_that("el cálculo cuenta por código o por etiqueta, excluye lo pedido y deja lo que no casa en el total", {
  fx <- .md_fx()
  f <- .mapa_distribucion_calcular(fx$data, fx$inst, "dist")
  expect_identical(sum(f$n), 300L)
  expect_equal(sum(f$porcentaje), 100)
  expect_true("Extranjero" %in% f$etiqueta)
  por_etiqueta <- fx$data; por_etiqueta$dist <- fx$inst$choices$label[match(por_etiqueta$dist, fx$inst$choices$name[fx$inst$choices$list_name == "ld"])]
  expect_equal(.mapa_distribucion_calcular(por_etiqueta, fx$inst, "dist")$n, f$n)
  sin_ns <- .mapa_distribucion_calcular(fx$data, fx$inst, "dep", excluir_opciones = "No sabe")
  expect_false("No sabe" %in% sin_ns$etiqueta); expect_equal(sum(sin_ns$porcentaje), 100)
})

test_that("cada respuesta casa con su área: distrito por nombre o UBIGEO, departamento por nombre, alias o UBIGEO", {
  lima <- .mapa_distribucion_cartografia("lima_callao"); peru <- .mapa_distribucion_cartografia("peru")
  expect_identical(nrow(lima$nombres), 50L); expect_identical(nrow(peru$nombres), 25L)
  f <- data.frame(codigo = c("1", "150132", "x"), etiqueta = c("San Miguel", "SJL", "Extranjero"), n = 1L, porcentaje = 1)
  expect_identical(.mapa_distribucion_casar(f, lima, "lima_callao")$ubigeo, c("150136", "150132", NA))
  g <- data.frame(codigo = c("1", "2", "040101", "4"), etiqueta = c("Lima Metropolitana", "Provincia Constitucional del Callao", "Arequipa", "Junín"),
                  n = 1L, porcentaje = 1)
  expect_identical(.mapa_distribucion_casar(g, peru, "peru")$ubigeo, c("15", "07", "04", "12"))
})

test_that("la espec rotula «conteo (porcentaje)», pinta por la cifra que se lee y encuadra en las áreas con datos", {
  lima <- .mapa_distribucion_cartografia("lima_callao")
  f <- data.frame(codigo = c("150136", "150140", "150108"), etiqueta = c("San Miguel", "Surco", "Chorrillos"), n = c(57L, 51L, 22L),
                  porcentaje = c(14.25, 12.75, 5.5), ubigeo = c("150136", "150140", "150108"))
  e <- .espec_mapa_distribucion(f, lima, cortes = c(6, 10))
  expect_identical(e$ranking$cifra, c("57 (14%)", "51 (13%)", "22 (6%)"))
  expect_identical(e$ranking$color[3], e$leyenda$colores[2])   # 5.5 se lee «6%»: va en la clase de 6, no en «Menos de 6»
  expect_identical(e$leyenda$rotulos, c("Menos de 6 %", "6 a 9 %", "10 % a más", "Sin encuestados"))
  expect_identical(e$panel$titulo, "Encuestados por distrito")
  total <- .espec_mapa_distribucion(f, lima, cortes = c(6, 10), encuadre = "completo")$caja
  ancho <- function(cj) (cj[["xmax"]] - cj[["xmin"]]) * (cj[["ymax"]] - cj[["ymin"]])
  expect_lt(ancho(e$caja), 0.5 * ancho(total))
  d <- e$capas[[1]]$datos   # nada sale de la caja: el dispositivo del PPT se caía con polígonos fuera del recorte
  expect_true(all(d$x >= e$caja[["xmin"]] & d$x <= e$caja[["xmax"]] & d$y >= e$caja[["ymin"]] & d$y <= e$caja[["ymax"]]))
  expect_identical(.mapa_distribucion_cortes(c(2, 3, 6, 14)), c(3, 4, 8))
})

test_that("la lámina nativa y el Word llevan las cifras de Lima y del Perú; lo que no casa se avisa por su nombre", {
  fx <- .md_fx()
  plan <- p_plan(slides = list(p_slide_1_grafico(titulo = "Distrito", grafico = p_mapa_distribucion("dist")),
                               p_slide_1_grafico(titulo = "Nacimiento", grafico = p_mapa_distribucion("dep", area = "peru", excluir_opciones = "No sabe"))))
  out <- tempfile(fileext = ".pptx")
  msgs <- testthat::capture_messages(suppressWarnings(reporte_ppt_plan(data = fx$data, instrumento = fx$inst, plan = plan, path_ppt = out,
                                                                      mensajes_progreso = FALSE)))
  expect_true(any(grepl("fuera del mapa (cuentan en el total): Extranjero", msgs, fixed = TRUE)))
  for (k in 1:2) {
    x <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k)))
    txt <- function(n) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
    expect_true("prosecnur:grafico:mapa" %in% xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name"))
    expect_true(all(grepl("^[0-9,]+ \\([0-9]+%\\)$", txt("mapa:valor"))))
    expect_identical(txt("panel:pregunta"), if (k == 1) "Encuestados por distrito" else "Encuestados por departamento")
  }
  x2 <- xml2::read_xml(unz(out, "ppt/slides/slide2.xml"))
  dep <- xml2::xml_text(xml2::xml_find_all(x2, "//p:sp[p:nvSpPr/p:cNvPr[@name='mapa:distrito']]"))
  expect_identical(dep[1], "Lima"); expect_true("Callao" %in% dep); expect_false("No sabe" %in% dep)
  # Word: el mapa suma la lista de áreas con sus cifras, dentro del ancho útil.
  carto <- .mapa_distribucion_cartografia("lima_callao")
  espec <- .espec_mapa_distribucion(.mapa_distribucion_casar(.mapa_distribucion_calcular(fx$data, fx$inst, "dist"), carto, "lima_callao"), carto)
  g <- .word_g_mapa(espec)
  expect_lte(attr(g, "ancho"), .std_word("pagina", "ancho_util") + 1e-9)
  docx <- tempfile(fileext = ".docx")
  suppressMessages(suppressWarnings(reporte_word_plan(data = fx$data, instrumento = fx$inst, plan = plan, path_docx = docx, mensajes_progreso = FALSE)))
  medios <- grep("^word/media/", utils::unzip(docx, list = TRUE)$Name, value = TRUE)
  expect_gte(length(medios), 2L)
})

test_that("la cartografía del Perú es liviana, con sus 25 UBIGEO y su procedencia anotada", {
  dir <- system.file("cartografia", package = "prosecnurapp")
  if (!nzchar(dir)) dir <- testthat::test_path("..", "..", "inst", "cartografia")
  f <- file.path(dir, "peru_departamentos.geojson")
  expect_lt(file.size(f), 200 * 1024)
  geo <- jsonlite::fromJSON(f, simplifyVector = FALSE)
  expect_identical(sort(vapply(geo$features, function(x) x$properties$ubigeo, "")), sprintf("%02d", 1:25))
  leeme <- paste(readLines(file.path(dir, "LEEME.md"), warn = FALSE), collapse = " ")
  expect_match(leeme, "Natural Earth"); expect_match(leeme, "dominio público")
})

test_that("el plan JSON de la API acepta el mapa de distribución", {
  plan <- .normalize_plan(jsonlite::fromJSON(paste0(
    '{"slides":[{"tipo":"p_slide_1_grafico","payload":{"titulo":"x","grafico":{"graficador":"p_mapa_distribucion",',
    '"args":{"var":"dep","area":"peru","encuadre":"completo","excluir_opciones":["No sabe"]}}}}]}'), simplifyVector = FALSE))
  slide <- .graficos_rebuild_slide_json(plan$slides[[1]])
  expect_identical(slide$slots$plot$area, "peru")
  expect_identical(slide$slots$plot$encuadre, "completo")
  expect_identical(slide$slots$plot$excluir_opciones, "No sabe")
})

test_that("un punto se declara por coordenadas o por enlace largo de Google Maps, y entra al encuadre con su rótulo", {
  expect_equal(.mapa_punto_latlon("-12.0693, -77.0794"), c(-12.0693, -77.0794))
  expect_equal(.mapa_punto_latlon("https://www.google.com/maps/place/PUCP/@-12.0693,-77.0794,17z/data=!3m1"), c(-12.0693, -77.0794))
  expect_equal(.mapa_punto_latlon("https://www.google.com/maps/place/X/data=!4m6!3d-12.07!4d-77.08"), c(-12.07, -77.08))
  expect_equal(.mapa_punto_latlon("https://maps.google.com/?q=-12.07,-77.08"), c(-12.07, -77.08))
  expect_null(.mapa_punto_latlon("Av. Universitaria 1801"))
  expect_error(.mapa_puntos_normalizar("PUCP | https://maps.app.goo.gl/abc123"), "enlace corto")
  p <- .mapa_puntos_normalizar("PUCP | -12.0693, -77.0794\nSede | -12.10, -77.03 | #1F6FB2")
  expect_identical(p$etiqueta, c("PUCP", "Sede")); expect_identical(p$color, c(.std_color("coral"), "#1F6FB2"))
  expect_identical(.mapa_puntos_normalizar(list(etiqueta = "PUCP", lat = -12.07, lon = -77.08))$lat, -12.07)
  expect_identical(p_mapa_distribucion("dist", puntos = "PUCP | -12.0693, -77.0794")$puntos$etiqueta, "PUCP")
  lima <- .mapa_distribucion_cartografia("lima_callao")
  f <- data.frame(codigo = "150108", etiqueta = "Chorrillos", n = 5L, porcentaje = 100, ubigeo = "150108")
  pucp <- .mapa_puntos_normalizar("PUCP | -12.0693, -77.0794")
  e <- .espec_mapa_distribucion(f, lima, encuadre = "datos", puntos = pucp)
  expect_true(e$caja[["ymax"]] >= -12.0693 && e$caja[["xmin"]] <= -77.0794)
  geoms <- vapply(.lam_mapa_gg(e)$layers, function(l) class(l$geom)[1], "")
  expect_true(all(c("GeomPoint", "GeomText", "GeomPath") %in% geoms))
})

test_that("las clases se distinguen entre sí y de «Sin encuestados»", {
  lum <- function(col) { r <- grDevices::col2rgb(col)[, 1] / 255; sum(c(0.2126, 0.7152, 0.0722) * ifelse(r <= 0.03928, r / 12.92, ((r + 0.055) / 1.055)^2.4)) }
  l <- vapply(.MAPA_DISTRIBUCION_PALETA, lum, 0)
  expect_true(all(-diff(l) > 0.1))   # cada clase, un salto claro de luminosidad
  rgb_vacio <- grDevices::col2rgb(.MAPA_DISTRIBUCION_VACIO)[, 1]
  expect_identical(length(unique(rgb_vacio)), 1L)   # gris neutro: no se lee como otra clase azul
  lima <- .mapa_distribucion_cartografia("lima_callao")
  f <- data.frame(codigo = "150136", etiqueta = "San Miguel", n = 5L, porcentaje = 100, ubigeo = "150136")
  expect_identical(tail(.espec_mapa_distribucion(f, lima, cortes = c(5, 10, 20))$leyenda$colores, 1), .MAPA_DISTRIBUCION_VACIO)
})
