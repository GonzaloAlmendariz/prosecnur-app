# Las dimensiones de Analítica llegan a Gráficos (checklist-catalogo-recetario-2026-10-14.md, H2).
#
# Analítica › Dimensiones guarda la base enriquecida en `s$rp_dim` —con las columnas `r100_*`, `sub_*`, `idx_*` y la
# trazabilidad de `reporte_dimensiones()` en sus atributos— y Gráficos leía las bases del estudio, que no las traen: los
# gráficos de dimensiones (`p_dim_*`) salían «Sin datos» en cualquier estudio. Aquí se unen a la base de la que salieron
# (`s$rp_dim_base`, que anota el build; si falta, la base activa), sólo si tienen las mismas filas: si no, se avisa y la
# base queda como está, en vez de pegar índices a personas que no son.

.DIM_ATRIBUTOS_EXCLUIDOS <- c("names", "row.names", "class")

#' Une las dimensiones de Analítica a la base de Gráficos de la que salieron
#' @param sid Sesión.
#' @param src `list(data_sources, inst_sources)` de `.graficos_processing_sources()`.
#' @return `src` con la base enriquecida, o intacto.
#' @keywords internal
.graficos_aplicar_dimensiones <- function(sid, src) {
  s <- session_get(sid, required = FALSE)
  dim <- s$rp_dim
  if (is.null(s) || !isTRUE(s$analitica_dim_ok) || !is.data.frame(dim) || !length(src$data_sources)) return(src)
  base <- as.character(s$rp_dim_base %||% estudio_active_base(sid) %||% names(src$data_sources)[1])[1]
  if (is.na(base) || !base %in% names(src$data_sources)) base <- names(src$data_sources)[1]
  d <- src$data_sources[[base]]
  if (!is.data.frame(d)) return(src)
  if (nrow(d) != nrow(dim)) {
    .pulso_aviso(sprintf("las dimensiones de Analítica no se usan en Gráficos: se construyeron sobre %d filas y la base «%s» tiene %d. Vuelve a generarlas en Analítica › Dimensiones.",
                         nrow(dim), base, nrow(d)))
    return(src)
  }
  cols <- grep("^(r100_|sub_|idx_)", names(dim), value = TRUE)
  for (cc in cols) d[[cc]] <- dim[[cc]]
  for (a in setdiff(names(attributes(dim)), .DIM_ATRIBUTOS_EXCLUIDOS)) attr(d, a) <- attr(dim, a, exact = TRUE)
  src$data_sources[[base]] <- d
  src
}
