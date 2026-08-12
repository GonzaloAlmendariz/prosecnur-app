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
  if (!is.data.frame(data) || !nrow(data)) return(list())

  col <- .semilla_primera_columna(data, .semilla_version_candidatas)
  if (is.na(col)) return(list())

  vals <- .semilla_valores_utiles(data[[col]])
  if (!length(vals)) return(list())

  frec <- sort(table(vals), decreasing = TRUE)
  if (length(frec) < 2L) return(list())          # una sola versión: nada que proponer
  if (.semilla_ya_cubierta(reglas_existentes, "fuera_catalogo", col)) return(list())

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
  n_otras <- sum(as.integer(frec[otras]))

  list(list(
    tipo = "fuera_catalogo",
    variables = list(col),
    params = list(valores = list(vigente)),
    nombre = "Procedencia · la base trae más de una versión del formulario",
    mensaje = sprintf(
      "Recolectado con una versión distinta de la vigente (%s). Sus respuestas siguen las reglas del formulario anterior.",
      vigente
    ),
    severidad = "advertencia",
    activa = TRUE,
    planned_action_type = "ignore_rule",
    semilla = list(
      origen = "procedencia",
      columna = col,
      version_vigente = vigente,
      versiones = as.list(stats::setNames(as.integer(frec), names(frec))),
      n_casos_afectados = n_otras,
      porque = sprintf(
        paste("La base tiene %d versiones del formulario: %d de %d casos no vienen de la vigente.",
              "Sus saltos y catálogos eran otros, así que lo que las reglas del instrumento",
              "reporten sobre ellos puede ser un artefacto de versión y no un error del encuestado."),
        length(frec), n_otras, length(vals)
      )
    )
  ))
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

    n_casos <- sum(.semilla_valores_utiles(data[[var]]) %in% fuera)
    out[[length(out) + 1L]] <- list(
      tipo = "fuera_catalogo",
      variables = list(var),
      params = list(valores = as.list(c(catalogo, .semilla_valores_especiales))),
      nombre = sprintf("Dominio · «%s» admite %s", var, paste(catalogo, collapse = ", ")),
      mensaje = sprintf(
        "Responde con un código que su lista de opciones no contiene (admite %s).",
        paste(catalogo, collapse = ", ")
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
          paste("«%s» observa %s, que no está en su lista '%s' (%s).",
                "Ninguna regla derivada del instrumento verifica que el valor",
                "pertenezca a su catálogo."),
          var, paste(fuera, collapse = ", "), lista, paste(catalogo, collapse = ", ")
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
  props <- c(props, reglas_semilla_agente(data, config, reglas_existentes))
  props <- c(props, reglas_semilla_continuidad(data, reglas_existentes))
  # Todo lo que sale de un sembrador queda marcado: la pestaña necesita
  # distinguirlo de lo que una persona escribió con criterio propio.
  lapply(props, function(p) { p$origen <- "sembrado"; p })
}

# --- Identidad del caso y del agente -----------------------------------------

# Distancia máxima entre dos nombres para considerarlos el mismo agente escrito
# distinto. 2 tolera una letra caída ("JORGE DE SOLAR") o un acento; más alto
# empieza a unir personas distintas con apellidos parecidos.
.semilla_agente_distancia <- 2L

.semilla_norm_agente <- function(x) {
  v <- tolower(trimws(as.character(x)))
  v <- iconv(v, to = "ASCII//TRANSLIT")
  gsub("[^a-z0-9]", "", v %||% "")
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
reglas_semilla_agente <- function(data, config = NULL, reglas_existentes = list()) {
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
    d <- as.integer(adist(norm[i], norm[otros]))
    cerca <- otros[d <= .semilla_agente_distancia |
                   startsWith(norm[otros], norm[i]) |
                   startsWith(norm[i], norm[otros])]
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
    nombre = sprintf("Identidad del agente · «%s» tiene variantes del mismo nombre", col),
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
        paste("«%s» tiene %d valores que parecen variantes de otro agente: %s.",
              "Todo lo que se reporte por agente saldría con filas de más.",
              "Se sugieren; conviene confirmar antes de unificar, porque dos",
              "nombres cercanos pueden ser dos personas."),
        col, length(sospechosos), paste(parecidos, collapse = " · ")
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
