# Smoke tests para los helpers de Bases (Analítica · Fase 4).
#
# Cubre las transformaciones críticas SIN levantar plumber: llamamos
# directo a las funciones privadas de `prosecnurapp`. El objetivo es
# cazar regresiones en:
#   - inferencia de measure (ordinal vs nominal vs scale)
#   - inferencia de format.spss
#   - expansión de select_multiple a columnas 0/1
#   - aplicación de etiquetas (códigos → labels) en select_one y multi
#   - escritura de .sav + lectura para verificar atributos embebidos
#   - escritura de XLSX en modo "ambos" → 2 hojas
#
# Ejecutar:
#   cd prosecnur-app
#   Rscript -e 'devtools::load_all("api"); testthat::test_file("api/tests/testthat/test-analitica-bases.R")'

library(testthat)

# Cargar helpers. Soporta dos contextos: dentro de R CMD check (paquete
# instalado) o standalone vía `devtools::load_all` / `source()`.
if (!exists(".bases_sav_prepare", mode = "function")) {
  helpers_path <- file.path("api", "R", "helpers_bases.R")
  if (file.exists(helpers_path)) {
    source(helpers_path)
  } else if (file.exists("R/helpers_bases.R")) {
    source("R/helpers_bases.R")
  }
}

# Proveer %||% si no está disponible
if (!exists("%||%")) {
  `%||%` <- function(x, y) if (is.null(x)) y else x
}

.pyreadstat_metadata <- function(path) {
  py <- .bases_pyreadstat_python()
  if (!nzchar(py)) skip("pyreadstat no disponible en python3")
  script <- tempfile(fileext = ".py")
  out <- tempfile(fileext = ".json")
  on.exit(unlink(c(script, out), force = TRUE), add = TRUE)
  writeLines(c(
    "import json, sys",
    "import pyreadstat",
    "_, meta = pyreadstat.read_sav(sys.argv[1], metadataonly=True)",
    "payload = {",
    "  'variable_measure': meta.variable_measure,",
    "  'original_variable_types': meta.original_variable_types,",
    "  'variable_display_width': meta.variable_display_width,",
    "  'column_names_to_labels': meta.column_names_to_labels,",
    "  'value_label_counts': {k: len(v) for k, v in meta.variable_value_labels.items()},",
    "}",
    "with open(sys.argv[2], 'w', encoding='utf-8') as fh:",
    "  json.dump(payload, fh, ensure_ascii=False)"
  ), script, useBytes = TRUE)
  res <- suppressWarnings(system2(py, c(script, path, out), stdout = TRUE, stderr = TRUE))
  status <- attr(res, "status")
  if (!is.null(status) && status != 0L) {
    fail(paste(res, collapse = "\n"))
  }
  jsonlite::read_json(out, simplifyVector = FALSE)
}

# Helper: construir un rp_inst mínimo con survey + choices + choices_raw
.fixture_inst <- function() {
  survey <- data.frame(
    name = c("sexo", "edad", "nivel_acuerdo", "intereses", "comentario"),
    type = c("select_one sexo_list", "integer",
             "select_one likert_acuerdo", "select_multiple intereses_list",
             "text"),
    label = c("Sexo", "Edad", "Nivel de acuerdo", "Áreas de interés", "Comentario libre"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c(
      "sexo_list", "sexo_list",
      "likert_acuerdo", "likert_acuerdo", "likert_acuerdo", "likert_acuerdo", "likert_acuerdo",
      "intereses_list", "intereses_list", "intereses_list"
    ),
    name = c("1", "2",
             "1", "2", "3", "4", "5",
             "a", "b", "c"),
    label = c("Hombre", "Mujer",
              "Totalmente en desacuerdo", "En desacuerdo", "Neutral", "De acuerdo", "Totalmente de acuerdo",
              "Deportes", "Arte", "Ciencia"),
    stringsAsFactors = FALSE
  )
  list(survey = survey, choices = choices, choices_raw = choices)
}

# Helper: construir un rp_data con attrs tipo reporte_data
.fixture_data <- function() {
  # Columnas con attr(, "labels") y attr(, "label") como las produce
  # prosecnurapp::reporte_data.
  sexo <- c("1", "2", "1", "2", "1")
  attr(sexo, "labels") <- stats::setNames(c("1", "2"), c("Hombre", "Mujer"))
  attr(sexo, "label") <- "Sexo"

  edad <- c(25L, 34L, 42L, 29L, 51L)
  attr(edad, "label") <- "Edad"

  nivel <- c("4", "5", "3", "2", "5")
  attr(nivel, "labels") <- stats::setNames(
    c("1","2","3","4","5"),
    c("Totalmente en desacuerdo","En desacuerdo","Neutral","De acuerdo","Totalmente de acuerdo")
  )
  attr(nivel, "label") <- "Nivel de acuerdo"

  intereses <- c("a b", "b", "a c", "", "a b c")
  attr(intereses, "labels") <- stats::setNames(c("a","b","c"), c("Deportes","Arte","Ciencia"))
  attr(intereses, "label") <- "Áreas de interés"

  comentario <- c("Bien", "Mal", NA_character_, "Regular", "Excelente")
  attr(comentario, "label") <- "Comentario libre"

  data.frame(sexo = I(sexo), edad = edad, nivel_acuerdo = I(nivel),
             intereses = I(intereses), comentario = I(comentario),
             stringsAsFactors = FALSE)
}

# ============================================================================
test_that(".infer_measure clasifica por tipo de XLSForm", {
  survey <- .fixture_inst()$survey
  dummy <- structure(c("1","2"), labels = c("1" = "H", "2" = "M"))

  expect_equal(.infer_measure("edad", 1:10, survey), "scale")
  expect_equal(.infer_measure("comentario", c("a","b"), survey), "nominal")
  expect_equal(.infer_measure("sexo", dummy, survey), "nominal")

  # select_one con labels tipo Likert → ordinal
  likert <- structure(c("1","2","3","4","5"),
                      labels = stats::setNames(
                        c("1","2","3","4","5"),
                        c("Totalmente en desacuerdo","En desacuerdo","Neutral",
                          "De acuerdo","Totalmente de acuerdo")))
  expect_equal(.infer_measure("nivel_acuerdo", likert, survey), "ordinal")

  # Un código especial no sustantivo (75 = Prefiero no responder) no debe
  # impedir que una escala Likert 1..4 sea ordinal.
  likert_con_missing <- structure(
    c("1", "2", "3", "4", "75"),
    labels = stats::setNames(
      c("1", "2", "3", "4", "75"),
      c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo",
        "Totalmente de acuerdo", "Prefiero no responder")
    )
  )
  expect_equal(.infer_measure("nivel_acuerdo", likert_con_missing, survey), "ordinal")
})

test_that(".infer_spss_format infiere anchos y formatos correctos", {
  expect_match(.infer_spss_format(1:10), "^F8\\.")
  expect_match(.infer_spss_format(c(1.5, 2.5)), "^F12\\.2$")
  # Strings → NA (dejamos que haven/readstat auto-infiera el A<w> real).
  expect_true(is.na(.infer_spss_format(c("hola","chao"))))
  expect_equal(.infer_spss_format(as.Date("2024-01-01")), "DATE10")
})

# ============================================================================
test_that(".expand_multiselect crea dummies 0/1 por opción", {
  inst <- .fixture_inst()
  df <- .fixture_data()

  out <- .expand_multiselect(df, inst)

  # Columna original 'intereses' se reemplaza por dummies
  expect_false("intereses" %in% names(out))
  expect_true("intereses___a" %in% names(out))
  expect_true("intereses___b" %in% names(out))
  expect_true("intereses___c" %in% names(out))

  # Fila 1 ("a b"): a=1, b=1, c=0
  expect_equal(as.integer(out$intereses___a[1]), 1L)
  expect_equal(as.integer(out$intereses___b[1]), 1L)
  expect_equal(as.integer(out$intereses___c[1]), 0L)

  # Fila 3 ("a c"): a=1, b=0, c=1
  expect_equal(as.integer(out$intereses___a[3]), 1L)
  expect_equal(as.integer(out$intereses___b[3]), 0L)
  expect_equal(as.integer(out$intereses___c[3]), 1L)

  # Fila 4 (""): todos NA (no respondió)
  expect_true(is.na(out$intereses___a[4]))

  # Columnas NO select_multiple quedan intactas
  expect_true("sexo" %in% names(out))
  expect_true("edad" %in% names(out))

  # Las dummies quedan en la posición de la pregunta madre, no al final.
  expect_equal(
    names(out),
    c(
      "sexo", "edad", "nivel_acuerdo",
      "intereses___a", "intereses___b", "intereses___c",
      "comentario"
    )
  )
})

test_that(".bases_normalize_other_selects separa codigo madre y texto other", {
  inst <- list(
    survey = data.frame(
      name = c("p12", "p12_other", "p27", "p27_other"),
      type = c("select_one", "text", "select_multiple", "text"),
      list_name = c("lst_p12", NA, "lst_p27", NA),
      label = c("Institucion", "Otra institucion", "Beneficios", "Otro beneficio"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p12", "lst_p12", "lst_p12", "lst_p27", "lst_p27", "lst_p27"),
      name = c("1", "4", "14", "1", "2", "99"),
      label = c(
        "PUCP", "Universidad de Lima (UL)", "Otra institucion:",
        "Mentoria", "Financiamiento", "Otro, especificar"
      ),
      stringsAsFactors = FALSE
    )
  )
  df <- data.frame(
    p12 = c("1", "convenio externo", "", "Otra institucion:", "Universidad de Lima (UL)"),
    p12_other = c("", "convenio externo", "sin valor madre", "texto abierto", ""),
    p27 = c("1 2", "texto libre", "1 texto libre", "", "2"),
    p27_other = c("", "texto libre", "texto libre", "solo otro", ""),
    stringsAsFactors = FALSE
  )
  attr(df$p12, "label") <- "Institucion"

  out <- .bases_normalize_other_selects(df, inst)

  expect_equal(as.character(out$p12), c("1", "14", "14", "14", "4"))
  expect_equal(out$p12_other, df$p12_other)
  expect_equal(as.character(out$p27), c("1 2", "99", "1 99", "99", "2"))
  expect_equal(attr(out$p12, "label", exact = TRUE), "Institucion")
})

test_that("export unificado ordena variantes y dummies por pregunta", {
  skip_if_not(exists(".analitica_unified_order_cols", mode = "function"))

  cols <- c(
    "base_hermana", "registro_origen_id", "registro_unificado_id",
    "p1", "p8", "p7___2", "p7___1", "p14_1", "p13_1",
    "p27___9", "p13_5", "p27___3", "p14_5", "p19_other", "p19___1"
  )

  expect_equal(
    .analitica_unified_order_cols(
      cols,
      c("base_hermana", "registro_origen_id", "registro_unificado_id")
    ),
    c(
      "base_hermana", "registro_origen_id", "registro_unificado_id",
      "p1", "p7___1", "p7___2", "p8", "p13_1", "p13_5",
      "p14_1", "p14_5", "p19___1", "p19_other", "p27___3", "p27___9"
    )
  )
  expect_equal(
    .analitica_unified_order_cols(
      c(cols, "id_enlace_sm"),
      c("base_hermana", "registro_origen_id", "registro_unificado_id", "id_enlace_sm")
    )[1:4],
    c("base_hermana", "registro_origen_id", "registro_unificado_id", "id_enlace_sm")
  )
})

test_that("export unificado crea id_enlace_sm sin mezclarlo con Codigo Pulso", {
  skip_if_not(exists(".analitica_unified_link_id_values", mode = "function"))

  telefono <- data.frame(
    response_id = "r1",
    case_uid = "survey-a:r1",
    cv_id = "1003",
    p36 = "P316",
    stringsAsFactors = FALSE
  )
  tel_id <- .analitica_unified_link_id_values(telefono)
  expect_equal(as.character(tel_id), "1003")
  expect_equal(telefono$p36, "P316")
  expect_equal(attr(tel_id, "label", exact = TRUE), "ID enlace SurveyMonkey")

  correo <- data.frame(
    response_id = "r2",
    custom_value = "texto_no_numerico",
    p36 = "P940",
    stringsAsFactors = FALSE
  )
  mail_id <- .analitica_unified_link_id_values(correo)
  expect_equal(as.character(mail_id), "")
  expect_equal(correo$p36, "P940")
})

test_that("export unificado recupera id_enlace_sm desde snapshot por case_uid", {
  skip_if_not(exists(".analitica_unified_link_id_values", mode = "function"))
  skip_if_not(exists(".analitica_unified_link_id_lookup_from_snapshot", mode = "function"))

  snapshot <- list(
    sources = list(
      list(
        survey_id = "survey-a",
        responses = list(
          list(id = "r1", custom_variables = list(ID = "1003")),
          list(id = "r2", custom_value = "texto_no_numerico")
        )
      )
    )
  )
  lookup <- .analitica_unified_link_id_lookup_from_snapshot(snapshot)
  df <- data.frame(
    case_uid = c("survey-a:r1", "survey-a:r2"),
    response_id = c("r1", "r2"),
    p36 = c("P316", "P940"),
    stringsAsFactors = FALSE
  )
  out <- .analitica_unified_link_id_values(df, lookup = lookup)

  expect_equal(as.character(out), c("1003", ""))
  expect_equal(df$p36, c("P316", "P940"))
  expect_false("id" %in% names(df))
})

test_that("export efectivo ignora filtros operativos y conserva marcas de observacion", {
  skip_if_not(exists(".analitica_unified_effective_export_policy", mode = "function"))
  skip_if_not(exists(".analitica_unified_apply_observation_metadata", mode = "function"))

  policy <- .analitica_unified_effective_export_policy(list(
    collector_ids = list("collector-esperado"),
    include_partials = TRUE,
    include_rejections = TRUE
  ))
  expect_identical(.as_chr_vec(policy$collector_ids), character(0))
  expect_false(isTRUE(policy$include_partials))
  expect_false(isTRUE(policy$include_rejections))

  df <- data.frame(
    survey_id = c("survey-a", "survey-a"),
    collector_id = c("collector-esperado", "collector-fuera"),
    date_modified = c("2026-05-27T10:00:00+00:00", "2026-05-29T10:00:00+00:00"),
    id_enlace_sm = c("1001", "1002"),
    p36 = c("P001", "P002"),
    stringsAsFactors = FALSE
  )
  base_meta <- list(
    response_filter = list(
      survey_id = "survey-a",
      collector_ids = list("collector-esperado"),
      date_modified_lte = "2026-05-28T00:00:00+00:00"
    )
  )
  snapshot <- list(
    sources = list(list(
      collectors = list(
        list(id = "collector-esperado", name = "Collector esperado"),
        list(id = "collector-fuera", name = "Collector fuera")
      )
    ))
  )

  out <- .analitica_unified_apply_observation_metadata(df, base_meta, snapshot)

  expect_false(out$posterior_corte[1])
  expect_true(out$posterior_corte[2])
  expect_false(out$collector_fuera_scope[1])
  expect_true(out$collector_fuera_scope[2])
  expect_match(out$observacion_export[2], "posterior al corte")
  expect_match(out$observacion_export[2], "Collector fuera")
  expect_true("id_enlace_sm" %in% names(out))
  expect_true("p36" %in% names(out))
})

test_that("export unificado omite metadatos operativos e identificadores directos", {
  skip_if_not(exists(".analitica_unified_exclusions", mode = "function"))

  inst <- list(
    survey = data.frame(
      name = c("p1", "p3", "p4", "p5", "p21", "p25", "p26_3", "p31", "p36", "p39"),
      type = rep("text", 10),
      label = c(
        "Edad",
        "Correo electrónico que más utiliza (no laboral):",
        "Código PUCP:",
        "Número de celular:",
        "¿Cuál es el nombre legal de la empresa en la que se encuentra trabajando?",
        "¿Sería posible que nos brinde los datos de su jefe directo?",
        "Cargo",
        "¿Cuál es su ingreso mensual aproximado? (en soles)",
        "Código Pulso",
        "Enumerador"
      ),
      stringsAsFactors = FALSE
    ),
    choices = data.frame()
  )
  df <- data.frame(
    response_id = "r1",
    source_title = "Encuesta",
    collector_id = "collector-fuera",
    date_modified = "2026-05-29T10:00:00+00:00",
    posterior_corte = TRUE,
    fecha_corte_referencia = "2026-05-28T00:00:00+00:00",
    collector_fuera_scope = TRUE,
    collector_label = "Collector fuera",
    observacion_export = "Incluida en base efectiva.",
    id_enlace_sm = "1001",
    cv_id = "1001",
    cv_token_extra = "x",
    recipient_cv_id = "1001",
    p1 = 25,
    p3 = "a@b.com",
    p4 = "123",
    p5 = "999",
    p21 = "Empresa SAC",
    p25 = "Sí",
    p26_3 = "Gerente",
    p31 = 5000,
    p36 = "P316",
    p39 = "Enum 1",
    stringsAsFactors = FALSE
  )

  excl <- .analitica_unified_exclusions(df, inst)

  expect_true(all(c("response_id", "source_title", "p3", "p4", "p5", "p21", "p25", "p26_3", "p39") %in% excl))
  expect_true(all(c("cv_id", "cv_token_extra", "recipient_cv_id") %in% excl))
  expect_false("collector_id" %in% excl)
  expect_false("date_modified" %in% excl)
  expect_false("posterior_corte" %in% excl)
  expect_false("fecha_corte_referencia" %in% excl)
  expect_false("collector_fuera_scope" %in% excl)
  expect_false("collector_label" %in% excl)
  expect_false("observacion_export" %in% excl)
  expect_false("id_enlace_sm" %in% excl)
  expect_false("p1" %in% excl)
  expect_false("p31" %in% excl)
  expect_false("p36" %in% excl)
})

# ============================================================================
test_that(".aplicar_etiquetas mapea códigos a labels en select_one", {
  inst <- .fixture_inst()
  df <- .fixture_data()

  out <- .aplicar_etiquetas(df, inst, valores = "etiquetas", multi_select = "codigos_crudos")

  expect_equal(as.character(out$sexo), c("Hombre","Mujer","Hombre","Mujer","Hombre"))
  expect_equal(as.character(out$nivel_acuerdo[1]), "De acuerdo")
  expect_equal(as.character(out$nivel_acuerdo[2]), "Totalmente de acuerdo")

  # Variables sin labels quedan igual (edad numérica, comentario texto).
  expect_equal(out$edad, df$edad)
})

test_that(".aplicar_etiquetas limpia codigos redundantes en etiquetas de escala", {
  inst <- .fixture_inst()
  escala <- c("1", "2", "3", "4")
  attr(escala, "labels") <- stats::setNames(
    c("1", "2", "3", "4"),
    c("Nada competente 1", "2", "3", "Totalmente competente 4")
  )
  attr(escala, "label") <- "Competencia"
  df <- data.frame(competencia = I(escala), stringsAsFactors = FALSE)

  out <- .aplicar_etiquetas(df, inst, valores = "etiquetas", multi_select = "codigos_crudos")

  expect_equal(as.character(out$competencia), c("Nada competente", "2", "3", "Totalmente competente"))
  expect_equal(attr(out$competencia, "label", exact = TRUE), "Competencia")
})

test_that(".bases_clean_choice_labels no altera categorias nominales con numeros", {
  labels <- c("Plan piloto 1", "Proyecto fase 2", "Canal externo 3")
  expect_equal(.bases_clean_choice_labels(c("1", "2", "3"), labels), labels)
})

test_that("reporte_data, frecuencias y review usan labels limpios en el .pulso", {
  skip_if_not(exists("reporte_data", mode = "function"))
  skip_if_not(exists("freq_table_spss", mode = "function"))

  inst <- list(
    survey = data.frame(
      name = c("p12", "p12_other", "p14_2"),
      type = c("select_one", "text", "select_one"),
      list_name = c("lst_p12", NA, "lst_p14"),
      label = c("Institucion", "Otra institucion", "Competencia"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p12", "lst_p12", "lst_p14", "lst_p14", "lst_p14", "lst_p14"),
      name = c("1", "14", "1", "2", "3", "4"),
      label = c(
        "PUCP", "Otra institucion:",
        "Nada competente 1", "2", "3", "Totalmente competente 4"
      ),
      stringsAsFactors = FALSE
    ),
    choices_raw = data.frame(
      list_name = c("lst_p12", "lst_p12", "lst_p14", "lst_p14", "lst_p14", "lst_p14"),
      name = c("1", "14", "1", "2", "3", "4"),
      `label::es` = c(
        "PUCP", "Otra institucion:",
        "Nada competente 1", "2", "3", "Totalmente competente 4"
      ),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    var_labels = c(p12 = "Institucion", p12_other = "Otra institucion", p14_2 = "Competencia"),
    measure_rules = data.frame(
      name = c("p12", "p12_other", "p14_2"),
      type = c("select_one", "text", "select_one"),
      list_name = c("lst_p12", NA, "lst_p14"),
      measure_sugerida = c("nominal", "nominal", "ordinal"),
      stringsAsFactors = FALSE
    ),
    dicc_label_to_code = list(
      lst_p12 = stats::setNames(c("1", "14"), c("PUCP", "Otra institucion:")),
      lst_p14 = stats::setNames(c("1", "2", "3", "4"), c("Nada competente 1", "2", "3", "Totalmente competente 4"))
    ),
    dicc_code_to_label = list(
      lst_p12 = stats::setNames(c("PUCP", "Otra institucion:"), c("1", "14")),
      lst_p14 = stats::setNames(c("Nada competente 1", "2", "3", "Totalmente competente 4"), c("1", "2", "3", "4"))
    ),
    orders_list = list(
      p12 = list(names = c("1", "14"), labels = c("PUCP", "Otra institucion:"), label = "Institucion"),
      p14_2 = list(
        names = c("1", "2", "3", "4"),
        labels = c("Nada competente 1", "2", "3", "Totalmente competente 4"),
        label = "Competencia"
      )
    )
  )
  class(inst) <- c("prosecnur_instrumento", "list")

  df <- data.frame(
    p12 = c("PUCP", "convenio externo", "Otra institucion:", "PUCP", "", "PUCP"),
    p12_other = c("", "convenio externo", "texto abierto", "", "", ""),
    p14_2 = c("1", "2", "3", "4", "4", "1"),
    stringsAsFactors = FALSE
  )

  rp <- reporte_data(df, inst)
  rp_inst <- attr(rp, "instrumento_reporte")

  expect_equal(as.character(rp$p12), c("1", "14", "14", "1", NA, "1"))
  expect_equal(
    unname(attr(rp$p14_2, "labels", exact = TRUE)),
    c("Nada competente", "2", "3", "Totalmente competente")
  )
  expect_equal(rp_inst$orders_list$p14_2$labels, c("Nada competente", "2", "3", "Totalmente competente"))

  tab <- freq_table_spss(
    rp,
    "p14_2",
    survey = rp_inst$survey,
    orders_list = rp_inst$orders_list,
    mostrar_todo = TRUE
  )
  expect_true("Totalmente competente" %in% tab$Opciones)
  expect_true("Nada competente" %in% tab$Opciones)
  expect_false(any(tab$Opciones %in% c("Totalmente competente 4", "Nada competente 1")))

  if (exists(".analitica_apply_data_review", mode = "function")) {
    reviewed <- .analitica_apply_data_review(rp, rp_inst, list(datos = list()))
    expect_equal(
      reviewed$inst$orders_list$p14_2$labels,
      c("Nada competente", "2", "3", "Totalmente competente")
    )
    expect_false(any(unname(attr(reviewed$data$p14_2, "labels", exact = TRUE)) %in%
      c("Totalmente competente 4", "Nada competente 1")))
  }
})

test_that(".aplicar_etiquetas en modo 'etiquetas_unidas' join multi-select con ' | '", {
  inst <- .fixture_inst()
  df <- .fixture_data()

  out <- .aplicar_etiquetas(df, inst, valores = "etiquetas", multi_select = "etiquetas_unidas")

  expect_equal(as.character(out$intereses[1]), "Deportes | Arte")
  expect_equal(as.character(out$intereses[3]), "Deportes | Ciencia")
  expect_equal(as.character(out$intereses[5]), "Deportes | Arte | Ciencia")
})

test_that(".aplicar_etiquetas valores='codigos' es no-op", {
  inst <- .fixture_inst()
  df <- .fixture_data()

  out <- .aplicar_etiquetas(df, inst, valores = "codigos", multi_select = "codigos_crudos")

  # Las columnas siguen siendo códigos, no etiquetas
  expect_equal(as.character(out$sexo[1]), "1")
  expect_equal(as.character(out$intereses[1]), "a b")
})

# ============================================================================
test_that(".bases_export_sav escribe un .sav legible con measure embebido", {
  if (!requireNamespace("haven", quietly = TRUE)) skip("haven no disponible")

  inst <- .fixture_inst()
  df <- .fixture_data()

  sav_path <- tempfile(fileext = ".sav")
  on.exit(unlink(sav_path), add = TRUE)
  writeBin(charToRaw("archivo viejo"), sav_path)

  .bases_export_sav(df, inst, sav_path, NULL)

  expect_true(file.exists(sav_path))
  expect_gt(file.info(sav_path)$size, 0)

  # Leer de vuelta y verificar atributos
  re <- haven::read_sav(sav_path)

  # `sexo` tras labelled_spss se convierte a numérico → F8.0 (no A8).
  # Lo que importa es que tenga formato SPSS válido para enteros.
  expect_match(attr(re$sexo, "format.spss", exact = TRUE) %||% "", "^F")

  # `nivel_acuerdo` (select_one likert) → ordinal, queda como haven_labelled_spss
  expect_true(inherits(re$nivel_acuerdo, "haven_labelled") ||
              inherits(re$nivel_acuerdo, "haven_labelled_spss"))

  # Value labels preservados
  labs_sexo <- attr(re$sexo, "labels", exact = TRUE)
  expect_true(!is.null(labs_sexo))
  expect_true("Hombre" %in% names(labs_sexo))
  expect_true("Mujer" %in% names(labs_sexo))

  # Variable labels preservados
  expect_equal(attr(re$edad, "label", exact = TRUE), "Edad")

  meta <- .pyreadstat_metadata(sav_path)
  expect_equal(meta$variable_measure$sexo, "nominal")
  expect_equal(meta$variable_measure$nivel_acuerdo, "ordinal")
  expect_equal(meta$variable_measure$edad, "scale")
  expect_equal(meta$variable_measure$comentario, "nominal")
  expect_equal(meta$value_label_counts$sexo, 2)
  expect_equal(meta$value_label_counts$nivel_acuerdo, 5)
})

test_that(".bases_export_sav con path_sps genera syntax de respaldo", {
  inst <- .fixture_inst()
  df <- .fixture_data()

  sav_path <- tempfile(fileext = ".sav")
  sps_path <- tempfile(fileext = ".sps")
  on.exit(unlink(c(sav_path, sps_path)), add = TRUE)

  .bases_export_sav(df, inst, sav_path, sps_path)

  expect_true(file.exists(sps_path))
  content <- readLines(sps_path)
  expect_true(any(grepl("VARIABLE LEVEL", content)))
  expect_true(any(grepl("FORMATS", content)))
  expect_true(any(grepl("EXECUTE", content)))
})

# ============================================================================
test_that(".bases_write_xlsx valores='ambos' produce 2 hojas", {
  if (!requireNamespace("openxlsx", quietly = TRUE)) skip("openxlsx no disponible")

  inst <- .fixture_inst()
  df <- .fixture_data()

  df_cod <- .aplicar_etiquetas(df, inst, valores = "codigos", multi_select = "codigos_crudos")
  df_lab <- .aplicar_etiquetas(df, inst, valores = "etiquetas", multi_select = "etiquetas_unidas")

  out_path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out_path), add = TRUE)

  .bases_write_xlsx(df_cod, df_lab, out_path, valores = "ambos")

  expect_true(file.exists(out_path))
  sheets <- openxlsx::getSheetNames(out_path)
  expect_setequal(sheets, c("codigos", "etiquetas"))

  # Leer la hoja etiquetas y verificar estructura:
  # fila 1 = names técnicos; fila 2 = labels; fila 3+ = datos.
  etq <- openxlsx::read.xlsx(out_path, sheet = "etiquetas", colNames = FALSE)
  expect_equal(as.character(etq[1, 1]), "sexo")
  expect_equal(as.character(etq[2, 1]), "Sexo")
  # Datos a partir de fila 3
  expect_true(as.character(etq[3, 1]) %in% c("Hombre","Mujer"))
})

test_that(".bases_write_xlsx valores='codigos' produce 1 hoja única", {
  if (!requireNamespace("openxlsx", quietly = TRUE)) skip("openxlsx no disponible")

  inst <- .fixture_inst()
  df <- .fixture_data()
  df_cod <- .aplicar_etiquetas(df, inst, valores = "codigos", multi_select = "codigos_crudos")

  out_path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out_path), add = TRUE)

  .bases_write_xlsx(df_cod, df_cod, out_path, valores = "codigos")
  sheets <- openxlsx::getSheetNames(out_path)
  expect_equal(sheets, "datos")
})

test_that(".bases_write_xlsx puede agregar ficha tecnica analitica", {
  if (!requireNamespace("openxlsx", quietly = TRUE)) skip("openxlsx no disponible")
  skip_if_not(exists(".analitica_add_ficha_tecnica_from_spec", mode = "function"))

  inst <- .fixture_inst()
  df <- .fixture_data()

  out_path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out_path), add = TRUE)

  .bases_write_xlsx(
    df,
    df,
    out_path,
    valores = "codigos",
    ficha_tecnica = list(
      instrumento = inst,
      reporte = "Base de datos analitica"
    )
  )

  sheets <- openxlsx::getSheetNames(out_path)
  expect_equal(sheets, c("datos", "Ficha tecnica"))
  ficha <- openxlsx::read.xlsx(out_path, sheet = "Ficha tecnica", colNames = FALSE)
  ficha_text <- paste(unlist(ficha, use.names = FALSE), collapse = " ")
  expect_match(ficha_text, "FICHA TECNICA")
  expect_match(ficha_text, "Tamano de la muestra")
  expect_match(ficha_text, "Base de datos analitica")
})

# ============================================================================
test_that(".bases_write_csv produce CSV UTF-8 leíble", {
  inst <- .fixture_inst()
  df <- .fixture_data()
  df_lab <- .aplicar_etiquetas(df, inst, valores = "etiquetas", multi_select = "etiquetas_unidas")

  out_path <- tempfile(fileext = ".csv")
  on.exit(unlink(out_path), add = TRUE)

  .bases_write_csv(df_lab, out_path, separador = ",")

  expect_true(file.exists(out_path))
  # Releer y verificar header + contenido
  lines <- readLines(out_path, encoding = "UTF-8", n = 3)
  expect_true(any(grepl("sexo", lines)))
  expect_true(any(grepl("Hombre|Mujer", lines)))
})

test_that(".bases_write_csv separador=';' respeta locale ES", {
  df <- data.frame(a = 1:3, b = c("x","y","z"), stringsAsFactors = FALSE)
  out_path <- tempfile(fileext = ".csv")
  on.exit(unlink(out_path), add = TRUE)

  .bases_write_csv(df, out_path, separador = ";")

  line <- readLines(out_path, encoding = "UTF-8", n = 2)[2]
  # Al menos debe haber un ";" separador
  expect_true(grepl(";", line))
})

# ============================================================================
# Metadatos editor: preview + overrides
# ============================================================================

test_that(".bases_metadata_preview devuelve fila por variable con inferencia", {
  inst <- .fixture_inst()
  df <- .fixture_data()

  preview <- .bases_metadata_preview(df, inst)

  expect_equal(length(preview), ncol(df))
  nombres <- vapply(preview, function(x) x$name, character(1))
  expect_setequal(nombres, names(df))

  # Encontrar `sexo` y `nivel_acuerdo`
  sexo <- Filter(function(x) x$name == "sexo", preview)[[1]]
  nivel <- Filter(function(x) x$name == "nivel_acuerdo", preview)[[1]]

  expect_equal(sexo$inferred_measure, "nominal")
  expect_equal(nivel$inferred_measure, "ordinal")
  expect_true(sexo$has_labels)
  expect_true(nivel$has_labels)
  expect_equal(sexo$tipo_xlsform, "select_one")
})

test_that(".bases_overrides_parse filtra inválidos y preserva válidos", {
  raw <- list(
    sexo = list(measure = "ordinal"),                    # válido
    edad = list(measure = "INVENTADO"),                  # measure inválido → se ignora
    foo  = list(format_spss = "F4.0"),                   # válido
    bar  = list(measure = "scale", format_spss = ""),    # format_spss vacío → se ignora format
    baz  = "no-es-lista"                                 # tipo inválido → se ignora
  )
  # Clave vacía: R no permite declararla inline, la asignamos después
  raw[[""]] <- list(measure = "scale")

  out <- .bases_overrides_parse(raw)

  expect_equal(out$sexo$measure, "ordinal")
  expect_null(out$edad)
  expect_equal(out$foo$format_spss, "F4.0")
  expect_equal(out$bar$measure, "scale")
  expect_null(out$bar$format_spss)
  expect_false("" %in% names(out))
  expect_null(out$baz)
})

test_that(".bases_apply_overrides pisa la inferencia sin afectar otras vars", {
  inst <- .fixture_inst()
  df <- .fixture_data()
  df <- .bases_sav_prepare(df, inst)

  # Antes del override: sexo es nominal
  expect_equal(attr(df$sexo, "measure", exact = TRUE), "nominal")

  overrides <- list(
    sexo = list(measure = "ordinal"),
    edad = list(format_spss = "F4.0")
  )

  df2 <- .bases_apply_overrides(df, overrides)

  # Sexo ahora es ordinal
  expect_equal(attr(df2$sexo, "measure", exact = TRUE), "ordinal")
  # Edad tiene format override
  expect_equal(attr(df2$edad, "format.spss", exact = TRUE), "F4.0")
  # Otras variables no tocadas
  expect_equal(attr(df2$nivel_acuerdo, "measure", exact = TRUE),
               attr(df$nivel_acuerdo, "measure", exact = TRUE))
})

test_that(".bases_coerce_spss_types respeta tipos numericos/texto del XLSForm", {
  inst <- list(survey = data.frame(
    name = c("edad_txt", "texto_vacio"),
    type = c("integer", "text"),
    stringsAsFactors = FALSE
  ))
  df <- data.frame(
    edad_txt = I(c("29", "34", NA)),
    texto_vacio = c(NA_real_, NA_real_, NA_real_)
  )
  attr(df$edad_txt, "label") <- "Edad"
  attr(df$texto_vacio, "label") <- "Texto vacio"

  out <- .bases_coerce_spss_types(df, inst)

  expect_true(is.numeric(out$edad_txt))
  expect_equal(out$edad_txt[1:2], c(29, 34))
  expect_true(is.character(out$texto_vacio))
  expect_equal(attr(out$edad_txt, "label", exact = TRUE), "Edad")
  expect_equal(attr(out$texto_vacio, "label", exact = TRUE), "Texto vacio")
})

test_that(".bases_export_sav aplica overrides en roundtrip", {
  if (!requireNamespace("haven", quietly = TRUE)) skip("haven no disponible")

  inst <- .fixture_inst()
  df <- .fixture_data()

  # Override: forzar sexo a ordinal (aunque la inferencia diga nominal)
  overrides <- list(sexo = list(measure = "ordinal"))

  sav_path <- tempfile(fileext = ".sav")
  on.exit(unlink(sav_path), add = TRUE)

  .bases_export_sav(df, inst, sav_path, NULL, overrides = overrides)

  re <- haven::read_sav(sav_path)
  # haven lee `measure` como atributo si readstat lo preservó
  meas <- attr(re$sexo, "measure", exact = TRUE)
  if (!is.null(meas)) {
    expect_equal(meas, "ordinal")
  } else {
    # Si el haven instalado no expone el atributo, al menos el
    # archivo se escribió OK
    expect_true(file.exists(sav_path))
  }

  meta <- .pyreadstat_metadata(sav_path)
  expect_equal(meta$variable_measure$sexo, "ordinal")
})
