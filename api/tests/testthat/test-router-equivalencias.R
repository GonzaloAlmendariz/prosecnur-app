source("setup-load-all.R")

# ADR 0062 — capa de sesión de la equivalencia entre públicos.
#
# El caso que más importa aquí no es la importación en sí: es DÓNDE aterrizan
# las etiquetas. Escribirlas en la config global reintroduciría el defecto del
# ADR 0061 a mayor escala —152 etiquetas filtrándose entre públicos en vez de
# las 10 que ya lo causaron—, así que ese guard es directo y explícito.

.req_inst <- function(nombres, etiquetas) {
  list(survey = data.frame(
    type = rep("select_one lst", length(nombres)),
    name = nombres, label = etiquetas, section = "Pag1",
    stringsAsFactors = FALSE))
}

# Estudio con dos públicos donde `p13_1` significa cosas distintas.
.req_setup <- function(topology = "separate") {
  sid <- session_create()
  s <- session_get(sid)
  s$estudio <- list(
    bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
    processing_mode = "multibase",
    topology_declared = topology,
    active_base = "docentes"
  )
  s$rp_inst_sources <- list(
    docentes = .req_inst(c("p13_1", "p14_1"), c("Servicio de salud", "Servicio de salud")),
    estudiantes = .req_inst(c("p11_1", "p13_1"), c("Servicio de salud", "Servicio de salud"))
  )
  .session_env[[sid]] <- s
  sid
}

.req_equiv <- function() {
  list(
    schema = "equivalencias_publicos/v1",
    bases = c("docentes", "estudiantes"),
    n_filas = 2L,
    filas = list(
      list(seccion = "Servicios", etiqueta_estandar = "¿Conoce el Servicio de salud?",
           variables = list(docentes = "p13_1", estudiantes = "p11_1"), cantidad = 2L),
      list(seccion = "Servicios", etiqueta_estandar = "¿Qué tan satisfecho con el Servicio de salud?",
           variables = list(estudiantes = "p13_1"), cantidad = 1L)
    )
  )
}

test_that("la pestaña sólo aplica a estudios con bases que no comparten instrumento", {
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)
  expect_true(.equiv_disponible(sid))

  sid2 <- .req_setup("integrated")
  on.exit(session_delete(sid2), add = TRUE)
  expect_false(.equiv_disponible(sid2))
  # Y el endpoint corta en vez de dejar declarar algo que no significa nada.
  expect_error(.equiv_requiere_disponible(sid2), class = "api_error")
})

test_that("las etiquetas aterrizan en la config POR BASE y la global no se toca", {
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "analitica_config", list(datos = list(variable_labels = list(centinela = "no tocar"))))

  .equiv_aplicar_a_analitica(sid, .req_equiv())
  s <- session_get(sid)

  # Cada público recibe la etiqueta en SU variable.
  expect_equal(s$analitica_config_por_base$docentes$datos$variable_labels[["p13_1"]],
               "¿Conoce el Servicio de salud?")
  expect_equal(s$analitica_config_por_base$estudiantes$datos$variable_labels[["p11_1"]],
               "¿Conoce el Servicio de salud?")
  # Y `p13_1` de estudiantes conserva SU significado, que es el defecto del 0061.
  expect_equal(s$analitica_config_por_base$estudiantes$datos$variable_labels[["p13_1"]],
               "¿Qué tan satisfecho con el Servicio de salud?")

  # Guard directo contra regresar al ADR 0061: la global queda intacta.
  expect_equal(s$analitica_config$datos$variable_labels[["centinela"]], "no tocar")
  expect_null(s$analitica_config$datos$variable_labels[["p13_1"]])
})

test_that("una edición manual previa se conserva y se reporta, no se pisa", {
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "analitica_config_por_base", list(
    docentes = list(datos = list(variable_labels = list(p13_1 = "Texto que escribí a mano")))
  ))

  resumen <- .equiv_aplicar_a_analitica(sid, .req_equiv())
  s <- session_get(sid)

  # No podemos saber si la edición es anterior o posterior; destruirla en
  # silencio es peor que dejar las dos verdades visibles y dichas.
  expect_equal(s$analitica_config_por_base$docentes$datos$variable_labels[["p13_1"]],
               "Texto que escribí a mano")
  expect_equal(resumen$docentes$conservadas, 1L)
  expect_equal(resumen$docentes$aplicadas, 0L)
  # La otra base sí recibe las suyas.
  expect_equal(resumen$estudiantes$aplicadas, 2L)
})

test_that("el estado reporta desfase cuando el instrumento cambió tras importar", {
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)

  equiv <- .req_equiv()
  equiv$sellos <- lapply(.equiv_inst_por_base(sid), .equiv_sello_instrumento)
  session_set(sid, "equivalencias_publicos", equiv)

  expect_equal(.equiv_estado(sid)$desfasadas, character(0))

  # El instrumento de docentes cambia después de la importación.
  s <- session_get(sid)
  s$rp_inst_sources$docentes <- .req_inst(c("p13_1", "p99_9"), c("Servicio de salud", "Nueva"))
  .session_env[[sid]] <- s

  estado <- .equiv_estado(sid)
  expect_equal(estado$desfasadas, "docentes")
  # No invalida la declaración entera: sus otras filas siguen sirviendo.
  expect_true(estado$declarada)
  expect_equal(estado$n_filas, 2L)
})

test_that("el estado de un estudio sin declaración no inventa nada", {
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)
  estado <- .equiv_estado(sid)
  expect_true(estado$disponible)
  expect_false(estado$declarada)
  expect_equal(estado$n_filas, 0L)
})

test_that("plantilla e importación cierran el ciclo sobre la sesión", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)

  meta <- .equiv_escribir_plantilla(sid)
  expect_true(file.exists(meta$path))
  expect_equal(meta$kind, "equivalencias_plantilla")

  # La plantilla recién emitida vuelve a entrar: cuatro variables sin emparejar,
  # ninguna con etiqueta estándar todavía.
  out <- .equiv_importar_desde_file(sid, meta$file_id)
  expect_true(out$estado$declarada)
  expect_equal(out$estado$n_filas, 4L)
  expect_equal(out$estado$n_sin_etiqueta, 4L)
  # Sin etiquetas escritas no hay nada que aplicar: la importación no inventa.
  expect_equal(out$aplicacion$docentes$aplicadas, 0L)

  # Y el sello queda guardado, que es lo que permite detectar el desfase después.
  s <- session_get(sid)
  expect_true(nzchar(s$equivalencias_publicos$sellos$docentes))
})
