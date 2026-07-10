# ADR 0030 Fase 2 — Validación reconectada al modelo multi-tabla.
# Verifica que la base madre se ensambla con sus bases hija repeat (llaves
# canónicas de Fase 1) para que las reglas del repeat corran sobre datos reales,
# y que la ausencia de base hija degrada a `no_aplicable` en vez de error.

# Instrumento sintético: madre ancha con un begin_repeat (rep_serv). Contiene las
# preguntas del repeat (sat requerida, monto con constraint) + repeat_count por
# ${n_serv}, y una var madre total_monto para el cruce agregado hija→madre.
.mb_test_inst <- function() {
  survey <- data.frame(
    type = c(
      "text",             # hh_id (required)
      "integer",          # n_serv
      "decimal",          # total_monto (host del aggregate_check)
      "begin_repeat",     # rep_serv, repeat_count = ${n_serv}
      "select_one satis", # sat (required, dentro del repeat)
      "decimal",          # monto (constraint . >= 0, dentro del repeat)
      "end_repeat"
    ),
    name = c("hh_id", "n_serv", "total_monto", "rep_serv", "sat", "monto", "rep_serv"),
    label = c("ID hogar", "Num servicios", "Total monto", "Servicios",
              "Satisfaccion", "Monto", ""),
    required = c("yes", "", "", "", "yes", "", ""),
    relevant = c("", "", "", "", "", "", ""),
    constraint = c("", "", "", "", "", ". >= 0", ""),
    repeat_count = c("", "", "", "${n_serv}", "", "", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("satis", "satis", "satis"),
    name = c("1", "2", "3"),
    label = c("Malo", "Regular", "Bueno"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  meta <- list(section_map = data.frame(
    group_name = "rep_serv",
    is_repeat = TRUE,
    repeat_count = "${n_serv}",
    stringsAsFactors = FALSE,
    check.names = FALSE
  ))
  list(survey = survey, choices = choices, meta = meta)
}

# Madre: H1 con n_serv=2 (tendrá 2 instancias → ok), H2 con n_serv=2 (tendrá 1
# instancia → faltan). total_monto: H1=150 (=suma real), H2=999 (≠ suma real).
.mb_write_mother <- function() {
  df <- data.frame(
    `_index` = c(1L, 2L),
    hh_id = c("H1", "H2"),
    n_serv = c(2L, 2L),
    total_monto = c(150, 999),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "datos")
  openxlsx::writeData(wb, "datos", df)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

# Hija long (rep_serv) con las llaves canónicas ODK/Kobo de la Fase 1.
# 3 instancias: H1×2, H2×1. sat instancia 2 = NA (required flag). monto
# instancia 3 = -5 (constraint flag). Suma monto por padre: H1=150, H2=-5.
.mb_write_child <- function() {
  df <- data.frame(
    `_index` = c(1L, 2L, 3L),
    `_parent_index` = c(1L, 1L, 2L),
    `_parent_table_name` = c("madre", "madre", "madre"),
    `_submission__id` = c("H1", "H1", "H2"),
    sat = c("1", NA, "3"),
    monto = c(100, 50, -5),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "datos")
  openxlsx::writeData(wb, "datos", df)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

# Bundle: reglas inferidas (required/constraint/repeat_length) + aggregate_check
# cruzando la hija (sum monto) contra la madre (total_monto).
.mb_test_bundle <- function(inst) {
  bundle <- build_validation_bundle(
    instrumento = inst,
    incluir = list(
      required = TRUE, other = FALSE, relevant = FALSE, constraint = TRUE,
      calculate = FALSE, choice_filter = FALSE, repeat_min1 = FALSE,
      tiempo_ventana = FALSE
    )
  )
  agg <- rule_aggregate_check(
    host_var = "total_monto", op = "==",
    source_table = "rep_serv", source_var = "monto", agg_op = "sum",
    parent_key_local = "_index", parent_key_remote = "_parent_index",
    tabla = "principal"
  )
  bundle$rules <- c(bundle$rules, list(agg))
  bundle$plan <- compile_rules_to_plan(bundle$rules)
  bundle
}

test_that("assemble_validation_data_multibase arma tables$principal + tables$<repeat_group> con herencia", {
  inst <- .mb_test_inst()
  mother_path <- .mb_write_mother()
  child_path <- .mb_write_child()
  on.exit(unlink(c(mother_path, child_path)), add = TRUE)

  data_ctx <- assemble_validation_data_multibase(
    main_data_path = mother_path,
    main_data_ext = "xlsx",
    main_instrumento = inst,
    repeat_children = list(list(
      repeat_group = "rep_serv", data_path = child_path, data_ext = "xlsx"
    ))
  )

  expect_equal(data_ctx$source, "multibase_repeats")
  expect_true("principal" %in% names(data_ctx$tables))
  expect_true("rep_serv" %in% names(data_ctx$tables))
  expect_equal(nrow(data_ctx$tables$principal), 2L)
  expect_equal(nrow(data_ctx$tables$rep_serv), 3L)

  # .inherit_parent_columns trae columnas de la madre a la hija por _parent_index.
  child <- data_ctx$tables$rep_serv
  expect_true(all(c("hh_id", "n_serv", "total_monto") %in% names(child)))
  expect_equal(as.character(child$hh_id), c("H1", "H1", "H2"))

  # rc_checks del repeat quedaron computados (para repeat_length).
  expect_true("rep_serv" %in% names(data_ctx$rc_checks))
})

test_that("las reglas del repeat se EVALÚAN sobre datos ensamblados (no missing_data_table)", {
  inst <- .mb_test_inst()
  mother_path <- .mb_write_mother()
  child_path <- .mb_write_child()
  on.exit(unlink(c(mother_path, child_path)), add = TRUE)

  data_ctx <- assemble_validation_data_multibase(
    main_data_path = mother_path, main_data_ext = "xlsx",
    main_instrumento = inst,
    repeat_children = list(list(
      repeat_group = "rep_serv", data_path = child_path, data_ext = "xlsx"
    ))
  )
  bundle <- .mb_test_bundle(inst)
  ev <- evaluate_validation_bundle(
    bundle, data_ctx, compatibility = make_validation_compatibility_profile()
  )
  res <- ev$resumen

  # Ninguna regla del repeat cae en missing_data_table / no_evaluada.
  rep_rows <- res[!is.na(res$tabla) & res$tabla == "rep_serv", , drop = FALSE]
  expect_true(nrow(rep_rows) >= 2)
  expect_false(any(!is.na(rep_rows$issue_code) & rep_rows$issue_code == "missing_data_table"))
  expect_false(any(rep_rows$estado_dinamico == "no_evaluada"))

  # (a) required sobre pregunta del repeat (sat): instancia 2 vacía → 1 caso.
  req_rep <- res[res$tipo_regla == "required" & !is.na(res$tabla) & res$tabla == "rep_serv", , drop = FALSE]
  expect_equal(nrow(req_rep), 1L)
  expect_equal(req_rep$n_inconsistencias[1], 1L)

  # (a) constraint sobre pregunta del repeat (monto >= 0): instancia 3 = -5 → 1 caso.
  con_rep <- res[res$tipo_regla == "constraint" & !is.na(res$tabla) & res$tabla == "rep_serv", , drop = FALSE]
  expect_equal(nrow(con_rep), 1L)
  expect_equal(con_rep$n_inconsistencias[1], 1L)

  # (b) repeat_length: H2 tiene 1 instancia pero n_serv=2 → 1 caso, evaluada.
  rl <- res[res$tipo_regla == "repeat_length", , drop = FALSE]
  expect_equal(nrow(rl), 1L)
  expect_equal(rl$estado_dinamico[1], "correcta")
  expect_equal(rl$n_inconsistencias[1], 1L)

  # (c) aggregate_check hija→madre (sum monto vs total_monto): H2 discrepa → 1 caso.
  agg_row <- res[res$tipo_regla == "coherence", , drop = FALSE]
  expect_equal(nrow(agg_row), 1L)
  expect_equal(agg_row$n_inconsistencias[1], 1L)
})

test_that("sin base hija, las reglas del repeat degradan a no_aplicable (no error)", {
  inst <- .mb_test_inst()
  mother_path <- .mb_write_mother()
  on.exit(unlink(mother_path), add = TRUE)

  # Sólo la madre: read_validation_data_ast single-sheet, sin tabla rep_serv.
  data_ctx_solo <- read_validation_data_ast(mother_path, "xlsx", inst)
  expect_false("rep_serv" %in% names(data_ctx_solo$tables))

  bundle <- .mb_test_bundle(inst)
  ev <- evaluate_validation_bundle(
    bundle, data_ctx_solo, compatibility = make_validation_compatibility_profile()
  )
  res <- ev$resumen

  rep_rows <- res[!is.na(res$tabla) & res$tabla == "rep_serv", , drop = FALSE]
  expect_true(nrow(rep_rows) >= 2)
  expect_true(all(rep_rows$estado_dinamico == "no_aplicable"))
  expect_true(all(rep_rows$issue_code == "sin_datos_repeat"))
  expect_false(any(rep_rows$issue_code == "missing_data_table"))
})

test_that("assemble_validation_data_multibase sin hijas delega al lector single-table", {
  inst <- .mb_test_inst()
  mother_path <- .mb_write_mother()
  on.exit(unlink(mother_path), add = TRUE)

  data_ctx <- assemble_validation_data_multibase(
    main_data_path = mother_path, main_data_ext = "xlsx",
    main_instrumento = inst, repeat_children = list()
  )
  # Sin hijas → comportamiento idéntico al lector estándar (no multibase).
  expect_equal(data_ctx$source, "lector_limpieza")
  expect_false("rep_serv" %in% names(data_ctx$tables))
})
