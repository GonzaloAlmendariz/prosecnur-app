# El kit de dashboard del sistema Pulso PDF.
#
# Se prueban las REGLAS, no el trazo: lo que decide una altura, una escala o un
# override. Las tres regresiones de aquí abajo salieron de defectos que el
# código no señalaba y que sólo se veían mirando el PDF renderizado.

test_that("el relleno nunca pasa de su meta, aunque se haya superado", {
  # Gonzalo, 2026-09-11: «a veces el 100 % puede sobrepasar como 123 % por
  # ejemplo, pero la barra debe quedarse en 100 %».
  expect_equal(prosecnurapp:::.ppd_alto_relleno(0.30, 0.20), 0.20)
  expect_equal(prosecnurapp:::.ppd_alto_relleno(0.12, 0.20), 0.12)
  # Sin meta no hay tope que aplicar: se pinta lo que hay.
  expect_equal(prosecnurapp:::.ppd_alto_relleno(0.30, NA_real_), 0.30)
  expect_equal(prosecnurapp:::.ppd_alto_relleno(0.30, 0), 0.30)
})

test_that("el eje se redondea a pasos legibles y siempre cubre el maximo", {
  eje <- prosecnurapp:::.ppd_eje_bonito(1063)
  expect_true(max(eje) >= 1063)
  expect_equal(eje[[1L]], 0)
  expect_true(length(unique(diff(eje))) == 1L)
  expect_equal(max(prosecnurapp:::.ppd_eje_bonito(0)), 1)
})

test_that("la portada es un override opt-in: lo escrito gana, lo vacio no borra", {
  defectos <- list(titulo = "Avance del trabajo de campo", subtitulo = "Cursos-horario",
                   cliente = "", periodo = "Del 07 al 09 de septiembre", corte = "09/09", nota = "")
  out <- pulso_pdf_portada_normalizar(defectos, list(cliente = "PUCP", titulo = "  "))
  expect_equal(out$cliente, "PUCP")
  # Un campo en blanco NO pisa al defecto: se conserva lo que el motor derivo.
  expect_equal(out$titulo, "Avance del trabajo de campo")
  expect_equal(out$periodo, "Del 07 al 09 de septiembre")
  # Todos los campos existen siempre, aunque nadie los haya escrito.
  expect_setequal(names(out), c("titulo", "subtitulo", "cliente", "periodo", "corte", "nota"))
  expect_true(all(vapply(out, function(v) is.character(v) && length(v) == 1L, logical(1))))
})

test_that("pulso_pdf_abrir usa la geometria del kit y no el defecto de 7x7", {
  # La regresion: el reporte pedia `geo$w_in`/`geo$h_in`, que no existen, y
  # `pdf()` caia en silencio a 7x7 pulgadas. El documento salia cuadrado y el
  # «apaisado» no era apaisado. Se mide sobre el MediaBox del archivo.
  destino <- tempfile(fileext = ".pdf")
  pulso_pdf_abrir(destino, geo = pulso_pdf_geo("landscape"))
  grid::grid.newpage()
  grid::grid.text("x")
  grDevices::dev.off()

  # En BYTES: un PDF trae binario y `readLines()` revienta al traducirlo.
  bytes <- readBin(destino, "raw", file.size(destino))
  bytes <- bytes[bytes != as.raw(0)]   # el nul incrustado rompe rawToChar()
  crudo <- rawToChar(bytes)
  caja <- regmatches(crudo, regexpr("/MediaBox *\\[[^]]+\\]", crudo, useBytes = TRUE))
  expect_true(length(caja) == 1L)
  numeros <- as.numeric(strsplit(gsub("[^0-9. ]", " ", caja), " +")[[1L]])
  numeros <- numeros[is.finite(numeros) & numeros > 0]
  expect_equal(round(max(numeros)), 841)   # 11,69 pulgadas de ancho
  expect_equal(round(min(numeros)), 595)   # 8,27 de alto
  expect_true(max(numeros) > min(numeros)) # apaisado, no cuadrado

  geo_rota <- list(page_w = NULL, page_h = NULL)
  expect_error(pulso_pdf_abrir(tempfile(fileext = ".pdf"), geo = geo_rota), "page_w")
})

test_that("los colores de sexo del PDF son los mismos que los de la pantalla", {
  # Si divergen, el documento contradice a la herramienta con la que se hizo.
  tok <- pulso_pdf_tokens()
  expect_equal(tolower(tok$sexo_h), "#4a6eb6")  # --pulso-module-dashboard
  expect_equal(tolower(tok$sexo_m), "#c2416b")  # --pulso-accent-rose
})
