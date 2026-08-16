# Generacion del libro operativo de un estudio de aulas.
#
# La otra mitad del ciclo. Los tres lectores dejaban entrar el Excel; esto lo
# produce. Sin generarlo, cada estudio arranca copiando el libro del anterior y
# los encabezados derivan hasta que dejan de leerse.
#
# El ciclo completo es:
#
#   Calculo de muestra -> la app GENERA el libro con lo que ya sabe
#     -> quien agenda llama a los docentes y llena su hoja
#     -> quien supervisa campo llena el parte por aplicador y aula
#     -> la app RELEE el libro como fuente y decide
#
# Por eso el libro se genera con las columnas de la persona VACIAS y las de la
# app llenas: identidad del curso-horario, contacto del docente, los dos
# denominadores y el enlace de la ficha. Rellenar lo que le toca a la persona
# seria inventar campo.
#
# Es el mismo papel que cumple el Excel de barrido en el modo telefonico: una
# hoja que la app produce, alguien llena y la app vuelve a leer para decidir.

.calg_txt <- function(x, default = "") {
  v <- suppressWarnings(as.character(x %||% default)[1])
  if (is.na(v)) default else v
}

.calg_num_txt <- function(x) {
  v <- suppressWarnings(as.numeric(.calg_txt(x, "")))
  if (!length(v) || !is.finite(v)) "" else format(v, trim = TRUE, scientific = FALSE)
}

# Titulos EXACTOS que espera el lector. Se derivan de la misma spec para que
# generador y lector no puedan divergir: si manana cambia un titulo, cambia en
# los dos a la vez.
.calg_titulos_agenda <- function() {
  vapply(AULAS_AGENDADAS_BLOQUE, function(spec) spec$titulos[[1]], character(1))
}

# Cuantos eslabones de cadena se escriben por fila. Sale del plan, no de una
# constante: un estudio con cadenas de tres no debe llevar doce columnas vacias.
.calg_profundidad <- function(unidades) {
  if (!length(unidades)) return(1L)
  por_titular <- table(vapply(unidades, function(u) .calg_txt(u$replacement_for, .calg_txt(u$operational_code)), character(1)))
  max(1L, as.integer(max(por_titular)))
}

#' Arma la hoja «Aulas Agendadas» a partir del plan.
#'
#' @param unidades filas del plan (formato largo).
#' @return data.frame sin nombres, con la cabecera como primera fila.
#' @export
aulas_libro_hoja_agendadas <- function(unidades) {
  titulos_bloque <- .calg_titulos_agenda()
  # Agrupa por titular: cada fila del Excel es un titular con su cadena al lado.
  clave <- function(u) {
    rf <- .calg_txt(u$replacement_for)
    if (nzchar(rf)) rf else .calg_txt(u$operational_code)
  }
  grupos <- split(unidades, vapply(unidades, clave, character(1)))
  profundidad <- max(1L, max(vapply(grupos, length, integer(1)), 1L))

  cabecera <- c("ID MATCH", rep(titulos_bloque, profundidad))
  filas <- lapply(seq_along(grupos), function(i) {
    g <- grupos[[i]]
    # El titular primero; las reservas por orden de cadena.
    orden <- order(vapply(g, function(u) {
      if (identical(.calg_txt(u$sample_role), "titular")) 0 else suppressWarnings(as.numeric(u$replacement_order %||% 99))
    }, numeric(1)))
    g <- g[orden]
    celdas <- unlist(lapply(seq_len(profundidad), function(b) {
      if (b > length(g)) return(rep("", length(titulos_bloque)))
      u <- g[[b]]
      c(
        .calg_txt(u$wave), .calg_txt(u$operational_code), .calg_txt(u$teacher),
        .calg_txt(u$teacher_phone), .calg_txt(u$teacher_email),
        .calg_txt(u$course_name), .calg_txt(u$faculty), .calg_txt(u$level),
        .calg_txt(u$label), .calg_num_txt(u$enrolled_total), .calg_num_txt(u$eligible_n),
        # A partir de aqui llena la PERSONA que agenda. Se dejan en blanco.
        "", "", "", "",
        "", "", "",
        .calg_txt(u$link),
        ""
      )
    }), use.names = FALSE)
    c(as.character(i), celdas)
  })
  as.data.frame(do.call(rbind, c(list(cabecera), filas)), stringsAsFactors = FALSE)
}

.calg_titulos_campo <- function() c(
  "MATRICULADOS TOTAL DTI", "MATRICULADOS POBLACIÓN", "CANTIDAD DE ASISTENTES",
  "% ASISTENCIA", "CANTIDAD DE RECHAZOS", "DUPLICADOS (YA RESPONDIERON)",
  "CANTIDAD DE EFECTIVAS", "APLICADOR", "AULA", "FECHA DE APLICACIÓN",
  "HORA DE APLICACIÓN", "STATUS DE APLICACIÓN", "OBSERVACIONES SOBRE APLICACIONES"
)

#' Arma la hoja «Aulas Aplicadas (Campo)».
#'
#' Trae la identidad del aula y sus denominadores; el parte lo llena quien
#' supervisa campo.
#'
#' @param unidades filas del plan.
#' @param intentos cuantos bloques de aplicacion se dejan preparados.
#' @return data.frame con dos filas de cabecera (grupo y campo).
#' @export
aulas_libro_hoja_aplicadas <- function(unidades, intentos = 3L) {
  intentos <- max(1L, as.integer(intentos))
  titulos_agenda <- .calg_titulos_agenda()
  titulos_campo <- .calg_titulos_campo()

  grupo <- c()
  campos <- c()
  for (b in seq_len(intentos)) {
    etiqueta <- if (b == 1L) "MUESTRA DE APLICACIÓN PRINCIPAL" else sprintf("APLICACIÓN DE REEMPLAZO %d", b)
    ancho <- 1L + length(titulos_agenda) + length(titulos_campo)
    grupo <- c(grupo, etiqueta, rep("", ancho - 1L))
    campos <- c(campos, "ID MATCH", titulos_agenda, titulos_campo)
  }

  titulares <- Filter(function(u) identical(.calg_txt(u$sample_role), "titular"), unidades)
  filas <- lapply(seq_along(titulares), function(i) {
    u <- titulares[[i]]
    bloque <- c(
      as.character(i),
      .calg_txt(u$wave), .calg_txt(u$operational_code), .calg_txt(u$teacher),
      .calg_txt(u$teacher_phone), .calg_txt(u$teacher_email), .calg_txt(u$course_name),
      .calg_txt(u$faculty), .calg_txt(u$level), .calg_txt(u$label),
      .calg_num_txt(u$enrolled_total), .calg_num_txt(u$eligible_n),
      "", "", "", "", "", "", "", .calg_txt(u$link), "",
      # Parte de campo: los dos denominadores se repiten como referencia y el
      # resto lo llena quien supervisa.
      .calg_num_txt(u$enrolled_total), .calg_num_txt(u$eligible_n),
      rep("", length(titulos_campo) - 2L)
    )
    ancho_bloque <- 1L + length(titulos_agenda) + length(titulos_campo)
    c(bloque, rep("", ancho_bloque * (intentos - 1L)))
  })
  as.data.frame(do.call(rbind, c(list(grupo), list(campos), filas)), stringsAsFactors = FALSE)
}

#' Arma la hoja «Base de control».
#'
#' Se genera con la identidad y los denominadores; las columnas de control las
#' calcula el equipo con sus formulas.
#'
#' @param unidades filas del plan.
#' @return data.frame con dos filas de cabecera.
#' @export
aulas_libro_hoja_control <- function(unidades) {
  campos <- vapply(BASE_CONTROL_CAMPOS, function(spec) spec$titulos[[1]], character(1))
  grupo <- rep("", length(campos))
  grupo[[1]] <- "INFORMACIÓN DEL CURSO"
  if (length(grupo) >= 8L) grupo[[8]] <- "INFORMACIÓN DEL CAMPO"
  if (length(grupo) >= 14L) grupo[[14]] <- "CONTROL - CUENTA"
  if (length(grupo) >= 29L) grupo[[29]] <- "CONTROL - CUOTAS"

  titulares <- Filter(function(u) identical(.calg_txt(u$sample_role), "titular"), unidades)
  filas <- lapply(titulares, function(u) {
    fila <- rep("", length(campos))
    pon <- function(nombre, valor) {
      i <- which(campos == nombre)
      if (length(i)) fila[[i[[1]]]] <<- valor
    }
    pon("MUESTRA", .calg_txt(u$wave))
    pon("CURSO-HORARIO", .calg_txt(u$operational_code))
    pon("NOMBRE DEL CURSO", .calg_txt(u$course_name))
    pon("AULA", .calg_txt(u$label))
    pon("HORARIO", .calg_txt(u$schedule))
    pon("MATRICULADOS TOTALES", .calg_num_txt(u$enrolled_total))
    pon("MATRICULADOS POBLACION", .calg_num_txt(u$eligible_n))
    fila
  })
  as.data.frame(do.call(rbind, c(list(grupo), list(campos), filas)), stringsAsFactors = FALSE)
}

#' Genera el libro operativo completo del estudio.
#'
#' @param unidades filas del plan (formato largo).
#' @param path destino `.xlsx`.
#' @return la ruta escrita.
#' @export
aulas_libro_generar <- function(unidades, path) {
  if (!length(unidades)) {
    stop_api(409, "E_AULAS_LIBRO_SIN_PLAN", "No hay plan de aulas del que generar el libro.")
  }
  hojas <- list(
    `Aulas Agendadas` = aulas_libro_hoja_agendadas(unidades),
    `Aulas Aplicadas (Campo)` = aulas_libro_hoja_aplicadas(unidades),
    `Base de control` = aulas_libro_hoja_control(unidades)
  )
  openxlsx::write.xlsx(hojas, file = path, colNames = FALSE)
  path
}
