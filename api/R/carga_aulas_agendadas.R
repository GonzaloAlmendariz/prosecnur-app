# Lectura de la hoja «Aulas Agendadas» de un estudio de aulas.
#
# El equipo no llena esto en la app: lo llena en Excel, con la hoja abierta
# mientras llama a cada docente. La app LEE. «Sin planilla paralela» no
# significa eliminar el Excel — significa que el Excel y la app dejen de contar
# cosas distintas.
#
# La hoja es ANCHA: una columna de `ID MATCH` y despues N bloques identicos de
# 20 columnas, uno por eslabon de la cadena. El primero es el titular y los
# demas son sus reemplazos, puestos al lado en la MISMA fila. El modelo de la
# app representa la cadena a lo LARGO, con una fila por unidad y
# `replacement_for` apuntando al titular. Este lector traduce de ancho a largo.
#
# Anatomia medida sobre el estudio real (2025): 171 filas x 241 columnas =
# 1 + 12 x 20. Ver `docs/qa/anatomia-excels-aulas-2026-08-16.md`.

# Los 20 campos de un bloque, en orden. El nombre canonico es el de la app; el
# de la hoja se resuelve por texto normalizado, no por posicion, para que un
# libro con una columna de mas no descuadre todo lo que viene detras.
AULAS_AGENDADAS_BLOQUE <- list(
  list(campo = "wave",             titulos = c("MUESTRA")),
  list(campo = "operational_code", titulos = c("CURSO-HORARIO", "CURSO HORARIO")),
  list(campo = "teacher",          titulos = c("NOMBRE DE DOCENTE")),
  list(campo = "teacher_phone",    titulos = c("TELEFONO DE DOCENTE")),
  list(campo = "teacher_email",    titulos = c("CORREO PUCP DOCENTE")),
  list(campo = "course_name",      titulos = c("NOMBRE DEL CURSO")),
  list(campo = "faculty",          titulos = c("FACULTAD")),
  list(campo = "level",            titulos = c("NIVEL DEL CURSO")),
  list(campo = "label",            titulos = c("SESIONES Y AULA")),
  list(campo = "enrolled_total",   titulos = c("MATRICULADOS TOTAL DTI")),
  list(campo = "eligible_n",       titulos = c("MATRICULADOS POBLACION")),
  list(campo = "contact_medium",   titulos = c("MEDIO DE CONTACTO")),
  list(campo = "contact_date",     titulos = c("FECHA DE LLAMADA")),
  list(campo = "contact_attempts", titulos = c("NUMERO DE INTENTOS")),
  list(campo = "sample_status",    titulos = c("STATUS MUESTRA")),
  list(campo = "scheduled_date",   titulos = c("FECHA DE APLICACION", "FECHA AGENDADA")),
  list(campo = "scheduled_day",    titulos = c("DIA")),
  list(campo = "scheduled_time",   titulos = c("HORA")),
  list(campo = "link",             titulos = c("ENLACE DE LA FICHA")),
  list(campo = "notes",            titulos = c("OBSERVACIONES", "OBSERVACIONES SOBRE AULAS AGENDADAS"))
)

AULAS_AGENDADAS_ANCHO_BLOQUE <- length(AULAS_AGENDADAS_BLOQUE)

.caa_key <- function(x) {
  v <- as.character(x %||% "")
  v <- gsub("[\r\n]+", " ", v)
  # El simbolo de grado se quita ANTES de transliterar: `iconv` lo convierte en
  # un CERO, asi que "N ASISTENTES" no casaba con "N0 ASISTENTES" y seis campos
  # de cuotas quedaban sin mapear en silencio.
  v <- gsub("[\u00b0\u00ba\u00aa]", "", v)
  v <- trimws(gsub("[[:space:]]+", " ", v))
  v <- toupper(iconv(v, from = "", to = "ASCII//TRANSLIT", sub = ""))
  v <- gsub("[^A-Z0-9 -]", "", v)
  # **El papel del bloque no forma parte del nombre del campo.** Los tres
  # bloques de «Aulas Agendadas» repetian las MISMAS 20 cabeceras —«NOMBRE DE
  # DOCENTE» tres veces identico— y lo unico que distinguia al titular del
  # reemplazo 1.2 era el COLOR, que no sobrevive a una impresion en blanco y
  # negro ni al PDF. Ahora los bloques 2+ llevan su papel en el titulo y el
  # lector lo descarta aqui, asi que sigue leyendo igual una hoja vieja sin
  # sufijo y una nueva con el.
  trimws(sub(" R[0-9]+$", "", v))
}

# El equipo escribe "-" para decir "todavia nada aqui" —medido: 1810 de 2040
# celdas de `STATUS MUESTRA` en el estudio de 2025—. Es ausencia, no un valor;
# dejarlo pasar llenaria los conteos de una categoria fantasma.
.caa_txt <- function(x) {
  if (is.null(x) || !length(x)) return("")
  v <- as.character(x[[1]])
  if (is.na(v)) return("")
  v <- trimws(v)
  if (v %in% c("-", "--", "N/A", "n/a", "NA", "s/d", "S/D")) return("")
  v
}

# **Una fecha escrita en Excel deja de ser texto.**
#
# Excel convierte solo lo que parece una fecha: en cuanto alguien escribe
# «11/08/2026» en la celda, el fichero guarda el numero de serie y el lector
# recibia **46245**. Medido con el propio generador: la misma hoja da
# «2026-08-11» si la escribe la app y «46245» si la reescribe Excel, y ese
# numero viajaba tal cual al plan.
#
# El origen es 1899-12-30 —el desplazamiento clasico de Excel, que cuenta un
# 29 de febrero de 1900 que no existio—. Se acota a un rango razonable para no
# convertir en fecha un numero que solo es un numero: por debajo de 20000
# (1954) o por encima de 60000 (2064) se deja como estaba.
.caa_fecha <- function(x) {
  v <- .caa_txt(x)
  if (!nzchar(v)) return("")
  n <- suppressWarnings(as.numeric(v))
  if (!length(n) || !is.finite(n) || n < 20000 || n > 60000) return(v)
  # `%d` y no `%s`: un serial con decimales trae la hora, y la parte entera es
  # el dia.
  format(as.Date(floor(n), origin = "1899-12-30"), "%Y-%m-%d")
}

.caa_num <- function(x) {
  v <- suppressWarnings(as.numeric(.caa_txt(x)))
  if (!length(v) || !is.finite(v)) NA_real_ else v
}

#' Cuantos bloques de cadena trae la hoja.
#'
#' No se asume 12: se deduce del ancho real, porque un estudio con cadenas mas
#' cortas produce menos bloques y uno mas exigente produce mas.
#'
#' @param n_col columnas totales de la hoja.
#' @return numero de bloques completos.
#' @export
aulas_agendadas_n_bloques <- function(n_col) {
  n <- suppressWarnings(as.integer(n_col))
  if (!length(n) || is.na(n) || n <= 1L) return(0L)
  as.integer((n - 1L) %/% AULAS_AGENDADAS_ANCHO_BLOQUE)
}

# Mapea, dentro de un bloque, el campo canonico -> indice de columna absoluto.
# Se resuelve por titulo y no por posicion fija.
.caa_mapa_bloque <- function(titulos, desde) {
  hasta <- min(length(titulos), desde + AULAS_AGENDADAS_ANCHO_BLOQUE - 1L)
  if (desde > length(titulos)) return(list())
  claves <- .caa_key(titulos[desde:hasta])
  out <- list()
  for (spec in AULAS_AGENDADAS_BLOQUE) {
    idx <- which(claves %in% .caa_key(spec$titulos))
    if (length(idx)) out[[spec$campo]] <- desde + idx[[1]] - 1L
  }
  out
}

#' Traduce la hoja ancha «Aulas Agendadas» a filas de plan.
#'
#' @param df data.frame crudo de la hoja, con la cabecera ya como nombres o como
#'   primera fila (se acepta cualquiera de las dos formas).
#' @param titulos vector de titulos de columna; por defecto `names(df)`.
#' @return lista de filas en el formato largo del plan de Monitoreo.
#' @export
aulas_agendadas_a_plan <- function(df, titulos = NULL) {
  if (!is.data.frame(df) || !nrow(df) || !ncol(df)) return(list())
  titulos <- titulos %||% names(df)
  n_bloques <- aulas_agendadas_n_bloques(ncol(df))
  if (n_bloques < 1L) return(list())

  filas <- list()
  for (i in seq_len(nrow(df))) {
    id_match <- .caa_txt(df[i, 1])
    titular_code <- ""
    for (b in seq_len(n_bloques)) {
      desde <- 1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + 1L
      mapa <- .caa_mapa_bloque(titulos, desde)
      if (!length(mapa)) next
      val <- function(campo) if (is.null(mapa[[campo]])) "" else .caa_txt(df[i, mapa[[campo]]])
      # La celda cruda, para los campos que necesitan interpretarla —una fecha
      # que Excel guardo como numero de serie llega aqui como «46245».
      fecha <- function(campo) if (is.null(mapa[[campo]])) "" else .caa_fecha(df[i, mapa[[campo]]])
      num <- function(campo) if (is.null(mapa[[campo]])) NA_real_ else .caa_num(df[i, mapa[[campo]]])

      code <- val("operational_code")
      # Un bloque sin curso-horario es cadena que no se llego a usar: no
      # produce fila. Inventarla llenaria el plan de aulas fantasma.
      if (!nzchar(code)) next
      if (b == 1L) titular_code <- code

      filas[[length(filas) + 1L]] <- list(
        selection_slot_id = id_match,
        classroom_id = code,
        operational_code = code,
        label = val("label"),
        course_name = val("course_name"),
        faculty = val("faculty"),
        level = val("level"),
        teacher = val("teacher"),
        # La spec declara `teacher_phone` desde el principio y el generador lo
        # escribe con su titulo correcto, pero este registro —otra lista
        # cerrada— no lo emitia: el dato se leia del Excel y moria aqui. Es EL
        # dato con el que se agenda.
        teacher_phone = val("teacher_phone"),
        teacher_email = val("teacher_email"),
        schedule = val("label"),
        wave = val("wave"),
        enrolled_total = num("enrolled_total"),
        eligible_n = num("eligible_n"),
        # Los dos ejes de estado viven separados: `sample_status` es el del
        # agendamiento (AGENDADA / REAGENDADA / EN RESERVA n / REEMPLAZADA) y
        # no se mezcla con el de la aplicacion, que llega de otra hoja.
        sample_status = val("sample_status"),
        contact_medium = val("contact_medium"),
        contact_date = fecha("contact_date"),
        contact_attempts = num("contact_attempts"),
        scheduled_date = fecha("scheduled_date"),
        scheduled_day = val("scheduled_day"),
        scheduled_time = val("scheduled_time"),
        link = val("link"),
        replacement_note = val("notes"),
        sample_role = if (b == 1L) "titular" else "chain_reserve",
        replacement_order = if (b == 1L) 0 else b - 1L,
        replacement_for = if (b == 1L) "" else titular_code
      )
    }
  }
  filas
}

#' Lee la hoja «Aulas Agendadas» de un libro y devuelve filas de plan.
#'
#' @param path ruta al `.xlsx`.
#' @param hoja nombre de la hoja.
#' @return lista de filas en formato largo.
#' @export
aulas_agendadas_leer <- function(path, hoja = "Aulas Agendadas") {
  if (!file.exists(path)) {
    stop_api(400, "E_AULAS_AGENDADAS_NO_EXISTE", "No se encontro el libro de aulas agendadas.")
  }
  hojas <- tryCatch(readxl::excel_sheets(path), error = function(e) character(0))
  if (!hoja %in% hojas) {
    stop_api(
      422, "E_AULAS_AGENDADAS_SIN_HOJA",
      sprintf("El libro no tiene una hoja '%s'.", hoja),
      details = list(hojas = as.list(hojas))
    )
  }
  crudo <- readxl::read_excel(path, sheet = hoja, col_names = FALSE, .name_repair = "minimal")
  if (!nrow(crudo)) return(list())
  titulos <- as.character(unlist(crudo[1, ], use.names = FALSE))
  cuerpo <- crudo[-1, , drop = FALSE]
  aulas_agendadas_a_plan(as.data.frame(cuerpo, stringsAsFactors = FALSE), titulos)
}
