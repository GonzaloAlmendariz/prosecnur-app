# La segunda puerta del libro: la pestaña de Google Sheets que el equipo llena
# en linea mientras el operativo corre.

test_that("una pestaña de Sheets produce las mismas filas que el .xlsx", {
  unidades <- list(
    list(operational_code = "CH 1", sample_role = "titular", titular_operational_code = "CH 1",
         teacher = "Docente Uno", course_name = "Curso Uno", faculty = "SOCIALES"),
    list(operational_code = "R 1.1", sample_role = "chain_reserve", titular_operational_code = "CH 1",
         replacement_order = 1, teacher = "Docente Dos", course_name = "Curso Dos", faculty = "SOCIALES")
  )
  hoja <- aulas_libro_hoja_agendadas(unidades)
  # Las mismas celdas, pero en la forma que devuelve la API: lista de filas.
  values <- lapply(seq_len(nrow(hoja)), function(i) as.list(as.character(hoja[i, ])))

  plan <- aulas_libro_desde_valores(values, "agendadas")
  codigos <- vapply(plan, function(u) as.character(u$operational_code %||% ""), character(1))
  expect_true(all(c("CH 1", "R 1.1") %in% codigos))
})

test_that("las filas dentadas de Sheets no corren las columnas", {
  # La API RECORTA las celdas vacias del final de cada fila. Este es el caso
  # real: la cabecera trae 20 columnas y la fila de datos llega con 3 porque el
  # equipo solo lleno el principio. Sin relleno, `as.data.frame` sobre filas de
  # distinto largo o bien falla o bien recicla, y el lector empieza a leer un
  # campo donde hay otro.
  titulos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$titulos[[1]], character(1))
  cabecera <- as.list(c("ID MATCH", titulos))
  # Orden v4: tras CURSO-HORARIO viene NOMBRE DEL CURSO y recien el docente.
  fila <- list("1", "CH 7", "Curso Siete", "Docente Siete")

  plan <- aulas_libro_desde_valores(list(cabecera, fila), "agendadas")
  expect_length(plan, 1L)
  expect_identical(as.character(plan[[1]]$operational_code), "CH 7")
  expect_identical(as.character(plan[[1]]$teacher), "Docente Siete")
  # Y lo que no se lleno queda VACIO, no corrido desde otra columna.
  expect_identical(as.character(plan[[1]]$sample_status %||% ""), "")
})

test_that("una pestaña con solo cabecera no es un error", {
  # Es el libro recien sembrado: existe y todavia no lo llena nadie.
  titulos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$titulos[[1]], character(1))
  expect_identical(aulas_libro_desde_valores(list(as.list(c("ID MATCH", titulos))), "agendadas"), list())
  expect_identical(aulas_libro_desde_valores(list(), "agendadas"), list())
})

test_that("el rol de la fuente decide que hoja es", {
  expect_identical(aulas_libro_hoja_por_rol("agendamiento"), "agendadas")
  expect_identical(aulas_libro_hoja_por_rol("parte_campo"), "aplicadas")
  expect_identical(aulas_libro_hoja_por_rol("control"), "control")
  # Los tres roles del libro son los que declara `monitoreo_sync_fuentes.R`: si
  # alli se añade uno y aqui no, este aserto lo dice.
  expect_setequal(names(AULAS_LIBRO_HOJA_POR_ROL), MONITOREO_AULAS_LIBRO_ROLES)
})

test_that("un rol que no es del libro no se adivina", {
  # Devolver «agendadas» por defecto leeria una tabla de respuestas como si
  # fuera la agenda, y saldrian filas de plan inventadas.
  expect_identical(aulas_libro_hoja_por_rol("respuestas"), "")
  expect_identical(aulas_libro_hoja_por_rol(""), "")
  expect_identical(aulas_libro_desde_fuente(list(list("a"), list("b")), "respuestas"), list())
})

# ---------------------------------------------------------------------------
# `aulas_libro_importar_valores()`: el remate que faltaba.
#
# Los tests de arriba cubren la CONVERSION de una pestaña. Lo que no existia
# era la puerta completa: este modulo sabia convertir desde que se escribio y
# `aulas_libro_desde_valores` no tenia un solo consumidor en el repo. Faltaba
# el ensamblado —el recuento del resumen vivia dentro del lector de Excel—, y
# se extrajo a `.calb_ensamblar()` para que las dos puertas lo compartan.
# ---------------------------------------------------------------------------

.filas_api <- function(...) lapply(list(...), function(f) as.list(as.character(f)))

test_that("la puerta de Sheets arma el mismo resultado que la del xlsx", {
  out <- aulas_libro_importar_valores(list(agendadas = .filas_api(
    c("ID MATCH", "MUESTRA", "CURSO-HORARIO", "NOMBRE DE DOCENTE", "STATUS MUESTRA"),
    c("1", "Muestra 01", "CH 1", "PEREZ, ANA", "AGENDADA"),
    c("2", "Muestra 01", "CH 2", "SOTO, LUIS")
  )))
  expect_equal(out$resumen$unidades, 2L)
  expect_equal(vapply(out$plan, function(u) u$operational_code, character(1)), c("CH 1", "CH 2"))
  expect_equal(out$plan[[1]]$sample_status, "AGENDADA")
})

test_that("una hoja que no viene se declara ausente y no rompe", {
  # Leer solo la agenda es NORMAL: el jefe de campo llena la suya en otro
  # momento. Se declara la ausencia, no se falla.
  out <- aulas_libro_importar_valores(list(agendadas = .filas_api(
    c("ID MATCH", "CURSO-HORARIO"), c("1", "CH 1")
  )))
  expect_true(length(out$hojas_ausentes) >= 2)
  expect_equal(out$resumen$partes_de_campo, 0L)
  expect_equal(out$resumen$filas_de_control, 0L)
})

test_that("sin ninguna pestaña con filas se falla con su codigo", {
  expect_error(aulas_libro_importar_valores(list()), class = "api_error")
  expect_error(aulas_libro_importar_valores(list(agendadas = list())), class = "api_error")
})

test_that("las dos puertas devuelven la MISMA forma", {
  # Es lo que permite que `aulas_libro_importar_en_sesion()` no tenga que saber
  # por donde entro el libro. Si una gana un campo y la otra no, la sesion queda
  # a medias segun la procedencia, que es el defecto mas dificil de ver.
  out <- aulas_libro_importar_valores(list(agendadas = .filas_api(
    c("ID MATCH", "CURSO-HORARIO"), c("1", "CH 1")
  )))
  expect_equal(sort(names(out$resumen)),
               sort(c("unidades", "titulares", "reservas", "contactadas",
                      "partes_de_campo", "filas_de_control")))
  expect_equal(sort(names(out)),
               sort(c("plan", "partes", "control", "hojas_ausentes",
                      "control_sin_nombre", "agenda_campos_ausentes", "resumen")))
})

# ---------------------------------------------------------------------------
# La lectura de las tres pestañas. SIN RED: se sustituye `.monitoreo_google_api`.
# ---------------------------------------------------------------------------

test_that("lee las tres pestañas por su nombre canonico", {
  pedidas <- character(0)
  testthat::local_mocked_bindings(
    .monitoreo_google_api = function(url, ...) {
      pedidas <<- c(pedidas, utils::URLdecode(sub(".*/values/", "", url)))
      list(values = list(as.list(c("ID MATCH", "CURSO-HORARIO")), as.list(c("1", "CH 1"))))
    },
    .package = "prosecnurapp"
  )
  out <- aulas_libro_leer_de_sheets("abc123")
  # B14 (2026-09-01): el juego de claves crece A CONCIENCIA con las dos hojas
  # Extra — si el sync no las lee, lo que el equipo teclee ahi muere camino a
  # la app (el xlsx si hace el ciclo completo). Un libro sin extras las omite
  # por la regla de la pestaña inexistente, asi que los libros viejos siguen.
  expect_equal(sort(names(out)),
               sort(c("agendadas", "aplicadas", "control",
                      "agendadas_extra", "aplicadas_extra")))
  # Los nombres por defecto son los del libro que genera la app: es el caso
  # normal —el equipo sube ese archivo a Drive y trabaja sobre el—.
  expect_true(any(grepl("Aulas Agendadas", pedidas, fixed = TRUE)))
  expect_true(any(grepl("Base de control", pedidas, fixed = TRUE)))
  expect_true(any(grepl("Aulas Agendadas (Extra)", pedidas, fixed = TRUE)))
  expect_true(any(grepl("Aulas Aplicadas (Extra)", pedidas, fixed = TRUE)))
})

test_that("una pestaña que no existe se omite en vez de fallar", {
  # El operativo empieza con la agenda y la hoja de campo aparece dias despues.
  # Fallar por eso obligaria al equipo a crear pestañas vacias para sincronizar.
  testthat::local_mocked_bindings(
    .monitoreo_google_api = function(url, ...) {
      if (grepl("Campo", utils::URLdecode(url), fixed = TRUE)) stop("404")
      list(values = list(as.list(c("ID MATCH", "CURSO-HORARIO")), as.list(c("1", "CH 1"))))
    },
    .package = "prosecnurapp"
  )
  out <- aulas_libro_leer_de_sheets("abc123")
  expect_false("aplicadas" %in% names(out))
  expect_true("agendadas" %in% names(out))
})

test_that("sin id no se llama a la API siquiera", {
  llamadas <- 0L
  testthat::local_mocked_bindings(
    .monitoreo_google_api = function(url, ...) { llamadas <<- llamadas + 1L; list() },
    .package = "prosecnurapp"
  )
  expect_error(aulas_libro_leer_de_sheets(""), class = "api_error")
  expect_equal(llamadas, 0L)
})

test_that("un nombre de pestaña con comilla no rompe el rango", {
  # `'Aulas 'X''` es sintaxis valida de A1 solo si la comilla va duplicada.
  visto <- ""
  testthat::local_mocked_bindings(
    .monitoreo_google_api = function(url, ...) {
      visto <<- utils::URLdecode(sub(".*/values/", "", url))
      list(values = list(as.list("ID MATCH"), as.list("1")))
    },
    .package = "prosecnurapp"
  )
  aulas_libro_leer_de_sheets("abc", list(agendadas = "Aulas 'X'", aplicadas = "", control = ""))
  expect_equal(visto, "'Aulas ''X'''")
})
