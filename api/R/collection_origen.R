# collection_origen.R — de donde salen las unidades del plan y que cambio (E1e).
#
# `.collection_source_vigente()` solo compara el `run_id` del plan con el de la
# seleccion: dice «es de otra corrida», no QUE cambio. Y `source_ref$fingerprint`
# se sella al sembrar sobre las unidades enteras —orden incluido— y nadie lo
# recalcula, asi que no sirve para preguntar «¿rehacer cambiaria algo?».
#
# Aqui se responde esa pregunta con una proyeccion propia (`origen_aulas/v1`)
# calculada al LEER sobre los dos lados con la misma funcion: las unidades del
# plan guardado y las que sembraria hoy la fuente (`.collection_seed_units()`,
# la misma mitad que usa `.collection_seed_build()`). Por eso, tras rehacer,
# Origen dice «al dia» por construccion.
#
# La lectura es pura: no valida el estado completo (2 s con 2.373 unidades), no
# toca revision ni `project_dirty` y no devuelve correos, enlaces, `access_ref`
# ni el nombre del docente.

COLLECTION_ORIGEN_SCHEMA <- "collection_origen/v1"
COLLECTION_ORIGEN_PROYECCION <- "origen_aulas/v1"

# Campos que el equipo lee de la unidad: nombre publico -> origen en la unidad.
# `codigo` es el `legacy_ref` (CH 19), `label` vive en la raiz de la unidad.
.COLLECTION_ORIGEN_DATOS <- c(
  codigo = "legacy_ref", label = ".label", facultad = "faculty", escuela = "program",
  curso = "course_name", horario = "schedule", aula = "venue", docente = "teacher",
  elegibles = "eligible_n", matriculados = "enrolled_total", muestra = "sample_label"
)
# El lugar de la unidad en el sorteo: se lista aparte porque cambia la cadena,
# no la ficha.
.COLLECTION_ORIGEN_ROL <- c(
  rol = ".role", cadena = "replacement_for", orden = "replacement_order",
  secuencia = "operational_sequence"
)
# La composicion del aula entra como un solo campo, sin valores: es de donde
# Monitoreo deriva cuotas, no algo que se lea en la lista.
.COLLECTION_ORIGEN_COMPOSICION <- c(
  "stratum", "sex_top_1", "sex_top_1_n", "sex_top_2", "sex_top_2_n", "level_composition"
)
.COLLECTION_ORIGEN_NUMERICOS <- c(
  "eligible_n", "enrolled_total", "replacement_order", "operational_sequence",
  "sex_top_1_n", "sex_top_2_n"
)
# Dato personal: se dice QUE cambio, nunca a quien.
.COLLECTION_ORIGEN_SENSIBLES <- "docente"
.COLLECTION_ORIGEN_NIVELES <- c("diferencias", "resumen")
.COLLECTION_ORIGEN_LIMITE_MAX <- 5000L

# --- Proyeccion -------------------------------------------------------------

.collection_origen_chr <- function(v) {
  if (!length(v)) return("")
  v <- v[[1]]
  if (is.factor(v)) v <- as.character(v)
  if (is.list(v) || is.na(v)) return("")
  as.character(v)
}

.collection_origen_num <- function(v) {
  if (!length(v)) return(NA_real_)
  v <- v[[1]]
  if (is.list(v)) return(NA_real_)
  out <- suppressWarnings(as.numeric(as.character(v)))
  if (length(out) != 1L || !is.finite(out)) NA_real_ else out
}

# Un numero se compara por su valor y no por su tipo: un plan que paso por JSON
# trae 32L donde el sorteo trae 32.
.collection_origen_fmt_num <- function(x) {
  out <- rep("", length(x))
  ok <- !is.na(x)
  out[ok] <- format(x[ok], scientific = FALSE, trim = TRUE, digits = 15)
  out
}

.collection_origen_columna <- function(units, dims, origen) {
  if (identical(origen, ".label")) return(vapply(units, function(u) .collection_origen_chr(u$label), ""))
  if (identical(origen, ".role")) return(vapply(units, function(u) .collection_origen_chr(u$role), ""))
  if (origen %in% .COLLECTION_ORIGEN_NUMERICOS) {
    return(.collection_origen_fmt_num(vapply(dims, function(d) .collection_origen_num(d[[origen]]), 0)))
  }
  vapply(dims, function(d) .collection_origen_chr(d[[origen]]), "")
}

#' Proyeccion `origen_aulas/v1` de un juego de unidades.
#'
#' La clave es el curso-horario (`dimensions$classroom_id`, con `legacy_ref` de
#' respaldo), no `unit_id`: `unit_id` deriva del codigo operativo, que cambia
#' entre corridas («AULA n» -> «CH n») aunque el aula sea la misma. Una clave
#' repetida se numera (`clave#2`, `clave#3`) en el orden en que llega.
#'
#' Columnas de texto y ordenadas por clave (radix, sin locale): reordenar el
#' plan no cambia la huella.
#'
#' @return lista con `version`, `columnas` (vectores alineados, ordenados por
#'   clave), `unit_id` (alineado, FUERA de la huella) y `repetidas` (claves con
#'   mas de una unidad).
#' @keywords internal
.collection_origen_proyeccion <- function(units) {
  units <- if (is.list(units)) Filter(is.list, units) else list()
  dims <- lapply(units, function(u) if (is.list(u$dimensions)) u$dimensions else list())
  aula <- vapply(dims, function(d) .collection_origen_chr(d$classroom_id), "")
  ref <- vapply(dims, function(d) .collection_origen_chr(d$legacy_ref), "")
  clave <- ifelse(nzchar(trimws(aula)), aula, ref)
  vez <- if (length(clave)) stats::ave(seq_along(clave), clave, FUN = seq_along) else integer(0)
  repetidas <- unique(clave[vez > 1L])
  clave[vez > 1L] <- paste0(clave[vez > 1L], "#", vez[vez > 1L])

  columnas <- list(clave = clave)
  for (campo in names(.COLLECTION_ORIGEN_DATOS)) {
    columnas[[campo]] <- .collection_origen_columna(units, dims, .COLLECTION_ORIGEN_DATOS[[campo]])
  }
  for (campo in names(.COLLECTION_ORIGEN_ROL)) {
    columnas[[campo]] <- .collection_origen_columna(units, dims, .COLLECTION_ORIGEN_ROL[[campo]])
  }
  partes <- lapply(.COLLECTION_ORIGEN_COMPOSICION, function(o) .collection_origen_columna(units, dims, o))
  columnas$composicion <- if (length(units)) do.call(paste, c(partes, sep = "\u001f")) else character(0)

  orden <- order(clave, method = "radix")
  list(
    version = COLLECTION_ORIGEN_PROYECCION,
    columnas = lapply(columnas, function(x) x[orden]),
    unit_id = vapply(units, function(u) .collection_origen_chr(u$unit_id), "")[orden],
    repetidas = repetidas
  )
}

#' Huella de una proyeccion: `collection_fingerprint` de version + columnas.
#'
#' Cada columna entra ya serializada como arreglo JSON (inyectivo: comillas y
#' separadores escapados). Canonicalizar 17 x 2.400 hojas una por una costaba
#' 0,28 s por lado; asi, el orden de claves sigue canonico y el contenido igual.
#' @keywords internal
.collection_origen_huella <- function(proyeccion) {
  columnas <- lapply(proyeccion$columnas, function(x) {
    as.character(jsonlite::toJSON(as.character(x), auto_unbox = FALSE))
  })
  collection_fingerprint(list(version = proyeccion$version, columnas = columnas))
}

# --- Comparacion ------------------------------------------------------------

# Banco al final; dentro, cadena por numero y el titular antes que sus reservas.
# Mismo recorrido que `.collection_orden_operativo()`.
.collection_origen_orden <- function(p, idx) {
  cols <- p$columnas
  banco <- tolower(cols$rol[idx]) == "extra_reserve_pool"
  secuencia <- suppressWarnings(as.numeric(cols$secuencia[idx]))
  secuencia[is.na(secuencia)] <- Inf
  orden <- suppressWarnings(as.numeric(cols$orden[idx]))
  orden[is.na(orden)] <- 0
  idx[order(banco, secuencia, orden, cols$clave[idx], method = "radix")]
}

.collection_origen_salida <- function(campo, valor) {
  if (!nzchar(valor)) return(NA)
  if (campo %in% c("elegibles", "matriculados", "orden", "secuencia")) return(as.numeric(valor))
  valor
}

.collection_origen_unidad <- function(p, i) {
  cols <- p$columnas
  list(
    clave = cols$clave[[i]], unit_id = p$unit_id[[i]], codigo = cols$codigo[[i]],
    rol = cols$rol[[i]], facultad = .collection_origen_salida("facultad", cols$facultad[[i]]),
    curso = .collection_origen_salida("curso", cols$curso[[i]])
  )
}

# Una entrada por campo que cambio, en las filas `ips` (plan) / `jfs` (fuente).
.collection_origen_entradas <- function(plan, fuente, ips, jfs, campos, con_sensible) {
  pc <- plan$columnas
  fc <- fuente$columnas
  out <- list()
  for (k in seq_along(ips)) {
    ip <- ips[[k]]
    jf <- jfs[[k]]
    for (campo in campos) {
      antes <- pc[[campo]][[ip]]
      despues <- fc[[campo]][[jf]]
      if (identical(antes, despues)) next
      oculto <- campo %in% c(.COLLECTION_ORIGEN_SENSIBLES, "composicion")
      e <- list(
        clave = pc$clave[[ip]], unit_id = plan$unit_id[[ip]], codigo = pc$codigo[[ip]],
        campo = campo,
        antes = if (oculto) NA else .collection_origen_salida(campo, antes),
        despues = if (oculto) NA else .collection_origen_salida(campo, despues)
      )
      if (con_sensible) e$sensible <- campo %in% .COLLECTION_ORIGEN_SENSIBLES
      out[[length(out) + 1L]] <- e
    }
  }
  out
}

#' Compara la proyeccion del plan con la de la fuente.
#'
#' @return lista con indices de altas (en `fuente`), bajas (en `plan`) y las
#'   entradas de campos y roles ya ordenadas; cifras sin truncar.
#' @keywords internal
.collection_origen_comparar <- function(plan, fuente) {
  pc <- plan$columnas
  fc <- fuente$columnas
  en_plan <- match(fc$clave, pc$clave)
  altas <- .collection_origen_orden(fuente, which(is.na(en_plan)))
  bajas <- .collection_origen_orden(plan, which(is.na(match(pc$clave, fc$clave))))
  comunes_f <- which(!is.na(en_plan))
  comunes_p <- en_plan[comunes_f]
  # Las entradas se recorren en el orden operativo del plan.
  recorrido <- .collection_origen_orden(plan, comunes_p)
  pos_f <- comunes_f[match(recorrido, comunes_p)]

  campos_datos <- c(names(.COLLECTION_ORIGEN_DATOS), "composicion")
  campos_rol <- names(.COLLECTION_ORIGEN_ROL)
  # Barrido vectorizado primero: solo se arman entradas para las filas que
  # difieren, que con 2.400 unidades y la fuente al dia son cero.
  difiere <- function(campos) {
    if (!length(recorrido)) return(logical(0))
    Reduce(`|`, lapply(campos, function(c) pc[[c]][recorrido] != fc[[c]][pos_f]))
  }
  d_datos <- difiere(campos_datos)
  d_rol <- difiere(campos_rol)
  campos <- .collection_origen_entradas(plan, fuente, recorrido[d_datos], pos_f[d_datos],
                                        campos_datos, con_sensible = TRUE)
  roles <- .collection_origen_entradas(plan, fuente, recorrido[d_rol], pos_f[d_rol],
                                       campos_rol, con_sensible = FALSE)
  sel <- which(d_datos | d_rol)
  list(
    altas = altas, bajas = bajas, campos = campos, roles = roles,
    unidades_con_cambios = recorrido[sel],
    sin_cambio = length(recorrido) - length(sel)
  )
}

# --- Fuente -----------------------------------------------------------------

.collection_origen_run_selection <- function(s) {
  sel <- s$calc_muestra_aulas_selection
  filas <- if (is.list(sel) && !is.null(sel$selection)) sel$selection else NULL
  col <- if (is.data.frame(filas)) filas[["selection_run_id"]] else NULL
  run <- if (length(col)) .cm_aulas_scalar(col[[1]], "") else ""
  if (!nzchar(run) && is.list(sel)) run <- .cm_aulas_scalar(sel$selection_run_id, "")
  run
}

# «AAAA-MM-DD» del sello de un run del sorteo (`sel_aulas_20260801211224_…`);
# NA si el run no lleva fecha (corridas de QA, planes legacy).
.collection_origen_fecha_run <- function(run_id) {
  m <- regmatches(run_id %||% "", regexec("(20[0-9]{2})([01][0-9])([0-3][0-9])[0-9]{6}", run_id %||% ""))[[1]]
  if (length(m) != 4L) return(NA)
  paste(m[2:4], collapse = "-")
}

#' ¿La copia de Monitoreo es el eco de este mismo plan?
#'
#' La entrega (`collection_handoff`) escribe `monitoreo_aulas_plan` DESDE el
#' plan, y la siembra prefiere esa copia. Desde ese momento comparar el plan con
#' «la fuente» es compararlo consigo mismo pasado por la proyeccion de la
#' entrega, que crea filas sin `classroom_id` propio, sin escuela y sin aula: el
#' diff saldria entero en altas y bajas sin que nada cambiara.
#'
#' Eco = la fuente es Monitoreo, el plan esta entregado y TODAS sus filas llevan
#' el `collection_deployment_id` de este despliegue.
#' @keywords internal
.collection_origen_circular <- function(fuente, state) {
  if (!identical(fuente$source, "monitoreo_aulas_plan") || !length(fuente$rows)) return(FALSE)
  dep <- state$deployment
  if (!is.list(dep) || !identical(.cm_aulas_scalar(dep$status, ""), "handed_off")) return(FALSE)
  id <- .cm_aulas_scalar(dep$deployment_id, "")
  if (!nzchar(id)) return(FALSE)
  marcas <- vapply(fuente$rows, function(r) .collection_origen_chr(r$collection_deployment_id), "")
  all(marcas == id)
}

# La fuente que gana es Monitoreo (decision del lead: E1e no cambia eso), pero
# si Calculo de muestra tiene un sorteo mas nuevo que la copia de Monitoreo,
# rehacer desde aqui no lo traeria: hay que actualizar Monitoreo primero.
.collection_origen_intermedia_desfasada <- function(fuente, run_fuente, run_sorteo, circular, plan_run) {
  if (!identical(fuente$source, "monitoreo_aulas_plan") || !nzchar(run_sorteo)) return(FALSE)
  copia <- if (isTRUE(circular)) plan_run else run_fuente
  if (!nzchar(copia) || identical(copia, "legacy-monitoreo-aulas")) return(FALSE)
  !identical(copia, run_sorteo)
}

# --- Afectadas --------------------------------------------------------------

.collection_origen_afectadas <- function(state, unit_ids, altas_n) {
  instancias <- .cm_instances(state)
  cubiertas <- lapply(instancias, function(x) as.character(unlist(x$unit_refs %||% list(), use.names = FALSE)))
  tocadas <- vapply(cubiertas, function(u) any(u %in% unit_ids), logical(1))
  bindings <- state$deployment$bindings %||% list()
  b_ids <- vapply(Filter(is.list, bindings), function(b) .collection_origen_chr(b$unit_id), "")
  list(
    unidades = as.integer(length(unit_ids) + altas_n),
    fichas = as.integer(sum(tocadas)),
    unidades_con_ficha = as.integer(length(intersect(unit_ids, unique(unlist(cubiertas))))),
    accesos = as.integer(sum(b_ids %in% unit_ids))
  )
}

.collection_origen_fichas_total <- function(state) {
  instancias <- .cm_instances(state)
  cubiertas <- unique(unlist(lapply(instancias, function(x) {
    as.character(unlist(x$unit_refs %||% list(), use.names = FALSE))
  }), use.names = FALSE))
  list(fichas = length(instancias), unidades = length(cubiertas[!is.na(cubiertas) & nzchar(cubiertas)]))
}

# --- Parametros -------------------------------------------------------------

.collection_origen_nivel <- function(nivel) {
  v <- calc_str(nivel %||% "", "")
  if (!nzchar(v)) return("diferencias")
  if (!v %in% .COLLECTION_ORIGEN_NIVELES) {
    stop_api(400, "E_COLLECTION_ORIGEN_PARAMETRO",
             "nivel debe ser «diferencias» o «resumen».", details = list(nivel = v))
  }
  v
}

.collection_origen_limite <- function(limite) {
  if (is.null(limite) || !length(limite) || identical(as.character(limite[[1]]), "")) return(200L)
  v <- calc_int(limite[[1]], NA_integer_, min = 1L, max = .COLLECTION_ORIGEN_LIMITE_MAX)
  if (is.na(v) || suppressWarnings(as.numeric(limite[[1]])) != v) {
    stop_api(400, "E_COLLECTION_ORIGEN_PARAMETRO",
             sprintf("limite debe ser un entero entre 1 y %d.", .COLLECTION_ORIGEN_LIMITE_MAX),
             details = list(limite = as.character(limite[[1]])))
  }
  v
}

# --- Lectura ----------------------------------------------------------------

#' Diferencias entre el plan guardado y lo que sembraria hoy la fuente.
#'
#' Nucleo compartido por la lectura de Origen y por la previsualizacion del
#' reseed, para que las dos cuenten lo mismo.
#'
#' @param state collection_state (sin validar).
#' @param fuente salida de `.collection_seed_units()`.
#' @param atajo_circular si TRUE y la fuente es el eco del plan, compara el plan
#'   consigo mismo (ver `.collection_origen_circular`).
#' @keywords internal
.collection_origen_diferencias <- function(state, fuente, atajo_circular = TRUE) {
  plan_units <- state$plan$units %||% list()
  p_plan <- .collection_origen_proyeccion(plan_units)
  circular <- .collection_origen_circular(fuente, state)
  p_fuente <- if (circular && isTRUE(atajo_circular)) p_plan else .collection_origen_proyeccion(fuente$units)
  list(
    plan = p_plan, fuente = p_fuente, circular = circular,
    huella_plan = .collection_origen_huella(p_plan),
    huella_fuente = .collection_origen_huella(p_fuente),
    cmp = .collection_origen_comparar(p_plan, p_fuente)
  )
}

.collection_origen_cortar <- function(x, limite) {
  list(items = if (length(x) > limite) x[seq_len(limite)] else x, truncado = length(x) > limite)
}

#' GET /api/recopiladores/origen.
#'
#' @param sid sesion.
#' @param nivel "diferencias" (defecto) o "resumen" (no construye unidades).
#' @param limite tope por lista de cambios (1..5000, defecto 200).
#' @return payload `collection_origen/v1`.
collection_origen_get <- function(sid, nivel = "diferencias", limite = 200L) {
  nivel <- .collection_origen_nivel(nivel)
  limite <- .collection_origen_limite(limite)
  s <- session_get(sid)
  state <- s$collection_state
  plan <- if (is.list(state)) state$plan else NULL
  hay_plan <- is.list(plan) && length(plan)
  plan_run <- if (hay_plan) .cm_aulas_scalar(plan$source_ref$run_id, "") else ""

  # Resumen: la fuente se cuenta pero no se construye.
  fuente <- if (identical(nivel, "resumen")) {
    src <- .collection_seed_source(s)
    list(units = NULL, rows = src$rows, source = src$source, module = src$module,
         rows_n = length(src$rows),
         run_id = if (length(src$rows)) {
           .collection_first_string(src$rows[[1]], c("selection_run_id", "run_id"), "legacy-monitoreo-aulas")
         } else NULL)
  } else {
    .collection_seed_units(s)
  }
  hay_fuente <- fuente$rows_n > 0L
  run_fuente <- .cm_aulas_scalar(fuente$run_id, "")
  run_sorteo <- .collection_origen_run_selection(s)
  circular <- hay_plan && .collection_origen_circular(fuente, state)
  intermedia <- .collection_origen_intermedia_desfasada(fuente, run_fuente, run_sorteo, circular, plan_run)
  vigencia <- if (hay_plan) .collection_source_vigente(s, state) else NULL
  entregado <- hay_plan && identical(.cm_aulas_scalar(state$deployment$status, ""), "handed_off")
  fichas <- if (hay_plan) .collection_origen_fichas_total(state) else list(fichas = 0L, unidades = 0L)

  dif <- NULL
  if (!identical(nivel, "resumen") && hay_plan && hay_fuente) {
    dif <- .collection_origen_diferencias(state, fuente)
  }

  estado <- if (!hay_plan) {
    "sin_plan"
  } else if (!hay_fuente) {
    "sin_fuente"
  } else if (!is.null(dif)) {
    # Por datos: «al dia» = rehacer no cambiaria nada. Que Monitoreo tenga una
    # copia vieja del sorteo lo dice `fuente_intermedia_desfasada`, no esto:
    # rehacer desde aqui tampoco lo arreglaria.
    if (identical(dif$huella_plan, dif$huella_fuente)) "al_dia" else "cambio"
  } else if (circular) {
    "al_dia"
  } else if (identical(run_fuente, plan_run)) {
    "al_dia"
  } else {
    "cambio"
  }

  resumen <- list(
    altas = NA, bajas = NA, campos = NA, unidades_con_cambios = NA, roles = NA,
    sin_cambio = NA, claves_repetidas = NA,
    afectadas = list(unidades = NA, fichas = as.integer(fichas$fichas),
                     unidades_con_ficha = as.integer(fichas$unidades),
                     accesos = if (hay_plan) length(state$deployment$bindings %||% list()) else 0L),
    fichas_total = as.integer(fichas$fichas),
    entregado = entregado
  )
  cambios <- NA
  truncado <- NA
  if (!is.null(dif)) {
    cmp <- dif$cmp
    afectadas_ids <- c(dif$plan$unit_id[cmp$bajas], dif$plan$unit_id[cmp$unidades_con_cambios])
    resumen$altas <- length(cmp$altas)
    resumen$bajas <- length(cmp$bajas)
    resumen$campos <- length(cmp$campos)
    resumen$unidades_con_cambios <- length(cmp$unidades_con_cambios)
    resumen$roles <- length(cmp$roles)
    resumen$sin_cambio <- as.integer(cmp$sin_cambio)
    resumen$claves_repetidas <- length(union(dif$plan$repetidas, dif$fuente$repetidas))
    resumen$afectadas <- .collection_origen_afectadas(state, unique(afectadas_ids), length(cmp$altas))
    listas <- list(
      altas = lapply(cmp$altas, function(i) .collection_origen_unidad(dif$fuente, i)),
      bajas = lapply(cmp$bajas, function(i) .collection_origen_unidad(dif$plan, i)),
      campos = cmp$campos,
      roles = cmp$roles
    )
    cortes <- lapply(listas, .collection_origen_cortar, limite = limite)
    cambios <- lapply(cortes, `[[`, "items")
    truncado <- lapply(cortes, `[[`, "truncado")
  }

  na_si_vacio <- function(x) if (is.null(x) || !nzchar(x)) NA else x
  list(
    ok = TRUE,
    schema = COLLECTION_ORIGEN_SCHEMA,
    nivel = nivel,
    state_revision = if (is.list(state)) as.integer(state$state_revision %||% 0L) else 0L,
    adapter = if (hay_plan) .cm_aulas_scalar(plan$adapter$id, "aulas_v1") else "aulas_v1",
    fuente = list(
      modulo = na_si_vacio(fuente$module %||% ""),
      origen = na_si_vacio(fuente$source %||% ""),
      disponible = hay_fuente,
      run_id = na_si_vacio(run_fuente),
      fecha = .collection_origen_fecha_run(run_fuente),
      unidades = as.integer(fuente$rows_n),
      circular = circular
    ),
    plan = list(
      existe = hay_plan,
      run_id = na_si_vacio(plan_run),
      fecha = .collection_origen_fecha_run(plan_run),
      unidades = if (hay_plan) length(plan$units %||% list()) else 0L,
      huella_registrada = if (hay_plan) na_si_vacio(.cm_aulas_scalar(plan$source_ref$fingerprint, "")) else NA
    ),
    fingerprint_actual = if (is.null(dif)) NA else dif$huella_fuente,
    fingerprint_plan = if (is.null(dif)) NA else dif$huella_plan,
    sorteo_vigente = list(
      run_id = na_si_vacio(run_sorteo),
      fecha = .collection_origen_fecha_run(run_sorteo),
      generado_at = na_si_vacio(.cm_aulas_scalar((s$calc_muestra_aulas_selection %||% list())$generated_at, "")),
      desfasado = isTRUE(vigencia$desfasado)
    ),
    fuente_intermedia_desfasada = intermedia,
    estado = estado,
    stale = identical(estado, "cambio"),
    solo_corrida = !is.null(dif) && !circular && identical(dif$huella_plan, dif$huella_fuente) &&
      nzchar(run_fuente) && nzchar(plan_run) && !identical(run_fuente, plan_run),
    veredicto = if (!is.null(dif)) "huella" else if (hay_plan && hay_fuente) "corrida" else NA,
    resumen = resumen,
    cambios = cambios,
    truncado = truncado,
    limite = limite
  )
}

#' Corta el reseed si la fuente cambio desde que se miraron las diferencias.
#'
#' Ausente = sin chequeo (compatibilidad con el cliente de hoy).
#' @keywords internal
collection_origen_assert_huella <- function(sid, expected_source_fingerprint = NULL) {
  esperado <- calc_str(expected_source_fingerprint %||% "", "")
  if (!nzchar(esperado)) return(invisible(TRUE))
  s <- session_get(sid)
  state <- s$collection_state
  fuente <- .collection_seed_units(s)
  actual <- if (is.list(state) && is.list(state$plan) && fuente$rows_n > 0L) {
    .collection_origen_diferencias(state, fuente)$huella_fuente
  } else {
    ""
  }
  if (!identical(esperado, actual)) {
    stop_api(
      409, "E_COLLECTION_ORIGEN_CAMBIO",
      "La fuente cambió mientras revisabas las diferencias.",
      details = list(expected_source_fingerprint = esperado,
                     current_source_fingerprint = if (nzchar(actual)) actual else NA)
    )
  }
  invisible(TRUE)
}
