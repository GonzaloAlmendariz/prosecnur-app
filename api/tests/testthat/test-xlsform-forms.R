# Tests de la colección multi-formulario del editor XLSForm.
# Invariante crítica: s$xlsform_state (espejo legacy) nunca se desincroniza del
# formulario activo de la colección.

# --- Helpers de fixtures ------------------------------------------------------

make_workbook <- function(form_title = NULL, extra = list()) {
  settings_rows <- if (is.null(form_title)) list() else list(list(form_title, "id1", "1", "es"))
  wb <- list(
    survey = list(
      columns = list("type", "name", "label"),
      rows = list(list("text", "q1", "Pregunta 1"))
    ),
    choices = list(columns = list("list_name", "name", "label"), rows = list()),
    settings = list(
      columns = list("form_title", "form_id", "version", "default_language"),
      rows = settings_rows
    )
  )
  utils::modifyList(wb, extra)
}

make_state <- function(form_title = NULL, original_name = NA_character_,
                       saved_at = "2026-01-01T00:00:00Z", extra_wb = list()) {
  list(
    workbook = make_workbook(form_title, extra_wb),
    source = list(kind = "xlsform", original_name = original_name),
    hallazgos = list(),
    saved_at = saved_at
  )
}

# --- deriveFormName cascada ---------------------------------------------------

test_that("deriveFormName respeta la cascada override > form_title > source > fallback", {
  wb_titled <- make_workbook("Encuesta Docentes")
  expect_equal(.xlsform_forms_derive_name(wb_titled, list()), "Encuesta Docentes")

  # override gana a todo
  expect_equal(
    .xlsform_forms_derive_name(wb_titled, list(), override = "Nombre Manual"),
    "Nombre Manual"
  )

  # sin form_title cae a source.original_name sin extensión
  wb_plain <- make_workbook(NULL)
  expect_equal(
    .xlsform_forms_derive_name(wb_plain, list(original_name = "cuestionario_v2.xlsx")),
    "cuestionario_v2"
  )

  # sin nada útil cae al fallback
  expect_equal(
    .xlsform_forms_derive_name(wb_plain, list(original_name = NA_character_)),
    "Formulario 1"
  )
})

# --- Migración legacy ---------------------------------------------------------

test_that("seed_from_legacy crea una entrada activa sin perder surveyMonkeyLogic", {
  extra <- list(surveyMonkeyLogic = list(choice_code_maps = list(q1 = list("A", "B"))))
  st <- make_state("Form SM", extra_wb = extra)
  s <- list(xlsform_state = st)

  s <- .xlsform_forms_seed_from_legacy(s)

  expect_length(s$xlsform_forms, 1L)
  active <- s$xlsform_active_form_id
  expect_true(!is.null(active))
  entry <- s$xlsform_forms[[active]]
  expect_equal(entry$name, "Form SM")
  # El dato anidado sobrevive tal cual.
  expect_equal(
    entry$workbook$surveyMonkeyLogic$choice_code_maps$q1,
    list("A", "B")
  )
  # Invariante del espejo tras la siembra.
  expect_identical(s$xlsform_state$workbook, entry$workbook)
})

test_that("seed_from_legacy es idempotente y no toca colecciones existentes", {
  st <- make_state("A")
  s <- list(xlsform_state = st)
  s <- .xlsform_forms_seed_from_legacy(s)
  first_id <- s$xlsform_active_form_id

  s2 <- .xlsform_forms_seed_from_legacy(s)
  expect_identical(s2$xlsform_active_form_id, first_id)
  expect_length(s2$xlsform_forms, 1L)

  # Sin xlsform_state no siembra nada.
  s_empty <- .xlsform_forms_seed_from_legacy(list())
  expect_null(s_empty$xlsform_forms)
})

# --- Upsert / list / invariante del espejo ------------------------------------

test_that("upsert de varios formularios: primero activo, list devuelve metadatos", {
  s <- list()
  e1 <- .xlsform_forms_as_entry(make_state("Uno", saved_at = "2026-01-01T00:00:00Z"), id = "id-1")
  e2 <- .xlsform_forms_as_entry(make_state("Dos", saved_at = "2026-02-01T00:00:00Z"), id = "id-2")

  s <- .xlsform_forms_upsert(s, e1)
  # El primero se vuelve activo y espeja.
  expect_equal(s$xlsform_active_form_id, "id-1")
  expect_identical(s$xlsform_state$workbook, e1$workbook)

  s <- .xlsform_forms_upsert(s, e2)
  # El segundo NO roba el activo.
  expect_equal(s$xlsform_active_form_id, "id-1")

  meta <- .xlsform_forms_list(s)
  expect_length(meta, 2L)
  ids <- vapply(meta, function(m) m$id, character(1))
  expect_setequal(ids, c("id-1", "id-2"))
  actives <- vapply(meta, function(m) m$active, logical(1))
  expect_equal(sum(actives), 1L)
  active_meta <- meta[[which(actives)]]
  expect_equal(active_meta$id, "id-1")
  # list NO expone workbooks.
  expect_null(meta[[1]]$workbook)
})

test_that("actualizar el activo re-deriva el espejo", {
  s <- list()
  s <- .xlsform_forms_upsert(s, .xlsform_forms_as_entry(make_state("V1"), id = "id-1"))
  # Reescribimos el activo con un workbook distinto.
  updated <- .xlsform_forms_as_entry(make_state("V2", extra_wb = list(marker = "nuevo")), id = "id-1")
  s <- .xlsform_forms_upsert(s, updated)
  expect_equal(s$xlsform_state$workbook$marker, "nuevo")
  expect_identical(s$xlsform_state$workbook, s$xlsform_forms[["id-1"]]$workbook)
})

# --- set_active + delete ------------------------------------------------------

test_that("set_active y delete mantienen la invariante del espejo", {
  s <- list()
  s <- .xlsform_forms_upsert(s, .xlsform_forms_as_entry(make_state("A", saved_at = "2026-01-01T00:00:00Z"), id = "id-a"))
  s <- .xlsform_forms_upsert(s, .xlsform_forms_as_entry(make_state("B", saved_at = "2026-03-01T00:00:00Z"), id = "id-b"))

  # Cambio de activo.
  s <- .xlsform_forms_set_active(s, "id-b")
  expect_equal(s$xlsform_active_form_id, "id-b")
  expect_identical(s$xlsform_state$workbook, s$xlsform_forms[["id-b"]]$workbook)

  # Borrar el activo reasigna al más reciente restante (id-a).
  s <- .xlsform_forms_delete(s, "id-b")
  expect_equal(s$xlsform_active_form_id, "id-a")
  expect_identical(s$xlsform_state$workbook, s$xlsform_forms[["id-a"]]$workbook)

  # Borrar el último limpia el espejo.
  s <- .xlsform_forms_delete(s, "id-a")
  expect_null(s$xlsform_active_form_id)
  expect_null(s$xlsform_state)
  expect_length(s$xlsform_forms, 0L)
})

test_that("delete de un id inexistente es no-op", {
  s <- list()
  s <- .xlsform_forms_upsert(s, .xlsform_forms_as_entry(make_state("A"), id = "id-a"))
  before <- s
  s <- .xlsform_forms_delete(s, "no-existe")
  expect_equal(s$xlsform_active_form_id, before$xlsform_active_form_id)
  expect_length(s$xlsform_forms, 1L)
})

# --- Tope de 6 formularios por proyecto ---------------------------------------

# Construye una sesión con `n` formularios (ids "id-1".."id-n").
seed_n_forms <- function(n) {
  s <- list()
  for (i in seq_len(n)) {
    entry <- .xlsform_forms_as_entry(
      make_state(paste0("Form ", i), saved_at = sprintf("2026-01-%02dT00:00:00Z", i)),
      id = paste0("id-", i)
    )
    s <- .xlsform_forms_upsert(s, entry)
  }
  s
}

test_that("crear 6 formularios está permitido; el 7º nuevo falla con E_FORM_LIMIT", {
  expect_equal(.XLSFORM_FORMS_MAX, 6L)

  # Sembramos 5 y el guard permite el 6º (id nuevo, aún hay espacio).
  s <- seed_n_forms(5L)
  expect_silent(.xlsform_forms_guard_limit(s, "id-6"))
  s <- .xlsform_forms_upsert(
    s, .xlsform_forms_as_entry(make_state("Form 6"), id = "id-6")
  )
  expect_length(s$xlsform_forms, 6L)

  # El 7º (id nuevo) se topa con el límite.
  err <- tryCatch(
    .xlsform_forms_guard_limit(s, "id-7"),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_FORM_LIMIT")
  expect_equal(err$status, 409)
  expect_match(conditionMessage(err), "máximo de 6 formularios")

  # Un id vacío/ausente también es una creación → también se topa.
  err_empty <- tryCatch(
    .xlsform_forms_guard_limit(s, NULL),
    api_error = function(e) e
  )
  expect_equal(err_empty$code, "E_FORM_LIMIT")
})

test_that("upsert de un id existente estando en 6 NO se topa con el límite", {
  s <- seed_n_forms(6L)
  expect_length(s$xlsform_forms, 6L)

  # El guard NO dispara para un id que ya existe (autosave del 6º formulario).
  expect_silent(.xlsform_forms_guard_limit(s, "id-6"))

  # Y el upsert de ese id existente actualiza sin fallar ni crecer.
  updated <- .xlsform_forms_as_entry(
    make_state("Form 6", extra_wb = list(marker = "editado")), id = "id-6"
  )
  s <- .xlsform_forms_upsert(s, updated)
  expect_length(s$xlsform_forms, 6L)
  expect_equal(s$xlsform_forms[["id-6"]]$workbook$marker, "editado")
})

test_that("as_entry genera id cuando falta y deriva saved_at", {
  entry <- .xlsform_forms_as_entry(make_state("Sin ID", saved_at = NULL), id = NULL)
  expect_true(nzchar(entry$id))
  expect_true(nzchar(entry$saved_at))
  expect_equal(entry$name, "Sin ID")
})

# --- Revisiones inmutables ---------------------------------------------------

test_that("hash canónico ignora metadata de app y conserva semántica ordenada", {
  wb <- make_workbook("Instrumento")
  wb$survey$columns <- c(wb$survey$columns, "paper_hint")
  wb$survey$rows[[1]] <- c(wb$survey$rows[[1]], "no pertenece al XLSForm")
  wb$paper <- list(columns = list("id"), rows = list(list("p1")))
  wb$diagnostico <- list(columns = list("issue"), rows = list(list("nota")))
  wb$surveyMonkeyLogic <- list(token = "no-hashear", rules = list("r1"))

  equivalent <- wb
  equivalent$survey$rows[[1]][4] <- "otro valor solo de app"
  equivalent$paper$rows[[1]][1] <- "otro"
  equivalent$diagnostico$rows[[1]][1] <- "otra nota"
  equivalent$surveyMonkeyLogic$rules <- list("r2")
  expect_identical(.xlsform_revision_hash(wb), .xlsform_revision_hash(equivalent))

  na_cells <- make_workbook("Instrumento")
  na_cells$survey$rows[[1]][3] <- NA_character_
  empty_cells <- make_workbook("Instrumento")
  empty_cells$survey$rows[[1]][3] <- ""
  expect_identical(.xlsform_revision_hash(na_cells), .xlsform_revision_hash(empty_cells))

  changed <- make_workbook("Instrumento")
  changed$survey$rows[[1]][3] <- "Pregunta cambiada"
  expect_false(identical(.xlsform_revision_hash(wb), .xlsform_revision_hash(changed)))
  expect_match(.xlsform_revision_hash(wb), "^[0-9a-f]{64}$")
})

test_that("publication bloqueada tiene precedencia y ast raw queda como warning", {
  s <- list()
  entry <- .xlsform_forms_as_entry(make_state("Instrumento"), id = "form-1")
  s <- .xlsform_forms_upsert(s, entry)

  testthat::local_mocked_bindings(
    .xlsform_editor_validate_workbook = function(workbook) list(
      list(id = "ast-unparseable-relevant-0", level = "warn"),
      list(id = "name-duplicate-q1", level = "warn")
    ),
    .package = "prosecnurapp"
  )
  publication <- .xlsform_revision_publication(s, entry)
  expect_equal(publication$status, "blocked")
  expect_length(publication$blockers, 1L)
  expect_length(publication$warnings, 1L)
  expect_false(publication$can_publish)
  expect_true(publication$can_delete)
})

test_that("logic_status pendiente bloquea publicar pero fuentes legacy siguen compatibles", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)

  pending_state <- make_state("Pendiente")
  pending_state$source <- list(
    schema = "survey_source/v1",
    kind = "surveymonkey",
    original_name = "Docentes",
    logic_status = "pending_manual_confirmation",
    publication_guard = "Confirma manualmente la lógica antes de publicar."
  )
  pending <- .xlsform_forms_as_entry(pending_state, id = "form-pending")
  s <- .xlsform_forms_upsert(s, pending)
  .session_env[[sid]] <- s

  publication <- .xlsform_revision_publication(s, pending)
  expect_equal(publication$status, "blocked")
  expect_false(publication$can_publish)
  expect_true(any(vapply(
    publication$blockers,
    function(item) identical(item$id, "logic_pending_manual_confirmation"),
    logical(1)
  )))

  err <- tryCatch(
    xlsform_revision_publish(sid, "form-pending", .xlsform_revision_hash(pending$workbook)),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_XLSFORM_NOT_PUBLISHABLE")
  expect_length(session_get(sid)$instrument_revisions %||% list(), 0L)

  legacy_state <- make_state("Legacy")
  legacy_state$source <- list(kind = "surveymonkey", original_name = "Legacy")
  legacy <- .xlsform_forms_as_entry(legacy_state, id = "form-legacy")
  legacy_publication <- .xlsform_revision_publication(list(), legacy)
  expect_equal(legacy_publication$status, "draft")
  expect_true(legacy_publication$can_publish)
})

test_that("variantes SurveyMonkey se sellan al confirmar y vuelven stale si cambia su definición", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  variant_audit <- list(
    positional_ok = FALSE,
    blocking = 1L,
    review = 0L,
    special = 0L
  )
  state <- make_state("Con variante")
  content_sha256 <- .xlsform_revision_hash(state$workbook)
  definition_sha256 <- paste(rep("a", 64L), collapse = "")
  state$source <- list(
    schema = "survey_source/v1",
    kind = "surveymonkey",
    logic_status = "confirmed",
    logic_review = list(content_sha256 = content_sha256),
    variants = list(list(
      survey_id = "sm-variant",
      survey_title = "Variante",
      definition_sha256 = definition_sha256,
      review_status = "pending_manual_confirmation",
      audit = variant_audit
    ))
  )
  entry <- .xlsform_forms_as_entry(state, id = "form-variant")
  s <- .xlsform_forms_upsert(session_get(sid), entry)
  .session_env[[sid]] <- s

  pending <- .xlsform_revision_publication(s, entry)
  pending_ids <- vapply(pending$blockers, `[[`, character(1), "id")
  expect_equal(
    list(blocker_ids = pending_ids, can_publish = pending$can_publish),
    list(
      blocker_ids = "logic_variant_pending_manual_confirmation",
      can_publish = FALSE
    )
  )

  confirmed <- xlsform_forms_confirm_logic(sid, entry$id, content_sha256)
  confirmed_variant <- confirmed$source$variants[[1]]
  expect_equal(
    list(
      review_status = confirmed_variant$review_status,
      confirmed_at_recorded = is.character(confirmed_variant$logic_confirmed_at) &&
        length(confirmed_variant$logic_confirmed_at) == 1L &&
        nzchar(confirmed_variant$logic_confirmed_at),
      method = confirmed_variant$logic_confirmation_method,
      content_sha256 = confirmed_variant$logic_review$content_sha256,
      definition_sha256 = confirmed_variant$logic_review$definition_sha256,
      audit = confirmed_variant$audit
    ),
    list(
      review_status = "confirmed",
      confirmed_at_recorded = TRUE,
      method = "editor_manual_review",
      content_sha256 = content_sha256,
      definition_sha256 = definition_sha256,
      audit = variant_audit
    )
  )
  expect_equal(confirmed$publication$status, "draft")
  expect_true(confirmed$publication$can_publish)
  expect_null(confirmed$publication$latest_revision)
  expect_length(session_get(sid)$instrument_revisions %||% list(), 0L)

  s <- session_get(sid)
  changed <- s$xlsform_forms[[entry$id]]
  changed$source$variants[[1]]$definition_sha256 <- paste(rep("b", 64L), collapse = "")
  s <- .xlsform_forms_upsert(s, changed)
  .session_env[[sid]] <- s

  stale <- .xlsform_revision_publication(s, .xlsform_forms_get(s, entry$id))
  stale_ids <- vapply(stale$blockers, `[[`, character(1), "id")
  expect_equal(
    list(blocker_ids = stale_ids, can_publish = stale$can_publish),
    list(blocker_ids = "logic_variant_confirmation_stale", can_publish = FALSE)
  )
})

test_that("logic_status activa el gate aunque el source use schema de acreditación", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  variant_audit <- list(
    positional_ok = FALSE,
    blocking = 1L,
    review = 0L,
    special = 0L
  )
  state <- make_state("Acreditación con variante")
  content_sha256 <- .xlsform_revision_hash(state$workbook)
  definition_sha256 <- paste(rep("c", 64L), collapse = "")
  state$source <- list(
    schema = "acreditacion_actor_instrument_draft/v1",
    kind = "surveymonkey",
    logic_status = "pending_manual_confirmation",
    variants = list(list(
      survey_id = "sm-acreditacion-variante",
      survey_title = "Variante acreditación",
      definition_sha256 = definition_sha256,
      review_status = "pending_manual_confirmation",
      audit = variant_audit
    ))
  )
  entry <- .xlsform_forms_as_entry(state, id = "form-acreditacion-variante")
  s <- .xlsform_forms_upsert(session_get(sid), entry)
  .session_env[[sid]] <- s

  pending <- .xlsform_revision_publication(s, entry)
  expect_equal(
    list(
      status = pending$status,
      blocker_ids = vapply(pending$blockers, `[[`, character(1), "id"),
      can_publish = pending$can_publish
    ),
    list(
      status = "blocked",
      blocker_ids = "logic_pending_manual_confirmation",
      can_publish = FALSE
    )
  )

  confirmed <- xlsform_forms_confirm_logic(sid, entry$id, content_sha256)
  confirmed_variant <- confirmed$source$variants[[1]]
  expect_equal(
    list(
      top_level_status = confirmed$source$logic_status,
      variant_status = confirmed_variant$review_status,
      method = confirmed_variant$logic_confirmation_method,
      content_sha256 = confirmed_variant$logic_review$content_sha256,
      definition_sha256 = confirmed_variant$logic_review$definition_sha256,
      audit = confirmed_variant$audit,
      publication_status = confirmed$publication$status,
      can_publish = confirmed$publication$can_publish
    ),
    list(
      top_level_status = "confirmed",
      variant_status = "confirmed",
      method = "editor_manual_review",
      content_sha256 = content_sha256,
      definition_sha256 = definition_sha256,
      audit = variant_audit,
      publication_status = "draft",
      can_publish = TRUE
    )
  )
  expect_null(confirmed$publication$latest_revision)
  expect_length(session_get(sid)$instrument_revisions %||% list(), 0L)

  s <- session_get(sid)
  changed <- s$xlsform_forms[[entry$id]]
  changed$source$variants[[1]]$definition_sha256 <- paste(rep("d", 64L), collapse = "")
  s <- .xlsform_forms_upsert(s, changed)
  .session_env[[sid]] <- s

  stale <- .xlsform_revision_publication(s, .xlsform_forms_get(s, entry$id))
  expect_equal(
    list(
      blocker_ids = vapply(stale$blockers, `[[`, character(1), "id"),
      can_publish = stale$can_publish
    ),
    list(blocker_ids = "logic_variant_confirmation_stale", can_publish = FALSE)
  )
})

test_that("publicación por form_id crea V1/V2 inmutables y es idempotente", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  active <- .xlsform_forms_as_entry(make_state("Activo"), id = "form-activo")
  target_state <- make_state("Objetivo")
  target_state$source <- list(
    kind = "surveymonkey",
    survey_id = "sm-1",
    token = "secreto",
    nested = list(api_key = "secreto", title = "Fuente")
  )
  target <- .xlsform_forms_as_entry(target_state, id = "form-objetivo")
  s <- .xlsform_forms_upsert(s, active)
  s <- .xlsform_forms_upsert(s, target)
  .session_env[[sid]] <- s

  hash_v1 <- .xlsform_revision_hash(target$workbook)
  v1 <- xlsform_revision_publish(sid, "form-objetivo", hash_v1)
  expect_true(v1$created)
  expect_equal(v1$revision$revision_no, 1L)
  expect_equal(v1$revision$schema, "instrument_revision/v1")
  expect_equal(v1$revision$form_id, "form-objetivo")
  expect_null(v1$revision$source$token)
  expect_null(v1$revision$source$nested$api_key)
  expect_equal(v1$revision$source$nested$title, "Fuente")
  expect_equal(session_get(sid)$xlsform_active_form_id, "form-activo")
  v1_meta <- get_file(sid, v1$revision$xlsform_file_id)
  v1_bytes <- readBin(v1_meta$path, "raw", n = file.info(v1_meta$path)$size)

  retry <- xlsform_revision_publish(sid, "form-objetivo", hash_v1)
  expect_false(retry$created)
  expect_identical(retry$revision$revision_id, v1$revision$revision_id)
  expect_length(session_get(sid)$instrument_revisions, 1L)

  s <- session_get(sid)
  edited <- s$xlsform_forms[["form-objetivo"]]
  edited$workbook$survey$rows[[1]][3] <- "Pregunta versión dos"
  s <- .xlsform_forms_upsert(s, edited)
  .session_env[[sid]] <- s
  hash_v2 <- .xlsform_revision_hash(edited$workbook)
  v2 <- xlsform_revision_publish(sid, "form-objetivo", hash_v2)
  expect_true(v2$created)
  expect_equal(v2$revision$revision_no, 2L)
  expect_false(identical(v2$revision$revision_id, v1$revision$revision_id))
  expect_identical(
    readBin(v1_meta$path, "raw", n = file.info(v1_meta$path)$size),
    v1_bytes
  )

  # Volver a un hash histórico después de V2 es un nuevo evento de publicación.
  s <- session_get(sid)
  reverted <- s$xlsform_forms[["form-objetivo"]]
  reverted$workbook <- target$workbook
  s <- .xlsform_forms_upsert(s, reverted)
  .session_env[[sid]] <- s
  v3 <- xlsform_revision_publish(sid, "form-objetivo", hash_v1)
  expect_equal(v3$revision$revision_no, 3L)
  expect_length(session_get(sid)$instrument_revisions, 3L)

  err <- tryCatch(
    .xlsform_forms_delete(session_get(sid), "form-objetivo"),
    api_error = function(e) e
  )
  expect_equal(err$code, "E_FORM_HAS_REVISIONS")
  expect_equal(err$status, 409)
})

test_that("stale, inválido y fallo de commit no dejan mutación parcial", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  valid <- .xlsform_forms_as_entry(make_state("Válido"), id = "form-valid")
  invalid <- .xlsform_forms_as_entry(make_state(NULL), id = "form-invalid")
  s <- .xlsform_forms_upsert(s, valid)
  s <- .xlsform_forms_upsert(s, invalid)
  .session_env[[sid]] <- s

  err_stale <- tryCatch(
    xlsform_revision_publish(sid, "form-valid", paste(rep("0", 64L), collapse = "")),
    api_error = function(e) e
  )
  expect_equal(err_stale$code, "E_FORM_DRAFT_STALE")
  expect_length(session_get(sid)$files, 0L)
  expect_length(session_get(sid)$instrument_revisions %||% list(), 0L)

  invalid_hash <- .xlsform_revision_hash(invalid$workbook)
  err_invalid <- tryCatch(
    xlsform_revision_publish(sid, "form-invalid", invalid_hash),
    api_error = function(e) e
  )
  expect_equal(err_invalid$code, "E_XLSFORM_NOT_PUBLISHABLE")
  expect_length(session_get(sid)$files, 0L)

  uploads <- file.path(session_get(sid)$dir, "uploads")
  before <- list.files(uploads, all.files = TRUE, no.. = TRUE)
  testthat::local_mocked_bindings(
    .xlsform_revision_assign = function(sid, state) stop("commit simulado"),
    .package = "prosecnurapp"
  )
  err_commit <- tryCatch(
    xlsform_revision_publish(sid, "form-valid", .xlsform_revision_hash(valid$workbook)),
    api_error = function(e) e
  )
  expect_equal(err_commit$code, "E_INSTRUMENT_REVISION_COMMIT_FAILED")
  expect_identical(list.files(uploads, all.files = TRUE, no.. = TRUE), before)
  expect_length(session_get(sid)$files, 0L)
  expect_length(session_get(sid)$instrument_revisions %||% list(), 0L)
})
