# =============================================================================
# graficos_avisos_texto.R — cómo se nombra una lámina, su tipo, su espacio o una variable en un aviso de Gráficos
# =============================================================================
#
# El panel de Avisos de Láminas mostraba «"Objetivo con icono" (slide 1pkxbl)», «Lamina degradada a canvas 'Sin
# datos'», «El ícono '318ecf24-…'», «La lámina 'p_slide_objetivo_icono'» o «escala_valor = "proporcion_100"»: ids,
# nombres de funciones, de argumentos y valores crudos que el analista no ve en ningún otro lado. Un aviso nombra la
# lámina por su número y su título, el tipo y el espacio por cómo los llama el selector (`.SLIDES_META`,
# graficos_metadata.R) y dice la acción en lenguaje llano. Lo estructurado (id, código) para «Ir a la lámina» viaja
# aparte en los datos, no en el texto.
#
# Aquí vive el único rótulo de lámina de los avisos: `.lam_avisos_cierre` (lamina_avisos_lineas.R), el validador del
# plan (`.validar_plan_json`), la degradación por lámina (reporte_plan_condiciones.R) y los avisos del ícono lo usan.

#' Rótulo de una lámina para un aviso: «Lámina 3 · “Perfil del docente”»
#'
#' @param numero Posición de la lámina en el informe (como la numera la UI), o `NULL`.
#' @param titulo Título de la lámina, o `NULL`/vacío.
#' @param base Base del PPTX en /ppt-all (cada base sale con su numeración), o `NULL`.
#' @keywords internal
.aviso_lamina <- function(numero = NULL, titulo = NULL, base = NULL) {
  n <- suppressWarnings(as.integer(numero %||% NA_integer_)[1])
  t <- trimws(as.character(titulo %||% "")[1])
  if (is.na(t)) t <- ""
  t <- sub("\\s*\\((cont|CONT)\\.\\)\\s*$", "", t)
  b <- as.character(base %||% "")[1]
  de_base <- if (!is.na(b) && nzchar(b)) sprintf(" de «%s»", b) else ""
  if (!is.na(n) && nzchar(t)) return(sprintf("Lámina %d%s · “%s”", n, de_base, t))
  if (!is.na(n)) return(sprintf("Lámina %d%s", n, de_base))
  if (nzchar(t)) return(sprintf("La lámina “%s”%s", t, de_base))
  "Una lámina sin título"
}

#' Título declarado en el payload de una lámina del plan JSON
#' @keywords internal
.aviso_titulo_payload <- function(slide) {
  p <- (slide %||% list())$payload
  t <- if (is.list(p)) p$titulo else NULL
  if (is.list(t)) t <- t$text %||% t[[1]]
  t <- as.character(t %||% "")
  if (!length(t) || is.na(t[1])) "" else t[1]
}

#' Nombre visible de un tipo de lámina, como lo muestra el selector
#' @keywords internal
.aviso_tipo_lamina <- function(tipo) {
  t <- as.character(tipo %||% "")[1]
  nombre <- if (!is.na(t) && nzchar(t)) (.SLIDES_META[[t]] %||% list())$titulo_humano else NULL
  if (is.character(nombre) && length(nombre) && nzchar(nombre[1])) nombre[1] else "un tipo de lámina que esta versión no reconoce"
}

#' Nombre visible de un tipo de gráfico, como lo muestra el selector
#' @keywords internal
.aviso_tipo_grafico <- function(graficador) {
  g <- as.character(graficador %||% "")[1]
  if (is.na(g) || !nzchar(g)) return("un gráfico")
  g <- unname(.GRAFICADOR_LEGACY_ALIASES[g]) %||% g
  if (is.na(g)) g <- as.character(graficador)[1]
  nombre <- (.GRAFICADORES_META[[g]] %||% list())$titulo_humano
  if (is.character(nombre) && length(nombre) && nzchar(nombre[1])) nombre[1] else "un tipo de gráfico que esta versión no reconoce"
}

#' Nombre visible de un espacio (slot) de gráfico dentro de una lámina: «Inferior derecha», no `inferior_derecha`
#' @keywords internal
.aviso_espacio <- function(tipo, slot) {
  s <- as.character(slot %||% "")[1]
  if (is.na(s) || !nzchar(s)) return("un espacio")
  t <- as.character(tipo %||% "")[1]
  spec <- if (!is.na(t) && nzchar(t)) ((.SLIDES_META[[t]] %||% list())$slot_specs %||% list())[[s]] else NULL
  etiqueta <- as.character((spec %||% list())$label %||% "")[1]
  if (!is.na(etiqueta) && nzchar(etiqueta)) return(etiqueta)
  if (identical(s, "grafico")) return("Gráfico")
  h <- gsub("_+", " ", s)
  paste0(toupper(substr(h, 1L, 1L)), substr(h, 2L, nchar(h)))
}

#' Una referencia `base$variable` como se lee: «p12» de la base «egresados»
#' @keywords internal
.aviso_variable <- function(ref) {
  r <- as.character(ref %||% "")[1]
  if (is.na(r) || !nzchar(r)) return("una variable")
  if (!grepl("$", r, fixed = TRUE)) return(sprintf("«%s»", r))
  sprintf("«%s» de la base «%s»", sub("^[^$]*\\$", "", r), sub("\\$.*$", "", r))
}

#' « «Perfil»» (con espacio delante) con el nombre de catálogo de un ícono, o "" si no se conoce
#'
#' `.graficos_icon_registry()` guarda los nombres en `attr(, "nombres")`, también los de íconos cuyo PNG se perdió. Sin
#' nombre, el aviso no nombra el ícono: su referencia es un id o una ruta temporal.
#' @keywords internal
.aviso_nombre_icono <- function(ref, icon_registry = list()) {
  nombres <- attr(icon_registry, "nombres")
  r <- as.character(ref %||% "")[1]
  n <- if (!is.null(nombres) && !is.na(r) && r %in% names(nombres)) as.character(nombres[[r]]) else ""
  if (is.na(n) || !nzchar(n)) "" else sprintf(" «%s»", n)
}

#' ¿El texto de un aviso trae jerga interna? (ids, uuids, tipos o funciones, «canvas», «slide», nombres de argumento)
#'
#' Es el contrato de test-avisos-sin-jerga.R y el filtro de los motivos que llegan de otro sitio: un `conditionMessage()`
#' o el detalle de quien llama a la degradación se muestran sólo si se leen. El identificador con guion bajo se busca
#' FUERA de las comillas «…» y “…”: dentro va lo que el analista escribió (la variable `p3_recod`, un título).
#' @return Vector lógico, uno por texto.
#' @keywords internal
.aviso_tiene_jerga <- function(textos) {
  textos <- as.character(textos)
  if (!length(textos)) return(logical(0))
  patrones <- c(
    "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",                                     # uuid
    "\\bp_(slide|barras|radar|tabla|dim|serie|mapa|cifra|dumbbell|lollipop|nube|histograma|boxplot|plan)", # tipo interno
    "(?i)canvas", "(?i)\\bslides?\\b", "slide\\[", "\\bADR [0-9]+", "methodology_", "ppt_element"
  )
  hit <- Reduce(`|`, lapply(patrones, function(p) grepl(p, textos, perl = TRUE)))
  fuera <- gsub("«[^»]*»|“[^”]*”", "«»", textos)
  hit <- hit | grepl("`[A-Za-z_.][A-Za-z0-9_.]*`|\\b[a-z][a-z0-9]*(_[a-z0-9]+)+\\b", fuera, perl = TRUE)
  hit | .aviso_tiene_voseo(fuera)
}

# Verbos de las acciones que piden los avisos y la UI. El voseo se reconoce por la forma, no por una tilde suelta:
# «aquí», «así», «leí», «está» o «será» no son imperativos de esta lista.
.AVISO_VOSEO_AR_ER <- c("revis", "carg", "us", "prob", "volv", "hac", "toc", "pon", "seleccion", "agreg", "quit", "borr",
                        "guard", "export", "import", "declar", "aplic", "cambi", "mir", "sac", "complet", "ingres",
                        "reintent", "ten", "and", "esper", "ajust", "activ", "desactiv", "asign", "marc", "confirm",
                        "verific", "comprob", "cre", "edit", "renombr", "mov", "dej", "busc", "filtr", "orden", "reorden",
                        "ocult", "mostr", "eleg", "sub", "abr", "escrib", "correg", "repet", "defin", "ped", "dec",
                        "ven", "recarg", "actualiz", "descarg", "pas", "dibuj", "tramific", "recodific", "fij", "asegur",
                        "acord", "aceler", "acort", "ensanch", "baj", "volc")
.AVISO_VOSEO_ER <- c("volv", "hac", "pon", "ten", "mov")
# Los de -ir en «-í» coinciden con el pretérito («yo elegí»): sólo cuentan como imperativo al empezar una frase.
.AVISO_VOSEO_IR <- c("sub", "eleg", "abr", "escrib", "correg", "repet", "defin", "ped", "dec", "ven", "imprim", "permit",
                     "divid", "reun", "añad", "inclu", "exclu", "distribu", "constru", "prove", "segu", "consegu", "invert")

#' ¿Hay voseo («Subí», «Elegí», «Revisá», «Subilo», «Fijate») en el texto?
#'
#' Tres formas, sin falsos positivos en español neutro: el imperativo de -ar/-er con tilde final («Revisá», «Volvé»)
#' en cualquier lugar; el de -ir con «-í» final («Subí», «Elegí») sólo al inicio de frase (o tras «:», «;», «—»), que es
#' donde no puede ser el pretérito «yo subí»; y el enclítico sin tilde («Subilo», «Elegila», «Fijate»), que en neutro
#' lleva la tilde en la raíz («Súbelo», «Fíjate»).
#' @keywords internal
.aviso_tiene_voseo <- function(textos) {
  textos <- as.character(textos)
  if (!length(textos)) return(logical(0))
  # -er en «-é» y -ar en «-á», cada uno con la suya: «creé», «usé» o «andé» son pretéritos, no imperativos.
  er <- intersect(.AVISO_VOSEO_AR_ER, .AVISO_VOSEO_ER)
  ar <- setdiff(.AVISO_VOSEO_AR_ER, c(.AVISO_VOSEO_IR, .AVISO_VOSEO_ER))
  izq <- "(?<![\\p{L}])"; der <- "(?![\\p{L}])"
  p_ar_er <- sprintf("(?i)%s((%s)á|(%s)é)%s", izq, paste(ar, collapse = "|"), paste(er, collapse = "|"), der)
  p_ir <- sprintf("(?i)(^|[.:;!?¡¿—–]\\s*|\\n\\s*)(%s)í%s", paste(.AVISO_VOSEO_IR, collapse = "|"), der)
  p_enclitico <- sprintf("(?i)%s(%s)[aei](lo|la|los|las|le|les|me|te|nos)%s",
                         izq, paste(unique(c(.AVISO_VOSEO_AR_ER, .AVISO_VOSEO_IR)), collapse = "|"), der)
  grepl(p_ar_er, textos, perl = TRUE) | grepl(p_ir, textos, perl = TRUE) | grepl(p_enclitico, textos, perl = TRUE)
}

#' Deja el detalle técnico de un aviso en el stderr del proceso, que en un job es su `.err`
#'
#' El aviso que lee el analista calla el `conditionMessage()`, el id del ícono o la función que falló; el diagnóstico
#' no puede perderse por eso. Va por `message()` —que acaba en el stderr del subproceso callr y en el `.err` del job,
#' como los avisos sellados— pero con su propio prefijo y SIN el sello `[PULSO-AVISO]`, así `.pulso_avisos_de_job()` no
#' lo recoge y nunca llega al texto del analista. El `warning()` no sirve: el renderer se los traga (jobs.R).
#' @keywords internal
.AVISO_DETALLE_SELLO <- "[detalle-aviso]"
.aviso_detalle <- function(...) {
  rotulo <- .aviso_lamina_en_curso()
  detalle <- gsub("[\r\n]+", " ", paste0(...))
  message(.AVISO_DETALLE_SELLO, " ", if (is.null(rotulo)) "" else paste0(rotulo, " | "), detalle)
  invisible(TRUE)
}

#' « Motivo: …» con un motivo que se lee, o "" si trae jerga (entonces sólo va al log)
#' @keywords internal
.aviso_motivo <- function(motivo, formato = " Motivo: %s.") {
  m <- trimws(as.character(motivo %||% "")[1])
  if (is.na(m) || !nzchar(m) || isTRUE(.aviso_tiene_jerga(m))) return("")
  sprintf(formato, sub("[.]$", "", m))
}

#' Evalúa `expr` con la lámina `numero`/`titulo` como contexto de los avisos que se emitan dentro
#'
#' El armado de las láminas (`.graficos_job_rebuild_slides`) recorre el plan del usuario: lo que avise una lámina
#' (el ícono que falta) se rotula con su número. Fuera de ese recorrido no hay contexto y el aviso va sin prefijo.
#' @keywords internal
.aviso_con_lamina <- function(numero, titulo, expr) {
  viejo <- options(prosecnur.aviso_lamina = list(numero = numero, titulo = titulo))
  on.exit(options(viejo), add = TRUE)
  expr
}

#' Rótulo de la lámina en curso (armado o render), o `NULL` si no hay ninguna
#'
#' Primero la que marca el render del mazo (`.lam_avisos_paso`), luego la del armado (`.aviso_con_lamina`).
#' @keywords internal
.aviso_lamina_en_curso <- function() {
  ctx <- .lam_avisos_estado$rotulo %||% getOption("prosecnur.aviso_lamina")
  if (!is.list(ctx)) return(NULL)
  .aviso_lamina(ctx$numero, ctx$titulo, ctx$base)
}

#' Antepone el rótulo de la lámina en curso a un aviso, si hay una
#'
#' @param texto Lo que pasó, en minúscula: va detrás de «Lámina 3 · “Título”: ».
#' @param sin_contexto Frase completa para cuando no hay lámina en curso; si falta, `texto` con mayúscula inicial.
#' @keywords internal
.aviso_en_lamina <- function(texto, sin_contexto = NULL) {
  rotulo <- .aviso_lamina_en_curso()
  if (!is.null(rotulo)) return(paste0(rotulo, ": ", texto))
  if (!is.null(sin_contexto)) return(sin_contexto)
  paste0(toupper(substr(texto, 1L, 1L)), substr(texto, 2L, nchar(texto)))
}
