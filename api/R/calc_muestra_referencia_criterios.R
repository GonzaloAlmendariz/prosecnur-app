#' Referencia histórica de CRITERIOS, para comparar método y cuentas
#'
#' El proyecto ya ingiere una referencia del estudio anterior, pero es la de
#' **asistencia** —tasas por celda—. Para comparar criterios no sirve: medido en
#' HSVG2026, de las 269 anclas de `criterios_anclas_historicas` (grano
#' criterio × facultad) **252 dicen «incompatible» y sólo 17 traen dato**, todas
#' del mismo criterio (`enrolled_total`). Los otros catorce —tipo de docente,
#' tipo de sesión, modalidad, nivel, mínimo, formación, condición, facultad…—
#' tienen **cero** anclas.
#'
#' O sea: la estantería estaba y el dato no. Este módulo define la referencia que
#' faltaba, con las dos mitades que pidió Gonzalo:
#'
#' - **`general`**: el método del estudio anterior —qué criterios aplicó, con qué
#'   estadístico, qué n, qué sobremuestra, cómo sorteó y cuántas reservas—, que
#'   es lo que permite ver *si se aplicaron los mismos criterios*, no sólo si
#'   salen los mismos números.
#' - **`por_facultad`**: las cuentas de cada facultad —población, cuota por sexo,
#'   universo de aulas, aulas sorteadas, titulares, alumnos por curso-horario y
#'   el piso que rigió—, que es lo que alimenta la tarjeta de cada facultad.
#'
#' La referencia **se declara, no se deduce**: las cifras vienen del estudio
#' anterior y el motor las transporta sin recalcularlas. Lo que falte viaja como
#' `NA` y nunca como 0, porque un 0 se lee como «medido y vale cero».
#'
#' @keywords internal
NULL

CALC_MUESTRA_REFERENCIA_CRITERIOS_SCHEMA <- "calc_muestra_referencia_criterios_v1"

#' Campos numéricos que una fila por facultad puede traer
#' @keywords internal
.cm_ref_crit_campos <- c(
  "poblacion", "cuota", "cuota_mujeres", "cuota_hombres", "sobremuestra",
  "aulas_universo", "aulas_sorteadas", "aulas_titulares", "aulas_aplicadas",
  "alumnos_por_ch", "piso_matriculados", "efectivas_logradas",
  "asistentes"
)

#' Número declarado, o NA
#'
#' Nunca devuelve 0 por ausencia: un 0 se leería como una medición.
#'
#' @keywords internal
.cm_ref_crit_num <- function(x) {
  v <- suppressWarnings(as.numeric(.cm_aulas_scalar(x, NA)))
  if (length(v) != 1L || !is.finite(v)) NA_real_ else v
}

#' Normaliza una fila por facultad de la referencia histórica
#' @keywords internal
.cm_ref_crit_fila <- function(fila) {
  if (!is.list(fila) && !is.data.frame(fila)) return(NULL)
  etiqueta <- .cm_aulas_scalar(fila$facultad %||% fila$faculty %||% fila$label, "")
  if (!nzchar(etiqueta)) return(NULL)
  out <- list(
    faculty_key = .cm_aulas_scalar(.cm_criterios_fac_key(etiqueta), ""),
    facultad = etiqueta
  )
  for (campo in .cm_ref_crit_campos) out[[campo]] <- .cm_ref_crit_num(fila[[campo]])
  out
}

#' Normaliza la referencia histórica de criterios
#'
#' @param entrada Lista con `periodo`, `estudio`, `general` (lista de pares
#'   concepto/valor) y `por_facultad` (lista de filas o data.frame).
#' @return La referencia con schema, o `NULL` si no hay ninguna facultad
#'   utilizable — una referencia vacía se leería como «comparado y sin
#'   diferencias».
#' @keywords internal
calc_muestra_referencia_criterios_normalizar <- function(entrada) {
  if (!is.list(entrada)) return(NULL)
  crudas <- entrada$por_facultad %||% entrada$facultades
  if (is.data.frame(crudas)) {
    crudas <- lapply(seq_len(nrow(crudas)), function(i) as.list(crudas[i, , drop = FALSE]))
  }
  if (!is.list(crudas) || !length(crudas)) return(NULL)
  filas <- Filter(Negate(is.null), lapply(crudas, .cm_ref_crit_fila))
  if (!length(filas)) return(NULL)
  general <- entrada$general %||% entrada$metodo %||% list()
  if (!is.list(general)) general <- list()
  list(
    schema = CALC_MUESTRA_REFERENCIA_CRITERIOS_SCHEMA,
    owner = "estudio_historico_externo.criterios",
    momento = "estudio_anterior_ejecutado",
    periodo = .cm_aulas_scalar(entrada$periodo, ""),
    estudio = .cm_aulas_scalar(entrada$estudio %||% entrada$label, ""),
    grain = "facultad",
    general = general,
    por_facultad = filas
  )
}

#' Fila de la referencia para una facultad, por clave normalizada
#' @keywords internal
.cm_ref_crit_buscar <- function(referencia, facultad) {
  filas <- (referencia %||% list())$por_facultad
  if (!is.list(filas) || !length(filas)) return(NULL)
  clave <- .cm_aulas_scalar(.cm_criterios_fac_key(facultad), "")
  for (f in filas) if (identical(f$faculty_key, clave)) return(f)
  NULL
}

#' Diferencia entre lo de hoy y lo del estudio anterior
#'
#' Devuelve `NA` cuando falta cualquiera de los dos lados: sin referencia no hay
#' diferencia que reportar, y publicar un 0 sería inventarla.
#'
#' @keywords internal
.cm_ref_crit_delta <- function(hoy, antes) {
  a <- .cm_ref_crit_num(hoy); b <- .cm_ref_crit_num(antes)
  if (!is.finite(a) || !is.finite(b)) return(NA_real_)
  a - b
}

#' Compara las cuentas de hoy con las del estudio anterior, POR FACULTAD
#'
#' Una fila por facultad presente en cualquiera de los dos lados: una facultad
#' que existía antes y hoy no tiene aulas es tan informativa como una nueva, y
#' callarla escondería justo el caso que importa.
#'
#' @param actuales Lista de filas con `facultad` y los campos de
#'   `.cm_ref_crit_campos` medidos hoy.
#' @param referencia Referencia normalizada.
#' @return Lista con una fila por facultad: `hoy`, `antes` y `delta` por campo.
#' @keywords internal
calc_muestra_referencia_criterios_comparar <- function(actuales, referencia = NULL) {
  if (!is.list(actuales)) actuales <- list()
  claves <- character(0); etiquetas <- character(0)
  for (a in actuales) {
    e <- .cm_aulas_scalar(a$facultad, "")
    if (!nzchar(e)) next
    k <- .cm_aulas_scalar(.cm_criterios_fac_key(e), "")
    claves <- c(claves, k); etiquetas <- c(etiquetas, e)
  }
  for (f in (referencia %||% list())$por_facultad %||% list()) {
    if (!f$faculty_key %in% claves) {
      claves <- c(claves, f$faculty_key); etiquetas <- c(etiquetas, f$facultad)
    }
  }
  if (!length(claves)) return(NULL)
  filas <- lapply(seq_along(claves), function(i) {
    k <- claves[[i]]
    act <- NULL
    for (a in actuales) {
      if (identical(.cm_aulas_scalar(.cm_criterios_fac_key(.cm_aulas_scalar(a$facultad, "")), ""), k)) act <- a
    }
    ref <- .cm_ref_crit_buscar(referencia, etiquetas[[i]])
    campos <- lapply(.cm_ref_crit_campos, function(campo) list(
      hoy = .cm_ref_crit_num(act[[campo]]),
      antes = .cm_ref_crit_num(ref[[campo]]),
      delta = .cm_ref_crit_delta(act[[campo]], ref[[campo]])
    ))
    names(campos) <- .cm_ref_crit_campos
    list(
      faculty_key = k,
      facultad = etiquetas[[i]],
      en_el_estudio_actual = !is.null(act),
      en_el_estudio_anterior = !is.null(ref),
      campos = campos
    )
  })
  list(
    schema = "calc_muestra_referencia_criterios_comparacion_v1",
    grain = "facultad",
    periodo_anterior = .cm_aulas_scalar((referencia %||% list())$periodo, ""),
    con_referencia = !is.null(referencia),
    filas = filas
  )
}

#' Construye la referencia de criterios desde las hojas que la base ya trae
#'
#' Gonzalo, textual: «el histórico sale de la base, ya tenemos todo un mecanismo
#' que lo asimila». Es cierto: `POST /api/calc-muestra/asistencia/referencia` ya
#' lee del libro del estudio anterior las hojas **`cuotas`** —facultad con su
#' cuota total y por sexo— y **`diseno`** —las cifras únicas del estudio—, y hoy
#' sólo conserva la parte de asistencia. Esta función aprovecha esas mismas dos
#' lecturas en vez de pedir otra fuente.
#'
#' `diseno` viene como pares campo/valor, así que el método viaja tal cual: sin
#' interpretarlo no se puede comparar «si se aplicaron los mismos criterios», que
#' es justo la mitad que faltaba.
#'
#' @param cuotas Hoja `cuotas`: una fila por facultad.
#' @param diseno Hoja `diseno`: pares campo/valor del estudio anterior.
#' @param periodo Periodo del estudio anterior, si se conoce.
#' @param estudio Etiqueta de la fuente.
#' @return Referencia normalizada, o `NULL` si no hay cuotas utilizables.
#' @keywords internal
calc_muestra_referencia_criterios_desde_base <- function(cuotas, diseno = NULL,
                                                         periodo = "", estudio = "") {
  if (is.data.frame(cuotas)) {
    cuotas <- lapply(seq_len(nrow(cuotas)), function(i) as.list(cuotas[i, , drop = FALSE]))
  }
  if (!is.list(cuotas) || !length(cuotas)) return(NULL)
  # Los nombres de la hoja no son los del schema: `cuota_total` es la cuota y
  # `cuota_mujeres`/`cuota_hombres` el reparto por sexo. Se traducen aquí y no en
  # el normalizador, que no debe conocer el formato de ninguna hoja.
  filas <- lapply(cuotas, function(f) {
    if (!is.list(f) && !is.data.frame(f)) return(NULL)
    list(
      facultad = .cm_aulas_scalar(f$facultad %||% f$Facultad %||% f$FACULTAD, ""),
      cuota = f$cuota_total %||% f$cuota %||% f$meta_muestra,
      cuota_mujeres = f$cuota_mujeres %||% f$meta_mujeres,
      cuota_hombres = f$cuota_hombres %||% f$meta_hombres,
      poblacion = f$poblacion %||% f$N,
      aulas_titulares = f$aulas_titulares %||% f$titulares,
      sobremuestra = f$sobremuestra %||% f$meta_sobremuestra,
      efectivas_logradas = f$efectivas_logradas %||% f$efectivas
    )
  })
  general <- list()
  if (is.data.frame(diseno) && nrow(diseno) && ncol(diseno) >= 2L) {
    claves <- .cm_aulas_text_key(as.character(diseno[[1]]))
    valores <- as.character(diseno[[2]])
    for (i in seq_along(claves)) {
      if (nzchar(claves[[i]])) general[[claves[[i]]]] <- valores[[i]]
    }
  } else if (is.list(diseno) && length(diseno)) {
    general <- diseno
  }
  calc_muestra_referencia_criterios_normalizar(list(
    periodo = periodo, estudio = estudio,
    general = general, por_facultad = filas
  ))
}
