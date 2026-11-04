# =============================================================================
# graficos_inclusivo.R — el lenguaje inclusivo se escribe con paréntesis, no con barra
# =============================================================================
#
# Gonzalo (2026-11-04, revisión del PPT v7 de CCSS, lámina 18): «Lenguaje inclusivo en paréntesis, no en slash».
# Los rótulos con barra («Abuelos/as», «de los/las estudiantes», «cómodo/a») vienen del instrumento, y la misma
# etiqueta vive en varios lugares a la vez:
#   - las choices y la survey del XLSForm;
#   - los diccionarios etiqueta ↔ código y los órdenes de lista;
#   - los valores de la base, cuando la carga guarda etiquetas;
#   - el plan, que las cita en el orden manual, los rótulos cortos de las tarjetas y las paletas por opción.
# Cambiar uno solo rompería el casado entre ellos. Por eso la regla se aplica igual a todo, al arrancar el job de PPT
# o de Word, sobre copias: el `.pulso` y el instrumento del estudio no cambian.
#
# Es determinista e idempotente: después de aplicarla ya no queda una barra de género que convertir.
#   - «los/las» → «los(as)», «alumno/alumna» → «alumno(a)»: la segunda palabra repite la raíz de la primera.
#   - «Abuelos/as» → «Abuelos(as)», «cómodo/a» → «cómodo(a)»: un sufijo de género tras una palabra de dos letras o más.
#   - «y/o» no se toca: «y» tiene una sola letra. Tampoco se tocan las fracciones ni las rutas: necesitan letras.

#' Convierte las barras de género de un texto a paréntesis
#' @keywords internal
.inclusivo_parentesis <- function(x) {
  if (!is.character(x) || !length(x)) return(x)
  ok <- !is.na(x) & grepl("/", x, fixed = TRUE)
  if (!any(ok)) return(x)
  y <- x[ok]
  # Raíz repetida: «los/las», «Todos/Todas», «alumno/alumna».
  y <- gsub("\\b(\\p{L}+?)(os|o)/\\1(as|a)\\b", "\\1\\2(\\3)", y, perl = TRUE)
  y <- gsub("\\b(\\p{L}+?)(as|a)/\\1(os|o)\\b", "\\1\\2(\\3)", y, perl = TRUE)   # «las/los» → «las(os)»
  y <- gsub("\\b([Ee]l)/(la)\\b", "\\1(\\2)", y, perl = TRUE)                              # «el/la» → «el(la)»
  # Sufijo de género tras una palabra de dos letras o más: «Abuelos/as», «cómodo/a», «Tíos/as».
  y <- gsub("\\b(\\p{L}{2,})/(as|os|a|o|es)\\b", "\\1(\\2)", y, perl = TRUE)
  x[ok] <- y
  x
}

#' Aplica la regla a todo texto de un objeto: vectores, nombres, niveles de factor y etiquetas de haven
#' @keywords internal
.inclusivo_en <- function(obj) {
  if (is.null(obj)) return(obj)
  if (is.factor(obj)) {
    levels(obj) <- .inclusivo_parentesis(levels(obj))
    return(obj)
  }
  if (is.atomic(obj)) {
    # Etiquetas de la columna (haven): `label` es el texto de la pregunta y `labels` las opciones. Las multiapiladas y las
    # múltiples leen de aquí sus rótulos; sin esto quedaban con barra (CCSS, láminas 18, 47 y 49 de la prueba).
    a <- attributes(obj)
    if (is.character(obj)) obj <- .inclusivo_parentesis(obj)
    attributes(obj) <- a
    lb <- attr(obj, "labels", exact = TRUE)
    if (!is.null(lb) && !is.null(names(lb))) { names(lb) <- .inclusivo_parentesis(names(lb)); attr(obj, "labels") <- lb }
    l1 <- attr(obj, "label", exact = TRUE)
    if (is.character(l1)) attr(obj, "label") <- .inclusivo_parentesis(l1)
    if (!is.null(names(obj))) names(obj) <- .inclusivo_parentesis(names(obj))
    return(obj)
  }
  if (is.environment(obj) || is.function(obj)) return(obj)
  if (is.list(obj)) {
    a <- attributes(obj)
    nm <- names(obj) %||% rep("", length(obj))
    for (i in seq_along(obj)) {
      v <- obj[[i]]
      # Las rutas no son texto para el lector: «/uploads/a/…» no se toca.
      if (!is.null(v) && !grepl("^(path|ruta|file|archivo|src|template_pptx|result_path)$", nm[i])) obj[[i]] <- .inclusivo_en(v)
    }
    if (!is.null(names(obj)) && !is.data.frame(obj)) names(obj) <- .inclusivo_parentesis(names(obj))
    # Atributos con texto: la base trae su propio instrumento en `instrumento_reporte` (una lista), y de ahí leen
    # sus opciones varias láminas (CCSS, láminas 10 y 18 de la prueba).
    for (k in setdiff(names(a), c("names", "row.names", "class"))) {
      if (is.character(a[[k]]) || is.list(a[[k]])) attr(obj, k) <- .inclusivo_en(a[[k]])
    }
    return(obj)
  }
  obj
}

#' Prepara el job: copias de datos e instrumento con la regla aplicada, y el plan y las paletas convertidos
#'
#' @param activo Con `FALSE` todo pasa tal cual (escape para un estudio que quiera conservar la barra).
#' @return `list(data, inst, plan, paletas)`: rutas RDS nuevas (o las mismas) y los objetos convertidos.
#' @keywords internal
.inclusivo_preparar_job <- function(rp_data_path, rp_inst_path, plan, paletas = NULL, activo = TRUE) {
  if (!isTRUE(activo)) return(list(data = rp_data_path, inst = rp_inst_path, plan = plan, paletas = paletas))
  copia <- function(ruta) {
    if (is.null(ruta) || !file.exists(ruta)) return(ruta)
    nueva <- tempfile("inclusivo_", fileext = ".rds")
    saveRDS(.inclusivo_en(readRDS(ruta)), nueva)
    nueva
  }
  list(data = copia(rp_data_path), inst = copia(rp_inst_path), plan = .inclusivo_en(plan), paletas = .inclusivo_en(paletas))
}
