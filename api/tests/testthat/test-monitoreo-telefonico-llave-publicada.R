# El código que se publica por caso del barrido (revamp T9, RMS ficticio).
# Con la llave «Código proGres» y sin CodPulso, `.monitoreo_report_phone_blocks`
# publicaba el id de la fuente («rms_barrido») en todas las filas: Llave decía
# «0 de N cruzan», Respuestas pintaba todo «No cruza» y el proGres de
# Discrepancias colisionaba. Fixture: los constructores de
# test-monitoreo-telefonico-rms.R (códigos CGU-26-9xxxxxx inventados).

# Solo las asignaciones de nivel superior (constructores), no sus test_that.
for (.llp_expr in parse(testthat::test_path("test-monitoreo-telefonico-rms.R"), keep.source = FALSE)) {
  if (is.call(.llp_expr) && identical(.llp_expr[[1]], as.name("<-"))) eval(.llp_expr)
}
rm(.llp_expr)

llp_bloques <- function(esc) {
  b <- .monitoreo_report_phone_blocks(esc$datos, esc$cfg$monitoreo_profile, esc$cfg)
  stats::setNames(b, vapply(b, function(x) x$id, ""))
}

llp_filas <- function(bloque) {
  if (!length(bloque$rows)) return(data.frame())
  do.call(rbind, lapply(bloque$rows, function(r) as.data.frame(r, check.names = FALSE, stringsAsFactors = FALSE)))
}

test_that("la columna de código nunca es un metadato de fuente ni la columna proGres", {
  phone <- data.frame(.source_id = "rms_barrido", `Código proGres` = "CGU-26-9000001", Status = "Efectivo",
                      check.names = FALSE, stringsAsFactors = FALSE)
  expect_identical(.monitoreo_telefonico_columna_codigo(phone), "")
  phone$CodPulso <- "PUL-0001"
  expect_identical(.monitoreo_telefonico_columna_codigo(phone), "CodPulso")
  # «id» no se busca por subcadena: «Valido» no es un código.
  expect_identical(.monitoreo_telefonico_columna_codigo(data.frame(Valido = "si")), "")
  expect_identical(.monitoreo_telefonico_llave_visible("codigo:CGU269000001"), "CGU269000001")
})

test_that("RMS sin CodPulso: cada fila publica su llave, la misma que Kobo, y el cruce es total", {
  bar <- rms_barrido()
  esc <- rms_escenario(bar = bar, resp = rms_respuestas(bar))
  b <- llp_bloques(esc)
  cmp <- llp_filas(b$comparacion_codpulso)
  base <- cmp[cmp$`Estado telefónico` != "Fuera de base", ]
  expect_identical(nrow(base), nrow(bar))
  expect_false(any(base$CodPulso %in% c("rms_barrido", "rms_kobo")))
  expect_identical(length(unique(base$CodPulso)), nrow(bar))
  # Lo que mira Llave y Respuestas: el CodPulso de Kobo, tal cual, en la hoja.
  kobo <- llp_filas(b$control_tiempo_kobo)
  efectivas_en_base <- unique(kobo$CodPulso[kobo$CodPulso %in% base$CodPulso])
  expect_identical(length(efectivas_en_base), 16L)
  expect_identical(sum(kobo$CodPulso %in% base$CodPulso), 16L) # 16 de 17: la huérfana no es de la base
  expect_identical(nrow(kobo), 17L)
  # El avance cruza lo mismo.
  expect_identical(sum(vapply(b$avance_efectivo_dia$rows, function(r) as.integer(r$Efectivas), 1L)), 17L)
})

test_that("RMS sin CodPulso: Discrepancias e Insistencia muestran la llave del caso y un proGres por fila", {
  bar <- rms_barrido()
  # 12 de 16 efectivas con Kobo: 4 «Efectivo» sin Kobo; y un «No contesta» con envío.
  resp <- rms_respuestas(bar, n_cruzan = 12L, n_huerfanas = 0L)
  no_contesta <- bar$`Código proGres`[bar$Status == "No contesta"][[1]]
  resp <- rbind(resp, transform(resp[1, ], `intro/Intro01` = no_contesta, check.names = FALSE))
  b <- llp_bloques(rms_escenario(bar = bar, resp = resp))
  d <- llp_filas(b$discrepancias_telefonicas)
  hoja <- d[d$Sentido == "hoja_sin_kobo", ]
  expect_identical(nrow(hoja), 4L)
  expect_identical(length(unique(hoja$proGres)), 4L)
  expect_true(all(grepl("^CGU-26-9", hoja$proGres)))
  expect_identical(.monitoreo_nombre_clave(hoja$CodPulso), .monitoreo_nombre_clave(hoja$proGres))
  kobo <- d[d$Sentido == "kobo_sin_hoja", ]
  expect_identical(kobo$proGres, no_contesta)
  expect_false(any(d$CodPulso %in% c("rms_barrido", "rms_kobo")))
  cola <- unlist(lapply(b, function(x) if (grepl("cola", x$id)) vapply(x$rows, function(r) as.character(r$CodPulso %||% ""), "") else character(0)))
  expect_false(any(cola %in% c("rms_barrido", "rms_kobo")))
})

test_that("una llave repetida con proGres distintos no presta el proGres de otro caso", {
  phone <- data.frame(`Código proGres` = c("A-1", "B-2", "C-3"), check.names = FALSE, stringsAsFactors = FALSE)
  mapa <- .monitoreo_discrepancias_progres_mapa(phone, c("X", "X", "Y"))
  expect_identical(.monitoreo_discrepancias_progres_de(c("X", "Y", "B2"), mapa), c("", "C-3", ""))
})
