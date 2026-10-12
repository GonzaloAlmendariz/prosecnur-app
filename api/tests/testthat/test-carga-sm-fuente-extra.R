# F2b (ADR 0099, enmienda 2026-10-11): la fuente secundaria trae una pregunta que la base no tiene (un código de
# identificación que sólo pidió el recopilador por correo). Al agregarla, la pregunta se suma al formulario de la base.

form <- function(survey, choices = data.frame(list_name = character(), name = character(), `label::es` = character(),
                                               check.names = FALSE)) {
  list(survey = survey, choices = choices, settings = data.frame(form_title = "x"))
}
sv <- function(type, name, label) data.frame(type = type, name = name, `label::es` = label, check.names = FALSE,
                                              stringsAsFactors = FALSE)

test_that("la pregunta extra entra al final del formulario de la base, con su etiqueta", {
  base <- form(sv(c("select_one sn", "integer"), c("p1", "p2"), c("¿Trabaja?", "Edad")),
               data.frame(list_name = "sn", name = c("1", "2"), `label::es` = c("Sí", "No"), check.names = FALSE))
  fuente <- form(sv(c("select_one sn", "integer", "text"), c("p1", "p2", "p3"), c("¿Trabaja?", "Edad", "Código de estudiante")))
  r <- .carga_sm_form_con_extra(base, fuente, "p3")
  expect_identical(r$form$survey$name, c("p1", "p2", "p3"))
  expect_identical(r$form$survey$type[3], "text")
  expect_identical(r$agregadas$etiqueta, "Código de estudiante")
  expect_identical(r$agregadas$base, "p3")
})

test_that("si el nombre ya existe en la base, la pregunta nueva toma otro y no pisa la que hay", {
  base <- form(sv(c("integer", "text"), c("p1", "p2"), c("Edad", "Comentario")))
  fuente <- form(sv(c("integer", "text"), c("p1", "p2"), c("Edad", "Correo institucional")))
  r <- .carga_sm_form_con_extra(base, fuente, "p2")
  expect_identical(r$form$survey$name, c("p1", "p2", "p2_f2"))
  expect_identical(r$form$survey$`label::es`[2], "Comentario") # la de la base queda intacta
  expect_identical(r$agregadas[, c("fuente", "base")], data.frame(fuente = "p2", base = "p2_f2"))
})

test_that("una pregunta de opciones lleva su lista; si la base ya usa ese nombre de lista con otras opciones, la renombra", {
  base <- form(sv("select_one l1", "p1", "Sede"),
               data.frame(list_name = "l1", name = c("a", "b"), `label::es` = c("Lima", "Cusco"), check.names = FALSE))
  fuente <- form(sv(c("select_one l1", "select_one l1"), c("p1", "p9"), c("Sede", "Turno")),
                 data.frame(list_name = "l1", name = c("m", "t"), `label::es` = c("Mañana", "Tarde"), check.names = FALSE))
  r <- .carga_sm_form_con_extra(base, fuente, "p9")
  expect_identical(r$form$survey$type[2], "select_one l1_p9")
  expect_identical(r$form$choices$list_name, c("l1", "l1", "l1_p9", "l1_p9"))
  expect_identical(r$form$choices$`label::es`[3:4], c("Mañana", "Tarde"))
})

test_that("el «Otro (especifique)» viaja con su pregunta", {
  base <- form(sv("integer", "p1", "Edad"))
  fuente <- form(sv(c("integer", "select_one c", "text"), c("p1", "p4", "p4_other"), c("Edad", "Canal", "Otro")),
                 data.frame(list_name = "c", name = c("1", "2"), `label::es` = c("Correo", "Otro"), check.names = FALSE))
  r <- .carga_sm_form_con_extra(base, fuente, "p4")
  expect_identical(r$form$survey$name, c("p1", "p4", "p4_other"))
})

test_that("con el formulario extendido, la alineación (ADR 0099) empareja la pregunta extra con la variable nueva", {
  inst_de <- function(m) { p <- tempfile(fileext = ".xlsx"); .sm_mb_write_xlsform_model(m, p); reporte_instrumento(path = p) }
  base <- form(sv(c("integer", "text"), c("p1", "p2"), c("Edad", "Comentario")))
  fuente <- form(sv(c("integer", "text", "text"), c("p1", "p2", "p3"), c("Edad", "Comentario", "Código de estudiante")))
  antes <- .sm_mb_alinear_fuente(inst_de(base), inst_de(fuente))
  expect_identical(antes$sin_par_fuente$variable, "p3") # sin extender, la regla 3 la deja fuera
  extendida <- .carga_sm_form_con_extra(base, fuente, antes$sin_par_fuente$variable)$form
  despues <- .sm_mb_alinear_fuente(inst_de(extendida), inst_de(fuente))
  expect_identical(nrow(despues$sin_par_fuente), 0L)
  expect_identical(unname(despues$mapa[["p3"]]), "p3")
})
