# El ritmo de avance que alimenta los graficos del PDF de cliente.

diario_de_prueba <- function() {
  data.frame(
    Facultad = c("DERECHO", "DERECHO", "PSICOLOGIA"),
    `Día` = c("2026-09-07", "2026-09-09", "2026-09-08"),
    `Día de la semana` = c("lunes", "miércoles", "martes"),
    `Efectivas del día` = c(10, 30, 7),
    `Efectivas esperadas` = c(12, 25, 9),
    `Tasa de rendimiento de la facultad obtenida` = c(0.4, 0.6, 0.3),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

facultades_de_prueba <- function() {
  data.frame(
    Facultad = c("DERECHO", "PSICOLOGIA"),
    Muestra = c(100, 50),
    Sobremuestra = c(150, 75),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

test_that("el eje de dias es COMUN: un dia sin aplicar es un cero, no un hueco", {
  r <- monitoreo_aulas_ritmo_de_avance(diario_de_prueba(), facultades_de_prueba())
  expect_equal(r$dias, c("2026-09-07", "2026-09-08", "2026-09-09"))

  derecho <- r$facultades[[1L]]
  expect_equal(derecho$facultad, "DERECHO")
  # Derecho no aplico el 08: ese dia vale cero y el acumulado NO retrocede.
  expect_equal(derecho$serie$efectivas, c(10, 0, 30))
  expect_equal(derecho$serie$acumulado, c(10, 10, 40))

  psico <- r$facultades[[2L]]
  expect_equal(psico$serie$efectivas, c(0, 7, 0))
  expect_equal(psico$serie$acumulado, c(0, 7, 7))
})

test_that("el total es la suma del dia y su acumulado corre sobre esa suma", {
  r <- monitoreo_aulas_ritmo_de_avance(diario_de_prueba(), facultades_de_prueba())
  expect_equal(r$total$efectivas, c(10, 7, 30))
  expect_equal(r$total$acumulado, c(10, 17, 47))
  # El acumulado del ultimo dia es la suma de todo lo que entro.
  expect_equal(r$total$acumulado[[3L]], sum(diario_de_prueba()[["Efectivas del día"]]))
})

test_that("las metas salen de la tabla de facultades, no se recalculan", {
  r <- monitoreo_aulas_ritmo_de_avance(diario_de_prueba(), facultades_de_prueba())
  expect_equal(r$meta, 150)          # 100 + 50
  expect_equal(r$sobremuestra, 225)  # 150 + 75
  expect_equal(r$facultades[[1L]]$meta, 100)
  expect_equal(r$facultades[[1L]]$sobremuestra, 150)
})

test_that("el orden de los paneles es el de la tabla que el cliente ya vio", {
  fac <- facultades_de_prueba()[c(2L, 1L), , drop = FALSE]
  r <- monitoreo_aulas_ritmo_de_avance(diario_de_prueba(), fac)
  expect_equal(vapply(r$facultades, function(p) p$facultad, character(1)),
               c("PSICOLOGIA", "DERECHO"))
})

test_that("sin serie fechada no se inventa un ritmo", {
  expect_null(monitoreo_aulas_ritmo_de_avance(NULL, facultades_de_prueba()))
  expect_null(monitoreo_aulas_ritmo_de_avance(data.frame(), facultades_de_prueba()))
  # Una tabla sin la columna del dia tampoco: el eje no se puede construir.
  sin_dia <- diario_de_prueba()[, c("Facultad", "Efectivas del día"), drop = FALSE]
  expect_null(monitoreo_aulas_ritmo_de_avance(sin_dia, facultades_de_prueba()))
})

test_that("las aulas previstas por facultad cuentan TITULARES, no el banco", {
  plan <- list(
    list(faculty = "DERECHO", sample_role = "titular"),
    list(faculty = "DERECHO", sample_role = "titular"),
    list(faculty = "DERECHO", sample_role = "reserva"),
    list(faculty = "PSICOLOGIA", sample_role = "titular")
  )
  out <- prosecnurapp:::.marp_titulares_por_facultad(plan)
  expect_equal(as.numeric(out[["DERECHO"]]), 2)
  expect_equal(as.numeric(out[["PSICOLOGIA"]]), 1)
  expect_equal(sum(out), 3)
  expect_length(prosecnurapp:::.marp_titulares_por_facultad(list()), 0L)
})

test_that("el periodo de campo se redacta desde el eje de dias", {
  r <- monitoreo_aulas_ritmo_de_avance(diario_de_prueba(), facultades_de_prueba())
  expect_equal(prosecnurapp:::.marp_periodo_de_campo(r),
               "Del 07 al 09 de septiembre de 2026")
  # Un solo dia no se redacta como un rango.
  uno <- list(dias = "2026-09-07")
  expect_equal(prosecnurapp:::.marp_periodo_de_campo(uno), "07 de septiembre de 2026")
  # Sin dias, la portada calla en vez de escribir un rango vacio.
  expect_equal(prosecnurapp:::.marp_periodo_de_campo(list()), "")
})

test_that("el corte da el DIA, y el dia que fue en Lima", {
  # Sin hora: dentro del operativo importa —hay dias con dos cortes— pero en la
  # portada se lee como una precision que promete mas de lo que el dato tiene.
  expect_equal(prosecnurapp:::.marp_corte_legible("2026-09-09T21:50:21Z"),
               "09 de septiembre de 2026")
  # La zona horaria se aplica ANTES de quedarse con el dia: las 02:00 UTC del 10
  # son todavia el 9 en Lima, y sin convertir el corte saldria fechado un dia
  # despues del que fue.
  expect_equal(prosecnurapp:::.marp_corte_legible("2026-09-10T02:00:00Z"),
               "09 de septiembre de 2026")
  expect_equal(prosecnurapp:::.marp_corte_legible(""), "")
})

test_that("las cuatro superficies que listan facultades comparten un solo orden", {
  # El orden lo fija `.calaf_avance_por_facultad()` —por lo que FALTA, no
  # alfabetico: la facultad que peor va abre la tabla— y las demas superficies lo
  # HEREDAN. Si alguna reordenara por su cuenta, el documento se contradiria al
  # pasar de pagina: la tercera fila de «Metas» dejaria de ser la tercera de
  # «Detalle». Esta prueba fija la herencia; no reimplementa el criterio.
  fac <- data.frame(
    Facultad = c("PRIMERA", "SEGUNDA", "TERCERA"),
    Muestra = c(100, 100, 100), Sobremuestra = c(150, 150, 150),
    `Faltantes muestra` = c(80, 10, 40),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  diario <- data.frame(
    Facultad = rep(c("PRIMERA", "SEGUNDA", "TERCERA"), each = 2L),
    `Día` = rep(c("2026-09-07", "2026-09-08"), 3L),
    `Día de la semana` = "lunes",
    `Efectivas del día` = c(5, 5, 1, 1, 3, 3),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  r <- monitoreo_aulas_ritmo_de_avance(diario, fac)
  expect_equal(vapply(r$facultades, function(p) p$facultad, character(1)),
               as.character(fac$Facultad))

  # Y una facultad que tiene serie pero NO esta en la tabla va al final, nunca
  # intercalada: el orden de la tabla manda sobre el alfabetico.
  diario_extra <- rbind(diario, data.frame(
    Facultad = "AJENA", `Día` = "2026-09-07", `Día de la semana` = "lunes",
    `Efectivas del día` = 9, check.names = FALSE, stringsAsFactors = FALSE))
  r2 <- monitoreo_aulas_ritmo_de_avance(diario_extra, fac)
  expect_equal(vapply(r2$facultades, function(p) p$facultad, character(1)),
               c("PRIMERA", "SEGUNDA", "TERCERA", "AJENA"))
})
