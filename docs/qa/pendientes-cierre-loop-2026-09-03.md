# Pendientes al cierre del loop de mejora visual — 2026-09-03

Acta del cierre dictado por Gonzalo («vamos cerrando el loop viendo todo lo
pendiente y faltante» + «lo demás queda pendiente pero anótalo y explica cada
uno en detalle»). El loop entregó B63–B81 completos (13 commits, `5178aa87` →
`b12ff924`); B33 quedó **CONFORME** por Gonzalo y el proyecto se guardó en el
canónico (2026-09-03 09:48, 13,2 MB, sin referencias perdidas). Lo de abajo es
TODO lo que queda vivo, con su detalle. La fila madre de cada uno sigue en
`checklist-operativo-aulas-2026-08-31.md`.

## A — Con olor a bug (prioridad si algo muerde en campo)

### A27 · El ciclo del libro (o el re-guardado de config) borra la declaración del modo
- **Qué pasa**: dos veces observado (2026-09-01/02) que una sesión que abre
  directo en la agenda (el `.pulso` trae `monitoreo_profile` con
  `family=aulas_universitarias` y `route_selected=TRUE`, verificado en el
  `state.rds`) vuelve a la pantalla «Declara el propósito» tras un ciclo de
  sync/Recargar + navegación. Una sonda del lead imprimió `family=character(0)`
  justo después de `.monitoreo_store_config`.
- **Sospecha**: alguna vía de store re-normaliza la config sin el bloque
  `monitoreo_profile` y lo pisa al escribir.
- **Advertencia registrada**: la observación más reciente estaba contaminada
  por un frontend con un módulo roto en HMR — hay que **re-reproducir con el
  front limpio** antes de culpar al backend (lección: el rojo se localiza
  primero).
- **Para cerrarlo**: sonda de sesión antes/después de `/aulas/sync` mirando
  `cfg$monitoreo_profile`; si se reproduce, guard en la vía de store (el mismo
  patrón del guard A30: la clave solo se toca si el body la trae) + test HTTP.

### A12 · La hora del parte en-app (`applied_time`)
- **Qué pasa**: el alias `hora_aplicacion → applied_time` existe en la tabla
  de alias, pero el parte registrado EN LA APP no escribe `applied_time`: la
  columna «HORA DE APLICACIÓN» del libro queda vacía para registros hechos
  desde la app (los tecleados en el Excel sí la llevan). Residuo declarado por
  backend-r al cerrar A1.
- **Decisión pendiente de diseño**: el formulario captura `applied_at` como un
  solo «momento» — decidir si se separa en fecha + hora o si ese momento
  alimenta las dos columnas.
- **Dónde vive**: `monitoreo_aulas_parte_en_app.R`.
- **Para cerrarlo**: tomar la decisión (recomendación: derivar ambas columnas
  del mismo `applied_at`, cero fricción para el aplicador), escribirla en el
  parte en-app y clavarla con un test de ida y vuelta al libro.

## B — Funcionalidad que quedó a medias (unidades sueltas)

### B2(3) · La planilla de aplicadores por rango horario (tercera hoja profesional)
- **Contexto**: B2 son las hojas profesionales del libro dictadas vía D-S2.
  (1) avance por facultad y (2) plan del día ya están (B2.1/B2.2 selladas, la
  hoja «Avance de campo» vive en el Sheets). Falta la **(3) planilla de
  aplicadores por rango horario** — y las «tablas dinámicas que aún no están».
- **Nota del cierre**: la hoja «Asignación de aplicadores» (B68, sellada hoy)
  cubre buena parte del espíritu de la (3) en el `.xlsx` generado; queda
  decidir si la (3) es esa misma hoja llevada al Sheets o una planilla por
  franja distinta. Conecta con D-B2 (el orden de las hojas).
- **Para cerrarlo**: palabra de Gonzalo sobre esa equivalencia + render.

### B4 · QR: el aula se recoge sola
- **Qué es**: el GOAL del registro por QR (la ficha impresa con QR por
  curso-horario; el campo escanea y el registro se llena solo). Está en vara
  11/14 del GOAL con la costura simulada corriendo (12 etapas, exit 0).
- **Qué falta**: las 3 varas restantes del GOAL
  (`goal-campo-aulas-qr-registro-2026-08-16.md`); la decodificación EN la app
  quedó aparcada por decisión (D-L10 reformulada) y el conteo H/M manual está
  en propuesta de derivarse de plataforma (D-L46).
- **Para cerrarlo**: retomar el GOAL con datos del operativo real (los QR ya
  se imprimieron para el lote de 1.512 fichas).

### B6(b) · La ficha QR en PDF conectada al Drive
- **Qué es**: de los tres enlaces del operativo, (a) el enlace Kobo ya está a
  la mano en el Registro de campo (verificado a escala 1.512/1.512) y (c) la
  columna manual para la ficha escaneada existe; falta **(b): que la ficha QR
  en PDF quede conectada al Drive** (que el PDF generado suba/enlace a la
  carpeta del operativo).
- **Alerta operativa anotada**: en el libro generado desde ULT2 las 12
  columnas ENLACE DE LA FICHA salen vacías porque ULT2 aún no corre el
  handoff de Recopiladores (donde nace `row$link`). Ese handoff es
  prerequisito para que (b) tenga qué conectar.
- **Para cerrarlo**: correr el handoff de Recopiladores sobre ULT2 y cablear
  la subida/enlace al Drive.

### B8(h) · El octavo sub-ítem del libro publicado
- **Contexto**: B8 fue la revisión «a nivel del dueño» del libro publicado
  («se ve genuinamente fatal») — (a)–(g) están APROBADAS (filas por cadena,
  matriculados, columna MUESTRA fuera, desplegables, etc.). El sub-ítem (h)
  quedó DESBLOQUEADO (su bloqueo previo se resolvió) pero sin ejecutar.
- **Para cerrarlo**: releer la fila B8 del checklist, ejecutar (h) sobre el
  Sheets vivo con el protocolo leer-fusionar y verificación en vivo.

### B11 · El mapa horario confirmado del operativo
- **Qué es**: el dictado madre del 2026-09-01 («una vez que nos confirmen la
  hora… mapeo automático de todos los rangos horarios en los que se va a
  estar»). El MOTOR ya existe y hoy quedó mejor que el dictado: ventanas
  tentativas vs confirmadas, duración configurable (30, B70), ocupación con
  recojo (B71), mapa de horas con segmento de preparación.
- **Qué lo mantiene ◐**: sus dos conexiones declaradas — B2(3) la planilla
  por franja y B2.1b(b) la señal de choques de franja EN el plan del día del
  libro (el motor ya calcula los choques; falta pintarlos en esa hoja).
- **Para cerrarlo**: resolver esas dos conexiones (o declararlas cubiertas
  por B68 + el mapa de horas, con la palabra de Gonzalo).

### B69 · La pasada creativa libre del calendario
- **Qué es**: el «también el calendario podría verse mejor» del régimen. El
  grueso aterrizó hoy por otras filas (bandas de ocupación, sello alineado,
  KPIs llanos, croquis en palabras, segmento de preparación, selector
  elegante). Queda la pasada CREATIVA sin encargo concreto: tipografía,
  densidad y color del calendario mirados con ojos de diseñador y sin un
  dictado que la dirija.
- **Para cerrarlo**: una sesión de diseño con capturas antes/después y el
  veredicto de Gonzalo (es la clase de fila que solo su ojo cierra).

## C — Se cierran solas con el primer uso real

### B74 · Estreno del importar-disponibilidad con archivo real
- La vía completa está probada por tests y el botón vive en la vista (y en
  sus dos vacíos). Falta solo el PRIMER excel actualizado que mande el
  equipo: ese import real es el estreno y cierra el ciclo.

### Vistas de Calidad con datos
- Validación y control de calidad están vacías porque el estudio aún no tiene
  respuestas. Se llenan solas al llegar el campo; el filtro por facultad
  (B77) ya las espera con su guardia.

## D — Decisiones aparcadas (esperan la palabra de Gonzalo)

- **B2.1b(b)** — señal de choques de franja en el Plan del día del libro
  (propuesta del lead lista; el motor ya calcula los choques).
- **B2.1b(d)** — orden secundario por pabellón dentro de la franja (ruta
  física en el Plan del día).
- **D-L46** — para qué sirve el conteo H/M del parte. Propuesta del lead:
  derivarlo de las respuestas de plataforma (las cuotas sexo×facultad ya
  viven en la app) y NO pedir conteo manual al aplicador.
- **D-B2** — qué hojas profesionales lleva el libro y en qué orden.
  Propuesta: (1) avance por facultad, (2) plan del día, (3) planilla de
  aplicadores.
- **D-S3** — botón «generar libro» directo desde Entrega de cálculo de
  muestra. Sin respuesta aún.
- ~~Hoja «Asignación de aplicadores» en el Sheets vivo~~ — **RESUELTA la
  misma tarde** (0b746bba→f90290a5): cuarta hoja de la app del publicador,
  sembrada con bandas en el libro vivo; equipo `respetada` ×4 verificado en
  producción. De la misma tanda: bandas del Plan del día, vocabulario
  «aplicaciones» y el guardia de CSS concatenable tras la cirugía del bundle.
