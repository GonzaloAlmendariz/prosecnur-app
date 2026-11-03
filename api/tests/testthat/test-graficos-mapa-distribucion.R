# Mapa de distribución de encuestados con el diseño aprobado (lienzo «Maqueta de mapas territoriales», 2026-11-02):
# cortes en estudiantes o tasa por 10 000 habitantes, Lima Metropolitana / Callao / Lima provincias separados en el Perú,
# rótulos sólo para los puntos de referencia, en columna y sin choques. Fixture sintético.

.md_fx <- function(n = 300) {
  set.seed(3)
  dist <- c("San Miguel", "Santiago de Surco", "Lince", "Comas", "Callao", "Chorrillos", "Extranjero")
  deps <- c("Lima Metropolitana", "Arequipa", "Cusco", "Piura", "Callao", "Lima provincias", "No sabe")
  d <- data.frame(dist = as.character(sample(seq_along(dist), n, TRUE, prob = c(9, 8, 6, 5, 4, 3, 1))),
                  dep = as.character(sample(seq_along(deps), n, TRUE, prob = c(60, 8, 6, 4, 5, 3, 2))), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("dist", "dep"), type = c("select_one ld", "select_one lp"), list_name = c("ld", "lp"),
                                   label = c("Distrito", "Lugar de nacimiento"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c(rep("ld", length(dist)), rep("lp", length(deps))),
                                    name = c(seq_along(dist), seq_along(deps)), label = c(dist, deps), stringsAsFactors = FALSE),
               orders_list = NULL)
  list(data = d, inst = inst)
}
.md_espec <- function(fx, var, area, medida = "conteo", puntos = NULL, excl = NULL) {
  carto <- .mapa_distribucion_cartografia(area)
  f <- .mapa_distribucion_calcular(fx$data, fx$inst, var, excluir_opciones = excl)
  .espec_mapa_distribucion(.mapa_distribucion_casar(f, carto, area), carto, area, medida, puntos = .mapa_puntos_normalizar(puntos))
}

test_that("las clases van en estudiantes (Lima 1–2 … 21 o más; Perú hasta 11 o más) o en tasa con coma decimal", {
  l <- .mapa_distribucion_clases("conteo", "lima_callao")
  expect_identical(l$rotulos, c("1–2", "3–5", "6–10", "11–20", "21 o más"))
  expect_identical(l$colores, c("#C6DBEF", "#9ECAE1", "#6BAED6", "#3182BD", "#08519C"))
  expect_identical(l$clase(c(1, 2, 3, 10, 11, 20, 21, 99)), c(1L, 1L, 2L, 3L, 4L, 4L, 5L, 5L))
  p <- .mapa_distribucion_clases("conteo", "peru")
  expect_identical(p$rotulos, c("1–2", "3–5", "6–10", "11 o más"))
  expect_identical(p$colores, c("#C6DBEF", "#9ECAE1", "#4292C6", "#08519C"))
  t <- .mapa_distribucion_clases("tasa", "lima_callao")
  expect_identical(t$rotulos, c("menos de 0,5", "0,5–1", "1–2", "2–3", "3 o más"))
  expect_identical(t$clase(c(0.2, 0.5, 0.99, 1, 2.5, 3)), c(1L, 2L, 2L, 3L, 4L, 5L))
})

test_that("en el Perú Lima Metropolitana, el Callao y Lima provincias son tres áreas; lo que pasa de la mitad va fuera de escala", {
  peru <- .mapa_distribucion_cartografia("peru")
  expect_true(all(c("15M", "07", "15P") %in% peru$areas$clave))
  expect_false("15" %in% peru$areas$clave)
  f <- data.frame(codigo = c("1", "2", "3", "150101", "150501", "070101", "15"),
                  etiqueta = c("Lima Metropolitana", "Lima provincias", "Provincia Constitucional del Callao", "x", "y", "z", "w"), n = 1L, porcentaje = 1)
  expect_identical(.mapa_distribucion_casar(f, peru, "peru")$clave, c("15M", "15P", "07", "15M", "15P", "07", "15M"))
  e <- .md_espec(.md_fx(), "dep", "peru", excl = "No sabe")
  lm <- e$areas[e$areas$clave == "15M", ]
  expect_true(lm$fuera); expect_identical(lm$color, "#14213D")
  expect_identical(e$zona$nombre, c("Lima Metropolitana", "Callao", "Lima provincias"))
  expect_false("Lima Metropolitana" %in% e$ranking$nombre)   # fuera de escala: va anotada, no en el ranking
  expect_match(e$ranking_titulo, "Fuera de Lima Metropolitana")
})

test_that("la tasa usa la población del Censo 2017 y agrega su fuente al pie; sólo existe en Lima y Callao", {
  e <- .md_espec(.md_fx(), "dist", "lima_callao", "tasa")
  sm <- e$areas[e$areas$nombre == "San Miguel", ]
  expect_equal(sm$tasa, 1e4 * sm$n / sm$pob)
  expect_identical(e$nota_pie, "Población: INEI, Censo 2017.")
  expect_match(e$leyenda_titulo, "10 000 habitantes")
  expect_identical(e$ranking_columnas[2], "Tasa (n)")
  expect_error(p_mapa_distribucion("dep", area = "peru", medida = "tasa"), "sólo está disponible en Lima")
})

test_that("sólo los puntos de referencia llevan rótulo: en columna, a la izquierda, sin chocar y con su guía", {
  e <- .md_espec(.md_fx(), "dist", "lima_callao", puntos = "PUCP | -12.0693, -77.0794")
  expect_identical(e$rotulos$texto, "PUCP"); expect_identical(e$rotulos$color, "#C8463D")
  # El acomodo de la columna con muchos rótulos cercanos: misma x, separación mínima, dentro del alto.
  items <- data.frame(texto = paste("Lugar", 1:9), x = 3 + (1:9) / 10, y = 2 + c(0, 0.01, 0.02, 0.05, 0.06, 0.4, 0.41, 1, 1.02),
                      prioridad = 9:1)
  lay <- .mapa_dist_rotulos_columna(items, alto = 4, x_txt = 1.4, pt = 9)
  y <- sort(lay$items$y_txt)
  expect_true(all(diff(y) >= 21 / 96 - 1e-9))
  expect_true(all(y > 0 & y < 4))
  expect_identical(nrow(lay$guia), 3L * nrow(lay$items))
  muchos <- .mapa_dist_rotulos_columna(transform(items[rep(1:9, 3), ], prioridad = 27:1), alto = 2, x_txt = 1.4, pt = 9)
  expect_true(all(diff(sort(muchos$items$y_txt)) >= 21 / 96 - 1e-9))   # los que no caben se quedan fuera, nunca se pisan
})

test_that("la lámina y el Word salen con el panel, la leyenda escalonada y el ranking; nada se cae en el PPT", {
  fx <- .md_fx()
  plan <- p_plan(slides = list(p_slide_1_grafico(titulo = "Distrito", grafico = p_mapa_distribucion("dist", puntos = "PUCP | -12.0693, -77.0794")),
                               p_slide_1_grafico(titulo = "Tasa", grafico = p_mapa_distribucion("dist", medida = "tasa")),
                               p_slide_1_grafico(titulo = "Nacimiento", grafico = p_mapa_distribucion("dep", area = "peru", excluir_opciones = "No sabe"))))
  out <- tempfile(fileext = ".pptx")
  msgs <- testthat::capture_messages(suppressWarnings(reporte_ppt_plan(data = fx$data, instrumento = fx$inst, plan = plan, path_ppt = out,
                                                                      mensajes_progreso = FALSE)))
  expect_true(any(grepl("fuera del mapa (cuentan en el total): Extranjero", msgs, fixed = TRUE)))
  for (k in 1:3) {
    x <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k)))
    nm <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
    expect_true(all(c("prosecnur:grafico:mapa", "mapa:leyenda_titulo", "mapa:ranking_titulo") %in% nm), info = k)
    txt <- function(n) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
    expect_true("Sin encuestados" %in% txt("leyenda:texto"), info = k)
    if (k == 2) expect_match(paste(xml2::xml_text(xml2::xml_find_all(x, "//a:t")), collapse = " "), "Población: INEI, Censo 2017")
  }
  docx <- tempfile(fileext = ".docx")
  suppressMessages(suppressWarnings(reporte_word_plan(data = fx$data, instrumento = fx$inst, plan = plan, path_docx = docx, mensajes_progreso = FALSE)))
  expect_gte(length(grep("^word/media/", utils::unzip(docx, list = TRUE)$Name)), 3L)
  g <- .word_g_mapa(.md_espec(fx, "dist", "lima_callao"))
  expect_lte(attr(g, "ancho"), 16 / 2.54 + 1e-9)
})

test_that("un punto se declara por coordenadas o por enlace largo de Google Maps; el enlace corto se rechaza con su motivo", {
  expect_equal(.mapa_punto_latlon("-12.0693, -77.0794"), c(-12.0693, -77.0794))
  expect_equal(.mapa_punto_latlon("https://www.google.com/maps/place/PUCP/@-12.0693,-77.0794,17z/data=!3m1"), c(-12.0693, -77.0794))
  expect_equal(.mapa_punto_latlon("https://www.google.com/maps/place/X/data=!4m6!3d-12.07!4d-77.08"), c(-12.07, -77.08))
  expect_error(.mapa_puntos_normalizar("PUCP | https://maps.app.goo.gl/abc123"), "enlace corto")
  p <- .mapa_puntos_normalizar("PUCP | -12.0693, -77.0794\nSede | -12.10, -77.03 | #1F6FB2")
  expect_identical(p$etiqueta, c("PUCP", "Sede"))
})

test_that("la cartografía es liviana y trae su procedencia: departamentos y países vecinos de Natural Earth", {
  dir <- system.file("cartografia", package = "prosecnurapp")
  if (!nzchar(dir)) dir <- testthat::test_path("..", "..", "inst", "cartografia")
  expect_lt(file.size(file.path(dir, "peru_departamentos.geojson")), 200 * 1024)
  v <- jsonlite::fromJSON(file.path(dir, "peru_vecinos.geojson"), simplifyVector = FALSE)
  expect_setequal(vapply(v$features, function(x) x$properties$pais, ""), c("Bolivia", "Brasil", "Chile", "Colombia", "Ecuador"))
  leeme <- paste(readLines(file.path(dir, "LEEME.md"), warn = FALSE), collapse = " ")
  expect_match(leeme, "Admin 0"); expect_match(leeme, "dominio público")
})

test_that("el plan JSON de la API acepta el mapa de distribución con su medida", {
  plan <- .normalize_plan(jsonlite::fromJSON(paste0(
    '{"slides":[{"tipo":"p_slide_1_grafico","payload":{"titulo":"x","grafico":{"graficador":"p_mapa_distribucion",',
    '"args":{"var":"dist","area":"lima_callao","medida":"tasa","excluir_opciones":["No sabe"]}}}}]}'), simplifyVector = FALSE))
  slide <- .graficos_rebuild_slide_json(plan$slides[[1]])
  expect_identical(slide$slots$plot$medida, "tasa")
  expect_identical(slide$slots$plot$excluir_opciones, "No sabe")
})
