#!/usr/bin/env Rscript
# =============================================================================
# qa_graficos_medir.R — arnés de medición del motor de gráficos
# =============================================================================
#
# Nace de la sesión del 2026-08-11, donde se reportaron CUATRO conclusiones
# falsas seguidas, todas por medir un proxy en vez del dato. El contexto y las
# trampas están en docs/qa/registro-motor-graficos-2026-08-10.md §8.
#
# La regla que gobierna todo lo de aquí: **un aserto que no distingue el caso
# bueno del malo no verifica nada**. Cada medición lleva su control.
#
# USO
#   Rscript scripts/qa_graficos_medir.R <ruta.pulso> <comando>
#
#   render     Renderiza el mazo completo y deja el .pptx. Reporta láminas,
#              avisos del motor y láminas degradadas a «Sin datos».
#   roles      Qué tamaño recibe CADA rol de texto en cada llamada al
#              graficador. Es lo que zanja si hay inconsistencia tipográfica:
#              medirlo desde el .pptx por coordenada NO sirve (confunde
#              títulos de lámina con etiquetas de eje).
#   textos     Barre todo argumento de texto que llega al graficador buscando
#              un patrón (por defecto «…»), para saber si algo llega ya
#              recortado o si el recorte es del propio graficador.
#   escalas    Juegos de categorías del estudio, fusionando los idénticos, y
#              cuáles tienen rangos numéricos desordenados.
#   geometria  Sobre un .pptx ya renderizado: formas que se salen de la lámina
#              y textos truncados. Pásalo como tercer argumento.
#   avisos     Lo que el motor decidió por su cuenta y contó. Viajan por
#              `message()` con el sello `[PULSO-AVISO]`, NO por `warning()`:
#              el renderer se traga los warnings. Un truncado que no aparece
#              aquí es un truncado silencioso.
#
# NOTA sobre el render: se hace EN PROCESO, no por job `callr`. Es la única
# forma de instrumentar, porque el worker corre en un subproceso.

suppressWarnings(Sys.setlocale("LC_ALL", "en_US.UTF-8"))
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  cat("uso: Rscript scripts/qa_graficos_medir.R <ruta.pulso> <render|roles|textos|escalas|geometria> [extra]\n")
  quit(status = 1)
}
PULSO <- args[[1]]; CMD <- args[[2]]; EXTRA <- if (length(args) >= 3) args[[3]] else NULL

suppressMessages(pkgload::load_all("api", quiet = TRUE))
`%||%` <- function(x, y) if (!is.null(x)) x else y

# --- piezas comunes ----------------------------------------------------------

abrir <- function() {
  sid <- load_pulso(PULSO)$session_id
  cfg <- session_get(sid)$graficos_config
  # El proyecto puede declarar un ícono cuyo PNG no viaje en el zip; se
  # sustituye para que el render no muera por eso durante una medición.
  stub <- tempfile(fileext = ".png")
  grDevices::png(stub, 64, 64); graphics::par(mar = c(0, 0, 0, 0))
  graphics::plot.new(); grDevices::dev.off()
  for (i in seq_along(cfg$iconos)) cfg$iconos[[i]]$path <- stub
  list(sid = sid, cfg = cfg, sc = .graficos_processing_sources(sid))
}

construir_slides <- function(ctx) {
  .graficos_job_rebuild_slides(
    .graficos_calificar_refs_plan(.normalize_plan(ctx$cfg$plan),
                                  .graficos_active_base_name(ctx$sid)),
    setNames(lapply(.slide_names(), function(nm)
      list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names()),
    .graf_names(), .graficos_icon_registry(ctx$sid, ctx$cfg),
    report = function(...) NULL, base_error = function(m) m, item_label = "slide")
}

#' Render EN PROCESO. Devuelve la ruta del .pptx y las láminas degradadas.
#'
#' `auto_otros_slides = FALSE` a propósito: es el default del registro. Forzarlo
#' a TRUE fue una de las cuatro trampas — se validaba un mazo que la app no
#' produce.
renderizar <- function(ctx, out = tempfile(fileext = ".pptx")) {
  pres <- .build_presets(.enriquecer_presets(ctx$cfg$presets, ctx$cfg$debug_ph))
  slides_r <- construir_slides(ctx)
  caidas <- character(0)
  withCallingHandlers(
    invisible(reporte_ppt_plan(
      data = ctx$sc$data_sources, instrumento = ctx$sc$inst_sources,
      path_ppt = out, presets = pres, plan = p_plan(slides = slides_r),
      template_pptx = NULL, template_id = NULL,
      auto_otros_slides = FALSE, mensajes_progreso = FALSE)),
    warning = function(w) {
      m <- conditionMessage(w)
      if (grepl("degradada|Sin datos|fallo al ejecutarse", m)) caidas <<- c(caidas, m)
      invokeRestart("muffleWarning")
    })
  list(path = out, n = length(slides_r), caidas = caidas)
}

#' Instrumenta el graficador con `trace()`.
#'
#' NUNCA sustituir el binding por un `function(...)`: el renderer filtra los
#' argumentos contra `formals(fun)`, y un envoltorio sin formals hace que la
#' llamada reviente con «unused arguments». Eso se reportó como un defecto del
#' producto y era del arnés. `trace()` conserva la firma.
con_traza <- function(tracer_quote, fn = "graficar_barras_apiladas") {
  ns <- asNamespace("prosecnurapp")
  trace(fn, where = ns, print = FALSE, tracer = tracer_quote)
  on.exit(suppressMessages(untrace(fn, where = ns)), add = TRUE)
  ctx <- abrir()
  invisible(suppressWarnings(renderizar(ctx)))
}

# --- comandos ----------------------------------------------------------------

if (CMD == "render") {
  ctx <- abrir()
  out <- EXTRA %||% file.path(tempdir(), "qa_graficos.pptx")
  r <- renderizar(ctx, out)
  cat("láminas:", r$n, "\n")
  cat("láminas degradadas a «Sin datos»:", length(r$caidas), "\n")
  for (m in unique(r$caidas)) cat("   ·", substr(m, 1, 150), "\n")
  cat("pptx:", r$path, "\n")

} else if (CMD == "roles") {
  REG <- new.env(parent = emptyenv()); assign("n", 0L, envir = REG)
  con_traza(quote({
    i <- get("n", envir = REG) + 1L; assign("n", i, envir = REG)
    cap <- function(nm) {
      v <- tryCatch(get(nm, envir = environment()), error = function(e) NULL)
      if (is.null(v) || !length(v)) NA_real_ else suppressWarnings(as.numeric(v)[1])
    }
    assign(paste0("c", i), c(
      ejes = cap("size_ejes"), leyenda = cap("size_leyenda"),
      barras = cap("size_texto_barras"), extra = cap("size_titulo_extra")
    ), envir = REG)
  }))
  n <- get("n", envir = REG)
  cat("llamadas al graficador:", n, "\n\n")
  if (n > 0) {
    m <- do.call(rbind, lapply(seq_len(n), function(i) get(paste0("c", i), envir = REG)))
    for (rol in colnames(m)) {
      v <- m[, rol]; v <- v[is.finite(v)]
      if (!length(v)) { cat(sprintf("%-9s sin dato\n", rol)); next }
      tb <- table(round(v, 2))
      cat(sprintf("%-9s %d valor(es) distinto(s): %s\n", rol, length(tb),
                  paste(sprintf("%s x%d", names(tb), as.integer(tb)), collapse = " · ")))
    }
    cat("\nUn solo valor por rol = el motor es consistente. Varios = medir CUÁL\n",
        "gráfico difiere antes de tocar nada.\n")
  }

} else if (CMD == "textos") {
  patron <- EXTRA %||% "…"
  REG <- new.env(parent = emptyenv()); assign("hit", list(), envir = REG)
  assign("PAT", patron, envir = globalenv())
  con_traza(quote({
    e <- environment(); cand <- list()
    d <- tryCatch(get("data", envir = e), error = function(x) NULL)
    if (is.data.frame(d)) for (cn in names(d))
      if (is.character(d[[cn]]) || is.factor(d[[cn]])) cand[[paste0("data$", cn)]] <- as.character(d[[cn]])
    for (nm in c("titulos_grupo", "etiquetas_grupos", "titulo", "subtitulo", "nota_pie"))
      cand[[nm]] <- tryCatch(as.character(get(nm, envir = e)), error = function(x) character(0))
    h <- get("hit", envir = REG)
    for (nm in names(cand)) {
      v <- cand[[nm]]; v <- v[!is.na(v) & grepl(get("PAT", envir = globalenv()), v, fixed = TRUE)]
      if (length(v)) h[[nm]] <- unique(c(h[[nm]] %||% character(0), v))
    }
    assign("hit", h, envir = REG)
  }))
  h <- get("hit", envir = REG)
  cat("patrón buscado: «", patron, "»\n", sep = "")
  if (!length(h)) {
    cat("NINGÚN argumento de texto llega con ese patrón.\n",
        "Ojo: la etiqueta que se dibuja sale de `var_etiqueta_categoria`,\n",
        "no de `var_categoria`, y el dato guarda CÓDIGOS, no etiquetas.\n")
  } else for (nm in names(h)) {
    cat(sprintf("%-26s %d con el patrón\n", nm, length(h[[nm]])))
    for (x in head(h[[nm]], 3)) cat("     ·", substr(x, 1, 90), "\n")
  }

} else if (CMD == "escalas") {
  ctx <- abrir()
  ls <- Filter(function(l) length(l$choices) >= 2,
               .graficos_collect_palette_lists(ctx$sc$inst_sources))
  et <- function(l) vapply(l$choices, function(c) as.character(c$label), character(1))
  firma <- vapply(ls, function(l) paste(sort(tolower(trimws(et(l)))), collapse = " | "), character(1))
  tb <- sort(table(firma), decreasing = TRUE)
  cat(sprintf("listas: %d · juegos de categorías DISTINTOS: %d\n\n", length(ls), length(tb)))
  for (f in names(tb)) cat(sprintf("%3d listas · %s\n", tb[[f]], substr(f, 1, 96)))
  num1 <- function(x) { m <- regmatches(x, regexpr("[0-9]+", x))
                        suppressWarnings(as.numeric(ifelse(nchar(m), m, NA))) }
  cat("\n=== con rangos numéricos DESORDENADOS ===\n")
  for (l in ls) {
    e <- et(l); n <- num1(e)
    if (length(e) >= 3 && all(is.finite(n)) && !identical(order(n), seq_along(n)))
      cat("  ", l$list_name, "->", paste(e[order(n)], collapse = " | "), "\n")
  }
  cat("\nOJO: ordenar por el primer número falla cuando la escala mezcla\n",
      "unidades («Más de 1 año» vs «Menos de 2 meses»). Revisar a ojo.\n")

} else if (CMD == "avisos") {
  ctx <- abrir()
  vistos <- character(0)
  withCallingHandlers(
    invisible(renderizar(ctx)),
    message = function(m) {
      txt <- conditionMessage(m)
      if (grepl(.PULSO_AVISO_SELLO, txt, fixed = TRUE)) {
        vistos <<- c(vistos, trimws(sub(paste0(".*\\", .PULSO_AVISO_SELLO), "", txt)))
      }
      invokeRestart("muffleMessage")
    })
  cat("avisos emitidos:", length(vistos), "· distintos:", length(unique(vistos)), "\n\n")
  tb <- sort(table(vistos), decreasing = TRUE)
  for (a in names(tb)) cat(sprintf("  x%-3d %s\n", tb[[a]], substr(a, 1, 150)))
  if (!length(vistos)) {
    cat("Ninguno. Si el mazo tiene «…» o columnas omitidas, el motor está\n",
        "decidiendo en silencio: ese es el defecto, no la ausencia de avisos.\n")
  }

} else if (CMD == "geometria") {
  pptx <- EXTRA
  if (is.null(pptx) || !file.exists(pptx)) { cat("falta la ruta del .pptx como tercer argumento\n"); quit(status = 1) }
  dir <- file.path(tempdir(), "qa_pptx"); unlink(dir, recursive = TRUE); dir.create(dir)
  utils::unzip(pptx, exdir = dir)
  pres <- readLines(file.path(dir, "ppt", "presentation.xml"), warn = FALSE) |> paste(collapse = "")
  m <- regmatches(pres, regexec('sldSz[^/]*cx="([0-9]+)"\\s+cy="([0-9]+)"', pres))[[1]]
  W <- as.numeric(m[2]); H <- as.numeric(m[3]); EMU <- 914400
  fs <- list.files(file.path(dir, "ppt", "slides"), pattern = "^slide[0-9]+[.]xml$", full.names = TRUE)
  fuera <- 0; trunc <- 0; peor <- 0; laminas <- integer(0)
  for (f in fs) {
    n <- as.integer(gsub("\\D", "", basename(f)))
    s <- paste(readLines(f, warn = FALSE), collapse = "")
    trunc <- trunc + length(gregexpr("…</a:t>", s)[[1]][gregexpr("…</a:t>", s)[[1]] > 0])
    for (sp in regmatches(s, gregexpr("<p:sp>.*?</p:sp>", s))[[1]]) {
      o <- regmatches(sp, regexec('<a:off x="(-?[0-9]+)" y="(-?[0-9]+)"/>', sp))[[1]]
      e <- regmatches(sp, regexec('<a:ext cx="([0-9]+)" cy="([0-9]+)"/>', sp))[[1]]
      if (length(o) < 3 || length(e) < 3) next
      x <- as.numeric(o[2]); y <- as.numeric(o[3]); cx <- as.numeric(e[2]); cy <- as.numeric(e[3])
      exc <- max(-x, -y, x + cx - W, y + cy - H)
      if (exc > 0) { fuera <- fuera + 1; peor <- max(peor, exc); laminas <- union(laminas, n) }
    }
  }
  cat("láminas:", length(fs), "\n")
  cat(sprintf("formas fuera de lámina: %d en %d láminas (%s) · peor %.1f mm\n",
              fuera, length(laminas), paste(sort(laminas), collapse = ", "), peor / EMU * 25.4))
  cat("textos truncados con «…»:", trunc, "\n")

} else {
  cat("comando desconocido:", CMD, "\n"); quit(status = 1)
}
