# ADR 0082 — La τ del diseño es un supuesto fechado y el campo lo contrasta

- **Estado**: Aceptado
- **Implementación**: En curso — motor, contrato y tabla de decisión
  completos; series por día y semana pendientes
- **Ámbito**: Cálculo de muestra · dimensionamiento de cursos-horario ·
  Monitoreo de aulas universitarias · contrato calc-muestra → Monitoreo
- **Fecha**: 2026-08-26 · **Ratificado**: 2026-08-26 (Gonzalo, sobre el diseño
  de `docs/qa/seguimiento-tau-campo-2026-08-26.md`)
- **Relación**: hereda de
  [ADR 0079](0079-el-cumplimiento-se-mide-contra-la-cuota-del-diseno.md) la
  separación diseño/operativo y la regla de que la cuota no se compensa entre
  facultades; respeta el límite que fija
  [ADR 0066](0066-la-probabilidad-publicada-es-la-del-sorteo-ejecutado.md) —la
  π publicada es la del sorteo ejecutado, así que ninguna medición de campo
  puede redimensionar la muestra a media corrida—; usa el vocabulario del
  [ADR 0060](0060-vocabulario-del-embudo-de-aulas.md).

## Contexto

El dimensionamiento de aulas compra aforo con la fórmula
`⌈cuota / (p25 × τ)⌉`. La τ de cada facultad **no es una constante de la app**:
se compone por estandarización en `calc_muestra_aulas_tasas_facultad()`,

    τ(facultad) = mix_de_tamaños × factor_residual

donde el *mix* es el rendimiento medio que le toca a esa facultad sólo por
cómo se reparten sus aulas entre los tramos de tamaño —las chicas rinden más—
y el *residual* es lo que esa facultad rindió en el histórico **más allá** de
su mix. En HSVG2026 los tramos sellados van de 0,809 (≤15 elegibles) a 0,409
(>50), y las quince τ resultantes van de **0,409 en EE.GG. Ciencias a 0,800 en
Letras y CC.HH.**

Tres hechos que este ADR existe para no dejar implícitos:

1. **Los quince valores salen del campo 2025. Ése es su único respaldo
   empírico.** No hay una segunda medición, ni un intervalo publicado, ni
   ninguna superficie que diga de cuándo son.
2. **El residual sólo está medido en 6 de las 15 facultades.** Las otras nueve
   llevan 1,000 porque su histórico no llegó al corte de suficiencia
   (`.cm_tau_k_minimo <- 12`, argumentado en
   `api/R/calc_muestra_aulas_tau_facultad.R`). Un 1,000 no es «esta facultad
   rinde según su mix»: es «el histórico no pudo decir nada más», y las dos
   cosas se leen igual en pantalla.
3. **El módulo de certeza ya declara este hueco y nadie lo cierra.**
   `calc_muestra_aulas_certeza.R` publica, literal, en su bloque `criterio`:

   > `no_cubre`: «La incertidumbre de τ. Su intervalo lo publica la referencia
   > histórica de asistencia.»

   Es decir: el Monte Carlo del sorteo simula qué aulas salen, no si rinden lo
   previsto. La exención está escrita y no tiene destinatario.

**Qué está realmente en juego.** La prueba de estrés hecha el 2026-08-26 sobre
HSVG2026 muestra que con τ un 5 % por debajo de lo previsto, **EE.GG. Ciencias
queda 4,1 alumnos corta de su cuota y EE.GG. Letras 0,2**. Son justo las dos de
τ más baja — las que menos colchón compraron, porque la fórmula divide por τ y
un τ chico ya se gastó su margen en aulas. Y el riesgo no es el que el operativo
teme: en 2025, de 196 aulas agendadas sólo 2 no se aplicaron (~1 %). **La
pérdida de aulas está resuelta por las cadenas de reemplazo; lo que no está
cubierto es que la asistencia general baje.** Ese modo de falla no produce
ninguna alerta hoy, porque el tablero cuenta aulas aplicadas y encuestas
conseguidas, nunca la tasa que las liga.

**El obstáculo medido.** Hoy conviven en Monitoreo tres tasas de la misma
forma —efectivas sobre elegibles— con **tres numeradores distintos**, y ninguna
es comparable con la τ del diseño sin decir cuál es:

| Dónde | Numerador | Superficie |
|---|---|---|
| Parte de campo | `effective_surveys`, lo que el aplicador anotó al salir | `rendimientoPorFacultad.delPotencial` («Del potencial», pestaña Rendimiento) |
| Base de control | `sent_total`, lo que la hoja del equipo cuenta como enviado | `alcanceDelBanco.tasaObservada` (58,7 % sobre 102 aulas) |
| Plataforma | respuesta válida que pasa los filtros declarados | `avance_cuota.respuestas_validas`, `monitoreo_aulas_efectivas_por_aula()` |

`monitoreo_aulas_efectivas.R` ya fijó el vocabulario —«la efectiva se define en
la plataforma, no en el parte»— pero la pestaña que hoy dice «Del potencial»
usa el parte, y la que proyecta el banco usa la hoja. Publicar un «τ observado»
sin resolver esto reproduciría el defecto más caro de este repo: **un rótulo
que promete otro número.**

Y el dato del diseño ya llega: `.monitoreo_aulas_metas_diseno()` deja
`design_targets$facultades[[i]]$tau` en la config del import desde H3. Lo que no
existe es un consumidor — `avance_cuota` sólo publica la τ **compartida** y la
deja en `NA` justo cuando difiere por facultad, que es el caso de HSVG2026.

## Decisión

**τ es un supuesto declarado, con procedencia fechada y alcance explícito, y
el campo lo contrasta contra sí mismo mientras corre. Contrastarlo no lo
reescribe.**

1. **τ se publica con su procedencia y su fecha, nunca desnuda.** Toda
   superficie que muestre una τ dice de dónde sale (`tau_disenio`,
   `certificacion`, `calibracion_embebida`, `tau_global`), de qué periodo, y
   —cuando el residual es 1,000— que el histórico no le dio base propia en vez
   de dejar leer un 1,000 como medición.

2. **Lo que τ NO cubre, escrito donde se usa.** Su propio intervalo; un cambio
   de régimen de asistencia entre años; el bloque horario (medido en 2025 —la
   mañana especial pierde 15 puntos de aplicación, la noche rinde 0,40— y **no
   derivable del marco**, porque `schedule` es código de sección y no hora); el
   tipo de curso (2025 fue todo teórico: los talleres no tienen prior); y el
   residual de las nueve facultades sin base propia.

3. **τ observado tiene un solo numerador: la efectiva de plataforma.** Es la
   misma clase de tasa que dimensionó y la misma con la que el ADR 0079 mide
   cumplimiento. El parte y la Base de control **no producen τ**: producen la
   reconciliación que ya vive en `AulasParteContraPlataforma`, y se muestran
   como cuadre, con su propio rótulo, nunca junto a τ bajo el mismo nombre.

4. **El denominador son los elegibles de las aulas APLICADAS al corte**, no los
   del plan. Un aula sin aplicar no rinde cero: todavía no rinde. Meterla al
   denominador hunde la tasa los primeros días y produce una alarma que sólo
   dice que el campo empezó.

5. **La comparación publica banda, y la alerta la dispara la banda, no el
   punto.** Con k pequeño la τ de una facultad es ruido: ya está medido en este
   repo dos veces —dos tercios de la varianza entre facultades del histórico es
   error de estimación (τ² ≈ 0,0099 contra 0,0301 observada), y por eso existen
   el corte `k ≥ 12` y el prior declarado de cinco aulas de
   `rendimientoPorFacultad`—. Se publica la τ cruda **y** su banda; se señala
   una facultad cuando la banda excluye su τ prevista, jamás cuando el punto
   la cruza. No se introduce un tercer mecanismo de encogimiento: se reusa el
   prior ya declarado.

6. **La consecuencia se expresa en alumnos contra la cuota, no en puntos de
   τ.** «EE.GG. Ciencias rinde 0,38 contra 0,41 previsto» no es accionable;
   «al ritmo de rendimiento observado cierra 4 alumnos corta y le quedan 3
   reservas» sí. El déficit se calcula y se acumula **por facultad**: pasarse
   en Derecho no cubre lo que falta en Letras (ADR 0079).

7. **Contrastar no redimensiona.** La τ observada informa la **activación de
   reservas**, que es una decisión operativa sobre aulas que el diseño ya
   sorteó y dotó. No reescribe τ, no recalcula `⌈cuota / (p25 × τ)⌉` a media
   corrida y no altera ninguna π: la probabilidad publicada sigue siendo la del
   sorteo ejecutado (ADR 0066), y las reservas suman al numerador del
   cumplimiento y nunca al denominador (ADR 0079).

8. **El seguimiento vive en `Monitoreo > Avance > Efectividad`**, pestaña
   propia, no en Validación ni apilado dentro de Rendimiento. τ no es un
   control de calidad del dato: es el supuesto que dimensionó la muestra,
   medido contra el campo — la misma familia de pregunta que `avance_cuota`.
   Validación responde «¿esta aula está bien aplicada?»; esto responde «¿el
   estudio va a cerrar su cuota?». Y no se apila bajo Rendimiento porque las
   dos miden efectivas sobre elegibles con numeradores distintos: vecinas y sin
   nada que las separe, el lector no tiene forma de saber cuál está leyendo.

## Consecuencias

- **Entra un bloque de contrato nuevo**, `monitoreo_aulas_efectividad_seguimiento_v1`,
  con τ prevista y observada por facultad, banda, k, déficit en alumnos y serie
  por día y por semana. Va en archivo propio; `monitoreo_aulas_universitarias.R`
  (118 KB) no crece.
- **`avance_cuota` gana la τ por fila.** Hoy la deja en `NA` cuando difiere por
  facultad, que es justo cuando hace falta. El agregado compartido se conserva.
- **La pestaña «Rendimiento» cambia de numerador o cambia de rótulo.** Sus tres
  tasas salen del parte; τ sale de plataforma. Conviven sólo si cada una dice
  su fuente — y «Del potencial» deja de ser un nombre admisible para una tasa
  que no es la del diseño.
- **Un 1,000 de residual se vuelve visible como ausencia.** Nueve facultades de
  quince lo llevan, y hasta hoy se leían como medidas.
- **Cumplido**: 49 aserciones del motor (`test-monitoreo-aulas-efectividad-seguimiento.R`)
  y 10 de la superficie (`AulasEfectividadSeguimiento.test.tsx`).
- **Coste asumido**: la banda hará que las primeras dos semanas casi ninguna
  facultad dispare alerta. Es correcto y es el punto: con tres aulas aplicadas
  no hay nada que afirmar, y una alarma temprana que después se desdice quema
  la credibilidad del tablero justo cuando aún se puede reaccionar.
- **Lo que sigue sin cubrirse, dicho**: este ADR mide τ, no la explica. Si el
  rendimiento cae, no dirá si fue el horario, el tipo de curso o el
  agotamiento del campo — las tres señales que 2025 dejó sin base usable.

## Cumplimiento

1. Test de contrato del bloque nuevo: τ prevista por facultad presente cuando
   `design_targets` la trae, y ausente declarada —no 0— cuando no.
2. Test de numerador: la τ observada del bloque coincide con
   `monitoreo_aulas_efectivas_por_aula()` sobre las aulas aplicadas, y **no**
   con la suma de `effective_surveys` ni de `sent_total` en un fixture donde
   las tres difieren a propósito.
3. Test de denominador: un aula del plan sin aplicar no entra al denominador;
   un aula aplicada con cero efectivas sí.
4. Test de banda: con k = 1 **no hay banda** —una observación no tiene
   dispersión que medir— y la facultad no se señala aunque el punto esté lejos;
   con k grande y una desviación real, se señala; y con k grande y una
   diferencia que la banda cruza, queda conforme y no gasta reservas.
5. Test de no compensación: un superávit en una facultad no reduce el déficit
   agregado de las demás.
6. `ui-quick-check` sobre la pestaña, con sus vacíos clasificados (C3) y su
   geometría declarada (C2).

## Notas

De dónde salen las cifras de este ADR, para que se puedan rehacer:

- Los tramos de rendimiento y las quince τ: `calc_muestra_aulas_efectividad.R`
  (`.cm_efectividad_rendimiento`, tramos sellados en la config del estudio) y
  `calc_muestra_aulas_tasas_facultad()`, que publica `mix`, `factor_residual`
  y `mix_tramos` por facultad.
- El corte de suficiencia y su discusión —incluido el encogimiento parcial que
  se midió y se descartó, con GASTRONOMÍA k=3 recibiendo peso 0,93—:
  `calc_muestra_aulas_tau_facultad.R`.
- La exención declarada: `calc_muestra_aulas_certeza.R`, bloque `criterio`,
  campo `no_cubre`.
- Las tres tasas homónimas: `rendimientoPorFacultad.ts` (parte),
  `alcanceDelBanco.ts` (hoja) y `monitoreo_aulas_efectivas.R` (plataforma).
- La τ del diseño llegando a Monitoreo: `.monitoreo_aulas_metas_diseno()` →
  `cfg$design_targets$facultades[[i]]$tau`.
- La prueba de estrés (−5 % de τ) y el 2 de 196 de 2025: sesión del 2026-08-26
  sobre HSVG2026; diseño de seguimiento en
  `docs/qa/seguimiento-tau-campo-2026-08-26.md`.
