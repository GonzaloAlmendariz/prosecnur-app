# Helper compartido para el blindaje de caracterizacion ("golden") del motor de
# seleccion de aulas. Lo usan tanto el test test-calc-muestra-aulas.R como el
# generador api/tools/gen_golden_aulas.R, para que la logica de fixtures y de
# captura sea IDENTICA de ambos lados y no pueda divergir.
#
# La idea: congelar la salida de seleccion/simulacion producida por el codigo
# ACTUAL en archivos .rds, y exigir identidad byte-a-byte tras el refactor de
# performance O(n^2). Si el refactor cambia una sola aula, orden o score, el
# golden falla.
#
# DEPENDENCIA CRITICA: el motor usa sampling::UPsystematic/samplecube cuando el
# paquete `sampling` esta instalado y cae en silencio a sample(prob = ) cuando
# no lo esta -> la seleccion cambia por completo con la misma semilla. Los tres
# fallos de Quality de 2026-07 no fueron RNG/locale/floats sino que el runner
# no tenia `sampling` (hoy declarado en Suggests). Por eso la captura registra
# el engine efectivamente usado: un fallback se ve como diff legible, no como
# aulas misteriosamente distintas.

# --- Fixtures deterministas -------------------------------------------------
# Cada fixture devuelve list(base = <data.frame>, cfg = <config normalizada>).

# Caso 1: replica exacta del bloque "arma cadenas de reemplazo" (seed 515, 14
# aulas, replacement_waves = 2). Ejercita .cm_aulas_build_replacement_chains.
golden_fixture_cadenas <- function() {
  base <- data.frame(
    student_id = paste0("s", 1:70),
    aula_id = rep(paste0("A", 1:14), each = 5),
    curso_id = rep(paste0("C", 1:14), each = 5),
    curso = rep(paste("Curso", 1:14), each = 5),
    horario = rep(c("manana", "tarde", "noche"), length.out = 70),
    facultad = rep(rep(c("FAC1", "FAC2"), each = 35), length.out = 70),
    programa = rep(c("P1", "P2", "P3", "P4"), length.out = 70),
    sexo = rep(c("F", "M"), length.out = 70),
    edad = 20,
    condicion = "regular",
    nivel = rep(c("1", "2"), length.out = 70),
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 515L,
      n_aulas = 4L,
      replacement_waves = 2L,
      selector_engine = "sistematico_pps",
      strata_cols = list("faculty"),
      balance_vars = list("faculty", "program", "level"),
      # Golden legacy: congela la selección anterior al default ON.
      sequential_discount = FALSE,
      monte_carlo_n = 10L
    )
  ))
  list(base = base, cfg = cfg)
}

# Caso 2: replica exacta del bloque "simulador de reemplazos" (seed 202, 12
# aulas, replacement_waves = 2). Ejercita calc_muestra_aulas_simular_reemplazos.
golden_fixture_simulacion <- function() {
  base <- data.frame(
    student_id = paste0("s", 1:72),
    aula_id = rep(paste0("A", 1:12), each = 6),
    curso_id = rep(paste0("C", 1:12), each = 6),
    curso = rep(paste("Curso", 1:12), each = 6),
    horario = rep(c("manana", "tarde", "noche"), length.out = 72),
    facultad = rep(c("FAC1", "FAC2"), each = 36),
    programa = rep(c("P1", "P2", "P3"), each = 24),
    sexo = rep(c("F", "M"), length.out = 72),
    edad = 20,
    condicion = "regular",
    nivel = rep(c("1", "2"), length.out = 72),
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 202L,
      n_aulas = 4L,
      replacement_waves = 2L,
      selector_engine = "cube_balanceado",
      strata_cols = list("faculty"),
      balance_vars = list("faculty", "program", "level"),
      # Golden legacy: congela la selección anterior al default ON.
      sequential_discount = FALSE,
      monte_carlo_n = 20L
    )
  ))
  list(base = base, cfg = cfg)
}

# Caso 3: escala mayor sintetica (150 aulas, n_aulas = 20, waves = 2) con
# muchas celdas equivalentes -> fuerza empates reales de score que el tie-break
# which.max debe resolver por menor indice global. Es donde un cambio de orden
# del refactor se detecta. monte_carlo_n = 0 para mantener el test agil (la MC
# no altera la seleccion final que capturamos).
golden_fixture_escala <- function() {
  n_aulas_frame <- 150L
  per_class <- 8L
  n_students <- n_aulas_frame * per_class
  aula <- rep(seq_len(n_aulas_frame), each = per_class)
  base <- data.frame(
    student_id = paste0("s", seq_len(n_students)),
    aula_id = paste0("A", aula),
    curso_id = paste0("C", aula),
    curso = paste("Curso", aula),
    horario = rep(c("manana", "tarde", "noche"), length.out = n_students),
    # pocas facultades/programas/niveles -> muchas aulas comparten celda -> empates
    facultad = paste0("FAC", (aula %% 4L) + 1L),
    programa = paste0("P", (aula %% 6L) + 1L),
    sexo = rep(c("F", "M"), length.out = n_students),
    edad = 20,
    condicion = "regular",
    nivel = as.character((aula %% 2L) + 1L),
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 909L,
      n_aulas = 20L,
      replacement_waves = 2L,
      selector_engine = "sistematico_pps",
      strata_cols = list("faculty"),
      balance_vars = list("faculty", "program", "level"),
      # Golden legacy: congela la selección anterior al default ON.
      sequential_discount = FALSE,
      monte_carlo_n = 0L
    )
  ))
  list(base = base, cfg = cfg)
}

golden_fixtures <- function() {
  list(
    cadenas = golden_fixture_cadenas(),
    simulacion = golden_fixture_simulacion(),
    escala = golden_fixture_escala()
  )
}

# --- Captura canonica -------------------------------------------------------
# Normaliza dobles para evitar ruido sub-epsilon manteniendo diferencias reales.
.golden_round <- function(df) {
  for (nm in names(df)) if (is.numeric(df[[nm]]) && is.double(df[[nm]])) df[[nm]] <- round(df[[nm]], 8)
  df
}

# Captura la seleccion: titulares (guardia del RNG aguas arriba) + reservas de
# cadena (el objeto del refactor), en orden estable y solo con columnas
# load-bearing.
golden_capture_selection <- function(selection) {
  rows <- .cm_aulas_as_df(selection$selection)
  cols_res <- c(
    "classroom_id", "replacement_for", "selection_slot_id", "wave",
    "replacement_order", "chain_score", "equivalence_level",
    "active_overlap", "titular_overlap", "eligible_delta_vs_titular"
  )
  cols_res <- intersect(cols_res, names(rows))
  res <- rows[rows$sample_role == "chain_reserve", cols_res, drop = FALSE]
  res <- res[order(res$selection_slot_id, res$replacement_order, res$classroom_id), , drop = FALSE]
  rownames(res) <- NULL

  cols_tit <- intersect(c("classroom_id", "selection_slot_id", "wave", "chain_score"), names(rows))
  tit <- rows[rows$sample_role == "titular", cols_tit, drop = FALSE]
  tit <- tit[order(tit$selection_slot_id, tit$classroom_id), , drop = FALSE]
  rownames(tit) <- NULL

  list(
    engine_used = as.character(selection$selector_engine_used %||% ""),
    titulars = .golden_round(tit),
    reserves = .golden_round(res)
  )
}

# Captura la simulacion de reemplazos: sugerencias e impacto, orden estable.
golden_capture_sim <- function(replacement) {
  sug <- replacement$suggestions
  keep <- intersect(c(
    "titular_classroom_id", "reserve_classroom_id", "rank", "match_level",
    "score", "before_score", "after_score", "score_delta"
  ), names(sug))
  sug <- sug[, keep, drop = FALSE]
  sug <- sug[order(sug$titular_classroom_id, sug$rank, sug$reserve_classroom_id), , drop = FALSE]
  rownames(sug) <- NULL
  .golden_round(sug)
}

# Directorio de golden .rds. Vive en `fixtures/`, NO en `_snaps/`: estos
# goldens se leen con readRDS (no son snapshots de testthat), y testthat
# borra del directorio `_snaps/` todo archivo que no reconozca como snapshot
# "usado" — al skipear los tests de aulas (sin el paquete `sampling`), los
# daba por huerfanos y los eliminaba del control de versiones en cada corrida.
golden_dir <- function() {
  base <- Sys.getenv("GOLDEN_AULAS_DIR", "")
  if (nzchar(base)) return(base)
  # Resolver relativo al archivo de test en ejecucion.
  file.path(testthat::test_path("fixtures"), "golden-aulas")
}

golden_path <- function(name) file.path(golden_dir(), paste0(name, ".rds"))
