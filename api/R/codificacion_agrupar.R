# =============================================================================
# codificacion_agrupar.R — «Agrupar categorías» de una variable codificada
# =============================================================================
#
# Ítem 1f del checklist de entregables HSyVBG 2026. Una select_one con códigos
# (orientación sexual, lugar de nacimiento, año de ingreso…) necesita a veces
# una versión agrupada: 2 y 3 juntos como «No heterosexual», los departamentos
# fuera de Lima como «Otras regiones», los años ≤ 2021 como un solo tramo. Hasta
# ahora Codificación sólo agrupaba TEXTOS (el puente compara respuestas
# escritas), así que agrupar códigos existentes no tenía efecto.
#
# Invariantes (dominio-prosecnur / nucleo-metodologico):
#   - La variable original NUNCA se toca. El resultado es una columna nueva
#     `target`, que el instrumento declara como select_one con su propia lista
#     `lst_<target>` (sin arrastrar el catálogo original).
#   - Los datos viajan por código: `target` guarda el `codigo` de la categoría,
#     la etiqueta vive sólo en choices.
#   - Los códigos especiales 80–99 van al final del catálogo (lo hace
#     `.add_recoded_q()`; aquí no se reordena a mano).
#   - El estado es por base: `codif_por_base[[base]]$agrupaciones[[parent]]`.
#
# Spec:
#   {parent, target, text_col|null, codigo_otro|null,
#    categorias: [{codigo, etiqueta, codigos[], rango{min,max}|null,
#                  otros_textos[], otros_numerico, otros_resto, resto}]}
#
# Evaluación por fila (valor `v` del padre como código de texto):
#   1. Si `v == codigo_otro` y el texto de `text_col` no está vacío:
#      `otros_textos` (normalizado: trim, minúsculas, sin tildes) → categoría
#      con `otros_numerico` cuyo rango contiene el entero del texto (sólo si el
#      texto es un número puro) → categoría con `otros_resto`.
#   2. Si nada calzó: categoría cuyo `codigos` contiene `v`, o cuyo `rango`
#      contiene `as.numeric(v)` → categoría con `resto` (sólo si `v` no falta).
#      El rango no captura `codigo_otro` ni, si es abierto, especiales 80–99.
#   3. Nada calza → NA. `v` faltante → NA.

# ---- Helpers escalares --------------------------------------------------------

.codif_agrupar_scalar <- function(x, default = "") {
  out <- .codif_config_scalar(x, default)
  out <- trimws(out)
  if (!nzchar(out)) default else out
}

.codif_agrupar_flag <- function(x) isTRUE(as.logical(unlist(x %||% FALSE))[1])

.codif_agrupar_num <- function(x) {
  if (is.null(x) || !length(x)) return(NA_real_)
  v <- suppressWarnings(as.numeric(as.character(unlist(x))[1]))
  if (length(v) && is.finite(v)) v else NA_real_
}

# Valor de una columna como código de texto: 1 y 1.0 son el mismo código "1";
# vacío y NA son faltantes.
.codif_agrupar_codigo_chr <- function(x) {
  if (inherits(x, "haven_labelled")) x <- as.vector(x)
  if (is.factor(x)) x <- as.character(x)
  if (is.numeric(x)) {
    out <- ifelse(
      is.na(x), NA_character_,
      ifelse(abs(x - round(x)) < 1e-9,
             format(round(x), scientific = FALSE, trim = TRUE),
             format(x, scientific = FALSE, trim = TRUE, digits = 15))
    )
    return(as.character(out))
  }
  out <- trimws(as.character(x))
  out <- sub("^(-?[0-9]+)\\.0+$", "\\1", out)
  out[!is.na(out) & !nzchar(out)] <- NA_character_
  out
}

.codif_agrupar_chr_vec <- function(x) {
  v <- as.character(unlist(x %||% character(0), use.names = FALSE))
  v <- trimws(v[!is.na(v)])
  v[nzchar(v)]
}

.codif_agrupar_rango <- function(r) {
  if (is.null(r) || !is.list(r)) return(NULL)
  lo <- .codif_agrupar_num(r$min)
  hi <- .codif_agrupar_num(r$max)
  if (is.na(lo) && is.na(hi)) return(NULL)
  list(min = if (is.na(lo)) NULL else lo, max = if (is.na(hi)) NULL else hi)
}

.codif_agrupar_en_rango <- function(rango, x) {
  if (is.null(rango) || is.na(x) || !is.finite(x)) return(FALSE)
  lo <- rango$min %||% -Inf
  hi <- rango$max %||% Inf
  x >= lo && x <= hi
}

.codif_agrupar_invalida <- function(msg, details = NULL) {
  stop_api(400, "E_CODIF_AGRUPACION_INVALIDA", msg, details)
}

# ---- Normalización y validación de la spec ------------------------------------

.codif_agrupar_normalizar_categoria <- function(cat) {
  codigo <- .codif_agrupar_scalar(cat$codigo, "")
  list(
    codigo = codigo,
    etiqueta = .codif_agrupar_scalar(cat$etiqueta, codigo),
    codigos = unique(.codif_agrupar_codigo_chr(.codif_agrupar_chr_vec(cat$codigos))),
    rango = .codif_agrupar_rango(cat$rango),
    otros_textos = unique(.codif_agrupar_chr_vec(cat$otros_textos)),
    otros_numerico = .codif_agrupar_flag(cat$otros_numerico),
    otros_resto = .codif_agrupar_flag(cat$otros_resto),
    resto = .codif_agrupar_flag(cat$resto)
  )
}

#' Normaliza una spec de agrupación a su forma canónica (sin validar).
#' @keywords internal
codif_agrupar_normalizar_spec <- function(spec, parent = NULL) {
  spec <- spec %||% list()
  parent <- .codif_agrupar_scalar(parent %||% spec$parent, "")
  text_col <- .codif_agrupar_scalar(spec$text_col, "")
  codigo_otro <- .codif_agrupar_scalar(spec$codigo_otro, "")
  cats <- lapply(spec$categorias %||% list(), .codif_agrupar_normalizar_categoria)
  list(
    parent = parent,
    target = .codif_agrupar_scalar(spec$target, ""),
    text_col = if (nzchar(text_col)) text_col else NULL,
    codigo_otro = if (nzchar(codigo_otro)) .codif_agrupar_codigo_chr(codigo_otro) else NULL,
    categorias = cats
  )
}

#' Valida una spec de agrupación ya normalizada.
#'
#' @param spec Spec normalizada (`codif_agrupar_normalizar_spec`).
#' @param ocupados Vector nombrado `nombre -> dueño` con las columnas que otra
#'   codificación de la misma base reserva (aplicada o no).
#' @return La spec, invisible. Corta con `E_CODIF_AGRUPACION_INVALIDA` (400) o
#'   `E_CODIF_AGRUPACION_TARGET_OCUPADO` (409).
#' @keywords internal
codif_agrupar_validar_spec <- function(spec, ocupados = character(0)) {
  parent <- spec$parent %||% ""
  if (!nzchar(parent)) .codif_agrupar_invalida("La agrupación necesita la variable original ('parent').")
  target <- spec$target %||% ""
  if (!nzchar(target)) .codif_agrupar_invalida("La agrupación necesita el nombre de la variable nueva ('target').")
  if (!grepl("^[A-Za-z_][A-Za-z0-9_.]*$", target)) {
    .codif_agrupar_invalida(sprintf(
      "«%s» no es un nombre de variable válido: usa letras, números y guion bajo, sin espacios.", target
    ))
  }
  if (identical(tolower(target), tolower(parent))) {
    .codif_agrupar_invalida("La variable nueva no puede llamarse igual que la original: la original no se modifica.")
  }
  ocupado_por <- ocupados[tolower(names(ocupados)) == tolower(target)]
  if (length(ocupado_por)) {
    stop_api(409, "E_CODIF_AGRUPACION_TARGET_OCUPADO", sprintf(
      "El nombre «%s» ya lo reserva %s. Elige otro nombre, por ejemplo «%s».",
      target, ocupado_por[[1]], .codif_agrupar_sugerir_target(parent, ocupados)
    ), list(target = target, sugerido = .codif_agrupar_sugerir_target(parent, ocupados)))
  }

  cats <- spec$categorias %||% list()
  if (!length(cats)) .codif_agrupar_invalida("La agrupación necesita al menos una categoría.")
  codigos_cat <- vapply(cats, function(c) c$codigo, character(1))
  if (any(!nzchar(codigos_cat))) .codif_agrupar_invalida("Cada categoría necesita un código.")
  if (any(!grepl("^[A-Za-z0-9_.-]+$", codigos_cat))) {
    .codif_agrupar_invalida("Los códigos de categoría no pueden llevar espacios ni símbolos.")
  }
  dup <- unique(codigos_cat[duplicated(codigos_cat)])
  if (length(dup)) .codif_agrupar_invalida(sprintf("El código «%s» se repite en dos categorías.", dup[[1]]))
  if (sum(vapply(cats, function(c) isTRUE(c$resto), logical(1))) > 1L) {
    .codif_agrupar_invalida("Sólo una categoría puede recoger «el resto» de códigos.")
  }
  if (sum(vapply(cats, function(c) isTRUE(c$otros_resto), logical(1))) > 1L) {
    .codif_agrupar_invalida("Sólo una categoría puede recoger el resto de textos de «Otro».")
  }

  origen <- unlist(lapply(cats, function(c) c$codigos), use.names = FALSE)
  dup_o <- unique(origen[duplicated(origen)])
  if (length(dup_o)) {
    .codif_agrupar_invalida(sprintf("El código original «%s» está asignado a dos categorías.", dup_o[[1]]))
  }
  textos <- .normalize_text(unlist(lapply(cats, function(c) c$otros_textos), use.names = FALSE))
  textos <- textos[nzchar(textos)]
  dup_t <- unique(textos[duplicated(textos)])
  if (length(dup_t)) {
    .codif_agrupar_invalida(sprintf("El texto «%s» está asignado a dos categorías.", dup_t[[1]]))
  }
  for (c in cats) {
    r <- c$rango
    if (!is.null(r) && !is.null(r$min) && !is.null(r$max) && r$min > r$max) {
      .codif_agrupar_invalida(sprintf("El rango de «%s» tiene el mínimo mayor que el máximo.", c$etiqueta))
    }
    if (isTRUE(c$otros_numerico) && is.null(r)) {
      .codif_agrupar_invalida(sprintf(
        "«%s» clasifica textos numéricos de «Otro» pero no declara un rango.", c$etiqueta
      ))
    }
  }
  usa_otro <- any(vapply(cats, function(c) {
    length(c$otros_textos) > 0L || isTRUE(c$otros_numerico) || isTRUE(c$otros_resto)
  }, logical(1)))
  if (usa_otro && (is.null(spec$text_col) || is.null(spec$codigo_otro))) {
    .codif_agrupar_invalida(
      "Para clasificar los textos de «Otro» la agrupación necesita 'text_col' y 'codigo_otro'."
    )
  }
  invisible(spec)
}

# ---- Motor puro ----------------------------------------------------------------

# Un rango compara el VALOR del código (años, tramos). No captura el código de
# «Otro» —su número no es un año— ni, si el rango es abierto, un especial 80–99:
# «2021 o antes» no debe tragarse el 88 «Otro» ni el 99 «No responde». Esos se
# agrupan por `codigos` explícitos o caen en `resto`.
.codif_agrupar_rango_aplica <- function(rango, v, v_num, codigo_otro) {
  if (is.null(rango) || is.na(v_num)) return(FALSE)
  if (!is.na(codigo_otro) && identical(v, codigo_otro)) return(FALSE)
  abierto <- is.null(rango$min) || is.null(rango$max)
  if (abierto && v_num >= 80 && v_num < 100) return(FALSE)
  .codif_agrupar_en_rango(rango, v_num)
}

.codif_agrupar_por_codigo <- function(cats, v, codigo_otro = NA_character_) {
  v_num <- suppressWarnings(as.numeric(v))
  for (c in cats) {
    if (v %in% c$codigos) return(c$codigo)
    if (.codif_agrupar_rango_aplica(c$rango, v, v_num, codigo_otro)) return(c$codigo)
  }
  # «resto» junta los códigos sustantivos que no se nombraron. Un especial 80–99
  # («Otro», «No sabe», «No responde») no es «Otras regiones»: se agrupa sólo si
  # la categoría lo nombra en `codigos`.
  if (!is.na(v_num) && v_num >= 80 && v_num < 100) return(NA_character_)
  for (c in cats) if (isTRUE(c$resto)) return(c$codigo)
  NA_character_
}

.codif_agrupar_por_texto <- function(cats, texto) {
  norm <- .normalize_text(texto)
  for (c in cats) {
    if (length(c$otros_textos) && norm %in% .normalize_text(c$otros_textos)) return(c$codigo)
  }
  if (grepl("^-?[0-9]+$", trimws(texto))) {
    n <- suppressWarnings(as.numeric(trimws(texto)))
    for (c in cats) {
      if (isTRUE(c$otros_numerico) && .codif_agrupar_en_rango(c$rango, n)) return(c$codigo)
    }
  }
  for (c in cats) if (isTRUE(c$otros_resto)) return(c$codigo)
  NA_character_
}

#' Evalúa una agrupación sobre un data.frame.
#'
#' Función pura: no lee sesión ni disco y no modifica `df`.
#'
#' @param df data.frame con la variable `spec$parent` (y `spec$text_col` si
#'   la agrupación clasifica textos de «Otro»).
#' @param spec Spec de agrupación (se normaliza aquí).
#' @return Vector character de largo `nrow(df)` con el código de categoría o NA.
#' @keywords internal
codif_agrupar_df <- function(df, spec) {
  spec <- codif_agrupar_normalizar_spec(spec)
  n <- nrow(df)
  if (!nzchar(spec$parent) || !(spec$parent %in% names(df))) return(rep(NA_character_, n))
  v <- .codif_agrupar_codigo_chr(df[[spec$parent]])
  texto <- if (!is.null(spec$text_col) && spec$text_col %in% names(df)) {
    t <- trimws(as.character(df[[spec$text_col]]))
    t[is.na(t)] <- ""
    t
  } else rep("", n)
  cats <- spec$categorias
  otro <- spec$codigo_otro %||% NA_character_

  claves <- paste(ifelse(is.na(v), "\001NA", v), texto, sep = "\002")
  unicas <- !duplicated(claves)
  res_u <- vapply(which(unicas), function(i) {
    vi <- v[[i]]
    if (is.na(vi)) return(NA_character_)
    if (!is.na(otro) && identical(vi, otro) && nzchar(texto[[i]])) {
      hit <- .codif_agrupar_por_texto(cats, texto[[i]])
      if (!is.na(hit)) return(hit)
    }
    .codif_agrupar_por_codigo(cats, vi, otro)
  }, character(1))
  unname(res_u[match(claves, claves[unicas])])
}

# Inserta (o reescribe) la columna `target` en una hoja. Reaplicar no duplica:
# si la columna ya existe se retira antes de reinsertarla junto a su origen
# (después del verbatim de «Otro» cuando existe, como `.add_recoded_q()`).
#' @keywords internal
ppra_agrupar_en_hoja <- function(df, spec) {
  spec <- codif_agrupar_normalizar_spec(spec)
  if (!(spec$parent %in% names(df))) return(df)
  vals <- codif_agrupar_df(df, spec)
  if (spec$target %in% names(df)) df[[spec$target]] <- NULL
  df[[spec$target]] <- vals
  ancla <- spec$parent
  if (!is.null(spec$text_col) && spec$text_col %in% names(df) &&
      match(spec$text_col, names(df)) > match(spec$parent, names(df))) {
    ancla <- spec$text_col
  }
  insert_right_of(df, ancla, spec$target)
}

# Paso de instrumento: una select_one por agrupación con su lista propia.
#' @keywords internal
.ppra_agrupar_instrumento <- function(survey, choices, agrupaciones, lab_col_s, lab_col_c,
                                      choices_order = "original_first") {
  new_names <- character(0)
  new_lists <- character(0)
  for (sp in agrupaciones %||% list()) {
    sp <- codif_agrupar_normalizar_spec(sp)
    if (!nzchar(sp$parent) || !nzchar(sp$target) || !length(sp$categorias)) next
    codes <- vapply(sp$categorias, function(c) c$codigo, character(1))
    labels <- vapply(sp$categorias, function(c) c$etiqueta, character(1))
    names(labels) <- codes
    res <- .add_recoded_q(
      survey, choices,
      base_name = sp$parent,
      kind = "one",
      list_name_hint = paste0("lst_", sp$target),
      tokens_from_data = codes,
      labels_from_data = labels,
      lab_col_s = lab_col_s,
      lab_col_c = lab_col_c,
      choices_order = choices_order,
      insert_below_original = FALSE,
      copy_from_original = FALSE,
      new_name_override = sp$target
    )
    survey <- res$survey
    choices <- res$choices
    new_names <- c(new_names, res$new_name)
    new_lists <- c(new_lists, res$list_name)
  }
  list(survey = survey, choices = choices, new_names = new_names, new_lists = new_lists)
}

# ---- Estado por base -----------------------------------------------------------

.codif_agrupar_base <- function(sid, base = NULL) {
  base <- .codif_agrupar_scalar(base, "")
  if (nzchar(base)) return(.codif_matrix_selected_bases(sid, base)[[1]])
  .codif_agrupar_scalar(codif_source_active(sid), "default")
}

.codif_agrupar_specs <- function(sid, base) {
  out <- codif_get(sid, "agrupaciones", source = base) %||% list()
  if (is.list(out)) out else list()
}

#' Nombres que otra codificación de la base reserva, aplicada o no.
#'
#' Un catálogo `grupos_recod[[parent]]` o una familia select_one en modo padre
#' reservan `<parent>_recod` aunque nunca se hayan aplicado (caso real de
#' HSyVBG 2026: P4 y P8 con catálogo sin aplicar).
#' @return Vector nombrado `nombre -> descripción del dueño`.
#' @keywords internal
.codif_agrupar_ocupados <- function(state, parent_propio = "") {
  out <- character(0)
  add <- function(nm, dueno) {
    nm <- .codif_agrupar_scalar(nm, "")
    if (nzchar(nm) && !(nm %in% names(out))) out[[nm]] <<- dueno
  }
  grupos <- state$grupos_recod %||% list()
  con_grupos <- names(grupos)[vapply(grupos, function(g) is.list(g) && length(g) > 0L, logical(1))]
  rows <- (state$familias_draft %||% list())$rows %||% list()
  cubiertas <- character(0)
  for (r in rows) {
    parent <- .codif_agrupar_scalar(r$parent, "")
    if (!nzchar(parent)) next
    tipo <- .codif_agrupar_scalar(r$tipo, "")
    modo <- tolower(.codif_agrupar_scalar(r$modo_so, ""))
    text_col <- .codif_agrupar_scalar(r$text_col, "")
    parent_col <- .codif_agrupar_scalar(r$parent_col, "")
    claves <- unique(c(parent, parent_col, text_col))
    claves <- claves[nzchar(claves)]
    tiene <- any(claves %in% con_grupos)
    dueno <- sprintf("la codificación de «%s»", parent)
    if (identical(tipo, "select_one") && identical(modo, "padre")) {
      add(paste0(parent, "_recod"), dueno)
    } else if (tiene) {
      if (identical(tipo, "select_one") && identical(modo, "hijo") && nzchar(text_col)) {
        add(paste0(text_col, "_recod"), dueno)
      } else if (identical(tipo, "select_one")) {
        # Sin modo declarado la migración legacy puede resolver cualquiera de
        # los dos: se reservan ambos.
        add(paste0(parent, "_recod"), dueno)
        if (nzchar(text_col)) add(paste0(text_col, "_recod"), dueno)
      } else if (identical(tipo, "text")) {
        add(paste0(if (nzchar(text_col)) text_col else parent, "_recod"), dueno)
      } else if (identical(tipo, "select_multiple")) {
        add(paste0(if (nzchar(parent_col)) parent_col else parent, "_recod"), dueno)
      } else {
        add(paste0(parent, "_recod"), dueno)
      }
    }
    if (tiene) cubiertas <- c(cubiertas, claves)
  }
  for (k in setdiff(con_grupos, cubiertas)) add(paste0(k, "_recod"), sprintf("la codificación de «%s»", k))
  for (p in names(state$agrupaciones %||% list())) {
    if (identical(p, parent_propio)) next
    add((state$agrupaciones[[p]] %||% list())$target, sprintf("la agrupación de «%s»", p))
  }
  out
}

.codif_agrupar_sugerir_target <- function(parent, ocupados) {
  cands <- c(paste0(parent, "_recod"), paste0(parent, "_agrup"),
             paste0(parent, "_agrup", 2:9))
  libres <- cands[!(tolower(cands) %in% tolower(names(ocupados)))]
  if (length(libres)) libres[[1]] else paste0(parent, "_agrup_", format(Sys.time(), "%H%M%S"))
}

.codif_agrupar_text_col_sugerida <- function(state, parent, data_cols) {
  for (r in (state$familias_draft %||% list())$rows %||% list()) {
    if (identical(.codif_agrupar_scalar(r$parent, ""), parent)) {
      tc <- .codif_agrupar_scalar(r$text_col, "")
      if (nzchar(tc) && tc %in% data_cols) return(tc)
    }
  }
  for (cand in paste0(parent, c("_other", "_otro", "_otros", "_esp", "_especifique"))) {
    if (cand %in% data_cols) return(cand)
  }
  NULL
}

# ---- Payloads de los endpoints -------------------------------------------------

# Forma de cable de una spec: el serializador unboxed convierte NULL en `{}` y un
# vector de largo 1 en escalar. Aquí los faltantes viajan como `null` (NA con
# `na = "null"`) y las listas de códigos/textos siempre como arreglo.
.codif_agrupar_spec_wire <- function(spec) {
  if (is.null(spec)) return(NA)
  sp <- codif_agrupar_normalizar_spec(spec)
  list(
    parent = sp$parent,
    target = sp$target,
    text_col = sp$text_col %||% NA_character_,
    codigo_otro = sp$codigo_otro %||% NA_character_,
    categorias = lapply(sp$categorias, function(c) list(
      codigo = c$codigo,
      etiqueta = c$etiqueta,
      codigos = as.list(c$codigos),
      rango = if (is.null(c$rango)) NA else list(
        min = c$rango$min %||% NA_real_, max = c$rango$max %||% NA_real_
      ),
      otros_textos = as.list(c$otros_textos),
      otros_numerico = isTRUE(c$otros_numerico),
      otros_resto = isTRUE(c$otros_resto),
      resto = isTRUE(c$resto)
    ))
  )
}

#' GET /api/codificacion/agrupacion
#' @keywords internal
codif_agrupacion_get <- function(sid, parent, base = NULL) {
  parent <- .codif_agrupar_scalar(parent, "")
  if (!nzchar(parent)) stop_api(400, "E_NO_PARENT", "Falta 'parent' como query param.")
  base <- .codif_agrupar_base(sid, base)
  data_df <- codif_data_cached(sid, base)
  if (!(parent %in% names(data_df))) {
    stop_api(404, "E_CODIF_AGRUPACION_PARENT",
             sprintf("La variable «%s» no está en la base «%s».", parent, base))
  }
  inst <- tryCatch(codif_inst_cached(sid, base), error = function(e) NULL)
  state <- codif_snapshot(sid, base)
  spec <- (state$agrupaciones %||% list())[[parent]] %||% NULL
  ocupados <- .codif_agrupar_ocupados(state, parent_propio = parent)

  v <- .codif_agrupar_codigo_chr(data_df[[parent]])
  tab <- table(v[!is.na(v)])
  labels <- if (!is.null(inst)) .choices_lookup(inst, .codif_list_name_for_var(inst, parent)) else character(0)
  codes <- unique(c(names(labels), names(tab)))
  codigos <- lapply(codes, function(cd) list(
    codigo = cd,
    etiqueta = if (cd %in% names(labels)) unname(labels[[cd]]) else cd,
    n = as.integer(if (cd %in% names(tab)) tab[[cd]] else 0L)
  ))

  text_col <- (spec %||% list())$text_col %||%
    .codif_agrupar_text_col_sugerida(state, parent, names(data_df))
  textos <- list()
  if (!is.null(text_col) && text_col %in% names(data_df)) {
    t <- trimws(as.character(data_df[[text_col]]))
    otro <- .codif_agrupar_codigo_chr((spec %||% list())$codigo_otro %||% NA)
    keep <- !is.na(t) & nzchar(t)
    if (!is.na(otro)) keep <- keep & !is.na(v) & v == otro
    t <- t[keep]
    if (length(t)) {
      norm <- .normalize_text(t)
      grupos <- split(t, norm)
      textos <- lapply(grupos, function(g) {
        tt <- sort(table(g), decreasing = TRUE)
        list(texto = names(tt)[[1]], n = as.integer(length(g)))
      })
      textos <- unname(textos[order(-vapply(textos, function(x) x$n, integer(1)))])
    }
  }

  list(
    ok = TRUE,
    base = base,
    parent = parent,
    parent_label = if (!is.null(inst)) .codif_var_label(inst, parent, parent) else parent,
    spec = .codif_agrupar_spec_wire(spec),
    target_sugerido = (spec %||% list())$target %||% .codif_agrupar_sugerir_target(parent, ocupados),
    text_col_sugerida = text_col %||% NA_character_,
    nombres_ocupados = as.list(names(ocupados)),
    codigos = codigos,
    textos_otro = textos
  )
}

#' POST /api/codificacion/agrupacion — guarda o borra (spec NULL).
#' @keywords internal
codif_agrupacion_set <- function(sid, parent, spec, base = NULL) {
  parent <- .codif_agrupar_scalar(parent %||% (spec %||% list())$parent, "")
  if (!nzchar(parent)) stop_api(400, "E_NO_PARENT", "Falta 'parent'.")
  base <- .codif_agrupar_base(sid, base)
  todas <- .codif_agrupar_specs(sid, base)
  if (is.null(spec) || (is.list(spec) && !length(spec))) {
    todas[[parent]] <- NULL
    codif_set(sid, "agrupaciones", todas, source = base)
    return(list(ok = TRUE, base = base, parent = parent, spec = NA))
  }
  norm <- codif_agrupar_normalizar_spec(spec, parent = parent)
  norm$parent <- parent
  data_df <- codif_data_cached(sid, base)
  if (!(parent %in% names(data_df))) {
    stop_api(404, "E_CODIF_AGRUPACION_PARENT",
             sprintf("La variable «%s» no está en la base «%s».", parent, base))
  }
  if (!is.null(norm$text_col) && !(norm$text_col %in% names(data_df))) {
    .codif_agrupar_invalida(sprintf("La columna de texto «%s» no está en la base.", norm$text_col))
  }
  state <- codif_snapshot(sid, base)
  ocupados <- .codif_agrupar_ocupados(state, parent_propio = parent)
  if (!nzchar(norm$target)) norm$target <- .codif_agrupar_sugerir_target(parent, ocupados)
  if (norm$target %in% names(data_df) &&
      !identical(norm$target, ((state$agrupaciones %||% list())[[parent]] %||% list())$target) &&
      !grepl("_(recod|agrup[0-9]*)$", norm$target)) {
    stop_api(409, "E_CODIF_AGRUPACION_TARGET_OCUPADO", sprintf(
      "La base ya tiene una columna «%s». Elige otro nombre, por ejemplo «%s».",
      norm$target, .codif_agrupar_sugerir_target(parent, ocupados)
    ))
  }
  codif_agrupar_validar_spec(norm, ocupados)
  todas[[parent]] <- norm
  codif_set(sid, "agrupaciones", todas, source = base)
  valores <- codif_agrupar_df(data_df, norm)
  n_por_cat <- lapply(norm$categorias, function(c) list(
    codigo = c$codigo, etiqueta = c$etiqueta, n = as.integer(sum(valores == c$codigo, na.rm = TRUE))
  ))
  list(
    ok = TRUE, base = base, parent = parent, spec = .codif_agrupar_spec_wire(norm),
    vista_previa = list(
      categorias = n_por_cat,
      n_sin_categoria = as.integer(sum(is.na(valores) & !is.na(.codif_agrupar_codigo_chr(data_df[[parent]]))))
    )
  )
}

# ---- Aplicación ----------------------------------------------------------------

#' Specs válidas para aplicar en una base (serializables para el worker callr).
#' @keywords internal
codif_agrupaciones_para_aplicar <- function(sid, base = NULL) {
  base <- .codif_agrupar_scalar(base, "")
  if (!nzchar(base)) base <- .codif_agrupar_scalar(codif_source_active(sid), "default")
  specs <- .codif_agrupar_specs(sid, base)
  out <- list()
  for (p in names(specs)) {
    sp <- codif_agrupar_normalizar_spec(specs[[p]], parent = p)
    if (!nzchar(sp$target) || !length(sp$categorias)) next
    out[[length(out) + 1L]] <- sp
  }
  out
}

#' Ítems del plan de adaptación (paso «Adaptar») para las agrupaciones.
#' @keywords internal
.codif_agrupar_plan_items <- function(sid, data_df = NULL, inst = NULL) {
  specs <- codif_agrupaciones_para_aplicar(sid)
  if (!length(specs)) return(list())
  lapply(specs, function(sp) {
    valores <- if (is.data.frame(data_df)) codif_agrupar_df(data_df, sp) else character(0)
    nuevos <- lapply(sp$categorias, function(c) list(
      codigo = c$codigo, etiqueta = c$etiqueta,
      n_respuestas = as.integer(sum(valores == c$codigo, na.rm = TRUE))
    ))
    list(
      parent = sp$parent,
      parent_label = if (!is.null(inst)) .codif_var_label(inst, sp$parent, sp$parent) else sp$parent,
      tipo = "agrupacion",
      modo_so = "",
      text_col = sp$text_col %||% "",
      nueva_variable = sp$target,
      n_grupos = as.integer(length(sp$categorias)),
      n_codigos_nuevos = as.integer(length(sp$categorias)),
      n_codigos_reutilizados = 0L,
      n_respuestas_afectadas = as.integer(sum(!is.na(valores))),
      codigos_nuevos = nuevos,
      codigos_reutilizados = list(),
      bridge_soportado = TRUE
    )
  })
}

# Nombres de las variables que producen las agrupaciones de una base.
.codif_agrupar_targets_base <- function(codif_state) {
  specs <- (codif_state %||% list())$agrupaciones %||% list()
  out <- vapply(specs, function(sp) .codif_agrupar_scalar((sp %||% list())$target, ""), character(1))
  unname(out[nzchar(out)])
}

# ---- Configuración JSON (export / import) --------------------------------------

#' @keywords internal
codif_agrupaciones_export <- function(sid, sources) {
  out <- list()
  for (src in sources) {
    specs <- .codif_agrupar_specs(sid, src)
    for (p in names(specs)) {
      out[[length(out) + 1L]] <- list(
        base_id = .codif_config_scalar(src, "default"),
        parent = p,
        spec = .codif_agrupar_spec_wire(specs[[p]])
      )
    }
  }
  out
}

.codif_agrupar_import_bases <- function(sid, bundle, item) {
  target_bases <- .codif_config_base_names(sid)
  exported <- list(base_id = item$base_id %||% "")
  bases <- .codif_config_candidate_target_bases(bundle, exported, target_bases)
  parent <- .codif_agrupar_scalar(item$parent %||% (item$spec %||% list())$parent, "")
  Filter(function(b) {
    cols <- tryCatch(names(codif_data_cached(sid, b)), error = function(e) character(0))
    parent %in% cols
  }, bases)
}

#' Vista previa de las agrupaciones de un bundle de configuración.
#' @keywords internal
codif_agrupaciones_preview <- function(sid, bundle) {
  out <- list()
  for (item in bundle$agrupaciones %||% list()) {
    parent <- .codif_agrupar_scalar(item$parent %||% (item$spec %||% list())$parent, "")
    if (!nzchar(parent)) next
    bases <- .codif_agrupar_import_bases(sid, bundle, item)
    if (!length(bases)) {
      out[[length(out) + 1L]] <- list(
        source_base = .codif_agrupar_scalar(item$base_id, ""), parent = parent,
        target_base = NULL, status = "missing"
      )
      next
    }
    for (b in bases) {
      existe <- !is.null(.codif_agrupar_specs(sid, b)[[parent]])
      out[[length(out) + 1L]] <- list(
        source_base = .codif_agrupar_scalar(item$base_id, ""), parent = parent,
        target_base = b, status = if (existe) "conflict" else "compatible"
      )
    }
  }
  out
}

#' Importa las agrupaciones de un bundle (reemplaza la de cada parent).
#' @return list(importadas, omitidas) con motivo por omisión.
#' @keywords internal
codif_agrupaciones_import <- function(sid, bundle) {
  importadas <- list()
  omitidas <- list()
  for (item in bundle$agrupaciones %||% list()) {
    parent <- .codif_agrupar_scalar(item$parent %||% (item$spec %||% list())$parent, "")
    if (!nzchar(parent)) next
    bases <- .codif_agrupar_import_bases(sid, bundle, item)
    if (!length(bases)) {
      omitidas[[length(omitidas) + 1L]] <- list(parent = parent, motivo = "La variable no está en ninguna base.")
      next
    }
    for (b in bases) {
      res <- tryCatch(
        codif_agrupacion_set(sid, parent, item$spec, base = b),
        api_error = function(e) e
      )
      if (inherits(res, "api_error")) {
        omitidas[[length(omitidas) + 1L]] <- list(parent = parent, base = b, motivo = conditionMessage(res))
      } else {
        importadas[[length(importadas) + 1L]] <- list(parent = parent, base = b, target = res$spec$target)
      }
    }
  }
  list(importadas = importadas, omitidas = omitidas)
}
