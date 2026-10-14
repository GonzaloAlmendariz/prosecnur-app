source("setup-load-all.R")

# ADR 0096 — el informe compartido se siembra y se propone; ADR 0103 — ya no desde la matriz.
#
#   POST /api/graficos/plan/sugerido {config, scope?}
#     ""|ausente = alcance actual; "consolidado" = informe compartido; otro → 400
#     E_GRAFICOS_PLAN_SCOPE. Consolidado sin hermanas independientes → 409
#     E_GRAFICOS_CONSOLIDADO_NO_APLICA. `fuente = "equivalencias"` → 410
#     E_GRAFICOS_PLAN_EQUIVALENCIAS_RETIRADO (ADR 0103).
#   Respuesta consolidado: { ok, plan, report_scope:"consolidado", fuente:"consolidado",
#     bases_incluidas, bases_excluidas:[{base,actor,motivo}], avisos_equivalencias:[{code,message}], coverage, warnings }
#
# El fixture vive en helper-consolidado-equivalencias.R: tres públicos con
# etiquetas IDÉNTICAS entre sí y sólo dos con release aprobada.

.hcp_codigos <- function(xs) vapply(xs %||% list(), function(x) as.character(x$code %||% ""), character(1))
.hcp_motivos <- function(xs) vapply(xs %||% list(), function(x) as.character(x$motivo %||% ""), character(1))

# ---------------------------------------------------------------------------
# R1 — sólo participan las bases con release aprobada y vigente.
# Mutación que mata: generar recorriendo todas las bases sin filtrar `approved`.
# ---------------------------------------------------------------------------

test_that("R1: una base sin release no aparece en lo propuesto y se reporta", {
  sid <- .hce_setup(aprobadas = c("docentes", "estudiantes"))
  on.exit(session_delete(sid), add = TRUE)
  .hce_declarar(sid)

  out <- .hce_sugerido(sid, config = list())

  expect_true(isTRUE(out$ok))
  expect_identical(out$report_scope, "consolidado")
  expect_identical(out$fuente, "consolidado")
  expect_false(any(startsWith(.hce_refs_plan(out$plan), "administrativos$")))

  excluidas <- out$bases_excluidas %||% list()
  expect_identical(vapply(excluidas, function(x) as.character(x$base), character(1)), "administrativos")
  expect_identical(.hcp_motivos(excluidas), "release_no_aprobada")
  expect_identical(as.character(excluidas[[1]]$actor), "Administrativos")
  expect_setequal(unlist(out$bases_incluidas), c("docentes", "estudiantes"))
  expect_identical(.hcp_codigos(out$avisos_equivalencias), "bases_excluidas")
})

# ---------------------------------------------------------------------------
# R2 — el compartido no lee la config de la base activa y no toca nada.
# Mutación que mata: usar `.graficos_effective_config(sid, config)` en este alcance.
# ---------------------------------------------------------------------------

test_that("R2: scope consolidado no lee ni escribe la config de la base activa", {
  sid <- .hce_setup()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  # La config de la base activa (docentes) excluye dos variables. Si el alcance
  # consolidado la leyera, esas variables desaparecerían de la propuesta.
  s$graficos_config_por_base <- list(docentes = list(
    plan = list(slides = list(list(id = "solo-docentes", tipo = "p_slide_titulo",
                                   payload = list(titulo = "Plan de la base activa")))),
    scope_rules = list(coverage_exclusions = list("estudiantes$q_con", "docentes$p_con"))
  ))
  s$graficos_consolidado_draft <- list(schema = "graficos_consolidado_draft/v1", revision = 4L,
                                       config = list(plan = list(slides = list())))
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  antes <- session_get(sid)

  out <- .hce_sugerido(sid, config = list())
  despues <- session_get(sid)

  refs <- .hce_refs_plan(out$plan)
  expect_true("estudiantes$q_con" %in% refs)
  expect_true("docentes$p_con" %in% refs)
  titulos <- vapply(out$plan$slides, function(x) as.character(x$payload$titulo %||% ""), character(1))
  expect_false("Plan de la base activa" %in% titulos)

  expect_identical(despues$estudio$active_base, antes$estudio$active_base)
  expect_identical(isTRUE(despues$project_dirty), FALSE)
  expect_identical(despues$graficos_config_por_base, antes$graficos_config_por_base)
  expect_identical(despues$graficos_consolidado_draft$revision, 4L)
  expect_identical(despues$graficos_consolidado_draft, antes$graficos_consolidado_draft)
})

# ---------------------------------------------------------------------------
# R3 — sin matriz, ninguna lámina compara dos bases aunque las etiquetas sean
# idénticas (ADR 0062 aplicado por el 0096 decisión 7). ROJO HOY: la heurística
# por etiqueta arma «Comparativo por actor».
# ---------------------------------------------------------------------------

test_that("ADR 0103: con la matriz declarada, la propuesta no arma láminas que comparen públicos", {
  sid <- .hce_setup(aprobadas = names(.HCE_BASES))
  on.exit(session_delete(sid), add = TRUE)
  .hce_declarar(sid)

  out <- .hce_sugerido(sid, config = list())
  preflight <- graficos_consolidado_preflight(sid)

  # Las láminas que comparan públicos las arma el analista en Gráficos: ni la propuesta ni la siembra las derivan.
  expect_length(.hce_laminas_multifuente(out$plan), 0L)
  expect_length(.hce_laminas_multifuente(preflight$plan), 0L)
  expect_false(any(vapply(out$plan$slides, function(x) identical(x$origen %||% "", "equivalencias"), logical(1))))
  # Sigue habiendo propuesta: las láminas por fuente del generador genérico.
  expect_gt(length(out$plan$slides), 0L)
  # Y no hay avisos sobre la matriz: ya no es fuente del plan.
  expect_length(intersect(.hcp_codigos(out$avisos_equivalencias), c("sin_matriz", "matriz_no_disponible")), 0L)
})

test_that("R4: preflight con borrador vacío y /plan/sugerido consolidado dan el mismo plan", {
  sid <- .hce_setup()
  on.exit(session_delete(sid), add = TRUE)
  .hce_declarar(sid)

  sugerido <- .hce_sugerido(sid, config = list())
  preflight <- graficos_consolidado_preflight(sid)

  expect_identical(sugerido$fuente, "consolidado")
  expect_identical(.hce_proyeccion_plan(preflight$plan), .hce_proyeccion_plan(sugerido$plan))
  expect_identical(preflight$n_slides, as.integer(length(sugerido$plan$slides)))
  expect_identical(preflight$equivalencias$origen_plan, "derivado")
})

test_that("R4: con plan autorado el preflight lo respeta y lo informa como autorado", {
  sid <- .hce_setup()
  on.exit(session_delete(sid), add = TRUE)
  .hce_declarar(sid)
  autorado <- list(slides = list(list(id = "a-mano", tipo = "p_slide_titulo",
                                       payload = list(titulo = "Hecho a mano"))))

  preflight <- graficos_consolidado_preflight(sid, config = list(plan = autorado))

  expect_identical(vapply(preflight$plan$slides, function(x) x$id, character(1)), "a-mano")
  expect_identical(preflight$equivalencias$origen_plan, "autorado")
})

test_that("ADR 0103: pedir el plan con la fuente «equivalencias» responde 410 con su motivo", {
  sid <- .hce_setup()
  on.exit(session_delete(sid), add = TRUE)
  .hce_declarar(sid)
  err <- tryCatch(.graficos_plan_sugerido_por_fuente(sid, config = list(fuente = "equivalencias")), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_GRAFICOS_PLAN_EQUIVALENCIAS_RETIRADO")
  expect_identical(as.integer(err$status), 410L)
  # La revisión de la matriz sigue publicándose en Carga, sin las columnas del informe.
  expect_match(.equiv_estado(sid)$revision, "^r3:")
})

# ADR 0103 decisión 5 (E6): ACNUR conserva sus configuraciones activables —su estilo, su plantilla y su plan propio—
# aunque la matriz deje de armar láminas. Mata: retirar el perfil junto con la fuente «equivalencias».
test_that("ADR 0103: el perfil ACNUR sigue activable con su estilo, su plantilla y su plan", {
  expect_true("acnur_kobo_cruncher_plus" %in% names(.PPT_STYLE_PROFILES))
  expect_identical(.PPT_STYLE_PROFILES$acnur_kobo_cruncher_plus$template_id, "acnur_16_9")
  sid <- .hce_setup()
  on.exit(session_delete(sid), add = TRUE)
  .hce_declarar(sid)
  out <- .graficos_plan_sugerido_por_fuente(sid, config = list(profile_id = "acnur_kobo_cruncher_plus"))
  expect_identical(out$profile_id, "acnur_kobo_cruncher_plus")
  expect_identical(out$template_id, "acnur_16_9")
  expect_false(isTRUE(out$auto_otros_slides))
  expect_gt(length(out$plan$slides %||% list()), 0L)
})

# ---------------------------------------------------------------------------
# R11 — scope inválido (400) y consolidado que no aplica (409), por el router.
# ---------------------------------------------------------------------------

.hcp_router_sugerido <- function(sid, body) {
  testthat::local_mocked_bindings(session_header = function(req) sid, .package = "prosecnurapp")
  pr <- mount_graficos(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  ep <- endpoints[[which(vapply(endpoints, function(e) {
    identical(e$path, "/api/graficos/plan/sugerido") && "POST" %in% e$verbs
  }, logical(1)))]]
  req <- new.env(parent = emptyenv())
  req$bodyRaw <- charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
  res <- new.env(parent = emptyenv())
  res$status <- 200L
  res$setHeader <- function(...) invisible(NULL)
  out <- ep$getFunc()(req, res)
  list(status = as.integer(res$status), body = out)
}

.hcp_sesion_multibase <- function() {
  sid <- session_create()
  s <- session_get(sid)
  s$estudio <- list(
    bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
    processing_mode = "multibase", topology_declared = "separate", active_base = "docentes")
  .session_env[[sid]] <- s
  sid
}

test_that("R11: scope desconocido → 400 E_GRAFICOS_PLAN_SCOPE", {
  sid <- .hce_setup()
  on.exit(session_delete(sid), add = TRUE)
  r <- .hcp_router_sugerido(sid, list(config = list(), scope = "global"))
  expect_identical(r$status, 400L)
  expect_identical(r$body$error$code, "E_GRAFICOS_PLAN_SCOPE")
})

test_that("R11: consolidado sin hermanas independientes → 409 E_GRAFICOS_CONSOLIDADO_NO_APLICA", {
  sid <- .hcp_sesion_multibase()
  on.exit(session_delete(sid), add = TRUE)
  r <- .hcp_router_sugerido(sid, list(config = list(), scope = "consolidado"))
  expect_identical(r$status, 409L)
  expect_identical(r$body$error$code, "E_GRAFICOS_CONSOLIDADO_NO_APLICA")
})

test_that("R11: el router lee scope en la raíz del cuerpo y deja intacto el alcance actual", {
  sid <- .hce_setup()
  on.exit(session_delete(sid), add = TRUE)
  .hce_declarar(sid)
  consolidado <- .hcp_router_sugerido(sid, list(config = list(), scope = "consolidado"))
  expect_identical(consolidado$status, 200L)
  expect_identical(consolidado$body$report_scope, "consolidado")
  # `scope` dentro de config no cuenta: el contrato lo pone en la raíz, igual que /plan/coverage.
  dentro <- .hcp_router_sugerido(sid, list(config = list(scope = "consolidado")))
  expect_identical(dentro$status, 200L)
  expect_false(identical(dentro$body$report_scope %||% "", "consolidado"))
  vacio <- .hcp_router_sugerido(sid, list(config = list(), scope = ""))
  expect_identical(vacio$status, 200L)
  expect_false(identical(vacio$body$report_scope %||% "", "consolidado"))
})

test_that("R11: los códigos del plan sugerido están en el registro con su status", {
  reg <- errores_registrados()
  fila <- function(code) reg[reg$codigo == code, , drop = FALSE]
  expect_identical(fila("E_GRAFICOS_PLAN_SCOPE")$status, "400")
  expect_identical(fila("E_GRAFICOS_CONSOLIDADO_NO_APLICA")$status, "409")
  expect_identical(fila("E_GRAFICOS_PLAN_EQUIVALENCIAS_RETIRADO")$status, "410")
})

# ---------------------------------------------------------------------------
# R12 — el plan POR BASE multiactor tampoco trae comparativos por etiqueta.
# PENDIENTE: la decisión 7 del ADR 0096 extiende la retirada al plan por base
# «sujeto a confirmación de Gonzalo». Si se acota al consolidado se borra este test.
#
# Caracterización (2026-10-11, antes del fix):
#   - Este fixture (acreditación + independent_siblings) SÍ pasa por
#     `use_multisource_report` en `.graficos_suggested_plan`, y hoy el plan por base
#     trae 2 láminas «Comparativo por actor» emparejadas por etiqueta.
#   - acrconta_mazo (api/inst/reference_projects) carga como `multibase`, no
#     `independent_siblings`: `.graficos_should_use_multisource_report` da FALSE y su
#     plan por base NO pasa por la heurística, aunque la heurística sobre su
#     cobertura encontraría 4 candidatos (dos baterías distintas rotuladas
#     «Actividades culturales» y dos «Bienestar psicológico»). La verificación en
#     vivo del ADR exige rehacerlo como `independent_siblings` desde sus .sav.
# ---------------------------------------------------------------------------

test_that("R12: el plan por base multiactor no empareja por etiqueta (pendiente)", {
  sid <- .hce_setup(aprobadas = names(.HCE_BASES))
  on.exit(session_delete(sid), add = TRUE)

  # Caracterización que sí corre: el fixture llega a la rama multiactor del plan por base.
  if (exists(".graficos_should_use_multisource_report", mode = "function")) {
    cobertura <- .graficos_plan_coverage(sid, plan = list(slides = list()), config = list(), scoped = FALSE)
    expect_true(.graficos_should_use_multisource_report(sid, cobertura))
  }


  plan <- .graficos_suggested_plan(sid, config = list())$plan
  expect_length(.hce_laminas_multifuente(plan), 0L)
  titulos <- vapply(plan$slides %||% list(), function(x) as.character(x$payload$titulo %||% ""), character(1))
  expect_false(any(grepl("Comparativo por actor", titulos, fixed = TRUE)))
  expect_false(exists(".graficos_multisource_comparison_candidates", mode = "function"))
  expect_false(exists(".graficos_multisource_comparison_slides", mode = "function"))
})
