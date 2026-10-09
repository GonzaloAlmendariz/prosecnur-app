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
                           corte = "09 de septiembre de 2026", nota = "")
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
  # Con la rejilla fija, un estudio de dos facultades dibujaba dos paneles
  # pequenos arriba a la izquierda y dejaba el 80 % de la hoja en blanco: la
  # superficie tiene que contener su propio vacio.
  #
  # **Dos columnas como maximo, desde el 2026-09-11.** Cada panel lleva el mismo
  # grafico doble que «Ritmo del campo» —caja del acumulado, caja de las barras y
  # el eje de fechas—, y en un tercio de ancho esas tres bandas se aplastan. El
  # contrato anterior permitia tres.
  r <- function(n) prosecnurapp:::.marp_rejilla_de_paneles(n)
  expect_equal(r(1L)$columnas, 1L)
  expect_equal(r(2L)$columnas, 2L)
  expect_equal(r(5L)$columnas, 2L)
  expect_equal(r(14L)$columnas, 2L)
  # Nunca cero columnas ni cero paneles por hoja, con cualquier entrada.
  for (n in 0:20) {
    expect_gte(r(n)$columnas, 1L)
    expect_lte(r(n)$columnas, 2L)
    expect_gte(r(n)$por_hoja, 1L)
  }
})

test_that("las hojas de paneles se reparten parejas y ninguna queda coja", {
  r <- prosecnurapp:::.marp_rejilla_de_paneles
  # Catorce facultades a cuatro por hoja darian 4+4+4+2: la ultima con dos
  # paneles y media pagina en blanco. Repartidas, cuatro hojas parejas.
  catorce <- r(14L)
  expect_equal(catorce$hojas, 4L)
  expect_equal(catorce$por_hoja, 4L)
  # Ninguna hoja se pasa de su cabida (columnas x 2 filas).
  for (n in 1:40) {
    out <- r(n)
    expect_lte(out$por_hoja, out$columnas * 2L)
    expect_gte(out$por_hoja * out$hojas, n)
    expect_gte(out$hojas, 1L)
  }
})

test_that("el plan del documento coincide con las paginas que salen del PDF", {
  # **El contrato que faltaba.** Todo el pulido de este reporte se verifico
  # abriendo el archivo y contando, con runners que mueren con la sesion. Aqui el
  # documento declara sus secciones y se comprueba que el PDF salga con esas
  # hojas: si el bucle de dibujo y el plan divergen —que es lo que pasaba cuando
  # el total se sumaba a mano—, esto falla.
  #
  # La portada no entra en el plan: no lleva folio. Por eso el PDF tiene siempre
  # una pagina mas que la suma de las secciones.
  for (caso in list(
    list(nombre = "quince facultades", m = modelo_de_prueba(15L)),
    list(nombre = "una facultad", m = modelo_de_prueba(1L)),
    list(nombre = "sin ritmo", m = modelo_de_prueba(3L, dias = 0L)),
    list(nombre = "sin sobremuestra", m = modelo_de_prueba(3L, sobremuestra = FALSE)),
    list(nombre = "cuatro facultades", m = modelo_de_prueba(4L))
  )) {
    destino <- tempfile(fileext = ".pdf")
    monitoreo_aulas_advance_report_pdf(caso$m, destino)
    hojas_detalle <- if (is.finite(suppressWarnings(as.numeric(caso$m$total$sobremuestra)))) 2L else 1L
    plan <- prosecnurapp:::monitoreo_aulas_plan_del_documento(
      caso$m, hojas_detalle = hojas_detalle, paginas_detalle = 1L)
    expect_equal(paginas_del_pdf(destino), sum(plan$hojas) + 1L, info = caso$nombre)
    # Ninguna seccion declarada con cero hojas: o esta, o no esta.
    expect_true(all(plan$hojas >= 1L), info = caso$nombre)
  }
})

test_that("el plan apaga las secciones que el estudio no tiene", {
  plan <- function(m, ...) prosecnurapp:::monitoreo_aulas_plan_del_documento(m, ...)
  completo <- plan(modelo_de_prueba(15L), hojas_detalle = 2L)
  expect_true("Ritmo del campo" %in% completo$seccion)
  expect_true("Ritmo de cada facultad" %in% completo$seccion)

  # Sin serie fechada no hay ninguna de las dos secciones de ritmo.
  sin_ritmo <- plan(modelo_de_prueba(3L, dias = 0L))
  expect_false(any(grepl("Ritmo", sin_ritmo$seccion)))

  # Con una sola facultad, su panel repetiria el grafico general.
  una <- plan(modelo_de_prueba(1L))
  expect_true("Ritmo del campo" %in% una$seccion)
  expect_false("Ritmo de cada facultad" %in% una$seccion)

  # El orden es el de impresion, y el resumen siempre abre.
  expect_equal(completo$seccion[[1L]], "Resumen del avance")
})

test_that("una facultad que no esta en el plan no tumba el reporte", {
  # `aulas_plan[[nombre]]` con un nombre ausente LANZA «subscript out of bounds»
  # —no devuelve NULL—, asi que el `%||%` que venia detras nunca actuaba. Se
  # descubrio renderizando un estudio de treinta facultades: con las quince de
  # HSVG2026 no aparece, porque todas estan en el plan.
  previstas <- prosecnurapp:::.marp_previstas_de
  plan <- stats::setNames(c(19, 37), c("DERECHO", "CIENCIAS"))
  expect_equal(previstas(plan, "DERECHO"), 19)
  expect_true(is.na(previstas(plan, "FACULTAD QUE NO ESTA")))
  expect_true(is.na(previstas(numeric(0), "DERECHO")))
  expect_true(is.na(previstas(c(1, 2), "DERECHO")))   # sin nombres

  # Y el documento entero se genera con una facultad fuera del plan.
  m <- modelo_de_prueba(3L)
  m$aulas_planificadas <- m$aulas_planificadas[1L]
  destino <- tempfile(fileext = ".pdf")
  expect_no_error(monitoreo_aulas_advance_report_pdf(m, destino))
  expect_gte(paginas_del_pdf(destino), 4L)
})
