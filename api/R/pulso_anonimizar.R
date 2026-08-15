# =============================================================================
# Anonimización de proyectos .pulso reales
# =============================================================================
#
# Convierte un `.pulso` de un estudio real en un fixture versionable: reemplaza
# los datos personales por seudónimos sintéticos SIN romper el poder de testeo
# del proyecto.
#
# Tres invariantes que el reemplazo respeta, porque son las que hacen que el
# fixture siga sirviendo para probar la app:
#
#   1. Estabilidad — el seudónimo se deriva de un hash del valor original con
#      una sal por proyecto. Mismo valor -> mismo seudónimo, en todas las bases
#      y en todas las corridas. Las uniones (`_parent_index`, `link_key`,
#      `recipient_id`, cruces enumerador × base) siguen cerrando.
#   2. Forma — un DNI de 8 dígitos se reemplaza por 8 dígitos, un correo por
#      algo con `@`, un celular de 9 por 9. Los validadores y parsers que la app
#      corre sobre estas columnas se siguen ejercitando de verdad.
#   3. Geometría — el GPS no se borra ni se randomiza: se desplaza en bloque
#      con un offset rígido por proyecto. Distancias, rutas, y los cruces `sf`
#      contra el marco INEI mantienen su estructura relativa; solo dejan de
#      apuntar a los hogares reales.
#
# La sal por proyecto NO se persiste. Es derivada del slug + un secreto de
# build, de modo que el mapeo original -> seudónimo no es reconstruible desde
# el fixture publicado.

PULSO_ANONIMIZACION_SCHEMA <- "prosecnur.pulso_anonimizacion.v1"

# -----------------------------------------------------------------------------
# Clasificación de columnas
# -----------------------------------------------------------------------------

# Patrones sobre el NOMBRE de la columna. Se evalúan en orden: el primero que
# matchea gana, así que los más específicos van antes (documento antes que
# nombre, porque "codigo_pucp" no debe caer en el cajón de "nombre").
.PULSO_PII_PATRONES <- list(
  gps       = "^_geolocation$|^_?gps|_gps$|latitud|longitud|^lat$|^lon$|^lng$|geopoint",
  correo    = "correo|email|e[-_. ]?mail",
  telefono  = "celular|tel[eé]fono|m[oó]vil|movil|whatsapp|^tlf|^cel$",
  documento = "^dni$|dni|documento|c[oó]digo[_ ]?pucp|carn[eé]|pasaporte|^codigo$|^c[oó]digo$",
  nombre    = "nombre|apellido|^entrevistado$|^encuestado$|^docente$|^responsable$"
)

# Columnas que el nombre marca como PII pero que en la práctica son texto de
# pregunta (el instrumento de acreditación tiene ítems larguísimos cuyo
# enunciado menciona "correo electrónico"). Un nombre de columna de más de
# `max_nchar` caracteres es un enunciado, no un campo de contacto.
.PULSO_PII_MAX_NCHAR_COLNAME <- 60L

# "Nombre de X" donde X NO es una persona.
#
# El patrón `nombre` casa por SUBCADENA, así que "Nombre del curso" caía en el
# cajón de las personas y sus valores se sustituían por nombres inventados.
# Medido en el catálogo de curso-horario de un proyecto de referencia: la
# columna de nombres de curso quedó llena de nombres de personas, y la
# superficie de Cálculo de muestra los muestra donde deberían ir cursos y
# facultades. Un fixture así **fabrica bugs fantasma**: se diagnostica el motor
# por un defecto que puso la anonimización.
#
# La lista es de complementos INEQUÍVOCOS. No se añade nada que pueda designar
# a una persona —"nombre del responsable", "del docente", "del entrevistado"
# siguen siendo PII— porque aquí no hay red debajo: `pulso_detectar_pii` busca
# correos, celulares y DNIs por valor, **no nombres**, y además salta las
# columnas que este clasificador marca. Un falso negativo no lo caza nadie.
#
# El complemento va ANCLADO por su final. Sin anclar, este mismo parche repetía
# el defecto que viene a corregir: `encuesta` casaba dentro de «nombre del
# **encuesta**do», y un encuestado es una persona. La coincidencia por subcadena
# es exactamente la causa raíz — escribirla otra vez en la reparación cuesta una
# fuga, no un fixture sucio.
.PULSO_PII_NOMBRE_NO_PERSONA <- paste0(
  "nombres?\\s+(de\\s+la|de\\s+el|del|de)\\s+",
  "(curso|asignatura|materia|programa|proyecto|archivo|fichero|hoja|columna|",
  "campo|variable|base|tabla|formulario|encuesta|reporte|plantilla|m[oó]dulo)",
  "(s)?(?![a-zá-éíóúñ])"
)

.pulso_pii_clasificar_columna <- function(nombre, valores = NULL) {
  nm <- tolower(as.character(nombre %||% ""))
  if (!nzchar(nm)) return(NA_character_)
  # Enunciados de pregunta: nombre largo y prefijo de ítem (q0001__, p12_).
  if (nchar(nm) > .PULSO_PII_MAX_NCHAR_COLNAME && grepl("^[qp][0-9]+", nm)) {
    return(NA_character_)
  }
  # "Nombre del curso" y familia: el complemento dice que no es una persona.
  # Se comprueba ANTES de los patrones y sólo desactiva el cajón `nombre`: si la
  # columna trae además correo o teléfono en su rótulo, sigue siendo PII.
  if (grepl(.PULSO_PII_NOMBRE_NO_PERSONA, nm, perl = TRUE)) {
    for (tipo in setdiff(names(.PULSO_PII_PATRONES), "nombre")) {
      if (grepl(.PULSO_PII_PATRONES[[tipo]], nm)) return(tipo)
    }
    return(NA_character_)
  }
  for (tipo in names(.PULSO_PII_PATRONES)) {
    if (grepl(.PULSO_PII_PATRONES[[tipo]], nm)) return(tipo)
  }
  NA_character_
}

# Inventario de columnas PII de un data.frame, con el conteo de valores no
# vacíos. Se usa tanto para anonimizar como para auditar un fixture ya escrito.
pulso_pii_inventario <- function(df) {
  if (!is.data.frame(df) || !ncol(df)) {
    return(data.frame(columna = character(), tipo = character(), n_no_vacios = integer(),
                      stringsAsFactors = FALSE))
  }
  # Se lleva el índice además del nombre: las bases reales traen nombres de
  # columna duplicados y vacíos, y quien consuma este inventario tiene que poder
  # llegar a la columna sin depender de que el nombre la identifique.
  nombres <- names(df)
  filas <- lapply(seq_along(df), function(i) {
    nm <- nombres[[i]] %||% ""
    tipo <- .pulso_pii_clasificar_columna(nm, df[[i]])
    if (is.na(tipo)) return(NULL)
    col <- df[[i]]
    no_vacios <- sum(!is.na(col) & nzchar(trimws(as.character(col))))
    data.frame(indice = as.integer(i), columna = nm, tipo = tipo,
               n_no_vacios = as.integer(no_vacios), stringsAsFactors = FALSE)
  })
  filas <- Filter(Negate(is.null), filas)
  if (!length(filas)) {
    return(data.frame(indice = integer(), columna = character(), tipo = character(),
                      n_no_vacios = integer(), stringsAsFactors = FALSE))
  }
  do.call(rbind, filas)
}

# -----------------------------------------------------------------------------
# Seudónimos deterministas
# -----------------------------------------------------------------------------

# Hashea sobre los valores ÚNICOS y expande por match.
#
# La versión ingenua llama a `digest` una vez por celda. En una columna de
# 136 mil filas —el marco de matrícula de HSVG tiene ese tamaño— son 136 mil
# llamadas para, típicamente, unos pocos miles de valores distintos. Como el
# seudónimo es función pura del valor, hashear el conjunto único y repartir es
# idéntico en resultado y órdenes de magnitud más barato.
.pulso_pii_hash <- function(x, sal) {
  v <- as.character(x)
  unicos <- unique(v)
  hashes <- vapply(unicos, function(u) {
    digest::digest(paste0(sal, "|", u), algo = "sha256", serialize = FALSE)
  }, character(1), USE.NAMES = FALSE)
  hashes[match(v, unicos)]
}

# Entero estable en [0, n) derivado del hash.
.pulso_pii_indice <- function(hash, n) {
  if (n <= 0) return(integer(length(hash)))
  vapply(hash, function(h) {
    as.integer(strtoi(substr(h, 1, 7), base = 16L) %% n) + 1L
  }, integer(1), USE.NAMES = FALSE)
}

# Catálogos sintéticos. Nombres peruanos comunes para que el fixture siga
# leyéndose como un estudio local, pero sin corresponder a nadie.
.PULSO_PII_NOMBRES <- c(
  "Ana", "Beatriz", "Carla", "Diana", "Elena", "Fiorella", "Gabriela", "Ines",
  "Julia", "Karina", "Lucia", "Milagros", "Norma", "Olga", "Patricia", "Rosa",
  "Andres", "Bruno", "Carlos", "Diego", "Eduardo", "Felipe", "Gonzalo", "Hugo",
  "Ivan", "Javier", "Luis", "Manuel", "Nestor", "Oscar", "Pablo", "Ricardo"
)
.PULSO_PII_APELLIDOS <- c(
  "Alvarado", "Bustamante", "Caceres", "Delgado", "Espinoza", "Flores",
  "Guzman", "Huaman", "Ibarra", "Jimenez", "Quispe", "Loayza", "Mendoza",
  "Navarro", "Ochoa", "Palacios", "Ramirez", "Salazar", "Tapia", "Urbina",
  "Valdivia", "Zambrano", "Cardenas", "Rojas", "Vargas", "Paredes"
)

.pulso_pii_fake_nombre <- function(hash, componentes = 1L) {
  idx_n <- .pulso_pii_indice(hash, length(.PULSO_PII_NOMBRES))
  if (componentes <= 1L) return(.PULSO_PII_NOMBRES[idx_n])
  idx_a1 <- .pulso_pii_indice(substr(hash, 8, 64), length(.PULSO_PII_APELLIDOS))
  idx_a2 <- .pulso_pii_indice(substr(hash, 16, 64), length(.PULSO_PII_APELLIDOS))
  if (componentes == 2L) return(paste(.PULSO_PII_NOMBRES[idx_n], .PULSO_PII_APELLIDOS[idx_a1]))
  paste(.PULSO_PII_NOMBRES[idx_n], .PULSO_PII_APELLIDOS[idx_a1], .PULSO_PII_APELLIDOS[idx_a2])
}

.pulso_pii_fake_apellido <- function(hash) {
  .PULSO_PII_APELLIDOS[.pulso_pii_indice(hash, length(.PULSO_PII_APELLIDOS))]
}

# Correo con el mismo dominio si es institucional conocido (pucp.edu.pe deja de
# ser identificante una vez que el usuario es sintético, y conservarlo mantiene
# vivas las reglas que segmentan por dominio).
.pulso_pii_fake_correo <- function(hash, originales) {
  # El dominio del original se CONSERVA como prefijo pero se cierra siempre bajo
  # `example.test`, que es un TLD reservado y no resuelve.
  #
  # Antes se preservaba el dominio tal cual, y eso tenía dos costos. El primero
  # es de privacidad: un seudónimo como `lucia.guzman@pucp.edu.pe` puede
  # coincidir con la dirección de una persona real ajena al estudio, y el
  # fixture se versiona. El segundo es que obligaba al detector de PII a
  # saltarse las columnas de correo enteras para no marcar sus propias
  # sustituciones — y ese salto dejaba pasar un correo auténtico que hubiera
  # sobrevivido. Con el sufijo sintético las dos cosas se cierran a la vez:
  # el seudónimo sigue diciendo de qué dominio venía y ya no puede confundirse
  # con una dirección real.
  dominio <- sub(".*@", "", as.character(originales))
  sin_dominio <- is.na(dominio) | !nzchar(dominio) | dominio == as.character(originales)
  dominio[sin_dominio] <- ""
  dominio <- ifelse(nzchar(dominio),
                    paste0(dominio, ".example.test"),
                    "example.test")
  usuario <- tolower(paste0(
    .PULSO_PII_NOMBRES[.pulso_pii_indice(hash, length(.PULSO_PII_NOMBRES))],
    ".",
    .PULSO_PII_APELLIDOS[.pulso_pii_indice(substr(hash, 8, 64), length(.PULSO_PII_APELLIDOS))],
    substr(hash, 1, 3)
  ))
  paste0(usuario, "@", dominio)
}

# Preserva la longitud del original: un celular peruano de 9 dígitos sigue
# teniendo 9, un anexo de 4 sigue teniendo 4.
.pulso_pii_fake_digitos <- function(hash, originales, largo_default = 9L) {
  # Sobre pares únicos (hash, original): un padrón repite el mismo teléfono en
  # muchas filas y no hay razón para recalcularlo en cada una.
  clave <- paste0(hash, "", as.character(originales))
  unicos <- !duplicated(clave)
  if (sum(unicos) < length(clave)) {
    calculados <- .pulso_pii_fake_digitos(hash[unicos], originales[unicos], largo_default)
    return(calculados[match(clave, clave[unicos])])
  }
  solo_num <- gsub("[^0-9]", "", as.character(originales))
  largo <- nchar(solo_num)
  largo[is.na(largo) | largo == 0L] <- largo_default
  vapply(seq_along(hash), function(i) {
    n <- largo[[i]]
    # Del hash se extraen dígitos suficientes; el primero se fuerza a 9 cuando
    # el original arranca en 9 (celulares peruanos) para no romper validaciones
    # de formato que discriminan fijo vs móvil.
    crudo <- gsub("[^0-9]", "", digest::digest(hash[[i]], algo = "md5", serialize = FALSE))
    while (nchar(crudo) < n) crudo <- paste0(crudo, gsub("[^0-9]", "", digest::digest(crudo, algo = "md5", serialize = FALSE)))
    out <- substr(crudo, 1, n)
    orig_i <- solo_num[[i]]
    if (!is.na(orig_i) && nzchar(orig_i) && substr(orig_i, 1, 1) == "9" && n >= 1) {
      out <- paste0("9", substr(out, 2, n))
    }
    out
  }, character(1), USE.NAMES = FALSE)
}

# -----------------------------------------------------------------------------
# GPS — desplazamiento rígido
# -----------------------------------------------------------------------------

# Offset determinista por sal, acotado a ~±0.05 grados (unos 5 km). Suficiente
# para que los puntos dejen de caer sobre las viviendas reales, chico para que
# sigan cayendo dentro del país y del marco de referencia.
.pulso_pii_gps_offset <- function(sal) {
  h <- digest::digest(paste0("gps|", sal), algo = "sha256", serialize = FALSE)
  lat <- (strtoi(substr(h, 1, 6), base = 16L) %% 100000) / 1e6 - 0.05
  lon <- (strtoi(substr(h, 7, 12), base = 16L) %% 100000) / 1e6 - 0.05
  list(lat = lat, lon = lon)
}

# Kobo serializa `_geolocation` y los geopoint como "lat lon alt precision".
# Se desplazan lat/lon y se dejan intactas altitud y precisión: son las que
# alimentan los filtros de calidad de captura.
.pulso_pii_shift_geopoint <- function(x, offset) {
  vapply(as.character(x), function(v) {
    if (is.na(v) || !nzchar(trimws(v))) return(NA_character_)
    partes <- strsplit(trimws(v), "[ ,]+")[[1]]
    if (length(partes) < 2) return(v)
    lat <- suppressWarnings(as.numeric(partes[[1]]))
    lon <- suppressWarnings(as.numeric(partes[[2]]))
    if (is.na(lat) || is.na(lon)) return(v)
    partes[[1]] <- format(lat + offset$lat, digits = 12)
    partes[[2]] <- format(lon + offset$lon, digits = 12)
    paste(partes, collapse = " ")
  }, character(1), USE.NAMES = FALSE)
}

.pulso_pii_shift_numerico <- function(x, delta) {
  num <- suppressWarnings(as.numeric(x))
  ifelse(is.na(num), x, num + delta)
}

# -----------------------------------------------------------------------------
# Anonimización de un data.frame
# -----------------------------------------------------------------------------

# Devuelve el data.frame anonimizado y el diccionario original -> seudónimo de
# las columnas de nombre. Ese diccionario NO se persiste: se usa en memoria para
# barrer los mismos nombres dentro de las preguntas abiertas.
pulso_anonimizar_data <- function(df, sal, offset_gps = NULL) {
  if (!is.data.frame(df) || !ncol(df) || !nrow(df)) {
    return(list(data = df, diccionario = character(), columnas = character()))
  }
  offset_gps <- offset_gps %||% .pulso_pii_gps_offset(sal)
  inventario <- pulso_pii_inventario(df)
  diccionario <- character()
  tocadas <- character()

  for (k in seq_len(nrow(inventario))) {
    idx <- inventario$indice[[k]]
    nm <- inventario$columna[[k]]
    tipo <- inventario$tipo[[k]]
    col <- df[[idx]]
    if (is.null(col)) next
    original <- as.character(col)
    vacios <- is.na(original) | !nzchar(trimws(original))
    if (all(vacios)) next

    hash <- .pulso_pii_hash(original, sal)
    nuevo <- original

    if (tipo == "gps") {
      # Las columnas lat/lon sueltas son numéricas; los geopoint son texto.
      if (is.numeric(col)) {
        delta <- if (grepl("^lat|latitud", tolower(nm))) offset_gps$lat else offset_gps$lon
        df[[idx]] <- .pulso_pii_shift_numerico(col, delta)
      } else {
        df[[idx]] <- .pulso_pii_shift_geopoint(col, offset_gps)
      }
      tocadas <- c(tocadas, nm)
      next
    }

    nuevo[!vacios] <- switch(
      tipo,
      correo    = .pulso_pii_fake_correo(hash[!vacios], original[!vacios]),
      telefono  = .pulso_pii_fake_digitos(hash[!vacios], original[!vacios], largo_default = 9L),
      documento = .pulso_pii_fake_digitos(hash[!vacios], original[!vacios], largo_default = 8L),
      nombre    = {
        # "Apellidos y nombres" trae 3 componentes; "Nombres" trae 1.
        n_comp <- if (grepl("apellido.*nombre|nombre.*apellido|completo", tolower(nm))) 3L
                  else if (grepl("^apellido", tolower(nm))) 2L
                  else 1L
        if (n_comp == 2L) .pulso_pii_fake_apellido(hash[!vacios])
        else .pulso_pii_fake_nombre(hash[!vacios], componentes = n_comp)
      },
      original[!vacios]
    )

    if (tipo == "nombre") {
      nombres_originales <- trimws(original[!vacios])
      names(nuevo) <- NULL
      dic <- stats::setNames(nuevo[!vacios], nombres_originales)
      diccionario <- c(diccionario, dic[!duplicated(names(dic))])
    }

    df[[idx]] <- nuevo
    tocadas <- c(tocadas, nm)
  }

  diccionario <- diccionario[!duplicated(names(diccionario))]
  list(data = df, diccionario = diccionario, columnas = unique(tocadas))
}

# -----------------------------------------------------------------------------
# Preguntas abiertas — barrido por diccionario
# -----------------------------------------------------------------------------

# El riesgo real de las abiertas no es el campo estructurado sino el texto:
# "me atendió la señora Rojas", "escríbeme a jperez@pucp.edu.pe". Se barren dos
# cosas distintas, y CON ALCANCES DISTINTOS, porque no cuestan lo mismo:
#
#   - Patrones de contacto (correo, celular, documento) sobre TODA columna de
#     texto. Son tres `gsub` por columna, da igual el tamaño del proyecto. Este
#     alcance amplio no es celo: una columna llamada `col_7`, con 1277 filas de
#     códigos cortos y quince correos institucionales perdidos entre ellas, pasó
#     el heurístico de "texto libre" como categórica y llegó intacta al gate.
#     Para un patrón de contacto, el patrón ES la evidencia — da igual cómo luzca
#     el resto de su columna.
#
#   - Tokens del diccionario de nombres, solo sobre columnas de TEXTO LIBRE.
#     Acá el alcance amplio sí se paga: el diccionario tiene un token por
#     persona del estudio, y un marco muestral universitario trae decenas de
#     miles. Barrer cada token contra cada celda es cuadrático — con 29 mil
#     estudiantes el proceso corrió cuarenta minutos sin terminar. Restringirlo
#     a prosa es además lo correcto de fondo: un nombre suelto aparece en un
#     comentario, no en una columna de códigos.
#
# Devuelve el df y el conteo de reemplazos, que el reporte expone para que el
# resultado sea revisable y no un borrado ciego.
pulso_anonimizar_abiertas <- function(df, diccionario, sal = NULL, min_nchar = 4L) {
  if (!is.data.frame(df) || !nrow(df)) {
    return(list(data = df, reemplazos = 0L, columnas = character()))
  }

  # Columnas candidatas. Se excluyen las ya clasificadas como PII:
  # `pulso_anonimizar_data` las trató preservando la forma, y el barrido las
  # degradaría a un marcador. Un `email` seudonimizado debe seguir pareciendo un
  # correo — es lo que mantiene vivos los parsers de la app sobre esa columna.
  # Todo el recorrido va por POSICIÓN y no por nombre de columna. Las bases
  # reales llegan con nombres duplicados y hasta vacíos —un export de Kobo con
  # dos `Nombres`, una hoja con una columna sin encabezado— y `df[[nm]]` sobre
  # un nombre vacío revienta con "subíndice fuera de los límites". Indexar por
  # posición es lo único que sobrevive a esos datos.
  nombres <- names(df)
  es_texto <- vapply(seq_along(df), function(i) {
    if (!is.na(.pulso_pii_clasificar_columna(nombres[[i]] %||% ""))) return(FALSE)
    col <- df[[i]]
    if (!is.character(col) && !is.factor(col)) return(FALSE)
    any(!is.na(col) & nzchar(as.character(col)))
  }, logical(1))

  es_texto_libre <- vapply(seq_along(df), function(i) {
    if (!isTRUE(es_texto[[i]])) return(FALSE)
    v <- as.character(df[[i]])
    v <- v[!is.na(v) & nzchar(v)]
    if (!length(v)) return(FALSE)
    ratio <- length(unique(v)) / length(v)
    # F111 · Veto categórico ANTES del test de prosa: una dimensión del estudio
    # nunca se barre, por larga que sea su etiqueta.
    #
    # El test de prosa era `largo > 15 || poco repetido`, y ese `||` ascendía a
    # prosa a toda categórica de etiqueta larga. Medido sobre el marco muestral
    # de HSVG (136,284 filas): `Facultad` tiene 18 niveles y promedia 20
    # caracteres, así que entraba al barrido y un apellido real que coincide con
    # una palabra del dominio la destruía —«CIENCIAS Y ARTES DE LA COMUN.» ->
    # «... DE LA Bustamante.»—. El daño no es cosmético: las categorías de la
    # suite de criterios NO se anonimizan, así que el fixture quedaba sin poder
    # casar sus propios criterios contra sus propios datos (0 de 136,284 filas
    # elegibles) y no reproducía su marco. Es el mismo defecto que documenta
    # `.PULSO_PII_NOMBRE_NO_PERSONA`, un escalón más abajo: allá se fabricaban
    # bugs fantasma en el clasificador, acá en el barrido.
    #
    # Por qué el veto es seguro: la repetición masiva ES la señal. Un valor que
    # aparece cientos de veces es una categoría, no el nombre de una persona
    # escrito en un comentario, que es lo único que este barrido viene a cazar.
    # Y no abre un hueco de PII: `.pulso_pii_barrer_contactos` —correos,
    # celulares y documentos— corre igual sobre TODA columna de texto, vetada o
    # no; el veto solo apaga el barrido de nombres. El piso de filas mantiene el
    # comportamiento conservador (barrer) en tablas chicas, donde el ratio es
    # ruido: con 20 respuestas, 4 repetidas no dicen nada.
    if (length(v) >= 200L && ratio < 0.05) return(FALSE)
    # Prosa: valores largos, o muy poco repetidos.
    mean(nchar(v)) > 15 || ratio > 0.5
  }, logical(1))

  tokens <- .pulso_pii_tokens_diccionario(diccionario, min_nchar = min_nchar)

  reemplazos <- 0L
  tocadas <- character()
  for (i in which(es_texto)) {
    col <- as.character(df[[i]])
    antes <- col
    col <- .pulso_pii_barrer_contactos(col, sal = sal %||% "abiertas")
    if (isTRUE(es_texto_libre[[i]]) && length(tokens)) {
      col <- .pulso_pii_barrer_tokens(col, tokens)
    }
    n_cambios <- sum(!is.na(col) & !is.na(antes) & col != antes)
    if (n_cambios > 0) {
      df[[i]] <- col
      reemplazos <- reemplazos + n_cambios
      tocadas <- c(tocadas, nombres[[i]] %||% sprintf("[[%d]]", i))
    }
  }
  list(data = df, reemplazos = as.integer(reemplazos), columnas = tocadas)
}

# Diccionario nombre-real -> seudónimo, expandido a sus componentes. La clave se
# normaliza a minúsculas porque el reemplazo es por token exacto y el texto real
# mezcla mayúsculas ("ROJAS", "Rojas", "rojas").
.pulso_pii_tokens_diccionario <- function(diccionario, min_nchar = 4L) {
  if (!length(diccionario)) return(new.env(parent = emptyenv()))
  mapa <- new.env(parent = emptyenv(), size = length(diccionario) * 4L)
  for (orig in names(diccionario)) {
    nuevo <- diccionario[[orig]]
    partes_o <- strsplit(orig, "[ ,]+")[[1]]
    partes_n <- strsplit(nuevo, "[ ,]+")[[1]]
    for (j in seq_along(partes_o)) {
      p <- partes_o[[j]]
      if (nchar(p) < min_nchar) next
      clave <- tolower(p)
      if (!exists(clave, envir = mapa, inherits = FALSE)) {
        assign(clave,
               if (j <= length(partes_n)) partes_n[[j]] else partes_n[[length(partes_n)]],
               envir = mapa)
      }
    }
  }
  mapa
}

# Reemplazo por tokenización y lookup en hash, no por un `gsub` por token, y
# aplicado sobre los valores ÚNICOS de la columna.
#
# Las dos optimizaciones atacan factores distintos del mismo producto. La
# tokenización baja el costo de O(celdas x tokens) —un `gsub` por cada nombre
# del estudio— a O(palabras). Trabajar sobre únicos baja el número de celdas:
# una columna de 136 mil filas de nombres de curso tiene unos pocos miles de
# valores distintos, y el resultado es función pura del valor. Sin las dos, el
# marco muestral de HSVG no termina de procesarse.
# F111 · El alfabeto del tokenizador se declara por PROPIEDAD Unicode, no por
# enumeración a mano.
#
# La clase enumeraba `áéíóúñ` y sus mayúsculas, y toda letra fuera de esa lista
# quedaba como separador. Con `Ü` —una letra que el castellano usa— la palabra
# se partía en dos: «LINGÜÍSTICA» daba las piezas `LING` e `ÍSTICA`, y si algún
# apellido del estudio era `Ling`, el reemplazo entraba DENTRO de la palabra y
# escupía «LoayzaÜÍSTICA». Ese daño no lo salva el veto categórico: le pasa
# igual a la prosa, que es justo lo que este barrido sí debe tocar.
#
# `(*UCP)` le pide a PCRE que resuelva `[:alnum:]` y `\b` por propiedades
# Unicode, así que cubre ü, ç, à y cualquier letra acentuada sin listarla. La
# misma marca va en el `\b` del reemplazo: si el corte y la frontera no usan el
# mismo alfabeto, vuelve el reemplazo parcial por la puerta de atrás.
.PULSO_PII_SEPARADOR_TOKENS <- "(*UCP)[^[:alnum:]]+"

.pulso_pii_barrer_tokens <- function(v, mapa) {
  unicos <- unique(v)
  transformados <- vapply(unicos, function(txt) {
    if (is.na(txt) || !nzchar(txt)) return(txt)
    piezas <- strsplit(txt, .PULSO_PII_SEPARADOR_TOKENS, perl = TRUE)[[1]]
    piezas <- piezas[nzchar(piezas)]
    if (!length(piezas)) return(txt)
    hallados <- unique(piezas[vapply(tolower(piezas),
                                     function(k) exists(k, envir = mapa, inherits = FALSE),
                                     logical(1))])
    if (!length(hallados)) return(txt)
    for (h in hallados) {
      txt <- gsub(paste0("(*UCP)\\b", .pulso_pii_escape_regex(h), "\\b"),
                  get(tolower(h), envir = mapa), txt, perl = TRUE)
    }
    txt
  }, character(1), USE.NAMES = FALSE)
  transformados[match(v, unicos)]
}

# Redacta correos, celulares y documentos escritos sueltos dentro de un texto.
#
# Acá NO se seudonimiza preservando la forma, a diferencia de las columnas
# estructuradas. La razón es que en texto libre la forma preservada vuelve el
# seudónimo indistinguible del dato real: un revisor —o el detector del gate—
# que encuentra "escríbeme a ana.flores3f@pucp.edu.pe" dentro de una abierta no
# tiene manera de saber si esa dirección se generó o se filtró. El marcador
# explícito hace la diferencia evidente y auditable.
#
# No se pierde nada analítico: una pregunta abierta se codifica por tema, y el
# tema sobrevive intacto a que el número de teléfono se vuelva "[celular]".
.PULSO_PII_MARCADORES <- list(
  correo = "[correo]",
  celular = "[celular]",
  documento = "[documento]"
)

.pulso_pii_barrer_contactos <- function(x, sal) {
  v <- x
  # El orden importa: el correo primero, porque puede contener dígitos que los
  # patrones numéricos capturarían por dentro.
  v <- gsub("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
            .PULSO_PII_MARCADORES$correo, v, perl = TRUE)
  v <- gsub("(?<![0-9])9[0-9]{8}(?![0-9])",
            .PULSO_PII_MARCADORES$celular, v, perl = TRUE)
  v <- .pulso_pii_redactar_documentos(v)
  v
}

# Ocho dígitos seguidos es un DNI o un código de alumno... o una fecha
# compacta. `20260724` matchea el mismo patrón que `40123456`, y redactar las
# fechas de una base de monitoreo destruiría el eje temporal del fixture —
# justo lo que hace útil un proyecto de campo para probar avance y cobertura.
# Por eso el reemplazo salta lo que parsea como fecha yyyymmdd plausible.
.pulso_pii_es_fecha_compacta <- function(d) {
  anio <- suppressWarnings(as.integer(substr(d, 1, 4)))
  mes <- suppressWarnings(as.integer(substr(d, 5, 6)))
  dia <- suppressWarnings(as.integer(substr(d, 7, 8)))
  !is.na(anio) && !is.na(mes) && !is.na(dia) &&
    anio >= 1900 && anio <= 2100 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31
}

# TRUE por elemento cuando el valor contiene ocho dígitos y TODOS los tramos de
# ocho dígitos que trae son fechas compactas plausibles. Lo usa el detector para
# no reportar como documento lo que solo es una fecha de captura.
.pulso_pii_solo_fechas_compactas <- function(v) {
  patron <- "(?<![0-9])[0-9]{8}(?![0-9])"
  coincidencias <- regmatches(v, gregexpr(patron, v, perl = TRUE))
  vapply(coincidencias, function(hits) {
    hits <- hits[!is.na(hits) & nzchar(hits)]
    if (!length(hits)) return(FALSE)
    all(vapply(hits, .pulso_pii_es_fecha_compacta, logical(1)))
  }, logical(1), USE.NAMES = FALSE)
}

# Una sola pasada: se extraen todas las coincidencias, se decide cuáles son
# fecha y cuáles documento, y se reinyectan con `regmatches<-`. La versión que
# hacía un `gsub` por documento distinto era cuadrática sobre columnas con
# muchos valores únicos, que es justo la forma de un padrón.
.pulso_pii_redactar_documentos <- function(v) {
  patron <- "(?<![0-9])[0-9]{8}(?![0-9])"
  m <- gregexpr(patron, v, perl = TRUE)
  hits <- regmatches(v, m)
  if (!length(unlist(hits))) return(v)

  # La decisión fecha/documento se cachea por valor distinto.
  unicos <- unique(unlist(hits))
  es_fecha <- vapply(unicos, .pulso_pii_es_fecha_compacta, logical(1), USE.NAMES = FALSE)
  fechas <- unicos[es_fecha]

  regmatches(v, m) <- lapply(hits, function(h) {
    if (!length(h)) return(h)
    ifelse(h %in% fechas, h, .PULSO_PII_MARCADORES$documento)
  })
  v
}

.pulso_pii_escape_regex <- function(x) {
  gsub("([.\\\\|()\\[\\]{}^$*+?])", "\\\\\\1", x, perl = TRUE)
}
