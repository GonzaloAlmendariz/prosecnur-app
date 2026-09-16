# Los dos caminos que escriben el libro tienen los MISMOS guards.
#
# El libro de aulas se escribe por dos sitios: `aulas_libro_generar()` produce
# el `.xlsx` que el equipo descarga, y `monitoreo_aulas_publicar_libro()`
# escribe el Google Sheets del operativo. Mismo contenido, dos escritores.
#
# El 2026-09-12 tenían dos contratos, y el permisivo era el que escribe EN VIVO:
# el generador se negaba a escribir un libro cuyas reservas no supieran de qué
# cadena son y el publicador no lo comprobaba. Publicar con un plan
# reconstruido leyendo el propio Sheets —donde las reservas vuelven sin su
# titular— dejó «Avance de agendación» con la columna «Aulas del diseño»
# sumando 1.372 donde iban 170, durante siete horas. No falló, no avisó.
#
# Este guard no comprueba la conducta —eso lo hacen los tests de cada camino—
# sino la SIMETRÍA: que ningún guard del libro viva en un solo lado. Es lo que
# habría hecho ruido el día en que se añadió el primero sin el segundo.

.taldc_codigos <- function(archivo) {
  ruta <- testthat::test_path("..", "..", "R", archivo)
  if (!file.exists(ruta)) return(NA_character_)
  lineas <- sub("#.*$", "", readLines(ruta, warn = FALSE))
  todo <- paste(lineas, collapse = "\n")
  sort(unique(regmatches(todo, gregexpr("E_AULAS_LIBRO_[A-Z_]+", todo))[[1]]))
}

test_that("todo guard del libro vive en los DOS caminos", {
  generar <- .taldc_codigos("carga_aulas_libro_generar.R")
  publicar <- .taldc_codigos("monitoreo_aulas_publicar_libro.R")

  # **Primero, que el barrido haya mirado algo.** Un contrato que compara dos
  # listas vacías sale verde sin haber comprobado nada: la clase 9 del
  # catálogo, la que apaga la infraestructura sin dejar rastro.
  expect_false(any(is.na(c(generar, publicar))))
  expect_gt(length(generar), 0L)

  solo_en_generar <- setdiff(generar, publicar)
  expect_identical(
    solo_en_generar, character(0),
    info = paste("Guards que sólo protegen el .xlsx y no el Sheets del",
                 "operativo, que es el que escribe en vivo:",
                 paste(solo_en_generar, collapse = ", ")))
})

test_that("los dos guards conocidos siguen ahí, por nombre", {
  # Si mañana alguien renombra un código, el test de arriba seguiría verde con
  # los dos lados renombrados a la vez. Esto ancla los dos que existen y por
  # qué: uno impide escribir sin plan y el otro, con la cadena rota.
  generar <- .taldc_codigos("carga_aulas_libro_generar.R")
  for (codigo in c("E_AULAS_LIBRO_SIN_PLAN", "E_AULAS_LIBRO_SIN_CADENAS")) {
    expect_true(codigo %in% generar, info = codigo)
    expect_true(codigo %in% .taldc_codigos("monitoreo_aulas_publicar_libro.R"),
                info = codigo)
  }
})

# --- La anotación de la cabeza de cadena, en los DOS caminos -----------------
#
# El 2026-09-16 el guard de cadenas paró la publicación del operativo por EXTRA
# 36, el primer refuerzo con parte. El arreglo se puso primero en el
# normalizador del plan y NO sirvió: el publicador toma el plan CRUDO de la
# sesión (`s$monitoreo_aulas_plan`) y nunca pasa por él. Justo el camino que
# escribe en vivo se quedó sin arreglar, que es la misma asimetría que este
# archivo existe para vigilar.

.taldc_anotaciones <- function(archivo) {
  ruta <- testthat::test_path("..", "..", "R", archivo)
  if (!file.exists(ruta)) return(NA_character_)
  lineas <- sub("#.*$", "", readLines(ruta, warn = FALSE))
  todo <- paste(lineas, collapse = "\n")
  sort(unique(regmatches(todo, gregexpr("aulas_libro_anotar_[a-z_]+", todo))[[1]]))
}

test_that("toda anotación del plan se aplica en los DOS caminos", {
  generar <- .taldc_anotaciones("carga_aulas_libro_generar.R")
  publicar <- .taldc_anotaciones("monitoreo_aulas_publicar_libro.R")
  # Centinela: si el barrido deja de encontrar nada, la comparación de dos
  # listas vacías saldría verde sin haber leído una línea.
  expect_false(any(is.na(c(generar, publicar))))
  expect_true("aulas_libro_anotar_cabeza_de_extras" %in% generar)
  expect_true("aulas_libro_anotar_cabeza_de_extras" %in% publicar)
})

test_that("una extra con parte ya no tumba NINGUNO de los dos caminos", {
  unidades <- list(
    list(operational_code = "CH 1", titular_operational_code = "CH 1",
         classroom_id = "a-1", sample_role = "titular", faculty = "ARTE",
         course_name = "C1", eligible_n = 30, enrolled_total = 34),
    # Sin cabeza de cadena, como la deja el sorteo.
    list(operational_code = "EXTRA 36", classroom_id = "x-36",
         sample_role = "extra_reserve_pool", faculty = "ARTE",
         course_name = "CX", eligible_n = 20, enrolled_total = 23)
  )
  partes <- list(list(operational_code = "EXTRA 36", observed_students = 18,
                      effective_surveys = 14))
  anotado <- aulas_libro_anotar_cabeza_de_extras(unidades)
  expect_identical(
    trimws(as.character(anotado[[2]]$titular_operational_code)), "EXTRA 36")
  expect_identical(
    length(prosecnurapp:::.calg_reservas_sin_cadena(anotado, partes = partes)), 0L)
  # Y sin anotar sigue siendo el caso roto que el guard debe cazar: lo que
  # cambió es la fila, no el guard.
  expect_identical(
    length(prosecnurapp:::.calg_reservas_sin_cadena(unidades, partes = partes)), 1L)
})
