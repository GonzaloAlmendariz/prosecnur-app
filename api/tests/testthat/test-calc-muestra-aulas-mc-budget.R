# Presupuesto de escala para el Monte Carlo del SORTEO FINAL de titulares.
#
# Contexto del bug de performance: el motor `pool_controlado` (opcion
# "Optimizada para evitar repetidos") estima pi_final por Monte Carlo corriendo
# una seleccion de olas COMPLETA por corrida. A escala real (~2.9k cursos-horario
# elegibles) cada corrida cuesta ~10 s, asi que las 500 corridas por defecto
# daban ~80 min e inutilizaban la app. El path de COMPARACION de metodos ya
# capaba via `.cm_aulas_simulation_budget`; el fix hace que el sorteo final
# aplique EL MISMO presupuesto de escala dentro de `.cm_aulas_mc_probabilities`.
#
# Estrategia de test: el costo dominante de correr el path final con
# `pool_controlado` es la optimizacion del objetivo dentro de cada
# `.cm_aulas_select_waves` (~64 s por corrida a n=1250). Correr las ~46 corridas
# presupuestadas con ese motor tomaria ~50 min -> inviable en CI. Como el
# presupuesto es engine-agnostico (depende solo de nrow(aula_frame)), verificamos
# el capping de corridas ejercitando la funcion REAL del path final
# (`.cm_aulas_mc_probabilities`) con un motor barato (`sistematico_pps`, ~0.04 s
# por corrida) sobre un marco grande sintetico, y por separado verificamos el
# WIRING del caller (`calc_muestra_aulas_seleccionar`) con `pool_controlado` en
# un marco chico (sin presupuesto, corridas == solicitadas).

.mc_budget_base <- function(n_aulas, per_class = 4L) {
  n <- n_aulas * per_class
  aula <- rep(seq_len(n_aulas), each = per_class)
  data.frame(
    student_id = paste0("s", seq_len(n)),
    aula_id = paste0("A", aula),
    curso_id = paste0("C", aula),
    curso = paste("Curso", aula),
    horario = rep(c("manana", "tarde", "noche"), length.out = n),
    facultad = paste0("FAC", (aula %% 6L) + 1L),
    programa = paste0("P", (aula %% 12L) + 1L),
    sexo = rep(c("F", "M"), length.out = n),
    edad = 20,
    condicion = "regular",
    nivel = as.character((aula %% 2L) + 1L),
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

# Prepara un aula_frame construido para llamar directamente a
# .cm_aulas_mc_probabilities, replicando lo que hace el caller antes del MC
# (stratum derivado de strata_cols + eligible_n numerico saneado).
.mc_budget_frame <- function(n_aulas, engine, monte_carlo_n = 500L) {
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 7L,
      n_aulas = 15L,
      replacement_waves = 0L,
      selector_engine = engine,
      strata_cols = list("faculty"),
      balance_vars = list("faculty", "program"),
      monte_carlo_n = monte_carlo_n
    )
  ))
  fr <- calc_muestra_aulas_construir(base_madre = .mc_budget_base(n_aulas), config = cfg)
  af <- prosecnurapp:::.cm_aulas_as_df(fr$aula_frame, "aula_frame")
  af$stratum <- prosecnurapp:::.cm_aulas_make_stratum(af, cfg$selector$strata_cols)
  af$eligible_n <- suppressWarnings(as.numeric(af$eligible_n))
  af$eligible_n[!is.finite(af$eligible_n)] <- 0
  list(aula_frame = af, selector = cfg$selector, objective = cfg$objective)
}

test_that("MC del sorteo final capa las corridas con el piso ALTO propio del final (>1200)", {
  ctx <- .mc_budget_frame(1300L, "sistematico_pps", monte_carlo_n = 500L)
  n <- nrow(ctx$aula_frame)
  expect_gt(n, 1200L) # el marco debe superar el umbral para activar el presupuesto

  budget_expected <- prosecnurapp:::.cm_aulas_mc_final_budget(n, 500L)
  expect_lt(budget_expected, 500L)           # a esta escala el presupuesto recorta
  expect_gte(budget_expected, 50L)           # piso ALTO del final (no el 10 del comparador)

  mc <- prosecnurapp:::.cm_aulas_mc_probabilities(
    ctx$aula_frame, ctx$selector, "sistematico_pps", c("M1"),
    runs = 500L, objective = ctx$objective
  )

  # Corridas EJECUTADAS == presupuesto final, NO las 500 solicitadas.
  expect_equal(mc$runs, budget_expected)
  expect_lt(mc$runs, 500L)
  # Honestidad estadistica: se preserva lo solicitado y se marca el recorte.
  expect_equal(mc$requested, 500L)
  expect_true(isTRUE(mc$budgeted))
  expect_match(mc$note, "presupuestadas")
  expect_true(is.finite(mc$error)) # el SE reportado refleja las corridas ejecutadas

  # pi debe seguir siendo finito y con masa positiva tras el presupuesto.
  expect_true(any(is.finite(mc$pi) & mc$pi > 0))
  expect_false(any(is.finite(mc$pi) & mc$pi < 0))
})

test_that("el piso del MC final es mas alto que el del comparador y no lo altera", {
  # El comparador solo puntua (agregados robustos): piso 10. El final pondera
  # con 1/pi: piso 50. Son funciones distintas para no contaminar el comparador.
  for (n in c(1500L, 3000L, 6000L)) {
    final_b <- prosecnurapp:::.cm_aulas_mc_final_budget(n, 500L)
    compare_b <- prosecnurapp:::.cm_aulas_simulation_budget(n, 500L)
    expect_equal(final_b, min(500L, max(50L, as.integer(150000 %/% n))))
    expect_gte(final_b, 50L)
    expect_gt(final_b, compare_b) # el final nunca por debajo del comparador
  }
  # Comparador intacto: conserva su formula historica (piso 10, 60000/n).
  expect_equal(prosecnurapp:::.cm_aulas_simulation_budget(3000L, 500L), 20L)
  # Marco chico: ambos devuelven lo solicitado (sin recorte).
  expect_equal(prosecnurapp:::.cm_aulas_mc_final_budget(800L, 40L), 40L)
  expect_equal(prosecnurapp:::.cm_aulas_simulation_budget(800L, 40L), 40L)
})

test_that("el rescate garantiza pi_final>0 y peso finito para toda aula seleccionada bajo presupuesto recortado", {
  # Regimen recortado del path MC: un aula seleccionada de pi baja puede contar
  # 0 en el Monte Carlo -> pi_mc = 0. Como TIENE pi verdadera > 0 (esta en un
  # estrato muestreado), el rescate cae a design_pi. Ejercitamos la funcion REAL
  # del path (.cm_aulas_pi_final_rescue) con design_pi REAL de un marco grande.
  ctx <- .mc_budget_frame(1300L, "pool_controlado", monte_carlo_n = 500L)
  af <- ctx$aula_frame
  design_pi <- prosecnurapp:::.cm_aulas_design_probabilities(af, ctx$selector, "pool_controlado")

  # Aulas "seleccionadas": cualquier subconjunto con design_pi > 0 (invariante
  # estructural: toda aula elegible de un estrato muestreado tiene design_pi > 0).
  selectable <- names(design_pi)[is.finite(design_pi) & design_pi > 0]
  expect_gt(length(selectable), 10L)
  selected <- head(selectable, 40L)
  pi_design_sel <- as.numeric(design_pi[selected])
  expect_true(all(pi_design_sel > 0)) # design_pi > 0 para toda aula seleccionada

  # Simulamos el estimador MC crudo: forzamos conteo 0 en las 10 de menor pi
  # (las que un MC recortado dejaria en 0) y valores plausibles en el resto.
  pi_mc_sel <- pi_design_sel
  low_idx <- order(pi_design_sel)[1:10]
  pi_mc_sel[low_idx] <- 0            # conteo Monte Carlo nulo por recorte
  pi_mc_sel[c(1L, 2L)] <- c(NA_real_, -0.001) # bordes no finitos / negativos

  pi_final <- prosecnurapp:::.cm_aulas_pi_final_rescue(pi_mc_sel, pi_design_sel)

  # Invariante innegociable: ningun titular seleccionado queda con pi_final<=0.
  expect_true(all(is.finite(pi_final) & pi_final > 0))
  weight <- ifelse(pi_final > 0, 1 / pi_final, NA_real_)
  expect_true(all(is.finite(weight) & weight > 0)) # pesos finitos y positivos
  # Las aulas rescatadas quedaron exactamente en su design_pi.
  expect_equal(pi_final[low_idx], pi_design_sel[low_idx])
})

test_that("MC conserva las corridas solicitadas en marco chico (<=1200)", {
  ctx <- .mc_budget_frame(120L, "sistematico_pps", monte_carlo_n = 40L)
  n <- nrow(ctx$aula_frame)
  expect_lte(n, 1200L)

  requested <- 40L
  expect_equal(prosecnurapp:::.cm_aulas_simulation_budget(n, requested), requested)

  mc <- prosecnurapp:::.cm_aulas_mc_probabilities(
    ctx$aula_frame, ctx$selector, "sistematico_pps", c("M1"),
    runs = requested, objective = ctx$objective
  )

  expect_equal(mc$runs, requested)     # sin recorte
  expect_equal(mc$requested, requested)
  expect_false(isTRUE(mc$budgeted))
  # Lo que se protege es que la nota diga que corrio sobre el plan COMPLETO, sin
  # recorte por presupuesto; no la redaccion. Estaba clavado a «plan completo de
  # olas» y «olas» salio de la nota el 2026-08-22: en Simulacion aparecia sin
  # contexto, porque el vocabulario de olas vive en la pestana Reemplazos.
  expect_match(mc$note, "plan completo")
  expect_true(any(is.finite(mc$pi) & mc$pi > 0))
})

test_that("el path final pool_controlado propaga mc_runs y el SE al selection_df", {
  # Marco chico (n<=1200) para que las corridas de pool_controlado corran rapido;
  # aqui NO hay presupuesto, asi que mc_runs == monte_carlo_n. Esto blinda el
  # wiring del caller: mc$runs -> selection_df$mc_runs y el formato de
  # mc_error_summary. El capping a escala grande ya queda cubierto arriba.
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 11L,
      n_aulas = 5L,
      replacement_waves = 0L,
      selector_engine = "pool_controlado",
      strata_cols = list("faculty"),
      balance_vars = list("faculty", "program"),
      monte_carlo_n = 8L
    )
  ))
  frame <- calc_muestra_aulas_construir(base_madre = .mc_budget_base(18L, per_class = 5L), config = cfg)
  sel <- calc_muestra_aulas_seleccionar(frame, config = cfg)
  df <- sel$selection

  expect_true("mc_runs" %in% names(df))
  expect_equal(unique(df$probability_source)[[1]], "monte_carlo_after_optimization")
  # Sin presupuesto en marco chico: corridas ejecutadas == solicitadas.
  expect_equal(unique(df$mc_runs)[[1]], 8L)
  # SE reportado sin nota de presupuesto (no hubo recorte).
  expect_match(unique(df$mc_error_summary)[[1]], "^max_se=")
  expect_false(grepl("presupuestadas", unique(df$mc_error_summary)[[1]]))

  # Invariante metodologico: los titulares seleccionados tienen pi_final > 0.
  tit <- df[df$sample_role == "titular", , drop = FALSE]
  expect_gt(nrow(tit), 0L)
  expect_true(all(is.finite(tit$pi_final) & tit$pi_final > 0))
  expect_true(all(is.finite(tit$weight_classroom) & tit$weight_classroom > 0))
})
