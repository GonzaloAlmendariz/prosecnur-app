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
  bases_norm <- .equiv_norm_col(bases)
  i_base <- stats::setNames(vapply(bases_norm, idx_de, integer(1)), bases)
  presentes <- bases[!is.na(i_base)]
  if (!length(presentes)) {
    stop_api(400, "E_EQUIV_SIN_COLUMNAS_BASE",
             sprintf("La matriz no trae ninguna columna con el nombre de una base del estudio (%s).",
                     paste(bases, collapse = ", ")))
  }

  seccion <- if (!is.na(i_seccion)) .equiv_fill_down(df[[i_seccion]]) else rep(NA_character_, nrow(df))
  etiqueta <- trimws(as.character(df[[i_etiqueta]]))

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
    filas[[length(filas) + 1L]] <- list(
      seccion = if (is.na(seccion[r])) "" else seccion[r],
      etiqueta_estandar = lab,
      variables = vars,
      # Derivado, no pedido: en cuántos públicos existe la pregunta.
      cantidad = length(vars)
    )
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
    n_sin_etiqueta = sum(vapply(filas, function(f) !nzchar(f$etiqueta_estandar), logical(1)))
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
# Las filas salen SIN emparejar: una por variable de cada base. Emparejarlas es
# la decision que el ADR se niega a inferir —un emparejamiento inventado se ve
# igual que uno correcto en la lamina resultante—, asi que la plantilla las
# ofrece separadas y el analista las junta moviendo celdas.

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
.equiv_plantilla_df <- function(inst_por_base, equiv = NULL) {
  bases <- names(inst_por_base %||% list())
  if (!length(bases)) {
    stop_api(400, "E_EQUIV_SIN_BASES",
             "El estudio no declara bases con las que armar la plantilla.")
  }

  cols <- list()
  cols[[.EQUIV_COL_SECCION]] <- character(0)
  cols[[.EQUIV_COL_ETIQUETA]] <- character(0)
  for (b in bases) {
    cols[[b]] <- character(0)
    cols[[paste0(b, .EQUIV_SUFIJO_ETIQUETA)]] <- character(0)
  }

  filas <- list()

  # 1) Lo ya declarado se emite primero y en su orden: reabrir la plantilla no
  #    puede desordenar el trabajo hecho ni obligar a rehacerlo.
  ya_mapeadas <- stats::setNames(vector("list", length(bases)), bases)
  if (!is.null(equiv)) {
    for (f in (equiv$filas %||% list())) {
      fila <- list()
      fila[[.EQUIV_COL_SECCION]] <- as.character(f$seccion %||% "")
      fila[[.EQUIV_COL_ETIQUETA]] <- as.character(f$etiqueta_estandar %||% "")
      for (b in bases) {
        v <- as.character((f$variables %||% list())[[b]] %||% "")
        fila[[b]] <- v
        lab <- ""
        if (nzchar(v)) {
          vars_b <- .equiv_variables_de_base(inst_por_base[[b]])
          hit <- which(vars_b$name == v)
          if (length(hit)) lab <- vars_b$label[hit[1]]
          ya_mapeadas[[b]] <- c(ya_mapeadas[[b]], v)
        }
        fila[[paste0(b, .EQUIV_SUFIJO_ETIQUETA)]] <- lab
      }
      filas[[length(filas) + 1L]] <- fila
    }
  }

  # 2) Lo que falta por emparejar, una fila por variable y por base. El analista
  #    las junta moviendo celdas; la app no adivina cuáles son la misma pregunta.
  for (b in bases) {
    vars_b <- .equiv_variables_de_base(inst_por_base[[b]])
    pendientes <- vars_b[!vars_b$name %in% (ya_mapeadas[[b]] %||% character(0)), , drop = FALSE]
    for (i in seq_len(nrow(pendientes))) {
      fila <- list()
      fila[[.EQUIV_COL_SECCION]] <- pendientes$seccion[i]
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
