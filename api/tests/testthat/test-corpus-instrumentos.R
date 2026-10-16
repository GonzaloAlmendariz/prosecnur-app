# Corpus de instrumentos reales contra el motor del papel (PDF y Word).
#
# OPT-IN: los instrumentos son material de cliente y viven fuera del repo. El
# corpus lo arma `api/scripts/corpus_instrumentos.R` en la carpeta que apunte
# `PULSO_CORPUS_DIR` (manifiesto.csv + pulso/<familia>.pulso). Sin esa variable
# —el CI— los tests del corpus hacen skip(); los de la herramienta corren igual
# porque solo usan fixtures sinteticos.
#
#   PULSO_CORPUS_DIR=~/Documents/Pulso/90_Pruebas/corpus_instrumentos \
#   [PULSO_CORPUS_SOLO=familia1,familia2] \
#   Rscript -e 'pkgload::load_all("api"); testthat::test_file("api/tests/testthat/test-corpus-instrumentos.R")'
#
# Grano: instrumento canonico x modo (pdf|docx x columnas 1|2|auto).

.cp_fixture <- function(label = "¿Cuál es tu edad?") {
  list(
    survey = data.frame(type = c("begin_group", "integer", "select_one sn", "end_group"),
                        name = c("g1", "edad", "trabaja", ""),
                        label = c("Datos", label, "¿Trabajas?", ""),
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = c("sn", "sn"), name = c("1", "2"), label = c("Sí", "No"),
                         stringsAsFactors = FALSE),
    settings = data.frame(form_title = "Corpus sintetico", form_id = "cs", version = "1",
                          default_language = "es", stringsAsFactors = FALSE),
    paper = .xlsform_editor_empty_df(.xlsform_editor_default_columns("paper"))
  )
}

test_that("la huella ignora espacios y cambia con una etiqueta", {
  a <- .cp_fixture()
  b <- .cp_fixture(label = "  ¿Cuál   es tu edad? ")
  c <- .cp_fixture(label = "¿Qué edad tienes?")
  expect_identical(.corpus_huella(a), .corpus_huella(b))
  expect_false(identical(.corpus_huella(a), .corpus_huella(c)))
  expect_identical(.corpus_jaccard(.corpus_nombres(a), .corpus_nombres(c)), 1)
})

test_that("el detector de marcado literal ve etiquetas, ** y # (auto-verificacion)", {
  expect_length(.corpus_marcado_literal("Texto limpio de 5 a 10"), 0L)
  expect_true(any(startsWith(.corpus_marcado_literal("Hola <b>mundo</b>"), "etiqueta")))
  expect_true(any(startsWith(.corpus_marcado_literal("muy **importante**"), "asteriscos")))
  expect_true(any(startsWith(.corpus_marcado_literal("###### Encabezado"), "almohadilla")))
  # Una desigualdad no es una etiqueta.
  expect_length(.corpus_marcado_literal("si edad < 18 o > 65"), 0L)
})

test_that("el .pulso del corpus se arma con la coleccion del editor y load_pulso lo abre", {
  fx <- .cp_fixture()
  dest <- tempfile(fileext = ".pulso")
  on.exit(unlink(dest), add = TRUE)
  r <- .corpus_construir_pulso(list(list(sheets = fx, original_name = "sintetico.xlsx")), dest, "sintetico")
  expect_true(file.exists(dest))
  ab <- .corpus_abrir_pulso(dest)
  on.exit(session_delete(ab$sid), add = TRUE)
  expect_length(ab$forms, 1L)
  expect_identical(ab$forms[[1]]$name, "Corpus sintetico")
  # El instrumento viaja intacto: misma huella al reabrir.
  expect_identical(.corpus_huella(.corpus_frames_de_workbook(ab$forms[[1]]$workbook)), .corpus_huella(fx))
  expect_error(.corpus_construir_pulso(rep(list(list(sheets = fx, original_name = "x.xlsx")),
                                           .XLSFORM_FORMS_MAX + 1L), dest, "x"), "tope")
})

test_that("los invariantes pasan sobre un instrumento sintetico y el de Word ve una fuente ajena", {
  skip_if_not(nzchar(Sys.which("pdftotext")) && nzchar(Sys.which("pdffonts")) && nzchar(Sys.which("pdfinfo")))
  skip_if_not_installed("officer")
  fx <- .cp_fixture()
  pdf <- tempfile(fileext = ".pdf"); docx <- tempfile(fileext = ".docx")
  on.exit(unlink(c(pdf, docx)), add = TRUE)
  fp <- .corpus_correr_modo(fx, "pdf", "2", pdf, "sintetico")
  expect_true(.corpus_fila_conforme(fp), info = paste(names(fp), unlist(fp), collapse = "; "))
  fw <- .corpus_correr_modo(fx, "docx", "auto", docx, "sintetico")
  expect_true(.corpus_fila_conforme(fw), info = paste(names(fw), unlist(fw), collapse = "; "))

  # Rojo fabricado: un run en Calibri dentro del cuerpo tiene que caer.
  d <- tempfile("cp_docx_"); dir.create(d); on.exit(unlink(d, recursive = TRUE), add = TRUE)
  utils::unzip(docx, exdir = d)
  f <- file.path(d, "word", "document.xml")
  x <- readLines(f, warn = FALSE, encoding = "UTF-8")
  x <- sub('w:ascii="Arial Narrow"', 'w:ascii="Calibri"', x)
  writeLines(x, f, useBytes = TRUE)
  roto <- tempfile(fileext = ".docx"); on.exit(unlink(roto), add = TRUE)
  old <- setwd(d); on.exit(setwd(old), add = TRUE)
  utils::zip(roto, list.files(".", recursive = TRUE, all.files = TRUE), flags = "-qr9X")
  setwd(old)
  inv <- .corpus_invariantes_docx(roto)
  expect_false(inv$fuente_ok)
  expect_match(inv$fuentes, "Calibri")
})

# --- El corpus real (opt-in) --------------------------------------------------

.cp_dir <- function() {
  d <- path.expand(Sys.getenv("PULSO_CORPUS_DIR", ""))
  skip_if(!nzchar(d), "PULSO_CORPUS_DIR no definido: corpus de cliente fuera del repo")
  skip_if_not(file.exists(file.path(d, "manifiesto.csv")), "PULSO_CORPUS_DIR sin manifiesto.csv")
  d
}

test_that("corpus real: cada .pulso abre con load_pulso y trae sus instrumentos intactos", {
  d <- .cp_dir()
  man <- utils::read.csv(file.path(d, "manifiesto.csv"), stringsAsFactors = FALSE, encoding = "UTF-8")
  solo <- strsplit(Sys.getenv("PULSO_CORPUS_SOLO", ""), ",", fixed = TRUE)[[1]]
  if (length(solo)) man <- man[man$pulso %in% solo | man$familia %in% solo, , drop = FALSE]
  expect_gt(nrow(man), 0L)
  for (p in unique(man$pulso)) {
    ruta <- file.path(d, "pulso", paste0(p, ".pulso"))
    expect_true(file.exists(ruta), info = p)
    ab <- .corpus_abrir_pulso(ruta)
    h <- vapply(ab$forms, function(f) .corpus_huella(.corpus_frames_de_workbook(f$workbook)), character(1))
    session_delete(ab$sid)
    expect_lte(length(h), .XLSFORM_FORMS_MAX)
    expect_setequal(h, man$huella[man$pulso == p])
  }
})

test_that("corpus real: PDF y Word no fallan y cumplen sus invariantes en los 6 modos", {
  d <- .cp_dir()
  skip_if_not(nzchar(Sys.which("pdftotext")) && nzchar(Sys.which("pdffonts")) && nzchar(Sys.which("pdfinfo")))
  man <- utils::read.csv(file.path(d, "manifiesto.csv"), stringsAsFactors = FALSE, encoding = "UTF-8")
  solo <- strsplit(Sys.getenv("PULSO_CORPUS_SOLO", ""), ",", fixed = TRUE)[[1]]
  if (length(solo)) man <- man[man$pulso %in% solo | man$familia %in% solo, , drop = FALSE]
  out <- tempfile("corpus_test_"); dir.create(out)
  on.exit(unlink(out, recursive = TRUE), add = TRUE)
  for (p in unique(man$pulso)) {
    ab <- .corpus_abrir_pulso(file.path(d, "pulso", paste0(p, ".pulso")))
    for (f in ab$forms) {
      frames <- .corpus_frames_de_workbook(f$workbook)
      fila_man <- man[man$huella == .corpus_huella(frames), , drop = FALSE][1, ]
      for (k in seq_len(nrow(.CORPUS_MODOS))) {
        fmt <- .CORPUS_MODOS$formato[k]; cols <- .CORPUS_MODOS$columnas[k]
        art <- file.path(out, sprintf("%s__c%s.%s", fila_man$id, cols, fmt))
        fila <- .corpus_correr_modo(frames, fmt, cols, art, tools::file_path_sans_ext(fila_man$archivo))
        etiqueta <- sprintf("%s [%s c%s]", fila_man$id, fmt, cols)
        expect_true(isTRUE(fila$ok), label = paste(etiqueta, "falla:", fila$error))
        if (!isTRUE(fila$ok)) next
        checks <- if (fmt == "pdf") c("fuente_ok", "marcado_ok", "marco_ok", "pie_ok")
                  else c("xml_ok", "fuente_ok", "escape_ok")
        for (ck in checks) {
          detalle <- switch(ck,
            fuente_ok = if (fmt == "pdf") fila$fuente_ajena else fila$fuentes,
            marcado_ok = fila$marcado, marco_ok = fila$fuera_marco, pie_ok = fila$pie_mal,
            xml_ok = fila$xml_malos, escape_ok = fila$escape)
          expect_true(isTRUE(fila[[ck]]), label = sprintf("%s %s: %s", etiqueta, ck, detalle))
        }
        unlink(art)
      }
    }
    session_delete(ab$sid)
  }
})
