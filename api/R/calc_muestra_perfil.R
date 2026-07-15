# Perfil institucional derivado del marco de aulas de Cálculo de Muestra.
#
# Vive en archivo propio porque calc_muestra_aulas.R supera las 4400 líneas y
# no debe seguir creciendo: calc_muestra_aulas_construir() invoca este motor
# con un único call-site y adjunta el resultado como out$perfil, que viaja
# entero al frontend dentro del frame (via .cm_state_payload).
#
# Contrato: schema "calc_muestra_aulas_perfil_v1". El frontend (capa dominio/
# del Recorrido universitario) se escribe contra este contrato, así que los
# nombres snake_case y la semántica de cada campo son parte del API; cualquier
# cambio requiere versionar el schema.
#
# Extensión de criterios adicionales (2026-07): el schema se mantiene en
# "calc_muestra_aulas_perfil_v1" porque los campos nuevos son ADITIVOS y el
# frontend los tolera ausentes: marco_base_aulas, opcionales (impacto medido
# de c7/c8, calculado en calc_muestra_aulas_criterios.R y recibido ya listo
# vía ctx$criterios) y los pasos nuevos del embudo de aulas (sede, docente,
# nivel, c7, c8), que solo aparecen cuando su filtro aplicó.
#
# Decisiones semánticas (verificadas contra el preset canónico):
# - "Matriculados población" por aula = ELEGIBLES por aula (eligible_n), nunca
#   enrolled_total. La mediana/media por facultad se calcula sobre las aulas
#   INCLUIDAS en el marco depurado (included == TRUE).
# - Embudos con criterio "alguna fila elegible": un estudiante (o aula) cuenta
#   en el paso k si tiene >= 1 fila que pasa TODOS los filtros acumulados
#   1..k. Es la misma lógica con la que population se deriva de
#   eligible_student por fila, así el último paso del embudo de alumnos
#   siempre calza con poblacion_n.
# - Un paso del embudo se OMITE si su filtro no aplicó, replicando exactamente
#   los predicados de activación de calc_muestra_aulas_construir() (mismo
#   require_* + presencia de señal en la base).
#
# El perfil se deriva de insumos ya validados por construir(): ante insumos
# vacíos degrada a ceros / data.frames vacíos, nunca lanza error.

# Normaliza un vector de texto por fila al largo n (NA -> "", pad con "").
.cm_perfil_chr <- function(x, n) {
  out <- trimws(as.character(x %||% character(0)))
  out[is.na(out)] <- ""
  if (length(out) < n) out <- c(out, rep("", n - length(out)))
  out[seq_len(max(n, 0L))]
}

# Normaliza un flag lógico por fila al largo n. Un flag ausente equivale a
# "filtro no restringe" (todo TRUE), igual que los *_ok de construir().
.cm_perfil_flag <- function(x, n) {
  if (is.null(x) || !length(x)) return(rep(TRUE, max(n, 0L)))
  out <- as.logical(x)
  out[is.na(out)] <- FALSE
  if (length(out) < n) out <- c(out, rep(FALSE, n - length(out)))
  out[seq_len(max(n, 0L))]
}

# Normaliza un vector numérico por fila al largo n (pad con NA).
.cm_perfil_num <- function(x, n) {
  out <- suppressWarnings(as.numeric(x %||% numeric(0)))
  if (length(out) < n) out <- c(out, rep(NA_real_, n - length(out)))
  out[seq_len(max(n, 0L))]
}

# Estudiantes únicos (id no vacío) entre las filas marcadas por keep.
.cm_perfil_n_unicos <- function(ids, keep) {
  length(unique(ids[keep & nzchar(ids)]))
}

# Convierte una lista de pasos (id, label, conteo) en el data.frame del
# embudo. Cada paso restringe al anterior, así que la diferencia nunca es
# negativa; se calcula tal cual para que conteo[k-1] == conteo[k] +
# excluidos[k] sea auditable a mano.
.cm_perfil_embudo_df <- function(pasos) {
  if (!length(pasos)) {
    return(data.frame(
      id = character(0), label = character(0),
      conteo = integer(0), excluidos = integer(0),
      stringsAsFactors = FALSE, check.names = FALSE
    ))
  }
  conteo <- vapply(pasos, function(p) as.integer(p$conteo), integer(1))
  excluidos <- if (length(conteo) > 1L) {
    c(0L, conteo[-length(conteo)] - conteo[-1L])
  } else {
    0L
  }
  out <- data.frame(
    id = vapply(pasos, function(p) p$id, character(1)),
    label = vapply(pasos, function(p) p$label, character(1)),
    conteo = conteo,
    excluidos = as.integer(excluidos),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  rownames(out) <- NULL
  out
}

# Flags por aula de los criterios adicionales, alineados a las filas de
# aula_frame (match por classroom_id contra ctx$criterios$flags). Sin
# ctx$criterios (llamadas directas sin pasar por construir()) degrada a "solo
# min_eligible" con ningún criterio aplicado, que replica el comportamiento
# histórico del embudo. `incluida` es el vector included del aula_frame y
# sirve de fallback para min_eligible_ok.
.cm_perfil_criterios <- function(criterios, aula_frame, incluida) {
  n_aulas <- if (is.data.frame(aula_frame)) nrow(aula_frame) else 0L
  todo_ok <- rep(TRUE, n_aulas)
  out <- list(
    min_eligible_ok = incluida,
    teacher_ok = todo_ok,
    course_level_ok = todo_ok,
    campus_ok = todo_ok,
    c7_ok = todo_ok,
    c8_ok = todo_ok,
    aplica = list(docente = FALSE, nivel = FALSE, sede = FALSE, c7 = FALSE, c8 = FALSE),
    marco_base_aulas = NULL,
    opcionales = NULL
  )
  if (!is.list(criterios)) return(out)
  flags <- criterios$flags
  if (is.data.frame(flags) && nrow(flags) && "classroom_id" %in% names(flags)) {
    idx <- match(
      .cm_aulas_values(aula_frame, "classroom_id", ""),
      .cm_aulas_values(flags, "classroom_id", "")
    )
    leer <- function(col, fallback) {
      if (!col %in% names(flags)) return(fallback)
      v <- as.logical(flags[[col]])[idx]
      # Un aula sin flag (no debería ocurrir) no se restringe.
      v[is.na(v)] <- TRUE
      v
    }
    out$min_eligible_ok <- leer("min_eligible_ok", incluida)
    out$teacher_ok <- leer("teacher_ok", todo_ok)
    out$course_level_ok <- leer("course_level_ok", todo_ok)
    out$campus_ok <- leer("campus_ok", todo_ok)
    out$c7_ok <- leer("c7_ok", todo_ok)
    out$c8_ok <- leer("c8_ok", todo_ok)
  }
  if (is.list(criterios$aplica)) {
    for (nm in names(out$aplica)) {
      out$aplica[[nm]] <- isTRUE(criterios$aplica[[nm]])
    }
  }
  out$marco_base_aulas <- criterios$marco_base_aulas
  out$opcionales <- criterios$opcionales
  out
}

# Bloque `opcionales` degradado para llamadas directas sin ctx$criterios:
# reporta el marco vigente como si ningún opcional recortara nada.
.cm_perfil_opcionales_degradados <- function(marco_aulas, cobertura_pct, filters) {
  paso <- function(id, umbral) {
    list(
      id = id,
      aplicado = FALSE,
      umbral = round(.cm_aulas_num(umbral, 0.80), 4),
      aulas = as.integer(marco_aulas),
      cobertura_pct = cobertura_pct,
      unidades_rotas = character(0)
    )
  }
  list(
    c7 = paso("c7", filters$min_prevalence_pct %||% 0.80),
    c8 = paso("c8", filters$min_cycle_homogeneity_pct %||% 0.80)
  )
}

# Cota inferior/superior del tamaño-de-aula por bootstrap NO paramétrico de la
# MEDIA de `tamanos`. Se bootstrapea la media (no la mediana: con tamaños
# discretos y pocas aulas el bootstrap de la mediana es grumoso/inestable) y se
# reportan los percentiles 2.5%/97.5% como IC de referencia.
#   - Guard de facultad chica: con menos de n_min aulas el IC no es fiable, así
#     que ambas cotas degradan a NA (el frontend cae a min(mediana, media)).
#   - Determinismo: seed local fijo, preservando y restaurando el .Random.seed
#     global para NO perturbar la semilla del sorteo muestral (los goldens de
#     aulas se rompen ante RNG no sembrado o compartido).
.cm_perfil_bootstrap_media <- function(tamanos, n_min = 15L, B = 2000L,
                                       seed = 20260715L) {
  tamanos <- tamanos[is.finite(tamanos)]
  n <- length(tamanos)
  if (n < n_min) return(list(lo95 = NA_real_, hi95 = NA_real_))

  # Guarda el estado RNG global (si existe) y lo restaura al salir; así el seed
  # local no interfiere con la semilla del sorteo muestral.
  tiene_seed <- exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE)
  old_seed <- if (tiene_seed) get(".Random.seed", envir = .GlobalEnv, inherits = FALSE) else NULL
  on.exit({
    if (is.null(old_seed)) {
      if (exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE)) {
        rm(".Random.seed", envir = .GlobalEnv)
      }
    } else {
      assign(".Random.seed", old_seed, envir = .GlobalEnv)
    }
  }, add = TRUE)

  set.seed(seed)
  medias <- vapply(seq_len(B), function(i) {
    mean(sample(tamanos, size = n, replace = TRUE))
  }, numeric(1))
  q <- stats::quantile(medias, probs = c(0.025, 0.975), type = 7, names = FALSE)
  list(lo95 = round(q[[1L]], 1), hi95 = round(q[[2L]], 1))
}

# Tabla por facultad presente en population. marco = aulas INCLUIDAS del
# aula_frame (marco depurado); alcanzables_ids = estudiantes con >= 1 fila
# eligible_row dentro de un aula incluida.
.cm_perfil_facultades_df <- function(population, marco, sexo_labels, alcanzables_ids) {
  vacio <- data.frame(
    id = character(0), nombre = character(0), n = integer(0),
    sexo_1_n = integer(0), sexo_2_n = integer(0),
    est_aula_mediana = numeric(0), est_aula_media = numeric(0),
    est_aula_lo95 = numeric(0), est_aula_hi95 = numeric(0),
    est_aula_n_ch = integer(0),
    alcanzables = integer(0), aulas_marco = integer(0),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  if (!is.data.frame(population) || !nrow(population)) return(vacio)
  fac <- .cm_aulas_values(population, "faculty", "")
  sex <- .cm_aulas_values(population, "sex", "")
  sid <- .cm_aulas_values(population, "student_id", "")
  marco_fac <- .cm_aulas_values(marco, "faculty", "")
  marco_sizes <- .cm_aulas_num_values(marco, "eligible_n", NA_real_)

  filas <- lapply(unique(fac), function(f) {
    en_fac <- fac == f
    en_marco <- marco_fac == f
    tamanos <- marco_sizes[en_marco]
    tamanos <- tamanos[is.finite(tamanos)]
    # Banda bootstrap de la media (NA en facultades chicas < 15 aulas).
    boot <- .cm_perfil_bootstrap_media(tamanos)
    data.frame(
      id = if (nzchar(f)) .cm_aulas_text_key(f) else "sin-facultad",
      nombre = if (nzchar(f)) f else "Sin facultad",
      n = as.integer(sum(en_fac)),
      sexo_1_n = if (length(sexo_labels) >= 1L) as.integer(sum(en_fac & sex == sexo_labels[[1L]])) else 0L,
      sexo_2_n = if (length(sexo_labels) >= 2L) as.integer(sum(en_fac & sex == sexo_labels[[2L]])) else 0L,
      est_aula_mediana = if (length(tamanos)) as.numeric(stats::median(tamanos)) else NA_real_,
      est_aula_media = if (length(tamanos)) round(mean(tamanos), 1) else NA_real_,
      est_aula_lo95 = boot$lo95,
      est_aula_hi95 = boot$hi95,
      est_aula_n_ch = as.integer(length(tamanos)),
      alcanzables = as.integer(sum(en_fac & sid %in% alcanzables_ids)),
      aulas_marco = as.integer(sum(en_marco)),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  })
  out <- do.call(rbind, filas)
  out <- out[order(-out$n, out$nombre), , drop = FALSE]
  # Nombres degenerados (solo símbolos) producen slug vacío; se les da un id
  # genérico y make.unique desambigua colisiones de slug entre facultades.
  out$id[!nzchar(out$id)] <- "facultad"
  out$id <- make.unique(out$id, sep = "_")
  rownames(out) <- NULL
  out
}

# Perfil institucional del marco de aulas.
#
# ctx: lista con los insumos que construir() ya tiene en scope:
#   - vectores por fila: student_id, classroom_id, faculty, sex, age,
#     condition, level, modality, session_type
#   - flags por fila: age_ok, condition_ok, level_ok, modality_ok,
#     session_ok, eligible_student, eligible_row
#   - population (df de estudiantes únicos elegibles), aula_frame (df de
#     aulas con eligible_n/included) y cfg (config normalizada).
calc_muestra_aulas_perfil <- function(ctx) {
  if (!is.list(ctx)) ctx <- list()
  n <- length(ctx$student_id %||% character(0))
  student_id <- .cm_perfil_chr(ctx$student_id, n)
  classroom_id <- .cm_perfil_chr(ctx$classroom_id, n)
  condition <- .cm_perfil_chr(ctx$condition, n)
  level <- .cm_perfil_chr(ctx$level, n)
  formation <- .cm_perfil_chr(ctx$formation, n)
  modality <- .cm_perfil_chr(ctx$modality, n)
  session_type <- .cm_perfil_chr(ctx$session_type, n)
  age <- .cm_perfil_num(ctx$age, n)
  age_ok <- .cm_perfil_flag(ctx$age_ok, n)
  condition_ok <- .cm_perfil_flag(ctx$condition_ok, n)
  level_ok <- .cm_perfil_flag(ctx$level_ok, n)
  modality_ok <- .cm_perfil_flag(ctx$modality_ok, n)
  session_ok <- .cm_perfil_flag(ctx$session_ok, n)
  eligible_student <- .cm_perfil_flag(ctx$eligible_student, n)
  eligible_row <- .cm_perfil_flag(ctx$eligible_row, n)

  population <- if (is.data.frame(ctx$population)) ctx$population else data.frame(stringsAsFactors = FALSE)
  aula_frame <- if (is.data.frame(ctx$aula_frame)) ctx$aula_frame else data.frame(stringsAsFactors = FALSE)
  filters <- (ctx$cfg %||% list())$filters %||% list()
  if (!is.list(filters)) filters <- list()
  min_age <- .cm_aulas_int(filters$min_age, 18L)
  min_eligible <- .cm_aulas_int(filters$min_eligible_per_class, 1L)

  # Mismos predicados de activación que construir(): un filtro "aplicó" solo
  # si estaba pedido en config Y la base traía señal para evaluarlo.
  # H7: el paso "pregrado" aplica si la columna de formación trae señal (con
  # patrones aceptados configurados — filtro canónico) o, en su defecto, si el
  # nivel del estudiante la trae (fallback histórico por patrones de posgrado).
  formation_patterns <- .cm_aulas_chr_vec(filters$accepted_formation_patterns)
  aplica_pregrado <- isTRUE(filters$require_undergraduate) &&
    ((length(formation_patterns) > 0L && any(nzchar(formation))) || any(nzchar(level)))
  aplica_regular <- any(nzchar(condition)) && length(filters$accepted_conditions %||% list()) > 0L
  aplica_mayor_edad <- isTRUE(filters$require_adult) && any(is.finite(age))
  aplica_presencial <- isTRUE(filters$require_in_person) && any(nzchar(modality))
  aplica_tipo <- length(filters$exclude_session_patterns %||% list()) > 0L && any(nzchar(session_type))

  universo <- .cm_perfil_n_unicos(student_id, rep(TRUE, n))
  poblacion_n <- nrow(population)
  aulas_totales <- length(unique(classroom_id[nzchar(classroom_id)]))
  incluida <- if (nrow(aula_frame)) aula_frame$included %in% TRUE else logical(0)
  marco <- if (nrow(aula_frame)) aula_frame[incluida, , drop = FALSE] else aula_frame
  marco_aulas <- sum(incluida)

  sex_pop <- .cm_aulas_values(population, "sex", "")
  sex_tab <- sort(table(sex_pop[nzchar(sex_pop)]), decreasing = TRUE)
  sexo_labels <- as.character(utils::head(names(sex_tab), 2L))

  # Embudo de estudiantes únicos: cada paso acumula el flag de su filtro y
  # cuenta estudiantes con >= 1 fila que pasa todo lo acumulado.
  acumulado <- nzchar(student_id)
  pasos_alumno <- list(list(id = "universo", label = "Todos los registros de estudiante", conteo = universo))
  if (aplica_pregrado) {
    acumulado <- acumulado & level_ok
    pasos_alumno <- c(pasos_alumno, list(list(
      id = "pregrado", label = "Solo pregrado",
      conteo = .cm_perfil_n_unicos(student_id, acumulado)
    )))
  }
  if (aplica_regular) {
    acumulado <- acumulado & condition_ok
    pasos_alumno <- c(pasos_alumno, list(list(
      id = "regular", label = "Condición regular",
      conteo = .cm_perfil_n_unicos(student_id, acumulado)
    )))
  }
  if (aplica_mayor_edad) {
    acumulado <- acumulado & age_ok
    pasos_alumno <- c(pasos_alumno, list(list(
      id = "mayor-edad", label = sprintf("Con %s años o más", min_age),
      conteo = .cm_perfil_n_unicos(student_id, acumulado)
    )))
  }

  # Embudo de aulas: un aula pasa un paso si conserva >= 1 fila de estudiante
  # elegible que además pasa los filtros de aula acumulados. Los pasos a
  # partir de "sede" se evalúan sobre los flags por aula de los criterios
  # (ctx$criterios); el conteo de cada paso es el nº de aulas que sobreviven
  # a los filtros ACUMULADOS hasta ese paso, así el último siempre calza con
  # marco_aulas.
  crit <- .cm_perfil_criterios(ctx$criterios, aula_frame, incluida)
  seleccion_activa <- .cm_criterios_seleccion_activa((ctx$cfg %||% list())$criterios_seleccion)
  pct7 <- .cm_aulas_num(filters$min_prevalence_pct, 0.80)
  pct8 <- .cm_aulas_num(filters$min_cycle_homogeneity_pct, 0.80)
  keep_aula <- eligible_student & nzchar(classroom_id)
  pasos_aula <- list(list(id = "total", label = "Curso-horario únicos", conteo = aulas_totales))
  if (seleccion_activa && is.list((ctx$criterios %||% list())$seleccion_aula)) {
    pasos_seleccion <- ctx$criterios$seleccion_aula$pasos %||% list()
    en_paso <- rep(TRUE, nrow(aula_frame))
    for (paso in pasos_seleccion) {
      flag <- paso$flag %||% rep(TRUE, nrow(aula_frame))
      flag <- as.logical(flag)
      if (length(flag) != nrow(aula_frame)) flag <- rep(TRUE, nrow(aula_frame))
      flag[is.na(flag)] <- TRUE
      en_paso <- en_paso & flag
      pasos_aula <- c(pasos_aula, list(list(
        id = paso$id,
        label = paso$label,
        conteo = sum(en_paso)
      )))
    }
    agregar_adicional <- function(id, label, flag) {
      en_paso <<- en_paso & flag
      pasos_aula <<- c(pasos_aula, list(list(id = id, label = label, conteo = sum(en_paso))))
    }
    if (crit$aplica$c7) {
      agregar_adicional(
        "c7", sprintf("c7 · Prevalencia ≥ %d%%", as.integer(round(pct7 * 100))), crit$c7_ok
      )
    }
    if (crit$aplica$c8) {
      agregar_adicional(
        "c8", sprintf("c8 · Homogeneidad de ciclo ≥ %d%%", as.integer(round(pct8 * 100))), crit$c8_ok
      )
    }
  } else {
  if (aplica_presencial) {
    pasos_aula <- c(pasos_aula, list(list(
      id = "presencial", label = "Solo presencial",
      conteo = length(unique(classroom_id[keep_aula & modality_ok]))
    )))
  }
  if (aplica_tipo) {
    pasos_aula <- c(pasos_aula, list(list(
      id = "tipo", label = "Tipo de sesión encuestable",
      conteo = length(unique(classroom_id[keep_aula & modality_ok & session_ok]))
    )))
  }
  # Acumulado a nivel aula: arranca con las aulas que conservan >= 1 fila
  # sobreviviente de los pasos por fila (presencial/tipo) y va intersectando
  # los flags de cada criterio en el orden canónico del embudo.
  aula_ids_frame <- .cm_aulas_values(aula_frame, "classroom_id", "")
  en_paso <- aula_ids_frame %in% unique(classroom_id[keep_aula & modality_ok & session_ok])
  if (crit$aplica$sede) {
    en_paso <- en_paso & crit$campus_ok
    pasos_aula <- c(pasos_aula, list(list(
      id = "sede", label = "Solo sedes del operativo", conteo = sum(en_paso)
    )))
  }
  # Con config default este conteo es exactamente marco_aulas (retro-compat);
  # con criterios posteriores activos es un paso intermedio del acumulado.
  en_paso <- en_paso & crit$min_eligible_ok
  pasos_aula <- c(pasos_aula, list(list(
    id = "elegibles", label = sprintf("Con %s o más elegibles", min_eligible),
    conteo = sum(en_paso)
  )))
  if (crit$aplica$docente) {
    en_paso <- en_paso & crit$teacher_ok
    pasos_aula <- c(pasos_aula, list(list(
      id = "docente", label = "Con docente estable", conteo = sum(en_paso)
    )))
  }
  if (crit$aplica$nivel) {
    en_paso <- en_paso & crit$course_level_ok
    pasos_aula <- c(pasos_aula, list(list(
      id = "nivel", label = "Nivel del curso según su unidad", conteo = sum(en_paso)
    )))
  }
  if (crit$aplica$c7) {
    en_paso <- en_paso & crit$c7_ok
    pasos_aula <- c(pasos_aula, list(list(
      id = "c7",
      label = sprintf("c7 · Prevalencia ≥ %d%%", as.integer(round(pct7 * 100))),
      conteo = sum(en_paso)
    )))
  }
  if (crit$aplica$c8) {
    en_paso <- en_paso & crit$c8_ok
    pasos_aula <- c(pasos_aula, list(list(
      id = "c8",
      label = sprintf("c8 · Homogeneidad de ciclo ≥ %d%%", as.integer(round(pct8 * 100))),
      conteo = sum(en_paso)
    )))
  }
  }

  # Alcanzables: estudiantes con >= 1 fila eligible_row cuya aula quedó en el
  # marco depurado. Se usa el vector por fila (no unique_student_ids).
  marco_ids <- .cm_aulas_values(marco, "classroom_id", "")
  marco_ids <- marco_ids[nzchar(marco_ids)]
  alcanzable_fila <- eligible_row & classroom_id %in% marco_ids
  alcanzables_ids <- unique(student_id[alcanzable_fila & nzchar(student_id)])
  pop_ids <- .cm_aulas_values(population, "student_id", "")
  alcanzables_total <- sum(pop_ids %in% alcanzables_ids)

  cobertura_pct <- if (poblacion_n > 0L) round(alcanzables_total / poblacion_n, 4) else NA_real_

  list(
    schema = "calc_muestra_aulas_perfil_v1",
    universo = as.integer(universo),
    poblacion_n = as.integer(poblacion_n),
    aulas_totales = as.integer(aulas_totales),
    marco_aulas = as.integer(marco_aulas),
    # Campos aditivos de criterios: marco base (sin opcionales c7/c8) e
    # impacto medido de cada opcional, ya calculados en
    # calc_muestra_aulas_criterios.R. Sin ctx$criterios degradan al marco
    # vigente sin recortes.
    marco_base_aulas = as.integer(.cm_aulas_int(crit$marco_base_aulas, marco_aulas)),
    sexo_labels = sexo_labels,
    embudo_alumno = .cm_perfil_embudo_df(pasos_alumno),
    embudo_aula = .cm_perfil_embudo_df(pasos_aula),
    facultades = .cm_perfil_facultades_df(population, marco, sexo_labels, alcanzables_ids),
    cobertura = list(
      elegibles = as.integer(poblacion_n),
      alcanzables = as.integer(alcanzables_total),
      pct = cobertura_pct
    ),
    opcionales = if (is.list(crit$opcionales)) {
      crit$opcionales
    } else {
      .cm_perfil_opcionales_degradados(marco_aulas, cobertura_pct, filters)
    }
  )
}
