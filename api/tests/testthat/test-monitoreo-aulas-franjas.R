# El bloque `franjas` del dashboard: el mapa de horas por día que el gráfico
# de la separación de tiempo consume (loop de mejora visual, encargo de
# Gonzalo 2026-09-02: «que el gráfico de la separación de tiempo… se vea
# mejor»).
#
# El motor B11 ya existe y está verde (`monitoreo_aulas_ventanas`,
# monitoreo_aulas_ventanas.R) pero NADIE lo consume: capacidad sin consumidor,
# medida. Este contrato lo publica en el payload del dashboard siguiendo el
# patrón del bloque hermano `dos_tasas` (función en archivo propio +
# UNA línea de mount en `monitoreo_aulas_dashboard`,
# monitoreo_aulas_universitarias.R:2250).
#
# Contrato congelado (diseño de esta oleada, 2026-09-02):
#
# `monitoreo_aulas_franjas(plan)` — recibe el plan normalizado (data.frame o
#   lista de filas, el MISMO formato que `monitoreo_aulas_dos_tasas` y
#   `monitoreo_aulas_ventanas`) y devuelve:
#
#   - `dias`: lista con un elemento por FECHA agendada (ISO, orden
#     ascendente); cada día `{fecha, ventanas, pico, por_confirmar}`:
#       * `ventanas`: una por aula con ventana dibujable ese día,
#         `{codigo, inicio, fin, confirmada}` — inicio/fin en HH:MM de 24
#         horas con cero a la izquierda; `confirmada = TRUE` cuando hay hora
#         pactada (ventana [hora, hora+20min] de B11), `FALSE` cuando es la
#         franja tentativa del curso (agendada sin hora, con sesiones
#         legibles).
#       * `pico`: la carga simultánea del día — `{aulas, inicio, fin}` con el
#         MÁXIMO de aulas confirmadas EN CURSO a la vez (contado por RANGO
#         real, no por hora de inicio: universitarias:1087-1090 ya documenta
#         que sobre HSVG 2026 la hora de inicio daba 8 y el rango real 19) y
#         la franja donde ocurre. En empate, la franja más TEMPRANA. Con cero
#         confirmadas ese día: `aulas = 0` y sin franja inventada.
#       * `por_confirmar`: códigos del día SIN hora pactada — tanto la
#         tentativa con rango de curso (que además dibuja su ventana con
#         `confirmada = FALSE`) como el aula con fecha pero sin hora ni
#         sesiones (que no dibuja nada). DECISIÓN DECLARADA: esto EXTIENDE el
#         `por_confirmar` del mapa de B11 —que solo lista tentativas con
#         rango— derivándolo de `aulas` de ventanas, donde la fecha del
#         `sin_ventana` sí viaja. Una cita sin pactar cuenta como pendiente
#         del día aunque no sepamos ni la franja del curso.
#   - `personas_fuente`: "confirmadas" — el pico sale SOLO de ventanas
#     confirmadas, mismo pin que B11: una cita que no existe no pide gente.
#
#   DERIVADO de `monitoreo_aulas_ventanas`, no recalculado a mano: hereda el
#   parser AM/PM, la fecha ISO/dd-mm, los 20 minutos y la exclusión de
#   retiradas/rechazadas. Hay un grep-pin abajo.
#
#   Vacíos contenidos: plan vacío o sin fechas agendadas → `dias` es lista
#   VACÍA declarada (no NULL crudo, no error). Cálculo puro: degrada
#   declarando, nunca lanza.
#
# Publicación: `monitoreo_aulas_dashboard` expone `franjas` cuando hay plan
# (una línea junto a `dos_tasas`, universitarias:2250). La rama de plan
# VACÍO del dashboard (universitarias:1483-1512) queda como hueco declarado
# al lead: C2 sugeriría montarlo también ahí, pero el precedente sancionado
# es UNA línea.

# Una fila normalizada del plan, con solo lo que cada caso necesita — el
# mismo constructor que el test de B11, con estado y rol opcionales para los
# casos de dashboard.
.maf_fila <- function(codigo, fecha = "", hora = "", sesiones = "",
                      estado = "", rol = "", classroom = "") {
  fila <- list(operational_code = codigo)
  if (nzchar(fecha)) fila[["scheduled_date"]] <- fecha
  if (nzchar(hora)) fila[["scheduled_time"]] <- hora
  if (nzchar(sesiones)) fila[["sesiones_dia_hora"]] <- sesiones
  if (nzchar(estado)) fila[["operational_status"]] <- estado
  if (nzchar(rol)) fila[["sample_role"]] <- rol
  if (nzchar(classroom)) fila[["classroom_id"]] <- classroom
  fila
}

# El día del bloque, buscado por su fecha ISO.
.maf_dia <- function(res, fecha) {
  dias <- res[["dias"]]
  if (is.null(dias)) return(NULL)
  for (d in dias) {
    if (is.list(d) && identical(d[["fecha"]], fecha)) return(d)
  }
  NULL
}

# La ventana de un aula dentro de un día, buscada por su código.
.maf_ventana <- function(dia, codigo) {
  for (v in dia[["ventanas"]] %||% list()) {
    if (is.list(v) && identical(v[["codigo"]], codigo)) return(v)
  }
  NULL
}

# Los códigos con ventana dibujada en un día.
.maf_codigos <- function(dia) {
  vapply(dia[["ventanas"]] %||% list(), function(v) {
    as.character(v[["codigo"]] %||% "")
  }, character(1))
}

# «HH:MM» a minutos, con aritmética propia del test: no depende del parser
# bajo prueba y compara franjas por minutos, no por orden lexicográfico.
.maf_min <- function(x) {
  p <- strsplit(as.character(x), ":", fixed = TRUE)[[1]]
  as.numeric(p[[1]]) * 60 + as.numeric(p[[2]])
}

test_that("cada fecha agendada es un día del bloque, en orden ISO ascendente y con sus ventanas", {
  # El plan llega desordenado a propósito: el orden del bloque es de FECHAS,
  # no de filas. Y la cancelada con cita completa NO ocupa el mapa: franjas
  # deriva de ventanas y hereda su balde `retirada` — si alguien recalcula a
  # mano desde el plan crudo, este pin lo caza.
  res <- monitoreo_aulas_franjas(list(
    .maf_fila("CH 2", fecha = "2026-09-10", hora = "10:00"),
    .maf_fila("CH 1", fecha = "2026-09-08", hora = "6:45 pm"),
    .maf_fila("CH 9", fecha = "2026-09-08", hora = "6:45 pm", estado = "cancelada")
  ))
  expect_true(is.list(res))
  fechas <- vapply(res[["dias"]], function(d) as.character(d[["fecha"]]), character(1))
  expect_identical(fechas, c("2026-09-08", "2026-09-10"))

  d1 <- .maf_dia(res, "2026-09-08")
  v1 <- .maf_ventana(d1, "CH 1")
  expect_true(is.list(v1))
  expect_identical(v1[["inicio"]], "18:45")
  # B70 (dictado 2026-09-03): la aplicacion dura 30 — la ventana crecio de 20.
  expect_identical(v1[["fin"]], "19:15")
  expect_true(isTRUE(v1[["confirmada"]]))
  # La cancelada no está: ni ventana ni pico inflado.
  expect_false("CH 9" %in% .maf_codigos(d1))
  expect_equal(as.numeric(d1[["pico"]][["aulas"]]), 1)

  d2 <- .maf_dia(res, "2026-09-10")
  v2 <- .maf_ventana(d2, "CH 2")
  expect_identical(v2[["inicio"]], "10:00")
  expect_identical(v2[["fin"]], "10:30")
})

test_that("el pico cuenta aulas EN CURSO por rango real —no por hora de inicio— y dice su franja", {
  # Tres citas (a 30 min, B70): 18:45-19:15, 18:50-19:20 y 19:00-19:30. Por HORA DE INICIO el
  # pico daría 2 (dos empiezan en la hora 18); por RANGO real, de 19:00 a
  # 19:15 las tres están EN CURSO a la vez — y ese 3 es el número de
  # aplicadores que el operativo necesita (el mismo sesgo medido en
  # universitarias:1087-1090: 8 por inicio contra 19 por rango).
  res <- monitoreo_aulas_franjas(list(
    .maf_fila("CH 1", fecha = "2026-09-08", hora = "6:45 pm"),
    .maf_fila("CH 2", fecha = "2026-09-08", hora = "6:50 pm"),
    .maf_fila("CH 3", fecha = "2026-09-08", hora = "7:00 pm"),
    # Segundo día, sin solape: mañana y tarde.
    .maf_fila("CH 4", fecha = "2026-09-09", hora = "9:25am"),
    .maf_fila("CH 5", fecha = "2026-09-09", hora = "3:25 pm")
  ))

  pico <- .maf_dia(res, "2026-09-08")[["pico"]]
  expect_true(is.list(pico))
  expect_equal(as.numeric(pico[["aulas"]]), 3)
  # La franja del pico es exactamente el tramo donde las tres coinciden.
  expect_identical(pico[["inicio"]], "19:00")
  expect_identical(pico[["fin"]], "19:15")

  # Sin solape el pico es 1, nunca la suma; en empate manda la franja más
  # TEMPRANA (comparada por solape en minutos, para no congelar la
  # representación interna de los tramos).
  p2 <- .maf_dia(res, "2026-09-09")[["pico"]]
  expect_equal(as.numeric(p2[["aulas"]]), 1)
  expect_true(.maf_min(p2[["inicio"]]) < .maf_min("09:45"))
  expect_true(.maf_min(p2[["fin"]]) > .maf_min("09:25"))
})

test_that("plan sin agendadas: bloque vacío declarado — no NULL crudo, no error", {
  res <- monitoreo_aulas_franjas(list())
  expect_true(is.list(res))
  expect_true(!is.null(res[["dias"]]) && is.list(res[["dias"]]))
  expect_length(res[["dias"]], 0L)
  expect_identical(res[["personas_fuente"]], "confirmadas")

  # Filas hay, fechas no: reservas dormidas y una hora pactada sin fecha
  # (tentativa sin día en B11). Ninguna fecha que dibujar → cero días.
  sin_fechas <- monitoreo_aulas_franjas(list(
    .maf_fila("R 1.1", rol = "chain_reserve"),
    .maf_fila("EXTRA 1", rol = "extra_reserve_pool"),
    .maf_fila("CH 7", hora = "9:25am")
  ))
  expect_length(sin_fechas[["dias"]], 0L)
})

test_that("con fecha pero sin hora: el día la cuenta como por_confirmar, sin ventana inventada", {
  # 2026-09-08 es MARTES: la tentativa de CH 2 usa la sesión MAR de su curso.
  res <- monitoreo_aulas_franjas(list(
    .maf_fila("CH 1", fecha = "2026-09-08", hora = "6:45 pm"),
    .maf_fila("CH 2", fecha = "2026-09-08", sesiones = "MAR 17:00-20:00"),
    .maf_fila("CH 3", fecha = "2026-09-08")
  ))
  dia <- .maf_dia(res, "2026-09-08")
  expect_true(is.list(dia))

  # Las dos citas sin pactar cuentan al día — la que tiene rango de curso Y
  # la que no tiene ni eso (extensión declarada sobre el mapa de B11).
  pendientes <- unlist(dia[["por_confirmar"]])
  expect_true("CH 2" %in% pendientes)
  expect_true("CH 3" %in% pendientes)

  # CH 2 dibuja su rango tentativo, marcado como NO confirmado.
  v2 <- .maf_ventana(dia, "CH 2")
  expect_true(is.list(v2))
  expect_false(isTRUE(v2[["confirmada"]]))
  expect_identical(v2[["inicio"]], "17:00")
  expect_identical(v2[["fin"]], "20:00")

  # CH 3 no dibuja nada: sin hora y sin sesiones no se inventa ventana.
  expect_false("CH 3" %in% .maf_codigos(dia))

  # Y el pico sale SOLO de confirmadas: la tentativa cubre de sobra la
  # ventana de CH 1, pero una cita sin pactar no pide gente todavía.
  expect_equal(as.numeric(dia[["pico"]][["aulas"]]), 1)
  expect_identical(res[["personas_fuente"]], "confirmadas")
})

test_that("horas AM/PM y fechas dd/mm del libro real producen ventanas correctas", {
  # Las entradas TEXTUALES del libro: Gonzalo teclea «6:45 pm» y el equipo
  # teclea la fecha como «08/09/2026» en el Sheets. Ambas formas aterrizan en
  # el MISMO día ISO con ventanas de veinte minutos correctas.
  res <- monitoreo_aulas_franjas(list(
    .maf_fila("CH 1", fecha = "2026-09-08", hora = "6:45 pm"),
    .maf_fila("CH 2", fecha = "08/09/2026", hora = "6:50 PM")
  ))
  expect_length(res[["dias"]], 1L)
  dia <- .maf_dia(res, "2026-09-08")
  expect_true(is.list(dia))

  v1 <- .maf_ventana(dia, "CH 1")
  expect_identical(v1[["inicio"]], "18:45")
  expect_identical(v1[["fin"]], "19:15")
  v2 <- .maf_ventana(dia, "CH 2")
  expect_identical(v2[["inicio"]], "18:50")
  expect_identical(v2[["fin"]], "19:20")
})

test_that("el dashboard de universitarias publica `franjas` cuando hay plan", {
  # El fixture mínimo del encargo: dos agendadas con horas AM/PM, una con
  # fecha sin hora, y reservas sin fecha (cadena y banco). El plan pasa por
  # el normalizador real del dashboard: si `scheduled_date`/`scheduled_time`
  # dejaran de sobrevivirlo (universitarias:655/657 y whitelist :1084), este
  # test lo diría.
  plan <- list(
    .maf_fila("CH 1", fecha = "2026-09-08", hora = "6:45 pm",
              estado = "agendada", rol = "titular", classroom = "a1"),
    .maf_fila("CH 2", fecha = "2026-09-08", hora = "7:00 pm",
              estado = "agendada", rol = "titular", classroom = "a2"),
    .maf_fila("CH 3", fecha = "2026-09-08",
              estado = "contactada", rol = "titular", classroom = "a3"),
    .maf_fila("R 1.1", rol = "chain_reserve", classroom = "r11"),
    .maf_fila("EXTRA 1", rol = "extra_reserve_pool", classroom = "x1")
  )
  tablero <- monitoreo_aulas_dashboard(plan, responses = data.frame(), config = list())

  # El mount: el bloque viaja en el payload, como su hermano `dos_tasas`.
  expect_true(is.list(tablero[["franjas"]]))
  expect_length(tablero[["franjas"]][["dias"]], 1L)

  dia <- .maf_dia(tablero[["franjas"]], "2026-09-08")
  expect_true(is.list(dia))
  v1 <- .maf_ventana(dia, "CH 1")
  expect_identical(v1[["inicio"]], "18:45")
  expect_identical(v1[["fin"]], "19:15")
  expect_true(isTRUE(v1[["confirmada"]]))

  # La cita sin pactar cuenta como por confirmar; las reservas sin fecha ni
  # cuentan ni dibujan.
  expect_true("CH 3" %in% unlist(dia[["por_confirmar"]]))
  codigos <- .maf_codigos(dia)
  expect_false(any(c("R 1.1", "EXTRA 1") %in% codigos))

  # 18:45-19:05 y 19:00-19:20 se pisan de 19:00 a 19:05: dos equipos a la vez.
  expect_equal(as.numeric(dia[["pico"]][["aulas"]]), 2)
})

test_that("franjas vive en su propio archivo, deriva de ventanas y no consulta el reloj", {
  # El patrón sancionado del bloque hermano (`dos_tasas`): función en archivo
  # PROPIO montada con una línea en el dashboard. El grep-pin de derivación
  # existe porque el contrato es «derivado de monitoreo_aulas_ventanas, no
  # recalculado a mano»: reimplementar el barrido a mano perdería el balde de
  # retiradas, el parser AM/PM y los veinte minutos en la primera divergencia.
  motor <- testthat::test_path("..", "..", "R", "monitoreo_aulas_franjas.R")
  expect_true(file.exists(motor))
  fuente <- readLines(motor, warn = FALSE)
  expect_true(any(grepl("monitoreo_aulas_ventanas\\(", fuente)))
  # Determinismo: sin reloj — el mapa del martes se calcula igual el lunes
  # que el miércoles (mismo pin que B11).
  expect_false(any(grepl("Sys\\.time|Sys\\.Date", fuente)))
  plan <- list(
    .maf_fila("CH 1", fecha = "2026-09-08", hora = "6:45 pm"),
    .maf_fila("CH 2", fecha = "2026-09-08", sesiones = "MAR 17:00-20:00")
  )
  expect_identical(monitoreo_aulas_franjas(plan), monitoreo_aulas_franjas(plan))
})
