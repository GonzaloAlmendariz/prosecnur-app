# Un marco con unidades sin estrato devuelve sus ids en `ids_sin_estrato`
# (L5 del loop de mejoras, 2026-09-27). Iban en `ids`, la misma clave que los
# tamaños inválidos del PPS, y la mesa los rotulaba «Ids con tamaño inválido».

test_that("L5: las unidades sin estrato viajan en ids_sin_estrato, no en ids", {
  marco <- data.frame(codigo = c("U1", "U2", "U9999"), grupo = c("A", "A", NA), peso = c(3, 4, 5))
  err <- tryCatch(
    .cm_general_preparar_marco(marco, list(id = "codigo", estrato = "grupo", tamano = "peso"), "mas"),
    api_error = function(e) e)
  expect_s3_class(err, "api_error")
  detalle <- err$details %||% err$detalles %||% attr(err, "details")
  expect_identical(unlist(detalle$ids_sin_estrato), "U9999")
  # [[ ]] y no $: `detalle$ids` casaría parcialmente con ids_sin_estrato.
  expect_null(detalle[["ids"]])
})
