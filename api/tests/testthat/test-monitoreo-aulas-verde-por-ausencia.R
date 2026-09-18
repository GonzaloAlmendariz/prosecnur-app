# Un control que no pudo mirar nada no es un control que paso.
#
# Con un estudio recien importado —plan si, campo todavia no— la lista de
# validacion declaraba **9 correctos de 11**, y siete de esos nueve explicaban
# en su propio texto que no habian comprobado nada. Quien la lee de un vistazo
# se lleva que el estudio esta limpio; lo cierto es que no se ha revisado.
#
# Es el «verde por AUSENCIA, no por conformidad» que el Contrato de Superficie
# prohibe, cometido dentro de la propia lista de validacion. El vocabulario ya
# existia (`sin_datos` → «SIN COMPROBAR» en pantalla): faltaba aplicarlo donde
# el detalle ya lo declaraba.

.vpa_estudio_sin_campo <- function() {
  plan <- list(list(classroom_id = "A", operational_code = "CH 1", label = "x",
                    wave = "M1", sample_role = "titular", orden = 1, eligible_n = 30))
  monitoreo_aulas_dashboard(plan, data.frame(), list(enabled = TRUE, plan = plan))
}

.vpa_estado <- function(d, check) {
  fila <- Filter(function(r) identical(as.character(r$check), check), d$validation)[[1]]
  list(status = as.character(fila$status), detail = as.character(fila$detail))
}

# Los que dependen de datos que este estudio todavia no tiene. Cada uno con la
# razon por la que no se puede comprobar, que es lo que el texto debe decir.
SIN_CAMPO <- c(
  "personal_identifiers", "unmapped_valid_responses", "duplicate_responses",
  "sex_faculty_quota", "field_report_reconciliation", "book_sheets_cross_check",
  "unnamed_control_columns", "valid_response_criterion"
)

test_that("ningun control se declara correcto sin haber comprobado nada", {
  d <- .vpa_estudio_sin_campo()
  for (check in SIN_CAMPO) {
    e <- .vpa_estado(d, check)
    expect_identical(e$status, "sin_datos",
                     info = paste0(check, " dice '", e$status, "': ", e$detail))
  }
})

test_that("el estado y el texto dicen lo mismo", {
  # El defecto simetrico: poner `sin_datos` y dejar un texto que afirma haber
  # contado —«Todas las respuestas validas se atribuyeron a un aula»— con cero
  # respuestas. El estado seria correcto y la frase seguiria mintiendo.
  d <- .vpa_estudio_sin_campo()
  afirma_haber_contado <- "^Tod[oa]s l[oa]s "
  for (check in SIN_CAMPO) {
    e <- .vpa_estado(d, check)
    expect_false(grepl(afirma_haber_contado, e$detail),
                 info = paste0(check, " no comprobo nada y su texto dice: ", e$detail))
  }
})

test_that("lo que si se pudo comprobar sigue diciendo ok", {
  # El control tiene que discriminar: si todo pasara a `sin_datos` el test de
  # arriba pasaria por la razon equivocada. `unknown_sample_status` mira el
  # plan, que SI existe en este estudio.
  d <- .vpa_estudio_sin_campo()
  expect_identical(.vpa_estado(d, "unknown_sample_status")$status, "ok")
  expect_identical(.vpa_estado(d, "anonymous_responses")$status, "ok")
})

test_that("con datos que comprobar, el control vuelve a pronunciarse", {
  # La contracara: `sin_datos` no puede ser la respuesta comoda. Con una hoja
  # de control que SI trae columnas sin nombre, el mismo check dice `review`.
  plan <- list(list(classroom_id = "A", operational_code = "CH 1", label = "x",
                    wave = "M1", sample_role = "titular", orden = 1, eligible_n = 30))
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list(
    enabled = TRUE, plan = plan,
    control = list(list(operational_code = "CH 1")),
    control_sin_nombre = 7L
  ))
  e <- .vpa_estado(d, "unnamed_control_columns")
  expect_identical(e$status, "review")
  expect_match(e$detail, "7 columnas")
})

test_that("monitoreo_aulas_estado_control separa los tres desenlaces", {
  expect_identical(monitoreo_aulas_estado_control(FALSE, FALSE), "sin_datos")
  # No comprobable manda: sin nada que mirar no se puede haber hallado nada.
  expect_identical(monitoreo_aulas_estado_control(FALSE, TRUE), "sin_datos")
  expect_identical(monitoreo_aulas_estado_control(TRUE, FALSE), "ok")
  expect_identical(monitoreo_aulas_estado_control(TRUE, TRUE), "review")
  expect_identical(monitoreo_aulas_estado_control(TRUE, TRUE, "warning"), "warning")
})

# ---------------------------------------------------------------------------
# «APLICADAS» cuenta lo que el registro de campo declara
# ---------------------------------------------------------------------------

# Medido en la app el 2026-08-25, importando una semana simulada de 40 partes de
# los que 35 dicen APLICADA: Consultas > Parte de campo ensenaba «40 partes · de
# 586 personas en el aula quedaron 540 respuestas» y, dos pestanas mas alla, la
# tarjeta «APLICADAS · declaradas en el registro de campo» seguia diciendo 0.
#
# La cifra salia solo de `operational_status`, el estado del PLAN, y desde el
# libro ese estado no puede llegar nunca a «aplicada»: la hoja «Listas» solo
# ofrece AGENDADA / REAGENDADA / REEMPLAZADA / EN RESERVA n para STATUS MUESTRA.
# El veredicto del parte vive en `application_status`, en la misma fila.

.vpa_aula <- function(codigo, ...) {
  c(list(classroom_id = codigo, operational_code = codigo, label = codigo,
         faculty = "Derecho", wave = "M1", sample_role = "titular",
         orden = 1, eligible_n = 30), list(...))
}

.vpa_aplicadas <- function(plan) {
  monitoreo_aulas_dashboard(plan, data.frame(), list(enabled = TRUE, plan = plan))$kpis$aulas_aplicadas
}

test_that("una aula con parte APLICADA cuenta como aplicada", {
  expect_identical(.vpa_aplicadas(list(
    .vpa_aula("CH 1", application_status = "APLICADA"),
    .vpa_aula("CH 2", application_status = "NO APLICADA"),
    .vpa_aula("CH 3")
  )), 1L)
})

test_that("el estado del plan sigue contando aunque no haya parte", {
  # La union no puede bajarle la cifra a los estudios que no llenan el libro.
  expect_identical(.vpa_aplicadas(list(
    .vpa_aula("CH 1", operational_status = "aplicada"),
    .vpa_aula("CH 2", operational_status = "cerrada"),
    .vpa_aula("CH 3", operational_status = "agendada")
  )), 2L)
})

test_that("no se cuenta dos veces la que trae las dos senales", {
  expect_identical(.vpa_aplicadas(list(
    .vpa_aula("CH 1", operational_status = "aplicada", application_status = "APLICADA")
  )), 1L)
})

# --- «no aplica» tampoco es «no lo sabemos» ---------------------------------
#
# El hermano del defecto de arriba, por el otro lado. El control de la cuota por
# sexo decia «Sin cuota sexo x facultad detectable», que se lee como que la app
# busco un dato y no lo encontro. En un estudio cuya cuota es por el eje y nada
# mas —CCSS prometio sus metas por nivel curricular, con sexo y carrera
# referenciales— **no falta nada**: el diseño no lo prometio.
#
# Son los tres estados de siempre —no se sabe, medimos cero, no aplica— con el
# tercero colapsado en el primero. El ESTADO se queda en «sin comprobar», que es
# correcto porque no hay nada que comprobar; lo que cambia es el porque, que es
# para lo que existe el detalle.

.vpa_con_cuota_sin_sexo <- function(eje = "nivel") {
  plan <- list(
    list(classroom_id = "A", operational_code = "CH 1", label = "x", wave = "M1",
         sample_role = "titular", orden = 1, eligible_n = 30, level = "6"),
    list(classroom_id = "B", operational_code = "CH 2", label = "y", wave = "M1",
         sample_role = "titular", orden = 2, eligible_n = 30, level = "7")
  )
  cfg <- list(
    enabled = TRUE, plan = plan, eje_cuota = eje,
    # El diseño SI fija cuota —por el eje— y NO por sexo: `cuota_sexo` vacia.
    design_targets = list(
      schema = "monitoreo_aulas_design_targets_v1",
      facultades = list(
        list(facultad = "6", faculty_key = "6", cuota = 120, tau = 0.5, cuota_sexo = list()),
        list(facultad = "7", faculty_key = "7", cuota = 121, tau = 0.5, cuota_sexo = list())
      )
    )
  )
  monitoreo_aulas_dashboard(plan, data.frame(), cfg)
}

test_that("con cuota declarada SIN sexo, el control dice que no aplica y por que", {
  e <- .vpa_estado(.vpa_con_cuota_sin_sexo(), "sex_faculty_quota")
  # El estado no cambia: no hay nada que comprobar y eso ya se decia bien.
  expect_identical(e$status, "sin_datos")
  # Lo que cambia es el porque, y nombra el eje del estudio.
  expect_true(grepl("El diseño no fija cuota por sexo", e$detail, fixed = TRUE))
  expect_true(grepl("por nivel", e$detail, fixed = TRUE))
  # Y ya NO se lee como un dato que falta.
  expect_false(grepl("detectable", e$detail, fixed = TRUE))
})

test_that("sin diseño ninguno, el texto es otro: ahi si falta la cuota entera", {
  # Dos ausencias distintas piden dos frases distintas. Un estudio sin cuota
  # declarada no es lo mismo que uno que la declaro sin sexo.
  e <- .vpa_estado(.vpa_estudio_sin_campo(), "sex_faculty_quota")
  expect_identical(e$status, "sin_datos")
  expect_false(grepl("El diseño no fija cuota por sexo", e$detail, fixed = TRUE))
})

test_that("con el eje en facultad la frase nombra la facultad, no el nivel", {
  # La palabra sale del eje declarado, no de una constante: es la vara de
  # generalidad de Gonzalo (2026-09-18) aplicada a un texto de control.
  e <- .vpa_estado(.vpa_con_cuota_sin_sexo("facultad"), "sex_faculty_quota")
  expect_true(grepl("por facultad", e$detail, fixed = TRUE))
  expect_false(grepl("por nivel", e$detail, fixed = TRUE))
})
