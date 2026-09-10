# Perfil operativo para monitoreo de aulas universitarias.

monitoreo_aulas_estados <- function() {
  c(
    "planificada", "contactada", "agendada", "en_campo", "aplicada",
    "parcial", "sin_acceso", "cancelada", "reemplazo_pendiente",
    "reemplazada", "cerrada"
  )
}

# Estados del AGENDAMIENTO. Son un eje distinto del de la aplicacion: un aula
# puede estar REEMPLAZADA en muestra y APLICADA en campo, porque una cosa es
# como se consiguio el aula y otra como fue la aplicacion. Medido en el estudio
# de 2025 sobre 230 aulas contactadas.
#
# B13b (D-B13 cerrada): los cinco TECLEABLES del libro son sin_contactar,
# en_contacto, agendada, reagendada y rechazo. `en_reserva` y `reemplazada`
# siguen en el vocabulario como DERIVADOS: el plan los publica (la activacion
# de reemplazos los escribe) y los libros vivos v3 los traen tecleados.
monitoreo_aulas_estados_muestra <- function() {
  c("sin_contactar", "en_contacto", "agendada", "reagendada", "rechazo",
    "en_reserva", "reemplazada")
}

# Estados de la APLICACION, tal como los escribe el parte de campo.
monitoreo_aulas_estados_aplicacion <- function() {
  c("aplicada", "no_aplicada", "pendiente")
}

#' Normaliza un estado de agendamiento a su clave canonica.
#'
#' `EN RESERVA 1` y `EN RESERVA 2` colapsan a `en_reserva`: el numero es la
#' profundidad de la cadena y ya vive en `replacement_order`; duplicarlo aqui
#' crearia tantas categorias como eslabones tenga el estudio.
#'
#' @param x valor crudo de la hoja.
#' @return clave canonica.
#' @export
monitoreo_aulas_estado_muestra <- function(x) {
  key <- .monitoreo_text_key(.monitoreo_scalar(x, ""))
  # El guion bajo pasa a ESPACIO, no se borra. Borrandolo, `en_reserva` —el
  # valor canonico que devuelve esta misma funcion— quedaba en "enreserva" y no
  # casaba con "en reserva": la funcion no reconocia su propia salida y degradaba
  # la reserva a `sin_contactar` en cada vuelta de normalizacion.
  key <- gsub("_", " ", key, fixed = TRUE)
  key <- gsub("[^a-z ]", "", key)
  key <- trimws(gsub("[[:space:]]+", " ", key))
  if (!nzchar(key)) return("sin_contactar")
  if (startsWith(key, "en reserva")) return("en_reserva")
  out <- switch(gsub(" ", "_", key, fixed = TRUE),
    agendada = "agendada",
    reagendada = "reagendada",
    reemplazada = "reemplazada",
    # B13b: los dos tecleables nuevos del dictado. Sin estas ramas, «EN
    # CONTACTO» y «RECHAZO» degradaban al default y un rechazo tecleado
    # volvia a la cola de llamadas como si nadie hubiera llamado.
    en_contacto = "en_contacto",
    rechazo = "rechazo",
    "sin_contactar"
  )
  out
}

#' Normaliza un estado de aplicacion a su clave canonica.
#'
#' @param x valor crudo del parte de campo.
#' @return clave canonica.
#' @export
monitoreo_aulas_estado_aplicacion <- function(x) {
  key <- gsub(" ", "_", .monitoreo_text_key(.monitoreo_scalar(x, "")), fixed = TRUE)
  if (!nzchar(key)) return("pendiente")
  switch(key,
    aplicada = "aplicada",
    no_aplicada = "no_aplicada",
    noaplicada = "no_aplicada",
    "pendiente"
  )
}

monitoreo_aulas_motivos_reemplazo <- function() {
  c(
    "docente_no_autoriza", "aula_no_existe", "horario_cambio",
    "virtual_no_presencial", "baja_asistencia", "cruce_logistico",
    "aula_ya_aplicada", "incidencia_etica", "otro"
  )
}

.monitoreo_aulas_df <- function(x, label = "tabla") {
  if (is.null(x)) return(data.frame(stringsAsFactors = FALSE))
  if (is.data.frame(x)) return(as.data.frame(x, stringsAsFactors = FALSE, check.names = FALSE))
  if (!is.list(x)) {
    stop(sprintf("El insumo '%s' debe ser una tabla o lista de filas.", label), call. = FALSE)
  }
  if (!length(x)) return(data.frame(stringsAsFactors = FALSE))
  rows <- vapply(x, function(item) is.list(item) || is.data.frame(item), logical(1))
  if (all(rows) && (is.null(names(x)) || !all(nzchar(names(x))))) {
    cols <- unique(unlist(lapply(x, names), use.names = FALSE))
    cols <- cols[!is.na(cols) & nzchar(cols)]
    out <- stats::setNames(lapply(cols, function(col) {
      vapply(x, function(row) .monitoreo_scalar(row[[col]], ""), character(1))
    }), cols)
    return(as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE))
  }
  as.data.frame(x, stringsAsFactors = FALSE, check.names = FALSE)
}

#' Columnas que viajan en el reporte de brechas.
#'
#' Union de lo que piden sus dos consumidores: la tabla de Consultas > Brechas
#' (`operational_code`, `label`, `respuestas_validas`, `expected_valid`,
#' `brecha`, `operational_status`) y la publicacion a Sheets
#' (`.monitoreo_publication_aulas_model_frames`, que ademas toma `classroom_id`,
#' `faculty`, `program`, `level`, `stratum` y `wave`).
#' @export
# Cuantas filas de `course_status` viajan al cliente. No es un numero magico:
# es el tope del payload, y lo que deja fuera se declara con `course_status_total`.
MONITOREO_AULAS_COURSE_STATUS_TOPE <- 500L

BRECHAS_COLUMNAS_PUBLICADAS <- c(
  "operational_code", "classroom_id", "label", "faculty", "program", "level",
  "stratum", "wave", "operational_status", "respuestas_validas",
  "expected_valid", "brecha"
)

# Lo mismo para `reemplazos`, por la MISMA razon y con mas peso.
#
# Salia con las 104 columnas del plan seguido: 1 173 filas x ~3 590 bytes =
# **4 109 KB de un payload de 10 331**, medido sobre HSVG26ULT2 el 2026-09-08.
# Y no es una lista aparte: sus 1 173 codigos estan TODOS en `agenda`, y las
# filas son identicas campo por campo salvo `motivo`. Cuatro megabytes
# duplicados para llevar una columna de texto.
#
# El comentario de `brechas`, tres lineas mas abajo, ya lo habia visto —«tanto
# como el plan entero, que ademas ya viaja dos veces»— y se quedo en el
# diagnostico.
#
# Las columnas son la UNION de lo que piden sus tres consumidores, y estan
# cubiertas por test: la tabla de Consultas (`preferredColumns`), el ordenador de
# cadena `reemplazosEnOrdenDeCadena` (`sample_role`, `operational_sequence`,
# `replacement_order`, `operational_code`, `replacement_for`,
# `titular_operational_code`, `label`) y el badge del rail (`sample_status`).
# `faculty` la pide el filtro por facultad de la seccion.
REEMPLAZOS_COLUMNAS_PUBLICADAS <- c(
  "operational_code", "classroom_id", "label", "faculty",
  "titular_operational_code", "replacement_for", "replacement_order",
  "operational_sequence", "sample_role", "sample_status", "operational_status",
  "motivo"
)

.monitoreo_aulas_records <- function(df, max_rows = Inf) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(list())
  if (is.finite(max_rows)) df <- utils::head(df, max_rows)
  lapply(seq_len(nrow(df)), function(i) as.list(df[i, , drop = FALSE]))
}

.monitoreo_aulas_col <- function(df, candidates) {
  if (!is.data.frame(df) || !ncol(df)) return("")
  candidates <- .monitoreo_chr_vec(candidates)
  if (!length(candidates)) return("")
  nms <- names(df)
  exact <- intersect(candidates, nms)
  if (length(exact)) return(exact[[1]])
  nms_key <- .monitoreo_text_key(nms)
  cand_key <- .monitoreo_text_key(candidates)
  idx <- match(cand_key, nms_key, nomatch = 0L)
  idx <- idx[idx > 0L]
  if (length(idx)) return(nms[[idx[[1]]]])
  ""
}

# `rep_len` y no `rep`: algunos defaults son VECTORES de largo nrow —el mas
# visible es `orden = getn(c("orden","order"), seq_len(n))`—, y `rep(default, n)`
# los repetia n veces en vez de ajustarlos, devolviendo n^2 valores. Al asignar
# esa columna larga, el data.frame reciclaba TODAS las demas y el plan se
# multiplicaba: 7 aulas salian como 49. Se disparaba solo cuando la columna
# faltaba, que es justo el caso de las filas que crea el handoff de
# Recopiladores.
.monitoreo_aulas_values <- function(df, col, default = "") {
  if (!is.data.frame(df) || !nrow(df)) return(character(0))
  col <- .monitoreo_scalar(col, "")
  fallback <- rep_len(default, nrow(df))
  if (!nzchar(col) || !col %in% names(df)) return(fallback)
  out <- as.character(df[[col]])
  faltan <- is.na(out)
  out[faltan] <- fallback[faltan]
  trimws(out)
}

.monitoreo_aulas_num_values <- function(df, col, default = NA_real_) {
  if (!is.data.frame(df) || !nrow(df)) return(numeric(0))
  col <- .monitoreo_scalar(col, "")
  # Ver la nota de `.monitoreo_aulas_values()`: aqui vivia el n^2.
  fallback <- rep_len(default, nrow(df))
  if (!nzchar(col) || !col %in% names(df)) return(fallback)
  out <- suppressWarnings(as.numeric(df[[col]]))
  faltan <- !is.finite(out)
  out[faltan] <- fallback[faltan]
  out
}

# Atribuye a cada fila del plan las respuestas que le corresponden.
#
# Una respuesta se identifica por el id que viajo en su QR, y ese no tiene por
# que ser `classroom_id`: Recopiladores cuelga `collection_unit_id`. Emparejar
# solo por `classroom_id` dejaba el avance de TODAS las aulas en cero mientras
# los KPI globales —que suman sin agrupar— contaban bien; el tablero se veia
# coherente en los numeros grandes y vacio donde se decide.
#
# Vive aqui y no en cada consumidor porque el emparejamiento estaba escrito DOS
# veces —en el dashboard y en `course_status`— y arreglar una sola dejaba
# brechas, estratos y reemplazos igual de ciegos.
.monitoreo_aulas_contar_por_fila <- function(rows, counts) {
  if (!is.data.frame(rows) || !nrow(rows)) return(integer(0))
  aulas <- as.character(rows$classroom_id)
  unidades <- if ("collection_unit_id" %in% names(rows)) {
    as.character(rows$collection_unit_id)
  } else {
    NULL
  }
  # Tercera clave: el QR de 2026 viaja con el CODIGO OPERATIVO (`CH 1`) y un
  # plan que no paso por el handoff de Recopiladores solo tiene el
  # curso-horario en `classroom_id` — la respuesta nueva caia a 0 en silencio
  # (medido 2026-09-01 sobre el plan de la demo: `CH 1` -> 0 atribuidas).
  codigos <- if ("operational_code" %in% names(rows)) {
    as.character(rows$operational_code)
  } else {
    NULL
  }
  # El identificador tambien llega TECLEADO (`ch1`, `R6_1`); si el plan no
  # tiene claves que colisionen, la comparacion corre en el espacio canonico y
  # esas variantes suman a su aula. Ver `.monitoreo_aulas_clave_colector()`.
  if (length(counts) && .monitoreo_aulas_claves_sin_colision(c(aulas, unidades, codigos))) {
    counts <- .monitoreo_aulas_counts_por_clave(counts)
    aulas <- .monitoreo_aulas_clave_colector(aulas)
    if (!is.null(unidades)) unidades <- .monitoreo_aulas_clave_colector(unidades)
    if (!is.null(codigos)) codigos <- .monitoreo_aulas_clave_colector(codigos)
  }
  # La fila SUMA las claves unicas que declara, no la primera que matchea: en
  # la transicion curso-horario -> codigo operativo conviven respuestas
  # repartidas entre dos claves de la MISMA aula, y el fallback excluyente se
  # quedaba con una poblacion y perdia la otra en silencio. Claves repetidas
  # dentro de la fila (post-handoff `classroom_id` == `operational_code`)
  # cuentan una sola vez.
  n <- nrow(rows)
  if (is.null(unidades)) unidades <- rep("", n)
  if (is.null(codigos)) codigos <- rep("", n)
  vapply(seq_len(n), function(i) {
    ks <- unique(c(aulas[[i]], unidades[[i]], codigos[[i]]))
    ks <- ks[!is.na(ks) & nzchar(ks)]
    if (!length(ks)) return(0L)
    sum(as.integer(counts[ks]), na.rm = TRUE)
  }, integer(1))
}

.monitoreo_aulas_status <- function(x, default = "planificada") {
  key <- .monitoreo_text_key(.monitoreo_scalar(x, default))
  key <- gsub(" ", "_", key, fixed = TRUE)
  aliases <- c(
    planificada = "planificada",
    planificado = "planificada",
    contactada = "contactada",
    agendada = "agendada",
    campo = "en_campo",
    en_campo = "en_campo",
    aplicada = "aplicada",
    completo = "aplicada",
    completed = "aplicada",
    parcial = "parcial",
    sin_acceso = "sin_acceso",
    cancelada = "cancelada",
    reemplazo_pendiente = "reemplazo_pendiente",
    reemplazada = "reemplazada",
    cerrada = "cerrada",
    # `pendiente` lo escribe el handoff de Recopiladores al crear una fila nueva
    # en el plan de Monitoreo. Significa lo mismo que `planificada`.
    pendiente = "planificada"
  )
  # `aliases[[key]]` LANZA "subscript out of bounds" con una clave desconocida:
  # `[[` sobre un vector con nombres no devuelve NULL, asi que el `%||%` no
  # llegaba a actuar nunca y cualquier estado no previsto tumbaba la vista en
  # vez de caer al default. Con `[` se obtiene NA y el fallback funciona.
  out <- unname(aliases[key])
  if (!is.na(out) && out %in% monitoreo_aulas_estados()) out else default
}

.monitoreo_aulas_reason <- function(x, default = "otro") {
  key <- .monitoreo_text_key(.monitoreo_scalar(x, default))
  key <- gsub(" ", "_", key, fixed = TRUE)
  aliases <- c(
    docente_no_autoriza = "docente_no_autoriza",
    profesor_no_autoriza = "docente_no_autoriza",
    aula_no_existe = "aula_no_existe",
    horario_cambio = "horario_cambio",
    cambio_horario = "horario_cambio",
    virtual_no_presencial = "virtual_no_presencial",
    virtual = "virtual_no_presencial",
    baja_asistencia = "baja_asistencia",
    cruce_logistico = "cruce_logistico",
    aula_ya_aplicada = "aula_ya_aplicada",
    incidencia_etica = "incidencia_etica",
    otro = "otro"
  )
  # Mismo defecto que en `.monitoreo_aulas_status()`: un motivo escrito a mano
  # que no estuviera en la tabla tumbaba la normalizacion entera.
  out <- unname(aliases[key])
  if (!is.na(out) && out %in% monitoreo_aulas_motivos_reemplazo()) out else default
}

monitoreo_aulas_default_config <- function() {
  list(
    schema = "monitoreo_aulas_universitarias_v1",
    enabled = FALSE,
    selection_run_id = "",
    frame_hash = "",
    imported_at = "",
    anonymous_responses = TRUE,
    source_mapping = list(
      classroom_id_var = "",
      collector_var = "",
      link_var = "",
      date_var = "",
      status_var = "",
      # **Qué valor de `sex_var` es cada sexo.** La plataforma devuelve el
      # CÓDIGO, no la etiqueta: `datos_demo/P2` llega como «1» y «2», y
      # `.pulso_sexo_fm()` —que reconoce «Mujer», «F», «femenino»— no puede
      # saber cuál es cuál. Sin esta declaración las columnas de sexo obtenido
      # se quedan vacías, que es lo correcto: `sub_a` ya costó una lectura al
      # revés por adivinar cuál columna era mujeres.
      sex_female_values = list(),
      sex_male_values = list(),
      # **Lo que llega por la plataforma pero NO es del estudio.** El QR de
      # capacitación y el de prueba producen envíos reales —26 de CAPACITACION y
      # 9 de PRUEBA_2026 el primer día de HSVG2026— que pasan todos los filtros
      # de validez porque son encuestas bien llenadas. No son del operativo, y
      # Gonzalo pidió que no sumen: «fuera del avance».
      #
      # Es la contracara de `valid_filters`: aquéllos dicen qué CUENTA, éstos
      # qué se descarta. Mismo formato `{var, values}`, y basta con que uno case.
      descartes = list(),
      # **La variable que dice el sexo de quien respondio** (dictado
      # 2026-09-04: «poder mapear cuantas se esperaban en total y en hombres y
      # en mujeres y cuanto obtuvimos»). Sin declararla no se cuenta por sexo y
      # la columna calla: adivinar cual de las variables de la base es el sexo
      # es exactamente el error que ya costo una lectura en este estudio.
      sex_var = "",
      # De la constante, no de una copia. La lista viajaba por DOS sitios —aqui y
      # el default de `.monitoreo_aulas_valid_response()`— y el normalizador
      # siempre rellena desde este, asi que ampliar el otro no cambiaba nada:
      # el mismo patron de cadena de whitelists que ya mordio en Graficos.
      valid_statuses = as.list(MONITOREO_AULAS_ESTADOS_VALIDOS)
    ),
    plan = list(),
    # Partes de campo de la hoja «Aulas Aplicadas». Viven junto al plan y no
    # dentro de el: son otra medida del mismo aula. Sin declararlos aqui el
    # normalizador los descartaba y el control de reconciliacion nunca veia
    # nada que comprobar.
    partes_campo = list(),
    control_sin_nombre = 0L,
    control = list(),
    quotas = list(),
    variables_control = list(),
    methodology = list(),
    representativity = list(),
    # Metas del diseño importadas de calc-muestra (ver monitoreo_aulas_metas_diseno.R).
    design_targets = list(),
    # B70 (dictado 2026-09-03): la duración de la aplicación en minutos. 30 es
    # la verdad operativa de hoy («la aplicación dura media hora»); el slider
    # de Carga de campo la edita y la persiste por aquí. Los motores de
    # ventanas/franjas/reparto la reciben por parámetro.
    duracion_aplicacion_min = 30L,
    alerts = list(
      min_valid_per_class = 1L,
      warn_partial_under_valid = 5L
    )
  )
}

# **El `$` de R parcial-matchea, y este body viene del cliente.**
#
# `config$plan` con una lista que NO trae `plan` pero SI trae `plan_rows` devuelve
# `plan_rows`. Y `plan_rows` lo anade el propio payload de estado para la UI, asi
# que el ciclo se cerraba solo: el backend emite la config con `plan_rows`, el
# front la reenvia entera al elegir el modo, y aqui `config$plan` pescaba el
# entero y reventaba con «El insumo 'plan' debe ser una tabla o lista de filas»
# —un E_INTERNAL al pulsar «Elegir» en la pantalla de modo—.
#
# Reproducido con curl contra la API: reenviar sin tocar la config que el propio
# backend acababa de devolver bastaba para el 500.
#
# `control` vs `control_sin_nombre` es la misma trampa esperando, asi que TODO el
# body se lee con `[[`, que es exacto. `defaults$` se deja como esta: es interno
# y no lo escribe nadie de fuera.
# `previous` (2026-09-08): el fallback de `source_mapping` es LO QUE YA ESTABA
# GUARDADO, no el default vacío.
#
# Esta whitelist corre en cada sincronización (`monitoreo_normalize_config`), y
# el body que le llega no siempre trae `source_mapping`: cuando no lo trae, cada
# campo caía a su default —cadena vacía— y el estudio se quedaba sin saber qué
# columna es el colector ni cuál el sexo. Medido en el `.pulso` de HSVG2026 el
# 2026-09-08: `collector_var` pasó de "collectorID" a "" y `sex_var` de
# "datos_demo/P2" a "" en una sola pulsación de «actualizar», y toda la pestaña
# de Avance quedó en cero sobre un campo con 212 efectivas.
#
# El hermano territorial ya recibía `previous` (`monitoreo_engine.R`, la línea
# de arriba de la de aulas); aulas no. Lo que llega manda, campo por campo; lo
# que no llega se conserva; sin previo, el default de siempre.
monitoreo_aulas_normalize_config <- function(config = list(), previous = list()) {
  if (is.null(config) || !is.list(config)) config <- list()
  defaults <- monitoreo_aulas_default_config()
  prev_mapping <- if (is.list(previous)) (previous[["source_mapping"]] %||% list()) else list()
  if (is.list(prev_mapping) && length(prev_mapping)) {
    for (nm in names(defaults$source_mapping)) {
      v <- prev_mapping[[nm]]
      if (!is.null(v) && length(v)) defaults$source_mapping[[nm]] <- v
    }
  }
  mapping <- config[["source_mapping"]] %||% config[["mapeo_fuentes"]] %||% list()
  if (!is.list(mapping)) mapping <- list()
  alerts <- config[["alerts"]] %||% config[["alertas"]] %||% list()
  if (!is.list(alerts)) alerts <- list()
  list(
    schema = "monitoreo_aulas_universitarias_v1",
    enabled = .monitoreo_bool(config[["enabled"]] %||% config[["activo"]], defaults$enabled),
    selection_run_id = .monitoreo_scalar(config[["selection_run_id"]] %||% config[["run_id"]], defaults$selection_run_id),
    frame_hash = .monitoreo_scalar(config[["frame_hash"]], defaults$frame_hash),
    imported_at = .monitoreo_scalar(config[["imported_at"]] %||% config[["importado_en"]], defaults$imported_at),
    anonymous_responses = .monitoreo_bool(config[["anonymous_responses"]] %||% config[["respuestas_anonimas"]], defaults$anonymous_responses),
    source_mapping = list(
      classroom_id_var = .monitoreo_scalar(mapping$classroom_id_var %||% mapping$aula_var, defaults$source_mapping$classroom_id_var),
      collector_var = .monitoreo_scalar(mapping$collector_var %||% mapping$collector, defaults$source_mapping$collector_var),
      link_var = .monitoreo_scalar(mapping$link_var %||% mapping$link, defaults$source_mapping$link_var),
      date_var = .monitoreo_scalar(mapping$date_var %||% mapping$fecha_var, defaults$source_mapping$date_var),
      status_var = .monitoreo_scalar(mapping$status_var %||% mapping$estado_var, defaults$source_mapping$status_var),
      # Misma doctrina de whitelist: sin esta linea, declararla en la UI no
      # persistiria y el campo se caeria en silencio.
      sex_var = .monitoreo_scalar(mapping$sex_var %||% mapping$sexo_var, defaults$source_mapping$sex_var),
      # Misma doctrina de whitelist que la linea de arriba: sin nombrarlos aqui,
      # declararlos no persistiria.
      # Caían a `list()` pelada en vez de a `defaults`, así que un body sin
      # mapeo también se llevaba por delante qué valor es mujer y cuál hombre.
      sex_female_values = as.list(.monitoreo_chr_vec(
        mapping$sex_female_values %||% mapping$valores_mujer %||%
          defaults$source_mapping$sex_female_values %||% list())),
      sex_male_values = as.list(.monitoreo_chr_vec(
        mapping$sex_male_values %||% mapping$valores_hombre %||%
          defaults$source_mapping$sex_male_values %||% list())),
      descartes = .monitoreo_aulas_filas_de_filtro(
        mapping$descartes %||% mapping$descartadas %||% list()),
      valid_statuses = as.list(.monitoreo_chr_vec(mapping$valid_statuses %||% mapping$estados_validos %||% defaults$source_mapping$valid_statuses)),
      # **Los filtros de encuesta efectiva, que si no se declaran AQUI se pierden
      # al guardar.** Este normalizador es la whitelist de la config: lo que no
      # nombra, no persiste, y el campo se habria caido en silencio dejando la UI
      # nueva sin efecto ninguno.
      #
      # Se limpian aqui y no en el cliente porque la config puede llegar de un
      # `.pulso` viejo o de otra sesion: **un filtro sin variable o sin valores
      # descartaria TODAS las respuestas**, y el tope de cuatro es el que Gonzalo
      # declaro —«puede tener hasta 4»—.
      valid_filters = local({
        crudos <- .monitoreo_aulas_filas_de_filtro(
          mapping$valid_filters %||% mapping$filtros_validez
        )
        limpios <- list()
        for (f in crudos) {
          if (!is.list(f)) next
          var <- .monitoreo_scalar(f$var %||% f$variable, "")
          vals <- .monitoreo_chr_vec(f$values %||% f$valores %||% character(0))
          if (nzchar(var) && length(vals)) {
            limpios[[length(limpios) + 1L]] <- list(var = var, values = as.list(vals))
          }
          if (length(limpios) >= 4L) break
        }
        limpios
      })
    ),
    # **Que es un aula valida en este estudio.** Va en la whitelist o no
    # persiste: es la misma trampa que ya se comio a `valid_filters`, y una
    # superficie para declararlo con el campo cayendose al guardar seria peor
    # que no tenerla.
    #
    # Se normaliza con `monitoreo_aulas_criterio_aula()`, que es quien define
    # que es declarable: asi hay UNA sola definicion y no dos que se separan.
    # `NULL` cuando no se declaro, que es como estan todos los estudios de hoy.
    aula_valida = local({
      crit <- monitoreo_aulas_criterio_aula(list(
        aula_valida = config[["aula_valida"]] %||% defaults$aula_valida
      ))
      if (is.null(crit)) NULL else crit
    }),
    # **A partir de cuantos minutos una respuesta es sospechosa.** Misma
    # whitelist y misma doctrina que `aula_valida`: sin declarar no juzga, y lo
    # que no se nombre aqui no persiste. El numero lo pone quien conoce el
    # cuestionario porque la distribucion no ofrece donde cortar: medido en
    # acnur_acg, <5 min marca el 4.3 % de las respuestas y <7 min el 13.6 %.
    duracion_sospecha_min = local({
      crit <- monitoreo_tiempos_criterio(list(
        duracion_sospecha_min = config[["duracion_sospecha_min"]] %||%
          defaults$duracion_sospecha_min
      ))
      if (isTRUE(crit$declarado)) crit$umbral_min else NULL
    }),
    # **Cuánto dura la aplicación (B70, dictado 2026-09-03).** Misma doctrina
    # de whitelist: sin esta entrada, confirmar el slider y guardar el
    # proyecto perdería la duración en silencio. Se sanea a entero en
    # [5, 180]; lo ilegible cae al default (30) en vez de romper el config.
    duracion_aplicacion_min = local({
      crudo <- suppressWarnings(as.integer(
        (config[["duracion_aplicacion_min"]] %||% defaults$duracion_aplicacion_min)[1]
      ))
      if (is.na(crudo) || crudo < 5L || crudo > 180L) {
        defaults$duracion_aplicacion_min
      } else {
        crudo
      }
    }),
    # **La semilla del resorteo (B67, dictado 2026-09-03: «no tengo una forma
    # de hacer un resorteo»).** Entero >= 0; rota el desempate del greedy sin
    # tocar equidad ni fijadas. Basura o negativo caen a 0 (el alfabeto de
    # siempre), no rompen el config.
    reparto_semilla = local({
      crudo <- suppressWarnings(as.integer((config[["reparto_semilla"]] %||% 0L)[1]))
      if (is.na(crudo) || crudo < 0L) 0L else crudo
    }),
    # **La concentración por día del reparto (dictado 2026-09-04: «que sus
    # cursos-horario asignados no estén dispersos en toda la semana, sino
    # concentrados en un día o dos como máximo… sí quiero que se active»).**
    # Lógico; el default es TRUE por su dictado — apagar es la excepción.
    reparto_concentrado = local({
      crudo <- config[["reparto_concentrado"]]
      if (is.null(crudo) || length(crudo) == 0L) TRUE else isTRUE(crudo[[1]])
    }),
    # **El rango de despliegue del reparto (B75, dictado 2026-09-03).** Misma
    # doctrina de whitelist. Ambas puntas en ISO o no hay rango (NULL =
    # todo el horizonte); un rango con basura no rompe el config, se
    # des-declara. El intercambio desde>hasta lo hace el motor, no aqui: una
    # sola normalizacion duena del significado.
    reparto_rango = local({
      crudo <- config[["reparto_rango"]]
      if (!is.list(crudo)) return(NULL)
      d1 <- trimws(as.character(crudo[["desde"]] %||% "")[1])
      d2 <- trimws(as.character(crudo[["hasta"]] %||% "")[1])
      es_iso <- function(x) grepl("^\\d{4}-\\d{2}-\\d{2}$", x)
      if (es_iso(d1) && es_iso(d2)) list(desde = d1, hasta = d2) else NULL
    }),
    # **Las fijaciones del reparto de aplicadores (B36)** — codigo de cita →
    # aplicador, la voluntad explicita del usuario sobre el greedy. Misma
    # doctrina de whitelist: sin esta entrada, fijar una cita y guardar el
    # proyecto la perderia en silencio. Un valor vacio ("") es la forma de
    # SOLTAR una fijacion: se descarta aqui y la cita vuelve al automatico.
    reparto_fijado = local({
      crudo <- config[["reparto_fijado"]]
      # jsonlite simplifica {"CH 7": "..."} del body HTTP a VECTOR nombrado,
      # no lista — sin esta linea el POST de la UI llegaba y el mapa se
      # perdia en silencio (medido en vivo 2026-09-02).
      if (is.character(crudo)) crudo <- as.list(crudo)
      if (!is.list(crudo)) crudo <- list()
      limpio <- list()
      for (nm in (names(crudo) %||% character(0))) {
        cod <- trimws(nm)
        v <- trimws(as.character(crudo[[nm]] %||% "")[1])
        if (nzchar(cod) && !is.na(v) && nzchar(v)) limpio[[cod]] <- v
      }
      limpio
    }),
    plan = monitoreo_aulas_normalize_plan(config[["plan"]] %||% config[["agenda"]] %||% defaults$plan),
    # Ver la nota en `monitoreo_aulas_default_config()`: sin esta linea el
    # normalizador descartaba los partes y el control de reconciliacion no
    # tenia nada que comprobar.
    # Columnas de «Base de control» con datos que la cabecera del Excel no
    # bautiza. El lector las cuenta desde el principio y el dato viajaba en la
    # respuesta de la importacion sin que nadie lo mirara: una capacidad sin
    # consumidor. Aqui entra al tablero.
    control_sin_nombre = {
      v <- suppressWarnings(as.integer(config[["control_sin_nombre"]] %||% defaults$control_sin_nombre %||% 0L))
      if (length(v) != 1L || !is.finite(v) || v < 0L) 0L else v
    },
    partes_campo = {
      pc <- config[["partes_campo"]] %||% config[["partes"]] %||% defaults$partes_campo
      if (is.list(pc)) unname(Filter(is.list, pc)) else list()
    },
    # Las filas de «Base de control». Mismo tratamiento que los partes: se
    # conservan como vienen del lector y el motor las publica sin recalcular
    # nada, porque las formulas de control son del equipo, no de la app.
    control = {
      ct <- config[["control"]] %||% config[["base_control"]] %||% defaults$control
      if (is.list(ct)) unname(Filter(is.list, ct)) else list()
    },
    # El recibo de la importacion. Se conserva tal cual: no es configuracion
    # editable, es el sello de que libro se leyo y cuando.
    # Acceso EXACTO, no `$`: desde 6172e406 el payload de estado viaja con
    # `plan_rows` (entero) y SIN `plan`, y el partial matching de `$` pescaba
    # `plan_rows` — un 0 llegaba a `.monitoreo_aulas_df()` y elegir un modo en
    # /monitoreo respondia 500 E_INTERNAL.
    libro = if (is.list(config[["libro"]])) config[["libro"]] else NULL,
    # El Google Sheets del operativo del libro (unidad B1). Va en la whitelist
    # o no persiste — la misma trampa que ya se comió a `valid_filters`. El id
    # NO es secreto (el token sí, ADR 0005): viaja en la config y el `.pulso`.
    # Acceso `[[` exacto: `libro_sheets_borrador` u otra hermana no es esto.
    libro_sheets = monitoreo_aulas_libro_sheets_normalizar(config[["libro_sheets"]]),
    # S7: el Sheets de los aplicadores y la huella de lo último publicado, para
    # que el tablero pueda decir «el reparto cambió desde la última publicación».
    distribucion_sheets = monitoreo_aulas_distribucion_sheets_normalizar(config[["distribucion_sheets"]]),
    # «Estas respuestas cuentan para otro aula». Viaja en el `.pulso` porque es
    # una decisión operativa con su motivo, no una caché: sin passthrough, esta
    # lista CERRADA se la tragaría en el segundo pase de normalización y la
    # corrección duraría hasta el siguiente refresco. Ver
    # monitoreo_aulas_reatribucion.R.
    reatribuciones = monitoreo_aulas_reatribuciones_normalizar(config[["reatribuciones"]]),
    quotas = config[["quotas"]] %||% config[["cuotas"]] %||% defaults$quotas,
    variables_control = config[["variables_control"]] %||% config[["variablesControl"]] %||% defaults$variables_control,
    methodology = config[["methodology"]] %||% config[["metodologia"]] %||% defaults$methodology,
    representativity = config[["representativity"]] %||% config[["representatividad"]] %||% defaults$representativity,
    # Esta lista es CERRADA y el engine re-normaliza la config en cada pase:
    # sin este passthrough las metas del diseño se tragaban en el segundo pase.
    design_targets = config[["design_targets"]] %||% config[["metas_diseno"]] %||% defaults$design_targets,
    alerts = list(
      min_valid_per_class = max(1L, .monitoreo_int(alerts$min_valid_per_class %||% alerts$min_validas_aula, defaults$alerts$min_valid_per_class)),
      warn_partial_under_valid = max(1L, .monitoreo_int(alerts$warn_partial_under_valid %||% alerts$alerta_parcial_menor_a, defaults$alerts$warn_partial_under_valid))
    )
  )
}

monitoreo_aulas_normalize_plan <- function(plan = list()) {
  # **Camino rapido: un plan ya normalizado se devuelve tal cual.**
  #
  # Medido sobre el simulacro de campo malo, 1.424 aulas: el tablero tarda
  # 5,0 s y **`monitoreo_aulas_normalize_plan()` es el 49,6 % de ese tiempo**,
  # llamada DOS veces por tablero —una dentro de `normalize_config()` sobre
  # `config$plan`, otra en el propio `monitoreo_aulas_dashboard()` sobre el
  # mismo plan—. Dentro de ella el coste es la conversion ida y vuelta entre
  # data.frame y lista de registros: 18 conversiones por tablero.
  #
  # La funcion ya era idempotente —resuelve alias que en la segunda pasada ya
  # estan resueltos— asi que la segunda vuelta produce lo mismo y solo cuesta.
  # La marca lo hace explicito y comprobable.
  #
  # La marca viaja en la LISTA que esta funcion devuelve. Si alguien reconstruye
  # esa lista —un `lapply`, un viaje por JSON— el atributo se pierde y se vuelve
  # a normalizar, que es lo correcto: mas vale pagar de mas que creerse una
  # marca sobre datos que ya no son los mismos.
  if (isTRUE(attr(plan, "plan_normalizado", exact = TRUE))) return(plan)
  df <- .monitoreo_aulas_df(plan, "plan")
  if (!nrow(df)) return(list())
  col <- function(candidates) .monitoreo_aulas_col(df, candidates)
  get <- function(candidates, default = "") .monitoreo_aulas_values(df, col(candidates), default)
  getn <- function(candidates, default = NA_real_) .monitoreo_aulas_num_values(df, col(candidates), default)
  n <- nrow(df)
  out <- data.frame(
    selection_run_id = get(c("selection_run_id", "run_id"), ""),
    operational_code = get(c("operational_code", "codigo_operativo", "codigo_aula_operativa"), ""),
    titular_operational_code = get(c("titular_operational_code", "codigo_aula_titular"), ""),
    replacement_chain_code = get(c("replacement_chain_code", "codigo_reemplazo", "codigo_cadena_reemplazo"), ""),
    operational_sequence = getn(c("operational_sequence", "secuencia_operativa"), NA_real_),
    selection_slot_id = get(c("selection_slot_id", "slot_id", "id_match"), ""),
    sample_role = get(c("sample_role", "rol_muestra"), ""),
    wave = get(c("wave", "ola"), "M1"),
    replacement_order = getn(c("replacement_order", "orden_reemplazo"), NA_real_),
    orden = getn(c("orden", "order"), seq_len(n)),
    classroom_id = get(c("classroom_id", "aula_id", "codigo_aula"), ""),
    label = get(c("label", "aula", "salon"), ""),
    course_id = get(c("course_id", "curso_id", "codigo_curso"), ""),
    course_name = get(c("course_name", "curso", "nombre_curso"), ""),
    section = get(c("section", "seccion"), ""),
    schedule = get(c("schedule", "horario"), ""),
    # El RANGO de la clase y el salon, que `schedule` no dice: aquel es el
    # CODIGO del horario —«0591»— y este el tramo real —«MAR 14:00-16:00»—.
    # Sin ellos la agenda de campo no puede saber cuantas aulas estan en curso
    # a la vez, que es lo que fija cuantos aplicadores hacen falta.
    sesiones_dia_hora = get(c("sesiones_dia_hora", "sesiones", "sesiones_y_aula"), ""),
    # La forma LEGIBLE que anota el armador del calculo (B15,
    # calc_muestra_aulas_anotar_sesiones): «MAR 14:00-16:00 · V303». La hoja
    # «SESIONES Y AULA» del libro la prefiere, y esta lista cerrada la
    # tragaba: la unidad llegaba del from_calc solo con el slug
    # («2civ09_0703») y la siembra tenia que reponerla por injerto (A23,
    # destapado 2026-09-01). Mismo patron que teacher_phone, dos campos abajo.
    sesiones_legibles = get(c("sesiones_legibles", "sesiones_legible"), ""),
    venue = get(c("venue", "aula_fisica", "salon"), ""),
    modality = get(c("modality", "modalidad"), ""),
    session_type = get(c("session_type", "tipo_sesion", "tipo_sesión"), ""),
    teacher = get(c("teacher", "docente"), ""),
    teacher_email = get(c("teacher_email", "correo_docente"), ""),
    # El telefono viaja con el correo: es EL dato con el que se agenda. El
    # lector del Excel lo trae y el generador lo escribe, pero esta lista es
    # cerrada y no lo declaraba, asi que se caia entre los dos. El estudio de
    # 2025 no lo llenaba —por eso no se noto—, y uno que si lo llene lo perdia
    # en la primera vuelta.
    teacher_phone = get(c("teacher_phone", "telefono_docente", "celular_docente"), ""),
    faculty = get(c("faculty", "facultad"), ""),
    program = get(c("program", "programa", "carrera"), ""),
    level = get(c("level", "nivel"), ""),
    size_group = get(c("size_group", "grupo_tamano", "grupo_tamaño"), ""),
    sex_top_1 = get(c("sex_top_1", "sexo_principal", "sexo_top_1"), ""),
    sex_top_1_n = getn(c("sex_top_1_n", "n_sexo_principal", "sexo_top_1_n"), 0),
    sex_top_2 = get(c("sex_top_2", "sexo_secundario", "sexo_top_2"), ""),
    sex_top_2_n = getn(c("sex_top_2_n", "n_sexo_secundario", "sexo_top_2_n"), 0),
    stratum = get(c("stratum", "estrato"), "global"),
    eligible_n = getn(c("eligible_n", "elegibles"), 0),
    enrolled_total = getn(c("enrolled_total", "matriculados", "total_matriculados"), 0),
    # **`efectivas_esperadas` es la meta que el diseño calculó para ESTA aula**, y
    # faltaba en esta lista. El cálculo de muestra la produce por curso-horario
    # —elegibles x P(aplicada|tipo de docente) x rendimiento(tamaño), calibrado
    # con el 2025 real— y en el marco 2026 va de 5,8 a 34,8 encuestas por aula.
    # Sin el alias, el handoff caía al último recurso, `eligible_n`, y la meta
    # pasaba a ser **el total de elegibles**: un aula de 24 donde el diseño
    # espera 12,1 tenía que traer 24. De ahí salía «Llegaron a su meta: 0 de
    # 194», que no medía el campo sino una vara imposible.
    #
    # El fallback a `eligible_n` se conserva para los planes que no traen el
    # dato, pero **queda dicho que es un sustituto y no la meta**: convertir «no
    # sé la meta» en «la meta son todos» es el mismo defecto que hace fallar a
    # todo el mundo por definición.
    # **`efectivas_esperadas` va PRIMERO: es el nombre canonico.** Lo confirmo la
    # sesion de Calculo de muestra: su motor escribe esa columna y **no escribe
    # `expected_valid` ni `meta_aula` en ninguna parte** —esos dos alias son de
    # esta capa—. Poner el alias propio delante dejaba que un plan externo o una
    # edicion a mano pisaran la meta que calculo el diseño.
    # **La meta se compone por FILA, no por columna.**
    #
    # `getn` toma la primera columna que EXISTA en el marco y su default se
    # aplica a las filas vacias de esa columna. Con `efectivas_esperadas`
    # delante y default 0, cualquier fila sin esperado —los reemplazos, o un
    # plan a medio anotar— se quedaba con **meta 0**, que en un veredicto
    # significa que el aula cumple siempre. El fallback de abajo tampoco la
    # rescataba: 0 es finito.
    #
    # Componiendola por fila, cada aula usa lo primero que tenga: el esperado
    # del diseño, la meta declarada, y si no, los elegibles.
    expected_valid = local({
      del_diseno <- getn(c("efectivas_esperadas"), NA_real_)
      declarada <- getn(c("expected_valid", "meta_aula"), NA_real_)
      ifelse(is.finite(del_diseno), del_diseno, declarada)
    }),
    # **De donde salio esa meta.** Sin esto, `expected_valid` colapsa tres cosas
    # en un numero: lo que el diseño calculo para ESA aula, lo que alguien
    # declaro a mano, y el total de elegibles cuando no habia ninguna de las dos.
    # La pantalla decia «la meta que el calculo de muestra calculo» sobre filas
    # que no venian de ningun diseño.
    #
    # `meta_origen` lo escribe el calculo de muestra junto a `efectivas_esperadas`
    # (invariante suya: si esta una, esta la otra), asi que **lo declarado por el
    # productor manda** y aqui solo se deriva lo que el no emite.
    meta_origen = get(c("meta_origen", "expected_valid_origen"), ""),
    # **El PORQUE de la meta, para poder enseñarlo.**
    #
    # Gonzalo: «el que monitorea tiene que saber por que estamos asignando esa
    # validez a ese curso horario». La meta no es un numero caido del cielo:
    #
    #   `efectivas_esperadas` = `eligible_n` x `rendimiento_ref` (lo que rinde un
    #   aula de ese tamaño) x `factor_facultad`.
    #
    # **El tipo de docente NO entra.** Gonzalo, 2026-08-24: «no es por tipo de
    # docente, eso lo descartamos». `p_aplicada_ref` es capa OPERATIVA —anticipa
    # si el aula llega a aplicarse y cuantas visitas presupuestar—, no cuanto
    # rinde adentro; la tarjeta «De donde sale el esperado» ya lo rotula «Dato
    # operativo». Este comentario describia la formula anterior y decia que la
    # pantalla podia enseñar «24 x 73 % x 69 % → 12»: esa cuenta NO reproduce el
    # numero. Verificado el 2026-08-24 sobre las 2.616 del marco simulado —
    # **2.616 de 2.616** cuadran sin `p_aplicada_ref`, **0 de 2.616** con el.
    #
    # Los campos viajan igual para que la pantalla enseñe la cuenta sin
    # recalcular nada, incluido el operativo, que se muestra aparte.
    #
    # `teacher_type` puede venir COMPUESTO cuando el aula tiene dos docentes
    # —«ORDINARIO - PRINCIPAL | CONTRATADO»— y la tasa aplicada es la del mas
    # restrictivo. Se conserva entero: partirlo aqui perderia el segundo.
    p_aplicada_ref = getn(c("p_aplicada_ref"), NA_real_),
    rendimiento_ref = getn(c("rendimiento_ref"), NA_real_),
    # La tasa que el diseno le atribuye a ESTA aula —`efectivas_esperadas /
    # eligible_n`—. Viaja aparte porque el rediseno «1b» del calculo de muestra
    # la escribe por fila y aqui no se recalcula: si el productor cambia de
    # ecuacion, la tasa que se ensena tiene que seguir siendo la suya.
    tasa_efectividad_aula = getn(c("tasa_efectividad_aula"), NA_real_),
    # LA OTRA VARA, para que Monitoreo pueda distinguirlas igual que Calculo.
    # `expected_valid` de arriba usa la del aula, que es la meta operativa de
    # ESE salon. Estas dos traen la de la facultad, que es con la que se
    # dimensiono la muestra y con la que se mide la cuota: un aula que rinde
    # por debajo de su propia meta tuvo un problema, y una que rinde por debajo
    # de la de su facultad pero cumple la suya solo es mas grande que el
    # promedio, y eso ya estaba previsto. Sin las dos, los dos casos se ven
    # iguales y el segundo dispara una alarma que no existe.
    tasa_facultad = getn(c("tasa_facultad"), NA_real_),
    esperadas_facultad = getn(c("esperadas_facultad"), NA_real_),
    # La tasa unica de los estudios SIN historico: ahi el esperado es
    # `elegibles x efectividad_tau` y no hay tramo ni factor de facultad que
    # aplicar —`rendimiento_ref` y `p_aplicada_ref` llegan vacios—. Aviso de la
    # sesion de Calculo de muestra; entra en la whitelist antes de que llegue el
    # primer estudio asi, porque lo que el normalizador no nombra no persiste.
    efectividad_tau = getn(c("efectividad_tau"), NA_real_),
    teacher_type = get(c("teacher_type", "tipo_docente"), ""),
    # **El cuarto factor: la facultad.** Gonzalo pidio que el esperado dejara de
    # asumir «que todas las facultades tienen la misma naturaleza», asi que desde
    # 2026-08-20 la meta lleva ademas el factor de su facultad, medido del
    # historico y aplicado **solo donde la referencia tiene base suficiente**:
    # 135 de las 197 titulares del marco 2026 lo llevan y las otras 62 rigen por
    # la tasa general. `facultad_k` dice cuantas aulas sostienen ese factor.
    factor_facultad = getn(c("factor_facultad"), NA_real_),
    facultad_k = getn(c("facultad_k"), NA_real_),
    # De donde sale la calibracion, para no tener que asumirla.
    efectividad_fuente = get(c("efectividad_fuente"), ""),
    efectividad_periodo = get(c("efectividad_periodo"), ""),
    link = get(c("link", "url", "collector_link"), ""),
    qr = get(c("qr", "qr_url"), ""),
    word_link = get(c("word_link", "word_url", "word", "docx", "ficha_word"), ""),
    pdf_link = get(c("pdf_link", "pdf_url", "pdf", "ficha_pdf"), ""),
    package_label = get(c("package_label", "selection_label", "seleccion", "muestra"), ""),
    # Se DERIVA mas abajo cuando el plan no lo trae. Nada lo escribia nunca:
    # medido, 196 de 196 vacio, y la vista lo pintaba como «Por revisar», que
    # invita a revisar una ficha que no existe.
    package_status = get(c("package_status", "estado_paquete"), ""),
    collector_id = get(c("collector_id", "collector", "collectorId"), ""),
    # Identificador que Recopiladores cuelga del QR (`d[collectorID]=`). Es el
    # que vuelve dentro de la data de Kobo, y no tiene por que coincidir con
    # `classroom_id`: hoy es un slug interno. Si la normalizacion lo tira, el
    # avance por aula no puede emparejar una sola respuesta.
    collection_unit_id = get(c("collection_unit_id", "unit_id"), ""),
    # --- Eje de AGENDAMIENTO (hoja «Aulas Agendadas») --------------------
    # No se mezcla con `operational_status`, que es el eje de la aplicacion.
    sample_status = get(c("sample_status", "status_muestra"), ""),
    contact_medium = get(c("contact_medium", "medio_de_contacto", "medio_contacto"), ""),
    contact_date = get(c("contact_date", "fecha_de_llamada", "fecha_llamada"), ""),
    # Sin los intentos no se puede decir POR QUE un aula sigue sin agendar.
    contact_attempts = getn(c("contact_attempts", "numero_de_intentos", "intentos"), NA_real_),
    # B23/B22: el resultado de cada llamada y la marca del correo. Esta lista
    # es cerrada y no declararlos era tragarselos — exactamente lo que el
    # contrato de campos-declarados existe para cazar (estuvo ROJO desde
    # f67ffeec hasta aqui sin que ningun gate lo corriera).
    call_status = get(c("call_status", "status_de_llamada"), ""),
    email_received = get(c("email_received", "recibio_correo"), ""),
    scheduled_date = get(c("scheduled_date", "fecha_agendada"), ""),
    scheduled_day = get(c("scheduled_day", "dia"), ""),
    scheduled_time = get(c("scheduled_time", "hora_agendada"), ""),
    scheduled_moment = get(c("scheduled_moment", "momento", "momento_de_la_clase"), ""),
    # B30: el aula/pabellon CONFIRMADO de la aplicacion («A206»), tecleado en
    # la columna LUGAR DE APLICACIÓN del libro. Esta lista es cerrada: sin
    # declararlo aqui, el lugar volveria del Excel y se caeria en silencio —
    # el contrato de campos-declarados lo exige desde la spec del bloque.
    scheduled_venue = get(c("scheduled_venue", "lugar_de_aplicacion"), ""),
    # --- Eje de APLICACION (hoja «Aulas Aplicadas (Campo)») --------------
    application_status = get(c("application_status", "status_de_aplicacion"), ""),
    # Ya habian respondido en otra aula: ni rechazo ni efectiva.
    duplicates = getn(c("duplicates", "duplicados"), NA_real_),
    # El numero que manda. NO es "encuestas aplicadas".
    effective_surveys = getn(c("effective_surveys", "cantidad_de_efectivas", "efectivas"), NA_real_),
    # Donde se aplico de verdad; puede no ser la planificada.
    actual_room = get(c("actual_room", "aula_real"), ""),
    # **El aula que de verdad se usó cuando hubo reemplazo** (dictado
    # 2026-09-04: «una columna adicional con algo así como AULA UTILIZADA que le
    # diga al usuario cuál fue el reemplazo que usamos»). El lector del libro ya
    # la producía y el normalizador la descartaba, así que moría camino al plan
    # y ninguna vista podía enseñarla: la columna existía en el papel y en
    # ningún sitio más. Lo cazó `test-monitoreo-aulas-campos-declarados.R`, que
    # existe justo para eso.
    aula_utilizada = get(c("aula_utilizada", "aula_usada"), ""),
    responsible = get(c("responsible", "responsable"), ""),
    operational_status = get(c("operational_status", "estado", "estado_operativo"), "planificada"),
    replacement_for = get(c("replacement_for", "reemplazo_de"), ""),
    replacement_reason = get(c("replacement_reason", "motivo_reemplazo"), ""),
    # `notes` es el alias con el que lo escribe el generador del libro; el lector
    # lo deja en `replacement_note`. Aceptar los dos evita que la observacion se
    # caiga segun por que puerta entre.
    replacement_note = get(c("replacement_note", "nota_reemplazo", "notes", "observaciones"), ""),
    equivalence_level = get(c("equivalence_level", "nivel_equivalencia"), ""),
    chain_score = getn(c("chain_score", "score_cadena"), NA_real_),
    chain_depth = getn(c("chain_depth", "profundidad_cadena"), NA_real_),
    activation_weight_status = get(c("activation_weight_status", "estado_peso_activacion"), ""),
    # Trazabilidad de la activacion. La lista de campos de este normalizador es
    # CERRADA: lo que no se declara aqui se cae, y por eso `monitoreo_aulas_activar_reemplazo()`
    # escribia estas tres marcas y el tablero las mostraba vacias.
    replaced_at = get(c("replaced_at", "reemplazada_en"), ""),
    activated_at = get(c("activated_at", "activada_en"), ""),
    activation_reason = get(c("activation_reason", "motivo_activacion"), ""),
    analysis_weight_warning = get(c("analysis_weight_warning", "alerta_peso_analitico"), ""),
    representativity_score = getn(c("representativity_score", "score_representatividad"), NA_real_),
    representativity_distance = getn(c("representativity_distance", "distancia_representatividad"), NA_real_),
    pi_final = getn(c("pi_final", "probabilidad_final"), NA_real_),
    weight_classroom = getn(c("weight_classroom", "peso_aula"), NA_real_),
    weight_student = getn(c("weight_student", "peso_estudiante"), NA_real_),
    probability_source = get(c("probability_source", "fuente_probabilidad"), ""),
    nonresponse_policy = get(c("nonresponse_policy", "politica_no_respuesta"), ""),
    methodological_warning = get(c("methodological_warning", "advertencia_metodologica"), ""),
    # --- Registro de campo -----------------------------------------------
    # Lo que solo existe dentro del aula y ningun sistema puede saber de
    # antemano: cuantos ASISTIERON (no cuantos estan matriculados), cuantas
    # encuestas se repartieron, y quien dijo que no —el rechazo nunca toca el
    # formulario, asi que es invisible para Kobo—. Sin estos tres numeros no
    # existe la tasa de respuesta por aula: Kobo dice "llegaron 12", pero 12 de
    # cuantos.
    observed_students = getn(c("observed_students", "alumnos_en_aula", "aforo_observado"), NA_real_),
    applied_surveys = getn(c("applied_surveys", "encuestas_aplicadas"), NA_real_),
    refusals = getn(c("refusals", "rechazos"), NA_real_),
    applied_by = get(c("applied_by", "aplicador", "aplicadora"), ""),
    applied_at = get(c("applied_at", "fecha_aplicacion", "hora_aplicacion"), ""),
    field_note = get(c("field_note", "nota_campo", "observaciones"), ""),
    updated_at = get(c("updated_at", "actualizado_en"), ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  missing_role <- !nzchar(out$sample_role)
  out$sample_role[missing_role] <- ifelse(out$wave[missing_role] == "M1", "titular", ifelse(nzchar(out$replacement_for[missing_role]), "chain_reserve", "chain_reserve"))
  out$sample_role <- gsub(" ", "_", .monitoreo_text_key(out$sample_role), fixed = TRUE)
  out$replacement_order[!is.finite(out$replacement_order)] <- suppressWarnings(as.numeric(gsub("[^0-9]", "", out$wave[!is.finite(out$replacement_order)]))) - 1
  out$operational_status <- vapply(out$operational_status, .monitoreo_aulas_status, character(1))
  out$sample_status <- vapply(out$sample_status, monitoreo_aulas_estado_muestra, character(1))
  out$application_status <- vapply(out$application_status, monitoreo_aulas_estado_aplicacion, character(1))
  out$replacement_reason <- vapply(out$replacement_reason, function(x) if (nzchar(x)) .monitoreo_aulas_reason(x) else "", character(1))
  # El estado de la ficha del aula, DERIVADO de los materiales que existen.
  #
  # `package_status` es un campo que ningun proceso escribia —medido: vacio en
  # las 196 del operativo— y la vista lo rotulaba «Por revisar», que suena a que
  # hay una ficha esperando revision cuando lo que pasa es que no hay ninguna.
  # El vocabulario de estos estados ya existia en la capa de presentacion
  # (`pendiente_enlace`, `listo_para_pdf`, `pdf_preparado`); lo que faltaba era
  # que alguien los emitiera.
  #
  # Se deriva SOLO cuando el plan no trae valor: si un dia Recopiladores empieza
  # a escribirlo, ese valor manda.
  materiales <- !nzchar(out$package_status)
  if (any(materiales)) {
    tiene <- function(col) nzchar(out[[col]]) & materiales
    out$package_status[materiales] <- "pendiente_enlace"
    # El enlace es la condicion de todo lo demas: sin el, el QR no lleva a
    # ninguna parte y la ficha impresa no sirve.
    con_enlace <- (tiene("link") | tiene("qr"))
    out$package_status[con_enlace] <- "listo_para_pdf"
    out$package_status[tiene("pdf_link") | tiene("word_link")] <- "pdf_preparado"
  }
  out$sex_top_1_n[!is.finite(out$sex_top_1_n)] <- 0
  out$sex_top_2_n[!is.finite(out$sex_top_2_n)] <- 0
  out$enrolled_total[!is.finite(out$enrolled_total)] <- 0
  # El origen que el productor no declaro, derivado por fila y en el mismo orden
  # de precedencia que la meta. Se calcula ANTES de los dos fallbacks de abajo
  # para poder distinguir «no habia meta» de «la meta es cero».
  sin_origen <- !nzchar(out$meta_origen)
  if (any(sin_origen)) {
    del_diseno <- suppressWarnings(as.numeric(getn(c("efectivas_esperadas"), NA_real_)))
    declarada <- suppressWarnings(as.numeric(getn(c("expected_valid", "meta_aula"), NA_real_)))
    out$meta_origen[sin_origen & is.finite(del_diseno)] <- "diseno"
    pendiente <- sin_origen & !is.finite(del_diseno)
    out$meta_origen[pendiente & is.finite(declarada)] <- "declarada"
    # Lo que queda usara el total de elegibles, que **no es una meta**: es lo que
    # hay cuando no hay ninguna. Nombrarlo es lo que impide que vuelva a leerse
    # como si el diseño la hubiera fijado.
    resto <- sin_origen & !is.finite(del_diseno) & !is.finite(declarada)
    out$meta_origen[resto] <- ifelse(is.finite(out$eligible_n[resto]) & out$eligible_n[resto] > 0,
                                     "elegibles", "sin_meta")
  }
  out$expected_valid[!is.finite(out$expected_valid)] <- out$eligible_n[!is.finite(out$expected_valid)]
  out$eligible_n[!is.finite(out$eligible_n)] <- 0
  out$expected_valid[!is.finite(out$expected_valid)] <- 0
  slot_number <- suppressWarnings(as.integer(gsub("[^0-9]", "", out$selection_slot_id)))
  slot_number[!is.finite(slot_number)] <- out$orden[!is.finite(slot_number)]
  rep_order <- out$replacement_order
  invalid_order <- !is.finite(rep_order) | rep_order <= 0
  rep_order[invalid_order] <- suppressWarnings(
    as.numeric(gsub("[^0-9]", "", out$wave[invalid_order]))
  ) - 1
  # Ultimo recurso: la posicion DENTRO DE SU CADENA. Poner 1 a todas hacia que
  # dos reservas del mismo titular compartieran codigo —las dos de `CH 4` se
  # llamaban `R 4.1`—, que es peor que un vacio: son dos aulas distintas con el
  # mismo nombre en la tabla desde la que se decide a quien activar.
  sin_orden <- !is.finite(rep_order) | rep_order <= 0
  # Se cuenta SOLO entre reservas: incluir al titular en su propio grupo lo hacia
  # ocupar el puesto 1 y desplazaba a sus reservas a `R n.2` y `R n.3`.
  reservas_sin_orden <- which(sin_orden & out$sample_role == "chain_reserve" & nzchar(out$replacement_for))
  if (length(reservas_sin_orden)) {
    rep_order[reservas_sin_orden] <- stats::ave(
      seq_along(reservas_sin_orden),
      out$replacement_for[reservas_sin_orden],
      FUN = seq_along
    )
  }
  rep_order[!is.finite(rep_order) | rep_order <= 0] <- 1
  # El orden derivado VUELVE al campo, y no se queda en esta variable local.
  # Servia para numerar el codigo de cadena —`R n.k`— pero el campo seguia en 0,
  # asi que la tabla de reemplazos mostraba «Orden en la cadena: 0» en las seis
  # filas de una cadena de seis: justo la columna que dice cual entra ahora.
  # Solo para reservas: el orden de un titular es 0 por definicion.
  es_reserva <- out$sample_role == "chain_reserve"
  out$replacement_order[es_reserva] <- rep_order[es_reserva]
  extra_index <- rep(NA_integer_, nrow(out))
  extra_rows <- which(out$sample_role == "extra_reserve_pool")
  if (length(extra_rows)) extra_index[extra_rows] <- seq_along(extra_rows)

  # La carga es la frontera de compatibilidad: códigos históricos se guardan
  # ya canónicos para que todas las comparaciones exactas posteriores operen
  # sobre `CH n` / `R n.k`, no solo la vista que los renderiza.
  out$operational_code <- .cm_aulas_codigo_operativo(
    code = out$operational_code,
    role = out$sample_role,
    slot_number = slot_number,
    replacement_order = rep_order,
    extra_index = extra_index
  )
  # El titular de una reserva es SU titular, no el que le tocaria por posicion.
  # `slot_number` cae a `orden` cuando el plan no trae `selection_slot_id`, asi
  # que una reserva en la fila 6 se declaraba titular de `CH 6` aunque
  # `replacement_for` dijera `CH 4`. El codigo inventado no queda vacio: apunta a
  # OTRA aula real del estudio, y esa es la tabla que el equipo mira para decidir
  # a quien activar.
  reserva <- out$sample_role == "chain_reserve"
  hereda <- reserva & !nzchar(out$titular_operational_code) & nzchar(out$replacement_for)
  out$titular_operational_code[hereda] <- out$replacement_for[hereda]
  # Una reserva sin `replacement_for` no tiene de donde: vacio es mas honesto que
  # un `CH n` plausible. El titular de un titular si sale del slot: es el mismo.
  titular_role <- ifelse(out$sample_role == "titular", "titular", "")
  out$titular_operational_code <- .cm_aulas_codigo_operativo(
    code = out$titular_operational_code,
    role = titular_role,
    slot_number = slot_number
  )
  replacement_role <- ifelse(
    out$sample_role == "chain_reserve",
    "chain_reserve",
    ""
  )
  # El mismo defecto que arriba, en la linea de al lado: la cadena `R n.k`
  # tomaba su `n` de la posicion, asi que la reserva de `CH 4` en la fila 6 se
  # llamaba `R 6.1`. El `n` de la cadena es el del TITULAR, que ya quedo resuelto
  # en `titular_operational_code` unas lineas antes.
  slot_cadena <- slot_number
  n_titular <- suppressWarnings(as.integer(gsub("[^0-9]", "", out$titular_operational_code)))
  hereda_slot <- out$sample_role == "chain_reserve" & is.finite(n_titular)
  slot_cadena[hereda_slot] <- n_titular[hereda_slot]
  out$replacement_chain_code <- .cm_aulas_codigo_operativo(
    code = out$replacement_chain_code,
    role = replacement_role,
    slot_number = slot_cadena,
    replacement_order = rep_order
  )
  out <- out[nzchar(out$classroom_id), , drop = FALSE]
  rownames(out) <- NULL
  res <- .monitoreo_aulas_records(out)
  attr(res, "plan_normalizado") <- TRUE
  res
}

# Localiza una fila del plan por cualquiera de sus identificadores.
#
# `collection_unit_id` entra aqui de forma PREPARATORIA, no por un defecto
# observado: hoy nadie llama a este indice con ese id porque la superficie que
# registraria el estado del aula todavia no existe (L4 del GOAL). Pero es el id
# que viaja en el QR y el que trae la data de campo, y ya hubo tres sitios en
# este modulo donde emparejar solo por `classroom_id` dejaba ciego al consumidor.
# Aceptarlo aqui evita el cuarto.
.monitoreo_aulas_plan_index <- function(plan_df, classroom_id = "", operational_code = "",
                                        collection_unit_id = "") {
  classroom_id <- .monitoreo_scalar(classroom_id, "")
  collection_unit_id <- .monitoreo_scalar(collection_unit_id, "")
  operational_code <- .cm_aulas_codigo_operativo(
    .monitoreo_scalar(operational_code, "")
  )
  idx <- if (nzchar(classroom_id)) which(plan_df$classroom_id == classroom_id) else integer(0)
  if (!length(idx) && nzchar(operational_code) && "operational_code" %in% names(plan_df)) {
    idx <- which(
      .cm_aulas_codigo_operativo(plan_df$operational_code) == operational_code
    )
  }
  if (!length(idx) && nzchar(collection_unit_id) && "collection_unit_id" %in% names(plan_df)) {
    idx <- which(as.character(plan_df$collection_unit_id) == collection_unit_id)
  }
  idx
}

monitoreo_aulas_from_calc <- function(estudio = NULL, selection = NULL, frame = NULL, config = list(),
                                      referencia_asistencia = NULL) {
  sel <- selection$selection %||% selection
  plan <- monitoreo_aulas_normalize_plan(sel)
  cfg <- monitoreo_aulas_normalize_config(config)
  cfg$enabled <- TRUE
  cfg$selection_run_id <- .monitoreo_scalar(selection$selection_run_id %||% cfg$selection_run_id, "")
  cfg$frame_hash <- .monitoreo_scalar(selection$frame_hash %||% frame$frame_hash %||% cfg$frame_hash, "")
  cfg$imported_at <- .monitoreo_now_iso()
  cfg$plan <- plan
  cfg$quotas <- selection$quotas %||% cfg$quotas
  if (is.list(frame)) {
    cross <- frame$population_cross_profiles %||% frame$cross_profiles %||% NULL
    category <- frame$category_profiles %||% NULL
    quota_bundle <- list(
      strata = selection$quotas %||% list(),
      sex_by_faculty = cross,
      category_profiles = category,
      profile_distributions = selection$diagnostics$profile_distributions %||% selection$representativity$profile_distributions %||% list()
    )
    quota_names <- names(cfg$quotas)
    if (is.list(cfg$quotas) && length(cfg$quotas) && !is.null(quota_names) && any(nzchar(quota_names))) {
      cfg$quotas <- modifyList(quota_bundle, cfg$quotas)
    } else {
      cfg$quotas <- quota_bundle
    }
  }
  cfg$methodology <- list(
    calc_muestra = selection$methodology %||% list(),
    representativity = selection$representativity %||% list(),
    objective_config = selection$objective_config %||% selection$representativity$objective_config %||% list(),
    frame_hash = cfg$frame_hash,
    selection_run_id = cfg$selection_run_id,
    source = "calc-muestra"
  )
  cfg$representativity <- selection$representativity %||% cfg$representativity
  # **El embudo de asistencia del estudio de referencia**, que hasta ahora se
  # quedaba en Calculo de muestra. Sin el, Monitoreo tiene el PRODUCTO de la
  # tasa y no sus dos factores, asi que no puede partir la cadena «elegibles ->
  # los que esperamos ver -> los que esperamos que respondan».
  asistencia <- monitoreo_aulas_asistencia_referencia(referencia_asistencia)
  if (!is.null(asistencia)) cfg$asistencia_referencia <- asistencia
  # Metas del DISEÑO, no del sorteo: `quotas$strata` son aulas por estrato y no
  # dicen cuántos alumnos se trazó cada facultad ni con qué τ de rendimiento.
  # Ver `monitoreo_aulas_metas_diseno.R`. Se pasa `selection` completo —no
  # `sel`— porque la certificación adjunta cuelga del sobre, no del data.frame.
  metas <- .monitoreo_aulas_metas_diseno(estudio, .monitoreo_aulas_df(plan, "plan"), selection)
  if (length(metas$facultades %||% list())) {
    # El sello del import viaja EN el bloque: sin run/hash, un design_targets
    # viejo que sobrevive el passthrough junto a un plan nuevo no es detectable
    # como stale.
    metas$selection_run_id <- cfg$selection_run_id
    metas$frame_hash <- cfg$frame_hash
    cfg$design_targets <- metas
    cfg$plan <- .monitoreo_aulas_aplicar_meta_tau(cfg$plan, metas)
  }
  if (is.list(estudio)) {
    cfg$study_title <- .monitoreo_scalar(estudio$titulo %||% estudio$title, "")
    cfg$study_macro_family <- .monitoreo_scalar(estudio$macro_familia, "")
  }
  cfg
}

.monitoreo_aulas_named_counts <- function(keys, mask = NULL) {
  keys <- trimws(as.character(keys %||% character(0)))
  if (is.null(mask)) mask <- rep(TRUE, length(keys))
  mask <- mask %in% TRUE & nzchar(keys)
  if (!length(keys) || !any(mask)) return(integer(0))
  table(keys[mask])
}

#' La fecha de aplicacion de cada aula, SEGUN LA PLATAFORMA.
#'
#' Gonzalo, y ya lo habia dicho antes: «tienes que entender que lo que contamos
#' son las efectivas en plataforma… tienes la informacion de cuando inicia la
#' encuesta, cuando finaliza, si es efectiva o no. Lo que se registra en campo es
#' una cosa, pero lo que a nosotros nos importa es lo que sale en la plataforma».
#'
#' **Toda la lectura temporal de Avance estaba muerta por leer la fuente
#' equivocada.** Nueve modulos del perfil —serie de rendimiento, ritmo por
#' facultad, pronostico de cierre, corte del estudio— toman la fecha de
#' `applied_at`, que viene de la hoja de campo del libro. Medido sobre el
#' simulacro de campo malo: `applied_at` vacio en los 152 partes y en las 1.424
#' filas del plan, mientras las 1.595 respuestas traen `_submission_time`,
#' `start` y `end` COMPLETOS, con `collectorID` enlazando 151 aulas y doce dias
#' de campo (7 al 18 de septiembre). El dato estaba; se miraba donde no.
#'
#' Se toma la PRIMERA respuesta del aula y no la ultima: es cuando se aplico. La
#' ultima puede ser un rezagado que contesto por la noche.
#'
#' @param response_classroom aula de cada respuesta, ya resuelta.
#' @param responses las respuestas de la plataforma.
#' @return vector nombrado aula -> fecha ISO, o vacio si no hay con que.
#' @keywords internal
.monitoreo_aulas_fecha_de_plataforma <- function(response_classroom, responses) {
  if (!is.data.frame(responses) || !nrow(responses)) return(character(0))
  aulas <- trimws(as.character(response_classroom %||% character(0)))
  if (length(aulas) != nrow(responses)) return(character(0))
  # **La columna con HUSO manda sobre la del servidor.** Prefería
  # `_submission_time`, que Kobo publica en UTC: un aula de las 19:30 de Lima
  # —este operativo agenda hasta esa hora— se fecha en la jornada siguiente.
  # Ver `monitoreo_aulas_hora_local.R`.
  col <- .monitoreo_aulas_col(responses, MONITOREO_AULAS_COLUMNAS_TIEMPO)
  if (!nzchar(col)) return(character(0))
  crudo <- as.character(responses[[col]])
  fecha <- monitoreo_aulas_fecha_local(crudo)
  ok <- nzchar(aulas) & nzchar(fecha)
  if (!any(ok)) return(character(0))
  # La primera respuesta de cada aula.
  tapply(fecha[ok], aulas[ok], min, simplify = TRUE)
}

.monitoreo_aulas_course_status <- function(plan_df, responses, cfg, valid_response, response_classroom) {
  if (!is.data.frame(plan_df) || !nrow(plan_df)) return(list())
  total_counts <- .monitoreo_aulas_named_counts(response_classroom)
  valid_counts <- .monitoreo_aulas_named_counts(response_classroom, valid_response)
  filter_passed <- .monitoreo_aulas_filter_passed(responses, valid_response)
  passed_counts <- .monitoreo_aulas_named_counts(response_classroom, filter_passed)
  rejected_counts <- .monitoreo_aulas_named_counts(response_classroom, !filter_passed & nzchar(response_classroom))

  rows <- plan_df
  rows$responses_total <- .monitoreo_aulas_contar_por_fila(rows, total_counts)
  rows$respuestas_validas <- .monitoreo_aulas_contar_por_fila(rows, valid_counts)
  rows$filter_passed <- .monitoreo_aulas_contar_por_fila(rows, passed_counts)
  rows$filter_rejected <- .monitoreo_aulas_contar_por_fila(rows, rejected_counts)
  # `expected_valid` puede llegar como TEXTO: `.monitoreo_aulas_df()` convierte
  # todas las columnas a character, y este plan hace ese viaje de ida y vuelta.
  # La linea de `brecha` ya lo coaccionaba; la de `application_state` no, asi
  # que comparaba lexicograficamente: "5" >= "30" es TRUE, y un aula con 5 de 30
  # se declaraba "cerrando". No se veia porque hasta ahora las validas eran
  # siempre 0 y "0" >= "30" da FALSE.
  meta <- suppressWarnings(as.numeric(rows$expected_valid))
  meta[!is.finite(meta)] <- 0
  # **La brecha son PERSONAS, y una persona no se parte.**
  #
  # Gonzalo, viendo «faltan 236.1 respuestas» en el grafico de estratos: «como
  # vas a poner decimales». La meta de un aula sale de `elegibles x tasa` y es
  # fraccionaria por construccion, pero lo que falta RECOGER son encuestas
  # enteras y asi es como se lee, se reparte y se suma por estrato.
  #
  # Hacia ARRIBA, que es la misma regla que `.mac_brecha()` ya aplica a las
  # celdas de cuota —«es el unico sitio del avance donde se redondea hacia
  # arriba, porque es lo unico que se PIDE»—: si faltan 0,1 encuestas falta una
  # persona. Esta capa se habia quedado fuera de esa regla.
  #
  # La META no se toca: se sigue calculando exacta y las decisiones que dependen
  # de ella no se mueven. Lo que se redondea es lo que se publica como falta.
  rows$brecha <- ceiling(pmax(0, meta - rows$respuestas_validas) - 1e-9)
  rows$brecha[!is.finite(rows$brecha)] <- 0
  # El escalon de agendamiento sale de STATUS MUESTRA, no del estado operativo.
  #
  # Antes solo miraba `operational_status`, y como ese lo llena el registro de
  # campo, un aula con `STATUS MUESTRA = AGENDADA` y fecha de aplicacion caia en
  # «pendiente», que la vista rotula «Sin agendar». Medido sobre el estudio de
  # 196: de las 48 que decian «Sin agendar», **22 estaban agendadas con fecha** y
  # las otras 26 estaban REEMPLAZADAS. Ni una sola estaba sin agendar.
  #
  # Las reemplazadas tampoco pertenecen a ese eje: no es que falte agendarlas, es
  # que cayeron y su reserva tomo el relevo. Tienen tramo propio.
  muestra <- tolower(trimws(as.character(rows$sample_status %||% "")))
  # `grepl("^en reserva", ...)` estaba aqui y NO PODIA CASAR NUNCA: el
  # normalizador convierte «EN RESERVA 1» en `en_reserva`, con guion bajo. Era
  # una regla escrita que no se aplicaba, y las reservas caian en «pendiente».
  #
  # Y tratarlas como agendadas tampoco era lo correcto: una reserva en el banco
  # NO esta agendada ni hay que agendarla. Contarla entre las pendientes le dice
  # al coordinador que salga a agendar ocho aulas que no debe tocar salvo que
  # caiga su titular. Medido: las 8 que decian «Sin agendar» eran las 8 reservas
  # libres, y ademas con fecha en la fila. Tramo propio, como las reemplazadas.
  agendada_en_muestra <- muestra %in% c("agendada", "reagendada")
  # MISMA definicion que `monitoreo_aulas_reservas_disponibles()`: una reserva
  # que el motor considera disponible es la que esta en el banco. Si las dos
  # divergen, el tramo dira que hay reservas que la activacion ya no ofrece.
  #
  # El rol es imprescindible: `sin_contactar` —que es a lo que el normalizador
  # manda el vacio— en un TITULAR si es «Sin agendar». Meterlo sin mirar el rol
  # mandaba al banco a todo titular sin estado, y el aserto de control lo cazo.
  rol <- tolower(trimws(as.character(rows$sample_role %||% "")))
  en_reserva <- muestra %in% "en_reserva" |
    (rol %in% "chain_reserve" & muestra %in% c("en_reserva", "sin_contactar", ""))
  rows$application_state <- ifelse(
    rows$operational_status %in% c("aplicada", "cerrada") | (rows$respuestas_validas >= meta & meta > 0),
    "cerrando",
    ifelse(rows$responses_total > 0 | rows$operational_status %in% c("en_campo", "parcial"), "en_aplicacion",
           ifelse(muestra == "reemplazada", "reemplazada",
                  ifelse(rows$operational_status %in% c("agendada", "contactada") | agendada_en_muestra,
                         "lista",
                         ifelse(en_reserva, "en_reserva", "pendiente"))))
  )
  # Si esta fila es el eslabon EN JUEGO de su cadena. Sin este campo la vista no
  # puede contar por slot y acaba sumando las reservas dormidas: el panel de
  # cumplimiento pedia 4 336 mientras el ritmo y la cuota —que salen de
  # `tracked_df`— decian 3 743. Se publica el dato en vez de duplicar la logica
  # de `monitoreo_aulas_en_juego()` en el frontend.
  # El banco fuera: `course_status` trae el plan ENTERO, y sin excluirlo cada
  # aula extra forma su propia «cadena» y sale en juego. Medido: 210 en juego de
  # 236 —170 titulares mas 40 del banco— y una meta de 4 684 donde el motor dice
  # 3 743. Es el mismo conjunto que `tracked_df`, dicho fila a fila.
  rows$en_juego <- monitoreo_aulas_en_juego(rows) &
    as.character(rows$sample_role %||% "") != "extra_reserve_pool"

  cols <- intersect(c(
    "en_juego",
    # `sample_role` viaja con el estado por la misma razon que `sample_status`:
    # sin el, la vista no puede distinguir un titular de una reserva del banco.
    # Y lo necesita: `course_status` trae las 202 filas del plan, banco incluido,
    # asi que el panel de cumplimiento sumaba una meta de 4 476 mientras el del
    # ritmo —que sale de `tracked_df`, donde el banco NO esta— decia 4 336. Dos
    # metas distintas en la misma pantalla, y la vista sin forma de saber cual
    # fila sobraba. El banco eran esos 140.
    "sample_role",
    "operational_code", "titular_operational_code", "wave", "classroom_id",
    "course_name", "section", "schedule", "faculty", "program", "level",
    # La fecha agendada viaja con el estado. `schedule` es el texto corto que se
    # imprime en la ficha —«Lun 08:00»—; para agrupar por dia hace falta la
    # FECHA, que es lo que trae `FECHA DE APLICACION` del libro. Sin ella la
    # vista de agenda tendria que unir dos listas por codigo para saber que dia
    # es cada aula.
    "scheduled_date", "scheduled_day", "scheduled_time", "scheduled_moment",
    # B30: el lugar CONFIRMADO viaja con el estado — la vista de agenda dice a
    # QUE salon ir, y ese es el tecleado en el libro, no el aula de la clase.
    "scheduled_venue",
    # El RANGO horario del curso, no un instante: «MAR 14:00-16:00 · MIE
    # 10:00-12:00». `schedule` dice cuando EMPIEZA y `scheduled_*` cuando se
    # agendo; ninguno de los dos permite saber cuantas aulas estan en curso a la
    # vez, que es lo que fija cuantos aplicadores hacen falta. Medido sobre el
    # plan de HSVG 2026: contando por hora de inicio el pico daba 8 aulas
    # simultaneas; contando el rango real, 19. `venue` viaja al lado porque la
    # carga se reparte por pabellon y sin el la agenda no puede agrupar por
    # edificio. Los dos salen del catalogo en `calc_muestra_aulas_sesiones.R`.
    # `sesiones_legibles` es su forma para humanos (A23): sin ella aqui, el
    # estado publicaba el slug donde el libro esperaba «MAR 14:00-16:00 · V303».
    "sesiones_dia_hora", "sesiones_legibles", "venue",
    # `sample_status` viaja con el estado porque el escalon de agendamiento sale
    # de el: sin publicarlo, la vista no puede explicar por que un aula esta en
    # «Agendada» o en «Reemplazada».
    "responsible", "collector_id", "sample_status", "operational_status", "application_state",
    # `observed_students` son los ASISTENTES que declaro el parte: cuantos
    # estaban en el aula ese dia. NO son los elegibles —esos son los
    # matriculados que cumplen los criterios y no cambian con el dia— y la
    # distincion es del operativo, no de vocabulario: la cadena va elegibles ->
    # los que esperabamos ver -> los que esperabamos que respondieran ->
    # efectivas. Sin esta columna, el desglose de un tramo de cobertura enseñaba
    # «—» en el sitio donde va el eslabon del medio (medido en pantalla el
    # 2026-09-10, las tres filas de «Se quedo a medias»).
    "observed_students",
    "eligible_n", "expected_valid", "responses_total", "respuestas_validas",
    # Las dos varas del esperado, para que la vista pueda separar «este salon
    # rindio mal» de «este salon es mas grande que el promedio de su facultad».
    "tasa_efectividad_aula", "tasa_facultad", "esperadas_facultad",
    "filter_passed", "filter_rejected", "brecha", "link", "updated_at"
  ), names(rows))
  out <- rows[, cols, drop = FALSE]
  priority <- match(out$application_state, c("en_aplicacion", "lista", "pendiente", "cerrando"), nomatch = 5L)
  out <- out[order(priority, -out$brecha, out$faculty, out$schedule,
                   monitoreo_aulas_rango_codigo(out$operational_code)), , drop = FALSE]
  # El tope existe por el tamaño del payload —1,3 MB ya hoy— pero DECLARA lo que
  # deja fuera. Recortaba 500 en silencio: sobre un plan de 2 615 filas eso son
  # 2 115 aulas que no llegaban a la pantalla, y con la vista por facultad que
  # el estudio necesita faltarian facultades enteras sin que nada lo dijera.
  # El total viaja como atributo para que la vista pueda decir «500 de 2 615».
  # LOS DOS REPARTOS, calculados ANTES del recorte.
  #
  # «Status de aplicacion» y «Cursos-horario por cobertura» los contaba la vista
  # sobre estas mismas filas YA RECORTADAS a 500. Y el recorte no es una muestra
  # al azar: el orden de arriba pone `en_aplicacion` primero, asi que sobre un
  # plan de 2 615 los dos graficos habrian salido SESGADOS HACIA LO AVANZADO y
  # se leerian como si el operativo fuera mejor de lo que es. Declarar «500 de
  # 2 615» avisa del tamaño, no del sesgo.
  estados_conteo <- table(factor(
    out$application_state,
    levels = c("pendiente", "lista", "en_aplicacion", "cerrando", "reemplazada", "en_reserva")
  ))
  estados <- lapply(names(estados_conteo), function(k) {
    list(clave = k, aulas = as.integer(estados_conteo[[k]]))
  })
  # Un estado que no este en la lista NO se traga: `factor()` lo dejaria en NA y
  # el reparto sumaria menos aulas de las que hay sin que nada lo dijera, que es
  # el defecto que esta serie lleva persiguiendo. Se cuenta aparte.
  estados_desconocidos <- as.integer(sum(!(out$application_state %in% names(estados_conteo))))
  # La cobertura, en los mismos tramos que la vista: sin respuestas, 1-25, 26-50,
  # 51-99 y meta cumplida. Un aula sin meta declarada NO entra en el reparto y se
  # cuenta aparte, igual que en el cumplimiento.
  meta_cs <- suppressWarnings(as.numeric(out$expected_valid))
  val_cs <- suppressWarnings(as.numeric(out$respuestas_validas))
  meta_cs[!is.finite(meta_cs)] <- 0
  val_cs[!is.finite(val_cs)] <- 0
  # **El banco NO entra en el reparto de cobertura**, por el mismo motivo por el
  # que ya no entra en `brechas`: son aulas adicionales que esperan en su
  # estrato, no aulas que alguien vaya a visitar, y contarlas como «sin
  # respuestas» convierte el banco en alarma. Medido sobre el fixture, de las
  # 121 que salian «Sin respuestas» —la barra mas larga y la primera que mira el
  # ojo— 73 eran del banco.
  #
  # Se cuentan aparte para que la vista pueda nombrarlas: sacarlas del reparto y
  # no decir donde fueron deja al lector con dos totales que no cuadran.
  #
  # Y «en juego» es el del motor, no el rol: `monitoreo_aulas_en_juego()` ya lo
  # calculo unas lineas mas arriba y viaja en `out$en_juego`. La version que
  # vivia aqui —«no es del banco de extras»— dejaba dentro las RESERVAS DE
  # CADENA dormidas, que es el mismo defecto una capa mas abajo: medido sobre el
  # estudio de HSVG, el reparto y el denominador de «Llegaron a su meta» corrian
  # sobre **360** filas cuando los slots que alguien va a visitar son **30** —30
  # titulares con 330 reservas detras—. Un reemplazo dormido no es un aula sin
  # respuestas: es un aula a la que no le toca, y sale a campo solo si su
  # titular cae.
  del_banco_cs <- tolower(trimws(as.character(out$sample_role %||% ""))) %in% "extra_reserve_pool"
  en_juego_cs <- if (!is.null(out$en_juego)) {
    v <- as.logical(out$en_juego); v[is.na(v)] <- FALSE; v
  } else {
    !del_banco_cs
  }
  # **Y el reparto corre SOLO sobre los APLICADOS.**
  #
  # Gonzalo, 2026-09-10: «en el rendimiento por curso-horario tiene que
  # considerar tambien que debe medirlo solo aquellos que han sido aplicados».
  # Estaba escrito desde el 2026-09-09 en el titulo de su propio boceto de
  # Resumen —«Rendimiento de los cursos-horario APLICADOS»— y el motor repartia
  # todo lo que estuviera en juego.
  #
  # Medido sobre HSVG26ULT2 el 2026-09-10: el reparto corria sobre **219**
  # cursos-horario de los que solo **45** tenian parte de campo. Los otros
  # **174** caian en «Sin respuestas» —el 79 % del grafico, y la barra que el
  # ojo mira primero— diciendo que rindieron cero cuando lo que pasa es que
  # todavia no les toca. Es el mismo defecto que ya se corrigio en la tabla del
  # margen: la prevision del diseño es CONDICIONAL a aplicarse, asi que del
  # pendiente no hay rendimiento que juzgar.
  #
  # «Aplicado» con el vocabulario que el motor ya usa dos pantallas mas arriba:
  # `en_aplicacion` (tiene respuestas o esta en campo) o `cerrando` (aplicada,
  # cerrada, o ya llego a su meta). Un aula aplicada con CERO efectivas sigue
  # entrando, y entra en «Sin respuestas», que ahi si es un resultado.
  aplicado_cs <- as.character(out$application_state %||% rep("", nrow(out))) %in%
    c("en_aplicacion", "cerrando")
  con_meta <- meta_cs > 0 & en_juego_cs & aplicado_cs
  razon <- ifelse(con_meta, val_cs / pmax(meta_cs, 1), NA_real_)
  # **Los tramos separan «le falto una» de «no fue nadie».**
  #
  # El corte anterior (`hasta_25 / hasta_50 / hasta_99 / cumplida`) metia en
  # `hasta_99` todo lo que estuviera entre el 51 % y el 99 %. Medido sobre las
  # 194 aulas aplicadas de 2025 eso son **82 aulas que van de 8 a 270 encuestas
  # faltantes en total**: la banda tapaba justo la distincion que decide si vale
  # la pena volver. Con este corte, las 17 aulas `satisfactorio` suman **8
  # encuestas faltantes entre todas** y las 51 de `insuficiente` + `critico`
  # suman 353.
  #
  # Los nombres son la escala de cumplimiento del aula, monotona y en un solo
  # eje. `pleno` sustituye a `cumplida`, que significaba DOS cosas: este tramo y
  # el estado de la celda facultad x sexo (`quota_status`, mas abajo).
  #
  # La clave viaja al cliente y el grafico empareja POR CLAVE: emparejar por
  # posicion —como se hacia— convierte cualquier recorte futuro en etiquetas
  # cambiadas de sitio sin que nada falle.
  tramo <- ifelse(is.na(razon), NA_character_,
           ifelse(razon <= 0, "nulo",
           ifelse(razon <= 0.50, "critico",
           ifelse(razon <= 0.75, "insuficiente",
           ifelse(razon <= 0.90, "parcial",
           ifelse(razon < 1, "satisfactorio", "pleno"))))))
  claves_cob <- c("nulo", "critico", "insuficiente", "parcial", "satisfactorio", "pleno")
  # La frase viaja CON la clave. Traducir en R y no en el front tiene un motivo
  # medido: en el tick de los tramos, la definicion estaba duplicada en los dos
  # lenguajes y el grafico las emparejaba por posicion, asi que un recorte movia
  # los numeros de etiqueta sin romper nada. Un solo dueño del idioma evita esa
  # familia entera de defectos, y el test anti-jerga ya vive de este lado.
  cobertura <- lapply(claves_cob, function(k) {
    list(clave = k, aulas = as.integer(sum(tramo == k, na.rm = TRUE)),
         etiqueta = monitoreo_aulas_etiqueta_tramo(k))
  })

  # **El banco al final ANTES de recortar.** El tope corta por posicion, y con el
  # banco mezclado se llevaba por delante el plan real: medido en el estudio, de
  # las 500 filas que llegaban al cliente solo 42 no eran banco, sobre un plan de
  # 686. La agenda por dia dibujaba 42 de 686 y su aviso decia «ninguno de los 42
  # cursos-horario», presentando un recorte de payload como si fuera el universo.
  #
  # No sube el tope ni saca el banco del payload —otros paneles lo necesitan y
  # `sample_role` viaja para distinguirlo—: solo decide QUE se sacrifica cuando
  # hay que sacrificar algo. Lo que se quede fuera sigue declarandose en `total`.
  if (nrow(out)) {
    rol <- as.character(out$sample_role %||% rep("", nrow(out)))
    del_banco <- rol == "extra_reserve_pool"
    # A26 (residuo, 2026-09-02): segundo peldano de la escalera de sacrificio.
    # El tope corta por posicion y una reserva DE CADENA con mejor estado
    # podia dejar fuera a un titular — sobre ULT2 (174 titulares + 1.173
    # reservas) la agenda diria «contado sobre 500» con titulares ausentes.
    # El titular entra SIEMPRE: la agenda habla del operativo y el operativo
    # son los titulares. `order` es estable: dentro de cada peldano se
    # conserva el orden del estado.
    out <- out[order(del_banco, rol != "titular"), , drop = FALSE]
  }
  recortado <- .monitoreo_aulas_records(out, max_rows = MONITOREO_AULAS_COURSE_STATUS_TOPE)
  attr(recortado, "total") <- nrow(out)
  # El total SIN banco, que es el universo del que hablan la agenda y sus avisos.
  # `total` a secas incluye el banco —2 616 donde el plan de campo son 686— y
  # ninguna de las dos cifras sirve para las dos preguntas.
  attr(recortado, "total_plan") <- as.integer(sum(
    as.character(out$sample_role %||% rep("", nrow(out))) != "extra_reserve_pool"
  ))
  attr(recortado, "estados") <- estados
  attr(recortado, "estados_desconocidos") <- estados_desconocidos
  attr(recortado, "cobertura") <- cobertura
  # Las que no declaran meta, contadas SOLO entre las que estan en juego: una
  # reserva del banco sin meta no es un dato que falte, es que no le toca.
  attr(recortado, "sin_meta") <- as.integer(sum(en_juego_cs & !(meta_cs > 0)))
  # `banco` sigue siendo el BANCO DE EXTRAS y nada mas: la vista lo nombra asi
  # («N del banco») y meterle las reservas dormidas le pondria un nombre que no
  # es. Las dormidas se cuentan aparte, que son otra poblacion: el banco espera
  # en su estrato, la reserva espera a que caiga SU titular.
  attr(recortado, "banco") <- as.integer(sum(del_banco_cs))
  attr(recortado, "reservas_dormidas") <- as.integer(sum(!en_juego_cs & !del_banco_cs))
  # El denominador de «cuantos llegaron a su meta», publicado en vez de dejar
  # que el cliente lo reste. Restarlo obligaba a conocer las tres poblaciones y
  # a acertar con las tres: el KPI hacia `total - sin_meta - banco` y le salia
  # 360 porque las dormidas no estaban en ninguno de los dos sustraendos.
  attr(recortado, "con_meta") <- as.integer(sum(con_meta))
  # Las que estan en juego y con meta pero TODAVIA NO SE HAN APLICADO. Salen del
  # reparto y se cuentan aparte para que la vista las nombre: sacarlas y no decir
  # donde fueron deja al lector con dos totales que no cuadran, que es el mismo
  # agujero que ya se tapo con el banco y con las dormidas.
  attr(recortado, "sin_aplicar") <- as.integer(sum(meta_cs > 0 & en_juego_cs & !aplicado_cs))
  # El reparto por ROL y estado, que es la forma del libro: la hoja «Aulas
  # Aplicadas (Campo)» va por bloques —TITULAR, REEMPLAZO 1…11— con su propio
  # `STATUS DE APLICACION`. Se calcula sobre `out`, que ya tiene el
  # `application_state` derivado y el estado operativo cruzado con los partes.
  attr(recortado, "rol_y_estado") <- monitoreo_aulas_rol_y_estado(out)
  # **Y el mismo reparto POR FACULTAD.** Gonzalo, 2026-09-10: «el selector de
  # facultad que está en el encabezado no hace que los gráficos actualicen…
  # cuando yo selecciono una facultad, debería mostrarme sólo la de esa
  # facultad; todos los demás gráficos se deben acomodar a ello».
  #
  # Se calcula aquí y no en el frontend por una razón medida: `course_status`
  # viaja RECORTADO a 500 filas de las 1 392 del plan, así que filtrar en la
  # pantalla daría el reparto de un recorte y lo presentaría como el de la
  # facultad. El mismo agujero que ya costó dos paneles en este perfil.
  fac_cs <- trimws(as.character(out$faculty %||% rep("", nrow(out))))
  attr(recortado, "rol_y_estado_por_facultad") <- stats::setNames(
    lapply(sort(unique(fac_cs[nzchar(fac_cs)])), function(f)
      monitoreo_aulas_rol_y_estado(out[fac_cs == f, , drop = FALSE])),
    sort(unique(fac_cs[nzchar(fac_cs)]))
  )
  # La cobertura de cada facultad, con el MISMO criterio que la global: sólo los
  # aplicados, y las que no declaran meta fuera del reparto.
  attr(recortado, "cobertura_por_facultad") <- stats::setNames(
    lapply(sort(unique(fac_cs[nzchar(fac_cs)])), function(f) {
      dentro <- fac_cs == f & con_meta
      tramo_f <- tramo[dentro]
      list(
        cobertura = lapply(claves_cob, function(k)
          list(clave = k, aulas = as.integer(sum(tramo_f == k, na.rm = TRUE)),
               etiqueta = monitoreo_aulas_etiqueta_tramo(k))),
        con_meta = as.integer(sum(dentro)),
        sin_aplicar = as.integer(sum(fac_cs == f & meta_cs > 0 & en_juego_cs & !aplicado_cs))
      )
    }),
    sort(unique(fac_cs[nzchar(fac_cs)]))
  )
  recortado
}

.monitoreo_aulas_quota_source_df <- function(cfg) {
  quotas <- cfg$quotas %||% list()
  if (!is.list(quotas)) return(data.frame(stringsAsFactors = FALSE))
  raw <- quotas$sex_by_faculty %||% quotas$sexo_facultad %||% quotas$population_cross_profiles %||% list()
  df <- tryCatch(.monitoreo_aulas_df(raw, "cuotas sexo facultad"), error = function(e) data.frame(stringsAsFactors = FALSE))
  if (!nrow(df)) return(df)
  primary_role <- .monitoreo_aulas_values(df, .monitoreo_aulas_col(df, c("primary_role", "rol_primario")), "")
  secondary_role <- .monitoreo_aulas_values(df, .monitoreo_aulas_col(df, c("secondary_role", "rol_secundario")), "")
  keep <- .monitoreo_text_key(primary_role) %in% c("faculty", "facultad") &
    .monitoreo_text_key(secondary_role) %in% c("sex", "sexo", "genero", "género")
  if (any(keep)) df <- df[keep, , drop = FALSE]
  df
}

.monitoreo_aulas_plan_sex_faculty_targets <- function(plan_df) {
  if (!is.data.frame(plan_df) || !nrow(plan_df)) return(data.frame(stringsAsFactors = FALSE))
  rows <- list()
  for (i in seq_len(nrow(plan_df))) {
    faculty <- .monitoreo_scalar(plan_df$faculty[[i]] %||% plan_df$stratum[[i]], "Sin facultad")
    expected <- .monitoreo_num(plan_df$expected_valid[[i]] %||% plan_df$eligible_n[[i]], 0)
    sex1 <- .monitoreo_scalar(plan_df$sex_top_1[[i]] %||% "", "")
    sex2 <- .monitoreo_scalar(plan_df$sex_top_2[[i]] %||% "", "")
    n1 <- .monitoreo_num(plan_df$sex_top_1_n[[i]] %||% 0, 0)
    n2 <- .monitoreo_num(plan_df$sex_top_2_n[[i]] %||% 0, 0)
    total <- n1 + n2
    if (!nzchar(sex1) || total <= 0 || expected <= 0) next
    rows[[length(rows) + 1L]] <- data.frame(faculty = faculty, sex = sex1, target = expected * n1 / total, stringsAsFactors = FALSE)
    if (nzchar(sex2) && n2 > 0) {
      rows[[length(rows) + 1L]] <- data.frame(faculty = faculty, sex = sex2, target = expected * n2 / total, stringsAsFactors = FALSE)
    }
  }
  if (!length(rows)) return(data.frame(stringsAsFactors = FALSE))
  df <- do.call(rbind, rows)
  agg <- stats::aggregate(target ~ faculty + sex, data = df, FUN = sum)
  agg$target <- as.integer(round(agg$target))
  agg$source <- "plan_sex_top"
  agg
}

# Dictamen 2026-08-18: cuando el bloque de metas del diseño está vigente y trae
# `cuota_sexo`, ESA cuota manda sobre la proyección del marco/plan. El overlay
# vive en monitoreo_aulas_avance_cuota.R; aquí solo se le entrega el fallback
# de siempre, que sigue cubriendo a las facultades sin diseño vigente.
.monitoreo_aulas_quota_targets <- function(plan_df, cfg) {
  .monitoreo_aulas_sexo_targets_con_diseno(
    plan_df, cfg,
    fallback = .monitoreo_aulas_quota_targets_fallback(plan_df, cfg)
  )
}

.monitoreo_aulas_quota_targets_fallback <- function(plan_df, cfg) {
  quota_df <- .monitoreo_aulas_quota_source_df(cfg)
  if (nrow(quota_df)) {
    faculty_col <- .monitoreo_aulas_col(quota_df, c("primary_raw", "faculty", "facultad"))
    sex_col <- .monitoreo_aulas_col(quota_df, c("secondary_raw", "sex", "sexo", "genero"))
    count_col <- .monitoreo_aulas_col(quota_df, c("count", "n", "N", "conteo"))
    if (nzchar(faculty_col) && nzchar(sex_col) && nzchar(count_col)) {
      src <- data.frame(
        faculty = .monitoreo_aulas_values(quota_df, faculty_col, "Sin facultad"),
        sex = .monitoreo_aulas_values(quota_df, sex_col, "Sin dato"),
        frame_n = .monitoreo_aulas_num_values(quota_df, count_col, 0),
        stringsAsFactors = FALSE
      )
      src <- src[src$frame_n > 0 & nzchar(src$faculty) & nzchar(src$sex), , drop = FALSE]
      if (nrow(src)) {
        expected_df <- data.frame(
          faculty = as.character(plan_df$faculty %||% plan_df$stratum %||% "Sin facultad"),
          expected_valid = suppressWarnings(as.numeric(plan_df$expected_valid %||% 0)),
          stringsAsFactors = FALSE
        )
        expected_df$expected_valid[!is.finite(expected_df$expected_valid)] <- 0
        expected_by_faculty <- stats::aggregate(expected_valid ~ faculty, data = expected_df, FUN = sum)
        names(expected_by_faculty) <- c("faculty", "expected_total")
        totals <- stats::aggregate(frame_n ~ faculty, data = src, FUN = sum)
        names(totals) <- c("faculty", "frame_total")
        src <- merge(src, totals, by = "faculty", all.x = TRUE, sort = FALSE)
        src <- merge(src, expected_by_faculty, by = "faculty", all.x = TRUE, sort = FALSE)
        src$expected_total[!is.finite(src$expected_total)] <- 0
        src$target <- ifelse(src$frame_total > 0, round(src$expected_total * src$frame_n / src$frame_total), 0)
        src$source <- "calc_muestra_faculty_sex"
        return(src[, c("faculty", "sex", "target", "frame_n", "source"), drop = FALSE])
      }
    }
  }
  .monitoreo_aulas_plan_sex_faculty_targets(plan_df)
}

.monitoreo_aulas_response_faculty_values <- function(responses, plan_df, response_classroom) {
  if (!is.data.frame(responses) || !nrow(responses)) return(character(0))
  faculty_col <- .monitoreo_aulas_col(responses, c("faculty", "facultad", "unidad", "escuela"))
  propia <- if (nzchar(faculty_col)) .monitoreo_aulas_values(responses, faculty_col, "") else rep("", nrow(responses))
  faculty <- rep("", nrow(responses))
  if (is.data.frame(plan_df) && nrow(plan_df) && length(response_classroom)) {
    # Tercera copia del mismo emparejamiento: la respuesta se identifica por el
    # id que viajo en su QR (`collection_unit_id`), no por `classroom_id`.
    # Indexar solo por aula dejaba sin facultad a toda respuesta que llegara con
    # el id del colector, y con ella el cruce de cuotas sexo x facultad ciego.
    #
    # El PLAN manda y la columna de la respuesta solo RELLENA cuando no hay
    # match (dictamen 2026-08-18): es la misma regla con la que el tablero
    # atribuye el numerador de cumplimiento, y con la precedencia invertida
    # las celdas F+M no cuadraban con el total de su facultad.
    valores <- as.character(plan_df$faculty %||% plan_df$stratum %||% "")
    aulas_plan <- as.character(plan_df$classroom_id %||% "")
    unidades_plan <- if ("collection_unit_id" %in% names(plan_df)) {
      as.character(plan_df$collection_unit_id)
    } else {
      NULL
    }
    # Tercera clave, igual que las otras dos copias: el QR de 2026 viaja el
    # codigo operativo.
    codigos_plan <- if ("operational_code" %in% names(plan_df)) {
      as.character(plan_df$operational_code)
    } else {
      NULL
    }
    # Mismo espacio canonico que las otras dos copias del emparejamiento; un
    # identificador tecleado conserva su facultad. Ver
    # `.monitoreo_aulas_clave_colector()`.
    if (.monitoreo_aulas_claves_sin_colision(c(aulas_plan, unidades_plan, codigos_plan))) {
      aulas_plan <- .monitoreo_aulas_clave_colector(aulas_plan)
      if (!is.null(unidades_plan)) {
        unidades_plan <- .monitoreo_aulas_clave_colector(unidades_plan)
      }
      if (!is.null(codigos_plan)) {
        codigos_plan <- .monitoreo_aulas_clave_colector(codigos_plan)
      }
      response_classroom <- .monitoreo_aulas_clave_colector(response_classroom)
    }
    lookup <- stats::setNames(valores, aulas_plan)
    if (!is.null(unidades_plan)) {
      por_unidad <- stats::setNames(valores, unidades_plan)
      por_unidad <- por_unidad[nzchar(names(por_unidad))]
      lookup <- c(lookup, por_unidad[!names(por_unidad) %in% names(lookup)])
    }
    if (!is.null(codigos_plan)) {
      por_codigo <- stats::setNames(valores, codigos_plan)
      por_codigo <- por_codigo[nzchar(names(por_codigo))]
      lookup <- c(lookup, por_codigo[!names(por_codigo) %in% names(lookup)])
    }
    con_id <- nzchar(response_classroom)
    faculty[con_id] <- as.character(lookup[response_classroom[con_id]] %||% "")
    faculty[is.na(faculty)] <- ""
  }
  sin_plan <- !nzchar(faculty)
  faculty[sin_plan] <- propia[sin_plan]
  faculty
}

#' Estado de una celda de cuota facultad x sexo.
#'
#' **Es RETROSPECTIVO: mide lo ya observado, no lo que se va a alcanzar.** Por
#' eso los nombres dicen «alcanzada» y «en progreso» y no «asegurada» ni
#' «deficit proyectado»: esos cuatro estados del contrato de indicadores
#' (`asegurada / ajustada / deficit_proyectado / deficit_no_subsanable`) exigen
#' la proyeccion —lo observado mas el aporte de las aulas pendientes— que
#' todavia no existe. Ponerles ese nombre a estos seria prometer una lectura que
#' el dato no da.
#'
#' Los nombres anteriores mentian de dos formas:
#'
#'   · `en_riesgo` no medía riesgo: medía «ya empezó». Una celda al 10 % y otra
#'     al 99 % caían las dos ahí.
#'   · `pendiente` sonaba benigno y era el caso PEOR —cero observadas— así que
#'     la lectura tranquilizaba justo donde había que mirar.
#'
#' Aqui viven los cuatro estados y en ningun otro sitio: es el unico lugar donde
#' se decide como se llama esto.
#'
#' @param target cuota de la celda.
#' @param observed efectivas observadas en la celda.
#' @return vector de estados.
#' @keywords internal
.monitoreo_aulas_quota_estado <- function(target, observed) {
  target <- suppressWarnings(as.numeric(target))
  observed <- suppressWarnings(as.numeric(observed))
  target[!is.finite(target)] <- 0
  observed[!is.finite(observed)] <- 0
  ifelse(target <= 0, "sin_cuota",
  ifelse(observed >= target, "alcanzada",
  ifelse(observed > 0, "en_progreso", "sin_avance")))
}

.monitoreo_aulas_quota_sex_faculty <- function(plan_df, responses, cfg, valid_response, response_classroom) {
  targets <- .monitoreo_aulas_quota_targets(plan_df, cfg)
  if (!is.data.frame(targets) || !nrow(targets)) return(list())
  sex_col <- monitoreo_aulas_columna_sexo(responses, cfg)
  faculty <- .monitoreo_aulas_response_faculty_values(responses, plan_df, response_classroom)
  sex <- if (nzchar(sex_col)) .monitoreo_aulas_values(responses, sex_col, "") else character(0)
  if (!length(sex)) {
    observed <- data.frame(faculty = character(0), sex = character(0), observed = integer(0), stringsAsFactors = FALSE)
  } else {
    keep <- valid_response %in% TRUE & nzchar(faculty) & nzchar(sex)
    observed <- if (any(keep)) {
      stats::aggregate(rep(1L, sum(keep)), by = list(faculty = faculty[keep], sex = sex[keep]), FUN = sum)
    } else {
      # La columna se llama `observed` DESDE AQUI. Nombrarla `x` y renombrarla
      # despues dejaba el caso vacio sin renombrar —el `if` de abajo pide filas—,
      # asi que el merge salia sin columna `observed` y la linea siguiente
      # asignaba `integer(0)` a un data.frame con filas: 500 al abrir Monitoreo.
      # Se veia el primer dia de campo, con envios que aun no pasan el filtro.
      data.frame(faculty = character(0), sex = character(0), observed = integer(0), stringsAsFactors = FALSE)
    }
    if (nrow(observed)) names(observed)[names(observed) == "x"] <- "observed"
  }
  out <- merge(targets, observed, by = c("faculty", "sex"), all.x = TRUE, sort = FALSE)
  out$observed[is.na(out$observed)] <- 0L
  target_num <- suppressWarnings(as.numeric(out$target))
  target_num[!is.finite(target_num)] <- 0
  out$target <- as.integer(pmax(0L, round(target_num)))
  out$missing <- as.integer(pmax(0L, out$target - out$observed))
  out$progress_pct <- ifelse(out$target > 0L, round(100 * out$observed / out$target, 1), NA_real_)
  out$status <- .monitoreo_aulas_quota_estado(out$target, out$observed)
  # La frase, al lado de la clave y no en el front: un solo dueño del idioma.
  out$etiqueta <- vapply(out$status, monitoreo_aulas_etiqueta_celda, character(1), USE.NAMES = FALSE)
  # Mismo criterio de siempre, con los nombres nuevos. Ojo: renombrar sin tocar
  # esta linea NO rompia nada visible —las dos comparaciones daban FALSE para
  # todas las filas y la tabla quedaba ordenada solo por brecha—, que es la
  # forma mas silenciosa de romper un orden.
  out <- out[order(out$status != "en_progreso", out$status != "sin_avance", -out$missing, out$faculty, out$sex), , drop = FALSE]
  .monitoreo_aulas_records(out, max_rows = 240L)
}

monitoreo_aulas_dashboard <- function(plan = list(), responses = data.frame(), config = list()) {
  cfg <- monitoreo_aulas_normalize_config(config)
  # **El plan se normaliza UNA vez, no dos.**
  #
  # `normalize_config()` ya normalizo `config$plan`, y el caso normal es que el
  # `plan` que llega aqui SEA ese mismo objeto: el router hace
  # `aulas_plan <- s$monitoreo_aulas_plan %||% aulas_cfg$plan`. Normalizarlo otra
  # vez costaba la mitad del tablero — medido sobre 1.424 aulas:
  # `monitoreo_aulas_normalize_plan()` es el **49,6 %** de los 5,0 s, llamada dos
  # veces, con 18 conversiones lista↔data.frame entre las dos.
  #
  # Se compara con el plan CRUDO de la config, no con el normalizado: si son el
  # mismo objeto de partida, el resultado de normalizarlos es el mismo y basta
  # con reusar el que ya se hizo. Si el llamador pasa otro plan —y puede—, se
  # normaliza como siempre.
  plan_crudo <- config[["plan"]] %||% config[["agenda"]]
  ya_normalizado <- !is.null(plan) && !is.null(plan_crudo) && identical(plan, plan_crudo)
  plan <- if (ya_normalizado) cfg[["plan"]] else plan
  plan_df <- .monitoreo_aulas_df(plan %||% cfg[["plan"]], "plan")
  if (!nrow(plan_df)) {
    return(list(
      schema = "monitoreo_aulas_dashboard_v1",
      generated_at = .monitoreo_now_iso(),
      kpis = list(total_aulas = 0L, aulas_aplicadas = 0L, respuestas_validas = 0L, brechas = 0L),
      agenda = list(),
      avance_por_estrato = list(),
      # El marco del avance contra cuota es ESTABLE: viaja tambien sin plan,
      # con sus ceros declarados (y las huerfanas contadas, si ya hay data).
      avance_cuota = .monitoreo_aulas_avance_cuota(
        plan_df, plan_df, responses, cfg,
        .monitoreo_aulas_valid_response(responses, cfg),
        .monitoreo_aulas_response_classroom(responses, cfg)
      ),
      # Y el del seguimiento de tau tambien (C2): sin plan la pantalla tiene
      # que poder decir «todavia no hay aulas aplicadas», que es distinto de no
      # tener bloque y quedarse sin superficie.
      efectividad_seguimiento = .monitoreo_aulas_efectividad_seguimiento(
        plan_df, plan_df, responses, cfg,
        .monitoreo_aulas_valid_response(responses, cfg),
        .monitoreo_aulas_response_classroom(responses, cfg)
      ),
      # Y las dos tasas por AULA tambien (C2): sin plan viaja vacio y con su
      # criterio declarado. La logica vive en monitoreo_aulas_dos_tasas.R.
      dos_tasas = monitoreo_aulas_dos_tasas(plan_df),
      # Y el mapa de horas tambien (C2, decision del lead 2026-09-02): sin
      # plan viaja con dias vacios declarados. La logica vive en
      # monitoreo_aulas_franjas.R.
      franjas = monitoreo_aulas_franjas(plan_df, duracion_min = cfg[["duracion_aplicacion_min"]]),
      brechas = list(),
      reemplazos = list(),
      validation = list()
    ))
  }
  # Con `ya_normalizado` la marca de arriba no sobrevive al paso por
  # `.monitoreo_aulas_df()`, asi que la decision viaja en una bandera y no en un
  # atributo. Sin esto el plan se normalizaba DOS veces por tablero.
  plan_df <- if (ya_normalizado) plan_df
             else .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(plan_df), "plan")
  tracked_df <- plan_df[plan_df$sample_role != "extra_reserve_pool", , drop = FALSE]
  if (!nrow(tracked_df)) tracked_df <- plan_df
  status <- plan_df$operational_status
  valid_response <- .monitoreo_aulas_valid_response(responses, cfg)
  response_classroom <- .monitoreo_aulas_response_classroom(responses, cfg)
  valid_counts <- if (length(valid_response)) {
    table(response_classroom[valid_response & nzchar(response_classroom)])
  } else {
    integer(0)
  }
  # Mismo emparejamiento que usa `course_status`: por eso es un helper y no dos
  # copias. Antes esta linea solo miraba `classroom_id`, asi que brechas,
  # estratos y reemplazos se calculaban sobre ceros.
  plan_df$respuestas_validas <- .monitoreo_aulas_contar_por_fila(plan_df, valid_counts)

  # **La tasa prevista de la FACULTAD, que el plan declara y nunca traia.**
  #
  # `tasa_facultad` existe en el esquema del plan y su contrato dice que la vara
  # agregada «viaja al lado en `tasa_facultad`, tal como la trae la fila del
  # plan». Medido sobre HSVG26ULT2 el 2026-09-08: viene VACIA en las 174 filas
  # M1, igual que `efectividad_tau`. Solo `tasa_efectividad_aula` —la del propio
  # curso-horario— llega llena.
  #
  # La consecuencia se veia en pantalla: la tabla de «Cada curso-horario contra
  # su propio margen» promete una columna «Prevista de su facultad» y la pintaba
  # en blanco en todas sus filas. Y esa columna no es decoracion; su panel
  # explica por que estan las dos varas juntas: «un curso-horario bajo su propia
  # meta tuvo un problema; uno bajo la de su facultad pero sobre la suya solo es
  # mas grande que el promedio».
  #
  # No se puede derivar del plan: dentro de una misma facultad las tasas por
  # curso-horario difieren (0,519 y 0,64 en Ciencias e Ingenieria), asi que la de
  # la facultad es un agregado del DISEÑO, no un promedio de filas. Sale de la
  # misma vigencia que usa `efectividad_seguimiento` para su `tau_previsto`, que
  # es funcion pura de `cfg`. Se rellena AQUI —donde el plan se enriquece— y no
  # en cada consumidor: la columna ya existe para esto y asi la reciben todos.
  local({
    vig <- .monitoreo_aulas_avance_vigencia(cfg)
    taus <- list()
    for (f in vig$facultades) {
      if (!is.list(f)) next
      k <- .monitoreo_scalar(f$faculty_key, "")
      if (!nzchar(k)) k <- .cm_criterios_fac_key(.monitoreo_scalar(f$facultad, ""))
      tau <- .monitoreo_num(f$tau, NA_real_)
      if (nzchar(k) && is.finite(tau)) taus[[k]] <- tau
    }
    if (!length(taus) || !nrow(plan_df)) return(invisible(NULL))
    # Lo YA declarado manda: si una fila trae su propia `tasa_facultad`, se
    # respeta. Esto rellena el hueco, no pisa un dato del plan.
    actual <- suppressWarnings(as.numeric(plan_df$tasa_facultad %||% rep(NA_real_, nrow(plan_df))))
    claves <- vapply(as.character(plan_df$faculty %||% rep("", nrow(plan_df))),
                     function(x) .cm_criterios_fac_key(x), character(1), USE.NAMES = FALSE)
    desde_diseno <- vapply(claves, function(k) {
      v <- if (nzchar(k)) taus[[k]] else NULL
      if (is.null(v)) NA_real_ else as.numeric(v)
    }, numeric(1), USE.NAMES = FALSE)
    plan_df$tasa_facultad <<- ifelse(is.finite(actual), actual, desde_diseno)
    invisible(NULL)
  })
  # **La fecha de aplicacion sale de la PLATAFORMA, no del parte de campo.**
  #
  # Aqui es donde tiene que ir: `plan_df` es lo que alimenta la agenda y con
  # ella la serie, el ritmo, el pronostico y el corte. Sin esto los cuatro salen
  # vacios, porque `applied_at` solo se llena si el equipo anota la hoja de
  # campo — y el registro de campo es una cosa y lo que cuenta es otra. Si el
  # parte SI trae fecha, esa gana: es una declaracion explicita del aplicador.
  .fecha_plataforma <- .monitoreo_aulas_fecha_de_plataforma(response_classroom, responses)
  if (length(.fecha_plataforma)) {
    .de_plataforma <- unname(.fecha_plataforma[as.character(plan_df$classroom_id)])
    if ("collection_unit_id" %in% names(plan_df)) {
      .por_unidad <- unname(.fecha_plataforma[as.character(plan_df$collection_unit_id)])
      .falta <- is.na(.de_plataforma)
      .de_plataforma[.falta] <- .por_unidad[.falta]
    }
    plan_df$fecha_plataforma <- ifelse(is.na(.de_plataforma), "", .de_plataforma)
    .sin_parte <- !nzchar(trimws(as.character(plan_df$applied_at %||% "")))
    plan_df$applied_at <- ifelse(.sin_parte & nzchar(plan_df$fecha_plataforma),
                                 plan_df$fecha_plataforma,
                                 as.character(plan_df$applied_at %||% ""))
  }
  meta_plan <- suppressWarnings(as.numeric(plan_df$expected_valid))
  meta_plan[!is.finite(meta_plan)] <- 0
  # Personas enteras, igual que arriba y que `.mac_brecha()`.
  plan_df$brecha <- ceiling(pmax(0, meta_plan - plan_df$respuestas_validas) - 1e-9)
  plan_df$brecha[!is.finite(plan_df$brecha)] <- 0
  # El plan SEGUIDO: un aula por slot, no una por fila.
  #
  # Fuera el banco —los extras no reemplazan a nadie, son aulas adicionales para
  # cerrar la cuota por facultad— y fuera los eslabones dormidos de cada cadena:
  # de `CH 5` -> `R 5.1` -> `R 5.2` solo una esta en juego a la vez. Contarlas
  # todas contaba el mismo slot tantas veces como respaldos tuviera. Medido sobre
  # HSVG2026: 2 615 filas -> 1 976 sin banco -> 202 en juego, y la meta pasa de
  # 84 110 a 6 901, que es lo que el estudio pide de verdad.
  seguidas <- plan_df[plan_df$sample_role != "extra_reserve_pool", , drop = FALSE]
  if (!nrow(seguidas)) seguidas <- plan_df
  tracked_df <- seguidas[monitoreo_aulas_en_juego(seguidas), , drop = FALSE]
  if (!nrow(tracked_df)) tracked_df <- seguidas
  course_status <- .monitoreo_aulas_course_status(plan_df, responses, cfg, valid_response, response_classroom)
  # Los TARGETS sobre `tracked_df`, no sobre el plan entero: la cuota cuenta las
  # PERSONAS que hay que recoger, y las del banco no se van a recoger —son
  # respaldo del estrato—. Con el plan entero, la tarjeta «Cuota por recoger»
  # presidia Avance con 4 476 mientras los dos paneles de debajo decian 4 336.
  # Lo OBSERVADO va sobre `plan_df` entero con la atribucion unificada del
  # dictamen 2026-08-18 (ver monitoreo_aulas_avance_cuota.R): toda respuesta
  # recogida cuenta a la facultad del aula donde se recogio.
  quotas_sex_faculty <- .monitoreo_aulas_cuotas_sexo_celdas(plan_df, tracked_df, responses, cfg, valid_response, response_classroom)
  # El avance por celda se calcula UNA vez: lo consumen el payload y la reserva
  # dirigida, y dos calculos del mismo dato es como dos lecturas empiezan a
  # discrepar. Sobre `tracked_df`, que excluye el banco: el previsto sale de las
  # aulas del plan, no de las que estan esperando en el estrato. Toma las celdas
  # de `.monitoreo_aulas_cuotas_sexo_celdas` —que reemplazo a
  # `.monitoreo_aulas_quota_sex_faculty` en el tablero— y expone las mismas
  # claves `faculty`/`sex`/`target`/`observed` que esta funcion pide.
  .mau_avance_celdas <- monitoreo_aulas_avance_sexo_facultad(
    .monitoreo_aulas_records(tracked_df), quotas_sex_faculty
  )
  # El avance contra la CUOTA del diseño: numerador sobre el plan entero,
  # denominador del bloque de metas mientras su sello siga vigente, y meta del
  # plan —declarada como tal— cuando no lo este.
  # Recibe las celdas de sexo YA calculadas arriba: la brecha de una facultad
  # es la suma de las suyas, no la resta de su total (ADR 0079).
  avance_cuota <- .monitoreo_aulas_avance_cuota(plan_df, tracked_df, responses, cfg, valid_response, response_classroom,
                                               celdas_sexo = quotas_sex_faculty)
  # El SUPUESTO que dimensionó, contrastado con el campo (ADR 0082). Comparte
  # insumos con `avance_cuota` y contesta otra pregunta: aquél mide si ya
  # tenemos a la gente, éste si las aulas rinden lo que se supuso al comprar el
  # aforo. Vive en `monitoreo_aulas_efectividad_seguimiento.R`.
  # Recibe `avance_cuota` porque el conseguido y la cuota de cada facultad son
  # SUYOS (ADR 0079) y aqui no se recalculan: el margen se proyecta sobre el
  # mismo numerador con el que se mide el cumplimiento.
  efectividad_seguimiento <- .monitoreo_aulas_efectividad_seguimiento(
    plan_df, tracked_df, responses, cfg, valid_response, response_classroom,
    avance_cuota = avance_cuota
  )

  # POR FACULTAD, en el motor y no en la vista.
  #
  # El perfil por facultad se calculaba en el frontend sobre `course_status`, que
  # viaja RECORTADO a 500 filas de 2 615 y ademas incluye las reservas dormidas:
  # el panel que contesta «¿como va Derecho?» estaba midiendo un subconjunto
  # arbitrario. Aqui sale del mismo `tracked_df` que las demas cifras de avance
  # —un aula por slot, sin banco—, asi que las cuatro cuentan lo mismo.
  #
  # Es la unidad con la que se dirige el operativo: «todo debe ser por facultad».
  # El estrato —facultad/sexo/tamaño— sigue publicandose aparte porque es la
  # unidad del DISEÑO, y no son la misma pregunta.
  # **El plan a registros, UNA vez.**
  #
  # `.monitoreo_aulas_records(plan_df)` aparecia dos veces en la salida —la
  # agenda y la reserva dirigida— y convierte las 1.424 filas cada vez. En el
  # perfil ese coste se atribuia a `monitoreo_aulas_reserva_por_celda()`, que
  # salia como el 17,7 % del tablero: R evalua los argumentos de forma perezosa,
  # asi que la conversion se cobraba dentro de la llamada. Medida aparte, esa
  # funcion tarda 0,05 s sobre un banco de 77 aulas; el resto era la conversion.
  # **`methodological_warning` no viaja con la agenda.**
  #
  # Es la MISMA cadena en todas las filas —`calc_muestra_aulas_demo.R:497` la
  # escribe con `paste(collapse = " | ")` una sola vez para la seleccion entera—
  # y por eso pesa lo que pesa: 893 KB de los 4 865 de `agenda`, medido sobre
  # HSVG26ULT2 el 2026-09-08. Un quinto del bloque para repetir un parrafo mil
  # trescientas noventa y dos veces.
  #
  # Y NO SE VE: la tabla descarta las columnas con el mismo valor en todas las
  # filas (`columnasSinConstantesInertes`) y esta no esta en las que sobreviven a
  # esa regla —solo lo hacen las de estado y `que_toca`—. Ningun otro consumidor
  # de Monitoreo lo lee; sus unicas lecturas viven en `calcMuestra`, y ahi salen
  # del objeto de seleccion, no de una fila del plan.
  #
  # Se quita SOLO del payload publicado. `plan_df` lo conserva, porque es el que
  # alimenta al resto del motor y a la publicacion.
  .agenda_registros <- .monitoreo_aulas_records(
    plan_df[, setdiff(names(plan_df), "methodological_warning"), drop = FALSE])

  avance_por_facultad <- stats::aggregate(
    cbind(aulas = rep(1L, nrow(tracked_df)),
          respuestas_validas = tracked_df$respuestas_validas,
          brecha = tracked_df$brecha,
          meta = suppressWarnings(as.numeric(tracked_df$expected_valid))) ~ faculty,
    data = tracked_df,
    FUN = function(x) sum(x, na.rm = TRUE)
  )
  # **Y su corte por SEXO, porque el total puede tapar una celda corta.**
  #
  # Gonzalo: «lo que me interesa es que TODAS LAS FACULTADES CUMPLAN CON SU
  # CUOTA DE SEXO». Esta tabla decia `faculty · aulas · respuestas_validas ·
  # brecha · meta` y ninguna de las cinco columnas conoce el sexo, asi que una
  # facultad podia leerse cubierta con su celda de mujeres cuarenta corta. Es su
  # propio patron: el agregado esconde lo que muerde por celda.
  #
  # No se recalcula nada: se toman las celdas que `monitoreo_aulas_avance_sexo_facultad()`
  # ya produjo unas lineas arriba. Dos lecturas del mismo dato acabarian
  # discrepando.
  local({
    celdas <- .mau_avance_celdas %||% list()
    if (!length(celdas) || !nrow(avance_por_facultad)) return(invisible(NULL))
    por <- function(fac, sexo, campo) {
      hit <- Filter(function(c1) identical(as.character(c1$faculty %||% ""), fac) &&
                      identical(toupper(as.character(c1$sex %||% "")), sexo), celdas)
      if (!length(hit)) return(NA_real_)
      v <- suppressWarnings(as.numeric(hit[[1]][[campo]] %||% NA))
      if (length(v) == 1L && is.finite(v)) v else NA_real_
    }
    fac <- as.character(avance_por_facultad$faculty)
    # **EL AVANCE SE MIDE CONTRA LA CUOTA, no contra lo pronosticado.**
    #
    # Gonzalo, 2026-08-29: «el avance se mide sobre las cuotas del plan, no
    # sobre lo que nosotros hemos pronosticado que va a suceder. Lo que
    # pronosticamos nos sirve para el diseño, para el dimensionamiento de las
    # aulas, pero a nosotros nos interesa llegar a dos mil quinientos con las
    # cuotas que hemos establecido por sexo en cada facultad. Esa es nuestra
    # meta.»
    #
    # Esta tabla publicaba como `meta` la suma de `expected_valid` —elegibles
    # por su tasa—, que es el PRONOSTICO. Medido sobre «campo malo»: esa suma da
    # **3.145,7** frente a una cuota de **2.500**, un 26 % mas alta. Por
    # facultad, CIENCIAS E INGENIERIA publicaba «faltan 397» cuando contra su
    # cuota faltan **232**: 165 respuestas de deficit inflado, un 71 % de mas.
    #
    # El pronostico no se tira: pasa a `meta_prevista`, que es lo que dimensiono
    # el operativo y sigue haciendo falta para leer si el campo rinde. Pero la
    # META es la cuota.
    cuota_de <- function(f) {
      dos <- c(por(f, "F", "cuota"), por(f, "M", "cuota"))
      if (all(is.na(dos))) return(NA_real_)
      sum(dos, na.rm = TRUE)
    }
    avance_por_facultad$meta_prevista <<- avance_por_facultad$meta
    .cuota <- vapply(fac, cuota_de, numeric(1))
    avance_por_facultad$meta <<- ifelse(is.na(.cuota),
                                        avance_por_facultad$meta_prevista, .cuota)
    avance_por_facultad$meta_origen <<- ifelse(is.na(.cuota), "prevista", "cuota")
    # **La brecha es la SUMA DE LAS CELDAS, no la resta del total.**
    #
    # Un hombre de mas no cubre a una mujer que falta. Restar sobre el total
    # deja que un sexo compense al otro, y eso es justo lo que la cuota por sexo
    # existe para impedir — la misma doctrina del ADR 0079 para facultades.
    #
    # **Observado, no hipotetico.** En «campo malo», GASTRONOMIA, HOTELERIA Y
    # TURISMO lleva mujeres 10 de 12 y hombres 14 de 9: el total da 24 sobre una
    # cuota de 21 y la facultad se publicaba con **cero faltan**, con dos
    # mujeres todavia cortas. Es el primer caso medido del agregado engañando, y
    # aparecio al hacer que las partes sumaran el total.
    # **Lo que falta AHORA, no lo que faltaría después de aplicar lo agendado.**
    #
    # La `brecha` de una celda es `cuota - PROYECCION`, y la de la facultad es
    # `cuota - logrado`. Mezclarlas hacía que las partes no sumaran el total:
    # visto en pantalla, «397 respuestas faltan» con «31 mujeres» y «114
    # hombres» debajo. Con la vara unica —la cuota— las dos celdas tienen que
    # sumar lo que le falta a su facultad, o el lector suma y no le cuadra.
    falta_ahora <- function(f, sexo) {
      cq <- por(f, sexo, "cuota"); lo <- por(f, sexo, "logrado")
      if (!is.finite(cq)) return(NA_real_)
      max(0, ceiling(cq - (if (is.finite(lo)) lo else 0) - 1e-9))
    }
    .por_celdas <- vapply(fac, function(f) {
      dos <- c(falta_ahora(f, "F"), falta_ahora(f, "M"))
      if (all(is.na(dos))) return(NA_real_)
      sum(dos, na.rm = TRUE)
    }, numeric(1))
    .por_total <- ceiling(pmax(0, avance_por_facultad$meta -
                               avance_por_facultad$respuestas_validas) - 1e-9)
    avance_por_facultad$brecha <<- ifelse(is.na(.por_celdas), .por_total, .por_celdas)
    avance_por_facultad$mujeres_logrado  <<- vapply(fac, por, numeric(1), "F", "logrado")
    avance_por_facultad$mujeres_deficit  <<- vapply(fac, falta_ahora, numeric(1), "F")
    avance_por_facultad$hombres_logrado  <<- vapply(fac, por, numeric(1), "M", "logrado")
    avance_por_facultad$hombres_deficit  <<- vapply(fac, falta_ahora, numeric(1), "M")
    # La bandera que la tabla necesitaba: **esta facultad tiene alguna celda que
    # no va a cerrar**, aunque su total diga que si.
    # Una celda cuenta como corta cuando su deficit es mayor que cero. `NA`
    # significa que esa celda no existe para la facultad —no que este bien—, y
    # por eso NO cuenta: inventar una alarma sobre una celda ausente es peor que
    # callarla, y el caso se ve en `mujeres_deficit` valiendo NA.
    corta <- function(x) !is.na(x) & x > 0
    avance_por_facultad$celda_corta <<- corta(avance_por_facultad$mujeres_deficit) |
                                       corta(avance_por_facultad$hombres_deficit)
    invisible(NULL)
  })

  # La que mas lejos esta de su meta primero: es a donde va el equipo mañana.
  avance_por_facultad <- avance_por_facultad[order(-avance_por_facultad$brecha,
                                                   avance_por_facultad$faculty), , drop = FALSE]

  # EL CUMPLIMIENTO EN RESPUESTAS, tambien en el motor.
  #
  # Lo sumaba el frontend sobre `course_status`, que viaja RECORTADO a 500 filas.
  # Sobre este fixture no se notaba —236 filas, ningun recorte— y sobre el
  # estudio real de 2 615 el panel habria enseñado la meta, lo cubierto y lo que
  # falta de un subconjunto arbitrario de 500, presentado como el total del
  # estudio. Es el MISMO defecto que ya obligo a mover el perfil por facultad
  # aqui arriba, y la misma reparacion.
  #
  # `cubierto` se satura por aula: recoger de mas en un aula no cubre la falta de
  # otra, que es la trampa que ya tenia la cuota. Un aula sin meta declarada no
  # entra en el denominador —su avance no esta definido— y se cuenta aparte para
  # que el descarte se vea.
  .aulas_num <- function(x) {
    v <- suppressWarnings(as.numeric(x))
    ifelse(is.finite(v), v, 0)
  }
  # La meta de un aula se redondea HACIA ARRIBA, y aqui: `expected_valid` llega
  # fraccionario —es `eligible_n x rendimiento x factor`, p. ej. 18,2— y capar un
  # conteo entero contra una fraccion arrastraba el decimal a las PERSONAS: la
  # pantalla decia «1 248,9 cubren meta» y «358,1 de mas». Media respuesta no
  # existe. Hacia arriba y no al mas cercano, por la misma razon que `fmtCuenta`
  # en el frontend: con 18 no se cumple una meta de 18,2.
  #
  # Se redondea en la meta POR AULA y no en las sumas, para que `cubierto`,
  # `excedente` y `falta` sigan reconciliando: con el objetivo entero las tres
  # salen enteras y `cubierto + excedente` sigue siendo las validas.
  .meta_por_aula <- ceiling(.aulas_num(tracked_df$expected_valid))
  .validas_por_aula <- .aulas_num(tracked_df$respuestas_validas)
  .con_meta <- .meta_por_aula > 0
  cumplimiento_respuestas <- list(
    meta = sum(.meta_por_aula[.con_meta]),
    validas = sum(.validas_por_aula),
    cubierto = sum(pmin(.validas_por_aula[.con_meta], .meta_por_aula[.con_meta])),
    excedente = sum(pmax(0, .validas_por_aula[.con_meta] - .meta_por_aula[.con_meta])),
    falta = sum(pmax(0, .meta_por_aula[.con_meta] - .validas_por_aula[.con_meta])),
    aulas_con_brecha = sum(.validas_por_aula[.con_meta] < .meta_por_aula[.con_meta]),
    sin_meta = sum(!.con_meta)
  )

  advance <- stats::aggregate(
    cbind(aulas = rep(1L, nrow(tracked_df)), respuestas_validas = tracked_df$respuestas_validas, brecha = tracked_df$brecha) ~ stratum,
    data = tracked_df,
    FUN = sum
  )
  applied_by_stratum <- stats::aggregate(
    aplicada ~ stratum,
    data = data.frame(stratum = tracked_df$stratum, aplicada = tracked_df$operational_status %in% c("aplicada", "cerrada", "parcial"), stringsAsFactors = FALSE),
    FUN = sum
  )
  advance <- merge(advance, applied_by_stratum, by = "stratum", all.x = TRUE, sort = FALSE)
  names(advance)[names(advance) == "aplicada"] <- "aulas_aplicadas"
  advance$avance_aulas_pct <- ifelse(advance$aulas > 0, round(100 * advance$aulas_aplicadas / advance$aulas, 1), NA_real_)
  advance$avance_respuestas_pct <- ifelse((advance$respuestas_validas + advance$brecha) > 0, round(100 * advance$respuestas_validas / (advance$respuestas_validas + advance$brecha), 1), NA_real_)
  # POR BRECHA, igual que su grafico. `aggregate()` devuelve los estratos en
  # orden alfabetico, asi que el panel salia con el GRAFICO ordenado por lo que
  # falta —Ciencias 438, Letras 375, Gestion 336…— y la TABLA de debajo por
  # nombre —Arquitectura, Ciencias, Derecho…—. Dos ordenes para las mismas seis
  # filas en el mismo panel obligan a rebuscar cada estrato al pasar de uno a
  # otra. El grafico manda porque es lo que el panel promete: donde falta mas.
  advance <- advance[order(-advance$brecha, advance$stratum), , drop = FALSE]

  brechas <- tracked_df[tracked_df$brecha > 0 | tracked_df$operational_status %in% c("sin_acceso", "cancelada", "reemplazo_pendiente"), , drop = FALSE]
  # `brechas` es un REPORTE, no una tercera copia del plan. Salia con las ~40
  # columnas de `tracked_df`, asi que con 196 aulas —todas con brecha abierta el
  # primer dia— pesaba 337 KB de un payload de 1220: tanto como el plan entero,
  # que ademas ya viaja dos veces. Su tabla muestra ocho columnas y la
  # publicacion a Sheets toma diez.
  #
  # Las columnas son la UNION de lo que sus dos consumidores piden, y estan
  # cubiertas por test: un consumidor nuevo que necesite otra la añade aqui y lo
  # ve fallar, en vez de recibir NULL en silencio —que es el patron que ya costo
  # doce items de esta cola—.
  brechas <- brechas[, intersect(BRECHAS_COLUMNAS_PUBLICADAS, names(brechas)), drop = FALSE]
  # POR BRECHA, de mayor a menor. El filtro nunca ordenaba, asi que la lista
  # salia en el orden del plan —CH 1, CH 2, CH 3…— y el panel existe para decir
  # a quien ir primero. Medido sobre el operativo: abria con 15, 15, 16, 17 y la
  # mayor de todas, 31, estaba en la fila 24.
  #
  # `course_status` YA se ordena por `-brecha`: el mismo hecho estaba ordenado en
  # un bloque y sin ordenar en el otro.
  if (nrow(brechas)) {
    # Desempate por codigo NATURAL: como texto, «CH 10» iba antes que «CH 2».
    orden <- order(-brechas$brecha, monitoreo_aulas_rango_codigo(brechas$operational_code))
    brechas <- brechas[orden, , drop = FALSE]
  }
  # La cadena de reemplazos son las reservas Y las aulas que cayeron.
  #
  # Faltaba el eje de MUESTRA, que es donde vive el reemplazo. Con solo
  # `operational_status` —el eje de la aplicacion, que llena el registro de
  # campo— un aula marcada `REEMPLAZADA` en STATUS MUESTRA no entraba: medido
  # sobre el operativo, 24 titulares caidos y CERO de ellos en la tabla, que
  # mostraba 26 filas y las 26 eran reservas. La consulta se llama «cadena» y no
  # se podia ver junto a que reserva cayo cada aula. Mismo defecto que «Sin
  # agendar»: el rotulo promete un eje y el filtro lee el otro.
  # La lista de reemplazos sale de `seguidas` y NO de `tracked_df`: son dos
  # preguntas distintas sobre el mismo plan. Contar quiere UNA fila por slot —el
  # eslabon en juego—; contar la HISTORIA de un reemplazo quiere las dos, el
  # aula que cayo y la que entro. Al armar las dos desde `tracked_df`, el aula
  # caida desaparecia de su propia cadena y el guard lo cazo.
  replacements <- seguidas[
    nzchar(seguidas$replacement_for)
    | seguidas$operational_status %in% c("reemplazada", "reemplazo_pendiente")
    | seguidas$sample_status %in% "reemplazada", , drop = FALSE]
  # Por que esta cada fila en esta lista, en UNA columna.
  #
  # El motivo vive en un campo distinto segun el papel —`replacement_reason` en
  # la que cae, `activation_reason` en la que entra— y la tabla mostraba solo el
  # primero: sobre filas de reserva, una columna que NUNCA puede llenarse. Se
  # resuelve aqui y no en la vista para que las dos superficies que lo lean
  # digan lo mismo.
  if (nrow(replacements)) {
    cae <- replacements$sample_status %in% "reemplazada" |
      replacements$operational_status %in% c("reemplazada", "reemplazo_pendiente")
    replacements$motivo <- ifelse(
      cae,
      as.character(replacements$replacement_reason %||% ""),
      as.character(replacements$activation_reason %||% "")
    )
    replacements$motivo[is.na(replacements$motivo)] <- ""
  }
  # Y AQUI se recorta, despues de calcular `motivo` y no antes: es la unica
  # columna que esta lista aporta sobre `agenda`.
  replacements <- replacements[
    , intersect(REEMPLAZOS_COLUMNAS_PUBLICADAS, names(replacements)), drop = FALSE]
  # Sobre `seguidas`: la representatividad compara la muestra efectiva con la
  # planificada, y la planificada incluye las reservas que el diseño compro.
  representativity <- .monitoreo_aulas_effective_representativity(seguidas, cfg)

  collector_col <- .monitoreo_aulas_col(responses, c(
    cfg$source_mapping$collector_var,
    # Ver la nota de `.monitoreo_aulas_response_classroom()`: `collectorID` es
    # el nombre que produce nuestro propio QR.
    "collectorID", "collector_id", "collector", "link", "aula_id", "classroom_id"
  ))
  collector_values <- if (nzchar(collector_col)) .monitoreo_aulas_values(responses, collector_col, "") else character(0)

  # Una respuesta huerfana es la que trae un colector que NO pertenece a ninguna
  # aula del plan: un QR de otro estudio, una ficha vieja, un id mal tecleado.
  # Antes este chequeo solo miraba si la respuesta TENIA valor de colector, no
  # si ese valor casaba con algo, asi que una respuesta de un aula inexistente
  # pasaba como buena. Comprobarlo solo es posible desde que el emparejamiento
  # conoce `collection_unit_id`.
  ids_del_plan <- unique(c(
    as.character(plan_df$classroom_id %||% character(0)),
    as.character(plan_df$collection_unit_id %||% character(0))
  ))
  ids_del_plan <- ids_del_plan[nzchar(ids_del_plan)]
  huerfanas <- if (length(valid_response)) {
    valid_response %in% TRUE & (!nzchar(response_classroom) | !(response_classroom %in% ids_del_plan))
  } else {
    logical(0)
  }

  # En un estudio de aulas el MISMO colector lo escanean todos los alumnos del
  # aula: el duplicado es el diseno, no una anomalia. Este chequeo miraba
  # duplicados de colector y por eso decia "review" en cuanto un aula tenia dos
  # respuestas — es decir, siempre. Lo que si es anomalo es la misma RESPUESTA
  # dos veces, y eso se mira por su identificador, no por el del colector.
  respuesta_id_col <- .monitoreo_aulas_col(responses, c(
    "_uuid", "uuid", "_id", "instanceID", "meta/instanceID", "response_id", "submission_uuid"
  ))
  respuesta_ids <- if (nzchar(respuesta_id_col)) {
    .monitoreo_aulas_values(responses, respuesta_id_col, "")
  } else {
    character(0)
  }
  respuestas_repetidas <- sum(duplicated(respuesta_ids[nzchar(respuesta_ids)]))

  # El parte de campo llega de su propia hoja, no del plan: vive aparte en la
  # sesion justo para no perder de cual medida viene cada numero.
  partes_campo <- cfg$partes_campo %||% list()
  descuadres <- monitoreo_aulas_reconciliacion_partes(partes_campo)
  # **Cuantos partes tienen identidad que comprobar**, que no es lo mismo que
  # cuantos partes hay. El control decidia con `length(partes_campo) > 0L`, asi
  # que un lote entero sin asistentes ni efectivas —o con las columnas que el
  # motor no supiera leer— publicaba «Los numeros de cada parte de campo
  # cuadran» sobre partes que nadie comprobo. Es la misma correccion que el
  # cruce entre hojas, en el control de al lado.
  partes_comprobables <- sum(vapply(
    partes_campo,
    function(p) is.list(p) && !is.null(monitoreo_aulas_parte_descuadre(p)),
    logical(1)
  ))

  # El criterio de validez se resolvia en silencio, y contar TODO o filtrar por
  # una columna equivocada dan numeros muy distintos.
  criterio <- monitoreo_aulas_criterio_validez(responses, cfg)
  quota_status <- vapply(quotas_sex_faculty, function(row) .monitoreo_scalar(row$status %||% "", ""), character(1))
  # Los cuatro consumidores de abajo NO comparan contra una lista literal: el
  # productor de estas celdas emite `sin_meta/cumplida/en_riesgo/pendiente` y
  # existe otro juego de claves para lo mismo. La equivalencia vive en
  # `monitoreo_aulas_etiquetas.R`, que es el dueno del idioma.
  # Las dos hojas del libro cuentan la misma aula en dos momentos y nadie las
  # comparaba: el cuadre de arriba mira la aritmetica DENTRO del parte.
  cruce <- monitoreo_aulas_cruce_hojas(partes_campo, cfg$control %||% list())
  # Sobre el plan CRUDO a proposito: `monitoreo_aulas_estado_muestra()` ya
  # convirtio en `sin_contactar` todo lo que no reconoce, asi que preguntarselo
  # al plan normalizado devolveria cero siempre.
  estados_raros <- monitoreo_aulas_estados_no_reconocidos(plan %||% cfg$plan %||% list())
  # Una sola vez: lo consumen el payload y el contraste de veredictos, y
  # calcularlo dos veces sobre 152 filas es trabajo repetido con riesgo de que
  # las dos copias se separen.
  # A11 (2026-09-07): la fila leída del libro se completa con el parte de
  # campo ANTES de publicarse al tablero, con la regla del publicador de la
  # hoja; sin esto seis de nueve filas del día 1 iban sin ALUMNOS EN AULA
  # teniendo parte (monitoreo_aulas_control_desde_parte.R). El cruce de hojas
  # de arriba sigue mirando las filas CRUDAS: mide lo que el equipo tecleó.
  control_publicado <- monitoreo_aulas_control_publicado(
    monitoreo_aulas_control_completar_con_partes(cfg$control %||% list(), partes_campo)
  )
  # De declaracion de diseño a control de verdad: ver
  # `monitoreo_aulas_identificadores.R`.
  identificadores <- monitoreo_aulas_identificadores(responses, isTRUE(cfg$anonymous_responses))
  # Dos cursos-horario con el mismo enlace: sus respuestas entran por la misma
  # puerta y no se pueden separar. Ver `monitoreo_aulas_enlaces.R`.
  enlaces <- monitoreo_aulas_enlaces_compartidos(tracked_df)
  validation <- data.frame(
    check = c("anonymous_responses", "personal_identifiers", "unmapped_valid_responses", "duplicate_responses", "effective_representativity", "sex_faculty_quota", "field_report_reconciliation", "book_sheets_cross_check", "unnamed_control_columns", "unknown_sample_status", "valid_response_criterion", "shared_collector_link"),
    status = c(
      if (isTRUE(cfg$anonymous_responses)) "ok" else "review",
      identificadores$status,
      monitoreo_aulas_estado_control(length(huerfanas) > 0L, any(huerfanas), "warning"),
      # **«No se puede comprobar» NO es «correcto».**
      #
      # Sin columna de identificador de respuesta este control no mira nada, y
      # aun asi se contaba entre los correctos: la pantalla decia «6 correctos»
      # donde uno de los seis declaraba en su propio texto que no habia podido
      # comprobarse. Es el «verde por AUSENCIA» que el Contrato de Superficie
      # prohibe, cometido dentro de la propia lista de validacion.
      if (!nzchar(respuesta_id_col)) "sin_datos"
      else if (respuestas_repetidas > 0L) "review" else "ok",
      # El estado mira el PUNTAJE, no solo el aviso extremo. Antes solo se
      # miraba `warning`, que exige 10 pp de desvio en una sola celda, asi que
      # un puntaje de 0 sobre 100 —la peor representatividad que la escala puede
      # expresar— se mostraba como «Correcto».
      .monitoreo_aulas_representatividad_estado(representativity),
      monitoreo_aulas_estado_control(length(quota_status) > 0L,
                                     any(monitoreo_aulas_celda_en_deuda(quota_status)), "warning"),
      # El Excel no comprueba que asistentes - rechazos - duplicados cuadre con
      # las efectivas. Son pocos casos y por eso nadie los ve a ojo en una hoja
      # de 101 columnas.
      monitoreo_aulas_estado_control(partes_comprobables > 0L, length(descuadres) > 0L),
      # El cruce entre las dos hojas. `ok` cuando coinciden Y cuando no hay con
      # que comparar no se finge que cuadran: eso se dice en el detalle.
      #
      # **Comprobable es que haya VALORES que comparar, no codigos que
      # coincidan.** `comparables` cuenta aulas presentes en las dos hojas;
      # medido el 2026-08-30, las 152 del estudio lo estaban y los tres campos
      # cruzados no aparecian en ninguna de las dos —la Base de control de ese
      # estudio es la de sexo—, asi que el control salia verde afirmando una
      # coincidencia que nunca se comprobo.
      monitoreo_aulas_estado_control(cruce$comparaciones > 0L, length(cruce$hallazgos) > 0L),
      # Columnas de «Base de control» con datos que la cabecera no bautiza. No
      # es un fallo del lector —adivinar seria peor— pero es informacion del
      # equipo que no entra, y hasta ahora nadie lo decia.
      # Comprobable si HAY hoja: o llegaron filas, o el lector conto columnas
      # sin nombre en ella —contarlas ya prueba que la hoja existe, y en un
      # estudio real ese conteo viaja sin las filas—. Pedir solo las filas
      # apagaba el aviso justo cuando tenia algo que decir; lo cazo
      # `test-monitoreo-aulas-campos-declarados.R:89`.
      monitoreo_aulas_estado_control(
        length(cfg$control %||% list()) > 0L || (cfg$control_sin_nombre %||% 0L) > 0L,
        (cfg$control_sin_nombre %||% 0L) > 0L
      ),
      # STATUS MUESTRA con valores que el lector no reconoce. `review` y no
      # `warning` porque se arregla en la hoja o añadiendo el estado, no en
      # campo.
      # Comprobable es que HAYA plan: sin filas, «ok» afirmaba que se miraron
      # los estados de un conjunto vacio.
      monitoreo_aulas_estado_control(
        length(plan %||% cfg$plan %||% list()) > 0L,
        estados_raros$total > 0L,
        "review"
      ),
      # Que criterio de validez se aplico. `review` cuando el estudio declaro
      # una columna que la base no trae —un error de tipeo en la config pasaba
      # por criterio deliberado— y cuando no hay columna y por tanto cuenta
      # TODO, que es una decision que conviene tomar a sabiendas.
      monitoreo_aulas_estado_control(nrow(responses) > 0L,
                                     criterio$modo %in% c("declarada_ausente", "sin_columna")),
      # **`warning` y no `review`: esto no se revisa, se arregla.**
      #
      # Regla del operativo (Gonzalo, 2026-08-30): «cada curso-horario debe tener
      # un enlace al forms», y dos aulas con el mismo no producen una duda que
      # mirar sino respuestas que ya no se pueden separar. `review` lo ponia al
      # nivel de «conviene comprobar esto»; el estudio necesita verlo con el
      # aviso mas fuerte que la lista sabe dar.
      #
      # Sin enlaces sigue siendo `sin_datos`, no «ok»: no se pudo comprobar.
      monitoreo_aulas_estado_control(enlaces$comprobable, enlaces$enlaces > 0L, "warning")
    ),
    detail = c(
      "El tablero agrega por curso-horario, recopilador y enlace.",
      identificadores$detail,
      if (any(huerfanas)) {
        sprintf(
          if (sum(huerfanas) == 1L) "%d respuesta válida no corresponde a ningún curso-horario del plan."
          else "%d respuestas válidas no corresponden a ningún curso-horario del plan.",
          sum(huerfanas)
        )
      } else if (length(valid_response)) {
        "Todas las respuestas válidas se atribuyeron a un curso-horario del plan."
      } else {
        # El estado ya dice `sin_datos`; el texto tiene que decir lo mismo. Con
        # cero respuestas, «todas se atribuyeron» afirma un recuento que no se
        # hizo.
        "Todavía no hay respuestas válidas que atribuir a un curso-horario."
      },
      if (!nzchar(respuesta_id_col)) {
        "La fuente no trae identificador de respuesta; no se puede comprobar."
      } else {
        sprintf("%d respuesta%s repetida%s.", respuestas_repetidas,
                if (respuestas_repetidas == 1L) "" else "s",
                if (respuestas_repetidas == 1L) "" else "s")
      },
      .monitoreo_aulas_representatividad_texto(representativity),
      # **«grupos de facultad y sexo», no «celdas».** El vocabulario de la casa
      # retiro «celda» de la pantalla —es jerga de tabla estadistica para quien
      # lee un tablero— y el ratchet que lo vigila mira el FRONTEND, asi que no
      # podia ver este texto: el detalle sale del motor y `presentDetail` lo
      # pinta tal cual. Medido el 2026-08-30: 14 textos de `monitoreo_aulas_*.R`
      # usan «aula» o «celda» y ninguno esta cubierto por ese ratchet.
      if (length(quota_status)) local({
        n_brecha <- sum(monitoreo_aulas_celda_en_deuda(quota_status))
        sprintf("%s grupo%s de facultad y sexo con brecha.", n_brecha,
                if (n_brecha == 1L) "" else "s")
      }) else "Sin cuota sexo x facultad detectable.",
      if (length(descuadres)) {
        paste(vapply(utils::head(descuadres, 3), monitoreo_aulas_descuadre_texto, character(1)), collapse = " ")
      } else if (partes_comprobables > 0L) {
        sprintf(
          "Los números de los %d partes de campo comprobables cuadran.",
          partes_comprobables
        )
      } else if (length(partes_campo)) {
        # Hay partes y ninguno declara lo que hace falta para la identidad:
        # decir «cuadran» afirmaba una comprobacion que no se hizo.
        sprintf(
          "Los %d partes de campo no declaran asistentes y efectivas, así que no hay identidad que comprobar.",
          length(partes_campo)
        )
      } else {
        "No hay partes de campo que comprobar."
      },
      if (length(cruce$hallazgos)) {
        sprintf(
          "%s%s",
          paste(vapply(utils::head(cruce$hallazgos, 3), monitoreo_aulas_cruce_texto, character(1)), collapse = " "),
          if (length(cruce$hallazgos) > 3L) {
            restantes <- length(cruce$hallazgos) - 3L
            sprintf(" Y %d discrepancia%s mas.", restantes, if (restantes == 1L) "" else "s")
          } else ""
        )
      } else if (cruce$comparaciones > 0L) {
        sprintf(
          "Los %d cursos-horario que están en las dos hojas dicen lo mismo en asistentes, %% de asistencia y quién aplicó.",
          cruce$comparables
        )
      } else if (cruce$comparables > 0L) {
        # El caso que salia como «dicen lo mismo»: los codigos coinciden y no
        # hay un solo valor que enfrentar. El aviso dice cual es la causa, que
        # es lo unico accionable —faltan esas columnas en el libro—.
        sprintf(
          "Los %d cursos-horario están en las dos hojas, pero ninguna de las dos trae asistentes, %% de asistencia ni quién aplicó, así que no hay valores que enfrentar.",
          cruce$comparables
        )
      } else {
        "Ningún curso-horario está en las dos hojas a la vez, así que no hay nada que cruzar."
      },
      if ((cfg$control_sin_nombre %||% 0L) > 0L) {
        sprintf(
          "%d columna%s de la Base de control con datos y la cabecera vacía en el Excel, así que no se leyeron. Ponles nombre en la hoja para que entren.",
          cfg$control_sin_nombre,
          if (identical(as.integer(cfg$control_sin_nombre), 1L) ) "" else "s"
        )
      } else if (length(cfg$control %||% list()) || (cfg$control_sin_nombre %||% 0L) > 0L) {
        "Todas las columnas con datos de la Base de control tienen nombre."
      } else {
        "El libro todavía no trae la hoja «Base de control» que comprobar."
      },
      monitoreo_aulas_estados_no_reconocidos_texto(estados_raros),
      monitoreo_aulas_criterio_texto(criterio),
      # **Dice a donde ir, no solo que hay un problema.** Un aviso que declarara
      # «25 enlaces repetidos» y nada mas obliga a buscar cuales a mano en un
      # libro de mil filas.
      if (!enlaces$comprobable) {
        # Dos ausencias distintas y el lector necesita saber cual: sin enlaces no
        # hay nada, y con enlaces base sin personalizar el estudio esta en el
        # paso anterior —los QR todavia no se han generado— y eso NO es un
        # problema, es el orden del trabajo.
        if ((enlaces$sin_personalizar %||% 0L) > 0L) {
          sprintf(
            paste0("Los %d enlaces del plan son direcciones base, sin el parametro por ",
                   "unidad que distingue a cada curso-horario. Se comprobara cuando se ",
                   "generen los enlaces personalizados y sus QR."),
            enlaces$sin_personalizar
          )
        } else {
          "El plan todavía no trae enlaces de recopilador que comprobar."
        }
      } else if (enlaces$enlaces > 0L) {
        # **La causa, cuando se puede probar.** «23 enlaces repetidos» dice que
        # hay un problema; «el enlace lleva solo los 8 primeros caracteres del
        # identificador» dice como se arregla y de una vez para todas.
        causa <- if (is.na(enlaces$truncado)) "" else sprintf(
          paste0(" El enlace lleva solo los %d primeros caracteres del identificador ",
                 "del curso-horario, así que dos que empiecen igual caen en el mismo."),
          enlaces$truncado
        )
        sprintf(
          paste0("%d cursos-horario comparten %d enlaces con otro: sus respuestas entran ",
                 "por la misma puerta y no se pueden separar después (%s).%s Revisa el ",
                 "enlace en el plan antes de que entre mas campo."),
          enlaces$aulas, enlaces$enlaces, paste(enlaces$ejemplos, collapse = "; "), causa
        )
      } else {
        "Cada curso-horario en juego tiene su propio enlace de recopilador."
      }
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  # El ritmo global se calcula ANTES de la lista para que el reparto por facultad
  # pueda compartir su eje de dias: dos series temporales del mismo operativo, una
  # encima de la otra, con calendarios distintos, no se pueden comparar.
  ritmo_global <- monitoreo_aulas_ritmo_diario(
    responses, valid_response,
    meta = {
      m <- suppressWarnings(as.numeric(avance_cuota$total$cuota))
      if (length(m) == 1L && is.finite(m)) m else 0
    },
    # Y la BRECHA del mismo bloque, que no es `meta - acumulado`: suma lo que
    # le falta a cada grupo de facultad y sexo. Sin ella el pie del ritmo
    # calculaba la resta y se apagaba entero en cuanto el total superaba la
    # cuota, callando las 170 personas que sí faltaban.
    brecha = {
      b <- suppressWarnings(as.numeric(avance_cuota$total$brecha))
      if (length(b) == 1L && is.finite(b)) b else NULL
    }
  )
  .ritmo_borde <- function(cual) {
    d <- ritmo_global$dias
    if (!length(d)) return(NULL)
    (if (identical(cual, "desde")) d[[1L]] else d[[length(d)]])$fecha
  }

  list(
    schema = "monitoreo_aulas_dashboard_v1",
    generated_at = .monitoreo_now_iso(),
    selection_run_id = cfg$selection_run_id,
    frame_hash = cfg$frame_hash,
    anonymous_responses = isTRUE(cfg$anonymous_responses),
    kpis = list(
      # INVENTARIO, no conteo de slots: la tarjeta dice «titulares y reservas del
      # plan» y eso es lo que cuenta. Un slot con once respaldos sigue siendo un
      # slot para la meta, pero el plan tiene doce aulas y decir 1 seria mentir
      # sobre lo que se compro. Las cifras que miden AVANCE —brechas, metas,
      # cuota, ritmo— si van por slot, sobre `tracked_df`.
      total_aulas = as.integer(nrow(seguidas)),
      aulas_titulares = as.integer(sum(seguidas$wave == "M1")),
      # **El registro de campo cuenta, que es lo que promete el rotulo.**
      #
      # La tarjeta dice «APLICADAS · declaradas en el registro de campo» y la
      # cifra salia SOLO de `operational_status`, que es el estado del PLAN.
      # Medido el 2026-08-25 importando una semana simulada de 40 partes (35
      # APLICADA): Consultas ensenaba «40 partes · de 586 personas en el aula
      # quedaron 540 respuestas» y la tarjeta seguia diciendo 0.
      #
      # Y no era un olvido del operativo: desde el libro ese estado NO PUEDE
      # llegar a «aplicada». Los unicos valores que la hoja «Listas» ofrece para
      # STATUS MUESTRA son AGENDADA / REAGENDADA / REEMPLAZADA / EN RESERVA n, y
      # ninguno mapea a «aplicada» en `.monitoreo_aulas_status`. El parte guarda
      # su veredicto en `application_status`, que es OTRO campo de la MISMA fila.
      #
      # Se unen en vez de sustituir: `operational_status` la enciende por otras
      # vias —handoff, sincronizacion— y quedarse solo con el parte bajaria la
      # cifra de los estudios que no llenan el libro.
      #
      # Y la tercera vía, desde el 2026-09-07: **un aula con RESPUESTAS se está
      # aplicando, haya parte o no.** Primer día de campo, ocho aulas
      # produciendo encuestas y la tarjeta decía UNA, la única con parte
      # escrito. El parte lo rinde el encargado de campo cuando puede y en la
      # primera semana llega tarde; las respuestas llegan solas. Es la misma
      # definición que usan la Base de control, el Plan del día y el avance por
      # facultad —`monitoreo_aulas_aula_aplicada()`—, aplicada aquí sobre las
      # columnas del frame para no rearmar la lista de unidades.
      aulas_aplicadas = as.integer(sum(
        seguidas$operational_status %in% c("aplicada", "cerrada") |
          seguidas$application_status %in% "aplicada" |
          .monitoreo_aulas_contar_por_fila(
            seguidas, .monitoreo_aulas_named_counts(response_classroom, valid_response)) > 0
      )),
      aulas_parciales = as.integer(sum(seguidas$operational_status == "parcial")),
      # Reemplazos GASTADOS: cuenta reservas que entraron, asi que necesita ver
      # la cadena entera y no solo el eslabon en juego.
      reemplazos_usados = as.integer(sum(nzchar(seguidas$replacement_for) & seguidas$operational_status %in% c("agendada", "en_campo", "aplicada", "cerrada", "parcial"))),
      respuestas_validas = as.integer(sum(valid_response)),
      respuestas_total = as.integer(length(response_classroom)),
      # **Las que no son del estudio, contadas aparte.** «60 descartadas por el
      # filtro» mete en la misma bolsa dos noticias distintas: las que llegaron
      # por el QR de capacitación o de prueba —no son del operativo y no hay
      # nada que arreglar— y las que sí son de un aula pero no pasan el criterio
      # de validez, que es lo que el campo puede mover. El primer día de
      # HSVG2026 eran 36 y 24.
      respuestas_fuera_del_operativo = as.integer(sum(
        .monitoreo_aulas_descartada(responses, cfg))),
      filter_passed = as.integer(sum(.monitoreo_aulas_filter_passed(responses, valid_response), na.rm = TRUE)),
      filter_rejected = as.integer(max(0L, length(response_classroom) - sum(.monitoreo_aulas_filter_passed(responses, valid_response), na.rm = TRUE))),
      # Sobre `tracked_df` y no sobre `plan_df`, que es el plan ENTERO. Eran dos
      # denominadores para la misma palabra: este KPI contaba 2 615 sobre el
      # estudio real mientras la lista `brechas` que resume —construida unas
      # lineas mas abajo, sobre `tracked_df`— traia 1 976. La diferencia son las
      # 639 reservas del BANCO, que no cuelgan de ningun titular y son respaldo
      # del estrato, no aulas que alguien vaya a visitar: contarlas como aulas
      # por debajo de su meta convertia el banco en deuda.
      brechas = as.integer(sum(tracked_df$brecha > 0)),
      quota_cells = as.integer(length(quotas_sex_faculty)),
      quota_cells_ok = as.integer(sum(monitoreo_aulas_celda_cubierta(quota_status))),
      quota_cells_pending = as.integer(sum(monitoreo_aulas_celda_en_deuda(quota_status))),
      representativity_effective_score = representativity$effective_score,
      representativity_score_loss = representativity$score_loss
    ),
    agenda = .agenda_registros,
    course_status = course_status,
    # Cuantas hay DE VERDAD. Sin esto, `course_status` de 500 sobre un plan de
    # 2 615 se leia como «el estudio tiene 500 aulas».
    course_status_total = as.integer(attr(course_status, "total") %||% length(course_status)),
    course_status_total_plan = as.integer(attr(course_status, "total_plan") %||% 0L),
    # Los dos repartos que la vista sumaba sobre el payload recortado.
    course_status_estados = attr(course_status, "estados") %||% list(),
    course_status_estados_desconocidos = as.integer(attr(course_status, "estados_desconocidos") %||% 0L),
    course_status_cobertura = attr(course_status, "cobertura") %||% list(),
    course_status_sin_meta = as.integer(attr(course_status, "sin_meta") %||% 0L),
    # Cuantas del reparto son banco. La vista las nombra en vez de dejar dos
    # totales que no cuadran entre la cabecera y el pie.
    course_status_banco = as.integer(attr(course_status, "banco") %||% 0L),
    course_status_reservas_dormidas = as.integer(attr(course_status, "reservas_dormidas") %||% 0L),
    course_status_con_meta = as.integer(attr(course_status, "con_meta") %||% 0L),
    course_status_sin_aplicar = as.integer(attr(course_status, "sin_aplicar") %||% 0L),
    course_status_rol_y_estado = attr(course_status, "rol_y_estado") %||% list(),
    course_status_rol_y_estado_por_facultad = attr(course_status, "rol_y_estado_por_facultad") %||% list(),
    course_status_cobertura_por_facultad = attr(course_status, "cobertura_por_facultad") %||% list(),
    # El embudo del estudio de referencia, por facultad: elegibles -> asistentes
    # -> elegibles presentes -> efectivas, con sus porcentajes de ausencia, ya
    # medidas y rechazo. Viaja tal cual lo dejo el import; el tablero no lo
    # recalcula.
    asistencia_referencia = cfg$asistencia_referencia %||% list(),
    # El BANCO de extras. No es una tercera copia del plan: es el segundo nivel
    # de respaldo —reservas que no cuelgan de ningun titular, repartidas por
    # estrato— y hasta ahora no se veia en ninguna pantalla, asi que cuando una
    # cadena se agotaba entera nadie sabia de donde sacar sin descuadrar la
    # composicion. Agregado por facultad porque esa es la pregunta que se hace
    # primero: «¿de esta facultad me queda algo, y con cuantas mujeres?».
    banco_extras = monitoreo_aulas_banco_extras(plan),
    avance_por_estrato = .monitoreo_aulas_records(advance),
    avance_por_facultad = .monitoreo_aulas_records(avance_por_facultad),
    # El denominador del avance, calculado sobre el conjunto EN JUEGO y entero:
    # la vista lo sumaba sobre un payload recortado a 500 filas.
    cumplimiento_respuestas = cumplimiento_respuestas,
    # El avance contra la cuota del diseño (dictamen 2026-08-18). Los agregados
    # por facultad y global miden contra `design_targets`; el resto del payload
    # sigue midiendo el operativo aula a aula contra la meta del plan.
    avance_cuota = avance_cuota,
    # La τ del diseño contra la del campo, por facultad, con banda y reservas.
    # No es cumplimiento: el déficit que publica es el ATRIBUIBLE A τ, y su
    # denominador son las aulas ya aplicadas, no la cuota.
    efectividad_seguimiento = efectividad_seguimiento,
    # Las DOS tasas al grano de AULA: la prevista del diseño y la vara de su
    # facultad lado a lado, contra la observada, con banda y señal. SEÑALA, no
    # descarta (mandato B3). Sobre `plan_df` entero porque el propio bloque
    # decide quien entra —titulares y quien tenga señal de campo—; las
    # `respuestas_validas` por fila ya estan calculadas arriba. La logica vive
    # en monitoreo_aulas_dos_tasas.R.
    dos_tasas = monitoreo_aulas_dos_tasas(plan_df),
    # El mapa de HORAS por dia: ventanas confirmadas y tentativas, pico por
    # rango real y citas por confirmar. Deriva de monitoreo_aulas_ventanas()
    # (B11); la logica vive en monitoreo_aulas_franjas.R.
    franjas = monitoreo_aulas_franjas(plan_df, duracion_min = cfg[["duracion_aplicacion_min"]]),
    # El eje de TIEMPO, que aulas no tenia y los otros perfiles llevan desde
    # hace tiempo. La meta viaja con la serie para que la vista no tenga que
    # recomponerla desde otro bloque del payload. Es el denominador global de
    # `avance_cuota`: la cuota del diseño vigente, o la meta del plan en
    # degradacion —que es exactamente la conducta que esta linea ya tenia.
    ritmo_diario = ritmo_global,
    # **La misma serie, repartida por facultad.** Con una facultad en el selector
    # del encabezado, «Ritmo de la recoleccion» seguia dibujando el operativo
    # entero: la serie se construye sobre `responses`, que no viaja a la vista,
    # asi que el reparto no se podia hacer alli. La calcula la MISMA funcion que
    # la global, sobre el mismo eje de dias. Ver
    # `monitoreo_aulas_ritmo_por_facultad.R`.
    ritmo_por_facultad = monitoreo_aulas_ritmo_por_facultad(
      responses, valid_response,
      faculty_values = .monitoreo_aulas_response_faculty_values(responses, plan_df, response_classroom),
      avance_cuota = avance_cuota,
      desde = .ritmo_borde("desde"), hasta = .ritmo_borde("hasta")
    ),
    quotas_sex_faculty = quotas_sex_faculty,
    # **«Con lo que ya tengo agendado, ¿llego?»**, por facultad y sexo, en las
    # cuatro combinaciones de los dos mandos de la pestaña «Metas». Se calcula
    # aquí y no en la pantalla por la misma razón que las jornadas del día a
    # día: dos sitios que calculan la misma cifra empiezan a discrepar. Ver
    # `monitoreo_aulas_payload_proyeccion.R`.
    proyeccion_metas = monitoreo_aulas_proyeccion_payload(
      .monitoreo_aulas_records(plan_df), responses = responses,
      partes = partes_campo, cuotas = cfg[["design_targets"]], cfg = cfg
    ),
    # **De cuántas respuestas cuentan, y por qué no cuentan las demás.** La
    # resta muda —«944 de 1 049»— metía en la misma bolsa las que no son del
    # operativo y las que sí lo son y no pasan el criterio. Son dos cosas: la
    # primera no pide nada, la segunda es trabajo hecho que no suma. Ver
    # `monitoreo_aulas_respuestas_desglose.R`.
    respuestas_desglose = monitoreo_aulas_respuestas_desglose(
      .monitoreo_aulas_records(plan_df), responses = responses, cfg = cfg
    ),
    # Y las aulas de cada facultad: cuántas planificó el sorteo y cuántas se han
    # aplicado. Van por facultad y no por sexo — un aula no se reparte entre
    # hombres y mujeres, la misma visita da de los dos.
    aulas_por_facultad = monitoreo_aulas_aulas_por_facultad(
      .monitoreo_aulas_records(plan_df), responses = responses,
      partes = partes_campo, cfg = cfg
    ),
    # El avance por celda con sus cuatro series. Va AL LADO del estado
    # retrospectivo y no en su lugar: `quotas_sex_faculty` dice donde estas y
    # esto dice si vas a llegar y si el campo se comporta como el modelo. Son
    # dos lecturas y las dos sirven.
    avance_sexo_facultad = .mau_avance_celdas,
    # Y para las celdas que NO van a llegar, a que aula del banco ir. Solo donde
    # hay decision que tomar: una celda asegurada no necesita candidatos.
    # **Qué relevo le queda a cada titular.** Es la SALIDA que le faltaba a la
    # tabla del margen: dice quién rindió por debajo y, hasta ahora, ahí se
    # paraba. Medido el 2026-09-10: 13 de los 14 por debajo tienen reserva de
    # cadena viva. No se confunde con `reserva_dirigida`, que va por celda en
    # déficit y busca en el banco de extras — ver el motor.
    reserva_de_la_cadena = monitoreo_aulas_reserva_de_la_cadena(
      .monitoreo_aulas_records(plan_df)
    ),
    reserva_dirigida = monitoreo_aulas_reserva_por_celda(
      .mau_avance_celdas, .agenda_registros
    ),
    brechas = .monitoreo_aulas_records(brechas),
    reemplazos = .monitoreo_aulas_records(replacements),
    # El parte de campo entero, no solo lo que no cuadra. El control de
    # Validacion nombraba las aulas descuadradas y no habia donde ir a mirarlas;
    # y lo que el equipo anota en la hoja «Aulas Aplicadas (Campo)» no se veia
    # en ninguna tabla. La resta la calcula el mismo helper que decide el
    # descuadre, asi que la tabla y el aviso no pueden discrepar.
    partes_campo = monitoreo_aulas_partes_publicados(partes_campo),
    # La tercera hoja del operativo. Viajaba de la importacion a la sesion y ahi
    # moria: sus 25 campos propios —validadores, cortas y largas, umbrales 70T y
    # 70P, cuota por sexo del aula, rango horario— no llegaban a ninguna
    # superficie. El resumen acompana a las filas para que la vista pueda decir
    # que grupo del control viene vacio en vez de pintar ceros medidos.
    # Con la facultad adosada desde el plan: la hoja del equipo no la trae y sin
    # ella la cola de trabajo solo puede ordenarse por aula suelta, cuando el
    # equipo sale por facultad. El cruce cuenta lo que cruza —`sin_cruce` viaja
    # en el resumen— porque un homonimo ya se hizo pasar por conexion en este
    # mismo perfil.
    # **El criterio de validez del ESTUDIO, para poder contrastarlo con el del
    # libro.** Se calculaba y sólo se gastaba en el texto de un control, así que
    # la Base de control enseñaba las columnas «VALIDADOR 1/2/3» de la hoja sin
    # nada que dijera de quién son. Son dos sistemas distintos —los filtros que
    # el estudio declara aquí y las casillas que el equipo llenó en su Excel— y
    # en este corte ni el número coincide: 2 filtros contra 3 columnas.
    criterio_validez = criterio,
    # **Que es un aula valida SEGUN EL ESTUDIO.** `NULL` mientras no se declare,
    # que es como estan todos los estudios hoy: la app se cree el veredicto del
    # Excel porque no tiene criterio propio. Cuando se declara, el motor calcula
    # el suyo y lo CONTRASTA con el de la hoja —no lo sustituye—: el equipo
    # decide con su formula y aqui se ve donde las dos no coinciden.
    criterio_aula = (function() {
      crit <- monitoreo_aulas_criterio_aula(cfg)
      if (is.null(crit)) return(NULL)
      monitoreo_aulas_contraste_veredicto(control_publicado, crit)
    })(),
    # Cual de los filtros declarados descarta que. Hasta ahora solo viajaba el
    # total de validas, asi que un filtro que no descarta nada era invisible.
    cadena_filtros = monitoreo_aulas_cadena_filtros(responses, cfg),
    # Cuanto duraron las respuestas. Contesta aunque la base no traiga marcas
    # de tiempo —el estudio de aulas de hoy no las trae— para que la vista
    # pueda decir que faltan en vez de no mostrar nada.
    tiempos = monitoreo_aulas_tiempos(responses, cfg, response_classroom),
    # Calidad de las respuestas abiertas. Igual que `tiempos`, contesta aunque
    # no haya nada que leer: este estudio no trae instrumento, asi que la vista
    # dira que no se sabe cuales son sus preguntas abiertas.
    texto_abierto = monitoreo_texto_abierto_payload(responses, cfg$instrumento_survey),
    control_calidad = monitoreo_aulas_control_con_facultad(
      control_publicado,
      plan %||% cfg$plan %||% list()
    )$filas,
    control_calidad_resumen = monitoreo_aulas_control_resumen(cfg$control %||% list()),
    # De que libro salen estas cifras y que hojas trajo. `NULL` cuando el
    # estudio nunca importo uno, que es distinto de un libro sin hojas.
    libro = monitoreo_aulas_libro_recibo(cfg$libro, plan),
    representativity = representativity,
    validation = .monitoreo_aulas_records(validation)
  )
}

monitoreo_aulas_update_agenda <- function(current, updates = list()) {
  plan_df <- .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(current), "plan")
  upd_df <- .monitoreo_aulas_df(updates, "updates")
  if (!nrow(upd_df)) return(monitoreo_aulas_normalize_plan(plan_df))
  if (!"classroom_id" %in% names(upd_df)) {
    id_col <- .monitoreo_aulas_col(upd_df, c("aula_id", "codigo_aula", "id"))
    if (nzchar(id_col)) names(upd_df)[names(upd_df) == id_col] <- "classroom_id"
  }
  if (!"classroom_id" %in% names(upd_df)) upd_df$classroom_id <- ""
  if (!"operational_code" %in% names(upd_df)) {
    code_col <- .monitoreo_aulas_col(upd_df, c("codigo_operativo", "codigo_aula_operativa"))
    if (nzchar(code_col)) names(upd_df)[names(upd_df) == code_col] <- "operational_code"
  }
  if (!"operational_code" %in% names(upd_df)) upd_df$operational_code <- ""
  # Tercer identificador admitido: el que viaja en el QR. Ver la nota de
  # `.monitoreo_aulas_plan_index()` — es preparatorio para la superficie de
  # registro que todavia no existe, no un arreglo de un defecto observado.
  if (!"collection_unit_id" %in% names(upd_df)) {
    unit_col <- .monitoreo_aulas_col(upd_df, c("unit_id", "collectorID", "collector_id"))
    if (nzchar(unit_col)) names(upd_df)[names(upd_df) == unit_col] <- "collection_unit_id"
  }
  if (!"collection_unit_id" %in% names(upd_df)) upd_df$collection_unit_id <- ""
  if (!any(nzchar(upd_df$classroom_id) | nzchar(upd_df$operational_code) |
           nzchar(upd_df$collection_unit_id))) {
    stop("Las actualizaciones requieren classroom_id, operational_code o collection_unit_id.", call. = FALSE)
  }
  for (i in seq_len(nrow(upd_df))) {
    cid <- .monitoreo_scalar(upd_df$classroom_id[[i]], "")
    code <- .monitoreo_scalar(upd_df$operational_code[[i]], "")
    unit <- .monitoreo_scalar(upd_df$collection_unit_id[[i]], "")
    if (!nzchar(cid) && !nzchar(code) && !nzchar(unit)) next
    idx <- .monitoreo_aulas_plan_index(plan_df, cid, code, unit)
    if (!length(idx)) next
    row <- upd_df[i, , drop = FALSE]
    for (nm in names(row)) {
      # **Los alias que la normalizacion acepta, el update los descartaba.**
      #
      # `monitoreo_aulas_normalize_plan` resuelve la fecha de aplicacion con una
      # lista de candidatos —`applied_at`, `fecha_aplicacion`,
      # `hora_aplicacion`— asi que el plan normalizado solo tiene `applied_at`.
      # Aqui, `if (!nm %in% names(plan_df)) next` tira TODO lo demas sin decir
      # nada: un update con `applied_date` —el nombre que usa el parte del
      # libro, «FECHA DE APLICACION»— se perdia entero.
      #
      # Medido el 2026-08-24 simulando cinco dias de campo: las diez aulas
      # quedaron «aplicada» con sus efectivas y su aplicador, y **sin una sola
      # fecha**. El aviso de «cursos-horario vencidos sin aplicar» y el ritmo
      # diario se calculan sobre esa fecha.
      #
      # Se traduce en vez de descartar. Que la lista viva aqui y no en un
      # helper compartido es deliberado: son los alias de ESTE update, y el
      # normalizador ya tiene los suyos para leer un plan externo.
      # `origen` es la columna que LLEGA; `nm`, la del plan donde se escribe.
      # Separarlas no es aseo: leer `row[[nm]]` con el nombre ya traducido
      # devuelve NULL, porque en la fila entrante ese nombre no existe.
      origen <- nm
      nm <- switch(nm,
        applied_date = "applied_at",
        fecha_aplicacion = "applied_at",
        hora_aplicacion = "applied_time",
        observaciones = "field_note",
        aplicador = "applied_by",
        nm
      )
      if (!nm %in% names(plan_df)) next
      value <- .monitoreo_scalar(row[[origen]], "")
      if (!nzchar(value) && !nm %in% c("link", "qr", "word_link", "pdf_link", "package_label", "package_status", "collector_id", "responsible", "replacement_note",
                                    "applied_by", "applied_at", "field_note")) next
      # El enlace de aplicación es lo que termina impreso en el QR: una URL que
      # no puede recibir los parámetros de unidad se rechaza al guardar, no al
      # descubrir que las respuestas llegaron sin identificar el aula.
      if (identical(nm, "link") && nzchar(value)) {
        capture_url_require(value, context = .monitoreo_scalar(plan_df$classroom_id[[idx[[1]]]], "Enlace de aplicación"))
      }
      plan_df[idx, nm] <- value
    }
    plan_df$operational_status[idx] <- .monitoreo_aulas_status(plan_df$operational_status[idx], plan_df$operational_status[idx])
    plan_df$updated_at[idx] <- .monitoreo_now_iso()
  }
  monitoreo_aulas_normalize_plan(plan_df)
}

monitoreo_aulas_apply_replacement <- function(current, classroom_id, replacement_id, reason = "otro", note = "") {
  plan_df <- .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(current), "plan")
  classroom_id <- .monitoreo_scalar(classroom_id, "")
  replacement_id <- .monitoreo_scalar(replacement_id, "")
  if (!nzchar(classroom_id) || !nzchar(replacement_id)) {
    stop("Se requiere el curso-horario caído y el de reemplazo.", call. = FALSE)
  }
  idx_old <- .monitoreo_aulas_plan_index(plan_df, classroom_id, classroom_id)
  idx_new <- .monitoreo_aulas_plan_index(plan_df, replacement_id, replacement_id)
  if (!length(idx_old)) stop("No se encontró el curso-horario caído en el plan.", call. = FALSE)
  if (!length(idx_new)) stop("No se encontró el curso-horario de reemplazo en el plan.", call. = FALSE)
  old_classroom_id <- .monitoreo_scalar(plan_df$classroom_id[[idx_old[[1]]]], classroom_id)
  reason <- .monitoreo_aulas_reason(reason)
  plan_df$operational_status[idx_old] <- "reemplazada"
  plan_df$replacement_reason[idx_old] <- reason
  plan_df$replacement_note[idx_old] <- .monitoreo_scalar(note, "")
  plan_df$updated_at[idx_old] <- .monitoreo_now_iso()
  plan_df$operational_status[idx_new] <- "agendada"
  plan_df$replacement_for[idx_new] <- old_classroom_id
  plan_df$replacement_reason[idx_new] <- reason
  plan_df$replacement_note[idx_new] <- .monitoreo_scalar(note, "")
  plan_df$updated_at[idx_new] <- .monitoreo_now_iso()
  monitoreo_aulas_normalize_plan(plan_df)
}
