# π publicada vs π real de los engines de selección de aulas (D1/D2).
#
# El motor publica UNA sola probabilidad de inclusión por aula
# (.cm_aulas_design_probabilities → pi_design → peso 1/pi), calculada por
# PPS/MOS winsorizado PARA TODOS los engines. Pero no todos los engines
# sortean con esa probabilidad:
#
#   - estratificado_aleatorio sortea `sample(seq_len(nrow(df)), quota)`
#     UNIFORME (calc_muestra_aulas.R, rama del engine en
#     .cm_aulas_pick_indices): la π real es cuota_h/N_h por estrato, no la
#     PPS publicada. Los pesos 1/pi_design que salen de ahí no corresponden
#     al diseño ejecutado. [D1 — HOY ROJO]
#
#   - cube_balanceado balancea SIN incluir pik en la matriz de balance
#     (.cm_aulas_balance_matrix solo recibe balance_vars), así que
#     samplecube no fija el tamaño de muestra; cuando el sorteo crudo no
#     calza la cuota, .cm_aulas_fix_pick_count agrega/quita aulas por sorteo
#     ponderado SIN warning ni metadata. [D2 — HOY ROJO]
#
#   - sistematico_pps sí sortea con la π publicada (UPsystematic): es el
#     control positivo que valida este arnés.
#
# Contrato congelado (verde):
#   D1: con estratificado_aleatorio, la π publicada es cuota_h/N_h uniforme
#       por estrato (y la frecuencia empírica la reproduce).
#   D2: con cube, π entra en la matriz de balance (tamaño realizado = cuota
#       casi siempre) y cuando .cm_aulas_fix_pick_count ajusta, la selección
#       lo divulga (warning/metadata), nunca en silencio.
#
# El arnés compara la frecuencia empírica de inclusión (corridas seededas de
# .cm_aulas_pick_indices, la misma llamada por estrato que hace el motor)
# contra la π publicada, con tolerancia 4·sqrt(π(1−π)/R) + 0.01.

.pi_emp_frame <- function() {
  data.frame(
    classroom_id = paste0("A", 1:8),
    stratum = "estrato_unico",
    eligible_n = c(5, 8, 12, 15, 20, 30, 45, 80),
    faculty = rep(c("FAC1", "FAC2"), each = 4),
    size_group = rep(c("chico", "grande"), 4),
    stringsAsFactors = FALSE
  )
}

.pi_emp_selector <- function() {
  list(
    n_aulas = 3L,
    mos_strategy = "eligible_yield_winsorized",
    balance_vars = list("faculty")
  )
}

.pi_emp_quota <- 3L

# Frecuencia empírica de inclusión por aula sobre `runs` corridas seededas.
.pi_emp_frecuencias <- function(engine, runs) {
  af <- .pi_emp_frame()
  selector <- .pi_emp_selector()
  counts <- stats::setNames(numeric(nrow(af)), af$classroom_id)
  for (i in seq_len(runs)) {
    res <- .cm_aulas_pick_indices(af, .pi_emp_quota, selector, engine, seed = i)
    counts[res$indices] <- counts[res$indices] + 1
  }
  counts / runs
}

.pi_emp_tolerancia <- function(pik, runs) {
  4 * sqrt(pik * (1 - pik) / runs) + 0.01
}

test_that("control positivo del arnes: sistematico_pps sortea con la pi que publica", {
  skip_if_not_installed("sampling")
  runs <- 1500L
  af <- .pi_emp_frame()
  publicada <- .cm_aulas_design_probabilities(af, .pi_emp_selector(), "sistematico_pps")
  empirica <- .pi_emp_frecuencias("sistematico_pps", runs)

  expect_equal(sum(publicada), .pi_emp_quota, tolerance = 1e-9)
  desvio <- abs(empirica[names(publicada)] - publicada)
  expect_true(
    all(desvio <= .pi_emp_tolerancia(publicada, runs)),
    info = paste0(
      "El control positivo fallo: UPsystematic no reproduce su propia pi. ",
      "max desvio = ", signif(max(desvio), 4)
    )
  )
})

test_that("D1: estratificado_aleatorio publica pi = cuota/N uniforme por estrato y la frecuencia empirica la reproduce", {
  runs <- 1500L
  af <- .pi_emp_frame()
  publicada <- .cm_aulas_design_probabilities(af, .pi_emp_selector(), "estratificado_aleatorio")
  empirica <- .pi_emp_frecuencias("estratificado_aleatorio", runs)
  uniforme <- .pi_emp_quota / nrow(af)

  # HOY ROJO: la publicada es PPS/MOS (0.079..0.874) aunque el sorteo es SRS.
  # Verde: la publicada de un SRS estratificado es cuota_h/N_h, igual para
  # todas las aulas del estrato.
  expect_equal(
    unname(publicada),
    rep(uniforme, nrow(af)),
    tolerance = 1e-9,
    info = paste(
      "pi publicada != cuota/N con engine estratificado_aleatorio:",
      "el motor publica PPS/MOS pero sortea uniforme, asi que el peso",
      "1/pi_design no corresponde al diseno ejecutado."
    )
  )

  # HOY ROJO: la frecuencia empirica (uniforme ~0.375) no se parece a la
  # publicada. Verde: publicada uniforme == empirica uniforme.
  desvio <- abs(empirica[names(publicada)] - publicada)
  expect_true(
    all(desvio <= .pi_emp_tolerancia(publicada, runs)),
    info = paste0(
      "La frecuencia empirica de inclusion no reproduce la pi publicada ",
      "(max desvio = ", signif(max(desvio), 4), "; el sorteo es uniforme ",
      "pero la pi publicada es PPS/MOS winsorizada)."
    )
  )
})

test_that("D2: cube fija el tamano por diseno y todo ajuste de .cm_aulas_fix_pick_count se divulga", {
  skip_if_not_installed("sampling")
  runs <- 400L
  af <- .pi_emp_frame()
  selector <- .pi_emp_selector()
  publicada <- .cm_aulas_design_probabilities(af, selector, "cube_balanceado")

  # Para cada semilla: tamano del sorteo crudo del cube (misma pik y mismo
  # seed que usa .cm_aulas_pick_indices) vs lo que la seleccion divulga.
  ajustadas <- logical(runs)
  silenciosas <- logical(runs)
  for (i in seq_len(runs)) {
    crudo <- .cm_aulas_pick_cube(af, unname(publicada), selector, seed = i)
    skip_if(is.null(crudo), "sampling::samplecube no disponible")
    ajustadas[[i]] <- length(crudo) != .pi_emp_quota
    if (ajustadas[[i]]) {
      res <- .cm_aulas_pick_indices(af, .pi_emp_quota, selector, "cube_balanceado", seed = i)
      silenciosas[[i]] <- length(res$warning) == 0L
    }
  }

  # HOY ROJO: sin pik en la matriz de balance, samplecube no fija el tamano
  # (~28% de los sorteos no calzan la cuota en este marco). Verde: pi entra a
  # la matriz de balance y el tamano realizado calza la cuota casi siempre.
  expect_lte(
    mean(ajustadas), 0.05,
    label = paste0(
      "proporcion de sorteos cube cuyo tamano crudo no calza la cuota (",
      sum(ajustadas), "/", runs,
      "); pik no participa de la matriz de balance"
    )
  )

  # HOY ROJO: el 100% de esos ajustes es silencioso (.cm_aulas_fix_pick_count
  # agrega/quita aulas por sorteo ponderado sin warning ni metadata). Verde:
  # cero ajustes sin divulgar.
  expect_identical(
    sum(silenciosas), 0L,
    info = paste0(
      sum(silenciosas), " de ", sum(ajustadas), " ajustes de tamano se ",
      "hicieron sin warning ni metadata: la seleccion altero la muestra del ",
      "cube en silencio."
    )
  )

  # Sanidad (verde hoy y verde manana): la pi publicada del cube si se
  # respeta empiricamente dentro de la tolerancia del arnes.
  empirica <- .pi_emp_frecuencias("cube_balanceado", runs)
  desvio <- abs(empirica[names(publicada)] - publicada)
  expect_true(
    all(desvio <= .pi_emp_tolerancia(publicada, runs)),
    info = paste0("max desvio empirico del cube = ", signif(max(desvio), 4))
  )
})

# H4 — certezas protegidas en el ajuste de tamano. Una unidad con pik >= 1
# esta en la muestra con probabilidad 1 POR DISENO: recortarla contradice su
# pi publicada y rompe el peso 1/pi. .cm_aulas_fix_pick_count solo sortea el
# recorte entre las unidades con pik < 1; tocar certezas es ultimo recurso y
# viaja con warning.
test_that("H4: el recorte de tamano nunca sortea una certeza mientras haya unidades con pik < 1", {
  pik <- c(1, 1, 0.4, 0.3, 0.3)
  for (seed in 1:25) {
    fixed <- .cm_aulas_fix_pick_count(picked = 1:5, pik = pik, quota = 3L, seed = seed)
    expect_length(fixed$indices, 3L)
    expect_true(
      all(c(1L, 2L) %in% fixed$indices),
      info = sprintf(
        "seed %d: el recorte saco una certeza (indices = %s) habiendo sorteables con pik < 1.",
        seed, paste(fixed$indices, collapse = ",")
      )
    )
    expect_identical(fixed$removed_n, 2L)
    expect_identical(fixed$added_n, 0L)
    # Con sorteables suficientes el recorte no es ultimo recurso: sin warning
    # de certezas.
    expect_length(fixed$warning, 0L)
  }
})

test_that("H4: recortar certezas es ultimo recurso y se divulga con warning", {
  # Hasta las certezas exceden la cuota: no queda mas remedio que recortarlas,
  # pero la seleccion lo dice (la pi publicada de las recortadas ya no
  # describe el proceso).
  pik <- c(1, 1, 1, 0.5)
  fixed <- .cm_aulas_fix_pick_count(picked = 1:4, pik = pik, quota = 2L, seed = 7L)
  expect_length(fixed$indices, 2L)
  expect_true(all(fixed$indices %in% 1:3))
  expect_identical(fixed$removed_n, 2L)
  expect_length(fixed$warning, 1L)
  expect_match(fixed$warning, "certeza", fixed = TRUE)
})
