# Contrato de la supervisión estratificada del telefónico (T9; P5–P7 de
# procedimientos-respondidos.md). Fixture sintético: enumeradores «Op-0N»,
# códigos SUP-0xx y una hoja de supervisión con las columnas de
# «Supervisión_Ronda3» y valores inventados. Sin red, sin reloj, sin rutas.

sup_efectivas <- function() {
  # Op-01 10 efectivas, Op-02 6, Op-03 3, Op-04 1: 20 en total.
  enum <- c(rep("Op-01", 10), rep("Op-02", 6), rep("Op-03", 3), "Op-04")
  data.frame(
    CodPulso = sprintf("SUP-%03d", seq_along(enum)),
    Actor = rep(c("Norte", "Sur"), length.out = length(enum)),
    `Responsable plataforma` = enum,
    `Fecha Kobo` = "2026-10-21",
    `Response ID` = sprintf("U%03d", seq_along(enum)),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

sup_hoja <- function() {
  data.frame(
    N = 1:3,
    `Código PULSO` = c("SUP-001", "SUP-011", ""),
    `COD.proGres` = c("", "", "XYZ-26-900020"),
    `Nombre del encuestador/a` = c("Op-01", "Op-02", "Op-04"),
    `¿Acepta continuar con la encuesta?` = c("Sí", "Sí", "Sí"),
    `Responsable de la supervisión` = "Sup-01",
    `Status supervisión` = c("Efectivo", "Efectivo", "No contesta"),
    `Status final` = c("Conforme", "No coincide", ""),
    `Observaciones re barrido` = c("", "Dice que no recibió la tarjeta", ""),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

sup_bloques <- function(n = 8L, hoja = NULL, progres = c(`SUP-020` = "XYZ-26-900020")) {
  bloques <- .monitoreo_supervision_estratificada_blocks(sup_efectivas(), list(supervision_n = n, supervision_seed = 20260514L), progres, hoja)
  stats::setNames(bloques, vapply(bloques, function(b) b$id, ""))
}

sup_df <- function(bloque) do.call(rbind, lapply(bloque$rows, function(r) as.data.frame(r, check.names = FALSE, stringsAsFactors = FALSE)))

test_that("reparto proporcional por mayor resto con al menos uno por enumerador (P5)", {
  efectivas <- c(`Op-01` = 10L, `Op-02` = 6L, `Op-03` = 3L, `Op-04` = 1L)
  # 8 de 20: 4, 2.4, 1.2, 0.4 → 4, 2, 1, 0 y el resto (0.4 empatado) va a quien
  # tiene más efectivas, Op-02; después el mínimo sube a Op-04: 4, 3, 1, 1.
  reparto <- .monitoreo_supervision_reparto(efectivas, 8L)
  expect_identical(reparto, c(`Op-01` = 4L, `Op-02` = 3L, `Op-03` = 1L, `Op-04` = 1L))
  expect_true(all(reparto >= 1L))
  sin_minimo <- .monitoreo_supervision_reparto(efectivas, 4L, minimo = FALSE)
  expect_identical(sum(sin_minimo), 4L)
  con_minimo <- .monitoreo_supervision_reparto(efectivas, 4L)
  expect_true(all(con_minimo >= 1L))
  expect_gt(sum(con_minimo), 4L)
  # Nadie recibe más casos que efectivas.
  expect_true(all(.monitoreo_supervision_reparto(efectivas, 100L) <= efectivas))
})

test_that("la muestra sale de las efectivas, una por CodPulso, y la semilla la repite (P6)", {
  a <- sup_df(sup_bloques()$supervision_casos)
  b <- sup_df(sup_bloques()$supervision_casos)
  expect_identical(a$CodPulso, b$CodPulso)
  expect_true(all(a$CodPulso %in% sup_efectivas()$CodPulso))
  expect_false(anyDuplicated(a$CodPulso) > 0)
  reparto <- sup_df(sup_bloques()$supervision_reparto)
  expect_identical(sum(as.integer(reparto$Casos)), nrow(a))
  expect_identical(as.integer(table(a$Enumerador)[reparto$Enumerador]), as.integer(reparto$Casos))
  resumen <- sup_df(sup_bloques()$supervision_resumen)
  expect_identical(resumen$Valor[resumen$Indicador == "Declarados"], "8")
  expect_identical(resumen$Valor[resumen$Indicador == "Base"], "20")
  expect_identical(resumen$Valor[resumen$Indicador == "Hoja"], "sin_hoja")
})

test_that("el mínimo se marca solo donde la proporción daba cero", {
  reparto <- sup_df(sup_bloques(n = 4L)$supervision_reparto)
  expect_true(as.logical(reparto$`Mínimo`[reparto$Enumerador == "Op-04"]))
  expect_false(as.logical(reparto$`Mínimo`[reparto$Enumerador == "Op-01"]))
})

test_that("la hoja de supervisión se cruza por Código PULSO o proGres (P7), sin hoja dice que no la hay", {
  sin <- sup_df(sup_bloques(n = 20L)$supervision_casos)
  expect_true(all(sin$Resultado == ""))
  con <- sup_df(sup_bloques(n = 20L, hoja = sup_hoja())$supervision_casos)
  expect_identical(con$Resultado[con$CodPulso == "SUP-001"], "Efectivo")
  expect_identical(con$Coincide[con$CodPulso == "SUP-001"], "Sí")
  expect_identical(con$Coincide[con$CodPulso == "SUP-011"], "No")
  expect_identical(con$`Observación`[con$CodPulso == "SUP-011"], "Dice que no recibió la tarjeta")
  # SUP-020 no trae Código PULSO en la hoja: cruza por proGres.
  expect_identical(con$Resultado[con$CodPulso == "SUP-020"], "No contesta")
  expect_identical(con$proGres[con$CodPulso == "SUP-020"], "XYZ-26-900020")
  resumen <- sup_df(sup_bloques(hoja = sup_hoja())$supervision_resumen)
  expect_identical(resumen$Valor[resumen$Indicador == "Hoja"], "conectada")
})

test_that("sin efectivas no hay sorteo ni error", {
  vacio <- .monitoreo_supervision_estratificada_blocks(sup_efectivas()[0, ], list(supervision_n = 5L))
  ids <- vapply(vacio, function(b) b$id, "")
  expect_length(vacio[[match("supervision_casos", ids)]]$rows, 0L)
})
