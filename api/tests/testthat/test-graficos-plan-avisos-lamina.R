panel <- function(var, titulo = NULL) {
  list(graficador = "p_barras_agrupadas",
       args = list(var = var, overrides = if (is.null(titulo)) list() else list(titulo = titulo)))
}


test_that("una lamina bien configurada no produce avisos", {
  slots <- list(
    superior_izquierda = panel("estudiantes$p5", "Sexo"),
    superior_derecha   = panel("estudiantes$p6", "Nivel curricular"),
    inferior_izquierda = panel("estudiantes$p3_recod", "Rango de edades"),
    inferior_derecha   = panel("estudiantes$p7", "Modalidad")
  )
  expect_equal(.plan_avisos_lamina(slots, "slide[9]"), character(0))
})


test_that("la lamina real del estudiante avisa de la variable repetida y del titulo", {
  # El caso que llego al entregable: el panel de abajo a la derecha repetia el
  # grafico de Sexo, con otro tamano y sin rotulo.
  slots <- list(
    superior_izquierda = panel("estudiantes$p5", "Sexo"),
    superior_derecha   = panel("estudiantes$p6", "Nivel curricular"),
    inferior_izquierda = panel("estudiantes$p3_recod", "Rango de edades"),
    inferior_derecha   = panel("estudiantes$p5")
  )
  av <- .plan_avisos_lamina(slots, "slide[9]")
  expect_length(av, 2L)
  expect_true(any(grepl("dos veces", av, fixed = TRUE)))
  expect_true(any(grepl("no tiene titulo", av, fixed = TRUE)))
  # El aviso nombra el panel: sin eso hay que abrir los cuatro para encontrarlo.
  expect_true(any(grepl("inferior_derecha", av, fixed = TRUE)))
})


test_that("un panel de otra base se avisa aunque tenga titulo", {
  slots <- list(
    superior_izquierda = panel("administrativos$p4", "Sexo"),
    superior_derecha   = panel("administrativos$p5_recod", "Anos trabajando"),
    inferior_izquierda = panel("administrativos$p3_recod", "Rango de edades"),
    inferior_derecha   = panel("docentes$p5", "Sexo del docente")
  )
  av <- .plan_avisos_lamina(slots, "slide[14]")
  expect_true(any(grepl("base 'docentes'", av, fixed = TRUE)))
  expect_true(any(grepl("es 'administrativos'", av, fixed = TRUE)))
})


test_that("una lamina de un solo panel nunca avisa", {
  # Con un panel no hay nada que comparar, y exigirle titulo aqui seria otra
  # regla distinta: el titulo de la lamina ya lo nombra.
  expect_equal(.plan_avisos_lamina(list(unico = panel("x$p1")), "slide[3]"), character(0))
  expect_equal(.plan_avisos_lamina(list(), "slide[3]"), character(0))
})


test_that("repetir se avisa una vez por variable, no una por panel", {
  slots <- list(
    a = panel("b$p1", "Uno"), b = panel("b$p1", "Dos"), c = panel("b$p1", "Tres")
  )
  av <- .plan_avisos_lamina(slots, "slide[1]")
  expect_length(av, 1L)
  expect_true(grepl("a, b, c", av[[1]], fixed = TRUE))
})


test_that("sin base declarada no se inventa una discrepancia", {
  # `var` sin `$` se resuelve contra la base activa: no es un panel descolgado.
  slots <- list(a = panel("p1", "Uno"), b = panel("p2", "Dos"))
  expect_equal(.plan_avisos_lamina(slots, "slide[1]"), character(0))
  expect_true(is.na(.plan_aviso_base_de_var("p1")))
  expect_equal(.plan_aviso_base_de_var("egresados$p5"), "egresados")
})


test_that("si ningun panel tiene titulo no se avisa por titulo", {
  # Es un estilo, no un descuido: lo sospechoso es que uno se quede fuera.
  slots <- list(a = panel("b$p1"), b = panel("b$p2"))
  expect_equal(.plan_avisos_lamina(slots, "slide[1]"), character(0))
})
