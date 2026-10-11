# =============================================================================
# Cómo se emparejó cada pregunta de una fuente (ítem 15 del checklist de
# codificación SM 2026-10-11; ADR 0099)
#
# Motor puro detrás de `GET /api/carga/fuentes/emparejamiento`. Solo EXPONE lo
# que la alineación ya decidió y dejó en `s$estudio$bases[[b]]$sm_alineacion_fuentes`:
# no recalcula ningún emparejado, no lee la data y no toca la base.
#
# - Las filas salen de `pares` (el mismo `mapa` que se aplicó), `sin_par_base`,
#   `ambiguas` y `sin_par_fuente`, tal como se guardaron.
# - Una base anterior a este cambio no trae `pares`: el detalle no se
#   reconstruye (`detalle_disponible = FALSE`, filas vacías); hay que volver a
#   traer las respuestas.
# - El orden de la base solo ORDENA filas ya decididas.
# =============================================================================

.CFE_SECCION_SOLO_FUENTE <- "Solo en la fuente"

# Con el predicado en verdadero no se afirma «dos o más bases»: el modo
# `independent_siblings` lo enciende aunque el estudio tenga una sola base.
.CFE_MOTIVO_EQUIV_DISPONIBLE <- "Ahí se relacionan las preguntas entre públicos (bases separadas)."
.CFE_MOTIVO_EQUIV_NO_DISPONIBLE <- "Aparece cuando el estudio tiene dos o más bases separadas, una por público."

# Disponibilidad de la pestaña Equivalencias TAL COMO la ve el usuario en el
# rail: el predicado de la pestaña (`.equiv_disponible` → ADR 0061) Y dos o más
# bases primarias (espejo de `basesSeparadas` en Carga). El modo
# `independent_siblings` enciende el predicado con una sola base; sin el
# conteo, el enlace llevaría a una pestaña que no se muestra.
.carga_fuentes_equivalencias <- function(sid, s = NULL) {
  s <- s %||% session_get(sid)
  n_primarias <- length(.carga_review_primary_base_names(s))
  disponible <- isTRUE(.equiv_disponible(sid)) && n_primarias >= 2L
  list(
    disponible = disponible,
    motivo = if (disponible) .CFE_MOTIVO_EQUIV_DISPONIBLE else .CFE_MOTIVO_EQUIV_NO_DISPONIBLE
  )
}

# Base pedida: la indicada (404 si no existe) o la activa.
.carga_fuentes_resolver_base <- function(s, base_nombre) {
  bases <- ((s %||% list())$estudio %||% list())$bases %||% list()
  pedida <- as.character(base_nombre %||% "")[1]
  if (is.na(pedida)) pedida <- ""
  pedida <- trimws(pedida)
  if (nzchar(pedida)) {
    if (is.null(bases[[pedida]])) {
      stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe en el estudio.", pedida))
    }
    return(pedida)
  }
  activa <- as.character(.estudio_active_base_name(s, fallback_first = TRUE) %||% "")[1]
  if (is.na(activa) || !nzchar(activa) || is.null(bases[[activa]])) {
    stop_api(400, "E_BASE_REQUIRED", "Indica la base con 'base_nombre'.")
  }
  activa
}

# Orden de las variables en el instrumento de la base. Solo ordena; si la
# sesión no tiene el instrumento a mano, se lee el XLSForm de la base.
.carga_fuentes_orden_base <- function(sid, s, base_nombre) {
  inst <- (s$rp_inst_sources %||% list())[[base_nombre]]
  if (is.null(inst)) {
    file_id <- as.character((s$estudio$bases[[base_nombre]] %||% list())$xlsform_file_id %||% "")[1]
    if (!is.na(file_id) && nzchar(file_id)) {
      meta <- get_file(sid, file_id)
      inst <- reporte_instrumento(path = meta$path)
    }
  }
  if (is.null(inst)) return(character(0))
  as.character(.equiv_variables_de_base(inst)$name)
}

.cfe_chr <- function(x) {
  x <- as.character(x %||% "")[1]
  if (is.na(x)) "" else x
}

# `pagina_fuente`: título de la página de origen en la fuente. Solo se conoce
# para lo que no entró (las demás filas se describen con la página de la base).
# `enunciado`: encabezado de la pregunta madre cuando la fila es de una matriz
# ("" en las demás); en lo que no entró, el de la fuente.
.cfe_fila <- function(seccion, etiqueta, variable_base, variable_fuente, estado, pagina_fuente = "",
                      enunciado = "") {
  list(seccion = .cfe_chr(seccion), enunciado = .cfe_chr(enunciado), etiqueta = .cfe_chr(etiqueta),
       variable_base = .cfe_chr(variable_base), variable_fuente = .cfe_chr(variable_fuente),
       estado = estado, pagina_fuente = .cfe_chr(pagina_fuente))
}

# Filas de UNA fuente: lo de la base en el orden de su instrumento y, al final,
# lo que solo existe en la fuente.
.carga_fuentes_filas <- function(f, orden_base) {
  de_base <- list()
  for (p in f$pares %||% list()) {
    estado <- if (identical(.cfe_chr(p$base), .cfe_chr(p$fuente))) "emparejada" else "otro_nombre"
    de_base[[length(de_base) + 1L]] <- .cfe_fila(p$seccion, p$etiqueta, p$base, p$fuente, estado,
                                                  enunciado = p$enunciado)
  }
  for (x in f$sin_par_base %||% list()) {
    de_base[[length(de_base) + 1L]] <- .cfe_fila(x$seccion, x$etiqueta, x$variable, "", "sin_respuesta",
                                                  enunciado = x$enunciado)
  }
  for (x in f$ambiguas %||% list()) {
    de_base[[length(de_base) + 1L]] <- .cfe_fila(x$seccion, x$etiqueta, x$variable, "", "ambigua",
                                                  enunciado = x$enunciado)
  }
  if (length(de_base)) {
    vars <- vapply(de_base, function(r) r$variable_base, character(1))
    pos <- match(vars, orden_base)
    # Lo que el instrumento de hoy no nombra queda detrás, en el orden guardado.
    pos[is.na(pos)] <- length(orden_base) + seq_len(sum(is.na(pos)))
    de_base <- de_base[order(pos, seq_along(pos))]
  }
  solo_fuente <- lapply(f$sin_par_fuente %||% list(), function(x) {
    .cfe_fila(.CFE_SECCION_SOLO_FUENTE, x$etiqueta, "", x$variable, "no_entro", pagina_fuente = x$seccion,
              enunciado = x$enunciado)
  })
  unname(c(de_base, solo_fuente))
}

.carga_fuentes_fuente <- function(f, orden_base) {
  # `pares` presente (aunque vacío) = la base guardó el detalle. Sin la clave,
  # la base es anterior al ítem 15 y no se reconstruye.
  detalle <- "pares" %in% names(f)
  excluida <- isTRUE(f$excluida)
  list(
    survey_id = .cfe_chr(f$survey_id),
    titulo = .cfe_chr(f$titulo),
    estado = if (excluida) "excluida" else "incorporada",
    n_emparejadas = as.integer(f$n_emparejadas %||% 0L)[1],
    n_preguntas_base = as.integer(f$n_preguntas_base %||% 0L)[1],
    n_filas_incorporadas = as.integer(f$n_filas_incorporadas %||% 0L)[1],
    n_filas_excluidas = as.integer(f$n_filas_excluidas %||% 0L)[1],
    detalle_disponible = detalle,
    filas = if (detalle) .carga_fuentes_filas(f, orden_base) else list()
  )
}

.carga_fuentes_emparejamiento <- function(sid, base_nombre = NULL) {
  s <- session_get(sid)
  b <- .carga_fuentes_resolver_base(s, base_nombre)
  fuentes <- (s$estudio$bases[[b]] %||% list())$sm_alineacion_fuentes %||% list()
  orden_base <- if (length(fuentes)) .carga_fuentes_orden_base(sid, s, b) else character(0)
  list(
    base_nombre = b,
    equivalencias = .carga_fuentes_equivalencias(sid, s),
    fuentes = unname(lapply(fuentes, .carga_fuentes_fuente, orden_base = orden_base))
  )
}
