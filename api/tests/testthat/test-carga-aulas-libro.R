# Composicion de las tres hojas del operativo sobre un solo libro.
#
# Se construye un .xlsx sintetico en tiempo de test: el libro real trae docentes
# con telefono y correo y no entra al repositorio.

.cal_libro <- function(hojas) {
  path <- withr::local_tempfile(fileext = ".xlsx", .local_envir = parent.frame())
  openxlsx::write.xlsx(hojas, file = path, colNames = FALSE)
  path
}

.cal_agendadas <- function() {
  tit <- c("ID MATCH", "MUESTRA", "CURSO-HORARIO", "NOMBRE DE DOCENTE",
           "TELEFONO DE DOCENTE", "CORREO PUCP DOCENTE", "NOMBRE DEL CURSO",
           "FACULTAD", "NIVEL DEL CURSO", "SESIONES Y AULA",
           "MATRICULADOS TOTAL DTI", "MATRICULADOS POBLACION", "MEDIO DE CONTACTO",
           "FECHA DE LLAMADA", "NUMERO DE INTENTOS", "STATUS MUESTRA",
           "FECHA DE APLICACION", "DIA", "HORA", "ENLACE DE LA FICHA", "OBSERVACIONES")
  fila <- c("1", "Muestra 01", "ABC-01", "Docente", "999", "d@x.test", "Curso",
            "SOCIALES", "3", "LUN A101", "40", "35", "Llamada", "2025-09-02", "1",
            "AGENDADA", "2025-09-10", "Mie", "08:00", "https://x.test/f", "ok")
  as.data.frame(rbind(tit, fila), stringsAsFactors = FALSE)
}

#' El mismo libro con un SEGUNDO bloque, o sea con una reserva encadenada.
#'
#' El rol sale del bloque de columnas —el primero es titular y los siguientes
#' reservas—, asi que con un solo bloque `reservas` vale 0 y cualquier aserto
#' sobre el reparto pasa por casualidad: comprobado, poniendo `reservas <- 0L` a
#' mano el test seguia verde.
.cal_agendadas_con_reserva <- function() {
  base <- .cal_agendadas()
  reserva <- base
  reserva[2, 3] <- "ABC-01-R1"
  cbind(base, reserva, stringsAsFactors = FALSE)
}

test_that("un libro sin ninguna de las tres hojas se rechaza con su codigo", {
  path <- .cal_libro(list(Otra = data.frame(a = 1)))
  err <- tryCatch(aulas_libro_importar(path), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_AULAS_LIBRO_SIN_HOJAS")
})

test_that("el reparto del recibo SUMA el total, o el libro no se puede situar", {
  # La tarjeta de Fuentes enseñaba «236 cursos-horario» y «170 titulares», y el
  # KPI de al lado «196 · titulares y sus reservas encadenadas»: tres cifras para
  # la misma palabra sin forma de encajarlas sin salir de la pantalla. Faltaba el
  # sumando de en medio.
  path <- .cal_libro(stats::setNames(list(.cal_agendadas_con_reserva()), "Aulas Agendadas"))
  out <- aulas_libro_importar(path)

  expect_identical(out$resumen$titulares, 1L)
  expect_identical(out$resumen$reservas, 1L)
  # Lo que hace util el aserto: los tres numeros son DISTINTOS y tienen que
  # cuadrar entre si.
  expect_identical(out$resumen$unidades, 2L)
  expect_identical(out$resumen$titulares + out$resumen$reservas, out$resumen$unidades)
})

test_that("una ruta inexistente se rechaza antes de intentar leerla", {
  err <- tryCatch(aulas_libro_importar(file.path(tempdir(), "no-existe.xlsx")),
                  error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_AULAS_LIBRO_NO_EXISTE")
})

test_that("un libro a mitad de operativo importa lo que hay y DECLARA lo que falta", {
  # Ninguna hoja es obligatoria: un estudio recien agendado no tiene parte de
  # campo todavia. Lo que falta se declara, no se devuelve como cero mudo.
  path <- .cal_libro(stats::setNames(list(.cal_agendadas()), "Aulas Agendadas"))
  out <- aulas_libro_importar(path)

  expect_identical(out$resumen$unidades, 1L)
  expect_identical(out$resumen$titulares, 1L)
  expect_identical(out$resumen$partes_de_campo, 0L)
  # **El reparto tiene que SUMAR el total**, o la tarjeta de Fuentes enseña
  # «236 cursos-horario» y «170 titulares» sin forma de encajarlos: los que
  # faltaban eran las reservas encadenadas y las aulas extra.
  expect_identical(out$resumen$reservas, 0L)
  ausentes <- unlist(out$hojas_ausentes)
  expect_true("Aulas Aplicadas (Campo)" %in% ausentes)
  expect_true("Base de control" %in% ausentes)
})

test_that("el libro importado queda en la sesion sin fusionar las tres medidas", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  path <- .cal_libro(stats::setNames(list(.cal_agendadas()), "Aulas Agendadas"))
  aulas_libro_importar_en_sesion(sid, path)
  s <- session_get(sid)

  expect_length(s$monitoreo_aulas_plan, 1L)
  # Parte de campo y control viven aparte del plan: son medidas distintas del
  # mismo aula y fusionarlas perderia de cual viene cada numero.
  expect_true("monitoreo_aulas_partes_campo" %in% names(s))
  expect_true("monitoreo_aulas_control" %in% names(s))
  expect_identical(s$monitoreo_aulas_libro$resumen$unidades, 1L)
})
