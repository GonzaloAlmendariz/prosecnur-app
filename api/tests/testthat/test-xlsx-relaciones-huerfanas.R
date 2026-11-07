# Kobo rechazaba el XLSForm del editor: openxlsx deja en sheetN.xml.rels una
# relación a ../drawings/drawingN.xml que nunca escribe, y openpyxl (pyxform)
# falla con KeyError al seguirla. Ver api/R/xlsx_relaciones_huerfanas.R.

.xlsform_openxlsx_minimo <- function(path) {
  wb <- openxlsx::createWorkbook()
  for (s in c("survey", "choices", "settings")) {
    openxlsx::addWorksheet(wb, s)
    openxlsx::writeData(wb, s, data.frame(type = "text", name = "p1", label = "Pregunta"))
    openxlsx::freezePane(wb, s, firstActiveRow = 2)
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.xlsx_relaciones_rotas <- function(path) {
  entradas <- zip::zip_list(path)$filename
  dir <- tempfile(); dir.create(dir); on.exit(unlink(dir, recursive = TRUE))
  zip::unzip(path, exdir = dir)
  rotas <- character()
  for (rel in entradas[grepl("_rels/[^/]*\\.rels$", entradas)]) {
    xml <- paste(readLines(file.path(dir, rel), warn = FALSE), collapse = "")
    targets <- regmatches(xml, gregexpr("Target=\"[^\"]*\"", xml))[[1]]
    targets <- sub("^Target=\"(.*)\"$", "\\1", targets)
    base <- dirname(dirname(rel))
    for (t in targets) {
      if (grepl("^https?:", t)) next
      d <- if (startsWith(t, "/")) sub("^/", "", t) else
        .xlsx_normalizar_ruta(if (base %in% c(".", "")) t else file.path(base, t))
      if (!d %in% entradas) rotas <- c(rotas, d)
    }
  }
  rotas
}

test_that("openxlsx sigue dejando relaciones a dibujos que no existen (premisa)", {
  path <- .xlsform_openxlsx_minimo(tempfile(fileext = ".xlsx"))
  on.exit(unlink(path))
  # Si una versión futura de openxlsx lo corrige, este test avisa y el saneo
  # sigue siendo inocuo.
  skip_if(length(.xlsx_relaciones_rotas(path)) == 0L, "openxlsx ya no deja relaciones huérfanas")
  expect_true(any(grepl("drawings/drawing1.xml", .xlsx_relaciones_rotas(path), fixed = TRUE)))
})

test_that("el saneo deja un xlsx sin relaciones rotas y con los mismos datos", {
  path <- .xlsform_openxlsx_minimo(tempfile(fileext = ".xlsx"))
  on.exit(unlink(path))
  xlsx_quitar_relaciones_huerfanas(path)
  expect_length(.xlsx_relaciones_rotas(path), 0L)
  expect_equal(openxlsx::getSheetNames(path), c("survey", "choices", "settings"))
  survey <- openxlsx::read.xlsx(path, "survey")
  expect_equal(survey$name, "p1")
  expect_equal(survey$label, "Pregunta")
  # Idempotente.
  expect_equal(xlsx_quitar_relaciones_huerfanas(path), 0L)
})

test_that("el xlsx saneado lo abre openpyxl, que es lo que usa Kobo", {
  py <- Sys.which("python3")
  skip_if(!nzchar(py), "sin python3")
  ok <- system2(py, c("-I", "-c", shQuote("import openpyxl")), stdout = FALSE, stderr = FALSE)
  skip_if(ok != 0L, "sin openpyxl")
  path <- .xlsform_openxlsx_minimo(tempfile(fileext = ".xlsx"))
  on.exit(unlink(path))
  xlsx_quitar_relaciones_huerfanas(path)
  st <- system2(py, c("-I", "-c", shQuote(sprintf("import openpyxl; openpyxl.load_workbook(%s)", shQuote(path, "sh")))),
                stdout = TRUE, stderr = TRUE)
  expect_null(attr(st, "status"), info = paste(st, collapse = "\n"))
})
