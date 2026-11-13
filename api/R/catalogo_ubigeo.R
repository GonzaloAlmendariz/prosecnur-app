# =============================================================================
# Catálogo territorial: ubigeos del Perú (motor compartido)
# =============================================================================
# Un catálogo de tres niveles anidados (departamento ⊃ provincia ⊃ distrito) con
# un código por distrito. El del Perú sale de la tabla oficial del INEI
# (`inst/catalogos/ubigeo_peru.csv.gz`, script `build_ubigeo_peru.R` al lado);
# cualquier otro catálogo con las mismas cuatro columnas sirve igual
# (`catalogo_ubigeo_desde_tabla()`). Lo usan Validación (regla "Combinación
# fuera de catálogo", `reglas_custom_catalogo.R`) y puede usarlo Hojas de ruta o
# ponderación para leer nombres de lugar escritos a mano.
#
# Qué hace:
#   - normaliza nombres: sin tildes ni mayúsculas, Ñ igual a N, puntuación como
#     espacio; un "EL", "LA", "LOS" o "LAS" inicial es opcional si no hay otro
#     nombre del mismo nivel que quede igual sin él;
#   - resuelve un texto o un código a sus entidades del catálogo y dice los
#     empates (un nombre que existe en varios lugares);
#   - revisa una combinación fila por fila (distrito ⊂ provincia ⊂ departamento,
#     y el código frente a los nombres) y devuelve, por fila, su estado, la
#     causa en llano y los candidatos de corrección, que nunca se aplican solos;
#   - propone qué columna cumple cada papel mirando el contenido (qué parte de
#     sus valores casa con cada nivel), nunca el nombre de la columna;
#   - busca en el catálogo por texto y lo recorre en cascada.
#
# Ningún valor se descarta en silencio: uno que no se reconoce sale con su
# causa, y uno que el analista pide no revisar (`omitir`) se cuenta aparte.
#
# Representación: cada entidad es un conjunto de filas de la tabla (un
# departamento son todas sus filas; un distrito, una). Una combinación es
# coherente si los conjuntos de sus partes se intersecan.

.CATALOGO_UBIGEO_NIVELES <- c("departamento", "provincia", "distrito")
.CATALOGO_UBIGEO_ROLES <- c("departamento", "provincia", "distrito", "ubigeo")
.CATALOGO_UBIGEO_ARTICULOS <- "^(EL|LA|LOS|LAS) "
.catalogo_ubigeo_cache <- new.env(parent = emptyenv())

# Catálogos que trae el paquete. Uno que no está aquí se pasa como objeto.
.CATALOGO_UBIGEO_INCLUIDOS <- c(ubigeo_peru = "Ubigeos del Perú (INEI)")

#' Normaliza nombres de lugar para compararlos
#'
#' Sin tildes, en mayúsculas, Ñ como N, cualquier signo que no sea letra o
#' dígito como espacio y espacios colapsados. Vacío y NA quedan en NA.
#' @param x textos.
#' @return character del mismo largo.
#' @keywords internal
catalogo_ubigeo_normalizar <- function(x) {
  x <- as.character(unclass(x))
  out <- stringi::stri_trans_general(enc2utf8(x), "Latin-ASCII")
  out <- toupper(out)
  out <- gsub("[^A-Z0-9]+", " ", out)
  out <- trimws(gsub(" +", " ", out))
  out[is.na(x) | !nzchar(out) | out == "NA"] <- NA_character_
  out
}

.catalogo_ubigeo_sin_articulo <- function(k) sub(.CATALOGO_UBIGEO_ARTICULOS, "", k)

# "SAN JUAN DE LURIGANCHO" -> "San Juan de Lurigancho". Los nombres del INEI
# vienen en mayúsculas y sin tildes; el título no las inventa.
.catalogo_ubigeo_titulo <- function(x) {
  vapply(as.character(x), function(s) {
    if (is.na(s)) return(NA_character_)
    p <- strsplit(tolower(s), " ", fixed = TRUE)[[1]]
    menores <- c("de", "del", "la", "las", "los", "el", "y", "e")
    p <- vapply(seq_along(p), function(i) {
      w <- p[i]
      if (i > 1L && w %in% menores) return(w)
      paste0(toupper(substr(w, 1L, 1L)), substr(w, 2L, nchar(w)))
    }, character(1))
    paste(p, collapse = " ")
  }, character(1), USE.NAMES = FALSE)
}

#' Arma un catálogo a partir de una tabla
#'
#' @param tabla data.frame con `ubigeo`, `departamento`, `provincia`, `distrito`
#'   (una fila por distrito).
#' @param id identificador del catálogo.
#' @param nombre nombre para mostrar.
#' @param alias data.frame opcional con `texto`, `nivel` (por ahora solo
#'   "distrito") y `ubigeo`: abreviaturas conocidas que resuelven a una entidad.
#' @param capital_sufijo si no es NA, "CERCADO" (o "CERCADO DE <provincia>")
#'   se lee como el distrito capital de la provincia: el que termina en este
#'   sufijo. En el Perú, "01".
#' @param meta metadatos de la fuente.
#' @return objeto `catalogo_ubigeo`.
#' @keywords internal
catalogo_ubigeo_desde_tabla <- function(tabla, id = "propio", nombre = id, alias = NULL,
                                        capital_sufijo = NA_character_, meta = list()) {
  faltan <- setdiff(.CATALOGO_UBIGEO_ROLES, names(tabla))
  if (length(faltan)) {
    stop_api(400, "E_REGLA_INVALIDA",
             sprintf("El catálogo no tiene las columnas: %s.", paste(faltan, collapse = ", ")))
  }
  tabla <- data.frame(lapply(tabla[, c("ubigeo", .CATALOGO_UBIGEO_NIVELES)], function(v) trimws(as.character(v))),
                      stringsAsFactors = FALSE)
  if (anyNA(tabla) || any(!nzchar(as.matrix(tabla)))) {
    stop_api(400, "E_REGLA_INVALIDA", "El catálogo tiene celdas vacías.")
  }
  if (anyDuplicated(tabla$ubigeo)) {
    stop_api(400, "E_REGLA_INVALIDA", "El catálogo repite códigos de distrito.")
  }
  k <- lapply(tabla[, .CATALOGO_UBIGEO_NIVELES], catalogo_ubigeo_normalizar)
  clave <- list(
    departamento = k$departamento,
    provincia = paste(k$departamento, k$provincia, sep = "|"),
    distrito = tabla$ubigeo
  )
  # Filas por entidad y por nombre normalizado (con y sin artículo).
  indice <- lapply(.CATALOGO_UBIGEO_NIVELES, function(nv) {
    split(seq_len(nrow(tabla)), k[[nv]])
  })
  names(indice) <- .CATALOGO_UBIGEO_NIVELES
  indice_sin <- lapply(.CATALOGO_UBIGEO_NIVELES, function(nv) {
    split(seq_len(nrow(tabla)), .catalogo_ubigeo_sin_articulo(k[[nv]]))
  })
  names(indice_sin) <- .CATALOGO_UBIGEO_NIVELES
  largo <- max(nchar(tabla$ubigeo))
  al <- NULL
  if (is.data.frame(alias) && nrow(alias)) {
    al <- data.frame(texto = catalogo_ubigeo_normalizar(alias$texto),
                     nivel = as.character(alias$nivel),
                     fila = match(as.character(alias$ubigeo), tabla$ubigeo),
                     fuente = as.character(alias$fuente %||% NA_character_),
                     stringsAsFactors = FALSE)
    if (anyNA(al$fila)) {
      stop_api(400, "E_REGLA_INVALIDA",
               sprintf("Una abreviatura del catálogo apunta a un código que no existe: %s.",
                       paste(alias$ubigeo[is.na(al$fila)], collapse = ", ")))
    }
  }
  structure(list(
    id = id, nombre = nombre, tabla = tabla, k = k, clave = clave,
    indice = indice, indice_sin = indice_sin, alias = al,
    largo_codigo = largo, numerico = all(grepl("^[0-9]+$", tabla$ubigeo)),
    capital_sufijo = capital_sufijo, meta = meta
  ), class = "catalogo_ubigeo")
}

#' Catálogo por identificador (con caché)
#'
#' @param catalogo un objeto `catalogo_ubigeo` (se devuelve tal cual) o el id
#'   de uno incluido ("ubigeo_peru", por defecto).
#' @return objeto `catalogo_ubigeo`.
#' @keywords internal
catalogo_ubigeo_cargar <- function(catalogo = "ubigeo_peru") {
  if (inherits(catalogo, "catalogo_ubigeo")) return(catalogo)
  id <- as.character(catalogo %||% "ubigeo_peru")[1]
  if (is.na(id) || !(id %in% names(.CATALOGO_UBIGEO_INCLUIDOS))) {
    stop_api(400, "E_REGLA_INVALIDA",
             sprintf("Catálogo \"%s\" no disponible. Disponibles: %s.", id,
                     paste(names(.CATALOGO_UBIGEO_INCLUIDOS), collapse = ", ")))
  }
  hit <- .catalogo_ubigeo_cache[[id]]
  if (!is.null(hit)) return(hit)
  dir <- system.file("catalogos", package = "prosecnurapp")
  path <- file.path(dir, paste0(id, ".csv.gz"))
  if (!nzchar(dir) || !file.exists(path)) {
    stop_api(500, "E_INTERNAL", "Falta el archivo del catálogo de ubigeos en el paquete.")
  }
  tabla <- utils::read.csv(gzfile(path), colClasses = "character", encoding = "UTF-8")
  alias_path <- file.path(dir, paste0(id, "_alias.csv"))
  alias <- if (file.exists(alias_path)) utils::read.csv(alias_path, colClasses = "character", encoding = "UTF-8") else NULL
  meta_path <- file.path(dir, paste0(id, ".meta.json"))
  meta <- if (file.exists(meta_path)) jsonlite::read_json(meta_path) else list()
  cat <- catalogo_ubigeo_desde_tabla(tabla, id = id, nombre = .CATALOGO_UBIGEO_INCLUIDOS[[id]],
                                     alias = alias, capital_sufijo = "01", meta = meta)
  assign(id, cat, envir = .catalogo_ubigeo_cache)
  cat
}

# --- Resolver ------------------------------------------------------------------

# Filas de la entidad con nombre normalizado `k` en el nivel `nivel`, y cómo se
# reconoció: "exacto", "sin_articulo", "alias", "capital" o NA.
.catalogo_ubigeo_buscar_nombre <- function(cat, k, nivel) {
  vacio <- list(filas = integer(0), como = NA_character_)
  if (is.na(k)) return(vacio)
  f <- cat$indice[[nivel]][[k]]
  if (length(f)) return(list(filas = f, como = "exacto"))
  if (!is.null(cat$alias)) {
    a <- cat$alias$fila[cat$alias$nivel == nivel & cat$alias$texto == k]
    if (length(a)) return(list(filas = a, como = "alias"))
  }
  # Sin artículo: vale si todo lo que queda igual sin él es un solo nombre.
  ks <- .catalogo_ubigeo_sin_articulo(k)
  f <- cat$indice_sin[[nivel]][[ks]]
  if (length(f) && length(unique(cat$k[[nivel]][f])) == 1L) return(list(filas = f, como = "sin_articulo"))
  # "CERCADO" o "CERCADO DE X": el distrito capital de la provincia.
  if (identical(nivel, "distrito") && !is.na(cat$capital_sufijo) &&
      grepl("^CERCADO( DE .+)?$", k)) {
    capitales <- which(endsWith(cat$tabla$ubigeo, cat$capital_sufijo))
    resto <- sub("^CERCADO( DE )?", "", k)
    if (nzchar(resto)) {
      enprov <- capitales[cat$k$provincia[capitales] == resto]
      if (length(enprov)) return(list(filas = enprov, como = "capital"))
      return(vacio)
    }
    return(list(filas = capitales, como = "capital"))
  }
  vacio
}

# Código: solo dígitos; con menos dígitos que el catálogo, se completa con ceros
# a la izquierda (la columna llegó como número y perdió el cero inicial).
.catalogo_ubigeo_buscar_codigo <- function(cat, x) {
  s <- trimws(as.character(x))
  if (is.na(s) || !nzchar(s) || s == "NA") return(list(filas = integer(0), estado = "vacio", codigo = NA_character_))
  if (grepl("^[0-9]+([.]0+)?$", s)) s <- sub("[.]0+$", "", s)
  relleno <- FALSE
  if (cat$numerico && grepl("^[0-9]+$", s) && nchar(s) < cat$largo_codigo) {
    s <- paste0(strrep("0", cat$largo_codigo - nchar(s)), s)
    relleno <- TRUE
  }
  f <- match(s, cat$tabla$ubigeo)
  if (is.na(f)) return(list(filas = integer(0), estado = "no_reconocido", codigo = s, relleno = relleno))
  list(filas = f, estado = if (relleno) "sin_cero" else "exacto", codigo = s, relleno = relleno)
}

#' Resuelve textos o códigos a entidades del catálogo
#'
#' @param x valores.
#' @param nivel "departamento", "provincia", "distrito" o "ubigeo".
#' @param catalogo catálogo o id.
#' @return data.frame, una fila por valor: `valor`, `estado` ("exacto",
#'   "sin_articulo", "alias", "capital", "sin_cero", "empate", "otro_nivel",
#'   "no_reconocido", "vacio"), `n_entidades`, `entidades` (lista: códigos de
#'   distrito, claves de provincia o de departamento) y `causa`.
#' @keywords internal
catalogo_ubigeo_resolver <- function(x, nivel, catalogo = "ubigeo_peru") {
  cat <- catalogo_ubigeo_cargar(catalogo)
  if (!(nivel %in% .CATALOGO_UBIGEO_ROLES)) stop_api(400, "E_REGLA_INVALIDA", sprintf("Nivel \"%s\" no existe.", nivel))
  filas <- lapply(as.character(unclass(x)), function(v) {
    if (identical(nivel, "ubigeo")) {
      r <- .catalogo_ubigeo_buscar_codigo(cat, v)
      ent <- cat$tabla$ubigeo[r$filas]
      causa <- switch(r$estado,
        no_reconocido = sprintf("Ubigeo no reconocido: \"%s\"", trimws(v)),
        sin_cero = sprintf("Ubigeo escrito sin el cero inicial: %s", r$codigo), NA_character_)
      return(list(valor = v, estado = r$estado, entidades = ent, causa = causa))
    }
    k <- catalogo_ubigeo_normalizar(v)
    if (is.na(k)) return(list(valor = v, estado = "vacio", entidades = character(0), causa = NA_character_))
    r <- .catalogo_ubigeo_buscar_nombre(cat, k, nivel)
    if (length(r$filas)) {
      ent <- unique(cat$clave[[nivel]][r$filas])
      estado <- if (length(ent) > 1L) "empate" else r$como
      causa <- if (length(ent) > 1L) .catalogo_ubigeo_causa_empate(cat, v, nivel, r$filas) else NA_character_
      return(list(valor = v, estado = estado, entidades = ent, causa = causa))
    }
    otro <- .catalogo_ubigeo_otro_nivel(cat, k, nivel)
    if (!is.null(otro)) return(list(valor = v, estado = "otro_nivel", entidades = character(0), causa = otro$causa))
    list(valor = v, estado = "no_reconocido", entidades = character(0),
         causa = sprintf("Nombre no reconocido: \"%s\"", trimws(v)))
  })
  data.frame(
    valor = vapply(filas, function(f) as.character(f$valor), character(1)),
    estado = vapply(filas, `[[`, character(1), "estado"),
    n_entidades = vapply(filas, function(f) length(f$entidades), integer(1)),
    entidades = I(lapply(filas, `[[`, "entidades")),
    causa = vapply(filas, function(f) as.character(f$causa), character(1)),
    stringsAsFactors = FALSE
  )
}

# Nombre de una entidad con su ruta: "Comas (Lima, Lima)".
.catalogo_ubigeo_ruta <- function(cat, fila, nivel) {
  t <- cat$tabla[fila, ]
  tt <- .catalogo_ubigeo_titulo
  switch(nivel,
    departamento = tt(t$departamento),
    provincia = sprintf("%s (%s)", tt(t$provincia), tt(t$departamento)),
    sprintf("%s (%s, %s)", tt(t$distrito), tt(t$provincia), tt(t$departamento)))
}

.catalogo_ubigeo_causa_empate <- function(cat, v, nivel, filas) {
  ent <- unique(cat$clave[[nivel]][filas])
  primeras <- filas[match(ent, cat$clave[[nivel]][filas])]
  rutas <- vapply(primeras, .catalogo_ubigeo_ruta, character(1), cat = cat, nivel = nivel)
  sprintf("\"%s\" existe en %d lugares: %s", trimws(v), length(ent), paste(rutas, collapse = "; "))
}

.CATALOGO_UBIGEO_ARTICULO_NIVEL <- c(departamento = "un departamento", provincia = "una provincia",
                                     distrito = "un distrito")

# "Chiclayo, escrito como departamento, es una provincia de Lambayeque".
.catalogo_ubigeo_otro_nivel <- function(cat, k, nivel) {
  for (otro in setdiff(.CATALOGO_UBIGEO_NIVELES, nivel)) {
    r <- .catalogo_ubigeo_buscar_nombre(cat, k, otro)
    if (!length(r$filas) || identical(r$como, "capital")) next
    ent <- unique(cat$clave[[otro]][r$filas])
    primeras <- r$filas[match(ent, cat$clave[[otro]][r$filas])]
    donde <- vapply(primeras, function(f) switch(otro,
      departamento = "",
      provincia = sprintf(" de %s", .catalogo_ubigeo_titulo(cat$tabla$departamento[f])),
      distrito = sprintf(" de %s (%s)", .catalogo_ubigeo_titulo(cat$tabla$provincia[f]),
                         .catalogo_ubigeo_titulo(cat$tabla$departamento[f]))), character(1))
    nombre <- .catalogo_ubigeo_titulo(cat$tabla[[otro]][primeras[1]])
    lugar <- if (length(ent) == 1L) sprintf("es %s%s", .CATALOGO_UBIGEO_ARTICULO_NIVEL[[otro]], donde)
             else sprintf("es nombre de %d %ss: %s", length(ent), otro, paste(trimws(sub("^ de ", "", donde)), collapse = "; "))
    return(list(nivel = otro, filas = r$filas, causa = sprintf(
      "%s, escrito como %s, %s", nombre, nivel, lugar)))
  }
  NULL
}

# --- Candidatos ------------------------------------------------------------------

# Nombres del nivel a distancia corta del texto, dentro de las filas `dentro`
# (el contexto ya resuelto) o en todo el catálogo. Los de distancia mínima
# empatan y van todos.
.catalogo_ubigeo_parecidos <- function(cat, k, nivel, dentro = NULL) {
  if (is.na(k)) return(integer(0))
  filas <- if (length(dentro)) dentro else seq_len(nrow(cat$tabla))
  nombres <- unique(cat$k[[nivel]][filas])
  tope <- if (nchar(k) >= 8L) 2L else if (nchar(k) >= 4L) 1L else 0L
  if (!tope) return(integer(0))
  d <- as.vector(utils::adist(k, nombres))
  ds <- as.vector(utils::adist(.catalogo_ubigeo_sin_articulo(k), .catalogo_ubigeo_sin_articulo(nombres)))
  d <- pmin(d, ds)
  if (!length(d) || min(d) > tope) return(integer(0))
  elegidos <- nombres[d == min(d)]
  filas[cat$k[[nivel]][filas] %in% elegidos]
}

.catalogo_ubigeo_entidad <- function(cat, fila) {
  t <- cat$tabla[fila, ]
  list(ubigeo = t$ubigeo, departamento = .catalogo_ubigeo_titulo(t$departamento),
       provincia = .catalogo_ubigeo_titulo(t$provincia), distrito = .catalogo_ubigeo_titulo(t$distrito))
}

# Un candidato por entidad del nivel: el valor a escribir en el papel, la
# entidad completa (para reemplazar todas las columnas de una vez) y su causa.
.catalogo_ubigeo_candidatos <- function(cat, filas, rol, causa) {
  if (!length(filas)) return(list())
  nivel <- if (identical(rol, "ubigeo")) "distrito" else rol
  ent <- unique(cat$clave[[nivel]][filas])
  primeras <- filas[match(ent, cat$clave[[nivel]][filas])]
  lapply(primeras, function(f) {
    valor <- if (identical(rol, "ubigeo")) cat$tabla$ubigeo[f] else .catalogo_ubigeo_titulo(cat$tabla[[rol]][f])
    e <- .catalogo_ubigeo_entidad(cat, f)
    if (!identical(nivel, "distrito")) e$ubigeo <- NA_character_
    if (identical(nivel, "departamento")) e$provincia <- NA_character_
    if (nivel %in% c("departamento", "provincia")) e$distrito <- NA_character_
    list(rol = rol, valor = valor, entidad = e, causa = causa)
  })
}

# --- Revisar una combinación ---------------------------------------------------

.CATALOGO_UBIGEO_ORDEN <- c(departamento = 1L, provincia = 2L, distrito = 3L)

# Una combinación: textos por papel (NA si el papel no se usa o viene vacío).
.catalogo_ubigeo_revisar_una <- function(cat, valores, omitir_k) {
  tt <- .catalogo_ubigeo_titulo
  presentes <- names(valores)[!is.na(valores) & nzchar(trimws(valores))]
  out <- list(estado = "ok", causas = character(0), candidatos = list(), notas = character(0),
              entidad = NULL)
  if (!length(presentes)) { out$estado <- "sin_datos"; return(out) }
  ks <- catalogo_ubigeo_normalizar(valores)
  names(ks) <- names(valores)
  if (length(omitir_k) && any(ks[presentes] %in% omitir_k)) {
    out$estado <- "omitido"
    return(out)
  }
  filas <- list(); como <- list()
  no_rec <- character(0); errores <- character(0)
  otro_nivel <- list()
  for (rol in presentes) {
    if (identical(rol, "ubigeo")) {
      r <- .catalogo_ubigeo_buscar_codigo(cat, valores[[rol]])
      if (identical(r$estado, "no_reconocido")) {
        no_rec <- c(no_rec, sprintf("Ubigeo no reconocido: \"%s\"", trimws(valores[[rol]])))
      } else {
        filas$ubigeo <- r$filas
        if (isTRUE(r$relleno)) out$notas <- c(out$notas, sprintf("Ubigeo escrito sin el cero inicial (%s)", r$codigo))
      }
      next
    }
    r <- .catalogo_ubigeo_buscar_nombre(cat, ks[[rol]], rol)
    if (length(r$filas)) { filas[[rol]] <- r$filas; como[[rol]] <- r$como; next }
    otro <- .catalogo_ubigeo_otro_nivel(cat, ks[[rol]], rol)
    if (!is.null(otro)) {
      errores <- c(errores, otro$causa)
      otro_nivel[[rol]] <- otro
    } else {
      no_rec <- c(no_rec, sprintf("Nombre no reconocido: \"%s\"", trimws(valores[[rol]])))
    }
  }

  # Pertenencia, del nivel más alto al más bajo; cada papel se acota con lo que
  # ya calzó arriba.
  nombre_de <- function(rol, f) {
    if (length(unique(cat$clave[[rol]][f])) == 1L) tt(cat$tabla[[rol]][f[1]]) else tt(ks[[rol]])
  }
  acotado <- NULL; padres <- character(0); choques <- list()
  for (rol in intersect(c("departamento", "provincia", "distrito"), names(filas))) {
    f <- filas[[rol]]
    if (is.null(acotado)) { acotado <- f; padres <- rol; next }
    comun <- intersect(f, acotado)
    if (length(comun)) { acotado <- comun; padres <- c(padres, rol); next }
    padre <- padres[length(padres)]
    donde <- nombre_de(padre, acotado)
    if (identical(padre, "provincia")) {
      dep <- unique(cat$tabla$departamento[acotado])
      if (length(dep) == 1L) donde <- sprintf("%s (%s)", donde, tt(dep))
    }
    errores <- c(errores, sprintf("%s no es %s de %s", nombre_de(rol, f),
                                  .CATALOGO_UBIGEO_ARTICULO_NIVEL[[rol]], donde))
    choques[[length(choques) + 1L]] <- list(rol = rol, filas = f, padre = padre)
    # Un quiebre se dice una vez: el nivel siguiente se compara con este.
    acotado <- f; padres <- c(padres, rol)
  }
  # El código frente a los nombres.
  if (!is.null(filas$ubigeo) && !is.null(acotado) && !length(intersect(filas$ubigeo, acotado))) {
    fu <- filas$ubigeo
    nivel_bajo <- padres[length(padres)]
    errores <- c(errores, sprintf("Ubigeo %s corresponde a %s, no a %s",
                                  cat$tabla$ubigeo[fu], .catalogo_ubigeo_ruta(cat, fu, "distrito"),
                                  nombre_de(nivel_bajo, acotado)))
  }

  # Candidatos de corrección (nunca se aplican solos).
  cand <- list()
  nombres_presentes <- intersect(c("departamento", "provincia", "distrito"), presentes)
  for (rol in nombres_presentes) {
    if (!is.null(filas[[rol]])) next
    contexto <- acotado
    if (!is.null(filas$ubigeo)) {
      # El código propone su lugar, pero el código también puede estar mal (otra
      # numeración): el nombre parecido va al lado y el analista decide.
      cand <- c(cand, .catalogo_ubigeo_candidatos(cat, filas$ubigeo, rol,
                                                  sprintf("por el ubigeo %s", cat$tabla$ubigeo[filas$ubigeo])))
    }
    if (is.null(filas$ubigeo) && !is.null(otro_nivel[[rol]]) && .CATALOGO_UBIGEO_ORDEN[[otro_nivel[[rol]]$nivel]] > .CATALOGO_UBIGEO_ORDEN[[rol]]) {
      # Escribió un lugar más chico en el papel de uno más grande: el candidato
      # es el lugar que lo contiene.
      fo <- otro_nivel[[rol]]$filas
      if (!is.null(acotado) && length(intersect(fo, acotado))) fo <- intersect(fo, acotado)
      cand <- c(cand, .catalogo_ubigeo_candidatos(cat, fo, rol,
                                                  sprintf("%s está en ese lugar", tt(ks[[rol]]))))
      next
    }
    par <- .catalogo_ubigeo_parecidos(cat, ks[[rol]], rol, contexto)
    if (!length(par) && length(contexto)) par <- .catalogo_ubigeo_parecidos(cat, ks[[rol]], rol, NULL)
    cand <- c(cand, .catalogo_ubigeo_candidatos(cat, par, rol, "nombre parecido"))
  }
  # Código frente al distrito: el distrito que dice el código, y el código del
  # distrito declarado (si es uno solo).
  if (!is.null(filas$ubigeo) && !is.null(filas$distrito) && !length(intersect(filas$ubigeo, acotado %||% filas$distrito))) {
    cand <- c(cand, .catalogo_ubigeo_candidatos(cat, filas$ubigeo, "distrito",
                                                sprintf("por el ubigeo %s", cat$tabla$ubigeo[filas$ubigeo])))
    fd <- acotado %||% filas$distrito
    if (length(unique(fd)) <= 3L) {
      cand <- c(cand, .catalogo_ubigeo_candidatos(cat, fd, "ubigeo",
                                                  sprintf("por el distrito %s", tt(ks[["distrito"]]))))
    }
  }
  if ("ubigeo" %in% presentes && is.null(filas$ubigeo) && !is.null(filas$distrito)) {
    fd <- acotado %||% filas$distrito
    if (length(unique(fd)) <= 3L) {
      cand <- c(cand, .catalogo_ubigeo_candidatos(cat, fd, "ubigeo",
                                                  sprintf("por el distrito %s", tt(ks[["distrito"]]))))
    }
  }
  # Error de pertenencia entre nombres reconocidos: el lugar que calza con el
  # código, si hay código.
  if (length(errores) && !is.null(filas$ubigeo)) {
    for (rol in setdiff(nombres_presentes, names(otro_nivel))) {
      if (!is.null(filas[[rol]]) && !length(intersect(filas[[rol]], filas$ubigeo))) {
        cand <- c(cand, .catalogo_ubigeo_candidatos(cat, filas$ubigeo, rol,
                                                    sprintf("por el ubigeo %s", cat$tabla$ubigeo[filas$ubigeo])))
      }
    }
  }
  # Dos nombres reconocidos que no calzan, sin código que decida: el lugar que
  # de verdad contiene al más chico (si son pocos).
  if (is.null(filas$ubigeo)) {
    for (ch in choques) {
      if (length(unique(cat$clave[[ch$rol]][ch$filas])) > 3L) next
      cand <- c(cand, .catalogo_ubigeo_candidatos(cat, ch$filas, ch$padre,
                                                  sprintf("%s está en ese lugar", nombre_de(ch$rol, ch$filas))))
    }
  }
  # Sin repetir el mismo valor para el mismo papel.
  if (length(cand)) {
    llave <- vapply(cand, function(c) paste(c$rol, c$valor, c$entidad$departamento, c$entidad$provincia,
                                            c$entidad$ubigeo), character(1))
    cand <- cand[!duplicated(llave)]
  }

  out$causas <- unique(c(errores, no_rec))
  out$estado <- if (length(errores)) "error" else if (length(no_rec)) "no_reconocido" else "ok"
  # Lugar resuelto cuando la combinación calza y apunta a un solo distrito.
  final <- if (!is.null(filas$ubigeo)) filas$ubigeo else acotado
  if (identical(out$estado, "ok") && length(final) == 1L) {
    out$entidad <- .catalogo_ubigeo_entidad(cat, final)
  }
  # Combinación que calza pero con papeles vacíos: "incompleto", y el lugar
  # resuelto completa los que faltan (si es uno solo).
  vacios <- setdiff(names(valores), presentes)
  if (identical(out$estado, "ok") && length(vacios)) {
    out$estado <- "incompleto"
    origen <- if (!is.null(filas$ubigeo)) sprintf("por el ubigeo %s", cat$tabla$ubigeo[filas$ubigeo])
              else { b <- padres[length(padres)]; sprintf("por %s %s", c(departamento = "el departamento", provincia = "la provincia", distrito = "el distrito")[[b]], nombre_de(b, acotado)) }
    for (rol in vacios) {
      nivel <- if (identical(rol, "ubigeo")) "distrito" else rol
      if (!is.null(final) && length(unique(cat$clave[[nivel]][final])) == 1L) {
        cand <- c(cand, .catalogo_ubigeo_candidatos(cat, final, rol, origen))
      }
    }
  }
  out$candidatos <- cand
  out
}

#' Revisa combinaciones de lugar fila por fila
#'
#' @param valores lista con hasta cuatro vectores del mismo largo, con nombre
#'   de papel: `departamento`, `provincia`, `distrito`, `ubigeo`. Un papel que
#'   no se usa no va o va NULL.
#' @param catalogo catálogo o id ("ubigeo_peru" por defecto).
#' @param omitir textos que el analista pide no revisar (por ejemplo un país
#'   extranjero o "NO RECUERDA"): si cualquiera de los papeles de la fila trae
#'   uno, la fila sale con estado "omitido" y no se marca.
#' @param marcar_incompletos si TRUE, también se marca la fila que calza pero
#'   deja vacío algún papel (estado "incompleto"); su candidato es el valor que
#'   corresponde al lugar resuelto.
#' @return lista con, por fila: `estado` ("ok", "incompleto", "error",
#'   "no_reconocido", "omitido", "sin_datos"), `marca` (error o no reconocido,
#'   e incompleto si se pide), `causa` (texto),
#'   `causas` (lista), `candidatos` (lista de listas `rol`, `valor`, `entidad`,
#'   `causa`), `a_investigar` (marcada y sin candidato), `notas` (lista) y
#'   `entidad` (el distrito resuelto o NULL).
#' @keywords internal
catalogo_ubigeo_revisar <- function(valores, catalogo = "ubigeo_peru", omitir = character(0),
                                    marcar_incompletos = FALSE) {
  cat <- catalogo_ubigeo_cargar(catalogo)
  valores <- valores[!vapply(valores, is.null, logical(1))]
  roles <- intersect(.CATALOGO_UBIGEO_ROLES, names(valores))
  if (!length(roles)) stop_api(400, "E_REGLA_INVALIDA", "La revisión del catálogo necesita al menos un papel.")
  n <- unique(vapply(valores[roles], length, integer(1)))
  if (length(n) != 1L) stop_api(400, "E_REGLA_INVALIDA", "Los papeles tienen largos distintos.")
  txt <- lapply(valores[roles], function(v) {
    if (is.factor(v)) v <- as.character(v)
    if (is.numeric(v)) {
      s <- ifelse(is.na(v), NA_character_, sprintf("%.0f", v))
      s[!is.na(v) & v != round(v)] <- as.character(v[!is.na(v) & v != round(v)])
      return(s)
    }
    as.character(unclass(v))
  })
  omitir_k <- unique(stats::na.omit(catalogo_ubigeo_normalizar(omitir)))
  llave <- do.call(paste, c(lapply(txt, function(v) ifelse(is.na(v), "␀", v)), sep = "␟"))
  unicos <- !duplicated(llave)
  res_u <- lapply(which(unicos), function(i) {
    vals <- vapply(roles, function(r) txt[[r]][i], character(1))
    .catalogo_ubigeo_revisar_una(cat, vals, omitir_k)
  })
  idx <- match(llave, llave[unicos])
  res <- res_u[idx]
  estado <- vapply(res, `[[`, character(1), "estado")
  marca <- estado %in% c("error", "no_reconocido", if (isTRUE(marcar_incompletos)) "incompleto")
  list(
    estado = estado,
    marca = marca,
    causa = vapply(res, function(r) if (length(r$causas)) paste(r$causas, collapse = ". ") else NA_character_, character(1)),
    causas = lapply(res, `[[`, "causas"),
    candidatos = lapply(res, `[[`, "candidatos"),
    a_investigar = marca & vapply(res, function(r) !length(r$candidatos), logical(1)),
    notas = lapply(res, `[[`, "notas"),
    entidad = lapply(res, `[[`, "entidad")
  )
}

# --- Proponer papeles por contenido ----------------------------------------------

# Parte de los valores no vacíos de una columna que casa con cada nivel.
.catalogo_ubigeo_coincidencias <- function(cat, x) {
  v <- if (is.numeric(x)) ifelse(is.na(x), NA_character_, sprintf("%.0f", x)) else as.character(unclass(x))
  v <- trimws(v)
  v <- v[!is.na(v) & nzchar(v) & v != "NA"]
  vacio <- c(departamento = 0, provincia = 0, distrito = 0, ubigeo = 0)
  if (!length(v)) return(list(n = 0L, parte = vacio))
  tab <- table(v)
  u <- names(tab); w <- as.numeric(tab)
  # Una columna de texto libre largo (comentarios) no es de lugar: se mide con
  # sus 2000 valores más frecuentes.
  if (length(u) > 2000L) { o <- order(-w)[1:2000]; u <- u[o]; w2 <- w[o] } else w2 <- w
  ks <- catalogo_ubigeo_normalizar(u)
  parte <- vapply(.CATALOGO_UBIGEO_NIVELES, function(nv) {
    ok <- !is.na(ks) & ks %in% names(cat$indice[[nv]])
    resto <- which(!ok & !is.na(ks))
    if (length(resto)) {
      ok[resto] <- vapply(ks[resto], function(k) length(.catalogo_ubigeo_buscar_nombre(cat, k, nv)$filas) > 0L, logical(1))
    }
    sum(w2[ok]) / sum(w)
  }, numeric(1))
  cod <- u
  corto <- cat$numerico & grepl("^[0-9]+$", cod) & nchar(cod) < cat$largo_codigo
  cod[corto] <- paste0(strrep("0", cat$largo_codigo - nchar(cod[corto])), cod[corto])
  ok_cod <- cod %in% cat$tabla$ubigeo
  list(n = length(v), parte = c(parte, ubigeo = sum(w2[ok_cod]) / sum(w)))
}

#' Propone qué columna cumple cada papel, mirando el contenido
#'
#' Para cada columna mide qué parte de sus valores no vacíos casa con cada nivel
#' del catálogo. Entre las columnas que casan con al menos `umbral` en algún
#' nivel, elige la asignación de papeles que más valores reconoce y que más
#' filas deja coherentes (distrito dentro de su provincia, código con su
#' distrito). El nombre de la columna no interviene.
#'
#' Puntaje de una asignación: suma, por papel, de la parte de valores que casa
#' con su nivel, multiplicada por la coherencia al cubo (parte de las filas
#' revisables que calzan). El cubo hace que sumar un papel solo convenga si no
#' rompe la coherencia: en una base con lugar de nacimiento y distrito del
#' domicilio, mezclar los dos grupos da más papeles pero menos filas que calzan.
#' Una base puede tener varios grupos (nacimiento, domicilio): después del
#' mejor, se busca otro con las columnas que quedan, mientras tenga dos papeles.
#'
#' @param datos data.frame.
#' @param catalogo catálogo o id.
#' @param umbral parte mínima de valores que casan para proponer una columna.
#' @param columnas columnas a mirar (todas por defecto).
#' @return lista con `propuesta` (papel -> columna o NA, la del mejor grupo),
#'   `propuestas` (todos los grupos, con `roles`, `coherencia` y `puntaje`),
#'   `columnas` (por columna: `n_valores` y `parte` por nivel, 0 a 1) y `base`
#'   (filas de datos).
#' @keywords internal
catalogo_ubigeo_proponer_roles <- function(datos, catalogo = "ubigeo_peru", umbral = 0.5,
                                           columnas = names(datos)) {
  cat <- catalogo_ubigeo_cargar(catalogo)
  columnas <- intersect(columnas, names(datos))
  medidas <- lapply(columnas, function(cn) .catalogo_ubigeo_coincidencias(cat, datos[[cn]]))
  names(medidas) <- columnas
  candidatas <- columnas[vapply(medidas, function(m) m$n > 0L && max(m$parte) >= umbral, logical(1))]
  muestra <- if (nrow(datos) > 400L) unique(round(seq(1, nrow(datos), length.out = 400L))) else seq_len(nrow(datos))
  propuestas <- list()
  libres <- candidatas
  for (vuelta in 1:3) {
    g <- .catalogo_ubigeo_mejor_grupo(cat, datos, medidas, libres, umbral, muestra)
    if (is.null(g) || sum(!is.na(unlist(g$roles))) < if (vuelta == 1L) 1L else 2L) break
    propuestas[[length(propuestas) + 1L]] <- g
    libres <- setdiff(libres, unlist(g$roles))
  }
  vacia <- stats::setNames(as.list(rep(NA_character_, 4L)), .CATALOGO_UBIGEO_ROLES)
  list(
    propuesta = if (length(propuestas)) propuestas[[1]]$roles else vacia,
    propuestas = propuestas,
    columnas = lapply(candidatas, function(cn) list(
      columna = cn, n_valores = medidas[[cn]]$n,
      parte = as.list(round(medidas[[cn]]$parte, 4)))),
    base = nrow(datos)
  )
}

.catalogo_ubigeo_mejor_grupo <- function(cat, datos, medidas, candidatas, umbral, muestra) {
  if (!length(candidatas)) return(NULL)
  # Por papel, las columnas que pasan el umbral (las 4 mejores).
  por_rol <- lapply(.CATALOGO_UBIGEO_ROLES, function(r) {
    p <- vapply(candidatas, function(cn) medidas[[cn]]$parte[[r]], numeric(1))
    o <- order(-p)
    utils::head(candidatas[o][p[o] >= umbral], 4L)
  })
  names(por_rol) <- .CATALOGO_UBIGEO_ROLES
  grilla <- expand.grid(lapply(por_rol, function(v) c(NA_character_, v)), stringsAsFactors = FALSE)
  n_papeles <- apply(grilla, 1L, function(f) sum(!is.na(f)))
  usadas <- apply(grilla, 1L, function(f) { f <- f[!is.na(f)]; !anyDuplicated(f) && length(f) > 0L })
  # La regla necesita dos papeles: un papel solo se propone si no hay pareja.
  if (any(usadas & n_papeles >= 2L)) usadas <- usadas & n_papeles >= 2L
  grilla <- grilla[usadas, , drop = FALSE]
  if (!nrow(grilla)) return(NULL)
  mejor <- NULL
  for (i in seq_len(nrow(grilla))) {
    asign <- unlist(grilla[i, ], use.names = TRUE)
    asign <- asign[!is.na(asign)]
    reconocidos <- sum(vapply(names(asign), function(r) medidas[[asign[[r]]]]$parte[[r]], numeric(1)))
    coherencia <- 1
    if (length(asign) >= 2L) {
      rev <- catalogo_ubigeo_revisar(lapply(asign, function(cn) datos[[cn]][muestra]), cat)
      evaluadas <- rev$estado %in% c("ok", "incompleto", "error")
      coherencia <- if (any(evaluadas)) mean(rev$estado[evaluadas] != "error") else 0
    }
    puntaje <- reconocidos * coherencia^3
    if (is.null(mejor) || puntaje > mejor$puntaje + 1e-9) {
      roles <- stats::setNames(as.list(rep(NA_character_, 4L)), .CATALOGO_UBIGEO_ROLES)
      roles[names(asign)] <- as.list(asign)
      mejor <- list(roles = roles, coherencia = round(coherencia, 4), puntaje = round(puntaje, 4))
    }
  }
  mejor
}

# --- Búsqueda y cascada ------------------------------------------------------------

#' Busca lugares en el catálogo por texto
#'
#' El texto se normaliza como los nombres; casa si está contenido en el nombre
#' (o el código empieza con él). Primero los nombres que empiezan con el texto.
#' @param q texto.
#' @param nivel "distrito" (por defecto), "provincia", "departamento" o "todos".
#' @param limite máximo de resultados.
#' @param catalogo catálogo o id.
#' @return lista de entidades con `nivel`, `ubigeo`, `departamento`,
#'   `provincia`, `distrito` (los niveles que no aplican en NA) y `ruta`.
#' @keywords internal
catalogo_ubigeo_buscar <- function(q, nivel = "todos", limite = 20L, catalogo = "ubigeo_peru") {
  cat <- catalogo_ubigeo_cargar(catalogo)
  k <- catalogo_ubigeo_normalizar(q)
  if (is.na(k)) return(list())
  niveles <- if (identical(nivel, "todos")) rev(.CATALOGO_UBIGEO_NIVELES) else nivel
  out <- list()
  for (nv in niveles) {
    if (grepl("^[0-9]+$", k)) {
      f <- which(startsWith(cat$tabla$ubigeo, k))
      if (!identical(nv, "distrito")) f <- integer(0)
      orden <- f
    } else {
      nombres <- cat$k[[nv]]
      f <- which(grepl(k, nombres, fixed = TRUE) | grepl(k, .catalogo_ubigeo_sin_articulo(nombres), fixed = TRUE))
      f <- f[!duplicated(cat$clave[[nv]][f])]
      empieza <- startsWith(nombres[f], k) | startsWith(.catalogo_ubigeo_sin_articulo(nombres[f]), k)
      orden <- f[order(!empieza, nombres[f])]
    }
    for (i in orden) out[[length(out) + 1L]] <- .catalogo_ubigeo_item(cat, i, nv)
  }
  utils::head(out, as.integer(limite))
}

.catalogo_ubigeo_item <- function(cat, fila, nivel) {
  e <- .catalogo_ubigeo_entidad(cat, fila)
  if (!identical(nivel, "distrito")) { e$distrito <- NA_character_; e$ubigeo <- NA_character_ }
  if (identical(nivel, "departamento")) e$provincia <- NA_character_
  t <- cat$tabla[fila, ]
  codigo <- switch(nivel, departamento = substr(t$ubigeo, 1L, 2L), provincia = substr(t$ubigeo, 1L, 4L), t$ubigeo)
  c(list(nivel = nivel, codigo = if (cat$numerico) codigo else NA_character_),
    e, list(ruta = .catalogo_ubigeo_ruta(cat, fila, nivel)))
}

#' Recorre el catálogo en cascada
#'
#' Sin argumentos devuelve los departamentos; con `departamento`, sus
#' provincias; con `departamento` y `provincia`, sus distritos. Los nombres se
#' reconocen normalizados. Un nombre que no existe responde 404.
#' @keywords internal
catalogo_ubigeo_cascada <- function(departamento = NULL, provincia = NULL, catalogo = "ubigeo_peru") {
  cat <- catalogo_ubigeo_cargar(catalogo)
  kd <- catalogo_ubigeo_normalizar(departamento %||% NA_character_)[1]
  kp <- catalogo_ubigeo_normalizar(provincia %||% NA_character_)[1]
  if (is.na(kd)) {
    f <- which(!duplicated(cat$clave$departamento))
    return(list(nivel = "departamento", items = lapply(f, .catalogo_ubigeo_item, cat = cat, nivel = "departamento")))
  }
  fd <- which(cat$k$departamento == kd)
  if (!length(fd)) stop_api(404, "E_NOT_FOUND", sprintf("Departamento \"%s\" no está en el catálogo.", departamento))
  if (is.na(kp)) {
    f <- fd[!duplicated(cat$clave$provincia[fd])]
    return(list(nivel = "provincia", items = lapply(f, .catalogo_ubigeo_item, cat = cat, nivel = "provincia")))
  }
  fp <- fd[cat$k$provincia[fd] == kp]
  if (!length(fp)) stop_api(404, "E_NOT_FOUND", sprintf("La provincia \"%s\" no está en %s.", provincia, departamento))
  list(nivel = "distrito", items = lapply(fp, .catalogo_ubigeo_item, cat = cat, nivel = "distrito"))
}
