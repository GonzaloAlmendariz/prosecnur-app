# EF2 — Docente único entre titulares (pedido textual de Gonzalo).
#
# Medido antes de implementar: 8 docentes repetidos / 17 aulas en los 203
# titulares vigentes, con casos cruzando facultades; 80 estratos y CERO
# ahogados (docentes_únicos ≥ cuota en todos) → restricción dura viable.
# La reparación es post-sorteo, determinista y REGISTRADA (VARA 0).

.du_frame <- function(filas) {
  df <- do.call(rbind, lapply(filas, function(f) {
    data.frame(
      classroom_id = f[[1]], stratum = f[[2]], teacher = f[[3]],
      eligible_n = f[[4]], included = TRUE, stringsAsFactors = FALSE
    )
  }))
  rownames(df) <- NULL
  df
}

.du_sel <- function(frame, ids, waves = NULL) {
  df <- frame[match(ids, frame$classroom_id), , drop = FALSE]
  df$wave <- waves %||% rep("M1", length(ids))
  rownames(df) <- NULL
  df
}

test_that("el docente repetido en M1 se repara por intercambio en la misma celda", {
  frame <- .du_frame(list(
    list("A1", "FAC1 / F / G1", "PEREZ", 40),
    list("A2", "FAC1 / F / G1", "PEREZ", 35),
    list("A3", "FAC1 / F / G1", "QUISPE", 30),
    list("A4", "FAC1 / F / G1", "ROJAS", 20)
  ))
  sel <- .du_sel(frame, c("A1", "A2"))
  out <- .cm_aulas_docente_unico_reparar(sel, frame, list(docente_unico = TRUE))
  docs <- toupper(trimws(out$teacher[out$wave == "M1"]))
  expect_equal(sum(docs == "PEREZ"), 1L)
  # Entra el mejor candidato por eligible_n de la celda (QUISPE, 30 > 20).
  expect_setequal(out$classroom_id, c("A1", "A3"))
  reg <- attr(out, "docente_unico")
  expect_length(reg$ajustes, 1L)
  expect_identical(reg$ajustes[[1]]$entrante, "A3")
  # El aviso viaja con cifras (VARA 0: registrado, no escondido).
  expect_match(paste(attr(out, "warnings"), collapse = " "), "Docente unico", fixed = TRUE)
})

test_that("la repeticion que cruza estratos tambien se repara (dedup GLOBAL)", {
  frame <- .du_frame(list(
    list("A1", "FAC1 / F / G1", "PEREZ", 40),
    list("B1", "FAC2 / M / G1", "PEREZ", 38),
    list("B2", "FAC2 / M / G1", "SOTO", 22)
  ))
  sel <- .du_sel(frame, c("A1", "B1"))
  out <- .cm_aulas_docente_unico_reparar(sel, frame, list(docente_unico = TRUE))
  docs <- toupper(trimws(out$teacher))
  expect_equal(sum(docs == "PEREZ"), 1L)
  # FAC1 no tiene alternativa (celda de 1): conserva ahí y repara en FAC2.
  expect_true("A1" %in% out$classroom_id)
  expect_true("B2" %in% out$classroom_id)
})

test_that("si el candidato estaba de reserva, la ola recibe al saliente (unicidad global)", {
  frame <- .du_frame(list(
    list("A1", "FAC1 / F / G1", "PEREZ", 40),
    list("A2", "FAC1 / F / G1", "PEREZ", 35),
    list("A3", "FAC1 / F / G1", "QUISPE", 30)
  ))
  sel <- .du_sel(frame, c("A1", "A2", "A3"), waves = c("M1", "M1", "M2"))
  out <- .cm_aulas_docente_unico_reparar(sel, frame, list(docente_unico = TRUE))
  # A3 sube a M1; la fila de ola queda con el saliente A2: nada se duplica.
  expect_equal(sort(as.character(out$classroom_id)), c("A1", "A2", "A3"))
  expect_setequal(out$classroom_id[out$wave == "M1"], c("A1", "A3"))
  expect_identical(as.character(out$classroom_id[out$wave == "M2"]), "A2")
  reg <- attr(out, "docente_unico")
  expect_true(reg$ajustes[[1]]$intercambiado_con_ola)
})

test_that("sin candidato el repetido SE QUEDA y se declara, nunca se pierde cuota", {
  frame <- .du_frame(list(
    list("A1", "FAC1 / F / G1", "PEREZ", 40),
    list("A2", "FAC1 / F / G1", "PEREZ", 35)
  ))
  sel <- .du_sel(frame, c("A1", "A2"))
  out <- .cm_aulas_docente_unico_reparar(sel, frame, list(docente_unico = TRUE))
  expect_equal(nrow(out), 2L)
  expect_setequal(out$classroom_id, c("A1", "A2"))
  reg <- attr(out, "docente_unico")
  expect_length(reg$no_reparables, 1L)
  expect_match(paste(attr(out, "warnings"), collapse = " "), "sin candidato", fixed = TRUE)
})

test_that("con docente_unico = FALSE no toca nada (off-switch)", {
  frame <- .du_frame(list(
    list("A1", "FAC1 / F / G1", "PEREZ", 40),
    list("A2", "FAC1 / F / G1", "PEREZ", 35),
    list("A3", "FAC1 / F / G1", "QUISPE", 30)
  ))
  sel <- .du_sel(frame, c("A1", "A2"))
  out <- .cm_aulas_docente_unico_reparar(sel, frame, list(docente_unico = FALSE))
  expect_setequal(out$classroom_id, c("A1", "A2"))
  expect_false(attr(out, "docente_unico")$activo)
})

test_that("es determinista: la misma entrada produce el mismo intercambio", {
  frame <- .du_frame(list(
    list("A1", "FAC1 / F / G1", "PEREZ", 40),
    list("A2", "FAC1 / F / G1", "PEREZ", 35),
    list("A3", "FAC1 / F / G1", "QUISPE", 30),
    list("A4", "FAC1 / F / G1", "ROJAS", 30)
  ))
  sel <- .du_sel(frame, c("A1", "A2"))
  o1 <- .cm_aulas_docente_unico_reparar(sel, frame, list(docente_unico = TRUE))
  o2 <- .cm_aulas_docente_unico_reparar(sel, frame, list(docente_unico = TRUE))
  expect_identical(as.character(o1$classroom_id), as.character(o2$classroom_id))
  # Empate en eligible_n (A3/A4 con 30): decide classroom_id — A3.
  expect_true("A3" %in% o1$classroom_id)
})

test_that("la config normalizada conserva docente_unico (lista cerrada vigilada)", {
  cfg <- calc_muestra_aulas_normalize_config(list(selector = list(docente_unico = FALSE)))
  expect_false(cfg$selector$docente_unico)
  cfg2 <- calc_muestra_aulas_normalize_config(list())
  expect_true(cfg2$selector$docente_unico)
})

test_that("de punta a punta: seleccionar ya no repite docentes cuando hay alternativa", {
  skip_if_not_installed("sampling")
  ids <- unlist(lapply(1:8, function(i) paste0("s", i, "_", 1:20)))
  base <- data.frame(
    student_id = ids,
    aula_id = rep(paste0("A", 1:8), each = 20),
    curso_id = rep(paste0("C", 1:8), each = 20),
    curso = rep(paste("Curso", 1:8), each = 20),
    horario = "L 8",
    facultad = "FAC1",
    programa = "P1",
    sexo = "F",
    edad = 20,
    condicion = "regular",
    nivel = "3",
    modalidad = "presencial",
    # PEREZ dicta las DOS aulas más grandes: sin EF2 el PPS las toma juntas.
    docente = rep(c("PEREZ", "PEREZ", "SOTO", "QUISPE", "ROJAS", "LUNA", "VEGA", "RIOS"), each = 20),
    stringsAsFactors = FALSE
  )
  base$student_id <- make.unique(base$student_id)
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 77L, n_aulas = 4L, replacement_waves = 1L,
      selector_engine = "sistematico_pps", strata_cols = list("facultad"),
      monte_carlo_n = 0L, simulation_runs = 0L
    )
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  sel <- calc_muestra_aulas_seleccionar(frame, cfg)
  m1 <- sel$selection[sel$selection$sample_role == "titular" | sel$selection$wave == "M1", ]
  docs <- toupper(trimws(as.character(m1$teacher)))
  docs <- docs[nzchar(docs)]
  expect_true(all(table(docs) <= 1L))
  # Y nada se duplica globalmente tras el intercambio.
  expect_equal(anyDuplicated(as.character(sel$selection$classroom_id)), 0L)
})

test_that("el techo de visitas sobrevive al normalizador (lista cerrada vigilada)", {
  cfg <- calc_muestra_aulas_normalize_config(list(selector = list(techo_aulas_visitadas = 200)))
  expect_identical(cfg$selector$techo_aulas_visitadas, 200L)
  # Alias y nivel config; ausente = 0 = sin techo declarado, jamás inventado.
  cfg2 <- calc_muestra_aulas_normalize_config(list(techo_visitas = 250))
  expect_identical(cfg2$selector$techo_aulas_visitadas, 250L)
  expect_identical(calc_muestra_aulas_normalize_config(list())$selector$techo_aulas_visitadas, 0L)
})
