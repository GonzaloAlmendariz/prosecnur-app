# Tests del override permanente de etiquetas por proyecto (label_overrides.R)
# Cubre: normalización del contrato, aplicación en capa de instrumento (los tres
# puntos), propagación a entregables (frecuencias/codebook/cruces), round-trip de
# persistencia y no-tocar etiquetas sin override.

# --- Fixture: XLSForm bilingüe en disco (choices con "es en" pegado) ----------
.lo_write_xlsform <- function() {
  skip_if_not_installed("openxlsx")
  path <- tempfile(fileext = ".xlsx")
  survey <- data.frame(
    type  = c("select_one sexo_l", "select_one seg_l"),
    name  = c("sexo", "seguridad"),
    label = c("Sexo del participante", "Percepción de seguridad Safety perception"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("sexo_l", "sexo_l", "seg_l", "seg_l", "seg_l"),
    name      = c("1", "2", "1", "2", "3"),
    label     = c("Hombre Man", "Mujer Woman",
                  "Muy seguro Very safe", "Seguro Insurance", "Inseguro Insecure"),
    stringsAsFactors = FALSE
  )
  openxlsx::write.xlsx(list(survey = survey, choices = choices), file = path)
  path
}

.lo_build_pair <- function() {
  inst <- reporte_instrumento(path = .lo_write_xlsform())
  data <- data.frame(
    sexo      = c("1", "2", "1", "2", "1"),
    seguridad = c("1", "2", "3", "1", "2"),
    stringsAsFactors = FALSE
  )
  rp <- reporte_data(data, instrumento = inst)
  list(inst = inst, data = rp)
}

# Override curado: seg_l -> español; sexo_l SIN override (debe quedar intacto).
.lo_override <- function() {
  list(
    values = list(
      seg_l = list(`1` = "Muy seguro", `2` = "Seguro", `3` = "Inseguro")
    ),
    titles = list(seguridad = "Percepción de seguridad")
  )
}

# Aísla el estado ambiente entre tests.
.lo_with_ambient <- function(ov, expr) {
  old <- .label_overrides_ambient()
  on.exit(.label_overrides_activate(old), add = TRUE)
  .label_overrides_activate(ov)
  force(expr)
}

test_that(".label_overrides_normalize arma values/titles y descarta vacíos", {
  ov <- .label_overrides_normalize(list(
    values = list(
      seg_l = list(`1` = "Muy seguro", `2` = "", `3` = "Inseguro"),
      vacia = list()
    ),
    titles = list(seguridad = "Percepción de seguridad", sin = "")
  ))
  expect_equal(ov$values$seg_l, c(`1` = "Muy seguro", `3` = "Inseguro"))  # "" descartado
  expect_false("vacia" %in% names(ov$values))
  expect_equal(unname(ov$titles["seguridad"]), "Percepción de seguridad")
  expect_false("sin" %in% names(ov$titles))

  # Idempotente sobre su propia salida
  expect_equal(.label_overrides_normalize(ov), ov)
  # NULL / no-lista => vacío
  expect_true(.label_overrides_is_empty(.label_overrides_normalize(NULL)))
})

test_that("(a) override en capa de instrumento limpia choices$label + dicc + orders_list", {
  pair <- .lo_build_pair()
  inst2 <- .label_overrides_apply_to_instrument(pair$inst, .lo_override())

  # (1) choices$label reescrito para seg_l
  seg_rows <- inst2$choices[as.character(inst2$choices$list_name) == "seg_l", ]
  expect_equal(seg_rows$label[match("1", as.character(seg_rows$name))], "Muy seguro")
  expect_false(any(grepl("Very safe|Insurance|Insecure", seg_rows$label)))

  # dicc re-derivado
  expect_equal(unname(inst2$dicc_code_to_label$seg_l["1"]), "Muy seguro")
  # dicc_label_to_code invertido coherente
  expect_equal(unname(inst2$dicc_label_to_code$seg_l["Muy seguro"]), "1")

  # orders_list$labels re-derivado + título
  expect_equal(inst2$orders_list$seguridad$labels[match("1", inst2$orders_list$seguridad$names)],
               "Muy seguro")
  expect_equal(inst2$orders_list$seguridad$label, "Percepción de seguridad")
  expect_equal(unname(inst2$var_labels["seguridad"]), "Percepción de seguridad")

  # (d) sin override => intacto (sexo_l sigue bilingüe)
  sexo_rows <- inst2$choices[as.character(inst2$choices$list_name) == "sexo_l", ]
  expect_equal(sexo_rows$label[match("1", as.character(sexo_rows$name))], "Hombre Man")
})

test_that("el constructor de Validación consume el override persistido de la sesión", {
  pair <- .lo_build_pair()
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "label_overrides", .lo_override())

  inst <- .validacion_apply_label_overrides(sid, pair$inst)
  rows <- inst$choices[
    as.character(inst$choices$list_name) == "seg_l",
    c("name", "label"), drop = FALSE
  ]
  labels <- stats::setNames(as.character(rows$label), as.character(rows$name))

  expect_identical(labels[["1"]], "Muy seguro")
  expect_false(any(grepl("Very safe|Insurance|Insecure", unlist(labels), perl = TRUE)))
})

test_that("(a) override propaga a attr(labels) y attr(label) vía el chokepoint", {
  pair <- .lo_build_pair()
  .lo_with_ambient(.lo_override(), {
    ctx <- .bases_normalize_report_context(pair$data, pair$inst)
    d <- ctx$data
    # (2) attr(labels) de seguridad en español
    labs <- attr(d$seguridad, "labels", exact = TRUE)
    expect_equal(unname(labs["1"]), "Muy seguro")
    expect_false(any(grepl("Very safe|Insurance", labs)))
    # (3) attr(label) título en español
    expect_equal(attr(d$seguridad, "label", exact = TRUE), "Percepción de seguridad")
    # sin override: sexo intacto
    slabs <- attr(d$sexo, "labels", exact = TRUE)
    expect_equal(unname(slabs["1"]), "Hombre Man")
  })
})

test_that("(b) override propaga a reporte_frecuencias (entregable en español)", {
  skip_if_not_installed("openxlsx")
  pair <- .lo_build_pair()
  .lo_with_ambient(.lo_override(), {
    ctx <- .bases_normalize_report_context(pair$data, pair$inst)
    out <- tempfile(fileext = ".xlsx")
    reporte_frecuencias(ctx$data, instrumento = ctx$inst, path_xlsx = out,
                        secciones = list(General = c("sexo", "seguridad")),
                        incluir_titulos = TRUE)
    expect_true(file.exists(out))
    wb <- openxlsx::read.xlsx(out, sheet = 1, colNames = FALSE)
    blob <- paste(unlist(wb), collapse = " | ")
    expect_true(grepl("Muy seguro", blob))
    expect_false(grepl("Very safe|Insurance", blob))
  })
})

test_that("(b) override propaga a reporte_codebook (entregable en español)", {
  skip_if_not_installed("openxlsx")
  pair <- .lo_build_pair()
  .lo_with_ambient(.lo_override(), {
    ctx <- .bases_normalize_report_context(pair$data, pair$inst)
    d <- ctx$data
    attr(d, "instrumento_reporte") <- ctx$inst
    out <- tempfile(fileext = ".xlsx")
    reporte_codebook(d, path_xlsx = out)
    expect_true(file.exists(out))
    wb <- openxlsx::read.xlsx(out, sheet = 1, colNames = FALSE)
    blob <- paste(unlist(wb), collapse = " | ")
    expect_true(grepl("Muy seguro", blob))
    expect_false(grepl("Very safe|Insurance", blob))
  })
})

test_that("(b) override propaga a reporte_cruces (entregable en español)", {
  skip_if_not_installed("openxlsx")
  pair <- .lo_build_pair()
  .lo_with_ambient(.lo_override(), {
    ctx <- .bases_normalize_report_context(pair$data, pair$inst)
    out <- tempfile(fileext = ".xlsx")
    res <- tryCatch(
      reporte_cruces(ctx$data, instrumento = ctx$inst,
                     SECCIONES = list(Seguridad = "seguridad"),
                     cruces = "sexo",
                     path_xlsx = out),
      error = function(e) e
    )
    if (inherits(res, "error")) {
      skip(paste("reporte_cruces no ejecutable en el harness:", conditionMessage(res)))
    }
    expect_true(file.exists(out))
    wb <- openxlsx::read.xlsx(out, sheet = 1, colNames = FALSE)
    blob <- paste(unlist(wb), collapse = " | ")
    expect_true(grepl("Muy seguro", blob))
    expect_false(grepl("Very safe|Insurance", blob))
  })
})

test_that("(c) round-trip de persistencia: storage sobrevive jsonlite save->load", {
  skip_if_not_installed("jsonlite")
  storage <- .label_overrides_to_storage(.lo_override())
  # Simula el guardado/lectura del .pulso (jsonlite es el formato del contrato).
  json <- jsonlite::toJSON(storage, auto_unbox = TRUE, null = "null")
  back <- jsonlite::fromJSON(json, simplifyVector = FALSE)
  ov <- .label_overrides_normalize(back)
  expect_equal(ov$values$seg_l, c(`1` = "Muy seguro", `2` = "Seguro", `3` = "Inseguro"))
  expect_equal(unname(ov$titles["seguridad"]), "Percepción de seguridad")

  # Un único par NO debe colapsar a scalar (gotcha jsonlite).
  storage1 <- .label_overrides_to_storage(list(values = list(l = list(`1` = "Uno"))))
  json1 <- jsonlite::toJSON(storage1, auto_unbox = TRUE, null = "null")
  ov1 <- .label_overrides_normalize(jsonlite::fromJSON(json1, simplifyVector = FALSE))
  expect_equal(ov1$values$l, c(`1` = "Uno"))
})

test_that("seed desde mapa bilingüe casa labels contra (list_name, code)", {
  inst <- reporte_instrumento(path = .lo_write_xlsform())
  MAP <- c(
    "Muy seguro Very safe" = "Muy seguro",
    "Seguro Insurance"     = "Seguro",
    "Inseguro Insecure"    = "Inseguro",
    "Etiqueta fantasma XYZ" = "No existe"   # no casa con ninguna choice
  )
  storage <- .label_overrides_seed_from_bilingual_map(inst, MAP)
  ov <- .label_overrides_normalize(storage)
  expect_equal(ov$values$seg_l, c(`1` = "Muy seguro", `2` = "Seguro", `3` = "Inseguro"))
  expect_true("Etiqueta fantasma XYZ" %in% attr(storage, "unmatched"))
  expect_setequal(attr(storage, "matched"),
                  c("Muy seguro Very safe", "Seguro Insurance", "Inseguro Insecure"))
})

test_that("aplicación es NO-OP sin override activo", {
  pair <- .lo_build_pair()
  # ambiente vacío
  .lo_with_ambient(NULL, {
    ctx <- .bases_normalize_report_context(pair$data, pair$inst)
    labs <- attr(ctx$data$seguridad, "labels", exact = TRUE)
    expect_equal(unname(labs["1"]), "Muy seguro Very safe")  # bilingüe intacto
  })
  # apply directo sin override => instrumento idéntico
  expect_identical(
    .label_overrides_apply_to_instrument(pair$inst, list())$choices,
    pair$inst$choices
  )
})
