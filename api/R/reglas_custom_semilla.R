# =============================================================================
# Sembrado de criterios de revisión
# =============================================================================
# Las reglas de Validación se derivan del XLSForm: relevant → salto, required,
# constraint, calculate. Por eso solo encuentran lo que el instrumento previó.
# Los "Criterios de revisión" cubren el resto, pero exigen que alguien sepa que
# debe escribirlos: la capacidad existe y la cobertura no.
#
# Un sembrador mira la base y PROPONE criterios ya formados, listos para que el
# analista los revise. Nunca los persiste: devuelve candidatos.
#
# Regla de diseño: un sembrador no puede nombrar variables de un proyecto. Se
# apoya solo en (a) metadatos que la plataforma de recolección escribe siempre
# con el mismo nombre, y (b) lo que el estudio declara por rol. Mismo criterio
# que `.codif_key_candidates` para las llaves de caso.
# =============================================================================

# Columnas donde ODK/Kobo escriben la versión del formulario con que se
# recolectó cada envío. Son nombres de plataforma, no de estudio.
.semilla_version_candidatas <- c(
  "__version__", "_version", "__version", "_xform_id_string", "formhub/uuid"
)

# Columnas de marca temporal del envío, para desempatar cuál versión es la
# vigente cuando dos aparecen con la misma frecuencia.
.semilla_envio_candidatas <- c("_submission_time", "submission_time", "end")

.semilla_valores_utiles <- function(x) {
  v <- trimws(as.character(x))
  v[!is.na(v) & nzchar(v) & v != "NA"]
}

# Primera columna presente en `data` de una lista de candidatas.
.semilla_primera_columna <- function(data, candidatas) {
  for (nm in candidatas) if (nm %in% names(data)) return(nm)
  NA_character_
}

# ¿Ya hay un criterio que cubra esta variable con este tipo? Evita que cada
# carga vuelva a proponer lo mismo y que el analista acumule duplicados.
.semilla_ya_cubierta <- function(reglas, tipo, variable) {
  for (r in reglas %||% list()) {
    if (!identical(as.character(r$tipo %||% ""), tipo)) next
    vars <- as.character(unlist(r$variables %||% list()))
    if (variable %in% vars) return(TRUE)
  }
  FALSE
}

#' Proponer el criterio de procedencia del formulario
#'
#' Una base debería venir de una sola versión del formulario. Cuando trae más de
#' una, los casos de la versión no vigente pueden traer respuestas que la versión
#' corregida ya no permite — y las reglas derivadas del instrumento las leen
#' contra el formulario actual, así que las reportan como inconsistencias del
#' encuestado en vez de como lo que son: un artefacto de versión.
#'
#' Devuelve 0 o 1 candidato. Cero cuando la base no registra versión, cuando
#' trae una sola, o cuando ya existe un criterio sobre esa columna.
#'
#' @param data data.frame de la base cargada.
#' @param reglas_existentes lista de criterios ya definidos en el scope.
#' @return lista de candidatos; cada uno es una regla lista para `POST
#'   /api/validacion/v2/reglas_custom` más un bloque `semilla` con el porqué.
#' @family validacion
#' @export
reglas_semilla_procedencia <- function(data, reglas_existentes = list()) {
  if (!is.data.frame(data) || !nrow(data)) return(list())

  col <- .semilla_primera_columna(data, .semilla_version_candidatas)
  if (is.na(col)) return(list())

  vals <- .semilla_valores_utiles(data[[col]])
  if (!length(vals)) return(list())

  frec <- sort(table(vals), decreasing = TRUE)
  if (length(frec) < 2L) return(list())          # una sola versión: nada que proponer
  if (.semilla_ya_cubierta(reglas_existentes, "fuera_catalogo", col)) return(list())

  # La vigente es la mayoritaria. En empate manda la del envío más reciente:
  # una versión se publica y a partir de ahí se usa, así que la última en
  # llegar es la que está vigente.
  top <- names(frec)[frec == max(frec)]
  vigente <- top[1]
  if (length(top) > 1L) {
    col_envio <- .semilla_primera_columna(data, .semilla_envio_candidatas)
    if (!is.na(col_envio)) {
      # Las marcas de ODK/Kobo son ISO 8601, así que el orden lexicográfico es
      # el cronológico. Se compara como texto a propósito: parsear fechas acá
      # obligaría a adivinar zona horaria y formato por plataforma.
      envio <- trimws(as.character(data[[col_envio]]))
      envio[is.na(envio)] <- ""
      ultimo <- which(envio == max(envio))[1]
      if (!is.na(ultimo)) {
        cand <- trimws(as.character(data[[col]][ultimo]))
        if (length(cand) == 1L && !is.na(cand) && cand %in% top) vigente <- cand
      }
    }
  }

  otras <- setdiff(names(frec), vigente)
  n_otras <- sum(as.integer(frec[otras]))

  list(list(
    tipo = "fuera_catalogo",
    variables = list(col),
    params = list(valores = list(vigente)),
    nombre = "Procedencia · la base trae más de una versión del formulario",
    mensaje = sprintf(
      "Recolectado con una versión distinta de la vigente (%s). Sus respuestas siguen las reglas del formulario anterior.",
      vigente
    ),
    severidad = "advertencia",
    activa = TRUE,
    planned_action_type = "ignore_rule",
    semilla = list(
      origen = "procedencia",
      columna = col,
      version_vigente = vigente,
      versiones = as.list(stats::setNames(as.integer(frec), names(frec))),
      n_casos_afectados = n_otras,
      porque = sprintf(
        paste("La base tiene %d versiones del formulario: %d de %d casos no vienen de la vigente.",
              "Sus saltos y catálogos eran otros, así que lo que las reglas del instrumento",
              "reporten sobre ellos puede ser un artefacto de versión y no un error del encuestado."),
        length(frec), n_otras, length(vals)
      )
    )
  ))
}

#' Reunir todos los criterios propuestos para una base
#'
#' Punto único de entrada del sembrado. Hoy solo procedencia; los demás
#' sembradores se enchufan aquí a medida que existen.
#'
#' @param data data.frame de la base cargada.
#' @param reglas_existentes lista de criterios ya definidos en el scope.
#' @return lista de candidatos.
#' @family validacion
#' @export
reglas_semilla_todas <- function(data, reglas_existentes = list()) {
  c(reglas_semilla_procedencia(data, reglas_existentes))
}
