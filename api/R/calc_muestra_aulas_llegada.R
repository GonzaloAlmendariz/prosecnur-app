# El gate de llegada de base (EF7a, era EFECTIVIDAD).
#
# Gonzalo, textual: «garantizar que tengamos una buena selección de cara a
# cuando llegue la base de este año». Los criterios del estudio son listas
# cerradas calibradas sobre la base 2025 — y la familia de defectos más
# repetida de esta casa es exactamente que una lista cerrada SE TRAGA lo que
# no reconoce. Cuando llegue la base 2026, este gate grita lo nuevo en vez de
# tragarlo:
#
#   - NOVEDAD = valor que no estaba en la FOTO (snapshot) contra la que se
#     calibraron los criterios. Distinto de «excluido a propósito»: SEMINARIO
#     está excluido por criterio y NO es novedad; un tipo de sesión que 2025
#     no tenía SÍ lo es.
#   - Además, para cada novedad se dice si ALGÚN criterio la reconoce — una
#     facultad nueva fuera de la whitelist de rangos quedaría EXCLUIDA ENTERA
#     en silencio: ése es el peor tragado posible y aquí se declara primero.
#
# El snapshot viaja en el payload del frame en cada build; el diff corre
# cuando hay un snapshot anterior contra el cual comparar (el sellado del
# baseline en el estudio es el paso EF7a-2).

.cm_llegada_vals <- function(x) {
  v <- toupper(trimws(as.character(x %||% character(0))))
  sort(unique(v[!is.na(v) & nzchar(v)]))
}

#' La foto de los valores estructurales del marco: contra esto se mide la
#' base que llegue después.
.cm_llegada_snapshot <- function(aula_frame) {
  if (!is.data.frame(aula_frame) || !nrow(aula_frame)) {
    return(list(schema = "cm_llegada_snapshot_v1", n_aulas = 0L))
  }
  niveles_fac <- list()
  if (all(c("faculty", "course_level_num") %in% names(aula_frame))) {
    fs <- .cm_llegada_vals(aula_frame$faculty)
    for (f in fs) {
      niv <- suppressWarnings(as.numeric(
        aula_frame$course_level_num[toupper(trimws(aula_frame$faculty)) == f]
      ))
      niv <- sort(unique(niv[is.finite(niv)]))
      niveles_fac[[f]] <- as.list(niv)
    }
  }
  list(
    schema = "cm_llegada_snapshot_v1",
    n_aulas = nrow(aula_frame),
    faculties = as.list(.cm_llegada_vals(aula_frame$faculty)),
    session_types = as.list(.cm_llegada_vals(aula_frame$session_type)),
    teacher_types = as.list(.cm_llegada_vals(aula_frame$teacher_type)),
    modalities = as.list(.cm_llegada_vals(aula_frame$modality)),
    niveles_por_facultad = niveles_fac
  )
}


.cm_llegada_diff_set <- function(actuales, base) {
  base <- toupper(trimws(unlist(base %||% list(), use.names = FALSE)))
  setdiff(actuales, base)
}

#' El diff de la base recién construida contra el snapshot sellado.
#' Devuelve SIEMPRE la lista de bloques (vacíos incluidos): un gate que no
#' corrió y un gate que corrió limpio deben poder distinguirse.
calc_muestra_aulas_novedades <- function(aula_frame, baseline, config = list()) {
  out <- list(schema = "cm_llegada_novedades_v1", comparado = FALSE,
              bloques = list(), limpio = NA)
  if (!is.list(baseline) || !identical(baseline$schema, "cm_llegada_snapshot_v1")) {
    return(out)
  }
  actual <- .cm_llegada_snapshot(aula_frame)
  out$comparado <- TRUE
  bloques <- list()

  # 1 · Facultades nuevas — y si la whitelist de rangos las reconoce. Una
  # facultad fuera del mapa queda EXCLUIDA del marco entera: gravedad alta.
  cs <- config$criterios_seleccion %||% list()
  rangos <- cs$courseLevelRanges %||% list()
  fac_whitelist <- toupper(trimws(names(rangos)))
  fac_nuevas <- .cm_llegada_diff_set(unlist(actual$faculties), baseline$faculties)
  if (length(fac_nuevas)) {
    bloques[[length(bloques) + 1L]] <- list(
      tipo = "facultad_nueva", gravedad = "alta",
      valores = lapply(fac_nuevas, function(f) list(
        valor = f,
        reconocida_por_rangos = f %in% fac_whitelist,
        consecuencia = if (f %in% fac_whitelist) "entra con sus rangos declarados"
                       else "EXCLUIDA ENTERA del marco: la whitelist de rangos no la conoce"
      ))
    )
  }

  # 2 · Tipos de sesión nuevos (el criterio general + excepciones se calibró
  # sin ellos; el analista decide si entran).
  st_nuevos <- .cm_llegada_diff_set(unlist(actual$session_types), baseline$session_types)
  if (length(st_nuevos)) {
    bloques[[length(bloques) + 1L]] <- list(
      tipo = "session_type_nuevo", gravedad = "media",
      valores = lapply(st_nuevos, function(v) list(valor = v))
    )
  }

  # 3 · Tipos de docente nuevos (fuera de la jerarquía sellada).
  orden <- toupper(trimws(unlist(config$teacher_type_orden %||% list(), use.names = FALSE)))
  tt_nuevos <- .cm_llegada_diff_set(unlist(actual$teacher_types), baseline$teacher_types)
  if (length(tt_nuevos)) {
    bloques[[length(bloques) + 1L]] <- list(
      tipo = "teacher_type_nuevo", gravedad = "media",
      valores = lapply(tt_nuevos, function(v) list(
        valor = v,
        en_jerarquia = .cm_aulas_text_key(v) %in% .cm_aulas_text_key(orden)
      ))
    )
  }

  # 4 · Niveles nuevos POR FACULTAD (VARA 3: el nivel se gobierna por
  # facultad; un nivel que 2025 no tenía puede caer fuera de todo rango).
  niveles_nuevos <- list()
  for (f in names(actual$niveles_por_facultad %||% list())) {
    base_niv <- suppressWarnings(as.numeric(unlist(
      (baseline$niveles_por_facultad %||% list())[[f]] %||% list()
    )))
    act_niv <- suppressWarnings(as.numeric(unlist(actual$niveles_por_facultad[[f]])))
    nuevos <- setdiff(act_niv[is.finite(act_niv)], base_niv[is.finite(base_niv)])
    if (length(nuevos)) {
      declarados <- rangos[[f]] %||% rangos[[toupper(f)]] %||% NULL
      cubre <- function(n) {
        if (identical(declarados, "exenta")) return(TRUE)
        if (!length(declarados)) return(FALSE)
        any(vapply(declarados, function(r) {
          isTRUE(n >= .cm_aulas_num(r$min, -Inf)) && isTRUE(n <= .cm_aulas_num(r$max, Inf))
        }, logical(1)))
      }
      niveles_nuevos[[length(niveles_nuevos) + 1L]] <- list(
        facultad = f,
        niveles = lapply(sort(nuevos), function(n) list(
          nivel = n, dentro_de_rango = cubre(n)
        ))
      )
    }
  }
  if (length(niveles_nuevos)) {
    bloques[[length(bloques) + 1L]] <- list(
      tipo = "nivel_nuevo_por_facultad", gravedad = "media", valores = niveles_nuevos
    )
  }

  # 5 · Declaraciones huerfanas: lo que el estudio declaro contra el
  # vocabulario anterior y la base nueva ya no trae. Una whitelist que
  # apunta a un valor fantasma no filtra nada y NADIE lo dice — el modelo
  # de Gonzalo: los criterios se re-declaran contra CADA base, y esto es
  # la lista de que re-declarar.
  huerfanas <- list()
  fac_actuales <- toupper(trimws(unlist(actual$faculties)))
  for (f in names(rangos)) {
    if (!(toupper(trimws(f)) %in% fac_actuales)) {
      huerfanas[[length(huerfanas) + 1L]] <- list(
        criterio = "courseLevelRanges", valor = f,
        detalle = "rangos declarados para una facultad que la base nueva no trae"
      )
    }
  }
  min_fac <- names((cs$minEligible %||% list())$byFaculty %||% list())
  # Clave CANONICA de criterios (.cm_criterios_fac_key), no text_key: el
  # estreno del gate con la base 2026 marco huerfanas FALSAS de Arte y
  # Diseno porque "ARTE Y DISENO" -> text_key no coincide con el slug
  # arte_y_diseno de la config.
  fac_keys <- vapply(fac_actuales, function(x) .cm_criterios_fac_key(x), character(1))
  for (f in min_fac) {
    if (!(.cm_criterios_fac_key(f) %in% fac_keys)) {
      huerfanas[[length(huerfanas) + 1L]] <- list(
        criterio = "minEligible.byFaculty", valor = f,
        detalle = "minimo propio declarado para una facultad que la base nueva no trae"
      )
    }
  }
  exc <- ((cs$byVariable %||% list())$session_type %||% list())$exceptions %||% list()
  for (f in names(exc)) {
    if (!(.cm_criterios_fac_key(f) %in% fac_keys)) {
      huerfanas[[length(huerfanas) + 1L]] <- list(
        criterio = "session_type.exceptions", valor = f,
        detalle = "excepcion de tipo de sesion declarada para una facultad ausente"
      )
    }
  }
  if (length(huerfanas)) {
    bloques[[length(bloques) + 1L]] <- list(
      tipo = "declaracion_huerfana", gravedad = "media", valores = huerfanas
    )
  }

  out$bloques <- bloques
  out$limpio <- length(bloques) == 0L
  out
}
