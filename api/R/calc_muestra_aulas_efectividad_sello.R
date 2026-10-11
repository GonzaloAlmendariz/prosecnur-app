# Sello de efectividad por facultad, derivado del histórico.
#
# EL HUECO QUE CIERRA. `cfg$efectividad$por_facultad` lo lee el motor desde que
# se escribió (calc_muestra_aulas_efectividad.R:290-327) y de ahí sale
# `factor_facultad`, la F de `τ = E × R(tamaño) × F(facultad)` que
# docs/qa/criterios-dimensionamiento-aulas-2026-08-21.md declara como veredicto
# vigente. Pero NADIE lo escribía: medido el 2026-08-25 sobre los seis `.pulso`
# del repo —acnur_acg, acnur_pdm, acrconta, acrconta_mazo, hsvg2026 y el de
# auditoría—, `efectividad` era NULL en los seis, así que `factor_facultad`
# valía 1 en las 5.269 filas del marco y las quince facultades dimensionaban
# con la misma tasa. La UI incluso afirmaba lo contrario: «su factor de
# facultad, que YA está dentro de la tasa que dimensiona».
#
# QUÉ ES EL MULTIPLICADOR, en palabras de Gonzalo (2026-08-25): «un multiplicador
# que se basa en el rendimiento del año pasado, en donde si un aula rindió un
# poco más o un poco menos se aplica, y tiene que ver con k, el número de aulas
# aplicadas. A partir de doce aulas en adelante podemos predecir; si tenemos
# once o menos, usamos simplemente el multiplicador neutro que es uno.»
#
# NO ES `.cm_tau_para_dimensionar()`, que se retiró el 2026-08-21 y NO se
# reconecta: aquella elegía ENTRE dos tasas (la propia o la global) y eso no es
# lo que hace el motor. Esto compone: el motor sigue calculando su τ por tamaño
# y este factor lo corrige por lo que esa facultad rindió de más o de menos.
#
# EL DENOMINADOR LO DECIDIÓ GONZALO (2026-08-25): **esperado ponderado por
# elegibles**. Se midieron cuatro variantes sobre DERECHO y ninguna reproduce el
# 1,115 que cita el comentario de un sello viejo (ponderado 1,015 · media simple
# 1,006 · con tasa de aplicación 1,197 · mediana 1,022), señal de que aquel
# sello se armó con curvas distintas de las embebidas hoy. Se deja constancia
# para que nadie lo lea como una regresión.
.cm_sello_k_minimo <- 12L

#' Multiplicador de facultad desde las cadenas del histórico.
#'
#' @param cadenas_filas `referencia_asistencia$cadenas_reemplazo$filas`.
#' @param k_minimo aulas aplicadas mínimas para publicar (12 por decisión).
#' @return lista nombrada por clave de facultad con `tau` (el multiplicador),
#'   `k` y `suficiencia`. Sólo las que llegan al mínimo; el resto no lleva
#'   entrada y el motor las deja en 1, que es el neutro declarado.
#' @export
calc_muestra_aulas_sello_por_facultad <- function(cadenas_filas,
                                                  k_minimo = .cm_sello_k_minimo) {
  out <- list()
  if (!is.list(cadenas_filas) || !length(cadenas_filas)) return(out)
  acc <- list()
  for (cadena in cadenas_filas) {
    if (!is.list(cadena)) next
    clave <- .cm_criterios_fac_key(cadena$facultad %||% "")
    if (!nzchar(clave)) next
    for (escalon in (cadena$escalones %||% list())) {
      if (!is.list(escalon) || !identical(escalon$estado, "aplicado")) next
      efectivas <- .cm_aulas_num(escalon$efectivas, NA_real_)
      elegibles <- .cm_aulas_num(escalon$elegibles, NA_real_)
      if (!is.finite(efectivas) || !is.finite(elegibles) || elegibles <= 0) next
      previo <- acc[[clave]] %||% list(efectivas = 0, elegibles = 0,
                                       esperadas = 0, k = 0L,
                                       etiqueta = as.character(cadena$facultad %||% ""))
      previo$efectivas <- previo$efectivas + efectivas
      previo$elegibles <- previo$elegibles + elegibles
      # El esperado de ESE aula según la curva de rendimiento por tamaño, en
      # efectivas. Sumarlo aquí y dividir al final por los elegibles totales es
      # exactamente el ponderado por elegibles que se decidió: las aulas
      # grandes pesan lo que aportan, no una por una.
      previo$esperadas <- previo$esperadas +
        .cm_efectividad_rendimiento(elegibles) * elegibles
      previo$k <- previo$k + 1L
      acc[[clave]] <- previo
    }
  }
  for (clave in names(acc)) {
    d <- acc[[clave]]
    if (d$k < k_minimo || d$elegibles <= 0 || d$esperadas <= 0) next
    observado <- d$efectivas / d$elegibles
    esperado <- d$esperadas / d$elegibles
    if (!is.finite(observado) || !is.finite(esperado) || esperado <= 0) next
    multiplicador <- observado / esperado
    # El mismo tope que acepta el normalizador del sello: un factor mayor a 2
    # no describe una facultad, describe un error de datos.
    if (!is.finite(multiplicador) || multiplicador <= 0 || multiplicador > 2) next
    out[[clave]] <- list(
      facultad = d$etiqueta,
      tau = multiplicador,
      k = d$k,
      suficiencia = if (d$k >= 30L) "solida" else "delgada",
      aplicar = TRUE,
      observado = observado,
      esperado = esperado
    )
  }
  out
}

# Cortes de tramo, los mismos que la calibración embebida usa para LEER
# (`.cm_efectividad_rendimiento`). Se sella sobre los mismos bordes a propósito:
# cambiar la curva y los cortes a la vez haría imposible atribuir el efecto.
.CM_SELLO_TRAMOS_CORTES <- c(15, 25, 35, 50)

# Aulas aplicadas mínimas POR TRAMO para publicar la curva. Mismo umbral que el
# multiplicador por facultad: por debajo, la razón de sumas de un tramo es ruido.
.cm_sello_tramo_k_minimo <- 12L

#' Curva de rendimiento por tramo de tamaño, sellada desde el histórico.
#'
#' EL HUECO QUE CIERRA. `cfg$efectividad$rendimiento_tramos` lo LEE
#' `.cm_efectividad_normalize_config` desde que se escribió, y de ahí sale
#' `rendimiento_ref` y con él `tasa_efectividad_aula` y τ. Pero **nadie lo
#' escribía**: barrido del repositorio el 2026-08-28, las únicas apariciones
#' fuera de tests están en el lector. De las dos mitades del plan 1b se
#' construyó una —el multiplicador por facultad— y ésta no. El ADR 0082 describe
#' un sellado que nunca existió.
#'
#' QUÉ COSTABA. Sin sello rige la calibración embebida, que el propio archivo
#' declara «de otra ola» en un sitio y atribuye a la base 2025 en otro. Medido
#' sobre las 194 aulas aplicadas de 2025, la curva de ESA base es
#' 0,8091 · 0,6422 · 0,5657 · 0,5005 · 0,4093 contra la embebida
#' 0,80 · 0,69 · 0,56 · 0,55 · 0,44: los tramos densos están entre 7 % y 10 %
#' altos y el esperado del estudio sale **6 % optimista**.
#'
#' TODO O NADA. Si a un tramo le falta respaldo no se sella ninguno. Sellar
#' cuatro de cinco no dejaría un hueco visible: el lector exige `hasta`
#' ascendentes y correría los bordes, reasignando en silencio las aulas del
#' tramo ausente al vecino. Sin la curva completa rige la embebida, que al menos
#' se declara como `calibracion_embebida`.
#'
#' SIN PIERNAS. Los escalones traen `efectivas` y `elegibles` y nada más, así
#' que no hay con qué descomponer en asistencia × respuesta × validez. Se sella
#' sólo la `tasa` y las piernas siguen en NA, que es lo que la superficie ya
#' declara.
#'
#' @param cadenas_filas `referencia_asistencia$cadenas_reemplazo$filas`.
#' @param cortes bordes superiores de los cuatro primeros tramos.
#' @param k_minimo aulas aplicadas mínimas por tramo.
#' @return lista de `{hasta, tasa}` ascendente, o vacía si no hay con qué.
#' @keywords internal
calc_muestra_aulas_sello_tramos <- function(cadenas_filas,
                                            cortes = .CM_SELLO_TRAMOS_CORTES,
                                            k_minimo = .cm_sello_tramo_k_minimo) {
  if (!is.list(cadenas_filas) || !length(cadenas_filas)) return(list())
  bordes <- c(sort(unique(suppressWarnings(as.numeric(cortes)))), Inf)
  if (!length(bordes) || anyNA(bordes)) return(list())
  acc <- lapply(seq_along(bordes), function(i) list(efectivas = 0, elegibles = 0, k = 0L))
  for (cadena in cadenas_filas) {
    if (!is.list(cadena)) next
    for (escalon in (cadena$escalones %||% list())) {
      if (!is.list(escalon) || !identical(escalon$estado, "aplicado")) next
      efectivas <- .cm_aulas_num(escalon$efectivas, NA_real_)
      elegibles <- .cm_aulas_num(escalon$elegibles, NA_real_)
      if (!is.finite(efectivas) || !is.finite(elegibles) || elegibles <= 0) next
      i <- which(elegibles <= bordes)[1L]
      acc[[i]]$efectivas <- acc[[i]]$efectivas + efectivas
      acc[[i]]$elegibles <- acc[[i]]$elegibles + elegibles
      acc[[i]]$k <- acc[[i]]$k + 1L
    }
  }
  out <- vector("list", length(bordes))
  for (i in seq_along(bordes)) {
    d <- acc[[i]]
    if (d$k < k_minimo || d$elegibles <= 0) return(list())
    tasa <- d$efectivas / d$elegibles
    # Fuera de (0, 1] el lector rechazaría la entrada y correría los bordes; se
    # prefiere no sellar a sellar una curva que el lector va a deformar.
    if (!is.finite(tasa) || tasa <= 0 || tasa > 1) return(list())
    out[[i]] <- list(hasta = if (is.finite(bordes[[i]])) bordes[[i]] else NA_real_,
                     tasa = round(tasa, 4), k = d$k)
  }
  out
}

#' Sella la calibración por facultad dentro de la config del marco.
#'
#' Aditivo y conservador: si el estudio YA declara `efectividad$por_facultad`
#' —alguien lo selló a mano o vino en el `.pulso`— no se toca. Una declaración
#' explícita manda sobre una derivada, que es la regla de la casa en todo el
#' módulo.
#'
#' @param config config del marco ya normalizada.
#' @param referencia `s$calc_muestra_referencia_asistencia` de la sesión.
#' @return la config, con `efectividad` sellada cuando hubo con qué.
#' @export
calc_muestra_aulas_sellar_efectividad <- function(config, referencia = NULL) {
  if (!is.list(config)) return(config)
  ya <- config$efectividad
  if (is.list(ya) && length(ya$por_facultad %||% list())) return(config)
  # **`$` encadenado sobre algo que puede NO ser una lista.** Cuando la
  # referencia no trae cadenas de reemplazo, `cadenas_reemplazo` no viene
  # ausente: viene `NA` —un logical de longitud 1—, y `NA$filas` no devuelve
  # NULL, LANZA «$ operator is invalid for atomic vectors». `%||%` no lo
  # atrapa, porque sólo mira el NULL.
  #
  # Eso reventaba `POST /api/calc-muestra/marco/construir` con un 500 E_INTERNAL
  # —no un error accionable, un 500— para cualquier sesión que hubiera cargado
  # la referencia histórica de asistencia sin cadenas de reemplazo, que es el
  # caso normal de una base que sólo trae el histórico de asistencia. Fuera de
  # los dos `tryCatch` del endpoint, así que el mensaje real ni siquiera
  # llegaba al cliente.
  cadenas <- referencia[["cadenas_reemplazo"]]
  filas <- if (is.list(cadenas)) cadenas[["filas"]] else NULL
  sello <- calc_muestra_aulas_sello_por_facultad(filas)
  if (!length(sello)) return(config)
  ef <- if (is.list(ya)) ya else list()
  ef$fuente <- "historico"
  ef$periodo <- as.character(referencia$periodo %||% ef$periodo %||% "")
  # `tau_base = 1` porque lo que se guarda en cada entrada YA es el
  # multiplicador, no una tasa: el motor calcula `factor = tau / tau_base` y con
  # base 1 el factor ES el multiplicador. La cabecera de
  # calc_muestra_aulas_efectividad.R lo contempla explícitamente.
  ef$tau_base <- 1
  ef$por_facultad <- unname(lapply(sello, function(e) {
    list(facultad = e$facultad, tau = e$tau, k = e$k,
         suficiencia = e$suficiencia, aplicar = TRUE)
  }))
  # La curva por tramo, con la misma regla conservadora: una declaración
  # explícita del estudio manda sobre la derivada.
  if (!length(ef$rendimiento_tramos %||% list())) {
    tramos <- calc_muestra_aulas_sello_tramos(filas)
    if (length(tramos)) ef$rendimiento_tramos <- tramos
  }
  config$efectividad <- ef
  config
}

#' Baja la tasa de efectividad de cada facultad a su estrato del cálculo.
#'
#' EL SEGUNDO ESLABÓN. Sellar el multiplicador mueve `factor_facultad` y
#' `tasa_efectividad_aula` dentro del marco —medido: de un único valor a siete
#' distintos, 0,861 a 1,015— pero el DIMENSIONAMIENTO no los veía. El motor usa
#' `tau_e <- if (e$tau > 0) e$tau else par$tau` (calc_muestra_engine.R:1365) y
#' ningún proceso llenaba `e$tau`: medido sobre el `.pulso` real, los 15
#' estratos traían `tau: 0` con su divisor ya resuelto en 23,5. Ese cero es la
#' marca de «no declarada» y hacía caer las quince facultades al τ global. En
#' pantalla: «TASA DE EFECTIVIDAD 53,0 %» idéntica en las quince, con el marco
#' publicando tasas de 0,44 a 0,80.
#'
#' **LOS ESTRATOS VIVEN EN `comp$marco$estratos`, NO EN `comp$estratos`.** Un
#' primer intento buscó un nivel más arriba, no encontró nada y se retiró por
#' código muerto; queda escrito porque el error costó una vuelta entera.
#'
#' El dato ya existía y tenía un solo dueño: `frame$tasas_efectividad_facultad`
#' (`calc_muestra_aulas_tasas_facultad`), que hasta ahora sólo consumían dos
#' tarjetas de la UI. Esto lo conecta al cálculo sin recalcular nada.
#'
#' SE REFRESCA, y hasta el 2026-08-28 no se refrescaba. La regla era «un estrato
#' que YA declara su τ manda», y como esta función es el ÚNICO escritor de
#' `e$tau` en el motor —verificado por barrido; el frontend sólo lo lee— ese
#' «declarado» nunca era una declaración: era el valor que esta misma función
#' había puesto en una corrida anterior. Resultado: la τ quedaba congelada en el
#' marco con el que se calculó por primera vez y ninguna reconstrucción la
#' movía. Medido en HSVG2026: sus quince τ salen exactas del marco de
#' `HSVG26DEF.pulso` (1 632 aulas) mientras el marco vigente tiene 1 392 — 240
#' aulas salieron por depuración de criterios y la tasa no se enteró.
#'
#' Ahora se recalcula siempre desde el marco vigente y se sella de dónde salió:
#' `tau_origen = "marco"` y `tau_frame_hash`. La puerta para una declaración
#' humana queda abierta y explícita —`tau_origen = "manual"` se respeta— en vez
#' de deducirse de que el campo esté lleno, que es lo que fallaba.
#'
#' No altera ningún proyecto guardado: corre al recalcular. Y medido sobre
#' HSVG2026 **no cambia el dimensionamiento** (165 aulas con la τ congelada y
#' 165 con la refrescada): lo que arregla es la trazabilidad, no la cifra.
#'
#' @param estudio estudio con sus componentes.
#' @param frame marco de aulas vigente.
#' @return el estudio, con `tau` por estrato y su procedencia.
#' @export
calc_muestra_aulas_resolver_tau_estratos <- function(estudio, frame = NULL) {
  filas <- frame$tasas_efectividad_facultad %||% NULL
  if (!is.list(estudio) || !is.list(filas) || !length(filas)) return(estudio)
  por_clave <- list()
  for (f in filas) {
    if (!is.list(f)) next
    clave <- .cm_criterios_fac_key(f$facultad %||% "")
    tasa <- suppressWarnings(as.numeric(f$tasa %||% NA_real_)[1])
    if (!nzchar(clave) || !is.finite(tasa) || tasa <= 0 || tasa > 1) next
    por_clave[[clave]] <- tasa
  }
  if (!length(por_clave)) return(estudio)
  comps <- estudio$componentes %||% list()
  for (i in seq_along(comps)) {
    estratos <- comps[[i]]$marco$estratos %||% list()
    if (!length(estratos)) next
    for (j in seq_along(estratos)) {
      e <- estratos[[j]]
      # Sólo una declaración EXPLÍCITA frena el refresco. Que el campo esté
      # lleno no alcanza: lo llenó esta misma función la vez anterior.
      if (identical(.cm_aulas_scalar(e$tau_origen %||% "", ""), "manual")) next
      clave <- .cm_criterios_fac_key(e$label %||% e$estrato %||% "")
      tasa <- por_clave[[clave]]
      if (is.null(tasa)) next
      e$tau <- tasa
      e$tau_origen <- "marco"
      # De QUÉ marco, para que una τ vieja se pueda reconocer sin recalcularla.
      e$tau_frame_hash <- .cm_aulas_scalar(frame$frame_hash %||% "", "")
      estratos[[j]] <- e
    }
    comps[[i]]$marco$estratos <- estratos
  }
  estudio$componentes <- comps
  estudio
}

#' Sella los tramos de rendimiento por tamano en la config del estudio.
#'
#' EL TERCER ESLABON, y repara un rotulo que miente. Medido el 2026-08-28 sobre
#' el `.pulso` del sorteo vigente de HSVG2026: `efectividad$fuente` dice
#' `"historico"` con seis facultades selladas, y `rendimiento_tramos` es NULL.
#' Es decir, la mitad del calculo —el factor por facultad— viene del historico y
#' la otra mitad —el rendimiento por tamano— viene de la calibracion embebida
#' del codigo, sin que ninguna superficie lo diga. Las tres piernas estaban
#' vacias en las 1.392 aulas del marco, que es la firma de que no hay sello.
#'
#' **Sellar aqui no cambia ningun numero, y eso es estructural, no una
#' promesa.** Lo que se escribe es `.CM_EFECTIVIDAD_TRAMOS_EMBEBIDOS`, el mismo
#' objeto que `.cm_efectividad_rendimiento()` usa cuando no hay sello y por el
#' mismo camino de evaluacion. Cambia de donde se lee, no que se calcula.
#'
#' **Solo actua sobre `fuente == "historico"`**, y no por comodidad: el
#' normalizador de config unicamente conserva `rendimiento_tramos` dentro de esa
#' rama, asi que escribirlos con otra fuente los perderia en silencio. Ademas es
#' justo el caso que hay que reparar: un estudio con otra fuente ya se declara
#' `calibracion_embebida` y no engana a nadie.
#'
#' Sin periodo inventado. La procedencia de la calibracion embebida se
#' contradice consigo misma —el encabezado la atribuye a la base 2025 y el
#' bloque de las piernas dice que es de otra ola, registrado en
#' `docs/qa/auditoria-motor-aulas-2026-08-28.md`— y el ADR 0083 declara
#' explicitamente que NO resuelve eso. Escribir una fecha aqui seria inventar la
#' respuesta a una pregunta abierta.
#'
#' Tampoco se escribe una marca de tiempo: la config alimenta el `frame_hash` y
#' un sello con reloj propio lo movería en cada build.
#'
#' Aditivo y conservador, como el sello del multiplicador: si el estudio YA
#' declara sus tramos no se toca nada.
#'
#' @param config config del marco ya normalizada.
#' @return la config, con `efectividad$rendimiento_tramos` sellado cuando
#'   correspondia.
#' @export
calc_muestra_aulas_sellar_rendimiento <- function(config) {
  if (!is.list(config)) return(config)
  ef <- config$efectividad
  if (!is.list(ef)) return(config)
  if (!identical(as.character(ef$fuente)[1], "historico")) return(config)
  if (length(ef$rendimiento_tramos %||% list())) return(config)
  ef$rendimiento_tramos <- .CM_EFECTIVIDAD_TRAMOS_EMBEBIDOS
  # De donde salen ESTOS tramos, al lado de ellos: el resto del bloque dice
  # "historico" y estos cinco no lo son.
  ef$rendimiento_fuente <- "calibracion_embebida"
  config$efectividad <- ef
  config
}
