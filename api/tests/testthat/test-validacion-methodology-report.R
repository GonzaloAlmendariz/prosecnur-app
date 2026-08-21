.vmr_test_scope <- function(rules, evaluation = NULL, plan = NULL, choices_map = list()) {
  if (is.null(plan)) plan <- compile_rules_to_plan(rules)
  list(
    plan_result = list(
      plan = plan,
      bundle = list(rules = rules, unsupported = list(), discarded = list(), choices_map = choices_map)
    ),
    evaluacion = evaluation
  )
}

.vmr_test_rule_hash <- function(x) {
  as.character(x$rule_hash %||% x$predicate_hash %||% x$hash %||% "")
}

.vmr_test_variables <- function(x) {
  raw <- as.character(unlist(x$variables %||% x$variable_names %||% character(0), use.names = FALSE))
  if (length(raw) == 1L) raw <- unlist(strsplit(raw, "\\s*,\\s*", perl = TRUE), use.names = FALSE)
  raw[!is.na(raw) & nzchar(raw)]
}

.vmr_test_result_table <- function(result) {
  out <- result$resumen_reglas %||% result$resumen %||% result$summary %||% result$results %||% data.frame()
  expect_s3_class(out, "data.frame")
  out
}

.vmr_test_manifest_table <- function(result) {
  out <- result$manifiesto %||% result$manifest %||% data.frame()
  expect_s3_class(out, "data.frame")
  out
}

.vmr_test_col <- function(df, aliases) {
  hit <- intersect(aliases, names(df))
  expect_true(length(hit) > 0L, info = paste("Falta columna:", paste(aliases, collapse = " / ")))
  hit[[1L]]
}

.vmr_test_pdf_text <- function(model) {
  if (!nzchar(Sys.which("pdftotext"))) skip("pdftotext no está disponible")
  pdf_path <- tempfile(fileext = ".pdf")
  text_path <- tempfile(fileext = ".txt")
  validation_methodology_report_pdf(model, pdf_path)
  status <- system2("pdftotext", c("-layout", pdf_path, text_path))
  expect_identical(status, 0L)
  list(
    path = pdf_path,
    text = paste(readLines(text_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  )
}

.vmr_test_rule_page <- function(report_text, rule_title) {
  pages <- strsplit(report_text, "\f", fixed = TRUE)[[1L]]
  pages <- pages[grepl(rule_title, pages, fixed = TRUE) & grepl("comprueba", pages, ignore.case = TRUE)]
  expect_length(pages, 1L)
  pages[[1L]]
}

.vmr_test_pdf_page <- function(report_text, token) {
  pages <- strsplit(report_text, "\f", fixed = TRUE)[[1L]]
  pages <- pages[grepl(token, pages, fixed = TRUE)]
  expect_length(pages, 1L)
  pages[[1L]]
}

test_that("modelo usa bundle rules como fuente de nombres, variables, ids y hashes", {
  rules <- list(
    rule_required("nombre_real", nombre = "Nombre real obligatorio"),
    rule_duplicate(c("hogar_id", "persona_id"), nombre = "Llave real del integrante")
  )
  plan <- compile_rules_to_plan(rules)
  plan[["Nombre de regla"]] <- c("Nombre adulterado", "Duplicado adulterado")
  plan[["Variable 1"]] <- c("variable_incorrecta", "otra_incorrecta")

  model <- build_validation_methodology_report_model(
    .vmr_test_scope(rules, plan = plan),
    base_nombre = "base_cliente"
  )

  expect_equal(vapply(model$rules, `[[`, character(1), "id"), vapply(rules, `[[`, character(1), "id"))
  expect_equal(vapply(model$rules, `[[`, character(1), "name"), vapply(rules, `[[`, character(1), "nombre"))
  expect_equal(.vmr_test_variables(model$rules[[1L]]), "nombre_real")
  expect_setequal(.vmr_test_variables(model$rules[[2L]]), c("hogar_id", "persona_id"))
  expect_equal(vapply(model$rules, .vmr_test_rule_hash, character(1)), vapply(rules, .vmr_test_rule_hash, character(1)))
  expect_true(all(nzchar(vapply(model$rules, .vmr_test_rule_hash, character(1)))))
})

test_that("clasificacion AST nunca presenta odk_raw en predicate o gate como R exacto", {
  rules <- list(
    rule_odk_raw(
      "pulldata('catalogo', 'valor', 'id', ${id})",
      variables = "id",
      nombre = "Consulta de catálogo externo",
      origin = "pulldata"
    ),
    rule_required(
      "comentario",
      gate = ast_odk_raw("custom-unsupported(${habilita})", origin = "constraint"),
      nombre = "Obligatoriedad con gate no traducible"
    )
  )
  model <- build_validation_methodology_report_model(.vmr_test_scope(rules))
  kinds <- vapply(model$rules, `[[`, character(1), "formula_kind")

  expect_false(any(kinds == "exact_r"))
  expect_true(all(kinds %in% c("source_odk", "not_executed")))
})

test_that("reporte metodologico conserva mas de 500 reglas y permite comprobar el ultimo id", {
  n <- 505L
  rules <- lapply(seq_len(n), function(i) {
    rule_required(
      paste0("q", i),
      nombre = paste("Respuesta obligatoria", i),
      objetivo = paste("Verifica la respuesta de q", i)
    )
  })
  scope <- .vmr_test_scope(rules)
  scope$variables_excluidas <- "telefono"
  model <- build_validation_methodology_report_model(
    scope,
    base_nombre = "acnur",
    estudio_nombre = "ACNUR PDM",
    upstream_universe = list(
      applied = TRUE, variable = "testreal", total = 430L,
      included = 427L, excluded_test = 3L
    )
  )
  expect_length(model$rules, n)
  expect_equal(model$summary$total, n)
  expect_equal(model$summary$evaluated, 0L)
  expect_true(all(grepl("a[uú]n no ejecutado", vapply(model$rules, `[[`, character(1), "state"), ignore.case = TRUE, perl = TRUE)))
  expect_false(any(grepl("telefono", vapply(model$rules, function(x) paste(unlist(x), collapse = " "), character(1)), fixed = TRUE)))

  pdf_path <- tempfile(fileext = ".pdf")
  validation_methodology_report_pdf(model, pdf_path)
  expect_true(file.exists(pdf_path))
  expect_gt(file.info(pdf_path)$size, 1000)
  if (nzchar(Sys.which("pdftotext"))) {
    text_path <- tempfile(fileext = ".txt")
    status <- system2("pdftotext", c("-layout", pdf_path, text_path))
    expect_identical(status, 0L)
    report_text <- paste(readLines(text_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
    expect_match(report_text, rules[[n]]$nombre, fixed = TRUE)
  }
})

test_that("script R es parseable, cargable y no ejecuta trabajo al hacer source", {
  rules <- list(rule_required("nombre", nombre = "Nombre obligatorio"))
  model <- build_validation_methodology_report_model(.vmr_test_scope(rules))
  dir <- tempfile("vmr-r-")
  dir.create(dir)
  r_path <- file.path(dir, "validar_base.R")

  validation_methodology_report_r(model, r_path)
  expect_true(file.exists(r_path))
  expect_error(parse(file = r_path), NA)
  before <- sort(list.files(dir, all.files = TRUE, no.. = TRUE))
  env <- new.env(parent = baseenv())
  expect_error(sys.source(r_path, envir = env), NA)
  after <- sort(list.files(dir, all.files = TRUE, no.. = TRUE))

  expect_equal(after, before)
  expect_true(exists("read_validation_data", envir = env, mode = "function", inherits = FALSE))
  expect_true(exists("validate_data", envir = env, mode = "function", inherits = FALSE))
})

test_that("script R comparte con el PDF los encabezados, la numeracion y el orden de reglas", {
  rules <- list(
    rule_required("nombre", nombre = "Nombre obligatorio"),
    rule_duplicate("id", nombre = "Identificador único"),
    rule_required("correo", nombre = "Correo obligatorio"),
    rule_range("edad", min = 0, max = 120, type = "numeric", nombre = "Edad válida")
  )
  evaluation <- list(resumen_tabla = data.frame(
    id_regla = vapply(rules[1:3], `[[`, character(1), "id"),
    estado = "correcta",
    n_evaluados = 427L,
    n_inconsistencias = c(0L, 2L, 1L),
    stringsAsFactors = FALSE
  ))
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(rules, evaluation = evaluation),
    upstream_universe = list(
      applied = TRUE,
      variable = "tipo_registro",
      real_values = "real",
      test_values = "prueba",
      total = 430L,
      included = 427L,
      excluded_test = 3L
    )
  )
  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  script <- paste(readLines(r_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")

  expect_match(script, "# REGLAS Y RESULTADOS", fixed = TRUE)
  expect_match(script, "# DATOS INCLUIDOS EN LA VALIDACIÓN", fixed = TRUE)
  expect_match(script, "# Qué comprueba", fixed = TRUE)
  expect_match(script, "# Fórmula R de comprobación", fixed = TRUE)
  expect_match(script, "# Resultado", fixed = TRUE)
  expect_match(script, "# Encuestas evaluadas: 427", fixed = TRUE)
  expect_match(script, "# Casos encontrados: 0", fixed = TRUE)
  expect_match(script, "# Reglas aplicadas: 3", fixed = TRUE)
  expect_false(grepl("Este archivo reproduce", script, fixed = TRUE))
  expect_false(grepl("por aproximacion", script, fixed = TRUE))
  expect_false(grepl("Edad válida", script, fixed = TRUE))
  expect_false(grepl("No evaluada en el último análisis", script, fixed = TRUE))

  expected_titles <- c(
    "# Regla 1: «Nombre obligatorio»",
    "# Regla 2: «Correo obligatorio»",
    "# Regla 3: «Identificador único»"
  )
  title_positions <- vapply(expected_titles, function(title) {
    match(TRUE, grepl(title, readLines(r_path, warn = FALSE, encoding = "UTF-8"), fixed = TRUE))
  }, integer(1))
  expect_false(anyNA(title_positions))
  expect_true(all(diff(title_positions) > 0L))

  report <- .vmr_test_pdf_text(model)
  pdf_positions <- vapply(sub("^# ", "", expected_titles), function(title) {
    regexpr(title, report$text, fixed = TRUE)[[1L]]
  }, integer(1))
  expect_true(all(pdf_positions > 0L))
  expect_true(all(diff(pdf_positions) > 0L))
  expect_false(grepl("Edad válida", report$text, fixed = TRUE))
  expect_false(grepl("No evaluada en el último análisis", report$text, fixed = TRUE))
})

test_that("script R completa la etiqueta tecnica en modelos persistidos anteriores", {
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("nombre", nombre = "Nombre obligatorio")))
  )
  model$rules[[1L]]$technical_label <- NULL

  r_path <- tempfile(fileext = ".R")
  expect_error(validation_methodology_report_r(model, r_path), NA)
  env <- new.env(parent = baseenv())
  sys.source(r_path, envir = env)

  expect_identical(env$plan_manifest$estado_tecnico[[1L]], "Fórmula R")
})

test_that("PDF formatea formulas R con estructura legible sin cambiar su significado", {
  raw <- paste0(
    "(is.na(mand_Date) | as.character(mand_Date) == '' | ",
    "as.character(mand_Date) == 'NA')"
  )
  pretty <- .vmr_pretty_r_formula(raw, width = 54L)
  lines <- strsplit(pretty, "\n", fixed = TRUE)[[1L]]

  expect_gte(length(lines), 3L)
  expect_true(all(nchar(lines, type = "width") <= 54L))
  expect_match(pretty, 'as.character\\(mand_Date\\) == ""', perl = TRUE)
  expect_match(pretty, 'as.character\\(mand_Date\\) == "NA"', perl = TRUE)

  data <- data.frame(mand_Date = c(NA, "", "NA", "2026-07-01"))
  original_result <- with(data, eval(parse(text = raw)))
  pretty_result <- with(data, eval(parse(text = pretty)))
  expect_identical(pretty_result, original_result)

  long_comparison <- paste0(
    "as.character(a_very_long_variable_name_for_a_client_report) == ",
    "'a very long allowed response value'"
  )
  long_pretty <- .vmr_pretty_r_formula(long_comparison, width = 46L)
  expect_match(long_pretty, "\\) ==\\n", perl = TRUE)
  expect_error(parse(text = long_pretty), NA)
})

test_that("PDF ordena llamadas R largas por argumentos y conserva vectores compactos", {
  vars <- paste0("q", seq_len(24L))
  raw <- sprintf(
    ".vd_duplicate_similarity(.__eval_data__, vars = c(%s), threshold = 0.9, minimum_coverage = 0.8)",
    paste(sprintf("'%s'", vars), collapse = ", ")
  )
  pretty <- .vmr_pretty_r_formula(raw, width = 72L)
  lines <- strsplit(pretty, "\n", fixed = TRUE)[[1L]]

  expect_identical(lines[[1L]], ".vd_duplicate_similarity(")
  expect_true(any(grepl("vars = c\\(", lines, perl = TRUE)))
  expect_true(any(grepl("threshold = 0.9", lines, fixed = TRUE)))
  expect_true(any(grepl("minimum_coverage = 0.8", lines, fixed = TRUE)))
  expect_identical(tail(lines, 1L), ")")
  expect_true(all(nchar(lines, type = "width") <= 72L))
  expect_error(parse(text = pretty), NA)
})

test_that("formato R elimina parentesis redundantes antes de medir la altura de la ficha", {
  raw <- paste0(
    "(!((.vd_cmp_const_eq('Consent', Consent, '==', 'Yes', NULL) & ",
    "(!is.na(srv_claridad) & (as.character(srv_claridad) %in% c('1', '2'))))) & ",
    "!((is.na(srv_claridad_why) | as.character(srv_claridad_why) == '' | ",
    "as.character(srv_claridad_why) == 'NA')))"
  )
  pretty <- .vmr_pretty_r_formula(raw, width = 90L)
  lines <- strsplit(pretty, "\n", fixed = TRUE)[[1L]]

  expect_lte(length(lines), 15L)
  expect_true(all(nchar(lines, type = "width") <= 90L))
  data <- expand.grid(
    Consent = c("Yes", "No", NA),
    srv_claridad = c(NA, "1", "2", "3"),
    srv_claridad_why = c(NA, "", "texto"),
    stringsAsFactors = FALSE
  )
  expect_identical(
    with(data, eval(parse(text = pretty))),
    with(data, eval(parse(text = raw)))
  )
})

test_that("script R evalua reglas portables y declara las no ejecutables", {
  rules <- list(
    rule_required("nombre", nombre = "Nombre obligatorio"),
    rule_range("edad", min = 0, max = 120, type = "numeric", nombre = "Edad válida"),
    rule_range("fecha", min = "2026-07-01", max = "2026-07-15", type = "date", nombre = "Fecha de campo"),
    rule_duplicate("id", nombre = "Identificador único"),
    rule_odk_raw("unsupported(${nombre})", variables = "nombre", nombre = "Fuente no traducida", origin = "constraint")
  )
  model <- build_validation_methodology_report_model(.vmr_test_scope(rules))
  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  env <- new.env(parent = baseenv())
  sys.source(r_path, envir = env)

  csv_path <- tempfile(fileext = ".csv")
  data <- data.frame(
    nombre = c("Ana", "", NA, "Luis"),
    edad = c(30, 130, -1, 40),
    fecha = c("2026-07-01", "2026-06-30", "2026-07-31", NA),
    id = c("A", "B", "B", NA),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  utils::write.csv(data, csv_path, row.names = FALSE, na = "")
  loaded <- env$read_validation_data(csv_path)
  expect_s3_class(loaded, "data.frame")
  expect_identical(names(loaded), names(data))

  result <- env$validate_data(loaded)
  summary <- .vmr_test_result_table(result)
  id_col <- .vmr_test_col(summary, c("id", "rule_id", "id_regla"))
  findings_col <- .vmr_test_col(summary, c("casos_encontrados", "casos_senalados", "findings", "n_hallazgos", "n_violaciones", "n_inconsistencias"))
  state_col <- .vmr_test_col(summary, c("state", "estado", "status"))

  idx <- match(vapply(rules, `[[`, character(1), "id"), as.character(summary[[id_col]]))
  expect_false(anyNA(idx))
  expect_equal(as.numeric(summary[[findings_col]][idx[1:4]]), c(2, 2, 2, 2))
  expect_match(as.character(summary[[state_col]][idx[[5L]]]), "sin_formula_r|no[_ ]?ejecutable|source_odk|no ejecutada", ignore.case = TRUE)
  expect_true(is.na(suppressWarnings(as.numeric(summary[[findings_col]][idx[[5L]]]))))

  manifest <- .vmr_test_manifest_table(result)
  manifest_id_col <- .vmr_test_col(manifest, c("rule_id", "id", "id_regla"))
  hash_col <- .vmr_test_col(manifest, c("rule_hash", "predicate_hash", "hash"))
  manifest_idx <- match(vapply(rules, `[[`, character(1), "id"), as.character(manifest[[manifest_id_col]]))
  expect_false(anyNA(manifest_idx))
  expect_equal(as.character(manifest[[hash_col]][manifest_idx]), vapply(rules, .vmr_test_rule_hash, character(1)))
})

test_that("bundle ZIP contiene exactamente el PDF y el script R", {
  rules <- list(rule_required("nombre", nombre = "Nombre obligatorio"))
  model <- build_validation_methodology_report_model(.vmr_test_scope(rules))
  model_path <- tempfile(fileext = ".rds")
  zip_path <- tempfile(fileext = ".zip")
  saveRDS(model, model_path)

  out <- validation_methodology_report_bundle_job_runner(model_path, result_path = zip_path)
  expect_true(out$ok)
  expect_true(file.exists(zip_path))
  members <- utils::unzip(zip_path, list = TRUE)$Name

  expect_length(members, 2L)
  expect_false(any(grepl("/$", members)))
  expect_setequal(tolower(tools::file_ext(members)), c("pdf", "r"))
})

test_that("PDF metodologico usa A4 vertical", {
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("nombre", nombre = "Nombre obligatorio")))
  )
  report <- .vmr_test_pdf_text(model)

  if (nzchar(Sys.which("pdfinfo"))) {
    info <- system2("pdfinfo", report$path, stdout = TRUE)
    page_size <- grep("^Page size:", info, value = TRUE)
    expect_length(page_size, 1L)
    expect_match(page_size, "59[45](?:\\.[0-9]+)? x 84[12](?:\\.[0-9]+)? pts")
  }
})

test_that("PDF conserva todas las familias en el indice cuando hay mas de 14", {
  rules <- lapply(seq_len(17L), function(i) {
    rule <- rule_required(
      paste0("variable_", i),
      nombre = paste("Control de la familia", i)
    )
    rule$categoria_ux <- paste0("Familia editorial ", sprintf("%02d", i))
    rule
  })
  report <- .vmr_test_pdf_text(
    build_validation_methodology_report_model(.vmr_test_scope(rules))
  )
  pages <- strsplit(report$text, "\f", fixed = TRUE)[[1L]]
  index_pages <- pages[grepl("Reglas por tema", pages, fixed = TRUE)]

  expect_gte(length(index_pages), 1L)
  index_text <- paste(index_pages, collapse = "\n")
  expected_families <- paste0("Familia editorial ", sprintf("%02d", seq_len(17L)))
  visible_families <- expected_families[vapply(
    expected_families,
    function(family) grepl(family, index_text, fixed = TRUE),
    logical(1)
  )]
  expect_setequal(visible_families, expected_families)
})

test_that("humanizador usa etiquetas declaradas sin inventar sede", {
  raw <- paste(
    "[GEN_001] Si ${sede_ppl} cuenta con «Consent»,",
    "se revisa «segmento_prioritario»."
  )
  labels <- list(
    sede_ppl = "Punto muestral",
    Consent = "Autorización documentada",
    segmento_prioritario = "Grupo de atención"
  )
  title <- .vmr_humanize_title(raw, variable_labels = labels)

  expect_match(title, "Punto muestral", fixed = TRUE)
  expect_match(title, "Autorización documentada", fixed = TRUE)
  expect_match(title, "Grupo de atención", fixed = TRUE)
  expect_false(grepl("sede registrada|\\$\\{|sede_ppl|Consent|segmento_prioritario", title, ignore.case = TRUE, perl = TRUE))

  nested <- .vmr_humanize_title(
    "«tiempo_llegada» debe responderse",
    variable_labels = c(
      sede_ppl = "Punto muestral",
      tiempo_llegada = "Tiempo para llegar a ${sede_ppl}"
    )
  )
  expect_identical(nested, "«Tiempo para llegar a Punto muestral» debe responderse")
  expect_identical(
    .vmr_humanize_title(
      "[tiempo_llegada] «tiempo_llegada» debe responderse",
      variable_labels = c(
        sede_ppl = "Punto muestral",
        tiempo_llegada = "Tiempo para llegar a ${sede_ppl}"
      )
    ),
    "«Tiempo para llegar a Punto muestral» debe responderse"
  )
  expect_identical(
    .vmr_humanize_title(
      "[tiempo_llegada] Salto · «tiempo_llegada» - no debe responderse",
      variable_labels = c(
        sede_ppl = "Punto muestral",
        tiempo_llegada = "Tiempo para llegar a ${sede_ppl}"
      )
    ),
    "«Tiempo para llegar a Punto muestral» debe permanecer sin respuesta cuando no corresponde"
  )
  expect_identical(
    .vmr_humanize_title(
      "[tiempo_llegada] Salto · «tiempo_llegada» (condición avanzada)",
      variable_labels = c(
        sede_ppl = "Punto muestral",
        tiempo_llegada = "Tiempo para llegar a ${sede_ppl}"
      )
    ),
    "«Tiempo para llegar a Punto muestral» se evalúa con una condición avanzada"
  )
  expect_identical(
    .vmr_humanize_title("[segmento_prioritario] requiere revisión", labels),
    "Grupo de atención requiere revisión"
  )
  expect_identical(
    .vmr_humanize_title("[segmento_prioritario] «segmento_prioritario» debe responderse", labels),
    "«Grupo de atención» debe responderse"
  )
  # Variable ausente del mapa de etiquetas (label == code, p. ej. UMP): el
  # título debe conservar la variable entre comillas angulares, no colapsar a un
  # «debe responderse» pelado por confundir [UMP] con un prefijo editorial.
  ump_title <- .vmr_humanize_title("[UMP] debe responderse", list(code_pulso = "Código PULSO"))
  expect_match(ump_title, "«UMP»", fixed = TRUE)
  expect_false(grepl("«debe responderse»", ump_title, fixed = TRUE))
  expect_identical(ump_title, "«UMP» debe responderse")
  # Prefijo editorial ajeno tipo [SATI_014] (nombre_###) se sigue retirando.
  expect_identical(
    .vmr_humanize_title("[SATI_014] La pregunta debe responderse", list()),
    "La pregunta debe responderse"
  )
  expect_identical(.vmr_humanize_title("¿Pregunta de control ?"), "¿Pregunta de control?")
  expect_identical(
    .vmr_humanize_title("Pregunta de control Salto · «Pregunta de control» (condición avanzada)"),
    "«Pregunta de control» se evalúa con una condición avanzada"
  )
  expect_identical(
    .vmr_humanize_title("Pregunta de control Salto · «Pregunta de control» (modo experto)"),
    "«Pregunta de control» se evalúa con una condición avanzada"
  )
})

test_that("modelo explica variables sin etiqueta sin exponer jerga editorial", {
  rule <- rule_required("campo_nolabel", nombre = "Salto - no debe responderse")
  model <- build_validation_methodology_report_model(.vmr_test_scope(list(rule)))
  control <- model$rules[[1L]]

  expect_identical(
    control$name,
    "«Variable sin etiqueta en el formulario» debe permanecer sin respuesta cuando no corresponde"
  )
  expect_identical(
    unname(control$variables_display),
    "Variable sin etiqueta en el formulario [campo_nolabel]"
  )
})

test_that("modelo infiere etiquetas de calculos externos sin hardcodear el dominio", {
  external <- rule_odk_raw(
    "pulldata('marco', 'Zona operativa', 'codigo', ${id})",
    variables = "zona_codigo",
    nombre = "[zona_codigo] requiere marco externo",
    origin = "pulldata"
  )
  external$variable_roles$target <- "zona_codigo"
  external$variable_roles$labels <- list()
  external$objetivo <- "El valor de «» se obtiene del marco externo."
  external$presentation$nombre_humano <- external$nombre
  external$presentation$objetivo <- external$objetivo
  dependent <- rule_required(
    "tiempo",
    nombre = "«tiempo» debe responderse",
    objetivo = "Se revisa el tiempo declarado para ${zona_codigo}."
  )
  dependent$variable_roles$labels <- list(
    tiempo = "Tiempo de llegada a ${zona_codigo}"
  )
  self_labeled <- rule_required(
    "zona_codigo",
    nombre = "«zona_codigo» debe estar presente"
  )
  self_labeled$variable_roles$labels <- list(zona_codigo = "zona_codigo")

  model <- build_validation_methodology_report_model(.vmr_test_scope(list(external, dependent, self_labeled)))

  expect_identical(model$rules[[1L]]$name, "Zona operativa requiere marco externo")
  expect_match(model$rules[[1L]]$validates, "«Zona operativa»", fixed = TRUE)
  expect_match(model$rules[[2L]]$name, "Tiempo de llegada a Zona operativa", fixed = TRUE)
  expect_match(model$rules[[2L]]$validates, "Zona operativa", fixed = TRUE)
  expect_false(grepl("zona_codigo|\\$\\{", paste(model$rules[[2L]]$name, model$rules[[2L]]$validates), perl = TRUE))
  expect_identical(model$rules[[3L]]$name, "«Zona operativa» debe estar presente")
  expect_identical(unname(model$rules[[3L]]$variables_display), "Zona operativa [zona_codigo]")
  expect_identical(
    .vmr_external_reference_grammar(
      "Espacio de atención de Zona operativa",
      list(zona_codigo = "Zona operativa")
    ),
    "Espacio de atención de la zona operativa registrada"
  )
})

test_that("modelo reserva codigos auxiliares y valores de catalogo para la formula tecnica", {
  rule <- rule_required(
    "respuesta",
    gate = ast_in_set("item_code", c("legal", "health")),
    nombre = "«respuesta» debe responderse para «item_label»",
    objetivo = "Comprueba la respuesta cuando item_code pertenece a {legal, health}."
  )
  rule$variable_roles$labels <- list(
    respuesta = "Calidad para ${item_label}",
    item_code = "item_code",
    item_label = "item_label"
  )
  rule$presentation$nombre_humano <- rule$nombre
  rule$presentation$objetivo <- rule$objetivo
  rule$presentation$gate_humano <- "Se aplica si item_code pertenece a {legal, health}."

  model <- build_validation_methodology_report_model(.vmr_test_scope(
    list(rule),
    choices_map = list(items = c(
      legal = "Orientación legal",
      health = "Atención de salud"
    ))
  ))
  control <- model$rules[[1L]]
  visible <- paste(
    control$name,
    control$validates,
    control$applies_when,
    paste(control$variables_display, collapse = " · ")
  )

  expect_false(grepl(
    "item[_ ]code|item[_ ]label|«legal»|«health»|\\{legal|, health\\}",
    visible,
    ignore.case = TRUE,
    perl = TRUE
  ))
  expect_match(visible, "opción evaluada", fixed = TRUE)
  expect_match(visible, "Orientación legal", fixed = TRUE)
  expect_match(visible, "Atención de salud", fixed = TRUE)
  expect_false(any(grepl("\\[item_code\\]", control$variables_display, perl = TRUE)))
  expect_match(control$formula_raw, "item_code", fixed = TRUE)
  expect_match(control$formula_raw, "legal", fixed = TRUE)

  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  env <- new.env(parent = baseenv())
  sys.source(r_path, envir = env)
  expect_match(env$plan_manifest$variables_tecnicas[[1L]], "item_code", fixed = TRUE)
  expect_false(grepl("item_code", env$plan_manifest$variables[[1L]], fixed = TRUE))
})

test_that("modelo diferencia titulos iguales con el contexto humano de cada control", {
  initial <- rule_required(
    "motivo",
    gate = ast_compare_const("canal_inicial", "==", "No"),
    nombre = "«motivo» debe responderse"
  )
  initial$variable_roles$labels <- list(
    motivo = "¿Por qué?",
    canal_inicial = "Atención inicial"
  )
  followup <- rule_required(
    "motivo",
    gate = ast_compare_const("canal_seguimiento", "==", "No"),
    nombre = "«motivo» debe responderse"
  )
  followup$variable_roles$labels <- list(
    motivo = "¿Por qué?",
    canal_seguimiento = "Atención de seguimiento"
  )

  model <- build_validation_methodology_report_model(.vmr_test_scope(list(initial, followup)))
  names <- vapply(model$rules, `[[`, character(1), "name")

  expect_identical(anyDuplicated(names), 0L)
  expect_true(all(grepl("En relación con", names, fixed = TRUE)))
  expect_true(any(grepl("Atención inicial", names, fixed = TRUE)))
  expect_true(any(grepl("Atención de seguimiento", names, fixed = TRUE)))
})

test_that("PDF expone arquitectura editorial completa", {
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("nombre", nombre = "Nombre obligatorio")))
  )
  report <- .vmr_test_pdf_text(model)

  for (section in c(
    "Informe de validación",
    "Reglas y resultados",
    "Reglas por tema",
    "Resumen final"
  )) {
    expect_match(report$text, section, fixed = TRUE)
  }

  expect_false(grepl("ejecutiv", report$text, ignore.case = TRUE))
})

test_that("pagina de resultados prioriza controles aplicados y no estados pendientes", {
  categories <- c(
    rep("saltos", 6L), rep("completitud", 4L), rep("calculos", 3L),
    "consistencia", "coherencia", "estructura", "duplicados"
  )
  rules <- lapply(seq_along(categories), function(i) {
    rule <- rule_required(paste0("q", i), nombre = paste("Control", i))
    rule$categoria_ux <- categories[[i]]
    rule
  })
  evaluation <- list(resumen_tabla = data.frame(
    id_regla = vapply(rules, `[[`, character(1), "id"),
    estado = "correcta",
    n_evaluados = 427L,
    n_inconsistencias = 0L,
    stringsAsFactors = FALSE
  ))
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(rules, evaluation = evaluation),
    upstream_universe = list(
      applied = TRUE,
      total = 430L,
      excluded_test = 3L,
      included = 427L
    )
  )
  report <- .vmr_test_pdf_text(model)
  page <- .vmr_test_pdf_page(report$text, "Reglas y resultados")

  for (label in c(
    "Reglas aplicadas",
    "Evaluaciones",
    "Casos encontrados",
    "Reglas aplicadas por tema",
    "Base usada"
  )) {
    expect_match(page, label, ignore.case = TRUE)
  }
  for (label in c("Sin evaluación", "No aplicables", "No ejecutados", "Cobertura del plan")) {
    expect_false(grepl(label, page, fixed = TRUE))
  }
  expect_false(grepl("Reglas con fórmula\\s*\\n\\s*R", page, perl = TRUE))
})

test_that("composicion de resultados agrupa familias menores sin hardcodear el estudio", {
  by_category <- data.frame(
    category = c("saltos", "completitud", "calculos", "consistencia", "coherencia", "estructura", "duplicados"),
    evaluated = c(93L, 51L, 13L, 3L, 2L, 1L, 1L),
    stringsAsFactors = FALSE
  )

  rows <- .vmr_result_family_rows(by_category, max_rows = 5L)

  expect_equal(nrow(rows), 5L)
  expect_equal(rows$label[[1L]], "Lógica de saltos")
  expect_equal(rows$label[[5L]], "Otras familias")
  expect_equal(rows$evaluated[[5L]], 4L)
  expect_equal(sum(rows$evaluated), sum(by_category$evaluated))
  expect_true(all(diff(rows$evaluated[seq_len(4L)]) <= 0))
})

test_that("PDF no expone hashes ni referencias internas del motor", {
  rule <- rule_required("nombre", nombre = "Nombre obligatorio")
  model <- build_validation_methodology_report_model(.vmr_test_scope(list(rule)))
  report <- .vmr_test_pdf_text(model)

  expect_false(grepl("Inventario [[:xdigit:]]{8,}", report$text, perl = TRUE))
  expect_false(grepl("Referencia técnica", report$text, fixed = TRUE))
  expect_false(grepl(rule$id, report$text, fixed = TRUE))
  expect_false(grepl("Informativa · Instrumento · principal", report$text, fixed = TRUE))
})

test_that("logo conserva la proporcion fisica del archivo fuente", {
  skip_if_not_installed("png")
  logo <- .vmr_logo_path()
  expect_true(nzchar(logo))
  img <- png::readPNG(logo)
  source_ratio <- dim(img)[[1L]] / dim(img)[[2L]]

  expect_equal(
    .vmr_raster_height_inches(img, width_inches = 2.5) / 2.5,
    source_ratio,
    tolerance = 1e-10
  )
})

test_that("anchos de texto aprovechan la ficha sin reducir tipografia", {
  widths <- .vmr_rule_wrap_widths()

  expect_gte(unname(widths[["description"]]), 96L)
  expect_gte(unname(widths[["formula"]]), 88L)
})

test_that("titulo numerado no duplica comillas tipograficas", {
  expect_identical(
    .vmr_numbered_rule_title(1L, "«Fecha de registro» debe responderse"),
    "Regla 1: «Fecha de registro» debe responderse"
  )
  expect_identical(
    .vmr_numbered_rule_title(2L, "Control simple"),
    "Regla 2: «Control simple»"
  )
  expect_identical(
    .vmr_numbered_rule_title(3L, "Fecha de registro Consistencia · «Fecha de registro»"),
    "Regla 3: Consistencia de «Fecha de registro»"
  )
})

test_that("descripcion excepcionalmente larga remite al criterio R completo", {
  narrative <- paste(rep("Condición extensa con múltiples combinaciones declaradas por el instrumento.", 30L), collapse = " ")
  compact <- .vmr_pdf_rule_description(narrative, "consistencia", width = 100L, max_lines = 7L)

  expect_lte(length(strwrap(compact, width = 100L)), 7L)
  expect_match(compact, "fórmula R conserva el criterio completo", ignore.case = TRUE)
  expect_match(compact, "combinaciones y condiciones de aplicación", fixed = TRUE)
})

test_that("PDF conserva el marcador final de una narrativa larga", {
  marker <- "MARCADORFINAL7429"
  narrative <- paste(
    c(
      rep(
        "Comprueba la coherencia integral del registro considerando las condiciones declaradas en el instrumento y la evidencia disponible.",
        3L
      ),
      marker
    ),
    collapse = " "
  )
  rule <- rule_required(
    "respuesta_extensa",
    nombre = "Control con explicación metodológica extensa",
    objetivo = narrative
  )
  report <- .vmr_test_pdf_text(
    build_validation_methodology_report_model(.vmr_test_scope(list(rule)))
  )

  expect_match(report$text, marker, fixed = TRUE)
  pages <- strsplit(report$text, "\f", fixed = TRUE)[[1L]]
  expect_length(pages[grepl("Regla 1:", pages, fixed = TRUE)], 1L)
  expect_false(grepl("parte 1 de", report$text, fixed = TRUE))
})

test_that("ficha presenta regla numerada y resultado como diagrama", {
  rule <- rule_required("nombre", nombre = "Nombre obligatorio")
  evaluation <- list(resumen_tabla = data.frame(
    id_regla = rule$id,
    estado = "correcta",
    n_evaluados = 427L,
    n_inconsistencias = 3L,
    stringsAsFactors = FALSE
  ))
  report <- .vmr_test_pdf_text(build_validation_methodology_report_model(
    .vmr_test_scope(list(rule), evaluation = evaluation)
  ))
  page <- .vmr_test_rule_page(report$text, rule$nombre)

  expect_match(page, "Regla 1:", fixed = TRUE)
  expect_match(page, "Fórmula R de comprobación", fixed = TRUE)
  expect_match(page, "Encuestas evaluadas", ignore.case = TRUE)
  expect_match(page, "Casos encontrados", ignore.case = TRUE)
  expect_match(page, "Sin casos", fixed = TRUE)
  expect_false(grepl("Aplicación y resultado", page, fixed = TRUE))
})

test_that("ficha de tabla repetible distingue respuestas de encuestas", {
  rule <- rule_required("detalle", nombre = "Detalle obligatorio")
  rule$tabla <- "rep_servicios"
  evaluation <- list(resumen_tabla = data.frame(
    id_regla = rule$id,
    estado = "correcta",
    n_evaluados = 664L,
    n_inconsistencias = 0L,
    stringsAsFactors = FALSE
  ))
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule), evaluation = evaluation),
    upstream_universe = list(included = 427L)
  )
  report <- .vmr_test_pdf_text(model)
  page <- .vmr_test_rule_page(report$text, rule$nombre)

  expect_match(page, "RESPUESTAS EVALUADAS", fixed = TRUE)
  expect_match(page, "RESULTADO DE LAS RESPUESTAS", fixed = TRUE)
  expect_match(page, "De 427 encuestas incluidas", fixed = TRUE)
  expect_match(page, "664", fixed = TRUE)
  expect_false(grepl("ENCUESTAS EVALUADAS", page, fixed = TRUE))

  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  script <- paste(readLines(r_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(script, "# Respuestas evaluadas: 664", fixed = TRUE)
  expect_match(script, "# Encuestas incluidas: 427", fixed = TRUE)
  expect_match(script, 'unidad_evaluada = "respuesta"', fixed = TRUE)
})

test_that("formula extensa conserva llamadas de comparación legibles y el resultado en la misma ficha", {
  comparisons <- vapply(seq_len(8L), function(i) {
    sprintf(
      ".vd_cmp_const_eq('q%d', q%d, '==', 'Yes', if (exists('.__choices_map__', inherits = TRUE)) `.__choices_map__` else NULL)",
      i,
      i
    )
  }, character(1))
  formula <- paste0("!(((", paste(comparisons, collapse = ") | ("), "))) & is.na(detalle)")
  rule <- rule_required("detalle", nombre = "Detalle obligatorio")
  evaluation <- list(resumen_tabla = data.frame(
    id_regla = rule$id,
    estado = "correcta",
    n_evaluados = 427L,
    n_inconsistencias = 0L,
    stringsAsFactors = FALSE
  ))
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule), evaluation = evaluation)
  )
  model$rules[[1L]]$formula_raw <- formula
  model$rules[[1L]]$formula <- formula
  model$rules[[1L]]$formula_kind <- "exact_r"
  report <- .vmr_test_pdf_text(model)
  page <- .vmr_test_rule_page(report$text, rule$nombre)

  expect_match(page, ".vd_cmp_const_eq(\"q1\", q1, \"==\", \"Yes\", .opciones)", fixed = TRUE)
  expect_match(page, "Resultado", fixed = TRUE)
  expect_match(page, "Encuestas evaluadas", ignore.case = TRUE)
  expect_match(page, "427", fixed = TRUE)
})

test_that("PDF mantiene titulos y tokens largos dentro de los limites fisicos del A4", {
  if (!nzchar(Sys.which("pdftotext"))) skip("pdftotext no está disponible")
  rule <- rule_required(
    "codigo",
    nombre = paste(
      "«¿Cuánto tiempo le tomó aproximadamente llegar al Espacio de Protección",
      "del punto muestral seleccionado?» debe responderse"
    )
  )
  model <- build_validation_methodology_report_model(.vmr_test_scope(list(rule)))
  long_token <- paste0("TOKENLARGO7429_", paste(rep("X", 300L), collapse = ""))
  model$rules[[1L]]$formula_raw <- long_token
  model$rules[[1L]]$formula <- long_token
  pdf_path <- tempfile(fileext = ".pdf")
  bbox_path <- tempfile(fileext = ".html")
  validation_methodology_report_pdf(model, pdf_path)
  status <- system2("pdftotext", c("-bbox", pdf_path, bbox_path))
  expect_identical(status, 0L)

  bbox <- readLines(bbox_path, warn = FALSE, encoding = "UTF-8")
  page_lines <- grep("<page ", bbox, value = TRUE, fixed = TRUE)
  word_lines <- grep("<word ", bbox, value = TRUE, fixed = TRUE)
  attr_number <- function(lines, attribute) {
    suppressWarnings(as.numeric(sub(
      paste0(".*", attribute, "=\\\"([^\\\"]+)\\\".*"),
      "\\1",
      lines,
      perl = TRUE
    )))
  }
  page_width <- max(attr_number(page_lines, "width"), na.rm = TRUE)
  page_height <- max(attr_number(page_lines, "height"), na.rm = TRUE)
  x_min <- attr_number(word_lines, "xMin")
  x_max <- attr_number(word_lines, "xMax")
  y_min <- attr_number(word_lines, "yMin")
  y_max <- attr_number(word_lines, "yMax")

  expect_true(any(grepl("TOKENLARGO7429", word_lines, fixed = TRUE)))
  expect_gte(min(x_min, na.rm = TRUE), -0.5)
  expect_lte(max(x_max, na.rm = TRUE), page_width + 0.5)
  expect_gte(min(y_min, na.rm = TRUE), -0.5)
  expect_lte(max(y_max, na.rm = TRUE), page_height + 0.5)
})

test_that("resumen suma solo evaluaciones validas y habla de señalamientos", {
  rules <- lapply(seq_len(6L), function(i) {
    rule_required(paste0("q", i), nombre = paste("Control", i))
  })
  evaluation <- list(resumen_tabla = data.frame(
    id_regla = vapply(rules, `[[`, character(1), "id"),
    estado = c("correcta", "correcta", "no_evaluada", "no_aplicable", "incorrecta_ejecucion", "correcta"),
    n_evaluados = c(100L, 50L, 80L, 0L, 60L, 40L),
    n_inconsistencias = c(2L, 1L, 7L, 0L, 8L, 9L),
    stringsAsFactors = FALSE
  ))
  scope <- .vmr_test_scope(rules, evaluation = evaluation)
  scope$reglas_desactivadas <- rules[[6L]]$id
  model <- build_validation_methodology_report_model(scope)

  expect_equal(model$summary$evaluated, 2L)
  expect_equal(model$summary$with_findings, 2L)
  expect_equal(model$summary$without_findings, 0L)
  expect_equal(model$summary$not_evaluated, 1L)
  expect_equal(model$summary$not_applicable, 1L)
  expect_equal(model$summary$execution_failed, 1L)
  expect_equal(model$summary$findings_total, 3)
  expect_equal(model$summary$reviewed_total, 150)
  expect_equal(model$summary$findings_rate, 3 / 150)
  expect_true(is.null(model$summary$unique_cases) || is.na(model$summary$unique_cases))

  report <- .vmr_test_pdf_text(model)
  results_page <- .vmr_test_pdf_page(report$text, "Reglas y resultados")
  expect_match(results_page, "CASOS ENCONTRADOS", fixed = TRUE)
  expect_match(results_page, "EVALUACIONES", fixed = TRUE)
  expect_false(grepl("3\\s+(?:errores|inconsistencias)(?:\\s+confirmad[oa]s)?", report$text, ignore.case = TRUE, perl = TRUE))
  expect_true(grepl("Un caso encontrado\\s+debe\\s+revisarse\\s+antes\\s+de\\s+modificar\\s+la\\s+base", report$text, ignore.case = TRUE, perl = TRUE))
  expect_false(grepl("no_evaluada|no_aplicable|incorrecta_ejecucion", report$text, fixed = FALSE))
})

test_that("sin hallazgos el cierre no arrastra la coletilla del caso encontrado", {
  # Se pegaba siempre: «no encontraron casos. Un caso encontrado debe revisarse
  # antes de modificar la base» se contradice a sí mismo.
  evaluation <- list(resumen_tabla = data.frame(
    id_regla = rule_required("Pulso_code")$id, estado = "correcta",
    n_evaluados = 101L, n_inconsistencias = 0L, stringsAsFactors = FALSE))
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("Pulso_code")), evaluation = evaluation),
    upstream_universe = list(applied = TRUE, variable = "testreal", real_values = "real",
                             total = 101L, included = 101L, excluded_test = 0L))
  if (!nzchar(Sys.which("pdftotext"))) skip("pdftotext no está disponible")
  report <- .vmr_test_pdf_text(model)
  texto <- gsub("\\s+", " ", report$text)
  expect_match(texto, "no encontraron casos", fixed = TRUE)
  expect_false(grepl("Un caso encontrado debe revisarse", texto, fixed = TRUE))
})

test_that("titulos cliente eliminan codigos, tokens ODK e ingles operativo", {
  raw <- "[SATI_014] Si la sección de ${sede_ppl} se abre («Consent» = 'Yes'), entonces «total_espacios» coincide."
  title <- .vmr_humanize_title(raw, c(
    sede_ppl = "Punto muestral",
    Consent = "Consentimiento",
    total_espacios = "Total de ambientes"
  ))

  expect_false(grepl("SATI_014|\\$\\{|\\bConsent\\b|'Yes'|total_espacios", title, perl = TRUE))
  expect_match(title, "Punto muestral", fixed = TRUE)
  expect_match(title, "Consentimiento", fixed = TRUE)
  expect_match(title, "Total de ambientes", fixed = TRUE)
})

test_that("modelo reconoce el resumen canonico del evaluador AST", {
  rule <- rule_required("nombre", nombre = "Nombre obligatorio")
  evaluation <- list(resumen = data.frame(
    id_regla = rule$id,
    estado_dinamico = "correcta",
    n_filas = 12L,
    n_inconsistencias = 2L,
    stringsAsFactors = FALSE
  ))

  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule), evaluation = evaluation)
  )

  expect_true(model$evaluation_available)
  expect_equal(model$summary$evaluated, 1L)
  expect_equal(model$summary$reviewed_total, 12)
  expect_equal(model$summary$findings_total, 2)
})

test_that("filtro de Carga conserva formula R exacta y literales escapados", {
  variable <- "tipo'real\\campo"
  universe <- list(
    applied = TRUE,
    variable = variable,
    real_values = c("real", "real'2", "real\\3"),
    test_values = c("test", "test'2"),
    missing_policy = "exclude",
    unassigned_policy = "unclassified",
    total = 4L,
    included = 1L,
    excluded_test = 1L,
    excluded_unclassified = 2L
  )
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("nombre", nombre = "Nombre obligatorio"))),
    upstream_universe = universe
  )
  formula <- as.character(model$upstream_universe$formula_r %||% "")

  expect_true(nzchar(formula))
  expect_error(parse(text = formula), NA)
  for (token in c(".filter_values", ".filter_missing", ".filter_keep", ".filter_is_test", ".filter_unclassified", "drop = FALSE")) {
    expect_match(formula, token, fixed = TRUE)
  }
  expect_false(grepl("eval\\s*\\(|parse\\s*\\(", formula, perl = TRUE))

  raw <- data.frame(
    value = c("real'2", "test'2", NA, "otro"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  names(raw) <- variable
  formula_env <- list2env(list(data = raw), parent = baseenv())
  eval(parse(text = formula), envir = formula_env)
  expect_equal(nrow(formula_env$base_validacion), 1L)
  expect_identical(as.character(formula_env$base_validacion[[variable]]), "real'2")
  expect_equal(sum(formula_env$.filter_missing), 1L)
  expect_equal(sum(formula_env$.filter_is_test), 1L)
  expect_equal(sum(formula_env$.filter_unclassified), 2L)

  report <- .vmr_test_pdf_text(model)
  expect_match(report$text, "FÓRMULA R USADA PARA FILTRAR", fixed = TRUE)
  expect_match(report$text, deparse(variable, width.cutoff = 500L), fixed = TRUE)
  expect_true(grepl("base_validacion\\s*<-\\s*data\\[\\.filter_keep", report$text, perl = TRUE))

  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  env <- new.env(parent = baseenv())
  sys.source(r_path, envir = env)
  filtered <- env$prepare_validation_universe(raw)
  expect_equal(nrow(filtered), 1L)
  expect_identical(as.character(filtered[[variable]]), "real'2")
})

test_that("filtro aplicado sin valores reales no inventa formula R", {
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("nombre", nombre = "Nombre obligatorio"))),
    upstream_universe = list(
      applied = TRUE,
      variable = "tipo",
      real_values = character(0),
      test_values = "test",
      total = 4L,
      included = 0L,
      excluded_test = 1L,
      excluded_unclassified = 3L
    )
  )

  expect_false(nzchar(as.character(model$upstream_universe$formula_r %||% "")))
})

test_that("preparacion del universo corrige antes de excluir y documenta los conteos", {
  universe <- list(
    applied = TRUE,
    variable = "testreal",
    real_values = "real",
    test_values = "test",
    corrections = list(list(
      key_variable = "Pulso_code",
      key_values = c("PDM1114", "PDM1153"),
      variable = "testreal",
      from_values = "test",
      to_value = "real",
      reason = "Entrevistas reales registradas inicialmente como prueba"
    )),
    exclusion_rules = list(list(
      variable = "Consent",
      values = "No",
      reason = "Rechazo de consentimiento"
    )),
    total = 430L,
    corrected = 2L,
    excluded_test = 1L,
    excluded_rules = 3L,
    included = 426L
  )
  evaluation <- list(resumen_tabla = data.frame(
    id_regla = rule_required("Pulso_code")$id,
    estado = "correcta",
    n_evaluados = 426L,
    n_inconsistencias = 0L,
    stringsAsFactors = FALSE
  ))
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("Pulso_code")), evaluation = evaluation),
    upstream_universe = universe
  )
  formula <- as.character(model$upstream_universe$formula_r %||% "")

  expect_error(parse(text = formula), NA)
  expect_lt(regexpr("\\.correction_match_1", formula)[[1L]], regexpr("\\.filter_variable", formula)[[1L]])
  expect_lt(regexpr("\\.filter_variable", formula)[[1L]], regexpr("\\.exclusion_match_1", formula)[[1L]])
  raw <- data.frame(
    Pulso_code = c("PDM1114", "PDM1153", "123456", "PDM1429", "PDM2000"),
    testreal = c("test", "test", "test", "real", "real"),
    Consent = c("Yes", "Yes", "Yes", "No", "Yes"),
    stringsAsFactors = FALSE
  )
  env <- list2env(list(data = raw), parent = baseenv())
  eval(parse(text = formula), envir = env)
  expect_equal(env$base_validacion$Pulso_code, c("PDM1114", "PDM1153", "PDM2000"))
  expect_equal(env$base_validacion$testreal, rep("real", 3L))

  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  script <- paste(readLines(r_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(script, "# Encuestas reclasificadas de prueba a real: 2", fixed = TRUE)
  expect_match(script, "# Pruebas retiradas: 1", fixed = TRUE)
  expect_match(script, "# Rechazos retirados: 3", fixed = TRUE)
  expect_match(script, "# Encuestas incluidas: 426", fixed = TRUE)
  expect_lt(regexpr(".correction_match_1", script, fixed = TRUE)[[1L]],
            regexpr(".exclusion_match_1", script, fixed = TRUE)[[1L]])
  script_env <- new.env(parent = baseenv())
  sys.source(r_path, envir = script_env)
  expect_equal(script_env$prepare_validation_universe(raw)$Pulso_code,
               c("PDM1114", "PDM1153", "PDM2000"))

  report <- .vmr_test_pdf_text(model)
  expect_match(report$text, "2", fixed = TRUE)
  expect_match(report$text, "reclasificadas", ignore.case = TRUE)
  expect_match(report$text, "1 prueba retirada", ignore.case = TRUE)
  expect_match(report$text, "3 rechazos retirados", ignore.case = TRUE)
  expect_match(report$text, "426", fixed = TRUE)
})

test_that("PDF y script R documentan fechas manuales y similitud de respuestas", {
  vars <- paste0("q", seq_len(10L))
  config <- normalize_validation_operational_config(list(
    version = 2L,
    field_period = list(
      enabled = TRUE,
      variable = "end",
      start_date = "2026-06-30",
      end_date = "2026-07-06",
      timezone = "America/Lima"
    ),
    duplicates = list(
      enabled = TRUE,
      variables = as.list(vars),
      matching_method = "response_similarity",
      similarity_threshold = 0.90,
      minimum_coverage = 0.80
    )
  ))
  rules <- validation_operational_rules(config)
  scope <- .vmr_test_scope(rules)
  scope$operational_config <- config
  model <- build_validation_methodology_report_model(scope)
  report <- .vmr_test_pdf_text(model)

  expect_match(report$text, "30 jun. 2026", fixed = TRUE)
  expect_match(report$text, "6 jul. 2026", fixed = TRUE)
  expect_match(report$text, "90%", fixed = TRUE)
  expect_match(report$text, "respuestas similares", ignore.case = TRUE)
  expect_true(grepl("respuestas comparables\\s+en al menos 80%", report$text, ignore.case = TRUE, perl = TRUE))
  expect_false(grepl("Clave compuesta", report$text, fixed = TRUE))

  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  env <- new.env(parent = baseenv())
  sys.source(r_path, envir = env)
  data <- as.data.frame(matrix("A", nrow = 3L, ncol = 10L), stringsAsFactors = FALSE)
  names(data) <- vars
  data$end <- rep("2026-07-01", 3L)
  data$q10[[2L]] <- "B"
  data$q9[[3L]] <- "C"
  data$q10[[3L]] <- "C"
  summary <- .vmr_test_result_table(env$validate_data(data))
  findings_col <- .vmr_test_col(summary, c("casos_encontrados", "casos_senalados", "findings"))
  expect_equal(as.numeric(summary[[findings_col]]), c(0, 2))
})

test_that("PDF coloca formula R junto al control ejecutable", {
  rule <- rule_required("nombre", nombre = "Nombre obligatorio")
  report <- .vmr_test_pdf_text(build_validation_methodology_report_model(.vmr_test_scope(list(rule))))
  page <- .vmr_test_rule_page(report$text, rule$nombre)

  expect_match(page, "Fórmula R", fixed = TRUE)
  expect_match(page, "is.na", fixed = TRUE)
  expect_match(page, "nombre", fixed = TRUE)
})

test_that("PDF identifica ODK como fuente y nunca como formula R", {
  rule <- rule_odk_raw(
    "pulldata('catalogo', 'valor', 'id', ${id})",
    variables = "id",
    nombre = "Consulta externa",
    origin = "pulldata"
  )
  report <- .vmr_test_pdf_text(build_validation_methodology_report_model(.vmr_test_scope(list(rule))))
  page <- .vmr_test_rule_page(report$text, rule$nombre)

  expect_true(grepl("Expresión (?:ODK|del formulario)", page, ignore.case = TRUE, perl = TRUE))
  expect_false(grepl("Fórmula R", page, fixed = TRUE))
})

test_that("sin evaluacion el modelo y el PDF no comunican cero hallazgos", {
  rules <- list(rule_required("nombre", nombre = "Nombre obligatorio"))
  model <- build_validation_methodology_report_model(.vmr_test_scope(rules, evaluation = NULL))

  expect_false(model$evaluation_available)
  expect_true(is.null(model$summary$with_findings) || is.na(model$summary$with_findings))
  for (field in c("findings_total", "reviewed_total", "findings_rate")) {
    expect_true(is.null(model$summary[[field]]) || is.na(model$summary[[field]]))
  }

  if (nzchar(Sys.which("pdftotext"))) {
    pdf_path <- tempfile(fileext = ".pdf")
    text_path <- tempfile(fileext = ".txt")
    validation_methodology_report_pdf(model, pdf_path)
    status <- system2("pdftotext", c("-layout", pdf_path, text_path))
    expect_identical(status, 0L)
    report_text <- paste(readLines(text_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
    expect_false(grepl("(?:^|\\s)0\\s+(?:reglas?\\s+)?con hallazgos|cero hallazgos|sin hallazgos", report_text, ignore.case = TRUE, perl = TRUE))
  }
})

test_that("reporte metodologico cruza resultados por id y renderiza PDF", {
  plan <- data.frame(
    id_regla = c("R1", "R2"),
    tipo_regla = c("required", "duplicate"),
    variable = c("edad", "id_hogar"),
    objetivo = c("Edad informada", "Llave unica"),
    Procesamiento = c("!is.na(data$edad)", "!duplicated(data$id_hogar)"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  evaluation <- list(resumen_tabla = data.frame(
    id_regla = c("R1", "R2"), n_evaluados = c(427L, 427L),
    n_violaciones = c(0L, 2L), stringsAsFactors = FALSE
  ))
  model <- build_validation_methodology_report_model(
    list(plan_result = list(plan = plan), evaluacion = evaluation),
    base_nombre = "acnur"
  )
  expect_equal(model$summary$evaluated, 2L)
  expect_equal(model$summary$with_findings, 1L)
  path <- tempfile(fileext = ".pdf")
  validation_methodology_report_pdf(model, path)
  expect_true(file.exists(path))
  expect_gt(file.info(path)$size, 1000)
  expect_identical(readBin(path, "raw", 4), charToRaw("%PDF"))
})

test_that("embudo territorial: modelo, franja, formula y prepare_validation_universe", {
  universe <- list(
    applied = TRUE, territorial = TRUE,
    total = 1732L, included = 1283L,
    source_label = "sincronizados desde Kobo",
    total_label = "Registros sincronizados",
    included_label = "Base valida final",
    stage_variable = "etapa_exclusion", keep_value = "incluido",
    duplicates_count = 0L,
    field_window_label = "mayo a 3 de julio de 2026",
    stages = list(
      list(id = "piloto", label = "Registros de piloto y previos",
           short_label = "Piloto y previos",
           excluded = 39L, remaining = 1693L, match_values = "excluido_piloto"),
      list(id = "control_calidad", label = "Registros retirados en control de calidad de campo",
           short_label = "Control de calidad",
           excluded = 342L, remaining = 1351L, match_values = "excluido_anulado"),
      list(id = "no_defendible", label = "Registros no defendibles",
           short_label = "No defendibles",
           excluded = 68L, remaining = 1283L, match_values = "excluido_no_defendible",
           subcriteria = c("consentimiento no valido", "fuera del marco geografico"))
    ),
    included_breakdown = list(
      list(label = "Validadas", count = 1028L),
      list(label = "En revision defendible", count = 255L)
    )
  )
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("nombre", nombre = "Nombre obligatorio"))),
    upstream_universe = universe
  )
  u <- model$upstream_universe
  expect_true(isTRUE(u$territorial))
  expect_identical(u$total, 1732L)
  expect_identical(u$included, 1283L)
  expect_identical(u$funnel_values, c(1732L, 39L, 342L, 68L, 1283L))
  expect_identical(u$funnel_labels[[1L]], "Registros sincronizados")
  expect_identical(u$funnel_labels[[5L]], "Base valida final")
  expect_true(u$formula_available)

  # Idempotencia: re-normalizar el modelo no rompe conteos.
  again <- .vmr_universe_model(u)
  expect_identical(again$funnel_values, u$funnel_values)

  # prepare_validation_universe reproduce el embudo sobre etapa_exclusion.
  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  env <- new.env(parent = baseenv())
  sys.source(r_path, envir = env)
  raw <- data.frame(
    etapa_exclusion = c(rep("incluido", 5L), rep("excluido_piloto", 2L),
                        rep("excluido_anulado", 3L), "excluido_no_defendible"),
    stringsAsFactors = FALSE
  )
  filtered <- env$prepare_validation_universe(raw)
  expect_equal(nrow(filtered), 5L)
  expect_true(all(filtered$etapa_exclusion == "incluido"))

  script <- paste(readLines(r_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(script, "Base final de casos validos: 1,283", fixed = TRUE)
  expect_match(script, "excluido_no_defendible", fixed = TRUE)

  report <- .vmr_test_pdf_text(model)
  expect_match(report$text, "Base valida final", fixed = TRUE)
  expect_match(report$text, "No defendibles", fixed = TRUE)
  expect_match(report$text, "1,732", fixed = TRUE)
  expect_match(report$text, "1,283", fixed = TRUE)
  expect_false(grepl("Reclasificadas", report$text, fixed = TRUE))
})

test_that("universo por defecto no activa la rama territorial", {
  universe <- list(
    applied = TRUE, variable = "tipo", real_values = "real", test_values = "test",
    total = 10L, included = 8L, excluded_test = 2L
  )
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("nombre", nombre = "Nombre obligatorio"))),
    upstream_universe = universe
  )
  expect_null(model$upstream_universe$territorial)
  expect_null(model$upstream_universe$funnel_values)
})

test_that("embudo territorial: reconciliación 93->80 cuando el plan supera lo presentado", {
  universe <- list(
    applied = TRUE, territorial = TRUE, total = 100L, included = 80L,
    stage_variable = "etapa", keep_value = "incluido",
    stages = list(list(id = "x", label = "Excluidos", short_label = "Excluidos",
                       excluded = 20L, remaining = 80L, match_values = "fuera"))
  )
  evaluation <- list(resumen_tabla = data.frame(
    id_regla = c(rule_required("a")$id, rule_required("b")$id),
    estado = c("correcta", "no_aplicable"),
    n_evaluados = c(80L, NA_integer_), n_inconsistencias = c(0L, NA_integer_),
    stringsAsFactors = FALSE
  ))
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(
      list(rule_required("a", nombre = "Regla A"), rule_required("b", nombre = "Regla B")),
      evaluation = evaluation
    ),
    upstream_universe = universe
  )
  expect_equal(length(model$rules), 2L)

  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  script <- paste(readLines(r_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(script, "El plan derivó 2 reglas del instrumento; 1 aplican", fixed = TRUE)

  report <- .vmr_test_pdf_text(model)
  expect_match(report$text, "El plan derivó", fixed = TRUE)
  expect_match(report$text, "no se materializan", fixed = TRUE)
})

test_that("script R territorial emite un bloque main ACTIVO y autonomo sin ejecutar al hacer source", {
  universe <- list(
    applied = TRUE, territorial = TRUE, total = 100L, included = 80L,
    stage_variable = "etapa", keep_value = "incluido",
    audit_base_file = "estados_prueba.csv",
    analysis_base_file = "final_prueba.csv",
    key_column = "response_id",
    stages = list(list(id = "x", label = "Excluidos", short_label = "Excluidos",
                       excluded = 20L, remaining = 80L, match_values = "fuera"))
  )
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("nombre", nombre = "Nombre obligatorio"))),
    upstream_universe = universe
  )
  dir <- tempfile("vmr-terr-")
  dir.create(dir)
  r_path <- file.path(dir, "reporte.R")
  validation_methodology_report_r(model, r_path)
  script <- paste(readLines(r_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")

  # Main activo (no comentado) protegido por el guard de ejecucion directa.
  expect_match(script, "if (sys.nframe() == 0L) {", fixed = TRUE)
  expect_match(script, "prepare_validation_universe(.base_estados)", fixed = TRUE)
  expect_match(script, "validate_data(.base_final", fixed = TRUE)
  # Reparte de los nombres de insumo declarados en el universo.
  expect_match(script, "estados_prueba.csv", fixed = TRUE)
  expect_match(script, "final_prueba.csv", fixed = TRUE)
  # Cuadre por identidad usando la llave declarada.
  expect_match(script, "response_id", fixed = TRUE)
  expect_match(script, "Cuadre por identidad OK", fixed = TRUE)
  # La receta comentada de una sola base NO debe aparecer en la rama territorial.
  expect_false(grepl("# base_recibida <- read_validation_data", script, fixed = TRUE))

  # Al hacer source (no ejecucion directa) no corre trabajo ni escribe archivos.
  before <- sort(list.files(dir, all.files = TRUE, no.. = TRUE))
  env <- new.env(parent = baseenv())
  expect_error(sys.source(r_path, envir = env), NA)
  after <- sort(list.files(dir, all.files = TRUE, no.. = TRUE))
  expect_equal(after, before)
  expect_true(exists("prepare_validation_universe", envir = env, mode = "function", inherits = FALSE))
})

test_that("script R considera presentes las variables select_multiple por sus columnas dummy", {
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("nombre", nombre = "Nombre obligatorio")))
  )
  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  env <- new.env(parent = baseenv())
  sys.source(r_path, envir = env)

  present <- get(".plan_var_present", envir = env)
  # Columna literal presente.
  expect_true(present("edad", c("edad", "id")))
  # Ausente por completo.
  expect_false(present("D1_information", c("id", "edad")))
  # Presente por dummies de select_multiple, aunque falte la columna resumen.
  expect_true(present("D1_information", c("id", "D1_information/96", "D1_information/98")))
  expect_true(present("D1_information", c("id", "D1_information_96")))
})

# --- Ficha de conteos con base depurada (ADR 0076) --------------------------
#
# Un estudio que no separa encuestas de prueba salía con la sección entera
# vacía: la ficha dependía del filtro de universo y las exclusiones decididas
# en Limpieza no llegaban al informe. Lo que sí llega es el AGREGADO —cuántas
# se recibieron, cuántas se retiraron, cuántas quedaron—, nunca el caso ni el
# motivo, que son material de trabajo interno.

.vmr_cleaning_universe <- function(total = 103L, incluidas = 101L) {
  list(
    applied = FALSE,
    cleaning_applied = TRUE,
    total = total,
    included = incluidas,
    excluded_cleaning = total - incluidas,
    excluded_test = 0L,
    corrected = 0L,
    correction_changes = 0L,
    excluded_rules = 0L
  )
}

test_that("sin filtro de pruebas, la depuración declara los conteos de la ficha", {
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("Pulso_code"))),
    upstream_universe = .vmr_cleaning_universe()
  )
  u <- model$upstream_universe
  expect_false(isTRUE(u$applied))
  expect_true(isTRUE(u$cleaning_applied))
  expect_identical(u$total, 103L)
  expect_identical(u$included, 101L)
  expect_identical(u$excluded_cleaning, 2L)

  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  script <- paste(readLines(r_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(script, "# Encuestas recibidas: 103", fixed = TRUE)
  expect_match(script, "# Otras exclusiones: 2", fixed = TRUE)
  expect_match(script, "# Encuestas incluidas: 101", fixed = TRUE)
  # Sin filtro de pruebas no se escriben sus líneas en cero.
  expect_false(grepl("# Pruebas retiradas", script, fixed = TRUE))
  expect_false(grepl("# Encuestas reclasificadas", script, fixed = TRUE))
  expect_match(script, "El universo del estudio es la base recibida completa.", fixed = TRUE)
  # El agregado no arrastra el detalle del caso.
  expect_match(script, "limpieza y validación de la base", fixed = TRUE)
})

test_that("el PDF con base depurada trae los tres números de la ficha", {
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("Pulso_code"))),
    upstream_universe = .vmr_cleaning_universe()
  )
  pdf_path <- tempfile(fileext = ".pdf")
  expect_error(validation_methodology_report_pdf(model, pdf_path), NA)
  expect_true(file.exists(pdf_path) && file.size(pdf_path) > 0)

  if (!nzchar(Sys.which("pdftotext"))) skip("pdftotext no está disponible")
  text_path <- tempfile(fileext = ".txt")
  status <- system2("pdftotext", c("-layout", pdf_path, text_path))
  expect_equal(status, 0L)
  text <- paste(readLines(text_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(text, "ENCUESTAS INCLUIDAS", fixed = TRUE)
  expect_match(text, "103", fixed = TRUE)
  expect_match(text, "101", fixed = TRUE)
  expect_match(text, "Otras exclusiones", fixed = TRUE)
  # La portada ya no declara un guion donde va el N del estudio.
  expect_false(grepl("ENCUESTAS INCLUIDAS\\s*\\n\\s*-\\s*\\n", text))
})

test_that("con filtro y depuración el embudo cierra y no pierde las exclusiones", {
  universe <- list(
    applied = TRUE,
    variable = "testreal",
    real_values = "real",
    test_values = "test",
    total = 430L,
    corrected = 0L,
    excluded_test = 4L,
    excluded_rules = 0L,
    included = 424L,
    cleaning_applied = TRUE,
    excluded_cleaning = 2L
  )
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("Pulso_code"))),
    upstream_universe = universe
  )
  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  script <- paste(readLines(r_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(script, "# Encuestas recibidas: 430", fixed = TRUE)
  expect_match(script, "# Pruebas retiradas: 4", fixed = TRUE)
  expect_match(script, "# Otras exclusiones: 2", fixed = TRUE)
  expect_match(script, "# Encuestas incluidas: 424", fixed = TRUE)
})

test_that("sin depuración ni filtro la sección sigue declarando que no hay filtro", {
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("Pulso_code")))
  )
  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  script <- paste(readLines(r_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(script, "# El universo del estudio es la base recibida completa.", fixed = TRUE)
  expect_false(grepl("# Encuestas recibidas:", script, fixed = TRUE))
})

# --- El universo por identificador (depuración sin filtro de pruebas) --------
#
# Cuando la merma vino de Limpieza no hay condición sobre una variable que la
# exprese. El script declaraba "Encuestas incluidas: 101" y su
# `prepare_validation_universe()` devolvía la base sin tocar: un paquete que
# afirma un número que su propio código no reproduce.

test_that("sin identificadores la función sigue siendo un aviso, no un filtro", {
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("Pulso_code"))),
    upstream_universe = .vmr_cleaning_universe()
  )
  expect_identical(model$upstream_universe$formula_kind, "condicion")
  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  script <- paste(readLines(r_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(script, "El universo del estudio es la base recibida completa.", fixed = TRUE)
})

test_that("con identificadores el script reproduce el universo de verdad", {
  universo <- utils::modifyList(.vmr_cleaning_universe(total = 5L, incluidas = 3L), list(
    final_case_variable = "_uuid",
    final_case_ids = list("A1", "A3", "A5")
  ))
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("Pulso_code"))),
    upstream_universe = universo
  )
  expect_identical(model$upstream_universe$formula_kind, "identificadores")

  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  env <- new.env(parent = globalenv())
  sys.source(r_path, envir = env)

  crudo <- data.frame(`_uuid` = c("A1", "A2", "A3", "A4", "A5"),
                      edad = c(30, 41, 22, 55, 19),
                      check.names = FALSE, stringsAsFactors = FALSE)
  out <- env$prepare_validation_universe(crudo)
  expect_equal(nrow(out), 3L)
  expect_equal(as.character(out$`_uuid`), c("A1", "A3", "A5"))
  # El control: sin el arreglo esto devolvía las 5 filas intactas.
  expect_false(identical(nrow(out), nrow(crudo)))

  # Lo que se lista es lo que PERMANECE; los excluidos no aparecen.
  script <- paste(readLines(r_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_false(grepl("\"A2\"", script, fixed = TRUE))
  expect_false(grepl("\"A4\"", script, fixed = TRUE))
})

test_that("el script falla fuerte si la base recibida no trae el universo", {
  universo <- utils::modifyList(.vmr_cleaning_universe(total = 5L, incluidas = 3L), list(
    final_case_variable = "_uuid", final_case_ids = list("A1", "A3", "A5")
  ))
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("Pulso_code"))), upstream_universe = universo)
  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  env <- new.env(parent = globalenv()); sys.source(r_path, envir = env)

  # Un crudo incompleto no puede devolver un universo a medias en silencio.
  incompleto <- data.frame(`_uuid` = c("A1", "A3"), check.names = FALSE, stringsAsFactors = FALSE)
  expect_error(env$prepare_validation_universe(incompleto), "universo final")
  # Y sin la variable de identificador tampoco.
  sin_llave <- data.frame(edad = c(1, 2, 3))
  expect_error(env$prepare_validation_universe(sin_llave), "identificador de caso")
})

test_that("el PDF no imprime los identificadores: declara dónde están", {
  universo <- utils::modifyList(.vmr_cleaning_universe(), list(
    final_case_variable = "_uuid",
    final_case_ids = as.list(sprintf("caso-%03d", seq_len(101)))
  ))
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("Pulso_code"))), upstream_universe = universo)
  pdf_path <- tempfile(fileext = ".pdf")
  expect_error(validation_methodology_report_pdf(model, pdf_path), NA)

  if (!nzchar(Sys.which("pdftotext"))) skip("pdftotext no está disponible")
  txt <- tempfile(fileext = ".txt")
  expect_equal(system2("pdftotext", c("-layout", pdf_path, txt)), 0L)
  # El wrapping del PDF parte las frases: se normalizan los espacios antes de
  # buscar, o el aserto falla por un salto de línea y no por el contenido.
  texto <- gsub("\\s+", " ", paste(readLines(txt, warn = FALSE, encoding = "UTF-8"), collapse = " "))
  expect_match(texto, "identificadores incluidos viajan en el script R", fixed = TRUE)
  # Cientos de UUID desbordarían la caja; no se imprime ninguno.
  expect_false(grepl("caso-001", texto, fixed = TRUE))
  expect_false(grepl("FÓRMULA R USADA PARA FILTRAR", texto, fixed = TRUE))
})


test_that("el informe declara en el PDF lo que el plan no cubre (vara V4)", {
  # Una regla sobre `pulldata` se descarta a propósito, pero un informe que
  # sustenta la entrega no puede callarlo: quien lo lea creería que el plan
  # cubre todas las preguntas del formulario.
  rules <- list(rule_range("edad", min = 0, max = 120, type = "numeric", nombre = "Edad válida"))
  scope <- .vmr_test_scope(rules)
  scope$plan_result$bundle$discarded <- list(
    list(row_name = "nombre_padron", field = "relevant", origin = "pulldata",
         expression = "pulldata('padron','activo','id',${id}) = '1'")
  )
  model <- build_validation_methodology_report_model(
    scope, base_nombre = "base", estudio_nombre = "Prueba V4"
  )

  expect_equal(model$summary$descartadas, 1L)
  expect_true(grepl("pulldata", model$cobertura_no_cubierta, fixed = TRUE))
  expect_true(grepl("«nombre_padron»", model$cobertura_no_cubierta, fixed = TRUE))

  pdf_path <- tempfile(fileext = ".pdf")
  validation_methodology_report_pdf(model, pdf_path)
  expect_true(file.exists(pdf_path))
  if (nzchar(Sys.which("pdftotext"))) {
    text_path <- tempfile(fileext = ".txt")
    expect_identical(system2("pdftotext", c("-layout", pdf_path, text_path)), 0L)
    report_text <- paste(readLines(text_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
    expect_match(report_text, "LO QUE ESTE PLAN NO CUBRE", fixed = TRUE)
    expect_match(report_text, "nombre_padron", fixed = TRUE)
  }
})

test_that("sin nada descartado el informe no inventa la sección", {
  # El control del test anterior: si la caja se dibujara siempre, el aserto de
  # arriba pasaría sin que el dato la haya provocado.
  rules <- list(rule_range("edad", min = 0, max = 120, type = "numeric", nombre = "Edad válida"))
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(rules), base_nombre = "base", estudio_nombre = "Prueba V4"
  )
  expect_equal(model$summary$descartadas, 0L)
  expect_equal(model$cobertura_no_cubierta, "")

  pdf_path <- tempfile(fileext = ".pdf")
  validation_methodology_report_pdf(model, pdf_path)
  if (nzchar(Sys.which("pdftotext"))) {
    text_path <- tempfile(fileext = ".txt")
    expect_identical(system2("pdftotext", c("-layout", pdf_path, text_path)), 0L)
    report_text <- paste(readLines(text_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
    expect_false(grepl("LO QUE ESTE PLAN NO CUBRE", report_text, fixed = TRUE))
  }
})

test_that("con filtro de pruebas Y depuración, la función emite las dos etapas", {
  # El caso que se crea al hacer el filtrado de pruebas dentro de la app: el
  # universo tiene dos etapas. Emitir sólo la condición dejaba la función
  # devolviendo el universo previo a la depuración mientras los comentarios
  # declaraban el conteo final.
  universo <- list(
    applied = TRUE, variable = "testreal", real_values = "real", test_values = "test",
    corrections = list(list(key_variable = "Pulso_code", key_values = "H1004",
                            variable = "testreal", from_values = "real",
                            to_value = "test", reason = "Prueba marcada como real")),
    total = 12L, corrected = 1L, excluded_test = 4L, excluded_rules = 0L, included = 6L,
    cleaning_applied = TRUE, excluded_cleaning = 2L,
    final_case_variable = "_uuid", final_case_ids = as.list(sprintf("u%02d", 5:10))
  )
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("Pulso_code"))), upstream_universe = universo)
  expect_identical(model$upstream_universe$formula_kind, "condicion_e_identificadores")

  r_path <- tempfile(fileext = ".R")
  validation_methodology_report_r(model, r_path)
  env <- new.env(parent = globalenv()); sys.source(r_path, envir = env)

  crudo <- data.frame(
    `_uuid` = sprintf("u%02d", 1:12),
    Pulso_code = sprintf("H10%02d", 1:12),
    testreal = c(rep("test", 3), rep("real", 9)),
    check.names = FALSE, stringsAsFactors = FALSE)
  out <- env$prepare_validation_universe(crudo)

  expect_equal(nrow(out), 6L)
  expect_equal(sort(as.character(out$`_uuid`)), sprintf("u%02d", 5:10))
  # El control: con sólo la condición habrían quedado 8 —las que pasan el
  # filtro de pruebas— y el script habría declarado 6.
  expect_false(identical(nrow(out), 8L))

  script <- paste(readLines(r_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  # La reclasificación se documenta: es la corrección del error del analista.
  expect_match(script, "Prueba marcada como real", fixed = TRUE)
  expect_match(script, "# Encuestas recibidas: 12", fixed = TRUE)
  expect_match(script, "# Pruebas retiradas: 4", fixed = TRUE)
  # Y los depurados siguen sin aparecer.
  expect_false(grepl('"u11"', script, fixed = TRUE))
  expect_false(grepl('"u12"', script, fixed = TRUE))
})

test_that("el PDF imprime la condición pero nunca la lista de identificadores", {
  universo <- list(
    applied = TRUE, variable = "testreal", real_values = "real", test_values = "test",
    total = 120L, corrected = 0L, excluded_test = 17L, excluded_rules = 0L, included = 101L,
    cleaning_applied = TRUE, excluded_cleaning = 2L,
    final_case_variable = "_uuid",
    final_case_ids = as.list(sprintf("caso-%03d", seq_len(101)))
  )
  model <- build_validation_methodology_report_model(
    .vmr_test_scope(list(rule_required("Pulso_code"))), upstream_universe = universo)
  pdf_path <- tempfile(fileext = ".pdf")
  expect_error(validation_methodology_report_pdf(model, pdf_path), NA)

  if (!nzchar(Sys.which("pdftotext"))) skip("pdftotext no está disponible")
  txt <- tempfile(fileext = ".txt")
  expect_equal(system2("pdftotext", c("-layout", pdf_path, txt)), 0L)
  # El wrapping del PDF parte las frases: se normalizan los espacios antes de
  # buscar, o el aserto falla por un salto de línea y no por el contenido.
  texto <- gsub("\\s+", " ", paste(readLines(txt, warn = FALSE, encoding = "UTF-8"), collapse = " "))
  expect_match(texto, ".filter_real_values", fixed = TRUE)
  expect_match(texto, "identificadores incluidos viajan en el script R", fixed = TRUE)
  expect_false(grepl("caso-001", texto, fixed = TRUE))
})
