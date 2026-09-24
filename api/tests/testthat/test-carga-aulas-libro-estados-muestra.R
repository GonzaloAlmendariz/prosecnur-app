# B13b — los estados de STATUS MUESTRA: CINCO tecleables y uno que escribe la app.
#
# Decisión CERRADA del dueño (D-B13, docs/qa/checklist-operativo-aulas-2026-08-31.md;
# poda final textual 2026-09-01): «simplemente pon rechazo. Sin contactar, en
# contacto, agendada, reagendada y rechazo». Cinco TECLEABLES — SIN CONTACTAR ·
# EN CONTACTO · AGENDADA · REAGENDADA · RECHAZO — y ese orden es el del dictado.
# Los estados de cadena (EN RESERVA k, REEMPLAZADA, REFUERZO, CERRADA) son
# DERIVADOS: viven solo en la app y sus hojas; el desplegable del Excel NO los
# ofrece —el código R n.k ya dice la posición en cadena— y la siembra escribe
# SIN CONTACTAR en TODAS las filas, titulares y reservas.
#
# El mapeo tecleado ↔ slug del plan queda declarado AQUÍ (un solo dueño):
#
#   SIN CONTACTAR → sin_contactar   (ya era el default del normalizador)
#   EN CONTACTO   → en_contacto     (gestión: llamada hecha, sin acuerdo aún)
#   AGENDADA      → agendada
#   REAGENDADA    → reagendada
#   RECHAZO       → rechazo         (terminal tecleable → balde `retirada`)
#
# Tolerancia contrato-b (libros vivos v3, EN USO en el operativo): «EN RESERVA
# k», «REEMPLAZADA» y «SIN_CONTACTAR» ya escritos se siguen LEYENDO con su
# clave de siempre (en_reserva / reemplazada / sin_contactar) — no caen a
# basura ni se denuncian.
#
# SOLAPE DECLARADO con la oleada B12/B13a (sus archivos, que aquí NO se tocan:
# test-carga-aulas-libro-vocabulario.R y test-monitoreo-aulas-sheets-formato.R):
# B13a pinea que «SIN CONTACTAR» está EN la lista y es la forma canónica del
# estado inicial; este archivo pinea que la lista es EXACTAMENTE los cinco.
# El pin de B13a es subconjunto del de aquí: verdes a la vez sin conflicto.

# LOS CINCO TECLEABLES — el dictado del dueño, en su orden. Es lo que el equipo
# elige a mano, y no ha cambiado.
.b13b_CINCO <- c("SIN CONTACTAR", "EN CONTACTO", "AGENDADA", "REAGENDADA", "RECHAZO")

# LA LISTA DEL DESPLEGABLE, que desde `1e0c2c0a` no es la misma cosa.
#
# «REFUERZO POR CONTACTAR» lo escribe la APP, no el equipo; no es un sexto
# tecleable. Pero tiene que estar EN la lista de validación, porque si no la
# celda sale con el warning rojo sobre un dato correcto y quien agenda lee un
# aviso de error donde hay una instrucción — exactamente el problema que B13a
# ya había documentado para «SIN CONTACTAR».
#
# Este archivo pineaba la lista contra `.b13b_CINCO` y se quedó en rojo siete
# veces cuando llegó el sexto. El pin no estaba de más: estaba midiendo la
# pregunta equivocada. «Cuántos teclea el equipo» y «qué ofrece el desplegable»
# son dos preguntas, y desde que existe un estado que la app escribe sola ya no
# tienen la misma respuesta.
# Más los dos que marcan un refuerzo: el que escribe la app y su paso siguiente,
# «REFUERZO AGENDADO», que teclea el agendador (2026-09-24).
.b13b_LISTA <- c(.b13b_CINCO, "REFUERZO POR CONTACTAR", "REFUERZO AGENDADO")

.b13b_SLUG <- c(
  "SIN CONTACTAR" = "sin_contactar",
  "EN CONTACTO"   = "en_contacto",
  "AGENDADA"      = "agendada",
  "REAGENDADA"    = "reagendada",
  "RECHAZO"       = "rechazo"
)

# Una unidad mínima del plan para el generador, al estilo del fixture de
# test-carga-aulas-libro-generar.R.
.b13b_unidad <- function(code, role = "titular", titular = code, orden = NULL,
                         status = NULL) {
  u <- list(
    operational_code = code, sample_role = role,
    titular_operational_code = titular, replacement_order = orden,
    faculty = "Ciencias", course_name = "Curso Demo", teacher = "Docente Demo",
    eligible_n = 30
  )
  if (!is.null(status)) u$sample_status <- status
  u
}

# Los ONE_OF_LIST de una lista de requests de setDataValidation, como vectores
# de valores. Extractor propio: el de test-monitoreo-aulas-sheets-formato.R es
# de la oleada B12 y los archivos de test no comparten entorno.
.b13b_one_of_list <- function(reqs) {
  out <- list()
  for (r in reqs) {
    dv <- r[["setDataValidation"]]
    if (!is.list(dv)) next
    cond <- dv[["rule"]][["condition"]] %||% list()
    if (!identical(cond[["type"]], "ONE_OF_LIST")) next
    out[[length(out) + 1L]] <- vapply(
      cond[["values"]] %||% list(),
      function(v) as.character(v[["userEnteredValue"]] %||% ""), character(1)
    )
  }
  out
}

# El aula de un payload {aulas}, buscada por código (dos_tasas y ventanas
# comparten esta forma).
.b13b_aula <- function(res, codigo) {
  for (a in res[["aulas"]]) {
    if (is.list(a) && identical(a[["codigo"]], codigo)) return(a)
  }
  NULL
}

# --- Pin 1: el desplegable ofrece EXACTAMENTE la lista -----------------------

test_that("B13b: el desplegable ofrece los cinco tecleables mas el que escribe la app, y nada mas", {
  # A CUALQUIER profundidad de cadena: la posición en cadena ya la dice el
  # código R n.k, así que «EN RESERVA k» no vuelve a la lista ni con cadenas
  # de doce. El orden es el del dictado del dueño.
  expect_identical(aulas_libro_status_muestra(1L), .b13b_LISTA)
  expect_identical(aulas_libro_status_muestra(3L), .b13b_LISTA)
  expect_identical(aulas_libro_status_muestra(12L), .b13b_LISTA)
})

test_that("B13b: la hoja «Listas» del xlsx ofrece la lista entera y ningún derivado de cadena", {
  plan <- list(
    .b13b_unidad("CH 1"),
    .b13b_unidad("R 1.1", "chain_reserve", "CH 1", 1),
    .b13b_unidad("R 1.2", "chain_reserve", "CH 1", 2)
  )
  f <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, f)

  l <- suppressWarnings(openxlsx::read.xlsx(f, sheet = "Listas", colNames = FALSE))
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  titulo <- AULAS_AGENDADAS_BLOQUE[[which(campos == "sample_status")]]$titulos[[1]]
  col <- which(vapply(l, function(x) identical(as.character(x[[1]]), titulo), logical(1)))
  expect_length(col, 1L)
  valores <- as.character(l[[col]])[-1]
  valores <- valores[!is.na(valores) & nzchar(valores)]
  expect_identical(valores, .b13b_LISTA)
})

# --- Pin 6: paridad xlsx ↔ Sheets --------------------------------------------

test_that("B13b: los desplegables del Sheets ofrecen lo mismo que la hoja «Listas»", {
  reqs <- monitoreo_aulas_sheets_validaciones_requests(
    hoja = "Aulas Agendadas", sheet_id = 222L, n_filas = 43L, profundidad = 3L
  )
  listas <- .b13b_one_of_list(reqs)
  expect_gt(length(listas), 0L)

  # Las listas de STATUS MUESTRA se reconocen porque ofrecen AGENDADA; cada
  # una debe ser EXACTAMENTE los cinco Y exactamente lo que dice la fuente
  # compartida con el xlsx — paridad por valor, no por fe en la constante.
  status <- Filter(function(v) "AGENDADA" %in% v, listas)
  expect_gt(length(status), 0L)
  for (v in status) {
    expect_identical(v, .b13b_LISTA)
    expect_identical(v, aulas_libro_status_muestra(3L))
  }

  # Ningún desplegable de la agenda ofrece un estado DERIVADO.
  todas <- unlist(listas, use.names = FALSE)
  expect_false(any(grepl("^EN RESERVA", todas)))
  expect_false("REEMPLAZADA" %in% todas)
})

# --- Pin 2: la siembra escribe SIN CONTACTAR también en las reservas ---------

test_that("B13b: el escritor traduce el estado de una reserva a SIN CONTACTAR, no a EN RESERVA k", {
  # Hoy `.calg_status_excel` FABRICA «EN RESERVA k» desde el estado derivado
  # (carga_aulas_libro_generar.R:222+). La posición en cadena ya viaja en el
  # código R n.k; el eje tecleable arranca en SIN CONTACTAR.
  expect_identical(prosecnurapp:::.calg_status_excel("en_reserva", "1"), "SIN CONTACTAR")
  expect_identical(prosecnurapp:::.calg_status_excel("en_reserva", "2"), "SIN CONTACTAR")
  # También al regenerar un libro vivo que ya traía la forma vieja tecleada:
  # escribir «EN RESERVA 1» otra vez sería escribir fuera del desplegable.
  expect_identical(prosecnurapp:::.calg_status_excel("EN RESERVA 1"), "SIN CONTACTAR")

  # Y los otros slugs del plan salen en su forma tecleable, sin guion bajo.
  expect_identical(prosecnurapp:::.calg_status_excel("en_contacto"), "EN CONTACTO")
  expect_identical(prosecnurapp:::.calg_status_excel("rechazo"), "RECHAZO")
  expect_identical(prosecnurapp:::.calg_status_excel("agendada"), "AGENDADA")
  expect_identical(prosecnurapp:::.calg_status_excel("reagendada"), "REAGENDADA")
})

test_that("B13b: el libro generado siembra SIN CONTACTAR en titular Y reservas", {
  plan <- list(
    .b13b_unidad("CH 1", status = "sin_contactar"),
    .b13b_unidad("R 1.1", "chain_reserve", "CH 1", 1, status = "en_reserva"),
    .b13b_unidad("R 1.2", "chain_reserve", "CH 1", 2, status = "en_reserva")
  )
  f <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, f)

  d <- suppressWarnings(openxlsx::read.xlsx(f, sheet = "Aulas Agendadas", colNames = FALSE))
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  col_status <- function(b) 1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE +
    which(campos == "sample_status")
  for (b in 1:3) {
    expect_identical(as.character(d[2, col_status(b)]), "SIN CONTACTAR",
                     info = sprintf("bloque %d", b))
  }
  # Ninguna celda de la hoja dice «EN RESERVA …»: el derivado vive en la app,
  # no en el Excel del equipo.
  expect_false(any(grepl("^EN RESERVA", unlist(d, use.names = FALSE))))
})

# --- Pin 3: los cinco tecleados vuelven por el lector con su slug ------------

test_that("B13b: el normalizador mapea los cinco tecleados y reconoce su propia salida", {
  for (tecleado in names(.b13b_SLUG)) {
    slug <- unname(.b13b_SLUG[[tecleado]])
    expect_identical(monitoreo_aulas_estado_muestra(tecleado), slug, info = tecleado)
    # La trampa «enreserva» documentada en el propio normalizador: tiene que
    # reconocer su salida canónica, o cada vuelta degrada el estado.
    expect_identical(monitoreo_aulas_estado_muestra(slug), slug, info = slug)
  }
  # Las grafías que el Excel real produce.
  expect_identical(monitoreo_aulas_estado_muestra("  en contacto "), "en_contacto")
  expect_identical(monitoreo_aulas_estado_muestra("Rechazo"), "rechazo")
})

test_that("B13b: escrito por la app, releído del libro y normalizado — los cinco sobreviven el ciclo", {
  plan <- lapply(seq_along(.b13b_SLUG), function(i) {
    .b13b_unidad(sprintf("CH %d", i), status = unname(.b13b_SLUG[[i]]))
  })
  f <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, f)
  v <- aulas_libro_importar(f)

  estados <- setNames(
    vapply(v$plan, function(u) as.character(u$sample_status %||% ""), character(1)),
    vapply(v$plan, function(u) as.character(u$operational_code %||% ""), character(1))
  )
  for (i in seq_along(.b13b_SLUG)) {
    cod <- sprintf("CH %d", i)
    # Lo que vuelve es la forma TECLEABLE del desplegable, byte a byte…
    expect_identical(unname(estados[[cod]]), names(.b13b_SLUG)[[i]], info = cod)
    # …y el motor la entiende con su slug.
    expect_identical(monitoreo_aulas_estado_muestra(estados[[cod]]),
                     unname(.b13b_SLUG[[i]]), info = cod)
  }
})

test_that("B13b: el vocabulario del motor conoce los cinco slugs y conserva los derivados", {
  expect_true(all(unname(.b13b_SLUG) %in% monitoreo_aulas_estados_muestra()))
  # Los derivados siguen en el vocabulario: el plan los publica (application_state
  # «reemplazada»/«en_reserva» los consume) y los libros vivos los traen.
  expect_true(all(c("en_reserva", "reemplazada") %in% monitoreo_aulas_estados_muestra()))
})

test_that("B13b: RECHAZO y EN CONTACTO tecleados no se denuncian como no reconocidos", {
  # Hoy caen al default y el aviso los declara «se cuentan como SIN CONTACTAR
  # sin estarlo» — un rechazo tecleado volvería a la cola de llamadas.
  x <- monitoreo_aulas_estados_no_reconocidos(lapply(names(.b13b_SLUG), function(s) {
    list(sample_status = s)
  }))
  expect_identical(x$total, 0L)
})

# --- Pin 4: tolerancia con lo ya escrito en libros vivos (contrato-b) --------

test_that("B13b: lo ya tecleado en libros vivos v3 se sigue leyendo sin caer a basura", {
  # El v3 está EN USO: estas celdas existen hoy en el Sheets del operativo.
  expect_identical(monitoreo_aulas_estado_muestra("EN RESERVA 1"), "en_reserva")
  expect_identical(monitoreo_aulas_estado_muestra("EN RESERVA 2"), "en_reserva")
  expect_identical(monitoreo_aulas_estado_muestra("REEMPLAZADA"), "reemplazada")
  expect_identical(monitoreo_aulas_estado_muestra("SIN_CONTACTAR"), "sin_contactar")

  # Y ninguna se denuncia como valor raro.
  x <- monitoreo_aulas_estados_no_reconocidos(list(
    list(sample_status = "EN RESERVA 2"),
    list(sample_status = "REEMPLAZADA"),
    list(sample_status = "SIN_CONTACTAR"),
    list(sample_status = "AGENDADA")
  ))
  expect_identical(x$total, 0L)
})

# --- Pin 5: los motores interpretan RECHAZO y EN CONTACTO --------------------

test_that("B13b: en las dos tasas el aula RECHAZO cae al balde retirada y EN CONTACTO queda en gestión", {
  res <- monitoreo_aulas_dos_tasas(list(
    # RECHAZO tecleado en el libro; el eje operativo sin gestión (ausente y con
    # el default «planificada» del row-builder — las dos formas reales).
    c(.b13b_unidad("CH 1"), list(tasa_efectividad_aula = 0.6,
                                 sample_status = "rechazo")),
    c(.b13b_unidad("CH 2"), list(tasa_efectividad_aula = 0.6,
                                 sample_status = "rechazo",
                                 operational_status = "planificada")),
    c(.b13b_unidad("CH 3"), list(tasa_efectividad_aula = 0.6,
                                 sample_status = "en_contacto"))
  ))
  for (cod in c("CH 1", "CH 2")) {
    aula <- .b13b_aula(res, cod)
    expect_true(is.list(aula), info = cod)
    # Un aula rechazada ya no va a aplicarse por esta vía: no se contrasta ni
    # queda «pendiente» pidiendo gestión a perpetuidad.
    expect_identical(aula[["senal"]], "retirada", info = cod)
    # Y sin campos de contraste: aquí no hay medición que juzgar.
    expect_null(aula[["tasa_observada"]], info = cod)
    expect_null(aula[["efectivas"]], info = cod)
  }
  # EN CONTACTO es gestión: ni retirada ni aplicada.
  expect_identical(.b13b_aula(res, "CH 3")[["senal"]], "pendiente")
})

test_that("B13b: el Plan del día no le pide personas a un aula RECHAZO", {
  unidades <- list(
    c(.b13b_unidad("CH 1"), list(scheduled_date = "2026-09-08",
                                 scheduled_time = "09:00",
                                 sample_status = "agendada")),
    c(.b13b_unidad("CH 2"), list(scheduled_date = "2026-09-08",
                                 scheduled_time = "11:00",
                                 sample_status = "rechazo"))
  )
  hoja <- aulas_libro_hoja_plan_dia(unidades)
  celdas <- unlist(hoja, use.names = FALSE)

  expect_true("CH 1" %in% celdas)
  # El aula rechazada no abre jornada ni suma al total: nadie va a ese salón.
  expect_false("CH 2" %in% celdas)
  expect_true("Aulas agendadas: 1" %in% celdas)
})

test_that("B13b: las ventanas excluyen al aula RECHAZO del mapa y conservan la EN CONTACTO", {
  res <- monitoreo_aulas_ventanas(list(
    list(operational_code = "CH 1", scheduled_date = "2026-09-08",
         scheduled_time = "09:00"),
    # Cita pactada y luego rechazo: la ventana ya no pide personas.
    list(operational_code = "CH 2", scheduled_date = "2026-09-08",
         scheduled_time = "09:10", sample_status = "rechazo"),
    # EN CONTACTO con rango de curso: sigue en gestión, tentativa del día.
    list(operational_code = "CH 3", scheduled_date = "2026-09-08",
         sesiones_dia_hora = "MAR 08:00-10:00", sample_status = "en_contacto")
  ))

  expect_null(.b13b_aula(res, "CH 2"))
  ch3 <- .b13b_aula(res, "CH 3")
  expect_identical(ch3[["ventana"]], "tentativa")

  dia <- NULL
  for (d in res[["mapa"]]) if (identical(d[["fecha"]], "2026-09-08")) dia <- d
  expect_true(is.list(dia))
  expect_true("CH 3" %in% unlist(dia[["por_confirmar"]]))
  # Con CH 2 fuera, ninguna franja del día cuenta dos personas.
  confirmadas <- vapply(dia[["franjas"]], function(fr) fr[["confirmadas"]], integer(1))
  expect_true(all(confirmadas == 1L))
})

test_that("B13b: RECHAZO en el titular dispara el avance de cadena en la lectura de la app", {
  # «El equipo marca RECHAZO en el titular […] y la app deriva el reemplazo»:
  # el eslabón en juego pasa a la primera reserva aunque nadie la haya
  # contactado todavía — es a la que hay que salir a llamar.
  df <- data.frame(
    sample_role = c("titular", "chain_reserve"),
    operational_code = c("CH 5", "R 5.1"),
    titular_operational_code = c("CH 5", "CH 5"),
    sample_status = c("rechazo", "sin_contactar"),
    replacement_order = c(NA_real_, 1),
    stringsAsFactors = FALSE
  )
  expect_identical(monitoreo_aulas_en_juego(df), c(FALSE, TRUE))

  # Sin reservas, el hueco sigue siendo del slot: exactamente UNA fila en
  # juego por cadena, nunca cero (el rechazo no borra el slot del tablero).
  solo <- data.frame(
    sample_role = "titular", operational_code = "CH 9",
    titular_operational_code = "CH 9", sample_status = "rechazo",
    replacement_order = NA_real_, stringsAsFactors = FALSE
  )
  expect_identical(sum(monitoreo_aulas_en_juego(solo)), 1L)

  # Guard: una reserva EN CONTACTO ya está activada — es el eslabón en juego.
  df2 <- data.frame(
    sample_role = c("titular", "chain_reserve"),
    operational_code = c("CH 7", "R 7.1"),
    titular_operational_code = c("CH 7", "CH 7"),
    sample_status = c("sin_contactar", "en_contacto"),
    replacement_order = c(NA_real_, 1),
    stringsAsFactors = FALSE
  )
  expect_identical(monitoreo_aulas_en_juego(df2), c(FALSE, TRUE))
})
