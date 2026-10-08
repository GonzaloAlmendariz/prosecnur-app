# Barrido de grosor (ADR 0092, F2): grafica una apilada Likert con 1 a 12 filas en la ranura de la lámina estándar
# (p_slide_1_grafico, 12.523 x 4.6 in) con el suelo de fábrica, y compara el grosor dibujado con `.std_grosor()`.
# Uso (desde la raíz del repo):  Rscript scripts/qa_estandar_grosor_barrido.R [salida.csv]
# Con GROSOR_ESTANDAR=0 mide el comportamiento previo (fracción de fila con piso y techo).
suppressMessages(pkgload::load_all("api", quiet = TRUE))
salida <- commandArgs(trailingOnly = TRUE)[1]
traza <- tempfile(fileext = ".csv"); options(pulso.traza_grosor = traza)
ranura <- .std_tipo_lamina("p_slide_1_grafico")$ranuras[[1]]
suelo <- utils::modifyList(.PRESETS_DEFAULT_PULSO$base, .PRESETS_DEFAULT_PULSO$barras_apiladas)
suelo <- suelo[intersect(names(suelo), names(formals(graficar_barras_apiladas)))]
set.seed(7)
for (n in 1:12) {
  p <- matrix(stats::runif(n * 5, 0.05, 1), n); p <- p / rowSums(p)
  d <- data.frame(categoria = sprintf("Afirmación %02d del bloque de prueba", seq_len(n)), N = 200L,
                  t1 = p[, 1], t2 = p[, 2], t3 = p[, 3], t4 = p[, 4], t5 = p[, 5], stringsAsFactors = FALSE)
  args <- utils::modifyList(suelo, list(
    data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = paste0("t", 1:5),
    etiquetas_grupos = c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "Sin información"),
    colores_grupos = .std_paleta("likert"), exportar = "rplot", usar_canvas = TRUE,
    ancho = ranura$w, alto = ranura$h, grosor_estandar = Sys.getenv("GROSOR_ESTANDAR", "1") != "0"))
  invisible(suppressMessages(suppressWarnings(do.call(graficar_barras_apiladas, args))))
}
t <- utils::read.csv(traza, header = FALSE, col.names = c("filas", "filas_eje", "fraccion", "alto_fila_in", "grosor_in", "h_total_in", "alto_in"))
t$grosor_colocado_in <- round(t$grosor_in, 3)  # la traza ya mide la fila física colocada en la lámina
t$estandar_in <- vapply(t$filas, .std_grosor, numeric(1), tipo = "escala_apilada")
t$desvio_in <- round(t$grosor_colocado_in - t$estandar_in, 3)
t$conforme <- abs(t$desvio_in) <= 0.03
print(t[, c("filas", "filas_eje", "fraccion", "alto_fila_in", "h_total_in", "grosor_colocado_in", "estandar_in", "desvio_in", "conforme")], row.names = FALSE)
cat(sprintf("Conformes (±0.03 in): %d de %d\n", sum(t$conforme), nrow(t)))
if (!is.na(salida)) utils::write.csv(t, salida, row.names = FALSE)
