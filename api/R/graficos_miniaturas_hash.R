# graficos_miniaturas_hash.R — huella de una lámina para la caché de vista previa y miniaturas (F6 §5.3, riesgo 7).
#
# Contrato: docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md. La caché NO es transparente por suposición: la llave es la
# huella de TODO lo que el render lee, en seis grupos:
#   (a) la lámina ya normalizada tal como entra al motor (payload, args de sus gráficos, orden_categorias, filtros, textos,
#       antetítulo heredado y folio), SIN reordenar claves (el orden de `vars`/bloques/ejes es parte del render);
#   (b) el scope (active_base / consolidated), la base activa y el conjunto ordenado de bases que recibe el motor;
#   (c) la huella de los DATOS que el motor recibe: digest de cada `data_sources[[base]]` (pesos, filtros, recodificaciones,
#       etiquetas, codificación aplicada y atributos como `instrumento_reporte`) y de cada `inst_sources[[base]]`;
#   (d) presets ya enriquecidos (formato, sufijo_auto, nota_redondeo, cálculos por familia…), paletas, íconos (ruta y sha256
#       de cada archivo), perfil/plantilla/auto_otros_slides, las opciones `prosecnur.*` que lee el motor y, si lo hay, el
#       estilo del cliente resuelto (`ctx$estilo_cliente`: letra K13 y sha256 de cada logo, graficos_estilo_cliente.R);
#   (e) sha256 del .pptx de plantilla, de `inst/estandar/estandar_pulso.json` y de los logos del estándar;
#   (f) versión del paquete (DESCRIPTION) y `.MINIATURAS_VERSION_CACHE`.
# Lo que NO entra en la llave del PPTX (renderer, calidad, número de partes) es la llave de sus productos derivados
# (raster), que viven en el mismo directorio de la entrada (graficos_miniaturas.R).

#' Versión manual de la caché de miniaturas: subirla invalida todas las entradas
#' @keywords internal
.MINIATURAS_VERSION_CACHE <- "2"

#' Forma canónica de un objeto para la huella: textos en UTF-8 y NADA más
#'
#' No se ordenan claves: el orden de una lista con nombres SÍ cambia el render en la lámina (`vars` con nombres son los
#' bloques de las multiapiladas `var_cruce` y del radar, en el orden en que el editor los arma; los ejes del radar de
#' equivalencias van en orden de filas). Una colisión de huella sirve una lámina equivocada; un falso miss sólo cuesta un
#' render. El único reordenamiento permitido es el de `.mini_ordenar_conmutativo()`, por lista blanca y nunca en la lámina.
#' @keywords internal
.mini_canon <- function(x) {
  if (is.data.frame(x) || is.environment(x) || is.function(x)) return(x)
  if (is.list(x)) {
    if (length(x)) x[] <- lapply(x, .mini_canon)
    return(x)
  }
  if (is.character(x)) {
    a <- attributes(x)
    x <- enc2utf8(x)
    attributes(x) <- a
  }
  x
}

#' Ordena por nombre SÓLO el primer nivel de una lista de la lista blanca de niveles probadamente conmutativos
#'
#' Lista blanca (graficos_miniaturas_hash.R, grupo d): las familias de `presets` (`.build_presets` las consume por nombre
#' con `do.call(p_presets, ...)` y `out[[key]]`) y el registro de íconos (se busca por id). Dentro de cada familia no se
#' ordena nada. Las paletas NO están en la lista: `.graficos_palette_vector` conserva el orden de sus categorías.
#' @keywords internal
.mini_ordenar_conmutativo <- function(x) {
  if (!is.list(x) || !length(x)) return(x)
  nms <- names(x)
  if (is.null(nms) || any(is.na(nms) | !nzchar(nms))) return(x)
  x[order(nms, method = "radix")]
}

#' sha256 de la forma canónica de `x`
#' @keywords internal
.mini_digest <- function(x, algo = "sha256") {
  digest::digest(.mini_canon(x), algo = algo)
}

.mini_memo <- new.env(parent = emptyenv())

#' sha256 de un archivo, memoizado por ruta + tamaño + mtime (una plantilla de 2 MB no se relee en cada lámina)
#' @return Hex, o `""` si el archivo no existe.
#' @keywords internal
.mini_sha256_archivo <- function(path) {
  path <- as.character(path %||% "")[1]
  if (is.na(path) || !nzchar(path) || !file.exists(path)) return("")
  info <- file.info(path)
  llave <- paste(normalizePath(path, winslash = "/", mustWork = FALSE), info$size, as.numeric(info$mtime), sep = "|")
  memo <- .mini_memo$archivos %||% list()
  if (!is.null(memo[[llave]])) return(memo[[llave]])
  h <- digest::digest(file = path, algo = "sha256")
  memo[[llave]] <- h
  if (length(memo) > 256L) memo <- utils::tail(memo, 256L)
  .mini_memo$archivos <- memo
  h
}

#' Huella de las fuentes que recibe el motor: un digest por base, en el orden de las bases
#'
#' Se calcula sobre los objetos que el motor recibe (no sobre metadatos de la sesión): una base cuya ponderación o cuyas
#' etiquetas cambian produce otra huella aunque nadie haya avisado. Costo medido en el contrato (acrconta: 3 bases).
#' @return `list(datos = c(base = hex), instrumento = c(base = hex))`.
#' @keywords internal
.mini_huella_fuentes <- function(data_sources, inst_sources) {
  una <- function(x) {
    if (is.null(x)) return("")
    digest::digest(x, algo = "xxhash64")
  }
  datos <- if (is.data.frame(data_sources)) list(.base = data_sources) else (data_sources %||% list())
  inst <- if (is.list(inst_sources) && !is.null(inst_sources$survey)) list(.base = inst_sources) else (inst_sources %||% list())
  list(
    datos = vapply(datos, una, character(1)),
    instrumento = vapply(inst, una, character(1))
  )
}

#' Opciones `prosecnur.*` vigentes que el motor puede leer (sin el desplazo de folio, que fija la propia vista previa)
#' @keywords internal
.mini_opciones_motor <- function() {
  op <- options()
  op <- op[grepl("^prosecnur\\.", names(op))]
  op <- op[setdiff(names(op), "prosecnur.lam_folio_desplazo")]
  op[order(names(op), method = "radix")]
}

#' Archivos del estándar visual que lee el motor: el JSON y sus logos
#' @keywords internal
.mini_huella_estandar <- function() {
  ruta <- tryCatch(.std_ruta(), error = function(e) "")
  logos <- if (nzchar(ruta)) sort(list.files(file.path(dirname(ruta), "logos"), full.names = TRUE)) else character()
  list(
    estandar = .mini_sha256_archivo(ruta),
    logos = stats::setNames(vapply(logos, .mini_sha256_archivo, character(1)), basename(logos))
  )
}

#' Versión del paquete cargado
#' @keywords internal
.mini_version_paquete <- function() {
  v <- tryCatch(as.character(utils::packageVersion("prosecnurapp")), error = function(e) NA_character_)
  if (is.na(v)) {
    v <- tryCatch(read.dcf(file.path(.app_api_dir(), "DESCRIPTION"), fields = "Version")[1, 1], error = function(e) "")
  }
  as.character(v)
}

#' Los seis grupos de la huella de una lámina
#'
#' @param ctx Contexto de la lámina (`.mini_contexto()`).
#' @return Lista nombrada `a`..`f` con los objetos que entran en la llave.
#' @keywords internal
.mini_grupos_huella <- function(ctx) {
  huella <- ctx$huella_fuentes %||% .mini_huella_fuentes(ctx$data_sources, ctx$inst_sources)
  iconos <- ctx$icon_registry %||% list()
  d <- list(
    presets = .mini_ordenar_conmutativo(ctx$presets_json %||% list()),
    paletas = ctx$paletas %||% list(),
    iconos = .mini_ordenar_conmutativo(lapply(iconos, function(p) list(ruta = as.character(p), sha256 = .mini_sha256_archivo(p)))),
    profile_id = ctx$profile_id %||% "",
    template_id = ctx$template_id %||% "",
    auto_otros_slides = isTRUE(ctx$auto_otros_slides),
    opciones = ctx$opciones_motor %||% list()
  )
  # Estilo del cliente resuelto (A6 R3): letra K13 y sha256 de cada logo. Sólo si hay: sin estilo, la huella no cambia.
  estilo <- .graficos_estilo_cliente_huella(ctx$estilo_cliente)
  if (length(estilo)) d$estilo_cliente <- estilo
  list(
    a = list(slide = ctx$slide, folio = as.integer(ctx$folio %||% 1L)),
    b = list(scope = ctx$scope, base = ctx$base %||% "", bases = as.character(ctx$bases %||% character())),
    c = huella,
    d = d,
    e = c(list(plantilla = .mini_sha256_archivo(ctx$template_pptx)), ctx$huella_estandar %||% .mini_huella_estandar()),
    f = list(paquete = ctx$version_paquete %||% .mini_version_paquete(), cache = .MINIATURAS_VERSION_CACHE)
  )
}

#' Huella (sha256) de una lámina: llave de su entrada en la caché
#'
#' @param ctx Contexto de la lámina (`.mini_contexto()`).
#' @return Hex de 64 caracteres; con atributo `grupos` (digest de cada grupo, para diagnóstico).
#' @keywords internal
.mini_hash_lamina <- function(ctx) {
  grupos <- vapply(.mini_grupos_huella(ctx), .mini_digest, character(1))
  h <- .mini_digest(as.list(grupos))
  attr(h, "grupos") <- grupos
  h
}
