# B3: asignado (Material) contra observado (Kobo) por UMP. Núcleo puro: la
# lectura de Material y la auditoría de la fase entran ya armadas.

.tap_asig <- function(...) {
  modifyList(list(
    ok = TRUE, sin_fuente = FALSE, stale = FALSE, desactualizada = FALSE, code_format = "PXXX",
    equipo = list(list(codigo = "P844", nombre = "Ana Ruiz"), list(codigo = "P101", nombre = "Luis Paz")),
    asignacion = list(
      list(id_manzana = "M1", label = "UMP 1", role = "titular", codigo = "P844", origen = "explicita"),
      list(id_manzana = "M2", label = "UMP 2", role = "titular", codigo = "P844", origen = "explicita"),
      list(id_manzana = "M3", label = "UMP 3 R", role = "reemplazo", codigo = "P101", origen = "heredada"),
      list(id_manzana = "M4", label = "UMP 4", role = "titular", codigo = "P101", origen = "explicita")
    )
  ), list(...))
}

.tap_audit <- data.frame(
  advance_block_id = c("M1", "M1", "M2", "M2", "M3", "M9", "M1"),
  # «844» y «p844» son P844 una vez limpios: nunca se compara por el texto.
  pulso_code = c("844", "p844", "P844", "P101", "P320", "P101", "P844"),
  stringsAsFactors = FALSE
)

test_that("compara por código limpio y nombra cada lectura", {
  r <- monitoreo_territorial_asignacion_planificada_desde(.tap_audit, .tap_asig(),
                                                          anulado = c(rep(FALSE, 6), TRUE))
  expect_identical(r$estado, "comparable")
  lect <- stats::setNames(vapply(r$por_ump, `[[`, "", "lectura"), vapply(r$por_ump, `[[`, "", "id_manzana"))
  expect_identical(unname(lect[c("M1", "M2", "M3", "M4")]),
                   c("coincide", "coincide_con_otros", "otro_encuestador", "sin_respuestas"))
  m1 <- r$por_ump[[1]]
  expect_identical(m1$codigo_planificado, "P844")
  expect_identical(m1$nombre_planificado, "Ana Ruiz")
  # La fila anulada de M1 no cuenta.
  expect_identical(m1$respuestas, 2L)
  expect_identical(r$resumen$sin_planificar, 1L)  # M9 tiene respuestas y nadie la asignó
  expect_identical(r$resumen$coinciden, 1L)
  expect_identical(r$resumen$otro_encuestador, 1L)
  # Un reemplazo conserva que su código vino heredado del titular.
  expect_identical(r$por_ump[[3]]$origen, "heredada")
})

test_that("no compara contra otra muestra: desactualizada o foto vencida", {
  a <- monitoreo_territorial_asignacion_planificada_desde(.tap_audit, .tap_asig(desactualizada = TRUE))
  expect_identical(a$estado, "otra_muestra")
  expect_match(a$motivo, "asignación de otra muestra")
  expect_length(a$por_ump, 0L)
  b <- monitoreo_territorial_asignacion_planificada_desde(.tap_audit, .tap_asig(stale = TRUE))
  expect_identical(b$estado, "otra_muestra")
})

test_that("sin campaña, sin envío o sin asignación se dice con su estado", {
  expect_identical(monitoreo_territorial_asignacion_planificada_desde(.tap_audit, NULL)$estado, "sin_campana")
  expect_identical(monitoreo_territorial_asignacion_planificada_desde(.tap_audit, .tap_asig(sin_fuente = TRUE))$estado, "sin_envio")
  vacia <- .tap_asig(); vacia$asignacion <- list()
  expect_identical(monitoreo_territorial_asignacion_planificada_desde(.tap_audit, vacia)$estado, "sin_asignacion")
})

test_that("no viaja DNI: el equipo sólo aporta código y nombre", {
  r <- monitoreo_territorial_asignacion_planificada_desde(.tap_audit, .tap_asig())
  expect_false(any(grepl("dni", names(unlist(r)), ignore.case = TRUE)))
})

test_that("C7: el Estado declarado por campo viaja por UMP y contrasta con Kobo sin entrar al avance", {
  estados <- list(stale = FALSE, desactualizada = FALSE, unidades = list(
    list(id_manzana = "M1", estado_declarado = "Pendiente", fecha_salida = "2026-10-01", fecha_entrega = ""),
    list(id_manzana = "M4", estado_declarado = "Finalizada", fecha_salida = "2026-10-01", fecha_entrega = "2026-10-02")
  ))
  r <- monitoreo_territorial_asignacion_planificada_desde(.tap_audit, .tap_asig(), estados = estados)
  por <- stats::setNames(r$por_ump, vapply(r$por_ump, `[[`, "", "id_manzana"))
  expect_identical(por$M1$estado_declarado, "Pendiente")
  expect_identical(por$M1$contraste, "pendiente_con_respuestas")
  expect_identical(por$M4$contraste, "finalizada_sin_respuestas")
  expect_identical(por$M4$fecha_entrega, "2026-10-02")
  expect_identical(r$resumen$contrastes, 2L)
  # Con el estado de otra muestra no se usa.
  otro <- monitoreo_territorial_asignacion_planificada_desde(.tap_audit, .tap_asig(),
    estados = modifyList(estados, list(stale = TRUE)))
  expect_identical(otro$resumen$con_estado_declarado, 0L)
})

test_that("P2: las efectivas que campo transcribe del consolidado se cruzan con las válidas de Kobo", {
  audit <- .tap_audit
  audit$advance_valid <- c(TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE)
  estados <- list(stale = FALSE, desactualizada = FALSE,
    codigos = list(list(codigo = "8", grupo = "efectiva"), list(codigo = "1", grupo = "no_aplicada")),
    unidades = list(
      list(id_manzana = "M1", estado_declarado = "Finalizada", conteos = list(`8` = 2L, `1` = 3L)),
      list(id_manzana = "M2", estado_declarado = "En campo", conteos = list(`8` = 5L)),
      list(id_manzana = "M4", estado_declarado = "Pendiente", conteos = list())
    ))
  r <- monitoreo_territorial_asignacion_planificada_desde(audit, .tap_asig(), anulado = c(rep(FALSE, 6), TRUE), estados = estados)
  por <- stats::setNames(r$por_ump, vapply(r$por_ump, `[[`, "", "id_manzana"))
  expect_identical(c(por$M1$efectivas_declaradas, por$M1$efectivas_kobo), c(2L, 2L))
  # M2: campo dice 5 efectivas; en Kobo hay una válida (la otra no cuenta).
  expect_identical(c(por$M2$efectivas_declaradas, por$M2$efectivas_kobo), c(5L, 1L))
  expect_true(is.na(por$M4$efectivas_declaradas))
  expect_identical(r$resumen$con_conteos, 2L)
  expect_identical(r$resumen$conteos_distintos, 1L)
})

test_that("2h: lo declarado por coordinación va al lado de Kobo, con su diferencia, y nunca se suma", {
  audit <- data.frame(advance_block_id = c("M1", "M1", "M2"), pulso_code = c("P844", "P844", "P844"),
                      advance_valid = c("true", "true", "true"), stringsAsFactors = FALSE)
  estados <- list(
    stale = FALSE, desactualizada = FALSE,
    codigos = list(list(codigo = "8", grupo = "efectiva"), list(codigo = "1", grupo = "no_aplicada")),
    unidades = list(
      # M1: coordinación declara 2 por sexo (1 + 1) y Kobo tiene 2: cuadra.
      list(id_manzana = "M1", efectivas = list(sexo = list(H = 1L, M = 1L), edad = list(`18-29` = 2L)),
           conteos = list(`8` = 2L, `1` = 6L), supervision = list(aprobadas = 2L, no_aprobadas = 0L),
           fecha_visita = "2026-10-20"),
      # M2: declara 3 y Kobo tiene 1: no cuadra.
      list(id_manzana = "M2", efectivas = list(sexo = list(H = 2L, M = 1L)), conteos = list(`8` = 3L, `1` = 1L),
           supervision = list(aprobadas = 1L, no_aprobadas = 1L))
    )
  )
  r <- monitoreo_territorial_asignacion_planificada_desde(audit, .tap_asig(), estados = estados)
  m1 <- r$por_ump[[1]]; m2 <- r$por_ump[[2]]
  # Se suma por sexo, no sexo + edad: la misma encuesta no cuenta dos veces.
  expect_identical(m1$efectivas_coordinacion, 2L)
  expect_identical(m1$diferencia_coordinacion, 0L)
  # 2h parte 2: las dos marginales viajan enteras para el cruce celda por celda.
  expect_identical(m1$efectivas_por_edad, list(`18-29` = 2L))
  expect_identical(m1$efectivas_por_sexo, list(H = 1L, M = 1L))
  expect_length(m2$efectivas_por_edad, 0L)
  expect_identical(m2$diferencia_coordinacion, 2L)
  expect_identical(m1$fecha_visita, "2026-10-20")
  expect_identical(r$resumen$con_registro_coordinacion, 2L)
  expect_identical(r$resumen$coordinacion_distinta, 1L)
  expect_identical(r$resumen$supervision_no_aprobadas, 1L)
  # Por encuestador: el planificado; rendimiento = efectivas Kobo / intentos declarados.
  ana <- Filter(function(e) identical(e$codigo, "P844"), r$por_encuestador)[[1]]
  expect_identical(ana$ump, 2L)
  expect_identical(ana$efectivas_kobo, 3L)
  expect_identical(ana$efectivas_coordinacion, 5L)
  expect_identical(ana$ump_que_no_cuadran, 1L)
  expect_identical(ana$intentos_declarados, 12L)
  expect_equal(ana$rendimiento, round(3 / 12, 4))
  expect_identical(ana$supervision_aprobadas, 3L)
  # Sin registro, NA y no cero.
  luis <- Filter(function(e) identical(e$codigo, "P101"), r$por_encuestador)[[1]]
  expect_true(is.na(luis$efectivas_coordinacion))
  expect_true(is.na(luis$rendimiento))
})
