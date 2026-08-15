# =============================================================================
# Sembrado de criterios de revisión
# =============================================================================
# Las reglas de Validación se derivan del XLSForm: relevant → salto, required,
# constraint, calculate. Por eso solo encuentran lo que el instrumento previó.
# Los "Criterios de revisión" cubren el resto, pero exigen que alguien sepa que
# debe escribirlos: la capacidad existe y la cobertura no.
#
# Un sembrador mira la base y PROPONE criterios ya formados, listos para que el
# analista los revise. Nunca los persiste: devuelve candidatos.
#
# Regla de diseño: un sembrador no puede nombrar variables de un proyecto. Se
# apoya solo en (a) metadatos que la plataforma de recolección escribe siempre
# con el mismo nombre, y (b) lo que el estudio declara por rol. Mismo criterio
# que `.codif_key_candidates` para las llaves de caso.
# =============================================================================

# Columnas donde ODK/Kobo escriben la versión del formulario con que se
# recolectó cada envío. Son nombres de plataforma, no de estudio.
.semilla_version_candidatas <- c(
  "__version__", "_version", "__version", "_xform_id_string", "formhub/uuid"
)

# Columnas de marca temporal del envío, para desempatar cuál versión es la
# vigente cuando dos aparecen con la misma frecuencia.
.semilla_envio_candidatas <- c("_submission_time", "submission_time", "end")

.semilla_valores_utiles <- function(x) {
  v <- trimws(as.character(x))
  v[!is.na(v) & nzchar(v) & v != "NA"]
}

# Primera columna presente en `data` de una lista de candidatas.
.semilla_primera_columna <- function(data, candidatas) {
  for (nm in candidatas) if (nm %in% names(data)) return(nm)
  NA_character_
}

# ¿Ya hay un criterio que cubra esta variable con este tipo? Evita que cada
# carga vuelva a proponer lo mismo y que el analista acumule duplicados.
.semilla_ya_cubierta <- function(reglas, tipo, variable) {
  for (r in reglas %||% list()) {
    if (!identical(as.character(r$tipo %||% ""), tipo)) next
    vars <- as.character(unlist(r$variables %||% list()))
    if (variable %in% vars) return(TRUE)
  }
  FALSE
}

# --- Cómo se nombra una variable o una opción en los textos ------------------
# Siempre la etiqueta primero y el código entre paréntesis. El analista lee la
# pregunta, no el nombre de la columna; el código va detrás porque lo necesita
# para buscar en la base, no para entender de qué se habla. Si no hay etiqueta
# —metadatos de plataforma, variables precargadas— queda solo el código, que es
# lo único que existe.

.semilla_label_col <- function(df) {
  if (is.null(df) || !ncol(df)) return(NA_character_)
  if ("label" %in% names(df)) return("label")
  cand <- grep("^label", names(df), value = TRUE)
  if (length(cand)) cand[1] else NA_character_
}

# "¿Cuál es su situación laboral?" (p12) · o solo «p12» si no hay etiqueta que
# mostrar. Los ejemplos de los comentarios son inventados a propósito: usar el
# nombre real de una variable de un cliente lo deja escrito en el repo.
.semilla_nombrar_var <- function(nombre, survey = NULL) {
  nombre <- as.character(nombre)[1]
  if (is.null(survey) || !is.data.frame(survey) || !("name" %in% names(survey))) {
    return(sprintf("«%s»", nombre))
  }
  lab_col <- .semilla_label_col(survey)
  if (is.na(lab_col)) return(sprintf("«%s»", nombre))
  fila <- which(!is.na(survey$name) & survey$name == nombre)
  if (!length(fila)) return(sprintf("«%s»", nombre))
  et <- trimws(as.character(survey[[lab_col]][fila[1]]))
  if (is.na(et) || !nzchar(et)) return(sprintf("«%s»", nombre))
  sprintf("«%s» (%s)", et, nombre)
}

# "Sí, trabajo (1)" · o "1" si la lista no trae etiqueta.
.semilla_nombrar_opciones <- function(codigos, lista, choices = NULL, max_n = 8L) {
  codigos <- as.character(codigos)
  if (is.null(choices) || !is.data.frame(choices) ||
      !all(c("list_name", "name") %in% names(choices))) {
    return(paste(codigos, collapse = ", "))
  }
  lab_col <- .semilla_label_col(choices)
  sub <- choices[!is.na(choices$list_name) & choices$list_name == lista, , drop = FALSE]
  fmt <- vapply(codigos, function(cod) {
    if (is.na(lab_col)) return(cod)
    i <- which(as.character(sub$name) == cod)
    if (!length(i)) return(cod)
    et <- trimws(as.character(sub[[lab_col]][i[1]]))
    if (is.na(et) || !nzchar(et)) cod else sprintf("%s (%s)", et, cod)
  }, character(1))
  extra <- if (length(fmt) > max_n) sprintf(" y %d más", length(fmt) - max_n) else ""
  paste0(paste(utils::head(fmt, max_n), collapse = " · "), extra)
}

#' Detectar con cuántas versiones del formulario se recolectó una base
#'
#' Hecho sobre la data, no una regla: lo consumen tanto Carga —que avisa cuando
#' todavía se puede corregir el proceso— como el sembrador de Validación, que
#' propone el criterio. Una sola implementación para que las dos superficies no
#' puedan decir cosas distintas de la misma base.
#'
#' @param data data.frame de la base cargada.
#' @return NULL si la base no registra versión o trae una sola; si no, lista con
#'   `columna`, `vigente`, `versiones`, `n_casos_afectados` y `n_versiones`.
#' @family validacion
#' @export
detectar_versiones_formulario <- function(data) {
  if (!is.data.frame(data) || !nrow(data)) return(NULL)
  col <- .semilla_primera_columna(data, .semilla_version_candidatas)
  if (is.na(col)) return(NULL)
  vals <- .semilla_valores_utiles(data[[col]])
  if (!length(vals)) return(NULL)
  frec <- sort(table(vals), decreasing = TRUE)
  if (length(frec) < 2L) return(NULL)

  # La vigente es la mayoritaria. En empate manda la del envío más reciente:
  # una versión se publica y a partir de ahí se usa, así que la última en
  # llegar es la que está vigente.
  top <- names(frec)[frec == max(frec)]
  vigente <- top[1]
  if (length(top) > 1L) {
    col_envio <- .semilla_primera_columna(data, .semilla_envio_candidatas)
    if (!is.na(col_envio)) {
      # Las marcas de ODK/Kobo son ISO 8601, así que el orden lexicográfico es
      # el cronológico. Se compara como texto a propósito: parsear fechas acá
      # obligaría a adivinar zona horaria y formato por plataforma.
      envio <- trimws(as.character(data[[col_envio]]))
      envio[is.na(envio)] <- ""
      ultimo <- which(envio == max(envio))[1]
      if (!is.na(ultimo)) {
        cand <- trimws(as.character(data[[col]][ultimo]))
        if (length(cand) == 1L && !is.na(cand) && cand %in% top) vigente <- cand
      }
    }
  }
  otras <- setdiff(names(frec), vigente)
  list(
    columna = col,
    vigente = vigente,
    n_versiones = length(frec),
    versiones = as.list(stats::setNames(as.integer(frec), names(frec))),
    n_casos_afectados = sum(as.integer(frec[otras])),
    n_casos = length(vals)
  )
}

#' Proponer el criterio de procedencia del formulario
#'
#' Una base debería venir de una sola versión del formulario. Cuando trae más de
#' una, los casos de la versión no vigente pueden traer respuestas que la versión
#' corregida ya no permite — y las reglas derivadas del instrumento las leen
#' contra el formulario actual, así que las reportan como inconsistencias del
#' encuestado en vez de como lo que son: un artefacto de versión.
#'
#' Devuelve 0 o 1 candidato. Cero cuando la base no registra versión, cuando
#' trae una sola, o cuando ya existe un criterio sobre esa columna.
#'
#' @param data data.frame de la base cargada.
#' @param reglas_existentes lista de criterios ya definidos en el scope.
#' @return lista de candidatos; cada uno es una regla lista para `POST
#'   /api/validacion/v2/reglas_custom` más un bloque `semilla` con el porqué.
#' @family validacion
#' @export
reglas_semilla_procedencia <- function(data, reglas_existentes = list()) {
  det <- detectar_versiones_formulario(data)
  if (is.null(det)) return(list())
  if (.semilla_ya_cubierta(reglas_existentes, "fuera_catalogo", det$columna)) return(list())

  list(list(
    tipo = "fuera_catalogo",
    variables = list(det$columna),
    params = list(valores = list(det$vigente)),
    nombre = "Procedencia · la base trae más de una versión del formulario",
    mensaje = sprintf(
      paste("Se recolectó con una versión anterior del formulario, no con la vigente (%s).",
            "Sus respuestas siguen los saltos y catálogos de aquella versión."),
      .semilla_abreviar_hash(det$vigente)
    ),
    severidad = "advertencia",
    activa = TRUE,
    planned_action_type = "ignore_rule",
    semilla = list(
      origen = "procedencia",
      columna = det$columna,
      version_vigente = det$vigente,
      versiones = det$versiones,
      n_casos_afectados = det$n_casos_afectados,
      porque = sprintf(
        paste("La base tiene %d versiones del formulario: %d de %d casos no vienen de la vigente (%s).",
              "Sus saltos y catálogos eran otros, así que lo que las reglas del instrumento",
              "reporten sobre ellos puede ser un artefacto de versión y no un error del encuestado."),
        det$n_versiones, det$n_casos_afectados, det$n_casos,
        .semilla_abreviar_hash(det$vigente)
      )
    )
  ))
}

# Los identificadores de versión de Kobo son hashes de 22 caracteres sin
# significado para nadie. Se muestran abreviados: sirven para reconocer que hay
# dos, no para leerse enteros.
.semilla_abreviar_hash <- function(x, n = 8L) {
  x <- as.character(x)[1]
  if (is.na(x) || nchar(x) <= n + 1L) return(x)
  paste0(substr(x, 1, n), "…")
}

# Códigos que valen en cualquier pregunta aunque no estén en su lista: son el
# estándar de valores especiales de la casa (no sabe / no responde / no aplica).
# Admitirlos puede dejar pasar un caso raro; no admitirlos inundaría de falsos
# positivos toda pregunta que los use sin declararlos en choices.
.semilla_valores_especiales <- c("90", "94", "95", "96", "97", "98", "99")

#' Proponer criterios de dominio para las preguntas de opción única
#'
#' Un `select_one` solo admite los códigos de su lista. Es la restricción más
#' elemental de una categórica y ninguna de las familias derivadas del XLSForm
#' la cubre: `relevant` gobierna si la pregunta se muestra, `required` si debe
#' responderse, `constraint` lo que el formulario declaró a mano — pero que el
#' valor pertenezca a su catálogo no lo verifica nadie.
#'
#' Solo propone donde **hoy hay evidencia**: al menos un valor observado fuera
#' de la lista. Sembrar una regla por cada `select_one` daría cobertura
#' preventiva sobre cargas futuras, pero en un instrumento de 104 preguntas
#' serían 103 criterios que no encuentran nada — el ruido que entierra la
#' pestaña. La cobertura preventiva queda como acción explícita del analista.
#'
#' @param data data.frame de la base cargada.
#' @param survey `inst$survey` con `name`, `type_base` y `list_name`.
#' @param choices `inst$choices` con `list_name` y `name`.
#' @param reglas_existentes lista de criterios ya definidos en el scope.
#' @return lista de candidatos, uno por variable con valores fuera de catálogo.
#' @family validacion
#' @export
reglas_semilla_dominio <- function(data, survey, choices, reglas_existentes = list()) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  if (!is.data.frame(survey) || !nrow(survey)) return(list())
  if (!is.data.frame(choices) || !nrow(choices)) return(list())
  if (!all(c("name", "type_base", "list_name") %in% names(survey))) return(list())
  if (!all(c("list_name", "name") %in% names(choices))) return(list())

  sel <- survey[!is.na(survey$type_base) & survey$type_base == "select_one", , drop = FALSE]
  if (!nrow(sel)) return(list())

  out <- list()
  for (i in seq_len(nrow(sel))) {
    var <- as.character(sel$name[i])
    lista <- as.character(sel$list_name[i])
    if (is.na(var) || !nzchar(var) || !(var %in% names(data))) next
    if (is.na(lista) || !nzchar(lista)) next
    if (.semilla_ya_cubierta(reglas_existentes, "fuera_catalogo", var)) next

    catalogo <- unique(as.character(choices$name[!is.na(choices$list_name) &
                                                 choices$list_name == lista]))
    catalogo <- catalogo[!is.na(catalogo) & nzchar(catalogo)]
    if (!length(catalogo)) next
    observados <- unique(.semilla_valores_utiles(data[[var]]))
    fuera <- setdiff(observados, c(catalogo, .semilla_valores_especiales))
    if (!length(fuera)) next

    var_txt <- .semilla_nombrar_var(var, survey)
    cat_txt <- .semilla_nombrar_opciones(catalogo, lista, choices)
    fuera_txt <- .semilla_nombrar_opciones(fuera, lista, choices)

    n_casos <- sum(.semilla_valores_utiles(data[[var]]) %in% fuera)
    out[[length(out) + 1L]] <- list(
      tipo = "fuera_catalogo",
      variables = list(var),
      params = list(valores = as.list(c(catalogo, .semilla_valores_especiales))),
      nombre = sprintf("Dominio · %s responde fuera de su lista", var_txt),
      mensaje = sprintf(
        "Responde %s, que no está entre las opciones de la pregunta.", fuera_txt
      ),
      severidad = "error",
      activa = TRUE,
      planned_action_type = "nullify_fields",
      origen = "sembrado",
      semilla = list(
        origen = "dominio",
        variable = var,
        lista = lista,
        catalogo = as.list(catalogo),
        valores_fuera = as.list(fuera),
        n_casos_afectados = as.integer(n_casos),
        porque = sprintf(
          paste("%s registra %s, y su lista solo admite: %s.",
                "Ninguna regla derivada del instrumento verifica que el valor",
                "pertenezca a su catálogo."),
          var_txt, fuera_txt, cat_txt
        )
      )
    )
  }
  out
}

#' Reunir todos los criterios propuestos para una base
#'
#' Punto único de entrada del sembrado. Los sembradores que necesitan el
#' instrumento se saltan si no se pasa: el sembrado degrada, no falla.
#'
#' @param data data.frame de la base cargada.
#' @param reglas_existentes lista de criterios ya definidos en el scope.
#' @param survey,choices tablas del instrumento; opcionales.
#' @param config `operational_config` de la base, para los roles declarados.
#' @return lista de candidatos.
#' @family validacion
#' @export
reglas_semilla_todas <- function(data, reglas_existentes = list(),
                                 survey = NULL, choices = NULL, config = NULL) {
  props <- reglas_semilla_procedencia(data, reglas_existentes)
  if (!is.null(survey) && !is.null(choices)) {
    props <- c(props, reglas_semilla_dominio(data, survey, choices, reglas_existentes))
  }
  # Necesita el rol declarado: sin él no propone, no adivina la columna.
  props <- c(props, reglas_semilla_agente(data, config, reglas_existentes, survey))
  props <- c(props, reglas_semilla_continuidad(data, reglas_existentes))
  props <- c(props, reglas_semilla_periodo(data, config, reglas_existentes))
  # Todo lo que sale de un sembrador queda marcado: la pestaña necesita
  # distinguirlo de lo que una persona escribió con criterio propio.
  lapply(props, function(p) { p$origen <- "sembrado"; p })
}

# --- Identidad del caso y del agente -----------------------------------------

# Distancia máxima entre dos nombres para considerarlos el mismo agente escrito
# distinto. 2 tolera una letra caída ("PEREZ DE LA CRUZ" / "PEREZ DELA CRUZ") o
# un acento; más alto empieza a unir personas distintas con apellidos parecidos.
.semilla_agente_distancia <- 2L

.semilla_norm_agente <- function(x) {
  v <- tolower(trimws(as.character(x)))
  v <- iconv(v, to = "ASCII//TRANSLIT")
  gsub("[^a-z0-9]", "", v %||% "")
}

# ¿Cuáles de `candidatos` parecen el mismo nombre que `nombre`, escrito distinto?
# Una sola definición: la usan el sembrador de identidad (Validación) y el cruce
# contra el padrón de encuestadores (Monitoreo). Si cada uno tuviera la suya,
# terminarían diciendo cosas distintas del mismo equipo.
#
# Dos criterios, porque los nombres se ensucian de dos formas: se tipean mal
# (distancia corta) o se escriben incompletos (un prefijo del otro, «Mary» por
# «Mary Berrocal» — ahí la distancia es enorme y el prefijo es lo único que ve).
#
# Recibe y devuelve posiciones sobre `candidatos`, ya normalizados por quien
# llama, para no re-normalizar la misma lista en cada comparación.
.semilla_nombres_cercanos <- function(nombre_norm, candidatos_norm) {
  if (!length(candidatos_norm) || !nzchar(nombre_norm)) return(integer(0))
  d <- as.integer(adist(nombre_norm, candidatos_norm))
  which(d <= .semilla_agente_distancia |
          startsWith(candidatos_norm, nombre_norm) |
          startsWith(nombre_norm, candidatos_norm))
}

#' Proponer el criterio de identidad del agente que recolecta
#'
#' El nombre de quien recolecta se escribe a mano en casi todos los estudios, y
#' cuando se ensucia arrastra todo lo que se reporta por agente: las tablas
#' salen con filas fantasma y el control de campo se degrada sin que nadie lo
#' note. No es un error del encuestado ni algo que el instrumento pueda declarar.
#'
#' Requiere que el estudio haya declarado qué variable cumple el rol de agente
#' (`operational_config$identity$agent_variable`). Sin esa declaración no
#' propone nada: adivinar la columna obligaría a nombrar variables de un
#' proyecto, que es justo lo que ninguna regla puede hacer.
#'
#' Las variantes se **sugieren**, nunca se fusionan solas: dos nombres cercanos
#' pueden ser dos personas.
#'
#' @param data data.frame de la base cargada.
#' @param config `operational_config` normalizado de la base.
#' @param reglas_existentes lista de criterios ya definidos en el scope.
#' @return lista con 0 o 1 candidato.
#' @family validacion
#' @export
reglas_semilla_agente <- function(data, config = NULL, reglas_existentes = list(),
                                  survey = NULL) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  col <- as.character((config$identity %||% list())$agent_variable %||% "")[1]
  if (is.na(col) || !nzchar(col) || !(col %in% names(data))) return(list())
  if (.semilla_ya_cubierta(reglas_existentes, "fuera_catalogo", col)) return(list())

  vals <- .semilla_valores_utiles(data[[col]])
  if (length(vals) < 2L) return(list())
  frec <- sort(table(vals), decreasing = TRUE)
  nombres <- names(frec)
  if (length(nombres) < 2L) return(list())

  # Un agente con apariciones aisladas frente a otro muy parecido y frecuente es
  # el patrón del nombre mal tipeado. Se compara contra los que aparecen más.
  norm <- .semilla_norm_agente(nombres)
  sospechosos <- character(0)
  parecidos <- character(0)
  for (i in seq_along(nombres)) {
    if (as.integer(frec[i]) > 2L) next
    otros <- which(as.integer(frec) > as.integer(frec[i]))
    if (!length(otros)) next
    cerca <- otros[.semilla_nombres_cercanos(norm[i], norm[otros])]
    es_numero <- grepl("^[0-9]+$", trimws(nombres[i]))
    if (length(cerca) || es_numero) {
      sospechosos <- c(sospechosos, nombres[i])
      parecidos <- c(parecidos,
        if (length(cerca)) sprintf("'%s' ~ '%s'", nombres[i], nombres[cerca[1]])
        else sprintf("'%s' (no parece un nombre)", nombres[i]))
    }
  }
  if (!length(sospechosos)) return(list())

  equipo <- setdiff(nombres, sospechosos)
  if (!length(equipo)) return(list())

  list(list(
    tipo = "fuera_catalogo",
    variables = list(col),
    params = list(valores = as.list(equipo)),
    nombre = sprintf("Identidad del agente · %s tiene variantes del mismo nombre",
                     .semilla_nombrar_var(col, survey)),
    mensaje = "El nombre de quien recolectó no coincide con ninguno del equipo; revisar si es una variante mal escrita.",
    severidad = "advertencia",
    activa = TRUE,
    planned_action_type = "replace_value",
    origen = "sembrado",
    semilla = list(
      origen = "agente",
      columna = col,
      equipo = as.list(equipo),
      variantes = as.list(sospechosos),
      pares = as.list(parecidos),
      n_casos_afectados = as.integer(sum(vals %in% sospechosos)),
      porque = sprintf(
        paste("%s tiene %d valores que parecen variantes de otro agente: %s.",
              "Todo lo que se reporte por agente saldría con filas de más.",
              "Se sugieren; conviene confirmar antes de unificar, porque dos",
              "nombres cercanos pueden ser dos personas."),
        .semilla_nombrar_var(col, survey), length(sospechosos),
        paste(parecidos, collapse = " · ")
      )
    )
  ))
}

# Columnas donde la plataforma numera los envíos de forma correlativa.
.semilla_secuencia_candidatas <- c("_index", "_id", "index")

#' Proponer el criterio de continuidad de los envíos
#'
#' El servidor numera cada envío de forma correlativa. Si la base tiene menos
#' casos que números, algo se perdió entre el servidor y el archivo: envíos
#' borrados, un filtro que se aplicó sin registrarse, una descarga parcial.
#' Ninguna regla derivada del instrumento puede verlo, porque ocurre antes de
#' que el instrumento entre en juego — y la diferencia de N queda como un dato
#' que nadie sabe explicar.
#'
#' @param data data.frame de la base cargada.
#' @param reglas_existentes lista de criterios ya definidos en el scope.
#' @return lista con 0 o 1 candidato.
#' @family validacion
#' @export
reglas_semilla_continuidad <- function(data, reglas_existentes = list()) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  col <- .semilla_primera_columna(data, .semilla_secuencia_candidatas)
  if (is.na(col)) return(list())
  if (.semilla_ya_cubierta(reglas_existentes, "continuidad_secuencia", col)) return(list())

  seq_v <- suppressWarnings(as.numeric(data[[col]]))
  seq_v <- seq_v[is.finite(seq_v)]
  if (length(seq_v) < 2L) return(list())
  faltan <- setdiff(seq_len(max(seq_v)), seq_v)
  faltan <- faltan[faltan >= min(seq_v)]
  if (!length(faltan)) return(list())

  list(list(
    tipo = "continuidad_secuencia",
    variables = list(col),
    params = list(),
    nombre = sprintf("Continuidad · faltan %d envío%s en la secuencia",
                     length(faltan), if (length(faltan) == 1L) "" else "s"),
    mensaje = "Después de este caso hay un envío que el servidor numeró y no llegó a la base.",
    severidad = "advertencia",
    activa = TRUE,
    planned_action_type = "ignore_rule",
    origen = "sembrado",
    semilla = list(
      origen = "continuidad",
      columna = col,
      faltantes = as.list(as.integer(faltan)),
      n_casos_afectados = length(faltan),
      porque = sprintf(
        paste("El servidor numeró hasta %d y la base tiene %d casos: faltan %d (%s).",
              "Puede ser envíos borrados, un filtro aplicado sin registrar o una",
              "descarga parcial; conviene saber cuál antes de reportar el N."),
        as.integer(max(seq_v)), length(seq_v), length(faltan),
        paste(utils::head(as.integer(faltan), 8), collapse = ", ")
      )
    )
  ))
}

# Columnas donde la plataforma escribe la marca temporal del envío. Se usan como
# último recurso: la fecha que declara el encuestador dice cuándo se hizo la
# entrevista, que es lo que define el periodo de campo; el timestamp del
# servidor dice cuándo llegó, que puede ser días después.
.semilla_fecha_plataforma <- c("_submission_time", "submission_time", "end", "start")

# Qué proporción de los casos debe quedar dentro del rango propuesto. Recortar
# más que esto deja de ser "quitar la cola" y empieza a ser recortar el campo.
.semilla_periodo_cobertura <- 0.99

.semilla_como_fecha <- function(x) {
  v <- trimws(as.character(x))
  v <- substr(v, 1, 10)                       # tolera "2026-08-03T10:00:00"
  suppressWarnings(as.Date(v, format = "%Y-%m-%d"))
}

# Columnas que parecen una fecha de trabajo de campo: parsean como fecha en casi
# todos los casos y no son la marca del servidor.
.semilla_columnas_fecha <- function(data) {
  n <- nrow(data)
  out <- character(0)
  for (nm in names(data)) {
    if (nm %in% .semilla_fecha_plataforma) next
    f <- .semilla_como_fecha(data[[nm]])
    if (sum(!is.na(f)) / n < 0.9) next
    # Una columna con un solo día no delimita un periodo.
    if (length(unique(f[!is.na(f)])) < 2L) next
    out <- c(out, nm)
  }
  c(out, intersect(.semilla_fecha_plataforma, names(data)))
}

#' Proponer el periodo de trabajo de campo
#'
#' Una encuesta fechada fuera de la ventana de campo puede ser el piloto que se
#' quedó adentro, un dispositivo con la fecha mal configurada o un caso que no
#' pertenece al estudio. Cualquiera de las tres cambia el N, y ninguna se ve si
#' nadie declaró cuál era la ventana.
#'
#' El rango se propone **por masa, no por calendario**: se recortan los días
#' extremos con menos casos mientras la cobertura se mantenga sobre el umbral.
#' Basarse en días contiguos obligaría a adivinar si un hueco es un domingo, un
#' feriado o el final del campo.
#'
#' @param data data.frame de la base cargada.
#' @param config `operational_config` normalizado; si el periodo ya está
#'   declarado no se propone nada.
#' @param reglas_existentes lista de criterios ya definidos en el scope.
#' @param cobertura proporción mínima de casos que debe quedar dentro.
#' @return lista con 0 o 1 candidato.
#' @family validacion
#' @export
reglas_semilla_periodo <- function(data, config = NULL, reglas_existentes = list(),
                                   cobertura = .semilla_periodo_cobertura) {
  if (!is.data.frame(data) || nrow(data) < 3L) return(list())
  # Ya declarado: el control operativo `OP_field_period` lo cubre y proponer una
  # regla equivalente sería duplicar la verificación.
  if (isTRUE((config$field_period %||% list())$enabled)) return(list())

  cols <- .semilla_columnas_fecha(data)
  if (!length(cols)) return(list())
  col <- cols[1]
  if (.semilla_ya_cubierta(reglas_existentes, "rango_fecha", col)) return(list())

  f <- .semilla_como_fecha(data[[col]])
  f <- f[!is.na(f)]
  if (length(f) < 3L) return(list())
  total <- length(f)
  minimo <- ceiling(total * cobertura)

  dias <- sort(unique(f))
  lo <- 1L; hi <- length(dias)
  repeat {
    if (hi - lo < 1L) break
    dentro <- sum(f >= dias[lo] & f <= dias[hi])
    n_lo <- sum(f == dias[lo]); n_hi <- sum(f == dias[hi])
    # Se recorta el extremo más liviano, y solo si lo que queda sigue cubriendo.
    if (n_lo <= n_hi && dentro - n_lo >= minimo) { lo <- lo + 1L; next }
    if (n_hi <  n_lo && dentro - n_hi >= minimo) { hi <- hi - 1L; next }
    break
  }
  if (lo == 1L && hi == length(dias)) return(list())   # nada que recortar

  ini <- dias[lo]; fin <- dias[hi]
  fuera <- which(!is.na(.semilla_como_fecha(data[[col]])) &
                 (.semilla_como_fecha(data[[col]]) < ini |
                  .semilla_como_fecha(data[[col]]) > fin))

  list(list(
    tipo = "rango_fecha",
    variables = list(col),
    params = list(min = as.character(ini), max = as.character(fin),
                  timezone = "America/Lima"),
    nombre = sprintf("Periodo de campo · %s fuera de %s a %s",
                     .semilla_nombrar_var(col), as.character(ini), as.character(fin)),
    mensaje = sprintf("Se registró fuera del periodo de trabajo de campo (%s a %s).",
                      as.character(ini), as.character(fin)),
    severidad = "advertencia",
    activa = TRUE,
    planned_action_type = "ignore_rule",
    origen = "sembrado",
    semilla = list(
      origen = "periodo",
      columna = col,
      inicio = as.character(ini),
      fin = as.character(fin),
      n_casos_afectados = length(fuera),
      n_casos = total,
      porque = sprintf(
        paste("El grueso del campo va del %s al %s (%d de %d casos).",
              "Quedan %d fuera de esa ventana: puede ser el piloto que se quedó",
              "en la base, un equipo con la fecha mal configurada o casos que no",
              "pertenecen al estudio — y cualquiera de los tres cambia el N."),
        as.character(ini), as.character(fin), total - length(fuera), total, length(fuera)
      )
    )
  ))
}

#' Sugerir qué variables pueden cumplir cada rol de identidad
#'
#' El analista declara los roles una vez, pero elegir entre 190 columnas a mano
#' es hostil. Esto perfila la base y propone candidatos para confirmar. No
#' decide nada: es material para un selector.
#'
#' Llave de caso = casi todos sus valores distintos y cobertura alta.
#' Agente = pocos valores distintos frente al total de casos, cobertura alta.
#'
#' @param data data.frame de la base cargada.
#' @param max_por_rol cuántos candidatos devolver por rol.
#' @return lista con `llaves` y `agentes`, cada uno con nombre y por qué.
#' @family validacion
#' @export
identidad_candidatas <- function(data, max_por_rol = 6L) {
  vacio <- list(llaves = list(), agentes = list())
  if (!is.data.frame(data) || !nrow(data) || !ncol(data)) return(vacio)
  n <- nrow(data)

  # Proporción de valores que parecen un nombre de persona: letras y espacio,
  # sin dígitos. Es la señal que separa la columna del equipo de una pregunta
  # abierta con pocas respuestas repetidas — la cardinalidad sola no las
  # distingue, y ordenar solo por ella deja al encuestador fuera del top.
  .parece_nombre <- function(v) {
    if (!length(v)) return(0)
    mean(grepl("^[[:alpha:]][[:alpha:][:space:].'-]+[[:space:]][[:alpha:].'-]+$", v))
  }

  perfil <- lapply(names(data), function(nm) {
    v <- .semilla_valores_utiles(data[[nm]])
    list(nombre = nm, cobertura = length(v) / n,
         distintos = length(unique(v)), ratio = length(unique(v)) / max(n, 1L),
         nominal = .parece_nombre(unique(v)))
  })
  perfil <- Filter(function(p) p$cobertura >= 0.8 && p$distintos > 1L, perfil)

  llaves <- Filter(function(p) p$ratio >= 0.9, perfil)
  llaves <- llaves[order(-vapply(llaves, function(p) p$ratio, numeric(1)))]
  # Ordenar por "menos distintos" pone primero toda dicotómica de respuesta y
  # entierra la columna del equipo. Un equipo de campo tiene varias personas, no
  # dos, así que se prefieren las de más valores dentro del rango plausible.
  agentes <- Filter(function(p) p$distintos >= 2L && p$distintos <= 50L &&
                                p$ratio < 0.5, perfil)
  # Primero las que parecen nombres de persona; entre iguales, las de más
  # valores: un equipo de campo tiene varias personas, no dos.
  agentes <- agentes[order(
    -vapply(agentes, function(p) p$nominal, numeric(1)),
    -vapply(agentes, function(p) p$distintos, numeric(1))
  )]

  fmt <- function(p, rol) list(
    variable = p$nombre,
    distintos = as.integer(p$distintos),
    cobertura = round(p$cobertura, 3),
    porque = if (identical(rol, "llave")) {
      sprintf("%d valores distintos en %d casos: identifica casi uno a uno.", p$distintos, n)
    } else {
      sprintf("%d valores distintos en %d casos: se repite como lo haría un agente.", p$distintos, n)
    }
  )
  list(
    llaves = lapply(utils::head(llaves, max_por_rol), fmt, rol = "llave"),
    agentes = lapply(utils::head(agentes, max_por_rol), fmt, rol = "agente")
  )
}
