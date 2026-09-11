# «Avance de agendación» medía inventario, no avance.
#
# Gonzalo, 2026-09-10: «avance está muy bien, las dos primeras hojas están
# superbién… la hoja que tiene que ver con las agendaciones todavía le falta
# muchísimo para verse bien». Y no era el formato: la comparé celda a celda con
# «Avance de campo» y tienen el mismo navy, la misma cabecera, las mismas dos
# filas congeladas y anchos casi iguales. La diferencia es que aquélla lleva un
# `Avance muestra` contra la cuota y ésta tenía ONCE columnas y ninguna era una
# fracción. Una dice qué parte del trabajo va hecha; la otra, cuántas hay.

test_that("el bloque por facultad declara qué fracción va agendada", {
  expect_true("Agendado" %in% prosecnurapp:::AULAS_AGENDACION_CABECERAS$facultad)
  expect_true(prosecnurapp:::.calan_es_proporcion("Agendado", "facultad"))
})

test_that("un conteo NO se confunde con una proporción", {
  # Por tipo no se distinguen —las dos son numéricas— y un porcentaje sobre un
  # conteo pintaría «152» como «15 200 %».
  for (conteo in c("Slots", "Agendadas", "Aplicadas", "Por aplicar", "Rechazos")) {
    expect_false(prosecnurapp:::.calan_es_proporcion(conteo, "facultad"),
                 info = conteo)
  }
  # Y la declaración es por TABLA: «Agendado» no existe en las otras.
  expect_false(prosecnurapp:::.calan_es_proporcion("Agendado", "semana"))
})

test_that("Sheets recibe el porcentaje como NÚMERO, sobre su columna y nadie más", {
  # «el (%) significa que va en porcentaje, no que les pongas "(%)" al título»:
  # el porcentaje vive en la celda, así que la celda tiene que ser un número.
  cab <- prosecnurapp:::AULAS_AGENDACION_CABECERAS$facultad
  rows <- list(
    as.list(c("Avance de agendación", rep("", length(cab) - 1L))),
    as.list(c("Agendación por facultad", rep("", length(cab) - 1L))),
    as.list(cab),
    as.list(c("DERECHO", 19, 13, 0.684, 6, 7, rep(0, length(cab) - 6L))))
  reqs <- aulas_libro_agendacion_formato_requests(1L, rows)
  pct <- Filter(function(x) {
    identical(tryCatch(x$repeatCell$cell$userEnteredFormat$numberFormat$type,
                       error = function(e) NULL), "PERCENT")
  }, reqs)
  expect_length(pct, 1L)
  rango <- pct[[1]]$repeatCell$range
  # La columna «Agendado», en base cero, y NO la de al lado.
  expect_identical(rango$startColumnIndex, which(cab == "Agendado") - 1L)
  expect_identical(rango$endColumnIndex, which(cab == "Agendado"))
  # Y sólo las filas de datos de ESA tabla, no la cabecera hacia arriba.
  expect_gte(rango$startRowIndex, 3L)
})

test_that("sin slots la fracción se declara vacía, no cero", {
  # «0 %» diría que no se ha agendado nada de algo que no existe.
  ag <- aulas_libro_agendacion(list())
  expect_true(is.null(ag$facultad) || !nrow(ag$facultad) ||
              all(!is.nan(ag$facultad$Agendado)))
})
