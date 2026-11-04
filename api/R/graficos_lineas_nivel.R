# =============================================================================
# graficos_lineas_nivel.R — una pregunta por niveles ordenados: una línea por serie, con el total arriba
# =============================================================================
#
# Lámina «total arriba y protagonista abajo», variante 05 aprobada por Gonzalo el 2026-11-04 (maqueta de CCSS Perfil
# del Estudiante, `Maqueta composición y línea por nivel (2026-11-04)/propuesta.md`). Este archivo DECIDE las cifras y
# las marcas; no dibuja. El dibujo nativo vive en `lamina_total_y_cruce.R` (la composición) y `lamina_lineas_nivel.R`
# (la protagonista de líneas); la figura del Word en `reporte_word_lineas_nivel.R`.
#
# Cifras:
#   - grano: un caso por fila de la base; el denominador de cada punto son los casos del nivel con `var` válida (sin
#     vacío y sin valores especiales: 90 y 94 a 99, o un rótulo de «No sabe» o «No responde»). Todas las series de la
#     lámina comparten ese denominador;
#   - una serie cuenta en el numerador si `var` está en sus `codigos`; con `y`, además si `y$var` está en `y$codigos`
#     (fila derivada de dos preguntas, p. ej. «trabaja y lo hace medio tiempo o más»). Un vacío en `y$var` cuando `var`
#     sí cumple no entra al numerador y se avisa;
#   - el peso es el de la base (`.peso_vec`); las bases de cada punto son casos sin ponderar.
#
# Significancia (la regla del estudio, ADR 0128, con sus funciones; aquí no se inventa ninguna prueba):
#   - por punto, cada nivel FRENTE AL RESTO, como las tarjetas del ADR 0129: `.sig_evaluar` con `max_letras = 1` y
#     `.sig_veredictos` con la familia de BH del informe. Las filas de esta lámina no están en la familia: su p se ajusta
#     contra ella por interpolación monótona (`.sig_bh_q`, ADR 0129 §2). ▲▼ si es firme (p ajustado < 0.01), △▽ si es
#     frágil (entre 0.01 y alfa). Un punto bajo la base mínima o con pocos conglomerados se dibuja pero no se marca;
#   - por serie, la tendencia lineal entre niveles (`.sig_tendencia`, D6) con la corrección que el motor usa hoy
#     (Bonferroni entre las filas de la evaluación). El chip «Crece con el nivel» o «Baja con el nivel» sale solo si es
#     significativa; firme o frágil con el mismo corte de 0.01.
#     PENDIENTE (fuera de este trabajo): ajustar el p de la tendencia contra la familia del informe con `.sig_bh_q`, como
#     propone la maqueta (§1.3). Con eso «Medio tiempo o más» de CCSS pasaría de firme a frágil.

# Códigos especiales del estándar de la casa (dominio-prosecnur §5): no cuentan en el denominador.
.LINEAS_NIVEL_ESPECIALES <- c("90", "94", "95", "96", "97", "98", "99")
.LINEAS_NIVEL_ESPECIAL_RX <- paste0(
  "^\\s*(no\\s+s[eé]|no\\s+sabe|ns\\s*/\\s*nr|no\\s+tengo\\s+(informaci[oó]n|opini[oó]n)|prefiero\\s+no|",
  "no\\s+responde|no\\s+precisa|no\\s+aplica)(\\s|[[:punct:]]|$)"
)
.LINEAS_NIVEL_MAX_SERIES <- 3L
# Colores por defecto (tokens de `ppt.colores` del estándar), en el orden de las series y de los segmentos del total.
.LINEAS_NIVEL_COLORES_SERIE <- c("azul", "azul_medio", "tarjeta_borde_95")
.LINEAS_NIVEL_COLORES_DENTRO <- c("mapa_medio", "azul_rango", "tarjeta_barra_95")
.LINEAS_NIVEL_COLORES_FUERA <- c("banda_clara", "cebra", "numero_fondo")
.LINEAS_NIVEL_COLORES_CATEGORIA <- c("azul", "azul_medio", "mapa_medio", "azul_rango", "banda_clara", "cebra")

#' Una pregunta por los niveles de un cruce ordenado: el total arriba y una línea por serie abajo
#'
#' Arma la lámina «total arriba y protagonista abajo». Arriba, la franja del total de la pregunta (cualquier pregunta de
#' categorías); abajo, una línea por serie con un punto por nivel, la marca de cada nivel frente al resto y el chip de
#' tendencia de cada serie.
#'
#' @param var Pregunta principal (`base$variable` o `variable`).
#' @param cruce Variable de niveles ordenados para el eje X (nivel curricular, ciclo, grupo de edad).
#' @param series Lista de series, cada una `list(rotulo, codigos, y = list(var, codigos), color)`. `codigos` son los de
#'   `var` que cuentan; `y` (opcional) agrega una segunda pregunta para una fila derivada. `color` (opcional) es un token
#'   de `ppt.colores` del estándar. Hasta tres series.
#' @param total_arriba Si va la franja del total arriba.
#' @param segmentos_total Cómo se parte la franja: lista de `list(rotulo, codigos, y, color)` con la misma gramática de
#'   las series. Sin ella, si las series están anidadas, la franja es la serie interior, lo que falta para la exterior y
#'   el resto; si no, una parte por categoría de `var`.
#' @param lectura Texto libre en gris a la derecha, sin marcas (un análisis complementario, por ejemplo).
#' @param mostrar_significancia Marca cada nivel frente al resto y la tendencia de cada serie, con la regla del estudio.
#' @param titulo_seccion Título de la parte de abajo («Según nivel curricular»).
#' @param rotulo_total Rótulo de la franja del total («Total de estudiantes»).
#' @param publico Cómo se nombran los casos bajo cada nivel («estudiantes»).
#' @param nombre_nivel Qué crece en el chip de tendencia («nivel» → «Crece con el nivel»).
#' @param grupos Códigos del cruce a mostrar; sin ellos, todos los que tienen casos, en orden de código.
#' @export
p_lineas_nivel <- function(
    var,
    cruce,
    series,
    total_arriba = TRUE,
    segmentos_total = NULL,
    lectura = NULL,
    mostrar_significancia = TRUE,
    titulo_seccion = NULL,
    rotulo_total = NULL,
    publico = NULL,
    nombre_nivel = NULL,
    grupos = NULL,
    titulo = NULL,
    overrides = list(),
    base = list(),
    filtros = list()
) {
  var <- trimws(as.character(unlist(var))[1])
  cruce <- trimws(as.character(unlist(cruce))[1])
  if (is.na(var) || !nzchar(var)) .plan_spec_abort("p_lineas_nivel(): falta `var`, la pregunta principal.")
  if (is.na(cruce) || !nzchar(cruce)) .plan_spec_abort("p_lineas_nivel(): falta `cruce`, la variable de niveles del eje X.")
  series <- .lineas_nivel_partes(series, "series")
  if (!length(series)) .plan_spec_abort("p_lineas_nivel(): `series` debe traer al menos una serie con `rotulo` y `codigos`.")
  if (length(series) > .LINEAS_NIVEL_MAX_SERIES) {
    .plan_spec_abort(sprintf("p_lineas_nivel(): hasta %d series; llegaron %d.", .LINEAS_NIVEL_MAX_SERIES, length(series)))
  }
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  texto <- function(x) { x <- as.character(unlist(x %||% ""))[1]; if (is.na(x) || !nzchar(trimws(x))) NULL else trimws(x) }
  g <- if (is.null(grupos)) NULL else trimws(as.character(unlist(grupos)))
  el <- list(
    .element_type   = "lineas_nivel",
    var             = var,
    cruce           = cruce,
    series          = series,
    total_arriba    = !identical(as.logical(unlist(total_arriba))[1], FALSE),
    segmentos_total = if (is.null(segmentos_total)) NULL else .lineas_nivel_partes(segmentos_total, "segmentos_total"),
    lectura         = texto(lectura),
    mostrar_significancia = !identical(as.logical(unlist(mostrar_significancia))[1], FALSE),
    titulo_seccion  = texto(titulo_seccion),
    rotulo_total    = texto(rotulo_total) %||% "Total",
    publico         = texto(publico) %||% "casos",
    nombre_nivel    = texto(nombre_nivel) %||% "nivel",
    grupos          = if (length(g)) g else NULL,
    title_slide     = titulo,
    overrides       = overrides,
    base            = base,
    filtros         = .ppt_norm_filters(filtros)
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' Normaliza series o segmentos: acepta la lista del plan o el data.frame que deja un JSON rectangularizado
#' @keywords internal
.lineas_nivel_partes <- function(x, nombre = "series") {
  if (is.null(x)) return(list())
  if (is.data.frame(x)) x <- lapply(seq_len(nrow(x)), function(i) lapply(as.list(x[i, , drop = FALSE]), function(v) if (is.list(v)) v[[1]] else v))
  if (!is.list(x)) .plan_spec_abort(sprintf("p_lineas_nivel(): `%s` debe ser una lista.", nombre))
  if (!is.null(x$rotulo) || !is.null(x$codigos)) x <- list(x)   # una sola parte sin envolver
  cods <- function(v) { v <- trimws(as.character(unlist(v))); v[!is.na(v) & nzchar(v)] }
  lapply(seq_along(x), function(i) {
    s <- x[[i]]
    if (!is.list(s)) .plan_spec_abort(sprintf("p_lineas_nivel(): cada elemento de `%s` es una lista con `rotulo` y `codigos`.", nombre))
    rot <- trimws(as.character(unlist(s$rotulo %||% ""))[1])
    if (is.na(rot) || !nzchar(rot)) .plan_spec_abort(sprintf("p_lineas_nivel(): el elemento %d de `%s` no tiene `rotulo`.", i, nombre))
    cs <- cods(s$codigos)
    if (!length(cs)) .plan_spec_abort(sprintf("p_lineas_nivel(): «%s» no declara `codigos`.", rot))
    y <- s$y
    if (!is.null(y) && length(y)) {
      if (is.data.frame(y)) y <- as.list(y[1, , drop = FALSE])
      yv <- trimws(as.character(unlist(y$var %||% ""))[1]); yc <- cods(y$codigos)
      if (is.na(yv) || !nzchar(yv) || !length(yc)) .plan_spec_abort(sprintf("p_lineas_nivel(): en «%s», `y` necesita `var` y `codigos`.", rot))
      y <- list(var = yv, codigos = yc)
    } else y <- NULL
    col <- trimws(as.character(unlist(s$color %||% ""))[1])
    list(rotulo = rot, codigos = cs, y = y, color = if (is.na(col) || !nzchar(col)) NULL else col)
  })
}

#' Aviso del motor con el prefijo de la lámina
#' @keywords internal
.lineas_nivel_aviso <- function(...) {
  if (exists(".pulso_aviso", mode = "function")) .pulso_aviso(paste0("Línea por nivel: ", ...))
  invisible(NULL)
}

#' Color de un token de `ppt.colores`; un nombre que no es token se avisa y cae al de por defecto
#' @keywords internal
.lineas_nivel_color <- function(token, defecto) {
  if (!is.null(token)) {
    v <- tryCatch(.std_color(token), error = function(e) NULL)
    if (is.character(v) && length(v) == 1L && grepl("^#[0-9A-Fa-f]{6}", v)) return(list(token = token, hex = v))
    .lineas_nivel_aviso("«", token, "» no es un color del estándar (ppt.colores); se usa «", defecto, "».")
  }
  list(token = defecto, hex = .std_color(defecto))
}

#' ¿Código o rótulo especial? (no cuenta en el denominador)
#' @keywords internal
.lineas_nivel_especial <- function(codigos, etiquetas = codigos) {
  as.character(codigos) %in% .LINEAS_NIVEL_ESPECIALES |
    grepl(.LINEAS_NIVEL_ESPECIAL_RX, as.character(etiquetas), ignore.case = TRUE, perl = TRUE)
}

#' Código limpio por caso (vacío = NA)
#' @keywords internal
.lineas_nivel_chr <- function(x) {
  v <- .reporte_plan_clean_chr(x)
  v[!is.na(v) & !nzchar(v)] <- NA_character_
  v
}

#' Máscara de pertenencia de una parte (serie o segmento) sobre los casos válidos
#' @return `list(mask, y_vacio)`: `y_vacio` cuenta los casos que cumplen `var` y no tienen `y$var`.
#' @keywords internal
.lineas_nivel_mascara <- function(parte, v, data, valido) {
  m <- valido & !is.na(v) & v %in% parte$codigos
  y_vacio <- 0L
  if (!is.null(parte$y)) {
    yv_nom <- .reporte_plan_resolve_recod_var(.sig_var_local(parte$y$var), data)
    if (!yv_nom %in% names(data)) {
      stop_api(400, "E_LINEAS_NIVEL_VARIABLE", sprintf("La línea por nivel declara «%s» en «%s» y la base no la trae.", parte$y$var, parte$rotulo))
    }
    yv <- .lineas_nivel_chr(data[[yv_nom]])
    y_vacio <- sum(m & is.na(yv))
    m <- m & !is.na(yv) & yv %in% parte$y$codigos
  }
  list(mask = m, y_vacio = as.integer(y_vacio))
}

#' Proporción ponderada (0-100) de una máscara entre los casos de una base
#' @keywords internal
.lineas_nivel_pct <- function(mask, base, w) {
  ok <- base & w > 0
  if (!any(ok)) return(NA_real_)
  100 * sum(w[ok & mask]) / sum(w[ok])
}

#' Modelo puro de la lámina: cifras por nivel, marcas, tendencia y franja del total (sin dibujar)
#'
#' @param fuente `list(data, survey, choices, orders_list)` de la base de `var`.
#' @param el Elemento de `p_lineas_nivel()`.
#' @param sig Contexto `list(regla, familia)` (`.sig_contexto_render`).
#' @return Espec `tipo = "total_y_cruce"`, `protagonista = "lineas_nivel"` (la lee `lamina_total_y_cruce.R`).
#' @keywords internal
.lineas_nivel_modelo <- function(fuente, el, sig) {
  data <- as.data.frame(fuente$data, stringsAsFactors = FALSE)
  var <- .reporte_plan_resolve_recod_var(.sig_var_local(el$var), data)
  cruce <- .reporte_plan_resolve_recod_var(.sig_var_local(el$cruce), data)
  for (x in c(var, cruce)) {
    if (!x %in% names(data)) stop_api(400, "E_LINEAS_NIVEL_VARIABLE", sprintf("La línea por nivel usa «%s» y la base no la trae.", x))
  }
  avisos <- character(0)
  avisa <- function(...) { m <- paste0(...); avisos <<- c(avisos, m); .lineas_nivel_aviso(m) }
  w <- .peso_vec(data)
  v <- .lineas_nivel_chr(data[[var]])
  fv <- fuente; fv$data <- data
  cat_var <- .sig_grupos_cruce(fv, var)
  etq_var <- if (is.null(cat_var)) character(0) else stats::setNames(cat_var$etiquetas, cat_var$grupos)
  lab_v <- unname(etq_var[v]); lab_v[is.na(lab_v)] <- v[is.na(lab_v)]
  valido <- !is.na(v) & !.lineas_nivel_especial(v, lab_v)
  valido[is.na(valido)] <- FALSE

  # Niveles del eje X: los del cruce con casos válidos, en orden de código (numérico si todos lo son).
  gr <- .sig_grupos_cruce(fv, cruce)
  if (is.null(gr) || !length(gr$grupos)) stop_api(400, "E_LINEAS_NIVEL_SIN_NIVELES", sprintf("El cruce «%s» no tiene niveles con casos.", cruce))
  niv <- gr$grupos; etq <- stats::setNames(gr$etiquetas, gr$grupos)
  niv <- niv[!.lineas_nivel_especial(niv, etq[niv])]
  num <- suppressWarnings(as.numeric(niv))
  if (!anyNA(num)) niv <- niv[order(num)]
  if (length(el$grupos)) {
    faltan <- setdiff(el$grupos, niv)
    if (length(faltan)) avisa("el cruce «", cruce, "» no tiene casos en ", paste(faltan, collapse = ", "), ".")
    niv <- intersect(el$grupos, niv)
  }
  g <- ifelse(valido & !is.na(gr$g) & gr$g %in% niv, gr$g, NA_character_)
  niv <- niv[vapply(niv, function(k) any(!is.na(g) & g == k), logical(1))]
  if (length(niv) < 2L) stop_api(400, "E_LINEAS_NIVEL_SIN_NIVELES", sprintf("El cruce «%s» necesita al menos dos niveles con casos.", cruce))
  n_niv <- vapply(niv, function(k) sum(!is.na(g) & g == k), integer(1))

  # Series: una columna 1/0 por serie, NA fuera de la base (los casos sin `var` válida).
  mascaras <- lapply(el$series, .lineas_nivel_mascara, v = v, data = data, valido = valido)
  for (k in seq_along(el$series)) {
    if (mascaras[[k]]$y_vacio > 0L) {
      avisa(sprintf("en «%s», %d %s cumplen «%s» pero no responden «%s»; no cuentan en esa serie (la pregunta no les corresponde o quedó vacía).",
                    el$series[[k]]$rotulo, mascaras[[k]]$y_vacio, if (mascaras[[k]]$y_vacio == 1L) "caso" else "casos",
                    var, el$series[[k]]$y$var))
    }
  }
  rot <- vapply(el$series, `[[`, character(1), "rotulo")
  Y <- vapply(mascaras, function(m) ifelse(valido, as.numeric(m$mask), NA_real_), numeric(nrow(data)))
  if (!is.matrix(Y)) Y <- matrix(Y, ncol = length(rot))
  colnames(Y) <- rot
  ind <- list(Y = Y, codigos = stats::setNames(lapply(el$series, `[[`, "codigos"), rot), tipo = "so", w = w, en_base = valido)

  regla <- sig$regla %||% .sig_regla_fabrica()
  nmin <- regla$base_minima %||% 30
  cmin <- if (identical(regla$prueba, "rao_scott")) (regla$conglomerados_minimos %||% 8L) else 0L
  cl <- if (identical(regla$prueba, "rao_scott") && !is.null(regla$conglomerado) && regla$conglomerado %in% names(data)) data[[regla$conglomerado]] else NULL
  st <- if (!is.null(regla$estrato) && regla$estrato %in% names(data)) data[[regla$estrato]] else NULL
  ev <- NULL
  if (isTRUE(el$mostrar_significancia)) {
    motivo <- .sig_diseno_invalido(data, regla)
    if (!is.null(motivo)) {
      avisa("no se marcan diferencias: ", motivo, ".")
    } else {
      r1 <- regla; r1$max_letras <- 1L; r1$tendencia <- TRUE   # D7 forzado (frente al resto) y D6 encendida solo aquí
      ev <- .sig_evaluar(ind, g, niv, unname(etq[niv]), cluster = cl, estrato = st, regla = r1, filas = rot)
      ev <- .sig_veredictos(ev, r1, sig$familia)
    }
  }

  # Cifras por punto (las mismas de la prueba: peso de la base, casos sin ponderar).
  congl <- function(k) if (is.null(cl)) NA_integer_ else length(unique(stats::na.omit(cl[!is.na(g) & g == k])))
  cong_niv <- vapply(niv, congl, integer(1))
  comparable <- n_niv >= nmin & (is.na(cong_niv) | cong_niv >= cmin)
  cols_serie <- vector("list", length(el$series))
  series_out <- lapply(seq_along(el$series), function(k) {
    s <- el$series[[k]]
    col <- .lineas_nivel_color(s$color, .LINEAS_NIVEL_COLORES_SERIE[k])
    cols_serie[[k]] <<- col
    p <- vapply(niv, function(z) .lineas_nivel_pct(mascaras[[k]]$mask, !is.na(g) & g == z, w), numeric(1))
    dir <- rep(NA_character_, length(niv)); fr <- rep(FALSE, length(niv))
    if (!is.null(ev$marcas) && nrow(ev$marcas)) {
      mk <- ev$marcas[ev$marcas$fila == s$rotulo, , drop = FALSE]
      for (i in seq_len(nrow(mk))) {
        j <- match(mk$grupo[i], niv)
        if (is.na(j) || !comparable[j]) next
        dir[j] <- if (mk$flecha[i] %in% c("▲", "△")) "up" else "down"
        fr[j] <- isTRUE(mk$fragil[i])
      }
    }
    td <- NULL
    t0 <- ev$tendencia
    if (!is.null(t0) && nrow(t0) && s$rotulo %in% t0$fila) {
      t1 <- t0[t0$fila == s$rotulo, , drop = FALSE][1, ]
      alfa <- regla$alfa %||% 0.05
      fragil_t <- t1$p_ajustado >= 0.01
      if (is.finite(t1$p_ajustado) && t1$p_ajustado < alfa && !(fragil_t && identical(regla$fragiles, "ocultar"))) {
        td <- list(dir = if (t1$estimado > 0) "up" else "down", fragil = fragil_t, p = t1$p, p_ajustado = t1$p_ajustado,
                   texto = sprintf("%s con el %s", if (t1$estimado > 0) "Crece" else "Baja", el$nombre_nivel))
      }
    }
    list(rotulo = s$rotulo, color = col$hex, token = col$token,
         puntos = data.frame(codigo = niv, p = unname(p), n = unname(n_niv), comparable = unname(comparable),
                             dir = dir, fragil = fr, stringsAsFactors = FALSE),
         tendencia = td, total = .lineas_nivel_pct(mascaras[[k]]$mask, valido, w))
  })
  no_comp <- niv[!comparable]
  if (length(no_comp) && isTRUE(el$mostrar_significancia)) {
    avisa(sprintf("%s no se compara: tiene menos de %d %s%s.", paste(unname(etq[no_comp]), collapse = " y "), as.integer(nmin), el$publico,
                  if (cmin > 0) sprintf(" o de %d %ss", as.integer(cmin), .sig_nombre_conglomerado(regla$conglomerado)) else ""))
  }

  # Anidamiento: cada serie dentro de la anterior (la interior es subconjunto de la exterior).
  orden <- order(-vapply(series_out, `[[`, numeric(1), "total"))
  anidadas <- length(orden) >= 2L && all(vapply(seq_along(orden)[-1], function(i) {
    a <- mascaras[[orden[i]]]$mask; b <- mascaras[[orden[i - 1L]]]$mask
    all(!a | b)
  }, logical(1)))

  total <- if (isTRUE(el$total_arriba)) .lineas_nivel_total(el, v, data, valido, w, mascaras, series_out, cat_var, anidadas, orden, avisa) else NULL
  bandas <- list()
  if (isTRUE(anidadas)) {
    # Las bandas repiten el color de la franja: bajo la serie interior, su parte; entre dos series, lo que las separa.
    seg_col <- function(mask) {
      if (is.null(total)) return(NULL)
      i <- which(vapply(total$mascaras, function(m) identical(m, mask), logical(1)))
      if (length(i)) list(hex = total$segmentos$color[i[1]], rotulo = total$segmentos$rotulo[i[1]]) else NULL
    }
    interior <- orden[length(orden)]
    b0 <- seg_col(mascaras[[interior]]$mask)
    bandas[[1]] <- list(arriba = interior, abajo = NA_integer_, color = (b0 %||% list(hex = series_out[[interior]]$color))$hex, rotulo = NULL)
    for (i in rev(seq_along(orden)[-1])) {
      ext <- orden[i - 1L]; int <- orden[i]
      b <- seg_col(mascaras[[ext]]$mask & !mascaras[[int]]$mask)
      bandas[[length(bandas) + 1L]] <- list(arriba = ext, abajo = int, color = (b %||% list(hex = .std_color("mapa_medio")))$hex,
                                             rotulo = b$rotulo)
    }
  }
  list(tipo = "total_y_cruce", protagonista = "lineas_nivel",
       total = if (is.null(total)) NULL else total[c("rotulo", "segmentos", "llave", "n")],
       seccion = el$titulo_seccion,
       niveles = data.frame(codigo = niv, etiqueta = unname(etq[niv]), n = unname(n_niv), comparable = unname(comparable),
                            stringsAsFactors = FALSE),
       series = series_out, anidadas = anidadas, bandas = bandas, lectura = el$lectura, publico = el$publico,
       significancia = isTRUE(el$mostrar_significancia) && !is.null(ev),
       no_comparables = if (length(no_comp) && isTRUE(el$mostrar_significancia))
         sprintf("%s no se %s: menos de %d %s.", paste(unname(etq[no_comp]), collapse = " y "),
                 if (length(no_comp) == 1L) "compara" else "comparan", as.integer(nmin), el$publico) else NULL,
       n_total = sum(valido), avisos = avisos)
}

#' La franja del total: segmentos (declarados o por defecto), su cifra y la llave sobre la serie exterior
#' @keywords internal
.lineas_nivel_total <- function(el, v, data, valido, w, mascaras, series_out, cat_var, anidadas, orden, avisa) {
  partes <- el$segmentos_total
  segs <- list()
  if (length(partes)) {
    for (k in seq_along(partes)) {
      m <- .lineas_nivel_mascara(partes[[k]], v, data, valido)$mask
      segs[[k]] <- list(rotulo = partes[[k]]$rotulo, mask = m, color = partes[[k]]$color)
    }
  } else if (isTRUE(anidadas)) {
    # Por defecto: la serie interior, lo que falta para cada exterior y el resto (los que no están en ninguna serie).
    interior <- orden[length(orden)]
    segs[[1]] <- list(rotulo = series_out[[interior]]$rotulo, mask = mascaras[[interior]]$mask, color = NULL)
    for (i in rev(seq_along(orden)[-1])) {
      ext <- orden[i - 1L]; int <- orden[i]
      segs[[length(segs) + 1L]] <- list(rotulo = paste("Resto de", series_out[[ext]]$rotulo),
                                        mask = mascaras[[ext]]$mask & !mascaras[[int]]$mask, color = NULL)
    }
    resto <- valido & !mascaras[[orden[1]]]$mask
    cod_resto <- unique(v[resto])
    rot_resto <- if (!is.null(cat_var)) cat_var$etiquetas[match(cod_resto, cat_var$grupos)] else cod_resto
    rot_resto[is.na(rot_resto)] <- cod_resto[is.na(rot_resto)]
    segs[[length(segs) + 1L]] <- list(rotulo = paste(rot_resto, collapse = " o "), mask = resto, color = NULL)
  } else {
    # Cualquier pregunta de categorías: una parte por categoría válida, en el orden del instrumento.
    cods <- if (!is.null(cat_var)) cat_var$grupos else sort(unique(v[valido]))
    for (cd in cods[cods %in% v[valido]]) {
      r <- if (!is.null(cat_var)) cat_var$etiquetas[match(cd, cat_var$grupos)] else cd
      segs[[length(segs) + 1L]] <- list(rotulo = r, mask = valido & v == cd, color = NULL)
    }
  }
  segs <- Filter(function(s) any(s$mask), segs)
  if (!length(segs)) return(NULL)
  pct <- vapply(segs, function(s) .lineas_nivel_pct(s$mask, valido, w), numeric(1))
  if (abs(sum(pct) - 100) > 0.5) {
    avisa(sprintf("las partes de la franja del total suman %s%% de los casos; revisa `segmentos_total`.", format(round(sum(pct), 1))))
  }
  solapan <- length(segs) >= 2L && any(rowSums(vapply(segs, `[[`, logical(length(valido)), "mask")) > 1)
  if (solapan) avisa("dos partes de la franja del total comparten casos; revisa `segmentos_total`.")
  # Color: el de la serie que la parte reproduce; dentro de una serie, el siguiente tono; fuera de toda serie, la banda clara.
  dentro_k <- 0L; fuera_k <- 0L
  colores <- vapply(seq_along(segs), function(k) {
    s <- segs[[k]]
    if (!is.null(s$color)) return(.lineas_nivel_color(s$color, "azul_medio")$hex)
    igual <- which(vapply(mascaras, function(m) identical(m$mask, s$mask), logical(1)))
    if (length(igual)) return(series_out[[igual[1]]]$color)
    dentro <- any(vapply(mascaras, function(m) all(!s$mask | m$mask), logical(1)))
    if (length(el$series) && !isTRUE(anidadas) && !length(el$segmentos_total)) {
      return(.std_color(.LINEAS_NIVEL_COLORES_CATEGORIA[(k - 1L) %% length(.LINEAS_NIVEL_COLORES_CATEGORIA) + 1L]))
    }
    if (dentro) { dentro_k <<- dentro_k + 1L; return(.std_color(.LINEAS_NIVEL_COLORES_DENTRO[min(dentro_k, length(.LINEAS_NIVEL_COLORES_DENTRO))])) }
    fuera_k <<- fuera_k + 1L
    .std_color(.LINEAS_NIVEL_COLORES_FUERA[min(fuera_k, length(.LINEAS_NIVEL_COLORES_FUERA))])
  }, character(1))
  # Llave: la serie más amplia que se arma con dos o más partes contiguas que la cubren.
  llave <- NULL
  for (k in orden) {
    m <- mascaras[[k]]$mask
    dentro <- which(vapply(segs, function(s) all(!s$mask | m), logical(1)))
    if (length(dentro) < 2L || any(diff(dentro) != 1L)) next
    cubre <- Reduce(`|`, lapply(segs[dentro], `[[`, "mask"))
    # Las partes cubren la serie salvo casos sueltos (p. ej. un vacío en la segunda pregunta, que ya se avisó).
    if (.lineas_nivel_pct(m & !cubre, valido, w) >= 0.5) next
    llave <- list(desde = min(dentro), hasta = max(dentro), rotulo = series_out[[k]]$rotulo, pct = series_out[[k]]$total,
                  color = series_out[[k]]$color)
    break
  }
  list(rotulo = el$rotulo_total,
       segmentos = data.frame(rotulo = vapply(segs, `[[`, character(1), "rotulo"), pct = pct, color = colores, stringsAsFactors = FALSE),
       mascaras = lapply(segs, `[[`, "mask"), llave = llave, n = sum(valido))
}

#' Render del elemento: el modelo y la figura ggplot (Word y ruta anterior); la lámina nativa lee `pulso_espec`
#' @keywords internal
.render_lineas_nivel <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  inst_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources)) stop("lineas_nivel: el render no expone las fuentes del estudio.", call. = FALSE)
  sources <- list(data_sources = data_sources, inst_sources = inst_sources %||% list())
  .lineas_nivel_render_fuentes(el, sources)
}

#' El mismo render con las fuentes explícitas (lo usan los tests y la vista previa)
#' @keywords internal
.lineas_nivel_render_fuentes <- function(el, sources) {
  ref <- .serie_cruce_ref(el$var, sources)
  ctx <- .graficos_consolidado_ref_context(ref, sources)
  datos <- (sources$data_sources %||% list())[[ctx$source]]
  if (!is.data.frame(datos)) stop_api(400, "E_LINEAS_NIVEL_VARIABLE", sprintf("La línea por nivel no encuentra la base de «%s».", el$var))
  datos <- .apply_named_filters_safe(datos, filters = el$filtros %||% list(), arg_name = "filtros de la línea por nivel", mode = "strict")
  inst <- ctx$inst %||% list()
  fuente <- list(data = as.data.frame(datos, stringsAsFactors = FALSE), survey = inst$survey %||% NULL,
                 choices = inst$choices %||% NULL, orders_list = inst$orders_list %||% NULL)
  espec <- .lineas_nivel_modelo(fuente, el, .sig_contexto_render(fuente$data))
  p <- .lineas_nivel_ggplot(espec)
  attr(p, "pulso_espec") <- espec
  p
}
