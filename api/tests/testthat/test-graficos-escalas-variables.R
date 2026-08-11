test_that("el puente asocia cada escala con las variables que la usan", {
  inst <- list(
    docentes = list(
      survey = data.frame(
        type = c("select_one lst_p4_recod", "select_one lst_p10", "text", "select_multiple lst_areas"),
        name = c("p4_recod", "p10", "p99_abierta", "p12"),
        stringsAsFactors = FALSE
      )
    ),
    egresados = list(
      survey = data.frame(
        type = c("select_one lst_p4_recod", "select_one lst_p10"),
        name = c("p4_recod", "p10"),
        stringsAsFactors = FALSE
      )
    )
  )

  vars <- .graficos_variables_por_escala(inst)

  # Multibase: la variable va calificada, porque `lst_p4_recod` es una escala
  # distinta en cada instrumento y sin la base no se sabe cuál.
  expect_equal(vars[["lst_p4_recod"]], c("docentes$p4_recod", "egresados$p4_recod"))
  expect_equal(vars[["lst_p10"]], c("docentes$p10", "egresados$p10"))
  expect_equal(vars[["lst_areas"]], "docentes$p12")

  # Control: una fila que no es de selección no aporta escala.
  expect_false("p99_abierta" %in% unlist(vars, use.names = FALSE))
})

test_that("un instrumento suelto y sin nombre deja la variable a secas", {
  # Es el caso en que el plan también escribe `p2` sin calificar; calificarla
  # aquí dejaría el puente sin poder casar con el `var` del gráfico.
  inst <- list(survey = data.frame(
    type = "select_one lst_sexo", name = "p2", stringsAsFactors = FALSE
  ))
  expect_equal(.graficos_variables_por_escala(inst)[["lst_sexo"]], "p2")
})

test_that("una sola base CON nombre sí califica, igual que el plan", {
  inst <- list(docentes = list(survey = data.frame(
    type = "select_one lst_sexo", name = "p2", stringsAsFactors = FALSE
  )))
  expect_equal(.graficos_variables_por_escala(inst)[["lst_sexo"]], "docentes$p2")
})

test_that("la columna list_name explícita gana sobre el type", {
  inst <- list(unica = list(survey = data.frame(
    type = c("select_one lst_del_type"),
    name = c("p1"),
    list_name = c("lst_declarado"),
    stringsAsFactors = FALSE
  )))
  vars <- .graficos_variables_por_escala(inst)
  expect_equal(names(vars), "lst_declarado")
})

test_that("entradas vacías o sin survey no rompen el puente", {
  expect_equal(.graficos_variables_por_escala(NULL), list())
  expect_equal(.graficos_variables_por_escala(list()), list())
  expect_equal(.graficos_variables_por_escala(list(a = list(survey = NULL))), list())
  # Un survey sin columna `name` no puede nombrar variables.
  expect_equal(
    .graficos_variables_por_escala(list(a = list(survey = data.frame(type = "select_one x")))),
    list()
  )
})

test_that("las escalas salen con `variables` sin perder lo que ya traían", {
  inst <- list(docentes = list(
    survey = data.frame(type = "select_one lst_sexo", name = "p2", stringsAsFactors = FALSE),
    choices = data.frame(
      list_name = c("lst_sexo", "lst_sexo"),
      name = c("1", "2"),
      label = c("Masculino", "Femenino"),
      stringsAsFactors = FALSE
    )
  ))

  listas <- .graficos_escalas_con_variables(
    .graficos_collect_palette_lists(inst), inst
  )

  expect_length(listas, 1L)
  expect_equal(listas[[1]]$list_name, "lst_sexo")
  expect_equal(as.character(listas[[1]]$variables), "docentes$p2")
  # El contrato viejo sigue en pie: etiquetas y fuentes intactas.
  expect_equal(vapply(listas[[1]]$choices, function(c) c$label, character(1)),
               c("Masculino", "Femenino"))
  expect_equal(as.character(listas[[1]]$fuentes), "docentes")
})

test_that("dos escalas homónimas no se reclaman las variables de la otra", {
  # El caso real de «Conta 10-08»: `lst_p10` es Sí/No en docentes y meses desde
  # el egreso en egresados. Atribuir por `list_name` a secas le daba a cada una
  # las seis variables del nombre, así que la Sí/No de docentes ofrecía la
  # escala de meses como si fuera suya.
  choices <- function(labels) data.frame(
    list_name = rep("lst_p10", length(labels)),
    name = as.character(seq_along(labels)),
    label = labels,
    stringsAsFactors = FALSE
  )
  inst <- list(
    docentes = list(
      survey = data.frame(type = "select_one lst_p10", name = "p10", stringsAsFactors = FALSE),
      choices = choices(c("Sí", "No"))
    ),
    egresados = list(
      survey = data.frame(type = "select_one lst_p10", name = "p10", stringsAsFactors = FALSE),
      choices = choices(c("0 meses", "Menos de 2 meses", "Más de 1 año"))
    )
  )

  listas <- .graficos_escalas_con_variables(
    .graficos_collect_palette_lists(inst), inst
  )
  por_id <- setNames(listas, vapply(listas, function(l) l$escala_id, character(1)))

  expect_equal(as.character(por_id[["lst_p10"]]$variables), "docentes$p10")
  expect_equal(as.character(por_id[["lst_p10#2"]]$variables), "egresados$p10")
  # El control: sin acotar por fuente ambas traerían las dos variables.
  expect_equal(
    .graficos_variables_por_escala(inst)[["lst_p10"]],
    c("docentes$p10", "egresados$p10")
  )
})

test_that("una escala sin variables declaradas sale con array vacío, no con NULL", {
  # El contrato con la UI es «array siempre»: un NULL obligaría a cada
  # consumidor a defenderse por su cuenta.
  inst <- list(docentes = list(
    survey = data.frame(type = "text", name = "p1", stringsAsFactors = FALSE),
    choices = data.frame(
      list_name = c("lst_huerfana", "lst_huerfana"),
      name = c("1", "2"),
      label = c("A", "B"),
      stringsAsFactors = FALSE
    )
  ))
  listas <- .graficos_escalas_con_variables(
    .graficos_collect_palette_lists(inst), inst
  )
  expect_length(listas[[1]]$variables, 0L)
  expect_true(is.character(as.character(listas[[1]]$variables)))
})
