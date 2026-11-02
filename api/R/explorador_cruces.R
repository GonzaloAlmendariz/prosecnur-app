# =============================================================================
# Explorador de variables — cruces tipo × tipo (E8, `biv.cruce`)
# =============================================================================
# Contrato congelado (docs/qa/checklist-explorador-variables-2026-11-02.md):
#   cruce: { tipo_x, tipo_y, grafico, forma, base_n, tabla? | cajas? | dispersion? | serie? | lista? }
# Filas = la variable que se lee (`var_x`); columnas = la del cruce (`var_y`).
# Base (`base_n`): casos de la base ya filtrada que responden LAS DOS variables (ver `.explorador_leer`).
#   - tabla: n[fila][col] = casos de la fila (categoría so / opción sm de x) que están en la columna (categoría so /
#     opción sm de y). `columnas[].n` = casos de la base en esa columna. En so × so, cada fila suma su marginal y el
#     total suma `base_n`; con sm las sumas exceden la base porque un caso marca varias opciones.
#   - cajas: cuartiles tipo 7 y atípicos por 1.5 × IQR (`.explorador_caja`); las fechas se miden en días desde la
#     fecha mínima de la base del cruce.
#   - serie: so × fecha cuenta casos por día y categoría (grilla completa, con ceros); sm × fecha da el % (0–100) de
#     quienes responden ese día que marcan la opción; num × fecha da la mediana del día con baja/alta = p25/p75.
#   - dispersion: hasta 3000 puntos muestreados con semilla fija (sin tocar el RNG de la sesión); la tendencia por
#     mínimos cuadrados usa TODOS los casos de la base.
#   - lista: hasta 20 grupos y 15 respuestas por grupo, textos iguales agrupados al normalizar minúsculas y tildes.

.EXPLORADOR_MAX_PUNTOS <- 3000L
.EXPLORADOR_SEMILLA_PUNTOS <- 20261102L
.EXPLORADOR_LISTA_GRUPOS <- 20L
.EXPLORADOR_LISTA_RESPUESTAS <- 15L

#' Los 25 pares: nombre del gráfico (rótulo de la UI) y forma del contrato
#' @keywords internal
.explorador_cruces_catalogo <- function() {
  par <- function(grafico, forma) list(grafico = grafico, forma = forma)
  list(
    so_so = par("Tabla de calor", "tabla"),
    so_sm = par("% que marca, por categoría", "tabla"),
    so_num = par("Cajas por categoría", "cajas"),
    so_fecha = par("Casos por día, apilados", "serie"),
    so_texto = par("Respuestas por categoría", "lista"),
    sm_so = par("% que marca cada opción, por categoría", "tabla"),
    sm_sm = par("Coocurrencia de opciones", "tabla"),
    sm_num = par("Cajas por opción marcada", "cajas"),
    sm_fecha = par("% que marca, por día", "serie"),
    sm_texto = par("Respuestas por opción marcada", "lista"),
    num_so = par("Cajas por categoría", "cajas"),
    num_sm = par("Cajas por opción marcada", "cajas"),
    num_num = par("Dispersión con tendencia", "dispersion"),
    num_fecha = par("Mediana por día", "serie"),
    num_texto = par("Respuestas ordenadas por valor", "lista"),
    fecha_so = par("Días por categoría", "cajas"),
    fecha_sm = par("Días por opción marcada", "cajas"),
    fecha_num = par("Fecha frente a la numérica", "dispersion"),
    fecha_fecha = par("Diferencia en días", "cajas"),
    fecha_texto = par("Respuestas por día", "lista"),
    texto_so = par("Respuestas por categoría", "lista"),
    texto_sm = par("Respuestas por opción marcada", "lista"),
    texto_num = par("Respuestas por tramos", "lista"),
    texto_fecha = par("Respuestas por día", "lista"),
    texto_texto = par("Dos abiertas lado a lado", "lista")
  )
}

.explorador_es_cat <- function(tipo) tipo %in% c("so", "sm")

# --- tabla --------------------------------------------------------------------
.explorador_cruce_tabla <- function(lx, ly, ok) {
  gx <- .explorador_grupos_cat(lx, ok)
  gy <- .explorador_grupos_cat(ly, ok)
  n <- matrix(0L, nrow = length(gx), ncol = length(gy))
  for (i in seq_along(gx)) for (j in seq_along(gy)) n[i, j] <- as.integer(sum(gx[[i]]$idx & gy[[j]]$idx))
  list(tabla = list(
    filas = lapply(gx, function(g) list(codigo = g$codigo, etiqueta = g$etiqueta)),
    columnas = lapply(gy, function(g) list(codigo = g$codigo, etiqueta = g$etiqueta, n = as.integer(sum(g$idx)))),
    n = n
  ))
}

# --- cajas --------------------------------------------------------------------
.explorador_dias_desde_min <- function(fechas, ok) {
  d <- as.numeric(fechas)
  d - min(d[ok])
}

.explorador_cruce_cajas <- function(lx, ly, ok) {
  if (!any(ok)) return(list(cajas = list(grupos = list())))
  if (identical(lx$tipo, "fecha") && identical(ly$tipo, "fecha")) {
    dif <- as.numeric(ly$valor[ok]) - as.numeric(lx$valor[ok])
    caja <- .explorador_caja(dif, sprintf("%s menos %s", ly$label, lx$label))
    return(list(cajas = list(grupos = if (is.null(caja)) list() else list(caja))))
  }
  # La categórica agrupa; la otra aporta el valor (num) o los días desde la mínima (fecha).
  cat_lec <- if (.explorador_es_cat(lx$tipo)) lx else ly
  val_lec <- if (.explorador_es_cat(lx$tipo)) ly else lx
  valores <- if (identical(val_lec$tipo, "fecha")) .explorador_dias_desde_min(val_lec$valor, ok) else val_lec$valor
  grupos <- lapply(.explorador_grupos_cat(cat_lec, ok), function(g) .explorador_caja(valores[g$idx], g$etiqueta))
  list(cajas = list(grupos = Filter(Negate(is.null), grupos)))
}

# --- dispersion -----------------------------------------------------------------
.explorador_muestra_indices <- function(n, max_n = .EXPLORADOR_MAX_PUNTOS) {
  if (n <= max_n) return(seq_len(n))
  # Semilla fija sin alterar el RNG de la sesión: se guarda y se restituye `.Random.seed`.
  env <- globalenv()
  tenia <- exists(".Random.seed", envir = env, inherits = FALSE)
  previo <- if (tenia) get(".Random.seed", envir = env, inherits = FALSE) else NULL
  on.exit({
    if (tenia) assign(".Random.seed", previo, envir = env) else if (exists(".Random.seed", envir = env, inherits = FALSE)) {
      rm(".Random.seed", envir = env)
    }
  }, add = TRUE)
  set.seed(.EXPLORADOR_SEMILLA_PUNTOS)
  sort(sample.int(n, max_n))
}

.explorador_cruce_dispersion <- function(lx, ly, ok) {
  x <- if (identical(lx$tipo, "fecha")) .explorador_dias_desde_min(lx$valor, ok) else as.numeric(lx$valor)
  y <- as.numeric(ly$valor)
  x <- x[ok]; y <- y[ok]
  n <- length(x)
  tendencia <- NA
  if (n >= 2L && stats::var(x) > 0) {
    pendiente <- sum((x - mean(x)) * (y - mean(y))) / sum((x - mean(x))^2)
    tendencia <- list(pendiente = pendiente, intercepto = mean(y) - pendiente * mean(x))
  }
  idx <- .explorador_muestra_indices(n)
  puntos <- matrix(c(x[idx], y[idx]), ncol = 2L)
  list(dispersion = list(puntos = puntos, tendencia = tendencia, n = as.integer(n)))
}

# --- serie --------------------------------------------------------------------
.explorador_punto <- function(fecha, valor, baja = NA, alta = NA, serie = NA) {
  list(fecha = fecha, valor = valor, baja = baja, alta = alta, serie = serie)
}

.explorador_cruce_serie <- function(lx, ly, ok) {
  if (!any(ok)) return(list(serie = list(puntos = list())))
  dia <- format(ly$valor, "%Y-%m-%d")
  dias <- sort(unique(dia[ok]))
  puntos <- list()
  if (identical(lx$tipo, "num")) {
    for (d in dias) {
      v <- lx$valor[ok & dia == d]
      q <- stats::quantile(v, c(0.25, 0.5, 0.75), names = FALSE)
      puntos[[length(puntos) + 1L]] <- .explorador_punto(d, q[2], q[1], q[3])
    }
  } else {
    for (g in .explorador_grupos_cat(lx, ok)) {
      for (d in dias) {
        en_dia <- ok & dia == d
        marcan <- sum(g$idx & en_dia)
        valor <- if (identical(lx$tipo, "sm")) .explorador_pct(marcan, sum(en_dia)) else as.integer(marcan)
        puntos[[length(puntos) + 1L]] <- .explorador_punto(d, valor, serie = g$etiqueta)
      }
    }
  }
  list(serie = list(puntos = puntos))
}

# --- lista --------------------------------------------------------------------
.explorador_grupo_lista <- function(etiqueta, textos) {
  tb <- .explorador_agrupar_textos(textos, top = .EXPLORADOR_LISTA_RESPUESTAS)
  list(etiqueta = etiqueta, respuestas = .explorador_textos_json(tb), .n = length(textos))
}

#' Cuartil de una numérica como tramo «a a b» (los cortes repetidos se funden)
#' @keywords internal
.explorador_tramos <- function(v, ok) {
  cortes <- unique(stats::quantile(v[ok], c(0, 0.25, 0.5, 0.75, 1), names = FALSE))
  if (length(cortes) < 2L) {
    return(list(list(etiqueta = sprintf("%s", .fmt_num(cortes[1])), idx = ok)))
  }
  tramo <- findInterval(v, cortes, rightmost.closed = TRUE, all.inside = TRUE)
  lapply(seq_len(length(cortes) - 1L), function(i) list(
    etiqueta = sprintf("%s a %s", .fmt_num(cortes[i]), .fmt_num(cortes[i + 1L])),
    idx = ok & !is.na(tramo) & tramo == i
  ))
}

.explorador_por_dia <- function(fechas, ok) {
  dia <- format(fechas, "%Y-%m-%d")
  lapply(sort(unique(dia[ok])), function(d) list(etiqueta = d, idx = ok & dia == d))
}

.explorador_por_valor_texto <- function(textos, ok) {
  clave <- .explorador_clave_texto(textos)
  tb <- .explorador_agrupar_textos(textos[ok], top = .EXPLORADOR_LISTA_GRUPOS)
  lapply(seq_len(nrow(tb)), function(i) list(
    etiqueta = tb$texto[i], idx = ok & clave == .explorador_clave_texto(tb$texto[i])
  ))
}

.explorador_cruce_lista <- function(lx, ly, ok) {
  # El texto que se lista es el de la variable abierta; si las dos lo son, se listan las de x agrupadas por y.
  x_es_texto <- identical(lx$tipo, "texto")
  txt_lec <- if (x_es_texto) lx else ly
  grp_lec <- if (x_es_texto) ly else lx
  grupos <- switch(
    grp_lec$tipo,
    so = , sm = .explorador_grupos_cat(grp_lec, ok),
    num = .explorador_tramos(grp_lec$valor, ok),
    fecha = .explorador_por_dia(grp_lec$valor, ok),
    texto = .explorador_por_valor_texto(grp_lec$valor, ok)
  )
  out <- lapply(grupos, function(g) .explorador_grupo_lista(g$etiqueta, txt_lec$valor[g$idx]))
  out <- Filter(function(g) g$.n > 0L, out)
  if (length(out) > .EXPLORADOR_LISTA_GRUPOS) {
    # Se quedan los 20 grupos con más respuestas, en su orden natural (catálogo, tramo o día).
    n <- vapply(out, function(g) g$.n, integer(1))
    keep <- sort(order(-n)[seq_len(.EXPLORADOR_LISTA_GRUPOS)])
    out <- out[keep]
  }
  list(lista = list(grupos = lapply(out, function(g) list(etiqueta = g$etiqueta, respuestas = g$respuestas))))
}

#' Cruce de dos variables sobre una base ya filtrada (contrato `cruce`)
#' @param df Base ya filtrada por fuente y filtros.
#' @keywords internal
explorador_cruce <- function(df, var_x, var_y, instrumento) {
  lx <- .explorador_leer(df, var_x, instrumento)
  ly <- .explorador_leer(df, var_y, instrumento)
  ok <- lx$valido & ly$valido
  spec <- .explorador_cruces_catalogo()[[paste(lx$tipo, ly$tipo, sep = "_")]]
  cuerpo <- switch(
    spec$forma,
    tabla = .explorador_cruce_tabla(lx, ly, ok),
    cajas = .explorador_cruce_cajas(lx, ly, ok),
    dispersion = .explorador_cruce_dispersion(lx, ly, ok),
    serie = .explorador_cruce_serie(lx, ly, ok),
    lista = .explorador_cruce_lista(lx, ly, ok)
  )
  c(list(tipo_x = lx$tipo, tipo_y = ly$tipo, grafico = spec$grafico, forma = spec$forma,
         base_n = as.integer(sum(ok))), cuerpo)
}

#' Cruce con los filtros del explorador aplicados igual que en `build_view_bivariado`
#' @keywords internal
explorador_cruce_filtrado <- function(data, var_x, var_y, instrumento, filtros = NULL) {
  data <- .explorar_apply_filtros(data, filtros, survey = instrumento$survey %||% NULL)
  explorador_cruce(data, var_x, var_y, instrumento)
}
