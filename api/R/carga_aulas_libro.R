# Importacion del libro operativo de un estudio de aulas.
#
# Compone los tres lectores —agendamiento, parte de campo y control de calidad—
# sobre UN solo archivo, que es como el equipo lo tiene: las tres hojas viven en
# el mismo libro.
#
# Ninguna hoja es obligatoria. Un libro a mitad de operativo puede traer solo
# «Aulas Agendadas»; uno terminado, las tres. Lo que falta se declara, no se
# inventa: `hojas_ausentes` viaja en el resultado para que la UI pueda decir que
# no encontro en vez de mostrar un cero silencioso.

AULAS_LIBRO_HOJAS <- list(
  list(clave = "agendadas", hoja = "Aulas Agendadas"),
  list(clave = "aplicadas", hoja = "Aulas Aplicadas (Campo)"),
  list(clave = "control",   hoja = "Base de control")
)

#' Lee las tres hojas operativas de un libro de aulas.
#'
#' @param path ruta al `.xlsx`.
#' @return lista con `plan`, `partes`, `control`, `hojas_ausentes`, `sin_nombre`
#'   y un `resumen` de conteos.
#' @export
aulas_libro_importar <- function(path) {
  if (!file.exists(path)) {
    stop_api(400, "E_AULAS_LIBRO_NO_EXISTE", "No se encontro el libro del estudio de aulas.")
  }
  hojas <- tryCatch(readxl::excel_sheets(path), error = function(e) character(0))
  if (!length(hojas)) {
    stop_api(422, "E_AULAS_LIBRO_ILEGIBLE", "El archivo no se pudo abrir como libro de Excel.")
  }
  presentes <- vapply(AULAS_LIBRO_HOJAS, function(x) x$hoja %in% hojas, logical(1))
  if (!any(presentes)) {
    stop_api(
      422, "E_AULAS_LIBRO_SIN_HOJAS",
      "El libro no trae ninguna de las tres hojas del operativo de aulas.",
      details = list(
        esperadas = lapply(AULAS_LIBRO_HOJAS, function(x) x$hoja),
        encontradas = as.list(hojas)
      )
    )
  }

  plan <- if (presentes[[1]]) aulas_agendadas_leer(path) else list()
  partes <- if (presentes[[2]]) aulas_aplicadas_leer(path) else list()
  control <- if (presentes[[3]]) base_control_leer(path) else list(filas = list(), sin_nombre = integer(0))

  # B14: las dos hojas Extra son OPCIONALES —los libros vivos del operativo no
  # las traen— y se leen con los mismos lectores parametrizados por hoja: la
  # agenda y los partes de un extra vuelven por codigo como cualquier aula
  # (carga_aulas_libro_extras.R). No entran a `hojas_ausentes`: su ausencia es
  # el caso normal, no un hueco que reportar.
  out_extras <- aulas_libro_extras_importar(path, hojas)
  plan <- .calx_unir_plan(plan, out_extras$plan)
  partes <- c(partes, out_extras$partes)

  ausentes <- lapply(AULAS_LIBRO_HOJAS[!presentes], function(x) x$hoja)
  .calb_ensamblar(plan, partes, control, ausentes)
}

#' Arma el resultado del import a partir de las tres hojas ya leidas.
#'
#' **Existe porque el libro tiene DOS puertas y solo una llegaba hasta aqui.**
#' El `.xlsx` entra por `aulas_libro_importar()`; la pestaña que el equipo llena
#' en linea entra por `carga_aulas_desde_sheets.R`, que sabe convertir los
#' valores de la API en las mismas tres estructuras —usa las mismas
#' `aulas_agendadas_a_plan()`, `aulas_aplicadas_a_partes()` y
#' `base_control_a_filas()`— y no tenia con que rematar: el conteo del resumen
#' vivia dentro del lector de Excel. Ese modulo llevaba escrito desde antes sin
#' un solo consumidor.
#'
#' Duplicar el recuento habria sido la quinta lista paralela del dia. Se extrae
#' una vez y las dos puertas la llaman.
#'
#' @param plan,partes lista de unidades y de partes ya leidos.
#' @param control `list(filas, sin_nombre)`.
#' @param ausentes hojas que no venian en la fuente.
#' @keywords internal
.calb_ensamblar <- function(plan, partes, control, ausentes = list()) {

  con_estado <- sum(vapply(plan, function(r) nzchar(r$sample_status %||% ""), logical(1)))
  rol <- function(x) vapply(plan, function(r) identical(r$sample_role, x), logical(1))
  titulares <- sum(rol("titular"))
  # **Las reservas, que es el sumando que faltaba para situar el total.** La
  # tarjeta de Fuentes enseñaba «236 cursos-horario» y «170 titulares», y el KPI
  # de al lado «196 · titulares y sus reservas encadenadas»: tres cifras para la
  # misma palabra sin forma de encajarlas sin salir de la pantalla.
  #
  # **Las aulas EXTRA no se cuentan aqui a proposito.** Este resumen describe lo
  # que trae el LIBRO, y su hoja «Aulas Agendadas» solo distingue titular de
  # reserva encadenada —`sample_role` sale del bloque de columnas: el primero es
  # titular, los demas reservas—. Un `sum(rol("extra_reserve_pool"))` sobre este
  # plan valdria **siempre 0**, y pintar «0 extra» en un estudio que tiene 40
  # seria peor que no decirlo. Los extras viven en el plan del calculo de
  # muestra y se cuentan en `Consultas > Aulas extra disponibles`.
  reservas <- sum(rol("chain_reserve"))

  list(
    plan = plan,
    partes = partes,
    control = control$filas,
    hojas_ausentes = ausentes,
    # Columnas con datos que la cabecera de «Base de control» no bautiza. Se
    # reportan para que quien mire el resultado sepa que no se leyo todo.
    control_sin_nombre = as.list(control$sin_nombre),
    # Lo mismo para la hoja de agenda, que no reportaba nada: campos del bloque
    # que ningun titulo bautiza. Un «TELEFONO DE DOCENTE» renombrado a «CELULAR»
    # se leia vacio en silencio.
    agenda_campos_ausentes = as.list(attr(plan, "campos_ausentes") %||% character(0)),
    resumen = list(
      unidades = length(plan),
      titulares = as.integer(titulares),
      reservas = as.integer(reservas),
      contactadas = as.integer(con_estado),
      partes_de_campo = length(partes),
      filas_de_control = length(control$filas)
    )
  )
}

#' Aplica a la sesion un libro YA importado, venga de donde venga.
#'
#' El plan se guarda tal cual lo entiende Monitoreo, y las otras dos hojas
#' quedan a su lado sin fusionarse: el parte de campo y el control son medidas
#' distintas del mismo aula y mezclarlas perderia de cual viene cada numero.
#'
#'
#' Se separa de `aulas_libro_importar_en_sesion()` porque el libro tiene dos
#' puertas —el `.xlsx` y la pestaña de Sheets— y lo que hay que hacer con el
#' resultado es identico: fusionar el plan, guardar partes y control, y anotar
#' en la config lo que la lectura declaro. Escribirlo dos veces significaria que
#' una puerta puede ganar un paso y la otra no, y la sesion quedaria distinta
#' segun de donde entro el libro.
#' @keywords internal
.calb_aplicar_en_sesion <- function(sid, out) {
  if (length(out$plan)) {
    # FUSION, no reemplazo. El libro no lleva la composicion muestral —es un
    # artefacto de campo— asi que sobrescribir el plan entero dejaba las cuotas
    # sexo x facultad en cero celdas: 12 antes de releer el libro, 0 despues.
    previo <- session_get(sid)$monitoreo_aulas_plan %||% list()
    fusion <- aulas_libro_fusionar_plan(previo, out$plan)
    session_set(sid, "monitoreo_aulas_plan", fusion$plan)
    out$fusion <- fusion[c("actualizadas", "nuevas", "intactas")]
  }
  # A10 (checklist del operativo): el parte importado LLEGA AL PLAN, que es lo
  # que lee la pestaña «Registro de campo» (`row.observed_students`...). Sin
  # este paso, importar un libro llenado en Excel dejaba los formularios de la
  # app vacios: el parte quedaba en `monitoreo_aulas_partes_campo` y ningun
  # eslabon lo copiaba al plan. Va DESPUES de la fusion —los partes del libro
  # son mas nuevos que lo que el plan recuerde— y tambien cubre el libro que
  # llega solo con la hoja de campo (sin `out$plan`).
  plan_actual <- session_get(sid)$monitoreo_aulas_plan %||% list()
  if (length(out$partes) && length(plan_actual)) {
    session_set(sid, "monitoreo_aulas_plan",
                monitoreo_aulas_plan_desde_partes(plan_actual, out$partes))
  }
  # B24: UPSERT por codigo, no reemplazo wholesale — la hoja de campo siembra
  # solo el parte MAS RECIENTE de cada eslabon, asi que los intentos
  # anteriores viven SOLO en la sesion y un reemplazo total los borraba.
  partes_sesion <- aulas_libro_fusionar_partes(
    session_get(sid)$monitoreo_aulas_partes_campo %||% list(), out$partes
  )
  session_set(sid, "monitoreo_aulas_partes_campo", partes_sesion)
  session_set(sid, "monitoreo_aulas_control", out$control)
  # El aviso entra a la config para que el tablero pueda mostrarlo: viajaba en
  # la respuesta del endpoint y ningun consumidor lo miraba.
  cfg <- session_get(sid)$monitoreo_config %||% list()
  if (is.list(cfg$aulas_universitarias)) {
    cfg$aulas_universitarias$control_sin_nombre <- length(out$control_sin_nombre)
    cfg$aulas_universitarias$agenda_campos_ausentes <- as.list(out$agenda_campos_ausentes)
    # La config refleja la SESION (fusion incluida): escribir solo lo del libro
    # perderia los intentos anteriores al guardar/cargar el proyecto.
    cfg$aulas_universitarias$partes_campo <- partes_sesion
    # Mismo camino que los partes: sin esta linea las filas de «Base de control»
    # se quedaban en `monitoreo_aulas_control` y no las leia NADIE —ni el motor
    # ni la UI—, asi que sus 25 campos propios de control de calidad no existian
    # para la app. Ver `monitoreo_aulas_control.R`.
    cfg$aulas_universitarias$control <- out$control
    session_set(sid, "monitoreo_config", cfg)
  }
  session_set(sid, "monitoreo_aulas_libro", list(
    importado_en = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    hojas_ausentes = out$hojas_ausentes,
    control_sin_nombre = out$control_sin_nombre,
    agenda_campos_ausentes = out$agenda_campos_ausentes,
    resumen = out$resumen
  ))
  out
}

#' Importa el libro desde un `.xlsx` y lo aplica a la sesion.
#'
#' Puerta 1 de dos. La otra es `aulas_libro_importar_sheets_en_sesion()`; las
#' dos rematan en `.calb_aplicar_en_sesion()`.
#' @param sid sesion.
#' @param path ruta del `.xlsx`.
#' @return el resumen de la importacion.
#' @export
aulas_libro_importar_en_sesion <- function(sid, path) {
  .calb_aplicar_en_sesion(sid, aulas_libro_importar(path))
}

#' Importa el libro desde las pestañas de un Google Sheets y lo aplica.
#'
#' Puerta 2. Es lo que pidio quien dirige el estudio: «que desde ese [.pulso]
#' pueda publicar y leer lo que se ponga en el sheets (leer agenda y registro de
#' campo)». Aqui esta el LEER; publicar es otra cosa y la cabecera de
#' `carga_aulas_desde_sheets.R` explica por que no se hace a la ligera.
#'
#' @param sid sesion.
#' @param spreadsheet_id id del documento de Sheets.
#' @param pestanas nombres por clave; por defecto los del libro de la app.
#' @return el resumen de la importacion, con la misma forma que el del `.xlsx`.
#' @export
aulas_libro_importar_sheets_en_sesion <- function(sid, spreadsheet_id, pestanas = list()) {
  hojas <- aulas_libro_leer_de_sheets(spreadsheet_id, pestanas)
  if (!length(hojas)) {
    # Se distingue de «el documento no trae las hojas»: aqui NINGUNA pestaña
    # respondio, que casi siempre es el id o el permiso, no el contenido.
    stop_api(422, "E_AULAS_SHEETS_SIN_PESTANAS",
             paste("No se pudo leer ninguna de las tres pestañas del libro.",
                   "Comprueba el enlace del documento y que la cuenta conectada",
                   "tenga acceso."))
  }
  .calb_aplicar_en_sesion(sid, aulas_libro_importar_valores(hojas))
}
