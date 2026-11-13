# Candidatas de los roles del caso por el contenido de cada columna.
#
# Ítem 24 del checklist de validación del practicante: "Quién recolectó"
# proponía `fecha_entrevista` porque su nombre contiene "entrevista", y la
# identidad proponía el nombre de la persona encuestada. Aquí cada rol se
# propone por lo que la columna trae:
#
#   llave (número de encuesta o código de caso)  un valor distinto en casi
#             cada fila; no es una fecha ni un dato personal.
#   agente (quién recolectó)  texto con pocos valores distintos que se repiten
#             entre casos; no es una fecha. Una columna de solo números (edad,
#             códigos de respuesta) no pasa, salvo que su nombre diga que es el
#             equipo de campo: el nombre solo desempata, nunca admite una
#             columna cuyo contenido no calza.
#   fecha     se lee como fecha con la misma lectura que la regla "Fecha fuera
#             del operativo" (`.regla_fechas_medir()`, validacion_regla_fechas.R),
#             que entiende "08.10.2026", "08/10/26" y "2026-10-08".
#
# Base de cada cifra de la causa: las filas de la base cargada (`n`) o las que
# tienen dato en esa columna, según se dice en el texto. Grano: fila.

.ROLES_COBERTURA_MINIMA <- 0.8
.ROLES_FECHA_MINIMA <- 0.9
.ROLES_LLAVE_RATIO <- 0.9
.ROLES_AGENTE_MAX_DISTINTOS <- 50L

# Fecha leída de cada valor (Date o NA) y su formato, con la lectura de las
# reglas de fechas en "auto".
.roles_leer_fecha <- function(x) {
  med <- .regla_fechas_medir(list(list(x), "una", "auto", character(0), character(0)), list(),
                             "fecha", "rango", NA, NA, TRUE, NA, NA, FALSE, "America/Lima")
  list(fecha = as.Date(med$a_num, origin = "1970-01-01"), estado = med$a_estado, formato = med$a_formato)
}

# Proporción de valores con forma de nombre de persona: letras y espacios, sin
# dígitos. Separa la columna del equipo de una pregunta con pocas respuestas.
.roles_parece_nombre <- function(u) {
  if (!length(u)) return(0)
  mean(grepl("^[[:alpha:]][[:alpha:][:space:].'-]+[[:space:]][[:alpha:].'-]+$", u))
}

.roles_solo_numeros <- function(u) {
  !length(u) || all(grepl("^-?[0-9]+([.,][0-9]+)?$", u))
}

.roles_nombre_de_equipo <- function(nm) {
  grepl("encuest|entrevist|enumer|agente|operador|interviewer|username|submitted_by|supervis|aplicador|recopilador",
        tolower(nm))
}

# Perfil de una columna: lo que se mide de su contenido.
.roles_perfil <- function(nm, x, n) {
  v <- .semilla_valores_utiles(x)
  u <- unique(v)
  # Se lee cada valor distinto una vez, y solo los que tienen forma de fecha
  # (dígitos con separador); el conteo vuelve a las filas con `match()`.
  forma <- u[grepl("[0-9][./-][0-9]", u)]
  lectura_u <- if (length(forma)) .roles_leer_fecha(forma) else list(fecha = as.Date(character(0)), formato = character(0))
  i <- match(v, forma)
  lectura <- list(fecha = lectura_u$fecha[i], formato = lectura_u$formato[i])
  leidas <- !is.na(lectura$fecha)
  formatos <- sort(table(lectura$formato[leidas]), decreasing = TRUE)
  list(
    nombre = nm,
    n_con_dato = length(v),
    cobertura = length(v) / max(n, 1L),
    distintos = length(u),
    ratio = length(u) / max(n, 1L),
    nominal = .roles_parece_nombre(u),
    solo_numeros = .roles_solo_numeros(u),
    nombre_de_equipo = .roles_nombre_de_equipo(nm),
    n_fechas = sum(leidas),
    dias = length(unique(lectura$fecha[leidas])),
    formato_fecha = if (length(formatos)) names(formatos)[1] else NA_character_,
    personal = if (length(v) >= .RECON_PERSONAL_MIN_VALORES) .recon_personal_por_contenido(v) else NULL,
    largo_medio = if (length(v)) mean(nchar(v)) else 0
  )
}

.roles_es_fecha <- function(p) p$n_con_dato > 0L && p$n_fechas / p$n_con_dato >= .ROLES_FECHA_MINIMA

.roles_causa_llave <- function(p, n) {
  if (p$distintos == n) return(sprintf("Un valor distinto en cada uno de los %d casos.", n))
  sprintf("%d valores distintos en %d casos: identifica casi uno a uno (%d casos sin dato o repetidos).",
          p$distintos, n, n - p$distintos)
}

.roles_causa_agente <- function(p) {
  por_valor <- round(p$n_con_dato / max(p$distintos, 1L))
  if (p$solo_numeros) {
    return(sprintf("%d códigos que se repiten entre casos (unos %d casos por código); el nombre de la columna indica el equipo de campo.",
                   p$distintos, por_valor))
  }
  if (p$nominal >= 0.5) {
    return(sprintf("%d valores con forma de nombre de persona que se repiten entre casos (unos %d casos por valor).",
                   p$distintos, por_valor))
  }
  sprintf("%d valores de texto que se repiten entre casos (unos %d casos por valor).", p$distintos, por_valor)
}

.roles_causa_fecha <- function(p) {
  sprintf("Se lee como fecha en %d de %d casos con dato (%s), con %d días distintos.",
          p$n_fechas, p$n_con_dato, p$formato_fecha, p$dias)
}

#' Candidatas de los roles del caso por contenido
#'
#' @param data data.frame de la base cargada.
#' @param max_por_rol cuántas candidatas devolver por rol.
#' @return lista con `llaves`, `agentes` y `fechas`; cada candidata con
#'   `variable`, `distintos`, `cobertura` y `porque` (su causa).
#' @keywords internal
.roles_candidatas_por_contenido <- function(data, max_por_rol = 3L) {
  vacio <- list(llaves = list(), agentes = list(), fechas = list())
  if (!is.data.frame(data) || !nrow(data) || !ncol(data)) return(vacio)
  n <- nrow(data)
  perfil <- lapply(names(data), function(nm) .roles_perfil(nm, data[[nm]], n))
  perfil <- Filter(function(p) p$cobertura >= .ROLES_COBERTURA_MINIMA && p$distintos > 1L, perfil)
  num <- function(lista, campo) vapply(lista, function(p) as.numeric(p[[campo]]), numeric(1))

  fechas <- Filter(function(p) .roles_es_fecha(p) && p$dias >= 2L, perfil)
  fechas <- fechas[order(-num(fechas, "n_fechas"))]

  # Una llave no es una fecha (una marca de tiempo es única por fila y no
  # identifica a nadie) ni un dato personal (nombre, teléfono, DNI, correo).
  llaves <- Filter(function(p) p$ratio >= .ROLES_LLAVE_RATIO && !.roles_es_fecha(p) &&
                                 is.null(p$personal), perfil)
  llaves <- llaves[order(-num(llaves, "ratio"), num(llaves, "largo_medio"))]

  agentes <- Filter(function(p) p$distintos <= .ROLES_AGENTE_MAX_DISTINTOS && p$ratio < 0.5 &&
                                  !.roles_es_fecha(p) && (!p$solo_numeros || p$nombre_de_equipo), perfil)
  # Primero lo que parece nombre de persona; entre iguales, el nombre de la
  # columna y luego más valores: un equipo de campo tiene varias personas.
  agentes <- agentes[order(-num(agentes, "nominal"), -num(agentes, "nombre_de_equipo"),
                           -num(agentes, "distintos"))]

  fmt <- function(p, causa) list(variable = p$nombre, distintos = as.integer(p$distintos),
                                 cobertura = round(p$cobertura, 3), porque = causa)
  list(
    llaves = lapply(utils::head(llaves, max_por_rol), function(p) fmt(p, .roles_causa_llave(p, n))),
    agentes = lapply(utils::head(agentes, max_por_rol), function(p) fmt(p, .roles_causa_agente(p))),
    fechas = lapply(utils::head(fechas, max_por_rol), function(p) fmt(p, .roles_causa_fecha(p)))
  )
}
