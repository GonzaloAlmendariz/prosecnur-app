# El orden manual es un modo, no un control paralelo.
#
# El fallo que esto fija: el inspector mostraba «Mayor a menor» marcado y a la
# vez un orden manual declarado, y el manual ganaba en silencio. La regla vive
# en `.orden_manual_manda()` y no en cada graficador porque arreglarla en el pie
# dejó las barras agrupadas con el conflicto intacto — que es exactamente lo que
# pasó.

test_that("el modo automático elegido gana sobre una declaración manual", {
  om <- c("Sí", "No")

  # Pie: sus modos automáticos son asc/desc.
  expect_false(.orden_manual_manda(om, "asc",  c("asc", "desc")))
  expect_false(.orden_manual_manda(om, "desc", c("asc", "desc")))
  expect_true(.orden_manual_manda(om, "manual", c("asc", "desc")))

  # Agrupadas: los mismos modos se llaman distinto.
  expect_false(.orden_manual_manda(om, "mayor_menor", c("mayor_menor", "menor_mayor")))
  expect_false(.orden_manual_manda(om, "menor_mayor", c("mayor_menor", "menor_mayor")))
  expect_true(.orden_manual_manda(om, "manual", c("mayor_menor", "menor_mayor")))
})

test_that("sin declaración manual no manda nada, cualquiera sea el modo", {
  # El control que da sentido al resto: si la función devolviera TRUE por el
  # modo y no por la declaración, este bloque pasaría igual y el de arriba
  # también.
  for (modo in c("manual", "asc", "desc", "instrumento")) {
    expect_false(.orden_manual_manda(NULL, modo, c("asc", "desc")))
    expect_false(.orden_manual_manda(character(0), modo, c("asc", "desc")))
    expect_false(.orden_manual_manda(c("", NA_character_), modo, c("asc", "desc")))
  }
})

test_that("un proyecto guardado antes de que «Manual» existiera conserva su orden", {
  # Compatibilidad: la declaración viaja sin modo, o con el default del
  # graficador. Borrarle el orden al reabrir sería peor que la incoherencia.
  om <- c("Sí", "No")
  expect_true(.orden_manual_manda(om, NULL, c("asc", "desc")))
  expect_true(.orden_manual_manda(om, "ninguno", c("asc", "desc")))
  expect_true(.orden_manual_manda(om, "instrumento", c("mayor_menor", "menor_mayor")))
})

test_that("las barras agrupadas respetan el modo elegido", {
  df <- data.frame(
    categoria = c("Bajo", "Alto", "Medio"),
    n         = c(10L, 60L, 30L),
    pct_1     = c(0.10, 0.60, 0.30),
    stringsAsFactors = FALSE
  )
  niveles <- function(orden_barras, manual = NULL) {
    p <- graficar_barras_agrupadas(
      df,
      var_categoria           = "categoria",
      var_n                   = "n",
      cols_porcentaje         = "pct_1",
      etiquetas_series        = c(pct_1 = "Total"),
      orden_barras            = orden_barras,
      orden_categorias_manual = manual
    )
    levels(p$data[["categoria"]])
  }

  # Los tres modos automáticos, para saber contra qué se compara.
  expect_equal(niveles("instrumento"), c("Bajo", "Alto", "Medio"))
  expect_equal(niveles("mayor_menor"), c("Alto", "Medio", "Bajo"))
  expect_equal(niveles("menor_mayor"), c("Bajo", "Medio", "Alto"))

  # Con el modo en «manual», manda la declaración, en los dos sentidos: si sólo
  # se probara con un orden que ya coincide con el de los valores, el aserto no
  # distinguiría este arreglo de no haber hecho nada.
  expect_equal(niveles("manual", c("Alto", "Medio", "Bajo")), c("Alto", "Medio", "Bajo"))
  expect_equal(niveles("manual", c("Bajo", "Medio", "Alto")), c("Bajo", "Medio", "Alto"))

  # Y el aserto que fija el bug: con un modo automático elegido, una
  # declaración manual CONTRARIA no lo pisa. Antes ganaba en silencio.
  expect_equal(niveles("mayor_menor", c("Bajo", "Medio", "Alto")), c("Alto", "Medio", "Bajo"))
  expect_equal(niveles("menor_mayor", c("Alto", "Medio", "Bajo")), c("Bajo", "Medio", "Alto"))
})
