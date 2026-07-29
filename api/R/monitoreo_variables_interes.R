# Distribución de una columna del universo, para elegir variables de interés.
#
# El catálogo de columnas (`.monitoreo_snapshot_variable_stats_for_source`) ya
# decía cuántos valores no vacíos tiene cada columna y mostraba hasta seis
# ejemplos. Con eso se puede elegir una columna, pero no se puede ver su
# reparto: para segmentar el avance de Egresados por ciclo hace falta saber
# cuántos casos caen en cada categoría, no una muestra de cinco.
#
# Dos decisiones que gobiernan este archivo:
#
#   1. Solo se cuenta lo que tiene sentido contar. Una columna de nombres o de
#      correos tiene tantas categorías como filas: contarla es caro y el
#      resultado no sirve para segmentar nada. Por eso el reparto se calcula
#      únicamente cuando la columna tiene pocas categorías distintas, y en el
#      resto se publica el número de distintos para que la interfaz pueda
#      descartarla sin volver a preguntar.
#
#   2. El recorte se declara. Si una columna tiene más categorías de las que se
#      devuelven, el resultado dice cuántas quedaron fuera y cuántos casos
#      representan, en vez de mostrar un top que aparenta ser el total.

# Por encima de este número de categorías distintas, una columna deja de ser
# candidata a segmentar: es un identificador o texto libre.
.MONITOREO_VI_MAX_CATEGORIAS <- 60L

# Categorías devueltas como mucho. Lo que sobra se resume en `otras_*`.
.MONITOREO_VI_TOP <- 40L

.monitoreo_vi_valores <- function(values) {
  observed <- trimws(as.character(values))
  observed[is.na(observed)] <- ""
  observed[nzchar(observed)]
}

#' Reparto de una columna en categorías, listo para dibujar.
#'
#' Devuelve siempre `distinct_count` y `non_empty`; `categories` solo cuando la
#' columna es realmente categórica (ver `.MONITOREO_VI_MAX_CATEGORIAS`).
.monitoreo_variable_distribucion <- function(values,
                                             max_categorias = .MONITOREO_VI_MAX_CATEGORIAS,
                                             top = .MONITOREO_VI_TOP) {
  observed <- .monitoreo_vi_valores(values)
  non_empty <- length(observed)
  if (!non_empty) {
    return(list(
      non_empty = 0L,
      distinct_count = 0L,
      categorical = FALSE,
      categories = list(),
      otras_categorias = 0L,
      otras_casos = 0L
    ))
  }

  distinct_count <- length(unique(observed))
  if (distinct_count > max_categorias) {
    # Se publica el conteo para que la interfaz sepa POR QUÉ no hay reparto.
    return(list(
      non_empty = as.integer(non_empty),
      distinct_count = as.integer(distinct_count),
      categorical = FALSE,
      categories = list(),
      otras_categorias = 0L,
      otras_casos = 0L
    ))
  }

  tab <- sort(table(observed), decreasing = TRUE)
  visibles <- utils::head(tab, top)
  fuera <- length(tab) - length(visibles)
  list(
    non_empty = as.integer(non_empty),
    distinct_count = as.integer(distinct_count),
    categorical = TRUE,
    categories = lapply(seq_along(visibles), function(i) list(
      value = names(visibles)[[i]],
      count = as.integer(visibles[[i]])
    )),
    otras_categorias = as.integer(max(0L, fuera)),
    otras_casos = as.integer(if (fuera > 0L) sum(tab[(length(visibles) + 1L):length(tab)]) else 0L)
  )
}

# --- Normalización -----------------------------------------------------------
#
# El caso real que la motiva: «Ciclo de egreso» llega como `2021-1`, `2021-2`,
# `2022-1`… Segmentar por el valor crudo duplica las categorías y parte cada
# cohorte en dos, así que el año pide agruparse.

.MONITOREO_VI_NORMALIZACIONES <- c("ninguna", "anio")

#' ¿Los valores parecen ciclos `AAAA-S`?
#'
#' Se exige mayoría, no unanimidad: una hoja real trae erratas sueltas y una
#' sola celda mal escrita no debería impedir la agrupación.
.monitoreo_variable_parece_ciclo <- function(values) {
  observed <- .monitoreo_vi_valores(values)
  if (!length(observed)) return(FALSE)
  con_patron <- grepl("^(19|20)\\d{2}\\s*[-/ ]\\s*[0-9IVX]+$", observed)
  sum(con_patron) > length(observed) / 2
}

#' Aplica la normalización declarada a un vector de valores.
#'
#' `anio` se queda con las cuatro cifras iniciales; lo que no las tenga se
#' devuelve intacto, para no fabricar una categoría que el dato no dice.
.monitoreo_variable_normalizar <- function(values, normalizacion = "ninguna") {
  normalizacion <- .monitoreo_scalar(normalizacion, "ninguna")
  observed <- trimws(as.character(values))
  if (!identical(normalizacion, "anio")) return(observed)
  anio <- sub("^((19|20)\\d{2}).*$", "\\1", observed)
  ifelse(grepl("^(19|20)\\d{2}$", anio), anio, observed)
}

# --- Persistencia ------------------------------------------------------------
#
# Las variables de interés son POR ACTOR, y un actor puede tener más de una:
# Egresados se sigue por ciclo de egreso y Docentes por categoría, pero nada
# impide seguir a Egresados también por situación laboral. `control_vars` no
# sirve para esto porque es una lista global del estudio, sin forma de decir a
# quién aplica cada variable.
#
# Este campo entra en la whitelist de `.monitoreo_operational_model()`. Sin eso
# se descartaría en silencio al guardar: el `.pulso` se escribiría sin él y la
# elección del usuario desaparecería sin un solo error.

.MONITOREO_VI_NORMALIZACIONES_VALIDAS <- c("ninguna", "anio")

#' Normaliza el mapa actor -> variable de interés.
#'
#' `cols` son las columnas conocidas del snapshot. Si se pasan, una variable que
#' ya no existe en la base se descarta: conservarla dejaría el modelo apuntando
#' a una columna fantasma tras cambiar la hoja.
.monitoreo_normalize_interest_variables <- function(raw = NULL, cols = character(0)) {
  if (is.null(raw)) return(list())
  if (is.data.frame(raw)) {
    raw <- lapply(seq_len(nrow(raw)), function(i) as.list(raw[i, , drop = FALSE]))
  }
  if (!is.list(raw) || !length(raw)) return(list())

  out <- list()
  vistos <- character(0)
  for (item in raw) {
    if (!is.list(item)) next
    actor <- trimws(.monitoreo_scalar(item$actor %||% item$unidad, ""))
    variable <- trimws(.monitoreo_scalar(item$variable %||% item$columna, ""))
    if (!nzchar(actor) || !nzchar(variable)) next
    if (length(cols) && !variable %in% cols) next
    # Un actor puede declarar VARIAS variables de interés: a Egresados le
    # importa el ciclo de egreso y también si está trabajando. Lo que no se
    # repite es el par actor+variable.
    clave <- paste(.monitoreo_text_key(actor), .monitoreo_text_key(variable), sep = "::")
    if (clave %in% vistos) next
    vistos <- c(vistos, clave)

    normalizacion <- .monitoreo_scalar(item$normalization %||% item$normalizacion, "ninguna")
    if (!normalizacion %in% .MONITOREO_VI_NORMALIZACIONES_VALIDAS) normalizacion <- "ninguna"

    out[[length(out) + 1L]] <- list(
      actor = actor,
      variable = variable,
      normalization = normalizacion,
      label = .monitoreo_scalar(item$label %||% item$etiqueta, variable)
    )
  }
  out
}

# --- Puente con el reporte de control -----------------------------------------
#
# `.monitoreo_report_control_specs()` ya traía cuatro specs fijas —Egresados por
# año de egreso, Docentes por dedicación y categoría, Administrativos por área—
# que resultaron ser justo las variables que interesan en acrconta. Estaban
# hardcodeadas, así que servían para ese estudio y para ninguno más.
#
# Lo que el usuario declara en Modelo > Distribución manda sobre esas specs: si
# alguien eligió otra columna para Egresados, es la suya la que debe salir en el
# reporte. Las fijas quedan como respaldo para los actores sin declaración, para
# no romper los estudios que ya dependían de ellas.

#' Convierte las variables declaradas en specs de control.
.monitoreo_interest_variables_specs <- function(interest_variables = list()) {
  if (!is.list(interest_variables) || !length(interest_variables)) return(list())
  out <- list()
  for (item in interest_variables) {
    if (!is.list(item)) next
    actor <- trimws(.monitoreo_scalar(item$actor, ""))
    variable <- trimws(.monitoreo_scalar(item$variable, ""))
    if (!nzchar(variable)) next
    out[[length(out) + 1L]] <- list(
      actor = actor,
      label = .monitoreo_scalar(item$label, variable),
      # `anio` es el mismo tipo que ya usaba la spec fija de Egresados, así que
      # el agrupado por cohorte se reutiliza tal cual.
      type = if (identical(.monitoreo_scalar(item$normalization, "ninguna"), "anio")) "anio" else "texto",
      aliases = c(variable),
      declared = TRUE
    )
  }
  out
}

#' Antepone lo declarado y deja las specs fijas solo donde no hay declaración.
#'
#' El criterio es por ACTOR: quien declaró variables para Egresados sustituye
#' todas las fijas de Egresados, porque si eligió a mano lo que le interesa, una
#' spec de fábrica compitiendo con la suya solo añade ruido al reporte.
.monitoreo_merge_control_specs <- function(specs_fijas = list(), specs_declaradas = list()) {
  if (!length(specs_declaradas)) return(specs_fijas)
  actores_declarados <- unique(vapply(
    specs_declaradas,
    function(s) .monitoreo_text_key(.monitoreo_scalar(s$actor, "")),
    character(1)
  ))
  conservadas <- Filter(function(s) {
    clave <- .monitoreo_text_key(.monitoreo_scalar(s$actor, ""))
    # Una spec sin actor aplica a todos: se conserva siempre.
    !nzchar(clave) || !clave %in% actores_declarados
  }, specs_fijas)
  c(specs_declaradas, conservadas)
}
