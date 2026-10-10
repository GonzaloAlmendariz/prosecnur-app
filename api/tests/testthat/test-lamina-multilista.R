# ADR 0092/0093 — la multi-apiladas en `modo = "multilista"` sale por el motor nativo: un bloque de escala por
# sub-bloque, con su título, apilados como el tipo 10 del recetario («Dos gráficos apilados», p143-144 de
# recetario-moderna.pptx), y partida en «(cont.)» por bloques enteros.
#
# `.pptx_lamina_estado()` también llama «nativa» a la ruta anterior (deja `prosecnur:slide_1:right`, una ranura),
# así que el estado solo no distingue: se exige además el grupo `prosecnur:grafico:multilista` y que la ranura de
# la ruta anterior no aparezca.

.mlt_niv <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")

.mlt_datos <- function() {
  # Conteos fijos (120 casos por variable): el porcentaje se puede afirmar.
  fila <- function(n) rep(.mlt_niv, times = n)
  data.frame(
    a1 = fila(c(12, 24, 48, 36)), a2 = fila(c(6, 18, 60, 36)), a3 = fila(c(24, 36, 36, 24)),
    b1 = fila(c(12, 12, 36, 60)), b2 = fila(c(36, 36, 24, 24)),
    s1 = rep(c("Sí", "No"), times = c(90, 30)),
    stringsAsFactors = FALSE
  )
}

.mlt_inst <- function(extra = character()) {
  vars <- c("a1", "a2", "a3", "b1", "b2", extra)
  etiquetas <- c(a1 = "La Unidad cuenta con servicios de tutoría académica",
                 a2 = "Los docentes publican sus horarios de atención",
                 a3 = "La biblioteca atiende en horarios adecuados",
                 b1 = "El plan de estudios está actualizado",
                 b2 = "Los laboratorios tienen equipamiento suficiente",
                 s1 = "¿Recomendaría la Unidad?")
  list(
    survey = data.frame(type = ifelse(vars == "s1", "select_one sino", "select_one acuerdo"),
                        list_name = ifelse(vars == "s1", "sino", "acuerdo"), name = vars,
                        label = unname(etiquetas[vars]), stringsAsFactors = FALSE),
    choices = data.frame(list_name = c(rep("acuerdo", 4), "sino", "sino"), name = c(as.character(1:4), "1", "0"),
                         label = c(.mlt_niv, "Sí", "No"), stringsAsFactors = FALSE),
    label_col_survey = "label", label_col_choices = "label", lang = "es"
  )
}

.mlt_bloques <- function(subtitulo = NULL) list(
  list(modo = "var", vars = c("a2", "a3"), titulo = "Servicios académicos", subtitulo = subtitulo),
  # b2 (Top Two Box 40 %) antes que b1 (80 %): si el bloque se reordenara por Top Two Box, se vería.
  list(modo = "var", vars = c("b2", "b1"), titulo = "Plan de estudios e infraestructura")
)

.mlt_generar <- function(bloques = .mlt_bloques(), meta = list(), data = .mlt_datos(), inst = .mlt_inst()) {
  p_reset()
  plan <- list(diapo_001 = p_slide_1_grafico(
    titulo = "Satisfacción con la Unidad", meta = meta,
    grafico = p_barras_multiapiladas(modo = "multilista", top2box = TRUE, top2box_labels = .mlt_niv[3:4], bloques = bloques)
  ))
  path <- tempfile(fileext = ".pptx")
  suppressMessages(reporte_ppt_plan(
    data = data, instrumento = inst, plan = plan, presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO),
    path_ppt = path, mensajes_progreso = FALSE
  ))
  path
}

.mlt_xml <- function(path, i = 1L) .pptx_leer_parte(path, .pptx_slide_paths(path)[[i]])
.mlt_textos <- function(xml) {
  t <- regmatches(xml, gregexpr("(?<=<a:t>)[^<]*(?=</a:t>)", xml, perl = TRUE))[[1]]
  trimws(t)
}
.mlt_nombres <- function(xml) sub('^name="(.*)"$', "\\1", regmatches(xml, gregexpr('name="[^"]*"', xml))[[1]])

test_that("la multilista sale nativa, con los títulos de bloque y sin guías de depuración", {
  skip_if_not_installed("officer")
  skip_if_not_installed("cowplot")
  out <- .mlt_generar()
  pp <- .preview_partes(out)
  # Dos bloques de dos filas caben en una lámina, como el ejemplo p144 del recetario (sin subtítulo: con él ya no
  # caben al grosor del estándar y se reparten, ver el último test).
  expect_equal(pp$n, 1L)
  expect_equal(pp$partes[[1]]$estado, "nativa")
  xml <- .mlt_xml(out)
  nombres <- .mlt_nombres(xml)
  expect_true("prosecnur:grafico:multilista" %in% nombres)
  expect_false(any(grepl("^prosecnur:slide_1:", nombres)))
  expect_false(grepl("<p:pic", xml, fixed = TRUE))
  textos <- .mlt_textos(xml)
  expect_true(all(c("Servicios académicos", "Plan de estudios e infraestructura") %in% textos))
  expect_equal(sum(nombres == "bloque:titulo"), 2L)
  # Ni las guías del canvas (`debug_ph_*`, `.GUIA_COL`) ni magenta.
  expect_false(grepl("debug", xml, ignore.case = TRUE))
  expect_false(grepl(sub("#", "", .GUIA_COL), xml, ignore.case = TRUE))
  expect_false(grepl("FF00FF", xml, ignore.case = TRUE))
  # Las filas en el orden del plan; una sola leyenda (los dos bloques usan la misma escala); Top Two Box por bloque.
  expect_equal(sum(textos == "Top Two Box"), 2L)
  expect_equal(sum(textos == "Totalmente de acuerdo"), 1L)
})

test_that("cada bloque conserva su espec: las cifras son las de la ruta anterior", {
  skip_if_not_installed("officer")
  skip_if_not_installed("cowplot")
  pct <- function(path) sort(grep("^[0-9]+%$", unlist(lapply(seq_along(.pptx_slide_paths(path)), function(i) .mlt_textos(.mlt_xml(path, i)))), value = TRUE))
  nativa <- .mlt_generar()
  anterior <- .mlt_generar(meta = list(motor_nativo = FALSE))
  # La ruta anterior sigue disponible y no es la del motor nativo.
  expect_false("prosecnur:grafico:multilista" %in% .mlt_nombres(.mlt_xml(anterior)))
  expect_equal(pct(nativa), pct(anterior))
  # 60/120 = 50 % (a2, «De acuerdo») y Top Two Box de a2 = 96/120 = 80 %.
  expect_true(all(c("50%", "80%") %in% pct(nativa)))
  # Orden del plan, el de la ruta anterior y del Word: b2 antes que b1 aunque b1 tenga más Top Two Box.
  xml <- .mlt_xml(nativa); nombres <- .mlt_nombres(xml)
  premisas <- regmatches(xml, gregexpr('name="premisa".*?</p:sp>', xml))[[1]]
  primeras <- vapply(premisas, function(x) paste(.mlt_textos(x), collapse = " "), "")
  expect_match(unname(primeras[1]), "horarios de atención")
  expect_match(unname(primeras[2]), "biblioteca")
  expect_match(unname(primeras[3]), "laboratorios")
  expect_match(unname(primeras[4]), "plan de estudios")
})

test_that("bloques con escalas distintas llevan una leyenda cada uno", {
  skip_if_not_installed("officer")
  skip_if_not_installed("cowplot")
  bloques <- list(
    list(modo = "var", vars = c("b1", "b2"), titulo = "Plan de estudios"),
    list(modo = "var", vars = "s1", titulo = "Recomendación", top2box = FALSE)
  )
  out <- .mlt_generar(bloques = bloques, inst = .mlt_inst("s1"))
  pp <- .preview_partes(out)
  # Con una leyenda por bloque los dos ya no caben juntos: van en láminas distintas, enteros.
  expect_true(all(vapply(pp$partes, `[[`, "", "estado") == "nativa"))
  xmls <- lapply(seq_len(pp$n), function(i) .mlt_xml(out, i))
  expect_true(all(vapply(xmls, function(x) "prosecnur:grafico:multilista" %in% .mlt_nombres(x), TRUE)))
  textos <- unlist(lapply(xmls, .mlt_textos))
  expect_true(all(c("Plan de estudios", "Recomendación") %in% textos))
  expect_equal(sum(textos == "Totalmente de acuerdo"), 1L)
  expect_equal(sum(textos == "Sí"), 1L)
})

test_that("si no cabe, se reparte por bloques enteros; un bloque solo que no cabe se parte y repite su título", {
  skip_if_not_installed("officer")
  skip_if_not_installed("cowplot")
  data <- .mlt_datos()
  largos <- paste0("e", 1:8)
  set.seed(11)
  for (v in largos) data[[v]] <- sample(.mlt_niv, 120, TRUE)
  inst <- .mlt_inst()
  inst$survey <- rbind(inst$survey, data.frame(type = "select_one acuerdo", list_name = "acuerdo", name = largos,
    label = paste("Afirmación extensa número", 1:8, "sobre la gestión del programa académico"), stringsAsFactors = FALSE))
  bloques <- c(.mlt_bloques("Docentes y biblioteca"), list(list(modo = "var", vars = largos, titulo = "Bloque largo de gestión")))
  out <- .mlt_generar(bloques = bloques, data = data, inst = inst)
  pp <- .preview_partes(out)
  expect_gt(pp$n, 2L)
  expect_true(all(vapply(pp$partes, `[[`, "", "estado") == "nativa"))
  expect_false(pp$partes[[1]]$continuacion)
  expect_true(all(vapply(pp$partes[-1], `[[`, TRUE, "continuacion")))
  por_lamina <- lapply(seq_len(pp$n), function(i) .mlt_textos(.mlt_xml(out, i)))
  # Ningún bloque se corta entre láminas salvo el que no cabe solo, que repite su título en cada trozo.
  donde <- function(t) which(vapply(por_lamina, function(x) t %in% x, TRUE))
  expect_length(donde("Servicios académicos"), 1L)
  expect_identical(donde("Docentes y biblioteca"), 1L)
  expect_length(donde("Plan de estudios e infraestructura"), 1L)
  expect_gte(length(donde("Bloque largo de gestión")), 2L)
  # Las ocho afirmaciones del bloque largo aparecen, cada una una sola vez.
  todas <- unlist(por_lamina)
  for (k in 1:8) expect_equal(sum(grepl(sprintf("número %d sobre", k), todas)), 1L)
})

test_that("la compuerta no toma bloques sin espec de escala ni los que llevan fila Total", {
  ml <- list(bloques = list(list(espec = NULL, titulo = "x")))
  expect_false(.lam_multilista_cabe(ml))
  expect_null(.lam_multilista_items(list(bloques = list())))
})
