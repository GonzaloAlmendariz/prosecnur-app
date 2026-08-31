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

# ---------------------------------------------------------------------------
# El parte llega en CASTELLANO y la hoja tiene que llenarse igual.
#
# Cuarta vez que la misma regla se lee en una capa que no conocia los alias. La
# cabecera de `.MONITOREO_AULAS_PARTE_ALIAS` ya contaba las tres anteriores:
# «una capa aprendio los alias y las otras dos no se enteraron; por eso son UNA
# constante y no tres listas». El generador del libro era la cuarta: escribia la
# hoja leyendo solo nombres ingleses, y sobre un .pulso real —152 partes, todos
# castellanos— salian las 192 filas vacias y releer el libro devolvia 0 partes.
#
# El test usa el vocabulario CASTELLANO a proposito: con el ingles pasaria
# igual antes y despues del arreglo, que es como se colo las cuatro veces.
# ---------------------------------------------------------------------------

test_that("la hoja de campo se llena con un parte en castellano", {
  unidades <- list(list(operational_code = "CH 1", classroom_id = "aula_1",
                        faculty = "DERECHO", enrolled_total = 40, eligible_n = 30))
  parte_es <- list(operational_code = "CH 1", classroom_id = "aula_1",
                   asistentes = 25, validas = 18, aplicador = "APL-3",
                   fecha = "2026-09-08", rechazos = 4, duplicados = 3)
  hoja <- aulas_libro_hoja_aplicadas(unidades, partes = list(parte_es))
  plano <- as.character(unlist(hoja))
  for (v in c("25", "18", "APL-3", "2026-09-08", "4", "3")) {
    expect_true(v %in% plano, info = paste("falta en la hoja:", v))
  }
})

test_that("el vocabulario ingles sigue funcionando: los alias suman, no sustituyen", {
  unidades <- list(list(operational_code = "CH 1", classroom_id = "aula_1",
                        enrolled_total = 40, eligible_n = 30))
  parte_en <- list(operational_code = "CH 1", classroom_id = "aula_1",
                   observed_students = 25, effective_surveys = 18,
                   applied_by = "APL-3", applied_date = "2026-09-08")
  plano <- as.character(unlist(aulas_libro_hoja_aplicadas(unidades, partes = list(parte_en))))
  for (v in c("25", "18", "APL-3", "2026-09-08")) expect_true(v %in% plano)
})

test_that("cada campo del parte que el libro escribe tiene su entrada en la constante", {
  # El guard de fondo: si alguien añade una columna al bloque de campo y la lee
  # por nombre literal, este aserto no la ve —pero si la lee por alias y se
  # olvida de declararlo, salta aqui en vez de en un libro vacio.
  usados <- c("asistentes", "asistencia_pct", "rechazos", "duplicados",
              "efectivas", "aplicador", "aula", "fecha", "hora", "estado", "nota")
  faltan <- setdiff(usados, names(prosecnurapp:::.MONITOREO_AULAS_PARTE_ALIAS))
  expect_equal(faltan, character(0))
})

# ---------------------------------------------------------------------------
# «Base de control necesita saber lo que las otras dos saben» (Gonzalo).
#
# No lo sabia: de sus 43 columnas salian vacias FECHA AGENDADA y HORA —que
# estan en la unidad del plan, al lado— y las de campo, porque la funcion ni
# recibia los partes. El parte va en CASTELLANO a proposito: es el vocabulario
# que produce la app y el que dejo vacia la otra hoja durante meses.
# ---------------------------------------------------------------------------

test_that("la base de control recoge lo que saben agenda y campo", {
  unidades <- list(list(operational_code = "CH 1", classroom_id = "aula_1",
                        sample_role = "titular", course_name = "MATEMATICAS",
                        enrolled_total = 40, eligible_n = 30,
                        scheduled_date = "2026-09-08", scheduled_time = "17:00"))
  partes <- list(list(operational_code = "CH 1", asistentes = 25,
                      aplicador = "APL-3", fecha = "2026-09-08",
                      hora = "17:15", estado = "APLICADA"))
  hoja <- aulas_libro_hoja_control(unidades, control = list(), partes = partes)
  plano <- as.character(unlist(hoja))
  for (v in c("2026-09-08", "17:00", "APL-3", "17:15", "APLICADA", "25")) {
    expect_true(v %in% plano, info = paste("la base de control no recogio:", v))
  }
})

test_that("sin partes la base de control se escribe igual, solo sin la parte de campo", {
  # El caso del dia 1: hay agenda y todavia no hay campo. La hoja tiene que
  # salir con sus filas y su agenda, no caerse ni quedarse en blanco.
  unidades <- list(list(operational_code = "CH 1", sample_role = "titular",
                        enrolled_total = 40, eligible_n = 30,
                        scheduled_date = "2026-09-08"))
  hoja <- aulas_libro_hoja_control(unidades, control = list())
  plano <- as.character(unlist(hoja))
  expect_true("2026-09-08" %in% plano)
  expect_true("CH 1" %in% plano)
})
