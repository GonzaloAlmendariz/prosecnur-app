# =============================================================================
# Avance contra la cuota del diseño (monitoreo de aulas universitarias)
# =============================================================================
#
# Dictamen metodológico 2026-08-18. Los agregados de avance del tablero medían
# contra sumas de `expected_valid` por aula, y esa suma está ESTRUCTURALMENTE
# por encima de la cuota que el diseño trazó: que la suma de metas por aula
# supere la cuota es DISEÑO, no error —el margen absorbe merma y traslape—.
# Los dos denominadores son legítimos: el del plan dirige el operativo aula a
# aula, el del diseño dice si el estudio ya tiene a su gente. Lo que no pueden
# es publicarse bajo el mismo rótulo (C5): este bloque declara su `fuente` y la
# UI rotula con ella.
#
# Supuestos que el bloque asume y NO comprueba:
# - La facultad de una respuesta se atribuye por el AULA del plan en la que se
#   recogió (QR/collector), no por auto-reporte: la post-estratificación por lo
#   declarado vive en Procesamiento, no aquí.
# - El doble conteo por traslape (~1,55 aulas por alumno en el marco) se asume
#   despreciable: las respuestas son anónimas y no se pueden deduplicar entre
#   aulas distintas.
# - Una válida de campo NO es una efectiva final: la merma campo → base
#   depurada no se descuenta; este avance mide recolección, no base entregable.
#
# Es cálculo puro sobre estado ya validado: degrada declarando (`vigencia`,
# `motivo`), nunca lanza. Por eso aquí no hay `stop_api()` ni `stop()`.

# --- lectura defensiva de columnas -------------------------------------------

.maac_chr_col <- function(df, col) {
  n <- if (is.data.frame(df)) nrow(df) else 0L
  if (!n) return(character(0))
  v <- if (col %in% names(df)) as.character(df[[col]]) else character(n)
  v[is.na(v)] <- ""
  trimws(v)
}

.maac_num_col <- function(df, col) {
  n <- if (is.data.frame(df)) nrow(df) else 0L
  if (!n) return(numeric(0))
  if (!col %in% names(df)) return(rep(NA_real_, n))
  suppressWarnings(as.numeric(df[[col]]))
}

# Lookup escalar en tablas con nombres (table/tapply): un nombre ausente da NA
# y el default, nunca "subscript out of bounds".
.maac_toma_int <- function(tabla, k, default = 0L) {
  v <- suppressWarnings(as.integer(tabla[k]))
  if (length(v) != 1L || is.na(v)) default else v
}

.maac_toma_num <- function(tabla, k, default = 0) {
  v <- suppressWarnings(as.numeric(tabla[k]))
  if (length(v) != 1L || !is.finite(v)) default else v
}

.maac_toma_chr <- function(tabla, k, default = "") {
  v <- suppressWarnings(as.character(tabla[k]))
  if (length(v) != 1L || is.na(v) || !nzchar(v)) default else v
}

# Clave de facultad para AGRUPAR: la vacía colapsa a un centinela porque `""`
# no es indexable por nombre en tablas de R y las respuestas de un aula sin
# facultad desaparecerían del bloque en silencio.
.maac_fac_key <- function(x) {
  k <- .cm_criterios_fac_key(x)
  k[!nzchar(k)] <- "sin_facultad"
  k
}

# --- sexo: clave canónica y etiqueta de display ------------------------------

# Mapa valor -> clave {"F","M",""}. Los booleanos `.mabe_es_mujer()` /
# `.mabe_es_hombre()` (banco de extras) responden otra pregunta —¿esta etiqueta
# es mujer?— con listas cerradas; aquí hace falta el mapa hacia la clave del
# diseño para casar su "F"/"M" con el vocabulario libre de respuestas y marco
# ("Femenino", "MASCULINO", "Mujer"). Prefijos y no listas: cada estudio
# escribe el suyo, y una lista cerrada se traga lo que no reconoce.
.maac_sexo_key <- function(x) {
  keys <- .cm_aulas_text_key(x)
  vapply(keys, function(k) {
    if (!nzchar(k)) return("")
    if (k == "f" || startsWith(k, "fem") || startsWith(k, "mujer")) return("F")
    if (k == "m" || startsWith(k, "masc") || startsWith(k, "hombre") ||
        startsWith(k, "varon") || startsWith(k, "male")) return("M")
    ""
  }, character(1), USE.NAMES = FALSE)
}

# La etiqueta con la que se MUESTRA una clave del diseño: como la escriba el
# PLAN (sex_top_*) primero, las respuestas rellenan, y "F"/"M" pelado como
# último recurso. El plan manda porque las filas degradadas al fallback
# conservan su vocabulario del plan: si las del diseño prefirieran el de las
# respuestas, el mismo sexo se partiría en dos grupos en la misma tabla.
.maac_sexo_etiqueta <- function(key, observados_raw, observados_key, plan_df) {
  for (col in c("sex_top_1", "sex_top_2")) {
    v <- .maac_chr_col(plan_df, col)
    v <- v[.maac_sexo_key(v) == key & nzchar(v)]
    if (length(v)) return(v[[1]])
  }
  candidatos <- observados_raw[observados_key == key & nzchar(observados_raw)]
  if (length(candidatos)) {
    tb <- sort(table(candidatos), decreasing = TRUE)
    return(names(tb)[[1]])
  }
  key
}

# --- vigencia del bloque de metas --------------------------------------------

# Tabla de decisión del dictamen: `selection_run_id` y `frame_hash` se comparan
# POR SEPARADO contra los sellos del bloque. Un par con ambos lados y valores
# distintos es prueba de diseño viejo (obsoleta -> denominador del plan); un
# par incompleto no prueba nada (no_verificable -> cuotas del diseño, dicho).
.monitoreo_aulas_avance_vigencia <- function(cfg) {
  dt <- if (is.list(cfg)) cfg$design_targets %||% list() else list()
  if (!is.list(dt)) dt <- list()
  facultades <- Filter(is.list, dt$facultades %||% list())
  if (!length(facultades)) {
    # Los avisos dicen la causa, no solo el hecho: toda degradación lleva su
    # porqué en `motivo`. Solo `vigente` viaja con "".
    return(list(
      fuente = "plan_expected", vigencia = "sin_diseno",
      motivo = paste0("El estudio importado no publica metas del diseño; ",
                      "el avance se mide contra la meta del plan."),
      dt = list(), facultades = list()
    ))
  }
  run_dt <- .monitoreo_scalar(dt$selection_run_id, "")
  run_cfg <- .monitoreo_scalar(cfg$selection_run_id, "")
  hash_dt <- .monitoreo_scalar(dt$frame_hash, "")
  hash_cfg <- .monitoreo_scalar(cfg$frame_hash, "")
  sello <- function(a, b) {
    if (nzchar(a) && nzchar(b)) (if (identical(a, b)) "igual" else "distinto") else "sin_sello"
  }
  estados <- c(sello(run_dt, run_cfg), sello(hash_dt, hash_cfg))
  if (any(estados == "distinto")) {
    return(list(
      fuente = "plan_expected", vigencia = "obsoleta",
      motivo = sprintf(
        paste0("Las metas del diseño llevan el sello selection_run_id '%s' / ",
               "frame_hash '%s' y el plan vigente lleva '%s' / '%s': el avance ",
               "se mide contra la meta del plan."),
        run_dt, hash_dt, run_cfg, hash_cfg
      ),
      dt = dt, facultades = facultades
    ))
  }
  if (all(estados == "igual")) {
    return(list(fuente = "design_targets", vigencia = "vigente", motivo = "",
                dt = dt, facultades = facultades))
  }
  list(
    fuente = "design_targets", vigencia = "no_verificable",
    motivo = sprintf(
      paste0("El sello de las metas no se puede verificar (selection_run_id '%s' / ",
             "frame_hash '%s' contra '%s' / '%s'): se usan las cuotas del diseño ",
             "sin poder confirmar su vigencia."),
      run_dt, hash_dt, run_cfg, hash_cfg
    ),
    dt = dt, facultades = facultades
  )
}

# --- atribución unificada respuesta -> fila del plan --------------------------

# La MISMA regla para el numerador de cumplimiento y para las celdas de sexo:
# la clave es el id que viajó en el QR, el aula (`classroom_id`) manda sobre la
# unidad (`collection_unit_id`) —igual que `.monitoreo_aulas_contar_por_fila()`—
# y cada identificador pertenece a UNA sola fila: la primera que lo declara.
# Sin esa unicidad, dos filas del plan que compartan id contarían la misma
# respuesta dos veces.
.maac_atribucion <- function(plan_df, valid_response, response_classroom) {
  n <- length(response_classroom)
  valid <- if (length(valid_response) == n) valid_response %in% TRUE else rep(TRUE, n)
  fila <- rep(NA_integer_, n)
  if (is.data.frame(plan_df) && nrow(plan_df) && n) {
    aulas <- .maac_chr_col(plan_df, "classroom_id")
    unidades <- .maac_chr_col(plan_df, "collection_unit_id")
    idx_aula <- which(nzchar(aulas) & !duplicated(aulas))
    mapa <- stats::setNames(idx_aula, aulas[idx_aula])
    idx_unidad <- which(nzchar(unidades) & !duplicated(unidades) & !(unidades %in% names(mapa)))
    mapa <- c(mapa, stats::setNames(idx_unidad, unidades[idx_unidad]))
    con_id <- nzchar(response_classroom)
    if (any(con_id) && length(mapa)) {
      fila[con_id] <- unname(mapa[response_classroom[con_id]])
    }
  }
  matched <- !is.na(fila)
  # Motivos que sacan la fila del UNIVERSO: el aula no existía o era virtual.
  # Sus válidas no cuentan al cumplimiento, pero JAMÁS se descartan en
  # silencio: viajan en `fuera_universo`.
  motivo <- tolower(.maac_chr_col(plan_df, "replacement_reason"))
  fuera_fila <- motivo %in% c("aula_no_existe", "virtual_no_presencial")
  fac_fila <- .maac_chr_col(plan_df, "faculty")
  fuera <- rep(FALSE, n)
  facultad <- rep("", n)
  if (any(matched)) {
    fuera[matched] <- fuera_fila[fila[matched]]
    facultad[matched] <- fac_fila[fila[matched]]
  }
  data.frame(
    valid = valid, fila = fila, matched = matched,
    fuera = fuera, facultad = facultad,
    stringsAsFactors = FALSE
  )
}

# --- el bloque `avance_cuota` -------------------------------------------------

# SIEMPRE presente en el payload (marco estable): sin plan y sin diseño publica
# ceros declarados, no desaparece. `plan_df` es el plan ENTERO —titulares
# caídos, reservas y banco incluidos: toda respuesta recogida cuenta a su
# facultad—; `tracked_df` (en juego sobre seguidas) solo aporta el denominador
# cuando el bloque degrada a la meta del plan.
.monitoreo_aulas_avance_cuota <- function(plan_df, tracked_df, responses, cfg,
                                          valid_response = logical(0),
                                          response_classroom = character(0)) {
  vig <- .monitoreo_aulas_avance_vigencia(cfg)
  atr <- .maac_atribucion(plan_df, valid_response, response_classroom)
  total_validas <- as.integer(sum(atr$valid))

  sex_col <- .monitoreo_aulas_col(responses, c("sex", "sexo", "genero", "género", "gender"))
  sexo_key <- if (nzchar(sex_col)) .maac_sexo_key(.monitoreo_aulas_values(responses, sex_col, "")) else character(0)
  if (length(sexo_key) != nrow(atr)) sexo_key <- rep("", nrow(atr))

  fk_resp <- .maac_fac_key(atr$facultad)
  atribuida <- atr$valid & atr$matched
  cuenta <- atribuida & !atr$fuera
  contar <- function(mask) {
    if (!any(mask)) return(integer(0))
    tabla <- table(fk_resp[mask])
    stats::setNames(as.integer(tabla), names(tabla))
  }
  num_k <- contar(cuenta)
  fuera_k <- contar(atribuida & atr$fuera)
  sin_sexo_k <- contar(cuenta & sexo_key == "")
  huerfanas <- as.integer(total_validas - sum(atribuida))

  fac_plan <- .maac_chr_col(plan_df, "faculty")
  fk_plan <- .maac_fac_key(fac_plan)
  primeras <- !duplicated(fk_plan)
  labels_plan <- stats::setNames(fac_plan[primeras], fk_plan[primeras])
  claves_plan <- fk_plan[primeras]

  fk_tracked <- .maac_fac_key(.maac_chr_col(tracked_df, "faculty"))
  ev <- .maac_num_col(tracked_df, "expected_valid")
  ev[!is.finite(ev) | ev < 0] <- 0
  denom_plan <- if (length(fk_tracked)) tapply(ev, fk_tracked, sum) else numeric(0)

  etiqueta_plan <- function(k) {
    lbl <- .maac_toma_chr(labels_plan, k)
    if (nzchar(lbl)) lbl else if (identical(k, "sin_facultad")) "Sin facultad" else k
  }

  filas <- list()
  if (identical(vig$fuente, "design_targets")) {
    vistas <- character(0)
    for (f in vig$facultades) {
      k <- .monitoreo_scalar(f$faculty_key, "")
      if (!nzchar(k)) k <- .cm_criterios_fac_key(.monitoreo_scalar(f$facultad, ""))
      if (!nzchar(k) || k %in% vistas) next
      vistas <- c(vistas, k)
      cuota <- .monitoreo_num(f$cuota, NA_real_)
      con_cuota <- is.finite(cuota)
      filas[[length(filas) + 1L]] <- list(
        facultad = {
          lbl <- .maac_toma_chr(labels_plan, k)
          if (nzchar(lbl)) lbl else .monitoreo_scalar(f$facultad, k)
        },
        faculty_key = k,
        cuota = if (con_cuota) cuota else NA_real_,
        respuestas_validas = .maac_toma_int(num_k, k),
        # Una facultad del diseño sin cuota legible no gana denominador
        # inventado: se declara `sin_cuota` igual que una fuera del diseño.
        fuente_fila = if (con_cuota) "diseno" else "sin_cuota",
        estado = if (!con_cuota) "sin_cuota"
                 else if (k %in% claves_plan) "ok"
                 else "sin_aulas_en_plan",
        fuera_universo = .maac_toma_int(fuera_k, k),
        respuestas_sin_sexo = .maac_toma_int(sin_sexo_k, k)
      )
    }
    # Facultades del plan que el diseño no trazó: sus respuestas se publican
    # pero NO entran al % global — inventarles denominador sería peor.
    for (k in claves_plan) {
      if (k %in% vistas) next
      filas[[length(filas) + 1L]] <- list(
        facultad = etiqueta_plan(k), faculty_key = k, cuota = NA_real_,
        respuestas_validas = .maac_toma_int(num_k, k),
        fuente_fila = "sin_cuota", estado = "sin_cuota",
        fuera_universo = .maac_toma_int(fuera_k, k),
        respuestas_sin_sexo = .maac_toma_int(sin_sexo_k, k)
      )
    }
    cuota_total <- .monitoreo_num(vig$dt$total_cuota, NA_real_)
    num_total <- sum(vapply(filas, function(x) {
      if (is.finite(x$cuota %||% NA_real_)) as.numeric(x$respuestas_validas) else 0
    }, numeric(1)))
  } else {
    for (k in claves_plan) {
      filas[[length(filas) + 1L]] <- list(
        facultad = etiqueta_plan(k), faculty_key = k,
        cuota = .maac_toma_num(denom_plan, k, 0),
        respuestas_validas = .maac_toma_int(num_k, k),
        fuente_fila = "plan", estado = "ok",
        fuera_universo = .maac_toma_int(fuera_k, k),
        respuestas_sin_sexo = .maac_toma_int(sin_sexo_k, k)
      )
    }
    cuota_total <- sum(vapply(filas, function(x) x$cuota, numeric(1)))
    num_total <- sum(vapply(filas, function(x) as.numeric(x$respuestas_validas), numeric(1)))
  }

  filas <- lapply(filas, function(x) {
    cuota <- x$cuota
    if (is.finite(cuota)) {
      x$brecha <- max(0, cuota - x$respuestas_validas)
      # `> 0` y no `>= 0`: una cuota en cero no es una meta cumplida, es una
      # meta sin denominador — NA y no Inf. El avance por encima de 100 se
      # publica SIN cap: pasarse de la cuota es un hecho, no un error.
      x$avance_pct <- if (cuota > 0) round(100 * x$respuestas_validas / cuota, 1) else NA_real_
    } else {
      x$brecha <- NA_real_
      x$avance_pct <- NA_real_
    }
    x[c("facultad", "faculty_key", "cuota", "respuestas_validas", "brecha",
        "avance_pct", "fuente_fila", "estado", "fuera_universo",
        "respuestas_sin_sexo")]
  })
  if (!identical(vig$fuente, "design_targets") && length(filas) > 1L) {
    # Con denominador del plan, el orden es el de `avance_por_facultad`: la que
    # más lejos está de su meta primero. Con diseño, manda el orden del diseño.
    b <- vapply(filas, function(x) if (is.finite(x$brecha)) x$brecha else 0, numeric(1))
    nm <- vapply(filas, function(x) x$facultad, character(1))
    filas <- filas[order(-b, nm)]
  }

  total <- list(
    cuota = if (is.finite(cuota_total)) cuota_total else NA_real_,
    respuestas_validas = as.integer(num_total),
    brecha = if (is.finite(cuota_total)) max(0, cuota_total - num_total) else NA_real_,
    avance_pct = if (is.finite(cuota_total) && cuota_total > 0) {
      round(100 * num_total / cuota_total, 1)
    } else NA_real_,
    fuera_universo = as.integer(sum(atribuida & atr$fuera)),
    # Invariante: total_validas - sum(atribuidas). Las huérfanas nunca entran a
    # ninguna facultad; se declaran aquí, no se descartan.
    huerfanas = huerfanas
  )

  list(
    schema = "monitoreo_aulas_avance_cuota_v1",
    fuente = vig$fuente,
    vigencia = vig$vigencia,
    motivo = vig$motivo,
    tasa_esperada = if (length(vig$facultades)) .monitoreo_num(vig$dt$tasa_esperada, NA_real_) else NA_real_,
    tasa_fuente = if (length(vig$facultades)) .monitoreo_scalar(vig$dt$tasa_fuente, "") else "",
    total = total,
    facultades = filas
  )
}

# --- targets de sexo: manda el diseño -----------------------------------------

# Overlay sobre el fallback vigente (marco -> plan_sex_top): cuando el bloque
# de metas está vigente y trae `cuota_sexo`, los targets por facultad salen de
# ahí con `source = "design_cuota_sexo"`. Una facultad cuyo desglose no cuadra
# con su cuota (|F+M - cuota| > 1) está corrupta: degrada a su fila de fallback
# con `warning` declarado — no se publica como certificada.
.monitoreo_aulas_sexo_targets_con_diseno <- function(plan_df, cfg, fallback) {
  fb <- if (is.data.frame(fallback)) fallback else data.frame(stringsAsFactors = FALSE)
  if (nrow(fb) && !"warning" %in% names(fb)) fb$warning <- ""
  vig <- .monitoreo_aulas_avance_vigencia(cfg)
  if (!identical(vig$fuente, "design_targets")) return(fb)

  fac_plan <- .maac_chr_col(plan_df, "faculty")
  fk_plan <- .cm_criterios_fac_key(fac_plan)
  primeras <- !duplicated(fk_plan) & nzchar(fk_plan)
  labels_plan <- stats::setNames(fac_plan[primeras], fk_plan[primeras])

  design_rows <- list()
  cubiertas <- character(0)
  avisos <- list()
  vistas <- character(0)
  for (f in vig$facultades) {
    k <- .monitoreo_scalar(f$faculty_key, "")
    if (!nzchar(k)) k <- .cm_criterios_fac_key(.monitoreo_scalar(f$facultad, ""))
    if (!nzchar(k) || k %in% vistas) next
    vistas <- c(vistas, k)
    cuota <- .monitoreo_num(f$cuota, NA_real_)
    cs <- if (is.list(f$cuota_sexo)) f$cuota_sexo else list()
    celdas <- list()
    for (sx in c("F", "M")) {
      v <- .monitoreo_num(cs[[sx]], NA_real_)
      if (is.finite(v)) celdas[[sx]] <- round(v)
    }
    # Sin cuota_sexo (o sin cuota contra la que cuadrar) no hay que declarar:
    # el fallback de siempre cubre a esa facultad con su source de siempre.
    if (!length(celdas) || !is.finite(cuota)) next
    etiqueta <- {
      lbl <- .maac_toma_chr(labels_plan, k)
      if (nzchar(lbl)) lbl else .monitoreo_scalar(f$facultad, k)
    }
    suma <- sum(unlist(celdas))
    if (abs(suma - round(cuota)) > 1) {
      avisos[[k]] <- sprintf(
        paste0("La cuota por sexo del diseño de %s no cuadra con su cuota ",
               "(F+M = %d contra %d): esa facultad usa la proyección del marco/plan."),
        etiqueta, as.integer(suma), as.integer(round(cuota))
      )
      next
    }
    for (sx in names(celdas)) {
      design_rows[[length(design_rows) + 1L]] <- data.frame(
        faculty = etiqueta, sex = sx, target = as.integer(celdas[[sx]]),
        source = "design_cuota_sexo", warning = "",
        stringsAsFactors = FALSE
      )
    }
    cubiertas <- c(cubiertas, k)
  }
  if (!length(design_rows) && !length(avisos)) return(fb)
  if (nrow(fb)) {
    fb_keys <- .cm_criterios_fac_key(fb$faculty)
    conserva <- !(fb_keys %in% cubiertas)
    fb <- fb[conserva, , drop = FALSE]
    fb_keys <- fb_keys[conserva]
    if (nrow(fb) && length(avisos)) {
      fb$warning <- vapply(seq_len(nrow(fb)), function(i) {
        k <- fb_keys[[i]]
        if (nzchar(k)) (avisos[[k]] %||% fb$warning[[i]]) else fb$warning[[i]]
      }, character(1))
    }
  }
  des <- if (length(design_rows)) do.call(rbind, design_rows) else NULL
  .maac_rbind_union(des, fb)
}

# rbind con unión de columnas: el fallback del marco trae `frame_n` y las filas
# del diseño no; perder columnas al mezclar sería perder la procedencia.
.maac_rbind_union <- function(a, b) {
  partes <- Filter(function(x) is.data.frame(x) && nrow(x), list(a, b))
  if (!length(partes)) {
    return(if (is.data.frame(b)) b else data.frame(stringsAsFactors = FALSE))
  }
  cols <- unique(unlist(lapply(partes, names)))
  partes <- lapply(partes, function(df) {
    for (col in setdiff(cols, names(df))) {
      df[[col]] <- if (col %in% c("target", "frame_n")) NA_real_ else ""
    }
    df[, cols, drop = FALSE]
  })
  out <- do.call(rbind, partes)
  rownames(out) <- NULL
  out
}

# --- celdas sexo x facultad con atribución unificada --------------------------

# Reemplaza a `.monitoreo_aulas_quota_sex_faculty()` en el tablero. Tres
# diferencias del dictamen: (1) el merge target<->observado va por claves
# NORMALIZADAS (facultad y sexo), no por texto crudo — el "F"/"M" del diseño
# tiene que casar con el "Femenino"/"MASCULINO" de las respuestas—; (2) la
# facultad de una respuesta sale de la MISMA regla que el numerador de
# cumplimiento (el plan manda, la columna de la respuesta solo rellena sin
# match): sin eso F+M no cuadra con el total de la facultad; (3) una respuesta
# fuera de universo no cubre celdas — la cuota por sexo es parte de la misma
# cuota cuyo cumplimiento esa respuesta no puede sumar.
.monitoreo_aulas_cuotas_sexo_celdas <- function(plan_df, tracked_df, responses, cfg,
                                                valid_response, response_classroom) {
  targets <- .monitoreo_aulas_quota_targets(tracked_df, cfg)
  if (!is.data.frame(targets) || !nrow(targets)) return(list())
  targets$fac_key <- .cm_criterios_fac_key(targets$faculty)
  targets$sex_key <- .maac_sexo_key(targets$sex)
  if (!"warning" %in% names(targets)) targets$warning <- ""

  atr <- .maac_atribucion(plan_df, valid_response, response_classroom)
  # La facultad de cada respuesta la resuelve su DUEÑO único:
  # `.monitoreo_aulas_response_faculty_values()` — el plan manda y la columna
  # de la respuesta solo rellena sin match. Duplicar la regla inline aquí fue
  # exactamente el patrón que ya costó tres copias del emparejamiento en este
  # módulo; `atr` solo aporta lo que esa función no dice: validez, match y
  # fuera de universo.
  facultad <- .monitoreo_aulas_response_faculty_values(responses, plan_df, response_classroom)
  if (length(facultad) != nrow(atr)) facultad <- rep("", nrow(atr))
  sex_col <- .monitoreo_aulas_col(responses, c("sex", "sexo", "genero", "género", "gender"))
  sexo_raw <- if (nzchar(sex_col)) .monitoreo_aulas_values(responses, sex_col, "") else character(0)
  if (length(sexo_raw) != nrow(atr)) sexo_raw <- rep("", nrow(atr))
  sexo_key <- .maac_sexo_key(sexo_raw)

  keep <- atr$valid & nzchar(facultad) & sexo_key %in% c("F", "M") & !(atr$matched & atr$fuera)
  observed <- if (any(keep)) {
    stats::aggregate(
      rep(1L, sum(keep)),
      by = list(fac_key = .cm_criterios_fac_key(facultad[keep]), sex_key = sexo_key[keep]),
      FUN = sum
    )
  } else {
    data.frame(fac_key = character(0), sex_key = character(0), x = integer(0),
               stringsAsFactors = FALSE)
  }
  if (nrow(observed)) names(observed)[names(observed) == "x"] <- "observed"
  if (!"observed" %in% names(observed)) observed$observed <- integer(0)

  out <- merge(targets, observed, by = c("fac_key", "sex_key"), all.x = TRUE, sort = FALSE)
  out$observed[is.na(out$observed)] <- 0L
  out$observed <- as.integer(out$observed)
  target_num <- suppressWarnings(as.numeric(out$target))
  target_num[!is.finite(target_num)] <- 0
  out$target <- as.integer(pmax(0L, round(target_num)))
  out$missing <- as.integer(pmax(0L, out$target - out$observed))
  out$progress_pct <- ifelse(out$target > 0L, round(100 * out$observed / out$target, 1), NA_real_)
  out$status <- ifelse(out$target <= 0L, "sin_meta",
                       ifelse(out$observed >= out$target, "cumplida",
                              ifelse(out$observed > 0L, "en_riesgo", "pendiente")))
  del_diseno <- out$source %in% "design_cuota_sexo"
  if (any(del_diseno)) {
    out$sex[del_diseno] <- vapply(
      out$sex_key[del_diseno], .maac_sexo_etiqueta, character(1),
      observados_raw = sexo_raw[atr$valid], observados_key = sexo_key[atr$valid],
      plan_df = plan_df
    )
  }
  out <- out[order(out$status != "en_riesgo", out$status != "pendiente",
                   -out$missing, out$faculty, out$sex), , drop = FALSE]
  # Las claves del merge son cocina interna, no columnas del contrato: el
  # DataTable de la UI pinta las primeras columnas que llegan (sin
  # preferredColumns, con tope), asi que publicarlas al frente encabezaba la
  # tabla con claves y recortaba missing/progress/status. Se dropean, el
  # `warning` solo viaja cuando dice algo, y el orden queda el del payload de
  # siempre.
  out$fac_key <- NULL
  out$sex_key <- NULL
  if ("warning" %in% names(out)) {
    out$warning[is.na(out$warning)] <- ""
    if (!any(nzchar(out$warning))) out$warning <- NULL
  }
  primeras <- intersect(
    c("faculty", "sex", "target", "observed", "missing", "progress_pct", "status", "source"),
    names(out)
  )
  out <- out[, c(primeras, setdiff(names(out), primeras)), drop = FALSE]
  .monitoreo_aulas_records(out, max_rows = 240L)
}
