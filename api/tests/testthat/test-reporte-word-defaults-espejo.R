source("setup-load-all.R")

# El default Word de las barras apiladas vive en dos capas: `.WORD_CHART_PRESETS_DEFAULT_PULSO` (api/R/reporte_plan_word.R)
# y su espejo DEFAULT_WORD_PRESETS (frontend/src/api/graficosConfigNormalizer.ts), que el editor guarda en el proyecto y
# manda de vuelta al motor. Si divergen, el front pisa al motor: así llegó a apagarse el Top Two Box que el recetario
# dibuja en toda escala apilada del Word (propuesta-word.docx, figuras 13, 44, 45 y 47) y a salir la leyenda en 6 pt.

.wde_ts_path <- function() {
  normalizePath(file.path(testthat::test_path(), "..", "..", "..", "frontend", "src", "api", "graficosConfigNormalizer.ts"),
                mustWork = FALSE)
}

# Bloque `familia` de DEFAULT_WORD_PRESETS como lista nombrada de R (literales true/false, "texto" y números); `NULL`
# si el espejo no declara la familia.
.wde_ts_bloque <- function(path, familia = "barras_apiladas") {
  src <- readLines(path, warn = FALSE, encoding = "UTF-8")
  ini <- grep("export const DEFAULT_WORD_PRESETS", src, fixed = TRUE)
  expect_length(ini, 1L)
  bloque <- grep(paste0("^\\s*", familia, ":\\s*\\{"), src)
  bloque <- bloque[bloque > ini][1]
  if (is.na(bloque)) return(NULL)
  fin <- bloque + which(grepl("^\\s*\\},?\\s*$", src[(bloque + 1):length(src)]))[1]
  lineas <- src[(bloque + 1):(fin - 1)]
  lineas <- lineas[grepl("^\\s*[a-z_0-9]+:\\s*", lineas)]
  claves <- sub("^\\s*([a-z_0-9]+):.*$", "\\1", lineas)
  valores <- lapply(sub("^\\s*[a-z_0-9]+:\\s*(.*?),?\\s*$", "\\1", lineas, perl = TRUE), function(v) {
    if (v %in% c("true", "false")) return(identical(v, "true"))
    if (grepl('^".*"$', v)) return(sub('^"(.*)"$', "\\1", v))
    as.numeric(v)
  })
  stats::setNames(valores, claves)
}

test_that("DEFAULT_WORD_PRESETS del front es el mismo default Word de las apiladas que el del motor", {
  path <- .wde_ts_path()
  skip_if_not(file.exists(path), "sin el árbol del frontend (R CMD check)")
  ts <- .wde_ts_bloque(path, "barras_apiladas")
  r <- .WORD_CHART_PRESETS_DEFAULT_PULSO$barras_apiladas
  expect_setequal(names(ts), names(r))
  for (k in intersect(names(ts), names(r))) {
    expect_equal(ts[[k]], if (is.numeric(r[[k]])) as.numeric(r[[k]]) else r[[k]], info = k)
  }
  # Lo que el recetario dibuja: la columna Top Two Box, con ancho para ella en el lienzo clásico.
  expect_true(isTRUE(ts$mostrar_barra_extra))
  expect_identical(ts$barra_extra_preset, "top2box")
  expect_gt(ts$canvas_w_extra, 0)
  expect_equal(ts$canvas_w_etiquetas + ts$canvas_w_buf_etq_bars + ts$canvas_w_bars + ts$canvas_w_buf_bars_extra + ts$canvas_w_extra, 1)
})

test_that("DEFAULT_WORD_PRESETS del front espeja también el default Word de las multiapiladas", {
  # Sin este espejo el editor no sabía que el Word de fábrica apaga la columna extra de los bloques multiactor
  # (twoBoxWord.ts la suplía con un suelo propio) ni con qué lienzo los calibra.
  path <- .wde_ts_path()
  skip_if_not(file.exists(path), "sin el árbol del frontend (R CMD check)")
  ts <- .wde_ts_bloque(path, "multi_apiladas")
  expect_false(is.null(ts), info = "DEFAULT_WORD_PRESETS.chart_presets.multi_apiladas")
  r <- .WORD_CHART_PRESETS_DEFAULT_PULSO$multi_apiladas
  expect_setequal(names(ts), names(r))
  for (k in intersect(names(ts), names(r))) {
    expect_equal(ts[[k]], if (is.numeric(r[[k]])) as.numeric(r[[k]]) else r[[k]], info = k)
  }
  expect_false(isTRUE(ts$mostrar_barra_extra))
})

# El árbol COMPLETO de DEFAULT_WORD_PRESETS (chart_options incluido) como lista de R. Con el diff del ADR 0094 una deriva
# del espejo ya no es inocua: lo que el front crea default y el motor no, se guardaría como decisión del analista.
.wde_ts_arbol <- function(path) {
  src <- readLines(path, warn = FALSE, encoding = "UTF-8")
  ini <- grep("export const DEFAULT_WORD_PRESETS", src, fixed = TRUE)
  expect_length(ini, 1L)
  fin <- ini + which(grepl("^\\};\\s*$", src[(ini + 1):length(src)]))[1]
  cuerpo <- src[ini:fin]
  cuerpo[1] <- sub("^.*?=\\s*\\{", "{", cuerpo[1], perl = TRUE)
  cuerpo <- sub("\\s*//.*$", "", cuerpo)                                       # comentarios de línea
  txt <- paste(cuerpo, collapse = "\n")
  txt <- sub(";\\s*$", "", txt)
  txt <- gsub("([{,]\\s*)([A-Za-z_][A-Za-z_0-9]*)\\s*:", "\\1\"\\2\":", txt, perl = TRUE)   # claves sin comillas
  txt <- gsub(",(\\s*[}\\]])", "\\1", txt, perl = TRUE)                        # comas finales
  jsonlite::fromJSON(txt, simplifyVector = FALSE)
}

.wde_num <- function(x) if (is.list(x)) lapply(x, .wde_num) else if (is.numeric(x)) as.numeric(x) else x
.wde_ord <- function(x) { if (!is.list(x)) return(x); if (!is.null(names(x))) x <- x[order(names(x))]; lapply(x, .wde_ord) }

test_that("DEFAULT_WORD_PRESETS del front espeja el árbol entero de .WORD_PRESETS_DEFAULT_PULSO (ADR 0094)", {
  path <- .wde_ts_path()
  skip_if_not(file.exists(path), "sin el árbol del frontend (R CMD check)")
  ts <- .wde_ts_arbol(path)
  r <- .WORD_PRESETS_DEFAULT_PULSO
  expect_setequal(names(ts), names(r))
  expect_setequal(names(ts$chart_presets), names(r$chart_presets))
  expect_equal(.wde_ord(.wde_num(ts)), .wde_ord(.wde_num(r)))
})

test_that("GET /api/graficos/config publica como defaults el mismo default Word que guarda el diff", {
  skip_if_not_installed("plumber")
  sid <- session_create(); withr::defer(session_delete(sid))
  testthat::local_mocked_bindings(session_header = function(req) sid, .package = "prosecnurapp")
  pr <- mount_graficos(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  ep <- endpoints[[which(vapply(endpoints, function(e) identical(e$path, "/api/graficos/config") && "GET" %in% e$verbs, TRUE))]]
  res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  out <- ep$getFunc()(new.env(parent = emptyenv()), res)
  expect_identical(out$defaults$w_presets, .WORD_PRESETS_DEFAULT_PULSO)
  expect_identical(out$defaults$documento_word, list(portada = "A", apertura = "B", como_leer = "auto"))
  expect_false("defaults" %in% names(out$config))   # hermano de config, no dentro: no se persiste
  # Viaja por JSON con la forma que lee el front.
  j <- jsonlite::fromJSON(as.character(jsonlite::toJSON(out$defaults, auto_unbox = TRUE)), simplifyVector = FALSE)
  expect_identical(j$w_presets$chart_presets$barras_apiladas$barra_extra_preset, "top2box")
})

.wde_inst <- function() {
  list(
    survey = data.frame(name = "p12", type = "select_one likert5", list_name = "likert5",
                        label = "La gestión del decanato es adecuada", stringsAsFactors = FALSE),
    choices = data.frame(list_name = "likert5", name = as.character(1:5),
                         label = c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo",
                                   "De acuerdo", "Totalmente de acuerdo"), stringsAsFactors = FALSE),
    orders_list = NULL
  )
}

.wde_render_word <- function(overrides, presets_ppt = do.call(p_presets, .PRESETS_DEFAULT_PULSO), presets_word = w_presets()) {
  data <- list(docentes = data.frame(p12 = c("1", "2", rep("4", 17), rep("5", 31)), stringsAsFactors = FALSE))
  plan <- list(diapo_001 = p_slide_1_grafico(grafico = p_barras_apiladas(var = "docentes$p12", overrides = overrides)))
  meta <- reporte_ppt_plan(data = data, instrumento = list(docentes = .wde_inst()), plan = plan,
                           presets = .apply_word_chart_presets(presets_ppt, presets_word),
                           solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE)$render_meta
  charts <- Filter(function(m) identical(m$kind %||% "chart", "chart"), meta)
  expect_length(charts, 1L)
  g <- .word_grafico(charts[[1]]$plot_word)
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  list(g = g, espec = attr(charts[[1]]$plot_word, "pulso_espec"),
       textos = unlist(lapply(b$data, function(l) if ("label" %in% names(l)) as.character(l$label))))
}

.wde_t2b <- c("De acuerdo", "Totalmente de acuerdo")

test_that("una apilada nueva sale con su Top Two Box en el Word del recetario", {
  skip_if_not_installed("ggplot2")
  # Nueva: sólo declara qué categorías suman (la decisión metodológica que `.box_decidir` exige); ni el gráfico ni el
  # informe encienden la columna, la trae el default.
  w <- .wde_render_word(list(top2box_labels = .wde_t2b))
  expect_identical(attr(w$g, "renderer"), "escala")
  expect_false(is.null(w$espec$box))
  expect_true(all(c("Top Two Box", "96%") %in% w$textos))   # 17 + 31 de 50
  # Sin categorías declaradas no hay box que inventar: la columna no aparece aunque el default la pida.
  w0 <- .wde_render_word(list())
  expect_false("Top Two Box" %in% w0$textos)
})

test_that("el Word respeta el Top Two Box apagado por el gráfico o por el informe", {
  skip_if_not_installed("ggplot2")
  off_grafico <- .wde_render_word(list(top2box_labels = .wde_t2b, mostrar_barra_extra = FALSE))
  expect_false("Top Two Box" %in% off_grafico$textos)
  ppt <- do.call(p_presets, .PRESETS_DEFAULT_PULSO)
  ppt$barras_apiladas$args$barra_extra_preset <- "ninguno"
  off_informe <- .wde_render_word(list(top2box_labels = .wde_t2b), presets_ppt = ppt)
  expect_false("Top Two Box" %in% off_informe$textos)
})
