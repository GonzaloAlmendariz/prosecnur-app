# =============================================================================
# Monitoreo › Avance › Cuotas (T2): metas por categoría dentro de un público
#
# En acreditación la meta no es solo «811 docentes»: es «605 TPA, 197 DTC y 10
# TPC20», o una por facultad, o por puesto. La categoría de cada persona sale de
# SU FILA EN LA BASE —la columna del universo de su público— y no de lo que
# respondió: por eso la efectiva se cruza por la llave de la base (el token en
# Acreditación Institucional 2026) contra el `case_rollup` de Monitoreo.
#
# La propuesta de metas replica la hoja «Metas de encuestas» del
# dimensionamiento: meta de la categoría = personas × cobertura esperada,
# redondeada hacia arriba. Contrato:
# `docs/qa/checklist-monitoreo-cuotas-y-revamp-correo-2026-10-22.md`.
# =============================================================================

.MCU_SIN_DATO <- "Sin dato"
# Administrativos por puesto son ~90 categorías: es una cuota real del estudio.
.MCU_MAX_CATEGORIAS <- 150L

.mcu_texto <- function(x) {
  x <- trimws(as.character(x))
  x[is.na(x) | !nzchar(x) | x %in% c("NA", "N/A")] <- .MCU_SIN_DATO
  x
}

# Llave de la base normalizada como la de Monitoreo («codigo:XXXX»).
.mcu_llaves <- function(valores) .mcm_llave(trimws(as.character(valores)))

# Filas del universo con su actor y su llave. `campos_llave` son los
# `key_rules$universe_fields` del perfil, en su orden.
monitoreo_cuotas_universo <- function(data, campos_llave = character(0)) {
  vacio <- list(filas = data.frame(), columna_llave = "")
  if (!is.data.frame(data) || !nrow(data)) return(vacio)
  rol <- if (".source_role" %in% names(data)) as.character(data$.source_role) else rep("", nrow(data))
  filas <- data[rol == "universo", , drop = FALSE]
  if (!nrow(filas)) filas <- data[rol == "barrido", , drop = FALSE]
  if (!nrow(filas)) return(vacio)
  claves <- .monitoreo_text_key(names(filas))
  columna <- ""
  for (campo in as.character(unlist(campos_llave))) {
    i <- match(.monitoreo_text_key(campo), claves)
    if (!is.na(i)) { columna <- names(filas)[[i]]; break }
  }
  actor <- if ("dim_actor" %in% names(filas)) trimws(as.character(filas$dim_actor)) else rep("", nrow(filas))
  actor[is.na(actor) | !nzchar(actor)] <- "Sin actor"
  filas$.mcu_actor <- actor
  filas$.mcu_llave <- if (nzchar(columna)) .mcu_llaves(filas[[columna]]) else rep("", nrow(filas))
  list(filas = filas, columna_llave = columna)
}

# Columnas de la base de un público que sirven como cuota: entre 2 y 150
# categorías, sin contar la llave ni las columnas técnicas. Una columna donde
# casi cada persona tiene su propio valor (N°, código, nombre, correo, celular)
# es un identificador aunque quepa en el rango: en un público de 16 personas
# tiene 16 «categorías». «Casi» es el 90 %: el celular de reemplazo de
# Egresados traía 21 números con uno repetido. Con 5 valores o menos no se
# puede distinguir de una categoría que no se repite, y se deja.
.mcu_variables <- function(filas, columna_llave = "") {
  tecnicas <- grepl("^\\.|^dim_|^cv_", names(filas)) | names(filas) %in% c(columna_llave, "Token", "token")
  out <- list()
  for (col in names(filas)[!tecnicas]) {
    valores <- trimws(as.character(filas[[col]]))
    valores <- valores[!is.na(valores) & nzchar(valores)]
    if (!length(valores)) next
    n <- length(unique(valores))
    if (length(valores) > 5L && n >= 0.9 * length(valores)) next
    if (n >= 2L && n <= .MCU_MAX_CATEGORIAS) out[[length(out) + 1L]] <- list(variable = col, categorias = n)
  }
  out
}

# Llaves de las personas que cuentan como efectiva en el cruce de Monitoreo.
.mcu_efectivas <- function(case_rollup) {
  filas <- Filter(is.list, case_rollup %||% list())
  if (!length(filas)) return(character(0))
  cuenta <- vapply(filas, function(r) isTRUE(.monitoreo_bool(r$counts_in_advance, FALSE)), logical(1))
  llaves <- vapply(filas[cuenta], function(r) .mcm_chr(r$case_key), character(1))
  unique(llaves[grepl("^codigo:", llaves)])
}

# Meta de cada público declarada en `config$goals` (filtro por actor).
.mcu_metas_publico <- function(goals) {
  out <- list()
  for (g in goals %||% list()) {
    filtros <- g$filters %||% list()
    actor <- .mcm_chr(filtros$actor %||% filtros$dim_actor)
    meta <- suppressWarnings(as.integer(g$meta %||% NA)[1])
    if (nzchar(actor) && !is.na(meta)) out[[actor]] <- meta
  }
  out
}

.mcu_tabla_categorias <- function(filas, variable, efectivas) {
  categoria <- .mcu_texto(filas[[variable]])
  es_efectiva <- nzchar(filas$.mcu_llave) & filas$.mcu_llave %in% efectivas
  universo <- table(categoria)
  ef <- tapply(es_efectiva, categoria, sum)
  data.frame(categoria = names(universo), universo = as.integer(universo),
             efectivas = as.integer(ef[names(universo)]), stringsAsFactors = FALSE)
}

.mcu_ordenar <- function(t) {
  t <- t[order(t$categoria == .MCU_SIN_DATO, -t$universo, t$categoria), , drop = FALSE]
  rownames(t) <- NULL
  t
}

#' Propuesta de metas por categoría: personas × cobertura, hacia arriba.
#' @keywords internal
monitoreo_cuotas_proponer <- function(universo, actor, variable, cobertura = NA_real_, meta_publico = NA_integer_) {
  filas <- universo$filas
  if (!nrow(filas) || !variable %in% names(filas)) {
    stop_api(400, "E_MONITOREO_CUOTA_VARIABLE", "Esa variable no está en la base del público.")
  }
  filas <- filas[filas$.mcu_actor == actor, , drop = FALSE]
  if (!nrow(filas)) stop_api(400, "E_MONITOREO_CUOTA_VARIABLE", "Ese público no tiene base en Monitoreo.")
  cobertura <- suppressWarnings(as.numeric(cobertura)[1])
  if (is.na(cobertura)) {
    cobertura <- if (!is.na(meta_publico) && meta_publico > 0) meta_publico / nrow(filas) else NA_real_
  }
  t <- .mcu_ordenar(.mcu_tabla_categorias(filas, variable, character(0)))
  # Sin dato no lleva meta: no es una categoría que se pueda buscar en campo.
  meta <- if (is.na(cobertura)) rep(0L, nrow(t)) else as.integer(ceiling(t$universo * cobertura - 1e-9))
  meta[t$categoria == .MCU_SIN_DATO] <- 0L
  list(
    ok = TRUE, actor = actor, variable = variable, cobertura = cobertura,
    categorias = lapply(seq_len(nrow(t)), function(i) list(categoria = t$categoria[[i]], universo = t$universo[[i]], meta = meta[[i]]))
  )
}

.mcu_estado <- function(efectivas, meta) {
  ifelse(meta <= 0L, "sin_meta",
         ifelse(efectivas >= meta, "cumplida", ifelse(efectivas > 0L, "en_curso", "sin_avance")))
}

#' Modelo de la pestaña Cuotas. Puro.
#' @keywords internal
monitoreo_cuotas_modelo <- function(universo, case_rollup = list(), cuotas = list(), metas_publico = list()) {
  filas <- universo$filas
  efectivas <- .mcu_efectivas(case_rollup)
  avisos <- character(0)
  if (!nrow(filas)) avisos <- c(avisos, "Monitoreo todavía no tiene el universo cargado: sincroniza las fuentes.")
  if (nrow(filas) && !nzchar(universo$columna_llave)) {
    avisos <- c(avisos, "La base no tiene una columna de llave declarada (Reglas de cruce): no se pueden contar efectivas por categoría.")
  }
  actores <- if (nrow(filas)) unique(filas$.mcu_actor) else character(0)
  publicos <- lapply(actores, function(a) {
    fa <- filas[filas$.mcu_actor == a, , drop = FALSE]
    list(
      actor = a, universo = nrow(fa),
      efectivas = sum(nzchar(fa$.mcu_llave) & fa$.mcu_llave %in% efectivas),
      meta = metas_publico[[a]] %||% NA_integer_,
      variables = .mcu_variables(fa, universo$columna_llave)
    )
  })
  cuotas_out <- list()
  for (q in cuotas %||% list()) {
    actor <- .mcm_chr(q$actor)
    variable <- .mcm_chr(q$variable)
    fa <- if (nrow(filas)) filas[filas$.mcu_actor == actor, , drop = FALSE] else filas
    if (!nrow(fa) || !variable %in% names(fa)) {
      avisos <- c(avisos, sprintf("La cuota «%s · %s» no encuentra esa variable en la base del público.", actor, variable))
      next
    }
    t <- .mcu_ordenar(.mcu_tabla_categorias(fa, variable, efectivas))
    metas <- q$metas %||% list()
    meta <- vapply(t$categoria, function(cat) {
      m <- suppressWarnings(as.integer(metas[[cat]] %||% 0L)[1])
      if (is.na(m) || m < 0L) 0L else m
    }, integer(1), USE.NAMES = FALSE)
    falta <- pmax(meta - t$efectivas, 0L)
    estado <- .mcu_estado(t$efectivas, meta)
    total_meta <- sum(meta)
    cuotas_out[[length(cuotas_out) + 1L]] <- list(
      id = .mcm_chr(q$id), actor = actor, variable = variable,
      cobertura = suppressWarnings(as.numeric(q$cobertura %||% NA)[1]),
      universo = nrow(fa), meta = total_meta,
      efectivas = sum(t$efectivas),
      avance = if (total_meta > 0L) sum(t$efectivas[meta > 0L]) / total_meta else NA_real_,
      categorias_cumplidas = sum(estado == "cumplida"),
      categorias_total = sum(meta > 0L),
      sin_dato = sum(t$universo[t$categoria == .MCU_SIN_DATO]),
      categorias = lapply(seq_len(nrow(t)), function(i) list(
        categoria = t$categoria[[i]], universo = t$universo[[i]], meta = meta[[i]],
        efectivas = t$efectivas[[i]], falta = falta[[i]],
        avance = if (meta[[i]] > 0L) t$efectivas[[i]] / meta[[i]] else NA_real_,
        tasa = if (t$universo[[i]] > 0L) t$efectivas[[i]] / t$universo[[i]] else NA_real_,
        estado = estado[[i]]
      ))
    )
  }
  list(publicos = publicos, cuotas = cuotas_out, avisos = as.list(avisos))
}
