source("setup-load-all.R")

# «Invertir el orden de las barras» en una batería por variable (p_barras_multiapiladas, modo var). El compositor
# ordena esas baterías por Top Two Box DESPUÉS de que la espec invierte el origen, así que el mando quedaba mudo:
# CCSS 2026-11-04, lámina 061, mismo PPTX con TRUE y con FALSE. Invertido, el Top Two Box va de menor a mayor.

espec_de <- function(invertir) {
  list(filas = data.frame(id = c("T", "a", "b", "c"), es_total = c(TRUE, FALSE, FALSE, FALSE)),
       box = list(unidades = c(T = 50, a = 20, b = 70, c = 40)),
       orden = list(criterio = "declarado", origen = if (invertir) 4:1 else 1:4, aplicado = 1:4, invertir = invertir))
}

test_that("sin invertir, el Top Two Box va de mayor a menor con el Total primero", {
  e <- .espec_ordenar_por_box(espec_de(FALSE))
  expect_identical(e$filas$id[e$orden$aplicado], c("T", "b", "c", "a"))
})

test_that("invertido, el Top Two Box va de menor a mayor y el Total sigue primero", {
  e <- .espec_ordenar_por_box(espec_de(TRUE))
  expect_identical(e$filas$id[e$orden$aplicado], c("T", "a", "c", "b"))
})

test_that("una espec sin el campo `invertir` (guardada antes) ordena como siempre", {
  e0 <- espec_de(FALSE); e0$orden$invertir <- NULL
  expect_identical(.espec_ordenar_por_box(e0)$orden$aplicado, c(1L, 3L, 4L, 2L))
})

test_that("preparar_escala guarda el mando en la espec", {
  d <- data.frame(item = c("x", "y"), et = c("X", "Y"), n = c(10, 10), p1 = c(30, 80), p2 = c(70, 20))
  for (inv in c(FALSE, TRUE)) {
    e <- preparar_escala(d, var_categoria = "item", var_n = "n", cols_porcentaje = c("p1", "p2"),
                         etiquetas_grupos = c("Sí", "No"), var_etiqueta_categoria = "et", escala_valor = "proporcion_100",
                         invertir_barras = inv)
    expect_identical(e$orden$invertir, inv)
  }
})
