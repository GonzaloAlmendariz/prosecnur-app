# =============================================================================
# Limpieza (M5): lo que publica la pestaña Cierre de Validación
# =============================================================================
# `GET /api/validacion/v2/limpieza` gana el campo `cierre` (build_limpieza):
#
#   cadena_casos          de los casos recibidos a los que cuentan, con su
#                         invariante: recibidos - fuera - excluidos = cuentan.
#   decisiones_aplicadas  por decisión lista, qué hizo al aplicarse (excluye,
#                         cambia valores, sin cambios, no se aplica) y cuánto.
#   archivos              base limpia, registro, revisión y paquete
#                         metodológico, con su estado (al día, desactualizado,
#                         nunca generado) y fecha.
#
# Momento de las cifras. Con la base cerrada, las cifras son las del cierre: se
# guardan al cerrar (`artifacts$cierre_cifras`), porque después la base vigente
# ya es la limpia y volver a simular sobre ella da cero exclusiones. Con la base
# abierta, son las previstas por la vista previa.
#
# Grano: caso = fila de la tabla principal de la base que se limpia. Las
# exclusiones cruzan por el identificador de caso que resolvió el motor de la
# limpieza (`case_id` del registro de exclusiones), nunca por posición.
#
# Regla de atribución: un caso que excluyen dos o más decisiones se atribuye a
# la primera que lo excluye en el orden de aplicación (el orden de las
# decisiones listas en el borrador, el mismo que sigue el motor). Las demás lo
# cuentan en `n_filas_ya_excluidas`. Así la suma por decisión no cuenta dos
# veces un caso y es igual al total de casos excluidos. Las celdas siguen la
# misma regla por construcción: el motor aplica en orden y cada decisión anota
# solo las celdas que ella cambió.

.LIMPIEZA_REGLA_ATRIBUCION <- paste(
  "Un caso que excluyen varias decisiones se atribuye a la primera que lo",
  "excluye en el orden de aplicación; las demás lo cuentan como ya excluido."
)

# ---- Firma de lo que describe un archivo del cierre -------------------------

# Dos partes, para poder decir la causa de un archivo desactualizado: las
# decisiones listas (sin sus fechas, que cambian al volver a guardar lo mismo)
# y la auditoría sobre la que se decidieron.
.limpieza_firma_cierre <- function(scope) {
  listas <- Filter(function(d) identical(as.character(d$status %||% ""), "ready"),
                   scope$limpieza_draft %||% list())
  campos <- c("id", "source_id", "action_type", "target_variable", "action_params",
              "target_case_ids", "target_case_ids_resueltos", "identificacion_casos",
              "rationale")
  normalizadas <- lapply(listas, function(d) d[intersect(campos, names(d))])
  ev <- scope$evaluacion
  auditoria <- if (is.null(ev)) NA_character_ else digest::digest(list(
    auditada_en = as.character(ev$auditada_en %||% NA_character_)[1L],
    reglas = as.character(ev$resumen$id_regla %||% character(0)),
    n = as.integer(ev$resumen$n_inconsistencias %||% integer(0))
  ), algo = "xxhash64")
  list(decisiones = digest::digest(normalizadas, algo = "xxhash64"),
       auditoria = auditoria)
}

# ---- Atribución de exclusiones ----------------------------------------------

# Una fila por caso excluido. `excluded` es el registro de exclusiones del motor
# (`preview$logs$excluded_cases`: una fila por decisión y caso, en orden de
# aplicación). La primera decisión que nombra el caso se lo queda.
.limpieza_atribuir_exclusiones <- function(excluded) {
  vacio <- data.frame(case_id = character(0), decision_id = character(0),
                      source_id = character(0), rationale = character(0),
                      otras_decisiones = character(0), otras_reglas = character(0),
                      stringsAsFactors = FALSE)
  if (!is.data.frame(excluded) || !nrow(excluded) || !("case_id" %in% names(excluded))) {
    return(vacio)
  }
  ids <- as.character(excluded$case_id)
  primeras <- !duplicated(ids)
  out <- data.frame(
    case_id = ids[primeras],
    decision_id = as.character(excluded$decision_id %||% "")[primeras],
    source_id = as.character(excluded$source_id %||% "")[primeras],
    rationale = as.character(excluded$rationale %||% "")[primeras],
    stringsAsFactors = FALSE
  )
  otras <- function(col) vapply(out$case_id, function(id) {
    resto <- excluded[[col]][ids == id][-1L]
    paste(unique(as.character(resto)), collapse = ", ")
  }, character(1), USE.NAMES = FALSE)
  out$otras_decisiones <- otras("decision_id")
  out$otras_reglas <- otras("source_id")
  out
}

# ---- Decisiones aplicadas ---------------------------------------------------

# Por decisión lista, lo que hizo al aplicarse. `draft` son las decisiones tal
# como las publica `build_limpieza()` (con `aplicable` y `n_casos_aplicados` de
# M4: no se recalculan aquí). `logs` e `impact` son los de la vista previa.
#
#   efecto  "excluye" (sacó al menos un caso, propio o ya excluido),
#           "cambia_valores" (cambió al menos una celda), "sin_cambios" o
#           "no_se_aplica" (`aplicable = false`).
.limpieza_decisiones_aplicadas <- function(draft, logs, impact) {
  listas <- Filter(function(d) identical(as.character(d$status %||% ""), "ready"), draft %||% list())
  atrib <- .limpieza_atribuir_exclusiones(logs$excluded_cases)
  excl <- logs$excluded_cases
  trace <- logs$trace
  celdas_de <- function(id) {
    if (!is.data.frame(trace) || !nrow(trace) || !all(c("decision_id", "n_celdas") %in% names(trace))) return(0L)
    as.integer(sum(as.integer(trace$n_celdas[as.character(trace$decision_id) == id]), na.rm = TRUE))
  }
  filas <- lapply(listas, function(d) {
    id <- as.character(d$id %||% "")[1L]
    propias <- as.integer(sum(atrib$decision_id == id))
    nombradas <- if (is.data.frame(excl) && nrow(excl)) {
      length(unique(as.character(excl$case_id[as.character(excl$decision_id) == id])))
    } else 0L
    celdas <- celdas_de(id)
    aplicable <- !identical(d$aplicable, FALSE)
    efecto <- if (!aplicable) "no_se_aplica"
      else if (nombradas > 0L) "excluye"
      else if (celdas > 0L) "cambia_valores"
      else "sin_cambios"
    list(
      decision_id = id,
      source_id = as.character(d$source_id %||% NA_character_)[1L],
      action_type = as.character(d$action_type %||% NA_character_)[1L],
      target_variable = as.character(d$target_variable %||% NA_character_)[1L],
      rationale = as.character(d$rationale %||% NA_character_)[1L],
      decidida_en = as.character(d$updated_at %||% NA_character_)[1L],
      efecto = efecto,
      n_filas_excluidas = propias,
      n_filas_ya_excluidas = as.integer(nombradas - propias),
      n_celdas_cambiadas = celdas,
      n_casos_revisados = if (identical(efecto, "sin_cambios")) {
        suppressWarnings(as.integer(d$n_casos_aplicados %||% NA_integer_))[1L]
      } else NA_integer_,
      aplicable = aplicable,
      motivo_no_aplicable = if (aplicable) NA_character_ else as.character(d$motivo_no_aplicable %||% NA_character_)[1L]
    )
  })
  suma <- function(campo, efecto) {
    v <- vapply(Filter(function(f) identical(f$efecto, efecto), filas),
                function(f) as.integer(f[[campo]] %||% NA_integer_), integer(1))
    if (!length(v)) 0L else as.integer(sum(v, na.rm = TRUE))
  }
  n_grupo <- function(efecto) as.integer(sum(vapply(filas, function(f) identical(f$efecto, efecto), logical(1))))
  total_excluidos <- as.integer(sum(vapply(filas, function(f) f$n_filas_excluidas, integer(1))))
  total_celdas <- as.integer(sum(vapply(filas, function(f) f$n_celdas_cambiadas, integer(1))))
  impacto_excl <- suppressWarnings(as.integer(impact$cases_excluded %||% NA_integer_))[1L]
  impacto_celdas <- suppressWarnings(as.integer(impact$cells_changed %||% NA_integer_))[1L]
  list(
    regla_atribucion = .LIMPIEZA_REGLA_ATRIBUCION,
    decisiones = filas,
    grupos = list(
      list(efecto = "excluye", n_decisiones = n_grupo("excluye"),
           cifra = total_excluidos, unidad = "casos excluidos"),
      list(efecto = "cambia_valores", n_decisiones = n_grupo("cambia_valores"),
           cifra = suma("n_celdas_cambiadas", "cambia_valores"), unidad = "valores cambiados"),
      # Suma por decisión: un caso revisado bajo dos reglas cuenta en cada una.
      list(efecto = "sin_cambios", n_decisiones = n_grupo("sin_cambios"),
           cifra = suma("n_casos_revisados", "sin_cambios"), unidad = "revisiones de casos"),
      list(efecto = "no_se_aplica", n_decisiones = n_grupo("no_se_aplica"),
           cifra = NA_integer_, unidad = NA_character_)
    ),
    totales = list(
      n_casos_excluidos = total_excluidos,
      n_celdas_cambiadas = total_celdas,
      # La suma por decisión es igual a lo que contó el motor al aplicar. Si no
      # lo es (identificadores de caso repetidos), se dice; no se corrige.
      cuadra_con_motor = isTRUE(identical(total_excluidos, impacto_excl) &&
                                  identical(total_celdas, impacto_celdas))
    ),
    casos_excluidos = atrib
  )
}

# ---- Cifras del cierre (lo que se guarda al cerrar) -------------------------

# Lo medido por la vista previa que hace falta para la cadena y la tabla. Se
# guarda al cerrar porque después la vista previa se mide sobre la base limpia.
.limpieza_cierre_cifras <- function(preview, draft) {
  aplicadas <- .limpieza_decisiones_aplicadas(draft, preview$logs %||% list(), preview$impact %||% list())
  # Los identificadores de los casos excluidos no se guardan en el proyecto: la
  # hoja por caso se escribe al cerrar, desde la vista previa.
  aplicadas$casos_excluidos <- NULL
  int1 <- function(x) suppressWarnings(as.integer(x %||% NA_integer_))[1L]
  list(
    filas_base = int1(preview$before$filas_base),
    fuera_de_la_auditoria = int1(preview$before$filas_fuera_universo),
    excluidos_en_limpieza = int1(preview$impact$cases_excluded),
    cuentan_medidos = int1(preview$after$filas_evaluadas),
    decisiones_aplicadas = aplicadas
  )
}

# ---- Cadena de casos ----------------------------------------------------------

# De los recibidos a los que cuentan. `cifras` sale de `.limpieza_cierre_cifras`
# (guardadas al cerrar o medidas ahora); `universo` de
# `.validacion_upstream_universe()` (filtro de pruebas y depuración externa);
# `linaje` es `bases[[b]]$limpieza` (la promoción vigente).
#
#   recibidos - retirados_fuera_de_la_app - pruebas - sin_clasificar
#     - por_reglas_de_carga - fuera_de_la_auditoria - excluidos_en_limpieza
#     = cuentan
#
# `cuentan` se mide aparte (filas evaluadas después de aplicar) y `cuadra` dice
# si la resta llega a esa cifra. Un tramo que no se puede medir va NA con su
# causa en `avisos`; la cadena no se completa con supuestos.
.limpieza_cadena_casos <- function(cifras, universo = NULL, linaje = NULL, cerrada = FALSE) {
  avisos <- list()
  avisar <- function(codigo, texto) avisos[[length(avisos) + 1L]] <<- list(codigo = codigo, texto = texto)
  int1 <- function(x) suppressWarnings(as.integer(x %||% NA_integer_))[1L]

  promovida <- isTRUE((linaje %||% list())$enabled)
  base_limpieza <- cifras$filas_base
  excluidos <- cifras$excluidos_en_limpieza
  if (isTRUE(cerrada) && promovida) {
    # El linaje guarda el N del primer salto: en un segundo cierre la vista
    # previa ya se mide sobre la base limpia y no ve las exclusiones.
    antes <- int1(linaje$n_casos_antes); despues <- int1(linaje$n_casos_despues)
    if (!is.na(antes) && !is.na(despues)) {
      base_limpieza <- antes
      excluidos <- antes - despues
    }
  } else if (!isTRUE(cerrada) && promovida) {
    avisar("base_vigente_ya_limpia", paste(
      "La base vigente es la limpia del cierre anterior: las cifras previstas",
      "se miden sobre ella y no cuentan las exclusiones de ese cierre."))
  }

  u <- universo %||% list()
  filtro <- isTRUE(u$applied)
  pruebas <- if (filtro) int1(u$excluded_test) else 0L
  sin_clasificar <- if (filtro) int1(u$excluded_unclassified) else 0L
  por_reglas <- if (filtro) int1(u$excluded_rules %||% 0L) else 0L
  cargados <- if (filtro) int1(u$total) else base_limpieza
  if (filtro && !is.na(base_limpieza) &&
      !identical(as.integer(cargados - pruebas - sin_clasificar - por_reglas), base_limpieza)) {
    avisar("filtro_de_pruebas_no_empalma", paste(
      "El filtro de pruebas describe otra base: lo que dejó no coincide con la",
      "base que se limpia."))
  }
  externo <- isTRUE(u$external_applied)
  retirados <- if (externo) int1(u$excluded_external) else 0L
  recibidos <- if (externo) int1(u$received_external) else cargados

  fuera_auditoria <- cifras$fuera_de_la_auditoria
  if (is.na(fuera_auditoria)) {
    avisar("fuera_de_la_auditoria_sin_medir", paste(
      "No se pudo medir cuántos casos quedaron fuera de la auditoría: la base",
      "no conserva la fila de origen de cada caso."))
  }
  cuentan <- cifras$cuentan_medidos
  esperado <- recibidos - retirados - pruebas - sin_clasificar - por_reglas - fuera_auditoria - excluidos
  cuadra <- if (is.na(esperado) || is.na(cuentan)) NA else identical(as.integer(esperado), cuentan)
  if (isFALSE(cuadra)) {
    avisar("cadena_no_cuadra", sprintf(
      "La resta de los tramos da %s casos y se midieron %s que cuentan.",
      esperado, cuentan))
  }
  list(
    momento = if (isTRUE(cerrada)) "al_cerrar" else "prevista",
    recibidos = recibidos,
    n_fuentes = NA_integer_,
    causa_n_fuentes = "El motor no registra de cuántas fuentes viene la base.",
    fuera = list(
      retirados_fuera_de_la_app = retirados,
      pruebas = pruebas,
      sin_clasificar = sin_clasificar,
      por_reglas_de_carga = por_reglas,
      fuera_de_la_auditoria = fuera_auditoria
    ),
    excluidos_en_limpieza = excluidos,
    cuentan = cuentan,
    proporcion = if (is.na(cuentan) || is.na(recibidos) || recibidos <= 0L) NA_real_
                 else round(cuentan / recibidos, 4),
    cuadra = cuadra,
    filtro_de_pruebas = filtro,
    depuracion_externa = externo,
    base_promovida = promovida,
    base = "casos de la tabla principal de la base; proporción sobre los recibidos",
    avisos = avisos
  )
}

# ---- Archivos del cierre ------------------------------------------------------

.LIMPIEZA_ARCHIVOS_CIERRE <- list(
  base_limpia = list(nombre = "Base limpia", kind = "base_limpia"),
  registro = list(nombre = "Registro de limpieza", kind = "excel_detalle"),
  revision = list(nombre = "Revisión de limpieza", kind = "reporte_html"),
  paquete_metodologico = list(nombre = "Paquete metodológico", kind = NA_character_)
)

# Anota en el scope de la base qué archivo se generó y sobre qué firma. Vive en
# `limpieza_archivos`, aparte de `limpieza_artifacts`: cambiar una decisión
# vacía los artefactos, y este registro es el que permite decir después que el
# archivo quedó desactualizado en vez de que nunca se generó.
.limpieza_registrar_archivo <- function(sid, base_nombre, clave, meta, firma, extra = list()) {
  # Misma resolución de base que el resto del cierre; sin estudio (sesión
  # anterior a multibase) no hay scope por base donde anotar.
  s <- session_get(sid, required = FALSE)
  base_nombre <- if (is.null(s)) NULL else tryCatch(.resolve_base_nombre(s, base_nombre), error = function(e) NULL)
  if (is.null(meta) || is.null(base_nombre) || !nzchar(calc_str(base_nombre, ""))) return(invisible(NULL))
  if (!(clave %in% names(.LIMPIEZA_ARCHIVOS_CIERRE))) {
    stop_api(500, "E_INTERNAL", sprintf("Clave de archivo del cierre desconocida: %s", clave))
  }
  registro <- validacion_scope_get(sid, base_nombre, "limpieza_archivos") %||% list()
  registro[[clave]] <- c(list(
    file_id = calc_str(meta$file_id, NA_character_),
    nombre = calc_str(meta$original_name, NA_character_),
    formato = tolower(calc_str(meta$ext, NA_character_)),
    generado_en = calc_str(meta$uploaded_at, NA_character_),
    firma = firma
  ), extra)
  validacion_scope_set(sid, base_nombre, "limpieza_archivos", registro)
  invisible(registro[[clave]])
}

# Estado de cada archivo del cierre, en el orden de la pantalla.
#   estado  "al_dia" (se generó sobre las decisiones y la auditoría de hoy),
#           "desactualizado" (cambió alguna de las dos; `causas` dice cuál),
#           "no_generado", o NA con `causa_estado` si no hay cómo saberlo.
#   disponible  el archivo sigue en esta sesión (los entregables no viajan en
#               el proyecto; `guardado_en` dice si hay una copia al lado).
limpieza_archivos_cierre <- function(sid, base_nombre, scope) {
  registro <- scope$limpieza_archivos %||% list()
  actual <- .limpieza_firma_cierre(scope)
  s <- session_get(sid, required = FALSE)
  previos <- scope$limpieza_artifacts$files %||% list()
  # Un artefacto sin forma de archivo (un .pulso viejo o de prueba) no cuenta.
  kinds_previos <- vapply(previos, function(f) if (is.list(f)) calc_str(f$kind, "") else "", character(1))
  lapply(names(.LIMPIEZA_ARCHIVOS_CIERRE), function(clave) {
    def <- .LIMPIEZA_ARCHIVOS_CIERRE[[clave]]
    rec <- registro[[clave]]
    base <- list(clave = clave, nombre = def$nombre, archivo = NA_character_,
                 formato = NA_character_, estado = "no_generado", causas = list(),
                 causa_estado = NA_character_, generado_en = NA_character_,
                 file_id = NA_character_, disponible = FALSE,
                 guardado_en = NA_character_, contenido = list())
    if (is.null(rec)) {
      if (!is.na(def$kind) && def$kind %in% kinds_previos) {
        # Cerrada antes de este registro: el archivo existe pero no se anotó
        # sobre qué decisiones se generó.
        f <- previos[[match(def$kind, kinds_previos)]]
        base$estado <- NA_character_
        base$causa_estado <- "Se generó antes de que se registrara sobre qué decisiones; vuelve a cerrar la base para saberlo."
        base$file_id <- calc_str(f$file_id, NA_character_)
        base$archivo <- calc_str(f$original_name %||% f$filename, NA_character_)
        base$formato <- tolower(calc_str(f$ext, NA_character_))
        base$generado_en <- calc_str(f$generated_at, NA_character_)
      } else {
        return(base)
      }
    } else {
      causas <- list()
      if (!identical(rec$firma$decisiones, actual$decisiones)) causas[[length(causas) + 1L]] <- "cambiaron_las_decisiones"
      if (!identical(rec$firma$auditoria, actual$auditoria)) causas[[length(causas) + 1L]] <- "cambio_la_auditoria"
      base$estado <- if (length(causas)) "desactualizado" else "al_dia"
      base$causas <- causas
      base$file_id <- rec$file_id
      base$archivo <- rec$nombre
      base$formato <- rec$formato
      base$generado_en <- rec$generado_en
      base$contenido <- as.list(as.character(unlist(rec$contenido %||% list(), use.names = FALSE)))
    }
    meta <- if (!is.null(s) && !is.na(base$file_id)) s$files[[base$file_id]] else NULL
    base$disponible <- !is.null(meta) && file.exists(calc_str(meta$path, ""))
    base$guardado_en <- if (is.null(meta)) NA_character_ else calc_str(meta$guardado_en, NA_character_)
    base
  })
}

# ---- Lo que publica GET /limpieza --------------------------------------------

#' Resumen de la pestaña Cierre de Validación (M5)
#'
#' @param sid sesión. @param base_nombre base leída. @param scope scope de la base.
#' @param preview vista previa de `build_limpieza()`. @param draft decisiones
#'   publicadas (con aplicabilidad y seguimiento).
#' @return lista `cierre` (ver encabezado del archivo).
#' @keywords internal
limpieza_cierre_resumen <- function(sid, base_nombre, scope, preview, draft) {
  artifacts <- scope$limpieza_artifacts %||% list()
  cerrada <- nzchar(calc_str(artifacts$finalized_at, ""))
  guardadas <- artifacts$cierre_cifras
  cifras <- if (cerrada && !is.null(guardadas)) guardadas
            else if (!cerrada && !is.null(preview)) .limpieza_cierre_cifras(preview, draft)
            else NULL
  linaje <- if (!is.null(sid)) .limpieza_linaje_vigente(sid, base_nombre) else NULL
  universo <- if (!is.null(sid)) tryCatch(.validacion_upstream_universe(sid, base_nombre), error = function(e) NULL) else NULL
  sin_cifras <- if (is.null(cifras)) {
    if (cerrada) "La base se cerró antes de que se guardaran las cifras del cierre; vuelve a cerrarla para verlas."
    else "No hay vista previa de la limpieza."
  } else NA_character_
  aplicadas <- cifras$decisiones_aplicadas
  list(
    estado = if (cerrada) "cerrada" else "abierta",
    cerrada_en = if (cerrada) calc_str(artifacts$finalized_at, NA_character_) else NA_character_,
    causa_sin_cifras = sin_cifras,
    cadena_casos = if (is.null(cifras)) NA else .limpieza_cadena_casos(cifras, universo, linaje, cerrada),
    decisiones_aplicadas = aplicadas %||% NA,
    archivos = if (is.null(sid)) list() else limpieza_archivos_cierre(sid, base_nombre, scope)
  )
}

# ---- Hojas nuevas del registro de limpieza -----------------------------------

# Una fila por caso excluido, con la decisión a la que se atribuye. `nombres` es
# un vector con nombre source_id -> nombre de la regla (de la cola publicada,
# por identificador).
.limpieza_hoja_excluidos_por_caso <- function(atrib, draft, nombres = character(0)) {
  if (!is.data.frame(atrib) || !nrow(atrib)) {
    return(data.frame(Caso = character(0), Regla = character(0), `Nombre de la regla` = character(0),
                      `Acción` = character(0), Motivo = character(0), `Fecha de la decisión` = character(0),
                      `También la excluyen` = character(0), check.names = FALSE, stringsAsFactors = FALSE))
  }
  ids_draft <- vapply(draft %||% list(), function(d) calc_str(d$id, ""), character(1))
  fecha <- vapply(atrib$decision_id, function(id) {
    d <- (draft %||% list())[ids_draft == id]
    if (!length(d)) NA_character_ else calc_str(d[[1]]$updated_at, NA_character_)
  }, character(1), USE.NAMES = FALSE)
  nombre <- unname(nombres[atrib$source_id])
  data.frame(
    Caso = atrib$case_id,
    Regla = atrib$source_id,
    `Nombre de la regla` = ifelse(is.na(nombre), "", nombre),
    `Acción` = "Excluir el caso",
    Motivo = atrib$rationale,
    `Fecha de la decisión` = fecha,
    `También la excluyen` = atrib$otras_reglas,
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# La cadena de casos como tabla de dos columnas.
.limpieza_hoja_cuenta_casos <- function(cadena) {
  if (!is.list(cadena)) return(data.frame(Tramo = character(0), Casos = integer(0)))
  f <- cadena$fuera
  data.frame(
    Tramo = c("Recibidos", "Retirados antes de cargar", "Pruebas", "Sin clasificar",
              "Excluidos por reglas de carga", "Fuera de la auditoría",
              "Excluidos en limpieza", "Cuentan"),
    Casos = c(cadena$recibidos, f$retirados_fuera_de_la_app, f$pruebas, f$sin_clasificar,
              f$por_reglas_de_carga, f$fuera_de_la_auditoria, cadena$excluidos_en_limpieza,
              cadena$cuentan),
    stringsAsFactors = FALSE
  )
}

# ---- Integración con limpieza_finalize() --------------------------------------

# Al cerrar: las cifras que se guardan con el cierre y las dos hojas nuevas del
# registro. `payload` es el de `build_limpieza()` con la vista previa del cierre.
.limpieza_cierre_al_finalizar <- function(sid, base_nombre, preview, payload, linaje) {
  draft <- payload$decision_draft %||% list()
  cifras <- .limpieza_cierre_cifras(preview, draft)
  universo <- tryCatch(.validacion_upstream_universe(sid, base_nombre), error = function(e) NULL)
  cadena <- .limpieza_cadena_casos(cifras, universo, linaje, cerrada = TRUE)
  cola <- payload$decision_queue %||% list()
  nombres <- stats::setNames(
    vapply(cola, function(x) calc_str(x$nombre_regla, ""), character(1)),
    vapply(cola, function(x) calc_str(x$source_id, ""), character(1)))
  atrib <- .limpieza_atribuir_exclusiones(preview$logs$excluded_cases)
  list(
    cifras = cifras,
    hojas = list(
      "Excluidos por caso" = .limpieza_hoja_excluidos_por_caso(atrib, draft, nombres),
      "Cuenta de casos" = .limpieza_hoja_cuenta_casos(cadena)
    )
  )
}

# Anota los tres archivos que escribe el cierre con la firma de hoy.
.limpieza_registrar_archivos_al_cerrar <- function(sid, base_nombre, scope, metas) {
  firma <- .limpieza_firma_cierre(scope)
  for (clave in names(metas)) {
    .limpieza_registrar_archivo(sid, base_nombre, clave, metas[[clave]], firma)
  }
  invisible(TRUE)
}
