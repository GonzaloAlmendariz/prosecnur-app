# La BBDD entregada sale con las mismas columnas en Excel, SAV y CSV.
#
# El Excel quitaba las columnas internas, las vacías y las «extra» que el
# instrumento no declara (ahí cae la PII de SurveyMonkey: ip_address,
# email_address, first_name, last_name). El SAV, el CSV y el alias legacy
# /analitica/spss sólo quitaban `variables_excluidas`. La entrega de Arte 2026
# (2026-11-04) salió en SAV con el correo y el nombre de 105 docentes y 78
# administrativos, y con la IP de los 479 casos, mientras el Excel de la misma
# corrida venía limpio.

library(testthat)

.pii_inst <- function() {
  structure(
    list(
      survey = data.frame(
        type = c("select_one si_no", "select_one si_no"),
        name = c("q0001", "q0002"),
        label = c("Pregunta 1", "Pregunta 2"),
        stringsAsFactors = FALSE
      ),
      choices = data.frame(list_name = "si_no", name = c("1", "2"), label = c("Sí", "No"),
                           stringsAsFactors = FALSE)
    ),
    class = "prosecnur_instrumento"
  )
}

.pii_data <- function() {
  data.frame(
    CollectorNm   = rep("Web Link 1", 3),
    respondent_id = c("118420001", "118420002", "118420003"),
    collector_id  = rep("4412200", 3),
    date_created  = rep("2026-07-30", 3),
    ip_address    = c("10.0.0.1", "10.0.0.2", "10.0.0.3"),
    email_address = c("a@x.pe", "b@x.pe", "c@x.pe"),
    first_name    = c("Ana", "Beto", "Cira"),
    last_name     = c("", "", ""),
    filtro        = c("1", "1", "1"),
    q0001         = c("1", "2", "1"),
    q0002         = c("2", "2", "1"),
    stringsAsFactors = FALSE
  )
}

test_that("el criterio de columnas de la BBDD deja fuera la PII y lo que el instrumento no declara", {
  fuera <- .analitica_bases_cols_fuera(.pii_data(), .pii_inst(), list(variables_excluidas = list("q0002")))

  expect_true(all(c("ip_address", "email_address", "first_name", "last_name",
                    "CollectorNm", "date_created", "filtro") %in% fuera))
  expect_true("q0002" %in% fuera)                       # la exclusión de la config sigue mandando
  expect_false("q0001" %in% fuera)                      # la variable del instrumento se queda
  expect_false("respondent_id" %in% fuera)              # la llave de caso se conserva por diseño
})

test_that("una extra incluida a mano por el analista vuelve a la BBDD", {
  cfg <- list(variables_extra_incluidas = list("CollectorNm"))
  fuera <- .analitica_bases_cols_fuera(.pii_data(), .pii_inst(), cfg)
  expect_false("CollectorNm" %in% fuera)
  expect_true("email_address" %in% fuera)
})

test_that("los cuatro exportadores de la BBDD usan el mismo criterio de columnas", {
  src <- paste(readLines(test_path("..", "..", "R", "router_analitica.R"), warn = FALSE), collapse = "\n")
  bloques <- strsplit(src, "plumber::pr_(post|get)\\(", perl = TRUE)[[1]]
  for (ruta in c("/api/analitica/bases/xlsx\"", "/api/analitica/bases/sav\"",
                 "/api/analitica/bases/csv\"", "/api/analitica/spss\"")) {
    bloque <- bloques[startsWith(bloques, paste0("\"", ruta))]
    expect_length(bloque, 1L)
    expect_match(bloque, ".analitica_bases_cols_fuera(", fixed = TRUE, info = ruta)
  }
})
