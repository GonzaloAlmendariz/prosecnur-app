# Un rescate que solo mira NULL no rescata una clave vacia.
#
# La config del perfil de aulas declara sus claves aunque no tengan nada dentro,
# asi que `cfg$libro %||% s$monitoreo_aulas_libro` se queda SIEMPRE con la lista
# vacia de la config y nunca mira la sesion: `%||%` sustituye NULL y solo NULL.
#
# Medido el 2026-08-23 sobre un proyecto con el libro YA importado —tres partes
# de campo transcritos y releidos—: la sesion tenia el recibo con sus cinco
# campos, `cfg$libro` valia `list()`, y Fuentes enseñaba «Libro del operativo ·
# Sin importar». El rescate estaba escrito, con su comentario explicando por que
# hacia falta, y no hacia nada.
#
# Un guard que no guarda es peor que no tenerlo: la superficie parece cubierta.

test_that("elige el primer valor CON CONTENIDO, no el primero que no sea NULL", {
  f <- prosecnurapp:::.monitoreo_con_contenido
  # El caso que fallaba: presente pero vacio.
  expect_length(f(list(), list(a = 1), .default = list()), 1L)
  expect_length(f(NULL, list(a = 1, b = 2), .default = list()), 2L)
  # Y lo que ya funcionaba sigue igual.
  expect_identical(f(list(a = 9), list(a = 1)), list(a = 9))
  expect_length(f(list(), NULL, .default = list()), 0L)
  expect_null(f(list(), NULL))
})

test_that("con el recibo solo en la sesion, la cadena del tablero lo publica", {
  # Es la forma exacta que tiene un proyecto reabierto: la config declara la
  # clave vacia y el dato vive en la sesion.
  cfg <- list(plan = list(), libro = list())
  recibo <- list(
    importado_en = "2026-08-23T16:54:43Z",
    hojas_ausentes = list(), control_sin_nombre = list(),
    resumen = list(unidades = 700L, partes_de_campo = 3L)
  )

  # La cadena real del tablero para esta clave: rescate -> normalizador ->
  # recibo. Se prueba asi y no llamando a `monitoreo_aulas_dashboard` porque ese
  # agrega por estrato y un plan de juguete le rompe el `aggregate`: seria el
  # fixture fallando, no el rescate.
  cfg$libro <- prosecnurapp:::.monitoreo_con_contenido(cfg$libro, recibo)
  normalizada <- monitoreo_aulas_normalize_config(cfg)
  publicado <- monitoreo_aulas_libro_recibo(normalizada$libro, list())
  expect_false(is.null(publicado))
  expect_identical(publicado$importado_en, "2026-08-23T16:54:43Z")
  expect_length(publicado$hojas, 3L)

  # Y el control que documenta POR QUE no vale `%||%`: con ese operador la clave
  # vacia gana, el normalizador recibe una lista vacia y el recibo sale NULL, que
  # es lo que la pantalla leia como «Sin importar».
  con_operador <- list(libro = list())
  con_operador$libro <- con_operador$libro %||% recibo
  expect_length(con_operador$libro, 0L)
  expect_null(monitoreo_aulas_libro_recibo(
    monitoreo_aulas_normalize_config(con_operador)$libro, list()
  ))
})

# --- Y el rescate se prueba DONDE VIVE, que es el router -------------------
#
# El primer test de este archivo cubria el helper y la cadena del motor, y con
# eso el mutante sobrevivia: devolver `%||%` a `.monitoreo_state_payload` no
# rompia ni un test. Cubrir la pieza no es cubrir a quien la usa.

test_that("el router NO rescata estas claves con `%||%`", {
  # **Este es un guardian de fuente, y conviene decir por que.**
  #
  # Lo suyo seria llamar a `.monitoreo_state_payload` con una sesion armada y
  # mirar el payload. Se intento: el tablero agrega por estrato y por facultad,
  # y `monitoreo_aulas_normalize_plan` devuelve vacio con cualquier plan que no
  # venga entero del motor —86 columnas—, asi que el fixture fallaba por su
  # forma y no por el rescate. Montar ese plan a mano seria copiar el productor
  # dentro del test, que es como un fixture deja de probar nada.
  #
  # Asi que se vigila lo unico que la regresion necesita: que estas tres claves
  # no vuelvan al operador que no rescata. Cubre el mutante —devolver `%||%`
  # deja este test en rojo— y no cubre que el payload salga bien, que es lo que
  # se verifico a mano sobre el proyecto real.
  fuente <- readLines("../../R/router_monitoreo.R", warn = FALSE)
  bloque <- fuente[grepl("aulas_cfg\\$(control|libro|partes_campo) <-", fuente)]
  expect_gte(length(bloque), 3L)
  con_operador <- bloque[grepl("%||%", bloque, fixed = TRUE)]
  expect_equal(con_operador, character(0))
  expect_true(all(grepl(".monitoreo_con_contenido", bloque, fixed = TRUE)))
})


# --- Un parte de ceros y un parte de un aula cancelada no son lo mismo -----
#
# `application_status` viene de «STATUS DE APLICACION» del libro —«Aplicada»,
# «No aplicada»— y es lo que explica una fila de ceros. El lector lo leia, la
# tabla de Consultas lo pedia por nombre en sus `preferredColumns`… y el
# publicador no lo emitia.
#
# Visto en pantalla el 2026-08-23: el parte de un aula que el docente cancelo
# salia como «0 asistentes · 0 % · 0 efectivas» junto a dos aplicadas, sin nada
# que distinguiera «no se aplico» de «se aplico y no vino nadie». Son dos hechos
# muy distintos para quien decide si reagendar.

test_that("el parte publicado lleva el estado de aplicacion", {
  pub <- monitoreo_aulas_partes_publicados(list(
    list(operational_code = "CH 1", observed_students = 28, effective_surveys = 25,
         refusals = 2, duplicates = 1, application_status = "Aplicada"),
    list(operational_code = "CH 3", observed_students = 0, effective_surveys = 0,
         refusals = 0, duplicates = 0, application_status = "No aplicada",
         field_note = "Docente cancelo la clase")
  ))
  expect_length(pub, 2L)
  expect_identical(pub[[1]]$application_status, "Aplicada")
  expect_identical(pub[[2]]$application_status, "No aplicada")
})

test_that("sin estado declarado se publica vacio, no se inventa uno", {
  # Un parte sin «STATUS DE APLICACION» no dice que se aplicara: dice que no se
  # anoto. Rellenarlo con «Aplicada» seria afirmar lo que nadie afirmo.
  pub <- monitoreo_aulas_partes_publicados(list(
    list(operational_code = "CH 9", observed_students = 10, effective_surveys = 9)
  ))
  expect_identical(pub[[1]]$application_status, "")
})
