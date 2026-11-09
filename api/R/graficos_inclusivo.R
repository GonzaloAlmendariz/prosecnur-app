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
.inclusivo_en <- function(obj, f = .inclusivo_parentesis) {
  if (is.null(obj)) return(obj)
  if (is.factor(obj)) {
    levels(obj) <- f(levels(obj))
    return(obj)
  }
  if (is.atomic(obj)) {
    # Etiquetas de la columna (haven): `label` es el texto de la pregunta y `labels` las opciones. Las multiapiladas y las
    # múltiples leen de aquí sus rótulos; sin esto quedaban con barra (CCSS, láminas 18, 47 y 49 de la prueba).
    a <- attributes(obj)
    if (is.character(obj)) obj <- f(obj)
    attributes(obj) <- a
    lb <- attr(obj, "labels", exact = TRUE)
    if (!is.null(lb)) {
      # En haven los nombres son las etiquetas; en las variables recodificadas va al revés (código = etiqueta, como
      # A9_otro_recod de CCSS). Se convierten los dos lados: un código no lleva barra de género.
      if (!is.null(names(lb))) names(lb) <- f(names(lb))
      if (is.character(lb)) { nm <- names(lb); lb <- f(lb); names(lb) <- nm }
      attr(obj, "labels") <- lb
    }
    l1 <- attr(obj, "label", exact = TRUE)
    if (is.character(l1)) attr(obj, "label") <- f(l1)
    if (!is.null(names(obj))) names(obj) <- f(names(obj))
    return(obj)
  }
  if (is.environment(obj) || is.function(obj)) return(obj)
  if (is.list(obj)) {
    a <- attributes(obj)
    nm <- names(obj) %||% rep("", length(obj))
    for (i in seq_along(obj)) {
      v <- obj[[i]]
      # Las rutas no son texto para el lector: «/uploads/a/…» no se toca.
      if (!is.null(v) && !grepl("^(path|ruta|file|archivo|src|template_pptx|result_path)$", nm[i])) obj[[i]] <- .inclusivo_en(v, f)
    }
    if (!is.null(names(obj)) && !is.data.frame(obj)) names(obj) <- f(names(obj))
    # Atributos con texto: la base trae su propio instrumento en `instrumento_reporte` (una lista), y de ahí leen
    # sus opciones varias láminas (CCSS, láminas 10 y 18 de la prueba).
    for (k in setdiff(names(a), c("names", "row.names", "class"))) {
      if (is.character(a[[k]]) || is.list(a[[k]])) attr(obj, k) <- .inclusivo_en(a[[k]], f)
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
  plan <- .inclusivo_en(plan); paletas <- .inclusivo_en(paletas)
  mapa <- .rotulos_cortos_mapa(plan$rotulos_cortos)
  f <- .inclusivo_convertidor(mapa)
  copia <- function(ruta) {
    if (is.null(ruta) || !file.exists(ruta)) return(ruta)
    nueva <- tempfile("inclusivo_", fileext = ".rds")
    saveRDS(f(readRDS(ruta)), nueva)
    nueva
  }
  if (length(mapa)) {
    cortos <- plan$rotulos_cortos; plan$rotulos_cortos <- NULL
    plan <- .inclusivo_en(plan, function(x) .rotulos_cortos_aplicar(x, mapa)); plan$rotulos_cortos <- cortos
    paletas <- .inclusivo_en(paletas, function(x) .rotulos_cortos_aplicar(x, mapa))
  }
  list(data = copia(rp_data_path), inst = copia(rp_inst_path), plan = plan, paletas = paletas)
}

#' La regla inclusiva y los rótulos cortos como una sola función sobre un objeto
#' @keywords internal
.inclusivo_convertidor <- function(mapa) {
  function(o) {
    o <- .inclusivo_en(o)
    if (length(mapa)) .inclusivo_en(o, function(x) .rotulos_cortos_aplicar(x, mapa)) else o
  }
}

#' Lo común de la vista previa y las miniaturas con la misma regla del job de PPT y Word
#'
#' H1 del checklist de usabilidad del editor (2026-11-05): la vista previa no aplicaba los rótulos cortos del estudio ni la
#' regla inclusiva, y el editor mostraba «Académica (grupos de lectura, seminarios…)» donde el PPT dice «Académica». Se
#' aplican aquí, una vez por pedido, a los datos, el instrumento y las paletas que recibe el motor; la lámina se convierte
#' con `.inclusivo_preparar_lamina`. La huella de la caché se calcula después, sobre lo ya convertido.
#' @param rotulos_cortos `plan$rotulos_cortos` de la config efectiva.
#' @return `list(data_sources, inst_sources, paletas, mapa)`.
#' @keywords internal
.inclusivo_preparar_preview <- function(data_sources, inst_sources, paletas = NULL, rotulos_cortos = NULL, activo = TRUE) {
  if (!isTRUE(activo)) return(list(data_sources = data_sources, inst_sources = inst_sources, paletas = paletas, mapa = character(0)))
  mapa <- .rotulos_cortos_mapa(.inclusivo_en(rotulos_cortos))
  f <- .inclusivo_convertidor(mapa)
  list(data_sources = f(data_sources), inst_sources = f(inst_sources), paletas = f(paletas), mapa = mapa)
}

#' Una lámina del editor con la regla inclusiva y los rótulos cortos, como la convierte el job dentro del plan
#' @keywords internal
.inclusivo_preparar_lamina <- function(slide, mapa = character(0)) .inclusivo_convertidor(mapa)(slide)

#' Mapa de rótulos cortos del estudio (`plan$rotulos_cortos`: rótulo completo → corto), ya con la regla inclusiva
#'
#' Una opción del instrumento con un rótulo de cuatro renglones («Por beca de estudios (puede ser beca 18 o …)») no cabe en
#' una lámina combinada con sus tarjetas (ítem 8 de la revisión de Gonzalo al PPT v7 de CCSS). El estudio declara una
#' sola vez el corto, y se aplica igual a datos, instrumento, plan y paletas, como la regla inclusiva, para que todo siga
#' casando. Solo reemplaza el rótulo ENTERO: nunca un pedazo de otro texto.
#' @keywords internal
.rotulos_cortos_mapa <- function(m) {
  m <- .rotulos_cortos_opciones(m)   # ADR 0141: la clave `preguntas` no es un rótulo de opción
  if (!length(m)) return(character(0))
  stats::setNames(as.character(m), .inclusivo_parentesis(names(m)))
}

#' Reemplaza los rótulos que coinciden enteros con una clave del mapa
#' @keywords internal
.rotulos_cortos_aplicar <- function(x, mapa) {
  if (!is.character(x) || !length(mapa)) return(x)
  i <- match(x, names(mapa)); ok <- !is.na(i)
  x[ok] <- unname(mapa[i[ok]])
  x
}
