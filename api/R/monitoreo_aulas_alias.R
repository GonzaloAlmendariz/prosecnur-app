# Los nombres con los que llega cada numero del parte de campo.
#
# **Vive en archivo propio porque lo leen tres capas y R carga por orden
# alfabetico.** `monitoreo_aulas_cruce_hojas.R` construye su tabla de campos en
# el nivel superior del archivo, y con la constante dentro de
# `monitoreo_aulas_reconciliacion.R` —que carga despues, por la `r`— el paquete
# no llegaba a cargar: `object '.MONITOREO_AULAS_PARTE_ALIAS' not found`.
#
# El defecto que esta lista existe para cerrar: la publicacion del parte sabia
# leer castellano y la comprobacion del cuadre no, asi que sobre un libro real
# —0 de 152 partes con `observed_students`, 152 con `asistentes`— no se
# comprobo ni uno y el control publicaba «Los numeros de cada parte de campo
# cuadran» en verde. Una capa aprendio los alias y las otras dos no se
# enteraron; por eso son UNA constante y no tres listas.

#' Las claves con las que cada numero del parte puede llegar.
#'
#' El libro real se llena en castellano y el lector conserva sus nombres, asi
#' que toda capa que lea un parte necesita la misma lista. Vivian sueltas dentro
#' de `monitoreo_aulas_partes_publicados()` y `monitoreo_aulas_parte_descuadre()`
#' leia solo la inglesa: dos lecturas de la misma regla, y la que decidia si un
#' parte cuadra era la ciega.
#' @noRd
.MONITOREO_AULAS_PARTE_ALIAS <- list(
  asistentes = c("observed_students", "asistentes", "alumnos_en_aula", "aforo_observado"),
  efectivas  = c("effective_surveys", "validas", "efectivas"),
  rechazos   = c("refusals", "rechazos"),
  duplicados = c("duplicates", "duplicados"),
  # Los usa tambien el cruce entre las dos hojas, que leia por nombre exacto.
  asistencia_pct = c("attendance_pct", "pct_asistencia", "porcentaje_asistencia"),
  aplicador  = c("applied_by", "aplicador", "aplicadora", "applicator"),
  # Los cuatro de abajo entran el 2026-08-31 con la CUARTA capa que se
  # descubrio ciega: el generador del libro. Escribia la hoja «Aulas Aplicadas
  # (Campo)» leyendo solo los nombres ingleses, asi que sobre el .pulso de
  # HSVG2026 —152 partes, todos en castellano— salian las 192 filas VACIAS, y
  # al releer ese libro el lector devolvia 0 partes: el ciclo de campo entero
  # roto en silencio. Mismas cifras que la vez anterior, otro consumidor.
  fecha      = c("applied_date", "applied_at", "fecha", "fecha_aplicacion"),
  hora       = c("applied_time", "hora", "hora_aplicacion"),
  aula       = c("actual_room", "aula", "salon"),
  estado     = c("application_status", "estado", "status", "status_aplicacion"),
  nota       = c("field_note", "nota", "observaciones", "observacion"),
  # El enlace de la ficha QR ESCANEADA (B6c, 2026-08-31): columna manual de la
  # hoja de campo, dato del equipo. La forma castellana es la declarada para un
  # parte guardado en español; NO confundir con `link`, la ficha QR generada
  # por la app en la parte de agenda.
  enlace_escaneado = c("scanned_sheet_link", "enlace_ficha_escaneada")
)

#' El primer alias que traiga valor, o NULL.
#' @noRd
.monitoreo_aulas_parte_primero <- function(parte, claves) {
  for (k in claves) {
    v <- parte[[k]]
    if (!is.null(v) && length(v) == 1L && !is.na(v) &&
        (!is.character(v) || nzchar(trimws(v)))) return(v)
  }
  NULL
}

#' La clave canonica con la que un identificador de colector se compara.
#'
#' El QR viaja con el codigo operativo tal como lo escribe el sorteo —`CH 1`,
#' `R 6.1`— pero el identificador tambien puede llegar TECLEADO: un aplicador
#' sin QR escribe `CH1`, `ch 1` o `R6_1`, y con el emparejamiento literal esa
#' respuesta entra a la plataforma y el avance de su aula queda en 0 sin que
#' nada avise. La clave canonica absorbe las variantes de tipeo del mismo
#' codigo: mayusculas, espacios, y `_`/`,` como grafias del punto (dictado de
#' Gonzalo 2026-09-01: el separador «puede ser lo que funcione mejor»).
#'
#' Es UNA funcion y no una por comparador por la misma razon que
#' `.MONITOREO_AULAS_PARTE_ALIAS` es una constante: el emparejamiento vive en
#' tres capas (numerador del tablero, celdas de sexo, facultad por respuesta)
#' y dos normalizaciones distintas ya fueron el defecto una vez.
#' @noRd
.monitoreo_aulas_clave_colector <- function(x) {
  x <- as.character(x %||% character(0))
  x[is.na(x)] <- ""
  x <- toupper(trimws(x))
  x <- gsub("[_,]", ".", x)
  gsub("[[:space:]]+", "", x)
}

#' Si el plan admite compararse por clave canonica sin ambiguedad.
#'
#' La agregacion por clave suma variantes del MISMO codigo; si el plan tuviera
#' dos identificadores literales distintos que canonicalizan igual, esa suma
#' repartiria respuestas ajenas. En ese caso los comparadores caen al
#' emparejamiento literal de siempre, que nunca inventa un match.
#' @noRd
.monitoreo_aulas_claves_sin_colision <- function(literales) {
  literales <- unique(as.character(literales))
  literales <- literales[!is.na(literales) & nzchar(trimws(literales))]
  claves <- .monitoreo_aulas_clave_colector(literales)
  !anyDuplicated(claves[nzchar(claves)])
}

#' Conteos por respuesta agregados por clave canonica.
#' @noRd
.monitoreo_aulas_counts_por_clave <- function(counts) {
  claves <- .monitoreo_aulas_clave_colector(names(counts))
  keep <- nzchar(claves)
  if (!any(keep)) return(integer(0))
  vapply(split(as.integer(counts[keep]), claves[keep]), sum, integer(1))
}
