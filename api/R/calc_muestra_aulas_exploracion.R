# Radiografía del marco de aulas por facultad — pestaña «Explorador de aulas».
#
# Bloque `frame$exploracion` (schema calc_muestra_aulas_exploracion_v1): el
# frontend programa contra este contrato CONGELADO — no renombrar claves ni
# cambiar su forma. Por facultad se reporta el universo de curso-horarios (CH)
# vs los incluidos en el marco, el tamaño de aula estimado sobre ELEGIBLES
# (eligible_n, no matrícula — acuerdo §13), la distribución por tipo de sesión
# y por nivel (cada grupo con su `mediana_elegibles` de aula incluida típica,
# la cifra que dice si esas aulas cubren la cuota), las señales de
# particularidades y el top de cursos incluidos.
#
# `por_tipo_sesion` es la SUPERFICIE DE DECISIÓN (qué tipos de curso-horario
# seleccionar, por facultad — acuerdo Ramiro §9/§13) y por eso reporta un
# resumen robusto de la distribución de elegibles por aula, no solo la mediana:
# además de `mediana_elegibles` (Q2) trae `media_elegibles` (redondeada a 2,
# para CONTRASTAR con la mediana y VER la distorsión de las aulas gigantes de
# Ciencias/Ingeniería) y el resumen de 5 números `elegibles_min`,
# `elegibles_q1`, `elegibles_q3`, `elegibles_max` (quantile type 7). Todos esos
# campos comparten el subset y la semántica de NA de `mediana_elegibles`: solo
# CH incluidos con dato finito; sin dato ⇒ NA (un 0 mentiría que el aula típica
# está vacía). `por_nivel` conserva solo `mediana_elegibles`: no es superficie
# de decisión. Números siempre numéricos, nunca strings.
#
# Fuente: el aula_frame ya construido + los sets de `frame$particularidades`
# (multi_facultad, codigo_z). Los ids de esas señales se REUSAN tal cual — no
# se re-detecta nada aquí — así el explorador nunca contradice la pestaña de
# particularidades. Los totales globales de señal salen de
# particularidades$counts (conteo completo, no capado a 200 filas); los
# conteos por facultad y los flags de top_cursos usan los ids visibles en los
# records (capados), que en marcos reales cubren el caso típico.
#
# Vive en archivo propio porque calc_muestra_aulas.R está congelado a
# crecimiento: construir() invoca un único call-site (.cm_exploracion_adjuntar).
#
# Tolerancia: columnas ausentes ⇒ listas vacías / NA; marcos sin
# particularidades ⇒ señales en 0; nunca error (el bloque es descriptivo, no
# puede tumbar el build del marco). Números siempre numéricos, no strings.

.cm_exploracion_top_cursos_n <- 15L

# Ids únicos no vacíos de una señal de particularidades (records con campo
# `id`). Señal ausente o malformada ⇒ set vacío.
.cm_exploracion_ids_de_senal <- function(records) {
  if (!is.list(records) || !length(records)) return(character(0))
  ids <- vapply(records, function(r) {
    if (!is.list(r)) return("")
    .cm_aulas_scalar(r$id, "")
  }, character(1))
  unique(ids[nzchar(ids)])
}

# Set de ids de una señal prefiriendo el vector COMPLETO (part$ids$<señal>,
# sin cap) y cayendo a los records capados solo si el bloque no lo trae.
.cm_exploracion_ids_completos <- function(ids_llenos, records) {
  if (is.list(ids_llenos) || is.character(ids_llenos)) {
    ids <- vapply(as.list(ids_llenos), function(x) .cm_aulas_scalar(x, ""), character(1))
    ids <- unique(ids[nzchar(ids)])
    if (length(ids)) return(ids)
  }
  .cm_exploracion_ids_de_senal(records)
}

# Suma de elegibles tolerante: sin columna eligible_n en el frame el dato no
# existe (NA); con columna, suma sobre valores finitos (subset vacío ⇒ 0, que
# es un dato real: la facultad no aporta elegibles).
.cm_exploracion_suma_elegibles <- function(v, tiene_col) {
  if (!tiene_col) return(NA_real_)
  as.numeric(sum(v[is.finite(v)]))
}

# Mediana de eligible_n de los CH INCLUIDOS por grupo (tipo de sesión o
# nivel), alineada al orden de `grupos`. Es LA cifra que dice si las aulas de
# ese grupo cubren la cuota por facultad: dónde están los elegibles ya lo
# dicen los conteos; cuántos trae el aula típica lo dice esta mediana.
# Vectorizada con tapply sobre el subset incluido con dato finito; el lookup
# usa match() porque el grupo vacío "" no es indexable por nombre en R. Sin
# columna eligible_n o grupo sin incluidos con dato ⇒ NA (no hay cifra
# defendible; un 0 mentiría que el aula típica está vacía).
.cm_exploracion_mediana_grupos <- function(grupos, claves, incl, elig, tiene_elig) {
  if (!tiene_elig) return(rep(NA_real_, length(grupos)))
  sub <- incl & is.finite(elig)
  if (!any(sub)) return(rep(NA_real_, length(grupos)))
  med <- tapply(elig[sub], claves[sub], stats::median)
  as.numeric(med)[match(grupos, names(med))]
}

# Resumen robusto de eligible_n de los CH INCLUIDOS por grupo (tipo de sesión),
# alineado al orden de `grupos`: min, Q1, Q3, max (stats::quantile type 7, sin
# nombres) y media (redondeada a 2 decimales, como .cm_exploracion_tamano_aula).
# Es el complemento de .cm_exploracion_mediana_grupos (que da la mediana = Q2):
# juntos exponen la distribución completa por aula y hacen visible la distorsión
# de la MEDIA por aulas gigantes (§9, "aulas fantasma"). MISMO subset y misma
# semántica de NA que la mediana: `incl & is.finite(elig)`; sin columna
# eligible_n o grupo sin incluidos con dato ⇒ NA en todos los campos de ese
# grupo (un 0 mentiría que el aula típica está vacía). Vectorizado con tapply
# sobre el subset; el lookup usa match() porque el grupo vacío "" no es
# indexable por nombre en R.
.cm_exploracion_resumen_grupos <- function(grupos, claves, incl, elig, tiene_elig) {
  na_col <- rep(NA_real_, length(grupos))
  vacio <- list(min = na_col, q1 = na_col, q3 = na_col, max = na_col, media = na_col)
  if (!tiene_elig) return(vacio)
  sub <- incl & is.finite(elig)
  if (!any(sub)) return(vacio)
  resumen <- tapply(elig[sub], claves[sub], function(v) {
    q <- stats::quantile(v, c(0.25, 0.75), type = 7, names = FALSE)
    c(min(v), q[[1]], q[[2]], max(v), round(mean(v), 2))
  }, simplify = FALSE)
  idx <- match(grupos, names(resumen))
  pick <- function(k) vapply(idx, function(i) {
    if (is.na(i)) return(NA_real_)
    as.numeric(resumen[[i]][[k]])
  }, numeric(1))
  list(min = pick(1L), q1 = pick(2L), q3 = pick(3L), max = pick(4L), media = pick(5L))
}

# Mediana y media del tamaño de aula sobre eligible_n de los CH INCLUIDOS
# (elegibles, no matrícula). Sin columna o sin incluidos con dato ⇒ NA.
.cm_exploracion_tamano_aula <- function(v, tiene_col) {
  if (tiene_col) v <- v[is.finite(v)] else v <- numeric(0)
  if (!length(v)) return(list(mediana = NA_real_, media = NA_real_))
  list(
    mediana = as.numeric(stats::median(v)),
    media = round(mean(v), 2)
  )
}

# Distribución por tipo de sesión dentro de una facultad — superficie de
# decisión: reporta el resumen robusto de elegibles por aula (min/Q1/mediana/
# Q3/max + media) para que el académico VEA qué tipos concentran más elegibles
# y con qué dispersión, y contraste media vs mediana. Los CH EXCLUIDOS cuentan
# en `ch` (universo de la facultad) pero no en `ch_elegibles`, ni en `elegibles`
# (marco) ni en NINGÚN campo del resumen (media/mediana/cuartiles) — todos
# comparten el subset `incl & is.finite(elig)` y devuelven NA sin dato. El vacío
# es su propia categoría "" (los conteos deben reconciliar con ch_total). Orden:
# elegibles desc, luego ch desc, luego tipo.
.cm_exploracion_dist_tipo <- function(tipos, incl, elig, tiene_elig) {
  grupos <- unique(tipos)
  if (!length(grupos)) return(list())
  medianas <- .cm_exploracion_mediana_grupos(grupos, tipos, incl, elig, tiene_elig)
  resumen <- .cm_exploracion_resumen_grupos(grupos, tipos, incl, elig, tiene_elig)
  registros <- lapply(seq_along(grupos), function(j) {
    g <- grupos[[j]]
    en_grupo <- tipos == g
    list(
      tipo = g,
      ch = as.integer(sum(en_grupo)),
      ch_elegibles = as.integer(sum(en_grupo & incl)),
      elegibles = .cm_exploracion_suma_elegibles(elig[en_grupo & incl], tiene_elig),
      media_elegibles = resumen$media[[j]],
      elegibles_min = resumen$min[[j]],
      elegibles_q1 = resumen$q1[[j]],
      mediana_elegibles = medianas[[j]],
      elegibles_q3 = resumen$q3[[j]],
      elegibles_max = resumen$max[[j]]
    )
  })
  clave_elig <- vapply(registros, function(r) .cm_aulas_num(r$elegibles, NA_real_), numeric(1))
  clave_ch <- vapply(registros, function(r) as.numeric(r$ch), numeric(1))
  registros[order(-clave_elig, -clave_ch, grupos, na.last = TRUE)]
}

# Distribución por nivel dentro de una facultad. `ch` cuenta el universo,
# `elegibles` suma eligible_n de los incluidos y `mediana_elegibles` es el
# aula típica del marco en ese nivel (misma semántica que la distribución por
# tipo). Orden natural del recorrido curricular: nivel numérico parseable
# ascendente (reusa .cm_criterios_parse_nivel), los no parseables al final
# por etiqueta.
.cm_exploracion_dist_nivel <- function(niveles, incl, elig, tiene_elig) {
  grupos <- unique(niveles)
  if (!length(grupos)) return(list())
  medianas <- .cm_exploracion_mediana_grupos(grupos, niveles, incl, elig, tiene_elig)
  registros <- lapply(seq_along(grupos), function(j) {
    g <- grupos[[j]]
    en_grupo <- niveles == g
    list(
      nivel = g,
      ch = as.integer(sum(en_grupo)),
      elegibles = .cm_exploracion_suma_elegibles(elig[en_grupo & incl], tiene_elig),
      mediana_elegibles = medianas[[j]]
    )
  })
  clave_num <- vapply(grupos, .cm_criterios_parse_nivel, numeric(1), USE.NAMES = FALSE)
  registros[order(clave_num, grupos, na.last = TRUE)]
}

# Bucketiza la condición del curso a las categorías de DECISIÓN (reunión Ramiro
# §8.2: "obligatorios y de especialidad"; §3: la columna puede venir incompleta):
# Obligatorio | Electivo | Sin dato | Otro. Vectorizado, tolerante a NA/"".
# El orden importa: "ELECTIVO-OBLIGATORIO" contiene OBLIGATORIO ⇒ Obligatorio.
.cm_exploracion_bucket_condicion <- function(cc) {
  up <- toupper(trimws(as.character(cc)))
  up[is.na(up)] <- ""
  out <- rep("Otro", length(up))
  out[grepl("OBLIGATORIO", up, fixed = TRUE)] <- "Obligatorio"
  out[out == "Otro" & grepl("ELECTIVO", up, fixed = TRUE)] <- "Electivo"
  out[!nzchar(up)] <- "Sin dato"
  out
}

# Distribución por condición del curso dentro de una facultad (mismo patrón que
# por_tipo_sesion pero SIN boxplot: solo conteos y elegibles del marco). Los CH
# EXCLUIDOS cuentan en `ch` (universo) pero no en `ch_elegibles` ni `elegibles`.
# Responde "¿cuántas aulas/elegibles son obligatorios por facultad?" — el dato
# que, junto al tipo, define cuántas aulas sobreviven a todos los criterios.
# Orden: elegibles desc, luego ch desc, luego condición.
.cm_exploracion_dist_condicion <- function(cond, incl, elig, tiene_elig) {
  grupos <- unique(cond)
  if (!length(grupos)) return(list())
  registros <- lapply(grupos, function(g) {
    en_grupo <- cond == g
    list(
      condicion = g,
      ch = as.integer(sum(en_grupo)),
      ch_elegibles = as.integer(sum(en_grupo & incl)),
      elegibles = .cm_exploracion_suma_elegibles(elig[en_grupo & incl], tiene_elig)
    )
  })
  clave_elig <- vapply(registros, function(r) .cm_aulas_num(r$elegibles, NA_real_), numeric(1))
  clave_ch <- vapply(registros, function(r) as.numeric(r$ch), numeric(1))
  registros[order(-clave_elig, -clave_ch, grupos, na.last = TRUE)]
}

# Top de cursos por eligible_n entre los CH INCLUIDOS de la facultad (cap 15).
# `idx_inc` son índices GLOBALES sobre los vectores de `d`. Empates y NA se
# desempatan por id para un orden determinista build a build.
.cm_exploracion_top_cursos <- function(idx_inc, d) {
  if (!length(idx_inc)) return(list())
  orden <- idx_inc[order(-d$elig[idx_inc], d$ids[idx_inc], na.last = TRUE)]
  top <- utils::head(orden, .cm_exploracion_top_cursos_n)
  lapply(top, function(i) list(
    id = d$ids[[i]],
    curso = d$cursos[[i]],
    nivel = d$niveles[[i]],
    tipo = d$tipos[[i]],
    elegibles = if (is.finite(d$elig[[i]])) as.numeric(d$elig[[i]]) else NA_real_,
    faculty_match_share = if (is.finite(d$fms[[i]])) as.numeric(d$fms[[i]]) else NA_real_,
    local_externo = isTRUE(d$es_z[[i]]),
    multi_facultad = isTRUE(d$es_multi[[i]])
  ))
}

# Bloque de una facultad. `idx` = índices globales de sus CH (universo);
# las señales (multi-facultad, local externo, sin condición) se cuentan sobre
# el UNIVERSO de la facultad — igual que la detección de particularidades,
# que corre sobre el frame completo — para que ch_total y las señales hablen
# del mismo denominador.
.cm_exploracion_facultad <- function(label, idx, d) {
  incl <- d$included[idx]
  idx_inc <- idx[incl]
  tam <- .cm_exploracion_tamano_aula(d$elig[idx_inc], d$tiene_elig)
  list(
    facultad = label,
    ch_total = as.integer(length(idx)),
    ch_elegibles = as.integer(sum(incl)),
    elegibles_total = .cm_exploracion_suma_elegibles(d$elig[idx_inc], d$tiene_elig),
    est_aula_mediana = tam$mediana,
    est_aula_media = tam$media,
    por_tipo_sesion = .cm_exploracion_dist_tipo(
      d$tipos[idx], incl, d$elig[idx], d$tiene_elig
    ),
    por_nivel = .cm_exploracion_dist_nivel(
      d$niveles[idx], incl, d$elig[idx], d$tiene_elig
    ),
    por_condicion = .cm_exploracion_dist_condicion(
      d$cond[idx], incl, d$elig[idx], d$tiene_elig
    ),
    n_multi_facultad = as.integer(sum(d$es_multi[idx])),
    n_local_externo = as.integer(sum(d$es_z[idx])),
    n_sin_condicion = as.integer(sum(d$es_sin_cc[idx])),
    top_cursos = .cm_exploracion_top_cursos(idx_inc, d)
  )
}

# Radiografía completa del marco. `particularidades` es el bloque ya adjuntado
# al frame (calc_muestra_aulas_particularidades); NULL degrada a señales en 0.
calc_muestra_aulas_exploracion <- function(aula_frame, particularidades = NULL) {
  vacio <- list(
    schema = "calc_muestra_aulas_exploracion_v1",
    totales = list(
      facultades = 0L, ch_total = 0L, ch_elegibles = 0L,
      elegibles_total = 0, n_local_externo = 0L, n_multi_facultad = 0L
    ),
    por_facultad = list()
  )
  if (!is.data.frame(aula_frame) || !nrow(aula_frame)) return(vacio)
  n <- nrow(aula_frame)
  part <- if (is.list(particularidades)) particularidades else list()
  counts <- if (is.list(part$counts)) part$counts else list()
  # Sets COMPLETOS de ids por señal (part$ids, sin cap); fallback a los
  # records capados a 200 solo para bloques viejos sin el campo — con el
  # fallback los conteos POR FACULTAD pueden subcontar (cap), los totales no.
  ids_completos <- if (is.list(part$ids)) part$ids else list()
  multi_ids <- .cm_exploracion_ids_completos(ids_completos$multi_facultad, part$multi_facultad)
  z_ids <- .cm_exploracion_ids_completos(ids_completos$codigo_z, part$codigo_z)

  ids <- .cm_aulas_values(aula_frame, "classroom_id", "")
  cursos <- .cm_aulas_values(aula_frame, "course_name", "")
  tipos <- .cm_aulas_values(aula_frame, "session_type", "")
  fms <- .cm_aulas_num_values(aula_frame, "faculty_match_share", NA_real_)
  tiene_elig <- "eligible_n" %in% names(aula_frame)
  elig <- .cm_aulas_num_values(aula_frame, "eligible_n", NA_real_)
  # Sin columna `included` (frame ajeno o incompleto) todo cuenta como
  # incluido: la radiografía describe lo que hay, no inventa exclusiones.
  included <- if ("included" %in% names(aula_frame)) {
    aula_frame$included %in% TRUE
  } else {
    rep(TRUE, n)
  }
  # Nivel: la etiqueta del aula (`level`, la misma que muestra el resto del
  # frame); si la base no la trajo pero el catálogo aportó course_level_num,
  # se usa ese numérico como etiqueta (contrato: "course_level/nivel").
  niveles <- .cm_aulas_values(aula_frame, "level", "")
  if (!any(nzchar(niveles)) && "course_level_num" %in% names(aula_frame)) {
    cln <- .cm_aulas_num_values(aula_frame, "course_level_num", NA_real_)
    niveles <- ifelse(is.finite(cln), as.character(cln), "")
  }
  # "Sin condición" solo es señal cuando la variable EXISTE en el marco
  # (alguna aula trae valor); con la columna toda vacía la base no trae la
  # variable y contar "sin condición" = todo el marco sería ruido.
  cc <- .cm_aulas_values(aula_frame, "condicion_curso", "")
  es_sin_cc <- if (any(nzchar(cc))) !nzchar(cc) else rep(FALSE, n)
  cond <- .cm_exploracion_bucket_condicion(cc)

  d <- list(
    ids = ids, cursos = cursos, tipos = tipos, niveles = niveles,
    elig = elig, fms = fms, included = included, tiene_elig = tiene_elig,
    cond = cond,
    es_multi = nzchar(ids) & ids %in% multi_ids,
    es_z = nzchar(ids) & ids %in% z_ids,
    es_sin_cc = es_sin_cc
  )

  # Agrupación por la MISMA facultad que usa el marco para estratificar
  # (facultad del aula). El vacío "" es su propio grupo (los ch_total por
  # facultad deben sumar el total); sin columna de facultad no hay radiografía
  # por facultad, pero los totales globales sí se reportan.
  por_facultad <- list()
  if ("faculty" %in% names(aula_frame)) {
    grupos <- split(seq_len(n), .cm_aulas_values(aula_frame, "faculty", ""))
    por_facultad <- lapply(names(grupos), function(g) {
      .cm_exploracion_facultad(g, grupos[[g]], d)
    })
    clave <- vapply(por_facultad, function(p) .cm_aulas_num(p$elegibles_total, NA_real_), numeric(1))
    etiquetas <- vapply(por_facultad, function(p) p$facultad, character(1))
    por_facultad <- por_facultad[order(-clave, etiquetas, na.last = TRUE)]
  }

  list(
    schema = "calc_muestra_aulas_exploracion_v1",
    totales = list(
      facultades = as.integer(length(por_facultad)),
      ch_total = as.integer(n),
      ch_elegibles = as.integer(sum(included)),
      elegibles_total = .cm_exploracion_suma_elegibles(elig[included], tiene_elig),
      # Totales de señal desde particularidades$counts: es el conteo COMPLETO
      # (los records viajan capados a 200 filas). Fallback al tamaño del set
      # visible si el bloque llegó sin counts.
      n_local_externo = .cm_aulas_int(counts$codigo_z, length(z_ids)),
      n_multi_facultad = .cm_aulas_int(counts$multi_facultad, length(multi_ids))
    ),
    por_facultad = por_facultad
  )
}

# Punto de integración único al cierre de construir(): adjunta la radiografía
# leyendo el aula_frame y las particularidades YA adjuntadas al frame.
.cm_exploracion_adjuntar <- function(out) {
  if (!is.list(out)) return(out)
  out$exploracion <- calc_muestra_aulas_exploracion(
    aula_frame = out$aula_frame,
    particularidades = out$particularidades
  )
  out
}
