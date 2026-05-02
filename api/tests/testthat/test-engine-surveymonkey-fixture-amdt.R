# Snapshot test contra fixtures reales del estudio AMDT (PUCP).
#
# Los .xlsx golden se generaron con el paquete legacy `prosecnur` desde
# /Users/gonzaloalmendariz/Documents/Pulso/Pruebas_Prosecnur/ y se commitean
# en tests/testthat/fixtures/surveymonkey/golden/. Los .sav crudos NO se
# incluyen en el repo: el test los busca en PROSECNUR_SM_FIXTURES_DIR (default
# a la ruta local del autor) y se salta si no están disponibles. Sirve a la vez
# como verificación de paridad fork ↔ legacy y como baseline anti-regresión.

.amdt_fixtures_dir <- function() {
  Sys.getenv(
    "PROSECNUR_SM_FIXTURES_DIR",
    unset = "/Users/gonzaloalmendariz/Documents/Pulso/Pruebas_Prosecnur"
  )
}

.amdt_golden_dir <- function() {
  testthat::test_path("fixtures", "surveymonkey", "golden")
}

.amdt_cases <- list(
  # Convención P{n}_{m} (datos AMDT/PUCP, sin padding)
  list(sav = "Administrativo_AMDT.sav", xlsx = "Administrativo_inst.xlsx"),
  list(sav = "Docentes_AMDT.sav",       xlsx = "Docentes_inst.xlsx"),
  list(sav = "Estudiantes_AMDT.sav",    xlsx = "Estudiantes_inst.xlsx"),
  # Convención q{NNNN}_{NNNN} (4 dígitos con padding) — agregados al detectar
  # que el traductor original perdía silenciosamente las multi/batteries de
  # estos exports.
  list(sav = "Acreditación Ingeniería Civil - Encuesta Egresados.sav", xlsx = "ingcivil_inst.xlsx"),
  list(sav = "Acreditación Derecho PUCP - Egresados.sav",              xlsx = "derecho_inst.xlsx"),
  list(sav = "Encuesta a representantes directivos de empresas certificadas en igualdad de género en Chile.sav",
       xlsx = "igualdad_inst.xlsx")
)

# Comparación robusta a tipos: el round-trip por openxlsx::write.xlsx +
# readxl::read_excel coerce todo a character/numeric según celda. Pasamos
# ambos lados por el mismo molde antes de comparar.
.amdt_normalize <- function(df) {
  if (is.null(df)) return(df)
  df <- as.data.frame(df, stringsAsFactors = FALSE)
  df[] <- lapply(df, function(col) {
    if (is.logical(col)) return(as.character(col))
    as.character(col)
  })
  df[is.na(df) | df == "NA"] <- NA_character_
  df
}

test_that("traductor SurveyMonkey reproduce los XLSForm golden de AMDT", {
  fixtures_dir <- .amdt_fixtures_dir()
  golden_dir <- .amdt_golden_dir()

  for (case in .amdt_cases) {
    sav_path <- file.path(fixtures_dir, case$sav)
    xlsx_path <- file.path(golden_dir, case$xlsx)

    testthat::skip_if_not(
      file.exists(sav_path),
      sprintf("Falta fixture .sav '%s' (set PROSECNUR_SM_FIXTURES_DIR)", sav_path)
    )
    testthat::skip_if_not(
      file.exists(xlsx_path),
      sprintf("Falta golden .xlsx '%s'", xlsx_path)
    )

    sm <- surveymonkey_leer(sav_path)
    out <- surveymonkey_xlsform(sm)

    # Importante: leer con openxlsx (no readxl) — readxl::read_excel trimea
    # espacios iniciales silenciosamente y rompería la equivalencia byte-by-byte.
    golden_wb <- openxlsx::loadWorkbook(xlsx_path)

    for (sheet in c("survey", "choices", "settings", "diagnostico")) {
      golden <- as.data.frame(
        openxlsx::readWorkbook(golden_wb, sheet = sheet, colNames = TRUE),
        stringsAsFactors = FALSE
      )
      current <- as.data.frame(out[[sheet]], stringsAsFactors = FALSE)

      # `version` es Sys.Date() — no determinista, descartar.
      if (sheet == "settings") {
        current$version <- NULL
        golden$version <- NULL
      }

      # Mismo set de columnas en el mismo orden.
      expect_identical(
        names(current), names(golden),
        info = sprintf("[%s :: %s] columnas difieren", case$sav, sheet)
      )

      cur_n <- .amdt_normalize(current)
      gld_n <- .amdt_normalize(golden)

      expect_identical(
        nrow(cur_n), nrow(gld_n),
        info = sprintf("[%s :: %s] nfilas %d vs golden %d",
                       case$sav, sheet, nrow(cur_n), nrow(gld_n))
      )

      for (col in names(cur_n)) {
        expect_identical(
          cur_n[[col]], gld_n[[col]],
          info = sprintf("[%s :: %s] columna '%s' difiere", case$sav, sheet, col)
        )
      }
    }
  }
})
