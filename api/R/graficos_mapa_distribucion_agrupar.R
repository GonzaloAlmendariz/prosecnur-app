# =============================================================================
# graficos_mapa_distribucion_agrupar.R — la lista del mapa de distribución con una fila por grupo de preguntas
# =============================================================================
#
# CCSS Perfil 2026 (Facultad, 2026-11-05): la lámina de residencia lee A6_1 (distritos de Lima) y junta A6_2 (distritos
# del Callao). La lista tiene una fila por área del mapa, así que decía «Callao 12» (sólo el distrito Callao) y los otros
# nueve residentes del Callao (Bellavista, Ventanilla, La Perla, Carmen de La Legua) caían en «Otros distritos», aunque la
# barra de la izquierda dijera «Callao 21». `agrupar_lista = list(Callao = "A6_2")` suma en la LISTA todas las áreas de las
# preguntas nombradas en una sola fila con ese rótulo.
#
# Invariantes: el mapa no cambia (áreas, colores, clases, leyenda); la fila agrupada se ordena con las demás por su valor;
# la lista y la fila «otros» siguen repartiendo exactamente las mismas respuestas, así que la base, el total y los
# porcentajes cuadran. Sin el argumento la espec sale tal cual.

#' Grupos de la lista: rótulo y preguntas
#'
#' Acepta una lista con nombres (`list(Callao = "A6_2")`, lo que guarda el plan) o texto, una línea por grupo:
#' «Rótulo | pregunta, pregunta» (lo que escribe el editor).
#' @return Lista con nombres (el rótulo) de vectores de preguntas; lista vacía si no hay grupos.
#' @keywords internal
.mapa_dist_agrupar_normalizar <- function(x) {
  if (is.null(x) || !length(x)) return(list())
  limpiar <- function(v) { v <- trimws(as.character(unlist(v %||% character(0)))); v[!is.na(v) & nzchar(v)] }
  if (is.character(x) && is.null(names(x))) {
    lineas <- trimws(unlist(strsplit(x, "\n", fixed = TRUE))); lineas <- lineas[!is.na(lineas) & nzchar(lineas)]
    if (!length(lineas)) return(list())
    partes <- strsplit(lineas, "|", fixed = TRUE)
    if (any(lengths(partes) != 2L)) {
      .plan_spec_abort("p_mapa_distribucion(): cada línea de `agrupar_lista` va como «Rótulo | preguntas» (ej. «Callao | A6_2»).")
    }
    g <- lapply(partes, function(p) limpiar(strsplit(p[2], ",", fixed = TRUE)[[1]]))
    names(g) <- trimws(vapply(partes, `[[`, "", 1L))
  } else {
    if (!is.list(x) && !is.character(x)) .plan_spec_abort("p_mapa_distribucion(): `agrupar_lista` debe ser una lista con nombres.")
    nm <- names(x)
    if (is.null(nm) || any(is.na(nm)) || any(!nzchar(trimws(nm)))) {
      .plan_spec_abort("p_mapa_distribucion(): cada grupo de `agrupar_lista` lleva su rótulo (ej. `list(Callao = \"A6_2\")`).")
    }
    g <- lapply(as.list(x), limpiar); names(g) <- trimws(nm)
  }
  if (any(!nzchar(names(g)))) .plan_spec_abort("p_mapa_distribucion(): cada grupo de `agrupar_lista` lleva su rótulo.")
  if (anyDuplicated(names(g))) .plan_spec_abort("p_mapa_distribucion(): dos grupos de `agrupar_lista` tienen el mismo rótulo.")
  if (any(lengths(g) == 0L)) .plan_spec_abort("p_mapa_distribucion(): el grupo «", names(g)[lengths(g) == 0L][1], "» de `agrupar_lista` no nombra preguntas.")
  todas <- unlist(lapply(g, function(v) vapply(v, function(r) .graficos_ref_parts(r)$name, "", USE.NAMES = FALSE)))
  if (anyDuplicated(todas)) .plan_spec_abort("p_mapa_distribucion(): la pregunta `", todas[duplicated(todas)][1], "` está en dos grupos de `agrupar_lista`.")
  g
}

#' ¿Las preguntas de los grupos son las que el mapa lee (`var` o `juntar`)?
#' @keywords internal
.mapa_dist_agrupar_validar <- function(grupos, var, juntar = NULL) {
  if (!length(grupos)) return(invisible(TRUE))
  nombre <- function(v) vapply(as.character(v), function(r) .graficos_ref_parts(r)$name, "", USE.NAMES = FALSE)
  leidas <- nombre(c(var, juntar))
  fuera <- setdiff(nombre(unlist(grupos)), leidas)
  if (length(fuera)) {
    .plan_spec_abort("p_mapa_distribucion(): `agrupar_lista` sólo agrupa preguntas que el mapa lee (`var` o `juntar`); `",
                     fuera[1], "` no es una de ellas.")
  }
  invisible(TRUE)
}

#' La lista del mapa con los grupos de `agrupar_lista`
#'
#' Cada respuesta casada con un área (y fuera de las áreas de otra respuesta) va a la fila de su grupo si su pregunta está
#' en uno, o a la fila de su área si no. Las filas de área que no cambian conservan su color; la fila de un grupo y la de
#' un área que perdió respuestas toman el color de la clase de su valor. El mapa, la base y la fila «otros» no se tocan.
#' @param espec Salida de `.espec_mapa_distribucion()`. @param filas Las filas que la armaron, con la columna `.var` (la
#'   pregunta de cada fila). @param grupos Salida de `.mapa_dist_agrupar_normalizar()`.
#' @return `espec` con `lista`, `ranking` y `lista_grupos` nuevos; sin grupos, `espec` tal cual.
#' @keywords internal
.mapa_dist_agrupar_lista <- function(espec, filas, grupos) {
  if (is.null(espec) || !length(grupos) || !".var" %in% names(filas)) return(espec)
  a <- espec$areas; base <- espec$base; tasa <- identical(espec$medida, "tasa")
  nombre <- function(v) vapply(as.character(v), function(r) .graficos_ref_parts(r)$name, "", USE.NAMES = FALSE)
  grupo_de <- rep(NA_character_, nrow(filas))
  for (g in names(grupos)) grupo_de[nombre(filas$.var) %in% nombre(grupos[[g]])] <- g
  casada <- !is.na(filas$clave) & !(filas$clave %in% (espec$otra %||% character(0))) & filas$n > 0
  clase_color <- function(valor) {
    k <- findInterval(valor, espec$clases$cortes) + 1L
    ifelse(is.finite(valor) & valor > 0, espec$clases$colores[pmin(length(espec$clases$colores), pmax(1L, k))], .MAPA_DIST()$vacio)
  }
  # Las áreas, con lo que les queda fuera de los grupos.
  sueltas <- casada & is.na(grupo_de)
  n_area <- tapply(filas$n[sueltas], filas$clave[sueltas], sum)
  con <- a[a$clave %in% names(n_area), , drop = FALSE]
  con$n_lista <- as.integer(n_area[con$clave])
  con <- con[con$n_lista > 0, , drop = FALSE]
  con$tasa_lista <- ifelse(is.finite(con$pob) & con$pob > 0, 1e4 * con$n_lista / con$pob, NA_real_)
  igual <- con$n_lista == con$n
  con$color_lista <- ifelse(igual, con$color, clase_color(if (tasa) con$tasa_lista else con$n_lista))
  areas <- data.frame(nombre = con$nombre, n = con$n_lista, tasa = con$tasa_lista, color = con$color_lista, stringsAsFactors = FALSE)
  # Una fila por grupo: suma todas sus áreas; la tasa usa la población de esas áreas.
  filas_g <- do.call(rbind, lapply(names(grupos), function(g) {
    en <- casada & grupo_de %in% g
    n <- sum(filas$n[en]); if (n <= 0) return(NULL)
    pob <- sum(a$pob[a$clave %in% unique(filas$clave[en])], na.rm = TRUE)
    t <- if (pob > 0) 1e4 * n / pob else NA_real_
    data.frame(nombre = g, n = as.integer(n), tasa = t, color = clase_color(if (tasa) t else n), stringsAsFactors = FALSE)
  }))
  todo <- rbind(areas, filas_g %||% areas[0, , drop = FALSE])
  valor <- if (tasa) todo$tasa else todo$n
  todo <- todo[order(-valor, -todo$n, todo$nombre), , drop = FALSE]
  lista <- data.frame(nombre = todo$nombre, n = todo$n, valor = if (tasa) .mapa_dist_num(todo$tasa) else as.character(todo$n),
                      pct = .mapa_dist_pct(todo$n, base), color = todo$color, stringsAsFactors = FALSE)
  rownames(lista) <- NULL
  rk <- utils::head(lista, 14L)
  espec$lista <- lista
  espec$ranking <- data.frame(nombre = rk$nombre, barra = if (nrow(rk)) rk$n / max(c(1e-9, rk$n)) else numeric(0), color = rk$color,
                              valor = rk$valor, detalle = if (nrow(rk)) paste0("(", rk$pct, ")") else character(0), stringsAsFactors = FALSE)
  espec$lista_grupos <- grupos
  espec
}
