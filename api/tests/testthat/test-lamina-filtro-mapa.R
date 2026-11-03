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
  expect_true(all(c("llave", "mapa:tarjeta", "mapa:ranking_tarjeta", "prosecnur:grafico:mapa") %in% nombres))
  expect_true("Sólo los 40 cuya familia vive en otra región del Perú" %in% textos, info = paste(textos, collapse = " | "))
  expect_true("Región Lima" %in% textos)   # M11: «Lima» de la lista de departamentos
  pie <- xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='Base lamina']]"))
  expect_identical(pie, "Base: 120 estudiantes. Sólo los 40 cuya familia vive en otra región del Perú. Fuente: PULSO PUCP 2026.")
})

test_that("sólo el mapa de distribución pide la lámina del filtro con mapa", {
  expect_true(.lam_filtro_sub_es_mapa(list(tipo = "mapa", forma = "distribucion")))
  expect_false(.lam_filtro_sub_es_mapa(list(tipo = "mapa", forma = "resultado")))
  expect_false(.lam_filtro_sub_es_mapa(list(tipo = "categorica")))
  expect_false(.lam_filtro_sub_es_mapa(NULL))
})
