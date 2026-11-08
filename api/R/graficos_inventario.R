# =============================================================================
# graficos_inventario.R — qué tiene el estudio para cada tipo de gráfico (selector por intención, ADR 0135)
# =============================================================================
#
# El selector cruza el `usa` de cada tipo (graficos_tipos_usa.R) con lo que tiene el estudio. Por base:
#   - el público (el nombre de la base) y su n: las filas de la fuente con que Gráficos dibuja en ese scope.
#       · Scope vacío (las bases del procesamiento, `.graficos_processing_sources`): ya con el universo de Analítica
#         (`.graficos_aplicar_caso_valido`, «qué casos cuentan» de Validación).
#       · Scope `consolidated` (`.graficos_consolidado_sources`): el export consolidado NO aplica ese universo, así que
#         el n tampoco; contar aquí el universo de Analítica prometería en el selector un n que la lámina consolidada
#         no dibuja. Si el consolidado debe filtrar por caso válido es una decisión de ese export, no del inventario
#         (revisión metodológica de la regla, H7).
#       · Es un conteo de filas SIN PONDERAR, y en una base hija de un repeat cuenta filas del repeat, no personas;
#   - cuántas preguntas tiene de cada tipo. Los tipos no se solapan:
#       escala        las de `.regla_preguntas_de_base` (el criterio del ADR 0135 §5: `select_one` de diseño
#                     independiente, cuatro o más opciones sustantivas y lista de batería o declarada ordinal);
#       opcion_unica  las demás `select_one`;
#       multiple      `select_multiple` (la columna o sus dummies `var/código`, `var_código`);
#       numerica      `integer`, `decimal`, `range`;
#       abierta       `text`, salvo identificadores y datos de contacto (código, DNI, correo, teléfono, nombre…);
#                     un comentario y un «Otro (especifique)» sí cuentan;
#     Una pregunta cuenta si su columna está en la base. Quedan fuera los metadatos operativos (consentimiento,
#     prueba/real, disponibilidad: `.graficos_is_operational_metadata`), la `_recod` de una pregunta que está en la base,
#     que es la misma pregunta (`.regla_es_recod_repetida`, el mismo criterio de la regla), y las
#     variables virtuales que Gráficos agrega a la fuente (`__district`, `__age_group`…).
#   - el padrón declarado: la propuesta de `.graficos_padron_por_base` (Cálculo de muestra o Monitoreo). La
#     confirmación es otro paso: la tarjeta de cobertura la escribe en el payload.

.INVENTARIO_TIPOS_NUMERICOS <- c("integer", "decimal", "range")

#' Tipo base (`select_one`, `text`…) de cada fila del instrumento
#' @keywords internal
.graficos_inventario_tipo <- function(sv) {
  tipo <- tolower(trimws(as.character(sv$type %||% rep("", nrow(sv)))))
  tipo[is.na(tipo)] <- ""
  sub("\\s+.*$", "", tipo)
}

#' ¿La `select_multiple` está en la base? Su columna o una dummy `var/código` o `var_código` de su lista
#' @keywords internal
.graficos_inventario_multiple_en_datos <- function(var, codigos, columnas) {
  if (var %in% columnas) return(TRUE)
  if (any(startsWith(columnas, paste0(var, "/")))) return(TRUE)
  length(codigos) > 0L && any(paste0(var, "_", codigos) %in% columnas)
}

.INVENTARIO_CONTACTO <- c("id", "uuid", "token", "codigo", "code", "key", "llave", "dni", "correo", "email", "mail",
                          "telefono", "phone", "celular", "whatsapp", "nombre", "nombres", "apellido", "apellidos",
                          "direccion", "address")

#' ¿Un `text` es un identificador o un dato de contacto? Por palabra del nombre o del rótulo
#'
#' `.graficos_is_identifier_like` no sirve aquí: su límite de palabra no corta en `_` («cual_es_su_codigo_pucp» pasa) y descarta
#' los comentarios, que sí son abiertas. Las tildes se quitan con `limpiar_nombres_es` (stringi): el `iconv` TRANSLIT de
#' macOS deja «código» como «c'odigo».
#' @keywords internal
.graficos_inventario_es_contacto <- function(var, etiqueta) {
  palabras <- unlist(strsplit(limpiar_nombres_es(c(var, etiqueta)), "_", fixed = TRUE))
  any(palabras %in% .INVENTARIO_CONTACTO)
}

#' Conteo de preguntas por tipo en una base
#' @return `list(escala, opcion_unica, multiple, numerica, abierta)` (enteros).
#' @keywords internal
.graficos_inventario_preguntas <- function(base, sources) {
  vacio <- list(escala = 0L, opcion_unica = 0L, multiple = 0L, numerica = 0L, abierta = 0L)
  inst <- (sources$inst_sources %||% list())[[base]]
  datos <- (sources$data_sources %||% list())[[base]]
  sv <- (inst %||% list())$survey
  if (!is.data.frame(sv) || !nrow(sv) || !"name" %in% names(sv) || !is.data.frame(datos)) return(vacio)
  columnas <- names(datos)
  nombres <- as.character(sv$name); nombres[is.na(nombres)] <- ""
  etiquetas <- if ("label" %in% names(sv)) as.character(sv$label) else nombres
  etiquetas[is.na(etiquetas)] <- ""
  tipo <- .graficos_inventario_tipo(sv)
  listas <- .regla_escala_listas_filas(sv)
  ch <- inst$choices
  codigos_de <- function(lista) {
    if (!is.data.frame(ch) || !all(c("list_name", "name") %in% names(ch)) || !nzchar(lista)) return(character(0))
    as.character(ch$name[as.character(ch$list_name) == lista])
  }
  en_datos <- nombres %in% columnas
  multiple_en_datos <- vapply(seq_along(nombres), function(i) tipo[i] == "select_multiple" &&
                                .graficos_inventario_multiple_en_datos(nombres[i], codigos_de(listas[i]), columnas), logical(1))
  # Una `_recod` cuenta sólo si su original no está en la base (columna o dummies): el criterio de la regla.
  keep <- nzchar(nombres) & !.regla_es_recod_repetida(nombres, nombres[en_datos | multiple_en_datos]) &
    !startsWith(nombres, "__") & !duplicated(nombres) &
    !vapply(seq_along(nombres), function(i) isTRUE(.graficos_is_operational_metadata(nombres[i], etiquetas[i])), logical(1))
  es_multiple <- keep & multiple_en_datos
  escala <- intersect(.regla_preguntas_de_base(base, character(0), sources) %||% character(0), nombres[keep])
  unica <- setdiff(nombres[keep & en_datos & tipo == "select_one"], escala)
  abiertas <- keep & en_datos & tipo == "text" &
    !vapply(seq_along(nombres), function(i) tipo[i] == "text" && .graficos_inventario_es_contacto(nombres[i], etiquetas[i]), logical(1))
  list(escala = length(escala), opcion_unica = length(unica), multiple = sum(es_multiple),
       numerica = sum(keep & en_datos & tipo %in% .INVENTARIO_TIPOS_NUMERICOS), abierta = sum(abiertas))
}

#' Inventario del estudio para el selector: por base, público, n, preguntas por tipo y padrón declarado
#'
#' @param s Estado de la sesión (para el padrón); `NULL` deja el padrón sin declarar.
#' @param sources `list(data_sources, inst_sources)` (`.graficos_preview_fuentes`), una entrada por base.
#' @return `list(ok, bases: [{base, publico, n, preguntas: {escala, opcion_unica, multiple, numerica, abierta},
#'   padron: {declarado, valor, origen, motivo}}])`, en el orden de las fuentes. `n` son filas sin ponderar de la fuente
#'   del scope (ver la cabecera: con el universo de Analítica sólo en el scope de las bases del procesamiento).
#' @keywords internal
.graficos_inventario <- function(s, sources) {
  bases <- names(sources$data_sources %||% list())
  padrones <- if (length(bases) && !is.null(s)) .graficos_padron_por_base(s, bases) else list()
  padron_de <- stats::setNames(padrones, vapply(padrones, function(p) as.character(p$base), character(1)))
  list(ok = TRUE, bases = lapply(bases, function(b) {
    datos <- sources$data_sources[[b]]
    p <- padron_de[[b]] %||% list(padron = NA_real_, padron_origen = "", motivo = "Sin padrón declarado.")
    declarado <- is.finite(p$padron %||% NA_real_)
    list(base = b, publico = b, n = if (is.data.frame(datos)) nrow(datos) else 0L,
         preguntas = .graficos_inventario_preguntas(b, sources),
         padron = list(declarado = declarado, valor = if (declarado) p$padron else NA_real_,
                       origen = as.character(p$padron_origen %||% ""), motivo = as.character(p$motivo %||% "")))
  }))
}

#' El scope del pedido: vacío (las bases del procesamiento) o `consolidated`
#' @keywords internal
.graficos_inventario_scope <- function(query) {
  scope <- tolower(trimws(as.character((query %||% list())$scope %||% "")[1]))
  if (is.na(scope)) scope <- ""
  if (!scope %in% c("", "consolidated")) {
    stop_api(400, "E_GRAFICOS_INVENTARIO_SCOPE", "El scope del inventario debe ser vacío o `consolidated`.",
             list(scope = scope))
  }
  scope
}
