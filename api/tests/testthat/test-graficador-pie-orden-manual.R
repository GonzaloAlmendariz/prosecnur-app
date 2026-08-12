source("setup-load-all.R")

# La leyenda del pie cambiaba de orden entre láminas sin que nadie lo decidiera:
# `ordenar_categorias = "asc"` ordena por VALOR, así que depende de los datos de
# cada pregunta. En «Conta 11-08» la lámina 9 salía «No, Sí» y la 10 «Sí, No»,
# y las dos eran correctas según esa regla.

test_that("con el modo «manual» se aplica el orden declarado", {
  cats <- c("Sí", "No"); pct <- c(0.31, 0.69)
  expect_equal(cats[.pie_orden_categorias(cats, c("Sí","No"), "manual", pct)], c("Sí","No"))
  expect_equal(cats[.pie_orden_categorias(cats, c("No","Sí"), "manual", pct)], c("No","Sí"))
})

test_that("un modo automático NO lo pisa una declaración", {
  # Tener los dos controles vivos a la vez dejaba al analista con «Ascendente»
  # marcado viendo un orden que no era ascendente. Ahora el modo manda y el
  # editor manual sólo aparece cuando se elige «Manual».
  cats <- c("Sí", "No"); pct <- c(0.31, 0.69)
  expect_equal(cats[.pie_orden_categorias(cats, c("No","Sí"), "asc",  pct)], c("Sí","No"))
  expect_equal(cats[.pie_orden_categorias(cats, c("Sí","No"), "desc", pct)], c("No","Sí"))
  # El control: los mismos modos sin declaración dan lo mismo, así que la
  # declaración es efectivamente ignorada y no es que coincida por azar.
  expect_equal(.pie_orden_categorias(cats, c("No","Sí"), "asc", pct),
               .pie_orden_categorias(cats, NULL, "asc", pct))
})

test_that("un proyecto guardado antes del modo «manual» conserva su orden", {
  # Compatibilidad: la declaración viaja sin modo. Borrarle el orden al reabrir
  # sería peor que la incoherencia que esto viene a evitar.
  cats <- c("Sí", "No")
  expect_equal(cats[.pie_orden_categorias(cats, c("Sí","No"), "ninguno", c(0.31,0.69))],
               c("Sí","No"))
  expect_equal(cats[.pie_orden_categorias(cats, c("Sí","No"), "natural", c(0.31,0.69))],
               c("Sí","No"))
})

test_that("el orden manual no depende del dato", {
  # Es la propiedad que se busca: dos preguntas con valores opuestos y la misma
  # declaración salen igual, que es lo que el lector espera de una leyenda.
  o1 <- .pie_orden_categorias(c("Sí","No"), c("Sí","No"), "manual", c(0.31, 0.69))
  o2 <- .pie_orden_categorias(c("Sí","No"), c("Sí","No"), "manual", c(0.98, 0.02))
  expect_equal(o1, o2)
})

test_that("una declaración incompleta no hace desaparecer categorías", {
  cats <- c("A","B","C")
  o <- .pie_orden_categorias(cats, "C", "manual", pct = c(0.1, 0.2, 0.7))
  expect_equal(cats[o][1], "C")
  expect_setequal(cats[o], cats)
})

test_that("una etiqueta que no existe se ignora sin romper", {
  cats <- c("Sí","No")
  o <- .pie_orden_categorias(cats, c("Inexistente","No","Sí"), "manual", pct = c(0.31, 0.69))
  expect_equal(cats[o], c("No","Sí"))
})

test_that("sin modo ni declaración se conserva el orden de llegada", {
  cats <- c("B","A","C")
  expect_equal(cats[.pie_orden_categorias(cats, NULL, "ninguno", c(0.2,0.5,0.3))], cats)
})

test_that("casos degenerados devuelven un orden usable", {
  expect_equal(.pie_orden_categorias(character(0)), integer(0))
  # Sin `pct` los modos automáticos no pueden ordenar y no inventan nada.
  expect_equal(.pie_orden_categorias(c("A","B"), NULL, "desc", NULL), 1:2)
  expect_equal(.pie_orden_categorias(c("A","B"), NULL, "desc", c(NA, 1)), 1:2)
})

test_that("el graficador expone el argumento y nace vacío", {
  f <- formals(graficar_pie)
  expect_true("orden_categorias_manual" %in% names(f))
  expect_null(eval(f$orden_categorias_manual))
})
