# =============================================================================
# El vocabulario de «Avance de campo»: una lista, tres consumidores
# =============================================================================
#
# `carga_aulas_libro_avance_columnas.R` declara los rótulos de las cinco tablas
# y la naturaleza de cada uno. Lo leen TRES sitios —el writer del xlsx, el
# renderer del Sheets y el formateador de la pestaña— y de ahí el riesgo que
# esta suite cubre: que la lista y el modelo se separen sin que nada avise.
#
# Es el modo de fallo más caro de este libro. En un solo día costó seis anclas
# mudas: `pon()` dejó de escribir cuatro columnas al renombrarlas, dos estilos
# quedaron fijados a una posición, y un techo de 188 aulas salió publicado como
# «18800,0 %» porque una columna nueva corrió el índice del porcentaje. Ninguno
# de los seis dio error: todos siguieron en verde escribiendo en el sitio
# equivocado.

.calac_ind <- function() {
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "A1", sample_role = "titular",
         faculty = "Letras", eligible_n = 30, expected_valid = 20,
         rendimiento_ref = 0.6, scheduled_time = "10:00"),
    list(operational_code = "CH 2", classroom_id = "A2", sample_role = "titular",
         faculty = "Letras", eligible_n = 30, expected_valid = 20,
         rendimiento_ref = 0.6, scheduled_time = "19:30")
  )
  resp <- data.frame(
    collectorID = c("CH 1", "CH 1", "CH 2"),
    `_submission_time` = c("2026-08-10T09:00:00", "2026-08-10T10:00:00",
                           "2026-08-11T09:00:00"),
    sexo = c("Mujer", "Hombre", "Mujer"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  aulas_libro_indicadores(
    plan, efectivas = c(`CH 1` = 18, `CH 2` = 12), responses = resp,
    validas = c(TRUE, TRUE, TRUE),
    cuotas = list(meta_diseno = 40, meta_operativa = 60,
                  facultades = list(list(facultad = "Letras", cuota = 40,
                                         cuota_sexo = list(F = 20, M = 20)))),
    cfg = list(source_mapping = list(collector_var = "collectorID")),
    asignados = list(`CH 1` = "Equipo A", `CH 2` = "Equipo A")
  )
}

test_that("las cinco tablas del vocabulario existen en el modelo, con SUS columnas", {
  ind <- .calac_ind()
  expect_setequal(names(AULAS_AVANCE_CABECERAS),
                  c("general", "facultad", "rendimiento", "aplicador", "diario"))
  for (clave in names(AULAS_AVANCE_CABECERAS)) {
    campo <- AULAS_AVANCE_CAMPOS[[clave]]
    tabla <- ind[[campo]]
    expect_true(is.data.frame(tabla) && nrow(tabla) > 0L,
                info = sprintf("el modelo no trae «%s» (campo `%s`)", clave, campo))
    expect_identical(names(tabla), AULAS_AVANCE_CABECERAS[[clave]],
                     info = sprintf("las columnas de «%s» no son las del vocabulario", clave))
  }
})

test_that("el campo del modelo de cada tabla se declara, no se adivina", {
  # `ind[["facultad"]]` devuelve NULL sin avisar —la clave es singular y el
  # campo plural— y con eso el ancho de la hoja del xlsx salió de 10 columnas
  # en vez de 17: todas las bandas de sección y todas las notas se quedaron
  # cortas, y la hoja seguía escribiéndose sin error.
  expect_setequal(names(AULAS_AVANCE_CAMPOS), names(AULAS_AVANCE_CABECERAS))
  ind <- .calac_ind()
  for (campo in AULAS_AVANCE_CAMPOS) {
    expect_true(campo %in% names(ind),
                info = sprintf("`%s` no es un campo del modelo", campo))
  }
})

test_that("cada tabla tiene su título de bloque y ninguno se repite", {
  expect_setequal(names(AULAS_AVANCE_TITULOS), names(AULAS_AVANCE_CABECERAS))
  expect_length(unique(unname(AULAS_AVANCE_TITULOS)), 5L)
})

test_that("ningún rótulo lleva «(%)»: el porcentaje es formato de celda", {
  # Gonzalo, 2026-09-08: «el (%) significa que va en porcentaje, no que les
  # pongas "(%)" al titulo».
  rotulos <- c(unlist(AULAS_AVANCE_CABECERAS, use.names = FALSE),
               AULAS_AVANCE_FILAS_GENERAL)
  expect_false(any(grepl("%", rotulos, fixed = TRUE)))
})

test_that("«tasa de facultad» se escribe con su nombre completo", {
  # Gonzalo, el mismo día: «la "tasa de facultad" es en realidad la "Tasa de
  # rendimiento de la facultad" y debe tener ese nombre».
  tasas <- grep("^Tasa", unlist(AULAS_AVANCE_CABECERAS, use.names = FALSE), value = TRUE)
  expect_gte(length(tasas), 4L)
  expect_true(all(grepl("rendimiento", tasas)))
})

test_that("la naturaleza de un rótulo se decide POR TABLA, no en una lista plana", {
  # «Diferencia» se llama igual en dos tablas y no es lo mismo: puntos
  # porcentuales en «Rendimiento por facultad» y encuestas en «Avance diario».
  # Con una lista plana el −35 encuestas de un martes salía como «−3 500,0 %».
  expect_true(prosecnurapp:::.calac_es_proporcion("Diferencia", "rendimiento"))
  expect_false(prosecnurapp:::.calac_es_proporcion("Diferencia", "diario"))
  # Y toda proporción declarada pertenece a la cabecera (o a las filas) de SU
  # tabla: una entrada huérfana no pintaría nada y nadie lo notaría.
  for (clave in names(AULAS_AVANCE_PROPORCIONES)) {
    universo <- if (identical(clave, "general")) {
      AULAS_AVANCE_FILAS_GENERAL
    } else {
      AULAS_AVANCE_CABECERAS[[clave]]
    }
    huerfanas <- setdiff(AULAS_AVANCE_PROPORCIONES[[clave]], universo)
    expect_length(huerfanas, 0L)
  }
})

test_that("todo rótulo de diferencia o de faltantes existe en alguna tabla", {
  universo <- c(unlist(AULAS_AVANCE_CABECERAS, use.names = FALSE),
                AULAS_AVANCE_FILAS_GENERAL)
  for (lista in list(AULAS_AVANCE_DIFERENCIAS, AULAS_AVANCE_FALTAN_MUESTRA,
                     AULAS_AVANCE_FALTAN_SOBREMUESTRA)) {
    expect_length(setdiff(lista, universo), 0L)
  }
  # Y las dos familias de faltantes no se solapan: una celda no puede pintarse
  # a la vez de verde por la muestra y de celeste por la sobremuestra.
  expect_length(intersect(AULAS_AVANCE_FALTAN_MUESTRA,
                          AULAS_AVANCE_FALTAN_SOBREMUESTRA), 0L)
})

test_that("una cabecera se reconoce por la fila ENTERA, no por su primera celda", {
  # Cuatro de las cinco tablas empiezan por «Facultad» desde el 2026-09-08.
  for (clave in names(AULAS_AVANCE_CABECERAS)) {
    expect_identical(
      prosecnurapp:::.calac_tabla_de_cabecera(AULAS_AVANCE_CABECERAS[[clave]]), clave)
  }
  expect_identical(prosecnurapp:::.calac_tabla_de_cabecera(c("Facultad", "otra cosa")), "")
  expect_identical(prosecnurapp:::.calac_tabla_de_cabecera(character(0)), "")
  # Una fila con celdas vacías al final sigue siendo su cabecera: el renderer
  # rellena a lo ancho de la hoja y la cabecera más corta viaja con cola.
  expect_identical(
    prosecnurapp:::.calac_tabla_de_cabecera(c(AULAS_AVANCE_CABECERAS$general, "", "")),
    "general")
})
