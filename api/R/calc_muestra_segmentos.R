# Segmentos y cuotas de un público en un estudio por correo o teléfono
# (barrido, ADR 0143). Fase 6 del rediseño de Cálculo de muestra (D7, D8).
#
# Un "cruce" es la población de un público contada por una o dos variables:
#   list(fila_variable, columna_variable, filas, columnas, conteos)
# con `conteos` una matriz filas x columnas (una sola columna "Total" si no
# hay segunda variable). Sale de una base por persona
# (calc_muestra_segmento_cruce) o de una tabla de conteos que envía el cliente
# (calc_muestra_conteos_leer). Sobre un cruce se arman grupos de celdas
# (calc_muestra_segmento_agrupar) y se reparte la meta (calc_muestra_cuotas_cruce):
# por celda, por la variable de las filas con la otra como control, o por celda
# con un mínimo sumado encima.
#
# Ninguna función descarta en silencio: un vacío es la categoría "Sin dato",
# una celda sin grupo se publica, y una fila o columna desconocida es un 400.

.CM_SEG_SIN_DATO <- "Sin dato"
.CM_SEG_UMBRAL_CHICA <- 10L

.cm_seg_categorias <- function(v) {
  v <- trimws(as.character(v))
  v[is.na(v) | !nzchar(v) | v %in% c("NA", "NULL")] <- .CM_SEG_SIN_DATO
  v
}

# Orden de categorías: de mayor a menor población, "Sin dato" al final.
.cm_seg_orden <- function(cats, pesos) {
  o <- order(cats == .CM_SEG_SIN_DATO, -pesos, cats, method = "radix")
  cats[o]
}

.cm_seg_columna <- function(df, col, que) {
  col <- calc_str(col, "")
  if (!nzchar(col) || !col %in% names(df)) {
    stop_api(400, "E_BAD_REQUEST", sprintf("La columna de %s \"%s\" no está en la base.", que, col))
  }
  col
}

.cm_seg_cruce <- function(fila_variable, columna_variable, filas, columnas, conteos) {
  conteos <- matrix(as.numeric(conteos), nrow = length(filas), ncol = length(columnas),
                    dimnames = list(filas, columnas))
  list(fila_variable = fila_variable, columna_variable = columna_variable,
       filas = filas, columnas = columnas, conteos = conteos, total = sum(conteos))
}

#' Cruce de una base por persona por una o dos columnas.
#'
#' @param df data.frame del marco (ya filtrado a quienes se invitan).
#' @param fila columna de las filas (por ejemplo, la facultad).
#' @param columna segunda columna opcional (por ejemplo, el sexo).
#' @return un cruce.
calc_muestra_segmento_cruce <- function(df, fila, columna = "") {
  fila <- .cm_seg_columna(df, fila, "filas")
  if (!nrow(df)) stop_api(400, "E_BAD_REQUEST", "No queda nadie a quien invitar: las reglas dejaron la base vacía.")
  vf <- .cm_seg_categorias(df[[fila]])
  columna <- calc_str(columna, "")
  if (!nzchar(columna)) {
    tab <- table(vf)
    filas <- .cm_seg_orden(names(tab), as.numeric(tab))
    return(.cm_seg_cruce(fila, "", filas, "Total", as.numeric(tab[filas])))
  }
  columna <- .cm_seg_columna(df, columna, "columnas")
  vc <- .cm_seg_categorias(df[[columna]])
  tf <- table(vf); tc <- table(vc)
  filas <- .cm_seg_orden(names(tf), as.numeric(tf))
  columnas <- .cm_seg_orden(names(tc), as.numeric(tc))
  tab <- table(factor(vf, levels = filas), factor(vc, levels = columnas))
  .cm_seg_cruce(fila, columna, filas, columnas, as.numeric(tab))
}

# ---------------------------------------------------------------------------
# Tabla de conteos
# ---------------------------------------------------------------------------

.cm_seg_num <- function(x) suppressWarnings(as.numeric(gsub(",", "", trimws(as.character(x)), fixed = TRUE)))

#' Lee una tabla de conteos: una fila por categoría y una o más columnas de
#' cantidades. Las columnas Total, % y Meta (o las que son la suma de las
#' demás o proporciones que suman 1) se reconocen como calculadas y no se usan.
#' La fila "Total" se compara con la suma y se quita. La tabla termina en la
#' primera fila vacía: un resumen suele apilar varias tablas en una hoja.
#'
#' @param df data.frame leído como texto, con el encabezado en la primera fila.
#' @param columna_variable nombre de la variable de las columnas (por ejemplo,
#'   "Sexo"); vacío si hay una sola columna de conteos.
#' @return list(cruce, categoria, conteo_columnas, calculadas, avisos).
calc_muestra_conteos_leer <- function(df, columna_variable = "") {
  if (!is.data.frame(df) || !ncol(df) || !nrow(df)) {
    stop_api(400, "E_BAD_REQUEST", "La tabla de conteos no tiene filas.")
  }
  vacia <- apply(df, 1, function(r) all(is.na(r) | !nzchar(trimws(as.character(r)))))
  fin <- which(vacia)[1]
  if (!is.na(fin)) df <- df[seq_len(fin - 1L), , drop = FALSE]
  if (!nrow(df)) stop_api(400, "E_BAD_REQUEST", "La tabla de conteos no tiene filas.")

  es_num <- vapply(df, function(v) { x <- v[!is.na(v) & nzchar(trimws(v))]; length(x) > 0 && mean(!is.na(.cm_seg_num(x))) >= 0.95 }, logical(1))
  cat_col <- names(df)[!es_num][1]
  if (is.na(cat_col)) stop_api(400, "E_BAD_REQUEST", "La tabla de conteos no tiene una columna de categorías.")
  categorias <- trimws(as.character(df[[cat_col]]))
  es_total <- grepl("^total(es)?( general)?$", categorias, ignore.case = TRUE)

  numericas <- names(df)[es_num]
  calculadas <- list()
  por_nombre <- grepl("^(total(es)?|%|porcentaje|pct|proporci[oó]n|meta|metas|n meta)$", trimws(numericas), ignore.case = TRUE) |
    grepl("^%|%$", trimws(numericas))
  for (k in which(por_nombre)) calculadas[[length(calculadas) + 1L]] <- list(columna = numericas[k], motivo = "nombre")
  conteo <- numericas[!por_nombre]
  # Una columna que es la suma de las demás, o proporciones que suman 1, también es calculada.
  if (length(conteo) >= 2L) {
    m <- sapply(conteo, function(c) .cm_seg_num(df[[c]][!es_total]))
    m <- matrix(m, ncol = length(conteo), dimnames = list(NULL, conteo))
    for (c in conteo) {
      otras <- setdiff(conteo, c)
      if (length(otras) >= 2L && isTRUE(all.equal(unname(m[, c]), unname(rowSums(m[, otras, drop = FALSE])), tolerance = 1e-9))) {
        calculadas[[length(calculadas) + 1L]] <- list(columna = c, motivo = "suma de las demás"); conteo <- setdiff(conteo, c)
      } else if (all(m[, c] >= 0 & m[, c] <= 1, na.rm = TRUE) && abs(sum(m[, c], na.rm = TRUE) - 1) < 1e-6) {
        calculadas[[length(calculadas) + 1L]] <- list(columna = c, motivo = "proporción"); conteo <- setdiff(conteo, c)
      }
    }
  }
  if (!length(conteo)) stop_api(400, "E_BAD_REQUEST", "La tabla no tiene columnas de conteos.")

  datos <- df[!es_total, , drop = FALSE]
  cats <- categorias[!es_total]
  if (anyDuplicated(cats)) {
    stop_api(400, "E_BAD_REQUEST", sprintf("La categoría \"%s\" aparece dos veces en la tabla de conteos.", cats[duplicated(cats)][1]))
  }
  m <- sapply(conteo, function(c) .cm_seg_num(datos[[c]]))
  m <- matrix(m, ncol = length(conteo))
  m[is.na(m)] <- 0
  avisos <- list()
  if (any(es_total)) {
    tot <- .cm_seg_num(unlist(df[which(es_total)[1], conteo]))
    if (!isTRUE(all.equal(unname(colSums(m)), unname(tot)))) {
      avisos[[length(avisos) + 1L]] <- list(codigo = "total_no_cuadra",
        texto = sprintf("La fila Total de la tabla no es la suma de las categorías (%s frente a %s).",
                        paste(format(tot, big.mark = ","), collapse = ", "), paste(format(colSums(m), big.mark = ","), collapse = ", ")))
    }
  }
  variable <- calc_str(columna_variable, "")
  cruce <- if (length(conteo) == 1L) {
    .cm_seg_cruce(cat_col, "", cats, "Total", m)
  } else {
    .cm_seg_cruce(cat_col, if (nzchar(variable)) variable else "Columnas", cats, conteo, m)
  }
  list(cruce = cruce, categoria = cat_col, conteo_columnas = as.list(conteo), calculadas = calculadas, avisos = avisos)
}

# ---------------------------------------------------------------------------
# Grupos de celdas
# ---------------------------------------------------------------------------

#' Arma segmentos a partir de un cruce asignando cada celda a un grupo.
#'
#' Por ejemplo, condición y categoría de los docentes: CAT_DESCRI por
#' DEDICACION, con "Contratado, DTC" en Contratado TC y "Contratado, TPA" y
#' "Contratado, TPC20" en Contratado TPA.
#'
#' @param cruce un cruce.
#' @param grupos lista de {nombre, celdas = [{fila, columna}]}; en un cruce de
#'   una variable basta {fila}. Una celda no puede ir en dos grupos.
#' @return list(grupos = [{nombre, N, celdas}], sin_grupo = [{fila, columna,
#'   N}], total, total_agrupado).
calc_muestra_segmento_agrupar <- function(cruce, grupos) {
  asignado <- matrix("", nrow = length(cruce$filas), ncol = length(cruce$columnas))
  una_col <- identical(cruce$columnas, "Total")
  nombres <- character(0)
  for (g in grupos) {
    nombre <- calc_str(g$nombre, "")
    if (!nzchar(nombre)) stop_api(400, "E_BAD_REQUEST", "Cada grupo necesita un nombre.")
    if (nombre %in% nombres) stop_api(400, "E_BAD_REQUEST", sprintf("El grupo \"%s\" está dos veces.", nombre))
    nombres <- c(nombres, nombre)
    for (c in g$celdas %||% list()) {
      f <- calc_str(c$fila, "")
      co <- if (una_col) "Total" else calc_str(c$columna, "")
      i <- match(f, cruce$filas); j <- match(co, cruce$columnas)
      if (is.na(i)) stop_api(400, "E_BAD_REQUEST", sprintf("\"%s\" no es una categoría de %s.", f, cruce$fila_variable))
      if (is.na(j)) stop_api(400, "E_BAD_REQUEST", sprintf("\"%s\" no es una categoría de %s.", co, cruce$columna_variable))
      if (nzchar(asignado[i, j]) && asignado[i, j] != nombre) {
        stop_api(400, "E_BAD_REQUEST", sprintf("La celda %s, %s está en dos grupos: %s y %s.", f, co, asignado[i, j], nombre))
      }
      asignado[i, j] <- nombre
    }
  }
  out <- lapply(nombres, function(nm) {
    idx <- which(asignado == nm, arr.ind = TRUE)
    list(nombre = nm, N = sum(cruce$conteos[asignado == nm]),
         celdas = lapply(seq_len(nrow(idx)), function(k) list(fila = cruce$filas[idx[k, 1]], columna = cruce$columnas[idx[k, 2]])))
  })
  libres <- which(!nzchar(asignado) & cruce$conteos > 0, arr.ind = TRUE)
  sin_grupo <- lapply(seq_len(nrow(libres)), function(k) list(
    fila = cruce$filas[libres[k, 1]], columna = cruce$columnas[libres[k, 2]],
    N = cruce$conteos[libres[k, 1], libres[k, 2]]))
  list(grupos = out, sin_grupo = sin_grupo, total = cruce$total,
       total_agrupado = sum(vapply(out, function(x) as.numeric(x$N), numeric(1))))
}

# ---------------------------------------------------------------------------
# Cuotas
# ---------------------------------------------------------------------------

#' Reparte la meta de un público sobre un cruce.
#'
#' Modos (D8):
#'   - "celda": cada celda recibe su parte proporcional, por mayor resto sobre
#'     todas las celdas, y la suma da la meta.
#'   - "control": la meta se reparte por la variable de las filas; la segunda
#'     variable se mira sin cuota (se publica lo esperado por celda, con
#'     decimales).
#'   - "minimo": como "celda", y ninguna celda baja de `minimo` (o de toda su
#'     población si es menor); lo que sube se suma encima de la meta. `extra` es lo que
#     suma el mínimo sobre la meta alcanzable (la meta o, si es mayor, toda la población).
#'
#' @return list(modo, meta, total, extra, cuotas (matriz o NULL), esperadas
#'   (matriz, solo en control), por_fila = [{categoria, N, n, margen}],
#'   chicas = [{fila, columna, N, n}], umbral).
calc_muestra_cuotas_cruce <- function(cruce, meta, modo = "celda", minimo = .CM_SEG_UMBRAL_CHICA,
                                      umbral = .CM_SEG_UMBRAL_CHICA, z = 1.96) {
  modo <- calc_enum(modo, c("celda", "control", "minimo"), "")
  if (!nzchar(modo)) stop_api(400, "E_BAD_REQUEST", "El modo de cuota es celda, control o minimo.")
  meta <- calc_int(meta, NA_integer_, min = 0L)
  if (is.na(meta)) stop_api(400, "E_BAD_REQUEST", "La meta debe ser un entero mayor o igual que cero.")
  N <- cruce$conteos
  N_fila <- rowSums(N)
  meta_efectiva <- min(meta, sum(N))
  cuotas <- NULL; esperadas <- NULL
  if (identical(modo, "control")) {
    n_fila <- distribuir_proporcional_pesos(meta_efectiva, N_fila)
    esperadas <- N * ifelse(N_fila > 0, n_fila / N_fila, 0)
  } else {
    # Fila por fila: los empates del mayor resto se resuelven en el orden en que se leen las celdas.
    plano <- distribuir_proporcional_pesos(meta_efectiva, as.numeric(t(N)))
    cuotas <- matrix(as.integer(plano), nrow = nrow(N), byrow = TRUE, dimnames = dimnames(N))
    if (identical(modo, "minimo")) {
      piso_n <- calc_int(minimo, NA_integer_, min = 0L)
      if (is.na(piso_n)) stop_api(400, "E_BAD_REQUEST", "El mínimo por celda debe ser un entero mayor o igual que cero.")
      piso <- pmin(piso_n, N)
      cuotas[] <- as.integer(pmax(cuotas, piso))
    }
    n_fila <- rowSums(cuotas)
  }
  total <- sum(n_fila)
  por_fila <- lapply(seq_along(cruce$filas), function(i) list(
    categoria = cruce$filas[i], N = N_fila[[i]], n = as.integer(n_fila[[i]]),
    margen = calc_e_desde_n_muestra(n_fila[[i]], N_fila[[i]], z = z)))
  chicas <- if (identical(modo, "control")) {
    lapply(unname(which(N_fila > 0 & n_fila < umbral)), function(i) list(fila = cruce$filas[i], columna = "", N = N_fila[[i]], n = as.integer(n_fila[[i]])))
  } else {
    idx <- which(N > 0 & cuotas < umbral, arr.ind = TRUE)
    lapply(seq_len(nrow(idx)), function(k) list(fila = cruce$filas[idx[k, 1]], columna = cruce$columnas[idx[k, 2]],
                                                N = N[idx[k, 1], idx[k, 2]], n = cuotas[idx[k, 1], idx[k, 2]]))
  }
  list(modo = modo, meta = meta, total = as.integer(total), extra = as.integer(total - meta_efectiva),
       cuotas = cuotas, esperadas = esperadas, por_fila = por_fila, chicas = chicas, umbral = umbral,
       celdas = sum(if (identical(modo, "control")) N_fila > 0 else N > 0))
}

# Matriz a lista de filas para el JSON: [{categoria, valores}].
.cm_seg_matriz_json <- function(m, filas) {
  if (is.null(m)) return(NULL)
  lapply(seq_along(filas), function(i) list(categoria = filas[i], valores = as.list(unname(m[i, ]))))
}

#' Un cruce listo para JSON.
calc_muestra_cruce_json <- function(cruce) {
  list(fila_variable = cruce$fila_variable, columna_variable = cruce$columna_variable,
       filas = as.list(cruce$filas), columnas = as.list(cruce$columnas),
       conteos = .cm_seg_matriz_json(cruce$conteos, cruce$filas), total = cruce$total)
}
