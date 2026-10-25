# Citas representativas del comentario abierto (TXT-4, plan-texto-abierto-ccss-2026-10-24).
#
# Selección DETERMINISTA, sin elegir a mano:
#   - Candidatas: comentarios con contenido (no «-», «no», «ninguno»…: `.txt_no_respuesta`) de 40 a 280 caracteres,
#     medidos ya anonimizados.
#   - Orden: cuántas raíces frecuentes contienen. Una raíz es frecuente si la usan `min_personas` personas o más
#     (3; si ninguna llega, 2) entre los comentarios con contenido del tema o del total, según el filtro de la lámina.
#     Las raíces son las de la nube limpia (`.txt_raiz`, sin sinónimos) y se cuentan por persona, sin ponderar.
#   - Descarte: una cita que comparte más del 60 % de SUS raíces con otra ya elegida no entra.
#   - Una sola cita por persona. Empates: una huella de la semilla fija y el id de la cita (no toca el RNG de la sesión
#     y no depende del orden de las filas).
#
# Anonimato: el correo, el teléfono y la URL se borran con la expresión de la nube (`.txt_normalizar`) y dejan «[…]»;
# no hay atribución. Un nombre propio de persona que no sea un autor citado se MARCA para revisión, nunca se borra en
# silencio. El texto no se corrige: sólo se colapsan los espacios y se quitan las comillas que lo envuelven.
#
# Aprobación: la lámina dibuja las citas cuyos ids están en `citas_aprobadas`. Sin aprobadas, propone un borrador y lo
# dice («Citas sin aprobar»). El id es `c` + 10 hex del md5 del comentario original (espacios colapsados): estable si
# cambian el orden de las filas o el filtro, y cambia si alguien corrige el texto, que es cuando hay que reaprobar.

.CITAS_ELISION <- "[\u2026]"
.CITAS_SEMILLA <- 20261024L

#' Comentario con los espacios colapsados (la forma de la que sale el id)
#' @keywords internal
.citas_compactar <- function(x) {
  x <- as.character(x); x[is.na(x)] <- ""
  x <- enc2utf8(x); x[is.na(x)] <- ""
  trimws(gsub("\\s+", " ", x, perl = TRUE))
}

#' Comentario anonimizado: correo, teléfono y URL pasan a «[…]»; el resto, tal como se escribió
#'
#' Las expresiones son las de `.txt_normalizar` (la nube): lo que la nube no cuenta, la cita no lo muestra.
#' @keywords internal
.citas_anonimizar <- function(x) {
  x <- .citas_compactar(x)
  e <- .CITAS_ELISION
  x <- gsub("https?://\\S+|www\\.\\S+", e, x, perl = TRUE, ignore.case = TRUE)
  x <- gsub("\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b", e, x, perl = TRUE, ignore.case = TRUE)
  x <- .txt_borrar_telefonos(x, e)
  x <- gsub("\\[\u2026\\](\\s*\\[\u2026\\])+", e, x, perl = TRUE)                # dos borrados seguidos son uno
  x <- gsub("^[\"\u201C\u201D\u00AB\u00BB]+\\s*|\\s*[\"\u201C\u201D\u00AB\u00BB]+$", "", x, perl = TRUE)   # la lámina pone sus comillas
  trimws(gsub("\\s+", " ", x, perl = TRUE))
}

#' Id estable de una cita
#' @keywords internal
.citas_id <- function(x) {
  vapply(.citas_compactar(x), function(s) paste0("c", substr(digest::digest(s, algo = "md5", serialize = FALSE), 1L, 10L)),
         character(1), USE.NAMES = FALSE)
}

#' Corta una cita en límite de palabra y marca el corte con «[…]»; nunca parte una palabra ni corrige nada
#' @keywords internal
.citas_cortar <- function(x, max_chars) {
  vapply(as.character(x), function(s) {
    if (is.na(s) || nchar(s) <= max_chars) return(s)
    cab <- substr(s, 1L, max(1L, max_chars - 4L))
    siguiente <- substr(s, nchar(cab) + 1L, nchar(cab) + 1L)
    if (!grepl("^\\s$", siguiente)) cab <- sub("\\s+\\S*$", "", cab, perl = TRUE)   # la palabra a medias se va entera
    cab <- sub("[\\s,;:\u2013\u2014-]+$", "", cab, perl = TRUE)
    paste(cab, .CITAS_ELISION)
  }, character(1), USE.NAMES = FALSE)
}

# Palabras con mayúscula a media frase que no son personas: la institución, los lugares, los programas, los meses.
.CITAS_NO_PERSONAS <- c(
  "pucp", "unsa", "unmsm", "facultad", "universidad", "catolica", "ciencias", "sociales", "sociologia", "antropologia",
  "economia", "politica", "psicologia", "derecho", "letras", "humanidades", "estudios", "generales", "eeggll", "eegg",
  "biblioteca", "departamento", "escuela", "especialidad", "maestria", "doctorado", "pregrado", "posgrado", "ciclo",
  "peru", "lima", "arequipa", "cusco", "piura", "trujillo", "dios", "covid", "zoom", "google", "teams", "meet", "moodle",
  "canvas", "paideia", "intranet", "campus", "virtual", "whatsapp", "facebook", "instagram", "excel", "word",
  "powerpoint", "spss", "stata", "python", "nvivo", "atlas", "ingles", "espanol", "quechua", "aymara", "tesis",
  "phyton", "colab", "metodos", "cuantitativos", "cualitativos", "investigacion", "estadistica", "seminario", "taller",
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "setiembre", "octubre",
  "noviembre", "diciembre", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"
)
# Autores que un comentario de ciencias sociales cita por su apellido: no identifican a quien escribe ni a un tercero.
.CITAS_AUTORES <- c(
  "marx", "engels", "weber", "durkheim", "bourdieu", "foucault", "giddens", "habermas", "gramsci", "mariategui",
  "quijano", "arguedas", "vallejo", "basadre", "cotler", "degregori", "portocarrero", "freud", "lacan", "piaget",
  "vygotsky", "kant", "hegel", "nietzsche", "rawls", "nussbaum", "latour", "goffman", "parsons", "merton", "simmel",
  "tocqueville", "rousseau", "hobbes", "locke", "keynes", "hayek", "arendt", "butler", "beauvoir", "geertz",
  "malinowski", "wallerstein", "castells", "bauman", "luhmann", "polanyi", "schumpeter", "elias", "freire", "said",
  "fanon", "spivak", "lefebvre", "harvey", "sartre", "comte", "spencer", "mead", "boas", "levi", "strauss"
)
# Tratamientos tras los que suele ir el nombre de una persona, aunque se escriba en minúscula («el profe juan»).
.CITAS_TRATAMIENTOS <- "profe|profesor|profesora|prof|dr|dra|doctor|doctora|miss|mister|señor|señora|sr|sra|licenciado|licenciada|lic|ingeniero|ingeniera|ing|jp|jefe de práctica"

#' Marca de revisión por cita: «Revisar: posible nombre propio («Rosales»)» o vacío
#'
#' Una palabra con mayúscula inicial a media frase que no es sigla, lugar, institución, palabra vacía ni autor citado;
#' o la palabra que sigue a un tratamiento («profesora», «dr.»). Ante la duda se marca: revisar cuesta un vistazo.
#' @param autores Apellidos extra que no se marcan (autores que cita el estudio).
#' @keywords internal
.citas_revision <- function(x, autores = NULL) {
  no_marcar <- unique(c(.CITAS_NO_PERSONAS, .CITAS_AUTORES, .txt_vacias_limpias(),
                        .txt_sin_tildes(tolower(trimws(as.character(unlist(autores %||% character(0))))))))
  clave <- function(w) .txt_sin_tildes(tolower(w))
  vapply(as.character(x), function(s) {
    if (is.na(s) || !nzchar(s)) return("")
    hall <- character(0)
    m <- gregexpr("(?<!\\p{L})\\p{Lu}\\p{Ll}+", s, perl = TRUE)[[1]]
    if (m[1] > 0) {
      ws <- regmatches(s, list(m))[[1]]
      for (k in seq_along(ws)) {
        antes <- trimws(substr(s, 1L, m[k] - 1L))
        if (!nzchar(antes) || grepl("[.!?\u00A1\u00BF\u2026:;(\"\u201C\u00AB-]$", antes, perl = TRUE)) next   # inicio de frase
        if (clave(ws[k]) %in% no_marcar) next
        hall <- c(hall, ws[k])
      }
    }
    t <- regmatches(s, gregexpr(paste0("(?i)(?<!\\p{L})(", .CITAS_TRATAMIENTOS, ")\\.?\\s+(\\p{L}+)"), s, perl = TRUE))[[1]]
    if (length(t)) {
      sig <- sub("^.*\\s(\\p{L}+)$", "\\1", t, perl = TRUE)
      hall <- c(hall, sig[!clave(sig) %in% no_marcar])
    }
    hall <- unique(hall)
    if (!length(hall)) "" else sprintf("Revisar: posible nombre propio (\u00AB%s\u00BB)", paste(hall, collapse = "\u00BB, \u00AB"))
  }, character(1), USE.NAMES = FALSE)
}

#' Raíces de contenido de cada comentario (las de la nube limpia), sin repetir
#'
#' `equivalencias` son las del diccionario de la pregunta (TXT-6/7): dos formas unidas por el usuario puntúan como una.
#' Los términos excluidos no se aplican aquí: la cita es textual.
#' @keywords internal
.citas_raices <- function(textos, min_chars = 3L, equivalencias = NULL) {
  tok <- .txt_tokens(textos)
  vacias <- .txt_vacias_limpias()
  es_cont <- function(t) nchar(t, type = "chars") >= min_chars & !.txt_sin_tildes(t) %in% vacias
  voc <- unique(unlist(tok))
  if (!length(voc)) return(lapply(tok, function(t) character(0)))
  cont <- voc[es_cont(voc)]
  eqm <- .txt_dic_mapa(equivalencias, function(w) unname(.txt_raiz(w, vocabulario = cont)))
  raiz <- .txt_raiz(voc, vocabulario = cont, equivalencias = as.list(eqm$mapa))
  lapply(tok, function(t) unique(unname(raiz[t[es_cont(t)]])))
}

#' Huella de desempate con la semilla fija: no usa el RNG y no depende del orden de las filas
#' @keywords internal
.citas_desempate <- function(ids, semilla = .CITAS_SEMILLA) {
  vapply(ids, function(i) digest::digest(paste0(semilla, ":", i), algo = "md5", serialize = FALSE), character(1), USE.NAMES = FALSE)
}

# ---------------------------------------------------------------------------
# Edición del analista (TXT-8/9, O3b-a): recorte, corrección leve o [sic]. El motor nunca corrige solo.
# ---------------------------------------------------------------------------
#
# `citas_aprobadas` acepta ids sueltos (el contrato de siempre) u objetos `{id, texto = NULL, sic = FALSE}`:
#   - `texto` vale si es un RECORTE del original (fragmentos contiguos en su orden, «[…]» donde se quitó algo; sin «[…]»
#     sólo se corta en límite de oración) o una CORRECCIÓN LEVE (la misma palabra con una tilde, una mayúscula o hasta
#     dos letras cambiadas, en palabras de cuatro letras o más; nunca una palabra nueva), o las dos cosas. Si no, la
#     lámina dibuja el original y lo avisa con la causa.
#   - `sic = TRUE` dibuja el original con «[sic]» detrás de las palabras marcadas (`sic = ["pdoer"]` o `sic_palabras`)
#     o, sin marcas, al final. Con `sic`, un `texto` sólo puede recortar: corregir y marcar [sic] a la vez se contradicen.

.CITAS_FIN_ORACION <- "[.!?…][\"”»)]*$"

#' Ids aprobados y ediciones del analista a partir de `citas_aprobadas` (ids, objetos o data.frame)
#' @return Lista `ids` (en su orden, sin repetir) y `ediciones` (por id: `texto`, `sic`, `sic_palabras`).
#' @keywords internal
.citas_aprobadas_normalizar <- function(x) {
  if (is.data.frame(x)) x <- lapply(seq_len(nrow(x)), function(i) as.list(x[i, , drop = FALSE]))
  if (is.null(x) || !length(x)) return(list(ids = character(0), ediciones = list()))
  if (!is.list(x)) x <- as.list(x)
  limpio <- function(v) { v <- trimws(as.character(unlist(v))); v[!is.na(v) & nzchar(v)] }
  ids <- character(0); ed <- list()
  for (it in x) {
    if (!is.list(it) || is.null(names(it))) { ids <- c(ids, setdiff(unique(limpio(it)), ids)); next }
    id <- limpio(it$id)[1]
    if (is.na(id) || id %in% ids) next
    ids <- c(ids, id)
    tx <- limpio(it$texto)[1]
    sic_raw <- unlist(it$sic)
    palabras <- unique(c(if (is.character(sic_raw)) limpio(sic_raw), limpio(it$sic_palabras)))
    sic <- length(palabras) > 0L || isTRUE(as.logical(sic_raw)[1])
    if (!is.na(tx) || sic) ed[[id]] <- list(texto = if (is.na(tx)) NULL else .citas_compactar(tx), sic = sic, sic_palabras = palabras)
  }
  list(ids = ids, ediciones = ed)
}

.citas_elision_norm <- function(x) gsub("\\[\\s*(\\.\\.\\.|…)\\s*\\]", .CITAS_ELISION, x, perl = TRUE)
.citas_nucleo <- function(w) gsub("^[^\\p{L}\\p{N}]+|[^\\p{L}\\p{N}]+$", "", w, perl = TRUE)
.citas_borde_ini <- function(w) sub("^([^\\p{L}\\p{N}]*).*$", "\\1", w, perl = TRUE)
.citas_borde_fin <- function(w) if (!nzchar(.citas_nucleo(w))) "" else sub("^.*?([^\\p{L}\\p{N}]*)$", "\\1", w, perl = TRUE)

#' Una palabra del original frente a la del analista: «igual», «correccion» o NA (no es la misma palabra)
#'
#' La primera palabra de un fragmento puede cambiar su mayúscula y su signo de apertura; la última, su puntuación final.
#' @keywords internal
.citas_comparar_palabra <- function(o, e, primero = FALSE, ultimo = FALSE) {
  if (identical(o, e)) return("igual")
  if (!primero && !identical(.citas_borde_ini(o), .citas_borde_ini(e))) return(NA_character_)
  if (!ultimo && !identical(.citas_borde_fin(o), .citas_borde_fin(e))) return(NA_character_)
  no <- .citas_nucleo(o); ne <- .citas_nucleo(e)
  if (identical(no, ne) || (primero && identical(tolower(no), tolower(ne)))) return("igual")
  if (!nzchar(no) || !nzchar(ne)) return(NA_character_)
  if (identical(.txt_sin_tildes(tolower(no)), .txt_sin_tildes(tolower(ne)))) return("correccion")
  if (nchar(no) >= 4L && as.numeric(utils::adist(tolower(no), tolower(ne)))[1] <= 2) return("correccion")
  NA_character_
}

#' ¿Es la edición del analista un recorte o una corrección leve del original?
#' @return Lista `ok`, `tipo` (subconjunto de «recorte», «correccion»), `texto` (el que se dibuja) y `motivo` si no.
#' @keywords internal
.citas_validar_edicion <- function(original, editado) {
  o <- .citas_compactar(original)
  e <- .citas_compactar(.citas_elision_norm(editado))
  e <- trimws(gsub("^[\"“”«»]+\\s*|\\s*[\"“”«»]+$", "", e, perl = TRUE))
  rechazo <- function(m) list(ok = FALSE, tipo = character(0), texto = o, motivo = m)
  if (!nzchar(e)) return(rechazo("viene vacía"))
  if (identical(e, o)) return(list(ok = TRUE, tipo = character(0), texto = o, motivo = ""))
  ot <- strsplit(o, " ", fixed = TRUE)[[1]]
  el <- "\\s*\\[…\\]\\s*"
  ini_el <- grepl(paste0("^", el), e, perl = TRUE); fin_el <- grepl(paste0(el, "$"), e, perl = TRUE)
  partes <- trimws(strsplit(e, el, perl = TRUE)[[1]])
  partes <- partes[nzchar(.citas_nucleo(partes))]                                   # «[…].»: el signo suelto no es texto
  if (!length(partes)) return(rechazo("no conserva ninguna palabra del comentario"))
  pos <- 1L; ini <- NA_integer_; fin <- NA_integer_; cambios <- 0L; usadas <- 0L
  for (k in seq_along(partes)) {
    ft <- strsplit(partes[k], " ", fixed = TRUE)[[1]]; m <- length(ft); hallado <- FALSE
    if (pos + m - 1L <= length(ot)) for (s in pos:(length(ot) - m + 1L)) {
      r <- vapply(seq_len(m), function(j) .citas_comparar_palabra(ot[s + j - 1L], ft[j], primero = j == 1L, ultimo = j == m),
                  character(1))
      if (anyNA(r)) next
      hallado <- TRUE; if (is.na(ini)) ini <- s
      fin <- s + m - 1L; pos <- fin + 1L; cambios <- cambios + sum(r == "correccion"); usadas <- usadas + m
      break
    }
    if (!hallado) {
      clave <- function(w) .txt_sin_tildes(tolower(.citas_nucleo(w)))
      nuevas <- setdiff(clave(ft), clave(ot)); nuevas <- nuevas[nzchar(nuevas)]
      return(rechazo(if (length(nuevas)) sprintf("trae palabras que el comentario no tiene: «%s»", paste(head(nuevas, 3L), collapse = "», «"))
                     else "cambia el orden de las palabras o más de dos letras de una"))
    }
  }
  if (ini > 1L && !ini_el && !grepl(.CITAS_FIN_ORACION, ot[ini - 1L], perl = TRUE)) return(rechazo("empieza a media frase sin «[…]»"))
  if (fin < length(ot) && !fin_el && !grepl(.CITAS_FIN_ORACION, ot[fin], perl = TRUE)) return(rechazo("termina a media frase sin «[…]»"))
  if (cambios > max(1L, usadas %/% 3L)) return(rechazo(sprintf("corrige %d de %d palabras", cambios, usadas)))
  recorte <- length(partes) > 1L || ini > 1L || fin < length(ot)
  list(ok = TRUE, tipo = c(if (recorte) "recorte", if (cambios > 0L) "correccion"), texto = e, motivo = "")
}

#' «[sic]» detrás de las palabras marcadas o, sin marcas que estén en el texto, al final
#' @return Lista `texto` y `no_encontradas` (las marcas que el texto no tiene).
#' @keywords internal
.citas_marcar_sic <- function(texto, palabras = character(0)) {
  palabras <- unique(trimws(as.character(unlist(palabras)))); palabras <- palabras[!is.na(palabras) & nzchar(palabras)]
  tk <- strsplit(texto, " ", fixed = TRUE)[[1]]
  nuc <- tolower(.citas_nucleo(tk)); marcar <- logical(length(tk)); faltan <- character(0)
  for (p in palabras) {
    i <- which(nuc == tolower(.citas_nucleo(p)))
    if (length(i)) marcar[i] <- TRUE else faltan <- c(faltan, p)
  }
  if (!any(marcar)) return(list(texto = paste(texto, "[sic]"), no_encontradas = faltan))
  tk[marcar] <- sub("^([^\\p{L}\\p{N}]*)(.*?)([^\\p{L}\\p{N}]*)$", "\\1\\2 [sic]\\3", tk[marcar], perl = TRUE)
  list(texto = paste(tk, collapse = " "), no_encontradas = faltan)
}

#' Aplica las ediciones del analista a las citas aprobadas que se dibujan
#' @return Lista `elegidas` (texto, revisión y `ajuste`: «recorte», «correccion», «sic», «rechazada», unidos con «+»)
#'   y `avisos`.
#' @keywords internal
.citas_aplicar_ediciones <- function(elegidas, ediciones, autores = NULL) {
  avisos <- character(0)
  for (i in seq_len(nrow(elegidas))) {
    ed <- ediciones[[elegidas$id[i]]]
    if (is.null(ed)) next
    txt <- elegidas$texto[i]; aj <- character(0)
    if (!is.null(ed$texto)) {
      v <- .citas_validar_edicion(txt, ed$texto)
      if (!v$ok) {
        aj <- "rechazada"
        avisos <- c(avisos, sprintf("La cita %d editada no es un recorte ni una corrección leve del comentario (%s): se dibuja el original.", i, v$motivo))
      } else if (isTRUE(ed$sic) && "correccion" %in% v$tipo) {
        avisos <- c(avisos, sprintf("La cita %d corrige palabras y a la vez pide «[sic]»: se dibuja el original con «[sic]».", i))
      } else {
        txt <- v$texto; aj <- v$tipo
      }
    }
    if (isTRUE(ed$sic)) {
      s <- .citas_marcar_sic(txt, ed$sic_palabras)
      txt <- s$texto; aj <- c(aj, "sic")
      if (length(s$no_encontradas)) avisos <- c(avisos, sprintf("La cita %d no tiene %s: «[sic]» va al final.", i,
                                                                paste0("«", s$no_encontradas, "»", collapse = ", ")))
    }
    elegidas$texto[i] <- txt
    elegidas$revision[i] <- .citas_revision(txt, autores = autores)
    elegidas$ajuste[i] <- paste(aj, collapse = "+")
  }
  list(elegidas = elegidas, avisos = avisos)
}

#' Selecciona las citas de un comentario abierto
#'
#' @param textos Comentarios tal como vienen de la base (una fila por persona).
#' @param personas Identificador de persona por fila (opcional; sin él, cada fila es una persona).
#' @param aprobadas Ids aprobados por el analista (`citas_aprobadas`), en el orden en que se dibujan.
#' @param ediciones Ediciones del analista por id (`.citas_aprobadas_normalizar()$ediciones`): recorte, corrección leve
#'   o [sic]. Sólo se aplican a las aprobadas; el borrador va siempre con el texto original.
#' @param equivalencias Grupos del diccionario de la pregunta: unen formas al puntuar; no cambian el texto.
#' @return Lista: `candidatas` (data.frame id, texto, chars, puntaje, persona, revision, propuesta; en su orden),
#'   `elegidas` (las que se dibujan), `borrador`, `base` (comentarios con contenido), `escribieron`, `faltantes`
#'   (aprobadas que ya no están) y `avisos` para el analista.
#' @keywords internal
.citas_seleccionar <- function(textos, personas = NULL, aprobadas = NULL, min_chars = 40L, max_chars = 280L,
                               max_citas = 5L, min_citas = 3L, min_personas = 3L, solape = 0.6,
                               semilla = .CITAS_SEMILLA, autores = NULL, equivalencias = NULL, ediciones = NULL) {
  crudo <- as.character(textos); crudo[is.na(crudo)] <- ""
  if (is.null(personas)) personas <- seq_along(crudo)
  personas <- as.character(personas)
  escrito <- nzchar(trimws(crudo))
  contenido <- escrito & !.txt_no_respuesta(crudo)
  pool <- which(contenido)
  avisos <- character(0)
  vacio <- data.frame(id = character(), texto = character(), chars = integer(), puntaje = integer(), persona = character(),
                      revision = character(), propuesta = logical(), stringsAsFactors = FALSE)
  raices <- .citas_raices(crudo[pool], equivalencias = equivalencias)
  # Frecuencia por persona (sin ponderar) en los comentarios con contenido del tema o del total.
  por_raiz <- if (length(pool)) tapply(rep(personas[pool], lengths(raices)), unlist(raices), function(p) length(unique(p))) else integer(0)
  frecuentes <- names(por_raiz)[por_raiz >= min_personas]
  if (!length(frecuentes)) frecuentes <- names(por_raiz)[por_raiz >= 2L]
  anon <- .citas_anonimizar(crudo[pool])
  ch <- nchar(anon, type = "chars")
  ok <- ch >= min_chars & ch <= max_chars
  cand <- if (any(ok)) data.frame(
    id = .citas_id(crudo[pool][ok]), texto = anon[ok], chars = as.integer(ch[ok]),
    puntaje = vapply(raices[ok], function(r) length(intersect(r, frecuentes)), integer(1)),
    persona = personas[pool][ok], revision = .citas_revision(anon[ok], autores = autores),
    propuesta = FALSE, stringsAsFactors = FALSE) else vacio
  r_cand <- raices[ok]
  if (nrow(cand)) {
    u <- !duplicated(cand$id); cand <- cand[u, , drop = FALSE]; r_cand <- r_cand[u]   # el mismo texto es una sola cita
    o <- order(-cand$puntaje, .citas_desempate(cand$id, semilla))
    cand <- cand[o, , drop = FALSE]; r_cand <- r_cand[o]
    rownames(cand) <- NULL
    elegidas_i <- integer(0)
    for (i in seq_len(nrow(cand))) {
      if (length(elegidas_i) >= max_citas) break
      if (cand$persona[i] %in% cand$persona[elegidas_i]) next
      a <- r_cand[[i]]
      if (!length(a)) next
      if (any(vapply(r_cand[elegidas_i], function(b) length(intersect(a, b)) / length(a) > solape, logical(1)))) next
      elegidas_i <- c(elegidas_i, i)
    }
    cand$propuesta[elegidas_i] <- TRUE
  }
  aprobadas <- unique(trimws(as.character(unlist(aprobadas %||% character(0)))))
  aprobadas <- aprobadas[!is.na(aprobadas) & nzchar(aprobadas)]
  faltantes <- setdiff(aprobadas, cand$id)
  hay <- aprobadas[aprobadas %in% cand$id]
  if (length(faltantes)) {
    avisos <- c(avisos, sprintf("%d %s ya no %s entre los comentarios: se %s. Revisa la aprobación.",
                                length(faltantes), if (length(faltantes) == 1L) "cita aprobada" else "citas aprobadas",
                                if (length(faltantes) == 1L) "está" else "están", if (length(faltantes) == 1L) "omite" else "omiten"))
  }
  if (length(hay) > max_citas) {
    avisos <- c(avisos, sprintf("Hay %d citas aprobadas y la lámina lleva hasta %d: van las %d primeras.", length(hay), max_citas, max_citas))
    hay <- hay[seq_len(max_citas)]
  }
  borrador <- !length(hay)
  elegidas <- if (borrador) cand[cand$propuesta, , drop = FALSE] else cand[match(hay, cand$id), , drop = FALSE]
  rownames(elegidas) <- NULL
  elegidas$ajuste <- rep("", nrow(elegidas))
  if (!borrador && length(ediciones)) {
    ap <- .citas_aplicar_ediciones(elegidas, ediciones, autores = autores)
    elegidas <- ap$elegidas; avisos <- c(avisos, ap$avisos)
  }
  if (borrador && nrow(elegidas)) {
    avisos <- c(avisos, sprintf("Citas sin aprobar: la lámina muestra %d %s como borrador. Apruébalas antes de entregar.",
                                nrow(elegidas), if (nrow(elegidas) == 1L) "propuesta" else "propuestas"))
  }
  if (nrow(elegidas) < min_citas) {
    avisos <- c(avisos, sprintf("Sólo %d %s de %d a %d caracteres con contenido distinto: la lámina pide al menos %d.",
                                nrow(elegidas), if (nrow(elegidas) == 1L) "comentario cumple" else "comentarios cumplen",
                                min_chars, max_chars, min_citas))
  }
  rev <- elegidas$revision[nzchar(elegidas$revision)]
  if (length(rev)) avisos <- c(avisos, paste0("Una cita de la lámina menciona a alguien: ", sub("^Revisar: ", "", rev),
                                              ". Revisa que no identifique a una persona."))
  list(candidatas = cand, elegidas = elegidas, borrador = borrador, base = as.integer(length(pool)),
       escribieron = as.integer(sum(escrito)), faltantes = faltantes, avisos = avisos)
}

#' Filtros que apuntan a un código de Codificación (`<var>_recod`) y el resto
#'
#' Una respuesta multicódigo guarda sus códigos separados por espacio («A C»): el filtro de igualdad no la casa. Esos
#' filtros se aplican aquí, código por código; los demás siguen por el filtro del motor.
#' @keywords internal
.citas_separar_filtros <- function(filtros, columnas = NULL) {
  filtros <- filtros %||% list()
  if (is.data.frame(filtros) && all(c("variable", "op", "value") %in% names(filtros))) {
    es <- grepl("_recod$", filtros$variable, ignore.case = TRUE) & filtros$op %in% c("eq", "in")
    cod <- stats::setNames(lapply(filtros$value[es], function(v) v), filtros$variable[es])
    return(list(codigos = cod, resto = filtros[!es, , drop = FALSE]))
  }
  if (!length(filtros) || is.null(names(filtros))) return(list(codigos = list(), resto = filtros))
  es <- grepl("_recod$", names(filtros), ignore.case = TRUE)
  list(codigos = filtros[es], resto = filtros[!es])
}

#' Filas cuyo `<var>_recod` contiene alguno de los códigos pedidos (código por código, no por subcadena)
#' @keywords internal
.citas_filtro_codigos <- function(df, codigos) {
  if (!length(codigos)) return(df)
  for (nm in names(codigos)) {
    if (!nm %in% names(df)) .plan_spec_abort(sprintf("El filtro de citas pide «%s», que no está en la base. Codifica el comentario primero.", nm))
    vals <- trimws(unlist(strsplit(as.character(unlist(codigos[[nm]])), "\\s*,\\s*", perl = TRUE)))
    vals <- vals[!is.na(vals) & nzchar(vals)]
    if (!length(vals)) next
    col <- as.character(df[[nm]])
    keep <- vapply(strsplit(ifelse(is.na(col), "", col), "\\s+", perl = TRUE), function(t) any(t %in% vals), logical(1))
    df <- df[keep, , drop = FALSE]
  }
  df
}

#' TXT-2: ¿alcanza el texto para una lámina propia de frases? Sólo con `min_frases` frases que usen `min_personas`
#' personas o más (plan: 5 y 3). En CCSS no alcanza; la condición queda para el próximo estudio.
#' @keywords internal
.txt_ngramas_alcanza <- function(textos, min_frases = 5L, min_personas = 3L) {
  x <- as.character(textos); x[is.na(x)] <- ""
  x <- x[nzchar(trimws(x)) & !.txt_no_respuesta(x)]
  fr <- .txt_frases(.txt_tokens(x), min_personas = min_personas, vacias = .txt_vacias_limpias())
  list(alcanza = nrow(fr) >= min_frases, frases = as.integer(nrow(fr)))
}

#' Candidatas de citas para la tarjeta de aprobación (`GET /api/graficos/citas-candidatas`, O3b-a)
#'
#' Lee las fuentes de Gráficos (las del render: mismos comentarios, mismos ids) en la base pedida o, sin ella, en la
#' ACTIVA; con varias bases y ninguna activa no adivina. Aplica el filtro del tema como la lámina (código por código en
#' `<var>_recod`) y puntúa con el diccionario de la pregunta (TXT-6/7). No devuelve la persona de cada cita.
#' @param filtros JSON de la query (objeto `{variable: valor}`) o lista ya parseada.
#' @keywords internal
citas_candidatas_payload <- function(sources, variable = NULL, base = NULL, base_activa = NULL, filtros = NULL,
                                     var_persona = NULL) {
  uno <- function(x) { v <- trimws(as.character(unlist(x %||% ""))[1]); if (is.na(v)) "" else v }
  variable <- uno(variable); base <- uno(base)
  if (!nzchar(variable)) stop_api(400, "E_CITAS_SIN_VARIABLE", "Falta la pregunta abierta ('variable').")
  if (grepl("$", variable, fixed = TRUE)) { base <- sub("\\$.*$", "", variable); variable <- sub("^.*\\$", "", variable) }
  bases <- names(sources$data_sources %||% list())
  if (nzchar(base)) {
    if (!base %in% bases) stop_api(404, "E_CITAS_BASE_NO_EXISTE", sprintf("La base '%s' no está entre las fuentes de Gráficos.", base))
  } else {
    activa <- uno(base_activa)
    base <- if (nzchar(activa) && activa %in% bases) activa else if (length(bases) == 1L) bases else ""
    if (!nzchar(base)) stop_api(400, "E_CITAS_SIN_BASE", "Hay varias bases y ninguna activa: indica 'base'.")
  }
  d <- sources$data_sources[[base]]
  # La pregunta abierta, no su codificación: la cita es lo que escribió la persona.
  if (grepl("_recod$", variable) && sub("_recod$", "", variable) %in% names(d)) variable <- sub("_recod$", "", variable)
  if (!variable %in% names(d)) {
    stop_api(404, "E_CITAS_VARIABLE_NO_EXISTE", sprintf("La base '%s' no tiene la pregunta '%s'.", base, variable))
  }
  d <- tryCatch({
    f <- if (is.character(filtros)) { if (nzchar(uno(filtros))) jsonlite::fromJSON(uno(filtros), simplifyVector = FALSE) else list() } else filtros
    sep <- .citas_separar_filtros(.ppt_norm_filters(f %||% list()))
    .citas_filtro_codigos(.apply_named_filters(d, filters = sep$resto, arg_name = "filtros", mode = "strict"), sep$codigos)
  }, error = function(e) {
    if (inherits(e, "api_error")) stop(e)
    stop_api(400, "E_CITAS_FILTRO_INVALIDO", paste("El filtro de las citas no se pudo aplicar:", conditionMessage(e)))
  })
  vp <- uno(var_persona)
  dic <- .txt_dic_de_ctx(list(instrumento = sources$inst_sources[[base]], var = variable))
  sel <- .citas_seleccionar(d[[variable]], personas = if (nzchar(vp) && vp %in% names(d)) d[[vp]] else NULL,
                            equivalencias = dic$equivalencias)
  cand <- sel$candidatas
  list(ok = TRUE, base = base, variable = variable, comentarios = sel$base, escribieron = sel$escribieron,
       diccionario = !.txt_dic_es_vacio(dic),
       candidatas = lapply(seq_len(nrow(cand)), function(i) list(
         id = cand$id[i], texto = cand$texto[i], chars = cand$chars[i], puntaje = cand$puntaje[i],
         revision = cand$revision[i], propuesta = isTRUE(cand$propuesta[i]))),
       avisos = I(sel$avisos[!grepl("^Citas sin aprobar", sel$avisos)]))   # el borrador es cosa de la lámina
}

# El constructor `p_citas()` vive con los demás en reporte_plan_slides.R.

#' Renderer del motor: datos del elemento, filtro por código, selección y espec de la lámina
#'
#' Resuelve la variable y los filtros con las closures del motor (`reporte_ppt_plan`), como el resto de los gráficos.
#' @keywords internal
.render_citas <- function(el, preset_args = list()) {
  resolver <- dynGet(".resolve_ref", ifnotfound = NULL); filtrar <- dynGet(".filter_data", ifnotfound = NULL)
  sep <- .citas_separar_filtros(el$filtros %||% list())
  ctx <- NULL
  if (is.function(resolver) && is.function(filtrar)) {
    ctx <- resolver(el$var, source = el$source %||% NULL, arg_name = "var")
    d <- filtrar(sep$resto, source = ctx$source); var <- ctx$var
    # El motor lleva la pregunta abierta a su `_recod` cuando existe; la cita es el texto que escribió la persona.
    if (isTRUE(ctx$recod_redirected) && !is.null(ctx$var_requested)) var <- sub("^.*\\$", "", as.character(ctx$var_requested)[1])
  } else {
    data_sources <- dynGet("data_sources", ifnotfound = NULL)
    if (!length(data_sources)) stop("citas: el render no expone las fuentes del estudio.", call. = FALSE)
    f <- .cifra_fuente(el$var, data_sources, dynGet("instrument_sources", ifnotfound = NULL))
    d <- .apply_named_filters(f$data, filters = sep$resto, arg_name = "filtros", mode = "strict"); var <- f$var
  }
  d <- .citas_filtro_codigos(d, sep$codigos)
  if (!var %in% names(d)) .plan_spec_abort(sprintf("Las citas piden «%s», que no está en la base.", var))
  vp <- el$var_persona %||% NULL
  personas <- if (!is.null(vp) && vp %in% names(d)) d[[vp]] else NULL
  # TXT-6/7: las equivalencias del diccionario de la pregunta, salvo que la lámina traiga las suyas (el plan gana).
  ov <- el$overrides %||% list()
  eq <- if ("equivalencias" %in% names(ov)) ov$equivalencias else .txt_dic_de_ctx(ctx)$equivalencias
  sel <- .citas_seleccionar(d[[var]], personas = personas, aprobadas = el$citas_aprobadas, ediciones = el$citas_ediciones, max_citas = el$max_citas %||% 5L,
                            autores = ov$autores, equivalencias = eq)
  for (a in sel$avisos) .pulso_aviso(a)
  graficar_citas(sel)
}

#' Las citas como gráfico de respaldo (Word y láminas sin pieza nativa), con la espec de la lámina nativa
#'
#' @param seleccion Resultado de `.citas_seleccionar()`.
#' @return Objeto `ggplot` con `attr(, "pulso_espec")` de tipo `citas`.
#' @export
graficar_citas <- function(seleccion) {
  el <- seleccion$elegidas
  k <- nrow(el)
  pt <- ggplot2::.pt
  y <- if (k) rev(seq_len(k)) else numeric(0)
  envolver <- function(s) paste(strwrap(s, width = 95), collapse = "\n")
  df <- data.frame(y = y, texto = vapply(el$texto, envolver, ""), stringsAsFactors = FALSE)
  p <- ggplot2::ggplot(df) +
    ggplot2::annotate("text", x = 0, y = y + 0.18, label = rep("\u201C", k), hjust = 0, vjust = 1, size = 34 / pt,
                      fontface = "bold", colour = .std_color("coral")) +
    ggplot2::geom_text(ggplot2::aes(x = 0.06, y = .data$y + 0.2, label = .data$texto), hjust = 0, vjust = 1, size = 14 / pt,
                       colour = .std_color("azul"), lineheight = 1) +
    ggplot2::scale_x_continuous(limits = c(0, 1), expand = c(0, 0)) +
    ggplot2::scale_y_continuous(limits = c(0.4, max(1, k) + 0.4), expand = c(0, 0)) +
    ggplot2::theme_void()
  if (isTRUE(seleccion$borrador)) p <- p + ggplot2::labs(subtitle = "Citas sin aprobar (borrador)")
  attr(p, "pulso_espec") <- list(
    version = "citas/1", tipo = "citas", citas = el[, intersect(c("id", "texto", "revision", "ajuste"), names(el)), drop = FALSE],
    borrador = isTRUE(seleccion$borrador), base = seleccion$base, escribieron = seleccion$escribieron,
    candidatas = seleccion$candidatas, faltantes = seleccion$faltantes, avisos = seleccion$avisos)
  p
}
