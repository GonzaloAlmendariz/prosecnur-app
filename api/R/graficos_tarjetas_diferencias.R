# Tarjetas de diferencias: qué diferencias de grupo acompañan al gráfico del total (ADR 0129)
# ========================================================================================
#
# Una lámina de total (`p_slide_1_grafico` sin cruce) puede pedir, con `meta$tarjetas_diferencias`, que a su lado (PPT)
# o debajo (Word) vayan las diferencias significativas de cada grupo FRENTE AL RESTO en los cruces del estudio. Es la
# propuesta P08 aprobada por Gonzalo el 2026-11-03 (`docs/qa/maqueta-total-con-diferencias-2026-11-03/propuesta.md`).
#
# Este archivo solo DECIDE qué tarjetas hay. No prueba nada por su cuenta: usa la misma evaluación de la regla del
# estudio (`.sig_evaluar` + `.sig_veredictos`, ADR 0128) forzada a «frente al resto» (`max_letras = 1`, D7), con la
# familia de BH del informe que fijó el worker. La prueba frente al resto de un cruce de dos grupos es la del par que
# ya está en la familia; la de nivel (cuatro grupos) no entra a la familia: su p se ajusta contra ella por
# interpolación, como las láminas filtradas (decisión de Gonzalo, 2026-11-04: no cambiar ninguna letra ya generada).
#
# Reglas (propuesta §5, versiones 5 y 6):
#   - unidad: múltiple y batería, una tarjeta por (opción o ítem, cruce); dicotómica, solo la opción principal;
#     nominal u ordinal, una por cruce con la categoría de mayor diferencia, y otra categoría solo si trae un grupo
#     que aún no aparece;
#   - con dos grupos se muestran los dos (el otro es el resto), con ▲ y ▼; con más, solo los que difieren;
#   - dos niveles definidos solo por el p ajustado: < 0.01 continuo; entre 0.01 y alfa, punteado (Gonzalo,
#     2026-11-04: «solo p», sin el criterio de 12 puntos de «Historias del informe»);
#   - orden: las del 99% primero, luego de mayor a menor diferencia; tope de 4 (las demás no se dibujan; era 6 en la
#     maqueta, Gonzalo lo bajó con las tarjetas más altas de la v7 RV).

.TARJETAS_MAX <- 4L   # Gonzalo (v7 RV): con el nombre sobre la barra las tarjetas son más altas; cuatro como máximo

#' Opción de la lámina: NULL si no pide tarjetas; si las pide, la lista normalizada
#'
#' Acepta `TRUE` o una lista `{activo, max, todas, cruces, rotulos, cortos, publico}`. `todas = TRUE` (ítem 23 de la v7 RV,
#' apagada por defecto) pone una tarjeta por cruce con todos sus grupos comparables, haya o no diferencias significativas. `cruces` restringe o reordena los cruces del
#' estudio; `rotulos` nombra cada cruce («area» → «Área»); `cortos` acorta rótulos de grupo («Economía y Finanzas» →
#' «Econ. y Finanzas»); `publico` nombra a quienes respondieron en la lectura («estudiantes»).
#' @keywords internal
.tarjetas_opcion <- function(meta) {
  x <- (meta %||% list())$tarjetas_diferencias
  if (is.null(x)) return(NULL)
  if (is.atomic(x)) {
    if (!isTRUE(as.logical(x[1]))) return(NULL)
    x <- list()
  }
  if (!is.list(x) || identical(x$activo, FALSE)) return(NULL)
  if (.tarjetas_es_mapa(x)) return(NULL)   # un mapa por ranura es de la lámina de dos gráficos (graficos_tarjetas_ranuras.R)
  mx <- suppressWarnings(as.integer(unlist(x$max %||% .TARJETAS_MAX))[1])
  if (is.na(mx) || mx < 1L) mx <- .TARJETAS_MAX
  mapa <- function(m) {
    m <- m %||% list()
    if (!length(m) || is.null(names(m))) return(character(0))
    v <- vapply(m, function(z) as.character(unlist(z))[1], character(1))
    v[!is.na(v) & nzchar(v)]
  }
  cruces <- as.character(unlist(x$cruces %||% character(0)))
  pub <- as.character(unlist(x$publico %||% ""))[1]
  ind <- as.character(unlist(x$indicador %||% ""))[1]
  modo <- as.character(unlist(x$modo %||% "panel"))[1]   # «en_linea»: el desglose pegado a su barra (lamina_tarjetas_en_linea.R)
  list(activo = TRUE, max = min(mx, 9L), todas = isTRUE(as.logical(unlist(x$todas %||% FALSE))[1]),
       cruces = cruces[nzchar(cruces)], rotulos = mapa(x$rotulos),
       cortos = mapa(x$cortos), publico = if (is.na(pub) || !nzchar(trimws(pub))) "personas encuestadas" else trimws(pub),
       indicador = if (is.na(ind) || !nzchar(trimws(ind))) NULL else trimws(ind),
       modo = if (identical(modo, "en_linea")) "en_linea" else "panel")
}

#' Tipo de la pregunta para la unidad de tarjeta
#' @keywords internal
.tarjetas_tipo <- function(espec, ind, sustantivas) {
  if (identical(espec$tipo, "escala")) return("bateria")
  if (identical(ind$tipo, "sm")) return("multiple")
  if (length(sustantivas) == 2L) return("dicotomica")
  "opcion_unica"
}

#' Rótulo de una variable en el instrumento (la primera columna `label*`)
#' @keywords internal
.tarjetas_rotulo_var <- function(var, survey) {
  if (!is.data.frame(survey) || !"name" %in% names(survey)) return(var)
  col <- grep("^label", names(survey), value = TRUE)[1]
  if (is.na(col)) return(var)
  r <- as.character(survey[[col]][match(var, survey$name)])
  if (!length(r) || is.na(r) || !nzchar(trimws(r))) var else trimws(gsub("<[^>]+>", "", r))
}

#' Proporción ponderada de cada fila en el total de casos de la base
#' @keywords internal
.tarjetas_total_filas <- function(ind, filas) {
  w <- ind$w %||% rep(1, nrow(ind$Y))
  vapply(filas, function(f) {
    y <- ind$Y[, f]; ok <- !is.na(y) & w > 0
    if (!any(ok)) NA_real_ else sum(w[ok] * y[ok]) / sum(w[ok])
  }, numeric(1))
}

#' Evalúa una pregunta frente al resto por un cruce
#'
#' @param filas Filas a probar (rótulos de los indicadores). Con `top2box`, se prueba la fila derivada.
#' @param fila_como Rótulo con el que la fila aparece en la tarjeta (el del ítem en una batería).
#' @return `list(pruebas, celdas, totales, grupos)` o NULL si el cruce no tiene dos grupos con datos.
#' @keywords internal
.tarjetas_evaluar_cruce <- function(fuente, var, cruce, regla, familia, filas = NULL, top2box = NULL, fila_como = NULL) {
  gr <- .sig_grupos_cruce(fuente, cruce)
  if (is.null(gr) || length(gr$grupos) < 2L) return(NULL)
  ind <- .sig_indicadores(fuente$data, var, survey = fuente$survey, orders_list = fuente$orders_list)
  if (is.null(ind) || !ncol(ind$Y)) return(NULL)
  if (length(top2box)) {
    rot <- paste(top2box, collapse = " + ")
    ind <- .sig_indicadores_derivar(ind, rot, top2box)
    filas <- intersect(rot, colnames(ind$Y))
  } else {
    filas <- intersect(filas %||% colnames(ind$Y), colnames(ind$Y))
  }
  if (!length(filas)) return(NULL)
  r1 <- regla; r1$max_letras <- 1L   # D7 forzado: cada grupo frente al resto
  cl <- if (identical(regla$prueba, "rao_scott") && !is.null(regla$conglomerado) && regla$conglomerado %in% names(fuente$data))
    fuente$data[[regla$conglomerado]] else NULL
  st <- if (!is.null(regla$estrato) && regla$estrato %in% names(fuente$data)) fuente$data[[regla$estrato]] else NULL
  ev <- .sig_evaluar(ind, gr$g, gr$grupos, gr$etiquetas, cluster = cl, estrato = st, regla = r1, filas = filas)
  ev <- .sig_veredictos(ev, r1, familia)
  renombrar <- function(x) if (!is.null(fila_como) && length(filas) == 1L) ifelse(x == filas, fila_como, x) else x
  pr <- ev$pares
  K <- length(gr$grupos)
  vacio <- data.frame(cruce = character(), fila = character(), grupo = character(), sube = logical(),
                      fragil = logical(), dif = numeric(), p_ajustado = numeric(), stringsAsFactors = FALSE)
  pruebas <- vacio
  if (!is.null(pr) && nrow(pr)) {
    sig <- pr$veredicto %in% c("marcada", if (!identical(regla$fragiles, "ocultar")) "fragil")
    pr <- pr[sig, , drop = FALSE]
    if (nrow(pr)) {
      grupo <- ifelse(pr$a == ".resto", pr$b, pr$a)
      sube <- pr$a != ".resto"
      # Con dos grupos, el resto ES el otro grupo: una sola prueba, atribuida al grupo mayor.
      if (K == 2L) {
        mantener <- grupo == gr$grupos[[1]]
        pr <- pr[mantener, , drop = FALSE]; grupo <- grupo[mantener]; sube <- sube[mantener]
        otro <- ifelse(grupo == gr$grupos[[1]], gr$grupos[[2]], gr$grupos[[1]])
        grupo <- ifelse(sube, grupo, otro); sube <- rep(TRUE, length(grupo))
      }
      if (nrow(pr)) {
        pruebas <- data.frame(cruce = cruce, fila = renombrar(pr$fila), grupo = grupo, sube = sube,
                              fragil = pr$veredicto == "fragil", dif = 100 * abs(pr$dif), p_ajustado = pr$p_ajustado,
                              stringsAsFactors = FALSE)
      }
    }
  }
  ce <- ev$celdas
  celdas <- data.frame(cruce = cruce, fila = renombrar(ce$fila), grupo = ce$grupo, p = 100 * ce$p, n = ce$n,
                       comparable = if (is.null(ce$comparable)) rep(TRUE, nrow(ce)) else ce$comparable %in% TRUE,
                       stringsAsFactors = FALSE)
  tot <- .tarjetas_total_filas(ind, filas)
  list(pruebas = pruebas, celdas = celdas,
       totales = stats::setNames(100 * unname(tot), renombrar(filas)),
       grupos = data.frame(cruce = cruce, codigo = gr$grupos, etiqueta = unname(gr$etiquetas),
                           n = vapply(gr$grupos, function(x) sum(!is.na(gr$g) & gr$g == x), numeric(1)),
                           stringsAsFactors = FALSE))
}

#' Arma una tarjeta: fila del total y los grupos que se muestran con su marca
#' @keywords internal
.tarjetas_armar <- function(ts, celdas, grupos, total) {
  cruce <- ts$cruce[1]; fila <- ts$fila[1]
  gs <- grupos$codigo[grupos$cruce == cruce]
  dos <- length(gs) == 2L
  mostrar <- if (dos) gs else gs[gs %in% ts$grupo]
  filas <- lapply(mostrar, function(g) {
    t <- ts[ts$grupo == g, , drop = FALSE]
    if (nrow(t)) {
      dir <- if (isTRUE(t$sube[1])) "up" else "down"; fr <- isTRUE(t$fragil[1])
    } else {
      # Con dos grupos, el menor también difiere del resto (que es el mayor): ▼ con el mismo nivel (versión 5).
      o <- ts[ts$grupo != g, , drop = FALSE]
      dir <- if (isTRUE(o$sube[1])) "down" else "up"; fr <- isTRUE(o$fragil[1])
    }
    ce <- celdas[celdas$cruce == cruce & celdas$fila == fila & celdas$grupo == g, , drop = FALSE]
    data.frame(codigo = g, etiqueta = grupos$etiqueta[grupos$cruce == cruce & grupos$codigo == g][1],
               p = if (nrow(ce)) ce$p[1] else NA_real_, dir = dir, fragil = fr, stringsAsFactors = FALSE)
  })
  gdf <- do.call(rbind, filas)
  gdf <- gdf[order(-gdf$p), , drop = FALSE]
  rownames(gdf) <- NULL
  list(cruce = cruce, fila = fila, total = unname(total[fila]), grupos = gdf, fragil = all(ts$fragil),
       brecha = max(ts$dif))
}

#' Selecciona y ordena las tarjetas de una pregunta (puro: sin datos ni render)
#'
#' @param pruebas data.frame(cruce, fila, grupo, sube, fragil, dif) de las diferencias significativas, ya normalizadas.
#' @param celdas data.frame(cruce, fila, grupo, p) con la proporción (0-100) de cada grupo.
#' @param grupos data.frame(cruce, codigo, etiqueta) en el orden del instrumento.
#' @param totales Vector nombrado fila → proporción del total (0-100).
#' @param tipo «multiple», «bateria», «dicotomica» u «opcion_unica».
#' @param cruces Orden de los cruces.
#' @param filas_visibles Filas que el gráfico del total muestra (las demás no generan tarjeta).
#' @return `list(tarjetas, total)`: todas las tarjetas ordenadas; `total` es cuántas hay antes del tope.
#' @keywords internal
.tarjetas_seleccionar <- function(pruebas, celdas, grupos, totales, tipo, cruces, filas_visibles = NULL) {
  if (is.null(pruebas) || !nrow(pruebas)) return(list())
  if (length(filas_visibles)) pruebas <- pruebas[pruebas$fila %in% filas_visibles, , drop = FALSE]
  if (identical(tipo, "dicotomica")) {
    principal <- filas_visibles[1] %||% pruebas$fila[1]
    pruebas <- pruebas[pruebas$fila == principal, , drop = FALSE]
  }
  out <- list()
  for (cr in cruces) {
    del <- pruebas[pruebas$cruce == cr, , drop = FALSE]
    if (!nrow(del)) next
    filas_c <- unique(del$fila)
    if (!identical(tipo, "opcion_unica")) {
      for (f in filas_c) out[[length(out) + 1L]] <- .tarjetas_armar(del[del$fila == f, , drop = FALSE], celdas, grupos, totales)
    } else {
      maximo <- vapply(filas_c, function(f) max(del$dif[del$fila == f]), numeric(1))
      cubiertos <- character(0)
      for (f in filas_c[order(-maximo)]) {
        ts <- del[del$fila == f, , drop = FALSE]
        if (all(ts$grupo %in% cubiertos)) next
        cubiertos <- union(cubiertos, ts$grupo)
        out[[length(out) + 1L]] <- .tarjetas_armar(ts, celdas, grupos, totales)
      }
    }
  }
  if (!length(out)) return(list())
  fr <- vapply(out, function(t) isTRUE(t$fragil), logical(1))
  br <- vapply(out, function(t) t$brecha, numeric(1))
  out[order(fr, -br)]
}

#' Una tarjeta con todos los grupos comparables del cruce (opción `todas`, ítem 23 de la v7 RV)
#'
#' Los grupos que la regla marca llevan su flecha y su nivel, como en `.tarjetas_armar`; los demás van sin flecha
#' (`dir = NA`) en el tono neutro de la tarjeta. Los que no se comparan por base o por conglomerados no se muestran: una
#' cifra sin prueba al lado de las probadas se leería como «sin diferencia», que es justo lo que no se sabe.
#' @keywords internal
.tarjetas_armar_todas <- function(cruce, fila, ts, celdas, grupos, total) {
  gs <- grupos$codigo[grupos$cruce == cruce]
  ce <- celdas[celdas$cruce == cruce & celdas$fila == fila, , drop = FALSE]
  comparables <- gs[gs %in% ce$grupo[ce$comparable %in% TRUE]]
  if (!length(comparables)) return(NULL)
  marcada <- if (nrow(ts)) .tarjetas_armar(ts, celdas, grupos, total)$grupos else NULL
  gdf <- do.call(rbind, lapply(comparables, function(g) {
    m <- if (is.null(marcada)) NULL else marcada[marcada$codigo == g, , drop = FALSE]
    data.frame(codigo = g, etiqueta = grupos$etiqueta[grupos$cruce == cruce & grupos$codigo == g][1],
               p = ce$p[ce$grupo == g][1], dir = if (length(m) && nrow(m)) m$dir[1] else NA_character_,
               fragil = length(m) > 0L && nrow(m) > 0L && isTRUE(m$fragil[1]), stringsAsFactors = FALSE)
  }))
  gdf <- gdf[order(-gdf$p), , drop = FALSE]
  rownames(gdf) <- NULL
  list(cruce = cruce, fila = fila, total = unname(total[fila]), grupos = gdf,
       fragil = nrow(ts) > 0L && all(ts$fragil), brecha = if (nrow(ts)) max(ts$dif) else 0,
       sin_diferencias = !nrow(ts), todas = TRUE)
}

#' Tarjetas de la opción `todas`: una por cruce declarado (y por ítem en una batería), en el orden de los cruces
#'
#' En una opción única la fila es la categoría con la diferencia significativa mayor; sin ninguna, la que más se aleja
#' del total en algún grupo comparable. En una dicotómica, la opción principal.
#' @keywords internal
.tarjetas_seleccionar_todas <- function(pruebas, celdas, grupos, totales, tipo, cruces, filas_visibles = NULL) {
  pruebas <- pruebas %||% data.frame(cruce = character(), fila = character(), dif = numeric())
  filas <- if (length(filas_visibles)) filas_visibles else unique(celdas$fila)
  filas <- intersect(filas, unique(celdas$fila))
  if (!length(filas)) return(list())
  if (identical(tipo, "dicotomica")) filas <- filas[1]
  out <- list()
  elegir <- function(cr) {
    del <- pruebas[pruebas$cruce == cr & pruebas$fila %in% filas, , drop = FALSE]
    if (nrow(del)) return(del$fila[which.max(del$dif)])
    ce <- celdas[celdas$cruce == cr & celdas$fila %in% filas & celdas$comparable %in% TRUE, , drop = FALSE]
    if (!nrow(ce)) return(NA_character_)
    ce$lejos <- abs(ce$p - unname(totales[ce$fila]))
    ce$fila[which.max(ce$lejos)]
  }
  por_fila <- if (identical(tipo, "opcion_unica")) NULL else filas
  for (f in por_fila %||% NA_character_) for (cr in cruces) {
    fila <- if (is.na(f)) elegir(cr) else f
    if (is.na(fila)) next
    ts <- pruebas[pruebas$cruce == cr & pruebas$fila == fila, , drop = FALSE]
    t <- .tarjetas_armar_todas(cr, fila, ts, celdas, grupos, totales)
    if (!is.null(t)) out[[length(out) + 1L]] <- t
  }
  out
}

#' Disposición de las tarjetas en el Word: con número impar, la principal sola; las demás de a dos
#' @return Lista de filas; cada fila es un vector de índices.
#' @keywords internal
.tarjetas_filas_word <- function(n) {
  if (n < 1L) return(list())
  filas <- list(); i <- 1L
  if (n %% 2L == 1L) { filas[[1]] <- 1L; i <- 2L }
  while (i <= n) { filas[[length(filas) + 1L]] <- seq.int(i, min(n, i + 1L)); i <- i + 2L }
  filas
}

#' Columnas del panel del PPT: una hasta 4 tarjetas, dos con 5 o 6 (versión 6, «Mitad con 6»)
#' @keywords internal
.tarjetas_columnas_ppt <- function(n) if (n <= 4L) 1L else 2L

#' Variable de cada fila de una batería: por el rótulo del instrumento; si no casa, por el orden aplicado
#' @keywords internal
.tarjetas_vars_bateria <- function(vars, espec, survey) {
  filas <- espec$filas
  rot <- function(x) gsub("\\s+", " ", trimws(as.character(x)))
  etq <- rot(vapply(vars, .tarjetas_rotulo_var, character(1), survey = survey))
  out <- vars[match(rot(filas$rotulo), etq)]
  orden <- espec$orden$aplicado %||% seq_along(vars)
  falta <- is.na(out)
  if (any(falta) && length(orden) == nrow(filas)) out[falta] <- vars[orden[falta]]
  out
}

#' Calcula las tarjetas de una lámina de total
#'
#' @param p Gráfico ya renderizado (su `pulso_espec` da las filas que se ven y su orden).
#' @param slide Lámina del plan (`meta$tarjetas_diferencias`).
#' @param resolver `.resolve_ref` del motor: de la variable a su fuente (base, instrumento, órdenes).
#' @return `list(tarjetas, total, tipo, opcion, filas, totales, grupos, cruces)` o NULL si la lámina no las pide.
#' @keywords internal
.tarjetas_de_lamina <- function(p, slide, resolver) {
  opt <- .tarjetas_opcion(slide$meta)
  if (is.null(opt)) return(NULL)
  espec <- if (inherits(p, "ggplot")) attr(p, "pulso_espec") else NULL
  aviso <- function(...) if (exists(".pulso_aviso", mode = "function")) .pulso_aviso(paste0("Tarjetas de diferencias: ", ...))
  if (is.null(espec) || !espec$tipo %in% c("categorica", "escala")) {
    aviso("la lámina «", slide$title %||% "", "» no es un gráfico de categorías ni una batería de escala; va sin tarjetas.")
    return(NULL)
  }
  el <- (slide$slots %||% list())$plot
  if (!is.null(el$cruces %||% el$cruce %||% el$overrides$cruces)) {
    aviso("la lámina «", slide$title %||% "", "» ya tiene un cruce; las tarjetas acompañan al gráfico del total.")
    return(NULL)
  }
  vars <- as.character(unlist(el$vars %||% el$var))
  if (!length(vars)) return(NULL)
  # Una batería sin columna de Top Two Box (`barra_extra = FALSE`, G17) compara igual el indicador que declara.
  opt$top2box <- as.character(unlist(el$top2box_labels %||% (el$overrides %||% list())$top2box_labels %||% character(0)))
  ctx_var <- resolver(vars[[1]])
  fuente <- list(data = as.data.frame(ctx_var$data, stringsAsFactors = FALSE), survey = ctx_var$survey,
                 choices = ctx_var$choices, orders_list = ctx_var$orders_list)
  sig <- .sig_contexto_render(fuente$data)
  .tarjetas_calcular(fuente, vars, opt, espec, sig, titulo = slide$title %||% "")
}

#' Tarjetas de una pregunta sobre una fuente, con la regla y la familia vigentes
#'
#' @param vars Variables de la pregunta (una; varias en una batería).
#' @param espec Espec del gráfico del total (`categorica` o `escala`): da las filas visibles, su orden y sus cifras. Con
#'   `rotulos = NULL` (la lámina de lectura, sin gráfico), las filas son todas las de la pregunta.
#' @param sig Contexto `list(regla, familia, cruces)`.
#' @keywords internal
.tarjetas_calcular <- function(fuente, vars, opt, espec, sig, titulo = "") {
  aviso <- function(...) if (exists(".pulso_aviso", mode = "function")) .pulso_aviso(paste0("Tarjetas de diferencias: ", ...))
  regla <- sig$regla
  vars_loc <- vapply(vars, function(v) .sig_var_local(v), character(1))
  vars_loc <- vapply(vars_loc, function(v) .reporte_plan_resolve_recod_var(v, fuente$data), character(1))
  if (!is.null(.sig_diseno_invalido(fuente$data, regla))) {
    aviso("el diseño de la base no permite probar diferencias («", .sig_diseno_invalido(fuente$data, regla), "»).")
    return(NULL)
  }
  cruces <- if (length(opt$cruces)) opt$cruces else as.character(unlist(sig$cruces %||% character(0)))
  cruces <- unique(vapply(cruces, .sig_var_local, character(1)))
  cruces <- cruces[cruces %in% names(fuente$data) & !cruces %in% vars_loc]
  if (!length(cruces)) {
    aviso("el estudio no declara variables de cruce en Analítica; la lámina «", titulo, "» va sin tarjetas.")
    return(NULL)
  }

  partes <- list(); sin_columna <- FALSE
  if (identical(espec$tipo, "escala")) {
    box <- espec$box
    sin_columna <- is.null(box) || !length(box$cols)
    ttb <- if (!sin_columna) espec$categorias$rotulo[match(box$cols, espec$categorias$col)] else
      intersect(opt$top2box %||% character(0), as.character(espec$categorias$rotulo))
    if (!length(ttb)) {
      aviso("la batería «", titulo, "» no declara Top Two Box; las tarjetas comparan ese indicador y van sin ellas.")
      return(NULL)
    }
    vfila <- .tarjetas_vars_bateria(vars_loc, espec, fuente$survey)
    filas_vis <- as.character(espec$filas$rotulo)
    tipo <- "bateria"
    for (k in seq_along(filas_vis)) {
      if (is.na(vfila[k])) next
      for (cr in cruces) {
        partes[[length(partes) + 1L]] <- .tarjetas_evaluar_cruce(fuente, vfila[k], cr, regla, sig$familia,
                                                                 top2box = ttb, fila_como = filas_vis[k])
      }
    }
  } else {
    var <- vars_loc[[1]]
    ind <- .sig_indicadores(fuente$data, var, survey = fuente$survey, orders_list = fuente$orders_list)
    if (is.null(ind)) return(NULL)
    filas_vis <- if (is.null(espec$rotulos)) colnames(ind$Y) else intersect(as.character(espec$rotulos), colnames(ind$Y))
    sustantivas <- .sig_filas_a_probar(filas_vis, ind$codigos, regla, solo_principal = FALSE)
    tipo <- .tarjetas_tipo(espec, ind, sustantivas)
    probar <- if (identical(tipo, "dicotomica")) sustantivas[1] else sustantivas
    for (cr in cruces) partes[[length(partes) + 1L]] <- .tarjetas_evaluar_cruce(fuente, var, cr, regla, sig$familia, filas = probar)
  }
  partes <- Filter(Negate(is.null), partes)
  if (!length(partes)) return(NULL)
  pruebas <- do.call(rbind, lapply(partes, `[[`, "pruebas"))
  celdas <- do.call(rbind, lapply(partes, `[[`, "celdas"))
  grupos <- unique(do.call(rbind, lapply(partes, `[[`, "grupos")))
  totales <- unlist(lapply(partes, `[[`, "totales"))
  totales <- totales[!duplicated(names(totales))]
  sel <- if (isTRUE(opt$todas)) .tarjetas_seleccionar_todas else .tarjetas_seleccionar
  todas <- sel(pruebas, celdas, grupos, totales, tipo, cruces,
               filas_visibles = if (identical(tipo, "dicotomica")) sustantivas else filas_vis)
  rotulos_cruce <- vapply(cruces, function(cr) if (cr %in% names(opt$rotulos)) unname(opt$rotulos[[cr]]) else .tarjetas_rotulo_var(cr, fuente$survey), character(1))
  # La fila «Total» de la tarjeta repite la cifra del gráfico (su redondeo), no una propia.
  cifras <- if (identical(tipo, "bateria") && !isTRUE(sin_columna)) stats::setNames(as.character(espec$box$cifras), filas_vis) else
    if (identical(tipo, "bateria")) stats::setNames(.tarjetas_pct(totales[filas_vis]), filas_vis) else
    stats::setNames(as.character(espec$cifras %||% character(0)), as.character(espec$rotulos %||% character(0)))
  todas <- lapply(todas, function(t) {
    t$cifra_total <- unname(cifras[t$fila])
    t$fila_es_titulo <- nzchar(titulo) && .lam_mismo_texto(t$fila, titulo)   # la tarjeta no repite el título
    # Sin columna de Top Two Box el indicador no se ve en el gráfico: la tarjeta lo nombra (`.tarjetas_indicador`).
    if (isTRUE(sin_columna)) t$indicador <- .tarjetas_indicador(ttb, opt$indicador)
    t
  })
  list(tarjetas = utils::head(todas, opt$max), total = length(todas), tipo = tipo, opcion = opt,
       filas = filas_vis, totales = totales, grupos = grupos, cruces = cruces, rotulos_cruce = rotulos_cruce,
       regla = regla)
}

#' Adjunta las tarjetas al gráfico de una lámina de total (gancho de `.lam_con_sig_en_lamina`)
#'
#' Lee del entorno del motor (`reporte_ppt_plan`, congelado) la lámina en curso, su tipo y `.resolve_ref`, igual que
#' `.sig_fuente_render`. Corre en el PPT y en la pasada del Word, así que las dos salidas dibujan las mismas tarjetas.
#' Un error no tumba la lámina: se avisa y sale sin tarjetas.
#' @keywords internal
.tarjetas_adjuntar <- function(p, env) {
  if (!inherits(p, "ggplot") || !is.environment(env)) return(p)
  if (!identical(get0("stype", envir = env, inherits = FALSE), "slide_1")) return(p)
  # La variante de fila vacía (batería de un ítem) vale sólo para la figura de su lámina: cada lámina nueva la limpia.
  if (!is.null(.tarjetas_estado$registro)) .tarjetas_estado$registro[["escala\r"]] <- NULL
  slide <- get0("slide", envir = env, inherits = FALSE)
  if (is.null(.tarjetas_opcion(slide$meta))) return(p)
  resolver <- get0(".resolve_ref", envir = env, inherits = FALSE)
  if (!is.function(resolver)) return(p)
  t <- tryCatch(.tarjetas_de_lamina(p, slide, resolver), error = function(e) {
    if (exists(".pulso_aviso", mode = "function")) {
      .pulso_aviso(sprintf("Tarjetas de diferencias: no se pudieron calcular en «%s» (%s).", slide$title %||% "",
                           conditionMessage(e)))
    }
    NULL
  })
  if (!is.null(t)) {
    attr(p, "pulso_tarjetas") <- t
    .tarjetas_registrar(p, t)
  }
  p
}

#' Firma de una figura: el tipo y las filas que dibuja (une la lámina con su figura del Word)
#'
#' El Word dibuja las baterías por otra ruta (bloques de multiapiladas) que no hereda los atributos de la lámina; la
#' figura se reconoce por sus filas. Una batería que el Word parte en piezas no casa con la lámina y va sin tarjetas.
#' @keywords internal
.tarjetas_firma <- function(p) {
  espec <- if (inherits(p, "ggplot")) attr(p, "pulso_espec") else NULL
  if (!is.list(espec)) return(NA_character_)
  filas <- if (identical(espec$tipo, "escala")) espec$filas$rotulo else espec$rotulos
  filas <- gsub("\\s+", " ", trimws(as.character(filas)))
  if (!length(filas)) return(NA_character_)
  paste(c(espec$tipo, sort(filas)), collapse = "\r")
}

#' Registra las tarjetas de una lámina para su figura del Word (el registro se vacía al empezar cada export)
#' @keywords internal
.tarjetas_registrar <- function(p, t) {
  f <- .tarjetas_firma(p)
  if (is.na(f)) return(invisible(NULL))
  if (is.null(.tarjetas_estado$registro)) .tarjetas_estado$registro <- list()
  .tarjetas_estado$registro[[f]] <- t
  # Una batería de un solo ítem igual al título: el Word la dibuja con la fila vacía (no repite el título). Se registra
  # también así; la figura del Word sigue a su lámina, de modo que la última registrada es la suya (ítem 23 de la v7 RV).
  espec <- attr(p, "pulso_espec")
  if (identical(espec$tipo, "escala") && NROW(espec$filas) == 1L) .tarjetas_estado$registro[["escala\r"]] <- t
  invisible(NULL)
}

#' Tarjetas de una figura del Word: las que heredó o, si no, las registradas con su misma firma
#' @keywords internal
.tarjetas_de_figura <- function(p) {
  t <- if (inherits(p, "ggplot")) attr(p, "pulso_tarjetas") else NULL
  if (!is.null(t)) return(t)
  f <- .tarjetas_firma(p)
  if (is.na(f) || is.null(.tarjetas_estado$registro)) return(NULL)
  t <- .tarjetas_estado$registro[[f]]
  if (!is.null(t)) return(t)
  # El Word parte una batería larga en piezas (redes sociales: 8 ítems en dos figuras): cada pieza toma, de la lámina
  # que contiene todas sus filas, las tarjetas de esas filas.
  espec <- attr(p, "pulso_espec")
  if (!identical(espec$tipo, "escala") || NROW(espec$filas) < 2L) return(NULL)
  norm <- function(x) gsub("\\s+", " ", trimws(as.character(x)))
  filas <- norm(espec$filas$rotulo)
  for (r in .tarjetas_estado$registro) {
    if (!identical(r$tipo, "bateria") || !all(filas %in% norm(r$filas))) next
    r$tarjetas <- Filter(function(x) norm(x$fila) %in% filas, r$tarjetas)
    return(if (length(r$tarjetas)) r else NULL)
  }
  NULL
}

#' El render del Word es otro gráfico que el de la lámina: hereda sus tarjetas (las calculó `.tarjetas_adjuntar`)
#' @keywords internal
.tarjetas_heredar <- function(p, origen) {
  t <- if (inherits(origen, "ggplot")) attr(origen, "pulso_tarjetas") else NULL
  if (!is.null(t) && inherits(p, "ggplot")) attr(p, "pulso_tarjetas") <- t
  p
}

#' Frase de la opción `todas` (ítem 23 de la v7 RV): va en la nota del PPT y bajo las tarjetas del Word
#' @keywords internal
.TARJETAS_FRASE_TODAS <- "Se muestran todos los grupos con base suficiente; la flecha marca solo las diferencias significativas."

#' La nota de la lámina con la frase de la opción `todas` al final (sin repetirla)
#' @keywords internal
.tarjetas_nota_todas <- function(nota) {
  v <- if (inherits(nota, "ppt_element_text")) nota$text else nota
  v <- if (is.null(v) || !length(v) || is.na(v[1])) "" else trimws(as.character(v)[1])
  if (grepl(.TARJETAS_FRASE_TODAS, v, fixed = TRUE)) return(v)
  if (!nzchar(v)) .TARJETAS_FRASE_TODAS else paste(sub("([^.])$", "\\1.", v), .TARJETAS_FRASE_TODAS)
}

#' Nombre del indicador de una batería sin columna de Top Two Box: el declarado (`indicador`) o la parte común de las
#' categorías que suma («Todos los días, en momentos puntuales» + «Todos los días, a lo largo del día» → «Todos los
#' días»); sin parte común de al menos cuatro letras, «Top Two Box».
#' @keywords internal
.tarjetas_indicador <- function(categorias, declarado = NULL) {
  if (!is.null(declarado) && nzchar(declarado)) return(declarado)
  categorias <- as.character(categorias)
  if (length(categorias) == 1L) return(categorias)
  pal <- strsplit(categorias, "\\s+")
  n <- 0L
  repeat {
    k <- n + 1L
    if (any(lengths(pal) < k) || length(unique(vapply(pal, `[`, "", k))) != 1L) break
    n <- k
  }
  comun <- sub("[,;:[:space:]]+$", "", paste(pal[[1]][seq_len(n)], collapse = " "))
  if (nchar(comun) >= 4L) comun else .PPT_ROTULO_TOP_TWO_BOX
}

#' Encabezado de una tarjeta: la fila (si no la dice el eje ni el título) y, sin columna de Top Two Box, el indicador
#' («Claude · Todos los días»; anclada a su premisa, solo «Todos los días»). NULL si no lleva.
#' @keywords internal
.tarjetas_encabezado <- function(t, con_fila = TRUE, tipo = "multiple") {
  fila <- if (isTRUE(con_fila) && !isTRUE(t$fila_es_titulo)) .tarjetas_rotulo_fila(t$fila, tipo) else NULL
  ind <- t$indicador %||% NULL
  partes <- c(fila, ind)
  if (!length(partes)) NULL else paste(partes, collapse = " \u00b7 ")
}

#' Rótulo de grupo para la tarjeta: el corto declarado, si lo hay
#' @keywords internal
.tarjetas_rotulo_grupo <- function(etiqueta, cortos) {
  # Los nombres van completos encima de su barra (Gonzalo, v7 RV); el corto declarado queda para el que no cabe en dos
  # líneas de una tarjeta angosta (unos 60 caracteres).
  if (!length(cortos)) return(etiqueta)
  # La tarjeta compacta (nombre a la izquierda de la barra) usa el corto declarado siempre que lo haya.
  largo <- if (.lam_tarjeta_compacta()) etiqueta %in% names(cortos) else nchar(etiqueta) > 60
  out <- etiqueta
  out[largo] <- ifelse(is.na(cortos[etiqueta[largo]]), etiqueta[largo], unname(cortos[etiqueta[largo]]))
  out
}

#' Rótulo de la fila en la tarjeta: la categoría tal cual
#' @keywords internal
.tarjetas_rotulo_fila <- function(fila, tipo) {
  # Sin comillas en ningún tipo (ítem 9 de la v7.11 RV: «no me gusta que tenga comillas»).
  fila
}

#' Cifra entera con «%»
#' @keywords internal
.tarjetas_pct <- function(x) ifelse(is.finite(x), paste0(floor(round(x, 6) + 0.5), "%"), "\u2014")   # 100 × 0.365 = 36.4999…
