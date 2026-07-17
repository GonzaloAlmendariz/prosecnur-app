# Particularidades del marco de aulas (asesoría muestral 2026-07-15, §12).
#
# Los casos "año a año" del marco universitario NO se automatizan como reglas
# duras: la plataforma los DETECTA y los MUESTRA, y el metodólogo deja su
# decisión manual documentada. Señales cubiertas:
#   - session_type_dominante: la DTI entregó el tipo de sesión sobre-agrupado
#     (una categoría concentra casi todo y el tipo fino se perdió).
#   - multi_facultad: curso-horario que sirve a >= 2 facultades (dato ya
#     calculado en calc_muestra_aulas_catalogo.R como pares facultad-nivel).
#   - codigo_z: CH cuyo CÓDIGO trae el patrón Z de local externo.
#   - nombre_tesis: CH cuyo NOMBRE de curso matchea tesis/seminario de tesis.
#
# Decisión manual por CH: "incluir" | "excluir" | "revisado" + nota. Solo
# "excluir" altera el marco (razón propia `particularidad_manual`, paso
# visible en el embudo y la auditoría); "incluir"/"revisado" viajan como
# documentación para que la UI muestre el estado revisado.
#
# Vive en archivo propio porque calc_muestra_aulas.R está congelado a
# crecimiento: construir() invoca dos call-sites mínimos
# (.cm_particularidades_aplicar_decisiones y .cm_particularidades_adjuntar).
#
# Contrato: schema "calc_muestra_aulas_particularidades_v1". Todo tolerante:
# columnas ausentes, catálogo sin señal o frame vacío ⇒ listas vacías, nunca
# error (las señales son informativas, no pueden tumbar el build del marco).

# Cap de filas por señal en el payload (el conteo TOTAL viaja aparte en
# counts): un marco real puede tener miles de CH multi-facultad y el frame
# entero viaja al frontend en cada GET /state.
.cm_particularidades_cap_filas <- 200L

.cm_particularidades_decisiones_validas <- c("incluir", "excluir", "revisado")

# Normalizador defensivo del mapa de decisiones manuales (id -> {decision,
# nota}): ids chr no vacíos; una decision fuera del vocabulario descarta la
# entrada COMPLETA (una decisión ilegible no debe tocar el marco); nota
# escalar (default ""). Acepta el atajo id -> "excluir" (string pelado).
# Entradas duplicadas: la última gana (semántica de mapa).
.cm_particularidades_normalize_decisiones <- function(x) {
  if (is.null(x) || !is.list(x) || !length(x)) return(list())
  nms <- names(x)
  if (is.null(nms)) return(list())
  out <- list()
  for (i in seq_along(x)) {
    id <- .cm_aulas_scalar(nms[[i]], "")
    if (!nzchar(id)) next
    v <- x[[i]]
    if (is.character(v)) v <- list(decision = v)
    if (!is.list(v)) next
    decision <- tolower(.cm_aulas_scalar(v$decision, ""))
    if (!decision %in% .cm_particularidades_decisiones_validas) next
    out[[id]] <- list(decision = decision, nota = .cm_aulas_scalar(v$nota, ""))
  }
  out
}

# Aplica las decisiones manuales sobre el aula_frame ya criteriado: SOLO
# "excluir" saca el CH del marco (included FALSE + razón `particularidad_
# manual`). Un CH que ya estaba excluido por criterios conserva su razón
# original (la decisión queda documentada pero no re-etiqueta ni cuenta como
# exclusión manual en el embudo: ya estaba fuera). Devuelve el frame y el
# detalle aplicado para el embudo/auditoría.
.cm_particularidades_aplicar_decisiones <- function(aula_frame, decisiones) {
  decisiones <- .cm_particularidades_normalize_decisiones(decisiones)
  out <- list(aula_frame = aula_frame, decisiones = decisiones,
              excluidas_manual = character(0), n_excluidas = 0L)
  if (!length(decisiones) || !is.data.frame(aula_frame) || !nrow(aula_frame) ||
      !all(c("classroom_id", "included", "exclude_reason") %in% names(aula_frame))) {
    return(out)
  }
  excluir_ids <- names(decisiones)[vapply(
    decisiones, function(d) identical(d$decision, "excluir"), logical(1)
  )]
  if (!length(excluir_ids)) return(out)
  ids <- .cm_aulas_values(aula_frame, "classroom_id", "")
  # Solo se voltean las aulas que estaban ENTRANDO al marco: eso es lo que el
  # paso del embudo debe contar como "salieron por decisión manual".
  flip <- ids %in% excluir_ids & aula_frame$included %in% TRUE
  if (any(flip)) {
    aula_frame$included[flip] <- FALSE
    aula_frame$exclude_reason[flip] <- "particularidad_manual"
  }
  out$aula_frame <- aula_frame
  out$excluidas_manual <- ids[flip]
  out$n_excluidas <- as.integer(sum(flip))
  out
}

# Señal de session_type sobre-agrupado por la DTI: la categoría dominante
# concentra >= 85% de los CH con señal y hay a lo más 2 categorías no vacías
# (el caso real: todo llega como "TEORICO" y el tipo fino se perdió aguas
# arriba). Sin esas condiciones (o sin señal) devuelve NULL.
.cm_particularidades_session_dominante <- function(session_type) {
  vals <- trimws(as.character(session_type %||% character(0)))
  vals <- vals[!is.na(vals) & nzchar(vals)]
  if (!length(vals)) return(NULL)
  tab <- sort(table(vals), decreasing = TRUE)
  share <- as.numeric(tab[[1]]) / length(vals)
  total <- length(tab)
  if (total > 2L || share < 0.85) return(NULL)
  list(
    categoria = names(tab)[[1]],
    share = round(share, 4),
    total_categorias = as.integer(total)
  )
}

# Facultades DISTINTAS del set de pares (facultad, nivel) serializado por
# .cm_catalogo_pairs_by_key. Deduplicación por text_key (robusta a la ñ y a
# variantes de mayúsculas) conservando la etiqueta cruda para la UI.
.cm_particularidades_facultades_de_pares <- function(par_str) {
  pares <- strsplit(par_str, .cm_catalogo_pair_rec, fixed = TRUE)[[1]]
  fac <- vapply(pares, function(p) {
    partes <- strsplit(p, .cm_catalogo_pair_fld, fixed = TRUE)[[1]]
    if (length(partes)) trimws(partes[[1]]) else ""
  }, character(1), USE.NAMES = FALSE)
  fac <- fac[!is.na(fac) & nzchar(fac)]
  fac[!duplicated(.cm_aulas_text_key(fac))]
}

# CH cuyo curso sirve a >= 2 facultades. Reusa el dato ya calculado por el
# catálogo (course_faculty_level_pairs, keyed por text_key del classroom_id);
# sin catálogo o sin pares la señal queda vacía (no se re-deriva de la base:
# la facultad por fila del alumno NO es la facultad del curso).
.cm_particularidades_multi_facultad <- function(aula_frame, catalog_signals) {
  vacio <- list(records = list(), total = 0L, ids = character(0))
  pairs_sig <- if (is.list(catalog_signals)) catalog_signals$course_faculty_level_pairs else NULL
  if (!length(pairs_sig) || !is.data.frame(aula_frame) || !nrow(aula_frame)) return(vacio)
  ids <- .cm_aulas_values(aula_frame, "classroom_id", "")
  cursos <- .cm_aulas_values(aula_frame, "course_name", "")
  pares <- unname(pairs_sig[.cm_aulas_text_key(ids)])
  registros <- list()
  ids_hit <- character(0)
  total <- 0L
  for (i in seq_along(ids)) {
    if (!nzchar(ids[[i]])) next
    p <- pares[[i]]
    if (is.na(p) || !nzchar(p)) next
    fac <- .cm_particularidades_facultades_de_pares(p)
    if (length(fac) < 2L) next
    total <- total + 1L
    ids_hit[[length(ids_hit) + 1L]] <- ids[[i]]
    if (length(registros) < .cm_particularidades_cap_filas) {
      registros[[length(registros) + 1L]] <- list(
        id = ids[[i]],
        curso = cursos[[i]],
        facultades = as.list(unname(fac)),
        n_facultades = as.integer(length(fac))
      )
    }
  }
  list(records = registros, total = as.integer(total), ids = ids_hit)
}

# Patrón Z de local externo, conservador: la letra Z cuenta solo cuando NO
# está pegada a otra letra (token o sufijo del CÓDIGO). "MAT101Z", "Z-101" y
# la sección "Z2" matchean; "AZUL"/"LUZ" no. Se evalúa sobre códigos, nunca
# sobre el nombre del curso.
.cm_particularidades_es_codigo_z <- function(codigo) {
  codigo <- trimws(as.character(codigo %||% ""))
  codigo[is.na(codigo)] <- ""
  nzchar(codigo) & grepl("(?<![A-Za-z])[Zz](?![A-Za-z])", codigo, perl = TRUE)
}

# CH con patrón Z en su código de curso o sección. `codigo` reporta el valor
# que matcheó (código del curso primero; la sección solo si el código no
# matcheó).
.cm_particularidades_codigo_z <- function(aula_frame) {
  vacio <- list(records = list(), total = 0L, ids = character(0))
  if (!is.data.frame(aula_frame) || !nrow(aula_frame)) return(vacio)
  ids <- .cm_aulas_values(aula_frame, "classroom_id", "")
  cursos <- .cm_aulas_values(aula_frame, "course_name", "")
  codigo_curso <- .cm_aulas_values(aula_frame, "course_id", "")
  seccion <- .cm_aulas_values(aula_frame, "section", "")
  hit_curso <- .cm_particularidades_es_codigo_z(codigo_curso)
  hit_seccion <- .cm_particularidades_es_codigo_z(seccion)
  registros <- list()
  ids_hit <- character(0)
  total <- 0L
  for (i in seq_along(ids)) {
    if (!nzchar(ids[[i]])) next
    if (!hit_curso[[i]] && !hit_seccion[[i]]) next
    total <- total + 1L
    ids_hit[[length(ids_hit) + 1L]] <- ids[[i]]
    if (length(registros) < .cm_particularidades_cap_filas) {
      registros[[length(registros) + 1L]] <- list(
        id = ids[[i]],
        curso = cursos[[i]],
        codigo = if (hit_curso[[i]]) codigo_curso[[i]] else seccion[[i]]
      )
    }
  }
  list(records = registros, total = as.integer(total), ids = ids_hit)
}

# Nombre de curso de tesis: regex sin acentos, case-insensitive y con
# frontera de palabra ("Síntesis" NO matchea; "Taller de tesis" y "Seminario
# de Tesis II" sí).
.cm_particularidades_es_nombre_tesis <- function(nombre) {
  llano <- tolower(iconv(as.character(nombre %||% ""), to = "ASCII//TRANSLIT", sub = ""))
  llano[is.na(llano)] <- ""
  grepl("\\btesis\\b", llano, perl = TRUE)
}

# CH cuyo nombre de curso matchea tesis. `nivel` acompaña al registro para que
# el metodólogo vea de un vistazo en qué ciclo cae el curso.
.cm_particularidades_nombre_tesis <- function(aula_frame) {
  vacio <- list(records = list(), total = 0L, ids = character(0))
  if (!is.data.frame(aula_frame) || !nrow(aula_frame)) return(vacio)
  ids <- .cm_aulas_values(aula_frame, "classroom_id", "")
  cursos <- .cm_aulas_values(aula_frame, "course_name", "")
  niveles <- .cm_aulas_values(aula_frame, "level", "")
  hit <- .cm_particularidades_es_nombre_tesis(cursos)
  registros <- list()
  ids_hit <- character(0)
  total <- 0L
  for (i in seq_along(ids)) {
    if (!nzchar(ids[[i]]) || !hit[[i]]) next
    total <- total + 1L
    ids_hit[[length(ids_hit) + 1L]] <- ids[[i]]
    if (length(registros) < .cm_particularidades_cap_filas) {
      registros[[length(registros) + 1L]] <- list(
        id = ids[[i]],
        curso = cursos[[i]],
        nivel = niveles[[i]]
      )
    }
  }
  list(records = registros, total = as.integer(total), ids = ids_hit)
}

# Capa de señales completa del marco. `aplicadas` es la salida de
# .cm_particularidades_aplicar_decisiones (para documentar decisiones y CH
# efectivamente excluidos); NULL degrada a mapa vacío.
calc_muestra_aulas_particularidades <- function(aula_frame, catalog_signals = NULL, aplicadas = NULL) {
  if (!is.data.frame(aula_frame)) aula_frame <- data.frame(stringsAsFactors = FALSE)
  if (!is.list(aplicadas)) aplicadas <- list()
  ids <- .cm_aulas_values(aula_frame, "classroom_id", "")
  multi <- .cm_particularidades_multi_facultad(aula_frame, catalog_signals)
  zeta <- .cm_particularidades_codigo_z(aula_frame)
  tesis <- .cm_particularidades_nombre_tesis(aula_frame)
  excluidas <- aplicadas$excluidas_manual
  if (is.null(excluidas)) excluidas <- character(0)
  decisiones <- aplicadas$decisiones
  if (is.null(decisiones)) decisiones <- list()
  list(
    schema = "calc_muestra_aulas_particularidades_v1",
    session_type_dominante = .cm_particularidades_session_dominante(
      .cm_aulas_values(aula_frame, "session_type", "")
    ),
    multi_facultad = multi$records,
    codigo_z = zeta$records,
    nombre_tesis = tesis$records,
    counts = list(
      multi_facultad = multi$total,
      codigo_z = zeta$total,
      nombre_tesis = tesis$total,
      # CH sin id: no pueden recibir decisión manual (defensivo; el frame
      # construye group_ids solo con ids no vacíos, así que en la práctica 0).
      sin_ids = as.integer(if (length(ids)) sum(!nzchar(ids)) else 0L)
    ),
    # Sets COMPLETOS de ids por señal (los records de arriba viajan capados a
    # 200 filas para la UI): consumidores agregados (exploración) deben usar
    # estos, no los records — con >200 señales los conteos por facultad se
    # subcontarían (bug medido: por-facultad sumaba 200 con total 1,609).
    ids = list(
      multi_facultad = as.list(multi$ids),
      codigo_z = as.list(zeta$ids),
      nombre_tesis = as.list(tesis$ids)
    ),
    # Documentación de la decisión manual: el mapa normalizado completo (la
    # UI pinta el estado incluir/excluir/revisado + nota) y los CH que
    # efectivamente salieron del marco en este build.
    decisiones = decisiones,
    excluidas_manual = as.list(excluidas)
  )
}

# Paso "Particularidades (decisión manual)" del embudo de aulas. El embudo se
# arma en calc_muestra_perfil.R desde los flags de criterios (pre-manual), así
# que su último conteo NO ve la exclusión manual; este paso cierra la cuenta:
# conteo = último_conteo - n_excluidas == marco_aulas (invariante auditable
# conteo[k-1] == conteo[k] + excluidos[k]). Solo aparece si hubo exclusiones
# aplicadas, igual que los pasos condicionales del embudo.
.cm_particularidades_embudo <- function(perfil, aplicadas) {
  n_excluidas <- .cm_aulas_int(aplicadas$n_excluidas, 0L)
  if (n_excluidas <= 0L || !is.list(perfil)) return(perfil)
  embudo <- perfil$embudo_aula
  if (!is.data.frame(embudo) || !nrow(embudo) ||
      !all(c("id", "label", "conteo", "excluidos") %in% names(embudo))) {
    return(perfil)
  }
  prev <- .cm_aulas_int(embudo$conteo[[nrow(embudo)]], 0L)
  fila <- data.frame(
    id = "particularidad_manual",
    label = "Particularidades (decisión manual)",
    conteo = as.integer(max(prev - n_excluidas, 0L)),
    excluidos = n_excluidas,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  perfil$embudo_aula <- rbind(embudo, fila)
  rownames(perfil$embudo_aula) <- NULL
  perfil
}

# Punto de integración único post-perfil en construir(): adjunta la capa de
# señales al frame, agrega el paso manual al embudo y deja rastro en la
# auditoría. Las filas de auditoría solo se agregan cuando HAY decisiones
# (los builds históricos sin decisiones quedan bit a bit idénticos).
.cm_particularidades_adjuntar <- function(out, catalog_signals, aplicadas) {
  if (!is.list(out)) return(out)
  if (!is.list(aplicadas)) aplicadas <- list()
  out$particularidades <- calc_muestra_aulas_particularidades(
    aula_frame = out$aula_frame,
    catalog_signals = catalog_signals,
    aplicadas = aplicadas
  )
  out$perfil <- .cm_particularidades_embudo(out$perfil, aplicadas)
  decisiones <- aplicadas$decisiones
  if (length(decisiones) && is.data.frame(out$audit) &&
      all(c("metric", "value") %in% names(out$audit))) {
    out$audit <- rbind(out$audit, data.frame(
      metric = c("particularidad_decisiones_n", "particularidad_manual_excluded_n"),
      value = c(
        as.character(length(decisiones)),
        as.character(.cm_aulas_int(aplicadas$n_excluidas, 0L))
      ),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ))
    rownames(out$audit) <- NULL
  }
  out
}
