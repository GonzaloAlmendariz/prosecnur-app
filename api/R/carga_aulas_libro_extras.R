# Las hojas de las aulas EXTRA del libro operativo — unidad B14.
#
# Dictado de Gonzalo (2026-09-01, textual): «algo que tambien falta [...] las
# aulas adicionales de cada facultad: deberian haber dos hojas, una de aulas
# agendadas y otra de aulas aplicadas, para las aulas extra; y la base de
# control no, porque la base de control toma todo sin importar el codigo».
#
# El banco de extras (`extra_reserve_pool`) se filtraba ENTERO fuera del libro
# (`.calg_unidades_del_libro`) porque mezclado con los titulares producia una
# hoja de 2 120 filas donde solo 190 se visitan. Eso sigue siendo verdad para
# las hojas principales; lo que faltaba era darle al banco un sitio PROPIO:
#
#   - «Aulas Agendadas (Extra)»: bloque v4 a profundidad 1 (ID MATCH + los 20
#     campos de `AULAS_AGENDADAS_BLOQUE`, sin sufijo « R1» — un extra no tiene
#     cadena de reemplazos). Una fila de cabecera, como su contraparte.
#   - «Aulas Aplicadas (Extra)»: banda de grupo + ID MATCH + agenda + parte,
#     UN solo bloque. Dos filas de cabecera, como su contraparte.
#   - Filas por FACULTAD alfabetica y dentro por codigo, en ORDEN ESPEJO entre
#     las dos hojas (la doctrina M1 de 2025: sin geometria estable no hay
#     arrastre por codigo que anclar).
#   - Cada hoja Extra va INMEDIATAMENTE despues de su contraparte en el libro
#     (decision del lead): Aulas Agendadas, Aulas Agendadas (Extra), Aulas
#     Aplicadas (Campo), Aulas Aplicadas (Extra), Base de control, ...
#
# Las celdas se DERIVAN de las mismas specs que las hojas principales
# (`.calg_celdas_agenda`, `.cap_celdas_parte`, `.calg_titulos_*`): aqui no hay
# una segunda lista literal de titulos que pueda separarse de la primera.
#
# Un extra ACTIVADO (con parte o control registrado) conserva el trato de
# siempre: `.calg_unidades_del_libro` lo deja entrar a las hojas principales
# (test-carga-aulas-libro-sin-banco.R lo pinea) y por eso NO se repite aqui —
# el banco de este modulo es el banco SIN usar.
#
# La «Base de control» no se toca: ya toma todo sin importar el codigo, que es
# la otra mitad del dictado.

AULAS_LIBRO_HOJA_AGENDADAS_EXTRA <- "Aulas Agendadas (Extra)"
AULAS_LIBRO_HOJA_APLICADAS_EXTRA <- "Aulas Aplicadas (Extra)"

# Las dos, en el orden en que se cuelgan del libro.
.calx_hojas_extra <- function() {
  c(AULAS_LIBRO_HOJA_AGENDADAS_EXTRA, AULAS_LIBRO_HOJA_APLICADAS_EXTRA)
}

# Las claves con que el lector de Sheets expone las hojas Extra
# (`aulas_libro_leer_de_sheets` / `aulas_libro_importar_valores`): clave ->
# nombre de pestaña. Una sola fuente para las dos capas, como
# `AULAS_LIBRO_HOJAS` lo es de las tres principales.
.calx_pestanas_sheets <- function() {
  stats::setNames(
    as.list(.calx_hojas_extra()),
    c("agendadas_extra", "aplicadas_extra")
  )
}

# Clave de orden natural: el numero embebido se compara como numero, no letra a
# letra. Es la leccion del libro principal — «CH 1, CH 10, CH 100, CH 11» — y
# aqui el orden por codigo ES el contrato, asi que «EXTRA 2» tiene que ir antes
# que «EXTRA 10».
.calx_clave_natural <- function(x) {
  v <- toupper(trimws(as.character(x %||% "")))
  m <- gregexpr("[0-9]+", v)
  regmatches(v, m) <- lapply(regmatches(v, m), function(nums) {
    if (!length(nums)) return(nums)
    sprintf("%012.0f", suppressWarnings(as.numeric(nums)))
  })
  v
}

#' El banco de extras que gana sus dos hojas: los `extra_reserve_pool` SIN usar.
#'
#' Se calcula sobre el plan CRUDO (antes de `.calg_unidades_del_libro`, que es
#' justo el filtro que los sacaba del libro). Un extra con parte o control
#' registrado NO entra: ese ya vive en las hojas principales y repetirlo aqui
#' lo duplicaria. Un extra sin codigo operativo tampoco: no hay como anclarlo
#' ni como releerlo por codigo, la misma regla con la que el lector descarta
#' bloques sin curso-horario.
#'
#' Devuelve las filas YA ORDENADAS —facultad alfabetica, dentro por codigo—
#' porque ese orden es la geometria de las dos hojas Y del arrastre: quien
#' consuma este banco sin reordenarlo queda en espejo con lo escrito.
#'
#' @param unidades filas del plan (formato largo, crudo).
#' @param partes,control registros que ACTIVAN un extra (lo sacan del banco).
#' @return lista de filas extra ordenadas; vacia si el plan no trae banco.
#' @keywords internal
aulas_libro_extras_banco <- function(unidades, partes = list(), control = list()) {
  usados <- .calg_codigos_usados(partes, control)
  extras <- Filter(function(u) {
    rol <- tolower(trimws(as.character(u$sample_role %||% "")))
    if (!identical(rol, "extra_reserve_pool")) return(FALSE)
    cod <- .calg_txt(u$operational_code, .calg_txt(u$classroom_id))
    nzchar(cod) && !(cod %in% usados)
  }, unidades %||% list())
  if (!length(extras)) return(list())
  fac <- vapply(extras, function(u) .calx_clave_natural(u$faculty), character(1))
  cod <- vapply(extras, function(u) .calx_clave_natural(u$operational_code), character(1))
  extras[order(fac, cod)]
}

# --- las dos hojas -------------------------------------------------------------

#' Arma la hoja «Aulas Agendadas (Extra)».
#'
#' Bloque v4 a profundidad 1: cabecera `ID MATCH` + los 20 titulos de
#' `AULAS_AGENDADAS_BLOQUE` sin sufijo de reemplazo, y una fila por extra con
#' las celdas de `.calg_celdas_agenda` — la MISMA spec que la hoja principal,
#' asi que un reorden del bloque reordena las dos a la vez.
#'
#' @param extras filas del banco, ya ordenadas (`aulas_libro_extras_banco`).
#' @return data.frame sin nombres, con la cabecera como primera fila.
#' @keywords internal
aulas_libro_hoja_agendadas_extra <- function(extras) {
  cabecera <- c("ID MATCH", .calg_titulos_agenda())
  filas <- lapply(seq_along(extras), function(i) {
    c(as.character(i), .calg_celdas_agenda(extras[[i]]))
  })
  as.data.frame(do.call(rbind, c(list(cabecera), filas)), stringsAsFactors = FALSE)
}

#' Arma la hoja «Aulas Aplicadas (Extra)».
#'
#' Un solo bloque: banda de grupo («EXTRA», el mismo vocabulario en mayusculas
#' de las bandas principales), fila de campos `ID MATCH` + agenda v4 + parte
#' v4, y una fila por extra EN EL MISMO ORDEN que la hoja de agendadas (Extra):
#' sin ese espejo el arrastre por codigo no tiene fila que anclar. El parte
#' sale de `.cap_celdas_parte`, que con parte nulo siembra los dos
#' denominadores y deja el resto en blanco — el caso normal del banco.
#'
#' @param extras filas del banco, ya ordenadas.
#' @param partes partes ya registrados (hoy el banco no los tiene: un extra con
#'   parte esta ACTIVADO y vive en las hojas principales; el parametro existe
#'   para que un cambio de esa regla no deje esta hoja ciega).
#' @return data.frame con dos filas de cabecera (banda y campos).
#' @keywords internal
aulas_libro_hoja_aplicadas_extra <- function(extras, partes = list()) {
  titulos_agenda <- .calg_titulos_agenda()
  titulos_campo <- .calg_titulos_campo()
  ancho <- 1L + length(titulos_agenda) + length(titulos_campo)
  por_aula <- list()
  for (pt in (partes %||% list())) {
    if (!is.list(pt)) next
    cod <- .calg_txt(pt$operational_code, .calg_txt(pt$classroom_id))
    if (nzchar(cod)) por_aula[[cod]] <- pt
  }
  grupo <- c("EXTRA", rep("", ancho - 1L))
  campos <- c("ID MATCH", titulos_agenda, titulos_campo)
  filas <- lapply(seq_along(extras), function(i) {
    u <- extras[[i]]
    c(as.character(i), .calg_celdas_agenda(u),
      .cap_celdas_parte(por_aula[[.calg_txt(u$operational_code)]], u, titulos_campo))
  })
  as.data.frame(do.call(rbind, c(list(grupo), list(campos), filas)), stringsAsFactors = FALSE)
}

# --- formato y validaciones del xlsx -------------------------------------------

#' Lo que las hojas Extra aportan al formateador del xlsx.
#'
#' Devuelve los fragmentos que `aulas_libro_generar` concatena a los suyos
#' antes de `aulas_libro_aplicar_formato`: filas de cabecera (estilo, freeze,
#' filtro, anchos), los desplegables apuntando a la MISMA hoja «Listas» que
#' las hojas principales, la columna repetida al imprimir (hasta el codigo) y
#' la banda de grupo combinada de la hoja de campo. Con un libro sin hojas
#' Extra devuelve fragmentos vacios y el formateador no ve diferencia.
#'
#' @param hojas la lista nombrada de data.frames del generador.
#' @param rango_de funcion `titulo de lista -> rango A1 en «Listas»` (la del
#'   generador: los indices de la hoja «Listas» viven alla y no se duplican).
#' @return lista `filas_cabecera`, `validaciones`, `columnas_repetidas`,
#'   `combinar`.
#' @keywords internal
aulas_libro_extras_formato <- function(hojas, rango_de) {
  out <- list(filas_cabecera = list(), validaciones = list(),
              columnas_repetidas = list(), combinar = list())
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  col_ag <- function(campo) 1L + which(campos == campo)[[1]]
  titulo_de <- function(campo) {
    AULAS_AGENDADAS_BLOQUE[[which(campos == campo)[[1]]]]$titulos[[1]]
  }

  ag <- hojas[[AULAS_LIBRO_HOJA_AGENDADAS_EXTRA]]
  if (is.data.frame(ag)) {
    filas <- nrow(ag) - 1L
    out$filas_cabecera[[AULAS_LIBRO_HOJA_AGENDADAS_EXTRA]] <- 1L
    out$columnas_repetidas[[AULAS_LIBRO_HOJA_AGENDADAS_EXTRA]] <- col_ag("operational_code")
    # Los mismos desplegables del bloque de agenda, a profundidad 1.
    # `email_received` entra con B22 (los extras arrancan sembrados «No») y
    # `call_status` con B23 (el resultado de cada llamada, sembrado vacio).
    for (campo in c("sample_status", "contact_medium", "scheduled_day",
                    "scheduled_moment", "email_received", "call_status")) {
      out$validaciones[[length(out$validaciones) + 1L]] <- list(
        hoja = AULAS_LIBRO_HOJA_AGENDADAS_EXTRA, desde = 1L, filas = filas,
        cols = col_ag(campo), rango = rango_de(titulo_de(campo))
      )
    }
  }

  ap <- hojas[[AULAS_LIBRO_HOJA_APLICADAS_EXTRA]]
  if (is.data.frame(ap)) {
    filas <- nrow(ap) - 2L
    ancho <- 1L + length(.calg_titulos_agenda()) + length(.calg_titulos_campo())
    out$filas_cabecera[[AULAS_LIBRO_HOJA_APLICADAS_EXTRA]] <- 2L
    out$columnas_repetidas[[AULAS_LIBRO_HOJA_APLICADAS_EXTRA]] <-
      1L + which(.calg_titulos_agenda() == "CURSO-HORARIO")
    out$combinar[[length(out$combinar) + 1L]] <- list(
      hoja = AULAS_LIBRO_HOJA_APLICADAS_EXTRA, fila = 1L, cols = seq_len(ancho)
    )
    out$validaciones[[length(out$validaciones) + 1L]] <- list(
      hoja = AULAS_LIBRO_HOJA_APLICADAS_EXTRA, desde = 2L, filas = filas,
      cols = 1L + length(.calg_titulos_agenda()) +
        which(.calg_titulos_campo() == "STATUS DE APLICACIÓN"),
      rango = rango_de("STATUS DE APLICACIÓN")
    )
  }
  out
}

# --- la relectura del xlsx -----------------------------------------------------

#' Lee las hojas Extra de un libro, si las trae.
#'
#' Con la MISMA maquinaria de las hojas principales: los dos lectores ya se
#' parametrizan por nombre de hoja y emparejan por titulo, asi que un extra
#' vuelve por codigo como cualquier aula. Un libro sin hojas Extra —todos los
#' libros vivos del operativo— devuelve listas vacias y la importacion queda
#' EXACTAMENTE como hoy: las hojas Extra son opcionales, no se declaran en
#' `hojas_ausentes`.
#'
#' @param path ruta al `.xlsx`.
#' @param hojas_presentes nombres de hoja del libro (ya leidos por quien llama).
#' @return lista `plan` (filas de agenda extra) y `partes` (partes extra).
#' @keywords internal
aulas_libro_extras_importar <- function(path, hojas_presentes) {
  plan <- if (AULAS_LIBRO_HOJA_AGENDADAS_EXTRA %in% hojas_presentes) {
    aulas_agendadas_leer(path, hoja = AULAS_LIBRO_HOJA_AGENDADAS_EXTRA)
  } else {
    list()
  }
  partes <- if (AULAS_LIBRO_HOJA_APLICADAS_EXTRA %in% hojas_presentes) {
    aulas_aplicadas_leer(path, hoja = AULAS_LIBRO_HOJA_APLICADAS_EXTRA)
  } else {
    list()
  }
  list(plan = plan, partes = partes)
}

# Une el plan de la hoja principal con el de la Extra CONSERVANDO el atributo
# `campos_ausentes` de la principal: `c()` lo descarta y el aviso de columnas
# renombradas moriria en silencio justo al ganar una hoja mas. El `sample_role`
# de lo leido no se reinterpreta aqui: la fusion por codigo de la sesion decide,
# como con cualquier aula (decision del lead, B14).
.calx_unir_plan <- function(plan, plan_extra) {
  if (!length(plan_extra)) return(plan)
  ausentes <- attr(plan, "campos_ausentes")
  out <- c(plan, plan_extra)
  attr(out, "campos_ausentes") <- ausentes
  out
}

# --- validaciones en el Sheets publicado ---------------------------------------

#' Requests de desplegables/calendario de las pestañas Extra en Sheets.
#'
#' El complemento Sheets de `aulas_libro_extras_formato`: los mismos
#' vocabularios de la hoja «Listas» via los constructores de
#' `monitoreo_aulas_sheets_formato.R`, con la geometria del bloque 1 — que es
#' exactamente la de estas hojas (profundidad/intento unico). En la hoja de
#' campo solo se valida lo que el equipo TECLEA (status y fecha de aplicacion):
#' sus columnas de agenda son formulas de arrastre y validar sobre ellas
#' invitaria a escribir donde no se debe, la misma regla que la hoja principal.
#'
#' @param sheet_id sheetId remoto de la pestaña.
#' @param tab_name nombre de la pestaña.
#' @param rows values publicados (cabeceras incluidas).
#' @return lista de requests; vacia para pestañas que no son Extra.
#' @keywords internal
aulas_libro_extras_sheets_requests <- function(sheet_id, tab_name, rows) {
  n_filas <- length(rows %||% list())
  if (identical(tab_name, AULAS_LIBRO_HOJA_AGENDADAS_EXTRA)) {
    cabeceras <- 1L
    if (n_filas <= cabeceras) return(list())
    requests <- list()
    specs <- list(
      list(campo = "sample_status", valores = aulas_libro_status_muestra(1L)),
      list(campo = "contact_medium", valores = AULAS_LIBRO_MEDIO_CONTACTO),
      list(campo = "scheduled_day", valores = AULAS_LIBRO_DIA),
      list(campo = "scheduled_moment", valores = AULAS_LIBRO_MOMENTO_CLASE),
      # B22: {Sí, No} — los extras van sembrados «No» y el correo del dia 1
      # se marca aqui.
      list(campo = "email_received", valores = AULAS_LIBRO_RECIBIO_CORREO),
      # B23: el resultado de cada llamada, tambien en el banco.
      list(campo = "call_status", valores = AULAS_LIBRO_STATUS_LLAMADA)
    )
    for (spec in specs) {
      requests[[length(requests) + 1L]] <- .mafs_validacion_request(
        sheet_id, .mafs_col_agenda(spec$campo, 1L), cabeceras, n_filas, spec$valores
      )
    }
    for (campo in c("contact_date", "scheduled_date")) {
      requests[[length(requests) + 1L]] <- .mafs_fecha_request(
        sheet_id, .mafs_col_agenda(campo, 1L), cabeceras, n_filas
      )
    }
    return(requests)
  }
  if (identical(tab_name, AULAS_LIBRO_HOJA_APLICADAS_EXTRA)) {
    cabeceras <- 2L
    if (n_filas <= cabeceras) return(list())
    return(list(
      # La hoja Extra es TODA de reservas: su vocabulario es el del eslabón 2 en
      # adelante, aunque su único bloque se numere 1. Un extra no reemplaza a
      # nadie —cierra cuota de hombres o mujeres—, así que lo que puede ser es
      # la aplicación de refuerzo.
      .mafs_validacion_request(
        sheet_id, .mafs_col_campo("STATUS DE APLICACIÓN", 1L), cabeceras, n_filas,
        aulas_libro_status_aplicacion_de(2L)
      ),
      .mafs_fecha_request(
        sheet_id, .mafs_col_campo("FECHA DE APLICACIÓN", 1L), cabeceras, n_filas
      )
    ))
  }
  list()
}
