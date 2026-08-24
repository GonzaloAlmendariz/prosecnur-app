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
  #
  # **En el orden del PLAN, no en el alfabetico.** `split()` ordena los grupos
  # por su clave como TEXTO, asi que el libro salia «CH 1, CH 10, CH 100,
  # CH 101…»: quien busca «CH 11» lo encontraba noventa filas mas abajo, y el
  # orden de la muestra —que el plan ya trae resuelto— se perdia. Con el factor
  # de niveles en orden de aparicion, el libro conserva el del plan.
  claves <- vapply(unidades, .calg_titular, character(1))
  grupos <- split(unidades, factor(claves, levels = unique(claves)))
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
        .calg_num_txt(u$contact_attempts),
        .calg_status_excel(u$sample_status, .calg_num_txt(u$replacement_order)),
        .calg_txt(u$scheduled_date), .calg_dia_excel(u$scheduled_day), .calg_txt(u$scheduled_time),
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
    # **El % de asistencia VUELVE al libro.** Estaba en blanco con el comentario
    # de que «lo calcula la hoja del equipo con sus formulas», pero el libro que
    # generamos no llevaba formula ninguna: escribia texto vacio. Y el LECTOR si
    # lo lee (`carga_aulas_aplicadas.R`), asi que reabrir un libro con partes
    # perdia justo esa columna. No se deriva —medido sobre 152 partes: no sale
    # de ninguno de los dos denominadores de la hoja— porque es el numero que
    # pone el equipo.
    n("attendance_pct"),
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
    # «EN RESERVA k» describe a la reserva k, y k sale del orden de la cadena.
    n <- suppressWarnings(as.numeric(gsub("[^0-9]", "", v)))
    if (!length(n) || !is.finite(n) || n <= 0) n <- orden
    return(if (is.finite(n) && n > 0) sprintf("EN RESERVA %d", as.integer(n)) else "EN RESERVA 1")
  }
  conocidos <- c(agendada = "AGENDADA", reagendada = "REAGENDADA",
                 reemplazada = "REEMPLAZADA")
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
  "MATRICULADOS TOTAL DTI", "MATRICULADOS POBLACIÓN", "CANTIDAD DE ASISTENTES",
  "CANTIDAD DE RECHAZOS", "DUPLICADOS (YA RESPONDIERON)", "CANTIDAD DE EFECTIVAS"
)

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
  # **Las DOS fechas del bloque se llamaban igual.** Esta hoja repite la parte de
  # agenda y le pega el parte de campo, asi que «FECHA DE APLICACION» sale dos
  # veces en el mismo bloque: la que se agendo y la que ocurrio. Lo unico que
  # las distinguia en pantalla era una tilde —«APLICACION» contra
  # «APLICACIÓN»—, que es una diferencia accidental y que nadie lee como una
  # distincion de significado. El lector ya lo sufria: separa las dos partes por
  # la SEGUNDA aparicion de `MATRICULADOS TOTAL DTI`, una heuristica que existe
  # solo porque los rotulos no se distinguen.
  #
  # `FECHA AGENDADA` es **alias declarado** de `scheduled_date` en
  # `AULAS_AGENDADAS_BLOQUE`, asi que el nombre ya estaba disponible. Se cambia
  # SOLO en esta hoja: en «Aulas Agendadas» no hay con que confundirla.
  titulos_agenda <- sub("^FECHA DE APLICACION$", "FECHA AGENDADA", .calg_titulos_agenda())
  titulos_campo <- .calg_titulos_campo()

  grupo <- c()
  campos <- c()
  for (b in seq_len(intentos)) {
    # **«TITULAR» y «REEMPLAZO n», no «muestra».** El vocabulario del estudio
    # dejo de hablar de muestra 1 y muestra 2: una cadena es un titular y sus
    # reemplazos, y asi se llaman ya los codigos de las aulas —«CH 4» y su
    # «R 4.1», «R 4.2»—. La banda decia «MUESTRA DE APLICACIÓN PRINCIPAL» y
    # «APLICACIÓN DE REEMPLAZO 2», que es el vocabulario viejo y ademas
    # desalineado: el bloque 2 es el reemplazo 1, no el 2.
    #
    # Se puede renombrar sin romper la relectura porque el lector IGNORA esta
    # fila: `carga_aulas_aplicadas.R` toma los titulos de la fila 2.
    etiqueta <- if (b == 1L) "TITULAR" else sprintf("REEMPLAZO %d", b - 1L)
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
      .calg_num_txt(u$contact_attempts),
      .calg_status_excel(u$sample_status, .calg_num_txt(u$replacement_order)),
      .calg_txt(u$scheduled_date), .calg_dia_excel(u$scheduled_day), .calg_txt(u$scheduled_time),
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
# Los campos de la Base de control que la hoja ESCRIBE: todos menos los que la
# spec marca `solo_lectura`, que existen para releer libros viejos.
.calg_control_escritos <- function() {
  Filter(function(spec) !isTRUE(spec$solo_lectura), BASE_CONTROL_CAMPOS)
}

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

aulas_libro_hoja_control <- function(unidades, control = list(), efectivas = NULL) {
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
    pon("MATRICULADOS POBLACION", .calg_num_txt(u$eligible_n))

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
    # «MATRICULADOS POBLACION»: se repite para que el porcentaje se lea sin
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
    top1 <- toupper(substr(.calg_txt(u$sex_top_1), 1, 1))
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

#' Genera el libro operativo completo del estudio.
#'
#' @param unidades filas del plan (formato largo).
#' @param path destino `.xlsx`.
#' @param control filas de «Base de control» ya registradas, que vuelven al libro.
#' @param efectivas vector con nombre: respuestas efectivas por codigo operativo.
#'   Efectiva es la de la PLATAFORMA —encuesta completa que pasa los filtros—,
#'   no lo que el aplicador anota en su parte.
#' @return la ruta escrita.
#' @export
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

aulas_libro_generar <- function(unidades, path, partes = list(), control = list(),
                               efectivas = NULL, responses = NULL, validas = NULL) {
  if (!length(unidades)) {
    stop_api(409, "E_AULAS_LIBRO_SIN_PLAN", "No hay plan de aulas del que generar el libro.")
  }
  unidades <- .calg_unidades_del_libro(unidades, partes = partes, control = control)
  if (!length(unidades)) {
    stop_api(409, "E_AULAS_LIBRO_SIN_PLAN",
             "El plan solo trae banco de extras sin usar: no hay aulas agendadas que llevar al libro.")
  }
  hojas <- list(
    `Aulas Agendadas` = aulas_libro_hoja_agendadas(unidades),
    `Aulas Aplicadas (Campo)` = aulas_libro_hoja_aplicadas(unidades, partes = partes),
    `Base de control` = aulas_libro_hoja_control(unidades, control, efectivas)
  )

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
    wb, aulas_libro_indicadores(unidades, efectivas, responses, partes, validas)
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
  .calg_tipar_fechas <- function(wb, hoja, datos, cols, desde) {
    for (col in cols) {
      if (col > ncol(datos)) next
      crudo <- as.character(datos[[col]])[-seq_len(desde)]
      fecha <- suppressWarnings(as.Date(crudo, format = "%Y-%m-%d"))
      if (!any(!is.na(fecha))) next
      openxlsx::writeData(wb, hoja, fecha, startCol = col, startRow = desde + 1L,
                          colNames = FALSE)
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
      AULAS_LIBRO_STATUS_APLICACION
    ),
    c(titulo_de("sample_status"), titulo_de("contact_medium"), titulo_de("scheduled_day"),
      # Esta es de la hoja de campo, no del bloque de agenda.
      .calg_titulos_campo()[[which(.calg_titulos_campo() == "STATUS DE APLICACIÓN")]])
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
  intentos_campo <- max(1L, floor(ncol(hojas[["Aulas Aplicadas (Campo)"]]) / ancho_campo))
  col_campo <- function(titulo, b) {
    (b - 1L) * ancho_campo + 1L + length(.calg_titulos_agenda()) +
      which(.calg_titulos_campo() == titulo)
  }
  cols_campo <- function(titulos) unlist(lapply(titulos, function(t)
    vapply(seq_len(intentos_campo), function(b) col_campo(t, b), integer(1))))

  semaforos <- list(
    list(hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda,
         cols = vapply(bloques, function(b) col_en_bloque("sample_status", b), integer(1))),
    list(hoja = "Aulas Aplicadas (Campo)", desde = 2L, filas = max(0L, filas_aplicadas),
         cols = cols_campo("STATUS DE APLICACIÓN"))
  )

  # Que columnas del bloque son numeros y cuales fechas. Por nombre de campo,
  # como todo lo demas: si el bloque gana una columna, esto no se descoloca.
  cols_de <- function(campos) unlist(lapply(campos, function(campo)
    vapply(bloques, function(b) col_en_bloque(campo, b), integer(1))))
  filas_control <- nrow(hojas[["Base de control"]]) - 2L
  cols_control <- vapply(
    c("MATRICULADOS TOTALES", "MATRICULADOS POBLACION",
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
    c("VS TOTAL", "VS POBLACION", "CORTAS VS TOTAL", "LARGAS VS TOTAL"),
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
    # El tipo de esta columna lo decide la escala de lo que llego, no una
    # preferencia: en 0-1 se enseña como porcentaje, en 0-100 como decimal.
    list(hoja = "Aulas Aplicadas (Campo)", desde = 2L, filas = max(0L, filas_aplicadas),
         tipo = .calg_escala_pct(unlist(lapply(cols_campo("% ASISTENCIA"), function(col)
           as.character(hojas[["Aulas Aplicadas (Campo)"]][[col]])[-(1:2)]))),
         cols = cols_campo("% ASISTENCIA"))
  ), razones_control)

  .calg_tipar_fechas(wb, "Aulas Agendadas", hojas[["Aulas Agendadas"]],
                     cols_de(c("contact_date", "scheduled_date")), desde = 1L)
  .calg_tipar_numeros(wb, "Aulas Agendadas", hojas[["Aulas Agendadas"]],
                      cols_de(c("enrolled_total", "eligible_n", "contact_attempts")),
                      desde = 1L)
  .calg_tipar_numeros(wb, "Aulas Aplicadas (Campo)", hojas[["Aulas Aplicadas (Campo)"]],
                      cols_campo(c(.calg_campo_numeros(), "% ASISTENCIA")), desde = 2L)
  .calg_tipar_numeros(wb, "Base de control", hojas[["Base de control"]],
                      c(cols_control, cols_control_pct,
                        vapply(razones_control, function(r) r$cols, integer(1))),
                      desde = 2L)

  campos_bloque <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  aulas_libro_aplicar_formato(
    wb,
    filas_cabecera = list(`Aulas Agendadas` = 1L, `Aulas Aplicadas (Campo)` = 2L, `Base de control` = 2L),
    validaciones = validaciones,
    listas = listas,
    columnas_app = list(`Aulas Agendadas` = aulas_libro_columnas_de_la_app(
      campos_bloque, AULAS_LIBRO_CAMPOS_DE_LA_PERSONA, profundidad,
      ancho = AULAS_AGENDADAS_ANCHO_BLOQUE, desplazamiento = 1L
    )),
    # Un grupo plegable por cada bloque de reemplazo. El titular —el primer
    # bloque— se queda fuera: es la fila que se trabaja siempre y plegarla no
    # tendria sentido. Con once reservas, la hoja pasa de 241 columnas a 21
    # visibles en un clic.
    agrupados = if (profundidad > 1L) lapply(2:profundidad, function(b) list(
      hoja = "Aulas Agendadas",
      cols = seq(
        1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + 1L,
        1L + b * AULAS_AGENDADAS_ANCHO_BLOQUE
      )
    )) else list(),
    # El tinte y el borde de CADA eslabon, titular incluido: `agrupados` solo
    # trae los reemplazos —el titular no se pliega— pero el color si es de los
    # doce.
    tintes = c(
      lapply(seq_len(profundidad), function(b) list(
        hoja = "Aulas Agendadas", desde = 1L, filas = filas_agenda, eslabon = b,
        cols = seq(1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + 1L,
                   1L + b * AULAS_AGENDADAS_ANCHO_BLOQUE)
      )),
      # La hoja de campo tiene los mismos eslabones y salia con los tres
      # bloques en el mismo navy: la banda los nombraba pero el color no los
      # distinguia. `pinta_banda`, porque aqui la fila 1 es la banda y la pinta
      # este bucle —el de `agrupados` solo cubre la agenda—.
      lapply(seq_len(intentos_campo), function(b) list(
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
    columnas_repetidas = list(
      `Aulas Agendadas` = col_en_bloque("operational_code", 1L),
      # Misma idea en la hoja de campo: su bloque es
      # `ID MATCH + titulos_agenda + titulos_campo`, y el codigo va segundo
      # dentro de los titulos de agenda.
      `Aulas Aplicadas (Campo)` = 1L + which(.calg_titulos_agenda() == "CURSO-HORARIO"),
      # Y en la «Base de control» la primera columna es `MUESTRA` —la ola—, que
      # se repite en cientos de filas: sus paginas salian rotuladas «M1» y sin
      # decir de que aula hablan. Se repite hasta `CURSO-HORARIO`.
      `Base de control` = .calg_col_control("CURSO-HORARIO")
    ),
    # Las bandas de grupo de la hoja de campo: una por intento.
    # La regla de cuadre del parte, una por intento: las efectivas no pueden
    # superar a los asistentes menos rechazos y duplicados.
    descuadres = lapply(seq_len(intentos_campo), function(b) list(
      hoja = "Aulas Aplicadas (Campo)", desde = 2L,
      filas = max(0L, filas_aplicadas),
      asistentes = col_campo("CANTIDAD DE ASISTENTES", b),
      rechazos = col_campo("CANTIDAD DE RECHAZOS", b),
      duplicados = col_campo("DUPLICADOS (YA RESPONDIERON)", b),
      efectivas = col_campo("CANTIDAD DE EFECTIVAS", b)
    )),
    combinar = c(
      lapply(seq_len(intentos_campo), function(b) list(
        hoja = "Aulas Aplicadas (Campo)", fila = 1L,
        cols = seq((b - 1L) * ancho_campo + 1L, b * ancho_campo)
      )),
      # Los cuatro tramos de la base de control tenian el mismo hueco: la
      # etiqueta en su primera celda y el resto del tramo en blanco.
      lapply(aulas_libro_grupos_control(), function(g) list(
        hoja = "Base de control", fila = 1L, cols = seq(g$desde, g$hasta)
      ))
    )
  )
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
