# graficos_jobs.R — workers de los jobs de exportación de Gráficos
# (PPT, PPT multibase en ZIP y Word).
#
# Historia: estos tres workers vivían como closures anónimos triplicados
# dentro de router_graficos.R (~600 líneas casi idénticas cada uno). Cada
# copia re-implementaba a mano el bootstrap que jobs.R ya resuelve:
# cargar el paquete en el subproceso callr, resolver funciones del
# namespace vigente vía `.pkg_fn` (el bug histórico de lexical scoping
# contra el paquete INSTALADO) y duplicaba los helpers de rebuild que ya
# existen como funciones top-level (.graficos_rebuild_slide_json y cía.).
#
# Ahora son funciones top-level del paquete con la marca
# `prosecnur_job_function_name`: el bootstrap de job_submit() (jobs.R)
# hace el load_all()/library() en el worker y RE-OBTIENE cada función
# fresca del namespace recién cargado. Con eso, todas las referencias por
# nombre pelado (reporte_ppt_plan, p_plan, .graficos_rebuild_slide_json…)
# resuelven contra el código dev vigente, sin `.pkg_fn` ni load_all manual.
# Mismo patrón que graficos_consolidado_job_runner y los jobs de
# calc-muestra.

# Prefija los errores del worker con la base activa, para que el usuario
# sepa QUÉ base rompió en estudios multibase. Con base vacía/NULL devuelve
# el mensaje tal cual (proyectos single-base).
# B48/G-23: la UI en vivo escopea las refs peladas ("p12_1") contra la base
# activa, pero el plan GUARDADO viaja con esas refs al worker, donde `data`
# trae TODAS las bases y el motor exige prefijo `fuente$`. Este helper
# replica la semantica de la UI en el export: califica las refs escalares y
# los bloques de `vars` con la base activa. Las refs ya calificadas y los
# planes sin base activa (informe conjunto) no se tocan.
.graficos_calificar_ref <- function(ref, active_base) {
  ref_chr <- as.character(ref %||% "")[1]
  if (is.na(ref_chr) || !nzchar(trimws(ref_chr))) return(ref)
  if (grepl("$", ref_chr, fixed = TRUE)) return(ref)
  paste0(active_base, "$", trimws(ref_chr))
}

.graficos_calificar_refs_plan <- function(plan, active_base) {
  base_chr <- as.character(active_base %||% "")[1]
  if (is.na(base_chr) || !nzchar(trimws(base_chr))) return(plan)
  slides <- plan$slides %||% list()
  if (!length(slides)) return(plan)

  calificar_args <- function(args) {
    if (!is.list(args)) return(args)
    for (nm in c("var", "cruce", "cruces", "iter_var", "objetivo", "var_texto", "grupo", "fila")) {
      if (!is.null(args[[nm]])) args[[nm]] <- .graficos_calificar_ref(args[[nm]], base_chr)
    }
    if (!is.null(args$vars)) {
      if (is.list(args$vars)) {
        args$vars <- lapply(args$vars, function(bloque) {
          if (is.character(bloque)) {
            vapply(bloque, .graficos_calificar_ref, character(1), active_base = base_chr, USE.NAMES = FALSE)
          } else if (is.list(bloque)) {
            lapply(bloque, .graficos_calificar_ref, active_base = base_chr)
          } else {
            bloque
          }
        })
      } else if (is.character(args$vars)) {
        args$vars <- vapply(args$vars, .graficos_calificar_ref, character(1), active_base = base_chr, USE.NAMES = FALSE)
      }
    }
    args
  }

  calificar_graf <- function(g) {
    if (!is.list(g)) return(g)
    if (!is.null(g$args)) g$args <- calificar_args(g$args)
    g
  }

  plan$slides <- lapply(slides, function(sl) {
    if (!is.list(sl)) return(sl)
    payload <- sl$payload
    if (is.list(payload)) {
      for (nm in names(payload)) {
        v <- payload[[nm]]
        if (is.list(v) && (!is.null(v$graficador) || !is.null(v$args))) {
          payload[[nm]] <- calificar_graf(v)
        }
      }
      sl$payload <- payload
    }
    sl
  })
  plan
}

.graficos_job_base_error <- function(active_base) {
  function(msg) {
    if (!is.null(active_base) && nzchar(as.character(active_base))) {
      sprintf("Base '%s': %s", as.character(active_base), msg)
    } else {
      msg
    }
  }
}

# Rearma los slides de un plan JSON con las funciones reales del paquete.
# `report = NULL` omite el progreso por-slide (el worker multibase reporta
# por base, no por slide — divergencia deliberada que se conserva).
# `item_label` conserva el vocabulario de cada entregable en el mensaje de
# progreso: "slide" para PPT, "seccion" para Word.
.graficos_job_rebuild_slides <- function(plan, slide_registry, graficador_registry,
                                         icon_registry, report = NULL,
                                         base_error = identity,
                                         item_label = "slide") {
  slides <- plan$slides %||% list()
  total_slides <- length(slides)
  slides_r <- vector("list", total_slides)
  for (i in seq_len(total_slides)) {
    if (is.function(report)) {
      report(
        "rebuild",
        current = i,
        total = total_slides,
        percent = 5 + round(45 * (i - 1) / max(1, total_slides)),
        message = sprintf("Armando %s %s de %s...", item_label, i, total_slides)
      )
    }
    slides_r[[i]] <- tryCatch(
      .graficos_rebuild_slide_json(
        slides[[i]],
        slide_registry = slide_registry,
        graficador_registry = graficador_registry,
        icon_registry = icon_registry
      ),
      error = function(e) stop(base_error(conditionMessage(e)), call. = FALSE)
    )
  }
  slides_r
}

# B55: los marcos de depuración de placeholders (config.debug_ph de la UI,
# que .enriquecer_presets() materializa como debug_ph_bordes en los presets)
# son una herramienta de PREVIEW. Los entregables finales (PPT, ZIP multibase
# y Word) los ignoran siempre: un export con debug_ph.activo=TRUE en el body
# no puede salir con marcos magenta. Se apaga el flag en cada capa donde
# pudo quedar sembrado (base, tipo plano o tipo$args); color/grosor quedan
# inertes sin el flag.
.graficos_export_sin_debug_ph <- function(presets) {
  if (!is.list(presets)) return(presets)
  apagar <- function(x) {
    if (!is.list(x)) return(x)
    if (!is.null(x$debug_ph_bordes)) x$debug_ph_bordes <- FALSE
    if (is.list(x$args) && !is.null(x$args$debug_ph_bordes)) {
      x$args$debug_ph_bordes <- FALSE
    }
    x
  }
  out <- lapply(presets, apagar)
  names(out) <- names(presets)
  if (!is.list(out$base)) out$base <- list()
  out$base$debug_ph_bordes <- FALSE
  out
}

# Worker del job `graficos.ppt` (POST /api/graficos/ppt): exporta el PPT
# de la base activa. Los data/instrumento viajan por RDS (job_save_rds)
# porque las listas multibase no sobreviven la serialización de args.
graficos_job_worker_ppt <- function(rp_data_path, rp_inst_path, plan, presets, paletas,
                                    slide_registry, graficador_registry,
                                    icon_registry, active_base,
                                    template_pptx, auto_otros_slides,
                                    result_path, progress_path = NULL) {
  report <- job_progress_writer(progress_path)
  base_error <- .graficos_job_base_error(active_base)
  report("loading", percent = 2, message = "Cargando datos y plantilla...")
  presets <- .graficos_export_sin_debug_ph(presets)
  palette_env <- .graficos_palette_env(paletas, parent = parent.frame())
  plan <- .graficos_calificar_refs_plan(plan, active_base)
  slides_r <- .graficos_job_rebuild_slides(
    plan, slide_registry, graficador_registry, icon_registry,
    report = report, base_error = base_error, item_label = "slide"
  )
  report("render", percent = 60, message = "Renderizando presentación...")
  tryCatch(
    reporte_ppt_plan(
      data = readRDS(rp_data_path),
      instrumento = readRDS(rp_inst_path),
      path_ppt = result_path,
      presets = .build_presets(presets),
      plan = p_plan(slides = slides_r),
      env_diapos = palette_env,
      template_pptx = template_pptx,
      auto_otros_slides = auto_otros_slides,
      mensajes_progreso = FALSE
    ),
    error = function(e) stop(base_error(conditionMessage(e)), call. = FALSE)
  )
  report("export", percent = 96, message = "Guardando PPTX...")
  list(path = result_path, n_slides = length(slides_r))
}
attr(graficos_job_worker_ppt, "prosecnur_job_function_name") <- "graficos_job_worker_ppt"

# Worker del job `graficos.ppt_all` (POST /api/graficos/ppt-all): exporta
# el PPT de TODAS las bases de un multibase independiente en un ZIP.
# `per_base_path` apunta a un RDS con la config YA GUARDADA por base
# (plan/presets/paletas/iconos/plantilla/filename) — cada base se renderiza
# con su propia receta, tal como quedó en el editor.
graficos_job_worker_ppt_all <- function(rp_data_path, rp_inst_path, per_base_path, bases,
                                        slide_registry, graficador_registry,
                                        result_path, progress_path = NULL) {
  report <- job_progress_writer(progress_path)
  report("loading", percent = 2, message = "Cargando datos y plantillas...")

  all_data <- readRDS(rp_data_path)
  all_inst <- readRDS(rp_inst_path)
  per_base <- readRDS(per_base_path)

  stage <- tempfile("ppt_all_stage_")
  dir.create(stage, recursive = TRUE)
  n_bases <- length(bases)
  results <- vector("list", n_bases)
  for (i in seq_along(bases)) {
    base <- bases[[i]]
    base_error <- .graficos_job_base_error(base)
    report(
      "render",
      current = i,
      total = n_bases,
      percent = round(90 * (i - 1) / max(1, n_bases)),
      message = sprintf("Generando %s (%d/%d)...", base, i, n_bases)
    )
    info <- per_base[[base]]
    # Sin progreso por-slide: el usuario ve una fase "render" por base.
    slides_r <- .graficos_job_rebuild_slides(
      info$plan, slide_registry, graficador_registry, info$icon_registry,
      report = NULL, base_error = base_error
    )
    palette_env <- .graficos_palette_env(info$paletas, parent = parent.frame())
    out_path <- file.path(stage, info$filename)
    tryCatch(
      reporte_ppt_plan(
        data = stats::setNames(list(all_data[[base]]), base),
        instrumento = stats::setNames(list(all_inst[[base]]), base),
        path_ppt = out_path,
        presets = .build_presets(.graficos_export_sin_debug_ph(info$presets)),
        plan = p_plan(slides = slides_r),
        env_diapos = palette_env,
        template_pptx = info$template_pptx,
        auto_otros_slides = isTRUE(info$auto_otros_slides),
        mensajes_progreso = FALSE
      ),
      error = function(e) stop(base_error(conditionMessage(e)), call. = FALSE)
    )
    results[[i]] <- list(nombre = base, filename = info$filename, n_slides = length(slides_r))
  }
  report("zip", percent = 95, message = "Empaquetando ZIP...")
  old_wd <- setwd(stage)
  on.exit(setwd(old_wd), add = TRUE)
  zip::zip(zipfile = result_path, files = vapply(results, function(r) r$filename, character(1)))
  setwd(old_wd)
  report("export", percent = 99, message = "Guardando ZIP...")
  list(path = result_path, bases = results)
}
attr(graficos_job_worker_ppt_all, "prosecnur_job_function_name") <- "graficos_job_worker_ppt_all"

# Worker del job `graficos.word` (POST /api/graficos/word): mismo pipeline
# que /ppt pero renderiza con reporte_word_plan (presets Word aparte y sin
# plantilla PPTX ni slides automáticas de "otros").
graficos_job_worker_word <- function(rp_data_path, rp_inst_path, plan, presets, w_presets,
                                     paletas, slide_registry, graficador_registry,
                                     icon_registry, active_base,
                                     result_path, progress_path = NULL) {
  report <- job_progress_writer(progress_path)
  base_error <- .graficos_job_base_error(active_base)
  report("loading", percent = 2, message = "Cargando datos y plantilla...")
  presets <- .graficos_export_sin_debug_ph(presets)
  palette_env <- .graficos_palette_env(paletas, parent = parent.frame())
  plan <- .graficos_calificar_refs_plan(plan, active_base)
  slides_r <- .graficos_job_rebuild_slides(
    plan, slide_registry, graficador_registry, icon_registry,
    report = report, base_error = base_error, item_label = "seccion"
  )
  report("render", percent = 60, message = "Renderizando documento...")
  tryCatch(
    reporte_word_plan(
      data = readRDS(rp_data_path),
      instrumento = readRDS(rp_inst_path),
      path_docx = result_path,
      presets_ppt = .build_presets(presets),
      presets_word = .build_w_presets(w_presets),
      plan = p_plan(slides = slides_r),
      env_diapos = palette_env,
      mensajes_progreso = FALSE
    ),
    error = function(e) stop(base_error(conditionMessage(e)), call. = FALSE)
  )
  report("export", percent = 96, message = "Guardando DOCX...")
  list(path = result_path, n_slides = length(slides_r))
}
attr(graficos_job_worker_word, "prosecnur_job_function_name") <- "graficos_job_worker_word"
