# Servicio con sesión de las variables propias de cada base (ADR 0106).
#
# Declarar o quitar columnas propias, guardar o borrar variables calculadas y
# marcar la base «ya viene codificada». Todo vive en la meta de la base
# (`estudio$bases[[b]]`), que viaja en el `.pulso`; nada reescribe el XLSForm ni
# la data originales.
#
# Base explícita siempre (`base` obligatorio): en un estudio multibase una
# declaración que cayera en la base activa por omisión hablaría de otra base.

.base_variables_base <- function(s, base) {
  base <- .origen_externo_chr(base)
  if (!nzchar(base)) {
    stop_api(400, "E_BASE_REQUIRED", "Indica la base ('base'): las variables propias se declaran por base.")
  }
  bases <- ((s %||% list())$estudio %||% list())$bases %||% list()
  if (is.null(bases[[base]])) {
    stop_api(404, "E_BASE_NOT_FOUND", sprintf("No existe la base «%s».", base),
             list(base = base, bases = as.list(names(bases))))
  }
  base
}

# Instrumento ORIGINAL de la base (sin declaraciones) y su data normalizada: el
# par de «originales» de Analítica, el mismo que se analiza.
.base_variables_par_original <- function(s, nombre) {
  meta <- s$estudio$bases[[nombre]]
  pair <- .analitica_pair_for_base(s, meta, "originales", nombre)
  xls_path <- ((pair %||% list())$xls %||% list())$path %||% ""
  dat_path <- ((pair %||% list())$data %||% list())$path %||% ""
  if (!nzchar(xls_path) || !file.exists(xls_path) || !nzchar(dat_path) || !file.exists(dat_path)) {
    stop_api(409, "E_ANALITICA_SOURCE_MISSING",
             sprintf("No se pudo resolver el par XLSForm/Data para la base '%s'.", nombre))
  }
  inst <- reporte_instrumento(path = xls_path)
  data <- normalize_data_for_xlsform(.analitica_read_data_file(pair$data), inst)
  list(inst = inst, data = data, xls_path = xls_path)
}

.base_variables_nombres_instrumento <- function(inst) {
  n <- as.character(((inst %||% list())$survey %||% data.frame(name = character(0)))$name)
  unique(n[!is.na(n) & nzchar(n)])
}

#' Estado de las variables propias de una base (contrato GET del ADR 0106).
#' @keywords internal
base_variables_consultar <- function(sid, base) {
  s <- session_get(sid)
  nombre <- .base_variables_base(s, base)
  meta <- s$estudio$bases[[nombre]]
  par <- .base_variables_par_original(s, nombre)
  extras <- base_variables_detectar_columnas(par$data, par$inst, meta[["variables_propias"]])
  pendientes <- Filter(function(r) identical(.origen_externo_chr(r[["motivo"]]), "pendiente"),
                       .base_variables_retiradas_vigentes(meta))
  list(
    base = nombre,
    ya_codificada = isTRUE(meta[["ya_codificada"]]),
    extras = extras,
    calculadas = meta[["variables_calculadas"]] %||% list(),
    retiradas = as.list(.base_variables_retiradas_nombres(meta)),
    retiradas_pendientes = lapply(pendientes, function(r) .origen_externo_chr(r[["variable"]]))
  )
}

# Normaliza una columna a declarar contra lo que la base trae.
.base_variables_validar_propia <- function(d, extras, en_instrumento, calculadas) {
  nombre <- .origen_externo_chr((d %||% list())[["name"]])
  if (!nzchar(nombre)) {
    stop_api(400, "E_BASE_VARIABLE_NOMBRE_INVALIDO", "Cada columna a declarar necesita su 'name'.")
  }
  if (nombre %in% c(en_instrumento, calculadas)) {
    stop_api(409, "E_BASE_VARIABLE_DUPLICADA", sprintf(
      "«%s» ya es una pregunta del instrumento o una variable calculada de esta base: no se declara otra vez.",
      nombre), list(name = nombre))
  }
  if (!(nombre %in% extras)) {
    stop_api(422, "E_BASE_VARIABLE_INEXISTENTE", sprintf(
      "La base no trae una columna «%s» que el instrumento no declare.", nombre), list(name = nombre))
  }
  tipo <- .origen_externo_chr(d[["tipo"]])
  if (!(tipo %in% .BASE_VARIABLES_TIPOS)) {
    stop_api(422, "E_BASE_VARIABLE_TIPO_INVALIDO", sprintf(
      "El tipo «%s» de «%s» no es uno de %s.", tipo, nombre, paste(.BASE_VARIABLES_TIPOS, collapse = ", ")),
      list(name = nombre, tipo = tipo))
  }
  opciones <- list()
  if (identical(tipo, "select_one")) {
    opciones <- .base_variables_escala_valida(d[["opciones"]])
    if (!length(opciones)) {
      stop_api(422, "E_BASE_VARIABLE_ESCALA_VACIA", sprintf(
        "«%s» es categórica y no trae opciones: declara al menos un código con su etiqueta.", nombre),
        list(name = nombre))
    }
  }
  label <- .origen_externo_chr(d[["label"]])
  list(name = nombre, label = if (nzchar(label)) label else nombre, tipo = tipo, opciones = opciones)
}

#' Declara y/o quita columnas propias de una base.
#' @param declarar lista de `{ name, label, tipo, opciones? }` (crea o reemplaza).
#' @param quitar nombres a dejar de declarar.
#' @keywords internal
base_variables_declarar <- function(sid, base, declarar = list(), quitar = list()) {
  s <- session_get(sid)
  nombre <- .base_variables_base(s, base)
  meta <- s$estudio$bases[[nombre]]
  par <- .base_variables_par_original(s, nombre)
  detectadas <- vapply(base_variables_detectar_columnas(par$data, par$inst), function(e) e$name, character(1))
  calculadas <- vapply(meta[["variables_calculadas"]] %||% list(),
                       function(cv) .origen_externo_chr(cv[["nombre"]]), character(1))
  nuevas <- lapply(declarar %||% list(), .base_variables_validar_propia,
                   extras = detectadas, en_instrumento = .base_variables_nombres_instrumento(par$inst),
                   calculadas = calculadas)
  quitar <- .base_variables_lista(quitar)
  propias <- meta[["variables_propias"]] %||% list()
  nombres_previos <- vapply(propias, function(p) .origen_externo_chr(p[["name"]]), character(1))
  avisos <- lapply(setdiff(quitar, nombres_previos), function(q) list(
    codigo = "no_declarada", mensaje = sprintf("«%s» no estaba declarada: no hay nada que quitar.", q)))
  propias <- propias[!(nombres_previos %in% c(quitar, vapply(nuevas, function(p) p$name, character(1))))]
  propias <- c(propias, nuevas)
  if (length(quitar) && isTRUE(.analitica_base_prefers_adapted(s, meta, nombre))) {
    avisos[[length(avisos) + 1L]] <- list(codigo = "codificacion_aplicada", mensaje = paste(
      "La base ya tiene la codificación aplicada: el instrumento adaptado conserva lo que se",
      "declaró al aplicar hasta que vuelvas a aplicar la codificación."))
  }
  meta$variables_propias <- propias
  s$estudio$bases[[nombre]] <- meta
  .session_env[[sid]] <- s
  .base_variables_tras_mutar(sid, nombre)
  c(base_variables_consultar(sid, nombre), list(avisos = avisos))
}

#' Crea o reemplaza (por `nombre`) una variable calculada de la base.
#' @param marca campos que se agregan a la calculada ya validada; los segmentos
#'   de cruce (ADR 0107) la marcan `segmento = <clave>` para saber cuál es suya.
#' @keywords internal
base_variables_guardar_calculada <- function(sid, base, cuerpo, marca = list()) {
  s <- session_get(sid)
  nombre_base <- .base_variables_base(s, base)
  meta <- s$estudio$bases[[nombre_base]]
  par <- .base_variables_par_original(s, nombre_base)
  propias <- vapply(meta[["variables_propias"]] %||% list(),
                    function(p) .origen_externo_chr(p[["name"]]), character(1))
  ocupados <- unique(c(.base_variables_nombres_instrumento(par$inst), names(par$data), propias))
  calcs <- meta[["variables_calculadas"]] %||% list()
  previas <- vapply(calcs, function(x) .origen_externo_chr(x[["nombre"]]), character(1))
  nuevo <- .origen_externo_chr((cuerpo %||% list())[["nombre"]])
  # Puede partir de las calculadas declaradas ANTES que ella (las de después
  # podrían depender de ésta): se materializan en orden y sus columnas cuentan.
  posicion <- match(nuevo, previas)
  anteriores <- if (is.na(posicion)) calcs else calcs[seq_len(posicion - 1L)]
  datos <- base_variables_materializar(par$data, utils::modifyList(meta, list(variables_calculadas = anteriores)))
  listas <- .base_variables_con_lista(par$inst, meta[["variables_propias"]], anteriores)
  cv <- base_variables_validar_calculada(cuerpo, columnas = names(datos), ocupados = ocupados,
                                         con_lista = listas$con_lista, multiples = listas$multiples)
  if (length(marca)) cv[names(marca)] <- marca
  # Reemplazar en su lugar conserva el orden de cálculo.
  if (is.na(posicion)) calcs <- c(calcs, list(cv)) else calcs[[posicion]] <- cv
  meta$variables_calculadas <- calcs
  s$estudio$bases[[nombre_base]] <- meta
  .session_env[[sid]] <- s
  .base_variables_tras_mutar(sid, nombre_base)
  list(
    base = nombre_base,
    calculada = cv,
    resumen = base_variables_resumen_calculada(base_variables_calcular(datos, cv), cv),
    calculadas = calcs
  )
}

# Qué variables tienen lista de respuestas (sus 80–99 son sin dato en una
# fórmula) y cuáles admiten varias respuestas (una fórmula no las admite).
.base_variables_con_lista <- function(inst, propias, calculadas) {
  sv <- (inst %||% list())$survey %||% data.frame(type = character(0), name = character(0))
  tipo <- trimws(as.character(sv$type))
  nombre <- as.character(sv$name)
  propias_one <- vapply(Filter(function(p) identical(.origen_externo_chr(p[["tipo"]]), "select_one"), propias %||% list()),
                        function(p) .origen_externo_chr(p[["name"]]), character(1))
  calc_lista <- vapply(Filter(function(cv) !identical(.origen_externo_chr(cv[["regla"]]), "formula"), calculadas %||% list()),
                       function(cv) .origen_externo_chr(cv[["nombre"]]), character(1))
  list(
    con_lista = unique(c(nombre[grepl("^select_one\\b", tipo)], propias_one, calc_lista)),
    multiples = unique(nombre[grepl("^select_multiple\\b", tipo)])
  )
}

#' Borra una variable calculada de la base.
#' @keywords internal
base_variables_quitar_calculada <- function(sid, base, nombre) {
  s <- session_get(sid)
  nombre_base <- .base_variables_base(s, base)
  meta <- s$estudio$bases[[nombre_base]]
  nombre <- .origen_externo_chr(nombre)
  calcs <- meta[["variables_calculadas"]] %||% list()
  previas <- vapply(calcs, function(x) .origen_externo_chr(x[["nombre"]]), character(1))
  if (!nzchar(nombre) || !(nombre %in% previas)) {
    stop_api(404, "E_BASE_VARIABLE_NO_ENCONTRADA", sprintf(
      "La base «%s» no tiene una variable calculada «%s».", nombre_base, nombre),
      list(base = nombre_base, nombre = nombre))
  }
  dependen <- previas[vapply(calcs, function(cv) nombre %in% .base_variables_lista(cv[["variables"]]), logical(1))]
  if (length(dependen)) {
    stop_api(409, "E_BASE_VARIABLE_EN_USO", sprintf(
      "«%s» se usa para calcular %s: quita primero %s.", nombre,
      paste(sprintf("«%s»", dependen), collapse = ", "), if (length(dependen) == 1L) "esa variable" else "esas variables"),
      list(nombre = nombre, dependen = as.list(dependen)))
  }
  meta$variables_calculadas <- calcs[previas != nombre]
  s$estudio$bases[[nombre_base]] <- meta
  .session_env[[sid]] <- s
  .base_variables_tras_mutar(sid, nombre_base)
  list(base = nombre_base, calculadas = meta$variables_calculadas)
}

#' Marca o desmarca la base «ya viene codificada».
#' @keywords internal
base_variables_marcar_codificada <- function(sid, base, ya_codificada) {
  s <- session_get(sid)
  nombre <- .base_variables_base(s, base)
  if (!is.logical(ya_codificada) || length(ya_codificada) != 1L || is.na(ya_codificada)) {
    stop_api(400, "E_BAD_REQUEST", "'ya_codificada' debe ser true o false.")
  }
  s$estudio$bases[[nombre]]$ya_codificada <- isTRUE(ya_codificada)
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  list(base = nombre, ya_codificada = isTRUE(ya_codificada))
}

#' Corta el aplicar de Codificación sobre una base que ya viene codificada.
#' @keywords internal
base_variables_assert_codificable <- function(sid, base) {
  s <- session_get(sid, required = FALSE)
  meta <- (((s %||% list())$estudio %||% list())$bases %||% list())[[as.character(base %||% "")]]
  if (isTRUE((meta %||% list())[["ya_codificada"]])) {
    stop_api(409, "E_CODIF_BASE_YA_CODIFICADA", sprintf(paste(
      "La base «%s» está marcada como «ya viene codificada»: Codificación no la aplica para no",
      "reescribir sus recodificadas. Si quieres codificarla aquí, quita la marca en Carga."), base),
      list(base = as.character(base)))
  }
  invisible(TRUE)
}

# Tras cualquier declaración: la lectura memoizada ya no acierta por sí sola (la
# meta de la base es parte de su firma), pero los caches de la SESIÓN —el
# contexto preparado de Analítica, el instrumento y la data de Codificación y
# las fuentes por base que leen Equivalencias y Validación— sí hay que rehacerlos.
.base_variables_tras_mutar <- function(sid, nombre) {
  s <- session_get(sid)
  s <- .session_state_clear(s, c("analitica_rp_inst", "analitica_rp_data"))
  s$analitica_rp_inst_sources <- list()
  s$analitica_rp_data_sources <- list()
  if (is.list(s$codif_por_base) && is.list(s$codif_por_base[[nombre]])) {
    s$codif_por_base[[nombre]][c("inst", "data")] <- list(NULL)
  }
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  tryCatch(
    .pulso_rebuild_estudio_runtime_sources(sid, bases = nombre),
    error = function(e) message(sprintf(
      "[base_variables] fuentes de «%s» sin reconstruir: %s", nombre, conditionMessage(e)))
  )
  invisible(TRUE)
}

# --- Carga manual con preguntas retiradas (ADR 0106, punto 4) ----------------

#' Compatibilidad de una carga manual: las preguntas que faltan se retiran.
#'
#' Antes la carga manual rechazaba la base con `E_DATA_XLSFORM_INCOMPATIBLE`
#' en cuanto faltaba una pregunta. Ahora las faltantes quedan como variables
#' retiradas (motivo `metadato` para los tipos de metadato, `pendiente` para el
#' resto) y el instrumento de la base las deja fuera. Lo que sigue rechazándose
#' es la base a la que le falta MÁS de la mitad del instrumento: eso no es una
#' base preparada fuera, es otra base (mismo umbral que el backstop del
#' backfill, `.carga_backfill_missing_expected`).
#'
#' @return `list(rp_inst, retiradas, n_filas)`; `rp_inst` sin las retiradas.
#' @keywords internal
base_variables_carga_retiradas <- function(data_df, rp_inst, xls_path, data_file_id) {
  compat <- validate_data_xlsform_compatibility(data_df, rp_inst)
  n_filas <- if (is.data.frame(data_df)) nrow(data_df) else 0L
  if (isTRUE(compat$ok)) return(list(rp_inst = rp_inst, retiradas = list(), n_filas = n_filas))
  if (compat$n_missing > 0.5 * compat$expected_columns) {
    .carga_assert_data_xlsform_compatible(data_df, rp_inst)
  }
  survey <- rp_inst$survey
  faltantes <- origen_externo_variables_faltantes(survey, names(data_df))
  vistas <- vapply(faltantes, function(f) f$variable, character(1))
  tipos <- .dn_survey_type_base(survey)[match(compat$missing_columns, .dn_survey_names(survey))]
  for (i in seq_along(compat$missing_columns)) {
    v <- compat$missing_columns[[i]]
    if (!(v %in% vistas)) {
      faltantes[[length(faltantes) + 1L]] <- list(variable = v, tipo = tipos[[i]] %||% "", motivo_sugerido = "")
    }
  }
  retiradas <- lapply(faltantes, function(f) list(
    variable = f$variable, tipo = f$tipo,
    motivo = if (identical(f$motivo_sugerido, "metadato")) "metadato" else "pendiente"
  ))
  provisional <- list(
    data_file_id = data_file_id,
    retiradas_carga_manual = lapply(retiradas, function(r) r$variable),
    origen_externo = list(enabled = TRUE, data_file_id = data_file_id, variables_retiradas = retiradas))
  list(rp_inst = base_variables_instrumento(xls_path, provisional),
       retiradas = retiradas, n_filas = n_filas)
}

#' Registra en el origen externo de la base las retiradas de la carga manual.
#' @keywords internal
base_variables_carga_registrar <- function(sid, nombre, retiro) {
  if (!length((retiro %||% list())$retiradas)) return(invisible(FALSE))
  s <- session_get(sid)
  meta <- s$estudio$bases[[nombre]]
  if (is.null(meta)) return(invisible(FALSE))
  previo <- meta[["origen_externo"]]
  vigente <- identical(.origen_externo_estado(previo, meta[["data_file_id"]]), "vigente")
  bloque <- .origen_externo_bloque_sin_lista(if (vigente) previo else NULL, retiro$n_filas, "", "",
                                             meta[["data_file_id"]])
  bloque$variables_retiradas <- retiro$retiradas
  bloque$n_variables_retiradas <- length(retiro$retiradas)
  bloque$variables_retiradas_origen <- "carga_manual"
  meta$origen_externo <- bloque
  # Fuera del bloque: redeclarar el origen externo rehace el bloque, y la base
  # sigue sin estas columnas.
  meta$retiradas_carga_manual <- lapply(retiro$retiradas, function(r) r$variable)
  s$estudio$bases[[nombre]] <- meta
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  message(sprintf("[base_variables] «%s» cargada con %d variable(s) retirada(s): %s", nombre,
                  length(retiro$retiradas),
                  paste(vapply(retiro$retiradas, function(r) r$variable, character(1)), collapse = ", ")))
  invisible(TRUE)
}
