source("setup-load-all.R")

# A3 (guías del visor): cada forma de la vista previa trae `pt_estandar`, el cuerpo en pt que el recetario pide para
# ESA forma, resuelto en el backend por nombre del motor + grupo `prosecnur:*` (y sólo en primer nivel por rol). El
# visor pinta en rojo el texto cuyo pt_min/pt_max se aparta (`fueraDeRecetario`). Sin referencia honesta, `NA` → null.

.pe_niv <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")

.pe_inst <- function(vars) {
  list(survey = data.frame(name = vars, type = "select_one esc", list_name = "esc", label = sprintf("Pregunta %s", vars), stringsAsFactors = FALSE),
       choices = data.frame(list_name = "esc", name = .pe_niv, label = .pe_niv, stringsAsFactors = FALSE),
       orders_list = NULL, label_col_survey = "label", label_col_choices = "label", lang = "es")
}

.pe_formas <- function(plan, vars = "p1", prob = c(.1, .2, .4, .3)) {
  set.seed(5)
  df <- as.data.frame(setNames(lapply(vars, function(v) sample(.pe_niv, 120, TRUE, prob = prob)), vars), stringsAsFactors = FALSE)
  force(plan)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = .pe_inst(vars), plan = plan,
    presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), path_ppt = out, mensajes_progreso = FALSE)))
  .preview_formas_lamina(out, .pptx_slide_paths(out)[[1]])
}

.pe_una <- function(formas, nombre) {
  f <- Filter(function(x) identical(x$nombre, nombre), formas)
  if (!length(f)) stop("sin forma ", nombre)
  f[[1]]
}

# Lo que el visor hace con el campo (espejo de `fueraDeRecetario`, tolerancia 0.5 pt).
.pe_rojo <- function(f) !is.na(f$pt_estandar) && any(abs(c(f$pt_min, f$pt_max) - f$pt_estandar) > 0.5, na.rm = TRUE)

test_that("lámina de escala con antetítulo: título, antetítulo, cifra, leyenda, base y folio llevan su token", {
  formas <- .pe_formas(list(a = p_slide_1_grafico(grafico = p_barras_apiladas("p1"), titulo = "Una escala",
                                                 meta = list(antetitulo = "Sección uno"))))
  esperado <- c("Titulo lamina" = "titulo", "Antetitulo lamina" = "antetitulo", cifra = "cifra", "leyenda:texto" = "leyenda",
                respuestas = "n", "Base lamina" = "base", "Folio lamina" = "base")
  for (n in names(esperado)) {
    f <- .pe_una(formas, n)
    expect_identical(f$pt_estandar, as.numeric(.std_pt(esperado[[n]])), info = n)
    expect_false(.pe_rojo(f), info = n)             # el motor sigue su recetario: nada en rojo
  }
  expect_identical(.pe_una(formas, "Titulo lamina")$pt_estandar, 24)
  expect_identical(.pe_una(formas, "Antetitulo lamina")$pt_estandar, 10)
  # la afirmación sola va a 20 pt literal (no 13 = `pregunta`): sin referencia honesta, null
  expect_identical(.pe_una(formas, "pregunta")$pt_max, 20)
  expect_true(is.na(.pe_una(formas, "pregunta")$pt_estandar))
  # los grupos no tienen letra propia
  for (g in c("prosecnur:titulo", "prosecnur:grafico:escala", "prosecnur:pie")) expect_true(is.na(.pe_una(formas, g)$pt_estandar), info = g)
  # todo campo es número o NA: nunca NULL (la API escribiría {} en vez de null)
  expect_true(all(vapply(formas, function(f) is.numeric(f$pt_estandar) && length(f$pt_estandar) == 1L, logical(1))))
})

test_that("escala en filas con cifras chicas y Top Two Box: premisa, cifra_fuera y rótulo del box por token", {
  formas <- .pe_formas(list(a = p_slide_1_grafico(titulo = "Tres", grafico = p_barras_multiapiladas(
    modo = "var", vars = c("p1", "p2", "p3"), top2box = TRUE, top2box_labels = .pe_niv[3:4]))),
    vars = c("p1", "p2", "p3"), prob = c(.02, .08, .6, .3))
  expect_identical(.pe_una(formas, "premisa")$pt_estandar, as.numeric(.std_pt("pregunta")))
  expect_identical(.pe_una(formas, "cifra_fuera")$pt_estandar, as.numeric(.std_pt("cifra_fuera")))
  expect_identical(.pe_una(formas, "cifra_fuera")$pt_estandar, 12)
  expect_identical(.pe_una(formas, "box:rotulo")$pt_estandar, as.numeric(.std_pt("rotulo_top_two_box")))
  for (n in c("premisa", "cifra", "cifra_fuera", "box:rotulo")) expect_false(.pe_rojo(.pe_una(formas, n)), info = n)
  # `box:cifra` de la escala no tiene un cuerpo único (14 en filas, 28 en la afirmación sola)
  expect_true(is.na(.pe_una(formas, "box:cifra")$pt_estandar))
})

test_that("la afirmación sola con Top Two Box (cifra de 28 pt) no se marca contra el 14 de `cifra`", {
  formas <- .pe_formas(list(a = p_slide_1_grafico(titulo = "Sola", grafico = p_barras_apiladas("p1",
    overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box", top2box_labels = .pe_niv[3:4])))))
  box <- .pe_una(formas, "box:cifra")
  expect_identical(box$pt_max, 28)
  expect_true(is.na(box$pt_estandar))
  expect_false(.pe_rojo(box))
})

test_that("la narrativa va a `narrativa`; la ruta anterior resuelve título y base por rol y deja la leyenda sin referencia", {
  nar <- .pe_formas(list(a = p_slide_1_grafico_narrativo(grafico = p_barras_apiladas("p1"), titulo = "Narr",
                                                        texto = "La mayoría **está de acuerdo** con la afirmación.")))
  expect_identical(.pe_una(nar, "narrativa:texto")$pt_estandar, as.numeric(.std_pt("narrativa")))
  expect_false(.pe_rojo(.pe_una(nar, "narrativa:texto")))

  vieja <- .pe_formas(list(a = p_slide_1_grafico(grafico = p_barras_apiladas("p1"), titulo = "Vieja", meta = list(motor_nativo = FALSE))))
  expect_identical(.pe_una(vieja, "Title 1")$pt_estandar, as.numeric(.std_pt("titulo")))
  expect_identical(.pe_una(vieja, "prosecnur:slide_1:base")$pt_estandar, as.numeric(.std_pt("base")))
  ley <- Filter(function(f) startsWith(f$nombre, "prosecnur:leyenda:texto"), vieja)
  expect_gte(length(ley), 1L)
  expect_true(all(vapply(ley, function(f) is.na(f$pt_estandar), logical(1))))   # encoge 12 → 11 → 10 a propósito
  plot <- Filter(function(f) identical(f$grupo, "prosecnur:slide_1:plot"), vieja)
  expect_true(all(vapply(plot, function(f) is.na(f$pt_estandar), logical(1))))  # texto dentro del ggplot: sin referencia
})

test_that("la tabla es explícita: el nombre sin su grupo, o un nombre desconocido, no hereda un número", {
  expect_identical(.pf_pt_estandar("cifra", "cifra", "prosecnur:grafico:escala"), 14)
  expect_true(is.na(.pf_pt_estandar("cifra", "cifra", "prosecnur:grafico:categorica")))   # 16 / cuerpo del rótulo
  expect_true(is.na(.pf_pt_estandar("cifra", "cifra", "prosecnur:grafico:mixta")))
  expect_true(is.na(.pf_pt_estandar("cifra", "cifra", NA)))
  expect_identical(.pf_pt_estandar("leyenda:texto", "leyenda", "prosecnur:grafico:divergentes"), 12)
  expect_true(is.na(.pf_pt_estandar("leyenda:texto", "leyenda", "prosecnur:grafico:mapa:panel")))  # 11 literal
  expect_true(is.na(.pf_pt_estandar("Subtitulo lamina", "texto", "prosecnur:titulo")))           # 12.5 sin token
  expect_true(is.na(.pf_pt_estandar("pieza:nueva", "texto", "prosecnur:grafico:escala")))
  # el rol sólo vale en primer nivel: un «titulo» dentro de un gráfico no es el de la lámina
  expect_identical(.pf_pt_estandar("Title 1", "titulo", NULL), 24)
  expect_true(is.na(.pf_pt_estandar("algo:titulo", "titulo", "prosecnur:grafico:escala")))
  expect_true(is.na(.pf_pt_estandar("Titulo lamina", "titulo", "prosecnur:titulo", con_texto = FALSE)))
  # cada token de la tabla existe en el estándar (un token mal escrito aborta, no cae a un default)
  for (ent in .pf_tabla_pt_estandar()) expect_true(is.numeric(.std_pt(ent$token)), info = ent$token)
  for (r in .PF_PT_POR_ROL) expect_true(is.numeric(.std_pt(r)), info = r)
})

test_that("el desplazamiento de la narrativa no cambia la referencia (sólo baja la zona de datos)", {
  viejo <- options(prosecnur.lam_desplazo = 0.8); on.exit(options(viejo), add = TRUE)
  expect_identical(.pf_pt_estandar("cifra", "cifra", "prosecnur:grafico:escala"), as.numeric(.std_pt("cifra")))
  expect_identical(.pf_pt_estandar("Titulo lamina", "titulo", "prosecnur:titulo"), as.numeric(.std_pt("titulo")))
})

test_that("contrato JSON: `pt_estandar` sale número o null en cada forma de cada parte", {
  set.seed(5)
  df <- data.frame(p1 = sample(.pe_niv, 120, TRUE), stringsAsFactors = FALSE)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = .pe_inst("p1"),
    plan = list(a = p_slide_1_grafico(grafico = p_barras_apiladas("p1"), titulo = "Una")),
    presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), path_ppt = out, mensajes_progreso = FALSE)))
  conf <- .preview_con_formas(list(partes = .preview_partes(out)), out, "p_slide_1_grafico", TRUE)
  js <- jsonlite::fromJSON(jsonlite::toJSON(conf, auto_unbox = TRUE, na = "null", null = "null"), simplifyVector = FALSE)
  formas <- js$partes$partes[[1]]$formas
  expect_true(all(vapply(formas, function(f) "pt_estandar" %in% names(f), logical(1))))
  pe <- lapply(formas, `[[`, "pt_estandar")
  expect_true(all(vapply(pe, function(v) is.null(v) || is.numeric(v), logical(1))))
  tit <- Filter(function(f) identical(f$nombre, "Titulo lamina"), formas)[[1]]
  expect_identical(tit$pt_estandar, 24L)
  expect_null(Filter(function(f) identical(f$nombre, "prosecnur:grafico:escala"), formas)[[1]]$pt_estandar)
})
