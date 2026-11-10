source("setup-load-all.R")

# El dumbbell con tres o cuatro grupos o públicos (Gonzalo, 2026-11-09, sobre el resumen de Arte y Diseño): una sub-fila por
# grupo con su forma y su color, "Diferencia" = mayor menos menor sin signo, la leyenda con el n de cada grupo y la base de
# cada grupo en la nota de la base, sin tabla al costado. Con dos grupos, el dumbbell de siempre.

.d3_inst <- function(vars = paste0("p", 1:4)) list(
  survey = data.frame(name = vars, type = "select_one lk", list_name = "lk",
                      label = c("Los propósitos son claros", "La biblioteca atiende a tiempo", "El servicio de salud es oportuno",
                                "La tutoría acompaña el avance")[seq_along(vars)], stringsAsFactors = FALSE),
  choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4", "9"),
                       label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"),
                       stringsAsFactors = FALSE), orders_list = NULL)
.d3_base <- function(n, ttb, seed) {
  set.seed(seed)
  d <- as.data.frame(lapply(ttb, function(t) { k <- round(n * t); sample(c(rep(c("3", "4"), length.out = k), rep(c("1", "2", "9"), length.out = n - k))) }),
                     stringsAsFactors = FALSE)
  names(d) <- paste0("p", seq_along(ttb)); d
}
.d3_fuentes <- function(k = 3L) {
  ds <- list(docentes = .d3_base(115, c(.93, .70, .52, .80), 1), estudiantes = .d3_base(279, c(.80, .66, .38, .55), 2),
             administrativos = .d3_base(85, c(.97, .85, .86, .70), 3), egresados = .d3_base(25, c(.60, .72, .44, .52), 4))[seq_len(k)]
  list(data_sources = ds, inst_sources = stats::setNames(rep(list(.d3_inst()), length(ds)), names(ds)))
}
.d3_vars <- function(k = 3L) {
  b <- c("docentes", "estudiantes", "administrativos", "egresados")[seq_len(k)]
  stats::setNames(lapply(1:4, function(i) paste0(b, "$p", i)), c("Propósitos claros", "Biblioteca a tiempo", "Salud oportuna", "Tutoría"))
}
.d3_render <- function(f, el, src) { data_sources <- src$data_sources; instrument_sources <- src$inst_sources; suppressWarnings(f(el)) }
.d3_tidy <- function(k) {
  g <- c("2do ciclo", "3er ciclo", "4to ciclo", "5to ciclo")[seq_len(k)]
  set.seed(k)
  d <- expand.grid(eje = c("Dotación", "Movilidad", "Asesorías", "Bienestar"), grupo = g, stringsAsFactors = FALSE)
  d$valor <- round(stats::runif(nrow(d), 40, 95), 1)
  d$n_casos <- c(139, 25, 115, 60)[match(d$grupo, g)]
  d$n_casos[d$eje == "Movilidad"] <- d$n_casos[d$eje == "Movilidad"] - 10   # la base cambia en una pregunta: la nota da su rango
  d$eje <- factor(d$eje, levels = unique(d$eje)); d$grupo <- factor(d$grupo, levels = g)
  d
}

test_that("con tres grupos: una sub-fila por grupo, diferencia = mayor menos menor sin signo y las bases en la nota", {
  p <- graficar_dumbbell(.d3_tidy(3), estilo = "resumen")
  e <- attr(p, "pulso_espec")
  expect_identical(e$tipo, "contraste"); expect_identical(e$modo, "subfilas")
  R <- matrix(.pulso_round_half_up(e$valores, 0), nrow(e$valores))
  expect_equal(e$diferencia, apply(R, 1, max) - apply(R, 1, min))
  expect_false(any(grepl("^[+-]", e$textos_diferencia)))
  expect_identical(e$base_en, "nota")
  expect_identical(e$nota_base, "Base: 129 a 139 de 2do ciclo, 15 a 25 de 3er ciclo y 105 a 115 de 4to ciclo")
  expect_identical(e$leyenda, c("2do ciclo (139)", "3er ciclo (25)", "4to ciclo (115)"))
  expect_length(.lam_contraste_anchos(e), 1L)                        # sin columnas de base: sólo "Diferencia"
  expect_identical(e$formas, c("ellipse", "rect", "triangle"))
})

test_that("con cuatro grupos: cuatro sub-filas, cuatro formas y la leyenda con su n", {
  e <- attr(graficar_dumbbell(.d3_tidy(4), estilo = "resumen"), "pulso_espec")
  expect_identical(ncol(e$valores), 4L); expect_identical(e$modo, "subfilas")
  expect_identical(e$formas, c("ellipse", "rect", "triangle", "diamond"))
  expect_identical(e$leyenda[4], "5to ciclo (60)")
  expect_match(e$nota_base, "50 a 60 de 5to ciclo", fixed = TRUE)
  expect_length(.lam_contraste_anchos(e), 1L)
})

test_that("con dos grupos nada cambia: diferencia con signo, leyenda sin n y el dumbbell del recetario", {
  e <- attr(graficar_dumbbell(.d3_tidy(2), estilo = "resumen"), "pulso_espec")
  expect_identical(e$modo, "par")
  expect_identical(e$leyenda, c("2do ciclo", "3er ciclo"))
  expect_true(all(grepl("^[+-]|^0$", e$textos_diferencia)))
  rec <- attr(graficar_dumbbell(.d3_tidy(2)), "pulso_espec")
  expect_identical(rec$tipo, "pesas")
  # El recetario con tres grupos ya no se niega: se dibuja como el contraste. Con cinco, sí.
  expect_identical(attr(graficar_dumbbell(.d3_tidy(3)), "pulso_espec")$tipo, "contraste")
  d5 <- rbind(.d3_tidy(4), transform(.d3_tidy(4)[1:4, ], grupo = "6to ciclo"))
  expect_error(graficar_dumbbell(d5), "de dos a 4 grupos y llegaron 5")   # P6: el mensaje dice el rango que acepta
})

test_that("el dumbbell entre públicos acepta de dos a cuatro: el analista los elige en los temas o en `bases`", {
  src <- .d3_fuentes(3)
  el <- p_dumbbell(vars = .d3_vars(3), corte = c("3", "4"))
  expect_length(el$vars[[1]], 3L)
  e <- attr(.d3_render(.render_dumbbell, el, src), "pulso_espec")
  expect_identical(e$tipo, "contraste")
  expect_identical(e$grupos, c("Docentes", "Estudiantes", "Administrativos"))
  expect_identical(e$leyenda, c("Docentes (115)", "Estudiantes (279)", "Administrativos (85)"))
  expect_identical(e$nota_base, "Base: 115 docentes, 279 estudiantes y 85 administrativos")
  # Cuatro públicos.
  e4 <- attr(.d3_render(.render_dumbbell, p_dumbbell(vars = .d3_vars(4), corte = c("3", "4"), estilo = "resumen"), .d3_fuentes(4)), "pulso_espec")
  expect_identical(ncol(e4$valores), 4L)
  # `bases` con tres: los temas son las preguntas comunes de las tres.
  el3 <- p_dumbbell(bases = c("docentes", "estudiantes", "administrativos"), corte = c("3", "4"))
  expect_identical(el3$vars, list(`Preguntas comunes` = c("docentes$*", "estudiantes$*", "administrativos$*")))
  r <- .regla_preguntas_conteo("p_dumbbell", list(bases = list("docentes", "estudiantes", "administrativos"), corte = list("3", "4"),
                                                  regla = list(tipo = "comunes")), .heq_con_matriz(src))   # matriz declarada (ADR 0138 §5)
  expect_identical(r$total, 4L)
  # Sin elegir y con tres en el estudio, el motor no decide: pide elegir. Con cinco temas por público, tampoco.
  falla <- tryCatch(.regla_preguntas_conteo("p_dumbbell", list(corte = list("3", "4"), regla = list(tipo = "comunes")), src),
                    api_error = function(e) conditionMessage(e))
  expect_identical(falla, "El contraste compara de dos a cuatro públicos: elige cuáles.")
  expect_error(p_dumbbell(vars = list(T = paste0(c("a", "b", "c", "d", "e"), "$p1")), corte = "4"), "de dos a cuatro")
})

test_that("la lámina de un gráfico con tres públicos sale nativa: sub-filas, leyenda con n, bases al pie y sin tabla de base", {
  skip_if_not_installed("officer")
  src <- .d3_fuentes(3)
  plan <- p_plan(slides = list(p_slide_1_grafico(p_dumbbell(vars = .d3_vars(3), corte = c("3", "4")), titulo = "Tres públicos")))
  f <- tempfile(fileext = ".pptx"); on.exit(unlink(f), add = TRUE)
  suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan, path_ppt = f, mensajes_progreso = FALSE))
  xml <- paste(readLines(unz(f, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "")
  expect_match(xml, "prosecnur:grafico:contraste", fixed = TRUE)
  expect_false(grepl("<p:pic>", xml, fixed = TRUE))                                   # nada como imagen
  expect_identical(lengths(regmatches(xml, gregexpr('name="puntos:marca"', xml, fixed = TRUE))), 4L * 3L)   # una marca por grupo y pregunta
  expect_identical(lengths(regmatches(xml, gregexpr('name="puntos:tallo"', xml, fixed = TRUE))), 4L * 3L)   # su línea desde el eje
  expect_false(grepl('name="puntos:base"', xml, fixed = TRUE))                        # sin columna de base
  expect_false(grepl(">Base</a:t>", xml, fixed = TRUE))
  expect_match(xml, "Docentes (115)", fixed = TRUE)
  expect_match(xml, "Base: 115 docentes, 279 estudiantes y 85 administrativos", fixed = TRUE)
  expect_match(xml, "la diferencia es el grupo mayor menos el menor, en puntos", fixed = TRUE)   # qué son las cifras, tras la base (2026-11-10)
})

test_that("en dos y en cuatro ranuras el contraste de tres grupos va nativo y el pie no se sale de la lámina", {
  skip_if_not_installed("officer")
  src <- .d3_fuentes(3)
  g <- function() p_dumbbell(vars = .d3_vars(3), corte = c("3", "4"), estilo = "resumen")
  plan <- p_plan(slides = list(p_slide_2_graficos(g(), g(), titulo = "Dos"), p_slide_4_graficos(g(), g(), g(), g(), titulo = "Cuatro")))
  f <- tempfile(fileext = ".pptx"); on.exit(unlink(f), add = TRUE)
  suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan, path_ppt = f, mensajes_progreso = FALSE))
  for (k in 1:2) {
    xml <- xml2::read_xml(paste(readLines(unz(f, sprintf("ppt/slides/slide%d.xml", k)), warn = FALSE, encoding = "UTF-8"), collapse = ""))
    ns <- c(p = "http://schemas.openxmlformats.org/presentationml/2006/main", a = "http://schemas.openxmlformats.org/drawingml/2006/main")
    expect_length(xml2::xml_find_all(xml, "//p:pic", ns), 0L)
    expect_gte(length(xml2::xml_find_all(xml, "//p:cNvPr[@name='puntos:marca']", ns)), 3L)
    base <- xml2::xml_find_first(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='Base lamina']]", ns)
    off <- as.numeric(xml2::xml_attr(xml2::xml_find_first(base, ".//a:off", ns), "y")) / 914400
    ext <- as.numeric(xml2::xml_attr(xml2::xml_find_first(base, ".//a:ext", ns), "cy")) / 914400
    expect_lte(off + ext, 7.5 + 1e-6)
  }
})

test_that("la base de la lámina con más de dos líneas sube sin salirse; con dos o menos, nada cambia", {
  corta <- .lam_pie_caja("Base: 172", bold = TRUE)
  expect_equal(corta, list(y = .std_comp("pie", "base_y"), h = 0.4, size = as.numeric(.std_pt("base"))))
  larga <- .lam_pie_caja(strrep("Base: Segundo ciclo 139; Tercer ciclo 25; Cuarto ciclo 115. ", 6), bold = TRUE)
  expect_lte(larga$y + larga$h, 7.5)
  expect_gte(larga$y, .std_geom("contenido_y1"))
  expect_lt(larga$y, .std_comp("pie", "base_y"))
})

test_that("las tarjetas entre públicos cotejan las cifras del contraste de tres públicos (no se abstienen por ser tres)", {
  src <- .d3_fuentes(3)
  el <- p_dumbbell(vars = .d3_vars(3), corte = c("3", "4"), estilo = "resumen")
  p <- .d3_render(.render_dumbbell, el, src)
  ref <- .tpub_referencia_pesas(attr(p, "pulso_espec"), .d3_vars(3))
  expect_length(ref, 4L)
  expect_identical(names(ref[[1]]), c("docentes", "estudiantes", "administrativos"))
  expect_true(all(is.finite(unlist(ref))))
  r <- .tpub_calcular(.tpub_temas_declarados(.d3_vars(3), .d3_vars(3), NULL), "3,4", src, {
    x <- .sig_regla_fabrica(); x$prueba <- "z"; x$correccion <- "bonferroni_fila"; x
  }, .tpub_opcion(list(tarjetas_diferencias = list(entre_publicos = TRUE))), referencia = ref)
  expect_true(all(vapply(r$temas, `[[`, "", "estado") == "evaluable"))
  expect_true(all(vapply(r$temas, function(te) nrow(.tpub_pares(te)), 0L) == 3L))     # los tres pares, nunca frente al resto
})

# Gonzalo, 2026-11-09 (leyenda "TC (24)  TPA (91)"): "Debería haber una opción para que la leyenda pueda incluir el N así".
test_that("N en la leyenda es una opción del analista: encendida y apagada con dos y con tres grupos", {
  ley <- function(k, v, estilo = "resumen") attr(graficar_dumbbell(.d3_tidy(k), estilo = estilo, leyenda_con_n = v), "pulso_espec")$leyenda
  # Sin declarar: con tres sí, con dos no (lo de hoy).
  expect_identical(ley(3, NULL), c("2do ciclo (139)", "3er ciclo (25)", "4to ciclo (115)"))
  expect_identical(ley(2, NULL), c("2do ciclo", "3er ciclo"))
  # Encendida y apagada, en los dos estilos.
  expect_identical(ley(2, TRUE), c("2do ciclo (139)", "3er ciclo (25)"))
  expect_identical(ley(3, FALSE), c("2do ciclo", "3er ciclo", "4to ciclo"))
  expect_identical(ley(2, TRUE, "recetario"), c("2do ciclo (139)", "3er ciclo (25)"))
  expect_identical(ley(2, FALSE, "recetario"), c("2do ciclo", "3er ciclo"))
  # Por el plan, en las tres versiones (base, contraste y aperturas), llega a la leyenda.
  src <- .d3_fuentes(3)
  for (estilo in list(NULL, "resumen")) {
    for (v in c(TRUE, FALSE)) {
      el <- p_dumbbell(vars = .d3_vars(3), corte = c("3", "4"), estilo = estilo, leyenda_con_n = v)
      expect_identical(el$overrides$leyenda_con_n, v)
      l <- attr(.d3_render(.render_dumbbell, el, src), "pulso_espec")$leyenda
      expect_identical(grepl("\\(115\\)$", l[1]), v)
    }
  }
  el2 <- p_dumbbell(vars = lapply(.d3_vars(3), `[`, 1:2), corte = c("3", "4"), leyenda_con_n = TRUE)
  expect_identical(attr(.d3_render(.render_dumbbell, el2, src), "pulso_espec")$leyenda, c("docentes (115)", "estudiantes (279)"))   # el recetario rotula la base tal cual
  ap <- p_dumbbell(vars = list("b$p1"), corte = "4", cruce = "b$c", grupos = c("1", "2"), estilo = "resumen", leyenda_con_n = FALSE)
  expect_identical(ap$overrides$leyenda_con_n, FALSE)
  # Declarada en el registro con su rótulo.
  arg <- Filter(function(a) identical(a$name, "leyenda_con_n"), .GRAFICADORES_META$p_dumbbell$args)
  expect_length(arg, 1L)
  expect_identical(arg[[1]]$label, "N en la leyenda"); expect_identical(arg[[1]]$tipo_input, "bool")
})

test_that("sin casos enteros (n fraccionario) la leyenda va sin N y, si se pidió, lo dice", {
  d <- .d3_tidy(2); d$n <- d$n_casos + 0.37; d$n_casos <- NULL
  expect_message(l <- attr(graficar_dumbbell(d, estilo = "resumen", leyenda_con_n = TRUE), "pulso_espec")$leyenda, "La leyenda va sin N")
  expect_identical(l, c("2do ciclo", "3er ciclo"))
  expect_message(l2 <- attr(graficar_dumbbell(d, leyenda_con_n = TRUE), "pulso_espec")$leyenda, "La leyenda va sin N")
  expect_identical(l2, c("2do ciclo", "3er ciclo"))
  expect_silent(graficar_dumbbell(d, estilo = "resumen"))
})

test_that("el grupo chico: sustantivo común en minúscula tras \"de\"; siglas y nombres tal cual; si no se sabe, rótulo y casos", {
  e <- list(grupos = c("Segundo ciclo", "Tercer ciclo", "TC", "Docentes"), casos = matrix(c(139, 25, 24, 12), 1))
  expect_identical(.dumbbell_nota_grupo_chico(e, "estudiantes"),
                   "Grupos chicos: 25 estudiantes de tercer ciclo; 24 estudiantes TC; Docentes, 12 estudiantes.")
  expect_identical(.dumbbell_grupo_chico_pieza("Prefiero no responder", 14, "estudiantes"), "Prefiero no responder, 14 estudiantes")
  expect_identical(.dumbbell_grupo_chico_pieza("TPA", 9, "docentes"), "9 docentes TPA")
})
