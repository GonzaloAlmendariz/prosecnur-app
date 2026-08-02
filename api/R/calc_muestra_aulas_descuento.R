# ---------------------------------------------------------------------------
# Descuento secuencial de estudiantes repetidos entre aulas del mismo estrato
# ---------------------------------------------------------------------------
# Pedido del asesor muestral (reunión 2026-07-15, §10): al seleccionar aulas
# del mismo estrato, cada aula elegida "consume" sus estudiantes; las
# candidatas restantes recalculan sus elegibles NETOS antes del siguiente
# sorteo, para que un aula grande cuyos alumnos ya cayeron cubiertos deje de
# pesar como grande.
#
# Flag de config: selector$sequential_discount (default TRUE en el engine).
# Con FALSE explícito ninguna rama de este archivo toca el RNG ni agrega
# columnas, lo que permite reproducir goldens históricos. calc_muestra_aulas.R
# solo llama a estas funciones.

# Engines donde el descuento se aplica DENTRO del sorteo (aula por aula).
.cm_descuento_engines_secuenciales <- function() {
  c("sistematico_pps", "estratificado_aleatorio", "pool_controlado")
}

# Modo de descuento por engine. cube/local_pivotal NO se fuerzan a
# secuencialidad: samplecube/lcube calibran sobre el set completo y sortear
# aula por aula rompería el balance del diseño; con el flag ON solo se
# auditan los netos post-selección ("post_hoc"). manual_auditable expone el
# neto como columna informativa para que el humano decida (también post_hoc).
.cm_descuento_mode_for_engine <- function(engine, enabled = TRUE) {
  if (!isTRUE(enabled)) return("off")
  key <- .cm_aulas_engine_key(engine)
  if (key %in% .cm_descuento_engines_secuenciales()) return("sequential")
  "post_hoc"
}

# ¿El marco trae unique_student_ids parseables? Sin ids no hay traslape que
# descontar (marcos anonimizados / guard de cobertura).
.cm_descuento_frame_tiene_ids <- function(aula_frame) {
  if (!is.data.frame(aula_frame) || !nrow(aula_frame)) return(FALSE)
  if (!"unique_student_ids" %in% names(aula_frame)) return(FALSE)
  any(vapply(
    aula_frame$unique_student_ids,
    function(x) length(.cm_aulas_student_ids(x)) > 0L,
    logical(1)
  ))
}

# Estado del descuento para una corrida de selección. Fallback honesto: flag
# ON sin ids parseables degrada a OFF con warning estructurado (código
# descuento_sin_ids como prefijo greppeable), nunca error.
.cm_descuento_estado <- function(aula_frame, selector, engine) {
  requested <- .cm_aulas_bool(selector$sequential_discount, TRUE)
  if (!requested) {
    return(list(
      requested = FALSE, applied = FALSE, sequential = FALSE,
      mode = "off", warning_code = "", warnings = character(0)
    ))
  }
  if (!.cm_descuento_frame_tiene_ids(aula_frame)) {
    return(list(
      requested = TRUE, applied = FALSE, sequential = FALSE,
      mode = "off", warning_code = "descuento_sin_ids",
      warnings = paste(
        "descuento_sin_ids: el marco no trae unique_student_ids parseables;",
        "el descuento secuencial de repetidos se desactivo y la seleccion",
        "corrio sin descuento."
      )
    ))
  }
  # El pool_controlado sortea sus candidatas con un engine base (cube por
  # default); .descuento_forzar_secuencial la marca para que cada sorteo
  # candidato descuente igual (contrato: descuento dentro de cada candidato).
  mode <- if (isTRUE(selector$.descuento_forzar_secuencial)) {
    "sequential"
  } else {
    .cm_descuento_mode_for_engine(engine, TRUE)
  }
  list(
    requested = TRUE, applied = TRUE,
    sequential = identical(mode, "sequential"),
    mode = mode, warning_code = "", warnings = character(0)
  )
}

# Marca el selector del pool para que sus sorteos candidatos desciendan al
# path secuencial (una línea de integración en .cm_aulas_select_once_pool).
.cm_descuento_marcar_pool <- function(selector) {
  if (.cm_aulas_bool(selector$sequential_discount, TRUE)) {
    selector$.descuento_forzar_secuencial <- TRUE
  }
  selector
}

# Sorteo secuencial con descuento dentro de UN estrato. Mismo contrato de
# salida que .cm_aulas_pick_indices() (indices/pik/engine_used/warning) más
# $audit alineado a $indices. Los indices quedan en ORDEN de selección (no
# ordenados): discount_step cuenta la historia del sorteo y eligible_n_neto
# es "al momento de su selección".
.cm_descuento_pick_indices <- function(cand, quota, selector, engine, seed = NULL) {
  n <- nrow(cand)
  quota <- min(n, max(0L, as.integer(quota)))
  if (quota <= 0L || !n) {
    return(list(
      indices = integer(0), pik = numeric(n),
      engine_used = engine, warning = character(0), audit = NULL
    ))
  }
  engine_key <- .cm_aulas_engine_key(engine)
  ids_list <- lapply(cand$unique_student_ids, function(x) unique(.cm_aulas_student_ids(x)))
  # Bruto desde los ids (== eligible_n en marcos sanos): garantiza la
  # identidad auditable bruto - ya_cubiertos = neto aunque eligible_n
  # viniera desfasado del listado de estudiantes.
  bruto <- lengths(ids_list)
  covered <- character(0)
  remaining <- seq_len(n)
  pik_out <- rep(NA_real_, n)
  sel <- integer(0)
  audit_rows <- vector("list", quota)
  step <- 0L
  while (length(sel) < quota && length(remaining)) {
    step <- step + 1L
    neto <- vapply(remaining, function(i) length(setdiff(ids_list[[i]], covered)), integer(1))
    if (engine_key == "estratificado_aleatorio") {
      # SRS con descuento: las aulas ya cubiertas por completo salen del
      # bombo (si TODAS quedaron cubiertas, se sortea entre las restantes
      # para no dejar la cuota sin llenar).
      pool <- if (any(neto > 0L)) which(neto > 0L) else seq_along(remaining)
      if (!is.null(seed)) set.seed(seed + step * 101L)
      pick_local <- pool[[sample.int(length(pool), 1L)]]
      prob_step <- 1 / length(pool)
    } else {
      # PPS sucesivo: la MOS oficial (winsorización incluida) se recalcula
      # con los elegibles NETOS del paso; un aula grande ya cubierta pesa
      # como chica en el siguiente sorteo.
      df_step <- cand[remaining, , drop = FALSE]
      df_step$eligible_n <- as.numeric(neto)
      mos <- .cm_aulas_measure_of_size(df_step, selector)
      pik_step <- .cm_aulas_inclusion_probabilities(mos, 1L)
      if (!is.null(seed)) set.seed(seed + step * 101L)
      pick_local <- sample.int(length(remaining), 1L, prob = pmax(pik_step, 1e-9))
      prob_step <- as.numeric(pik_step[[pick_local]])
    }
    i <- remaining[[pick_local]]
    neto_i <- as.integer(neto[[pick_local]])
    audit_rows[[step]] <- data.frame(
      eligible_n_bruto = as.integer(bruto[[i]]),
      eligible_n_neto = neto_i,
      aporte_neto = neto_i,
      ya_cubiertos = as.integer(bruto[[i]]) - neto_i,
      discount_step = step,
      stringsAsFactors = FALSE
    )
    pik_out[[i]] <- prob_step
    sel <- c(sel, i)
    covered <- unique(c(covered, ids_list[[i]]))
    remaining <- remaining[remaining != i]
  }
  list(
    indices = sel,
    pik = pik_out,
    engine_used = paste0(engine_key, "+descuento_secuencial"),
    warning = character(0),
    audit = do.call(rbind, audit_rows[seq_along(sel)])
  )
}

# Adjunta las columnas de auditoría del sorteo secuencial a las filas
# seleccionadas (no-op con el pick legacy, que no trae $audit).
.cm_descuento_bind_audit <- function(row, audit) {
  if (is.null(audit) || !is.data.frame(audit) || nrow(audit) != nrow(row)) return(row)
  for (nm in names(audit)) row[[nm]] <- audit[[nm]]
  row
}

# Auditoría de netos POST selección para engines de diseño balanceado
# (cube/local pivotal) y manual: el set ya está sorteado y NO se altera;
# el acumulado de cobertura corre POR ESTRATO en el orden de las filas.
.cm_descuento_annotate_post_hoc <- function(df) {
  if (!is.data.frame(df) || !nrow(df) || !"unique_student_ids" %in% names(df)) return(df)
  n <- nrow(df)
  stratum <- if ("stratum" %in% names(df)) as.character(df$stratum) else rep("global", n)
  stratum[is.na(stratum) | !nzchar(stratum)] <- "global"
  bruto <- integer(n)
  neto <- integer(n)
  cubiertos <- integer(n)
  paso <- integer(n)
  covered_by <- list()
  step_by <- list()
  for (i in seq_len(n)) {
    st <- stratum[[i]]
    ids <- unique(.cm_aulas_student_ids(df$unique_student_ids[[i]]))
    prev <- covered_by[[st]] %||% character(0)
    bruto[[i]] <- length(ids)
    neto[[i]] <- length(setdiff(ids, prev))
    cubiertos[[i]] <- bruto[[i]] - neto[[i]]
    step_by[[st]] <- (step_by[[st]] %||% 0L) + 1L
    paso[[i]] <- step_by[[st]]
    covered_by[[st]] <- unique(c(prev, ids))
  }
  df$eligible_n_bruto <- bruto
  df$eligible_n_neto <- neto
  df$aporte_neto <- neto
  df$ya_cubiertos <- cubiertos
  df$discount_step <- paso
  df
}

# Cierre de una corrida de select_once: aplica la auditoría post_hoc cuando
# el engine no sortea secuencialmente. Con OFF devuelve el df intacto.
.cm_descuento_finalize_once <- function(out, estado) {
  if (!isTRUE(estado$applied)) return(out)
  if (identical(estado$mode, "post_hoc")) return(.cm_descuento_annotate_post_hoc(out))
  out
}

# Nombres de las columnas de auditoría (para public_cols en el resultado).
.cm_descuento_audit_cols <- function() {
  c("eligible_n_bruto", "eligible_n_neto", "aporte_neto", "ya_cubiertos", "discount_step")
}

# Bloque público del resultado de selección (contrato con el frontend).
# Presente SIEMPRE en calc_muestra_aulas_seleccionar(): con OFF sale
# { requested: false, applied: false, mode: "off", ... } sin columnas.
# por_estrato resume bruto vs neto SOLO de los titulares M1 (el sorteo que
# el descuento gobierna; reservas y extra no participan).
.cm_descuento_resultado <- function(selection_df, aula_frame, selector, engine) {
  estado <- .cm_descuento_estado(aula_frame, selector, engine)
  por_estrato <- data.frame(stringsAsFactors = FALSE)
  cols <- c("stratum", "eligible_n_bruto", "eligible_n_neto", "ya_cubiertos")
  if (isTRUE(estado$applied) && is.data.frame(selection_df) && nrow(selection_df) &&
      all(cols %in% names(selection_df))) {
    m1 <- selection_df
    if ("wave" %in% names(m1)) m1 <- m1[as.character(m1$wave) == "M1", , drop = FALSE]
    m1 <- m1[is.finite(suppressWarnings(as.numeric(m1$eligible_n_bruto))), , drop = FALSE]
    if (nrow(m1)) {
      strata <- unique(as.character(m1$stratum))
      por_estrato <- do.call(rbind, lapply(strata, function(st) {
        sub <- m1[as.character(m1$stratum) == st, , drop = FALSE]
        data.frame(
          stratum = st,
          aulas_seleccionadas = nrow(sub),
          eligible_bruto_total = sum(as.integer(sub$eligible_n_bruto), na.rm = TRUE),
          eligible_neto_total = sum(as.integer(sub$eligible_n_neto), na.rm = TRUE),
          ya_cubiertos_total = sum(as.integer(sub$ya_cubiertos), na.rm = TRUE),
          stringsAsFactors = FALSE
        )
      }))
      rownames(por_estrato) <- NULL
    }
  }
  list(
    schema = "calc_muestra_aulas_descuento_v1",
    requested = estado$requested,
    applied = estado$applied,
    mode = estado$mode,
    warning_code = estado$warning_code,
    warnings = as.list(estado$warnings),
    por_estrato = .cm_aulas_records(por_estrato)
  )
}
