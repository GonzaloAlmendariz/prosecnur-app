# La lamina metodologica del aprobado promete que «en los casos en que una
# pregunta presenta un numero de respuestas menor al total de la base, esta
# cifra se muestra directamente en el grafico». El motor emitia esa frase y
# tenia CERO anotaciones «N = …» dentro de graficos, contra ONCE del aprobado.

test_that("solo se anota la fila que NO cuadra con la base", {
  # Ese «solo» es lo que la hace util: en todas las filas seria ruido, y lo que
  # hay que ver es justo la que no cuadra con el pie.
  expect_equal(
    .n_barra_procede(c(178, 178, 12), n_base = 178),
    c(FALSE, FALSE, TRUE)
  )
})


test_that("una diferencia de un caso no se anota", {
  # Un caso sobre una base de 178 es redondeo del filtrado, no un salto del
  # cuestionario; el aprobado no lo anota.
  expect_false(.n_barra_procede(177, n_base = 178))
  expect_true(.n_barra_procede(176, n_base = 178))
})


test_that("una fila con MAS que la base no se anota", {
  # No es un salto del cuestionario: es un error de calculo, y anotarlo aqui lo
  # disfrazaria de nota metodologica en vez de dejarlo salir por donde debe.
  expect_false(.n_barra_procede(200, n_base = 178))
})


test_that("sin base utilizable no se anota nada", {
  expect_false(any(.n_barra_procede(c(10, 20), n_base = NA)))
  expect_false(any(.n_barra_procede(c(10, 20), n_base = 0)))
  expect_false(any(.n_barra_procede(c(10, 20), n_base = -5)))
})


test_that("una N ausente o cero no se anota", {
  expect_equal(
    .n_barra_procede(c(NA, 0, 12), n_base = 178),
    c(FALSE, FALSE, TRUE)
  )
})


test_that("el texto lleva el espacio a los dos lados del igual", {
  # El aprobado escribe «N= 178» y «N = 12»; se toma la forma espaciada, que es
  # la de su patron dominante —siete de sus once—.
  expect_equal(.n_barra_texto(12), "N = 12")
  expect_equal(.n_barra_texto(178), "N = 178")
})


test_that("una N con decimales se redondea: no hay medias respuestas", {
  expect_equal(.n_barra_texto(11.6), "N = 12")
})


test_that("una N ilegible da texto vacio en vez de «N = NA»", {
  expect_equal(.n_barra_texto(NA), "")
  expect_equal(.n_barra_texto("x"), "")
})


test_that("sin filas que anotar NO se devuelve capa", {
  # El caso normal. Devolver una capa vacia obligaria a cada consumidor a
  # comprobarla, y una capa de cero filas rompe algunos geoms.
  expect_null(.n_barra_capa(c(1, 2, 3), c(178, 178, 178), n_base = 178))
})


test_that("con filas que anotar se devuelve una capa de ggplot", {
  capa <- .n_barra_capa(c(1, 2, 3), c(178, 178, 12), n_base = 178)
  expect_s3_class(capa, "Layer")
  expect_equal(nrow(capa$data), 1L)
  expect_equal(capa$data$.lab, "N = 12")
})


test_that("la capa lleva el cuerpo y la cursiva del aprobado", {
  # 8 pt en cursiva. ggplot mide `size` en milimetros: a puntos, x 2.845.
  capa <- .n_barra_capa(c(1, 2), c(178, 12), n_base = 178)
  expect_equal(capa$aes_params$size * 2.845, .N_BARRA_SIZE_PT, tolerance = 0.01)
  expect_equal(capa$aes_params$fontface, "italic")
  expect_equal(capa$aes_params$family, "Arial")
})


test_that("posiciones y enes que no casan no producen capa", {
  expect_null(.n_barra_capa(c(1, 2), c(178, 12, 4), n_base = 178))
})


test_that("la unidad es la PREGUNTA, no la fila", {
  # Medido sobre la lamina 18 del aprobado: tres de sus siete N anotadas
  # coinciden con la base de su publico. Estan porque su pregunta tiene otro
  # publico con salto, y entonces se anotan todas.
  procede <- .n_barra_procede_por_pregunta(
    n_por_fila    = c(52, 172,  47, 172),
    base_por_fila = c(52, 172,  52, 172),
    pregunta      = c("p1", "p1", "p2", "p2")
  )
  # p1 no salta en ninguna fila: ninguna se anota.
  expect_equal(procede[1:2], c(FALSE, FALSE))
  # p2 salta en docentes (47 de 52): se anotan LAS DOS, incluida la que cuadra.
  expect_equal(procede[3:4], c(TRUE, TRUE))
})


test_that("decir la N de uno y no la de los otros deja una adivinanza", {
  # Es la razon del criterio: sin la N de los demas publicos no se puede
  # comparar, y comparar publicos es para lo que existe la lamina.
  procede <- .n_barra_procede_por_pregunta(
    n_por_fila    = c(143, 178, 15),
    base_por_fila = c(178, 178, 15),
    pregunta      = rep("p1", 3)
  )
  expect_true(all(procede))
})


test_that("sin ningun salto no se anota nada", {
  expect_false(any(.n_barra_procede_por_pregunta(
    c(52, 172), c(52, 172), c("p1", "p1")
  )))
})


test_that("una fila sin N no se anota aunque su pregunta salte", {
  procede <- .n_barra_procede_por_pregunta(
    c(47, NA, 52), c(52, 172, 52), rep("p1", 3)
  )
  expect_equal(procede, c(TRUE, FALSE, TRUE))
})


test_that("vectores que no casan devuelven FALSE en vez de reciclar", {
  expect_false(any(.n_barra_procede_por_pregunta(c(1, 2), c(3), c("a", "b"))))
})


test_that("la base de un publico se deduce de sus preguntas", {
  # Las cuatro bases de la lamina 18 del aprobado —«52 docentes, 172
  # estudiantes, 178 egresados y 15 administrativos»— salen exactas del maximo
  # de cada publico entre sus preguntas: una pregunta sin salto la responde su
  # publico completo.
  n <- c(47, 52, 160, 172, 143, 178, 15, 15)
  pub <- rep(c("Docentes", "Estudiantes", "Egresados", "Administrativos"), each = 2)
  base <- .n_barra_base_por_publico(n, pub)
  expect_equal(unique(base[pub == "Docentes"]), 52)
  expect_equal(unique(base[pub == "Estudiantes"]), 172)
  expect_equal(unique(base[pub == "Egresados"]), 178)
  expect_equal(unique(base[pub == "Administrativos"]), 15)
})


test_that("con un solo dato por publico la base es ese dato", {
  # Es el caso que hace inutil deducirla desde el graficador: se le llama una
  # vez por PREGUNTA, cada publico aparece una sola vez y su maximo es su propia
  # N. Sin salto posible. La deduccion necesita ver la lamina entera.
  base <- .n_barra_base_por_publico(c(47, 128), c("Docentes", "Estudiantes"))
  expect_equal(base, c(47, 128))
  expect_false(any(.n_barra_procede_por_pregunta(
    c(47, 128), base, c("p1", "p1")
  )))
})


test_that("vectores que no casan devuelven NA en vez de reciclar", {
  expect_true(all(is.na(.n_barra_base_por_publico(c(1, 2), c("a")))))
})
