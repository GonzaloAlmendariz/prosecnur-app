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
  # Nota: la familia relacional (Fase 3) agrega RC3 (integridad referencial),
  # también tipo `coherence`, para rep_serv; aislamos el aggregate por su flag.
  agg_row <- res[res$tipo_regla == "coherence" & grepl("total_monto", res$flag), , drop = FALSE]
  expect_equal(nrow(agg_row), 1L)
  expect_equal(agg_row$n_inconsistencias[1], 1L)

  # RC3 (integridad referencial) se emite y evalúa limpio (sin huérfanas): los
  # 3 registros hija enlazan con una madre existente.
  rc3_row <- res[res$tipo_regla == "coherence" & grepl("parent_index", res$flag), , drop = FALSE]
  expect_equal(nrow(rc3_row), 1L)
  expect_equal(rc3_row$estado_dinamico[1], "correcta")
  expect_equal(rc3_row$n_inconsistencias[1], 0L)
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

test_that("una hija vacía conserva la tabla repeat y valida cardinalidad cero", {
  inst <- .mb_test_inst()
  mother_path <- .mb_write_mother()
  child_empty <- data.frame(
    `_index` = integer(),
    `_parent_index` = integer(),
    `_parent_table_name` = character(),
    `_submission__id` = character(),
    sat = character(),
    monto = numeric(),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  child_path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "datos")
  openxlsx::writeData(wb, "datos", child_empty)
  openxlsx::saveWorkbook(wb, child_path, overwrite = TRUE)
  on.exit(unlink(c(mother_path, child_path)), add = TRUE)

  data_ctx <- assemble_validation_data_multibase(
    main_data_path = mother_path,
    main_data_ext = "xlsx",
    main_instrumento = inst,
    repeat_children = list(list(
      repeat_group = "rep_serv", data_path = child_path, data_ext = "xlsx"
    ))
  )

  expect_true("rep_serv" %in% names(data_ctx$tables))
  expect_equal(nrow(data_ctx$tables$rep_serv), 0L)
  rc <- data_ctx$rc_checks$rep_serv$by_parent
  expect_equal(rc$want_n, c(2L, 2L))
  expect_equal(rc$have_n, c(0L, 0L))
  expect_equal(rc$status, c("faltan", "faltan"))

  ev <- evaluate_validation_bundle(
    .mb_test_bundle(inst), data_ctx,
    compatibility = make_validation_compatibility_profile()
  )
  rl <- ev$resumen[ev$resumen$tipo_regla == "repeat_length", , drop = FALSE]
  expect_equal(nrow(rl), 1L)
  expect_equal(rl$estado_dinamico[1], "correcta")
  expect_equal(rl$n_inconsistencias[1], 2L)
})

test_that("resolver de repeats acepta contrato relacional no-Kobo, incluido fallback", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  child_file <- save_upload(sid, "data", "repeat_manual.csv",
                            charToRaw("_index,_parent_index,sat\n1,1,ok\n"))
  sibling_file <- save_upload(sid, "data", "hermana.csv",
                              charToRaw("id,respuesta\n1,ok\n"))
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$bases <- list(
    madre = list(nombre = "madre", source_kind = "manual"),
    repeat_manual = list(
      nombre = "repeat_manual",
      source_kind = "manual",
      parent_base = "madre",
      repeat_group = "rep_serv",
      link_key = "_parent_index",
      parent_index_key = "_index",
      data_file_id = child_file$file_id,
      data_ext = "csv"
    ),
    repeat_fallback = list(
      nombre = "repeat_fallback",
      source_kind = "xlsx_repeat",
      parent_base = "madre",
      repeat_group = "rep_fallback",
      link_key = "_submission__id",
      parent_index_key = "_id",
      data_file_id = child_file$file_id,
      data_ext = "csv"
    ),
    hermana = list(
      nombre = "hermana",
      source_kind = "manual",
      parent_base = "madre",
      data_file_id = sibling_file$file_id,
      data_ext = "csv"
    )
  )
  session_set(sid, "estudio", s$estudio)

  resolved <- .validacion_resolve_repeat_children(sid, "madre")
  expect_length(resolved, 2L)
  if (!length(resolved)) return(invisible())
  resolved_by_base <- setNames(resolved, vapply(resolved, `[[`, character(1), "base"))
  expect_setequal(names(resolved_by_base), c("repeat_manual", "repeat_fallback"))
  expect_equal(resolved_by_base$repeat_manual$repeat_group, "rep_serv")
  expect_equal(resolved_by_base$repeat_fallback$repeat_group, "rep_fallback")
  expect_equal(resolved_by_base$repeat_manual$data_path, child_file$path)
})

test_that("repeat_count sólo evalúa referencias exactas y rechaza expresiones complejas no soportadas", {
  parent <- data.frame(n = 3, stringsAsFactors = FALSE, check.names = FALSE)

  expect_equal(ll_eval_repeats_count_expr("${n}", parent), 3)
  expect_true(is.na(ll_eval_repeats_count_expr("${n} + 1", parent)))
  expect_true(is.na(ll_eval_repeats_count_expr("if(${n} > 0, ${n}, 0)", parent)))
})

# =============================================================================
# RC1 (ADR 0030 addendum) — cardinalidad condicionada `count-selected(${var})`
# =============================================================================
# El PDM ACNUR abre rep_servicios con repeat_count = count-selected(${services}):
# una fila hija por servicio marcado en la madre. Antes de RC1,
# ll_eval_repeats_count_expr no reconocía count-selected(...) → want=NA →
# status sin_meta → la regla repeat_length reportaba `correcta` con 0
# inconsistencias (FALSO NEGATIVO). Ahora want = nº de opciones marcadas.

# Instrumento: madre con un select_multiple `services` (list svc) y un
# begin_repeat `rep_servicios` cuya cardinalidad es count-selected(${services}).
.mb_cs_inst <- function() {
  survey <- data.frame(
    type = c(
      "text",                # hh_id (required)
      "select_multiple svc", # services (gobierna la cardinalidad del repeat)
      "begin_repeat",        # rep_servicios, repeat_count = count-selected(${services})
      "select_one satis",    # sat (required, dentro del repeat)
      "end_repeat"
    ),
    name = c("hh_id", "services", "rep_servicios", "sat", "rep_servicios"),
    label = c("ID hogar", "Servicios marcados", "Servicios", "Satisfaccion", ""),
    required = c("yes", "", "", "yes", ""),
    relevant = c("", "", "", "", ""),
    constraint = c("", "", "", "", ""),
    repeat_count = c("", "", "count-selected(${services})", "", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("svc", "svc", "svc", "satis", "satis", "satis"),
    name = c("health", "water", "food", "1", "2", "3"),
    label = c("Salud", "Agua", "Alimentos", "Malo", "Regular", "Bueno"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  meta <- list(section_map = data.frame(
    group_name = "rep_servicios",
    is_repeat = TRUE,
    repeat_count = "count-selected(${services})",
    stringsAsFactors = FALSE,
    check.names = FALSE
  ))
  list(survey = survey, choices = choices, meta = meta)
}

# Hija: H1×2 filas, H2×2 filas (mismo # de filas para ambos padres; la
# discrepancia la crea el # de opciones marcadas en la madre, no el # de filas).
.mb_cs_write_child <- function() {
  df <- data.frame(
    `_index` = c(1L, 2L, 3L, 4L),
    `_parent_index` = c(1L, 1L, 2L, 2L),
    `_parent_table_name` = rep("madre", 4L),
    `_submission__id` = c("H1", "H1", "H2", "H2"),
    sat = c("1", "2", "3", "1"),
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

# Helper: escribe una madre de 2 filas y ensambla el data_ctx multibase.
.mb_cs_assemble <- function(mother_df) {
  inst <- .mb_cs_inst()
  mother_path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "datos")
  openxlsx::writeData(wb, "datos", mother_df)
  openxlsx::saveWorkbook(wb, mother_path, overwrite = TRUE)
  child_path <- .mb_cs_write_child()

  data_ctx <- assemble_validation_data_multibase(
    main_data_path = mother_path, main_data_ext = "xlsx",
    main_instrumento = inst,
    repeat_children = list(list(
      repeat_group = "rep_servicios", data_path = child_path, data_ext = "xlsx"
    ))
  )
  attr(data_ctx, "cleanup") <- c(mother_path, child_path)
  data_ctx
}

test_that("RC1: count-selected(${services}) — formato string — status ok/faltan (no sin_meta)", {
  # H1 marca 2 servicios (=2 filas → ok); H2 marca 3 (=2 filas → faltan).
  mother <- data.frame(
    `_index` = c(1L, 2L),
    hh_id = c("H1", "H2"),
    services = c("health water", "health water food"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  data_ctx <- .mb_cs_assemble(mother)
  on.exit(unlink(attr(data_ctx, "cleanup")), add = TRUE)

  rc <- data_ctx$rc_checks$rep_servicios$by_parent
  expect_true(all(c("want_n", "have_n", "status") %in% names(rc)))
  expect_equal(rc$want_n, c(2L, 3L))   # antes de RC1: NA
  expect_equal(rc$have_n, c(2L, 2L))
  expect_equal(rc$status, c("ok", "faltan"))
  expect_false(any(rc$status == "sin_meta"))
})

test_that("RC1: count-selected(${services}) — formato dummy — cuenta columnas marcadas", {
  # H1: 2 dummies en 1 → 2 marcadas (=2 filas → ok). H2: 3 en 1 → 3 (=2 → faltan).
  mother <- data.frame(
    `_index` = c(1L, 2L),
    hh_id = c("H1", "H2"),
    `services/health` = c(1L, 1L),
    `services/water` = c(1L, 1L),
    `services/food` = c(0L, 1L),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  data_ctx <- .mb_cs_assemble(mother)
  on.exit(unlink(attr(data_ctx, "cleanup")), add = TRUE)

  rc <- data_ctx$rc_checks$rep_servicios$by_parent
  expect_equal(rc$want_n, c(2L, 3L))
  expect_equal(rc$have_n, c(2L, 2L))
  expect_equal(rc$status, c("ok", "faltan"))
})

test_that("RC1: la regla repeat_length ya se EVALÚA y flaggea la discrepancia real", {
  mother <- data.frame(
    `_index` = c(1L, 2L),
    hh_id = c("H1", "H2"),
    services = c("health water", "health water food"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  data_ctx <- .mb_cs_assemble(mother)
  on.exit(unlink(attr(data_ctx, "cleanup")), add = TRUE)

  inst <- .mb_cs_inst()
  bundle <- build_validation_bundle(
    instrumento = inst,
    incluir = list(
      required = TRUE, other = FALSE, relevant = FALSE, constraint = FALSE,
      calculate = FALSE, choice_filter = FALSE, repeat_min1 = FALSE,
      tiempo_ventana = FALSE
    )
  )
  ev <- evaluate_validation_bundle(
    bundle, data_ctx, compatibility = make_validation_compatibility_profile()
  )
  res <- ev$resumen

  rl <- res[res$tipo_regla == "repeat_length", , drop = FALSE]
  expect_equal(nrow(rl), 1L)
  # Ya NO cae en no_evaluada/sin_meta: la cardinalidad condicionada se evalúa.
  expect_false(rl$estado_dinamico[1] %in% c("no_evaluada", "sin_meta"))
  # H2: marca 3 servicios pero solo tiene 2 filas → 1 inconsistencia real.
  expect_equal(rl$n_inconsistencias[1], 1L)
})

# =============================================================================
# Fase 3 (ADR 0030 addendum) — familia "coherencia relacional del repeat"
# =============================================================================
# RC2 · presencia por gate (repeat_length + gate del begin_repeat)
# RC3 · integridad referencial (op referential_parent_exists)
# RC4 · unicidad de roster (rule_duplicate sobre (_parent_index, current_code))
# RC5 · correspondencia roster↔selección (op roster_set_cmp)
# El PDM abre rep_servicios si Consent='yes' con repeat_count=count-selected(
# ${services}); cada instancia lleva current_code (jr:choice-name) que indexa el
# MISMO list_name que ${services}, más su batería srv_*.

# Instrumento relacional: consent (gate), services (SM conductor), begin_repeat
# rep_servicios con relevant=${consent}='yes' + repeat_count=count-selected +
# calculate current_code (jr:choice-name) + sat.
.mb_rel_inst <- function() {
  survey <- data.frame(
    type = c(
      "select_one yesno",     # consent (gate del repeat)
      "select_multiple svc",  # services (conductor de la cardinalidad)
      "begin_repeat",         # rep_servicios
      "calculate",            # current_code (identidad de roster)
      "select_one satis",     # sat
      "end_repeat"
    ),
    name = c("consent", "services", "rep_servicios", "current_code", "sat", "rep_servicios"),
    label = c("Consentimiento", "Servicios", "Servicios", "Codigo actual", "Satisfaccion", ""),
    required = c("", "", "", "", "", ""),
    relevant = c("", "", "${consent} = 'yes'", "", "", ""),
    constraint = c("", "", "", "", "", ""),
    calculation = c("", "", "", "jr:choice-name(${services}, position(..))", "", ""),
    repeat_count = c("", "", "count-selected(${services})", "", "", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("yesno", "yesno", "svc", "svc", "svc", "satis", "satis", "satis"),
    name = c("yes", "no", "health", "water", "food", "1", "2", "3"),
    label = c("Si", "No", "Salud", "Agua", "Alimentos", "Malo", "Regular", "Bueno"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  meta <- list(section_map = data.frame(
    group_name = "rep_servicios",
    is_repeat = TRUE,
    repeat_count = "count-selected(${services})",
    stringsAsFactors = FALSE,
    check.names = FALSE
  ))
  list(survey = survey, choices = choices, meta = meta)
}

.mb_write_xlsx <- function(df) {
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "datos")
  openxlsx::writeData(wb, "datos", df)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.mb_rel_assemble <- function(mother_df, child_df) {
  inst <- .mb_rel_inst()
  mother_path <- .mb_write_xlsx(mother_df)
  child_path <- .mb_write_xlsx(child_df)
  data_ctx <- assemble_validation_data_multibase(
    main_data_path = mother_path, main_data_ext = "xlsx",
    main_instrumento = inst,
    repeat_children = list(list(
      repeat_group = "rep_servicios", data_path = child_path, data_ext = "xlsx"
    ))
  )
  attr(data_ctx, "cleanup") <- c(mother_path, child_path)
  data_ctx
}

.mb_rel_bundle <- function() {
  build_validation_bundle(
    instrumento = .mb_rel_inst(),
    incluir = list(
      required = FALSE, other = FALSE, relevant = FALSE, constraint = FALSE,
      calculate = FALSE, choice_filter = FALSE, repeat_min1 = FALSE,
      tiempo_ventana = FALSE
    )
  )
}

test_that("Fase 3: la familia relacional se emite (RC3/RC4/RC5) y cada op compila + ast_is_valid", {
  bundle <- .mb_rel_bundle()
  rules <- bundle$rules
  tipos <- vapply(rules, function(r) r$tipo_regla, character(1))
  flags <- vapply(rules, function(r) r$flag_name, character(1))

  rc3 <- Filter(function(r) r$tipo_regla == "coherence" && grepl("parent_index", r$flag_name), rules)
  rc4 <- Filter(function(r) r$tipo_regla == "duplicate", rules)
  rc5 <- Filter(function(r) r$tipo_regla == "coherence" && grepl("services", r$flag_name), rules)
  rc2 <- Filter(function(r) r$tipo_regla == "repeat_length", rules)

  expect_length(rc3, 1L)
  expect_length(rc4, 1L)
  expect_length(rc5, 1L)
  expect_length(rc2, 1L)

  # Enum cerrado: cada op nuevo pasa ast_is_valid y compila a R parseable.
  for (r in c(rc3, rc5)) {
    expect_true(ast_is_valid(r$predicate)$ok)
    rhs <- ast_to_r(r$predicate)
    expect_silent(parse(text = rhs))
  }
  # RC2: la regla repeat_length trae el gate del begin_repeat (relevant).
  expect_true(is_ast(rc2[[1]]$gate))
  # Familia visual: subtipo semántico "relacional" en presentation.
  expect_equal(rc3[[1]]$presentation$subtipo_semantico, "relacional")
  expect_equal(rc4[[1]]$presentation$subtipo_semantico, "relacional")
  expect_equal(rc5[[1]]$presentation$subtipo_semantico, "relacional")
})

test_that("RC4: current_code duplicado bajo un mismo _parent_index → flag", {
  # rule_duplicate sobre (_parent_index, current_code): dos filas del mismo padre
  # con el mismo código → duplicado (2 filas flaggeadas).
  child <- data.frame(
    `_index` = c(1L, 2L, 3L),
    `_parent_index` = c(1L, 1L, 2L),
    current_code = c("health", "health", "food"),  # duplicado en padre 1
    check.names = FALSE, stringsAsFactors = FALSE
  )
  rc4 <- rule_duplicate(c("_parent_index", "current_code"), tabla = "rep_servicios",
                        severidad = "advertencia")
  ev <- evaluate_rules(list(rc4), data = child, table_name = "rep_servicios")
  expect_equal(ev$resumen$estado[1], "correcta")
  expect_equal(ev$resumen$n_inconsistencias[1], 2L)  # las 2 filas del par duplicado

  # Sin duplicados → 0.
  child_ok <- data.frame(
    `_index` = c(1L, 2L, 3L),
    `_parent_index` = c(1L, 1L, 2L),
    current_code = c("health", "water", "food"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  ev_ok <- evaluate_rules(list(rc4), data = child_ok, table_name = "rep_servicios")
  expect_equal(ev_ok$resumen$n_inconsistencias[1], 0L)
})

test_that("RC3: fila hija con _parent_index inexistente → 1 huérfana", {
  mother <- data.frame(
    `_index` = c(1L, 2L),
    consent = c("yes", "yes"),
    services = c("health water", "food"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  child <- data.frame(
    `_index` = c(1L, 2L, 3L),
    `_parent_index` = c(1L, 1L, 99L),  # 99 no existe en la madre → huérfana
    current_code = c("health", "water", "food"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  rc3 <- rule_referential_parent_exists("rep_servicios")
  ev <- evaluate_rules(
    list(rc3), data = child,
    data_multi = list(principal = mother, rep_servicios = child),
    table_name = "rep_servicios"
  )
  expect_equal(ev$resumen$estado[1], "correcta")
  expect_equal(ev$resumen$n_inconsistencias[1], 1L)

  # Sin tabla padre en data_multi → no marca (conservador, sin falso positivo).
  ev_solo <- evaluate_rules(list(rc3), data = child, table_name = "rep_servicios")
  expect_equal(ev_solo$resumen$n_inconsistencias[1], 0L)
})

test_that("RC5: madre {health,water} vs roster {health,food} → viola con falta/sobra; setequal → ok", {
  mother <- data.frame(
    `_index` = c(1L, 2L),
    services = c("health water", "food"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  # Roster: padre 1 = {health,food} (≠ {health,water}); padre 2 = {food} (= {food}).
  child <- data.frame(
    `_index` = c(1L, 2L, 3L),
    `_parent_index` = c(1L, 1L, 2L),
    current_code = c("health", "food", "food"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  rc5 <- rule_roster_correspondence("services", "rep_servicios", "current_code")
  ev <- evaluate_rules(
    list(rc5), data = mother,
    data_multi = list(rep_servicios = child),
    table_name = "principal"
  )
  expect_equal(ev$resumen$estado[1], "correcta")
  expect_equal(ev$resumen$n_inconsistencias[1], 1L)  # solo el padre 1 discrepa

  # Subtipos: falta_en_roster = marcado sin fila (water); sobra_en_roster = fila
  # sin marcar (food) — expuestos por el helper de dominio.
  diff <- .vd_roster_set_eval("services", "rep_servicios", "current_code",
                              "_index", "_parent_index", mother,
                              list(rep_servicios = child))
  expect_equal(diff$violation, c(TRUE, FALSE))
  expect_equal(diff$falta_en_roster[[1]], "water")
  expect_equal(diff$sobra_en_roster[[1]], "food")
  expect_length(diff$falta_en_roster[[2]], 0L)  # padre 2 setequal → sin subtipos
  expect_length(diff$sobra_en_roster[[2]], 0L)
})

test_that("RC2: gate cerrado (Consent='no') con filas hija → sobran_gate_cerrado; gate TRUE sigue RC1", {
  # Escenario A — gate cerrado con registros: H1 consent=yes (2 marcados, 2 filas
  # → ok); H2 consent=no (sección no debía abrir) pero tiene 1 fila hija.
  mother_a <- data.frame(
    `_index` = c(1L, 2L),
    consent = c("yes", "no"),
    services = c("health water", ""),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  child_a <- data.frame(
    `_index` = c(1L, 2L, 3L),
    `_parent_index` = c(1L, 1L, 2L),
    `_parent_table_name` = rep("madre", 3L),
    current_code = c("health", "water", "food"),
    sat = c("1", "2", "3"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  data_ctx_a <- .mb_rel_assemble(mother_a, child_a)
  on.exit(unlink(attr(data_ctx_a, "cleanup")), add = TRUE)

  ev_a <- evaluate_validation_bundle(
    .mb_rel_bundle(), data_ctx_a, compatibility = make_validation_compatibility_profile()
  )
  rl_a <- ev_a$resumen[ev_a$resumen$tipo_regla == "repeat_length", , drop = FALSE]
  expect_equal(nrow(rl_a), 1L)
  expect_equal(rl_a$estado_dinamico[1], "correcta")
  expect_true(rl_a$n_inconsistencias[1] >= 1L)  # H2 gate cerrado con fila hija
  expect_match(rl_a$detalle[1], "sobran_gate_cerrado", fixed = TRUE)

  # Escenario B — gate abierto en ambas: H1 consent=yes (2 marcados, 2 filas →
  # ok); H2 consent=yes (3 marcados, 2 filas → faltan, RC1). NO gate_cerrado.
  mother_b <- data.frame(
    `_index` = c(1L, 2L),
    consent = c("yes", "yes"),
    services = c("health water", "health water food"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  child_b <- data.frame(
    `_index` = c(1L, 2L, 3L, 4L),
    `_parent_index` = c(1L, 1L, 2L, 2L),
    `_parent_table_name` = rep("madre", 4L),
    current_code = c("health", "water", "health", "water"),
    sat = c("1", "2", "3", "1"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  data_ctx_b <- .mb_rel_assemble(mother_b, child_b)
  on.exit(unlink(attr(data_ctx_b, "cleanup")), add = TRUE)

  ev_b <- evaluate_validation_bundle(
    .mb_rel_bundle(), data_ctx_b, compatibility = make_validation_compatibility_profile()
  )
  rl_b <- ev_b$resumen[ev_b$resumen$tipo_regla == "repeat_length", , drop = FALSE]
  expect_equal(rl_b$n_inconsistencias[1], 1L)  # H2 faltan (RC1), gate abierto
  expect_false(isTRUE(grepl("sobran_gate_cerrado", as.character(rl_b$detalle[1]))))
})

test_that("Fase 3 end-to-end: RC3 y RC5 se evalúan sobre madre+hija ensambladas", {
  # Datos sanos: roster ≡ selección, sin huérfanas.
  mother <- data.frame(
    `_index` = c(1L, 2L),
    consent = c("yes", "yes"),
    services = c("health water", "food"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  child <- data.frame(
    `_index` = c(1L, 2L, 3L),
    `_parent_index` = c(1L, 1L, 2L),
    `_parent_table_name` = rep("madre", 3L),
    current_code = c("health", "water", "food"),
    sat = c("1", "2", "3"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  data_ctx <- .mb_rel_assemble(mother, child)
  on.exit(unlink(attr(data_ctx, "cleanup")), add = TRUE)

  ev <- evaluate_validation_bundle(
    .mb_rel_bundle(), data_ctx, compatibility = make_validation_compatibility_profile()
  )
  res <- ev$resumen

  # RC3 (tabla rep_servicios) se evalúa (no missing_data_table) y sale limpio.
  rc3 <- res[res$tipo_regla == "coherence" & grepl("parent_index", res$flag), , drop = FALSE]
  expect_equal(nrow(rc3), 1L)
  expect_equal(rc3$estado_dinamico[1], "correcta")
  expect_equal(rc3$n_inconsistencias[1], 0L)

  # RC5 (tabla principal) se evalúa y sale limpio (roster ≡ selección): smoke
  # test de que count-selected y current_code indexan el mismo list_name.
  rc5 <- res[res$tipo_regla == "coherence" & grepl("services", res$flag), , drop = FALSE]
  expect_equal(nrow(rc5), 1L)
  expect_equal(rc5$estado_dinamico[1], "correcta")
  expect_equal(rc5$n_inconsistencias[1], 0L)
})
