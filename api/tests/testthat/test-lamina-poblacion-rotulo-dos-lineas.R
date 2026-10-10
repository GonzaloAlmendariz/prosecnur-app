# Cuadrícula de población con un rótulo que se parte en dos líneas (lámina 162 del recetario, tipo 18 «Cuatro gráficos»):
# el recetario deja «Departamento de Ciencias Contables» en dos líneas dentro de una fila de 0.42 in. La compuerta medía el
# cuadro con sus márgenes internos (0.1 in) y mandaba la lámina entera a la ruta anterior, con las guías de depuración
# (lámina 7 de acrconta_mazo, «Perfil del docente»). Lo que decide es que la tinta del rótulo quepa en su fila.

.pr2_fixture <- function() {
  dep <- c("Departamento de Ciencias Contables", "Departamento de Derecho", "Departamento de Economía", "Otros")
  edad <- c("De 18 a 30 años", "De 31 a 40 años", "De 41 a 50 años", "De 51 años a más")
  grado <- c("Bachiller", "Magíster", "Doctor")
  df <- data.frame(sexo = rep(c("Hombre", "Mujer"), c(30, 22)), dep = rep(dep, c(46, 2, 2, 2)), edad = rep(edad, c(10, 7, 12, 23)),
                   grado = rep(grado, c(10, 38, 4)), stringsAsFactors = FALSE)
  ch <- rbind(data.frame(list_name = "ls", name = c("Hombre", "Mujer"), label = c("Hombre", "Mujer")),
              data.frame(list_name = "ld", name = dep, label = dep), data.frame(list_name = "le", name = edad, label = edad),
              data.frame(list_name = "lg", name = grado, label = grado))
  inst <- list(survey = data.frame(name = c("sexo", "dep", "edad", "grado"), type = paste("select_one", c("ls", "ld", "le", "lg")),
                                   list_name = c("ls", "ld", "le", "lg"),
                                   label = c("Sexo", "Departamento académico al que pertenece", "Rango de edades", "Máximo grado alcanzado"),
                                   stringsAsFactors = FALSE), choices = ch, orders_list = NULL)
  list(df = df, inst = inst)
}

.pr2_lamina <- function() {
  f <- .pr2_fixture(); out <- tempfile(fileext = ".pptx")
  plan <- list(a = p_slide_4_graficos_poblacion(p_barras_categoricas("sexo"), p_barras_categoricas("dep"), p_barras_categoricas("edad"),
                                                p_barras_categoricas("grado"), titulo = "Perfil del docente"))
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  .pptx_leer_parte(out, .pptx_slide_paths(out)[[1]])
}

test_that("un rótulo de dos líneas cuya tinta cabe en su fila deja la cuadrícula de población nativa (162)", {
  x <- .pr2_lamina()
  expect_identical(.pptx_lamina_estado(x), "nativa")
  expect_match(x, 'name="prosecnur:grafico:mixta"', fixed = TRUE)
  expect_false(grepl('name="prosecnur:poblacion_4:', x, fixed = TRUE))
  # Los cuatro paneles con su pregunta y el rótulo entero, sin guías de depuración de la ruta anterior.
  expect_match(x, "Departamento de Ciencias Contables", fixed = TRUE)
  expect_match(x, "Máximo grado alcanzado", fixed = TRUE)
})

test_that("la compuerta mide la tinta del rótulo contra su fila, no el cuadro con sus márgenes", {
  e <- preparar_categorica(c("Departamento de Ciencias Contables", "Departamento de Derecho", "Departamento de Economía", "Otros"),
                           c(.88, .04, .04, .04), c("88%", "4%", "4%", "4%"))
  P <- .lam_mixta_geo("paneles_4")$paneles[[2]]
  expect_true(.lam_mixta_cabe(e, P, "Departamento académico al que pertenece", "52 respuestas"))
  # Un rótulo que pide dos líneas en una fila de un tercio de pulgada no cabe (lámina 9 de acrconta_mazo).
  e5 <- preparar_categorica(c("0 meses", "Menos de 2 meses", "Entre 2 y 6 meses", "Entre 6 meses y 1 año",
                              "No he encontrado trabajo desde que egresé"), c(.69, .15, .11, .04, .01), c("69%", "15%", "11%", "4%", "1%"))
  expect_false(.lam_mixta_cabe(e5, P, "Tiempo que le tomó conseguir su primer trabajo", "178 respuestas"))
  # Seis categorías en un cuadrante dan filas por debajo de las del recetario: siguen por la ruta anterior.
  e6 <- preparar_categorica(paste(c("Quinto", "Sexto", "Séptimo", "Octavo", "Noveno", "Décimo"), "ciclo"), rep(1 / 6, 6), rep("17%", 6))
  expect_false(.lam_mixta_cabe(e6, P, "Nivel curricular", "172 respuestas"))
})
