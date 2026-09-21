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
# =============================================================================

#' El nombre de la hoja hermana de una semana.
#'
#' Se deriva del nombre de la semana para que las dos queden juntas al ordenar
#' las pestañas y se lean como un par.
#' @param semana el nombre de la pestaña de la semana («Semana 1»).
#' @return el nombre de su hermana.
#' @keywords internal
.albpa_hoja <- function(semana) {
  s <- trimws(.monitoreo_scalar(semana, ""))
  if (!nzchar(s)) "Por agendar" else paste0(s, " · por agendar")
}

#' La cabecera de la hoja, en el vocabulario del operativo.
#'
#' `LUGAR` y no `AULA`: es el salón físico, la misma palabra que usa la hoja de
#' la distribución para la misma cosa (ADR 0060: la unidad es el curso-horario).
#' @keywords internal
.ALBPA_CABECERA <- c(
  "DÍA", "FECHA", "HORARIO", "CURSO-HORARIO", "CURSO", "LUGAR", "DOCENTE", "ELEGIBLES"
)

# El aviso de la primera fila. Va en la hoja y no sólo en el commit porque
# quien la abre no ve ninguna de las dos cosas.
.ALBPA_AVISO <- paste(
  "Clases de cursos-horario TITULARES que todavía no están agendados y se",
  "dictan esta semana. Si tienes un hueco, puedes ir a pedir permiso en la",
  "puerta. La app reescribe esta hoja en cada publicación: no anotes aquí."
)

#' Las filas de la hoja «por agendar» de una semana.
#'
#' @param plan filas del plan.
#' @param desde,hasta el tramo ISO de la semana.
#' @return lista de filas (la primera es el aviso, la segunda la cabecera), o
#'   `NULL` si no hay ninguna clase que ofrecer — y entonces no se crea la hoja,
#'   porque una pestaña vacía se lee como «no hay nada» igual que una rota.
#' @export
aulas_libro_filas_por_agendar <- function(plan = list(), desde = "", hasta = "") {
  tabla <- monitoreo_aulas_sin_agendar_por_dia(plan, desde = desde, hasta = hasta)
  dias <- tabla[["dias"]] %||% list()
  if (!length(dias)) return(NULL)
  filas <- list(
    as.list(c(.ALBPA_AVISO, rep("", length(.ALBPA_CABECERA) - 1L))),
    as.list(.ALBPA_CABECERA)
  )
  for (d in dias) {
    fecha <- .monitoreo_scalar(d[["fecha"]], "")
    # `dd/mm`, la misma forma corta que escribe la hoja de la distribución.
    corta <- if (nchar(fecha) == 10L) paste0(substr(fecha, 9L, 10L), "/", substr(fecha, 6L, 7L)) else fecha
    dia_largo <- .albpa_dia_largo(.monitoreo_scalar(d[["dia"]], ""))
    for (c in d[["cursos"]] %||% list()) {
      aula <- .monitoreo_scalar(c[["aula"]], "")
      if (!nzchar(aula)) {
        # Con varias aulas no se elige una: el catálogo no promete cuál toca
        # ese día (ver `monitoreo_aulas_sin_agendar.R`). Se nombran todas y se
        # pide confirmar, que es lo honesto y sigue siendo accionable.
        varias <- as.character(unlist(c[["aulas"]] %||% list(), use.names = FALSE))
        varias <- varias[nzchar(varias)]
        aula <- if (length(varias)) paste0(paste(varias, collapse = " o "), " (confirma cuál)") else ""
      }
      elegibles <- .monitoreo_num(c[["elegibles"]], NA_real_)
      filas[[length(filas) + 1L]] <- list(
        dia_largo, corta,
        paste0(.monitoreo_scalar(c[["inicio"]], ""), " a ", .monitoreo_scalar(c[["fin"]], "")),
        .monitoreo_scalar(c[["codigo"]], ""),
        .monitoreo_scalar(c[["curso"]], ""),
        aula,
        .monitoreo_scalar(c[["docente"]], ""),
        if (is.finite(elegibles)) as.character(round(elegibles)) else ""
      )
    }
  }
  filas
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
#' @keywords internal
.albpa_tramo <- function(rep_semana) {
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
  list(desde = format(lunes, "%Y-%m-%d"), hasta = format(lunes + 5L, "%Y-%m-%d"))
}
