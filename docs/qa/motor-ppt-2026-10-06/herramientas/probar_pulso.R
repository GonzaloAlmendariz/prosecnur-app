# Prueba final (M9d): corre el motor PPT sobre los planes guardados en un .pulso real,
# por el mismo camino que la app (POST /api/graficos/ppt o, en estudios de bases
# independientes, /api/graficos/ppt-all base por base), en proceso y sin servidor.
# Uso: PULSO=<copia del .pulso> OUT=<carpeta de salida> [BASES=a,b] [OTROS=1|0] Rscript probar_pulso.R
# Deja <OUT>/<base>.pptx y <OUT>/resumen.txt (plan, láminas, avisos y error por base).
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
PULSO <- Sys.getenv("PULSO"); OUT <- Sys.getenv("OUT"); dir.create(OUT, showWarnings = FALSE, recursive = TRUE)
log <- file.path(OUT, "resumen.txt"); cat("", file = log)
say <- function(...) { m <- paste0(...); cat(m, "\n"); cat(m, "\n", file = log, append = TRUE) }
r <- load_pulso(PULSO); sid <- r$session_id; s <- session_get(sid)
data_sources <- estudio_data_sources(sid); inst_sources <- estudio_inst_sources(sid)
indep <- isTRUE(tryCatch(estudio_is_independent_siblings(sid), error = function(e) FALSE))
bases <- if (indep) names(data_sources) else ""
pedidas <- strsplit(Sys.getenv("BASES"), ",")[[1]]; if (length(pedidas)) bases <- intersect(bases, pedidas)
say("pulso: ", basename(PULSO), " | bases independientes: ", indep, " | bases: ", paste(names(data_sources), collapse = ", "))
slide_reg <- setNames(lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names())

for (base in bases) {
  say("\n== ", if (nzchar(base)) base else "(base única)")
  cfg <- if (nzchar(base)) .graficos_effective_config_for_base(sid, base, s = s) else .graficos_effective_config(sid, s$graficos_config)
  if (!.graficos_config_has_slides(cfg)) { say("SIN PLAN guardado"); next }
  plan <- .normalize_plan(cfg$plan)
  tipos <- vapply(plan$slides %||% list(), function(d) as.character(d$tipo %||% d$type %||% d$slide %||% "?")[1], "")
  say("láminas en el plan: ", length(tipos), " | tipos: ", paste(names(table(tipos)), table(tipos), sep = "=", collapse = ", "))
  v <- .validar_plan_json(plan); if (!v$ok) { say("VALIDACIÓN FALLA: ", paste(v$errors, collapse = "; ")); next }
  delivery <- .graficos_delivery_options(cfg, template_id = plan$template_id %||% NULL, auto_otros_slides = plan$auto_otros_slides %||% NULL)
  if (nzchar(Sys.getenv("OTROS"))) delivery$auto_otros_slides <- Sys.getenv("OTROS") == "1"   # forzar «Otros» aparte
  tpl <- .graficos_resolve_template_pptx(config = cfg, profile_id = delivery$profile_id, template_id = delivery$template_id)
  say("plantilla: ", basename(tpl %||% "?"), " | otros aparte: ", format(delivery$auto_otros_slides))
  icon_reg <- .graficos_icon_registry(sid, cfg)
  slides_r <- tryCatch(.graficos_job_rebuild_slides(plan, slide_reg, .graf_names(), icon_reg, report = NULL,
    base_error = .graficos_job_base_error(base)), error = function(e) { say("ERROR al armar el plan: ", conditionMessage(e)); NULL })
  if (is.null(slides_r)) next
  dat <- if (nzchar(base)) setNames(list(data_sources[[base]]), base) else data_sources
  ins <- if (nzchar(base)) setNames(list(inst_sources[[base]]), base) else inst_sources
  out_path <- file.path(OUT, paste0(if (nzchar(base)) base else "mazo", ".pptx"))
  t0 <- Sys.time(); avisos <- character()
  ok <- withCallingHandlers(tryCatch({
    reporte_ppt_plan(data = dat, instrumento = ins, path_ppt = out_path, presets = .build_presets(.enriquecer_presets(cfg$presets, FALSE)),
      plan = p_plan(slides = slides_r), env_diapos = .graficos_palette_env(cfg$paletas %||% list(), parent = environment()),
      template_pptx = tpl, template_id = delivery$template_id, auto_otros_slides = isTRUE(delivery$auto_otros_slides), mensajes_progreso = FALSE); TRUE },
    error = function(e) { say("ERROR: ", conditionMessage(e)); FALSE }),
    warning = function(w) { avisos <<- c(avisos, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { if (grepl("AVISO|aviso|Sin datos|degrad", conditionMessage(m))) avisos <<- c(avisos, trimws(conditionMessage(m))); invokeRestart("muffleMessage") })
  if (ok) { n <- length(officer::read_pptx(out_path)); say("OK láminas generadas: ", n, " | segundos: ", round(as.numeric(Sys.time() - t0))) }
  if (length(avisos)) { t <- sort(table(avisos), decreasing = TRUE); say("avisos (", length(avisos), "):"); for (k in seq_along(t)) say("  ", t[[k]], " x ", substr(names(t)[k], 1, 220)) }
}
