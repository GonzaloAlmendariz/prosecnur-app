source("setup-load-all.R")

# P7 (resumen ejecutivo de Arte con 921853216, 2026-11-09): la escala «bajo 60%» elige 22 y la lámina admite 20. El
# recorte dejó fuera docentes$p15_1 (57,4 %) y conservó estudiantes$p24_2 (58,1 %): las dos se rotulan 58 % y el empate
# lo decidía la base. Ahora el recorte sigue la métrica de la regla, desempata sin redondear y la nota dice UNA frase; el
# conteo lista lo mismo que se dibuja. Fixture: helper-tope-espacio-arte.R.

test_that("P7: el recorte sigue la métrica de la regla; lo que la lámina rotula igual se desempata sin redondear, no por la base", {
  src <- .tea_fuentes()
  r <- .regla_preguntas_de_elemento(.tea_el(), src)
  ind <- r$indicadores
  tres <- c("estudiantes$p24_2", "docentes$p15_1", "docentes$p30_3")
  expect_identical(ind$valor[match(tres, ind$tema)], c(58, 58, 58))   # la premisa: se leen igual
  expect_equal(ind$valor_fino[match(tres, ind$tema)], c(58.06, 57.39, 58.26), tolerance = 0.01)
  expect_length(r$vars, 20L)
  expect_true("docentes$p15_1" %in% r$vars)        # 57,4 % se queda
  expect_false("estudiantes$p24_2" %in% r$vars)    # 58,1 % sale aunque va primero en `vars`
  expect_false("docentes$p30_3" %in% r$vars)
  # Una sola frase: no «Se muestran las 22 bajo 60%» y luego «Por espacio, se muestran las 20 más bajas de 22».
  # Con el universo (lead, 2026-11-09).
  expect_match(r$evaluacion$texto, "^Se muestran las 20 más bajas de las 22 bajo 60%, de 23 preguntas de escala; el resto en otra lámina\\.")
  expect_false(grepl("Por espacio", r$evaluacion$texto, fixed = TRUE))
  # Un empate exacto sigue por el orden del instrumento; el ruido del punto flotante no desempata.
  ind2 <- data.frame(tema = c("a", "b"), grupo = "g", valor = c(15, 15), valor_fino = c(16.4 - 1.4, 15), orden = 1:2)
  expect_identical(.regla_preguntas_evaluar(ind2, list(tipo = "bajo_umbral", umbral = 60))$temas, c("a", "b"))
})

test_that("P5: el conteo lista sólo lo que se dibuja y su nota es la de la lámina", {
  src <- .tea_fuentes()
  k <- .regla_preguntas_conteo("p_barras_divergentes", list(vars = list("estudiantes$*", "docentes$*"), n_negativas = 2, incluir_neutro = FALSE,
                                                            estilo = "resumen", regla = list(tipo = "bajo_umbral", umbral = 60)), src)
  expect_identical(k$total, 23L)   # el universo: las 23 de escala
  expect_length(k$seleccionadas, 20L)
  expect_identical(sum(vapply(k$candidatas, function(x) isTRUE(x$seleccionada), TRUE)), 20L)
  expect_false("estudiantes$p24_2" %in% unlist(k$seleccionadas))
  expect_match(k$texto_regla, "^Se muestran las 20 más bajas de las 22 bajo 60%")
  expect_true(any(grepl("La regla elige 22 preguntas y la lámina admite 20", unlist(k$avisos), fixed = TRUE)))
})
