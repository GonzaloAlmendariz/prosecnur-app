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
  x <- gsub("\\+?\\d[\\d\\s().-]{6,}\\d", e, x, perl = TRUE)
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
#' @keywords internal
.citas_raices <- function(textos, min_chars = 3L) {
  tok <- .txt_tokens(textos)
  vacias <- .txt_vacias_limpias()
  es_cont <- function(t) nchar(t, type = "chars") >= min_chars & !.txt_sin_tildes(t) %in% vacias
  voc <- unique(unlist(tok))
  if (!length(voc)) return(lapply(tok, function(t) character(0)))
  raiz <- .txt_raiz(voc, vocabulario = voc[es_cont(voc)])
  lapply(tok, function(t) unique(unname(raiz[t[es_cont(t)]])))
}

#' Huella de desempate con la semilla fija: no usa el RNG y no depende del orden de las filas
#' @keywords internal
.citas_desempate <- function(ids, semilla = .CITAS_SEMILLA) {
  vapply(ids, function(i) digest::digest(paste0(semilla, ":", i), algo = "md5", serialize = FALSE), character(1), USE.NAMES = FALSE)
}

#' Selecciona las citas de un comentario abierto
#'
#' @param textos Comentarios tal como vienen de la base (una fila por persona).
#' @param personas Identificador de persona por fila (opcional; sin él, cada fila es una persona).
#' @param aprobadas Ids aprobados por el analista (`citas_aprobadas`), en el orden en que se dibujan.
#' @return Lista: `candidatas` (data.frame id, texto, chars, puntaje, persona, revision, propuesta; en su orden),
#'   `elegidas` (las que se dibujan), `borrador`, `base` (comentarios con contenido), `escribieron`, `faltantes`
#'   (aprobadas que ya no están) y `avisos` para el analista.
#' @keywords internal
.citas_seleccionar <- function(textos, personas = NULL, aprobadas = NULL, min_chars = 40L, max_chars = 280L,
                               max_citas = 5L, min_citas = 3L, min_personas = 3L, solape = 0.6,
                               semilla = .CITAS_SEMILLA, autores = NULL) {
  crudo <- as.character(textos); crudo[is.na(crudo)] <- ""
  if (is.null(personas)) personas <- seq_along(crudo)
  personas <- as.character(personas)
  escrito <- nzchar(trimws(crudo))
  contenido <- escrito & !.txt_no_respuesta(crudo)
  pool <- which(contenido)
  avisos <- character(0)
  vacio <- data.frame(id = character(), texto = character(), chars = integer(), puntaje = integer(), persona = character(),
                      revision = character(), propuesta = logical(), stringsAsFactors = FALSE)
  raices <- .citas_raices(crudo[pool])
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

# El constructor `p_citas()` vive con los demás en reporte_plan_slides.R.

#' Renderer del motor: datos del elemento, filtro por código, selección y espec de la lámina
#'
#' Resuelve la variable y los filtros con las closures del motor (`reporte_ppt_plan`), como el resto de los gráficos.
#' @keywords internal
.render_citas <- function(el, preset_args = list()) {
  resolver <- dynGet(".resolve_ref", ifnotfound = NULL); filtrar <- dynGet(".filter_data", ifnotfound = NULL)
  sep <- .citas_separar_filtros(el$filtros %||% list())
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
  sel <- .citas_seleccionar(d[[var]], personas = personas, aprobadas = el$citas_aprobadas, max_citas = el$max_citas %||% 5L,
                            autores = (el$overrides %||% list())$autores)
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
    version = "citas/1", tipo = "citas", citas = el[, intersect(c("id", "texto", "revision"), names(el)), drop = FALSE],
    borrador = isTRUE(seleccion$borrador), base = seleccion$base, escribieron = seleccion$escribieron,
    candidatas = seleccion$candidatas, faltantes = seleccion$faltantes, avisos = seleccion$avisos)
  p
}
