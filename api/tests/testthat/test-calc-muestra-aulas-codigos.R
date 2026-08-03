.codigos_aulas_fixture <- function() {
  n_aulas <- 8L
  per_class <- 4L
  aula <- rep(seq_len(n_aulas), each = per_class)
  base <- data.frame(
    student_id = paste0("s", seq_along(aula)),
    aula_id = paste0("A", aula),
    curso_id = paste0("C", aula),
    curso = paste("Curso", aula),
    horario = rep(c("L 8", "M 10"), length.out = length(aula)),
    facultad = ifelse(aula <= 4L, "FAC1", "FAC2"),
    programa = paste0("P", (aula %% 2L) + 1L),
    sexo = rep(c("F", "M"), length.out = length(aula)),
    edad = 20,
    condicion = "regular",
    nivel = "pregrado",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  config <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = 1702L,
      n_aulas = 2L,
      replacement_waves = 1L,
      selector_engine = "sistematico_pps",
      strata_cols = list("faculty"),
      simulation_runs = 0L,
      monte_carlo_n = 0L
    )
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = config)
  selection <- calc_muestra_aulas_seleccionar(frame, config)
  list(frame = frame, selection = selection)
}

.expect_codigos_aulas_canonicos <- function(df) {
  exact <- c(
    "operational_code", "titular_operational_code",
    "replacement_chain_code", "first_replacement_code",
    "reserve_operational_code", "replacement_operational_code"
  )
  code_cols <- names(df)[
    names(df) %in% exact |
      grepl("^m[0-9]+_operational_code$", names(df))
  ]
  expect_gt(length(code_cols), 0L)
  for (column in code_cols) {
    values <- trimws(as.character(df[[column]]))
    values <- values[!is.na(values) & nzchar(values)]
    expect_true(
      all(grepl("^(CH [0-9]+|R [0-9]+\\.[0-9]+|EXTRA [0-9]+)$", values)),
      info = paste("columna XLSX no canónica:", column)
    )
  }
}

test_that("helper canónico acepta CH/R e históricos AULA/Rn.k idempotentemente", {
  historical_and_current <- c(
    "CH 5", "CH5", "AULA 5", "aula005",
    "R 5.1", "R5.1", "r 005 . 01",
    "EXTRA 2", "custom", "", NA_character_
  )
  expected <- c(
    "CH 5", "CH 5", "CH 5", "CH 5",
    "R 5.1", "R 5.1", "R 5.1",
    "EXTRA 2", "custom", "", ""
  )

  canonical <- .cm_aulas_codigo_operativo(historical_and_current)
  expect_identical(unname(canonical), expected)
  expect_identical(
    unname(.cm_aulas_codigo_operativo(canonical)),
    expected
  )

  generated <- .cm_aulas_codigo_operativo(
    role = c("titular", "chain_reserve", "extra_reserve_pool"),
    slot_number = c(5L, 5L, NA_integer_),
    replacement_order = c(NA_integer_, 2L, NA_integer_),
    extra_index = c(NA_integer_, NA_integer_, 3L)
  )
  expect_identical(unname(generated), c("CH 5", "R 5.2", "EXTRA 3"))
})

test_that("asignación extraída genera CH n y R n.k sin cambiar cadenas", {
  raw <- data.frame(
    classroom_id = c("A1", "A2", "A3"),
    sample_role = c("titular", "chain_reserve", "extra_reserve_pool"),
    wave = c("M1", "M2", "POOL"),
    selection_slot_id = c("slot_005", "slot_005", ""),
    replacement_order = c(0L, 1L, NA_integer_),
    replacement_for = c("", "A1", ""),
    stringsAsFactors = FALSE
  )

  assigned <- .cm_aulas_assign_operational_codes(raw)

  expect_identical(assigned$operational_code, c("CH 5", "R 5.1", "EXTRA 1"))
  expect_identical(assigned$titular_operational_code, c("CH 5", "CH 5", ""))
  expect_identical(assigned$replacement_chain_code, c("", "R 5.1", ""))
  expect_identical(assigned$replacement_for, raw$replacement_for)
})

test_that("engine emite códigos operativos canónicos en selección y diagnósticos", {
  result <- .codigos_aulas_fixture()
  selection <- .cm_aulas_as_df(result$selection$selection)
  roles <- .cm_aulas_role_values(selection)
  titulars <- selection[roles == "titular", , drop = FALSE]
  replacements <- selection[roles == "chain_reserve", , drop = FALSE]
  chains <- .cm_aulas_as_df(result$selection$diagnostics$replacement_chains)

  expect_true(all(grepl("^CH [0-9]+$", titulars$operational_code)))
  expect_true(all(grepl("^R [0-9]+\\.[0-9]+$", replacements$operational_code)))
  expect_true(all(replacements$titular_operational_code %in% titulars$operational_code))
  expect_identical(replacements$replacement_chain_code, replacements$operational_code)
  expect_true(all(grepl("^CH [0-9]+$", chains$titular_operational_code)))
  expect_true(all(grepl("^R [0-9]+\\.[0-9]+$", chains$first_replacement_code)))
})

test_that("XLSX central canoniza selección histórica en todas sus hojas operativas", {
  skip_if_not_installed("openxlsx")
  result <- .codigos_aulas_fixture()
  legacy <- result$selection
  selection <- .cm_aulas_as_df(legacy$selection)
  selection$operational_code <- sub("^CH ", "AULA ", selection$operational_code)
  selection$operational_code <- sub("^R ", "R", selection$operational_code)
  selection$titular_operational_code <- sub(
    "^CH ",
    "AULA ",
    selection$titular_operational_code
  )
  selection$replacement_chain_code <- sub(
    "^R ",
    "R",
    selection$replacement_chain_code
  )
  legacy$selection <- selection
  chains <- .cm_aulas_as_df(legacy$diagnostics$replacement_chains)
  chains$titular_operational_code <- sub(
    "^CH ",
    "AULA ",
    chains$titular_operational_code
  )
  chains$first_replacement_code <- sub(
    "^R ",
    "R",
    chains$first_replacement_code
  )
  legacy$diagnostics$replacement_chains <- chains

  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  calc_muestra_aulas_exportar_workbook(result$frame, legacy, path)

  exported_selection <- openxlsx::read.xlsx(path, sheet = "Seleccion")
  exported_titulars <- openxlsx::read.xlsx(path, sheet = "Aulas titulares")
  exported_chains <- openxlsx::read.xlsx(path, sheet = "Reemplazos por titular")
  exported_routes <- openxlsx::read.xlsx(path, sheet = "Rutas operativas aulas")
  .expect_codigos_aulas_canonicos(exported_selection)
  .expect_codigos_aulas_canonicos(exported_titulars)
  .expect_codigos_aulas_canonicos(exported_chains)
  .expect_codigos_aulas_canonicos(exported_routes)
})
