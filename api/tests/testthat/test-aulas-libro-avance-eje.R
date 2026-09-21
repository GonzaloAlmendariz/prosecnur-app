# La primera celda de las cabeceras del avance, cuando el eje no es la facultad.
#
# La vara de este satélite es la INVARIANCIA: con el eje en facultad —o sin eje
# declarado— la constante no se mueve un byte. Todo lo demás de este archivo es
# secundario frente a eso.

.calae_eje <- function(clave) monitoreo_aulas_eje(list(eje_cuota = clave))

test_that("con el eje en facultad la cabecera es IDENTICA a la constante", {
  # Para las CINCO claves, y con `identical()` y no `expect_equal()`: HSVG esta
  # en campo y el round-trip del Sheets compara la fila entera.
  for (clave in names(AULAS_AVANCE_CABECERAS)) {
    expect_identical(aulas_avance_cabeceras_eje(clave, .calae_eje("facultad")),
                     AULAS_AVANCE_CABECERAS[[clave]])
    expect_identical(aulas_avance_cabeceras_eje(clave, NULL),
                     AULAS_AVANCE_CABECERAS[[clave]])
    expect_identical(aulas_avance_cabeceras_eje(clave, list()),
                     AULAS_AVANCE_CABECERAS[[clave]])
  }
})

test_that("con el eje en nivel cambia SOLO la primera celda", {
  for (clave in names(AULAS_AVANCE_CABECERAS)) {
    base <- AULAS_AVANCE_CABECERAS[[clave]]
    out <- aulas_avance_cabeceras_eje(clave, .calae_eje("nivel"))
    expect_identical(length(out), length(base))
    # La cola, byte a byte: veintitantas columnas que no tienen nada que ver
    # con el eje y que el reverso del Sheets usa para reconocer la tabla.
    expect_identical(out[-1], base[-1])
  }
})

test_that("una tabla cuya primera columna NO es el eje no se toca", {
  # «Avance general» empieza por «Indicadores»: sustituirla pondria el nombre
  # del eje sobre una columna de conceptos. Se comprueba, no se supone.
  expect_identical(AULAS_AVANCE_CABECERAS$general[[1]], "Indicadores")
  expect_identical(aulas_avance_cabeceras_eje("general", .calae_eje("nivel")),
                   AULAS_AVANCE_CABECERAS$general)
})

test_that("las que empiezan por «Facultad» la cambian SI sus filas son del eje", {
  por_facultad <- Filter(function(k) identical(AULAS_AVANCE_CABECERAS[[k]][[1]], "Facultad"),
                         names(AULAS_AVANCE_CABECERAS))
  # Medido: son cuatro —facultad, rendimiento, aplicador y diario—.
  expect_gte(length(por_facultad), 4L)
  # **Pero no las cuatro reparten por el eje.** El 2026-09-21, en el libro de
  # CCSS Perfil 2026-II, «Rendimiento por facultad» salia con cabecera «Nivel» y
  # una sola fila, «CIENCIAS SOCIALES»: esa tabla agrupa AULAS y su fila sale de
  # `u$faculty`, no de las celdas de cuota. Con `atribucion = "persona"` el nivel
  # de un aula es el MODAL de sus alumnos, asi que rotularla «Nivel» es la misma
  # mentira que este satelite vino a quitar. Sustituye solo `facultad`.
  eje_persona <- .calae_eje("nivel")
  expect_identical(aulas_avance_cabeceras_eje("facultad", eje_persona)[[1]], "Nivel")
  for (clave in setdiff(por_facultad, "facultad")) {
    expect_identical(aulas_avance_cabeceras_eje(clave, eje_persona)[[1]], "Facultad",
                     info = paste("tabla", clave, "agrupa aulas"))
  }
})

test_that("una clave que no existe devuelve vacio, no revienta", {
  expect_identical(aulas_avance_cabeceras_eje("no_existe", .calae_eje("nivel")),
                   character(0))
})

test_that("el reverso del Sheets reconoce las DOS grafias de cada tabla", {
  # Sin esto, un documento escrito con el eje en nivel pierde color y ancho al
  # republicarse **sin fallar**: el reverso no reconoce sus tablas y las deja
  # sin formato. Es el fallo mudo que este satelite existe para evitar.
  for (clave in names(AULAS_AVANCE_CABECERAS)) {
    expect_identical(.calac_tabla_de_cabecera(AULAS_AVANCE_CABECERAS[[clave]]), clave)
    expect_identical(
      .calac_tabla_de_cabecera(aulas_avance_cabeceras_eje(clave, .calae_eje("nivel"))),
      clave)
  }
  # Y una fila que no es cabecera de ninguna sigue devolviendo "".
  expect_identical(.calac_tabla_de_cabecera(c("Nivel", "cualquier cosa")), "")
})

test_that("la fila de cabecera EMITIDA lleva la palabra del eje", {
  tabla <- data.frame(Facultad = "6", Efectivas = 10, stringsAsFactors = FALSE)
  names(tabla) <- c("Facultad", "Efectivas")
  sin_eje <- .cala_tabla_filas(tabla, "facultad")
  expect_identical(as.character(sin_eje[[1]][[1]]), "Facultad")
  # Con el eje en nivel la cabecera cambia... pero SOLO si la cola calza con la
  # constante: una tabla a medias no se retoca.
  con_eje <- .cala_tabla_filas(tabla, "facultad", eje = .calae_eje("nivel"))
  expect_identical(as.character(con_eje[[1]][[1]]), "Facultad")
})

test_that("y con la cabecera completa si la sustituye", {
  base <- AULAS_AVANCE_CABECERAS$facultad
  tabla <- as.data.frame(
    setNames(lapply(base, function(k) if (identical(k, base[[1]])) "6" else 1), base),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  filas <- .cala_tabla_filas(tabla, "facultad", eje = .calae_eje("nivel"))
  expect_identical(as.character(filas[[1]][[1]]), "Nivel")
  # Y la cola de la cabecera emitida sigue siendo la de la constante.
  expect_identical(as.character(unlist(filas[[1]]))[-1], as.character(base)[-1])
})
