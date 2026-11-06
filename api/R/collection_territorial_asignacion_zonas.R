# collection_territorial_asignacion_zonas.R — la asignación de un territorial por cuotas, cuando una zona
# la trabajan dos o más personas (ADR 0125 §2).
#
# Gonzalo (2 nov 2026): «Normalmente uno por zona, pero hay excepciones en las que sí hay más de uno, pero
# es una excepción». Lo normal sigue siendo una fila por zona, con toda su cuota. La excepción son varias
# filas con el mismo `id_zona`, cada una con su `parte` de la cuota. Si las partes no suman la cuota de la
# zona, se avisa (`cuadre`); no se rechaza, porque campo reparte sobre la marcha.

# La parte guardada de una fila: entero desde 1, o NA si no se declaró.
.mtaz_parte <- function(x) {
  n <- suppressWarnings(as.integer(.hojas_ruta_envio_chr(x)))
  if (length(n) != 1L || is.na(n) || n < 1L) NA_integer_ else n
}

# Filas de la asignación por zona. Con una sola persona y sin parte, la parte es la cuota entera.
.mtaz_filas <- function(unidades, guardadas) {
  out <- list()
  for (u in unidades) {
    suyas <- Filter(function(a) identical(a$id_manzana, u$unit_id), guardadas)
    for (a in suyas) {
      parte <- .mtaz_parte(a$parte)
      if (is.na(parte) && length(suyas) == 1L) parte <- u$n %||% NA_integer_
      out[[length(out) + 1L]] <- list(id_zona = u$unit_id, id_manzana = u$unit_id, label = u$label, role = "zona",
                                      codigo = a$codigo, origen = "explicita", parte = parte)
    }
  }
  out
}

# Por zona con dos o más personas: si sus partes suman la cuota de la zona.
.mtaz_cuadre <- function(unidades, filas) {
  out <- list()
  for (u in unidades) {
    suyas <- Filter(function(f) identical(f$id_zona, u$unit_id), filas)
    if (length(suyas) < 2L) next
    partes <- vapply(suyas, function(f) f$parte %||% NA_integer_, 1L)
    suma <- as.integer(sum(partes, na.rm = TRUE))
    out[[length(out) + 1L]] <- list(id_zona = u$unit_id, label = u$label, personas = length(suyas), cuota = u$n,
                                    suma = suma, sin_parte = as.integer(sum(is.na(partes))),
                                    cuadra = !anyNA(partes) && identical(suma, as.integer(u$n)))
  }
  out
}
