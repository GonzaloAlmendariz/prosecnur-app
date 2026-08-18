# La afijación del diseño viaja a la selección (calc_muestra_aulas_afijacion.R).
#
# El cálculo publica `aulas_base` POR FACULTAD pero el reparto del sorteo
# ponderaba solo por masa de elegibles: medido en HSVG2026, DERECHO diseño 18
# -> sorteo 36 y ARQUITECTURA 15 -> 7 (desvío 68/202). Estos tests fijan el
# contrato de `selector$faculty_targets`: el nivel facultad respeta el target,
# el nivel intra-facultad reparte por masa como siempre, y SIN targets el
# comportamiento es byte-idéntico al histórico.
#
# Los fixtures rompen el empate a propósito: la facultad GRANDE tiene ~8x la
# masa de la CHICA, así que el reparto proporcional daría ~9/1 y los targets
# exigen 3/7 — un mutante que anule el nivel facultad no puede pasar.

.afij_frame <- function() {
  df <- data.frame(
    stratum = c(rep("grande", 10), rep("chica", 10)),
    faculty = c(rep("FACULTAD GRANDE", 10), rep("FACULTAD CHICA", 10)),
    eligible_n = c(rep(30, 10), rep(4, 10)),
    stringsAsFactors = FALSE
  )
  df$classroom_id <- paste0("A", seq_len(nrow(df)))
  df
}

test_that("los targets normalizan por clave canónica y descartan basura", {
  entrada <- stats::setNames(
    list(15, "8", 3, -2, "nada"),
    c("ARQUITECTURA Y URBANISMO", "gestión", "", "X", "Y")
  )
  t <- .cm_afijacion_normalize_targets(entrada)
  expect_identical(t$arquitectura_y_urbanismo, 15L)
  expect_identical(t$gestion, 8L)
  expect_length(t, 2L)
})

test_that("sin targets el dispatcher es byte-idéntico al reparto histórico", {
  df <- .afij_frame()
  expect_identical(
    .cm_aulas_quota_estratos(df, 10L, list()),
    .cm_aulas_quota_by_stratum(df, 10L)
  )
})

test_that("con targets el nivel FACULTAD manda sobre la masa de elegibles", {
  df <- .afij_frame()
  # Proporcional daría ~9 a la grande y ~1 a la chica (masa 300 vs 40).
  q <- .cm_aulas_quota_estratos(df, 10L, list(faculty_targets = list(
    "FACULTAD GRANDE" = 3, "FACULTAD CHICA" = 7
  )))
  expect_identical(as.integer(q[["grande"]]), 3L)
  expect_identical(as.integer(q[["chica"]]), 7L)
})

test_that("un target mayor que lo disponible se capa y NO se redistribuye", {
  df <- .afij_frame()
  q <- .cm_aulas_quota_estratos(df, 20L, list(faculty_targets = list(
    "FACULTAD GRANDE" = 2, "FACULTAD CHICA" = 15
  )))
  expect_identical(as.integer(q[["chica"]]), 10L)
  expect_identical(as.integer(q[["grande"]]), 2L)
  expect_identical(sum(q), 12L)
})

test_that("las facultades sin target se reparten el remanente como antes", {
  df <- rbind(.afij_frame(), data.frame(
    stratum = rep("tercera", 5), faculty = rep("FACULTAD TERCERA", 5),
    eligible_n = rep(10, 5), classroom_id = paste0("T", 1:5),
    stringsAsFactors = FALSE
  ))
  q <- .cm_aulas_quota_estratos(df, 10L, list(faculty_targets = list("FACULTAD GRANDE" = 4)))
  expect_identical(as.integer(q[["grande"]]), 4L)
  # El remanente (6) se reparte entre chica y tercera por masa (40 vs 50).
  expect_identical(sum(q[c("chica", "tercera")]), 6L)
  expect_true(q[["tercera"]] >= q[["chica"]])
})

test_that("la selección de punta a punta respeta la afijación declarada", {
  alumnos <- function(fac, n_aulas, alumnos_por_aula, pref) {
    do.call(rbind, lapply(seq_len(n_aulas), function(i) data.frame(
      student_id = paste0(pref, i, "_", seq_len(alumnos_por_aula)),
      aula_id = paste0(pref, i),
      curso_id = paste0("C", pref, i),
      curso = paste("Curso", pref, i),
      horario = paste("L", i),
      facultad = fac,
      programa = "P1",
      sexo = rep(c("F", "M"), length.out = alumnos_por_aula),
      edad = 20,
      condicion = "regular",
      nivel = "pregrado",
      modalidad = "presencial",
      stringsAsFactors = FALSE
    )))
  }
  base <- rbind(
    alumnos("FACULTAD GRANDE", 10, 12, "G"),
    alumnos("FACULTAD CHICA", 10, 3, "H")
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 42L, n_aulas = 10L, replacement_waves = 0L,
      selector_engine = "estratificado_aleatorio",
      simulation_runs = 0L, monte_carlo_n = 0L,
      strata_cols = list("faculty"),
      faculty_targets = list("FACULTAD GRANDE" = 3, "FACULTAD CHICA" = 7)
    )
  ))
  # La whitelist del normalizador conserva los targets (patrón S2: una lista
  # cerrada se traga lo que no reconoce — este expect lo vigila).
  expect_identical(cfg$selector$faculty_targets$facultad_grande, 3L)
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  selection <- calc_muestra_aulas_seleccionar(frame, cfg)
  m1 <- selection$selection[selection$selection$wave == "M1", ]
  conteo <- table(m1$faculty)
  expect_identical(as.integer(conteo[["FACULTAD GRANDE"]]), 3L)
  expect_identical(as.integer(conteo[["FACULTAD CHICA"]]), 7L)
})

test_that("un estrato que cruza facultades falla FUERTE, no aplica al azar", {
  df <- .afij_frame()
  df$stratum <- "global"
  expect_error(
    .cm_aulas_quota_estratos(df, 10L, list(faculty_targets = list("FACULTAD GRANDE" = 3))),
    "UNA facultad"
  )
})
