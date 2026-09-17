# **A qué celda va cada respuesta, en el orden que importa.**
#
# El ADR 0079 fijó que «la atribución es por aula del plan y no por
# auto-reporte», y con el eje en facultad eso bastaba: el aula tiene facultad, y
# la respuesta hereda la del aula donde se recogió. Con el eje en NIVEL
# CURRICULAR el aula no lo sabe —un aula de nivel 7 tiene alumnos de 6, 7 y 8, y
# el marco colapsó el nivel a la MODA del aula para dimensionar— así que el valor
# del eje sale de la PERSONA: su código declarado cruzado contra el padrón.
#
# Eso mueve el numerador, y por eso el orden es NORMATIVO y está probado:
#
#   1. **Exclusiones del AULA.** Íntegras y primero. `fuera_universo` (el aula no
#      existía o era virtual) y `huerfanas` (válida que no casa con ninguna fila
#      del plan) conservan exactamente el significado que tenían: son del aula,
#      no del eje, y no cambian con él. Es la cláusula que hace que el ADR 0088
#      no contradiga al 0079 sino que lo aplique.
#   2. **Asignación por persona.** Sólo sobre lo que sobrevivió al paso 1. Una
#      respuesta sin valor de eje NO se imputa: va a la bolsa declarada.
#   3. **Deduplicación.** Al final. Invertirlo con el paso 2 haría que una
#      huérfana con código resoluble consumiera la primera aparición de su
#      persona, y la buena se publicaría como repetida.
#
# **Por qué deduplicar ahora si antes no.** El ADR 0079 asumió el doble conteo
# por traslape (~1,55 aulas por alumno) como despreciable, y con razón: «las
# respuestas son anónimas y no se pueden deduplicar entre aulas distintas». El
# padrón quita la premisa, y además cambia la naturaleza del efecto. Con eje
# facultad dos respuestas de la misma persona caen en dos aulas —quizá de
# facultades distintas— y se diluyen; con eje nivel caen en la MISMA celda,
# porque la persona tiene un solo nivel. Una cuota de personas contaría a la
# misma persona dos veces: exactamente el fallo que la cuota existe para
# impedir. Se marca, no se borra, y el conteo se publica.
#
# **El eje facultad pasa por aquí sin cambiar de resultado.** Su `atribucion` es
# `"aula"`, así que el paso 2 lee el valor de la fila del plan —lo que el código
# hacía ya— y el paso 3 no se ejecuta. Su prueba es de IDENTIDAD.

MONITOREO_AULAS_EJE_ATRIBUCION_SCHEMA <- "monitoreo_aulas_eje_atribucion_v1"

# La clave de agrupación de un valor del eje. La vacía colapsa a un centinela
# porque `""` no es indexable por nombre en las tablas de R y las respuestas de
# un aula sin valor desaparecerían del bloque en silencio; es el mismo motivo y
# el mismo centinela que `.maac_fac_key()`, generalizado al eje.
.maea_clave <- function(x, eje) {
  k <- monitoreo_aulas_eje_key(x)
  k[!nzchar(k)] <- .maea_centinela(eje)
  k
}

.maea_centinela <- function(eje) {
  clave <- .monitoreo_scalar((eje %||% list())[["clave"]], "facultad")
  paste0("sin_", clave)
}

#' A qué celda del eje va cada respuesta.
#'
#' @param atr salida de `.maac_atribucion()`: el paso del AULA, ya hecho.
#' @param plan_df el plan normalizado como `data.frame`.
#' @param responses `data.frame` de respuestas (para el eje por persona).
#' @param cfg config de aulas universitarias.
#' @param eje el eje resuelto por [monitoreo_aulas_eje()]; se resuelve del `cfg`
#'   si no se pasa.
#' @param padron el padrón cargado, cuando el eje lo necesita. Su ausencia NO se
#'   suple: se declara en `aviso`, y todas las respuestas quedan sin eje.
#' @return `data.frame` con una fila por respuesta —`valor`, `clave`, `cuenta`,
#'   `fuera`, `huerfana`, `sin_eje`, `duplicada`, `motivo`— más los atributos
#'   `eje`, `diagnostico`, `aviso` y `invariante`.
#' @export
monitoreo_aulas_eje_atribucion <- function(atr, plan_df = NULL, responses = NULL,
                                           cfg = list(), eje = NULL, padron = NULL) {
  if (!is.list(eje) || !length(eje)) eje <- monitoreo_aulas_eje(cfg)
  n <- if (is.data.frame(atr)) nrow(atr) else 0L
  out <- data.frame(
    valor = character(n), clave = character(n),
    cuenta = rep(FALSE, n), fuera = rep(FALSE, n), huerfana = rep(FALSE, n),
    sin_eje = rep(FALSE, n), duplicada = rep(FALSE, n),
    motivo = character(n), stringsAsFactors = FALSE
  )
  if (!n) {
    return(.maea_sellar(out, eje, aviso = "", resueltas = NULL))
  }

  # --- paso 1: el aula, íntegro y primero -----------------------------------
  valid <- atr$valid %in% TRUE
  matched <- atr$matched %in% TRUE
  out$fuera <- valid & matched & (atr$fuera %in% TRUE)
  out$huerfana <- valid & !matched
  # Lo que llega al paso 2: válida, con aula, y dentro del universo.
  elegible <- valid & matched & !out$fuera

  # --- paso 2: el valor del eje --------------------------------------------
  resueltas <- NULL
  aviso <- ""
  if (identical(.monitoreo_scalar(eje$atribucion, "aula"), "persona")) {
    resueltas <- monitoreo_aulas_nivel_por_respuesta(responses, padron %||% list(), cfg)
    if (nrow(resueltas) != n) {
      # Respuestas y atribución tienen que venir de la misma base. Si no
      # coinciden no se adivina el emparejamiento: nadie resuelve y se dice.
      resueltas <- resueltas[0, , drop = FALSE]
      out$valor <- rep("", n); out$motivo[elegible] <- "sin_codigo_declarado"
      out$sin_eje <- elegible
      aviso <- paste0(
        "Las respuestas y la atribución por aula no tienen el mismo número de ",
        "filas, así que ninguna se pudo cruzar contra el padrón. Ninguna cuenta ",
        "para su celda del eje."
      )
      out$clave <- .maea_clave(out$valor, eje)
      return(.maea_sellar(out, eje, aviso, resueltas))
    }
    hit <- resueltas$resuelto %in% TRUE
    out$valor[hit] <- as.character(resueltas$nivel[hit])
    out$motivo <- resueltas$motivo
    # --- paso 3: deduplicar, DESPUÉS de asignar ----------------------------
    # `elegible` acota la deduplicación al subconjunto que acredita: fuera de
    # él un código repetido no es un duplicado de cuota.
    out$duplicada <- monitoreo_aulas_nivel_duplicado(resueltas, elegible = elegible)
    aviso <- .maea_aviso_padron(padron, resueltas, elegible, cfg)
  } else {
    # Eje por AULA: el valor es el de la fila del plan a la que se atribuyó.
    col <- monitoreo_aulas_columna_eje(plan_df, eje)
    if (nzchar(col)) {
      del_plan <- .maac_chr_col(plan_df, col)
      if (any(matched)) out$valor[matched] <- del_plan[atr$fila[matched]]
    }
  }

  # Sin valor de eje, el destino depende de dónde DEBÍA venir el valor, y eso lo
  # declara el eje —no un `if` por estudio—:
  #
  # - `fuente_valor = "plan"`: un aula sin valor es un hueco del plan, y sus
  #   respuestas se publican en una fila propia («Sin facultad»). Es lo que el
  #   bloque hace desde siempre y no se toca: cambiarlo movería cifras de HSVG.
  # - `fuente_valor = "padron"`: el cruce falló, y el estudio decidió que sin
  #   cruce no hay nivel. Va a la bolsa `sin_eje`, que se publica con su conteo
  #   y su motivo. Imputar aquí sería inventar a qué celda pertenece la persona.
  sin_valor <- elegible & !nzchar(out$valor)
  if (identical(.monitoreo_scalar(eje$fuente_valor, "plan"), "padron")) {
    out$sin_eje <- sin_valor
  }
  out$clave <- .maea_clave(out$valor, eje)
  out$cuenta <- elegible & !out$sin_eje & !out$duplicada
  .maea_sellar(out, eje, aviso, resueltas)
}

# El aviso que nombra la CAUSA y dónde se arregla. Sin él, «0 de 4 celdas» con
# quinientas respuestas dentro manda a revisar el enlace del recopilador.
.maea_aviso_padron <- function(padron, resueltas, elegible, cfg) {
  hay_padron <- is.list(padron) && length(padron[["filas"]] %||% list()) > 0L
  declarada <- nzchar(.monitoreo_scalar(
    ((cfg %||% list())[["source_mapping"]] %||% list())[["student_code_var"]] %||% "", ""))
  if (!declarada) {
    return(paste0(
      "El eje de cuotas se resuelve por el código del alumno y el estudio no ",
      "declara en qué pregunta viene. Declárala en Fuentes (`student_code_var`); ",
      "mientras tanto ninguna respuesta cae en su celda."
    ))
  }
  if (!hay_padron) {
    return(paste0(
      "El eje de cuotas se resuelve contra el padrón de matriculados y no hay ",
      "padrón cargado —o se purgó—. Cárgalo en Fuentes; mientras tanto ninguna ",
      "respuesta cae en su celda y el avance por eje queda en su último corte."
    ))
  }
  res <- resueltas$resuelto %in% TRUE
  considera <- if (is.logical(elegible) && length(elegible) == nrow(resueltas)) elegible else rep(TRUE, nrow(resueltas))
  if (any(considera) && !any(res & considera)) {
    return(paste0(
      "Ninguno de los códigos declarados se encontró en el padrón. Suele ser un ",
      "padrón de otra extracción o de otra población, no un error de los ",
      "códigos: comprueba la vigencia y el filtro con que se cargó."
    ))
  }
  ""
}

.maea_sellar <- function(out, eje, aviso, resueltas) {
  diag <- if (is.data.frame(resueltas)) {
    monitoreo_aulas_nivel_diagnostico(resueltas, elegible = out$cuenta | out$duplicada | out$sin_eje)
  } else {
    NULL
  }
  # **El invariante, publicado y no sólo comentado.** Toda válida está en una y
  # sólo una bolsa: cuenta, duplicada, sin eje, fuera de universo o huérfana.
  # Es la cuenta que permite leer el bloque sin creerlo.
  attr(out, "eje") <- monitoreo_aulas_eje_declaracion(eje)
  attr(out, "diagnostico") <- diag
  attr(out, "aviso") <- .monitoreo_scalar(aviso, "")
  attr(out, "invariante") <- list(
    schema = MONITOREO_AULAS_EJE_ATRIBUCION_SCHEMA,
    en_celdas = as.integer(sum(out$cuenta)),
    duplicadas = as.integer(sum(out$duplicada)),
    sin_eje = as.integer(sum(out$sin_eje)),
    fuera_universo = as.integer(sum(out$fuera)),
    huerfanas = as.integer(sum(out$huerfana))
  )
  out
}

#' Que las bolsas sumen las válidas, sin solaparse.
#'
#' Se expone para que la comprobación viva en un sitio y la puedan usar tanto el
#' motor como sus pruebas: un invariante que sólo se verifica en el test se
#' queda en el test.
#'
#' @param eje_atr salida de [monitoreo_aulas_eje_atribucion()].
#' @param total_validas cuántas válidas había.
#' @return lista con `ok`, las partes y su suma.
#' @export
monitoreo_aulas_eje_invariante <- function(eje_atr, total_validas) {
  inv <- attr(eje_atr, "invariante") %||% list()
  partes <- c(inv$en_celdas %||% 0L, inv$duplicadas %||% 0L, inv$sin_eje %||% 0L,
              inv$fuera_universo %||% 0L, inv$huerfanas %||% 0L)
  suma <- as.integer(sum(partes))
  total <- as.integer(suppressWarnings(as.numeric(total_validas %||% 0))[1] %||% 0L)
  # Solape: ninguna respuesta puede estar en dos bolsas.
  solapadas <- if (is.data.frame(eje_atr) && nrow(eje_atr)) {
    as.integer(sum(rowSums(cbind(eje_atr$cuenta, eje_atr$duplicada, eje_atr$sin_eje,
                                 eje_atr$fuera, eje_atr$huerfana)) > 1L))
  } else 0L
  list(ok = identical(suma, total) && identical(solapadas, 0L),
       suma = suma, total = total, solapadas = solapadas,
       partes = inv)
}
