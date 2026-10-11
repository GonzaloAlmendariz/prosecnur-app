# Lee una parte de un zip (PPTX, DOCX, XLSX) como texto UTF-8.
#
# No usar `readLines(unz(zip, parte))`: en R 4.3.3, en modo texto, descarta la
# última línea si le falta el salto final, y officer escribe el XML de las
# láminas y documentos en UNA sola línea sin salto -> se leía "" y los
# `expect_no_match()` / `expect_false(grepl(...))` pasaban sobre texto vacío.
#
# Lectura binaria e independiente del lector de producto (`.pptx_leer_parte`)
# a propósito: si ese lector se rompe, los tests no deben quedar ciegos con él.
#
# `colapsar` conserva la semántica del viejo `paste(readLines(...), collapse =)`:
# las líneas se vuelven a unir con ese separador ("\n" por defecto).
.leer_parte_zip <- function(zip, parte, colapsar = "\n") {
  info <- utils::unzip(zip, list = TRUE)
  n <- info$Length[match(parte, info$Name)]
  if (is.na(n)) {
    stop(sprintf("La parte '%s' no está en %s.", parte, basename(zip)), call. = FALSE)
  }
  if (n == 0) return("")
  con <- unz(zip, parte, open = "rb")
  on.exit(close(con), add = TRUE)
  texto <- rawToChar(readBin(con, "raw", n = n))
  Encoding(texto) <- "UTF-8"
  lineas <- strsplit(gsub("\r\n", "\n", texto, fixed = TRUE), "\n", fixed = TRUE)[[1]]
  paste(lineas, collapse = colapsar)
}
