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
# El titular de una fila, en el idioma del libro: codigos operativos.
#
# `replacement_for` NO sirve para esto y es el error que costo el mapeo entero:
# tanto `calc_muestra_aulas.R` como `monitoreo_aulas_apply_replacement()` lo
# escriben con el `classroom_id` del titular —`arc232_0905`—, que es su clave
# interna y no un codigo operativo. Medido sobre HSVG2026 (2 615 filas): de los
# 202 `replacement_for` distintos, CERO coincidian con un titular y ninguno
# existia siquiera como fila, asi que la cadena se escribia en 202 grupos
# huerfanos —sin su titular dentro— aparte de los 202 grupos de titulares: el
# libro daba 1 043 filas cuando el estudio tiene 202 cadenas y 639 del banco.
#
# `titular_operational_code` si habla ese idioma: 1 774 de 1 774 reservas
# encadenadas caen en su titular, y `monitoreo_aulas_normalize_plan()` ya lo
# repara antes de entregarlo.
.calg_titular <- function(u) {
  toc <- .calg_txt(u$titular_operational_code)
  if (nzchar(toc)) toc else .calg_txt(u$operational_code)
}

.calg_profundidad <- function(unidades) {
  if (!length(unidades)) return(1L)
  por_titular <- table(vapply(unidades, .calg_titular, character(1)))
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
  # Por `titular_operational_code` y no por `replacement_for` — ver `.calg_titular`.
  grupos <- split(unidades, vapply(unidades, .calg_titular, character(1)))
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
        # A partir de aqui llena la PERSONA que agenda, pero se DEVUELVE lo que
        # ya este registrado. Escribir vacio siempre borraba el operativo en
        # curso: regenerar el libro de un estudio en marcha perdia los estados
        # de agendamiento y el ciclo de contacto de todas las aulas. Un libro
        # nuevo no trae estos campos y sale en blanco igual que antes.
        # `notes` o `replacement_note`: el lector de «Aulas Agendadas» guarda la
        # columna OBSERVACIONES en `replacement_note`, asi que leer solo `notes`
        # perdia las 190 observaciones del estudio de 2025 en cada regeneracion.
        .calg_txt(u$contact_medium), .calg_txt(u$contact_date),
        .calg_num_txt(u$contact_attempts), .calg_txt(u$sample_status),
        .calg_txt(u$scheduled_date), .calg_txt(u$scheduled_day), .calg_txt(u$scheduled_time),
        .calg_txt(u$link),
        .calg_txt(u$notes %||% u$replacement_note)
      )
    }), use.names = FALSE)
    c(as.character(i), celdas)
  })
  as.data.frame(do.call(rbind, c(list(cabecera), filas)), stringsAsFactors = FALSE)
}

# Celdas del parte de campo en el orden de `.calg_titulos_campo()`. Con `parte`
# nulo salen los dos denominadores y el resto en blanco, que es el libro nuevo.
.cap_celdas_parte <- function(parte, unidad, titulos_campo) {
  v <- function(x) .calg_txt((parte %||% list())[[x]])
  n <- function(x) .calg_num_txt((parte %||% list())[[x]])
  celdas <- c(
    .calg_num_txt(unidad$enrolled_total), .calg_num_txt(unidad$eligible_n),
    n("observed_students"),
    # El porcentaje lo calcula la hoja del equipo con sus formulas.
    "",
    n("refusals"), n("duplicates"), n("effective_surveys"),
    # Los nombres son los que produce el LECTOR (`carga_aulas_aplicadas.R`),
    # que es de donde vienen los partes en un estudio real. Los alias cubren a
    # quien los arme a mano.
    .calg_txt((parte %||% list())$applied_by %||% (parte %||% list())$applicator),
    v("actual_room"),
    .calg_txt((parte %||% list())$applied_date %||% (parte %||% list())$applied_at),
    v("applied_time"), v("application_status"), v("field_note")
  )
  length(celdas) <- length(titulos_campo)
  celdas[is.na(celdas)] <- ""
  celdas
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
aulas_libro_hoja_aplicadas <- function(unidades, intentos = 3L, partes = list()) {
  intentos <- max(1L, as.integer(intentos))
  # Partes ya registrados, indexados por codigo operativo e intento.
  por_aula <- list()
  for (pt in partes) {
    if (!is.list(pt)) next
    cod <- .calg_txt(pt$operational_code, .calg_txt(pt$classroom_id))
    if (!nzchar(cod)) next
    n <- suppressWarnings(as.integer(pt$intento %||% 1L))
    if (!length(n) || !is.finite(n) || n < 1L) n <- 1L
    por_aula[[sprintf("%s#%d", cod, n)]] <- pt
  }
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

  # Titulares SIEMPRE, y ademas cualquier unidad con parte registrado: una
  # reserva activada se aplica igual que un titular —en el estudio de 2025, 26
  # de los 196 partes son de reservas— y filtrar por rol la borraba del libro.
  # `names(list())` es NULL y `startsWith(NULL, ...)` lanza: sin partes —el libro
  # nuevo, que es el caso mas comun— no hay a quien preguntar.
  claves_parte <- names(por_aula) %||% character(0)
  con_parte <- vapply(unidades, function(u) {
    cod <- .calg_txt(u$operational_code)
    nzchar(cod) && length(claves_parte) > 0L && any(startsWith(claves_parte, paste0(cod, "#")))
  }, logical(1))
  titulares <- unidades[vapply(unidades, function(u) identical(.calg_txt(u$sample_role), "titular"), logical(1)) | con_parte]
  filas <- lapply(seq_along(titulares), function(i) {
    u <- titulares[[i]]
    bloque <- c(
      as.character(i),
      .calg_txt(u$wave), .calg_txt(u$operational_code), .calg_txt(u$teacher),
      .calg_txt(u$teacher_phone), .calg_txt(u$teacher_email), .calg_txt(u$course_name),
      .calg_txt(u$faculty), .calg_txt(u$level), .calg_txt(u$label),
      .calg_num_txt(u$enrolled_total), .calg_num_txt(u$eligible_n),
      .calg_txt(u$contact_medium), .calg_txt(u$contact_date),
      .calg_num_txt(u$contact_attempts), .calg_txt(u$sample_status),
      .calg_txt(u$scheduled_date), .calg_txt(u$scheduled_day), .calg_txt(u$scheduled_time),
      .calg_txt(u$link), .calg_txt(u$notes %||% u$replacement_note),
      # Parte de campo del primer intento: los dos denominadores como referencia
      # y lo que ya se haya registrado. Ver la nota de la hoja de agendamiento.
      .cap_celdas_parte(por_aula[[sprintf("%s#1", .calg_txt(u$operational_code))]], u, titulos_campo)
    )
    ancho_bloque <- 1L + length(titulos_agenda) + length(titulos_campo)
    # Los reintentos tambien devuelven lo suyo: un aula que ya fue a segunda
    # vuelta pierde ese parte si el bloque sale en blanco.
    extra <- unlist(lapply(seq_len(intentos - 1L), function(b) {
      pt <- por_aula[[sprintf("%s#%d", .calg_txt(u$operational_code), b + 1L)]]
      if (is.null(pt)) return(rep("", ancho_bloque))
      c(as.character(i), rep("", length(titulos_agenda)),
        .cap_celdas_parte(pt, u, titulos_campo))
    }), use.names = FALSE)
    c(bloque, if (length(extra)) extra else rep("", ancho_bloque * (intentos - 1L)))
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
aulas_libro_generar <- function(unidades, path, partes = list()) {
  if (!length(unidades)) {
    stop_api(409, "E_AULAS_LIBRO_SIN_PLAN", "No hay plan de aulas del que generar el libro.")
  }
  hojas <- list(
    `Aulas Agendadas` = aulas_libro_hoja_agendadas(unidades),
    `Aulas Aplicadas (Campo)` = aulas_libro_hoja_aplicadas(unidades, partes = partes),
    `Base de control` = aulas_libro_hoja_control(unidades)
  )

  # Workbook en vez de `write.xlsx`: el volcado no admite validaciones, paneles
  # ni anchos, y sin ellos la hoja no se puede llenar sin equivocarse. Ver
  # `carga_aulas_libro_formato.R` para el porque de cada vocabulario.
  wb <- openxlsx::createWorkbook()
  for (nombre in names(hojas)) {
    openxlsx::addWorksheet(wb, nombre)
    openxlsx::writeData(wb, nombre, hojas[[nombre]], colNames = FALSE)
  }

  profundidad <- .calg_profundidad(unidades)
  listas <- list(
    `STATUS MUESTRA` = aulas_libro_status_muestra(profundidad),
    `MEDIO DE CONTACTO` = AULAS_LIBRO_MEDIO_CONTACTO,
    `DÍA` = AULAS_LIBRO_DIA,
    `STATUS DE APLICACIÓN` = AULAS_LIBRO_STATUS_APLICACION
  )
  hoja_listas <- "Listas"

  # Las columnas del desplegable se derivan de la POSICION del campo en el
  # bloque, no de un numero a mano: si manana el bloque gana una columna, esto
  # sigue apuntando al campo correcto.
  idx <- function(campo) which(vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo == campo, logical(1)))
  col_en_bloque <- function(campo, b) 1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + idx(campo)
  bloques <- seq_len(profundidad)
  filas_agenda <- nrow(hojas[["Aulas Agendadas"]]) - 1L

  validaciones <- list(
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda,
         cols = vapply(bloques, function(b) col_en_bloque("sample_status", b), integer(1)),
         rango = .calf_rango(hoja_listas, 1L, length(listas[[1]]))),
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda,
         cols = vapply(bloques, function(b) col_en_bloque("contact_medium", b), integer(1)),
         rango = .calf_rango(hoja_listas, 2L, length(listas[[2]]))),
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda,
         cols = vapply(bloques, function(b) col_en_bloque("scheduled_day", b), integer(1)),
         rango = .calf_rango(hoja_listas, 3L, length(listas[[3]])))
  )

  aulas_libro_aplicar_formato(
    wb,
    filas_cabecera = list(`Aulas Agendadas` = 1L, `Aulas Aplicadas (Campo)` = 2L, `Base de control` = 2L),
    validaciones = validaciones,
    listas = listas
  )
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}
