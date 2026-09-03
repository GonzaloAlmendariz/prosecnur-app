# El mapa horario confirmado del operativo (B11).
#
# Dictado de Gonzalo (2026-09-01, textual): «tenemos el traslape de los cursos,
# pero una vez que nos confirmen la hora de aplicación y sabiendo que la
# aplicación suele durar veinte minutos, ya podemos tener la fecha exacta de
# inicio y final una vez que se pacte con el docente, y eso podemos utilizarlo
# […] para confirmar los espacios confirmados donde vamos a necesitar personas,
# [y] para hacer el mapeo automático de todos los rangos horarios en los que se
# va a estar». Requisito adicional del mismo día: él teclea las horas con AM/PM
# («9:25am»), así que el parser acepta am/pm y 24 horas por igual.
#
# Contrato congelado (diseño del lead, 2026-09-01):
#
# `monitoreo_aulas_hora_parse(x)` — vectorizado; devuelve MINUTOS desde la
#   medianoche (9:25 → 565). La basura vuelve como NA declarado: ni cero, ni
#   error — el cero es una hora real (medianoche) y un error tumbaría el plan
#   entero por una celda tecleada mal.
#
# `monitoreo_aulas_ventanas(plan)` — recibe el plan normalizado (lista de
#   filas, el mismo formato que `monitoreo_aulas_dos_tasas`; los campos que
#   lee son `operational_code`, `scheduled_date`, `scheduled_time` y
#   `sesiones_dia_hora`) y devuelve:
#
#   - `aulas`: una por fila con código; cada una
#     `{codigo, ventana, fecha, inicio, fin}` con `ventana` en
#     {confirmada, tentativa, sin_ventana}:
#       * confirmada = fecha agendada + hora pactada → [hora, hora+20min],
#         en HH:MM de 24 horas con cero a la izquierda («09:25»–«09:45»).
#       * tentativa  = agendada SIN hora → el rango del curso entero
#         (`sesiones_dia_hora`, «MIE 17:00-20:00» → [17:00, 20:00]).
#       * sin_ventana = ni hora pactada ni rango del curso. Declarado, no
#         inventado: inicio y fin quedan vacíos.
#   - `mapa`: lista de días `{fecha, franjas, por_confirmar}`; cada franja
#     `{inicio, fin, confirmadas}` dice cuántas aulas CONFIRMADAS se solapan
#     ahí. Las tentativas NO suman personas: se listan aparte en
#     `por_confirmar` de su día.
#   - `personas_fuente`: "confirmadas" — la declaración de que la cifra de
#     personas sale SOLO de las ventanas confirmadas (pin 5 del diseño).
#
# La hora pactada YA viaja al plan hoy: campo canónico `scheduled_time`
# (columna «HORA» del bloque de agenda vía `carga_aulas_agendadas.R:49`,
# preservado por la fusión en `carga_aulas_libro_fusion.R:51` y aceptado por
# el normalizador con alias `hora_agendada` en
# `monitoreo_aulas_universitarias.R:615`). El motor no inventa un campo nuevo:
# lee ese.
#
# Determinismo: nada de Sys.time/Sys.Date — el mapa de mañana se calcula igual
# hoy que mañana; la frontera del «hoy», si algún día hace falta, viene de los
# datos (el patrón de B2.1b(c)), no del reloj.

# Una fila normalizada del plan, con solo lo que cada caso necesita.
.mav_fila <- function(codigo, fecha = "", hora = "", sesiones = "") {
  fila <- list(operational_code = codigo)
  if (nzchar(fecha)) fila[["scheduled_date"]] <- fecha
  if (nzchar(hora)) fila[["scheduled_time"]] <- hora
  if (nzchar(sesiones)) fila[["sesiones_dia_hora"]] <- sesiones
  fila
}

# La ventana de un aula, buscada por su código.
.mav_aula <- function(res, codigo) {
  for (a in res[["aulas"]]) {
    if (is.list(a) && identical(a[["codigo"]], codigo)) return(a)
  }
  NULL
}

# El día del mapa, buscado por su fecha.
.mav_dia <- function(res, fecha) {
  for (d in res[["mapa"]]) {
    if (is.list(d) && identical(d[["fecha"]], fecha)) return(d)
  }
  NULL
}

# «HH:MM» a minutos, con aritmética propia del test: comparar franjas por
# minutos y no por orden lexicográfico evita que un «9:30» sin cero rompa la
# comparación — y no depende del parser bajo prueba.
.mav_min <- function(x) {
  p <- strsplit(as.character(x), ":", fixed = TRUE)[[1]]
  as.numeric(p[[1]]) * 60 + as.numeric(p[[2]])
}

# Las franjas de un día que solapan [ini, fin), en minutos.
.mav_franjas_solapando <- function(dia, ini, fin) {
  franjas <- dia[["franjas"]]
  if (is.null(franjas)) franjas <- list()
  Filter(function(f) {
    is.list(f) && .mav_min(f[["inicio"]]) < fin && .mav_min(f[["fin"]]) > ini
  }, franjas)
}

# El pico de confirmadas de un día: el máximo sobre sus franjas.
.mav_pico <- function(dia) {
  franjas <- dia[["franjas"]]
  if (is.null(franjas) || !length(franjas)) return(0)
  max(vapply(franjas, function(f) {
    v <- suppressWarnings(as.numeric(f[["confirmadas"]]))
    if (!length(v) || is.na(v)) 0 else v
  }, numeric(1)))
}

test_that("el parser lee las cinco formas dictadas — am/pm y 24 horas", {
  # Los cinco formatos del requisito, textuales: «9:25am», «9:25 AM»,
  # «3:25 pm», «15:25», «9:25». Minutos desde la medianoche.
  expect_equal(monitoreo_aulas_hora_parse("9:25am"), 565)
  expect_equal(monitoreo_aulas_hora_parse("9:25 AM"), 565)
  expect_equal(monitoreo_aulas_hora_parse("3:25 pm"), 925)
  expect_equal(monitoreo_aulas_hora_parse("15:25"), 925)
  expect_equal(monitoreo_aulas_hora_parse("9:25"), 565)
  # La semántica pm de verdad: 12:00 pm es mediodía (720), no las 24:00. Un
  # «+12 si pm» ingenuo revienta justo en la franja del almuerzo, que en la
  # jornada universitaria existe.
  expect_equal(monitoreo_aulas_hora_parse("12:00 pm"), 720)
})

test_that("A29: la hora sin minutos con sufijo tambien se lee — «8pm» es 20:00", {
  # El equipo teclea rapido: «8pm» aparecio en el libro real y caia a NA (el
  # regex exigia «:MM»). Con SUFIJO la intencion es inequivoca; sin sufijo,
  # un «8» a secas sigue siendo NA — demasiado ambiguo para adivinarlo.
  expect_equal(monitoreo_aulas_hora_parse("8pm"), 1200)
  expect_equal(monitoreo_aulas_hora_parse("8 am"), 480)
  expect_equal(monitoreo_aulas_hora_parse("12pm"), 720)
  expect_equal(monitoreo_aulas_hora_parse("12am"), 0)
  expect_true(is.na(monitoreo_aulas_hora_parse("8")))
})

test_that("la basura vuelve como NA declarado: ni cero, ni error", {
  sucio <- c("", "mañana", "99:99", "9:60", NA)
  res <- monitoreo_aulas_hora_parse(sucio)
  expect_length(res, length(sucio))
  expect_true(all(is.na(res)))
  # Vectorizado de verdad: lo limpio y lo sucio conviven sin contaminarse.
  mixto <- monitoreo_aulas_hora_parse(c("9:25am", "basura", "15:25"))
  expect_equal(mixto[[1]], 565)
  expect_true(is.na(mixto[[2]]))
  expect_equal(mixto[[3]], 925)
})

test_that("fecha agendada + hora pactada = ventana confirmada de la duracion vigente", {
  # B70 (dictado 2026-09-03): «la aplicacion dura media hora» — el default
  # paso de 20 a 30 y la duracion es configurable (duracion_aplicacion_min).
  res <- monitoreo_aulas_ventanas(list(
    .mav_fila("CH 1", fecha = "2026-09-04", hora = "9:25am"),
    .mav_fila("CH 2", fecha = "2026-09-04", hora = "15:25")
  ))
  a1 <- .mav_aula(res, "CH 1")
  expect_true(is.list(a1))
  expect_identical(a1[["ventana"]], "confirmada")
  expect_identical(a1[["fecha"]], "2026-09-04")
  expect_identical(a1[["inicio"]], "09:25")
  expect_identical(a1[["fin"]], "09:55")
  a2 <- .mav_aula(res, "CH 2")
  expect_identical(a2[["ventana"]], "confirmada")
  expect_identical(a2[["inicio"]], "15:25")
  expect_identical(a2[["fin"]], "15:55")
  # El eco de la duracion saneada viaja en el payload.
  expect_identical(res[["duracion_min"]], 30L)
})

test_that("B70: la duracion configurada manda y lo ilegible cae al default", {
  res <- monitoreo_aulas_ventanas(list(
    .mav_fila("CH 1", fecha = "2026-09-04", hora = "9:00am")
  ), duracion_min = 45L)
  expect_identical(.mav_aula(res, "CH 1")[["fin"]], "09:45")
  expect_identical(res[["duracion_min"]], 45L)
  basura <- monitoreo_aulas_ventanas(list(
    .mav_fila("CH 1", fecha = "2026-09-04", hora = "9:00am")
  ), duracion_min = "no-numero")
  expect_identical(.mav_aula(basura, "CH 1")[["fin"]], "09:30")
})

test_that("agendada sin hora = tentativa con el rango del curso entero", {
  res <- monitoreo_aulas_ventanas(list(
    .mav_fila("CH 3", fecha = "2026-09-04", sesiones = "VIE 17:00-20:00")
  ))
  aula <- .mav_aula(res, "CH 3")
  expect_true(is.list(aula))
  expect_identical(aula[["ventana"]], "tentativa")
  expect_identical(aula[["fecha"]], "2026-09-04")
  expect_identical(aula[["inicio"]], "17:00")
  expect_identical(aula[["fin"]], "20:00")
})

test_that("sin hora pactada y sin rango del curso: sin ventana declarada, no inventada", {
  res <- monitoreo_aulas_ventanas(list(
    .mav_fila("CH 4", fecha = "2026-09-04")
  ))
  aula <- .mav_aula(res, "CH 4")
  expect_true(is.list(aula))
  expect_identical(aula[["ventana"]], "sin_ventana")
  # No se inventa una ventana: inicio y fin quedan vacíos.
  expect_true(is.null(aula[["inicio"]]) || !nzchar(aula[["inicio"]]))
  expect_true(is.null(aula[["fin"]]) || !nzchar(aula[["fin"]]))
})

test_that("dos confirmadas que se solapan cuentan juntas en el pico de su franja", {
  # [09:25, 09:45] y [09:40, 10:00]: se pisan de 09:40 a 09:45. Ahí el
  # operativo necesita DOS equipos a la vez, y el mapa lo tiene que decir.
  res <- monitoreo_aulas_ventanas(list(
    .mav_fila("CH 1", fecha = "2026-09-04", hora = "9:25am"),
    .mav_fila("CH 2", fecha = "2026-09-04", hora = "9:40")
  ))
  dia <- .mav_dia(res, "2026-09-04")
  expect_true(is.list(dia))
  expect_equal(.mav_pico(dia), 2)
  # El pico vive donde el solape: alguna franja con confirmadas == 2 toca
  # [09:40, 09:45]. Se compara por solape y no por igualdad exacta para no
  # congelar la representación interna del mapa (segmentos vs. bloques).
  picos <- Filter(
    function(f) isTRUE(suppressWarnings(as.numeric(f[["confirmadas"]])) == 2),
    .mav_franjas_solapando(dia, .mav_min("09:40"), .mav_min("09:45"))
  )
  expect_true(length(picos) >= 1)
})

test_that("dos confirmadas sin solape hacen picos separados, nunca uno de dos", {
  res <- monitoreo_aulas_ventanas(list(
    .mav_fila("CH 1", fecha = "2026-09-04", hora = "9:25am"),
    .mav_fila("CH 2", fecha = "2026-09-04", hora = "15:25")
  ))
  dia <- .mav_dia(res, "2026-09-04")
  expect_true(is.list(dia))
  expect_equal(.mav_pico(dia), 1)
  # Cada ventana tiene su propia franja ocupada.
  en_manana <- .mav_franjas_solapando(dia, .mav_min("09:25"), .mav_min("09:45"))
  en_tarde <- .mav_franjas_solapando(dia, .mav_min("15:25"), .mav_min("15:45"))
  expect_true(length(en_manana) >= 1)
  expect_true(length(en_tarde) >= 1)
})

test_that("la cifra de personas sale SOLO de confirmadas — la tentativa va aparte como por confirmar", {
  # La tentativa cubre de sobra la ventana confirmada: si el mapa la sumara,
  # el pico daría 2 y el operativo pediría gente para una cita que aún no
  # existe. El diseño manda: confirmadas al mapa, tentativas a «por confirmar».
  res <- monitoreo_aulas_ventanas(list(
    .mav_fila("CH 1", fecha = "2026-09-04", hora = "9:25am"),
    .mav_fila("CH 2", fecha = "2026-09-04", sesiones = "VIE 09:00-11:00")
  ))
  dia <- .mav_dia(res, "2026-09-04")
  expect_true(is.list(dia))
  expect_equal(.mav_pico(dia), 1)
  expect_true("CH 2" %in% unlist(dia[["por_confirmar"]]))
  # Y lo DECLARA: quien lea la cifra sabe de qué ventanas salió.
  expect_identical(res[["personas_fuente"]], "confirmadas")
})

test_that("determinismo: dos corridas idénticas y sin reloj en el motor", {
  plan <- list(
    .mav_fila("CH 1", fecha = "2026-09-04", hora = "9:25am"),
    .mav_fila("CH 2", fecha = "2026-09-04", sesiones = "VIE 09:00-11:00"),
    .mav_fila("CH 3", fecha = "2026-09-07", hora = "3:25 pm")
  )
  expect_identical(monitoreo_aulas_ventanas(plan), monitoreo_aulas_ventanas(plan))
  # El motor no consulta el reloj: el mapa del viernes se calcula igual el
  # jueves que el sábado. Mismo patrón que la frontera del «hoy» de B2.1b(c).
  motor <- testthat::test_path("..", "..", "R", "monitoreo_aulas_ventanas.R")
  expect_true(file.exists(motor))
  fuente <- readLines(motor, warn = FALSE)
  expect_false(any(grepl("Sys\\.time|Sys\\.Date", fuente)))
})
