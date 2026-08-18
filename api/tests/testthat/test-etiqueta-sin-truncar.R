# P49. SPSS corta la etiqueta de variable en 256 bytes y el motor consulta el
# DATO antes que el instrumento, asi que el enunciado llega cortado aunque el
# XLSForm tenga el entero. En el mazo de Contabilidad le pasa a uno de los 99:
# sale «...Consejo de D» teniendo 291 bytes en `survey$label`.

sv <- function(name, label) data.frame(name = name, label = label,
                                       stringsAsFactors = FALSE)


test_that("recupera la entera cuando la del dato es su prefijo estricto", {
  entera <- paste0(
    "Existen mecanismos claros y permanentes de evaluacion de la gestion de ",
    "las autoridades de la Unidad (En el caso de la Facultad: Consejo de ",
    "Facultad, Decano. En el caso de Departamento Academico: Consejo de ",
    "Departamento, Jefe de Departamento).")
  truncada <- substr(entera, 1, 200)
  d <- sv("p13_3", entera)
  expect_equal(.etiqueta_sin_truncar(truncada, d, "p13_3"), entera)
  expect_gt(nchar(entera), nchar(truncada))
})


test_that("NO toca la del dato cuando no es prefijo", {
  # El analista acorto el enunciado a mano en el `.sav`: eso es una decision
  # suya, no un truncamiento, y la del instrumento no lo contiene.
  d <- sv("p6", "Indique su maximo grado academico alcanzado:")
  expect_equal(.etiqueta_sin_truncar("Grado academico", d, "p6"),
               "Grado academico")
  # Ni cuando la del instrumento es MAS CORTA.
  d2 <- sv("p6", "Grado")
  expect_equal(.etiqueta_sin_truncar("Grado academico del docente", d2, "p6"),
               "Grado academico del docente")
})


test_that("iguales se quedan igual, y sin coincidencia de `name` tampoco cambia", {
  d <- sv("p5", "Cual es su genero?")
  expect_equal(.etiqueta_sin_truncar("Cual es su genero?", d, "p5"),
               "Cual es su genero?")
  expect_equal(.etiqueta_sin_truncar("Cual es su", d, "p9"), "Cual es su")
})


test_that("normaliza los espacios para comparar pero devuelve la del instrumento", {
  # Un salto de linea del XLSForm no es una diferencia de contenido.
  d <- sv("q1", "Primera   parte\nsegunda parte del enunciado")
  out <- .etiqueta_sin_truncar("Primera parte", d, "q1")
  expect_equal(out, "Primera   parte\nsegunda parte del enunciado")
})


test_that("aguanta un dic_vars degenerado sin inventarse nada", {
  expect_equal(.etiqueta_sin_truncar("Hola", NULL, "p1"), "Hola")
  expect_equal(.etiqueta_sin_truncar("Hola", data.frame(a = 1), "p1"), "Hola")
  expect_equal(.etiqueta_sin_truncar("Hola", sv("p1", NA_character_), "p1"), "Hola")
  expect_equal(.etiqueta_sin_truncar("Hola", sv("p1", ""), "p1"), "Hola")
  expect_equal(.etiqueta_sin_truncar("Hola", sv("p1", "Hola mundo"), NA), "Hola")
  # Una etiqueta vacia se devuelve tal cual, sin tocar el tipo.
  expect_equal(.etiqueta_sin_truncar("", sv("p1", "Hola mundo"), "p1"), "")
})


test_that("con varias filas del mismo `name` toma la mas completa", {
  d <- sv(c("p1", "p1"), c("Hola mundo", "Hola mundo cruel y largo"))
  expect_equal(.etiqueta_sin_truncar("Hola", d, "p1"), "Hola mundo cruel y largo")
})


test_that("la cadena real del titulo pasa por el helper", {
  # Un `grepl` del nombre lo encontraria en el comentario que lo explica: se
  # busca la LLAMADA dentro de la rama del `df`, que es donde el dato ganaba.
  ruta <- testthat::test_path("..", "..", "R", "reporte_frecuencias.R")
  skip_if_not(file.exists(ruta))
  src <- paste(readLines(ruta, warn = FALSE), collapse = "\n")
  expect_true(grepl("return(.etiqueta_sin_truncar(as.character(vl)[1], dic_vars, var))",
                    src, fixed = TRUE))
  # Y `titulo_var()` sigue consumiendo `.lookup_variable_label()`.
  expect_true(grepl("lab <- .lookup_variable_label(", src, fixed = TRUE))
})


test_that("titulo_var devuelve la entera de punta a punta", {
  d <- sv("p13_3", "Enunciado entero con su cola completa")
  df <- data.frame(p13_3 = 1:3)
  attr(df$p13_3, "label") <- "Enunciado entero con su"
  expect_equal(titulo_var("p13_3", dic_vars = d, df = df),
               "Enunciado entero con su cola completa")
})
