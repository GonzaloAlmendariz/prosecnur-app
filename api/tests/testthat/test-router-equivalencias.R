source("setup-load-all.R")

# ADR 0062 — capa de sesión de la equivalencia entre públicos.
#
# El caso que más importa aquí es DÓNDE aterrizan las etiquetas. Escribirlas en la config global reintroduciría el defecto del
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

test_that("el editor normaliza códigos crudos, descarta filas vacías y sella la declaración", {
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)

  out <- .equiv_guardar_declaracion(sid, list(
    list(seccion = "Servicios", etiqueta_estandar = "¿Conoce el Servicio de salud?",
         variables = list(docentes = "q0013_0001", estudiantes = "p11_1"),
         diapositiva = "3"),
    # Fila sin ninguna variable: no declara nada y no debe ensuciar el conteo.
    list(seccion = "Servicios", etiqueta_estandar = "Sobra", variables = list())
  ))

  expect_equal(out$estado$n_filas, 1L)
  s <- session_get(sid)
  fila <- s$equivalencias_publicos$filas[[1]]
  # El editor acepta códigos crudos de la plataforma y los guarda canónicos.
  expect_equal(fila$variables$docentes, "p13_1")
  expect_null(fila$diapositiva)   # ADR 0103: la matriz no guarda la diapositiva
  expect_equal(fila$cantidad, 2L)

  # Y guardar aplica las etiquetas en la config de la base.
  expect_equal(s$analitica_config_por_base$docentes$datos$variable_labels[["p13_1"]],
               "¿Conoce el Servicio de salud?")

  # El sello queda tomado al guardar.
  expect_true(nzchar(s$equivalencias_publicos$sellos$estudiantes))
})

test_that("base_texto de la fila persiste como el enunciado: recortado y sólo si no está vacío", {
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)
  .equiv_guardar_declaracion(sid, list(
    list(seccion = "Servicios", etiqueta_estandar = "¿Conoce el Servicio de salud?",
         variables = list(docentes = "p13_1", estudiantes = "p11_1"),
         enunciado = "  ¿Conoces el Servicio de salud?  ",
         base_texto = "  quienes usaron algún servicio de la PUCP  "),
    list(seccion = "Servicios", etiqueta_estandar = "¿Qué tan satisfecho con el Servicio de salud?",
         variables = list(estudiantes = "p13_1"), base_texto = "   ")
  ))
  filas <- session_get(sid)$equivalencias_publicos$filas
  expect_identical(filas[[1]]$base_texto, "quienes usaron algún servicio de la PUCP")
  expect_identical(filas[[1]]$enunciado, "¿Conoces el Servicio de salud?")
  expect_false("base_texto" %in% names(filas[[2]]))

  # Volver a guardar sin el campo lo quita: la declaración es la del editor.
  .equiv_guardar_declaracion(sid, list(
    list(seccion = "Servicios", etiqueta_estandar = "¿Conoce el Servicio de salud?",
         variables = list(docentes = "p13_1", estudiantes = "p11_1"))))
  expect_null(session_get(sid)$equivalencias_publicos$filas[[1]]$base_texto)
})

test_that("ida y vuelta: \"\" borra enunciado y base_texto guardados, y la clave ausente no los revive", {
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)
  arm <- list(escala = list(list(codigo = "1", etiqueta = "Sí"), list(codigo = "2", etiqueta = "No")),
              por_base = list(docentes = list(comparable = TRUE, mapa = stats::setNames(list(), character(0))),
                              estudiantes = list(comparable = TRUE, mapa = stats::setNames(list(), character(0)))))
  fila <- function(...) c(list(seccion = "Servicios", etiqueta_estandar = "¿Conoce el Servicio de salud?",
                               variables = list(docentes = "p13_1", estudiantes = "p11_1")), list(...))
  guardada <- function() session_get(sid)$equivalencias_publicos$filas[[1]]
  declarar <- function() .equiv_guardar_declaracion(sid, list(fila(
    enunciado = "¿Conoces el Servicio de salud?", base_texto = "quienes usaron un servicio", armonizacion = arm)))

  # 1. El cliente borra los dos textos: llegan "" y la fila previa no los repone,
  #    ni siquiera por la conservación de la armonización (la clave no viaja).
  declarar()
  expect_identical(guardada()$base_texto, "quienes usaron un servicio")
  .equiv_guardar_declaracion(sid, list(fila(enunciado = "", base_texto = "")))
  expect_false(any(c("enunciado", "base_texto") %in% names(guardada())))
  expect_false(is.null(guardada()$armonizacion))  # lo que sí se conserva sigue conservándose

  # 2. La fila llega SIN las claves: tampoco quedan.
  declarar()
  .equiv_guardar_declaracion(sid, list(fila()))
  expect_false(any(c("enunciado", "base_texto") %in% names(guardada())))
  expect_false(is.null(guardada()$armonizacion))
})

# ADR 0096 decisión 5: GET /api/carga/equivalencias publica la revisión nueva
# (`r3:` desde el ADR 0103), calculada con los instrumentos de cada público. Es uno de los cuatro
# productores que tienen que coincidir (los otros tres en
# test-graficos-plan-consolidado.R, R9).
test_that("R9: GET /api/carga/equivalencias devuelve la revisión r3: con los instrumentos", {
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "equivalencias_publicos", .req_equiv())
  testthat::local_mocked_bindings(session_header = function(req) sid, .package = "prosecnurapp")
  pr <- mount_equivalencias(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  ep <- endpoints[[which(vapply(endpoints, function(e) {
    identical(e$path, "/api/carga/equivalencias") && "GET" %in% e$verbs
  }, logical(1)))]]
  res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  out <- ep$getFunc()(new.env(parent = emptyenv()), res)

  expect_identical(as.integer(res$status), 200L)
  expect_match(out$revision, "^r3:")
  expect_identical(out$revision, .equiv_declaracion_revision(.req_equiv(), .equiv_inst_por_base(sid)))
})

# ADR 0104: la matriz se arma en la app. «Generar plantilla», «Subir matriz» y
# «Proponer emparejados» se retiraron con sus endpoints; «Importar por bloques»
# (series de mediciones), guardar, leer, variables y preview se quedan.
test_that("ADR 0104: los endpoints de plantilla, importar Excel y sugerencias ya no se montan", {
  pr <- mount_equivalencias(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  rutas <- vapply(endpoints, function(e) paste(paste(e$verbs, collapse = ","), e$path), character(1))
  expect_false(any(grepl("/api/carga/equivalencias/plantilla$", rutas)))
  expect_false(any(grepl("/api/carga/equivalencias/importar$", rutas)))
  expect_false(any(grepl("/api/carga/equivalencias/sugerencias$", rutas)))
  expect_setequal(rutas, c(
    "GET /api/carga/equivalencias",
    "GET /api/carga/equivalencias/variables",
    "POST /api/carga/equivalencias/declaracion",
    "GET /api/carga/equivalencias/armonizacion/preview",
    "POST /api/carga/equivalencias/importar-bloques"
  ))
  for (f in c(".equiv_escribir_plantilla", ".equiv_importar_desde_file", ".equiv_sugerir",
              ".equiv_desde_df", ".equiv_plantilla_df", ".equiv_catalogo_df")) {
    expect_false(exists(f, envir = asNamespace("prosecnurapp"), inherits = FALSE), info = f)
  }
})
