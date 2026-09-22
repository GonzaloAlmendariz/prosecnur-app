# monitoreo_aulas_cruce_por_carrera.R — cómo va el cruce de alumnos, por carrera.
#
# El eje de este estudio se resuelve por PERSONA: el código PUCP que declara el
# alumno, cruzado contra el padrón. De ese cruce depende todo el avance, y hasta
# aquí sólo se publicaba su total —«1 sin nivel»— sin decir de quiénes ni de
# dónde. `monitoreo_aulas_nivel_diagnostico()` calculaba el detalle por motivo y
# **no lo leía nadie**: vivía en un atributo que el payload no llevaba.
#
# Gonzalo, 2026-09-22: «en validación tiene que estar el cruce por alumnos por
# código PUCP, de la misma forma que en acreditación tenemos la lista de actores
# y su estatus, pero no por actores —porque todos son estudiantes— sino por la
# carrera a la que pertenecen».
#
# **La carrera sale del PADRÓN, no del curso-horario.** Un curso-horario de
# Economía tiene alumnos de varias carreras; usar la suya diría de qué aula
# salió la respuesta, no a quién se está alcanzando. Es la misma distinción que
# movió el eje a la persona, y por eso una respuesta que NO cruza no puede
# tener carrera: no se le imputa la del aula, va a su propia fila con el motivo.
#
# Esa fila es el punto del panel. Las que cruzan ya están contadas en el avance;
# lo que hay que mirar es lo que no cruzó y por qué, porque cada motivo se
# arregla en un sitio distinto:
#
#   · `sin_codigo_declarado` — la respuesta no trae código. El alumno lo dejó en
#     blanco, o el estudio declaró la columna equivocada.
#   · `codigo_ilegible` — trae algo que no es un código de ocho dígitos.
#   · `codigo_no_en_padron` — el código está bien formado y no está en el
#     padrón: o es de otra facultad, o el padrón es de otra extracción.

MONITOREO_AULAS_CRUCE_CARRERA_SCHEMA <- "monitoreo_aulas_cruce_por_carrera_v1"

# El motivo ya resuelto de una fila, con respaldo al crudo cuando el llamador no
# lo pasa (su firma es pública y alguien puede llamarla sin consentimiento).
.macc_mot <- function(motivo_fila, sub, i) {
  if (length(motivo_fila) >= i) return(as.character(motivo_fila[i]))
  as.character(sub$motivo[i] %||% "")
}

# El detalle: una fila por respuesta considerada, la más reciente primero —que
# es el orden con el que se comprueba algo que acaba de pasar—. Con tope
# declarado: una tabla de miles de filas no se lee, y recortarla en silencio
# haría creer que el operativo tiene las que se ven.
.macc_detalle <- function(sub, cuenta, res, dup, responses, aulas, mask, tope,
                          consiente = NULL, motivo_fila = NULL) {
  n <- nrow(sub)
  if (!n) return(list(filas = list(), truncado = FALSE))
  marca <- rep("", n)
  if (is.data.frame(responses) && nrow(responses) == length(mask)) {
    col <- .monitoreo_aulas_col(responses, MONITOREO_AULAS_COLUMNAS_TIEMPO)
    if (nzchar(col)) marca <- as.character(responses[[col]])[mask]
  }
  aula <- rep("", n)
  if (length(aulas) == length(mask)) aula <- as.character(aulas)[mask]
  aula[is.na(aula)] <- ""
  fecha <- monitoreo_aulas_fecha_local(marca)
  hora <- monitoreo_aulas_hora_local(marca)
  orden <- order(fecha, hora, decreasing = TRUE, method = "radix")
  truncado <- n > tope
  orden <- utils::head(orden, tope)
  filas <- lapply(orden, function(i) list(
    codigo = as.character(sub$codigo[i] %||% ""),
    carrera = as.character(sub$carrera[i] %||% ""),
    nivel = {
      v <- suppressWarnings(as.integer(sub$nivel[i]))
      if (is.finite(v)) as.character(v) else ""
    },
    sexo = as.character(sub$sexo[i] %||% ""),
    fecha = fecha[i],
    hora = hora[i],
    curso_horario = aula[i],
    # Tres estados y no dos: una repetida CRUZÓ —su persona existe— y no
    # cuenta, que es distinto de no haberse podido identificar. Meterlas en la
    # misma bolsa mandaría a revisar el código de quien lo escribió bien.
    estado = if (cuenta[i]) "identificado" else if (res[i] && dup[i]) "repetida" else "sin_identificar",
    # **El estado de la RESPUESTA, aparte del estado del cruce.** Son dos
    # preguntas —qué pasó con la encuesta, y si se pudo atar a alguien— y
    # acreditación las publica en dos columnas por eso mismo. Vacío cuando el
    # estudio no tiene columna de consentimiento: no se supone que aceptaron.
    respuesta = if (length(consiente) >= i) as.character(consiente[i]) else "",
    motivo = if (!res[i]) .macc_mot(motivo_fila, sub, i) else "",
    motivo_etiqueta = if (!res[i]) {
      m <- .macc_mot(motivo_fila, sub, i)
      unname(.macc_motivo_etiqueta[[m]] %||% m)
    } else ""
  ))
  list(filas = filas, truncado = truncado)
}

.macc_motivo_etiqueta <- c(
  # **El rechazo va PRIMERO y es un motivo aparte.** Quien no consiente no llega
  # a la pregunta del código, así que meterlo en «no declararon su código» manda
  # a revisar el formulario cuando no hay nada que revisar. Gonzalo lo señaló
  # sobre CH 18 el 2026-09-22, comparando con acreditación, que publica el
  # estado de la RESPUESTA aparte del estado del CRUCE.
  rechazo_participar = "Rechazó participar",
  sin_codigo_declarado = "No declararon su código",
  codigo_ilegible = "El código no es legible",
  codigo_no_en_padron = "Su código no está en el padrón"
)

# El orden en que se publican los motivos: el del catálogo, que es el de
# gravedad operativa —lo que no se arregla primero, lo que sí después—.
.MACC_MOTIVOS <- names(.macc_motivo_etiqueta)

#' El cruce de alumnos contra el padrón, repartido por carrera.
#'
#' @param resueltas salida de [monitoreo_aulas_nivel_por_respuesta()].
#' @param elegible vector lógico opcional: qué respuestas pasaron el paso del
#'   AULA. Sólo ésas se consideran, igual que en el resto del bloque.
#' @param cfg config de aulas, para saber si el estudio pide código. Un estudio
#'   ANÓNIMO no tiene este cruce y la superficie no debe existir en él.
#' @param responses las respuestas, para fechar cada fila. Sin ellas el detalle
#'   sale sin fecha ni hora, no se omite.
#' @param aulas etiqueta del curso-horario al que se atribuyó cada respuesta,
#'   una por fila de `resueltas`.
#' @param tope cuántas filas de detalle se publican como máximo.
#' @param consentimiento salida de [monitoreo_aulas_consentimiento()], una
#'   entrada por respuesta. Con ella, quien rechazó participar deja de salir
#'   como «no declaró su código».
#' @param poblacion conteos por carrera del padrón
#'   ([monitoreo_aulas_padron_resumen()]`$por_carrera`), para que cada fila diga
#'   cuántos son en total. Sin ellos la fila publica su conteo y nada más.
#' @return lista `{schema, total, carreras, sin_cruce}`.
#' @export
monitoreo_aulas_cruce_por_carrera <- function(resueltas, elegible = NULL,
                                              poblacion = list(), cfg = list(),
                                              responses = NULL, aulas = NULL,
                                              tope = 500L, consentimiento = NULL) {
  # **Un estudio anónimo no tiene este cruce, y su superficie no debe existir.**
  #
  # Gonzalo, 2026-09-22: «esta pestaña sólo está disponible si la encuesta, en
  # vez de ser anónima, es confidencial. No todos los estudios lo son: las
  # confidenciales piden un código identificador, las anónimas no».
  #
  # Lo que separa una de otra es **si el instrumento pide el código**, y eso en
  # la config es `student_code_var`. Se mira el mecanismo y no el rótulo
  # `anonymous_responses` porque el rótulo puede estar sin actualizar —lo está
  # en CCSS Perfil 2026-II, que pide `cod_pucp` y aún se declara anónimo— y
  # ocultar el panel por una etiqueta vieja escondería el cruce del que depende
  # todo su avance. Cuando los dos no coinciden se dice; no se elige en silencio.
  declarada <- .monitoreo_scalar(
    ((cfg %||% list())[["source_mapping"]] %||% list())[["student_code_var"]] %||% "", "")
  anonimo <- isTRUE((cfg %||% list())[["anonymous_responses"]])
  aplica <- nzchar(declarada)
  vacio <- list(
    schema = MONITOREO_AULAS_CRUCE_CARRERA_SCHEMA,
    aplica = aplica,
    motivo = if (aplica) "" else paste0(
      "Este estudio no pide un código identificador: sus respuestas son anónimas ",
      "y no hay a quién cruzar. Se declara en Fuentes."),
    aviso_anonimato = if (aplica && anonimo) paste0(
      "El estudio pide el código en «", declarada, "» y a la vez se declara de ",
      "respuestas anónimas. Son dos cosas que no pueden ser ciertas a la vez: ",
      "revisa la declaración en Fuentes.") else "",
    total = list(consideradas = 0L, personas = 0L, duplicadas = 0L,
                 sin_cruce = 0L, tasa = NA_real_),
    carreras = list(), sin_cruce = list(),
    alumnos = list(), tope = as.integer(tope), truncado = FALSE
  )
  if (!aplica) return(vacio)
  if (!is.data.frame(resueltas) || !nrow(resueltas)) return(vacio)
  n <- nrow(resueltas)
  mask <- if (is.logical(elegible) && length(elegible) == n) elegible %in% TRUE else rep(TRUE, n)
  sub <- resueltas[mask, , drop = FALSE]
  if (!nrow(sub)) return(vacio)

  consiente <- rep("", length(mask))
  if (length(consentimiento) == length(mask)) consiente <- as.character(consentimiento)
  consiente <- consiente[mask]

  dup <- monitoreo_aulas_nivel_duplicado(sub)
  res <- sub$resuelto %in% TRUE
  # Personas, no respuestas: la segunda respuesta de alguien no es alguien más.
  # Se marca y se cuenta aparte, nunca se borra (ADR 0088).
  cuenta <- res & !dup

  carrera <- as.character(sub$carrera)
  carrera[is.na(carrera)] <- ""
  # La etiqueta de una carrera que cruzó pero no trae nombre: el padrón la
  # conoce por su código y no por su carrera. Es raro y se declara, no se
  # esconde entre las demás.
  carrera[cuenta & !nzchar(carrera)] <- "Sin carrera en el padrón"

  nombres <- sort(unique(carrera[cuenta & nzchar(carrera)]))
  pobl <- if (is.list(poblacion)) poblacion else list()
  carreras <- lapply(nombres, function(cc) {
    de_esta <- cuenta & carrera == cc
    list(
      carrera = cc,
      carrera_key = .cm_criterios_fac_key(cc),
      personas = as.integer(sum(de_esta)),
      # Las repeticiones de gente de esta carrera: se ven donde se produjeron.
      duplicadas = as.integer(sum(res & dup & carrera == cc)),
      poblacion = {
        p <- suppressWarnings(as.integer(pobl[[cc]] %||% NA_integer_))[1]
        if (is.finite(p)) p else NA_integer_
      }
    )
  })

  # **El rechazo sustituye al motivo del código, que es su consecuencia.** No se
  # publican los dos: la respuesta no trae código PORQUE la persona no aceptar,
  # y contarla en las dos bolsas haría que los motivos sumaran más que las
  # respuestas sin cruzar.
  motivo_fila <- as.character(sub$motivo)
  motivo_fila[!res & consiente == "rechaza"] <- "rechazo_participar"
  motivos <- motivo_fila[!res]
  motivos <- motivos[nzchar(motivos)]
  sin_cruce <- if (length(motivos)) {
    t <- table(factor(motivos, levels = .MACC_MOTIVOS))
    vivos <- names(t)[as.integer(t) > 0L]
    lapply(vivos, function(m) list(
      motivo = m,
      # La frase con la que se lee, declarada aquí y no derivada: cada motivo
      # se arregla en un sitio distinto y su nombre tiene que decir cuál.
      etiqueta = unname(.macc_motivo_etiqueta[[m]] %||% m),
      respuestas = as.integer(t[[m]])
    ))
  } else {
    list()
  }

  detalle <- .macc_detalle(sub, cuenta, res, dup, responses, aulas, mask, tope,
                           consiente, motivo_fila)

  list(
    schema = MONITOREO_AULAS_CRUCE_CARRERA_SCHEMA,
    aplica = TRUE,
    motivo = "",
    aviso_anonimato = vacio$aviso_anonimato,
    # **Fila por alumno, no sólo el conteo.** Gonzalo, 2026-09-22, comparando
    # con acreditación: «esto debe ser más específico ¿has revisado cómo lo hace
    # acreditación? Es bastante específico con hora y todo». Su tabla de casos de
    # plataforma publica actor/caso, estado, FECHA Y HORA, canal y cruce, una
    # fila por caso; el agregado por carrera contesta «cuántos» y no «quién,
    # cuándo y desde qué curso-horario», que es con lo que se va a comprobar
    # una respuesta concreta.
    alumnos = detalle$filas,
    tope = as.integer(tope),
    truncado = detalle$truncado,
    total = list(
      consideradas = as.integer(nrow(sub)),
      personas = as.integer(sum(cuenta)),
      duplicadas = as.integer(sum(res & dup)),
      sin_cruce = as.integer(sum(!res)),
      tasa = round(sum(res) / nrow(sub), 4)
    ),
    carreras = carreras,
    sin_cruce = sin_cruce
  )
}
