# Simulación end-to-end: de aulas seleccionadas (titulares + reemplazos) a
# enlaces personalizados y fichas con QR, sobre el motor real.
#
# Es la medición de partida del GOAL «el aula se recoge sola»
# (docs/qa/goal-campo-aulas-qr-registro-2026-08-16.md) y el borrador del test
# de costura que pide su ítem L9: los tests existentes cubren cada pieza
# (engine, materials, render) pero ninguno recorre selección → enlaces →
# fichas → handoff de corrido.
#
#   SIM_OUT=/ruta/salida Rscript api/scripts/sim_aulas_qr_campo.R
#
# Sin red: el "formulario Kobo" es una URL de captura válida, nunca se llama.
suppressMessages(pkgload::load_all("api", quiet = TRUE))

OUT <- Sys.getenv("SIM_OUT", tempdir())
dir.create(OUT, recursive = TRUE, showWarnings = FALSE)
say <- function(...) cat(sprintf(...), "\n")

# --- 1. Selección de aulas tal como la deja Cálculo de muestra ----------------
# 4 titulares (M1) + 3 reemplazos encadenados (chain_reserve). Sin `link`:
# la selección NO trae enlaces, es exactamente el escenario del usuario.
mk <- function(i, role, wave, replacement_for = "") list(
  operational_code = sprintf("AULA-%02d", i),
  classroom_id     = sprintf("AULA-%02d", i),
  label            = sprintf("Aula %02d", i),
  sample_role      = role,
  wave             = wave,
  replacement_for  = replacement_for,
  facultad         = if (i %% 2 == 0) "Ingeniería" else "Ciencias Sociales",
  nombre_del_curso = sprintf("Curso %02d", i),
  horario          = sprintf("%02d:00-%02d:00", 7 + i, 9 + i),
  pabellon_aula    = sprintf("Pabellón %s - %d0%d", LETTERS[i], i, i),
  nombre_de_docente = sprintf("Docente %02d", i),
  matriculados_poblacion = 28 + i
)
seleccion <- c(
  lapply(1:4, function(i) mk(i, "titular", "M1")),
  lapply(5:7, function(i) mk(i, "chain_reserve", "R1", sprintf("AULA-%02d", i - 4)))
)

sid <- session_create()
session_set(sid, "project_name", "SIM Aulas 2026")
session_set(sid, "estudio", list(nombre = "SIM Aulas 2026", periodo = "Agosto 2026"))
session_set(sid, "calc_muestra_aulas_selection", list(selection = seleccion))
session_set(sid, "project_dirty", FALSE)

say("[1] Selección sembrada: %d unidades (4 titulares + 3 reemplazos), sin enlaces", length(seleccion))

# --- 2. Semilla del plan de Recopiladores ------------------------------------
seeded <- collection_state_seed(sid)
plan <- seeded$plan
say("[2] Plan: %d units · adapter=%s · deployment=%s",
    length(plan$units), plan$adapter$id,
    if (is.null(seeded$deployment)) "NULL (sin enlaces, esperado)" else seeded$deployment$status)
roles <- vapply(plan$units, function(u) u$role, character(1))
say("    roles en el plan: %s", paste(sprintf("%s=%d", names(table(roles)), table(roles)), collapse = " · "))

# --- 3. Un solo formulario Kobo => enlaces personalizados por unidad ----------
target <- list(
  provider = "kobo",
  base_access_url = "https://ee.kobotoolbox.org/x/aB3xY9kQ",
  prefill_field = "collectorID",
  asset_type = "survey",
  deployment_active = TRUE,
  asset_uid = "aSIM123456789"
)
adapter <- collection_adapter_get("kobo_existing_v1")
insp <- adapter$inspect_target(target_ref = target)
say("[3] inspect_target ok=%s blocking=%d", insp$ok, length(insp$blocking))
preview <- adapter$preview_deployment(plan = plan, target = target)
say("    preview: status=%s cobertura %d/%d listos",
    preview$status, preview$coverage$units_with_access, preview$coverage$units_total)
for (b in preview$bindings) {
  say("      %-28s %-19s %s", b$unit_id, b$access_kind, b$access_ref %||% "(sin acceso)")
}

# --- 4. Persistir y preparar --------------------------------------------------
rev <- seeded$state_revision
preview$capability_preflight <- NULL   # no pertenece al schema persistido
put <- collection_deployment_put(sid, preview, expected_revision = rev)
prep <- collection_deployment_prepare(sid, expected_revision = put$state_revision)
say("[4] deployment persistido y preparado: status=%s", prep$deployment$status)

# --- 5. Instancia de material para las 7 unidades ----------------------------
inst <- collection_material_instance_create(sid, expected_revision = prep$state_revision)
say("[5] instancia %s · %d unidades · %d accesos · warnings=%d",
    substr(inst$instance$instance_id, 1, 18), length(inst$instance$unit_refs),
    length(inst$instance$access_refs), length(inst$instance$warnings))

# --- 6. Render PDF real -------------------------------------------------------
snap <- collection_material_render_snapshot(sid, inst$instance$instance_id)
compiled <- collection_material_compile(
  template = snap$template, instance = snap$instance, project = snap$project,
  plan = snap$plan, deployment = snap$deployment, resolved_access = snap$resolved_access
)
say("[6] compilado: %d páginas", length(compiled$pages))
payloads <- vapply(compiled$pages, function(p) p$access$qr_payload %||% "", character(1))
for (i in seq_along(compiled$pages)) {
  p <- compiled$pages[[i]]
  say("      p%d %-12s %s", i, p$unit$role %||% "?", payloads[[i]])
}
say("    payloads únicos: %d de %d", length(unique(payloads)), length(payloads))

pdf_path <- file.path(OUT, "fichas_sim.pdf")
rendered <- collection_material_render_compiled(compiled, pdf_path, device = "pdf",
                                                brand_assets = list())
say("    PDF: %s (%d bytes, %d páginas)", basename(pdf_path),
    file.info(pdf_path)$size, length(rendered$page_map %||% compiled$page_map))

png_path <- file.path(OUT, "ficha_sim_p1.png")
collection_material_render_compiled(compiled, png_path, device = "png", page = 1, dpi = 150,
                                    brand_assets = list())
png5 <- file.path(OUT, "ficha_sim_p5.png")
collection_material_render_compiled(compiled, png5, device = "png", page = 5, dpi = 150,
                                    brand_assets = list())
say("    PNG p1 (titular) y p5 (reemplazo) escritos")

# --- 7. Handoff a Monitoreo ---------------------------------------------------
ho <- collection_handoff(sid, expected_revision = inst$state_revision)
rows <- ho$monitoring_rows
say("[7] handoff: %d filas al plan de Monitoreo", length(rows))
for (r in rows) {
  say("      %-10s %-14s %s", r$operational_code %||% r$classroom_id,
      r$sample_role %||% "?", r$link %||% "(sin link)")
}
con_link <- sum(vapply(rows, function(r) nzchar(r$link %||% ""), logical(1)))
say("    filas con enlace personalizado: %d/%d", con_link, length(rows))

# --- 8. Veredicto -------------------------------------------------------------
say("")
say("VEREDICTO")
say("  enlaces personalizados por unidad ..... %s", con_link == length(seleccion))
say("  una ficha por unidad .................. %s", length(compiled$pages) == length(seleccion))
say("  QR distinto por unidad ................ %s", length(unique(payloads)) == length(seleccion))
say("  reemplazos con su propio enlace ....... %s",
    all(vapply(rows[grepl("reserve", vapply(rows, function(r) r$sample_role %||% "", character(1)))],
               function(r) nzchar(r$link %||% ""), logical(1))))
