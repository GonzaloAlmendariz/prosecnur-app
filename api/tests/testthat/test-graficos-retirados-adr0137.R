source("setup-load-all.R")

# ADR 0137, Fase 1 (compatibilidad, sin borrar nada): la tabla de letras entre públicos y la familia de dimensiones
# salen del catálogo. Un plan guardado conserva `graficador` y `args` tal cual; validar advierte sin bloquear; el
# rearmado, la miniatura y la vista previa dejan la ranura en blanco con su título y un aviso de la lámina que no cita
# el ADR; los presets `dim_*` guardados se ignoran sin aviso; el GET de la config no toca el plan ni marca el proyecto.
# Sólo `p_dim_heatmap` con una pregunta tiene equivalente 1:1 (test-heatmap-cruce.R).

.RET_TIPOS <- c("p_significancia_publicos", "p_dim_radar", "p_dim_heatmap", "p_dim_heatmap_criterios",
                "p_dim_comparativo_radarbar", "p_dim_foda", "p_dim_radar_tabla")

# Un slot por tipo, con args plausibles de cada uno (lo que el editor guardaba).
.ret_args <- list(
  p_significancia_publicos = list(vars = list(Satisfacción = list("est$p1", "doc$p1")), corte = list("4", "5"), titulo = "Letras"),
  p_dim_radar = list(modo = "general", objetivo = "idx_comp", cruce = "ciclo", titulo = "Radar"),
  p_dim_heatmap = list(modo = "general", objetivo = "idx_comp", cruce = "ciclo", titulo = "Calor"),
  p_dim_heatmap_criterios = list(config_criterios = list(list(nombre = "A", vars = list("p1", "p2"))), titulo = "Criterios"),
  p_dim_comparativo_radarbar = list(modo = "general", objetivo = "idx_comp", cruce = "ciclo"),
  p_dim_foda = list(nivel = "subindices", modo_foda = "matriz"),
  p_dim_radar_tabla = list(modo = "general", objetivo = "idx_comp")
)
.ret_plan <- function() list(slides = lapply(seq_along(.RET_TIPOS), function(i) {
  g <- .RET_TIPOS[[i]]
  list(id = paste0("s", i), tipo = "p_slide_1_grafico",
       payload = list(titulo = paste("Lámina de", g), grafico = list(graficador = g, args = .ret_args[[g]])))
}))
.ret_avisos <- function(expr) {
  out <- character()
  val <- withCallingHandlers(expr, message = function(m) {
    if (grepl("[PULSO-AVISO]", conditionMessage(m), fixed = TRUE)) out <<- c(out, conditionMessage(m))
    invokeRestart("muffleMessage")
  })
  list(valor = val, avisos = out)
}

test_that("la tabla de retirados es de literales congelados: los siete tipos, con nombre, ADR y reemplazo", {
  expect_identical(names(.GRAFICADORES_RETIRADOS), .RET_TIPOS)
  for (nm in .RET_TIPOS) {
    f <- .GRAFICADORES_RETIRADOS[[nm]]
    expect_true(nzchar(f$titulo_humano), label = nm)
    expect_identical(f$adr, "0137")
    expect_true(nzchar(f$reemplazo$texto), label = nm)
    # El reemplazo, si nombra un graficador, es uno vigente (no otro retirado).
    if (nzchar(f$reemplazo$graficador)) {
      expect_true(f$reemplazo$graficador %in% .graf_names(), label = nm)
      expect_false(.graficos_es_retirado(f$reemplazo$graficador), label = nm)
    }
  }
  # No consulta el registro: el que ya no está en él (p_dim_radar_tabla) también tiene ficha.
  expect_false("p_dim_radar_tabla" %in% .graf_names())
  expect_identical(.graficos_retirado_ficha("p_dim_radar_tabla")$adr, "0137")
})

test_that("validar: los siete tipos advierten y el plan sigue exportable; ningún texto cita el ADR", {
  v <- .validar_plan_json(.ret_plan())
  expect_true(v$ok)
  expect_length(v$errors, 0L)
  ret <- v$warnings[grepl("que ya no existe", v$warnings, fixed = TRUE)]
  expect_length(ret, 7L)
  expect_match(ret[1], "^Lámina 1, “Lámina de p_significancia_publicos”: el espacio \"Gráfico principal\" usa \"Diferencias significativas entre públicos\", que ya no existe; sale en blanco. Cámbialo por las tarjetas de diferencias de un gráfico con cruce.$")
  expect_false(any(grepl("0137|ADR", v$warnings)))
})

test_that("un tipo desconocido que no está retirado sigue siendo un error (E_UNKNOWN_GRAF al rearmar)", {
  plan <- list(slides = list(list(id = "x", tipo = "p_slide_1_grafico",
                                  payload = list(titulo = "X", grafico = list(graficador = "p_no_existe", args = list(var = "a"))))))
  v <- .validar_plan_json(plan)
  expect_false(v$ok)
  err <- tryCatch(.rebuild_graf(list(graficador = "p_no_existe", args = list(var = "a"))), error = identity)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_UNKNOWN_GRAF")
})

test_that("rearmar (router y worker): la ranura sale en blanco con su título y un aviso de la lámina, sin stop()", {
  for (i in setdiff(seq_along(.RET_TIPOS), 3L)) {   # el 3 (p_dim_heatmap) se redirige: test-heatmap-cruce.R
    slide <- .ret_plan()$slides[[i]]
    for (rearmar in list(.rebuild_slide, .graficos_rebuild_slide_json)) {
      r <- .ret_avisos(.aviso_con_lamina(i, slide$payload$titulo, rearmar(slide)))
      g <- r$valor$slots$plot
      expect_identical(g$.element_type, "ggplot_raw", label = .RET_TIPOS[[i]])
      expect_length(r$avisos, 1L)
      expect_match(r$avisos, sprintf("Lámina %d, “Lámina de %s”: el gráfico \"%s\" ya no existe y sale en blanco. Cámbialo por ",
                                     i, .RET_TIPOS[[i]], .GRAFICADORES_RETIRADOS[[i]]$titulo_humano), fixed = TRUE)
      expect_false(grepl("0137|ADR", r$avisos))
      # El título del gráfico se conserva cuando lo había.
      if (!is.null(.ret_args[[i]]$titulo)) expect_identical(g$title_slide, .ret_args[[i]]$titulo)
    }
  }
})

test_that("miniaturas: el rearmado anota `tipo_retirado` y no se cae", {
  conteo <- new.env()
  slide <- .ret_plan()$slides[[2]]
  r <- .ret_avisos(.mini_rebuild_slide(slide, conteo = conteo))
  expect_identical(r$valor$slots$plot$.element_type, "ggplot_raw")
  expect_identical(conteo$motivos, "tipo_retirado")
  res <- .mini_resumen_graficos(conteo$pedidos, conteo$motivos)
  expect_identical(res$graficos_vacios, 1L)
})

test_that("el mazo se arma con todas las ranuras retiradas y no cita el ADR", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  plan <- .ret_avisos(lapply(.ret_plan()$slides[-3], .rebuild_slide))$valor
  names(plan) <- paste0("s", seq_along(plan))
  out <- tempfile(fileext = ".pptx"); on.exit(unlink(out))
  dat <- data.frame(ciclo = c("1", "2"), p1 = c("1", "2"), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("ciclo", "p1"), type = c("select_one c", "select_one c"), list_name = "c", label = c("Ciclo", "P1"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = "c", name = c("1", "2"), label = c("A", "B"), stringsAsFactors = FALSE))
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  xs <- utils::unzip(out, list = TRUE)$Name
  slides <- grep("^ppt/slides/slide[0-9]+\\.xml$", xs, value = TRUE)
  expect_length(slides, 6L)
  txt <- paste(vapply(slides, function(f) paste(readLines(unz(out, f), warn = FALSE), collapse = ""), ""), collapse = "")
  expect_false(grepl("0137|ADR", txt))
})

test_that("los presets dim_* guardados se ignoran sin aviso", {
  presets <- list(dim_radar = list(args = list(size_ejes = 99)), dim_foda = list(args = list(x = 1)),
                  dim_heatmap = list(args = list(size_ejes = 77)))
  expect_silent(out <- .build_presets(presets))
  expect_false(identical(out$dim_radar$args$size_ejes, 99))
  expect_false(identical(out$dim_heatmap$args$size_ejes, 77))
  expect_identical(.graficos_retirados_quitar_presets(list(barras_apiladas = list(args = list()), dim_foda = list())),
                   list(barras_apiladas = list(args = list())))
})

test_that("la migración del plan no toca los retirados: nada pasa por `.graficos_migrar_plan()`", {
  plan <- .ret_plan()
  m <- .graficos_migrar_plan(plan, avisar = TRUE)
  expect_length(.graficos_avisos_migracion(m), 0L)
  attr(m, "avisos_migracion") <- NULL
  expect_identical(m, plan)
})

# --- GET de la config y .pulso --------------------------------------------------------------------------------------
.ret_get_config <- function(sid) {
  testthat::local_mocked_bindings(session_header = function(req) sid, .package = "prosecnurapp")
  pr <- mount_graficos(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  ep <- endpoints[[which(vapply(endpoints, function(e) identical(e$path, "/api/graficos/config") && "GET" %in% e$verbs, TRUE))]]
  req <- new.env(parent = emptyenv()); res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  ep$getFunc()(req, res)
}
.ret_slots <- function(plan) lapply(plan$slides, function(s) s$payload$grafico)

test_that("GET config: no cambia el plan guardado, no marca el proyecto ni repite avisos", {
  skip_if_not_installed("plumber")
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "graficos_config", list(plan = .ret_plan()))
  session_set(sid, "project_dirty", FALSE)
  for (k in 1:2) {
    r <- .ret_avisos(.ret_get_config(sid))
    expect_length(as.character(unclass(r$valor$avisos)), 0L)
    expect_length(r$avisos, 0L)
    expect_identical(.ret_slots(r$valor$config$plan), .ret_slots(.ret_plan()))
  }
  expect_identical(session_get(sid)$graficos_config, list(plan = .ret_plan()))
  expect_false(isTRUE(session_get(sid)$project_dirty))
})

test_that("guardar y reabrir el .pulso conserva graficador y args de los retirados", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "graficos_config", list(plan = .ret_plan()))
  dest <- tempfile(fileext = ".pulso"); on.exit(unlink(dest), add = TRUE)
  suppressMessages(build_pulso(sid, dest, project_name = "ret", allow_empty_overwrite = TRUE))
  r <- suppressMessages(load_pulso(dest)); on.exit(session_delete(r$session_id), add = TRUE)
  expect_identical(.ret_slots(session_get(r$session_id)$graficos_config$plan), .ret_slots(.ret_plan()))
})

test_that("registry: el campo aditivo `retirados` lista los siete con nombre, ADR y reemplazo", {
  reg <- .graficos_registry_payload()
  expect_true("retirados" %in% names(reg))
  ret <- unclass(reg$retirados)
  expect_identical(vapply(ret, function(x) x$name, ""), .RET_TIPOS)
  for (x in ret) {
    expect_setequal(names(x), c("name", "titulo_humano", "adr", "reemplazo"))
    expect_setequal(names(x$reemplazo), c("texto", "graficador"))
  }
  j <- jsonlite::fromJSON(as.character(jsonlite::toJSON(reg["retirados"], auto_unbox = TRUE)), simplifyVector = FALSE)
  expect_identical(j$retirados[[3]]$reemplazo$graficador, "p_media_rango")
  expect_identical(j$retirados[[1]]$reemplazo$graficador, "")
})
