# =============================================================================
# Certeza de cobertura — ¿cuántas aulas para que la cuota se alcance de verdad?
# =============================================================================
#
# POR QUÉ EXISTE
#
# El dimensionamiento del motor (`.cm_calc_conglomerado`) responde con una
# división:
#
#     aulas = techo( cuota / (tamaño_típico × τ) )
#
# Esa cuenta apunta al CENTRO de la distribución: dice cuántas aulas harían
# falta si cada aula rindiera lo típico. Pero el sorteo se ejecuta UNA vez, no
# mil, y dos cosas lo desvían de ese centro:
#
#   1. El arranque del sistemático es aleatorio. Con el mismo número de aulas,
#      una corrida puede caer sobre cursos-horario grandes y otra sobre chicos.
#   2. Los estudiantes se repiten entre aulas del mismo estrato. Dos aulas de
#      40 no dan 80 personas distintas; dan 80 menos el traslape. El divisor
#      del centro no sabe nada de eso.
#
# Resultado: un diseño que "cuadra" en la división puede quedarse corto en
# campo con probabilidad cercana a la mitad, y nadie se entera hasta que el
# operativo ya arrancó.
#
# QUÉ HACE ESTE MOTOR
#
# Cambia la pregunta. En vez de «¿cuántas aulas necesito en promedio?» pregunta
# «¿cuántas aulas necesito para que la cuota se alcance en al menos el 95% de
# los sorteos posibles?». Y la responde simulando el sorteo REAL —el mismo
# `.cm_aulas_select_once_dispatch` que ejecuta la selección de verdad, con el
# mismo engine y el mismo descuento secuencial— sobre las aulas de ese estrato,
# contando estudiantes ÚNICOS netos y aplicando el rendimiento τ del estrato.
#
# LO QUE NO ES: UN BOOTSTRAP
#
# Esto es Monte Carlo del sorteo: los datos quedan fijos y lo que se repite es
# el azar del diseño. Un bootstrap remuestrea los datos observados para medir
# la incertidumbre de un estadístico, y ese ya existe en otro lado
# (`.cm_asist_bootstrap_ratio` sobre las tasas históricas). Son preguntas
# distintas y se nombran distinto a propósito: confundirlas hace creer que la
# incertidumbre de τ está cubierta acá, y no lo está. τ entra como constante
# conocida; su intervalo lo publica la referencia de asistencia.
#
# POR QUÉ POR ESTRATO Y NO SOBRE EL MARCO ENTERO
#
# Porque la cuota que hay que alcanzar es por facultad, y el campo se organiza
# por facultad. Una corrida global taparía que Gastronomía no llega mientras
# Estudios Generales sobra. Cada estrato se simula con su propio subconjunto
# del marco, su cuota y su τ.

CALC_MUESTRA_AULAS_CERTEZA_SCHEMA <- "calc_muestra_aulas_certeza_cobertura_v1"

# Nivel exigido por default. 0.95 es la convención del mismo lugar de donde
# viene el 1.96 del tamaño de muestra: no es un número nuevo que aprender.
.CM_CERTEZA_NIVEL_DEFAULT <- 0.95

# Corridas por candidato: 40 (decisión de Gonzalo, 2026-09-25: «Deja las 40
# corridas en ¿Alcanza?»). Con p cercana a 0.95 el error estándar es ~3.4
# puntos (300 lo bajaba a ~1.3), a cambio de que la medición no tarde decenas
# de minutos: medido sobre hsvg2026 (2.561 CH), un sorteo cubo cuesta
# ~0.3 s tenga el estrato 93 o 577 filas, así que el antiguo reparto por
# filas (60/n) no abarataba nada y los estratos chicos pagaban 120–300
# corridas a costo completo (~25–44 min en total). Una petición puede pedir
# más corridas explícitamente; no se baja de 40.
.CM_CERTEZA_CORRIDAS_DEFAULT <- 40L
.CM_CERTEZA_CORRIDAS_MIN <- 40L

# Tope de candidatos evaluados por estrato. La probabilidad crece con el
# número de aulas, así que la búsqueda monótona converge en pocos pasos; el
# tope es un cortacircuitos, no un presupuesto esperado.
.CM_CERTEZA_MAX_EVALUACIONES <- 16L

# τ de respaldo cuando el estrato no lo declara. Nunca 1: asumir rendimiento
# perfecto es exactamente el error que este motor existe para no cometer. Es el
# mismo default que `.CM_DEFAULTS_PARAMS$tau` del motor de muestra.
.CM_CERTEZA_TAU_FALLBACK <- 0.7

.cm_certeza_nivel <- function(x) {
  nivel <- .cm_aulas_num(x, .CM_CERTEZA_NIVEL_DEFAULT)
  if (!is.finite(nivel) || nivel <= 0 || nivel >= 1) nivel <- .CM_CERTEZA_NIVEL_DEFAULT
  nivel
}

# Presupuesto de corridas por escala. Un estrato con 400 cursos-horario cuesta
# por corrida bastante más que uno con 8; sin esto, una facultad masiva se come
# el tiempo de todas las demás. Con el default en 40 (= el mínimo) el reparto
# sólo actúa si una petición pide más.
.cm_certeza_corridas <- function(solicitadas, n_aulas) {
  pedidas <- .cm_aulas_int(solicitadas, .CM_CERTEZA_CORRIDAS_DEFAULT)
  if (pedidas <= 0L) pedidas <- .CM_CERTEZA_CORRIDAS_DEFAULT
  if (n_aulas <= 60L) return(pedidas)
  escalado <- as.integer(ceiling(pedidas * 60 / n_aulas))
  max(.CM_CERTEZA_CORRIDAS_MIN, min(pedidas, escalado))
}

# Estudiantes distintos que aporta un conjunto de aulas ya elegidas.
#
# Con ids parseables la respuesta es exacta: la unión de los padrones, que es
# justo donde muere el traslape. Sin ids (marcos anonimizados) no hay forma de
# saber quién se repite y se cae a la suma de elegibles, que es la COTA
# SUPERIOR — se declara como tal en `base_conteo` para que nadie lea un
# optimismo estructural como si fuera una medición.
.cm_certeza_estudiantes_netos <- function(rows) {
  if (!nrow(rows)) return(list(valor = 0, base = "sin_aulas"))
  netos <- .cm_aulas_unique_students_n(rows)
  if (netos > 0L) return(list(valor = as.numeric(netos), base = "estudiantes_unicos"))
  suma <- suppressWarnings(sum(as.numeric(rows$eligible_n), na.rm = TRUE))
  list(valor = if (is.finite(suma)) suma else 0, base = "suma_elegibles")
}

# Claves de la config que fijan por su cuenta CUÁNTAS aulas se sortean y por
# tanto compiten con el `n_aulas` que la búsqueda quiere probar.
#
# `.cm_aulas_quota_estratos` (calc_muestra_aulas_afijacion.R) da PRECEDENCIA a
# `faculty_targets` sobre `n_aulas`: con targets puestos, cada evaluación
# sortea el número del target y no el candidato. La curva de rendimiento sale
# plana y la búsqueda —que baja mientras la probabilidad siga alcanzando—
# certifica en 1 aula. Medido el 2026-08-27 sobre el marco HSVG2026 de 1.447
# aulas: 11 de 15 facultades certificaron en exactamente 1 y el total dio 64
# contra 165 de la cuenta directa.
#
# No se había visto porque en el flujo natural se certifica ANTES de sortear,
# cuando la config todavía no tiene targets. Muerde al RE-certificar sobre un
# proyecto ya sorteado —el usuario cambia criterios y vuelve a medir— porque la
# config de sesión arrastra los targets del sorteo anterior.
#
# Acá un reparto por facultad nunca puede significar nada: la certeza evalúa UN
# estrato a la vez con un n explícito, así que una afijación entre facultades
# solo puede ser una instrucción contradictoria con la pregunta que se hace.
.CM_CERTEZA_CLAVES_AFIJACION <- c("faculty_targets", "afijacion_facultades")

# Por qué `faculty_targets` es de esta lista y no un caso aparte: la afijación
# del diseño fija cuántas aulas toca cada facultad, y dentro de una
# certificación eso deja la pregunta sin objeto —el candidato ES lo que se está
# midiendo—. Con `faculty_targets` puestos, `.cm_aulas_quota_estratos` aplica su
# regla declarada —«facultades con target: su n manda»— y sortea siempre el
# mismo número, así que la curva sale plana. Medido en HSVG2026: con
# DERECHO = 19 el rendimiento quedaba en 394 de 40 a 55 aulas.
#
# Este es el ÚNICO punto de saneo, a propósito. `.cm_certeza_evaluar` llevaba
# además un `sim_selector$faculty_targets <- NULL` suelto que hacía lo mismo, y
# esa redundancia apagó en silencio la regresión que la vigila: el test la
# neutraliza mockeando esta función, y con la segunda limpieza en pie el
# síntoma ya no volvía. La red contra la clase entera del defecto —una clave
# nueva que compita con `n_aulas`— es `aulas_efectivas`, no una segunda copia.
.cm_certeza_selector_sin_afijacion <- function(selector) {
  if (!is.list(selector)) return(selector)
  for (clave in .CM_CERTEZA_CLAVES_AFIJACION) selector[[clave]] <- NULL
  selector
}

# Un candidato: sortea `aulas` cursos-horario del estrato `corridas` veces y
# mide en cuántas se alcanza la cuota.
#
# El selector se clona con `n_aulas = aulas`, sin afijación entre facultades y
# con el subconjunto viajando con un `stratum` constante, así que la cuota del
# sorteo es exactamente `aulas` y no una repartición: acá el estrato ya está
# fijado por el llamador.
#
# `aulas_efectivas` mide cuántas aulas devolvió el sorteo de verdad. Es la red
# que atrapa la clase entera del defecto de arriba: la lista de claves que
# compiten con `n_aulas` es cerrada y una clave nueva volvería a colarse en
# silencio, pero una curva cuyo n crece sin que crezcan las aulas sorteadas se
# ve sin tener que adivinar cuál fue.
.cm_certeza_evaluar <- function(rows, selector, engine, aulas, corridas,
                                tau, cuota, seed, objective = NULL) {
  aulas <- max(1L, min(nrow(rows), as.integer(aulas)))
  sim_selector <- .cm_certeza_selector_sin_afijacion(selector)
  sim_selector$n_aulas <- aulas
  # Sin olas de reemplazo: lo que se mide es lo que rinde la primera cadena que
  # pisa el aula. Contar reservas acá contestaría otra pregunta —cuánto rinde
  # el operativo si todo falla y todo se reemplaza— y haría pasar como
  # suficiente un diseño que solo cierra agotando el respaldo.
  sim_selector$replacement_waves <- 0L

  # POR QUE τ Y NO LA TASA DE CADA AULA, que el marco ya trae
  #
  # `tasa_efectividad_aula` (rendimiento del tramo x factor de la facultad)
  # viaja en cada fila, y la certificacion de lo YA sorteado la usa —
  # `calc_muestra_aulas_certificacion.R` suma `efectivas_esperadas`, metodo
  # `suma_esperadas`—. Aca se usa τ, que sale de la MISMA columna pero no es lo
  # mismo: τ es su media ponderada por elegibles sobre el marco ENTERO de la
  # facultad (`calc_muestra_aulas_tasas_facultad`). Las dos coinciden solo si lo
  # sorteado reproduce la mezcla de tamanos del marco.
  #
  # ADVERTENCIA, medida el 2026-08-28: CUAL DE LAS DOS CONVIENE DEPENDE DE UN
  # DEFECTO QUE ESTA UNAS LINEAS MAS ARRIBA. `calc_muestra_aulas_certeza`
  # sobreescribe `rows$stratum` con la clave de la facultad, y el motor sortea
  # POR `stratum` (`.cm_aulas_select_once_engine` filtra `stratum == st`). El
  # diseno de HSVG2026 estratifica por `faculty, sex_top_1, size_group`: al
  # colapsarlo se pierden DOS de los tres ejes, entre ellos el de tamano. Esta
  # simulacion no sortea como sortea el estudio.
  #
  # Medido sobre EE.GG. Letras con 20 aulas, mismas semillas:
  #
  #   colapsado (lo que corre hoy)  media 416,0  sd  8,99  P(cumple) 0,988
  #   estratificado (el diseno)     media 369,5  sd  6,56  P(cumple) 0,000
  #
  # El colapso deja al PPS concentrarse en aulas grandes, que el diseno le
  # prohibe. La seleccion REAL de esas 20 aulas rinde 378,6 — pegada al valor
  # estratificado y lejos del colapsado. Es decir: la certeza publica un
  # rendimiento que el diseno no puede producir.
  #
  # Y de ahi sale que la comparacion entre tasas se invierta segun el modelo:
  #
  #   con el colapso           las dos tasas casi empatan (total 174 vs 175)
  #   con la estratificacion   τ pide 21 aulas en EE.GG. Letras (P=0,286 con 20)
  #                            y la tasa por aula certifica con 20 (P=0,998)
  #
  # Porque estratificar por `size_group` FUERZA aulas chicas en la muestra, y
  # las chicas rinden muy por encima de τ (0,80 contra el τ de 0,4188 de esa
  # facultad). τ se las cobra a tasa de facultad; la tasa por aula no.
  #
  # POR ESO NO SE CAMBIA LA TASA AQUI TODAVIA: elegir entre τ y la tasa por aula
  # sobre un simulador que no reproduce el diseno es optimizar el modelo
  # equivocado. Primero la estratificacion, despues la tasa. Evidencia y cuadros:
  # docs/qa/checklist-certeza-tasa-por-aula-2026-08-28.md.
  #
  # (El colapso es deliberado —lo pide el comentario de `.cm_certeza_evaluar`,
  # para que `n_aulas` signifique el candidato y no una reparticion—. El costo
  # no estaba medido; ahora lo esta.)
  #
  # OJO CON EL OTRO EXTREMO: la tasa YA TRAE PARTE DEL TRASLAPE. Los tramos son
  # `efectivas/elegibles` de 2025 con denominador PADRON, que incluye a quienes
  # ya habian respondido en otra aula: el sello publica `ya_medidas = 446` sobre
  # `elegibles = 6 232`. Ese 7,2 % esta dentro de la tasa, asi que multiplicar
  # los unicos netos por ella lo descuenta dos veces. Pero tampoco vale volver
  # al padron bruto: 7,2 % no es el 11,4 % de traslape de 2026, y el factor por
  # facultad va de x1,000 a x1,2115. Ninguna de las dos convenciones globales es
  # correcta — se limpia la tasa y RECIEN se aplica a los unicos.
  rendimientos <- numeric(corridas)
  bases <- character(corridas)
  sorteadas <- integer(corridas)
  for (i in seq_len(corridas)) {
    picked <- .cm_aulas_select_once_dispatch(
      rows, sim_selector, engine,
      seed = seed + i * 7919L,
      objective = objective
    )
    netos <- .cm_certeza_estudiantes_netos(picked)
    rendimientos[[i]] <- netos$valor * tau
    bases[[i]] <- netos$base
    sorteadas[[i]] <- nrow(picked)
  }

  exitos <- rendimientos >= cuota
  list(
    aulas = aulas,
    corridas = as.integer(corridas),
    probabilidad = as.numeric(mean(exitos)),
    rendimiento_medio = as.numeric(mean(rendimientos)),
    rendimiento_p05 = as.numeric(stats::quantile(rendimientos, probs = 0.05, names = FALSE, type = 7L)),
    aulas_efectivas = as.numeric(mean(sorteadas)),
    base_conteo = .cm_aulas_mode(bases, "estudiantes_unicos")
  )
}

# Búsqueda monótona del mínimo que alcanza el nivel.
#
# La probabilidad de alcanzar la cuota crece con el número de aulas, así que no
# hace falta barrer 1..N: se arranca donde dice la fórmula del motor —que es la
# respuesta que hoy tiene el usuario en pantalla— y se camina hacia el lado que
# corresponda. Empezar ahí también hace que el resultado más frecuente (la
# fórmula se queda corta por poco) cueste dos o tres evaluaciones.
.cm_certeza_buscar <- function(rows, selector, engine, corridas, tau, cuota,
                               aulas_formula, nivel, seed, objective = NULL,
                               on_progress = NULL, etiqueta = "") {
  disponibles <- nrow(rows)
  evaluado <- list()
  evaluar <- function(n) {
    clave <- as.character(n)
    if (!is.null(evaluado[[clave]])) return(evaluado[[clave]])
    if (length(evaluado) >= .CM_CERTEZA_MAX_EVALUACIONES) return(NULL)
    .cm_aulas_progress(
      on_progress, "certeza_cobertura",
      current = length(evaluado) + 1L, total = .CM_CERTEZA_MAX_EVALUACIONES,
      message = sprintf("Certeza de cobertura · %s · probando %d aulas", etiqueta, n)
    )
    punto <- .cm_certeza_evaluar(
      rows, selector, engine, n, corridas, tau, cuota,
      seed = seed + n * 104729L, objective = objective
    )
    evaluado[[clave]] <<- punto
    punto
  }

  inicio <- max(1L, min(disponibles, .cm_aulas_int(aulas_formula, 1L)))
  punto_inicio <- evaluar(inicio)
  if (is.null(punto_inicio)) return(NULL)

  minimo <- NA_integer_
  if (punto_inicio$probabilidad >= nivel) {
    # La fórmula ya alcanza: se baja mientras siga alcanzando, para no pedir
    # aulas de más. El último que alcanzó es el mínimo.
    minimo <- inicio
    n <- inicio - 1L
    while (n >= 1L) {
      punto <- evaluar(n)
      if (is.null(punto) || punto$probabilidad < nivel) break
      minimo <- n
      n <- n - 1L
    }
  } else {
    n <- inicio + 1L
    while (n <= disponibles) {
      punto <- evaluar(n)
      if (is.null(punto)) break
      if (punto$probabilidad >= nivel) {
        minimo <- n
        break
      }
      n <- n + 1L
    }
  }

  curva <- evaluado[order(as.integer(names(evaluado)))]
  list(
    minimo = minimo,
    inicio = punto_inicio,
    curva = unname(curva),
    evaluaciones = length(evaluado),
    tope_evaluaciones = length(evaluado) >= .CM_CERTEZA_MAX_EVALUACIONES
  )
}

# Normaliza los estratos que entran. Cada uno declara su cuota (lo que hay que
# alcanzar), su τ (lo que rinde un elegible) y cuántas aulas pide hoy la
# fórmula. La llave de facultad es la que ya usa el contrato de alumnos por CH.
.cm_certeza_normalize_estratos <- function(x) {
  if (!is.list(x) || !length(x)) return(list())
  out <- list()
  for (item in x) {
    if (!is.list(item)) next
    label <- .cm_aulas_scalar(item$label %||% item$estrato, "")
    key <- .cm_aulas_scalar(
      item$faculty_key %||% item$key %||% (item$alumnos_por_ch %||% list())$faculty_key,
      ""
    )
    if (!nzchar(key)) key <- .cm_criterios_fac_key(label)
    if (!nzchar(key)) next
    cuota <- .cm_aulas_num(item$cuota, NA_real_)
    if (!is.finite(cuota) || cuota <= 0) next
    tau <- .cm_aulas_num(item$tau, NA_real_)
    if (!is.finite(tau) || tau <= 0 || tau > 1) tau <- NA_real_
    out[[length(out) + 1L]] <- list(
      key = key,
      label = if (nzchar(label)) label else key,
      cuota = cuota,
      tau = tau,
      aulas_formula = max(0L, .cm_aulas_int(item$aulas_formula %||% item$aulas_base, 0L))
    )
  }
  out
}

# Llave de facultad de cada fila del marco, con el mismo normalizador que usan
# los criterios: sin esto "GASTRONOMÍA" y "GASTRONOMIA" son dos facultades.
.cm_certeza_frame_keys <- function(aula_frame) {
  labels <- if ("faculty" %in% names(aula_frame)) {
    trimws(as.character(aula_frame$faculty))
  } else {
    rep("", nrow(aula_frame))
  }
  labels[is.na(labels)] <- ""
  .cm_criterios_fac_key(labels)
}

# ¿El sorteo respondió al n que se le pidió?
#
# La búsqueda solo significa algo si pedir más aulas devuelve más aulas. Si la
# curva recorrió varios n y las aulas efectivamente sorteadas no se movieron ni
# una, la config está fijando el número por su cuenta y el mínimo publicado no
# es interpretable —esa es exactamente la forma que tomó el defecto de
# `faculty_targets`—. La lista de claves que compiten con `n_aulas` es cerrada
# y una clave nueva volvería a colarse en silencio; esto la atrapa sin tener
# que saber cuál es.
.cm_certeza_sorteo_insensible <- function(curva) {
  if (length(curva) < 2L) return(FALSE)
  pedidas <- vapply(curva, function(p) as.numeric(p$aulas), numeric(1))
  efectivas <- vapply(curva, function(p) .cm_aulas_num(p$aulas_efectivas, NA_real_), numeric(1))
  if (anyNA(efectivas)) return(FALSE)
  length(unique(pedidas)) > 1L && length(unique(round(efectivas, 6))) == 1L
}

.cm_certeza_fila_vacia <- function(estrato, disponibles, motivo) {
  list(
    key = estrato$key,
    label = estrato$label,
    disponibles = as.integer(disponibles),
    cuota = round(estrato$cuota, 2),
    tau = if (is.finite(estrato$tau)) round(estrato$tau, 4) else NA_real_,
    aulas_formula = as.integer(estrato$aulas_formula),
    probabilidad_formula = NA_real_,
    aulas_certeza = NA_integer_,
    probabilidad_certeza = NA_real_,
    brecha = NA_integer_,
    alcanzable = FALSE,
    agotado = identical(motivo, "marco_agotado"),
    motivo = motivo,
    rendimiento_medio = NA_real_,
    rendimiento_p05 = NA_real_,
    base_conteo = "no_evaluado",
    corridas = 0L,
    curva = list()
  )
}

#' Certeza de cobertura por estrato.
#'
#' @param frame Resultado de `calc_muestra_aulas_construir_marco`.
#' @param config Config del marco de aulas (normalizada o cruda).
#' @param estratos Lista de estratos con `cuota`, `tau` y `aulas_formula`.
#'   Normalmente son las filas de `resultado$aulas_por_estrato` del estudio.
#' @param nivel Probabilidad exigida de alcanzar la cuota. Default 0.95.
#' @param corridas Corridas de Monte Carlo por candidato.
#' @param on_progress Callback de progreso del patrón de aulas.
#' @return Lista con `filas` (una por estrato), `total` y el criterio aplicado.
#' @export
calc_muestra_aulas_certeza <- function(frame, config = list(), estratos = list(),
                                       nivel = NULL, corridas = NULL,
                                       on_progress = NULL) {
  cfg <- if (identical(config$schema %||% "", "calc_muestra_aulas_config_v1")) {
    config
  } else {
    calc_muestra_aulas_normalize_config(config)
  }
  aula_frame <- .cm_aulas_prepare_frame(frame, cfg)
  estratos <- .cm_certeza_normalize_estratos(estratos)
  if (!length(estratos)) {
    stop_api(
      400, "E_CALC_MUESTRA_CERTEZA_SIN_ESTRATOS",
      "La certeza de cobertura necesita al menos un estrato con cuota declarada."
    )
  }

  nivel <- .cm_certeza_nivel(nivel)
  engine <- .cm_aulas_engine_key(cfg$selector$selector_engine)
  objective <- .cm_aulas_normalize_objective(cfg$objective)
  keys <- .cm_certeza_frame_keys(aula_frame)
  semilla <- .cm_aulas_int(cfg$selector$seed, 20260619L)

  filas <- vector("list", length(estratos))
  for (i in seq_along(estratos)) {
    estrato <- estratos[[i]]
    idx <- which(keys == estrato$key)
    if (!length(idx)) {
      filas[[i]] <- .cm_certeza_fila_vacia(estrato, 0L, "sin_aulas_en_marco")
      next
    }
    rows <- aula_frame[idx, , drop = FALSE]
    # SE CONSERVA LA ESTRATIFICACIÓN DEL DISEÑO, y esto antes no era así.
    #
    # Hasta el 2026-08-28 aquí se hacía `rows$stratum <- estrato$key`, con el
    # argumento de que así `n_aulas` significa «el candidato» y no una
    # repartición. Pero el motor sortea POR `stratum`
    # (`.cm_aulas_select_once_engine` filtra `stratum == st`), así que colapsarlo
    # borraba los otros ejes de `strata_cols` —en HSVG2026, `sex_top_1` y
    # `size_group`— y la simulación dejaba de sortear como sortea el estudio.
    #
    # Lo que costaba, medido con las mismas semillas sobre EE.GG. Letras con 20
    # aulas: colapsado daba media 416,0 y P(cumple) 0,988; estratificado da 369,5
    # y 0,000. La selección REAL de esas 20 aulas rinde 378,6 — pegada al
    # estratificado y lejos del colapsado. La certeza publicaba un rendimiento
    # que el diseño no puede producir, porque dejaba al PPS concentrarse en aulas
    # grandes justo donde `size_group` se lo prohíbe.
    #
    # `n_aulas` sigue siendo el candidato: el subconjunto es de UNA facultad y
    # `.cm_aulas_quota_estratos` reparte ese total entre los estratos presentes,
    # sin `faculty_targets` porque `.cm_certeza_selector_sin_afijacion` los quita.
    # Que el reparto devuelva el total pedido lo vigila `aulas_efectivas`, que ya
    # viaja en cada punto de la curva.
    rownames(rows) <- NULL

    tau <- if (is.finite(estrato$tau)) estrato$tau else .CM_CERTEZA_TAU_FALLBACK
    corridas_estrato <- .cm_certeza_corridas(corridas, nrow(rows))
    busqueda <- .cm_certeza_buscar(
      rows, cfg$selector, engine, corridas_estrato, tau, estrato$cuota,
      aulas_formula = if (estrato$aulas_formula > 0L) estrato$aulas_formula else 1L,
      nivel = nivel, seed = semilla + i * 15485863L, objective = objective,
      on_progress = on_progress, etiqueta = estrato$label
    )
    if (is.null(busqueda)) {
      filas[[i]] <- .cm_certeza_fila_vacia(estrato, nrow(rows), "no_evaluable")
      next
    }
    if (.cm_certeza_sorteo_insensible(busqueda$curva)) {
      pedidas <- vapply(busqueda$curva, function(p) as.integer(p$aulas), integer(1))
      warning(sprintf(
        paste0(
          "Certeza de cobertura en %s: se probaron %d a %d aulas y el sorteo ",
          "devolvio %s en todos los casos, asi que la curva no mide el n ",
          "solicitado y el minimo no es interpretable. Revisa que la config no ",
          "fije el numero de aulas por su cuenta."
        ),
        estrato$label, min(pedidas), max(pedidas),
        format(round(.cm_aulas_num(busqueda$curva[[1L]]$aulas_efectivas, NA_real_), 2))
      ), call. = FALSE)
    }

    minimo <- busqueda$minimo
    alcanzable <- is.finite(minimo)
    punto_minimo <- if (alcanzable) {
      Filter(function(p) identical(p$aulas, as.integer(minimo)), busqueda$curva)[[1L]]
    } else {
      NULL
    }
    filas[[i]] <- list(
      key = estrato$key,
      label = estrato$label,
      disponibles = as.integer(nrow(rows)),
      cuota = round(estrato$cuota, 2),
      tau = round(tau, 4),
      aulas_formula = as.integer(estrato$aulas_formula),
      probabilidad_formula = round(busqueda$inicio$probabilidad, 4),
      aulas_certeza = if (alcanzable) as.integer(minimo) else NA_integer_,
      probabilidad_certeza = if (alcanzable) round(punto_minimo$probabilidad, 4) else NA_real_,
      brecha = if (alcanzable) as.integer(minimo - estrato$aulas_formula) else NA_integer_,
      alcanzable = alcanzable,
      # Dos formas distintas de no encontrar mínimo, y confundirlas manda al
      # usuario a resolver el problema equivocado:
      #
      #   marco_agotado    — se probó hasta la última aula del estrato y ni así
      #                      se llega al nivel. Pedir más aulas no lo arregla:
      #                      el marco no da, hay que revisar los criterios o
      #                      bajar la cuota.
      #   tope_evaluaciones — la búsqueda se cortó por presupuesto antes de
      #                      recorrer el rango. El mínimo puede existir; lo que
      #                      falta es dejarla correr, no cambiar el diseño.
      agotado = !alcanzable && !isTRUE(busqueda$tope_evaluaciones),
      motivo = if (alcanzable) {
        ""
      } else if (isTRUE(busqueda$tope_evaluaciones)) {
        "tope_evaluaciones"
      } else {
        "marco_agotado"
      },
      rendimiento_medio = round(busqueda$inicio$rendimiento_medio, 2),
      rendimiento_p05 = round(busqueda$inicio$rendimiento_p05, 2),
      base_conteo = busqueda$inicio$base_conteo,
      corridas = as.integer(corridas_estrato),
      tope_evaluaciones = isTRUE(busqueda$tope_evaluaciones),
      curva = lapply(busqueda$curva, function(p) list(
        aulas = as.integer(p$aulas),
        probabilidad = round(p$probabilidad, 4),
        rendimiento_medio = round(p$rendimiento_medio, 2),
        rendimiento_p05 = round(p$rendimiento_p05, 2),
        # Cuántas aulas devolvió el sorteo de verdad. Si no sigue a `aulas`, la
        # curva no está midiendo lo que su eje dice.
        aulas_efectivas = round(.cm_aulas_num(p$aulas_efectivas, NA_real_), 2)
      ))
    )
  }

  formula_total <- sum(vapply(filas, function(f) f$aulas_formula, integer(1)))
  certeza_total <- sum(vapply(filas, function(f) {
    if (is.na(f$aulas_certeza)) f$disponibles else f$aulas_certeza
  }, integer(1)))
  cortos <- Filter(function(f) isTRUE(is.finite(f$brecha) && f$brecha > 0L), filas)
  agotados <- Filter(function(f) isTRUE(f$agotado), filas)
  sin_ids <- Filter(function(f) identical(f$base_conteo, "suma_elegibles"), filas)

  list(
    schema = CALC_MUESTRA_AULAS_CERTEZA_SCHEMA,
    generado_en = .cm_aulas_now_iso(),
    nivel = nivel,
    engine = engine,
    frame_hash = .cm_aulas_scalar(frame$frame_hash %||% "", ""),
    corridas_solicitadas = as.integer(.cm_certeza_corridas(corridas, 1L)),
    criterio = list(
      pregunta = "¿Cuántas aulas hacen falta para que la cuota se alcance en al menos el nivel exigido de los sorteos posibles?",
      metodo = "monte_carlo_del_sorteo",
      unidad = "estudiantes únicos netos × τ del estrato",
      olas = "solo titulares",
      no_cubre = "La incertidumbre de τ. Su intervalo lo publica la referencia histórica de asistencia."
    ),
    filas = filas,
    total = list(
      aulas_formula = as.integer(formula_total),
      aulas_certeza = as.integer(certeza_total),
      brecha = as.integer(certeza_total - formula_total),
      estratos_cortos = length(cortos),
      estratos_agotados = length(agotados),
      estratos_sin_ids = length(sin_ids)
    )
  )
}

calc_muestra_aulas_certeza_job <- function(frame, config = list(), estratos = list(),
                                           nivel = NULL, corridas = NULL,
                                           progress_path = NULL) {
  on_progress <- .cm_aulas_job_progress_writer(progress_path)
  calc_muestra_aulas_certeza(
    frame, config, estratos,
    nivel = nivel, corridas = corridas, on_progress = on_progress
  )
}
attr(calc_muestra_aulas_certeza_job, "prosecnur_job_function_name") <- "calc_muestra_aulas_certeza_job"
