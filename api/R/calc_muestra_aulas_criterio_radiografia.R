# Radiografía estadística del criterio `session_type × facultad` sobre el marco
# EJECUTADO. Es un sibling aditivo de `frame$exploracion`: no reinterpreta el
# bloque legacy ni agrupa sus valores modales, sino las señales efectivas que
# produjo `.cm_criterios_valores_aula()` y conservó
# `criterios$seleccion_aula$valores`.
#
# Contrato público: `calc_muestra_aulas_criterios_radiografia_v1`. La unidad es
# un curso-horario único y `eligible_n` cuenta estudiantes únicos dentro del CH;
# al sumar CH representa matrículas/exposiciones elegibles, no personas únicas.
# Todo estadístico es estricto: si falta `eligible_n` en una unidad de su
# denominador, el valor agregado es NA. El serializer Plumber/jsonlite vigente
# lo transporta como `"NA"`; el normalizador React lo conserva como `null`.

.cm_criterio_radiografia_owner <- "calc_muestra_aulas_frame_v1.aula_frame"
.cm_criterio_radiografia_grano <- "session_type_x_facultad_efectiva"
.cm_criterio_radiografia_unidad <- "curso_horario_unico"
# Reservadas para AUSENCIA. Los guiones bajos exteriores no pueden salir de
# `.cm_aulas_text_key()`, así que un valor real "SIN DATO" conserva su clave
# `sin_dato` sin colisionar con el bucket sintético no accionable.
.cm_criterio_radiografia_missing_session_key <- "__missing_session_type__"
.cm_criterio_radiografia_missing_faculty_key <- "__missing_faculty__"

.cm_criterio_radiografia_resumen <- function(v, cuantiles = FALSE) {
  v <- suppressWarnings(as.numeric(v))
  n_dato <- as.integer(sum(is.finite(v)))
  completo <- length(v) > 0L && n_dato == length(v)
  media <- if (completo) as.numeric(mean(v)) else NA_real_
  if (!isTRUE(cuantiles)) {
    return(list(n_ch_con_dato = n_dato, media = media))
  }
  q <- if (completo) {
    as.numeric(stats::quantile(
      v, probs = c(0.10, 0.25, 0.50, 0.75, 0.90),
      type = 7, names = FALSE
    ))
  } else {
    rep(NA_real_, 5L)
  }
  list(
    n_ch_con_dato = n_dato,
    media = media,
    p10 = q[[1]],
    p25 = q[[2]],
    p50 = q[[3]],
    p75 = q[[4]],
    p90 = q[[5]]
  )
}

.cm_criterio_radiografia_suma_estricta <- function(v) {
  v <- suppressWarnings(as.numeric(v))
  if (!length(v)) return(0)
  if (any(!is.finite(v))) return(NA_real_)
  as.numeric(sum(v))
}

# Alinea los flags previos al aula_frame por classroom_id. El motor los emite
# en el mismo orden, pero el match explícito evita atribuir un delta si un
# consumidor interno llegara a reordenarlos.
.cm_criterio_radiografia_flags_base <- function(aula_frame, flags) {
  n <- nrow(aula_frame)
  invalido <- list(ok = rep(FALSE, n), valido = FALSE)
  if (!is.data.frame(flags) || nrow(flags) != n || !n) return(invalido)
  idx <- seq_len(n)
  if ("classroom_id" %in% names(flags) && "classroom_id" %in% names(aula_frame)) {
    ids_frame <- .cm_aulas_values(aula_frame, "classroom_id", "")
    ids_flags <- .cm_aulas_values(flags, "classroom_id", "")
    if (any(!nzchar(ids_frame)) || anyDuplicated(ids_frame) || anyDuplicated(ids_flags)) {
      return(invalido)
    }
    idx <- match(ids_frame, ids_flags)
    if (anyNA(idx)) return(invalido)
  }
  columnas <- setdiff(names(flags), "classroom_id")
  if (!length(columnas)) return(invalido)
  ok <- rep(TRUE, n)
  for (col in columnas) {
    flag <- suppressWarnings(as.logical(flags[[col]][idx]))
    if (length(flag) != n || anyNA(flag)) return(invalido)
    ok <- ok & flag
  }
  list(ok = ok, valido = TRUE)
}

# Agrega todos los pasos de la suite salvo session_type. `minEligible` puede
# aparecer también en flags; conjugarlo dos veces es idempotente y conserva la
# fuente literal que produjo el evaluador.
.cm_criterio_radiografia_pasos_base <- function(pasos, n) {
  invalido <- list(ok = rep(FALSE, n), valido = FALSE)
  if (!is.list(pasos)) return(invalido)
  ok <- rep(TRUE, n)
  for (paso in pasos) {
    if (!is.list(paso)) return(invalido)
    id <- .cm_aulas_scalar(paso$id, "")
    if (identical(id, "session_type")) next
    flag <- suppressWarnings(as.logical(paso$flag))
    if (length(flag) != n || anyNA(flag)) return(invalido)
    ok <- ok & flag
  }
  list(ok = ok, valido = TRUE)
}

.cm_criterio_radiografia_session_paso_valido <- function(pasos, esperado, n) {
  if (!is.list(pasos)) return(FALSE)
  encontrados <- Filter(function(p) {
    is.list(p) && identical(.cm_aulas_scalar(p$id, ""), "session_type")
  }, pasos)
  if (!length(encontrados)) return(TRUE)
  all(vapply(encontrados, function(p) {
    flag <- suppressWarnings(as.logical(p$flag))
    length(flag) == n && !anyNA(flag) && isTRUE(all(flag == esperado))
  }, logical(1)))
}

.cm_criterio_radiografia_manual_ok <- function(aula_frame, particularidades) {
  decisiones <- if (is.list(particularidades)) particularidades$decisiones else NULL
  decisiones <- .cm_particularidades_normalize_decisiones(decisiones)
  excluir <- names(decisiones)[vapply(
    decisiones, function(x) identical(x$decision, "excluir"), logical(1)
  )]
  !(.cm_aulas_values(aula_frame, "classroom_id", "") %in% excluir)
}

.cm_criterio_radiografia_label_modal <- function(values, idx, fallback = "") {
  if (!length(idx)) return(fallback)
  valor <- .cm_aulas_mode(values[idx], fallback)
  if (!nzchar(valor)) fallback else valor
}

.cm_criterio_radiografia_catalogos <- function(tipos, facultades) {
  tipo_keys <- .cm_aulas_text_key(tipos)
  tipo_vacios <- !nzchar(tipo_keys)
  categorias <- lapply(sort(unique(tipo_keys[!tipo_vacios])), function(k) {
    idx <- which(tipo_keys == k)
    list(
      key = k,
      label = .cm_criterio_radiografia_label_modal(tipos, idx, k),
      empty = FALSE
    )
  })
  if (any(tipo_vacios)) {
    categorias[[length(categorias) + 1L]] <- list(
      key = .cm_criterio_radiografia_missing_session_key,
      label = "Sin dato", empty = TRUE
    )
  }
  if (length(categorias)) {
    etiquetas <- vapply(categorias, function(x) x$label, character(1))
    categorias <- categorias[order(etiquetas)]
  }

  fac_eval_keys <- .cm_criterios_fac_key(facultades)
  facultad_keys <- unique(fac_eval_keys)
  facultad_catalogo <- lapply(facultad_keys, function(k) {
    idx <- which(fac_eval_keys == k)
    vacia <- !nzchar(k)
    list(
      eval_key = k,
      key = if (vacia) .cm_criterio_radiografia_missing_faculty_key else k,
      label = if (vacia) "Sin dato" else
        .cm_criterio_radiografia_label_modal(facultades, idx, k)
    )
  })
  if (length(facultad_catalogo)) {
    etiquetas <- vapply(facultad_catalogo, function(x) x$label, character(1))
    facultad_catalogo <- facultad_catalogo[order(etiquetas)]
  }
  list(
    tipo_keys = tipo_keys,
    fac_eval_keys = fac_eval_keys,
    categorias = categorias,
    facultades = facultad_catalogo
  )
}

.cm_criterio_radiografia_eval_set <- function(tipos, mode, categories) {
  claves <- .cm_aulas_text_key(tipos)
  vapply(claves, function(k) {
    if (!nzchar(k) || !length(categories)) return(TRUE)
    hit <- k %in% categories
    if (identical(mode, "exclude")) !hit else hit
  }, logical(1))
}

.cm_criterio_radiografia_accion <- function(category_key, categories, empty) {
  # Solo la AUSENCIA de tipo es no accionable: una categoría real con 0 CH en
  # esta facultad todavía puede cruzar set vacío↔no vacío y cambiar otros CH.
  if (isTRUE(empty)) return(list(accion = "no_aplica", categories = categories))
  seleccionada <- category_key %in% categories
  if (seleccionada) {
    nuevas <- setdiff(categories, category_key)
    accion <- if (!length(nuevas)) "quitar_restriccion" else "quitar_categoria"
  } else {
    accion <- if (!length(categories)) "restringir_a_categoria" else "agregar_categoria"
    nuevas <- unique(c(categories, category_key))
  }
  list(accion = accion, categories = nuevas)
}

.cm_criterio_radiografia_delta <- function(
    accion, nuevas_categories, fac_idx, tipos, mode, session_actual,
    base_ok, manual_ok, included_actual, eligible_n, reconstruccion_valida) {
  if (identical(accion, "no_aplica")) {
    return(list(delta_ch = 0L, delta_matriculas_elegibles = 0))
  }
  if (!isTRUE(reconstruccion_valida)) {
    return(list(delta_ch = NA_integer_, delta_matriculas_elegibles = NA_real_))
  }
  session_nueva <- session_actual
  session_nueva[fac_idx] <- .cm_criterio_radiografia_eval_set(
    tipos[fac_idx], mode, nuevas_categories
  )
  included_nuevo <- base_ok & session_nueva & manual_ok
  cambiadas <- xor(included_actual, included_nuevo)
  delta_ch <- as.integer(sum(included_nuevo) - sum(included_actual))
  delta_matriculas <- if (any(cambiadas & !is.finite(eligible_n))) {
    NA_real_
  } else {
    as.numeric(sum(eligible_n[included_nuevo & !included_actual]) -
      sum(eligible_n[included_actual & !included_nuevo]))
  }
  list(delta_ch = delta_ch, delta_matriculas_elegibles = delta_matriculas)
}

# Devuelve NULL cuando no existe el output efectivo del evaluador (proyecto
# legacy/sin suite): el sibling es opcional y no proyecta columnas modales para
# fingir el grano. En mode include/exclude activo sí reconstruye el ejecutado;
# cualquier divergencia fila a fila conserva las estadísticas observadas pero
# degrada todos los deltas accionables a NA.
calc_muestra_aulas_criterios_radiografia <- function(
    aula_frame, criterios, criterios_seleccion = NULL,
    particularidades = NULL, frame_hash = NA_character_) {
  if (!is.data.frame(aula_frame) || !nrow(aula_frame) || !is.list(criterios) ||
      !"included" %in% names(aula_frame)) {
    return(NULL)
  }
  seleccion_aula <- criterios$seleccion_aula
  valores <- if (is.list(seleccion_aula)) seleccion_aula$valores else NULL
  n <- nrow(aula_frame)
  if (!is.list(valores) || length(valores$session_type) != n ||
      length(valores$faculty) != n) {
    return(NULL)
  }
  tipos <- trimws(as.character(valores$session_type))
  facultades <- trimws(as.character(valores$faculty))
  tipos[is.na(tipos)] <- ""
  facultades[is.na(facultades)] <- ""

  seleccion <- .cm_criterios_normalize_seleccion(criterios_seleccion)
  criterio <- seleccion$byVariable$session_type
  if (is.null(criterio)) {
    criterio <- .cm_criterios_normalize_criterio(
      list(mode = "include", categories = list()),
      .cm_criterios_var_registry()$session_type
    )
  }
  catalogos <- .cm_criterio_radiografia_catalogos(tipos, facultades)
  included_actual <- suppressWarnings(as.logical(aula_frame$included))
  included_valido <- length(included_actual) == n && !anyNA(included_actual)
  if (!included_valido) included_actual <- rep(FALSE, n)
  eligible_n <- if ("eligible_n" %in% names(aula_frame)) {
    .cm_aulas_num_values(aula_frame, "eligible_n", NA_real_)
  } else {
    rep(NA_real_, n)
  }

  flags <- .cm_criterio_radiografia_flags_base(aula_frame, criterios$flags)
  pasos <- .cm_criterio_radiografia_pasos_base(seleccion_aula$pasos, n)
  base_ok <- flags$ok & pasos$ok
  manual_ok <- .cm_criterio_radiografia_manual_ok(aula_frame, particularidades)
  session_actual <- .cm_criterios_eval_flat_vec(
    tipos, criterio, catalogos$fac_eval_keys
  )
  paso_session_valido <- .cm_criterio_radiografia_session_paso_valido(
    seleccion_aula$pasos, session_actual, n
  )
  reconstruido <- base_ok & session_actual & manual_ok
  reconstruccion_valida <- flags$valido && pasos$valido && included_valido &&
    paso_session_valido && isTRUE(all(reconstruido == included_actual))

  filas <- list()
  for (fac in catalogos$facultades) {
    fac_idx <- which(catalogos$fac_eval_keys == fac$eval_key)
    categories_efectivas <- .cm_criterios_eff_cats(criterio, fac$eval_key)
    for (categoria in catalogos$categorias) {
      categoria_idx <- if (isTRUE(categoria$empty)) {
        fac_idx[!nzchar(catalogos$tipo_keys[fac_idx])]
      } else {
        fac_idx[catalogos$tipo_keys[fac_idx] == categoria$key]
      }
      elegibles_idx <- categoria_idx[included_actual[categoria_idx]]
      accion <- .cm_criterio_radiografia_accion(
        categoria$key, categories_efectivas, categoria$empty
      )
      delta <- .cm_criterio_radiografia_delta(
        accion = accion$accion,
        nuevas_categories = accion$categories,
        fac_idx = fac_idx,
        tipos = tipos,
        mode = criterio$mode,
        session_actual = session_actual,
        base_ok = base_ok,
        manual_ok = manual_ok,
        included_actual = included_actual,
        eligible_n = eligible_n,
        reconstruccion_valida = reconstruccion_valida
      )
      filas[[length(filas) + 1L]] <- list(
        criterio = "session_type",
        facultad_key = fac$key,
        facultad_label = fac$label,
        categoria_key = categoria$key,
        categoria_label = categoria$label,
        n_ch_total = as.integer(length(categoria_idx)),
        n_ch_elegibles = as.integer(length(elegibles_idx)),
        n_matriculas_elegibles = .cm_criterio_radiografia_suma_estricta(
          eligible_n[elegibles_idx]
        ),
        distribucion_elegible = .cm_criterio_radiografia_resumen(
          eligible_n[elegibles_idx], cuantiles = TRUE
        ),
        contraste_total = .cm_criterio_radiografia_resumen(
          eligible_n[categoria_idx], cuantiles = FALSE
        ),
        delta_marginal = list(
          referencia = "marco_ejecutado",
          accion = accion$accion,
          delta_ch = delta$delta_ch,
          delta_matriculas_elegibles = delta$delta_matriculas_elegibles
        )
      )
    }
  }

  list(
    schema = "calc_muestra_aulas_criterios_radiografia_v1",
    owner = .cm_criterio_radiografia_owner,
    frame_hash = .cm_aulas_scalar(frame_hash, NA_character_),
    momento = "marco_ejecutado",
    grano = .cm_criterio_radiografia_grano,
    unidad = .cm_criterio_radiografia_unidad,
    filas = filas
  )
}
