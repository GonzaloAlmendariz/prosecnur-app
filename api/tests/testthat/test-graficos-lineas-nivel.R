source("setup-load-all.R")

# Lámina «total arriba y protagonista abajo» con línea por nivel (variante 05, Gonzalo, 2026-11-04): cifras por nivel y
# fila derivada de dos preguntas, la marca de cada nivel frente al resto, el chip de tendencia que aparece y desaparece,
# la lámina nativa del PPT con sus formas y textos, y la figura del Word.

# ---- Fixture sintético -----------------------------------------------------------------------------------------------

# 40 aulas de 10 casos; cada nivel tiene 10 aulas. «t» (1 = Sí, 2 = No) sube con el nivel: 20, 30, 35 y 70 de cada 100.
# «h» solo existe para t = 1: 1 y 2 son «medio tiempo o más», 3 y 4 «por horas». «e» es plana (50% en todos los niveles).
.ln_base <- function() {
  si_por_aula <- list(`6` = c(1, 3, 2, 2, 1, 3, 2, 2, 2, 2), `7` = c(3, 2, 4, 3, 3, 2, 4, 3, 3, 3),
                      `8` = c(3, 4, 3, 4, 3, 4, 3, 4, 3, 4), `9` = c(7, 6, 8, 7, 7, 6, 8, 7, 7, 7))
  filas <- list(); a <- 0L
  for (nv in names(si_por_aula)) for (k in si_por_aula[[nv]]) {
    a <- a + 1L
    filas[[a]] <- data.frame(aula = sprintf("a%02d", a), niv = nv, t = c(rep("1", k), rep("2", 10 - k)),
                             e = rep(c("1", "2"), 5), stringsAsFactors = FALSE)
  }
  d <- do.call(rbind, filas)
  si <- which(d$t == "1")
  # Entre los que trabajan, la mitad (alternando) trabaja medio tiempo o más.
  d$h <- NA_character_
  d$h[si] <- rep(c("1", "3", "2", "4"), length.out = length(si))
  d$h[si[1]] <- NA_character_   # un caso con t = 1 sin «h»: no cuenta en la serie derivada y se avisa
  d
}
.ln_inst <- function() list(
  survey = data.frame(name = c("niv", "t", "h", "e"), type = c("select_one nv", "select_one sn", "select_one hh", "select_one sn"),
                      list_name = c("nv", "sn", "hh", "sn"), label = c("Nivel", "¿Trabajas?", "¿Cuánto tiempo?", "Experiencia"),
                      stringsAsFactors = FALSE),
  choices = data.frame(list_name = c(rep("nv", 5), "sn", "sn", rep("hh", 4)),
                       name = c("6", "7", "8", "9", "10", "1", "2", "1", "2", "3", "4"),
                       label = c("Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9", "Nivel 10", "Sí", "No", "Tiempo completo", "Medio tiempo",
                                 "Fines de semana", "Por horas"), stringsAsFactors = FALSE),
  orders_list = list(niv = list(names = c("6", "7", "8", "9", "10"), labels = c("Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9", "Nivel 10"), label = "Nivel"),
                     t = list(names = c("1", "2"), labels = c("Sí", "No"), label = "¿Trabajas?"),
                     h = list(names = c("1", "2", "3", "4"), labels = c("Tiempo completo", "Medio tiempo", "Fines de semana", "Por horas"),
                              label = "¿Cuánto tiempo?"),
                     e = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Experiencia")))
.ln_regla <- function() {
  r <- .sig_regla_fabrica()
  r$prueba <- "rao_scott"; r$correccion <- "bh_informe"; r$conglomerado <- "aula"; r$base_minima <- 30; r$conglomerados_minimos <- 8L
  r
}
.ln_el <- function(var = "t", series = NULL, ...) {
  series <- series %||% list(list(rotulo = "Trabaja", codigos = "1"),
                             list(rotulo = "Medio tiempo o más", codigos = "1", y = list(var = "h", codigos = c("1", "2"))))
  p_lineas_nivel(var = var, cruce = "niv", series = series, titulo_seccion = "Según nivel", rotulo_total = "Total de casos",
                 publico = "estudiantes", ...)
}
.ln_fuente <- function(d = .ln_base()) list(data = d, survey = .ln_inst()$survey, choices = .ln_inst()$choices,
                                             orders_list = .ln_inst()$orders_list)
.ln_modelo <- function(el, d = .ln_base()) {
  suppressMessages(.lineas_nivel_modelo(.ln_fuente(d), el, list(regla = .ln_regla(), familia = NULL)))
}
.ln_serie <- function(espec, rotulo) espec$series[[which(vapply(espec$series, `[[`, "", "rotulo") == rotulo)]]

# ---- Cifras ----------------------------------------------------------------------------------------------------------

test_that("cifras por nivel: el denominador son los casos del nivel y la fila derivada exige las dos preguntas", {
  d <- .ln_base()
  e <- .ln_modelo(.ln_el(), d)
  expect_identical(e$tipo, "total_y_cruce")
  expect_identical(e$protagonista, "lineas_nivel")
  expect_identical(e$niveles$codigo, c("6", "7", "8", "9"))
  expect_identical(e$niveles$n, rep(100L, 4))
  tr <- .ln_serie(e, "Trabaja")$puntos
  expect_equal(tr$p, c(20, 30, 35, 70))
  # La derivada, a mano: t = 1 y h en {1, 2}, sobre TODOS los casos del nivel (no sobre los que trabajan).
  a_mano <- vapply(c("6", "7", "8", "9"), function(k) 100 * mean(d$t[d$niv == k] == "1" & d$h[d$niv == k] %in% c("1", "2")), 0)
  expect_equal(.ln_serie(e, "Medio tiempo o más")$puntos$p, unname(a_mano))
  # El caso de t = 1 sin «h» se avisa con cuántos y por qué.
  expect_message(.lineas_nivel_modelo(.ln_fuente(d), .ln_el(), list(regla = .ln_regla(), familia = NULL)),
                 "1 caso cumplen «t» pero no responden «h»")
})

test_that("los valores especiales salen del denominador", {
  d <- .ln_base()
  d$t[d$niv == "6"][1:20] <- "99"   # 20 «No responde» en el nivel 6
  e <- .ln_modelo(.ln_el(series = list(list(rotulo = "Trabaja", codigos = "1"))), d)
  expect_identical(e$niveles$n[e$niveles$codigo == "6"], 80L)
  expect_identical(e$n_total, 380L)
})

test_that("la franja del total: las partes declaradas, su cifra y la llave sobre las que forman la serie exterior", {
  segs <- list(list(rotulo = "Medio tiempo o más", codigos = "1", y = list(var = "h", codigos = c("1", "2"))),
               list(rotulo = "Por horas", codigos = "1", y = list(var = "h", codigos = c("3", "4"))),
               list(rotulo = "No trabaja", codigos = "2"))
  e <- .ln_modelo(.ln_el(segmentos_total = segs))
  s <- e$total$segmentos
  expect_identical(s$rotulo, c("Medio tiempo o más", "Por horas", "No trabaja"))
  expect_equal(sum(s$pct), 100 - 100 * 1 / 400)   # el caso sin «h» no está en ninguna parte
  expect_equal(s$pct[3], 100 * (1 - 155 / 400))
  expect_identical(e$total$llave$rotulo, "Trabaja")
  expect_identical(c(e$total$llave$desde, e$total$llave$hasta), c(1L, 2L))
  # Los colores salen del estándar: la parte que reproduce una serie lleva su color.
  expect_identical(s$color[1], .ln_serie(e, "Medio tiempo o más")$color)
  expect_identical(s$color[3], .std_color("banda_clara"))
  # Sin partes declaradas y sin series anidadas, una parte por categoría de la pregunta (cualquier pregunta).
  e2 <- .ln_modelo(.ln_el(series = list(list(rotulo = "Sí", codigos = "1"))))
  expect_identical(e2$total$segmentos$rotulo, c("Sí", "No"))
})

# ---- Significancia ---------------------------------------------------------------------------------------------------

test_that("marca frente al resto: el nivel 9 sube y lleva ▲; con la regla, una base chica no se marca", {
  e <- .ln_modelo(.ln_el())
  tr <- .ln_serie(e, "Trabaja")$puntos
  expect_identical(tr$dir[tr$codigo == "9"], "up")
  expect_false(tr$fragil[tr$codigo == "9"])
  expect_true(is.na(tr$dir[tr$codigo == "8"]))
  # Un nivel con 20 casos (dos aulas) se dibuja, pero no se compara ni se marca, y la lámina dice por qué.
  d <- rbind(.ln_base(), data.frame(aula = rep(c("a41", "a42"), each = 10), niv = "10", t = "1", e = "1", h = "1",
                                    stringsAsFactors = FALSE))
  e10 <- .ln_modelo(.ln_el(), d)
  p10 <- .ln_serie(e10, "Trabaja")$puntos
  expect_false(p10$comparable[p10$codigo == "10"])
  expect_true(is.na(p10$dir[p10$codigo == "10"]))
  expect_match(e10$no_comparables, "Nivel 10 no se compara: menos de 30 estudiantes", fixed = TRUE)
})

test_that("el chip de tendencia aparece si la serie crece con el nivel y desaparece si no hay tendencia o se apaga", {
  e <- .ln_modelo(.ln_el())
  td <- .ln_serie(e, "Trabaja")$tendencia
  expect_identical(td$dir, "up")
  # Revisión del PPT v7.23, ítem 10: Gonzalo preguntó si «Crece con el nivel» era significativo; el chip lo dice.
  expect_identical(td$texto, "Crece significativamente con el nivel")
  plana <- .ln_modelo(.ln_el(var = "e", series = list(list(rotulo = "Experiencia", codigos = "1"))))
  expect_null(.ln_serie(plana, "Experiencia")$tendencia)
  expect_true(all(is.na(.ln_serie(plana, "Experiencia")$puntos$dir)))
  apagada <- .ln_modelo(.ln_el(mostrar_significancia = FALSE))
  expect_null(.ln_serie(apagada, "Trabaja")$tendencia)
  expect_true(all(is.na(.ln_serie(apagada, "Trabaja")$puntos$dir)))
  # La palabra del chip se declara.
  ciclo <- .ln_modelo(.ln_el(nombre_nivel = "ciclo"))
  expect_identical(.ln_serie(ciclo, "Trabaja")$tendencia$texto, "Crece significativamente con el ciclo")
})

test_that("el constructor valida series y acepta la forma rectangular de un JSON", {
  expect_error(p_lineas_nivel(var = "t", cruce = "niv", series = list()), "al menos una serie")
  expect_error(p_lineas_nivel(var = "t", cruce = "niv", series = list(list(rotulo = "A"))), "no declara `codigos`")
  expect_error(p_lineas_nivel(var = "t", cruce = "niv", series = rep(list(list(rotulo = "A", codigos = "1")), 4)), "hasta 3 series")
  df <- data.frame(rotulo = c("A", "B"), stringsAsFactors = FALSE); df$codigos <- list("1", c("1", "2"))
  el <- p_lineas_nivel(var = "t", cruce = "niv", series = df)
  expect_identical(el$series[[2]]$codigos, c("1", "2"))
  expect_identical(el$.element_type, "lineas_nivel")
})

# ---- Artefactos: PPT y Word ------------------------------------------------------------------------------------------

.ln_plan <- function(...) list(a = p_slide_1_grafico(grafico = .ln_el(lectura = "Una lectura al margen, sin marcas.", ...),
                                                      titulo = "¿Trabajas de forma remunerada?",
                                                      base = "Base: 400 casos. Fuente: estudio sintético."))

test_that("la lámina nativa del PPT lleva el total, las líneas, el halo, el chip, la lectura y la base", {
  skip_if_not_installed("officer")
  old <- options(prosecnur.sig_informe = list(regla = .ln_regla(), familia = NULL)); on.exit(options(old), add = TRUE)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = .ln_base(), instrumento = .ln_inst(), plan = .ln_plan(), path_ppt = out,
                                                     mensajes_progreso = FALSE)))
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  nombres <- xml2::xml_attr(xml2::xml_find_all(xml, "//p:cNvPr"), "name")
  textos <- xml2::xml_text(xml2::xml_find_all(xml, "//a:t"))
  expect_true("prosecnur:grafico:total" %in% nombres)
  expect_true("prosecnur:grafico:lineas_nivel" %in% nombres)
  expect_true(all(c("total:segmento", "total:llave", "lineas:serie", "lineas:punto", "lineas:halo:99", "chip:99", "panel:lectura",
                    "Base lamina") %in% nombres))
  expect_true(all(c("Total de casos", "Según nivel", "Trabaja", "Medio tiempo o más", "Crece significativamente con el nivel", "70%", "Nivel 9",
                    "100 estudiantes") %in% textos))
  expect_true(any(grepl("^Trabaja 39%$", textos)))   # la llave: 155 de 400 casos trabajan
  expect_true(any(grepl("Base: 400 casos", textos, fixed = TRUE)))
  # Las sombras de las series anidadas son formas libres translúcidas; las tres series no se pisan en el panel.
  expect_gte(length(xml2::xml_find_all(xml, "//a:custGeom")), 2L)
  expect_match(as.character(xml), "<a:alpha val=", fixed = TRUE)
  # Sin solapes en el panel: el rótulo de cada serie y su chip no se montan sobre el de la otra.
  caja <- function(n) {
    sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n))
    off <- xml2::xml_find_first(sp, ".//a:off"); ext <- xml2::xml_find_first(sp, ".//a:ext")
    data.frame(t = as.numeric(xml2::xml_attr(off, "y")), b = as.numeric(xml2::xml_attr(off, "y")) + as.numeric(xml2::xml_attr(ext, "cy")))
  }
  pan <- rbind(caja("panel:serie"), caja("chip:99"), caja("chip:95"))
  pan <- pan[order(pan$t), ]
  expect_true(all(pan$t[-1] >= pan$b[-nrow(pan)] - 1))
})

test_that("con el motor nativo apagado la lámina sale por la ruta anterior con la figura", {
  skip_if_not_installed("officer")
  old <- options(prosecnur.sig_informe = list(regla = .ln_regla(), familia = NULL)); on.exit(options(old), add = TRUE)
  p <- .lineas_nivel_render_fuentes(.ln_el(), list(data_sources = list(default = .ln_base()), inst_sources = list(default = .ln_inst())))
  espec <- attr(p, "pulso_espec")
  expect_true(.lam_compositor_aplica(p, list(meta = list())))
  expect_false(.lam_compositor_aplica(p, list(meta = list(motor_nativo = FALSE))))
  expect_s3_class(p, "ggplot")
  expect_identical(espec$tipo, "total_y_cruce")
})

test_that("el Word incluye la figura con la base debajo", {
  skip_if_not_installed("officer")
  old <- options(prosecnur.sig_informe = list(regla = .ln_regla(), familia = NULL)); on.exit(options(old), add = TRUE)
  docx <- tempfile(fileext = ".docx")
  suppressMessages(suppressWarnings(reporte_word_plan(data = .ln_base(), instrumento = .ln_inst(), plan = .ln_plan(), path_docx = docx,
                                                      mensajes_progreso = FALSE)))
  partes <- utils::unzip(docx, list = TRUE)$Name
  expect_gte(length(grep("^word/media/.*\\.png$", partes)), 1L)
  doc <- xml2::read_xml(unz(docx, "word/document.xml"))
  texto <- paste(xml2::xml_text(xml2::xml_find_all(doc, "//w:t")), collapse = " ")
  expect_match(texto, "Base:", fixed = TRUE)
  # La figura es la del flujo de siempre (marco del Word) y conserva la espec de la lámina.
  g <- .word_grafico(.lineas_nivel_render_fuentes(.ln_el(), list(data_sources = list(default = .ln_base()),
                                                                 inst_sources = list(default = .ln_inst()))))
  expect_identical(attr(g, "renderer"), "marco")
  expect_gt(attr(g, "alto"), 3)
})

# ---- Revisión del PPT v7.23 de CCSS, lámina 42 (ítem 10) -----------------------------------------------------------------
# Gonzalo: «la leyenda va a la derecha del gráfico, no al lado del último eje de la línea»; «no queda claro que quienes
# trabajan de arriba son los que están abajo»; «¿ese "crece con el nivel" es significante?».

test_that("v7.23 ítem 10: la leyenda de las series va a la derecha de las líneas, con su parte del total, y la de símbolos al pie", {
  skip_if_not_installed("officer")
  old <- options(prosecnur.sig_informe = list(regla = .ln_regla(), familia = NULL)); on.exit(options(old), add = TRUE)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = .ln_base(), instrumento = .ln_inst(), plan = .ln_plan(), path_ppt = out,
                                                     mensajes_progreso = FALSE)))
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  textos <- xml2::xml_text(xml2::xml_find_all(xml, "//a:t"))
  caja <- function(n) {
    sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n))
    off <- xml2::xml_find_first(sp, ".//a:off"); ext <- xml2::xml_find_first(sp, ".//a:ext")
    x <- as.numeric(xml2::xml_attr(off, "x")) / 914400; y <- as.numeric(xml2::xml_attr(off, "y")) / 914400
    data.frame(l = x, r = x + as.numeric(xml2::xml_attr(ext, "cx")) / 914400, t = y, b = y + as.numeric(xml2::xml_attr(ext, "cy")) / 914400)
  }
  puntos <- caja("lineas:punto"); serie <- caja("panel:serie"); lectura <- caja("panel:lectura")
  # Cada rótulo de serie queda entero a la derecha del último punto (no junto a él) y arriba de la lectura.
  expect_gte(nrow(serie), 2L)
  expect_true(all(serie$l > max(puntos$r) + 0.4))
  expect_true(all(serie$b <= min(lectura$t)))
  # Con su muestra de color y su parte del total: el mismo número que la llave de la franja («Trabaja 39%»).
  expect_gte(nrow(caja("leyenda:serie:muestra")), 2L)
  expect_true("39% en el total" %in% textos)
  expect_true(any(grepl("^Trabaja 39%$", textos)))
  # El chip dice que la tendencia es significativa y la leyenda de símbolos lo explica, al pie de las líneas.
  expect_true("Crece significativamente con el nivel" %in% textos)
  expect_true(all(c("Mayor que el resto de niveles", "Menor que el resto de niveles", "Tendencia significativa con el nivel") %in% textos))
  expect_gte(nrow(caja("leyenda:chip")), 1L)
  expect_true(min(caja("leyenda:texto")$t) > max(caja("lineas:n")$b))
  # Registro formal: sin rayas ni punto medio en lo que se lee.
  expect_false(any(grepl("—|·", textos)))
})

test_that("v7.23 ítem 10: el Word repite la leyenda a la derecha y la de símbolos bajo el gráfico", {
  e <- .ln_modelo(.ln_el(lectura = "Lectura."))
  g <- .lineas_nivel_gg_lineas(e, "Arial")
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  et <- unlist(lapply(b$data, function(d) if ("label" %in% names(d)) as.character(d$label)))
  expect_true(all(c("Trabaja", "Medio tiempo o más", "39% en el total") %in% et))
  expect_true(any(grepl("Crece significativamente", et, fixed = TRUE)))
  # La leyenda va a la derecha del último nivel: ningún rótulo de serie a la altura de las líneas.
  xs <- unlist(lapply(b$data, function(d) if ("label" %in% names(d)) d$x[d$label %in% c("Trabaja", "Medio tiempo o más")]))
  expect_true(all(xs > nrow(e$niveles) + 0.3))
  expect_match(.lineas_nivel_word_simbolos(e), "Tendencia significativa con el nivel|tendencia significativa con el nivel")
  expect_false(grepl("—|·", .lineas_nivel_word_simbolos(e)))
})
