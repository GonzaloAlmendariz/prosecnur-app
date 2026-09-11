# =============================================================================
# El modelo del PDF de avance de aulas
# =============================================================================
#
# Tercera de las tres formas que pidió Gonzalo. Lo que estas pruebas sujetan es
# que el modelo NO decida el contenido por su cuenta —lo toma de la misma
# función que escribe la hoja del libro— y que se niegue a informar cuando no
# hay contra qué medir, en vez de publicar ceros.

.marm_aula <- function(id, fac, code, aplicada = TRUE) {
  list(classroom_id = id, operational_code = code, faculty = fac,
       label = paste("Aula", id), sample_role = "titular", wave = "M1",
       eligible_n = 30, expected_valid = 15,
       operational_status = if (aplicada) "aplicada" else "agendada")
}

.marm_cfg <- function(plan, con_cuotas = TRUE) {
  dt <- if (con_cuotas) list(
    schema = "monitoreo_aulas_design_targets_v1",
    facultades = list(
      list(facultad = "FAC1", faculty_key = .cm_criterios_fac_key("FAC1"),
           cuota = 40, cuota_sexo = list(F = 22, M = 18), tau = 0.5),
      list(facultad = "FAC2", faculty_key = .cm_criterios_fac_key("FAC2"),
           cuota = 10, cuota_sexo = list(F = 5, M = 5), tau = 0.5)
    )
  ) else list()
  list(aulas_universitarias = list(
    enabled = TRUE, plan = plan, design_targets = dt,
    source_mapping = list(collector_var = "collectorID")
  ))
}

.marm_snap <- function(ids, sexos = NULL) list(
  data = data.frame(collectorID = ids,
                    sexo = sexos %||% rep(c("Femenino", "Masculino"), length.out = length(ids)),
                    stringsAsFactors = FALSE),
  synced_at = "2026-08-27T10:00:00Z"
)

test_that("sin datos sincronizados no se publica un documento: se dice", {
  cfg <- .marm_cfg(list(.marm_aula("A1", "FAC1", "CH 1")))
  expect_error(build_monitoreo_aulas_report_model(NULL, cfg), class = "api_error")
  expect_error(build_monitoreo_aulas_report_model(list(data = data.frame()), cfg),
               class = "api_error")
})

test_that("sin cuota del diseño el reporte se niega en vez de publicar ceros", {
  # Un documento a cliente con ceros se leería como medido. La cuota es el
  # denominador (ADR 0079): sin ella no hay avance que afirmar.
  plan <- list(.marm_aula("A1", "FAC1", "CH 1"))
  cfg <- .marm_cfg(plan, con_cuotas = FALSE)
  expect_error(build_monitoreo_aulas_report_model(.marm_snap(rep("A1", 5)), cfg),
               class = "api_error")
})

test_that("el contenido sale de la MISMA función que la hoja del libro", {
  plan <- list(.marm_aula("A1", "FAC1", "CH 1"), .marm_aula("B1", "FAC2", "CH 2"))
  cfg <- .marm_cfg(plan)
  snap <- .marm_snap(c(rep("A1", 12), rep("B1", 4)))
  m <- build_monitoreo_aulas_report_model(snap, cfg)

  aulas_cfg <- cfg$aulas_universitarias
  ef <- monitoreo_aulas_efectivas_por_aula(plan, snap$data, aulas_cfg)
  val <- .monitoreo_aulas_valid_response(snap$data, aulas_cfg)
  esperado <- .calaf_avance_por_facultad(plan, efectivas = ef, cuotas = aulas_cfg$design_targets,
                                         responses = snap$data, validas = val, cfg = aulas_cfg)
  # Idéntico, no parecido: si divergieran habría tres tablas del mismo nombre
  # con cifras distintas.
  expect_equal(m$facultades, esperado)
  expect_identical(m$report_kind, "aulas_advance_pdf")
})

test_that("los faltantes del total se SUMAN por facultad, no se netean", {
  # FAC1 se pasa de su cuota y FAC2 se queda corta. Netear diría que falta
  # menos de lo que falta: pasarse en una no cubre lo que falta en otra.
  plan <- list(.marm_aula("A1", "FAC1", "CH 1"), .marm_aula("B1", "FAC2", "CH 2"))
  cfg <- .marm_cfg(plan)
  m <- build_monitoreo_aulas_report_model(.marm_snap(c(rep("A1", 60), rep("B1", 2))), cfg)

  expect_equal(m$total$muestra, 50)         # 40 + 10
  expect_equal(m$total$conseguidas, 62)     # 60 + 2
  # El neto daría 0 —sobra— pero a FAC2 le faltan 8 y eso es lo que se informa.
  expect_equal(m$total$faltan, 8)
  expect_equal(m$total$facultades_abiertas, 1)
})

test_that("el modelo no carga prosa que ya no imprime nadie", {
  # **Contrato anterior, retirado el 2026-09-11.** El modelo llevaba un bloque
  # `criterio` con tres frases —qué cuenta como efectiva, contra qué se mide, qué
  # pasa con la sobremuestra— que se imprimían al pie de la última tabla y luego
  # en una página de cierre. Gonzalo retiró esa página («esta hoja no es
  # necesaria») y con ella el último sitio donde esas frases se veían.
  #
  # Se comprueba su AUSENCIA y no simplemente se borra el test, porque el modelo
  # es lo que viaja al worker del job: texto que nadie imprime ahí no es
  # inofensivo, es una invitación a que el próximo renderizador lo saque «ya que
  # está» y reaparezca la sobreexplicación que él viene podando.
  plan <- list(.marm_aula("A1", "FAC1", "CH 1"))
  m <- build_monitoreo_aulas_report_model(.marm_snap(rep("A1", 5)), .marm_cfg(plan))
  expect_null(m$criterio)

  # Lo que sí viaja son cifras y los defectos de portada, que son datos.
  expect_true(is.list(m$total))
  expect_true(is.list(m$portada_defecto))
})

test_that("las aulas aplicadas viajan; las del plan ya no: Gonzalo cerró la pregunta", {
  # Contrato anterior: `aulas_del_plan` viajaba al lado porque «la pregunta de
  # cuál es el denominador sigue abierta con Gonzalo». El 2026-09-08 dictó las
  # columnas de la tabla y «Aulas del plan» no está entre ellas: la tabla y el
  # modelo dejan de publicarla.
  plan <- list(.marm_aula("A1", "FAC1", "CH 1", aplicada = TRUE),
               .marm_aula("A2", "FAC1", "CH 3", aplicada = FALSE),
               .marm_aula("B1", "FAC2", "CH 2", aplicada = TRUE))
  m <- build_monitoreo_aulas_report_model(.marm_snap(c(rep("A1", 5), rep("B1", 5))), .marm_cfg(plan))
  expect_equal(m$total$aulas_aplicadas, 2)
  expect_null(m$total$aulas_del_plan)
})
