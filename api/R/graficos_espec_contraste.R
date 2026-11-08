# =============================================================================
# graficos_espec_contraste.R — lo que afirma el contraste de públicos (ADR 0134)
# =============================================================================
#
# El estilo «resumen» del dumbbell (`graficar_dumbbell(estilo = "resumen")`) nació en el resumen ejecutivo de
# Formación General de Arte y Diseño 2026: Top Two Box de la misma pregunta en dos públicos (o en los grupos de un
# público), un punto por grupo con su FORMA propia —se distinguen impresos en blanco y negro—, la cifra junto a cada
# punto, filas en bandas alternas y, fuera del área del gráfico, una tabla con la «Diferencia» y la «Base» de cada
# grupo en `n (cobertura %)`.
#
# Reglas que esta especificación fija y ningún renderer recalcula:
#   - Con dos grupos la diferencia es el primero menos el segundo, restando las cifras ya rotuladas (la regla del
#     dumbbell, ADR 0093 punto 2); con tres o más es la distancia entre el mayor y el menor, sin signo.
#   - La base de cada celda son los casos sin ponderar de esa pregunta en ese grupo. Con el padrón del grupo
#     (`universos`) se escribe «115 (93%)»; sin padrón, o con un padrón que no lo cubre, sólo «115»: no se inventa
#     una cobertura (el padrón de un subgrupo suele no ser confiable y entonces no se declara).
#   - Los separadores (`separar_tras`) cuentan filas en el orden declarado y obligan ese orden: un separador entre
#     «competencias de salida» y «genéricas» no sobrevive a un reordenamiento por brecha.
#   - Formas en el orden círculo, cuadrado, triángulo, rombo; colores del público por su nombre (paleta `actores`)
#     y, si el grupo no es un público con color propio, la paleta `grupos` del estándar.

.CONTRASTE_FORMAS <- c("ellipse", "rect", "triangle", "diamond")

#' Formas de los grupos, en su orden
#' @keywords internal
.contraste_formas <- function(k) rep_len(.CONTRASTE_FORMAS, k)

#' Colores de los grupos: el del público por su nombre si todos lo tienen; si no, la paleta `grupos`
#' @keywords internal
.contraste_colores <- function(grupos, colores = NULL) {
  k <- length(grupos)
  if (length(colores) >= k) {
    if (!is.null(names(colores)) && all(grupos %in% names(colores))) return(unname(as.character(colores[grupos])))
    return(unname(as.character(colores))[seq_len(k)])
  }
  act <- .std_valor("ppt", "paletas", "actores")
  rot <- .contraste_clave(unlist(act$rotulos)); col <- unlist(act$colores)
  i <- match(.contraste_clave(grupos), rot)
  gr <- unname(.std_paleta("grupos"))
  if (anyNA(i)) return(rep_len(gr, k))
  # Cada público conserva su color; si dos quedan casi iguales (Docentes y Administrativos son dos azules), el segundo
  # toma el primer color de `grupos` que se distinga de los ya usados.
  out <- col[i]
  for (j in seq_len(k)[-1]) {
    if (.contraste_colores_cercanos(c(out[seq_len(j - 1L)], out[j]))) {
      libre <- Filter(function(c) !.contraste_colores_cercanos(c(out[seq_len(j - 1L)], c)), gr)
      out[j] <- if (length(libre)) libre[[1]] else gr[(j - 1L) %% length(gr) + 1L]
    }
  }
  out
}

#' Nombre comparable: sin mayúsculas, tildes ni espacios sobrantes
#' @keywords internal
.contraste_clave <- function(x) tolower(trimws(iconv(as.character(x), from = "UTF-8", to = "ASCII//TRANSLIT")))

#' ¿Dos colores de la lista son casi el mismo? (distancia RGB menor a 75 de 441: Docentes y Administrativos están a 68; Docentes y Estudiantes, a 84)
#' @keywords internal
.contraste_colores_cercanos <- function(cols) {
  if (length(cols) < 2L) return(FALSE)
  m <- grDevices::col2rgb(cols)
  d <- as.matrix(stats::dist(t(m)))
  any(d[upper.tri(d)] < 75)
}

#' Padrón por grupo desde una lista, un vector con nombres o un texto «Docentes: 123; Estudiantes: 327»
#'
#' @return Vector numérico con nombres (claves comparables) o `NULL`.
#' @keywords internal
.contraste_universos <- function(universos) {
  if (is.null(universos) || !length(universos)) return(NULL)
  if (is.character(universos) && length(universos) == 1L && is.null(names(universos))) {
    partes <- trimws(strsplit(universos, "[;\n]")[[1]]); partes <- partes[nzchar(partes)]
    if (!length(partes)) return(NULL)
    kv <- regmatches(partes, regexec("^(.+?)\\s*[:=]\\s*([0-9][0-9.,]*)\\s*$", partes))
    ok <- lengths(kv) == 3L
    if (!any(ok)) return(NULL)
    nm <- vapply(kv[ok], `[[`, "", 2L); v <- vapply(kv[ok], `[[`, "", 3L)
    universos <- stats::setNames(suppressWarnings(as.numeric(gsub("[.,]", "", v))), trimws(nm))
  }
  u <- unlist(universos)
  out <- suppressWarnings(as.numeric(u))
  names(out) <- .contraste_clave(names(u) %||% rep("", length(u)))
  out <- out[is.finite(out) & out > 0 & nzchar(names(out))]
  if (length(out)) out else NULL
}

#' Texto de la base de una celda: «115 (93%)» con padrón, «115» sin él
#' @keywords internal
.contraste_base_texto <- function(n, universo) {
  if (!is.finite(n)) return("—")
  if (!is.finite(universo) || universo <= 0 || n > universo) return(.dumbbell_fmt_casos(n))
  sprintf("%s (%s%%)", .dumbbell_fmt_casos(n), .pulso_fmt_half_up(100 * n / universo, 0L))
}

#' Base de un grupo en la nota: «115 (93%)» si es la misma en todas las filas; si no, su rango («107 a 115 (87% a 93%)»)
#'
#' La comparten el contraste, las fortalezas y alertas y la cobertura: la base de un público se escribe igual en todas
#' las láminas del resumen.
#' @param n Casos de cada fila (pregunta) del grupo.
#' @param universo Padrón del grupo (`NA` sin padrón).
#' @keywords internal
.contraste_base_grupo <- function(n, universo = NA_real_) {
  n <- n[is.finite(n)]
  if (!length(n)) return("—")
  if (length(unique(n)) == 1L) return(.contraste_base_texto(n[1], universo))
  rango <- sprintf("%s a %s", .dumbbell_fmt_casos(min(n)), .dumbbell_fmt_casos(max(n)))
  if (is.finite(universo) && max(n) <= universo) rango <- sprintf("%s (%s%% a %s%%)", rango, .pulso_fmt_half_up(100 * min(n) / universo, 0L),
                                                               .pulso_fmt_half_up(100 * max(n) / universo, 0L))
  rango
}

#' Eje de porcentaje acercado al rango, en decenas y sin pasar de 0 ni 100
#' @keywords internal
.contraste_eje <- function(valores, limite_x = NULL) {
  lim <- suppressWarnings(as.numeric(limite_x))
  if (length(lim) == 2L && all(is.finite(lim)) && lim[2] > lim[1]) return(c(lo = lim[1], hi = lim[2], paso = if (lim[2] - lim[1] <= 30) 5 else 10))
  v <- valores[is.finite(valores)]
  if (!length(v)) return(c(lo = 0, hi = 100, paso = 10))
  lo <- max(0, floor((min(v) - 4) / 10) * 10); hi <- min(100, ceiling((max(v) + 4) / 10) * 10)
  if (hi - lo < 30) { lo <- max(0, hi - 30); if (hi - lo < 30) hi <- min(100, lo + 30) }
  c(lo = lo, hi = hi, paso = 10)
}

#' Diferencia de cada tema entre sus grupos, sobre las cifras ya redondeadas (una fila por tema, una columna por grupo)
#'
#' Con dos grupos, el primero menos el segundo (con signo); con tres o más, el mayor menos el menor. La usan la
#' lámina del contraste y la regla de preguntas (graficos_regla_preguntas.R), que toma su valor absoluto.
#' @keywords internal
.contraste_diferencia <- function(R) {
  R <- as.matrix(R)
  if (ncol(R) == 2L) R[, 1] - R[, 2] else apply(R, 1, max) - apply(R, 1, min)
}

#' Quién menos quién, para el pie del contraste: lo escriben igual la lámina nativa y el respaldo ggplot
#' @keywords internal
.contraste_sentido_nota <- function(espec) {
  if (length(espec$grupos) == 2L) paste0("Diferencia: ", espec$sentido_diferencia, ", en puntos")
  else "Diferencia: el grupo mayor menos el menor, en puntos"
}

#' Especificación del contraste de públicos (`contraste/1`)
#'
#' @param data Data frame tidy con una fila por (tema, grupo).
#' @param var_eje,var_grupo,var_valor Columnas del tema, el grupo y el valor (0–100).
#' @param var_n_casos Columna con los casos sin ponderar de cada celda (opcional).
#' @param universos Padrón por grupo (ver `.contraste_universos`).
#' @param separar_tras Posiciones (en el orden declarado) tras las que va un separador.
#' @param orden `brecha` (con signo, ADR 0134), `brecha_absoluta` (sin signo, la mayor arriba: la regla «mayor
#'   diferencia», ADR 0135), `valor` (primer grupo) o `declarado`.
#' @return Lista `contraste/1`.
#' @keywords internal
.espec_contraste <- function(data, var_eje = "eje", var_grupo = "grupo", var_valor = "valor", var_n_casos = "n_casos",
                             universos = NULL, separar_tras = NULL, orden = c("brecha", "valor", "declarado", "brecha_absoluta"),
                             decimales = 0L, colores = NULL, encabezado_diferencia = "Diferencia", limite_x = NULL,
                             titulo_eje = NULL, base_en = c("auto", "tabla", "leyenda", "nota")) {
  orden <- match.arg(orden)
  base_en <- match.arg(base_en)
  for (col in c(var_eje, var_grupo, var_valor)) {
    if (!col %in% names(data)) stop("La columna `", col, "` no existe en `data`.", call. = FALSE)
  }
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0L) dec <- 0L
  eje <- as.character(data[[var_eje]]); grp <- as.character(data[[var_grupo]])
  temas <- if (is.factor(data[[var_eje]])) intersect(levels(data[[var_eje]]), unique(eje)) else unique(eje)
  temas <- temas[!is.na(temas) & nzchar(trimws(temas))]
  grupos <- if (is.factor(data[[var_grupo]])) intersect(levels(data[[var_grupo]]), unique(grp)) else unique(grp)
  grupos <- grupos[!is.na(grupos) & nzchar(grupos)]
  k <- length(grupos)
  if (k < 2L) stop("El contraste compara al menos dos grupos y llegó ", k, ".", call. = FALSE)
  if (!length(temas)) stop("El contraste no tiene temas que dibujar.", call. = FALSE)
  val <- suppressWarnings(as.numeric(data[[var_valor]]))
  cas <- if (!is.null(var_n_casos) && var_n_casos %in% names(data)) suppressWarnings(as.numeric(data[[var_n_casos]])) else rep(NA_real_, nrow(data))
  V <- matrix(NA_real_, length(temas), k); N <- matrix(NA_real_, length(temas), k)
  for (i in seq_along(temas)) for (j in seq_len(k)) {
    w <- which(eje == temas[i] & grp == grupos[j])
    if (length(w)) { V[i, j] <- val[w[1]]; N[i, j] <- cas[w[1]] }
  }
  # Un tema sin valor en algún grupo no tiene contraste: sale, no se rellena con cero.
  completo <- rowSums(is.finite(V)) == k
  if (!any(completo)) stop("Ningún tema tiene valor en todos los grupos: no hay contraste que dibujar.", call. = FALSE)
  temas <- temas[completo]; V <- V[completo, , drop = FALSE]; N <- N[completo, , drop = FALSE]
  R <- matrix(.pulso_round_half_up(V, dec), nrow(V))
  dif <- .contraste_diferencia(R)
  # Los separadores se declaran en el orden de entrada y lo fijan.
  sep <- suppressWarnings(as.integer(unlist(separar_tras)))
  sep <- sort(unique(sep[is.finite(sep) & sep >= 1L & sep < length(temas)]))
  if (length(sep)) orden <- "declarado"
  o <- switch(orden,
              brecha = order(-dif, seq_along(dif)),
              brecha_absoluta = order(-abs(dif), seq_along(dif)),
              valor = order(-V[, 1], seq_along(dif)),
              seq_along(dif))
  u <- .contraste_universos(universos)
  uni <- if (is.null(u)) rep(NA_real_, k) else unname(u[.contraste_clave(grupos)])
  B <- matrix(vapply(seq_len(length(temas) * k), function(z) {
    i <- (z - 1L) %% length(temas) + 1L; j <- (z - 1L) %/% length(temas) + 1L
    .contraste_base_texto(N[i, j], uni[j])
  }, ""), length(temas), k)
  cif <- matrix(.pulso_fmt_half_up(V, dec), nrow(V))
  # Dónde va la base. Gonzalo, 2026-11-07: «a veces es mejor poner el N en la leyenda con porcentaje o en la nota de
  # la base» y luego «la base podría ir en la esquina inferior izquierda, como ya iba antes; ya no es necesario hacer
  # columnas adicionales para bases, simplemente para diferencia». Por defecto va al pie; si cambia de fila a fila,
  # el pie da su rango («Docentes 107 a 115»). La leyenda y las columnas quedan como opción explícita.
  constante <- all(vapply(seq_len(k), function(j) length(unique(B[, j])) == 1L, TRUE))
  if (identical(base_en, "auto")) base_en <- "nota"
  if (!constante && identical(base_en, "leyenda")) base_en <- "nota"
  base_grupo <- vapply(seq_len(k), function(j) .contraste_base_grupo(N[, j], uni[j]), "")
  leyenda <- if (identical(base_en, "leyenda")) sprintf("%s (n = %s)", grupos, sub(" \\((.*)\\)$", ", \\1", base_grupo)) else grupos
  nota_base <- if (identical(base_en, "nota")) paste0("Base: ", paste(sprintf("%s %s", grupos, base_grupo), collapse = "; ")) else NULL
  colores_g <- .contraste_colores(grupos, colores)
  list(
    version = "contraste/1", tipo = "contraste",
    rotulos = temas[o], grupos = grupos, colores = colores_g, colores_cifra = .dumbbell_colores_cifra(colores_g),
    formas = .contraste_formas(k),
    valores = V[o, , drop = FALSE], cifras = cif[o, , drop = FALSE],
    diferencia = dif[o],
    textos_diferencia = if (k == 2L) paste0(ifelse(dif[o] > 0, "+", ""), .pulso_fmt_half_up(dif[o], dec)) else .pulso_fmt_half_up(dif[o], dec),
    encabezado_diferencia = encabezado_diferencia %||% "Diferencia",
    sentido_diferencia = if (k == 2L) .dumbbell_sentido(grupos[1], grupos[2]) else "mayor − menor",
    casos = N[o, , drop = FALSE], bases = B[o, , drop = FALSE], con_cobertura = is.finite(uni),
    base_en = base_en, leyenda = leyenda, nota_base = nota_base,
    separadores = sep, modo = if (k == 2L) "par" else "subfilas",
    eje = .contraste_eje(V, limite_x), titulo_eje = titulo_eje, decimales = dec
  )
}
