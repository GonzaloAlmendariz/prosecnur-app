# LA DISPOSICIÓN DE LOS CASOS, aula por aula.
#
# El libro publicaba, en el mismo documento y sin decir sobre qué contaba cada
# uno, «86 de 400» en el bloque del eje y «Efectivas obtenidas 114 · Diferencia
# +24» en el rendimiento, las dos diferencias en VERDE. Las dos cifras son
# ciertas y miden cosas distintas: una cuenta todos los cuestionarios aplicados
# en un aula y la otra sólo las entrevistas que caen en una celda de la cuota.
# Gonzalo, sobre la captura: «esto sigue mintiendo» — el semáforo decidía por el
# lector, y decidía al revés: iba por debajo y se leía doce puntos sobrado.
#
# Este archivo emite la cuenta que faltaba: por aula, cuántos cuestionarios se
# aplicaron y cómo se disponen. Alimenta dos superficies —«Rendimiento por
# facultad», agregada, y la hoja «Control de nivel», aula por aula— y por eso
# vive aquí y no dentro de ninguna de las dos.
#
# **No es un segundo cruce.** Trabaja sobre las MISMAS máscaras que ya decidió
# `monitoreo_aulas_eje_atribucion()` —`cuenta`, `fuera`, `sin_eje`,
# `duplicada`, `motivo`— y sobre la MISMA atribución respuesta→aula que cuenta
# el numerador. Volver a emparejar aquí sería el defecto que este módulo lleva
# meses corrigiendo.
#
# EL VOCABULARIO ES EL DEL DISEÑO MUESTRAL, NO UNO INVENTADO
#
# Gonzalo: «cuidado con el uso de jergas para explicar estos términos, es una
# investigación formal». Los nombres salen del diseño del propio estudio —hoja
# «7 Cierre 50 aulas» y las tasas del marco: `tasa_asistencia_aula`,
# `tasa_respuesta_aula`, `tasa_validez_aula`, `tasa_efectividad_aula`—, que
# declara la cadena **asistencia × respuesta × validez → efectividad** (0,80 ×
# 0,75 = 0,600 asumido; 0,530 observado en 2025). Toda tasa que se publique
# tiene que poder situarse en esa cadena.
#
# LOS CASOS FUERA DEL UNIVERSO NO SON PÉRDIDA
#
# Es la distinción que hace utilizable la tabla y la que la hoja anterior no
# hacía. Un caso fuera del universo es alguien que contestó y no pertenece a la
# población medida —ese curso-horario tiene alumnos de un ciclo que el estudio
# no traza—: **no entra en el denominador de la efectividad** y perseguirlo
# gasta llamadas. Un caso no resuelto sí es recuperable: la persona está en la
# población y su código falta o llegó mal.
#
# Ponerlos en el mismo renglón invita a sumar cosas que no se suman, así que
# viajan en columnas distintas y nunca bajo un rótulo común.
#
# CADA BOLSA ES UNA PRUEBA POSITIVA, Y NINGUNA ES EL RESIDUAL
#
# La primera versión terminaba con `bolsa[is.na(bolsa)] <- "fuera_universo"`, y
# eso convertía esa columna en el cajón de lo que el motor no supiera clasificar.
# Medido sobre el `.pulso` real: la asignación POSITIVA de `fuera_universo`
# —`eje_atr$fuera`, el aula que no existía— capturaba **cero** de las 114, y los
# veintitrés que salían ahí llegaban todos por el residual.
#
# Hoy coincidía con lo correcto. Mañana un fallo de atribución —un eje nuevo, un
# padrón a medias, un motivo sin rama— habría aparecido como un salto en esa
# columna, indistinguible de una población con más gente de otro ciclo. Es la
# misma trampa del verde por ausencia, con otro disfraz.
#
# Así que `fuera_universo` se prueba: **resolvió a un valor del eje que el
# diseño no traza**. Y lo que no cae en ninguna bolsa va a `sin_clasificar`, que
# tiene que valer 0 siempre y tiene un test que falla si deja de valerlo. Un
# defecto futuro se ve en vez de absorberse.
#
# LAS BOLSAS SON DISJUNTAS POR CONSTRUCCIÓN
#
# Se asignan por PRIORIDAD y no con condiciones sueltas, así que cada
# cuestionario cae en exactamente una y las seis suman los aplicados. Una tabla
# cuyo total no cuadra con sus partes es peor que no tenerla: invita a buscar
# una pérdida que no existe.
#
# UN DUPLICADO ES UNA PERSONA DEL UNIVERSO QUE CONTESTÓ DOS VECES
#
# Y sólo eso. El código 20231159 —nivel 5, fuera de los ciclos que el estudio
# mide— respondió dos veces en CH 39, y la segunda salía publicada como
# «duplicado»: la metía en la bolsa de lo que se arregla revisando datos cuando
# es una unidad NO ELEGIBLE cuyas dos respuestas no podrían contar jamás. El
# duplicado exige, además de serlo, estar en una celda del diseño.

#' Las disposiciones de un cuestionario aplicado, en el orden en que se leen.
#'
#' Primero lo que es una entrevista efectiva, después lo que no lo es y no se
#' puede recuperar, y al final lo recuperable. Quien lee la fila de un aula
#' tiene que poder parar de leer en cuanto llega a lo que no puede mover.
#'
#' `sin_clasificar` cierra la lista y **debe valer siempre 0**: ver la nota de
#' abajo sobre por qué existe.
#' @keywords internal
MONITOREO_AULAS_CASOS_BOLSAS <- c("efectivas", "fuera_universo", "sin_codigo",
                                  "no_verificable", "duplicados", "sin_clasificar")

# Los motivos del satélite del nivel que separan «la persona no declaró código»
# de «declaró uno que el padrón no verifica». Piden acciones distintas: el
# primero es una pregunta sin responder y el segundo un dato que llegó mal.
.macpa_MOTIVO_SIN_CODIGO <- c("sin_codigo_declarado")
.macpa_MOTIVO_NO_VERIFICABLE <- c("codigo_ilegible", "codigo_no_en_padron")

#' La disposición de los casos de cada aula.
#'
#' @param eje_atr la salida de [monitoreo_aulas_eje_atribucion()].
#' @param atr la atribución respuesta→fila del plan (`.maac_atribucion()`).
#' @param plan_df el plan: de ahí salen el código operativo y los elegibles.
#' @param claves_del_diseno las claves de celda que el diseño SÍ traza. Lo que
#'   resuelve fuera de esa lista es un caso fuera del universo: la persona
#'   existe y contestó, pero su celda no pertenece a la población medida.
#' @return `data.frame` con una fila por aula —`codigo`, `elegibles`,
#'   `aplicados` y una columna por disposición—, de menor a mayor tasa de
#'   efectividad. Sin cuestionarios atribuidos devuelve cero filas.
#' @keywords internal
monitoreo_aulas_casos_por_aula <- function(eje_atr, atr, plan_df = NULL,
                                           claves_del_diseno = character(0)) {
  n <- if (is.data.frame(eje_atr)) nrow(eje_atr) else 0L
  vacio <- data.frame(codigo = character(0), elegibles = numeric(0),
                      aplicados = integer(0), stringsAsFactors = FALSE)
  for (b in MONITOREO_AULAS_CASOS_BOLSAS) vacio[[b]] <- integer(0)
  if (!n || !is.data.frame(atr) || nrow(atr) != n) return(vacio)

  # El aula de cada cuestionario, de la MISMA atribución que cuenta el numerador.
  codigo <- rep("", n)
  ok <- !is.na(atr$fila)
  cod_plan <- if (is.data.frame(plan_df) && nrow(plan_df)) {
    .maac_chr_col(plan_df, "operational_code")
  } else character(0)
  eleg_plan <- if (is.data.frame(plan_df) && nrow(plan_df)) {
    .maac_num_col(plan_df, "eligible_n")
  } else numeric(0)
  if (any(ok) && length(cod_plan)) codigo[ok] <- cod_plan[atr$fila[ok]]

  # **Sólo los atribuidos a un aula.** Un cuestionario huérfano no pertenece a
  # ninguna fila de esta tabla —no se sabe de qué aula vino— y meterlo en una
  # inventaría su procedencia. Viaja aparte, en el agregado del bloque.
  dentro <- (atr$valid %in% TRUE) & (atr$matched %in% TRUE)
  if (!any(dentro)) return(vacio)

  motivo <- as.character(eje_atr$motivo %||% rep("", n))
  motivo[is.na(motivo)] <- ""
  # **Pertenecer a una celda del diseño es una propiedad del VALOR**, no de la
  # máscara `cuenta`: un duplicado no cuenta y aun así su persona puede estar
  # —o no— en la población medida, y de eso depende en qué bolsa cae.
  del_diseno <- as.character(eje_atr$clave) %in% as.character(claves_del_diseno)

  # **Por PRIORIDAD y con pruebas POSITIVAS.** El orden es el del propio
  # pipeline —el aula decide primero, la persona después— y ninguna rama es un
  # «lo que sobre»: lo que sobra tiene su propia bolsa, abajo.
  bolsa <- rep(NA_character_, n)
  # 1. El aula quedó fuera del universo (no existía, o era virtual).
  bolsa[dentro & (eje_atr$fuera %in% TRUE)] <- "fuera_universo"
  # 2. La persona no se pudo identificar. Dos motivos, dos acciones distintas.
  pend <- dentro & is.na(bolsa)
  bolsa[pend & (eje_atr$sin_eje %in% TRUE) & motivo %in% .macpa_MOTIVO_SIN_CODIGO] <- "sin_codigo"
  pend <- dentro & is.na(bolsa)
  bolsa[pend & (eje_atr$sin_eje %in% TRUE)] <- "no_verificable"
  # 3. La persona resolvió a un valor que el diseño NO traza: contestó y no
  #    pertenece a la población medida. Cuente o no cuente, y sea o no su
  #    segunda respuesta: ninguna de ellas podría contar jamás.
  pend <- dentro & is.na(bolsa)
  bolsa[pend & !del_diseno &
          ((eje_atr$cuenta %in% TRUE) | (eje_atr$duplicada %in% TRUE))] <- "fuera_universo"
  # 4. Segunda respuesta de una persona que SÍ está en la población medida.
  pend <- dentro & is.na(bolsa)
  bolsa[pend & (eje_atr$duplicada %in% TRUE) & del_diseno] <- "duplicados"
  # 5. La entrevista efectiva de su celda.
  pend <- dentro & is.na(bolsa)
  bolsa[pend & (eje_atr$cuenta %in% TRUE) & del_diseno] <- "efectivas"
  # 6. Y lo que no probó nada de lo anterior. **Tiene que ser cero siempre**;
  #    si deja de serlo, el defecto se ve aquí en vez de disolverse dentro de
  #    una columna legítima.
  bolsa[dentro & is.na(bolsa)] <- "sin_clasificar"

  aulas <- unique(codigo[dentro])
  aulas <- aulas[nzchar(aulas)]
  # Un cuestionario atribuido a una fila del plan sin código operativo no tiene
  # fila propia: se declara bajo su ausencia en vez de desaparecer.
  if (any(dentro & !nzchar(codigo))) aulas <- c(aulas, "")

  filas <- lapply(aulas, function(a) {
    sel <- dentro & codigo == a
    # Los elegibles son del PLAN y no se cuentan de las respuestas: son el
    # denominador que el diseño le puso al aula, y es lo que hace que la tasa
    # de efectividad se pueda situar en la cadena del marco.
    eleg <- if (nzchar(a) && length(eleg_plan)) {
      v <- eleg_plan[cod_plan == a]
      v <- v[is.finite(v)]
      if (length(v)) v[[1]] else NA_real_
    } else NA_real_
    fila <- data.frame(codigo = if (nzchar(a)) a else "(sin código de aula)",
                       elegibles = eleg, aplicados = as.integer(sum(sel)),
                       stringsAsFactors = FALSE)
    for (b in MONITOREO_AULAS_CASOS_BOLSAS) {
      fila[[b]] <- as.integer(sum(sel & bolsa %in% b))
    }
    fila
  })
  out <- do.call(rbind, filas)
  # **La máscara de entrevistas efectivas, POR RESPUESTA.** Viaja como atributo
  # y no como columna del payload: la necesita «Avance diario» —que contaba
  # cuestionarios aplicados y los llamaba efectivas— y no tiene por qué cruzar
  # a la pantalla, donde serían miles de booleanos que nadie lee. Sale del mismo
  # reparto de bolsas, así que las dos tablas no pueden discrepar.
  attr(out, "efectiva") <- bolsa %in% "efectivas"
  # **De menor a mayor tasa de efectividad**: el aula que peor rinde abre la
  # tabla, que es la que se mira primero — la misma convención que la tabla por
  # facultad y la de facultades en riesgo. Sin tasa computable, al final. Los
  # empates los rompe el código, para que dos publicaciones del mismo estado
  # den el mismo orden.
  tasa <- monitoreo_aulas_tasa_efectividad(out$efectivas, out$elegibles)
  out[order(ifelse(is.finite(tasa), tasa, Inf), out$codigo), , drop = FALSE]
}

#' La tasa de efectividad: entrevistas efectivas entre elegibles.
#'
#' Es el último eslabón de la cadena que el diseño declara —asistencia ×
#' respuesta × validez— y por eso su denominador son los ELEGIBLES y no los
#' cuestionarios aplicados: un caso fuera del universo no pertenece a la
#' población medida y no entra en el denominador.
#'
#' Un denominador en cero no da cero por ciento: da NA. Un 0 de 0 no es una
#' efectividad nula, es una efectividad que todavía no existe.
#' @keywords internal
monitoreo_aulas_tasa_efectividad <- function(efectivas, elegibles) {
  e <- suppressWarnings(as.numeric(efectivas))
  d <- suppressWarnings(as.numeric(elegibles))
  ifelse(is.finite(e) & is.finite(d) & d > 0, e / d, NA_real_)
}

#' La misma cuenta, agregada a las aulas que se le pidan.
#'
#' La usa «Rendimiento por facultad», que mide sobre las aulas APLICADAS de cada
#' facultad y no sobre el plan entero.
#'
#' @param casos la salida de [monitoreo_aulas_casos_por_aula()].
#' @param codigos los códigos operativos a sumar; `NULL` los suma todos.
#' @return lista con `elegibles`, `aplicados` y una entrada por disposición.
#' @keywords internal
monitoreo_aulas_casos_total <- function(casos, codigos = NULL) {
  cero <- c(list(elegibles = 0, aplicados = 0L),
            stats::setNames(as.list(rep(0L, length(MONITOREO_AULAS_CASOS_BOLSAS))),
                            MONITOREO_AULAS_CASOS_BOLSAS))
  if (!is.data.frame(casos) || !nrow(casos)) return(cero)
  sel <- if (is.null(codigos)) rep(TRUE, nrow(casos)) else casos$codigo %in% as.character(codigos)
  if (!any(sel)) return(cero)
  suma <- function(col) sum(suppressWarnings(as.numeric(casos[[col]][sel])), na.rm = TRUE)
  out <- list(elegibles = suma("elegibles"), aplicados = as.integer(suma("aplicados")))
  for (b in MONITOREO_AULAS_CASOS_BOLSAS) out[[b]] <- as.integer(suma(b))
  out
}
