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
