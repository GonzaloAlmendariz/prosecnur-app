# ADR 0100, pieza P2: la base depurada fuera de la app declara de dónde viene.
#
# Caso real: HSyVBG 2026 recibió 3 327 efectivas, un script en R quitó 9
# (3 críticas y 6 ambiguas) y la base se cargó con 3 318.

.oe_lista <- function() {
  data.frame(
    `_uuid` = c("a", "b", "c"),
    Motivo = c("patrón de burla", "duración 2 min", ""),
    Categoría = c("crítico", "ambiguo", "ambiguo"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

test_that("la lista se normaliza con los nombres de columna de Kobo", {
  ex <- .origen_externo_normalizar_exclusiones(.oe_lista())
  expect_identical(ex$id, c("a", "b", "c"))
  expect_identical(ex$categoria, c("crítico", "ambiguo", "ambiguo"))
  expect_error(
    .origen_externo_normalizar_exclusiones(data.frame(x = 1)),
    class = "api_error"
  )
})

test_that("una lista que cuadra con la base no trae avisos de fondo", {
  ex <- .origen_externo_normalizar_exclusiones(.oe_lista())
  out <- origen_externo_construir(ex, ids_base = c("d", "e"), n_recibidas = 5L,
                                  script = "limpieza.R", version = "v3", data_file_id = "f1")
  expect_identical(out$bloque$n_recibidas, 5L)
  expect_identical(out$bloque$n_entregadas, 2L)
  expect_identical(out$bloque$n_excluidas, 3L)
  expect_false(out$bloque$n_recibidas_deducida)
  codigos <- vapply(out$avisos, `[[`, "", "codigo")
  expect_identical(codigos, "sin_motivo")
})

test_that("una exclusión que sigue en la base y un total que no cuadra se dicen", {
  ex <- .origen_externo_normalizar_exclusiones(.oe_lista())
  out <- origen_externo_construir(ex, ids_base = c("a", "d"), n_recibidas = 10L)
  codigos <- vapply(out$avisos, `[[`, "", "codigo")
  expect_true(all(c("siguen_en_la_base", "no_cuadra") %in% codigos))
  expect_match(out$avisos[[which(codigos == "no_cuadra")]]$mensaje, "faltan o sobran 5", fixed = TRUE)
})

test_that("sin n_recibidas se deduce y se declara deducida", {
  ex <- .origen_externo_normalizar_exclusiones(.oe_lista())
  out <- origen_externo_construir(ex, ids_base = c("d", "e"))
  expect_identical(out$bloque$n_recibidas, 5L)
  expect_true(out$bloque$n_recibidas_deducida)
})

test_that("una base recargada deja la declaración «para otra base»", {
  ex <- .origen_externo_normalizar_exclusiones(.oe_lista())
  b <- origen_externo_construir(ex, "d", data_file_id = "f1")$bloque
  expect_identical(.origen_externo_estado(b, "f1"), "vigente")
  expect_identical(.origen_externo_estado(b, "f2"), "otra_base")
  expect_identical(.origen_externo_estado(NULL, "f1"), "")
})

test_that("el resumen para la ficha lleva totales y categorías, nunca identificadores", {
  ex <- .origen_externo_normalizar_exclusiones(.oe_lista())
  b <- origen_externo_construir(ex, c("d", "e"), data_file_id = "f1")$bloque
  r <- .origen_externo_resumen(b)
  expect_identical(c(r$recibidas, r$excluidas, r$entregadas), c(5L, 3L, 2L))
  por <- stats::setNames(vapply(r$por_categoria, `[[`, 0L, "n"),
                         vapply(r$por_categoria, `[[`, "", "categoria"))
  expect_identical(por[["ambiguo"]], 2L)
  expect_identical(por[["crítico"]], 1L)
  expect_false(any(grepl("\"a\"|\"b\"", deparse(r))))
})
