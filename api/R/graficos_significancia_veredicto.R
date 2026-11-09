# Cuándo se marca una diferencia (propuesta §4.1, ADR 0128 §4)
# ============================================================
#
# La prueba (graficos_significancia_diseno.R) da un p por par. Este archivo decide qué filas se prueban, qué grupos
# son elegibles, cómo se ajusta el p y qué veredicto recibe cada par:
#
# - marcada: p ajustado < alfa y al menos `umbral_puntos` de diferencia;
# - frágil: igual, con el p ajustado entre 0.01 y alfa (contorno en el PPT, nunca en el resumen ejecutivo);
# - bajo_umbral: significativa pero menor que el umbral;
# - no_significativa;
# - no_comparable: algún grupo sin base o sin conglomerados suficientes, o sin varianza.
#
# La salida es una ESTRUCTURA por celda (`letras`, `fragil`, `flecha`), no un sufijo de texto: el graficador dibuja la
# cápsula y la tabla escribe sus letras desde la misma estructura.

# Rótulos que cuentan en la base pero no se comparan ni sirven de referencia (propuesta §4.1.7).
.SIG_FUERA_DE_PRUEBA_RX <- paste0(
  "^\\s*(no\\s+s[eé]|no\\s+sabe|ns\\s*/\\s*nr|no\\s+tengo\\s+(informaci[oó]n|opini[oó]n)|prefiero\\s+no|",
  "no\\s+responde|no\\s+precisa|no\\s+aplica|otros?|otras?)(\\s|[[:punct:]]|$)"
)

#' ¿Rótulo o código fuera de la prueba? («No sé», «Otro», códigos 90-99...)
#' @keywords internal
.sig_fuera_de_prueba <- function(etiquetas, codigos = NULL) {
  lab <- grepl(.SIG_FUERA_DE_PRUEBA_RX, as.character(etiquetas), ignore.case = TRUE, perl = TRUE)
  cod <- if (is.null(codigos)) rep(FALSE, length(etiquetas)) else vapply(seq_along(etiquetas), function(i) {
    cs <- as.character(codigos[[as.character(etiquetas[[i]])]] %||% character(0))
    length(cs) > 0L && all(grepl("^9[0-9]$|^-?9{2,}$", trimws(cs)))
  }, logical(1))
  lab | cod
}

#' Filas que se prueban
#'
#' @param solo_principal En una pregunta de dos categorías sustantivas, prueba solo la primera: la otra es su
#'   complemento y marcarla repetiría la misma diferencia (D2 de la propuesta: «58% ABC» en Sí y «76% D» en No).
#' @keywords internal
.sig_filas_a_probar <- function(etiquetas, codigos = NULL, regla, solo_principal = FALSE) {
  etiquetas <- as.character(etiquetas)
  fuera <- if (isTRUE(regla$incluir_ns)) rep(FALSE, length(etiquetas)) else .sig_fuera_de_prueba(etiquetas, codigos)
  filas <- etiquetas[!fuera & etiquetas != "Total"]
  if (isTRUE(solo_principal) && length(filas) == 2L) filas <- filas[1]
  filas
}

#' Evalúa una pregunta contra un cruce: prueba, elegibilidad y redacción, sin ajustar todavía el p
#'
#' @param ind Indicadores de `.sig_indicadores()` (opcionalmente con filas derivadas).
#' @param g,grupos,etiquetas_grupos Grupo de cada caso, orden de los grupos (el de las letras) y su rótulo.
#' @param filas Filas a probar (rótulos de `ind$Y`).
#' @param binaria TRUE si la pregunta es de una opción con dos categorías sustantivas: la segunda fila se marca como
#'   duplicada para la familia de BH (dictamen §3.3: 160 pruebas repetidas en la familia del plan).
#' @param unidad_pesos Unidad de normalización del peso para la z (`.sig_contrastes`); NULL: toda la comparación.
#' @keywords internal
.sig_evaluar <- function(ind, g, grupos, etiquetas_grupos = grupos, cluster = NULL, estrato = NULL, regla, filas,
                         binaria = FALSE, unidad_pesos = NULL) {
  grupos <- as.character(grupos)
  etiquetas_grupos <- stats::setNames(as.character(etiquetas_grupos), grupos)
  filas <- intersect(as.character(filas), colnames(ind$Y))
  K <- length(grupos)
  letras <- stats::setNames(vapply(seq_len(K), .graficos_sig_letra_columna, character(1)), grupos)
  frente_al_resto <- K > (regla$max_letras %||% 6L)
  prueba <- regla$prueba %||% "z"
  cmin <- if (identical(prueba, "rao_scott")) (regla$conglomerados_minimos %||% 8L) else 0L
  nmin <- regla$base_minima %||% 30

  if (!length(filas) || K < 2L) {
    return(list(modo = if (frente_al_resto) "frente_al_resto" else "letras", grupos = NULL, pares = NULL,
                celdas = NULL, letras = letras, etiquetas_grupos = etiquetas_grupos, prueba = prueba, gl = NA_integer_))
  }

  Y <- ind$Y[, filas, drop = FALSE]
  if (!frente_al_resto) {
    res <- .sig_contrastes(Y, g, grupos, cluster, estrato, ind$w, prueba = prueba, unidad_pesos = unidad_pesos)
    pares <- res$pares
  } else {
    # Con más de `max_letras` grupos (D7), cada grupo frente al resto de los casos.
    res <- .sig_contrastes(Y, g, grupos, cluster, estrato, ind$w, prueba = prueba, unidad_pesos = unidad_pesos)
    trozos <- lapply(grupos, function(gr) {
      g2 <- ifelse(!is.na(g) & g == gr, gr, ifelse(is.na(g), NA_character_, ".resto"))
      r <- .sig_contrastes(Y, g2, c(gr, ".resto"), cluster, estrato, ind$w, prueba = prueba,
                           unidad_pesos = unidad_pesos)
      r$pares
    })
    pares <- do.call(rbind, trozos)
  }
  celdas <- res$celdas
  celdas$comparable <- celdas$n >= nmin & celdas$conglomerados >= cmin
  celdas$motivo <- ifelse(celdas$comparable, NA_character_,
                          ifelse(celdas$n < nmin, sprintf("n = %d, no se compara", as.integer(celdas$n)),
                                 sprintf("%d %ss, no se compara", as.integer(celdas$conglomerados),
                                         .sig_nombre_conglomerado(regla$conglomerado))))

  # Elegibilidad de un grupo en el conjunto: la de su peor fila (en una opción única la base es la misma en todas).
  por_grupo <- split(seq_len(nrow(celdas)), factor(celdas$grupo, levels = grupos))
  grupos_df <- data.frame(
    letra = unname(letras[grupos]), codigo = grupos, etiqueta = unname(etiquetas_grupos[grupos]),
    n = vapply(por_grupo, function(i) if (length(i)) max(celdas$n[i]) else 0, numeric(1)),
    conglomerados = vapply(por_grupo, function(i) if (length(i)) as.integer(max(celdas$conglomerados[i])) else 0L, integer(1)),
    comparable = vapply(por_grupo, function(i) length(i) > 0L && all(celdas$comparable[i]), logical(1)),
    motivo = vapply(por_grupo, function(i) if (length(i) && !all(celdas$comparable[i])) celdas$motivo[i][!celdas$comparable[i]][1]
                    else NA_character_, character(1)),
    stringsAsFactors = FALSE, row.names = NULL
  )

  if (nrow(pares)) {
    clave <- paste(celdas$fila, celdas$grupo, sep = "\r")
    comp <- function(f, gr) {
      x <- celdas$comparable[match(paste(f, gr, sep = "\r"), clave)]
      ifelse(gr == ".resto", TRUE, !is.na(x) & x)
    }
    pares$elegible <- comp(pares$fila, pares$a) & comp(pares$fila, pares$b) & is.finite(pares$p)
    pares$duplicada <- isTRUE(binaria) & pares$fila != filas[[1]]
  } else {
    pares$elegible <- logical(0)
    pares$duplicada <- logical(0)
  }
  tendencia <- if (isTRUE(regla$tendencia)) .sig_tendencia(res, grupos, grupos_df, gl = res$gl, prueba = prueba) else NULL
  list(modo = if (frente_al_resto) "frente_al_resto" else "letras", grupos = grupos_df, pares = pares,
       celdas = celdas, letras = letras, etiquetas_grupos = etiquetas_grupos, prueba = prueba, gl = res$gl,
       tendencia = tendencia)
}

#' Prueba de tendencia lineal entre niveles ordenados (decisión D6: opcional, apagada por defecto)
#'
#' Con tres o más grupos de código numérico (niveles 6 a 9), el contraste lineal Σ c_k p_k con c_k = nivel − media de
#' los niveles comparables, y su varianza c' V c con la misma matriz de la prueba por pares (de diseño o binomial).
#' Corrección de Bonferroni entre las filas de la pregunta. Solo entran los grupos comparables.
#' @return data.frame(fila, estimado, p, p_ajustado, direccion) o NULL si el cruce no es ordenado.
#' @keywords internal
.sig_tendencia <- function(res, grupos, grupos_df, gl = NA_integer_, prueba = "rao_scott") {
  nivel <- suppressWarnings(as.numeric(grupos))
  ok <- !is.na(nivel) & grupos_df$comparable[match(grupos, grupos_df$codigo)] %in% TRUE
  if (sum(ok) < 3L || is.null(res$vcov) || !length(res$vcov)) return(NULL)
  c_k <- stats::setNames(rep(0, length(grupos)), grupos)
  c_k[ok] <- nivel[ok] - mean(nivel[ok])
  filas <- names(res$vcov)
  out <- lapply(filas, function(f) {
    v <- res$vcov[[f]]
    if (any(!is.finite(v$p[ok]))) return(NULL)
    est <- sum(c_k * ifelse(is.finite(v$p), v$p, 0))
    var <- as.numeric(t(c_k) %*% v$V %*% c_k)
    if (!is.finite(var) || var <= 0) return(NULL)
    z <- est / sqrt(var)
    pv <- if (identical(prueba, "rao_scott")) 2 * stats::pt(-abs(z), df = max(gl, 1L)) else 2 * stats::pnorm(-abs(z))
    data.frame(fila = f, estimado = est, p = pv, stringsAsFactors = FALSE)
  })
  out <- do.call(rbind, out)
  if (is.null(out) || !nrow(out)) return(NULL)
  out$p_ajustado <- stats::p.adjust(out$p, method = "bonferroni")
  out$direccion <- ifelse(out$estimado > 0, "aumenta", "disminuye")
  out
}

#' Línea de la nota con la tendencia por nivel, o NULL si no se pidió o no aplica
#' @keywords internal
.sig_texto_tendencia <- function(ev, regla) {
  td <- ev$tendencia
  if (!isTRUE(regla$tendencia) || is.null(td) || !nrow(td)) return(NULL)
  sig <- td[td$p_ajustado < (regla$alfa %||% 0.05), , drop = FALSE]
  if (!nrow(sig)) return("Tendencia por nivel: ninguna fila muestra una tendencia lineal significativa.")
  partes <- sprintf("«%s» %s con el nivel", sig$fila, sig$direccion)
  sprintf("Tendencia por nivel: %s (prueba de tendencia lineal, p < %s con corrección de Bonferroni).",
          .sig_lista_y(partes), .sig_num(regla$alfa %||% 0.05))
}

#' p de la evaluación que entran a la familia de BH (elegibles y no duplicados)
#' @keywords internal
.sig_p_para_familia <- function(ev) {
  if (is.null(ev$pares) || !nrow(ev$pares)) return(numeric(0))
  ev$pares$p[ev$pares$elegible & !ev$pares$duplicada]
}

#' Ajusta el p, asigna veredicto, redacción y la estructura de marcas por celda
#'
#' @param familia Tabla de `.sig_bh_tabla()` del estudio. Con `bh_informe` y sin familia, la familia es la propia
#'   evaluación y se informa en `familia_local`.
#' @param exigir_familia Con una familia del estudio, un p que no está en ella no se ajusta con el q de un vecino: queda
#'   `fuera_de_familia` y no se marca (ADR 0128 §3, paridad lámina–familia). `ev$fuera_de_familia` cuenta los pares.
#' @keywords internal
.sig_veredictos <- function(ev, regla, familia = NULL, exigir_familia = FALSE) {
  pares <- ev$pares
  if (is.null(pares) || !nrow(pares)) {
    ev$marcas <- NULL
    ev$familia_local <- FALSE
    return(ev)
  }
  alfa <- regla$alfa %||% 0.05
  umbral <- (regla$umbral_puntos %||% 0) / 100
  pares$p_ajustado <- NA_real_
  ok <- pares$elegible
  fuera <- rep(FALSE, nrow(pares))
  ev$familia_local <- FALSE
  if (identical(regla$correccion, "bh_informe")) {
    tabla <- familia
    if (is.null(tabla) || !tabla$m) {
      tabla <- .sig_bh_tabla(.sig_p_para_familia(ev))
      ev$familia_local <- TRUE
    }
    pares$p_ajustado[ok] <- .sig_bh_q(pares$p[ok], tabla)
    if (isTRUE(exigir_familia) && !isTRUE(ev$familia_local)) {
      fuera <- ok & !.sig_bh_en_familia(pares$p, tabla)
      pares$p_ajustado[fuera] <- NA_real_
    }
  } else {
    for (f in unique(pares$fila[ok])) {
      i <- which(ok & pares$fila == f)
      pares$p_ajustado[i] <- stats::p.adjust(pares$p[i], method = "bonferroni")
    }
  }
  sig <- ok & is.finite(pares$p_ajustado) & pares$p_ajustado < alfa
  grande <- abs(pares$dif) >= umbral - 1e-9
  pares$veredicto <- ifelse(!ok, "no_comparable",
                     ifelse(sig & grande & pares$p_ajustado >= 0.01, "fragil",
                     ifelse(sig & grande, "marcada",
                     ifelse(sig, "bajo_umbral", "no_significativa"))))
  pares$veredicto[fuera] <- "fuera_de_familia"
  ev$fuera_de_familia <- sum(fuera)
  et <- ev$etiquetas_grupos
  nombre <- function(x) ifelse(x == ".resto", "el resto", unname(et[x]))
  pares$redaccion <- ifelse(pares$veredicto %in% c("marcada", "fragil"),
    mapply(.sig_texto_redaccion, pares$fila, nombre(pares$a), nombre(pares$b), pares$p_a, pares$p_b,
           pares$veredicto == "fragil"),
    NA_character_)
  ev$pares <- pares

  # Marcas por celda. En letras: la celda del grupo mayor nombra al menor. Frente al resto: ▲ o ▼ en el grupo.
  muestra <- pares$veredicto == "marcada" | (pares$veredicto == "fragil" & !identical(regla$fragiles, "ocultar"))
  marcas <- list()
  if (identical(ev$modo, "letras")) {
    for (f in unique(pares$fila)) for (gr in names(ev$letras)) {
      i <- which(muestra & pares$fila == f & pares$a == gr)
      if (!length(i)) next
      ls <- sort(unname(ev$letras[pares$b[i]]))
      fragil <- all(pares$veredicto[i] == "fragil")
      # △ hueco para la frágil: en el texto de la cifra (Word, tablas) es lo que hace las veces del contorno (D4).
      marcas[[length(marcas) + 1L]] <- data.frame(fila = f, grupo = gr, letras = paste(ls, collapse = ""),
                                                  flecha = if (fragil) "△" else "▲", fragil = fragil,
                                                  stringsAsFactors = FALSE)
    }
  } else {
    for (k in which(muestra)) {
      gr <- if (pares$a[k] == ".resto") pares$b[k] else pares$a[k]
      marcas[[length(marcas) + 1L]] <- data.frame(fila = pares$fila[k], grupo = gr, letras = "",
                                                  flecha = if (pares$a[k] == ".resto") {
                                                    if (pares$veredicto[k] == "fragil") "▽" else "▼"
                                                  } else if (pares$veredicto[k] == "fragil") "△" else "▲",
                                                  fragil = pares$veredicto[k] == "fragil", stringsAsFactors = FALSE)
    }
  }
  ev$marcas <- if (length(marcas)) do.call(rbind, marcas) else NULL
  ev
}

#' Estado de la evaluación para la UI: con_marcas, ninguna o sin cruce
#' @keywords internal
.sig_estado <- function(ev) {
  if (is.null(ev$pares)) return("sin_cruce")
  if (!is.null(ev$marcas) && nrow(ev$marcas)) "con_marcas" else "ninguna"
}

#' Nota al pie de la lámina, desde la fuente única de textos
#' @keywords internal
.sig_nota_de_evaluacion <- function(ev, regla, niveles = FALSE) {
  chicos <- if (!is.null(ev$grupos)) ev$grupos$etiqueta[!ev$grupos$comparable] else character(0)
  contexto <- c(.sig_texto_sin_conglomerado(regla), .sig_texto_bases_chicas(regla, chicos))
  marcas <- ev$marcas
  if (!is.null(marcas) && nrow(marcas)) {
    linea <- .sig_texto_linea_marcas(regla, hay_fragiles = any(marcas$fragil),
                                     frente_al_resto = identical(ev$modo, "frente_al_resto"))
  } else {
    # Sin marcas la lámina no lleva nota de «ninguna diferencia» (Gonzalo, revisión del PPT v7 de CCSS, lámina 32:
    # «quedamos en que no se pone»). La línea de bases chicas sí queda: dice que hubo grupos que no se pudieron comparar.
    # El texto sigue disponible en `.sig_texto_ninguna` para la UI (estado «ninguna» del inspector).
    linea <- NULL
  }
  .sig_nota_lineas(c(contexto, linea, .sig_texto_tendencia(ev, regla)))
}

# Separador de líneas LÓGICAS de la nota (contexto y marcas, propuesta §4.2). El salto suave que envuelve una línea larga
# para el caption del Word es un «\n» a secas, y la lámina lo vuelve espacio; el lógico lleva además un espacio de ancho
# cero, que la lámina conserva como salto (`.lam_nota_sig_de`).
.SIG_NOTA_SALTO <- "\n\u200b"

#' Une las líneas lógicas de la nota, cada una envuelta para el caption del Word
#' @keywords internal
.sig_nota_lineas <- function(lineas, ancho = 72L) {
  lineas <- lineas[!is.na(lineas) & nzchar(lineas)]
  if (requireNamespace("stringr", quietly = TRUE)) lineas <- stringr::str_wrap(lineas, width = ancho)
  paste(lineas, collapse = .SIG_NOTA_SALTO)
}
