# Decisión de cobertura del marco elegible (ADR 0115 §4, revisión de U17).

.fila_cob <- function(ubigeo, total, area = 0, minimo = 0, piloto = 0) {
  list(ubigeo = ubigeo, distrito = paste("D", ubigeo), total = list(poblacion = total),
       excluida_area = list(poblacion = area), excluida_minimo = list(poblacion = minimo), excluida_piloto = list(poblacion = piloto))
}

test_that("el umbral es 10 %: 9,99 % no exige, 10,00 % sí; la piloto no cuenta; población 0 no exige", {
  r <- hojas_ruta_marco_elegible_requiere_decision(list(
    .fila_cob("a", 10000, area = 999),
    .fila_cob("b", 10000, area = 600, minimo = 400),
    .fila_cob("c", 10000, piloto = 5000),
    .fila_cob("d", 0, area = 0)
  ))
  expect_identical(vapply(r, `[[`, character(1), "ubigeo"), "b")
  expect_equal(r[[1]]$excluida, 0.1)
})

test_that("la huella sobrevive al ida y vuelta por JSON y cambia con el mínimo o un área", {
  me <- list(declarado = TRUE, minimo_viviendas = 10L, areas_excluidas = list(
    list(id = "a1", motivo = "otro", detalle = "cerro", poligono = list(c(-77.0, -12.0), c(-77.0, -12.1), c(-77.1, -12.1)))
  ))
  h <- hojas_ruta_marco_elegible_huella(me)
  ida <- jsonlite::fromJSON(jsonlite::toJSON(me, auto_unbox = TRUE, digits = NA), simplifyVector = FALSE)
  expect_identical(hojas_ruta_marco_elegible_huella(ida), h)
  me2 <- me; me2$minimo_viviendas <- 12L
  expect_false(identical(hojas_ruta_marco_elegible_huella(me2), h))
  me3 <- me; me3$areas_excluidas[[1]]$poligono[[2]] <- c(-77.0, -12.2)
  expect_length(hojas_ruta_marco_elegible_normalizar(me)$areas_excluidas, 1)
  expect_false(identical(hojas_ruta_marco_elegible_huella(me3), h))
  expect_identical(hojas_ruta_bitacora_detalle_marco(me)$hash, h)
})

test_that("vigente: la más reciente con la misma huella que cubre los distritos que hoy exigen", {
  b <- list(
    list(accion = "decision_cobertura", detalle = list(marco_hash = "h1", ubigeos = list("a", "b"))),
    list(accion = "sorteo", detalle = list()),
    list(accion = "decision_cobertura", detalle = list(marco_hash = "h0", ubigeos = list("a", "b", "c")))
  )
  expect_identical(hojas_ruta_decision_cobertura_vigente(b, "h1", c("a"))$detalle$marco_hash, "h1")
  expect_null(hojas_ruta_decision_cobertura_vigente(b, "h1", c("a", "c")))
  expect_null(hojas_ruta_decision_cobertura_vigente(b, "h2", c("a")))
  expect_null(hojas_ruta_decision_cobertura_vigente(list(), "h1", c("a")))
})

.sesion_con_muestra <- function(por_distrito, me, fase = "field") {
  sid <- session_create()
  .hojas_ruta_ensure_runs(sid)
  s <- session_get(sid)
  run <- s$hojas_ruta_runs[[fase]] %||% s$hojas_ruta_runs$field
  run$config$marco_elegible <- me
  run$workspace_outputs$sample <- list(marco_elegible = list(por_distrito = por_distrito))
  s$hojas_ruta_runs[[fase]] <- run
  s$hojas_ruta_active_phase <- fase
  .session_env[[sid]] <- s
  sid
}
.me_min <- function(m) list(declarado = TRUE, minimo_viviendas = m, areas_excluidas = list())

test_that("emitir a campo sin decisión da 409; con la decisión registrada pasa; cambiar el mínimo vuelve al 409", {
  sid <- .sesion_con_muestra(list(.fila_cob("150132", 10000, minimo = 1240)), .me_min(10L))
  on.exit(session_delete(sid), add = TRUE)
  err <- tryCatch(.hojas_ruta_exigir_decision_cobertura(sid), api_error = function(e) e)
  expect_identical(err$code, "E_COVERAGE_DECISION_REQUIRED")
  expect_identical(err$status, 409)
  expect_match(err$message, "12,4 %")
  # Anotar desde el router: la huella la pone el servidor aunque el cliente mande otra.
  pr <- mount_hojas_ruta_bitacora(plumber::pr())
  post <- Find(function(e) identical(e$verbs, "POST"), unlist(pr$endpoints, recursive = FALSE))
  body <- list(accion = "decision_cobertura", resumen = "Se acepta", detalle = list(decision = "aceptar", marco_hash = "falsa"))
  post$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid, bodyRaw = charToRaw(enc2utf8(jsonlite::toJSON(body, auto_unbox = TRUE)))), res = plumber:::PlumberResponse$new())
  d <- session_get(sid)$hojas_ruta_bitacora[[1]]$detalle
  expect_false(identical(d$marco_hash, "falsa"))
  expect_identical(unlist(d$ubigeos), "150132")
  expect_silent(.hojas_ruta_exigir_decision_cobertura(sid))
  s <- session_get(sid); s$hojas_ruta_runs$field$config$marco_elegible <- .me_min(12L); .session_env[[sid]] <- s
  expect_error(.hojas_ruta_exigir_decision_cobertura(sid), class = "api_error")
})

test_that("la piloto no se bloquea, bajo el umbral no se bloquea, y un distrito nuevo sobre el umbral sí", {
  sid <- .sesion_con_muestra(list(.fila_cob("a", 1000, area = 500)), .me_min(10L), fase = "pilot")
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  if (!is.null(s$hojas_ruta_runs$pilot)) expect_silent(.hojas_ruta_exigir_decision_cobertura(sid))
  sid2 <- .sesion_con_muestra(list(.fila_cob("a", 1000, area = 99)), .me_min(10L))
  on.exit(session_delete(sid2), add = TRUE)
  expect_silent(.hojas_ruta_exigir_decision_cobertura(sid2))
  b <- list(list(id = 1L, accion = "decision_cobertura", detalle = list(marco_hash = hojas_ruta_marco_elegible_huella(.me_min(10L)), ubigeos = list("a"))))
  est <- hojas_ruta_decision_cobertura_estado(list(.fila_cob("a", 1000, area = 200), .fila_cob("b", 1000, area = 300)), .me_min(10L), b)
  expect_null(est$vigente)
  est2 <- hojas_ruta_decision_cobertura_estado(list(.fila_cob("a", 1000, area = 200)), .me_min(10L), b)
  expect_identical(est2$vigente, 1L)
})

test_that("la muestra lleva el estado y el aviso W_COVERAGE_DECISION_MISSING, sin duplicarlo", {
  r <- list(alerts = list(), marco_elegible = list(por_distrito = list(.fila_cob("a", 1000, area = 150))))
  r <- hojas_ruta_decision_cobertura_en_muestra(r, .me_min(10L), list())
  r <- hojas_ruta_decision_cobertura_en_muestra(r, .me_min(10L), list())
  expect_identical(sum(vapply(r$alerts, function(a) identical(a$code, "W_COVERAGE_DECISION_MISSING"), logical(1))), 1L)
  expect_length(r$marco_elegible$decision_cobertura$exigida, 1)
  sin <- hojas_ruta_decision_cobertura_en_muestra(list(alerts = list()), .me_min(10L), list())
  expect_length(sin$alerts, 0)
})

test_that("la frase nombra hasta dos distritos y resume el rango con más", {
  d <- function(n, p) list(ubigeo = n, distrito = n, excluida = p)
  expect_identical(.hojas_ruta_cobertura_frase(list(d("ATE", 0.124))), "ATE pierde el 12,4 % de su población")
  expect_match(.hojas_ruta_cobertura_frase(list(d("A", 0.5), d("B", 0.6), d("C", 0.817))), "^3 distritos pierden entre el 50,0 % y el 81,7 %")
})
