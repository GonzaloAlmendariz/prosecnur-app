# analitica_armonizada_implicita.R — la fila que no necesita armonizarse
# =========================================================================
#
# Medido en la matriz de HSyVbG (2026-10-21, checklist A1/A2): de 212 filas,
# 71 tenían la MISMA lista de respuestas en las tres bases —Sexo, las catorce
# de prevalencia, instancias, conocimiento— y ninguna entró al comparativo,
# porque el motor sólo tomaba las filas con `armonizacion` guardada. La UI
# ofrece «Confirmar en bloque» las filas de misma escala, pero que el resultado
# dependa de pulsarlo es el defecto: una fila que no exige decidir nada no puede
# depender de una decisión, y las 71 salían sin aparecer en «Preguntas
# omitidas».
#
# Regla (la misma que pinta «Misma escala» en la tabla, `coincidenciaDeEscala`):
# la fila sin armonización cuya variable tiene en TODAS las bases donde está
# declarada la misma firma de escala (`.equiv_firma_escala`) y esa firma es una
# lista con opciones, se compara con la identidad: la escala es la lista de la
# primera base de la serie, cada base es comparable con mapa vacío. Se arma en
# memoria para el comparativo; la matriz guardada no cambia.
#
# La fila que no cumple la regla —escalas distintas sin armonizar— no se calla:
# sale en `omitidas` con motivo `sin_armonizar` y llega al aviso y a la hoja
# «Preguntas omitidas» del libro.

.armz_vars_declaradas <- function(fila, periodos) {
  vars <- fila$variables %||% list()
  bs <- intersect(as.character(periodos), names(vars))
  bs[nzchar(vapply(bs, function(b) .equiv_armon_chr(vars[[b]], ""), character(1)))]
}

#' Armonización identidad de una fila de misma escala, o NULL.
#' @noRd
.armz_armonizacion_implicita <- function(fila, inst_por_base, periodos) {
  if (!is.null(fila$armonizacion) || isTRUE(fila$sugerida) || !is.null(fila$derivada)) return(NULL)
  bs <- .armz_vars_declaradas(fila, periodos)
  if (!length(bs)) return(NULL)
  vars <- fila$variables
  firmas <- vapply(bs, function(b) tryCatch(
    as.character(.equiv_firma_escala(inst_por_base[[b]], vars[[b]]))[1],
    error = function(e) ""), character(1))
  firmas[is.na(firmas)] <- ""
  if (any(!nzchar(firmas)) || length(unique(firmas)) != 1L || startsWith(firmas[[1]], "libre:")) {
    return(NULL)
  }
  escala <- .equiv_escala_opciones(inst_por_base[[bs[[1]]]], vars[[bs[[1]]]])
  if (!length(escala)) return(NULL)
  por_base <- stats::setNames(lapply(bs, function(b) {
    list(comparable = TRUE, mapa = stats::setNames(list(), character(0)))
  }), bs)
  list(escala = escala, por_base = por_base)
}

#' Completa en memoria las filas de misma escala y separa las que quedan sin
#' armonizar. Devuelve la matriz completada y las omitidas.
#' @return list(equiv, omitidas = [{tipo, fila, titulo, claves, motivo}]).
#' @noRd
.armz_completar_implicitas <- function(equiv, inst_por_base, periodos) {
  filas <- (equiv %||% list())$filas %||% list()
  omitidas <- list()
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    if (!is.null(f$armonizacion)) next
    arm <- .armz_armonizacion_implicita(f, inst_por_base, periodos)
    if (!is.null(arm)) {
      filas[[i]]$armonizacion <- arm
      next
    }
    # Una propuesta sin confirmar no es una decisión (ADR 0062): no entra ni se
    # reporta como omitida. Una fila sin variable en la serie ya la reporta
    # `armonizada_apilar` con su propio motivo.
    if (isTRUE(f$sugerida) || isTRUE(f$cruce) || !length(.armz_vars_declaradas(f, periodos))) next
    claves <- unique(c(.armz_txt(f$id), .armz_txt(f$etiqueta_estandar),
                       as.character(unlist(f$variables %||% list(), use.names = FALSE))))
    omitidas[[length(omitidas) + 1L]] <- list(
      tipo = "pregunta",
      fila = .armz_txt(f$etiqueta_estandar) %||% "", titulo = .armz_titulo_fila(f),
      claves = claves[nzchar(claves)], motivo = "sin_armonizar")
  }
  equiv$filas <- filas
  list(equiv = equiv, omitidas = omitidas)
}

# ---- Opción de selección múltiple (dummy 0/1) ---------------------------------
#
# Medido en la misma matriz (checklist A3): 129 filas eran una opción de
# selección múltiple —«Emociones: Angustia», «Instancia: Defensoría»— con una
# escala de una sola categoría («1 = Angustia»). El «0» de quien no la marcó
# quedaba sin mapa, fuera del denominador, y cada opción salía al 100 %. Pedirle
# a la persona que declare «0 = No mencionó» en 129 filas es el defecto: el
# código 0 de una dummy no es una respuesta sin armonizar, es el resto de la
# base.
#
# Regla: la escala tiene UNA categoría y los códigos observados de la variable
# en esa base son sólo 0 y 1. Entonces el 0 que no mapea se marca
# `.ARMZ_NO_MENCIONA`: entra en N y no imprime fila.

.ARMZ_NO_MENCIONA <- ".no_menciona"

.armz_marcar_no_menciona <- function(v, orig, escala_codigos) {
  if (length(escala_codigos) != 1L) return(v)
  cod <- .codif_agrupar_codigo_chr(haven::zap_labels(orig))
  obs <- unique(cod[!is.na(cod) & nzchar(cod)])
  if (!length(obs) || !all(obs %in% c("0", "1"))) return(v)
  v[is.na(v) & !is.na(cod) & cod == "0"] <- .ARMZ_NO_MENCIONA
  v
}

# ---- Un código que va a la categoría equivocada (checklist A5) ----------------
#
# Medido en la misma matriz: en 2025 «Año de ingreso» viene en orden inverso
# (1 = desde 2023, 3 = hasta 2020) y se declaró comparable con el mapa
# identidad. 1.386 casos (56 %) de 2025 cayeron en «hasta 2019». El editor de
# la fila ya marcaba «código con etiqueta distinta», pero sólo con el panel
# abierto; guardado, nada lo recordaba y el comparativo salía con la cifra
# cambiada.
#
# «Etiqueta distinta» a secas es ruido aquí: en esa matriz daba 149 avisos, casi
# todos dummies («Sí» → «Angustia») y variantes de redacción («Otra» → «Otro»),
# que son correctas. Lo que delata un mapa equivocado es otra cosa: el código va
# 1:1 a una categoría mientras su etiqueta se parece CLARAMENTE más a OTRA
# categoría de la escala («desde 2023» → «hasta 2019», existiendo «desde 2022»).
# Parecido = proporción de palabras compartidas (Jaccard), y la otra categoría
# tiene que superar a la de destino y llegar a 0,5.
#
# Dos límites, por los falsos positivos de las escalas de intensidad («Totalmente
# de acuerdo» se parece más a «De acuerdo» que a «Muy de acuerdo»):
#   · sólo se revisa el mapa IDENTIDAD, donde ocurrió el error. Un mapa declarado
#     código por código ya es una decisión explícita, y declararlo es también la
#     forma de dar el aviso por revisado;
#   · no se sugiere una categoría cuyas palabras están todas dentro de la
#     etiqueta de la base (una versión más corta de la misma respuesta).
# La misma regla vive en el
# frontend (`codigosMalUbicadosModel.ts`) para la columna Escala y el editor.

.armz_palabras_etiqueta <- function(x) {
  y <- .carm_texto_norm(.armz_impreso(x))
  w <- strsplit(trimws(gsub("[^a-z0-9]+", " ", y)), " ", fixed = TRUE)[[1]]
  unique(w[nzchar(w)])
}

.armz_parecido <- function(a, b) {
  if (!length(a) || !length(b)) return(0)
  length(intersect(a, b)) / length(union(a, b))
}

#' Códigos de una base que van 1:1 a una categoría mientras su etiqueta se
#' parece más a otra.
#' @return list de list(codigo, etiqueta, destino, etiqueta_destino, sugerida).
#' @noRd
.armz_codigos_mal_ubicados <- function(fila, base, inst) {
  arm <- fila$armonizacion
  entrada <- ((arm %||% list())$por_base %||% list())[[base]]
  if (is.null(entrada) || !isTRUE(entrada$comparable)) return(list())
  var <- .equiv_armon_chr((fila$variables %||% list())[[base]], "")
  if (!nzchar(var) || is.null(inst)) return(list())
  opciones <- tryCatch(.equiv_escala_opciones(inst, var), error = function(e) list())
  escala <- arm$escala %||% list()
  if (!length(opciones) || length(escala) < 2L) return(list())
  esc_cod <- vapply(escala, function(e) as.character(e$codigo), character(1))
  esc_etq <- vapply(escala, function(e) as.character(e$etiqueta %||% e$codigo), character(1))
  esc_pal <- lapply(esc_etq, .armz_palabras_etiqueta)
  mapa <- entrada$mapa %||% list()
  if (any(nzchar(as.character(unlist(mapa, use.names = FALSE))))) return(list())
  codigos <- vapply(opciones, `[[`, character(1), "codigo")
  destinos <- ifelse(codigos %in% esc_cod, codigos, "")
  repetidos <- names(which(table(destinos[nzchar(destinos)]) > 1))
  out <- list()
  for (i in seq_along(codigos)) {
    d <- destinos[[i]]
    j <- match(d, esc_cod)
    if (!nzchar(d) || d %in% repetidos || is.na(j)) next
    pal <- .armz_palabras_etiqueta(opciones[[i]]$etiqueta)
    if (!length(pal)) next
    sim <- vapply(esc_pal, function(p) {
      if (length(p) && all(p %in% pal) && length(p) < length(pal)) return(0)
      .armz_parecido(pal, p)
    }, numeric(1))
    sim[[j]] <- .armz_parecido(pal, esc_pal[[j]])
    k <- which.max(replace(sim, j, -1))
    if (sim[[k]] >= 0.5 && sim[[k]] > sim[[j]]) {
      out[[length(out) + 1L]] <- list(
        codigo = codigos[[i]], etiqueta = .armz_impreso(opciones[[i]]$etiqueta),
        destino = d, etiqueta_destino = .armz_impreso(esc_etq[[j]]),
        sugerida = .armz_impreso(esc_etq[[k]]))
    }
  }
  out
}
