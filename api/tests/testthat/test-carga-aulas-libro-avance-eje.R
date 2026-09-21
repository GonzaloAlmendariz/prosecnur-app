
# **La cabecera del eje sólo va donde las FILAS son del eje.**
#
# Cuatro de las cinco tablas empiezan por «Facultad», pero no agrupan lo mismo.
# `facultad` reparte las celdas de cuota —con el eje en nivel son 6, 7, 8 y 9—;
# `rendimiento`, `aplicador` y `diario` agrupan AULAS, y la fila sale de
# `u$faculty`. Con `atribucion = "persona"` el nivel de un aula es el MODAL de
# sus alumnos, así que rotular «Nivel» una columna cuyas filas son facultades es
# la misma mentira que este satélite vino a quitar.
#
# Visto el 2026-09-21 en el libro de CCSS Perfil 2026-II: «Rendimiento por
# facultad» salía con cabecera «Nivel» y una sola fila, «CIENCIAS SOCIALES».
test_that("con el eje en la PERSONA sólo la tabla de cuotas cambia de cabecera", {
  nivel <- list(clave = "nivel", etiqueta = "Nivel", atribucion = "persona")
  expect_identical(aulas_avance_cabeceras_eje("facultad", nivel)[[1]], "Nivel")
  for (k in c("rendimiento", "aplicador", "diario")) {
    expect_identical(aulas_avance_cabeceras_eje(k, nivel)[[1]], "Facultad",
                     info = paste("tabla", k, "agrupa aulas, no el eje"))
  }
  # «Avance general» nunca empieza por Facultad y no se toca.
  expect_identical(aulas_avance_cabeceras_eje("general", nivel)[[1]], "Indicadores")
})

test_that("con el eje en el AULA las cuatro siguen sustituyendose", {
  # HSVG esta en campo con el eje en facultad; y un eje futuro atribuido al aula
  # agrupa igual en las cuatro, asi que las cuatro deben cambiar.
  otro <- list(clave = "sede", etiqueta = "Sede", atribucion = "aula")
  for (k in c("facultad", "rendimiento", "aplicador", "diario")) {
    expect_identical(aulas_avance_cabeceras_eje(k, otro)[[1]], "Sede",
                     info = paste("tabla", k))
  }
})

test_that("sin eje declarado las cinco salen identicas a la constante", {
  for (k in names(AULAS_AVANCE_CABECERAS)) {
    expect_identical(aulas_avance_cabeceras_eje(k, NULL), AULAS_AVANCE_CABECERAS[[k]],
                     info = paste("tabla", k))
  }
})
