# Señales de criterios desde el catálogo de curso-horario (fix H8a).
#
# En el modo dos_bases el tipo de docente (y a veces la sede o el nivel del
# curso) vive SOLO en el catálogo, pero el motor evalúa TODOS los criterios
# sobre las filas de la base (raw): el enriquecimiento histórico copiaba
# únicamente teacher y teacher_email, así que aula_frame$teacher_type quedaba
# vacío, la guarda de activación no veía señal y el filtro de docente estable
# se apagaba en silencio (caso real UAN: 5,263 aulas sin paso "docente").
#
# Este módulo crea en raw columnas SINTÉTICAS con el NOMBRE EXACTO del rol
# (teacher_type / campus / course_level) rellenadas por llave de aula, SOLO
# cuando la base no trae señal propia para ese rol. La columna sintética gana
# la resolución por nombre exacto en .cm_aulas_col / el resolver con guarda de
# teacher_type — correcto porque solo existe cuando la base no traía señal
# (una base con columna propia poblada sigue ganando siempre).
#
# Vive en archivo propio porque calc_muestra_aulas.R supera las 4400 líneas y
# no debe seguir creciendo: .cm_aulas_enrich_with_catalog() lo invoca con un
# único call-site, reusando raw_key/catalog_key ya calculados.
#
# NOTA session_type-desde-catálogo: fuera de alcance deliberado. El fix de la
# whitelist del workspace (H8b) ya cura el paso "tipo" y la base real trae la
# señal; leer la columna "Tipo" del catálogo requeriría además sumar
# tipo_curso/tipo_de_curso a los candidatos default de session_type.

# Agregado por llave de aula del catálogo. Para teacher_type se CONCATENAN los
# valores únicos con " | " en lugar de tomar el modal: un aula con varios
# docentes (103 en el caso real) debe conservar TODOS los tipos para que el
# criterio "al menos un docente aceptado" pueda matchear por subcadena sobre
# el concatenado; el modal perdería al segundo docente y rompería el
# al-menos-uno. Para campus/course_level el modal es correcto (valor único por
# aula en la práctica).
.cm_catalogo_lookup_rol <- function(value, catalog_key, concat) {
  keep <- nzchar(catalog_key) & nzchar(value)
  if (!any(keep)) return(character(0))
  grupos <- split(value[keep], catalog_key[keep])
  if (isTRUE(concat)) {
    return(vapply(grupos, function(v) paste(unique(v), collapse = " | "), character(1)))
  }
  vapply(grupos, .cm_aulas_mode, character(1), default = "")
}

# Rellena UN rol sintético desde el catálogo. Devuelve list(data, filled):
#   - la base gana: si el rol ya resuelve en raw a una columna con >= 1 valor,
#     no se crea nada (semántica intacta; para teacher_type se usa el resolver
#     con guarda anti-colisión, no .cm_aulas_col pelado — sin la guarda el
#     fuzzy caería en la columna teacher recién enriquecida).
#   - lado catálogo SOLO por clave exacta (.cm_criterios_col_exacta): el fuzzy
#     bidireccional de .cm_aulas_col leería "Tipo" (tipo de sesión) como tipo
#     de docente en catálogos sin columna "Tipo de docente".
#   - filas de raw sin match en el catálogo quedan "" (sin señal -> pasa).
.cm_catalogo_rellenar_rol <- function(raw, catalogo, mapping, raw_key, catalog_key, rol, concat = FALSE) {
  col_raw <- if (identical(rol, "teacher_type")) {
    .cm_criterios_col_teacher_type(raw, mapping)
  } else {
    .cm_aulas_col(raw, mapping[[rol]])
  }
  if (nzchar(col_raw) && any(nzchar(.cm_aulas_values(raw, col_raw, "")))) {
    return(list(data = raw, filled = 0L))
  }
  col_cat <- .cm_criterios_col_exacta(catalogo, mapping[[rol]])
  if (!nzchar(col_cat)) return(list(data = raw, filled = 0L))
  lookup <- .cm_catalogo_lookup_rol(.cm_aulas_values(catalogo, col_cat, ""), catalog_key, concat)
  if (!length(lookup)) return(list(data = raw, filled = 0L))
  raw <- .cm_aulas_fill_from_lookup(raw, raw_key, rol, lookup)
  list(data = raw, filled = sum(nzchar(.cm_aulas_values(raw, rol, ""))))
}

# Punto de entrada desde .cm_aulas_enrich_with_catalog(): rellena las señales
# de criterios y devuelve la misma forma list(data, audit) que ese helper
# retorna, sumando contadores auditables por rol. Sin catálogo, sin columnas
# en el catálogo o con señal propia en la base -> raw intacto y contadores en
# 0 (retro-compat: el marco resultante es bit a bit idéntico al histórico).
.cm_aulas_enrich_criterios_desde_catalogo <- function(raw, catalogo, mapping, raw_key, catalog_key, audit = list()) {
  audit$teacher_type_values <- 0L
  audit$campus_values <- 0L
  audit$course_level_values <- 0L
  if (!is.data.frame(raw) || !nrow(raw) || !is.data.frame(catalogo) || !nrow(catalogo)) {
    return(list(data = raw, audit = audit))
  }
  tt <- .cm_catalogo_rellenar_rol(raw, catalogo, mapping, raw_key, catalog_key, "teacher_type", concat = TRUE)
  raw <- tt$data
  audit$teacher_type_values <- tt$filled
  sede <- .cm_catalogo_rellenar_rol(raw, catalogo, mapping, raw_key, catalog_key, "campus", concat = FALSE)
  raw <- sede$data
  audit$campus_values <- sede$filled
  nivel <- .cm_catalogo_rellenar_rol(raw, catalogo, mapping, raw_key, catalog_key, "course_level", concat = FALSE)
  raw <- nivel$data
  audit$course_level_values <- nivel$filled
  list(data = raw, audit = audit)
}

# --- Señales AUTORITATIVAS por aula desde el catálogo (fix del −281) ----------
#
# La modalidad, el tipo de sesión, el tipo de docente y el nivel del curso son
# CONSTANTES por aula en el catálogo, pero RUIDOSOS en la base del alumno (un
# aula presencial arrastra alumnos matriculados en semipresencial/virtual). El
# modelo de criterios por categoría (scope aula) debe evaluar el valor
# constante-por-aula: leyendo el modal del catálogo, `PRESENCIAL` da 4624
# EXACTO (cifra canónica); leyendo el modal de la base da 4920 (−281 al revés,
# ruidoso). Estas señales alimentan la ENUMERACIÓN (criterios_catalogo) y la
# EVALUACIÓN de la selección por categorías; NO tocan el path legacy por
# patrones (que sigue leyendo por-fila de la base → retro-compat bit a bit).
#
# Columnas del catálogo resueltas SOLO por clave exacta (.cm_criterios_col_exacta):
# el fuzzy bidireccional de .cm_aulas_col leería "Tipo" (sesión) como
# "Tipo de docente". Devuelve valores CRUDOS por aula (el modal se normaliza en
# el punto de uso con .cm_aulas_text_key) para poder etiquetar categorías y
# plegar variantes. Sin catálogo → estructura vacía (fallback a la base).

# Candidatos de columna del catálogo por rol de señal (además del mapping).
.cm_catalogo_signal_candidates <- function(mapping, rol) {
  base <- switch(rol,
    modality       = mapping$modality,
    session_type   = c(mapping$session_type, "tipo", "tipo_curso", "tipo_de_curso", "tipo de curso"),
    teacher_type   = mapping$teacher_type,
    course_level   = c(mapping$course_level, "nivel"),
    # En el catálogo la condición DEL CURSO suele venir como "Condición" a secas
    # (no hay estudiante que ambiguar); por eso se admite "condicion" además del
    # mapping propio. En la base sí es peligroso y se resuelve por clave exacta.
    condicion_curso = c(mapping$condicion_curso, "condicion"),
    enrolled_total = mapping$enrolled_total,
    faculty_curso  = c("facultad_del_curso", "facultad del curso", mapping$faculty),
    campus         = mapping$campus,
    character(0)
  )
  unique(.cm_aulas_chr_vec(base))
}

# Modal (valor crudo más frecuente) por llave de aula. Devuelve chr nombrado.
.cm_catalogo_modal_by_key <- function(values, catalog_key) {
  keep <- nzchar(catalog_key) & nzchar(values)
  if (!any(keep)) return(stats::setNames(character(0), character(0)))
  vapply(split(values[keep], catalog_key[keep]), .cm_aulas_mode, character(1), default = "")
}

# Agregado numérico por llave de aula (por defecto el máximo: matriculados/
# población es constante por aula pero puede llegar repetido por docente).
.cm_catalogo_num_by_key <- function(values, catalog_key, agg = c("max", "mode")) {
  agg <- match.arg(agg)
  num <- suppressWarnings(as.numeric(values))
  keep <- nzchar(catalog_key) & is.finite(num)
  if (!any(keep)) return(stats::setNames(numeric(0), character(0)))
  fun <- if (identical(agg, "max")) {
    function(v) suppressWarnings(max(v, na.rm = TRUE))
  } else {
    function(v) { t <- sort(table(v), decreasing = TRUE); as.numeric(names(t)[[1]]) }
  }
  out <- vapply(split(num[keep], catalog_key[keep]), fun, numeric(1))
  out[!is.finite(out)] <- NA_real_
  out
}

# Conjunto de tipos de docente CRUDOS únicos por aula (concatenados con "||").
# Se conservan TODOS los docentes del aula: la regla "al menos uno" (match any)
# necesita el set completo, no el modal.
.cm_catalogo_teacher_set_by_key <- function(values, catalog_key) {
  keep <- nzchar(catalog_key) & nzchar(values)
  if (!any(keep)) return(stats::setNames(character(0), character(0)))
  vapply(split(values[keep], catalog_key[keep]), function(v) {
    paste(unique(trimws(v)), collapse = "||")
  }, character(1))
}

# Separadores de control para el SET de pares (facultad del curso, nivel) por
# aula: no aparecen en datos reales. Un curso-horario le cuenta a varias
# carreras/facultades en distinto ciclo (1609/5262 aulas sirven a ≥2), así que
# la regla canónica de nivel es "cualquier par" (§3ter): el aula pasa si ALGUNA
# de sus (facultad, nivel) cae en rango. Este set alimenta esa regla; el modal
# (course_level/faculty_curso) se conserva aparte para las demás variables.
.cm_catalogo_pair_fld <- intToUtf8(31L)  # unit separator (facultad<->nivel)
.cm_catalogo_pair_rec <- intToUtf8(30L)  # record separator (par<->par)

# SET de pares distintos (facultad del curso CRUDA, nivel CRUDO) por aula.
# Devuelve chr nombrado por catalog_key: "FAC<fld>NIV<rec>FAC<fld>NIV". La
# facultad cruda se conserva para que el evaluador la normalice con la misma
# clave robusta a la ñ; el nivel crudo se parsea a número en el punto de uso.
.cm_catalogo_pairs_by_key <- function(faculty_vals, nivel_vals, catalog_key) {
  keep <- nzchar(catalog_key) & (nzchar(faculty_vals) | nzchar(nivel_vals))
  if (!any(keep)) return(stats::setNames(character(0), character(0)))
  fac <- faculty_vals[keep]
  niv <- nivel_vals[keep]
  key <- catalog_key[keep]
  pares <- paste0(fac, .cm_catalogo_pair_fld, niv)
  vapply(split(pares, key), function(p) {
    paste(unique(p), collapse = .cm_catalogo_pair_rec)
  }, character(1))
}

# Punto de entrada: señales por aula desde el catálogo, keyed por catalog_key
# (text_key del classroom_id). `columns` reporta la columna del Excel resuelta
# por rol (para `mappedColumn` de la enumeración); "" si no mapeada.
.cm_aulas_catalog_aula_signals <- function(catalogo, mapping) {
  catalogo <- .cm_aulas_clean_table_names(.cm_aulas_as_df(catalogo, "catalogo_curso_horario"))
  vacio <- list(
    keys = character(0),
    modality = stats::setNames(character(0), character(0)),
    session_type = stats::setNames(character(0), character(0)),
    teacher_set = stats::setNames(character(0), character(0)),
    course_level = stats::setNames(numeric(0), character(0)),
    course_faculty_level_pairs = stats::setNames(character(0), character(0)),
    condicion_curso = stats::setNames(character(0), character(0)),
    enrolled_total = stats::setNames(numeric(0), character(0)),
    faculty_curso = stats::setNames(character(0), character(0)),
    campus = stats::setNames(character(0), character(0)),
    columns = list(modality = "", session_type = "", teacher_type = "",
                   course_level = "", condicion_curso = "", enrolled_total = "",
                   faculty_curso = "", campus = ""),
    used = FALSE
  )
  if (!nrow(catalogo)) return(vacio)
  catalog_key <- .cm_aulas_catalog_keys(catalogo, mapping)
  if (!any(nzchar(catalog_key))) return(vacio)

  col_of <- function(rol) .cm_criterios_col_exacta(catalogo, .cm_catalogo_signal_candidates(mapping, rol))
  cols <- list(
    modality = col_of("modality"), session_type = col_of("session_type"),
    teacher_type = col_of("teacher_type"), course_level = col_of("course_level"),
    condicion_curso = col_of("condicion_curso"),
    enrolled_total = col_of("enrolled_total"), faculty_curso = col_of("faculty_curso"),
    campus = col_of("campus")
  )
  val <- function(col) if (nzchar(col)) .cm_aulas_values(catalogo, col, "") else character(nrow(catalogo))

  list(
    keys = unique(catalog_key[nzchar(catalog_key)]),
    modality = .cm_catalogo_modal_by_key(val(cols$modality), catalog_key),
    session_type = .cm_catalogo_modal_by_key(val(cols$session_type), catalog_key),
    teacher_set = .cm_catalogo_teacher_set_by_key(val(cols$teacher_type), catalog_key),
    course_level = .cm_catalogo_num_by_key(val(cols$course_level), catalog_key, "mode"),
    course_faculty_level_pairs = .cm_catalogo_pairs_by_key(
      val(cols$faculty_curso), val(cols$course_level), catalog_key
    ),
    condicion_curso = .cm_catalogo_modal_by_key(val(cols$condicion_curso), catalog_key),
    enrolled_total = .cm_catalogo_num_by_key(val(cols$enrolled_total), catalog_key, "max"),
    faculty_curso = .cm_catalogo_modal_by_key(val(cols$faculty_curso), catalog_key),
    campus = .cm_catalogo_modal_by_key(val(cols$campus), catalog_key),
    columns = cols,
    used = TRUE
  )
}
