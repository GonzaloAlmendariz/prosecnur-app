# monitoreo_aulas_traslape_fuente.R — de dónde se lee el otro estudio.
#
# El veredicto del cruce (`aulas_traslape_estudio()`) se persiste en el `.pulso`
# y sobrevive a la sesión que lo calculó, así que desde `409094d3` dice de
# cuándo es. Lo que faltaba para poder RECALCULARLO es lo que este archivo
# declara: **la app nunca supo de dónde sale**. Lo inyectaba un runner externo
# con `session_set(sid, "monitoreo_aulas_daa_traslape", …)` —lo dice el
# comentario de `monitoreo_aulas_publicar_libro.R`— y no había ninguna ruta que
# leyera el proyecto de otro estudio ni su Sheets.
#
# **Por qué en la config y no en la sesión.** La fuente no es un secreto ni un
# dato del otro estudio: es una decisión de ESTE —contra quién se cruza— y tiene
# que sobrevivir a cerrar la app, igual que `eje_cuota`. Lo que no viaja aquí
# son credenciales: el Sheets se lee con el token que el proyecto ya tiene
# (ADR 0005), y aquí sólo va su identificador.
#
# **Solo lectura, sin excepción.** Las hojas de agenda del otro estudio pueden
# tener gente agendando en vivo. Este bloque declara de dónde LEER; nada de lo
# que cuelga de él escribe una celda ajena.

#' La fuente del cruce con otro estudio, tal como la declara el estudio.
#'
#' @param cfg config de aulas universitarias, o la config completa: se aceptan
#'   las dos entradas para que ninguna capa tenga que saber a qué altura la
#'   recibió. Mismo trato que [monitoreo_aulas_eje()].
#' @return lista `{declarada, etiqueta, pulso, spreadsheet_id, motivo}`.
#'   `declarada` es `FALSE` cuando no hay ni proyecto ni Sheets de donde leer, y
#'   entonces el recálculo **no se intenta**: sin fuente no hay nada que releer,
#'   y fallar con un error de red sería contar otra historia.
#' @export
monitoreo_aulas_traslape_fuente <- function(cfg = list()) {
  if (!is.list(cfg)) cfg <- list()
  aulas <- if (is.list(cfg[["aulas_universitarias"]])) cfg[["aulas_universitarias"]] else cfg
  f <- aulas[["traslape_fuente"]]
  if (!is.list(f)) f <- list()
  pulso <- .monitoreo_scalar(f[["pulso"]] %||% "", "")
  hoja <- .monitoreo_extract_spreadsheet_id(.monitoreo_scalar(f[["spreadsheet_id"]] %||% "", ""))
  list(
    declarada = nzchar(pulso) || nzchar(hoja),
    hoja = {
      v <- .monitoreo_scalar(f[["hoja"]] %||% "", "")
      if (nzchar(v)) v else .MATF_HOJA_POR_DEFECTO
    },
    # La etiqueta va al rótulo de la columna del libro («TRASLAPE HSVG»), así
    # que sin ella el cruce no sabría cómo titularse.
    etiqueta = toupper(.monitoreo_scalar(f[["etiqueta"]] %||% "", "")),
    pulso = pulso,
    spreadsheet_id = hoja,
    motivo = .monitoreo_scalar(f[["motivo"]] %||% "", "")
  )
}

#' La frase que describe de dónde se leyó, para que el veredicto la lleve.
#'
#' Viaja en el atributo `fuente` del veredicto y es lo único que permite repetir
#' la lectura sin adivinar. Se compone de lo declarado y no se teclea aparte:
#' dos redacciones de la misma cosa acaban separándose.
#' @param fuente salida de [monitoreo_aulas_traslape_fuente()].
#' @return una frase, o `""` sin fuente declarada.
#' @keywords internal
.matf_frase <- function(fuente) {
  f <- fuente %||% list()
  partes <- character(0)
  if (nzchar(f$pulso %||% "")) partes <- c(partes, sprintf("plan de %s", basename(f$pulso)))
  if (nzchar(f$spreadsheet_id %||% "")) {
    partes <- c(partes, sprintf("su libro vivo en Sheets %s", f$spreadsheet_id))
  }
  if (!length(partes)) return("")
  paste0(paste(partes, collapse = " y "), ", en solo lectura")
}

#' Normaliza el bloque de la fuente para guardarlo.
#'
#' Misma doctrina que el resto de la config: se guarda en la forma en que el
#' motor lo lee, y **una clave que no se reconoce no se guarda en silencio** —es
#' la lección de `E_AULAS_PADRON_FILTRO_CLAVE`, donde un filtro mal escrito
#' cargó 25.403 personas de toda la universidad y lo informó como «sin filtro»—.
#' @param x lo que llegue de la UI o de la config guardada.
#' @return el bloque normalizado, o `list()`.
#' @keywords internal
.matf_normalizar <- function(x) {
  if (!is.list(x) || !length(x)) return(list())
  desconocidas <- setdiff(names(x), .MATF_CLAVES)
  if (length(desconocidas)) {
    stop_api(400, "E_AULAS_TRASLAPE_FUENTE_CLAVE", sprintf(
      "La fuente del cruce no reconoce %s. Las claves son: %s.",
      paste(sprintf("«%s»", desconocidas), collapse = ", "),
      paste(.MATF_CLAVES, collapse = ", ")))
  }
  out <- list(
    etiqueta = toupper(.monitoreo_scalar(x[["etiqueta"]] %||% "", "")),
    pulso = .monitoreo_scalar(x[["pulso"]] %||% "", ""),
    spreadsheet_id = .monitoreo_extract_spreadsheet_id(
      .monitoreo_scalar(x[["spreadsheet_id"]] %||% "", "")),
    hoja = .monitoreo_scalar(x[["hoja"]] %||% "", ""),
    motivo = .monitoreo_scalar(x[["motivo"]] %||% "", "")
  )
  # Sin nada de donde leer, el bloque no se guarda: una fuente con sólo etiqueta
  # diría que el estudio cruza contra algo cuando no puede leer nada.
  if (!nzchar(out$pulso) && !nzchar(out$spreadsheet_id)) return(list())
  out
}

# La lista va ANTES del roxygen de su función a propósito: una constante entre
# el bloque y la función se lleva el `@export` y deja la función fuera del
# NAMESPACE. Costó dos gates con `carga_aulas_padron`.
.MATF_CLAVES <- c("etiqueta", "pulso", "spreadsheet_id", "hoja", "motivo")

# La hoja del otro estudio de la que se lee quién ya fue contactado. Por defecto
# la que esta misma app escribe, porque el caso normal es cruzar contra otro
# estudio de aulas de Prosecnur; declarable porque **una particularidad no puede
# quedarse cableada**: otro operativo puede llamar a su hoja de otra forma, y
# entonces se dice en la config en vez de reescribir el motor.
.MATF_HOJA_POR_DEFECTO <- "Aulas Agendadas"

#' Lee el plan del otro estudio desde su `.pulso`, en SOLO LECTURA.
#'
#' Abre el zip en un directorio temporal y lee `state.rds`. No monta el
#' proyecto, no toca la sesión y no escribe nada en el archivo: es la misma
#' lectura que hace el runner del scratchpad, con el mismo alcance.
#'
#' @param ruta ruta del `.pulso` del otro estudio.
#' @return lista de filas del plan, o `list()`.
#' @keywords internal
.matf_plan_ajeno <- function(ruta) {
  ruta <- .monitoreo_scalar(ruta, "")
  if (!nzchar(ruta)) return(list())
  if (!file.exists(ruta)) {
    stop_api(404, "E_AULAS_TRASLAPE_PULSO", sprintf(
      "No se encuentra el proyecto del otro estudio en «%s».", ruta))
  }
  destino <- file.path(tempdir(), sprintf("traslape_%s", basename(tempfile(""))))
  dir.create(destino, showWarnings = FALSE, recursive = TRUE)
  on.exit(unlink(destino, recursive = TRUE), add = TRUE)
  st <- tryCatch(
    readRDS(utils::unzip(ruta, "state.rds", exdir = destino)),
    error = function(e) NULL
  )
  if (!is.list(st)) {
    stop_api(422, "E_AULAS_TRASLAPE_SIN_PLAN", sprintf(
      "El proyecto «%s» no se pudo leer como un `.pulso` de Prosecnur.", basename(ruta)))
  }
  plan <- st[["monitoreo_aulas_plan"]] %||%
    ((st[["monitoreo_config"]] %||% list())[["aulas_universitarias"]] %||% list())[["plan"]] %||%
    list()
  if (!length(plan)) {
    stop_api(422, "E_AULAS_TRASLAPE_SIN_PLAN", sprintf(
      "El proyecto «%s» no trae plan de aulas, así que no hay con qué cruzar.",
      basename(ruta)))
  }
  plan
}

#' Qué docentes y qué aulas ya tocó el otro estudio, según su libro vivo.
#'
#' **Solo lectura, sin excepción**: hay gente agendando en vivo en esas hojas.
#' Sin token o sin hoja devuelve vacíos, y el veredicto entonces no AFIRMA que
#' nadie fue contactado: `aulas_traslape_estudio()` distingue «no hay contacto»
#' de «no se sabe», y un vacío aquí es lo segundo.
#'
#' @param id identificador del Sheets del otro estudio.
#' @return lista `{contactados, aulas_contactadas, leido}`.
#' @keywords internal
.matf_libro_ajeno <- function(id, hoja = .MATF_HOJA_POR_DEFECTO) {
  vacio <- list(contactados = character(0), aulas_contactadas = character(0), leido = FALSE)
  id <- .monitoreo_extract_spreadsheet_id(.monitoreo_scalar(id, ""))
  if (!nzchar(id)) return(vacio)
  hoja <- .monitoreo_scalar(hoja, .MATF_HOJA_POR_DEFECTO)
  url <- paste0(
    "https://sheets.googleapis.com/v4/spreadsheets/", id, "/values/",
    utils::URLencode(hoja, reserved = TRUE),
    "?valueRenderOption=UNFORMATTED_VALUE")
  v <- tryCatch(.monitoreo_google_api(url)$values, error = function(e) NULL)
  if (!is.list(v) || length(v) < 2L) return(vacio)
  cab <- as.character(unlist(v[[1]]))
  # **Los títulos NO se retecean: se leen de donde la app los declara.**
  # `AULAS_AGENDADAS_BLOQUE` es la especificación de esa hoja, y escribirlos
  # aquí a mano crearía una segunda verdad sobre la misma columna: el día que la
  # spec renombre «CORREO PUCP DOCENTE», este lector seguiría buscando el
  # título viejo y devolvería vacío sin fallar. Es la misma disciplina que el
  # resto del libro y la razón por la que esto sirve para cualquier estudio, no
  # sólo para el que lo motivó.
  titulo_de <- function(campo) {
    i <- which(vapply(AULAS_AGENDADAS_BLOQUE, function(s) identical(s$campo, campo), logical(1)))
    if (!length(i)) return(character(0))
    AULAS_AGENDADAS_BLOQUE[[i[[1]]]]$titulos
  }
  # Por PREFIJO y en todos los bloques: la hoja repite sus columnas una vez por
  # eslabón de la cadena y cada bloque lleva el sufijo del reemplazo. Buscar el
  # título exacto sólo encontraría el primero. Cualquiera de los alias declarados
  # vale, que es lo que permite leer un libro de una generación anterior.
  por_titulo <- function(campo) {
    tit <- titulo_de(campo)
    if (!length(tit)) return(integer(0))
    which(Reduce(`|`, lapply(tit, function(x) startsWith(cab, x))))
  }
  i_mail <- por_titulo("teacher_email")
  i_ch <- por_titulo("operational_code")
  i_sm <- por_titulo("sample_status")
  if (!length(i_mail) && !length(i_ch)) return(vacio)
  nrm <- function(x) tolower(trimws(as.character(x %||% "")))
  # Lo que cuenta como «ya tocado»: el estado de muestra que el equipo teclea.
  # El estado INICIAL no es contacto, y un vacío tampoco — y cuál es el inicial
  # lo dice el vocabulario del libro, que lo declara primero de su lista por ese
  # mismo motivo. Reteclearlo aquí sería la segunda verdad otra vez.
  inicial <- toupper(AULAS_LIBRO_STATUS_MUESTRA_BASE[[1]])
  tocado <- function(estado) {
    e <- toupper(trimws(as.character(estado %||% "")))
    nzchar(e) && !identical(e, inicial)
  }
  correos <- character(0); aulas <- character(0)
  for (fila in v[-1]) {
    f <- unlist(fila)
    gv <- function(i) if (length(i) && i <= length(f)) trimws(as.character(f[[i]] %||% "")) else ""
    for (b in seq_along(i_mail)) {
      estado <- gv(if (b <= length(i_sm)) i_sm[[b]] else integer(0))
      if (!tocado(estado)) next
      m <- nrm(gv(i_mail[[b]]))
      if (nzchar(m)) correos <- c(correos, m)
      a <- nrm(gv(if (b <= length(i_ch)) i_ch[[b]] else integer(0)))
      if (nzchar(a)) aulas <- c(aulas, a)
    }
  }
  list(contactados = unique(correos), aulas_contactadas = unique(aulas), leido = TRUE)
}

#' Traduce los códigos operativos del otro estudio a sus `classroom_id`.
#'
#' **El puente sin el cual el cruce de aulas no casa nunca.** El Sheets del otro
#' estudio habla en CÓDIGO OPERATIVO («CH 110») porque es lo que el equipo
#' teclea; el cruce compara `classroom_id`, que es la identidad del aula en el
#' marco. Su plan tiene los dos, así que es él quien traduce.
#'
#' Medido el 2026-09-18, y el defecto era mío: sin este puente el recálculo
#' devolvía **0 aulas ya aplicadas** donde la lectura de la víspera encontraba
#' 12, y doce unidades cambiaban de veredicto en un sentido imposible —una
#' aplicación no se deshace—. Es la misma avería que llevo cerrando todo el día:
#' dos claves distintas a los dos lados de un join, que no falla, sólo miente.
#'
#' @param codigos códigos tal como vienen de la hoja del otro estudio.
#' @param plan_ajeno su plan, que trae `operational_code` y `classroom_id`.
#' @return los `classroom_id` correspondientes, normalizados.
#' @keywords internal
.matf_traducir_aulas <- function(codigos, plan_ajeno) {
  nrm <- function(x) tolower(trimws(as.character(x %||% "")))
  tocadas <- unique(nrm(unlist(codigos %||% character(0), use.names = FALSE)))
  tocadas <- tocadas[nzchar(tocadas)]
  if (!length(tocadas) || !length(plan_ajeno)) return(character(0))
  g <- function(k) vapply(plan_ajeno, function(r) {
    v <- r[[k]]; if (is.null(v)) "" else as.character(v)[1]
  }, character(1))
  cod <- nrm(g("operational_code"))
  aula <- nrm(g("classroom_id"))
  # Un código que el plan ajeno no conoce se descarta: pasarlo crudo lo
  # compararía contra `classroom_id` y no casaría nunca, que es justo el
  # silencio que este puente existe para romper.
  unique(aula[cod %in% tocadas & nzchar(aula)])
}

#' Recalcula el veredicto del cruce leyendo la fuente declarada.
#'
#' @param unidades filas del plan de ESTE estudio.
#' @param cfg config de aulas universitarias, de donde sale la fuente.
#' @return el veredicto de [aulas_traslape_estudio()], con `leido_en` puesto al
#'   instante de ESTA lectura y `fuente` compuesta de lo declarado.
#' @export
monitoreo_aulas_traslape_recalcular <- function(unidades, cfg = list()) {
  fuente <- monitoreo_aulas_traslape_fuente(cfg)
  if (!isTRUE(fuente$declarada)) {
    stop_api(409, "E_AULAS_TRASLAPE_SIN_FUENTE", paste(
      "El estudio no declara contra qué otro estudio se cruza, así que no hay",
      "nada que releer. Se declara en la configuración de aulas",
      "(`traslape_fuente`), con el proyecto del otro estudio y su Sheets."))
  }
  ajeno <- .matf_plan_ajeno(fuente$pulso)
  g <- function(pl, k) vapply(pl, function(r) {
    v <- r[[k]]; if (is.null(v)) "" else as.character(v)[1]
  }, character(1))
  libro <- .matf_libro_ajeno(fuente$spreadsheet_id, fuente$hoja)
  out <- aulas_traslape_estudio(
    unidades,
    aulas = g(ajeno, "classroom_id"),
    docentes = g(ajeno, "teacher_email"),
    contactados = libro$contactados,
    # Por el PUENTE, no crudas: la hoja del otro estudio habla en código
    # operativo y esto compara `classroom_id`. Ver `.matf_traducir_aulas()`.
    aulas_contactadas = .matf_traducir_aulas(libro$aulas_contactadas, ajeno),
    etiqueta = if (nzchar(fuente$etiqueta)) fuente$etiqueta else "OTRO ESTUDIO",
    leido_en = .monitoreo_now_iso(),
    fuente = .matf_frase(fuente)
  )
  # Lo que la lectura pudo y no pudo, declarado: sin el libro vivo el cruce
  # sigue valiendo —los planes se cruzan igual— pero NO puede afirmar quién fue
  # contactado, y eso tiene que verse en el recibo.
  attr(out, "libro_leido") <- isTRUE(libro$leido)
  attr(out, "aulas_del_otro") <- length(unique(g(ajeno, "classroom_id")))
  out
}
