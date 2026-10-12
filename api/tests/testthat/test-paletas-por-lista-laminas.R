# ADR 0097 — cada familia nativa honra la paleta del usuario en su espec (`espec$colores`) y en la lámina; sin paleta
# del usuario (ninguna, o la de un perfil) categórica y torta salen byte a byte como antes.

skip_if_not_installed("officer"); skip_if_not_installed("rvg")

.pll_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.pll_hash <- function(o) digest::digest(as.character(o$doc$slide$get_slide(o$doc$cursor)$get()), algo = "sha256")
.pll_xml <- function(o) o$doc$slide$get_slide(o$doc$cursor)$get()
.pll_fill <- function(xml, nombre) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  toupper(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:solidFill/a:srgbClr"), "val"))
}
.pll_hex <- function(x) toupper(sub("^#", "", x))
.pll_usuario <- function(pal) {
  attr(pal, "paleta_lista") <- "lst"; attr(pal, "paleta_origen") <- "nombre"; attr(pal, "paleta_usuario") <- TRUE
  pal
}

# Instrumento mínimo: una categórica de tres, una Sí/No, una batería de acuerdo de dos ítems.
.pll_lk <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")
.pll_inst <- list(
  survey = data.frame(name = c("p1", "s", "q1", "q2"), type = c("select_one cic", "select_one sn", "select_one lst_p14", "select_one lst_p14"),
                      list_name = c("cic", "sn", "lst_p14", "lst_p14"), label = c("Ciclo", "Tiene", "Uno", "Dos"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c(rep("cic", 3), "sn", "sn", rep("lst_p14", 4)), name = c("Quinto", "Sexto", "Otros", "1", "2", as.character(1:4)),
                       label = c("Quinto", "Sexto", "Otros", "Sí", "No", .pll_lk), stringsAsFactors = FALSE),
  orders_list = NULL)
.pll_dat <- data.frame(p1 = rep(c("Quinto", "Sexto", "Otros"), c(22, 19, 3)), s = rep(c("1", "2", "1"), c(20, 12, 12)),
                       q1 = rep(as.character(1:4), 11), q2 = rep(as.character(c(4, 3, 3, 1)), 11), stringsAsFactors = FALSE)
.pll_ruta <- function(plan, paletas = list()) {
  f <- tempfile(fileext = ".pptx")
  env <- .graficos_palette_env(paletas, parent = environment())
  suppressWarnings(reporte_ppt_plan(data = .pll_dat, instrumento = .pll_inst, plan = plan, path_ppt = f, env_diapos = env, mensajes_progreso = FALSE))
  f
}
.pll_slide <- function(f, k) xml2::read_xml(unz(f, sprintf("ppt/slides/slide%d.xml", k)))
.pll_slide_txt <- function(f, k) paste(readLines(unz(f, sprintf("ppt/slides/slide%d.xml", k)), warn = FALSE), collapse = "\n")

test_that("sin colores en la espec, las láminas categóricas y circulares salen byte a byte como antes (golden)", {
  # Huellas del XML medidas con el código anterior al ADR 0097 (commit 4330de9): un cambio aquí es un cambio visible.
  e3 <- preparar_categorica(c("Quinto", "Sexto", "Séptimo"), c(.32, .28, .40), c("32%", "28%", "40%"), c(32, 28, 40), resaltar = TRUE)   # golden con realce
  e2 <- preparar_categorica(c("Sí", "No"), c(.62, .38), c("62%", "38%"), c(62, 38))
  pie3 <- attr(suppressWarnings(graficar_pie(data.frame(c = c("Sí", "No", "NS"), p = c(.6, .33, .07), n = c(60, 33, 7)), "c", "p", var_n = "n", tipo_pie = "pie")), "pulso_espec")
  dona2 <- attr(suppressWarnings(graficar_pie(data.frame(c = c("Sí", "No"), p = c(133, 39) / 172, n = c(133, 39)), "c", "p", var_n = "n", tipo_pie = "donut")), "pulso_espec")
  expect_null(e3$colores); expect_null(pie3$colores)
  expect_identical(.pll_hash(.lam_laminas_categorica(.pll_doc(), e3, "Nivel", base = "Base: 100", folio = 68, unidad_n = "estudiantes")),
                   "c2057c23e6f8219cc1b0be9eed3b5cd11a3c146fdb82309d6ff86d4eb35d7848")
  expect_identical(.pll_hash(.lam_laminas_categorica(.pll_doc(), e3, "Nivel", base = "Base: 100", folio = 68, forma = "barras")),
                   "89e50ad2dc8d9363403922241b32af71980d40ae98b150caca8eae628797590c")
  # La dicotomía rotulaba «Sí (62)» siempre; desde «Casos junto al porcentaje» eso es el modo «siempre» (golden intacto).
  expect_identical(withr::with_options(list(prosecnur.casos_junto = list(cuando = "siempre")), .pll_hash(.lam_laminas_dicotomia(.pll_doc(), e2, "Dico", base = "Base: 100", folio = 74))),
                   "1a69d8efcacfc4703a7254eedff5d0d9c1c045ae295bede9e75814d42c8e6b8a")
  expect_identical(.pll_hash(.lam_laminas_torta(.pll_doc(), pie3, "Torta", folio = 69, unidad_n = "egresados")),
                   "ac570e9ae137e339c3d9f218f12c26ae64c3e289793e856ce187439c5e2ee669")
  expect_identical(.pll_hash(.lam_laminas_dona(.pll_doc(), dona2, "Dona", folio = 70, unidad_n = "estudiantes", rotulo_centro = "conoce")),
                   "7f898712d77a9f50a5e562fd8e6de3999a8b0ddbcde2242735cc9d2086a79b1a")
})

test_that("en la ruta real, una paleta de perfil o ajena deja categórica, dicotomía y torta idénticas a sin paleta", {
  plan <- list(a = p_slide_1_grafico(grafico = p_barras_categoricas("p1"), titulo = "Nivel"),
               b = p_slide_1_grafico(grafico = p_pie("s"), titulo = "Torta"),
               c = p_slide_1_grafico(grafico = p_barras_categoricas("s"), titulo = "Dico"))
  sin <- .pll_ruta(plan)
  # La `dicotomia` del perfil de acreditación resuelve para «sn» por firma (Sí/No), pero es del perfil (P2a).
  perfil <- .pll_ruta(plan, list(dicotomia = .ppt_style_profile_acreditacion()$paletas$dicotomia))
  ajena <- .pll_ruta(plan, list(otra_lista = list(Lima = "#FF0000", Cusco = "#00FF00")))
  for (k in 1:3) {
    expect_identical(.pll_slide_txt(perfil, k), .pll_slide_txt(sin, k))
    expect_identical(.pll_slide_txt(ajena, k), .pll_slide_txt(sin, k))
  }
  # Las tres siguen nativas y monocromas (navy) sin paleta del usuario.
  expect_identical(unique(.pll_fill(.pll_slide(sin, 1), "columna")), .pll_hex(.std_color("azul")))
})

test_that("categórica, dicotomía y torta usan la paleta del usuario (por nombre y por firma) en la ruta real", {
  plan <- list(a = p_slide_1_grafico(grafico = p_barras_categoricas("p1"), titulo = "Nivel"),
               b = p_slide_1_grafico(grafico = p_pie("s"), titulo = "Torta"),
               c = p_slide_1_grafico(grafico = p_barras_categoricas("s"), titulo = "Dico"))
  f <- .pll_ruta(plan, list(cic = list(Quinto = "#AA0000", Sexto = "#00AA00", Otros = "#0000AA"),
                            mi_si_no = list("SÍ" = "#123456", "no" = "#654321")))   # firma: caja y tilde no importan
  expect_identical(.pll_fill(.pll_slide(f, 1), "columna"), c("AA0000", "00AA00", "0000AA"))
  torta <- .pll_fill(.pll_slide(f, 2), "torta:porcion")
  expect_setequal(torta, c("123456", "654321"))
  expect_setequal(.pll_fill(.pll_slide(f, 3), "dicotomia:segmento"), c("123456", "654321"))
})

test_that("la opción sin color en la paleta del usuario sale gris residual, con aviso, y no por posición", {
  plan <- list(a = p_slide_1_grafico(grafico = p_barras_categoricas("p1"), titulo = "Nivel"))
  msgs <- character(0)
  f <- withCallingHandlers(.pll_ruta(plan, list(cic = list(Sexto = "#00AA00", Quinto = "#AA0000"))),
                           message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  rot <- xml2::xml_text(xml2::xml_find_all(.pll_slide(f, 1), "//p:sp[p:nvSpPr/p:cNvPr[@name='rotulo']]"))
  fills <- stats::setNames(.pll_fill(.pll_slide(f, 1), "columna"), rot)
  expect_identical(unname(fills[c("Quinto", "Sexto", "Otros")]), c("AA0000", "00AA00", .pll_hex(.paleta_gris_residual())))
  expect_true(any(grepl("La opción «Otros» no tiene color en la paleta de «cic»", msgs, fixed = TRUE)))
})

test_that("la agrupada de una serie y el ranking con puntos llevan la paleta del usuario en su espec y su lámina", {
  pal <- .pll_usuario(c(B = "#0000AA", A = "#AA0000", C = "#00AA00", Otros = "#777777"))
  d <- data.frame(categoria = c("A", "B", "Otros", "C"), N = 100, s1 = c(.2, .5, .05, .25))
  g <- .paleta_en_espec(suppressWarnings(graficar_barras_agrupadas(d, "categoria", "N", "s1", c(s1 = "Serie"), orden_barras = "mayor_menor",
                                                                    invertir_barras = TRUE, exportar = "rplot", decimales = 0)), pal)
  e <- attr(g, "pulso_espec")
  expect_identical(unname(e$colores[e$rotulos]), unname(pal[e$rotulos]) |> as.vector())
  x <- .pll_xml(.lam_laminas_categorica(.pll_doc(), e, "Agrupada", forma = "barras"))
  expect_identical(.pll_fill(x, "barra"), .pll_hex(unname(pal[e$rotulos])))
  # Lollipop: cada punto con el color de su opción; el resaltado manda.
  el <- .pll_usuario(c(Quinto = "#AA0000", Sexto = "#00AA00", Otros = "#0000AA"))
  lol <- preparar_categorica(c("Quinto", "Sexto", "Otros"), c(.5, .3, .2), c("50%", "30%", "20%"))
  lol$forma <- "lollipop"; lol <- .espec_con_colores(lol, el)
  expect_identical(.pll_fill(.pll_xml(.lam_laminas_lollipop(.pll_doc(), lol, "Ranking")), "lollipop:punto"), c("AA0000", "00AA00", "0000AA"))
  lol$resaltar <- "Sexto"
  expect_identical(.pll_fill(.pll_xml(.lam_laminas_lollipop(.pll_doc(), lol, "Ranking")), "lollipop:punto")[2], .pll_hex(.std_color("coral")))
})

test_that("una paleta de perfil no vuelve multicolor una categórica ni una torta (P2a)", {
  pal <- .pll_usuario(c(Quinto = "#AA0000", Sexto = "#00AA00"))
  attr(pal, "paleta_usuario") <- FALSE
  e <- preparar_categorica(c("Quinto", "Sexto", "Otros"), c(.5, .3, .2), c("50%", "30%", "20%"))
  expect_null(.espec_con_colores(e, pal)$colores)
  p <- structure(list(), pulso_espec = e)
  expect_identical(attr(.paleta_en_espec(p, pal), "pulso_espec"), e)
  # Mutante: con la paleta del usuario sí se llena.
  attr(pal, "paleta_usuario") <- TRUE
  expect_false(is.null(suppressMessages(.espec_con_colores(e, pal))$colores))
})

test_that("las divergentes pintan por etiqueta, no por posición, y su espec lleva los colores por rótulo", {
  data <- data.frame(item = c("Uno", "Dos"), pct_1 = c(.1, .2), pct_2 = c(.2, .2), pct_3 = c(.4, .3), pct_4 = c(.3, .3))
  cols <- paste0("pct_", 1:4); et <- stats::setNames(.pll_lk, cols)
  part <- .divergentes_reparto(cols, 2L, TRUE)
  sin <- .espec_divergentes(data, "item", cols, et, part, "proporcion_1")
  # Paleta guardada AL REVÉS: el respaldo posicional le habría dado a «Totalmente en desacuerdo» el color del acuerdo.
  pal <- .pll_usuario(stats::setNames(c("#000004", "#000003", "#000002", "#000001"), rev(.pll_lk)))
  con <- .espec_divergentes(data, "item", cols, et, part, "proporcion_1", colores = pal)
  expect_identical(con$categorias$color, c("#000001", "#000002", "#000003", "#000004"))
  expect_identical(unname(con$colores[.pll_lk]), c("#000001", "#000002", "#000003", "#000004"))
  expect_null(sin$colores)
  # Por columna también vale.
  por_col <- .espec_divergentes(data, "item", cols, et, part, "proporcion_1", colores = c(pct_1 = "#0000AA", pct_4 = "#00AA00", pct_2 = "#111111", pct_3 = "#222222"))
  expect_identical(por_col$categorias$color[c(1, 4)], c("#0000AA", "#00AA00"))
  # Sin nombres no hay de quién es cada color: queda el recetario (antes se repartían por posición).
  sin_nombres <- .espec_divergentes(data, "item", cols, et, part, "proporcion_1", colores = c("#0000AA", "#00AA00", "#111111", "#222222"))
  expect_identical(sin_nombres$categorias$color, sin$categorias$color)
  # La lámina usa el color de cada nivel.
  x <- .pll_xml(.lam_laminas_divergentes(.pll_doc(), con, "Div"))
  expect_true(all(c("000001", "000004") %in% .pll_fill(x, "divergentes:segmento")))
})

test_that("en la ruta real, las divergentes toman la paleta del usuario de su lista por firma", {
  plan <- list(a = p_slide_1_grafico(grafico = p_barras_divergentes(vars = c("q1", "q2"), n_negativas = 2), titulo = "Div"))
  sin <- .pll_ruta(plan)
  con <- .pll_ruta(plan, list(escala_cliente = stats::setNames(as.list(c("#0A0A01", "#0A0A02", "#0A0A03", "#0A0A04")), toupper(.pll_lk))))
  fs <- .pll_fill(.pll_slide(sin, 1), "divergentes:segmento"); fc <- .pll_fill(.pll_slide(con, 1), "divergentes:segmento")
  skip_if(!length(fs), "las divergentes no salieron nativas en este entorno")
  expect_true(all(fc %in% c("0A0A01", "0A0A02", "0A0A03", "0A0A04")))
  expect_false(any(fs %in% c("0A0A01", "0A0A02", "0A0A03", "0A0A04")))
})

test_that("una escala de dos categorías que va a dicotomía lee la paleta del usuario; sin ella, la dicotómica", {
  esp <- function(colores) {
    d <- data.frame(g = "Todos", N = 100, p1 = 62, p2 = 38)
    preparar_escala(d, "g", "N", c("p1", "p2"), c(p1 = "Sí", p2 = "No"), escala_valor = "proporcion_100", colores_grupos = colores)
  }
  sin <- esp(c("Sí" = "#081F5C", No = "#9EC3E6"))
  expect_null(sin$colores)
  expect_identical(.lam_dicotomia_datos(sin)$colores, .std_paleta("dicotomica"))
  con <- esp(.pll_usuario(c("Sí" = "#123456", No = "#654321")))
  expect_identical(unname(con$colores), c("#123456", "#654321"))
  expect_identical(.lam_dicotomia_datos(con)$colores, c("#123456", "#654321"))
})

test_that("el comparativo de dimensiones pinta sus grupos con la paleta del usuario del cruce", {
  e <- list(tipo = "comparativo_dim", filas = c("D1", "D2"), grupos = c("Mujer", "Hombre"), n = c(10, 12),
            valores = matrix(c(60, 70, 55, 65), 2), textos_diferencia = c("5 pts", "5 pts"))
  sin <- .pll_fill(.pll_xml(.lam_laminas_comparativo_dim(.pll_doc(), e, "Comparativo")), "comparativo:barra")
  expect_setequal(sin, .pll_hex(c(.std_color("azul"), .std_color("azul_medio"))))
  dsrc <- structure(data.frame(x = 1), dimensiones_config = list(paletas_cruce = list(sexo = .pll_usuario(c(Hombre = "#00AA00", Mujer = "#AA0000")))))
  e2 <- .espec_dim_colores_cruce(e, list(cruce = "base$sexo", data = dsrc))
  expect_identical(unname(e2$colores), c("#AA0000", "#00AA00"))
  con <- .pll_fill(.pll_xml(.lam_laminas_comparativo_dim(.pll_doc(), e2, "Comparativo")), "comparativo:barra")
  expect_identical(con, c("AA0000", "00AA00", "AA0000", "00AA00"))
  # Sin paleta del cruce, la espec no cambia.
  expect_identical(.espec_dim_colores_cruce(e, list(cruce = "sexo", data = data.frame(x = 1))), e)
})
