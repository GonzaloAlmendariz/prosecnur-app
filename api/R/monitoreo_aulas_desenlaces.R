# Los tres desenlaces de un aula que no se resolvio sola: reemplazo (A),
# complemento (B) y refuerzo (C).
#
# Gonzalo, 2026-09-10: «quiero empezar a ver la parte de reemplazos para aulas
# complementarias (B) o aulas de refuerzo (C)».
#
# **Las definiciones son suyas y viven en el libro** (`carga_aulas_libro_formato.R`):
#
#   A  REEMPLAZADA POR    el aula cayo —rechazo o no se aplico— y otra ocupa su
#                         lugar. El titular SALE y la reserva entra.
#   B  COMPLEMENTADA CON  el aula rindio poco y se suma su cadena u otra
#                         reserva. El titular NO sale: los dos cuentan.
#   C  APLICADA DE REFUERZO  no es del aula: faltaban alumnos o un sexo para la
#                         meta y se salio a una reserva por decision operativa.
#
# **Por que hacia falta un motor y no un conteo en la pantalla.** Los tres se
# escriben en la misma columna del libro —STATUS DE APLICACION— y hasta hoy el
# normalizador de monitoreo solo conocia «APLICADA» y «NO APLICADA»: los otros
# tres caian en `pendiente`, asi que un aula aplicada de refuerzo se contaba
# como si nadie la hubiera tocado. Eso se arreglo en
# `monitoreo_aulas_desenlace_aplicacion()`; esto publica el reparto.
#
# **UN DESENLACE OCURRE ANTES DE QUE EL LIBRO LO ESCRIBA.**
#
# Gonzalo, al ver el primer reparto en 0/0/0: «pero si ya han habido tipo A, en
# Derecho por ejemplo». Tenia razon y el fallo era del motor: contaba solo el
# VERBO del libro, y ese verbo se teclea en STATUS DE APLICACION, o sea **al
# aplicar**. Un reemplazo tipo A ocurre mucho antes: en el momento en que el
# titular cae y se activa su reserva. Medido el 2026-09-10: cuatro titulares en
# rechazo con su reserva 1 ya en juego —CH 85 y CH 90 de DERECHO, CH 29, CH
# 131— y los cuatro con `application_status` en `pendiente`, porque todavia no
# se ha ido a aplicar ninguno.
#
# Asi que cada desenlace se cuenta por DOS caminos y se dice por cual:
#
#   declarados  el coordinador escribio el verbo en el libro. Es el registro.
#   en curso    el HECHO ya ocurrio y el libro todavia no lo dice. Se deduce del
#               estado de muestra del titular y de sus reservas.
#
# No se suman a ciegas: un caso que tiene las dos cosas cuenta como declarado.
# Y la diferencia entre los dos numeros es informacion, no ruido: dice cuanto
# le falta al libro para estar al dia con el campo.
#
# **A y B se declaran desde el TITULAR; C desde la reserva.** Es el reparto por
# eslabon que el propio libro impone: un titular puede haber sido reemplazado o
# complementado —y entonces dice con CUAL en «AULA UTILIZADA»—, y una reserva
# solo puede ser la aplicacion de refuerzo, que se explica sola. Contar C desde
# el titular, o A desde la reserva, seria leer la hoja al reves.

#' Reparte los desenlaces de reemplazo, complemento y refuerzo.
#'
#' **No confundir con `monitoreo_aulas_reemplazos.R`**, que es el gesto de
#' ACTIVAR un reemplazo desde la app. Esto sólo cuenta lo que el libro ya
#' declara. Es la razón de que el archivo tenga otro nombre: el primero que le
#' puse chocaba con aquél y lo sobrescribió entero.
#'
#' @param df data.frame del plan seguido, con `application_status`,
#'   `sample_role`, `faculty`, `operational_code` y `aula_utilizada`.
#' @return lista con `reemplazadas`, `complementadas`, `refuerzos`, cada una con
#'   su total, su reparto por facultad y sus filas; mas `sin_aula_utilizada`,
#'   que cuenta los casos A y B que no dicen CON CUAL.
#' @export
monitoreo_aulas_desenlaces_por_tipo <- function(df) {
  vacio <- list(
    reemplazadas = .mar_grupo(),
    complementadas = .mar_grupo(),
    refuerzos = .mar_grupo(),
    caidos_sin_relevo = 0L,
    sin_aula_utilizada = 0L,
    total = 0L
  )
  df <- .monitoreo_aulas_df(df, "plan")
  if (!nrow(df)) return(vacio)

  estado <- vapply(
    .mar_col(df, "application_status"),
    monitoreo_aulas_desenlace_aplicacion, character(1), USE.NAMES = FALSE
  )
  rol <- tolower(trimws(.mar_col(df, "sample_role")))
  es_titular <- rol == "titular"

  # A y B las declara el titular; C, la reserva. Se respeta el eslabon aunque el
  # libro traiga el verbo en la fila equivocada: contar una C desde un titular
  # inflaria los refuerzos con aulas que nadie salio a reforzar.
  codigo <- .mar_col(df, "operational_code")
  del_titular <- .mar_col(df, "titular_operational_code")
  muestra <- vapply(.mar_col(df, "sample_status"), monitoreo_aulas_estado_muestra,
                    character(1), USE.NAMES = FALSE)
  en_juego <- nzchar(trimws(.mar_col(df, "contact_date"))) |
    nzchar(trimws(.mar_col(df, "scheduled_date")))

  # Los titulares que CAYERON: rechazo del docente, o ya marcados reemplazados.
  cayo <- es_titular & muestra %in% c("rechazo", "reemplazada")
  # Y de esos, los que tienen al menos una reserva suya ya en juego. Esa pareja
  # —titular caido + relevo activado— ES el reemplazo, lo diga el libro o no.
  con_relevo <- vapply(codigo, function(cod) {
    if (!nzchar(cod)) return(FALSE)
    any(!es_titular & del_titular == cod & en_juego)
  }, logical(1), USE.NAMES = FALSE)

  declarada_a <- estado == "reemplazada_por" & es_titular
  reemplazadas <- .mar_grupo(
    df[declarada_a | (cayo & con_relevo), , drop = FALSE],
    declarados = df[declarada_a, , drop = FALSE]
  )
  # **Un titular caido SIN relevo no es un reemplazo: es trabajo pendiente.**
  # Contarlo aqui diria que su hueco ya esta cubierto.
  sin_relevo <- sum(cayo & !con_relevo & !declarada_a)

  # B: el titular rindio poco y se le sumo una reserva. El hecho se deduce
  # cuando los DOS se aplicaron —el titular no salio, los dos cuentan—, que es
  # exactamente lo que distingue B de A.
  aplicado <- estado %in% c("aplicada", "complementada_con", "aplicada_de_refuerzo")
  con_relevo_aplicado <- vapply(codigo, function(cod) {
    if (!nzchar(cod)) return(FALSE)
    any(!es_titular & del_titular == cod & aplicado)
  }, logical(1), USE.NAMES = FALSE)
  declarada_b <- estado == "complementada_con" & es_titular
  complementadas <- .mar_grupo(
    df[declarada_b | (es_titular & aplicado & con_relevo_aplicado & !cayo), , drop = FALSE],
    declarados = df[declarada_b, , drop = FALSE]
  )

  # C: salir a una reserva por cuota, sin titular caido. El banco de extras no
  # cuelga de ningun titular, asi que aplicarlo ES refuerzo por definicion.
  del_banco <- rol == "extra_reserve_pool"
  declarada_c <- estado == "aplicada_de_refuerzo" & !es_titular
  refuerzos <- .mar_grupo(
    df[declarada_c | (del_banco & aplicado), , drop = FALSE],
    declarados = df[declarada_c, , drop = FALSE]
  )

  # **Un A o un B sin «AULA UTILIZADA» es media frase.** Los dos verbos terminan
  # en preposicion justamente porque piden un CUAL, y sin el no se puede seguir
  # la cadena ni comprobar que la reserva que entro es la que el sorteo asigno.
  con_verbo <- df[estado %in% c("reemplazada_por", "complementada_con") & es_titular, , drop = FALSE]
  sin_cual <- if (nrow(con_verbo)) sum(!nzchar(trimws(.mar_col(con_verbo, "aula_utilizada")))) else 0L

  list(
    reemplazadas = reemplazadas,
    complementadas = complementadas,
    refuerzos = refuerzos,
    # Titulares caidos a los que todavia NO se ha activado ningun relevo: el
    # hueco sigue abierto y alguien tiene que llamar.
    caidos_sin_relevo = as.integer(sin_relevo),
    sin_aula_utilizada = as.integer(sin_cual),
    total = as.integer(reemplazadas$total + complementadas$total + refuerzos$total)
  )
}

#' Una columna del plan como texto, o vacio si no viene.
#' @noRd
.mar_col <- function(df, campo) {
  if (!campo %in% names(df)) return(rep("", nrow(df)))
  x <- df[[campo]]
  x[is.na(x)] <- ""
  as.character(x)
}

#' El grupo de un desenlace: cuantos, de que facultades y cuales.
#'
#' Sin filas devuelve la MISMA forma con ceros: un consumidor que recibe `NULL`
#' en un caso y una lista en otro acaba con dos ramas, y una de las dos se
#' prueba sola.
#' @noRd
.mar_grupo <- function(filas = NULL, declarados = NULL) {
  n_dec <- if (is.null(declarados)) 0L else as.integer(nrow(declarados))
  if (is.null(filas) || !nrow(filas)) {
    return(list(total = 0L, declarados = 0L, en_curso = 0L,
                por_facultad = list(), aulas = list()))
  }
  fac <- .mar_col(filas, "faculty")
  fac[!nzchar(trimws(fac))] <- "Sin facultad"
  tabla <- sort(table(fac), decreasing = TRUE)
  por_facultad <- lapply(names(tabla), function(f) {
    list(facultad = f, aulas = as.integer(tabla[[f]]))
  })
  aulas <- lapply(seq_len(nrow(filas)), function(i) {
    list(
      codigo = .mar_col(filas, "operational_code")[i],
      facultad = fac[i],
      titular = .mar_col(filas, "titular_operational_code")[i],
      # CON CUAL se resolvio. Vacia cuando el coordinador no la lleno, y eso se
      # publica: es media frase, no un dato ausente cualquiera.
      aula_utilizada = .mar_col(filas, "aula_utilizada")[i],
      motivo = .mar_col(filas, "replacement_reason")[i],
      efectivas = suppressWarnings(as.numeric(.mar_col(filas, "effective_surveys")[i]))
    )
  })
  list(
    total = nrow(filas),
    # Cuantos los dice el LIBRO y cuantos se deducen del campo. La diferencia
    # dice cuanto le falta al libro para estar al dia.
    declarados = n_dec,
    en_curso = as.integer(nrow(filas) - n_dec),
    por_facultad = por_facultad,
    aulas = aulas
  )
}
