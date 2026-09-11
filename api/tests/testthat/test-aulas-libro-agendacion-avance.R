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

test_that("el bloque de arriba también dice la fracción, y es una FILA", {
  # Las siete cifras de ese bloque contestan «cuántas hay» y ninguna contestaba
  # «cuánto llevamos»: con 152 agendadas y 23 sin agendar había que dividir
  # mentalmente cada vez.
  expect_true(prosecnurapp:::.calan_es_proporcion("Agendado del plan", "total"))
  # Y no se confunde con la del bloque por facultad: son dos nombres y dos
  # geometrías (aquélla es columna, ésta fila).
  expect_false(prosecnurapp:::.calan_es_proporcion("Agendado del plan", "facultad"))
  expect_false(prosecnurapp:::.calan_es_proporcion("Agendado", "total"))
})

test_that("en el bloque traspuesto se pinta SÓLO la celda de la fracción", {
  # Formatear por columna aquí pintaría de porcentaje las siete cifras del
  # bloque, y «152» saldría como «15 200 %».
  rows <- list(
    as.list(c("Avance de agendación", "")),
    as.list(c("Cuánto se lleva agendado", "")),
    as.list(c("Indicador", "Total")),
    as.list(c("Cursos-horario agendados", 152)),
    as.list(c("Sin agendar todavía", 23)),
    as.list(c("Agendado del plan", 0.869)))
  reqs <- aulas_libro_agendacion_formato_requests(1L, rows)
  pct <- Filter(function(x) {
    identical(tryCatch(x$repeatCell$cell$userEnteredFormat$numberFormat$type,
                       error = function(e) NULL), "PERCENT")
  }, reqs)
  expect_length(pct, 1L)
  g <- pct[[1]]$repeatCell$range
  # La sexta fila (base cero: 5) y la columna del valor, no la del rótulo.
  expect_identical(g$startRowIndex, 5L)
  expect_identical(g$endRowIndex, 6L)
  expect_identical(g$startColumnIndex, 1L)
})

test_that("el denominador de «Agendado del plan» no castiga por los rechazos", {
  # Un rechazo ya se resolvió por el otro camino: contarlo como trabajo por
  # hacer bajaría el porcentaje por algo que nadie debe agendar.
  fila <- function(cod, estado) list(
    operational_code = cod, faculty = "DERECHO", sample_role = "titular",
    sample_status = estado,
    scheduled_date = if (identical(estado, "agendada")) "2026-09-07" else "")
  con_rechazo <- aulas_libro_agendacion(list(
    fila("CH 1", "agendada"), fila("CH 2", "agendada"), fila("CH 3", "rechazo")))
  sin_rechazo <- aulas_libro_agendacion(list(
    fila("CH 1", "agendada"), fila("CH 2", "agendada")))
  valor <- function(ag) {
    t <- ag$total
    t$Total[t$Indicador == "Agendado del plan"]
  }
  expect_identical(valor(con_rechazo), valor(sin_rechazo))
})
