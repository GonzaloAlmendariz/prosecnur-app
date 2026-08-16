# Un .pulso anonimizado sigue pudiendo reproducir su propio marco.
#
# El anonimizador reescribe los VALORES de las tablas, pero el estado guarda
# además DECISIONES que nombran esos valores. Si los valores cambian y las
# decisiones no, el fixture queda inconsistente consigo mismo: el criterio pide
# categorías que su propia base ya no tiene.
#
# Medido en `hsvg2026`: el criterio `faculty` pedía 15 facultades reales, la
# base traía nombres de persona, y reconstruir el marco daba 0 elegibles de
# 136.284 filas. Se diagnosticó DOS VECES como bug del motor —una sesión lo
# anotó como «limpiar criterios antes de construir», que es un workaround sobre
# el síntoma— antes de que alguien llegara hasta la anonimización.

test_that("el mapa de categorías traduce por text_key y descarta lo que no cambia", {
  dicc <- c(
    "CIENCIAS E INGENIERIA" = "Ricardo Ricardo Karina",
    "DERECHO" = "Andres",
    # Clave y valor colapsan al mismo text_key: no aporta traducción.
    "Educacion" = "educación"
  )
  mapa <- .pulso_anon_mapa_categorias(dicc)

  expect_identical(mapa[["ciencias_e_ingenieria"]], "ricardo_ricardo_karina")
  expect_identical(mapa[["derecho"]], "andres")
  expect_false("educacion" %in% names(mapa))
})

test_that("las categorías de la suite se reescriben al vocabulario nuevo", {
  seleccion <- list(byVariable = list(
    faculty = list(scope = "alumno", layer = "marco",
                   categories = list("ciencias_e_ingenieria", "derecho")),
    formation = list(scope = "alumno", layer = "marco",
                     categories = list("pregrado"))
  ))
  mapa <- c(ciencias_e_ingenieria = "ricardo_ricardo_karina", derecho = "andres")

  res <- .pulso_anon_traducir_seleccion(seleccion, mapa)

  expect_identical(res$n, 2L)
  expect_identical(
    unlist(res$seleccion$byVariable$faculty$categories),
    c("ricardo_ricardo_karina", "andres")
  )
  # `pregrado` no está en el mapa: se deja intacta. Sustituirla por nada
  # convertiría el criterio en uno que no filtra, que cambia el marco en
  # silencio — peor que dejarla.
  expect_identical(unlist(res$seleccion$byVariable$formation$categories), "pregrado")
})

test_that("la suite se encuentra por forma, esté donde esté en el estado", {
  # El estado guarda la suite en más de un sitio —el marco construido y la
  # config del workspace—, así que la búsqueda es por forma y no por ruta.
  estado <- list(
    calc_muestra_aulas_frame = list(
      aula_frame = data.frame(x = 1:2),
      criterios_seleccion = list(byVariable = list(
        faculty = list(categories = list("derecho"))
      ))
    ),
    calc_muestra_estudio = list(workspace = list(aulas_config = list(
      criterios_seleccion = list(byVariable = list(
        faculty = list(categories = list("derecho"))
      ))
    )))
  )
  dicc <- c("DERECHO" = "Andres")

  res <- .pulso_anon_traducir_criterios(estado, dicc)

  expect_identical(res$traducidas, 2L)
  expect_identical(
    unlist(res$estado$calc_muestra_aulas_frame$criterios_seleccion$byVariable$faculty$categories),
    "andres"
  )
  expect_identical(
    unlist(res$estado$calc_muestra_estudio$workspace$aulas_config$criterios_seleccion$byVariable$faculty$categories),
    "andres"
  )
  # Los data.frames no son suites: el recorrido no debe entrar a modificarlos.
  expect_identical(res$estado$calc_muestra_aulas_frame$aula_frame, data.frame(x = 1:2))
})

test_that("sin diccionario o sin suite no se toca nada", {
  estado <- list(a = list(byVariable = list(f = list(categories = list("derecho")))))

  expect_identical(.pulso_anon_traducir_criterios(estado, character(0))$traducidas, 0L)
  expect_identical(.pulso_anon_traducir_criterios(list(x = 1), c("A" = "B"))$traducidas, 0L)

  # Y una suite cuyas categorías no están en el diccionario queda igual.
  res <- .pulso_anon_traducir_criterios(estado, c("OTRA COSA" = "Andres"))
  expect_identical(res$traducidas, 0L)
  expect_identical(unlist(res$estado$a$byVariable$f$categories), "derecho")
})

test_that("un criterio sobrevive a la anonimización de su propia dimensión", {
  # La prueba de la clase entera de defecto, end-to-end: se anonimiza un .pulso
  # cuya base trae una columna de nombres y cuya suite de criterios nombra esos
  # mismos valores. Antes del arreglo, el criterio quedaba apuntando a
  # categorías inexistentes.
  skip_if_not_installed("zip")

  origen <- tempfile(fileext = ".pulso")
  stage <- tempfile("anon-crit-"); dir.create(stage, recursive = TRUE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)

  base <- data.frame(
    nombre_completo = c("Maria Torres Vega", "Jose Ruiz Campos"),
    stringsAsFactors = FALSE
  )
  estado <- list(
    monitoreo_snapshot = list(data = base),
    calc_muestra_aulas_frame = list(criterios_seleccion = list(byVariable = list(
      responsable = list(scope = "alumno", layer = "marco",
                         categories = list("maria_torres_vega"))
    )))
  )
  saveRDS(estado, file.path(stage, "state.rds"))
  writeLines(
    jsonlite::toJSON(list(format_version = 1, project_name = "crit"), auto_unbox = TRUE),
    file.path(stage, "manifest.json")
  )
  zip::zip(zipfile = origen, files = list.files(stage), root = stage)

  destino <- tempfile(fileext = ".pulso")
  rep <- pulso_anonimizar_archivo(origen, destino, sal = "sal-de-prueba", slug = "crit")

  leer <- tempfile("anon-out-"); dir.create(leer, recursive = TRUE)
  on.exit(unlink(leer, recursive = TRUE, force = TRUE), add = TRUE)
  zip::unzip(destino, exdir = leer)
  out <- readRDS(file.path(leer, "state.rds"))

  cat_final <- unlist(
    out$calc_muestra_aulas_frame$criterios_seleccion$byVariable$responsable$categories
  )
  valores <- .pulso_anon_text_key(out$monitoreo_snapshot$data$nombre_completo)

  # El criterio ya no nombra al original...
  expect_false(identical(cat_final, "maria_torres_vega"))
  # ...y sí nombra a alguien que EXISTE en la base anonimizada, que es la
  # propiedad que hace al fixture capaz de reproducir su marco.
  expect_true(cat_final %in% valores)
  expect_gt(rep$n_criterios_traducidos, 0L)
})
