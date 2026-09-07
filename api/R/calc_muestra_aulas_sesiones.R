# calc_muestra_aulas_sesiones.R — el día, la hora y el aula que ya se sabían.
#
# La ficha que el aplicador lleva al aula tiene tres casillas que salían en
# blanco —«Pabellón y aula», «Horario del curso» y, con ellas, el curso y el
# docente— con el argumento de que «aquí casi ningún dato existe antes de entrar
# al aula». Para el pabellón y el horario eso no es cierto: el catálogo de
# cursos-horarios trae la columna `SESIONES`, que dice exactamente cuándo y
# dónde.
#
# Medido el 2026-08-27 sobre el libro de HSVG2026 (`207915-Cursos-Horarios
# 2026-2.xlsx`): **21.210 filas con dato**, que dan **30.207 sesiones sueltas**
# una vez separadas por `<br />`. Las **30.207 de 30.207** casan la misma
# gramática:
#
#     DIA HH:MM-HH:MM  <tipo>  [aula]
#     "MIE 17:00-20:00 C  A506"     -> miércoles de 5 a 8, aula A506
#     "MAR 10:00-12:00 C"           -> sin aula asignada
#     "LUN 16:00-18:00 C  L101<br />MIE 16:00-18:00 C  L220"  -> dos sesiones
#
# El `<tipo>` es la letra de tipo de sesión (C, H, I…), no el aula, y por eso se
# descarta: imprimir «C» bajo el rótulo «Pabellón y aula» sería peor que dejar la
# raya en blanco.
#
# Vive aparte porque `calc_muestra_aulas.R` está congelado a crecimiento; allí
# sólo quedan los enganches.

# El catálogo escribe `0000` donde no hay aula asignada. No es un aula: es el
# hueco con forma de dato, y llega a la ficha impresa como si lo fuera.
.CM_AULAS_SESION_SIN_AULA <- c("0000", "000", "-", "S/A", "N/A")

# El separador de sesiones no es uno solo: depende de quién armó la consulta.
# HSVG2026 (solicitud 207915) llegó con el `<br />` crudo de la base. CCSS Perfil
# (solicitud 212139, 07/09/2026) llega con `REPLACE(hdc.sesiones,'<br />',' - ')`
# ya aplicado DENTRO del SQL de la DTI, así que la misma columna trae « - ».
# Cortar sólo por `<br />` dejaba la cadena entera como una sesión:
# «LUN 10:00-12:00 C  H101 - MIE 10:00-12:00 C  H101» salía con aula
# «H101 - MIE 10:00-12:00 C H101» —treinta caracteres de basura bajo el rótulo
# «Pabellón y aula»— y perdía el miércoles. Medido sobre CCSS: 7.387 de 20.448
# filas traen más de una sesión, y 1.220 curso-horario del marco quedaban así.
#
# El corte por « - » va con lookahead de DIA HH:MM para no partir un aula que
# lleve un guion en el nombre: sólo separa cuando lo que sigue vuelve a ser una
# sesión. El `<br />` se sigue aceptando; las dos bases conviven.
.CM_AULAS_SESION_SEP <- paste0(
  "<br\\s*/?>",
  "|\\s+-\\s+(?=(LUN|MAR|MIE|JUE|VIE|SAB|DOM)\\s+[0-9]{1,2}:[0-9]{2})"
)

# Las sesiones de EVALUACIÓN no son aulas donde se pueda aplicar nada.
# El catálogo de HSVG salía de la matrícula con `indicaprinci = '1'`, así que
# sólo traía el horario principal: ni una de sus 29.328 sesiones empieza por E.
# El de CCSS sale de la OFERTA (`horarios.horardcurcic`) sin ese filtro, y trae
# los horarios de examen como filas propias: E, E1..E9, EE, EF, EG, EP, ER.
# Son 3.918 filas de sólo evaluación y 417 mixtas sobre 18.876 con dato.
# Mandar al aplicador al aula de un examen parcial es enviarlo a un aula donde
# nadie va a responder nada.
.CM_AULAS_SESION_EVALUACION_RX <- "^E([A-Z]|[0-9]+)?$"

#' Trocea la cadena `SESIONES` en sesiones sueltas.
#' @keywords internal
.cm_aulas_sesiones_trozos <- function(x) {
  trozos <- trimws(unlist(strsplit(x, .CM_AULAS_SESION_SEP, perl = TRUE)))
  trozos[nzchar(trozos)]
}

#' Quita las sesiones de evaluación, pero sólo si queda alguna otra.
#'
#' La poda es una PREFERENCIA, no un filtro: una fila que es toda evaluación
#' conserva sus sesiones. Perder el dato sería peor que tenerlo desordenado, y
#' quien decide si esa fila entra al marco es el criterio de aulas, no el parser.
#' @keywords internal
.cm_aulas_sesiones_podar_evaluacion <- function(partes) {
  if (!length(partes)) return(partes)
  es_eval <- vapply(partes, function(p) {
    grepl(.CM_AULAS_SESION_EVALUACION_RX, toupper(p$tipo %||% ""))
  }, logical(1))
  if (!any(es_eval) || all(es_eval)) return(partes)
  partes[!es_eval]
}

# Se tokeniza por espacios en vez de resolverlo con una sola expresión regular.
# La versión regular dejaba el aula como «C  L401» —la letra de tipo pegada al
# aula— porque los cuantificadores opcionales alrededor del tipo son ambiguos y
# el motor los resolvía a favor del grupo equivocado. Con tokens, cada posición
# dice lo que es y el fallo se ve en el acto.
.cm_aulas_sesion_partes <- function(sesion) {
  x <- trimws(as.character(sesion %||% "")[1])
  if (is.na(x) || !nzchar(x)) return(list(horario = "", aula = "", tipo = ""))
  tk <- strsplit(x, "\\s+")[[1]]
  tk <- tk[nzchar(tk)]
  dia_ok <- length(tk) >= 2L && grepl("^[A-Za-z]{3}$", tk[[1]])
  rango_ok <- length(tk) >= 2L && grepl("^[0-9]{1,2}:[0-9]{2}-[0-9]{1,2}:[0-9]{2}$", tk[[2]])
  # Sin la gramática esperada no se inventa una lectura: el string entero pasa
  # como horario, que es literalmente lo que el catálogo dijo, y el aula queda
  # vacía en vez de recibir un trozo elegido a ojo.
  if (!dia_ok || !rango_ok) return(list(horario = x, aula = "", tipo = ""))
  # tk[3] es la letra de tipo de sesión (C, H, I…); el aula es lo que sigue.
  # El tipo se devuelve —ya no sólo se descarta— porque es lo único que separa
  # una clase de un examen cuando el catálogo no trae la columna TIPOHORARIO.
  tipo <- if (length(tk) >= 3L) toupper(tk[[3]]) else ""
  aula <- if (length(tk) >= 4L) paste(tk[-seq_len(3L)], collapse = " ") else ""
  if (toupper(trimws(aula)) %in% .CM_AULAS_SESION_SIN_AULA) aula <- ""
  list(horario = paste(toupper(tk[[1]]), tk[[2]]), aula = trimws(aula), tipo = tipo)
}

.cm_aulas_sesiones_unir <- function(valores) {
  v <- trimws(as.character(valores %||% character(0)))
  v <- unique(v[!is.na(v) & nzchar(v)])
  if (!length(v)) return("")
  paste(v, collapse = " · ")
}

# Orden de la semana, no alfabético: «LUN y MIE» y no «MIE y LUN».
.CM_AULAS_DIAS <- c("LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM")

#' Agrupa los días que comparten franja horaria.
#'
#' Un curso-horario con dos sesiones venía como
#' `"MIE 11:00-13:00 · VIE 11:00-13:00"`: la hora repetida dos veces para decir
#' una sola cosa. Con cuatro sesiones llegaba a **87 caracteres** y la ficha lo
#' recortaba con elipsis, o sea que el aplicador perdía días.
#'
#' Medido sobre las 1.512 unidades de HSVG2026: **977 tienen una sola sesión**
#' (no cambian), **525 tienen dos**, 8 tienen tres y 2 tienen cuatro o más. El
#' grueso del ahorro está en esas 525, que pasan a una franja con dos días.
#'
#' La conjunción va en español —«LUN y MIE», «LUN, MAR y MIE»— porque esto se
#' lee en un papel, no se parsea.
#'
#' @param sesiones vector de `"DIA HH:MM-HH:MM"` ya normalizados.
#' @return una cadena; franjas separadas por « · », en el orden en que aparecen.
#' @keywords internal
.cm_aulas_agrupar_horario <- function(sesiones) {
  v <- trimws(as.character(sesiones %||% character(0)))
  v <- v[!is.na(v) & nzchar(v)]
  if (!length(v)) return("")
  partes <- regmatches(v, regexec("^(\\S+)\\s+(.*)$", v))
  # Lo que no tenga la forma «DIA resto» se deja tal cual: inventarle una
  # agrupación a un texto libre («A CONVENIR CON EL DOCENTE») sería peor.
  ok <- vapply(partes, function(m) length(m) == 3L, logical(1))
  if (!all(ok)) return(.cm_aulas_sesiones_unir(v))

  dia <- vapply(partes, function(m) m[[2]], character(1))
  franja <- vapply(partes, function(m) m[[3]], character(1))
  salida <- character(0)
  for (f in unique(franja)) {
    dias <- unique(dia[franja == f])
    conocidos <- match(dias, .CM_AULAS_DIAS)
    # Un día que no está en el calendario conserva su sitio de entrada en vez de
    # irse al final: no se sabe dónde va, así que no se le inventa un orden.
    if (!anyNA(conocidos)) dias <- dias[order(conocidos)]
    etiqueta <- if (length(dias) == 1L) {
      dias
    } else {
      paste(paste(utils::head(dias, -1L), collapse = ", "), "y", dias[[length(dias)]])
    }
    salida <- c(salida, paste(etiqueta, f))
  }
  paste(unique(salida), collapse = " · ")
}

#' Descompone el `SESIONES` de un curso-horario en horario y aula.
#'
#' @param sesiones cadena del catálogo, con una o varias sesiones separadas por
#'   `<br />`.
#' @return lista con `horario` («MIE 17:00-20:00») y `aula` («A506»); varias
#'   sesiones se unen con « · » y sin repetir. Ambos pueden venir vacíos: un
#'   curso sin aula asignada existe, y su casilla vuelve a ser una raya.
#' @export
calc_muestra_aulas_sesiones_partes <- function(sesiones) {
  x <- trimws(as.character(sesiones %||% "")[1])
  if (is.na(x) || !nzchar(x)) return(list(horario = "", aula = ""))
  trozos <- .cm_aulas_sesiones_trozos(x)
  if (!length(trozos)) return(list(horario = "", aula = ""))
  partes <- .cm_aulas_sesiones_podar_evaluacion(lapply(trozos, .cm_aulas_sesion_partes))
  list(
    horario = .cm_aulas_agrupar_horario(vapply(partes, function(p) p$horario, character(1))),
    aula = .cm_aulas_sesiones_unir(vapply(partes, function(p) p$aula, character(1)))
  )
}

#' Cada sesión completa —día, horario y aula— sin cruzar el apareamiento.
#'
#' Es la forma que pide la hoja del agendador (B15): «a veces pueden ser dos
#' días en pabellones distintos con horarios diferentes». Las dos columnas de
#' arriba NO sirven para reconstruirla: `aula` deduplica («L101 · A506») y
#' `horario` agrupa días por franja, así que el emparejo día↔aula se pierde —
#' y ponerle al docente el aula del otro día es exactamente «jalar mal» el
#' dato. Aquí cada sesión sale entera y en su orden:
#' `"LUN 16:00-18:00 L101 · MIE 17:00-20:00 A506"`.
#'
#' @param sesiones cadena `SESIONES` del catálogo (separador `<br />`).
#' @return una cadena; sesiones separadas por « · », vacía si no hay dato.
#' @export
calc_muestra_aulas_sesiones_legible <- function(sesiones) {
  x <- trimws(as.character(sesiones %||% "")[1])
  if (is.na(x) || !nzchar(x)) return("")
  trozos <- .cm_aulas_sesiones_trozos(x)
  if (!length(trozos)) return("")
  partes <- .cm_aulas_sesiones_podar_evaluacion(lapply(trozos, .cm_aulas_sesion_partes))
  legibles <- vapply(partes, function(p) {
    # `paste` y `trimws`: una sesión sin aula asignada queda como su horario a
    # secas, no con un espacio colgando.
    trimws(paste(p$horario, p$aula))
  }, character(1), USE.NAMES = FALSE)
  .cm_aulas_sesiones_unir(legibles)
}

#' Vector a vector, para anotar una tabla entera.
#'
#' @param sesiones vector de cadenas `SESIONES`.
#' @param parte `"horario"` o `"aula"`.
#' @return vector de caracteres del mismo largo.
#' @export
calc_muestra_aulas_sesiones_columna <- function(sesiones, parte = c("horario", "aula")) {
  parte <- match.arg(parte)
  v <- as.character(sesiones %||% character(0))
  if (!length(v)) return(character(0))
  vapply(v, function(x) calc_muestra_aulas_sesiones_partes(x)[[parte]], character(1), USE.NAMES = FALSE)
}

#' Anota `venue` y `sesiones_dia_hora` en la base, desde el catálogo.
#'
#' Se llama desde `.cm_aulas_enrich_with_catalog()`, con las claves ya
#' calculadas. Sigue el mismo contrato que el resto del enriquecido: **sólo
#' rellena donde no había dato**, para que una base que ya trae su propia
#' columna de aula mande sobre el catálogo.
#'
#' **Los nombres de estas dos columnas no son decorativos.** La primera versión
#' las llamó `pabellon_aula` y `horario_sesiones`, que es como se llaman en el
#' Sheet de 2025, y el aula se coló donde no debía: `mapping$classroom_label`
#' lleva el alias `aula`, y `.cm_aulas_col()` acepta que el nombre de la columna
#' esté CONTENIDO en el candidato, así que `pabellon_aula` fue capturada como si
#' fuera la etiqueta del aula. Consecuencia visible: `label` dejó de ser el
#' código académico y las 1.512 fichas pasaron a titularse «A501» y a llamarse
#' `CH 1 - A501.pdf` en vez de `CH 1 - MAT202_0591.pdf`.
#'
#' `venue` y `sesiones_dia_hora` están elegidos para no casar con ningún alias de
#' otro rol —ni con `classroom_label`, ni con `schedule`, ni con `session_type`—
#' y hay una prueba que lo sella. Antes de renombrarlas, comprobar eso.
#'
#' @param raw base madre ya limpia.
#' @param catalogo catálogo de cursos-horarios ya limpio.
#' @param raw_key,catalog_key claves de cruce de una y otro.
#' @param mapping mapeo vigente; de él sale qué columna es `SESIONES`.
#' @return `raw` con las dos columnas añadidas.
#' @export
calc_muestra_aulas_anotar_sesiones <- function(raw, catalogo, raw_key, catalog_key, mapping) {
  if (!is.data.frame(raw) || !nrow(raw)) return(raw)
  if (!is.data.frame(catalogo) || !nrow(catalogo)) return(raw)
  col <- .cm_aulas_col(catalogo, c(
    mapping$classroom_label, "SESIONES", "sesiones", "sesiones_y_aula", "horario_y_aula"
  ))
  if (!nzchar(col)) return(raw)
  valores <- .cm_aulas_values(catalogo, col, "")
  lookup_de <- function(partes) {
    keys <- catalog_key[nzchar(catalog_key) & nzchar(partes)]
    vals <- partes[nzchar(catalog_key) & nzchar(partes)]
    if (!length(keys)) return(character(0))
    vapply(split(vals, keys), .cm_aulas_mode, character(1), default = "")
  }
  lookup <- function(parte) lookup_de(calc_muestra_aulas_sesiones_columna(valores, parte))
  raw <- .cm_aulas_fill_from_lookup(raw, raw_key, "venue", lookup("aula"))
  raw <- .cm_aulas_fill_from_lookup(raw, raw_key, "sesiones_dia_hora", lookup("horario"))
  # La tercera columna conserva el APAREAMIENTO dia↔aula que las otras dos
  # pierden (B15): es la que la hoja «SESIONES Y AULA» del libro prefiere.
  # `sesiones_legibles` sigue la misma regla de nombre que sus hermanas: no
  # casa con ningun alias de otro rol del mapeo (ver la nota de arriba).
  .cm_aulas_fill_from_lookup(
    raw, raw_key, "sesiones_legibles",
    lookup_de(vapply(valores, calc_muestra_aulas_sesiones_legible,
                     character(1), USE.NAMES = FALSE))
  )
}
