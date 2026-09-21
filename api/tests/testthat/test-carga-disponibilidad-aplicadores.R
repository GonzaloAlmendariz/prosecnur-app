# B29 — la disponibilidad de los aplicadores, leída del excel codificado
# (docs/qa/checklist-operativo-aulas-2026-08-31.md).
#
# Dictado de Gonzalo (2026-09-02, textual): «super importante: ahora tenemos la
# disponibilidad de los aplicadores (disponibilidad_codificado.xlsx) y sería
# bueno poder ir mapeando una distribución equitativa en base a lo agendado que
# se tiene hasta ahora, pero que pueda ir actualizándose con el paso de los
# días».
#
# La base real, medida por el lead (hoja «Disponibilidad»): fila 1 = día
# («Lunes»…«Sábado», repetido por columna), fila 2 = franja de 1 hora con
# rótulos AM/PM («8:00-9:00am», «11:00am-12:00pm», «12:00-1:00pm» — el cruce
# del mediodía SIN am en la primera parte), filas 3+ = «Nombres» del aplicador
# + celdas 1/0. Real: 31 aplicadores × 6 días × ~14 franjas (8am–~10pm), sin
# NA. El fixture de abajo calca esa FORMA con datos 100% SINTÉTICOS: los
# nombres de la base real son PII y JAMÁS entran al repo.
#
# Contrato congelado (diseño del lead, 2026-09-02) —
# `carga_disponibilidad_aplicadores(path)`, archivo propio
# `api/R/carga_disponibilidad_aplicadores.R`:
#
# - Devuelve una LISTA de aplicadores `{nombre, dias}`; `dias` es lista
#   nombrada día → bloques `{inicio, fin}` en HH:MM de 24 horas con cero a la
#   izquierda, semántica [inicio, fin). Las franjas CONTIGUAS con 1 se
#   FUSIONAN en un bloque (disponible 8-9, 9-10 y 10-11 = un solo
#   [08:00, 11:00)); los bloques salen en orden ascendente.
# - La clave del día se pinea en UNA forma: minúscula y SIN tilde («lunes»,
#   «miercoles», «sabado»). Elegida porque no depende de cómo venga tecleado
#   el rótulo («Sábado»/«Sabado») ni del locale del proceso, y porque el motor
#   de reparto deriva el día desde la fecha ISO sin locale (patrón
#   `.mav_DIAS`).
# - Tolerancias: celda vacía o basura vale 0 con AVISO en `attr(, "avisos")`
#   (patrón carga_daa_iagen: se lee lo legible, se avisa lo que no); fila con
#   nombre vacío se SALTA —y si traía marcas, se DECLARA en un aviso con su
#   número de fila: alguien llenó una semana y olvidó el nombre—; espacios
#   dobles en el nombre se colapsan a uno y la puntuación se pega al texto
#   («ADINS  , SEBASTIEN» → «ADINS, SEBASTIEN»).
# - DOS FILAS CON EL MISMO NOMBRE SON LA MISMA PERSONA y sus horas se SUMAN,
#   con aviso que nombra las dos filas. La clave del calce normaliza
#   mayúsculas, tildes y puntuación (`.cm_criterios_fac_key`), así que «JOSÉ
#   PÉREZ» y «jose perez» son uno. Antes el reparto se quedaba con la primera
#   fila y perdía las horas de la segunda en silencio.
# - Errores registrables (stop_api, códigos que el writer registra en
#   errors_registry.R): archivo inexistente →
#   E_DISPONIBILIDAD_APLICADORES_NO_EXISTE (400); hoja sin la estructura
#   día×franja → E_DISPONIBILIDAD_APLICADORES_SIN_ESTRUCTURA (422).
#
# Latitudes DECLARADAS al writer (no pineadas aquí): la redacción exacta de
# cada aviso (solo se exige que la causa sea perseguible: el nombre del
# aplicador afectado aparece en algún aviso); si un día sin ningún 1 sale como
# clave ausente o como lista vacía (el test acepta ambas formas); y cómo ubica
# la columna de nombres (el fixture pone el rótulo «Nombres» en fila 2,
# columna 1, calcando la base medida — si la real lo trae en otra celda, se
# ajusta el LECTOR, no este pin).

# --- fixture: un xlsx sintético con la forma de la base medida ----------------

# La matriz día×franja del fixture: Lunes (4 franjas de 8am a 12pm), Viernes
# (12pm-2pm y 9-10pm: el cruce del mediodía y la noche) y Sábado (2 de la
# mañana). Cada fila de `filas` es list(nombre, celdas) con 9 celdas.
.cda_xlsx <- function(filas) {
  path <- withr::local_tempfile(fileext = ".xlsx", .local_envir = parent.frame())
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Disponibilidad")
  fila_dias <- c("", rep("Lunes", 4L), rep("Viernes", 3L), rep("Sábado", 2L))
  fila_franjas <- c(
    "Nombres",
    "8:00-9:00am", "9:00-10:00am", "10:00-11:00am", "11:00am-12:00pm",
    "12:00-1:00pm", "1:00-2:00pm", "9:00-10:00pm",
    "8:00-9:00am", "9:00-10:00am"
  )
  cuerpo <- do.call(rbind, lapply(filas, function(f) {
    c(as.character(f$nombre), as.character(f$celdas))
  }))
  m <- rbind(fila_dias, fila_franjas, cuerpo)
  openxlsx::writeData(wb, "Disponibilidad",
                      as.data.frame(m, stringsAsFactors = FALSE),
                      colNames = FALSE)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

# Las filas limpias: puros 1/0, como la base real (sin NA).
.cda_limpio <- function() list(
  list(nombre = "Ana Prueba",
       celdas = c(1, 1, 1, 0, 1, 0, 1, 0, 0)),
  list(nombre = "Berta  Ficticia", # doble espacio a propósito: se colapsa
       celdas = c(0, 1, 1, 1, 1, 1, 0, 1, 0))
)

# Las filas sucias: una celda con basura y una vacía (valen 0 con aviso) y una
# fila con nombre vacío (se salta).
.cda_sucio <- function() c(.cda_limpio(), list(
  # **La «x» dejo de ser basura el 2026-09-21**: la plantilla que la app entrega
  # se marca con equis, asi que vale 1. El ejemplo de ilegible pasa a ser algo
  # que de verdad no se entiende.
  list(nombre = "Caso Sucio",
       celdas = c(1, "tal vez", "", 1, 0, 0, 0, 0, 0)),
  list(nombre = "",
       celdas = c(1, 1, 1, 1, 1, 1, 1, 1, 1))
))

# --- helpers de lectura del contrato ------------------------------------------

.cda_aplicador <- function(res, nombre) {
  for (a in res) {
    if (is.list(a) && identical(a[["nombre"]], nombre)) return(a)
  }
  NULL
}

.cda_nombres <- function(res) {
  vapply(res, function(a) as.character(a[["nombre"]] %||% ""), character(1))
}

# Los bloques de un día como "HH:MM-HH:MM"; lista vacía si el día no está o no
# tiene bloques (las dos formas valen — latitud declarada).
.cda_rangos <- function(res, nombre, dia) {
  a <- .cda_aplicador(res, nombre)
  if (is.null(a)) return(character(0))
  bloques <- a[["dias"]][[dia]]
  if (is.null(bloques) || !length(bloques)) return(character(0))
  vapply(bloques, function(b) {
    sprintf("%s-%s", b[["inicio"]], b[["fin"]])
  }, character(1))
}

test_that("B29: cada fila con nombre es un aplicador; el nombre vacío se salta y el doble espacio se colapsa", {
  res <- carga_disponibilidad_aplicadores(.cda_xlsx(.cda_sucio()))
  expect_true(is.list(res))
  nombres <- .cda_nombres(res)
  # Tres aplicadores: la fila de nombre vacío NO fabrica un fantasma con nueve
  # unos, y «Berta  Ficticia» aterriza con UN espacio.
  expect_setequal(nombres, c("Ana Prueba", "Berta Ficticia", "Caso Sucio"))
  expect_false(any(grepl("  ", nombres, fixed = TRUE)))
})

test_that("B29: los rótulos AM/PM de la fila 2 se vuelven bloques de 24 horas", {
  res <- carga_disponibilidad_aplicadores(.cda_xlsx(.cda_limpio()))
  # «12:00-1:00pm» es la trampa del mediodía: la primera parte viene SIN
  # sufijo y un «sin sufijo = am» ingenuo la mandaría a la medianoche
  # ([00:00, 13:00)). El bloque correcto es [12:00, 13:00).
  # «9:00-10:00pm» es la noche: [21:00, 22:00), no las 9 de la mañana.
  expect_identical(.cda_rangos(res, "Ana Prueba", "viernes"),
                   c("12:00-13:00", "21:00-22:00"))
  # «11:00am-12:00pm» cruza el meridiano con ambos sufijos: cierra el bloque
  # de Berta en 12:00 del mediodía, no en 00:00.
  expect_identical(.cda_rangos(res, "Berta Ficticia", "lunes"), "09:00-12:00")
  expect_identical(.cda_rangos(res, "Berta Ficticia", "sabado"), "08:00-09:00")
})

test_that("B29: franjas contiguas con 1 se fusionan en un bloque; las separadas no", {
  res <- carga_disponibilidad_aplicadores(.cda_xlsx(.cda_limpio()))
  # Ana el lunes: 8-9, 9-10 y 10-11 con 1 y 11-12 con 0 → UN bloque
  # [08:00, 11:00), no tres de una hora.
  expect_identical(.cda_rangos(res, "Ana Prueba", "lunes"), "08:00-11:00")
  # Berta el viernes: 12-1pm y 1-2pm contiguas → [12:00, 14:00).
  expect_identical(.cda_rangos(res, "Berta Ficticia", "viernes"), "12:00-14:00")
  # Y lo NO contiguo no se pega: el viernes de Ana (12-1pm y 9-10pm) ya salió
  # como DOS bloques en el test anterior. Un día sin ningún 1 no inventa
  # bloques: el sábado de Ana queda vacío (ausente o lista vacía, ambas valen).
  expect_length(.cda_rangos(res, "Ana Prueba", "sabado"), 0L)
})

test_that("B29: la clave del día se pinea minúscula y sin tilde — «Sábado» tecleado entra como «sabado»", {
  res <- carga_disponibilidad_aplicadores(.cda_xlsx(.cda_limpio()))
  a <- .cda_aplicador(res, "Berta Ficticia")
  expect_true(is.list(a))
  claves <- names(a[["dias"]] %||% list())
  catalogo <- c("lunes", "martes", "miercoles", "jueves", "viernes",
                "sabado", "domingo")
  expect_true(all(claves %in% catalogo),
              info = paste("claves:", paste(claves, collapse = ", ")))
  # Los días CON bloques de Berta son exactamente los tres del fixture, en la
  # forma pineada: el rótulo trae «Sábado» con tilde y la clave sale «sabado».
  con_bloques <- claves[vapply(claves, function(d) {
    length(a[["dias"]][[d]]) > 0L
  }, logical(1))]
  expect_setequal(con_bloques, c("lunes", "viernes", "sabado"))
})

test_that("B29: lo ilegible vale 0 con aviso perseguible; lo VACIO vale 0 y no avisa", {
  sucio <- carga_disponibilidad_aplicadores(.cda_xlsx(.cda_sucio()))
  # Lo ilegible y la celda vacía valen 0: Caso Sucio queda con 8-9 y 11-12 el
  # lunes, SIN puente inventado por encima de las celdas ilegibles.
  expect_identical(.cda_rangos(sucio, "Caso Sucio", "lunes"),
                   c("08:00-09:00", "11:00-12:00"))
  avisos <- attr(sucio, "avisos", exact = TRUE) %||% character(0)
  expect_gte(length(avisos), 1L)
  # **Y el vacio NO avisa** (2026-09-21). Nacio avisando cuando el formato era
  # 1/0 y un hueco era un olvido; con la plantilla de equis lo vacio es «no
  # disponible», o sea la mayoria de la malla. Medido: tres personas y seis
  # marcas daban 267 avisos sobre una lectura perfecta.
  expect_false(any(grepl("venia vacia|vacia)", avisos)),
               info = paste("avisos:", paste(utils::head(avisos, 3), collapse = " | ")))
  # La causa se puede perseguir: algún aviso nombra al aplicador afectado.
  expect_true(any(grepl("Caso Sucio", avisos, fixed = TRUE)),
              info = paste("avisos:", paste(avisos, collapse = " | ")))
  # Y el archivo limpio (puros 1/0, como la base real medida) no deja avisos.
  limpio <- carga_disponibilidad_aplicadores(.cda_xlsx(.cda_limpio()))
  expect_length(attr(limpio, "avisos", exact = TRUE) %||% character(0), 0L)
})

test_that("B29: archivo inexistente y hoja sin estructura son errores E_* declarados", {
  err <- tryCatch(
    carga_disponibilidad_aplicadores(
      file.path(tempdir(), "no-existe-disponibilidad-b29.xlsx")
    ),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_DISPONIBILIDAD_APLICADORES_NO_EXISTE")
  expect_equal(as.numeric(err$status), 400)

  # Una hoja que existe pero no trae la matriz día×franja: prosa donde iban
  # los rótulos. Eso no se degrada en silencio a «cero aplicadores».
  path <- withr::local_tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Disponibilidad")
  openxlsx::writeData(
    wb, "Disponibilidad",
    data.frame(x = c("esto no es la matriz", "de disponibilidad por franja"),
               stringsAsFactors = FALSE),
    colNames = FALSE
  )
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  err2 <- tryCatch(carga_disponibilidad_aplicadores(path),
                   api_error = function(e) e)
  expect_s3_class(err2, "api_error")
  expect_identical(err2$code, "E_DISPONIBILIDAD_APLICADORES_SIN_ESTRUCTURA")
  expect_equal(as.numeric(err2$status), 422)

  # El lector vive en archivo propio (política de crecimiento congelado):
  # funcionalidad nueva NO va dentro de un monolito existente.
  expect_true(file.exists(
    testthat::test_path("..", "..", "R", "carga_disponibilidad_aplicadores.R")
  ))
})

# **La lista FINAL manda sobre el borrador.**
#
# El directorio del operativo llega con dos matrices: la hoja donde el equipo
# fue anotando a todo el que respondió —con su columna «CONFIRMÓ»— y la hoja de
# los que efectivamente van a aplicar. Leer la primera reparte trabajo entre
# gente que no va a venir: en HSVG 2026, el 2026-09-04, eran 31 nombres contra
# los 24 de la lista final, y el reparto se los daba a todos por igual. Nadie
# lo habría visto hasta que faltara media docena de aplicadores en campo.
test_that("con dos matrices, se lee la hoja declarada FINAL y no el borrador", {
  ruta <- withr::local_tempfile(fileext = ".xlsx")
  cabecera <- function(extra = character(0)) {
    list(
      c("Nombres", extra, "Lunes", "Lunes"),
      c("", rep("", length(extra)), "8:00-9:00am", "9:00-10:00am")
    )
  }
  hoja <- function(filas) do.call(rbind, filas)

  wb <- openxlsx::createWorkbook()
  # El borrador: tres personas, una de ellas sin confirmar.
  openxlsx::addWorksheet(wb, "Disponibilidad")
  openxlsx::writeData(wb, "Disponibilidad", as.data.frame(hoja(c(
    cabecera("CONFIRMÓ"),
    list(c("Ana Uno", "SÍ", "1", "1"),
         c("Beto Dos", "SÍ", "1", "0"),
         c("Cira Tres", "NO", "1", "1"))
  )), stringsAsFactors = FALSE), colNames = FALSE)
  # La lista final: sólo dos, y sin la columna de confirmación.
  openxlsx::addWorksheet(wb, "FINALES APLICADORES")
  openxlsx::writeData(wb, "FINALES APLICADORES", as.data.frame(hoja(c(
    cabecera(),
    list(c("Ana Uno", "1", "1"),
         c("Beto Dos", "1", "0"))
  )), stringsAsFactors = FALSE), colNames = FALSE)
  openxlsx::saveWorkbook(wb, ruta, overwrite = TRUE)

  disp <- carga_disponibilidad_aplicadores(ruta)
  expect_equal(length(disp), 2L)
  expect_setequal(vapply(disp, function(p) p$nombre, character(1)),
                  c("Ana Uno", "Beto Dos"))
})

test_that("sin hoja final declarada se sigue leyendo «Disponibilidad», como siempre", {
  ruta <- withr::local_tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Otra cosa")
  openxlsx::writeData(wb, "Otra cosa", data.frame(x = "ruido"), colNames = FALSE)
  openxlsx::addWorksheet(wb, "Disponibilidad")
  openxlsx::writeData(wb, "Disponibilidad", as.data.frame(do.call(rbind, list(
    c("Nombres", "Lunes", "Lunes"),
    c("", "8:00-9:00am", "9:00-10:00am"),
    c("Ana Uno", "1", "1")
  )), stringsAsFactors = FALSE), colNames = FALSE)
  openxlsx::saveWorkbook(wb, ruta, overwrite = TRUE)

  disp <- carga_disponibilidad_aplicadores(ruta)
  expect_equal(length(disp), 1L)
  expect_equal(disp[[1]]$nombre, "Ana Uno")
})

# --- la misma persona en dos filas, y la fila sin dueño -----------------------

test_that("dos filas con el mismo nombre suman sus horas en vez de perder la segunda", {
  # Medido el 2026-09-21: quien declaraba lunes en una fila y viernes en otra
  # perdía el viernes. `.marep_oferta()` indexa por nombre y salta el que ya
  # vio, así que el reparto informaba «nadie está libre» un día en que sí lo
  # había: una escasez falsa, y muda.
  res <- carga_disponibilidad_aplicadores(.cda_xlsx(list(
    list(nombre = "Ana Prueba", celdas = c(1, 1, 0, 0, 0, 0, 0, 0, 0)),
    list(nombre = "Ana Prueba", celdas = c(0, 0, 0, 0, 1, 1, 0, 0, 0))
  )))
  expect_identical(.cda_nombres(res), "Ana Prueba")
  expect_identical(.cda_rangos(res, "Ana Prueba", "lunes"), "08:00-10:00")
  expect_identical(.cda_rangos(res, "Ana Prueba", "viernes"), "12:00-14:00")
  # Y no se hace en silencio: el aviso nombra LAS DOS filas, que es lo que
  # permite ir a mirarlas.
  av <- attr(res, "avisos")
  fusion <- av[grepl("misma persona", av, fixed = TRUE)]
  expect_length(fusion, 1L)
  expect_true(grepl("Ana Prueba", fusion, fixed = TRUE))
  expect_true(grepl("3", fusion, fixed = TRUE) && grepl("4", fusion, fixed = TRUE))
})

test_that("el calce de la fusión no se rompe por mayúsculas, tildes ni un espacio antes de la coma", {
  res <- carga_disponibilidad_aplicadores(.cda_xlsx(list(
    list(nombre = "JOSÉ PÉREZ", celdas = c(1, 0, 0, 0, 0, 0, 0, 0, 0)),
    list(nombre = "jose perez", celdas = c(0, 0, 0, 0, 0, 0, 0, 1, 0)),
    list(nombre = "ADINS  , SEBASTIEN", celdas = c(0, 1, 0, 0, 0, 0, 0, 0, 0)),
    list(nombre = "ADINS, SEBASTIEN", celdas = c(0, 0, 0, 0, 0, 0, 0, 0, 1))
  )))
  # Dos personas, no cuatro. Y el nombre que queda es el PRIMERO que se
  # escribió, ya limpio de ruido de tecleo.
  expect_identical(.cda_nombres(res), c("JOSÉ PÉREZ", "ADINS, SEBASTIEN"))
  expect_identical(.cda_rangos(res, "JOSÉ PÉREZ", "lunes"), "08:00-09:00")
  expect_identical(.cda_rangos(res, "JOSÉ PÉREZ", "sabado"), "08:00-09:00")
  expect_identical(.cda_rangos(res, "ADINS, SEBASTIEN", "lunes"), "09:00-10:00")
  expect_identical(.cda_rangos(res, "ADINS, SEBASTIEN", "sabado"), "09:00-10:00")
})

test_that("dos filas de la misma persona que se PISAN quedan en un bloque, no en dos", {
  res <- carga_disponibilidad_aplicadores(.cda_xlsx(list(
    list(nombre = "Ana Prueba", celdas = c(1, 1, 0, 0, 0, 0, 0, 0, 0)),
    list(nombre = "Ana Prueba", celdas = c(0, 1, 1, 0, 0, 0, 0, 0, 0))
  )))
  # 8-10 y 9-11 son 8-11: la fusión de intervalos corre DESPUÉS de sumar las
  # filas, no dentro de cada una.
  expect_identical(.cda_rangos(res, "Ana Prueba", "lunes"), "08:00-11:00")
})

test_that("una fila con marcas y sin nombre se declara con su número de fila", {
  # Se descartaba en silencio: quien marca una semana y olvida el nombre
  # desaparecía del reparto sin que nada lo dijera.
  res <- carga_disponibilidad_aplicadores(.cda_xlsx(list(
    list(nombre = "Ana Prueba", celdas = c(1, 1, 0, 0, 0, 0, 0, 0, 0)),
    list(nombre = "", celdas = c(1, 1, 1, 0, 0, 0, 0, 0, 0))
  )))
  expect_identical(.cda_nombres(res), "Ana Prueba")
  av <- attr(res, "avisos")
  sin_nombre <- av[grepl("no trae nombre", av, fixed = TRUE)]
  expect_length(sin_nombre, 1L)
  # La fila 4 del excel (1 = días, 2 = franjas, 3 = Ana), y cuántas dice que
  # SÍ puede — no cuántas celdas se entienden, que en una malla de ceros son
  # todas.
  expect_true(grepl("fila 4", sin_nombre, fixed = TRUE))
  expect_true(grepl("3 franjas disponibles", sin_nombre, fixed = TRUE))
})

test_that("la fila de relleno de la plantilla —sin nombre y sin nada— sigue callada", {
  res <- carga_disponibilidad_aplicadores(.cda_xlsx(list(
    list(nombre = "Ana Prueba", celdas = c(1, 1, 0, 0, 0, 0, 0, 0, 0)),
    list(nombre = "", celdas = rep("", 9L))
  )))
  expect_identical(.cda_nombres(res), "Ana Prueba")
  expect_length(attr(res, "avisos"), 0L)
})
