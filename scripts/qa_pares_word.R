# Banco de pares Word recetario|motor (ADR 0093, N8.0): la conformidad se mira, no sólo se mide.
#
# Para cada fila del mapa pone la página del recetario Word a la izquierda y lo del motor a la derecha, a la misma
# escala física (una figura del motor a 6.27 in ocupa en el par lo mismo que el ancho de texto de la página A4).
#
# Uso (desde la raíz del repo):
#   Rscript scripts/qa_pares_word.R <mapa.csv> <carpeta_salida> [propuesta-word.docx]
#
# mapa.csv: columnas `pagina,motor[,nombre]`. `pagina` es la página del recetario (1 = portada). `motor` es un PNG
# de figura (de .word_png, a 300 dpi y 6.27 in) o `<archivo.docx>#<página>` para comparar página contra página.
# Requiere soffice, pdftoppm y magick en el PATH. Los PDF se cachean en <carpeta_salida> por mtime.
# OJO: LibreOffice no es Word (pagina distinto y no llena TOC ni SEQ); el par juzga el dibujo, no la paginación.

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) stop("Uso: qa_pares_word.R <mapa.csv> <carpeta_salida> [propuesta-word.docx]")
mapa <- utils::read.csv(args[[1]], stringsAsFactors = FALSE)
salida <- args[[2]]
recetario <- if (length(args) >= 3) args[[3]] else "docs/qa/motor-ppt-2026-10-06/4-recetario/propuesta-word.docx"
recetario <- normalizePath(recetario, mustWork = TRUE)
dir.create(salida, recursive = TRUE, showWarnings = FALSE)
salida <- normalizePath(salida)
stopifnot(all(c("pagina", "motor") %in% names(mapa)))
DPI <- 110

a_pdf <- function(docx, destino) {
  if (file.exists(destino) && file.mtime(destino) >= file.mtime(docx)) return(destino)
  tmp <- tempfile("pares_word_"); dir.create(tmp)
  file.copy(docx, file.path(tmp, "x.docx"))
  # Perfil propio: con el perfil del usuario ocupado (otra conversión, LibreOffice abierto) soffice sale sin error y sin PDF.
  perfil <- paste0("-env:UserInstallation=file://", file.path(tmp, "perfil"))
  system2("soffice", c(perfil, "--headless", "--convert-to", "pdf", "--outdir", tmp, file.path(tmp, "x.docx")), stdout = FALSE, stderr = FALSE)
  if (!file.exists(file.path(tmp, "x.pdf"))) stop("soffice no pudo convertir ", docx)
  file.copy(file.path(tmp, "x.pdf"), destino, overwrite = TRUE)
  destino
}
pagina <- function(pdf, n, destino) {
  system2("pdftoppm", c("-q", "-png", "-r", DPI, "-f", n, "-l", n, "-singlefile", pdf, sub("\\.png$", "", destino)))
  if (!file.exists(destino)) stop("pdftoppm no produjo la página ", n, " de ", pdf)
  destino
}

# system2 pasa los argumentos por el shell: sin shQuote, el «#» de un color abre un comentario y corta la orden.
magick <- function(...) {
  a <- c(...)
  if (system2("magick", shQuote(a)) != 0 || !file.exists(a[[length(a)]])) stop("magick no produjo ", a[[length(a)]])
}

pdf_receta <- a_pdf(recetario, file.path(salida, "recetario.pdf"))
ancho_texto <- round(6.27 * DPI)
for (i in seq_len(nrow(mapa))) {
  p <- mapa$pagina[[i]]
  m <- mapa$motor[[i]]
  nombre <- if ("nombre" %in% names(mapa) && nzchar(mapa$nombre[[i]])) mapa$nombre[[i]] else sprintf("fila%02d", i)
  izq <- pagina(pdf_receta, p, file.path(salida, sprintf("r%03d.png", p)))
  der <- file.path(salida, sprintf("m_%s.png", nombre))
  if (grepl("#[0-9]+$", m)) {
    docx <- normalizePath(sub("#[0-9]+$", "", m), mustWork = TRUE)
    pdf_m <- a_pdf(docx, file.path(salida, paste0(tools::file_path_sans_ext(basename(docx)), ".pdf")))
    pagina(pdf_m, as.integer(sub("^.*#", "", m)), der)
  } else {
    # Fondo blanco (el PNG es transparente) y marco rojo para que se vea dónde acaba la figura.
    magick(normalizePath(m, mustWork = TRUE), "-background", "white", "-flatten", "-resize", paste0(ancho_texto, "x"),
           "-bordercolor", "#D33", "-border", "2", der)
  }
  par <- file.path(salida, sprintf("par_p%03d_%s.png", p, nombre))
  magick(izq, der, "-background", "#EEEEEE", "-gravity", "north", "+append", par)
  cat(sprintf("%-40s página %3d | %s\n", basename(par), p, m))
}
