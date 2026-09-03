# B29 — el reparto equitativo de aplicadores desde su disponibilidad
# (docs/qa/checklist-operativo-aulas-2026-08-31.md).
#
# Dictado de Gonzalo (2026-09-02, textual): «super importante: ahora tenemos la
# disponibilidad de los aplicadores (disponibilidad_codificado.xlsx) y sería
# bueno poder ir mapeando una distribución equitativa en base a lo agendado que
# se tiene hasta ahora, pero que pueda ir actualizándose con el paso de los
# días». Addendum del mismo día: «deben haber tres cuadros/visualizaciones:
# Patrón semanal, Calendario y Disponibilidad de aplicadores» y «necesitaríamos
# una pestaña de asignación… para poder hacer una asignación equitativa en base
# a lo que ya tenemos de momento, pero que sea repetible por si llegan nuevas
# confirmaciones».
#
# Contrato congelado (diseño del lead, 2026-09-02), tres piezas:
#
# `monitoreo_aulas_reparto(plan, disponibilidad)` — archivo propio
#   `api/R/monitoreo_aulas_reparto.R`; `disponibilidad` es la salida de
#   `carga_disponibilidad_aplicadores` (lista de `{nombre, dias}` con claves de
#   día minúscula sin tilde y bloques `{inicio, fin}` HH:MM, [inicio, fin)).
#
#   - La ventana de cada CH agendado se DERIVA de `monitoreo_aulas_ventanas`
#     (hay grep-pin): [hora pactada, hora + 20 min], parser AM/PM heredado, y
#     el mismo balde de retiradas/rechazos — una cancelada no pide aplicador.
#     El día de semana sale de la fecha ISO SIN locale (patrón `.mav_DIAS`).
#   - Candidatos de un CH: aplicadores cuyo bloque disponible del día CUBRE la
#     ventana ENTERA (bloque_ini <= ventana_ini y bloque_fin >= ventana_fin).
#     Cubrir a medias no es cubrir.
#   - Asignación EQUITATIVA y DETERMINISTA: greedy por fecha+hora ascendente;
#     cada CH toma el candidato con MENOS asignaciones acumuladas; empate →
#     orden alfabético del nombre. Sin RNG y sin reloj (grep-pin): mismo input
#     → mismo output SIEMPRE.
#   - Un aplicador NO está en dos aulas cuyas ventanas se SOLAPAN. Ventanas
#     ADYACENTES (una termina 10:20, otra empieza 10:20) no se solapan — la
#     misma convención que las franjas de B11.
#   - Salida: `dias` = lista por fecha ISO ascendente,
#     `{fecha, asignaciones, no_cubiertos, por_confirmar}` con cada asignación
#     `{codigo, aplicador, inicio, fin}` (HH:MM); `no_cubiertos` = códigos con
#     cita pactada y ningún candidato libre; `por_confirmar` = códigos con
#     fecha SIN hora (el vocabulario de B11: una cita sin pactar no pide gente
#     todavía — ni se asigna ni se declara descubierta). Además `equidad`:
#     lista `{aplicador, asignadas}` en orden ALFABÉTICO con TODOS los
#     aplicadores de la disponibilidad, 0 incluido.
#   - «Que pueda ir actualizándose con el paso de los días» se pinea como
#     PUREZA: recomputar con el plan que ganó agendadas produce el reparto del
#     estado nuevo, sin memoria entre corridas. La «pegajosidad» de lo ya
#     comunicado a los aplicadores queda FUERA de v1 — decisión futura del
#     dueño, declarada, no pineada.
#
# `monitoreo_aulas_disponibilidad_bloque(disponibilidad)` — el bloque de
#   payload de la vista «Disponibilidad de aplicadores»: `dias` = lista en
#   ORDEN DE SEMANA (lunes→domingo, solo días con cobertura) de
#   `{dia, franjas}`; cada franja es de 30 MINUTOS (la malla de Carga de
#   campo) dentro del rango cubierto —solo tramos con alguien disponible— con
#   `{inicio, fin, disponibles, nombres}` y `nombres` en orden alfabético
#   estable. Disponibilidad vacía → `dias` vacío declarado.
#
# Mount en el dashboard de universitarias — patrón EXACTO de la plomería DAA
#   (`s[["monitoreo_aulas_daa_traslape"]]`, monitoreo_aulas_publicar_libro.R:599):
#   quien carga la disponibilidad hace
#   `session_set(sid, "monitoreo_aulas_disponibilidad", <lista>)`; CON la clave
#   el payload publica `disponibilidad` (el bloque de arriba) y su gemelo
#   `reparto` (= `monitoreo_aulas_reparto(plan, disponibilidad)`, recomputado
#   en cada conversar — la repetibilidad del dictado); SIN la clave, ambos
#   bloques AUSENTES sin error. El eslabón session-aware pineado es
#   `monitoreo_aulas_dashboard_cached(sid, …)`: es el único punto con `sid` y
#   dashboard a la vez, porque `router_monitoreo.R` está congelado a
#   crecimiento. Lectura con `[[`, nunca `$` (partial matching).
#
# Deberes del writer DECLARADOS (fuera de estos pines): censar la clave
# `monitoreo_aulas_disponibilidad` en session_schema.R (gate
# test-session-schema.R); decidir si el bloque de disponibilidad vive en el
# archivo del motor o en archivo propio; el orden entre dos CH con IDÉNTICA
# fecha+hora (sugerido: por código, estable); y la invalidación de la cache
# del dashboard cuando cambia la disponibilidad en sesión (el token de
# `monitoreo_aulas_cache_token` no ve esa clave — hueco declarado al lead;
# estos tests usan `token = ""`, que no cachea, para no congelar esa política).
#
# Fixtures 100% SINTÉTICOS: los nombres de la base real del cliente son PII y
# jamás entran al repo.

# --- constructores ------------------------------------------------------------

# Una fila normalizada del plan (mismo formato que dos_tasas/ventanas/franjas).
.marp_fila <- function(codigo, fecha = "", hora = "", sesiones = "",
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

.marp_bloque <- function(inicio, fin) list(inicio = inicio, fin = fin)

# Un aplicador con la forma pineada del lector: {nombre, dias}.
.marp_apl <- function(nombre, dias) list(nombre = nombre, dias = dias)

# Un aplicador disponible toda la jornada, lunes a sábado.
.marp_full <- function(nombre) {
  .marp_apl(nombre, stats::setNames(
    rep(list(list(.marp_bloque("08:00", "22:00"))), 6L),
    c("lunes", "martes", "miercoles", "jueves", "viernes", "sabado")
  ))
}

# --- lectores del contrato ----------------------------------------------------

.marp_dia <- function(res, fecha) {
  for (d in res[["dias"]] %||% list()) {
    if (is.list(d) && identical(d[["fecha"]], fecha)) return(d)
  }
  NULL
}

.marp_asig <- function(dia, codigo) {
  for (a in dia[["asignaciones"]] %||% list()) {
    if (is.list(a) && identical(a[["codigo"]], codigo)) return(a)
  }
  NULL
}

.marp_no_cubiertos <- function(dia) {
  as.character(unlist(dia[["no_cubiertos"]] %||% list()))
}

.marp_por_confirmar <- function(dia) {
  as.character(unlist(dia[["por_confirmar"]] %||% list()))
}

# El resumen de equidad como vector nombrado aplicador → asignadas, en el
# ORDEN en que el motor lo publica.
.marp_equidad <- function(res) {
  eq <- res[["equidad"]] %||% list()
  stats::setNames(
    vapply(eq, function(e) as.numeric(e[["asignadas"]]), numeric(1)),
    vapply(eq, function(e) as.character(e[["aplicador"]]), character(1))
  )
}

# «HH:MM» a minutos, con aritmética propia del test.
.marp_min <- function(x) {
  p <- strsplit(as.character(x), ":", fixed = TRUE)[[1]]
  as.numeric(p[[1]]) * 60 + as.numeric(p[[2]])
}

# El día del bloque de disponibilidad, por su clave.
.madb_dia <- function(bloque, dia) {
  for (d in bloque[["dias"]] %||% list()) {
    if (is.list(d) && identical(d[["dia"]], dia)) return(d)
  }
  NULL
}

# La franja de un día del bloque, por su inicio.
.madb_franja <- function(dia, inicio) {
  for (f in dia[["franjas"]] %||% list()) {
    if (is.list(f) && identical(f[["inicio"]], inicio)) return(f)
  }
  NULL
}

# --- el motor de reparto ------------------------------------------------------

test_that("B29: candidato es quien CUBRE la ventana entera; la cancelada no pide aplicador", {
  # 2026-09-11 es VIERNES. «Alba Parcial» va PRIMERA en alfabeto a propósito:
  # su bloque [09:00, 10:10) NO cubre la OCUPACIÓN [09:30, 10:30] de la cita
  # de las 10:00 (B71: recojo T−30 + aplicación de 30) — si el motor aceptara
  # cubrir a medias, el empate alfabético se la daría a ella y este pin lo
  # cazaría. «Saturnino Sintetico» solo tiene sábado.
  disp <- list(
    .marp_apl("Alba Parcial", list(viernes = list(.marp_bloque("09:00", "10:10")))),
    .marp_apl("Nora Completa", list(viernes = list(.marp_bloque("08:00", "12:00")))),
    .marp_apl("Saturnino Sintetico", list(sabado = list(.marp_bloque("08:00", "22:00"))))
  )
  res <- monitoreo_aulas_reparto(list(
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"),
    .marp_fila("CH 2", fecha = "2026-09-11", hora = "21:50"),
    .marp_fila("CH 9", fecha = "2026-09-11", hora = "10:00", estado = "cancelada")
  ), disp)

  dia <- .marp_dia(res, "2026-09-11")
  expect_true(is.list(dia))
  a1 <- .marp_asig(dia, "CH 1")
  expect_true(is.list(a1))
  expect_identical(a1[["aplicador"]], "Nora Completa")
  # La ventana viene de B11 con la duración vigente (B70: 30 min).
  expect_identical(a1[["inicio"]], "10:00")
  expect_identical(a1[["fin"]], "10:30")
  # B71: el protocolo del despliegue lo dice el motor — recojo T−30 y
  # salida T−15; el frontend no re-parsea horas.
  expect_identical(a1[["recojo"]], "09:30")
  expect_identical(a1[["salida"]], "09:45")
  # A las 21:50 nadie cubre la ocupación [21:20, 22:20]: descubierto DECLARADO.
  expect_true("CH 2" %in% .marp_no_cubiertos(dia))
  # La cancelada hereda el balde de ventanas: no está en ningún lado.
  expect_null(.marp_asig(dia, "CH 9"))
  expect_false("CH 9" %in% .marp_no_cubiertos(dia))
  expect_false("CH 9" %in% .marp_por_confirmar(dia))
})

test_that("B29: manda la menor carga acumulada y el empate se rompe por alfabeto, no por orden de entrada", {
  # La disponibilidad llega con Berta ANTES que Ana a propósito: si el
  # desempate fuera por orden de entrada, la cita de las 9 sería de Berta.
  disp <- list(.marp_full("Berta Ficticia"), .marp_full("Ana Prueba"))
  # Y el plan llega con la cita tardía primero: el greedy ordena por
  # fecha+hora, no por fila.
  res <- monitoreo_aulas_reparto(list(
    .marp_fila("CH 2", fecha = "2026-09-11", hora = "3:00 pm"),
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "9:00am")
  ), disp)

  dia <- .marp_dia(res, "2026-09-11")
  a1 <- .marp_asig(dia, "CH 1")
  a2 <- .marp_asig(dia, "CH 2")
  # 09:00 se procesa primero: empate 0-0 → alfabético → Ana.
  expect_identical(a1[["aplicador"]], "Ana Prueba")
  # 15:00 después: Ana carga 1, Berta 0 → la menor carga manda.
  expect_identical(a2[["aplicador"]], "Berta Ficticia")
  # El parser AM/PM se heredó de ventanas: «9:00am» → 09:00.
  expect_identical(a1[["inicio"]], "09:00")
  expect_identical(a2[["inicio"]], "15:00")
})

test_that("B29: con candidatos de sobra el resumen de equidad no deja a nadie cargando de más", {
  # Tres aplicadores full-time y siete citas sin solape: el greedy por carga
  # tiene que dejar el conteo en 3-2-2 como máximo de desbalance (max-min ≤ 1).
  disp <- list(.marp_full("Carla Sintetica"), .marp_full("Ana Prueba"),
               .marp_full("Berta Ficticia"))
  res <- monitoreo_aulas_reparto(list(
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "9:00am"),
    .marp_fila("CH 2", fecha = "2026-09-11", hora = "10:00"),
    .marp_fila("CH 3", fecha = "2026-09-11", hora = "11:00"),
    .marp_fila("CH 4", fecha = "2026-09-11", hora = "3:00 pm"),
    .marp_fila("CH 5", fecha = "2026-09-12", hora = "9:00am"),
    .marp_fila("CH 6", fecha = "2026-09-12", hora = "10:00"),
    .marp_fila("CH 7", fecha = "2026-09-12", hora = "11:00")
  ), disp)

  # Días en orden ISO ascendente.
  fechas <- vapply(res[["dias"]], function(d) as.character(d[["fecha"]]), character(1))
  expect_identical(fechas, c("2026-09-11", "2026-09-12"))
  # Nada quedó descubierto: candidatos había de sobra.
  for (d in res[["dias"]]) expect_length(.marp_no_cubiertos(d), 0L)

  eq <- .marp_equidad(res)
  expect_setequal(names(eq), c("Ana Prueba", "Berta Ficticia", "Carla Sintetica"))
  # El resumen sale ALFABÉTICO, no en el orden de entrada de la disponibilidad.
  expect_identical(names(eq), sort(names(eq)))
  expect_equal(sum(eq), 7)
  expect_lte(max(eq) - min(eq), 1)
})

test_that("B29: un aplicador no está en dos aulas que se solapan — y la adyacencia no es solape", {
  # El pin discriminante del contrato, sobre la OCUPACIÓN (B71): dos CH a las
  # 10:00 y 10:10 con UN solo candidato común — sus ocupaciones [09:30,10:30]
  # y [09:40,10:40] se solapan; sin el chequeo, Zoe estaría en dos sitios a
  # la vez; con él, el segundo queda DECLARADO como no cubierto. Y el tercero
  # a las 11:00 arranca su recojo (10:30) justo cuando la primera aplicación
  # termina: adyacente, no solapado (la convención de B11) — Zoe sí llega.
  disp <- list(.marp_apl("Zoe Unica", list(viernes = list(.marp_bloque("08:00", "22:00")))))
  res <- monitoreo_aulas_reparto(list(
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"),
    .marp_fila("CH 2", fecha = "2026-09-11", hora = "10:10"),
    .marp_fila("CH 3", fecha = "2026-09-11", hora = "11:00")
  ), disp)

  dia <- .marp_dia(res, "2026-09-11")
  expect_identical(.marp_asig(dia, "CH 1")[["aplicador"]], "Zoe Unica")
  expect_null(.marp_asig(dia, "CH 2"))
  expect_true("CH 2" %in% .marp_no_cubiertos(dia))
  expect_identical(.marp_asig(dia, "CH 3")[["aplicador"]], "Zoe Unica")
  eq <- .marp_equidad(res)
  expect_equal(unname(eq[["Zoe Unica"]]), 2)
})

test_that("B29: si el ocupado tiene relevo, el segundo CH sale con OTRO — y el que nunca calza suma 0 en equidad", {
  disp <- list(
    .marp_full("Ana Prueba"),
    # B71: para cubrir la cita de las 10:10 hay que estar libre desde su
    # recojo (09:40) — el bloque de Berta arranca exactamente ahí.
    .marp_apl("Berta Ficticia", list(viernes = list(.marp_bloque("09:40", "12:00")))),
    .marp_apl("Mario Sintetico", list(sabado = list(.marp_bloque("08:00", "22:00"))))
  )
  res <- monitoreo_aulas_reparto(list(
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"),
    .marp_fila("CH 2", fecha = "2026-09-11", hora = "10:10")
  ), disp)

  dia <- .marp_dia(res, "2026-09-11")
  # CH 1 solo lo cubre Ana (Berta empieza 09:40 y el recojo de CH 1 es
  # 09:30); CH 2 encuentra a Ana ocupada y sale con Berta: nada descubierto.
  expect_identical(.marp_asig(dia, "CH 1")[["aplicador"]], "Ana Prueba")
  expect_identical(.marp_asig(dia, "CH 2")[["aplicador"]], "Berta Ficticia")
  expect_length(.marp_no_cubiertos(dia), 0L)
  # Mario declaró disponibilidad y no calzó con nada: aparece con 0, no
  # desaparece del resumen.
  eq <- .marp_equidad(res)
  expect_true("Mario Sintetico" %in% names(eq))
  expect_equal(unname(eq[["Mario Sintetico"]]), 0)
})

test_that("B29: vacíos contenidos — plan sin agendadas y disponibilidad vacía degradan declarando", {
  # Sin agendadas: cero días declarados y la equidad lista a todos con 0.
  res <- monitoreo_aulas_reparto(list(), list(.marp_full("Ana Prueba")))
  expect_true(is.list(res[["dias"]]))
  expect_length(res[["dias"]], 0L)
  eq <- .marp_equidad(res)
  expect_identical(names(eq), "Ana Prueba")
  expect_equal(unname(eq[["Ana Prueba"]]), 0)

  # Sin disponibilidad: la cita existe y NADIE la cubre — descubierta
  # declarada, equidad vacía declarada (lista, no NULL), sin error.
  res2 <- monitoreo_aulas_reparto(
    list(.marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00")),
    list()
  )
  dia <- .marp_dia(res2, "2026-09-11")
  expect_true(is.list(dia))
  expect_length(dia[["asignaciones"]] %||% list(), 0L)
  expect_true("CH 1" %in% .marp_no_cubiertos(dia))
  expect_true(is.list(res2[["equidad"]]))
  expect_length(res2[["equidad"]], 0L)
})

test_that("B29: el CH con fecha sin hora NO se asigna — queda por confirmar, no descubierto ni inventado", {
  res <- monitoreo_aulas_reparto(list(
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"),
    .marp_fila("CH 2", fecha = "2026-09-11", sesiones = "VIE 09:00-11:00"),
    .marp_fila("CH 3", fecha = "2026-09-11")
  ), list(.marp_full("Ana Prueba")))

  dia <- .marp_dia(res, "2026-09-11")
  # Las dos citas sin pactar —con y sin rango de curso— cuentan como por
  # confirmar (la extensión declarada de franjas B29 hereda): asignarles gente
  # sería inventar una cita.
  pendientes <- .marp_por_confirmar(dia)
  expect_true("CH 2" %in% pendientes)
  expect_true("CH 3" %in% pendientes)
  expect_null(.marp_asig(dia, "CH 2"))
  expect_null(.marp_asig(dia, "CH 3"))
  expect_false(any(c("CH 2", "CH 3") %in% .marp_no_cubiertos(dia)))
  # Y la única cita pactada sí se reparte.
  expect_identical(.marp_asig(dia, "CH 1")[["aplicador"]], "Ana Prueba")
})

test_that("B29: «se actualiza con los días» = recomputar puro; sin memoria entre corridas", {
  disp <- list(.marp_full("Ana Prueba"), .marp_full("Berta Ficticia"))
  plan_hoy <- list(.marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"))
  r1 <- monitoreo_aulas_reparto(plan_hoy, disp)
  expect_length(r1[["dias"]], 1L)

  # Pasan los días: el plan gana una agendada. El reparto es el del estado
  # NUEVO — el sábado aparece con su asignación.
  plan_manana <- c(plan_hoy, list(.marp_fila("CH 2", fecha = "2026-09-12", hora = "9:00am")))
  r2 <- monitoreo_aulas_reparto(plan_manana, disp)
  fechas <- vapply(r2[["dias"]], function(d) as.character(d[["fecha"]]), character(1))
  expect_identical(fechas, c("2026-09-11", "2026-09-12"))
  expect_true(is.list(.marp_asig(.marp_dia(r2, "2026-09-12"), "CH 2")))
  expect_equal(sum(.marp_equidad(r2)), 2)

  # Sin memoria: volver al plan de ayer devuelve EXACTAMENTE el reparto de
  # ayer, y dos corridas del mismo plan son idénticas (determinismo).
  expect_identical(monitoreo_aulas_reparto(plan_hoy, disp), r1)
  expect_identical(monitoreo_aulas_reparto(plan_manana, disp),
                   monitoreo_aulas_reparto(plan_manana, disp))
})

test_that("B29: el motor vive en archivo propio, deriva de ventanas y no tiene reloj ni RNG", {
  motor <- testthat::test_path("..", "..", "R", "monitoreo_aulas_reparto.R")
  expect_true(file.exists(motor))
  fuente <- readLines(motor, warn = FALSE)
  # Derivado de B11, no re-parseado: reimplementar la ventana a mano perdería
  # el parser AM/PM, los veinte minutos y el balde de retiradas en la primera
  # divergencia (mismo pin que franjas).
  expect_true(any(grepl("monitoreo_aulas_ventanas\\(", fuente)))
  # Determinismo del dictado («repetible»): ni reloj ni azar.
  expect_false(any(grepl("Sys\\.time|Sys\\.Date", fuente)))
  expect_false(any(grepl("sample\\(|sample\\.int|runif\\(|rnorm\\(|set\\.seed", fuente)))
})

# --- el bloque de la vista «Disponibilidad de aplicadores» --------------------

test_that("B29: el bloque de disponibilidad pinta la oferta en franjas de 30 minutos, por día de semana", {
  # Lunes y JUEVES a propósito: en orden de semana va lunes→jueves; el orden
  # alfabético diría «jueves» primero — este pin los distingue. Y Berta entra
  # ANTES que Ana en la lista para pinear que `nombres` sale alfabético.
  disp <- list(
    .marp_apl("Berta Ficticia", list(lunes = list(.marp_bloque("09:00", "11:00")))),
    .marp_apl("Ana Prueba", list(
      lunes = list(.marp_bloque("08:00", "10:00")),
      jueves = list(.marp_bloque("12:00", "13:00"))
    ))
  )
  res <- monitoreo_aulas_disponibilidad_bloque(disp)
  dias <- vapply(res[["dias"]] %||% list(), function(d) as.character(d[["dia"]]), character(1))
  expect_identical(dias, c("lunes", "jueves"))

  lunes <- .madb_dia(res, "lunes")
  expect_true(is.list(lunes))
  # El rango cubierto del lunes es [08:00, 11:00): seis franjas de 30 minutos,
  # ninguna fuera (ni 07:30 ni 11:00 — solo tramos con alguien disponible).
  expect_length(lunes[["franjas"]] %||% list(), 6L)
  expect_null(.madb_franja(lunes, "07:30"))
  expect_null(.madb_franja(lunes, "11:00"))
  for (f in lunes[["franjas"]]) {
    expect_equal(.marp_min(f[["fin"]]) - .marp_min(f[["inicio"]]), 30)
  }

  # Donde los bloques se pisan, la franja suma y NOMBRA — alfabético, no en
  # el orden de entrada de la disponibilidad.
  pico <- .madb_franja(lunes, "09:00")
  expect_true(is.list(pico))
  expect_equal(as.numeric(pico[["disponibles"]]), 2)
  expect_identical(as.character(unlist(pico[["nombres"]])),
                   c("Ana Prueba", "Berta Ficticia"))
  # En las puntas queda cada una sola.
  temprano <- .madb_franja(lunes, "08:00")
  expect_equal(as.numeric(temprano[["disponibles"]]), 1)
  expect_identical(as.character(unlist(temprano[["nombres"]])), "Ana Prueba")
  tarde <- .madb_franja(lunes, "10:30")
  expect_identical(as.character(unlist(tarde[["nombres"]])), "Berta Ficticia")

  jueves <- .madb_dia(res, "jueves")
  expect_length(jueves[["franjas"]] %||% list(), 2L)
})

test_that("B29: disponibilidad vacía o sin bloques = días vacíos declarados, no error", {
  res <- monitoreo_aulas_disponibilidad_bloque(list())
  expect_true(is.list(res[["dias"]]))
  expect_length(res[["dias"]], 0L)
  # Un aplicador sin ningún día con bloques tampoco fabrica días.
  res2 <- monitoreo_aulas_disponibilidad_bloque(list(.marp_apl("Solo Nombre", list())))
  expect_length(res2[["dias"]], 0L)
})

# --- el mount en el dashboard, por la clave de sesión -------------------------

# El plan mínimo que el dashboard normaliza entero (mismo fixture que el mount
# de franjas): agendadas con estado y salón.
.marp_plan_dashboard <- function() list(
  .marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00",
             estado = "agendada", rol = "titular", classroom = "a1")
)

test_that("B29: sin la clave de sesión el dashboard no publica los bloques — y no falla", {
  sid <- session_create()
  res <- monitoreo_aulas_dashboard_cached(
    sid, .marp_plan_dashboard(), data.frame(), list(), token = ""
  )
  expect_true(is.list(res[["dashboard"]]))
  expect_null(res[["dashboard"]][["disponibilidad"]])
  expect_null(res[["dashboard"]][["reparto"]])
})

test_that("B29: con la clave en sesión el dashboard publica `disponibilidad` y su gemelo `reparto`", {
  sid <- session_create()
  session_set(sid, "monitoreo_aulas_disponibilidad", list(
    .marp_apl("Ana Prueba", list(viernes = list(.marp_bloque("08:00", "12:00"))))
  ))
  res <- monitoreo_aulas_dashboard_cached(
    sid, .marp_plan_dashboard(), data.frame(), list(), token = ""
  )
  tablero <- res[["dashboard"]]

  # La oferta: el bloque de la vista, con su malla de 30 minutos.
  bloque <- tablero[["disponibilidad"]]
  expect_true(is.list(bloque))
  viernes <- .madb_dia(bloque, "viernes")
  expect_true(is.list(viernes))
  f <- .madb_franja(viernes, "10:00")
  expect_equal(as.numeric(f[["disponibles"]]), 1)
  expect_identical(as.character(unlist(f[["nombres"]])), "Ana Prueba")

  # La asignación: el reparto del plan contra ESA disponibilidad.
  reparto <- tablero[["reparto"]]
  expect_true(is.list(reparto))
  dia <- .marp_dia(reparto, "2026-09-11")
  expect_true(is.list(dia))
  expect_identical(.marp_asig(dia, "CH 1")[["aplicador"]], "Ana Prueba")
})

test_that("B29: repetible por si llegan nuevas confirmaciones — el reparto del payload incorpora la agendada nueva", {
  # El dictado de la pestaña de asignación: «que sea repetible por si llegan
  # nuevas confirmaciones». Dos pasadas del dashboard sobre la MISMA sesión:
  # entre una y otra el plan gana una agendada, y el bloque `reparto` del
  # payload la trae — recomputado en el conversar, no congelado en la primera
  # foto.
  sid <- session_create()
  session_set(sid, "monitoreo_aulas_disponibilidad",
              list(.marp_full("Ana Prueba"), .marp_full("Berta Ficticia")))

  plan_hoy <- .marp_plan_dashboard()
  pasada1 <- monitoreo_aulas_dashboard_cached(
    sid, plan_hoy, data.frame(), list(), token = ""
  )[["dashboard"]][["reparto"]]
  expect_length(pasada1[["dias"]], 1L)
  expect_true(is.list(.marp_asig(.marp_dia(pasada1, "2026-09-11"), "CH 1")))

  plan_manana <- c(plan_hoy, list(
    .marp_fila("CH 2", fecha = "2026-09-12", hora = "9:00am",
               estado = "agendada", rol = "titular", classroom = "a2")
  ))
  pasada2 <- monitoreo_aulas_dashboard_cached(
    sid, plan_manana, data.frame(), list(), token = ""
  )[["dashboard"]][["reparto"]]
  fechas <- vapply(pasada2[["dias"]], function(d) as.character(d[["fecha"]]), character(1))
  expect_identical(fechas, c("2026-09-11", "2026-09-12"))
  expect_true(is.list(.marp_asig(.marp_dia(pasada2, "2026-09-12"), "CH 2")))
  expect_equal(sum(.marp_equidad(pasada2)), 2)
})

# --- B36: fijadas — el mecanismo propio de asignación y reasignación ---------
#
# Dictado de Gonzalo (2026-09-02): «asegúrate que la asignación se ve mejor,
# que tengo mecanismo propio de asignación y reasignación, que sea equitativo».
# El reparto automático sigue siendo la base; la fijación es la voluntad
# explícita del usuario y MANDA — el motor la aplica siempre, declara con
# `advertencia` lo que la oferta no respalda, y reequilibra el resto
# contándola en la carga.

test_that("B36: la fijada manda sobre el greedy y llega marcada", {
  # «Zoe Tardia» va ÚLTIMA en alfabeto a propósito: el greedy jamás se la
  # daría a CH 1 teniendo a «Ana Prueba» igual de libre — si CH 1 sale con
  # Zoe, fue la fijación y no el azar del empate.
  disp <- list(.marp_full("Ana Prueba"), .marp_full("Zoe Tardia"))
  res <- monitoreo_aulas_reparto(list(
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00")
  ), disp, fijadas = list("CH 1" = "Zoe Tardia"))

  a1 <- .marp_asig(.marp_dia(res, "2026-09-11"), "CH 1")
  expect_true(is.list(a1))
  expect_identical(a1[["aplicador"]], "Zoe Tardia")
  expect_true(isTRUE(a1[["fijada"]]))
  expect_null(a1[["advertencia"]])
  expect_identical(res[["fijadas_sin_cita"]], list())
  # El eco del mapa: la UI reconstruye el mapa COMPLETO al cambiar una cita.
  expect_identical(res[["fijadas"]],
                   list(list(codigo = "CH 1", aplicador = "Zoe Tardia")))
  eq <- .marp_equidad(res)
  expect_equal(unname(eq[["Zoe Tardia"]]), 1)
  expect_equal(unname(eq[["Ana Prueba"]]), 0)
})

test_that("B36: la fijación cuenta en la carga — el resto se reequilibra sobre ella", {
  # CH 1 fijado a Ana; CH 2 (a otra hora) queda para el greedy. Si la
  # fijación NO contara en la carga, el empate 0-0 se rompería por alfabeto y
  # CH 2 también sería de Ana; contándola (Ana=1, Zoe=0), CH 2 es de Zoe.
  disp <- list(.marp_full("Ana Prueba"), .marp_full("Zoe Tardia"))
  res <- monitoreo_aulas_reparto(list(
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"),
    .marp_fila("CH 2", fecha = "2026-09-11", hora = "12:00")
  ), disp, fijadas = list("CH 1" = "Ana Prueba"))

  dia <- .marp_dia(res, "2026-09-11")
  expect_identical(.marp_asig(dia, "CH 1")[["aplicador"]], "Ana Prueba")
  a2 <- .marp_asig(dia, "CH 2")
  expect_identical(a2[["aplicador"]], "Zoe Tardia")
  # La automática viaja con su marca explícita: el front distingue sin adivinar.
  expect_false(isTRUE(a2[["fijada"]]))
  expect_equal(sum(.marp_equidad(res)), 2)
})

test_that("B36: fijada fuera de la oferta se aplica con advertencia — la voluntad manda, el motor declara", {
  # Alba no cubre [10:00, 10:20] y «Perico Externo» ni siquiera está en la
  # disponibilidad: ambas fijaciones se aplican (decisión del usuario) y
  # ambas llegan con su advertencia. Perico entra a la equidad con su carga:
  # sin él, la suma de asignaciones no cuadraría con el resumen.
  disp <- list(
    .marp_apl("Alba Parcial", list(viernes = list(.marp_bloque("09:00", "10:10"))))
  )
  res <- monitoreo_aulas_reparto(list(
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"),
    .marp_fila("CH 2", fecha = "2026-09-11", hora = "12:00")
  ), disp, fijadas = list("CH 1" = "Alba Parcial", "CH 2" = "Perico Externo"))

  dia <- .marp_dia(res, "2026-09-11")
  a1 <- .marp_asig(dia, "CH 1")
  expect_identical(a1[["aplicador"]], "Alba Parcial")
  expect_true(isTRUE(a1[["fijada"]]))
  expect_identical(a1[["advertencia"]], "sin_disponibilidad")
  a2 <- .marp_asig(dia, "CH 2")
  expect_identical(a2[["aplicador"]], "Perico Externo")
  expect_identical(a2[["advertencia"]], "sin_disponibilidad")
  eq <- .marp_equidad(res)
  expect_equal(unname(eq[["Perico Externo"]]), 1)
  # Nada quedó descubierto: la fijación cubre, aunque advierta.
  expect_length(.marp_no_cubiertos(dia), 0)
})

test_that("B36: la fijada ocupa la ventana — el greedy no le pone al mismo aplicador otra aula encima", {
  disp <- list(.marp_full("Ana Prueba"))
  res <- monitoreo_aulas_reparto(list(
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"),
    .marp_fila("CH 2", fecha = "2026-09-11", hora = "10:10")
  ), disp, fijadas = list("CH 1" = "Ana Prueba"))

  dia <- .marp_dia(res, "2026-09-11")
  expect_identical(.marp_asig(dia, "CH 1")[["aplicador"]], "Ana Prueba")
  # [10:10, 10:30] solapa la fijada [10:00, 10:20] y no hay nadie más.
  expect_null(.marp_asig(dia, "CH 2"))
  expect_true("CH 2" %in% .marp_no_cubiertos(dia))
})

test_that("B36: dos fijadas del mismo aplicador que se solapan se aplican y la segunda avisa", {
  disp <- list(.marp_full("Ana Prueba"))
  res <- monitoreo_aulas_reparto(list(
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"),
    .marp_fila("CH 2", fecha = "2026-09-11", hora = "10:10")
  ), disp, fijadas = list("CH 1" = "Ana Prueba", "CH 2" = "Ana Prueba"))

  dia <- .marp_dia(res, "2026-09-11")
  a1 <- .marp_asig(dia, "CH 1")
  a2 <- .marp_asig(dia, "CH 2")
  expect_identical(a1[["aplicador"]], "Ana Prueba")
  expect_null(a1[["advertencia"]])
  expect_identical(a2[["aplicador"]], "Ana Prueba")
  expect_identical(a2[["advertencia"]], "se_solapa")
  expect_equal(unname(.marp_equidad(res)[["Ana Prueba"]]), 2)
})

test_that("B36: la fijación huérfana se declara, no se traga — y la de una cita sin pactar también", {
  disp <- list(.marp_full("Ana Prueba"))
  res <- monitoreo_aulas_reparto(list(
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"),
    .marp_fila("CH 3", fecha = "2026-09-11", hora = "")
  ), disp, fijadas = list(
    "CH 99" = "Ana Prueba",  # nadie con ese código
    "CH 3" = "Ana Prueba"    # existe, pero sin hora pactada: no hay ventana
  ))

  huerfanas <- sort(as.character(unlist(res[["fijadas_sin_cita"]])))
  expect_identical(huerfanas, c("CH 3", "CH 99"))
  # CH 3 sigue en su balde de siempre: por confirmar, no asignada a ciegas.
  expect_true("CH 3" %in% .marp_por_confirmar(.marp_dia(res, "2026-09-11")))
})

test_that("B36: el dashboard cacheado aplica las fijadas del config y cambiarlas invalida la cache", {
  sid <- session_create()
  session_set(sid, "monitoreo_aulas_disponibilidad",
              list(.marp_full("Ana Prueba"), .marp_full("Zoe Tardia")))
  plan <- .marp_plan_dashboard()

  base <- monitoreo_aulas_cache_token("b", plan, list(), scope = "full")
  con_fijada <- monitoreo_aulas_cache_token(
    "b", plan, list(reparto_fijado = list("CH 1" = "Zoe Tardia")), scope = "full"
  )
  # Lección A15: la fijación entra al token con marca de contenido — fijar o
  # soltar invalida aunque los conteos no cambien.
  expect_false(identical(base, con_fijada))

  rep <- monitoreo_aulas_dashboard_cached(
    sid, plan, data.frame(),
    list(reparto_fijado = list("CH 1" = "Zoe Tardia")), token = ""
  )[["dashboard"]][["reparto"]]
  a1 <- .marp_asig(.marp_dia(rep, "2026-09-11"), "CH 1")
  expect_identical(a1[["aplicador"]], "Zoe Tardia")
  expect_true(isTRUE(a1[["fijada"]]))
})

test_that("B75: el rango de despliegue reparte solo lo de dentro y declara lo aplazado", {
  # Dictado 2026-09-03: «quiero distribuir equitativamente entre de este dia
  # a este dia» — desplegar la semana 1 ahora y planear la 2 el jueves.
  disp <- list(.marp_full("Ana Prueba"), .marp_full("Berta Ficticia"))
  plan <- list(
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"),
    .marp_fila("CH 2", fecha = "2026-09-11", hora = "15:00"),
    .marp_fila("CH 3", fecha = "2026-09-18", hora = "10:00"),
    .marp_fila("CH 4", fecha = "2026-09-19")
  )
  res <- monitoreo_aulas_reparto(plan, disp,
                                 rango = list(desde = "2026-09-07", hasta = "2026-09-13"))

  # Dentro: solo el 11/09, con sus dos citas repartidas.
  fechas <- vapply(res[["dias"]], function(d) as.character(d[["fecha"]]), character(1))
  expect_identical(fechas, "2026-09-11")
  expect_length(.marp_dia(res, "2026-09-11")[["asignaciones"]], 2L)

  # Fuera: declarado por fecha — la cita pactada Y la fecha sin hora.
  fuera <- res[["fuera_de_rango"]]
  expect_length(fuera, 2L)
  expect_identical(fuera[[1]][["fecha"]], "2026-09-18")
  expect_identical(unlist(fuera[[1]][["codigos"]]), "CH 3")
  expect_identical(fuera[[2]][["fecha"]], "2026-09-19")
  expect_identical(unlist(fuera[[2]][["por_confirmar"]]), "CH 4")

  # La equidad cuenta SOLO la tanda: 2 citas entre 2 personas.
  eq <- .marp_equidad(res)
  expect_equal(sum(eq), 2)

  # El eco del rango saneado viaja.
  expect_identical(res[["rango"]], list(desde = "2026-09-07", hasta = "2026-09-13"))
})

test_that("B75: desde > hasta se corrige por intercambio; basura = todo el horizonte", {
  disp <- list(.marp_full("Ana Prueba"))
  plan <- list(.marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"))

  invertido <- monitoreo_aulas_reparto(plan, disp,
                                       rango = list(desde = "2026-09-13", hasta = "2026-09-07"))
  expect_length(invertido[["dias"]], 1L)
  expect_identical(invertido[["rango"]], list(desde = "2026-09-07", hasta = "2026-09-13"))

  basura <- monitoreo_aulas_reparto(plan, disp,
                                    rango = list(desde = "proxima semana", hasta = ""))
  expect_length(basura[["dias"]], 1L)
  expect_null(basura[["rango"]])
  expect_null(basura[["fuera_de_rango"]])
})

test_that("B75: la fijacion de una cita aplazada NO es huerfana y no cuenta en la tanda", {
  disp <- list(.marp_full("Ana Prueba"))
  plan <- list(
    .marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"),
    .marp_fila("CH 3", fecha = "2026-09-18", hora = "10:00")
  )
  res <- monitoreo_aulas_reparto(plan, disp,
                                 fijadas = list("CH 3" = "Ana Prueba"),
                                 rango = list(desde = "2026-09-07", hasta = "2026-09-13"))
  # Su cita existe (solo espera otra tanda): no cae a fijadas_sin_cita...
  expect_length(res[["fijadas_sin_cita"]], 0L)
  # ...el eco del mapa la conserva para cuando el rango avance...
  expect_identical(res[["fijadas"]][[1]][["codigo"]], "CH 3")
  # ...y la carga de la tanda no la cuenta.
  eq <- .marp_equidad(res)
  expect_equal(unname(eq[["Ana Prueba"]]), 1)
})

test_that("B67: la semilla rota el desempate — otro sorteo, misma equidad, fijadas intactas", {
  # Dictado 2026-09-03: «no tengo una forma de hacer un resorteo». Dos
  # aplicadores full-time y una cita: con semilla 0 el empate 0-0 lo gana el
  # alfabeto (Ana); con semilla 1 la prioridad rota y gana Berta.
  disp <- list(.marp_full("Ana Prueba"), .marp_full("Berta Ficticia"))
  plan <- list(.marp_fila("CH 1", fecha = "2026-09-11", hora = "10:00"))

  base <- monitoreo_aulas_reparto(plan, disp)
  expect_identical(.marp_asig(.marp_dia(base, "2026-09-11"), "CH 1")[["aplicador"]],
                   "Ana Prueba")
  expect_identical(base[["semilla"]], 0L)

  rotado <- monitoreo_aulas_reparto(plan, disp, semilla = 1L)
  expect_identical(.marp_asig(.marp_dia(rotado, "2026-09-11"), "CH 1")[["aplicador"]],
                   "Berta Ficticia")
  expect_identical(rotado[["semilla"]], 1L)

  # Determinismo del sorteo: la misma semilla produce el mismo reparto.
  expect_identical(monitoreo_aulas_reparto(plan, disp, semilla = 1L), rotado)

  # La equidad no cambia de forma: mismo total y mismo max-min.
  eqb <- .marp_equidad(base); eqr <- .marp_equidad(rotado)
  expect_equal(sum(eqb), sum(eqr))
  expect_equal(max(eqb) - min(eqb), max(eqr) - min(eqr))

  # La fijada manda por encima de cualquier semilla.
  fij <- monitoreo_aulas_reparto(plan, disp,
                                 fijadas = list("CH 1" = "Ana Prueba"), semilla = 1L)
  expect_identical(.marp_asig(.marp_dia(fij, "2026-09-11"), "CH 1")[["aplicador"]],
                   "Ana Prueba")
  expect_true(isTRUE(.marp_asig(.marp_dia(fij, "2026-09-11"), "CH 1")[["fijada"]]))

  # Basura o negativo caen al alfabeto de siempre, sin romper.
  expect_identical(monitoreo_aulas_reparto(plan, disp, semilla = -3)[["semilla"]], 0L)
  expect_identical(monitoreo_aulas_reparto(plan, disp, semilla = "x")[["semilla"]], 0L)
})
