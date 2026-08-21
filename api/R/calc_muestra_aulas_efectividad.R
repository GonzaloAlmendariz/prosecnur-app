# Efectividad esperada ex ante (EF3 fase 1, era EFECTIVIDAD).
#
# VARA 0 de Gonzalo, textual: «tenemos que genuinamente asegurarnos que este
# mecanismo de selección de aulas nos garantice efectividad (…) lo importante
# es medirla ANTES, porque luego ya no podemos arreglar las cosas».
#
# Calibración 2025 (base ADR 0060, 230 intentadas / 194 aplicadas), medida el
# 2026-08-18 y registrada en docs/qa/checklist-replicacion-2025-2026-08-17.md:
#   - P(aplicada): base 84%; DOCENTE CONTRATADO 87%; ORDINARIO-PRINCIPAL 73%.
#     (Asociado/Auxiliar/Pre-docente sin calibración propia → base.)
#   - Rendimiento (efectivas/elegibles, mediana 0.56), monotónico en tamaño:
#     ≤15: 0.80 · 16–25: 0.69 · 26–35: 0.56 · 36–50: 0.55 · >50: 0.44.
#     Bins sobre ELEGIBLES (v1; la base 2025 bineó sobre su tamaño de aula).
#   - LIMITACIÓN DECLARADA: el bloque horario (especial-mañana −15 pts de
#     aplicación; noche rinde 0.40) NO es derivable del marco actual — el
#     `schedule` es código de sección, no hora. Señal medida, no usable en v1.
#   - tipo_curso no calibrable (2025 fue todo teórico): talleres sin prior.
#
# FASE 1 = REFERENCIAL: anota columnas en el frame DESPUÉS del frame_hash (no
# muta la firma ni invalida artefactos acreditados) y NO toca π ni el sorteo.
# Pesar el sorteo con esto es fase 2 y espera la decisión de Gonzalo.

.cm_efectividad_p_aplicada <- function(teacher_type) {
  tt <- toupper(trimws(as.character(teacher_type %||% "")))
  p <- rep(0.84, length(tt))
  p[grepl("CONTRATADO", tt, fixed = TRUE)] <- 0.87
  p[grepl("ORDINARIO", tt, fixed = TRUE) & grepl("PRINCIPAL", tt, fixed = TRUE)] <- 0.73
  p
}

.cm_efectividad_rendimiento <- function(eligible_n, tramos = NULL) {
  e <- suppressWarnings(as.numeric(eligible_n))
  e[!is.finite(e)] <- 0
  # Tramos sellados en la config (plan 1b): la curva es DATO del estudio, no
  # codigo. Sin sello, la calibracion embebida (y la fila lo declara).
  if (is.list(tramos) && length(tramos)) {
    r <- rep(NA_real_, length(e))
    restante <- rep(TRUE, length(e))
    for (tr in tramos) {
      hasta <- suppressWarnings(as.numeric(tr$hasta)[1])
      if (!is.finite(hasta)) hasta <- Inf
      tasa <- suppressWarnings(as.numeric(tr$tasa)[1])
      idx <- restante & e <= hasta
      r[idx] <- tasa
      restante <- restante & !idx
    }
    return(r)
  }
  r <- rep(NA_real_, length(e))
  r[e <= 15] <- 0.80
  r[e > 15 & e <= 25] <- 0.69
  r[e > 25 & e <= 35] <- 0.56
  r[e > 35 & e <= 50] <- 0.55
  r[e > 50] <- 0.44
  r
}

#' Tasa de aplicacion por tipo de docente desde la tabla sellada; un aula con
#' docentes compuestos («A | B») lleva la del mas restrictivo (min), que es
#' como el campo se comporta: basta que uno rechace.
.cm_efectividad_p_desde_tabla <- function(tipos, tabla) {
  claves <- vapply(tabla, function(x) toupper(trimws(as.character(x$tipo)[1])), character(1))
  tasas <- vapply(tabla, function(x) suppressWarnings(as.numeric(x$tasa)[1]), numeric(1))
  general <- tasas[claves %in% c("GENERAL", "*", "")]
  base <- if (length(general)) general[[1]] else NA_real_
  vapply(as.character(tipos), function(tt) {
    partes <- toupper(trimws(strsplit(tt, "|", fixed = TRUE)[[1]]))
    partes <- partes[nzchar(partes)]
    if (!length(partes)) return(base)
    vals <- vapply(partes, function(pp) {
      hit <- which(claves == pp)
      if (length(hit)) tasas[[hit[1]]] else base
    }, numeric(1))
    vals <- vals[is.finite(vals)]
    if (!length(vals)) return(base)
    min(vals)
  }, numeric(1), USE.NAMES = FALSE)
}

#' Normaliza la declaracion de procedencia de la calibracion (cfg$efectividad).
#' Tres estados legales: "historico" (las tasas provienen de la data historica
#' del estudio anterior; periodo opcional), "tau_global" (no hay historico: el
#' esperado se rige por el supuesto global tau declarado), o NULL (nadie
#' declaro nada). Gonzalo (2026-08-20): «la idea es que no sea un hardcore…
#' puede no haber historico: se rige por el global, y hay que mostrarlo».
.cm_efectividad_normalize_config <- function(ef = NULL) {
  if (!is.list(ef)) return(NULL)
  chr1 <- function(x) {
    v <- as.character(x)[1]
    if (length(v) != 1L || is.na(v)) "" else trimws(v)
  }
  fuente <- chr1(ef$fuente)
  periodo <- chr1(ef$periodo)
  tau <- suppressWarnings(as.numeric(ef$tau)[1])
  if (identical(fuente, "historico")) {
    # Ajuste por facultad (decision de Gonzalo, 2026-08-20): tau medido de la
    # VARA DE EFECTIVAS del historico donde la referencia lo clasifica con
    # suficiencia (k>=12); las demas facultades NO llevan entrada — para ellas
    # rige la tasa general y la UI lo declara. tau_base es el agregado que las
    # curvas reproducen; el factor por aula es tau_facultad / tau_base.
    tau_base <- suppressWarnings(as.numeric(ef$tau_base)[1])
    if (!is.finite(tau_base) || tau_base <= 0 || tau_base > 1) tau_base <- NA_real_
    pf_in <- ef$por_facultad
    por_facultad <- NULL
    if (is.list(pf_in) && length(pf_in)) {
      limpio <- lapply(pf_in, function(e) {
        if (!is.list(e)) return(NULL)
        fac <- chr1(e$facultad)
        tv <- suppressWarnings(as.numeric(e$tau)[1])
        kv <- suppressWarnings(as.integer(e$k)[1])
        suf <- chr1(e$suficiencia)
        # tau admite hasta 2: con tau_base=1 el sello guarda RESIDUALES
        # directos (Derecho 1,115 rinde por encima de su mix) — un residual
        # mayor a 2 si seria absurdo y se descarta.
        if (!nzchar(fac) || !is.finite(tv) || tv <= 0 || tv > 2) return(NULL)
        list(facultad = fac, tau = tv,
             k = if (length(kv) == 1L && !is.na(kv)) kv else NA_integer_,
             suficiencia = suf)
      })
      limpio <- Filter(Negate(is.null), limpio)
      if (length(limpio)) por_facultad <- limpio
    }
    # Tramos de rendimiento sellados: {hasta, tasa} ascendentes; el ultimo
    # puede venir sin `hasta` (= infinito). Invalido -> NULL (rige embebida,
    # declarada).
    tramos_in <- ef$rendimiento_tramos
    rendimiento_tramos <- NULL
    if (is.list(tramos_in) && length(tramos_in)) {
      limpio_t <- lapply(tramos_in, function(tr) {
        if (!is.list(tr)) return(NULL)
        hasta <- suppressWarnings(as.numeric(tr$hasta)[1])
        tasa <- suppressWarnings(as.numeric(tr$tasa)[1])
        if (!is.finite(tasa) || tasa <= 0 || tasa > 1) return(NULL)
        list(hasta = if (is.finite(hasta)) hasta else NA_real_, tasa = tasa)
      })
      limpio_t <- Filter(Negate(is.null), limpio_t)
      hastas <- vapply(limpio_t, function(x) if (is.finite(x$hasta)) x$hasta else Inf, numeric(1))
      if (length(limpio_t) >= 2L && !is.unsorted(hastas, strictly = TRUE)) {
        rendimiento_tramos <- limpio_t
      }
    }
    # Tasa de aplicacion por tipo de docente (capa OPERATIVA): {tipo, tasa, k}.
    ta_in <- ef$tasa_aplicacion
    tasa_aplicacion <- NULL
    if (is.list(ta_in) && length(ta_in)) {
      limpio_a <- lapply(ta_in, function(x) {
        if (!is.list(x)) return(NULL)
        tipo <- chr1(x$tipo)
        tasa_v <- suppressWarnings(as.numeric(x$tasa)[1])
        kv <- suppressWarnings(as.integer(x$k)[1])
        if (!nzchar(tipo) || !is.finite(tasa_v) || tasa_v <= 0 || tasa_v > 1) return(NULL)
        list(tipo = tipo, tasa = tasa_v,
             k = if (length(kv) == 1L && !is.na(kv)) kv else NA_integer_)
      })
      limpio_a <- Filter(Negate(is.null), limpio_a)
      if (length(limpio_a)) tasa_aplicacion <- limpio_a
    }
    return(list(fuente = "historico", periodo = periodo, tau = NA_real_,
                tau_base = tau_base, por_facultad = por_facultad,
                rendimiento_tramos = rendimiento_tramos,
                tasa_aplicacion = tasa_aplicacion))
  }
  if (identical(fuente, "tau_global") && is.finite(tau) && tau > 0 && tau <= 1) {
    return(list(fuente = "tau_global", periodo = periodo, tau = tau))
  }
  NULL
}

#' Resuelve la calibracion vigente. Sin declaracion NO se inventa un
#' historico: las curvas embebidas (medidas sobre un estudio anterior real)
#' se usan igual, pero la procedencia se DECLARA como calibracion_embebida
#' para que la UI lo diga en voz alta — anti-fallback.
.cm_efectividad_calibracion <- function(cfg = NULL) {
  ef <- .cm_efectividad_normalize_config(if (is.list(cfg)) cfg[["efectividad"]] else NULL)
  if (is.null(ef)) return(list(fuente = "calibracion_embebida", periodo = "", tau = NA_real_))
  ef
}

#' Anota el frame con la efectividad esperada por curso-horario.
#' Idempotente y sin RNG; con frame vacío o sin eligible_n devuelve tal cual.
#' Con fuente "tau_global" no hay curvas: esperado = elegibles x tau, y las
#' columnas de curva quedan NA a proposito (la UI muestra la via global).
.cm_aulas_efectividad_anotar <- function(aula_frame, calibracion = NULL) {
  if (!is.data.frame(aula_frame) || !nrow(aula_frame) || !"eligible_n" %in% names(aula_frame)) {
    return(aula_frame)
  }
  cal <- if (is.list(calibracion) && length(calibracion)) calibracion else
    list(fuente = "calibracion_embebida", periodo = "", tau = NA_real_)
  el <- suppressWarnings(as.numeric(aula_frame$eligible_n))
  el[!is.finite(el)] <- 0
  if (identical(cal$fuente, "tau_global")) {
    aula_frame$p_aplicada_ref <- NA_real_
    aula_frame$rendimiento_ref <- NA_real_
    aula_frame$efectividad_tau <- round(as.numeric(cal$tau), 3)
    aula_frame$efectivas_esperadas <- round(el * as.numeric(cal$tau), 1)
  } else {
    tipos <- aula_frame$teacher_type %||% rep("", nrow(aula_frame))
    # Tasa de aplicacion: capa OPERATIVA (visitas/cadena). V7 la saco de las
    # efectivas esperadas con evidencia (residual condicional ~1): un docente
    # decide SI el aula entra, no cuanto rinde adentro.
    p <- if (is.list(cal$tasa_aplicacion) && length(cal$tasa_aplicacion)) {
      .cm_efectividad_p_desde_tabla(tipos, cal$tasa_aplicacion)
    } else {
      .cm_efectividad_p_aplicada(tipos)
    }
    r <- .cm_efectividad_rendimiento(aula_frame$eligible_n, tramos = cal$rendimiento_tramos)
    aula_frame$p_aplicada_ref <- round(p, 3)
    aula_frame$rendimiento_ref <- round(r, 3)
    # Ajuste por facultad: solo donde el historico declaro un tau con
    # suficiencia; el resto queda en 1 con k=NA — la UI dice "el historico no
    # pudo generar informacion especifica para esta facultad".
    factor <- rep(1, nrow(aula_frame))
    k_fac <- rep(NA_integer_, nrow(aula_frame))
    pf <- cal$por_facultad
    tau_base <- suppressWarnings(as.numeric(cal$tau_base))
    if (is.list(pf) && length(pf) && length(tau_base) == 1L &&
        is.finite(tau_base) && tau_base > 0) {
      fac_col <- toupper(trimws(as.character(aula_frame$faculty %||% rep("", nrow(aula_frame)))))
      for (e in pf) {
        fk <- toupper(trimws(as.character(e$facultad)[1]))
        tv <- suppressWarnings(as.numeric(e$tau)[1])
        kv <- suppressWarnings(as.integer(e$k)[1])
        if (nzchar(fk) && is.finite(tv) && tv > 0) {
          idx <- fac_col == fk
          factor[idx] <- tv / tau_base
          k_fac[idx] <- kv
        }
      }
    }
    aula_frame$factor_facultad <- round(factor, 3)
    aula_frame$facultad_k <- k_fac
    # La tasa de efectividad DEL AULA (nombre propio, V7): R(tamano) x F(fac).
    aula_frame$tasa_efectividad_aula <- round(r * factor, 3)
    # EFECTIVAS ESPERADAS = elegibles x tasa del aula — CONDICIONAL a que el
    # aula se aplique. El riesgo del docente NO descuenta efectivas (la cadena
    # repone caidas); vive en p_aplicada_ref para presupuesto y cadena.
    aula_frame$efectivas_esperadas <- round(el * r * factor, 1)
  }
  # La procedencia viaja en la fila: la UI y Monitoreo la leen, no la asumen.
  aula_frame$efectividad_fuente <- as.character(cal$fuente)
  aula_frame$efectividad_periodo <- as.character(cal$periodo %||% "")
  # Contrato con Monitoreo (2026-08-20): declarar de donde salio la meta para
  # que su lado pueda afirmar "del diseno" sin inferirlo. Literal estable.
  aula_frame$meta_origen <- "diseno"
  aula_frame
}

#' La tasa de efectividad de cada FACULTAD, derivada del marco anotado.
#'
#' Plan 1b/E3: es el numero que dimensiona (cupos = cuota / (P25 x tasa)) y el
#' que la tarjeta didactica de Cursos-horario requeridos explica. UN dueño:
#' se deriva de las columnas que el anotador ya escribio (rendimiento_ref y
#' factor_facultad), asi ninguna superficie recalcula por su cuenta.
#' Devuelve una lista por facultad: {facultad, tasa, n_aulas, elegibles,
#' con_residual (si su F vino del historico), facultad_k}.
calc_muestra_aulas_tasas_facultad <- function(aula_frame) {
  if (!is.data.frame(aula_frame) || !nrow(aula_frame) ||
      !all(c("faculty", "eligible_n", "rendimiento_ref") %in% names(aula_frame))) {
    return(list())
  }
  el <- suppressWarnings(as.numeric(aula_frame$eligible_n))
  el[!is.finite(el) | el < 0] <- 0
  r <- suppressWarnings(as.numeric(aula_frame$rendimiento_ref))
  f <- suppressWarnings(as.numeric(aula_frame$factor_facultad %||% rep(1, nrow(aula_frame))))
  f[!is.finite(f)] <- 1
  k_fac <- suppressWarnings(as.integer(aula_frame$facultad_k %||% rep(NA_integer_, nrow(aula_frame))))
  fac <- toupper(trimws(as.character(aula_frame$faculty)))
  ok <- nzchar(fac) & is.finite(r) & el > 0
  # Solo el marco ELEGIBLE dimensiona: si el frame trae la marca `included`,
  # las excluidas por criterios no aportan a la tasa de su facultad.
  inc <- aula_frame$included
  if (!is.null(inc)) ok <- ok & (inc %in% TRUE)
  salida <- list()
  for (ff in unique(fac[ok])) {
    idx <- ok & fac == ff
    tot_el <- sum(el[idx])
    if (tot_el <= 0) next
    tasa <- sum(el[idx] * r[idx] * f[idx]) / tot_el
    # Los DOS factores por separado, para que la pantalla pueda ensenar de
    # donde sale la tasa en vez de pedir que se crea el resultado:
    #   mix    = R ponderado por elegibles — que rinde el aula tipica de esta
    #            facultad SOLO por su mezcla de tamanos (chicas rinden mas).
    #   factor = F residual — lo que esta facultad rindio en el historico MAS
    #            ALLA de su mix; 1 cuando el historico no le dio base propia.
    # Se cumple tasa = mix x factor porque F es constante dentro de la facultad.
    mix <- sum(el[idx] * r[idx]) / tot_el
    ff_vals <- unique(f[idx])
    factor_res <- if (length(ff_vals) == 1L) ff_vals[[1]] else if (mix > 0) tasa / mix else 1
    kk <- k_fac[idx]
    kk <- kk[!is.na(kk)]
    salida[[length(salida) + 1L]] <- list(
      facultad = ff,
      tasa = round(tasa, 4),
      # 6 decimales, no 4: con 4 el producto de los publicados NO reconstruye
      # la tasa publicada (0,6102 contra 0,6103 en el fixture de DERECHO) y la
      # pantalla ensenaria una cuenta que no da el numero que muestra al lado.
      rendimiento_mix = round(mix, 6),
      factor_residual = round(factor_res, 6),
      n_aulas = as.integer(sum(idx)),
      elegibles = as.integer(round(tot_el)),
      con_residual = any(f[idx] != 1),
      facultad_k = if (length(kk)) kk[[1]] else NA_integer_
    )
  }
  orden <- order(vapply(salida, function(x) -x$elegibles, numeric(1)))
  salida[orden]
}

