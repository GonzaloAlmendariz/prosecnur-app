# La red de seguridad de la pi publicada: dos avisos, porque son dos hechos.
#
# El bug que la motiva ya esta arreglado (`.cm_aulas_mc_probabilities` contaba
# como "en la muestra" tambien a las cadenas de reemplazo, asi que pi_mc salia
# 1.000 para TODO el marco y weight_classroom valia 1 en todas las aulas). Esto
# no lo rearregla: declara el problema si vuelve a entrar por otra via.
#
# El punto delicado —y lo unico que distingue un arreglo correcto de uno que
# solo prohibe el 1— es que pi = 1 es LEGITIMA en varios casos: estrato saturado
# (cuota_h = N_h), censo (n >= N) y unidad autorrepresentada. El discriminante
# es de SUMA, no de valor:
#
#   Sigma_{marco} pi = n        y     Sigma_{estrato h} pi = cuota_h
#
# porque un diseno de tamano fijo reparte exactamente n en probabilidades de
# inclusion. pi_design cumple ese invariante por construccion
# (.cm_aulas_inclusion_probabilities renormaliza a n), asi que es la vara.
# Con el bug vivo el marco sumaba 119 cuando el sorteo selecciona 55: un exceso
# de 64 aulas, imposible bajo cualquier diseno que sortee 55.
#
# Los casos legitimos se prueban POR LA VIA DEL MOTOR, no contra una copia local
# del discriminante: son los que tienen que seguir en silencio.

.pid_A <- function(...) prosecnurapp:::.cm_aulas_aviso_pi_fuera_de_escala(...)

# ---------------------------------------------------------------------------
# 1. El discriminante, con las cifras del marco realmente medido
#    (119 aulas, 55 titulares, 20 de ellas en un estrato saturado).
# ---------------------------------------------------------------------------

.pid_estratos <- c(rep("SATURADO", 20), rep("PPS", 99))
# 20 aulas de un estrato con cuota_h = N_h (pi = 1 legitima) + 99 aulas que se
# reparten las 35 restantes: suma 55, que es lo que el sorteo selecciona.
.pid_design <- c(rep(1, 20), rep(35 / 99, 99))

test_that("el invariante de suma del marco medido es exacto: pi_design suma n", {
  expect_equal(sum(.pid_design), 55)
})

test_that("aviso A: la pi que suma 119 sobre un sorteo de 55 se declara, con sus dos cifras", {
  av <- .pid_A(rep(1, 119), .pid_design, .pid_estratos)
  expect_length(av, 1L)
  expect_true(grepl("119.00", av, fixed = TRUE))
  expect_true(grepl("55.00", av, fixed = TRUE))
  # La medida y la vara que la juzga son cifras DISTINTAS: comparar la suma
  # consigo misma no avisa nada.
  expect_false(identical("119.00", "55.00"))
  cifras <- regmatches(av, gregexpr("[0-9]+\\.[0-9]{2}", av))[[1]]
  expect_equal(cifras[[1]], "119.00")
  expect_equal(cifras[[2]], "55.00")
  expect_gt(length(unique(cifras)), 1L)
  # Y dice lo que deja de ser verdad, no solo que hay un numero raro.
  expect_true(grepl("no es un peso de diseno", av, fixed = TRUE))
})

test_that("aviso A: el estrato saturado NO avisa aunque sus 20 aulas tengan pi = 1", {
  # cuota_h = N_h: las 20 valen 1 y suman 20 = su cuota. El invariante se
  # cumple, asi que el aviso tiene que callarse.
  expect_true(sum(.pid_design >= 1 - 1e-9) == 20L)
  expect_length(.pid_A(.pid_design, .pid_design, .pid_estratos), 0L)
})

test_that("aviso A: el censo NO avisa aunque pi = 1 en TODO el marco", {
  # n >= N: la muestra es el marco, pi = 1 en las 119 y Sigma pi = 119 = n.
  censo <- rep(1, 119)
  expect_length(.pid_A(censo, censo, rep("UNICO", 119)), 0L)
})

test_that("aviso A: un desajuste que se cancela en el marco se ve por estrato", {
  # 10 aulas que se pasan y 10 que se quedan cortas: el marco suma 10 contra 10
  # y el chequeo global no lo veria. Por estrato cada uno se desvia 5 aulas.
  pi_final <- c(rep(1, 10), rep(0, 10))
  design <- rep(0.5, 20)
  expect_equal(sum(pi_final), sum(design))
  av <- .pid_A(pi_final, design, c(rep("A", 10), rep("B", 10)))
  expect_length(av, 1L)
  expect_true(grepl("2 de 2 estrato(s)", av, fixed = TRUE))
  expect_true(grepl("5.00", av, fixed = TRUE))
  expect_true(grepl("0.50", av, fixed = TRUE))
})

test_that("aviso A: la tolerancia es media aula ABSOLUTA, sin el SE del Monte Carlo", {
  # La suma de las pi NO tiene ruido de estimacion: Sigma pi = (1/R) Sigma_r T_r
  # y bajo tamano fijo T_r = n en toda corrida, asi que vale n exacto con las
  # corridas que sean. El ruido MC esta en el REPARTO entre aulas.
  #
  # La version anterior escalaba la tolerancia con 3*sqrt(k)*maxSE: con 54
  # estratos y maxSE 0.158 daba 3.48 aulas, y un desvio de UNA aula entera
  # pasaba en silencio. Este test fija el lado fuerte.
  una_aula <- .pid_design
  una_aula[[21]] <- una_aula[[21]] + 1
  av <- .pid_A(una_aula, .pid_design, .pid_estratos)
  expect_length(av, 1L)
  expect_true(grepl("56.00", av, fixed = TRUE))
  expect_true(grepl("55.00", av, fixed = TRUE))
  # Y la tolerancia que publica el texto es la nueva.
  expect_true(grepl("0.50", av, fixed = TRUE))
  expect_false(grepl("2.29", av, fixed = TRUE))
  # Una oscilacion fina de la pi publicada (redondeo al persistir) sigue muda:
  # media aula absorbe centesimas, no aulas.
  set.seed(7)
  fino <- pmax(0, pmin(1, .pid_design + stats::rnorm(119, 0, 0.005)))
  expect_lt(abs(sum(fino) - sum(.pid_design)), 0.5)
  expect_length(.pid_A(fino, .pid_design, .pid_estratos), 0L)
})

# ---------------------------------------------------------------------------
# 2. Ponderacion anulada (canal por fila).
# ---------------------------------------------------------------------------

.pid_pond <- function(...) prosecnurapp:::.cm_aulas_aviso_ponderacion_anulada(...)

test_that("los dos avisos usan el MISMO vacio: character(0), no \"\"", {
  # El de escala entra en un `unique(c(...))` donde un "" contaria como aviso y
  # dejaria sin efecto el fallback "Sin advertencias metodologicas criticas.".
  # Ese consumidor decide la direccion de la unificacion; el de la fila se
  # guarda con `length()` en su call site.
  expect_identical(.pid_A(.pid_design, .pid_design, .pid_estratos), character(0))
  expect_identical(.pid_pond(rep(1, 55), rep(1, 55), rep(TRUE, 55), 55), character(0))
})

test_that("aviso B: todos los titulares en pi = 1 con fraccion de sorteo < 1 se declara", {
  av <- .pid_pond(
    pi_final = c(rep(1, 55), rep(0.2, 30)),
    pi_design = c(rep(0.46, 55), rep(0.1, 30)),
    es_titular = c(rep(TRUE, 55), rep(FALSE, 30)),
    n_marco = 119
  )
  expect_true(nzchar(av))
  expect_true(grepl("55 titulares", av, fixed = TRUE))
  expect_true(grepl("1.000", av, fixed = TRUE))
  # La cifra que la juzga: 55 de 119 aulas no es un censo.
  expect_true(grepl("0.46", av, fixed = TRUE))
  expect_true(grepl("55 de 119 aulas", av, fixed = TRUE))
  expect_true(grepl("ponderacion queda sin efecto", av, fixed = TRUE))
  # Dos cifras distintas: el valor medido y la fraccion que lo condena.
  expect_false(identical("1.000", "0.46"))
  # Y el dominio es el titular: las reservas de la misma tabla no lo cambian.
  expect_identical(av, .pid_pond(rep(1, 55), rep(0.46, 55), rep(TRUE, 55), 119))
})

test_that("aviso B: el censo NO avisa aunque el peso valga 1 en todas", {
  # n >= N: pi = 1 y peso 1 son la respuesta correcta, no una ponderacion rota.
  expect_length(.pid_pond(rep(1, 55), rep(1, 55), rep(TRUE, 55), 55), 0L)
})

test_that("aviso B: la certeza que prescribe el diseno NO avisa", {
  # pi_design = 1: la aritmetica del estrato obliga el 1; 1/pi = 1 es su peso.
  expect_length(.pid_pond(rep(1, 55), rep(1, 55), rep(TRUE, 55), 119), 0L)
})

test_that("aviso B: un solo titular por debajo de 1 ya no es ponderacion anulada", {
  # No es "existe algun pi = 1": es TODOS. Con un peso distinto de 1 la
  # ponderacion sigue teniendo efecto.
  expect_length(.pid_pond(c(rep(1, 54), 0.9), rep(0.46, 55), rep(TRUE, 55), 119), 0L)
})

# ---------------------------------------------------------------------------
# 3. Los casos legitimos, POR LA VIA DEL MOTOR.
#    Un marco de 10 aulas en dos facultades; pool_controlado para que pi_final
#    salga del Monte Carlo, que es el camino donde vivio el bug.
# ---------------------------------------------------------------------------

.pid_base <- function() {
  n_aulas <- 10L
  por <- 6L
  n <- n_aulas * por
  data.frame(
    student_id = sprintf("s%03d", seq_len(n)),
    aula_id = rep(sprintf("A%02d", seq_len(n_aulas)), each = por),
    curso_id = rep(sprintf("C%02d", seq_len(n_aulas)), each = por),
    curso = rep(sprintf("Curso %02d", seq_len(n_aulas)), each = por),
    horario = rep(c("manana", "tarde"), length.out = n),
    facultad = rep(c(rep("FAC1", 3L), rep("FAC2", 7L)), each = por),
    programa = "P1",
    sexo = rep(c("F", "M"), length.out = n),
    edad = 20,
    condicion = "regular",
    nivel = "1",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

.pid_cfg <- function(...) {
  selector <- list(
    seed = 11L, n_aulas = 6L, replacement_waves = 1L,
    selector_engine = "pool_controlado", strata_cols = list("faculty"),
    balance_vars = list("faculty"), monte_carlo_n = 8L, simulation_runs = 8L,
    candidate_pool_size = 6L
  )
  overrides <- list(...)
  if (length(overrides)) selector <- utils::modifyList(selector, overrides)
  calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = selector
  ))
}

.pid_corre <- function(...) {
  cfg <- .pid_cfg(...)
  frame <- calc_muestra_aulas_construir(base_madre = .pid_base(), config = cfg)
  list(frame = frame, cfg = cfg, sel = calc_muestra_aulas_seleccionar(frame, cfg))
}

.pid_avisos <- function(r) unlist(r$sel$methodological_warning, use.names = FALSE)

.pid_hay_aviso_escala <- function(r) {
  any(grepl("probabilidades publicadas", .pid_avisos(r), fixed = TRUE))
}

.pid_hay_aviso_peso <- function(r) {
  any(grepl("ponderacion queda sin efecto", r$sel$selection$weight_warning, fixed = TRUE))
}

test_that("motor: un estrato saturado da pi = 1 legitima y NO dispara ningun aviso", {
  # faculty_targets fija la cuota de FAC1 en sus 3 aulas: cuota_h = N_h.
  r <- .pid_corre(faculty_targets = list(FAC1 = 3L))
  tit <- r$sel$selection[r$sel$selection$sample_role == "titular", , drop = FALSE]
  expect_equal(nrow(tit), 6L)
  # La certeza esta ahi, y es la del diseno.
  expect_equal(sum(tit$pi_design >= 1 - 1e-9), 3L)
  expect_equal(sum(tit$pi_final >= 1 - 1e-9), 3L)
  expect_true(any(tit$weight_classroom > 1))
  expect_false(.pid_hay_aviso_escala(r))
  expect_false(.pid_hay_aviso_peso(r))
})

test_that("motor: el censo da pi = 1 y peso 1 en TODO el marco y NO dispara ningun aviso", {
  # n_aulas = 10 >= N = 10. Es el caso que un chequeo por valor —"hay pi = 1",
  # "el peso vale 1"— condenaria siendo la respuesta correcta.
  r <- .pid_corre(n_aulas = 10L)
  tit <- r$sel$selection[r$sel$selection$sample_role == "titular", , drop = FALSE]
  expect_equal(nrow(tit), 10L)
  expect_true(all(tit$pi_final >= 1 - 1e-9))
  expect_true(all(abs(tit$weight_classroom - 1) < 1e-9))
  expect_false(.pid_hay_aviso_escala(r))
  expect_false(.pid_hay_aviso_peso(r))
})

# Un estrato que NO puede llenar su cuota (cuota_h > N_h). Es el unico regimen
# donde la suma del marco cae por debajo del n pedido de forma LEGITIMA, asi que
# es donde un aviso mal fijado daria falso positivo. La masa de elegibles se
# concentra en una facultad con UNA sola aula: el reparto por masa
# (.cm_aulas_quota_by_stratum) no capea a N_h, asi que le asigna 5 de 6.
.pid_base_cuota_imposible <- function() {
  filas <- list()
  for (i in 1:60) filas[[length(filas) + 1L]] <- c(sprintf("s%03d", i), "A01", "FAC1")
  k <- 60L
  for (a in 2:10) for (j in 1:2) {
    k <- k + 1L
    filas[[length(filas) + 1L]] <- c(sprintf("s%03d", k), sprintf("A%02d", a), "FAC2")
  }
  m <- do.call(rbind, filas)
  n <- nrow(m)
  data.frame(
    student_id = m[, 1], aula_id = m[, 2], curso_id = m[, 2], curso = m[, 2],
    horario = rep(c("manana", "tarde"), length.out = n), facultad = m[, 3],
    programa = "P1", sexo = rep(c("F", "M"), length.out = n), edad = 20,
    condicion = "regular", nivel = "1", modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

test_that("motor: un estrato que no puede llenar su cuota NO da falso positivo", {
  cfg <- .pid_cfg()
  frame <- calc_muestra_aulas_construir(base_madre = .pid_base_cuota_imposible(), config = cfg)
  estratificado <- frame$aula_frame
  estratificado$stratum <- prosecnurapp:::.cm_aulas_make_stratum(estratificado, list("faculty"))
  cuotas <- prosecnurapp:::.cm_aulas_quota_estratos(estratificado, 6L, cfg$selector)
  # El regimen existe: a FAC1 le toca cuota 5 y solo tiene 1 aula.
  expect_equal(as.integer(cuotas[["FAC1"]]), 5L)
  expect_equal(sum(estratificado$stratum == "FAC1"), 1L)

  # Una sola corrida del motor, con el aviso REAL enchufado y sus entradas
  # capturadas: asi se mide sobre lo que el motor calcula, no sobre una copia.
  real <- prosecnurapp:::.cm_aulas_aviso_pi_fuera_de_escala
  visto <- NULL
  salida <- NULL
  r <- testthat::with_mocked_bindings(
    .cm_aulas_aviso_pi_fuera_de_escala = function(pi_final, pi_design, stratum = NULL) {
      visto <<- list(pi_final = pi_final, pi_design = pi_design, stratum = stratum)
      salida <<- real(pi_final, pi_design, stratum)
      salida
    },
    list(sel = calc_muestra_aulas_seleccionar(frame, cfg)),
    .package = "prosecnurapp"
  )

  # El faltante es LEGITIMO y esta en las DOS magnitudes, no en su diferencia:
  # el diseno capea la cuota a N_h y el sorteo no puede sacar aulas que no
  # existen. Por eso la vara es pi_design y no el n_aulas pedido.
  expect_equal(sum(visto$pi_design), 2)
  expect_equal(sum(visto$pi_final), 2)
  expect_lt(sum(visto$pi_design), 6)
  for (st in unique(visto$stratum)) {
    i <- visto$stratum == st
    expect_equal(sum(visto$pi_final[i]), sum(visto$pi_design[i]))
  }
  # Y el aviso calla: ni el real ni el publicado.
  expect_length(salida, 0L)
  expect_false(.pid_hay_aviso_escala(r))
  expect_false(.pid_hay_aviso_peso(r))
})

# El tercer caso legitimo de pi = 1, y el mas sutil: la unidad
# AUTORREPRESENTADA. Aqui el estrato NO esta saturado (cuota_h < N_h) — la
# certeza no viene de la aritmetica del estrato sino del TAMANO de la unidad:
# cuota_h · MOS_i / Σ_h MOS >= 1. FAC2 lleva 12 aulas para una cuota de 5, con
# dos aulas de MOS dominante.
#
# Hacen falta DOS aulas grandes, no una: el `mos_strategy` por defecto
# (eligible_yield_winsorized) capa al p90 del estrato, y con una sola la
# winsorizacion la aplana antes de que alcance la certeza.
.pid_base_autorrepresentada <- function() {
  filas <- list()
  k <- 0L
  aula <- function(id, fac, n) {
    for (j in seq_len(n)) {
      k <<- k + 1L
      filas[[length(filas) + 1L]] <<- c(sprintf("s%03d", k), id, fac)
    }
  }
  aula("A01", "FAC1", 8)
  aula("A02", "FAC1", 8)
  aula("B01", "FAC2", 20)
  aula("B02", "FAC2", 20)
  for (a in 3:12) aula(sprintf("B%02d", a), "FAC2", 2)
  m <- do.call(rbind, filas)
  n <- nrow(m)
  data.frame(
    student_id = m[, 1], aula_id = m[, 2], curso_id = m[, 2], curso = m[, 2],
    horario = rep(c("manana", "tarde"), length.out = n), facultad = m[, 3],
    programa = "P1", sexo = rep(c("F", "M"), length.out = n), edad = 20,
    condicion = "regular", nivel = "1", modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

test_that("motor: la unidad autorrepresentada en estrato NO saturado no dispara ningun aviso", {
  # sistematico_pps y no pool_controlado a proposito: con el pool la certeza del
  # diseno no llega a la pi PUBLICADA (medido: pi_final = 1 en 0 aulas), y lo que
  # el aviso juzga es la publicada. Con el sistematico el 1 si se publica.
  cfg <- .pid_cfg(selector_engine = "sistematico_pps")
  frame <- calc_muestra_aulas_construir(base_madre = .pid_base_autorrepresentada(), config = cfg)
  estratificado <- frame$aula_frame
  estratificado$stratum <- prosecnurapp:::.cm_aulas_make_stratum(estratificado, list("faculty"))
  cuotas <- prosecnurapp:::.cm_aulas_quota_estratos(estratificado, 6L, cfg$selector)

  # Lo que lo distingue del caso saturado, y sin esto el test podria estar
  # midiendo un saturado por accidente: la cuota es MENOR que el estrato.
  expect_equal(as.integer(cuotas[["FAC2"]]), 5L)
  expect_equal(sum(estratificado$stratum == "FAC2"), 12L)
  expect_lt(as.integer(cuotas[["FAC2"]]), sum(estratificado$stratum == "FAC2"))

  real <- prosecnurapp:::.cm_aulas_aviso_pi_fuera_de_escala
  visto <- NULL
  salida <- NULL
  r <- testthat::with_mocked_bindings(
    .cm_aulas_aviso_pi_fuera_de_escala = function(pi_final, pi_design, stratum = NULL) {
      visto <<- list(pi_final = pi_final, pi_design = pi_design, stratum = stratum)
      salida <<- real(pi_final, pi_design, stratum)
      salida
    },
    list(sel = calc_muestra_aulas_seleccionar(frame, cfg)),
    .package = "prosecnurapp"
  )

  en_fac2 <- visto$stratum == "FAC2"
  # Dos aulas con certeza de DISENO en un estrato que no esta saturado.
  expect_equal(sum(visto$pi_design[en_fac2] >= 1 - 1e-9), 2L)
  # Y el 1 llega a la pi publicada, que es la que el aviso juzga.
  expect_true(any(visto$pi_final[en_fac2] >= 1 - 1e-9))

  # POR QUE no avisa: la suma sigue cuadrando. El estrato reparte su cuota y el
  # marco su n, aunque el REPARTO entre aulas del estimador no sea el del
  # diseno — que es justamente el punto del discriminante de suma.
  expect_equal(sum(visto$pi_design[en_fac2]), 5)
  expect_equal(sum(visto$pi_final[en_fac2]), 5)
  expect_equal(sum(visto$pi_design), 6)
  expect_equal(sum(visto$pi_final), 6)
  expect_true(any(abs(visto$pi_final[en_fac2] - visto$pi_design[en_fac2]) > 0.1))

  # Los dos canales callados.
  expect_length(salida, 0L)
  expect_false(.pid_hay_aviso_escala(r))
  expect_false(.pid_hay_aviso_peso(r))
  # Y el peso 1 de la autorrepresentada convive con pesos distintos de 1: la
  # ponderacion no esta anulada, solo esa unidad se representa a si misma.
  tit <- r$sel$selection[r$sel$selection$sample_role == "titular", , drop = FALSE]
  expect_true(any(abs(tit$weight_classroom - 1) < 1e-9))
  expect_true(any(tit$weight_classroom > 1))
})

test_that("motor: un sorteo corriente con pesos dispares no dispara ningun aviso", {
  r <- .pid_corre()
  tit <- r$sel$selection[r$sel$selection$sample_role == "titular", , drop = FALSE]
  # Ponderacion viva: los pesos NO son todos 1.
  expect_gt(length(unique(round(tit$weight_classroom, 6))), 1L)
  expect_false(.pid_hay_aviso_escala(r))
  expect_false(.pid_hay_aviso_peso(r))
  # Que pi_design sume el tamano del sorteo se comprueba sobre el vector que el
  # motor realmente juzga, en el test de cableado: el marco estratificado vive
  # dentro de calc_muestra_aulas_seleccionar y no se puede rehacer desde fuera
  # (`aula_frame` del frame construido todavia no trae `stratum`).
})

# ---------------------------------------------------------------------------
# 4. El cableado: que los dos avisos salgan por SU canal y se midan sobre las
#    magnitudes correctas. Sin esto el discriminante podria ser perfecto y
#    estar juzgando el vector equivocado.
# ---------------------------------------------------------------------------

test_that("el aviso de escala se mide sobre el MARCO y sale por methodological_warning", {
  visto <- NULL
  r <- testthat::with_mocked_bindings(
    .cm_aulas_aviso_pi_fuera_de_escala = function(pi_final, pi_design, stratum = NULL) {
      visto <<- list(pi_final = pi_final, pi_design = pi_design, stratum = stratum)
      "SENAL_ESCALA"
    },
    .pid_corre(),
    .package = "prosecnurapp"
  )
  # Las tres magnitudes son del marco entero (10 aulas), no de la seleccion.
  expect_length(visto$pi_final, 10L)
  expect_length(visto$pi_design, 10L)
  expect_length(visto$stratum, 10L)
  # Y la vara es el tamano del sorteo: pi_design suma las 6 que se seleccionan.
  expect_equal(sum(visto$pi_design), 6)
  expect_true("SENAL_ESCALA" %in% .pid_avisos(r))
  expect_true(grepl("SENAL_ESCALA", r$sel$methodology$warning, fixed = TRUE))
})

test_that("el aviso de ponderacion se estampa en weight_warning y SOLO en los titulares", {
  visto <- NULL
  r <- testthat::with_mocked_bindings(
    .cm_aulas_aviso_ponderacion_anulada = function(pi_final, pi_design, es_titular, n_marco) {
      visto <<- list(n_titulares = sum(es_titular %in% TRUE), n_marco = n_marco)
      "SENAL_PESO"
    },
    .pid_corre(),
    .package = "prosecnurapp"
  )
  expect_equal(visto$n_titulares, 6L)
  expect_equal(visto$n_marco, 10L)
  df <- r$sel$selection
  expect_true(all(grepl("SENAL_PESO", df$weight_warning[df$sample_role == "titular"], fixed = TRUE)))
  expect_false(any(grepl("SENAL_PESO", df$weight_warning[df$sample_role != "titular"], fixed = TRUE)))
  # Y no se cuela en el canal del diseno: son dos hechos distintos.
  expect_false(any(grepl("SENAL_PESO", .pid_avisos(r), fixed = TRUE)))
})
