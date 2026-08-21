# «CORTAS VS TOTAL» enseñaba **0.182 · 0.818 · 0.077 · 0.923**.
#
# El arreglo de `7d0c22a7` —«un rotulo que dice % enseña un porcentaje»— alcanzo
# a «% EFECTIVAS ESPERADO/OBTENIDO» y a «% ASISTENCIA», y dejo fuera a las
# cuatro razones que ya venian en la hoja: «VS TOTAL», «VS POBLACION», «CORTAS
# VS TOTAL» y «LARGAS VS TOTAL». El precedente aplicado al vecino y no a estas,
# que es el patron que mas veces ha aparecido en este loop.
#
# La escala la decide CADA COLUMNA por separado: las llena el equipo en su Excel
# y nada obliga a que las cuatro vengan igual. Un 76.5 ya escrito en 0-100 no se
# puede volver a multiplicar — saldria 7 650 %.

.crc_libro <- function(control) {
  ruta <- tempfile(fileext = ".xlsx")
  plan <- lapply(seq_along(control), function(i) list(
    classroom_id = paste0("A", i), operational_code = paste("CH", i), label = "x",
    wave = "M1", sample_role = "titular", orden = i, eligible_n = 30
  ))
  aulas_libro_generar(plan, ruta, control = control)
  ruta
}

.crc_formato <- function(ruta, titulo, fila) {
  d <- openxlsx::read.xlsx(ruta, sheet = "Base de control", colNames = FALSE,
                           skipEmptyRows = FALSE)
  col <- NA_integer_
  for (j in seq_len(ncol(d))) {
    if (any(as.character(d[[j]]) == titulo, na.rm = TRUE)) { col <- j; break }
  }
  if (is.na(col)) return(NA_character_)
  formato_de_celda(ruta, "Base de control", col, fila)
}

test_that("una razon en 0-1 se enseña como porcentaje", {
  control <- list(
    list(operational_code = "CH 1", short_vs_total = 0.182, long_vs_total = 0.818),
    list(operational_code = "CH 2", short_vs_total = 0.077, long_vs_total = 0.923)
  )
  ruta <- .crc_libro(control)
  on.exit(unlink(ruta), add = TRUE)
  for (t in c("CORTAS VS TOTAL", "LARGAS VS TOTAL")) {
    f <- .crc_formato(ruta, t, 3L)
    expect_true(grepl("%", f %||% ""),
                info = paste0(t, " se escribe con el formato '", f, "'"))
  }
})

test_that("una razon YA escrita en 0-100 no se multiplica otra vez", {
  # El control que discrimina: si el formato fuera «porcentaje» siempre, un 76.5
  # saldria como 7 650 %. Es la trampa que ya costo una reparacion en la hoja de
  # campo, y por eso la escala se decide por la COLUMNA ENTERA.
  control <- list(
    list(operational_code = "CH 1", short_vs_total = 18.2, long_vs_total = 81.8),
    list(operational_code = "CH 2", short_vs_total = 7.7, long_vs_total = 92.3)
  )
  ruta <- .crc_libro(control)
  on.exit(unlink(ruta), add = TRUE)
  for (t in c("CORTAS VS TOTAL", "LARGAS VS TOTAL")) {
    f <- .crc_formato(ruta, t, 3L)
    expect_false(grepl("%", f %||% ""),
                 info = paste0(t, " en 0-100 se escribe con '", f, "' y saldria x100"))
  }
})

test_that("cada columna decide su propia escala", {
  # Mezcladas a proposito: una en 0-1 y la otra en 0-100 en el MISMO libro. Una
  # decision unica para las cuatro se equivocaria en la mitad.
  control <- list(
    list(operational_code = "CH 1", short_vs_total = 0.182, long_vs_total = 81.8),
    list(operational_code = "CH 2", short_vs_total = 0.077, long_vs_total = 92.3)
  )
  ruta <- .crc_libro(control)
  on.exit(unlink(ruta), add = TRUE)
  expect_true(grepl("%", .crc_formato(ruta, "CORTAS VS TOTAL", 3L) %||% ""))
  expect_false(grepl("%", .crc_formato(ruta, "LARGAS VS TOTAL", 3L) %||% ""))
})
