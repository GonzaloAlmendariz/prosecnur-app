# Batería de escala con Bottom Two Box: la forma la decide el largo de las premisas (decisión «2c» de Gonzalo).
# Premisas cortas -> filas con las dos columnas de box (lámina 97 del recetario); alguna larga -> bloque de premisas
# (láminas 221/222). El largo se mide con `.lam_lineas_tinta` en la columna de rótulos de la forma en filas (1.8 in,
# 12 pt) contra `.LAM_ESCALA_FILAS_LINEAS_MAX`. Sólo cambia la composición: cifras, bases y orden son los de la espec.
# Sin Bottom Two Box nada cambia, y la fila Total sigue mandando a filas.

.fl_niv <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF")
.fl_cortas <- c("Trato del personal", "Tiempo de atención", "Claridad de la información", "Infraestructura")   # lámina 97
.fl_largas <- c(
  "Considero que el personal administrativo de la Unidad tiene funciones claramente definidas.",
  "Existen evaluaciones periódicas para promociones y ascensos del personal administrativo de la Unidad realizados por la Universidad.",
  "Estoy satisfecho(a) con los programas de motivación e incentivos que me brinda la Universidad como su trabajador(a).")   # 221/222

.fl_espec <- function(rotulos, bottom = TRUE, total = FALSE, actor = NULL) {
  n <- length(rotulos)
  d <- data.frame(item = sprintf("i%d", seq_len(n)), rot = rotulos, N = c(120, 90, 60, 150, 75, 40)[seq_len(n)],
                  t1 = .08, t2 = .12, t3 = .45, t4 = .30, t5 = .05, stringsAsFactors = FALSE)
  args <- list(d, "item", "N", paste0("t", 1:5), setNames(.fl_niv, paste0("t", 1:5)), var_etiqueta_categoria = "rot",
               colores_grupos = as.list(setNames(.std_paleta("likert"), .fl_niv)), barra_extra_preset = "top2box",
               top2box_labels = .fl_niv[3:4], fila_total = total)
  if (bottom) args <- c(args, list(columna_bottom2box = TRUE, bottom2box_labels = .fl_niv[1:2]))
  e <- do.call(preparar_escala, args)
  if (!is.null(actor)) { e$filas$grupo_id <- actor; e$filas$grupo_titulo <- "Premisa" }
  e
}

# Formas con nombre dentro del grupo del gráfico de escala, en pulgadas.
.fl_formas <- function(x, nombre) {
  xml <- xml2::read_xml(x)
  sp <- xml2::xml_find_all(xml, sprintf("//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:escala']]/p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  num <- function(path, attr) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, path), attr)) / 914400
  data.frame(t = xml2::xml_text(sp), x = num("./p:spPr/a:xfrm/a:off", "x"), y = num("./p:spPr/a:xfrm/a:off", "y"),
             w = num("./p:spPr/a:xfrm/a:ext", "cx"), h = num("./p:spPr/a:xfrm/a:ext", "cy"), stringsAsFactors = FALSE)
}
.fl_sin_solape <- function(f) { f <- f[order(f$y), ]; nrow(f) < 2L || all(f$y[-1] >= (f$y + f$h)[-nrow(f)] - 1e-6) }

# Láminas del motor para una espec, como XML.
.fl_laminas <- function(e) {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- suppressMessages(.lam_laminas_escala(doc, e, "Satisfacción con la atención", base = "Base: 120", folio = 1))
  lapply(seq_len(o$partes), function(k) as.character(o$doc$slide$get_slide(length(o$doc) - o$partes + k)$get()))
}

# Ruta real: una lámina del plan con su gráfico.
.fl_plan <- function(labs, el_fn) {
  set.seed(97); vars <- sprintf("p%d", seq_along(labs))
  df <- as.data.frame(setNames(lapply(vars, function(v) sample(.fl_niv, 120, TRUE, prob = c(.08, .12, .45, .3, .05))), vars),
                      stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = vars, type = "select_one lk", list_name = "lk", label = labs, stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lk", name = .fl_niv, label = .fl_niv, stringsAsFactors = FALSE), orders_list = NULL)
  out <- tempfile(fileext = ".pptx"); withr::defer(unlink(out), envir = parent.frame())
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
                                                     plan = list(a = p_slide_1_grafico(el_fn(vars), titulo = "Satisfacción con la atención")))))
  lapply(.pptx_slide_paths(out), function(sp) .pptx_leer_parte(out, sp))
}
.fl_over <- list(top2box_labels = .fl_niv[3:4], columna_bottom2box = TRUE, bottom2box_labels = .fl_niv[1:2])

test_that("el umbral sale de lo dibujado: la lámina 97 cabe en dos líneas de la columna de filas y la 221/222 no", {
  expect_identical(.LAM_ESCALA_FILAS_LINEAS_MAX, 2L)
  medir <- function(t) .lam_lineas_tinta(t, .LAM_ESCALA_FILAS_WLAB, .std_pt("actor"), TRUE)
  expect_lte(max(medir(.fl_cortas)), .LAM_ESCALA_FILAS_LINEAS_MAX)
  expect_identical(medir("Claridad de la información"), 2L)          # la frontera: dos líneas todavía es la 97
  expect_gt(min(medir(.fl_largas)), .LAM_ESCALA_FILAS_LINEAS_MAX)
})

test_that("con Bottom Two Box: cortas en filas, una sola larga basta para el bloque; sin ella, Total o actores nada cambia", {
  expect_true(.lam_escala_modo_filas(.fl_espec(.fl_cortas)))
  expect_false(.lam_escala_modo_filas(.fl_espec(.fl_largas)))
  expect_false(.lam_escala_modo_filas(.fl_espec(c(.fl_cortas[1:3], .fl_largas[2]))))
  expect_true(.lam_escala_modo_filas(.fl_espec(.fl_cortas[1])))       # la apilada sola corta también
  expect_false(.lam_escala_modo_filas(.fl_espec(.fl_largas[2])))      # y la sola larga va al bloque
  # Sin Bottom Two Box la forma es la de siempre: bloque.
  expect_false(.lam_escala_modo_filas(.fl_espec(.fl_cortas, bottom = FALSE)))
  # La fila Total sigue mandando a filas, con premisas cortas o largas.
  expect_true(.lam_escala_modo_filas(.fl_espec(c(.fl_cortas[1], .fl_largas[1:2]), total = TRUE)))
  expect_true(.lam_escala_modo_filas(.fl_espec(c(.fl_cortas[1], .fl_largas[1:2]), bottom = FALSE, total = TRUE)))
  # Con actores la premisa encabeza su bloque: la regla no aplica.
  expect_false(.lam_escala_modo_filas(.fl_espec(.fl_cortas, actor = "g1")))
  # Las láminas de varios bloques siguen leyendo `.lam_escala_en_filas` como antes.
  expect_true(.lam_escala_en_filas(.fl_espec(.fl_largas)))
})

test_that("las cifras de barras, Top y Bottom Two Box son las mismas en la forma filas y en el bloque", {
  e <- .fl_espec(.fl_cortas)
  filas <- .fl_laminas(e)
  bloque <- testthat::with_mocked_bindings(.fl_laminas(e), .lam_escala_modo_filas = function(espec) FALSE)
  expect_length(filas, 1L); expect_length(bloque, 1L)
  # Filas: el rótulo es «actor» a la derecha de su columna; bloque: «premisa».
  expect_identical(nrow(.fl_formas(filas[[1]], "premisa")), 0L)
  expect_setequal(.fl_formas(filas[[1]], "actor")$t, .fl_cortas)
  expect_setequal(.fl_formas(bloque[[1]], "premisa")$t, .fl_cortas)
  por_y <- function(x, nm) { f <- .fl_formas(x, nm); f$t[order(f$y, f$x)] }
  for (nm in c("box:cifra", "box2:cifra")) {
    expect_identical(por_y(filas[[1]], nm), por_y(bloque[[1]], nm), info = nm)
    expect_identical(por_y(filas[[1]], nm), unname(as.character(if (nm == "box:cifra") e$box$cifras else e$box2$cifras))[e$orden$aplicado], info = nm)
  }
  # Mismas cifras de segmento (dentro y fuera de la barra), fila por fila, en el mismo orden de filas.
  segs <- function(x) sort(c(.fl_formas(x, "cifra")$t, .fl_formas(x, "cifra_fuera")$t))
  expect_identical(segs(filas[[1]]), segs(bloque[[1]]))
  expect_identical(.fl_formas(filas[[1]], "actor")$t[order(.fl_formas(filas[[1]], "actor")$y)],
                   .fl_formas(bloque[[1]], "premisa")$t[order(.fl_formas(bloque[[1]], "premisa")$y)])
})

test_that("ruta real: la batería corta con Bottom Two Box sale en filas (97) y la larga en el bloque (221/222)", {
  el <- function(vars) p_barras_multiapiladas(modo = "var", vars = vars, top2box = TRUE, top2box_labels = .fl_niv[3:4], overrides = .fl_over)
  corta <- .fl_plan(.fl_cortas, el); larga <- .fl_plan(.fl_largas, el)
  expect_length(corta, 1L); expect_length(larga, 1L)
  expect_identical(.pptx_lamina_estado(corta[[1]]), "nativa")
  expect_identical(nrow(.fl_formas(corta[[1]], "premisa")), 0L)
  expect_setequal(.fl_formas(corta[[1]], "actor")$t, .fl_cortas)
  expect_identical(nrow(.fl_formas(corta[[1]], "box2:cifra")), length(.fl_cortas))
  expect_setequal(.fl_formas(larga[[1]], "premisa")$t, .fl_largas)
  expect_identical(nrow(.fl_formas(larga[[1]], "actor")), 0L)
  expect_identical(nrow(.fl_formas(larga[[1]], "box2:cifra")), length(.fl_largas))
  expect_true(.fl_sin_solape(.fl_formas(larga[[1]], "premisa")))
})

test_that("ruta real: la apilada sola con Bottom Two Box sigue la regla y no cae en la afirmación de un público (216)", {
  el <- function(vars) p_barras_apiladas(vars[1], overrides = c(list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box"), .fl_over))
  corta <- .fl_plan(.fl_cortas, el); larga <- .fl_plan(.fl_largas, el)
  expect_length(corta, 1L); expect_length(larga, 1L)
  # Corta: una fila de la 97, con su rótulo una sola vez (la pregunta no lo repite).
  expect_identical(.fl_formas(corta[[1]], "actor")$t, .fl_cortas[1])
  expect_false(.fl_cortas[1] %in% .fl_formas(corta[[1]], "pregunta")$t)
  expect_identical(nrow(.fl_formas(corta[[1]], "box2:cifra")), 1L)
  # Larga: el bloque de premisas de la 221, no la afirmación encabezando (forma «pregunta» de la 216).
  expect_identical(.fl_formas(larga[[1]], "premisa")$t, .fl_largas[1])
  expect_identical(nrow(.fl_formas(larga[[1]], "pregunta")), 0L)
  expect_identical(nrow(.fl_formas(larga[[1]], "box2:cifra")), 1L)
  # Sin Bottom Two Box la sola larga sigue siendo la 216.
  el_top <- function(vars) p_barras_apiladas(vars[1], overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box",
                                                                       top2box_labels = .fl_niv[3:4]))
  top <- .fl_plan(.fl_largas, el_top)
  expect_identical(.fl_formas(top[[1]], "pregunta")$t, .fl_largas[1])
})

test_that("no vuelve F-d: la lámina 24 de acrconta_mazo con Top y Bottom Two Box va al bloque, en dos láminas y sin solapes", {
  pulso <- system.file("reference_projects", "acrconta_mazo", "acrconta_mazo.pulso", package = "prosecnurapp")
  if (!nzchar(pulso)) pulso <- testthat::test_path("..", "..", "inst", "reference_projects", "acrconta_mazo", "acrconta_mazo.pulso")
  skip_if_not(file.exists(pulso), "sin el proyecto de referencia acrconta_mazo")
  copia <- withr::local_tempdir(); file.copy(pulso, file.path(copia, "ref.pulso"))
  ld <- suppressMessages(load_pulso(file.path(copia, "ref.pulso"))); sid <- ld$session_id
  withr::defer(session_delete(sid))
  cfg <- .graficos_effective_config(sid, NULL)
  sl <- cfg$plan$slides[[24]]
  a <- sl$payload$grafico$args
  expect_identical(a$graficador %||% sl$payload$grafico$graficador, "p_barras_multiapiladas")
  expect_length(a$vars, 7L)
  a$overrides$barra_extra <- c("top2box", "bottom2box")   # la barra extra del contrato (graficos_barra_extra.R) reemplaza a top2box + columna_bottom2box
  a$overrides$top2box_labels <- .fl_niv[3:4]; a$overrides$bottom2box_labels <- .fl_niv[1:2]
  sl$payload$grafico$args <- a
  plan <- cfg$plan; plan$slides <- list(sl)
  src <- .graficos_processing_sources(sid)
  dp <- file.path(copia, "d.rds"); ip <- file.path(copia, "i.rds"); saveRDS(src$data_sources, dp); saveRDS(src$inst_sources, ip)
  reg <- setNames(lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names())
  dl <- .graficos_delivery_options(cfg, template_id = plan$template_id %||% NULL, auto_otros_slides = plan$auto_otros_slides %||% NULL)
  tpl <- .graficos_resolve_template_pptx(config = cfg, profile_id = dl$profile_id, template_id = dl$template_id)
  out <- file.path(copia, "l24.pptx")
  suppressMessages(suppressWarnings(graficos_job_worker_ppt(dp, ip, plan, .enriquecer_presets(cfg$presets, NULL), cfg$paletas %||% list(),
    reg, .graf_names(), .graficos_icon_registry(sid, cfg), .graficos_active_base_name(sid), tpl, dl$template_id, dl$auto_otros_slides, out)))
  x <- lapply(.pptx_slide_paths(out), function(sp) .pptx_leer_parte(out, sp))
  expect_length(x, 2L)
  premisas <- character(0)
  for (k in seq_along(x)) {
    expect_identical(.pptx_lamina_estado(x[[k]]), "nativa")
    p <- .fl_formas(x[[k]], "premisa")
    expect_gt(nrow(p), 0L); expect_true(.fl_sin_solape(p), info = paste("lámina", k))
    expect_identical(nrow(.fl_formas(x[[k]], "actor")), 0L)                 # no es la forma en filas
    expect_identical(nrow(.fl_formas(x[[k]], "box2:cifra")), nrow(p))
    premisas <- c(premisas, p$t)
  }
  expect_length(premisas, 7L)
})
