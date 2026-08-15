# =============================================================================
# Monitoreo — calidad del trabajo de campo
# =============================================================================
# Las siete alertas del motor miden avance contra meta: brecha, objetivo,
# cuotas, benchmark, mínimo estadístico. Ninguna mira CÓMO se está recolectando.
#
# El caso que abrió el GOAL: una encuestadora trabajó casi seis horas con una
# versión desactualizada del formulario mientras sus compañeros usaban la
# corregida. Seis encuestas salieron con saltos y catálogos viejos, y nadie se
# enteró hasta Validación — cuando lo único que quedaba era corregir el dato.
#
# `monitoreo_engine.R` está congelado a crecimiento, así que esto vive aparte y
# el motor lo llama. Doc vivo: docs/qa/goal-monitoreo-calidad-campo-2026-08-13.md
#
# Dos límites que este archivo no cruza:
#   - No nombra variables de ningún proyecto. El agente llega del rol declarado
#     en `operational_config$identity$agent_variable`, el mismo que usa
#     Validación — no se inventa uno propio ni se adivina la columna.
#   - No frena el campo. Avisar fuerte es su techo; parar es del coordinador.
# =============================================================================

#' Variable declarada como agente que recolecta
#'
#' Lee el rol de `operational_config`, que el analista declara una sola vez en
#' Validación y sirve para todo el proyecto. Devuelve `""` cuando el estudio no
#' lo declaró: sin esa declaración, ninguna señal de calidad de campo puede
#' existir sin hardcodear un nombre de columna.
#'
#' No confundir con el roster de encuestadores del perfil territorial
#' (`monitoreo_territorial_enumerator_roster_from_excel()`, códigos PXXX): ese
#' dice **quién debería trabajar** y este **quién trabajó**. Son preguntas
#' distintas y ambas se conservan.
#'
#' @param sid sesión.
#' @param base_nombre base del estudio; por defecto la activa.
#' @return nombre de la variable, o `""`.
#' @family monitoreo
#' @export
monitoreo_agente_declarado <- function(sid, base_nombre = NULL) {
  s <- tryCatch(session_get(sid), error = function(e) NULL)
  if (is.null(s)) return("")
  base <- base_nombre %||% tryCatch(codif_source_active(sid), error = function(e) NULL)
  cfg <- NULL
  if (!is.null(base) && nzchar(base)) {
    cfg <- ((s$estudio %||% list())$bases %||% list())[[base]]$validacion$operational_config
  }
  # Legacy sin estudio: la config vive suelta en la sesión.
  cfg <- cfg %||% s$validacion$operational_config %||% NULL
  if (is.null(cfg)) return("")
  cfg <- tryCatch(normalize_validation_operational_config(cfg), error = function(e) NULL)
  if (is.null(cfg)) return("")
  as.character((cfg$identity %||% list())$agent_variable %||% "")[1]
}

# Cuántos casos con una versión no vigente bastan para nombrar a un agente. Uno
# solo puede ser un envío rezagado que ya se corrigió; dos o más indican que
# siguió trabajando sin actualizar.
.MONITOREO_PROCEDENCIA_MINIMO <- 2L

.mcc_chr <- function(x) {
  v <- trimws(as.character(x))
  v[is.na(v)] <- ""
  v
}

#' Alertar qué agentes están enviando con una versión vieja del formulario
#'
#' Es la única señal de este GOAL que produce datos **irrecuperables**: una
#' encuesta hecha con el formulario anterior no se arregla después. Por eso sale
#' con severidad alta y con nombre — el resto de las señales informan.
#'
#' Devuelve una alerta por agente, con la forma que ya usa el motor
#' (`severidad`, `componente_id`, `actor`, `tipo`, `mensaje`) más los datos que
#' la vuelven accionable: cuántos casos, desde cuándo y qué preguntar.
#'
#' @param data data.frame de la base recolectada.
#' @param agent_var variable declarada como agente (ver
#'   `monitoreo_agente_declarado()`). Sin ella no hay alerta: la versión vieja
#'   se sabría, pero no a quién llamar.
#' @param fecha_var columna con la marca temporal del envío, para decir desde
#'   cuándo. Opcional.
#' @param minimo cuántos casos hacen falta para nombrar a un agente.
#' @return lista de alertas; vacía si no hay nada que avisar.
#' @family monitoreo
#' @export
monitoreo_alertas_procedencia <- function(data, agent_var = "",
                                          fecha_var = "",
                                          minimo = .MONITOREO_PROCEDENCIA_MINIMO) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  agent_var <- as.character(agent_var %||% "")[1]
  if (is.na(agent_var) || !nzchar(agent_var) || !(agent_var %in% names(data))) return(list())

  det <- tryCatch(detectar_versiones_formulario(data), error = function(e) NULL)
  if (is.null(det)) return(list())

  ver <- .mcc_chr(data[[det$columna]])
  agente <- .mcc_chr(data[[agent_var]])
  desactualizado <- nzchar(ver) & ver != det$vigente & nzchar(agente)
  if (!any(desactualizado)) return(list())

  fecha_var <- as.character(fecha_var %||% "")[1]
  tiene_fecha <- !is.na(fecha_var) && nzchar(fecha_var) && fecha_var %in% names(data)

  out <- list()
  for (a in unique(agente[desactualizado])) {
    idx <- which(desactualizado & agente == a)
    if (length(idx) < minimo) next
    n_total_agente <- sum(agente == a)
    desde <- if (tiene_fecha) {
      f <- .mcc_chr(data[[fecha_var]][idx])
      f <- f[nzchar(f)]
      if (length(f)) min(f) else ""
    } else ""

    mensaje <- sprintf(
      "%s envió %d de sus %d encuestas con una versión anterior del formulario%s. Sus saltos y catálogos son los de esa versión, y eso no se corrige después: conviene confirmar hoy que ya actualizó.",
      a, length(idx), n_total_agente,
      if (nzchar(desde)) sprintf(", desde %s", substr(desde, 1, 16)) else ""
    )
    out[[length(out) + 1L]] <- list(
      severidad = "bloqueante",
      componente_id = NA_character_,
      actor = a,
      tipo = "formulario_desactualizado",
      mensaje = mensaje,
      # Lo que vuelve accionable la alerta: a quién llamar y qué preguntarle.
      detalle = list(
        agente = a,
        n_casos = length(idx),
        n_casos_agente = as.integer(n_total_agente),
        version_usada = unique(ver[idx]),
        version_vigente = det$vigente,
        desde = desde,
        pregunta = sprintf(
          "¿%s ya actualizó el formulario en su equipo? Si sigue con el anterior, cada encuesta nueva se pierde igual.", a
        )
      )
    )
  }
  # Primero quien más casos arrastra: es a quien hay que llamar antes.
  out[order(-vapply(out, function(x) x$detalle$n_casos, numeric(1)))]
}

# =============================================================================
# M3 · Identidad del agente
# =============================================================================
# El nombre de quien recolecta se escribe a mano en casi todos los estudios.
# Cuando se ensucia, todo lo que se reporte por encuestador sale con filas
# fantasma: un mismo trabajo repartido entre dos filas que parecen dos personas.
# Y no se nota, porque cada fila cuadra consigo misma.
#
# El detector ya existe y está probado en Validación (`reglas_semilla_agente()`).
# Acá NO se reimplementa: se llama y se traduce a alerta. Dos motores para la
# misma pregunta terminan discrepando de la misma base.

#' Alertar que el equipo aparece con más nombres de los que tiene
#'
#' Se **sugiere**, nunca se fusiona solo: dos nombres cercanos pueden ser dos
#' personas, y unificarlas por cuenta propia rompería el reporte en la dirección
#' contraria. Por eso cada aviso es una pregunta cerrada sobre un par concreto.
#'
#' Severidad `advertencia`: a diferencia de la procedencia, esto se corrige
#' después sin perder nada —el dato está, solo está mal atribuido—. Lo que sí es
#' urgente es corregirlo **antes** de que salga un reporte por agente.
#'
#' @param data data.frame de la base recolectada.
#' @param agent_var variable declarada como agente (ver
#'   `monitoreo_agente_declarado()`).
#' @param survey hoja `survey` del instrumento, para nombrar la variable con su
#'   etiqueta y el código entre paréntesis. Opcional.
#' @return lista de alertas, una por variante detectada.
#' @family monitoreo
#' @export
monitoreo_alertas_identidad <- function(data, agent_var = "", survey = NULL) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  agent_var <- as.character(agent_var %||% "")[1]
  if (is.na(agent_var) || !nzchar(agent_var) || !(agent_var %in% names(data))) return(list())

  cfg <- list(identity = list(enabled = TRUE, agent_variable = agent_var))
  props <- tryCatch(reglas_semilla_agente(data, cfg, list(), survey),
                    error = function(e) list())
  if (!length(props)) return(list())

  sem <- props[[1]]$semilla %||% list()
  variantes <- as.character(unlist(sem$variantes %||% list()))
  equipo <- as.character(unlist(sem$equipo %||% list()))
  pares <- as.character(unlist(sem$pares %||% list()))
  if (!length(variantes)) return(list())

  vals <- .mcc_chr(data[[agent_var]])
  out <- list()
  for (i in seq_along(variantes)) {
    v <- variantes[i]
    n <- sum(vals == v)
    par <- if (i <= length(pares)) pares[i] else ""
    # El par ya trae la forma «'X' ~ 'Y'» o «'X' (no parece un nombre)»: son dos
    # preguntas distintas y merecen dos redacciones distintas.
    parecido <- sub("^'[^']*' ~ '([^']*)'$", "\\1", par)
    tiene_par <- nzchar(parecido) && !identical(parecido, par)

    mensaje <- if (tiene_par) sprintf(
      "«%s» aparece en %d encuesta%s y se parece mucho a «%s». Si son la misma persona, el reporte por encuestador la está partiendo en dos filas.",
      v, n, if (n == 1L) "" else "s", parecido
    ) else sprintf(
      "«%s» aparece en %d encuesta%s y no se parece a ningún nombre del equipo. Puede ser un dato de otra cosa escrito en la casilla del encuestador.",
      v, n, if (n == 1L) "" else "s"
    )
    pregunta <- if (tiene_par) sprintf(
      "¿«%s» y «%s» son la misma persona? Si lo son, conviene unificarlos antes de sacar cualquier tabla por encuestador.", v, parecido
    ) else sprintf(
      "¿Quién trabajó en las encuestas que quedaron con «%s» en la casilla del encuestador?", v
    )

    out[[length(out) + 1L]] <- list(
      severidad = "advertencia",
      componente_id = NA_character_,
      actor = v,
      tipo = "identidad_agente",
      mensaje = mensaje,
      detalle = list(
        valor = v,
        n_casos = as.integer(n),
        parecido_a = if (tiene_par) parecido else "",
        equipo = as.list(equipo),
        variable = agent_var,
        pregunta = pregunta
      )
    )
  }
  out[order(-vapply(out, function(x) x$detalle$n_casos, numeric(1)))]
}

# =============================================================================
# M9 · Cruzar planificado con observado
# =============================================================================
# Monitoreo ya tiene dos listas de encuestadores y nunca las miró juntas:
#   - el padrón territorial (`enumerator_roster`, códigos PXXX subidos en Excel)
#     dice QUIÉN DEBERÍA trabajar;
#   - la variable declarada como agente dice QUIÉN TRABAJÓ.
# Cruzarlas responde dos preguntas que hoy no responde nadie: quién está
# enviando datos sin estar en el padrón, y quién está en el padrón sin haber
# enviado nada.
#
# Depende de M3: sin nombres limpios, cada variante mal escrita se leería como
# un encuestador no autorizado. Por eso el cruce mide la cercanía contra el
# padrón y lo dice — un nombre parecido es un tipeo, no un intruso, y la
# pregunta que hay que hacer no es la misma.

.mcc_roster_normalizado <- function(roster) {
  ro <- tryCatch(.monitoreo_territorial_normalize_enumerator_roster(roster %||% list()),
                 error = function(e) NULL)
  if (is.null(ro) || !length(ro$assignments %||% list())) return(NULL)
  ro
}

#' Cruzar el padrón de encuestadores con quién envió datos
#'
#' @param data data.frame de la base recolectada.
#' @param agent_var variable declarada como agente.
#' @param roster padrón territorial (`config$territorial$enumerator_roster`), en
#'   crudo o ya normalizado. Sin padrón cargado no hay cruce posible y devuelve
#'   vacío: la mitad de la pregunta no existe.
#' @return lista de alertas `envio_sin_padron` y `padron_sin_envio`.
#' @family monitoreo
#' @export
monitoreo_alertas_padron <- function(data, agent_var = "", roster = NULL) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  agent_var <- as.character(agent_var %||% "")[1]
  if (is.na(agent_var) || !nzchar(agent_var) || !(agent_var %in% names(data))) return(list())
  ro <- .mcc_roster_normalizado(roster)
  if (is.null(ro)) return(list())

  padron_nombre <- vapply(ro$assignments, function(a) as.character(a$nombre %||% ""), character(1))
  padron_key <- vapply(ro$assignments, function(a) as.character(a$nombre_normalizado %||% ""), character(1))
  padron_code <- vapply(ro$assignments, function(a) as.character(a$codigo_pulso %||% ""), character(1))
  padron_norm <- .semilla_norm_agente(padron_nombre)

  vals <- .mcc_chr(data[[agent_var]])
  observados <- unique(vals[nzchar(vals)])
  if (!length(observados)) return(list())

  obs_key <- vapply(observados, .monitoreo_territorial_enumerator_key, character(1),
                    USE.NAMES = FALSE)
  # La columna del agente puede traer el nombre o el código: en territorial el
  # mismo campo se usa de las dos formas según el estudio.
  obs_code <- .monitoreo_territorial_clean_code(observados, ro$code_format)
  obs_code[!.monitoreo_territorial_valid_code(obs_code, ro$code_format)] <- ""
  obs_norm <- .semilla_norm_agente(observados)

  reconocido <- (obs_key %in% padron_key[nzchar(padron_key)]) |
    (nzchar(obs_code) & obs_code %in% padron_code[nzchar(padron_code)])

  out <- list()

  # --- Envió sin estar en el padrón ------------------------------------------
  for (i in which(!reconocido)) {
    n <- sum(vals == observados[i])
    cerca <- .semilla_nombres_cercanos(obs_norm[i], padron_norm)
    parecido <- if (length(cerca)) padron_nombre[cerca[1]] else ""

    mensaje <- if (nzchar(parecido)) sprintf(
      "«%s» envió %d encuesta%s y no está en el padrón, pero se parece a «%s», que sí está. Lo más probable es que sea el mismo nombre escrito distinto.",
      observados[i], n, if (n == 1L) "" else "s", parecido
    ) else sprintf(
      "«%s» envió %d encuesta%s y no figura en el padrón de encuestadores del estudio.",
      observados[i], n, if (n == 1L) "" else "s"
    )
    pregunta <- if (nzchar(parecido)) sprintf(
      "¿«%s» es «%s»? Si lo es, se corrige en la data; si no, hay alguien recolectando fuera del padrón.",
      observados[i], parecido
    ) else sprintf(
      "¿Quién es «%s» y por qué está enviando encuestas de este estudio?", observados[i]
    )

    out[[length(out) + 1L]] <- list(
      severidad = "advertencia",
      componente_id = NA_character_,
      actor = observados[i],
      tipo = "envio_sin_padron",
      mensaje = mensaje,
      detalle = list(
        valor = observados[i], n_casos = as.integer(n),
        parecido_a = parecido,
        # Lo que separa un tipeo de un intruso, y por eso viaja explícito: quien
        # lee la alerta necesita saber cuál de las dos preguntas está haciendo.
        probable_variante = nzchar(parecido),
        pregunta = pregunta
      )
    )
  }

  # --- En el padrón y sin enviar nada ----------------------------------------
  for (j in seq_along(padron_nombre)) {
    if (nzchar(padron_key[j]) && padron_key[j] %in% obs_key) next
    if (nzchar(padron_code[j]) && padron_code[j] %in% obs_code) next
    # No se avisa de quien igual llegó con el nombre mal escrito: ese caso ya lo
    # cubre el aviso de arriba, y duplicarlo lo haría parecer dos problemas.
    if (length(.semilla_nombres_cercanos(padron_norm[j], obs_norm[!reconocido]))) next

    out[[length(out) + 1L]] <- list(
      severidad = "advertencia",
      componente_id = NA_character_,
      actor = padron_nombre[j],
      tipo = "padron_sin_envio",
      mensaje = sprintf(
        "%s está en el padrón y no ha enviado ninguna encuesta todavía.",
        padron_nombre[j]
      ),
      detalle = list(
        valor = padron_nombre[j], n_casos = 0L,
        codigo = padron_code[j],
        pregunta = sprintf(
          "¿%s arrancó? Si tuvo un problema con el equipo o el formulario, hoy todavía se puede recuperar el día.",
          padron_nombre[j]
        )
      )
    )
  }
  out
}

# =============================================================================
# M4 · Casos que se pisan
# =============================================================================
# Dos encuestas que comparten identidad Y corren a la vez. Ninguna de las dos
# señales vale sola, y eso está medido: en MDV hay 24 pares solapados y 1 llave
# repetida, y solo **1 caso** cumple las dos. El solape solo mide una propiedad
# de `end` —que se corre si el formulario queda abierto, hay entrevistas de
# 44 h— y una llave repetida puede ser legítima (dos personas del mismo hogar).
#
# Mismo criterio que el tipo `cruce_identidad` de Validación, y un test lo
# comprueba fila por fila contra el motor de reglas. Lo que Monitoreo agrega no
# es otro criterio sino otro grano: la regla marca **casos**, y para llamar a
# campo hace falta el **par** — quién lo hizo y cuánto se pisan.

# Mismo parseo que `.regla_expr_cruce_identidad()`: ISO-8601 con el offset
# recortado. Si divergiera, los dos motores marcarían casos distintos.
.mcc_a_tiempo <- function(x) {
  suppressWarnings(as.POSIXct(
    sub("([+-][0-9]{2}):([0-9]{2})$", "", as.character(x)),
    format = "%Y-%m-%dT%H:%M:%OS", tz = "UTC"
  ))
}

# Cómo se nombra una encuesta en la prosa de un aviso. El `_uuid` es el
# identificador honesto —el código de caso del estudio no tiene rol declarado y
# nombrarlo sería hardcodear—, pero un UUID entero en una frase es ilegible y
# nadie lo va a dictar por teléfono. El prefijo basta para encontrarlo y el
# completo viaja en `detalle$casos`, que es lo que consume la UI.
.mcc_nombrar_caso <- function(x) {
  v <- .mcc_chr(x)
  uuid <- grepl("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-", v)
  v[uuid] <- substr(v[uuid], 1, 8)
  v
}

.mcc_dur <- function(minutos) {
  m <- round(as.numeric(minutos))
  if (!is.finite(m) || m < 1) return("menos de un minuto")
  h <- m %/% 60L
  if (h < 1L) return(sprintf("%d min", m))
  if (m %% 60L == 0L) return(sprintf("%d h", h))
  sprintf("%d h %d min", h, m %% 60L)
}

#' Alertar sobre encuestas que comparten identidad y corrieron a la vez
#'
#' Devuelve un aviso **por par**, no por caso: la pregunta que hay que hacerle a
#' campo es sobre las dos encuestas juntas.
#'
#' Sobre el tiempo (V4 de la vara): el solape se mide con las columnas que
#' recibe y las declara en `detalle$fuente_tiempo`. Si el fin es el `end` de la
#' plataforma, hereda que se corre cuando el formulario queda abierto — por eso
#' el criterio exige además identidad compartida, que es lo que en MDV lleva de
#' 24 pares a 1.
#'
#' @param data data.frame de la base recolectada.
#' @param llaves variables que identifican al sujeto
#'   (`operational_config$identity$variables`). Sin llaves no hay cruce.
#' @param ini_var,fin_var columnas de inicio y fin.
#' @param agent_var variable del agente. El mismo agente en las dos encuestas es
#'   lo que vuelve el par imposible; agentes distintos puede ser legítimo.
#' @param caso_var columna con la que nombrar cada encuesta.
#' @return lista de alertas, una por par.
#' @family monitoreo
#' @export
monitoreo_alertas_cruce <- function(data, llaves = character(0),
                                    ini_var = "", fin_var = "",
                                    agent_var = "", caso_var = "") {
  if (!is.data.frame(data) || nrow(data) < 2L) return(list())
  llaves <- as.character(unlist(llaves %||% character(0)))
  llaves <- llaves[nzchar(llaves) & llaves %in% names(data)]
  ini_var <- as.character(ini_var %||% "")[1]
  fin_var <- as.character(fin_var %||% "")[1]
  if (!length(llaves)) return(list())
  if (is.na(ini_var) || is.na(fin_var) ||
      !(ini_var %in% names(data)) || !(fin_var %in% names(data))) return(list())

  clave <- do.call(paste, c(lapply(llaves, function(v) .mcc_chr(data[[v]])),
                            list(sep = "␟")))
  # Una llave vacía no identifica a nadie: emparejaría a todos los casos sin
  # dato entre sí.
  vacia <- vapply(strsplit(clave, "␟", fixed = TRUE),
                  function(p) !any(nzchar(p)), logical(1))
  ini <- .mcc_a_tiempo(data[[ini_var]])
  fin <- .mcc_a_tiempo(data[[fin_var]])
  utilizable <- !vacia & !is.na(ini) & !is.na(fin)
  if (sum(utilizable) < 2L) return(list())

  agente <- if (nzchar(agent_var %||% "") && agent_var %in% names(data)) {
    .mcc_chr(data[[agent_var]])
  } else rep("", nrow(data))
  caso <- if (nzchar(caso_var %||% "") && caso_var %in% names(data)) {
    .mcc_chr(data[[caso_var]])
  } else as.character(seq_len(nrow(data)))

  out <- list()
  for (idx in split(which(utilizable), clave[utilizable])) {
    if (length(idx) < 2L) next
    for (a in seq_len(length(idx) - 1L)) for (b in seq(a + 1L, length(idx))) {
      i <- idx[a]; j <- idx[b]
      if (!(ini[i] < fin[j] && fin[i] > ini[j])) next
      minutos <- as.numeric(difftime(min(fin[i], fin[j]), max(ini[i], ini[j]),
                                     units = "mins"))
      mismo <- nzchar(agente[i]) && identical(agente[i], agente[j])

      corto <- .mcc_nombrar_caso(c(caso[i], caso[j]))
      mensaje <- if (mismo) sprintf(
        "%s y %s son de la misma persona encuestada y corrieron a la vez, solapadas %s. Las dos las hizo %s, que no pudo estar en las dos.",
        corto[1], corto[2], .mcc_dur(minutos), agente[i]
      ) else sprintf(
        "%s y %s son de la misma persona encuestada y corrieron a la vez, solapadas %s.",
        corto[1], corto[2], .mcc_dur(minutos)
      )
      pregunta <- if (mismo) sprintf(
        "¿Por qué %s tiene dos encuestas de la misma persona corriendo en paralelo? Puede ser un formulario que quedó abierto, o una encuesta que se rehízo sin cerrar la anterior.",
        agente[i]
      ) else paste(
        "¿Por qué dos encuestadores distintos levantaron a la misma persona a la",
        "misma hora? Si es la misma entrevista cargada dos veces, hay que quedarse con una."
      )

      out[[length(out) + 1L]] <- list(
        severidad = "advertencia",
        componente_id = NA_character_,
        actor = if (mismo) agente[i] else "",
        tipo = "cruce_identidad",
        mensaje = mensaje,
        detalle = list(
          casos = c(caso[i], caso[j]),
          minutos_solape = round(minutos),
          mismo_agente = mismo,
          agentes = unique(c(agente[i], agente[j])),
          llaves = as.list(llaves),
          # V4: toda métrica de tiempo declara de dónde sale. Si el fin es el
          # `end` de la plataforma, el solape hereda que se corre con el
          # formulario abierto — por eso el criterio exige también identidad.
          fuente_tiempo = c(inicio = ini_var, fin = fin_var),
          pregunta = pregunta
        )
      )
    }
  }
  # El par que más se pisa primero, y dentro de eso el del mismo agente: es el
  # que no admite explicación inocente.
  if (!length(out)) return(out)
  out[order(-vapply(out, function(x) isTRUE(x$detalle$mismo_agente), logical(1)),
            -vapply(out, function(x) x$detalle$minutos_solape, numeric(1)))]
}

#' Todas las señales sobre quién está recolectando
#'
#' M3 y M9 miran el mismo valor sucio desde dos lados y, con padrón cargado,
#' dirían lo mismo dos veces: que «X» se parece a «Y». Acá se resuelve una sola
#' vez, con la regla evidente — **el padrón manda**. Cuando existe, es la lista
#' autoritativa del equipo y la cercanía se mide contra ella; el aviso de
#' identidad solo cubre los valores que el cruce no nombró. Sin padrón, que es el
#' caso de la mayoría de los estudios, el aviso de identidad trabaja solo.
#'
#' @param data data.frame de la base recolectada.
#' @param agent_var variable declarada como agente.
#' @param roster padrón territorial, si el estudio lo tiene.
#' @param survey hoja `survey` del instrumento. Opcional.
#' @return lista de alertas, sin repetir un mismo valor en dos avisos.
#' @family monitoreo
#' @export
monitoreo_alertas_equipo <- function(data, agent_var = "", roster = NULL, survey = NULL) {
  padron <- monitoreo_alertas_padron(data, agent_var, roster)
  identidad <- monitoreo_alertas_identidad(data, agent_var, survey)
  if (!length(padron)) return(identidad)
  ya <- vapply(padron, function(a) as.character(a$actor %||% ""), character(1))
  c(padron, Filter(function(a) !(as.character(a$actor %||% "") %in% ya), identidad))
}

# =============================================================================
# M6 · Las alertas de calidad conviven con las de avance
# =============================================================================
# Las siete alertas del módulo responden «cuánto falta»; estas responden «cómo
# se está trabajando». Mezclarlas en una lista haría que una brecha de cuota y
# un formulario desactualizado se lean igual, y la que se puede arreglar hoy se
# perdería entre las que se arreglan al cierre.
#
# Van en un bloque propio del payload (`calidad_campo`), no dentro de
# `dashboard$alertas`. Y el bloque viaja SIEMPRE, aunque esté vacío: la razón
# por la que no hay avisos es información —«no declaraste quién recolecta» no es
# lo mismo que «el campo está limpio»— y sin ella la pantalla no puede contener
# su propio vacío.

# Columnas que pone la plataforma, no el estudio. Mismo estatus que `_uuid` o
# `__version__`: nombrarlas no es hardcodear un proyecto.
.MCC_INICIO_CANDIDATAS <- c("start", "_start", "starttime")
.MCC_FIN_CANDIDATAS <- c("end", "_end", "endtime")
.MCC_CASO_CANDIDATAS <- c("_uuid", "uuid", "_id")

.mcc_primera <- function(data, candidatas) {
  for (nm in candidatas) if (nm %in% names(data)) return(nm)
  ""
}

#' Bloque de calidad de campo para el payload de Monitoreo
#'
#' Reúne las cuatro señales del GOAL y explica su propio vacío. `motivo` dice
#' por qué no hay avisos cuando no los hay, que es lo que separa «el campo está
#' limpio» de «falta declarar un rol».
#'
#' @param data data.frame de la base recolectada.
#' @param operational_config config operacional de la base (roles declarados).
#' @param roster padrón territorial, si el estudio lo tiene.
#' @param survey hoja `survey` del instrumento. Opcional.
#' @return lista con `enabled`, `alertas`, `resumen`, `roles` y `motivo`.
#' @family monitoreo
#' @export
monitoreo_calidad_campo_bloque <- function(data, operational_config = NULL,
                                           roster = NULL, survey = NULL) {
  vacio <- function(motivo, agente = "", llaves = character(0)) {
    list(
      enabled = FALSE, alertas = list(),
      resumen = list(total = 0L, bloqueantes = 0L, por_tipo = list()),
      roles = list(agente = agente, llaves = as.list(llaves)),
      motivo = motivo
    )
  }
  if (!is.data.frame(data) || !nrow(data)) {
    return(vacio("sin_datos"))
  }
  cfg <- tryCatch(normalize_validation_operational_config(operational_config %||% list()),
                  error = function(e) NULL)
  ident <- (cfg %||% list())$identity %||% list()
  agente <- as.character(ident$agent_variable %||% "")[1]
  if (is.na(agente)) agente <- ""
  llaves <- as.character(unlist(ident$variables %||% character(0)))
  llaves <- llaves[nzchar(llaves) & llaves %in% names(data)]

  # Sin agente declarado no hay ninguna señal posible sin hardcodear una
  # columna, y el cruce solo diría «hay dos casos» sin decir a quién llamar.
  if (!nzchar(agente) || !(agente %in% names(data))) {
    return(vacio("sin_rol_de_agente", agente, llaves))
  }

  fecha <- .mcc_primera(data, .semilla_envio_candidatas)
  ini <- .mcc_primera(data, .MCC_INICIO_CANDIDATAS)
  fin <- .mcc_primera(data, .MCC_FIN_CANDIDATAS)
  caso <- .mcc_primera(data, .MCC_CASO_CANDIDATAS)

  abiertas <- (cfg %||% list())$abiertas %||% list()
  alertas <- c(
    monitoreo_alertas_procedencia(data, agente, fecha),
    monitoreo_alertas_equipo(data, agente, roster, survey),
    monitoreo_alertas_cruce(data, llaves, ini, fin, agente, caso),
    monitoreo_alertas_abiertas(
      data, survey, agente, caso,
      declaradas = if (isTRUE(abiertas$enabled)) abiertas$variables else character(0)
    )
  )
  # Lo bloqueante arriba: es lo único que produce datos irrecuperables y lo
  # único que hay que resolver hoy.
  if (length(alertas)) {
    alertas <- alertas[order(vapply(
      alertas, function(a) !identical(a$severidad, "bloqueante"), logical(1)
    ))]
  }
  tipos <- vapply(alertas, function(a) as.character(a$tipo %||% ""), character(1))

  out <- list(
    enabled = TRUE,
    alertas = alertas,
    resumen = list(
      total = length(alertas),
      bloqueantes = as.integer(sum(vapply(
        alertas, function(a) identical(a$severidad, "bloqueante"), logical(1)
      ))),
      por_tipo = as.list(table(tipos))
    ),
    roles = list(agente = agente, llaves = as.list(llaves)),
    motivo = if (length(alertas)) "" else if (!length(llaves)) {
      # Con agente pero sin llaves de identidad, el cruce de M4 no puede correr:
      # decirlo evita leer el silencio como campo limpio.
      "sin_llaves_de_identidad"
    } else "sin_hallazgos"
  )
  out
}

#' Bloque de calidad de campo resuelto desde la sesión
#'
#' El envoltorio que consume el router: resuelve los roles declarados en
#' Validación y el padrón de la config de Monitoreo, y nunca deja caer el
#' payload por un fallo suyo — una señal nueva no puede tumbar el módulo.
#'
#' @param sid sesión.
#' @param data data.frame ya derivado por el payload de Monitoreo.
#' @param cfg config de Monitoreo normalizada.
#' @param base_nombre base del estudio; por defecto la activa.
#' @return el bloque de `monitoreo_calidad_campo_bloque()`.
#' @family monitoreo
#' @export
monitoreo_calidad_campo_para_sesion <- function(sid, data, cfg = list(), base_nombre = NULL) {
  tryCatch({
    s <- session_get(sid)
    base <- base_nombre %||% tryCatch(codif_source_active(sid), error = function(e) NULL)
    oc <- NULL
    if (!is.null(base) && nzchar(base)) {
      oc <- ((s$estudio %||% list())$bases %||% list())[[base]]$validacion$operational_config
    }
    oc <- oc %||% s$validacion$operational_config %||% list()
    # El instrumento es lo que distingue una pregunta abierta de contenido de un
    # campo de captura operativa. Si no está cargado, las abiertas simplemente
    # no se vigilan; el resto de las señales no lo necesita.
    inst <- NULL
    if (!is.null(base) && nzchar(base)) inst <- (s$rp_inst_sources %||% list())[[base]]
    inst <- inst %||% s$rp_inst %||% NULL
    monitoreo_calidad_campo_bloque(
      data,
      operational_config = oc,
      roster = (cfg$territorial %||% list())$enumerator_roster %||% NULL,
      survey = inst$survey %||% NULL
    )
  }, error = function(e) list(
    enabled = FALSE, alertas = list(),
    resumen = list(total = 0L, bloqueantes = 0L, por_tipo = list()),
    roles = list(agente = "", llaves = list()),
    motivo = "sin_datos"
  ))
}
