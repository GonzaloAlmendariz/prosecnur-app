# Los BORDES del reporte de avance: qué imprime cuando falta lo que siempre hubo.
#
# Todo el pulido se hizo sobre el mismo estudio —quince facultades, cinco
# jornadas, sobremuestra publicada—. Estas pruebas fijan lo que pasa fuera de ahí.

modelo_de_prueba <- function(n_facultades = 3L, dias = 3L, sobremuestra = TRUE) {
  fac <- data.frame(Facultad = paste("FACULTAD", seq_len(n_facultades)),
                    stringsAsFactors = FALSE, check.names = FALSE)
  rellenar <- function(base) round(seq(base, base * n_facultades, length.out = n_facultades))
  fac[["Efectivas"]] <- rellenar(40); fac[["Efectivas hombres"]] <- rellenar(20)
  fac[["Efectivas mujeres"]] <- rellenar(20); fac[["Muestra"]] <- rellenar(100)
  fac[["Muestra hombres"]] <- rellenar(50); fac[["Muestra mujeres"]] <- rellenar(50)
  fac[["Faltantes muestra"]] <- rellenar(60); fac[["Faltantes hombres muestra"]] <- rellenar(30)
  fac[["Faltantes mujeres muestra"]] <- rellenar(30); fac[["Aulas aplicadas"]] <- rellenar(2)
  sm <- if (sobremuestra) rellenar(150) else rep(NA_real_, n_facultades)
  fac[["Sobremuestra"]] <- sm; fac[["Sobremuestra hombres"]] <- sm
  fac[["Sobremuestra mujeres"]] <- sm; fac[["Faltantes sobremuestra"]] <- sm
  fac[["Faltantes hombres sobremuestra"]] <- sm; fac[["Faltantes mujeres sobremuestra"]] <- sm

  ritmo <- NULL
  if (dias > 0L) {
    fechas <- format(as.Date("2026-09-07") + seq_len(dias) - 1L, "%Y-%m-%d")
    serie <- function(v) data.frame(dia = fechas, dia_semana = "lunes", efectivas = v,
                                    acumulado = cumsum(v), stringsAsFactors = FALSE)
    ritmo <- list(
      dias = fechas, dias_semana = rep("lunes", dias),
      total = serie(rep(20, dias)), meta = 100 * n_facultades,
      sobremuestra = if (sobremuestra) 150 * n_facultades else NA_real_,
      facultades = lapply(seq_len(n_facultades), function(i) {
        list(facultad = fac$Facultad[[i]], serie = serie(rep(5, dias)),
             meta = 100, sobremuestra = if (sobremuestra) 150 else NA_real_)
      })
    )
  }
  list(
    report_kind = "aulas_advance_pdf", family = "aulas_universitarias",
    facultades = fac, ritmo = ritmo,
    aulas_planificadas = stats::setNames(rep(5, n_facultades), fac$Facultad),
    total = list(muestra = 100 * n_facultades, conseguidas = 40 * n_facultades,
                 avance = 0.4, faltan = 60 * n_facultades, facultades_abiertas = n_facultades,
                 aulas_aplicadas = 2 * n_facultades,
                 sobremuestra = if (sobremuestra) 150 * n_facultades else NA_real_,
                 faltan_sobremuestra = if (sobremuestra) 110 * n_facultades else NA_real_),
    portada_defecto = list(titulo = "Avance", subtitulo = "", cliente = "",
                           periodo = "Del 07 al 09 de septiembre de 2026",
                           corte = "09 de septiembre de 2026", nota = ""),
    criterio = list(denominador = "la cuota", numerador = "las respuestas",
                    no_cubre = if (sobremuestra) "La sobremuestra se reparte." else "")
  )
}

paginas_del_pdf <- function(ruta) {
  bytes <- readBin(ruta, "raw", file.size(ruta))
  bytes <- bytes[bytes != as.raw(0)]
  crudo <- rawToChar(bytes)
  m <- regmatches(crudo, regexpr("/Count [0-9]+", crudo, useBytes = TRUE))
  as.integer(sub("/Count ", "", m[[1L]]))
}

test_that("el documento se genera en los tres bordes y no se queda sin paginas", {
  for (caso in list(
    list(nombre = "una facultad", m = modelo_de_prueba(1L)),
    list(nombre = "sin ritmo", m = modelo_de_prueba(3L, dias = 0L)),
    list(nombre = "sin sobremuestra", m = modelo_de_prueba(3L, sobremuestra = FALSE)),
    list(nombre = "cuatro facultades", m = modelo_de_prueba(4L))
  )) {
    destino <- tempfile(fileext = ".pdf")
    expect_no_error(monitoreo_aulas_advance_report_pdf(caso$m, destino))
    expect_true(file.exists(destino), info = caso$nombre)
    expect_gte(paginas_del_pdf(destino), 4L)
  }
})

test_that("con UNA sola facultad no se imprime la hoja de paneles", {
  # Su serie es identica a la del grafico global: la suma de una facultad es esa
  # facultad, asi que la hoja repetiria el dibujo anterior con otro tamano.
  una <- tempfile(fileext = ".pdf"); dos <- tempfile(fileext = ".pdf")
  monitoreo_aulas_advance_report_pdf(modelo_de_prueba(1L), una)
  monitoreo_aulas_advance_report_pdf(modelo_de_prueba(2L), dos)
  expect_equal(paginas_del_pdf(dos) - paginas_del_pdf(una), 1L)
})

test_that("sin sobremuestra el detalle es UNA hoja y no dos", {
  con <- tempfile(fileext = ".pdf"); sin <- tempfile(fileext = ".pdf")
  monitoreo_aulas_advance_report_pdf(modelo_de_prueba(3L), con)
  monitoreo_aulas_advance_report_pdf(modelo_de_prueba(3L, sobremuestra = FALSE), sin)
  expect_equal(paginas_del_pdf(con) - paginas_del_pdf(sin), 1L)
})

test_that("la rejilla de paneles se adapta al numero de facultades", {
  # Con la rejilla fija de tres columnas, un estudio de dos facultades dibujaba
  # dos paneles pequenos arriba a la izquierda y dejaba el 80 % de la hoja en
  # blanco: la superficie tiene que contener su propio vacio.
  r <- function(n) prosecnurapp:::.marp_rejilla_de_paneles(n)
  expect_equal(r(1L)$columnas, 1L)
  expect_equal(r(2L)$columnas, 2L)
  expect_equal(r(4L)$columnas, 2L)
  expect_equal(r(5L)$columnas, 3L)
  expect_equal(r(14L)$columnas, 3L)
  # Nunca cero columnas ni cero paneles por hoja, con cualquier entrada.
  for (n in 0:20) {
    expect_gte(r(n)$columnas, 1L)
    expect_gte(r(n)$por_hoja, 1L)
  }
})

test_that("el reparto de filas prefiere una hoja llena a dos medio vacias", {
  r <- prosecnurapp:::.marp_reparto_de_filas
  # Quince filas que caben apretando el renglon caben: una sola hoja. Es el caso
  # que fallaba —salian dos hojas de ocho y siete con media pagina en blanco en
  # cada una— porque la regla estaba escrita dos veces y una copia se habia
  # quedado sin esta mitad.
  uno <- r(15L, arriba = 0.763, abajo = 0.115, alto_max = 0.046, alto_min = 0.036)
  expect_equal(uno$hojas, 1L)
  expect_equal(uno$por_hoja, 15L)
  expect_lte(uno$alto, 0.046)
  expect_gte(uno$alto, 0.036)

  # Lo que de verdad no cabe se reparte PAREJO, no llenando la primera.
  muchas <- r(40L, arriba = 0.763, abajo = 0.115, alto_max = 0.046, alto_min = 0.036)
  expect_gt(muchas$hojas, 1L)
  expect_lte(abs(muchas$por_hoja * muchas$hojas - 40L), muchas$hojas)
  expect_equal(muchas$alto, 0.046)  # ya no se aprieta: no serviria de nada

  # Nunca cero filas por hoja, con cualquier n.
  for (n in c(1L, 2L, 7L, 13L, 25L, 60L)) {
    out <- r(n, arriba = 0.763, abajo = 0.115, alto_max = 0.046, alto_min = 0.036)
    expect_gte(out$por_hoja, 1L)
    expect_gte(out$hojas, 1L)
    expect_gte(out$por_hoja * out$hojas, n)
  }
  # Y tampoco con un area de tabla absurda.
  degenerado <- r(10L, arriba = 0.2, abajo = 0.3, alto_max = 0.046, alto_min = 0.036)
  expect_gte(degenerado$por_hoja, 1L)
})

test_that("las hojas de paneles se reparten parejas y ninguna queda coja", {
  r <- prosecnurapp:::.marp_rejilla_de_paneles
  # Catorce facultades daban 6+6+2: la ultima hoja con dos paneles arriba a la
  # izquierda y media pagina en blanco.
  catorce <- r(14L)
  expect_equal(catorce$hojas, 3L)
  expect_equal(catorce$por_hoja, 5L)
  # Ninguna hoja se pasa de su cabida (columnas x 2 filas).
  for (n in 1:40) {
    out <- r(n)
    expect_lte(out$por_hoja, out$columnas * 2L)
    expect_gte(out$por_hoja * out$hojas, n)
    expect_gte(out$hojas, 1L)
  }
})
