# =============================================================================
# graficos_presets_floor.R — el suelo editorial de la casa lleva version (H42/D8)
# =============================================================================
#
# DEFECTO que repara: el consolidado enriquece los presets al ENCOLAR y congela
# el resultado dentro de la receta; al renderizar los reusa sin re-enriquecer.
# La receta es un artefacto de procedencia y esa congelacion es deliberada —se
# espera que reconstruya el mismo deck—, pero deja la prueba 5 del loop sin
# poder acreditarse: una receta materializada antes de un cambio de doctrina
# rinde con los defaults viejos mientras preview, PPTX y Word rinden con los
# nuevos, y nada en el deck lo dice.
#
# Caso concreto que lo hizo visible (P29): al pasar el conteo junto al
# porcentaje de default a opcion, un consolidado encolado el dia anterior sigue
# pegando el conteo. La lamina no esta mal —reproduce lo que se aprobo— pero es
# indistinguible de una que ignora la doctrina vigente.
#
# DECISION (Gonzalo, 2026-08-06, opcion 3 de D8): **versionar el suelo**. Ni
# re-enriquecer siempre (perderia la reproducibilidad de recetas aprobadas) ni
# conservar el congelado en silencio (los cuatro caminos divergen sin aviso).
# La receta declara con que suelo se construyo, y al renderizar se compara con
# el vigente: la divergencia deja de ser invisible y pasa a ser un dato.
#
# El sello combina dos cosas:
#   - `version`: etiqueta declarada, que se sube a mano cuando se cambia la
#     doctrina de forma deliberada. Es lo que un humano lee.
#   - `digest`: hash del contenido real de `.PRESETS_DEFAULT_PULSO`. Es lo que
#     impide que la etiqueta mienta: si alguien cambia un default y olvida
#     subir la version, el digest lo delata igual.
#
# Sin el digest, la version seria otra declaracion que puede divergir de lo que
# el motor hace —exactamente la clase de defecto que este loop persigue—.

#' Version declarada del suelo editorial de la casa
#'
#' Se sube A MANO y de forma deliberada cuando cambia la doctrina de
#' `.PRESETS_DEFAULT_PULSO`. El historial vive en el doc del loop.
#'
#' - `1`: suelo previo a 2026-08-06.
#' - `2`: P29 — el porcentaje va solo; el conteo junto a la cifra pasa a ser
#'   opcion apagada de fabrica (`formato_valor`, `mostrar_frecuencia`).
#'
#' @keywords internal
.PRESETS_FLOOR_VERSION <- 2L

#' Sello del suelo editorial vigente
#'
#' @param presets Suelo a sellar; por defecto el de fabrica.
#' @return Lista con `version` (etiqueta declarada) y `digest` (hash del
#'   contenido real, 12 hex). `digest` vale `""` si `digest::digest` no esta
#'   disponible: el sello degrada a solo-version en vez de abortar el encolado.
#' @keywords internal
.graficos_presets_floor_stamp <- function(presets = NULL) {
  presets <- presets %||% .PRESETS_DEFAULT_PULSO

  digest_val <- tryCatch({
    if (!requireNamespace("digest", quietly = TRUE)) {
      ""
    } else {
      substr(digest::digest(presets, algo = "sha256"), 1L, 12L)
    }
  }, error = function(e) "")

  list(
    version = .PRESETS_FLOOR_VERSION,
    digest  = digest_val
  )
}

#' Compara el sello de una receta con el suelo vigente
#'
#' No decide nada: describe. Quien renderiza usa esto para declarar la
#' procedencia del deck, no para reescribir la receta —la receta se respeta,
#' que es el punto de congelarla—.
#'
#' @param sello Sello guardado en la receta (puede ser NULL en recetas
#'   anteriores a esta feature).
#' @param actual Sello vigente; por defecto el de fabrica.
#' @return Lista con `estado` (`"vigente"`, `"desactualizado"`, `"sin_sello"`),
#'   `version_receta`, `version_actual` y `mismo_contenido`.
#' @keywords internal
.graficos_presets_floor_compare <- function(sello, actual = NULL) {
  actual <- actual %||% .graficos_presets_floor_stamp()

  if (is.null(sello) || !is.list(sello) || is.null(sello$version)) {
    return(list(
      estado          = "sin_sello",
      version_receta  = NA_integer_,
      version_actual  = actual$version,
      mismo_contenido = FALSE
    ))
  }

  v_receta <- suppressWarnings(as.integer(sello$version))
  d_receta <- .graficos_scalar_chr(sello$digest, "")
  d_actual <- .graficos_scalar_chr(actual$digest, "")

  # El digest manda sobre la etiqueta: si el contenido coincide, el suelo es el
  # mismo aunque alguien haya movido el numero, y viceversa.
  mismo <- nzchar(d_receta) && nzchar(d_actual) && identical(d_receta, d_actual)

  list(
    estado          = if (mismo) "vigente" else "desactualizado",
    version_receta  = v_receta,
    version_actual  = actual$version,
    mismo_contenido = mismo
  )
}
