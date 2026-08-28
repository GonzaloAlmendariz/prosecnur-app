# Claves de texto persistidas: leer también la variante anterior a la eñe.
#
# EL DEFECTO QUE CIERRA, medido en la app el 2026-08-25 sobre HSVG 2026. Los
# criterios del estudio no guardan la etiqueta que ve el analista, guardan la
# CLAVE NORMALIZADA: `byVariable$faculty$categories` es una lista de claves, y
# lo mismo `minEligible$byFaculty` y los rangos por facultad. Al reparar
# `.cm_aulas_text_key()` para que la eñe no se partiera (a9c217c0), la clave de
# «ARTE Y DISEÑO» pasó de `arte_y_dise_no` a `arte_y_diseno` — pero las claves
# YA GUARDADAS en el `.pulso` conservan la forma vieja. El criterio de facultad
# es un `include`: una facultad cuya clave no figura en la lista **no está entre
# las que el estudio declara**, así que sale del marco entera.
#
# Lo medido: 248 aulas de Arte y Diseño con `eligible_n = 0` y razón
# `faculty_curso`, 5.327 alumnos excluidos por `faculty`, la facultad
# desaparecida del perfil (14 filas en vez de 15) y, en cascada, 14 estratos y
# 14 filas en la tabla del cálculo. Ni un error, ni un aviso: la app enseña una
# tabla de 14 facultades como si el estudio tuviera 14.
#
# POR QUÉ NO SE MIGRA EL ARCHIVO. Reescribir las claves del `.pulso` al abrirlo
# arregla ese `.pulso` y deja rotos los que no se abran, además de mutar el
# archivo del cliente sin que nadie lo pida. La compatibilidad va del lado de la
# LECTURA, que es la regla de la casa para los alias heredados de navegación:
# se leen, no se escriben. Lo que se guarde de aquí en adelante lleva la clave
# vigente.
#
# POR QUÉ NO SE REPRODUCE EL `iconv` VIEJO. La forma antigua nacía de
# `ASCII//TRANSLIT`, que depende de la locale —ése era justamente el defecto—,
# así que reproducirla llamando a `iconv` volvería a atarnos a la plataforma.
# Se genera de forma determinista desde el texto original sustituyendo la eñe
# por `_n` en lugar de `n`, que es exactamente lo que producía el translit de
# macOS: «ARTE Y DISEÑO» → `arte_y_dise_no`.

#' Clave de texto en su forma anterior al arreglo de la eñe.
#'
#' Sólo para LEER configuraciones ya guardadas. Nunca para escribir.
#'
#' @param x vector de textos.
#' @return las claves que `.cm_aulas_text_key()` producía antes de a9c217c0.
#' @keywords internal
.cm_aulas_text_key_legada <- function(x) {
  x <- as.character(x %||% "")
  x[is.na(x)] <- ""
  .cm_aulas_text_key(gsub("[ñÑ]", "_n", x))
}

#' ¿Cada valor pertenece al conjunto de claves guardadas?
#'
#' Casa por la clave vigente y, si no, por la legada. Un valor sin señal
#' devuelve `NA` para que cada criterio decida qué hacer con él: la semántica de
#' «sin señal pasa» no es universal (el criterio de docente la invierte).
#'
#' @param valores vector de textos crudos (facultades, modalidades…).
#' @param claves claves guardadas en la configuración.
#' @return lógico del largo de `valores`; `NA` donde el valor no tiene señal.
#' @keywords internal
.cm_aulas_clave_en <- function(valores, claves) {
  n <- length(valores)
  if (!n) return(logical(0))
  claves <- as.character(unlist(claves, use.names = FALSE))
  claves <- claves[!is.na(claves) & nzchar(claves)]
  vk <- .cm_aulas_text_key(valores)
  out <- rep(NA, n)
  if (!length(claves)) return(out)
  hay <- nzchar(vk)
  out[hay] <- vk[hay] %in% claves
  pendientes <- hay & !out
  if (any(pendientes)) {
    lk <- .cm_aulas_text_key_legada(valores[pendientes])
    out[pendientes] <- lk %in% claves
  }
  out
}

#' Busca una entrada de un mapa indexado por clave de facultad.
#'
#' Igual que `mapa[[clave]]`, pero acepta la clave legada cuando la vigente no
#' está. Si el mapa trae LAS DOS —pasa en un `.pulso` que se editó a ambos lados
#' del arreglo— manda la vigente, que es la que escribió la app más reciente.
#'
#' @param mapa lista nombrada por clave de facultad.
#' @param facultad texto crudo de la facultad.
#' @return la entrada, o `NULL`.
#' @keywords internal
.cm_aulas_mapa_por_clave <- function(mapa, facultad) {
  if (!is.list(mapa) || !length(mapa)) return(NULL)
  clave <- .cm_aulas_text_key(facultad)[[1L]] %||% ""
  if (nzchar(clave) && !is.null(mapa[[clave]])) return(mapa[[clave]])
  legada <- .cm_aulas_text_key_legada(facultad)[[1L]] %||% ""
  if (nzchar(legada) && !is.null(mapa[[legada]])) return(mapa[[legada]])
  NULL
}

#' Reescribe a la clave vigente las claves legadas de un mapa por facultad.
#'
#' Los lookups por facultad (`minEligible$byFaculty`, `crit$exceptions`) reciben
#' una clave YA calculada, así que no pueden probar la variante legada: desde
#' `arte_y_diseno` no se puede deducir `arte_y_dise_no` sin saber dónde estaba
#' la eñe. Se resuelve al revés, una sola vez y con las etiquetas reales del
#' marco en la mano: cada etiqueta sabe cuáles son SUS dos claves.
#'
#' Una entrada vigente nunca la pisa una legada: un `.pulso` editado a ambos
#' lados del arreglo trae las dos y manda la que escribió la app más reciente.
#' Las claves que no correspondan a ninguna etiqueta presente se conservan tal
#' cual, porque pueden ser de una facultad que este marco no trae.
#'
#' @param mapa lista nombrada por clave de facultad.
#' @param etiquetas facultades crudas presentes en el marco.
#' @return el mapa con las claves legadas reescritas.
#' @keywords internal
.cm_aulas_canonizar_claves <- function(mapa, etiquetas) {
  if (!is.list(mapa) || !length(mapa)) return(mapa)
  nombres <- names(mapa)
  if (is.null(nombres)) return(mapa)
  etiquetas <- unique(as.character(etiquetas %||% character(0)))
  etiquetas <- etiquetas[!is.na(etiquetas) & nzchar(etiquetas)]
  if (!length(etiquetas)) return(mapa)
  vigentes <- .cm_aulas_text_key(etiquetas)
  legadas <- .cm_aulas_text_key_legada(etiquetas)
  # Sólo las etiquetas cuya clave CAMBIÓ con el arreglo tienen algo que traducir.
  cambia <- nzchar(legadas) & legadas != vigentes
  if (!any(cambia)) return(mapa)
  traduccion <- stats::setNames(vigentes[cambia], legadas[cambia])
  for (i in seq_along(nombres)) {
    # `[[` sobre un nombre ausente es un error, no un NULL: se indexa con `[`.
    destino <- unname(traduccion[nombres[[i]]])
    if (is.na(destino) || destino %in% nombres) next
    nombres[[i]] <- destino
  }
  names(mapa) <- nombres
  mapa
}
