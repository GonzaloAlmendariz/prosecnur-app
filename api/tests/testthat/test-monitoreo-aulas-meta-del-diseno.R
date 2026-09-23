# =============================================================================
# La meta por aula sale de la τ del diseño cuando la calibración no tiene dueño
# =============================================================================
#
# Decisión de Gonzalo del 2026-09-22 sobre CCSS Perfil 2026-II («la del
# diseño»): la meta de sus aulas venía de las curvas embebidas (≈0,66) y el
# estudio declaraba τ = 0,50. Dos paneles vecinos decían +16 y −18.

.mamd_fila <- function(id, fac = "CIENCIAS SOCIALES", level = "7", el = 20,
                       fuente = "calibracion_embebida", periodo = "",
                       rend = 0.69, esperada = NULL) {
  list(classroom_id = id, operational_code = paste("CH", id), label = id,
       faculty = fac, level = level, sample_role = "titular", wave = "M1",
       orden = 1, eligible_n = el,
       expected_valid = esperada %||% round(el * rend, 1),
       efectivas_esperadas = esperada %||% round(el * rend, 1),
       tasa_efectividad_aula = rend, rendimiento_ref = rend,
       efectividad_fuente = fuente, efectividad_periodo = periodo,
       sample_status = "agendada")
}

.mamd_dt <- function(celdas) list(
  schema = "monitoreo_aulas_design_targets_v1", source = "diseno",
  facultades = lapply(names(celdas), function(k) list(
    facultad = k, faculty_key = monitoreo_aulas_eje_key(k), cuota = 10, tau = celdas[[k]]))
)

.mamd_cfg <- function(celdas, eje = NULL) {
  c(list(design_targets = .mamd_dt(celdas)), if (!is.null(eje)) list(eje_cuota = eje))
}

test_that("con el eje en la persona y una τ única, la meta embebida pasa a la del diseño", {
  plan <- list(.mamd_fila("a1", el = 24, rend = 0.69))
  out <- monitoreo_aulas_meta_del_diseno(plan, .mamd_cfg(list("6" = 0.5, "7" = 0.5), "nivel"))
  f <- out[[1]]
  expect_equal(f$expected_valid, 12)
  expect_equal(f$efectivas_esperadas, 12)
  expect_equal(f$tasa_efectividad_aula, 0.5)
  expect_equal(f$efectividad_tau, 0.5)
  expect_identical(f$efectividad_fuente, "tau_global")
  expect_identical(f$efectividad_periodo, "design_targets")
  # Lo que habría pedido la calibración embebida queda como rastro.
  expect_equal(f$rendimiento_ref, 0.69)
})

test_that("una calibración con dueño no se toca: HSVG corre sobre `historico`", {
  plan <- list(.mamd_fila("a1", fac = "DERECHO", el = 30, fuente = "historico", rend = 0.57))
  out <- monitoreo_aulas_meta_del_diseno(plan, .mamd_cfg(list("DERECHO" = 0.568)))
  expect_identical(out, plan)
  # Y una `tau_global` declarada en Cálculo de muestra tampoco.
  plan2 <- list(.mamd_fila("a2", fuente = "tau_global", periodo = "", rend = 0.4))
  expect_identical(monitoreo_aulas_meta_del_diseno(plan2, .mamd_cfg(list("7" = 0.5), "nivel")), plan2)
})

test_that("con τ distintas por nivel no se inventa una mezcla: la fila queda como estaba", {
  plan <- list(.mamd_fila("a1"))
  out <- monitoreo_aulas_meta_del_diseno(plan, .mamd_cfg(list("6" = 0.5, "7" = 0.6), "nivel"))
  expect_identical(out, plan)
})

test_that("con el eje en el aula, cada fila toma la τ de SU facultad, y la que no tiene celda no cambia", {
  plan <- list(.mamd_fila("a1", fac = "Letras", el = 10), .mamd_fila("a2", fac = "Arte", el = 10))
  out <- monitoreo_aulas_meta_del_diseno(plan, .mamd_cfg(list("Letras" = 0.8)))
  expect_equal(out[[1]]$expected_valid, 8)
  expect_identical(out[[2]], plan[[2]])
})

test_that("es idempotente, y si el diseño cambia su τ la meta se re-deriva", {
  cfg <- .mamd_cfg(list("7" = 0.5), "nivel")
  una <- monitoreo_aulas_meta_del_diseno(list(.mamd_fila("a1", el = 20)), cfg)
  expect_identical(monitoreo_aulas_meta_del_diseno(una, cfg), una)
  otra <- monitoreo_aulas_meta_del_diseno(una, .mamd_cfg(list("7" = 0.6), "nivel"))
  expect_equal(otra[[1]]$expected_valid, 12)
})

test_that("la forma data.frame da lo mismo que la forma lista", {
  plan <- list(.mamd_fila("a1", el = 24), .mamd_fila("a2", el = 11, fuente = "historico"))
  cfg <- .mamd_cfg(list("7" = 0.5), "nivel")
  de_lista <- monitoreo_aulas_meta_del_diseno(plan, cfg)
  df <- as.data.frame(do.call(rbind, lapply(plan, as.data.frame, stringsAsFactors = FALSE)))
  de_df <- monitoreo_aulas_meta_del_diseno(df, cfg)
  expect_equal(de_df$expected_valid, vapply(de_lista, function(f) as.numeric(f$expected_valid), 0))
  expect_identical(de_df$efectividad_fuente, c("tau_global", "historico"))
})

test_that("en el tablero, las esperadas por sexo usan la MISMA τ que el seguimiento", {
  # El caso de CCSS: τ del diseño 0,50 y meta embebida 0,69. Sin la regla,
  # «Cómo le va a cada facultad» medía contra 0,69 y rotulaba «de 50 %».
  plan <- list(c(.mamd_fila("a1", el = 10, rend = 0.69),
                 list(operational_status = "aplicada", sex_top_1 = "Femenino", sex_top_1_n = 6,
                      sex_top_2 = "Masculino", sex_top_2_n = 4)))
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1", plan = plan,
    design_targets = c(.mamd_dt(list("7" = 0.5)), list(selection_run_id = "run_1", frame_hash = "hash_1")),
    eje_cuota = "nivel",
    source_mapping = list(collector_var = "collectorID", sex_var = "sexo")
  ))
  resp <- data.frame(collectorID = rep("a1", 3), sexo = c("Femenino", "Femenino", "Masculino"),
                     stringsAsFactors = FALSE)
  d <- monitoreo_aulas_dashboard(cfg$plan, resp, cfg)
  esperadas <- sum(vapply(d$efectividad_por_sexo, function(c) as.numeric(c$esperadas), 0))
  expect_equal(esperadas, 5)
  prev <- vapply(d$efectividad_por_sexo, function(c) as.numeric(c$tasa_prevista), 0)
  expect_true(all(abs(prev - 0.5) < 1e-9))
})

# --- lo que cazaron el verificador y el revisor metodológico -----------------

test_that("la forma data.frame sobrevive a la normalización: el alias con precedencia también cambia", {
  # `normalize_plan` lee `efectivas_esperadas` ANTES que `expected_valid`: si el
  # alias se quedaba atrás, la meta volvía a la embebida con la fuente diciendo
  # «diseño».
  plan <- list(.mamd_fila("a1", el = 24, rend = 0.69))
  cfg <- .mamd_cfg(list("7" = 0.5), "nivel")
  df <- as.data.frame(do.call(rbind, lapply(plan, as.data.frame, stringsAsFactors = FALSE)))
  out <- monitoreo_aulas_meta_del_diseno(df, cfg)
  expect_equal(out$efectivas_esperadas, out$expected_valid)
  renorm <- monitoreo_aulas_normalize_plan(.monitoreo_aulas_records(out))[[1]]
  expect_equal(renorm$expected_valid, 12)
  expect_equal(renorm$tasa_efectividad_aula, 0.5)
})

test_that("con el eje en la persona, un nivel sin τ no hereda la de sus vecinos", {
  plan <- list(.mamd_fila("a1"))
  dt <- .mamd_dt(list("6" = 0.5, "7" = 0.5, "8" = 0.5))
  dt$facultades[[4]] <- list(facultad = "9", faculty_key = monitoreo_aulas_eje_key("9"), cuota = 10)
  out <- monitoreo_aulas_meta_del_diseno(plan, list(design_targets = dt, eje_cuota = "nivel"))
  expect_identical(out, plan)
})

test_that("una fila sin elegibles legibles conserva lo que traía", {
  plan <- list(.mamd_fila("a1", esperada = 7))
  plan[[1]]$eligible_n <- NA
  expect_identical(monitoreo_aulas_meta_del_diseno(plan, .mamd_cfg(list("7" = 0.5), "nivel")), plan)
})

test_that("las tablas de Avance de la app usan la MISMA meta que el libro", {
  # Lo cazó el revisor metodológico: `monitoreo_aulas_avance_tablas()` leía el
  # plan de la sesión sin la regla, así que la app y el Sheets —que esa función
  # existe para igualar— volvían a enseñar dos metas.
  plan <- list(
    .mamd_fila("A1", fac = "Letras", el = 40, rend = 0.69),
    .mamd_fila("A2", fac = "Derecho", el = 40, rend = 0.69)
  )
  plan[[1]]$operational_code <- "CH 1"; plan[[2]]$operational_code <- "CH 2"
  cfg <- list(aulas_universitarias = list(
    enabled = TRUE, plan = plan,
    design_targets = list(facultades = list(
      list(facultad = "Letras", faculty_key = monitoreo_aulas_eje_key("Letras"), cuota = 60, tau = 0.5),
      list(facultad = "Derecho", faculty_key = monitoreo_aulas_eje_key("Derecho"), cuota = 40, tau = 0.5))),
    source_mapping = list(collector_var = "collectorID")
  ))
  resp <- data.frame(collectorID = c(rep("CH 1", 12), rep("CH 2", 8)),
                     `_submission_time` = "2026-09-07T10:30:00",
                     check.names = FALSE, stringsAsFactors = FALSE)
  sid <- session_create()
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_snapshot", list(data = resp, synced_at = "2026-09-08T19:16:22Z"))
  res <- monitoreo_aulas_avance_tablas(sid)
  # «Rendimiento» lleva la meta por aula: 40 × 0,50 = 20 esperadas y tasa
  # esperada 0,50 con la τ del diseño; 27,6 y 0,69 con la embebida.
  rend <- res$tablas[[which(vapply(res$tablas, function(t) identical(t$clave, "rendimiento"), logical(1)))]]
  cab <- as.character(unlist(rend$cabecera))
  col <- function(nombre) vapply(rend$filas, function(f) as.numeric(f[[match(nombre, cab)]]), 0)
  expect_equal(col("Efectivas esperadas"), c(20, 20))
  expect_equal(col("Tasa de rendimiento de la facultad esperada"), c(0.5, 0.5))
})
