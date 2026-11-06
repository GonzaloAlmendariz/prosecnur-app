# El filtro con su mapa dependiente en una sola lámina (Gonzalo, 2026-11-03): el filtro en barras con su llave a la
# izquierda y, a la derecha, el enunciado de la subpregunta con su base y el mapa con su leyenda y su ranking. Antes iban
# dos láminas y el ranking del mapa repetía las barras de la subpregunta. Fixture sintético; la dependencia se declara
# como en el editor (`p_slide_2_graficos` con `meta$dependencia`).

.fm_fx <- function() {
  deps <- c("Áncash", "Callao", "Cusco", "Junín", "Lima", "Loreto")
  donde <- c(rep("1", 70), rep("2", 10), rep("3", 40))   # 3 = en otra región
  reg <- c(rep(NA, 80), as.character(match(c(rep("Junín", 15), rep("Cusco", 12), rep("Áncash", 10), rep("Lima", 3)), deps)))
  inst <- list(survey = data.frame(name = c("donde", "reg"), type = c("select_one ld", "select_one lr"), list_name = c("ld", "lr"),
                                   label = c("¿Dónde vive tu familia?", "¿En qué otra región del Perú?"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c(rep("ld", 3), rep("lr", length(deps))), name = c("1", "2", "3", seq_along(deps)),
                                    label = c("En Lima Metropolitana", "En otra provincia de Lima", "En otra región del Perú", deps),
                                    stringsAsFactors = FALSE), orders_list = NULL)
  inst$orders_list <- .amb_orders_list(inst)
  list(df = data.frame(donde = donde, reg = reg, stringsAsFactors = FALSE), inst = inst)
}

test_that("el filtro y su mapa salen en una lámina: llave, base de la subpregunta, mapa y ranking", {
  skip_if_not_installed("officer")
  fx <- .fm_fx()
  s <- .dependencia_como_lamina(list(tipo = "p_slide_2_graficos", payload = list(
    titulo = "¿Dónde vive tu familia?", base = "Base: 120 estudiantes. Fuente: PULSO PUCP 2026.",
    izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "donde")),
    derecha = list(graficador = "p_mapa_distribucion", args = list(var = "reg", area = "peru", encuadre = "datos")),
    meta = list(dependencia = list(de = "izquierda", habilita = list("3"), frase = "cuya familia vive en otra región del Perú")))))
  expect_identical(s$payload$grafico$graficador, "p_filtro_subpregunta")
  el <- .graficos_rebuild_graf_json(s$payload$grafico)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$df, instrumento = fx$inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = list(a = p_slide_1_grafico(el, titulo = s$payload$titulo, base = s$payload$base)))))
  expect_length(officer::read_pptx(out), 1L)
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  nombres <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
  textos <- xml2::xml_text(xml2::xml_find_all(x, "//a:t"))
  expect_true(all(c("filtro:tarjeta", "filtro:barra", "mapa:tarjeta", "mapa:barra", "prosecnur:grafico:mapa") %in% nombres))
  expect_false("llave" %in% nombres)   # V4: sin llave, sin letras, sin avisos
  expect_true("40 (33%)" %in% textos, info = paste(textos, collapse = " | "))
  expect_true("Lima (departamento)" %in% textos)
  pie <- xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='Base lamina']]"))
  expect_identical(pie, "Base: 120 estudiantes. Fuente: PULSO PUCP 2026.")   # las bases al pie, como las escribe el plan
})

test_that("sólo el mapa de distribución pide la lámina del filtro con mapa", {
  expect_true(.lam_filtro_sub_es_mapa(list(tipo = "mapa", forma = "distribucion")))
  expect_false(.lam_filtro_sub_es_mapa(list(tipo = "mapa", forma = "resultado")))
  expect_false(.lam_filtro_sub_es_mapa(list(tipo = "categorica")))
  expect_false(.lam_filtro_sub_es_mapa(NULL))
})

test_that("un filtro con dos mapas (tres ranuras): dos tarjetas de mapa y cada una con la base de lo que la habilita", {
  skip_if_not_installed("officer")
  fx <- .fm_fx()
  s <- .dependencia_como_lamina(list(tipo = "p_slide_3_graficos_fila", payload = list(
    titulo = "¿Dónde vive tu familia?", base = "Base: 120 estudiantes. Mapas: 80 y 40. Fuente: PULSO PUCP 2026.",
    izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "donde")),
    centro = list(graficador = "p_mapa_distribucion", args = list(var = "reg", area = "peru", titulo = "Mapa A")),
    derecha = list(graficador = "p_mapa_distribucion", args = list(var = "reg", area = "peru", titulo = "Mapa B")),
    meta = list(dependencia = list(de = "izquierda", habilita = list(centro = list("1", "2"), derecha = list("3")))))))
  expect_identical(s$payload$grafico$graficador, "p_filtro_subpregunta")
  expect_false(is.null(s$payload$grafico$args$dependiente2))
  el <- .graficos_rebuild_graf_json(s$payload$grafico)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$df, instrumento = fx$inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = list(a = p_slide_1_grafico(el, titulo = s$payload$titulo, base = s$payload$base)))))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  nombres <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
  expect_identical(sum(nombres == "mapa:tarjeta"), 2L)
  textos <- xml2::xml_text(xml2::xml_find_all(x, "//a:t"))
  expect_true(all(c("Mapa A", "Mapa B") %in% textos))
  # El mapa A sólo tiene a quienes respondieron 1 o 2, que no contestan la región: su tarjeta sale vacía y lo dice. El B
  # tiene a los 40 de otra región (Junín 15 de 40).
  expect_true("Ningún área tiene encuestados." %in% textos, info = paste(textos, collapse = " | "))
  expect_true("15 (38%)" %in% textos)
})

test_that("el dependiente de otra base (la repetición de crianza) no se filtra por la pregunta del filtro", {
  expect_true(.fsub_dependiente_de_otra_base("datos_crianza$A9_1", "A9"))
  expect_false(.fsub_dependiente_de_otra_base("A8_3", "A8"))
  expect_false(.fsub_dependiente_de_otra_base("default$A8_3", "default$A8"))
})
