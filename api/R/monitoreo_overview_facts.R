# =============================================================================
# Coherencia home de proyecto <-> vista viva de cada familia de Monitoreo
# =============================================================================
#
# El home arma la tarjeta de Monitoreo desde el snapshot (ver
# .overview_monitoreo_facts en project_overview.R). Leer ahi el tablero guardado
# fallaba de tres formas distintas, una por familia:
#
#   territorial  `snapshot$dashboard$territorial_reports$kpis` SOLO se reescribe
#                con report_scope = "full". La pagina "Avance territorial"
#                recomputa con "advance_summary" y deliberadamente NO reescribe
#                `snapshot$dashboard` para no romper `dashboard_cache_token` /
#                `dashboard_cache_key`, atados al scope "full". El home quedaba
#                con el ultimo tablero completo (85.7% / 1028 de 1351) mientras
#                la vista viva ya mostraba el avance fresco.
#   telefonico   el snapshot no guarda `dashboard` en absoluto, asi que el home
#                leia ceros: "0 recolectados" sobre 2.726 filas sincronizadas y
#                423 efectivas ya calculadas por el warm start.
#   acreditacion `dashboard$kpis` mezclaba el numerador del bloque generico
#                (filas crudas de todas las fuentes) con la meta: daba 444.9%.
#                El denominador (287) SI era la meta legitima; lo que fallaba
#                era contar filas en vez de entrevistas efectivas.
#
# Eje de la tarjeta: el avance se mide contra la META (cuanto falta por
# levantar). Cuanto se ha recorrido de la base es un dato importante, pero
# secundario, y baja a fact.
#
# Solucion: campos livianos y dedicados en el snapshot que espejan los KPIs que
# la vista viva de cada familia acaba de servir. El home los prefiere sobre el
# tablero guardado. No se toca el token ni el scope del tablero "full", asi que
# el resto de lectores de `snapshot$dashboard` sigue viendo un tablero coherente.
#
# Para acreditacion/telefonico el espejo NO sale del bloque `kpis` generico sino
# de `client_report$actors`, que es la tabla estructurada por actor con Universo
# / Efectivas / Parciales / Sin respuesta / Meta — la misma fuente del "Reporte
# de avance para cliente" que ve el usuario. Agregarla da exactamente el par
# (efectivas, universo) que el modulo publica.

# KPIs minimos que consume la tarjeta de Monitoreo territorial del home. Deben
# coincidir con las llaves que lee .overview_monitoreo_facts (project_overview.R).
.MONITOREO_OVERVIEW_TERRITORIAL_KEYS <- c(
  "total_respuestas", "validas", "meta", "avance_pct", "revision", "geo_no_defendible"
)

# Extrae del tablero servido los KPIs territoriales que la tarjeta del home
# necesita. Devuelve NULL si el tablero no trae KPIs territoriales utilizables
# (asi el caller no espeja ruido y el home cae al fallback del tablero).
monitoreo_territorial_overview_facts <- function(dashboard) {
  if (!is.list(dashboard)) return(NULL)
  kpis <- (dashboard$territorial_reports %||% list())$kpis %||% NULL
  if (!is.list(kpis) || !length(kpis)) return(NULL)
  facts <- kpis[.MONITOREO_OVERVIEW_TERRITORIAL_KEYS]
  names(facts) <- .MONITOREO_OVERVIEW_TERRITORIAL_KEYS
  # Sin ninguna senal real (todo NULL) no vale la pena espejar nada.
  if (all(vapply(facts, is.null, logical(1)))) return(NULL)
  facts
}

# Llaves del espejo de efectividad (acreditacion y telefonico).
#
# El avance del operativo se mide contra la META: cuanto falta por levantar.
# `universo` es cuanto se ha recorrido de la base — dato importante, pero
# secundario frente al avance. Se espejan los dos porcentajes porque no todos
# los estudios declaran meta: `avance_pct` (sobre meta) es el principal y
# `avance_universo_pct` es el respaldo cuando no hay meta que perseguir.
.MONITOREO_OVERVIEW_EFECTIVIDAD_KEYS <- c(
  "efectivas", "universo", "parciales", "sin_respuesta", "meta",
  "avance_pct", "avance_universo_pct", "actores", "actores_cumplidos",
  "rezagado", "rezagado_pct", "inconsistencias"
)

# Suma una columna de un tabular que puede venir orientado por columna
# (data.frame) o por fila (lista de registros, que es como viaja tras el
# round-trip JSON/RDS del .pulso). Ignora los NA: `Meta` es NA cuando el actor
# no declara minimo.
.monitoreo_overview_sum_col <- function(tabular, colname) {
  if (is.null(tabular)) return(0)
  values <- if (is.data.frame(tabular)) {
    tabular[[colname]]
  } else if (is.list(tabular)) {
    lapply(tabular, function(row) if (is.list(row)) row[[colname]] else NULL)
  } else {
    NULL
  }
  nums <- suppressWarnings(as.numeric(unlist(values, use.names = FALSE)))
  if (!length(nums)) return(0)
  sum(nums[is.finite(nums)])
}

.monitoreo_overview_rows_count <- function(tabular) {
  if (is.null(tabular)) return(0L)
  if (is.data.frame(tabular)) return(nrow(tabular))
  if (is.list(tabular)) return(length(tabular))
  0L
}

# Espejo de efectividad para acreditacion/telefonico, agregado desde
# `client_report$actors`. Devuelve NULL cuando el tablero no trae ese reporte
# (el caller no espeja ruido y el home cae al fallback).
monitoreo_efectividad_overview_facts <- function(dashboard) {
  if (!is.list(dashboard)) return(NULL)
  report <- (dashboard$acreditacion_reports %||% list())$client_report %||% NULL
  actors <- (report %||% list())$actors %||% NULL
  if (.monitoreo_overview_rows_count(actors) == 0L) return(NULL)
  efectivas <- .monitoreo_overview_sum_col(actors, "Efectivas")
  universo <- .monitoreo_overview_sum_col(actors, "Universo")
  # La meta puede venir declarada por actor (columna `Meta`) o, mas comun en los
  # estudios reales, solo en la config: `objetivo_total` o la suma de `goals`.
  # El engine ya resolvio esa cascada al construir `kpis$target`, asi que ese es
  # el respaldo correcto en vez de reimplementarla aqui.
  meta <- .monitoreo_overview_sum_col(actors, "Meta")
  if (!(meta > 0)) meta <- .monitoreo_num((dashboard$kpis %||% list())$target, 0)
  if (!is.finite(meta) || meta < 0) meta <- 0
  # Mismos cocientes que publica el modulo (.monitoreo_client_report_pct
  # devuelve proporcion 0-1; la tarjeta muestra porcentaje).
  pct_meta <- .monitoreo_client_report_pct(efectivas, meta)
  pct_universo <- .monitoreo_client_report_pct(efectivas, universo)
  as_pct <- function(p) if (is.finite(p)) round(100 * p, 1) else -1
  # Con cuotas por actor, el agregado esconde al que esta parado: en un estudio
  # real Egresados iba al 58% y Estudiantes al 1%, y el promedio decia 36%. El
  # agregado sigue siendo la cifra (orienta y es comparable entre proyectos)
  # pero viaja ademas quien va ultimo, que es donde hay que mirar.
  rezagado <- .monitoreo_overview_worst_actor(actors)
  list(
    efectivas = as.integer(efectivas),
    universo = as.integer(universo),
    parciales = as.integer(.monitoreo_overview_sum_col(actors, "Parciales")),
    sin_respuesta = as.integer(.monitoreo_overview_sum_col(actors, "Sin respuesta")),
    meta = as.integer(meta),
    avance_pct = as_pct(pct_meta),
    avance_universo_pct = as_pct(pct_universo),
    actores = as.integer(.monitoreo_overview_rows_count(actors)),
    actores_cumplidos = as.integer(.monitoreo_overview_actors_done(actors)),
    rezagado = .monitoreo_scalar(rezagado$actor, ""),
    rezagado_pct = if (is.finite(rezagado$pct)) round(100 * rezagado$pct, 1) else -1,
    inconsistencias = as.integer(.monitoreo_num((dashboard$kpis %||% list())$inconsistencies, 0))
  )
}

# Fila-a-fila del tabular de actores, tolerando df o lista de registros.
.monitoreo_overview_actor_rows <- function(actors) {
  if (is.data.frame(actors)) {
    if (!nrow(actors)) return(list())
    return(lapply(seq_len(nrow(actors)), function(i) as.list(actors[i, , drop = FALSE])))
  }
  if (is.list(actors)) return(actors)
  list()
}

# Avance de un actor: contra su meta si la declara, contra su universo si no.
.monitoreo_overview_actor_pct <- function(row) {
  efectivas <- .monitoreo_num(row$Efectivas, NA_real_)
  meta <- .monitoreo_num(row$Meta, NA_real_)
  den <- if (is.finite(meta) && meta > 0) meta else .monitoreo_num(row$Universo, NA_real_)
  .monitoreo_client_report_pct(efectivas, den)
}

.monitoreo_overview_worst_actor <- function(actors) {
  rows <- .monitoreo_overview_actor_rows(actors)
  # Con un solo actor no hay "rezagado": el agregado ya lo dice todo.
  if (length(rows) < 2L) return(list(actor = "", pct = NA_real_))
  worst <- list(actor = "", pct = NA_real_)
  for (row in rows) {
    if (!is.list(row)) next
    pct <- .monitoreo_overview_actor_pct(row)
    if (!is.finite(pct)) next
    if (!is.finite(worst$pct) || pct < worst$pct) {
      worst <- list(actor = .monitoreo_scalar(row$Actor, ""), pct = pct)
    }
  }
  worst
}

.monitoreo_overview_actors_done <- function(actors) {
  rows <- .monitoreo_overview_actor_rows(actors)
  sum(vapply(rows, function(row) {
    if (!is.list(row)) return(FALSE)
    pct <- .monitoreo_overview_actor_pct(row)
    isTRUE(is.finite(pct) && pct >= 1)
  }, logical(1)))
}

# Espejo de aulas universitarias. Aqui el tablero de la familia ya vive bajo
# `aulas_universitarias_reports`; el espejo solo garantiza frescura (mismas
# llaves que ya consumia el home, sin cambiar su semantica).
.MONITOREO_OVERVIEW_AULAS_KEYS <- c(
  "respuestas_total", "respuestas_validas", "avance_pct", "quota_cells_pending", "brechas"
)

monitoreo_aulas_overview_facts <- function(dashboard) {
  if (!is.list(dashboard)) return(NULL)
  kpis <- (dashboard$aulas_universitarias_reports %||% list())$kpis %||% NULL
  if (!is.list(kpis) || !length(kpis)) return(NULL)
  facts <- kpis[.MONITOREO_OVERVIEW_AULAS_KEYS]
  names(facts) <- .MONITOREO_OVERVIEW_AULAS_KEYS
  if (all(vapply(facts, is.null, logical(1)))) return(NULL)
  facts
}

# Campo del snapshot donde vive el espejo de cada familia. Un campo por familia
# (en vez de uno solo compartido) porque `territorial_overview_facts` ya tiene
# lectores fuera del home — el handoff de carga cuenta el universo desde ahi.
.monitoreo_overview_facts_field <- function(family) {
  switch(
    .monitoreo_scalar(family, ""),
    territorial = "territorial_overview_facts",
    acreditacion = "efectividad_overview_facts",
    telefonico = "efectividad_overview_facts",
    aulas_universitarias = "aulas_overview_facts",
    NULL
  )
}

.monitoreo_overview_facts_for_family <- function(dashboard, family) {
  switch(
    .monitoreo_scalar(family, ""),
    territorial = monitoreo_territorial_overview_facts(dashboard),
    acreditacion = monitoreo_efectividad_overview_facts(dashboard),
    telefonico = monitoreo_efectividad_overview_facts(dashboard),
    aulas_universitarias = monitoreo_aulas_overview_facts(dashboard),
    NULL
  )
}

# Refresca el espejo de la familia con los KPIs que la vista viva acaba de
# servir. Devuelve list(snapshot = , changed = ) para que el caller persista
# SOLO cuando de verdad cambio (evita churn innecesario de session_set en cada
# carga del payload).
monitoreo_snapshot_refresh_overview_facts <- function(snapshot, dashboard, family) {
  if (!is.list(snapshot)) return(list(snapshot = snapshot, changed = FALSE))
  field <- .monitoreo_overview_facts_field(family)
  if (is.null(field)) return(list(snapshot = snapshot, changed = FALSE))
  facts <- .monitoreo_overview_facts_for_family(dashboard, family)
  if (is.null(facts)) return(list(snapshot = snapshot, changed = FALSE))
  if (identical(snapshot[[field]] %||% NULL, facts)) {
    return(list(snapshot = snapshot, changed = FALSE))
  }
  snapshot[[field]] <- facts
  list(snapshot = snapshot, changed = TRUE)
}

# Compat: el refresco territorial nombrado, que ya tenia llamadores y tests.
monitoreo_snapshot_refresh_territorial_facts <- function(snapshot, dashboard) {
  monitoreo_snapshot_refresh_overview_facts(snapshot, dashboard, "territorial")
}

# Persiste el espejo en sesion y devuelve el snapshot vigente. Preserva el flag
# `project_dirty`: el espejo es cache derivado del tablero que se acaba de
# servir, no una edicion del usuario, asi que abrir un proyecto y mirarlo no
# puede dejarlo marcado como "sin guardar". Si el proyecto ya estaba sucio se
# respeta ese estado.
monitoreo_snapshot_store_overview_facts <- function(sid, snapshot, dashboard, family) {
  out <- monitoreo_snapshot_refresh_overview_facts(snapshot, dashboard, family)
  if (!isTRUE(out$changed)) return(snapshot)
  was_dirty <- isTRUE(session_get(sid, required = FALSE)$project_dirty)
  session_set(sid, "monitoreo_snapshot", out$snapshot)
  if (!isTRUE(was_dirty)) session_set(sid, "project_dirty", FALSE)
  out$snapshot
}
