# =============================================================================
# graficos_variantes.R — variantes del catálogo de tipos de gráfico (ADR 0139, decisión 2)
# =============================================================================
#
# Una variante es una entrada del catálogo de gráficos que reusa un graficador con args fijos: no hay graficador nuevo
# ni cambia el plan guardado. `p_dumbbell` con `estilo = "resumen"` se ofrece como «Contraste de públicos» (entre dos
# bases, sin cruce) o «Aperturas por grupo» (grupos de un cruce dentro de una base); `p_barras_divergentes` con
# `estilo = "resumen"` como la escala con Sin información en su columna. Hasta el ADR 0139 sólo se alcanzaban desde
# las tarjetas de «¿Qué quieres contar?» (frontend/.../selectores/intencionesContar.ts).
#
# `args_fijos` usa `NA` para «este argumento va nulo» (en JSON sale `null`): el contraste lleva `cruce: null`.
# `args_quitar` lista los argumentos que la variante borra al aplicarse (las aperturas borran el `cruce: null` del
# contraste, para elegir el cruce en Datos, y el par `bases`).
# Se versionan en inst/catalogos/graficos_tipos.json (graficos_tipos_catalogo.R) y viajan en /api/graficos/registry.

#' Variantes del catálogo de gráficos, en el orden en que se ofrecen
#' @return Lista de variantes `{id, graficador, nombre, familia, icono, descripcion, args_fijos, args_quitar}`.
#' @keywords internal
.graficos_variantes <- function() {
  defs <- list(
    list(graficador = "p_dumbbell", slug = "contraste", nombre = "Contraste de públicos",
         descripcion = "La misma pregunta en dos públicos y su diferencia, ordenadas por diferencia.",
         args_fijos = list(estilo = "resumen", cruce = NA), args_quitar = character(0)),
    list(graficador = "p_dumbbell", slug = "aperturas", nombre = "Aperturas por grupo",
         descripcion = "Un público abierto por los grupos de una pregunta, con la distancia entre grupos.",
         args_fijos = list(estilo = "resumen"), args_quitar = c("cruce", "bases")),
    list(graficador = "p_barras_divergentes", slug = "escala_sin_informacion",
         nombre = "Escala con columna de Sin información", nombre_version = "Con columna de Sin información",
         descripcion = "Barras divergentes de desacuerdo y acuerdo, con Sin información en una columna gris aparte.",
         args_fijos = list(estilo = "resumen"), args_quitar = character(0))
  )
  lapply(defs, function(d) {
    m <- .GRAFICADORES_META[[d$graficador]]
    list(
      id = paste0(d$graficador, ":", d$slug),
      graficador = d$graficador,
      nombre = d$nombre,
      nombre_version = as.character(d$nombre_version %||% d$nombre),
      familia = as.character(m$familia_editor %||% NA_character_),
      icono = as.character(m$icono_ui %||% "BarChart"),
      descripcion = d$descripcion,
      args_fijos = d$args_fijos,
      args_quitar = I(as.character(d$args_quitar))   # I(): siempre arreglo en JSON, también vacío o de uno
    )
  })
}

#' Ids de las variantes (`<graficador>:<slug>`)
#' @keywords internal
.graficos_variantes_ids <- function() vapply(.graficos_variantes(), `[[`, "", "id")

# ¿El argumento está declarado y nulo? En R un `null` del JSON llega como elemento NULL con nombre (o NA).
.graficos_variantes_nulo_declarado <- function(args, nombre) {
  if (!nombre %in% names(args)) return(FALSE)
  v <- args[[nombre]]
  is.null(v) || (length(v) == 1L && is.na(v))
}

.graficos_variantes_texto <- function(v) {
  if (is.null(v) || !length(v)) return("")
  x <- as.character(unlist(v, use.names = FALSE))[1]
  if (is.na(x)) "" else trimws(x)
}

# Misma lectura que `esEntreGrupos()` del frontend (laminas/brecha/modeloBrechaGrupos.ts): `cruce` nulo declarado es
# entre bases; con texto, entre grupos; sin declarar, entre bases sólo si `vars` trae preguntas por base (objeto).
.graficos_variantes_dumbbell_entre_grupos <- function(args) {
  if (.graficos_variantes_nulo_declarado(args, "cruce")) return(FALSE)
  if (nzchar(.graficos_variantes_texto(args[["cruce"]]))) return(TRUE)
  v <- args[["vars"]]
  por_base <- is.list(v) && length(v) > 0L && !is.null(names(v)) && all(nzchar(names(v)))
  !por_base
}

#' Variante del catálogo que corresponde a un gráfico ya guardado
#'
#' Sólo lee: no migra el plan ni marca `project_dirty`. Un plan con `estilo = "resumen"` se rotula como su variante.
#' @param graficador Nombre del graficador (`p_dumbbell`...).
#' @param args Args del gráfico tal como están en el plan.
#' @return El id de la variante (`p_dumbbell:contraste`) o `NA_character_` si el gráfico es el tipo base.
#' @keywords internal
.graficos_variante_de <- function(graficador, args = list()) {
  g <- .graficos_variantes_texto(graficador)
  if (!is.list(args)) args <- as.list(args)
  if (!identical(.graficos_variantes_texto(args[["estilo"]]), "resumen")) return(NA_character_)
  if (identical(g, "p_dumbbell")) {
    return(if (.graficos_variantes_dumbbell_entre_grupos(args)) "p_dumbbell:aperturas" else "p_dumbbell:contraste")
  }
  if (identical(g, "p_barras_divergentes")) return("p_barras_divergentes:escala_sin_informacion")
  NA_character_
}
