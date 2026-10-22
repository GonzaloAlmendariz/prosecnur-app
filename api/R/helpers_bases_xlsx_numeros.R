# helpers_bases_xlsx_numeros.R — en el Excel de bases un número va como número
# ============================================================================
#
# HSyVbG 2026 (2026-10-22): la hoja de códigos guardaba la edad y los códigos como
# texto («21», «2»), con el triángulo verde de Excel y sin poder sumar ni filtrar
# por rango. Una columna de texto pasa a numérica sólo si TODOS sus valores con
# dato son números decimales simples sin cero a la izquierda (un «007» o un
# identificador largo siguen siendo texto).

.bases_xlsx_es_numero_plano <- function(x) {
  grepl("^-?(0|[1-9][0-9]{0,14})(\\.[0-9]+)?$", x)
}

.bases_xlsx_numeros <- function(data) {
  for (v in names(data)) {
    x <- data[[v]]
    if (!is.character(x)) next
    con_dato <- !is.na(x) & nzchar(trimws(x))
    if (!any(con_dato) || !all(.bases_xlsx_es_numero_plano(trimws(x[con_dato])))) next
    num <- rep(NA_real_, length(x))
    num[con_dato] <- as.numeric(trimws(x[con_dato]))
    data[[v]] <- num
  }
  data
}
