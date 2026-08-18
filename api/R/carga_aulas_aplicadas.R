# Lectura de la hoja «Aulas Aplicadas (Campo)».
#
# Es el parte de campo: la hoja que se llena mientras el operativo ocurre, el
# analogo de la base de barrido telefonico de los otros modos de Monitoreo.
# Como «Aulas Agendadas», se llena en Excel y la app LEE.
#
# Dos diferencias con aquella que obligan a leerla distinto:
#
# 1. Los bloques NO tienen el mismo ancho. Medido sobre el estudio de 2025: el
#    bloque principal ocupa 34 columnas y los de reemplazo 33, porque solo el
#    primero trae `AULA` —donde se aplico de verdad, que puede no ser la
#    planificada—. Un paso fijo desalinearia todo a partir del segundo bloque,
#    asi que los bloques se detectan por su marcador `ID MATCH`.
#
# 2. `FECHA DE APLICACION` aparece DOS VECES dentro del mismo bloque: una en la
#    parte de agenda (lo que se agendo) y otra en la parte de campo (lo que
#    ocurrio). Resolver por titulo a secas devolveria siempre la primera. La
#    frontera entre ambas partes la marca la SEGUNDA aparicion de
#    `MATRICULADOS TOTAL DTI`, que el equipo repite justo al abrir el parte.
#
# Anatomia completa en `docs/qa/anatomia-excels-aulas-2026-08-16.md`.

# Campos de la parte de campo de un bloque, con el nombre canonico de la app.
AULAS_APLICADAS_CAMPO <- list(
  list(campo = "observed_students",  titulos = c("CANTIDAD DE ASISTENTES")),
  list(campo = "attendance_pct",     titulos = c("% ASISTENCIA", "ASISTENCIA")),
  list(campo = "refusals",           titulos = c("CANTIDAD DE RECHAZOS")),
  # Ya habian respondido en otra aula: no son rechazo ni son efectiva.
  list(campo = "duplicates",         titulos = c("DUPLICADOS YA RESPONDIERON", "DUPLICADOS")),
  # El numero que manda. NO es "encuestas aplicadas".
  list(campo = "effective_surveys",  titulos = c("CANTIDAD DE EFECTIVAS")),
  list(campo = "applied_by",         titulos = c("APLICADOR")),
  # Donde se aplico de verdad. Solo el bloque principal lo trae.
  list(campo = "actual_room",        titulos = c("AULA")),
  list(campo = "applied_date",       titulos = c("FECHA DE APLICACION")),
  list(campo = "applied_time",       titulos = c("HORA DE APLICACION")),
  list(campo = "application_status",  titulos = c("STATUS DE APLICACION")),
  list(campo = "field_note",         titulos = c("OBSERVACIONES SOBRE APLICACIONES"))
)

#' Columnas donde empieza cada bloque de la hoja.
#'
#' Se detectan por el marcador `ID MATCH` en vez de por un paso fijo, porque los
#' bloques de esta hoja tienen anchos distintos.
#'
#' @param titulos vector de titulos de la fila de cabecera.
#' @return vector de indices de columna.
#' @export
aulas_aplicadas_inicios <- function(titulos) {
  claves <- .caa_key(titulos)
  which(claves == "ID MATCH")
}

# Dentro de un bloque, donde empieza la parte de campo: la SEGUNDA aparicion de
# `MATRICULADOS TOTAL DTI`. Si solo aparece una vez, el bloque no trae parte.
.cap_inicio_campo <- function(claves_bloque) {
  hits <- which(claves_bloque == .caa_key("MATRICULADOS TOTAL DTI"))
  if (length(hits) < 2L) return(NA_integer_)
  hits[[2]]
}

.cap_mapa <- function(titulos, desde, hasta) {
  claves <- .caa_key(titulos[desde:hasta])
  corte <- .cap_inicio_campo(claves)
  if (is.na(corte)) return(list())
  # Solo se buscan los campos del parte DENTRO de la parte de campo: asi
  # `FECHA DE APLICACION` resuelve a la real y no a la agendada.
  claves_campo <- claves[corte:length(claves)]
  out <- list()
  for (spec in AULAS_APLICADAS_CAMPO) {
    idx <- which(claves_campo %in% .caa_key(spec$titulos))
    if (length(idx)) out[[spec$campo]] <- desde + corte - 1L + idx[[1]] - 1L
  }
  # El codigo de la unidad vive en la parte de agenda del mismo bloque.
  idx_code <- which(claves %in% .caa_key(c("CURSO-HORARIO", "CURSO HORARIO")))
  if (length(idx_code)) out[["operational_code"]] <- desde + idx_code[[1]] - 1L
  out
}

#' Traduce la hoja «Aulas Aplicadas (Campo)» a partes de campo por unidad.
#'
#' @param df data.frame del cuerpo de la hoja (sin la fila de cabecera).
#' @param titulos titulos de la fila de campos (la segunda del libro).
#' @return lista de partes, una por (fila, bloque) con datos reales.
#' @export
aulas_aplicadas_a_partes <- function(df, titulos) {
  if (!is.data.frame(df) || !nrow(df)) return(list())
  inicios <- aulas_aplicadas_inicios(titulos)
  if (!length(inicios)) return(list())
  finales <- c(inicios[-1] - 1L, length(titulos))

  partes <- list()
  for (b in seq_along(inicios)) {
    mapa <- .cap_mapa(titulos, inicios[[b]], finales[[b]])
    if (!length(mapa) || is.null(mapa$operational_code)) next
    for (i in seq_len(nrow(df))) {
      code <- .caa_txt(df[i, mapa$operational_code])
      if (!nzchar(code)) next
      val <- function(campo) if (is.null(mapa[[campo]])) "" else .caa_txt(df[i, mapa[[campo]]])
      num <- function(campo) if (is.null(mapa[[campo]])) NA_real_ else .caa_num(df[i, mapa[[campo]]])
      estado <- val("application_status")
      asistentes <- num("observed_students")
      # Un bloque sin estado y sin asistentes es cadena que nunca se aplico:
      # no produce parte. Contarlo como aula visitada inflaria el avance.
      if (!nzchar(estado) && !is.finite(asistentes)) next
      partes[[length(partes) + 1L]] <- list(
        operational_code = code,
        classroom_id = code,
        intento = b,
        observed_students = asistentes,
        # `% ASISTENCIA` era el unico de los once campos de la hoja que estaba
        # DECLARADO en `AULAS_APLICADAS_CAMPO`, se le resolvia la columna en
        # `.cap_mapa()` y despues no se escribia aqui: medio camino hecho. Es el
        # porcentaje que el equipo pone a mano, no un derivado —por eso se lee
        # en vez de calcularse—, y es el numero que explica si el 70 % del
        # padron era siquiera alcanzable: con 55 % de asistencia no se llega ni
        # respondiendo todos los presentes.
        attendance_pct = num("attendance_pct"),
        refusals = num("refusals"),
        duplicates = num("duplicates"),
        effective_surveys = num("effective_surveys"),
        applied_by = val("applied_by"),
        actual_room = val("actual_room"),
        applied_date = val("applied_date"),
        applied_time = val("applied_time"),
        application_status = estado,
        field_note = val("field_note")
      )
    }
  }
  partes
}

#' Lee la hoja «Aulas Aplicadas (Campo)» de un libro.
#'
#' @param path ruta al `.xlsx`.
#' @param hoja nombre de la hoja.
#' @return lista de partes de campo.
#' @export
aulas_aplicadas_leer <- function(path, hoja = "Aulas Aplicadas (Campo)") {
  if (!file.exists(path)) {
    stop_api(400, "E_AULAS_APLICADAS_NO_EXISTE", "No se encontro el libro de aulas aplicadas.")
  }
  hojas <- tryCatch(readxl::excel_sheets(path), error = function(e) character(0))
  if (!hoja %in% hojas) {
    stop_api(
      422, "E_AULAS_APLICADAS_SIN_HOJA",
      sprintf("El libro no tiene una hoja '%s'.", hoja),
      details = list(hojas = as.list(hojas))
    )
  }
  crudo <- readxl::read_excel(path, sheet = hoja, col_names = FALSE, .name_repair = "minimal")
  # La fila 1 son cabeceras de GRUPO («MUESTRA DE APLICACION PRINCIPAL»…) y la
  # fila 2 los campos. El cuerpo empieza en la 3.
  if (nrow(crudo) < 3L) return(list())
  titulos <- as.character(unlist(crudo[2, ], use.names = FALSE))
  cuerpo <- crudo[-c(1, 2), , drop = FALSE]
  aulas_aplicadas_a_partes(as.data.frame(cuerpo, stringsAsFactors = FALSE), titulos)
}
