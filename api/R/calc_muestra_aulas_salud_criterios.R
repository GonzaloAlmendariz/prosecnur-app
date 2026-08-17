#' Un criterio declarado que no puede evaluarse tiene que decirlo
#'
#' El mismo defecto ha vuelto cuatro veces, siempre igual: un criterio declarado
#' sobre una columna que no lleva lo que dice, y nadie se entera.
#'
#' - `exclude_level_patterns` buscaba «posgrado» en `level`, que en las bases
#'   reales es un NÚMERO DE CICLO: no excluía **ni una** aula (E3).
#' - `session_type` llegaba **vacío en las 5.263 aulas** porque la columna real
#'   se llama «Tipo Curso» y no estaba entre los candidatos: el criterio que
#'   define el marco no podía declararse.
#' - `teacher_type` publicó **nombres propios como categorías** —«FERNANDEZ
#'   SANTA MARIA, XAVIER»— y el criterio recortó por docente concreto.
#' - Un `.pulso` guardado congelaba los candidatos del motor, así que ampliar los
#'   defaults no arreglaba ningún proyecto existente.
#'
#' En los cuatro casos el motor siguió adelante y publicó un marco. Un criterio
#' que no muerde es indistinguible de uno que muerde y no deja fuera a nadie, y
#' eso es lo que hay que romper.
#'
#' `criterios_alumno_report` ya distingue «no evaluable» de «no recorta», pero
#' **sólo para los criterios de alumno** (`if (!identical(crit$scope, "alumno"))
#' next`). Los de AULA —modalidad, tipo de sesión, tipo de docente, nivel del
#' curso, condición del curso, sede y matrícula— no tenían nada, y son
#' exactamente los que fallaron.
#'
#' Esto se deriva al servir, no se persiste: así no puede quedar desfasado del
#' marco vigente y se calcula sobre el marco que el analista está mirando.
#'
#' @keywords internal
NULL

#' Columna del marco donde vive cada criterio de aula
#'
#' El id del criterio no siempre es el nombre de la columna: `course_level` vive
#' en `course_level_num`.
#'
#' @keywords internal
.cm_aulas_salud_columna <- function(id) {
  switch(id, course_level = "course_level_num", teacher_type = "teacher_type", id)
}

#' Valores no vacíos de un vector de texto
#' @keywords internal
.cm_aulas_salud_con_valor <- function(x) {
  if (is.null(x)) return(logical(0))
  v <- trimws(as.character(x))
  !is.na(v) & nzchar(v) & !(toupper(v) %in% c("NA", "NULL", "SIN DATO"))
}

#' Categorías declaradas por un criterio, incluidas las de sus excepciones
#'
#' Una excepción por facultad declara categorías propias y también hay que
#' comprobarlas: si ninguna existe en el dato, esa facultad no está filtrando
#' por lo que cree.
#'
#' @keywords internal
.cm_aulas_salud_declaradas <- function(crit) {
  base <- .cm_aulas_chr_vec(crit$categories)
  exc <- crit$exceptions
  if (is.list(exc)) {
    for (e in exc) base <- c(base, .cm_aulas_chr_vec(e$categories))
  }
  unique(.cm_aulas_text_key(base[nzchar(base)]))
}

#' Estado de salud de un criterio de aula
#'
#' `sin_senal` es peor que `sin_coincidencia`: no hay ni con qué evaluar.
#'
#' @keywords internal
.cm_aulas_salud_estado <- function(con_valor, total, declaradas, presentes,
                                   numerico = FALSE) {
  if (!is.finite(total) || total <= 0L) return("desconocido")
  if (con_valor <= 0L) return("sin_senal")
  # Un criterio numérico no declara categorías: declara un umbral. Pedirle
  # categorías produciría un «sin_categorias» falso en cada uno de ellos, y un
  # aviso falso desacredita a los demás.
  if (isTRUE(numerico)) return("ok")
  if (!length(declaradas)) return("sin_categorias")
  if (!length(presentes)) return("sin_coincidencia")
  if (length(presentes) < length(declaradas)) return("parcial")
  "ok"
}

#' Aviso legible, con las cifras que lo justifican
#' @keywords internal
.cm_aulas_salud_aviso <- function(estado, label, columna, con_valor, total,
                                  declaradas, presentes) {
  switch(
    estado,
    sin_senal = sprintf(
      paste("«%s» está declarado pero su columna (%s) llega vacía en las %s",
            "aulas del marco: el criterio no puede filtrar a nadie y no es que",
            "deje pasar a todos."),
      label, columna, format(total)
    ),
    sin_coincidencia = sprintf(
      paste("«%s» declara %s categorías y NINGUNA aparece en la columna %s,",
            "que sí trae dato en %s de %s aulas: se está filtrando por valores",
            "que la base no usa."),
      label, format(length(declaradas)), columna, format(con_valor), format(total)
    ),
    parcial = sprintf(
      paste("«%s» declara %s categorías y sólo %s aparecen en el marco;",
            "las otras %s no existen en la base."),
      label, format(length(declaradas)), format(length(presentes)),
      format(length(declaradas) - length(presentes))
    ),
    sin_categorias = sprintf(
      "«%s» está declarado sin ninguna categoría: no restringe nada.", label
    ),
    ""
  )
}

#' Salud de los criterios de AULA sobre el marco vigente
#'
#' @param frame Marco de aulas construido.
#' @param config Config normalizada; de ahí sale `criterios_seleccion`.
#' @return Lista con una fila por criterio de aula declarado, cada una con su
#'   desglose por facultad. `NULL` si no hay marco o no hay criterios.
#' @keywords internal
calc_muestra_aulas_salud_criterios <- function(frame, config = NULL) {
  af <- if (is.list(frame)) frame$aula_frame else NULL
  if (!is.data.frame(af) || !nrow(af)) return(NULL)
  sel <- (config %||% list())$criterios_seleccion %||% frame$criterios_seleccion
  by <- (sel %||% list())$byVariable
  if (!is.list(by) || !length(by)) return(NULL)

  facs <- if ("faculty" %in% names(af)) as.character(af$faculty) else rep("", nrow(af))
  filas <- list()
  for (id in names(by)) {
    crit <- by[[id]]
    if (!is.list(crit) || !identical(crit$scope, "aula")) next
    columna <- .cm_aulas_salud_columna(id)
    presente_en_marco <- columna %in% names(af)
    vals <- if (presente_en_marco) af[[columna]] else NULL
    ok <- .cm_aulas_salud_con_valor(vals)
    total <- nrow(af)
    con_valor <- sum(ok)
    declaradas <- .cm_aulas_salud_declaradas(crit)
    presentes <- if (con_valor > 0L) {
      # Una categoría declarada "cuenta" si aparece dentro de algún valor: el
      # marco concatena varios docentes con « | », así que el match es por
      # subcadena sobre la clave normalizada, igual que hace el evaluador.
      claves <- .cm_aulas_text_key(as.character(vals)[ok])
      declaradas[vapply(declaradas, function(d) any(grepl(d, claves, fixed = TRUE)), logical(1))]
    } else character(0)
    numerico <- identical(crit$kind, "numeric")
    estado <- .cm_aulas_salud_estado(con_valor, total, declaradas, presentes, numerico)
    label <- .cm_aulas_scalar(crit$label, id)

    por_fac <- list()
    for (f in unique(facs[nzchar(facs)])) {
      idx <- facs == f
      por_fac[[length(por_fac) + 1L]] <- list(
        facultad = f,
        aulas = as.integer(sum(idx)),
        con_valor = as.integer(sum(ok[idx]))
      )
    }
    orden <- order(vapply(por_fac, function(x) x$con_valor / max(1L, x$aulas), numeric(1)))

    filas[[length(filas) + 1L]] <- list(
      criterion_id = id,
      label = label,
      columna = columna,
      columna_en_el_marco = isTRUE(presente_en_marco),
      aulas = as.integer(total),
      aulas_con_valor = as.integer(con_valor),
      kind = .cm_aulas_scalar(crit$kind, ""),
      categorias_declaradas = as.integer(length(declaradas)),
      categorias_presentes = as.integer(length(presentes)),
      categorias_ausentes = setdiff(declaradas, presentes),
      estado = estado,
      aviso = .cm_aulas_salud_aviso(estado, label, columna, con_valor, total,
                                    declaradas, presentes),
      por_facultad = por_fac[orden]
    )
  }
  if (!length(filas)) return(NULL)
  rango <- c("sin_senal", "sin_coincidencia", "sin_categorias", "parcial", "ok", "desconocido")
  filas <- filas[order(match(vapply(filas, function(x) x$estado, character(1)), rango))]
  list(
    schema = "calc_muestra_aulas_salud_criterios_v1",
    owner = "calc_muestra_aulas_frame_v1.salud_criterios",
    grain = "criterio",
    unit = "curso_horario",
    momento = "marco_ejecutado",
    filas = filas
  )
}
