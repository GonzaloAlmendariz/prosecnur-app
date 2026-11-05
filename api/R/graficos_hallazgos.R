# Hallazgos clave: el modelo de la lámina de cifras (especificación CCSS del 2026-11-04, §2)
# ========================================================================================
#
# Un mismo tipo de lámina (`p_slide_hallazgos`) en cuatro modos (los dos últimos, el resumen ejecutivo, en
# graficos_hallazgos_resumen.R):
#   - `cifras`: hasta seis cifras en una cuadrícula de 3 × 2 (con cuatro, 2 × 2), para abrir o cerrar el informe;
#   - `cifras_con_graficos`: hasta tres cifras arriba y, debajo de cada una, su gráfico de apoyo; o un solo gráfico de
#     ancho completo (`grafico_ancho`), para abrir un capítulo;
#   - `resumen`: la tabla ejecutiva por capítulo (maqueta V1 del 2026-11-04), al final del mazo;
#   - `titulares`: un titular por capítulo en una sola lámina (maqueta V3).
#
# Cada cifra:
#   - es el porcentaje de `fila` (o de la suma de `filas`, o del Top Two Box con `top2box`) sobre su base, con el mismo
#     indicador por caso que la prueba (`.dif_indicador`, que reproduce la tabla de frecuencias): coincide con la cifra
#     de la lámina de esa pregunta;
#   - lleva su intervalo de 95% con el diseño del estudio (`.intervalo_diseno`, conglomerado de la regla); para una suma
#     de filas, el intervalo de la suma;
#   - dice su base cuando difiere de la de la lámina («Base de 140»);
#   - con `comparacion = "auto"`, la diferencia de mayor prioridad de esa fila frente al resto (la prueba de las tarjetas
#     con la familia del informe); sin diferencias, «Sin diferencias por área, nivel ni sexo», solo si se probó. Un
#     texto escrito a mano no lo verifica el motor: lo avisa, y si contradice la prueba lo avisa como contradicción.
#
# El gráfico de apoyo admite los graficadores de barras de la familia «categorías». Lo dibuja la lámina (no el
# graficador): escala fija de 0 al máximo común, línea roja del total y la marca de tarjeta en el grupo que difiere. Por
# cruce, solo los grupos con la base y los conglomerados mínimos de la regla.
#
# El dibujo nativo vive en `lamina_hallazgos.R`; el enganche es el de la lámina de resumen (`.lam_dif_slide_1`).

.HALLAZGOS_MAX <- c(cifras = 6L, cifras_con_graficos = 3L)
.HALLAZGOS_GRAFICADORES <- c("p_barras_agrupadas", "p_barras_categoricas", "p_dicotomica", "p_lollipop")

#' Normaliza una cifra del payload
#' @keywords internal
.halla_kpi_item <- function(x) {
  x <- as.list(x %||% list())
  it <- .dif_item(x)
  comp <- x$comparacion
  comp <- if (is.null(comp) || isTRUE(comp)) "auto" else if (identical(comp, FALSE)) "ninguna" else (.dif_chr1(comp) %||% "auto")
  it$texto <- .dif_chr1(x$texto)
  it$comparacion <- comp
  it$grafico <- if (is.list(x$grafico) && length(x$grafico)) x$grafico else NULL
  it$base_texto <- .dif_chr1(x[["base"]])   # `x$base` completaba a `base_rotulo` y la base salía «que trabajan»
  it
}

#' Filtra la fuente con los filtros nombrados de la cifra o del gráfico
#' @keywords internal
.halla_filtrar <- function(fuente, filtros) {
  if (!length(filtros)) return(fuente)
  fuente$data <- .apply_named_filters(fuente$data, filters = .ppt_norm_filters(filtros), arg_name = "filtros", mode = "strict")
  fuente
}

#' Rótulos de cruce en minúscula unidos para el lector: «área, nivel ni sexo»
#' @keywords internal
.halla_lista_ni <- function(x) {
  x <- tolower(x)
  if (length(x) <= 1L) return(x)
  paste0(paste(x[-length(x)], collapse = ", "), " ni ", x[length(x)])
}

#' La comparación automática: la tarjeta de mayor prioridad de la fila
#'
#' Con dos grupos, los dos (el otro es el resto); con más, el grupo de mayor diferencia y la cifra del resto.
#' @return `list(partes = list(list(texto, dir, fragil)), cola, estado)`; `estado` es «diferencia», «sin_diferencias» o
#'   «sin_prueba».
#' @keywords internal
.halla_comparacion_auto <- function(ev, cx) {
  ce <- ev$celdas
  dif <- ce[ce$estado == "dif", , drop = FALSE]
  if (!nrow(dif)) {
    if (!length(ev$probados)) return(list(partes = list(), cola = NULL, estado = "sin_prueba"))
    rot <- unname(cx$rotulos[ev$probados])
    return(list(partes = list(list(texto = paste("Sin diferencias por", .halla_lista_ni(rot)), dir = NULL, fragil = NA)),
                cola = NULL, estado = "sin_diferencias"))
  }
  fuerza <- vapply(split(dif, dif$cruce), function(d) 1000 * as.numeric(any(!d$fragil)) + max(abs(d$valor)), numeric(1))
  cr <- names(fuerza)[which.max(fuerza)]
  d <- dif[dif$cruce == cr, , drop = FALSE]
  K <- sum(ce$cruce == cr)
  corto <- function(e) .dif_corto(e, cx$cortos)
  if (K == 2L) {
    d <- d[order(-d$valor), , drop = FALSE]
    partes <- lapply(seq_len(nrow(d)), function(i) list(texto = paste(corto(d$etiqueta[i]), .tarjetas_pct(d$p[i])), dir = d$dir[i], fragil = d$fragil[i]))
    return(list(partes = partes, cola = NULL, estado = "diferencia", cruce = cr))
  }
  i <- which.max(abs(d$valor))
  list(partes = list(list(texto = paste0(corto(d$etiqueta[i]), ": ", .tarjetas_pct(d$p[i])), dir = d$dir[i], fragil = d$fragil[i])),
       cola = paste0("frente al ", .tarjetas_pct(d$p_resto[i]), " del resto"), estado = "diferencia", cruce = cr)
}

#' ¿Un texto escrito a mano contradice la prueba? Dice «sin diferencias» y la prueba marca, o marca y la prueba no
#' @keywords internal
.halla_contradice <- function(texto, estado) {
  t <- tolower(texto)
  dice_ninguna <- grepl("sin diferencia|no difiere|no hay diferencia|ninguna diferencia", t)
  dice_alguna <- grepl("[▲▼△▽]|m[aá]s que el resto|menos que el resto|mayor que|menor que|difiere", t) && !dice_ninguna
  (dice_ninguna && identical(estado, "diferencia")) || (dice_alguna && identical(estado, "sin_diferencias"))
}

#' Datos del gráfico de apoyo de una cifra
#'
#' @param g `list(graficador, args, titulo, base)` del payload.
#' @param kpi Ítem de la cifra (para reusar su fila si el gráfico es de la misma pregunta).
#' @param con_intervalo Calcula el intervalo de cada barra (el gráfico de ancho completo lo dibuja).
#' @return `list(filas, total, titulo, base, cruce, notas)` o NULL si no se puede dibujar.
#' @keywords internal
.halla_grafico_datos <- function(fuente0, g, kpi, sig, cx, tauto, con_intervalo = FALSE) {
  aviso <- function(...) .dif_aviso("Hallazgos clave", ...)
  regla <- sig$regla
  graf <- .dif_chr1(g$graficador) %||% "p_barras_agrupadas"
  if (!graf %in% .HALLAZGOS_GRAFICADORES) {
    aviso("el gráfico de apoyo «", graf, "» no es de barras de la familia «categorías»; la cifra va sin gráfico.")
    return(NULL)
  }
  a <- as.list(g$args %||% list())
  var <- .sig_var_local(a$var %||% (if (!is.null(kpi)) kpi$var))
  if (is.na(var)) return(NULL)
  cruce <- .dif_chr(a$cruces %||% a$cruce)
  cruce <- if (length(cruce)) .sig_var_local(cruce[1]) else NULL
  fuente <- .halla_filtrar(fuente0, a$filtros %||% list())
  misma <- !is.null(kpi) && identical(.sig_var_local(kpi$var), var)
  orden_mayor <- identical(.dif_chr1((a$overrides %||% list())$orden_barras), "mayor_menor")
  titulo <- .dif_chr1(g$titulo)
  if (!is.null(cruce)) {
    it <- if (misma) kpi else .dif_item(list(var = var, fila = a$fila, filas = a$filas, top2box = a$top2box %||% a$top2box_labels))
    fi <- .dif_indicador(fuente, it, regla)
    if (!is.null(fi$excluir)) { aviso("el gráfico de «", var, "» no se dibuja: ", fi$excluir, "."); return(NULL) }
    ev <- .dif_evaluar(fuente, fi, cruce, sig, tauto)
    ce <- ev$celdas
    if (!nrow(ce)) { aviso("el cruce «", cruce, "» no tiene grupos en la base."); return(NULL) }
    cmin <- if (identical(regla$prueba, "rao_scott")) (regla$conglomerados_minimos %||% 8L) else 0L
    comparable <- ce$n >= (regla$base_minima %||% 30) & (is.na(ce$conglomerados) | ce$conglomerados >= cmin)
    fuera <- ce$etiqueta[!comparable]
    ce <- ce[comparable, , drop = FALSE]
    filas <- data.frame(rotulo = .dif_corto(ce$etiqueta, cx$cortos), p = ce$p, estado = ce$estado, dir = ce$dir,
                        fragil = ce$fragil, n = ce$n, stringsAsFactors = FALSE)
    if (con_intervalo) {
      gr <- .sig_grupos_cruce(fuente, cruce)
      iv <- lapply(ce$codigo, function(cd) .intervalo_diseno_fuente(fuente, ifelse(!is.na(gr$g) & gr$g == cd, fi$y, NA_real_), regla))
      filas$inferior <- vapply(iv, function(x) 100 * x$inferior, 0); filas$superior <- vapply(iv, function(x) 100 * x$superior, 0)
    }
    rc <- cx$rotulos[[cruce]] %||% .tarjetas_rotulo_var(cruce, fuente$survey)
    ns <- format(filas$n, big.mark = ",")
    base <- .dif_chr1(g$base) %||% sprintf("Base: %s. Casos por %s: %s", format(fi$n, big.mark = ","), tolower(rc),
                                           if (length(ns) > 1L) paste0(paste(ns[-length(ns)], collapse = ", "), " y ", ns[length(ns)]) else ns)
    notas <- if (length(fuera)) sprintf("No se muestran %s: menos de %s casos o de %s %ss.", paste(fuera, collapse = ", "),
                                        format(regla$base_minima %||% 30), format(cmin), .sig_nombre_conglomerado(regla$conglomerado)) else NULL
    return(list(filas = filas, total = fi$total, titulo = titulo %||% paste0(kpi$texto %||% .tarjetas_rotulo_var(var, fuente$survey), ", según ", tolower(rc)),
                base = base, cruce = cruce, notas = notas, n_fuera = length(fuera), diferencias = any(filas$estado == "dif")))
  }
  ind <- tryCatch(.sig_indicadores(fuente$data, .reporte_plan_resolve_recod_var(var, fuente$data), survey = fuente$survey,
                                   orders_list = fuente$orders_list), error = function(e) NULL)
  if (is.null(ind)) { aviso("la pregunta «", var, "» del gráfico de apoyo no está en la base."); return(NULL) }
  cats <- .sig_filas_a_probar(colnames(ind$Y), ind$codigos, regla, solo_principal = FALSE)
  w <- ind$w %||% rep(1, nrow(ind$Y))
  p <- vapply(cats, function(cl) .dif_prop(ind$Y[, cl], w, rep(TRUE, nrow(ind$Y))), 0)
  filas <- data.frame(rotulo = cats, p = unname(p), estado = "igual", dir = NA_character_, fragil = NA, n = NA_real_, stringsAsFactors = FALSE)
  marcas <- character(0)
  if (con_intervalo) {
    iv <- lapply(cats, function(cl) .intervalo_diseno_fuente(fuente, ind$Y[, cl], regla))
    filas$inferior <- vapply(iv, function(x) 100 * x$inferior, 0); filas$superior <- vapply(iv, function(x) 100 * x$superior, 0)
    # Qué opción difiere entre grupos (para la nota del costado): la misma prueba, opción por opción.
    v2 <- .reporte_plan_resolve_recod_var(var, fuente$data)
    for (cl in cats) {
      fi <- .dif_indicador(fuente, .dif_item(list(var = v2, fila = cl)), regla)
      if (!is.null(fi$excluir)) next
      ev <- .dif_evaluar(fuente, fi, cx$cruces, sig, tauto)
      d <- ev$celdas[ev$celdas$estado == "dif", , drop = FALSE]
      if (nrow(d)) {
        i <- which.max(abs(d$valor))
        marcas <- c(marcas, sprintf("«%s»: %s en %s.", cl, if (identical(d$dir[i], "up")) "mayor" else "menor",
                                    .dif_corto(d$etiqueta[i], cx$cortos)))
        filas$estado[filas$rotulo == cl] <- "dif"; filas$dir[filas$rotulo == cl] <- d$dir[i]; filas$fragil[filas$rotulo == cl] <- d$fragil[i]
      }
    }
  }
  # Orden del instrumento por defecto: las columnas del indicador salen en el orden en que aparecen en la base, y una
  # escala de apoyo («Pésima» … «Excelente») se leía desarmada (CCSS v7.6, hallazgos 2). `mayor_menor` lo cambia.
  ol <- (fuente$orders_list %||% list())[[.reporte_plan_resolve_recod_var(var, fuente$data)]] %||% (fuente$orders_list %||% list())[[var]]
  pos <- if (!is.null(ol$labels)) match(filas$rotulo, ol$labels) else suppressWarnings(as.numeric(unlist(ind$codigos[filas$rotulo])))
  if (any(!is.na(pos))) filas <- filas[order(is.na(pos), pos), , drop = FALSE]
  if (orden_mayor) filas <- filas[order(-filas$p), , drop = FALSE]
  n <- sum(ind$en_base & w > 0)
  multiple <- identical(ind$tipo, "sm")
  base <- .dif_chr1(g$base) %||% sprintf("Base: %s%s", format(n, big.mark = ","), if (multiple) ". Respuesta múltiple." else ".")
  nota_lado <- if (con_intervalo) {
    if (length(marcas)) paste(c("Difieren entre grupos con la regla del informe:", utils::head(marcas, 3L)), collapse = " ")
    else "Ninguna opción difiere entre grupos con la regla del informe."
  } else NULL
  list(filas = filas, total = NULL, titulo = titulo %||% .tarjetas_rotulo_var(var, fuente$survey), base = base, cruce = NULL,
       notas = NULL, nota_lado = nota_lado, n_fuera = 0L, diferencias = length(marcas) > 0L)
}

#' Una cifra calculada: valor, intervalo, base, comparación y gráfico
#' @keywords internal
.halla_kpi_modelo <- function(fuente0, it, sig, cx, tauto, n_lamina, con_grafico) {
  aviso <- function(...) .dif_aviso("Hallazgos clave", ...)
  regla <- sig$regla
  fuente <- .halla_filtrar(fuente0, it$filtros)
  fi <- .dif_indicador(fuente, it, regla)
  if (!is.null(fi$excluir)) { aviso("la cifra de «", it$var, "» queda fuera: ", fi$excluir, "."); return(NULL) }
  texto <- it$texto
  if (is.null(texto)) {
    texto <- sprintf("respondió «%s»", fi$key)
    aviso("la cifra de «", it$var, "» no tiene texto: se usó «", texto, "». Escribe lo que mide.")
  }
  if (grepl("índice", tolower(texto))) aviso("la cifra «", texto, "» nombra un índice: el texto debe decir qué se midió, no un índice sin definir.")
  iv <- .intervalo_diseno_fuente(fuente, fi$y, regla)
  base <- it$base_texto %||% if (is.finite(fi$n) && fi$n != n_lamina) paste0("Base de ", format(fi$n, big.mark = ","), if (is.null(it$base_rotulo)) "" else paste0(" ", it$base_rotulo)) else NULL
  ev <- if (is.null(.sig_diseno_invalido(fuente$data, regla))) .dif_evaluar(fuente, fi, cx$cruces, sig, tauto) else list(celdas = data.frame(estado = character()), probados = character(0))
  auto <- .halla_comparacion_auto(ev, cx)
  comp <- if (identical(it$comparacion, "auto")) auto else if (identical(it$comparacion, "ninguna")) NULL else {
    if (.halla_contradice(it$comparacion, auto$estado)) {
      aviso("la comparación escrita a mano de «", texto, "» («", it$comparacion, "») contradice la prueba del informe; revísala.")
    } else {
      aviso("la comparación de «", texto, "» está escrita a mano («", it$comparacion, "»); el motor no la verifica.")
    }
    list(partes = list(list(texto = it$comparacion, dir = NULL, fragil = NA)), cola = NULL, estado = "manual")
  }
  if (!is.null(comp) && identical(comp$estado, "sin_prueba")) comp <- NULL
  tambien <- if (identical(it$comparacion, "auto")) .halla_tambien(ev, auto, cx) else NULL
  graf <- if (isTRUE(con_grafico) && !is.null(it$grafico)) .halla_grafico_datos(fuente, it$grafico, it, sig, cx, tauto) else NULL
  list(var = fi$var, fila = fi$key, valor = fi$total, cifra = .tarjetas_pct(fi$total), texto = texto, intervalo = iv,
       intervalo_texto = .intervalo_texto(iv), n = fi$n, base = base, comparacion = comp, tambien = tambien, grafico = graf,
       tipo_pregunta = fi$tipo, sumar = fi$sumar)
}

#' «También»: la diferencia más fuerte de OTRO cruce que el de la comparación automática
#'
#' Con dos grupos, el que está sobre el resto (el otro es su espejo); con más, el grupo que más se aleja.
#' @return `list(texto, dir, fragil, cruce)` o NULL si ningún otro cruce difiere.
#' @keywords internal
.halla_tambien <- function(ev, auto, cx) {
  if (!identical(auto$estado, "diferencia") || is.null(auto$cruce)) return(NULL)
  ce <- ev$celdas
  dif <- ce[ce$estado == "dif" & ce$cruce != auto$cruce, , drop = FALSE]
  if (!nrow(dif)) return(NULL)
  fuerza <- vapply(split(dif, dif$cruce), function(d) 1000 * as.numeric(any(!d$fragil)) + max(abs(d$valor)), numeric(1))
  d <- dif[dif$cruce == names(fuerza)[which.max(fuerza)], , drop = FALSE]
  i <- if (sum(ce$cruce == d$cruce[1]) == 2L && any(d$dir == "up")) which(d$dir == "up")[1] else which.max(abs(d$valor))
  list(texto = paste(.dif_corto(d$etiqueta[i], cx$cortos), .tarjetas_pct(d$p[i])), dir = d$dir[i], fragil = d$fragil[i], cruce = d$cruce[i])
}

#' Nota al pie fija de la lámina de hallazgos: qué es la barra o el intervalo, y el método de diferencias
#' @keywords internal
.halla_nota <- function(regla, m, modo, n_fuera = 0L) {
  disenio <- if (!is.null(regla$conglomerado) && nzchar(regla$conglomerado %||% "")) sprintf("calculado con el diseño por %s", .sig_nombre_conglomerado(regla$conglomerado)) else
    "calculado como muestreo aleatorio simple"
  cabeza <- if (identical(modo, "cifras")) {
    sprintf("La barra va de 0%% a 100%%: el punto es la cifra y la franja azul, su intervalo de 95%% %s. ", disenio)
  } else {
    paste0(sprintf("Cifras con su intervalo de 95%% %s. ", disenio),
           "En las barras, el color y la flecha marcan al grupo que difiere del resto. ",
           if (n_fuera > 0L) "No se muestran los grupos con menos casos o conglomerados que los mínimos de la regla. " else "")
  }
  paste0(cabeza, .dif_texto_metodo(regla, m))
}

#' Modelo de la lámina de hallazgos (puro sobre la fuente, la regla y la familia)
#' @return Espec `tipo = "hallazgos"`.
#' @keywords internal
.halla_modelo <- function(el, fuente, sig, plan = list()) {
  aviso <- function(...) .dif_aviso("Hallazgos clave", ...)
  if (isTRUE(.dif_chr1(el$modo) %in% .HALLAZGOS_MODOS_RESUMEN)) return(.halla_resumen_modelo(el, fuente, sig, plan))   # graficos_hallazgos_resumen.R
  modo <- if (identical(.dif_chr1(el$modo), "cifras_con_graficos")) "cifras_con_graficos" else "cifras"
  cx <- .dif_cruces(el, plan, sig, fuente)
  tauto <- el$tautologicos %||% list()
  items <- lapply(el$cifras %||% list(), .halla_kpi_item)
  tope <- .HALLAZGOS_MAX[[modo]]
  if (length(items) > tope) {
    aviso(sprintf("el modo «%s» admite hasta %d cifras; se dibujan las primeras %d de %d.", modo, tope, tope, length(items)))
    items <- items[seq_len(tope)]
  }
  ancho <- if (identical(modo, "cifras_con_graficos") && is.list(el$grafico_ancho) && length(el$grafico_ancho)) el$grafico_ancho else NULL
  n_lamina <- nrow(fuente$data)
  kpis <- Filter(Negate(is.null), lapply(items, .halla_kpi_modelo, fuente0 = fuente, sig = sig, cx = cx, tauto = tauto,
                                          n_lamina = n_lamina, con_grafico = identical(modo, "cifras_con_graficos") && is.null(ancho)))
  if (!length(kpis)) aviso("escribe al menos una cifra completa: la pregunta, la respuesta y el texto.")
  g_ancho <- if (!is.null(ancho)) .halla_grafico_datos(fuente, ancho, NULL, sig, cx, tauto, con_intervalo = TRUE) else NULL
  n_fuera <- sum(vapply(kpis, function(k) as.integer(k$grafico$n_fuera %||% 0L), 0L))
  list(tipo = "hallazgos", modo = modo, kpis = kpis, grafico_ancho = g_ancho, regla = sig$regla, m = sig$m %||% NA_integer_,
       n = n_lamina, publico = cx$publico, nota = .halla_nota(sig$regla, sig$m, modo, n_fuera))
}

# ---- elemento y render ----------------------------------------------------------------------------------------------

#' Elemento del plan de la lámina de hallazgos (lo construye `p_slide_hallazgos`)
#' @keywords internal
.el_hallazgos <- function(cifras = list(), modo = "cifras", grafico_ancho = NULL, cruces = NULL, rotulos = list(), cortos = list(),
                          tautologicos = list(), publico = NULL, fuente = NULL, capitulos = list(), seleccion = "manual",
                          max_por_capitulo = NULL, max_por_lamina = NULL, tambien = TRUE, titulos = NULL) {
  # Una cifra o un capítulo sueltos son una lista de uno: el rearmado del plan JSON los desenvuelve (graficos_resumen_diferencias.R).
  cifras <- .dif_lista_registros(cifras, "var")
  capitulos <- .dif_lista_registros(capitulos, c("titulo", "cifras", "titular"))
  el <- list(.element_type = "hallazgos", cifras = cifras, modo = modo, grafico_ancho = grafico_ancho, cruces = cruces,
             rotulos = rotulos, cortos = cortos, tautologicos = tautologicos, publico = publico, fuente_ref = fuente,
             capitulos = capitulos, seleccion = seleccion, max_por_capitulo = max_por_capitulo, max_por_lamina = max_por_lamina,
             tambien = tambien, titulos = titulos, overrides = list())
  class(el) <- c("ppt_element", "list")
  el
}

#' Renderer del motor: calcula el modelo y devuelve el ggplot de respaldo con la espec
#' @keywords internal
.render_hallazgos <- function(el, preset_args = list()) {
  fuente <- .dif_fuente_render(el$fuente_ref)
  sig <- .sig_contexto_render(fuente$data)
  plan_motor <- .dif_plan_render()   # antes de llamar: dentro del modelo, `plan` es una promesa y dynGet la encontraría
  .halla_ggplot(.halla_modelo(el, fuente, sig, plan_motor))
}

#' Respaldo en ggplot (Word y `motor_nativo = FALSE`): cada cifra con su intervalo, como puntos con su rango
#' @keywords internal
.halla_ggplot <- function(espec) {
  if (isTRUE(espec$modo %in% .HALLAZGOS_MODOS_RESUMEN)) return(.halla_res_ggplot(espec))   # tabla del Word (reporte_word_hallazgos_resumen.R)
  ks <- espec$kpis
  if (!length(ks)) {
    p <- ggplot2::ggplot() + ggplot2::annotate("text", x = 0, y = 0, label = "Sin cifras", colour = .std_color("texto_suave")) + ggplot2::theme_void()
    attr(p, "pulso_espec") <- espec
    return(p)
  }
  df <- data.frame(
    rotulo = vapply(ks, function(k) paste(k$cifra, k$texto), ""),
    p = vapply(ks, function(k) k$valor, 0),
    lo = vapply(ks, function(k) 100 * (k$intervalo$inferior %||% NA_real_), 0),
    hi = vapply(ks, function(k) 100 * (k$intervalo$superior %||% NA_real_), 0),
    comp = vapply(ks, function(k) paste(strwrap(paste(c(vapply(k$comparacion$partes %||% list(), `[[`, "", "texto"), k$comparacion$cola), collapse = " "), 28), collapse = "\n"), ""),
    stringsAsFactors = FALSE)
  df$rotulo <- factor(df$rotulo, levels = rev(df$rotulo))
  p <- ggplot2::ggplot(df, ggplot2::aes(y = .data$rotulo)) +
    ggplot2::geom_segment(ggplot2::aes(x = .data$lo, xend = .data$hi, yend = .data$rotulo), linewidth = 2.2, colour = .std_color("azul_medio"), lineend = "round") +
    ggplot2::geom_point(ggplot2::aes(x = .data$p), size = 2.6, colour = .std_color("azul")) +
    ggplot2::geom_text(ggplot2::aes(x = 101, label = .data$comp), hjust = 0, size = 8 / ggplot2::.pt, colour = .std_color("texto_suave")) +
    ggplot2::scale_x_continuous(limits = c(0, 175), breaks = c(0, 25, 50, 75, 100), labels = function(x) paste0(x, "%")) +
    ggplot2::labs(x = NULL, y = NULL, caption = espec$nota) + ggplot2::theme_minimal(base_size = 9) +
    ggplot2::theme(panel.grid.minor = ggplot2::element_blank(), panel.grid.major.y = ggplot2::element_blank(),
                   axis.text = ggplot2::element_text(colour = .std_color("azul")),
                   plot.caption = ggplot2::element_text(colour = .std_color("texto_suave"), hjust = 0))
  attr(p, "pulso_espec") <- espec
  attr(p, "alto_word") <- 0.8 + 0.45 * nrow(df)
  p
}
