# El TRANSPORTE de la excepcion acotada: llevar «REFUERZO POR CONTACTAR» a la
# hoja de agendacion del equipo, celda a celda.
#
# Gonzalo, 2026-09-11: «¿y se puede ver en el Sheets de agendacion para que el
# agendador sepa cual es?»; y al saber que esa hoja es del equipo: «¿pero no se
# puede hacer una excepcion para esos casos?». Dio la palabra para publicar SOLO
# este caso.
#
# `monitoreo_aulas_marcas_sheets.R` decide QUE celdas son escribibles y por que
# las demas no; este archivo es el unico que habla con la red, y respeta las
# cuatro garantias de aquel:
#
#   1. Una sola columna: STATUS MUESTRA.
#   2. Solo las filas que la app marco como `refuerzo_por_contactar`.
#   3. Solo si la celda remota esta LIBRE («», «EN RESERVA», «SIN CONTACTAR»).
#   4. Nunca borra: sin fila que marcar no sale un solo request.
#
# **Dos hojas, no una.** Los codigos `EXTRA *` no viven en «Aulas Agendadas»
# sino en «Aulas Agendadas (Extra)», y el reparto del techo elige sobre todo
# extras. Publicar solo en la primera dejaria fuera justo a la mayoria.

.mapm_txt <- function(v) {
  v <- as.character(v %||% "")
  v[is.na(v)] <- ""
  trimws(v)
}

#' Las hojas de agendacion donde puede vivir un curso-horario marcado.
#' @keywords internal
MONITOREO_AULAS_HOJAS_DE_AGENDA <- c("Aulas Agendadas", "Aulas Agendadas (Extra)")

#' Columna en letras A1 («12» → «L»).
#' @keywords internal
.mapm_letra <- function(n) {
  s <- ""
  n <- as.integer(n)
  while (n > 0L) {
    r <- (n - 1L) %% 26L
    s <- paste0(LETTERS[[r + 1L]], s)
    n <- (n - 1L) %/% 26L
  }
  s
}

#' Encuentra la fila de encabezado y TODOS sus pares (codigo, estado).
#'
#' **Se busca, y en plural.** El libro del operativo lleva BLOQUES de ~38
#' columnas —titular, R1, R2…— y cada bloque repite su propio «CURSO-HORARIO» y
#' su «STATUS MUESTRA». Mirar solo el primero deja fuera a todas las reservas de
#' cadena: medido el 2026-09-11, de quince marcadas se pintaron nueve (los EXTRA,
#' que viven en filas propias) y las seis reservas salieron «sin fila en el
#' libro» teniendo su fila delante. Los pares se emparejan POR ORDEN, que es el
#' orden en que la hoja escribe los bloques.
#'
#' Y la fila tampoco se asume: el libro lleva banda de titulo encima, asi que la
#' 1 no siempre es el encabezado, y anclar por numero fijo es como se pisa la
#' celda de otro.
#'
#' @param valores `values` crudos de la pestaña (lista de filas).
#' @param col_codigo,col_estado rotulos a emparejar.
#' @return lista `{fila, pares}` donde cada par es `{codigo, estado}` en base 1,
#'   o `NULL` si ninguna fila trae los dos rotulos.
#' @keywords internal
.mapm_encabezado <- function(valores, col_codigo = "CURSO-HORARIO",
                             col_estado = "STATUS MUESTRA") {
  if (!length(valores)) return(NULL)
  tope <- min(length(valores), 20L)
  for (i in seq_len(tope)) {
    celdas <- toupper(.mapm_txt(unlist(valores[[i]], use.names = FALSE)))
    # **Por PREFIJO, no por igualdad.** Los bloques R1+ del libro rotulan con
    # sufijo —«CURSO-HORARIO R1», «STATUS MUESTRA R1»,
    # `paste0(titulos_bloque, " R", b - 1L)` en `carga_aulas_libro_generar.R`—,
    # asi que comparar exacto encontraba SOLO el titular. Medido el 2026-09-11:
    # de quince marcadas, las seis reservas de cadena salian «sin fila en el
    # libro» teniendo su fila delante.
    #
    # El prefijo es seguro porque los otros rotulos que empiezan por «STATUS»
    # —«STATUS DE LLAMADA», «STATUS DE APLICACION»— no empiezan por «STATUS
    # MUESTRA»; el ancla es la etiqueta entera, no la primera palabra.
    empieza <- function(pref) which(startsWith(celdas, toupper(pref)))
    ic <- sort(unique(c(empieza(col_codigo), empieza("CURSO HORARIO"))))
    ie <- empieza(col_estado)
    if (!length(ic) || !length(ie)) next
    # Un bloque sin su pareja no participa: escribir en un STATUS MUESTRA cuya
    # columna de codigo no existe seria marcar una fila a ciegas.
    n <- min(length(ic), length(ie))
    pares <- lapply(seq_len(n), function(k) list(codigo = ic[[k]], estado = ie[[k]]))
    return(list(fila = i, pares = pares))
  }
  NULL
}

#' Arma el `remoto` de dos columnas de UN bloque, como lo espera el motor.
#' @keywords internal
.mapm_remoto <- function(valores, fila_enc, par) {
  cuerpo <- if (length(valores) > fila_enc) valores[(fila_enc + 1L):length(valores)] else list()
  celda <- function(fila, j) {
    v <- unlist(fila, use.names = FALSE)
    if (length(v) >= j) .mapm_txt(v[[j]]) else ""
  }
  data.frame(
    `CURSO-HORARIO` = vapply(cuerpo, celda, character(1), j = par$codigo),
    `STATUS MUESTRA` = vapply(cuerpo, celda, character(1), j = par$estado),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

#' El sheetId numerico de cada pestaña, que las requests de formato necesitan.
#' @keywords internal
.mapm_sheet_ids <- function(spreadsheet_id) {
  url <- paste0(.monitoreo_sheets_api_base(spreadsheet_id), "?fields=sheets.properties")
  meta <- tryCatch(.monitoreo_google_api(url), error = function(e) NULL)
  out <- list()
  for (h in (meta$sheets %||% list())) {
    pr <- h$properties %||% list()
    nombre <- .mapm_txt(pr$title)
    if (nzchar(nombre)) out[[nombre]] <- as.integer(.monitoreo_scalar(pr$sheetId, NA_integer_))
  }
  out
}

#' Los estados en que puede terminar el paso de formato de UNA hoja.
#'
#' **El vocabulario es cerrado y esta declarado a proposito.** La clase 4 del
#' catalogo —un paso que puede no ocurrir y no lo cuenta— se cuela justo por
#' aqui: se añade una rama de salida, se olvida darle nombre, y el resultado
#' vuelve a quedarse mudo mientras el acuse habla de las celdas escritas. Con la
#' lista declarada, `test-monitoreo-aulas-publicar-marcas.R` puede exigir que
#' cada estado que el codigo produce este aqui y que el texto sepa decirlo.
#'
#' - `aplicado`: se emitieron las requests y Google las acepto.
#' - `error`: se emitieron y fallaron; el motivo viaja en `error`.
#' - `ensayo`: `aplicar = FALSE`, no se toco nada a proposito.
#' - `sin-columnas`: ninguna celda de esta hoja era de la app.
#' - `sin-sheet-id`: la pestaña no aparecio en la metadata del libro.
#' - `sin-requests`: habia columnas pero no salio ninguna request.
#' @keywords internal
MONITOREO_AULAS_FORMATO_ESTADOS <- c(
  "aplicado", "error", "ensayo", "sin-columnas", "sin-sheet-id", "sin-requests"
)

#' Desplegable y color para las columnas que esta publicacion acaba de tocar.
#'
#' **Dos averias que se ven en pantalla y no en el resultado.** El valor escrito
#' no pertenece al desplegable de esa columna, asi que Sheets lo marca con el
#' triangulo rojo «el valor introducido debe ser un elemento de la lista
#' especificada»; y el morado de `.mafs_REGLAS_STATUS_MUESTRA` no llega, porque
#' la hoja es del equipo y la app no le reenvia formato.
#'
#' Se arregla SOLO en las columnas tocadas y sin borrar nada: la validacion se
#' reemite con el vocabulario completo —`strict = FALSE`, asi que no pelea con
#' lo que el equipo ya tenga escrito— y el color entra como regla condicional
#' aditiva sobre ese texto exacto.
#'
#' @param sheet_id sheetId numerico de la pestaña.
#' @param columnas columnas de STATUS MUESTRA tocadas (base 1).
#' @param fila_enc fila del encabezado (base 1).
#' @param n_filas filas de la pestaña.
#' @return lista de requests de `:batchUpdate` (vacia si no hay columnas).
#' @keywords internal
.mapm_requests_de_columna <- function(sheet_id, columnas, fila_enc, n_filas) {
  if (!length(columnas) || is.na(sheet_id)) return(list())
  desde <- as.integer(fila_enc)      # base 0, primera fila de datos
  hasta <- as.integer(max(n_filas, fila_enc + 1L))
  regla <- .mafs_REGLAS_STATUS_MUESTRA[[1]]
  reqs <- list()
  for (col in columnas) {
    reqs[[length(reqs) + 1L]] <- .mafs_validacion_request(
      sheet_id, col, desde, hasta, aulas_libro_status_muestra(1L))
    reqs[[length(reqs) + 1L]] <- list(addConditionalFormatRule = list(
      rule = list(
        ranges = list(list(
          sheetId = sheet_id,
          startRowIndex = desde, endRowIndex = hasta,
          startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)
        )),
        booleanRule = list(
          condition = list(type = "TEXT_EQ",
                           values = list(list(userEnteredValue = regla$texto))),
          format = list(
            backgroundColor = .monitoreo_sheets_rgb(regla$fondo),
            textFormat = list(bold = TRUE,
                              foregroundColor = .monitoreo_sheets_rgb(regla$tinta))
          )
        )
      ),
      index = 0L
    ))
  }
  reqs
}

#' Publica «REFUERZO POR CONTACTAR» en las celdas libres de la hoja de agenda.
#'
#' @param spreadsheet_id id del libro del operativo.
#' @param plan lista de filas del plan, con `sample_status` normalizado.
#' @param hojas nombres de las pestañas de agendacion a recorrer.
#' @param aplicar `FALSE` para un ENSAYO: calcula y no escribe una sola celda.
#' @return lista con `escritas`, `respetadas`, `sin_fila`, `por_hoja` y `mensaje`.
#' @export
monitoreo_aulas_publicar_marcas <- function(spreadsheet_id, plan = list(),
                                            hojas = MONITOREO_AULAS_HOJAS_DE_AGENDA,
                                            aplicar = TRUE) {
  id <- .mapm_txt(spreadsheet_id)[1]
  if (!nzchar(id)) {
    stop_api(400, "E_AULAS_SHEETS_SIN_ID",
             "Falta el identificador del Google Sheets del libro de aulas.")
  }
  # Normalizado por el mismo motivo que en `monitoreo_aulas_marcas_sheets.R`:
  # releer el libro deja el estado en su forma de Excel y el crudo no casa.
  marcadas <- Filter(function(r) {
    identical(monitoreo_aulas_estado_muestra(r$sample_status), "refuerzo_por_contactar")
  }, plan %||% list())
  if (!length(marcadas)) {
    stop_api(409, "E_MARCAS_SIN_NADA_QUE_PUBLICAR",
             "No hay ningun curso-horario marcado como refuerzo por contactar.")
  }

  pendientes <- vapply(marcadas, function(r) .mapm_txt(r$operational_code), character(1))
  # La metadata se pide UNA vez y solo si hace falta escribir formato.
  sheet_ids <- NULL
  formato_fallo <- ""
  formato <- list()
  escritas <- list()
  respetadas <- list()
  por_hoja <- list()

  for (hoja in hojas) {
    if (!length(pendientes)) break
    valores <- tryCatch(.cads_valores_de_pestana(id, hoja), error = function(e) NULL)
    # Una pestaña que no existe NO es un error: el libro de un operativo sin
    # extras no la tiene, y fallar obligaria a crearla vacia.
    if (is.null(valores) || !length(valores)) next
    enc <- .mapm_encabezado(valores)
    if (is.null(enc)) next

    datos <- list()
    columnas_tocadas <- integer(0)
    n_respetadas <- 0L
    # **Bloque a bloque.** Cada uno tiene su columna de codigo y su columna de
    # estado, y un codigo aparece en UNO solo: el titular en el bloque 0, la
    # primera reserva en el R1, y asi. Se recorren todos y lo que se resuelve en
    # uno sale de la lista de pendientes.
    for (par in enc$pares) {
      if (!length(pendientes)) break
      aun <- Filter(function(r) .mapm_txt(r$operational_code) %in% pendientes, marcadas)
      if (!length(aun)) break
      out <- monitoreo_aulas_marcas_por_publicar(aun, .mapm_remoto(valores, enc$fila, par))

      for (e in out$escribibles) {
        # Fila absoluta = encabezado + posicion en el cuerpo. La columna es la
        # del BLOQUE que trajo el codigo: nunca una letra fija.
        fila_abs <- enc$fila + e$fila
        datos[[length(datos) + 1L]] <- list(
          range = sprintf("'%s'!%s%d", gsub("'", "''", hoja),
                          .mapm_letra(par$estado), fila_abs),
          values = list(list(e$texto))
        )
        escritas[[length(escritas) + 1L]] <- list(
          codigo = e$codigo, hoja = hoja, fila = fila_abs)
        columnas_tocadas <- union(columnas_tocadas, par$estado)
      }
      for (r in out$respetadas) {
        respetadas[[length(respetadas) + 1L]] <- list(
          codigo = r$codigo, hoja = hoja, habia = r$habia)
        n_respetadas <- n_respetadas + 1L
        # **La marca que ya estaba puesta es NUESTRA, no trabajo del equipo.**
        # Sin esta rama, republicar no arreglaba nunca el color: la celda ya
        # llevaba el texto, asi que salia «respetada», `datos` quedaba vacio y el
        # desplegable y el morado no se emitian. Medido en pantalla el
        # 2026-09-11: nueve celdas escritas y las nueve con el triangulo rojo
        # despues de republicar.
        if (identical(toupper(.mapm_txt(r$habia)), "REFUERZO POR CONTACTAR")) {
          columnas_tocadas <- union(columnas_tocadas, par$estado)
        }
      }
      pendientes <- setdiff(pendientes, c(
        vapply(out$escribibles, function(e) e$codigo, character(1)),
        vapply(out$respetadas, function(r) r$codigo, character(1))
      ))
    }

    celdas <- 0L
    if (aplicar && length(datos)) {
      r <- .monitoreo_google_api(
        paste0(.monitoreo_sheets_api_base(id), "/values:batchUpdate"),
        method = "POST",
        # **RAW y nunca USER_ENTERED.** La trampa que ya costo reescribir 50.286
        # celdas: lo que USER_ENTERED interpreta deja de ser el texto que el
        # equipo lee.
        body = list(valueInputOption = "RAW", data = datos)
      )
      celdas <- as.integer(.monitoreo_scalar(r$totalUpdatedCells, length(datos)))
    }
    # **El formato va aunque no se haya escrito nada nuevo.** Es la unica forma
    # de que republicar arregle una marca que ya estaba puesta y salia en rojo.
    #
    # **Y cada salida se DECLARA.** La version anterior tenia dos caminos mudos
    # —sin sheetId y sin requests— que dejaban la celda en rojo sin una sola
    # linea que lo dijera: el acuse hablaba de celdas escritas y del color no
    # decia nada, ni bien ni mal. Un paso que puede no ocurrir tiene que contar
    # por que no ocurrio.
    fmt <- list(hoja = hoja, columnas = length(columnas_tocadas),
                sheet_id = NA_integer_, requests = 0L, estado = "sin-columnas",
                error = "")
    if (aplicar && length(columnas_tocadas)) {
      # **Y que la celda no salga en rojo ni en gris.** El valor escrito no esta
      # en el desplegable de esa columna —«el valor introducido debe ser un
      # elemento de la lista especificada», visto en pantalla el 2026-09-11— y el
      # morado de la paleta no llega porque la hoja es del equipo y la app no le
      # reenvia formato. Las dos cosas se arreglan SOLO en las columnas que esta
      # publicacion acaba de tocar, que es hasta donde llega la excepcion.
      if (is.null(sheet_ids)) {
        sheet_ids <- tryCatch(.mapm_sheet_ids(id), error = function(e) {
          fmt$error <<- conditionMessage(e)
          list()
        })
      }
      sid <- if (hoja %in% names(sheet_ids)) sheet_ids[[hoja]] else NA_integer_
      fmt$sheet_id <- sid
      if (is.na(sid)) {
        fmt$estado <- "sin-sheet-id"
      } else {
        reqs <- .mapm_requests_de_columna(sid, columnas_tocadas, enc$fila, length(valores))
        fmt$requests <- length(reqs)
        if (!length(reqs)) {
          fmt$estado <- "sin-requests"
        } else {
          ok <- tryCatch({
            .monitoreo_google_api(
              paste0(.monitoreo_sheets_api_base(id), ":batchUpdate"),
              method = "POST", body = list(requests = reqs))
            TRUE
          },
          # El valor ya esta escrito, que es lo que pidio Gonzalo. Si el formato
          # no entra, se dice y no se tumba la publicacion entera por un color.
          error = function(e) { fmt$error <<- conditionMessage(e); FALSE })
          fmt$estado <- if (isTRUE(ok)) "aplicado" else "error"
          if (!isTRUE(ok)) formato_fallo <- fmt$error
        }
      }
    } else if (!aplicar) {
      fmt$estado <- "ensayo"
    }
    formato[[length(formato) + 1L]] <- fmt

    por_hoja[[length(por_hoja) + 1L]] <- list(
      hoja = hoja, escribibles = length(datos), celdas = celdas,
      respetadas = n_respetadas)

  }

  out <- list(escritas = escritas, respetadas = respetadas,
              sin_fila = pendientes, por_hoja = por_hoja,
              formato = formato, formato_fallo = formato_fallo,
              aplicado = isTRUE(aplicar))
  out$mensaje <- monitoreo_aulas_publicar_marcas_texto(out)
  out
}

#' La frase de una publicacion de marcas, con sus tres cifras y su base.
#' @param out salida de `monitoreo_aulas_publicar_marcas()`.
#' @return texto.
#' @export
monitoreo_aulas_publicar_marcas_texto <- function(out) {
  n_esc <- length(out$escritas %||% list())
  n_res <- length(out$respetadas %||% list())
  n_sin <- length(out$sin_fila %||% character(0))
  verbo <- if (isTRUE(out$aplicado)) "Se pintaron" else "Se pintarian"
  partes <- sprintf("%s %d %s en la hoja de agendacion", verbo, n_esc,
                    if (n_esc == 1) "celda" else "celdas")
  if (n_res) {
    partes <- paste0(partes, sprintf("; %d %s porque el equipo ya escribio ahi",
                                     n_res, if (n_res == 1) "se respeto" else "se respetaron"))
  }
  if (n_sin) {
    partes <- paste0(partes, sprintf("; %d sin fila en el libro (%s)", n_sin,
                                     paste(utils::head(out$sin_fila, 5L), collapse = ", ")))
  }
  partes <- paste0(partes, ".")
  # **El formato se dice SIEMPRE y aparte.** El valor ya esta escrito, y
  # confundir «no entro el color» con «no se pinto la celda» manda a mirar la
  # hoja equivocada; callar cuando no se intento es peor todavia.
  estados <- vapply(out$formato %||% list(), function(f) .mapm_txt(f$estado), character(1))
  if (length(estados)) {
    if (all(estados %in% c("aplicado", "ensayo", "sin-columnas"))) {
      if (any(estados == "aplicado")) {
        partes <- paste0(partes, " Desplegable y color reemitidos en la columna.")
      }
    } else {
      detalle <- vapply(out$formato, function(f) {
        sprintf("%s: %s%s", .mapm_txt(f$hoja), .mapm_txt(f$estado),
                if (nzchar(.mapm_txt(f$error))) paste0(" — ", .mapm_txt(f$error)) else "")
      }, character(1))
      partes <- paste0(partes,
        " El valor esta escrito, pero el desplegable y el color NO entraron (",
        paste(detalle, collapse = "; "), ").")
    }
  }
  partes
}
