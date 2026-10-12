source("setup-load-all.R")

# Contrato base-sin-ponderar F6 (docs/qa/contrato-base-sin-ponderar-graficos-f6-2026-10-11.md), writer B:
# especificaciones, renderers y documento. Lo que se CUENTA en una lámina («x de y», base chica, «N respuestas»,
# «(33)», «N = 12», el público de un panel) va en casos sin ponderar; los porcentajes siguen ponderados.

.bcr_cats <- c(pct_1 = "Totalmente en desacuerdo", pct_2 = "En desacuerdo", pct_3 = "De acuerdo",
               pct_4 = "Totalmente de acuerdo")
.bcr_cols <- names(.bcr_cats)
.bcr_nc <- stats::setNames(paste0("nc_", 1:4), .bcr_cols)

# Una fila de escala: % ponderados, N ponderado y casos crudos por segmento.
.bcr_fila <- function(categoria, pct, N, nc, n = pct * N) {
  d <- data.frame(categoria = categoria, N = N, N_casos = sum(nc), stringsAsFactors = FALSE)
  for (i in 1:4) { d[[.bcr_cols[i]]] <- pct[i]; d[[paste0("n_", i)]] <- n[i]; d[[.bcr_nc[i]]] <- nc[i] }
  d
}
.bcr_escala <- function(d, ...) {
  preparar_escala(d, "categoria", "N", .bcr_cols, .bcr_cats, barra_extra_preset = "top2box",
                  top2box_labels = unname(.bcr_cats[3:4]), ...)
}

test_that("test 6: «12 de 20» con 48 %: los casos del box son los crudos de sus columnas, no prop × n", {
  # 20 personas; 12 marcaron el box, pero con peso el box pesa 48 %.
  d <- .bcr_fila("p1", pct = c(0.30, 0.22, 0.28, 0.20), N = 45, nc = c(4, 4, 6, 6))
  e <- .bcr_escala(d, var_n_casos = "N_casos", cols_n_casos = .bcr_nc)
  expect_identical(e$box$cifras[[1]], "48%")
  expect_identical(.lam_casos_texto(e$box, e, 1), "12 de 20")
  # Mutante `floor(prop × n_casos + 0.5)`: 0.48 × 20 = 9.6 -> «10 de 20».
  e_mut <- .bcr_escala(d, var_n_casos = "N_casos")
  expect_identical(.lam_casos_texto(e_mut$box, e_mut, 1), "10 de 20")
  # Sin casos declarados (corrida sin peso, llamador anterior) la regla es la de siempre.
  e_sin <- .bcr_escala(d)
  expect_identical(e_sin$filas$n_casos, e_sin$filas$n)
})

test_that("test 5: el umbral de base chica (< 30) se mira en casos: 20 × 2.25 es chica, 40 × 0.5 no", {
  chica <- .bcr_escala(.bcr_fila("p1", pct = rep(0.25, 4), N = 20 * 2.25, nc = c(5, 5, 5, 5)),
                       var_n_casos = "N_casos", cols_n_casos = .bcr_nc)
  grande <- .bcr_escala(.bcr_fila("p1", pct = rep(0.25, 4), N = 40 * 0.5, nc = c(10, 10, 10, 10)),
                        var_n_casos = "N_casos", cols_n_casos = .bcr_nc)
  expect_equal(chica$filas$n, 45); expect_equal(chica$filas$n_casos, 20)
  expect_true(.lam_base_chica(chica))
  expect_equal(grande$filas$n, 20); expect_equal(grande$filas$n_casos, 40)
  expect_false(.lam_base_chica(grande))
  # «N respuestas» y la nota de la premisa se escriben en casos.
  expect_identical(.lam_escala_premisas(grande)[[1]]$filas[[1]]$valid, 40)
})

test_that(".espec_casos es el lector único: n_casos, o n si la especificación no la trae", {
  expect_identical(.espec_casos(list(n = c(3, 4))), c(3, 4))
  expect_identical(.espec_casos(list(n = c(3.5, 4.5), n_casos = c(3, 4))), c(3, 4))
  # `$` completaría «n» a «n_casos» o «n_base_casos»: el lector usa `[[`.
  expect_null(.espec_casos(list(n_base_casos = 30)))
})

test_that("test 14: .espec_n_base lee n_base_casos y sólo sin ella reconstruye por la mediana", {
  # El rótulo «Sí (12)» depende de «Casos junto al porcentaje»: este test lo fija en «siempre».
  withr::local_options(prosecnur.casos_junto = list(cuando = "siempre"))
  # Selección múltiple ponderada: las proporciones suman > 1 y son ponderadas; los casos no.
  e <- preparar_categorica(c("A", "B", "C"), valores = c(0.62, 0.55, 0.31), cifras = c("62%", "55%", "31%"),
                           n = c(34.1, 30.25, 17.05), n_casos = c(15, 14, 9), n_base_casos = 30)
  expect_identical(.espec_n_base(e), 30)
  e$n_base_casos <- NA_real_
  # Sin la base en casos: la mediana de casos / proporción (aproximada con peso), nunca la suma de pesos.
  expect_identical(.espec_n_base(e), round(stats::median(c(15, 14, 9) / c(0.62, 0.55, 0.31))))
  # Respuesta única: suma de casos.
  u <- preparar_categorica(c("Sí", "No"), c(0.6, 0.4), c("60%", "40%"), n = c(27, 18), n_casos = c(12, 18))
  expect_identical(.espec_n_base(u), 30)
  # La dicotomía rotula «Sí (12)» en casos.
  expect_identical(.lam_dicotomia_datos(u)$n, c(12, 18))
})

test_that("test 15: .n_barra_procede compara casos contra casos (multilista)", {
  # 30 casos que con peso medio 0.67 suman 20: contra la base de 30 casos NO es un salto de cuestionario.
  espec <- list(tipo = "escala", filas = data.frame(grupo_id = NA_character_, n = 20, n_casos = 30))
  out <- .lam_multilista_nota_n(espec, fuentes = "docentes", bases_publico = c(docentes = 30))
  expect_false(isTRUE(out$filas$n_nota))
  # Con un salto de verdad (24 de 30 casos) sí se anota, y la nota dice los casos.
  espec$filas$n_casos <- 24
  out2 <- .lam_multilista_nota_n(espec, fuentes = "docentes", bases_publico = c(docentes = 30))
  expect_true(isTRUE(out2$filas$n_nota))
})

test_that("test 15 (graficador): la N por barra de las apiladas sale de var_n_casos", {
  d <- .bcr_fila("q1__1__docentes", pct = rep(0.25, 4), N = 20, nc = c(8, 8, 7, 7))
  d$etq <- "Docentes"
  n_textos <- function(p) {
    capas <- Filter(function(l) inherits(l$geom, "GeomText") && is.data.frame(l$data) && ".lab" %in% names(l$data), p$layers)
    unlist(lapply(capas, function(l) l$data$.lab))
  }
  args <- list(data = d, var_categoria = "categoria", var_etiqueta_categoria = "etq", var_n = "N",
               cols_porcentaje = .bcr_cols, etiquetas_grupos = .bcr_cats, cols_n = stats::setNames(paste0("n_", 1:4), .bcr_cols),
               bases_publico = c(docentes = 30), usar_canvas = FALSE, exportar = "rplot")
  p_casos <- do.call(graficar_barras_apiladas, c(args, list(var_n_casos = "N_casos", cols_n_casos = .bcr_nc)))
  expect_false(any(grepl("^N = ", n_textos(p_casos))))           # 30 casos contra 30: no hay salto
  p_pond <- do.call(graficar_barras_apiladas, args)               # mutante: la N ponderada (20) contra 30 casos
  expect_true("N = 20" %in% n_textos(p_pond))
})

test_that("test 17 (D-a): la fila Total es opcional y apagada; una base pesa por ΣW, varias por casos", {
  expect_false(formals(graficar_barras_apiladas)$fila_total)
  expect_false(formals(preparar_escala)$fila_total)
  # A: 20 casos de peso 2.25 (ΣW 45), todos de acuerdo; B: 40 casos de peso 0.25 (ΣW 10), ninguno.
  d <- rbind(.bcr_fila("A", pct = c(0, 0, 0, 1), N = 45, nc = c(0, 0, 0, 20)),
             .bcr_fila("B", pct = c(1, 0, 0, 0), N = 10, nc = c(40, 0, 0, 0)))
  una <- .apiladas_fila_total(d, "categoria", "categoria", "N", .bcr_cols, .bcr_nc, var_n_casos = "N_casos")
  varias <- .apiladas_fila_total(d, "categoria", "categoria", "N", .bcr_cols, .bcr_nc, var_n_casos = "N_casos",
                                 varias_bases = TRUE)
  expect_identical(una$categoria[1], "Total")
  expect_equal(una$pct_4[1], 45 / 55)          # misma base: la distribución ponderada del conjunto
  expect_equal(varias$pct_4[1], 20 / 60)       # varias bases: cada fila pesa por sus casos
  expect_equal(una$N[1], 55); expect_equal(una$N_casos[1], 60); expect_equal(una$nc_1[1], 40)
  # Sin columna de casos la fila Total es la de siempre (ΣW).
  expect_equal(.apiladas_fila_total(d, "categoria", "categoria", "N", .bcr_cols)$pct_4[1], 45 / 55)
  # La especificación usa la misma regla: con la columna `.base` el graficador deduce «varias».
  d$.base <- c("docentes", "estudiantes")
  e <- .bcr_escala(d, var_n_casos = "N_casos", cols_n_casos = .bcr_nc, fila_total = TRUE, fila_total_bases = "varias")
  expect_true(e$filas$es_total[1])
  expect_equal(e$filas$n_casos[1], 60)
  expect_identical(unname(e$cifras[1, "pct_4"]), "33%")
  p <- graficar_barras_apiladas(d, "categoria", var_n = "N", cols_porcentaje = .bcr_cols, etiquetas_grupos = .bcr_cats,
                                var_n_casos = "N_casos", cols_n_casos = .bcr_nc, fila_total = TRUE,
                                usar_canvas = FALSE, exportar = "rplot")
  expect_identical(unname(attr(p, "pulso_espec")$cifras[1, "pct_4"]), "33%")
})

test_that("categóricas: el % sigue ponderado y la frecuencia escrita va en casos", {
  withr::local_options(prosecnur.casos_junto = list(cuando = "siempre"))
  d <- data.frame(categoria = c("Masculino", "Femenino"), n = c(74.25, 20), n_casos = c(33, 20),
                  pct = c(74.25, 20) / 94.25, stringsAsFactors = FALSE)
  p <- graficar_barras_categoricas(d, "categoria", var_valor = "pct", var_n = "n", var_pct = "pct", modo_valor = "valor",
                                   formato_valor = "porcentaje_n", var_n_casos = "n_casos")
  espec <- attr(p, "pulso_espec")
  expect_identical(espec$cifras[[1]], "79% (33)")   # «Casos junto al porcentaje» en «siempre»: % ponderado, casos sin ponderar
  expect_equal(espec$n, c(74.25, 20)); expect_equal(espec$n_casos, c(33, 20))
  expect_identical(.lam_dicotomia_datos(espec)$n, c(33, 20))   # «Masculino (33)»
  expect_true(any(grepl("(33)", attr(p, "pulso_barras_categoricas_data")$label, fixed = TRUE)))
  # Sin var_n_casos: la frecuencia es n, como siempre.
  p0 <- graficar_barras_categoricas(d, "categoria", var_valor = "pct", var_n = "n", var_pct = "pct", modo_valor = "valor",
                                    formato_valor = "porcentaje_n")
  expect_equal(attr(p0, "pulso_espec")$n_casos, c(74.25, 20))
})

test_that("pie: «x de y» y la lectura de la dona en casos; las porciones ponderadas", {
  d <- data.frame(opcion = c("Sí", "No"), n = c(45, 10), n_casos = c(20, 40), pct = c(45, 10) / 55, stringsAsFactors = FALSE)
  p <- graficar_pie(d, "opcion", "pct", var_n = "n", var_n_casos = "n_casos", tipo_pie = "pie")
  e <- attr(p, "pulso_espec")
  expect_identical(e$cifras, c("82%", "18%"))
  expect_equal(e$total_n, 55); expect_equal(e$total_n_casos, 60)
  expect_identical(.espec_casos(e), c(20, 40))
  expect_identical(.espec_total_casos(e), 60)
})

test_that("agrupadas de una serie: «N =» y la base del público en casos", {
  d <- data.frame(categoria = c("A", "B"), N = 55, N_casos = 60, pct = c(45, 10) / 55, n = c(45, 10), n_casos = c(20, 40),
                  stringsAsFactors = FALSE)
  p <- graficar_barras_agrupadas(d, "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Porcentaje"),
                                 cols_n = c(pct = "n"), var_n_casos = "N_casos", cols_n_casos = c(pct = "n_casos"))
  e <- attr(p, "pulso_espec")
  expect_identical(.espec_n_base(e), 60)
  expect_setequal(.espec_casos(e), c(20, 40))
  # La columna «N =» de la barra extra escribe los casos de la base (60), no la suma de pesos (55).
  p2 <- graficar_barras_agrupadas(d, "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Porcentaje"),
                                  cols_n = c(pct = "n"), var_n_casos = "N_casos", cols_n_casos = c(pct = "n_casos"),
                                  mostrar_barra_extra = TRUE, prefijo_barra_extra = "N = ")
  extra <- unlist(lapply(p2$layers, function(l) if (is.data.frame(l$data) && "lab_extra" %in% names(l$data)) l$data$lab_extra))
  expect_true(length(extra) > 0L)
  expect_true(all(extra == "N = 60"))
})

test_that("cifra: con peso el detalle dice la base en casos («Base: n respuestas»), no «Con el peso del estudio»", {
  d <- data.frame(p = c(rep("1", 12), rep("2", 8)), peso = c(rep(2.25, 12), rep(1, 8)), stringsAsFactors = FALSE)
  pc <- .cifra_desde_datos(d, "p", "porcentaje", categoria = "1", rotulo = "x")
  expect_identical(pc$detalle, "Base: 20 respuestas")
  expect_identical(pc$valor, "77%")   # 27 / 35: el porcentaje sigue ponderado
  d$num <- c(1:20)
  expect_identical(.cifra_desde_datos(d, "num", "media", rotulo = "x")$detalle, "Base: 20 respuestas")
  # Sin peso, «k de n» como siempre.
  d$peso <- NULL
  expect_identical(.cifra_desde_datos(d, "p", "porcentaje", categoria = "1", rotulo = "x")$detalle, "12 de 20")
})

# ---- ficha técnica, «Cómo leer» y avisos de export (S2/S4, D-b, D-c) --------------------------------------------

.bcr_pond <- function(n_eff = 22.6) {
  d <- data.frame(x = 1:4, peso = c(1, 2, 1, 1))
  attr(d, "ponderacion_estado") <- reporte_ponderacion_estado("aplicada", diagnostics = list(n = 4, n_eff = n_eff))
  d
}
.bcr_fallback <- function() {
  d <- data.frame(x = 1:4)
  attr(d, "ponderacion_estado") <- reporte_ponderacion_estado("no_aplicada", motivo = "x")
  d
}
.bcr_ficha <- function() data.frame(Campo = c("Universo", "Muestra"), Detalle = c("Egresados", "176"), stringsAsFactors = FALSE)

test_that("ficha PPT: la fila «Ponderación» con el texto S4; el texto del usuario manda; sin ponderación, intacta", {
  f <- .lam_ficha_con_ponderacion(.bcr_ficha(), list(default = .bcr_pond()))
  expect_identical(nrow(f), 3L)
  expect_identical(f$Campo[3], "Ponderación")
  expect_identical(f$Detalle[3], "Resultados ponderados (n efectivo = 23)")
  usuario <- rbind(.bcr_ficha(), data.frame(Campo = "Ponderacion", Detalle = "Raking por sexo y facultad."))
  expect_identical(.lam_ficha_con_ponderacion(usuario, list(default = .bcr_pond())), usuario)
  expect_identical(.lam_ficha_con_ponderacion(.bcr_ficha(), list(default = data.frame(x = 1))), .bcr_ficha())
  expect_null(.lam_ficha_con_ponderacion(NULL, list(default = .bcr_pond())))
  # Multibase: uno por base.
  fm <- .lam_ficha_con_ponderacion(.bcr_ficha(), list(docentes = .bcr_pond(10), estudiantes = .bcr_pond(150.4)))
  expect_identical(fm$Detalle[3], "docentes: Resultados ponderados (n efectivo = 10); estudiantes: Resultados ponderados (n efectivo = 150)")
})

test_that("D-b PPT: un mazo ponderado sin ficha técnica avisa al exportar; con ficha o sin peso, no", {
  plan_sin <- p_plan(slides = list(p_slide_1_grafico(grafico = p_barras_agrupadas("x"))))
  plan_con <- p_plan(slides = list(p_slide_tabla_tecnica("Ficha técnica", .bcr_ficha()),
                                   p_slide_1_grafico(grafico = p_barras_agrupadas("x"))))
  av <- graficos_avisos_ponderacion_mazo(plan_sin, list(default = .bcr_pond()))
  expect_length(av, 1L)
  expect_match(av, "está ponderado y no lo declara", fixed = TRUE)
  expect_match(av, "ficha técnica", fixed = TRUE)
  expect_identical(graficos_avisos_ponderacion_mazo(plan_con, list(default = .bcr_pond())), character(0))
  expect_identical(graficos_avisos_ponderacion_mazo(plan_sin, data.frame(x = 1)), character(0))
})

test_that("D-c: el fallback «ponderación configurada no aplicada» sube a advertencia de export", {
  plan <- p_plan(slides = list(p_slide_1_grafico(grafico = p_barras_agrupadas("x"))))
  av <- graficos_avisos_ponderacion_mazo(plan, list(docentes = .bcr_pond(), estudiantes = .bcr_fallback()))
  expect_identical(av[1], paste0("Base sin ponderar (ponderación configurada no aplicada) (estudiantes): ",
                                 "los porcentajes de esta base salen sin el peso del estudio."))
  expect_length(av, 2L)   # y docentes está ponderada sin ficha (D-b)
  w <- .word_ponderacion_de_corrida(list(default = .bcr_fallback()))
  expect_false(w$ponderada)
  expect_match(.word_avisos_ponderacion(w, list(), como_leer = FALSE), "^Base sin ponderar")
})

test_that("D-b Word: avisa si está ponderado sin «Cómo leer» ni ficha; «Cómo leer» o la ficha lo declaran", {
  w <- .word_ponderacion_de_corrida(.bcr_pond())
  expect_true(w$ponderada)
  expect_match(.word_avisos_ponderacion(w, list(), como_leer = FALSE), "Enciende «Cómo leer este informe»", fixed = TRUE)
  expect_identical(.word_avisos_ponderacion(w, list(), como_leer = TRUE), character(0))
  ficha <- list(list(kind = "technical_table", table = .lam_ficha_con_ponderacion(.bcr_ficha(), list(default = .bcr_pond()))))
  expect_identical(.word_avisos_ponderacion(w, ficha, como_leer = FALSE), character(0))
  expect_identical(.word_avisos_ponderacion(.word_ponderacion_de_corrida(data.frame(x = 1)), list(), como_leer = FALSE),
                   character(0))
  expect_identical(.word_avisos_ponderacion(NULL, list(), como_leer = FALSE), character(0))
})

test_that("«Cómo leer» del Word: con la corrida ponderada el recuadro lo declara; sin peso, el texto de siempre", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  texto_docx <- function(ponderada) {
    doc <- .word_como_leer(.word_documento_nuevo(), ponderada = ponderada)
    path <- withr::local_tempfile(fileext = ".docx", .local_envir = parent.frame())
    print(doc, target = path)
    gsub("<[^>]+>", "", .leer_parte_zip(path, "word/document.xml"))
  }
  frase <- "Los porcentajes están ponderados. La base de cada gráfico es el número de personas que respondieron, sin ponderar"
  expect_true(grepl(frase, texto_docx(TRUE), fixed = TRUE))
  sin <- texto_docx(FALSE)
  expect_false(grepl("ponderad", sin, fixed = TRUE))
  expect_true(grepl("Los porcentajes se calculan sobre quienes respondieron cada pregunta.", sin, fixed = TRUE))
})
