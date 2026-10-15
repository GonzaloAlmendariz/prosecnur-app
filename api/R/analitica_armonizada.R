# Analítica armonizada: series de mediciones comparables (contrato E4-E7, R4)
# =========================================================================
#
# PROBLEMA. HSyVbG 2024, 2025 y 2026 preguntan lo mismo con listas distintas.
# La armonización de cada pregunta vive en su fila de la matriz de
# equivalencias (R3, `equivalencias_armonizacion.R`): una escala común y, por
# base, un mapa de códigos o la marca «no comparable». Este archivo apila las
# bases de la serie con esa escala y calcula lo que los comparativos imprimen.
#
# FUENTE (R4b, punto 1). Cada período se lee por la MISMA ruta que las tablas
# anuales de Analítica: `.load_rp_sources()` (fuente «adaptados» con sus
# `_recod`/`_agrup`, caso válido, contrato del instrumento) y
# `.analitica_apply_data_review()` con la config de esa base. Invariante: con
# un mapa total, el N sin ponderar de un año es el denominador de la tabla
# anual de ese año y esa variable.
#
# GRANO Y DENOMINADOR. Cada período es una base completa con su propio peso.
# El peso sólo se usa si la base DECLARA su ponderación (punto 2): modo columna
# o calibración con `enabled = true`, o «sin ponderar» con `enabled = false`
# (entonces una columna `peso` de la base se ignora). Una columna `peso` sin
# declaración corta con 409 `E_ARMONIZADA_PESO_NO_DECLARADO`: el comparativo no
# adivina. El denominador de un período es la suma de pesos de los casos con
# código armonizado. Nunca se suma un total entre períodos.
#
# CASOS SIN MAPA (puntos 3 y 5). Un código de la base que no tiene destino en
# la escala queda NA y sale del denominador. Se cuentan aparte, por pregunta y
# período: `n_sin_mapa` (sustantivos) y `n_especial_sin_mapa` (80-99). Los
# sustantivos se avisan en el pie y en el resumen. Si NINGÚN caso de un período
# comparable cae en la escala y la variable trae respuestas sustantivas, el
# mapa está roto: 409 `E_ARMONIZADA_MAPA_ROTO`, nunca «n.a.». Una variable
# `select_multiple` no se armoniza con un mapa de códigos: 409
# `E_ARMONIZADA_SELECT_MULTIPLE`.
#
# UNA FILA DEFECTUOSA NO TUMBA EL LIBRO. Si se piden varias preguntas (o
# varios cruces) y una tiene el mapa roto o es de opción múltiple, esa fila se
# omite y queda declarada: aviso `pregunta_omitida` / `cruce_omitido` con su
# `motivo`, hoja «Preguntas omitidas» en el libro y `omitidas` en el manifest.
# Con una sola fila pedida, o si todas son defectuosas, se mantiene el 409.
#
# MARCAS.
#   «n.c.» la fila no es comparable en ese período (sin entrada en `por_base`
#          o `comparable = false`). Vale para la pregunta y para cada cruce.
#          También cuando la base está declarada comparable pero la fila no
#          tiene variable en ella (p. ej. «(pendiente)» en la matriz
#          importada): `motivo = "sin_variable"`, con su propia nota de pie y
#          un aviso `sin_variable`. Si ninguna medición de la serie tiene
#          variable para una pregunta, la pregunta se omite del libro y queda
#          un aviso `pregunta_omitida`. El comparativo no corta por eso: el
#          409 `E_EQUIV_ARMONIZACION_SIN_VARIABLE` es del preview de R3.
#          Una variable declarada que no está en los datos de Analítica
#          (excluida en esa base o ausente de la base) también sale «n.c.»,
#          con `motivo = "variable_ausente"` y aviso propio
#          (`analitica_armonizada_ausente.R`).
#   «n.a.» una categoría de cruce ofrecida que no tiene casos en ese período,
#          o una pregunta sin ninguna respuesta sustantiva (N == 0).
#   «—»    la categoría de la escala no tiene ningún código de origen en el
#          mapa de esa base (mapa no vacío): la opción no se ofrecía ese año.
#          Es una marca estructural, distinta de un cero observado (punto 4).
#
# Este archivo es motor puro salvo `.armz_preparar()`, que lee la sesión. Los
# writers viven en `reporte_comparativo.R` y el router en `router_armonizada.R`.

.armz_txt <- function(x) .notas_pie_texto(x)

# ---- Períodos y rótulos -------------------------------------------------------

#' Rótulo de cada período: el parámetro manda, si no el año del nombre de base
#' cuando ese año no se repite en la serie, y si no el nombre de base.
#' @noRd
# El año se reconoce sólo como 19xx o 20xx dentro del nombre de base, a
# propósito: otro número de cuatro cifras en el nombre (un código de base, un
# correlativo «ola_0007») no es un año y no debe rotular la medición.
.armz_rotulos <- function(periodos, rotulos = NULL) {
  periodos <- as.character(periodos)
  out <- stats::setNames(periodos, periodos)
  anio <- regmatches(periodos, regexpr("(19|20)[0-9]{2}", periodos))
  con_anio <- grepl("(19|20)[0-9]{2}", periodos)
  # El año sólo rotula si identifica al período: dos bases del mismo año
  # («docentes_2024», «egresados_2024») conservan su nombre de base.
  out[con_anio] <- anio
  repetido <- con_anio & (out %in% out[con_anio][duplicated(out[con_anio])])
  out[repetido] <- periodos[repetido]
  if (is.null(rotulos) || !length(rotulos)) return(out)
  nms <- names(rotulos)
  vals <- vapply(seq_along(rotulos), function(i) .armz_txt(rotulos[i]), character(1))
  if (!is.null(nms) && any(nzchar(nms))) {
    for (i in seq_along(vals)) {
      if (nzchar(nms[i]) && nms[i] %in% periodos && nzchar(vals[i])) out[[nms[i]]] <- vals[i]
    }
  } else {
    k <- min(length(vals), length(periodos))
    for (i in seq_len(k)) if (nzchar(vals[i])) out[[periodos[i]]] <- vals[i]
  }
  out
}

# ---- Apilado ---------------------------------------------------------------

.armz_escala <- function(fila) {
  esc <- (fila$armonizacion %||% list())$escala %||% list()
  list(
    codigos = vapply(esc, function(e) as.character(e$codigo), character(1)),
    etiquetas = vapply(esc, function(e) .armz_txt(e$etiqueta %||% e$codigo), character(1))
  )
}

.armz_titulo_fila <- function(fila) {
  enun <- .armz_txt(fila$enunciado)
  if (nzchar(enun)) return(enun)
  .armz_txt(fila$etiqueta_estandar)
}

.armz_nota_base <- function(fila, base) {
  .armz_txt((((fila$armonizacion %||% list())$por_base %||% list())[[base]] %||% list())$nota)
}

# Variable de la fila en una base ("" si la matriz no la declara).
.armz_variable <- function(fila, base) {
  .equiv_armon_chr((fila$variables %||% list())[[base]], "")
}

# La base está declarada comparable para la fila pero la fila no tiene
# variable en ella: se marca «n.c.» con motivo propio, no se corta.
.armz_sin_variable <- function(fila, base) {
  entrada <- (((fila$armonizacion %||% list())$por_base %||% list())[[base]])
  !is.null(entrada) && isTRUE(entrada$comparable) && !nzchar(.armz_variable(fila, base))
}

# Estado «n.c.» de un período con su motivo. Una variable declarada que no
# está en los datos lleva su `causa` y su nombre para el pie.
.armz_nc <- function(d, b) {
  if (isTRUE(d$sin_variable[[b]])) return(list(estado = "n.c.", motivo = "sin_variable"))
  causa <- unname((d$ausente %||% character(0))[b])
  if (length(causa) == 1L && !is.na(causa) && nzchar(causa)) {
    return(list(estado = "n.c.", motivo = "variable_ausente", causa = causa,
                variable = unname((d$variable_por %||% character(0))[b])))
  }
  list(estado = "n.c.", motivo = "no_comparable")
}

# Categorías de la escala sin ningún código de origen en el mapa de la base.
# Un mapa vacío es identidad: todas las categorías se ofrecían.
.armz_no_ofrecidas <- function(fila, base, escala_codigos) {
  entrada <- (((fila$armonizacion %||% list())$por_base %||% list())[[base]]) %||% list()
  mapa <- entrada$mapa %||% list()
  if (!isTRUE(entrada$comparable) || !length(mapa)) return(character(0))
  destinos <- unique(as.character(unlist(mapa, use.names = FALSE)))
  setdiff(escala_codigos, destinos)
}

# ¿La variable es select_multiple en esta base? Por el instrumento y, si la
# columna madre no está, por sus dummies `var/cod` o `var.cod`.
.armz_es_select_multiple <- function(inst, df, var) {
  sv <- (inst %||% list())$survey
  if (is.data.frame(sv) && all(c("name", "type") %in% names(sv))) {
    i <- match(tolower(var), tolower(as.character(sv$name)))
    if (!is.na(i) && identical(.analitica_type_base(sv$type[i]), "select_multiple")) return(TRUE)
  }
  if (is.data.frame(df) && !var %in% names(df)) {
    return(any(startsWith(names(df), paste0(var, "/")) | startsWith(names(df), paste0(var, "."))))
  }
  FALSE
}

# Casos sin destino en la escala, sin ponderar: sustantivos y especiales 80-99.
# Un especial que la escala contiene o que otra base mapea es una omisión del
# mapa de ESTA base, no una no respuesta: cuenta como sustantivo (`cubiertos`).
# `etiquetas` traduce los especiales excluidos para el pie de los cruces.
.armz_sin_mapa <- function(orig, armon, cubiertos = character(0), etiquetas = NULL) {
  sm <- !is.na(orig) & is.na(armon)
  esp <- .equiv_bloques_es_especial(orig) & !(orig %in% cubiertos)
  sust <- sm & !esp
  cods <- unique(orig[sust])
  cods_esp <- .equiv_armon_orden_codigos(unique(orig[sm & esp]))
  etq_esp <- vapply(cods_esp, function(cd) {
    e <- if (!is.null(etiquetas) && cd %in% names(etiquetas)) .armz_txt(etiquetas[[cd]]) else ""
    if (nzchar(e)) e else cd
  }, character(1))
  list(n_sin_mapa = sum(sust), n_especial_sin_mapa = sum(sm & esp),
       codigos_sin_mapa = as.list(.equiv_armon_orden_codigos(cods)),
       codigos_especiales = as.list(cods_esp),
       etiquetas_especiales = as.list(unname(etq_esp)))
}

# Códigos que la fila reconoce en alguna base: la escala y los orígenes de
# todos los mapas. Un especial de esta lista sin mapa en una base se omitió.
.armz_codigos_cubiertos <- function(fila, escala_codigos) {
  pb <- (fila$armonizacion %||% list())$por_base %||% list()
  origenes <- unlist(lapply(pb, function(e) names(e$mapa %||% list())), use.names = FALSE)
  unique(c(escala_codigos, as.character(origenes)))
}

# Etiquetas de los códigos de una variable en el instrumento de la base.
.armz_etiquetas_var <- function(inst, var) {
  ol <- ((inst %||% list())$orders_list %||% list())[[var]]
  if (is.null(ol) || is.null(ol$names)) return(NULL)
  stats::setNames(as.character(ol$labels %||% ol$names), as.character(ol$names))
}

#' Apila las bases de la serie con la escala armonizada.
#'
#' @param datos Lista nombrada base -> data.frame, ya con la ponderación de
#'   su base aplicada (columna `peso` sólo si pondera).
#' @param filas Filas de la matriz (preguntas) con `armonizacion`.
#' @param cruces Filas de la matriz que hacen de variables de cruce.
#' @param periodos Nombres de base en el orden de la serie.
#' @param insts Instrumentos por base (para rechazar `select_multiple`).
#' @param excluidas Lista base -> `variables_excluidas` de la config de
#'   Analítica de esa base. Distingue la causa de una variable ausente.
#' @return list(periodos, data, preguntas, cruces). `data` lleva `periodo`,
#'   `peso` y una columna por pregunta (`q1`…) y por cruce (`x1`…) con el
#'   código de la escala o NA. Cada descriptor trae `comparable`, `notas`,
#'   `no_ofrecidas`, `sin_mapa` y `ausente` (causa o "") por período. Una
#'   variable declarada que no está en los datos deja el período «n.c.».
#' @keywords internal
armonizada_apilar <- function(datos, filas, cruces = list(), periodos = names(datos), insts = list(),
                              excluidas = list()) {
  periodos <- as.character(periodos)
  faltan <- setdiff(periodos, names(datos))
  if (length(faltan)) {
    stop_api(409, "E_NO_DATA",
             sprintf("La base «%s» no tiene data cargada.", faltan[[1]]), list(base = faltan[[1]]))
  }
  describir <- function(lista, prefijo) {
    lapply(seq_along(lista), function(i) {
      f <- lista[[i]]
      comp <- vapply(periodos, function(b) !is.null(.equiv_armon_spec(f, b)), logical(1))
      notas <- vapply(periodos, function(b) .armz_nota_base(f, b), character(1))
      claves <- unique(c(.armz_txt(f$id), .armz_txt(f$etiqueta_estandar),
                         as.character(unlist(f$variables %||% list(), use.names = FALSE))))
      escala <- .armz_escala(f)
      no_of <- lapply(periodos, function(b) .armz_no_ofrecidas(f, b, escala$codigos))
      sin_var <- vapply(periodos, function(b) .armz_sin_variable(f, b), logical(1))
      con_var <- vapply(periodos, function(b) nzchar(.armz_variable(f, b)), logical(1))
      ausente <- vapply(periodos, function(b) .armz_ausencia(
        f, b, datos[[b]], insts[[b]], excluidas[[b]]), character(1))
      comp <- comp & !nzchar(ausente)
      list(key = paste0(prefijo, i), fila = f, titulo = .armz_titulo_fila(f),
           claves = claves[nzchar(claves)],
           etiqueta = .armz_txt(f$etiqueta_estandar) %||% "",
           seccion = .armz_txt(f$seccion), escala = escala,
           comparable = stats::setNames(comp, periodos),
           sin_variable = stats::setNames(sin_var, periodos),
           ausente = stats::setNames(ausente, periodos),
           # ADR 0105: de un indicador compuesto se nombra la componente que falta.
           variable_por = stats::setNames(vapply(periodos, function(b) .equiv_deriv_variable_aviso(
             f, b, datos[[b]], excluidas[[b]]), character(1)), periodos),
           con_variable = any(con_var),
           notas = stats::setNames(notas, periodos),
           no_ofrecidas = stats::setNames(no_of, periodos))
    })
  }
  preguntas <- describir(filas, "q")
  xs <- describir(cruces, "x")

  # Una pregunta sin variable en NINGUNA medición no tiene nada que imprimir:
  # sale del libro y queda en `omitidas` para el aviso `pregunta_omitida`.
  sin_ninguna <- vapply(preguntas, function(d) !isTRUE(d$con_variable), logical(1))
  omitidas <- lapply(preguntas[sin_ninguna], function(d) list(
    tipo = "pregunta", fila = d$etiqueta, titulo = d$titulo, claves = d$claves,
    motivo = "sin_variable"))
  preguntas <- preguntas[!sin_ninguna]
  if (length(filas) && !length(preguntas)) {
    stop_api(409, "E_ARMONIZADA_SIN_FILAS",
             "Ninguna de las preguntas elegidas tiene variable declarada en la matriz para alguna medición de la serie.",
             list(omitidas = lapply(omitidas, `[[`, "fila")))
  }

  ok_q <- .armz_columnas_lista(preguntas, datos, periodos, insts, "pregunta", length(filas))
  ok_x <- .armz_columnas_lista(xs, datos, periodos, insts, "cruce", length(cruces))
  omitidas <- c(omitidas, ok_q$omitidas, ok_x$omitidas)
  cols <- c(ok_q$cols, ok_x$cols)

  partes <- lapply(periodos, function(b) {
    df <- datos[[b]]
    out <- data.frame(periodo = rep(b, nrow(df)), peso = get_pesos(df, "peso"),
                      stringsAsFactors = FALSE)
    for (k in names(cols)) out[[k]] <- cols[[k]]$v[[b]]
    out
  })
  data <- do.call(rbind, partes)
  if (is.null(data)) data <- data.frame(periodo = character(0), peso = numeric(0))
  agregar_sm <- function(lista) lapply(lista, function(d) {
    d$sin_mapa <- cols[[d$key]]$sm %||% list()
    d
  })
  list(periodos = periodos, data = data, preguntas = agregar_sm(ok_q$lista),
       cruces = agregar_sm(ok_x$lista), omitidas = omitidas)
}

# Columna armonizada de UNA fila en cada período y sus casos sin mapa. Corta
# con 409 si la fila es de opción múltiple o su mapa no deja ningún caso.
.armz_columnas_fila <- function(d, datos, periodos, insts) {
  if (any(nzchar(d$ausente %||% character(0))) && !any(d$comparable)) .armz_stop_sin_utilizable(d)
  v_por <- list()
  sm_por <- list()
  for (b in periodos) {
    df <- datos[[b]]
    if (isTRUE(nzchar(unname(d$ausente[b])))) {
      v_por[[b]] <- rep(NA_character_, nrow(df))
      next
    }
    spec <- .equiv_armon_spec(d$fila, b)
    if (!is.null(spec) && .armz_es_select_multiple(insts[[b]], df, spec$parent)) {
      stop_api(409, "E_ARMONIZADA_SELECT_MULTIPLE", sprintf(
        "«%s» es de opción múltiple en la base «%s» (variable «%s»). El comparativo armoniza preguntas de una sola respuesta: compara cada opción como su propia fila.",
        d$titulo, b, spec$parent), list(fila = d$etiqueta, base = b, variable = spec$parent))
    }
    v <- equiv_armonizar_base(df, d$fila, b)
    if (is.null(v)) {
      v_por[[b]] <- rep(NA_character_, nrow(df))
      next
    }
    v <- as.character(v)
    sm <- .armz_sin_mapa(.codif_agrupar_codigo_chr(df[[spec$parent]]), v,
                         cubiertos = .armz_codigos_cubiertos(d$fila, d$escala$codigos),
                         etiquetas = .armz_etiquetas_var(insts[[b]], spec$parent))
    if (!any(!is.na(v)) && sm$n_sin_mapa > 0) {
      stop_api(409, "E_ARMONIZADA_MAPA_ROTO", sprintf(
        "Ningún caso de la base «%s» cae en la escala de «%s», aunque «%s» trae %d respuestas (códigos %s). Revisa el mapa de esa base en la matriz de equivalencias.",
        b, d$titulo, spec$parent, as.integer(sm$n_sin_mapa),
        paste(unlist(sm$codigos_sin_mapa), collapse = ", ")),
        list(fila = d$etiqueta, base = b, variable = spec$parent,
             codigos = sm$codigos_sin_mapa))
    }
    sm_por[[b]] <- sm
    v_por[[b]] <- v
  }
  list(v = v_por, sm = sm_por)
}

# Errores de UNA fila que no invalidan a las demás: la fila se omite.
.ARMZ_DEFECTOS_OMITIBLES <- c(E_ARMONIZADA_MAPA_ROTO = "mapa_roto",
                              E_ARMONIZADA_SELECT_MULTIPLE = "select_multiple",
                              E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE = "variable_ausente")

#' Columnas de una lista de filas (preguntas o cruces). Una fila defectuosa
#' (mapa roto, opción múltiple) se omite y queda declarada en `omitidas`
#' cuando se pidió más de una fila y al menos otra sale. Si se pidió una sola,
#' o todas son defectuosas, se mantiene el 409 de la primera.
#' @return list(lista = descriptores que salen, cols = {key: list(v, sm)},
#'   omitidas = [{tipo, fila, titulo, claves, motivo, codigo_error, base, variable,
#'   codigos, detalle}]).
#' @noRd
.armz_columnas_lista <- function(lista, datos, periodos, insts, tipo, n_pedidas) {
  cols <- list()
  errores <- list()
  omitidas <- list()
  quedan <- list()
  for (d in lista) {
    r <- tryCatch(.armz_columnas_fila(d, datos, periodos, insts), api_error = function(e) e)
    if (!inherits(r, "api_error")) {
      cols[[d$key]] <- r
      quedan[[length(quedan) + 1L]] <- d
      next
    }
    if (!r$code %in% names(.ARMZ_DEFECTOS_OMITIBLES)) stop(r)
    errores[[length(errores) + 1L]] <- r
    det <- r$details %||% list()
    omitidas[[length(omitidas) + 1L]] <- list(
      tipo = tipo, fila = d$etiqueta, titulo = d$titulo, claves = d$claves,
      motivo = unname(.ARMZ_DEFECTOS_OMITIBLES[[r$code]]), codigo_error = r$code,
      base = det$base, variable = det$variable, codigos = det$codigos,
      ausentes = det$ausentes, detalle = conditionMessage(r))
  }
  if (length(errores) && (n_pedidas <= 1L || !length(quedan))) stop(errores[[1]])
  list(lista = quedan, cols = cols, omitidas = omitidas)
}

# ---- Cálculo ----------------------------------------------------------------

# N sin ponderar = casos con código de la escala y peso positivo (punto 7):
# un caso con peso 0 no aporta al N ponderado y tampoco cuenta como caso.
.armz_conteo <- function(codigos_escala, x, w) {
  ok <- !is.na(x)
  n <- vapply(codigos_escala, function(cd) sum(w[ok & x == cd]), numeric(1))
  list(n = stats::setNames(n, codigos_escala), N = sum(n),
       N_sin_peso = sum(ok & x %in% codigos_escala & w > 0))
}

.armz_meta <- function(d) {
  list(key = d$key, etiqueta = d$etiqueta, escala = d$escala, claves = d$claves,
       comparable = d$comparable, sin_variable = d$sin_variable, ausente = d$ausente,
       variable_por = d$variable_por, notas = d$notas,
       no_ofrecidas = d$no_ofrecidas, sin_mapa = d$sin_mapa)
}

#' Modelo del comparativo simple: por pregunta y período, N y % ponderados.
#' @return list(periodos, preguntas, ponderacion).
#' @keywords internal
armonizada_modelo_frecuencias <- function(ap) {
  d <- ap$data
  preguntas <- lapply(ap$preguntas, function(q) {
    por_periodo <- lapply(ap$periodos, function(b) {
      if (!isTRUE(q$comparable[[b]])) return(.armz_nc(q, b))
      sel <- d$periodo == b
      ct <- .armz_conteo(q$escala$codigos, d[[q$key]][sel], d$peso[sel])
      pct <- if (ct$N > 0) ct$n / ct$N else rep(NA_real_, length(ct$n))
      list(estado = if (ct$N > 0) "ok" else "n.a.", n = ct$n, N = ct$N,
           pct = stats::setNames(pct, names(ct$n)), N_sin_peso = ct$N_sin_peso,
           no_ofrecidas = q$no_ofrecidas[[b]] %||% character(0))
    })
    names(por_periodo) <- ap$periodos
    q$fila <- NULL
    c(q, list(periodos = por_periodo))
  })
  list(periodos = ap$periodos, preguntas = preguntas, ponderacion = ap$ponderacion,
       omitidas = ap$omitidas %||% list())
}

# Letras de una variable de cruce dentro de UN período. Usa la prueba de
# siempre (`comparar_columnas_sig`) sobre conteos ponderados, igual que
# `nN_para_sig_simple` en cruces. La matriz incluye las columnas sin casos para
# que las letras conserven su posición (A, B, C) en el encabezado; esas
# columnas se marcan «n.a.» y no participan (la prueba ya las bloquea).
.armz_letras <- function(n_mat, N_vec, alpha) {
  cmp <- comparar_columnas_sig(n_mat, N_vec, alpha = alpha)
  let <- trimws(cmp$letras)
  let[, N_vec <= 0] <- "n.a."
  let
}

#' Modelo del comparativo de cruces: por pregunta, período y variable de
#' cruce, n/N ponderados, N sin ponderar por columna y letras.
#' @return list(periodos, cruces, preguntas, ponderacion).
#' @keywords internal
armonizada_modelo_cruces <- function(ap, alpha = 0.05) {
  d <- ap$data
  cruces_meta <- lapply(ap$cruces, .armz_meta)
  preguntas <- lapply(ap$preguntas, function(q) {
    por_periodo <- lapply(ap$periodos, function(b) {
      if (!isTRUE(q$comparable[[b]])) return(.armz_nc(q, b))
      sel <- d$periodo == b
      xq <- d[[q$key]][sel]
      w <- d$peso[sel]
      total <- .armz_conteo(q$escala$codigos, xq, w)
      por_cruce <- lapply(cruces_meta, function(x) {
        if (!isTRUE(x$comparable[[b]])) return(.armz_nc(x, b))
        xc <- d[[x$key]][sel]
        cats <- x$escala$codigos
        n_mat <- matrix(0, nrow = length(q$escala$codigos), ncol = length(cats),
                        dimnames = list(q$escala$codigos, cats))
        N_vec <- stats::setNames(numeric(length(cats)), cats)
        Nsp <- stats::setNames(integer(length(cats)), cats)
        for (j in seq_along(cats)) {
          m <- !is.na(xc) & xc == cats[j]
          ct <- .armz_conteo(q$escala$codigos, xq[m], w[m])
          n_mat[, j] <- ct$n
          N_vec[j] <- ct$N
          Nsp[j] <- as.integer(ct$N_sin_peso)
        }
        list(estado = "ok", n_mat = n_mat, N_vec = N_vec, N_sin_peso = Nsp,
             letras = .armz_letras(n_mat, N_vec, alpha),
             no_ofrecidas = x$no_ofrecidas[[b]] %||% character(0))
      })
      names(por_cruce) <- vapply(cruces_meta, `[[`, character(1), "key")
      list(estado = "ok", total = total, cruces = por_cruce,
           no_ofrecidas = q$no_ofrecidas[[b]] %||% character(0))
    })
    names(por_periodo) <- ap$periodos
    q$fila <- NULL
    c(q, list(periodos = por_periodo))
  })
  list(periodos = ap$periodos, cruces = cruces_meta, preguntas = preguntas,
       ponderacion = ap$ponderacion, omitidas = ap$omitidas %||% list())
}

# ---- Avisos -------------------------------------------------------------------

.armz_fmt_n <- function(x) format(round(x, 2), big.mark = ",", decimal.mark = ".",
                                  scientific = FALSE, trim = TRUE)

#' Avisos del comparativo para el resumen del job: casos sustantivos sin
#' correspondencia en la escala, suma de pesos que se aparta del número de
#' casos en más de 2 %, notas por pregunta que no casan con ninguna fila,
#' períodos sin variable declarada (`sin_variable`, uno por fila y base) y
#' preguntas y cruces omitidos (`pregunta_omitida`, `cruce_omitido`, con
#' `motivo` sin_variable, mapa_roto, select_multiple o variable_ausente, y
#' `base`/`codigos`/`ausentes`
#' cuando el defecto es de una base).
#' @return Lista de list(tipo, base?, fila?, mensaje).
#' @keywords internal
armonizada_avisos <- function(ap, rotulos = .armz_rotulos(ap$periodos), notas_pregunta = NULL) {
  out <- list()
  unidad <- .comparativo_unidad(rotulos[ap$periodos])
  for (b in ap$periodos) {
    p <- (ap$ponderacion %||% list())[[b]]
    if (is.null(p)) next
    for (m in p$avisos %||% list()) {
      out[[length(out) + 1L]] <- list(tipo = "ponderacion", base = b, mensaje = as.character(m))
    }
    if (isTRUE(p$peso_ignorado)) {
      out[[length(out) + 1L]] <- list(tipo = "peso_ignorado", base = b, mensaje = sprintf(
        "La base %s trae una columna peso que el comparativo no usa porque la ponderación está declarada sin ponderar. Las tablas anuales sí la usan.",
        rotulos[[b]]))
    }
    r <- suppressWarnings(as.numeric(p$razon_suma_n))
    if (isTRUE(p$pondera) && length(r) == 1L && is.finite(r) && abs(r - 1) > 0.02) {
      out[[length(out) + 1L]] <- list(tipo = "suma_pesos", base = b, mensaje = sprintf(
        "En %s los pesos suman %s con %s casos (%s%%). Los N ponderados de %s no son conteos de casos.",
        rotulos[[b]], .armz_fmt_n(p$suma_pesos), .armz_fmt_n(p$n),
        sprintf("%+.1f", 100 * (r - 1)), unidad$ese))
    }
  }
  for (d in c(ap$preguntas, ap$cruces)) {
    for (b in names(d$sin_mapa %||% list())) {
      sm <- d$sin_mapa[[b]]
      if (sm$n_sin_mapa > 0) {
        out[[length(out) + 1L]] <- list(tipo = "sin_mapa", base = b, fila = d$etiqueta, mensaje = sprintf(
          "«%s»: %s de %s sin correspondencia en la escala (códigos %s). Quedan fuera del denominador.",
          d$titulo, .armz_casos(sm$n_sin_mapa), rotulos[[b]],
          paste(unlist(sm$codigos_sin_mapa), collapse = ", ")))
      }
    }
  }
  for (d in c(ap$preguntas, ap$cruces)) {
    for (b in ap$periodos[vapply(ap$periodos, function(b) isTRUE(d$sin_variable[[b]]), logical(1))]) {
      out[[length(out) + 1L]] <- list(tipo = "sin_variable", base = b, fila = d$etiqueta, mensaje = sprintf(
        "«%s» no tiene variable declarada en la matriz para %s. %s sale como n.c.",
        d$titulo, rotulos[[b]], .armz_capital(unidad$ese)))
    }
  }
  out <- c(out, .armz_avisos_ausente(ap, rotulos))
  for (o in ap$omitidas %||% list()) {
    av <- list(tipo = if (identical(o$tipo, "cruce")) "cruce_omitido" else "pregunta_omitida",
               fila = o$fila, motivo = o$motivo %||% "sin_variable")
    if (length(o$base)) av$base <- o$base
    if (length(o$ausentes)) av$ausentes <- o$ausentes
    if (length(o$codigos)) av$codigos <- o$codigos
    av$mensaje <- sprintf("«%s» no se incluyó en el comparativo%s. %s", o$titulo,
                          if (identical(o$tipo, "cruce")) " como variable de cruce" else "",
                          .armz_motivo_omision(o, rotulos))
    out[[length(out) + 1L]] <- av
  }
  claves <- unique(unlist(lapply(ap$preguntas, `[[`, "claves")))
  for (k in setdiff(names(notas_pregunta %||% list()), claves)) {
    out[[length(out) + 1L]] <- list(tipo = "nota_sin_pregunta", fila = k, mensaje = sprintf(
      "La nota de «%s» no corresponde a ninguna pregunta del comparativo y no se imprimió.", k))
  }
  out
}

# Por qué una fila salió del comparativo, en una frase. La usan el aviso y la
# hoja «Preguntas omitidas» del libro.
.armz_motivo_omision <- function(o, rotulos = NULL) {
  rot <- function(b) {
    r <- if (!is.null(rotulos) && length(b) && b %in% names(rotulos)) rotulos[[b]] else b
    as.character(r %||% "")
  }
  cods <- paste(unlist(o$codigos %||% list()), collapse = ", ")
  switch(o$motivo %||% "sin_variable",
    mapa_roto = sprintf(
      "Ningún caso de %s cae en la escala%s. Revisa el mapa de esa base en la matriz de equivalencias.",
      rot(o$base), if (nzchar(cods)) paste0(" (códigos ", cods, ")") else ""),
    select_multiple = sprintf(
      "Es de opción múltiple en %s%s. El comparativo armoniza preguntas de una sola respuesta.",
      rot(o$base), if (length(o$variable)) paste0(" (variable «", o$variable, "»)") else ""),
    variable_ausente = .armz_motivo_omision_ausente(o, rotulos),
    "No tiene variable declarada en la matriz para ninguna medición de la serie.")
}

.armz_capital <- function(x) paste0(toupper(substr(x, 1, 1)), substr(x, 2, nchar(x)))

.armz_casos <- function(n) sprintf("%s %s", .armz_fmt_n(n), if (n == 1) "caso" else "casos")

# ---- Lado sesión --------------------------------------------------------------

#' Orden de la serie: `armonizacion_periodos` de la matriz y, si no lo hay,
#' el orden de las bases del estudio.
#' @noRd
.armz_periodos_estudio <- function(sid, equiv) {
  s <- session_get(sid, required = FALSE)
  bases <- names(((s %||% list())$estudio %||% list())$bases %||% list())
  p <- as.character(unlist(equiv$armonizacion_periodos %||% character(0), use.names = FALSE))
  p <- p[nzchar(p)]
  if (!length(p)) p <- bases
  if (length(bases)) p <- p[p %in% bases]
  p
}

.armz_misma_fila <- function(a, b) {
  identical(.armz_txt(a$id), .armz_txt(b$id)) &&
    identical(.equiv_armon_clave_variables(a), .equiv_armon_clave_variables(b)) &&
    identical(.armz_txt(a$etiqueta_estandar), .armz_txt(b$etiqueta_estandar))
}

.armz_resolver <- function(equiv, refs) {
  lapply(refs, function(r) {
    f <- .equiv_armon_resolver_fila(equiv, r)
    if (is.null(f$armonizacion)) {
      stop_api(409, "E_EQUIV_SIN_ARMONIZACION",
               sprintf("La fila «%s» no declara armonización.", .armz_txt(f$etiqueta_estandar)),
               list(fila = as.character(r)))
    }
    f
  })
}

.armz_refs <- function(x) {
  v <- as.character(unlist(x %||% character(0), use.names = FALSE))
  v[!is.na(v) & nzchar(trimws(v))]
}

#' Resuelve filas y cruces, carga cada período con su ponderación y apila.
#'
#' @param filas_refs Índices 0-based, ids o etiquetas. Vacío = todas las filas
#'   con armonización que no se usan como cruce.
#' @param cruces_refs Igual, para las variables de cruce.
#' @return `armonizada_apilar()` más `ponderacion` (estado por período).
#' @keywords internal
.armz_preparar <- function(sid, cfg, filas_refs = NULL, cruces_refs = NULL) {
  equiv <- (session_get(sid, required = FALSE) %||% list())$equivalencias_publicos
  todas <- (equiv %||% list())$filas %||% list()
  con_arm <- Filter(function(f) !is.null(f$armonizacion), todas)
  if (!length(con_arm)) {
    stop_api(409, "E_ARMONIZADA_SIN_MATRIZ",
             "La matriz de equivalencias no tiene preguntas armonizadas.")
  }
  periodos <- .armz_periodos_estudio(sid, equiv)
  if (length(periodos) < 2L) {
    stop_api(409, "E_ARMONIZADA_PERIODOS",
             "El comparativo necesita al menos dos mediciones en la serie.",
             list(periodos = as.list(periodos)))
  }

  # Una hija repeat cuenta instancias, no personas: su total no es una medición.
  for (b in periodos) {
    if (!is.null(tryCatch(.analitica_repeat_child_meta(sid, b), error = function(e) NULL))) {
      stop_api(409, "E_ARMONIZADA_PERIODO_REPEAT", sprintf(
        "La base «%s» es una tabla hija de un grupo repetido y no puede ser una medición de la serie. Deja en la serie sólo bases de personas.",
        b), list(base = b))
    }
  }

  cruces <- .armz_resolver(equiv, .armz_refs(cruces_refs))
  refs <- .armz_refs(filas_refs)
  filas <- if (length(refs)) {
    .armz_resolver(equiv, refs)
  } else {
    Filter(function(f) !any(vapply(cruces, function(x) .armz_misma_fila(f, x), logical(1))), con_arm)
  }
  if (!length(filas)) {
    stop_api(409, "E_ARMONIZADA_SIN_FILAS",
             "No queda ninguna pregunta armonizada para el comparativo.")
  }

  fuentes <- .armz_fuentes(sid, periodos, cfg)
  datos <- list()
  pond <- list()
  for (b in periodos) {
    pr <- .armz_ponderar(sid, b, fuentes$datos[[b]], cfg)
    datos[[b]] <- pr$data
    pond[[b]] <- pr$estado
  }
  # ADR 0105: los indicadores compuestos se materializan como una columna más.
  prep <- .equiv_derivadas_preparar(datos, c(filas, cruces), periodos, fuentes$excluidas)
  ap <- armonizada_apilar(prep$datos, filas, cruces, periodos, insts = fuentes$insts,
                          excluidas = prep$excluidas)
  ap$ponderacion <- pond
  ap
}

# ---- Fuente de cada período: la de Analítica (punto 1) -------------------------

# Config con la que Analítica revisa ESTA base: la de la corrida para la activa
# (o para todas si el estudio no scopea por base), la propia si la tiene y, si
# no, el default (ADR 0061: una base separada no hereda la de otra).
.armz_cfg_revision <- function(sid, base, cfg) {
  if (!.analitica_config_es_por_base(sid)) return(cfg)
  if (identical(.analitica_scoped_base(sid), base)) return(cfg)
  .analitica_cfg_para_base(sid, base) %||% .analitica_default_config()
}

# Bases que `.load_rp_sources()` no devuelve porque el estudio scopea a la
# activa (`independent_siblings`). Se leen con los MISMOS pasos por base que
# `.analitica_prepare_context()`: par de la fuente efectiva, lectura (caso
# válido incluido), normalización y contrato del instrumento.
.armz_fuentes_hermanas <- function(sid, nombres, cfg) {
  s <- session_get(sid)
  bases <- (s$estudio %||% list())$bases %||% list()
  desconocidas <- setdiff(nombres, names(bases))
  if (length(desconocidas)) {
    stop_api(409, "E_NO_DATA", sprintf("La base «%s» no tiene data cargada.", desconocidas[[1]]),
             list(base = desconocidas[[1]]))
  }
  sel <- bases[nombres]
  ds <- list()
  is <- list()
  for (b in names(sel)) {
    # `fuente_preferida` es de cada base: la de su config, no la de la activa.
    fuente <- .analitica_effective_source(s, .armz_cfg_revision(sid, b, cfg), sel[b])
    pair <- .analitica_pair_for_base(s, sel[[b]], fuente, b)
    if (is.null(pair)) {
      stop_api(409, "E_ANALITICA_SOURCE_MISSING",
               sprintf("No se pudo resolver el par XLSForm/Data para la base '%s'.", b))
    }
    parsed <- .analitica_read_pair(pair, sel[[b]])
    ds[[b]] <- parsed$data
    is[[b]] <- parsed$inst
  }
  normalized <- .bases_normalize_source_contexts(ds, is)
  contracted <- instrument_analysis_apply_sources(s, normalized$data_sources, normalized$inst_sources)
  list(data_sources = contracted$data_sources, inst_sources = contracted$inst_sources)
}

#' Data e instrumento de cada período por la ruta de Analítica, revisados con
#' la config de su base. Sin ponderar todavía.
#' @return list(datos, insts, excluidas), nombradas por base. `excluidas` es
#'   `variables_excluidas` de la config de cada base.
#' @keywords internal
.armz_fuentes <- function(sid, periodos, cfg) {
  src <- .load_rp_sources(sid)
  ds <- src$data_sources
  is <- src$inst_sources
  faltan <- setdiff(periodos, names(ds))
  if (length(faltan)) {
    extra <- .armz_fuentes_hermanas(sid, faltan, cfg)
    ds[names(extra$data_sources)] <- extra$data_sources
    is[names(extra$inst_sources)] <- extra$inst_sources
  }
  datos <- list()
  insts <- list()
  excluidas <- list()
  for (b in periodos) {
    if (!is.data.frame(ds[[b]])) {
      stop_api(409, "E_NO_DATA", sprintf("La base «%s» no tiene data cargada.", b), list(base = b))
    }
    cfg_b <- .armz_cfg_revision(sid, b, cfg)
    rv <- .analitica_apply_data_review(ds[[b]], is[[b]], cfg_b)
    datos[[b]] <- rv$data
    insts[[b]] <- rv$inst
    excluidas[[b]] <- .as_chr_vec((cfg_b %||% list())$variables_excluidas)
  }
  list(datos = datos, insts = insts, excluidas = excluidas)
}

# ---- Ponderación declarada por base (puntos 2 y 7) ------------------------------

#' Aplica la ponderación DECLARADA de una base.
#'
#' Declarada = `ponderacion.enabled` presente en la config de la base.
#' `enabled = true` aplica columna o calibración. `enabled = false` es «sin
#' ponderar»: una columna `peso` que traiga la base se retira. Sin declaración
#' y con columna `peso` corta con 409: el comparativo no pondera por un peso que
#' nadie declaró. Si la calibración declarada no se aplica, el período sale sin
#' ponderar y el motivo queda en `avisos`.
#' @return list(data, estado).
#' @keywords internal
.armz_ponderar <- function(sid, base, df, cfg) {
  cfg_p <- .analitica_ponderacion_cfg_base(sid, base, cfg)
  pond <- (cfg_p %||% list())$ponderacion
  declarada <- is.list(pond) && !is.null(pond$enabled)
  activa <- declarada && isTRUE(.analitica_ponderacion_scalar(pond$enabled, FALSE))
  if (!declarada && "peso" %in% names(df)) {
    stop_api(409, "E_ARMONIZADA_PESO_NO_DECLARADO", sprintf(
      "La base «%s» trae una columna «peso» pero no declara su ponderación. Decláralo en Analítica, Ponderación de esa base: «por columna» con la columna del peso, o «sin ponderar» para ignorarla.",
      base), list(base = base))
  }
  avisos <- character(0)
  if (activa) {
    df <- withCallingHandlers(
      .analitica_ponderacion_apply(df, cfg_p),
      warning = function(w) {
        avisos <<- c(avisos, conditionMessage(w))
        invokeRestart("muffleWarning")
      }
    )
  }
  est <- attr(df, "ponderacion_estado")
  aplicada <- activa && identical(as.character((est %||% list())$status %||% ""), "aplicada") &&
    "peso" %in% names(df)
  peso_ignorado <- declarada && !activa && "peso" %in% names(df)
  if (!aplicada && "peso" %in% names(df)) df[["peso"]] <- NULL
  modo <- if (!aplicada) "" else as.character(est$modo %||% "calibracion")
  w <- get_pesos(df, "peso")
  n <- nrow(df)
  suma <- sum(w)
  list(data = df, estado = list(
    pondera = aplicada,
    declarada = declarada,
    metodo = if (!aplicada) "sin_ponderar" else modo,
    estado = if (aplicada) "aplicada" else if (activa) "no_aplicada" else "sin_ponderar",
    modo = modo,
    peso_columna = if (aplicada) as.character(est$peso_columna %||% "") else "",
    n = n,
    suma_pesos = suma,
    razon_suma_n = if (n > 0) suma / n else NA_real_,
    peso_ignorado = peso_ignorado,
    avisos = as.list(avisos)
  ))
}
