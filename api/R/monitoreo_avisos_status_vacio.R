# Filas del barrido con el Status vacío — aviso del barrido telefónico.
#
# Hallazgo de la revisión del barrido RMS (Meta B, 2026-10-31): 9 filas con el
# Status vacío. El motor no las saca del universo, pero las trata en silencio
# como «No barrido» (`.monitoreo_report_status_values` las vuelve «Sin status» y
# las máscaras de no barrido las incluyen) y por eso salen de la cola de
# insistencia. Además el aviso de Status desconocido las borra antes de mirar.
#
# La regla de la casa es que lo que se aparta del conteo se dice con su cifra y
# su causa. Este aviso NO cambia cómo se cuentan: dice lo que el motor hace de
# verdad. Si el vacío debe dejar de sumar como «No barrido» es una decisión de
# Gonzalo, porque cambia el Resumen y las cuotas.

.MONITOREO_AVISO_STATUS_COLUMNAS <- c("Status", "Estado", "estado", "Estatus", "estatus", "Estado campo",
                                      "Estado avance", "response_status", "status")

.monitoreo_aviso_status_vacio <- function(barrido) {
  if (!is.data.frame(barrido) || !nrow(barrido)) return(list())
  status <- .monitoreo_report_first_values(barrido, .MONITOREO_AVISO_STATUS_COLUMNAS)
  status <- trimws(as.character(status))
  vacias <- sum(is.na(status) | !nzchar(status))
  if (!vacias) return(list())
  list(.monitoreo_aviso_fila(
    "Media", "status_vacio_barrido",
    sprintf(
      "%d %s del barrido sin Status: se %s como «No barrido» y quedan fuera de la cola de insistencia. Completa el Status en la hoja.",
      vacias, if (vacias == 1L) "fila" else "filas", if (vacias == 1L) "cuenta" else "cuentan"
    )
  ))
}
