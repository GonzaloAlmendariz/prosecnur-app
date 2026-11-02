# =============================================================================
# xlsform_logica_impresa.R — la lógica tal como sale en papel (L36 · D-L36-20)
# =============================================================================
#
# El motor ya traduce los `relevant` a instrucciones («Salto a la 5», «Termina
# la encuesta», «En caso de que…») y nunca imprime el código crudo (D-L36-6):
# una condición que no entiende se enuncia de forma general y deja un aviso.
# Lo que faltaba era poder LEERLO antes de imprimir. Impreso › Lógica pide esta
# lista: cada condición, salto y salida, pregunta por pregunta, con el texto
# que irá al papel, más los avisos de lógica del motor. Sale del mismo modelo
# que dibujan el Word y el PDF, así que lo que se lee es lo que se imprime.
# Diseño: docs/qa/l36-doc0-direccion-cuestionario-2026-11-01.md (D-L36-20).

#' Instrucciones de lógica del modelo, en el orden del cuestionario
#'
#' @return `list(list(numero, nombre, tipo, opcion, texto), ...)`; `tipo` es
#'   «condicion» (apertura antes de la pregunta), «salto» (junto a una opción)
#'   o «salida» (al final de la pregunta).
#' @keywords internal
.cuestionario_logica_impresa <- function(model) {
  out <- list()
  agregar <- function(b, tipo, texto, opcion = "") {
    texto <- .form_pdf_clean_text(texto %||% "")
    if (!nzchar(texto)) return(invisible())
    out[[length(out) + 1L]] <<- list(
      numero = .form_pdf_clean_text(b$number %||% ""),
      nombre = .form_pdf_chr(b$name %||% ""),
      tipo = tipo,
      opcion = opcion,
      texto = texto
    )
  }
  for (b in model$blocks %||% list()) {
    if (!(b$kind %||% "") %in% c("question", "matrix")) next
    agregar(b, "condicion", b$opening_condition)
    for (o in b$options %||% list()) {
      codigo <- .form_pdf_clean_text(o$code %||% "")
      etiqueta <- .form_pdf_clean_text(o$label %||% codigo)
      rotulo <- if (nzchar(codigo) && !identical(codigo, etiqueta)) sprintf("%s (%s)", etiqueta, codigo) else etiqueta
      # La casilla «Especifique: ___» viaja en el mismo campo que el salto, pero no es lógica.
      salto <- .form_pdf_clean_text(o$paper_skip %||% "")
      if (grepl("^Especifique", salto)) next
      agregar(b, "salto", salto, rotulo)
    }
    agregar(b, "salida", b$skip)
  }
  out
}

#' Lógica impresa de un workbook con las opciones de Impreso
#' @keywords internal
xlsform_logica_impresa <- function(workbook, options = list()) {
  survey <- .xlsform_editor_payload_to_df(workbook$survey, "survey")
  choices <- .xlsform_editor_payload_to_df(workbook$choices, "choices")
  settings <- .xlsform_editor_payload_to_df(workbook$settings, "settings")
  paper <- if (!is.null(workbook$paper)) .xlsform_editor_payload_to_df(workbook$paper, "paper") else NULL
  model <- tryCatch(
    formulario_pdf_build_model(survey = survey, choices = choices, settings = settings,
                               paper = paper, options = options),
    error = function(e) stop_api(422, "E_LOGICA_IMPRESA_FAILED",
                                 "No pude leer la lógica del formulario para el papel.")
  )
  list(
    ok = TRUE,
    lenguaje = model$logic_language %||% "saltos",
    instrucciones = .cuestionario_logica_impresa(model),
    avisos = I(as.character(model$.logica$avisos %||% character(0)))
  )
}

mount_xlsform_logica_impresa <- function(pr) {
  pr |>
    plumber::pr_post("/api/xlsform-editor/logica-impresa", wrap_endpoint(function(req, res, ...) {
      parsed <- .xlsform_editor_parse_body(req)
      xlsform_logica_impresa(parsed$workbook %||% list(), parsed$options %||% list())
    }))
}
