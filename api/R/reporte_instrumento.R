#' Construir objeto de metadatos a partir de un XLSForm (fase de reporte)
#'
#' `reporte_instrumento()` lee las hojas `survey` y `choices` de un XLSForm
#' y construye un objeto de metadatos que concentra etiquetas de preguntas,
#' listas de opciones y órdenes de respuesta.
#'
#' Esta función está pensada como parte de una tercera fase del flujo de trabajo:
#' se aplica de forma general sobre el instrumento luego de los procesos de
#' evaluación de consistencia y de recodificación/adaptación del instrumento y
#' de la base de datos. Su objetivo es entregar un objeto estable de metadatos
#' que sirva como entrada para la generación de libros de códigos, tablas de
#' frecuencias, cruces y exportaciones a otros formatos.
#'
#' A diferencia de una detección automática, las variables de fecha y hora se
#' declaran explícitamente mediante los argumentos `vars_fecha`, `vars_hora` y
#' `vars_datetime`.
#'
#' @param path Ruta al archivo `.xlsx` del formulario (XLSForm). Debe contener
#'   al menos las hojas `survey` y `choices`.
#' @param sheet_survey Nombre de la hoja que contiene la sección survey.
#'   Por defecto `"survey"`.
#' @param sheet_choices Nombre de la hoja que contiene la sección choices.
#'   Por defecto `"choices"`.
#' @param lang Código de idioma que se usará para seleccionar la columna de
#'   etiquetas (`label::es`, `label::en`, etc.). Por defecto `"es"`.
#' @param prefer_label Nombre exacto de la columna de etiqueta a priorizar.
#'   Si no es `NULL`, se usa esta columna siempre que exista; de lo contrario
#'   se intenta detectar automáticamente una columna `label::[lang]` o `label`.
#' @param listas_ordinales Vector opcional con los nombres de `list_name` que
#'   deben tratarse como ordinales al sugerir niveles de medición.
#' @param vars_fecha Vector opcional con los nombres de variables que deben
#'   tratarse como fechas (por ejemplo, para su conversión posterior a `Date`).
#' @param vars_hora Vector opcional con los nombres de variables que deben
#'   tratarse como horas (por ejemplo, para su conversión posterior a `hms`).
#' @param vars_datetime Vector opcional con los nombres de variables que deben
#'   tratarse como fecha-hora (por ejemplo, para su conversión posterior a
#'   `POSIXct`).
#'
#' @return Un objeto de clase `"prosecnur_instrumento"` que es una lista con,
#'   al menos, los siguientes componentes:
#'   \describe{
#'     \item{path}{Ruta del archivo XLSForm utilizado.}
#'     \item{lang}{Idioma seleccionado.}
#'     \item{label_col_survey}{Nombre de la columna de etiqueta seleccionada
#'       para la hoja `survey`.}
#'     \item{label_col_choices}{Nombre de la columna de etiqueta seleccionada
#'       para la hoja `choices`.}
#'     \item{survey}{Tabla `survey` con columnas `name`, `type`, `list_name`,
#'       `label` y otras columnas originales, además de `measure_sugerida`.}
#'     \item{choices}{Tabla `choices` con columnas `list_name`, `name`,
#'       `label` y columnas adicionales.}
#'     \item{var_labels}{Vector nombrado `nombre_variable -> etiqueta`.}
#'     \item{dicc_label_to_code}{Lista nombrada por `list_name` con vectores
#'       `label -> code`.}
#'     \item{dicc_code_to_label}{Lista nombrada por `list_name` con vectores
#'       `code -> label`.}
#'     \item{orders_list}{Lista nombrada por variable, con elementos que
#'       contienen `names` (códigos), `labels` (etiquetas) y `label`
#'       (etiqueta de la pregunta).}
#'     \item{measure_rules}{Tabla con `name`, `type`, `list_name` y
#'       `measure_sugerida`.}
#'     \item{vars_fecha}{Vector con los nombres de las variables declaradas
#'       como fecha.}
#'     \item{vars_hora}{Vector con los nombres de las variables declaradas
#'       como hora.}
#'     \item{vars_datetime}{Vector con los nombres de las variables declaradas
#'       como fecha-hora.}
#'   }
#'
#' @importFrom readxl read_excel
#' @importFrom dplyr select mutate filter group_by summarise distinct
#' @importFrom dplyr case_when arrange
#' @importFrom tidyr separate
#' @importFrom tibble deframe
#' @importFrom stats setNames
#' @family reporte
#' @export
#'
#' @examples
#' \dontrun{
#' instr <- reporte_instrumento(
#'   path            = "OPS_EES_instrumento_CODE.xlsx",
#'   lang            = "es",
#'   listas_ordinales = c("frecuencia", "acuerdo"),
#'   vars_fecha       = c("fecha_visita"),
#'   vars_hora        = c("hora_inicio", "hora_fin")
#' )
#' names(instr$var_labels)
#' }
reporte_instrumento <- function(path,
                                sheet_survey     = "survey",
                                sheet_choices    = "choices",
                                lang             = "es",
                                prefer_label     = NULL,
                                listas_ordinales = NULL,
                                vars_fecha       = NULL,
                                vars_hora        = NULL,
                                vars_datetime    = NULL) {

  # ---- Leer hojas base ----------------------------------------------------
  survey_raw  <- readxl::read_excel(path, sheet = sheet_survey)
  choices_raw <- readxl::read_excel(path, sheet = sheet_choices)

  # ---- Helper: detectar columna de label ----------------------------------
  detectar_label_col <- function(x, prefer_label, lang) {
    if (!is.null(prefer_label) && prefer_label %in% names(x)) {
      return(prefer_label)
    }
    candidatos <- c(
      paste0("label::", lang),
      paste0("label::", toupper(lang)),
      paste0("label::", tolower(lang)),
      "label"
    )
    candidatos <- candidatos[candidatos %in% names(x)]
    if (length(candidatos) == 0L) {
      return(NA_character_)
    }
    candidatos[1L]
  }

  survey_label_col  <- detectar_label_col(survey_raw,  prefer_label, lang)
  choices_label_col <- detectar_label_col(choices_raw, prefer_label, lang)

  # ---- Preparar survey ----------------------------------------------------
  survey <- survey_raw

  if (!is.na(survey_label_col) && survey_label_col %in% names(survey)) {
    survey$label <- survey[[survey_label_col]]
  } else {
    survey$label <- NA_character_
  }

  if ("type" %in% names(survey)) {
    survey <- tidyr::separate(
      survey,
      col   = "type",
      into  = c("type", "list_name"),
      sep   = " ",
      fill  = "right"
    )
  } else {
    survey$type      <- NA_character_
    survey$list_name <- NA_character_
  }

  # ---- Preparar choices ---------------------------------------------------
  choices <- choices_raw

  if (!is.na(choices_label_col) && choices_label_col %in% names(choices)) {
    choices$label <- choices[[choices_label_col]]
  } else {
    choices$label <- NA_character_
  }

  if (!"list_name" %in% names(choices)) {
    choices$list_name <- NA_character_
  }
  if (!"name" %in% names(choices)) {
    choices$name <- NA_character_
  }

  # ---- Vector de var_labels -----------------------------------------------
  var_labels <- survey %>%
    dplyr::filter(!is.na(name), name != "", !is.na(label)) %>%
    dplyr::mutate(label = as.character(label)) %>%
    dplyr::select(name, label) %>%
    tibble::deframe()

  # ---- Diccionarios label <-> code por list_name --------------------------
  choices_lc <- choices %>%
    dplyr::filter(
      !is.na(list_name), list_name != "",
      !is.na(name),      name      != "",
      !is.na(label)
    ) %>%
    dplyr::mutate(
      name  = as.character(name),
      label = as.character(label)
    ) %>%
    dplyr::group_by(list_name) %>%
    dplyr::summarise(
      label_to_code = list(stats::setNames(name,  label)),
      code_to_label = list(stats::setNames(label, name)),
      .groups = "drop"
    )

  dicc_label_to_code <- stats::setNames(
    choices_lc$label_to_code,
    choices_lc$list_name
  )

  dicc_code_to_label <- stats::setNames(
    choices_lc$code_to_label,
    choices_lc$list_name
  )

  # ---- orders_list por variable -------------------------------------------
  orders_list <- list()

  if (nrow(survey) > 0L) {
    survey_lns <- survey %>%
      dplyr::filter(!is.na(list_name), list_name != "") %>%
      dplyr::select(name, list_name, label) %>%
      dplyr::distinct()

    if (nrow(survey_lns) > 0L) {
      for (i in seq_len(nrow(survey_lns))) {
        var    <- survey_lns$name[i]
        ln     <- survey_lns$list_name[i]
        varlab <- survey_lns$label[i]

        if (!ln %in% names(dicc_code_to_label)) next

        codes_labels <- dicc_code_to_label[[ln]]
        orders_list[[var]] <- list(
          names  = names(codes_labels),      # códigos
          labels = unname(codes_labels),     # etiquetas
          label  = varlab                    # etiqueta de la pregunta
        )
      }
    }
  }

  # ---- Flags escalares ----------------------------------------------------
  tiene_ordinales   <- !is.null(listas_ordinales) && length(listas_ordinales) > 0
  tiene_vars_fecha  <- !is.null(vars_fecha)       && length(vars_fecha)       > 0
  tiene_vars_hora   <- !is.null(vars_hora)        && length(vars_hora)        > 0
  tiene_vars_dt     <- !is.null(vars_datetime)    && length(vars_datetime)    > 0

  # ---- measure_sugerida (usando listas declaradas) ------------------------
  survey_proc <- survey %>%
    dplyr::mutate(
      measure_sugerida = dplyr::case_when(
        # 1) listas ordinales (por list_name)
        tiene_ordinales &
          !is.na(list_name) &
          list_name %in% listas_ordinales ~ "ordinal",

        # 2) variables declaradas como fecha / hora / datetime
        tiene_vars_fecha  & name %in% vars_fecha    ~ "scale",
        tiene_vars_hora   & name %in% vars_hora     ~ "scale",
        tiene_vars_dt     & name %in% vars_datetime ~ "scale",

        # 3) select_one / select_multiple (por defecto nominal)
        grepl("^select_one", type) |
          grepl("^select_multiple", type) ~ "nominal",

        # 4) numéricos
        type %in% c("integer", "decimal", "calculate") ~ "scale",

        # 5) textuales
        type %in% c("text", "note") ~ "nominal",

        TRUE ~ NA_character_
      )
    )

  measure_rules <- survey_proc %>%
    dplyr::select(name, type, list_name, measure_sugerida)

  # ---- Armar objeto resultado ---------------------------------------------
  res <- list(
    path               = path,
    lang               = lang,
    label_col_survey   = survey_label_col,
    label_col_choices  = choices_label_col,
    survey             = survey_proc,
    choices            = choices,
    var_labels         = var_labels,
    dicc_label_to_code = dicc_label_to_code,
    dicc_code_to_label = dicc_code_to_label,
    orders_list        = orders_list,
    measure_rules      = measure_rules,
    vars_fecha         = vars_fecha,
    vars_hora          = vars_hora,
    vars_datetime      = vars_datetime
  )

  class(res) <- c("prosecnur_instrumento", "list")
  res
}
