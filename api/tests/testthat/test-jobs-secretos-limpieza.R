# Contrato transversal (ADR 0005): todo job que escribe secretos a jobs/inputs
# con job_save_rds declara on_cleanup, porque on_complete no corre al cancelar,
# fallar o apagar y el RDS de tokens quedaría en disco. Nació de U-B0 (Carga) y
# de monitoreo.sync, que limpiaba solo en on_complete.

test_that("todo job_save_rds de secretos va acompañado de on_cleanup en su job_submit", {
  r_dir <- testthat::test_path("..", "..", "R")
  archivos <- list.files(r_dir, pattern = "\\.R$", full.names = TRUE)
  revisados <- 0L
  for (archivo in archivos) {
    lineas <- readLines(archivo, warn = FALSE, encoding = "UTF-8")
    secretos <- grep("job_save_rds\\(", lineas)
    secretos <- secretos[grepl("token|secret", lineas[secretos], ignore.case = TRUE)]
    for (i in secretos) {
      revisados <- revisados + 1L
      ventana <- lineas[i:min(length(lineas), i + 60L)]
      submit <- grep("job_submit\\(", ventana)
      expect_true(length(submit) > 0L,
                  info = sprintf("%s:%d escribe secretos sin job_submit cercano", basename(archivo), i))
      if (length(submit)) {
        tras_submit <- ventana[submit[1]:length(ventana)]
        expect_true(any(grepl("on_cleanup\\s*=", tras_submit)),
                    info = sprintf("%s:%d escribe secretos y su job_submit no declara on_cleanup", basename(archivo), i))
      }
    }
  }
  # El contrato no es vacío: hoy hay al menos Carga y Monitoreo.
  expect_gte(revisados, 2L)
})
