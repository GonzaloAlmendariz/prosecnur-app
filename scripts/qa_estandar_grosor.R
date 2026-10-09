# Banco de grosor (ADR 0092, F2): compara el grosor de barra que dibujan las apiladas con la tabla del estándar
# (`.std_grosor(n, "escala_apilada")`). Lee la traza que deja `.traza_grosor_apiladas()` cuando
# `options(pulso.traza_grosor = <archivo>)` está puesta durante un render.
# Uso (desde la raíz del repo):
#   Rscript scripts/qa_estandar_grosor.R <traza.csv>
# Para producir la traza con el mazo del catálogo:
#   MODE=deck Rscript -e 'options(pulso.traza_grosor = "<traza.csv>"); source("docs/qa/motor-ppt-2026-10-06/herramientas/catalogo_motor.R")'
suppressMessages(pkgload::load_all("api", quiet = TRUE))
args <- commandArgs(trailingOnly = TRUE)
if (!length(args)) stop("Uso: qa_estandar_grosor.R <traza.csv>")
t <- utils::read.csv(args[1], header = FALSE, col.names = c("filas", "filas_eje", "fraccion", "alto_fila_in", "grosor_in", "h_total_in", "alto_in"))
t$grosor_colocado_in <- round(t$grosor_in, 3)  # la traza ya mide la fila física colocada en la lámina
t$estandar_in <- vapply(t$filas, .std_grosor, numeric(1), tipo = "escala_apilada")
t$desvio_in <- round(t$grosor_colocado_in - t$estandar_in, 3)
t$conforme <- abs(t$desvio_in) <= 0.03
cat(sprintf("Gráficos apilados: %d · conformes (±0.03 in): %d (%.0f %%) · desvío absoluto mediano %.3f in\n",
            nrow(t), sum(t$conforme), 100 * mean(t$conforme), stats::median(abs(t$desvio_in))))
r <- aggregate(cbind(grosor_colocado_in, estandar_in, conforme) ~ pmin(filas, 10), data = t, FUN = function(v) round(stats::median(v), 3))
names(r)[1] <- "filas"
r$n <- as.vector(table(pmin(t$filas, 10))[as.character(r$filas)])
print(r, row.names = FALSE)
