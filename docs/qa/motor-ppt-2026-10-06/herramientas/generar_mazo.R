# Genera el mazo de acrconta_mazo por el mismo camino que POST /api/graficos/ppt,
# en proceso y sin servidor. Uso: SP=<carpeta con una COPIA de acrconta_mazo.pulso> Rscript generar_mazo.R
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
SP <- Sys.getenv("SP")
r <- load_pulso(file.path(SP, "acrconta_mazo.pulso"))
sid <- r$session_id
s <- session_get(sid)
cfg0 <- s$graficos_config
plan <- .normalize_plan(cfg0$plan)
v <- .validar_plan_json(plan); if (!v$ok) stop(paste(v$errors, collapse="; "))
cfg0$debug_ph <- FALSE
cfg <- .graficos_effective_config(sid, cfg0)
delivery <- .graficos_delivery_options(cfg, template_id = plan$template_id %||% NULL, auto_otros_slides = plan$auto_otros_slides %||% NULL)
tpl <- .graficos_resolve_template_pptx(config = cfg, profile_id = delivery$profile_id, template_id = delivery$template_id)
cat("template:", tpl, " profile:", delivery$profile_id, "\n")
presets <- .enriquecer_presets(cfg0$presets, FALSE)
src <- .graficos_processing_sources(sid)
dp <- file.path(SP, "data.rds"); ip <- file.path(SP, "inst.rds")
saveRDS(src$data_sources, dp); saveRDS(src$inst_sources, ip)
slide_reg <- setNames(lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names())
t0 <- Sys.time()
out <- graficos_job_worker_ppt(rp_data_path = dp, rp_inst_path = ip, plan = plan, presets = presets,
  paletas = cfg$paletas %||% list(), slide_registry = slide_reg, graficador_registry = .graf_names(),
  icon_registry = .graficos_icon_registry(sid, cfg), active_base = .graficos_active_base_name(sid),
  template_pptx = tpl, template_id = delivery$template_id, auto_otros_slides = delivery$auto_otros_slides,
  result_path = file.path(SP, "mazo_conta.pptx"))
cat("OK slides:", out$n_slides, " secs:", round(as.numeric(Sys.time()-t0)), "\n")
