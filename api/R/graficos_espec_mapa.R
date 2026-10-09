# =============================================================================
# graficos_espec_mapa.R — lo que afirma un mapa de cobertura (ADR 0093, N6)
# =============================================================================
#
# Los mapas del recetario (recetario_m3e.R:117-270) muestran resultados del
# operativo con dos azules y un gris, no con los colores de estado de antes:
#
# - distrito (láminas 105 y 106): las zonas del distrito, la que tuvo cobertura
#   efectiva en azul fuerte, la que estuvo en la ruta en azul medio y el resto en
#   blanco con borde gris; al lado, la cifra de zonas efectivas;
# - vista general (lámina 103): Lima de contexto en gris, los distritos del
#   estudio pintados enteros por grupo y, al lado, su lista con las zonas
#   efectivas de cada uno.
#
# La espec la arma `graficar_mapa_cobertura_territorial()` con el contexto que ya
# recibe (`.graficos_coverage_map_context`); la lámina la lee y no recalcula.

.MAPA_ROTULOS_ZONA <- c(efectiva = "Zona con cobertura efectiva", intervencion = "Zona en la ruta", comparacion = "Zona de comparación",
                        alerta = "Zona con alerta", no_intervenido = "Zona fuera de la ruta")
.MAPA_GRUPOS <- c(intervencion = "Distritos de intervención", comparacion = "Distritos de comparación")

#' Color del recetario para cada estado de zona
#' @keywords internal
.mapa_color_estado <- function(estado) {
  unname(c(efectiva = .std_color("mapa_aplicada"), intervencion = .std_color("mapa_medio"), comparacion = .std_color("mapa_medio"),
           alerta = .std_color("coral"), no_intervenido = "#FFFFFF")[estado])
}

#' Recorta los polígonos a la caja, como `st_crop` en el recetario
#'
#' Los que caen enteros dentro quedan tal cual, los de afuera se descartan y los que cruzan el borde se cortan con
#' `sf`. Sin recorte, el dispositivo de `rvg` corta él mismo los polígonos de Lima que salen de la caja y revienta en
#' C_polygon. Se descartan también los anillos sin área: un polígono degenerado es lo que tumba a `rvg`.
#' @keywords internal
.mapa_recortar <- function(df, caja) {
  if (!nrow(df)) return(df)
  grupos <- split(df, df$group)
  bb <- lapply(grupos, function(g) c(min(g$x), max(g$x), min(g$y), max(g$y)))
  fuera <- vapply(bb, function(b) b[2] < caja[["xmin"]] || b[1] > caja[["xmax"]] || b[4] < caja[["ymin"]] || b[3] > caja[["ymax"]], TRUE)
  dentro <- vapply(bb, function(b) b[1] >= caja[["xmin"]] && b[2] <= caja[["xmax"]] && b[3] >= caja[["ymin"]] && b[4] <= caja[["ymax"]], TRUE)
  out <- grupos[dentro & !fuera]
  for (k in names(grupos)[!dentro & !fuera]) {
    g <- grupos[[k]]; m <- as.matrix(g[, c("x", "y")]); m <- rbind(m, m[1, ])
    pol <- tryCatch(sf::st_make_valid(sf::st_sfc(sf::st_polygon(list(m)))), error = function(e) NULL)
    if (is.null(pol)) next
    cr <- tryCatch(suppressWarnings(sf::st_crop(pol, sf::st_bbox(unlist(caja[c("xmin", "ymin", "xmax", "ymax")])))), error = function(e) NULL)
    if (is.null(cr) || !length(cr) || all(sf::st_is_empty(cr))) next
    cr <- tryCatch(sf::st_collection_extract(cr, "POLYGON"), error = function(e) cr)
    co <- tryCatch(sf::st_coordinates(sf::st_cast(cr, "POLYGON")), error = function(e) NULL)
    if (is.null(co) || !nrow(co)) next
    co <- co[co[, "L1"] == 1, , drop = FALSE]
    for (pid in unique(co[, "L2"])) {
      cc <- co[co[, "L2"] == pid, , drop = FALSE]
      nuevo <- g[rep(1L, nrow(cc)), , drop = FALSE]; nuevo$x <- cc[, "X"]; nuevo$y <- cc[, "Y"]; nuevo$group <- paste0(k, "~", pid)
      out[[paste0(k, "~", pid)]] <- nuevo
    }
  }
  area <- function(g) abs(sum(g$x * c(g$y[-1], g$y[1]) - c(g$x[-1], g$x[1]) * g$y)) / 2
  out <- out[vapply(out, function(g) nrow(g) >= 3L && area(g) > 1e-12, TRUE)]
  if (!length(out)) return(df[0, , drop = FALSE])
  res <- do.call(rbind, out); rownames(res) <- NULL; res
}

#' Especificación de un mapa de cobertura
#'
#' @param contexto El contexto del mapa (zonas, límites, rótulos y resumen por distrito).
#' @return Lista `mapa/1` con `forma` («distrito» o «general»), `capas` (polígonos con su relleno), `caja` (lon/lat),
#'   `leyenda`, y `cifra` (distrito) o `grupos` (general); `NULL` si no hay geometría.
#' @keywords internal
.espec_mapa <- function(contexto) {
  if (!is.list(contexto)) return(NULL)
  scope <- .mapa_chr1(contexto$scope, "district")
  resumen <- .mapa_context_summary(contexto)
  num <- function(x) { v <- suppressWarnings(as.numeric(x)); v[!is.finite(v)] <- 0; v }
  caja_de <- function(df, m = 0) {
    dx <- diff(range(df$x)) * m; dy <- diff(range(df$y)) * m
    c(xmin = min(df$x) - dx, xmax = max(df$x) + dx, ymin = min(df$y) - dy, ymax = max(df$y) + dy)
  }
  if (identical(scope, "overview_koica")) {
    lima <- .mapa_collection_polygons(contexto$lima_boundary %||% list(), contexto)
    if (!nrow(lima) || !nrow(resumen) || !all(c("ubigeo", "grupo") %in% names(resumen))) return(NULL)
    grupo_de <- stats::setNames(as.character(resumen$grupo), as.character(resumen$ubigeo))
    g <- grupo_de[as.character(lima$ubigeo)]
    lima$fill <- ifelse(is.na(g), .std_color("mapa_fuera"), ifelse(g == "intervencion", .std_color("mapa_aplicada"), .std_color("mapa_medio")))
    estudio <- lima[!is.na(g), , drop = FALSE]
    if (!nrow(estudio)) return(NULL)
    grupos <- lapply(intersect(names(.MAPA_GRUPOS), unique(as.character(resumen$grupo))), function(k) {
      r <- resumen[as.character(resumen$grupo) == k, , drop = FALSE]
      v <- num(r$zonas_efectivas %||% rep(NA, nrow(r)))
      list(clave = k, titulo = .MAPA_GRUPOS[[k]], color = if (k == "intervencion") .std_color("mapa_aplicada") else .std_color("mapa_medio"),
           filas = data.frame(distrito = as.character(r$distrito), valor = v, stringsAsFactors = FALSE), total = sum(v))
    })
    caja <- caja_de(estudio, 0.1)
    return(list(version = "mapa/1", tipo = "mapa", forma = "general",
                capas = list(list(datos = .mapa_recortar(lima, caja), borde = "#FFFFFF", grosor = 0.4)),
                caja = caja, encabezado = "Zonas efectivas", grupos = grupos,
                leyenda = list(titulo = "En el mapa", rotulos = "Fuera del estudio", colores = .std_color("mapa_fuera"))))
  }
  poly <- .mapa_context_polygons(contexto)
  if (!nrow(poly)) return(NULL)
  estado <- names(.mapa_status_labels)[match(as.character(poly$status), .mapa_status_labels)]
  estado[is.na(estado)] <- "no_intervenido"
  poly$fill <- .mapa_color_estado(estado)
  orden <- intersect(c("efectiva", "intervencion", "comparacion", "alerta", "no_intervenido"), unique(estado))
  zonas <- unique(data.frame(zona = poly$zona, ubigeo = poly$ubigeo, estado = estado, stringsAsFactors = FALSE))
  efectivas <- if (nrow(resumen) && "zonas_efectivas" %in% names(resumen)) sum(num(resumen$zonas_efectivas)) else sum(zonas$estado == "efectiva")
  ruta <- if (nrow(resumen) && "zonas_ruta" %in% names(resumen)) sum(num(resumen$zonas_ruta)) else sum(zonas$estado %in% c("efectiva", "intervencion"))
  list(version = "mapa/1", tipo = "mapa", forma = "distrito",
       capas = list(list(datos = .mapa_recortar(poly, caja_de(poly, 0.02)), borde = .std_color("mapa_borde"), grosor = 0.15)),
       caja = caja_de(poly, 0.02),
       cifra = list(valor = format(efectivas, big.mark = ","), rotulo = if (efectivas == 1) "zona con cobertura efectiva" else "zonas con cobertura efectiva",
                    detalle = if (ruta > 0) sprintf("de %s zonas en la ruta", format(ruta, big.mark = ",")) else sprintf("de %d zonas del distrito", nrow(zonas))),
       leyenda = list(titulo = "Zonas", rotulos = unname(.MAPA_ROTULOS_ZONA[orden]), colores = .mapa_color_estado(orden)))
}
