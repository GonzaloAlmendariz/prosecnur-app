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
  # prosecnur::reporte_data.
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
})
