# =============================================================================
# graficos_regla_preguntas.R — las láminas de resumen eligen sus preguntas con una regla (ADR 0135)
# =============================================================================
#
# Un panorama de tres públicos pedía 157 clics: las preguntas se agregaban una por una. Con `regla` el graficador de
# resumen (`p_panorama`, `p_dumbbell` y `p_barras_divergentes` en estilo resumen) declara cómo se eligen:
#
#   regla = list(tipo, n, umbral, agregar, quitar)
#
# Tipos: `todas`, `comunes`, `mayor_diferencia`, `diferencia_minima`, `mayor_sin_info`, `bajo_umbral`, `extremos` y
# `a_mano`. `agregar` y `quitar` son el ajuste a mano y se aplican después de la regla. Sin `regla` el graficador
# conserva su contrato (las `vars` declaradas).
#
# Tres piezas, una sola definición:
#   - `.regla_preguntas_normalizar()` valida la regla (E_REGLA_PREGUNTAS_INVALIDA).
#   - `.regla_preguntas_evaluar()` es PURA: de la tabla de indicadores a los temas elegidos, su métrica y el texto
#     de la nota («Se muestran las 13 de mayor diferencia, de 47 preguntas comunes.»).
#   - `.regla_preguntas_de_elemento()` arma la tabla desde las fuentes del estudio para un elemento ya construido.
#     La usan el render y el endpoint de conteo (router_graficos_regla.R), así que la nota, la lámina y el contador
#     no pueden discrepar.
#
# La diferencia es la del contraste (`.contraste_diferencia`, graficos_espec_contraste.R) sobre las cifras redondeadas
# como se leen en la lámina; «Sin información» se detecta con `.graficos_no_sustantivos`, el único detector. La escala
# del resumen es la excepción deliberada: mide con la tabla que pinta su lámina (graficos_regla_divergentes.R).

.REGLA_PREGUNTAS_TIPOS <- c("todas", "comunes", "mayor_diferencia", "diferencia_minima", "mayor_sin_info",
                            "bajo_umbral", "extremos", "a_mano")
.REGLA_PREGUNTAS_CON_N <- c("mayor_diferencia", "mayor_sin_info", "extremos")
.REGLA_PREGUNTAS_CON_UMBRAL <- c("diferencia_minima", "bajo_umbral")
# Los que comparan grupos: su universo son las preguntas con valor en todos los grupos.
.REGLA_PREGUNTAS_ENTRE_GRUPOS <- c("comunes", "mayor_diferencia", "diferencia_minima")

#' Error de una regla inválida
#' @keywords internal
.regla_preguntas_falla <- function(mensaje, details = NULL) {
  stop_api(400, "E_REGLA_PREGUNTAS_INVALIDA", mensaje, details)
}

#' Lista de temas desde JSON o R: vector, lista o vacío
#' @keywords internal
.regla_preguntas_chr <- function(x) {
  if (is.null(x)) return(character(0))
  v <- trimws(as.character(unlist(x, use.names = FALSE)))
  unique(v[!is.na(v) & nzchar(v)])
}

#' Valida la regla de selección de preguntas
#'
#' @param regla Lista `{tipo, n, umbral, agregar, quitar}` (o una fila rectangularizada por jsonlite). `NULL`, o una
#'   regla sin tipo, devuelve `NULL`: el graficador conserva su contrato de siempre.
#' @return Lista normalizada `list(tipo, n, umbral, agregar, quitar)` o `NULL`.
#' @keywords internal
.regla_preguntas_normalizar <- function(regla) {
  if (is.null(regla) || !length(regla)) return(NULL)
  if (is.data.frame(regla)) {
    if (nrow(regla) != 1L) .regla_preguntas_falla("La regla de preguntas debe ser un solo objeto.")
    regla <- lapply(as.list(regla), function(v) if (is.list(v) && length(v) == 1L) v[[1]] else v)
  }
  if (!is.list(regla) || is.null(names(regla))) .regla_preguntas_falla("La regla de preguntas debe ser un objeto con `tipo`.")
  tipo <- regla[["tipo"]]
  tipo <- if (is.null(tipo) || !length(tipo)) "" else trimws(as.character(unlist(tipo))[1])
  if (is.na(tipo) || !nzchar(tipo)) return(NULL)
  if (!tipo %in% .REGLA_PREGUNTAS_TIPOS) {
    .regla_preguntas_falla(sprintf("Tipo de regla desconocido: «%s». Usa uno de: %s.", tipo, paste(.REGLA_PREGUNTAS_TIPOS, collapse = ", ")),
                           list(tipo = tipo))
  }
  escalar <- function(nm) {
    v <- regla[[nm]]
    if (is.null(v) || !length(v)) return(NA_real_)
    v <- unlist(v, use.names = FALSE)[1]
    if (is.character(v) && !nzchar(trimws(v))) return(NA_real_)
    suppressWarnings(as.numeric(v))
  }
  n <- escalar("n"); umbral <- escalar("umbral")
  if (tipo %in% .REGLA_PREGUNTAS_CON_N) {
    if (!is.finite(n) || n < 1 || n != round(n)) {
      .regla_preguntas_falla(sprintf("La regla «%s» necesita `n`, un entero de 1 en adelante.", tipo), list(tipo = tipo))
    }
  } else n <- NA_real_
  if (tipo %in% .REGLA_PREGUNTAS_CON_UMBRAL) {
    if (!is.finite(umbral) || umbral < 0 || umbral > 100) {
      .regla_preguntas_falla(sprintf("La regla «%s» necesita `umbral`, un porcentaje entre 0 y 100.", tipo), list(tipo = tipo))
    }
  } else umbral <- NA_real_
  agregar <- .regla_preguntas_chr(regla[["agregar"]]); quitar <- .regla_preguntas_chr(regla[["quitar"]])
  if (identical(tipo, "a_mano") && !length(agregar)) {
    .regla_preguntas_falla("La regla «a_mano» necesita al menos una pregunta en `agregar`.", list(tipo = tipo))
  }
  list(tipo = tipo, n = if (is.finite(n)) as.integer(n) else NULL, umbral = if (is.finite(umbral)) umbral else NULL,
       agregar = agregar, quitar = quitar)
}

# ---- Textos de la nota -------------------------------------------------------

.REGLA_PREGUNTAS_NUMEROS <- c("uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez")

#' Cifra con el formato del motor («1,234»)
#' @keywords internal
.regla_preguntas_cifra <- function(x) .dumbbell_fmt_casos(x)

#' Umbral como se escribe: entero sin decimales, si no con uno
#' @keywords internal
.regla_preguntas_umbral_txt <- function(u) if (u == round(u)) .dumbbell_fmt_casos(u) else .pulso_fmt_half_up(u, 1L)

#' «preguntas de escala» en singular («pregunta de escala»), «preguntas comunes» → «pregunta común»
#' @keywords internal
.regla_preguntas_singular <- function(universo) {
  u <- sub("^preguntas\\b", "pregunta", universo)
  sub("\\bcomunes\\b", "común", u)
}

#' «de 47 preguntas comunes» / «de 1 pregunta común»
#' @keywords internal
.regla_preguntas_de_total <- function(total, universo) {
  sprintf("de %s %s", .regla_preguntas_cifra(total), if (total == 1) .regla_preguntas_singular(universo) else universo)
}

#' Texto de la nota de la regla
#'
#' @param k Cuántas de las que elige la regla quedan después del ajuste a mano (las que se dibujan por la regla).
#' @param agregadas Cuántas se agregaron a mano sin cumplir la regla (se dicen aparte).
#' @param altas,bajas Para `extremos`, cuántas altas y cuántas bajas.
#' @keywords internal
.regla_preguntas_texto <- function(regla, k, total, universo, n_grupos = 1L, grupos_unidad = "públicos",
                                   altas = 0L, bajas = 0L, ajustada = FALSE, agregadas = 0L) {
  de_total <- .regla_preguntas_de_total(total, universo)
  una <- k == 1
  muestra <- if (una) "Se muestra" else "Se muestran"
  cifra <- .regla_preguntas_cifra(k)
  txt <- switch(regla$tipo,
    todas = if (!total) sprintf("No hay %s.", universo)
            else if (una) sprintf("Se muestra 1 %s.", .regla_preguntas_singular(universo))
            else sprintf("Se muestran las %s %s.", cifra, universo),
    comunes = {
      a_los <- if (n_grupos >= 2L && n_grupos <= length(.REGLA_PREGUNTAS_NUMEROS)) .REGLA_PREGUNTAS_NUMEROS[n_grupos] else .regla_preguntas_cifra(n_grupos)
      cola <- sprintf("a los %s %s", a_los, grupos_unidad)
      if (!k) sprintf("No hay preguntas comunes %s.", cola)
      else if (una) sprintf("Se muestra 1 pregunta común %s.", cola)
      else sprintf("Se muestran las %s preguntas comunes %s.", cifra, cola)
    },
    mayor_diferencia = if (!k) sprintf("No hay preguntas con diferencia, %s.", de_total)
                       else if (una) sprintf("Se muestra la de mayor diferencia, %s.", de_total)
                       else sprintf("Se muestran las %s de mayor diferencia, %s.", cifra, de_total),
    diferencia_minima = {
      u <- regla$umbral
      dif <- sprintf("con diferencia de al menos %s %s", .regla_preguntas_umbral_txt(u), if (u == 1) "punto" else "puntos")
      if (!k) sprintf("Ninguna %s, %s.", dif, de_total)
      else sprintf("%s %s %s, %s.", muestra, if (una) "1" else paste("las", cifra), dif, de_total)
    },
    mayor_sin_info = if (!k) sprintf("No hay preguntas con Sin información, %s.", de_total)
                     else if (una) sprintf("Se muestra la de más Sin información, %s.", de_total)
                     else sprintf("Se muestran las %s con más Sin información, %s.", cifra, de_total),
    bajo_umbral = {
      bajo <- sprintf("bajo %s%%", .regla_preguntas_umbral_txt(regla$umbral))
      if (!k) sprintf("Ninguna queda %s, %s.", bajo, de_total)
      else sprintf("%s %s %s, %s.", muestra, if (una) "1" else paste("las", cifra), bajo, de_total)
    },
    extremos = {
      parte <- function(m, cual) if (m == 1) sprintf("la más %s", cual) else sprintf("las %s más %ss", .regla_preguntas_cifra(m), cual)
      piezas <- c(if (altas > 0) parte(altas, "alta"), if (bajas > 0) parte(bajas, "baja"))
      if (!length(piezas)) sprintf("No hay %s.", universo)
      else sprintf("%s %s, %s.", if (altas + bajas == 1) "Se muestra" else "Se muestran", paste(piezas, collapse = " y "), de_total)
    },
    a_mano = if (!k) sprintf("No hay preguntas elegidas, %s.", de_total)
             else if (una) sprintf("Se muestra 1 pregunta elegida, %s.", de_total)
             else sprintf("Se muestran %s preguntas elegidas, %s.", cifra, de_total)
  )
  if (agregadas > 0L) {
    txt <- paste(txt, if (agregadas == 1L) "Se agrega 1 pregunta elegida a mano."
                      else sprintf("Se agregan %s preguntas elegidas a mano.", .regla_preguntas_cifra(agregadas)))
  }
  if (isTRUE(ajustada)) txt <- paste(txt, "Lista ajustada a mano.")
  txt
}

# ---- Evaluación pura ---------------------------------------------------------

#' Elige las preguntas de una lámina de resumen con su regla
#'
#' Función pura: no lee la sesión ni las fuentes.
#'
#' @param indicadores `data.frame(tema, etiqueta, grupo, valor, sin_info, n, orden)`: una fila por (tema, grupo);
#'   `valor` y `sin_info` en 0–100; `orden` es el orden del instrumento (desempate).
#' @param regla Regla (se normaliza aquí); `NULL` equivale a `todas`.
#' @param universo Nombre del universo para la nota, en plural («preguntas de escala»).
#' @param grupos_unidad Cómo se llaman los grupos en la nota de `comunes` («públicos», «grupos»).
#' @param decimales Decimales de las cifras de la lámina: la métrica se calcula sobre las cifras redondeadas.
#' @return `list(temas, total, metrica, texto, candidatas, avisos)`.
#' @keywords internal
.regla_preguntas_evaluar <- function(indicadores, regla, universo = "preguntas de escala", grupos_unidad = "públicos",
                                     decimales = 0L) {
  regla <- .regla_preguntas_normalizar(regla) %||% list(tipo = "todas", n = NULL, umbral = NULL, agregar = character(0), quitar = character(0))
  vacio <- data.frame(tema = character(0), etiqueta = character(0), metrica = numeric(0), seleccionada = logical(0),
                      stringsAsFactors = FALSE)
  ind <- if (is.data.frame(indicadores)) indicadores else data.frame()
  for (col in c("tema", "grupo", "valor")) if (!col %in% names(ind)) ind[[col]] <- if (nrow(ind)) NA else character(0)
  if (!"etiqueta" %in% names(ind)) ind$etiqueta <- ind$tema
  if (!"sin_info" %in% names(ind)) ind$sin_info <- if (nrow(ind)) NA_real_ else numeric(0)
  if (!"orden" %in% names(ind)) ind$orden <- if (nrow(ind)) seq_len(nrow(ind)) else integer(0)
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0L) dec <- 0L

  tema <- as.character(ind$tema); grp <- as.character(ind$grupo)
  temas <- unique(tema[!is.na(tema) & nzchar(tema)])
  grupos <- if (is.factor(ind$grupo)) intersect(levels(ind$grupo), unique(grp)) else unique(grp)
  grupos <- grupos[!is.na(grupos) & nzchar(grupos)]
  k <- length(grupos)
  entre <- regla$tipo %in% .REGLA_PREGUNTAS_ENTRE_GRUPOS
  if (entre && k < 2L) {
    .regla_preguntas_falla(if (k == 1L) sprintf("La regla «%s» compara %s y la lámina tiene uno solo.", regla$tipo, grupos_unidad)
                           else sprintf("La regla «%s» compara %s y la lámina no tiene %s.", regla$tipo, grupos_unidad, grupos_unidad),
                           list(tipo = regla$tipo))
  }
  val <- suppressWarnings(as.numeric(ind$valor)); si <- suppressWarnings(as.numeric(ind$sin_info))
  V <- matrix(NA_real_, length(temas), k); S <- matrix(NA_real_, length(temas), k)
  for (i in seq_along(temas)) for (j in seq_len(k)) {
    w <- which(tema == temas[i] & grp == grupos[j])
    if (length(w)) { V[i, j] <- val[w[1]]; S[i, j] <- si[w[1]] }
  }
  etiquetas <- as.character(ind$etiqueta)[match(temas, tema)]
  etiquetas[is.na(etiquetas) | !nzchar(etiquetas)] <- temas[is.na(etiquetas) | !nzchar(etiquetas)]
  orden <- suppressWarnings(as.numeric(ind$orden))[match(temas, tema)]
  orden[!is.finite(orden)] <- seq_along(temas)[!is.finite(orden)] + 1e6

  # Universo: con algún valor; entre grupos, con valor en todos.
  con_valor <- if (k) rowSums(is.finite(V)) > 0 else rep(FALSE, length(temas))
  completo <- if (k) rowSums(is.finite(V)) == k else rep(FALSE, length(temas))
  en_universo <- if (entre) completo else con_valor
  # Entre públicos (bases distintas) el universo son las preguntas comunes a todos; entre los grupos de un cruce son las
  # mismas preguntas de la base abiertas por el cruce, y la nota dice «de N preguntas de escala» (ADR 0135, 2026-11-07).
  if (entre && !identical(grupos_unidad, "grupos")) universo <- "preguntas comunes"
  R <- matrix(.pulso_round_half_up(V, dec), nrow(V))
  dif <- rep(NA_real_, length(temas))
  # La resta de dos cifras redondeadas vuelve a redondearse a los mismos decimales: 16,4 − 1,4 da 14,999999999999998 en
  # punto flotante y la lámina rotula «15,0 pts». Sin este redondeo `diferencia_minima` 15 la dejaba fuera y, en
  # `mayor_diferencia`, el flotante decidía un empate visible en vez del orden del instrumento.
  if (k >= 2L && any(completo)) dif[completo] <- .pulso_round_half_up(abs(.contraste_diferencia(R[completo, , drop = FALSE])), dec)
  primero <- function(M) if (k) M[, 1] else rep(NA_real_, nrow(M))
  # El promedio de `extremos` no se rotula, pero ordena: se le quita el ruido del flotante (dos promedios iguales en
  # aritmética exacta empatan y los desempata el instrumento).
  media <- if (k) apply(R, 1, function(r) if (any(is.finite(r))) round(mean(r[is.finite(r)]), dec + 6L) else NA_real_) else rep(NA_real_, length(temas))
  metrica <- switch(regla$tipo,
    mayor_diferencia = dif, diferencia_minima = dif,
    mayor_sin_info = if (k) apply(matrix(.pulso_round_half_up(S, dec), nrow(S)), 1, function(r) if (any(is.finite(r))) max(r[is.finite(r)]) else NA_real_) else rep(NA_real_, length(temas)),
    bajo_umbral = if (k) apply(R, 1, function(r) if (any(is.finite(r))) min(r[is.finite(r)]) else NA_real_) else rep(NA_real_, length(temas)),
    extremos = media,
    if (k >= 2L) dif else primero(R)
  )
  names(metrica) <- temas
  fina <- .regla_preguntas_metrica_fina(regla$tipo, ind, temas, grupos, V, S, completo, dec)   # P7: desempate

  idx <- which(en_universo)
  m <- metrica[idx]; o <- orden[idx]
  # Dos cifras que la lámina rotula igual se desempatan por su valor sin redondear y, sólo si también empatan, por el
  # orden del instrumento (P7, graficos_regla_desempate.R).
  desc <- function(ix) ix[order(-ifelse(is.finite(metrica[ix]), metrica[ix], -Inf), -ifelse(is.finite(fina[ix]), fina[ix], -Inf), orden[ix])]
  asc <- function(ix) ix[order(ifelse(is.finite(metrica[ix]), metrica[ix], Inf), ifelse(is.finite(fina[ix]), fina[ix], Inf), orden[ix])]
  altas_t <- character(0); bajas_t <- character(0)
  elegidos <- switch(regla$tipo,
    todas = idx[order(o)],
    comunes = idx[order(o)],
    mayor_diferencia = utils::head(desc(idx[is.finite(m)]), regla$n),
    diferencia_minima = desc(idx[is.finite(m) & m >= regla$umbral]),
    mayor_sin_info = utils::head(desc(idx[is.finite(m) & m > 0]), regla$n),
    bajo_umbral = asc(idx[is.finite(m) & m < regla$umbral]),
    extremos = {
      ix <- idx[is.finite(m)]
      a <- utils::head(desc(ix), regla$n)
      b <- utils::head(asc(setdiff(ix, a)), regla$n)
      altas_t <- temas[a]; bajas_t <- temas[b]
      c(a, desc(b))   # de arriba abajo: las altas y luego las bajas, todo de mayor a menor
    },
    a_mano = integer(0)
  )
  sel <- temas[elegidos]
  n_regla <- length(sel)
  avisos <- character(0)
  # Ajuste a mano: `agregar` (o la lista de `a_mano`) entra al final y `quitar` sale. Sólo temas que existen.
  agregar <- regla$agregar; quitar <- regla$quitar
  desconocidos <- setdiff(c(agregar, quitar), temas)
  if (length(desconocidos)) {
    avisos <- c(avisos, sprintf("%s del ajuste a mano no %s entre las candidatas: %s.",
                                if (length(desconocidos) == 1L) "Una pregunta" else paste(length(desconocidos), "preguntas"),
                                if (length(desconocidos) == 1L) "está" else "están", paste(desconocidos, collapse = ", ")))
  }
  agregar <- intersect(agregar, temas[con_valor]); quitar <- intersect(quitar, temas)
  antes <- sel
  sel <- c(sel, setdiff(agregar, sel))
  sel <- setdiff(sel, quitar)
  # La nota cuenta lo que se DIBUJA (prueba con Arte: «las 22 bajo 60%» con dos quitadas dibujaba 20): de las que eligió
  # la regla, las que quedan; las agregadas a mano se dicen aparte, porque no cumplen la regla.
  agregadas <- 0L
  if (identical(regla$tipo, "a_mano")) {
    n_regla <- length(sel)
    ajustada <- length(quitar) > 0L && length(intersect(quitar, agregar)) > 0L
  } else {
    n_regla <- length(intersect(antes, sel)); agregadas <- length(setdiff(sel, antes))
    ajustada <- length(setdiff(antes, sel)) > 0L   # alguna de la regla se quitó a mano
  }
  altas <- sum(altas_t %in% sel); bajas <- sum(bajas_t %in% sel)
  total <- length(idx)
  texto <- .regla_preguntas_texto(regla, n_regla, total, universo, n_grupos = k, grupos_unidad = grupos_unidad,
                                  altas = altas, bajas = bajas, ajustada = ajustada, agregadas = agregadas)
  candidatas <- if (length(temas)) {
    # Fuera del universo la pregunta no se mide (N6): su métrica no se publica aunque se pueda calcular.
    data.frame(tema = temas, etiqueta = etiquetas, metrica = ifelse(en_universo, unname(metrica), NA_real_), seleccionada = temas %in% sel,
               stringsAsFactors = FALSE)[order(orden), , drop = FALSE]
  } else vacio
  rownames(candidatas) <- NULL
  list(temas = sel, total = total, metrica = metrica, texto = texto, candidatas = candidatas, avisos = avisos,
       universo = universo, regla = regla)
}

# ---- La regla sobre un elemento (indicadores en graficos_regla_indicadores.R) --------

#' La regla aplicada a un elemento: indicadores, evaluación y las `vars` que quedan
#'
#' @return `list(evaluacion, vars, avisos, indicadores)`; `vars` en la forma que el render del tipo espera (refs del panorama y la
#'   divergente; lista nombrada tema -> refs del dumbbell).
#' @keywords internal
.regla_preguntas_de_elemento <- function(el, sources, regla = el$regla, preset = NULL) {
  regla <- .regla_preguntas_normalizar(regla)
  tipo <- (regla %||% list(tipo = "todas"))$tipo
  preset <- .regla_preguntas_preset(el, preset)
  ind <- .regla_preguntas_indicadores(el, sources, tipo, preset = preset)
  if (isTRUE(ind$sin_equivalencia)) return(.regla_preguntas_sin_equivalencia(ind, regla))   # graficos_dumbbell_equivalencia.R
  # Un ajuste a mano guardado con nombres de variable se traduce a los temas de la matriz si es inequívoco (P1).
  if (is.function(ind$alias_ajuste) && !is.null(regla)) {
    temas <- unique(as.character(ind$indicadores$tema))
    traducir <- function(x) { if (!length(x)) return(character(0)); y <- ind$alias_ajuste(x); ifelse(x %in% temas, x, y) }
    regla$agregar <- unique(traducir(regla$agregar)); regla$quitar <- unique(traducir(regla$quitar))
  }
  ev <- .regla_preguntas_evaluar(ind$indicadores, regla, universo = ind$universo, grupos_unidad = ind$grupos_unidad,
                                 decimales = .regla_preguntas_decimales(el, preset))
  # Lo que no cabe se recorta aquí, en el orden de la regla, y la nota lo dice en una frase (graficos_tope_espacio.R).
  n_elegidas <- length(ev$temas)
  temas_serie <- ev$temas   # S6: todas las que elige la regla, en su orden (lamina_divergentes_serie.R)
  rc <- .regla_preguntas_recortar(ev, ind, el, regla, decimales = .regla_preguntas_decimales(el, preset)); ev <- rc$ev
  texto_base <- ev$texto   # la frase de la regla antes del pie de orden: la lámina la reescribe si muestra menos (P11)
  # La escala del resumen: `bajo_umbral` y `mayor_sin_info` fijan el orden de las filas (graficos_regla_orden_escala.R).
  criterio <- .regla_escala_orden_fijado(el, regla)
  if (!is.null(criterio)) ev <- .regla_escala_ordenar(ev, ind$indicadores, criterio)
  elegidas <- ind$refs_por_tema[ev$temas]
  vars <- if (identical(el$.element_type, "dumbbell")) elegidas else unname(unlist(elegidas))
  # La escala del resumen sale como imagen sólo con más de una columna «Sin información»; con más de 20 filas muestra las
  # 20 primeras en el orden de la regla y lo dice en el pie (graficos_tope_espacio.R; `.lam_divergentes_resumen_cabe`).
  # Las columnas «Sin información» se cuentan sobre las ELEGIDAS: son las que dibuja la lámina (N4).
  n_sin_inf <- if (!is.null(ind$sin_inf_por_tema)) length(unique(unlist(ind$sin_inf_por_tema[ev$temas], use.names = FALSE))) else ind$n_sin_inf
  imagen <- if (identical(el$.element_type, "barras_divergentes")) .divergentes_aviso_tope(length(vars), ev$texto, n_sin_inf)
  espacio <- rc$aviso   # E3, P7
  list(evaluacion = ev, vars = vars, avisos = c(ind$avisos, ev$avisos, espacio, imagen), indicadores = ind$indicadores,
       firma_leyenda = ind$firma_leyenda, motivos_imagen = imagen, recorte = rc$recorte, n_elegidas = n_elegidas, texto_base = texto_base,
       vars_serie = ind$refs_por_tema[temas_serie])
}

#' Los args del preset del tipo con que el render dibuja el elemento
#'
#' El render de la escala recibe el preset; los demás lo leen con `.ola4_preset` (la pila de `reporte_ppt_plan`). El
#' endpoint de conteo no tiene esa pila: pasa el preset de la vista previa (`.regla_preguntas_conteo(presets = )`).
#' @keywords internal
.regla_preguntas_preset <- function(el, preset = NULL) {
  if (length(preset)) return(as.list(preset))
  .ola4_preset(as.character(el$.element_type %||% "")[1])
}

#' Decimales con que la lámina rotula sus cifras: los del preset del tipo y, encima, los de la lámina
#'
#' Es la misma mezcla del render (`modifyList(preset, overrides)`): con un preset `valores_decimales = 1` la lámina
#' rotula 37,5 y la regla mide 37,5, no 38.
#' @keywords internal
.regla_preguntas_decimales <- function(el, preset = NULL) {
  args <- utils::modifyList(as.list(preset %||% list()), as.list(el$overrides %||% list()))
  dec <- suppressWarnings(as.integer(args$valores_decimales %||% 0L)[1])
  if (!is.finite(dec) || dec < 0L) 0L else dec
}

#' El render aplica la regla: el elemento con sus `vars` elegidas y el texto para la nota
#'
#' Sin regla devuelve el elemento intacto (el contrato de siempre) y no toca las fuentes.
#' @keywords internal
.regla_preguntas_aplicar_render <- function(el, contexto, sources = NULL, preset = NULL) {
  if (is.null(el$regla)) return(list(el = el, texto = NULL))
  r <- .regla_preguntas_de_elemento(el, sources %||% .regla_preguntas_fuentes_render(contexto), preset = preset)
  # Públicos sin equivalencia declarada: el render dibuja la lámina que lo dice (graficos_panorama_equivalencia.R).
  if (!is.null(r$sin_equivalencia)) return(list(el = el, texto = r$evaluacion$texto, sin_equivalencia = r$sin_equivalencia))
  total <- r$evaluacion$total
  if (!length(r$vars)) stop("La regla de preguntas no deja ninguna pregunta: ", r$evaluacion$texto, call. = FALSE)
  # E3, P7. En la escala del resumen el consejo de desde dónde seguir lo da su lámina, que sabe cuántas filas dibuja al
  # final (P11); aquí va sólo el hecho.
  if (!is.null(r$recorte) && is.null(el$hasta)) {   # con `hasta` el recorte lo declaró el analista: no se avisa (S6)
    con_consejo <- !identical(el$.element_type, "barras_divergentes")
    .pulso_aviso(.aviso_en_lamina(.tope_espacio_aviso(r$recorte[["k"]], r$recorte[["n"]], r$recorte[["desde"]],
                                                      consejo = con_consejo)))
  }
  el$.vars_declaradas <- el$.vars_declaradas %||% el$vars   # O4: la serie se reconoce por lo declarado (graficos_serie_plan.R)
  el$vars <- r$vars
  if (identical(el$.element_type, "barras_divergentes")) {
    el$var <- if (length(r$vars) == 1L) r$vars else NULL
    el$.firma_leyenda <- r$firma_leyenda   # escalas alineadas: la leyenda es la del universo (graficos_escala_armonizada.R)
  }
  list(el = el, texto = r$evaluacion$texto, total = total, n_elegidas = r$n_elegidas, texto_base = r$texto_base,
       universo = r$evaluacion$universo, vars_serie = r$vars_serie)
}

#' Orden del contraste del resumen con su regla (ADR 0135, decisión del 2026-11-07)
#'
#' Con la regla «mayor diferencia» las filas van por la diferencia ABSOLUTA, de mayor a menor: la brecha más grande
#' arriba, sea cual sea su signo. Sin regla, o con otra, el orden de siempre (ADR 0134: la diferencia con signo). Un
#' orden declarado distinto de `brecha` (`valor`, `declarado`) se respeta.
#' @param args Argumentos de `graficar_dumbbell`. @param regla Regla del elemento.
#' @keywords internal
.regla_preguntas_orden_contraste <- function(args, regla) {
  tipo <- (.regla_preguntas_normalizar(regla) %||% list(tipo = "todas"))$tipo
  if (!identical(args$estilo, "resumen") || !identical(tipo, "mayor_diferencia")) return(args)
  if (is.null(args$orden) || identical(as.character(args$orden)[1], "brecha")) args$orden <- "brecha_absoluta"
  args
}

#' Pone el texto de la regla en la especificación del gráfico (la lee la lámina nativa para su nota)
#' @keywords internal
.regla_preguntas_en_espec <- function(p, texto) {
  if (is.null(texto) || is.null(p)) return(p)
  espec <- attr(p, "pulso_espec", exact = TRUE)
  if (is.list(espec)) { espec$texto_regla <- texto; attr(p, "pulso_espec") <- espec }
  # El respaldo escribe en el pie lo que trae `note_outside` (la base por grupo): la regla va al final, como en la nativa.
  nota <- attr(p, "note_outside", exact = TRUE)
  if (!is.null(nota)) attr(p, "note_outside") <- .lam_unir_base(nota, texto)
  p
}

#' Fuentes del estudio dentro del render (`reporte_ppt_plan` las expone a los renders por convención)
#' @keywords internal
.regla_preguntas_fuentes_render <- function(contexto) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  inst_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources) || !length(inst_sources)) stop(contexto, ": el render no expone las fuentes del estudio.", call. = FALSE)
  list(data_sources = data_sources, inst_sources = inst_sources)
}

#' La regla en el constructor: normalizada en el elemento; sólo en el estilo resumen
#'
#' Con `regla` y sin `estilo`, el estilo es `resumen`; con `estilo = "recetario"` explícito, la regla no tendría dónde
#' escribir su nota y se rechaza.
#' @keywords internal
.regla_preguntas_en_constructor <- function(el, regla, constructor, con_estilo = TRUE) {
  r <- .regla_preguntas_normalizar(regla)
  if (is.null(r)) return(el)
  if (con_estilo) {
    est <- el$overrides$estilo
    if (!is.null(est) && !identical(est, "resumen")) {
      .regla_preguntas_falla(sprintf("%s: la regla de preguntas es del estilo resumen.", constructor), list(estilo = est))
    }
    el$overrides$estilo <- "resumen"
  }
  el$regla <- r
  el
}

#' Respuesta del endpoint de conteo para un graficador y sus args
#'
#' @param graficador Nombre del constructor (`p_panorama`, `p_dumbbell`, `p_barras_divergentes`, `p_fortalezas`).
#' @param args Args del constructor, como los guarda el slot.
#' @param sources Fuentes del estudio.
#' @keywords internal
.regla_preguntas_conteo <- function(graficador, args, sources, presets = NULL) {
  graficador <- trimws(as.character(graficador %||% "")[1])
  if (is.na(graficador) || !graficador %in% c("p_panorama", "p_dumbbell", "p_barras_divergentes", "p_fortalezas")) {
    .regla_preguntas_falla("Este gráfico no elige sus preguntas con una regla.")
  }
  # Sin fuentes del estudio no hay nada que contar: es el 409 de siempre de Gráficos, no una regla inválida.
  if (!.graficos_sources_usable(sources$data_sources %||% list(), sources$inst_sources %||% list())) {
    stop_api(409, "E_NO_VALID_RP_DATA", "La fuente procesada para Gráficos no está disponible o quedó incompleta.")
  }
  args <- as.list(args %||% list())
  el <- .rebuild_graf(list(graficador = graficador, args = args))
  if (is.null(el) || is.null(el$.element_type)) {
    return(list(ok = TRUE, total = 0L, seleccionadas = list(), candidatas = list(), texto_regla = "",
                avisos = list("Faltan datos del gráfico para contar sus preguntas."), tope_filas = .regla_tope_filas(graficador),
                cabe_nativa = NA, motivo_imagen = NA_character_))
  }
  # Un borrador incompleto se reconstruye como gráfico vacío: se dice qué falta, nunca su tipo interno.
  if (!el$.element_type %in% c("panorama", "dumbbell", "barras_divergentes", "fortalezas")) .regla_preguntas_falta_dato(graficador, args)
  # Los presets de la vista previa (los mismos que /cifras y el render): sus exclusiones y sus decimales cambian las cifras.
  preset <- if (is.list(presets)) presets[[el$.element_type]]$args else NULL
  r <- .regla_preguntas_de_elemento(el, sources, regla = el$regla, preset = preset)
  ev <- r$evaluacion
  es_escala <- identical(el$.element_type, "barras_divergentes")
  cand <- ev$candidatas
  list(
    ok = TRUE,
    total = as.integer(ev$total),
    seleccionadas = as.list(ev$temas),
    candidatas = lapply(seq_len(nrow(cand)), function(i) list(
      tema = cand$tema[i], etiqueta = cand$etiqueta[i],
      metrica = if (is.finite(cand$metrica[i])) cand$metrica[i] else NULL,
      seleccionada = isTRUE(cand$seleccionada[i])
    )),
    texto_regla = ev$texto,
    avisos = as.list(r$avisos),
    tope_filas = .regla_tope_filas(graficador),   # graficos_escala_tope.R; NA sale como null
    # ¿La lámina nativa dibuja lo elegido? Sólo la escala tiene esa restricción; los demás, null. Con FALSE el motivo
    # dice por qué sale como imagen (más filas que el tope o más de una columna «Sin información»).
    cabe_nativa = if (es_escala) length(ev$temas) > 0L && !length(r$motivos_imagen) else NA,
    motivo_imagen = .regla_preguntas_motivo_imagen(es_escala, ev$temas, r$motivos_imagen)
  )
}

#' Por qué la escala no sale como lámina nativa, o `NA`
#'
#' N5 (revisión metodológica de la regla): con ninguna pregunta elegida el render dibuja «Sin datos», así que la lámina
#' nativa tampoco cabe y el motivo lo dice.
#' @keywords internal
.regla_preguntas_motivo_imagen <- function(es_escala, temas, motivos) {
  if (!isTRUE(es_escala)) return(NA_character_)
  if (!length(temas)) return("Ninguna pregunta cumple la regla.")
  if (length(motivos)) paste(motivos, collapse = " ") else NA_character_
}
