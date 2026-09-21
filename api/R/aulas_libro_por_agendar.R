# =============================================================================
# aulas_libro_por_agendar.R — la hoja hermana: a qué clase entrar sin cita
# =============================================================================
#
# Gonzalo, 2026-09-21, después de ver la tabla dentro de la app: «¿y qué hay de
# la tabla al lado (o en otra hoja) con las aulas titulares aún no agendadas?».
#
# La tabla vivía sólo en la app, y quien la necesita es el aplicador, que lee
# el Sheets. Va en **otra hoja**, no al lado de la distribución: esa pestaña la
# edita el coordinador en vivo —chips de estado, reasignaciones— y meterle
# columnas de otra cosa al costado rompería su geometría y su guarda de dueño.
#
# **Esta hoja la reescribe la app en cada publicación**, y lo dice en su
# primera fila. Es deliberado y es lo contrario de la pestaña de al lado: su
# valor entero es estar al día —una clase deja de estar «por agendar» en cuanto
# alguien la agenda—, así que respetar lo escrito la congelaría en el primer
# día y publicaría una lista falsa. Por eso tampoco se anota aquí.
#
# **Y va por DÍA DE SEMANA, no por fecha, y es UNA sola hoja.** Gonzalo,
# 2026-09-21, viendo la primera versión: «no entiendo por qué sería semana 1
# estos cursos por agendar si son aulas que pasan todas las semanas». Tiene
# razón y el defecto era de fondo: una clase de los miércoles se dicta todos los
# miércoles, así que fecharla y colgarla de «Semana 1» prometía una lista
# propia de esa semana cuando el patrón es el mismo la siguiente —y obligaba a
# republicar para que dejara de mentir—. El aplicador que tiene un hueco el
# miércoles quiere saber qué pasa LOS miércoles; la fecha no le añade nada y el
# nombre de la semana le añade una idea falsa.
# =============================================================================

#' El nombre de la hoja. UNA sola, sin semana.
#'
#' Nació como «Semana N · por agendar» y el nombre mentía: estas clases se
#' dictan todas las semanas, así que colgarlas de una prometía una lista propia
#' de esa semana. Se conserva la firma con argumento para no romper llamadas,
#' pero el nombre ya no depende de él.
#' @param semana ignorado; se conserva por compatibilidad de llamada.
#' @return el nombre de la hoja.
#' @keywords internal
.albpa_hoja <- function(semana = "") "Clases por agendar"

#' La cabecera de la hoja, en el vocabulario del operativo.
#'
#' `LUGAR` y no `AULA`: es el salón físico, la misma palabra que usa la hoja de
#' la distribución para la misma cosa (ADR 0060: la unidad es el curso-horario).
#' @keywords internal
.ALBPA_CABECERA <- c(
  "DÍA", "HORARIO", "CURSO-HORARIO", "CURSO", "LUGAR", "DOCENTE", "ELEGIBLES"
)

# El aviso de la primera fila. Va en la hoja y no sólo en el commit porque
# quien la abre no ve ninguna de las dos cosas.
.ALBPA_AVISO <- paste(
  "Clases de cursos-horario TITULARES que todavía no están agendados. Se",
  "dictan TODAS las semanas en el día y la hora de esta tabla: si tienes un",
  "hueco, puedes ir a pedir permiso en la puerta. La app reescribe esta hoja",
  "en cada publicación —una clase desaparece en cuanto alguien la agenda—,",
  "así que no anotes aquí."
)

#' Las filas de la hoja «Clases por agendar».
#'
#' Una fila por (curso-horario, DÍA DE SEMANA): el que se dicta martes y jueves
#' sale dos veces. Sin fechas —esas clases se repiten todas las semanas— y
#' ordenadas por día y hora, que es como las lee quien busca dónde le cabe un
#' hueco.
#'
#' @param plan filas del plan.
#' @return lista de filas (la primera el aviso, la segunda la cabecera), o
#'   `NULL` si no hay ninguna clase que ofrecer — y entonces no se crea la hoja,
#'   porque una pestaña vacía se lee como «no hay nada» igual que una rota.
#' @export
aulas_libro_filas_por_agendar <- function(plan = list()) {
  orden_dias <- c("LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM")
  items <- list()
  for (fila in .madt_filas(plan)) {
    if (!.masa_ofrecible(fila)) next
    codigo <- .masa_texto(fila, c("operational_code", "classroom_id"))
    if (!nzchar(codigo)) next
    sesiones <- .mav_sesiones(.monitoreo_scalar(fila[["sesiones_dia_hora"]], ""))
    if (!length(sesiones)) next
    aulas <- trimws(unlist(strsplit(
      .masa_texto(fila, c("venue", "scheduled_venue", "actual_room", "aula_utilizada")),
      "<br[[:space:]]*/?>|·", perl = TRUE)))
    aulas <- aulas[nzchar(aulas)]
    lugar <- if (length(aulas) == 1L) aulas[[1L]] else if (length(aulas) > 1L) {
      # Con varias no se elige una: el catálogo construye días y aulas con
      # funciones distintas y su orden no se promete.
      paste0(paste(aulas, collapse = " o "), " (confirma cuál)")
    } else ""
    elegibles <- .monitoreo_num(fila[["eligible_n"]], NA_real_)
    for (s in sesiones) {
      for (d in s$dias) {
        items[[length(items) + 1L]] <- list(
          orden_dia = match(d, orden_dias, nomatch = length(orden_dias) + 1L),
          orden_hora = s$ini,
          codigo = codigo,
          fila = list(
            .albpa_dia_largo(d),
            paste0(.mav_hhmm(s$ini), " a ", .mav_hhmm(s$fin)),
            codigo,
            .masa_texto(fila, c("course_name", "label")),
            lugar,
            .masa_texto(fila, c("teacher")),
            if (is.finite(elegibles)) as.character(round(elegibles)) else ""
          )
        )
      }
    }
  }
  if (!length(items)) return(NULL)
  orden <- order(
    vapply(items, function(x) x$orden_dia, numeric(1)),
    vapply(items, function(x) x$orden_hora, numeric(1)),
    vapply(items, function(x) x$codigo, character(1)),
    method = "radix"
  )
  c(list(
      as.list(c(.ALBPA_AVISO, rep("", length(.ALBPA_CABECERA) - 1L))),
      as.list(.ALBPA_CABECERA)
    ),
    lapply(items[orden], function(x) x$fila))
}

# El día en palabra, desde el token del motor. Sin locale: el nombre del día no
# puede depender de la máquina que publique.
.albpa_dia_largo <- function(token) {
  nombres <- c(LUN = "Lunes", MAR = "Martes", MIE = "Miércoles", JUE = "Jueves",
               VIE = "Viernes", SAB = "Sábado", DOM = "Domingo")
  t <- toupper(trimws(.monitoreo_scalar(token, "")))
  if (nzchar(t) && t %in% names(nombres)) unname(nombres[[t]]) else ""
}

#' El tramo de fechas que cubre un trozo de reparto de una semana.
#'
#' La semana entera de lunes a sábado, **pero nunca hacia atrás**: una clase que
#' ya se dictó no es una oportunidad. Al estrenar la hoja el 2026-09-21 salieron
#' cinco filas del lunes 21 —ese mismo día, pasadas las cinco de la tarde— en
#' las primeras posiciones, que es justo lo que un aplicador lee al abrirla a la
#' mañana siguiente. Una lista de oportunidades que arranca con lo que ya no se
#' puede hacer enseña a saltarse las primeras filas.
#'
#' @param rep_semana el trozo de reparto de esa semana.
#' @param hoy la fecha de corte; parámetro para poder pinearla en el test —una
#'   función que lee el reloj por dentro no se puede probar sin esperar a
#'   mañana.
#' @keywords internal
.albpa_tramo <- function(rep_semana, hoy = Sys.Date()) {
  f <- vapply((rep_semana %||% list())[["dias"]] %||% list(),
              function(d) .monitoreo_scalar(d[["fecha"]], ""), character(1))
  f <- f[grepl("^\\d{4}-\\d{2}-\\d{2}$", f)]
  if (!length(f)) return(list(desde = "", hasta = ""))
  # La semana entera, no sólo los días con cita: una clase sin agendar del
  # jueves sigue siendo una oportunidad aunque ese jueves no haya ninguna cita
  # pactada, y acotarlo a los días del reparto la escondería justo el día que
  # más hueco hay.
  lunes <- .mads_lunes_de(min(f))
  if (is.na(lunes)) return(list(desde = min(f), hasta = max(f)))
  desde <- lunes
  hasta <- lunes + 5L
  corte <- suppressWarnings(as.Date(hoy))
  if (length(corte) == 1L && !is.na(corte) && corte > desde) desde <- corte
  # Una semana que ya terminó no tiene nada que ofrecer, y devolverla al revés
  # haría que el saneador del motor intercambiara las puntas y publicara una
  # semana entera de clases pasadas.
  if (desde > hasta) return(list(desde = "", hasta = ""))
  list(desde = format(desde, "%Y-%m-%d"), hasta = format(hasta, "%Y-%m-%d"))
}

# --- el formato de la hoja ----------------------------------------------------
#
# Gonzalo, 2026-09-21: «le falta formato, color». Salió sin nada porque se la
# dejó FUERA del formato de la distribución —el del desplegable de estado y los
# colores por aplicador, que en una tabla de referencia pondría un «POR
# APLICAR» donde no hay a quién asignar— y no se le puso el suyo. Éste es el
# suyo: la misma banda azul de la casa, el aviso legible, y los días en bloques
# para que se lea «qué pasa los miércoles» de un vistazo.

# El ancho de cada columna, en el orden de `.ALBPA_CABECERA`. El curso y el
# docente son los que se cortan; el día y las horas no necesitan aire.
.ALBPA_ANCHOS <- c(95L, 130L, 115L, 300L, 165L, 250L, 90L)

# Dos grises muy suaves que alternan por DÍA. No es cebra por fila —eso sólo
# separa renglones—: separa bloques, que es la lectura que pide la tabla.
.ALBPA_BANDAS <- c("#FFFFFF", "#F2F5F9")

.albpa_ancho_col <- function(sheet_id, col, pixeles) {
  list(updateDimensionProperties = list(
    range = list(sheetId = sheet_id, dimension = "COLUMNS",
                 startIndex = as.integer(col - 1L), endIndex = as.integer(col)),
    properties = list(pixelSize = as.integer(pixeles)),
    fields = "pixelSize"
  ))
}

.albpa_fondo_filas <- function(sheet_id, desde, hasta, n_cols, fondo) {
  list(repeatCell = list(
    range = list(sheetId = sheet_id,
                 startRowIndex = as.integer(desde - 1L), endRowIndex = as.integer(hasta),
                 startColumnIndex = 0L, endColumnIndex = as.integer(n_cols)),
    cell = list(userEnteredFormat = list(backgroundColor = .monitoreo_sheets_rgb(fondo))),
    fields = "userEnteredFormat.backgroundColor"
  ))
}

#' Las peticiones de formato de la hoja «Clases por agendar».
#'
#' @param sheet_id id de la pestaña.
#' @param rows las filas publicadas (aviso, cabecera y clases).
#' @return lista de requests de `batchUpdate`.
#' @export
aulas_libro_por_agendar_formato_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (length(rows) < 2L) return(list())
  n_cols <- length(.ALBPA_CABECERA)
  reqs <- list()
  poner <- function(x) reqs[[length(reqs) + 1L]] <<- x

  # El aviso: fondo ámbar suave, cursiva y ajustado, con alto para dos líneas.
  # Va arriba porque es lo que evita que alguien anote en una hoja que se
  # reescribe sola.
  poner(.maaf_banda(sheet_id, 1L, n_cols, "#FFF4D6", "#5A4300",
                    size = 10L, italic = TRUE, bold = FALSE, wrap = TRUE))
  poner(.maaf_alto_fila(sheet_id, 1L, 42L))
  # La cabecera, con la banda azul de la casa.
  poner(.maaf_banda(sheet_id, 2L, n_cols, "#002457", "#FFFFFF", size = 11L))
  poner(.maaf_alto_fila(sheet_id, 2L, 30L))

  for (j in seq_len(n_cols)) poner(.albpa_ancho_col(sheet_id, j, .ALBPA_ANCHOS[[j]]))

  # Los bloques por día. Se recorren las filas de datos y se cambia de banda
  # cada vez que cambia el día, no cada N filas: los lunes pueden ser tres y los
  # miércoles once, y una cebra fija partiría los bloques por la mitad.
  cuerpo <- rows[-c(1L, 2L)]
  if (length(cuerpo)) {
    dia_de <- function(f) as.character(unlist(f, use.names = FALSE))[[1L]]
    bloque <- 0L
    inicio <- 1L
    for (i in seq_along(cuerpo)) {
      ultimo <- i == length(cuerpo)
      cambia <- ultimo || !identical(dia_de(cuerpo[[i]]), dia_de(cuerpo[[i + 1L]]))
      if (!cambia) next
      fondo <- .ALBPA_BANDAS[[(bloque %% length(.ALBPA_BANDAS)) + 1L]]
      poner(.albpa_fondo_filas(sheet_id, inicio + 2L, i + 2L, n_cols, fondo))
      bloque <- bloque + 1L
      inicio <- i + 1L
    }
  }

  # Las dos primeras filas se congelan: con cuarenta clases, perder la cabecera
  # al bajar obliga a adivinar qué columna es cuál.
  poner(list(updateSheetProperties = list(
    properties = list(sheetId = sheet_id, gridProperties = list(frozenRowCount = 2L)),
    fields = "gridProperties.frozenRowCount"
  )))
  # El día, la hora y los elegibles, centrados; el resto se lee mejor a la
  # izquierda. `.maaf_centrar()` toma ÍNDICES base 0 con fin EXCLUSIVO, no
  # números de columna: pasarle `(7, 7)` pedía H1:G28 y Google rechazaba el
  # lote entero —incluidos la banda, los anchos y el congelado, que iban en la
  # misma petición—. Por eso la hoja salió publicada y sin nada de formato.
  poner(.maaf_centrar(sheet_id, 0L, 2L, length(rows)))
  poner(.maaf_centrar(sheet_id, n_cols - 1L, n_cols, length(rows)))
  reqs
}
