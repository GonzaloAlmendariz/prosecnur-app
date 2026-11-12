# Carga › Actualizar una fuente: qué se conserva y qué hay que rehacer por fase.
#
# Plan del revamp de Procesamiento, fila "Motor de Carga", punto 3. Cuando solo
# cambian las respuestas (el formulario es el mismo), el trabajo del equipo que
# no depende de la data vieja se conserva: reglas propias, variables excluidas
# de la auditoría, configuración operativa, variables propias y calculadas,
# catálogo de codificación y decisiones de limpieza que identifican sus casos
# por un identificador. Lo derivado de la data vieja (auditoría, base cerrada,
# codificación aplicada, archivos de Analítica e informe) hay que rehacerlo.
#
# Una sola función decide el destino de cada decisión de limpieza
# (`carga_actualizar_destino_decisiones`): la vista previa la usa para decirlo
# y `carga_actualizar_aplicar()` para hacerlo. Así lo que se anuncia es lo que
# pasa.

.carga_actualizar_item <- function(clave, que, n = NA_integer_, causa = NA_character_) {
  list(clave = clave, que = que, n = if (is.null(n)) NA_integer_ else as.integer(n), causa = causa)
}

# Una decisión identifica sus casos por número de fila si su marca lo dice o si
# alguno de sus ids es un número de fila: en la versión nueva esa fila puede
# ser otro caso.
.carga_actualizar_decision_por_fila <- function(d) {
  marca <- d$identificacion_casos %||% list()
  col <- as.character(marca$columna %||% "")[1]
  if (!is.na(col) && col %in% c("posicion", "_index")) return(TRUE)
  if (length(marca$numeracion %||% NULL)) return(TRUE)
  ids <- as.character(unlist(c(d[["target_case_ids", exact = TRUE]] %||% list(),
                               d$target_case_ids_resueltos %||% list()), use.names = FALSE))
  any(grepl("::(row|idx)::", ids))
}

#' Destino de cada decisión de limpieza al cargar una versión nueva.
#'
#' `nueva` es la data nueva (sin normalizar). Devuelve una fila por decisión
#' con `destino` (`conserva` o `se_pierde`), su causa y, si guarda casos,
#' cuántos ya no vienen en la versión nueva (NA si su tabla no es la principal).
#' @keywords internal
carga_actualizar_destino_decisiones <- function(draft, nueva, scope = list()) {
  lapply(draft %||% list(), function(d) {
    id <- as.character(d$id %||% NA_character_)[1]
    accion <- as.character(d$action_type %||% NA_character_)[1]
    out <- list(id = id, accion = accion, source_id = as.character(d$source_id %||% NA_character_)[1],
                destino = "conserva", causa = NA_character_,
                n_casos_guardados = NA_integer_, n_casos_que_ya_no_vienen = NA_integer_)
    if (!.limpieza_decision_tiene_casos(d)) {
      out$causa <- "Sigue a la regla: se aplica a los casos que marque la nueva auditoría."
      return(out)
    }
    guardados <- unique(c(.limpieza_ids_explicitos(d),
                          as.character(unlist(d$target_case_ids_resueltos %||% list(), use.names = FALSE))))
    guardados <- guardados[!is.na(guardados) & nzchar(guardados)]
    out$n_casos_guardados <- length(guardados)
    if (.carga_actualizar_decision_por_fila(d)) {
      out$destino <- "se_pierde"
      out$causa <- "Identificaba sus casos por número de fila; en la versión nueva esa fila puede ser otro caso."
      return(out)
    }
    tabla <- .limpieza_tabla_de_regla(scope, d$source_id)
    if (!identical(tabla, "principal")) {
      out$causa <- "Guarda sus casos de un grupo repetido; la versión nueva no se compara en esa tabla."
      return(out)
    }
    r <- .limpieza_ids_por_marca(nueva, "principal", d$identificacion_casos)
    if (!isTRUE(r$aplicable)) {
      out$destino <- "se_pierde"
      out$causa <- "La columna que identificaba sus casos no viene en la versión nueva."
      return(out)
    }
    out$n_casos_que_ya_no_vienen <- length(setdiff(guardados, r$ids))
    out$causa <- if (out$n_casos_que_ya_no_vienen > 0L) {
      "Se conserva con su lista de casos; los que ya no vienen no se tocan."
    } else {
      "Se conserva con su lista de casos."
    }
    out
  })
}

.carga_actualizar_nombres <- function(lista, campo) {
  v <- vapply(lista %||% list(), function(x) as.character(x[[campo]] %||% NA_character_)[1], character(1))
  v[!is.na(v) & nzchar(v)]
}

#' Qué se conserva, qué se pierde y qué hay que rehacer, por fase.
#'
#' `s` es la sesión, `nombre` la base y `nueva` la data nueva; `comparacion`
#' la salida de `carga_actualizar_comparar()`. No escribe.
#' @keywords internal
carga_actualizar_fases <- function(s, nombre, nueva, comparacion) {
  meta <- s$estudio$bases[[nombre]]
  scope <- meta$validacion %||% list()
  casos <- comparacion$casos
  destinos <- carga_actualizar_destino_decisiones(scope$limpieza_draft, nueva, scope)
  conserva <- Filter(function(x) identical(x$destino, "conserva"), destinos)
  pierde <- Filter(function(x) identical(x$destino, "se_pierde"), destinos)
  n_a_auditar <- if (is.na(casos$nuevos)) NA_integer_ else casos$nuevos + casos$editados

  val_conserva <- list(
    .carga_actualizar_item("reglas_formulario", "Reglas del formulario", causa = "El formulario no cambia; se cuentan al volver a auditar."),
    .carga_actualizar_item("reglas_propias", "Reglas propias", length(scope$reglas_custom %||% list())),
    .carga_actualizar_item("variables_excluidas", "Variables excluidas de la auditoría", length(scope$variables_excluidas %||% character(0))),
    .carga_actualizar_item("configuracion_operativa", "Configuración operativa (identidad del caso, periodo de campo)"),
    .carga_actualizar_item("decisiones_limpieza", "Decisiones de limpieza", length(conserva))
  )
  val_pierde <- if (length(pierde)) list(.carga_actualizar_item(
    "decisiones_limpieza", "Decisiones de limpieza", length(pierde), pierde[[1]]$causa)) else list()
  val_rehacer <- list(.carga_actualizar_item(
    "auditoria", "Volver a auditar", n_a_auditar,
    if (is.na(n_a_auditar)) "No se pudieron emparejar los casos; se audita la base entera." else "Casos nuevos y editados."))
  if (isTRUE((meta$limpieza %||% list())$enabled)) {
    val_rehacer[[length(val_rehacer) + 1L]] <- .carga_actualizar_item(
      "cierre", "Cerrar la base otra vez", causa = "La base cerrada salió de la versión anterior.")
  }

  cod <- (s$codif_por_base %||% list())[[nombre]] %||% list()
  n_grupos <- length(cod$grupos_recod %||% list())
  cod_conserva <- list(.carga_actualizar_item("catalogo", "Libro de códigos", n_grupos))
  if (length(meta$choice_code_mapping %||% list())) {
    cod_conserva[[2L]] <- .carga_actualizar_item("codigos_de_opciones", "Códigos confirmados de las opciones")
  }
  cod_rehacer <- list()
  if (n_grupos > 0L) {
    cod_rehacer <- list(
      .carga_actualizar_item("codificar_nuevas", "Codificar las respuestas de los casos nuevos",
                             causa = "La vista previa no cuenta las respuestas abiertas por codificar."),
      .carga_actualizar_item("aplicar", "Volver a aplicar la codificación a la base"))
  }

  propias <- .carga_actualizar_nombres(meta[["variables_propias"]], "name")
  propias_faltan <- setdiff(propias, names(nueva))
  carga_conserva <- list(
    .carga_actualizar_item("formulario", "Formulario", causa = "Solo cambian las respuestas."),
    .carga_actualizar_item("variables_propias", "Variables propias", length(propias) - length(propias_faltan)),
    .carga_actualizar_item("variables_calculadas", "Variables calculadas", length(meta[["variables_calculadas"]] %||% list())))
  carga_pierde <- if (length(propias_faltan)) list(.carga_actualizar_item(
    "variables_propias", "Variables propias sin columna", length(propias_faltan),
    sprintf("La versión nueva no trae %s.", paste(sprintf("\"%s\"", propias_faltan), collapse = ", ")))) else list()

  ana_rehacer <- if (!is.null((s$analitica_status_por_base %||% list())[[nombre]])) list(
    .carga_actualizar_item("archivos", "Volver a generar los archivos de Analítica",
                           causa = "Se generaron con la versión anterior.")) else list()
  graf_rehacer <- if (isTRUE(s$graficos_ppt_ok) || isTRUE(s$graficos_word_ok)) list(
    .carga_actualizar_item("informe", "Volver a generar el informe", causa = "Se generó con la versión anterior.")) else list()

  fase <- function(clave, nombre_fase, conserva, rehacer = list(), pierde = list()) {
    list(fase = clave, nombre = nombre_fase, se_conserva = conserva,
         hay_que_rehacer = rehacer, se_pierde = pierde)
  }
  list(
    fases = list(
      fase("carga", "Carga", carga_conserva, pierde = carga_pierde),
      fase("validacion", "Validación", val_conserva, val_rehacer, val_pierde),
      fase("codificacion", "Codificación", cod_conserva, cod_rehacer),
      fase("analitica", "Analítica",
           list(.carga_actualizar_item("configuracion", "Configuración de tablas, pesos y dimensiones")), ana_rehacer),
      fase("graficos", "Gráficos",
           list(.carga_actualizar_item("laminas", "Láminas y su estilo")), graf_rehacer)
    ),
    decisiones = destinos
  )
}
