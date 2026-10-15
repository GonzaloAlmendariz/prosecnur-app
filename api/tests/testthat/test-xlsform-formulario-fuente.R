# Item 22 (checklist de exportacion 2026-10-15): el PDF del formulario lleva
# Liberation Sans Narrow EMBEBIDA, empaquetada en inst/fonts, y falla con la
# causa si no la tiene. Ver api/R/reporte_formulario_fuente.R.

.fz_fixture <- function() {
  list(
    survey = data.frame(
      type = c("begin_group", "note", "select_one sn", "end_group"),
      name = c("g", "nota", "acepta", "ge"),
      label = c("Datos <i>generales</i>", "Lea <b>todo</b> con <i>calma</i>.",
                "Acepta <i>participar</i>?", ""),
      stringsAsFactors = FALSE),
    choices = data.frame(list_name = "sn", name = c("1", "2"), label = c("<i>Si</i>", "No"),
                         stringsAsFactors = FALSE),
    settings = list(form_title = "Fuente embebida"))
}

.fz_pdffonts <- function(path) {
  bin <- Sys.which("pdffonts")
  testthat::skip_if_not(nzchar(bin), "pdffonts no disponible")
  l <- system2(bin, shQuote(path), stdout = TRUE)[-(1:2)]
  campos <- strsplit(trimws(l), "\\s+")
  data.frame(
    nombre = sub("^[A-Z]{6}\\+", "", vapply(campos, `[[`, "", 1L)),
    emb = vapply(campos, function(v) v[length(v) - 4L], ""),
    sub = vapply(campos, function(v) v[length(v) - 3L], ""),
    stringsAsFactors = FALSE)
}

test_that("item 22: la fuente viaja en el paquete con su licencia y su procedencia", {
  d <- .form_fuente_dir()
  expect_true(all(file.exists(file.path(d, .FORM_FUENTE_ARCHIVOS))))
  expect_true(all(file.exists(file.path(d, c("License.txt", "COPYING", "README.md")))))
  # La procedencia declara el sha256 de cada TTF y el de cada uno coincide.
  readme <- readLines(file.path(d, "README.md"), warn = FALSE)
  for (f in .FORM_FUENTE_ARCHIVOS) {
    linea <- grep(f, readme, fixed = TRUE, value = TRUE)
    sha <- regmatches(linea, regexpr("[0-9a-f]{64}", linea))
    expect_length(sha, 1L)
    real <- if (requireNamespace("digest", quietly = TRUE)) digest::digest(file.path(d, f), algo = "sha256", file = TRUE) else
      sub(" .*$", "", system2("shasum", c("-a", "256", shQuote(file.path(d, f))), stdout = TRUE))
    expect_identical(real, sha, label = f)
  }
  expect_true(any(grepl("GNU General Public License v.2 with the exceptions", readLines(file.path(d, "License.txt"), warn = FALSE), fixed = TRUE)))
})

test_that("item 22: el PDF lleva SOLO Liberation Sans Narrow, embebida, y pdftotext la lee", {
  skip_if_not(nzchar(Sys.which("pdftotext")))
  fx <- .fz_fixture()
  tmp <- tempfile(fileext = ".pdf")
  r <- reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = tmp,
                              options = list(columns = 1))
  f <- .fz_pdffonts(tmp)
  expect_setequal(f$nombre, c("LiberationSansNarrow", "LiberationSansNarrow-Bold",
                              "LiberationSansNarrow-Italic", "LiberationSansNarrow-BoldItalic"))
  expect_true(all(f$emb == "yes" & f$sub == "yes"))
  txt <- paste(system2(Sys.which("pdftotext"), c(shQuote(tmp), "-"), stdout = TRUE), collapse = " ")
  expect_match(txt, "Lea todo con calma.", fixed = TRUE)
  expect_match(txt, "Acepta participar?", fixed = TRUE)
  expect_false(any(grepl("La fuente del PDF no tiene", r$warnings, fixed = TRUE)))
})

test_that("item 22: si falta un archivo de la fuente, el render falla diciendo cual", {
  d <- tempfile("fuente_incompleta_"); dir.create(d)
  file.copy(file.path(.form_fuente_dir(), .FORM_FUENTE_ARCHIVOS[-2]), d)
  expect_error(.form_fuente_dir(d), "LiberationSansNarrow-Bold.ttf", class = "formulario_fuente_error")
  expect_error(.form_fuente_dir(""), "fonts/liberation-sans-narrow", class = "formulario_fuente_error")
  testthat::local_mocked_bindings(
    .form_fuente_dir = function(d = NULL) .form_fuente_error("Faltan archivos de la fuente del formulario en el paquete: LiberationSansNarrow-Bold.ttf."),
    .package = "prosecnurapp")
  fx <- .fz_fixture()
  expect_error(reporte_formulario_pdf(fx$survey, fx$choices, fx$settings,
                                      output_file = tempfile(fileext = ".pdf")),
               "LiberationSansNarrow-Bold.ttf", class = "formulario_fuente_error")
})

test_that("item 22: un PDF con otra fuente no pasa la verificacion del artefacto", {
  # Lo que pasaria si fontconfig no viera la fuente: cairo cae a otra EN
  # SILENCIO. La verificacion lo convierte en un error con la causa.
  tmp <- tempfile(fileext = ".pdf")
  grDevices::pdf(tmp, family = "Helvetica"); grid::grid.text("hola"); grDevices::dev.off()
  expect_error(.form_fuente_verificar_pdf(tmp), "no lleva la fuente del paquete", class = "formulario_fuente_error")
})

test_that("item 22: un caracter sin glifo se declara y es lo unico que puede traer otra fuente", {
  fx <- .fz_fixture()
  fx$survey$label[2] <- "Lea ⦁ todo."
  m <- formulario_pdf_build_model(fx$survey, fx$choices, fx$settings)
  expect_true(any(grepl("La fuente del PDF no tiene 1 caracter(es) del instrumento (⦁)", m$warnings, fixed = TRUE)))
})

test_that("item 22: por el camino del job (worker callr) la fuente tambien se embebe", {
  srv <- http_contract_server()
  http_contract_skip_if_no_jobs_runtime()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  sid <- creada$json$session_id
  wb <- list(
    survey = list(columns = c("type", "name", "label"),
                  rows = list(c("select_one sn", "acepta", "Acepta <i>participar</i>?"))),
    choices = list(columns = c("list_name", "name", "label"),
                   rows = list(c("sn", "1", "Si"), c("sn", "2", "No"))),
    settings = list(columns = c("form_title"), rows = list(c("Fuente por el job"))))
  r <- http_post_json(srv, "/api/xlsform-editor/export-pdf", sid = sid,
                      body = list(filename = "fuente", workbook = wb))
  expect_identical(r$status, 200L)
  snap <- NULL
  for (k in 1:240) {
    p <- http_get(srv, paste0("/api/jobs/", r$json$job_id), sid = sid)
    if (p$json$status %in% c("done", "error")) { snap <- p$json; break }
    Sys.sleep(0.5)
  }
  expect_identical(snap$status, "done")
  expect_true(isTRUE(snap$result_data$ok))
  dl <- .http_contract_request(srv, sprintf("/api/files/%s/download", snap$result_data$file_id), sid = sid)
  tmp <- tempfile(fileext = ".pdf"); writeBin(dl$raw, tmp)
  f <- .fz_pdffonts(tmp)
  expect_true(all(grepl("^LiberationSansNarrow", f$nombre)), label = paste(f$nombre, collapse = ", "))
  expect_true(all(f$emb == "yes"))
  expect_true("LiberationSansNarrow-BoldItalic" %in% f$nombre)   # «participar»: enunciado + <i>
})
