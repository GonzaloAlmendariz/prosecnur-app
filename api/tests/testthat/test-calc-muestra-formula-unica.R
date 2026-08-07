# D6 — Tres defectos estadísticos puntuales del motor de Cálculo de muestra:
#
# 1. Fórmula única de tamaño muestral: .cm_calc_n_muestra_redondeado
#    (calc_muestra_engine.R) usa round() mientras calc_n_muestra
#    (helpers_calc_comunes.R) usa ceiling(). Con los mismos parámetros la app
#    publica dos n distintos según el camino, y round() puede quedar POR
#    DEBAJO del n que garantiza el margen de error.
# 2. MOS de un aula sin elegibles: .cm_aulas_measure_of_size hace
#    `eligible[eligible <= 0] <- 1`, así que un aula con 0 elegibles recibe
#    medida de tamaño positiva y puede ser sorteada con probabilidad > 0.
# 3. Gates c7/c8/c8_facultad (calc_muestra_aulas_criterios.R):
#    `is.na(x) | x >= umbral` deja pasar el NA sin divulgarse por criterio;
#    la salida de criterios debe exponer cuántas aulas pasaron cada gate por
#    NA (campo nuevo `composicion_na_n` en cada bloque de
#    perfil$opcionales).

test_that("D6: el n redondeado del engine coincide con calc_n_muestra (ceiling, no round)", {
  # N=25000, p=0.5, z=1.96, e=0.05, deff=1 -> n exacto = 378.36...:
  # round() da 378 y ceiling() da 379. Un caso donde difieren, elegido a
  # propósito: 378 encuestas NO alcanzan el margen de error pedido.
  canonico <- calc_n_muestra(N = 25000, p = 0.5, z = 1.96, e = 0.05, deff = 1)
  expect_identical(canonico, 379L)

  # HOY ROJO: .cm_calc_n_muestra_redondeado devuelve 378 (round). Verde: la
  # fórmula es única y redondea hacia arriba como calc_n_muestra.
  expect_identical(
    .cm_calc_n_muestra_redondeado(N = 25000, p = 0.5, z = 1.96, e = 0.05, deff = 1),
    canonico,
    info = paste(
      "Dos fórmulas de n conviven: el engine usa round() y el helper común",
      "ceiling(); con N=25000, e=0.05 publican 378 vs 379 y el 378 no",
      "garantiza el margen de error."
    )
  )
})

test_that("D6: un aula con 0 elegibles tiene medida de tamano 0, no positiva", {
  df <- data.frame(eligible_n = c(0, 10, 20))

  # HOY ROJO: `eligible[eligible <= 0] <- 1` le regala MOS 1 al aula vacía y
  # el PPS puede sortearla. Verde: MOS 0 (probabilidad de inclusión nula).
  mos_default <- .cm_aulas_measure_of_size(df, list())
  expect_identical(
    mos_default[[1]], 0,
    info = paste(
      "Un aula con eligible_n = 0 recibe MOS", mos_default[[1]],
      "y entra al bombo PPS con probabilidad positiva."
    )
  )

  mos_winsor <- .cm_aulas_measure_of_size(
    df,
    list(mos_strategy = "eligible_yield_winsorized")
  )
  expect_identical(
    mos_winsor[[1]], 0,
    info = "Con la estrategia winsorizada el aula sin elegibles tambien debe pesar 0."
  )
})

# --- D6: conteo divulgado de aulas que pasaron un gate por NA -----------------

# Bloque sintético de un aula (mismo modelo que el arnés de
# test-calc-muestra-aulas-criterios.R).
.funica_bloque <- function(aula, sids, facultad = "FAC1", nivel = "1",
                           matriculados = 2L) {
  n <- length(sids)
  data.frame(
    student_id = sids,
    aula_id = aula,
    curso_id = paste0("C_", aula),
    curso = paste("Curso", aula),
    horario = "H1",
    facultad = facultad,
    programa = "P1",
    sexo = rep(c("F", "M"), length.out = n),
    edad = 20,
    condicion = "regular",
    nivel = rep(nivel, length.out = n),
    modalidad = "presencial",
    matriculados = matriculados,
    stringsAsFactors = FALSE
  )
}

test_that("D6: cada gate opcional divulga cuantas aulas pasaron por NA", {
  # A1: matriculados 0 -> eligible_ratio NA -> pasa c7 sin señal.
  # A2: señal completa en todo -> pasa con evidencia.
  # A3: facultad y nivel vacíos -> faculty_match_share y level_match_share NA
  #     -> pasa c8_facultad y c8 sin señal.
  base <- rbind(
    .funica_bloque("A1", c("s1", "s2"), matriculados = 0L),
    .funica_bloque("A2", c("s3", "s4")),
    .funica_bloque("A3", c("s5", "s6"), facultad = "", nivel = "")
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = calc_muestra_aulas_normalize_config(list(
      filters = list(
        min_eligible_per_class = 1L,
        require_min_prevalence = TRUE,
        require_faculty_prevalence = TRUE,
        require_cycle_homogeneity = TRUE
      )
    ))
  )
  af <- frame$aula_frame

  # Sanidad del arnés: los NA existen y el gate NA-pasa los dejó entrar.
  expect_true(is.na(af$eligible_ratio[af$classroom_id == "A1"]))
  expect_true(is.na(af$faculty_match_share[af$classroom_id == "A3"]))
  expect_true(is.na(af$level_match_share[af$classroom_id == "A3"]))
  expect_true(all(af$included))

  op <- frame$perfil$opcionales
  expect_identical(names(op), c("c7", "c8_facultad", "c8"))

  # HOY ROJO: ningún bloque por criterio expone el conteo de aulas que
  # pasaron por NA (`is.na(x) | x >= umbral` traga el NA en silencio; solo
  # c8 tiene un diagnóstico aparte en perfil$criterio8 y c7 no tiene
  # ninguno). Verde: cada gate divulga composicion_na_n.
  esperado <- c(c7 = 1L, c8_facultad = 1L, c8 = 1L)
  for (gate in names(esperado)) {
    expect_false(
      is.null(op[[gate]]$composicion_na_n),
      info = sprintf(
        "El gate %s no expone composicion_na_n: las aulas que pasan por NA no se divulgan en la salida de criterios.",
        gate
      )
    )
    expect_identical(
      as.integer(op[[gate]]$composicion_na_n),
      esperado[[gate]],
      info = sprintf("Conteo NA del gate %s", gate)
    )
  }
})
