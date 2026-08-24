# Validez estadística de la cadena del esperado — revisión exhaustiva

Tipo: Registro QA fechado
Estado: En curso
Fecha: 2026-08-20
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


Mandato de Gonzalo (2026-08-20, textual): «esto a pie a que hagamos una
revisión bien exhaustiva de si la forma como calculamos todo lo que estamos
calculando ahora es efectiva, es válida y toma en consideración todos los
elementos que debería tomar en consideración».

Doc vivo. Cada eslabón de la cadena con: enunciado, evidencia, tamaño de
base (k), y veredicto. Vara de veredictos: **sólido** (medido con base
suficiente), **defendible** (medido con base delgada o supuesto estándar),
**débil** (supuesto sin medición propia), **defecto** (encontrado y por
corregir).

## La cadena

`cuota (diseño) → P25 × τ (dimensionamiento) → curvas docente/tamaño →
factor de facultad → esperado por aula → certificación por facultad →
Monitoreo (valor de validez)`

## Inventario de supuestos

| # | Eslabón | Enunciado | Evidencia | k | Veredicto |
|---|---|---|---|---|---|
| 1 | Cuota | n = 2.381 por fórmula (95 %, p 0,30, e 2,46 %, deff 2,0); muestra fijada 2.500; sobremuestra ×1,5; afijación proporcional facultad×sexo | Diseño 2025 declarado y replicado; p=0,30 y deff=2,0 son supuestos de diseño, no mediciones 2026 | — | defendible; **pendiente**: medir deff real del 2025 ejecutado para confirmar el 2,0 |
| 2 | P25 | El tamaño típico del aula por facultad es su percentil 25 de elegibles | Calculado del marco vigente 2026 (dato completo, no muestra); decisión sellada de Gonzalo | 15/15 fac. | sólido (es un percentil del universo, no una estimación) |
| 3 | τ = 0,53 | Tasa condicional efectivas/elegibles-sentados sobre aulas APLICADAS del 2025 | Medido del 2025 ejecutado (194 aplicadas) | k=194 | sólido como agregado; **pendiente**: re-verificar el denominador exacto de elegibles-en-aplicadas contra la base fuente |
| 4 | P(aplicación por docente) | Contratado 0,87 · Ord.-Asociado 0,84 · Ord.-Principal 0,73 | Medido del 2025 (aulas agendadas→aplicadas por tipo) | k por tipo **sin registrar** | defendible; **pendiente**: registrar k e IC por tipo |
| 5 | Rendimiento por tamaño | ≤15→0,80 · 16-25→0,69 · 26-35→0,56 · 36-50→0,55 · >50→0,44 (condicional a aplicada) | Medido del 2025 aplicado; monotónico como se esperaría | k por bin **sin registrar** | defendible; **pendiente**: k e IC por bin (la referencia v2 tiene celdas facultad×tamaño con suficiencia, vara asistencia) |
| 6 | Factor de facultad | τ_fac/τ_base en las 6 facultades con suficiencia (referencia v2: C&I sólida k=40; EGC 26, EGL 23, CCSS 17, DER 16, A&D 12 delgadas) | τ_fac medido (EF8b, vara de efectivas sobre aplicadas 2025) | k arriba | **defecto — ver hallazgo V1** |
| 7 | Multiplicatividad | p × r × factor sin interacciones | No verificada; V1 demuestra que factor↔r SÍ interactúan (composición) | — | débil → se corrige con la forma residual de V1 |
| 8 | Certificación | Garantía por facultad con τ plano 0,53 × elegibles | Contradice la mirada por aula (DER: cert ~1,0× vs esperadas 0,90× pre-factor) | — | **defecto conocido** (checklist tarde-3): migrar a Σesperadas |
| 9 | Meta de Monitoreo | El esperado por aula es el valor de validez; sin meta, sin juicio | Contrato cerrado con la sesión de Monitoreo; meta_origen/factor/k viajan por fila | 2.616 CH | sólido como contrato |

## Hallazgo V1 — el factor sellado sobre-corrige composición (2026-08-20)

El factor `τ_fac/τ_base` ignora que la curva de tamaño YA produce variación
por facultad (su mix de aulas). Medido sobre los titulares vigentes,
comparando la tasa condicional que la curva de tamaño sola produce (r̄_fac =
Σ el·r / Σ el) contra el τ_fac medido:

| Facultad | r̄ (curva tamaño, mix 2026) | τ_fac medido 2025 | Residual condicional | Factor sellado |
|---|---|---|---|---|
| DERECHO | 0,563 | 0,562 | **0,999** | 1,060 |
| CIENCIAS SOCIALES | 0,577 | 0,550 | 0,954 | 1,038 |
| CIENCIAS E INGENIERÍA | 0,564 | 0,538 | 0,954 | 1,015 |
| ARTE Y DISEÑO | 0,652 | 0,519 | **0,796** | 0,979 |
| EE.GG. LETRAS | 0,477 | 0,444 | 0,931 | 0,838 |
| EE.GG. CIENCIAS | 0,488 | 0,428 | 0,878 | 0,808 |

Lecturas: (a) el τ bajo de Derecho es SU MIX DE TAMAÑOS, no su
comportamiento — el factor sellado le regala un +6 % injustificado; (b) a
EGL/EGC el tamaño ya les explica la mayor parte y el factor sellado las
castiga dos veces; (c) el caso conductual genuino es Arte y Diseño (rinde
20 % bajo lo que su mix predice) y el factor sellado casi no la toca.

**Corrección propuesta**: factor residual `τ_fac / r̄_fac`, idealmente con
r̄_fac calculado sobre el MIX 2025 aplicado (la misma base donde se midió
τ_fac) para no atribuir a comportamiento lo que es cambio de mix entre
años. Las fuentes 2025 (solo lectura) permiten medirlo. Con el residual, la
Σ esperadas por facultad reproduce por construcción la tasa medida de la
facultad.

**Estado**: factor sellado vigente en el .pulso (Σ 3.020); corrección
pendiente del visto de Gonzalo. La medición r̄_fac-2025 ya está hecha (V1b).

## V1b — residual definitivo sobre el mix 2025 aplicado (medido de la fuente)

Fuente: HSVBG2025_base_historica_aulas_ADR0060.xlsx, hoja «Solo aplicadas»
(194 filas). τ global verificado EXACTO: 3.303/6.232 = 0,5300 (cierra el
pendiente del eslabón 3: el denominador son los elegibles sentados en las
194 aplicadas).

| Facultad | k | τ_fac exacto | r̄ (bins sobre mix 2025) | RESIDUAL 2025 | sellado hoy |
|---|---|---|---|---|---|
| CIENCIAS E INGENIERÍA | 40 | 0,5380 | 0,5802 | **0,927** | 1,015 |
| EE.GG. CIENCIAS | 26 | 0,4279 | 0,4970 | **0,861** | 0,808 |
| EE.GG. LETRAS | 23 | 0,4435 | 0,4791 | **0,926** | 0,838 |
| CIENCIAS SOCIALES | 17 | 0,5498 | 0,5993 | **0,917** | 1,038 |
| DERECHO | 16 | 0,5620 | 0,5540 | **1,015** | 1,060 |
| ARTE Y DISEÑO | 12 | 0,5186 | 0,6014 | **0,863** | 0,979 |

## Hallazgo V2 — los bins de rendimiento sobre-predicen ~6 % (2026-08-20)

Sobre el MISMO mix 2025 aplicado del que nacieron, los bins codificados
(0,80/0,69/0,56/0,55/0,44) producen r̄ global = 0,5614 frente al 0,5300
real: **sesgo de calibración de +5,9 %**, probablemente por redondeo de los
bins o por promediar tasas simples en vez de razón de sumas. Consecuencia:
las nueve facultades sin τ propio, hoy con factor 1,0, quedan
sobre-predichas ~6 %. Corrección coherente: su factor debe ser el residual
GLOBAL (0,944), declarado como «corrección de calibración general, sin tasa
específica de facultad».

## Propuesta integrada (decisión de Gonzalo, con impacto)

Factor = residual-2025 en las seis; 0,944 en las nueve restantes. Efecto
estimado sobre titulares (esperadas base curvas × residual):

| Facultad | esp. sellada | esp. residual-2025 | cuota | margen residual |
|---|---|---|---|---|
| C&I | 655 | 598 | 528 | 1,13× |
| EGC | 388 | 413 | 403 | 1,02× |
| EGL | 381 | 420 | 397 | 1,06× |
| DERECHO | 347 | 332 | 363 | **0,91×** |
| CCSS | 184 | 162 | 149 | 1,09× |
| A&D | 196 | 173 | 119 | 1,45× |
| RESTO (×0,944) | 871 | 822 | — | — |
| **Σ** | **3.020** | **≈2.920** | 2.500 | 1,17× |

Derecho queda corta (0,91×: su p de aplicación baja —muchos
ordinario-principal— más su residual ~1 ya no la rescata): pediría ~2 aulas
más o confianza explícita en su cadena. El techo de visitas (200) sigue
excedido por el plan (229): ambas cosas son la MISMA decisión operativa.

## V3 — las curvas verificadas con k e IC (eslabones 4 y 5, cerrados)

**P(aplicación | tipo de docente)** — denominador: aulas intentadas
(aplicada + caída + no aplicada), Wilson 95 %:

| Tipo | aplicadas/intentadas | tasa | IC95 | embebida | veredicto |
|---|---|---|---|---|---|
| Contratado | 167/193 | 0,865 | [0,810–0,906] | 0,87 | sólido |
| Ordinario-Principal | 27/37 | 0,730 | [0,570–0,846] | 0,73 | defendible (IC ancho) |
| Ordinario-Asociado / resto | — | — | — | 0,84 | **sin base 2025 propia** (la base 2025 no tiene asociados); el 0,84 coincide con la tasa global 194/230 = 0,843 → se declara como «tasa general de aplicación», no como medición del tipo. En 2026 hay 638 aulas de asociados llevándola: el eslabón más débil que queda. |

**Rendimiento por tamaño** — razón de sumas exacta, bootstrap 2000 reps:

| Bin | k | Σeleg | tasa exacta | IC95 | embebida | sesgo |
|---|---|---|---|---|---|---|
| ≤15 | 26 | 309 | 0,809 | [0,726–0,891] | 0,80 | −0,009 |
| 16–25 | 53 | 1.104 | 0,642 | [0,580–0,703] | 0,69 | +0,048 |
| 26–35 | 38 | 1.149 | 0,566 | [0,500–0,638] | 0,56 | −0,006 |
| 36–50 | 50 | 2.104 | 0,500 | [0,458–0,545] | 0,55 | **+0,050 (embebida FUERA del IC)** |
| >50 | 27 | 1.566 | 0,409 | [0,346–0,473] | 0,44 | +0,031 |

El sesgo V2 (+5,9 % global) sale sobre todo de los bins 16–25 y 36–50 (los
dos más poblados); el 36–50 está significativamente sobre-predicho.

## Propuesta v2 — la corrección integrada FINAL (decisión de Gonzalo)

1. **Recalibrar los bins a la razón de sumas exacta**: 0,809 / 0,642 /
   0,566 / 0,500 / 0,409. Con ellos, r̄ sobre el mix 2025 = 0,5298 ≈ τ
   0,5300: V2 desaparece por construcción y las nueve facultades sin τ
   propio quedan bien calibradas con factor 1,0 (ya no hace falta el 0,944).
2. **Residual por facultad sobre los bins corregidos** (las seis): C&I
   0,972 · EGC 0,917 · EGL 0,985 · CCSS 0,960 · **DER 1,115** · A&D 0,910.
   Con los bins corregidos, Derecho emerge como el atípico genuino (+11,5 %
   sobre su mix) y EGL queda prácticamente explicada por el tamaño (0,985).
3. **P(aplicación)**: contratado 0,865 · ordinario-principal 0,730 ·
   resto 0,843 declarado como tasa general.

**Impacto 2026 medido (titulares vigentes)**: Σ esperadas ≈ **2.911**
(1,16× la muestra de 2.500). Por facultad: 14 de 15 cubren cuota (C&I
1,12× · EGL 1,05× · EGC 1,02× · CCSS 1,10× · GES 1,07× · resto ≥1,1×);
**DERECHO 0,92×** (333 vs 363) — su carga de ordinario-principal domina
incluso con su residual positivo. Decisión operativa única: ~2 aulas más a
Derecho o confianza declarada en su cadena, junto con el techo (plan 229 vs
techo 200).

## V4 — el deff real del 2025 (eslabón 1, cerrado): el 2,0 asumido es conservador

Linealización de conglomerados sobre las 194 aulas aplicadas (n = 3.303
efectivas, m̄ = 17,0 por aula), simple y estratificada por facultad (la
versión fiel al diseño, que estratificó por facultad×sexo):

| Desenlace | p̂ 2025 | deff simple | deff estratificado | ρ intra-aula |
|---|---|---|---|---|
| Prevalencia HS | 0,214 | 1,55 | **1,08** | 0,005 |
| Prevalencia VBG | 0,303 | 1,29 | **1,12** | 0,007 |
| % mujeres | 0,527 | 4,70 | 1,85 | 0,053 |

Lecturas: (a) los desenlaces sustantivos casi no se aglomeran por aula — el
deff real estratificado es ~1,1 frente al 2,0 asumido: **el diseño es
conservador con margen** (error efectivo real ≈ 1,8 % frente al 2,46 %
nominal); (b) el % mujeres sí se aglomera (carreras segregadas), pero el
sexo está controlado por la afijación facultad×sexo, así que no daña; (c)
bonus de calibración: el p = 0,30 asumido en la fórmula coincide casi
exacto con la prevalencia VBG real del 2025 (0,303). El eslabón 1 pasa a
**sólido (conservador declarado)**.

## Cola de mediciones pendientes

- [x] r̄_fac sobre el mix 2025 aplicado → V1b (medido 2026-08-20).
- [x] k e IC de P(aplicación) por tipo → V3 (2026-08-20).
- [x] k e IC del rendimiento por bin → V3 (2026-08-20); bins exactos propuestos.
- [x] deff real del 2025 → V4: 1,08–1,12 estratificado; el 2,0 asumido es conservador.
- [x] Denominador exacto de τ=0,53: 3.303/6.232, k=194 (verificado en V1b).
- [ ] Certificación por Σesperadas (eslabón 8) — decisión de Gonzalo.

## V5 — el dimensionamiento re-verificado con la calibración v2 (pregunta de Gonzalo)

«¿Este nuevo cálculo ya fue tomado en cuenta para ver si siguen siendo
~190 aulas?» Respuesta medida (2026-08-20):

- Con la **tasa condicional v2 por facultad** (la vara del τ, sin doble
  conteo del riesgo de caída que la cadena cubre): el pedido sería
  **190 aulas** (vigente: 197; rango normal 170–210 ✓). Movimientos:
  EGC 25→30 (+5), EGL 23→26 (+3); bajan 1–3 las facultades chicas con
  tasas condicionales altas (AE 11→9, A&D 17→14, CyA 10→8, DER 18→16 —
  la tasa condicional de Derecho es ALTA, 0,568: su problema es de
  visitas/aplicación, no de cupos).
- Con la tasa **incluyendo el riesgo de aplicación** (vara del
  presupuesto de VISITAS, no de cupos): 228 intentos esperados — casi
  idéntico al plan de visitas vigente (229): el presupuesto actual ya
  refleja la realidad v2.

La decisión 1 (propuesta v2) tiene por tanto DOS alcances posibles:
(1a) recalibrar solo los esperados (sin re-sorteo; las 197 quedan);
(1b) recalibrar esperados Y re-dimensionar a 190 (re-sorteo completo,
reparto nuevo con EGC/EGL arriba). Ambos dentro del rango; 1b es el
diseño plenamente coherente, 1a el de menor disrupción operativa.

## V6 — la pregunta de Gonzalo destapa dos esperados donde entregábamos uno (2026-08-20)

Su pregunta textual: «si un profesor no deja entrar al aula, esa aula no
se aplica — sigo sin entender cómo eso influye en la cantidad de
efectividad de un curso-horario». Y tiene razón: el riesgo del docente
es TODO-O-NADA por aula; el × P solo tiene sentido como valor esperado
ex-ante del CUPO, nunca como estándar de un aula ya aplicada.

Corrección al contrato (entra al paquete 1b):
- **Esperado del cupo** = E × P × R × F — presupuesto de visitas,
  certificación, dimensionamiento (el aula puede caerse; la cadena repone).
- **Esperado del aula aplicada** (condicional) = E × R × F — el VALOR DE
  VALIDEZ que Monitoreo usa en campo. Juzgar una aplicada contra el
  esperado-con-P le regala el veredicto en exactamente el riesgo que ya
  no existe (13–27 % según el docente).
Cada reemplazo activado se juzga contra SU propio condicional.
Implementación: publicar ambas columnas con nombre propio en el plan
(p. ej. efectivas_esperadas_cupo y efectivas_esperadas_aplicada) y
avisar a Monitoreo que el valor de validez migra a la condicional.

## V7 — el rediseño que pidió Gonzalo, resuelto con medición (2026-08-20)

Su objeción textual: «cuando yo agendo un aula espero sí o sí aplicarla;
si se cae, la reemplazo… el tipo de docente en todo caso garantizaría
efectividad vía asistencia… me suena a jalado de los pelos: hay que
repensar cómo calculamos las efectivas esperadas y darle un nombre al
indicador por aula».

MEDICIÓN DECISIVA (aulas aplicadas 2025, control por tamaño): el tipo
de docente NO mueve la efectividad condicional — contratado residual
1,007 [0,955–1,066] (k=167), ordinario-principal 0,959 [0,831–1,102]
(k=27). Una vez aplicada, el aula rinde lo que su tamaño y facultad
explican. El docente decide solo SI se aplica.

EL DISEÑO FINAL (sustituye la dualidad de V6 por algo más simple):

- **Tasa de efectividad del aula** (el indicador por aula, con nombre
  propio) = R(tamaño) × F(facultad). Dos criterios, ambos con evidencia;
  el docente SALE de la ecuación con evidencia, no por gusto.
- **Efectivas esperadas** = Elegibles × tasa de efectividad del aula.
  UN solo esperado condicional: sirve igual para certificar (la cadena
  repone caídas) y para el veredicto de Monitoreo en campo.
  Ej.: Prospección = 24 × 0,642 × 0,972 = 15,0.
- **Tasa de aplicación** (por tipo de docente: 0,865/0,730) se muda a la
  capa OPERATIVA: presupuesto de visitas (intentos > cupos por caídas),
  profundidad de cadena requerida por facultad (Derecho, cargada de
  ordinarios-principales, necesita cadenas más hondas) y riesgo de cupo
  sin reemplazo viable. Nunca multiplica efectivas.

Escalera de nombres final: tasa de efectividad DE LA FACULTAD (dimensiona)
→ tasa de efectividad DEL AULA (R×F) → EFECTIVAS ESPERADAS (E × tasa del
aula; valor de validez) → TASA DE APLICACIÓN (operativa). El global 0,53
muere en superficies (directiva previa).

## V8 — barrido final del 2025: no queda nada más (2026-08-20)

Mandato: «una última revisión exhaustiva de los datos del 2025 para ver
si hay algo más». Con la vara de V7 (residual condicional vs tamaño, IC
bootstrap 2000): bloque horario (4 categorías, todas IC ∋ 1), día de
semana (5, todas ∋ 1), fatiga de campo por semana (sin patrón: 1,04 /
0,93 / 1,07), reagendas (sin variación registrada), tipo de curso y
modalidad (constantes: todo teórico presencial). Único destello: nivel 8
con residual 0,873 [0,774–0,974] — descartado como artefacto de
comparaciones múltiples (1 celda de 8 testeadas, sin patrón
dosis-respuesta entre niveles). VEREDICTO: el modelo E × R(tamaño) ×
F(facultad) es todo lo que el 2025 sostiene. Plan de ejecución:
plan-1b-esperado-redefinido-2026-08-20.md.
