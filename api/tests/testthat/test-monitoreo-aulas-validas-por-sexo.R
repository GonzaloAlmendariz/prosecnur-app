# Las validas por sexo de cada curso-horario.
#
# Gonzalo, 2026-09-10, sobre las aulas que se meten de complemento (B) o de
# refuerzo (C): «como esa aula no estaba prevista, los alumnos tanto hombres
# como mujeres que habiamos recolectado alli son alumnos netos o puros».
#
# Para poder decir eso hace falta el reparto por sexo de CADA aula, y el plan
# solo publicaba el total. El agregado por facultad no sirve: una facultad puede
# ir sobrada en mujeres y la unica aula de refuerzo que se metio no haber traido
# ninguna, que es exactamente el caso en que la decision fue mala.

# La cuenta se mide donde vive, en su helper. El que llegue a la pantalla lo
# cubre el contrato de columnas publicadas del final: son dos cosas distintas y
# equivocarse en la segunda ya paso al escribir esto —la cuenta estaba en una
# copia local de `course_status` mientras `agenda` se serializa desde `plan_df`.
.reparto <- function(plan, responses, cfg, validas) {
  plan$respuestas_validas <- prosecnurapp:::.monitoreo_aulas_contar_por_fila(
    plan, prosecnurapp:::.monitoreo_aulas_named_counts(responses$aula, validas))
  prosecnurapp:::.monitoreo_aulas_validas_por_sexo(
    plan, responses, cfg, validas, responses$aula)
}

test_that("el plan publica cuantas mujeres y cuantos hombres respondio cada curso-horario", {
  plan <- data.frame(
    operational_code = c("CH 1", "CH 2"),
    classroom_id = c("CH 1", "CH 2"),
    faculty = c("DERECHO", "DERECHO"),
    eligible_n = c(30, 30),
    expected_valid = c(15, 15),
    operational_status = c("aplicada", "aplicada"),
    sample_status = c("agendada", "agendada"),
    sample_role = c("titular", "titular"),
    schedule = c("LUN 08:00", "MAR 10:00"),
    stringsAsFactors = FALSE
  )
  responses <- data.frame(
    aula = c("CH 1", "CH 1", "CH 1", "CH 2"),
    sexo = c("Femenino", "Femenino", "Masculino", "Femenino"),
    stringsAsFactors = FALSE
  )
  cfg <- list(source_mapping = list(
    classroom_var = "aula", sex_var = "sexo",
    sex_female_values = list("Femenino"), sex_male_values = list("Masculino")
  ))

  out <- .reparto(plan, responses, cfg, rep(TRUE, 4))
  ch1 <- out[out$operational_code == "CH 1", , drop = FALSE]
  ch2 <- out[out$operational_code == "CH 2", , drop = FALSE]

  expect_equal(as.numeric(ch1$validas_mujeres), 2)
  expect_equal(as.numeric(ch1$validas_hombres), 1)
  expect_equal(as.numeric(ch2$validas_mujeres), 1)
  expect_equal(as.numeric(ch2$validas_hombres), 0)
  # Y el reparto suma el total que ya se publicaba: si no, hay respuestas cuyo
  # sexo se perdio por el camino y la vista sumaria dos cifras que no cuadran.
  expect_equal(
    as.numeric(ch1$validas_mujeres) + as.numeric(ch1$validas_hombres),
    as.numeric(ch1$respuestas_validas)
  )
})

test_that("una respuesta no valida no entra en el reparto por sexo", {
  plan <- data.frame(operational_code = "CH 1", classroom_id = "CH 1",
                     faculty = "DERECHO", eligible_n = 30, expected_valid = 15,
                     operational_status = "aplicada", sample_status = "agendada",
                     sample_role = "titular", schedule = "LUN 08:00",
                     stringsAsFactors = FALSE)
  responses <- data.frame(aula = c("CH 1", "CH 1"), sexo = c("Femenino", "Femenino"),
                          stringsAsFactors = FALSE)
  cfg <- list(source_mapping = list(classroom_var = "aula", sex_var = "sexo",
                                    sex_female_values = list("Femenino")))

  ch1 <- .reparto(plan, responses, cfg, c(TRUE, FALSE))
  expect_equal(as.numeric(ch1$validas_mujeres), 1)
  expect_equal(as.numeric(ch1$respuestas_validas), 1)
})

test_that("sin columna de sexo NO se publica cero: no saberlo no es saber que no hubo", {
  # Un cero se leeria como «ese refuerzo no trajo ninguna mujer», que es una
  # afirmacion sobre el aula. La verdad es otra —aqui no se esta midiendo eso— y
  # son cosas distintas.
  plan <- data.frame(operational_code = "CH 1", classroom_id = "CH 1",
                     faculty = "DERECHO", eligible_n = 30, expected_valid = 15,
                     operational_status = "aplicada", sample_status = "agendada",
                     sample_role = "titular", schedule = "LUN 08:00",
                     stringsAsFactors = FALSE)
  responses <- data.frame(aula = c("CH 1", "CH 1"), stringsAsFactors = FALSE)
  cfg <- list(source_mapping = list(classroom_var = "aula"))

  ch1 <- .reparto(plan, responses, cfg, c(TRUE, TRUE))
  expect_null(ch1$validas_mujeres)
  expect_null(ch1$validas_hombres)
  # El total sigue publicandose: eso si se sabe.
  expect_equal(as.numeric(ch1$respuestas_validas), 2)
})

test_that("un sexo que el estudio no clasifica no se reparte ni se inventa", {
  plan <- data.frame(operational_code = "CH 1", classroom_id = "CH 1",
                     faculty = "DERECHO", eligible_n = 30, expected_valid = 15,
                     operational_status = "aplicada", sample_status = "agendada",
                     sample_role = "titular", schedule = "LUN 08:00",
                     stringsAsFactors = FALSE)
  responses <- data.frame(aula = c("CH 1", "CH 1", "CH 1"),
                          sexo = c("Femenino", "Masculino", "Prefiero no decir"),
                          stringsAsFactors = FALSE)
  cfg <- list(source_mapping = list(classroom_var = "aula", sex_var = "sexo",
                                    sex_female_values = list("Femenino"),
                                    sex_male_values = list("Masculino")))

  ch1 <- .reparto(plan, responses, cfg, rep(TRUE, 3))
  expect_equal(as.numeric(ch1$validas_mujeres), 1)
  expect_equal(as.numeric(ch1$validas_hombres), 1)
  # Las tres son validas; la tercera no cae en ningun sexo y eso se VE en que
  # el reparto no suma el total. Es correcto y la vista lo dice; repartirla
  # seria inventar.
  expect_equal(as.numeric(ch1$respuestas_validas), 3)
})

test_that("las dos columnas viajan en el payload que lee la pantalla", {
  # La cuenta puede ser correcta y no llegar: `agenda` se serializa desde
  # `plan_df` y `course_status` trabaja sobre una copia. La primera version de
  # esto ponia las columnas en la copia.
  fuente <- readLines("../../R/monitoreo_aulas_universitarias.R", warn = FALSE)
  llamada <- grep("plan_df <- .monitoreo_aulas_validas_por_sexo\\(", fuente)
  expect_length(llamada, 1)
  # Y por delante tiene que estar ya `respuestas_validas`, que es de donde sale
  # el emparejamiento con el que cuenta.
  antes <- grep("plan_df\\$respuestas_validas <- ", fuente)
  expect_true(any(antes < llamada))
  # La columna se declara en el juego publicado de `course_status`.
  expect_true(any(grepl('"validas_mujeres", "validas_hombres",', fuente, fixed = TRUE)))
})
