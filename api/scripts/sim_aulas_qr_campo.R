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

# --- 8. El libro operativo: la app lo produce y lo vuelve a leer --------------
# Es el ciclo que el equipo usa de verdad: la app genera el Excel, alguien lo
# llena, la app lo relee. Aqui se comprueba que la ida y la vuelta no pierden
# nada de lo que ya se sabia.
plan_mon <- monitoreo_aulas_normalize_plan(rows)
libro <- file.path(tempdir(), "sim_libro_aulas.xlsx")
invisible(aulas_libro_generar(plan_mon, libro))
vuelta <- aulas_libro_importar(libro)
say("[8] libro generado y releido: %d unidades -> %d", length(plan_mon), length(vuelta$plan))
cod <- function(l) sort(vapply(l, function(r) as.character(r$operational_code %||% ""), character(1)))
libro_ok <- identical(cod(plan_mon), cod(vuelta$plan))
enlaces_vuelta <- sum(vapply(vuelta$plan, function(r) nzchar(as.character(r$link %||% "")), logical(1)))
say("    codigos conservados: %s · enlaces que vuelven: %d/%d",
    libro_ok, enlaces_vuelta, length(vuelta$plan))

# --- 9. Registro de campo y parte --------------------------------------------
# Lo que el coordinador anota por aula. Los cuatro numeros son los que el cuadre
# comprueba, y por eso la ficha impresa los pide desde hoy.
titulares <- Filter(function(r) identical(as.character(r$sample_role %||% ""), "titular"), plan_mon)
codigo1 <- as.character(titulares[[1]]$operational_code)
plan_reg <- monitoreo_aulas_update_agenda(plan_mon, list(list(
  operational_code = codigo1, operational_status = "aplicada",
  observed_students = 22, refusals = 1, duplicates = 1, effective_surveys = 20,
  actual_room = "H-203", applied_by = "Equipo A"
)))
reg <- Filter(function(r) identical(as.character(r$operational_code), codigo1), plan_reg)[[1]]
say("[9] registro de %s: %s asistentes, %s rechazos, %s duplicados, %s efectivas, aula %s",
    codigo1, reg$observed_students, reg$refusals, reg$duplicates,
    reg$effective_surveys, reg$actual_room)
registro_ok <- all(vapply(c("observed_students", "refusals", "duplicates",
                            "effective_surveys", "actual_room"),
                          function(k) nzchar(as.character(reg[[k]] %||% "")), logical(1)))

# --- 10. El cuadre del parte --------------------------------------------------
# 22 - 1 - 1 = 20 cuadra; el segundo parte no, a proposito.
partes <- list(
  list(operational_code = codigo1, intento = 1L, observed_students = 22,
       refusals = 1, duplicates = 1, effective_surveys = 20),
  list(operational_code = as.character(titulares[[2]]$operational_code), intento = 1L,
       observed_students = 15, refusals = 0, duplicates = 0, effective_surveys = 14)
)
descuadres <- monitoreo_aulas_reconciliacion_partes(partes)
say("[10] cuadre: %d descuadre(s) de %d partes", length(descuadres), length(partes))
for (d in descuadres) say("      %s", monitoreo_aulas_descuadre_texto(d))
cuadre_ok <- length(descuadres) == 1L

# --- 11. Activar un reemplazo -------------------------------------------------
# Los DOS casos, porque en esta muestra conviven: un titular con cadena y otro
# sin ella. Elegir a ciegas el ultimo titular daba «cadena agotada» y parecia un
# defecto del motor cuando era la respuesta correcta —ese titular no tiene
# reserva—.
estado_de <- function(pl, c) {
  f <- Filter(function(r) identical(as.character(r$operational_code), c), pl)
  if (!length(f)) "" else as.character(f[[1]]$sample_status %||% "")
}
tiene_cadena <- function(pl, c) length(monitoreo_aulas_reservas_disponibles(pl, c)) > 0L
con_cadena <- Filter(function(r) tiene_cadena(plan_reg, as.character(r$operational_code)), titulares)
sin_cadena <- Filter(function(r) !tiene_cadena(plan_reg, as.character(r$operational_code)), titulares)

caida <- as.character(con_cadena[[1]]$operational_code)
act <- monitoreo_aulas_activar_reemplazo(plan_reg, caida,
                                         motivo = "docente_no_autoriza",
                                         ahora = "2026-08-16T12:00:00Z")
say("[11] %s", monitoreo_aulas_activacion_texto(act))
reemplazo_ok <- !is.null(act$activada) &&
  identical(estado_de(act$plan, caida), "reemplazada") &&
  identical(estado_de(act$plan, act$activada), "agendada")

# Y el titular sin reserva: la caida NO se marca reemplazada, porque no lo esta.
huerfano_ok <- TRUE
if (length(sin_cadena)) {
  solo <- as.character(sin_cadena[[1]]$operational_code)
  ag <- monitoreo_aulas_activar_reemplazo(act$plan, solo, ahora = "2026-08-16T12:30:00Z")
  say("     %s", monitoreo_aulas_activacion_texto(ag))
  huerfano_ok <- isTRUE(ag$agotada) && is.null(ag$activada) &&
    !identical(estado_de(ag$plan, solo), "reemplazada")
}

# --- 12. El tablero ve todo lo anterior ---------------------------------------
tablero <- monitoreo_aulas_dashboard(act$plan, data.frame(), list(
  enabled = TRUE, plan = act$plan, partes_campo = partes
))
avisos <- tablero$validation %||% list()
cuadre_en_tablero <- Filter(function(r) identical(as.character(r$check), "field_report_reconciliation"), avisos)
say("[12] tablero: %d aulas · %d controles · cuadre dice «%s»",
    tablero$kpis$total_aulas %||% 0L, length(avisos),
    if (length(cuadre_en_tablero)) as.character(cuadre_en_tablero[[1]]$status) else "?")
tablero_ok <- length(cuadre_en_tablero) == 1L &&
  identical(as.character(cuadre_en_tablero[[1]]$status), "review")

# --- 8. Veredicto -------------------------------------------------------------
say("")
say("VEREDICTO")
say("  enlaces personalizados por unidad ..... %s", con_link == length(seleccion))
say("  una ficha por unidad .................. %s", length(compiled$pages) == length(seleccion))
say("  QR distinto por unidad ................ %s", length(unique(payloads)) == length(seleccion))
reservas_ok <- all(vapply(rows[grepl("reserve", vapply(rows, function(r) r$sample_role %||% "", character(1)))],
                          function(r) nzchar(r$link %||% ""), logical(1)))
say("  reemplazos con su propio enlace ....... %s", reservas_ok)
say("  el libro va y vuelve sin perder nada .. %s", libro_ok && enlaces_vuelta == length(vuelta$plan))
say("  el registro captura el parte entero ... %s", registro_ok)
say("  el cuadre distingue lo que no cuadra .. %s", cuadre_ok)
say("  activar un reemplazo mueve los dos .... %s", reemplazo_ok)
say("  sin reserva no se finge un reemplazo .. %s", huerfano_ok)
say("  el tablero lo dice ..................... %s", tablero_ok)

todo <- con_link == length(seleccion) && length(compiled$pages) == length(seleccion) &&
  length(unique(payloads)) == length(seleccion) && reservas_ok &&
  libro_ok && registro_ok && cuadre_ok && reemplazo_ok && huerfano_ok && tablero_ok
say("")
say("COSTURA COMPLETA: %s", if (todo) "de punta a punta" else "HAY UN ESLABON ROTO")

# --- 13. Variante: sin prefill_field explicito (XPath por defecto) + return_url
# El default nuevo -ruta XPath completa cuando se conoce el asset_uid- y
# return_url nunca se probaron en la costura completa, solo en tests
# unitarios de .collection_access_url(). Misma seleccion, sesion nueva para
# no pisar la ya persistida arriba.
sid2 <- session_create()
session_set(sid2, "project_name", "SIM Aulas 2026 (xpath+returnUrl)")
session_set(sid2, "estudio", list(nombre = "SIM Aulas 2026", periodo = "Agosto 2026"))
session_set(sid2, "calc_muestra_aulas_selection", list(selection = seleccion))
session_set(sid2, "project_dirty", FALSE)
seeded2 <- collection_state_seed(sid2)

target2 <- list(
  provider = "kobo",
  base_access_url = "https://ee.kobotoolbox.org/x/aB3xY9kQ",
  # SIN prefill_field: el motor decide sola -> ruta XPath completa.
  asset_type = "survey",
  deployment_active = TRUE,
  asset_uid = "aSIM123456789",
  return_url = "https://pulso.pucp.edu.pe/noticias/enlace"
)
adapter2 <- collection_adapter_get("kobo_existing_v1")
preview2 <- adapter2$preview_deployment(plan = seeded2$plan, target = target2)
campo_usado <- names(preview2$bindings[[1]]$prefill)
say("[13] sin prefill_field: campo de personalizacion usado = %s", campo_usado)
xpath_ok <- identical(campo_usado, "/aSIM123456789/collectorID")

preview2$capability_preflight <- NULL
put2 <- collection_deployment_put(sid2, preview2, expected_revision = seeded2$state_revision)
prep2 <- collection_deployment_prepare(sid2, expected_revision = put2$state_revision)
inst2 <- collection_material_instance_create(sid2, expected_revision = prep2$state_revision)
ho2 <- collection_handoff(sid2, expected_revision = inst2$state_revision)
rows2 <- ho2$monitoring_rows
say("[13] handoff con return_url: %d filas", length(rows2))
for (r in rows2) say("      %-10s %s", r$operational_code %||% r$classroom_id, r$link %||% "(sin link)")
returnurl_ok <- length(rows2) > 0L &&
  all(vapply(rows2, function(r) grepl("returnUrl=", r$link %||% "", fixed = TRUE), logical(1)))
xpath_en_link_ok <- length(rows2) > 0L &&
  all(vapply(rows2, function(r) grepl("d%5B/aSIM123456789/collectorID%5D=", r$link %||% "", fixed = TRUE), logical(1)))
con_link2 <- sum(vapply(rows2, function(r) nzchar(r$link %||% ""), logical(1)))

plan_mon2 <- monitoreo_aulas_normalize_plan(rows2)
libro2 <- file.path(tempdir(), "sim_libro_aulas_xpath.xlsx")
invisible(aulas_libro_generar(plan_mon2, libro2))
vuelta2 <- aulas_libro_importar(libro2)
libro2_ok <- identical(cod(plan_mon2), cod(vuelta2$plan))
enlaces_vuelta2 <- sum(vapply(vuelta2$plan, function(r) nzchar(as.character(r$link %||% "")), logical(1)))

say("")
say("VEREDICTO — variante xpath + returnUrl")
say("  campo de personalizacion = ruta xpath completa .... %s", xpath_ok)
say("  enlaces con returnUrl= ............................. %s", returnurl_ok)
say("  ruta xpath escapada correctamente en el enlace ..... %s", xpath_en_link_ok)
say("  enlaces personalizados por unidad .................. %s", con_link2 == length(seleccion))
say("  el libro va y vuelve sin perder nada ............... %s", libro2_ok && enlaces_vuelta2 == length(vuelta2$plan))

todo2 <- xpath_ok && returnurl_ok && xpath_en_link_ok && con_link2 == length(seleccion) &&
  libro2_ok && enlaces_vuelta2 == length(vuelta2$plan)
say("")
say("COSTURA XPATH+RETURNURL: %s", if (todo2) "de punta a punta" else "HAY UN ESLABON ROTO")

todo <- todo && todo2
if (!todo) quit(status = 1L)
