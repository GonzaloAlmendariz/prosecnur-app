# ============================================================
# MÓDULO: Carga de plan y evaluación multi-tabla (robusto a repeats)
#          (convención: TRUE en el flag = inconsistencia)
# ============================================================



# --- helper interno, al principio del archivo si no existe aún ---
.is_num_like <- function(tablas, hoja, var){
  if (!hoja %in% names(tablas)) return(FALSE)
  if (!var  %in% names(tablas[[hoja]])) return(FALSE)
  x <- tablas[[hoja]][[var]]
  if (is.numeric(x)) return(TRUE)
  if (is.character(x)) {
    ok <- suppressWarnings(!is.na(as.numeric(x)))
    return(mean(ok, na.rm = TRUE) >= 0.7)
  }
  FALSE
}

# -------------------------------------------------------------------
# Utilidades pequeñas
# -------------------------------------------------------------------

#' Operador null-coalescing muy simple
#' @keywords internal
`%||%` <- function(a, b) if (is.null(a) || (length(a)==1 && is.na(a))) b else a

#' Chequeo de string no-vacío
#' @keywords internal
.nz <- function(x) is.character(x) && length(x)==1 && !is.na(x) && nzchar(trimws(x))

#' Convertir a character y colapsar blanco ("") a NA de forma segura
#' @param x vector
#' @return character con blancos como NA
#' @family validacion
#' @export
as_char_na <- function(x){
  out <- as.character(x)
  out <- ifelse(is.na(out), NA_character_, trimws(out))
  out[nchar(out) == 0L] <- NA_character_
  out
}

num <- function(z) suppressWarnings(as.numeric(z))


# -------------------------------------------------------------------
# Igualdad NA-segura
# -------------------------------------------------------------------

#' Comparación NA-segura (numérica)
#'
#' @param a,b vectores comparables numéricamente
#' @param tol tolerancia absoluta
#' @return lógico; TRUE cuando a==b con tolerancia y NA==NA
#' @family validacion
#' @export
eq_num_na <- function(a, b, tol = 0) {
  suppressWarnings({ a <- as.numeric(a); b <- as.numeric(b) })
  (is.na(a) & is.na(b)) | (!is.na(a) & !is.na(b) & abs(a - b) <= tol)
}

#' Comparación NA-segura (caracter)
#'
#' @param a,b vectores comparables como texto
#' @param blank_is_na Si TRUE (por defecto), trata "" como NA antes de comparar
#' @return lógico; TRUE cuando a==b tras `trimws` y NA==NA
#' @family validacion
#' @export
eq_chr_na <- function(a, b, blank_is_na = TRUE) {
  a <- if (is.factor(a)) as.character(a) else as.character(a)
  b <- if (is.factor(b)) as.character(b) else as.character(b)
  a <- ifelse(is.na(a), NA_character_, trimws(a))
  b <- ifelse(is.na(b), NA_character_, trimws(b))
  if (isTRUE(blank_is_na)) {
    a[nchar(a) == 0L] <- NA_character_
    b[nchar(b) == 0L] <- NA_character_
  }
  (is.na(a) & is.na(b)) | (!is.na(a) & !is.na(b) & a == b)
}

#' Resolver etiquetas desde un mapa embebido code -> label
#'
#' @param x vector con codigos
#' @param map named character vector con etiquetas por codigo
#' @return character vector con etiquetas mapeadas
#' @keywords internal
choice_label_map <- function(x, map) {
  codes <- as.character(x)
  codes <- ifelse(is.na(codes), NA_character_, trimws(codes))
  map <- as.character(map)

  if (is.null(names(map)) || !length(map)) {
    return(rep(NA_character_, length(codes)))
  }

  decode_one <- function(code) {
    if (is.na(code) || !nzchar(code)) return(NA_character_)

    if (grepl("\\s", code, perl = TRUE)) {
      toks <- strsplit(code, "\\s+", perl = TRUE)[[1]]
      labs <- unname(map[toks])
      labs <- labs[!is.na(labs) & nzchar(trimws(labs))]
      if (!length(labs)) return(NA_character_)
      return(paste(unique(labs), collapse = ", "))
    }

    lab <- unname(map[code])
    if (!length(lab) || is.na(lab) || !nzchar(trimws(lab))) NA_character_ else lab
  }

  out <- vapply(codes, decode_one, character(1))
  as_char_na(out)
}

# -------------------------------------------------------------------
# Sí/No flexibles (por si un plan los usa)
# -------------------------------------------------------------------

#' Interpretación flexible de "sí"
#' @param x vector
#' @return lógico
#' @family validacion
#' @export
is_yes <- function(x) {
  if (is.logical(x)) return(x)
  if (is.numeric(x)) return(ifelse(is.na(x), NA, x != 0))
  s <- trimws(as.character(x))
  s <- iconv(s, from = "", to = "ASCII//TRANSLIT")
  s <- tolower(gsub("\\s+", " ", s))
  yes_set <- c("yes","y","si","s","1","true","verdadero")
  out <- ifelse(!nzchar(s), NA, s %in% yes_set)
  as.logical(out)
}

#' Interpretación flexible de "no"
#' @param x vector
#' @return lógico
#' @family validacion
#' @export
is_no <- function(x) {
  if (is.logical(x)) return(!x)
  if (is.numeric(x)) return(ifelse(is.na(x), NA, x == 0))
  s <- trimws(as.character(x))
  s <- iconv(s, from = "", to = "ASCII//TRANSLIT")
  s <- tolower(gsub("\\s+", " ", s))
  no_set <- c("no","n","0","false","falso")
  out <- ifelse(!nzchar(s), NA, s %in% no_set)
  as.logical(out)
}

# -------------------------------------------------------------------
# selected_at / count_selected + variante segura selected_at_char
# -------------------------------------------------------------------

#' Emular selected-at(list, i0) de ODK (i0 es 0-based)
#' @param x string con selecciones separadas por espacio o vector
#' @param i0 índice 0-based
#' @param sep regex separador (default: "\\s+")
#' @return el elemento (1-based interno) o NA
#' @family validacion
#' @export
selected_at <- function(x, i0, sep = "\\s+"){
  parts <- if (length(x) == 1L && is.character(x)) {
    xs <- trimws(x)
    if (xs == "") character(0) else if (grepl(sep, xs, perl = TRUE)) strsplit(xs, sep, perl = TRUE)[[1]] else xs
  } else x
  i <- suppressWarnings(as.integer(i0)) + 1L
  if (length(parts) == 0L || is.na(i) || i < 1L || i > length(parts)) return(NA_character_)
  parts[[i]]
}

#' Versión segura de selected_at() que devuelve character con blancos→NA
#' @inheritParams selected_at
#' @return character
#' @family validacion
#' @export
selected_at_char <- function(x, i0, sep = "\\s+"){
  as_char_na(selected_at(x, i0, sep = sep))
}

#' Recuento de opciones en un select_multiple
#' @param x string con opciones separadas por espacio
#' @return integer
#' @family validacion
#' @export
count_selected <- function(x){
  x <- trimws(x %||% "")
  if (x == "") 0L else length(strsplit(x, "\\s+")[[1L]])
}

#' grepl con perl=TRUE por defecto (para tokens reescritos)
#' @keywords internal
.grepl_perl <- function(pattern, x, ..., perl = TRUE) base::grepl(pattern, x, ..., perl = perl)

# -------------------------------------------------------------------
# Normalizadores de texto/regex
# -------------------------------------------------------------------

#' Normalización de columna "Procesamiento" (comillas, espacios duros, "=")
#' @keywords internal
.normalizar_procesamiento <- function(x) {
  if (is.null(x)) return(x)
  x <- as.character(x)
  x <- gsub("\u201C|\u201D", "\"", x, perl = TRUE)
  x <- gsub("\u2018|\u2019", "'",  x, perl = TRUE)
  x <- gsub("[\u00A0\u2007\u202F]", " ", x, perl = TRUE)
  x <- gsub("(?<!<|>|!|<-|=)=(?!=)", "==", x, perl = TRUE)
  x <- gsub("={3,}", "==", x, perl = TRUE)
  # balanceo mínimo de paréntesis
  n_open  <- stringr::str_count(x, "\\(")
  n_close <- stringr::str_count(x, "\\)")
  need    <- n_open > n_close
  x[need] <- paste0(x[need], vapply((n_open[need]-n_close[need]), function(k) paste0(rep(")", k), collapse=""), ""))
  x
}

#' Proteger secuencias \\s en regex de planes
#' @keywords internal
.sanear_regex_en_procesamiento <- function(x) {
  if (is.null(x) || is.na(x) || !nzchar(x)) return(x)
  gsub("(?<!\\\\)\\\\s", "\\\\\\\\s", as.character(x), perl = TRUE)
}

# -------------------------------------------------------------------
# Carga de plan (Plan v1/v2 compatible)
# -------------------------------------------------------------------

#' Cargar plan de limpieza desde Excel (Plan v1/v2)
#'
#' @param path Ruta al archivo `.xlsx`.
#' @param sheet Nombre de la hoja del plan (default `"Plan"`).
#' @return `tibble` listo para evaluar (mantiene columnas v2 si existen).
#' @family validacion
#' @export
#' @examples
#' \dontrun{
#' plan <- cargar_plan_excel("plan_limpieza.xlsx", sheet = "Plan")
#' }
cargar_plan_excel <- function(path, sheet = "Plan"){
  stopifnot(file.exists(path))
  plan <- readxl::read_excel(path, sheet = sheet)

  nms <- gsub("[   ]+", " ", trimws(names(plan)), perl = TRUE)
  names(plan) <- nms

  req <- c("ID","Tabla","Sección","Categoría","Tipo",
           "Nombre de regla","Objetivo",
           "Variable 1","Variable 1 - Etiqueta",
           "Variable 2","Variable 2 - Etiqueta",
           "Variable 3","Variable 3 - Etiqueta",
           "Procesamiento")
  faltan <- setdiff(req, names(plan))
  if (length(faltan)) stop("La hoja '", sheet, "' carece de columnas: ", paste(faltan, collapse = ", "))

  plan[["Procesamiento"]] <- vapply(plan[["Procesamiento"]],
                                    function(z) .sanear_regex_en_procesamiento(.normalizar_procesamiento(z)),
                                    character(1))

  # Columnas opcionales v2
  opt <- c("Hoja base","Hoja Var1","Hoja Var2","Hoja Var3","Agreg Var2","Agreg Var3")
  missing_opt <- setdiff(opt, names(plan))
  if (length(missing_opt)) {
    for (c in missing_opt) plan[[c]] <- NA_character_
  }
  plan
}

# -------------------------------------------------------------------
# Resolver datos multi-tabla
# -------------------------------------------------------------------

#' Normalizar nombres de tabla
#' @keywords internal
.norm_tab <- function(s){
  s <- as.character(s %||% "")
  s <- tolower(trimws(s))
  s <- gsub("^\\(|\\)$", "", s)
  s <- gsub("[\u00A0\u2007\u202F]", " ", s)
  s <- gsub("\\s+", "_", s)
  s <- iconv(s, to = "ASCII//TRANSLIT")
  gsub("[^a-z0-9_]", "", s, perl = TRUE)
}

#' Resolver entrada `datos` a lista estructurada (principal + tablas)
#'
#' @param datos data.frame, lista con `$data` o `$datos_tablas`, o ruta `.xlsx`
#' @param hoja_principal hoja a leer si `datos` es ruta
#' @return lista con `principal` y `tablas`
#' @family validacion
#' @export
.resolver_datos_multitabla <- function(datos, hoja_principal = NULL) {
  if (is.data.frame(datos)) {
    return(list(principal = datos, tablas = list(principal = datos)))
  }
  if (is.list(datos) && !is.null(datos$datos_tablas) && is.list(datos$datos_tablas)) {
    tablas_list <- Filter(is.data.frame, datos$datos_tablas)
    return(.as_principal_tablas(tablas_list, hoja_principal = hoja_principal))
  }
  if (is.list(datos) && !is.null(datos$data) && is.list(datos$data)) {
    tablas_list <- Filter(is.data.frame, datos$data)
    return(.as_principal_tablas(tablas_list, hoja_principal = hoja_principal))
  }
  if (is.list(datos)) {
    tablas_list <- Filter(is.data.frame, datos)
    if (length(tablas_list)) {
      return(.as_principal_tablas(tablas_list, hoja_principal = hoja_principal))
    }
  }
  if (is.character(datos) && length(datos) == 1 && grepl("\\.xlsx?$", datos, ignore.case = TRUE)) {
    sheets <- readxl::excel_sheets(datos)
    hoja <- hoja_principal %||% (sheets[1] %||% "Sheet1")
    df <- suppressMessages(readxl::read_excel(datos, sheet = hoja))
    return(list(principal = df, tablas = list(principal = df)))
  }
  stop("No pude convertir 'datos'. Pásame un data.frame, una lista (con $data o $datos_tablas) o ruta .xlsx.")
}

#' Exponer la hoja principal con la clave canónica `principal`
#' @keywords internal
.as_principal_tablas <- function(tablas_list, hoja_principal = NULL) {
  tablas_list <- Filter(is.data.frame, tablas_list)
  if (!length(tablas_list)) {
    return(list(principal = NULL, tablas = list()))
  }

  claves <- names(tablas_list)
  main_name <- if (!is.null(hoja_principal) && hoja_principal %in% claves) {
    hoja_principal
  } else if ("principal" %in% claves) {
    "principal"
  } else {
    claves[[1]]
  }

  principal <- tablas_list[[main_name]]
  otras <- tablas_list[setdiff(claves, c("principal", main_name))]
  tablas_out <- c(list(principal = principal), otras)
  list(principal = principal, tablas = tablas_out)
}

#' Construir índice de tablas y normalizador
#' @keywords internal
.construir_indice_tablas <- function(tablas_list){
  claves <- names(tablas_list)
  if (!"principal" %in% claves) {
    tablas_list <- c(list(principal = tablas_list[[1]]), tablas_list)
    claves <- names(tablas_list)
  }
  map_norm_to_key <- stats::setNames(claves, .norm_tab(claves))  # "s1" -> "S1"
  list(map_norm_to_key = map_norm_to_key, tablas = tablas_list)
}

#' Resolver una tabla del plan contra las tablas disponibles
#' @keywords internal
.resolve_table_key <- function(tabla, tablas) {
  tnorm <- .norm_tab(tabla)
  if (!nzchar(tnorm) || tnorm %in% c("principal", "main")) return("principal")

  nms <- names(tablas %||% list())
  hit <- which(.norm_tab(nms) == tnorm)
  if (length(hit) >= 1L) nms[[hit[1]]] else NA_character_
}

#' Encontrar tabla destino para una regla del plan
#' @keywords internal
.encontrar_tabla_para <- function(tabla_plan, idx){
  tnorm <- .norm_tab(tabla_plan)
  if (!nzchar(tnorm) || tnorm %in% c("principal","(principal)")) return("principal")
  if (tnorm %in% names(idx$map_norm_to_key)) return(idx$map_norm_to_key[[tnorm]])
  "principal"
}

# -------------------------------------------------------------------
# Binding de variables al entorno de evaluación (con alias + labels)
# -------------------------------------------------------------------

#' Generar alias razonables de nombre de variable
#' @keywords internal
.var_aliases <- function(nm) data.frame(
  alias = unique(c(
    nm, tolower(nm), toupper(nm),
    gsub("[^A-Za-z0-9_]", "", nm),
    gsub("[^A-Za-z0-9_]", "", tolower(nm)),
    gsub("[^A-Za-z0-9_]", "", toupper(nm))
  )),
  stringsAsFactors = FALSE
)$alias

#' Mapear códigos a etiquetas según `.CHOICES`
#'
#' @param df data.frame
#' @param choices lista nombrada: `var` -> named character `c(code="Etiqueta", ...)`
#' @return data.frame con columnas `var_label` añadidas (si aplica)
#' @family validacion
#' @export
.mapear_etiquetas <- function(df, choices){
  if (!is.data.frame(df) || is.null(choices) || !length(choices)) return(df)
  for (v in intersect(names(choices), names(df))) {
    labmap <- choices[[v]]
    if (is.null(labmap) || !length(labmap)) next
    val <- as.character(df[[v]])
    lab <- unname(labmap[val])
    # para select_multiple: mapear por token y colapsar
    if (any(grepl("\\s", val %||% "", perl = TRUE), na.rm = TRUE)) {
      tmp <- vapply(val, function(s){
        s <- trimws(s %||% "")
        if (s == "") return(NA_character_)
        toks <- strsplit(s, "\\s+", perl = TRUE)[[1]]
        labs <- unname(labmap[toks])
        labs <- labs[!is.na(labs)]
        if (!length(labs)) NA_character_ else paste(unique(labs), collapse = ", ")
      }, FUN.VALUE = character(1))
      lab <- tmp
    }
    df[[paste0(v, "_label")]] <- as_char_na(lab)
  }
  df
}

#' Enlazar variables de un data.frame al entorno (con alias)
#' @keywords internal
.bind_vars_with_aliases <- function(env, df) {
  for (nm in names(df)) {
    vals <- df[[nm]]
    for (k in .var_aliases(nm)) rlang::env_bind(env, !!k := vals)
  }
  env
}

#' Normalizar token de variable para matching flexible
#' @keywords internal
.norm_var_token <- function(x) {
  x <- as.character(x %||% "")
  x <- iconv(x, to = "ASCII//TRANSLIT")
  x <- tolower(trimws(x))
  gsub("[^a-z0-9_]", "", x, perl = TRUE)
}

#' Resolver nombre real de variable en un data.frame
#' @keywords internal
.resolve_var_name_in_df <- function(df, var) {
  if (!is.data.frame(df) || !length(names(df))) return(NA_character_)
  nms <- names(df)
  if (var %in% nms) return(var)
  hits <- which(.norm_var_token(nms) == .norm_var_token(var))
  if (length(hits) == 1) nms[[hits[1]]] else NA_character_
}

#' Colapsar aliases de tablas que apuntan al mismo contenido
#' @keywords internal
.dedupe_table_hits <- function(hits, tablas) {
  hits <- as.character(hits %||% character(0))
  if (length(hits) <= 1L) return(hits)

  reps <- character(0)
  for (hit in hits) {
    if (!hit %in% names(tablas)) next

    matched <- FALSE
    for (j in seq_along(reps)) {
      rep_hit <- reps[[j]]
      if (!rep_hit %in% names(tablas)) next

      same_tbl <- identical(tablas[[hit]], tablas[[rep_hit]])
      if (isTRUE(same_tbl)) {
        if (identical(hit, "principal") && !identical(rep_hit, "principal")) reps[[j]] <- "principal"
        matched <- TRUE
        break
      }
    }

    if (!matched) reps <- c(reps, hit)
  }

  unique(reps)
}

#' Construir un entorno cacheado con aliases por tabla
#' @keywords internal
.build_alias_env <- function(df) {
  env <- rlang::env(rlang::base_env())
  .bind_vars_with_aliases(env, df)
}

#' Preparar tablas para evaluacion (labels + cache de aliases)
#' @keywords internal
.prepare_eval_tables <- function(tablas, choices = NULL, use_choice_labels = FALSE) {
  tablas_out <- tablas
  envs <- list()

  for (nm in names(tablas_out)) {
    df <- tablas_out[[nm]]
    if (!is.data.frame(df)) next
    if (isTRUE(use_choice_labels) && !is.null(choices) && length(choices)) {
      df <- .mapear_etiquetas(df, choices)
      tablas_out[[nm]] <- df
    }
    envs[[nm]] <- .build_alias_env(df)
  }

  list(tablas = tablas_out, envs = envs)
}

# -------------------------------------------------------------------
# Rewriting de RHS para agregaciones principal ← hijo
# -------------------------------------------------------------------

#' Detectar variables externas a la tabla base y asignarles hoja
#' @keywords internal
.find_var_tables <- function(rhs, base_table_key, tablas, hoja_var_cols = list(), agreg_cols = list()){
  txt <- as.character(rhs %||% "")
  if (!nzchar(txt)) return(list(txt = txt, omit = FALSE))

  m2 <- gregexpr("\\b[A-Za-z][A-Za-z0-9_]*\\b", txt, perl = TRUE)
  tok <- if (m2[[1]][1] != -1) unique(regmatches(txt, m2)[[1]]) else character(0)
  excl <- c("if","else","and","or","true","false","TRUE","FALSE","paste","paste0",
            "sum","min","max","any","all","count","length","eq_num_na","eq_chr_na",
            "grepl","is.na","trimws","as","character","numeric","Sys","Date","Sys.Date",
            "REF_VAL",
            "selected_at","selected_at_char","count_selected")
  vars <- tok[!(tolower(tok) %in% tolower(excl))]

  var2sheet <- list()
  var_actual <- list()
  local_actual <- list()
  ambiguous_vars <- list()
  for (v in vars) {
    base_actual <- .resolve_var_name_in_df(tablas[[base_table_key]], v)
    if (.nz(base_actual)) {
      if (!identical(base_actual, v)) local_actual[[v]] <- base_actual
      next
    }
    if (length(hoja_var_cols) && !is.null(hoja_var_cols[[v]]) && .nz(hoja_var_cols[[v]])) {
      hoja <- .resolve_table_key(hoja_var_cols[[v]], tablas)
      if (!.nz(hoja)) hoja <- hoja_var_cols[[v]]
      var2sheet[[v]] <- hoja
      actual <- .resolve_var_name_in_df(tablas[[hoja]], v)
      var_actual[[v]] <- if (.nz(actual)) actual else v
      next
    }
    hits <- names(Filter(function(df) .nz(.resolve_var_name_in_df(df, v)), tablas))
    hits <- setdiff(hits, base_table_key)
    hits <- .dedupe_table_hits(hits, tablas)
    if (length(hits) == 1) {
      var2sheet[[v]] <- hits[[1]]
      actual <- .resolve_var_name_in_df(tablas[[hits[[1]]]], v)
      var_actual[[v]] <- if (.nz(actual)) actual else v
    }
    if (length(hits) > 1)  ambiguous_vars[[v]] <- hits
  }
  list(
    vars = vars,
    var2sheet = var2sheet,
    var_actual = var_actual,
    local_actual = local_actual,
    ambiguous_vars = ambiguous_vars,
    txt = txt,
    omit = FALSE
  )
}

#' ¿Hay agregación explícita para var?
#' @keywords internal
.has_explicit_agg_on <- function(rhs, var){
  re_sum   <- paste0("\\bsum\\s*\\(\\s*", var, "\\s*\\)")
  re_paste <- paste0("\\bpaste\\s*\\(\\s*", var, "\\s*,\\s*collapse\\s*=\\s*(['\"][^'\"]+['\"])\\s*\\)")
  re_cnt   <- paste0("\\bcount\\s*\\(\\s*", var, "\\s*\\)")
  any(grepl(re_sum, rhs, perl = TRUE),
      grepl(re_paste, rhs, perl = TRUE),
      grepl(re_cnt, rhs, perl = TRUE))
}

#' Reescritura de RHS insertando AGG_* donde aplica
#' @keywords internal
.rewrite_rhs_with_aggs <- function(rhs, base_table_key, tablas,
                                   hoja_var_cols = list(), agreg_cols = list()){
  info <- .find_var_tables(rhs, base_table_key, tablas, hoja_var_cols, agreg_cols)
  txt  <- info$txt
  var2sheet <- info$var2sheet
  var_actual <- info$var_actual %||% list()
  local_actual <- info$local_actual %||% list()
  ambiguous_vars <- info$ambiguous_vars %||% list()

  if (length(ambiguous_vars)) {
    detalle <- vapply(names(ambiguous_vars), function(v) {
      paste0(v, " -> {", paste(ambiguous_vars[[v]], collapse = ", "), "}")
    }, FUN.VALUE = character(1))
    return(list(
      rhs2 = txt,
      omit = TRUE,
      issue_code = "cross_table_ambiguous",
      detail = paste("Variables presentes en multiples hojas:", paste(detalle, collapse = "; "))
    ))
  }

  if (!length(var2sheet)) {
    if (length(local_actual)) {
      for (v in names(local_actual)) {
        actual <- local_actual[[v]]
        txt <- gsub(paste0("(?<![A-Za-z0-9_])", v, "(?![A-Za-z0-9_])"),
                    actual, txt, perl = TRUE)
      }
    }
    return(list(rhs2 = txt, omit = FALSE, issue_code = NA_character_, detail = NA_character_))
  }

  if (length(local_actual)) {
    for (v in names(local_actual)) {
      actual <- local_actual[[v]]
      txt <- gsub(paste0("(?<![A-Za-z0-9_])", v, "(?![A-Za-z0-9_])"),
                  actual, txt, perl = TRUE)
    }
  }

  # 1) Reemplazar agregaciones explícitas (sum/paste/count) por AGG_*
  for (v in names(var2sheet)) {
    hoja <- var2sheet[[v]]
    actual <- var_actual[[v]] %||% v
    if (is.null(hoja) || !nzchar(hoja) || hoja == base_table_key) next

    txt <- gsub(paste0("\\bsum\\s*\\(\\s*", v, "\\s*\\)"),
                paste0("AGG_SUM('", hoja, "','", actual, "')"), txt, perl = TRUE)

    txt <- gsub(paste0("\\bpaste\\s*\\(\\s*", v, "\\s*,\\s*collapse\\s*=\\s*('|\")([^'\"]+)\\1\\s*\\)"),
                paste0("AGG_PASTE('", hoja, "','", actual, "', sep = \"\\2\")"), txt, perl = TRUE)

    txt <- gsub(paste0("\\bcount\\s*\\(\\s*", v, "\\s*\\)"),
                paste0("AGG_N('", hoja, "','", actual, "')"), txt, perl = TRUE)
  }

  # 2) Variables cruzadas "crudas" sin agregación -> INFERIR agregación (NO omitir)
  for (v in names(var2sheet)) {
    hoja <- var2sheet[[v]]
    if (is.null(hoja) || hoja == base_table_key) next

    # ¿aparece como token suelto (no ya envuelto en AGG_*)?
    aparece_crudo <- grepl(paste0("(?<![A-Za-z0-9_])", v, "(?![A-Za-z0-9_])"), txt, perl = TRUE) &&
      !grepl(paste0("AGG_(SUM|PASTE|N)\\([^)]*'", v, "'\\)"), txt, perl = TRUE)

    if (!aparece_crudo) next

    if (isTRUE(.can_lookup_parent_raw(base_table_key, hoja, tablas))) {
      actual <- var_actual[[v]] %||% v
      txt <- gsub(
        paste0("(?<![A-Za-z0-9_])", v, "(?![A-Za-z0-9_])"),
        paste0("REF_VAL('", hoja, "','", actual, "')"),
        txt,
        perl = TRUE
      )
      next
    }

    # ¿el plan dio agregación para ese var?
    agreg_plan <- NULL
    if (length(agreg_cols) && !is.null(agreg_cols[[v]]) && .nz(agreg_cols[[v]])) {
      agreg_plan <- tolower(trimws(agreg_cols[[v]]))
    }

    if (!.nz(agreg_plan)) {
      return(list(
        rhs2 = txt,
        omit = TRUE,
        issue_code = "cross_table_ambiguous",
        detail = paste0(
          "Cruce principal-hijo sin agregacion explicita para la variable '", v,
          "' en la hoja '", hoja, "'."
        )
      ))
    }

    if (agreg_plan %in% c("sum")) {
      actual <- var_actual[[v]] %||% v
      txt <- gsub(paste0("(?<![A-Za-z0-9_])", v, "(?![A-Za-z0-9_])"),
                  paste0("AGG_SUM('", hoja, "','", actual, "')"), txt, perl = TRUE)
    } else if (agreg_plan %in% c("n","count")) {
      actual <- var_actual[[v]] %||% v
      txt <- gsub(paste0("(?<![A-Za-z0-9_])", v, "(?![A-Za-z0-9_])"),
                  paste0("AGG_N('", hoja, "','", actual, "')"), txt, perl = TRUE)
    } else if (agreg_plan %in% c("paste","concat","join")) {
      actual <- var_actual[[v]] %||% v
      txt <- gsub(paste0("(?<![A-Za-z0-9_])", v, "(?![A-Za-z0-9_])"),
                  paste0("AGG_PASTE('", hoja, "','", actual, "', sep = \" \")"), txt, perl = TRUE)
    } else {
      return(list(
        rhs2 = txt,
        omit = TRUE,
        issue_code = "runtime_skip",
        detail = paste0("Agregacion no soportada para la variable '", v, "': ", agreg_plan)
      ))
    }
  }

  list(rhs2 = txt, omit = FALSE, issue_code = NA_character_, detail = NA_character_)
}

# -------------------------------------------------------------------
# AGG_*: agregadores por padre (vectorizados) usando _parent_index
# -------------------------------------------------------------------

#' Preparar contexto de agregación
#' @keywords internal
.AGG_prepare <- function(tablas, base_key) {
  list(tablas = tablas, base_key = base_key, n_base = nrow(tablas[[base_key]] %||% tibble()))
}

#' Determinar si una variable cruzada puede leerse desde el padre directo
#' @keywords internal
.can_lookup_parent_raw <- function(base_table_key, ref_table_key, tablas) {
  if (identical(base_table_key, "principal") || !identical(ref_table_key, "principal")) return(FALSE)
  base <- tablas[[base_table_key]]
  ref  <- tablas[[ref_table_key]]
  is.data.frame(base) && is.data.frame(ref) && "_parent_index" %in% names(base)
}

#' Guardas para AGG_*
#' @keywords internal
.AGG_guard <- function(ctx, hoja){
  if (is.null(ctx$tablas[[hoja]]) || !is.data.frame(ctx$tablas[[hoja]])) stop("Hoja '", hoja, "' no disponible.")
  if (is.null(ctx$tablas[[hoja]][["_parent_index"]])) stop("La hoja '", hoja, "' no trae _parent_index.")
}

#' Resolver posiciones del padre para agregaciones repeat -> base
#' @keywords internal
.AGG_parent_locs <- function(ctx, hoja) {
  .AGG_guard(ctx, hoja)

  base  <- ctx$tablas[[ctx$base_key]]
  child <- ctx$tablas[[hoja]]
  raw_parent <- suppressWarnings(as.integer(child[["_parent_index"]]))
  N <- ctx$n_base

  if (!is.data.frame(base) || N <= 0) {
    return(list(locs = rep(NA_integer_, length(raw_parent)), N = N))
  }

  if ("_index" %in% names(base)) {
    base_ids <- suppressWarnings(as.integer(base[["_index"]]))
    if (length(base_ids) == N && any(!is.na(base_ids))) {
      locs <- match(raw_parent, base_ids)
      return(list(locs = locs, N = N))
    }
  }

  ok <- !is.na(raw_parent) & raw_parent >= 1L & raw_parent <= N
  locs <- rep(NA_integer_, length(raw_parent))
  locs[ok] <- raw_parent[ok]
  list(locs = locs, N = N)
}

#' Alinear valores del padre directo a la hoja base repetida
#' @keywords internal
.REF_parent_vals <- function(ctx, hoja, var) {
  base <- ctx$tablas[[ctx$base_key]]
  ref  <- ctx$tablas[[hoja]]

  if (!is.data.frame(base) || !is.data.frame(ref)) {
    stop("No pude resolver el cruce desde '", ctx$base_key, "' hacia '", hoja, "'.")
  }
  if (!"_parent_index" %in% names(base)) {
    stop("La hoja base '", ctx$base_key, "' no trae _parent_index para buscar valores del padre.")
  }

  actual <- .resolve_var_name_in_df(ref, var)
  if (!.nz(actual)) {
    stop("La variable '", var, "' no existe en la hoja padre '", hoja, "'.")
  }

  raw_parent <- suppressWarnings(as.integer(base[["_parent_index"]]))
  locs <- rep(NA_integer_, length(raw_parent))

  if ("_index" %in% names(ref)) {
    ref_ids <- suppressWarnings(as.integer(ref[["_index"]]))
    if (length(ref_ids) == nrow(ref) && any(!is.na(ref_ids))) {
      locs <- match(raw_parent, ref_ids)
    }
  } else {
    ok <- !is.na(raw_parent) & raw_parent >= 1L & raw_parent <= nrow(ref)
    locs[ok] <- raw_parent[ok]
  }

  ref[[actual]][locs]
}

#' Suma por padre (repeat→principal)
#' @param hoja nombre de hoja repetida
#' @param var nombre de variable hija
#' @return vector numérico longitud N padres
#' @family validacion
#' @export
AGG_SUM <- function(hoja, var){
  ctx <- get(".AGG_CTX", envir = parent.frame())
  child <- ctx$tablas[[hoja]]
  parent <- .AGG_parent_locs(ctx, hoja)
  idx   <- parent$locs
  v     <- suppressWarnings(as.numeric(child[[var]]))
  N     <- parent$N
  ok    <- !is.na(idx) & idx>=1 & idx<=N
  if (!any(ok)) return(rep(NA_real_, N))
  sums <- tapply(v[ok], idx[ok], function(x) sum(x, na.rm = TRUE))
  out  <- rep(NA_real_, N); out[as.integer(names(sums))] <- as.numeric(sums)
  out
}

#' Conteo de filas hijas por padre (repeat→principal)
#' @param hoja nombre de hoja repetida
#' @param var ignorado (por compatibilidad)
#' @return integer vector
#' @family validacion
#' @export
AGG_N <- function(hoja, var = NULL){
  ctx <- get(".AGG_CTX", envir = parent.frame())
  parent <- .AGG_parent_locs(ctx, hoja)
  idx   <- parent$locs
  N     <- parent$N
  ok    <- !is.na(idx) & idx>=1 & idx<=N
  if (!any(ok)) return(rep(0L, N))
  tab   <- table(idx[ok])
  out   <- rep(0L, N); out[as.integer(names(tab))] <- as.integer(tab)
  out
}

#' Pegar valores por padre (repeat→principal)
#' @param hoja nombre de hoja repetida
#' @param var variable de texto a pegar
#' @param sep separador
#' @return character vector
#' @family validacion
#' @export
AGG_PASTE <- function(hoja, var, sep = " "){
  ctx <- get(".AGG_CTX", envir = parent.frame())
  child <- ctx$tablas[[hoja]]
  parent <- .AGG_parent_locs(ctx, hoja)
  idx   <- parent$locs
  v     <- as.character(child[[var]])
  N     <- parent$N
  ok    <- !is.na(idx) & idx>=1 & idx<=N
  if (!any(ok)) return(rep("", N))
  split_list <- split(v[ok], idx[ok])
  res <- vapply(split_list, function(x){
    x <- x[!is.na(x) & nzchar(trimws(x))]
    if (!length(x)) "" else paste(x, collapse = sep)
  }, FUN.VALUE = character(1))
  out <- rep("", N); out[as.integer(names(res))] <- res; out
}

#' Leer un valor del padre directo para cada fila del repeat base
#' @keywords internal
REF_VAL <- function(hoja, var){
  ctx <- get(".AGG_CTX", envir = parent.frame())
  .REF_parent_vals(ctx, hoja, var)
}

# -------------------------------------------------------------------
# Parser de regla (flag <- expr)
# -------------------------------------------------------------------

#' Parsear "Procesamiento" (flag <- expr)
#' @keywords internal
.parsear_regla <- function(proc, nombre_fallback = NA_character_) {
  if (is.na(proc) || !nzchar(proc)) return(NULL)
  if (grepl("<-", proc, fixed = TRUE)) {
    partes <- strsplit(proc, "<-", fixed = TRUE)[[1]]
    flag <- trimws(partes[1]); rhs <- trimws(paste(partes[-1], collapse = "<-"))
  } else {
    if (is.na(nombre_fallback) || !nzchar(nombre_fallback)) return(NULL)
    flag <- nombre_fallback; rhs <- trimws(proc)
  }
  if (!nzchar(flag) || !nzchar(rhs)) return(NULL)
  list(flag = flag, rhs = rhs)
}

#' Construir una fila de resumen/diagnostico por regla
#' @keywords internal
.make_resumen_row <- function(r,
                              tabla,
                              flag = NA_character_,
                              n_inconsistencias = NA_integer_,
                              estado_dinamico = "correcta",
                              issue_code = NA_character_,
                              detalle = NA_character_,
                              expresion_evaluada = NA_character_) {
  tibble::tibble(
    id_regla = r$id_regla,
    nombre_regla = r$nombre_regla,
    tabla = tabla %||% "principal",
    seccion = r$seccion,
    categoria = r$categoria,
    tipo_observacion = r$tipo_observacion,
    flag = flag,
    n_inconsistencias = n_inconsistencias,
    estado_dinamico = estado_dinamico,
    issue_code = issue_code,
    detalle = detalle,
    expresion_evaluada = expresion_evaluada
  )
}

# -------------------------------------------------------------------
# EVALUAR
# -------------------------------------------------------------------

#' Evaluar reglas de limpieza (multi-tabla; soporte repeats)
#'
#' @description
#' Evalúa un plan de limpieza sobre: un `data.frame`, una **lista** con tablas
#' (`$data` o `$datos_tablas`), o una **ruta .xlsx** (se lee una hoja).
#' Usa **Tabla** / **Hoja base** para decidir en qué data.frame evaluar cada regla.
#' Convención: **`TRUE` en el flag = inconsistencia**.
#' Cruces principal ← hijo sólo si hay **agregación explícita** (o guía del plan).
#'
#' @param datos `data.frame`, lista de data.frames, o ruta `.xlsx`.
#' @param plan `tibble` devuelto por \code{cargar_plan_excel()}.
#' @param hoja_principal Si `datos` es ruta `.xlsx`, hoja a leer.
#' @param contar_na_como_inconsistencia Si `TRUE`, los `NA` del flag cuentan como inconsistencia.
#' @param choices (opcional) lista nombrada: `var` -> named character `c(code="Etiqueta")` para inyectar `var_label`.
#' @param use_choice_labels si `TRUE`, aplica `choices` y crea columnas `*_label`.
#' @return Lista con `datos`, `datos_tablas`, `resumen`, `reglas_meta`.
#' @family validacion
#' @export
#' @examples
#' \dontrun{
#' plan <- cargar_plan_excel("plan_limpieza.xlsx")
#' ev   <- evaluar_consistencia(datos = mis_tablas, plan = plan,
#'                              choices = list(Country = c(PER="Perú", VEN="Venezuela")),
#'                              use_choice_labels = TRUE)
#' ev$resumen
#' }
evaluar_consistencia <- function(datos,
                                 plan,
                                 hoja_principal = NULL,
                                 contar_na_como_inconsistencia = FALSE,
                                 choices = NULL,
                                 use_choice_labels = FALSE) {
  stopifnot(is.data.frame(plan))

  # Resolver datos e índice
  base <- .resolver_datos_multitabla(datos, hoja_principal = hoja_principal)
  idx  <- .construir_indice_tablas(base$tablas)
  tablas <- idx$tablas

  # Inyectar n_<hoja> en principal si faltan y hay _parent_index ---
  if ("principal" %in% names(tablas)) {
    N <- nrow(tablas[["principal"]] %||% tibble())
    if (N > 0) {
      base_index <- if ("_index" %in% names(tablas[["principal"]])) {
        suppressWarnings(as.integer(tablas[["principal"]][["_index"]]))
      } else {
        NULL
      }
      for (hoja in setdiff(names(tablas), "principal")) {
        child <- tablas[[hoja]]
        if (is.data.frame(child) && "_parent_index" %in% names(child)) {
          idxp <- suppressWarnings(as.integer(child[["_parent_index"]]))
          if (!is.null(base_index) && length(base_index) == N && any(!is.na(base_index))) {
            idxp <- match(idxp, base_index)
          }
          ok   <- !is.na(idxp) & idxp >= 1 & idxp <= N
          tab  <- table(idxp[ok])
          v    <- integer(N); if (length(tab)) v[as.integer(names(tab))] <- as.integer(tab)
          coln <- paste0("n_", hoja)
          if (!coln %in% names(tablas[["principal"]])) {
            tablas[["principal"]][[coln]] <- v
          }
        }
      }
    }
  }

  prep <- .prepare_eval_tables(tablas, choices = choices, use_choice_labels = use_choice_labels)
  tablas <- prep$tablas
  data_env_cache <- prep$envs %||% list()

  # Plan interno normalizado
  plan2 <- tibble::tibble(
    id_regla            = plan[["ID"]],
    tabla_dest          = plan[["Tabla"]] %||% "(principal)",
    seccion             = plan[["Sección"]] %||% NA_character_,
    categoria           = plan[["Categoría"]] %||% NA_character_,
    tipo_observacion    = plan[["Tipo"]] %||% NA_character_,
    nombre_regla        = plan[["Nombre de regla"]],
    objetivo            = plan[["Objetivo"]],
    variable_1          = plan[["Variable 1"]],
    variable_1_etiqueta = plan[["Variable 1 - Etiqueta"]],
    variable_2          = plan[["Variable 2"]],
    variable_2_etiqueta = plan[["Variable 2 - Etiqueta"]],
    variable_3          = plan[["Variable 3"]],
    variable_3_etiqueta = plan[["Variable 3 - Etiqueta"]],
    procesamiento       = plan[["Procesamiento"]],
    hoja_base           = plan[["Hoja base"]] %||% NA_character_,
    hoja_var1           = plan[["Hoja Var1"]] %||% NA_character_,
    hoja_var2           = plan[["Hoja Var2"]] %||% NA_character_,
    hoja_var3           = plan[["Hoja Var3"]] %||% NA_character_,
    agreg_var2          = plan[["Agreg Var2"]] %||% NA_character_,
    agreg_var3          = plan[["Agreg Var3"]] %||% NA_character_
  )

  resumen_rows <- vector("list", nrow(plan2))

  for (i in seq_len(nrow(plan2))) {
    r <- plan2[i,]
    base_key <- .encontrar_tabla_para(r$hoja_base %||% r$tabla_dest, idx)
    df  <- tablas[[base_key]]

    proc_norm <- .sanear_regex_en_procesamiento(.normalizar_procesamiento(r$procesamiento))
    pr <- .parsear_regla(proc_norm, r$nombre_regla)
    if (is.null(pr)) {
      resumen_rows[[i]] <- .make_resumen_row(
        r,
        tabla = base_key,
        estado_dinamico = "incorrecta_ejecucion",
        issue_code = "parse_error",
        detalle = "No se pudo parsear la expresion de procesamiento.",
        expresion_evaluada = proc_norm
      )
      next
    }

    if (!is.data.frame(df)) {
      resumen_rows[[i]] <- .make_resumen_row(
        r,
        tabla = base_key,
        flag = pr$flag,
        estado_dinamico = "incorrecta_ejecucion",
        issue_code = "runtime_skip",
        detalle = paste0("No existe una tabla evaluable para la hoja base '", base_key, "'."),
        expresion_evaluada = pr$rhs
      )
      next
    }

    # Rewriting del RHS para agregaciones principal ← hijo
    hoja_map <- list()
    if (.nz(r$hoja_var1)) hoja_map[[as.character(r$variable_1)]] <- as.character(r$hoja_var1)
    if (.nz(r$hoja_var2)) hoja_map[[as.character(r$variable_2)]] <- as.character(r$hoja_var2)
    if (.nz(r$hoja_var3)) hoja_map[[as.character(r$variable_3)]] <- as.character(r$hoja_var3)

    agreg_map <- list()
    if (.nz(r$agreg_var2)) agreg_map[[as.character(r$variable_2)]] <- as.character(r$agreg_var2)
    if (.nz(r$agreg_var3)) agreg_map[[as.character(r$variable_3)]] <- as.character(r$agreg_var3)

    rw <- .rewrite_rhs_with_aggs(pr$rhs, base_table_key = base_key, tablas = tablas,
                                 hoja_var_cols = hoja_map, agreg_cols = agreg_map)
    if (isTRUE(rw$omit)) {
      resumen_rows[[i]] <- .make_resumen_row(
        r,
        tabla = base_key,
        flag = pr$flag,
        estado_dinamico = if (identical(rw$issue_code, "cross_table_ambiguous")) "ambigua" else "incorrecta_ejecucion",
        issue_code = rw$issue_code %||% "runtime_skip",
        detalle = rw$detail %||% "La regla no pudo evaluarse.",
        expresion_evaluada = pr$rhs
      )
      next
    }
    rhs2 <- rw$rhs2 %||% pr$rhs

    data_env <- data_env_cache[[base_key]]
    if (is.null(data_env)) {
      data_env <- .build_alias_env(df)
      data_env_cache[[base_key]] <- data_env
    }

    eval_env <- rlang::env(
      data_env,
      is_yes = is_yes,
      is_no  = is_no,
      grepl  = .grepl_perl,
      eq_num_na = eq_num_na,
      eq_chr_na = eq_chr_na,
      choice_label_map = choice_label_map,
      selected_at = selected_at,
      selected_at_char = selected_at_char,   # NUEVO: reemplazo seguro as.character(selected_at())
      count_selected = count_selected,
      num = function(z) suppressWarnings(as.numeric(z)),
      # AGG context
      .AGG_CTX = .AGG_prepare(tablas, base_key),
      AGG_SUM   = AGG_SUM,
      AGG_N     = AGG_N,
      AGG_PASTE = AGG_PASTE,
      REF_VAL   = REF_VAL
    )

    df_env <- df

    # Tapones ODK → R
    rhs2 <- gsub("\\bregex\\s*\\(", "grepl(", rhs2)
    rhs2 <- gsub("\\bcount-selected\\s*\\(", "count_selected(", rhs2)
    rhs2 <- gsub(
      "\\bselected\\s*\\(\\s*([A-Za-z0-9_\\.]+)\\s*,\\s*'([^']+)'\\s*\\)",
      "grepl('(^|\\\\s)\\2(\\\\s|$)', \\1, perl = TRUE)", rhs2, perl = TRUE
    )
    rhs2 <- gsub(
      "\\bselected\\s*\\(\\s*([A-Za-z0-9_\\.]+)\\s*,\\s*\"([^\"]+)\"\\s*\\)",
      "grepl(\"(^|\\\\s)\\2(\\\\s|$)\", \\1, perl = TRUE)", rhs2, perl = TRUE
    )
    # Reemplazo seguro de as.character(selected_at(...)) → selected_at_char(...)
    rhs2 <- gsub("as\\.character\\s*\\(\\s*selected_at\\s*\\(", "selected_at_char(", rhs2, perl = TRUE)

    # --- today() contextual ---
    if ("interviewdate" %in% names(df_env)) {
      rhs2 <- gsub("\\btoday\\s*\\(\\)", "as.Date(interviewdate)", rhs2)
    } else if ("end" %in% names(df_env)) {
      rhs2 <- gsub("\\btoday\\s*\\(\\)", "as.Date(end)", rhs2)
    } else if ("start" %in% names(df_env)) {
      rhs2 <- gsub("\\btoday\\s*\\(\\)", "as.Date(start)", rhs2)
    } else {
      rhs2 <- gsub("\\btoday\\s*\\(\\)", "Sys.Date()", rhs2)
    }

    expr_parsed <- tryCatch(rlang::parse_expr(rhs2), error = function(e) e)
    if (inherits(expr_parsed, "error")) {
      resumen_rows[[i]] <- .make_resumen_row(
        r,
        tabla = base_key,
        flag = pr$flag,
        estado_dinamico = "incorrecta_ejecucion",
        issue_code = "parse_error",
        detalle = conditionMessage(expr_parsed),
        expresion_evaluada = rhs2
      )
      next
    }

    vals <- tryCatch(rlang::eval_bare(expr_parsed, env = eval_env),
                     error = function(e) e)

    if (inherits(vals, "error")) {
      resumen_rows[[i]] <- .make_resumen_row(
        r,
        tabla = base_key,
        flag = pr$flag,
        estado_dinamico = "incorrecta_ejecucion",
        issue_code = "runtime_skip",
        detalle = conditionMessage(vals),
        expresion_evaluada = rhs2
      )
      next
    }

    # Normalización de salida: vector lógico longitud nrow(df)
    if (is.logical(vals)) {
      # ok
    } else if (is.numeric(vals)) {
      vals <- as.logical(vals)
    } else {
      resumen_rows[[i]] <- .make_resumen_row(
        r,
        tabla = base_key,
        flag = pr$flag,
        estado_dinamico = "incorrecta_ejecucion",
        issue_code = "runtime_skip",
        detalle = "La expresion no devolvio un vector logico/numerico evaluable.",
        expresion_evaluada = rhs2
      )
      next
    }
    if (length(vals) == 1L) {
      vals <- rep(vals, nrow(df_env))
    } else if (length(vals) != nrow(df_env)) {
      resumen_rows[[i]] <- .make_resumen_row(
        r,
        tabla = base_key,
        flag = pr$flag,
        estado_dinamico = "incorrecta_ejecucion",
        issue_code = "runtime_skip",
        detalle = "La expresion devolvio una longitud distinta al numero de filas.",
        expresion_evaluada = rhs2
      )
      next
    }

    # Guardar flag
    df[[pr$flag]] <- vals
    tablas[[base_key]] <- df
    rlang::env_bind(data_env, !!pr$flag := vals)

    # Conteo: TRUE = inconsistencia
    flag_vals <- vals
    if (isTRUE(contar_na_como_inconsistencia)) {
      flag_vals[is.na(flag_vals)] <- TRUE
    } else {
      flag_vals[is.na(flag_vals)] <- FALSE
    }
    n_inc <- sum(flag_vals)

    resumen_rows[[i]] <- .make_resumen_row(
      r,
      tabla = base_key,
      flag = pr$flag,
      n_inconsistencias = n_inc,
      estado_dinamico = "correcta",
      expresion_evaluada = rhs2
    )
  }

  resumen <- dplyr::bind_rows(resumen_rows)
  tam <- tibble::tibble(tabla = names(tablas), n = vapply(tablas, nrow, integer(1)))
  resumen <- resumen %>% dplyr::left_join(tam, by = "tabla") %>%
    dplyr::mutate(porcentaje = ifelse(n > 0, n_inconsistencias / n, NA_real_)) %>%
    dplyr::arrange(dplyr::desc(n_inconsistencias))

  diagnostico_reglas <- dplyr::select(
    resumen,
    id_regla, nombre_regla, tabla, flag,
    estado_dinamico, issue_code, detalle, expresion_evaluada
  )

  reglas_meta <- dplyr::select(
    plan2,
    id_regla, nombre_regla,
    tabla_dest, seccion, categoria, tipo_observacion,
    objetivo,                     # <-- AÑADIDO
    variable_1, variable_1_etiqueta,
    variable_2, variable_2_etiqueta,
    variable_3, variable_3_etiqueta,
    procesamiento                 # <-- AÑADIDO
  ) %>% dplyr::rename(tabla = tabla_dest)

  list(
    datos          = tablas[["principal"]] %||% base$principal,
    datos_tablas   = tablas,
    resumen        = resumen,
    reglas_meta    = reglas_meta,
    diagnostico_reglas = diagnostico_reglas
  )
}

# -------------------------------------------------------------------
# Atajo: evaluar desde Excel
# -------------------------------------------------------------------

#' Atajo: Evaluar cargando el plan directo desde Excel
#'
#' @inheritParams evaluar_consistencia
#' @param path_xlsx Ruta al plan `.xlsx`.
#' @return Lista devuelta por \code{evaluar_consistencia()}.
#' @family validacion
#' @export
#' @examples
#' \dontrun{
#' ev <- evaluar_desde_excel(datos = mis_tablas, path_xlsx = "plan_limpieza.xlsx")
#' }
evaluar_desde_excel <- function(datos,
                                path_xlsx,
                                hoja_principal = NULL,
                                contar_na_como_inconsistencia = FALSE,
                                choices = NULL,
                                use_choice_labels = FALSE){
  plan <- cargar_plan_excel(path_xlsx, sheet = "Plan")
  evaluar_consistencia(
    datos = datos,
    plan  = plan,
    hoja_principal = hoja_principal,
    contar_na_como_inconsistencia = contar_na_como_inconsistencia,
    choices = choices,
    use_choice_labels = use_choice_labels
  )
}

# -------------------------------------------------------------------
# Observaciones por regla
# -------------------------------------------------------------------

#' Extraer observaciones (casos) para una regla
#'
#' Devuelve filas donde la regla marca inconsistencia (TRUE), tomando
#' la **tabla correcta** asociada a esa regla.
#'
#' @param evaluacion Lista de \code{evaluar_consistencia()}.
#' @param regla id/nombre/flag de la regla.
#' @param por Campo: \code{"id_regla"}, \code{"nombre_regla"} o \code{"flag"}.
#' @param incluir_flag Si `TRUE`, agrega la columna del flag.
#' @param contar_na_como_inconsistencia Si `TRUE`, NA cuentan como inconsistencia.
#' @return `tibble` con filas inconsistentes y variables relevantes.
#' @family validacion
#' @export
#' @examples
#' \dontrun{
#' casos <- observaciones_regla(evaluacion = ev, regla = "GEN_006", por = "id_regla")
#' }
observaciones_regla <- function(evaluacion,
                                regla,
                                por = c("id_regla","nombre_regla","flag"),
                                incluir_flag = FALSE,
                                contar_na_como_inconsistencia = FALSE) {
  por <- match.arg(por)
  stopifnot(is.list(evaluacion),
            all(c("datos_tablas","resumen","reglas_meta") %in% names(evaluacion)))

  tablas <- evaluacion$datos_tablas
  res    <- evaluacion$resumen
  meta   <- evaluacion$reglas_meta
  if (!nrow(res)) return(tibble())

  idx_res <- switch(
    por,
    id_regla     = which(res$id_regla     %in% regla),
    nombre_regla = which(res$nombre_regla %in% regla),
    flag         = which(res$flag         %in% regla)
  )
  if (!length(idx_res)) return(tibble())
  i <- idx_res[[1L]]

  id_regla  <- res$id_regla[i]
  flag_name <- res$flag[i]
  tabla_key <- res$tabla[i] %||% "principal"

  mrow <- meta[match(id_regla, meta$id_regla), , drop = FALSE]
  var1 <- mrow$variable_1 %||% NA_character_
  var2 <- mrow$variable_2 %||% NA_character_
  var3 <- mrow$variable_3 %||% NA_character_

  df <- tablas[[tabla_key]] %||% evaluacion$datos
  if (!is.data.frame(df) || !nzchar(flag_name) || !flag_name %in% names(df)) return(tibble())

  mask <- df[[flag_name]]
  if (isTRUE(contar_na_como_inconsistencia)) {
    mask[is.na(mask)] <- TRUE
  } else {
    mask[is.na(mask)] <- FALSE
  }
  inc <- mask
  if (!any(inc, na.rm = TRUE)) return(tibble())

  codigo_alias <- c("Codigo pulso","Código pulso","Codigo_pulso","codigo_pulso","codigo.pulso")
  codigo_col <- codigo_alias[codigo_alias %in% names(df)][1] %||% NULL

  keep <- unique(na.omit(c(
    "_uuid","_id","_index",
    codigo_col,
    var1, var2, var3,
    paste0(var1,"_label"), paste0(var2,"_label"), paste0(var3,"_label")
  )))
  keep <- keep[keep %in% names(df)]
  if (!length(keep)) keep <- intersect(c("_uuid","_id","_index"), names(df))
  out <- tibble::as_tibble(df[inc, keep, drop = FALSE])
}

# -------------------------------------------------------------------
# Totales
# -------------------------------------------------------------------

#' Totales de inconsistencia por regla
#'
#' @param evaluacion Lista devuelta por \code{evaluar_consistencia()}.
#' @return Lista con \code{cabecera} (reglas y total) y \code{detalle} (por regla).
#' @family validacion
#' @export
#' @examples
#' \dontrun{
#' tot <- total_inconsistencias(ev)
#' tot$detalle
#' }
total_inconsistencias <- function(evaluacion) {
  stopifnot(all(c("resumen") %in% names(evaluacion)))
  res <- evaluacion$resumen
  if (!nrow(res)) {
    return(tibble(Reglas = 0L, Total_inconsistencias = 0L))
  }
  tb <- dplyr::transmute(
    res,
    id_regla, nombre_regla, tabla, n_inconsistencias,
    porcentaje = round(100*porcentaje, 1)
  )
  tot <- sum(res$n_inconsistencias %||% 0L, na.rm = TRUE)
  cab <- tibble(Reglas = nrow(res), Total_inconsistencias = tot)
  list(cabecera = cab, detalle = tb)
}

# -------------------------------------------------------------------
# Render de bloques (kable/HTML) y construcción de bloques
# - Metodología nueva: variables de apertura vienen de inst$meta$groups_detail$relevant_vars
#   (mapeo regla -> grupo via prefijo en inst$meta$section_map)
# -------------------------------------------------------------------

`%||%` <- function(a,b) if (is.null(a) || (length(a)==1 && is.na(a))) b else a

# coalesce que ignora columnas ausentes
.safe_coalesce <- function(df, cols, fill = NA_character_) {
  exist <- cols[cols %in% names(df)]
  if (!length(exist)) return(rep(fill, nrow(df)))
  out <- df[[exist[1]]]
  if (length(exist) > 1) {
    for (nm in exist[-1]) out <- dplyr::coalesce(out, df[[nm]])
  }
  out
}

# renombra "si existe": de cualquiera de los nombres en 'from' al nombre único 'to'
.rename_if_present <- function(df, from, to) {
  hit <- intersect(from, names(df))
  if (length(hit)) names(df)[match(hit, names(df))] <- to
  df
}

#' Saneador de etiquetas
#' @keywords internal
.san_label <- function(s) {
  s <- as.character(s %||% "")
  s <- gsub("\\*\\*", "", s, perl = TRUE)
  s <- gsub("\\$\\{([A-Za-z0-9_]+)\\}", "«\\1»", s, perl=TRUE)
  s <- gsub("[\\r\\n]+", " ", s, perl = TRUE)
  trimws(gsub("\\s+", " ", s, perl = TRUE))
}

# helper: resolver tabla desde evaluacion$datos_tablas por nombre (case-insensitive)
.get_tabla_eval <- function(evaluacion, tabla){
  nms <- names(evaluacion$datos_tablas %||% list())
  if (!length(nms)) return(NULL)

  tab_norm <- as.character(tabla %||% "(principal)")
  tab_norm <- if (tolower(tab_norm) %in% c("(principal)","principal","main")) "principal" else tab_norm

  j <- match(tolower(tab_norm), tolower(nms))
  if (!is.na(j)) return(evaluacion$datos_tablas[[nms[j]]])

  NULL
}

.enrich_casos_with_vars <- function(casos, base_df, vars){
  if (!is.data.frame(casos) || !nrow(casos)) return(casos)
  if (!is.data.frame(base_df) || !nrow(base_df)) return(casos)
  if (!length(vars)) return(casos)

  vars <- unique(vars)
  vars <- vars[vars %in% names(base_df)]
  if (!length(vars)) return(casos)

  # elegir llave común (orden de preferencia)
  keys <- c("_uuid","_id","_index")
  key  <- keys[keys %in% names(casos) & keys %in% names(base_df)][1] %||% NA_character_
  if (is.na(key)) return(casos)

  # evitar duplicar cols ya presentes en casos
  vars2 <- setdiff(vars, names(casos))
  if (!length(vars2)) return(casos)

  dplyr::left_join(
    casos,
    dplyr::select(base_df, dplyr::all_of(c(key, vars2))),
    by = key
  )
}

# --- NUEVO: construir “diccionario de secciones” desde inst ---
.inst_section_dict <- function(inst){
  sm <- inst$meta$section_map
  gd <- inst$meta$groups_detail

  # prefijo -> grupo
  prefix_to_group <- stats::setNames(sm$group_name, sm$prefix)

  # grupo -> relevant expression (texto)
  group_to_relevant_expr <- stats::setNames(sm$group_relevant, sm$group_name)

  # grupo -> relevant_vars (lista) desde groups_detail (ya viene parseado)
  gd_key <- match(sm$group_name, gd$gname)
  rel_vars_list <- vector("list", nrow(sm))
  for (i in seq_len(nrow(sm))) {
    j <- gd_key[i]
    rel_vars_list[[i]] <- if (!is.na(j)) gd$relevant_vars[[j]] else character(0)
  }
  group_to_vars <- stats::setNames(rel_vars_list, sm$group_name)

  list(
    prefix_to_group = prefix_to_group,
    group_to_relevant_expr = group_to_relevant_expr,
    group_to_vars = group_to_vars
  )
}

# --- NUEVO: regla -> grupo por prefijo (DETA_, ACCE_, etc.)
.inst_group_from_id <- function(id_regla, dict){
  id <- as.character(id_regla %||% "")
  if (!nzchar(id)) return(NA_character_)
  prefs <- names(dict$prefix_to_group)
  prefs <- prefs[nzchar(prefs)]
  if (!length(prefs)) return(NA_character_)
  hit <- prefs[startsWith(id, prefs)]
  if (!length(hit)) return(NA_character_)
  hit <- hit[which.max(nchar(hit))]
  unname(dict$prefix_to_group[[hit]])
}

# --- NUEVO: vars apertura esperadas según inst (por regla)
.inst_apertura_vars_for_rule <- function(id_regla, dict){
  g <- .inst_group_from_id(id_regla, dict)
  if (is.na(g) || !nzchar(g)) return(character(0))
  v <- dict$group_to_vars[[g]] %||% character(0)
  v <- as.character(v)
  v[nzchar(v)]
}

# --- NUEVO: “condicion de apertura” (texto) según inst, para mostrar en render si se quiere
.inst_apertura_expr_for_rule <- function(id_regla, dict){
  g <- .inst_group_from_id(id_regla, dict)
  if (is.na(g) || !nzchar(g)) return(NA_character_)
  as.character(dict$group_to_relevant_expr[[g]] %||% NA_character_)
}

#' Construir bloques por regla (resumen + casos)
#'
#' Metodología nueva:
#' - Las variables usadas para abrir la sección se toman del instrumento (inst),
#'   usando inst$meta$groups_detail$relevant_vars.
#' - Se agregan a casos con join seguro contra evaluacion$datos_tablas.
#'
#' @param evaluacion Lista devuelta por evaluar_consistencia().
#' @param inst Objeto instrumento (inst) leído por tu lector.
#' @param familias Vector de filtros regex aplicados sobre Tipo.
#' @param ids Vector de id_regla o nombre_regla a mantener.
#' @param solo_relevantes Si TRUE, conserva sólo reglas con n_inconsistencias > 0.
#' @param incluir_solo_inconsistentes Si TRUE, no construye casos cuando n=0.
#' @param incluir_reglas_sin_casos Si FALSE, descarta reglas sin filas en casos.
#' @param contar_na_como_inconsistencia Si TRUE, NA cuenta al construir casos.
#' @param ordenar "n_desc" o "id_asc".
#' @return tibble con metadatos + columna lista casos.
#' @family validacion
#' @export
reporte_bloques <- function(evaluacion,
                            inst,
                            familias = NULL,
                            ids = NULL,
                            solo_relevantes = FALSE,
                            incluir_solo_inconsistentes = FALSE,
                            incluir_reglas_sin_casos = TRUE,
                            contar_na_como_inconsistencia = FALSE,
                            ordenar = c("n_desc","id_asc")) {

  ordenar <- match.arg(ordenar)
  stopifnot(is.list(evaluacion),
            all(c("resumen","reglas_meta","datos_tablas") %in% names(evaluacion)))
  stopifnot(is.list(inst), !is.null(inst$meta))

  dict_inst <- .inst_section_dict(inst)

  res  <- evaluacion$resumen
  meta <- evaluacion$reglas_meta
  if (!nrow(res)) return(tibble::tibble())

  # --- Filtros opcionales ---
  if (!"tipo_observacion" %in% names(res) && "Tipo" %in% names(res)) {
    res$tipo_observacion <- res$Tipo
  }
  if (!is.null(familias) && length(familias)) {
    keep <- vapply(res$tipo_observacion, function(x) {
      any(stringr::str_detect(x %||% "", paste(familias, collapse = "|")))
    }, TRUE)
    res <- res[keep, , drop = FALSE]
  }
  if (!is.null(ids) && length(ids)) {
    res <- res[res$id_regla %in% ids | res$nombre_regla %in% ids, , drop = FALSE]
  }
  if (solo_relevantes) {
    res <- res[res$n_inconsistencias > 0, , drop = FALSE]
  }
  if (!nrow(res)) return(tibble::tibble())

  # --- Join metadatos ---
  bloques <- dplyr::left_join(res, meta, by = c("id_regla","nombre_regla"))

  # --- Asegurar columnas antes de normalizar ---
  need_chr <- c(
    "tabla","tabla.x","tabla.y","Hoja base",
    "seccion","seccion.x","seccion.y",
    "categoria","categoria.x","categoria.y",
    "tipo_observacion","tipo_observacion.x","tipo_observacion.y","Tipo",
    "objetivo","Objetivo",
    "procesamiento"
  )
  for (nm in need_chr) {
    if (!nm %in% names(bloques)) bloques[[nm]] <- NA_character_
  }

  # --- Normalización canónica ---
  bloques <- dplyr::mutate(
    bloques,
    tabla            = dplyr::coalesce(.data$tabla, .data$tabla.x, .data$tabla.y, .data$`Hoja base`, "(principal)"),
    seccion          = dplyr::coalesce(.data$seccion, .data$seccion.x, .data$seccion.y),
    categoria        = dplyr::coalesce(.data$categoria, .data$categoria.x, .data$categoria.y),
    tipo_observacion = dplyr::coalesce(.data$tipo_observacion, .data$tipo_observacion.x, .data$tipo_observacion.y, .data$Tipo),
    objetivo         = dplyr::coalesce(.data$objetivo, .data$Objetivo)
  )

  # --- NUEVO: cond. de apertura desde inst (texto) ---
  #     (solo para mostrar/depurar; no es necesario para el join)
  bloques$condicion_apertura <- vapply(
    bloques$id_regla,
    function(id) .inst_apertura_expr_for_rule(id, dict_inst),
    character(1)
  )

  # --- NUEVO: vars de apertura desde inst (lista) ---
  bloques$vars_apertura <- lapply(
    bloques$id_regla,
    function(id) .inst_apertura_vars_for_rule(id, dict_inst)
  )

  # --- Construir casos por regla + enriquecer con vars apertura ---
  bloques$casos <- lapply(seq_len(nrow(bloques)), function(i) {

    if (isTRUE(incluir_solo_inconsistentes) && (bloques$n_inconsistencias[i] %||% 0L) == 0L) {
      return(tibble::tibble())
    }

    casos <- observaciones_regla(
      evaluacion = evaluacion,
      regla = bloques$id_regla[i],
      por = "id_regla",
      incluir_flag = FALSE,
      contar_na_como_inconsistencia = contar_na_como_inconsistencia
    )

    if (!is.data.frame(casos) || !nrow(casos)) return(casos)

    base_df <- .get_tabla_eval(evaluacion, bloques$tabla[i])
    if (is.null(base_df)) return(casos)

    # vars apertura (inst) filtradas a las que realmente existen en base_df
    must <- bloques$vars_apertura[[i]] %||% character(0)
    must <- unique(as.character(must))
    must <- must[nzchar(must)]
    must <- must[must %in% names(base_df)]
    if (!length(must)) return(casos)

    # opcional: intentar *_label si existieran en base_df
    must_plus <- unique(c(must, paste0(must, "_label")))

    .enrich_casos_with_vars(casos, base_df, must_plus)
  })

  if (!incluir_reglas_sin_casos) {
    keep <- vapply(bloques$casos, function(df) is.data.frame(df) && nrow(df) > 0, TRUE)
    bloques <- bloques[keep, , drop = FALSE]
  }

  # --- Orden final ---
  if (identical(ordenar, "n_desc")) {
    bloques <- dplyr::arrange(bloques, dplyr::desc(.data$n_inconsistencias), .data$id_regla)
  } else {
    bloques <- dplyr::arrange(bloques, .data$id_regla)
  }

  bloques
}

#' Renderizar bloques en HTML (kableExtra)
#' @family validacion
#' @export
render_bloques_kable <- function(
    bloques,
    max_casos = 10,
    mostrar_aleatorios_si_cero = 0,
    fallback_df = NULL,
    cols_id = c("_uuid","_index","Pulso_code","Codigo pulso","Código pulso"),
    cols_interes = NULL,
    seed = NULL,
    alto_resumen = "280px",
    ancho_resumen = "100%",
    alto_casos = "420px",
    ancho_casos = "100%",
    map_clean_to_original = NULL,
    usar_mapeo = FALSE
){
  `%||%` <- function(a,b) if (is.null(a) || (length(a)==1 && is.na(a))) b else a
  nz  <- function(x) is.character(x) && length(x)==1 && !is.na(x) && nzchar(trimws(x))
  esc <- function(x) htmltools::htmlEscape(as.character(x %||% ""))

  stopifnot(is.data.frame(bloques))
  if (!requireNamespace("kableExtra", quietly = TRUE)) stop("Necesitas {kableExtra}.")
  if (!requireNamespace("htmltools", quietly = TRUE)) stop("Necesitas {htmltools}.")
  if (nrow(bloques) == 0) {
    return(htmltools::tags$p(htmltools::tags$em("No hay reglas para mostrar.")))
  }
  if (!is.null(seed)) set.seed(seed)

  apply_mapping <- function(nms){
    if (!isTRUE(usar_mapeo) || is.null(map_clean_to_original)) return(nms)
    m <- map_clean_to_original
    if (!all(c("clean","original") %in% names(m))) return(nms)
    repl <- nms
    idx  <- match(nms, m$clean)
    repl[!is.na(idx)] <- m$original[na.omit(idx)]
    repl
  }

  cards <- vector("list", nrow(bloques))

  for (i in seq_len(nrow(bloques))) {
    b <- bloques[i,]

    cab_id <- paste0("[", b$id_regla %||% "", "]")

    objetivo <- .san_label(dplyr::coalesce(b$objetivo %||% NA_character_, b$Objetivo %||% NA_character_))
    tipo     <- .san_label(dplyr::coalesce(b$tipo_observacion %||% NA_character_, b$Tipo %||% NA_character_,
                                           b$tipo %||% NA_character_, b$categoria %||% NA_character_))

    header_html <-
      htmltools::tagList(
        htmltools::tags$div(style="margin:18px 0;border-top:1px solid #ddd;padding-top:14px"),
        htmltools::tags$h3(esc(cab_id)),
        if (nz(objetivo)) htmltools::tags$div(htmltools::tags$strong("Objetivo:"), " ", esc(objetivo)),
        if (nz(tipo))     htmltools::tags$div(htmltools::tags$strong("Tipo:"), " ", esc(tipo))
      )

    # Resumen
    lab1 <- .san_label(b$variable_1_etiqueta)
    lab2 <- .san_label(b$variable_2_etiqueta)
    lab3 <- .san_label(b$variable_3_etiqueta)

    resumen_raw <- tibble::tibble(
      `Id regla`   = b$id_regla %||% NA_character_,
      `Tabla`      = (b$tabla %||% b$`Hoja base`) %||% "(principal)",
      `Sección`    = b$seccion %||% NA_character_,
      `Variable 1` = b$variable_1 %||% NA_character_,
      `Etiqueta 1` = if (nz(lab1)) lab1 else NA_character_,
      `Variable 2` = b$variable_2 %||% NA_character_,
      `Etiqueta 2` = if (nz(lab2)) lab2 else NA_character_,
      `Variable 3` = b$variable_3 %||% NA_character_,
      `Etiqueta 3` = if (nz(lab3)) lab3 else NA_character_,
      `# inconsist.` = b$n_inconsistencias %||% 0L,
      `%`           = if (!is.na(b$porcentaje)) sprintf("%.1f%%", 100*b$porcentaje) else NA_character_
    )

    cols_chk  <- c("Variable 2","Etiqueta 2","Variable 3","Etiqueta 3")
    drop_cols <- vapply(resumen_raw[cols_chk], function(col) all(is.na(col) | trimws(as.character(col))==""), logical(1))
    keep_cols <- c(setdiff(names(resumen_raw), cols_chk[drop_cols]))
    resumen_df <- resumen_raw[, keep_cols, drop = FALSE]
    names(resumen_df) <- apply_mapping(names(resumen_df))

    k_res <- knitr::kable(resumen_df, format = "html", align = "l", escape = TRUE) |>
      kableExtra::kable_styling(full_width = FALSE,
                                bootstrap_options = c("striped","condensed"),
                                font_size = 13) |>
      kableExtra::scroll_box(height = alto_resumen, width = ancho_resumen,
                             box_css = "overflow-x:auto; overflow-y:auto; border:1px solid #ddd; padding:6px; border-radius:6px;")
    k_res_node <- htmltools::HTML(as.character(k_res))

    # Casos
    casos <- b$casos[[1]]
    if (!is.data.frame(casos)) casos <- tibble::tibble()

    if (!nrow(casos) && mostrar_aleatorios_si_cero > 0) {
      if (is.data.frame(fallback_df) && nrow(fallback_df)) {
        n <- min(nrow(fallback_df), mostrar_aleatorios_si_cero)
        casos <- fallback_df[sample.int(nrow(fallback_df), n), , drop = FALSE]
      }
    }

    # NUEVO: columnas deseadas incluyen vars_apertura (ya deberían venir en casos si hubo join)
    apertura_vars <- b$vars_apertura[[1]] %||% character(0)

    desired_cols <- unique(na.omit(c(
      cols_id, b$variable_1, b$variable_2, b$variable_3,
      paste0(b$variable_1, "_label"),
      paste0(b$variable_2, "_label"),
      paste0(b$variable_3, "_label"),
      apertura_vars,
      paste0(apertura_vars, "_label"),
      cols_interes
    )))

    keep <- intersect(desired_cols, names(casos))
    if (!length(keep)) keep <- intersect(c("_uuid","_id","_index"), names(casos))
    if (!length(keep)) keep <- head(names(casos), 6)

    casos_show <- casos[, keep, drop = FALSE]
    names(casos_show) <- apply_mapping(names(casos_show))

    k_casos_node <- if (nrow(casos_show)) {
      k_casos <- knitr::kable(utils::head(casos_show, max_casos), format = "html", align = "l", escape = TRUE) |>
        kableExtra::kable_styling(full_width = FALSE,
                                  bootstrap_options = c("hover","condensed"),
                                  font_size = 12) |>
        kableExtra::scroll_box(height = alto_casos, width = ancho_casos,
                               box_css = "overflow-x:auto; overflow-y:auto; border:1px solid #ddd; padding:6px; border-radius:6px;")
      htmltools::HTML(as.character(k_casos))
    } else {
      htmltools::HTML("<em>Casos: (ninguno)</em>")
    }

    # Procesamiento (auditoría)
    proc <- as.character(b$procesamiento %||% "")
    proc_node <- if (nz(proc)) {
      htmltools::tags$div(
        style="margin-top:8px;",
        htmltools::tags$strong("Procesamiento utilizado en R:"),
        htmltools::tags$pre(
          style="white-space:pre-wrap; border:1px solid #ddd; padding:8px; border-radius:6px; background:#fafafa; font-family: ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace;",
          htmltools::HTML(proc)
        )
      )
    } else htmltools::HTML("")

    cards[[i]] <- htmltools::tagList(
      htmltools::tags$div(style = "margin:18px 0; border-top:1px solid #ddd; padding-top:14px"),
      header_html,
      k_res_node,
      k_casos_node,
      proc_node
    )
  }

  htmltools::tagList(cards)
}
