source("setup-load-all.R")

# K9 (plan F6 §0 y §6): el `SlideType` del frontend tenía 22 tipos y el registro 33. El catálogo generado
# `inst/catalogos/graficos_tipos.json` lista los 33 tipos de lámina y los 30 graficadores en el orden del registro, para
# que el frontend derive sus tipos de ahí y no de una lista tecleada. Se regenera con
# `Rscript api/scripts/generar_graficos_tipos.R`; este test se pone rojo si el archivo versionado se desvía del metadata.

.gt_ruta <- function() {
  cands <- c(file.path(.app_api_dir(), "inst", "catalogos", "graficos_tipos.json"),
             file.path("..", "..", "inst", "catalogos", "graficos_tipos.json"))
  hit <- cands[file.exists(cands)][1]
  if (is.na(hit)) cands[[1]] else hit
}

test_that("el catálogo en memoria lista los 33 tipos de lámina y los 30 graficadores del registro, en su orden", {
  cat <- .graficos_tipos_catalogo()
  expect_identical(vapply(cat$slides, `[[`, "", "name"), names(.SLIDES_META))
  expect_identical(vapply(cat$graficadores, `[[`, "", "name"), names(.GRAFICADORES_META))
  expect_length(cat$slides, 33L)
  expect_length(cat$graficadores, 30L)
  por <- setNames(cat$slides, vapply(cat$slides, `[[`, "", "name"))
  expect_identical(por$p_slide_1_grafico$estandar, "p_slide_1_grafico")
  expect_identical(por$p_slide_portada$estandar, NA)
  expect_identical(sum(!is.na(vapply(cat$slides, function(s) as.character(s$estandar), ""))), 22L)
  g <- setNames(cat$graficadores, vapply(cat$graficadores, `[[`, "", "name"))
  expect_identical(g$p_radar$familia_editor, "comparar")
})

test_that("el JSON versionado es exactamente el que genera el metadata de hoy (regenerar con api/scripts/generar_graficos_tipos.R)", {
  ruta <- .gt_ruta()
  expect_true(file.exists(ruta), info = ruta)
  versionado <- paste(readLines(ruta, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_identical(versionado, .graficos_tipos_catalogo_json(),
                   info = "Regenera con: Rscript api/scripts/generar_graficos_tipos.R")
  j <- jsonlite::fromJSON(ruta, simplifyVector = FALSE)
  expect_length(j$slides, 33L)
  expect_length(j$graficadores, 30L)
  expect_null(j$slides[[1]]$estandar)                                       # portada: null en el JSON
})
