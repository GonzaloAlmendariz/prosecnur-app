#' Serializador unico de la API.
#'
#' `na = "null"` no es cosmetico. Sin el, `serializer_unboxed_json()` manda
#' `NA_real_`, `NaN` e `Inf` como las CADENAS "NA", "NaN" e "Inf"
#' (`NA_character_` ya salia `null` por su cuenta), y un campo numerico que
#' llega como texto atraviesa intacto todos los guards de la UI: en
#' `AulasEfectividadSeguimiento.tsx:116` y `:248` el `f.banda_bajo == null` esta
#' escrito para tapar «no hay banda» y nunca disparaba, asi que el panel
#' calculaba `("NA" - "NA") / 2` y publicaba el resultado. Medido el 2026-09-09;
#' nadie en el frontend lee esas tres cadenas: los `!== "NA"` de Bases y de
#' Hojas de ruta miran texto que viene del Excel, no del serializador.
#'
#' Vive en una funcion y no inline en el pipe para que el contrato
#' (`test-serializer-valores-especiales.R`) ejercite EL MISMO serializador que
#' monta la app. Un test que replique los flags a mano es un espejo, y un espejo
#' no falla cuando el original cambia.
#'
#' Interno: solo lo llama `build_plumber_app()`, y el contrato lo alcanza con
#' `prosecnurapp:::`.
#'
#' @return Un serializador de plumber.
#' @noRd
.api_serializer <- function() {
  plumber::serializer_unboxed_json(na = "null")
}

#' Override de etiquetas con alcance de pedido (label_overrides.R).
#'
#' `preroute` publica el override de la sesión del pedido y `postserialize` lo
#' retira: ninguna sesión hereda el override que otra dejó en el slot global.
#' Interno: sólo lo llama `build_plumber_app()`.
#' @noRd
.api_label_overrides_hooks <- function(pr) {
  plumber::pr_hooks(pr, list(
    preroute = function(data, req, res) {
      # Un override persistido malformado no puede tumbar todos los pedidos de
      # la sesión: se falla cerrado (slot vacío, nunca el de otra sesión) y el
      # motivo queda en stderr.
      tryCatch(.label_overrides_activate_for_request(req), error = function(e) {
        .label_overrides_activate(NULL)
        message(sprintf("[prosecnur-app] label_overrides no publicado: %s", conditionMessage(e)))
      })
      invisible(NULL)
    },
    postserialize = function(data, req, res, value) {
      .label_overrides_activate(NULL)
      value
    }
  ))
}

#' Build the Plumber app with all routers mounted.
#'
#' @param static_dir Path to the directory containing the frontend build
#'   (typically `api/inst/www`). SPA fallback is wired to `index.html`.
#' @return A `plumber` object.
#' @export
build_plumber_app <- function(static_dir = system.file("www", package = "prosecnurapp")) {
  # Poblar el registry AST con los tipos de regla default. Hay que hacerlo
  # aquí (no al source de validacion_ast_registry.R) porque el package
  # carga sus archivos en orden alfabético y los constructores viven en
  # `validacion_ast_rules.R` — más tarde. Al arrancar la app ya están
  # todos disponibles.
  ensure_registry_populated()

  pr <- plumber::pr() |>
    plumber::pr_set_serializer(.api_serializer()) |>
    plumber::pr_set_error(function(req, res, err) handle_api_error(req, res, err)) |>
    .api_label_overrides_hooks()

  pr <- mount_sistema(pr)
  if (is_public_mode()) {
    sid <- Sys.getenv("PULSO_BOOTSTRAP_SID", "")
    s <- if (nzchar(sid)) session_get(sid, required = FALSE) else NULL
    kind <- as.character(s$public_artifact$kind %||% "dashboard")[1]
    if (identical(kind, "monitoreo")) {
      pr <- mount_monitoreo(pr)
    } else {
      pr <- mount_dashboard(pr)
    }
  } else {
    pr <- mount_jobs(pr)
    pr <- mount_proyecto(pr)
    pr <- mount_project_overview(pr)
    pr <- mount_carga(pr)
    pr <- mount_equivalencias(pr)
    pr <- mount_origen_externo(pr)
    pr <- mount_base_variables(pr)
    pr <- mount_segmentos(pr)
    pr <- mount_codigos_observados(pr)
    pr <- mount_carga_fuentes(pr)
    pr <- mount_carga_formulario_publicado(pr)
    pr <- mount_carga_armonizacion(pr)
    pr <- mount_processing_intake(pr)
    pr <- mount_processing_release(pr)
    pr <- mount_acreditacion_sav(pr)
    pr <- mount_connections(pr)
    pr <- mount_xlsform_editor(pr)
    pr <- mount_xlsform_campanas(pr)
    pr <- mount_xlsform_sm_sugerencias(pr)
    pr <- mount_xlsform_logica_externa(pr)
    pr <- mount_surveymonkey_multibase(pr)
    pr <- mount_multi_integrated(pr)
    pr <- mount_estudio(pr)
    pr <- mount_validacion(pr)
    pr <- mount_codificacion(pr)
    pr <- mount_analitica(pr)
    pr <- mount_armonizada(pr)
    pr <- mount_ponderacion_bases(pr)
    pr <- mount_label_overrides(pr)
    pr <- mount_hojas_ruta(pr)
    pr <- mount_calc_muestra(pr)
    pr <- mount_calc_muestra_general(pr)
    pr <- mount_plan_trabajo(pr)
    pr <- mount_diseno_estudio(pr)
    pr <- mount_bitacora(pr)
    pr <- mount_recopiladores(pr)
    pr <- mount_monitoreo(pr)
    pr <- mount_monitoreo_telefonico(pr)
    pr <- mount_monitoreo_territorial_mapeo(pr)
    pr <- mount_monitoreo_aulas_plantilla(pr)
    pr <- mount_monitoreo_aulas_libro(pr)
    pr <- mount_monitoreo_aulas_avance(pr)
    pr <- mount_monitoreo_aulas_distribucion(pr)
    pr <- mount_graficos(pr)
    pr <- mount_graficos_consolidado(pr)
    pr <- mount_graficos_estandar(pr)
    pr <- mount_graficos_categorias(pr)
    pr <- mount_graficos_miniaturas(pr)
    pr <- mount_graficos_estilo(pr)
    pr <- mount_graficos_lineas(pr)
    pr <- mount_dashboard(pr)
  }

  # Modo público (deploy web): filtro de whitelist para que solo pasen
  # endpoints read-only del dashboard. NO-OP cuando PULSO_PUBLIC_MODE
  # no está activo (Electron local).
  pr <- apply_public_mode_filter(pr)

  if (nzchar(static_dir) && dir.exists(static_dir)) {
    pr <- plumber::pr_filter(pr, "frontend_no_cache", function(req, res) {
      path <- req$PATH_INFO
      if (is.null(path)) path <- req$path
      if (is.null(path)) path <- ""
      if (!startsWith(path, "/api/")) {
        res$setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        res$setHeader("Pragma", "no-cache")
        res$setHeader("Expires", "0")
      }
      plumber::forward()
    })
    pr <- plumber::pr_static(pr, "/", static_dir)
    pr <- plumber::pr_get(pr, "/<path:path>", function(req, res, path) {
      if (startsWith(path, "api/")) {
        res$status <- 404
        return(list(error = list(code = "E_NOT_FOUND", message = "Unknown API route")))
      }
      index <- file.path(static_dir, "index.html")
      if (file.exists(index)) plumber::include_file(index, res, content_type = "text/html")
      else {
        res$status <- 404
        list(error = list(code = "E_NO_FRONTEND", message = "Frontend build not found"))
      }
    })
  }

  pr
}

#' Run the app on localhost.
#'
#' @param host Host to bind. Default `"127.0.0.1"`.
#' @param port Port. Default `8787`.
#' @param static_dir Path to frontend build.
#' @param open_browser If TRUE, opens the default browser after boot.
#' @param shutdown_grace_secs Segundos máximos para esperar jobs activos antes
#'   de matar el proceso cuando se recibe /api/system/shutdown.
#' @export
run_app <- function(host = "127.0.0.1", port = 8787L,
                    static_dir = system.file("www", package = "prosecnurapp"),
                    open_browser = TRUE,
                    shutdown_grace_secs = 5) {
  pr <- build_plumber_app(static_dir = static_dir)
  url <- sprintf("http://%s:%d/", host, port)

  if (open_browser) {
    later::later(function() utils::browseURL(url), delay = 1.5)
  }

  tick_interval <- 0.5
  shutdown_deadline <- NULL

  tick <- function() {
    job_poll_all()

    if (shutdown_requested()) {
      if (is.null(shutdown_deadline)) {
        shutdown_deadline <<- Sys.time() + shutdown_grace_secs
        message("[prosecnur-app] Shutdown requested — esperando hasta ",
                shutdown_grace_secs, "s a que terminen jobs activos.")
      }
      running <- jobs_count_running()
      past_deadline <- Sys.time() >= shutdown_deadline
      if (running == 0L || past_deadline) {
        if (running > 0L) {
          message(sprintf("[prosecnur-app] Timeout con %d job(s) activos, matando.", running))
          jobs_kill_all()
        }
        message("[prosecnur-app] Shutdown: quit().")
        quit(save = "no", status = 0)
      }
    }

    later::later(tick, delay = tick_interval)
  }
  later::later(tick, delay = tick_interval)

  message(sprintf("[prosecnur-app] Listening on %s", url))
  plumber::pr_set_docs(pr, FALSE)
  plumber::pr_run(pr, host = host, port = port, quiet = FALSE)
}
