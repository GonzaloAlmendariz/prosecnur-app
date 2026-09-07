# La hoja «Avance de campo» como celdas para Sheets — unidad B2.2.
#
# El xlsx la escribe IMPERATIVO (`aulas_libro_escribir_indicadores`, celda a
# celda con openxlsx) y el publicador del libro solo habla con generadores
# modelo→data.frame (`aulas_libro_hoja_plan_dia`…). Este renderer es el camino
# que faltaba: el MISMO modelo de `aulas_libro_indicadores()` —meta, diario,
# aplicadores, facultades— como data.frame de celdas que `.malp_df_a_values`
# adapta fila a fila. El camino imperativo del xlsx NO cambia: esto es
# adicional, para que la pestaña llegue al Google Sheets del operativo.
#
# DOS decisiones que el contrato dejaba abiertas, resueltas aquí:
#
#   · **La fecha del corte jamás sale del reloj.** El imperativo escribe
#     «Al DD/MM/YYYY» con `Sys.Date()` (indicadores.R) y por eso el xlsx cambia
#     de un día para otro. La pestaña publicada viaja por el motor batch+hash:
#     si leyera el reloj, dos publicaciones del MISMO estado en días distintos
#     darían hashes distintos y la hoja se reescribiría sin que nada haya
#     cambiado. `fecha` se inyecta; sin inyección se DERIVA del modelo (el
#     último día del diario), y sin diario la celda declara por qué no hay
#     corte fechado — nada ausente en silencio (C3).
#
#   · **Los porcentajes van como TEXTO «75 %», no como proporción cruda.** El
#     libro publica en RAW (fidelidad del round-trip, decisión de B1) y RAW no
#     aplica numFmt: un 0.75 crudo se leería como «0.75» y el resto del libro
#     ya escribe sus razones sin formato («% EFECTIVAS ESPERADO» sale
#     «0.6666667» en la Base de control, que es hoja de ida y vuelta). Esta
#     hoja es de SOLO ida (sin lector) y su público lee, no calcula: se publica
#     lo que el numFmt `0.0%` del xlsx enseña — entero sin decimal, decimal
#     cuando significa algo — con punto decimal, como todo número del libro.

# Número → celda de texto. Mismo redondeo que `cifra_limpia` del xlsx: el
# valor se limpia (round a 1), no solo su presentación. Lo no finito sale ""
# para que el llamador decida su vacío declarado.
#
# Los CONTEOS de personas (meta, logrado, falta, «Falta para la meta») llegan
# ya enteros del modelo desde A9-B6 —la regla direccional vive en
# `aulas_libro_indicadores()`, compartida con el xlsx—; el round(x, 1) de aquí
# es para lo fraccionario legítimo, como «Media por curso-horario».
.cala_num_txt <- function(v) {
  x <- suppressWarnings(as.numeric(v))
  if (length(x) != 1L || !is.finite(x)) return("")
  format(round(x, 1), trim = TRUE, scientific = FALSE)
}

# Proporción → «75 %» / «75.6 %». Un decimal cuando lo hay, ninguno cuando no:
# la misma regla entero/fraccionario que los dos estilos de cifra del xlsx.
.cala_pct_txt <- function(p) {
  x <- suppressWarnings(as.numeric(p))
  if (length(x) != 1L || !is.finite(x)) return("")
  paste0(format(round(x * 100, 1), trim = TRUE, scientific = FALSE), " %")
}

# Una tabla del modelo (diario, aplicadores, facultades) como filas de celdas:
# cabecera con sus nombres y cada columna según su naturaleza — texto tal
# cual, «Avance» como porcentaje, el resto como número limpio.
#
# S4 (loop estética, 2026-09-07): una cifra que el modelo no tiene (NA) sale
# «—», nunca en blanco. Medido en el libro real: 19 de 24 aplicadores sin parte
# dejaban «Encuestas aplicadas (parte)» vacía y la fila quedaba con un hueco en medio;
# en Sheets un hueco se lee como «se olvidaron», y el «—» ya es el vocabulario
# del bloque de meta y de la procedencia (sin dato ≠ cero).
.cala_tabla_filas <- function(tabla, texto = character(0)) {
  nombres <- names(tabla)
  filas <- lapply(seq_len(nrow(tabla)), function(i) {
    vapply(nombres, function(col) {
      v <- tabla[[col]][[i]]
      if (col %in% texto) return(trimws(as.character(v %||% "")))
      txt <- if (identical(col, "Avance")) .cala_pct_txt(v) else .cala_num_txt(v)
      if (nzchar(txt)) txt else "\u2014"
    }, character(1))
  })
  c(list(nombres), filas)
}

#' Arma la hoja «Avance de campo» del libro como celdas para Sheets.
#'
#' @param ind el modelo de `aulas_libro_indicadores()`: lista con `meta`,
#'   `diario`, `aplicadores` y `facultades`.
#' @param fecha `Date` del corte, inyectada por quien publica. `NULL` deriva el
#'   corte del propio modelo (el último día del diario); sin diario la celda
#'   del corte declara la causa. Nunca se consulta el reloj aquí.
#' @return data.frame de celdas sin nombres, listo para `.malp_df_a_values`.
aulas_libro_hoja_avance <- function(ind, fecha = NULL) {
  ind <- if (is.list(ind)) ind else list()
  m <- if (is.list(ind$meta)) ind$meta else list()

  # El corte: inyectado, o derivado del último día del diario (ISO ordena
  # lexicográfico = cronológico). Sin ninguno de los dos, la causa en la celda.
  if (is.null(fecha) || !length(fecha)) {
    dias <- if (is.data.frame(ind$diario) && nrow(ind$diario)) {
      as.character(ind$diario$Dia)
    } else {
      character(0)
    }
    dias <- dias[!is.na(dias) & nzchar(dias)]
    fecha <- if (length(dias)) max(dias) else NULL
  }
  fecha <- if (is.null(fecha)) as.Date(NA) else suppressWarnings(as.Date(fecha[[1]]))
  corte <- if (length(fecha) == 1L && !is.na(fecha)) {
    paste("Al", format(fecha, "%d/%m/%Y"))
  } else {
    "Sin fecha de corte: el avance diario aun no trae respuestas de plataforma fechadas."
  }

  filas <- list()
  poner <- function(...) filas[[length(filas) + 1L]] <<- c(...)

  poner("Avance de campo")
  poner(corte)
  poner("")

  # --- Avance contra la meta (registro académico de A13b) ---------------------
  # Mismas etiquetas y mismos números que el bloque de meta del xlsx; el «—»
  # y su nota también son los del xlsx: cero efectivas y «todavía no sabemos»
  # son dos noticias distintas.
  poner("Avance contra la meta")
  sin_dato <- 0L
  fila_meta <- function(etiqueta, valor, pct = FALSE) {
    txt <- if (pct) .cala_pct_txt(valor) else .cala_num_txt(valor)
    if (!nzchar(txt)) {
      sin_dato <<- sin_dato + 1L
      txt <- "—"
    }
    poner(etiqueta, txt)
  }
  fila_meta("Encuestas de la meta", m$meta_total)
  fila_meta("Efectivas conseguidas", m$logrado)
  fila_meta("Avance", m$avance, pct = TRUE)
  fila_meta("Faltan", m$falta)
  fila_meta("Aulas que llegaron a SU meta", m$aulas_cerradas)
  fila_meta("Aulas del operativo", m$aulas)
  if (sin_dato) {
    poner("Estas cifras salen de la plataforma, no del parte de campo: se llenan al cargar la base de respuestas.")
  }
  # Con las DOS familias presentes, el puente que las distingue — el MISMO
  # texto y la MISMA decision que el xlsx, porque ambos viven en
  # `carga_aulas_libro_puente.R` (B7.3). Fila propia, como la nota de arriba.
  puente <- .calap_puente_con_datos(sin_dato, ind$aplicadores)
  if (!is.null(puente)) poner(puente)
  poner("")

  # --- Avance por facultad ----------------------------------------------------
  # Solo cuando el estudio publica cuotas del diseño: sin ellas el bloque no
  # existe ni en el xlsx (la cuota no se reconstruye).
  if (is.data.frame(ind$facultades) && nrow(ind$facultades)) {
    poner("Avance por facultad")
    poner("La cuota es de cada facultad y de cada sexo: pasarse en una no cubre lo que falta en otra.")
    for (f in .cala_tabla_filas(ind$facultades, texto = "Facultad")) poner(f)
    # La misma nota del xlsx: el techo por facultad es una DERIVACIÓN del
    # ratio global del diseño, no una segunda meta.
    ratio <- local({
      fac <- ind$facultades
      if (!"Techo con sobremuestra" %in% names(fac)) return(NA_real_)
      mu <- suppressWarnings(sum(as.numeric(fac$Muestra), na.rm = TRUE))
      te <- suppressWarnings(sum(as.numeric(fac$`Techo con sobremuestra`), na.rm = TRUE))
      if (is.finite(mu) && mu > 0 && is.finite(te) && te > 0) te / mu else NA_real_
    })
    poner(paste0(
      "La muestra es la cuota del diseño y es la que decide el cierre. ",
      "El techo con sobremuestra reparte el aforo comprado con el ratio del estudio",
      if (is.finite(ratio)) sprintf(" (x%s)", format(round(ratio, 2), trim = TRUE)) else "",
      ": es margen operativo, no una segunda meta."
    ))
    poner("")
  }

  # --- Producción por aplicador -----------------------------------------------
  # El vacío se declara (C3): el xlsx omite el bloque en silencio, pero en una
  # pestaña que convive con la Base de control llena, la ausencia se leería
  # como retiro, no como falta de dato.
  poner("Producción por aplicador")
  if (is.data.frame(ind$aplicadores) && nrow(ind$aplicadores)) {
    for (f in .cala_tabla_filas(ind$aplicadores, texto = "Aplicador")) poner(f)
  } else {
    poner("Sin partes de campo registrados: todavia no hay produccion por aplicador que mostrar.")
  }
  poner("")

  # --- Avance diario ----------------------------------------------------------
  # Mismo trato que el xlsx: la sección no desaparece, dice por qué está vacía
  # (`.cali_motivo_sin_diario` distingue «sin base» de «sin fechas legibles»).
  poner("Avance diario")
  if (is.data.frame(ind$diario) && nrow(ind$diario)) {
    for (f in .cala_tabla_filas(ind$diario, texto = "Dia")) poner(f)
    # S5: la MISMA fila de cierre que el xlsx (`.cali_cierre_diario`), sin
    # cabecera: sólo con dos o más días.
    cierre <- .cali_cierre_diario(ind$diario)
    if (!is.null(cierre)) poner(.cala_tabla_filas(cierre, texto = "Dia")[[2]])
  } else {
    poner(.cali_motivo_sin_diario(ind))
  }

  ancho <- max(vapply(filas, length, integer(1)))
  filas <- lapply(filas, function(f) {
    length(f) <- ancho
    f[is.na(f)] <- ""
    f
  })
  as.data.frame(do.call(rbind, filas), stringsAsFactors = FALSE)
}
