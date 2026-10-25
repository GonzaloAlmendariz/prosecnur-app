# Codificación › Grupos: renombrar un grupo después de adaptar (CCSS-TXT-24).
#
# La adaptación escribe el rótulo de cada código nuevo en el instrumento
# adaptado (`choices` de `<var>_recod`). Gráficos, Analítica y el
# `instrumento_adaptado.xlsx` que se entrega leen ese rótulo, no
# `grupos_recod`. Renombrar un grupo después de adaptar sólo tocaba
# `grupos_recod`: la lámina seguía con el rótulo viejo y nada lo decía.
#
# Renombrar no cambia qué respuesta va a qué código (el código es la
# identidad; el rótulo, presentación), así que no hace falta recodificar: el
# rótulo nuevo se escribe en el instrumento adaptado de ESA base, por código,
# sin tocar la data, los conteos ni la validación. Lo que no se puede llevar
# así (un código que la base adaptada aún no tiene, una opción heredada del
# instrumento original) se devuelve en `no_propagados` con su causa.

#' Guarda los grupos de una pregunta y lleva sus rótulos a la base adaptada.
#'
#' Motor de `POST /api/codificacion/grupos`. Escribe en la base activa de
#' codificación (`codif_source_active`); las bases hermanas no se tocan.
#' @keywords internal
codificacion_grupos_guardar <- function(sid, parent, grupos) {
  base <- codif_source_active(sid)
  if (is.null(grupos)) grupos <- list()
  all_grupos <- codif_get(sid, "grupos_recod", source = base) %||% list()
  all_grupos[[parent]] <- grupos
  codif_set(sid, "grupos_recod", all_grupos, source = base)
  # Resumen para el estado: respuestas distintas con grupo asignado.
  recod <- codif_get(sid, "respuestas_recod", source = base) %||% list()
  cod_set <- unique(unlist(lapply(grupos, function(g) {
    vapply(g$respuestas %||% list(), function(t) as.character(t)[1], character(1))
  }), use.names = FALSE))
  recod[[parent]] <- as.list(cod_set)
  codif_set(sid, "respuestas_recod", recod, source = base)
  list(
    ok = TRUE, parent = parent, n_grupos = length(grupos),
    n_codificadas = length(cod_set),
    updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    rotulos_adaptados = .codif_rotulos_propagar_seguro(sid, parent, grupos, base)
  )
}

# Los grupos ya quedaron guardados: si llevar el rótulo falla, el guardado no
# se reporta como fallido; la respuesta dice que el rótulo no llegó y por qué.
.codif_rotulos_propagar_seguro <- function(sid, parent, grupos, base) {
  tryCatch(
    codificacion_propagar_rotulos_adaptados(sid, parent, grupos, base = base),
    error = function(e) {
      message(sprintf("[codificacion] rótulos de '%s' no llevados a la base adaptada '%s': %s",
                      parent, base, conditionMessage(e)))
      list(
        estado = "error", base = base, variables = list(), propagados = list(),
        no_propagados = list(), requiere_readaptar = TRUE,
        mensaje = paste(
          "Los grupos se guardaron, pero los rótulos nuevos no llegaron a la base adaptada.",
          "Vuelve a adaptar para que Gráficos los use."
        )
      )
    }
  )
}

#' Lleva los rótulos de los grupos al instrumento adaptado de la base.
#'
#' Devuelve `list(estado, base, variables, propagados, no_propagados,
#' requiere_readaptar)`. `estado`: `sin_adaptacion` (la base no está
#' adaptada: la próxima adaptación ya usará estos rótulos), `al_dia` (nada que
#' cambiar) o `propagado`.
#' @keywords internal
codificacion_propagar_rotulos_adaptados <- function(sid, parent, grupos, base = NULL) {
  base <- as.character(base %||% codif_source_active(sid))[1]
  out <- list(
    estado = "sin_adaptacion", base = base, variables = list(),
    propagados = list(), no_propagados = list(), requiere_readaptar = FALSE
  )
  s <- session_get(sid)
  if (!.codif_base_pair_is_adapted(s, base)) return(out)

  meta_base <- s$estudio$bases[[base]]
  xls_fid <- as.character(meta_base$xlsform_file_id %||% "")
  xls_meta <- s$files[[xls_fid]]
  inst <- codif_inst_cached(sid, base)
  vars <- .codif_rotulos_variables(sid, base, parent, inst)
  out$variables <- as.list(vars)
  if (!length(vars)) return(out)

  cambios <- list()  # list_name -> c(code = etiqueta_nueva)
  antes <- list()    # list_name -> c(code = etiqueta_vieja)
  for (var in vars) {
    ln <- .codif_list_name_for_var(inst, var)
    actuales <- .choices_lookup(inst, ln)
    for (g in grupos %||% list()) {
      codigo <- trimws(as.character(g$codigo %||% "")[1])
      etiqueta <- trimws(as.character(g$etiqueta %||% "")[1])
      if (is.na(codigo) || !nzchar(codigo) || is.na(etiqueta) || !nzchar(etiqueta)) next
      if (!(codigo %in% names(actuales))) {
        out$no_propagados[[length(out$no_propagados) + 1L]] <- list(
          variable = var, codigo = codigo, etiqueta = etiqueta, motivo = "codigo_sin_adaptar",
          mensaje = sprintf("El código %s todavía no está en la base adaptada: vuelve a adaptar para crearlo.", codigo)
        )
        next
      }
      vieja <- as.character(actuales[[codigo]])
      if (identical(vieja, etiqueta)) next
      if (identical(as.character(g$origen %||% ""), "existente")) {
        out$no_propagados[[length(out$no_propagados) + 1L]] <- list(
          variable = var, codigo = codigo, etiqueta = etiqueta, motivo = "opcion_original",
          mensaje = sprintf("El código %s es una opción del instrumento original; su rótulo se cambia en el formulario.", codigo)
        )
        next
      }
      cambios[[ln]] <- c(cambios[[ln]], stats::setNames(etiqueta, codigo))
      antes[[ln]] <- c(antes[[ln]], stats::setNames(vieja, codigo))
      out$propagados[[length(out$propagados) + 1L]] <- list(
        variable = var, codigo = codigo, antes = vieja, despues = etiqueta
      )
    }
  }
  out$requiere_readaptar <- length(out$no_propagados) > 0L &&
    any(vapply(out$no_propagados, function(x) identical(x$motivo, "codigo_sin_adaptar"), logical(1)))
  if (!length(cambios)) {
    out$estado <- "al_dia"
    return(out)
  }

  .codif_rotulos_reescribir_xlsx(xls_meta$path, cambios, antes)
  .codif_rotulos_refrescar_sesion(sid, base, xls_fid, cambios, vars)
  out$estado <- "propagado"
  out
}

# Variables `_recod` de la base adaptada que salieron de esta pregunta. Mismas
# reglas de nombre que `.compute_plan_adaptacion()`: `<text_col|parent|
# parent_col>_recod`, la que exista en el instrumento adaptado.
.codif_rotulos_variables <- function(sid, base, parent, inst) {
  draft <- codif_get(sid, "familias_draft", source = base)
  fila <- NULL
  for (r in (draft$rows %||% list())) {
    claves <- vapply(c("parent", "parent_col", "text_col"), function(k) {
      as.character(r[[k]] %||% "")[1]
    }, character(1))
    if (parent %in% claves) { fila <- r; break }
  }
  raices <- c(parent, as.character(fila$text_col %||% ""), as.character(fila$parent_col %||% ""),
              as.character(fila$parent %||% ""))
  raices <- unique(raices[!is.na(raices) & nzchar(raices)])
  survey <- inst$survey %||% inst$survey_raw
  nombres <- if (is.data.frame(survey) && "name" %in% names(survey)) as.character(survey$name) else character(0)
  vars <- intersect(paste0(raices, "_recod"), nombres)
  vars[vapply(vars, function(v) nzchar(.codif_list_name_for_var(inst, v)), logical(1))]
}

# Reescribe en el XLSX del instrumento adaptado sólo las celdas de rótulo de
# los códigos renombrados. Se conservan estilos (las filas pintadas de la
# adaptación) y las columnas de otro idioma: se reemplaza la celda que tenía
# el rótulo viejo; si ninguna lo tenía, la columna de rótulo principal.
.codif_rotulos_reescribir_xlsx <- function(path, cambios, antes) {
  wb <- openxlsx::loadWorkbook(path)
  hoja <- openxlsx::sheets(wb)[tolower(openxlsx::sheets(wb)) == "choices"][1]
  if (is.na(hoja)) {
    stop_api(409, "E_CODIF_INSTRUMENTO_ADAPTADO_SIN_CHOICES",
             "El instrumento adaptado no tiene hoja «choices»: vuelve a adaptar para actualizar los rótulos.")
  }
  df <- openxlsx::read.xlsx(wb, sheet = hoja, colNames = TRUE, skipEmptyRows = FALSE,
                            skipEmptyCols = FALSE, check.names = FALSE, sep.names = " ")
  cols_label <- which(grepl("^label", names(df), ignore.case = TRUE))
  principal <- match(.guess_label_col(df), names(df))
  ln_col <- trimws(as.character(df$list_name))
  nm_col <- trimws(as.character(df$name))
  for (ln in names(cambios)) {
    for (codigo in names(cambios[[ln]])) {
      filas <- which(ln_col == ln & nm_col == codigo)
      for (i in filas) {
        vals <- vapply(cols_label, function(j) trimws(as.character(df[[j]][i])), character(1))
        destino <- cols_label[!is.na(vals) & vals == antes[[ln]][[codigo]]]
        if (!length(destino) && !is.na(principal)) destino <- principal
        for (j in destino) {
          openxlsx::writeData(wb, hoja, cambios[[ln]][[codigo]], startCol = j, startRow = i + 1L, colNames = FALSE)
        }
      }
    }
  }
  tmp <- tempfile(tmpdir = dirname(path), fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, tmp, overwrite = TRUE)
  if (!file.rename(tmp, path)) {
    unlink(tmp)
    stop_api(500, "E_CODIF_ROTULOS_NO_ESCRITOS",
             "No se pudieron escribir los rótulos en el instrumento adaptado.")
  }
  invisible(path)
}

# Lleva los rótulos a los objetos ya leídos de la base (instrumento, data con
# sus etiquetas de valor y de dummies, Analítica). No reemplaza la base: eso
# vaciaría la validación y la limpieza, que no dependen de un rótulo.
.codif_rotulos_refrescar_sesion <- function(sid, base, xls_fid, cambios, vars) {
  ov <- list(values = cambios, titles = stats::setNames(character(0), character(0)))
  relabel_inst <- function(inst) {
    if (!is.list(inst) || is.data.frame(inst)) return(inst)
    .label_overrides_apply_to_instrument(inst, ov)
  }
  relabel_data <- function(data, inst) {
    if (!is.data.frame(data)) return(data)
    data <- .label_overrides_relabel_data(data, inst %||% list(), ov)
    .codif_rotulos_dummies(data, vars, cambios, inst)
  }
  s <- session_get(sid)
  for (par in list(c("rp_inst_sources", "rp_data_sources"),
                   c("analitica_rp_inst_sources", "analitica_rp_data_sources"))) {
    if (is.list(s[[par[1]]]) && !is.null(s[[par[1]]][[base]])) {
      s[[par[1]]][[base]] <- relabel_inst(s[[par[1]]][[base]])
    }
    if (is.list(s[[par[2]]]) && !is.null(s[[par[2]]][[base]])) {
      s[[par[2]]][[base]] <- relabel_data(s[[par[2]]][[base]], s[[par[1]]][[base]])
    }
  }
  if (identical(names((s$estudio %||% list())$bases %||% list())[1], base)) {
    if (!is.null(s$rp_inst)) s$rp_inst <- relabel_inst(s$rp_inst)
    if (is.data.frame(s$rp_data)) s$rp_data <- relabel_data(s$rp_data, s$rp_inst)
  }
  fuente <- as.character(s$analitica_fuente %||% "")[1]
  if (!is.na(fuente) && (identical(fuente, base) || endsWith(fuente, paste0(":", base)))) {
    if (!is.null(s$analitica_rp_inst)) s$analitica_rp_inst <- relabel_inst(s$analitica_rp_inst)
    if (is.data.frame(s$analitica_rp_data)) s$analitica_rp_data <- relabel_data(s$analitica_rp_data, s$analitica_rp_inst)
  }
  if (!is.null(s$files[[xls_fid]])) {
    s$files[[xls_fid]]$size <- as.integer(file.info(s$files[[xls_fid]]$path)$size)
    s$files[[xls_fid]]$rotulos_actualizados_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  }
  # Los entregables ya generados llevan el rótulo viejo.
  s$graficos_ppt_ok <- FALSE
  s$graficos_word_ok <- FALSE
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  # El instrumento crudo de Codificación se relee del archivo ya reescrito.
  codif_set(sid, "inst", NULL, source = base)
  invisible(TRUE)
}

# `reporte_data()` titula cada dummy de select_multiple (`var.cod` / `var/cod`)
# con el rótulo de su opción.
.codif_rotulos_dummies <- function(data, vars, cambios, inst) {
  for (var in vars) {
    ln <- .codif_list_name_for_var(inst %||% list(), var)
    if (!nzchar(ln)) ln <- names(cambios)[1]
    mapa <- cambios[[ln]]
    if (is.null(mapa)) next
    for (codigo in names(mapa)) {
      for (col in intersect(paste0(var, c(".", "/"), codigo), names(data))) {
        attr(data[[col]], "label") <- mapa[[codigo]]
      }
    }
  }
  data
}
