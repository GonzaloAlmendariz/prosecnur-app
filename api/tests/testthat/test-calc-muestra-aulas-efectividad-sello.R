# El multiplicador por facultad se sella desde el histórico.
#
# Antes de esto `cfg$efectividad` era NULL en los SEIS `.pulso` del repo y
# `factor_facultad` valía 1 en las 5.269 filas del marco: las quince facultades
# dimensionaban con la misma tasa mientras la UI afirmaba que el factor «YA está
# dentro de la tasa que dimensiona».

.sello_esc <- function(estado, efectivas, elegibles) {
  list(estado = estado, efectivas = efectivas, elegibles = elegibles)
}
.sello_cadena <- function(facultad, escalones) {
  list(facultad = facultad, escalones = escalones)
}
# k aulas idénticas de `elegibles` alumnos que rindieron `efectivas` cada una.
.sello_facultad <- function(nombre, k, elegibles, efectivas) {
  .sello_cadena(nombre, lapply(seq_len(k), function(i) .sello_esc("aplicado", efectivas, elegibles)))
}

test_that("el multiplicador es observado sobre esperado, ponderado por elegibles", {
  # Doce aulas de 30 elegibles que rindieron exactamente lo que la curva predice
  # para ese tamaño: el multiplicador tiene que ser 1, no «casi 1».
  esperado_30 <- .cm_efectividad_rendimiento(30)
  filas <- list(.sello_facultad("DERECHO", 12, 30, 30 * esperado_30))
  sello <- calc_muestra_aulas_sello_por_facultad(filas)
  expect_named(sello, "derecho")
  expect_equal(sello$derecho$tau, 1, tolerance = 1e-9)
  expect_identical(sello$derecho$k, 12L)
})

test_that("rendir por encima de la curva da un multiplicador mayor que uno", {
  esperado_30 <- .cm_efectividad_rendimiento(30)
  filas <- list(.sello_facultad("DERECHO", 12, 30, 30 * esperado_30 * 1.2))
  sello <- calc_muestra_aulas_sello_por_facultad(filas)
  expect_equal(sello$derecho$tau, 1.2, tolerance = 1e-6)
})

test_that("las aulas grandes pesan lo que aportan, no una por una", {
  # Una facultad con aulas de dos tamaños: si el esperado se promediara sin
  # ponderar, la de 5 alumnos pesaría igual que la de 100. El ponderado por
  # elegibles es la decisión de Gonzalo (2026-08-25).
  e5 <- .cm_efectividad_rendimiento(5)
  e100 <- .cm_efectividad_rendimiento(100)
  chicas <- lapply(seq_len(6), function(i) .sello_esc("aplicado", 5 * e5, 5))
  grandes <- lapply(seq_len(6), function(i) .sello_esc("aplicado", 100 * e100, 100))
  sello <- calc_muestra_aulas_sello_por_facultad(list(.sello_cadena("DERECHO", c(chicas, grandes))))
  # Cada aula rindió su esperado, así que el multiplicador es 1 con CUALQUIER
  # ponderación; lo que fija la aritmética es el esperado publicado.
  expect_equal(sello$derecho$tau, 1, tolerance = 1e-9)
  esperado_ponderado <- (6 * 5 * e5 + 6 * 100 * e100) / (6 * 5 + 6 * 100)
  expect_equal(sello$derecho$esperado, esperado_ponderado, tolerance = 1e-9)
})

test_that("con once aulas no se publica: el neutro es no llevar entrada", {
  esperado_30 <- .cm_efectividad_rendimiento(30)
  filas <- list(.sello_facultad("PSICOLOGÍA", 11, 30, 30 * esperado_30 * 1.5))
  expect_length(calc_muestra_aulas_sello_por_facultad(filas), 0L)
})

test_that("los escalones que no se aplicaron no contaminan", {
  esperado_30 <- .cm_efectividad_rendimiento(30)
  aplicados <- lapply(seq_len(12), function(i) .sello_esc("aplicado", 30 * esperado_30, 30))
  caido <- .sello_esc("caido", 999, 999)
  sello <- calc_muestra_aulas_sello_por_facultad(list(.sello_cadena("DERECHO", c(aplicados, list(caido)))))
  expect_equal(sello$derecho$tau, 1, tolerance = 1e-9)
  expect_identical(sello$derecho$k, 12L)
})

test_that("sellar deja tau_base en 1 porque lo guardado ES el multiplicador", {
  esperado_30 <- .cm_efectividad_rendimiento(30)
  ref <- list(cadenas_reemplazo = list(filas = list(
    .sello_facultad("DERECHO", 12, 30, 30 * esperado_30 * 1.1)
  )))
  cfg <- calc_muestra_aulas_sellar_efectividad(list(), ref)
  expect_identical(cfg$efectividad$fuente, "historico")
  expect_identical(cfg$efectividad$tau_base, 1)
  expect_length(cfg$efectividad$por_facultad, 1L)
  expect_equal(cfg$efectividad$por_facultad[[1]]$tau, 1.1, tolerance = 1e-6)
  expect_true(isTRUE(cfg$efectividad$por_facultad[[1]]$aplicar))
})

test_that("una declaracion explicita del estudio manda sobre la derivada", {
  esperado_30 <- .cm_efectividad_rendimiento(30)
  ref <- list(cadenas_reemplazo = list(filas = list(
    .sello_facultad("DERECHO", 12, 30, 30 * esperado_30 * 1.1)
  )))
  previa <- list(efectividad = list(
    fuente = "historico", tau_base = 1,
    por_facultad = list(list(facultad = "DERECHO", tau = 0.5, k = 99L, aplicar = TRUE))
  ))
  cfg <- calc_muestra_aulas_sellar_efectividad(previa, ref)
  expect_equal(cfg$efectividad$por_facultad[[1]]$tau, 0.5)
})

test_that("sin historico no se inventa sello", {
  expect_null(calc_muestra_aulas_sellar_efectividad(list(), NULL)$efectividad)
  expect_null(calc_muestra_aulas_sellar_efectividad(list(), list())$efectividad)
})

# --- Segundo eslabón: del marco al estrato del cálculo ------------------------
#
# Los estratos viven en `comp$marco$estratos`. Un primer intento los buscó en
# `comp$estratos`, no encontró nada y se retiró por código muerto; este test
# fija la ruta para que el error no se repita.

.tau_estudio <- function(...) {
  list(componentes = list(list(marco = list(estratos = list(...)))))
}

test_that("la tasa del marco baja al estrato que no declara la suya", {
  frame <- list(tasas_efectividad_facultad = list(
    list(facultad = "DERECHO", tasa = 0.562),
    list(facultad = "ESTUDIOS GENERALES CIENCIAS", tasa = 0.436)
  ))
  est <- .tau_estudio(
    list(label = "DERECHO", tau = 0),
    list(label = "ESTUDIOS GENERALES CIENCIAS", tau = 0)
  )
  out <- calc_muestra_aulas_resolver_tau_estratos(est, frame)
  expect_equal(out$componentes[[1]]$marco$estratos[[1]]$tau, 0.562)
  expect_equal(out$componentes[[1]]$marco$estratos[[2]]$tau, 0.436)
})

test_that("no se escribe en comp$estratos, que es otra ruta", {
  # Si alguien mueve la lectura a `comp$estratos` este test lo caza: ahí no hay
  # estratos y el τ se quedaría en 0 para las quince facultades.
  frame <- list(tasas_efectividad_facultad = list(list(facultad = "DERECHO", tasa = 0.562)))
  est <- list(componentes = list(list(estratos = list(list(label = "DERECHO", tau = 0)))))
  out <- calc_muestra_aulas_resolver_tau_estratos(est, frame)
  expect_equal(out$componentes[[1]]$estratos[[1]]$tau, 0)
})

# CONTRATO CAMBIADO EL 2026-08-28. Antes decía «un estrato que ya declara su tau
# manda sobre el marco» y fijaba que un campo lleno frenaba el refresco. Pero
# esta función es el ÚNICO escritor de `e$tau` en el motor —el frontend sólo lo
# lee—, así que ese «declarado» nunca era una declaración: era su propio valor
# de la corrida anterior, y la τ quedaba congelada para siempre en el primer
# marco con el que se calculó. Medido en HSVG2026: sus quince τ salían del marco
# de HSVG26DEF (1 632 aulas) con el vigente en 1 392.
test_that("un tau puesto por el motor NO frena el refresco: se recalcula", {
  frame <- list(tasas_efectividad_facultad = list(list(facultad = "DERECHO", tasa = 0.562)))
  out <- calc_muestra_aulas_resolver_tau_estratos(.tau_estudio(list(label = "DERECHO", tau = 0.9)), frame)
  expect_equal(out$componentes[[1]]$marco$estratos[[1]]$tau, 0.562)
  expect_identical(out$componentes[[1]]$marco$estratos[[1]]$tau_origen, "marco")
})

test_that("una facultad sin tasa publicada se queda en cero y cae al global", {
  frame <- list(tasas_efectividad_facultad = list(list(facultad = "DERECHO", tasa = 0.562)))
  out <- calc_muestra_aulas_resolver_tau_estratos(.tau_estudio(list(label = "PSICOLOGÍA", tau = 0)), frame)
  expect_equal(out$componentes[[1]]$marco$estratos[[1]]$tau, 0)
})

test_that("una tasa fuera de rango no se baja", {
  frame <- list(tasas_efectividad_facultad = list(
    list(facultad = "DERECHO", tasa = 1.4), list(facultad = "EDUCACION", tasa = 0)))
  out <- calc_muestra_aulas_resolver_tau_estratos(
    .tau_estudio(list(label = "DERECHO", tau = 0), list(label = "EDUCACION", tau = 0)), frame)
  expect_equal(out$componentes[[1]]$marco$estratos[[1]]$tau, 0)
  expect_equal(out$componentes[[1]]$marco$estratos[[2]]$tau, 0)
})

test_that("sin marco el estudio sale intacto", {
  est <- .tau_estudio(list(label = "DERECHO", tau = 0))
  expect_identical(calc_muestra_aulas_resolver_tau_estratos(est, NULL), est)
  expect_identical(calc_muestra_aulas_resolver_tau_estratos(est, list()), est)
})

# --- Lo que baja del marco vuelve a 0 cuando el marco deja de publicarlo ------
#
# UNSA 2026, 2026-10-14: el estudio pasó a `tau_global = 0,50`, el marco dejó de
# publicar tasas y los estratos siguieron con las de la calibración anterior.
# Complementa el bloque «La tau del estrato se REFRESCA» de más abajo, que fija
# el vocabulario: `"marco"` lo escribe el motor, `"manual"` lo declara una
# persona, y un τ sin campo (anterior a él) se refresca cuando HAY tasa vigente.

.tau_global_frame <- function() list(
  tasas_efectividad_facultad = list(),
  config = list(efectividad = list(fuente = "tau_global", tau = 0.5))
)

test_that("el tau que baja del marco queda marcado como derivado", {
  frame <- list(tasas_efectividad_facultad = list(list(facultad = "DERECHO", tasa = 0.562)))
  out <- calc_muestra_aulas_resolver_tau_estratos(.tau_estudio(list(label = "DERECHO", tau = 0)), frame)
  expect_identical(out$componentes[[1]]$marco$estratos[[1]]$tau_origen, "marco")
})

test_that("un tau derivado vuelve a cero si el marco deja de publicar su tasa", {
  frame <- list(frame_hash = "h2",
                tasas_efectividad_facultad = list(list(facultad = "OTRA", tasa = 0.7)))
  out <- calc_muestra_aulas_resolver_tau_estratos(
    .tau_estudio(list(label = "DERECHO", tau = 0.562, tau_origen = "marco",
                      tau_frame_hash = "h1")), frame)
  e <- out$componentes[[1]]$marco$estratos[[1]]
  expect_equal(e$tau, 0)
  expect_identical(e$tau_origen, "")
  expect_identical(e$tau_frame_hash, "")
})

# Con `tau_global` el respaldo es la tasa DECLARADA (`efectividad$tau`), no
# `parametros$tau`: es la que el marco usó para el rendimiento de cada aula.
test_that("con tau_global el tau derivado pasa a la tasa declarada", {
  out <- calc_muestra_aulas_resolver_tau_estratos(
    .tau_estudio(list(label = "DERECHO", tau = 0.5534, tau_origen = "marco")), .tau_global_frame())
  e <- out$componentes[[1]]$marco$estratos[[1]]
  expect_equal(e$tau, 0.5)
  expect_identical(e$tau_origen, "marco")
  expect_equal(e$tau_reseteado_desde, 0.5534)
})

test_that("con tau_global un tau antiguo sin origen tampoco sobrevive", {
  # Es el caso medido: los estratos de UNSA traían 0,5534 sin `tau_origen`.
  out <- calc_muestra_aulas_resolver_tau_estratos(
    .tau_estudio(list(label = "ADMINISTRACION", tau = 0.5534)), .tau_global_frame())
  expect_equal(out$componentes[[1]]$marco$estratos[[1]]$tau, 0.5)
})

test_that("con tau_global aunque el marco no traiga el campo de tasas", {
  frame <- list(config = list(efectividad = list(fuente = "tau_global", tau = 0.5)))
  out <- calc_muestra_aulas_resolver_tau_estratos(
    .tau_estudio(list(label = "DERECHO", tau = 0.61, tau_origen = "marco")), frame)
  expect_equal(out$componentes[[1]]$marco$estratos[[1]]$tau, 0.5)
})

test_that("con tau_global sin tasa declarada válida el respaldo es el global (0)", {
  frame <- list(config = list(efectividad = list(fuente = "tau_global", tau = 1.4)))
  out <- calc_muestra_aulas_resolver_tau_estratos(
    .tau_estudio(list(label = "DERECHO", tau = 0.61, tau_origen = "marco")), frame)
  e <- out$componentes[[1]]$marco$estratos[[1]]
  expect_equal(e$tau, 0)
  expect_identical(e$tau_origen, "")
})

test_that("un hash distinto con el marco que sí publica la tasa reescribe tau y hash", {
  frame <- list(frame_hash = "h-nuevo",
                tasas_efectividad_facultad = list(list(facultad = "DERECHO", tasa = 0.48)))
  out <- calc_muestra_aulas_resolver_tau_estratos(
    .tau_estudio(list(label = "DERECHO", tau = 0.562, tau_origen = "marco",
                      tau_frame_hash = "h-viejo", tau_reseteado_desde = 0.7)), frame)
  e <- out$componentes[[1]]$marco$estratos[[1]]
  expect_equal(e$tau, 0.48)
  expect_identical(e$tau_frame_hash, "h-nuevo")
  expect_null(e$tau_reseteado_desde)
})

test_that("tasas vacías sin tau_global: «marco» va a 0 y sin origen se queda", {
  frame <- list(tasas_efectividad_facultad = list())
  out <- calc_muestra_aulas_resolver_tau_estratos(.tau_estudio(
    list(label = "DERECHO", tau = 0.562, tau_origen = "marco"),
    list(label = "MEDICINA", tau = 0.6)
  ), frame)
  es <- out$componentes[[1]]$marco$estratos
  expect_equal(es[[1]]$tau, 0)
  expect_identical(es[[1]]$tau_origen, "")
  expect_equal(es[[2]]$tau, 0.6)
  expect_null(es[[2]]$tau_origen)
})

test_that("una tasa fuera de rango (0, >1, NA) con τ «marco» resetea", {
  for (tasa in list(0, 1.4, NA_real_)) {
    frame <- list(tasas_efectividad_facultad = list(list(facultad = "DERECHO", tasa = tasa)))
    out <- calc_muestra_aulas_resolver_tau_estratos(
      .tau_estudio(list(label = "DERECHO", tau = 0.562, tau_origen = "marco")), frame)
    e <- out$componentes[[1]]$marco$estratos[[1]]
    expect_equal(e$tau, 0, info = paste("tasa", tasa))
    expect_equal(e$tau_reseteado_desde, 0.562, info = paste("tasa", tasa))
  }
})

test_that("un estrato que ya estaba en el respaldo no se vuelve a marcar", {
  frame <- list(tasas_efectividad_facultad = list())
  out <- calc_muestra_aulas_resolver_tau_estratos(
    .tau_estudio(list(label = "DERECHO", tau = 0, tau_reseteado_desde = 0.562)), frame)
  # El aviso persiste mientras siga en el respaldo.
  expect_equal(out$componentes[[1]]$marco$estratos[[1]]$tau_reseteado_desde, 0.562)
  # Y una declaración manual lo borra.
  out2 <- calc_muestra_aulas_resolver_tau_estratos(.tau_estudio(
    list(label = "DERECHO", tau = 0.5, tau_origen = "manual", tau_reseteado_desde = 0.562)), frame)
  expect_null(out2$componentes[[1]]$marco$estratos[[1]]$tau_reseteado_desde)
})

test_that("un tau manual manda también con tau_global", {
  out <- calc_muestra_aulas_resolver_tau_estratos(
    .tau_estudio(list(label = "DERECHO", tau = 0.7, tau_origen = "manual")), .tau_global_frame())
  e <- out$componentes[[1]]$marco$estratos[[1]]
  expect_equal(e$tau, 0.7)
  expect_identical(e$tau_origen, "manual")
})

test_that("un tau antiguo igual a la tasa vigente pasa a derivado sin cambiar", {
  frame <- list(tasas_efectividad_facultad = list(list(facultad = "DERECHO", tasa = 0.562)))
  out <- calc_muestra_aulas_resolver_tau_estratos(.tau_estudio(list(label = "DERECHO", tau = 0.562)), frame)
  e <- out$componentes[[1]]$marco$estratos[[1]]
  expect_equal(e$tau, 0.562)
  expect_identical(e$tau_origen, "marco")
})

test_that("el normalizador del motor conserva la procedencia del tau y descarta lo desconocido", {
  # Sin esto la declaración `manual` no sobrevivía al guardado del estudio.
  est <- .cm_normalize_estratos(list(
    list(label = "DERECHO", N = 100, tau = 0.5, tau_origen = "marco", tau_frame_hash = "h"),
    list(label = "MEDICINA", N = 100, tau = 0.5, tau_origen = "manual"),
    list(label = "LETRAS", N = 100, tau = 0.5, tau_origen = "declarado")
  ))
  expect_identical(est[[1]]$tau_origen, "marco")
  expect_identical(est[[1]]$tau_frame_hash, "h")
  expect_identical(est[[2]]$tau_origen, "manual")
  expect_identical(est[[3]]$tau_origen, "")
})

test_that("de punta a punta: con tau_global el motor dimensiona con el tau del diseño", {
  # El estrato trae el 0,8 de la calibración anterior. Sin el resolver el motor
  # pide ceiling(100 / (20 * 0,8)) = 7 aulas; con él, el τ del diseño (0,5):
  # ceiling(100 / (20 * 0,5)) = 10.
  comp <- list(
    id = "c1", actor = "Universidad", actor_id = "estudiantes_universidad",
    actor_categoria = "otros", canal_recojo = "aula_qr",
    tecnica = "prob_conglomerado_multietapico",
    marco = list(estado = "validado", estratos = list(list(
      label = "FAC A", N = 1000L, N_a = 500L, N_b = 500L,
      promedio_conglomerado = 20, tau = 0.8, tau_origen = "marco"
    ))),
    parametros = list(p = 0.5, z = 1.96, e = 0.1, deff = 1, tau = 0.5,
                      promedio_conglomerado = 20, oversample_pct = 0),
    meta = list(tipo = "objetivo", valor = 100L)
  )
  est <- list(macro_familia = "encuesta_estudiantes",
              workspace = list(frame_mode = "opinion_universitaria"),
              componentes = list(comp))
  aulas <- function(e) calc_muestra_calcular_estudio(e)$componentes[[1]]$resultado$aulas_por_estrato[[1]]
  expect_identical(aulas(est)$aulas_formula, 7L)
  resuelto <- aulas(calc_muestra_aulas_resolver_tau_estratos(est, .tau_global_frame()))
  expect_equal(resuelto$tau, 0.5)
  expect_identical(resuelto$aulas_formula, 10L)
})

.tau_e2e_estudio <- function(tau_estrato = 0.8, tau_par = 0.5) {
  comp <- list(
    id = "c1", actor = "Universidad", actor_id = "estudiantes_universidad",
    actor_categoria = "otros", canal_recojo = "aula_qr",
    tecnica = "prob_conglomerado_multietapico",
    marco = list(estado = "validado", estratos = list(list(
      label = "FAC A", N = 1000L, N_a = 500L, N_b = 500L,
      promedio_conglomerado = 20, tau = tau_estrato, tau_origen = "marco"
    ))),
    parametros = list(p = 0.5, z = 1.96, e = 0.1, deff = 1, tau = tau_par,
                      promedio_conglomerado = 20, oversample_pct = 0),
    meta = list(tipo = "objetivo", valor = 100L)
  )
  list(macro_familia = "encuesta_estudiantes",
       workspace = list(frame_mode = "opinion_universitaria"),
       componentes = list(comp))
}

test_that("el reseteo se publica en resultado$tau_reseteados", {
  frame <- list(tasas_efectividad_facultad = list())
  res <- calc_muestra_calcular_estudio(
    calc_muestra_aulas_resolver_tau_estratos(.tau_e2e_estudio(0.8, 0.5), frame)
  )$componentes[[1]]$resultado
  expect_length(res$tau_reseteados, 1L)
  expect_identical(res$tau_reseteados[[1]]$facultad, "FAC A")
  expect_equal(res$tau_reseteados[[1]]$tau_anterior, 0.8)
  expect_equal(res$tau_reseteados[[1]]$tau_vigente, 0.5)
  # Sin reseteo, la lista va vacía.
  sin <- calc_muestra_calcular_estudio(.tau_e2e_estudio(0.8, 0.5))$componentes[[1]]$resultado
  expect_length(sin$tau_reseteados, 0L)
})

test_that("con tau_global y parametros$tau distinto dimensiona con la tasa declarada", {
  # Diseño en 0,5, declarada 0,4: ceiling(100 / (20 * 0,4)) = 13, no 10.
  frame <- list(tasas_efectividad_facultad = list(),
                config = list(efectividad = list(fuente = "tau_global", tau = 0.4)))
  fila <- calc_muestra_calcular_estudio(
    calc_muestra_aulas_resolver_tau_estratos(.tau_e2e_estudio(0.8, 0.5), frame)
  )$componentes[[1]]$resultado$aulas_por_estrato[[1]]
  expect_equal(fila$tau, 0.4)
  expect_identical(fila$aulas_formula, 13L)
})

# --- Una referencia sin cadenas de reemplazo no puede tumbar el endpoint ------
#
# `cadenas_reemplazo` no viene ausente cuando no hay datos: viene `NA`, un
# logical de longitud 1. `referencia$cadenas_reemplazo$filas` sobre eso no
# devuelve NULL — LANZA «$ operator is invalid for atomic vectors», y `%||%` no
# lo atrapa porque sólo mira el NULL.
#
# El sellador corre en `POST /api/calc-muestra/marco/construir` FUERA de sus dos
# tryCatch, así que el usuario recibía un 500 E_INTERNAL —sin mensaje, sólo un
# `error_id`— en cuanto había cargado la referencia histórica de asistencia. Es
# el caso normal de una base que trae asistencia y no reemplazos.

test_that("una referencia con `cadenas_reemplazo` atómico no lanza: devuelve la config intacta", {
  cfg <- list(efectividad = NULL, alumnos_por_ch = 30)
  for (valor in list(NA, NA_character_, "", 0L, c(1, 2), TRUE)) {
    ref <- list(periodo = "2025-II", cadenas_reemplazo = valor)
    expect_silent(out <- calc_muestra_aulas_sellar_efectividad(cfg, ref))
    expect_identical(out, cfg)
  }
  # Y el NULL de siempre sigue igual.
  expect_identical(
    calc_muestra_aulas_sellar_efectividad(cfg, list(cadenas_reemplazo = NULL)), cfg)
  expect_identical(calc_muestra_aulas_sellar_efectividad(cfg, NULL), cfg)
})

# --- La curva por tramo, que hasta ahora tenía lector y no tenía escritor ----
#
# `cfg$efectividad$rendimiento_tramos` lo lee el motor desde que se escribió y
# de ahí sale `rendimiento_ref`, pero nadie lo producía: de las dos mitades del
# plan 1b se construyó sólo el multiplicador por facultad. Sin sello rige la
# calibración embebida, que el propio archivo declara «de otra ola».

# Un tramo con `k` aulas de `elegibles` que rindieron `tasa` cada una.
.sello_tramo_aulas <- function(k, elegibles, tasa) {
  lapply(seq_len(k), function(i) .sello_esc("aplicado", elegibles * tasa, elegibles))
}
# Los cinco tramos con respaldo de sobra y una tasa distinta y reconocible cada uno.
.sello_cadenas_cinco <- function(k = 12L, tasas = c(0.80, 0.70, 0.60, 0.50, 0.40)) {
  tam <- c(10, 20, 30, 40, 60)   # uno dentro de cada tramo: <=15, 16-25, 26-35, 36-50, >50
  list(.sello_cadena("UNA", unlist(
    lapply(seq_along(tam), function(i) .sello_tramo_aulas(k, tam[i], tasas[i])),
    recursive = FALSE)))
}

test_that("la curva por tramo sale de la razon de sumas del historico", {
  tr <- calc_muestra_aulas_sello_tramos(.sello_cadenas_cinco())
  expect_length(tr, 5L)
  expect_equal(vapply(tr, `[[`, 0, "tasa"), c(0.80, 0.70, 0.60, 0.50, 0.40))
  # Bordes ascendentes y el último abierto, que es lo que el lector exige.
  expect_equal(vapply(tr, function(x) x$hasta, 0), c(15, 25, 35, 50, NA_real_))
})

test_that("aulas de distinto tamano dentro de un tramo se agregan por razon de sumas", {
  # Un tramo con dos aulas muy distintas: 10 de 0,90 y 40 de 0,40 dentro del
  # mismo bin no dan el promedio simple (0,65) sino 13/50 = 0,26... la razón de
  # sumas pondera por elegibles, que es la regla declarada.
  mezcla <- c(.sello_tramo_aulas(6L, 26, 0.90), .sello_tramo_aulas(6L, 35, 0.40))
  base <- .sello_cadenas_cinco()[[1L]]$escalones
  # se reemplaza el tercer tramo (26-35) por la mezcla
  sin_t3 <- Filter(function(e) e$elegibles != 30, base)
  tr <- calc_muestra_aulas_sello_tramos(list(.sello_cadena("UNA", c(sin_t3, mezcla))))
  esperado <- (6 * 26 * 0.90 + 6 * 35 * 0.40) / (6 * 26 + 6 * 35)
  expect_equal(tr[[3L]]$tasa, round(esperado, 4))
})

test_that("si a UN tramo le falta respaldo no se sella NINGUNO", {
  # Cuatro tramos con doce aulas y el quinto con once: sellar cuatro correría
  # los bordes y reasignaría en silencio las aulas del ausente al vecino.
  flojo <- list(.sello_cadena("UNA", c(
    unlist(lapply(c(10, 20, 30, 40), function(t) .sello_tramo_aulas(12L, t, 0.6)), recursive = FALSE),
    .sello_tramo_aulas(11L, 60, 0.4)
  )))
  expect_length(calc_muestra_aulas_sello_tramos(flojo), 0L)
  # Con la doceava sí sella: la guarda es el umbral y nada más.
  expect_length(calc_muestra_aulas_sello_tramos(.sello_cadenas_cinco(k = 12L)), 5L)
})

test_that("una tasa fuera de (0, 1] no se sella capada: no se sella", {
  # El lector rechaza `tasa > 1` y correría los bordes. Mejor no sellar.
  malo <- .sello_cadenas_cinco(tasas = c(0.80, 1.20, 0.60, 0.50, 0.40))
  expect_length(calc_muestra_aulas_sello_tramos(malo), 0L)
})

test_that("sellar la efectividad incorpora la curva junto al multiplicador", {
  cfg <- calc_muestra_aulas_normalize_config(list())
  ref <- list(cadenas_reemplazo = list(filas = .sello_cadenas_cinco()))
  out <- calc_muestra_aulas_sellar_efectividad(cfg, ref)
  expect_identical(out$efectividad$fuente, "historico")
  expect_length(out$efectividad$rendimiento_tramos, 5L)
  # Y el lector del motor los acepta tal cual salen del escritor.
  cal <- .cm_efectividad_calibracion(calc_muestra_aulas_normalize_config(out))
  expect_length(cal$rendimiento_tramos, 5L)
  expect_equal(.cm_efectividad_rendimiento(40, cal$rendimiento_tramos), 0.50)
})

test_that("una curva declarada por el estudio manda sobre la derivada", {
  propia <- list(list(hasta = 30, tasa = 0.9), list(hasta = NA_real_, tasa = 0.1))
  cfg <- calc_muestra_aulas_normalize_config(list(efectividad = list(
    fuente = "historico", rendimiento_tramos = propia
  )))
  out <- calc_muestra_aulas_sellar_efectividad(cfg, list(
    cadenas_reemplazo = list(filas = .sello_cadenas_cinco())
  ))
  expect_length(out$efectividad$rendimiento_tramos, 2L)
  expect_equal(out$efectividad$rendimiento_tramos[[1L]]$tasa, 0.9)
})

# --- La curva sellada publica su respaldo ------------------------------------

test_that("cada tramo sellado dice de cuantas aulas sale", {
  tr <- calc_muestra_aulas_sello_tramos(.sello_cadenas_cinco(k = 14L))
  expect_equal(vapply(tr, `[[`, 0L, "k"), rep(14L, 5L))
  # Y el respaldo SOBREVIVE al lector: una curva sin procedencia es
  # indistinguible de una constante escrita a mano.
  cfg <- calc_muestra_aulas_normalize_config(list(efectividad = list(
    fuente = "historico", tau_base = 1, rendimiento_tramos = tr
  )))
  expect_equal(vapply(cfg$efectividad$rendimiento_tramos, `[[`, 0L, "k"), rep(14L, 5L))
})

test_that("un sello viejo sin k se lee igual y publica NA, no un cero", {
  viejo <- list(list(hasta = 30, tasa = 0.7), list(hasta = NA_real_, tasa = 0.4))
  cfg <- calc_muestra_aulas_normalize_config(list(efectividad = list(
    fuente = "historico", tau_base = 1, rendimiento_tramos = viejo
  )))
  ks <- vapply(cfg$efectividad$rendimiento_tramos, `[[`, 0L, "k")
  expect_true(all(is.na(ks)))
  expect_equal(vapply(cfg$efectividad$rendimiento_tramos, `[[`, 0, "tasa"), c(0.7, 0.4))
})

# --- La tau del estrato se REFRESCA, y declara de donde sale -----------------

.taurf_estudio <- function(tau = 0, origen = NULL) {
  e <- list(label = "DERECHO", tau = tau)
  if (!is.null(origen)) e$tau_origen <- origen
  list(componentes = list(list(marco = list(estratos = list(e)))))
}
.taurf_frame <- function(tasa = 0.61, hash = "hash-nuevo") list(
  frame_hash = hash,
  tasas_efectividad_facultad = list(list(facultad = "DERECHO", tasa = tasa))
)
.taurf_de <- function(est) est$componentes[[1]]$marco$estratos[[1]]

test_that("una tau vieja del motor se refresca con el marco vigente", {
  # Este era el defecto: la funcion es el UNICO escritor de e$tau, asi que un
  # campo lleno no era una declaracion, era su propio valor anterior — y
  # frenaba el refresco para siempre.
  est <- calc_muestra_aulas_resolver_tau_estratos(.taurf_estudio(tau = 0.55), .taurf_frame(0.61))
  e <- .taurf_de(est)
  expect_equal(e$tau, 0.61)
  expect_identical(e$tau_origen, "marco")
  expect_identical(e$tau_frame_hash, "hash-nuevo")
})

test_that("una tau declarada a mano se respeta, y solo esa", {
  est <- calc_muestra_aulas_resolver_tau_estratos(
    .taurf_estudio(tau = 0.55, origen = "manual"), .taurf_frame(0.61)
  )
  expect_equal(.taurf_de(est)$tau, 0.55)
  expect_identical(.taurf_de(est)$tau_origen, "manual")

  # Y la marca del propio motor NO frena nada: es la que hay que refrescar.
  est2 <- calc_muestra_aulas_resolver_tau_estratos(
    .taurf_estudio(tau = 0.55, origen = "marco"), .taurf_frame(0.61)
  )
  expect_equal(.taurf_de(est2)$tau, 0.61)
})

test_that("una facultad sin tasa publicada se queda como estaba", {
  est <- calc_muestra_aulas_resolver_tau_estratos(
    .taurf_estudio(tau = 0.55),
    list(frame_hash = "h", tasas_efectividad_facultad = list(list(facultad = "OTRA", tasa = 0.9)))
  )
  expect_equal(.taurf_de(est)$tau, 0.55)
  expect_null(.taurf_de(est)$tau_origen)
})
