source("setup-load-all.R")

# K1 (plan F6 §5.1): el editor lee el estándar del recetario tal cual —tipos de lámina con sus ranuras, colores y
# paletas— y cada lámina del registro dice qué tipo del estándar le corresponde. La fuente es una sola:
# `inst/estandar/estandar_pulso.json` (ADR 0092); estos tests comparan contra el JSON leído aparte, no contra una copia.

.ea_json <- function() jsonlite::fromJSON(.std_ruta(), simplifyVector = FALSE)

test_that("el estándar expone los 22 tipos de lámina del recetario con nombre, uso, familia y ranuras en pulgadas", {
  est <- .graficos_estandar_payload()
  crudo <- .ea_json()$ppt$tipos_lamina
  expect_length(est$tipos_lamina, length(crudo))
  expect_identical(vapply(est$tipos_lamina, `[[`, "", "id"), vapply(crudo, `[[`, "", "id"))
  t1 <- est$tipos_lamina[[1]]
  expect_identical(t1$nombre, crudo[[1]]$nombre)
  expect_identical(t1$uso, crudo[[1]]$uso)
  expect_identical(t1$layout, crudo[[1]]$layout)
  expect_identical(t1$familia, crudo[[1]]$familia)                       # escala, cifra_pt, rotulo_pt, barra_in
  expect_setequal(names(t1$familia), c("escala", "cifra_pt", "rotulo_pt", "barra_in"))
  for (k in seq_along(crudo)) {
    r_api <- est$tipos_lamina[[k]]$ranuras
    r_json <- crudo[[k]]$ranuras
    expect_length(r_api, length(r_json))
    for (j in seq_along(r_json)) {
      expect_identical(r_api[[j]]$rol, r_json[[j]]$tipo)                 # el rol de la ranura: grafico, texto o cifras
      expect_identical(r_api[[j]][c("x", "y", "w", "h")], r_json[[j]][c("x", "y", "w", "h")])
    }
  }
  expect_identical(est$unidad, "in")
})

test_that("colores, paletas y geometría salen tal cual del JSON del estándar, con su versión", {
  est <- .graficos_estandar_payload()
  j <- .ea_json()
  expect_identical(est$colores, j$ppt$colores)
  expect_identical(est$paletas, j$ppt$paletas)
  expect_identical(est$geometria, j$ppt$geometria)
  expect_identical(est$version, j$version)
})

test_that("cada lámina del registro nombra su tipo del estándar, y las de estructura sin ranuras llevan NA (null)", {
  reg <- .graficos_registry_payload()
  por_nombre <- setNames(reg$slides, vapply(reg$slides, `[[`, "", "name"))
  ids_std <- vapply(.ea_json()$ppt$tipos_lamina, `[[`, "", "id")
  con <- names(por_nombre)[names(por_nombre) %in% ids_std]
  expect_length(con, 22L)
  for (nm in con) {
    e <- por_nombre[[nm]]$estandar
    expect_identical(e$id, nm)
    expect_identical(e$nombre, .std_tipo_lamina(nm)$nombre)
  }
  sin <- setdiff(names(por_nombre), ids_std)
  expect_length(sin, 12L)                                                   # portada, índice, separador, ficha, cierre, reglas de la identidad…
  for (nm in sin) expect_identical(por_nombre[[nm]]$estandar, NA, info = nm)
  expect_identical(por_nombre$p_slide_1_grafico$estandar$nombre, "Un gráfico")
})

test_that("el estándar se serializa con ranuras como arreglo y la lámina sin tipo como null", {
  # Mismas opciones que `.api_serializer()` (serializer_unboxed_json con na = "null").
  a_json <- function(x) as.character(jsonlite::toJSON(x, auto_unbox = TRUE, na = "null", null = "null", digits = NA))
  txt <- a_json(.graficos_estandar_payload())
  expect_match(txt, '"ranuras":[{"rol":"grafico","x":0.495,"y":1.65,"w":12.523,"h":4.6}]', fixed = TRUE)
  expect_match(txt, '"rango":[80,100]', fixed = TRUE)
  reg <- .graficos_registry_payload()
  portada <- Filter(function(x) identical(x$name, "p_slide_portada"), reg$slides)[[1]]
  expect_identical(a_json(list(estandar = portada$estandar)), '{"estandar":null}')
})
