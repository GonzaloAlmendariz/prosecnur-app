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

# --- P7 completo: campos propios de la hoja y preguntas de control vs Kobo ----

sup_respuestas <- function() {
  data.frame(
    `_id` = sprintf("U%03d", 1:20),
    `Intro/Enumerator_name` = c(rep("Op-01", 10), rep("Op-02", 6), rep("Op-03", 3), "Op-04"),
    acepta = "Sí",
    personas = c("4", rep("3", 19)),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

sup_hoja_completa <- function() {
  h <- data.frame(
    N = 1:2,
    Fecha = "22/10/2026",
    `COD.proGres` = "",
    `Código PULSO` = c("SUP-001", "SUP-011"),
    `Nombre del encuestador/a` = c("Op-01", "Op-02"),
    acepta = c("si", "Sí"),
    personas = c("4.0", "5"),
    Telefono_final = c("900000001", "900000002"),
    Observaciones = c("", "Llamar en la tarde"),
    `Responsable de la supervisión` = "Sup-01",
    Status = c("Efectivo", "Efectivo"),
    `Status supervisión` = c("Efectivo", "Efectivo"),
    `Intentos supervisión` = c("1", "2"),
    `Observaciones re barrido` = "",
    `Status final` = c("Conforme", "Conforme"),
    # Columna de otra fuente en el data combinado: vacía en las filas de la hoja.
    `Intro/Enumerator_name` = NA_character_,
    check.names = FALSE, stringsAsFactors = FALSE
  )
  h
}

sup_completo <- function(hoja = sup_hoja_completa(), cfg = list(supervision_n = 20L, supervision_seed = 20260514L)) {
  bloques <- .monitoreo_supervision_estratificada_blocks(sup_efectivas(), cfg, character(0), hoja, sup_respuestas())
  stats::setNames(bloques, vapply(bloques, function(b) b$id, ""))
}

test_that("supervision_casos agrega los campos de la hoja sin quitar los previos", {
  b <- sup_completo()
  expect_identical(unlist(b$supervision_casos$columns), c(
    "N", "CodPulso", "proGres", "Enumerador", "Categoría", "Fecha Kobo", "Response ID", "Resultado", "Status final",
    "Coincide", "Observación", "En hoja", "Supervisor", "Status barrido", "Status supervisión", "Intentos supervisión",
    "Observaciones", "Controles", "Controles coinciden", "Coincide según"
  ))
  casos <- sup_df(b$supervision_casos)
  uno <- casos[casos$CodPulso == "SUP-011", ]
  expect_identical(uno$`En hoja`, "Sí")
  expect_identical(uno$Supervisor, "Sup-01")
  expect_identical(uno$`Status barrido`, "Efectivo")
  expect_identical(uno$`Intentos supervisión`, "2")
  expect_identical(uno$Observaciones, "Llamar en la tarde")
  expect_true(all(casos$`En hoja`[!casos$CodPulso %in% c("SUP-001", "SUP-011")] == "No"))
})

test_that("las preguntas de control se comparan con Kobo por Response ID y mandan sobre el status", {
  b <- sup_completo()
  casos <- sup_df(b$supervision_casos)
  # SUP-001: «si» = «Sí» y «4.0» = «4»: coincide pese a tildes y formato.
  uno <- casos[casos$CodPulso == "SUP-001", ]
  expect_identical(c(uno$Controles, uno$`Controles coinciden`), c(2L, 2L))
  expect_identical(c(uno$Coincide, uno$`Coincide según`), c("Sí", "controles"))
  # SUP-011: la hoja dice «Conforme», pero personas 5 ≠ 3 en Kobo: no coincide.
  once <- casos[casos$CodPulso == "SUP-011", ]
  expect_identical(c(once$Controles, once$`Controles coinciden`), c(2L, 1L))
  expect_identical(once$Coincide, "No")
  ctrl <- sup_df(b$supervision_controles)
  expect_identical(names(ctrl), c("CodPulso", "Pregunta", "Hoja", "Kobo", "Coincide"))
  expect_setequal(unique(ctrl$Pregunta), c("acepta", "personas"))
  expect_identical(ctrl$Kobo[ctrl$CodPulso == "SUP-011" & ctrl$Pregunta == "personas"], "3")
  # Teléfono, Status y los campos propios nunca son pregunta de control.
  resumen <- sup_df(b$supervision_resumen)
  expect_identical(resumen$Valor[resumen$Indicador == "Controles"], "2")
  expect_identical(resumen$Valor[resumen$Indicador == "En hoja"], "2")
})

test_that("sin hoja conectada el estado vacío está declarado en cada bloque", {
  b <- sup_completo(hoja = NULL)
  expect_identical(b$supervision_casos$note, "Sin hoja de supervisión conectada.")
  expect_identical(b$supervision_controles$note, "Sin hoja de supervisión conectada.")
  expect_length(b$supervision_controles$rows, 0L)
  expect_identical(unlist(b$supervision_controles$columns), c("CodPulso", "Pregunta", "Hoja", "Kobo", "Coincide"))
  casos <- sup_df(b$supervision_casos)
  expect_true(all(casos$`En hoja` == "No") && all(casos$`Coincide según` == ""))
})

test_that("el sorteo no altera el generador aleatorio de la sesión", {
  set.seed(1)
  esperado <- stats::runif(1)
  set.seed(1)
  invisible(sup_completo())
  expect_identical(stats::runif(1), esperado)
})

test_that("P5 por persona: grafías que solo cambian tildes o mayúsculas son un estrato; la equivalencia confirmada une", {
  expect_identical(
    .monitoreo_enumerador_persona(c("Silvia Cruz", "silvia  cruz", "Silvia Cruz", "Otro")),
    c("Silvia Cruz", "Silvia Cruz", "Silvia Cruz", "Otro")
  )
  perfil <- list(enumerator_equivalences = list(list(kobo = "op4", hoja = "Op-01")))
  expect_identical(.monitoreo_enumerador_persona(c("OP4", "Op-01"), perfil), c("Op-01", "Op-01"))
})
