# Criterios adicionales del marco de aulas universitarias: docente estable,
# nivel del curso por unidad académica, sede del operativo y los opcionales
# c7 (prevalencia mínima de elegibles) y c8 (homogeneidad de ciclo).
#
# Vive en archivo propio porque calc_muestra_aulas.R supera las 4400 líneas y
# no debe seguir creciendo: calc_muestra_aulas_construir() invoca
# calc_muestra_aulas_aplicar_criterios() con un único call-site después de
# armar el aula_frame base, y el resultado (flags por aula + impacto medido de
# los opcionales) viaja al perfil institucional vía ctx$criterios.
#
# Semántica compartida por los cuatro criterios (misma que los filtros
# históricos de construir()): un filtro aplica SOLO si está pedido en config Y
# la base trae señal para evaluarlo; un aula sin señal propia (sin tipo de
# docente, sin nivel parseable, sin sede, ratio NA, sin ciclos de estudiante)
# PASA — sin señal no se restringe. Todos los filtros nuevos nacen apagados:
# una config vieja produce un marco bit a bit idéntico (mismo included y mismo
# marco_aulas); solo se agregan columnas informativas al aula_frame.

# =============================================================================
# Suite de criterios de inclusión/exclusión POR CATEGORÍA (dos scopes)
# =============================================================================
#
# Modelo declarativo que reemplaza el contrato de patrones (substring) por sets
# de categorías NORMALIZADAS + excepciones por facultad + umbrales/rangos. Cubre
# DOS scopes, ambos dirigidos por el mapeo de variables (cero lógica de un
# estudio concreto hardcodeada; la selección canónica HST es solo un preset):
#
#   - scope "alumno" (define la POBLACIÓN objetivo N): formation, condition,
#     age (numérico), faculty (además estratifica), level/ciclo (ordinal). Cada
#     criterio de alumno lleva una CAPA (layer): "marco" reduce N; "instrumento"
#     no reduce el marco (se valida en el cuestionario, solo se reporta);
#     "procesamiento" se aplica post-campo. El "ciclo 1 → instrumento" de HST es
#     una ELECCIÓN del usuario, nunca una regla fija.
#   - scope "aula" (define el MARCO de aulas): modality, session_type,
#     teacher_type (jerárquico), course_level (rango por facultad),
#     enrolled_total (≥ umbral), campus. Valores CONSTANTES por aula resueltos
#     desde el catálogo (fix del −281; ver calc_muestra_aulas_catalogo.R).
#
# Retro-compat innegociable: si la config NO trae `criterios_seleccion`, el
# marco y la población salen bit a bit idénticos al path legacy por patrones
# (require_undergraduate/require_adult/accepted_conditions + filtros de aula).
# La selección por categorías es un gate ADITIVO sobre el resultado legacy.

# Registro canónico de variables de criterio: define scope, kind, etiqueta,
# capa por defecto (alumno) y si estratifica (faculty). Dirige tanto la
# enumeración como la evaluación; agregar una variable es una entrada aquí, sin
# ramas ad-hoc por estudio.
.cm_criterios_var_registry <- function() {
  list(
    formation      = list(scope = "alumno", kind = "flat",         label = "Formación",                 defaultLayer = "marco"),
    condition      = list(scope = "alumno", kind = "flat",         label = "Condición de matrícula",     defaultLayer = "marco"),
    age            = list(scope = "alumno", kind = "numeric",      label = "Edad",                       defaultLayer = "marco"),
    faculty        = list(scope = "alumno", kind = "flat",         label = "Facultad",                   defaultLayer = "marco", estratifica = TRUE),
    level          = list(scope = "alumno", kind = "ordinal",      label = "Ciclo o nivel curricular",   defaultLayer = "instrumento"),
    modality       = list(scope = "aula",   kind = "flat",         label = "Modalidad"),
    session_type   = list(scope = "aula",   kind = "flat",         label = "Tipo de sesión"),
    teacher_type   = list(scope = "aula",   kind = "hierarchical", label = "Tipo de docente"),
    course_level   = list(scope = "aula",   kind = "range",        label = "Nivel del curso"),
    # emptyBucket: bucket SINTÉTICO para la AUSENCIA de valor. En la data real
    # (PUCP) "CURSO Y HORARIO"·"Condición" viene ~98% vacía; el usuario quiere
    # poder INCLUIR explícitamente esos cursos sin condición en vez de que se
    # caigan del marco al filtrar. Solo condicion_curso lo define (pedido
    # concreto); es un punto de extensión, no un cambio para modality/etc.
    condicion_curso = list(scope = "aula",  kind = "flat",         label = "Condición del curso",
                           emptyBucket = list(key = "sin_condicion", label = "Sin condición")),
    enrolled_total = list(scope = "aula",   kind = "numeric",      label = "Matriculados / población"),
    campus         = list(scope = "aula",   kind = "flat",         label = "Sede")
  )
}

.cm_criterios_layers <- c("marco", "instrumento", "procesamiento")

# --- Normalización de la selección por categorías ----------------------------

# TRUE si la selección trae al menos una regla accionable. Sirve de sentinela de
# retro-compat: cuando es FALSE, el path legacy manda intacto.
.cm_criterios_seleccion_activa <- function(sel) {
  if (is.null(sel) || !is.list(sel)) return(FALSE)
  length(sel$byVariable %||% list()) > 0L ||
    length(sel$courseLevelRanges %||% list()) > 0L ||
    !is.null(sel$minEligible)
}

# Umbral efectivo de alumnos elegibles por curso-horario. Con la suite activa,
# `minEligible` es la autoridad; si el proyecto todavía no lo trae, conserva el
# umbral legacy como fallback. Ambos caminos evalúan la MISMA magnitud:
# aula_frame$eligible_n (nunca la matrícula administrativa enrolled_total).
.cm_criterios_min_eligible_efectivo <- function(cfg) {
  cfg <- cfg %||% list()
  filtros <- cfg$filters %||% list()
  fallback <- max(1L, .cm_aulas_int(filtros$min_eligible_per_class, 1L))
  seleccion <- .cm_criterios_normalize_seleccion(cfg$criterios_seleccion)
  if (!.cm_criterios_seleccion_activa(seleccion)) return(fallback)
  umbral <- seleccion$minEligible$threshold %||% NA_real_
  if (!is.finite(umbral)) return(fallback)
  max(1L, as.integer(round(umbral)))
}

# Clave de facultad robusta a la "ñ": en macOS iconv ASCII//TRANSLIT convierte
# "ñ" en "~n" y .cm_aulas_text_key la vuelve "_", así que "Arte y Diseño" ->
# "arte_y_dise_no" no calza con el "ARTE Y DISENO" que teclea el usuario en el
# mapa de rangos. Pre-sustituir ñ->n antes de normalizar alinea ambos lados sin
# tocar el helper compartido (que se usa en todo el motor). Igual efecto que en
# Linux (donde iconv ya hace ñ->n), por eso el matching es portable.
.cm_criterios_fac_key <- function(x) {
  .cm_aulas_text_key(gsub("[ñÑ]", "n", as.character(x %||% "")))
}

# Delimitadores de jerarquía reconocidos en "GRUPO <delim> detalle". EXIGEN
# espacios alrededor para no partir nombres legítimos: "ORDINARIO-PRINCIPAL"
# (sin espacios) NO es jerarquía. El pipe "|" queda EXCLUIDO a propósito: es el
# separador multivalor de tipos de docente por aula (ver .cm_aulas construir),
# no un delimitador de nivel. Guion/raya/barra/dos-puntos con espacios cubren
# los formatos observados ("DOCENTE ORDINARIO - PRINCIPAL", "... / ...").
.cm_criterios_teacher_hier_re <- "\\s+[-–/:]\\s+"

# Extrae el grupo (prefijo antes del delimitador de jerarquía) de un tipo de
# docente crudo y lo normaliza. "DOCENTE ORDINARIO - PRINCIPAL" ->
# "docente_ordinario". Sin separador, el valor completo es su propio grupo.
.cm_criterios_teacher_group <- function(value) {
  v <- trimws(as.character(value))
  v <- sub(paste0(.cm_criterios_teacher_hier_re, ".*$"), "", v)
  .cm_aulas_text_key(v)
}

# Etiqueta del grupo (prefijo crudo, sin normalizar) de un tipo de docente.
.cm_criterios_teacher_group_label <- function(value) {
  trimws(sub(paste0(.cm_criterios_teacher_hier_re, ".*$"), "", trimws(as.character(value))))
}

# Normaliza UN criterio (CriterioSeleccion) del contrato. Defensivo frente al
# JSON de jsonlite (listas anidadas, enteros como double). `scope`/`kind`/
# `defaultLayer` vienen del registro por id.
.cm_criterios_normalize_criterio <- function(v, meta) {
  if (is.null(v) || !is.list(v)) v <- list()
  mode <- .cm_aulas_text_key(v$mode %||% "include")
  if (!mode %in% c("include", "exclude")) mode <- "include"
  match_mode <- .cm_aulas_text_key(v$match %||% "any")
  if (!match_mode %in% c("any", "all")) match_mode <- "any"
  layer <- .cm_aulas_text_key(v$layer %||% (meta$defaultLayer %||% ""))
  if (!layer %in% .cm_criterios_layers) layer <- meta$defaultLayer %||% NA_character_
  list(
    scope = meta$scope,
    kind = meta$kind,
    mode = mode,
    match = match_mode,
    categories = .cm_aulas_text_key(.cm_aulas_chr_vec(v$categories)),
    exceptions = .cm_criterios_normalize_exceptions(v$exceptions),
    threshold = .cm_criterios_normalize_threshold(v$threshold),
    includeValues = suppressWarnings(as.numeric(.cm_aulas_chr_vec(v$includeValues))),
    fromValue = if (is.null(v$fromValue)) NA_real_ else .cm_aulas_num(v$fromValue, NA_real_),
    layer = layer
  )
}

# Excepciones por facultad: clave = facultad TAL COMO se compara (text_key en el
# punto de uso), valor = list(categories, op). op inválido degrada a "add".
.cm_criterios_normalize_exceptions <- function(x) {
  if (is.null(x) || !is.list(x) || !length(x)) return(list())
  nms <- names(x)
  if (is.null(nms)) return(list())
  out <- list()
  for (i in seq_along(x)) {
    fac <- .cm_criterios_fac_key(nms[[i]])
    if (!nzchar(fac)) next
    entry <- x[[i]]
    if (!is.list(entry)) next
    op <- .cm_aulas_text_key(entry$op %||% "add")
    if (!op %in% c("add", "replace")) op <- "add"
    out[[fac]] <- list(
      categories = .cm_aulas_text_key(.cm_aulas_chr_vec(entry$categories)),
      op = op
    )
  }
  out
}

# Umbral numérico: op >=/<=/between con min/max. Entrada inválida -> NULL.
.cm_criterios_normalize_threshold <- function(x) {
  if (is.null(x) || !is.list(x)) return(NULL)
  op <- .cm_aulas_text_key(x$op %||% "")
  op <- gsub("_", "", op)
  op <- switch(op, "gte" = ">=", "lte" = "<=", "ge" = ">=", "le" = "<=", op)
  if (!op %in% c(">=", "<=", "between")) {
    # jsonlite puede haber convertido ">=" a text_key vacío; recupera del crudo.
    raw <- .cm_aulas_scalar(x$op, "")
    if (raw %in% c(">=", "<=", "between")) op <- raw else return(NULL)
  }
  minimo <- .cm_aulas_num(x$min, NA_real_)
  maximo <- .cm_aulas_num(x$max, NA_real_)
  if (op == ">=" && !is.finite(minimo)) return(NULL)
  if (op == "<=" && !is.finite(maximo)) return(NULL)
  if (op == "between" && (!is.finite(minimo) || !is.finite(maximo))) return(NULL)
  list(op = op, min = minimo, max = maximo)
}

# Normaliza la CriteriosSeleccionMarco completa. Devuelve list() (sentinela de
# ausencia) cuando no hay nada accionable → retro-compat.
.cm_criterios_normalize_seleccion <- function(x) {
  if (is.null(x) || !is.list(x)) return(list())
  registry <- .cm_criterios_var_registry()
  by_in <- x$byVariable %||% x$por_variable %||% list()
  if (!is.list(by_in)) by_in <- list()
  by_out <- list()
  for (id in names(by_in)) {
    meta <- registry[[id]]
    if (is.null(meta)) next
    by_out[[id]] <- .cm_criterios_normalize_criterio(by_in[[id]], meta)
  }
  course_ranges <- .cm_criterios_normalize_nivel_por_unidad(x$courseLevelRanges %||% x$rangos_nivel_curso)
  min_elig <- NULL
  me <- x$minEligible %||% x$min_elegibles
  if (is.list(me) && !is.null(me$threshold)) {
    by_fac <- list()
    bf <- me$byFaculty %||% me$por_facultad
    if (is.list(bf) && length(bf)) {
      for (fac in names(bf)) {
        k <- .cm_criterios_fac_key(fac)
        if (nzchar(k)) by_fac[[k]] <- .cm_aulas_num(bf[[fac]], NA_real_)
      }
    }
    min_elig <- list(threshold = .cm_aulas_num(me$threshold, NA_real_), byFaculty = by_fac)
  }
  out <- list(byVariable = by_out, courseLevelRanges = course_ranges, minEligible = min_elig)
  if (!.cm_criterios_seleccion_activa(out)) return(list())
  out
}

# --- Defaults y normalización de config -------------------------------------

# Filtros nuevos con sus defaults. Se concatenan a los filtros históricos en
# calc_muestra_aulas_default_config(); todos nacen apagados (retro-compat).
.cm_criterios_default_filters <- function() {
  list(
    require_stable_teacher = FALSE,
    accepted_teacher_type_patterns = list("contratado", "ordinario"),
    # H7: patrones aceptados sobre la columna de formación del estudiante
    # (PREGRADO/MAESTRIA/...). Solo opera si require_undergraduate está activo
    # Y la base trae esa columna con señal; sin columna se mantiene el
    # fallback histórico por exclude_level_patterns sobre el nivel.
    accepted_formation_patterns = list("pregrado"),
    nivel_por_unidad = list(),
    accepted_campuses = list(),
    # H9: excepciones de tipo de sesión por unidad académica (unidad ->
    # patrones que se aceptan pese a exclude_session_patterns). Nace vacío.
    session_type_excepciones = list(),
    require_min_prevalence = FALSE,
    min_prevalence_pct = 0.80,
    require_cycle_homogeneity = FALSE,
    min_cycle_homogeneity_pct = 0.80
  )
}

# Porcentaje en [0, 1]; entradas no numéricas degradan al default.
.cm_criterios_pct <- function(x, default) {
  out <- .cm_aulas_num(x, default)
  min(1, max(0, out))
}

# Normaliza el mapa nivel_por_unidad: lista nombrada donde la clave es el
# nombre de la unidad académica TAL COMO aparece en la base (el match se hace
# vía .cm_aulas_text_key por ambos lados al filtrar) y el valor una lista de
# rangos list(min=, max=). Unidades sin nombre o sin ningún rango válido se
# descartan; una entrada que no sea lista nombrada degrada a list().
.cm_criterios_normalize_nivel_por_unidad <- function(x) {
  if (is.null(x) || !is.list(x) || !length(x)) return(list())
  nms <- names(x)
  if (is.null(nms)) return(list())
  out <- list()
  for (i in seq_along(x)) {
    unidad <- .cm_aulas_scalar(nms[[i]], "")
    if (!nzchar(unidad)) next
    rangos <- .cm_criterios_normalize_rangos(x[[i]])
    if (length(rangos)) out[[unidad]] <- rangos
  }
  out
}

# Normaliza los rangos de una unidad a list(list(min=int, max=int), ...).
# Defensivo por diseño: jsonlite simplificado puede entregar un data.frame
# (una fila por rango), un rango suelto {min,max} llega sin anidar, y los
# enteros del JSON llegan como double (gotcha conocido del repo) — se
# redondean. min > max se corrige con swap; entradas sin ambos extremos
# parseables se descartan.
.cm_criterios_normalize_rangos <- function(entrada) {
  if (is.null(entrada)) return(list())
  if (is.data.frame(entrada)) entrada <- .cm_aulas_records(entrada)
  if (!is.list(entrada)) return(list())
  if (!is.null(names(entrada)) && any(c("min", "max") %in% names(entrada))) {
    entrada <- list(entrada)
  }
  out <- list()
  for (r in entrada) {
    if (!is.list(r)) next
    minimo <- .cm_aulas_num(r$min, NA_real_)
    maximo <- .cm_aulas_num(r$max, NA_real_)
    if (!is.finite(minimo) || !is.finite(maximo)) next
    minimo <- as.integer(round(minimo))
    maximo <- as.integer(round(maximo))
    if (minimo > maximo) {
      tmp <- minimo
      minimo <- maximo
      maximo <- tmp
    }
    out[[length(out) + 1L]] <- list(min = minimo, max = maximo)
  }
  out
}

# Normaliza los filtros nuevos desde el input crudo (con alias en español).
# Se concatena al bloque histórico en calc_muestra_aulas_normalize_config().
# OJO: para las listas de patrones el default aplica SOLO cuando el campo
# viene ausente (NULL); una list() vacía explícita se respeta (el usuario
# limpió los patrones a propósito). No se usa %||% aquí porque la variante
# vigente en el paquete también trata length-0 como ausente.
.cm_criterios_normalize_filters <- function(filters) {
  if (is.null(filters) || !is.list(filters)) filters <- list()
  d <- .cm_criterios_default_filters()
  patrones <- filters$accepted_teacher_type_patterns
  if (is.null(patrones)) patrones <- filters$tipos_docente_aceptados
  if (is.null(patrones)) patrones <- d$accepted_teacher_type_patterns
  formaciones <- filters$accepted_formation_patterns
  if (is.null(formaciones)) formaciones <- filters$formaciones_aceptadas
  if (is.null(formaciones)) formaciones <- d$accepted_formation_patterns
  sedes <- filters$accepted_campuses
  if (is.null(sedes)) sedes <- filters$sedes_aceptadas
  if (is.null(sedes)) sedes <- d$accepted_campuses
  list(
    require_stable_teacher = .cm_aulas_bool(
      filters$require_stable_teacher %||% filters$docente_estable,
      d$require_stable_teacher
    ),
    accepted_teacher_type_patterns = as.list(.cm_aulas_chr_vec(patrones)),
    accepted_formation_patterns = as.list(.cm_aulas_chr_vec(formaciones)),
    nivel_por_unidad = .cm_criterios_normalize_nivel_por_unidad(filters$nivel_por_unidad),
    accepted_campuses = as.list(.cm_aulas_chr_vec(sedes)),
    session_type_excepciones = .cm_criterios_normalize_session_excepciones(
      filters$session_type_excepciones %||% filters$excepciones_tipo_sesion
    ),
    require_min_prevalence = .cm_aulas_bool(filters$require_min_prevalence, d$require_min_prevalence),
    min_prevalence_pct = .cm_criterios_pct(filters$min_prevalence_pct, d$min_prevalence_pct),
    require_cycle_homogeneity = .cm_aulas_bool(filters$require_cycle_homogeneity, d$require_cycle_homogeneity),
    min_cycle_homogeneity_pct = .cm_criterios_pct(filters$min_cycle_homogeneity_pct, d$min_cycle_homogeneity_pct)
  )
}

# Normaliza el mapa de excepciones de tipo de sesión por unidad (H9): lista
# nombrada donde la clave es la unidad TAL COMO aparece en la base (match por
# .cm_aulas_text_key) y el valor una lista de patrones de texto. Unidades sin
# nombre o sin ningún patrón no vacío se descartan; entradas que no son lista
# nombrada degradan a list().
.cm_criterios_normalize_session_excepciones <- function(x) {
  if (is.null(x) || !is.list(x) || !length(x)) return(list())
  nms <- names(x)
  if (is.null(nms)) return(list())
  out <- list()
  for (i in seq_along(x)) {
    unidad <- .cm_aulas_scalar(nms[[i]], "")
    if (!nzchar(unidad)) next
    patrones <- .cm_aulas_chr_vec(x[[i]])
    if (length(patrones)) out[[unidad]] <- as.list(patrones)
  }
  out
}

# H9 · Excepción de tipo de sesión por unidad académica: el método real acepta
# tipos globalmente excluidos, pero solo en unidades específicas (caso
# canónico: taller/artístico únicamente en Arte y Diseño). Revive filas ya
# excluidas por exclude_session_patterns cuya facultad calza con una unidad
# del mapa (por text_key, igual que nivel_por_unidad) y cuyo tipo matchea los
# patrones eximidos. Nunca excluye: solo exime. OJO proxy: la facultad de la
# fila es la del ESTUDIANTE (este motor no conoce la unidad que dicta el
# curso); la aproximación es la misma que usa el aula_frame (facultad modal).
.cm_criterios_session_excepciones <- function(session_ok, faculty, session_type, excepciones) {
  excepciones <- .cm_criterios_normalize_session_excepciones(excepciones)
  if (!length(excepciones) || !length(session_ok)) return(session_ok)
  fac_key <- .cm_aulas_text_key(faculty)
  unidades_key <- .cm_aulas_text_key(names(excepciones))
  for (i in seq_along(excepciones)) {
    if (!nzchar(unidades_key[[i]])) next
    idx <- !session_ok & fac_key == unidades_key[[i]]
    if (!any(idx)) next
    session_ok[idx] <- unname(.cm_aulas_contains_any(session_type[idx], excepciones[[i]]))
  }
  session_ok
}

# --- Lectura de columnas ------------------------------------------------------

# Resolución de columna SOLO por nombre o clave exacta (.cm_aulas_text_key),
# sin el matching por subcadena bidireccional de .cm_aulas_col. Para señales
# sensibles el fuzzy es peligroso (lección del H4): "nivel" ⊂ "nivel_academico"
# secuestraría el nivel del estudiante como formación, y en el catálogo "Tipo"
# ⊂ "tipo_docente" leería el tipo de sesión como tipo de docente. Los mapeos
# manuales del usuario siguen resolviendo porque el nombre de la columna viaja
# como candidato y calza por clave exacta.
.cm_criterios_col_exacta <- function(df, candidates) {
  if (!is.data.frame(df) || !ncol(df)) return("")
  candidates <- .cm_aulas_chr_vec(candidates)
  if (!length(candidates)) return("")
  nms <- names(df)
  exact <- intersect(candidates, nms)
  if (length(exact)) return(exact[[1]])
  idx <- match(.cm_aulas_text_key(candidates), .cm_aulas_text_key(nms), nomatch = 0L)
  idx <- idx[idx > 0L]
  if (length(idx)) return(nms[[idx[[1]]]])
  ""
}

# Variante de .cm_criterios_col_exacta que ignora columnas ya reclamadas por
# otros roles. Respeta el MISMO orden (nombre exacto → clave exacta) pero
# saltando las columnas de `exclude` (por clave), de modo que un candidato
# contaminado (ej. "Curso" prependido a los candidatos de course_level por un
# config viejo del .pulso) ceda al siguiente candidato legítimo ("Nivel del
# curso") en vez de secuestrar el código del curso.
.cm_criterios_col_exacta_excl <- function(df, candidates, exclude = character(0)) {
  if (!is.data.frame(df) || !ncol(df)) return("")
  candidates <- .cm_aulas_chr_vec(candidates)
  if (!length(candidates)) return("")
  exclude_key <- .cm_aulas_text_key(.cm_aulas_chr_vec(exclude))
  nms <- names(df)
  if (length(exclude_key)) nms <- nms[!(.cm_aulas_text_key(nms) %in% exclude_key)]
  if (!length(nms)) return("")
  exact <- intersect(candidates, nms)
  if (length(exact)) return(exact[[1]])
  idx <- match(.cm_aulas_text_key(candidates), .cm_aulas_text_key(nms), nomatch = 0L)
  idx <- idx[idx > 0L]
  if (length(idx)) return(nms[[idx[[1]]]])
  ""
}

# Columna del tipo de docente con guarda anti-colisión. El matcher difuso de
# .cm_aulas_col reusa subcadenas: "docente" ⊂ "tipo_docente" y "condicion" ⊂
# "condicion_docente", así que en una base SIN columna propia de tipo de
# docente el rol terminaría leyendo el nombre del docente o la condición de
# matrícula como si fueran señal (y el filtro excluiría aulas legítimas). Si
# el rol resuelve a la misma columna que teacher o condition, se declara sin
# señal. Para course_level la degradación equivalente (caer en la columna de
# nivel del estudiante) es benigna: coincide con el fallback documentado.
.cm_criterios_col_teacher_type <- function(raw, mapping) {
  # ADR 0035 (mapeo exclusivo): un rol mapeado a mano dejó de unir los defaults
  # fuzzy, entre ellos el literal "teacher_type". Pero la enriquecimiento desde
  # el catálogo escribe una columna SINTÉTICA nombrada por el ROL ("teacher_type",
  # ver .cm_aulas_fill_from_lookup en calc_muestra_aulas_catalogo.R). El nombre
  # mapeado se resuelve primero (la columna propia de la base gana si existe); si
  # no hay señal, se cae a la sintética SOLO por clave exacta (.cm_criterios_col_exacta,
  # NO fuzzy): con fuzzy, "teacher" (nombre del docente, ya enriquecido) es
  # subcadena de "teacher_type" y secuestraría el rol.
  col <- .cm_aulas_col(raw, mapping$teacher_type)
  if (!nzchar(col)) col <- .cm_criterios_col_exacta(raw, "teacher_type")
  if (!nzchar(col)) return("")
  # Match exacto por clave con un candidato propio: la columna sí es de tipo
  # de docente y se conserva aunque otro rol (teacher, por fuzzy) también la
  # haya reclamado en bases sin columna de nombre de docente.
  claves_propias <- .cm_aulas_text_key(.cm_aulas_chr_vec(mapping$teacher_type))
  if (.cm_aulas_text_key(col) %in% claves_propias) return(col)
  ocupadas <- c(.cm_aulas_col(raw, mapping$teacher), .cm_aulas_col(raw, mapping$condition))
  if (col %in% ocupadas[nzchar(ocupadas)]) return("")
  col
}

# Columna de la condición del CURSO con guarda anti-homónimo cross-hoja. En modo
# base_madre el mapping llega PLANO (rol→columna, sin hoja/source) y la base es
# la del ALUMNO (MATRICULADO). El usuario mapea condicion_curso a la columna que
# vive en el catálogo ("CURSO Y HORARIO"·"Condición"), pero como el nombre es
# homónimo con la condición del ESTUDIANTE ("MATRICULADO"·"Condición": REGULAR,
# MOVILIDAD, POR REINCORPORACION…), el resolver exacto la calza contra la MISMA
# columna base que ya reclama `condition`. El fallback del catálogo (casi vacío)
# consumiría entonces ese valor leaked como si fuera condición del curso. Si
# condicion_curso resuelve a la misma columna que condition (colisión de
# homónimo dentro de la hoja base), se declara SIN señal base: la ÚNICA fuente de
# condicion_curso pasa a ser la señal del catálogo ("CURSO Y HORARIO"·"Condición"),
# que sí es condición del curso. Sin colisión, comportamiento actual.
.cm_criterios_col_condicion_curso <- function(raw, mapping) {
  col <- .cm_criterios_col_exacta(raw, mapping$condicion_curso)
  if (!nzchar(col)) return("")
  # La colisión de homónimo es GENUINA solo si `condition` reclama la MISMA
  # columna por su MAPEO PROPIO (nombre exacto o clave exacta), NO si apenas la
  # agarró por el fuzzy de un candidato default. En una base de UNA hoja con
  # "Condición del curso" pero SIN columna de condición del alumno, el candidato
  # default `condicion` haría fuzzy-match ("condicion" ⊂ "condicion_del_curso")
  # contra la de curso y anularía una señal legítima; por eso la colisión se
  # mide con el resolver EXACTO (.cm_criterios_col_exacta), que solo calza cuando
  # condition tiene columna propia por nombre/clave exacta (los defaults no
  # matchean por clave exacta con "condicion_del_curso"). Sin colisión genuina,
  # condicion_curso conserva su columna.
  ocupada <- .cm_criterios_col_exacta(raw, mapping$condition)
  if (nzchar(ocupada) && identical(col, ocupada)) return("")
  col
}

# Variables con emptyBucket (registry) cuya COLUMNA existe en la base o el
# catálogo. El bucket sintético "Sin condición" solo se activa para estas: sin
# columna la variable ni siquiera se enumera, y el vacío no debe forzar recorte
# (graceful). La gate replica la de la enumeración (col_or: catálogo OR base).
# Hoy solo condicion_curso; sumar otra variable es una entrada aquí + emptyBucket
# en .cm_criterios_var_registry.
.cm_criterios_empty_bucket_cols <- function(raw, mapping, catalog_signals = list()) {
  cols <- (catalog_signals %||% list())$columns %||% list()
  out <- character(0)
  cc_existe <- nzchar(.cm_criterios_col_condicion_curso(raw, mapping)) ||
    nzchar(.cm_aulas_scalar(cols$condicion_curso, ""))
  if (cc_existe) out <- c(out, "condicion_curso")
  out
}

# Columna del nivel del curso con guarda anti-colisión. El matcher difuso de
# .cm_aulas_col reusa subcadenas en AMBOS sentidos: "curso" ⊂ "nivel_curso", así
# que en una base con "Curso" (CÓDIGO del curso) pero SIN columna propia de
# nivel del curso, el rol terminaría leyendo el código (rango 1..N de códigos)
# como si fuera nivel — un filtro nivel-por-unidad basado en basura. Si el rol
# resuelve exactamente a una clave propia, la columna sí es de nivel del curso y
# se conserva. Si el fuzzy cayó en la columna de código/nombre de curso
# (course_id/course_name) se declara SIN señal: el filtro nivel-por-unidad usa
# como fallback el level modal del aula (degradación documentada y benigna, no
# el código de curso). El nivel real llega por el catálogo (columna sintética
# "course_level" con nombre exacto) cuando existe.
.cm_criterios_col_course_level <- function(raw, mapping) {
  # ADR 0035: mismo respaldo que teacher_type. La sintética del catálogo se
  # nombra "course_level" (rol); si el mapeo no resuelve señal en la base, se cae
  # a esa sintética SOLO por clave exacta (evita que el fuzzy la confunda con el
  # código/nombre del curso). La guarda anti-colisión de abajo sigue vigente.
  col <- .cm_aulas_col(raw, mapping$course_level)
  if (!nzchar(col)) col <- .cm_criterios_col_exacta(raw, "course_level")
  if (!nzchar(col)) return("")
  claves_propias <- .cm_aulas_text_key(.cm_aulas_chr_vec(mapping$course_level))
  if (.cm_aulas_text_key(col) %in% claves_propias) return(col)
  ocupadas <- c(.cm_aulas_col(raw, mapping$course_id), .cm_aulas_col(raw, mapping$course_name))
  if (col %in% ocupadas[nzchar(ocupadas)]) return("")
  col
}

# Columna de nivel del curso EN EL CATÁLOGO con la misma guarda anti-colisión
# que .cm_criterios_col_course_level (base-scope), adaptada al resolver exacto
# del catálogo. El catálogo curso-horario suele traer "Curso" (CÓDIGO) y a veces
# "Nivel del curso" como columnas DISTINTAS; si el config guardado prependió
# "Curso" a los candidatos de course_level, el resolver exacto lo tomaría como
# nivel (mostraría "Nivel del curso · columna: Curso" y filtraría por el código).
# Se excluyen las columnas ya resueltas para course_id/course_name (igual que la
# guarda de base-scope) y se reintenta la resolución exacta, de modo que el rol
# caiga en la columna propia de nivel. Sin señal propia → "": el nivel real
# llega por la columna sintética del catálogo o el fallback modal del aula
# (degradación documentada y benigna, NO el código del curso).
.cm_criterios_col_course_level_catalogo <- function(catalogo, mapping) {
  candidates <- .cm_catalogo_signal_candidates(mapping, "course_level")
  ocupadas <- c(.cm_aulas_col(catalogo, mapping$course_id),
                .cm_aulas_col(catalogo, mapping$course_name))
  .cm_criterios_col_exacta_excl(catalogo, candidates, ocupadas[nzchar(ocupadas)])
}

# --- Evaluación por aula ------------------------------------------------------

# Primer número parseable de un texto de nivel ("Nivel 5", "5", "Ciclo 05");
# NA si no hay dígitos — el aula queda sin señal de nivel y pasa el filtro.
.cm_criterios_parse_nivel <- function(x) {
  x <- .cm_aulas_scalar(x, "")
  if (!nzchar(x)) return(NA_real_)
  hit <- regmatches(x, regexpr("[0-9]+", x))
  if (!length(hit) || !nzchar(hit[[1]])) return(NA_real_)
  suppressWarnings(as.numeric(hit[[1]]))
}

# Estadísticos por aula que alimentan los criterios y las columnas nuevas del
# aula_frame. Devuelve vectores alineados a las filas de aula_frame:
#   - teacher_type: valores únicos concatenados con " | " (se prefiere el
#     concatenado al modal para no perder señal en aulas con varios docentes)
#   - teacher_eval: TRUE si el aula no tiene señal de tipo de docente o si
#     >= 1 fila matchea los patrones aceptados ("al menos un docente
#     contratado u ordinario"; colapsa aulas con varios docentes)
#   - course_level_num: primer número parseable del course_level modal del
#     aula; fallback al level modal (aula_frame$level) si no hay columna o no
#     parsea
#   - campus: sede modal del aula
#   - cycle_homogeneity: sobre las filas ELEGIBLES del aula, proporción de
#     estudiantes únicos (con ciclo no vacío) en el ciclo modal; los
#     estudiantes sin ciclo no entran ni al numerador ni al denominador, y un
#     aula sin ningún ciclo queda en NA (sin señal, pasa c8).
.cm_criterios_stats_por_aula <- function(aula_frame, filas, patrones, teacher_orden = NULL) {
  n_aulas <- nrow(aula_frame)
  teacher_type <- character(n_aulas)
  teacher_type_top <- character(n_aulas)
  teacher_eval <- rep(TRUE, n_aulas)
  course_level_num <- rep(NA_real_, n_aulas)
  condicion_curso <- character(n_aulas)
  campus <- character(n_aulas)
  cycle_homogeneity <- rep(NA_real_, n_aulas)
  cc_filas <- filas$condicion_curso %||% character(0)
  # Orden efectivo de jerarquía docente (ALTO→BAJO). Vacío → default académico.
  teacher_orden <- .cm_criterios_normalize_teacher_orden(teacher_orden)
  if (!n_aulas) {
    return(list(
      teacher_type = teacher_type, teacher_type_top = teacher_type_top,
      teacher_eval = teacher_eval,
      course_level_num = course_level_num, condicion_curso = condicion_curso,
      campus = campus, cycle_homogeneity = cycle_homogeneity
    ))
  }
  idx_map <- split(seq_along(filas$classroom_id), filas$classroom_id)
  nivel_aula <- .cm_aulas_values(aula_frame, "level", "")
  cids <- .cm_aulas_values(aula_frame, "classroom_id", "")
  for (i in seq_len(n_aulas)) {
    idx_all <- idx_map[[cids[[i]]]]
    if (is.null(idx_all)) idx_all <- integer(0)

    tt <- unique(filas$teacher_type[idx_all])
    tt <- tt[nzchar(tt)]
    teacher_type[[i]] <- paste(tt, collapse = " | ")
    # teacher_type_top: SOLO etiqueta (mayor jerarquía del CH). No afecta la
    # inclusión, que sigue siendo "al menos uno" sobre el conjunto (teacher_eval).
    teacher_type_top[[i]] <- .cm_criterios_teacher_top(tt, teacher_orden)
    if (length(tt)) teacher_eval[[i]] <- any(.cm_aulas_contains_any(tt, patrones))

    num <- .cm_criterios_parse_nivel(.cm_aulas_mode(filas$course_level[idx_all], ""))
    if (is.na(num)) num <- .cm_criterios_parse_nivel(nivel_aula[[i]])
    course_level_num[[i]] <- num

    campus[[i]] <- .cm_aulas_mode(filas$campus[idx_all], "")
    if (length(cc_filas)) condicion_curso[[i]] <- .cm_aulas_mode(cc_filas[idx_all], "")

    idx_e <- idx_all[filas$eligible_row[idx_all]]
    sid_e <- filas$student_id[idx_e]
    lvl_e <- filas$level[idx_e]
    keep <- nzchar(sid_e) & nzchar(lvl_e)
    lvls <- lvl_e[keep][!duplicated(sid_e[keep])]
    if (length(lvls)) cycle_homogeneity[[i]] <- round(max(table(lvls)) / length(lvls), 4)
  }
  list(
    teacher_type = teacher_type, teacher_type_top = teacher_type_top,
    teacher_eval = teacher_eval,
    course_level_num = course_level_num, condicion_curso = condicion_curso,
    campus = campus, cycle_homogeneity = cycle_homogeneity
  )
}

# Evaluación del filtro nivel-por-unidad para cada aula: pasa si su unidad
# (aula_frame$faculty, match por .cm_aulas_text_key contra las claves del
# mapa) no tiene entrada, o si su nivel cae dentro de ALGÚN rango [min, max].
# Aula con unidad mapeada pero nivel no parseable (NA): PASA — sin señal no se
# restringe.
.cm_criterios_nivel_eval <- function(aula_frame, course_level_num, mapa_nivel) {
  n_aulas <- nrow(aula_frame)
  out <- rep(TRUE, n_aulas)
  if (!n_aulas || !length(mapa_nivel)) return(out)
  claves <- .cm_aulas_text_key(names(mapa_nivel))
  fac_key <- .cm_aulas_text_key(.cm_aulas_values(aula_frame, "faculty", ""))
  for (i in seq_len(n_aulas)) {
    hit <- which(claves == fac_key[[i]])
    if (!length(hit)) next
    num <- course_level_num[[i]]
    if (is.na(num)) next
    rangos <- mapa_nivel[[hit[[1]]]]
    out[[i]] <- any(vapply(rangos, function(r) num >= r$min && num <= r$max, logical(1)))
  }
  out
}

# Concatena razones de exclusión por aula (orden fijo, separadas por "|").
# Decisión: se acumulan TODAS las razones aplicables — un aula excluida por
# dos criterios reporta ambos, auditable a mano.
.cm_criterios_concat_razones <- function(columnas) {
  n <- length(columnas[[1]])
  if (!n) return(character(0))
  m <- do.call(cbind, columnas)
  vapply(seq_len(n), function(i) {
    fila <- m[i, ]
    paste(fila[nzchar(fila)], collapse = "|")
  }, character(1))
}

# --- Impacto medido de los opcionales ----------------------------------------

# Impacto de c7 y c8 medido SIEMPRE (estén activos o no) sobre el MARCO BASE:
# todas las reglas base aplicadas (min_eligible, docente, nivel, sede) SIN c7
# ni c8. Para cada opcional por separado reporta cuántas aulas del marco base
# sobreviven, la cobertura global recomputada con ese marco filtrado (misma
# lógica de "alcanzables" del perfil: estudiantes con >= 1 fila eligible_row
# en un aula del marco filtrado, sobre poblacion_n), qué unidades quedarían
# con 0 aulas y el umbral configurado.
calc_muestra_aulas_impacto_opcionales <- function(aula_frame,
                                                  base_ok,
                                                  evals,
                                                  aplica,
                                                  umbrales,
                                                  filas,
                                                  population) {
  cids <- .cm_aulas_values(aula_frame, "classroom_id", "")
  facs <- .cm_aulas_values(aula_frame, "faculty", "")
  poblacion_n <- if (is.data.frame(population)) nrow(population) else 0L
  pop_ids <- .cm_aulas_values(population, "student_id", "")
  marco_base <- base_ok %in% TRUE
  fac_base <- unique(facs[marco_base & nzchar(facs)])

  medir <- function(id, eval_vec, aplicado, umbral) {
    keep <- marco_base & (eval_vec %in% TRUE)
    ids_aulas <- cids[keep]
    alcanzable_fila <- filas$eligible_row & filas$classroom_id %in% ids_aulas
    alcanzables_ids <- unique(filas$student_id[alcanzable_fila & nzchar(filas$student_id)])
    alcanzables <- sum(pop_ids %in% alcanzables_ids)
    rotas <- setdiff(fac_base, unique(facs[keep & nzchar(facs)]))
    list(
      id = id,
      aplicado = isTRUE(aplicado),
      umbral = round(.cm_aulas_num(umbral, NA_real_), 4),
      aulas = as.integer(sum(keep)),
      cobertura_pct = if (poblacion_n > 0L) round(alcanzables / poblacion_n, 4) else NA_real_,
      unidades_rotas = sort(rotas)
    )
  }
  list(
    marco_base_aulas = as.integer(sum(marco_base)),
    opcionales = list(
      c7 = medir("c7", evals$c7, aplica$c7, umbrales$c7),
      c8 = medir("c8", evals$c8, aplica$c8, umbrales$c8)
    )
  )
}

# --- Orquestador --------------------------------------------------------------

# Aplica los criterios adicionales sobre el aula_frame base que construyó
# calc_muestra_aulas_construir() (donde included ya codifica
# min_eligible_per_class). Nunca "des-excluye": respeta el included entrante
# como piso y solo puede restringir más. Devuelve:
#   - aula_frame: con columnas nuevas (teacher_type, course_level_num, campus,
#     prevalence_ratio, cycle_homogeneity) e included/exclude_reason
#     actualizados (razones acumuladas con "|", orden min_eligible -> docente
#     -> nivel -> sede -> c7 -> c8)
#   - flags: df por aula con min_eligible_ok/teacher_ok/course_level_ok/
#     campus_ok/c7_ok/c8_ok (semántica "aplicado": filtro inactivo = TRUE)
#   - aplica: predicados de activación (pedido en config Y señal en la base)
#   - marco_base_aulas + opcionales: impacto medido de c7/c8 (siempre).
#
# filas: vectores por fila de la base ya leídos por construir():
#   classroom_id, student_id, level, teacher_type, course_level, campus,
#   eligible_row.
calc_muestra_aulas_aplicar_criterios <- function(aula_frame, filas, population, cfg,
                                                  catalog_signals = list(),
                                                  empty_bucket_cols = character(0)) {
  filtros <- (cfg %||% list())$filters
  if (!is.list(filtros)) filtros <- list()
  n_aulas <- if (is.data.frame(aula_frame)) nrow(aula_frame) else 0L
  seleccion <- .cm_criterios_normalize_seleccion((cfg %||% list())$criterios_seleccion)
  suite_activa <- .cm_criterios_seleccion_activa(seleccion)

  patrones <- .cm_aulas_chr_vec(filtros$accepted_teacher_type_patterns)
  mapa_nivel <- .cm_criterios_normalize_nivel_por_unidad(filtros$nivel_por_unidad)
  sedes <- .cm_aulas_chr_vec(filtros$accepted_campuses)
  pct7 <- .cm_criterios_pct(filtros$min_prevalence_pct, 0.80)
  pct8 <- .cm_criterios_pct(filtros$min_cycle_homogeneity_pct, 0.80)

  # Predicados de activación: pedido en config Y señal en la base. Para nivel
  # cuenta también la señal del fallback (level del aula); para c7 la señal se
  # resuelve por aula (ratio NA pasa), así que basta con el pedido en config.
  # Con suite activa, docente/nivel/sede quedan neutralizados: la selección por
  # categorías es la autoridad única de las dimensiones de aula que cubre.
  aplica <- list(
    docente = !suite_activa && isTRUE(filtros$require_stable_teacher) && length(patrones) > 0L &&
      any(nzchar(filas$teacher_type)),
    nivel = !suite_activa && length(mapa_nivel) > 0L &&
      (any(nzchar(filas$course_level)) || any(nzchar(.cm_aulas_values(aula_frame, "level", "")))),
    sede = !suite_activa && length(sedes) > 0L && any(nzchar(filas$campus)),
    c7 = isTRUE(filtros$require_min_prevalence),
    c8 = isTRUE(filtros$require_cycle_homogeneity) && any(nzchar(filas$level))
  )

  # Orden de jerarquía docente para la etiqueta teacher_type_top (configurable;
  # NULL/vacío → default académico). No participa de ningún gate de inclusión.
  teacher_orden <- .cm_criterios_normalize_teacher_orden((cfg %||% list())$teacher_type_orden)
  stats <- .cm_criterios_stats_por_aula(aula_frame, filas, patrones, teacher_orden)
  ratio <- .cm_aulas_num_values(aula_frame, "eligible_ratio", NA_real_)

  # Evaluaciones "puras" por aula (sin importar activación): sin señal pasa.
  evals <- list(
    teacher = stats$teacher_eval,
    nivel = .cm_criterios_nivel_eval(aula_frame, stats$course_level_num, mapa_nivel),
    campus = if (length(sedes)) {
      !nzchar(stats$campus) | unname(.cm_aulas_contains_any(stats$campus, sedes))
    } else {
      rep(TRUE, n_aulas)
    },
    c7 = is.na(ratio) | ratio >= pct7,
    c8 = is.na(stats$cycle_homogeneity) | stats$cycle_homogeneity >= pct8
  )

  # Flags "aplicados": filtro inactivo no restringe. El included entrante es
  # el piso (hoy codifica solo min_eligible_per_class).
  incluida_base <- if (n_aulas) aula_frame$included %in% TRUE else logical(0)
  flags <- data.frame(
    classroom_id = .cm_aulas_values(aula_frame, "classroom_id", ""),
    min_eligible_ok = incluida_base,
    teacher_ok = if (aplica$docente) evals$teacher else rep(TRUE, n_aulas),
    course_level_ok = if (aplica$nivel) evals$nivel else rep(TRUE, n_aulas),
    campus_ok = if (aplica$sede) evals$campus else rep(TRUE, n_aulas),
    c7_ok = if (aplica$c7) evals$c7 else rep(TRUE, n_aulas),
    c8_ok = if (aplica$c8) evals$c8 else rep(TRUE, n_aulas),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  # Columnas informativas nuevas del aula_frame (siempre presentes).
  aula_frame$teacher_type <- stats$teacher_type
  # Etiqueta de mayor jerarquía docente del CH (ADR 0035): fluye a Selección/
  # Entrega como campo/catálogo, sin tocar la inclusión al-menos-uno.
  aula_frame$teacher_type_top <- stats$teacher_type_top
  aula_frame$course_level_num <- stats$course_level_num
  aula_frame$condicion_curso <- stats$condicion_curso
  aula_frame$campus <- stats$campus
  aula_frame$prevalence_ratio <- ratio
  aula_frame$cycle_homogeneity <- stats$cycle_homogeneity

  if (n_aulas) {
    razon_base <- .cm_aulas_values(aula_frame, "exclude_reason", "")
    # El aula_frame base solo excluye por min_eligible; si trajera otra razón
    # se conserva textual en lugar de re-etiquetarla.
    razon_base[!flags$min_eligible_ok & !nzchar(razon_base)] <- "min_eligible_per_class"
    aula_frame$included <- flags$min_eligible_ok & flags$teacher_ok &
      flags$course_level_ok & flags$campus_ok & flags$c7_ok & flags$c8_ok
    aula_frame$exclude_reason <- .cm_criterios_concat_razones(list(
      ifelse(flags$min_eligible_ok, "", razon_base),
      ifelse(flags$teacher_ok, "", "teacher_type"),
      ifelse(flags$course_level_ok, "", "course_level"),
      ifelse(flags$campus_ok, "", "campus"),
      ifelse(flags$c7_ok, "", "c7_prevalencia"),
      ifelse(flags$c8_ok, "", "c8_homogeneidad")
    ))
  }

  base_ok <- flags$min_eligible_ok & flags$teacher_ok & flags$course_level_ok & flags$campus_ok
  impacto <- calc_muestra_aulas_impacto_opcionales(
    aula_frame = aula_frame,
    base_ok = base_ok,
    evals = list(c7 = evals$c7, c8 = evals$c8),
    aplica = list(c7 = aplica$c7, c8 = aplica$c8),
    umbrales = list(c7 = pct7, c8 = pct8),
    filas = filas,
    population = population
  )

  # Gate autoritativo de la selección por categorías (scope aula). Los únicos
  # gates adicionales que pueden coexistir con la suite son c7/c8 y el umbral
  # efectivo de elegibles. Sin selección activa no toca nada: retro-compat.
  seleccion_aula <- NULL
  if (n_aulas && suite_activa) {
    seleccion_aula <- .cm_criterios_evaluar_aula(
      aula_frame, catalog_signals, seleccion, stats$course_level_num,
      min_eligible_fallback = .cm_criterios_min_eligible_efectivo(cfg),
      empty_bucket_cols = empty_bucket_cols
    )
    if (any(!seleccion_aula$ok)) {
      aula_frame$included <- aula_frame$included %in% TRUE & seleccion_aula$ok
      aula_frame$exclude_reason <- .cm_criterios_concat_razones(list(
        aula_frame$exclude_reason,
        ifelse(seleccion_aula$ok, "", seleccion_aula$reason)
      ))
    }
  }

  list(
    aula_frame = aula_frame,
    flags = flags,
    aplica = aplica,
    marco_base_aulas = impacto$marco_base_aulas,
    opcionales = impacto$opcionales,
    seleccion_aula = seleccion_aula
  )
}

# =============================================================================
# Evaluación de la selección por categorías
# =============================================================================

.cm_criterios_num_vec <- function(x) {
  vapply(seq_along(x), function(i) .cm_criterios_parse_nivel(x[[i]]), numeric(1))
}

# Valores CONSTANTES por aula para el scope aula: catálogo autoritativo (fix del
# −281) con fallback a las columnas modales de la base cuando no hay catálogo.
.cm_criterios_valores_aula <- function(aula_frame, catalog_signals, base_course_level_num) {
  n <- nrow(aula_frame)
  afk <- .cm_aulas_text_key(.cm_aulas_values(aula_frame, "classroom_id", ""))
  sig <- if (is.list(catalog_signals)) catalog_signals else list()
  pick_chr <- function(name, base_col) {
    m <- sig[[name]]
    v <- if (length(m)) unname(m[afk]) else rep(NA_character_, n)
    v[is.na(v)] <- ""
    ifelse(nzchar(v), v, .cm_aulas_values(aula_frame, base_col, ""))
  }
  pick_num <- function(name, base_vec) {
    m <- sig[[name]]
    v <- if (length(m)) unname(m[afk]) else rep(NA_real_, n)
    ifelse(is.finite(v), v, base_vec)
  }
  teacher <- {
    m <- sig[["teacher_set"]]
    v <- if (length(m)) unname(m[afk]) else rep(NA_character_, n)
    v[is.na(v)] <- ""
    ifelse(nzchar(v), v, .cm_aulas_values(aula_frame, "teacher_type", ""))
  }
  base_cl <- if (length(base_course_level_num) == n) base_course_level_num else rep(NA_real_, n)
  faculty <- pick_chr("faculty_curso", "faculty")
  course_level <- pick_num("course_level", base_cl)
  # SET de pares (facultad del curso, nivel) por aula para la regla canónica
  # "cualquier par" de nivel. Del catálogo cuando existe; fallback al par modal
  # (facultad/nivel resueltos arriba) cuando no hay catálogo o el aula no calzó.
  pairs_sig <- sig[["course_faculty_level_pairs"]]
  course_pairs <- if (length(pairs_sig)) unname(pairs_sig[afk]) else rep(NA_character_, n)
  fallback_pair <- paste0(faculty, .cm_catalogo_pair_fld, ifelse(is.finite(course_level), course_level, ""))
  course_pairs <- ifelse(is.na(course_pairs) | !nzchar(course_pairs), fallback_pair, course_pairs)
  list(
    modality = pick_chr("modality", "modality"),
    session_type = pick_chr("session_type", "session_type"),
    teacher = teacher,
    course_level = course_level,
    course_pairs = course_pairs,
    enrolled_total = pick_num("enrolled_total", .cm_aulas_num_values(aula_frame, "enrolled_total", NA_real_)),
    eligible_n = .cm_aulas_num_values(aula_frame, "eligible_n", 0),
    faculty = faculty,
    condicion_curso = pick_chr("condicion_curso", "condicion_curso"),
    campus = pick_chr("campus", "campus")
  )
}

.cm_criterios_label_value <- function(x) {
  x <- gsub("_", " ", as.character(x %||% ""), fixed = TRUE)
  x <- trimws(gsub("\\s+", " ", x))
  if (!nzchar(x)) return("")
  paste0(toupper(substr(x, 1L, 1L)), substr(x, 2L, nchar(x)))
}

.cm_criterios_label_set <- function(meta, crit) {
  cats <- .cm_aulas_chr_vec(crit$categories)
  valores <- vapply(cats, .cm_criterios_label_value, character(1))
  valores <- valores[nzchar(valores)]
  resumen <- if (!length(valores)) {
    if (identical(crit$mode, "exclude")) "Sin exclusiones" else "Todas"
  } else if (length(valores) <= 2L) {
    paste(valores, collapse = " y ")
  } else {
    sprintf("%s categorías", length(valores))
  }
  if (identical(crit$mode, "exclude") && length(valores)) resumen <- paste("Excluye", resumen)
  sprintf("%s · %s", meta$label, resumen)
}

.cm_criterios_label_numeric <- function(meta, threshold) {
  if (is.null(threshold)) return(sprintf("%s · Sin filtro", meta$label))
  fmt <- function(x) format(.cm_aulas_num(x, 0), trim = TRUE, scientific = FALSE)
  detalle <- switch(threshold$op,
    ">=" = paste0("≥ ", fmt(threshold$min)),
    "<=" = paste0("≤ ", fmt(threshold$max)),
    "between" = paste0(fmt(threshold$min), "–", fmt(threshold$max)),
    "Sin filtro"
  )
  sprintf("%s · %s", meta$label, detalle)
}

.cm_criterios_label_course_level <- function(ranges, meta) {
  piezas <- unlist(lapply(names(ranges), function(fac) {
    vapply(ranges[[fac]], function(r) sprintf("%s: %s–%s", fac, r$min, r$max), character(1))
  }), use.names = FALSE)
  if (!length(piezas)) return(sprintf("%s · Sin rango", meta$label))
  detalle <- if (length(piezas) <= 2L) paste(piezas, collapse = "; ") else sprintf("%s unidades con rango", length(ranges))
  sprintf("%s · %s", meta$label, detalle)
}

.cm_criterios_label_min_eligible <- function(min_elig) {
  fmt <- function(x) format(.cm_aulas_num(x, 0), trim = TRUE, scientific = FALSE)
  general <- fmt(min_elig$threshold)
  por_facultad <- min_elig$byFaculty %||% list()
  if (!length(por_facultad)) return(sprintf("Con %s o más alumnos elegibles", general))

  valores <- suppressWarnings(as.numeric(unlist(por_facultad, use.names = FALSE)))
  nombres <- names(por_facultad)
  validos <- is.finite(valores) & nzchar(nombres)
  valores <- valores[validos]
  nombres <- nombres[validos]
  if (!length(valores)) return(sprintf("Con %s o más alumnos elegibles", general))

  detalle <- if (length(valores) <= 2L) {
    etiquetas <- vapply(nombres, .cm_criterios_label_value, character(1))
    umbrales <- vapply(valores, fmt, character(1))
    paste(sprintf("%s ≥ %s", etiquetas, umbrales), collapse = "; ")
  } else {
    sprintf("%s excepciones por facultad · %s–%s", length(valores), fmt(min(valores)), fmt(max(valores)))
  }
  sprintf("Elegibles · general ≥ %s; %s", general, detalle)
}

# Una entrada serializada no siempre representa un filtro. Los numéricos sin
# umbral y los sets sin categorías (ni excepciones con categorías) son no-op en
# el evaluador; por tanto tampoco deben crear un paso visual que sugiera un
# recorte inexistente.
.cm_criterios_regla_aula_accionable <- function(crit) {
  if (identical(crit$kind, "numeric")) return(!is.null(crit$threshold))
  if (!(crit$kind %in% c("flat", "hierarchical"))) return(TRUE)
  if (length(.cm_aulas_chr_vec(crit$categories))) return(TRUE)
  excepciones <- crit$exceptions %||% list()
  any(vapply(excepciones, function(x) length(.cm_aulas_chr_vec(x$categories)) > 0L, logical(1)))
}

# Set efectivo de categorías para una facultad: base + excepción (add|replace).
.cm_criterios_eff_cats <- function(crit, faculty_key) {
  cats <- crit$categories
  ex <- crit$exceptions[[faculty_key]]
  if (!is.null(ex)) {
    if (identical(ex$op, "replace")) cats <- ex$categories
    else cats <- unique(c(cats, ex$categories))
  }
  cats
}

# Flat (include/exclude por set, con excepción por facultad). Sin señal (valor
# vacío) o sin set efectivo → pasa. Match por text_key, NUNCA substring.
#
# empty_key (hoy solo condicion_curso → "sin_condicion", ver registry): cuando
# se define, el valor VACÍO deja de pasar incondicionalmente y se comporta como
# una categoría más ("Sin condición"). Así, si la selección incluye
# "sin_condicion" las aulas sin valor PASAN; si no la incluye, se EXCLUYEN —
# simétrico con las categorías reales. No es un renombrado de un valor real
# (ADR 0035 §5): es un bucket para la AUSENCIA de valor. Sin empty_key el vacío
# sigue pasando (retro-compat para modality/session_type y el scope alumno).
.cm_criterios_eval_flat_vec <- function(values, crit, faculty_keys, empty_key = NULL) {
  vk <- .cm_aulas_text_key(values)
  if (!is.null(empty_key) && nzchar(empty_key)) vk[!nzchar(vk)] <- empty_key
  vapply(seq_along(vk), function(i) {
    if (!nzchar(vk[[i]])) return(TRUE)
    cats <- .cm_criterios_eff_cats(crit, faculty_keys[[i]])
    if (!length(cats)) return(TRUE)
    inset <- vk[[i]] %in% cats
    if (identical(crit$mode, "exclude")) !inset else inset
  }, logical(1))
}

# Jerárquico (tipo de docente): el aula pasa si ≥1 de sus docentes cae en algún
# grupo del set (match "any") o si todos los grupos del set están presentes
# ("all"). El grupo es el prefijo antes de " - ".
#
# Aula SIN señal de docente: a diferencia del resto de criterios, un INCLUDE de
# docente NO pasa sin señal. "Tiene ≥1 docente del grupo X" es una afirmación de
# PERTENENCIA que no puede confirmarse sin datos de docente (equivale a `any()`
# sobre el conjunto vacío = FALSE); dejarla pasar metía al marco aulas sin
# docente conocido (leak canónico de 101 aulas). En modo exclude sí pasa (no se
# puede confirmar que caiga en el set excluido → no se restringe).
.cm_criterios_eval_teacher <- function(teacher_values, crit, faculty_keys) {
  vapply(seq_along(teacher_values), function(i) {
    tv <- teacher_values[[i]]
    if (!nzchar(tv)) return(identical(crit$mode, "exclude"))
    ecats <- .cm_criterios_eff_cats(crit, faculty_keys[[i]])
    if (!length(ecats)) return(TRUE)
    piezas <- strsplit(tv, "\\s*\\|+\\s*")[[1]]
    # La UI jerárquica deja marcar un GRUPO entero ("docente_ordinario") o hijos
    # concretos ("docente_ordinario_principal"). El valor del aula es siempre un
    # child (y su grupo), y el catálogo/selección canónica guardan la clave
    # CHILD (.cm_aulas_text_key del valor completo). Derivamos de cada pieza
    # AMBAS claves (grupo y child) para que el match funcione con la selección
    # sea cual sea el nivel que el usuario marcó; comparar solo por grupo
    # excluía todos los CH cuando la selección venía a nivel child.
    claves <- unique(c(
      vapply(piezas, .cm_criterios_teacher_group, character(1)),  # grupo
      vapply(piezas, .cm_aulas_text_key, character(1))            # child (valor completo)
    ))
    claves <- claves[nzchar(claves)]
    hit <- if (identical(crit$match, "all")) all(ecats %in% claves) else any(claves %in% ecats)
    if (identical(crit$mode, "exclude")) !hit else hit
  }, logical(1))
}

# Numérico (umbral >=/<=/between). NA → sin señal, pasa.
.cm_criterios_eval_numeric <- function(nums, threshold) {
  if (is.null(threshold)) return(rep(TRUE, length(nums)))
  vapply(seq_along(nums), function(i) {
    x <- nums[[i]]
    if (!is.finite(x)) return(TRUE)
    switch(threshold$op,
      ">=" = x >= threshold$min,
      "<=" = x <= threshold$max,
      "between" = x >= threshold$min && x <= threshold$max,
      TRUE)
  }, logical(1))
}

# Ordinal (set de valores o "desde N"). NA → pasa.
.cm_criterios_eval_ordinal <- function(nums, crit) {
  vals <- crit$includeValues
  vals <- vals[is.finite(vals)]
  from <- crit$fromValue
  has_set <- length(vals) > 0L
  has_from <- is.finite(from)
  if (!has_set && !has_from) return(rep(TRUE, length(nums)))
  vapply(seq_along(nums), function(i) {
    x <- nums[[i]]
    if (!is.finite(x)) return(TRUE)
    inc <- (has_set && x %in% vals) || (has_from && x >= from)
    if (identical(crit$mode, "exclude")) !inc else inc
  }, logical(1))
}

# Nivel del curso por rangos de facultad — regla canónica "CUALQUIER PAR"
# (§3ter). Un curso-horario le cuenta a varias carreras/facultades en distinto
# ciclo (1609/5262 aulas sirven a ≥2), así que el aula pasa si ALGUNA de sus
# (facultad del curso, nivel) cae en el rango de esa facultad. Reglas:
#   - facultad AUSENTE del mapa NO aporta (el mapa es la whitelist de unidades
#     objetivo: Consorcio/Estudios Especiales/Posgrado quedan fuera);
#   - un par pasa SOLO con nivel PARSEABLE dentro del rango; un par cuyo nivel
#     no se puede leer NO aporta (no se puede confirmar que el curso esté en el
#     nivel objetivo → no acredita al aula). El aula se EXCLUYE si ningún par
#     (facultad mapeada, nivel en rango) existe.
# Nota canónica: la comparación de facultad usa .cm_criterios_fac_key, robusta a
# la ñ Y a los apóstrofes que iconv/ASCII//TRANSLIT mete en macOS (ÉNICAS →
# 'ENICAS); sin esa limpieza las 5 facultades acentuadas (Escénicas, Psicología,
# Gestión, Comunicación, Gastronomía) caerían como "no mapeadas" — ese fue el
# leak que hacía cuadrar un embudo con acentos rotos y nivel-NA permisivo.
# `course_pairs` es el SET de pares por aula ("FAC<US>NIV<RS>FAC<US>NIV") que
# emite el catálogo; sin catálogo trae el par modal único (retro de la regla).
.cm_criterios_eval_course_ranges <- function(course_pairs, ranges) {
  n <- length(course_pairs)
  if (!length(ranges)) return(rep(TRUE, n))
  claves <- .cm_criterios_fac_key(names(ranges))
  vapply(seq_len(n), function(i) {
    pares <- strsplit(course_pairs[[i]], .cm_catalogo_pair_rec, fixed = TRUE)[[1]]
    for (p in pares) {
      kv <- strsplit(p, .cm_catalogo_pair_fld, fixed = TRUE)[[1]]
      fac <- .cm_criterios_fac_key(kv[[1]])
      hit <- which(claves == fac)
      if (!length(hit)) next
      nivel <- .cm_criterios_parse_nivel(if (length(kv) >= 2L) kv[[2]] else "")
      if (!is.finite(nivel)) next
      rr <- ranges[[hit[[1]]]]
      if (any(vapply(rr, function(r) nivel >= r$min && nivel <= r$max, logical(1)))) return(TRUE)
    }
    FALSE
  }, logical(1))
}

# Umbral de matriculados/población por aula con override por facultad.
.cm_criterios_eval_min_eligible <- function(enrolled, faculty_keys, min_elig) {
  thr <- min_elig$threshold
  by <- min_elig$byFaculty %||% list()
  vapply(seq_along(enrolled), function(i) {
    x <- enrolled[[i]]
    if (!is.finite(x)) return(TRUE)
    t <- thr
    fk <- faculty_keys[[i]]
    if (!is.null(by[[fk]]) && is.finite(by[[fk]])) t <- by[[fk]]
    if (!is.finite(t)) return(TRUE)
    x >= t
  }, logical(1))
}

# Orquesta el gate scope-aula: itera las variables aula de byVariable +
# courseLevelRanges + minEligible, acumula flags y razones por aula.
# empty_bucket_cols: ids de variable con emptyBucket cuya COLUMNA existe en la
# base/catálogo (calculado por construir, consistente con la gate de la
# enumeración). Solo para esos ids el valor vacío se remapea al bucket sintético
# ("sin_condicion"); si la columna no existe (base sin la variable) el vacío
# sigue pasando — graceful, el criterio no fuerza recorte.
.cm_criterios_evaluar_aula <- function(aula_frame, catalog_signals, seleccion, base_course_level_num,
                                       min_eligible_fallback = 1L, empty_bucket_cols = character(0)) {
  n <- nrow(aula_frame)
  vals <- .cm_criterios_valores_aula(aula_frame, catalog_signals, base_course_level_num)
  fac_keys <- .cm_criterios_fac_key(vals$faculty)
  ok <- rep(TRUE, n)
  reason_cols <- list()
  pasos <- list()
  add <- function(id, flag, reason, label) {
    reason_cols[[length(reason_cols) + 1L]] <<- ifelse(flag, "", reason)
    ok <<- ok & flag
    pasos[[length(pasos) + 1L]] <<- list(id = id, label = label, flag = flag)
  }
  registry <- .cm_criterios_var_registry()
  by <- seleccion$byVariable %||% list()
  orden <- c("modality", "session_type", "teacher_type", "course_level", "condicion_curso", "enrolled_total", "campus")
  for (id in orden) {
    if (identical(id, "course_level")) {
      if (length(seleccion$courseLevelRanges)) {
        add(
          "course_level",
          .cm_criterios_eval_course_ranges(vals$course_pairs, seleccion$courseLevelRanges),
          "course_level",
          .cm_criterios_label_course_level(seleccion$courseLevelRanges, registry$course_level)
        )
      }
      next
    }
    if (is.null(by[[id]])) next
    crit <- by[[id]]
    if (!identical(crit$scope, "aula")) next
    if (!.cm_criterios_regla_aula_accionable(crit)) next
    empty_key <- if (id %in% empty_bucket_cols) registry[[id]]$emptyBucket$key else NULL
    flag <- switch(crit$kind,
      flat = .cm_criterios_eval_flat_vec(vals[[id]] %||% rep("", n), crit, fac_keys,
                                         empty_key = empty_key),
      hierarchical = .cm_criterios_eval_teacher(vals$teacher, crit, fac_keys),
      numeric = .cm_criterios_eval_numeric(vals[[id]] %||% rep(NA_real_, n), crit$threshold),
      rep(TRUE, n))
    label <- if (identical(crit$kind, "numeric")) {
      .cm_criterios_label_numeric(registry[[id]], crit$threshold)
    } else {
      .cm_criterios_label_set(registry[[id]], crit)
    }
    add(id, flag, id, label)
  }
  min_elig <- seleccion$minEligible
  if (is.null(min_elig) || !is.finite(min_elig$threshold)) {
    min_elig <- list(threshold = max(1L, .cm_aulas_int(min_eligible_fallback, 1L)), byFaculty = list())
  }
  add(
    "minEligible",
    .cm_criterios_eval_min_eligible(vals$eligible_n, fac_keys, min_elig),
    "min_eligible",
    .cm_criterios_label_min_eligible(min_elig)
  )
  reason <- if (length(reason_cols)) .cm_criterios_concat_razones(reason_cols) else rep("", n)
  list(ok = ok, reason = reason, valores = vals, pasos = pasos)
}

# Evaluación del scope ALUMNO: reconstruye la población objetivo. Los criterios
# con capa "marco" reducen N (marco_ok); "instrumento"/"procesamiento" NO
# reducen el marco, solo se reportan (se validan en campo/post-campo). Sin
# selección activa marco_ok es todo TRUE → retro-compat. La lógica de capa
# generaliza el "ciclo 1 → instrumento" de HST como una ELECCIÓN, no una regla.
calc_muestra_aulas_criterios_alumno <- function(criterios_seleccion, filas) {
  n <- length(filas$student_id %||% character(0))
  marco_ok <- rep(TRUE, n)
  seleccion <- .cm_criterios_normalize_seleccion(criterios_seleccion)
  report <- list(activa = FALSE, criterios = list())
  if (!n || !.cm_criterios_seleccion_activa(seleccion)) {
    return(list(marco_ok = marco_ok, report = report))
  }
  fac_keys <- .cm_criterios_fac_key(filas$faculty %||% rep("", n))
  by <- seleccion$byVariable %||% list()
  algun_alumno <- FALSE
  for (id in names(by)) {
    crit <- by[[id]]
    if (!identical(crit$scope, "alumno")) next
    algun_alumno <- TRUE
    flag <- switch(crit$kind,
      flat = .cm_criterios_eval_flat_vec(filas[[id]] %||% rep("", n), crit, fac_keys),
      numeric = .cm_criterios_eval_numeric(.cm_criterios_num_vec(filas[[id]] %||% rep("", n)), crit$threshold),
      ordinal = .cm_criterios_eval_ordinal(.cm_criterios_num_vec(filas[[id]] %||% rep("", n)), crit),
      rep(TRUE, n))
    layer <- crit$layer %||% "marco"
    report$criterios[[id]] <- list(layer = layer, filas_pasan = as.integer(sum(flag)))
    if (identical(layer, "marco")) marco_ok <- marco_ok & flag
  }
  report$activa <- algun_alumno
  list(marco_ok = marco_ok, report = report)
}

# =============================================================================
# Enumeración: criterios_catalogo (ambos scopes, dirigido por el mapeo)
# =============================================================================

.cm_criterios_mapped <- function(col) if (nzchar(col %||% "")) col else NULL

# Constructor de una variable flat: categorías normalizadas con conteo por
# unidad (aula o alumno único) y variantes crudas plegadas.
#
# Bucket sintético "Sin condición" (meta$emptyBucket, hoy solo condicion_curso):
# las unidades con valor AUSENTE se cuentan como una categoría explícita
# seleccionable, con clave estable ("sin_condicion") y label fijo, en vez de
# descartarse. Se emite SOLO si la columna EXISTE (mapped_col resuelto) y hay al
# menos una unidad vacía; sin columna (base sin la variable) no se inventa un
# bucket fantasma. Los valores REALES conservan su etiqueta cruda (ADR 0035 §5):
# el bucket es para la AUSENCIA de valor, NO un renombrado de un valor real.
.cm_criterios_enum_flat <- function(id, meta, values, mapped_col, scope) {
  values <- trimws(as.character(values %||% character(0)))
  n_empty <- sum(!nzchar(values))
  values <- values[nzchar(values)]
  bucket <- meta$emptyBucket
  emit_bucket <- !is.null(bucket) && nzchar(mapped_col %||% "") && n_empty > 0L
  if (!length(values) && !emit_bucket) return(NULL)
  keys <- .cm_aulas_text_key(values)
  cats <- list()
  for (k in unique(keys[nzchar(keys)])) {
    idx <- which(keys == k)
    variantes <- unique(values[idx])
    label <- names(sort(table(values[idx]), decreasing = TRUE))[[1]]
    cats[[length(cats) + 1L]] <- list(key = k, label = label,
                                      aulas = length(idx), variants = as.list(variantes))
  }
  cats <- cats[order(-vapply(cats, function(c) c$aulas, integer(1)))]
  if (emit_bucket) {
    # Va al FINAL (tras ordenar por conteo) para que las categorías reales
    # encabecen; es sintético, sin variantes crudas, marcado con synthetic=TRUE.
    cats[[length(cats) + 1L]] <- list(key = bucket$key, label = bucket$label,
                                      aulas = n_empty, variants = list(), synthetic = TRUE)
  }
  out <- list(id = id, scope = scope, label = meta$label, kind = "flat",
              mappedColumn = .cm_criterios_mapped(mapped_col), categories = cats)
  if (scope == "alumno") out$defaultLayer <- meta$defaultLayer %||% NULL
  if (isTRUE(meta$estratifica)) out$estratifica <- TRUE
  out
}

.cm_criterios_enum_numeric <- function(id, meta, nums, mapped_col, scope) {
  nums <- nums[is.finite(nums)]
  if (!length(nums)) return(NULL)
  out <- list(id = id, scope = scope, label = meta$label, kind = "numeric",
              mappedColumn = .cm_criterios_mapped(mapped_col),
              numericRange = list(min = min(nums), max = max(nums)))
  if (scope == "alumno") out$defaultLayer <- meta$defaultLayer %||% NULL
  out
}

.cm_criterios_enum_valores <- function(id, meta, nums, mapped_col, scope, kind) {
  nums <- sort(unique(nums[is.finite(nums)]))
  if (!length(nums)) return(NULL)
  out <- list(id = id, scope = scope, label = meta$label, kind = kind,
              mappedColumn = .cm_criterios_mapped(mapped_col), values = as.list(nums))
  if (scope == "alumno") out$defaultLayer <- meta$defaultLayer %||% NULL
  out
}

# Jerárquico (tipo de docente): grupos por prefijo "GRUPO - detalle", conteo de
# aulas por grupo y por hijo (un aula cuenta una vez por grupo/hijo presente).
# Si NINGÚN grupo llega a ≥2 hijos, la jerarquía sería degenerada (cada valor su
# propio grupo con un único hijo idéntico, que el frontend pinta como un nivel
# ficticio); en ese caso colapsa a lista PLANA de categorías. Solo se mantiene
# "hierarchical" cuando existe una jerarquía real (varios detalles compartiendo
# prefijo).
.cm_criterios_enum_teacher <- function(meta, teacher_sets, mapped_col) {
  sets <- teacher_sets[nzchar(teacher_sets)]
  if (!length(sets)) return(NULL)
  groups <- list()
  for (s in sets) {
    piezas <- unique(trimws(strsplit(s, "\\s*\\|+\\s*")[[1]]))
    piezas <- piezas[nzchar(piezas)]
    g_seen <- character(0)
    c_seen <- character(0)
    for (v in piezas) {
      gk <- .cm_criterios_teacher_group(v)
      if (!nzchar(gk)) next
      ck <- .cm_aulas_text_key(v)
      glabel <- .cm_criterios_teacher_group_label(v)
      if (is.null(groups[[gk]])) groups[[gk]] <- list(label = glabel, aulas = 0L, children = list())
      if (!gk %in% g_seen) { groups[[gk]]$aulas <- groups[[gk]]$aulas + 1L; g_seen <- c(g_seen, gk) }
      if (is.null(groups[[gk]]$children[[ck]])) groups[[gk]]$children[[ck]] <- list(label = v, aulas = 0L)
      if (!ck %in% c_seen) {
        groups[[gk]]$children[[ck]]$aulas <- groups[[gk]]$children[[ck]]$aulas + 1L
        c_seen <- c(c_seen, ck)
      }
    }
  }
  if (!length(groups)) return(NULL)
  # Jerarquía real = al menos un grupo con ≥2 hijos distintos. Sin ella, la
  # variable es una lista plana (el label crudo del valor es la categoría).
  hay_jerarquia <- any(vapply(groups, function(g) length(g$children) >= 2L, logical(1)))
  if (!hay_jerarquia) return(.cm_criterios_enum_teacher_flat(meta, groups, mapped_col))
  out_groups <- lapply(names(groups), function(gk) {
    g <- groups[[gk]]
    children <- lapply(names(g$children), function(ck) {
      list(key = ck, label = g$children[[ck]]$label, aulas = g$children[[ck]]$aulas)
    })
    children <- children[order(-vapply(children, function(c) c$aulas, integer(1)))]
    list(key = gk, label = g$label, aulas = g$aulas, children = children)
  })
  out_groups <- out_groups[order(-vapply(out_groups, function(g) g$aulas, integer(1)))]
  list(id = "teacher_type", scope = "aula", label = meta$label, kind = "hierarchical",
       mappedColumn = .cm_criterios_mapped(mapped_col), groups = out_groups)
}

# Colapso a lista plana del tipo de docente cuando no hay jerarquía real: cada
# hijo (== su propio grupo) se vuelve una categoría con su conteo de aulas. Emite
# el MISMO shape que .cm_criterios_enum_flat para que el frontend lo pinte como
# categorías simples, sin niveles ficticios.
.cm_criterios_enum_teacher_flat <- function(meta, groups, mapped_col) {
  cats <- list()
  for (gk in names(groups)) {
    hijos <- groups[[gk]]$children
    for (ck in names(hijos)) {
      cats[[length(cats) + 1L]] <- list(
        key = ck, label = hijos[[ck]]$label, aulas = hijos[[ck]]$aulas,
        variants = list(hijos[[ck]]$label)
      )
    }
  }
  cats <- cats[order(-vapply(cats, function(c) c$aulas, integer(1)))]
  list(id = "teacher_type", scope = "aula", label = meta$label, kind = "flat",
       mappedColumn = .cm_criterios_mapped(mapped_col), categories = cats)
}

# Enumeración completa: variables de alumno (population) + variables de aula
# (marco), cada una con scope/kind/mappedColumn y, para alumno, defaultLayer.
# Solo aparece la variable si su columna está mapeada / trae señal.
calc_muestra_aulas_criterios_catalogo <- function(aula_frame, catalog_signals,
                                                  filas_alumno = list(),
                                                  mapped_columns = list()) {
  registry <- .cm_criterios_var_registry()
  vars <- list()
  push <- function(v) if (!is.null(v)) vars[[length(vars) + 1L]] <<- v

  # ---- scope alumno: por estudiante único ----
  sid <- filas_alumno$student_id %||% character(0)
  if (length(sid)) {
    keep <- nzchar(sid) & !duplicated(sid)
    fa <- function(name) (filas_alumno[[name]] %||% rep("", length(sid)))[keep]
    push(.cm_criterios_enum_flat("formation", registry$formation, fa("formation"), mapped_columns$formation, "alumno"))
    push(.cm_criterios_enum_flat("condition", registry$condition, fa("condition"), mapped_columns$condition, "alumno"))
    push(.cm_criterios_enum_flat("faculty", registry$faculty, fa("faculty"), mapped_columns$faculty, "alumno"))
    push(.cm_criterios_enum_numeric("age", registry$age, suppressWarnings(as.numeric(fa("age"))), mapped_columns$age, "alumno"))
    push(.cm_criterios_enum_valores("level", registry$level, .cm_criterios_num_vec(fa("level")), mapped_columns$level, "alumno", "ordinal"))
  }

  # ---- scope aula: por aula única ----
  if (is.data.frame(aula_frame) && nrow(aula_frame)) {
    vals <- .cm_criterios_valores_aula(
      aula_frame, catalog_signals,
      .cm_aulas_num_values(aula_frame, "course_level_num", NA_real_)
    )
    cols <- (catalog_signals %||% list())$columns %||% list()
    col_or <- function(sig_name, base_col) {
      c1 <- cols[[sig_name]] %||% ""
      if (nzchar(c1)) c1 else .cm_aulas_scalar(mapped_columns[[base_col]], "")
    }
    push(.cm_criterios_enum_flat("modality", registry$modality, vals$modality, col_or("modality", "modality"), "aula"))
    push(.cm_criterios_enum_flat("session_type", registry$session_type, vals$session_type, col_or("session_type", "session_type"), "aula"))
    push(.cm_criterios_enum_teacher(registry$teacher_type, vals$teacher, col_or("teacher_type", "teacher_type")))
    push(.cm_criterios_enum_valores("course_level", registry$course_level, vals$course_level, col_or("course_level", "course_level"), "aula", "range"))
    push(.cm_criterios_enum_flat("condicion_curso", registry$condicion_curso, vals$condicion_curso, col_or("condicion_curso", "condicion_curso"), "aula"))
    push(.cm_criterios_enum_numeric("enrolled_total", registry$enrolled_total, vals$enrolled_total, col_or("enrolled_total", "enrolled_total"), "aula"))
    push(.cm_criterios_enum_flat("campus", registry$campus, vals$campus, col_or("campus", "campus"), "aula"))
  }

  list(schema = "calc_muestra_aulas_criterios_catalogo_v1", variables = vars)
}
