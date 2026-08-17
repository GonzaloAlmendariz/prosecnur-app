# Publicacion de «Base de control», la tercera hoja del operativo de aulas.
#
# El lector existia desde el principio (`carga_base_control.R`) y dejaba las
# filas en `monitoreo_aulas_control`. Nadie las leia: ni el motor ni la UI.
# Medido el 2026-08-17 sobre las tres hojas — agendamiento 20 de 20 campos en el
# payload, parte de campo 10 de 11, control de calidad 0 de sus 25 campos
# propios. La cola daba L29 por ☑ «lector + endpoint»: se habia cerrado en el
# lector, no en la superficie. Una capacidad existe solo si alguien la consume.
#
# Que hace este modulo y que NO hace:
#
# - Publica los valores TAL COMO los trae la hoja. El Excel es quien calcula
#   —«VS POBLACION», «70P», «VALIDO TOTAL» son formulas del equipo— y recalcular
#   aqui crearia una segunda fuente de verdad para el mismo numero.
# - NO emite veredictos derivados de esos numeros. La escala de los porcentajes
#   y el codigo de «VALIDO TOTAL» no se pueden medir sin un libro real lleno, y
#   el unico que existe lleva datos personales de docentes: no entra al repo.
#   Clasificar a ojo seria inventar un dato, no leerlo.
# - SI dice, por aula y por grupo, si el grupo trae dato. Eso es lo que permite
#   a la vista distinguir «el aula pasa el control» de «esa columna esta vacia»,
#   que es la confusion que produce un cero mudo.

# Los seis grupos que la fila 1 de la hoja declara, con los campos de cada uno.
# El orden es el del libro: identidad, campo, y despues los cuatro controles.
MONITOREO_AULAS_CONTROL_GRUPOS <- list(
  list(
    clave = "curso",
    etiqueta = "Informacion del curso",
    campos = c("wave", "operational_code", "course_name", "room", "schedule",
               "enrolled_total", "eligible_n")
  ),
  list(
    clave = "campo",
    etiqueta = "Informacion del campo",
    campos = c("scheduled_date", "scheduled_time", "applied_by", "applied_date",
               "applied_time", "application_status")
  ),
  list(
    clave = "cuenta",
    etiqueta = "Control - cuenta",
    campos = c("sent_total", "sent_vs_total", "sent_vs_population",
               "validator_1", "validator_2", "validator_3",
               "short_total", "short_vs_total", "long_total", "long_vs_total",
               "threshold_total", "threshold_population",
               "valid_total", "valid_population")
  ),
  list(
    clave = "duracion",
    etiqueta = "Control - duracion",
    campos = c("last_response_day")
  ),
  list(
    clave = "cuotas",
    etiqueta = "Control - cuotas",
    campos = c("observed_students", "non_respondents", "attendance_pct",
               "quota_pct", "quota_missing",
               "women_n", "men_n", "women_pct", "men_pct")
  ),
  list(
    clave = "horario",
    etiqueta = "Control - rango horario",
    campos = c("schedule_norm", "schedule_range")
  )
)

# Un campo «trae dato» si no es NA ni cadena vacia. El lector ya convierte los
# guiones del equipo —«-», «N/A»— en vacio, asi que aqui no hay que repetirlo.
.mac_con_dato <- function(valor) {
  if (is.null(valor) || !length(valor)) return(FALSE)
  v <- valor[[1]]
  if (is.na(v)) return(FALSE)
  if (is.character(v)) return(nzchar(trimws(v)))
  TRUE
}

#' Filas de «Base de control» listas para publicar.
#'
#' @param control lista de filas del lector de la hoja.
#' @return lista de filas con sus campos y `grupos_con_dato`.
#' @export
monitoreo_aulas_control_publicado <- function(control = list()) {
  if (!length(control)) return(list())
  out <- list()
  for (fila in control) {
    if (!is.list(fila)) next
    llenos <- character(0)
    for (grupo in MONITOREO_AULAS_CONTROL_GRUPOS) {
      # Identidad y campo NO cuentan como control: siempre vienen llenos porque
      # los escribe el generador, y contarlos daria una cobertura falsa del
      # control de calidad, que es lo unico que esta hoja aporta de nuevo.
      if (grupo$clave %in% c("curso", "campo")) next
      hay <- any(vapply(grupo$campos, function(c) .mac_con_dato(fila[[c]]), logical(1)))
      if (hay) llenos <- c(llenos, grupo$clave)
    }
    fila$grupos_con_dato <- as.list(llenos)
    out[[length(out) + 1L]] <- fila
  }
  out
}

#' Cuanto del control de calidad trae realmente el libro.
#'
#' Sirve para que la vista pueda decir «esta hoja no trae cuotas» en vez de
#' pintar una tabla de ceros que parecerian medidos.
#'
#' @param control lista de filas del lector.
#' @return lista con `aulas` y `grupos` (clave, etiqueta, aulas con dato).
#' @export
monitoreo_aulas_control_resumen <- function(control = list()) {
  filas <- monitoreo_aulas_control_publicado(control)
  grupos <- lapply(MONITOREO_AULAS_CONTROL_GRUPOS, function(grupo) {
    if (grupo$clave %in% c("curso", "campo")) return(NULL)
    con <- sum(vapply(
      filas,
      function(f) grupo$clave %in% unlist(f$grupos_con_dato %||% list()),
      logical(1)
    ))
    list(
      clave = grupo$clave,
      etiqueta = grupo$etiqueta,
      campos = length(grupo$campos),
      aulas_con_dato = as.integer(con)
    )
  })
  list(
    aulas = length(filas),
    grupos = unname(Filter(Negate(is.null), grupos))
  )
}
