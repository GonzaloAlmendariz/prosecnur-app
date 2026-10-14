# Calidad de la traducción SurveyMonkey -> XLSForm (checklist docs/qa/checklist-importacion-sm-arte-2026-10-14.md).
# Encuesta sintética con la forma de los formularios de acreditación: página con título, HTML en línea, una matriz
# con «SIN INF» de peso 99 y una pregunta con «Otro (especifique)».

ch <- function(text, position, weight = NULL, id = paste0("c", position)) {
  out <- list(text = text, position = position, id = id, visible = TRUE)
  if (!is.null(weight)) out$weight <- weight
  out
}

encuesta_sm <- function() list(
  id = "999", title = "Acreditación prueba",
  pages = list(
    list(position = 1, title = "", questions = list(
      list(id = "q1", family = "presentation", subtype = "descriptive_text",
           headings = list(list(heading = "<p>Estimado(a), es de carácter confidencia<span>l</span>.</p>"))),
      list(id = "q2", family = "single_choice", subtype = "vertical",
           headings = list(list(heading = "¿Desea continuar?")), required = list(type = "all"),
           answers = list(choices = list(ch("Sí", 1), ch("No", 2))))
    )),
    list(position = 2, title = "<strong>Datos generales</strong>", questions = list(
      list(id = "q3", family = "single_choice", subtype = "vertical",
           headings = list(list(heading = "<div>¿Conoce la <strong>misión de la PUCP</strong>? <em>[Lineamientos]</em></div>")),
           answers = list(choices = list(ch("Sí", 1), ch("No", 2)),
                          other = list(text = "Otro (especifique)", position = 0, is_answer_choice = TRUE, visible = TRUE)))
    )),
    list(position = 3, title = "", questions = list(
      list(id = "q4", family = "matrix", subtype = "rating",
           headings = list(list(heading = "Indique su nivel de satisfacción con los <strong>servicios</strong> :")),
           answers = list(
             rows = list(list(text = "Servicio de salud", position = 1, id = "r1"),
                         list(text = "Bienestar psicológico", position = 2, id = "r2")),
             choices = list(ch("Insatisfecho", 1, 1), ch("Satisfecho", 2, 2), ch("SIN INF", 3, 99))
           ))
    ))
  )
)

traducir <- function() sm_api_xlsform(encuesta_sm(), style = .sm_api_default_style(), lang = "es")

test_that("H3: el peso que fijó el analista en SurveyMonkey es el código («SIN INF» = 99)", {
  out <- traducir()
  choices <- as.data.frame(out$choices)
  matriz <- choices[choices$`label::es` %in% c("Insatisfecho", "Satisfecho", "SIN INF"), ]
  expect_identical(matriz$name, c("1", "2", "99"))
  # Sin pesos rige la posición, y «Otro» toma el siguiente código libre.
  otro <- choices[choices$`label::es` == "Otro (especifique)", ]
  expect_identical(otro$name, "3")
  survey <- as.data.frame(out$survey)
  expect_identical(survey$relevant[!is.na(survey$name) & grepl("_other$", survey$name)], "${p2} = '3'")
})

test_that("H3: con un peso repetido o ausente no se usan pesos", {
  expect_identical(vapply(.sm_api_codigos_por_peso(list(
    list(code = "1", weight = 1), list(code = "2", weight = 1)
  )), `[[`, "", "code"), c("1", "2"))
  expect_identical(vapply(.sm_api_codigos_por_peso(list(
    list(code = "1", weight = 5), list(code = "2", weight = NA_real_)
  )), `[[`, "", "code"), c("1", "2"))
  # El código libre salta los especiales y no pisa uno usado.
  expect_identical(.sm_api_codigo_libre(list(list(code = "1"), list(code = "2"), list(code = "99"))), "4")
})

test_that("H6: el HTML en línea no deja espacios antes de la puntuación ni parte palabras", {
  expect_identical(.sm_api_clean_text("¿Conoce la <strong>misión de la PUCP</strong>?"), "¿Conoce la misión de la PUCP?")
  expect_identical(.sm_api_clean_text("carácter confidencia<span>l</span>."), "carácter confidencial.")
  expect_identical(.sm_api_clean_text("<div>Uno</div><div>Dos</div>"), "Uno Dos")
  expect_identical(.sm_api_clean_text("Primero<br>segundo"), "Primero segundo")
  survey <- as.data.frame(traducir()$survey)
  etiquetas <- survey$`label::es`[!is.na(survey$`label::es`)]
  expect_false(any(grepl(" [?.,:;)]", etiquetas)))
})

test_that("H5 y U9: la sección toma el título de su página y el rango no nombra el «Otro»", {
  survey <- as.data.frame(traducir()$survey)
  grupos <- survey$`label::es`[survey$type == "begin_group"]
  expect_identical(grupos[[2]], "Datos generales (p2)")
  expect_match(grupos[[1]], "^Pag1 ")
  # El nombre del grupo sigue siendo estable.
  expect_identical(survey$name[survey$type == "begin_group"][[2]], "Pag2")
})

test_that("H8: el diagnóstico nombra la matriz como la hoja survey", {
  out <- traducir()
  dg <- as.data.frame(out$diagnostico)
  survey <- as.data.frame(out$survey)
  madre <- dg$name_final[dg$kind_guess == "matrix/rating"]
  expect_identical(madre, "p3")
  expect_true(all(c("p3_1", "p3_2") %in% survey$name))
})
