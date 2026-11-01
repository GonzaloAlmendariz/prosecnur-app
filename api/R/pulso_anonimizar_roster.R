# =============================================================================
# Anonimización de la lista de encuestadores de Monitoreo
# =============================================================================
#
# La lista (`monitoreo_config$territorial$enumerator_roster`, normalizada por
# `.monitoreo_territorial_normalize_enumerator_roster`) guarda nombre, DNI y
# código Pulso de cada encuestador. Es una LISTA DE REGISTROS, no un data.frame,
# así que el recorrido genérico de `pulso_anonimizar_proyecto.R` y el del gate
# pasaban de largo: un fixture publicado salía con nombres y DNI reales y el gate
# lo daba por limpio. Mismo hueco que el padrón de aulas, y mismo remedio: caso
# especial en el anonimizador y en `pulso_detectar_pii()`.
#
# Qué se hace con cada campo:
#   - nombre: seudónimo de tres componentes de los catálogos cerrados del
#     anonimizador, estable por sal y sin colisiones (dos encuestadores que
#     cayeran en el mismo seudónimo se fundirían al normalizar la lista).
#   - dni: fuera. Ningún consumidor lo necesita en un fixture.
#   - codigo_pulso: un PXXX no identifica a nadie y se conserva. Con
#     `code_format = "DNI"` el código ES el DNI y se recodifica a `ANONxxxxxx`
#     —válido como código DNI de 6 a 12 caracteres y reconocible a simple vista—
#     con la MISMA función en la lista, en `material_territorial_asignacion` y en
#     los datos, para que todo siga casando.
#
# El nombre y el código también viajan, ya derivados, en tablas de Monitoreo
# (`responsible_display` = «P844 · Nombre», `enumerator_assigned`, `pulso_code`),
# en columnas que el clasificador por nombre no reconoce. Se barren con el mismo
# mapa para que el fixture nombre al encuestador igual que su lista.

.PULSO_ANON_ROSTER_CLAVES <- c("enumerator_roster", "encuestadores_pulso", "encuestadores")
.PULSO_ANON_ROSTER_CAMPOS <- c("codigo_pulso", "nombre", "nombre_normalizado", "dni", "source_row")
.PULSO_ANON_ROSTER_CODIGO_RE <- "^ANON[0-9A-F]{6}$"
.PULSO_ANON_ROSTER_PXXX_RE <- "^P[0-9]{3}$"
# Marca intermedia entre el barrido de la lista y el de las abiertas. Ver
# `.pulso_anon_roster_marcar`.
.PULSO_ANON_ROSTER_MARCA <- "\u2063PULSOROSTER%05d\u2063"
.PULSO_ANON_ROSTER_LLAVE <- "\u2063PULSOLLAVE%05d\u2063"
.PULSO_ANON_ROSTER_PAR <- "\u2063PULSOPAR%05d\u2063"
# Palabras que acompañan a un código sin ser el nombre de nadie («p003_sin_dato»,
# «P003 · sin asignar»). El gate no las toma por un nombre real.
.PULSO_ANON_ROSTER_NO_NOMBRE <- c("sin", "dato", "datos", "no", "identificado", "asignado", "asignar", "responsable",
                                  "encuestador", "encuestadora", "otro", "otros", "ninguno", "pendiente", "de", "del")
# Cabeceras del Excel de origen que el anonimizador reescribe.
.PULSO_ANON_ROSTER_CABECERAS <- c("N°", "AP PATERNO", "AP MATERNO", "NOMBRES", "DNI", "CODIGO PULSO")

# -----------------------------------------------------------------------------
# Localizar las listas
# -----------------------------------------------------------------------------

# Una lista está donde la clave lo diga y tenga forma de lista: se busca en
# cualquier profundidad y no sólo en `monitoreo_config$territorial`, por la misma
# razón que el recorrido genérico (una ruta fija se desactualiza sola).
.pulso_anon_roster_es_lista <- function(nombre, nodo) {
  nombre %in% .PULSO_ANON_ROSTER_CLAVES && is.list(nodo) && !is.data.frame(nodo) &&
    any(c("assignments", "asignaciones", "encuestadores") %in% names(nodo))
}

.pulso_anon_roster_map <- function(x, fn, ruta = "state", profundidad = 0L) {
  if (profundidad > .PULSO_ANON_MAX_PROFUNDIDAD || !is.list(x) || is.data.frame(x) || !length(x)) return(x)
  nombres <- names(x)
  if (is.null(nombres)) return(x)
  for (i in seq_along(x)) {
    nm <- nombres[[i]] %||% ""
    if (!nzchar(nm)) next
    hijo <- x[[i]]
    sub_ruta <- paste0(ruta, "$", nm)
    if (.pulso_anon_roster_es_lista(nm, hijo)) {
      x[[i]] <- fn(hijo, sub_ruta)
    } else if (is.list(hijo) && !is.data.frame(hijo)) {
      x[[i]] <- .pulso_anon_roster_map(hijo, fn, sub_ruta, profundidad + 1L)
    }
  }
  x
}

.pulso_anon_roster_listas <- function(estado) {
  out <- list()
  .pulso_anon_roster_map(estado, function(nodo, ruta) { out[[ruta]] <<- nodo; nodo })
  out
}

.pulso_anon_roster_items <- function(nodo) {
  raw <- nodo$assignments %||% nodo$asignaciones %||% nodo$encuestadores %||% list()
  if (is.data.frame(raw)) raw <- lapply(seq_len(nrow(raw)), function(i) as.list(raw[i, , drop = FALSE]))
  Filter(is.list, if (is.list(raw)) raw else list())
}

.pulso_anon_roster_normalizar <- function(nodo) {
  tryCatch(.monitoreo_territorial_normalize_enumerator_roster(nodo), error = function(e) NULL)
}

# -----------------------------------------------------------------------------
# Seudónimos
# -----------------------------------------------------------------------------

# Firma del emisor: un nombre anonimizado se compone sólo de piezas de los
# catálogos cerrados. Es la misma idea que reconoce los correos seudónimos en el
# gate. Límite conocido: un nombre real hecho enteramente de piezas del catálogo
# pasa la firma; el detector caza la lista sin anonimizar, no ese caso.
.pulso_anon_roster_firmado <- function(x) {
  catalogo <- tolower(c(.PULSO_PII_NOMBRES, .PULSO_PII_APELLIDOS))
  vapply(as.character(x), function(v) {
    if (is.na(v)) return(FALSE)
    piezas <- strsplit(tolower(v), "(*UCP)[^[:alpha:]]+", perl = TRUE)[[1]]
    piezas <- piezas[nzchar(piezas)]
    length(piezas) > 0L && all(piezas %in% catalogo)
  }, logical(1), USE.NAMES = FALSE)
}

.pulso_anon_roster_fake_codigo <- function(codigo, sal) {
  vapply(as.character(codigo), function(cod) {
    paste0("ANON", toupper(substr(digest::digest(paste0(sal, "|roster-codigo|", cod), algo = "sha256",
                                                 serialize = FALSE), 1, 6)))
  }, character(1), USE.NAMES = FALSE)
}

# Un código con forma de documento (seis dígitos seguidos o más: DNI, carné de
# extranjería, pasaporte) se recodifica con la función determinista, así casa
# igual venga de donde venga —lista, asignación, Planner, datos—. Un PXXX o un
# código corto del equipo («E01») no identifica a nadie y se conserva.
.pulso_anon_roster_codigo_es_documento <- function(codigo) {
  codigo <- as.character(codigo %||% "")
  nzchar(codigo) & grepl("[0-9]{6,}", codigo) & !grepl(.PULSO_ANON_ROSTER_CODIGO_RE, codigo)
}

.pulso_anon_roster_recodificar <- function(codigo, sal) {
  codigo <- as.character(codigo %||% "")
  doc <- .pulso_anon_roster_codigo_es_documento(codigo)
  codigo[doc] <- .pulso_anon_roster_fake_codigo(codigo[doc], sal)
  codigo
}

# El equipo que declara el Planner (`planner$equipo$personas`, schema
# `planner_equipo/v1`): nombre y código de cada persona del campo, en registros.
# Misma política que la lista de Monitoreo y el MISMO mapa, para que una persona
# que está en las dos quede con un solo seudónimo.
.pulso_anon_roster_planner <- function(estado) {
  personas <- ((if (is.list(estado)) estado$planner else NULL) %||% list())$equipo$personas
  if (is.data.frame(personas)) personas <- lapply(seq_len(nrow(personas)), function(i) as.list(personas[i, , drop = FALSE]))
  Filter(is.list, if (is.list(personas)) personas else list())
}

#' Mapa real -> seudónimo de todas las listas de encuestadores del estado.
#'
#' Se calcula UNA vez, sobre el estado original, antes de que ninguna pasada lo
#' toque. `nombres` mapea el nombre tal como lo normaliza la lista; `codigos`
#' sólo trae los códigos que cambian (formato DNI). `sustituciones` junta los
#' nombres con sus claves normalizadas («fulano_de_tal») y es lo que se barre en
#' tablas y textos; `dnis` son los documentos que se borran donde aparezcan.
#' @keywords internal
.pulso_anon_roster_mapa <- function(estado, sal) {
  reales <- character()
  codigos <- character()
  claves_por_nombre <- character()
  dnis <- character()
  pares <- character()                                 # código -> nombre real
  for (nodo in .pulso_anon_roster_listas(estado)) {
    ro <- .pulso_anon_roster_normalizar(nodo)
    if (is.null(ro)) next
    for (a in ro$assignments) {
      codigos <- c(codigos, a$codigo_pulso)
      dnis <- c(dnis, a$dni)
      # Un registro sin nombre lleva su código como nombre (el normalizador lo
      # rellena): no es una persona, y tratarlo como nombre convertiría el
      # código en seudónimo en todo el proyecto.
      if (identical(a$nombre, a$codigo_pulso)) next
      pares[[a$codigo_pulso]] <- a$nombre
      reales <- c(reales, a$nombre)
      claves_por_nombre[[a$nombre]] <- a$nombre_normalizado
    }
  }
  for (p in .pulso_anon_roster_planner(estado)) {
    nombre <- trimws(as.character(p$nombre %||% "")[1])
    codigo <- trimws(as.character(p$codigo %||% "")[1])
    if (!is.na(nombre) && nzchar(nombre) && !identical(nombre, codigo) &&
        !(nombre %in% names(claves_por_nombre))) {
      reales <- c(reales, nombre)
      claves_por_nombre[[nombre]] <- .monitoreo_territorial_enumerator_key(nombre)
    }
    if (!is.na(nombre) && nzchar(nombre) && nzchar(codigo) && !identical(nombre, codigo) && !(codigo %in% names(pares))) {
      pares[[codigo]] <- nombre
    }
    codigos <- c(codigos, codigo)
  }
  reales <- sort(unique(reales[nzchar(reales)]))
  claves_reales <- vapply(reales, .monitoreo_territorial_enumerator_key, character(1), USE.NAMES = FALSE)
  usadas <- character()
  fakes <- character()
  for (r in reales) {
    intento <- 0L
    repeat {
      h <- digest::digest(paste0(sal, "|roster|", r, "|", intento), algo = "sha256", serialize = FALSE)
      fake <- .pulso_pii_fake_nombre(h, componentes = 3L)
      if (identical(r, toupper(r))) fake <- toupper(fake)
      clave <- .monitoreo_territorial_enumerator_key(fake)
      if (!(clave %in% usadas) && !(clave %in% claves_reales)) break
      intento <- intento + 1L
    }
    usadas <- c(usadas, clave)
    fakes <- c(fakes, fake)
  }
  codigos <- unique(codigos[nzchar(codigos)])
  nuevos <- .pulso_anon_roster_recodificar(codigos, sal)
  cambian <- nuevos != codigos
  nombres <- stats::setNames(fakes, reales)
  claves <- stats::setNames(
    vapply(fakes, .monitoreo_territorial_enumerator_key, character(1), USE.NAMES = FALSE),
    unname(claves_por_nombre[reales]))
  claves <- claves[nzchar(names(claves)) & !is.na(names(claves)) & names(claves) != claves]
  dnis <- unique(dnis[nzchar(dnis) & !(dnis %in% codigos[cambian])])
  # Fuera de la lista sólo se barren nombres de dos piezas o más. Un nombre de
  # una sola palabra («ROSA») se comería texto ajeno —«Santa Rosa» es un
  # distrito—; en la lista se seudonimiza igual.
  sustituciones <- c(nombres[lengths(strsplit(trimws(names(nombres)), "\\s+")) >= 2L],
                     claves[grepl("_", names(claves), fixed = TRUE)])
  por_piezas <- .pulso_anon_roster_pares(nombres)
  # Por código: lo que dejan los responsables en claves y rótulos derivados del
  # DATO DE CAMPO («p446_apellido_nombre»), donde el nombre viene en otra variante
  # que la de la lista y no casa con ella.
  por_codigo <- data.frame(codigo = as.character(names(pares)), real = as.character(unname(pares)),
                           stringsAsFactors = FALSE)
  por_codigo$nuevo <- if (nrow(por_codigo)) .pulso_anon_roster_recodificar(por_codigo$codigo, sal) else character()
  por_codigo$fake <- if (nrow(por_codigo)) unname(nombres[por_codigo$real]) else character()
  por_codigo <- por_codigo[!is.na(por_codigo$fake), , drop = FALSE]
  llave <- tolower(gsub("\\s+", "_", por_codigo$fake))
  list(
    sal = sal,
    nombres = nombres,
    sustituciones = sustituciones,
    codigos = stats::setNames(nuevos[cambian], codigos[cambian]),
    dnis = dnis,
    por_codigo = por_codigo,
    pares = por_piezas,
    # Una sola pasada que descarta lo que no tiene dos piezas juntas de NADIE:
    # sin ella, un `grepl` por persona en cada columna costaba minutos.
    pares_prefiltro = if (length(por_piezas)) {
      alt <- paste0("(?:", paste(unique(unlist(lapply(por_piezas, function(p) {
        vapply(p$piezas, .pulso_anon_roster_patron_pieza, "")
      }))), collapse = "|"), ")")
      paste0("(*UCP)(?i)(?<![[:alpha:]])", alt, "[_ \u00b7,.\\-/\t]+", alt, "(?![[:alpha:]])")
    },
    # Los reemplazos de pares dependen del separador y de la caja de cada
    # aparición: se registran al marcar y se leen al restaurar.
    pares_env = new.env(parent = emptyenv()),
    # Reemplazos de la marca de llave: por código, el seudónimo, su llave en
    # minúsculas y en mayúsculas.
    llaves = as.vector(rbind(por_codigo$fake, llave, toupper(llave)))
  )
}

# Dos piezas DISTINTAS del nombre real, en cualquier orden, con `_`, espacio, `·`,
# coma, punto, guion, barra o tab entre ellas, sin distinguir caja ni tildes:
# «quispe_ana», «ROJAS QUISPE», «Quispe, Ana», «QUISPE-ROJAS».
# Es lo que queda cuando el nombre se escribe en otra variante y además con un
# código equivocado (acnur_acg: «p844_…» cuando la lista sólo tiene P884 y P824),
# donde ni el nombre exacto ni el código lo encuentran.
.PULSO_ANON_ROSTER_PIEZAS_RELLENO <- c("de", "del", "la", "las", "los", "y", "san", "santa")

.pulso_anon_roster_patron_pieza <- function(pieza) {
  clases <- c(a = "[a\u00e1\u00e0\u00e4\u00e2]", e = "[e\u00e9\u00e8\u00eb\u00ea]",
              i = "[i\u00ed\u00ec\u00ef\u00ee]", o = "[o\u00f3\u00f2\u00f6\u00f4]",
              u = "[u\u00fa\u00f9\u00fc\u00fb]", n = "[n\u00f1]")
  letras <- strsplit(pieza, "")[[1]]
  paste(ifelse(letras %in% names(clases), clases[letras], letras), collapse = "")
}

.pulso_anon_roster_pares <- function(nombres) {
  filas <- list()
  for (k in seq_along(nombres)) {
    reales <- strsplit(trimws(names(nombres)[[k]]), "\\s+")[[1]]
    ascii <- gsub("[^a-z]", "", tolower(iconv(enc2utf8(reales), "UTF-8", "ASCII//TRANSLIT", sub = "")))
    util <- nchar(ascii) >= 3L & !(ascii %in% .PULSO_ANON_ROSTER_PIEZAS_RELLENO)
    if (sum(util) < 2L) next
    fake <- strsplit(trimws(nombres[[k]]), "\\s+")[[1]]
    piezas <- ascii[util]
    destino <- fake[pmin(seq_along(piezas), length(fake))]
    alt <- paste0("(?:", paste(vapply(piezas, .pulso_anon_roster_patron_pieza, ""), collapse = "|"), ")")
    filas[[length(filas) + 1L]] <- list(
      piezas = piezas, destino = destino,
      patron = paste0("(*UCP)(?i)(?<![[:alpha:]])", alt, "(?:[_ \u00b7,.\\-/\t]+", alt, ")+(?![[:alpha:]])"))
  }
  filas
}

# Un tramo de dos o más piezas de la MISMA persona, en cualquier orden, cambia
# pieza por pieza a la que le toca en su seudónimo; el separador y la caja de cada
# pieza se conservan. Dos piezas juntas de una persona son su nombre aunque falte
# el resto o el código sea ajeno; una pieza suelta no, porque es un apellido común.
.pulso_anon_roster_marcar_pares <- function(v, mapa) {
  personas <- mapa$pares
  if (!length(personas) || !length(v)) return(v)
  candidatos <- grepl(mapa$pares_prefiltro, v, perl = TRUE)
  if (!any(candidatos)) return(v)
  v_todo <- v
  v <- v[candidatos]
  env <- mapa$pares_env
  caja <- function(x, molde) {
    if (identical(molde, toupper(molde))) return(toupper(x))
    if (identical(molde, tolower(molde))) return(tolower(x))
    paste0(toupper(substr(x, 1, 1)), tolower(substr(x, 2, nchar(x))))
  }
  for (p in personas) {
    hit <- grepl(p$patron, v, perl = TRUE)
    if (!any(hit)) next
    m <- gregexpr(p$patron, v[hit], perl = TRUE)
    regmatches(v[hit], m) <- lapply(regmatches(v[hit], m), function(ms) vapply(ms, function(tramo) {
      tokens <- regmatches(tramo, gregexpr("(*UCP)[[:alpha:]]+", tramo, perl = TRUE))[[1]]
      seps <- regmatches(tramo, gregexpr("(*UCP)[^[:alpha:]]+", tramo, perl = TRUE))[[1]]
      norm <- gsub("[^a-z]", "", tolower(iconv(enc2utf8(tokens), "UTF-8", "ASCII//TRANSLIT", sub = "")))
      # Una pieza repetida («Rosa rosa», «quispe_quispe») no son dos piezas: no es un nombre.
      if (length(unique(norm)) < 2L) return(tramo)
      nuevos <- vapply(seq_along(tokens), function(j) caja(p$destino[[match(norm[[j]], p$piezas)]], tokens[[j]]), "")
      reemplazo <- paste0(c(rbind(nuevos, c(seps, ""))), collapse = "")
      # Contador y no `length(ls(env))`: contar las claves en cada aparición es cuadrático.
      n <- (if (exists("n", envir = env, inherits = FALSE)) get("n", envir = env) else 0L) + 1L
      assign("n", n, envir = env)
      assign(paste0("k", n), reemplazo, envir = env)
      sprintf(.PULSO_ANON_ROSTER_PAR, n)
    }, character(1), USE.NAMES = FALSE))
  }
  v_todo[candidatos] <- v
  v_todo
}

# Piezas de un nombre para compararlo con una variante: sin tildes, en minúsculas
# y de tres letras o más.
.pulso_anon_roster_piezas <- function(x) {
  x <- tolower(iconv(enc2utf8(as.character(x)), "UTF-8", "ASCII//TRANSLIT", sub = ""))
  p <- strsplit(x, "[^a-z]+")[[1]]
  unique(p[nchar(p) >= 3L])
}

#' Reescribe por CÓDIGO las claves «pXXX_variante» y los rótulos «PXXX · variante»
#' cuyo nombre comparte alguna pieza con el de la persona de ese código.
#'
#' Medido en acnur_acg: las anulaciones de producción guardan al responsable como
#' `production_annulment_key("P446 · ...")`, una variante del nombre sacada del
#' dato de campo (otro orden, otras piezas) que no casa con la lista. 7 de los 26
#' encuestadores salían así. Exigir una pieza compartida evita reescribir lo que
#' acompaña a un código sin ser su persona («p003_sin_dato»). Trabaja en bytes: los
#' códigos y las claves son ASCII y los tokens de caché pesan cientos de KB.
#' @keywords internal
.pulso_anon_roster_por_codigo <- function(v, mapa) {
  pc <- mapa$por_codigo
  if (is.null(pc) || !nrow(pc) || !length(v)) return(v)
  codigos_re <- paste(.pulso_pii_escape_regex(pc$codigo), collapse = "|")
  re_llave <- paste0("(?i)(?<![A-Za-z0-9])(", codigos_re, ")_((?:[A-Za-z]+_)*[A-Za-z]+)(?![A-Za-z0-9])")
  re_rotulo <- paste0("(?i)(?<![A-Za-z0-9])(", codigos_re, ") \u00b7 ((?:[A-Za-z]|[\\x80-\\xff])+",
                      "(?: (?:[A-Za-z]|[\\x80-\\xff])+)*)")
  piezas_reales <- lapply(pc$real, .pulso_anon_roster_piezas)
  fila <- function(cod) match(toupper(cod), toupper(pc$codigo))
  comparte <- function(i, variante) any(.pulso_anon_roster_piezas(variante) %in% piezas_reales[[i]])
  # «p446» en una clave sigue en minúsculas; un DNI no tiene caja y el código nuevo va como en la lista.
  codigo_en_su_caja <- function(original, nuevo) {
    if (grepl("[a-z]", original) && !grepl("[A-Z]", original)) tolower(nuevo) else nuevo
  }
  reescribir <- function(x, re, armar) {
    hit <- grepl(re, x, perl = TRUE, useBytes = TRUE)
    if (!any(hit)) return(x)
    m <- gregexpr(re, x[hit], perl = TRUE, useBytes = TRUE)
    regmatches(x[hit], m) <- lapply(regmatches(x[hit], m), function(ms) vapply(ms, armar, character(1), USE.NAMES = FALSE))
    x
  }
  v <- reescribir(v, re_llave, function(s) {
    cod <- sub(re_llave, "\\1", s, perl = TRUE, useBytes = TRUE)
    resto <- sub(re_llave, "\\2", s, perl = TRUE, useBytes = TRUE)
    i <- fila(cod)
    if (is.na(i) || !comparte(i, resto)) return(s)
    caja <- if (identical(resto, toupper(resto))) 3L else 2L
    paste0(codigo_en_su_caja(cod, pc$nuevo[[i]]), "_", sprintf(.PULSO_ANON_ROSTER_LLAVE, 3L * (i - 1L) + caja))
  })
  v <- reescribir(v, re_rotulo, function(s) {
    cod <- sub(re_rotulo, "\\1", s, perl = TRUE, useBytes = TRUE)
    resto <- sub(re_rotulo, "\\2", s, perl = TRUE, useBytes = TRUE)
    Encoding(resto) <- "UTF-8"
    i <- fila(cod)
    if (is.na(i) || !comparte(i, resto)) return(s)
    paste0(codigo_en_su_caja(cod, pc$nuevo[[i]]), " \u00b7 ", sprintf(.PULSO_ANON_ROSTER_LLAVE, 3L * (i - 1L) + 1L))
  })
  Encoding(v) <- "UTF-8"
  v
}

# -----------------------------------------------------------------------------
# Aplicar sobre el estado
# -----------------------------------------------------------------------------

#' Reescribe las listas de encuestadores y la asignación territorial de Material.
#' @keywords internal
.pulso_anon_roster_aplicar <- function(estado, mapa) {
  n <- 0L
  estado <- .pulso_anon_roster_map(estado, function(nodo, ruta) {
    ro <- .pulso_anon_roster_normalizar(nodo)
    if (is.null(ro)) return(nodo)
    asignaciones <- lapply(ro$assignments, function(a) {
      codigo <- .pulso_anon_roster_recodificar(a$codigo_pulso, mapa$sal)
      if (identical(a$nombre, a$codigo_pulso)) {
        return(list(codigo_pulso = codigo, nombre = codigo,
                    nombre_normalizado = .monitoreo_territorial_enumerator_key(codigo),
                    dni = "", source_row = a$source_row))
      }
      fake <- unname(mapa$nombres[a$nombre])
      if (is.na(fake)) fake <- .pulso_pii_fake_nombre(
        digest::digest(paste0(mapa$sal, "|roster|", a$nombre), algo = "sha256", serialize = FALSE), 3L)
      list(codigo_pulso = codigo,
           nombre = fake,
           nombre_normalizado = .monitoreo_territorial_enumerator_key(fake),
           dni = "",
           source_row = a$source_row)
    })
    n <<- n + length(asignaciones)
    # Los alias de lectura llevarían la lista original intacta al lado de la nueva.
    nodo$asignaciones <- NULL
    nodo$encuestadores <- NULL
    if (!is.null(nodo$code_format)) nodo$code_format <- ro$code_format
    if (!is.null(nodo$total)) nodo$total <- length(asignaciones)
    nodo$assignments <- asignaciones
    nodo
  })
  mta <- estado$material_territorial_asignacion
  n_asig <- 0L
  if (is.list(mta) && is.list(mta$asignacion)) {
    mta$asignacion <- lapply(mta$asignacion, function(a) {
      if (!is.list(a) || is.null(a$codigo)) return(a)
      nuevo <- .pulso_anon_roster_recodificar(a$codigo, mapa$sal)
      if (!identical(nuevo, as.character(a$codigo))) n_asig <<- n_asig + 1L
      a$codigo <- nuevo
      a
    })
    estado$material_territorial_asignacion <- mta
  }
  personas <- .pulso_anon_roster_planner(estado)
  if (length(personas)) {
    estado$planner$equipo$personas <- lapply(personas, function(p) {
      nombre <- trimws(as.character(p$nombre %||% "")[1])
      codigo <- trimws(as.character(p$codigo %||% "")[1])
      nuevo_codigo <- .pulso_anon_roster_recodificar(codigo, mapa$sal)
      if (!is.na(nombre) && nzchar(nombre)) {
        p$nombre <- if (identical(nombre, codigo)) nuevo_codigo else unname(mapa$nombres[nombre])
      }
      if (!is.null(p$codigo)) p$codigo <- nuevo_codigo
      p
    })
    n <- n + length(personas)
  }
  list(estado = estado, encuestadores = n, asignaciones_recodificadas = n_asig)
}

# -----------------------------------------------------------------------------
# Barrido de tablas derivadas
# -----------------------------------------------------------------------------

# Se barre en DOS tiempos alrededor de `pulso_anonimizar_abiertas`. Si el nombre
# real se cambiara de una vez por su seudónimo, el barrido de abiertas —que corre
# después sobre columnas de texto libre— vería piezas del catálogo («Quispe»,
# «Rojas») que también son apellidos reales del diccionario y las volvería a
# cambiar: «P001 · Ana Quispe Rojas» acabaría distinto de la lista. Por eso
# primero se pone una marca neutra que ningún barrido reconoce y, después de las
# abiertas, la marca se cambia por el seudónimo.
.pulso_anon_roster_columna <- function(col, fn) {
  if (is.factor(col)) {
    levels(col) <- fn(levels(col))
    return(col)
  }
  if (!is.character(col)) return(col)
  fn(col)
}

#' @keywords internal
.pulso_anon_roster_marcar <- function(df, mapa) {
  if (!is.data.frame(df) || !ncol(df) ||
      (!length(mapa$sustituciones) && !length(mapa$codigos) && !NROW(mapa$por_codigo) && !length(mapa$pares))) {
    return(list(data = df, reemplazos = 0L))
  }
  reales <- names(mapa$sustituciones)
  orden <- order(-nchar(reales))
  patron_nombres <- if (length(reales)) {
    paste0("(*UCP)(?i)(?<![[:alnum:]])(", paste(.pulso_pii_escape_regex(reales[orden]), collapse = "|"),
           ")(?![[:alnum:]])")
  }
  patron_codigos <- if (length(mapa$codigos)) {
    paste0("(?<![0-9A-Z])(", paste(.pulso_pii_escape_regex(names(mapa$codigos)), collapse = "|"), ")(?![0-9A-Z])")
  }
  patron_dnis <- if (length(mapa$dnis)) {
    paste0("(?<![0-9])(", paste(.pulso_pii_escape_regex(mapa$dnis), collapse = "|"), ")(?![0-9])")
  }
  reemplazos <- 0L
  barrer <- function(v) {
    antes <- v
    # Primero por código, con los códigos y nombres originales todavía en su sitio.
    if (NROW(mapa$por_codigo)) {
      u0 <- unique(v[!is.na(v)])
      u1 <- .pulso_anon_roster_por_codigo(u0, mapa)
      cambia <- u1 != u0
      if (any(cambia)) {
        k <- match(v, u0[cambia])
        v[!is.na(k)] <- u1[cambia][k[!is.na(k)]]
      }
    }
    u <- unique(v[!is.na(v)])
    if (!is.null(patron_codigos) && any(grepl(patron_codigos, u, perl = TRUE))) {
      for (cod in names(mapa$codigos)) {
        v <- gsub(paste0("(?<![0-9A-Z])", .pulso_pii_escape_regex(cod), "(?![0-9A-Z])"),
                  mapa$codigos[[cod]], v, perl = TRUE)
      }
    }
    if (!is.null(patron_dnis) && any(grepl(patron_dnis, u, perl = TRUE))) {
      v <- gsub(patron_dnis, "", v, perl = TRUE)
    }
    if (!is.null(patron_nombres) && any(grepl(patron_nombres, u, perl = TRUE))) {
      for (i in orden) {
        v <- gsub(paste0("(*UCP)(?i)(?<![[:alnum:]])", .pulso_pii_escape_regex(reales[[i]]), "(?![[:alnum:]])"),
                  sprintf(.PULSO_ANON_ROSTER_MARCA, i), v, perl = TRUE)
      }
    }
    if (length(mapa$pares)) {
      u0 <- unique(v[!is.na(v)])
      u1 <- .pulso_anon_roster_marcar_pares(u0, mapa)
      cambia <- u1 != u0
      if (any(cambia)) {
        k <- match(v, u0[cambia])
        v[!is.na(k)] <- u1[cambia][k[!is.na(k)]]
      }
    }
    reemplazos <<- reemplazos + sum(!is.na(v) & v != antes)
    v
  }
  for (i in seq_along(df)) df[[i]] <- .pulso_anon_roster_columna(df[[i]], barrer)
  list(data = df, reemplazos = as.integer(reemplazos))
}

#' @keywords internal
.pulso_anon_roster_restaurar <- function(df, mapa) {
  if (!is.data.frame(df) || !ncol(df) || (!length(mapa$sustituciones) && !length(mapa$llaves) && !length(mapa$pares))) {
    return(df)
  }
  fakes <- unname(mapa$sustituciones)
  llaves <- mapa$llaves %||% character()
  restaurar <- function(v) {
    if (any(grepl("PULSOROSTER", v, fixed = TRUE))) {
      for (i in seq_along(fakes)) v <- gsub(sprintf(.PULSO_ANON_ROSTER_MARCA, i), fakes[[i]], v, fixed = TRUE)
    }
    if (any(grepl("PULSOLLAVE", v, fixed = TRUE))) {
      for (i in seq_along(llaves)) v <- gsub(sprintf(.PULSO_ANON_ROSTER_LLAVE, i), llaves[[i]], v, fixed = TRUE)
    }
    if (any(grepl("PULSOPAR", v, fixed = TRUE)) && !is.null(mapa$pares_env)) {
      hit <- grepl("PULSOPAR", v, fixed = TRUE)
      m <- gregexpr("\u2063PULSOPAR([0-9]{5})\u2063", v[hit], perl = TRUE)
      regmatches(v[hit], m) <- lapply(regmatches(v[hit], m), function(ms) vapply(ms, function(t) {
        get(paste0("k", as.integer(sub("\u2063PULSOPAR([0-9]{5})\u2063", "\\1", t, perl = TRUE))), envir = mapa$pares_env)
      }, character(1), USE.NAMES = FALSE))
    }
    v
  }
  for (i in seq_along(df)) df[[i]] <- .pulso_anon_roster_columna(df[[i]], restaurar)
  df
}

#' Las mismas sustituciones sobre los textos del estado que NO son tablas.
#'
#' Monitoreo guarda en `monitoreo_dashboard_cache_token*` la configuración entera
#' serializada en JSON —cientos de KB por token, lista de encuestadores incluida
#' con nombre y DNI—. Medido en `acnur_acg`: con la lista ya anonimizada, sus 26
#' DNI y los nombres seguían ahí, en siete tokens. Se barre todo vector de texto
#' fuera de una tabla: los nombres de la lista son lo bastante específicos para
#' cambiarlos donde aparezcan, y como el reemplazo es el mismo que sufrió la
#' configuración (`"dni":"..."` -> `"dni":""`, nombre -> seudónimo), el token
#' sigue describiendo la configuración anonimizada.
#'
#' En dos pasadas y no vector por vector: el estado de `acnur_acg` tiene 1,16
#' millones de textos sueltos y barrer cada uno con las expresiones del mapa
#' costaba ~0,9 ms (un cuarto de hora). Se transforman una vez los valores
#' únicos y luego se sustituye por búsqueda exacta.
#' @keywords internal
.pulso_anon_roster_barrer_textos <- function(estado, mapa) {
  if (!length(mapa$sustituciones) && !length(mapa$codigos) && !length(mapa$dnis) && !NROW(mapa$por_codigo)) return(estado)
  # Recursión por `lapply` y sin `tryCatch` por elemento: acumular en una lista
  # de un environment copiaba la lista en cada inserción (cuadrático), y un
  # `tryCatch` por cada uno de los millones de textos dominaba el tiempo. El
  # `tryCatch` queda por NODO, para las ramas que `is.list()` acepta pero no se
  # dejan recorrer (ver `.pulso_anon_reemplazar_strings`).
  valores <- unique(.pulso_anon_roster_recolectar_textos(estado))
  valores <- valores[!is.na(valores) & nzchar(valores)]
  if (!length(valores)) return(estado)
  nuevos <- .pulso_anon_roster_transformar_textos(valores, mapa)
  cambia <- nuevos != valores
  if (!any(cambia)) return(estado)
  antes <- valores[cambia]; despues <- nuevos[cambia]
  # Búsqueda en un environment y no con `match()`: `match` rehace el hash de
  # `antes` en CADA llamada, y aquí son ~1,2 millones de textos sueltos contra
  # miles de valores cambiados (minutos). Un environment se arma una vez.
  # Un nombre de environment no pasa de 10.000 bytes; los tokens de caché pesan
  # cientos de KB. Esos pocos van por `match` aparte.
  largo <- nchar(antes, type = "bytes") > 9000L
  largos_antes <- antes[largo]; largos_despues <- despues[largo]
  tabla <- new.env(hash = TRUE, parent = emptyenv(), size = max(1L, sum(!largo)))
  for (i in which(!largo)) assign(antes[[i]], despues[[i]], envir = tabla)
  traducir <- function(x) {
    if (!length(x)) return(x)
    hay <- !is.na(x) & nzchar(x)
    if (!any(hay)) return(x)
    idx <- which(hay)
    nuevo <- vapply(x[idx], function(k) {
      if (nchar(k, type = "bytes") > 9000L) {
        j <- match(k, largos_antes)
        return(if (is.na(j)) NA_character_ else largos_despues[[j]])
      }
      r <- get0(k, envir = tabla, inherits = FALSE)
      if (is.null(r)) NA_character_ else r
    }, character(1), USE.NAMES = FALSE)
    cambia <- !is.na(nuevo)
    if (any(cambia)) x[idx[cambia]] <- nuevo[cambia]
    x
  }
  reemplazar <- function(x, profundidad) {
    if (is.character(x)) return(traducir(x))
    if (profundidad > .PULSO_ANON_MAX_PROFUNDIDAD || is.data.frame(x) || !is.list(x) || !length(x)) return(x)
    nuevo <- tryCatch({
      y <- x
      y[] <- lapply(x, reemplazar, profundidad = profundidad + 1L)
      nms <- names(y)
      if (!is.null(nms)) {
        nms2 <- traducir(nms)
        if (!identical(nms2, nms)) names(y) <- nms2
      }
      y
    }, error = function(e) x)
    nuevo
  }
  reemplazar(estado, 0L)
}

# Los valores de texto fuera de las tablas y también los NOMBRES de las listas: un
# nombre de persona puede vivir como clave («$responsables$p446_...»).
.pulso_anon_roster_recolectar_textos <- function(x, profundidad = 0L) {
  if (is.character(x)) return(x)
  if (profundidad > .PULSO_ANON_MAX_PROFUNDIDAD || is.data.frame(x) || !is.list(x) || !length(x)) return(NULL)
  tryCatch(c(names(x), unlist(lapply(x, .pulso_anon_roster_recolectar_textos, profundidad = profundidad + 1L),
                              use.names = FALSE)),
           error = function(e) NULL)
}

.pulso_anon_roster_transformar_textos <- function(x, mapa) {
  # Con formato DNI el documento es también el código, así que no está en
  # `mapa$dnis`: el campo `dni` serializado se vacía como en la lista.
  serializada <- grepl("\"enumerator_roster\"", x, fixed = TRUE)
  if (any(serializada)) {
    m <- gregexpr("\"assignments\":\\[[^]]*\\]", x[serializada], perl = TRUE)
    regmatches(x[serializada], m) <- lapply(regmatches(x[serializada], m), function(seg) {
      gsub("\"dni\":\"[^\"]*\"", "\"dni\":\"\"", seg, perl = TRUE)
    })
  }
  tabla <- data.frame(v = x, stringsAsFactors = FALSE)
  .pulso_anon_roster_restaurar(.pulso_anon_roster_marcar(tabla, mapa)$data, mapa)$v
}

# Segmentos `"assignments":[...]` de una lista serializada en JSON dentro de un
# texto del estado (los tokens de caché de Monitoreo).
.pulso_anon_roster_textos_con_lista <- function(x, ruta = "state", profundidad = 0L) {
  out <- list()
  if (profundidad > .PULSO_ANON_MAX_PROFUNDIDAD || is.data.frame(x)) return(out)
  if (is.character(x)) {
    v <- x[!is.na(x) & grepl("\"enumerator_roster\"", x, fixed = TRUE)]
    if (length(v)) out[[ruta]] <- v
    return(out)
  }
  if (!is.list(x)) return(out)
  nms <- names(x)
  for (i in seq_along(x)) {
    etiqueta <- if (!is.null(nms) && nzchar(nms[[i]] %||% "")) nms[[i]] else paste0("[[", i, "]]")
    out <- c(out, .pulso_anon_roster_textos_con_lista(x[[i]], paste0(ruta, "$", etiqueta), profundidad + 1L))
  }
  out
}

.pulso_anon_roster_campos_json <- function(textos, campo) {
  segmentos <- unlist(regmatches(textos, gregexpr("\"assignments\":\\[[^]]*\\]", textos, perl = TRUE)))
  if (!length(segmentos)) return(character())
  m <- unlist(regmatches(segmentos, gregexpr(paste0("\"", campo, "\":\"[^\"]*\""), segmentos, perl = TRUE)))
  sub(paste0("^\"", campo, "\":\"(.*)\"$"), "\\1", m)
}

# -----------------------------------------------------------------------------
# Excel de origen de la lista
# -----------------------------------------------------------------------------

.pulso_anon_roster_fuentes <- function(estado, files_dir) {
  if (!dir.exists(files_dir)) return(character())
  fids <- unlist(lapply(.pulso_anon_roster_listas(estado), function(nodo) {
    as.character(nodo$source_file_id %||% nodo$sourceFileId %||% "")
  }), use.names = FALSE)
  fids <- unique(fids[nzchar(fids)])
  if (!length(fids)) return(character())
  archivos <- list.files(files_dir, full.names = TRUE, recursive = TRUE)
  archivos[sub("__.*$", "", basename(archivos)) %in% fids]
}

#' El Excel con el que se subió la lista viaja en `files/` con los nombres en
#' columnas («AP PATERNO», «AP MATERNO») que el clasificador por nombre no
#' reconoce, y a veces con la cabecera varias filas más abajo. No se intenta
#' anonimizarlo celda a celda: se regenera entero desde la lista ya anonimizada,
#' con la forma de la plantilla de Monitoreo y el DNI vacío.
#' @keywords internal
.pulso_anon_roster_reescribir_fuentes <- function(estado, files_dir) {
  archivos <- .pulso_anon_roster_fuentes(estado, files_dir)
  if (!length(archivos)) return(0L)
  items <- unlist(lapply(.pulso_anon_roster_listas(estado), .pulso_anon_roster_items), recursive = FALSE)
  nombres <- vapply(items, function(a) as.character(a$nombre %||% ""), character(1))
  partes <- strsplit(nombres, " ", fixed = TRUE)
  pieza <- function(k) vapply(partes, function(p) if (length(p) >= k) p[[k]] else "", character(1))
  tabla <- data.frame(seq_along(items), pieza(2L), pieza(3L), pieza(1L), rep("", length(items)),
                      vapply(items, function(a) as.character(a$codigo_pulso %||% ""), character(1)),
                      stringsAsFactors = FALSE)
  names(tabla) <- .PULSO_ANON_ROSTER_CABECERAS
  for (p in archivos) {
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "Encuestadores")
    openxlsx::writeData(wb, "Encuestadores", tabla)
    openxlsx::saveWorkbook(wb, p, overwrite = TRUE)
  }
  length(archivos)
}

# -----------------------------------------------------------------------------
# XML crudo de los xlsx de files/
# -----------------------------------------------------------------------------

# Las partes de un xlsx que llevan texto de celda.
.PULSO_ANON_XLSX_PARTES_TEXTO <- "^xl/(sharedStrings|worksheets/sheet[0-9]+)\\.xml$"

#' Barre con el mapa del equipo el XML de TODO xlsx de `files/`.
#'
#' Dos cosas dejaban pasar a los encuestadores aquí. El barrido genérico salta
#' las hojas del instrumento (survey/choices/settings), y la lista de
#' encuestadores de un XLSForm de ocurrencias vive justo en `choices`
#' («P316 · Nombre»). Y un xlsx que readxl no abre —al de `acnur_acg` le falta
#' `_rels/.rels`— se lee como vacío y no se toca. Trabajar sobre el XML evita las
#' dos: no depende de que el archivo se pueda abrir ni de cómo se llame la hoja,
#' y como sólo cambia los nombres, códigos y DNI del mapa, no altera el
#' instrumento. El zip se rearma con las mismas entradas en el mismo orden.
#' @keywords internal
.pulso_anon_roster_barrer_xlsx_crudo <- function(files_dir, mapa) {
  if (!dir.exists(files_dir) || (!length(mapa$sustituciones) && !length(mapa$codigos) && !length(mapa$dnis) && !NROW(mapa$por_codigo))) {
    return(0L)
  }
  archivos <- list.files(files_dir, full.names = TRUE, recursive = TRUE)
  archivos <- archivos[grepl("\\.xls[xm]$", tolower(archivos))]
  tocados <- 0L
  for (p in archivos) {
    entradas <- tryCatch(zip::zip_list(p)$filename, error = function(e) NULL)
    if (is.null(entradas)) next
    partes <- entradas[grepl(.PULSO_ANON_XLSX_PARTES_TEXTO, entradas)]
    if (!length(partes)) next
    dir <- tempfile("xlsx-crudo-"); dir.create(dir)
    zip::unzip(p, exdir = dir)
    cambio <- FALSE
    for (parte in partes) {
      f <- file.path(dir, parte)
      xml <- readChar(f, file.info(f)$size, useBytes = TRUE)
      Encoding(xml) <- "UTF-8"
      nuevo <- .pulso_anon_roster_transformar_textos(xml, mapa)
      if (!identical(nuevo, xml)) {
        writeChar(nuevo, f, eos = NULL, useBytes = TRUE)
        cambio <- TRUE
      }
    }
    if (cambio) {
      archivos_zip <- entradas[!grepl("/$", entradas)]
      unlink(p, force = TRUE)
      zip::zip(zipfile = p, files = archivos_zip, root = dir)
      tocados <- tocados + 1L
    }
    unlink(dir, recursive = TRUE, force = TRUE)
  }
  tocados
}

# Texto de las celdas de un xlsx leído del XML, se abra o no con readxl.
.pulso_anon_xlsx_textos_crudos <- function(path) {
  entradas <- tryCatch(zip::zip_list(path)$filename, error = function(e) character())
  partes <- entradas[grepl(.PULSO_ANON_XLSX_PARTES_TEXTO, entradas)]
  if (!length(partes)) return(character())
  dir <- tempfile("xlsx-txt-"); dir.create(dir)
  on.exit(unlink(dir, recursive = TRUE, force = TRUE), add = TRUE)
  zip::unzip(path, files = partes, exdir = dir)
  textos <- unlist(lapply(partes, function(parte) {
    f <- file.path(dir, parte)
    xml <- readChar(f, file.info(f)$size, useBytes = TRUE)
    Encoding(xml) <- "UTF-8"
    # `useBytes`: sobre un XML UTF-8 de varios MB, `gregexpr` convierte offsets de
    # carácter en cada coincidencia y se vuelve cuadrático (316 s por un xlsx de
    # 1 MB en acnur_acg). En bytes es lineal y las etiquetas son ASCII.
    m <- regmatches(xml, gregexpr("<t(\\s[^>]*)?>[^<]*</t>", xml, perl = TRUE, useBytes = TRUE))[[1]]
    out <- sub("^<t(\\s[^>]*)?>([^<]*)</t>$", "\\2", m, perl = TRUE, useBytes = TRUE)
    Encoding(out) <- "UTF-8"
    out
  }), use.names = FALSE)
  textos <- gsub("&lt;", "<", gsub("&gt;", ">", gsub("&quot;", "\"", gsub("&apos;", "'", textos, fixed = TRUE),
                                                     fixed = TRUE), fixed = TRUE), fixed = TRUE)
  gsub("&amp;", "&", textos, fixed = TRUE)
}

# «P316 · Nombre»: la forma en que Monitoreo y los XLSForm de ocurrencias nombran
# al encuestador. Es una firma que el gate SÍ puede juzgar sin la lista real: el
# código va delante y lo que sigue tiene que ser un seudónimo del catálogo.
.PULSO_ANON_ROSTER_DISPLAY_RE <- "^\\s*(P[0-9]{3}|ANON[0-9A-F]{6}|[0-9]{6,12})\\s+\u00b7\\s+(.+?)\\s*$"

# Lo que acompaña a un código sin ser una persona: sólo palabras de relleno.
.pulso_anon_roster_no_nombre <- function(x) {
  vapply(tolower(as.character(x)), function(t) {
    p <- strsplit(t, "[^a-z]+")[[1]]; p <- p[nzchar(p)]
    length(p) > 0L && all(p %in% .PULSO_ANON_ROSTER_NO_NOMBRE)
  }, logical(1), USE.NAMES = FALSE)
}

# «p446_apellido_nombre»: la clave con que las anulaciones de producción guardan
# al responsable. Misma firma que el rótulo: lo que sigue al código tiene que ser
# un seudónimo del catálogo.
.PULSO_ANON_ROSTER_LLAVE_RE <- "(?i)^(P[0-9]{3}|ANON[0-9A-F]{6})_([a-z]+(?:_[a-z]+)+)$"

.pulso_anon_roster_llave_hallazgos <- function(v) {
  v <- unique(as.character(v[!is.na(v)]))
  v <- v[grepl(.PULSO_ANON_ROSTER_LLAVE_RE, v, perl = TRUE)]
  if (!length(v)) return(character())
  resto <- gsub("_", " ", sub(.PULSO_ANON_ROSTER_LLAVE_RE, "\\2", v, perl = TRUE))
  resto[!.pulso_anon_roster_firmado(resto) & !.pulso_anon_roster_no_nombre(resto)]
}

.pulso_anon_roster_display_hallazgos <- function(v) {
  v <- unique(as.character(v[!is.na(v)]))
  v <- v[grepl(.PULSO_ANON_ROSTER_DISPLAY_RE, v, perl = TRUE)]
  if (!length(v)) return(list(nombres = character(), documentos = character()))
  codigo <- sub(.PULSO_ANON_ROSTER_DISPLAY_RE, "\\1", v, perl = TRUE)
  nombre <- sub(.PULSO_ANON_ROSTER_DISPLAY_RE, "\\2", v, perl = TRUE)
  list(nombres = nombre[!.pulso_anon_roster_firmado(nombre) & nombre != codigo & !.pulso_anon_roster_no_nombre(nombre)],
       # Aquí sólo cuenta como documento un DNI (8 dígitos, no una fecha), como en el
       # resto del gate: delante del « · » también van ids de respuesta de 7 dígitos.
       documentos = codigo[grepl("^[0-9]{8}$", codigo) & !.pulso_pii_solo_fechas_compactas(codigo)])
}

# -----------------------------------------------------------------------------
# Gate
# -----------------------------------------------------------------------------

.pulso_anon_roster_hallazgo <- function(ruta, columna, tipo, valores) {
  # Truncado, como el padrón: el detector avisa de que hay PII, no la muestra.
  data.frame(ruta = ruta, columna = columna, tipo = tipo, n = length(valores),
             ejemplo = paste0(substr(valores[[1]], 1, 2), "…"), stringsAsFactors = FALSE)
}

.pulso_anon_roster_codigo_ok <- function(codigo) !.pulso_anon_roster_codigo_es_documento(codigo)

#' Hallazgos de PII en las listas de encuestadores, la asignación territorial y
#' el Excel de origen de la lista. Lo usa `pulso_detectar_pii()`.
#' @keywords internal
.pulso_anon_roster_hallazgos <- function(estado, files_dir) {
  out <- list()
  agregar <- function(ruta, columna, tipo, valores) {
    valores <- valores[!is.na(valores) & nzchar(valores)]
    if (length(valores)) out[[length(out) + 1L]] <<- .pulso_anon_roster_hallazgo(ruta, columna, tipo, valores)
  }
  listas <- if (is.list(estado)) .pulso_anon_roster_listas(estado) else list()
  for (ruta in names(listas)) {
    items <- .pulso_anon_roster_items(listas[[ruta]])
    if (!length(items)) next
    campo <- function(k) vapply(items, function(a) trimws(paste(as.character(unlist(a[[k]])), collapse = " ")),
                                character(1))
    codigos <- campo("codigo_pulso")
    nombres <- campo("nombre")
    agregar(ruta, "dni", "dni_pe", campo("dni"))
    agregar(ruta, "nombre", "nombre", nombres[!.pulso_anon_roster_firmado(nombres) & nombres != codigos])
    norm <- campo("nombre_normalizado")
    clave_codigo <- vapply(codigos, .monitoreo_territorial_enumerator_key, character(1), USE.NAMES = FALSE)
    agregar(ruta, "nombre_normalizado", "nombre", norm[!.pulso_anon_roster_firmado(norm) & norm != clave_codigo])
    agregar(ruta, "codigo_pulso", "documento", codigos[!.pulso_anon_roster_codigo_ok(codigos)])
    # Un campo que la lista normalizada no tiene (correo, apellidos sueltos) sólo
    # puede venir de una lista cruda: no se adivina si es PII, se marca.
    extras <- setdiff(unique(unlist(lapply(items, names))), .PULSO_ANON_ROSTER_CAMPOS)
    for (k in extras) agregar(ruta, k, "campo_no_esperado", campo(k))
  }
  # La lista también viaja serializada dentro de textos (tokens de caché).
  textos <- if (is.list(estado)) .pulso_anon_roster_textos_con_lista(estado) else list()
  for (ruta in names(textos)) {
    agregar(ruta, "dni", "dni_pe", .pulso_anon_roster_campos_json(textos[[ruta]], "dni"))
    nombres <- .pulso_anon_roster_campos_json(textos[[ruta]], "nombre")
    codigos <- .pulso_anon_roster_campos_json(textos[[ruta]], "codigo_pulso")
    sin_firma <- !.pulso_anon_roster_firmado(nombres)
    if (length(codigos) == length(nombres)) sin_firma <- sin_firma & nombres != codigos
    agregar(ruta, "nombre", "nombre", nombres[sin_firma])
  }
  # «CÓDIGO · Nombre» en tablas, en textos fuera de tablas y en el XML de todo
  # xlsx de files/ (legible o no).
  agregar_display <- function(ruta, columna, v) {
    d <- .pulso_anon_roster_display_hallazgos(v)
    agregar(ruta, columna, "nombre", d$nombres)
    agregar(ruta, columna, "documento", d$documentos)
    agregar(ruta, columna, "nombre", .pulso_anon_roster_llave_hallazgos(v))
  }
  if (is.list(estado)) {
    .pulso_anon_walk_dataframes(estado, function(df, ruta) {
      for (nm in names(df)) {
        col <- df[[nm]]
        if (is.factor(col)) col <- levels(col)
        if (is.character(col)) agregar_display(ruta, nm, col)
      }
    }, ruta = "state")
    agregar_display("state (textos fuera de tablas)", "*", .pulso_anon_roster_recolectar_textos(estado))
  }
  if (dir.exists(files_dir)) {
    xlsx <- list.files(files_dir, full.names = TRUE, recursive = TRUE)
    for (p in xlsx[grepl("\\.xls[xm]$", tolower(xlsx))]) {
      agregar_display(paste0(basename(p), " (xml)"), "*", .pulso_anon_xlsx_textos_crudos(p))
    }
  }
  mta <- if (is.list(estado)) estado$material_territorial_asignacion else NULL
  if (is.list(mta) && is.list(mta$asignacion)) {
    cod <- vapply(Filter(is.list, mta$asignacion), function(a) as.character(a$codigo %||% ""), character(1))
    agregar("state$material_territorial_asignacion", "codigo", "documento", cod[!.pulso_anon_roster_codigo_ok(cod)])
  }
  personas <- .pulso_anon_roster_planner(estado)
  if (length(personas)) {
    campo <- function(k) vapply(personas, function(p) trimws(paste(as.character(unlist(p[[k]])), collapse = " ")),
                                character(1))
    nombres <- campo("nombre"); codigos <- campo("codigo")
    agregar("state$planner$equipo$personas", "nombre", "nombre",
            nombres[!.pulso_anon_roster_firmado(nombres) & nombres != codigos])
    agregar("state$planner$equipo$personas", "codigo", "documento", codigos[!.pulso_anon_roster_codigo_ok(codigos)])
    # Un campo nuevo en `planner_equipo/v1` (DNI, teléfono, correo) no se anonimiza
    # hasta que alguien lo agregue aquí: el gate lo marca en vez de dejarlo pasar.
    extras <- setdiff(unique(unlist(lapply(personas, names))), c("codigo", "nombre", "rol", "perfiles", "activo"))
    for (k in extras) agregar("state$planner$equipo$personas", k, "campo_no_esperado", campo(k))
  }
  for (p in .pulso_anon_roster_fuentes(estado, files_dir)) {
    hojas <- tryCatch(readxl::excel_sheets(p), error = function(e) character())
    for (h in hojas) {
      celdas <- tryCatch(unlist(readxl::read_excel(p, sheet = h, col_names = FALSE, col_types = "text",
                                                   .name_repair = "minimal"),
                                use.names = FALSE), error = function(e) character())
      celdas <- trimws(celdas[!is.na(celdas)])
      ruta <- paste0(basename(p), "!", h)
      con_letras <- grepl("(*UCP)[[:alpha:]]", celdas, perl = TRUE) &
        !(toupper(celdas) %in% .PULSO_ANON_ROSTER_CABECERAS) &
        !grepl(.PULSO_ANON_ROSTER_PXXX_RE, celdas) & !grepl(.PULSO_ANON_ROSTER_CODIGO_RE, celdas) &
        !.pulso_anon_roster_firmado(celdas)
      agregar(ruta, "*", "nombre", celdas[con_letras])
      ocho <- grepl("(?<![0-9])[0-9]{8}(?![0-9])", celdas, perl = TRUE) & !.pulso_pii_solo_fechas_compactas(celdas)
      agregar(ruta, "*", "dni_pe", celdas[ocho])
    }
  }
  if (!length(out)) {
    return(data.frame(ruta = character(), columna = character(), tipo = character(),
                      n = integer(), ejemplo = character(), stringsAsFactors = FALSE))
  }
  do.call(rbind, out)
}

# -----------------------------------------------------------------------------
# Re-anonimizar sólo el equipo de un fixture ya publicado
# -----------------------------------------------------------------------------

#' Aplica a un `.pulso` YA anonimizado sólo el tratamiento del equipo de campo.
#'
#' Existe para los fixtures publicados antes de que el anonimizador viera la
#' lista de encuestadores (`acnur_acg` salió con 26 nombres y DNI). Pasarles el
#' anonimizador entero de nuevo seudonimizaría sus seudónimos y cambiaría todo el
#' fixture; esto toca sólo la lista, la asignación territorial, el equipo del
#' Planner, sus apariciones derivadas en tablas y textos, y el Excel de origen.
#' El resto del zip queda byte a byte.
#' @keywords internal
pulso_anonimizar_encuestadores_archivo <- function(origen, destino, sal) {
  if (!file.exists(origen)) stop(sprintf("No encuentro el .pulso de origen: %s", origen), call. = FALSE)
  if (!nzchar(sal %||% "")) stop("La sal de anonimizacion no puede ser vacia.", call. = FALSE)
  stage <- tempfile("pulso-anon-equipo-"); dir.create(stage, recursive = TRUE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  zip::unzip(origen, exdir = stage)
  state_path <- file.path(stage, "state.rds")
  envuelto <- .pulso_anon_state_como_lista(readRDS(state_path))
  estado <- envuelto$datos

  mapa <- .pulso_anon_roster_mapa(estado, sal)
  aplicado <- .pulso_anon_roster_aplicar(estado, mapa)
  estado <- aplicado$estado
  celdas <- 0L
  estado <- .pulso_anon_map_dataframes(estado, function(df, ruta) {
    m <- .pulso_anon_roster_marcar(df, mapa)
    celdas <<- celdas + m$reemplazos
    .pulso_anon_roster_restaurar(m$data, mapa)
  }, ruta = "state")
  estado <- .pulso_anon_roster_barrer_textos(estado, mapa)
  fuentes <- .pulso_anon_roster_reescribir_fuentes(estado, file.path(stage, "files"))
  xlsx_crudos <- .pulso_anon_roster_barrer_xlsx_crudo(file.path(stage, "files"), mapa)
  saveRDS(.pulso_anon_lista_como_state(estado, envuelto$era_env), state_path)

  dir.create(dirname(destino), recursive = TRUE, showWarnings = FALSE)
  if (file.exists(destino)) unlink(destino, force = TRUE)
  zip::zip(zipfile = destino, files = list.files(stage, recursive = FALSE), root = stage)
  list(destino = destino,
       n_personas = length(mapa$nombres),
       n_dnis = length(mapa$dnis),
       n_registros = aplicado$encuestadores,
       n_asignaciones_recodificadas = aplicado$asignaciones_recodificadas,
       n_celdas_derivadas = celdas,
       n_fuentes_reescritas = fuentes,
       n_xlsx_barridos = xlsx_crudos)
}
