# =============================================================================
# Explorador de variables — ficha de una pregunta (E10 «En el formulario», E11 «Lo que se ve en los datos»)
# =============================================================================
# GET /api/validacion/v2/explorar/ficha?var=&fuente=raw|final  (X-Base-Nombre elige la base; sin él, la activa)
# Contrato congelado (docs/qa/checklist-explorador-variables-2026-11-02.md):
#   { ok, var, label, hint, tipo, tipo_xlsform, lista, grupo, relevant, constraint, constraint_message, required,
#     choice_filter, appearance, abre, version_formulario, opciones, datos }
# Base: la base elegida por `fuente` SIN filtros del explorador (la ficha describe la pregunta, no un recorte).
#   - opciones: las de la lista con su n observado (so: casos con ese código; sm: casos que marcan la opción). Sin
#     lista, los códigos observados. Num/fecha/texto: [].
#   - datos.n_responden: los que responden según `.explorador_leer`; n_sin_respuesta = n_total − n_responden.
#   - datos.n_fuera_de_lista: CASOS con al menos un código que no está en la lista (0 si la variable no tiene lista).
#   - datos.n_otro_textos: respuestas no vacías sumadas sobre las variables de texto que abre (`abre`); null si no
#     abre ninguna de texto.
# Lo ausente viaja como `NA` (el serializer lo escribe `null`); `NULL` saldría `{}`.

#' Survey con el `type` completo («select_one lista»), venga crudo (`survey_raw`) o ya separado en type + list_name
#' @keywords internal
.explorador_ficha_survey <- function(instrumento) {
  raw <- instrumento$survey_raw %||% NULL
  if (is.data.frame(raw) && all(c("type", "name") %in% names(raw))) return(as.data.frame(raw, stringsAsFactors = FALSE))
  surv <- instrumento$survey %||% NULL
  if (!is.data.frame(surv) || !all(c("type", "name") %in% names(surv))) return(NULL)
  surv <- as.data.frame(surv, stringsAsFactors = FALSE)
  if ("list_name" %in% names(surv)) {
    ln <- trimws(as.character(surv$list_name))
    tp <- trimws(as.character(surv$type))
    pegar <- !is.na(ln) & nzchar(ln) & !is.na(tp) & !grepl("\\s", tp)
    tp[pegar] <- paste(tp[pegar], ln[pegar])
    surv$type <- tp
  }
  surv
}

#' Celda de texto de una fila del survey: la columna exacta o su variante con idioma (`hint::Español (es)`); NA si vacía
#' @keywords internal
.explorador_ficha_celda <- function(surv, idx, col) {
  if (is.null(surv) || is.na(idx)) return(NA_character_)
  cols <- c(names(surv)[tolower(names(surv)) == col], grep(paste0("^", col, "::"), names(surv), value = TRUE,
                                                            ignore.case = TRUE))
  for (cn in unique(cols)) {
    v <- trimws(as.character(surv[[cn]][idx]))
    if (length(v) && !is.na(v) && nzchar(v)) {
      Encoding(v) <- "UTF-8"
      return(v)
    }
  }
  NA_character_
}

#' `required` del XLSForm como lógico; NA si el formulario no trae la columna
#' @keywords internal
.explorador_ficha_required <- function(surv, idx) {
  if (is.null(surv) || is.na(idx) || !any(tolower(names(surv)) == "required")) return(NA)
  v <- .explorador_ficha_celda(surv, idx, "required")
  if (is.na(v)) return(FALSE)
  tolower(v) %in% c("yes", "true", "true()", "si", "sí", "1")
}

#' Grupo contenedor más cercano (begin_group / begin_repeat abierto sobre la fila); NA si está en la raíz
#' @keywords internal
.explorador_ficha_grupo <- function(surv, idx) {
  if (is.null(surv) || is.na(idx) || idx < 2L) return(NA)
  tipos <- tolower(trimws(as.character(surv$type)))
  pila <- integer(0)
  for (i in seq_len(idx - 1L)) {
    t <- tipos[i]
    if (is.na(t)) next
    if (grepl("^begin[_ ](group|repeat)$", t)) pila <- c(pila, i)
    else if (grepl("^end[_ ](group|repeat)$", t) && length(pila)) pila <- pila[-length(pila)]
  }
  if (!length(pila)) return(NA)
  g <- pila[length(pila)]
  nm <- trimws(as.character(surv$name[g]))
  lab <- .explorador_ficha_celda(surv, g, "label")
  list(name = nm, label = if (is.na(lab)) nm else lab)
}

#' Variables cuyo `relevant` menciona `${var}` (p. ej. el «Otro, especifique»), con su tipo XLSForm
#' @keywords internal
.explorador_ficha_abre <- function(surv, var, instrumento) {
  if (is.null(surv) || !any(tolower(names(surv)) == "relevant")) return(list())
  rel_col <- names(surv)[tolower(names(surv)) == "relevant"][1]
  rel <- as.character(surv[[rel_col]])
  hit <- which(!is.na(rel) & grepl(paste0("${", var, "}"), rel, fixed = TRUE))
  nms <- trimws(as.character(surv$name[hit]))
  keep <- !is.na(nms) & nzchar(nms) & nms != var
  hit <- hit[keep]
  lapply(hit, function(i) list(
    var = trimws(as.character(surv$name[i])),
    label = .explorar_label_var(trimws(as.character(surv$name[i])), instrumento),
    .tipo = tolower(trimws(as.character(surv$type[i])))
  ))
}

#' `version` de la hoja settings, si el instrumento la trae
#' @keywords internal
.explorador_ficha_version <- function(instrumento) {
  st <- instrumento$settings %||% instrumento$meta$settings %||% NULL
  if (is.null(st)) return(NA_character_)
  v <- if (is.data.frame(st)) {
    if (nrow(st) && "version" %in% names(st)) st$version[1] else NA
  } else st$version %||% NA
  v <- trimws(as.character(v)[1])
  if (is.na(v) || !nzchar(v)) NA_character_ else v
}

#' Ficha de una variable (contrato del encabezado) sobre la base de la fuente elegida
#' @keywords internal
explorador_ficha <- function(data, var, instrumento) {
  surv <- .explorador_ficha_survey(instrumento)
  idx <- .explorar_match_row(surv, var)
  en_datos <- var %in% names(data) || length(.explorador_dummies(data, var)$cols) > 0L
  if (is.na(idx) && !en_datos) {
    stop_api(404, "E_EXPLORAR_VAR_NOT_FOUND",
             sprintf("La variable '%s' no está en el formulario ni en la base.", var), details = list(var = var))
  }

  tipo_full <- .explorador_ficha_celda(surv, idx, "type")
  tipo_xlsform <- if (is.na(tipo_full)) NA_character_ else strsplit(tipo_full, "\\s+")[[1]][1]
  lista <- .explorar_list_name_for_var(var, instrumento)
  if (!nzchar(lista) && !is.na(tipo_full) && grepl("^select_(one|multiple)\\s+", tipo_full)) {
    lista <- trimws(sub("^select_(one|multiple)\\s+", "", tipo_full))
  }

  lec <- .explorador_leer(data, var, instrumento)
  opciones <- list()
  n_fuera <- 0L
  if (lec$tipo %in% c("so", "sm")) {
    niv <- lec$niveles
    n_op <- if (identical(lec$tipo, "sm")) colSums(lec$mat) else
      vapply(niv$codigo, function(cd) sum(lec$codigo == cd, na.rm = TRUE), numeric(1))
    con_lista <- any(niv$en_lista)
    mostrar <- if (con_lista) niv$en_lista else rep(TRUE, nrow(niv))
    opciones <- lapply(which(mostrar), function(i) list(
      codigo = niv$codigo[i], etiqueta = niv$etiqueta[i], n = as.integer(n_op[i])
    ))
    if (con_lista && any(!niv$en_lista)) {
      fuera <- niv$codigo[!niv$en_lista]
      n_fuera <- if (identical(lec$tipo, "sm")) {
        sum(rowSums(lec$mat[, fuera, drop = FALSE]) > 0)
      } else sum(lec$codigo %in% fuera)
    }
  }

  abre <- .explorador_ficha_abre(surv, var, instrumento)
  de_texto <- Filter(function(a) grepl("^text(\\s|$)", a$.tipo), abre)
  n_otro <- if (length(de_texto)) {
    sum(vapply(de_texto, function(a) {
      if (!a$var %in% names(data)) return(0)
      v <- trimws(as.character(data[[a$var]]))
      sum(!.explorar_is_missing_value(data[[a$var]]) & nzchar(v))
    }, numeric(1)))
  } else NA

  n_total <- nrow(data)
  n_resp <- sum(lec$valido)
  list(
    ok = TRUE,
    var = var,
    label = .explorar_label_var(var, instrumento),
    hint = .explorador_ficha_celda(surv, idx, "hint"),
    tipo = lec$tipo,
    tipo_xlsform = tipo_xlsform,
    lista = if (nzchar(lista)) lista else NA_character_,
    grupo = .explorador_ficha_grupo(surv, idx),
    relevant = .explorador_ficha_celda(surv, idx, "relevant"),
    constraint = .explorador_ficha_celda(surv, idx, "constraint"),
    constraint_message = .explorador_ficha_celda(surv, idx, "constraint_message"),
    required = .explorador_ficha_required(surv, idx),
    choice_filter = .explorador_ficha_celda(surv, idx, "choice_filter"),
    appearance = .explorador_ficha_celda(surv, idx, "appearance"),
    abre = lapply(abre, function(a) list(var = a$var, label = a$label)),
    version_formulario = .explorador_ficha_version(instrumento),
    opciones = opciones,
    datos = list(
      n_total = as.integer(n_total),
      n_responden = as.integer(n_resp),
      n_sin_respuesta = as.integer(n_total - n_resp),
      n_fuera_de_lista = as.integer(n_fuera),
      n_otro_textos = if (is.na(n_otro)) NA else as.integer(n_otro)
    )
  )
}

# GET /api/validacion/v2/explorar/ficha?var=<nombre>&fuente=raw|final  (X-Base-Nombre) → ficha del contrato
# Base y fuente se resuelven como en /explorar/univariado (`.resolve_explorar_data`). Sólo lee: no marca el proyecto.
mount_explorador_ficha <- function(pr) {
  pr |>
    plumber::pr_get("/api/validacion/v2/explorar/ficha", wrap_endpoint(function(req, res, var = NULL, fuente = "raw", ...) {
      sid <- session_header(req)
      base <- .get_base_nombre(req)
      var <- as.character(var %||% "")[1]
      if (is.na(var) || !nzchar(trimws(var))) stop_api(400, "E_MISSING_VAR", "Falta ?var=<nombre>")
      resolved <- .resolve_explorar_data(sid, base, fuente)
      ficha <- explorador_ficha(resolved$data, trimws(var), resolved$instrumento)
      ficha$base_nombre <- resolved$effective_base
      ficha$fuente <- resolved$fuente
      ficha
    }))
}
