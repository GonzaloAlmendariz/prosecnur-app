# =============================================================================
# Avance contra la cuota del diseño (monitoreo de aulas universitarias)
# =============================================================================
#
# Dictamen metodológico 2026-08-18. Los agregados de avance del tablero medían
# contra sumas de `expected_valid` por aula, y esa suma está ESTRUCTURALMENTE
# por encima de la cuota que el diseño trazó: que la suma de metas por aula
# supere la cuota es DISEÑO, no error —el margen absorbe merma y traslape—.
# Los dos denominadores son legítimos: el del plan dirige el operativo aula a
# aula, el del diseño dice si el estudio ya tiene a su gente. Lo que no pueden
# es publicarse bajo el mismo rótulo (C5): este bloque declara su `fuente` y la
# UI rotula con ella.
#
# Supuestos que el bloque asume y NO comprueba:
# - La facultad de una respuesta se atribuye por el AULA del plan en la que se
#   recogió (QR/collector), no por auto-reporte: la post-estratificación por lo
#   declarado vive en Procesamiento, no aquí.
# - El doble conteo por traslape (~1,55 aulas por alumno en el marco) se asume
#   despreciable: las respuestas son anónimas y no se pueden deduplicar entre
#   aulas distintas.
# - Una válida de campo NO es una efectiva final: la merma campo → base
#   depurada no se descuenta; este avance mide recolección, no base entregable.
#
# Es cálculo puro sobre estado ya validado: degrada declarando (`vigencia`,
# `motivo`), nunca lanza. Por eso aquí no hay `stop_api()` ni `stop()`.

# --- lectura defensiva de columnas -------------------------------------------

.maac_chr_col <- function(df, col) {
  n <- if (is.data.frame(df)) nrow(df) else 0L
  if (!n) return(character(0))
  v <- if (col %in% names(df)) as.character(df[[col]]) else character(n)
  v[is.na(v)] <- ""
  trimws(v)
}

.maac_num_col <- function(df, col) {
  n <- if (is.data.frame(df)) nrow(df) else 0L
  if (!n) return(numeric(0))
  if (!col %in% names(df)) return(rep(NA_real_, n))
  suppressWarnings(as.numeric(df[[col]]))
}

# Lookup escalar en tablas con nombres (table/tapply): un nombre ausente da NA
# y el default, nunca "subscript out of bounds".
.maac_toma_int <- function(tabla, k, default = 0L) {
  v <- suppressWarnings(as.integer(tabla[k]))
  if (length(v) != 1L || is.na(v)) default else v
}

.maac_toma_num <- function(tabla, k, default = 0) {
  v <- suppressWarnings(as.numeric(tabla[k]))
  if (length(v) != 1L || !is.finite(v)) default else v
}

.maac_toma_chr <- function(tabla, k, default = "") {
  v <- suppressWarnings(as.character(tabla[k]))
  if (length(v) != 1L || is.na(v) || !nzchar(v)) default else v
}

# Clave de facultad para AGRUPAR: la vacía colapsa a un centinela porque `""`
# no es indexable por nombre en tablas de R y las respuestas de un aula sin
# facultad desaparecerían del bloque en silencio.
.maac_fac_key <- function(x) {
  k <- .cm_criterios_fac_key(x)
  k[!nzchar(k)] <- "sin_facultad"
  k
}

# La misma cosa para el eje que el estudio declare. Se deja `.maac_fac_key()`
# intacta —la usan otras familias que SÍ hablan de facultad— y este hermano
# recibe el eje para saber cómo se llama su centinela.
.maac_eje_key <- function(x, eje = NULL) {
  k <- monitoreo_aulas_eje_key(x)
  clave <- .monitoreo_scalar((eje %||% list())[["clave"]], "facultad")
  k[!nzchar(k)] <- paste0("sin_", clave)
  k
}

# --- sexo: clave canónica y etiqueta de display ------------------------------

# Mapa valor -> clave {"F","M",""}. Los booleanos `.mabe_es_mujer()` /
# `.mabe_es_hombre()` (banco de extras) responden otra pregunta —¿esta etiqueta
# es mujer?— con listas cerradas; aquí hace falta el mapa hacia la clave del
# diseño para casar su "F"/"M" con el vocabulario libre de respuestas y marco
# ("Femenino", "MASCULINO", "Mujer"). Prefijos y no listas: cada estudio
# escribe el suyo, y una lista cerrada se traga lo que no reconoce.
.maac_sexo_key <- function(x) {
  keys <- .cm_aulas_text_key(x)
  vapply(keys, function(k) {
    if (!nzchar(k)) return("")
    if (k == "f" || startsWith(k, "fem") || startsWith(k, "mujer")) return("F")
    if (k == "m" || startsWith(k, "masc") || startsWith(k, "hombre") ||
        startsWith(k, "varon") || startsWith(k, "male")) return("M")
    ""
  }, character(1), USE.NAMES = FALSE)
}

# La etiqueta con la que se MUESTRA una clave del diseño: como la escriba el
# PLAN (sex_top_*) primero, las respuestas rellenan, y "F"/"M" pelado como
# último recurso. El plan manda porque las filas degradadas al fallback
# conservan su vocabulario del plan: si las del diseño prefirieran el de las
# respuestas, el mismo sexo se partiría en dos grupos en la misma tabla.
.maac_sexo_etiqueta <- function(key, observados_raw, observados_key, plan_df) {
  for (col in c("sex_top_1", "sex_top_2")) {
    v <- .maac_chr_col(plan_df, col)
    v <- v[.maac_sexo_key(v) == key & nzchar(v)]
    if (length(v)) return(v[[1]])
  }
  candidatos <- observados_raw[observados_key == key & nzchar(observados_raw)]
  if (length(candidatos)) {
    tb <- sort(table(candidatos), decreasing = TRUE)
    return(names(tb)[[1]])
  }
  key
}

# --- vigencia del bloque de metas --------------------------------------------

# Tabla de decisión del dictamen: `selection_run_id` y `frame_hash` se comparan
# POR SEPARADO contra los sellos del bloque. Un par con ambos lados y valores
# distintos es prueba de diseño viejo (obsoleta -> denominador del plan); un
# par incompleto no prueba nada (no_verificable -> cuotas del diseño, dicho).
.monitoreo_aulas_avance_vigencia <- function(cfg) {
  dt <- if (is.list(cfg)) cfg$design_targets %||% list() else list()
  if (!is.list(dt)) dt <- list()
  facultades <- Filter(is.list, dt$facultades %||% list())
  if (!length(facultades)) {
    # Los avisos dicen la causa, no solo el hecho: toda degradación lleva su
    # porqué en `motivo`. Solo `vigente` viaja con "".
    return(list(
      fuente = "plan_expected", vigencia = "sin_diseno",
      motivo = paste0("El estudio importado no publica metas del diseño; ",
                      "el avance se mide contra la meta del plan."),
      dt = list(), facultades = list()
    ))
  }
  run_dt <- .monitoreo_scalar(dt$selection_run_id, "")
  run_cfg <- .monitoreo_scalar(cfg$selection_run_id, "")
  hash_dt <- .monitoreo_scalar(dt$frame_hash, "")
  hash_cfg <- .monitoreo_scalar(cfg$frame_hash, "")
  sello <- function(a, b) {
    if (nzchar(a) && nzchar(b)) (if (identical(a, b)) "igual" else "distinto") else "sin_sello"
  }
  estados <- c(sello(run_dt, run_cfg), sello(hash_dt, hash_cfg))
  if (any(estados == "distinto")) {
    return(list(
      fuente = "plan_expected", vigencia = "obsoleta",
      motivo = sprintf(
        paste0("Las metas del diseño llevan el sello selection_run_id '%s' / ",
               "frame_hash '%s' y el plan vigente lleva '%s' / '%s': el avance ",
               "se mide contra la meta del plan."),
        run_dt, hash_dt, run_cfg, hash_cfg
      ),
      dt = dt, facultades = facultades
    ))
  }
  if (all(estados == "igual")) {
    return(list(fuente = "design_targets", vigencia = "vigente", motivo = "",
                dt = dt, facultades = facultades))
  }
  list(
    fuente = "design_targets", vigencia = "no_verificable",
    motivo = sprintf(
      paste0("El sello de las metas no se puede verificar (selection_run_id '%s' / ",
             "frame_hash '%s' contra '%s' / '%s'): se usan las cuotas del diseño ",
             "sin poder confirmar su vigencia."),
      run_dt, hash_dt, run_cfg, hash_cfg
    ),
    dt = dt, facultades = facultades
  )
}

# --- atribución unificada respuesta -> fila del plan --------------------------

# La MISMA regla para el numerador de cumplimiento y para las celdas de sexo:
# la clave es el id que viajó en el QR, el aula (`classroom_id`) manda sobre la
# unidad (`collection_unit_id`) —igual que `.monitoreo_aulas_contar_por_fila()`—
# y cada identificador pertenece a UNA sola fila: la primera que lo declara.
# Sin esa unicidad, dos filas del plan que compartan id contarían la misma
# respuesta dos veces.
.maac_atribucion <- function(plan_df, valid_response, response_classroom) {
  n <- length(response_classroom)
  valid <- if (length(valid_response) == n) valid_response %in% TRUE else rep(TRUE, n)
  fila <- rep(NA_integer_, n)
  if (is.data.frame(plan_df) && nrow(plan_df) && n) {
    aulas <- .maac_chr_col(plan_df, "classroom_id")
    unidades <- .maac_chr_col(plan_df, "collection_unit_id")
    # Tercera clave, igual que el numerador: el QR de 2026 viaja el codigo
    # operativo y un plan sin handoff solo tiene curso-horario en
    # `classroom_id`.
    codigos <- .maac_chr_col(plan_df, "operational_code")
    # Mismo espacio canonico que el numerador del tablero: un identificador
    # tecleado (`ch1`, `R6_1`) pertenece a la misma fila que su QR. Ver
    # `.monitoreo_aulas_clave_colector()`; con claves en colision se compara
    # literal, como siempre.
    if (.monitoreo_aulas_claves_sin_colision(c(aulas, unidades, codigos))) {
      aulas <- .monitoreo_aulas_clave_colector(aulas)
      unidades <- .monitoreo_aulas_clave_colector(unidades)
      codigos <- .monitoreo_aulas_clave_colector(codigos)
      response_classroom <- .monitoreo_aulas_clave_colector(response_classroom)
    }
    idx_aula <- which(nzchar(aulas) & !duplicated(aulas))
    mapa <- stats::setNames(idx_aula, aulas[idx_aula])
    idx_unidad <- which(nzchar(unidades) & !duplicated(unidades) & !(unidades %in% names(mapa)))
    mapa <- c(mapa, stats::setNames(idx_unidad, unidades[idx_unidad]))
    idx_codigo <- which(nzchar(codigos) & !duplicated(codigos) & !(codigos %in% names(mapa)))
    mapa <- c(mapa, stats::setNames(idx_codigo, codigos[idx_codigo]))
    con_id <- nzchar(response_classroom)
    if (any(con_id) && length(mapa)) {
      fila[con_id] <- unname(mapa[response_classroom[con_id]])
    }
  }
  matched <- !is.na(fila)
  # Motivos que sacan la fila del UNIVERSO: el aula no existía o era virtual.
  # Sus válidas no cuentan al cumplimiento, pero JAMÁS se descartan en
  # silencio: viajan en `fuera_universo`.
  motivo <- tolower(.maac_chr_col(plan_df, "replacement_reason"))
  fuera_fila <- motivo %in% c("aula_no_existe", "virtual_no_presencial")
  fac_fila <- .maac_chr_col(plan_df, "faculty")
  fuera <- rep(FALSE, n)
  facultad <- rep("", n)
  if (any(matched)) {
    fuera[matched] <- fuera_fila[fila[matched]]
    facultad[matched] <- fac_fila[fila[matched]]
  }
  data.frame(
    valid = valid, fila = fila, matched = matched,
    fuera = fuera, facultad = facultad,
    stringsAsFactors = FALSE
  )
}

# --- el bloque `avance_cuota` -------------------------------------------------

# SIEMPRE presente en el payload (marco estable): sin plan y sin diseño publica
# ceros declarados, no desaparece. `plan_df` es el plan ENTERO —titulares
# caídos, reservas y banco incluidos: toda respuesta recogida cuenta a su
# facultad—; `tracked_df` (en juego sobre seguidas) solo aporta el denominador
# cuando el bloque degrada a la meta del plan.
.monitoreo_aulas_avance_cuota <- function(plan_df, tracked_df, responses, cfg,
                                          valid_response = logical(0),
                                          response_classroom = character(0),
                                          celdas_sexo = NULL,
                                          # El padrón que traduce un código de
                                          # alumno a su nivel. Sólo lo usa un eje
                                          # con `atribucion = "persona"`; su
                                          # ausencia NO se suple, se declara en
                                          # el aviso del satélite.
                                          padron = NULL) {
  vig <- .monitoreo_aulas_avance_vigencia(cfg)
  atr <- .maac_atribucion(plan_df, valid_response, response_classroom)
  total_validas <- as.integer(sum(atr$valid))

  sex_col <- monitoreo_aulas_columna_sexo(responses, cfg)
  sexo_key <- if (nzchar(sex_col)) monitoreo_aulas_sexo_key(.monitoreo_aulas_values(responses, sex_col, ""), cfg) else character(0)
  if (length(sexo_key) != nrow(atr)) sexo_key <- rep("", nrow(atr))

  # **A qué celda va cada respuesta lo decide el EJE, no este bloque.**
  #
  # La cuenta vivía aquí: la clave era `.maac_fac_key(atr$facultad)` y el
  # numerador `válida & con aula & dentro de universo`. Con el eje declarable eso
  # deja de valer para un estudio cuyas metas son por NIVEL: el aula no sabe el
  # nivel de cada alumno —el marco lo colapsó a su moda— así que el valor sale de
  # la persona, y con él aparecen dos bolsas que antes no existían (`sin_eje` y
  # `duplicadas`). La regla, su orden normativo y su invariante viven en
  # `monitoreo_aulas_eje_atribucion.R`; aquí sólo se consume.
  #
  # **Con el eje en facultad esto es idéntico byte a byte**: el satélite lee el
  # valor de la fila del plan, no deduplica, y su `cuenta` es literalmente la
  # máscara de antes. Su prueba es de identidad, no de plausibilidad.
  eje <- monitoreo_aulas_eje(cfg)
  eje_atr <- monitoreo_aulas_eje_atribucion(
    atr, plan_df = plan_df, responses = responses, cfg = cfg, eje = eje,
    padron = padron)
  fk_resp <- eje_atr$clave
  cuenta <- eje_atr$cuenta
  contar <- function(mask) {
    if (!any(mask)) return(integer(0))
    tabla <- table(fk_resp[mask])
    stats::setNames(as.integer(tabla), names(tabla))
  }
  num_k <- contar(cuenta)
  fuera_k <- contar(eje_atr$fuera)
  sin_sexo_k <- contar(cuenta & sexo_key == "")
  # Las tres bolsas del bloque. `fuera_universo` y `huerfanas` conservan su
  # significado —son del AULA y no cambian con el eje, que es la cláusula que
  # hace que el ADR 0088 aplique el 0079 en vez de contradecirlo—; `sin_eje` y
  # `duplicadas` sólo existen cuando el eje se resuelve por persona.
  huerfanas <- as.integer(sum(eje_atr$huerfana))
  sin_eje_k <- contar(eje_atr$sin_eje)
  duplicadas_k <- contar(eje_atr$duplicada)

  # La columna del eje en el plan y en las seguidas, por alias: ninguna capa
  # debería saber si mira `faculty` o `level`.
  col_plan <- monitoreo_aulas_columna_eje(plan_df, eje)
  val_plan <- if (nzchar(col_plan)) .maac_chr_col(plan_df, col_plan) else character(0)
  if (!length(val_plan)) val_plan <- rep("", if (is.data.frame(plan_df)) nrow(plan_df) else 0L)
  fk_plan <- .maac_eje_key(val_plan, eje)
  primeras <- !duplicated(fk_plan)
  labels_plan <- stats::setNames(val_plan[primeras], fk_plan[primeras])
  claves_plan <- fk_plan[primeras]

  col_tracked <- monitoreo_aulas_columna_eje(tracked_df, eje)
  val_tracked <- if (nzchar(col_tracked)) .maac_chr_col(tracked_df, col_tracked) else character(0)
  fk_tracked <- .maac_eje_key(val_tracked, eje)
  ev <- .maac_num_col(tracked_df, "expected_valid")
  ev[!is.finite(ev) | ev < 0] <- 0
  denom_plan <- if (length(fk_tracked)) tapply(ev, fk_tracked, sum) else numeric(0)

  centinela <- paste0("sin_", .monitoreo_scalar(eje$clave, "facultad"))
  etiqueta_sin <- .monitoreo_scalar(eje$etiqueta_sin, "Sin facultad")
  etiqueta_plan <- function(k) {
    lbl <- .maac_toma_chr(labels_plan, k)
    if (nzchar(lbl)) lbl else if (identical(k, centinela)) etiqueta_sin else k
  }

  filas <- list()
  if (identical(vig$fuente, "design_targets")) {
    vistas <- character(0)
    for (f in vig$facultades) {
      k <- .monitoreo_scalar(f$faculty_key, "")
      if (!nzchar(k)) k <- .cm_criterios_fac_key(.monitoreo_scalar(f$facultad, ""))
      if (!nzchar(k) || k %in% vistas) next
      vistas <- c(vistas, k)
      cuota <- .monitoreo_num(f$cuota, NA_real_)
      con_cuota <- is.finite(cuota)
      filas[[length(filas) + 1L]] <- list(
        facultad = {
          lbl <- .maac_toma_chr(labels_plan, k)
          if (nzchar(lbl)) lbl else .monitoreo_scalar(f$facultad, k)
        },
        faculty_key = k,
        cuota = if (con_cuota) cuota else NA_real_,
        # La τ que dimensionó ESTA facultad. El agregado `tasa_esperada` queda
        # en NA cuando las τ difieren —el motor se niega a promediar quince
        # tasas que el diseño trazó por separado— y eso es justo cuando hace
        # falta: en HSVG2026 van de 0,409 a 0,800. Por fila no hay promedio que
        # esconder. Consumidor: el seguimiento de τ del ADR 0082.
        tau_prevista = .monitoreo_num(f$tau, NA_real_),
        respuestas_validas = .maac_toma_int(num_k, k),
        # Una facultad del diseño sin cuota legible no gana denominador
        # inventado: se declara `sin_cuota` igual que una fuera del diseño.
        fuente_fila = if (con_cuota) "diseno" else "sin_cuota",
        estado = if (!con_cuota) "sin_cuota"
                 else if (k %in% claves_plan) "ok"
                 else "sin_aulas_en_plan",
        fuera_universo = .maac_toma_int(fuera_k, k),
        respuestas_sin_sexo = .maac_toma_int(sin_sexo_k, k)
      )
    }
    # Valores del plan que el diseño no trazó: sus respuestas se publican pero
    # NO entran al % global — inventarles denominador sería peor.
    #
    # **Y sólo cuando el eje se atribuye por AULA.** Con `atribucion = "persona"`
    # la columna del plan no habla de la población del eje: es una propiedad del
    # aula —su nivel MODAL, que el marco calculó para dimensionar— y ninguna
    # respuesta puede caer ahí, porque el valor lo pone el padrón.
    #
    # Medido armando el simulacro de CCSS Perfil 2026-II: el diseño declara los
    # niveles 6 a 9 y el plan trae además aulas de nivel modal 5 y 10, así que la
    # tabla salía con **seis filas y no cuatro**, dos de ellas con cuota `NA` y
    # cero respuestas para siempre. Dos filas vacías que nunca se llenan se leen
    # como un hueco del operativo, y no lo son.
    for (k in if (identical(.monitoreo_scalar(eje$atribucion, "aula"), "aula")) claves_plan else character(0)) {
      if (k %in% vistas) next
      filas[[length(filas) + 1L]] <- list(
        facultad = etiqueta_plan(k), faculty_key = k, cuota = NA_real_,
        # El diseño no trazó esta facultad: no le supuso τ tampoco.
        tau_prevista = NA_real_,
        respuestas_validas = .maac_toma_int(num_k, k),
        fuente_fila = "sin_cuota", estado = "sin_cuota",
        fuera_universo = .maac_toma_int(fuera_k, k),
        respuestas_sin_sexo = .maac_toma_int(sin_sexo_k, k)
      )
    }
    cuota_total <- .monitoreo_num(vig$dt$total_cuota, NA_real_)
    num_total <- sum(vapply(filas, function(x) {
      if (is.finite(x$cuota %||% NA_real_)) as.numeric(x$respuestas_validas) else 0
    }, numeric(1)))
  } else {
    for (k in claves_plan) {
      filas[[length(filas) + 1L]] <- list(
        facultad = etiqueta_plan(k), faculty_key = k,
        cuota = .maac_toma_num(denom_plan, k, 0),
        # Con el denominador del plan no hay τ del diseño vigente que publicar:
        # declararla aquí sería atribuirle al diseño una cifra que el bloque
        # acaba de declarar no vigente.
        tau_prevista = NA_real_,
        respuestas_validas = .maac_toma_int(num_k, k),
        fuente_fila = "plan", estado = "ok",
        fuera_universo = .maac_toma_int(fuera_k, k),
        respuestas_sin_sexo = .maac_toma_int(sin_sexo_k, k)
      )
    }
    cuota_total <- sum(vapply(filas, function(x) x$cuota, numeric(1)))
    num_total <- sum(vapply(filas, function(x) as.numeric(x$respuestas_validas), numeric(1)))
  }

  # **La brecha es la SUMA DE LAS CELDAS, no la resta del total.**
  #
  # Un hombre de mas no cubre a una mujer que falta. La doctrina ya estaba
  # escrita y aplicada en `avance_por_facultad`
  # (`monitoreo_aulas_universitarias.R` ~1936, con el caso observado de
  # GASTRONOMIA) y NUNCA se propago hasta aqui: las dos estructuras viajan en el
  # mismo payload y se pintan en la misma seccion de Avance con reglas
  # distintas.
  #
  # Medido sobre HSVG2026 «como 2025»: `avance_por_facultad` publicaba 17, 4 y 3
  # de brecha para ARQUITECTURA, CIENCIAS E INGENIERIA y EDUCACION, mientras
  # `avance_cuota` publicaba CERO para las tres y su panel las contaba entre las
  # «cumplidas» — Arquitectura con 126 de 125 y diecisiete mujeres pendientes.
  #
  # `NULL` o sin celdas para esa facultad cae a la resta simple, igual que hace
  # el vecino: una facultad sin desglose de sexo no tiene celdas que sumar, y
  # fabricarle una brecha de cero seria peor que la resta.
  # A4: las celdas de sexo de cada facultad; la regla de la brecha (ADR 0079)
  # vive en `monitoreo_aulas_brecha_facultad()`, compartida con el libro.
  celdas_de <- local({
    if (!length(celdas_sexo)) return(function(k) list())
    keys <- vapply(celdas_sexo, function(c) {
      .cm_criterios_fac_key(.monitoreo_scalar(c$faculty, ""))
    }, character(1))
    function(k) celdas_sexo[keys == k]
  })

  filas <- lapply(filas, function(x) {
    cuota <- x$cuota
    if (is.finite(cuota)) {
      x$brecha <- monitoreo_aulas_brecha_facultad(
        cuota, x$respuestas_validas, celdas_de(.monitoreo_scalar(x$faculty_key, ""))
      )
      # `> 0` y no `>= 0`: una cuota en cero no es una meta cumplida, es una
      # meta sin denominador — NA y no Inf. El avance por encima de 100 se
      # publica SIN cap: pasarse de la cuota es un hecho, no un error.
      x$avance_pct <- if (cuota > 0) round(100 * x$respuestas_validas / cuota, 1) else NA_real_
    } else {
      x$brecha <- NA_real_
      x$avance_pct <- NA_real_
    }
    x[c("facultad", "faculty_key", "cuota", "tau_prevista",
        "respuestas_validas", "brecha", "avance_pct", "fuente_fila", "estado",
        "fuera_universo", "respuestas_sin_sexo")]
  })
  if (!identical(vig$fuente, "design_targets") && length(filas) > 1L) {
    # Con denominador del plan, el orden es el de `avance_por_facultad`: la que
    # más lejos está de su meta primero. Con diseño, manda el orden del diseño.
    b <- vapply(filas, function(x) if (is.finite(x$brecha)) x$brecha else 0, numeric(1))
    nm <- vapply(filas, function(x) x$facultad, character(1))
    filas <- filas[order(-b, nm)]
  }

  total <- list(
    cuota = if (is.finite(cuota_total)) cuota_total else NA_real_,
    respuestas_validas = as.integer(num_total),
    # **Las partes suman el total.** Restar el total por su lado publicaba
    # «cero faltan» arriba con 17, 4 y 3 en tres filas de abajo: quien suma la
    # columna no llega nunca a la cifra de la cabecera.
    brecha = if (is.finite(cuota_total)) {
      b <- vapply(filas, function(x) .monitoreo_num(x$brecha, NA_real_), numeric(1))
      if (all(is.na(b))) max(0, cuota_total - num_total) else sum(b, na.rm = TRUE)
    } else NA_real_,
    avance_pct = if (is.finite(cuota_total) && cuota_total > 0) {
      round(100 * num_total / cuota_total, 1)
    } else NA_real_,
    fuera_universo = as.integer(sum(eje_atr$fuera)),
    # Las huérfanas nunca entran a ninguna celda; se declaran aquí, no se
    # descartan.
    huerfanas = huerfanas,
    # **Las dos bolsas que el eje por persona añade, y su invariante.**
    #
    # `sin_eje` son válidas que pasaron el paso del aula y cuya PERSONA no
    # resuelve —sin código, ilegible, o no está en el padrón—: el estudio decidió
    # que sin cruce no hay nivel y no cuentan para ninguna celda. `duplicadas`
    # son segundas respuestas de la misma persona dentro de su celda; se marcan y
    # se publican, porque la cuota es de personas y una cifra que baja sin
    # explicación es peor que una cifra con su nota.
    #
    # Con el eje en facultad las dos son **0** y el invariante se reduce al de
    # siempre. Se publican igual: un cero declarado dice «esto se midió», y su
    # ausencia obligaría al lector a adivinar si la bolsa no existe o está vacía.
    sin_eje = as.integer(sum(eje_atr$sin_eje)),
    duplicadas = as.integer(sum(eje_atr$duplicada)),
    # `respuestas_validas = Σ celdas + duplicados + sin_eje + fuera_universo +
    # huerfanas`, comprobado por la misma función que lo comprueban sus pruebas:
    # un invariante que sólo se verifica en el test se queda en el test.
    invariante = monitoreo_aulas_eje_invariante(eje_atr, total_validas)
  )

  list(
    schema = "monitoreo_aulas_avance_cuota_v1",
    fuente = vig$fuente,
    vigencia = vig$vigencia,
    motivo = vig$motivo,
    # **De qué son estas celdas.** El bloque publica `facultades` con su
    # `facultad` y su `faculty_key` —nombres del contrato congelado (ADR 0079),
    # que no se renombran— y con el eje declarable esos valores pueden ser
    # niveles. Sin esta declaración, el mismo payload significa dos cosas
    # distintas y el consumidor tiene que adivinar cuál: un contrato viejo sin
    # `eje` se lee como `facultad`, que es lo que es.
    eje = monitoreo_aulas_eje_declaracion(eje),
    # **Sexo y carrera, descriptivos y en su propio bloque.** No entran a las
    # celdas ni a la brecha: la cuota es por el eje (decisión 2 del plan). Se
    # calculan aquí —en el MOTOR— porque el payload del estado recorta
    # `quotas$category_profiles` y un panel que la lea desde React vería
    # `undefined` en un estudio real.
    composicion = monitoreo_aulas_composicion_referencial(
      cfg, resueltas = attr(eje_atr, "resueltas"), cuenta = eje_atr$cuenta),
    tasa_esperada = if (length(vig$facultades)) .monitoreo_num(vig$dt$tasa_esperada, NA_real_) else NA_real_,
    tasa_fuente = if (length(vig$facultades)) .monitoreo_scalar(vig$dt$tasa_fuente, "") else "",
    # **La meta y su sobremuestra, que el diseño calcula y no llegaban.**
    #
    # El operativo compara el avance contra DOS cifras: la meta -lo que hay que
    # conseguir- y la sobremuestra -hasta dónde se compró aforo-. La segunda
    # vivía en `componente$resultado` del estudio y moría ahí, así que la tabla
    # de cuotas sólo podía comparar contra la primera y lo declaraba en su pie.
    #
    # Viajan por el mismo bloque que las metas por facultad y con su misma
    # vigencia: si el sello no cuadra, no se publican, porque una sobremuestra
    # de otro sorteo es peor que ninguna.
    meta_diseno = if (length(vig$facultades)) .monitoreo_num(vig$dt$meta_diseno, NA_real_) else NA_real_,
    sobremuestra = if (length(vig$facultades)) .monitoreo_num(vig$dt$sobremuestra, NA_real_) else NA_real_,
    meta_operativa = if (length(vig$facultades)) .monitoreo_num(vig$dt$meta_operativa, NA_real_) else NA_real_,
    total = total,
    facultades = filas
  )
}

# --- targets de sexo: manda el diseño -----------------------------------------

# Overlay sobre el fallback vigente (marco -> plan_sex_top): cuando el bloque
# de metas está vigente y trae `cuota_sexo`, los targets por facultad salen de
# ahí con `source = "design_cuota_sexo"`. Una facultad cuyo desglose no cuadra
# con su cuota (|F+M - cuota| > 1) está corrupta: degrada a su fila de fallback
# con `warning` declarado — no se publica como certificada.
.monitoreo_aulas_sexo_targets_con_diseno <- function(plan_df, cfg, fallback) {
  fb <- if (is.data.frame(fallback)) fallback else data.frame(stringsAsFactors = FALSE)
  if (nrow(fb) && !"warning" %in% names(fb)) fb$warning <- ""
  vig <- .monitoreo_aulas_avance_vigencia(cfg)
  if (!identical(vig$fuente, "design_targets")) return(fb)

  fac_plan <- .maac_chr_col(plan_df, "faculty")
  fk_plan <- .cm_criterios_fac_key(fac_plan)
  primeras <- !duplicated(fk_plan) & nzchar(fk_plan)
  labels_plan <- stats::setNames(fac_plan[primeras], fk_plan[primeras])

  design_rows <- list()
  cubiertas <- character(0)
  avisos <- list()
  vistas <- character(0)
  for (f in vig$facultades) {
    k <- .monitoreo_scalar(f$faculty_key, "")
    if (!nzchar(k)) k <- .cm_criterios_fac_key(.monitoreo_scalar(f$facultad, ""))
    if (!nzchar(k) || k %in% vistas) next
    vistas <- c(vistas, k)
    cuota <- .monitoreo_num(f$cuota, NA_real_)
    cs <- if (is.list(f$cuota_sexo)) f$cuota_sexo else list()
    celdas <- list()
    for (sx in c("F", "M")) {
      v <- .monitoreo_num(cs[[sx]], NA_real_)
      if (is.finite(v)) celdas[[sx]] <- round(v)
    }
    # Sin cuota_sexo (o sin cuota contra la que cuadrar) no hay que declarar:
    # el fallback de siempre cubre a esa facultad con su source de siempre.
    if (!length(celdas) || !is.finite(cuota)) next
    etiqueta <- {
      lbl <- .maac_toma_chr(labels_plan, k)
      if (nzchar(lbl)) lbl else .monitoreo_scalar(f$facultad, k)
    }
    suma <- sum(unlist(celdas))
    if (abs(suma - round(cuota)) > 1) {
      avisos[[k]] <- sprintf(
        paste0("La cuota por sexo del diseño de %s no cuadra con su cuota ",
               "(F+M = %d contra %d): esa facultad usa la proyección del marco/plan."),
        etiqueta, as.integer(suma), as.integer(round(cuota))
      )
      next
    }
    for (sx in names(celdas)) {
      design_rows[[length(design_rows) + 1L]] <- data.frame(
        faculty = etiqueta, sex = sx, target = as.integer(celdas[[sx]]),
        source = "design_cuota_sexo", warning = "",
        stringsAsFactors = FALSE
      )
    }
    cubiertas <- c(cubiertas, k)
  }
  if (!length(design_rows) && !length(avisos)) return(fb)
  if (nrow(fb)) {
    fb_keys <- .cm_criterios_fac_key(fb$faculty)
    conserva <- !(fb_keys %in% cubiertas)
    fb <- fb[conserva, , drop = FALSE]
    fb_keys <- fb_keys[conserva]
    if (nrow(fb) && length(avisos)) {
      fb$warning <- vapply(seq_len(nrow(fb)), function(i) {
        k <- fb_keys[[i]]
        if (nzchar(k)) (avisos[[k]] %||% fb$warning[[i]]) else fb$warning[[i]]
      }, character(1))
    }
  }
  des <- if (length(design_rows)) do.call(rbind, design_rows) else NULL
  .maac_rbind_union(des, fb)
}

# rbind con unión de columnas: el fallback del marco trae `frame_n` y las filas
# del diseño no; perder columnas al mezclar sería perder la procedencia.
.maac_rbind_union <- function(a, b) {
  partes <- Filter(function(x) is.data.frame(x) && nrow(x), list(a, b))
  if (!length(partes)) {
    return(if (is.data.frame(b)) b else data.frame(stringsAsFactors = FALSE))
  }
  cols <- unique(unlist(lapply(partes, names)))
  partes <- lapply(partes, function(df) {
    for (col in setdiff(cols, names(df))) {
      df[[col]] <- if (col %in% c("target", "frame_n")) NA_real_ else ""
    }
    df[, cols, drop = FALSE]
  })
  out <- do.call(rbind, partes)
  rownames(out) <- NULL
  out
}

# --- celdas sexo x facultad con atribución unificada --------------------------

# Reemplaza a `.monitoreo_aulas_quota_sex_faculty()` en el tablero. Tres
# diferencias del dictamen: (1) el merge target<->observado va por claves
# NORMALIZADAS (facultad y sexo), no por texto crudo — el "F"/"M" del diseño
# tiene que casar con el "Femenino"/"MASCULINO" de las respuestas—; (2) la
# facultad de una respuesta sale de la MISMA regla que el numerador de
# cumplimiento (el plan manda, la columna de la respuesta solo rellena sin
# match): sin eso F+M no cuadra con el total de la facultad; (3) una respuesta
# fuera de universo no cubre celdas — la cuota por sexo es parte de la misma
# cuota cuyo cumplimiento esa respuesta no puede sumar.
.monitoreo_aulas_cuotas_sexo_celdas <- function(plan_df, tracked_df, responses, cfg,
                                                valid_response, response_classroom) {
  targets <- .monitoreo_aulas_quota_targets(tracked_df, cfg)
  if (!is.data.frame(targets) || !nrow(targets)) return(list())
  targets$fac_key <- .cm_criterios_fac_key(targets$faculty)
  targets$sex_key <- .maac_sexo_key(targets$sex)
  if (!"warning" %in% names(targets)) targets$warning <- ""

  atr <- .maac_atribucion(plan_df, valid_response, response_classroom)
  # La facultad de cada respuesta la resuelve su DUEÑO único:
  # `.monitoreo_aulas_response_faculty_values()` — el plan manda y la columna
  # de la respuesta solo rellena sin match. Duplicar la regla inline aquí fue
  # exactamente el patrón que ya costó tres copias del emparejamiento en este
  # módulo; `atr` solo aporta lo que esa función no dice: validez, match y
  # fuera de universo.
  facultad <- .monitoreo_aulas_response_faculty_values(responses, plan_df, response_classroom)
  if (length(facultad) != nrow(atr)) facultad <- rep("", nrow(atr))
  sex_col <- monitoreo_aulas_columna_sexo(responses, cfg)
  sexo_raw <- if (nzchar(sex_col)) .monitoreo_aulas_values(responses, sex_col, "") else character(0)
  if (length(sexo_raw) != nrow(atr)) sexo_raw <- rep("", nrow(atr))
  sexo_key <- monitoreo_aulas_sexo_key(sexo_raw, cfg)

  keep <- atr$valid & nzchar(facultad) & sexo_key %in% c("F", "M") & !(atr$matched & atr$fuera)

  # **La columna esta y ninguno de sus valores se reconoce.**
  #
  # `.maac_sexo_key()` acepta palabras —«f/fem…/mujer…», «m/masc…/hombre…»— pero
  # una base de Kobo trae lo que el XLSForm guarda como NOMBRE de la opcion, y
  # el instrumento de HSVG2026 usa `1` = Mujer y `2` = Hombre. Con codigos,
  # `sexo_key` sale vacia en TODAS las filas, las treinta celdas quedan a cero y
  # nada falla: la pantalla dice «0 de 30 celdas» y «cuota por recoger 2.500»
  # con mil quinientas respuestas ya atribuidas a su aula.
  #
  # No se adivina que `1` es mujer —otro estudio puede numerarlo al reves y eso
  # seria inventar el dato—: se dice la CAUSA, con los valores que llegaron, para
  # que quien lo lea sepa que hay que declarar la equivalencia y no salga a
  # revisar el enlace del recopilador.
  #
  # Desde el 2026-09-07 esa equivalencia SE PUEDE declarar
  # (`sex_female_values` / `sex_male_values` del mapping) y el aviso lo dice: el
  # aviso que nombra la causa pero no dónde arreglarla deja al lector igual de
  # atascado. En HSVG2026 costó que las treinta celdas de cuota salieran en cero
  # y que la brecha de cada facultad fuera su cuota entera —528 con 27 ya
  # conseguidas— porque la brecha se suma de las celdas.
  aviso_sexo <- ""
  if (nzchar(sex_col) && any(atr$valid) && !any(keep & sexo_key %in% c("F", "M"))) {
    crudos <- unique(trimws(sexo_raw[atr$valid]))
    crudos <- crudos[nzchar(crudos)]
    if (length(crudos)) {
      muestra <- paste(utils::head(sort(crudos), 4L), collapse = ", ")
      aviso_sexo <- sprintf(
        paste0("La columna «%s» trae valores que no se reconocen como sexo (%s%s). ",
               "Una base sin decodificar trae el código de la opción, no la etiqueta. ",
               "Declara en Fuentes qué valores son mujer y cuáles hombre; mientras ",
               "tanto ninguna respuesta cae en su grupo de facultad y sexo, y la ",
               "brecha de cada facultad sale como su cuota entera."),
        sex_col, muestra, if (length(crudos) > 4L) ", …" else ""
      )
    }
  }
  observed <- if (any(keep)) {
    stats::aggregate(
      rep(1L, sum(keep)),
      by = list(fac_key = .cm_criterios_fac_key(facultad[keep]), sex_key = sexo_key[keep]),
      FUN = sum
    )
  } else {
    data.frame(fac_key = character(0), sex_key = character(0), x = integer(0),
               stringsAsFactors = FALSE)
  }
  if (nrow(observed)) names(observed)[names(observed) == "x"] <- "observed"
  if (!"observed" %in% names(observed)) observed$observed <- integer(0)

  out <- merge(targets, observed, by = c("fac_key", "sex_key"), all.x = TRUE, sort = FALSE)
  out$observed[is.na(out$observed)] <- 0L
  out$observed <- as.integer(out$observed)
  target_num <- suppressWarnings(as.numeric(out$target))
  target_num[!is.finite(target_num)] <- 0
  out$target <- as.integer(pmax(0L, round(target_num)))
  out$missing <- as.integer(pmax(0L, out$target - out$observed))
  out$progress_pct <- ifelse(out$target > 0L, round(100 * out$observed / out$target, 1), NA_real_)
  out$status <- ifelse(out$target <= 0L, "sin_meta",
                       ifelse(out$observed >= out$target, "cumplida",
                              ifelse(out$observed > 0L, "en_riesgo", "pendiente")))
  del_diseno <- out$source %in% "design_cuota_sexo"
  if (any(del_diseno)) {
    out$sex[del_diseno] <- vapply(
      out$sex_key[del_diseno], .maac_sexo_etiqueta, character(1),
      observados_raw = sexo_raw[atr$valid], observados_key = sexo_key[atr$valid],
      plan_df = plan_df
    )
  }
  out <- out[order(out$status != "en_riesgo", out$status != "pendiente",
                   -out$missing, out$faculty, out$sex), , drop = FALSE]
  # Las claves del merge son cocina interna, no columnas del contrato: el
  # DataTable de la UI pinta las primeras columnas que llegan (sin
  # preferredColumns, con tope), asi que publicarlas al frente encabezaba la
  # tabla con claves y recortaba missing/progress/status. Se dropean, el
  # `warning` solo viaja cuando dice algo, y el orden queda el del payload de
  # siempre.
  out$fac_key <- NULL
  out$sex_key <- NULL
  if ("warning" %in% names(out)) {
    out$warning[is.na(out$warning)] <- ""
    # El aviso del sexo va en TODAS las filas: el fallo no es de una celda, es
    # de la columna entera, y ponerlo solo en la primera lo escondería en cuanto
    # alguien ordene la tabla por otra cosa.
    if (nzchar(aviso_sexo)) out$warning <- aviso_sexo
    if (!any(nzchar(out$warning))) out$warning <- NULL
  }
  primeras <- intersect(
    c("faculty", "sex", "target", "observed", "missing", "progress_pct", "status", "source"),
    names(out)
  )
  out <- out[, c(primeras, setdiff(names(out), primeras)), drop = FALSE]
  .monitoreo_aulas_records(out, max_rows = 240L)
}

#' Las celdas del EJE, con la forma de las celdas de sexo.
#'
#' El proyector de las tres lecturas (`monitoreo_aulas_avance_sexo_facultad()`)
#' pide celdas `list(faculty, sex, target, observed)`. Cuando el estudio declara
#' cuota por sexo, se las da `.monitoreo_aulas_cuotas_sexo_celdas()`. Cuando NO
#' —la meta es sólo por el eje— no había nada que proyectar y el panel se
#' quedaba vacío teniendo la cuota del estudio en el payload.
#'
#' Aquí se arman a partir de las filas que `avance_cuota` ya publicó: **un grano
#' menos fino, no otra cuenta.** Nada se recalcula, y por eso las cifras del
#' panel no pueden discrepar de las de la tabla.
#'
#' Sólo entran las filas CON cuota finita: una fila `sin_cuota` no tiene contra
#' qué proyectarse, y darle un techo sería inventarle una meta.
#'
#' @param avance_cuota el bloque ya calculado.
#' @return lista de celdas, con `grano = "eje"` para que la UI sepa que no hay
#'   dimensión de sexo —que es distinto de no conocerla— y no rotule
#'   «Sin sexo declarado» donde no hay sexo que declarar.
#' @keywords internal
.monitoreo_aulas_celdas_del_eje <- function(avance_cuota = list()) {
  filas <- (avance_cuota %||% list())[["facultades"]] %||% list()
  out <- list()
  for (f in filas) {
    if (!is.list(f)) next
    cuota <- suppressWarnings(as.numeric(f[["cuota"]] %||% NA_real_))[1]
    if (!is.finite(cuota) || cuota <= 0) next
    valor <- .monitoreo_scalar(f[["facultad"]] %||% "", "")
    if (!nzchar(valor)) next
    out[[length(out) + 1L]] <- list(
      faculty = valor,
      # Vacío y no "F"/"M": esta celda NO tiene dimensión de sexo. El proyector
      # lo tolera (`toupper("")` es "") y `grano` lo declara para la UI.
      sex = "",
      grano = "eje",
      target = cuota,
      observed = suppressWarnings(as.numeric(f[["respuestas_validas"]] %||% 0))[1]
    )
  }
  out
}
