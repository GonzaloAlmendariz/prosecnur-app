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
# mazo en vez de armarlo lamina por lamina.
.EQUIV_COL_DIAPOSITIVA <- "diapositiva"

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

  i_diapo <- idx_de(.EQUIV_COL_DIAPOSITIVA)
  # «Diapo» es como la llaman las matrices ya escritas; aceptarla evita pedirle
  # al equipo que renombre una columna para que la app la lea.
  if (is.na(i_diapo)) i_diapo <- idx_de("diapo")

  seccion <- if (!is.na(i_seccion)) .equiv_fill_down(df[[i_seccion]]) else rep(NA_character_, nrow(df))
  etiqueta <- trimws(as.character(df[[i_etiqueta]]))
  diapo <- if (!is.na(i_diapo)) trimws(as.character(df[[i_diapo]])) else rep(NA_character_, nrow(df))

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
      diapositiva = if (is.na(diapo[r])) "" else diapo[r],
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
  cols[[.EQUIV_COL_DIAPOSITIVA]] <- character(0)
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
      fila[[.EQUIV_COL_DIAPOSITIVA]] <- as.character(f$diapositiva %||% "")
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
      fila[[.EQUIV_COL_DIAPOSITIVA]] <- ""
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
# una sugerencia es indistinguible de una decision y termina en una lamina sin
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
.equiv_firma_escala <- function(inst, var) {
  sv <- (inst %||% list())$survey
  if (is.null(sv) || !"name" %in% names(sv)) return("")
  i <- which(as.character(sv$name) == as.character(var))[1]
  if (is.na(i)) return("")
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
  # «libre:integer» para todas y la fila pasaba el filtro; luego la lámina moría
  # con «no comparten una escala compatible». Medido en Acreditación
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
  if (!nzchar(lista)) return(paste0("libre:", sub("\\s+.*$", "", tipo)))
  ch <- (inst %||% list())$choices
  if (is.null(ch) || !all(c("list_name", "name") %in% names(ch))) return(paste0("lista:", lista))
  filas <- which(as.character(ch$list_name) == lista)
  if (!length(filas)) return(paste0("lista:", lista))
  etiquetas <- if ("label" %in% names(ch)) as.character(ch$label)[filas] else as.character(ch$name)[filas]
  paste(as.character(ch$name)[filas], etiquetas, sep = "=", collapse = "|")
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
