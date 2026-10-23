# Base chica en la escala nativa: «con menos de 30 casos, todas las filas del bloque dicen "x de y"»
# (estandar_pulso.json, reglas$base_chica; D12). La regla es una sola (`.lam_base_chica`), sobre la especificación
# ENTERA, y la leen las dos formas: el bloque de premisas (221/222) y las filas (97, decisión «2c»). Una fila sin
# base (n = 0 o NA) no escribe «NA de NA». Y la apilada sola de un público en filas sigue nombrando al público.

.bc_niv <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF")
.bc_cortas <- c("Docentes", "Administrativos", "Estudiantes")
.bc_largas <- c(
  "Considero que el personal administrativo de la Unidad tiene funciones claramente definidas y conocidas por todos.",
  "Considero que las capacitaciones, los programas de actualización y perfeccionamiento brindados por la Universidad son idóneos para la labor.",
  "Estoy satisfecho(a) con los programas de actualización, perfeccionamiento y capacitaciones brindados por la Universidad para su personal.",
  "Existen evaluaciones periódicas para promociones y ascensos del personal administrativo de la Unidad realizados por la Universidad.",
  "Los requisitos de la Universidad que definen las contrataciones, promociones o ascensos del personal administrativo de la Unidad son claros.",
  "Estoy satisfecho(a) con los programas de motivación e incentivos que me brinda la Universidad como su trabajador de la Unidad.",
  "Estoy satisfecho(a) con los programas de ayuda (becas, movilidad académica, bolsa de trabajo, pasantías) que me brinda la Universidad.")

# N3b+: el «x de y» lo gobierna el interruptor `mostrar_respuestas` (apagado por defecto); estas pruebas de la regla lo encienden.
.bc_espec <- function(rotulos, n, bottom = TRUE, total = FALSE, resp = TRUE) {
  d <- data.frame(item = sprintf("i%d", seq_along(rotulos)), rot = rotulos, N = n,
                  t1 = .1, t2 = .1, t3 = .4, t4 = .3, t5 = .1, stringsAsFactors = FALSE)
  args <- list(d, "item", "N", paste0("t", 1:5), setNames(.bc_niv, paste0("t", 1:5)), var_etiqueta_categoria = "rot",
               colores_grupos = as.list(setNames(.std_paleta("likert"), .bc_niv)), barra_extra_preset = "top2box",
               top2box_labels = .bc_niv[3:4], fila_total = total)
  if (bottom) args <- c(args, list(columna_bottom2box = TRUE, bottom2box_labels = .bc_niv[1:2]))
  e <- do.call(preparar_escala, args)
  e$mostrar_respuestas <- resp
  e
}

.bc_formas <- function(x, nombre) {
  xml <- xml2::read_xml(x)
  sp <- xml2::xml_find_all(xml, sprintf("//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:escala']]/p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  num <- function(path, attr) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, path), attr)) / 914400
  data.frame(t = xml2::xml_text(sp), x = num("./p:spPr/a:xfrm/a:off", "x"), y = num("./p:spPr/a:xfrm/a:off", "y"),
             w = num("./p:spPr/a:xfrm/a:ext", "cx"), h = num("./p:spPr/a:xfrm/a:ext", "cy"), stringsAsFactors = FALSE)
}
.bc_textos <- function(x, nombre) { f <- .bc_formas(x, nombre); f$t[order(f$y, f$x)] }

.bc_laminas <- function(e) {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- suppressMessages(.lam_laminas_escala(doc, e, "Dotación administrativa", base = "Base: 15", folio = 1))
  lapply(seq_len(o$partes), function(k) as.character(o$doc$slide$get_slide(length(o$doc) - o$partes + k)$get()))
}
.bc_bloque <- function(e) testthat::with_mocked_bindings(.bc_laminas(e), .lam_escala_modo_filas = function(espec) FALSE)

# Ninguna caja de la columna de un box se encima con otra de la misma columna.
.bc_columna_sin_solape <- function(x, prefijo) {
  f <- rbind(.bc_formas(x, paste0(prefijo, ":cifra")), .bc_formas(x, paste0(prefijo, ":casos")))
  f <- f[order(f$y), ]
  nrow(f) < 2L || all(f$y[-1] >= (f$y + f$h)[-nrow(f)] - 1e-6)
}

test_that("(a) con base chica, filas y bloque dicen los mismos «x de y» en Top y Bottom Two Box", {
  e <- .bc_espec(.bc_cortas, n = c(5, 12, 20))
  expect_true(.lam_escala_modo_filas(e))
  filas <- .bc_laminas(e); bloque <- .bc_bloque(e)
  expect_length(filas, 1L); expect_length(bloque, 1L)
  expect_identical(nrow(.bc_formas(filas[[1]], "premisa")), 0L)            # de verdad es la forma en filas
  for (nm in c("box:casos", "box2:casos")) {
    expect_length(.bc_textos(filas[[1]], nm), 3L)
    expect_identical(.bc_textos(filas[[1]], nm), .bc_textos(bloque[[1]], nm), info = nm)
  }
  expect_identical(.bc_textos(filas[[1]], "box:casos"), sprintf("%d de %d", as.integer(e$box$casos), as.integer(e$filas$n))[e$orden$aplicado])
  expect_true(all(grepl("^[0-9]+ de [0-9]+$", .bc_textos(filas[[1]], "box2:casos"))))
  # El «x de y» cabe en su fila: no se encima con la cifra de la fila siguiente.
  expect_true(.bc_columna_sin_solape(filas[[1]], "box")); expect_true(.bc_columna_sin_solape(filas[[1]], "box2"))
  # Sin Bottom Two Box los mismos datos van al bloque y también lo dicen: la regla no depende de la forma.
  sin <- .bc_laminas(.bc_espec(.bc_cortas, n = c(5, 12, 20), bottom = FALSE))
  expect_length(.bc_textos(sin[[1]], "box:casos"), 3L)
})

test_that("(b) en filas con Total, un grupo chico basta: todas las filas, la Total incluida, dicen «x de y»", {
  e <- .bc_espec(.bc_cortas, n = c(150, 15, 120), total = TRUE)
  expect_true(isTRUE(e$filas$es_total[1])); expect_identical(e$filas$n[1], 285)   # la Total la arma la espec
  x <- .bc_laminas(e)
  for (k in seq_along(x)) {
    n_filas <- nrow(.bc_formas(x[[k]], "actor"))
    expect_identical(nrow(.bc_formas(x[[k]], "box:casos")), n_filas, info = k)
    expect_identical(nrow(.bc_formas(x[[k]], "box2:casos")), n_filas, info = k)
    expect_identical(n_filas, 4L)
    expect_true(any(grepl(" de 285$", .bc_formas(x[[k]], "box:casos")$t)), info = k)   # la Total
    expect_true(any(grepl(" de 285$", .bc_formas(x[[k]], "box2:casos")$t)), info = k)
    expect_true(.bc_columna_sin_solape(x[[k]], "box"), info = k)
    # El filete de la Total queda bajo su «x de y».
    fil <- .bc_formas(x[[k]], "filete:total"); cs <- .bc_formas(x[[k]], "box:casos")
    expect_gte(fil$y[1], min(cs$y + cs$h) - 1e-6)
  }
  # Con muchos grupos la barra es más delgada: el filete y el «x de y» de la Total siguen sin tocarse.
  muchos <- .bc_laminas(.bc_espec(sprintf("Grupo %d", 1:8), n = c(rep(80, 7), 12), total = TRUE))
  for (k in seq_along(muchos)) {
    fil <- .bc_formas(muchos[[k]], "filete:total"); cs <- .bc_formas(muchos[[k]], "box:casos")
    tot <- cs[which.min(cs$y), ]
    expect_gte(fil$y[1], tot$y + tot$h - 1e-6)
  }
  # Sin grupo chico, nadie lo dice.
  grande <- .bc_laminas(.bc_espec(.bc_cortas, n = c(150, 50, 120), total = TRUE))
  expect_identical(nrow(.bc_formas(grande[[1]], "box:casos")), 0L)
})

test_that("con base chica y muchas filas, el «x de y» cabe en el paso de la fila y la columna no se encima", {
  # Doce filas se parten en partes de hasta siete: barra de 0.38 in, paso de 0.58 in, y el «x de y» necesita 0.56.
  e <- .bc_espec(sprintf("Grupo %d", 1:12), n = c(rep(80, 11), 12))
  expect_true(.lam_escala_modo_filas(e))
  x <- .bc_laminas(e)
  for (k in seq_along(x)) {
    expect_identical(nrow(.bc_formas(x[[k]], "box:casos")), nrow(.bc_formas(x[[k]], "actor")), info = k)
    expect_true(.bc_columna_sin_solape(x[[k]], "box"), info = k); expect_true(.bc_columna_sin_solape(x[[k]], "box2"), info = k)
  }
})

test_that("(c) n = 0 o NA no escriben «NA de NA» ni «0 de 0», en filas ni en bloque", {
  for (n in list(c(5, NA, 40), c(5, 0, 40))) {
    e <- .bc_espec(.bc_cortas, n = n)
    expect_true(.lam_base_chica(e))
    for (x in c(.bc_laminas(e), .bc_bloque(e))) {
      for (nm in c("box:casos", "box2:casos")) {
        t <- .bc_formas(x, nm)$t
        expect_false(any(grepl("NA", t)), info = paste(nm, toString(n)))
        expect_false(any(grepl(" de 0$", t)), info = paste(nm, toString(n)))
        expect_length(t, 2L)                                                     # las dos filas con base
      }
    }
  }
  expect_null(.lam_casos_texto(list(casos = c(NA, 3)), list(filas = list(n = c(NA, 10))), 1L))
  expect_null(.lam_casos_texto(list(casos = c(0, 3)), list(filas = list(n = c(0, 10))), 1L))
  expect_identical(.lam_casos_texto(list(casos = c(0, 3)), list(filas = list(n = c(0, 10))), 2L), "3 de 10")
  # Sólo filas sin base no son base chica.
  expect_false(.lam_base_chica(list(filas = list(n = c(NA, 0, 40)))))
})

test_that("(d) la frontera es la del estándar: 29 casos sí, 30 no", {
  expect_true(.lam_base_chica(list(filas = list(n = c(29, 200)))))
  expect_false(.lam_base_chica(list(filas = list(n = c(30, 200)))))
  for (forma in c("filas", "bloque")) {
    pinta <- function(n) { e <- .bc_espec(.bc_cortas, n = n); if (forma == "filas") .bc_laminas(e) else .bc_bloque(e) }
    expect_identical(nrow(.bc_formas(pinta(c(29, 100, 100))[[1]], "box:casos")), 3L, info = forma)
    expect_identical(nrow(.bc_formas(pinta(c(30, 100, 100))[[1]], "box:casos")), 0L, info = forma)
  }
})

test_that("la base chica se decide para la espec entera: la parte «(cont.)» sin filas chicas también lo dice", {
  # Siete premisas largas van al bloque y se parten; la única fila chica es la última.
  e <- .bc_espec(.bc_largas, n = c(rep(100, 6), 15))
  expect_false(.lam_escala_modo_filas(e))
  x <- .bc_laminas(e)
  expect_gt(length(x), 1L)
  for (k in seq_along(x)) {
    expect_identical(nrow(.bc_formas(x[[k]], "box:casos")), nrow(.bc_formas(x[[k]], "premisa")), info = k)
    expect_identical(nrow(.bc_formas(x[[k]], "box2:casos")), nrow(.bc_formas(x[[k]], "premisa")), info = k)
  }
})

# ---- ruta real -----------------------------------------------------------------------------------------------

.bc_cruce <- function() {
  set.seed(24)
  df <- data.frame(p2 = sample(.bc_niv, 15, replace = TRUE, prob = c(.1, .15, .4, .2, .15)),
                   grupo = rep(.bc_cortas, each = 5), stringsAsFactors = FALSE)
  inst <- list(
    survey = data.frame(name = c("p2", "grupo"), type = c("select_one lk", "select_one lg"), list_name = c("lk", "lg"),
                        label = c(.bc_largas[2], "Público"), stringsAsFactors = FALSE),
    choices = rbind(data.frame(list_name = "lk", name = .bc_niv, label = .bc_niv, stringsAsFactors = FALSE),
                    data.frame(list_name = "lg", name = .bc_cortas, label = .bc_cortas, stringsAsFactors = FALSE)),
    orders_list = NULL)
  list(df = df, inst = inst)
}
.bc_over <- list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box", top2box_labels = .bc_niv[3:4],
                 columna_bottom2box = TRUE, bottom2box_labels = .bc_niv[1:2])
.bc_plan <- function(data, inst, el) {
  out <- tempfile(fileext = ".pptx"); withr::defer(unlink(out), envir = parent.frame())
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = data, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
                                                     plan = list(a = p_slide_1_grafico(el, titulo = "Dotación administrativa")))))
  lapply(.pptx_slide_paths(out), function(sp) .pptx_leer_parte(out, sp))
}

test_that("(e) ruta real: «Dividir por» con niveles cortos y 5 casos por grupo va en filas y dice «x de 5» en cada fila", {
  f <- .bc_cruce()
  x <- .bc_plan(f$df, f$inst, p_barras_apiladas("p2", cruces = "grupo", overrides = .bc_over, mostrar_respuestas = TRUE))
  expect_length(x, 1L)
  expect_identical(.pptx_lamina_estado(x[[1]]), "nativa")
  expect_setequal(.bc_formas(x[[1]], "actor")$t, .bc_cortas)
  expect_identical(nrow(.bc_formas(x[[1]], "premisa")), 0L)
  for (nm in c("box:casos", "box2:casos")) {
    t <- .bc_formas(x[[1]], nm)$t
    expect_length(t, 3L)
    expect_true(all(grepl("^[0-5] de 5$", t)), info = nm)
  }
  expect_true(.bc_columna_sin_solape(x[[1]], "box")); expect_true(.bc_columna_sin_solape(x[[1]], "box2"))
})

test_that("ruta real: la apilada sola de un público en filas nombra al público y sus respuestas (como la 216)", {
  set.seed(5)
  df <- data.frame(p1 = sample(.bc_niv, 172, TRUE, prob = c(.08, .12, .45, .3, .05)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "p1", type = "select_one lk", list_name = "lk", label = "Trato del personal", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lk", name = .bc_niv, label = .bc_niv, stringsAsFactors = FALSE), orders_list = NULL)
  x <- .bc_plan(list(estudiantes = df), list(estudiantes = inst), p_barras_apiladas("estudiantes$p1", overrides = .bc_over, mostrar_respuestas = TRUE))
  expect_length(x, 1L)
  expect_identical(nrow(.bc_formas(x[[1]], "premisa")), 0L)                  # forma en filas (97)
  expect_identical(.bc_formas(x[[1]], "actor")$t, "Estudiantes")
  expect_identical(.bc_formas(x[[1]], "respuestas")$t, "172 respuestas")
  expect_identical(.bc_formas(x[[1]], "pregunta")$t, "Trato del personal")   # la premisa encabeza, una sola vez
  expect_identical(nrow(.bc_formas(x[[1]], "box2:cifra")), 1L)
})

test_that("una pregunta de dos líneas en filas crece su caja y no pisa las cabeceras de los box", {
  e <- .bc_espec(.bc_cortas, n = c(100, 100, 100))
  e$pregunta <- paste(rep("¿Qué tan de acuerdo está con cada una de las siguientes afirmaciones sobre la gestión de la Unidad?", 2), collapse = " ")
  w <- .lam_filas_ancho()
  expect_gt(.lam_lineas_tinta(e$pregunta, w, .std_pt("pregunta"), TRUE), 1L)
  x <- .bc_laminas(e)
  p <- .bc_formas(x[[1]], "pregunta"); r <- .bc_formas(x[[1]], "box:rotulo")
  expect_gte(p$h, .lam_alto_tinta(e$pregunta, w, .std_pt("pregunta"), TRUE)[[1]] - 1e-6)
  expect_gte(r$y, p$y + p$h - 1e-6)
  # Una pregunta de una línea conserva la caja de siempre.
  e$pregunta <- "¿Qué tan satisfecho está con cada aspecto?"
  expect_equal(.bc_formas(.bc_laminas(e)[[1]], "pregunta")$h, 0.34, tolerance = 1e-6)
})

test_that("base chica con el interruptor apagado: ni «x de y» ni caja box:casos, en filas y en bloque; cifras y pie iguales", {
  for (bottom in c(TRUE, FALSE)) {
    on <- .bc_espec(.bc_cortas, n = c(5, 12, 20), bottom = bottom, resp = TRUE)
    off <- .bc_espec(.bc_cortas, n = c(5, 12, 20), bottom = bottom, resp = FALSE)
    expect_true(.lam_base_chica(off))   # la regla sigue siendo de la espec; sólo se dibuja con el interruptor
    for (f in list(.bc_laminas, .bc_bloque)) {
      con <- f(on)[[1]]; sin <- f(off)[[1]]
      expect_length(.bc_textos(con, "box:casos"), 3L)
      for (nm in c("box:casos", "box2:casos")) expect_identical(nrow(.bc_formas(sin, nm)), 0L, info = nm)
      expect_false(grepl("\\d+ de \\d+", paste(.bc_textos(sin, "box:cifra"), collapse = " ")))
      expect_identical(.bc_textos(sin, "box:cifra"), .bc_textos(con, "box:cifra"))   # las cifras no cambian
      expect_match(xml2::xml_text(xml2::read_xml(sin)), "Base: 15", fixed = TRUE)    # el pie «Base» sigue
    }
  }
})

test_that("base chica apagada no reserva el aire del «x de y»: la fila conserva el aire de la cifra chica y la cifra se centra con la barra", {
  on <- .bc_espec(.bc_cortas, n = c(5, 12, 20), resp = TRUE); off <- .bc_espec(.bc_cortas, n = c(5, 12, 20), resp = FALSE)
  # El aire de la fila (paso entre barras) es el mismo: lo pide la cifra chica fuera de la barra, no el «x de y».
  p_on <- .bc_formas(.bc_laminas(on)[[1]], "box:cifra"); p_off <- .bc_formas(.bc_laminas(off)[[1]], "box:cifra")
  expect_equal(diff(sort(p_on$y)), diff(sort(p_off$y)), tolerance = 1e-6)
  # Con el interruptor apagado la cifra del box queda centrada en la barra (no sube 0.1 in para dejar sitio al «x de y»).
  expect_true(all(sort(p_off$y) > sort(p_on$y)))
  expect_true(all(sort(p_off$y) - sort(p_on$y) > 0.05))
})
