#' @noRd
guess_spss_measure <- function(x,
                               var_name = NULL,
                               ordinal_list_names = NULL,
                               instrumento = NULL) {

  # 0) Forzar ordinal por list_name del instrumento (aunque survey$list_name sea NA)
  if (!is.null(var_name) &&
      !is.null(ordinal_list_names) &&
      length(ordinal_list_names) > 0 &&
      !is.null(instrumento) &&
      !is.null(instrumento$survey) &&
      all(c("name","type") %in% names(instrumento$survey))) {

    surv <- instrumento$survey
    i <- which(!is.na(surv$name) & as.character(surv$name) == var_name)[1]

    if (!is.na(i)) {
      # 1) intentar list_name directo si existe y está lleno
      ln <- NA_character_
      if ("list_name" %in% names(surv)) {
        ln0 <- as.character(surv$list_name[i])
        if (!is.na(ln0) && nzchar(trimws(ln0))) ln <- trimws(ln0)
      }

      # 2) fallback: extraer desde type: "select_one satisfaccion" -> "satisfaccion"
      if (is.na(ln) || !nzchar(ln)) {
        tp <- trimws(as.character(surv$type[i]))
        if (!is.na(tp) && nzchar(tp) && grepl("^select_one\\b|^select_multiple\\b", tp)) {
          ln2 <- sub("^(select_one|select_multiple)\\s+([^\\s]+).*$", "\\2", tp)
          if (!is.na(ln2) && nzchar(ln2)) ln <- ln2
        }
      }

      if (!is.na(ln) && nzchar(ln) && ln %in% ordinal_list_names) {
        return("ORDINAL")
      }
    }
  }

  # 1) Si viene medida explícita en el atributo, se respeta SIEMPRE
  m <- attr(x, "measure", exact = TRUE)
  if (!is.null(m)) {
    m <- tolower(as.character(m))
    if (m %in% c("nominal","ordinal","scale")) return(toupper(m))
  }

  # 2) Si tiene value labels (aunque sea character), es categórica
  labs <- attr(x, "labels", exact = TRUE)
  if (!is.null(labs) && length(labs) > 0) return("NOMINAL")

  # 3) haven_labelled sin labels -> nominal
  if (inherits(x, "haven_labelled")) return("NOMINAL")

  # 4) factor -> nominal
  if (is.factor(x)) return("NOMINAL")

  # 5) numeric -> scale
  if (is.numeric(x)) return("SCALE")

  NA_character_
}

#' Adaptar la base para reporte y estructura tipo SPSS
#'
#' `reporte_data()` toma una base de datos ya adaptada (tras la evaluación de
#' consistencia y la recodificación/adaptación del instrumento y la data) y un
#' objeto de instrumento creado con [reporte_instrumento()], y realiza tres
#' tareas principales:
#' \enumerate{
#'   \item Asigna metadatos: etiquetas de variables (`label`), etiquetas de
#'         valor (`labels`) y nivel de medición sugerido (`measure`).
#'   \item Adapta las variables de elección única (`select_one`) para que
#'         utilicen códigos en lugar de etiquetas, solo cuando detecta que en
#'         la base hay valores que coinciden con las etiquetas del instrumento.
#'         Los códigos ya presentes se conservan sin modificación.
#'   \item Normaliza las variables derivadas de `select_multiple`:
#'         dummies en 0/1, con `label` de la opción, `labels` = `"No"/"Sí"`,
#'         y nombres `var.codigo` (punto) en lugar de `var/opción`. La lógica
#'         de valores es:
#'         \itemize{
#'           \item `1` = opción marcada;
#'           \item `0` = opción no marcada, pero se marcó alguna otra opción
#'                 en esa pregunta;
#'           \item `NA` = la pregunta no fue respondida (ninguna opción
#'                 marcada, todas las dummies quedan en `NA`).
#'         }
#'         Si existen variables madre (`var` o `var_recod`) se usan para
#'         generar dummies y luego se eliminan, de modo que en la base final
#'         solo queden las dummies.
#' }
#'
#' La función no escribe ningún archivo ni crea objetos `labelled_spss`. La
#' conversión final a objetos SPSS (por ejemplo con [haven::labelled_spss()])
#' debe realizarse en una etapa posterior (por ejemplo, en una función
#' `reporte_spss()`). Si además se requiere un archivo `.sps` complementario
#' para aplicar niveles de medida o formatos en SPSS, ese paso puede resolverse
#' con `reporte_spss(path_sps = ...)` o con [generar_spss_niveles()].
#'
#' @param data Un `data.frame` o `tibble` que contenga la base de datos ya
#'   adaptada (nombres finales de variables) tras las fases de consistencia y
#'   recodificación.
#' @param instrumento Objeto devuelto por [reporte_instrumento()], que
#'   contiene los metadatos del XLSForm (survey, choices, diccionarios, etc.).
#' @param var_peso (Opcional) Nombre de la variable de peso en `data`. Si se
#'   proporciona y existe en la base, se registra como atributo `var_peso`.
#' @param dummy_vars (Opcional) Vector con nombres adicionales de variables
#'   dummy (0/1) a las que se desee asignar etiquetas de valor genéricas
#'   `"No"` / `"Sí"`. Todas las variables cuyo nombre contenga `"/"` se tratan
#'   automáticamente como dummies de `select_multiple`, por lo que este
#'   argumento es únicamente complementario.
#' @param dummies_na_to_zero (Obsoleto) Se mantiene por compatibilidad, pero
#'   la lógica actual trata las filas sin ninguna opción marcada como `NA`
#'   en todas las dummies, independientemente de este argumento.
#'
#' @return El mismo objeto `data` pero:
#'   \itemize{
#'     \item Con variables `select_one` en códigos cuando se detectan labels
#'           provenientes del instrumento.
#'     \item Con dummies 0/1 de `select_multiple` renombradas `var.codigo`
#'           (punto) y etiquetadas con `label` (texto de la opción) y
#'           `labels` = `"No"` / `"Sí"`.
#'     \item Sin variables madre de `select_multiple` (ni originales ni
#'           recodificadas): solo se conservan las dummies.
#'     \item Con atributos `label`, `labels` y `measure` según el instrumento,
#'           completando `measure` faltante con una heurística coherente con
#'           SPSS cuando no hay regla explícita.
#'     \item Con atributos a nivel de objeto:
#'       \describe{
#'         \item{instrumento_reporte}{Metadatos completos del instrumento.}
#'         \item{var_peso}{Nombre de la variable de peso (si se proporcionó).}
#'         \item{vars_fecha}{Variables declaradas como fecha en el instrumento.}
#'         \item{vars_hora}{Variables declaradas como hora.}
#'         \item{vars_datetime}{Variables declaradas como fecha-hora.}
#'       }
#'     \item Con clase adicional `"prosecnur_reporte_tbl"` para facilitar su uso
#'           en otras funciones de reporte.
#'   }
#'
#' @family reporte
#' @export
reporte_data <- function(data,
                         instrumento,
                         var_peso           = NULL,
                         dummy_vars         = NULL,
                         dummies_na_to_zero = TRUE,
                         ordinal_vars       = NULL,
                         ordinal_list_names = NULL) {

  if (!is.data.frame(data)) {
    stop("`data` debe ser un data.frame o tibble.", call. = FALSE)
  }

  if (is.null(instrumento) || !is.list(instrumento)) {
    stop("`instrumento` debe ser un objeto lista devuelto por `reporte_instrumento()`.",
         call. = FALSE)
  }

  if (!inherits(instrumento, "prosecnur_instrumento")) {
    warning("`instrumento` no tiene clase 'prosecnur_instrumento'. ",
            "Se usará igualmente, asumiendo la estructura esperada.",
            call. = FALSE)
  }

  survey             <- instrumento$survey
  choices            <- instrumento$choices
  var_labels         <- instrumento$var_labels
  measure_rules      <- instrumento$measure_rules
  dicc_label_to_code <- instrumento$dicc_label_to_code
  dicc_code_to_label <- instrumento$dicc_code_to_label

  # -------------------------------------------------------------------------
  # Helpers internos
  # -------------------------------------------------------------------------
  clean_dummy_name <- function(x) {
    base <- gsub("/", ".", x)
    base <- iconv(base, from = "", to = "ASCII//TRANSLIT")
    base <- tolower(base)
    base <- gsub(" ", ".", base)
    base <- gsub("[^a-z0-9._]", "_", base)
    base <- gsub("_+", "_", base)
    base <- gsub("\\.+", ".", base)
    base <- gsub("^[_\\.]+|[_\\.]+$", "", base)
    base
  }

  canon_txt <- function(x) {
    x <- as.character(x)
    x <- tolower(x)
    x <- iconv(x, from = "", to = "ASCII//TRANSLIT")
    x <- gsub("[^a-z0-9]+", " ", x)
    x <- trimws(x)
    x <- gsub("\\s+", " ", x)
    x
  }

  # -------------------------------------------------------------------------
  # 1) Recode select_one: de labels a códigos cuando haya labels presentes
  # -------------------------------------------------------------------------
  if (!is.null(survey) &&
      all(c("name", "type", "list_name") %in% names(survey)) &&
      !is.null(dicc_label_to_code)) {

    so_vars <- survey$name[grepl("^select_one", survey$type)]
    so_vars <- intersect(so_vars, names(data))

    for (v in so_vars) {
      ln  <- get_list_name(v, survey)
      if (is.na(ln) || !ln %in% names(dicc_label_to_code)) next

      map_lab_to_code <- dicc_label_to_code[[ln]]   # labels -> codes (char)
      if (is.null(map_lab_to_code) || length(map_lab_to_code) == 0L) next

      codes_vec  <- as.character(unname(map_lab_to_code))
      labels_vec <- as.character(names(map_lab_to_code))

      x_chr <- as.character(data[[v]])
      vals  <- unique(trimws(x_chr[!is.na(x_chr) & x_chr != ""]))

      if (!length(vals)) next

      prop_labels <- mean(vals %in% labels_vec)
      prop_codes  <- mean(vals %in% codes_vec)

      if (prop_labels > 0) {
        x_rec <- dplyr::recode(
          x_chr,
          !!!map_lab_to_code,
          .default = x_chr
        )
        data[[v]] <- x_rec
      }
    }
  }

  # -------------------------------------------------------------------------
  # 2) Tratamiento de select_multiple: generación de dummies y semántica NA/0/1
  # -------------------------------------------------------------------------
  sm_mothers_to_drop <- character(0)

  if (!is.null(survey) && all(c("name", "type", "list_name") %in% names(survey))) {

    sm_vars <- survey$name[grepl("^select_multiple", survey$type)]

    for (v in sm_vars) {

      ln  <- get_list_name(v, survey)

      dict_code_to_lab <- NULL
      if (!is.na(ln) &&
          !is.null(dicc_code_to_label) &&
          ln %in% names(dicc_code_to_label)) {

        dict_code_to_lab <- dicc_code_to_label[[ln]]  # code -> label
      }

      mother_measure <- NULL
      if (!is.null(measure_rules) &&
          "name" %in% names(measure_rules) &&
          "measure_sugerida" %in% names(measure_rules)) {

        mm <- measure_rules$measure_sugerida[measure_rules$name == v]
        if (length(mm) > 0 && !is.na(mm[1])) {
          mother_measure <- as.character(mm[1])
        }
      }

      # Madres asociadas a esta múltiple (original + recodificadas/auxiliares)
      mothers_candidatas <- c(
        v,
        paste0(v, c("_recod", "_sm", "_filtro", "_aux", "_tmp"))
      )
      mothers_candidatas <- intersect(mothers_candidatas, names(data))

      # -------------------------------------------------------------------
      # 2.1 Generar dummies a partir de madres (incluyendo var_recod)
      # -------------------------------------------------------------------
      for (m in mothers_candidatas) {

        x <- as.character(data[[m]])

        # Normalizar separadores a ";"
        x[is.na(x) | x == "NA" | !nzchar(x)] <- NA_character_
        x <- gsub("\\s+", ";", x)
        x <- gsub(",", ";", x)
        x <- gsub(";{2,}", ";", x)
        x <- gsub("^;|;$", "", x)
        data[[m]] <- x

        codigos <- unique(unlist(strsplit(x[!is.na(x)], ";", fixed = TRUE)))
        codigos <- codigos[!is.na(codigos) & nzchar(codigos)]

        if (length(codigos) == 0L) next

        for (codi in codigos) {
          dummy_name <- paste0(m, "/", codi)

          if (!dummy_name %in% names(data)) {
            nueva <- rep(NA_real_, length(x))

            no_na <- !is.na(x)
            if (any(no_na)) {
              split_list <- strsplit(x[no_na], ";", fixed = TRUE)
              nueva[no_na] <- vapply(
                split_list,
                function(vec) as.numeric(codi %in% vec),
                numeric(1L)
              )
            }

            data[[dummy_name]] <- nueva
          }
        }
      }

      # Dummies totales vinculadas a esta múltiple
      all_dummies_v <- grep(paste0("^", v, "(_recod|_sm|_filtro|_aux|_tmp)?/"),
                            names(data), value = TRUE)

      # Grupos (madres) a partir de las dummies: P14, P14_recod, etc.
      grupos <- unique(sub("/.*$", "", all_dummies_v))

      # -------------------------------------------------------------------
      # 2.2 Semántica NA/0/1 por grupo de madre
      # -------------------------------------------------------------------
      for (m in grupos) {
        group_dummies <- grep(paste0("^", m, "/"), names(data), value = TRUE)
        if (length(group_dummies) == 0L) next

        mat <- sapply(group_dummies, function(col) {
          suppressWarnings(as.numeric(data[[col]]))
        })
        if (is.null(dim(mat))) {
          mat <- matrix(mat, ncol = 1L)
          colnames(mat) <- group_dummies
        }

        responded <- apply(mat == 1, 1, any, na.rm = TRUE)

        for (d in group_dummies) {
          x_num <- suppressWarnings(as.numeric(data[[d]]))

          x_num[!is.na(x_num) & x_num == 1] <- 1
          x_num[!is.na(x_num) & x_num != 1 & responded] <- 0
          x_num[is.na(x_num) & responded] <- 0
          x_num[!responded] <- NA_real_

          data[[d]] <- x_num
        }

        # Marcar madre para eliminar si existe
        if (m %in% names(data)) {
          sm_mothers_to_drop <- union(sm_mothers_to_drop, m)
        }

        # Etiquetas "No"/"Sí" y nivel de medida NOMINAL para las dummies
        for (d in group_dummies) {
          attr(data[[d]], "labels")  <- c(`0` = "No", `1` = "Sí")
          attr(data[[d]], "measure") <- "nominal"

          if (!is.null(dict_code_to_lab) && m %in% c(v, paste0(v, "_recod"))) {
            code_raw <- sub(paste0("^", m, "/"), "", d)
            if (code_raw %in% names(dict_code_to_lab)) {
              opt_label <- as.character(dict_code_to_lab[[code_raw]])
              attr(data[[d]], "label") <- opt_label
            }
          }
        }
      }
    }
  }

  # Eliminar madres de select_multiple (originales y recodificadas)
  if (length(sm_mothers_to_drop) > 0L) {
    sm_mothers_to_drop <- intersect(sm_mothers_to_drop, names(data))
    if (length(sm_mothers_to_drop) > 0L) {
      data <- data[, setdiff(names(data), sm_mothers_to_drop), drop = FALSE]
    }
  }

  # -------------------------------------------------------------------------
  # 3) Asignar etiquetas de variable (attr(, "label"))
  # -------------------------------------------------------------------------
  if (!is.null(var_labels) && length(var_labels) > 0L) {
    vars_comunes <- intersect(names(data), names(var_labels))
    for (v in vars_comunes) {
      attr(data[[v]], "label") <- as.character(var_labels[[v]])
    }
  }

  # -------------------------------------------------------------------------
  # 4) Asignar value-labels para select_one (attr(, "labels"))
  # -------------------------------------------------------------------------
  if (!is.null(survey) && all(c("name", "type", "list_name") %in% names(survey))) {

    so_vars    <- unique(survey$name[grepl("^select_one", survey$type)])
    so_comunes <- intersect(so_vars, names(data))

    for (v in so_comunes) {
      ln  <- get_list_name(v, survey)
      if (is.na(ln) || is.null(ln)) next
      if (is.null(dicc_code_to_label) || !ln %in% names(dicc_code_to_label)) next

      labs <- dicc_code_to_label[[ln]]
      if (is.null(labs) || length(labs) == 0L) next

      labs <- stats::setNames(as.character(labs),
                              nm = as.character(names(labs)))
      attr(data[[v]], "labels") <- labs
    }
  }

  # -------------------------------------------------------------------------
  # 5) Dummies adicionales declaradas en dummy_vars (sin "/")
  # -------------------------------------------------------------------------
  if (!is.null(dummy_vars) && length(dummy_vars) > 0L) {
    dummy_add <- intersect(dummy_vars, names(data))
    if (length(dummy_add) > 0L) {
      for (d in dummy_add) {
        attr(data[[d]], "labels") <- c(`0` = "No", `1` = "Sí")
        if (is.null(attr(data[[d]], "measure"))) {
          attr(data[[d]], "measure") <- "nominal"
        }
      }
    }
  }

  # -------------------------------------------------------------------------
  # 6) Asignar nivel de medición sugerido (attr(, "measure")) según reglas
  # -------------------------------------------------------------------------
  if (!is.null(measure_rules) &&
      all(c("name", "measure_sugerida") %in% names(measure_rules))) {

    vars_comunes_m <- intersect(names(data), measure_rules$name)

    for (v in vars_comunes_m) {
      m <- measure_rules$measure_sugerida[measure_rules$name == v][1]
      if (!is.na(m) && !is.null(m) && nzchar(m)) {
        attr(data[[v]], "measure") <- as.character(m)
      }
    }
  }

  # 6b) Completar measure faltante con heurística SPSS-friendly
  for (v in names(data)) {
    if (is.null(attr(data[[v]], "measure"))) {

      m_inf <- guess_spss_measure(
        x                  = data[[v]],
        var_name           = v,
        ordinal_list_names = ordinal_list_names,
        instrumento        = instrumento
      )

      if (!is.na(m_inf)) {
        attr(data[[v]], "measure") <- tolower(m_inf)
      }
    }
  }

  # -------------------------------------------------------------------------
  # 7) Renombrar dummies con "/" a nombres compatibles SPSS (".")
  # -------------------------------------------------------------------------
  dummy_idx <- grepl("/", names(data))
  if (any(dummy_idx)) {
    names(data)[dummy_idx] <- clean_dummy_name(names(data)[dummy_idx])
  }

  # -------------------------------------------------------------------------
  # 7b) ORDENAR BLOQUES DE select_multiple:
  #     v.1, v.2, ..., v.70, v_otro, v_recod.1, ..., v_recod.70
  # -------------------------------------------------------------------------
  if (!is.null(survey) && "name" %in% names(survey) && "type" %in% names(survey)) {

    sm_vars <- survey$name[grepl("^select_multiple", survey$type)]

    # helper: ordenar nombres por el sufijo numérico después del último "."
    sort_by_suffix <- function(vars) {
      if (!length(vars)) return(vars)
      suf <- sub(".*\\.", "", vars)
      ord <- suppressWarnings(order(as.numeric(suf)))
      vars[ord]
    }

    for (v in sm_vars) {

      dummies_orig  <- grep(paste0("^", v, "\\.[0-9]+$"), names(data), value = TRUE)
      otro_name     <- paste0(v, "_otro")
      dummies_recod <- grep(paste0("^", v, "_recod\\.[0-9]+$"), names(data), value = TRUE)

      group_members <- c(dummies_orig, otro_name, dummies_recod)
      group_members <- unique(group_members[group_members %in% names(data)])
      if (length(group_members) <= 1) next

      dummies_orig_sorted  <- sort_by_suffix(intersect(dummies_orig, names(data)))
      dummies_recod_sorted <- sort_by_suffix(intersect(dummies_recod, names(data)))
      otro_vec <- if (otro_name %in% names(data)) otro_name else character(0)

      group_seq <- c(dummies_orig_sorted, otro_vec, dummies_recod_sorted)
      group_seq <- group_seq[group_seq %in% names(data)]
      if (length(group_seq) <= 1) next

      cols_old <- names(data)
      cols_new <- character(0)
      already  <- FALSE
      group_set <- group_seq

      for (nm in cols_old) {
        if (!already && nm %in% group_set) {
          cols_new <- c(cols_new, group_seq)
          already  <- TRUE
        } else if (already && nm %in% group_set) {
          # ya se insertó el bloque completo, saltar duplicados
          next
        } else {
          cols_new <- c(cols_new, nm)
        }
      }

      if (length(cols_new) == length(cols_old)) {
        data <- data[, cols_new, drop = FALSE]
      }
    }
  }

  # -------------------------------------------------------------------------
  # 8) Registrar variable de peso y variables temporales a nivel de objeto
  # -------------------------------------------------------------------------
  if (!is.null(var_peso)) {
    if (!var_peso %in% names(data)) {
      warning("`var_peso = ", var_peso, "` no se encuentra en `data`. ",
              "Se registrará igual en el atributo, pero la variable no existe.",
              call. = FALSE)
    }
    attr(data, "var_peso") <- var_peso
  }

  attr(data, "vars_fecha")    <- instrumento$vars_fecha
  attr(data, "vars_hora")     <- instrumento$vars_hora
  attr(data, "vars_datetime") <- instrumento$vars_datetime

  attr(data, "instrumento_reporte") <- instrumento

  # -------------------------------------------------------------------------
  # 9) Añadir clase para identificar este objeto en el resto del flujo
  # -------------------------------------------------------------------------
  class(data) <- c("prosecnur_reporte_tbl", class(data))

  data
}
