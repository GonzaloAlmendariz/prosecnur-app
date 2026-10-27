# ADR 0092 — el estándar de los recetarios es la única fuente de verdad del estilo.
# Estos tests fijan los valores clave del estándar, que los accesores fallen con
# nombre ante un token inexistente y que los presets literales del motor no se
# aparten del estándar.

test_that("el estándar trae la geometría y la tipografía de la lámina del recetario", {
  expect_equal(.std_geom("ancho"), 13.333)
  expect_equal(.std_geom("zona_datos_y0"), 1.65)
  expect_equal(.std_geom("zona_datos_y1"), 6.42)
  expect_equal(.std_geom("base_y"), 6.88)
  expect_equal(.std_geom("columna_top_two_box"), 1)
  expect_equal(.std_aire_chica(), 0.36)
  expect_equal(.std_pt("titulo"), 24)
  expect_equal(.std_pt("base"), 10)
  expect_equal(.std_pt("leyenda"), 12)
  expect_equal(.std_pt("cifra"), 14)
  expect_equal(.std_color("coral"), "#CA5651")
  expect_equal(.std_color("azul"), "#081F5C")
})

test_that("las paletas del núcleo traen sus colores en orden", {
  likert <- .std_paleta("likert")
  expect_length(likert, 5L)
  expect_equal(likert[[5]], "#BFBFBF")
  expect_equal(.std_paleta("dicotomica"), c("#081F5C", "#9DC3E6"))
  expect_length(.std_paleta("mapa"), 4L)
  expect_equal(.std_paleta("categorias")$mayor, "#081F5C")
})

test_that("el grosor de barra sale de la tabla por número de filas, escalonado", {
  withr::local_options(prosecnur.grosor_piso_cm = 0)   # la tabla cruda: sin el piso de 1,12 cm que el estándar trae
  expect_equal(.std_grosor(1, "escala_apilada"), 0.50)
  expect_equal(.std_grosor(3, "escala_apilada"), 0.48)
  expect_equal(.std_grosor(4, "escala_apilada"), 0.44)
  expect_equal(.std_grosor(9, "escala_apilada"), 0.38)
  expect_equal(.std_grosor(14, "escala_apilada"), 0.32)
  expect_equal(.std_grosor(3, "categorias"), 0.26)
  expect_equal(.std_grosor(7, "categorias"), 0.30)
  expect_equal(.std_grosor(20, "categorias"), 0.32)
  # nunca adelgaza al sumar filas
  g <- vapply(1:20, .std_grosor, numeric(1), tipo = "escala_apilada")
  expect_true(all(diff(g) <= 0))
})

test_that("los 22 tipos de lámina del recetario traen ranuras dentro de la lámina", {
  ids <- .std_tipos_lamina()
  expect_length(ids, 22L)
  expect_false(anyDuplicated(ids) > 0)
  for (id in ids) {
    t <- .std_tipo_lamina(id)
    expect_true(length(t$ranuras) >= 1L, info = id)
    for (r in t$ranuras) {
      expect_true(r$x >= 0 && r$x + r$w <= .std_geom("ancho") + 1e-6, info = id)
      expect_true(r$y >= 0 && r$y + r$h <= .std_geom("alto") + 1e-6, info = id)
    }
  }
  uno <- .std_tipo_lamina("p_slide_1_grafico")$ranuras[[1]]
  expect_equal(c(uno$x, uno$y, uno$w), c(.std_geom("margen_izq"), .std_geom("zona_datos_y0"), .std_geom("ancho_contenido")))
})

test_that("el bloque Word trae la página A4 y el piso tipográfico", {
  expect_equal(.std_word("pagina", "ancho"), 8.27)
  expect_equal(.std_word("pagina", "ancho_util"), 6.27)
  expect_equal(.std_word("tipografia", "grafico_minimo"), 8)
  expect_equal(.std_word("colores", "acento"), "#CA5651")
})

test_that("un token inexistente aborta con su ruta, no cae a NULL", {
  expect_error(.std_pt("no_existe"), "ppt.tipografia.no_existe")
  expect_error(.std_color("magenta"), "ppt.colores.magenta")
  expect_error(.std_tipo_lamina("p_slide_inventado"), "p_slide_inventado")
})

test_that("los presets literales del motor no se apartan del estándar", {
  base <- .PRESETS_DEFAULT_PULSO$base
  expect_equal(base$size_nota_pie, .std_pt("base"))
  expect_equal(base$size_titulo_slide, .std_pt("titulo"))
  expect_equal(base$size_leyenda, .std_pt("leyenda"))
  expect_equal(base$font_family, .std_pt("fuente"))
  expect_equal(base$color_titulo, .std_color("coral"))
  expect_equal(base$color_nota_pie, .std_color("azul"))
  expect_equal(.PULSO_PPT_COLORS$azul, .std_color("azul"))
  expect_equal(.PULSO_PPT_COLORS$rojo, .std_color("coral"))
  # Literales del suelo (código de primer nivel, no puede leer el JSON al
  # instalar): atados al estándar aquí.
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_apiladas$color_barra_extra, .std_color("verde_top_two_box"))
  expect_equal(.PRESETS_DEFAULT_PULSO$multi_apiladas$color_barra_extra, .std_color("verde_top_two_box"))
})

test_that("el JSON versionado es exactamente lo que exporta el recetario", {
  raiz <- normalizePath(testthat::test_path("..", "..", ".."), mustWork = FALSE)
  exportador <- file.path(raiz, "docs", "qa", "motor-ppt-2026-10-06", "herramientas", "exportar_estandar.R")
  skip_if_not(file.exists(exportador), "exportador fuera del árbol (paquete instalado)")
  tmp <- tempfile(fileext = ".json")
  rscript <- file.path(R.home("bin"), "Rscript")
  previo <- setwd(raiz)
  on.exit(setwd(previo), add = TRUE)
  st <- system2(rscript, c(shQuote(exportador), shQuote(tmp)), stdout = FALSE, stderr = FALSE)
  expect_equal(st, 0L)
  versionado <- jsonlite::fromJSON(file.path(raiz, "api", "inst", "estandar", "estandar_pulso.json"), simplifyVector = FALSE)
  expect_identical(jsonlite::fromJSON(tmp, simplifyVector = FALSE), versionado)
})

test_that("ningún graficador escribe a mano un color que el estándar nombra", {
  # ADR 0092: el azul y el coral de la casa salen de `.std_color()`. Un literal
  # en la firma es la deriva que el estándar cierra: el día que el recetario
  # cambie, ese graficador seguiría con el color viejo.
  dir_r <- testthat::test_path("..", "..", "R")
  archivos <- c(list.files(dir_r, pattern = "^(graficador_|reporte_slide_).*\\.R$", full.names = TRUE),
                file.path(dir_r, c("reporte_plan_ppt.R", "reporte_ppt_numero_respuestas.R")))
  sueltos <- character(0)
  for (f in archivos) {
    l <- readLines(f, warn = FALSE)
    hit <- grep('^\\s+color_\\w+\\s*=\\s*"#(081F5C|CA5651)"', l, ignore.case = TRUE, perl = TRUE)
    hit <- c(hit, grep('"#D8504F"', l, fixed = TRUE))
    if (length(hit)) sueltos <- c(sueltos, paste0(basename(f), ":", hit))
  }
  expect_identical(sueltos, character(0))
})
