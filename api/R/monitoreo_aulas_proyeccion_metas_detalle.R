# =============================================================================
# «Esas aulas agendadas, ¿cuáles son?» — el detalle detrás de «N agendados»
# =============================================================================
#
# Gonzalo, 2026-09-24, sobre «Metas y aulas» de HSVG26ULT2: «necesito también
# saber con un hover o algo esas aulas agendadas cuáles son y cuándo están
# agendadas, en qué fecha y a qué hora, y cuántos hombres y mujeres tiene».
#
# Son las MISMAS filas que la proyección cuenta como agendadas y sin aplicar
# (`pend`): la lista se arma con la máscara del motor y no con otro filtro, así
# que la pantalla no puede enseñar ocho aulas donde la cifra dice siete.
#
# Hombres y mujeres son los ELEGIBLES del aula, del padrón (`sex_top_*`): con
# dos sexos, top-1 y top-2 son el reparto completo. El rótulo se lee con
# `.pulso_sexo_fm()`, que ya entiende «Mujer»/«F»/«M»; un padrón sin sexo deja
# los dos campos en NA en vez de inventar un cero.

#' Detalle de las unidades agendadas y sin aplicar, ordenado por fecha y hora.
#'
#' @param unidades filas del plan ya filtradas por la máscara del motor.
#' @return lista de `{codigo, curso, seccion, fecha, hora, horario, lugar,
#'   elegibles, hombres, mujeres, niveles}`.
#' @keywords internal
.mapm_detalle_agendadas <- function(unidades) {
  unidades <- unidades %||% list()
  if (!length(unidades)) return(list())
  txt <- function(x) trimws(.monitoreo_scalar(x, ""))
  num <- function(x) suppressWarnings(as.numeric(.monitoreo_scalar(x, NA)))
  filas <- lapply(unidades, function(u) {
    sexos <- c(.pulso_sexo_fm(txt(u$sex_top_1)), .pulso_sexo_fm(txt(u$sex_top_2)))
    n <- c(num(u$sex_top_1_n), num(u$sex_top_2_n))
    n[!is.finite(n)] <- 0
    hay_sexo <- any(sexos %in% c("F", "M"))
    list(
      codigo = txt(u$operational_code),
      curso = txt(u$course_name),
      seccion = txt(u$section),
      fecha = .mav_fecha(u$scheduled_date),
      hora = txt(u$scheduled_time),
      horario = txt(u$schedule),
      lugar = txt(u$scheduled_venue %||% u$venue),
      elegibles = num(u$eligible_n),
      hombres = if (hay_sexo) sum(n[sexos %in% "M"]) else NA_real_,
      mujeres = if (hay_sexo) sum(n[sexos %in% "F"]) else NA_real_,
      # Elegibles por NIVEL curricular (`level_composition`, «6:3|7:10»), para
      # los estudios cuya cuota va por nivel (CCSS, 2026-09-24: «en vez de
      # hombres y mujeres, alumnos de los niveles»). Lista con nombre; vacía si
      # el marco no la trae.
      niveles = as.list(.cm_aulas_composicion_leer(u$level_composition))
    )
  })
  # «11:00 am» y «6:45 pm» no ordenan como texto: se pasan a minutos.
  minutos <- vapply(filas, function(f) {
    h <- tolower(f$hora)
    m <- regmatches(h, regexec("([0-9]{1,2}):([0-9]{2})", h))[[1]]
    if (length(m) < 3L) return(NA_real_)
    hh <- as.numeric(m[2])
    if (grepl("p\\.? ?m", h) && hh < 12) hh <- hh + 12
    if (grepl("a\\.? ?m", h) && hh == 12) hh <- 0
    hh * 60 + as.numeric(m[3])
  }, numeric(1))
  fechas <- vapply(filas, function(f) f$fecha, character(1))
  filas[order(fechas, minutos, na.last = TRUE)]
}
