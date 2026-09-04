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

# **Las cadenas del plan, agrupadas y ordenadas UNA sola vez.**
#
# Una fila del libro es una cadena: titular + reservas al lado. Dos hojas
# reparten esa geometria («Aulas Agendadas» y, desde B24, «Aulas Aplicadas
# (Campo)» con los MISMOS eslabones) y el arrastre de Sheets ancla formulas
# por la fila que este agrupado produce — tres consumidores y una sola
# implementacion, porque dos copias fue exactamente como se rompio el espejo
# en vivo (2026-09-01: agendadas ordenaba por aparicion del TITULAR y la hoja
# de campo iteraba titulares a secas; el ID MATCH arrastrado delataba el
# desfase).
#
# El orden es el del PLAN, no el alfabetico (`split()` ordenaria «CH 1, CH 10,
# CH 100»), y los niveles salen de la aparicion de los TITULARES: el plan
# intercala reservas de otras cadenas (R 24.6 antes que CH 15) y con
# `unique(claves)` a secas la cadena 24 se colaba adelante. Las cadenas sin
# titular en el plan van al final, en su aparicion. Dentro de cada grupo, el
# titular primero y las reservas por `replacement_order`.
.calg_grupos_cadena <- function(unidades) {
  if (!length(unidades)) return(list())
  claves <- vapply(unidades, .calg_titular, character(1))
  es_titular <- vapply(unidades, function(u) identical(.calg_txt(u$sample_role), "titular"), logical(1))
  grupos <- split(unidades, factor(claves, levels = unique(c(claves[es_titular], claves))))
  lapply(grupos, function(g) {
    g[order(vapply(g, function(u) {
      if (identical(.calg_txt(u$sample_role), "titular")) 0
      else suppressWarnings(as.numeric(u$replacement_order %||% 99))
    }, numeric(1)))]
  })
}

# La celda «SESIONES Y AULA»: las sesiones LEGIBLES por dia si el plan las
# trae —«LUN 16:00-18:00 L101 · MIE 17:00-20:00 A506», anotadas desde el
# catalogo DTI con el apareamiento dia↔aula intacto
# (`calc_muestra_aulas_sesiones_legible`)— y si no, el `label` de siempre. El
# dictado B15: «que todo eso se este jalando muy bien, no vaya a ser que jale
# mal algun numero o interprete mal alguna fecha y el docente pierda seriedad
# sobre el estudio».
.calg_sesiones_y_aula <- function(u) {
  legible <- .calg_txt(u$sesiones_legibles)
  if (nzchar(legible)) legible else .calg_txt(u$label)
}

# **Las celdas del bloque de agenda, derivadas de la spec.**
#
# Antes habia DOS sitios que escribian estas celdas a mano en un orden que
# tenia que coincidir con `AULAS_AGENDADAS_BLOQUE` sin que nada los atara: el
# reorden v4 (B15) habria sido contar columnas dos veces y rezar. Ahora la
# secuencia vive UNA vez en la spec y este despachador pone cada valor bajo su
# campo: un reorden futuro se paga tocando solo `carga_aulas_agendadas.R`.
#
# A partir de `contact_medium` llena la PERSONA que agenda, pero se DEVUELVE lo
# que ya este registrado: escribir vacio siempre borraba el operativo en curso.
# `notes` o `replacement_note`: el lector guarda OBSERVACIONES en
# `replacement_note`, y leer solo `notes` perdia las 190 observaciones de 2025.
.calg_celda_agenda <- function(u, campo) {
  switch(
    campo,
    operational_code = .calg_txt(u$operational_code),
    course_name      = .calg_txt(u$course_name),
    teacher          = .calg_txt(u$teacher),
    teacher_phone    = .calg_txt(u$teacher_phone),
    label            = .calg_sesiones_y_aula(u),
    contact_medium   = .calg_txt(u$contact_medium),
    contact_date     = .calg_txt(u$contact_date),
    contact_attempts = .calg_num_txt(u$contact_attempts),
    # B23: eco de lo registrado y nada mas — el resultado de la llamada lo
    # teclea el equipo, asi que la siembra es VACIA en todos los roles (sin
    # default: un valor inventado hablaria por una llamada que no ocurrio).
    call_status      = .calg_txt(u$call_status),
    # B22: eco primero — un «Sí» ya registrado no se re-siembra («escribir
    # vacio siempre borraba el operativo en curso», la regla del bloque). Sin
    # registro, la siembra va POR ROL, no por posicion: reservas y extras
    # arrancan en «No» (a ellos se les manda correo hoy) y el titular queda
    # VACIO (a los titulares se les llama a todos hoy: el vacio es contenido).
    # Caso degenerado decidido aqui: una reserva que ocupe el bloque 1 de una
    # cadena sin titular tambien arranca en «No» — el correo se le envia por
    # ser reserva, no por la columna en que cayo. Un rol desconocido o vacio
    # queda "": sembrar «No» ahi hablaria con la voz de un dato que no existe.
    email_received   = {
      v <- .calg_txt(u$email_received)
      rol <- tolower(trimws(.calg_txt(u$sample_role)))
      if (nzchar(v)) v
      else if (rol %in% c("chain_reserve", "extra_reserve_pool")) "No"
      else ""
    },
    sample_status    = .calg_status_excel(u$sample_status, .calg_num_txt(u$replacement_order)),
    # B30: eco de lo registrado y nada mas — el lugar CONFIRMADO de la
    # aplicacion lo teclea el equipo con el aula pactada («A206»), asi que la
    # siembra es VACIA en todos los roles. `trimws` porque el formato lo pone
    # la disciplina de entrada, no un validador: nada se rechaza aqui.
    scheduled_venue  = trimws(.calg_txt(u$scheduled_venue)),
    scheduled_date   = .calg_txt(u$scheduled_date),
    scheduled_day    = .calg_dia_excel(u$scheduled_day),
    scheduled_time   = .calg_txt(u$scheduled_time),
    scheduled_moment = .calg_txt(u$scheduled_moment),
    notes            = .calg_txt(u$notes %||% u$replacement_note),
    teacher_email    = .calg_txt(u$teacher_email),
    faculty          = .calg_txt(u$faculty),
    level            = .calg_txt(u$level),
    enrolled_total   = .calg_num_txt(u$enrolled_total),
    eligible_n       = .calg_num_txt(u$eligible_n),
    link             = .calg_txt(u$link),
    # Un campo que la spec gane y este switch no conozca sale VACIO, no
    # desalineado: el largo lo fija el vapply de abajo, y el barrido de ida y
    # vuelta (test-carga-aulas-libro-roundtrip.R) caza el hueco.
    ""
  )
}

.calg_celdas_agenda <- function(u) {
  vapply(AULAS_AGENDADAS_BLOQUE, function(s) .calg_celda_agenda(u, s$campo), character(1))
}

# ¿El cruce DAA esta activo? UNA implementacion del predicado (B8h fase 2):
# la hoja de agendadas, el generador xlsx y el publicador de Sheets deciden
# la MISMA geometria con el, y dos copias del `length(...) > 0` era como se
# separaban. NULL y character(0) son «sin cruce» — la columna es condicional
# por dictado del dueño («la DAA es algo particular de este año»).
.calg_daa_activo <- function(traslape_daa) {
  length(traslape_daa %||% character(0)) > 0L
}

#' Arma la hoja «Aulas Agendadas» a partir del plan.
#'
#' @param unidades filas del plan (formato largo).
#' @param traslape_daa vector de caracteres NOMBRADO por codigo operativo con el
#'   veredicto del cruce DAA (`aulas_daa_traslape`), o `NULL`. La columna
#'   «TRASLAPE DAA» es CONDICIONAL (B8h, dictado del dueño: «la DAA es algo
#'   particular de este año, no es una columna que se emplee para otros
#'   estudios»): sin cruce el bloque queda EXACTAMENTE como declara la spec;
#'   con cruce, cada bloque la gana al final del contexto. Es una columna DE
#'   IDA: el lector empareja por titulo contra la spec y la ignora de vuelta.
#' @return data.frame sin nombres, con la cabecera como primera fila.
#' @export
aulas_libro_hoja_agendadas <- function(unidades, traslape_daa = NULL) {
  titulos_bloque <- .calg_titulos_agenda()
  con_daa <- .calg_daa_activo(traslape_daa)
  if (con_daa) titulos_bloque <- c(titulos_bloque, "TRASLAPE DAA")
  # El veredicto de una unidad, o "" si el cruce no la menciona — celda vacia,
  # nunca NA: un default inventado diria «sin traslape» con la voz de un dato.
  daa_de <- function(u) {
    cod <- .calg_txt(u$operational_code)
    v <- if (nzchar(cod)) unname(traslape_daa[cod]) else NA_character_
    if (length(v) != 1L || is.na(v)) "" else as.character(v)
  }
  # Agrupa por cadena con el helper COMPARTIDO (ver `.calg_grupos_cadena`): la
  # hoja de campo replica estos mismos grupos en el mismo orden (B24, el M1 de
  # 2025 exige fila a fila), asi que la logica vive UNA vez.
  grupos <- .calg_grupos_cadena(unidades)
  profundidad <- max(1L, max(vapply(grupos, length, integer(1)), 1L))

  # **Cada bloque dice de quien es.** Repetidos tal cual, los tres bloques
  # enseñaban «NOMBRE DE DOCENTE» identico tres veces y el unico modo de saber
  # si una columna era del titular o del reemplazo 1.2 era el color. Impresa en
  # blanco y negro —que es como se usa en campo— la hoja no lo decia. El sufijo
  # lo descarta `.caa_key()`, asi que el ida y vuelta no cambia.
  cabecera <- c("ID MATCH", unlist(lapply(seq_len(profundidad), function(b) {
    if (b == 1L) titulos_bloque else paste0(titulos_bloque, " R", b - 1L)
  })))
  filas <- lapply(seq_along(grupos), function(i) {
    g <- grupos[[i]]
    celdas <- unlist(lapply(seq_len(profundidad), function(b) {
      if (b > length(g)) return(rep("", length(titulos_bloque)))
      u <- g[[b]]
      # Derivadas de la MISMA spec que la cabecera (`.calg_celdas_agenda`):
      # antes el bloque se escribia a mano aqui y en la hoja de campo, dos
      # listas que nadie ataba — un reorden a medias dejaba el telefono bajo el
      # correo sin que nada fallara. El TRASLAPE DAA cierra el bloque solo
      # cuando la hoja lo lleva (columna condicional, ver la firma).
      c(.calg_celdas_agenda(u), if (con_daa) daa_de(u))
    }), use.names = FALSE)
    c(as.character(i), celdas)
  })
  as.data.frame(do.call(rbind, c(list(cabecera), filas)), stringsAsFactors = FALSE)
}

# Celdas del parte de campo, despachadas POR TITULO contra `titulos_campo`. Con
# `parte` nulo salen los dos denominadores y el resto en blanco (libro nuevo).
.cap_celdas_parte <- function(parte, unidad, titulos_campo) {
  # **Por ALIAS, no por nombre literal.**
  #
  # Esto leia `parte$observed_students`, `parte$effective_surveys`… o sea el
  # vocabulario que produce el lector del libro. Pero hay un segundo productor
  # —la propia app— que los escribe en castellano, y sobre el .pulso de
  # HSVG2026 (152 partes, todos castellanos) la hoja de campo salia con sus
  # 192 filas VACIAS. Releer ese libro devolvia 0 partes.
  #
  # `.MONITOREO_AULAS_PARTE_ALIAS` existe justo para esto y su cabecera ya
  # contaba el mismo caso en otras capas: «una capa aprendio los alias y las
  # otras dos no se enteraron; por eso son UNA constante y no tres listas».
  # Esta era la cuarta.
  #
  # **Y por TITULO, no por posicion**: el orden vive una sola vez en
  # `.calg_titulos_campo()` (contrato v4, B16) y cada valor cae bajo su
  # cabecera. Un titulo que este switch no conozca sale vacio, y el barrido de
  # ida y vuelta lo caza.
  pa <- function(clave) .monitoreo_aulas_parte_primero(
    parte %||% list(), .MONITOREO_AULAS_PARTE_ALIAS[[clave]])
  v <- function(x) .calg_txt(pa(x))
  n <- function(x) .calg_num_txt(pa(x))
  vapply(titulos_campo, function(titulo) {
    switch(
      titulo,
      "MATRICULADOS TOTAL DTI"       = .calg_num_txt(unidad$enrolled_total),
      "MATRICULADOS ELEGIBLES"       = .calg_num_txt(unidad$eligible_n),
      "APLICADOR"                    = v("aplicador"),
      "FECHA DE APLICACIÓN"          = v("fecha"),
      "HORA DE APLICACIÓN"           = v("hora"),
      "AULA"                         = v("aula"),
      "CANTIDAD DE ASISTENTES"       = n("asistentes"),
      # **El % de asistencia VUELVE al libro.** Estaba en blanco con el
      # comentario de que «lo calcula la hoja del equipo con sus formulas»,
      # pero el libro generado no llevaba formula ninguna: escribia vacio. Y el
      # LECTOR si lo lee (`carga_aulas_aplicadas.R`), asi que reabrir un libro
      # con partes perdia justo esa columna. No se deriva —medido sobre 152
      # partes: no sale de ningun denominador— porque lo pone el equipo.
      "% ASISTENCIA"                 = n("asistencia_pct"),
      "CANTIDAD DE RECHAZOS"         = n("rechazos"),
      "DUPLICADOS (YA RESPONDIERON)" = n("duplicados"),
      "CANTIDAD DE EFECTIVAS"        = n("efectivas"),
      "STATUS DE APLICACIÓN"         = v("estado"),
      # El enlace de la ficha ESCANEADA: dato del equipo. Se devuelve lo que el
      # parte traiga y NUNCA `unidad$link` —esa es la ficha QR que la app
      # genera, otra columna y otra cosa—; en un libro nuevo sale vacio.
      "ENLACE DE FICHA ESCANEADA"    = v("enlace_escaneado"),
      "OBSERVACIONES SOBRE APLICACIONES" = v("nota"),
      ""
    )
  }, character(1), USE.NAMES = FALSE)
}

# La columna de un campo de la «Base de control», por nombre. Devuelve 0 si el
# campo no esta, que es lo que `printTitleCols`/`addStyle` entienden como «nada».
.calg_col_control <- function(titulo) {
  campos <- vapply(.calg_control_escritos(), function(spec) spec$titulos[[1]], character(1))
  i <- which(campos == titulo)
  if (length(i)) as.integer(i[[1]]) else 0L
}

# La escala de una columna de razones se decide por la COLUMNA ENTERA y con
# corte en 1.5, la misma regla que usa la capa de presentacion del frontend. El
# motor NO normaliza (decision declarada en `monitoreo_aulas_cruce_hojas.R`): el
# libro devuelve la cifra tal como la escribio el equipo y solo cambia como se
# ENSEÑA.
#
# Vive a nivel de fichero y no dentro de `aulas_libro_generar()` porque la hoja
# «Datos» la necesita tambien: una segunda copia del corte 1.5 se separaria de
# esta en cuanto una de las dos cambie.
.calg_escala_pct <- function(valores) {
  v <- suppressWarnings(as.numeric(valores))
  v <- v[is.finite(v)]
  if (!length(v) || any(v > 1.5)) "decimal" else "porcentaje"
}

# **El vocabulario del EXCEL, no el interno.**
#
# El libro escribia los valores tal como los guarda la app —«agendada»,
# «en_reserva», «Martes»— mientras sus propios desplegables ofrecian «AGENDADA»,
# «EN RESERVA 1», «MAR». Medido en el estudio: **243 de 243 valores de STATUS
# MUESTRA y 243 de 243 de DIA estaban FUERA de su lista**. No es solo estetica:
# quien despliega no ve seleccionado lo que hay, y Excel puede marcar la celda
# como dato no valido.
#
# La traduccion va aqui, al ESCRIBIR. El lector sigue aceptando las dos formas
# —tiene su normalizador y sus alias— asi que un libro viejo se relee igual.
.calg_status_excel <- function(valor, orden = NA_real_) {
  v <- tolower(trimws(.calg_txt(valor)))
  v <- gsub("[ _]+", "_", v)
  if (!nzchar(v)) return("")
  if (startsWith(v, "en_reserva")) {
    # B13b: el eje tecleable de una reserva arranca en «SIN CONTACTAR», igual
    # que el del titular — la posición en cadena ya viaja en el código R n.k y
    # «EN RESERVA k» salió del desplegable. La misma rama traduce el derivado
    # del plan (`en_reserva`) y la forma vieja ya tecleada («EN RESERVA 1»):
    # reescribirla al regenerar sería escribir fuera del desplegable. `orden`
    # queda sin uso aquí; se conserva por contrato de llamada (los dos
    # escritores del bloque de agenda lo pasan).
    return("SIN CONTACTAR")
  }
  # `sin_contactar` incluido (B13a): el estado INICIAL del plan también se
  # escribe en el vocablo del desplegable — «SIN CONTACTAR», sin guion bajo.
  # La normalización de `v` de arriba colapsa `SIN_CONTACTAR` (la forma que la
  # siembra escribía hasta hoy) y «SIN CONTACTAR» en la misma clave, así que
  # regenerar un libro viejo también sale alineado.
  #
  # B13b: `en_contacto` y `rechazo` son tecleables nuevos del dictado (D-B13).
  # `reemplazada` se QUEDA aunque el desplegable ya no la ofrezca: es el dato
  # vivo del export —el plan la publica al activar un reemplazo— y la
  # validación (allowBlank / strict = FALSE) tolera valores fuera de lista.
  conocidos <- c(agendada = "AGENDADA", reagendada = "REAGENDADA",
                 en_contacto = "EN CONTACTO", rechazo = "RECHAZO",
                 reemplazada = "REEMPLAZADA", sin_contactar = "SIN CONTACTAR")
  # `conocidos[[v]]` con un nombre que no esta REVIENTA («subscript out of
  # bounds») en vez de dar NULL: se pregunta por los nombres.
  if (v %in% names(conocidos)) return(unname(conocidos[[v]]))
  # Un estado que la lista no ofrece se escribe en mayusculas y tal cual: se ve
  # que esta fuera del vocabulario, en vez de desaparecer o disfrazarse de otro.
  toupper(.calg_txt(valor))
}

# «Martes» -> «MAR». La lista del desplegable usa las tres primeras letras.
.calg_dia_excel <- function(valor) {
  v <- toupper(trimws(.calg_txt(valor)))
  if (!nzchar(v)) return("")
  v <- chartr("ÁÉÍÓÚÜ", "AEIOUU", v)
  if (v %in% AULAS_LIBRO_DIA) return(v)
  tres <- substr(v, 1, 3)
  if (tres %in% AULAS_LIBRO_DIA) tres else v
}

# Los titulos de campo que son CUENTAS. El `% ASISTENCIA` no esta: es una
# razon y su formato depende de la escala que traiga.
.calg_campo_numeros <- function() c(
  "MATRICULADOS TOTAL DTI", "MATRICULADOS ELEGIBLES", "CANTIDAD DE ASISTENTES",
  "CANTIDAD DE RECHAZOS", "DUPLICADOS (YA RESPONDIERON)", "CANTIDAD DE EFECTIVAS"
)

# El orden v4 del parte (B16, dictado: «la asistencia, la cantidad de rechazos,
# los duplicados, la cantidad de efectivas, el nombre del aplicador, el aula,
# la fecha de aplicacion — tenerlo bien, bien claro»). Los dos denominadores
# ABREN el parte: son el marcador con que el lector separa agenda de campo
# (segunda aparicion de MATRICULADOS TOTAL DTI, carga_aulas_aplicadas.R) y el
# denominador que «% ASISTENCIA» necesita al lado. Despues, el flujo del parte
# tal como se rinde: quien aplico, cuando, donde, cuanto, con que estado y su
# evidencia. Las celdas se despachan por titulo (`.cap_celdas_parte`): un
# reorden futuro se paga tocando SOLO esta lista.
.calg_titulos_campo <- function() c(
  "MATRICULADOS TOTAL DTI", "MATRICULADOS ELEGIBLES",
  "APLICADOR", "FECHA DE APLICACIÓN", "HORA DE APLICACIÓN", "AULA",
  "CANTIDAD DE ASISTENTES", "% ASISTENCIA", "CANTIDAD DE RECHAZOS",
  "DUPLICADOS (YA RESPONDIERON)", "CANTIDAD DE EFECTIVAS",
  "STATUS DE APLICACIÓN",
  # La columna MANUAL del enlace del PDF escaneado (B6c): la siembra
  # `.cap_celdas_parte`, que solo devuelve lo que el parte ya traiga. En v4 va
  # como evidencia del estado, antes de las observaciones libres.
  "ENLACE DE FICHA ESCANEADA",
  "OBSERVACIONES SOBRE APLICACIONES"
)

#' Arma la hoja «Aulas Aplicadas (Campo)»: un bloque por ESLABON, espejo de
#' «Aulas Agendadas».
#'
#' B24, dictado textual: «Tiene que ser como aulas agendadas, es el mismo
#' diseño de columnas por titular o reemplazo pero con la información de
#' campo». Hasta hoy la hoja armaba TRES bloques fijos por INTENTO de
#' aplicacion: con una cadena de profundidad 4, agendadas repartia 4 bloques y
#' aqui el REEMPLAZO 3 no tenia donde vivir. Ahora el bloque b ES el eslabon b
#' de la cadena —su agenda (codigo incluido) y sus denominadores— y el parte
#' de una reserva cae en SU bloque, sin fila propia: la hoja va fila a fila
#' con agendadas (el M1 de 2025) y comparte su agrupado
#' (`.calg_grupos_cadena`).
#'
#' El parametro `intentos` queda ACEPTADO E IGNORADO con B24 (decision
#' documentada): la profundidad deriva de las cadenas del plan, y un knob que
#' la contradiga dejaria a las dos hojas divergir — exactamente el defecto que
#' esta unidad mata. Se conserva en la firma solo para no romper llamadores
#' historicos que lo nombran; ningun valor cambia la hoja. Los reintentos de
#' un mismo eslabon ya no tienen bloque propio: el bloque siembra el parte MAS
#' RECIENTE (mayor `intento`) de su codigo y los anteriores viven solo en la
#' app (la fusion de partes hace upsert por codigo sin descartarlos).
#'
#' @param unidades filas del plan.
#' @param intentos ignorado desde B24 (la profundidad es la del plan).
#' @param partes partes de campo ya registrados.
#' @return data.frame con dos filas de cabecera (grupo y campo).
#' @export
aulas_libro_hoja_aplicadas <- function(unidades, intentos = NULL, partes = list()) {
  # El parte MAS RECIENTE por codigo operativo: mayor `intento` gana; a igual
  # intento, el ultimo registrado (el orden de la lista es cronologico).
  por_aula <- list()
  intento_de <- list()
  for (pt in partes) {
    if (!is.list(pt)) next
    cod <- .calg_txt(pt$operational_code, .calg_txt(pt$classroom_id))
    if (!nzchar(cod)) next
    n <- suppressWarnings(as.integer(pt$intento %||% 1L))
    if (!length(n) || !is.finite(n) || n < 1L) n <- 1L
    if (is.null(intento_de[[cod]]) || n >= intento_de[[cod]]) {
      por_aula[[cod]] <- pt
      intento_de[[cod]] <- n
    }
  }
  # Desde el contrato v4 (B15) la parte de agenda ya dice «FECHA AGENDADA» de
  # fabrica —es el titulo primario de `scheduled_date`— asi que las dos fechas
  # del bloque se distinguen sin el parche del `sub()` que vivia aqui. La
  # historia del parche (dos columnas que solo separaba una tilde, y el sub que
  # dejo de casar al acentuar los titulos) queda contada en
  # `test-carga-aulas-libro-rotulos-distinguibles.R`.
  titulos_agenda <- .calg_titulos_agenda()
  titulos_campo <- .calg_titulos_campo()
  ancho_bloque <- 1L + length(titulos_agenda) + length(titulos_campo)

  # ESPEJO de agendadas: los mismos grupos, en el mismo orden, con la misma
  # profundidad (una fila por cadena; el agrupado vive una sola vez).
  grupos <- .calg_grupos_cadena(unidades)
  profundidad <- max(1L, max(vapply(grupos, length, integer(1)), 1L))

  grupo <- c()
  campos <- c()
  for (b in seq_len(profundidad)) {
    # **«TITULAR» y «REEMPLAZO n», no «muestra».** Una cadena es un titular y
    # sus reemplazos, y asi se llaman ya los codigos («CH 4», «R 4.1»). Desde
    # B24 la banda dice ademas la verdad geometrica: el bloque b ES el eslabon
    # b, no un intento. Se puede renombrar sin romper la relectura porque el
    # lector IGNORA esta fila (`carga_aulas_aplicadas.R` toma la fila 2).
    etiqueta <- if (b == 1L) "TITULAR" else sprintf("REEMPLAZO %d", b - 1L)
    grupo <- c(grupo, etiqueta, rep("", ancho_bloque - 1L))
    campos <- c(campos, "ID MATCH", titulos_agenda, titulos_campo)
  }

  filas <- lapply(seq_along(grupos), function(i) {
    g <- grupos[[i]]
    unlist(lapply(seq_len(profundidad), function(b) {
      # Eslabon AUSENTE (la cadena es mas corta que la mas larga): bloque
      # vacio — sembrar algo inventaria un aula al releer.
      if (b > length(g)) return(rep("", ancho_bloque))
      u <- g[[b]]
      c(as.character(i),
        # La agenda DEL ESLABON, de la misma spec que la otra hoja
        # (`.calg_celdas_agenda`): el codigo sembrado es lo que hace que un
        # parte tecleado en el bloque REEMPLAZO n vuelva bajo SU reserva.
        .calg_celdas_agenda(u),
        # Y el parte de ESE eslabon: sus denominadores como referencia (el %
        # de asistencia de R 1.1 se juzga contra SUS elegibles, no los del
        # titular) y lo mas reciente que se haya registrado.
        .cap_celdas_parte(por_aula[[.calg_txt(u$operational_code)]], u, titulos_campo))
    }), use.names = FALSE)
  })

  # **Fallback: un parte cuyo codigo no ancla en ninguna cadena del plan.**
  # Que nada muera en silencio: gana una fila propia con su codigo en el
  # bloque 1 y el parte al lado, agenda en blanco (no hay unidad de la que
  # derivarla). Antes de B24 ese parte simplemente no se rendia.
  codigos_plan <- unique(vapply(unidades %||% list(), function(u) {
    .calg_txt(u$operational_code)
  }, character(1)))
  huerfanos <- setdiff(names(por_aula) %||% character(0), codigos_plan)
  filas_huerfanas <- lapply(seq_along(huerfanos), function(k) {
    cod <- huerfanos[[k]]
    c(as.character(length(grupos) + k),
      .calg_celdas_agenda(list(operational_code = cod)),
      .cap_celdas_parte(por_aula[[cod]], list(), titulos_campo),
      rep("", ancho_bloque * (profundidad - 1L)))
  })

  as.data.frame(
    do.call(rbind, c(list(grupo), list(campos), filas, filas_huerfanas)),
    stringsAsFactors = FALSE
  )
}

# Los campos de la Base de control que la hoja ESCRIBE: todos menos los que la
# spec marca `solo_lectura`, que existen para releer libros viejos.
.calg_control_escritos <- function() {
  Filter(function(spec) !isTRUE(spec$solo_lectura), BASE_CONTROL_CAMPOS)
}

#' Los cuatro tramos de la «Base de control», anclados por NOMBRE.
#'
#' Estaban puestos por indice a mano —`grupo[[8]]`, `grupo[[14]]`,
#' `grupo[[29]]`—, que es el mismo error de contar columnas que ya costo tres
#' defectos en este libro: si `BASE_CONTROL_CAMPOS` gana un campo, las cuatro
#' bandas se descolocan en silencio y nadie se entera hasta imprimir. Anclados
#' al nombre del campo donde empieza cada tramo, el spec puede crecer.
#'
#' @return lista `list(etiqueta, desde, hasta)` con las posiciones resueltas.
#' @export
aulas_libro_grupos_control <- function() {
  campos <- vapply(.calg_control_escritos(), function(spec) spec$titulos[[1]], character(1))
  anclas <- list(
    list(etiqueta = "INFORMACIÓN DEL CURSO", desde = "MUESTRA"),
    list(etiqueta = "INFORMACIÓN DEL CAMPO", desde = "FECHA AGENDADA"),
    list(etiqueta = "CONTROL - CUENTA", desde = "TOTAL ENVIADAS"),
    list(etiqueta = "CONTROL - CUOTAS", desde = "N ASISTENTES EN AULA")
  )
  inicios <- vapply(anclas, function(a) {
    i <- which(campos == a$desde)
    if (length(i)) i[[1]] else NA_integer_
  }, integer(1))
  vivos <- which(!is.na(inicios))
  lapply(seq_along(vivos), function(k) {
    i <- vivos[[k]]
    fin <- if (k < length(vivos)) inicios[[vivos[[k + 1L]]]] - 1L else length(campos)
    list(etiqueta = anclas[[i]]$etiqueta, desde = inicios[[i]], hasta = fin)
  })
}

aulas_libro_hoja_control <- function(unidades, control = list(), efectivas = NULL,
                                     partes = list()) {
  escritos <- .calg_control_escritos()
  campos <- vapply(escritos, function(spec) spec$titulos[[1]], character(1))
  claves <- vapply(escritos, function(spec) spec$campo, character(1))
  grupo <- rep("", length(campos))
  for (g in aulas_libro_grupos_control()) grupo[[g$desde]] <- g$etiqueta

  # **El control ya registrado vuelve al libro.** Se escribian SIETE de las 39
  # columnas —la identidad y los dos denominadores— y las 32 restantes salian
  # en blanco «porque las calcula el equipo con sus formulas». El lector las lee
  # todas, asi que regenerar el libro a mitad de operativo borraba el control de
  # las aulas que ya lo tenian: medido en el estudio de referencia, 102 de 152
  # filas con las 24 columnas de conteo, umbrales y cuotas llenas.
  por_aula <- list()
  for (r in control) {
    if (!is.list(r)) next
    cod <- .calg_txt(r$operational_code, .calg_txt(r$classroom_id))
    if (nzchar(cod)) por_aula[[cod]] <- r
  }

  # **Lo que saben las otras dos hojas.**
  #
  # Gonzalo, definiendo el insumo: «base de control necesita saber lo que las
  # otras dos saben». No lo sabia: de sus 43 columnas salian vacias FECHA
  # AGENDADA y HORA —que estan en la propia unidad del plan, aqui al lado— y
  # las seis de campo —aplicador, fecha y hora de aplicacion, estado,
  # asistentes— porque la funcion ni siquiera recibia los partes.
  #
  # Se leen por la constante de alias, no por nombre literal: es el mismo
  # defecto que dejo vacia la hoja «Aulas Aplicadas (Campo)» y que
  # `.MONITOREO_AULAS_PARTE_ALIAS` existe para cerrar.
  parte_de <- list()
  for (pt in (partes %||% list())) {
    if (!is.list(pt)) next
    cod <- .calg_txt(pt$operational_code, .calg_txt(pt$classroom_id))
    if (nzchar(cod)) parte_de[[cod]] <- pt
  }

  # **Titulares Y cualquier aula que ya tenga control registrado.**
  #
  # Escribiendo solo titulares, una reserva de cadena ACTIVADA —que se aplico,
  # tiene parte y tiene su fila de control— perdia esa fila al regenerar el
  # libro. Medido en el estudio: de 152 filas de control, **22 eran de reservas
  # y no volvian**. Es la misma regla que la hoja «Aulas Aplicadas (Campo)» ya
  # aplica desde antes —titular o con parte registrado—; aqui faltaba.
  #
  # Las 40 filas de titulares sin control que aparecen al regenerar NO son un
  # problema: es la hoja ofreciendo la fila para que el equipo la llene.
  con_control <- vapply(unidades, function(u) {
    !is.null(por_aula[[.calg_txt(u$operational_code)]])
  }, logical(1))
  titulares <- unidades[
    vapply(unidades, function(u) identical(.calg_txt(u$sample_role), "titular"), logical(1)) |
      con_control
  ]
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
    pon("MATRICULADOS ELEGIBLES", .calg_num_txt(u$eligible_n))

    # Lo que sabe AGENDA, que viaja en la propia unidad.
    pon("FECHA AGENDADA", .calg_txt(u$scheduled_date))
    pon("HORA", .calg_txt(u$scheduled_time))

    # Y lo que sabe CAMPO, del parte de esta aula si lo hay.
    pt <- parte_de[[.calg_txt(u$operational_code)]]
    if (!is.null(pt)) {
      pv <- function(clave) .calg_txt(
        .monitoreo_aulas_parte_primero(pt, .MONITOREO_AULAS_PARTE_ALIAS[[clave]]))
      pon("APLICADOR", pv("aplicador"))
      pon("FECHA DE APLICACION", pv("fecha"))
      pon("HORA DE APLICACION", pv("hora"))
      pon("STATUS DE APLICACION", pv("estado"))
      pon("N ASISTENTES EN AULA", .calg_num_txt(
        .monitoreo_aulas_parte_primero(pt, .MONITOREO_AULAS_PARTE_ALIAS$asistentes)))
    }

    # **Lo esperado, que sale del plan, y lo obtenido, que sale de la
    # plataforma.** Sustituye a `70T`/`70P`, que eran ese mismo 70 % reducido a
    # dos casillas de si/no: se perdia cuanto faltaba y por tanto a que aula ir
    # primero.
    esperadas <- suppressWarnings(as.numeric(u$expected_valid %||% NA))[1]
    eleg <- suppressWarnings(as.numeric(u$eligible_n %||% NA))[1]
    cod_u <- .calg_txt(u$operational_code)
    obtenidas <- if (is.null(efectivas)) NA_real_ else {
      i <- match(cod_u, names(efectivas))
      if (is.na(i)) NA_real_ else suppressWarnings(as.numeric(efectivas[[i]]))
    }
    pct <- function(x) if (is.finite(x) && is.finite(eleg) && eleg > 0) x / eleg else NA_real_

    pon("EFECTIVAS ESPERADAS", .calg_num_txt(esperadas))
    # El denominador del % de al lado. Es el mismo `eligible_n` de
    # «MATRICULADOS ELEGIBLES»: se repite para que el porcentaje se lea sin
    # cruzar la hoja. NO es una meta — la meta es «EFECTIVAS ESPERADAS».
    pon("ELEGIBLES: BASE DEL %", .calg_num_txt(eleg))
    pon("% EFECTIVAS ESPERADO", .calg_num_txt(pct(esperadas)))
    # Sin respuestas leidas la columna se queda VACIA, no en cero: cero
    # efectivas y «todavia no sabemos» son dos noticias distintas, y en un aula
    # sin aplicar la segunda es la cierta.
    if (is.finite(obtenidas)) {
      pon("EFECTIVAS OBTENIDAS", .calg_num_txt(obtenidas))
      pon("% EFECTIVAS OBTENIDO", .calg_num_txt(pct(obtenidas)))
      if (is.finite(esperadas)) {
        # En encuestas y con signo: «te faltan 4» es accionable, «-13 %» no.
        pon("EFECTIVAS: DIFERENCIA", .calg_num_txt(obtenidas - esperadas))
      }
    }

    # El reparto por sexo esperado sale del plan POR AULA. Cual de los dos es
    # mujeres lo dice `sex_top_1`, no la posicion: en otro estudio el mayoritario
    # puede ser el otro.
    # NO la inicial: "Mujer" daba "M" y la ficha de campo salia con las
    # mujeres esperadas en el renglon de hombres y al reves. Ver
    # `.pulso_sexo_fm()`.
    top1 <- .pulso_sexo_fm(u$sex_top_1)
    n1 <- .calg_num_txt(u$sex_top_1_n)
    n2 <- .calg_num_txt(u$sex_top_2_n)
    if (identical(top1, "F") || identical(top1, "M")) {
      es_mujer_primero <- identical(top1, "F")
      pon("MUJERES ESPERADAS", if (es_mujer_primero) n1 else n2)
      pon("HOMBRES ESPERADOS", if (es_mujer_primero) n2 else n1)
    }

    # Lo registrado se escribe DESPUES y solo donde trae algo: la identidad la
    # manda el plan, que es su fuente, y el control manda en lo suyo. Va por la
    # MISMA spec que usa el lector, asi que ninguna columna puede quedarse fuera
    # por olvido: si el spec gana un campo, esta vuelta lo escribe sola.
    reg <- por_aula[[.calg_txt(u$operational_code)]]
    if (!is.null(reg)) {
      # Lo que el PLAN ya escribio no se pisa: es la fuente de la identidad y
      # de los denominadores. Un registro con el nombre de curso de la version
      # anterior del plan le ganaba al plan y devolvia el nombre viejo. Se mira
      # que celdas quedaron llenas en vez de repetir aqui la lista de campos de
      # identidad, que se desincronizaria en cuanto el plan escriba una mas.
      del_plan <- nzchar(fila)
      for (k in seq_along(claves)) {
        if (del_plan[[k]]) next
        # `wave` NUNCA la escribe el registro, ni en celda vacia: la ola es del
        # plan (viene de Calculo de muestra) y desde que la columna MUESTRA
        # salio del bloque de agenda (B8, 2026-08-31) el libro entero dejo de
        # poder pisarla. Resucitarla desde el control reintroduciria por la
        # tercera hoja lo que se cerro en las otras dos.
        if (identical(claves[[k]], "wave")) next
        crudo <- reg[[claves[[k]]]]
        if (is.null(crudo) || length(crudo) != 1L || is.na(crudo)) next
        valor <- if (is.numeric(crudo)) .calg_num_txt(crudo) else .calg_txt(crudo)
        if (nzchar(valor)) fila[[k]] <- valor
      }
    }
    fila
  })
  as.data.frame(do.call(rbind, c(list(grupo), list(campos), filas)), stringsAsFactors = FALSE)
}

# **El banco de extras NO se agenda, asi que no va al libro de campo.**
#
# Medido en el estudio real: el plan de Monitoreo guarda las 2 616 unidades de la
# seleccion —190 titulares, 496 reservas encadenadas y 1 930 extras— y la UI
# filtra el banco EN CADA PANEL, uno por uno. El generador del libro no lo hacia,
# asi que la hoja «Aulas Agendadas» salia con 2 120 filas: las 190 que el equipo
# tiene que visitar mezcladas entre 1 930 de reserva que nadie agendo.
#
# Un extra ACTIVADO es otra cosa y si tiene que salir: se aplica igual que un
# titular, y escribir solo titulares costo 22 filas en el estudio de trabajo (ver
# test-carga-aulas-libro-roundtrip.R). Por eso el filtro mira si el extra tiene
# parte o control registrado, y no su rol a secas.
.calg_codigos_usados <- function(...) {
  fuentes <- list(...)
  codigos <- character(0)
  for (fuente in fuentes) {
    for (fila in fuente %||% list()) {
      if (!is.list(fila)) next
      cod <- .calg_txt(fila$operational_code, .calg_txt(fila$classroom_id))
      if (nzchar(cod)) codigos <- c(codigos, cod)
    }
  }
  unique(codigos)
}

#' Las reservas que van a entrar al libro SIN su codigo de cadena.
#'
#' El generador declara, no mezcla (B8 del checklist del operativo): una reserva
#' sin `titular_operational_code` no tiene con quien agruparse y `.calg_titular`
#' la agrupaba por su propio codigo — una fila fantasma que en la siembra real
#' salio como «combinando muestra uno con muestra dos, y CH uno con CH dos».
#' Un titular sin toc es legal (su toc es su propio codigo); una reserva no.
#'
#' Cubre las reservas de cadena —siempre entran al libro— y los extras
#' ACTIVADOS por un parte de campo. Asimetria declarada (decision del lead,
#' 2026-08-31): un extra activado solo por CONTROL sin toc sigue generando.
#' @keywords internal
.calg_reservas_sin_cadena <- function(unidades, partes = list()) {
  con_parte <- .calg_codigos_usados(partes)
  Filter(function(u) {
    rol <- tolower(trimws(as.character(u$sample_role %||% "")))
    if (identical(rol, "titular")) return(FALSE)
    if (nzchar(.calg_txt(u$titular_operational_code))) return(FALSE)
    cod <- .calg_txt(u$operational_code, .calg_txt(u$classroom_id))
    identical(rol, "chain_reserve") || (nzchar(cod) && cod %in% con_parte)
  }, unidades %||% list())
}

#' Las unidades que van al libro: todo menos el banco sin usar.
#' @keywords internal
.calg_unidades_del_libro <- function(unidades, partes = list(), control = list()) {
  usados <- .calg_codigos_usados(partes, control)
  Filter(function(u) {
    rol <- tolower(trimws(as.character(u$sample_role %||% "")))
    if (!identical(rol, "extra_reserve_pool")) return(TRUE)
    cod <- .calg_txt(u$operational_code, .calg_txt(u$classroom_id))
    nzchar(cod) && cod %in% usados
  }, unidades %||% list())
}


#' Genera el libro operativo completo del estudio.
#'
#' @param unidades filas del plan (formato largo).
#' @param path destino `.xlsx`.
#' @param control filas de «Base de control» ya registradas, que vuelven al libro.
#' @param efectivas vector con nombre: respuestas efectivas por codigo operativo.
#'   Efectiva es la de la PLATAFORMA —encuesta completa que pasa los filtros—,
#'   no lo que el aplicador anota en su parte.
#' @param traslape_daa vector nombrado por codigo operativo con el veredicto
#'   del cruce DAA (`aulas_daa_traslape`), o `NULL`. B8h fase 2: se enhebra a
#'   `aulas_libro_hoja_agendadas` y ensancha CADA bloque de esa hoja en 1, asi
#'   que toda la geometria derivada del bloque (desplegables, tintes,
#'   agrupados, tipado) se calcula con el ancho condicional. Sin cruce, el
#'   libro es byte-identico al de hoy.
#' @return la ruta escrita.
#' @export

aulas_libro_generar <- function(unidades, path, partes = list(), control = list(),
                               efectivas = NULL, responses = NULL, validas = NULL,
                               cuotas = NULL, cfg = list(), procedencia = NULL,
                               traslape_daa = NULL, disponibilidad = NULL) {
  if (!length(unidades)) {
    stop_api(409, "E_AULAS_LIBRO_SIN_PLAN", "No hay plan de aulas del que generar el libro.")
  }
  # B68: la hoja de asignación reparte sobre el plan COMPLETO —el mismo insumo
  # que la app—, y aquí abajo `unidades` se filtra para las hojas del libro.
  plan_completo <- unidades
  # B14: el banco de extras sin usar se captura ANTES del filtro —el filtro es
  # justo lo que lo saca de las hojas principales— y gana sus dos hojas
  # propias mas abajo. Un plan que SOLO trae banco sigue sin generar libro
  # (decision del lead): el segundo E_AULAS_LIBRO_SIN_PLAN de abajo manda.
  extras <- aulas_libro_extras_banco(unidades, partes = partes, control = control)
  unidades <- .calg_unidades_del_libro(unidades, partes = partes, control = control)
  if (!length(unidades)) {
    stop_api(409, "E_AULAS_LIBRO_SIN_PLAN",
             "El plan solo trae banco de extras sin usar: no hay aulas agendadas que llevar al libro.")
  }
  # Una sola basta para disparar: cada una saldria como fila fantasma en el
  # Excel del equipo, y el agregado esconde lo que muerde por celda.
  sin_cadena <- .calg_reservas_sin_cadena(unidades, partes = partes)
  if (length(sin_cadena)) {
    codigos <- vapply(sin_cadena, function(u) {
      .calg_txt(u$operational_code, .calg_txt(u$classroom_id))
    }, character(1))
    codigos <- unique(codigos[nzchar(codigos)])
    stop_api(
      409, "E_AULAS_LIBRO_SIN_CADENAS",
      sprintf(paste0(
        "%d fila(s) del plan entrarian al libro sin su codigo de cadena ",
        "(titular_operational_code): %s. Sin el, cada una saldria como una fila ",
        "fantasma agrupada bajo un titular que no es el suyo. Vuelve a entregar ",
        "la seleccion desde Calculo de muestra, que si escribe la cadena, o ",
        "reimporta el plan desde Recopiladores con la seleccion vigente."
      ), length(sin_cadena), paste(codigos, collapse = ", ")),
      details = list(filas = length(sin_cadena), codigos = as.list(codigos))
    )
  }
  # EL LIBRO NO PRESERVA LO QUE HAYA EN `path`, Y ES DELIBERADO.
  #
  # Se implemento la preservacion el 2026-08-28 y se retiro el 2026-08-29 al
  # medir el flujo real: el unico sitio que genera escribe SIEMPRE en una ruta
  # nueva —`uuid::UUIDgenerate()` en `router_monitoreo.R`— y el front descarga
  # por enlace efimero porque, en sus palabras, «no hay donde guardar un Excel
  # operativo dentro del proyecto, y sacarlo es justo el punto». El archivo que
  # el equipo edita vive en SU disco y la app no lo toca nunca.
  #
  # Preservar era, por tanto, codigo que no corre. Peor: sus tests se leian como
  # la garantia de que regenerar conserva lo editado, que es falsa. Cobertura
  # que parece cubrir es el defecto que este modulo ya pago dos veces.
  #
  # El ciclo real es subir -> importar -> generar nuevo, y lo que conserva el
  # trabajo del equipo es el ESTADO DE SESION que el router arrastra (`partes`,
  # `control`), no el archivo. El riesgo que queda no es destruccion sino
  # DIVERGENCIA entre dos copias, y eso se ataca declarando la procedencia
  # dentro del libro.
  hojas <- list(`Aulas Agendadas` = aulas_libro_hoja_agendadas(unidades, traslape_daa = traslape_daa))
  # B14: cada hoja Extra va INMEDIATAMENTE despues de su contraparte (decision
  # del lead) y SOLO si el plan trae banco sin usar: sin extras el juego de
  # hojas es identico al de hoy, nada de hojas fantasma vacias.
  if (length(extras)) {
    hojas[[AULAS_LIBRO_HOJA_AGENDADAS_EXTRA]] <- aulas_libro_hoja_agendadas_extra(extras)
  }
  hojas[["Aulas Aplicadas (Campo)"]] <- aulas_libro_hoja_aplicadas(unidades, partes = partes)
  if (length(extras)) {
    hojas[[AULAS_LIBRO_HOJA_APLICADAS_EXTRA]] <- aulas_libro_hoja_aplicadas_extra(extras, partes = partes)
  }
  hojas[["Base de control"]] <- aulas_libro_hoja_control(unidades, control, efectivas, partes = partes)
  # 4.ª hoja de datos (B2.1): el recorte agenda+campo por fecha que en 2025 se
  # tecleaba a mano. DESPUÉS de «Base de control» y ANTES de «Cómo va el
  # campo»: quien agenda sigue aterrizando en su hoja e indicadores sigue
  # penúltima. Es de IDA (sin lector) y vive en carga_aulas_libro_plan_dia.R.
  hojas[["Plan del día"]] <- aulas_libro_hoja_plan_dia(unidades, partes = partes)

  # Workbook en vez de `write.xlsx`: el volcado no admite validaciones, paneles
  # ni anchos, y sin ellos la hoja no se puede llenar sin equivocarse. Ver
  # `carga_aulas_libro_formato.R` para el porque de cada vocabulario.
  wb <- openxlsx::createWorkbook()
  # **La portada «Resumen» y la hoja larga «Datos» se retiraron.**
  #
  # «Datos» se añadio para poder hacer tablas dinamicas, y Gonzalo lo llamo por
  # su nombre al verla: «esta esforzando una tabla dinamica cuando no deberia
  # haber un forcejeo de tabla dinamica». «Resumen» se fue detras por decision
  # suya: «se va resumen».
  #
  # El criterio es el mismo para las dos, y es el que ordena este fichero:
  # **este libro es la unica herramienta de quien agenda y de quien aplica.**
  # Gonzalo: «el agendador solo ve el excel, no la app; la app se nutre del
  # excel para alimentar la app». Son dos personas distintas con dos
  # herramientas distintas, y el libro es de la primera.
  #
  # Por eso cada hoja que no se LLENA le quita sitio a las que si, y por eso las
  # decisiones de este fichero se juzgan por si ayudan a agendar y a anotar el
  # parte —no por si permiten analizar—. Quedan las tres hojas de trabajo y las
  # listas de los desplegables.
  for (nombre in names(hojas)) {
    openxlsx::addWorksheet(wb, nombre)
    openxlsx::writeData(wb, nombre, hojas[[nombre]], colNames = FALSE)
  }
  # **La hoja de indicadores va la ULTIMA, y es a proposito.** El libro lo abre
  # quien agenda, y su hoja tiene que ser la primera; quien viene a mirar como
  # va el campo la busca, y encontrarla al final no le cuesta nada.
  aulas_libro_escribir_indicadores(
    wb, aulas_libro_indicadores(unidades, efectivas, responses, partes, validas,
                                cuotas = cuotas, cfg = cfg),
    procedencia = procedencia
  )

  # **El formato solo no basta: hay que escribir el dato con su tipo.**
  #
  # Una celda de texto «2026-08-11» con formato de fecha SIGUE siendo texto:
  # Excel no la ordena ni la filtra por rango, y «2026-8-9» se coloca antes que
  # «2026-08-11» porque compara letra a letra. Se reescriben las columnas de
  # fecha con su valor tipado; el resto de la hoja se queda como esta.
  #
  # Se puede desde que el lector tolera el serial: antes, tipar una fecha la
  # devolvia al plan como «46245».
  # Solo se reescriben las celdas que SÍ parsean como fecha, por tramos
  # contiguos: reescribir la columna entera volvía NA todo texto no-fecha
  # («Total de la jornada», «Pendientes de jornadas anteriores» en «Plan del
  # día») y lo borraba del xlsx en silencio. Lo no parseado conserva el texto
  # que `writeData` ya dejó — se tolera la no-fecha en vez de recortar por
  # código porque este helper sirve a cuatro hojas y no conoce sus columnas.
  .calg_tipar_fechas <- function(wb, hoja, datos, cols, desde) {
    for (col in cols) {
      if (col > ncol(datos)) next
      crudo <- as.character(datos[[col]])[-seq_len(desde)]
      # La celda VACIA se borra en vez de quedarse como el texto "" que dejo
      # `writeData`: con un "" inline la columna sale mixta (texto + fecha) y
      # Excel ya no la trata como columna de fechas. Borrar no toca los
      # rotulos («Total de la jornada», «Pendientes…»), que son texto con
      # contenido y siguen tolerados.
      vacias <- which(is.na(crudo) | !nzchar(trimws(crudo)))
      if (length(vacias)) {
        openxlsx::deleteData(wb, hoja, cols = col, rows = desde + vacias,
                             gridExpand = TRUE)
      }
      fecha <- suppressWarnings(as.Date(crudo, format = "%Y-%m-%d"))
      validas <- which(!is.na(fecha))
      if (!length(validas)) next
      for (tramo in split(validas, cumsum(c(1L, diff(validas) != 1L)))) {
        openxlsx::writeData(wb, hoja, fecha[tramo], startCol = col,
                            startRow = desde + tramo[[1]], colNames = FALSE)
      }
    }
  }

  # Un `numFmt` sobre celdas de TEXTO no se ve: la columna llevaba «#,##0»
  # declarado y seguia alineandose como cadena. El tipado es lo que hace que el
  # formato signifique algo, igual que con las fechas.
  .calg_tipar_numeros <- function(wb, hoja, datos, cols, desde) {
    for (col in cols) {
      if (col > ncol(datos)) next
      crudo <- as.character(datos[[col]])[-seq_len(desde)]
      num <- suppressWarnings(as.numeric(crudo))
      if (!any(is.finite(num))) next
      openxlsx::writeData(wb, hoja, num, startCol = col, startRow = desde + 1L,
                          colNames = FALSE)
    }
  }

  profundidad <- .calg_profundidad(unidades)

  # **Cada lista se llama EXACTAMENTE como su columna.** Los rotulos estaban
  # escritos a mano y uno ya se habia separado: la columna del bloque es «DIA»
  # —asi la espera el lector, y asi viene del Excel del equipo— y su lista decia
  # «DÍA». La misma columna con dos nombres en el mismo libro. Derivados de la
  # spec, no pueden volver a separarse.
  titulo_de <- function(campo) {
    i <- which(vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1)) == campo)
    AULAS_AGENDADAS_BLOQUE[[i[[1]]]]$titulos[[1]]
  }
  listas <- stats::setNames(
    list(
      aulas_libro_status_muestra(profundidad),
      AULAS_LIBRO_MEDIO_CONTACTO,
      AULAS_LIBRO_DIA,
      # El desplegable NO absoluto de B15: tres momentos y texto libre (la
      # validacion de esta capa ya es allowBlank + sin error duro).
      AULAS_LIBRO_MOMENTO_CLASE,
      # B22: {Sí, No} de «RECIBIÓ CORREO», uniforme en todos los bloques.
      AULAS_LIBRO_RECIBIO_CORREO,
      # B23: los siete resultados de llamada, en el orden del dictado.
      AULAS_LIBRO_STATUS_LLAMADA,
      AULAS_LIBRO_STATUS_APLICACION
    ),
    c(titulo_de("sample_status"), titulo_de("contact_medium"), titulo_de("scheduled_day"),
      titulo_de("scheduled_moment"), titulo_de("email_received"),
      titulo_de("call_status"),
      # Esta es de la hoja de campo, no del bloque de agenda.
      .calg_titulos_campo()[[which(.calg_titulos_campo() == "STATUS DE APLICACIÓN")]])
  )
  hoja_listas <- "Listas"
  # El rango de una lista, resuelto por SU nombre y no por un indice a mano:
  # las dos numeraciones que se llevaban a mano (posicion del campo en el
  # bloque e indice de la lista en «Listas») eran justo el cruce que el test de
  # «cada desplegable saca sus valores de SU lista» vigila. Asi, añadir una
  # lista en medio no cruza ninguna validacion.
  rango_de <- function(titulo) {
    i <- which(names(listas) == titulo)[[1]]
    .calf_rango(hoja_listas, i, length(listas[[i]]))
  }

  # Las columnas del desplegable se derivan de la POSICION del campo en el
  # bloque, no de un numero a mano: si manana el bloque gana una columna, esto
  # sigue apuntando al campo correcto.
  #
  # B8h fase 2: con el cruce DAA cada bloque de agendadas se ensancha en 1
  # («TRASLAPE DAA» lo cierra), asi que el PASO entre bloques es condicional.
  # Todo consumidor de geometria de esta hoja (desplegables, semaforos,
  # tintes, agrupados, tipado) pasa por `col_en_bloque`/`ancho_bloque_agenda`:
  # con el paso viejo, cada bloque R1+ apuntaria una columna a la izquierda.
  con_daa <- .calg_daa_activo(traslape_daa)
  ancho_bloque_agenda <- AULAS_AGENDADAS_ANCHO_BLOQUE + as.integer(con_daa)
  idx <- function(campo) which(vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo == campo, logical(1)))
  col_en_bloque <- function(campo, b) 1L + (b - 1L) * ancho_bloque_agenda + idx(campo)
  bloques <- seq_len(profundidad)
  filas_agenda <- nrow(hojas[["Aulas Agendadas"]]) - 1L

  validaciones <- list(
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda,
         cols = vapply(bloques, function(b) col_en_bloque("sample_status", b), integer(1)),
         rango = rango_de(titulo_de("sample_status"))),
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda,
         cols = vapply(bloques, function(b) col_en_bloque("contact_medium", b), integer(1)),
         rango = rango_de(titulo_de("contact_medium"))),
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda,
         cols = vapply(bloques, function(b) col_en_bloque("scheduled_day", b), integer(1)),
         rango = rango_de(titulo_de("scheduled_day"))),
    # B15: el desplegable no absoluto de MOMENTO DE LA CLASE, en cada bloque y
    # derivado de la spec — nunca un numero de columna a mano.
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda,
         cols = vapply(bloques, function(b) col_en_bloque("scheduled_moment", b), integer(1)),
         rango = rango_de(titulo_de("scheduled_moment"))),
    # B22: {Sí, No} de RECIBIÓ CORREO en cada bloque, titular incluido — la
    # spec es uniforme y el allowBlank de la casa hace inofensivo el chip en
    # la celda vacia del titular.
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda,
         cols = vapply(bloques, function(b) col_en_bloque("email_received", b), integer(1)),
         rango = rango_de(titulo_de("email_received"))),
    # B23: STATUS DE LLAMADA en cada bloque — «todos los CH», titulares
    # incluidos, con los siete resultados del dictado.
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda,
         cols = vapply(bloques, function(b) col_en_bloque("call_status", b), integer(1)),
         rango = rango_de(titulo_de("call_status")))
  )

  # B14: lo que las hojas Extra aportan al formateador — cabeceras, sus
  # desplegables contra la MISMA hoja «Listas», columna repetida y banda
  # combinada. Sin extras devuelve fragmentos vacios (carga_aulas_libro_extras.R).
  extras_fmt <- aulas_libro_extras_formato(hojas, rango_de = rango_de)
  validaciones <- c(validaciones, extras_fmt$validaciones)

  # Las columnas de estado que se tiñen. Se piden por su POSICION dentro del
  # bloque, igual que las validaciones: si el bloque gana un campo, esto sigue
  # apuntando al estado y no a su vecina.
  filas_aplicadas <- nrow(hojas[["Aulas Aplicadas (Campo)"]]) - 2L

  # **La hoja de campo tiene SU propio bloque y hay que contarlo entero.**
  # `1 + which(titulos_campo == …)` daba la columna 13 —`MEDIO DE CONTACTO`—
  # porque olvidaba los 20 titulos de agenda que van en medio: el semaforo de
  # estado se estaba pintando sobre una columna de la agenda, donde ninguna
  # regla casa, asi que no se veia ni de un lado ni del otro. Y cubria solo el
  # primer intento. Mismo error de contar columnas a mano que ya habia costado
  # las paginas sin aula; por eso ahora hay UNA funcion que lo calcula.
  ancho_campo <- 1L + length(.calg_titulos_agenda()) + length(.calg_titulos_campo())
  # Desde B24 los bloques de la hoja de campo son ESLABONES espejo de
  # agendadas (ya no «intentos» fijos): la cuenta se lee del ancho real, asi
  # que bandas, semaforo, validaciones, descuadres y tipado recomputan solos
  # con la profundidad del plan.
  bloques_campo <- max(1L, floor(ncol(hojas[["Aulas Aplicadas (Campo)"]]) / ancho_campo))
  col_campo <- function(titulo, b) {
    (b - 1L) * ancho_campo + 1L + length(.calg_titulos_agenda()) +
      which(.calg_titulos_campo() == titulo)
  }
  cols_campo <- function(titulos) unlist(lapply(titulos, function(t)
    vapply(seq_len(bloques_campo), function(b) col_campo(t, b), integer(1))))

  # Las columnas de AGENDA que la hoja de campo repite delante de las suyas.
  # Hermana de `cols_campo`, y va aqui por lo mismo: `formatos` las necesita.
  col_agenda_en_campo <- function(titulo, b) {
    (b - 1L) * ancho_campo + 1L + which(.calg_titulos_agenda() == titulo)
  }
  cols_agenda_en_campo <- function(titulos) unlist(lapply(titulos, function(t) {
    if (!length(which(.calg_titulos_agenda() == t))) return(integer(0))
    vapply(seq_len(bloques_campo), function(b) col_agenda_en_campo(t, b), integer(1))
  }))

  # Cada columna con su paleta. Las dos ultimas las pidio Gonzalo comparando con
  # el Sheets que el equipo usa: «chips desplegables para los status y dias de
  # la semana». Son las dos columnas que el agendador recorre en VERTICAL para
  # repartir su jornada, y sin color hay que leerlas palabra por palabra.
  # `paleta` nombra el juego de reglas; sin ella cae al semaforo de estados.
  semaforos <- list(
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda,
         cols = vapply(bloques, function(b) col_en_bloque("sample_status", b), integer(1))),
    list(hoja = "Aulas Aplicadas (Campo)", desde = 2L, filas = max(0L, filas_aplicadas),
         cols = cols_campo("STATUS DE APLICACIÓN")),
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda, paleta = "medio",
         cols = vapply(bloques, function(b) col_en_bloque("contact_medium", b), integer(1))),
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda, paleta = "dia",
         cols = vapply(bloques, function(b) col_en_bloque("scheduled_day", b), integer(1)))
  )

  # Que columnas del bloque son numeros y cuales fechas. Por nombre de campo,
  # como todo lo demas: si el bloque gana una columna, esto no se descoloca.
  cols_de <- function(campos) unlist(lapply(campos, function(campo)
    vapply(bloques, function(b) col_en_bloque(campo, b), integer(1))))
  filas_control <- nrow(hojas[["Base de control"]]) - 2L
  cols_control <- vapply(
    c("MATRICULADOS TOTALES", "MATRICULADOS ELEGIBLES",
      # Las cuentas del bloque nuevo: esperadas, obtenidas y la diferencia.
      "EFECTIVAS ESPERADAS", "EFECTIVAS OBTENIDAS", "EFECTIVAS: DIFERENCIA",
      "ELEGIBLES: BASE DEL %", "MUJERES ESPERADAS", "HOMBRES ESPERADOS"),
    .calg_col_control, integer(1), USE.NAMES = FALSE)
  cols_control <- cols_control[cols_control > 0L]
  # Y los dos porcentajes, que se escriben en 0-1 y hay que ENSEÑAR como
  # porcentaje: un «0.7» en una columna que se llama «% EFECTIVAS ESPERADO» es
  # justo el defecto que se corrigio en la hoja de campo.
  cols_control_pct <- vapply(c("% EFECTIVAS ESPERADO", "% EFECTIVAS OBTENIDO"),
                             .calg_col_control, integer(1), USE.NAMES = FALSE)
  cols_control_pct <- cols_control_pct[cols_control_pct > 0L]
  # **Las cuatro razones que ya venian en la hoja.** El arreglo de `7d0c22a7`
  # alcanzo a «% EFECTIVAS ESPERADO/OBTENIDO» y a «% ASISTENCIA», y dejo fuera a
  # sus hermanas de siempre: en el PDF, «CORTAS VS TOTAL» y «LARGAS VS TOTAL»
  # salian **0.182 · 0.818 · 0.077 · 0.923**, razones crudas en columnas cuyo
  # nombre promete una comparacion. El precedente estaba aplicado al vecino y no
  # a estas.
  #
  # Cada una decide su escala POR SU PROPIA COLUMNA: las llena el equipo en su
  # Excel y nada obliga a que las cuatro vengan en la misma —un libro con «VS
  # TOTAL» en 0-1 y «ASISTENCIA» en 0-100 es un caso real—.
  razones_control <- Filter(Negate(is.null), lapply(
    c("VS TOTAL", "VS ELEGIBLES", "CORTAS VS TOTAL", "LARGAS VS TOTAL"),
    function(titulo) {
      col <- .calg_col_control(titulo)
      if (!length(col) || is.na(col) || col <= 0L) return(NULL)
      valores <- as.character(hojas[["Base de control"]][[col]])[-(1:2)]
      list(hoja = "Base de control", desde = 2L, filas = max(0L, filas_control),
           tipo = .calg_escala_pct(valores), cols = col)
    }
  ))
  formatos <- c(list(
    list(hoja = "Base de control", desde = 2L, filas = max(0L, filas_control),
         tipo = "numero", cols = cols_control),
    list(hoja = "Base de control", desde = 2L, filas = max(0L, filas_control),
         tipo = "porcentaje", cols = cols_control_pct),
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda, tipo = "fecha",
         cols = cols_de(c("contact_date", "scheduled_date"))),
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda, tipo = "numero",
         cols = cols_de(c("enrolled_total", "eligible_n", "contact_attempts"))),
    list(hoja = "Aulas Aplicadas (Campo)", desde = 2L, filas = max(0L, filas_aplicadas),
         tipo = "numero", cols = cols_campo(.calg_campo_numeros())),
    # Las columnas de agenda que esta hoja repite: sin su formato, una fecha
    # tipada sale como «46 245» y el arreglo se lee como una averia peor.
    list(hoja = "Aulas Aplicadas (Campo)", desde = 2L, filas = max(0L, filas_aplicadas),
         tipo = "numero", cols = cols_agenda_en_campo(
           c("MATRICULADOS TOTAL DTI", "MATRICULADOS ELEGIBLES",
             "NÚMERO DE INTENTOS", "NIVEL DEL CURSO"))),
    # «FECHA AGENDADA»: el titulo v4 con el que la agenda viaja en esta hoja.
    list(hoja = "Aulas Aplicadas (Campo)", desde = 2L, filas = max(0L, filas_aplicadas),
         tipo = "fecha", cols = cols_agenda_en_campo(
           c("FECHA DE LLAMADA", "FECHA AGENDADA"))),
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda,
         tipo = "numero", cols = cols_de("level")),
    # El tipo de esta columna lo decide la escala de lo que llego, no una
    # preferencia: en 0-1 se enseña como porcentaje, en 0-100 como decimal.
    list(hoja = "Aulas Aplicadas (Campo)", desde = 2L, filas = max(0L, filas_aplicadas),
         tipo = .calg_escala_pct(unlist(lapply(cols_campo("% ASISTENCIA"), function(col)
           as.character(hojas[["Aulas Aplicadas (Campo)"]][[col]])[-(1:2)]))),
         cols = cols_campo("% ASISTENCIA"))
  ), razones_control)

  # **La hoja de campo repite las columnas de agenda, y nadie las estaba tipando.**
  #
  # Medido el 2026-08-31 abriendo el xlsx: 960 numeros y 192 FECHAS guardados
  # como texto en «Aulas Aplicadas (Campo)». El tipado se habia hecho para
  # «Aulas Agendadas» —`contact_date`, `scheduled_date`, matriculados,
  # intentos— y la hoja de campo, que copia esas mismas columnas delante de las
  # suyas, se quedo fuera. Es la misma regla leida en dos capas.
  #
  # Lo caro es la fecha: quien dirige el campo ordena por «FECHA DE APLICACIÓN»
  # para saber que toca mañana, y como texto «2026-09-10» se ordena antes que
  # «2026-09-9». El comentario de `formato_fecha` ya avisaba de esto para la
  # otra hoja.
  .calg_tipar_fechas(wb, "Aulas Agendadas", hojas[["Aulas Agendadas"]],
                     cols_de(c("contact_date", "scheduled_date")), desde = 1L)
  # «Plan del día» ordena POR fecha: su columna 1 se tipa como las demás fechas
  # del libro, o Excel la ordenaría letra a letra. ELEGIBLES (col. 10) es la
  # única cuenta de la hoja.
  .calg_tipar_fechas(wb, "Plan del día", hojas[["Plan del día"]],
                     which(.capd_CABECERA == "FECHA AGENDADA"), desde = 1L)
  .calg_tipar_numeros(wb, "Plan del día", hojas[["Plan del día"]],
                      which(.capd_CABECERA == "ELEGIBLES"), desde = 1L)
  .calg_tipar_numeros(wb, "Aulas Agendadas", hojas[["Aulas Agendadas"]],
                      # `level` entra ahora: «NIVEL DEL CURSO» es un numero (2,
                      # 3, 5…) y salia como texto en los doce bloques, asi que
                      # no se podia filtrar «solo primeros ciclos» con un >=.
                      cols_de(c("enrolled_total", "eligible_n", "contact_attempts", "level")),
                      desde = 1L)
  .calg_tipar_numeros(wb, "Aulas Aplicadas (Campo)", hojas[["Aulas Aplicadas (Campo)"]],
                      cols_campo(c(.calg_campo_numeros(), "% ASISTENCIA")), desde = 2L)
  .calg_tipar_numeros(wb, "Aulas Aplicadas (Campo)", hojas[["Aulas Aplicadas (Campo)"]],
                      cols_agenda_en_campo(c("MATRICULADOS TOTAL DTI",
                                             "MATRICULADOS ELEGIBLES",
                                             "NÚMERO DE INTENTOS",
                                             "NIVEL DEL CURSO")), desde = 2L)
  .calg_tipar_fechas(wb, "Aulas Aplicadas (Campo)", hojas[["Aulas Aplicadas (Campo)"]],
                     cols_agenda_en_campo(c("FECHA DE LLAMADA",
                                            "FECHA AGENDADA")), desde = 2L)
  # **La fecha del bloque de CAMPO, que es otra columna con el mismo nombre.**
  #
  # `cols_agenda_en_campo` tipa las que la hoja repite de la agenda; ésta la
  # escribe el aplicador. Estaba sin tipar desde siempre y no se veía porque la
  # hoja salía VACÍA: al reparar los alias del parte —el mismo día— la columna
  # se llenó y aparecieron sus 152 fechas como texto. Un defecto tapado por
  # otro.
  .calg_tipar_fechas(wb, "Aulas Aplicadas (Campo)", hojas[["Aulas Aplicadas (Campo)"]],
                     cols_campo("FECHA DE APLICACIÓN"), desde = 2L)
  # `ID MATCH` es un correlativo, y como texto se ordena «1, 10, 100, 11». El
  # lector NO se ve afectado: lo usa como marcador de CABECERA para detectar los
  # bloques (`which(claves == "ID MATCH")` en carga_aulas_aplicadas.R), no como
  # clave de fila, asi que el tipo de sus valores le da igual.
  .calg_tipar_numeros(wb, "Aulas Agendadas", hojas[["Aulas Agendadas"]], 1L, desde = 1L)
  .calg_tipar_numeros(wb, "Aulas Aplicadas (Campo)", hojas[["Aulas Aplicadas (Campo)"]],
                      vapply(seq_len(bloques_campo),
                             function(b) (b - 1L) * ancho_campo + 1L, integer(1)),
                      desde = 2L)
  .calg_tipar_numeros(wb, "Base de control", hojas[["Base de control"]],
                      c(cols_control, cols_control_pct,
                        vapply(razones_control, function(r) r$cols, integer(1))),
                      desde = 2L)
  # Las columnas que la hoja de control gano al conectarla con agenda y campo.
  # Se tipan aparte porque `cols_control` es una lista fija de conteos y estas
  # son dos fechas y un aforo: meterlas ahi las habria tratado como numeros.
  #
  # «HORARIO» NO se tipa a proposito: sus valores son «0703», un horario, y como
  # numero se leeria 703.
  local({
    fechas <- vapply(c("FECHA AGENDADA", "FECHA DE APLICACION"),
                     .calg_col_control, integer(1), USE.NAMES = FALSE)
    fechas <- fechas[fechas > 0L]
    if (length(fechas)) {
      .calg_tipar_fechas(wb, "Base de control", hojas[["Base de control"]], fechas, desde = 2L)
    }
    asistentes <- .calg_col_control("N ASISTENTES EN AULA")
    if (length(asistentes) && !is.na(asistentes) && asistentes > 0L) {
      .calg_tipar_numeros(wb, "Base de control", hojas[["Base de control"]],
                          asistentes, desde = 2L)
    }
  })

  campos_bloque <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  aulas_libro_aplicar_formato(
    wb,
    filas_cabecera = c(
      list(`Aulas Agendadas` = 1L, `Aulas Aplicadas (Campo)` = 2L,
           `Base de control` = 2L, `Plan del día` = 1L),
      # B14: con hojas Extra presentes, entran al mismo circuito de cabecera,
      # freeze, filtro y anchos que las demas.
      extras_fmt$filas_cabecera
    ),
    validaciones = validaciones,
    listas = listas,
    # Dictado 2026-09-04: la fila de titulos de la hoja de campo dice, por
    # color, de que sirve cada columna. La agenda no lo necesita: alli el color
    # del eslabon ya es la pista y su cabecera es de una sola fila.
    funciones = list(`Aulas Aplicadas (Campo)` = aulas_libro_funciones_de_columna(
      .calg_titulos_agenda(), .calg_titulos_campo(), bloques_campo
    )),
    columnas_app = list(`Aulas Agendadas` = aulas_libro_columnas_de_la_app(
      # B8h fase 2: con el cruce, «TRASLAPE DAA» cierra el bloque y es columna
      # de la APP —el veredicto lo escribe el cruce, no la persona— asi que
      # entra al gris de «esto no lo toques» como las demas derivadas.
      if (con_daa) c(campos_bloque, "traslape_daa") else campos_bloque,
      AULAS_LIBRO_CAMPOS_DE_LA_PERSONA, profundidad,
      ancho = ancho_bloque_agenda, desplazamiento = 1L
    )),
    # Un grupo plegable por cada bloque de reemplazo. El titular —el primer
    # bloque— se queda fuera: es la fila que se trabaja siempre y plegarla no
    # tendria sentido. Con once reservas, la hoja pasa de 241 columnas a 21
    # visibles en un clic.
    agrupados = if (profundidad > 1L) lapply(2:profundidad, function(b) list(
      hoja = "Aulas Agendadas",
      cols = seq(
        1L + (b - 1L) * ancho_bloque_agenda + 1L,
        1L + b * ancho_bloque_agenda
      )
    )) else list(),
    # El tinte y el borde de CADA eslabon, titular incluido: `agrupados` solo
    # trae los reemplazos —el titular no se pliega— pero el color si es de los
    # doce.
    tintes = c(
      lapply(seq_len(profundidad), function(b) list(
        hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda, eslabon = b,
        cols = seq(1L + (b - 1L) * ancho_bloque_agenda + 1L,
                   1L + b * ancho_bloque_agenda)
      )),
      # La hoja de campo tiene los mismos eslabones y salia con los tres
      # bloques en el mismo navy: la banda los nombraba pero el color no los
      # distinguia. `pinta_banda`, porque aqui la fila 1 es la banda y la pinta
      # este bucle —el de `agrupados` solo cubre la agenda—.
      lapply(seq_len(bloques_campo), function(b) list(
        hoja = "Aulas Aplicadas (Campo)", desde = 2L,
        filas = max(0L, filas_aplicadas), eslabon = b, pinta_banda = TRUE,
        cols = seq((b - 1L) * ancho_campo + 1L, b * ancho_campo)
      )),
      # Los cuatro tramos de la «Base de control». Llevan `tono` explicito
      # porque NO son eslabones: son areas tematicas y su escala es propia. Con
      # 43 columnas, el color es lo unico que dice en que parte de la hoja se
      # esta cuando la banda ya quedo arriba.
      local({
        g <- aulas_libro_grupos_control()
        escala <- aulas_libro_colores_eslabon(length(g))
        lapply(seq_along(g), function(i) list(
          hoja = "Base de control", desde = 2L, filas = max(0L, filas_control),
          tono = escala[[i]], pinta_banda = TRUE,
          cols = seq(g[[i]]$desde, g[[i]]$hasta)
        ))
      })
    ),
    semaforos = semaforos,
    formatos = formatos,
    # Hasta la columna del CODIGO del aula, calculada y no adivinada: `ID MATCH`
    # es un correlativo y `MUESTRA` va antes del codigo, asi que repetir «las
    # dos primeras» dejaba las paginas con un numero de orden, una ola y ningun
    # curso-horario. Se vio en el PDF despues de darlo por arreglado.
    columnas_repetidas = c(list(
      `Aulas Agendadas` = col_en_bloque("operational_code", 1L),
      # Misma idea en la hoja de campo: su bloque es
      # `ID MATCH + titulos_agenda + titulos_campo`, y el codigo va segundo
      # dentro de los titulos de agenda.
      `Aulas Aplicadas (Campo)` = 1L + which(.calg_titulos_agenda() == "CURSO-HORARIO"),
      # Y en la «Base de control» la primera columna es `MUESTRA` —la ola—, que
      # se repite en cientos de filas: sus paginas salian rotuladas «M1» y sin
      # decir de que aula hablan. Se repite hasta `CURSO-HORARIO`.
      `Base de control` = .calg_col_control("CURSO-HORARIO")
    ), extras_fmt$columnas_repetidas),
    # Las bandas de grupo de la hoja de campo: una por intento.
    # La regla de cuadre del parte, una por intento: las efectivas no pueden
    # superar a los asistentes menos rechazos y duplicados.
    descuadres = lapply(seq_len(bloques_campo), function(b) list(
      hoja = "Aulas Aplicadas (Campo)", desde = 2L,
      filas = max(0L, filas_aplicadas),
      asistentes = col_campo("CANTIDAD DE ASISTENTES", b),
      rechazos = col_campo("CANTIDAD DE RECHAZOS", b),
      duplicados = col_campo("DUPLICADOS (YA RESPONDIERON)", b),
      efectivas = col_campo("CANTIDAD DE EFECTIVAS", b)
    )),
    combinar = c(
      lapply(seq_len(bloques_campo), function(b) list(
        hoja = "Aulas Aplicadas (Campo)", fila = 1L,
        cols = seq((b - 1L) * ancho_campo + 1L, b * ancho_campo)
      )),
      # Los cuatro tramos de la base de control tenian el mismo hueco: la
      # etiqueta en su primera celda y el resto del tramo en blanco.
      lapply(aulas_libro_grupos_control(), function(g) list(
        hoja = "Base de control", fila = 1L, cols = seq(g$desde, g$hasta)
      )),
      # B14: la banda «EXTRA» de la hoja de campo Extra, combinada como las
      # bandas principales.
      extras_fmt$combinar
    )
  )
  # B68 (dictado 2026-09-03): la hoja «Asignación de aplicadores» — la doble
  # escritura del reparto. Sin disponibilidad en sesión no se escribe: una
  # hoja vacía se leería como «nadie asignado». Vive en su archivo propio.
  aulas_libro_hoja_asignacion(wb, plan_completo, disponibilidad, cfg = cfg)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  # Cuantas unidades entraron DE VERDAD, como atributo para no cambiar el
  # retorno: el llamador contaba `length(unidades)` sobre el plan crudo y desde
  # que el banco sin usar se filtra aqui, esa cifra ya no describe el archivo.
  # El aviso decia «Libro de 2616 aulas» de un libro con 190.
  attr(path, "unidades") <- length(unidades)
  # Y el DESGLOSE, porque «700 aulas» no describe el libro: son 193
  # cursos-horario que se van a visitar y 507 reservas que solo entran si una
  # titular cae. Un total sin desglose vuelve a poner dos cosas distintas bajo
  # la misma palabra, que es lo que ya paso con «Libro de 2616 aulas».
  attr(path, "titulares") <- sum(vapply(
    unidades, function(u) identical(.calg_txt(u$sample_role), "titular"), logical(1)
  ))
  attr(path, "reservas") <- length(unidades) - attr(path, "titulares")
  path
}
