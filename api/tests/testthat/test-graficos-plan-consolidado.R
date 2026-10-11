source("setup-load-all.R")

# ADR 0096 — el informe compartido se siembra y se propone desde la matriz.
#
# Contrato congelado (guardian-contratos, 2026-10-11):
#   POST /api/graficos/plan/sugerido {config, scope?}
#     ""|ausente = alcance actual; "consolidado" = informe compartido; otro → 400
#     E_GRAFICOS_PLAN_SCOPE. Consolidado sin hermanas independientes → 409
#     E_GRAFICOS_CONSOLIDADO_NO_APLICA.
#   Respuesta consolidado: { ok, plan, report_scope:"consolidado",
#     fuente:"equivalencias"|"consolidado", contiene_equivalencias, declarada,
#     revision:"r2:…"|"", n_diapositivas, fuera, radar_pendiente, bases_incluidas,
#     bases_excluidas:[{base,actor,motivo}], cobertura_reducida:[{etiqueta,
#     declaradas,incluidas}], avisos_equivalencias:[{code,message}], coverage, warnings }
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

  out <- .hce_sugerido(sid, config = list(fuente = "equivalencias"))

  expect_true(isTRUE(out$ok))
  expect_identical(out$report_scope, "consolidado")
  expect_identical(out$fuente, "equivalencias")
  expect_true(isTRUE(out$contiene_equivalencias))

  # Ninguna referencia a la base sin release, en ninguna lámina.
  refs <- .hce_refs_plan(out$plan)
  expect_gt(length(refs), 0L)
  expect_false(any(startsWith(refs, "administrativos$")))

  # La base fuera se dice, con su motivo.
  excluidas <- out$bases_excluidas %||% list()
  expect_identical(vapply(excluidas, function(x) as.character(x$base), character(1)), "administrativos")
  expect_identical(.hcp_motivos(excluidas), "release_no_aprobada")
  expect_identical(as.character(excluidas[[1]]$actor), "Administrativos")
  expect_setequal(unlist(out$bases_incluidas), c("docentes", "estudiantes"))

  # Fila que se queda con un solo público: a `fuera`, nunca degradada a una
  # lámina de un público.
  fuera_rel <- Filter(function(x) identical(x$motivo, "release_no_aprobada"), out$fuera %||% list())
  expect_identical(vapply(fuera_rel, function(x) as.character(x$etiqueta), character(1)), "Conoce (doc-adm)")
  # Con `fuente = equivalencias` sólo sale el bloque de la matriz: ninguna lámina de un solo público.
  expect_length(Filter(function(r) length(unique(sub("\\$.*$", "", r))) < 2L,
                       .hce_refs_por_lamina(out$plan)), 0L)

  # Fila con tres declarados y dos con release: entra, y se reporta reducida.
  reducida <- Filter(function(x) identical(x$etiqueta, "Satisfaccion"), out$cobertura_reducida %||% list())
  expect_length(reducida, 1L)
  expect_identical(as.integer(reducida[[1]]$declaradas), 3L)
  expect_identical(as.integer(reducida[[1]]$incluidas), 2L)
  expect_true(all(c("docentes$p_sat", "estudiantes$q_sat") %in% refs))

  expect_true(any(.hcp_codigos(out$avisos_equivalencias) %in% c("bases_excluidas", "cobertura_reducida")))
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

test_that("R3: sin matriz la siembra del preflight no trae comparativos por etiqueta", {
  sid <- .hce_setup(aprobadas = names(.HCE_BASES))
  on.exit(session_delete(sid), add = TRUE)

  preflight <- graficos_consolidado_preflight(sid)

  # Medido hoy sobre este fixture: 2 láminas «Comparativo por actor» con
  # docentes/estudiantes/administrativos emparejados por etiqueta.
  expect_length(.hce_laminas_multifuente(preflight$plan), 0L)
  expect_identical(preflight$n_comparison_slides, 0L)
  titulos <- vapply(preflight$plan$slides %||% list(),
                    function(x) as.character(x$payload$titulo %||% ""), character(1))
  expect_false(any(grepl("Comparativo por actor", titulos, fixed = TRUE)))
  # Y lo dice: un compartido sin comparaciones sin explicación se lee como un fallo.
  expect_true("sin_matriz" %in% .hcp_codigos(preflight$equivalencias$avisos))
  expect_false(isTRUE(preflight$equivalencias$declarada))
  expect_false(isTRUE(preflight$equivalencias$contiene_equivalencias))
})

test_that("R3: sin matriz /plan/sugerido consolidado tampoco compara bases y avisa sin_matriz", {
  sid <- .hce_setup(aprobadas = names(.HCE_BASES))
  on.exit(session_delete(sid), add = TRUE)

  out <- .hce_sugerido(sid, config = list())

  expect_identical(out$report_scope, "consolidado")
  expect_identical(out$fuente, "consolidado")
  expect_false(isTRUE(out$contiene_equivalencias))
  expect_false(isTRUE(out$declarada))
  expect_identical(out$revision, "")
  expect_length(.hce_laminas_multifuente(out$plan), 0L)
  expect_true("sin_matriz" %in% .hcp_codigos(out$avisos_equivalencias))
  # Sigue habiendo propuesta: las láminas por fuente del generador genérico.
  expect_gt(length(out$plan$slides), 0L)
})

# ---------------------------------------------------------------------------
# R4 — la siembra es la propuesta compuesta y es la misma que deriva el preflight.
# ---------------------------------------------------------------------------

test_that("R4: preflight con borrador vacío y /plan/sugerido consolidado dan el mismo plan", {
  sid <- .hce_setup()
  on.exit(session_delete(sid), add = TRUE)
  .hce_declarar(sid)

  sugerido <- .hce_sugerido(sid, config = list())
  preflight <- graficos_consolidado_preflight(sid)

  expect_identical(sugerido$fuente, "consolidado")
  expect_true(isTRUE(sugerido$contiene_equivalencias))
  expect_identical(.hce_proyeccion_plan(preflight$plan), .hce_proyeccion_plan(sugerido$plan))
  expect_identical(preflight$n_slides, as.integer(length(sugerido$plan$slides)))

  # El bloque de la matriz entra marcado; las comparaciones salen de ahí.
  origenes <- vapply(preflight$plan$slides, function(x) as.character(x$origen %||% ""), character(1))
  expect_true(any(origenes == "equivalencias"))
  multifuente <- Filter(function(sl) {
    refs <- .hce_refs_por_lamina(list(slides = list(sl)))[[1]]
    length(unique(sub("\\$.*$", "", refs))) >= 2L
  }, preflight$plan$slides)
  expect_gt(length(multifuente), 0L)
  expect_true(all(vapply(multifuente, function(x) identical(x$origen, "equivalencias"), logical(1))))

  # Bloque aditivo del preflight, con la misma revisión que la propuesta.
  eq <- preflight$equivalencias
  expect_true(isTRUE(eq$declarada))
  expect_identical(eq$origen_plan, "derivado")
  expect_true(isTRUE(eq$contiene_equivalencias))
  expect_identical(eq$revision, sugerido$revision)
  expect_match(eq$revision, "^r2:")
  expect_identical(as.integer(eq$n_diapositivas), as.integer(sugerido$n_diapositivas))

  # Las láminas por fuente no repiten referencias ya consumidas por la matriz.
  por_fuente <- Filter(function(x) !identical(x$origen %||% "", "equivalencias"), sugerido$plan$slides)
  refs_por_fuente <- .hce_refs_plan(list(slides = por_fuente))
  refs_matriz <- .hce_refs_plan(list(slides = Filter(function(x) identical(x$origen %||% "", "equivalencias"),
                                                     sugerido$plan$slides)))
  expect_length(intersect(refs_por_fuente, refs_matriz), 0L)
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

# ---------------------------------------------------------------------------
# R6 — lo que se propone no se bloquea por escala; lo divergente va a `fuera`.
# ---------------------------------------------------------------------------

test_that("R6: escalas que difieren sólo en la caja se proponen y no se bloquean", {
  sid <- .hce_setup(variante_estudiantes = "caja")
  on.exit(session_delete(sid), add = TRUE)
  .hce_declarar(sid, list(
    .hce_fila("Satisfaccion", "1", list(docentes = "p_sat", estudiantes = "q_sat"))))

  out <- .hce_sugerido(sid, config = list())
  expect_true(all(c("docentes$p_sat", "estudiantes$q_sat") %in% .hce_refs_plan(out$plan)))

  # Todo lo propuesto pasa el bloqueo de escala del consolidado…
  autorado <- graficos_consolidado_preflight(sid, config = list(plan = out$plan))
  expect_length(.hce_bloqueos_escala(autorado), 0L)
  # …y también la siembra que deriva el propio preflight (hoy: la heurística
  # empareja por etiqueta y el bloqueo literal la rechaza por la caja).
  sembrado <- graficos_consolidado_preflight(sid)
  expect_length(.hce_bloqueos_escala(sembrado), 0L)
})

test_that("R6: códigos distintos no se proponen como comparación: salen a fuera", {
  sid <- .hce_setup(variante_estudiantes = "codigo")
  on.exit(session_delete(sid), add = TRUE)
  .hce_declarar(sid, list(
    .hce_fila("Satisfaccion", "1", list(docentes = "p_sat", estudiantes = "q_sat")),
    .hce_fila("Conoce", "2", list(docentes = "p_con", estudiantes = "q_con"))))

  out <- .hce_sugerido(sid, config = list())

  fuera <- Filter(function(x) identical(x$etiqueta, "Satisfaccion"), out$fuera %||% list())
  expect_length(fuera, 1L)
  expect_true(fuera[[1]]$motivo %in% c("escala_divergente", "escala_incompatible"))
  # Ninguna lámina junta p_sat con q_sat.
  juntas <- Filter(function(r) all(c("docentes$p_sat", "estudiantes$q_sat") %in% r),
                   .hce_refs_por_lamina(out$plan))
  expect_length(juntas, 0L)
  # Lo propuesto, autorado tal cual, no recibe bloqueos de escala.
  expect_length(.hce_bloqueos_escala(graficos_consolidado_preflight(sid, config = list(plan = out$plan))), 0L)
  expect_length(.hce_bloqueos_escala(graficos_consolidado_preflight(sid)), 0L)
})

# ---------------------------------------------------------------------------
# R9 — los cuatro productores de la revisión devuelven el mismo valor.
# ---------------------------------------------------------------------------

test_that("R9: Carga, /plan/sugerido (activo y consolidado) y preflight dan la misma revisión r2:", {
  sid <- .hce_setup()
  on.exit(session_delete(sid), add = TRUE)
  .hce_declarar(sid)

  carga <- .equiv_estado(sid)$revision
  activo <- .graficos_plan_sugerido_por_fuente(sid, config = list(fuente = "equivalencias"))$revision
  consolidado <- .hce_sugerido(sid, config = list())$revision
  preflight <- graficos_consolidado_preflight(sid)$equivalencias$revision

  expect_match(carga, "^r2:")
  expect_identical(activo, carga)
  expect_identical(consolidado, carga)
  expect_identical(preflight, carga)
  expect_identical(.graficos_plan_desde_equivalencias(sid)$revision, carga)
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
  r <- .hcp_router_sugerido(sid, list(config = list(fuente = "equivalencias"), scope = "consolidado"))
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
  dentro <- .hcp_router_sugerido(sid, list(config = list(fuente = "equivalencias", scope = "consolidado")))
  expect_identical(dentro$status, 200L)
  expect_false(identical(dentro$body$report_scope %||% "", "consolidado"))
  vacio <- .hcp_router_sugerido(sid, list(config = list(fuente = "equivalencias"), scope = ""))
  expect_identical(vacio$status, 200L)
  expect_identical(vacio$body$fuente, "equivalencias")
  expect_false(identical(vacio$body$report_scope %||% "", "consolidado"))
})

test_that("R11: los dos códigos nuevos están en el registro con su status", {
  reg <- errores_registrados()
  fila <- function(code) reg[reg$codigo == code, , drop = FALSE]
  expect_identical(fila("E_GRAFICOS_PLAN_SCOPE")$status, "400")
  expect_identical(fila("E_GRAFICOS_CONSOLIDADO_NO_APLICA")$status, "409")
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
