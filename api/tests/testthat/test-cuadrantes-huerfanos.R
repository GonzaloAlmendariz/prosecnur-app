# B5 y B6. Una lamina de cuatro cuadrantes puede salir con dos graficos
# IGUALES o con un cuadrante que declara OTRO PUBLICO, y hasta ahora nada lo
# miraba: el mazo de Contabilidad entrego las dos cosas —la lamina 9 repite su
# grafico de Sexo y la 14, «PERFIL DEL PERSONAL ADMINISTRATIVO», lleva un
# cuadrante con «Base: 52 docentes»—. La vara no puede verlo porque mide
# geometria y esto es contenido.

EMU <- 914400

# El grupo del canvas se reconoce por su `chExt`, y `chOff == off` en todos los
# grupos del mazo real: por eso las `y` de los hijos se comparan directamente.
grupo <- function(x, y, w, h) sprintf(
  paste0('<a:xfrm><a:off x="%.0f" y="%.0f"/><a:ext cx="%.0f" cy="%.0f"/>',
         '<a:chOff x="%.0f" y="%.0f"/><a:chExt cx="%.0f" cy="%.0f"/></a:xfrm>'),
  x * EMU, y * EMU, w * EMU, h * EMU, x * EMU, y * EMU, w * EMU, h * EMU)

caja <- function(x, y, texto, w = 0.5, h = 0.12) sprintf(
  paste0('<p:sp><a:off x="%.0f" y="%.0f"/><a:ext cx="%.0f" cy="%.0f"/>',
         '<a:solidFill><a:srgbClr val="081F5C"/></a:solidFill>',
         '<a:t>%s</a:t></p:sp>'),
  x * EMU, y * EMU, w * EMU, h * EMU, texto)

# Dos cuadrantes lado a lado: el izquierdo con titulo, el derecho sin el —que es
# exactamente la forma del defecto real: al huerfano le falta la configuracion—.
lamina_repetida <- paste0(
  grupo(0.5, 1.0, 5.0, 2.5), grupo(7.0, 1.0, 5.0, 2.5),
  caja(0.6, 1.1, "Sexo"), caja(0.6, 1.3, "Masculino"), caja(0.6, 1.5, "52%"),
  caja(0.6, 1.7, "Femenino"), caja(0.6, 1.9, "48%"),
  caja(0.6, 2.1, "Base: 172 estudiantes"),
  caja(7.1, 1.3, "Masculino"), caja(7.1, 1.5, "52%"),
  caja(7.1, 1.7, "Femenino"), caja(7.1, 1.9, "48%"),
  caja(7.1, 2.1, "Base: 172 estudiantes"))


test_that("los grupos de canvas se cuentan y el icono cuadrado no entra", {
  expect_equal(length(.verif_grupos_canvas(lamina_repetida)), 2L)
  con_icono <- paste0(lamina_repetida, grupo(5.8, 3.2, 1.9, 1.9))
  expect_equal(length(.verif_grupos_canvas(con_icono)), 2L)
  # Un grupo cuadrado GRANDE si es un grafico: el filtro es cuadrado Y pequeno.
  con_cuadrado <- paste0(lamina_repetida, grupo(1, 4, 3.0, 3.0))
  expect_equal(length(.verif_grupos_canvas(con_cuadrado)), 3L)
})


test_that("cada texto cae en su cuadrante y la Base da el publico", {
  cu <- .verif_cuadrantes(lamina_repetida)
  expect_equal(length(cu), 2L)
  expect_equal(cu[[1]]$publico, "estudiantes")
  expect_equal(cu[[2]]$publico, "estudiantes")
  # La Base NO entra en la serie: si entrara, dos cuadrantes iguales seguirian
  # siendo iguales y la comparacion de publicos se quedaria sin dato limpio.
  expect_false(any(grepl("Base", cu[[1]]$series)))
  expect_true("Sexo" %in% cu[[1]]$series)
  expect_false("Sexo" %in% cu[[2]]$series)
})


test_that("B5 marca el grafico repetido aunque al huerfano le falte el titulo", {
  # ESTE es el assert que sostiene la regla: con igualdad de conjuntos el caso
  # real de la lamina 9 NO disparaba, porque al cuadrante malo le falta «Sexo».
  hits <- .verif_cuadrantes_repetidos(.verif_cuadrantes(lamina_repetida))
  expect_equal(length(hits), 1L)
  expect_equal(hits[[1]]$i, 1L)
  expect_equal(hits[[1]]$j, 2L)
  expect_gte(hits[[1]]$textos, 3L)
})


test_that("B5 no marca dos dicotomicas distintas ni coincidencias triviales", {
  distintas <- paste0(
    grupo(0.5, 1.0, 5.0, 2.5), grupo(7.0, 1.0, 5.0, 2.5),
    caja(0.6, 1.3, "Si"), caja(0.6, 1.5, "2%"), caja(0.6, 1.7, "No"),
    caja(0.6, 1.9, "98%"),
    caja(7.1, 1.3, "Si"), caja(7.1, 1.5, "3%"), caja(7.1, 1.7, "No"),
    caja(7.1, 1.9, "97%"))
  expect_equal(length(.verif_cuadrantes_repetidos(.verif_cuadrantes(distintas))), 0L)

  # Dos textos compartidos no son un grafico: hacen falta tres y una cifra.
  pobre <- paste0(
    grupo(0.5, 1.0, 5.0, 2.5), grupo(7.0, 1.0, 5.0, 2.5),
    caja(0.6, 1.3, "Si"), caja(0.6, 1.5, "No"),
    caja(7.1, 1.3, "Si"), caja(7.1, 1.5, "No"))
  expect_equal(length(.verif_cuadrantes_repetidos(.verif_cuadrantes(pobre))), 0L)

  sin_cifra <- paste0(
    grupo(0.5, 1.0, 5.0, 2.5), grupo(7.0, 1.0, 5.0, 2.5),
    caja(0.6, 1.3, "Si"), caja(0.6, 1.5, "No"), caja(0.6, 1.7, "Sin dato"),
    caja(7.1, 1.3, "Si"), caja(7.1, 1.5, "No"), caja(7.1, 1.7, "Sin dato"))
  expect_equal(length(.verif_cuadrantes_repetidos(.verif_cuadrantes(sin_cifra))), 0L)
})


test_that("B6 marca la MINORIA que declara otro publico", {
  cruzada <- paste0(
    grupo(0.5, 1.0, 5.0, 2.5), grupo(7.0, 1.0, 5.0, 2.5),
    grupo(0.5, 4.0, 5.0, 2.5), grupo(7.0, 4.0, 5.0, 2.5),
    caja(0.6, 2.1, "Base: 15 administrativos"),
    caja(7.1, 2.1, "Base: 15 administrativos"),
    caja(0.6, 5.1, "Base: 15 administrativos"),
    caja(7.1, 5.1, "Base: 52 docentes"))
  hits <- .verif_cuadrantes_publico_cruzado(.verif_cuadrantes(cruzada))
  expect_equal(length(hits), 1L)
  expect_equal(hits[[1]]$publico, "docentes")
  expect_equal(hits[[1]]$mayoria, "administrativos")
  expect_equal(hits[[1]]$n, 1L)
  expect_equal(hits[[1]]$n_mayoria, 3L)
})


test_that("B6 calla cuando no hay con que comparar", {
  # Un solo publico: nada que marcar.
  expect_equal(length(.verif_cuadrantes_publico_cruzado(
    .verif_cuadrantes(lamina_repetida))), 0L)
  # Una sola Base legible: no hay mayoria ni minoria, y callar es lo correcto.
  una_sola <- paste0(
    grupo(0.5, 1.0, 5.0, 2.5), grupo(7.0, 1.0, 5.0, 2.5),
    caja(0.6, 2.1, "Base: 15 administrativos"),
    caja(7.1, 1.3, "Si"))
  expect_equal(length(.verif_cuadrantes_publico_cruzado(
    .verif_cuadrantes(una_sola))), 0L)
})


test_that("una lamina de un solo canvas no entra en estas reglas", {
  sola <- paste0(grupo(0.5, 1.0, 12.0, 5.0),
                 caja(0.6, 1.3, "Masculino"), caja(0.6, 1.5, "52%"))
  expect_equal(length(.verif_cuadrantes(sola)), 0L)
})


test_that("verificar_mazo registra las dos reglas", {
  # Un `grepl` del nombre lo encontraria en el comentario que las explica: se
  # busca la LLAMADA a `add()`, que es lo que las mete en `$hallazgos`.
  ruta <- testthat::test_path("..", "..", "R", "graficos_verificar_mazo.R")
  skip_if_not(file.exists(ruta))
  src <- paste(readLines(ruta, warn = FALSE), collapse = "\n")
  expect_true(grepl('add("B5 grafico repetido", i,', src, fixed = TRUE))
  expect_true(grepl('add("B6 publico cruzado", i,', src, fixed = TRUE))
  expect_true(grepl("cuads <- .verif_cuadrantes(xml)", src, fixed = TRUE))
})
