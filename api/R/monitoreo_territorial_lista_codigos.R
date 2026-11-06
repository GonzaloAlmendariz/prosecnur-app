# La lista de encuestadores respeta los códigos que trae el Excel (P4 del plan
# conjunto de Material, Monitoreo y Meta B, 2026-10-31).
#
# El defecto: al subir un Excel con P101–P104, la lista guardó P320, P270, P229
# y P220. `monitoreo_territorial_enumerator_roster_from_excel()` (monitoreo_engine.R,
# congelado) nunca lee la columna de código: con formato PXXX reutiliza el
# código anterior si el NOMBRE coincide y, si no, sortea uno nuevo. Para el
# equipo, que ya rotuló sus formularios y sus credenciales con esos códigos, eso
# es reescribirle la identidad.
#
# Regla nueva, por orden de prioridad:
#   1. El código del Excel, si es PXXX válido y no se repite dentro del Excel.
#   2. El código anterior de esa persona (por nombre), si no choca con 1.
#   3. Uno nuevo, sólo para los que faltan, sin chocar con ninguno de los anteriores.
# Con formato DNI no cambia nada: el código ES el DNI.
#
# Nada se descarta en silencio: la lista devuelve cuántos códigos vinieron del
# Excel, cuántos se generaron y cuáles del Excel no se pudieron respetar y por qué.

.MTLC_COLUMNAS_CODIGO <- c("codigo_pulso", "cod_pulso", "codigo", "cod", "codigo_encuestador", "code", "pulso")

# El código de cada fila del Excel, ya limpio; "" si la columna no existe.
.mtlc_codigos_del_excel <- function(path, code_var) {
  df <- .monitoreo_territorial_read_enumerator_table(path)
  claves <- vapply(names(df), .monitoreo_safe_name, character(1))
  candidatas <- unique(c(.monitoreo_safe_name(code_var %||% ""), .MTLC_COLUMNAS_CODIGO))
  idx <- match(candidatas, claves, nomatch = 0L)
  idx <- idx[idx > 0L][1]
  if (is.na(idx) || !length(idx)) return(rep("", nrow(df)))
  crudo <- trimws(as.character(df[[idx]]))
  crudo[is.na(crudo)] <- ""
  .monitoreo_territorial_clean_code(crudo, "PXXX")
}

#' Lista de encuestadores desde Excel, respetando los códigos PXXX que trae.
#'
#' Envuelve `monitoreo_territorial_enumerator_roster_from_excel()`: ésa lee
#' nombres y DNI y resuelve el código por nombre; aquí se impone después el
#' código del Excel cuando es válido y único, y se regeneran sólo los que
#' chocan. Mismos argumentos y misma forma de salida, más un recibo.
#' @export
monitoreo_territorial_enumerator_roster_desde_excel <- function(path,
                                                               previous = list(),
                                                               file_name = "",
                                                               source_file_id = "",
                                                               code_var = "codigo_pulso",
                                                               ump_var = "ump",
                                                               code_format = "PXXX") {
  roster <- monitoreo_territorial_enumerator_roster_from_excel(
    path, previous = previous, file_name = file_name, source_file_id = source_file_id,
    code_var = code_var, ump_var = ump_var, code_format = code_format
  )
  if (!identical(.monitoreo_territorial_code_format(code_format), "PXXX")) return(roster)
  asignaciones <- roster$assignments %||% list()
  if (!length(asignaciones)) return(roster)

  del_excel <- .mtlc_codigos_del_excel(path, code_var)
  fila <- vapply(asignaciones, function(a) as.integer(a$source_row %||% NA_integer_), integer(1))
  propuesto <- ifelse(!is.na(fila) & fila >= 1L & fila <= length(del_excel), del_excel[pmax(1L, fila)], "")
  valido <- .monitoreo_territorial_valid_code(propuesto, "PXXX")
  repetido <- propuesto %in% propuesto[valido][duplicated(propuesto[valido])]
  respeta <- valido & !repetido

  no_respetados <- list()
  for (i in which(nzchar(propuesto) & !respeta)) {
    no_respetados[[length(no_respetados) + 1L]] <- list(
      fila = fila[[i]], codigo = propuesto[[i]],
      motivo = if (!valido[[i]]) "no es un código PXXX válido" else "se repite en el Excel"
    )
  }

  codigos <- vapply(asignaciones, function(a) .monitoreo_scalar(a$codigo_pulso, ""), "")
  codigos[respeta] <- propuesto[respeta]
  # Los que no vinieron del Excel conservan su código (anterior o sorteado)
  # salvo que choque con uno del Excel: ésos, y sólo ésos, se sortean de nuevo.
  choca <- !respeta & (codigos %in% codigos[respeta] | duplicated(codigos))
  if (any(choca)) {
    codigos[choca] <- .monitoreo_territorial_generate_pulso_codes(sum(choca), used = codigos[!choca])
  }
  for (i in seq_along(asignaciones)) asignaciones[[i]]$codigo_pulso <- codigos[[i]]
  roster$assignments <- asignaciones
  roster$recibo_codigos <- list(
    del_excel = as.integer(sum(respeta)),
    sin_codigo_del_excel = as.integer(sum(!respeta)),
    no_respetados = no_respetados
  )
  roster
}
