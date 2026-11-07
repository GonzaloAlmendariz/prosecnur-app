# Descargas unificadas, fase 1 (2026-11-07): cómo entrega el backend un archivo.
#
# Dos defectos del censo de descargas (`docs/qa/censo-descargas-2026-11-07.md`):
#
# 1. La cabecera `Content-Disposition` se armaba a mano con `sprintf()` en diez
#    sitios. Un nombre con tilde («Selección») viajaba sin `filename*`, el
#    navegador lo mutilaba, y un nombre con comillas rompía la cabecera. Varios
#    sitios además dejaban pasar el prefijo interno `<uuid>__` del job. Ahora
#    todo pasa por `.content_disposition(modo, filename)` (api/R/helpers_descarga.R).
# 2. El paquete de evidencia de Monitoreo escribía en
#    `file.path("tmp", "qa", "monitoreo-deliverables")`: relativo al cwd del
#    proceso R, que en la app de escritorio no es el repo ni una carpeta del
#    usuario.

.dce_cd <- function() {
  # Si el helper no existe, el rojo dice qué falta, no «could not find function».
  ns <- asNamespace("prosecnurapp")
  if (!exists(".content_disposition", envir = ns, inherits = FALSE)) {
    stop("falta la interfaz: .content_disposition(modo, filename) no existe en api/R/helpers_descarga.R",
         call. = FALSE)
  }
  get(".content_disposition", envir = ns, inherits = FALSE)
}

.DCE_UUID <- "0b6f3c1e-1234-4abc-8def-0123456789ab"

.dce_archivos_r <- function() {
  list.files(testthat::test_path("..", "..", "R"), pattern = "[.]R$", full.names = TRUE)
}

.dce_codigo <- function(f) {
  lineas <- readLines(f, warn = FALSE, encoding = "UTF-8")
  # Sólo se descartan las líneas que son comentario entero: un `#` dentro de un
  # string no debe cortar el código.
  lineas[grepl("^\\s*#", lineas)] <- ""
  paste(lineas, collapse = "\n")
}

# Cada `setHeader("Content-Disposition", <valor>)` cuyo valor no empieza por
# `.content_disposition(`. Lee la llamada entera aunque parta en dos líneas.
.dce_cabeceras_a_mano <- function(textos) {
  unlist(lapply(names(textos), function(nombre) {
    texto <- textos[[nombre]]
    m <- gregexpr('setHeader\\(\\s*["\']Content-Disposition["\']\\s*,\\s*', texto,
                  perl = TRUE, ignore.case = TRUE)[[1]]
    if (m[1] == -1) return(character(0))
    fin <- m + attr(m, "match.length")
    malas <- vapply(fin, function(i) {
      !startsWith(substr(texto, i, i + 40L), ".content_disposition(")
    }, logical(1))
    lineas <- vapply(m[malas], function(i) {
      lengths(regmatches(substr(texto, 1L, i), gregexpr("\n", substr(texto, 1L, i)))) + 1L
    }, integer(1))
    if (length(lineas)) sprintf("%s:%d", nombre, lineas) else character(0)
  }))
}

.dce_sitios_cabecera <- function(textos) {
  sum(vapply(textos, function(t) {
    m <- gregexpr('setHeader\\(\\s*["\']Content-Disposition["\']', t, perl = TRUE, ignore.case = TRUE)[[1]]
    if (m[1] == -1) 0L else length(m)
  }, integer(1)))
}

.DCE_RUTA_CWD <- 'file\\.path\\(\\s*"tmp"\\s*,\\s*"qa"\\s*,\\s*"monitoreo-deliverables"'

test_that(".content_disposition quita el prefijo del job y da filename ASCII y filename* UTF-8", {
  cd <- .dce_cd()
  nombre <- paste0(.DCE_UUID, "__HSVG2026_Selección_07_11_26.pdf")
  h <- cd("attachment", nombre)
  expect_type(h, "character")
  expect_length(h, 1L)
  expect_true(startsWith(h, "attachment; "), info = h)
  expect_match(h, 'filename="HSVG2026_Seleccion_07_11_26.pdf"', fixed = TRUE)
  expect_match(h, "filename*=UTF-8''HSVG2026_Selecci%C3%B3n_07_11_26.pdf", fixed = TRUE)
  expect_false(grepl(.DCE_UUID, h, fixed = TRUE))
})

test_that(".content_disposition quita también el prefijo `<uuid>_` de un temporal", {
  cd <- .dce_cd()
  h <- cd("attachment", paste0(.DCE_UUID, "_reporte.xlsx"))
  expect_match(h, 'filename="reporte.xlsx"', fixed = TRUE)
  expect_match(h, "filename*=UTF-8''reporte.xlsx", fixed = TRUE)
  expect_false(grepl(.DCE_UUID, h, fixed = TRUE))
})

test_that(".content_disposition respeta inline y cae a attachment con cualquier otro modo", {
  cd <- .dce_cd()
  expect_true(startsWith(cd("inline", "a.pdf"), "inline; filename=\"a.pdf\""))
  expect_true(startsWith(cd("attachment", "a.pdf"), "attachment; filename=\"a.pdf\""))
  expect_true(startsWith(cd("descarga", "a.pdf"), "attachment; "))
  expect_true(startsWith(cd("inline; x=1", "a.pdf"), "attachment; "))
})

test_that("el fallback ASCII no lleva comillas, barras invertidas ni controles", {
  cd <- .dce_cd()
  h <- cd("attachment", "Informe \"final\"\\copia\r\n\tSeñal.pdf")
  fallback <- regmatches(h, regexpr('filename="[^"]*"', h))
  expect_length(fallback, 1L)
  valor <- sub('^filename="(.*)"$', "\\1", fallback)
  expect_false(grepl('["\\\\[:cntrl:]]', valor), info = valor)
  expect_true(stringi::stri_enc_isascii(valor), info = valor)
  expect_match(valor, "Senal.pdf", fixed = TRUE)
  # La cabecera entera es una sola línea: un \r\n en el nombre no parte la respuesta.
  expect_false(grepl("[\r\n]", h))
  # filename* va codificado: ni espacios ni comillas crudas.
  estrella <- sub("^.*filename\\*=UTF-8''", "", h)
  expect_false(grepl('[ "\\\\]', estrella), info = estrella)
})

test_that("ninguna cabecera Content-Disposition del backend se arma a mano", {
  archivos <- .dce_archivos_r()
  expect_gt(length(archivos), 100L)
  textos <- stats::setNames(lapply(archivos, .dce_codigo), basename(archivos))
  # Centinela: el barrido ve las cabeceras que hay.
  expect_gt(.dce_sitios_cabecera(textos), 0L)
  expect_identical(.dce_cabeceras_a_mano(textos), character(0))
})

test_that("ningún archivo del backend escribe la evidencia de Monitoreo relativa al cwd", {
  archivos <- .dce_archivos_r()
  expect_gt(length(archivos), 100L)
  culpables <- unlist(lapply(archivos, function(f) {
    lineas <- readLines(f, warn = FALSE, encoding = "UTF-8")
    hits <- grep(.DCE_RUTA_CWD, lineas, perl = TRUE)
    if (length(hits)) sprintf("%s:%d", basename(f), hits) else character(0)
  }))
  expect_identical(culpables, character(0))
})

test_that("los detectores ven la cabecera a mano en una o dos líneas y aceptan el helper", {
  textos <- list(
    "a.R" = 'res$setHeader("Content-Disposition", sprintf(\'attachment; filename="%s"\', x))',
    "b.R" = 'x <- 1\nres$setHeader("Content-Disposition",\n              sprintf(\'%s; filename="%s"\', modo, f))',
    "c.R" = 'res$setHeader("Content-Disposition", .content_disposition(modo, f))',
    "d.R" = 'res$setHeader("Content-Disposition",\n  .content_disposition("inline", f))',
    "e.R" = 'res$setHeader("Content-Type", "application/pdf")'
  )
  expect_identical(.dce_cabeceras_a_mano(textos), c("a.R:1", "b.R:2"))
  expect_identical(.dce_sitios_cabecera(textos), 4L)
  expect_true(grepl(.DCE_RUTA_CWD, 'out_dir = file.path("tmp", "qa", "monitoreo-deliverables"),', perl = TRUE))
  expect_true(grepl(.DCE_RUTA_CWD, 'file.path( "tmp",  "qa", "monitoreo-deliverables")', perl = TRUE))
  expect_false(grepl(.DCE_RUTA_CWD, 'file.path(tempdir(), "monitoreo-deliverables")', perl = TRUE))
})
