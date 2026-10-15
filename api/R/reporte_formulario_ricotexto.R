# Texto con formato del instrumento (item 19, revisado por Gonzalo el
# 2026-10-15: «los elementos html deben ser capaces de ser replicados, como por
# ejemplo codigo html en los encabezados»).
#
# Los XLSForm que pasan por Kobo traen formato como HTML literal en la celda
# (hsvg2026: 13 textos con `<span style="color:#002060">`, dos notas que abren
# con `######`). Antes el papel imprimia las etiquetas tal cual; despues, una
# primera version las QUITABA. Ahora el motor las INTERPRETA: cada texto que se
# imprime se convierte en una lista de TRAMOS
#   list(t = texto, b = negrita, i = cursiva, u = subrayado, s = puntos extra)
# mas saltos de linea `list(br = TRUE)`, y los dos renderers los pintan.
#
# UNA representacion: el `**enfasis**` del autor (L15) entra al mismo modelo de
# tramos como negrita. Ya no viaja como `**` en las cadenas del modelo.
#
# Soportado: <b>/<strong>, <i>/<em>, <u>, <br>, <p>, <div>, <li> (con «• »),
# <h1>..<h6> (negrita y cuerpo +2/+1/0, con salto antes y despues), <span style>
# con font-weight bold/700+, font-style italic y text-decoration underline,
# entidades, y markdown `#`..`######` al inicio de linea como encabezado del mismo
# nivel (`#{1,6}` + espacio, o `#{2,6}` pegado a una letra: «######En»).
# NO soportado (se quita la etiqueta y se conserva el texto): el color y el
# tamano de los `style` —el instrumento es en grises (B4/V2)—, <font>, <a>,
# <img>, <table> y afines. Eso se DECLARA en el aviso.
#
# DOMINIO: las palabras no cambian, solo la presentacion. El modelo conserva en
# sus campos de siempre el texto PLANO (lo que queda al quitar las etiquetas), y
# en `<campo>_rt` los tramos, ALINEADOS a ese plano: el texto visible de los
# tramos es, caracter a caracter, el del campo plano (`.form_rt_alinear`). Si no
# se pueden alinear, el campo va sin formato antes que con otras palabras.

# --- etiquetas ------------------------------------------------------------------

.FORM_RT_ENCABEZADO_S <- c(h1 = 2, h2 = 2, h3 = 1, h4 = 1, h5 = 0, h6 = 0)
.FORM_RT_SOPORTADAS <- c("b", "strong", "i", "em", "u", "br", "p", "div", "li",
                         "ul", "ol", "span", names(.FORM_RT_ENCABEZADO_S))
# No se pueden imprimir: se quita la etiqueta, se conserva el texto, se declara.
.FORM_RT_IGNORADAS <- c("font", "a", "img", "table", "tr", "td", "th", "tbody",
                        "thead", "sup", "sub", "small", "big", "mark", "s",
                        "strike", "del", "ins", "tt", "code", "label", "abbr",
                        "cite", "center", "section", "blockquote", "hr")
# De bloque entre las ignoradas: cortan linea para no pegar palabras.
.FORM_RT_IGNORADAS_BLOQUE <- c("table", "tr", "hr", "blockquote", "center", "section")

# Una etiqueta es `<nombre>`, `</nombre>`, `<nombre/>` o `<nombre attr="v" ...>`
# de un nombre CONOCIDO, con atributos que llevan `=`: «a<b y c>d» y «edad <5
# anos» son texto del autor y no casan.
.form_rt_tag_rx <- function() {
  attr <- "(?:\\s+[A-Za-z_:][-A-Za-z0-9_:.]*\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s\"'<>]+))"
  nombres <- paste(c(.FORM_RT_SOPORTADAS, .FORM_RT_IGNORADAS), collapse = "|")
  paste0("(?i)<!--.*?-->|<(/?)(", nombres, ")(", attr, "*)\\s*/?>")
}

# Encabezado markdown al INICIO DE CADA LINEA.
.FORM_RT_MD_RX <- "^[ \t]*(?:(#{1,6})[ \t]+|(#{2,6})(?=\\p{L}))(.*)$"

# Decodifica entidades HTML. `&amp;` va AL FINAL: decodificarla primero
# convertiria `&amp;lt;` (texto literal «&lt;») en «<».
.form_rt_entidades <- function(x) {
  x <- gsub("&nbsp;", " ", x, fixed = TRUE)
  x <- gsub("&lt;", "<", x, fixed = TRUE)
  x <- gsub("&gt;", ">", x, fixed = TRUE)
  x <- gsub("&quot;", "\"", x, fixed = TRUE)
  x <- gsub("&apos;", "'", x, fixed = TRUE)
  num <- function(s, rx, base) {
    m <- gregexpr(rx, s, perl = TRUE)
    regmatches(s, m) <- lapply(regmatches(s, m), function(ents) {
      vapply(ents, function(e) {
        cod <- sub(rx, "\\1", e, perl = TRUE)
        n <- suppressWarnings(strtoi(cod, base = base))
        if (is.na(n) || n <= 0L || n > 0x10FFFF) e else intToUtf8(n)
      }, character(1), USE.NAMES = FALSE)
    })
    s
  }
  x <- num(x, "&#([0-9]{1,7});", 10L)
  x <- num(x, "&#[xX]([0-9a-fA-F]{1,6});", 16L)
  gsub("&amp;", "&", x, fixed = TRUE)
}

.FORM_RT_ENTIDAD_RX <- "&(?:amp|nbsp|lt|gt|quot|apos|#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6});"

# Propiedades de un `style` que se pueden imprimir; `ignorado` si trae otras
# (color, tamano, familia...).
.form_rt_style <- function(attrs) {
  m <- regmatches(attrs, regexpr("(?i)style\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s\"'<>]+)", attrs, perl = TRUE))
  out <- list(b = FALSE, i = FALSE, u = FALSE, ignorado = FALSE)
  if (!length(m)) return(out)
  v <- tolower(sub("(?i)^style\\s*=\\s*", "", m, perl = TRUE))
  v <- gsub("^[\"']|[\"']$", "", v)
  for (decl in strsplit(v, ";", fixed = TRUE)[[1]]) {
    kv <- trimws(strsplit(decl, ":", fixed = TRUE)[[1]])
    if (length(kv) < 2L || !nzchar(kv[1])) next
    prop <- kv[1]; val <- paste(kv[-1], collapse = ":")
    if (identical(prop, "font-weight")) {
      n <- suppressWarnings(as.numeric(val))
      out$b <- val %in% c("bold", "bolder") || (!is.na(n) && n >= 700)
    } else if (identical(prop, "font-style")) {
      out$i <- val %in% c("italic", "oblique")
    } else if (prop %in% c("text-decoration", "text-decoration-line")) {
      out$u <- grepl("underline", val, fixed = TRUE)
    } else {
      out$ignorado <- TRUE
    }
  }
  out
}

.form_rt_run <- function(t, b = FALSE, i = FALSE, u = FALSE, s = 0) {
  list(t = t, b = isTRUE(b), i = isTRUE(i), u = isTRUE(u), s = as.numeric(s %||% 0))
}
.FORM_RT_BR <- list(br = TRUE)
.form_rt_es_br <- function(r) isTRUE(r$br)

# Parser pequeno y TOLERANTE: HTML mal cerrado, cierres huerfanos y anidados
# cruzados no lo rompen (un cierre sin apertura se ignora; una apertura sin
# cierre dura hasta el final del texto).
#   enfasis  = interpretar `**` como negrita (no en categorias de respuesta:
#              «5** a 10**» es texto del autor y no se toca, item 11).
#   markdown = interpretar `#` de encabezado al inicio de linea.
# Devuelve list(runs, formato = hubo HTML/entidad/markdown, ignorado = hubo algo
# que no se puede imprimir).
.form_rt_parse <- function(x, enfasis = TRUE, markdown = TRUE) {
  x <- .form_pdf_chr(x)
  formato <- FALSE; ignorado <- FALSE
  if (!nzchar(x)) return(list(runs = list(), formato = FALSE, ignorado = FALSE))
  if (markdown && grepl("#", x, fixed = TRUE)) {
    lineas <- strsplit(x, "\n", fixed = TRUE)[[1]]
    for (k in seq_along(lineas)) {
      m <- regmatches(lineas[k], regexec(.FORM_RT_MD_RX, lineas[k], perl = TRUE))[[1]]
      if (length(m)) {
        n <- nchar(if (nzchar(m[2])) m[2] else m[3])
        lineas[k] <- sprintf("<h%d>%s</h%d>", n, m[4], n)
        formato <- TRUE
      }
    }
    x <- paste(lineas, collapse = "\n")
  }
  rx <- .form_rt_tag_rx()
  pos <- gregexpr(rx, x, perl = TRUE)[[1]]
  trozos <- list()
  cursor <- 1L
  if (pos[1] > 0) {
    largos <- attr(pos, "match.length")
    for (k in seq_along(pos)) {
      if (pos[k] > cursor) trozos[[length(trozos) + 1L]] <- list(tipo = "texto", v = substr(x, cursor, pos[k] - 1L))
      trozos[[length(trozos) + 1L]] <- list(tipo = "tag", v = substr(x, pos[k], pos[k] + largos[k] - 1L))
      cursor <- pos[k] + largos[k]
    }
  }
  if (cursor <= nchar(x)) trozos[[length(trozos) + 1L]] <- list(tipo = "texto", v = substr(x, cursor, nchar(x)))

  # `**`: pares. Con un numero impar el ultimo no abre nada (se retira).
  n_marcas <- if (enfasis) sum(vapply(trozos, function(tr)
    if (identical(tr$tipo, "texto")) lengths(regmatches(tr$v, gregexpr("**", tr$v, fixed = TRUE))) else 0L,
    integer(1))) else 0L
  pares <- n_marcas - (n_marcas %% 2L)
  vistas <- 0L; em <- FALSE

  pila <- list(); runs <- list()
  estilo <- function() {
    b <- em; i <- FALSE; u <- FALSE; s <- 0
    for (f in pila) { b <- b || f$b; i <- i || f$i; u <- u || f$u; s <- max(s, f$s) }
    list(b = b, i = i, u = u, s = s)
  }
  emitir <- function(t) {
    if (!nzchar(t)) return(invisible())
    e <- estilo()
    runs[[length(runs) + 1L]] <<- .form_rt_run(t, e$b, e$i, e$u, e$s)
  }
  salto <- function() runs[[length(runs) + 1L]] <<- .FORM_RT_BR
  abrir <- function(nombre, b = FALSE, i = FALSE, u = FALSE, s = 0) {
    pila[[length(pila) + 1L]] <<- list(n = nombre, b = b, i = i, u = u, s = s)
  }
  cerrar <- function(nombre) {
    idx <- which(vapply(pila, function(f) identical(f$n, nombre), logical(1)))
    if (length(idx)) pila[[max(idx)]] <<- NULL
  }

  for (tr in trozos) {
    if (identical(tr$tipo, "texto")) {
      t <- tr$v
      if (grepl(.FORM_RT_ENTIDAD_RX, t, perl = TRUE)) formato <- TRUE
      if (enfasis && grepl("**", t, fixed = TRUE)) {
        partes <- strsplit(t, "**", fixed = TRUE)[[1]]
        # strsplit no devuelve el tramo vacio final cuando el texto acaba en `**`.
        n_aqui <- lengths(regmatches(t, gregexpr("**", t, fixed = TRUE)))
        if (length(partes) < n_aqui + 1L) partes <- c(partes, rep("", n_aqui + 1L - length(partes)))
        for (p in seq_along(partes)) {
          emitir(.form_rt_entidades(partes[p]))
          if (p <= n_aqui) {
            vistas <- vistas + 1L
            if (vistas <= pares) em <- !em
          }
        }
      } else {
        emitir(.form_rt_entidades(t))
      }
      next
    }
    tag <- tr$v
    if (startsWith(tag, "<!--")) { formato <- TRUE; next }
    m <- regmatches(tag, regexec(rx, tag, perl = TRUE))[[1]]
    cierre <- identical(m[2], "/")
    nombre <- tolower(m[3]); attrs <- m[4]
    formato <- TRUE
    if (nombre %in% .FORM_RT_IGNORADAS) {
      ignorado <- TRUE
      if (nombre %in% .FORM_RT_IGNORADAS_BLOQUE) salto()
      next
    }
    if (nombre %in% c("ul", "ol")) next
    if (identical(nombre, "br")) { salto(); next }
    if (nombre %in% c("p", "div")) { salto(); next }
    if (identical(nombre, "li")) {
      if (cierre) { cerrar("li"); salto() } else { salto(); abrir("li"); emitir("\u2022 ") }
      next
    }
    if (nombre %in% names(.FORM_RT_ENCABEZADO_S)) {
      salto()
      if (cierre) cerrar(nombre) else abrir(nombre, b = TRUE, s = .FORM_RT_ENCABEZADO_S[[nombre]])
      next
    }
    if (cierre) { cerrar(nombre); next }
    if (nombre %in% c("b", "strong")) abrir(nombre, b = TRUE)
    else if (nombre %in% c("i", "em")) abrir(nombre, i = TRUE)
    else if (identical(nombre, "u")) abrir(nombre, u = TRUE)
    else if (identical(nombre, "span")) {
      st <- .form_rt_style(attrs)
      if (st$ignorado) ignorado <- TRUE
      abrir("span", b = st$b, i = st$i, u = st$u)
    }
  }
  list(runs = .form_rt_normalizar(runs), formato = formato, ignorado = ignorado)
}

# Espacios colapsados dentro de cada tramo, tramos contiguos del mismo estilo
# fundidos, y sin saltos al principio, al final ni repetidos.
.form_rt_normalizar <- function(runs) {
  out <- list()
  for (r in runs) {
    if (.form_rt_es_br(r)) {
      if (length(out) && !.form_rt_es_br(out[[length(out)]])) out[[length(out) + 1L]] <- r
      next
    }
    r$t <- gsub("[ \t\r\n\f\u00a0]+", " ", r$t, perl = TRUE)
    if (!nzchar(r$t)) next
    k <- length(out)
    if (k && !.form_rt_es_br(out[[k]]) && identical(out[[k]][c("b", "i", "u", "s")], r[c("b", "i", "u", "s")])) {
      out[[k]]$t <- paste0(out[[k]]$t, r$t)
    } else {
      out[[k + 1L]] <- r
    }
  }
  while (length(out) && .form_rt_es_br(out[[length(out)]])) out[[length(out)]] <- NULL
  # Sin espacios pegados a un salto ni al principio/final del texto.
  for (k in seq_along(out)) {
    if (.form_rt_es_br(out[[k]])) next
    if (k == 1L || .form_rt_es_br(out[[k - 1L]])) out[[k]]$t <- sub("^ +", "", out[[k]]$t)
    if (k == length(out) || .form_rt_es_br(out[[k + 1L]])) out[[k]]$t <- sub(" +$", "", out[[k]]$t)
  }
  Filter(function(r) .form_rt_es_br(r) || nzchar(r$t), out)
}

# Texto visible de unos tramos (los saltos cuentan como un espacio).
.form_rt_plano <- function(runs) {
  if (!length(runs)) return("")
  t <- vapply(runs, function(r) if (.form_rt_es_br(r)) " " else r$t, character(1))
  trimws(gsub("[ \t\u00a0]+", " ", paste(t, collapse = ""), perl = TRUE))
}

# Version plana de una celda: lo que queda al interpretar el formato.
.form_rt_a_plano <- function(x, enfasis = TRUE, markdown = TRUE) {
  .form_rt_plano(.form_rt_parse(x, enfasis = enfasis, markdown = markdown)$runs)
}

.form_rt_tiene_formato <- function(runs, base_b = FALSE, base_i = FALSE) {
  if (!length(runs)) return(FALSE)
  for (r in runs) {
    if (.form_rt_es_br(r)) return(TRUE)
    if (isTRUE(r$u) || (r$s %||% 0) != 0) return(TRUE)
    if (isTRUE(r$i) && !base_i) return(TRUE)
    if (isTRUE(r$b) && !base_b) return(TRUE)
  }
  FALSE
}

# --- alineacion con el plano del modelo ---------------------------------------

# Caracteres que la limpieza de siempre normaliza 1:1 (`.form_pdf_clean_text_safe`).
.form_rt_norm_char <- function(ch) {
  ch[ch == "\u00a0"] <- " "
  ch[ch %in% c("\u2013", "\u2014", "\u2212")] <- "-"
  ch[ch %in% c("\u2018", "\u2019")] <- "'"
  ch[ch %in% c("\u201c", "\u201d")] <- "\""
  ch
}

# Tramos cuyo texto visible es EXACTAMENTE `P` (el campo plano del modelo, ya
# limpio, con el numero retirado y los `${...}` en blanco). Se reproducen sobre
# los tramos las mismas transformaciones del modelo que no borran (normalizar
# caracteres, `${...}` -> blanco, colapsar espacios) y luego se casa `P` como
# sufijo o como subsecuencia: lo que el modelo quito (un prefijo de numeracion,
# un backtick, un asterisco suelto) cae, y cada caracter de `P` hereda el estilo
# del caracter del que viene. Si `P` no casa, NULL: sin formato antes que con
# otras palabras.
.form_rt_alinear <- function(runs, P, blank = "__________") {
  P <- .form_pdf_chr(P)
  if (!length(runs) || !nzchar(P)) return(NULL)
  ch <- character(0); st <- integer(0)
  estilos <- list()
  for (r in runs) {
    estilos[[length(estilos) + 1L]] <- r
    if (.form_rt_es_br(r)) {
      ch <- c(ch, "\n"); st <- c(st, length(estilos))
    } else {
      cs <- strsplit(r$t, "")[[1]]
      ch <- c(ch, cs); st <- c(st, rep(length(estilos), length(cs)))
    }
  }
  ch <- .form_rt_norm_char(ch)
  # `${...}` -> blanco, con el estilo del primer caracter.
  J <- paste(ch, collapse = "")
  m <- gregexpr("\\$\\{[^}]+\\}", J, perl = TRUE)[[1]]
  if (m[1] > 0) {
    largos <- attr(m, "match.length")
    for (k in rev(seq_along(m))) {
      ini <- m[k]; fin <- m[k] + largos[k] - 1L
      nb <- strsplit(blank, "")[[1]]
      ch <- c(ch[seq_len(ini - 1L)], nb, ch[-seq_len(fin)])
      st <- c(st[seq_len(ini - 1L)], rep(st[ini], length(nb)), st[-seq_len(fin)])
    }
  }
  # Colapsar blancos: un grupo con salto queda en salto; si no, en un espacio.
  blanco <- ch %in% c(" ", "\t", "\r", "\f", "\n")
  ch2 <- character(0); st2 <- integer(0); k <- 1L
  while (k <= length(ch)) {
    if (blanco[k]) {
      j <- k
      while (j + 1L <= length(ch) && blanco[j + 1L]) j <- j + 1L
      grupo <- ch[k:j]
      ch2 <- c(ch2, if ("\n" %in% grupo) "\n" else " ")
      st2 <- c(st2, st[k]); k <- j + 1L
    } else {
      ch2 <- c(ch2, ch[k]); st2 <- c(st2, st[k]); k <- k + 1L
    }
  }
  while (length(ch2) && ch2[1] %in% c(" ", "\n")) { ch2 <- ch2[-1]; st2 <- st2[-1] }
  while (length(ch2) && ch2[length(ch2)] %in% c(" ", "\n")) { ch2 <- ch2[-length(ch2)]; st2 <- st2[-length(st2)] }
  vis <- ifelse(ch2 == "\n", " ", ch2)
  pc <- strsplit(P, "")[[1]]
  idx <- NULL
  if (length(pc) <= length(vis)) {
    cola <- seq.int(length(vis) - length(pc) + 1L, length(vis))
    if (identical(vis[cola], pc)) idx <- cola
  }
  if (is.null(idx)) {
    idx <- integer(length(pc)); j <- 1L
    for (k in seq_along(pc)) {
      while (j <= length(vis) && !identical(vis[j], pc[k])) j <- j + 1L
      if (j > length(vis)) return(NULL)
      idx[k] <- j; j <- j + 1L
    }
  }
  out <- list()
  for (k in seq_along(idx)) {
    e <- estilos[[st2[idx[k]]]]
    if (identical(ch2[idx[k]], "\n")) {
      out[[length(out) + 1L]] <- .FORM_RT_BR
      next
    }
    if (.form_rt_es_br(e)) e <- .form_rt_run("")
    n <- length(out)
    if (n && !.form_rt_es_br(out[[n]]) &&
        identical(out[[n]][c("b", "i", "u", "s")], list(b = e$b, i = e$i, u = e$u, s = e$s))) {
      out[[n]]$t <- paste0(out[[n]]$t, pc[k])
    } else {
      out[[n + 1L]] <- .form_rt_run(pc[k], e$b, e$i, e$u, e$s)
    }
  }
  out
}

# Tramos para el campo `P` de una celda cruda `crudo`, o NULL si la celda no
# trae formato (el campo plano basta) o no se puede alinear.
.form_rt_de <- function(crudo, P, enfasis = TRUE, markdown = TRUE) {
  crudo <- .form_pdf_chr(crudo)
  if (!nzchar(crudo) || !nzchar(.form_pdf_chr(P))) return(NULL)
  pr <- .form_rt_parse(crudo, enfasis = enfasis, markdown = markdown)
  if (!.form_rt_tiene_formato(pr$runs)) return(NULL)
  .form_rt_alinear(pr$runs, P)
}

# Tramos que un renderer debe pintar para `block[[campo]]`: los del modelo si
# siguen casando con el campo plano, o un solo tramo plano.
.form_rt_campo <- function(block, campo, texto = NULL) {
  P <- .form_pdf_chr(texto %||% block[[campo]])
  if (!nzchar(P)) return(list())
  rt <- block[[paste0(campo, "_rt")]]
  # Re-alineados al texto EXACTO que se va a pintar (mismos espacios): con
  # formato, caracter a caracter; sin el, un solo tramo con ese texto.
  if (length(rt) && .form_rt_tiene_formato(rt)) {
    al <- .form_rt_alinear(rt, P)
    if (!is.null(al)) return(al)
  }
  list(.form_rt_run(P))
}

.form_rt_mayusculas <- function(runs) {
  lapply(runs, function(r) { if (!.form_rt_es_br(r)) r$t <- toupper(r$t); r })
}

# --- entrada del modelo -------------------------------------------------------

# Convierte las celdas que se imprimen. Cada una queda PLANA en su columna (asi
# toda la logica del modelo —numeracion, saltos, cabeceras— ve el texto sin
# etiquetas) y su valor crudo se guarda en `.rt_<columna>` para sacar los tramos
# al armar cada bloque. Cuenta celdas: N con formato, M con algo ignorado.
.form_rt_instrumento <- function(survey, choices, paper, settings) {
  con_formato <- character(0); con_ignorado <- character(0)
  convertir <- function(df, cols, id_col, enfasis = TRUE, markdown = TRUE) {
    if (is.null(df) || !nrow(df)) return(df)
    for (cl in intersect(cols, names(df))) {
      crudo <- as.character(df[[cl]]); crudo[is.na(crudo)] <- ""
      df[[paste0(".rt_", cl)]] <- crudo
      plano <- crudo
      for (k in which(nzchar(crudo))) {
        pr <- .form_rt_parse(crudo[k], enfasis = enfasis, markdown = markdown)
        # El `**` del autor no es HTML: no cuenta en el aviso, pero tambien sale
        # de la cadena plana (vive en los tramos).
        if (!pr$formato && !.form_rt_tiene_formato(pr$runs)) next
        plano[k] <- .form_rt_plano(pr$runs)
        if (!pr$formato) next
        id <- if (!is.null(id_col) && id_col %in% names(df)) .form_pdf_chr(df[[id_col]][k]) else ""
        if (!nzchar(id)) id <- cl
        con_formato <<- c(con_formato, id)
        if (pr$ignorado) con_ignorado <<- c(con_ignorado, id)
      }
      df[[cl]] <- plano
    }
    df
  }
  survey <- convertir(survey, c("label", "hint", "paper_label", "paper_subgroup"), "name")
  # Categorias: solo HTML y entidades. `**` y `#` en una categoria son texto del
  # autor (item 11: las categorias no se reescriben).
  choices <- convertir(choices, "label", "name", enfasis = FALSE, markdown = FALSE)
  paper <- convertir(paper, c("title", "body"), "id")
  settings <- convertir(settings, "form_title", NULL)
  aviso <- character(0)
  if (length(con_formato)) {
    ej <- if (length(con_ignorado)) con_ignorado[[1]] else con_formato[[1]]
    aviso <- if (length(con_ignorado)) sprintf(
      "Se aplic\u00f3 el formato HTML de %d textos del instrumento; se ignor\u00f3 lo que no se puede imprimir (color, enlaces\u2026) en %d (p. ej. %s).",
      length(con_formato), length(con_ignorado), ej) else sprintf(
      "Se aplic\u00f3 el formato HTML de %d textos del instrumento (p. ej. %s).",
      length(con_formato), ej)
  }
  list(survey = survey, choices = choices, paper = paper, settings = settings, aviso = aviso)
}

# Llena `<campo>_rt` en los bloques ya armados. Cada bloque sabe de que fila
# viene (`name` en el survey, `fila` en paper/subseccion, `matrix_key` para el
# tenor) y aqui se toma el crudo de esa fila. El campo plano NO se toca.
.form_rt_bloques <- function(blocks, survey, paper, titulo_crudo, group_tenors = list()) {
  col <- function(df, cl, k) {
    v <- df[[paste0(".rt_", cl)]]
    if (is.null(v) || is.na(k) || k < 1L || k > length(v)) "" else .form_pdf_chr(v[k])
  }
  # Mismo criterio que `.form_pdf_first_nonempty`: `paper_label` si trae texto.
  enunciado <- function(k) {
    if (is.na(k)) return("")
    if (nzchar(.form_pdf_clean_text(.form_pdf_chr(survey$paper_label[k])))) col(survey, "paper_label", k)
    else col(survey, "label", k)
  }
  fila_de <- function(nm) if (nzchar(nm %||% "")) match(nm, as.character(survey$name)) else NA_integer_
  for (bi in seq_along(blocks)) {
    b <- blocks[[bi]]
    kind <- b$kind %||% ""
    if (identical(kind, "cover")) {
      b$title_rt <- .form_rt_de(titulo_crudo, b$title)
    } else if (identical(kind, "paper") && !is.null(b$fila)) {
      b$title_rt <- .form_rt_de(col(paper, "title", b$fila), b$title)
      b$body_rt <- .form_rt_de(col(paper, "body", b$fila), b$body)
    } else if (identical(kind, "subsection") && !is.null(b$fila)) {
      b$title_rt <- .form_rt_de(col(survey, "paper_subgroup", b$fila), b$title)
    } else if (identical(kind, "section")) {
      k <- fila_de(b$name)
      b$title_rt <- .form_rt_de(enunciado(k), b$title)
      b$hint_rt <- .form_rt_de(col(survey, "hint", k), b$hint)
    } else if (identical(kind, "question")) {
      k <- fila_de(b$name)
      b$label_rt <- .form_rt_de(enunciado(k), b$label)
      b$hint_rt <- .form_rt_de(col(survey, "hint", k), b$hint)
    } else if (identical(kind, "matrix")) {
      k <- fila_de(b$name)
      b$hint_rt <- .form_rt_de(col(survey, "hint", k), b$hint)
      b$tenor_rt <- .form_rt_de(.form_pdf_chr(group_tenors[[b$matrix_key %||% ""]] %||% ""), b$tenor)
      b$items <- lapply(b$items %||% list(), function(it) {
        it$label_rt <- .form_rt_de(enunciado(fila_de(it$name)), it$label)
        it
      })
    }
    blocks[[bi]] <- b
  }
  blocks
}
