# =============================================================================
# graficos_hallazgos_resumen.R — el resumen ejecutivo de `p_slide_hallazgos` (modos «resumen» y «titulares»)
# =============================================================================
#
# Revisión de Gonzalo del PPT v7.11 de CCSS (ítem 2): Hallazgos clave «debe ser visto como un resumen ejecutivo, va al
# final y además le falta definirse mejor, verse mejor». Maqueta del 2026-11-04 (`propuesta.md`, V1 recomendada):
#
#   - `resumen` (V1): tabla por capítulo. Cada fila lleva la cifra, la frase que se lee tras ella, el intervalo (y la base
#     si difiere), la diferencia principal frente al resto en pastillas (▲▼ al 99%, △▽ punteadas al 95%) y, si otro cruce
#     también difiere, la línea «También». Hasta 8 hallazgos y 4 capítulos por lámina; con más, otra lámina, y un
#     capítulo nunca se parte.
#   - `titulares` (V3): un hallazgo por capítulo con el titular que escribe el analista, todo en una lámina.
#
# Cada cifra se calcula con `.halla_kpi_modelo` (graficos_hallazgos.R): el mismo indicador por caso que la lámina de su
# pregunta, el intervalo con el diseño del estudio y la comparación automática de las tarjetas. Aquí sólo se eligen,
# agrupan y paginan.
#
# Selección automática (`seleccion = "auto"`): por capítulo del plan, entre las filas candidatas del resumen de
# diferencias (`.resumen_dif_candidatas`, sin NS/NR, sin la segunda opción de una dicotómica y sin «Otros»), la
# diferencia más fuerte (99% primero y luego el tamaño) y la cifra más rotunda sin diferencia (mayor |p − 50| entre las
# preguntas de opción única y las escalas). Sin diferencias, las dos más rotundas. De una pregunta de opción única sólo
# compite por rotunda su opción mayoritaria: la menor de sus opciones («1% asiste a menos del 20% de sus clases») queda
# lejos de 50 y no es un hallazgo (render real sobre CCSS, 2026-11-04).

.HALLAZGOS_MODOS_RESUMEN <- c("resumen", "titulares")
.HALLAZGOS_RESUMEN_TOPES <- list(por_lamina = 8L, capitulos = 4L, por_capitulo = 3L, auto_por_capitulo = 2L)

#' Aviso del resumen en manual sin capítulos completos: en lenguaje de analista, sin nombres de argumentos (H3 de usabilidad)
#' @keywords internal
.HALLAZGOS_SIN_CAPITULOS <- "escribe al menos un capítulo con un hallazgo completo, o elige que los proponga el motor."

#' Entero positivo de un tope del payload, o el de fábrica
#' @keywords internal
.halla_res_tope <- function(x, defecto, maximo = defecto) {
  v <- suppressWarnings(as.integer(unlist(x))[1])
  if (is.na(v) || v < 1L) defecto else min(v, maximo)
}

#' Textos que ya escribió el analista en el resumen de diferencias del plan, por variable y fila
#' @return Vector con nombres «var|fila» (o «var|top2box»).
#' @keywords internal
.halla_res_textos_del_plan <- function(plan) {
  out <- character(0)
  for (s in plan %||% list()) {
    el <- (s$slots %||% list())$plot
    if (!inherits(el, "ppt_element") || !identical(el$.element_type, "resumen_diferencias")) next
    for (c in el$capitulos %||% list()) for (f in c$filas %||% list()) {
      it <- .dif_item(f)
      if (is.null(it$rotulo) || is.na(it$var)) next
      out[paste(it$var, it$fila %||% paste(it$top2box, collapse = "+"), sep = "|")] <- it$rotulo
    }
  }
  out
}

#' Un rótulo de fila como frase que se lee tras la cifra: primera letra en minúscula, sin la base entre paréntesis
#' @keywords internal
.halla_res_frase <- function(rotulo) {
  r <- sub("\\s*\\(base:[^)]*\\)\\s*$", "", rotulo)
  if (grepl("^[[:upper:]][[:lower:]]", r)) r <- paste0(tolower(substr(r, 1, 1)), substring(r, 2))
  r
}

#' Selección automática: por capítulo del plan, la diferencia más fuerte y la cifra más rotunda sin diferencia
#' @return Lista de capítulos `list(titulo, titular = NULL, cifras)` con las cifras en el formato del payload.
#' @keywords internal
.halla_res_auto <- function(fuente, sig, cx, tauto, plan, por_cap) {
  aviso <- function(...) .dif_aviso("Resumen ejecutivo", ...)
  regla <- sig$regla
  textos <- .halla_res_textos_del_plan(plan)
  cands <- unlist(lapply(.resumen_dif_preguntas_plan(plan), function(q) .resumen_dif_candidatas(fuente, q, regla)), recursive = FALSE)
  vistos <- list()
  for (cd in cands) {
    if (!is.null(cd$fila) && grepl(.CATEGORIAS_RESIDUALES, cd$fila, ignore.case = TRUE)) next
    it <- .dif_item(cd)
    fi <- .dif_indicador(fuente, it, regla)
    if (!is.null(fi$excluir) || !is.finite(fi$total)) next
    ev <- .dif_evaluar(fuente, fi, cx$cruces, sig, tauto)
    clave <- paste(it$var, it$fila %||% paste(it$top2box, collapse = "+"), sep = "|")
    vistos[[length(vistos) + 1L]] <- list(capitulo = cd$capitulo %||% "", var = fi$var, item = it, fi = fi, fuerza = .dif_fuerza(ev$celdas),
                                          rotunda = abs(fi$total - 50), opcion_unica = !identical(fi$tipo, "multiple"),
                                          texto = textos[clave] %||% NA_character_)
  }
  # La opción mayoritaria de cada pregunta: la única que compite por la cifra rotunda.
  mayor <- tapply(vapply(vistos, function(x) x$fi$total, 0), vapply(vistos, `[[`, "", "var"), max)
  for (i in seq_along(vistos)) vistos[[i]]$mayoritaria <- vistos[[i]]$fi$total >= mayor[[vistos[[i]]$var]] - 1e-9
  caps <- unique(vapply(vistos, `[[`, "", "capitulo"))
  out <- lapply(caps, function(cp) {
    v <- Filter(function(x) identical(x$capitulo, cp), vistos)
    dif <- Filter(function(x) x$fuerza[["tam"]] > 0, v)
    dif <- dif[order(-vapply(dif, function(x) x$fuerza[["firme"]], 0), -vapply(dif, function(x) x$fuerza[["tam"]], 0))]
    sin <- Filter(function(x) x$fuerza[["tam"]] <= 0 && x$opcion_unica && x$mayoritaria, v)
    sin <- sin[order(-vapply(sin, `[[`, 0, "rotunda"))]
    elegidas <- c(utils::head(dif, 1L), utils::head(sin, if (length(dif)) 1L else 2L))
    if (length(elegidas) < por_cap) elegidas <- c(elegidas, utils::head(dif[-1], por_cap - length(elegidas)))
    elegidas <- utils::head(elegidas, por_cap)
    cifras <- lapply(elegidas, function(x) list(var = x$item$ref %||% x$item$var, fila = x$item$fila, top2box = x$item$top2box,
                                                 texto = if (is.na(x$texto)) NULL else .halla_res_frase(x$texto), comparacion = "auto"))
    list(titulo = cp, titular = NULL, cifras = cifras)
  })
  out <- Filter(function(c) length(c$cifras) > 0L, out)
  if (length(out)) {
    aviso(sprintf("el motor propone %d hallazgos en %d capítulos: por capítulo, la diferencia más fuerte y la cifra más rotunda sin diferencia. Para cambiarlos, elige «Los escribo yo» en Selección de hallazgos.",
                  sum(vapply(out, function(c) length(c$cifras), 0L)), length(out)))
  } else aviso("el informe no tiene preguntas que resumir.")
  out
}

#' Reparte los capítulos en láminas: hasta `por_lamina` hallazgos y `max_caps` capítulos, sin partir un capítulo
#' @return Lista de láminas, cada una una lista de capítulos.
#' @keywords internal
.halla_res_paginar <- function(capitulos, por_lamina, max_caps) {
  paginas <- list(); actual <- list(); filas <- 0L
  for (c in capitulos) {
    n <- length(c$kpis)
    if (length(actual) && (filas + n > por_lamina || length(actual) >= max_caps)) {
      paginas[[length(paginas) + 1L]] <- actual; actual <- list(); filas <- 0L
    }
    actual[[length(actual) + 1L]] <- c; filas <- filas + n
  }
  if (length(actual)) paginas[[length(paginas) + 1L]] <- actual
  paginas
}

#' Nota fija del resumen: qué es la cifra y su intervalo, y la remisión a «Cómo leer las diferencias entre grupos»
#' @keywords internal
.halla_res_nota <- function(regla) {
  disenio <- if (!is.null(regla$conglomerado) && nzchar(regla$conglomerado %||% "")) sprintf("calculado con el diseño por %s", .sig_nombre_conglomerado(regla$conglomerado)) else
    "calculado como muestreo aleatorio simple"
  paste0(sprintf("Cada cifra es un porcentaje sobre la base de la lámina, salvo que la fila indique otra, con su intervalo de 95%% %s. ", disenio),
         "La diferencia es la del grupo que más se aleja del resto, con la regla descrita en «Cómo leer las diferencias entre grupos».")
}

#' Modelo del resumen ejecutivo (modos «resumen» y «titulares»)
#' @return Espec `tipo = "hallazgos"` con `paginas` (cada una, sus capítulos con sus `kpis`) y `kpis` aplanados.
#' @keywords internal
.halla_resumen_modelo <- function(el, fuente, sig, plan = list()) {
  aviso <- function(...) .dif_aviso("Resumen ejecutivo", ...)
  modo <- .dif_chr1(el$modo)
  titulares <- identical(modo, "titulares")
  cx <- .dif_cruces(el, plan, sig, fuente)
  tauto <- el$tautologicos %||% list()
  T <- .HALLAZGOS_RESUMEN_TOPES
  por_lamina <- .halla_res_tope(el$max_por_lamina, T$por_lamina)
  por_cap <- if (titulares) 1L else .halla_res_tope(el$max_por_capitulo, if (identical(.dif_chr1(el$seleccion), "auto")) T$auto_por_capitulo else T$por_capitulo, T$por_capitulo)
  n_lamina <- nrow(fuente$data)
  caps <- if (identical(.dif_chr1(el$seleccion), "auto")) .halla_res_auto(fuente, sig, cx, tauto, plan, por_cap) else el$capitulos %||% list()
  capitulos <- list()
  for (c in caps) {
    c <- as.list(c)
    titulo <- .dif_chr1(c$titulo) %||% ""
    items <- lapply(c$cifras %||% list(), .halla_kpi_item)
    if (length(items) > por_cap) {
      aviso(sprintf("el capítulo «%s» tiene %d hallazgos y el tope es %d; se dibujan los primeros.", titulo, length(items), por_cap))
      items <- items[seq_len(por_cap)]
    }
    if (length(items) > por_lamina) items <- items[seq_len(por_lamina)]
    kpis <- Filter(Negate(is.null), lapply(items, .halla_kpi_modelo, fuente0 = fuente, sig = sig, cx = cx, tauto = tauto,
                                            n_lamina = n_lamina, con_grafico = FALSE))
    if (!isTRUE(el$tambien %||% TRUE)) kpis <- lapply(kpis, function(k) { k$tambien <- NULL; k })
    titular <- .dif_chr1(c$titular)
    if (titulares && length(kpis) && is.null(titular)) {
      aviso("el capítulo «", titulo, "» no tiene titular: el modo «titulares» lo pide, y el motor no lo redacta. Va la frase del hallazgo.")
    }
    if (length(kpis)) capitulos[[length(capitulos) + 1L]] <- list(titulo = titulo, titular = titular, kpis = kpis)
  }
  if (!length(capitulos)) aviso(.HALLAZGOS_SIN_CAPITULOS)
  paginas <- if (titulares) .halla_res_paginar(capitulos, por_lamina, por_lamina) else .halla_res_paginar(capitulos, por_lamina, T$capitulos)
  list(tipo = "hallazgos", modo = modo, paginas = paginas, kpis = unlist(lapply(capitulos, `[[`, "kpis"), recursive = FALSE),
       titulos = .dif_chr(el$titulos), regla = sig$regla, m = sig$m %||% NA_integer_, n = n_lamina, publico = cx$publico,
       nota = .halla_res_nota(sig$regla))
}
