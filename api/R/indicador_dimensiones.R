#' Construir dimension base: recodificar items categoricos a escala 0-100
#'
#' Toma una base procesada con [reporte_data()] y recodifica variables
#' `select_one` usando la estructura del instrumento de [reporte_instrumento()].
#' La recodificacion se hace por orden de categorias del `list_name` y convierte
#' respuestas sustantivas a una escala 0-100.
#'
#' Reglas para categorias especiales:
#' \itemize{
#'   \item `codigos_missing` se tratan como `missing`.
#'   \item `codigos_no_aplica` se tratan como `no_aplica`.
#'   \item Tanto `missing` como `no_aplica` se recodifican a `NA_real_`.
#' }
#'
#' @param data Objeto devuelto por [reporte_data()] (clase
#'   `"prosecnur_reporte_tbl"`) o un `data.frame` con estructura equivalente.
#' @param instrumento Objeto devuelto por [reporte_instrumento()]. Si es `NULL`,
#'   se toma desde `attr(data, "instrumento_reporte")`.
#' @param vars Variables a recodificar. Si es `NULL`, usa todas las `select_one`
#'   del instrumento presentes en `data`.
#' @param excluir_vars Variables a excluir de la recodificacion.
#' @param orden_por_lista Configuracion de orden ascendente (de menor a mayor)
#'   por `list_name`, usando codigos (`choices$name`). Debe ser una lista
#'   nombrada por `list_name`, donde cada elemento es un vector de codigos en
#'   el orden deseado.
#' @param codigos_missing Codigos a tratar como `missing`, usando solo codigos
#'   (`choices$name`). Acepta vector global de codigos o lista nombrada por
#'   `list_name` (opcionalmente con `.default`).
#' @param codigos_no_aplica Codigos a tratar como `no_aplica`, usando solo
#'   codigos (`choices$name`). Acepta vector global de codigos o lista nombrada
#'   por `list_name` (opcionalmente con `.default`).
#' @param prefijo Prefijo para nuevas columnas recodificadas cuando
#'   `reemplazar = FALSE`.
#' @param reemplazar Si `TRUE`, reemplaza la variable original. Si `FALSE`,
#'   crea columnas nuevas con prefijo.
#' @param verbose Si `TRUE`, imprime resumen de variables procesadas.
#'
#' @return El mismo `data.frame` con variables recodificadas a 0-100. Ademas
#'   agrega atributo `recodificacion_items_meta` con trazabilidad por variable
#'   (list_name, mapeo aplicado y conteos de calidad).
#' @family indicador
#' @seealso [reporte_dimensiones_indices()], [reporte_dimensiones_config()],
#'   [reporte_cruces()], [graficar_heatmap_dimensiones()],
#'   [graficar_radar_dimensiones()]
#' @export
reporte_dimensiones <- function(
    data,
    instrumento = NULL,
    vars = NULL,
    excluir_vars = NULL,
    orden_por_lista = NULL,
    codigos_missing = character(0),
    codigos_no_aplica = character(0),
    prefijo = "r100_",
    reemplazar = FALSE,
    verbose = TRUE
) {
  .ind_validate_data_frame(data, caller = "reporte_dimensiones()")
  instrumento <- .ind_resolve_instrumento(
    data = data,
    instrumento = instrumento,
    caller = "reporte_dimensiones()",
    required = TRUE
  )

  survey <- instrumento$survey
  choices <- instrumento$choices
  orders_list <- instrumento$orders_list

  if (!is.data.frame(survey) || !all(c("name", "type") %in% names(survey))) {
    stop("`instrumento$survey` no tiene la estructura esperada.", call. = FALSE)
  }
  if (!is.data.frame(choices) || !all(c("list_name", "name") %in% names(choices))) {
    stop("`instrumento$choices` no tiene la estructura esperada.", call. = FALSE)
  }

  if (is.null(vars)) {
    is_so <- grepl("^select_one(\\s|$)", as.character(survey$type))
    vars <- unique(as.character(survey$name[is_so]))
    vars <- vars[vars %in% names(data)]
  } else {
    vars <- as.character(vars)
    vars <- vars[!is.na(vars) & nzchar(trimws(vars))]
    vars <- unique(vars)
    vars <- vars[vars %in% names(data)]
  }

  if (!is.null(excluir_vars)) {
    excluir_vars <- as.character(excluir_vars)
    excluir_vars <- excluir_vars[!is.na(excluir_vars) & nzchar(trimws(excluir_vars))]
    vars <- setdiff(vars, unique(excluir_vars))
  }

  if (!length(vars)) {
    stop(
      "reporte_dimensiones(): no hay variables candidatas para recodificar.",
      call. = FALSE
    )
  }

  prefijo <- as.character(.ind_or(prefijo, "r100_"))[1]

  out <- data
  meta <- list()
  vars_ok <- character(0)
  vars_omitidas <- character(0)

  for (v in vars) {
    idx <- which(as.character(survey$name) == v)
    ln <- NA_character_
    if (length(idx) && "list_name" %in% names(survey)) {
      ln_vals <- as.character(survey$list_name[idx])
      ln_vals <- ln_vals[!is.na(ln_vals) & nzchar(ln_vals)]
      if (length(ln_vals)) ln <- ln_vals[1]
    }

    ord_codes <- character(0)
    ord_labels <- character(0)

    if (!is.null(orders_list) && v %in% names(orders_list)) {
      ent <- orders_list[[v]]
      ord_codes <- if (!is.null(ent$names)) as.character(ent$names) else character(0)
      ord_labels <- if (!is.null(ent$labels)) as.character(ent$labels) else character(0)
    }

    if (!length(ord_codes) && !is.na(ln)) {
      ch <- choices[as.character(choices$list_name) == ln, , drop = FALSE]
      if (nrow(ch)) {
        ord_codes <- as.character(ch$name)
        ord_labels <- if ("label" %in% names(ch)) as.character(ch$label) else ord_codes
      }
    }

    if (!length(ord_codes)) {
      warning(
        "reporte_dimensiones(): se omite `", v,
        "`: no se pudo resolver categorias desde instrumento.",
        call. = FALSE
      )
      vars_omitidas <- c(vars_omitidas, v)
      next
    }

    if (length(ord_labels) != length(ord_codes)) {
      ord_labels <- ord_codes
    }

    ord_user <- .ind_cfg_by_list(orden_por_lista, ln)
    ord_user <- ord_user[!is.na(ord_user) & nzchar(trimws(ord_user))]
    if (length(ord_user)) {
      ord_user_tok <- .ind_norm_token(ord_user)
      ord_codes_tok <- .ind_norm_token(ord_codes)
      use_tok <- intersect(ord_user_tok, ord_codes_tok)
      if (length(use_tok)) {
        rest_tok <- setdiff(ord_codes_tok, use_tok)
        new_tok <- c(use_tok, rest_tok)
        idx_new <- match(new_tok, ord_codes_tok)
        ord_codes <- ord_codes[idx_new]
        ord_labels <- ord_labels[idx_new]
      }
    }

    keep <- !is.na(ord_codes) & nzchar(ord_codes)
    ord_codes <- ord_codes[keep]
    ord_labels <- ord_labels[keep]
    if (!length(ord_codes)) {
      warning(
        "reporte_dimensiones(): se omite `", v,
        "`: categorias vacias tras limpieza.",
        call. = FALSE
      )
      vars_omitidas <- c(vars_omitidas, v)
      next
    }

    tok_code <- .ind_norm_token(ord_codes)

    tok_missing <- unique(.ind_norm_token(.ind_cfg_by_list(codigos_missing, ln)))
    tok_no_aplica <- unique(.ind_norm_token(.ind_cfg_by_list(codigos_no_aplica, ln)))
    tok_missing <- tok_missing[nzchar(tok_missing)]
    tok_no_aplica <- tok_no_aplica[nzchar(tok_no_aplica)]

    is_no_aplica_cat <- tok_code %in% tok_no_aplica
    is_missing_cat <- tok_code %in% tok_missing
    is_substantive <- !(is_no_aplica_cat | is_missing_cat)

    tok_missing_v <- unique(c(tok_missing, tok_code[is_missing_cat]))
    tok_no_aplica_v <- unique(c(tok_no_aplica, tok_code[is_no_aplica_cat]))

    sub_codes <- ord_codes[is_substantive]
    sub_labels <- ord_labels[is_substantive]
    sub_tok_code <- tok_code[is_substantive]

    n_sub <- length(sub_codes)
    if (n_sub == 0L) {
      warning(
        "reporte_dimensiones(): se omite `", v,
        "`: sin categorias sustantivas para recodificar.",
        call. = FALSE
      )
      vars_omitidas <- c(vars_omitidas, v)
      next
    }

    scores <- if (n_sub == 1L) 100 else seq(0, 100, length.out = n_sub)
    map_tok <- stats::setNames(as.numeric(scores), sub_tok_code)

    x_raw <- out[[v]]
    x_chr <- as.character(x_raw)
    x_tok <- .ind_norm_token(x_chr)

    res <- rep(NA_real_, length(x_tok))
    motivo <- rep("no_mapeado", length(x_tok))

    idx_na_entrada <- is.na(x_raw) | !nzchar(x_tok) | x_tok == "na"
    idx_no_aplica <- !idx_na_entrada & (x_tok %in% tok_no_aplica_v)
    idx_missing <- !idx_na_entrada & !idx_no_aplica & (x_tok %in% tok_missing_v)
    idx_valid <- !idx_na_entrada & !idx_no_aplica & !idx_missing & (x_tok %in% names(map_tok))

    if (any(idx_valid)) {
      res[idx_valid] <- unname(map_tok[x_tok[idx_valid]])
    }

    motivo[idx_na_entrada] <- "na_entrada"
    motivo[idx_no_aplica] <- "no_aplica"
    motivo[idx_missing] <- "missing"
    motivo[idx_valid] <- "valido"

    out_name <- if (isTRUE(reemplazar)) v else paste0(prefijo, v)
    out[[out_name]] <- res

    var_label <- attr(out[[v]], "label", exact = TRUE)
    var_label <- if (!is.null(var_label) && nzchar(trimws(as.character(var_label)))) {
      as.character(var_label)
    } else {
      v
    }
    attr(out[[out_name]], "label") <- paste0(var_label, " [0-100]")
    attr(out[[out_name]], "measure") <- "scale"

    meta[[v]] <- list(
      variable = v,
      variable_salida = out_name,
      list_name = ln,
      mapeo = tibble::tibble(
        codigo = sub_codes,
        etiqueta = sub_labels,
        score_0_100 = as.numeric(scores)
      ),
      conteos = c(
        n_total = length(x_tok),
        n_valido = sum(motivo == "valido"),
        n_no_aplica = sum(motivo == "no_aplica"),
        n_missing = sum(motivo == "missing"),
        n_no_mapeado = sum(motivo == "no_mapeado"),
        n_na_entrada = sum(motivo == "na_entrada")
      )
    )
    vars_ok <- c(vars_ok, v)
  }

  if (isTRUE(verbose)) {
    message(
      "reporte_dimensiones(): ", length(vars_ok), " variable(s) recodificadas a 0-100",
      if (length(vars_omitidas)) paste0(" (", length(vars_omitidas), " omitida(s))") else "",
      "."
    )
  }

  attr(out, "recodificacion_items_meta") <- meta
  out
}

# =============================================================================
# CONSTRUCTORES DE SUBINDICES E INDICES DIMENSIONALES
# =============================================================================

#' Definir un subindice dimensional
#'
#' Constructor de un subindice (primer nivel de agregacion). Un subindice
#' agrupa variables recodificadas a 0-100 y calcula su promedio ponderado
#' por fila.
#'
#' @param nombre Nombre interno del subindice (sin prefijo). Sera usado como
#'   clave y como sufijo de la columna creada (`sub_<nombre>`).
#' @param etiqueta Etiqueta humana del subindice.
#' @param vars Vector de nombres de variables que componen este subindice.
#' @param icono Ruta a un archivo PNG que representa visualmente este subindice.
#'   Se usa en los graficadores de dimensiones para acompañar o reemplazar la
#'   etiqueta de texto. Si es `NULL` (por defecto) no se muestra ningún ícono.
#'
#' @return Lista de clase \code{"prosecnur_subindice"}.
#' @family indicador
#' @export
subindice <- function(nombre, etiqueta, vars, icono = NULL) {
  nombre   <- as.character(nombre)[1]
  etiqueta <- as.character(etiqueta)[1]
  vars     <- as.character(vars)
  vars     <- vars[!is.na(vars) & nzchar(trimws(vars))]
  vars     <- unique(vars)

  if (!is.null(icono)) icono <- as.character(icono)[1]

  if (!nzchar(nombre)) stop("`nombre` no puede estar vacio.", call. = FALSE)
  if (!nzchar(etiqueta)) etiqueta <- nombre
  if (!length(vars)) stop("`vars` debe contener al menos una variable.", call. = FALSE)

  out <- list(nombre = nombre, etiqueta = etiqueta, vars = vars, icono = icono)
  class(out) <- c("prosecnur_subindice", "list")
  out
}

#' Definir un indice dimensional
#'
#' Constructor de un indice de segundo nivel. Un indice agrupa subindices
#' (referidos por nombre) y calcula su promedio ponderado por fila.
#'
#' @param nombre Nombre interno del indice (sin prefijo). Sera usado como
#'   clave y como sufijo de la columna creada (`idx_<nombre>`).
#' @param etiqueta Etiqueta humana del indice.
#' @param subindices Vector de nombres de subindices que componen este indice.
#' @param icono Ruta a un archivo PNG que representa visualmente este indice.
#'   Se usa en los graficadores de dimensiones para acompañar o reemplazar la
#'   etiqueta de texto. Si es `NULL` (por defecto) no se muestra ningún ícono.
#'
#' @return Lista de clase \code{"prosecnur_indice"}.
#' @family indicador
#' @export
indice <- function(nombre, etiqueta, subindices, icono = NULL) {
  nombre     <- as.character(nombre)[1]
  etiqueta   <- as.character(etiqueta)[1]
  subindices <- as.character(subindices)
  subindices <- subindices[!is.na(subindices) & nzchar(trimws(subindices))]
  subindices <- unique(subindices)

  if (!is.null(icono)) icono <- as.character(icono)[1]

  if (!nzchar(nombre)) stop("`nombre` no puede estar vacio.", call. = FALSE)
  if (!nzchar(etiqueta)) etiqueta <- nombre
  if (!length(subindices)) stop("`subindices` debe contener al menos un subindice.", call. = FALSE)

  out <- list(nombre = nombre, etiqueta = etiqueta, subindices = subindices, icono = icono)
  class(out) <- c("prosecnur_indice", "list")
  out
}

#' Construir indices jerarquicos desde variables de dimension (0-100)
#'
#' Calcula promedios por subindices (primer nivel) y luego indices de segundo
#' nivel a partir de esos subindices. Requiere que `data` sea la salida de
#' [reporte_dimensiones()].
#'
#' @param data `data.frame` con items recodificados a 0-100, tipicamente la
#'   salida de [reporte_dimensiones()].
#' @param subindices Lista de objetos [subindice()]. Cada subindice define
#'   un grupo de variables de primer nivel.
#' @param indices Lista opcional de objetos [indice()]. Cada indice define
#'   un agregado de subindices de segundo nivel.
#' @param prefijo_subindice Prefijo de columnas creadas para subindices.
#' @param prefijo_indice Prefijo de columnas creadas para indices.
#' @param verbose Si `TRUE`, imprime resumen de subindices e indices construidos.
#'
#' @return El mismo `data.frame` con columnas agregadas para subindices e
#'   indices. Agrega ademas `attr(x, "indices_meta")` con trazabilidad.
#' @family indicador
#' @seealso [reporte_dimensiones()], [reporte_dimensiones_config()],
#'   [reporte_cruces()], [graficar_heatmap_dimensiones()],
#'   [graficar_radar_dimensiones()]
#' @export
reporte_dimensiones_indices <- function(
    data,
    subindices,
    indices = NULL,
    prefijo_subindice = "sub_",
    prefijo_indice = "idx_",
    verbose = TRUE
) {
  .ind_validate_data_frame(data, caller = "reporte_dimensiones_indices()")

  if (!is.list(subindices) || !length(subindices)) {
    stop(
      "reporte_dimensiones_indices(): `subindices` debe ser una lista de objetos `subindice()`.",
      call. = FALSE
    )
  }
  for (i in seq_along(subindices)) {
    if (!inherits(subindices[[i]], "prosecnur_subindice")) {
      stop(
        sprintf("reporte_dimensiones_indices(): `subindices[[%d]]` no es un objeto `subindice()`.", i),
        call. = FALSE
      )
    }
  }

  .ri_row_mean <- function(df_num) {
    n_total <- ncol(df_num)
    if (n_total == 0L) return(rep(NA_real_, nrow(df_num)))
    n_valid <- rowSums(!is.na(df_num))
    out <- rowMeans(df_num, na.rm = TRUE)
    out[n_valid == 0L] <- NA_real_
    out
  }

  out <- data
  meta_subindices <- list()
  meta_indices <- list()
  sub_ok <- character(0)
  sub_omitidos <- character(0)

  for (s in subindices) {
    id <- s$nombre
    vars <- s$vars
    vars_ok <- vars[vars %in% names(out)]
    if (!length(vars_ok)) {
      warning(
        "reporte_dimensiones_indices(): subindice `", id,
        "` sin variables disponibles en `data`.",
        call. = FALSE
      )
      sub_omitidos <- c(sub_omitidos, id)
      next
    }

    X <- as.data.frame(out[, vars_ok, drop = FALSE])
    X[] <- lapply(X, function(v) suppressWarnings(as.numeric(v)))
    score <- .ri_row_mean(X)

    out_name <- paste0(prefijo_subindice, id)
    out[[out_name]] <- score
    attr(out[[out_name]], "label") <- s$etiqueta
    attr(out[[out_name]], "measure") <- "scale"

    meta_subindices[[id]] <- list(
      salida = out_name,
      etiqueta = s$etiqueta,
      icono = s$icono,
      vars = vars_ok,
      n_vars = length(vars_ok)
    )
    sub_ok <- c(sub_ok, id)
  }

  indices_ok <- character(0)
  indices_omitidos <- character(0)

  if (!is.null(indices)) {
    if (!is.list(indices) || !length(indices)) {
      stop(
        "reporte_dimensiones_indices(): `indices` debe ser una lista de objetos `indice()`.",
        call. = FALSE
      )
    }
    for (i in seq_along(indices)) {
      if (!inherits(indices[[i]], "prosecnur_indice")) {
        stop(
          sprintf("reporte_dimensiones_indices(): `indices[[%d]]` no es un objeto `indice()`.", i),
          call. = FALSE
        )
      }
    }

    for (idx in indices) {
      id <- idx$nombre
      refs <- idx$subindices

      cols <- character(0)
      for (r in refs) {
        c1 <- paste0(prefijo_subindice, r)
        if (c1 %in% names(out)) {
          cols <- c(cols, c1)
        } else if (r %in% names(out)) {
          cols <- c(cols, r)
        }
      }
      cols <- unique(cols)
      if (!length(cols)) {
        warning(
          "reporte_dimensiones_indices(): indice `", id,
          "` sin referencias disponibles en `data`.",
          call. = FALSE
        )
        indices_omitidos <- c(indices_omitidos, id)
        next
      }

      X <- as.data.frame(out[, cols, drop = FALSE])
      X[] <- lapply(X, function(v) suppressWarnings(as.numeric(v)))
      score <- .ri_row_mean(X)

      out_name <- paste0(prefijo_indice, id)
      out[[out_name]] <- score
      attr(out[[out_name]], "label") <- idx$etiqueta
      attr(out[[out_name]], "measure") <- "scale"

      meta_indices[[id]] <- list(
        salida = out_name,
        etiqueta = idx$etiqueta,
        icono = idx$icono,
        refs = refs,
        refs_resueltas = cols,
        n_refs = length(cols)
      )
      indices_ok <- c(indices_ok, id)
    }
  }

  if (isTRUE(verbose)) {
    msg_sub <- paste0(length(sub_ok), " subindice(s)")
    msg_idx <- if (!is.null(indices)) paste0(", ", length(indices_ok), " indice(s)") else ""
    omitidos <- c(sub_omitidos, indices_omitidos)
    msg_omitidos <- if (length(omitidos)) paste0(" (", length(omitidos), " omitido(s))") else ""
    message(
      "reporte_dimensiones_indices(): ", msg_sub, msg_idx,
      " construido(s)", msg_omitidos, "."
    )
  }

  attr(out, "indices_meta") <- list(
    subindices = meta_subindices,
    indices = meta_indices
  )
  out
}

#' Construir tablas jerarquicas para cruces de dimensiones
#'
#' Genera una configuracion reutilizable de `tablas` para [reporte_cruces()]
#' en `modo = "dimensiones"`, organizando una hoja de indicadores agregados y,
#' opcionalmente, una hoja de detalle por driver.
#'
#' @param data `data.frame` que proviene de [reporte_dimensiones_indices()] y
#'   contiene el atributo `indices_meta`.
#' @param indices Vector opcional de indices a incluir. Acepta nombres logicos
#'   (por ejemplo, `"indice_general"`) o nombres de columnas de salida
#'   (por ejemplo, `"idx_indice_general"`). Si es `NULL`, usa todos los indices
#'   disponibles en `indices_meta`.
#' @param hoja_indicadores Nombre de la hoja resumen donde se apilan indices y
#'   drivers.
#' @param hoja_detalle Nombre de la hoja de detalle por driver.
#' @param incluir_detalle Si `TRUE`, agrega una hoja con el desglose de cada
#'   driver por criterio.
#' @param cruzar_dim Variables adicionales de cruce para las columnas.
#' @param fila Variable base para el primer bloque de columnas.
#' @param incluir_total Si `TRUE`, agrega la columna `Total`.
#' @param brecha_cols Si `TRUE`, agrega columnas de brecha por bloque.
#' @param orientacion Orientacion de las tablas. Por defecto
#'   `"filas_indicadores"`.
#'
#' @return Lista de tablas lista para usarse en [reporte_cruces()].
#' @family indicador
#' @seealso [reporte_cruces()], [reporte_dimensiones_indices()]
#' @export
tablas_dimensiones_jerarquicas <- function(
    data,
    indices = NULL,
    hoja_indicadores = "Indicadores",
    hoja_detalle = "Conductores",
    incluir_detalle = TRUE,
    cruzar_dim = NULL,
    fila,
    incluir_total = TRUE,
    brecha_cols = TRUE,
    orientacion = c("filas_indicadores", "filas_dimension")
) {
  `%||%` <- function(x, y) if (!is.null(x)) x else y

  .ind_validate_data_frame(data, caller = "tablas_dimensiones_jerarquicas()")
  orientacion <- match.arg(orientacion)

  fila <- as.character(fila)[1]
  if (is.na(fila) || !nzchar(trimws(fila))) {
    stop("`fila` debe ser character(1) no vacio.", call. = FALSE)
  }

  cruzar_dim <- as.character(cruzar_dim %||% character(0))
  cruzar_dim <- unique(cruzar_dim[!is.na(cruzar_dim) & nzchar(trimws(cruzar_dim))])
  cruzar_dim <- cruzar_dim[cruzar_dim %in% names(data)]
  cruzar_dim <- setdiff(cruzar_dim, fila)

  idx_meta <- attr(data, "indices_meta", exact = TRUE)
  meta_indices <- if (is.list(idx_meta) && is.list(idx_meta$indices)) idx_meta$indices else list()
  meta_subindices <- if (is.list(idx_meta) && is.list(idx_meta$subindices)) idx_meta$subindices else list()

  if (!length(meta_indices) || !length(meta_subindices)) {
    stop(
      "`data` debe contener `indices_meta` con indices y subindices para construir las tablas jerarquicas.",
      call. = FALSE
    )
  }

  idx_keys <- names(meta_indices)
  idx_out_map <- stats::setNames(
    vapply(meta_indices, function(x) as.character(x$salida %||% NA_character_)[1], character(1)),
    idx_keys
  )
  idx_out_map <- idx_out_map[!is.na(idx_out_map) & nzchar(idx_out_map)]
  idx_key_by_out <- stats::setNames(names(idx_out_map), idx_out_map)

  if (is.null(indices)) {
    idx_sel_keys <- idx_keys
  } else {
    idx_req <- as.character(indices)
    idx_req <- unique(idx_req[!is.na(idx_req) & nzchar(trimws(idx_req))])
    if (!length(idx_req)) {
      stop("`indices` debe contener al menos un indice valido.", call. = FALSE)
    }

    idx_sel_keys <- character(0)
    for (id in idx_req) {
      if (id %in% idx_keys) {
        idx_sel_keys <- c(idx_sel_keys, id)
      } else if (id %in% names(idx_key_by_out)) {
        idx_sel_keys <- c(idx_sel_keys, idx_key_by_out[[id]])
      } else {
        stop("No se encontro el indice `", id, "` en `indices_meta`.", call. = FALSE)
      }
    }
    idx_sel_keys <- unique(idx_sel_keys)
  }

  if (!length(idx_sel_keys)) {
    stop("No se resolvieron indices para construir las tablas jerarquicas.", call. = FALSE)
  }

  sub_sel_keys <- character(0)
  for (id in idx_sel_keys) {
    refs <- unique(as.character(meta_indices[[id]]$refs %||% character(0)))
    refs <- refs[!is.na(refs) & nzchar(trimws(refs))]
    refs <- refs[refs %in% names(meta_subindices)]
    sub_sel_keys <- c(sub_sel_keys, refs)
  }
  sub_sel_keys <- unique(sub_sel_keys)

  if (!length(sub_sel_keys)) {
    sub_sel_keys <- names(meta_subindices)
  }

  mk_table <- function(titulo,
                       indicadores,
                       hoja,
                       espacio_antes = 0L,
                       espacio_despues = 1L) {
    list(
      titulo = as.character(titulo)[1],
      indicadores = indicadores,
      fila = fila,
      cruzar_dim = cruzar_dim,
      hoja = as.character(hoja)[1],
      orientacion = orientacion,
      incluir_total = isTRUE(incluir_total),
      brecha_filas = FALSE,
      etiq_brecha_filas = "Brecha",
      brecha_cols = isTRUE(brecha_cols),
      etiq_brecha_cols = "Brecha",
      espacio_antes = as.integer(espacio_antes),
      espacio_despues = as.integer(espacio_despues)
    )
  }

  out <- list()

  idx_vars <- character(0)
  for (id in idx_sel_keys) {
    meta_i <- meta_indices[[id]]
    idx_var <- as.character(meta_i$salida %||% paste0("idx_", id))[1]
    if (!(idx_var %in% names(data))) next
    idx_vars <- c(idx_vars, idx_var)
  }
  idx_vars <- unique(idx_vars)

  sub_vars <- character(0)
  for (id in sub_sel_keys) {
    meta_s <- meta_subindices[[id]]
    sub_var <- as.character(meta_s$salida %||% paste0("sub_", id))[1]
    if (!(sub_var %in% names(data))) next
    sub_vars <- c(sub_vars, sub_var)
  }
  sub_vars <- unique(sub_vars)

  if (length(idx_vars)) {
    out[[length(out) + 1L]] <- mk_table(
      titulo = "Indicadores",
      indicadores = idx_vars,
      hoja = hoja_indicadores,
      espacio_antes = 0L,
      espacio_despues = if (length(sub_vars)) 2L else 1L
    )
  }

  if (length(sub_vars)) {
    out[[length(out) + 1L]] <- mk_table(
      titulo = "Conductores",
      indicadores = sub_vars,
      hoja = hoja_indicadores,
      espacio_antes = 0L
    )
  }

  if (isTRUE(incluir_detalle)) {
    for (i in seq_along(sub_sel_keys)) {
      id <- sub_sel_keys[[i]]
      meta_s <- meta_subindices[[id]]
      vars_i <- unique(as.character(meta_s$vars %||% character(0)))
      vars_i <- vars_i[!is.na(vars_i) & nzchar(trimws(vars_i))]
      vars_i <- vars_i[vars_i %in% names(data)]
      if (!length(vars_i)) next

      sub_lbl <- as.character(meta_s$etiqueta %||% id)[1]
      out[[length(out) + 1L]] <- mk_table(
        titulo = sub_lbl,
        indicadores = vars_i,
        hoja = hoja_detalle,
        espacio_antes = if (i == 1L) 0L else 3L
      )
    }
  }

  if (!length(out)) {
    stop("No se pudo construir ninguna tabla jerarquica con la metadata disponible.", call. = FALSE)
  }

  out
}

#' Construir configuracion de dimensiones para `reporte_interactivo()`
#'
#' Genera una configuracion lista para el Tab 4 (Dimensiones) a partir de los
#' metadatos producidos por [reporte_dimensiones()] y
#' [reporte_dimensiones_indices()]. El objetivo es separar los nombres tecnicos
#' (`idx_*`, `sub_*`, `r100_*`) de las etiquetas orientadas al usuario.
#'
#' @param data `data.frame` que contiene resultados recodificados/indices,
#'   tipicamente la salida encadenada de [reporte_dimensiones()] y
#'   [reporte_dimensiones_indices()].
#' @param labels_indices Vector/lista nombrada opcional para rotular indices.
#'   Acepta claves por nombre logico (`indice_general`) o por columna de salida
#'   (`idx_indice_general`).
#' @param labels_subindices Vector/lista nombrada opcional para rotular subindices.
#'   Acepta claves por nombre logico (`trato`) o por columna (`sub_trato`).
#' @param labels_indicadores Vector/lista nombrada opcional para rotular
#'   indicadores (`r100_*`).
#' @param semaforo_cortes Numeric(2) con cortes del semaforo en escala 0-100.
#'   Por defecto `c(60, 80)`.
#' @param semaforo_modo Modo de color del semaforo: `"grupos"` (clasificacion
#'   discreta), `"degradado_automatico"` (transiciones suaves usando los cortes
#'   como referencias) o `"degradado_manual"` (gradiente definido por puntos
#'   ancla). `"degradado"` se mantiene como alias de compatibilidad hacia
#'   `"degradado_automatico"`.
#' @param semaforo_anclas_degradado Anclas del degradado automatico. Solo se
#'   usan en `semaforo_modo = "degradado_automatico"`.
#' @param semaforo_gradiente_segmentos Numero de segmentos internos del
#'   gradiente automatico.
#' @param semaforo_gradiente_colores Colores ancla del gradiente manual.
#' @param semaforo_gradiente_valores Valores ancla (en escala 0-100) del
#'   gradiente manual.
#' @param semaforo_gradiente_limites Limites minimo y maximo del gradiente
#'   manual.
#' @param semaforo_colores Vector nombrado de 3 colores (`rojo`, `ambar`,
#'   `verde`) para el heatmap semaforico.
#' @param radar_min_ejes Numero minimo de ejes para usar radar (si no se
#'   cumple, Tab 4 puede usar barras comparativas).
#' @param incluir_total_default Si `TRUE`, Tab 4 inicia mostrando `Total`.
#' @param iteracion_habilitada_default Si `TRUE`, Tab 4 puede iniciar con
#'   iteracion habilitada (si hay variable disponible).
#' @param max_categorias_principal Maximo de categorias visibles para variable
#'   principal.
#' @param max_niveles_iteracion Maximo de niveles visibles de iteracion.
#' @param paleta_radar Paleta cualitativa por defecto del radar (`"okabe_ito"`
#'   o `"ipe"`).
#'
#' @return Una lista con:
#' \itemize{
#'   \item `catalog_general`: catalogo de objetivos de vista General.
#'   \item `catalog_indicadores`: catalogo de objetivos de vista Indicadores.
#'   \item `labels_indices`, `labels_subindices`, `labels_indicadores`.
#'   \item `semaforo`: cortes y colores.
#'   \item `visual`: reglas del motor visual.
#' }
#' @family indicador
#' @seealso [reporte_dimensiones()], [reporte_dimensiones_indices()],
#'   [graficar_heatmap_dimensiones()], [graficar_radar_dimensiones()]
#' @export
reporte_dimensiones_config <- function(
    data,
    labels_indices = NULL,
    labels_subindices = NULL,
    labels_indicadores = NULL,
    semaforo_cortes = c(60, 80),
    semaforo_modo = c("grupos", "degradado_automatico", "degradado_manual", "degradado"),
    semaforo_anclas_degradado = NULL,
    semaforo_gradiente_segmentos = 20L,
    semaforo_gradiente_colores = NULL,
    semaforo_gradiente_valores = NULL,
    semaforo_gradiente_limites = NULL,
    semaforo_colores = c(rojo = "#D84B55", ambar = "#E0B44C", verde = "#3A9A5B"),
    radar_min_ejes = 3L,
    incluir_total_default = TRUE,
    iteracion_habilitada_default = FALSE,
    max_categorias_principal = 8L,
    max_niveles_iteracion = 12L,
    paleta_radar = c("okabe_ito", "ipe"),
    paletas_cruce = NULL
) {
  `%||%` <- function(x, y) if (!is.null(x)) x else y

  .ind_validate_data_frame(data, caller = "reporte_dimensiones_config()")

  paleta_radar <- match.arg(paleta_radar)
  semaforo_modo <- .dim_normalize_semaforo_modo(semaforo_modo)

  .as_palette_list <- function(x) {
    if (is.null(x)) return(list())
    if (!is.list(x)) stop("`paletas_cruce` debe ser una lista nombrada.", call. = FALSE)

    nms <- names(x)
    if (is.null(nms) || any(is.na(nms)) || any(!nzchar(trimws(nms)))) {
      stop("`paletas_cruce` debe ser una lista nombrada por variable de cruce.", call. = FALSE)
    }

    out <- list()
    for (nm in trimws(nms)) {
      pal <- .ind_as_named_chr(x[[nm]])
      if (length(pal)) out[[nm]] <- pal
    }
    out
  }

  .label_data <- function(v) {
    if (!(v %in% names(data))) return(.ind_pretty_label(v))
    lb <- attr(data[[v]], "label", exact = TRUE)
    lb <- as.character(lb %||% "")
    lb <- gsub("\\s*\\[0-100\\]$", "", lb)
    if (nzchar(trimws(lb))) trimws(lb) else .ind_pretty_label(v)
  }

  labels_indices <- .ind_as_named_chr(labels_indices)
  labels_subindices <- .ind_as_named_chr(labels_subindices)
  labels_indicadores <- .ind_as_named_chr(labels_indicadores)
  paletas_cruce <- .as_palette_list(paletas_cruce)

  semaforo_cortes <- suppressWarnings(as.numeric(semaforo_cortes))
  semaforo_cortes <- semaforo_cortes[is.finite(semaforo_cortes) & !is.na(semaforo_cortes)]
  if (length(semaforo_cortes) < 2L) semaforo_cortes <- c(60, 80)
  semaforo_cortes <- sort(unique(semaforo_cortes))[1:2]
  semaforo_cortes <- pmax(0, pmin(100, semaforo_cortes))
  if (length(semaforo_cortes) < 2L || semaforo_cortes[1] >= semaforo_cortes[2]) {
    semaforo_cortes <- c(60, 80)
  }
  semaforo_anclas_degradado <- .dim_normalize_degradado_anclas(
    semaforo_anclas_degradado,
    semaforo_cortes,
    default = c(rojo = 0, verde = 100)
  )
  semaforo_gradiente_segmentos <- .dim_normalize_gradiente_segmentos(
    semaforo_gradiente_segmentos,
    default = 20L
  )
  semaforo_gradiente_manual <- NULL
  if (identical(semaforo_modo, "degradado_manual")) {
    semaforo_gradiente_manual <- .dim_normalize_gradiente_manual(
      colores = semaforo_gradiente_colores,
      valores = semaforo_gradiente_valores,
      limites = semaforo_gradiente_limites
    )
  }

  semaforo_colores <- as.character(semaforo_colores %||% character(0))
  nmsc <- names(semaforo_colores %||% character(0))
  if (is.null(nmsc)) nmsc <- character(0)
  col_rojo <- if ("rojo" %in% nmsc) semaforo_colores[["rojo"]] else "#D84B55"
  col_amb <- if ("ambar" %in% nmsc) semaforo_colores[["ambar"]] else "#E0B44C"
  col_ver <- if ("verde" %in% nmsc) semaforo_colores[["verde"]] else "#3A9A5B"

  radar_min_ejes <- suppressWarnings(as.integer(radar_min_ejes)[1])
  if (!is.finite(radar_min_ejes) || is.na(radar_min_ejes) || radar_min_ejes < 1L) radar_min_ejes <- 3L

  max_categorias_principal <- suppressWarnings(as.integer(max_categorias_principal)[1])
  if (!is.finite(max_categorias_principal) || is.na(max_categorias_principal) || max_categorias_principal < 1L) {
    max_categorias_principal <- 8L
  }

  max_niveles_iteracion <- suppressWarnings(as.integer(max_niveles_iteracion)[1])
  if (!is.finite(max_niveles_iteracion) || is.na(max_niveles_iteracion) || max_niveles_iteracion < 1L) {
    max_niveles_iteracion <- 12L
  }

  idx_meta <- attr(data, "indices_meta", exact = TRUE)
  rec_meta <- attr(data, "recodificacion_items_meta", exact = TRUE)
  meta_subindices <- if (is.list(idx_meta) && is.list(idx_meta$subindices)) idx_meta$subindices else list()
  meta_indices <- if (is.list(idx_meta) && is.list(idx_meta$indices)) idx_meta$indices else list()

  sub_key_to_var <- stats::setNames(
    vapply(meta_subindices, function(x) as.character(x$salida %||% NA_character_)[1], character(1)),
    names(meta_subindices)
  )
  sub_key_to_var <- sub_key_to_var[!is.na(sub_key_to_var) & nzchar(sub_key_to_var)]
  sub_var_to_key <- stats::setNames(names(sub_key_to_var), as.character(sub_key_to_var))

  rec_var_to_source <- stats::setNames(character(0), character(0))
  if (is.list(rec_meta) && length(rec_meta)) {
    rec_df <- data.frame(
      src = names(rec_meta),
      out = vapply(rec_meta, function(x) as.character(x$variable_salida %||% NA_character_)[1], character(1)),
      stringsAsFactors = FALSE
    )
    rec_df <- rec_df[!is.na(rec_df$out) & nzchar(rec_df$out), , drop = FALSE]
    if (nrow(rec_df)) {
      rec_var_to_source <- stats::setNames(as.character(rec_df$src), as.character(rec_df$out))
    }
  }

  catalog_general <- list()
  for (id in names(meta_indices)) {
    it <- meta_indices[[id]]
    idx_var <- as.character(it$salida %||% NA_character_)[1]
    if (is.na(idx_var) || !nzchar(idx_var) || !(idx_var %in% names(data))) next

    refs <- unique(c(
      as.character(it$refs_resueltas %||% character(0)),
      as.character(it$refs %||% character(0))
    ))

    axis_vars <- character(0)
    axis_labels <- character(0)
    for (r in refs) {
      rv <- if (r %in% names(data)) {
        r
      } else if (r %in% names(sub_key_to_var)) {
        as.character(sub_key_to_var[[r]])
      } else {
        NA_character_
      }
      if (is.na(rv) || !nzchar(rv) || !(rv %in% names(data)) || rv %in% axis_vars) next

      axis_vars <- c(axis_vars, rv)

      skey <- if (rv %in% names(sub_var_to_key)) as.character(sub_var_to_key[[rv]]) else rv
      sub_etiq <- if (skey %in% names(meta_subindices)) meta_subindices[[skey]]$etiqueta else NULL
      lb <- sub_etiq %||% .ind_nm_get(labels_subindices, skey) %||% .ind_nm_get(labels_subindices, rv) %||% .label_data(rv)
      axis_labels <- c(axis_labels, as.character(lb))
    }
    if (!length(axis_vars)) next

    idx_etiq <- if (id %in% names(meta_indices)) meta_indices[[id]]$etiqueta else NULL
    ilab <- idx_etiq %||% .ind_nm_get(labels_indices, id) %||% .ind_nm_get(labels_indices, idx_var) %||% .label_data(idx_var)
    catalog_general[[idx_var]] <- list(
      id = idx_var,
      key = id,
      label = as.character(ilab),
      axis_vars = axis_vars,
      axis_labels = axis_labels
    )
  }

  if (!length(catalog_general)) {
    idx_vars <- grep("^idx_", names(data), value = TRUE)
    sub_vars <- grep("^sub_", names(data), value = TRUE)
    if (length(idx_vars) && length(sub_vars)) {
      axis_labels <- vapply(sub_vars, function(v) {
        skey <- if (v %in% names(sub_var_to_key)) as.character(sub_var_to_key[[v]]) else v
        sub_etiq <- if (skey %in% names(meta_subindices)) meta_subindices[[skey]]$etiqueta else NULL
        as.character(sub_etiq %||% .ind_nm_get(labels_subindices, skey) %||% .ind_nm_get(labels_subindices, v) %||% .label_data(v))
      }, character(1))
      for (v in idx_vars) {
        ilab <- .ind_nm_get(labels_indices, v) %||% .label_data(v)
        catalog_general[[v]] <- list(
          id = v,
          key = v,
          label = as.character(ilab),
          axis_vars = sub_vars,
          axis_labels = axis_labels
        )
      }
    }
  }

  catalog_indicadores <- list()
  for (sk in names(meta_subindices)) {
    sl <- meta_subindices[[sk]]
    svar <- as.character(sl$salida %||% NA_character_)[1]
    vars <- unique(as.character(sl$vars %||% character(0)))
    vars <- vars[vars %in% names(data)]
    if (!length(vars)) next

    slab <- sl$etiqueta %||% .ind_nm_get(labels_subindices, sk) %||% .ind_nm_get(labels_subindices, svar) %||% .ind_pretty_label(sk)
    ilabs <- vapply(vars, function(v) {
      src <- .ind_nm_get(rec_var_to_source, v) %||% v
      as.character(.ind_nm_get(labels_indicadores, v) %||% .ind_nm_get(labels_indicadores, src) %||% .label_data(v))
    }, character(1))

    catalog_indicadores[[sk]] <- list(
      id = sk,
      key = sk,
      label = as.character(slab),
      block_var = svar,
      axis_vars = vars,
      axis_labels = ilabs
    )
  }

  list(
    version = 1L,
    catalog_general = catalog_general,
    catalog_indicadores = catalog_indicadores,
    labels_indices = labels_indices,
    labels_subindices = labels_subindices,
    labels_indicadores = labels_indicadores,
    paletas_cruce = paletas_cruce,
    semaforo = list(
      cortes = as.numeric(semaforo_cortes),
      modo = semaforo_modo,
      colores = c(rojo = col_rojo, ambar = col_amb, verde = col_ver),
      anclas_degradado = semaforo_anclas_degradado,
      gradiente_segmentos = as.integer(semaforo_gradiente_segmentos),
      gradiente_colores = semaforo_gradiente_manual$colores %||% NULL,
      gradiente_valores = semaforo_gradiente_manual$valores %||% NULL,
      gradiente_limites = semaforo_gradiente_manual$limites %||% NULL
    ),
    visual = list(
      radar_min_ejes = as.integer(radar_min_ejes),
      incluir_total_default = isTRUE(incluir_total_default),
      iteracion_habilitada_default = isTRUE(iteracion_habilitada_default),
      max_categorias_principal = as.integer(max_categorias_principal),
      max_niveles_iteracion = as.integer(max_niveles_iteracion),
      paleta_radar = as.character(paleta_radar)
    )
  )
}
