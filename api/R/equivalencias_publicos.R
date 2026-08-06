# Equivalencia declarada entre públicos (ADR 0062)
# ===============================================
#
# PROBLEMA. En un estudio de bases separadas, la misma pregunta vive en cada
# público con otro nombre de variable: «¿Conoce el servicio de salud?» es
# `p13_1` en docentes, `p11_1` en estudiantes, `p18_1` en egresados y `p10_1` en
# administrativos. El modelo no tenía dónde guardar esa tabla, así que comparar
# públicos dependía de la memoria del analista frente a un selector que además
# muestra la misma etiqueta —«Servicio de salud»— para tres preguntas distintas.
#
# Medido: en el PPT entregado de Acreditación Contabilidad, un grupo comparaba
# «¿Conoce bienestar psicológico?» de docentes contra «¿Ha utilizado bienestar
# psicológico?» de estudiantes, 90 % contra 31 %, bajo un título que no nombraba
# a ninguna de las dos. El guard de escalas no podía verlo: ambas son Sí/No.
#
# DISEÑO. Una fila por pregunta del estudio; por cada base, el nombre de su
# variable; y una `etiqueta_estandar` curada por el analista. Lo que la app puede
# calcular —en cuántos públicos existe la pregunta— no se le pide.
#
# Este archivo es el motor puro: lee, normaliza y sella. No conoce la sesión ni
# el HTTP; el router y la pestaña lo llaman.

# Nombres de columna de la plantilla, en su forma canónica. Se comparan
# normalizados (sin tildes, minúsculas) para que un Excel editado a mano con
# «Sección» o «SECCION» siga entrando.
.EQUIV_COL_SECCION <- "seccion"
.EQUIV_COL_ETIQUETA <- "etiqueta_estandar"
.EQUIV_SUFIJO_ETIQUETA <- "_etiqueta"
# ADR 0062: la matriz real del equipo ya traia una columna `Diapo` con el plan
# del informe —133 de 154 filas asignadas a 44 diapositivas, 42 de ellas con mas
# de una pregunta—. Declararla aqui es lo que permite que Graficos derive el
# mazo en vez de armarlo diapositiva por diapositiva.
.EQUIV_COL_DIAPOSITIVA <- "diapositiva"
# ADR 0064: el enunciado de la diapositiva. Es el texto que el importador de matrices
# de SurveyMonkey pierde al aplanar el grupo en sus temas, y el que titula la
# diapositiva del mazo. Vive por FILA en el formato plano —el Excel no tiene donde
# poner un atributo de grupo— y la diapositiva toma el primero no vacio de las suyas.
.EQUIV_COL_ENUNCIADO <- "enunciado"
# ADR 0064: de donde viene la fila. `propuesta` marca lo que calculo el motor y
# nadie ha confirmado todavia. La columna es lo que permite sembrar la plantilla
# con emparejados sin violar la prohibicion del ADR 0062 —dentro de un Excel una
# sugerencia era indistinguible de una decision—: aqui se distingue, viaja
# marcada de ida y de vuelta, y no surte efecto hasta confirmarse.
.EQUIV_COL_ORIGEN <- "origen"
.EQUIV_ORIGEN_PROPUESTA <- "propuesta"

# Normaliza un encabezado a su forma comparable: minúsculas, sin tildes, sin
# espacios ni signos. «Etiqueta estándar», «ETIQUETA_ESTANDAR» y «etiqueta
# estandar» son el mismo encabezado.
#
# Las tildes se quitan con `chartr` y no con `iconv(to = "ASCII//TRANSLIT")`:
# TRANSLIT depende de la implementación de iconv del sistema y en macOS devuelve
# «Seccio'n» en vez de «Seccion», así que la columna «Sección» de las matrices
# reales no se reconocía y el estudio quedaba sin secciones sin decir por qué.
.equiv_norm_col <- function(x) {
  x <- as.character(x %||% "")
  x[is.na(x)] <- ""
  # Sufijo de desambiguación de readxl (`.name_repair = "unique"`). Las matrices
  # reales repiten el nombre del público en dos bloques —el de variables y el de
  # ayuda «Variable labels»—, así que readxl entrega `Docentes...2` y
  # `Docentes...12`. Sin quitarlo, NINGUNA columna normalizaba a «docentes» y la
  # matriz del equipo rebotaba entera con E_EQUIV_SIN_COLUMNAS_BASE.
  x <- sub("\\.\\.\\.[0-9]+$", "", x)
  x <- chartr("áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ",
              "aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC", x)
  x <- tolower(x)
  x <- gsub("[^a-z0-9]+", "_", x)
  gsub("^_+|_+$", "", x)
}

# Rellena hacia abajo. Las matrices reales traen la sección en celdas
# combinadas, así que sólo la primera fila del bloque la tiene: leída con
# readxl, el resto llega NA. Sin este pase, 141 de 154 filas quedarían sin
# sección.
.equiv_fill_down <- function(x) {
  x <- as.character(x)
  ultimo <- NA_character_
  for (i in seq_along(x)) {
    if (!is.na(x[i]) && nzchar(trimws(x[i]))) {
      ultimo <- trimws(x[i])
    } else {
      x[i] <- ultimo
    }
  }
  x
}

# Nombre canónico de una variable dentro de la app. Acepta la forma cruda de la
# plataforma (`q0013_0001`) además de la ya canónica (`p13_1`): las matrices que
# los equipos escriben nacen contra el export de SurveyMonkey, y exigir la forma
# canónica invalidaría el trabajo que ya tienen hecho. Reusa la regla del
# normalizador (`.dn_q_to_p_name`) para que no haya dos traducciones distintas.
.equiv_var_canonica <- function(x) {
  x <- trimws(as.character(x %||% ""))
  if (!nzchar(x) || is.na(x)) return("")
  if (exists(".dn_q_to_p_name", mode = "function")) {
    p <- .dn_q_to_p_name(x)
    if (!is.na(p) && nzchar(p)) return(p)
  }
  x
}

# Huella del instrumento de una base: el conjunto ordenado de sus nombres de
# variable. Es lo que permite decir «esta declaración se validó contra OTRO
# instrumento» en vez de seguir aplicando en silencio una correspondencia que
# pudo dejar de ser cierta. Un artefacto externo y manual no avisa de su propio
# desfase; el sello es lo que lo vuelve verificable.
.equiv_sello_instrumento <- function(inst) {
  sv <- (inst %||% list())$survey
  if (is.null(sv) || !nrow(sv) || !"name" %in% names(sv)) return("")
  tipos <- if ("type" %in% names(sv)) as.character(sv$type) else rep("", nrow(sv))
  estructurales <- c("begin_group", "end_group", "begin_repeat", "end_repeat", "note")
  nombres <- as.character(sv$name)[!sub("\\s+.*$", "", trimws(tipos)) %in% estructurales]
  nombres <- sort(unique(nombres[!is.na(nombres) & nzchar(nombres)]))
  if (!length(nombres)) return("")
  paste0(length(nombres), ":", .equiv_hash_estable(nombres))
}

# Hash estable sin dependencia nueva: `digest` no está en DESCRIPTION y el sello
# no necesita resistencia criptográfica, sólo detectar que el conjunto cambió.
#
# La aritmética va en `double` y no en `integer`: `h * 33L` desborda el entero
# de R a las pocas iteraciones y devuelve NA con warning, así que el sello salía
# vacío justo cuando más falta hace — un sello que no distingue nada deja pasar
# el desfase que existe para detectar. Un double representa enteros exactos
# hasta 2^53 y aquí nunca pasamos de 2^31 x 33.
.equiv_hash_estable <- function(x) {
  # Separador explícito entre elementos: sin él, c("ab","c") y c("a","bc")
  # producirían el mismo hash y dos instrumentos distintos parecerían iguales.
  bytes <- as.integer(charToRaw(paste(x, collapse = "\u001f")))
  m <- 2147483647   # 2^31 - 1
  h1 <- 5381
  h2 <- 52711
  for (b in bytes) {
    h1 <- (h1 * 33 + b) %% m
    h2 <- (h2 * 31 + b) %% m
  }
  sprintf("%08x%08x", as.integer(h1), as.integer(h2))
}

# Lee un data.frame ya cargado (hoja de la plantilla) y devuelve la declaración
# normalizada. Separado de la lectura del archivo para poder probarlo sin xlsx.
#
# `bases` es el vector de nombres de base del estudio: define qué columnas se
# buscan y en qué orden viaja la equivalencia. Una columna de la plantilla que no
# corresponda a ninguna base se ignora — así la matriz real, que trae columnas de
# ayuda («Diapo», concatenados, iniciales), entra sin limpiarla a mano.
.equiv_desde_df <- function(df, bases) {
  bases <- as.character(bases %||% character(0))
  if (!length(bases)) {
    stop_api(400, "E_EQUIV_SIN_BASES",
             "El estudio no declara bases contra las que mapear la matriz.")
  }
  if (is.null(df) || !nrow(df)) {
    stop_api(400, "E_EQUIV_VACIA", "La matriz de equivalencias no tiene filas.")
  }

  cols <- .equiv_norm_col(names(df))
  idx_de <- function(clave) {
    hit <- which(cols == clave)
    if (length(hit)) hit[1] else NA_integer_
  }

  i_etiqueta <- idx_de(.EQUIV_COL_ETIQUETA)
  if (is.na(i_etiqueta)) {
    stop_api(400, "E_EQUIV_SIN_ETIQUETA",
             sprintf("La matriz no trae la columna '%s'.", .EQUIV_COL_ETIQUETA))
  }
  i_seccion <- idx_de(.EQUIV_COL_SECCION)

  # Columna de variable por base. La columna de etiqueta por base
  # (`<base>_etiqueta`) es ayuda de lectura para el analista y no entra: la
  # etiqueta que manda es la estándar.
  # Retirado el sufijo de readxl, el nombre de un público puede resolver a MÁS de
  # una columna: la matriz real trae el bloque de variables y el de ayuda
  # «Variable labels», ambos titulados con el público. Se elige por CONTENIDO —un
  # nombre de variable no lleva espacios y la columna de ayuda es
  # `q0013_0001 '¿Conoce…'`— y no por posición, que sería un supuesto sobre cómo
  # alguien ordenó su Excel.
  idx_de_base <- function(clave) {
    hit <- which(cols == clave)
    if (!length(hit)) return(NA_integer_)
    if (length(hit) == 1L) return(hit[1])
    puntaje <- vapply(hit, function(j) {
      v <- trimws(as.character(df[[j]]))
      v <- v[!is.na(v) & nzchar(v)]
      if (!length(v)) return(0)
      mean(!grepl("\\s", v))
    }, numeric(1))
    hit[which.max(puntaje)]
  }

  bases_norm <- .equiv_norm_col(bases)
  i_base <- stats::setNames(vapply(bases_norm, idx_de_base, integer(1)), bases)
  presentes <- bases[!is.na(i_base)]
  if (!length(presentes)) {
    stop_api(400, "E_EQUIV_SIN_COLUMNAS_BASE",
             sprintf("La matriz no trae ninguna columna con el nombre de una base del estudio (%s).",
                     paste(bases, collapse = ", ")))
  }

  i_diapo <- idx_de(.EQUIV_COL_DIAPOSITIVA)
  # «Diapo» es como la llaman las matrices ya escritas; aceptarla evita pedirle
  # al equipo que renombre una columna para que la app la lea.
  if (is.na(i_diapo)) i_diapo <- idx_de("diapo")

  i_enunciado <- idx_de(.EQUIV_COL_ENUNCIADO)
  i_origen <- idx_de(.EQUIV_COL_ORIGEN)
  origen <- if (!is.na(i_origen)) .equiv_norm_col(df[[i_origen]]) else rep("", nrow(df))

  seccion <- if (!is.na(i_seccion)) .equiv_fill_down(df[[i_seccion]]) else rep(NA_character_, nrow(df))
  etiqueta <- trimws(as.character(df[[i_etiqueta]]))
  diapo <- if (!is.na(i_diapo)) trimws(as.character(df[[i_diapo]])) else rep(NA_character_, nrow(df))
  # Igual que la sección, el enunciado vive en celdas combinadas: es un atributo
  # de la diapositiva escrito una vez sobre su bloque de filas.
  enunciado <- if (!is.na(i_enunciado)) .equiv_fill_down(df[[i_enunciado]]) else rep(NA_character_, nrow(df))

  filas <- list()
  for (r in seq_len(nrow(df))) {
    vars <- list()
    for (b in presentes) {
      v <- .equiv_var_canonica(df[[i_base[[b]]]][r])
      if (nzchar(v)) vars[[b]] <- v
    }
    # Una fila sin ninguna variable es una separadora del Excel, no un dato.
    if (!length(vars)) next
    lab <- if (is.na(etiqueta[r])) "" else etiqueta[r]
    fila <- list(
      seccion = if (is.na(seccion[r])) "" else seccion[r],
      etiqueta_estandar = lab,
      variables = vars,
      diapositiva = if (is.na(diapo[r])) "" else diapo[r],
      enunciado = if (is.na(enunciado[r])) "" else enunciado[r],
      # Derivado, no pedido: en cuántos públicos existe la pregunta.
      cantidad = length(vars)
    )
    # Una fila que vuelve marcada como propuesta sigue siendo propuesta: el
    # viaje por el Excel no la convierte en decisión.
    if (identical(origen[r], .EQUIV_ORIGEN_PROPUESTA) || identical(origen[r], "sugerida")) {
      fila$sugerida <- TRUE
    }
    filas[[length(filas) + 1L]] <- fila
  }

  if (!length(filas)) {
    stop_api(400, "E_EQUIV_SIN_FILAS_UTILES",
             "Ninguna fila de la matriz trae variables de las bases del estudio.")
  }

  list(
    schema = "equivalencias_publicos/v1",
    bases = presentes,
    filas = filas,
    n_filas = length(filas),
    n_sin_etiqueta = sum(vapply(filas, function(f) !nzchar(f$etiqueta_estandar), logical(1))),
    n_sugeridas = sum(vapply(filas, function(f) isTRUE(f$sugerida), logical(1)))
  )
}

# Etiquetas por base que la declaración implica: `variable -> etiqueta_estandar`.
# Es lo que el importador escribe en `analitica_config_por_base[[base]]`, NUNCA
# en la config global — escribirla en la global reintroduciría el defecto del
# ADR 0061 a mayor escala (en el estudio medido, 152 etiquetas filtrándose entre
# públicos en vez de 10).
.equiv_variable_labels_por_base <- function(equiv) {
  out <- list()
  for (b in (equiv$bases %||% character(0))) out[[b]] <- list()
  for (fila in (equiv$filas %||% list())) {
    # ADR 0064: una propuesta sin confirmar NO surte efecto. Se conserva —para
    # eso viaja marcada— pero no escribe etiquetas en Analítica: aplicarla seria
    # exactamente tratar una sugerencia como una decisión.
    if (isTRUE(fila$sugerida)) next
    lab <- as.character(fila$etiqueta_estandar %||% "")
    if (!nzchar(lab)) next
    for (b in names(fila$variables %||% list())) {
      out[[b]][[fila$variables[[b]]]] <- lab
    }
  }
  out
}

# Cobertura contra los instrumentos reales: cuántas variables de la declaración
# existen en cada base y cuáles no. Se reporta en vez de fallar — una matriz que
# nombra una variable retirada sigue siendo útil para el resto de sus filas, y
# esconder el desajuste sería peor que mostrarlo.
.equiv_cobertura <- function(equiv, inst_por_base) {
  out <- list()
  for (b in (equiv$bases %||% character(0))) {
    inst <- inst_por_base[[b]]
    sv <- (inst %||% list())$survey
    reales <- if (!is.null(sv) && "name" %in% names(sv)) as.character(sv$name) else character(0)
    reales <- reales[!is.na(reales) & nzchar(reales)]
    declaradas <- unique(unlist(lapply(equiv$filas, function(f) f$variables[[b]] %||% NULL)))
    declaradas <- declaradas[!is.na(declaradas) & nzchar(declaradas)]
    huerfanas <- setdiff(declaradas, reales)
    out[[b]] <- list(
      n_declaradas = length(declaradas),
      n_calzan = length(intersect(declaradas, reales)),
      huerfanas = as.character(huerfanas),
      sello = .equiv_sello_instrumento(inst)
    )
  }
  out
}

# -----------------------------------------------------------------------------
# Plantilla: la app emite el Excel ya poblado
# -----------------------------------------------------------------------------
#
# Generar es la via principal del ADR 0062, no un accesorio de la importacion.
# La app ya sabe, por cada base, sus variables y sus etiquetas: emitir el archivo
# con esas columnas llenas deja al analista solo dos trabajos —emparejar filas y
# escribir la etiqueta estandar— y elimina la deriva entre lo que el Excel trae y
# lo que el importador espera, porque el formato lo produce quien lo consume.
#
# La plantilla sale SEMBRADA (ADR 0064): primero lo ya declarado, despues los
# emparejados que el motor propone —marcados `origen = propuesta`— y al final,
# sin emparejar, una fila por cada variable que no entro en ninguno.
#
# La version anterior emitia 300 filas sueltas frente a las 152 ya emparejadas de
# la matriz que el equipo mantenia a mano: la via «principal» del ADR entregaba el
# peor de los dos artefactos. La prohibicion del ADR 0062 —no inferir dentro de un
# Excel— seguia valiendo por su motivo real: ahi una sugerencia era
# INDISTINGUIBLE de una decision. La columna `origen` es lo que la distingue, de
# ida y de vuelta, y ninguna propuesta escribe etiquetas ni llega al mazo hasta
# confirmarse.

.EQUIV_HOJA_PLANTILLA <- "Equivalencias"

# Variables reales de un instrumento, con su etiqueta, en el orden del formulario.
.equiv_variables_de_base <- function(inst) {
  sv <- (inst %||% list())$survey
  if (is.null(sv) || !nrow(sv) || !"name" %in% names(sv)) {
    return(data.frame(name = character(0), label = character(0), seccion = character(0),
                      stringsAsFactors = FALSE))
  }
  tipos <- if ("type" %in% names(sv)) as.character(sv$type) else rep("", nrow(sv))
  base_tipo <- sub("\\s+.*$", "", trimws(tipos))
  estructurales <- c("begin_group", "end_group", "begin_repeat", "end_repeat", "note")
  keep <- !base_tipo %in% estructurales
  nombres <- as.character(sv$name)[keep]
  etiquetas <- if ("label" %in% names(sv)) as.character(sv$label)[keep] else rep("", sum(keep))
  secciones <- if ("section" %in% names(sv)) as.character(sv$section)[keep] else rep("", sum(keep))
  ok <- !is.na(nombres) & nzchar(nombres)
  data.frame(
    name = nombres[ok],
    label = ifelse(is.na(etiquetas[ok]), "", etiquetas[ok]),
    seccion = ifelse(is.na(secciones[ok]), "", secciones[ok]),
    stringsAsFactors = FALSE
  )
}

# Data frame de la plantilla. Separado del escritor de xlsx para poder probar la
# forma sin depender de openxlsx.
.equiv_plantilla_df <- function(inst_por_base, equiv = NULL, propuestas = NULL) {
  bases <- names(inst_por_base %||% list())
  if (!length(bases)) {
    stop_api(400, "E_EQUIV_SIN_BASES",
             "El estudio no declara bases con las que armar la plantilla.")
  }

  cols <- list()
  cols[[.EQUIV_COL_ORIGEN]] <- character(0)
  cols[[.EQUIV_COL_SECCION]] <- character(0)
  cols[[.EQUIV_COL_DIAPOSITIVA]] <- character(0)
  # El enunciado se emite junto a la diapositiva, no al final: son el par que la
  # describe, y separarlos obligaría a leer el Excel de izquierda a derecha dos
  # veces. Sin esta columna la ida y vuelta perdería el texto al reexportar.
  cols[[.EQUIV_COL_ENUNCIADO]] <- character(0)
  cols[[.EQUIV_COL_ETIQUETA]] <- character(0)
  for (b in bases) {
    cols[[b]] <- character(0)
    cols[[paste0(b, .EQUIV_SUFIJO_ETIQUETA)]] <- character(0)
  }

  filas <- list()

  # 1) Lo ya declarado se emite primero y en su orden: reabrir la plantilla no
  #    puede desordenar el trabajo hecho ni obligar a rehacerlo.
  ya_mapeadas <- stats::setNames(vector("list", length(bases)), bases)
  # El catálogo por base se resuelve UNA vez. Antes se recalculaba dentro del
  # bucle de filas y por cada base: sobre el estudio medido eran 152 x 4 lecturas
  # completas del instrumento para emitir un archivo.
  vars_por_base <- lapply(inst_por_base, .equiv_variables_de_base)

  emitir <- function(f, origen) {
    fila <- list()
    fila[[.EQUIV_COL_ORIGEN]] <- origen
    fila[[.EQUIV_COL_SECCION]] <- as.character(f$seccion %||% "")
    fila[[.EQUIV_COL_DIAPOSITIVA]] <- as.character(f$diapositiva %||% "")
    fila[[.EQUIV_COL_ENUNCIADO]] <- as.character(f$enunciado %||% "")
    fila[[.EQUIV_COL_ETIQUETA]] <- as.character(f$etiqueta_estandar %||% "")
    for (b in bases) {
      v <- as.character((f$variables %||% list())[[b]] %||% "")
      fila[[b]] <- v
      lab <- ""
      if (nzchar(v)) {
        vars_b <- vars_por_base[[b]]
        hit <- which(vars_b$name == v)
        if (length(hit)) lab <- vars_b$label[hit[1]]
        ya_mapeadas[[b]] <<- c(ya_mapeadas[[b]], v)
      }
      fila[[paste0(b, .EQUIV_SUFIJO_ETIQUETA)]] <- lab
    }
    filas[[length(filas) + 1L]] <<- fila
  }

  # Una fila DECIDE algo si empareja mas de un publico, si le pusieron etiqueta
  # estandar o si le asignaron diapositiva. Una fila con una sola variable, sin
  # etiqueta y sin diapositiva no declara nada: es la misma informacion que «esta
  # variable existe», que ya esta en el instrumento.
  #
  # La distincion no es cosmetica. El proyecto medido tenia guardada la plantilla
  # vacia anterior —300 filas de una variable cada una—, asi que TODA propuesta
  # chocaba contra ellas y la siembra salia con cero emparejados: la funcion
  # nueva no hacia nada justo en el caso para el que se escribio.
  decide <- function(f) {
    length(f$variables %||% list()) > 1L ||
      nzchar(trimws(as.character(f$etiqueta_estandar %||% ""))) ||
      nzchar(trimws(as.character(f$diapositiva %||% "")))
  }

  declaradas <- (equiv %||% list())$filas %||% list()
  decididas <- Filter(decide, declaradas)
  sueltas <- Filter(function(f) !decide(f), declaradas)

  for (f in decididas) {
    emitir(f, if (isTRUE(f$sugerida)) .EQUIV_ORIGEN_PROPUESTA else "")
  }

  # 2) Los emparejados que el motor propone, marcados. Se descarta entera la
  #    propuesta que toque una variable ya DECIDIDA: aceptarla a medias diria ser
  #    la misma pregunta en tres publicos cuando solo dos estan decididos —el
  #    mismo invariante que ya rige en el editor—. Una fila suelta si la absorbe:
  #    no habia nada que perder en ella.
  for (p in (propuestas %||% list())) {
    vars_p <- p$variables %||% list()
    choca <- any(vapply(names(vars_p), function(b) {
      as.character(vars_p[[b]]) %in% (ya_mapeadas[[b]] %||% character(0))
    }, logical(1)))
    if (choca) next
    emitir(p, .EQUIV_ORIGEN_PROPUESTA)
  }

  # 3) Las filas sueltas que ninguna propuesta absorbio, en su orden original.
  for (f in sueltas) {
    vars_f <- f$variables %||% list()
    absorbida <- any(vapply(names(vars_f), function(b) {
      as.character(vars_f[[b]]) %in% (ya_mapeadas[[b]] %||% character(0))
    }, logical(1)))
    if (absorbida) next
    emitir(f, "")
  }

  # 4) Lo que sigue sin aparecer, una fila por variable y por base. El analista
  #    las junta moviendo celdas; la app no adivina cuáles son la misma pregunta.
  for (b in bases) {
    vars_b <- vars_por_base[[b]]
    pendientes <- vars_b[!vars_b$name %in% (ya_mapeadas[[b]] %||% character(0)), , drop = FALSE]
    for (i in seq_len(nrow(pendientes))) {
      fila <- list()
      fila[[.EQUIV_COL_ORIGEN]] <- ""
      fila[[.EQUIV_COL_SECCION]] <- pendientes$seccion[i]
      fila[[.EQUIV_COL_DIAPOSITIVA]] <- ""
      fila[[.EQUIV_COL_ENUNCIADO]] <- ""
      fila[[.EQUIV_COL_ETIQUETA]] <- ""
      for (b2 in bases) {
        fila[[b2]] <- if (identical(b2, b)) pendientes$name[i] else ""
        fila[[paste0(b2, .EQUIV_SUFIJO_ETIQUETA)]] <-
          if (identical(b2, b)) pendientes$label[i] else ""
      }
      filas[[length(filas) + 1L]] <- fila
    }
  }

  if (!length(filas)) {
    return(as.data.frame(cols, stringsAsFactors = FALSE, check.names = FALSE))
  }
  df <- do.call(rbind.data.frame, c(filas, list(stringsAsFactors = FALSE)))
  names(df) <- names(cols)
  rownames(df) <- NULL
  df
}

# -----------------------------------------------------------------------------
# Sugerencia de emparejado (ADR 0062, enmienda del editor)
# -----------------------------------------------------------------------------
#
# El ADR se niega a INFERIR emparejamientos dentro de un Excel, y con razon: ahi
# una sugerencia es indistinguible de una decision y termina en una diapositiva sin
# que nadie lo note. En una herramienta el caso es otro — una sugerencia puede
# verse COMO sugerencia y confirmarse de un clic—, asi que aqui se calculan pero
# viajan marcadas y NUNCA se guardan solas.
#
# La firma que empareja es la terna (etiqueta normalizada, escala, ordinal de
# aparicion). Las dos primeras no bastan en el caso real: en Acreditacion
# Contabilidad «Servicio de salud» con escala Si/No aparece DOS veces por base
# —«¿Conoce?» y «¿Ha utilizado?»— y solo el orden las separa. Con la terna, la
# n-esima aparicion de una base calza con la n-esima de otra, que es exactamente
# como estan construidos los cuestionarios paralelos de un estudio multiactor.

# Firma de escala de una variable: los codigos y etiquetas de su lista, en orden.
# Reusa el mismo criterio que el guard de multi-apiladas del frontend (la FIRMA,
# no el `list_name`): el importador de SurveyMonkey genera un nombre de lista por
# pregunta, asi que los nombres no dicen nada.

# Lista de opciones que gobierna una variable, y el tipo con que se declaró.
# Vive aparte porque la firma (que compara) y el texto legible (que se muestra)
# necesitan la MISMA resolución: si cada una la resolviera por su cuenta, el chip
# podría acabar describiendo una lista distinta de la que se comparó.
.equiv_lista_de <- function(inst, var) {
  sv <- (inst %||% list())$survey
  if (is.null(sv) || !"name" %in% names(sv)) return(list(lista = "", tipo = ""))
  i <- which(as.character(sv$name) == as.character(var))[1]
  if (is.na(i)) return(list(lista = "", tipo = ""))
  tipo <- trimws(as.character((sv$type %||% "")[i]))
  # El instrumento PROCESADO guarda la lista en su propia columna y deja `type`
  # en «select_one» a secas; el crudo la trae pegada («select_one lst_p5»). Sin
  # mirar las dos formas, toda variable de opción única devolvía la misma firma
  # —«libre:select_one»— y la comparación de escalas dejaba de distinguir nada.
  lista <- if ("list_name" %in% names(sv)) trimws(as.character(sv$list_name[i])) else ""
  if (is.na(lista)) lista <- ""
  if (!nzchar(lista)) {
    m <- regmatches(tipo, regexec("^select_(?:one|multiple)\\s+(\\S+)", tipo, perl = TRUE))[[1]]
    lista <- if (length(m) >= 2L) m[2] else ""
  }
  # Una variable numérica no tiene lista propia, pero el render la grafica por su
  # recodificada (`p4` -> `lst_p4_recod`). Mirar sólo la variable devolvía
  # «libre:integer» para todas y la fila pasaba el filtro; luego la diapositiva
  # moría con «no comparten una escala compatible». Medido en Acreditación
  # Contabilidad: «¿Cuántos años tiene?» tiene rangos DISTINTOS por público
  # —docentes 18-51+, egresados 22-36+—, así que la divergencia es real y la
  # fila tiene que reportarse, no graficarse.
  if (!nzchar(lista)) {
    j <- which(as.character(sv$name) == paste0(as.character(var), "_recod"))[1]
    if (!is.na(j) && "list_name" %in% names(sv)) {
      lr <- trimws(as.character(sv$list_name[j]))
      if (!is.na(lr) && nzchar(lr)) lista <- lr
    }
  }
  list(lista = lista, tipo = tipo)
}

# Filas de `choices` de esa lista, o `integer(0)`.
.equiv_filas_choices <- function(inst, lista) {
  ch <- (inst %||% list())$choices
  if (!nzchar(lista) || is.null(ch) || !all(c("list_name", "name") %in% names(ch))) {
    return(integer(0))
  }
  which(as.character(ch$list_name) == lista)
}

.equiv_firma_escala <- function(inst, var) {
  res <- .equiv_lista_de(inst, var)
  lista <- res$lista
  tipo <- res$tipo
  if (!nzchar(lista) && !nzchar(tipo)) return("")
  if (!nzchar(lista)) return(paste0("libre:", sub("\\s+.*$", "", tipo)))
  filas <- .equiv_filas_choices(inst, lista)
  if (!length(filas)) return(paste0("lista:", lista))
  ch <- inst$choices
  etiquetas <- if ("label" %in% names(ch)) as.character(ch$label)[filas] else as.character(ch$name)[filas]
  # La etiqueta entra NORMALIZADA —espacios colapsados y minúsculas— mientras que
  # el código entra literal.
  #
  # Medido en Acreditación Contabilidad: de 58 temas que la firma declaraba con
  # escalas distintas entre públicos, 56 diferían SÓLO en la caja de las opciones
  # —«Totalmente en desacuerdo» en el cuestionario de docentes contra «Totalmente
  # en Desacuerdo» en el de estudiantes—. Los 2 restantes eran divergencias
  # reales: el código PUCP escrito como número en un público y como texto en
  # otro, y los rangos de edad, que son de verdad distintos por público.
  #
  # La caja de una opción es un accidente de transcripción del cuestionario, no
  # una diferencia de escala; tratarla como tal dejaba fuera del mazo 56 de las
  # preguntas que este ADR existe para poder comparar. El código sí se compara
  # literal: ahí un 1 contra un 2 sí cambia lo que la barra significa.
  etiquetas <- tolower(gsub("\\s+", " ", trimws(etiquetas)))
  paste(as.character(ch$name)[filas], etiquetas, sep = "=", collapse = "|")
}

# Opciones de la escala de una variable, con su código y su etiqueta ORIGINAL.
#
# Se emiten enteras y sin recortar. Cuánto de esto cabe en pantalla es una
# decisión de la superficie —una escala de nueve puntos se resume en un chip y se
# despliega en un popover—, y resolverla aquí obligaba a elegir un límite a
# ciegas: con el corte en cuatro, una escala de cinco se mostraba mutilada justo
# donde el analista necesita reconocerla.
#
# Las etiquetas salen del instrumento y NO de la firma, que las normaliza a
# minúsculas para comparar. Lo que se compara y lo que se muestra son dos cosas
# distintas y por eso se calculan por separado.
.equiv_escala_opciones <- function(inst, var) {
  lista <- .equiv_lista_de(inst, var)$lista
  filas <- .equiv_filas_choices(inst, lista)
  # Sin lista, o con una lista que `choices` no describe, no hay opciones: se
  # calla en vez de inventar una escala.
  if (!length(filas)) return(list())
  ch <- inst$choices
  codigos <- as.character(ch$name)[filas]
  etiquetas <- if ("label" %in% names(ch)) as.character(ch$label)[filas] else codigos
  etiquetas <- trimws(as.character(etiquetas))
  ok <- !is.na(etiquetas) & nzchar(etiquetas)
  if (!any(ok)) return(list())
  lapply(which(ok), function(i) {
    list(codigo = as.character(codigos[i]), etiqueta = etiquetas[i])
  })
}

# Clave de emparejado por variable, con el ordinal ya resuelto.
.equiv_claves_de_base <- function(inst) {
  vars <- .equiv_variables_de_base(inst)
  if (!nrow(vars)) return(list())
  vistas <- list()
  out <- list()
  for (i in seq_len(nrow(vars))) {
    nombre <- vars$name[i]
    base_clave <- paste(.equiv_norm_col(vars$label[i]),
                        .equiv_firma_escala(inst, nombre), sep = "@@")
    n <- (vistas[[base_clave]] %||% 0L) + 1L
    vistas[[base_clave]] <- n
    out[[nombre]] <- list(clave = paste0(base_clave, "##", n),
                          etiqueta = vars$label[i], seccion = vars$seccion[i])
  }
  out
}

# Propone filas de equivalencia agrupando por esa clave. Devuelve SOLO lo que
# calza en mas de una base: una variable que no empareja no es una sugerencia,
# es una fila que el analista tendra que decidir, y ofrecerla como propuesta
# invitaria a confirmarla sin mirar.
.equiv_sugerir <- function(inst_por_base) {
  bases <- names(inst_por_base %||% list())
  if (length(bases) < 2L) return(list())

  por_clave <- list()
  for (b in bases) {
    claves <- .equiv_claves_de_base(inst_por_base[[b]])
    for (nombre in names(claves)) {
      k <- claves[[nombre]]$clave
      entrada <- por_clave[[k]] %||% list(variables = list(),
                                          etiqueta = claves[[nombre]]$etiqueta,
                                          seccion = claves[[nombre]]$seccion)
      # Una base aporta como mucho una variable por clave: el ordinal ya la hizo
      # unica, y dos de la misma base en la misma fila no seria una equivalencia
      # entre publicos sino un error de lectura.
      if (is.null(entrada$variables[[b]])) entrada$variables[[b]] <- nombre
      por_clave[[k]] <- entrada
    }
  }

  # Una etiqueta que se repite entre propuestas NO se prellena. En el estudio
  # medido, las tres baterias de servicios dan tres filas distintas y correctas
  # —¿Conoce?, ¿Ha utilizado?, satisfaccion— pero las tres se llaman «Servicio
  # de salud» en el XLSForm. Ofrecer ese texto como etiqueta estandar reproduce
  # exactamente la ambiguedad que este ADR existe para eliminar, y encima
  # invita a confirmarla de un clic. Vacia, el campo pide lo unico que el
  # analista tiene que aportar.
  candidatas <- vapply(por_clave, function(e) as.character(e$etiqueta %||% ""), character(1))
  utiles <- names(por_clave)[vapply(por_clave, function(e) length(e$variables) >= 2L, logical(1))]
  repetidas <- names(which(table(candidatas[utiles]) > 1L))

  out <- list()
  for (k in names(por_clave)) {
    e <- por_clave[[k]]
    if (length(e$variables) < 2L) next
    etiqueta <- as.character(e$etiqueta %||% "")
    if (etiqueta %in% repetidas) etiqueta <- ""
    out[[length(out) + 1L]] <- list(
      seccion = as.character(e$seccion %||% ""),
      etiqueta_estandar = etiqueta,
      variables = e$variables,
      cantidad = length(e$variables),
      # La marca es el contrato con la UI: sin ella, una propuesta se ve igual
      # que una decision tomada.
      sugerida = TRUE
    )
  }
  # Primero lo que cubre mas publicos: es donde una confirmacion rinde mas.
  orden <- order(-vapply(out, function(x) x$cantidad, integer(1)),
                 vapply(out, function(x) {
                   # Las que quedaron sin etiqueta se ordenan por su primera
                   # variable, para que las tres de una bateria salgan juntas.
                   e <- x$etiqueta_estandar
                   if (nzchar(e)) e else paste0("~", unlist(x$variables)[1])
                 }, character(1)))
  out[orden]
}


# ¿Esta variable se puede graficar como barras apiladas? Solo las de opción
# —única o múltiple—, directamente o a través de su recodificada.
#
# La regla se dice por TIPO y no por «tiene lista», que era el proxy anterior:
# el tipo es el criterio real del analista y el que hace legible el motivo
# cuando una fila queda fuera del mazo. Una numérica entra sólo si Codificación
# le construyó una recodificada de opción única —«¿Cuántos años tiene?» ->
# rangos de edad—, que es lo que el render acaba dibujando.
#
# Ojo con el alcance: esto filtra el MAZO, no la declaración. Una pregunta de
# texto abierto sigue teniendo etiqueta estándar y sigue siendo equivalente
# entre públicos; lo que no puede es ser una diapositiva.
.equiv_es_graficable <- function(inst, var) {
  sv <- (inst %||% list())$survey
  if (is.null(sv) || !"name" %in% names(sv)) return(FALSE)
  tipo_de <- function(v) {
    i <- which(as.character(sv$name) == as.character(v))[1]
    if (is.na(i)) return("")
    sub("\\s+.*$", "", trimws(as.character((sv$type %||% "")[i])))
  }
  if (tipo_de(var) %in% c("select_one", "select_multiple")) return(TRUE)
  tipo_de(paste0(as.character(var), "_recod")) %in% c("select_one", "select_multiple")
}


# Revisión de la declaración: huella de su CONTENIDO, no de cuándo se guardó.
#
# El ADR 0063 acepta que la propuesta envejezca —la declaración puede cambiar
# después de aplicar el mazo— a cambio de que la diferencia sea visible en vez
# de sospechada. Esta huella es lo que la vuelve comprobable.
#
# Entra lo que cambia el mazo: qué preguntas, con qué variables, en qué diapositiva y
# con qué etiqueta. NO entra el sello de instrumentos ni la fecha de importación:
# reimportar la misma matriz sin tocar nada no debe pintar el mazo como
# desfasado, porque no lo está.
.equiv_declaracion_revision <- function(equiv) {
  filas <- (equiv %||% list())$filas %||% list()
  if (!length(filas)) return("")
  partes <- vapply(filas, function(f) {
    vars <- f$variables %||% list()
    orden <- order(names(vars))
    paste(
      as.character(f$diapositiva %||% ""),
      # El enunciado titula la diapositiva (ADR 0064), así que cambiarlo cambia el
      # mazo y tiene que mover la revisión.
      as.character(f$enunciado %||% ""),
      as.character(f$etiqueta_estandar %||% ""),
      paste(names(vars)[orden], unlist(vars)[orden], sep = "=", collapse = ","),
      sep = "\u001e"
    )
  }, character(1))
  # Ordenado: reordenar las filas sin cambiar su contenido no cambia el mazo.
  .equiv_hash_estable(sort(partes))
}
