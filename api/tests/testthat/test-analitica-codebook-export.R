# Tests del libro de códigos del estudio (endpoint /api/analitica/codebook):
#   ARREGLO 1 — orden de dummies de select_multiple por la lista de opciones.
#   ARREGLO 2 — soporte de formato PDF (reporte_codebook_pdf cableado).
#   ARREGLO 3 — el XLSX del codebook NO embebe la ficha técnica (1 sola hoja).
#
# Ejecutar:
#   LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 Rscript -e \
#     'pkgload::load_all("api",quiet=TRUE); testthat::test_file("api/tests/testthat/test-analitica-codebook-export.R")'

library(testthat)

make_sm_inst <- function() {
  list(
    survey = data.frame(
      name = c("edad", "estudios"),
      type = c("integer", "select_multiple lista_est"),
      label = c("Edad", "Estudios alcanzados"),
      list_name = c("", "lista_est"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lista_est",
      name = c("1", "2", "3", "4", "5", "96"),
      label = c("Primaria", "Secundaria", "Tecnico", "Bachiller", "Titulo", "No aplica"),
      stringsAsFactors = FALSE
    )
  )
}

# Data con las dummies en orden DESORDENADO (como las genera la codificación),
# más una columna no-dummy y un pseudo-duplicado de madre que NO debe moverse.
make_sm_data <- function(extra_code = NULL) {
  data <- data.frame(edad = c(20L, 30L, 40L), stringsAsFactors = FALSE)
  scrambled <- c("2", "96", "5", "1", "3", "4")
  if (!is.null(extra_code)) scrambled <- c(scrambled, extra_code)
  for (code in scrambled) {
    data[[paste0("estudios.", code)]] <- c(1L, 0L, 1L)
  }
  data$estudios_text <- c("a", "b", "c")  # NO es dummy (sin ".<code>")
  attr(data, "instrumento_reporte") <- list(marca = "conservar")
  data
}

test_that("ARREGLO 1: los dummies se reordenan por el orden de choices del XLSForm", {
  inst <- make_sm_inst()
  data <- make_sm_data()

  antes <- grep("^estudios\\.", names(data), value = TRUE)
  expect_equal(antes, c("estudios.2", "estudios.96", "estudios.5",
                        "estudios.1", "estudios.3", "estudios.4"))

  out <- .analitica_order_sm_dummy_cols(data, inst)

  despues <- grep("^estudios\\.", names(out), value = TRUE)
  expect_equal(despues, c("estudios.1", "estudios.2", "estudios.3",
                          "estudios.4", "estudios.5", "estudios.96"))

  # No se pierde ni duplica ninguna columna.
  expect_equal(ncol(out), ncol(data))
  expect_setequal(names(out), names(data))
  # La columna no-dummy y el atributo top-level se conservan.
  expect_true("estudios_text" %in% names(out))
  expect_equal(attr(out, "instrumento_reporte")$marca, "conservar")
})

test_that("ARREGLO 1: el override de orden_categorias (orders_list) manda sobre el orden de choices", {
  inst <- make_sm_inst()
  # El usuario reordenó con las flechas: 96 al final tras un orden custom.
  inst$orders_list <- list(estudios = list(names = c("5", "4", "3", "2", "1", "96")))
  data <- make_sm_data()

  out <- .analitica_order_sm_dummy_cols(data, inst)

  despues <- grep("^estudios\\.", names(out), value = TRUE)
  # Sigue el override, NO el orden de choices (1..5,96).
  expect_equal(despues, c("estudios.5", "estudios.4", "estudios.3",
                          "estudios.2", "estudios.1", "estudios.96"))
  expect_setequal(names(out), names(data))
})

test_that("ARREGLO 1: sin override, cae al orden de choices (comportamiento base)", {
  inst <- make_sm_inst()
  inst$orders_list <- list()  # override vacío → choices
  data <- make_sm_data()

  out <- .analitica_order_sm_dummy_cols(data, inst)

  despues <- grep("^estudios\\.", names(out), value = TRUE)
  expect_equal(despues, c("estudios.1", "estudios.2", "estudios.3",
                          "estudios.4", "estudios.5", "estudios.96"))
})

test_that("ARREGLO 1: los códigos ausentes de la lista quedan al final del bloque", {
  inst <- make_sm_inst()
  data <- make_sm_data(extra_code = "7")  # 7 no está en lista_est

  out <- .analitica_order_sm_dummy_cols(data, inst)
  despues <- grep("^estudios\\.", names(out), value = TRUE)
  # 7 (categoría real fuera de lista) va tras las declaradas; el valor especial
  # 96 (rango [80,100)) va SIEMPRE al final del bloque, incluso después de 7.
  expect_equal(despues, c("estudios.1", "estudios.2", "estudios.3",
                          "estudios.4", "estudios.5", "estudios.7", "estudios.96"))
})

test_that("ARREGLO 1: reordenar ya-ordenado es un no-op estable", {
  inst <- make_sm_inst()
  data <- make_sm_data()
  once <- .analitica_order_sm_dummy_cols(data, inst)
  twice <- .analitica_order_sm_dummy_cols(once, inst)
  expect_equal(names(twice), names(once))
})

# ---- Helper: df etiquetado mínimo para el motor de codebook ----------------
make_codebook_df <- function() {
  df <- data.frame(sexo = c("1", "2", "1"), stringsAsFactors = FALSE)
  attr(df$sexo, "label") <- "Sexo"
  attr(df$sexo, "labels") <- stats::setNames(c("Hombre", "Mujer"), c("1", "2"))
  df
}

test_that("ARREGLO 3: reporte_codebook con ficha_tecnica=FALSE deja 1 sola hoja", {
  skip_if_not_installed("openxlsx")
  df <- make_codebook_df()
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)

  reporte_codebook(data = df, path_xlsx = path, ficha_tecnica = FALSE)

  wb <- openxlsx::loadWorkbook(path)
  expect_equal(length(openxlsx::sheets(wb)), 1L)
  expect_equal(openxlsx::sheets(wb), "Codebook")
})

test_that("ARREGLO 2: reporte_codebook_pdf genera un PDF no vacío", {
  skip_if_not(exists("reporte_codebook_pdf", mode = "function"))
  df <- make_codebook_df()
  path <- tempfile(fileext = ".pdf")
  on.exit(unlink(path), add = TRUE)

  reporte_codebook_pdf(df = df, output_file = path, titulo = "LIBRO DE CODIGOS")

  expect_true(file.exists(path))
  expect_gt(file.info(path)$size, 1000)
  # Cabecera PDF válida.
  con <- file(path, "rb"); on.exit(close(con), add = TRUE)
  expect_equal(rawToChar(readBin(con, "raw", n = 5)), "%PDF-")
})

# ---- Conteo de páginas físicas del PDF -------------------------------------
# El árbol de páginas de grDevices::pdf() es ASCII plano, así que /Count N es
# fiable. Se lee en crudo (byte a byte) para no tropezar con los streams
# binarios del PDF.
pdf_page_count <- function(path) {
  raw <- readBin(path, "raw", n = file.info(path)$size)
  raw <- raw[raw != as.raw(0L)]                 # NUL rompe rawToChar
  txt <- rawToChar(raw)
  m <- regmatches(txt, gregexpr("/Count[[:space:]]+[0-9]+", txt, useBytes = TRUE))[[1]]
  if (!length(m)) return(NA_integer_)
  max(as.integer(gsub("[^0-9]", "", m)))
}

# Muchas variables etiquetadas: fuerza contenido multipágina + un índice.
make_wide_codebook_df <- function(n_extra = 30L) {
  # Variable con códigos de TEXTO largos (el caso del bug de ancho).
  txt <- c("Han_disminuido", "Se_mantienen_igual", "Han_aumentado")
  df <- data.frame(C1_negative = rep(txt, length.out = 6), stringsAsFactors = FALSE)
  attr(df$C1_negative, "label")  <- "¿Cree que los mensajes negativos han aumentado, disminuido o se mantienen igual?"
  attr(df$C1_negative, "labels") <- stats::setNames(txt, c("Han disminuido", "Se mantienen igual", "Han aumentado"))
  for (k in seq_len(n_extra)) {
    v <- rep(c("1", "2", "3", "4", "5"), length.out = 6)
    attr(v, "label")  <- sprintf("Pregunta ordinal de acuerdo/desacuerdo número %02d", k)
    attr(v, "labels") <- stats::setNames(
      c("1", "2", "3", "4", "5"),
      c("Totalmente en desacuerdo", "En desacuerdo",
        "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo"))
    df[[sprintf("A%02d_var", k)]] <- v
  }
  df
}

test_that("ARREGLO 4: el ancho de la columna Código se adapta al código más largo", {
  skip_if_not(exists(".codebook_pdf_code_w", mode = "function"))
  # grid necesita un dispositivo activo para medir texto.
  dev_path <- tempfile(fileext = ".pdf")
  grDevices::pdf(dev_path); on.exit({ grDevices::dev.off(); unlink(dev_path) }, add = TRUE)

  w  <- .codebook_pdf_geometry()$col_w
  tb <- .CODEBOOK_TBL
  w_short <- .codebook_pdf_code_w(c("1", "2", "3", "4", "5"), w)
  w_long  <- .codebook_pdf_code_w(c("Han_disminuido", "Se_mantienen_igual", "Han_aumentado"), w)

  # Códigos de texto largos exigen más ancho que los numéricos cortos.
  expect_gt(w_long, w_short)
  # Siempre acotado entre el mínimo y el máximo (no se come la columna Etiqueta).
  expect_gte(w_short, tb$code_w)
  expect_lte(w_long, tb$code_w_max * w)
})

test_that("ARREGLO 5: el PDF no arrastra una hoja en blanco inicial", {
  skip_if_not(exists("reporte_codebook_pdf", mode = "function"))
  df <- make_wide_codebook_df(30L)
  path <- tempfile(fileext = ".pdf")
  on.exit(unlink(path), add = TRUE)

  res <- reporte_codebook_pdf(df = df, output_file = path, titulo = "LIBRO DE CODIGOS")

  # El nº de páginas físicas del PDF coincide con el contador lógico (sin
  # página en blanco de más al inicio).
  expect_gt(res$n_pages, 1L)          # hay índice + contenido multipágina
  expect_equal(pdf_page_count(path), res$n_pages)
})
