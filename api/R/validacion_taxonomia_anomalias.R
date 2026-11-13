# =============================================================================
# Taxonomía de anomalías de Validación
# =============================================================================
# Hasta acá todo lo que encontraba Validación caía en un solo saco llamado
# "inconsistencia", y por eso un dato imposible pesaba lo mismo que un caso
# recolectado con otro formulario. Son cosas distintas y se resuelven distinto:
# unas se corrigen en Limpieza, otra se corrige hablando con campo.
#
# Cuatro tipos, acordados con el equipo (2026-08-12):
#
#   contradiccion  dos datos que no pueden coexistir. Se ve mirando OTRO dato.
#   valor_invalido un valor inválido en sí mismo. Se ve mirando su catálogo.
#   faltante       debía responderse y no está.
#   procedencia    de dónde salió el caso: con qué formulario, cuándo, si llegó
#                  completo. No es un error del encuestado.
#
# Regla de la casa: las tres primeras se corrigen en el dato; procedencia se
# confirma con campo. Por eso `procedencia` no propone acción de limpieza.
#
# Lo que NO está acá: duración de entrevista, entrevistas simultáneas, nombres
# del encuestador. Eso es comportamiento del equipo y su módulo es Monitoreo
# (recorte de alcance del 2026-08-12).
# =============================================================================

.VALIDACION_ANOMALIAS <- list(
  contradiccion = list(
    slug = "contradiccion",
    etiqueta = "Contradicción",
    descripcion = "Dos datos del mismo caso no pueden ser ciertos a la vez.",
    corrige = "dato",
    orden = 1L
  ),
  valor_invalido = list(
    slug = "valor_invalido",
    etiqueta = "Valor inválido",
    descripcion = "El valor está fuera de lo que admite su pregunta: opciones, rango o restricción.",
    corrige = "dato",
    orden = 2L
  ),
  faltante = list(
    slug = "faltante",
    etiqueta = "Faltante indebido",
    descripcion = "La pregunta debía responderse y quedó vacía.",
    corrige = "dato",
    orden = 3L
  ),
  procedencia = list(
    slug = "procedencia",
    etiqueta = "Anomalía de procedencia",
    descripcion = "El caso no se recolectó como el estudio declaró: otra versión del formulario, fuera del periodo de campo, o un envío que no llegó.",
    corrige = "campo",
    orden = 4L
  )
)

#' Catálogo de tipos de anomalía
#'
#' Lo consume la UI para rotular y ordenar. Se expone entero en vez de dejar que
#' cada superficie invente sus propias etiquetas.
#'
#' @return lista de tipos con slug, etiqueta, descripción y qué se corrige.
#' @family validacion
#' @export
validacion_anomalias_catalogo <- function() {
  unname(.VALIDACION_ANOMALIAS[order(vapply(.VALIDACION_ANOMALIAS,
                                            function(x) x$orden, integer(1)))])
}

# Sembradores → tipo. El sembrador sabe qué está midiendo mejor que nadie, así
# que su `semilla$origen` manda sobre cualquier heurística.
.VALIDACION_ANOMALIA_POR_SEMILLA <- c(
  procedencia  = "procedencia",   # más de una versión del formulario
  continuidad  = "procedencia",   # envíos que el servidor numeró y no llegaron
  periodo      = "procedencia",   # recolectado fuera de la ventana de campo
  dominio      = "valor_invalido" # valor que su lista no contiene
)

# Reglas derivadas del XLSForm → tipo. `skip` es el salto violado: la respuesta
# contradice al dato que gobierna su relevancia. `required` es el faltante.
# `constraint` declara un dominio a mano, así que es valor inválido.
.VALIDACION_ANOMALIA_POR_TIPO_REGLA <- c(
  skip             = "contradiccion",
  required         = "faltante",
  constraint       = "valor_invalido",
  calculate_check  = "contradiccion",
  coherencia_2v    = "contradiccion",
  no_nulo          = "faltante",
  fuera_catalogo   = "valor_invalido",
  rango_num        = "valor_invalido",
  rango_fecha      = "valor_invalido",
  comparar_fechas  = "contradiccion",
  formato          = "valor_invalido",
  combinacion_catalogo = "valor_invalido",
  continuidad_secuencia = "procedencia"
)

#' Clasificar una anomalía
#'
#' Resuelve en tres pasos, del más específico al más general: lo que la regla
#' declaró explícitamente, lo que su sembrador sabe que mide, y por último el
#' tipo de regla. Sin ninguno de los tres devuelve `NA`, que la UI muestra como
#' "sin clasificar" — nunca inventa un tipo.
#'
#' @param tipo_regla tipo de la regla (`skip`, `required`, `fuera_catalogo`…).
#' @param origen_semilla `semilla$origen` cuando la regla nació de un sembrador.
#' @param declarado tipo declarado explícitamente en la regla, si lo hay.
#' @return slug del tipo, o `NA_character_`.
#' @family validacion
#' @export
validacion_anomalia_tipo <- function(tipo_regla = NULL,
                                     origen_semilla = NULL,
                                     declarado = NULL) {
  d <- as.character(declarado %||% "")[1]
  if (!is.na(d) && nzchar(d) && d %in% names(.VALIDACION_ANOMALIAS)) return(d)

  o <- as.character(origen_semilla %||% "")[1]
  if (!is.na(o) && nzchar(o) && o %in% names(.VALIDACION_ANOMALIA_POR_SEMILLA)) {
    return(unname(.VALIDACION_ANOMALIA_POR_SEMILLA[[o]]))
  }

  t <- as.character(tipo_regla %||% "")[1]
  if (!is.na(t) && nzchar(t) && t %in% names(.VALIDACION_ANOMALIA_POR_TIPO_REGLA)) {
    return(unname(.VALIDACION_ANOMALIA_POR_TIPO_REGLA[[t]]))
  }
  NA_character_
}

#' Etiqueta humana de un tipo de anomalía
#'
#' @param slug slug del tipo.
#' @return etiqueta, o "Sin clasificar" si el slug no existe.
#' @family validacion
#' @export
validacion_anomalia_etiqueta <- function(slug) {
  s <- as.character(slug %||% "")[1]
  if (is.na(s) || !nzchar(s) || !(s %in% names(.VALIDACION_ANOMALIAS))) {
    return("Sin clasificar")
  }
  .VALIDACION_ANOMALIAS[[s]]$etiqueta
}

#' ¿Este tipo se corrige tocando el dato?
#'
#' Procedencia no: un caso recolectado con otro formulario no se arregla
#' editándolo. Lo consume Limpieza para no ofrecer una acción que no aplica.
#'
#' @param slug slug del tipo.
#' @return TRUE si se corrige en el dato.
#' @family validacion
#' @export
validacion_anomalia_corrige_dato <- function(slug) {
  s <- as.character(slug %||% "")[1]
  if (is.na(s) || !(s %in% names(.VALIDACION_ANOMALIAS))) return(FALSE)
  identical(.VALIDACION_ANOMALIAS[[s]]$corrige, "dato")
}

# El enunciado del hallazgo de un caso vive en validacion_enunciado_hallazgo.R
# (M4): se redacta por subtipo de regla, no solo por tipo de anomalía.

# =============================================================================
# Estado del dato vs estado de la regla
# =============================================================================
# `estado_dinamico` dice "correcta" en una regla que encontró inconsistencias, y
# no está mal: califica si la REGLA se pudo evaluar, no si el dato está bien.
# El problema es de lectura — en pantalla queda "correcta" al lado de
# "1 inconsistencia". En vez de renombrar un campo que consumen varias
# superficies, se agrega el que faltaba: el que sí habla del dato.

#' Estado del dato para una regla evaluada
#'
#' @param estado_regla valor de `estado_dinamico` (si la regla pudo evaluarse).
#' @param n_inconsistencias hallazgos de esa regla.
#' @return `"no_evaluada"`, `"limpio"` o `"con_hallazgos"`.
#' @family validacion
#' @export
validacion_estado_dato <- function(estado_regla, n_inconsistencias) {
  er <- as.character(estado_regla %||% "")[1]
  # Si la regla no corrió, del dato no sabemos nada — y decir "limpio" sería
  # afirmar algo que nadie verificó.
  if (!identical(er, "correcta")) return("no_evaluada")
  n <- suppressWarnings(as.integer(n_inconsistencias %||% 0L))[1]
  if (is.na(n) || n <= 0L) "limpio" else "con_hallazgos"
}

#' Etiqueta humana del estado del dato
#' @param slug estado devuelto por `validacion_estado_dato()`.
#' @family validacion
#' @export
validacion_estado_dato_etiqueta <- function(slug) {
  switch(as.character(slug %||% "")[1],
    limpio = "Sin hallazgos",
    con_hallazgos = "Con hallazgos",
    "No evaluada")
}
