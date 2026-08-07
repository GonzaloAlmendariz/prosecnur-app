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

test_that("la plantilla de un estudio sin declaracion sale con encabezados y sin filas", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)

  meta <- .equiv_escribir_plantilla(sid)
  expect_true(file.exists(meta$path))
  expect_equal(meta$kind, "equivalencias_plantilla")

  hoja <- readxl::read_excel(meta$path, sheet = .EQUIV_HOJA_PLANTILLA,
                             .name_repair = "minimal")
  # Ni una fila. Antes volcaba una por CADA variable de cada base, con su codigo
  # en una sola columna y el resto vacias: una escalera diagonal que enterraba lo
  # que el analista si tiene que decidir. Los codigos se buscan en la hoja
  # `Variables`, que es para lo que esta.
  expect_equal(nrow(hoja), 0L)
  expect_equal(names(hoja), c("seccion", "etiqueta_estandar", "docentes",
                              "estudiantes", "diapositiva", "enunciado"))

  # Y subirla sin escribir nada se rechaza en vez de borrar lo que hubiera.
  expect_error(.equiv_importar_desde_file(sid, meta$file_id), class = "api_error")
})

test_that("el editor y el Excel producen el mismo artefacto", {
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
  # El editor acepta códigos crudos igual que el importador: una vía no puede
  # expresar cosas que la otra no.
  expect_equal(fila$variables$docentes, "p13_1")
  expect_equal(fila$diapositiva, "3")
  expect_equal(fila$cantidad, 2L)

  # Y guardar aplica las etiquetas igual que importar.
  expect_equal(s$analitica_config_por_base$docentes$datos$variable_labels[["p13_1"]],
               "¿Conoce el Servicio de salud?")

  # El sello queda tomado al guardar, no sólo al importar desde Excel.
  expect_true(nzchar(s$equivalencias_publicos$sellos$estudiantes))
})

test_that("las sugerencias no se guardan solas", {
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)
  sug <- .equiv_sugerir(.equiv_inst_por_base(sid))
  expect_true(length(sug) > 0)
  # Pedirlas no declara nada: el estado sigue sin declaración.
  expect_false(.equiv_estado(sid)$declarada)
})

test_that("exportar e importar sin editar devuelve la MISMA declaracion", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)

  # Los tres modos del ADR 0064 —escribirlo en el Excel, decidirlo en la pestana,
  # o decidirlo y descargarlo— solo conviven si el archivo no pierde nada al
  # viajar. Esta garantia es lo que impide que la proxima columna que alguien
  # anada se caiga en silencio: fue exactamente lo que paso con `enunciado`.
  #
  # El fixture mapea TODAS las variables del instrumento: asi la plantilla no
  # anade filas sueltas y la comparacion es de identidad, no de contencion.
  declarada <- list(
    schema = "equivalencias_publicos/v1",
    bases = c("docentes", "estudiantes"),
    filas = list(
      list(seccion = "1.2 Servicios", etiqueta_estandar = "Servicio de salud",
           variables = list(docentes = "p13_1", estudiantes = "p11_1"),
           diapositiva = "3", enunciado = "¿Conoce los siguientes servicios?",
           cantidad = 2L),
      list(seccion = "1.2 Servicios", etiqueta_estandar = "Bienestar",
           variables = list(docentes = "p14_1", estudiantes = "p13_1"),
           diapositiva = "3", enunciado = "¿Conoce los siguientes servicios?",
           cantidad = 2L)
    )
  )
  session_set(sid, "equivalencias_publicos", declarada)

  meta <- .equiv_escribir_plantilla(sid)
  vuelta <- .equiv_importar_desde_file(sid, meta$file_id)$estado

  expect_equal(vuelta$n_filas, 2L)
  comparable <- function(filas) {
    lapply(filas, function(f) list(
      seccion = as.character(f$seccion %||% ""),
      etiqueta_estandar = as.character(f$etiqueta_estandar %||% ""),
      diapositiva = as.character(f$diapositiva %||% ""),
      enunciado = as.character(f$enunciado %||% ""),
      variables = f$variables[order(names(f$variables))]
    ))
  }
  expect_equal(comparable(vuelta$filas), comparable(declarada$filas))
})

test_that("la hoja de consulta viaja aparte y el importador la ignora", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)

  meta <- .equiv_escribir_plantilla(sid)
  hojas <- readxl::excel_sheets(meta$path)
  expect_true(.EQUIV_HOJA_PLANTILLA %in% hojas)
  expect_true(.EQUIV_HOJA_CATALOGO %in% hojas)

  # El catalogo reemplaza a las columnas `<base>_etiqueta`, que doblaban el ancho
  # de la hoja donde se escribe. La hoja de trabajo lleva el nucleo y el plan, y
  # ninguna columna de ayuda.
  hoja <- readxl::read_excel(meta$path, sheet = .EQUIV_HOJA_PLANTILLA,
                             .name_repair = "minimal")
  expect_equal(names(hoja), c("seccion", "etiqueta_estandar", "docentes",
                              "estudiantes", "diapositiva", "enunciado"))

  # El catalogo lleva las variables de las dos bases: es donde se buscan los
  # codigos ahora que la hoja de trabajo no los vuelca.
  cat_ <- readxl::read_excel(meta$path, sheet = .EQUIV_HOJA_CATALOGO,
                             .name_repair = "minimal")
  expect_equal(names(cat_), c("base", "variable", "etiqueta"))
  expect_setequal(unique(cat_$base), c("docentes", "estudiantes"))
})

test_that("cada columna de publico trae el desplegable de SUS variables", {
  skip_if_not_installed("openxlsx")
  sid <- .req_setup("separate")
  on.exit(session_delete(sid), add = TRUE)

  meta <- .equiv_escribir_plantilla(sid)
  val <- xml2::read_xml(unz(meta$path, "xl/worksheets/sheet1.xml"))
  nodos <- xml2::xml_find_all(val, "//*[local-name()='dataValidation']")
  expect_gte(length(nodos), 2L)

  # El rango se calcula del catalogo, agrupado por base: cada columna apunta a un
  # tramo distinto. Nada de listas fijas — un estudio de tres bases o de seis
  # produce sus tres o seis desplegables sin tocar codigo.
  formulas <- vapply(nodos, function(n) {
    xml2::xml_text(xml2::xml_find_first(n, ".//*[local-name()='formula1']"))
  }, character(1))
  expect_true(all(grepl(sprintf("^'%s'!\\$B\\$", .EQUIV_HOJA_CATALOGO), formulas)))
  expect_equal(length(unique(formulas)), 2L)
})
