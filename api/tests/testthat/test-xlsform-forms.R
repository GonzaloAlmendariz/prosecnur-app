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
