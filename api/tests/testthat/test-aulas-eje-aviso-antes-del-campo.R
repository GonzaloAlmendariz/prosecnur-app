# **El aviso de configuración no espera a la primera respuesta.**
#
# Medido el 2026-09-18 sobre CCSS Perfil 2026-II, cuatro días antes de salir a
# campo: el estudio declara el eje de cuotas por NIVEL —que se resuelve por el
# código del alumno contra un padrón—, el `source_mapping` tiene
# `student_code_var` vacío, y las tres versiones del XLSForm no traen ninguna
# pregunta por el código. O sea: ninguna respuesta podrá caer nunca en su celda.
#
# El satélite ya redactaba ese diagnóstico, exacto y con dónde se arregla. Pero
# salía por un `return` temprano con `aviso = ""` cuando no había respuestas, así
# que sólo habría aparecido el día que empezaran a llegar — en campo, cuando ya
# no se puede arreglar a tiempo. La causa que reporta es del CONFIG y se sabe el
# día que el estudio se configura.

.maeav_eje_persona <- list(
  clave = "nivel", columna = "level", etiqueta = "Nivel",
  etiqueta_plural = "Niveles", etiqueta_sin = "Sin nivel",
  atribucion = "persona", fuente_valor = "padron"
)
.maeav_vacio <- data.frame(
  valid = logical(0), matched = logical(0), fuera = logical(0),
  fila = integer(0), stringsAsFactors = FALSE
)

test_that("sin una sola respuesta, un eje por persona sin la variable del código YA lo dice", {
  out <- monitoreo_aulas_eje_atribucion(
    .maeav_vacio, plan_df = NULL, responses = NULL,
    cfg = list(source_mapping = list(student_code_var = "")),
    eje = .maeav_eje_persona, padron = NULL)
  aviso <- attr(out, "aviso")
  expect_true(nzchar(aviso))
  # Dice la causa Y dónde se arregla: un aviso que sólo dice el hecho deja al
  # lector igual de atascado.
  expect_true(grepl("no\\s+declara en qué pregunta viene", aviso))
  expect_true(grepl("student_code_var", aviso, fixed = TRUE))
})

test_that("con la variable declarada pero sin padrón, el aviso es el OTRO", {
  # Dos causas distintas se arreglan en sitios distintos: una es el mapeo, la
  # otra es cargar el padrón. Un solo aviso para las dos manda a buscar mal.
  out <- monitoreo_aulas_eje_atribucion(
    .maeav_vacio, plan_df = NULL, responses = NULL,
    cfg = list(source_mapping = list(student_code_var = "A0")),
    eje = .maeav_eje_persona, padron = NULL)
  expect_true(grepl("padr", attr(out, "aviso")))
  expect_false(grepl("student_code_var", attr(out, "aviso"), fixed = TRUE))
})

test_that("con todo declarado no se inventa una advertencia", {
  out <- monitoreo_aulas_eje_atribucion(
    .maeav_vacio, plan_df = NULL, responses = NULL,
    cfg = list(source_mapping = list(student_code_var = "A0")),
    eje = .maeav_eje_persona,
    padron = list(filas = list(list(codigo = "20201234", nivel = "7"))))
  expect_identical(attr(out, "aviso"), "")
})

test_that("con el eje en el AULA no se avisa de un padrón que ese estudio no usa", {
  # HSVG está en campo: su eje es la facultad, el valor vive en el plan y no hay
  # nada que cruzar. Un aviso sobre el padrón ahí sería ruido puro.
  out <- monitoreo_aulas_eje_atribucion(
    .maeav_vacio, plan_df = NULL, responses = NULL,
    cfg = list(source_mapping = list(student_code_var = "")),
    eje = list(clave = "facultad", columna = "faculty", etiqueta = "Facultad",
               etiqueta_plural = "Facultades", etiqueta_sin = "Sin facultad",
               atribucion = "aula", fuente_valor = "plan"),
    padron = NULL)
  expect_identical(attr(out, "aviso"), "")
})

test_that("el camino de cero respuestas y el de muchas dicen LO MISMO", {
  # Dos redacciones de la misma regla divergen tarde o temprano, y aquí una de
  # las dos sólo se ve en campo: la que menos ojos tiene encima.
  cfg <- list(source_mapping = list(student_code_var = ""))
  sin_nada <- attr(monitoreo_aulas_eje_atribucion(
    .maeav_vacio, cfg = cfg, eje = .maeav_eje_persona), "aviso")
  con_filas <- prosecnurapp:::.maea_aviso_de_config(NULL, cfg)
  expect_identical(sin_nada, con_filas)
})
