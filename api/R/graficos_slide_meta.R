# Canal `meta` de una lámina, del editor al motor (F6.0b.3; inventario F6, parte A, problema de fondo 1).
#
# Las decisiones del recetario que no son datos del gráfico viven en `slide$meta`: `variante` (portada, cierre),
# `composicion` e `iconos` (índice), `actores` (objetivo), `antetitulo`, `nivel`/`numero`/`rotulo` (separador), `metodo`
# (redondeo) y `motor_nativo`. Los 33 constructores `p_slide_*` aceptan `meta`; el editor la guarda en `payload.meta`.
# Lo que faltaba es que llegara entera: el JSON del editor trae los vectores como listas (`["a","b"]` → `list("a","b")`)
# y los consumidores esperan vectores de caracteres.

#' Claves de `meta` que el motor lee hoy (documentación del contrato; una clave desconocida se conserva igual)
#' @keywords internal
.SLIDE_META_CLAVES <- c("variante", "composicion", "iconos", "actores", "actores_iconos", "antetitulo", "nivel", "numero", "rotulo",
                        "metodo", "motor_nativo", "word_heading_level")

#' `meta` lista para el motor: las listas de escalares pasan a vectores y lo vacío se descarta
#' @keywords internal
.graficos_normalizar_meta <- function(meta) {
  if (is.null(meta)) return(NULL)
  if (is.data.frame(meta)) meta <- as.list(meta)
  if (!is.list(meta)) return(NULL)
  meta <- lapply(meta, function(v) {
    if (is.list(v) && is.null(names(v)) && length(v) &&
        all(vapply(v, function(x) is.atomic(x) && length(x) == 1L, logical(1)))) unlist(v, use.names = FALSE) else v
  })
  meta <- meta[!vapply(meta, function(v) is.null(v) || length(v) == 0L, logical(1))]
  if (!length(meta) || is.null(names(meta))) return(NULL)
  meta
}

#' El payload de una lámina con su `meta` normalizada (o sin `meta` si quedó vacía)
#' @keywords internal
.graficos_payload_con_meta <- function(payload) {
  if (!"meta" %in% names(payload)) return(payload)
  payload$meta <- .graficos_normalizar_meta(payload$meta)
  payload
}
