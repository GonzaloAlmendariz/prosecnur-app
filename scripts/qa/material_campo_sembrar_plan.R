#!/usr/bin/env Rscript
# =============================================================================
# Siembra un plan de recolección de Material de campo sobre hsvg2026 (H9)
# =============================================================================
#
# Uso:
#
#   Rscript scripts/qa/material_campo_sembrar_plan.R
#   Rscript scripts/qa/material_campo_sembrar_plan.R \
#     --project hsvg2026 \
#     --out tmp/qa-material-campo/hsvg2026_con_plan.pulso \
#     --render png          # png (defecto) | pdf | none
#     --simular-cambio      # tras sembrar, cambia la selección (Unidades › Origen)
#
# Imprime en stdout la ruta del manifiesto JSON que deja junto al `.pulso`
# (`<out>.json`), con las cifras del plan y el md5 de `state.rds`.
#
# Por qué existe (hallazgo H9, checklist-material-de-campo-2026-10-16): ningún
# proyecto de referencia trae un plan de recolección, así que el QA visual de
# Unidades, Accesos, Paquetes y Entrega sólo veía el vacío «sin plan de
# recolección» y aprobaba por ausencia.
#
# Qué hace —y con qué motor—, en el orden en que lo haría la UI:
#
#   1. Sorteo de cursos-horario: `calc_muestra_aulas_seleccionar()` con la
#      configuración vigente del proyecto (la misma que resuelve
#      `POST /api/calc-muestra/aulas/seleccionar`). hsvg2026 está anonimizado:
#      sin ids de alumno el descuento secuencial se apaga (`descuento_sin_ids`)
#      y la corrida lo declara en el manifiesto; no se toca el diseño.
#   2. Plan: `collection_state_seed()` (POST /api/recopiladores/seed) siembra
#      `aulas_v1` desde esa selección.
#   3. Accesos: adapter `kobo_existing_v1`, `preview_deployment()` (POST
#      /deployment/preview) + `collection_deployment_prepare()` (POST
#      /deployment/prepare). El target es SINTÉTICO: dominio reservado
#      `example.org`, asset inventado, sin perfil de conexión ni secretos. El
#      adapter no hace red: sólo compone `access_ref` + `prefill`.
#   4. Plantilla: «Usar este tipo» = `collection_material_catalog_get()` +
#      `collection_material_template_put()` con `ficha_aplicacion_a4_v1`.
#   5. Paquete: `collection_material_instance_create()` con todas las unidades
#      (lo que hace MaterialsSection) y, salvo `--render none`, el render
#      `collection_material_render_job()` + `collection_material_render_on_complete()`
#      EN PROCESO: es el mismo par worker + on_complete que encola
#      `collection_material_render_start()`, sin callr.
#
# Determinismo: misma semilla del proyecto → mismas unidades, mismos accesos y
# mismas huellas (`plan$input_fingerprint`, `deployment_fingerprint`). El
# `selection_run_id` del motor lleva un sello de reloj por diseño
# (`calc_muestra_aulas.R`); aquí se reescribe a `sel_aulas_qa_<hash8>`, con el
# mismo sufijo determinista que calcula el motor, para que el plan no cambie
# de huella entre corridas. Lo que SÍ cambia entre corridas, y por eso el md5
# de `state.rds` no es estable: `instance_id`, `receipt_id`, `artifact_id` y
# `file_id` (UUID), `generated_at` del recibo y los sellos de guardado del
# `.pulso` (`project_last_saved_at`). El manifiesto publica las huellas
# estables para comparar corridas.
#
# Sin PII: el proyecto ya viene anonimizado y este script no agrega nombres ni
# correos; los únicos textos nuevos son las URLs `example.org`.

.mcqa_default_target <- function() {
  list(
    provider = "kobo",
    base_access_url = "https://kobo.example.org/single/qaHSVG2026",
    asset_uid = "aQAhsvg2026sinteticoEjemplo",
    asset_type = "survey",
    deployment_active = TRUE,
    return_url = "https://example.org/material-campo/gracias"
  )
}

# El sello de reloj del run se sustituye en TODO el objeto de selección (filas,
# auditorías, campo de primer nivel): dejar una sola copia vieja haría que el
# plan y la selección discreparan en `source_vigente`.
.mcqa_reemplazar_valor <- function(x, viejo, nuevo) {
  if (is.character(x)) {
    x[!is.na(x) & x == viejo] <- nuevo
    return(x)
  }
  if (is.factor(x)) {
    levels(x)[levels(x) == viejo] <- nuevo
    return(x)
  }
  if (is.list(x)) {
    atributos <- attributes(x)
    x <- lapply(x, .mcqa_reemplazar_valor, viejo = viejo, nuevo = nuevo)
    attributes(x) <- atributos
  }
  x
}

.mcqa_run_id_estable <- function(selection) {
  viejo <- as.character(selection$selection_run_id %||% "")[1]
  if (is.na(viejo) || !nzchar(viejo)) return(selection)
  sufijo <- sub("^.*_", "", viejo)
  nuevo <- paste0("sel_aulas_qa_", sufijo)
  .mcqa_reemplazar_valor(selection, viejo, nuevo)
}

.mcqa_revision <- function(sid) {
  as.integer(.collection_current(session_get(sid))$state_revision)
}

.mcqa_seleccionar <- function(sid) {
  s <- session_get(sid)
  frame <- s$calc_muestra_aulas_frame
  if (is.null(frame)) stop("El proyecto no tiene marco de aulas.", call. = FALSE)
  config <- calc_muestra_aulas_normalize_config(
    .cm_aulas_config_vigente(s$calc_muestra_aulas_config, frame$config)
  )
  .cm_aulas_assert_decision_vigente(s, config)
  avisos <- character(0)
  selection <- withCallingHandlers(
    calc_muestra_aulas_seleccionar(frame, config),
    warning = function(w) {
      avisos <<- c(avisos, conditionMessage(w))
      invokeRestart("muffleWarning")
    }
  )
  selection <- .mcqa_run_id_estable(selection)
  # Mismas claves que escribe el router tras un sorteo síncrono.
  session_set(sid, "calc_muestra_aulas_config", config)
  session_set(sid, "calc_muestra_aulas_selection", selection)
  session_set(sid, "calc_muestra_aulas_replacement_simulation", NULL)
  session_set(sid, "calc_muestra_aulas_export", NULL)
  session_set(sid, "calc_muestra_aulas_stale_job_result", NULL)
  list(selection = selection, config = config, avisos = unique(avisos))
}

.mcqa_render <- function(sid, instance_id, format) {
  snapshot <- collection_material_render_snapshot(sid, instance_id, NULL)
  filename <- .export_filename(
    sid,
    if (identical(format, "png")) "preview_material" else "fichas_recopiladores",
    .cmj_extension(format)
  )
  snapshot$output_filename <- filename
  snapshot$audience <- "field_team"
  snapshot_path <- job_save_rds(sid, "collection_material_snapshot", snapshot)
  jobs_dir <- file.path(session_get(sid)$dir, "jobs")
  dir.create(jobs_dir, showWarnings = FALSE, recursive = TRUE)
  result_path <- file.path(jobs_dir, paste0("qa-material-campo__", filename))
  result <- collection_material_render_job(
    snapshot_path = snapshot_path, format = format,
    result_path = result_path, page = 1L
  )
  collection_material_render_on_complete(list(
    sid = sid, result_data = result, result_path = result_path
  ))
}

# --simular-cambio (E1e, Unidades › Origen): DESPUES de sembrar, la selección
# de Cálculo de muestra se toca como la tocaría la vida real, para que Origen
# tenga diferencias que enseñar. El plan sembrado no se toca —es lo que fue a
# imprenta— y el `run_id` tampoco: Origen tiene que ver el cambio por los
# DATOS, no por la corrida.
#
#   - el aula de un titular: `scheduled_venue` (el aula pactada con el docente,
#     que manda sobre la del catálogo) pasa a «QA-AULA-SIMULADA»;
#   - entran 2 filas: copias de dos del banco con curso-horario y código nuevos;
#   - sale 1: la última del banco;
#   - un rol: la primera reserva de cadena pasa a titular.
.mcqa_simular_cambio <- function(sid) {
  s <- session_get(sid)
  sel <- s$calc_muestra_aulas_selection
  df <- sel$selection
  rol <- as.character(df$sample_role)
  titular <- which(rol == "titular")[[1]]
  reserva <- which(rol == "chain_reserve")[[1]]
  banco <- which(rol == "extra_reserve_pool")
  if (length(banco) < 3L) stop("La selección no tiene banco suficiente para simular.", call. = FALSE)
  if (!"scheduled_venue" %in% names(df)) df$scheduled_venue <- NA_character_
  df$scheduled_venue[[titular]] <- "QA-AULA-SIMULADA"
  df$sample_role[[reserva]] <- "titular"
  sale <- banco[[length(banco)]]
  altas <- df[banco[1:2], , drop = FALSE]
  altas$classroom_id <- c("qa_simulada_0001", "qa_simulada_0002")
  altas$operational_code <- c("EXTRA 9001", "EXTRA 9002")
  altas$selection_slot_id <- paste0("qa-slot-", 1:2)
  altas$operational_sequence <- max(df$operational_sequence, na.rm = TRUE) + 1:2
  quien <- list(
    aula_cambiada = list(classroom_id = df$classroom_id[[titular]], codigo = df$operational_code[[titular]],
                         campo = "aula", despues = "QA-AULA-SIMULADA"),
    rol_cambiado = list(classroom_id = df$classroom_id[[reserva]], codigo = df$operational_code[[reserva]],
                        antes = "chain_reserve", despues = "titular"),
    sale = list(classroom_id = df$classroom_id[[sale]], codigo = df$operational_code[[sale]]),
    entran = lapply(seq_len(nrow(altas)), function(i) {
      list(classroom_id = altas$classroom_id[[i]], codigo = altas$operational_code[[i]])
    })
  )
  df <- rbind(df[-sale, , drop = FALSE], altas)
  rownames(df) <- NULL
  sel$selection <- df
  session_set(sid, "calc_muestra_aulas_selection", sel)
  quien
}

#' Siembra el plan, los accesos, la plantilla y el paquete y graba el `.pulso`.
#'
#' @param fixture ruta del `.pulso` de referencia (se abre, nunca se escribe).
#' @param destino ruta del `.pulso` derivado.
#' @param render "png", "pdf" o "none".
#' @param target target sintético del adapter Kobo.
#' @return lista con las cifras del plan y el md5 de `state.rds`.
material_campo_qa_sembrar <- function(fixture, destino, render = c("png", "pdf", "none"),
                                      target = .mcqa_default_target(),
                                      simular_cambio = FALSE) {
  render <- match.arg(render)
  if (!file.exists(fixture)) stop(sprintf("No existe el fixture: %s", fixture), call. = FALSE)
  if (normalizePath(fixture, mustWork = TRUE) ==
      normalizePath(destino, mustWork = FALSE)) {
    stop("El destino no puede ser el fixture de referencia.", call. = FALSE)
  }
  handle <- load_pulso(fixture)
  sid <- handle$session_id
  on.exit(try(session_delete(sid), silent = TRUE), add = TRUE)

  if (!is.null(session_get(sid)$collection_state)) {
    stop("El fixture ya trae collection_state; este sembrador parte de uno sin plan.", call. = FALSE)
  }
  sorteo <- .mcqa_seleccionar(sid)

  seeded <- collection_state_seed(sid)
  if (!isTRUE(seeded$seeded) || is.null(seeded$state$plan)) {
    stop("collection_state_seed no sembró un plan desde la selección.", call. = FALSE)
  }
  plan <- seeded$state$plan

  adapter <- collection_adapter_get("kobo_existing_v1")
  preflight <- adapter$capability_preflight(operation = "local_generation", target = list(target = target))
  if (length(preflight$blocking)) {
    stop("El preflight local bloquea el target sintético: ",
         paste(vapply(preflight$blocking, function(b) b$code, character(1)), collapse = ", "),
         call. = FALSE)
  }
  preview <- adapter$preview_deployment(plan = plan, target = target)
  prepared <- collection_deployment_prepare(sid, .mcqa_revision(sid), deployment = preview)

  catalogo <- collection_material_catalog_get(sid)
  ficha <- Filter(function(p) identical(p$preset_id, "ficha_aplicacion_a4_v1"), catalogo$presets)
  if (!length(ficha)) stop("El catálogo no ofrece ficha_aplicacion_a4_v1.", call. = FALSE)
  collection_material_template_put(sid, ficha[[1]]$template, .mcqa_revision(sid))

  unit_ids <- vapply(plan$units, function(u) u$unit_id, character(1))
  instancia <- collection_material_instance_create(
    sid, .mcqa_revision(sid), unit_refs = as.list(unit_ids), locale = "es-PE"
  )$instance
  recibo <- if (identical(render, "none")) NULL else .mcqa_render(sid, instancia$instance_id, render)

  final <- .collection_current(session_get(sid))
  valid <- collection_state_validate(final)
  if (!isTRUE(valid$ok)) {
    stop("El estado sembrado no valida: ",
         paste(collection_contract_problem_lines(valid), collapse = "; "), call. = FALSE)
  }
  activo <- Filter(function(p) isTRUE(p$active), collection_material_catalog_get(sid)$presets)
  simulacion <- if (isTRUE(simular_cambio)) .mcqa_simular_cambio(sid) else NULL

  dir.create(dirname(destino), recursive = TRUE, showWarnings = FALSE)
  if (file.exists(destino)) unlink(destino)
  invisible(build_pulso(sid, destino, project_name = "hsvg2026 (QA material de campo)"))

  staging <- tempfile("mcqa_state_")
  dir.create(staging)
  on.exit(unlink(staging, recursive = TRUE, force = TRUE), add = TRUE)
  zip::unzip(destino, files = "state.rds", exdir = staging)
  state_md5 <- unname(tools::md5sum(file.path(staging, "state.rds")))

  roles <- vapply(final$plan$units, function(u) as.character(u$role %||% ""), character(1))
  list(
    schema = "prosecnur.qa_material_campo_seed.v1",
    fixture = normalizePath(fixture),
    fixture_sha256 = digest::digest(file = fixture, algo = "sha256"),
    project_path = normalizePath(destino),
    selection_run_id = final$plan$source_ref$run_id,
    seed = sorteo$config$selector$seed %||% NA_integer_,
    selector_engine = sorteo$config$selector$selector_engine %||% NA_character_,
    descuento_secuencial = list(
      requested = isTRUE(sorteo$selection$sequential_discount$requested),
      applied = isTRUE(sorteo$selection$sequential_discount$applied),
      warning_code = sorteo$selection$sequential_discount$warning_code %||% NA_character_
    ),
    avisos_sorteo = as.list(sorteo$avisos),
    plan = list(
      plan_id = final$plan$plan_id,
      adapter = final$plan$adapter$id,
      unidades = length(final$plan$units),
      por_rol = as.list(table(roles)),
      input_fingerprint = final$plan$input_fingerprint
    ),
    accesos = list(
      adapter = "kobo_existing_v1",
      bindings = length(final$deployment$bindings),
      ready = sum(vapply(final$deployment$bindings, function(b) identical(b$status, "ready"), logical(1))),
      status = final$deployment$status,
      deployment_fingerprint = final$deployment$deployment_fingerprint,
      base_access_url = target$base_access_url
    ),
    plantilla = list(
      activa = if (length(activo)) activo[[1]]$preset_id else NA_character_,
      template_sha256 = .cm_material_template(final)$template_sha256
    ),
    paquete = list(
      instancias = length(final$material_instances %||% list()),
      unidades_en_instancia = length(instancia$unit_refs),
      render = render,
      recibos = length(final$artifact_receipts %||% list()),
      filename = if (is.null(recibo)) NA_character_ else recibo$filename,
      page_count = if (is.null(recibo)) NA_integer_ else recibo$page_count
    ),
    state_revision = final$state_revision,
    state_valid = TRUE,
    state_md5 = state_md5,
    state_md5_estable = FALSE,
    simular_cambio = isTRUE(simular_cambio),
    simulacion = simulacion
  )
}

if (sys.nframe() == 0L) {
  script_path <- local({
    a <- commandArgs(trailingOnly = FALSE)
    hit <- a[startsWith(a, "--file=")]
    if (length(hit)) sub("--file=", "", hit[[1]]) else "scripts/qa/material_campo_sembrar_plan.R"
  })
  repo_root <- normalizePath(file.path(dirname(script_path), "..", ".."), mustWork = FALSE)
  api_dir <- file.path(repo_root, "api")
  Sys.setenv(PULSO_REPO_ROOT = repo_root, PULSO_API_DIR = api_dir)
  suppressMessages(pkgload::load_all(api_dir, quiet = TRUE))

  args <- commandArgs(trailingOnly = TRUE)
  arg_valor <- function(nombre, default = NULL) {
    eq <- paste0("--", nombre, "=")
    hit <- args[startsWith(args, eq)]
    if (length(hit)) return(sub(eq, "", hit[[1]], fixed = TRUE))
    idx <- match(paste0("--", nombre), args)
    if (!is.na(idx) && idx < length(args)) return(args[[idx + 1L]])
    default
  }
  slug <- arg_valor("project", "hsvg2026")
  fixture <- arg_valor("fixture", reference_project_path(slug))
  destino <- arg_valor("out", file.path(repo_root, "tmp", "qa-material-campo",
                                        sprintf("%s_con_plan.pulso", slug)))
  render <- arg_valor("render", "png")

  simular <- "--simular-cambio" %in% args

  resumen <- material_campo_qa_sembrar(fixture, destino, render = render, simular_cambio = simular)
  manifest_path <- paste0(destino, ".json")
  writeLines(jsonlite::toJSON(resumen, auto_unbox = TRUE, pretty = TRUE, null = "null"),
             manifest_path)
  cat(manifest_path)
}
