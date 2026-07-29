# =============================================================================
# Entradas de bitácora: revisiones, archivado y cupo (ADR 0047)
# =============================================================================
#
# La bitácora es un REGISTRO, no un borrador: editar una entrada conserva lo
# que decía antes. Y borrar no es la operación normal —lo normal es archivar—
# porque el valor de una bitácora está en que nadie pueda reescribir la
# historia sin dejar rastro.
#
# `router_diseno_estudio.R` sigue siendo dueño del formato de la entrada
# (`.diseno_bitacora_entry`); acá vive lo que el ADR 0047 agrega encima.

# --- Cupo --------------------------------------------------------------------
#
# El tope histórico era 200 entradas a secas. Con archivado eso se vuelve un
# bug: las archivadas consumirían cupo y EXPULSARÍAN entradas vivas, que es
# exactamente lo contrario de lo que archivar promete. Dos cupos separados.
BITACORA_MAX_ENTRADAS_VIVAS <- 200L
BITACORA_MAX_ENTRADAS_ARCHIVADAS <- 100L

.bit_entrada_archivada <- function(e) {
  nzchar(calc_str(e$archived_at, ""))
}

# Recorta por antigüedad dentro de cada grupo, descartando primero lo archivado.
.bit_entradas_cap <- function(entradas,
                              vivas = BITACORA_MAX_ENTRADAS_VIVAS,
                              archivadas = BITACORA_MAX_ENTRADAS_ARCHIVADAS) {
  entradas <- entradas %||% list()
  if (!length(entradas)) return(list())

  es_arch <- vapply(entradas, .bit_entrada_archivada, logical(1))
  grupo_vivas <- entradas[!es_arch]
  grupo_arch <- entradas[es_arch]

  por_fecha <- function(xs) {
    if (!length(xs)) return(xs)
    xs[order(vapply(xs, function(e) calc_str(e$occurred_at, ""), character(1)), decreasing = TRUE)]
  }

  c(
    utils::head(por_fecha(grupo_vivas), vivas),
    utils::head(por_fecha(grupo_arch), archivadas)
  )
}

# --- Revisiones --------------------------------------------------------------
#
# Empuja la versión ANTERIOR al historial. Se llama antes de aplicar el cambio,
# con la entrada tal como estaba: así el historial responde "qué decía antes",
# que es la pregunta real.
#
# Solo registra si algo sustantivo cambió: reguardar sin tocar nada no debe
# inflar el historial con copias idénticas.
.bit_entrada_revisar <- function(previa, siguiente) {
  if (is.null(previa) || !is.list(previa)) return(siguiente)
  cambio <- !identical(calc_str(previa$title, ""), calc_str(siguiente$title, "")) ||
    !identical(calc_str(previa$body, ""), calc_str(siguiente$body, "")) ||
    !identical(calc_str(previa$tone, ""), calc_str(siguiente$tone, "")) ||
    !identical(calc_str(previa$module_id, ""), calc_str(siguiente$module_id, ""))
  if (!cambio) return(siguiente)

  revision <- list(
    revised_at = .bit_now_iso(),
    title = calc_str(previa$title, ""),
    body = calc_str(previa$body, ""),
    tone = calc_str(previa$tone, "nota"),
    module_id = calc_str(previa$module_id, "diseno-estudio")
  )
  siguiente$revisions <- .bit_revisiones(c(list(revision), previa$revisions %||% list()))
  siguiente
}

# --- Archivar y purgar -------------------------------------------------------

.bit_entrada_indice <- function(entradas, id) {
  idx <- which(vapply(entradas, function(e) identical(calc_str(e$id, ""), id), logical(1)))
  if (!length(idx)) {
    stop_api(404, "E_BITACORA_ENTRADA_NO_EXISTE", sprintf("La entrada '%s' ya no está en la bitácora.", id))
  }
  idx[[1L]]
}

.bit_entrada_archivar <- function(entradas, id, archivar = TRUE) {
  i <- .bit_entrada_indice(entradas, id)
  entradas[[i]]$archived_at <- if (isTRUE(archivar)) .bit_now_iso() else ""
  entradas
}

# Borrado permanente. Existe, pero es la excepción: la UI lo pide con
# confirmación explícita y el camino por defecto es archivar.
.bit_entrada_purgar <- function(entradas, id) {
  .bit_entrada_indice(entradas, id)
  Filter(function(e) !identical(calc_str(e$id, ""), id), entradas)
}

# --- Filtros y búsqueda ------------------------------------------------------
#
# Se resuelven en el servidor porque la exportación a markdown tiene que
# entregar EXACTAMENTE lo filtrado: si el filtro viviera solo en el cliente,
# habría dos implementaciones y bastaría una diferencia para que el archivo no
# coincida con lo que el usuario ve.

.bit_texto_plano <- function(x) {
  out <- tolower(calc_str(x, ""))
  chartr(BITACORA_ACENTOS_DESDE, BITACORA_ACENTOS_HACIA, out)
}

.bit_entrada_calza <- function(e, filtro) {
  if (is.null(filtro) || !is.list(filtro)) return(TRUE)

  if (!isTRUE(filtro$mostrar_archivadas) && .bit_entrada_archivada(e)) return(FALSE)

  tonos <- unlist(filtro$tonos %||% list(), use.names = FALSE)
  if (length(tonos) && !(calc_str(e$tone, "") %in% tonos)) return(FALSE)

  modulos <- unlist(filtro$modulos %||% list(), use.names = FALSE)
  if (length(modulos) && !(calc_str(e$module_id, "") %in% modulos)) return(FALSE)

  etiquetas <- unlist(filtro$etiquetas %||% list(), use.names = FALSE)
  if (length(etiquetas)) {
    propias <- vapply(unlist(e$tags %||% list(), use.names = FALSE), .bit_etiqueta,
                      character(1), USE.NAMES = FALSE)
    if (!any(etiquetas %in% propias)) return(FALSE)
  }

  desde <- .bit_fecha(filtro$desde)
  hasta <- .bit_fecha(filtro$hasta)
  if (nzchar(desde) || nzchar(hasta)) {
    dia <- substr(calc_str(e$occurred_at, ""), 1L, 10L)
    if (!nzchar(dia)) return(FALSE)
    if (nzchar(desde) && dia < desde) return(FALSE)
    if (nzchar(hasta) && dia > hasta) return(FALSE)
  }

  texto <- .bit_texto_plano(filtro$texto)
  if (nzchar(texto)) {
    # Búsqueda sobre título y cuerpo, insensible a mayúsculas y acentos: buscar
    # "validacion" tiene que encontrar "Validación".
    heno <- paste(.bit_texto_plano(e$title), .bit_texto_plano(e$body))
    if (!grepl(texto, heno, fixed = TRUE)) return(FALSE)
  }

  TRUE
}

.bit_entradas_filtrar <- function(entradas, filtro) {
  Filter(function(e) .bit_entrada_calza(e, filtro), entradas %||% list())
}

# --- Exportación a markdown --------------------------------------------------
#
# Agrupa por día porque así se lee una bitácora, y porque es el mismo orden que
# muestra la vista: el archivo tiene que ser reconocible como lo que estaba en
# pantalla.
.bit_entradas_markdown <- function(entradas, titulo = "Bitácora del proyecto") {
  entradas <- entradas %||% list()
  lineas <- c(paste0("# ", titulo), "")

  if (!length(entradas)) {
    return(paste(c(lineas, "_Sin entradas en el rango seleccionado._", ""), collapse = "\n"))
  }

  ordenadas <- entradas[order(
    vapply(entradas, function(e) calc_str(e$occurred_at, ""), character(1)),
    decreasing = TRUE
  )]
  dias <- vapply(ordenadas, function(e) substr(calc_str(e$occurred_at, ""), 1L, 10L), character(1))

  for (dia in unique(dias)) {
    lineas <- c(lineas, paste0("## ", if (nzchar(dia)) dia else "Sin fecha"), "")
    for (e in ordenadas[dias == dia]) {
      encabezado <- paste0("### ", calc_str(e$title, "Nota de bitácora"))
      meta <- paste0("_", calc_str(e$tone, "nota"), " · ", calc_str(e$module_id, "proyecto"), "_")
      lineas <- c(lineas, encabezado, meta, "")
      cuerpo <- calc_str(e$body, "")
      if (nzchar(cuerpo)) lineas <- c(lineas, cuerpo, "")
      etiquetas <- unlist(e$tags %||% list(), use.names = FALSE)
      if (length(etiquetas)) {
        lineas <- c(lineas, paste0("`", paste(etiquetas, collapse = "` `"), "`"), "")
      }
      revisiones <- e$revisions %||% list()
      if (length(revisiones)) {
        # El historial viaja en el export: una bitácora que exporta solo la
        # última versión pierde justamente lo que la hace un registro.
        lineas <- c(lineas, sprintf("<sub>Editada %d %s</sub>",
                                    length(revisiones),
                                    if (length(revisiones) == 1L) "vez" else "veces"), "")
      }
    }
  }

  paste(c(lineas, ""), collapse = "\n")
}
