# Monitoreo › Avance › Cuotas (T2): metas por categoría con la categoría de la
# base y la efectiva del cruce por token. Contrato:
# docs/qa/checklist-monitoreo-cuotas-y-revamp-correo-2026-10-22.md.

.mcut_data <- function() {
  # Docentes Campus con la distribución real de dedicación (1939/631/29), más
  # una persona sin dato y un público sin la columna.
  ded <- c(rep("TPA", 1939), rep("DTC", 631), rep("TPC20", 29), "")
  n <- length(ded)
  tok <- sprintf("d%05d", seq_len(n))
  doc <- data.frame(Token = tok, Dedicación = ded, Sexo = rep(c("M", "F"), length.out = n),
                    .source_role = "universo", dim_actor = "Docentes Campus", check.names = FALSE, stringsAsFactors = FALSE)
  adm <- data.frame(Token = sprintf("a%03d", 1:5), Dedicación = NA, Sexo = "F",
                    .source_role = "universo", dim_actor = "Administrativos", check.names = FALSE, stringsAsFactors = FALSE)
  resp <- data.frame(Token = "", Dedicación = NA, Sexo = NA, .source_role = "respuestas", dim_actor = "Docentes Campus",
                     check.names = FALSE, stringsAsFactors = FALSE)
  rbind(doc, adm, resp)
}

.mcut_rollup <- function(tokens_efectivos) {
  lapply(tokens_efectivos, function(t) list(actor = "Docentes Campus", case_key = .monitoreo_code_keys(t)[1], counts_in_advance = TRUE))
}

test_that("la propuesta replica la hoja «Metas de encuestas»: personas × cobertura, hacia arriba", {
  u <- monitoreo_cuotas_universo(.mcut_data(), list("Token"))
  expect_identical(u$columna_llave, "Token")
  pr <- monitoreo_cuotas_proponer(u, "Docentes Campus", "Dedicación", cobertura = 0.312)
  metas <- stats::setNames(vapply(pr$categorias, function(c) c$meta, 1L), vapply(pr$categorias, function(c) c$categoria, ""))
  expect_identical(metas[c("TPA", "DTC", "TPC20")], c(TPA = 605L, DTC = 197L, TPC20 = 10L))
  # «Sin dato» va al final y sin meta.
  expect_identical(names(metas)[length(metas)], "Sin dato")
  expect_identical(unname(metas[["Sin dato"]]), 0L)
  # Sin cobertura, sale de la meta del público sobre su universo.
  pr2 <- monitoreo_cuotas_proponer(u, "Docentes Campus", "Dedicación", meta_publico = 811L)
  expect_equal(pr2$cobertura, 811 / 2600)
  expect_error(monitoreo_cuotas_proponer(u, "Docentes Campus", "No existe"), "variable")
})

test_that("las efectivas se cuentan por la categoría de la base, cruzando por token", {
  u <- monitoreo_cuotas_universo(.mcut_data(), list("Token"))
  efectivos <- c(sprintf("d%05d", 1:700), sprintf("d%05d", 1940:2000), "d02599")  # 700 TPA, 61 DTC, 1 TPC20
  cuotas <- list(list(id = "q1", actor = "Docentes Campus", variable = "Dedicación", cobertura = 0.312,
                      metas = list(TPA = 605L, DTC = 197L, TPC20 = 10L)))
  m <- monitoreo_cuotas_modelo(u, .mcut_rollup(efectivos), cuotas, list(`Docentes Campus` = 811L))
  q <- m$cuotas[[1]]
  cats <- stats::setNames(q$categorias, vapply(q$categorias, function(c) c$categoria, ""))
  expect_identical(cats$TPA$efectivas, 700L)
  expect_identical(cats$TPA$estado, "cumplida")
  expect_identical(cats$TPA$falta, 0L)
  expect_identical(cats$DTC$efectivas, 61L)
  expect_identical(cats$DTC$estado, "en_curso")
  expect_identical(cats$TPC20$estado, "en_curso")
  expect_identical(cats$`Sin dato`$estado, "sin_meta")
  expect_identical(q$meta, 812L)
  expect_identical(q$categorias_cumplidas, 1L)
  expect_identical(q$categorias_total, 3L)
  expect_identical(q$sin_dato, 1L)
  # Públicos con su meta y las variables usables como cuota (sin la llave).
  doc <- Filter(function(p) identical(p$actor, "Docentes Campus"), m$publicos)[[1]]
  expect_identical(doc$efectivas, 762L)
  expect_identical(doc$meta, 811L)
  expect_setequal(vapply(doc$variables, function(v) v$variable, ""), c("Dedicación", "Sexo"))
})

test_that("una cuota cuya variable no está en la base se avisa y no rompe", {
  u <- monitoreo_cuotas_universo(.mcut_data(), list("Token"))
  m <- monitoreo_cuotas_modelo(u, list(), list(list(id = "q", actor = "Docentes Campus", variable = "Facultad", metas = list())))
  expect_length(m$cuotas, 0L)
  expect_true(any(grepl("no encuentra esa variable", unlist(m$avisos))))
  vacio <- monitoreo_cuotas_modelo(monitoreo_cuotas_universo(NULL), list(), list())
  expect_true(any(grepl("universo", unlist(vacio$avisos))))
})

test_that("guardar valida la entrada y la configuración vuelve con el estado", {
  sid <- session_create()
  session_set(sid, "monitoreo_snapshot", list(data = .mcut_data(), synced_at = "x"))
  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(key_rules = list(universe_fields = list("Token"))),
                                            goals = list(list(filters = list(actor = "Docentes Campus"), meta = 811L))))
  local_mocked_bindings(.mcm_case_rollup = function(sid) .mcut_rollup("d00001"))
  expect_error(monitoreo_cuotas_guardar(sid, list(list(actor = "", variable = "x"))), "público")
  expect_error(monitoreo_cuotas_guardar(sid, list(list(actor = "Docentes Campus", variable = "Dedicación", cobertura = 2))), "proporción")
  e <- monitoreo_cuotas_guardar(sid, list(list(actor = "Docentes Campus", variable = "Dedicación", cobertura = 0.312,
                                                metas = list(TPA = 605, DTC = "197", TPC20 = -3))))
  q <- e$cuotas[[1]]
  expect_true(nzchar(q$id))
  metas <- stats::setNames(vapply(q$categorias, function(c) c$meta, 1L), vapply(q$categorias, function(c) c$categoria, ""))
  expect_identical(unname(metas[c("TPA", "DTC", "TPC20")]), c(605L, 197L, 0L))
  expect_identical(session_get(sid)$monitoreo_cuotas$cuotas[[1]]$metas$DTC, 197L)
  pr <- monitoreo_cuotas_proponer_sesion(sid, "Docentes Campus", "Dedicación")
  expect_equal(pr$cobertura, 811 / 2600)
})

test_that("sin el cruce en caché, Cuotas y Correo responden «preparando» en vez de recalcularlo en la API", {
  sid <- session_create()
  session_set(sid, "monitoreo_snapshot", list(data = .mcut_data(), synced_at = "x"))
  expect_null(.mcm_case_rollup(sid))
  e <- monitoreo_cuotas_estado(sid)
  expect_true(e$preparando)
  expect_length(e$cuotas, 0L)
  local_mocked_bindings(.connections_token_state = function(...) list(token = "", status = list()))
  m <- monitoreo_mailchimp_estado(sid)
  expect_true(m$preparando)
  expect_true(any(grepl("preparando", unlist(m$avisos))))
  # Con el tablero de Consultas en la sesión (lo deja el warmup), responde con datos.
  session_set(sid, "monitoreo_dashboard_cache_queries_summary",
              list(acreditacion_reports = list(internal_queries = list(case_rollup = .mcut_rollup("d00001")))))
  expect_false(monitoreo_cuotas_estado(sid)$preparando)
  # Sin corte de Monitoreo no hay nada que esperar.
  sid2 <- session_create()
  expect_identical(.mcm_case_rollup(sid2), list())
})

test_that("una columna donde cada persona tiene su propio valor es un identificador, no una variable de cuota", {
  # Administrativos de ACRDCONTA: 16 personas, y N°, código, nombres, correo y
  # celular traían 16 «categorías» cada uno; sólo «Área de trabajo» es cuota.
  filas <- data.frame(
    N = as.character(1:16),
    Codigo = sprintf("2019%04d", 1:16),
    email = sprintf("p%02d@pucp.edu.pe", 1:16),
    Celular2 = c(sprintf("9%08d", 1:6), rep("", 10)),
    Area = rep(c("Facultad", "Departamento"), each = 8),
    stringsAsFactors = FALSE
  )
  variables <- vapply(prosecnurapp:::.mcu_variables(filas), `[[`, character(1), "variable")
  expect_identical(variables, "Area")

  # Un celular de reemplazo con un número repetido sigue siendo identificador.
  egresados <- data.frame(
    Celular2 = c(sprintf("9%08d", 1:20), "900000001"),
    Ciclo = rep(c("2019-1", "2019-2", "2020-1"), 7),
    stringsAsFactors = FALSE
  )
  expect_identical(vapply(prosecnurapp:::.mcu_variables(egresados), `[[`, character(1), "variable"), "Ciclo")

  # Un público chico con categorías que no se repiten sigue ofreciéndolas.
  chico <- data.frame(Facultad = c("Letras", "Ciencias", "Derecho"), stringsAsFactors = FALSE)
  expect_identical(vapply(prosecnurapp:::.mcu_variables(chico), `[[`, character(1), "variable"), "Facultad")
})
