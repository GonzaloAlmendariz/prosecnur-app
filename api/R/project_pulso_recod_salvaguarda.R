# Salvaguarda del reparador de `<parent>_recod`: no reescribir una data que
# perdió valores.
#
# `.pulso_repair_parent_recod_columns()` es la única ruta que reescribe EN SU
# LUGAR el archivo de datos del proyecto. Lee cada hoja tipada, añade/rellena
# las columnas `_recod` y escribe el libro entero. Si la lectura tipada perdió
# valores —readxl tipaba logical una columna vacía en sus primeras 1000 filas y
# convertía en NA todo lo posterior: los «Otro» de P11_otro/P27_otro en HSyVbG
# 2026— la reescritura hacía permanente la pérdida. `.read_excel_data` (io.R)
# corrige la causa; esto es la defensa en profundidad: antes de escribir se
# compara, por columna, cuántos valores no vacíos tiene la hoja releída como
# texto contra la versión que se va a escribir.
#
# Las columnas DESTINO del reparador (`<parent>_recod` de cada reparación) se
# excluyen: `.pulso_repair_parent_recod_df` las reconstruye y puede VACIAR a
# propósito celdas que ya tenían código —un texto «Otro» pendiente de
# recodificar deja NA donde había un 99; deshacer un grupo borra su código—.
# Contarlas como pérdida bloquearía justo la corrección y dejaría en la data
# códigos viejos que Analítica lee como reales. La salvaguarda protege todas
# las DEMÁS columnas, que el reparador no debe tocar nunca.

# Columnas que el reparador escribe deliberadamente, según su plan.
.pulso_recod_columnas_destino <- function(repairs) {
  parents <- vapply(repairs %||% list(), function(rep) {
    as.character(rep$parent %||% "")[1] %||% ""
  }, character(1))
  parents <- parents[!is.na(parents) & nzchar(parents)]
  if (!length(parents)) return(character(0))
  unique(paste0(parents, "_recod"))
}

# Conteo de no vacíos por columna (mismo criterio que `.pulso_blank_value`).
.pulso_recod_no_vacios <- function(df) {
  vapply(df, function(col) sum(!.pulso_blank_value(col)), integer(1))
}

# Columnas de cada hoja que perderían valores no vacíos al escribir
# `sheets_data` sobre `path`, sin contar las columnas de `excluir` (destinos
# del reparador). Devuelve una lista nombrada por hoja con los
# nombres de columna afectados (lista vacía si no se pierde nada). Si una hoja
# no se puede releer como texto, se reporta como `"<hoja ilegible>"`: sin
# referencia no se puede afirmar que la escritura es segura.
.pulso_recod_columnas_que_pierden <- function(path, sheets_data, excluir = character(0)) {
  out <- list()
  for (sheet in names(sheets_data)) {
    ref <- tryCatch(
      suppressWarnings(readxl::read_excel(path, sheet = sheet, col_types = "text")),
      error = function(e) NULL
    )
    if (is.null(ref)) {
      out[[sheet]] <- "<hoja ilegible>"
      next
    }
    ref <- ref[, setdiff(names(ref), excluir), drop = FALSE]
    antes <- .pulso_recod_no_vacios(ref)
    despues <- .pulso_recod_no_vacios(sheets_data[[sheet]])
    comunes <- intersect(names(antes), names(despues))
    # Una columna de la referencia que no llega a la escritura pierde TODO.
    faltan <- setdiff(names(antes)[antes > 0L], names(despues))
    pierden <- comunes[despues[comunes] < antes[comunes]]
    afectadas <- c(pierden, faltan)
    if (length(afectadas)) out[[sheet]] <- afectadas
  }
  out
}

# TRUE si es seguro escribir; si no, deja el aviso en stderr y devuelve FALSE.
.pulso_recod_escritura_segura <- function(path, sheets_data, excluir = character(0)) {
  pierden <- .pulso_recod_columnas_que_pierden(path, sheets_data, excluir = excluir)
  if (!length(pierden)) return(TRUE)
  detalle <- paste(
    vapply(names(pierden), function(h) {
      sprintf("%s: %s", h, paste(pierden[[h]], collapse = ", "))
    }, character(1)),
    collapse = "; "
  )
  message(sprintf(
    "[pulso-recod] NO se reescribe %s: la escritura perdería valores no vacíos en %s",
    basename(path), detalle
  ))
  FALSE
}
