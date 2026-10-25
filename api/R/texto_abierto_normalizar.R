# Normalización del texto abierto para la nube de palabras (TXT-1/TXT-2, plan-texto-abierto-ccss-2026-10-24).
#
# Funciones puras, sin estado: anonimizan y limpian el texto, reconocen las no respuestas, quitan palabras vacías
# (funcionales y de opinión), agrupan flexiones en una raíz (plural y formas verbales frecuentes, nunca sinónimos),
# unen las frases que usan varias personas y cuentan términos por persona o por mención.
#
# Contrato del conteo por persona: una persona menciona una raíz si la usa al menos una vez; el denominador son los
# comentarios con contenido; no se pondera. Lo decide el plan; no se deduce de la base.

#' Valor lógico escalar de un argumento que puede llegar como texto o lista desde el JSON
#' @keywords internal
.txt_flag <- function(x) {
  if (is.null(x) || !length(x)) return(FALSE)
  x <- x[[1]]
  if (is.logical(x)) return(isTRUE(x))
  isTRUE(tolower(trimws(as.character(x))) %in% c("true", "1", "si", "sí", "yes"))
}

#' Quita las tildes para comparar, sin cambiar la forma que se muestra
#' @keywords internal
.txt_sin_tildes <- function(x) chartr("áéíóúüñàèìòù", "aeiouunaeiou", x)

#' Borra los teléfonos de un texto y deja `reemplazo` en su lugar (lo comparten la nube y las citas)
#'
#' Candidato: una cifra que empieza en «+», «(» o dígito y sigue con dígitos, espacios, puntos, guiones o paréntesis.
#' Es teléfono si tiene de 7 a 15 dígitos (fijo de Lima, celular de 9, con +51), salvo que sea un rango de años
#' («2025-2026», «1990 - 2000») o una lista de números cortos de uno o dos dígitos («10-15»). Un «+» delante siempre es
#' teléfono si llega a 7 dígitos.
#' @keywords internal
.txt_borrar_telefonos <- function(x, reemplazo = " ") {
  x <- as.character(x); x[is.na(x)] <- ""
  patron <- "(?<![\\p{L}\\d])\\+?\\(?\\d[\\d\\s().-]{5,}\\d(?![\\p{L}\\d])"
  es_tel <- function(m) {
    grupos <- regmatches(m, gregexpr("\\d+", m, perl = TRUE))[[1]]
    dig <- sum(nchar(grupos))
    if (dig < 7L || dig > 15L) return(FALSE)
    if (startsWith(m, "+")) return(TRUE)
    if (all(grepl("^(19|20)\\d{2}$", grupos))) return(FALSE)       # rango o lista de años
    if (all(nchar(grupos) <= 2L)) return(FALSE)                     # números cortos («10-15 20-25»)
    TRUE
  }
  m <- gregexpr(patron, x, perl = TRUE)
  hallados <- regmatches(x, m)
  regmatches(x, m) <- lapply(hallados, function(v) as.character(ifelse(vapply(v, es_tel, logical(1)), reemplazo, v)))
  x
}

#' Texto anonimizado y limpio: sin URL, correo ni teléfono, en minúsculas y sólo con letras
#'
#' Se conservan las tildes, como la nube del recetario («formación», «gestión»). Transliterar a ASCII fuera de un
#' locale UTF-8 dejaba la tilde como un carácter que el filtro siguiente tomaba por separador: «gestión» salía
#' «gesti» y «académico», «acad» y «emico».
#' @keywords internal
.txt_normalizar <- function(x) {
  x <- as.character(x)
  x[is.na(x)] <- ""
  x <- trimws(x)
  x <- gsub("https?://\\S+|www\\.\\S+", " ", x, perl = TRUE, ignore.case = TRUE)
  x <- gsub("\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b", " ", x, perl = TRUE, ignore.case = TRUE)
  x <- .txt_borrar_telefonos(x, " ")
  x <- enc2utf8(x); x[is.na(x)] <- ""
  x <- tolower(x)
  x <- gsub("[^\\p{L}\\s]+", " ", x, perl = TRUE)
  trimws(gsub("\\s+", " ", x, perl = TRUE))
}

#' Tokens de cada texto normalizado, con las palabras vacías incluidas (las frases las necesitan)
#' @keywords internal
.txt_tokens <- function(x) {
  lapply(strsplit(.txt_normalizar(x), "\\s+", perl = TRUE), function(t) t[nzchar(t)])
}

#' Palabras vacías, escritas sin tilde
#'
#' `base` es la lista histórica de la nube (no cambia: de ella dependen las cifras de las nubes ya hechas).
#' `funcionales` la amplía con artículos, pronombres, auxiliares y conectores. `opinion` son las palabras con que
#' se opina sin decir sobre qué («considero», «debería», «bueno»).
#' @keywords internal
.txt_palabras_vacias <- function(tipo = c("base", "funcionales", "opinion")) {
  tipo <- match.arg(tipo)
  base <- c(
    "ademas", "ahi", "al", "algo", "algunas", "algunos", "ante", "antes", "aqui",
    "asi", "aun", "aunque", "cada", "casi", "como", "con", "contra", "cual",
    "cuando", "de", "del", "desde", "donde", "dos", "el", "ella", "ellas",
    "ellos", "en", "entre", "era", "eran", "eres", "es", "esa", "esas", "ese",
    "eso", "esos", "esta", "estaba", "estan", "estar", "este", "esto", "estos",
    "fue", "fueron", "ha", "han", "hasta", "hay", "la", "las", "le", "les",
    "lo", "los", "mas", "me", "mi", "mis", "muy", "no", "nos", "nosotros",
    "o", "otra", "otras", "otro", "otros", "para", "pero", "por", "porque",
    "que", "se", "sea", "ser", "si", "sin", "sobre", "son", "su", "sus",
    "tambien", "tan", "te", "tener", "tiene", "todo", "todos", "tu", "un",
    "una", "unas", "uno", "unos", "y", "ya"
  )
  if (identical(tipo, "base")) return(base)
  if (identical(tipo, "funcionales")) {
    return(unique(c(base,
      "a", "e", "u", "ni", "pues", "tres", "toda", "todas", "ello", "estas", "esto", "aquel", "aquella", "aquellos",
      "nuestra", "nuestro", "nuestros", "nuestras", "vuestra", "vuestro", "tus", "ti", "yo", "usted", "ustedes",
      "mismo", "misma", "mismos", "mismas", "dentro", "fuera", "traves", "segun", "cuales", "quien", "quienes",
      "cuyo", "cuya", "dicho", "dicha", "demas", "menos", "tanto", "tanta", "tantos", "tantas", "solo", "sola",
      "estoy", "estamos", "estuvo", "estas", "sido", "siendo", "soy", "somos", "seria", "serian",
      "hemos", "he", "has", "habia", "habian", "haber", "hubo", "tienen", "tengo", "tenemos", "tenia",
      "hace", "hacen", "hacer", "hago", "haga", "hagan", "puede", "pueden", "poder", "podria", "podrian",
      "va", "van", "vamos", "ir", "voy", "etc", "entonces", "luego", "despues", "mientras", "durante", "hacia",
      "tal", "vez", "sino", "embargo", "ejemplo", "igual", "respecto", "ahora", "siempre", "nunca", "aun"
    )))
  }
  c("creo", "considero", "consideramos", "pienso", "pensamos", "opino", "siento", "parece", "parecen",
    "bueno", "buena", "buenos", "buenas", "malo", "mala", "malos", "malas", "bien", "mal", "mejor", "peor",
    "deberia", "deberian", "debe", "deben", "debemos", "deberiamos", "gustaria", "encantaria", "quisiera",
    "quiero", "queremos", "sugiero", "sugerimos", "recomiendo", "espero", "esperamos", "ojala", "gracias",
    "nada", "ninguno", "ninguna", "ningun", "veces", "muchas", "muchos", "mucho", "mucha", "poco", "poca",
    "pocos", "pocas", "cosas", "cosa", "forma", "manera", "parte", "general", "bastante", "realmente",
    "quizas", "quiza", "importante", "necesario", "sugerencia", "sugerencias", "comentario", "comentarios",
    "encuesta", "pregunta", "preguntas", "personas", "alguna", "alguno", "algun", "ver", "veo", "demasiado",
    "favor", "decir", "agregar", "anadir", "mencionar", "si", "sí", "considerando", "considerar", "creemos",
    "necesito", "necesitamos", "necesitan", "necesita", "necesitaria", "necesitariamos", "falta", "faltan")
}

#' ¿El texto no responde nada? «-», «.», «no», «ninguno», «nada», «todo bien», «no tengo comentarios», «gaaaa»…
#'
#' Una no respuesta es un texto sin letras, uno hecho sólo de palabras de no respuesta, o una sola palabra sin
#' sentido (una letra que se repite tres veces o más, una risa). Basta una palabra de contenido para que cuente.
#' @keywords internal
.txt_no_respuesta <- function(x) {
  vocab <- c("no", "nop", "nope", "nel", "ninguno", "ninguna", "ningun", "ningunos", "ningunas", "nada", "na", "n",
             "a", "gracias", "muchas", "por", "el", "la", "lo", "los", "las", "de", "del", "que", "en", "es", "un",
             "una", "momento", "ahora", "ahorita", "tengo", "tenemos", "hay", "comentario", "comentarios",
             "sugerencia", "sugerencias", "adicional", "adicionales", "observacion", "observaciones", "todo", "bien",
             "ok", "okey", "oki", "okay", "claro", "x", "xd", "mas", "ya", "eso", "solo", "nomas", "si", "decir",
             "agregar", "anadir", "comentar", "mencionar", "estuvo", "esta", "estoy", "me", "parece", "por",
             "ninguna", "aplica", "sabe", "opina", "responde", "otro", "otra", "y", "e", "tal", "vez", "aun")
  tok <- .txt_tokens(x)
  vapply(tok, function(t) {
    if (!length(t)) return(TRUE)
    t0 <- .txt_sin_tildes(t)
    if (all(t0 %in% vocab)) return(TRUE)
    length(t0) == 1L && (grepl("(.)\\1\\1", t0) || grepl("^(ja|je|ji|jo)+j?$", t0) || !grepl("[aeiouy]", t0))
  }, logical(1), USE.NAMES = FALSE)
}

# Terminaciones verbales frecuentes, de la más larga a la más corta. Sólo se usan si el infinitivo está en el corpus.
.TXT_TERMINACIONES_VERBO <- c(
  "ariamos", "eriamos", "iriamos", "aremos", "eremos", "iremos", "arian", "erian", "irian", "ieron", "iendo",
  "aron", "ando", "aban", "aria", "eria", "iria", "amos", "emos", "imos", "ados", "adas", "idos", "idas",
  "aran", "eran", "iran", "aba", "ado", "ada", "ido", "ida", "ian", "ara", "an", "en", "ia", "e", "a"
)

#' Raíz de cada palabra: el singular, o el infinitivo cuando el corpus lo trae
#'
#' Sólo agrupa flexiones. Un plural nominal va a su singular, nunca al infinitivo (TXT-13). Una forma verbal («mejoren», «mejoran») se une a su infinitivo si éste aparece en
#' `vocabulario`; si no, queda sola. El plural se lleva al singular («profesores» → «profesor», «veces» → «vez»).
#' No une sinónimos (profesores ≠ docentes); para eso está `equivalencias`, un vector con nombre raíz → raíz.
#' Devuelve las raíces sin tilde, en el orden de `x`.
#' @keywords internal
.txt_raiz <- function(x, vocabulario = x, equivalencias = NULL) {
  w <- .txt_sin_tildes(tolower(as.character(x)))
  voc <- unique(.txt_sin_tildes(tolower(as.character(vocabulario))))
  infinitivos <- voc[grepl("(ar|er|ir)$", voc) & nchar(voc) >= 5L]
  verbo <- function(p) {
    for (t in .TXT_TERMINACIONES_VERBO) {
      if (!endsWith(p, t)) next
      s <- substr(p, 1L, nchar(p) - nchar(t))
      if (nchar(s) < 3L) next
      cand <- paste0(s, c("ar", "er", "ir"))
      hit <- cand[cand %in% infinitivos & cand != p]
      if (length(hit)) return(hit[1])
    }
    NA_character_
  }
  # Los participios plurales («mejorados», «atendidas») sí son formas del verbo.
  verbo_participio <- function(p) if (grepl("(ados|adas|idos|idas)$", p)) verbo(p) else NA_character_
  singular <- function(p) {
    n <- nchar(p)
    if (n < 4L || grepl("(is|us)$", p)) return(p)
    if (grepl("ces$", p) && n > 4L) return(sub("ces$", "z", p))
    if (grepl("iones$", p)) return(sub("es$", "", p))
    if (grepl("[rlndjy]es$", p)) return(sub("es$", "", p))
    if (grepl("[aeiou]s$", p)) return(sub("s$", "", p))
    p
  }
  # Un plural nominal (-as/-os/-es que no es participio: ésos los toma `verbo`) va a su singular y no al infinitivo:
  # «prácticas» es «práctica», no «practicar» (TXT-13). Y un singular que el corpus trae también en plural es
  # sustantivo (sólo en -a/-o: «mejore» con «mejores» sigue siendo verbo): tampoco se vuelve verbo, para que «práctica» y «prácticas» queden juntas.
  corpus <- unique(c(w, voc))
  nominal <- function(p) grepl("(as|os|es)$", p) || (grepl("[ao]$", p) && paste0(p, "s") %in% corpus)
  r <- vapply(w, function(p) {
    if (nominal(p) && is.na(verbo_participio(p))) return(singular(p))
    v <- verbo(p)
    if (!is.na(v)) return(v)
    singular(p)
  }, character(1), USE.NAMES = FALSE)
  eq <- unlist(equivalencias %||% list())
  if (length(eq) && !is.null(names(eq))) {
    nm <- .txt_sin_tildes(tolower(names(eq)))
    m <- match(r, nm)
    r[!is.na(m)] <- .txt_sin_tildes(tolower(as.character(eq[m[!is.na(m)]])))
  }
  stats::setNames(r, as.character(x))
}

# Conectores que pueden ir dentro de una frase de tres palabras («biblioteca de sociales», «espacios de estudio»).
.TXT_CONECTORES_FRASE <- c("de", "del", "y", "en", "para", "a", "al", "con")

#' Las frases de dos o tres palabras que usan `min_personas` personas o más
#'
#' Dos raíces de contenido seguidas (distintas), o dos con un conector en medio. La clave une las raíces (sin tilde); la forma
#' es la escritura más frecuente. Se cuentan personas, no apariciones.
#' @keywords internal
.txt_frases <- function(tokens, min_personas = 3L, min_chars = 3L, vacias = .txt_vacias_limpias(), equivalencias = NULL) {
  vacio <- data.frame(clave = character(), forma = character(), personas = integer(), stringsAsFactors = FALSE)
  if (!length(tokens)) return(vacio)
  voc <- unique(unlist(tokens))
  es_contenido <- function(t) nchar(t, type = "chars") >= min_chars & !.txt_sin_tildes(t) %in% vacias
  raiz <- .txt_raiz(voc, vocabulario = voc[es_contenido(voc)], equivalencias = equivalencias)
  filas <- lapply(seq_along(tokens), function(i) {
    t <- tokens[[i]]; n <- length(t)
    if (n < 2L) return(NULL)
    ok <- es_contenido(t); rz <- unname(raiz[t])
    out <- list()
    for (j in seq_len(n - 1L)) {
      if (ok[j] && ok[j + 1L] && rz[j] != rz[j + 1L]) out[[length(out) + 1L]] <- c(paste(rz[j], rz[j + 1L]), paste(t[j], t[j + 1L]))
      if (j <= n - 2L && ok[j] && .txt_sin_tildes(t[j + 1L]) %in% .TXT_CONECTORES_FRASE && ok[j + 2L]) {
        out[[length(out) + 1L]] <- c(paste(rz[j], t[j + 1L], rz[j + 2L]), paste(t[j], t[j + 1L], t[j + 2L]))
      }
    }
    if (!length(out)) return(NULL)
    m <- do.call(rbind, out)
    data.frame(persona = i, clave = m[, 1], forma = m[, 2], stringsAsFactors = FALSE)
  })
  d <- do.call(rbind, filas)
  if (is.null(d) || !nrow(d)) return(vacio)
  personas <- tapply(d$persona, d$clave, function(p) length(unique(p)))
  claves <- names(personas)[personas >= max(1L, as.integer(min_personas))]
  if (!length(claves)) return(vacio)
  forma <- vapply(claves, function(k) .txt_forma_frecuente(d$forma[d$clave == k]), character(1))
  out <- data.frame(clave = claves, forma = unname(forma), personas = as.integer(personas[claves]), stringsAsFactors = FALSE)
  out[order(-out$personas, out$clave), , drop = FALSE]
}

#' La escritura más frecuente de un término (en empate, la primera en orden alfabético)
#' @keywords internal
.txt_forma_frecuente <- function(x) {
  tb <- table(x)
  names(tb)[order(-as.integer(tb), names(tb))][1]
}

#' Palabras vacías de la nube limpia: funcionales más opinión, sin tilde
#' @keywords internal
.txt_vacias_limpias <- function() unique(c(.txt_palabras_vacias("funcionales"), .txt_palabras_vacias("opinion")))

#' Conteo de términos de una nube: por persona o por mención, con o sin raíz y frases
#'
#' Con `lematizar`, quita palabras vacías funcionales y de opinión, agrupa flexiones, une las frases que usan
#' tres personas o más (o `min_personas`, si es mayor) en un término propio y muestra la forma más frecuente de cada
#' raíz. La frase no le quita la persona a sus palabras: quien escribe «biblioteca de sociales» usa la raíz
#' «biblioteca» y cuenta en ella (una mención es una persona que usa la raíz al menos una vez). Sin `lematizar`, cada palabra es su
#' propio término con la lista de palabras vacías de siempre. Con `contar = "personas"` cada persona suma 1 por
#' término (sin ponderar) y sólo quedan los términos que usan `min_personas` personas o más; con `"menciones"` se
#' suman las apariciones, ponderadas por `pesos`. Devuelve `data.frame(palabra, n)` de mayor a menor.
#'
#' El diccionario de la pregunta (TXT-6/7, texto_abierto_diccionario.R): `equivalencias` (grupos `list(mostrar,
#' formas)` o el vector raíz → raíz de antes) une formas y dibuja `mostrar`; `frases_fijas` se unen aunque no lleguen
#' a 3 personas ni a `min_personas`; `excluir` saca términos, y uno de varias palabras se lleva sus palabras donde
#' aparece.
#' @keywords internal
.txt_conteo_terminos <- function(textos, pesos = NULL, contar = c("menciones", "personas"), lematizar = FALSE,
                                 min_chars = 3L, min_personas = 3L, equivalencias = NULL, excluir = NULL,
                                 frases_fijas = NULL) {
  contar <- match.arg(contar)
  min_personas <- suppressWarnings(as.integer(min_personas[1])); if (is.na(min_personas) || min_personas < 1L) min_personas <- 3L
  pesos <- if (is.null(pesos)) rep(1, length(textos)) else as.numeric(pesos)
  vacio <- data.frame(palabra = character(), n = numeric(), stringsAsFactors = FALSE)
  tokens <- .txt_tokens(textos)
  vacias <- if (isTRUE(lematizar)) .txt_vacias_limpias() else .txt_palabras_vacias("base")
  es_contenido <- function(t) nchar(t, type = "chars") >= min_chars & !.txt_sin_tildes(t) %in% vacias
  dic_activo <- length(equivalencias) > 0L || length(excluir) > 0L || length(frases_fijas) > 0L
  voc <- unique(unlist(tokens))
  voc_cont <- voc[es_contenido(voc)]
  pfx <- .txt_dic_patrones(frases_fijas); pex <- .txt_dic_patrones(excluir)
  sueltos <- .txt_dic_termino(unlist(excluir %||% character(0))); sueltos <- sueltos[nzchar(sueltos) & !grepl(" ", sueltos, fixed = TRUE)]
  voc_todo <- unique(c(voc, unlist(pfx$tokens), unlist(pex$tokens), unlist(.txt_tokens(sueltos))))
  # Clave de cada palabra: la raíz con lematizar; sin él, la palabra (sin tilde si hay diccionario, para casar lo tecleado).
  clave_de <- if (isTRUE(lematizar)) function(w) unname(.txt_raiz(w, vocabulario = voc_cont)) else if (dic_activo) function(w) .txt_sin_tildes(tolower(w)) else function(w) w
  eqm <- .txt_dic_mapa(equivalencias, clave_de)
  raiz <- if (!length(voc_todo)) NULL else if (isTRUE(lematizar)) .txt_raiz(voc_todo, vocabulario = voc_cont, equivalencias = as.list(eqm$mapa)) else if (dic_activo) {
    k <- clave_de(voc_todo); m <- match(k, names(eqm$mapa)); k[!is.na(m)] <- unname(eqm$mapa[m[!is.na(m)]]); stats::setNames(k, voc_todo)
  } else NULL
  # La clave con que se compara un token contra un patrón: su raíz si es de contenido; si no, la palabra sin tilde.
  clave_patron <- function(t) if (is.null(raiz)) .txt_sin_tildes(t) else ifelse(es_contenido(t), unname(raiz[t]), .txt_sin_tildes(t))
  pfx_k <- lapply(pfx$tokens, clave_patron); pex_k <- lapply(pex$tokens, clave_patron)
  o <- order(-lengths(pfx_k)); pfx_k <- pfx_k[o]; pfx_txt <- pfx$texto[o]
  pex_k <- pex_k[order(-lengths(pex_k))]
  fijas_claves <- if (length(pfx_k)) paste0("§", vapply(pfx_k, paste, "", collapse = " ")) else character(0)
  excl_claves <- if (length(sueltos)) unique(unname(if (is.null(raiz)) clave_de(tolower(sueltos)) else raiz[unlist(.txt_tokens(sueltos))])) else character(0)
  # Una frase la usan tres personas o más (plan TXT-2), aunque la nube admita términos de menos personas.
  frases <- if (isTRUE(lematizar)) .txt_frases(tokens, max(3L, min_personas), min_chars, vacias, as.list(eqm$mapa)) else NULL
  fr_claves <- frases$clave %||% character(0)
  filas <- lapply(seq_along(tokens), function(i) {
    t <- tokens[[i]]; n <- length(t)
    if (!n) return(NULL)
    ok <- es_contenido(t)
    rz <- if (is.null(raiz)) t else unname(raiz[t])
    kp <- if (length(pfx_k) || length(pex_k)) clave_patron(t) else NULL
    clave <- character(0); forma <- character(0); j <- 1L
    while (j <= n) {
      if (length(pex_k)) {
        hit <- .txt_dic_calza(kp, j, pex_k)
        if (hit[2] > 0L) { j <- j + hit[2]; next }   # el término excluido se va con sus palabras
      }
      if (length(pfx_k)) {
        hit <- .txt_dic_calza(kp, j, pfx_k)
        if (hit[2] > 0L) {
          idx <- j:(j + hit[2] - 1L)
          clave <- c(clave, fijas_claves[hit[1]], rz[idx][ok[idx]]); forma <- c(forma, pfx_txt[hit[1]], t[idx][ok[idx]])
          j <- j + hit[2]; next
        }
      }
      if (length(fr_claves) && ok[j]) {
        if (j <= n - 2L && ok[j + 2L]) {
          k3 <- paste(rz[j], t[j + 1L], rz[j + 2L])
          if (k3 %in% fr_claves) { clave <- c(clave, k3, rz[j], rz[j + 2L]); forma <- c(forma, paste(t[j:(j + 2L)], collapse = " "), t[j], t[j + 2L]); j <- j + 3L; next }
        }
        if (j <= n - 1L && ok[j + 1L]) {
          k2 <- paste(rz[j], rz[j + 1L])
          if (k2 %in% fr_claves) { clave <- c(clave, k2, rz[j], rz[j + 1L]); forma <- c(forma, paste(t[j:(j + 1L)], collapse = " "), t[j], t[j + 1L]); j <- j + 2L; next }
        }
      }
      if (ok[j]) { clave <- c(clave, rz[j]); forma <- c(forma, t[j]) }
      j <- j + 1L
    }
    if (!length(clave)) return(NULL)
    data.frame(persona = i, clave = clave, forma = forma, peso = pesos[i], stringsAsFactors = FALSE)
  })
  d <- do.call(rbind, filas)
  if (!is.null(d) && length(excl_claves)) d <- d[!d$clave %in% excl_claves, , drop = FALSE]
  if (is.null(d) || !nrow(d)) return(vacio)
  if (identical(contar, "personas")) {
    n <- tapply(d$persona, d$clave, function(p) length(unique(p)))
    n <- n[n >= min_personas | names(n) %in% fijas_claves]
  } else {
    n <- tapply(d$peso, d$clave, sum, na.rm = TRUE)
  }
  if (!length(n)) return(vacio)
  palabra <- if (isTRUE(lematizar) || dic_activo) vapply(names(n), function(k) .txt_forma_frecuente(d$forma[d$clave == k]), character(1)) else names(n)
  if (length(eqm$mostrar)) { m <- match(names(n), names(eqm$mostrar)); palabra[!is.na(m)] <- unname(eqm$mostrar[m[!is.na(m)]]) }
  out <- data.frame(palabra = unname(palabra), n = as.numeric(n), stringsAsFactors = FALSE)
  out[order(-out$n, out$palabra), , drop = FALSE]
}

#' Cuántos escribieron algo y cuántos comentarios tienen contenido
#' @keywords internal
.txt_resumen_respuestas <- function(x) {
  x <- as.character(x); x[is.na(x)] <- ""
  escrito <- nzchar(trimws(x))
  list(escribieron = sum(escrito), con_contenido = sum(escrito & !.txt_no_respuesta(x)))
}
