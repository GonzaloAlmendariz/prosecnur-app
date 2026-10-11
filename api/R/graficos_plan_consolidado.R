# El informe compartido se propone y se siembra desde la matriz (ADR 0096)
# =======================================================================
#
# `POST /api/graficos/plan/sugerido` con `scope:"consolidado"` y la siembra del
# preflight consolidado (`graficos_consolidado_preflight`) derivan su plan de la
# MISMA función de este archivo, así lo que se propone, lo que se siembra y lo
# que genera el job son el mismo mazo para el mismo estado.
#
# - El bloque comparativo sale de `.graficos_plan_desde_equivalencias`, el único
#   generador (ADR 0063): sin matriz declarada no hay láminas que comparen bases,
#   aunque las etiquetas coincidan (ADR 0062; la heurística por etiqueta quedó
#   retirada de todo generador, decisión 7).
# - Sólo participan las bases con release aprobada y vigente; las demás se dicen
#   en `bases_excluidas` (decisión 2).
# - Lo que se propone no se bloquea por escala: toda fila que el bloqueo del
#   consolidado rechazaría sale a `fuera` como `escala_incompatible` (decisión 4).
# - La config es la del cuerpo, portable, y NUNCA se mezcla con la de la base
#   activa (ADR 0040 §6.1). La propuesta no persiste: el estado de la sesión se
#   restaura al salir, igual que hace el preflight.

.GRAFICOS_PLAN_SCOPES <- c("", "consolidado")

# Alcance del plan sugerido, leído de la raíz del cuerpo. ""/ausente = actual.
.graficos_plan_scope <- function(scope) {
  valor <- tolower(trimws(as.character(scope %||% "")[1]))
  if (is.na(valor)) valor <- ""
  if (!valor %in% .GRAFICOS_PLAN_SCOPES) {
    stop_api(400, "E_GRAFICOS_PLAN_SCOPE",
             "scope debe omitirse o ser \"consolidado\".",
             details = list(scope = valor, admitidos = as.list(.GRAFICOS_PLAN_SCOPES)))
  }
  valor
}

.graficos_plan_consolidado_requiere <- function(sid) {
  if (!isTRUE(estudio_is_independent_siblings(sid))) {
    stop_api(409, "E_GRAFICOS_CONSOLIDADO_NO_APLICA",
             "El informe compartido sólo aplica a estudios con bases hermanas independientes.")
  }
  invisible(TRUE)
}

# Config del compartido: la del cuerpo en forma portable sobre los defaults del
# proyecto. No pasa por `.graficos_effective_config`, que leería la de la base activa.
.graficos_plan_consolidado_config <- function(sid, s, config) {
  cfg <- .as_json_list(config) %||% list()
  if (.graficos_is_obj(cfg$config)) cfg <- cfg$config
  cfg$fuente <- NULL
  cfg <- .graficos_consolidado_portable_config(cfg, s$files %||% list())
  cfg$multi_actor_comparisons <- TRUE
  .graficos_normalize_config(.graficos_deep_merge(.graficos_default_config(sid), cfg), sid = sid)
}

# Qué bases participan y cuáles quedan fuera, con su motivo.
.graficos_plan_consolidado_marco <- function(sid, s, sources = NULL) {
  catalog <- .processing_release_catalog(s)
  entries <- catalog$entries %||% list()
  orden <- vapply(entries, function(e) as.character(e$base), character(1))
  sources <- sources %||% .graficos_consolidado_sources(sid, orden)
  disponibles <- intersect(names(sources$data_sources %||% list()), names(sources$inst_sources %||% list()))
  incluidas <- character(0)
  excluidas <- list()
  for (entry in entries) {
    motivo <- if (!isTRUE(entry$approved)) {
      if (identical(entry$status, "stale")) "release_desfasada" else "release_no_aprobada"
    } else if (!entry$base %in% disponibles) {
      "sin_fuente"
    } else ""
    if (nzchar(motivo)) {
      excluidas[[length(excluidas) + 1L]] <- list(base = entry$base, actor = entry$actor, motivo = motivo)
    } else {
      incluidas <- c(incluidas, entry$base)
    }
  }
  list(incluidas = incluidas, excluidas = excluidas, sources = sources)
}

# Refs `base$variable` de una fila, acotadas a las bases que participan.
.graficos_plan_consolidado_refs_fila <- function(fila, bases) {
  vars <- fila$variables %||% list()
  vars <- vars[names(vars) %in% bases]
  vapply(names(vars), function(b) paste0(b, "$", vars[[b]]), character(1), USE.NAMES = FALSE)
}

# Filas que el bloqueo de escala del consolidado rechazaría: la firma se calcula
# como lo hace el bloqueo (`.graficos_consolidado_scale_spec`, variable resuelta).
.graficos_plan_consolidado_vetos_escala <- function(filas, bases, sources) {
  vetos <- list()
  for (i in seq_along(filas)) {
    refs <- .graficos_plan_consolidado_refs_fila(filas[[i]], bases)
    if (length(refs) < 2L) next
    ctx <- lapply(refs, .graficos_consolidado_ref_context, sources = sources)
    if (!all(vapply(ctx, function(x) isTRUE(x$exists), logical(1)))) next
    firmas <- vapply(ctx, function(x) .graficos_consolidado_scale_spec(x)$signature, character(1))
    if (all(nzchar(firmas)) && length(unique(firmas)) == 1L) next
    vetos[[as.character(i)]] <- list(motivo = "escala_incompatible",
                                     detalle = paste(unique(firmas), collapse = " || "))
  }
  vetos
}

# Bloque de la matriz para el compartido. Tras derivar se comprueba con el propio
# bloqueo; si algo aún se rechazaría (escalas que sólo chocan entre temas de un
# mismo bloque), sus filas se vetan y se vuelve a derivar.
.graficos_plan_consolidado_bloque <- function(sid, s, marco) {
  filas <- ((s$equivalencias_publicos %||% list())$filas) %||% list()
  bases <- marco$incluidas
  inst <- .equiv_inst_por_base(sid)
  inst <- inst[names(inst) %in% bases]
  vetos <- .graficos_plan_consolidado_vetos_escala(filas, bases, marco$sources)
  derivado <- NULL
  for (intento in seq_len(3L)) {
    derivado <- .graficos_plan_desde_equivalencias(sid, bases = bases, inst_por_base = inst, vetadas = vetos)
    bloqueos <- .graficos_consolidado_scale_blockers(derivado$plan, bases, marco$sources)
    if (!length(bloqueos)) break
    refs_bloqueadas <- unique(unlist(lapply(bloqueos, function(b) unlist(b$refs)), use.names = FALSE))
    nuevas <- setdiff(which(vapply(filas, function(f) {
      any(.graficos_plan_consolidado_refs_fila(f, bases) %in% refs_bloqueadas)
    }, logical(1))), as.integer(names(vetos)))
    if (!length(nuevas)) break
    for (i in nuevas) {
      vetos[[as.character(i)]] <- list(motivo = "escala_incompatible",
                                       detalle = "comparte bloque con una escala distinta")
    }
  }
  # Red final: una lámina que el bloqueo rechazaría nunca se propone.
  bloqueos <- .graficos_consolidado_scale_blockers(derivado$plan, bases, marco$sources)
  if (length(bloqueos)) {
    ids <- unique(vapply(bloqueos, function(b) as.character(b$slide_id), character(1)))
    caidas <- Filter(function(sl) as.character(sl$id %||% "") %in% ids, derivado$plan$slides)
    derivado$plan$slides <- Filter(function(sl) !as.character(sl$id %||% "") %in% ids, derivado$plan$slides)
    for (sl in caidas) {
      derivado$fuera[[length(derivado$fuera) + 1L]] <- list(
        etiqueta = as.character((sl$payload %||% list())$titulo %||% sl$id), motivo = "escala_incompatible",
        detalle = "", variables = as.list(.graficos_collect_plan_refs(list(slides = list(sl)))))
    }
  }
  derivado$n_diapositivas <- length(derivado$plan$slides)
  derivado$refs <- .graficos_collect_plan_refs(derivado$plan)
  derivado
}

.graficos_plan_consolidado_aviso <- function(code, message) list(code = code, message = message)

.graficos_plan_consolidado_avisos <- function(disponible, declarada, excluidas, reducida, fuera) {
  avisos <- list()
  if (!isTRUE(disponible)) {
    avisos[[length(avisos) + 1L]] <- .graficos_plan_consolidado_aviso("matriz_no_disponible",
      "La equivalencia entre públicos no está disponible: el informe se propone sin láminas comparativas.")
  } else if (!isTRUE(declarada)) {
    avisos[[length(avisos) + 1L]] <- .graficos_plan_consolidado_aviso("sin_matriz",
      "No hay equivalencias declaradas: el informe se propone sin láminas que comparen públicos.")
  }
  if (length(excluidas)) {
    actores <- vapply(excluidas, function(x) as.character(x$actor %||% x$base), character(1))
    avisos[[length(avisos) + 1L]] <- .graficos_plan_consolidado_aviso("bases_excluidas", sprintf(
      "Sin release aprobada y vigente, quedan fuera de la propuesta: %s.", paste(actores, collapse = ", ")))
  }
  if (length(reducida)) {
    avisos[[length(avisos) + 1L]] <- .graficos_plan_consolidado_aviso("cobertura_reducida", sprintf(
      "%d comparaciones entran con menos públicos de los declarados.", length(reducida)))
  }
  n_escala <- sum(vapply(fuera %||% list(), function(x) identical(x$motivo, "escala_incompatible"), logical(1)))
  if (n_escala) {
    avisos[[length(avisos) + 1L]] <- .graficos_plan_consolidado_aviso("escala_incompatible", sprintf(
      "%d comparaciones no se proponen porque sus públicos no comparten la escala.", n_escala))
  }
  avisos
}

.graficos_plan_consolidado_n_equiv <- function(plan) {
  as.integer(sum(vapply((plan %||% list())$slides %||% list(), function(sl) {
    identical(as.character((sl %||% list())$origen %||% ""), "equivalencias")
  }, logical(1))))
}

#' Propuesta del informe compartido (ADR 0096).
#'
#' `fuente = "equivalencias"` devuelve sólo el bloque de la matriz; sin fuente,
#' la propuesta compuesta: el bloque de la matriz en lugar de la sección
#' comparativa y las láminas por fuente sin las referencias que ya consumió.
#' `sources` evita recalcular las fuentes cuando llama el preflight.
#' @noRd
.graficos_plan_sugerido_consolidado <- function(sid, config = NULL, fuente = "", sources = NULL) {
  s <- session_get(sid)
  on.exit({ .session_env[[sid]] <- s }, add = TRUE)
  fuente <- tolower(trimws(as.character(fuente %||% "")[1]))
  if (is.na(fuente)) fuente <- ""
  cfg <- .graficos_plan_consolidado_config(sid, s, config)
  marco <- .graficos_plan_consolidado_marco(sid, s, sources)
  disponible <- .equiv_disponible(sid)
  equiv <- s$equivalencias_publicos
  declarada <- !is.null(equiv) && length(equiv$filas %||% list()) > 0L
  bloque <- if (isTRUE(disponible) && declarada) {
    .graficos_plan_consolidado_bloque(sid, s, marco)
  } else {
    list(plan = list(slides = list()), refs = character(0), fuera = list(),
         radar_pendiente = list(), cobertura_reducida = list(), revision = "")
  }

  if (identical(fuente, "equivalencias")) {
    plan <- bloque$plan
    coverage <- list()
    warnings <- character(0)
  } else {
    base <- .graficos_suggested_plan(sid, config = cfg, alcance = list(
      config = cfg, fuentes = marco$incluidas,
      bloque = list(slides = bloque$plan$slides %||% list(), refs = bloque$refs)))
    plan <- base$plan
    coverage <- base$coverage %||% list()
    warnings <- base$warnings %||% list()
  }
  n_equiv <- .graficos_plan_consolidado_n_equiv(plan)
  list(
    ok = TRUE,
    plan = plan,
    report_scope = "consolidado",
    fuente = if (identical(fuente, "equivalencias")) "equivalencias" else "consolidado",
    contiene_equivalencias = n_equiv > 0L,
    declarada = isTRUE(declarada),
    revision = if (declarada) .equiv_declaracion_revision(equiv, .equiv_inst_por_base(sid)) else "",
    n_diapositivas = n_equiv,
    fuera = bloque$fuera %||% list(),
    radar_pendiente = bloque$radar_pendiente %||% list(),
    bases_incluidas = as.list(marco$incluidas),
    bases_excluidas = marco$excluidas,
    cobertura_reducida = bloque$cobertura_reducida %||% list(),
    avisos_equivalencias = .graficos_plan_consolidado_avisos(
      disponible, declarada, marco$excluidas, bloque$cobertura_reducida, bloque$fuera),
    coverage = coverage,
    warnings = warnings
  )
}

# Bloque aditivo `equivalencias` del preflight. Con plan derivado repite lo que
# dijo la propuesta; con plan autorado sólo describe la matriz vigente.
.graficos_plan_consolidado_resumen <- function(sid, plan, sugerido = NULL) {
  n_equiv <- .graficos_plan_consolidado_n_equiv(plan)
  if (is.null(sugerido)) {
    equiv <- (session_get(sid, required = FALSE) %||% list())$equivalencias_publicos
    declarada <- !is.null(equiv) && length(equiv$filas %||% list()) > 0L
    revision <- if (declarada) .equiv_declaracion_revision(equiv, .equiv_inst_por_base(sid)) else ""
    avisos <- .graficos_plan_consolidado_avisos(.equiv_disponible(sid), declarada, list(), list(), list())
  } else {
    declarada <- isTRUE(sugerido$declarada)
    revision <- as.character(sugerido$revision %||% "")
    avisos <- sugerido$avisos_equivalencias %||% list()
  }
  list(
    declarada = declarada,
    revision = revision,
    origen_plan = if (is.null(sugerido)) "autorado" else "derivado",
    contiene_equivalencias = n_equiv > 0L,
    n_diapositivas = n_equiv,
    avisos = avisos
  )
}
