# Contratos y estado de materiales de Recopiladores (ADR 0046, unidades 11-13).
#
# Esta capa conserva solo recetas, referencias y recibos. Los valores de acceso
# restringidos se resuelven al construir el snapshot efimero del job y nunca se
# escriben en collection_state/v1.

COLLECTION_MATERIAL_TEMPLATE_SCHEMA <- "collection_material_template/v1"
COLLECTION_MATERIAL_INSTANCE_SCHEMA <- "collection_material_instance/v1"
COLLECTION_ARTIFACT_RECEIPT_SCHEMA <- "collection_artifact_receipt/v1"

COLLECTION_MATERIAL_BLOCK_TYPES <- c(
  "brand_header", "brand_strip", "status_tag", "heading", "body", "access_qr",
  "field_grid", "form_lines", "instructions", "application_log", "divider", "footer"
)

# Registro cerrado de presets. Antes las compuertas de preset, material_kind y
# layout vivian hardcodeadas en tres puntos distintos de la validacion; al
# agregar el segundo preset eso ya no escala. Cada entrada declara con que
# layout se dibuja, que clase de material produce y que bloques admite: un
# preset no hereda el vocabulario del otro.
COLLECTION_MATERIAL_PRESETS <- list(
  ficha_aplicacion_a4_v1 = list(
    layout_preset = "single_sheet",
    material_kind = "application_sheet",
    blocks = c(
      "brand_header", "brand_strip", "status_tag", "heading", "body", "access_qr",
      "field_grid", "instructions", "application_log", "divider", "footer"
    )
  ),
  afiche_qr_a4_v1 = list(
    layout_preset = "poster_qr",
    material_kind = "access_poster",
    blocks = c(
      "brand_strip", "heading", "body", "access_qr", "instructions",
      "divider", "footer"
    )
  ),
  # Ficha de campo: la hoja de papel que el aplicador lleva al aula. El QR
  # domina la pagina y debajo va un formulario de lineas que se llena a mano.
  # No comparte layout con `ficha_aplicacion_a4_v1`: alli los datos vienen
  # impresos del plan, aqui casi todo nace en campo.
  ficha_campo_qr_a4_v1 = list(
    layout_preset = "field_form",
    material_kind = "application_sheet",
    # Sin `status_tag`: en esta hoja lo que identifica la ficha es su titulo, y
    # el titulo es el id del colector. Una pildora aparte diria dos veces lo
    # mismo, o peor, algo distinto.
    blocks = c("brand_strip", "heading", "access_qr", "form_lines", "footer")
  )
)

# Ids de logo de la careta. Nunca una ruta: el template solo nombra activos y
# el renderer los resuelve contra un mapa efimero. Asi una plantilla no puede
# apuntar al sistema de archivos ni filtrar rutas al estado persistido.
.cm_asset_id_ok <- function(value) {
  .cc_is_scalar_string(value) && grepl("^[a-z0-9][a-z0-9_-]{0,63}$", value)
}

COLLECTION_MATERIAL_BINDINGS <- c(
  "project.name", "project.period",
  "deployment.deployment_id", "deployment.provider",
  # `unit.operational_code` es «CH 1» / «R 1.2»: el codigo con el que el equipo
  # llama al aula en el libro de agendacion, en Monitoreo y en voz alta. La ficha
  # se titulaba con `unit.label` —«1ges08_0601», el nombre academico— y ese codigo
  # solo aparecia de refilon, dentro del rol de un reemplazo («Reemplazo de CH 3»).
  # En un papel impreso eso no se corrige despues.
  "unit.unit_id", "unit.operational_code", "unit.label", "unit.role",
  "unit.replacement_for", "unit.group",
  "unit.faculty", "unit.course_name", "unit.schedule", "unit.venue",
  "unit.teacher", "unit.sample_label", "unit.eligible_n",
  "access.access_id", "access.logical_collector_id", "access.qr_payload"
)

.cm_problem <- function(path, code, detail) {
  list(path = path, code = code, detail = detail)
}

.cm_template_material <- function(template) {
  material <- template
  material$template_sha256 <- NULL
  material
}

.cm_template_sha256 <- function(template) {
  collection_fingerprint(.cm_template_material(template))
}

.cm_plain_text_problem <- function(value, path) {
  if (is.null(value)) return(list())
  if (!is.character(value) || length(value) != 1L || is.na(value)) {
    return(list(.cm_problem(path, "bad_text", "El texto debe ser un string escalar.")))
  }
  forbidden <- grepl("<[^>]+>|javascript:|https?://|\\{\\{|\\$\\{|=>|window\\.|document\\.", value,
                     ignore.case = TRUE, perl = TRUE)
  if (forbidden) {
    return(list(.cm_problem(
      path, "unsafe_text",
      "El copy del material no admite HTML, CSS, JS, expresiones ni URLs arbitrarias."
    )))
  }
  list()
}

.cm_binding_problem <- function(binding, path) {
  if (!.cc_is_scalar_string(binding) || !(binding %in% COLLECTION_MATERIAL_BINDINGS)) {
    return(list(.cm_problem(
      path, "binding_not_allowed",
      sprintf("Binding no permitido. Use solo: %s.", paste(COLLECTION_MATERIAL_BINDINGS, collapse = ", "))
    )))
  }
  list()
}

.cm_allowed_block_fields <- function(type) {
  common <- c("block_id", "type", "required")
  specific <- switch(type,
    brand_header = c("text"),
    brand_strip = c("assets", "align", "max_height_mm"),
    status_tag = c("text"),
    form_lines = c("rows"),
    heading = c("binding", "text", "max_lines"),
    body = c("binding", "text", "max_lines"),
    access_qr = c("binding", "correction", "quiet_zone", "min_size_mm"),
    field_grid = c("fields"),
    instructions = c("binding", "text", "max_lines"),
    application_log = c("rows", "text", "labels"),
    divider = character(0),
    footer = c("binding", "text"),
    character(0)
  )
  c(common, specific)
}

.cm_block_problems <- function(block, path, allowed_types = COLLECTION_MATERIAL_BLOCK_TYPES) {
  if (!is.list(block)) {
    return(list(.cm_problem(path, "not_object", "Cada bloque debe ser un objeto.")))
  }
  problems <- list()
  type <- block$type
  if (!.cc_is_scalar_string(block$block_id)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0(path, ".block_id"), "missing_block_id", "block_id es obligatorio."
    )
  }
  if (!.cc_is_scalar_string(type) || !(type %in% COLLECTION_MATERIAL_BLOCK_TYPES)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0(path, ".type"), "block_type_not_allowed",
      sprintf("Tipo de bloque no permitido. Registro V1: %s.", paste(COLLECTION_MATERIAL_BLOCK_TYPES, collapse = ", "))
    )
    return(problems)
  }
  if (!(type %in% allowed_types)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0(path, ".type"), "block_not_in_preset",
      sprintf("El preset no dibuja `%s`. Admite: %s.", type, paste(allowed_types, collapse = ", "))
    )
    return(problems)
  }
  unknown <- setdiff(names(block) %||% character(0), .cm_allowed_block_fields(type))
  for (field in unknown) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0(path, ".", field), "block_field_not_allowed",
      sprintf("`%s` no pertenece al contrato cerrado del bloque `%s`.", field, type)
    )
  }
  if (!is.null(block$required) && !is.logical(block$required)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0(path, ".required"), "bad_required", "required debe ser booleano."
    )
  }
  if (!is.null(block$text)) {
    problems <- c(problems, .cm_plain_text_problem(block$text, paste0(path, ".text")))
  }
  if (!is.null(block$binding)) {
    problems <- c(problems, .cm_binding_problem(block$binding, paste0(path, ".binding")))
  }
  if (identical(type, "access_qr")) {
    if (!identical(block$binding, "access.qr_payload")) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".binding"), "qr_binding_protected",
        "access_qr solo puede resolver access.qr_payload por access_id."
      )
    }
    correction <- as.character(block$correction %||% "M")[[1]]
    if (!(correction %in% c("L", "M", "Q", "H"))) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".correction"), "bad_qr_correction", "Correccion QR permitida: L, M, Q o H."
      )
    }
    quiet <- suppressWarnings(as.integer(block$quiet_zone %||% 4L))
    size <- suppressWarnings(as.numeric(block$min_size_mm %||% 35))
    if (is.na(quiet) || quiet < 4L || quiet > 12L) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".quiet_zone"), "bad_qr_quiet_zone", "quiet_zone debe estar entre 4 y 12 modulos."
      )
    }
    if (is.na(size) || size < 28 || size > 70) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".min_size_mm"), "bad_qr_size", "min_size_mm debe estar entre 28 y 70 mm."
      )
    }
  }
  if (identical(type, "brand_strip")) {
    assets <- as.character(unlist(block$assets %||% list(), use.names = FALSE))
    if (!length(assets) || length(assets) > 6L) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".assets"), "bad_brand_assets",
        "La careta admite entre 1 y 6 logos."
      )
    } else if (anyDuplicated(assets) || !all(vapply(as.list(assets), .cm_asset_id_ok, logical(1)))) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".assets"), "bad_brand_asset_id",
        "Cada logo es un id slug unico ([a-z0-9_-]), nunca una ruta ni una URL."
      )
    }
    align <- as.character(block$align %||% "center")[[1]]
    if (!(align %in% c("left", "center", "right"))) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".align"), "bad_brand_align", "align debe ser left, center o right."
      )
    }
    height <- suppressWarnings(as.numeric(block$max_height_mm %||% 14))
    if (is.na(height) || height < 8 || height > 30) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".max_height_mm"), "bad_brand_height",
        "max_height_mm debe estar entre 8 y 30 mm."
      )
    }
  }
  if (identical(type, "status_tag")) {
    text <- as.character(block$text %||% "")[1]
    if (!nzchar(trimws(text)) || nchar(text) > 24L) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".text"), "bad_status_tag",
        "La etiqueta de estado es un texto corto y obligatorio (hasta 24 caracteres)."
      )
    }
  }
  if (identical(type, "form_lines")) {
    rows <- block$rows
    if (!is.list(rows) || !length(rows) || length(rows) > 12L) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".rows"), "bad_form_rows", "El formulario admite entre 1 y 12 renglones."
      )
    } else {
      for (i in seq_along(rows)) {
        row_path <- sprintf("%s.rows[%d]", path, i)
        cells <- if (is.list(rows[[i]])) rows[[i]]$fields else NULL
        if (!is.list(cells) || !length(cells) || length(cells) > 4L) {
          problems[[length(problems) + 1L]] <- .cm_problem(
            paste0(row_path, ".fields"), "bad_form_fields",
            "Cada renglon lleva entre 1 y 4 campos."
          )
          next
        }
        total <- 0
        for (j in seq_along(cells)) {
          cell_path <- sprintf("%s.fields[%d]", row_path, j)
          cell <- cells[[j]]
          if (!is.list(cell) || !.cc_is_scalar_string(cell$label)) {
            problems[[length(problems) + 1L]] <- .cm_problem(
              paste0(cell_path, ".label"), "missing_form_label",
              "Una linea sin etiqueta no le dice nada a quien la llena."
            )
            next
          }
          for (nm in setdiff(names(cell) %||% character(0), c("label", "span", "binding"))) {
            problems[[length(problems) + 1L]] <- .cm_problem(
              paste0(cell_path, ".", nm), "form_field_not_allowed",
              "Cada campo del formulario solo admite label, span y binding."
            )
          }
          problems <- c(problems, .cm_plain_text_problem(cell$label, paste0(cell_path, ".label")))
          # `binding` es la excepcion deliberada a "casi ningun dato existe antes
          # de entrar al aula" (ver cabecera de collection_render_ficha_campo.R):
          # un campo como el total de alumnos matriculados SI se conoce desde el
          # plan, y hacer que el aplicador lo copie a mano es un paso que puede
          # fallar. Se limita al mismo catalogo cerrado que el resto del motor
          # -no cualquier string- para no reabrir un binding libre en un layout
          # que fue disenado sin uno.
          if (!is.null(cell$binding) && !.cc_is_scalar_string(cell$binding)) {
            problems[[length(problems) + 1L]] <- .cm_problem(
              paste0(cell_path, ".binding"), "bad_form_binding",
              "binding, si esta presente, tiene que ser un texto simple."
            )
          }
          span <- suppressWarnings(as.numeric(cell$span %||% (1 / length(cells))))
          if (is.na(span) || span < 0.10 || span > 1) {
            problems[[length(problems) + 1L]] <- .cm_problem(
              paste0(cell_path, ".span"), "bad_form_span",
              "span es la fraccion del ancho del renglon, entre 0.10 y 1."
            )
          } else {
            total <- total + span
          }
        }
        if (total > 1.001) {
          problems[[length(problems) + 1L]] <- .cm_problem(
            paste0(row_path, ".fields"), "form_row_overflow",
            sprintf("Los campos del renglon suman %.2f del ancho; el maximo es 1.", total)
          )
        }
      }
    }
  }
  if (identical(type, "field_grid")) {
    fields <- block$fields
    if (!is.list(fields) || !length(fields)) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".fields"), "missing_fields", "field_grid exige una lista de campos."
      )
    } else {
      for (i in seq_along(fields)) {
        field_path <- sprintf("%s.fields[%d]", path, i)
        field <- fields[[i]]
        # Un campo `blank` es una linea para llenar a mano (fecha de aplicacion,
        # hora de inicio, quien aplico). No tiene binding porque el dato no
        # existe en el plan: nace en campo, sobre el papel.
        is_blank <- is.list(field) && isTRUE(field$blank)
        if (!is_blank) {
          binding <- if (is.character(field)) field else if (is.list(field)) field$binding else NULL
          problems <- c(problems, .cm_binding_problem(binding, paste0(field_path, ".binding")))
        }
        if (is.list(field)) {
          unknown_field <- setdiff(names(field) %||% character(0), c("label", "binding", "blank"))
          for (nm in unknown_field) {
            problems[[length(problems) + 1L]] <- .cm_problem(
              paste0(field_path, ".", nm), "field_property_not_allowed",
              "Cada campo solo admite label, binding y blank."
            )
          }
          if (!is.null(field$blank) && !is.logical(field$blank)) {
            problems[[length(problems) + 1L]] <- .cm_problem(
              paste0(field_path, ".blank"), "bad_blank", "blank debe ser booleano."
            )
          }
          if (is_blank && !.cc_is_scalar_string(field$label)) {
            problems[[length(problems) + 1L]] <- .cm_problem(
              paste0(field_path, ".label"), "missing_blank_label",
              "Un campo para llenar a mano necesita su etiqueta impresa."
            )
          }
          if (is_blank && !is.null(field$binding)) {
            problems[[length(problems) + 1L]] <- .cm_problem(
              paste0(field_path, ".binding"), "blank_with_binding",
              "Un campo `blank` no resuelve datos: o se imprime un valor o se deja la linea."
            )
          }
          problems <- c(problems, .cm_plain_text_problem(field$label %||% "", paste0(field_path, ".label")))
        }
      }
    }
  }
  if (!is.null(block$max_lines)) {
    lines <- suppressWarnings(as.integer(block$max_lines))
    if (is.na(lines) || lines < 1L || lines > 12L) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".max_lines"), "bad_max_lines", "max_lines debe estar entre 1 y 12."
      )
    }
  }
  if (identical(type, "application_log")) {
    rows <- suppressWarnings(as.integer(block$rows %||% 3L))
    if (is.na(rows) || rows < 1L || rows > 6L) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".rows"), "bad_log_rows", "application_log admite entre 1 y 6 filas."
      )
    }
    # `labels` convierte los renglones numerados en un registro con vocabulario.
    # Tres lineas con un "1", un "2" y un "3" delante no le dicen a nadie que
    # anotar, asi que cada aplicador escribe otra cosa —o abre su propia
    # planilla, que es justo lo que la ficha existe para evitar.
    if (!is.null(block$labels)) {
      labels <- block$labels
      if (!is.list(labels) && !is.character(labels)) {
        problems[[length(problems) + 1L]] <- .cm_problem(
          paste0(path, ".labels"), "bad_log_labels", "labels debe ser una lista de textos."
        )
      } else {
        labels <- as.list(labels)
        if (!is.na(rows) && length(labels) > rows) {
          problems[[length(problems) + 1L]] <- .cm_problem(
            paste0(path, ".labels"), "log_labels_overflow",
            sprintf("Hay %d etiquetas para %d renglones.", length(labels), rows)
          )
        }
        for (i in seq_along(labels)) {
          label_path <- sprintf("%s.labels[%d]", path, i)
          if (!.cc_is_scalar_string(labels[[i]])) {
            problems[[length(problems) + 1L]] <- .cm_problem(
              label_path, "bad_log_label", "Cada etiqueta es un texto escalar no vacio."
            )
            next
          }
          problems <- c(problems, .cm_plain_text_problem(labels[[i]], label_path))
        }
      }
    }
  }
  problems
}

#' Vocabulario del registro de aplicacion de la ficha A4.
#'
#' Lo que el aplicador anota en el aula y la hoja no puede saber de antemano.
#' Sale del mismo juego que `collection_material_field_form_rows()` —la hoja de
#' papel que el equipo ya usaba—, recortado a lo que la ficha no imprime ya:
#' facultad, curso, horario, salon y docente van impresos arriba.
#'
#' Es una sola funcion y no dos listas paralelas a proposito: dos vocabularios
#' del mismo registro derivan, y despues no hay forma de juntar lo anotado.
#'
#' @return vector de etiquetas, una por renglon.
#' @export
collection_material_application_log_labels <- function() {
  # **Los nombres son los de la columna del Excel que va a recibir el dato.**
  #
  # Esta ficha es un objeto de PAPEL: el aplicador la llena a mano en el aula,
  # se la entrega al jefe de campo y el jefe de campo TRANSCRIBE al libro, que
  # es lo que la app relee para actualizar Monitoreo. La ficha es, literalmente,
  # el formulario de captura de la hoja «Aulas Aplicadas (Campo)».
  #
  # Y no coincidian. La ficha pedia «Alumnos en aula» donde la hoja espera
  # «CANTIDAD DE ASISTENTES», y «Encuestas aplicadas» donde espera «CANTIDAD DE
  # EFECTIVAS»: quien transcribe tenia que traducir dos nombres en cada aula, y
  # una traduccion repetida 193 veces es una fuente de error que no hacia falta
  # tener.
  #
  # «Observaciones» estaba en la hoja —«OBSERVACIONES SOBRE APLICACIONES»— y en
  # el generador de fichas anterior, y no en esta ficha: lo que el aplicador
  # anotaba se perdia entre el aula y el libro.
  #
  # **Dos casillas por renglon**, separadas por « | ». El bloque admite seis
  # renglones y la hoja pide ocho columnas de campo; una cantidad de tres
  # digitos no necesita doce centimetros de linea. Es lo que ya hacia el
  # generador anterior: «RECHAZOS: ___   N° DE MENORES: ___».
  #
  # Cada casilla lleva el nombre de SU columna en la hoja, para que transcribir
  # sea copiar y no traducir:
  #
  #   CANTIDAD DE ASISTENTES · CANTIDAD DE EFECTIVAS · CANTIDAD DE RECHAZOS
  #   DUPLICADOS (YA RESPONDIERON) · AULA · APLICADOR
  #   FECHA DE APLICACION · HORA DE APLICACION · OBSERVACIONES SOBRE APLICACIONES
  #
  # «Aula» es el salon donde DE VERDAD se aplico, que puede no ser el del
  # catalogo: el estudio ya tuvo cambios de aula y la hoja tiene columna para
  # ello. Observaciones se queda con el renglon entero porque es lo unico que
  # se escribe en prosa.
  c(
    "Asistentes: | Efectivas:",
    "Rechazos: | Duplicados:",
    "Aula: | Aplicador:",
    "Fecha: | Hora:",
    "Observaciones:"
  )
}

#' Plantilla built-in que reproduce la ficha A4 de aulas.
#'
#' @return `collection_material_template/v1` determinista.
#' @export
collection_material_builtin_template <- function() {
  template <- list(
    schema = COLLECTION_MATERIAL_TEMPLATE_SCHEMA,
    template_id = "template-ficha-aplicacion-a4-v1",
    # r2: la ficha declara el rol. Antes titular y reemplazo salian identicos
    # salvo el nombre del aula, y el unico indicio era "Muestra: M1" vs "R1",
    # que solo entiende quien conoce la nomenclatura.
    # r3: el registro de aplicacion dice que anotar, en vez de tres renglones
    # numerados que cada aplicador rellenaba a su criterio.
    # r4: el titulo es el CODIGO OPERATIVO —«CH 1», «R 1.2»— y no el nombre
    # academico del aula. Es el codigo con el que el equipo la llama en el libro
    # de agendacion, en Monitoreo y en voz alta; la ficha se titulaba
    # «1ges08_0601» y ese codigo solo aparecia de refilon dentro del rol de un
    # reemplazo. En un papel impreso eso no se corrige despues.
    revision = 4L,
    preset_id = "ficha_aplicacion_a4_v1",
    material_kind = "application_sheet",
    compatible_adapters = list("aulas_v1"),
    page = list(size = "A4", orientation = "portrait"),
    pages = list(list(
      page_id = "ficha",
      layout_preset = "single_sheet",
      blocks = list(
        list(block_id = "brand", type = "brand_header"),
        # El titulo es el codigo operativo y el aula queda debajo: quien tiene la
        # ficha en la mano busca «CH 1» en su lista, no «1ges08_0601».
        list(block_id = "unit", type = "heading", binding = "unit.operational_code", max_lines = 2L),
        list(block_id = "course", type = "body", binding = "unit.course_name", max_lines = 3L),
        list(
          block_id = "qr", type = "access_qr", binding = "access.qr_payload",
          required = TRUE, correction = "M", quiet_zone = 4L, min_size_mm = 35
        ),
        list(block_id = "details", type = "field_grid", fields = list(
          # **Sin «Rol».** Gonzalo, 2026-08-23: «al aplicador no le sirve mucho
          # saber si el aula es titular o reemplazo». Quien entra al aula
          # aplica igual en las dos; el rol lo necesita quien REPARTE las
          # fichas, y para eso ya esta en la carpeta del paquete y en el nombre
          # del PDF —«CH 5 - URB209_0601.pdf»—.
          #
          # Y el renglon que deja libre es el recurso escaso de esta hoja: lo
          # que sobra arriba es lo que le falta abajo al registro, que se llena
          # a mano.
          # **Lo que el aplicador necesita para entrar al aula**, y nada mas.
          # Gonzalo, 2026-08-23: «no le interesa la muestra, le interesa mas el
          # nombre del docente, el aula, el horario del curso, que el QR este
          # grande y legible para todos los alumnos en el aula».
          #
          # «Muestra» decia «M1» en las 2.616 unidades del sorteo del 22 —lo
          # mismo que ya obligo a quitarla de la tabla de Agenda—: un renglon
          # impreso 2.616 veces para repetir la misma palabra.
          #
          # «Estudiantes» se queda: es el denominador contra el que el aplicador
          # anota los asistentes en el registro de abajo, no un dato de adorno.
          list(label = "Horario", binding = "unit.schedule"),
          list(label = "Aula", binding = "unit.venue"),
          list(label = "Docente", binding = "unit.teacher"),
          list(label = "Estudiantes", binding = "unit.eligible_n")
        )),
        list(block_id = "rule", type = "divider"),
        list(
          block_id = "instructions", type = "instructions",
          text = "Escanea el QR para responder. Si no abre, digita el enlace visible.", max_lines = 4L
        ),
        list(
          block_id = "log", type = "application_log", text = "Registro de aplicacion",
          rows = 5L, labels = as.list(collection_material_application_log_labels())
        ),
        list(block_id = "footer", type = "footer", binding = "project.period")
      )
    )),
    brand_ref = "pulso-default",
    sensitivity_policy = "operational"
  )
  template$template_sha256 <- .cm_template_sha256(template)
  template
}

#' Ficha de aplicacion con careta de co-marca y etiqueta de estado.
#'
#' Misma hoja operativa que `collection_material_builtin_template()` — grid de
#' datos, indicaciones y registro de aplicacion — con los logos del estudio
#' arriba y, opcionalmente, una pildora que declara de que tipo de hoja se
#' trata (piloto, reemplazo, segunda visita).
#'
#' @param assets ids de logo de la careta, izquierda a derecha.
#' @param status_tag texto corto de la pildora, o NULL para omitirla.
#' @param fields filas del grid; por defecto fecha a mano mas el juego clasico.
#' @param instructions copy bajo el enlace.
#' @param log_rows filas del registro de aplicacion.
#' @return `collection_material_template/v1` determinista.
#' @export
collection_material_branded_sheet_template <- function(assets, status_tag = NULL,
                                                       fields = NULL,
                                                       instructions = "Escanea el QR para responder. Si no abre, digita el enlace visible.",
                                                       log_rows = 3L) {
  if (is.null(fields)) {
    fields <- list(
      # Los MISMOS campos que la plantilla sin careta, y por la misma razon: al
      # aplicador no le sirve saber si el aula es titular o reemplazo —eso va en
      # el nombre del PDF— ni cual es la muestra. Se quitaron de la built-in y
      # esta gemela se quedo con «Rol» y «Muestra» dos semanas mas; arreglar una
      # superficie y dejar su copia es como vuelve un defecto ya reparado.
      list(label = "Fecha", blank = TRUE),
      list(label = "Horario", binding = "unit.schedule"),
      list(label = "Aula", binding = "unit.venue"),
      list(label = "Docente", binding = "unit.teacher"),
      list(label = "Estudiantes", binding = "unit.eligible_n")
    )
  }
  blocks <- list(
    list(
      block_id = "careta", type = "brand_strip", assets = as.list(assets),
      align = "left", max_height_mm = 13
    ),
    list(block_id = "unit", type = "heading", binding = "unit.label", max_lines = 2L),
    list(block_id = "course", type = "body", binding = "unit.course_name", max_lines = 3L),
    list(
      block_id = "qr", type = "access_qr", binding = "access.qr_payload",
      required = TRUE, correction = "M", quiet_zone = 4L, min_size_mm = 35
    ),
    list(block_id = "details", type = "field_grid", fields = fields),
    list(block_id = "rule", type = "divider"),
    list(block_id = "instructions", type = "instructions", text = instructions, max_lines = 4L),
    list(block_id = "log", type = "application_log", text = "Registro de aplicacion",
         rows = as.integer(log_rows),
         labels = as.list(utils::head(collection_material_application_log_labels(), log_rows))),
    list(block_id = "footer", type = "footer", binding = "project.period")
  )
  if (!is.null(status_tag)) {
    blocks <- append(blocks, list(list(
      block_id = "estado", type = "status_tag", text = as.character(status_tag)[1]
    )), after = 1L)
  }
  template <- list(
    schema = COLLECTION_MATERIAL_TEMPLATE_SCHEMA,
    template_id = "template-ficha-aplicacion-marca-a4-v1",
    revision = 1L,
    preset_id = "ficha_aplicacion_a4_v1",
    material_kind = "application_sheet",
    compatible_adapters = list("aulas_v1", "kobo_existing_v1", "manual_links_v1"),
    page = list(size = "A4", orientation = "portrait"),
    pages = list(list(page_id = "ficha", layout_preset = "single_sheet", blocks = blocks)),
    brand_ref = "project-brand",
    sensitivity_policy = "operational"
  )
  template$template_sha256 <- .cm_template_sha256(template)
  template
}

#' Valida una plantilla semantica de materiales V1.
#'
#' @param template lista de plantilla.
#' @return lista `ok` y `problems`.
#' @export
collection_material_template_validate <- function(template) {
  if (!is.list(template)) {
    return(list(ok = FALSE, problems = list(.cm_problem(
      "template", "not_object", "La plantilla debe ser un objeto."
    ))))
  }
  problems <- list()
  allowed_template_fields <- c(
    "schema", "template_id", "revision", "preset_id", "material_kind",
    "compatible_adapters", "page", "pages", "brand_ref",
    "sensitivity_policy", "template_sha256"
  )
  for (field in setdiff(names(template) %||% character(0), allowed_template_fields)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0("template.", field), "template_field_not_allowed",
      sprintf("`%s` no pertenece al schema cerrado de template V1.", field)
    )
  }
  if (!identical(template$schema, COLLECTION_MATERIAL_TEMPLATE_SCHEMA)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.schema", "bad_schema", sprintf("Se esperaba '%s'.", COLLECTION_MATERIAL_TEMPLATE_SCHEMA)
    )
  }
  for (field in c("template_id", "preset_id", "material_kind", "brand_ref", "sensitivity_policy")) {
    if (!.cc_is_scalar_string(template[[field]])) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0("template.", field), "missing_string", sprintf("%s es obligatorio.", field)
      )
    }
  }
  preset <- if (.cc_is_scalar_string(template$preset_id)) {
    COLLECTION_MATERIAL_PRESETS[[template$preset_id]]
  } else {
    NULL
  }
  if (is.null(preset)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.preset_id", "preset_not_allowed",
      sprintf(
        "V1 solo compila los presets curados: %s.",
        paste(names(COLLECTION_MATERIAL_PRESETS), collapse = ", ")
      )
    )
  } else if (!identical(template$material_kind, preset$material_kind)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.material_kind", "material_kind_not_allowed",
      sprintf("El preset %s produce %s.", template$preset_id, preset$material_kind)
    )
  }
  if (.cc_is_scalar_string(template$sensitivity_policy) &&
      !(template$sensitivity_policy %in% c("public", "operational", "restricted", "sensitive"))) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.sensitivity_policy", "bad_sensitivity", "Politica de sensibilidad no reconocida."
    )
  }
  if (!.cc_is_integer_ge(template$revision, 1L)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.revision", "bad_revision", "revision debe ser entero >= 1."
    )
  }
  adapters <- unlist(template$compatible_adapters %||% list(), use.names = FALSE)
  if (!length(adapters) || any(!vapply(as.list(adapters), .cc_is_scalar_string, logical(1)))) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.compatible_adapters", "bad_adapters", "Debe declarar al menos un adapter compatible."
    )
  }
  page <- template$page
  if (!is.list(page) || !identical(page$size, "A4") ||
      !(as.character(page$orientation %||% "")[[1]] %in% c("portrait", "landscape"))) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.page", "bad_page", "V1 admite A4 portrait o landscape."
    )
  }
  if (is.list(page)) {
    for (field in setdiff(names(page) %||% character(0), c("size", "orientation"))) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0("template.page.", field), "page_field_not_allowed",
        "page solo admite size y orientation en V1."
      )
    }
  }
  pages <- template$pages
  if (!is.list(pages) || !length(pages)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.pages", "missing_pages", "La plantilla necesita al menos una pagina."
    )
  } else {
    ids <- character(0)
    for (i in seq_along(pages)) {
      path <- sprintf("template.pages[%d]", i)
      page_spec <- pages[[i]]
      if (!is.list(page_spec)) {
        problems[[length(problems) + 1L]] <- .cm_problem(path, "not_object", "Cada pagina debe ser un objeto.")
        next
      }
      for (field in setdiff(names(page_spec) %||% character(0), c("page_id", "layout_preset", "blocks"))) {
        problems[[length(problems) + 1L]] <- .cm_problem(
          paste0(path, ".", field), "page_spec_field_not_allowed",
          "Cada pagina solo admite page_id, layout_preset y blocks."
        )
      }
      if (!.cc_is_scalar_string(page_spec$page_id)) {
        problems[[length(problems) + 1L]] <- .cm_problem(paste0(path, ".page_id"), "missing_page_id", "page_id es obligatorio.")
      } else {
        if (page_spec$page_id %in% ids) {
          problems[[length(problems) + 1L]] <- .cm_problem(paste0(path, ".page_id"), "duplicate_page_id", "page_id debe ser unico.")
        }
        ids <- c(ids, page_spec$page_id)
      }
      if (!is.null(preset) && !identical(page_spec$layout_preset, preset$layout_preset)) {
        problems[[length(problems) + 1L]] <- .cm_problem(
          paste0(path, ".layout_preset"), "layout_not_allowed",
          sprintf("El preset %s se dibuja con %s.", template$preset_id, preset$layout_preset)
        )
      }
      blocks <- page_spec$blocks
      if (!is.list(blocks) || !length(blocks)) {
        problems[[length(problems) + 1L]] <- .cm_problem(paste0(path, ".blocks"), "missing_blocks", "La pagina necesita bloques.")
      } else {
        block_ids <- character(0)
        for (j in seq_along(blocks)) {
          block_path <- sprintf("%s.blocks[%d]", path, j)
          problems <- c(problems, .cm_block_problems(
            blocks[[j]], block_path,
            allowed_types = preset$blocks %||% COLLECTION_MATERIAL_BLOCK_TYPES
          ))
          bid <- if (is.list(blocks[[j]])) blocks[[j]]$block_id else NULL
          if (.cc_is_scalar_string(bid)) {
            if (bid %in% block_ids) {
              problems[[length(problems) + 1L]] <- .cm_problem(
                paste0(block_path, ".block_id"), "duplicate_block_id", "block_id debe ser unico por pagina."
              )
            }
            block_ids <- c(block_ids, bid)
          }
        }
      }
    }
  }
  expected_sha <- .cm_template_sha256(template)
  if (!identical(template$template_sha256, expected_sha)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.template_sha256", "bad_template_sha256",
      "template_sha256 no coincide con la receta canonica."
    )
  }
  problems <- c(problems, .cc_security_problems(template, "template"))
  list(ok = length(problems) == 0L, problems = problems)
}

.cm_template_normalize <- function(template, revision = NULL) {
  if (!is.list(template)) return(template)
  candidate <- template
  if (!is.null(revision)) candidate$revision <- as.integer(revision)
  candidate$template_sha256 <- NULL
  candidate$template_sha256 <- .cm_template_sha256(candidate)
  candidate
}

.cm_material_template <- function(state) {
  state$material_template %||% collection_material_builtin_template()
}

.cm_instances <- function(state) {
  instances <- state$material_instances
  if (!is.list(instances)) list() else unname(Filter(is.list, instances))
}

.cm_receipts <- function(state) {
  receipts <- state$artifact_receipts
  if (!is.list(receipts)) list() else unname(Filter(is.list, receipts))
}

.cm_instance_find <- function(state, instance_id) {
  hits <- Filter(function(x) identical(x$instance_id, instance_id), .cm_instances(state))
  if (length(hits)) hits[[1]] else NULL
}

.cm_access_subset <- function(deployment, access_refs) {
  refs <- as.character(unlist(access_refs %||% list(), use.names = FALSE))
  Filter(function(binding) is.list(binding) && binding$access_id %in% refs,
         deployment$bindings %||% list())
}

.cm_access_fingerprint <- function(deployment, access_refs) {
  collection_fingerprint(.cm_access_subset(deployment, access_refs))
}

.cm_instance_fingerprint <- function(template_sha, deployment_fingerprint,
                                     access_fingerprint, unit_refs, access_refs) {
  collection_fingerprint(list(
    template_sha256 = template_sha,
    deployment_fingerprint = deployment_fingerprint,
    access_fingerprint = access_fingerprint,
    unit_refs = as.list(unit_refs),
    access_refs = as.list(access_refs)
  ))
}

#' Valida una instancia de material V1.
#'
#' @param instance lista de instancia.
#' @return lista `ok` y `problems`.
#' @export
collection_material_instance_validate <- function(instance) {
  if (!is.list(instance)) {
    return(list(ok = FALSE, problems = list(.cm_problem(
      "instance", "not_object", "La instancia debe ser un objeto."
    ))))
  }
  problems <- list()
  allowed_instance_fields <- c(
    "schema", "instance_id", "template_ref", "deployment_id",
    "deployment_fingerprint", "access_fingerprint", "instance_fingerprint",
    "unit_refs", "access_refs", "locale", "status", "sensitivity", "warnings"
  )
  for (field in setdiff(names(instance) %||% character(0), allowed_instance_fields)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0("instance.", field), "instance_field_not_allowed",
      sprintf("`%s` no puede persistirse en una instancia V1.", field)
    )
  }
  if (!identical(instance$schema, COLLECTION_MATERIAL_INSTANCE_SCHEMA)) {
    problems[[length(problems) + 1L]] <- .cm_problem("instance.schema", "bad_schema", sprintf("Se esperaba '%s'.", COLLECTION_MATERIAL_INSTANCE_SCHEMA))
  }
  for (field in c("instance_id", "deployment_id", "locale", "status", "sensitivity")) {
    if (!.cc_is_scalar_string(instance[[field]])) {
      problems[[length(problems) + 1L]] <- .cm_problem(paste0("instance.", field), "missing_string", sprintf("%s es obligatorio.", field))
    }
  }
  if (.cc_is_scalar_string(instance$status) && !(instance$status %in% c("ready", "stale"))) {
    problems[[length(problems) + 1L]] <- .cm_problem("instance.status", "bad_status", "status debe ser ready o stale.")
  }
  if (.cc_is_scalar_string(instance$sensitivity) && !(instance$sensitivity %in% c("public", "operational", "restricted", "sensitive", "reference"))) {
    problems[[length(problems) + 1L]] <- .cm_problem("instance.sensitivity", "bad_sensitivity", "Sensibilidad no reconocida.")
  }
  for (field in c("deployment_fingerprint", "access_fingerprint", "instance_fingerprint")) {
    if (!.cc_is_fingerprint(instance[[field]])) {
      problems[[length(problems) + 1L]] <- .cm_problem(paste0("instance.", field), "bad_fingerprint", sprintf("%s debe ser sha256 prefijado.", field))
    }
  }
  tref <- instance$template_ref
  if (!is.list(tref) || !.cc_is_scalar_string(tref$template_id) ||
      !.cc_is_integer_ge(tref$revision, 1L) || !.cc_is_fingerprint(tref$sha256)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "instance.template_ref", "bad_template_ref", "template_ref exige template_id, revision y sha256."
    )
  }
  for (field in c("unit_refs", "access_refs")) {
    refs <- as.character(unlist(instance[[field]] %||% list(), use.names = FALSE))
    missing_units <- identical(field, "unit_refs") && !length(refs)
    if (missing_units || any(!nzchar(refs)) || anyDuplicated(refs)) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0("instance.", field), "bad_refs", sprintf("%s debe ser una lista de ids unicos.", field)
      )
    }
  }
  if (!is.list(instance$warnings %||% list())) {
    problems[[length(problems) + 1L]] <- .cm_problem("instance.warnings", "bad_warnings", "warnings debe ser una lista.")
  }
  problems <- c(problems, .cc_security_problems(instance, "instance"))
  list(ok = length(problems) == 0L, problems = problems)
}

#' Valida el recibo-manifest unico de un artefacto.
#'
#' @param receipt lista de recibo.
#' @return lista `ok` y `problems`.
#' @export
collection_artifact_receipt_validate <- function(receipt) {
  if (!is.list(receipt)) {
    return(list(ok = FALSE, problems = list(.cm_problem("receipt", "not_object", "El recibo debe ser un objeto."))))
  }
  problems <- list()
  allowed_receipt_fields <- c(
    "schema", "receipt_id", "artifact_id", "instance_id", "deployment_id",
    "plan_fingerprint", "deployment_fingerprint", "template_ref",
    "layout_fingerprint", "file_id", "media_type", "filename", "sha256",
    "size_bytes", "page_count", "page_map", "generator", "audience",
    "sensitivity", "generated_at"
  )
  for (field in setdiff(names(receipt) %||% character(0), allowed_receipt_fields)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0("receipt.", field), "receipt_field_not_allowed",
      sprintf("`%s` no pertenece al recibo-manifest canonico.", field)
    )
  }
  if (!identical(receipt$schema, COLLECTION_ARTIFACT_RECEIPT_SCHEMA)) {
    problems[[length(problems) + 1L]] <- .cm_problem("receipt.schema", "bad_schema", sprintf("Se esperaba '%s'.", COLLECTION_ARTIFACT_RECEIPT_SCHEMA))
  }
  for (field in c("receipt_id", "artifact_id", "instance_id", "deployment_id", "file_id",
                  "media_type", "filename", "audience", "sensitivity")) {
    if (!.cc_is_scalar_string(receipt[[field]])) {
      problems[[length(problems) + 1L]] <- .cm_problem(paste0("receipt.", field), "missing_string", sprintf("%s es obligatorio.", field))
    }
  }
  for (field in c("plan_fingerprint", "deployment_fingerprint", "layout_fingerprint", "sha256")) {
    if (!.cc_is_fingerprint(receipt[[field]])) {
      problems[[length(problems) + 1L]] <- .cm_problem(paste0("receipt.", field), "bad_fingerprint", sprintf("%s debe ser sha256 prefijado.", field))
    }
  }
  if (!receipt$media_type %in% c("image/png", "application/pdf", "application/zip")) {
    problems[[length(problems) + 1L]] <- .cm_problem("receipt.media_type", "bad_media_type", "MIME no permitido para materiales V1.")
  }
  if (!.cc_is_integer_ge(receipt$size_bytes, 1L) || !.cc_is_integer_ge(receipt$page_count, 1L)) {
    problems[[length(problems) + 1L]] <- .cm_problem("receipt", "bad_size_or_pages", "size_bytes y page_count deben ser enteros positivos.")
  }
  if (!is.list(receipt$page_map) || length(receipt$page_map) != as.integer(receipt$page_count)) {
    problems[[length(problems) + 1L]] <- .cm_problem("receipt.page_map", "bad_page_map", "page_map debe tener una entrada por pagina.")
  }
  if (!is.list(receipt$template_ref) || !.cc_is_fingerprint(receipt$template_ref$sha256)) {
    problems[[length(problems) + 1L]] <- .cm_problem("receipt.template_ref", "bad_template_ref", "Falta la revision de plantilla usada.")
  }
  generator <- receipt$generator
  if (!is.list(generator) || !.cc_is_scalar_string(generator$id) ||
      !.cc_is_integer_ge(generator$version, 1L) || !.cc_is_fingerprint(generator$fingerprint)) {
    problems[[length(problems) + 1L]] <- .cm_problem("receipt.generator", "bad_generator", "generator exige id, version y fingerprint.")
  }
  problems <- c(problems, .cc_security_problems(receipt, "receipt"))
  list(ok = length(problems) == 0L, problems = problems)
}

collection_material_template_get <- function(sid) {
  state <- .collection_current(session_get(sid))
  list(
    ok = TRUE,
    state_revision = as.integer(state$state_revision),
    builtin = is.null(state$material_template),
    template = .cm_material_template(state)
  )
}

collection_material_template_put <- function(sid, template, expected_revision) {
  current <- .collection_current(session_get(sid))
  .collection_assert_revision(current, expected_revision)
  if (!is.list(template)) {
    stop_api(422, "E_COLLECTION_MATERIAL_TEMPLATE_INVALID", "template debe ser un objeto collection_material_template/v1.")
  }
  previous <- .cm_material_template(current)
  comparable <- template
  comparable$revision <- previous$revision
  comparable <- .cm_template_normalize(comparable)
  if (identical(.cm_template_material(comparable), .cm_template_material(previous))) {
    return(list(ok = TRUE, noop = TRUE, state_revision = current$state_revision, template = previous))
  }
  candidate <- .cm_template_normalize(template, revision = as.integer(previous$revision) + 1L)
  .collection_assert_valid(
    collection_material_template_validate(candidate),
    "E_COLLECTION_MATERIAL_TEMPLATE_INVALID", "La plantilla no cumple collection_material_template/v1."
  )
  next_state <- current
  next_state$material_template <- candidate
  instances <- .cm_instances(next_state)
  if (length(instances)) {
    instances <- lapply(instances, function(instance) {
      if (!identical(instance$template_ref$sha256, candidate$template_sha256)) {
        instance$status <- "stale"
        warning_codes <- vapply(instance$warnings %||% list(), function(x) as.character(x$code %||% ""), character(1))
        if (!("template_changed" %in% warning_codes)) {
          instance$warnings[[length(instance$warnings) + 1L]] <- list(code = "template_changed")
        }
      }
      instance
    })
  }
  next_state$material_instances <- instances
  next_state$state_revision <- as.integer(current$state_revision) + 1L
  .collection_store(sid, next_state)
  list(ok = TRUE, noop = FALSE, state_revision = next_state$state_revision, template = candidate)
}

.cm_instance_freshness <- function(instance, state) {
  template <- .cm_material_template(state)
  deployment <- state$deployment
  reasons <- character(0)
  if (!identical(instance$template_ref$sha256, template$template_sha256)) reasons <- c(reasons, "template_changed")
  if (!is.list(deployment) || !identical(instance$deployment_id, deployment$deployment_id)) {
    reasons <- c(reasons, "deployment_changed")
  } else {
    deployment_fp <- .collection_deployment_fingerprint(deployment)
    if (!identical(instance$deployment_fingerprint, deployment_fp)) reasons <- c(reasons, "deployment_changed")
    current_access_fp <- .cm_access_fingerprint(deployment, instance$access_refs)
    if (!identical(instance$access_fingerprint, current_access_fp)) reasons <- c(reasons, "access_changed")
    if (identical(deployment$status, "stale")) reasons <- c(reasons, "deployment_stale")
  }
  unique(reasons)
}

collection_material_instance_create <- function(sid, expected_revision, unit_refs = NULL,
                                                access_refs = NULL, locale = "es-PE") {
  current <- .collection_current(session_get(sid))
  .collection_assert_revision(current, expected_revision)
  if (!is.list(current$plan) || !is.list(current$deployment)) {
    stop_api(409, "E_COLLECTION_DEPLOYMENT_REQUIRED", "Se necesita plan y deployment para crear materiales.")
  }
  template <- .cm_material_template(current)
  adapter_id <- current$plan$adapter$id %||% ""
  compatible <- unlist(template$compatible_adapters %||% list(), use.names = FALSE)
  if (!(adapter_id %in% compatible)) {
    stop_api(422, "E_COLLECTION_MATERIAL_INSTANCE_INVALID", "La plantilla no es compatible con el adapter del plan.")
  }
  known_units <- vapply(current$plan$units %||% list(), function(x) as.character(x$unit_id %||% ""), character(1))
  selected_units <- as.character(unlist(unit_refs %||% as.list(known_units), use.names = FALSE))
  if (!length(selected_units) || any(!selected_units %in% known_units) || anyDuplicated(selected_units)) {
    stop_api(422, "E_COLLECTION_MATERIAL_INSTANCE_INVALID", "unit_refs contiene unidades desconocidas o repetidas.")
  }
  unit_bindings <- Filter(function(x) is.list(x) && x$unit_id %in% selected_units,
                          current$deployment$bindings %||% list())
  known_access <- vapply(unit_bindings, function(x) as.character(x$access_id %||% ""), character(1))
  selected_access <- if (is.null(access_refs)) unique(known_access[nzchar(known_access)]) else {
    as.character(unlist(access_refs, use.names = FALSE))
  }
  if (any(!selected_access %in% known_access) || anyDuplicated(selected_access)) {
    stop_api(422, "E_COLLECTION_MATERIAL_INSTANCE_INVALID", "access_refs contiene accesos desconocidos o repetidos.")
  }
  missing_units <- setdiff(selected_units, vapply(
    Filter(function(x) identical(x$status, "ready") && x$access_id %in% selected_access, unit_bindings),
    function(x) x$unit_id, character(1)
  ))
  warnings <- lapply(missing_units, function(unit_id) list(code = "access_missing", unit_id = unit_id))
  deployment_fp <- .collection_deployment_fingerprint(current$deployment)
  access_fp <- .cm_access_fingerprint(current$deployment, selected_access)
  instance <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA,
    instance_id = paste0("material-", uuid::UUIDgenerate()),
    template_ref = list(
      template_id = template$template_id,
      revision = as.integer(template$revision),
      sha256 = template$template_sha256
    ),
    deployment_id = current$deployment$deployment_id,
    deployment_fingerprint = deployment_fp,
    access_fingerprint = access_fp,
    unit_refs = as.list(selected_units),
    access_refs = as.list(selected_access),
    locale = as.character(locale %||% "es-PE")[[1]],
    status = if (identical(current$deployment$status, "stale")) "stale" else "ready",
    sensitivity = as.character(current$deployment$sensitivity$access_urls %||% "operational")[[1]],
    warnings = warnings
  )
  instance$instance_fingerprint <- .cm_instance_fingerprint(
    template$template_sha256, deployment_fp, access_fp, selected_units, selected_access
  )
  .collection_assert_valid(
    collection_material_instance_validate(instance),
    "E_COLLECTION_MATERIAL_INSTANCE_INVALID", "La instancia no cumple collection_material_instance/v1."
  )
  next_state <- current
  next_state$material_instances <- c(.cm_instances(current), list(instance))
  next_state$state_revision <- as.integer(current$state_revision) + 1L
  .collection_store(sid, next_state)
  list(ok = TRUE, state_revision = next_state$state_revision, instance = instance)
}

.cm_resolved_access_map <- function(resolved_access) {
  if (is.null(resolved_access)) return(list())
  if (!is.list(resolved_access)) {
    stop_api(422, "E_COLLECTION_MATERIAL_RENDER_INVALID", "resolved_access debe ser un objeto efimero.")
  }
  out <- list()
  if (!is.null(names(resolved_access)) && all(nzchar(names(resolved_access)))) {
    for (id in names(resolved_access)) {
      value <- resolved_access[[id]]
      payload <- if (is.list(value)) value$qr_payload %||% value$url else value
      out[[id]] <- as.character(payload %||% "")[[1]]
    }
  } else {
    for (row in resolved_access) {
      if (!is.list(row) || !.cc_is_scalar_string(row$access_id)) next
      out[[row$access_id]] <- as.character(row$qr_payload %||% row$url %||% "")[[1]]
    }
  }
  for (id in names(out)) {
    value <- out[[id]]
    if (!nzchar(value) || nchar(value, type = "bytes") > 4096L ||
        !grepl("^https?://", value, ignore.case = TRUE)) {
      stop_api(422, "E_COLLECTION_MATERIAL_RENDER_INVALID", "Cada acceso resuelto debe ser una URL http(s) no vacia de hasta 4096 bytes.")
    }
  }
  out
}

.cm_project_snapshot <- function(session) {
  study <- if (is.list(session$estudio)) session$estudio else list()
  list(
    name = as.character(session$project_name %||% study$nombre %||% "Proyecto Pulso")[[1]],
    period = as.character(study$periodo %||% session$periodo %||% "")[[1]]
  )
}

#' Ids de logo declarados por una plantilla, en orden y sin repetir.
#'
#' @param template plantilla validada.
#' @return vector de ids.
#' @keywords internal
.cm_template_brand_ids <- function(template) {
  ids <- character(0)
  for (page_spec in template$pages %||% list()) {
    for (block in page_spec$blocks %||% list()) {
      if (is.list(block) && identical(block$type, "brand_strip")) {
        ids <- c(ids, as.character(unlist(block$assets %||% list(), use.names = FALSE)))
      }
    }
  }
  unique(ids)
}

.cm_brand_slug <- function(value) {
  slug <- tolower(trimws(as.character(value %||% "")[1]))
  slug <- sub("\\.[a-z0-9]+$", "", slug)
  slug <- gsub("[^a-z0-9]+", "-", slug)
  gsub("^-+|-+$", "", slug)
}

#' Resuelve los logos de la careta contra los archivos del proyecto.
#'
#' Los activos son archivos del `.pulso` (kind `brand_logo`), no assets del
#' binario: la co-marca pertenece al estudio, no a la app. El match es por slug
#' del nombre original, de modo que la plantilla nombre `logo-unsa` y el
#' proyecto aporte `LOGO_UNSA.png`.
#'
#' @param session sesion viva.
#' @param asset_ids ids declarados por la plantilla.
#' @return mapa id -> ruta, solo con los que existen en disco.
#' @keywords internal
.cm_brand_assets_map <- function(session, asset_ids) {
  ids <- as.character(asset_ids %||% character(0))
  if (!length(ids)) return(list())
  out <- list()
  for (meta in session$files %||% list()) {
    if (!is.list(meta) || !identical(as.character(meta$kind %||% "")[1], "brand_logo")) next
    path <- as.character(meta$path %||% "")[1]
    if (!nzchar(path) || !file.exists(path)) next
    slug <- .cm_brand_slug(meta$original_name)
    if (slug %in% ids && is.null(out[[slug]])) out[[slug]] <- path
  }
  out
}

collection_material_render_snapshot <- function(sid, instance_id, resolved_access = NULL) {
  session <- session_get(sid)
  state <- .collection_current(session)
  instance <- .cm_instance_find(state, instance_id)
  if (is.null(instance)) {
    stop_api(404, "E_COLLECTION_MATERIAL_INSTANCE_NOT_FOUND", "No existe la instancia de material solicitada.")
  }
  reasons <- .cm_instance_freshness(instance, state)
  if (identical(instance$status, "stale") || length(reasons)) {
    stop_api(
      409, "E_COLLECTION_MATERIAL_INSTANCE_STALE",
      "La instancia cambio respecto de template, deployment o access.",
      details = list(reasons = as.list(unique(c(reasons, if (identical(instance$status, "stale")) "instance_stale"))))
    )
  }
  template <- .cm_material_template(state)
  list(
    schema = "collection_material_render_snapshot/v1",
    template = template,
    instance = instance,
    project = .cm_project_snapshot(session),
    plan = state$plan,
    deployment = state$deployment,
    resolved_access = .cm_resolved_access_map(resolved_access),
    brand_assets = .cm_brand_assets_map(session, .cm_template_brand_ids(template))
  )
}
