# calc_muestra_aulas_periodo.R — de qué semestre es el marco.
#
# **El marco no declaraba su periodo, y eso costó un estudio entero.**
#
# Medido el 2026-08-24 sobre el proyecto real del estudio HSVG 2026: el
# `.pulso` llamado `HSVG2026.pulso` tenía cargada la **base de 2025**
# —`2025.00507905 BD estudiantes y curso-horario` y
# `HSVBG2025_referencia_para_motor.xlsx`—, calculaba sin protestar, y el único
# síntoma era un aviso genérico de distribución incompatible y unas cifras fuera
# de rango (269 y 431 cursos-horario donde el diseño pide entre 170 y 210).
#
# La diferencia no es cosmética. Contra la base correcta (2026-2):
#
#   ARTE Y DISEÑO       63 cursos-horario elegibles  ->  228
#   ARTES ESCÉNICAS     45                           ->   92
#   CIENCIAS SOCIALES  169                           ->  140
#   ESCUELA DE POSGRADO  2                           ->    0
#
# Con la base vieja, Arte y Diseño casi desaparece del muestreo. Y nada en la
# pantalla decía de qué semestre era lo que se estaba mirando: `aula_frame` no
# tenía columna de periodo y el marco sólo guardaba `generated_at`, que es
# cuándo se construyó, no de cuándo son los datos. Son dos fechas distintas y
# sólo una responde «¿esto es del semestre del estudio?».
#
# Vive aparte porque `calc_muestra_aulas.R` está congelado a crecimiento y hoy
# está EXACTAMENTE en su línea base: el router llama con una línea.

#' El periodo académico que declara una base del DTI.
#'
#' Dos fuentes, en este orden, porque fallan de formas distintas:
#'
#' 1. **La cabecera de la propia hoja.** Los reportes del DTI abren con un
#'    título —«Reporte de Cursos Horarios 2026-2»— y ése es el dato más fiable
#'    que existe: lo escribe quien emite la base, no quien la guarda.
#' 2. **El nombre del archivo.** Sobrevive a que la hoja no traiga título y es
#'    lo único que queda cuando la base se renombró a mano.
#'
#' Se reconoce `2026-2`, `2026-II`, `2026 2` y `2026.2`. **Lo que no se
#' reconoce devuelve vacío**, nunca un año inventado: declarar mal el periodo es
#' peor que no declararlo, porque un aviso que miente entrena a ignorarlo.
#'
#' @param texto cabecera o nombre de archivo.
#' @return el periodo normalizado como `"2026-2"`, o `""`.
#' @export
calc_muestra_aulas_periodo_de_texto <- function(texto) {
  t <- toupper(paste(as.character(texto %||% ""), collapse = " "))
  if (!nzchar(trimws(t))) return("")
  # El año va primero y el ciclo detrás, separados por poco: así «207915-Cursos
  # 2026-2» acierta y un identificador largo como «2025.00507905» no se lee como
  # «2025-0» —ese 0 no es un ciclo—.
  m <- regmatches(t, regexpr("(20[0-9]{2})\\s*[-. ]\\s*(I{1,3}|[12])(?![0-9])", t, perl = TRUE))
  if (length(m) && nzchar(m[[1]])) {
    anio <- sub("^.*?(20[0-9]{2}).*$", "\\1", m[[1]])
    ciclo <- sub("^.*[-. ]\\s*", "", m[[1]])
    ciclo <- switch(ciclo, "I" = "1", "II" = "2", "III" = "3", ciclo)
    return(paste0(anio, "-", ciclo))
  }
  # Sin ciclo legible, el año solo ya distingue una base de otro año, que es el
  # error que esto existe para atrapar.
  a <- regmatches(t, regexpr("20[0-9]{2}", t))
  if (length(a) && nzchar(a[[1]])) return(a[[1]])
  ""
}

#' Anota en el marco de qué periodo son sus datos.
#'
#' Mira los archivos que la sesión tiene cargados y se queda con el periodo del
#' que parece la base de cursos-horario; si ninguno lo declara, con el de
#' cualquier base. Deja también **de dónde salió** (`periodo_origen`): un
#' periodo sin procedencia no se puede discutir, y quien lea la ficha tiene que
#' poder decir «esto lo sacó del nombre del archivo, voy a comprobarlo».
#'
#' No falla ni bloquea: un marco sin periodo detectable se queda como estaba.
#' Este archivo hace visible un dato que faltaba, no añade una puerta nueva por
#' la que un estudio pueda quedarse fuera.
#'
#' @param frame el marco recién construido.
#' @param archivos `s$files` de la sesión.
#' @return el marco con `periodo` y `periodo_origen`.
#' @export
calc_muestra_aulas_declarar_periodo <- function(frame, archivos = list()) {
  if (!is.list(frame)) return(frame)
  nombres <- character(0)
  if (is.list(archivos)) {
    for (f in archivos) {
      n <- if (is.list(f)) as.character(f$original_name %||% "")[1] else as.character(f)[1]
      if (nzchar(n %||% "")) nombres <- c(nombres, n)
    }
  }
  if (!length(nombres)) return(frame)

  # La base de cursos-horario manda: es la que define el catálogo del marco.
  # Una base de matriculados de otro periodo es un problema distinto —y también
  # lo delata este mismo campo cuando alguien los compara—.
  es_ch <- grepl("curso", nombres, ignore.case = TRUE)
  orden <- c(nombres[es_ch], nombres[!es_ch])
  for (n in orden) {
    p <- calc_muestra_aulas_periodo_de_texto(n)
    if (nzchar(p)) {
      frame$periodo <- p
      frame$periodo_origen <- sprintf("nombre del archivo: %s", n)
      return(frame)
    }
  }
  frame
}

#' Si el periodo del marco cuadra con el que el estudio dice ser.
#'
#' Compara sólo el AÑO y sólo cuando los dos existen: el ciclo puede
#' legítimamente no estar en el nombre del estudio, y un aviso que salta por eso
#' se vuelve ruido. Devuelve `NA` cuando no hay con qué comparar — no se afirma
#' que cuadra lo que no se pudo mirar.
#'
#' @param periodo_marco `"2026-2"` o `""`.
#' @param nombre_estudio nombre del proyecto o del estudio.
#' @return `TRUE`, `FALSE` o `NA`.
#' @export
calc_muestra_aulas_periodo_cuadra <- function(periodo_marco, nombre_estudio) {
  pm <- calc_muestra_aulas_periodo_de_texto(periodo_marco)
  pe <- calc_muestra_aulas_periodo_de_texto(nombre_estudio)
  if (!nzchar(pm) || !nzchar(pe)) return(NA)
  identical(substr(pm, 1, 4), substr(pe, 1, 4))
}
