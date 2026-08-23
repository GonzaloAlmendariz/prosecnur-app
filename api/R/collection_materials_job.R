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

# Segmento de ruta legible: nombres de facultad/unidad tienen que sobrevivir
# como carpeta o archivo real. `.collection_stable_id()` (collection_engine.R)
# no sirve acá -agrega un hash y vuelve el nombre irreconocible para quien
# abre el zip a mano-, así que esto solo saca los caracteres que rompen un
# sistema de archivos y conserva el resto legible.
.cmj_path_segment <- function(value, fallback) {
  value <- .crf_txt(value, "")
  if (!nzchar(value)) return(fallback)
  value <- gsub("[\\/:*?\"<>|]", "-", value)
  value <- trimws(gsub("\\s+", " ", value))
  value <- substr(value, 1L, 80L)
  if (!nzchar(value)) fallback else value
}

#' La carpeta de un rol dentro de su facultad.
#'
#' Tres cajones y no uno solo: quien imprime reparte por facultad y dentro
#' separa lo que SE VISITA de lo que solo entra si algo cae. Con las 2.616 fichas
#' del sorteo del 22 en una sola carpeta por facultad, la de Ciencias e
#' Ingenieria tiene 574 PDF y encontrar la de un titular concreto es imposible.
#'
#' Los nombres salen del diccionario de la propia ficha que va dentro
#' (`.crf_role_label`): «Titular», «Reemplazo», «Reserva adicional». Que la
#' carpeta se llame como el rol impreso en el papel que contiene es lo que
#' evita tener que traducir dos veces.
#'
#' Un rol que no conocemos NO se reparte a ojo: va a «Otros» y se ve. Meterlo en
#' cualquiera de los tres cajones cambiaria en silencio lo que alguien lleva a
#' campo.
.cmj_carpeta_de_rol <- function(role_key) {
  key <- tolower(gsub("[ -]+", "_", trimws(as.character(role_key %||% "")[1])))
  switch(
    key,
    titular = "Titulares",
    chain_reserve = "Reemplazos",
    reserva = "Reemplazos",
    extra_reserve_pool = "Adicionales",
    "Otros"
  )
}

# Vista de una sola pagina sobre un `compiled` ya armado, para poder llamar a
# `collection_material_render_compiled()` sin reimplementar el device PDF por
# unidad. `layout_fingerprint` se conserva del compilado completo a
# proposito: identifica LA RECETA (plantilla+instancia), no el archivo
# individual, y es lo que ya usan los recibos para trazabilidad.
.cmj_page_subset <- function(compiled, index) {
  list(
    schema = compiled$schema,
    pages = compiled$pages[index],
    page_count = 1L,
    page_map = compiled$page_map[index],
    warnings = list(),
    layout_fingerprint = compiled$layout_fingerprint
  )
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
    # Un PDF por unidad, en `Fichas/<facultad>/<unidad>.pdf` -no un solo PDF
    # combinado con todas las paginas seguidas-: es lo que el equipo de campo
    # necesita para encontrar la ficha de un aula sin recorrer un archivo de
    # cientos de paginas. El prototipo Python de Gonzalo (docs/
    # Generador_fichasQR.ipynb, sin trackear) ya separaba por carpeta -ahí por
    # `seleccion`/muestra, acá por facultad, que es el dato que de verdad
    # identifica dónde entregar cada ficha impresa.
    report("render", percent = 40, message = "Renderizando fichas del paquete...")
    stage <- tempfile("collection-material-bundle-", tmpdir = dirname(result_path))
    dir.create(stage, recursive = TRUE, showWarnings = FALSE)
    on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
    fichas_dir <- file.path(stage, "Fichas")
    dir.create(fichas_dir, showWarnings = FALSE)
    tsv_path <- file.path(stage, "accesos.tsv")

    n_pages <- length(compiled$pages)
    draw_warnings <- list()
    # Cuenta repeticiones de "carpeta/nombre" para no pisar un archivo cuando
    # dos unidades de la misma facultad comparten label (dos secciones del
    # mismo curso, por ejemplo).
    seen_names <- new.env(parent = emptyenv())
    for (i in seq_len(n_pages)) {
      page_i <- compiled$pages[[i]]
      facultad <- .cmj_path_segment(page_i$unit$faculty, "Sin facultad")
      cajon <- .cmj_carpeta_de_rol(page_i$unit$role_key)
      folder <- file.path(facultad, cajon)
      folder_path <- file.path(fichas_dir, folder)
      dir.create(folder_path, recursive = TRUE, showWarnings = FALSE)
      # El nombre del curso-horario EN MAYUSCULAS. El marco lo trae en minuscula
      # —«urb209_0601»— y en una carpeta de cientos de PDF la caja uniforme es
      # lo que deja escanear la lista sin leerla entera.
      base_name <- toupper(
        .cmj_path_segment(page_i$unit$label, page_i$unit$unit_id %||% sprintf("unidad-%d", i))
      )
      key <- file.path(folder, base_name)
      count <- (if (exists(key, envir = seen_names, inherits = FALSE)) get(key, envir = seen_names) else 0L) + 1L
      assign(key, count, envir = seen_names)
      file_name <- if (count > 1L) sprintf("%s (%d).pdf", base_name, count) else sprintf("%s.pdf", base_name)
      rendered_unit <- collection_material_render_compiled(
        .cmj_page_subset(compiled, i), file.path(folder_path, file_name), device = "pdf",
        brand_assets = snapshot$brand_assets %||% list()
      )
      draw_warnings <- c(draw_warnings, rendered_unit$warnings %||% list())
      if (i %% 5L == 0L || i == n_pages) {
        report("render", percent = 40L + as.integer(35 * i / max(1L, n_pages)),
               message = sprintf("Renderizando ficha %d de %d...", i, n_pages))
      }
    }
    rendered <- list(warnings = draw_warnings)
    utils::write.table(
      .cmj_tsv_rows(compiled), tsv_path,
      sep = "\t", quote = TRUE, row.names = FALSE, na = "", fileEncoding = "UTF-8"
    )
    report("bundle", percent = 78, message = "Empaquetando fichas y TSV...")
    # `mode = "cherry-pick"` (default de zip::zipr) aplana cada archivo a su
    # basename dentro del zip -es para elegir archivos sueltos de cualquier
    # lado, no para conservar una jerarquia de carpetas-. Con eso, "Fichas/
    # Ingenieria/Aula 1.pdf" en disco salia como "Aula 1.pdf" en el zip, sin
    # ninguna carpeta: medido con un zip de prueba antes de confiar en la
    # firma de la funcion. "mirror" es el modo que sí respeta la ruta
    # relativa a `root`.
    zip::zipr(
      result_path, files = list.files(stage, recursive = TRUE),
      root = stage, mode = "mirror"
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
