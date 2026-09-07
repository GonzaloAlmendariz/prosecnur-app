# carga_disponibilidad_aplicadores.R — la disponibilidad de los aplicadores,
# leída del excel codificado (B29,
# docs/qa/checklist-operativo-aulas-2026-08-31.md).
#
# La base medida por el lead (hoja «Disponibilidad»): fila 1 = día («Lunes»…
# «Sábado», repetido por columna), fila 2 = franja de 1 hora con rótulos AM/PM
# («8:00-9:00am», «11:00am-12:00pm», «12:00-1:00pm» — el cruce del mediodía SIN
# am en la primera parte), filas 3+ = «Nombres» del aplicador + celdas 1/0.
#
# Contrato congelado en test-carga-disponibilidad-aplicadores.R:
# - lista de aplicadores `{nombre, dias}`; `dias` nombrada día → bloques
#   `{inicio, fin}` HH:MM de 24 horas, semántica [inicio, fin); franjas
#   contiguas con 1 se fusionan; bloques ascendentes.
# - clave de día minúscula y SIN tilde («sabado»), para no depender del tecleo
#   del rótulo ni del locale del proceso (patrón `.mav_DIAS`).
# - celda vacía o basura vale 0 con AVISO perseguible en `attr(, "avisos")`
#   (patrón carga_daa_iagen: se lee lo legible, se avisa lo que no); fila con
#   nombre vacío se salta; espacios dobles del nombre se colapsan.
# - errores registrados: E_DISPONIBILIDAD_APLICADORES_NO_EXISTE (400) y
#   E_DISPONIBILIDAD_APLICADORES_SIN_ESTRUCTURA (422) — errors_registry.R.
#
# Los nombres de la base real son PII: aquí solo vive el lector; ningún dato
# del cliente entra al repo.

# El catálogo pineado de claves de día: minúscula, sin tilde.
.cdisp_DIAS <- c("lunes", "martes", "miercoles", "jueves", "viernes",
                 "sabado", "domingo")

# El rótulo de día tecleado, a su clave pineada — o "" si no es un día.
# ASCII-fold ANTES de tolower: chartr sobre las vocales acentuadas no depende
# del locale, mientras que tolower("SÁBADO") sí dependería de él.
.cdisp_dia <- function(x) {
  v <- as.character(x %||% "")[1]
  if (is.na(v)) return("")
  v <- chartr("ÁÉÍÓÚáéíóú",
              "AEIOUaeiou", v)
  v <- tolower(trimws(v))
  if (v %in% .cdisp_DIAS) v else ""
}

# Los candidatos en minutos de una hora del rótulo. Con sufijo AM/PM la
# lectura es una sola; sin sufijo son las tres posibles (am, pm y 24 horas),
# porque «12:00-1:00pm» trae la primera parte desnuda y un «sin sufijo = am»
# ingenuo la mandaría a la medianoche. Se parsea con `.mav_hora_una` (B11):
# es el parser que ya sabe que 12pm es mediodía.
.cdisp_candidatos <- function(hora, sufijo) {
  if (nzchar(sufijo)) {
    v <- .mav_hora_una(paste0(hora, sufijo))
    return(if (is.na(v)) numeric(0) else v)
  }
  vals <- c(
    .mav_hora_una(paste0(hora, "am")),
    .mav_hora_una(paste0(hora, "pm")),
    .mav_hora_una(hora)
  )
  sort(unique(vals[!is.na(vals)]))
}

# El rótulo de franja («8:00-9:00am», «12:00-1:00pm») a `{ini, fin}` en
# minutos, o NULL si no parsea. Entre los pares candidatos válidos (fin > ini)
# gana el intervalo MÁS CORTO —las franjas de la base duran una hora, así que
# «12:00-1:00pm» resuelve [12:00, 13:00) y no [00:00, 13:00)— y en empate, el
# más temprano (determinista).
.cdisp_franja <- function(etiqueta) {
  x <- as.character(etiqueta %||% "")[1]
  if (is.na(x) || !nzchar(trimws(x))) return(NULL)
  x <- tolower(trimws(x))
  m <- regmatches(x, regexec(paste0(
    "^([0-9]{1,2}:[0-9]{2})[[:space:]]*(a\\.?m\\.?|p\\.?m\\.?)?",
    "[[:space:]]*-[[:space:]]*",
    "([0-9]{1,2}:[0-9]{2})[[:space:]]*(a\\.?m\\.?|p\\.?m\\.?)?$"
  ), x))[[1]]
  if (length(m) < 5L) return(NULL)
  cand_ini <- .cdisp_candidatos(m[[2]], m[[3]])
  cand_fin <- .cdisp_candidatos(m[[4]], m[[5]])
  mejor <- NULL
  for (a in cand_ini) {
    for (b in cand_fin) {
      if (b <= a) next
      if (is.null(mejor) || (b - a) < (mejor$fin - mejor$ini) ||
          ((b - a) == (mejor$fin - mejor$ini) && a < mejor$ini)) {
        mejor <- list(ini = a, fin = b)
      }
    }
  }
  mejor
}

# Una celda de disponibilidad: 1, 0, o NA cuando no es legible (vacía o
# basura). El llamador convierte el NA en 0 con aviso — se lee lo legible, se
# avisa lo que no.
.cdisp_celda <- function(celda) {
  v <- as.character(celda)[1]
  if (length(v) != 1L || is.na(v) || !nzchar(trimws(v))) return(NA_real_)
  n <- suppressWarnings(as.numeric(trimws(v)))
  if (length(n) == 1L && is.finite(n) && n %in% c(0, 1)) n else NA_real_
}

# Las franjas con 1 de un día, fusionadas: contiguas u honestamente solapadas
# se vuelven UN bloque [inicio, fin); lo separado queda separado. Salen en
# orden ascendente, en HH:MM (`.mav_hhmm`, la forma canónica de B11).
.cdisp_fusionar <- function(intervalos) {
  inis <- vapply(intervalos, function(x) x[[1L]], numeric(1))
  orden <- order(inis, method = "radix")
  bloques <- list()
  for (k in orden) {
    ini <- intervalos[[k]][[1L]]
    fin <- intervalos[[k]][[2L]]
    n <- length(bloques)
    if (n && ini <= bloques[[n]]$fin) {
      bloques[[n]]$fin <- max(bloques[[n]]$fin, fin)
    } else {
      bloques[[n + 1L]] <- list(ini = ini, fin = fin)
    }
  }
  lapply(bloques, function(b) {
    list(inicio = .mav_hhmm(b$ini), fin = .mav_hhmm(b$fin))
  })
}

#' Lee el excel de disponibilidad de los aplicadores.
#'
#' Hoja «Disponibilidad» (o la primera del libro): fila 1 = día por columna,
#' fila 2 = franja de una hora con rótulos AM/PM y el rótulo «Nombres» sobre
#' la columna de aplicadores, filas 3+ = nombre + celdas 1/0. Devuelve la
#' lista de aplicadores `{nombre, dias}` con `dias` nombrada por día en
#' minúscula sin tilde y bloques `{inicio, fin}` HH/MM de 24 horas, semántica
#' `[inicio, fin)`, franjas contiguas fusionadas.
#'
#' Tolerancias: celda vacía o basura vale 0 con aviso perseguible en
#' `attr(, "avisos")` (nombra al aplicador afectado); fila con nombre vacío se
#' salta; un rótulo de día sin valor hereda el de la columna anterior (celdas
#' combinadas del excel original).
#'
#' @param path ruta al `.xlsx` de disponibilidad.
#' @return lista de aplicadores; avisos en `attr(, "avisos")` (character,
#'   vacío si todo fue legible).
#' @export
carga_disponibilidad_aplicadores <- function(path) {
  if (!is.character(path) || length(path) != 1L || is.na(path) ||
      !nzchar(path) || !file.exists(path)) {
    stop_api(400, "E_DISPONIBILIDAD_APLICADORES_NO_EXISTE",
             "No se encontro el excel de disponibilidad de aplicadores.")
  }
  hojas <- tryCatch(openxlsx::getSheetNames(path), error = function(e) character(0))
  # **La lista FINAL manda sobre el borrador.** El directorio del operativo
  # llega con dos matrices: la hoja donde el equipo fue anotando a todo el que
  # respondió, y la hoja de los que efectivamente van a aplicar. Leer la
  # primera reparte trabajo entre gente que no va a venir: en HSVG 2026, el
  # 2026-09-04, eran 31 nombres contra los 24 de la lista final —cuatro con el
  # «CONFIRMÓ» en NO y tres que ya no figuraban—, y el reparto se los daba a
  # todos por igual. Por eso una hoja cuyo nombre se declara final gana, y
  # sólo si no la hay se cae a «Disponibilidad» y luego a la primera.
  finales <- hojas[grepl("final", hojas, ignore.case = TRUE)]
  hoja <- if (length(finales)) {
    finales[[1L]]
  } else if ("Disponibilidad" %in% hojas) {
    "Disponibilidad"
  } else if (length(hojas)) {
    hojas[[1L]]
  } else {
    ""
  }
  df <- if (nzchar(hoja)) {
    tryCatch(
      openxlsx::read.xlsx(path, sheet = hoja, colNames = FALSE,
                          skipEmptyRows = FALSE, skipEmptyCols = FALSE),
      error = function(e) NULL
    )
  } else {
    NULL
  }
  sin_estructura <- function() {
    stop_api(
      422, "E_DISPONIBILIDAD_APLICADORES_SIN_ESTRUCTURA",
      "La hoja de disponibilidad no trae la matriz dia x franja (fila 1 = dias, fila 2 = franjas con AM/PM).",
      details = list(hoja = hoja)
    )
  }
  if (is.null(df) || !is.data.frame(df) || nrow(df) < 2L || ncol(df) < 2L) {
    sin_estructura()
  }

  fila_dias <- as.character(unlist(df[1L, ], use.names = FALSE))
  fila_franjas <- as.character(unlist(df[2L, ], use.names = FALSE))

  # Columnas día×franja. El día se hereda hacia la derecha (celdas combinadas
  # del excel original dejan el rótulo solo en la primera columna del rango);
  # la columna de nombres se ubica por su rótulo «Nombres» en la fila 2, con
  # la primera columna como respaldo si nadie lo trae.
  col_nombres <- 0L
  # **La columna «Confirmó», si el libro la trae.**
  #
  # El directorio del operativo la usa para cerrar la convocatoria: quien no
  # confirma queda fuera de la tanda. Sin leerla, el reparto le da aulas a gente
  # que ya avisó que no viene, y eso no se descubre hasta que el aula se queda
  # sin aplicar. En HSVG 2026, el 2026-09-07, eran dos de veinticuatro.
  #
  # Sólo excluye el NO explícito. Una celda vacía no es una negativa: es un
  # libro que todavía no usa esa columna, y ahí el criterio de siempre —estar en
  # la hoja— sigue mandando.
  col_confirmo <- 0L
  columnas <- list()
  dia_actual <- ""
  for (j in seq_len(ncol(df))) {
    dia_rotulo <- .cdisp_dia(fila_dias[[j]])
    if (nzchar(dia_rotulo)) dia_actual <- dia_rotulo
    etiqueta <- fila_franjas[[j]]
    if (col_nombres == 0L && !is.na(etiqueta) &&
        grepl("nombre", tolower(etiqueta), fixed = TRUE)) {
      col_nombres <- j
      next
    }
    if (col_confirmo == 0L) {
      rotulo <- paste(tolower(trimws(c(fila_dias[[j]], etiqueta))), collapse = " ")
      rotulo <- chartr("áéíóú", "aeiou", rotulo)
      if (grepl("confirm", rotulo, fixed = TRUE)) {
        col_confirmo <- j
        next
      }
    }
    franja <- .cdisp_franja(etiqueta)
    if (is.null(franja) || !nzchar(dia_actual)) next
    columnas[[length(columnas) + 1L]] <- list(
      col = j, dia = dia_actual, ini = franja$ini, fin = franja$fin
    )
  }
  if (!length(columnas)) sin_estructura()
  if (col_nombres == 0L) col_nombres <- 1L

  avisos <- character(0)
  no_confirmados <- character(0)
  aplicadores <- list()
  if (nrow(df) >= 3L) {
    for (i in seq.int(3L, nrow(df))) {
      nombre <- as.character(df[i, col_nombres])[1]
      if (length(nombre) != 1L || is.na(nombre)) next
      nombre <- gsub("[[:space:]]+", " ", trimws(nombre))
      if (!nzchar(nombre)) next
      if (col_confirmo > 0L) {
        conf <- as.character(df[i, col_confirmo])[1]
        conf <- if (length(conf) != 1L || is.na(conf)) "" else tolower(trimws(conf))
        if (conf %in% c("no", "n", "false", "0")) {
          no_confirmados <- c(no_confirmados, nombre)
          next
        }
      }

      # **Una fila sin NINGUNA celda legible no es un aplicador: es el pie.**
      #
      # El libro del operativo cierra con «Síes totales: 22» en la columna de
      # nombres, y sin este corte esa fila entraba como una persona más —23 en
      # vez de 22— y arrastraba un aviso por cada una de las 84 franjas vacías,
      # que es como se entierra un aviso que sí importaba. Se declara en un
      # aviso, no se descarta en silencio: si la fila era de alguien que no
      # llenó nada, hay que verlo.
      legibles <- sum(vapply(columnas, function(colinfo) {
        !is.na(.cdisp_celda(df[i, colinfo$col]))
      }, logical(1)))
      if (legibles == 0L) {
        avisos <- c(avisos, sprintf(
          "La fila de %s no trae ninguna celda con 1 ni 0: se omite por no ser un aplicador.",
          nombre
        ))
        next
      }

      por_dia <- list()
      for (colinfo in columnas) {
        crudo <- df[i, colinfo$col]
        valor <- .cdisp_celda(crudo)
        if (is.na(valor)) {
          crudo_txt <- as.character(crudo)[1]
          crudo_txt <- if (length(crudo_txt) != 1L || is.na(crudo_txt) ||
                           !nzchar(trimws(crudo_txt))) {
            "vacia"
          } else {
            sprintf("«%s»", trimws(crudo_txt))
          }
          avisos <- c(avisos, sprintf(
            "La celda de %s (%s %s-%s) no es 1 ni 0 (venia %s): se toma como no disponible.",
            nombre, colinfo$dia, .mav_hhmm(colinfo$ini), .mav_hhmm(colinfo$fin),
            crudo_txt
          ))
          valor <- 0
        }
        if (valor == 1) {
          por_dia[[colinfo$dia]] <- c(
            por_dia[[colinfo$dia]], list(c(colinfo$ini, colinfo$fin))
          )
        }
      }

      dias <- list()
      for (d in .cdisp_DIAS) {
        if (!is.null(por_dia[[d]])) dias[[d]] <- .cdisp_fusionar(por_dia[[d]])
      }
      aplicadores[[length(aplicadores) + 1L]] <- list(nombre = nombre, dias = dias)
    }
  }

  attr(aplicadores, "avisos") <- avisos
  # Quiénes quedaron fuera por no confirmar viaja aparte de los avisos: no es
  # una celda ilegible que haya que perseguir, es una decisión del equipo que la
  # vista tiene que poder enseñar sin confundirla con un defecto del libro.
  attr(aplicadores, "no_confirmados") <- sort(unique(no_confirmados), method = "radix")
  aplicadores
}
