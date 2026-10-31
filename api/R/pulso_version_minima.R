# =============================================================================
# Qué exige un .pulso a quien lo abre, y el candado de guardado (ADR 0122 §7)
# =============================================================================
#
# El riesgo: una app que no entiende el Planner abre un .pulso que sí lo trae,
# edita los lugares viejos que el Planner ya no lee y lo guarda. La clave
# `planner` sobrevive (el state.rds viaja entero), pero lo editado no llega a
# donde se lee: se pierde en silencio.
#
# Dos piezas, ambas baratas (no agregan lectura de archivos al abrir):
#
# 1. **El manifest declara lo que exige.** Al guardar un proyecto con secciones
#    declaradas en el Planner, el manifest lleva `requiere = {planner:
#    "planner/v1"}` y `min_app_version` (informativo, para personas y notas de
#    versión). La comparación es por CAPACIDAD, no por número de versión: el
#    build de desarrollo y la versión publicada pueden compartir número sin
#    compartir formato, y una capacidad no se equivoca.
#    Al abrir, si el .pulso exige algo que esta app no conoce (otra capacidad o
#    un schema más nuevo), la sesión queda con el candado puesto: se explora y
#    se exporta, pero `build_pulso` se niega a escribir
#    (E_PULSO_VERSION_SUPERIOR); también «guardar como», duplicar y publicar,
#    que pasan por ahí. El candado vive en memoria, por sid, sigue a la sesión
#    si cambia de sid (.pulso_version_mover) y nunca entra al .pulso.
#
# Lo que NO cubre: una app publicada ANTES de este archivo (0.9.6 o anterior)
# no trae el candado y sí puede guardar encima. Contra ella sólo queda la
# detección de la pieza 2, después del hecho.
#
# 2. **Detectar a quien guardó sin saber.** Una app anterior a esta pieza
#    reescribe el manifest sin `requiere`. Si al abrir el estado trae secciones
#    declaradas en el Planner y el manifest no exige nada, el último en guardar
#    no conocía el Planner: el Planner lo avisa para que se revise contra los
#    lugares viejos, en vez de pisar en silencio lo que se editó allá.

PULSO_CAPACIDADES <- c(planner = "planner/v1")

# Lo que ESTA app entiende. Función y no constante a secas para que un test
# pueda simular una app que no conoce el Planner.
.pulso_capacidades_conocidas <- function() PULSO_CAPACIDADES

# Primera versión publicada que entiende el Planner. Informativa: el candado
# compara capacidades, no este número.
PULSO_VERSION_PLANNER <- "0.9.7"

.pulso_version_estado <- new.env(parent = emptyenv())

.pulso_requiere_de <- function(s) {
  requiere <- list()
  if (length(.planner_leer(s)$secciones)) requiere$planner <- unname(PULSO_CAPACIDADES[["planner"]])
  requiere
}

.pulso_capacidades_faltantes <- function(requiere) {
  if (is.null(requiere) || !length(requiere)) return(character(0))
  req <- unlist(requiere, use.names = TRUE)
  if (is.null(names(req))) return(character(0))
  conocidas <- .pulso_capacidades_conocidas()[names(req)]
  faltan <- is.na(conocidas) | conocidas != as.character(req)
  names(req)[faltan]
}

#' Agrega al manifest lo que el proyecto exige a quien lo abra.
#' @keywords internal
.pulso_version_al_guardar <- function(manifest, s) {
  requiere <- .pulso_requiere_de(s)
  if (length(requiere)) {
    manifest$requiere <- requiere
    manifest$min_app_version <- PULSO_VERSION_PLANNER
  }
  manifest
}

#' Registra, para la sesión recién abierta, el candado y el aviso (§7).
#' @keywords internal
.pulso_version_al_abrir <- function(sid, manifest, s) {
  manifest <- if (is.list(manifest)) manifest else list()
  faltan <- .pulso_capacidades_faltantes(manifest$requiere)
  sin_requiere <- !length(manifest$requiere) && length(.planner_leer(s)$secciones) > 0L
  if (length(faltan) || sin_requiere) {
    .pulso_version_estado[[sid]] <- list(
      bloqueado = length(faltan) > 0L,
      faltan = as.list(faltan),
      min_app_version = as.character(manifest$min_app_version %||% ""),
      guardado_sin_planner = sin_requiere,
      app_version_guardado = as.character(manifest$app_version %||% "")
    )
  } else {
    .pulso_version_olvidar(sid)
  }
  invisible(NULL)
}

# El candado sigue a la sesión cuando su estado cambia de sid (abrir «en el
# lugar» o duplicar abriendo la copia): sin esto, el proyecto bloqueado quedaría
# libre y el aviso del anterior se pegaría al nuevo.
.pulso_version_mover <- function(de, a) {
  if (is.null(a) || !nzchar(a) || identical(de, a)) return(invisible(NULL))
  estado <- .pulso_version_de_sesion(de)
  .pulso_version_olvidar(a)
  if (!is.null(estado)) .pulso_version_estado[[a]] <- estado
  .pulso_version_olvidar(de)
  invisible(NULL)
}

.pulso_version_olvidar <- function(sid) {
  if (!is.null(sid) && nzchar(sid) && exists(sid, envir = .pulso_version_estado, inherits = FALSE)) {
    rm(list = sid, envir = .pulso_version_estado)
  }
  invisible(NULL)
}

.pulso_version_de_sesion <- function(sid) {
  if (is.null(sid) || !nzchar(sid)) return(NULL)
  .pulso_version_estado[[sid]]
}

#' Se niega a escribir un .pulso que exige algo que esta app no conoce.
#' @keywords internal
.pulso_version_exigir_guardado <- function(sid) {
  estado <- .pulso_version_de_sesion(sid)
  if (!isTRUE(estado$bloqueado)) return(invisible(TRUE))
  stop_api(409, "E_PULSO_VERSION_SUPERIOR",
           "Este proyecto se guardó con una versión más nueva de la app. Puedes revisarlo, pero para guardarlo o publicarlo actualiza la app.",
           details = list(requiere = estado$faltan, min_app_version = estado$min_app_version))
}

.pulso_version_avisos_planner <- function(sid) {
  estado <- .pulso_version_de_sesion(sid)
  if (!isTRUE(estado$guardado_sin_planner)) return(list())
  version <- estado$app_version_guardado
  list(.planner_aviso(
    "guardado_por_app_anterior",
    paste0("La última vez lo guardó una versión de la app que no conoce el Planner",
           if (nzchar(version)) paste0(" (", version, ")") else "",
           ": revisa que los perfiles sigan coincidiendo con Monitoreo y Cálculo de muestra.")
  ))
}
