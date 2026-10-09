# Leer las hojas del libro de aulas desde Google Sheets.
#
# La otra puerta del mismo ciclo. `aulas_agendadas_leer()` entra por el `.xlsx`;
# esto entra por la pestaña que el equipo llena en linea, que es lo que pasa
# cuando el operativo esta en marcha y nadie quiere descargar un archivo para
# ver como va.
#
# NO publica nada. La publicacion a Sheets solo escribe pestañas CONTROLADAS
# —`.monitoreo_sheets_controlled_tab_names()`, 99 nombres y ninguno de aulas— y
# eso es deliberado: las tres hojas del libro las llena el equipo, y una
# publicacion que las tocara borraria su trabajo. El sentido App -> Sheets es
# una siembra, no una sincronizacion.
#
# La trampa que resuelve este modulo: la API de Sheets devuelve las filas
# DENTADAS. Recorta las celdas vacias del final de cada fila, asi que en la hoja
# de agenda —241 columnas— una fila cuyo ultimo dato esta en la columna 180 llega
# con 180 celdas. Pasarlas asi a un `data.frame` corre las columnas de esa fila y
# el lector empieza a leer `HORA` donde hay `DIA`. El relleno no es cosmetico:
# sin el, los datos salen desplazados y en silencio.

# Una matriz rectangular de texto a partir de las filas de la API.
.cads_rectangular <- function(values) {
  filas <- lapply(values %||% list(), function(f) as.character(unlist(f, use.names = FALSE)))
  if (!length(filas)) return(NULL)
  ancho <- max(vapply(filas, length, integer(1)))
  if (!is.finite(ancho) || ancho < 1L) return(NULL)
  # `f[seq_len(ancho)]` ES el relleno: indexar mas alla del largo da `NA`, y con
  # todas las filas del mismo largo `rbind` ya no recicla. Comprobado por
  # mutantes, que corrigieron dos cosas que yo creia:
  #   - un `if` que añadia `rep("", ...)` a mano era codigo muerto (siete tests
  #     seguian verdes sin el);
  #   - la sustitucion de `NA` de abajo TAMPOCO sostiene el caso (idem), asi que
  #     se queda como red por si la API manda un `NA` de verdad, no como la
  #     linea que arregla el dentado.
  # Quitar esta linea SI pone el test en rojo. Sheets recorta por el FINAL,
  # nunca por delante, asi que el hueco siempre cae a la derecha.
  m <- do.call(rbind, lapply(filas, function(f) f[seq_len(ancho)]))
  m[is.na(m)] <- ""
  m
}

#' Filas del plan a partir de los valores crudos de una pestaña de Sheets.
#'
#' @param values filas tal como las devuelve `spreadsheets.values.get`.
#' @param hoja cual de las tres hojas del libro es.
#' @return las mismas filas de plan que producen los lectores del `.xlsx`.
#' @export
aulas_libro_desde_valores <- function(values, hoja = c("agendadas", "aplicadas", "control")) {
  hoja <- match.arg(hoja)
  m <- .cads_rectangular(values)
  # Una pestaña con solo la cabecera no es un error: es el libro recien sembrado
  # y todavia sin llenar.
  if (is.null(m) || nrow(m) < 2L) return(list())

  # `aplicadas` y `control` llevan DOS filas de cabecera —grupo y campo—; la de
  # agenda lleva una. Es el mismo reparto que usa el generador.
  n_cabecera <- if (identical(hoja, "agendadas")) 1L else 2L
  if (nrow(m) <= n_cabecera) return(list())
  titulos <- as.character(m[n_cabecera, ])
  cuerpo <- as.data.frame(m[-seq_len(n_cabecera), , drop = FALSE], stringsAsFactors = FALSE)

  switch(
    hoja,
    agendadas = aulas_agendadas_a_plan(cuerpo, titulos),
    aplicadas = aulas_aplicadas_a_partes(cuerpo, titulos),
    control = base_control_a_filas(cuerpo, titulos)
  )
}

# El rol de la fuente decide QUE hoja es. `monitoreo_sync_fuentes.R` ya declara
# los tres —`MONITOREO_AULAS_LIBRO_ROLES`— y su comentario ya anticipaba este
# caso: «el libro entero puede vivir en Drive como un Sheet de tres pestanas, y
# entonces llega como `google_sheets` con el mismo rol». Lo que faltaba era
# justo esta traduccion: sin ella, una pestaña del libro se leia como una tabla
# de respuestas cualquiera.
AULAS_LIBRO_HOJA_POR_ROL <- c(
  agendamiento = "agendadas",
  parte_campo  = "aplicadas",
  control      = "control"
)

#' La hoja del libro que corresponde a un rol de fuente.
#'
#' @param rol uno de `MONITOREO_AULAS_LIBRO_ROLES`.
#' @return `"agendadas"`, `"aplicadas"`, `"control"`, o `""` si no es del libro.
#' @export
aulas_libro_hoja_por_rol <- function(rol) {
  clave <- tolower(trimws(as.character(rol %||% "")[1]))
  if (is.na(clave) || !nzchar(clave)) return("")
  # `[[` con un nombre que no esta LANZA, no devuelve NULL, asi que el `%||%`
  # nunca llegaba a correr: un rol desconocido reventaba en vez de contestar
  # «esta fuente no es del libro». Lo caza el test del rol «respuestas».
  if (!clave %in% names(AULAS_LIBRO_HOJA_POR_ROL)) return("")
  unname(AULAS_LIBRO_HOJA_POR_ROL[[clave]])
}

#' Filas del plan a partir de una pestaña de Sheets y el rol de su fuente.
#'
#' @param values filas crudas de la API.
#' @param rol rol declarado en la fuente.
#' @return filas de plan, o `list()` si el rol no es de una hoja del libro.
#' @export
aulas_libro_desde_fuente <- function(values, rol) {
  hoja <- aulas_libro_hoja_por_rol(rol)
  # Un rol que no es del libro NO se adivina: devolver «agendadas» por defecto
  # leeria una tabla de respuestas como si fuera la agenda y produciria filas de
  # plan inventadas.
  if (!nzchar(hoja)) return(list())
  aulas_libro_desde_valores(values, hoja)
}

#' Importa el libro completo desde los valores de tres pestañas de Sheets.
#'
#' **La otra puerta del ciclo, ahora conectada.** Este modulo sabia convertir
#' los valores de la API en plan, partes y control desde que se escribio, y
#' nadie lo llamaba: `aulas_libro_desde_valores()` no tenia un solo consumidor
#' en todo el repo. Lo que faltaba no era la conversion sino el remate —el
#' recuento del resumen vivia dentro del lector de Excel—, asi que se extrajo a
#' `.calb_ensamblar()` y las dos puertas lo comparten.
#'
#' El resultado tiene la MISMA forma que `aulas_libro_importar()`, que es lo que
#' permite que `aulas_libro_importar_en_sesion()` no tenga que saber por donde
#' entro el libro.
#'
#' Una hoja que no venga se declara en `hojas_ausentes`, igual que en el `.xlsx`:
#' leer solo la agenda es un caso normal —el jefe de campo llena la suya en otro
#' momento— y no un error.
#'
#' @param hojas lista con `agendadas`, `aplicadas` y/o `control` —y, si el
#'   libro trae banco (B14), `agendadas_extra` / `aplicadas_extra`—; cada una
#'   son las filas tal como las devuelve la API de Sheets (`values`).
#' @return La misma estructura que `aulas_libro_importar()`.
#' @export
aulas_libro_importar_valores <- function(hojas = list()) {
  hojas <- hojas %||% list()
  trae <- function(k) {
    v <- hojas[[k]]
    !is.null(v) && length(v) > 0L
  }
  presentes <- vapply(c("agendadas", "aplicadas", "control"), trae, logical(1))
  if (!any(presentes)) {
    stop_api(
      422, "E_AULAS_LIBRO_SIN_HOJAS",
      "Ninguna de las tres pestañas del operativo de aulas trajo filas.",
      details = list(esperadas = lapply(AULAS_LIBRO_HOJAS, function(x) x$hoja))
    )
  }

  plan <- if (presentes[["agendadas"]]) aulas_libro_desde_valores(hojas$agendadas, "agendadas") else list()
  partes <- if (presentes[["aplicadas"]]) aulas_libro_desde_valores(hojas$aplicadas, "aplicadas") else list()

  # B14: las pestañas Extra, con los MISMOS traductores que sus contrapartes
  # (la geometria del bloque unico cae en la de siempre): la agenda y los
  # partes de un extra vuelven por codigo como cualquier aula, igual que en la
  # puerta del `.xlsx`. `.calx_unir_plan` conserva el attr `campos_ausentes`
  # del plan principal, que `c()` descartaria.
  if (trae("agendadas_extra")) {
    # `[[` y no `$`: «agendadas» es PREFIJO de «agendadas_extra» y el `$` de R
    # parcial-matchea — la trampa de `config$plan` pescando `plan_rows`.
    plan <- .calx_unir_plan(plan, aulas_libro_desde_valores(hojas[["agendadas_extra"]], "agendadas"))
  }
  if (trae("aplicadas_extra")) {
    partes <- c(partes, aulas_libro_desde_valores(hojas[["aplicadas_extra"]], "aplicadas"))
  }
  # `base_control_a_filas()` devuelve la lista de filas a secas; el ensamblado
  # espera la forma del lector de Excel, que ademas lleva `sin_nombre`.
  filas_control <- if (presentes[["control"]]) aulas_libro_desde_valores(hojas$control, "control") else list()
  control <- if (is.list(filas_control) && !is.null(filas_control$filas)) {
    filas_control
  } else {
    list(filas = filas_control, sin_nombre = integer(0))
  }

  ausentes <- lapply(AULAS_LIBRO_HOJAS[!presentes], function(x) x$hoja)
  .calb_ensamblar(plan, partes, control, ausentes)
}

#' Trae las filas crudas de una pestaña.
#'
#' Se pide `values` en crudo y no un `data.frame` como hace
#' `monitoreo_sheets_read_source()`: la cabecera del libro no siempre esta en la
#' fila 1 —la agenda si, las otras dos en la 2— y ese detalle ya lo resuelve
#' `aulas_libro_desde_valores()`. Convertir aqui obligaria a decidirlo dos veces.
#' @keywords internal
.cads_valores_de_pestana <- function(spreadsheet_id, pestana) {
  rango <- sprintf("'%s'", gsub("'", "''", pestana))
  url <- paste0(.monitoreo_sheets_api_base(spreadsheet_id), "/values/",
                utils::URLencode(rango, reserved = TRUE))
  payload <- .monitoreo_google_api(url)
  payload$values %||% list()
}

#' Lee las tres pestañas del libro de aulas de un Google Sheets.
#'
#' **Una pestaña que no existe NO es un error.** El operativo empieza con la
#' agenda y la hoja de campo aparece dias despues; fallar por eso obligaria al
#' equipo a crear pestañas vacias para poder sincronizar. Lo que no se pudo leer
#' se omite y `aulas_libro_importar_valores()` lo declara en `hojas_ausentes`,
#' igual que hace el `.xlsx` cuando le falta una hoja.
#'
#' @param spreadsheet_id id del documento.
#' @param pestanas nombres por clave (`agendadas`, `aplicadas`, `control`,
#'   `agendadas_extra`, `aplicadas_extra`). Por defecto los del libro que
#'   genera la app, que es el caso normal: el equipo sube ese archivo a Drive
#'   y trabaja sobre el.
#' @return lista de `values` por clave, lista para `aulas_libro_importar_valores()`.
#'   Lleva el atributo `fallos`: las pestañas que NO se pudieron leer por un
#'   motivo que no es «no existe», cada una con su mensaje. Una pestaña ausente
#'   y una que fallo por red no son lo mismo y antes se contaban igual.
#' @export
aulas_libro_leer_de_sheets <- function(spreadsheet_id, pestanas = list()) {
  id <- as.character(spreadsheet_id %||% "")[1]
  if (!nzchar(trimws(id))) {
    stop_api(400, "E_AULAS_SHEETS_SIN_ID",
             "Falta el identificador del Google Sheets del libro de aulas.")
  }
  # B14: las dos pestañas Extra entran al juego POR DEFECTO — la publicacion
  # las siembra y lo que el equipo teclee ahi tiene que volver por el sync,
  # igual que en el `.xlsx` (sin esto el dato muere camino a la app). Van
  # PRIMERO a proposito: cada pestaña se lee independiente y asi las tres
  # principales conservan su posicion de cierre en el recorrido, que es lo que
  # observan los contratos de esta puerta. Un libro sin extras las omite por
  # la regla de siempre (pestaña que no existe no es un error).
  por_defecto <- c(
    .calx_pestanas_sheets(),
    stats::setNames(
      lapply(AULAS_LIBRO_HOJAS, function(x) x$hoja),
      vapply(AULAS_LIBRO_HOJAS, function(x) x$clave, character(1))
    )
  )
  nombres <- utils::modifyList(por_defecto, as.list(pestanas %||% list()))

  out <- list()
  # **«No existe» y «no se pudo leer» NO son lo mismo, y se estaban contando
  # igual.** Cualquier error —red caida, cuota de la API, permiso revocado,
  # token vencido— se tragaba con `NULL` y la pestaña acababa en
  # `hojas_ausentes`, donde la UI dice «no esta en el libro». Es peor que
  # callar: manda a mirar el Sheets cuando lo que habia que hacer era
  # reintentar, y si la pestaña era «Aulas Aplicadas (Campo)» el parte entero
  # desaparece de la lectura sin una sola alarma.
  #
  # Los fallos viajan como ATRIBUTO para no cambiar la firma de una funcion con
  # consumidores; quien los quiera, `attr(x, "fallos")`.
  fallos <- list()
  for (clave in names(por_defecto)) {
    pestana <- as.character(nombres[[clave]] %||% "")[1]
    if (!nzchar(trimws(pestana))) next
    valores <- tryCatch(.cads_valores_de_pestana(id, pestana),
                        error = function(e) structure(list(), fallo = conditionMessage(e)))
    motivo <- attr(valores, "fallo")
    if (!is.null(motivo)) {
      # **Si no se sabe clasificar, es un fallo.** La pestaña que no existe se
      # reconoce porque la API se queja del RANGO; cualquier otra cosa —o algo
      # que no sepamos leer— se reporta, que es fallar cerrado.
      if (!grepl("unable to parse range|no such sheet|rango", motivo, ignore.case = TRUE)) {
        fallos[[length(fallos) + 1L]] <- list(clave = clave, pestana = pestana, motivo = motivo)
      }
      next
    }
    if (length(valores)) out[[clave]] <- valores
  }
  structure(out, fallos = fallos)
}
