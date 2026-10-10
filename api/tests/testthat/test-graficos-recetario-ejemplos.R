source("setup-load-all.R")

# K5 (plan F6 §5.6; Gonzalo, 2026-10-10: «sí, pero de manera profesional»): las láminas de ejemplo del recetario viajan
# con la app en `inst/recetario/ejemplos/`, con un catálogo por tipo y página versionado por recetario, y el editor las
# pide por tipo o por página. Se regeneran con api/scripts/recetario_ejemplos_generar.R.

test_that("el catálogo cubre los 22 tipos de lámina del estándar y cada archivo existe con su hash", {
  cat <- .recetario_ejemplos_catalogo()
  expect_identical(cat$formato, 1L)
  expect_true(length(cat$recetarios) >= 1L)
  rec <- cat$recetarios[[1]]
  expect_identical(rec$id, "recetario-moderna")
  expect_match(rec$sha256, "^[0-9a-f]{64}$")
  laminas <- Filter(function(e) identical(e$clase, "lamina"), cat$ejemplos)
  expect_setequal(vapply(laminas, `[[`, "", "tipo"), .std_tipos_lamina())        # los 22, ni uno más
  dir <- .recetario_ejemplos_dir()
  for (e in cat$ejemplos) {
    f <- file.path(dir, e$archivo)
    expect_true(file.exists(f), info = e$archivo)
    expect_identical(digest::digest(file = f, algo = "sha256"), e$sha256, info = e$archivo)
    expect_true(e$recetario %in% vapply(cat$recetarios, `[[`, "", "id"), info = e$archivo)
  }
})

test_that("los tipos del catálogo existen en el registro y no se empaqueta lo que el motor no produce", {
  cat <- .recetario_ejemplos_catalogo()
  graf <- Filter(function(e) identical(e$clase, "grafico"), cat$ejemplos)
  expect_true(all(vapply(graf, `[[`, "", "tipo") %in% names(.GRAFICADORES_META)))
  paginas <- vapply(cat$ejemplos, `[[`, integer(1), "pagina")
  # Fichas «TIPO DE LÁMINA n DE 22» (123, 125…) y páginas de propuesta (69, 79, 85, 97, 105) no son ejemplos.
  expect_length(intersect(paginas, c(69L, 79L, 85L, 97L, 105L, 123L, 125L, 134L, 170L)), 0L)
  peso <- sum(vapply(cat$ejemplos, `[[`, numeric(1), "bytes"))
  expect_lt(peso, 8 * 1024^2)
})

test_that("el ejemplo se pide por tipo o por página y vuelve como imagen con su procedencia", {
  e <- .recetario_ejemplo_payload(tipo = "p_slide_3_graficos_poblacion_corona")
  expect_identical(e$pagina, 160L)
  expect_identical(e$clase, "lamina")
  expect_identical(e$recetario$id, "recetario-moderna")
  expect_match(e$data_uri, "^data:image/(webp|png);base64,")
  expect_identical(.recetario_ejemplo_payload(pagina = "160")$tipo, "p_slide_3_graficos_poblacion_corona")
  expect_identical(.recetario_ejemplo_payload(tipo = "p_dim_heatmap", clase = "grafico")$pagina, 94L)
})

test_that("lo que no existe o no se puede leer responde con su código, no con un 500 crudo", {
  err <- function(expr) tryCatch({ expr; NULL }, error = function(e) e)
  sin <- err(.recetario_ejemplo_payload())
  expect_identical(sin$code, "E_BAD_RECETARIO_EJEMPLO"); expect_identical(sin$status, 400L)
  expect_identical(err(.recetario_ejemplo_payload(pagina = "x"))$code, "E_BAD_RECETARIO_EJEMPLO")
  expect_identical(err(.recetario_ejemplo_payload(clase = "otra", tipo = "p_slide_1_grafico"))$code, "E_BAD_RECETARIO_EJEMPLO")
  no <- err(.recetario_ejemplo_payload(tipo = "p_slide_portada"))
  expect_identical(no$code, "E_RECETARIO_EJEMPLO_NO_EXISTE"); expect_identical(no$status, 404L)
  expect_identical(err(.recetario_ejemplo_payload(pagina = 9999))$code, "E_RECETARIO_EJEMPLO_NO_EXISTE")
  # Un archivo alterado no se sirve: el hash del catálogo manda.
  dir <- tempfile("ej"); dir.create(dir)
  file.copy(list.files(.recetario_ejemplos_dir(), full.names = TRUE), dir)
  writeBin(as.raw(1:10), file.path(dir, "lamina-p_slide_1_grafico-p124.webp"))
  local_mocked_bindings(.recetario_ejemplos_dir = function() dir)
  alt <- err(.recetario_ejemplo_payload(tipo = "p_slide_1_grafico"))
  expect_identical(alt$code, "E_RECETARIO_EJEMPLO_ALTERADO"); expect_identical(alt$status, 500L)
})

test_that("el índice lista los ejemplos sin las imágenes, para que el editor sepa dónde mostrar la pestaña", {
  idx <- .recetario_ejemplos_indice()
  expect_length(idx$ejemplos, length(.recetario_ejemplos_catalogo()$ejemplos))
  expect_null(idx$ejemplos[[1]]$data_uri)
  expect_null(idx$ejemplos[[1]]$archivo)
  expect_true(all(c("clase", "tipo", "pagina", "recetario") %in% names(idx$ejemplos[[1]])))
})
