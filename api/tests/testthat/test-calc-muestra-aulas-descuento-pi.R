# D3 — π del descuento secuencial: la probabilidad publicada debe venir del
# proceso que de verdad sorteó.
#
# Con selector$sequential_discount ON y un engine secuencial (sistematico_pps),
# .cm_descuento_pick_indices sortea aula por aula recalculando la MOS sobre los
# elegibles NETOS (calc_muestra_aulas_descuento.R). Esa π ya no es la del
# diseño estático: depende del orden de extracción y del traslape del marco, y
# solo puede estimarse por Monte Carlo.
#
# Sin embargo, calc_muestra_aulas_seleccionar asigna pi_design/pi_final desde
# .cm_aulas_design_probabilities (estática, sin descuento) con
# probability_source = "prescribed_design", y el MC de transparencia nace
# apagado (.cm_aulas_seleccionar_mc_runs devuelve 0 para engines "prescritos").
# Resultado: pesos 1/pi de un diseño que no fue el ejecutado, sin ninguna
# divulgación.
#
# Contrato congelado (verde): con descuento secuencial aplicado en modo
# sequential, probability_source == "monte_carlo_sequential_discount", el MC
# corre (mc_runs > 0), pi_mc es finita para las aulas del plan y pi_final
# proviene del MC (con rescate a pi_design divulgado cuando el estimador MC
# es inválido).

# Marco de la asesoría muestral 2026-07-15 §10 (mismo que
# test-calc-muestra-aulas-descuento.R): dos aulas grandes que comparten 80
# alumnos y dos medianas disjuntas — el traslape hace que la π secuencial
# difiera de la estática.
.descuento_pi_base <- function() {
  ids <- c(paste0("s", 1:100), paste0("s", 21:120), paste0("t", 1:30), paste0("u", 1:30))
  aula <- c(rep("A1", 100), rep("A2", 100), rep("A3", 30), rep("A4", 30))
  data.frame(
    student_id = ids,
    aula_id = aula,
    curso_id = paste0("C", match(aula, c("A1", "A2", "A3", "A4"))),
    curso = paste("Curso", aula),
    horario = "L 8",
    facultad = "FAC1",
    programa = "P1",
    sexo = "F",
    edad = 20,
    condicion = "regular",
    nivel = "pregrado",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

.descuento_pi_cfg <- function() {
  calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 77L,
      n_aulas = 2L,
      replacement_waves = 0L,
      selector_engine = "sistematico_pps",
      strata_cols = list("faculty"),
      sequential_discount = TRUE,
      # Presupuesto MC explícito: en verde estas corridas estiman la pi del
      # proceso secuencial.
      monte_carlo_n = 50L,
      simulation_runs = 50L
    )
  ))
}

test_that("D3: con descuento secuencial la pi publicada proviene del Monte Carlo del proceso, no del diseno estatico", {
  skip_if_not_installed("sampling")
  cfg <- .descuento_pi_cfg()
  frame <- calc_muestra_aulas_construir(base_madre = .descuento_pi_base(), config = cfg)
  sel <- calc_muestra_aulas_seleccionar(frame, cfg)

  # Sanidad del setup: el descuento corrió de verdad en modo secuencial.
  expect_identical(sel$sequential_discount$mode, "sequential")
  expect_true(sel$sequential_discount$applied)
  core <- sel$selection[sel$selection$sample_role != "extra_reserve_pool", , drop = FALSE]
  expect_true(all(c("eligible_n_neto", "discount_step") %in% names(core)))

  # HOY ROJO: probability_source == "prescribed_design", es decir la pi
  # publicada describe un PPS estático que NO fue el sorteo ejecutado (el
  # sorteo fue secuencial con MOS recalculada sobre netos).
  expect_true(
    all(core$probability_source == "monte_carlo_sequential_discount"),
    info = paste0(
      "probability_source = '",
      paste(unique(core$probability_source), collapse = "', '"),
      "': la seleccion secuencial con descuento publica la pi del diseno ",
      "estatico como si fuera la del proceso ejecutado."
    )
  )

  # HOY ROJO: el MC de transparencia nace apagado (mc_runs = 0, pi_mc NA):
  # nadie estima la pi real del proceso secuencial.
  expect_true(
    all(core$mc_runs > 0L),
    info = "mc_runs = 0: la pi del proceso secuencial no se estimo por Monte Carlo."
  )
  expect_true(
    all(is.finite(core$pi_mc)),
    info = "pi_mc es NA para las aulas del plan: no hay estimador MC de la pi secuencial."
  )

  # Contrato de pi_final: proviene del MC, con rescate a pi_design divulgado
  # cuando el estimador MC es invalido (mismo patron de rescate que ya usa el
  # path de pool_controlado).
  esperado <- ifelse(
    is.finite(core$pi_mc) & core$pi_mc > 0,
    core$pi_mc,
    core$pi_design
  )
  expect_equal(core$pi_final, esperado, tolerance = 1e-9)
  expect_true(all(is.finite(core$pi_final) & core$pi_final > 0))
  expect_true(all(is.finite(core$weight_classroom) & core$weight_classroom > 0))
})

# D3 (propiedad estadistica, no solo contrato): el MC del proceso secuencial
# tiene que MEDIR el efecto del descuento, no repetir la pi estatica. En el
# marco de traslape fuerte (A1 y A2 comparten 80 de sus 100 alumnos; A3 y A4
# son chicas y disjuntas) la direccion es conocida:
#
#   - pi_design (PPS estatico, MOS = elegibles brutos): 2*100/260 ~= 0.769
#     para cada aula grande y 2*30/260 ~= 0.231 para cada chica.
#   - pi secuencial: cuando una grande sale primero, la otra queda con neto 20
#     y pesa como chica en el siguiente sorteo -> su probabilidad de inclusion
#     CAE (~0.58 analitico); las chicas disjuntas la GANAN (~0.42).
#
# El arnes usa el MISMO estimador que publica el motor
# (.cm_aulas_mc_probabilities con .cm_aulas_select_waves por corrida), semilla
# fija y un presupuesto que .cm_aulas_mc_final_budget no recorta, con margen de
# 0.08 (> 3 SE a 400 corridas) para separar senal de ruido.
test_that("D3: pi_mc diverge de pi_design en la direccion del traslape (grandes caen, chicas suben)", {
  skip_if_not_installed("sampling")
  runs <- 400L
  cfg <- .descuento_pi_cfg()
  selector <- cfg$selector
  frame <- calc_muestra_aulas_construir(base_madre = .descuento_pi_base(), config = cfg)
  af <- frame$aula_frame
  af <- af[af$included %in% TRUE, , drop = FALSE]
  af$stratum <- .cm_aulas_make_stratum(af, selector$strata_cols)

  # Sanidad del arnes: el marco es el del traslape (brutos 100/100/30/30), el
  # descuento aplica en modo secuencial y el presupuesto no recorta las
  # corridas pedidas.
  expect_setequal(af$classroom_id, c("A1", "A2", "A3", "A4"))
  brutos <- stats::setNames(as.numeric(af$eligible_n), af$classroom_id)
  expect_equal(unname(brutos[c("A1", "A2", "A3", "A4")]), c(100, 100, 30, 30))
  estado <- .cm_descuento_estado(af, selector, "sistematico_pps")
  expect_true(estado$applied)
  expect_identical(estado$mode, "sequential")
  expect_identical(.cm_aulas_mc_final_budget(nrow(af), runs), runs)

  pi_design <- .cm_aulas_design_probabilities(af, selector, "sistematico_pps")
  mc <- .cm_aulas_mc_probabilities(af, selector, "sistematico_pps", waves = "M1", runs = runs)
  expect_identical(mc$runs, runs)
  pi_mc <- mc$pi[names(pi_design)]

  # Cada corrida selecciona exactamente la cuota (2): el estimador conserva la
  # masa total de inclusion.
  expect_equal(sum(pi_mc), 2, tolerance = 1e-6)

  margen <- 0.08
  for (aula in c("A1", "A2")) {
    expect_lt(
      pi_mc[[aula]], pi_design[[aula]] - margen,
      label = sprintf(
        "pi_mc[%s] = %.3f (pi_design = %.3f): el aula grande solapada debe PERDER probabilidad bajo descuento secuencial",
        aula, pi_mc[[aula]], pi_design[[aula]]
      )
    )
  }
  for (aula in c("A3", "A4")) {
    expect_gt(
      pi_mc[[aula]], pi_design[[aula]] + margen,
      label = sprintf(
        "pi_mc[%s] = %.3f (pi_design = %.3f): el aula chica disjunta debe GANAR probabilidad bajo descuento secuencial",
        aula, pi_mc[[aula]], pi_design[[aula]]
      )
    )
  }
})
