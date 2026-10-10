# Elección automática de íconos del recetario, con su motivo (F6.0b.5; dirección F6 §4 «Biblioteca de íconos»).
#
# El motor elige el ícono de cada capítulo del índice, de cada actor del objetivo y de cada fila de la ficha técnica por
# palabras clave de su texto. El editor tiene que mostrar QUÉ eligió y POR QUÉ («elegido por “Perfil del encuestado”»)
# para que el analista lo reemplace con conocimiento. Las reglas son las mismas que usaban `.lam_icono_capitulo`,
# `.lam_icono_actor` y `.lam_icono_ficha` (lamina_identidad.R), que ahora delegan aquí.

#' Reglas por contexto: patrón (sobre el texto sin tildes, en minúsculas) → ícono; y el ícono por defecto
#' @keywords internal
.LAM_ICONOS_REGLAS <- list(
  capitulo = list(defecto = "list-checks", reglas = list(
    c("egreso", "award"), c("perfil|encuestad|actores|muestra", "users"), c("politica", "scroll-text"),
    c("institucion", "building-2"), c("organizac|administrativ|financ", "network"), c("docente|academico|cuerpo", "presentation"),
    c("estudiante|graduad|laboral|insercion", "briefcase"), c("infraestructura|recurso|instalacion", "library"),
    c("curricul|plan de estudio|formacion", "book-open"), c("vinculacion|medio|sostenib", "handshake"),
    c("internacional", "globe"), c("investigacion|innovacion", "flask-conical"), c("integridad|transparencia|etica", "scale"),
    c("objetivo", "target"), c("metodolog|ficha", "clipboard-list"), c("resultado|hallazgo", "chart-column"),
    c("conclusi", "list-checks"), c("recomendaci", "lightbulb"))),
  actor = list(defecto = "users", reglas = list(
    c("estudiant|alumn", "graduation-cap"), c("docent|profesor", "presentation"), c("egresad|graduad", "briefcase"),
    c("administrativ|personal|autoridad", "building-2"), c("comite|consultiv", "users"), c("empleador|empresa", "briefcase-business"))),
  ficha = list(defecto = "info", reglas = list(
    c("tipo|tecnica|metodolog|instrumento", "clipboard-list"), c("universo|poblacion|publico", "users"),
    c("muestreo|seleccion|diseno", "shuffle"), c("muestra|tamano|casos|respuestas", "hash"),
    c("campo|fecha|periodo|aplicacion", "calendar-days"), c("margen|error|confianza|precision", "gauge"),
    c("ambito|cobertura|territor|lugar|sede", "map-pin")))
)

#' El ícono que el motor elige para un texto y el motivo
#'
#' @param texto Título del capítulo, nombre del actor o criterio de la ficha.
#' @param contexto «capitulo», «actor» o «ficha».
#' @return `list(icono, palabra, motivo)`: `palabra` es la raíz que casó (`NA` si cayó al ícono por defecto) y `motivo` la
#'   frase para el editor.
#' @keywords internal
.lam_icono_elegir <- function(texto, contexto = c("capitulo", "actor", "ficha")) {
  contexto <- match.arg(contexto)
  def <- .LAM_ICONOS_REGLAS[[contexto]]
  t <- .lam_clave(as.character(texto %||% "")[1])
  for (r in def$reglas) {
    m <- regmatches(t, regexpr(r[1], t))
    if (length(m) && nzchar(m)) {
      return(list(icono = r[2], palabra = m, motivo = sprintf("Elegido por «%s» en «%s».", m, as.character(texto)[1])))
    }
  }
  list(icono = def$defecto, palabra = NA_character_, motivo = "Ninguna palabra clave casó: va el ícono por defecto.")
}

#' Catálogo de la biblioteca del recetario empaquetada
#' @return `list(colores, nombres)`; `nombres` es la lista de íconos de navy (los demás colores son subconjuntos o iguales).
#' @keywords internal
.lam_iconos_catalogo <- function() {
  raiz <- system.file("ppt_assets", "iconos_recetario", package = "prosecnurapp")
  colores <- c("navy", "blanco", "coral", "verde")
  por_color <- lapply(colores, function(c) sort(sub("\\.png$", "", list.files(file.path(raiz, c), pattern = "\\.png$"))))
  names(por_color) <- colores
  list(colores = por_color, nombres = por_color$navy)
}

#' Íconos de la biblioteca como data URI, para el catálogo del editor
#' @param color «navy», «blanco», «coral» o «verde».
#' @param nombres Opcional: sólo esos íconos (los que no existen se omiten).
#' @keywords internal
.lam_iconos_data_uri <- function(color = "navy", nombres = NULL) {
  cat <- .lam_iconos_catalogo()
  if (!color %in% names(cat$colores)) stop_api(400, "E_BAD_ICONO_COLOR", sprintf("Color de ícono desconocido: «%s».", color))
  n <- cat$colores[[color]]
  if (length(nombres)) n <- intersect(as.character(unlist(nombres)), n)
  raiz <- system.file("ppt_assets", "iconos_recetario", color, package = "prosecnurapp")
  uris <- vapply(n, function(x) {
    f <- file.path(raiz, paste0(x, ".png"))
    paste0("data:image/png;base64,", jsonlite::base64_enc(readBin(f, "raw", file.info(f)$size)))
  }, character(1))
  stats::setNames(as.list(uris), n)
}
