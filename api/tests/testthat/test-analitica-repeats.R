# Analítica consciente de grupos repeat (ADR 0030, Fase 3). Fixtures sintéticos
# que imitan el contrato PDM (ACNUR): una base MADRE ancha con caracterización
# (sexo/edad) + un begin_repeat rep_servicios (batería por servicio) que la Fase 1
# expande a una base HIJA long con las llaves canónicas ODK/Kobo. Se verifica:
#   (a) el filtro de variables fantasma (repeat_depth>0) en la MADRE, y su
#       ausencia de efecto en la HIJA (donde el repeat es top-level),
#   (b) el enriquecimiento hija×madre por link_key (many-to-one, sin duplicar),
#   (c) el instrumento de la hija enriquecida lista sexo/edad como seleccionables,
#   (d) el meta de grano (instancias vs personas).

# XLSForm de la MADRE: caracterización top-level + begin_repeat con su gate y sus
# calculates de identidad del roster (current_code/current_label).
.ar_madre_xlsform_model <- function() {
  survey <- data.frame(
    type = c(
      "text",
      "select_one lst_sexo",
      "integer",
      "begin_repeat",
      "calculate",
      "calculate",
      "select_one lst_claridad",
      "end_repeat"
    ),
    name = c(
      "p_nombre", "sexo", "edad", "rep_servicios",
      "current_code", "current_label", "srv_claridad", "rep_servicios"
    ),
    label = c(
      "Nombre", "Sexo", "Edad", "Servicios",
      "", "", "Claridad de ${current_label}", ""
    ),
    relevant = c("", "", "", "${p_nombre} != ''", "", "", "", ""),
    calculation = c(
      "", "", "", "",
      "jr:choice-name(${srv_claridad}, 'srv_claridad')",
      "jr:choice-name(${srv_claridad}, 'srv_claridad')", "", ""
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("lst_sexo", "lst_sexo", "lst_claridad", "lst_claridad"),
    name = c("1", "2", "1", "2"),
    label = c("Mujer", "Hombre", "Sí", "No"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  settings <- data.frame(
    form_title = "PDM ACNUR", form_id = "pdm_acnur",
    stringsAsFactors = FALSE, check.names = FALSE
  )
  list(survey = survey, choices = choices, settings = settings)
}

# Data ancha (con blob del repeat) alineada por _index para .carga_kobo_register.
# Ana (idx1): 0 instancias; Luis (idx2): 2; Rosa (idx3): 1  ->  3 instancias,
# 2 personas con al menos una instancia.
.ar_madre_wide_full <- function() {
  blob0 <- "[]"
  blob2 <- paste0(
    '[',
    '{"current_code":"salud","current_label":"Salud","srv_claridad":"2"},',
    '{"current_code":"educacion","current_label":"Educación","srv_claridad":"1"}',
    ']'
  )
  blob3 <- '[{"current_code":"legal","current_label":"Asistencia legal","srv_claridad":"1"}]'
  data.frame(
    `_id` = c(10, 20, 30),
    `_index` = c(1L, 2L, 3L),
    p_nombre = c("Ana", "Luis", "Rosa"),
    sexo = c("1", "2", "1"),
    edad = c("30", "40", "25"),
    rep_servicios = c(blob0, blob2, blob3),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

# Registra madre + hija repeat en una sesión y devuelve todo lo necesario.
.ar_setup_study <- function() {
  sid <- session_create()
  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)

  model <- .ar_madre_xlsform_model()
  xls_path <- file.path(downloads_dir, "madre_xlsform.xlsx")
  .carga_write_xlsform_model(model, xls_path)
  xls_meta <- save_upload(sid, "xlsform", "madre_xlsform.xlsx",
                          readBin(xls_path, "raw", n = file.info(xls_path)$size))
  madre_inst <- reporte_instrumento(path = xls_meta$path)

  wide_full <- .ar_madre_wide_full()
  # La base ancha registrada NO lleva el blob (se expande a la hija).
  wide_clean <- wide_full[, setdiff(names(wide_full), "rep_servicios"), drop = FALSE]
  data_path <- file.path(downloads_dir, "madre_data.xlsx")
  .carga_write_xlsx_sheet(wide_clean, data_path, "datos")
  data_meta <- save_upload(sid, "data", "madre_data.xlsx",
                           readBin(data_path, "raw", n = file.info(data_path)$size))

  estudio_add_base(
    sid, nombre = "madre",
    xlsform_file_id = xls_meta$file_id, data_file_id = data_meta$file_id,
    data_ext = "xlsx",
    rp_data = reporte_data(wide_clean, instrumento = madre_inst),
    rp_inst = madre_inst, n_filas = nrow(wide_clean), n_columnas = ncol(wide_clean),
    extra_meta = list(source_kind = "kobo_api")
  )

  created <- .carga_kobo_register_repeat_bases(
    sid, data_df = wide_full, rp_inst = madre_inst,
    parent_base_name = "madre", title = "PDM ACNUR", downloads_dir = downloads_dir
  )

  list(sid = sid, madre_inst = madre_inst, created = created)
}

test_that("(a) el filtro de fantasmas excluye repeat en la MADRE pero no en la HIJA", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  madre_inst <- st$madre_inst

  # Variables de la MADRE: sexo/edad sí, srv_claridad (repeat_depth>0) NO.
  vars_madre <- .variables_desde_instrumento(madre_inst)
  names_madre <- vapply(vars_madre, function(v) as.character(v$name %||% ""), character(1))
  expect_true(all(c("sexo", "edad", "p_nombre") %in% names_madre))
  expect_false("srv_claridad" %in% names_madre)
  expect_false(any(c("current_code", "current_label") %in% names_madre))

  # Secciones de la MADRE: ninguna sección incluye la pregunta fantasma.
  secs_madre <- .detect_secciones_analitica(madre_inst)
  all_vars_secs <- unlist(lapply(secs_madre, function(s) as.character(s$variables)), use.names = FALSE)
  expect_false("srv_claridad" %in% all_vars_secs)
  expect_true("sexo" %in% all_vars_secs)

  # Instrumento de la HIJA: srv_claridad ES top-level (bajo begin_group) -> sí.
  child_name <- st$created[[1]]$base
  child_inst <- session_get(st$sid)$rp_inst_sources[[child_name]]
  vars_hija <- .variables_desde_instrumento(child_inst)
  names_hija <- vapply(vars_hija, function(v) as.character(v$name %||% ""), character(1))
  expect_true("srv_claridad" %in% names_hija)
})

test_that("(b) el enriquecimiento trae sexo/edad a la hija por link_key sin duplicar filas", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  s <- session_get(st$sid)
  child_name <- st$created[[1]]$base
  child_data <- s$rp_data_sources[[child_name]]
  child_inst <- s$rp_inst_sources[[child_name]]

  # La hija trae la llave de enlace y las 3 instancias esperadas.
  expect_true("_parent_index" %in% names(child_data))
  expect_equal(nrow(child_data), 3L)
  expect_equal(as.integer(child_data[["_parent_index"]]), c(2L, 2L, 3L))

  res <- .analitica_enrich_child_pair(st$sid, child_name, child_data, child_inst)
  expect_true(isTRUE(res$enriched))
  # No se duplican filas de la hija (many-to-one).
  expect_equal(nrow(res$data), nrow(child_data))
  # Caracterización de la madre presente en la hija.
  expect_true(all(c("sexo", "edad") %in% names(res$data)))
  # Los valores casan por _parent_index -> _index de la madre (sexo: idx2=2, idx3=1).
  expect_equal(as.character(res$data$sexo), c("2", "2", "1"))
  expect_equal(as.character(res$data$edad), c("40", "40", "25"))
  # Marcadas como heredadas del padre.
  expect_true(isTRUE(attr(res$data$sexo, "repeat_inherited")))
  expect_equal(attr(res$data$sexo, "repeat_parent_base"), "madre")

  # Un cruce srv_claridad × sexo es posible sobre la hija enriquecida.
  tab <- table(as.character(res$data$srv_claridad), as.character(res$data$sexo))
  expect_true(sum(tab) == 3L)
})

test_that("(c) el instrumento de la hija enriquecida lista sexo/edad como seleccionables", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  s <- session_get(st$sid)
  child_name <- st$created[[1]]$base

  res <- .analitica_enrich_child_pair(
    st$sid, child_name, s$rp_data_sources[[child_name]], s$rp_inst_sources[[child_name]])
  vars <- .variables_desde_instrumento(res$inst)
  names_vars <- vapply(vars, function(v) as.character(v$name %||% ""), character(1))
  # Propias de la hija + heredadas de la madre.
  expect_true("srv_claridad" %in% names_vars)
  expect_true(all(c("sexo", "edad") %in% names_vars))
  # sexo conserva su list_name (para etiquetar el cruce).
  sexo_entry <- vars[[which(names_vars == "sexo")[1]]]
  expect_equal(sexo_entry$list_name, "lst_sexo")
  expect_true(isTRUE(sexo_entry$categorica))
})

test_that("(d) el meta de grano reporta instancias vs personas", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  s <- session_get(st$sid)
  child_name <- st$created[[1]]$base

  res <- .analitica_enrich_child_pair(
    st$sid, child_name, s$rp_data_sources[[child_name]], s$rp_inst_sources[[child_name]])
  grain <- res$grain
  expect_false(is.null(grain))
  expect_equal(grain$kind, "instancia")
  expect_equal(grain$n_instancias, 3L)   # 0 + 2 + 1 instancias
  expect_equal(grain$n_personas, 2L)     # solo Luis y Rosa tienen instancias
  expect_equal(grain$repeat_group, "rep_servicios")
  expect_equal(grain$parent_base, "madre")
  expect_true(nzchar(grain$nota))
})

test_that("el caso normal (base sin repeat) no se enriquece ni reporta grano", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  s <- session_get(st$sid)
  madre_data <- s$rp_data_sources[["madre"]]

  res <- .analitica_enrich_child_pair(
    st$sid, "madre", madre_data, s$rp_inst_sources[["madre"]])
  expect_false(isTRUE(res$enriched))
  expect_null(res$grain)
  expect_equal(names(res$data), names(madre_data))
})

# --- Contrato del endpoint /api/analitica/variables (ADR 0030, Fase 5) --------
# El grano SÓLO se emite cuando la base activa es una hija repeat, y se calcula
# desde SU data (distinct `_parent_index`), nunca desde la madre. Regresión del
# bug donde el grano aparecía sobre la MADRE (parent_base = la madre misma) y con
# n_personas = NA por haberse computado sobre la data de la madre.

test_that("(e) el grano de la base activa es NULL cuando la activa es la MADRE", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  estudio_active_base_set(st$sid, "madre")
  # Corre el pipeline del endpoint (llena caches) antes de leer el grano.
  invisible(.load_rp_data(st$sid))
  expect_null(.analitica_active_repeat_grain(st$sid))
})

test_that("(f) el grano de la HIJA activa se calcula desde su propia data", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  child_name <- st$created[[1]]$base
  estudio_active_base_set(st$sid, child_name)
  invisible(.load_rp_data(st$sid))
  grain <- .analitica_active_repeat_grain(st$sid)
  expect_false(is.null(grain))
  expect_equal(grain$kind, "instancia")
  expect_equal(grain$n_instancias, 3L)   # filas de la hija (0 + 2 + 1)
  expect_equal(grain$n_personas, 2L)     # distinct _parent_index (Luis, Rosa)
  expect_equal(grain$repeat_group, "rep_servicios")
  expect_equal(grain$parent_base, "madre")
})

test_that("(g) la MADRE no hereda grano aunque antes se haya activado la HIJA", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  child_name <- st$created[[1]]$base
  # Primero la hija (computa y cachea su contexto)...
  estudio_active_base_set(st$sid, child_name)
  invisible(.load_rp_data(st$sid))
  expect_false(is.null(.analitica_active_repeat_grain(st$sid)))
  # ...y al volver a la madre, NULL: el grano no se filtra a una base no-hija.
  estudio_active_base_set(st$sid, "madre")
  invisible(.load_rp_data(st$sid))
  expect_null(.analitica_active_repeat_grain(st$sid))
})

# --- Contrato del contexto de base activa (.load_rp_data) ---------------------
# El contexto de base ÚNICA que alimenta /api/analitica/variables, frecuencias y
# cruces debe ser el de la BASE ACTIVA, no el de la primera base registrada.
# Regresión del bug donde, con una hija repeat activa, `.load_rp_data` entregaba
# la data e instrumento de la MADRE (base "first" del override de
# `.analitica_prepare_context`), de modo que el picker listaba variables de la
# madre y los cruces operaban sobre ella.

test_that("(h) la HIJA activa entrega su propia data/inst enriquecida en .load_rp_data", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  child_name <- st$created[[1]]$base
  estudio_active_base_set(st$sid, child_name)

  ctx <- .load_rp_data(st$sid)

  # rp_data es la HIJA: trae su llave de enlace y su variable propia del repeat,
  # NO una columna exclusiva de la madre (p_nombre es text, no se hereda).
  expect_true("_parent_index" %in% names(ctx$rp_data))
  expect_true("srv_claridad" %in% names(ctx$rp_data))
  expect_false("p_nombre" %in% names(ctx$rp_data))
  expect_equal(nrow(ctx$rp_data), 3L)  # instancias de la hija (0 + 2 + 1)

  # Enriquecida con la caracterización de la madre (join many-to-one por link_key).
  expect_true(all(c("sexo", "edad") %in% names(ctx$rp_data)))
  expect_equal(as.character(ctx$rp_data$sexo), c("2", "2", "1"))

  # El instrumento entregado es el de la HIJA: su picker lista srv_claridad
  # (top-level bajo begin_group en la hija) + las heredadas sexo/edad.
  names_inst <- vapply(.variables_desde_instrumento(ctx$rp_inst),
                       function(v) as.character(v$name %||% ""), character(1))
  expect_true("srv_claridad" %in% names_inst)
  expect_true(all(c("sexo", "edad") %in% names_inst))
})

test_that("(i) la MADRE activa sigue entregando su propia data/inst (sin fuga de la hija)", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  estudio_active_base_set(st$sid, "madre")

  ctx <- .load_rp_data(st$sid)

  # rp_data es la MADRE: su columna propia sí, la llave de la hija no.
  expect_true("p_nombre" %in% names(ctx$rp_data))
  expect_false("_parent_index" %in% names(ctx$rp_data))

  # El picker de la madre no ofrece la pregunta fantasma del repeat (repeat_depth>0)
  # pero sí sus variables top-level.
  names_inst <- vapply(.variables_desde_instrumento(ctx$rp_inst),
                       function(v) as.character(v$name %||% ""), character(1))
  expect_false("srv_claridad" %in% names_inst)
  expect_true(all(c("sexo", "edad") %in% names_inst))
})

test_that("(j) alternar la base activa madre<->hija reevalúa el contexto (caché por base)", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  child_name <- st$created[[1]]$base

  # Madre primero (llena el caché singular con su contexto)...
  estudio_active_base_set(st$sid, "madre")
  ctx_madre <- .load_rp_data(st$sid)
  expect_false("_parent_index" %in% names(ctx_madre$rp_data))

  # ...al activar la hija el caché singular NO debe servir la madre.
  estudio_active_base_set(st$sid, child_name)
  ctx_hija <- .load_rp_data(st$sid)
  expect_true("_parent_index" %in% names(ctx_hija$rp_data))
  expect_true("srv_claridad" %in% names(ctx_hija$rp_data))

  # ...y de vuelta a la madre, tampoco debe servir la hija.
  estudio_active_base_set(st$sid, "madre")
  ctx_madre2 <- .load_rp_data(st$sid)
  expect_false("_parent_index" %in% names(ctx_madre2$rp_data))
  expect_true("p_nombre" %in% names(ctx_madre2$rp_data))
})

test_that(".dn_repeat_parent_row_positions enlaza many-to-one con fallback", {
  parent <- data.frame(
    `_index` = c(1L, 2L, 3L), `_id` = c("A", "B", "C"),
    sexo = c("F", "M", "F"), stringsAsFactors = FALSE, check.names = FALSE
  )
  child <- data.frame(
    `_parent_index` = c(3L, 3L, NA, 2L),
    `_submission__id` = c("C", "C", "A", "B"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  pos <- .dn_repeat_parent_row_positions(
    child, parent,
    link_key = "_parent_index", parent_index_key = "_index",
    fallback_child_key = "_submission__id", fallback_parent_key = "_id")
  # Primario resuelve filas 1,2,4; la fila 3 (NA en primario) cae al fallback (A -> 1).
  expect_equal(pos, c(3L, 3L, 1L, 2L))
  # Many-to-one: no crece el número de filas del hijo.
  expect_equal(length(pos), nrow(child))
})

# --- Diseno inferencial de repeats (cluster = persona) ----------------------

test_that("repeat_design identifica persona, umbral inferencial y fallback descriptivo", {
  child <- data.frame(
    `_parent_index` = rep(seq_len(8L), each = 2L),
    respuesta = rep(c("1", "0"), 8L),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  inst <- list()
  attr(inst, "repeat_grain") <- list(
    kind = "instancia", n_instancias = 16L, n_personas = 8L,
    repeat_group = "rep_servicios", parent_base = "madre"
  )

  design <- .analitica_repeat_design(child, inst, min_clusters = 8L)
  expect_equal(design$kind, "cluster_persona")
  expect_equal(design$cluster_col, "_parent_index")
  expect_equal(design$n_instancias, 16L)
  expect_equal(design$n_personas, 8L)
  expect_equal(design$min_clusters, 8L)
  expect_true(isTRUE(design$inference_ok))

  # Sin llave de persona no se inventa independencia entre instancias.
  no_key <- child[, "respuesta", drop = FALSE]
  fallback <- .analitica_repeat_design(no_key, inst, min_clusters = 8L)
  expect_null(fallback$cluster_col)
  expect_false(isTRUE(fallback$inference_ok))
  expect_match(fallback$reason, "llave|cluster|persona", ignore.case = TRUE)

  # Las bases normales mantienen el contrato legacy: no hay repeat_design.
  expect_null(.analitica_repeat_design(child, list(), min_clusters = 8L))
})

test_that("contraste cluster-robust no gana evidencia al duplicar instancias", {
  # 12 personas, cada una pertenece a un estrato y aporta una respuesta binaria.
  # Duplicar cada instancia tres veces no crea personas ni evidencia nueva.
  base <- data.frame(
    `_parent_index` = sprintf("p%02d", seq_len(12L)),
    grupo = rep(c("A", "B"), each = 6L),
    respuesta = c(rep("1", 5L), "0", rep("1", 2L), rep("0", 4L)),
    peso = 1,
    stringsAsFactors = FALSE, check.names = FALSE
  )
  inst <- list()
  attr(inst, "repeat_grain") <- list(kind = "instancia", repeat_group = "rep")
  d1 <- .analitica_repeat_design(base, inst)
  cmp1 <- .repeat_compare_columns_cluster(
    data = base, var = "respuesta", codes_row = c("1", "0"),
    estratos = c("A", "B"), var_estrato = "grupo", tp = "so",
    weight_col = "peso", repeat_design = d1, alpha = 0.05
  )

  duplicated <- base[rep(seq_len(nrow(base)), each = 3L), , drop = FALSE]
  d3 <- .analitica_repeat_design(duplicated, inst)
  cmp3 <- .repeat_compare_columns_cluster(
    data = duplicated, var = "respuesta", codes_row = c("1", "0"),
    estratos = c("A", "B"), var_estrato = "grupo", tp = "so",
    weight_col = "peso", repeat_design = d3, alpha = 0.05
  )

  expect_equal(cmp1$method, "cluster_robust")
  expect_equal(cmp3$method, "cluster_robust")
  expect_equal(cmp1$n_clusters, 12L)
  expect_equal(cmp3$n_clusters, 12L)
  expect_equal(cmp3$sig, cmp1$sig)
  expect_equal(cmp3$letras, cmp1$letras)
})

test_that("contraste repeat con menos de 8 personas queda descriptivo y anotado", {
  data <- data.frame(
    `_submission__id` = sprintf("p%d", seq_len(6L)),
    grupo = rep(c("A", "B"), each = 3L),
    respuesta = c("1", "1", "0", "0", "0", "1"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  inst <- list()
  attr(inst, "repeat_grain") <- list(kind = "instancia", repeat_group = "rep")
  design <- .analitica_repeat_design(data, inst, min_clusters = 8L)
  expect_equal(design$cluster_col, "_submission__id")
  expect_false(isTRUE(design$inference_ok))

  cmp <- .repeat_compare_columns_cluster(
    data = data, var = "respuesta", codes_row = c("1", "0"),
    estratos = c("A", "B"), var_estrato = "grupo", tp = "so",
    repeat_design = design
  )
  expect_equal(cmp$method, "descriptivo")
  expect_false(any(cmp$sig))
  expect_true(all(cmp$letras == ""))
  expect_match(cmp$reason, "8|cluster|persona", ignore.case = TRUE)
})

test_that("el minimo de clusters se evalua sobre respuestas validas del contraste", {
  data <- data.frame(
    `_parent_index` = sprintf("p%d", seq_len(8L)),
    grupo = rep(c("A", "B"), each = 4L),
    respuesta = c("1", "1", "1", "0", "0", "0", "0", NA),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  inst <- list()
  attr(inst, "repeat_grain") <- list(kind = "instancia", repeat_group = "rep")
  design <- .analitica_repeat_design(data, inst, min_clusters = 8L)

  cmp <- .repeat_compare_columns_cluster(
    data = data, var = "respuesta", codes_row = c("1", "0"),
    estratos = c("A", "B"), var_estrato = "grupo", tp = "so",
    repeat_design = design
  )

  expect_equal(cmp$method, "descriptivo")
  expect_equal(cmp$n_clusters, 7L)
  expect_false(any(cmp$sig))
  expect_true(all(cmp$letras == ""))
  expect_match(cmp$reason, "8|7|valid", ignore.case = TRUE)
})

test_that("la correccion finita cluster usa CR1", {
  expect_equal(.repeat_cluster_cr1_factor(8L), 8 / 7)
  expect_equal(.repeat_cluster_cr1_factor(12L), 12 / 11)
  expect_true(is.na(.repeat_cluster_cr1_factor(1L)))
})

test_that("analitica reconoce una hija repeat por contrato y no por proveedor", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$bases <- list(
    madre = list(nombre = "madre", source_kind = "manual"),
    hija_manual = list(
      nombre = "hija_manual", source_kind = "manual",
      parent_base = "madre", repeat_group = "rep_servicios",
      link_key = "_parent_index", parent_index_key = "_index"
    ),
    hija_fallback = list(
      nombre = "hija_fallback", source_kind = "xlsx_repeat",
      parent_base = "madre", repeat_group = "rep_visitas",
      link_key = "_submission__id", parent_index_key = "_id"
    )
  )
  session_set(sid, "estudio", s$estudio)

  meta <- .analitica_repeat_child_meta(sid, "hija_manual")
  expect_equal(meta$repeat_group, "rep_servicios")
  expect_equal(meta$parent_base, "madre")
  fallback <- .analitica_repeat_child_meta(sid, "hija_fallback")
  expect_equal(fallback$repeat_group, "rep_visitas")
  expect_equal(fallback$link_key, "_submission__id")
})
