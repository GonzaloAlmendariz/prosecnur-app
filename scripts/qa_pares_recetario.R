# Banco de pares recetario|motor (ADR 0093): la conformidad se mira, no sólo se mide.
#
# Para cada fila del mapa compone la lámina del recetario a la izquierda y la del
# motor a la derecha en un PNG, y anota la fracción de píxeles distintos. La cifra
# acompaña; el veredicto sale de mirar los pares.
#
# Uso (desde la raíz del repo):
#   Rscript scripts/qa_pares_recetario.R <mazo_motor.pptx> <mapa.csv> <carpeta_salida> [recetario.pptx]
#
# mapa.csv: columnas `recetario,motor[,nombre]` con números de lámina (1 = primera).
# Requiere soffice, pdftoppm y magick en el PATH. El recetario se rasteriza una vez
# y se guarda en <carpeta_salida>/recetario.pdf.

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 3) stop("Uso: qa_pares_recetario.R <mazo_motor.pptx> <mapa.csv> <carpeta_salida> [recetario.pptx]")
mazo <- normalizePath(args[[1]], mustWork = TRUE)
mapa <- utils::read.csv(args[[2]], stringsAsFactors = FALSE)
salida <- args[[3]]
recetario <- if (length(args) >= 4) args[[4]] else "docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx"
recetario <- normalizePath(recetario, mustWork = TRUE)
dir.create(salida, recursive = TRUE, showWarnings = FALSE)
salida <- normalizePath(salida)
stopifnot(all(c("recetario", "motor") %in% names(mapa)))

a_pdf <- function(pptx, destino) {
  if (file.exists(destino) && file.mtime(destino) >= file.mtime(pptx)) return(destino)
  tmp <- tempfile("pares_"); dir.create(tmp)
  file.copy(pptx, file.path(tmp, "x.pptx"))
  system2("soffice", c("--headless", "--convert-to", "pdf", "--outdir", tmp, file.path(tmp, "x.pptx")), stdout = FALSE, stderr = FALSE)
  if (!file.exists(file.path(tmp, "x.pdf"))) stop("soffice no pudo convertir ", pptx)
  file.copy(file.path(tmp, "x.pdf"), destino, overwrite = TRUE)
  destino
}
pagina <- function(pdf, n, destino) {
  system2("pdftoppm", c("-q", "-png", "-r", "70", "-f", n, "-l", n, "-singlefile", pdf, sub("\\.png$", "", destino)))
  if (!file.exists(destino)) stop("pdftoppm no produjo la página ", n, " de ", pdf)
  destino
}

pdf_rec <- a_pdf(recetario, file.path(salida, "recetario.pdf"))
pdf_mot <- a_pdf(mazo, file.path(salida, "motor.pdf"))
filas <- vector("list", nrow(mapa))
for (i in seq_len(nrow(mapa))) {
  r <- mapa$recetario[[i]]; m <- mapa$motor[[i]]
  nombre <- if ("nombre" %in% names(mapa) && nzchar(mapa$nombre[[i]])) mapa$nombre[[i]] else sprintf("r%03d_m%03d", r, m)
  pr <- pagina(pdf_rec, r, file.path(salida, sprintf("_r%03d.png", r)))
  pm <- pagina(pdf_mot, m, file.path(salida, sprintf("_m%03d.png", m)))
  par <- file.path(salida, paste0("par_", nombre, ".png"))
  system2("magick", c(pr, pm, "+append", par))
  ae <- suppressWarnings(system2("magick", c("compare", "-metric", "AE", "-fuzz", "8%", pr, pm, "null:"), stdout = TRUE, stderr = TRUE))
  distintos <- suppressWarnings(as.numeric(sub("^([0-9.e+]+).*", "\\1", ae[[1]])))
  total <- as.numeric(system2("magick", c("identify", "-format", "%[fx:w*h]", pr), stdout = TRUE))
  filas[[i]] <- data.frame(nombre = nombre, recetario = r, motor = m, fraccion_distinta = round(distintos / total, 4), par = par)
  cat(sprintf("%-28s recetario %3d | motor %3d  píxeles distintos %5.1f %%\n", nombre, r, m, 100 * distintos / total))
}
out <- do.call(rbind, filas)
utils::write.csv(out, file.path(salida, "pares.csv"), row.names = FALSE)
cat("Pares en", salida, "\n")
