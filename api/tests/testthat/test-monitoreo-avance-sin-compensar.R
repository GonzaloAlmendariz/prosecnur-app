# El total de los PDF de avance de acreditación y territorial no compensa
# sobrantes entre grupos (`monitoreo_avance_sin_compensar.R`;
# docs/qa/formato-monitoreo-2026-11-02.md, pendiente 1).
#
# Fixture: un grupo sobre su mínimo (170 de 100) y otro debajo (40 de 100).
# Compensando, el total decía 210 de 200, 105.0 % y «faltan 0»: el campo se
# daba por cerrado con un grupo a 60 de su mínimo. Sin compensar: faltan 60 y
# el cumplimiento es 140 de 200 (100 + 40), 70.0 %.

# Los textos que dibuja el PDF, en orden. No depende de pdftotext (el CI no lo
# instala): se captura cada `grid::grid.text` y se deja que dibuje igual.
.asc_textos_del_pdf <- function(render) {
  textos <- character()
  original <- grid::grid.text
  testthat::local_mocked_bindings(
    grid.text = function(label, ...) {
      textos <<- c(textos, as.character(label))
      original(label, ...)
    },
    .package = "grid"
  )
  render()
  textos
}

# El texto que sigue a un rótulo (la cifra de una tarjeta o de una celda).
.asc_tras <- function(textos, rotulo, salto = 1L) {
  i <- which(textos == rotulo)
  if (!length(i)) return(NA_character_)
  textos[[i[[1]] + salto]]
}

.asc_modelo_acreditacion <- function() {
  list(
    actors = list(
      list(Actor = "Profesores", Universo = 400, Efectivas = 170, Parciales = 3, Meta = 100),
      list(Actor = "Estudiantes", Universo = 1000, Efectivas = 40, Parciales = 7, Meta = 100)
    ),
    daily_general = list(
      list(Fecha = "2026-10-29", Efectivas = 200),
      list(Fecha = "2026-10-30", Efectivas = 10)
    ),
    daily_actor = list(
      list(Actor = "Profesores", Fecha = "2026-10-29", Efectivas = 165),
      list(Actor = "Profesores", Fecha = "2026-10-30", Efectivas = 5),
      list(Actor = "Estudiantes", Fecha = "2026-10-29", Efectivas = 35),
      list(Actor = "Estudiantes", Fecha = "2026-10-30", Efectivas = 5)
    ),
    sources = list(),
    synced_at = "2026-10-31T12:00:00Z"
  )
}

# Como lo publica el modelo cliente: una fila por distrito y la fila TOTAL. La
# brecha del TOTAL ya venía sin compensar (60); el PDF la pisaba con
# max(0, 200 - 210) = 0.
.asc_modelo_territorial <- function() {
  list(avance_por_distrito = list(rows = list(
    list(Distrito = "Cercado", `Encuestas válidas` = 170, `Meta encuestas` = 100,
         `% avance encuestas` = 170, `Brecha encuestas` = 0),
    list(Distrito = "Cayma", `Encuestas válidas` = 40, `Meta encuestas` = 100,
         `% avance encuestas` = 40, `Brecha encuestas` = 60),
    list(Distrito = "TOTAL", `Encuestas válidas` = 210, `Meta encuestas` = 200,
         `% avance encuestas` = 105, `Brecha encuestas` = 60)
  )))
}

test_that("el total suma lo que falta en cada grupo y el cumplimiento cuenta sólo lo cubierto", {
  r <- .monitoreo_avance_sin_compensar(c(170, 40), c(100, 100))
  expect_equal(r$faltan, 60)
  expect_equal(r$cubierto, 140)
  expect_equal(r$minimo, 200)
  expect_equal(r$logrado, 210)
  expect_equal(r$pct, 70)
  expect_equal(r$faltan_por_grupo, c(0, 60))
  expect_equal(r$grupos_bajo_minimo, 1L)
  # Invariante exacto, sin tolerancia: lo cubierto más lo que falta es el mínimo.
  expect_identical(r$cubierto + r$faltan, r$minimo)
})

test_that("un grupo sin mínimo queda fuera del mínimo, de lo cubierto y de lo que falta", {
  r <- .monitoreo_avance_sin_compensar(c(170, 40, 25, NA), c(100, 100, NA, 50))
  expect_equal(r$con_minimo, c(TRUE, TRUE, FALSE, TRUE))
  expect_equal(r$minimo, 250)
  expect_equal(r$faltan, 110)
  expect_equal(r$cubierto, 140)
  expect_true(is.na(r$faltan_por_grupo[[3]]))
  vacio <- .monitoreo_avance_sin_compensar(c(10, 5), c(NA, 0))
  expect_equal(vacio$faltan, 0)
  expect_true(is.na(vacio$pct))
  expect_error(.monitoreo_avance_sin_compensar(1:2, 1), class = "api_error")
})

test_that("el PDF de acreditación no compensa: faltan 60 y el cumplimiento es 140 de 200", {
  textos <- .asc_textos_del_pdf(function() {
    monitoreo_acreditacion_client_report_pdf(.asc_modelo_acreditacion(), tempfile(fileext = ".pdf"),
                                             include_targets = TRUE)
  })
  # Tarjetas del resumen.
  expect_identical(.asc_tras(textos, "MÍNIMO", 1L), "60")
  expect_identical(.asc_tras(textos, "DEL MÍNIMO", 1L), "70.0%")
  expect_identical(.asc_tras(textos, "DEL MÍNIMO", 2L), "140 de 200")
  # Fila Total de la tabla por público: universo, completas, avance, frecuencia,
  # mínimo, su cobertura, cumplimiento, su frecuencia y faltan.
  total <- textos[which(textos == "Total")[[1]] + 1:9]
  expect_identical(total, c("1400", "210", "15.0%", "210 de 1400", "200", "14.3% del universo",
                            "70.0%", "140 de 200", "60"))
  # Las filas de cada público no cambian: el excedente se ve en su fila.
  expect_true("170 de 100" %in% textos)
  expect_true("170.0%" %in% textos)
  expect_false("105.0%" %in% textos)
  expect_false("210 de 200" %in% textos)
})

test_that("el PDF territorial no compensa: falta 60 y el cumplimiento es 140 de 200", {
  textos <- .asc_textos_del_pdf(function() {
    monitoreo_territorial_advance_report_pdf(.asc_modelo_territorial(), tempfile(fileext = ".pdf"),
                                             include_targets = TRUE)
  })
  i <- which(textos == "CUMPLIMIENTO DE LA CUOTA TERRITORIAL")[[1]]
  expect_identical(textos[[i + 1L]], "70.0%")
  expect_identical(textos[[i + 3L]], "140 / 200")
  expect_identical(.asc_tras(textos[i:length(textos)], "ENCUESTAS"), "210")
  expect_identical(.asc_tras(textos[i:length(textos)], "CUOTA"), "200")
  expect_identical(.asc_tras(textos[i:length(textos)], "FALTA"), "60")
  expect_false("105.0%" %in% textos)
  # Las tarjetas por distrito siguen leyendo su propio avance.
  expect_true("Faltan 60 encuestas" %in% textos)
  expect_true("170.0%" %in% textos)
})
