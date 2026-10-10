source("setup-load-all.R")

# F6.0b.3: la `meta` de una lámina llega del editor al motor entera (inventario F6, parte A).

.sm_json <- function(x) jsonlite::fromJSON(x, simplifyVector = FALSE)

test_that("las listas de escalares del JSON pasan a vectores y lo vacío se descarta", {
  m <- .graficos_normalizar_meta(.sm_json('{"actores":["Docentes","Estudiantes"],"variante":"banda","vacia":[],"nulo":null}'))
  expect_identical(m$actores, c("Docentes", "Estudiantes"))
  expect_identical(m$variante, "banda")
  expect_false(any(c("vacia", "nulo") %in% names(m)))
  expect_null(.graficos_normalizar_meta(.sm_json("{}")))
  expect_null(.graficos_normalizar_meta(NULL))
})

test_that("la meta del editor llega al constructor de la lámina en el export", {
  s <- .sm_json('{"tipo":"p_slide_seccion","payload":{"titulo":"Misión y propósitos","meta":{"nivel":"subcapitulo","numero":"2.1","rotulo":"Subcapítulo"}}}')
  r <- .graficos_rebuild_slide_json(s)
  expect_identical(r$meta$nivel, "subcapitulo")
  expect_identical(r$meta$numero, "2.1")
  o <- .sm_json('{"tipo":"p_slide_objetivo_icono","payload":{"titulo":"Objetivo","texto":"Conocer la percepción","meta":{"actores":["Docentes","Estudiantes","Egresados"]}}}')
  expect_identical(.graficos_rebuild_slide_json(o)$meta$actores, c("Docentes", "Estudiantes", "Egresados"))
})

test_that("una meta vacía del editor no rompe la lámina (se usa el default del constructor)", {
  s <- .sm_json('{"tipo":"p_slide_seccion","payload":{"titulo":"Perfil","meta":{}}}')
  expect_no_error(r <- .graficos_rebuild_slide_json(s))
  expect_identical(r$meta, list())
})
