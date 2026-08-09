# B48/G-23: el export replica la semantica de la UI — las refs peladas del
# plan guardado se califican con la base ACTIVA antes del rebuild. Refs ya
# calificadas y planes sin base activa (informe conjunto) no se tocan.

test_that("las refs peladas se califican con la base activa", {
  plan <- list(slides = list(
    list(tipo = "p_slide_1_grafico", payload = list(
      grafico = list(graficador = "p_barras_apiladas", args = list(var = "p12_1"))
    ))
  ))
  out <- .graficos_calificar_refs_plan(plan, "docentes")
  expect_identical(out$slides[[1]]$payload$grafico$args$var, "docentes$p12_1")
})

test_that("las refs ya calificadas y las vacias no se tocan", {
  plan <- list(slides = list(
    list(tipo = "p_slide_1_grafico", payload = list(
      grafico = list(graficador = "p_barras_apiladas",
                     args = list(var = "estudiantes$p10_1", cruce = ""))
    ))
  ))
  out <- .graficos_calificar_refs_plan(plan, "docentes")
  expect_identical(out$slides[[1]]$payload$grafico$args$var, "estudiantes$p10_1")
  expect_identical(out$slides[[1]]$payload$grafico$args$cruce, "")
})

test_that("puntos comparativos califica var y cruces sin tocar el corte multicode", {
  plan <- list(slides = list(
    list(tipo = "p_slide_1_grafico", payload = list(
      grafico = list(
        graficador = "p_puntos_comparativos",
        args = list(var = "indicador", cruces = "grupo", corte = c("1", "99"))
      )
    ))
  ))
  out <- .graficos_calificar_refs_plan(plan, "principal")
  args <- out$slides[[1]]$payload$grafico$args
  expect_identical(args$var, "principal$indicador")
  expect_identical(args$cruces, "principal$grupo")
  expect_identical(args$corte, c("1", "99"))
})

test_that("los bloques de vars multiactor se califican elemento a elemento", {
  plan <- list(slides = list(
    list(tipo = "p_slide_1_grafico", payload = list(
      grafico = list(graficador = "p_barras_multiapiladas", args = list(
        modo = "var_cruce",
        vars = list(tema = c("p1", "egresados$p2"))
      ))
    ))
  ))
  out <- .graficos_calificar_refs_plan(plan, "docentes")
  expect_identical(out$slides[[1]]$payload$grafico$args$vars$tema,
                   c("docentes$p1", "egresados$p2"))
})

test_that("sin base activa el plan queda intacto", {
  plan <- list(slides = list(
    list(tipo = "p_slide_1_grafico", payload = list(
      grafico = list(graficador = "p_barras_apiladas", args = list(var = "p1"))
    ))
  ))
  expect_identical(.graficos_calificar_refs_plan(plan, NULL), plan)
  expect_identical(.graficos_calificar_refs_plan(plan, ""), plan)
})

test_that("slots de laminas de varios graficos tambien se califican", {
  plan <- list(slides = list(
    list(tipo = "p_slide_4_graficos_poblacion", payload = list(
      titulo = "x",
      superior_izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "p5"))
    ))
  ))
  out <- .graficos_calificar_refs_plan(plan, "docentes")
  expect_identical(out$slides[[1]]$payload$superior_izquierda$args$var, "docentes$p5")
  expect_identical(out$slides[[1]]$payload$titulo, "x")
})
