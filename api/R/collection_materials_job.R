# Job y registro de artefactos para materiales de Recopiladores.
#
# El snapshot RDS vive en el directorio efimero de jobs y puede contener un
# resolved_access restringido. El resultado publico y collection_state solo
# reciben hashes, ids, page_map y el recibo-manifest canonico.

.cmj_generator <- function() {
  list(
    id = "collection-material-renderer",
    version = 1L,
    fingerprint = collection_fingerprint(list(
      id = "collection-material-renderer",
      version = 1L,
      compiler = "grid-single-sheet-v1",
      devices = c("pdf", "png")
    ))
  )
}

.cmj_media_type <- function(format) {
  switch(format, png = "image/png", pdf = "application/pdf", bundle = "application/zip")
}

.cmj_extension <- function(format) {
  switch(format, png = "png", pdf = "pdf", bundle = "zip")
}

.cmj_tsv_rows <- function(compiled) {
  rows <- lapply(compiled$page_map, function(item) {
    page <- compiled$pages[[as.integer(item$page)]]
    data.frame(
      page = as.integer(item$page),
      unit_id = as.character(item$unit_id %||% ""),
      access_id = as.character(item$access_id %||% ""),
      qr_payload = as.character(page$access$qr_payload %||% ""),
      stringsAsFactors = FALSE
    )
  })
  if (!length(rows)) {
    return(data.frame(page = integer(0), unit_id = character(0), access_id = character(0), qr_payload = character(0)))
  }
  do.call(rbind, rows)
}

#' Worker directo del render de materiales.
#'
#' @param snapshot_path RDS efimero creado en el hilo principal.
#' @param format png, pdf o bundle.
#' @param result_path destino asignado por job_submit.
#' @param page pagina seleccionada para png.
#' @param dpi resolucion de preview.
#' @param progress_path archivo de progreso.
#' @return metadatos sin URLs ni binarios.
#' @export
collection_material_render_job <- function(snapshot_path, format, result_path,
                                           page = 1L, dpi = 150,
                                           progress_path = NULL) {
  report <- job_progress_writer(progress_path)
  report("loading", percent = 5, message = "Cargando instancia de material...")
  snapshot <- readRDS(snapshot_path)
  if (!is.list(snapshot) || !identical(snapshot$schema, "collection_material_render_snapshot/v1")) {
    stop("El snapshot de materiales no cumple collection_material_render_snapshot/v1.", call. = FALSE)
  }
  if (!format %in% c("png", "pdf", "bundle")) {
    stop("Formato de materiales no soportado.", call. = FALSE)
  }
  report("compile", percent = 18, message = "Compilando layout semantico...")
  compiled <- collection_material_compile(
    template = snapshot$template,
    instance = snapshot$instance,
    project = snapshot$project,
    plan = snapshot$plan,
    deployment = snapshot$deployment,
    resolved_access = snapshot$resolved_access
  )

  output_page_map <- compiled$page_map
  if (identical(format, "png")) {
    report("render", percent = 45, message = "Renderizando preview PNG...")
    rendered <- collection_material_render_compiled(
      compiled, result_path, device = "png", page = page, dpi = dpi,
      brand_assets = snapshot$brand_assets %||% list()
    )
    output_page_map <- rendered$page_map
  } else if (identical(format, "pdf")) {
    report("render", percent = 45, message = "Renderizando PDF final...")
    rendered <- collection_material_render_compiled(
      compiled, result_path, device = "pdf",
      brand_assets = snapshot$brand_assets %||% list()
    )
  } else {
    report("render", percent = 40, message = "Renderizando PDF del paquete...")
    stage <- tempfile("collection-material-bundle-", tmpdir = dirname(result_path))
    dir.create(stage, recursive = TRUE, showWarnings = FALSE)
    on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
    pdf_path <- file.path(stage, "fichas.pdf")
    tsv_path <- file.path(stage, "accesos.tsv")
    rendered <- collection_material_render_compiled(
      compiled, pdf_path, device = "pdf",
      brand_assets = snapshot$brand_assets %||% list()
    )
    utils::write.table(
      .cmj_tsv_rows(compiled), tsv_path,
      sep = "\t", quote = TRUE, row.names = FALSE, na = "", fileEncoding = "UTF-8"
    )
    report("bundle", percent = 78, message = "Empaquetando PDF y TSV...")
    zip::zipr(
      result_path, files = c("fichas.pdf", "accesos.tsv"),
      root = stage, include_directories = FALSE
    )
  }
  report("verify", percent = 92, message = "Verificando checksum y paginas...")
  sha <- paste0("sha256:", tolower(digest::digest(file = result_path, algo = "sha256")))
  bytes <- as.integer(file.info(result_path)$size)
  if (!is.finite(bytes) || bytes < 1L) stop("El renderer no produjo un artefacto valido.", call. = FALSE)
  report("done", percent = 100, message = "Material listo.")
  list(
    format = format,
    media_type = .cmj_media_type(format),
    filename = snapshot$output_filename %||% basename(result_path),
    sha256 = sha,
    size_bytes = bytes,
    page_count = as.integer(length(output_page_map)),
    page_map = output_page_map,
    layout_fingerprint = compiled$layout_fingerprint,
    plan_fingerprint = snapshot$plan$input_fingerprint,
    deployment_id = snapshot$deployment$deployment_id,
    deployment_fingerprint = snapshot$instance$deployment_fingerprint,
    instance_id = snapshot$instance$instance_id,
    template_ref = snapshot$instance$template_ref,
    generator = .cmj_generator(),
    audience = snapshot$audience %||% "field_team",
    sensitivity = snapshot$instance$sensitivity %||% "operational",
    warnings = compiled$warnings
  )
}
attr(collection_material_render_job, "prosecnur_job_function_name") <- "collection_material_render_job"

.cmj_receipt <- function(meta, result) {
  list(
    schema = COLLECTION_ARTIFACT_RECEIPT_SCHEMA,
    receipt_id = paste0("receipt-", uuid::UUIDgenerate()),
    artifact_id = paste0("artifact-", uuid::UUIDgenerate()),
    instance_id = result$instance_id,
    deployment_id = result$deployment_id,
    plan_fingerprint = result$plan_fingerprint,
    deployment_fingerprint = result$deployment_fingerprint,
    template_ref = result$template_ref,
    layout_fingerprint = result$layout_fingerprint,
    file_id = meta$file_id,
    media_type = result$media_type,
    filename = result$filename,
    sha256 = result$sha256,
    size_bytes = as.integer(result$size_bytes),
    page_count = as.integer(result$page_count),
    page_map = result$page_map,
    generator = result$generator,
    audience = result$audience,
    sensitivity = result$sensitivity,
    generated_at = .collection_now_iso()
  )
}

#' Registra el artefacto de un job completado y guarda solo su recibo.
#'
#' @param job registro de jobs.R.
#' @return payload publico canonico, con `manifest` igual al recibo.
#' @export
collection_material_render_on_complete <- function(job) {
  result <- job$result_data
  path <- job$result_path
  if (!is.list(result) || is.null(path) || !file.exists(path)) {
    stop("El job de materiales termino sin artefacto registrable.", call. = FALSE)
  }
  actual_sha <- paste0("sha256:", tolower(digest::digest(file = path, algo = "sha256")))
  if (!identical(actual_sha, result$sha256)) {
    stop("El checksum del artefacto cambio antes de registrarlo.", call. = FALSE)
  }
  meta <- .register_output_file(
    job$sid, paste0("collection_material_", result$format), path,
    original_name = result$filename
  )
  receipt <- .cmj_receipt(meta, result)
  valid <- collection_artifact_receipt_validate(receipt)
  if (!isTRUE(valid$ok)) {
    stop("El recibo del artefacto es invalido: ", paste(collection_contract_problem_lines(valid), collapse = "; "), call. = FALSE)
  }

  # Enriquecer el file store (fuera del .pulso) antes de hacer la mutacion
  # atomica de collection_state. Ningun campo contiene resolved_access.
  session <- session_get(job$sid)
  session$files[[meta$file_id]]$sha256 <- receipt$sha256
  session$files[[meta$file_id]]$media_type <- receipt$media_type
  session$files[[meta$file_id]]$role <- "deliverable"
  session$files[[meta$file_id]]$audience <- receipt$audience
  session$files[[meta$file_id]]$sensitivity <- receipt$sensitivity
  session$files[[meta$file_id]]$receipt_id <- receipt$receipt_id
  session_set(job$sid, "files", session$files)

  current <- .collection_current(session_get(job$sid))
  next_state <- current
  next_state$artifact_receipts <- c(.cm_receipts(current), list(receipt))
  next_state$state_revision <- as.integer(current$state_revision) + 1L
  .collection_store(job$sid, next_state)

  list(
    file_id = receipt$file_id,
    media_type = receipt$media_type,
    filename = receipt$filename,
    sha256 = receipt$sha256,
    size_bytes = receipt$size_bytes,
    page_count = receipt$page_count,
    page_map = receipt$page_map,
    generator = receipt$generator,
    audience = receipt$audience,
    sensitivity = receipt$sensitivity,
    manifest = receipt
  )
}

#' Encola el render de una instancia de materiales.
#'
#' @param sid sesion.
#' @param instance_id instancia persistida.
#' @param format png, pdf o bundle.
#' @param page pagina para preview png.
#' @param resolved_access mapa efimero de accesos restricted.
#' @param audience field_team, client o internal.
#' @return handle de job.
#' @export
collection_material_render_start <- function(sid, instance_id, format,
                                             page = 1L, resolved_access = NULL,
                                             audience = "field_team") {
  format <- as.character(format %||% "")[[1]]
  if (!(format %in% c("png", "pdf", "bundle"))) {
    stop_api(400, "E_COLLECTION_MATERIAL_FORMAT", "format debe ser png, pdf o bundle.")
  }
  audience <- as.character(audience %||% "field_team")[[1]]
  if (!(audience %in% c("field_team", "client", "internal"))) {
    stop_api(422, "E_COLLECTION_MATERIAL_RENDER_INVALID", "audience debe ser field_team, client o internal.")
  }
  page <- suppressWarnings(as.integer(page %||% 1L))
  if (is.na(page) || page < 1L) {
    stop_api(422, "E_COLLECTION_MATERIAL_RENDER_INVALID", "page debe ser un entero positivo.")
  }
  snapshot <- collection_material_render_snapshot(sid, instance_id, resolved_access)
  filename <- .export_filename(
    sid,
    if (identical(format, "png")) "preview_material" else "fichas_recopiladores",
    .cmj_extension(format)
  )
  snapshot$output_filename <- filename
  snapshot$audience <- audience
  snapshot_path <- job_save_rds(sid, "collection_material_snapshot", snapshot)
  job_id <- job_submit(
    sid = sid,
    kind = paste0("recopiladores.materials_", format),
    func = collection_material_render_job,
    args = list(snapshot_path = snapshot_path, format = format, page = page),
    result_filename = filename,
    on_complete = collection_material_render_on_complete
  )
  list(
    ok = TRUE,
    job_id = job_id,
    kind = paste0("recopiladores.materials_", format),
    format = format,
    instance_id = instance_id
  )
}
