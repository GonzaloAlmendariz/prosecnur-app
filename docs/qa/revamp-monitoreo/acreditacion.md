# Revamp de Monitoreo · Acreditación — arquitectura y fichas por pestaña

Tipo: Especificación de maqueta (copia durable del lienzo)
Estado: En curso
Situación: Fichas completas con el esqueleto común (Insumos · Modelo · Control · Avance), pendientes de tu revisión
Fecha: 2026-10-22
Autoridad: Gonzalo (pedido de sesión)
Lienzo: https://claude.ai/artifact/NKWF6WjdTjqcrTevsCiYRY («Revamp de Monitoreo · Acreditación», privado)
Estándar: `docs/qa/revamp-monitoreo/estandar-de-ficha.md` (v2, con §2b y «Realismo operativo» en §0)
Procedimientos: `docs/qa/revamp-monitoreo/procedimientos-respondidos.md` manda sobre cualquier supuesto de este documento.
Proyectos de referencia (copias de trabajo, nunca los originales):

| Proyecto | Qué es | Corte | Qué es real y qué no |
|---|---|---|---|
| `ACRDCONTA` | Acreditación Contabilidad PUCP: 4 públicos, 13 fuentes (4 padrones en Sheets, 1 barrido telefónico, 1 hoja de correos completos, 7 encuestas de SurveyMonkey), sin Mailchimp | 23/07/26 18:09 (Lima) | Todo real. Los responsables del barrido se muestran como «Responsable 1…6»; las llaves de las personas, enmascaradas (`cód. ••••29`). |
| `Acreditación institucional (QA)` | Acreditación Institucional PUCP 2026: 9 públicos + piloto, 20 fuentes, token por persona, Mailchimp | 22/10/26 11:59 | **Padrones (45,078 personas + 7 del piloto), metas (8,503), cuotas (4) y Mailchimp (2 envíos del piloto) son reales. Las respuestas de los 9 públicos son SIMULADAS** (fuentes «Respuestas simuladas · …», 6,080 filas, fechadas del 27/10 al 06/11, después del corte). Solo el piloto tiene 4 respuestas reales (2 efectivas). No es una muestra parcial: el padrón está completo, al 100 %. |

**Toda cifra de efectivas, parciales, rechazos, avance, tasas, ritmo o cuotas del proyecto institucional es simulada**
y así se lee en este documento. En las maquetas se usa el rótulo del proyecto tal cual («Acreditación institucional
(QA)») y el de sus fuentes («Respuestas simuladas · …»), sin rótulos añadidos.

Cómo se obtuvieron las cifras: lectura de `state.rds` de las dos copias con `Rscript`; para el institucional, que no
trae tablero en caché, se corrieron sin red las funciones puras del motor
(`.monitoreo_acreditacion_internal_queries`, `monitoreo_cuotas_modelo`, `monitoreo_mailchimp_modelo`,
`monitoreo_build_dashboard`) sobre la copia: cruce 45.6 s, tablero 49.2 s. Scripts y datos en el scratchpad de la sesión
(`acreditacion2/scripts/extraer.R`, `derivar_inst.R`, `data/datos.json`). Ninguna sincronización ni llamada a Kobo,
SurveyMonkey, Sheets o Mailchimp.

En el lienzo, los tableros que existen en los dos proyectos alternan con el botón del proyecto en la barra superior
(«otro proyecto»): es un recurso del lienzo, no un control de la app.

---

## 0. Preguntas para Gonzalo

Lo que depende de estas respuestas quedó sin dibujar o como «Por definir». Ninguna detiene el resto del lienzo.

| # | Pregunta | Opciones y qué haría con cada una |
|---|---|---|
| P1 | ¿Cómo debe ordenarse por defecto la cola de Reintentos? El supervisor decide mirando intentos, status y observación; la maqueta ordena por intentos, de más a menos, y lo rotula como «por definir». | (a) Por intentos, de más a menos: arriba los candidatos a dejar de insistir; queda como está. (b) Por status y, dentro, por intentos: agrupa «Contactar después» arriba; cambio de una línea. (c) Sin orden propio, el de la hoja: la cola copia el orden del Sheets y se quita el rótulo. |
| P2 | ¿Qué status forman la cola de insistencia en una acreditación? Hoy la familia «Reintentable» del motor junta No contesta 61, Apagado 17, Contactar después 5 y Contactado por WhatsApp 1. | (a) Esos cuatro: queda como está. (b) Sin «Contactado por WhatsApp», que ya tuvo contacto: la cola baja a 83 y ese caso pasa a Barrido. (c) Lo declara cada proyecto en Insumos › Reglas: se agrega una lista de status reintentables a I3. |
| P3 | ¿Hay supervisión por rellamada en una acreditación, como en el telefónico (muestra de efectivas por responsable, resultado en una hoja aparte)? Hoy el `.pulso` guarda tamaño 20 y semilla, sin hoja de resultados. Quité el panel de Calidad. | (a) Sí, igual que el telefónico: Calidad suma un panel condicional que lee el Sheets de supervisión y adopta el componente de Telefónico. (b) No: se quita la configuración de supervisión del perfil de acreditación. (c) Solo el sorteo, sin resultado: un panel que lista a quién rellamar, sin «verificadas». |
| P4 | Cuando barrido y plataforma no coinciden (1 efectiva solo al teléfono; 38 encuestas completas sin efectiva telefónica), ¿qué manda y quién lo resuelve? En el telefónico manda el Kobo y la discrepancia es una cola del supervisor. | (a) Manda la plataforma y la discrepancia entra a Por resolver como un tipo más, con decisión auditada. (b) Manda la plataforma y la matriz de Barrido solo informa (como está hoy). (c) Manda el barrido. |
| P5 | El cliente recibe avance por público y avance por cuota, pero el Sheets del cliente de ACRDCONTA tiene 7 pestañas (Reporte, Detalle del avance, Avance por encuesta y una por público) y ninguna de cuota. | (a) Se agrega una pestaña «Avance por cuota» al Sheets del cliente: A5 la lista entre las controladas. (b) Va en el PDF de avance: la tarjeta suma «Incluir cuotas». (c) Ya va dentro de «Detalle del avance»: no cambia nada y se documenta. |
| P6 | El umbral «Caso sin contestar: 4 intentos» de Insumos › Reglas existe en la configuración (`alerts.no_answer_min_attempts`). Como no hay regla de agotado, ¿para qué sirve? | (a) Solo es un aviso de «mucha insistencia», sin cerrar nada: se mantiene en I3 y no aparece en la cola. (b) Se quita del perfil de acreditación. (c) Marca en la cola los casos que lo superan, sin decir «agotado»: una marca discreta en la columna Intentos. |

## 1. Arquitectura: hoy → propuesta

Hoy son 5 secciones y 24 pestañas (catálogo `frontend/src/lib/navegacion/catalogos/monitoreo.ts`, bloque
`acreditacion`): Fuentes 3 · Modelo 3 · Consultas 4 · Teléfono 7 · Avance 7. La propuesta aplica el **esqueleto común
de los cuatro modos** (estándar §1): **Insumos · Modelo · Control · Avance**, en ese orden, con 20 pestañas. Lo propio
de Acreditación (correo, barrido telefónico, subsanación) son pestañas dentro de Control, condicionales cuando dependen
de una capacidad declarada. No hace falta una quinta sección.

| Código | Sección | Pregunta del equipo | Pestaña | Pregunta que responde | Absorbe de hoy | Por qué aquí |
|---|---|---|---|---|---|---|
| I1 | 1 · Insumos | ¿de dónde sale cada dato y quién responde? | Públicos | ¿quiénes responden y contra qué padrón? | Fuentes › Actores | El elenco, su padrón, su llave y sus variables se relacionan antes de medir. |
| I2 | | | Fuentes | ¿qué está conectado y por qué canal entra? | Fuentes › Fuentes y universo · Recopiladores | Un recopilador es una propiedad de su fuente: maestro y detalle. |
| I3 | | | Reglas | ¿cómo se lee y se cruza cada dato? | Teléfono › Estados · reglas dispersas del perfil | Llave, qué cuenta como efectiva, duración, deduplicación, vocabulario del barrido y umbrales: todo lo que cambia una cifra antes de contarla. |
| M1 | 2 · Modelo | ¿qué se espera lograr? | Metas | ¿cuántas encuestas por público? | Modelo › Modelo operativo | Meta = personas × cobertura; se ve junto a la cobertura exigida. |
| M2 | | | Cuotas | ¿cuántas por categoría? | `panel=cuota` de Avance › Cuotas · «Usar para cuotas» de Distribución | Definir una cuota es modelo, no lectura; Avance › Por cuota solo lee su cumplimiento. |
| M3 | | | Ventana de campo | ¿cuándo debe entrar cada público? | Modelo › Cronograma | Plan de fases frente a la ventana real de cada público. |
| Ctl1 | 3 · Control | ¿qué hay que operar y revisar mientras corre el campo? | Correo ◇ | ¿cómo rinde cada envío y cuándo insistir? | Avance › Correo | Es operación de contacto, no lectura. Grupo **Contacto** del rail. |
| Ctl2 | | | Barrido ◇ | ¿cuánto del padrón se llamó y con qué resultado? | Teléfono › Barrido + Kobo · Ritmo diario | El ritmo del barrido es parte del barrido. |
| Ctl3 | | | Reintentos ◇ | ¿en qué casos sigo insistiendo? | Teléfono › Sin efectiva | Cola de lectura con lo que trae la hoja; adopta el componente de insistencia de Telefónico. |
| Ctl4 | | | Equipo ◇ | ¿cómo rinde cada responsable? | Teléfono › Responsables | Carga frente a efectividad. |
| Ctl5 | | | Por resolver | ¿qué respuestas esperan mi decisión? | Consultas › Subsanación | Primera del grupo **Casos** del rail: es el trabajo diario; donde aterriza Control si el proyecto no declara contacto. |
| Ctl6 | | | Cruce | ¿cómo se volvió avance cada respuesta? | Consultas › Cruces efectivos (+ flujo de Avance › Actores) | Diagnóstico de los cruces que no cruzan. |
| Ctl7 | | | Calidad | ¿hay respuestas sospechosas? | Teléfono › Alertas reales | Duración y consistencia valen para todas las respuestas. Supervisión: por definir (P3). |
| Ctl8 | | | Personas | ¿en qué está cada persona del padrón? | Consultas › Estado de la base | Grano persona. |
| Ctl9 | | | Respuestas | ¿qué llegó de cada plataforma? | Consultas › Registros en plataforma | Grano respuesta. Personas y Respuestas no se fusionan: un grano distinto en una misma tabla con conmutador reabre las sub-barras sin dirección (L19). |
| A1 | 4 · Avance | ¿cómo vamos? | Resumen | ¿llegamos a la meta? | Avance › Resumen | |
| A2 | | | Por público | ¿quién se queda atrás y por qué? | Avance › Actores | Tabla con inspector. |
| A3 | | | Por cuota | ¿se cumple cada categoría? | Avance › Cuotas · Detalle · Modelo › Distribución | Cumplimiento de cuotas (M2) y composición de las variables de control. |
| A4 | | | Ritmo | ¿a qué velocidad entra? | Avance › Encuestas | Serie diaria con el plan de M3 encima y aporte por fuente. |
| A5 | | | Salidas | ¿qué entrego y está al día? | Avance › Salidas (+ «Marcar cierre») | Las salidas frente al corte y el cierre del campo. |

◇ condicional. El rail de Control lleva un divisor entre **Contacto** (Ctl1–Ctl4, solo lo declarado) y **Casos**
(Ctl5–Ctl9). ACRDCONTA ve Barrido · Reintentos · Equipo | Casos; el institucional ve Correo | Casos; un proyecto sin
contacto declarado ve solo Casos (tablero S4). Ninguna pestaña de hoy se pierde: las 24 tienen destino (tablero 0,
columna «→»). Las sub-barras sin dirección de Consultas y Avance (hallazgo 10 del censo, L19) desaparecen.

Direcciones (`seccion` · `pestana`): `insumos`·`publicos|fuentes|reglas`, `modelo`·`metas|cuotas|ventana`,
`control`·`correo|barrido|reintentos|equipo|resolver|cruce|calidad|personas|respuestas`,
`avance`·`resumen|publicos|cuotas|ritmo|salidas`. Las secciones de hoy (`fuentes`, `consultas`, `telefonico`) y las
pestañas de `modelo` se leen como alias y redirigen a su destino; nunca se escriben. Aterrizaje: proyecto sin fuentes →
`insumos/fuentes`; con fuentes → ver **D2**.

---

## 1b. Lo que ya existe y dónde queda (estándar §0)

Inventario leído del código de `frontend/src/features/monitoreo/profiles/acreditacion/` (página
`AcreditacionMonitoreoPage.tsx` y carpetas `fuentes/`, `modelo/`, `avance/`) y de `salidas/MonitoreoOutputsWorkbench.tsx`.
Ninguna capacidad se pierde; cada una tiene destino y tablero.

| Capacidad de hoy | Componente o función | Dónde queda | Qué mejora |
|---|---|---|---|
| Elenco de actores con canal telefónico y renombrado que reescribe las fuentes | `fuentes/ActoresDelEstudio.tsx` | I1 Públicos | Junto al padrón, su llave, sus variables y la completitud de cada columna; renombrar confirma cuántas fuentes reescribe |
| Fuentes por paquete: SurveyMonkey, Kobo y Sheets con selector de encuesta, inspección de la encuesta y requisitos de la fuente | `AcreditacionSurveySourcePicker`, `AcreditacionKoboSourcePicker`, `AcreditacionSheetSourceEditor`, `AcreditacionSurveyInspectionCard`, `AcreditacionSourceRequirementCard` | I2 Fuentes y panel P2 Conectar fuente | Maestro y detalle por público en vez de tres pestañas; un solo panel de conexión |
| Matriz de recopiladores con canal, uso operativo e inclusión | `AcreditacionChannelSelectorMatrix`, `AcreditacionCollectorsSourceView` | I2 Fuentes, detalle de la fuente | Respuestas y efectivas por recopilador desde el cruce, no desde el metadato que se desactualiza (H3) |
| Contrato de fuentes telefónicas: instrumento, hoja del barrido y filtro de efectiva telefónica | `AcreditacionPhoneSourcesContractPanel`, `AcreditacionPhoneInstrumentDecision`, `AcreditacionPhoneSheetsDecision`, `AcreditacionPhoneEffectiveFilterEditor` | I2 Fuentes (fuente de barrido) e I3 Reglas (filtro) | La regla de efectiva vive con las demás reglas |
| Regla de rechazo por pregunta de consentimiento | `AcreditacionPlatformRejectionEditor` | I3 Reglas, «Qué cuenta como efectiva» | Frase legible y switch |
| Estados del barrido: confirmar y colorear el vocabulario del Sheets | `AcreditacionPhoneStatusStorage` | I3 Reglas, «Estados del barrido telefónico» | Cada estado con su familia y su conteo real |
| Eventos de contacto con lo que cuentan, y reglas de estado final | `AcreditacionEventsEditor`, `AcreditacionStateRulesEditor` | I3 Reglas, «Eventos de contacto» | Los 8 eventos con sus cuatro marcas como switches |
| Metas por actor y cumplimiento | `AcreditacionGoalsEditor`, `AcreditacionModelActorSummaryCard`, `AcreditacionObjetivoActor.ts` | M1 Metas | Cobertura editable, meta calculada y cobertura exigida comparada entre públicos |
| Cuotas telefónicas por variable y cuotas por categoría | `AcreditacionPhoneQuotaEditor`, `AvanceCuotasPanel.tsx`, `AvanceCuotasEditorMetas.tsx` | M2 Cuotas | Definición en Modelo; Avance solo lee el cumplimiento |
| Variable de interés por actor | `modelo/DistribucionPorActor.tsx` | M2 Cuotas (variable de control) y A3 Por cuota | Se lee como composición frente al padrón, sin recalcular al elegir |
| Cronograma de campo con cortes de reporte por día de la semana | `AcreditacionFieldSchedulePanel`, `AcreditacionFieldCalendarTimeline`, `acreditacionReportCutsFromPhases` | M3 Ventana de campo, y sus fases dibujadas en A4 Ritmo | La ventana real de cada público junto al plan |
| Base del barrido | `AcreditacionSweepBaseWorkbench` | I2 Fuentes (fuente de barrido) y Ctl2 Barrido | El embudo del padrón al cruce |
| Barrido con distribución de estados, ritmo diario y cuotas del barrido | `AcreditacionPhoneOperationsWorkbench`, `AcreditacionPhoneQuotaPanel`, `avance/AcreditacionPhoneDailyTrend.tsx` | Ctl2 Barrido | Estados agrupados por familia; fechas normalizadas (H2) |
| Comparación barrido frente a plataforma, con evidencia por caso | `AcreditacionPhonePlatformComparison`, `AcreditacionPhoneComparisonCaseCard` | Ctl2 Barrido, «Barrido y plataforma» | Matriz de 140, 1 y 38 casos; el detalle por caso abre Ctl8 Personas filtrada |
| Insistencia: casos que no contestan, intentos y reintentables | `AcreditacionPhonePendingInsistence`, `AcreditacionPhoneIncidenceInsights` | Ctl3 Reintentos | Cola de 84 con status, intentos y observación al frente; vista por responsable; distribución de intentos |
| Responsables con carga, barridos, conciliadas e incidencias | `AcreditacionPhoneResponsibleCards`, `phoneResponsibleMetrics` | Ctl4 Equipo | Carga frente a efectividad en un gráfico y la ratio de incidencias por responsable |
| Alertas reales de consistencia | `AcreditacionPhoneQualityAlertsPanel` | Ctl7 Calidad, «Señales de consistencia» (y D3 para unificarlas con Por resolver) | Cada señal con su destino |
| Supervisión: plan por responsable, base de supervisión, prioridad y control de tiempos de Kobo | `buildAcreditacionPhoneSupervisionControlPlan`, `AcreditacionPhoneSupervisionBoard`, `AcreditacionPhoneSupervisionTimeControl`, `buildAcreditacionPhoneTimeControl` | Por definir (P3); el control de tiempos de Kobo queda en Ctl7 como señal | No se dibuja hasta saber si en acreditación hay rellamada con hoja de resultados |
| Subsanación auditada con guía del caso, traza de la llave por canal y decisión con nota | `AcreditacionSubsanacionView`, `acreditacionSubsanacionCaseGuide`, `AcreditacionCaseKeyTrace`, `AcreditacionSubsanacionCoach` | Ctl5 Por resolver, panel del caso | Estado del caso, pasos llave, candidato y decisión, llave por canal y el aviso real del motor |
| Revisión asistida con buscador de asignación sobre el padrón | `AcreditacionAssistedReviewBlock`, `assignment_pool` (T1.2) | Ctl5 Por resolver, «Asignar a una persona del padrón» | Candidatos con su nivel de evidencia; confirmación como switch |
| Cruces efectivos, flujo y razón de cruce | `AcreditacionCrossingsView`, `AcreditacionCrucesView`, flujo de nodos de Avance › Actores | Ctl6 Cruce | Un diagrama de flujo con el resultado bien rotulado (H4) |
| Estado de la base persona por persona | `AcreditacionBaseStatusView`, `AcreditacionBaseFilterBar` | Ctl8 Personas | Filtro por público que también muestra canal y cruce |
| Registros en plataforma con filtros y exportación | `AcreditacionPlatformRecordsView`, `AcreditacionPlatformFilterCapsules`, `downloadRowsAsCsv` | Ctl9 Respuestas | Facetas con conteo; exportación XLSX |
| Vistas internas de Consultas: efectivas, faltantes, distribución, auditoría y reconciliación | `AcreditacionEffectivesView`, `AcreditacionPendingExitView`, `AcreditacionDistributionView`, `AcreditacionAuditoriaView`, `AcreditacionReconciliacionView` | Ctl8 y Ctl9 (filtros), Ctl5 «Decididos» (auditoría y reconciliación) | Sin sub-barras sin dirección (L19) |
| Resumen de avance y franja de claridad | `AcreditacionAdvanceSummaryWorkbench`, `AcreditacionClarityStrip`, `AcreditacionEmbudoCorte.tsx` | A1 Resumen | Curva acumulada frente a la meta y proyección |
| Avance por actor con mecanismos y tarjetas de progreso | `AcreditacionAdvanceActorsWorkbench`, `AcreditacionActorProgressCardView` | A2 Por público | Tabla e inspector por público |
| Avance por encuesta con serie diaria y tarjeta Kobo telefónica | `AcreditacionAdvanceSurveysWorkbench`, `AcreditacionAdvanceSurveyDailyChart`, `AcreditacionAdvancePhoneKoboWorkbench` | A4 Ritmo | Mapa de calor por fuente y semana |
| Variables de control y tablas de los reportes del Sheets | `AcreditacionControlVariablesPanel`, `AcreditacionGsReportsPanel` | A3 Por cuota y A5 Salidas (vista previa del reporte) | Diagrama de pesas con la diferencia en puntos |
| Ritmo por cuota telefónica | `AcreditacionPhoneQuotaRhythmBoard` | A3 Por cuota y Ctl2 Barrido | Se lee junto a la cuota |
| Correo: envíos, embudo, ritmo e inválidos | `AvanceCorreo*.tsx` | Ctl1 Correo | Matriz de envíos por público y orden |
| Salidas: PDF del cliente con título y portada, incluir metas, PDF por responsable ordenado por apellido, Sheets cliente e interno con ensayo, entrega a Procesamiento con data y XLSForm, soporte de publicación y preflight | `salidas/MonitoreoOutputsWorkbench.tsx`, `MonitoreoOutputsReadiness.tsx` | A5 Salidas y diálogo P3 Cerrar campo | Todas las salidas frente al corte en una línea de tiempo, vista previa del reporte y cierre del campo con lo pendiente |
| Marcar cierre del estudio | botón «Marcar cierre» de Distribución (A19) | P3 Cerrar campo | Confirmación con la cifra y lo que queda pendiente |

## 2. Patrones globales (valen para las 20 pestañas; las fichas los citan por código)

**G1 · Cabecera única, igual que Territorial (§2b, L14, L18, hallazgo 15g).** Barra de módulos con la marca en
carmesí y el chip del proyecto («guardado») · barra de modo: MODO, PÚBLICOS, píldoras de sección con su insignia (Control
lleva los casos por resolver: 23 y 55; Avance, el avance contra la meta: 146 % y 59 %), CORTE con fecha y hora, píldora
de estado («Al día», «Actualizando, paso 1 de 3», «Falló», «Preparando») y **Actualizar ▾** · título de pestaña de 44 px
con ícono en carmesí, antetítulo «Sección · Grupo» y el nombre de la pestaña («Control · Casos / Por resolver»). Se
retiran la franja «Paquete de acreditación · Sheets · encuestas · Todo», los KPIs REGENERADO/REGISTROS/SINCRONIZADO y la
cinta FUENTES/BASE/CORTE.

**G2 · Rail de todo el alto con el corte al pie (§2b).** 54 px, íconos de trazo con `aria-label`; el `title` dice
«Grupo · Pestaña» en Control. La pestaña activa con anillo. Al pie, como en Territorial, el rótulo CORTE y debajo
«dd/mm» y «hh:mm» en dos líneas (`MonitoreoRailLastUpdate`, existente). Sin corte: «—». En Control, una línea divisoria separa
el grupo Contacto (condicional) del grupo Casos; el nombre de cada grupo va en el `title` de su primera pestaña.

**G3 · Actualizar explica su proceso (§2b, L38; tableros P1a–P1c).** Un solo control en el chrome de los cuatro modos.
- **Abierto** (`P1a`): pasos en orden — 1 Traer lo nuevo (una fila por fuente: qué trae, volumen, tiempo, «Traer
  todo» por fila), 2 Recalcular (cruce y tablero con su tiempo medido), 3 Dejar recibo — y chips de lo que **no toca**
  (no publica Sheets ni PDF; solo lee SurveyMonkey/Sheets/Mailchimp; no cambia decisiones de Casos). Acciones:
  «Recalcular sin leer» y «Actualizar ahora».
- **Corriendo** (`P1b`): paso actual, fuente actual con barra, tiempo transcurrido, «Cancelar»; la píldora del chrome
  dice «Actualizando · paso 1 de 3» y el botón «Actualizando…». Se puede seguir trabajando.
- **Recibo** (`P1c`): qué llegó por fuente y cómo quedaron efectivas, por resolver y personas sin respuesta, con su
  cambio. «Ver recibos anteriores».
- **Falló** (`S3`): fuente que falló, código `E_*` y `error_id`, «el corte anterior sigue vigente», «Reintentar».
- Pasos reales: ACRDCONTA = SurveyMonkey 7 encuestas (incremental, 488 respuestas) + Google Sheets 6 hojas (se releen;
  última lectura 01/07 12:10, ver H5) + cruce de 519 personas (≈ 20 s) + tablero (≈ 31 s). Institucional = Sheets 19
  hojas (51,161 filas) + SurveyMonkey 1 encuesta (piloto) + Mailchimp audiencia PULSO PUCP (≈ 3 s) + cruce de 45,085
  personas (≈ 49 s) + tablero (—). Los tiempos de cálculo son los medidos en
  `checklist-monitoreo-acred-inst-t0-t1-2026-10-22.md` (T1.3) y `checklist-monitoreo-mailchimp-t3-2026-10-22.md`
  (T3.1); los de lectura por fuente no están medidos: `—` hasta que el job los registre (el recibo los aprende).
- Publicar no está aquí: vive en Avance › Salidas con ensayo «Revisar → Publicar».

**G4 · Una cifra, una base (L20, hallazgo 15b, C5).** Toda cifra de avance dice su base: «418 de 287 meta», «145.6 %»,
«80.5 % del universo (519)», «tasa sobre la base alcanzable». Glosario del modo:

| Rótulo | ACRDCONTA | Institucional (simulado salvo universo y meta) | Qué es |
|---|---|---|---|
| Universo | 519 | 45,085 | personas del padrón (incluye 7 del piloto en el institucional) |
| Meta | 287 | 8,503 | suma de metas por público (`config$goals`) |
| Efectivas | 418 | 4,997 | personas con respuesta completa que cuenta (`advancement = effective`) |
| Parciales | 8 | 766 | personas del padrón con respuesta parcial (no cuentan) |
| Rechazos | 3 | 107 | consentimiento negado |
| Sin respuesta | 90 | 39,215 | personas del padrón sin respuesta |
| Avance | 145.6 % | 58.8 % | efectivas ÷ meta |
| Del universo | 80.5 % | 11.1 % | efectivas ÷ universo |

**G5 · Readiness por pestaña (hallazgo 2, P0).** Hoy las 24 pestañas publican `monitoreo-acreditacion`
(`AcreditacionMonitoreoPage.tsx:18397`). Propuesta: `monitoreo-acreditacion-<seccion>-<pestana>`, en `false` mientras
carga, prepara o un gráfico no pinta.

**G6 · Estados dentro del marco (C2, C3).** Preparando = silueta de la misma pestaña con tiempo transcurrido y estimado
(S1, L23); vacío con salida (`core/VacioConSalida.tsx`, S2); error con causa y Reintentar (S3). El chrome, el rail y el
título no se mueven en ningún estado.

**G7 · Interruptores y acciones irreversibles.** Todo booleano es un switch (incluir recopilador, canal telefónico,
reglas, «Confirmo la asignación», «Incluir metas»). `--danger` solo para Quitar cuota y Cerrar campo, siempre con
diálogo Pulso (foco atrapado, Escape, Cancelar por defecto, la cifra en el botón: «Cerrar campo con 418»).

**G8 · Archivos.** Nada crece en los congelados (`agentic/manifest.json`, `policy.frozen_growth_files`):
`AcreditacionMonitoreoPage.tsx` (18,492 líneas), `monitoreo_engine.R`, `router_monitoreo.R`, `profilePage.css`,
`monitoreo.css`. Cada pestaña nueva en su carpeta `profiles/acreditacion/<seccion>/` con su `.tsx`, su modelo puro
`.ts` y su `.css`; la página solo monta. Colores solo `--pulso-*`.

**G11 · Escritura de producto (§2).** Ningún rótulo usa `=` como sinónimo, flechas, cadenas de `·` que pegan datos,
paréntesis aclaratorios ni abreviaturas («Parc.», «Resp.», «Concil.», «prom.», «R1», «s/f», «Egr. posgrado»). Las cifras
se escriben con su base en frase: «178 efectivas sobre una meta de 108», «Faltan 3,506: unos 8 días al ritmo de 450
diarias», «Responsable 6 tiene el 25 % de sus casos sin barrer». El `·` solo aparece en el antetítulo «Sección · Grupo»
y en los nombres que declara el proyecto («Universo · Egresados», «Respuestas simuladas · Administrativos»), que se
muestran tal cual. Porcentajes con espacio: «58.8 %».

**G12 · Composición medida (§2a).** Separación de 12 px entre contenedores, relleno de 16 px (12 en los compactos), el
último contenedor de cada columna llega al borde, las columnas vecinas terminan a la misma altura, ningún panel deja más
de 24 px vacíos bajo su último elemento, ningún texto se corta y los elementos hermanos comparten posición. Se verifica
con `scripts/medir.mjs` del scratchpad de la sesión (Playwright sobre Chrome, `getBoundingClientRect`), sobre las dos
variantes de cada tablero:

| Criterio | Regla |
|---|---|
| a · Pie | 24 px o menos entre el contenedor más bajo y el borde del área de trabajo |
| b · Choques | cero cajas de texto superpuestas que no sean padre e hijo |
| c · Escala | rellenos de panel y separaciones entre paneles hermanos en 4/8/12/16/24/32 |
| d · Columnas | fondos de columnas vecinas con 2 px o menos de diferencia |
| e · Recortes | ningún contenedor con overflow oculto cuyo contenido no quepa |
| f · Vacío interno | 24 px o menos bajo el último elemento de cada panel sin scroll propio, y 24 px o menos entre dos hijos consecutivos de una columna (un hueco mayor solo pasa si es un contenedor que crece con un gráfico o lista que lo llena); los estados vacíos centrados (`data-vacio`) se exceptúan |
| g · Texto cortado | ningún texto con elipsis efectiva ni recortado en horizontal por un contenedor |
| h · Simetría | tarjetas `.kv` de una misma fila con rótulo y cifra a la misma altura; tarjetas o filas hermanas con barra en la misma posición relativa y del mismo grosor, con 1 px o menos de diferencia |

Resultado de la última corrida: 60 de 60 vistas pasan. Los encabezados de tabla van en una línea y las cifras no se
parten (`.num` sin salto). Formato es-PE: «2,296» y «35.2 %».

**G9 · Un proyecto no gobierna el modo (§4).** Ejes de cuota, nombres de columna (`CodPulso`, `Token`, `cv_t`), llave de
cruce, vocabulario de estados del barrido y umbrales se dibujan con su rótulo declarado; ningún literal de ACRDCONTA ni
del institucional en `profiles/acreditacion/**` fuera de fixtures.

**G10 · Paleta de datos.** Estados: Efectiva `#002457`, Parcial `#6f93c4`, Rechazo `#c2681c`, Sin respuesta `#d6dce6`
(distintos por luminosidad, no solo por tono). Meta: línea carmesí discontinua. Series de públicos: escala azul →
naranja de `paletaPublicos.css` (existente).

---

## 3. Fichas

### I1 · Insumos › Públicos

- **Dirección**: `/monitoreo?modo=acreditacion&seccion=insumos&pestana=publicos` · panel `&panel=publico&foco=<actor>` · readiness `monitoreo-acreditacion-insumos-publicos`
- **Tablero**: `I1-Publicos.dc.html` (alterna los dos proyectos)
- **Reemplaza**: Fuentes › Actores. Cierra: C3 de Actores (55 % del viewport vacío, censo §5.1).
- **Composición**: tabla de públicos (público, padrón con ícono de Sheets, personas, llave, encuestas y canales, switch de teléfono, nº de variables), cabecera con «Agregar público» y «Guardar» · debajo, «Por dónde entra cada público» (matriz público × canal: celda con nº de fuentes y su plataforma; vacía con borde discontinuo) · derecha, el padrón del público elegido: llave de cruce, variables para cuotas con su nº de categorías, y la sección de datos personales.
- **Datos**: columnas no vacías de cada fuente `universo` en `monitoreo_snapshot$data`. ACRDCONTA: Egresados 270 (Código PUCP; Ciclo de egreso 10 categorías; Nombre, Nombre2, Teléfonos, Teléfono de reemplazo, CORREO PUCP). Institucional: Estudiantes de pregrado 22,820 (Token; Sexo 2, Unidad académica 15, Nivel según créditos 12; sin datos personales). Variables elegibles = `monitoreo_cuotas_modelo()$publicos[].variables` (2 a 150 categorías).
- **Estados**: sin padrón → S2. Renombrar un público confirma «reescribe el público en sus N fuentes».
- **Capacidad condicional**: columna Teléfono solo si el modo admite barrido; el bloque de datos personales solo si el padrón trae columnas de contacto (H9).
- **C1–C5**: C3 la matriz contiene su vacío; C5 la llave mostrada es la del cruce.
- **Responsive**: 1280: el panel del padrón pasa a sideover; 1024 × 600: la matriz se reduce a chips por fila.
- **Archivos**: nuevo `profiles/acreditacion/insumos/Publicos.tsx`, `publicosModelo.ts`, `insumos.css`; reutiliza `fuentes/ActoresDelEstudio.tsx` (se retira al terminar) y `AcreditacionActorGoals.ts`.
- **Aceptación**: el padrón institucional muestra «sin datos personales»; el de ACRDCONTA, sus columnas de contacto por nombre, nunca sus valores.
- **Decisiones**: D1, D10.

### I2 · Insumos › Fuentes

- **Dirección**: `…&seccion=insumos&pestana=fuentes` · panel `&panel=fuente&foco=<source_id>` y `&panel=conectar-fuente`
- **Tablero**: `I2-Fuentes.dc.html` (alterna); panel `P2-ConectarFuente.dc.html`
- **Reemplaza**: Fuentes › Fuentes y universo, Fuentes › Recopiladores; franja «Paquete de acreditación» (A3–A5 del censo de acciones).
- **Composición**: maestro 380 px (fuentes agrupadas por público: plataforma, nombre, papel —padrón, respuestas, barrido—, filas y última lectura) · detalle: cabecera (encuesta, público, llave de la respuesta, última lectura) y tabla de recopiladores (nombre, tipo, respuestas, efectivas, canal, switch Incluir) con «Guardar». En el institucional, grupo «Lectura de correo · Mailchimp».
- **Datos**: filas por fuente = conteo de `.source_id`; recopiladores = `monitoreo_sources[].collectors`; **respuestas y efectivas por recopilador = `internal_queries.totals.collector`** (no `collectors[].response_count`, ver H3). ACRDCONTA, SurveyMonkey · Estudiantes · Web: 20 recopiladores; «Faltantes_presencial» 59 respuestas · 55 efectivas.
- **Estados**: sin fuentes → S2; fuente que falló en la última lectura → chip `bad` con su código.
- **Capacidad condicional**: grupo Mailchimp solo con audiencia; Kobo solo si existe.
- **C5**: el conteo por recopilador cuadra con Control › Respuestas.
- **Responsive**: 1024: el detalle pasa a sideover.
- **Archivos**: nuevo `insumos/Fuentes.tsx`, `insumos/FuentesDetalle.tsx`; reutiliza `fuentes/FuentesUniverso.tsx`, `fuentes/canales.ts`, `core/acreditacionSources.ts`, `AcreditacionSourcesModel.ts`.
- **Aceptación**: excluir un recopilador marca «Pendiente de recalcular» en la píldora (no recalcula solo).

### I3 · Insumos › Reglas

- **Dirección**: `…&seccion=insumos&pestana=reglas` · **Tablero**: `I3-Reglas.dc.html` (alterna)
- **Reemplaza**: Teléfono › Estados; reglas del perfil sin superficie propia.
- **Composición**: 2 × 2 tarjetas: Llave de cruce (columnas del padrón ↔ campos de la respuesta, switches «Detectar automáticamente» y «Usar el nombre como respaldo», cómo cruzó en el último corte) · Qué cuenta como efectiva (consentimiento `q0001 = «No»` → Rechazo, filtro de efectiva, excluir pruebas, duración 60–7,200 s, prioridad de deduplicación arrastrable) · Estados del barrido (11 estados con su familia; ACRDCONTA) o Ritmo de recordatorios (umbrales; institucional) · Alertas (5 umbrales).
- **Composición, ampliada**: en ACRDCONTA la retícula es de tres columnas: Llave, Qué cuenta como efectiva y Alertas arriba; Estados del barrido y «Eventos de contacto» abajo. Eventos: los 8 eventos del modelo operativo con sus marcas cuenta intento, cuenta contacto, cuenta completa y cierra el contacto, como switches.
- **Datos**: `monitoreo_profile.key_rules`, `rejection_rules`, `platform_effective_filter`, `platform_test_filter`, `deduplication.priority`, `min/max_duration_seconds`, `alerts`; cruce por llave de `case_rollup.primary_identity_label` (ACRDCONTA: Código PUCP declarado 233, Enlace usado 121, Correo del envío 50, Correo observado 15, Llave usada 10). Umbrales de correo = `.MCM_UMBRALES`.
- **Estados**: cambiar una regla → «Pendiente de recalcular».
- **Capacidad condicional**: Estados del barrido solo con barrido; Ritmo de recordatorios solo con Mailchimp.
- **Archivos**: nuevo `insumos/Reglas.tsx`, una tarjeta por archivo; retira `AcreditacionEstadosDeclarados` del rail de Teléfono.
- **Decisiones**: D4.

### M1 · Modelo › Metas

- **Dirección**: `…&seccion=modelo&pestana=metas` · **Tablero**: `M1-Metas.dc.html` (alterna)
- **Reemplaza**: Modelo › Modelo operativo; «Guardar meta» por actor (L38).
- **Composición**: «Meta por público» (público, personas, cobertura editable, meta, cuota declarada, barra de la meta dentro del padrón; fila de total) con un solo «Guardar» · «Cobertura exigida» (diagrama de puntos: proporción del padrón que debe responder, de mayor a menor, con la meta al lado) · «Reparto de la meta» (barras por público con su %).
- **Datos**: meta = `config$goals[].meta`; cobertura = `goals[].meta_pct` (ACRDCONTA 90/70/70/40 %) o meta ÷ personas (institucional, de la hoja «Metas de encuestas»: Administrativos 50.8 %, Docentes CENTRUM 48.5 %, Docentes Campus 31.2 %… Egresados de posgrado CENTRUM 9.8 %). Totales: 287 de 519 (55.3 %); 8,503 de 45,085 (18.9 %).
- **Estados**: sin públicos → vacío con salida a Insumos › Públicos.
- **C5**: la meta es la que usa Avance (ver H6: hoy no llega al `client_report`).
- **Archivos**: nuevo `profiles/acreditacion/modelo/Metas.tsx`, `metasModelo.ts` (meta = `ceiling(personas × cobertura)`, con test).
- **Aceptación**: cambiar la cobertura recalcula la meta en el cliente; Guardar persiste metas y coberturas.

### M2 · Modelo › Cuotas

- **Dirección**: `…&seccion=modelo&pestana=cuotas&foco=<cuota_id>` · **Tablero**: `M2-Cuotas.dc.html` (alterna)
- **Reemplaza**: `panel=cuota` de Avance › Cuotas (`AvanceCuotasPanel.tsx`, `AvanceCuotasEditorMetas.tsx`); «Usar para cuotas» y el selector de Modelo › Distribución.
- **Composición**: lista (cuotas declaradas, o variables de control sin meta) con «Nueva cuota» · editor: público · variable, cobertura, «Proponer metas», tabla por categoría (barra de personas con la meta encima, personas, meta editable), total, aviso cuando la suma no coincide con la meta del público, Quitar o Descartar / Guardar cuota.
- **Datos**: `monitoreo_cuotas_modelo()` y `monitoreo_cuotas_proponer()`. Institucional, Docentes Campus · Dedicación con cobertura 31.2 %: TPA 1,939 → 605, DTC 631 → 197, TPC20 29 → 10 = 812 frente a 811. ACRDCONTA no declara cuotas: la maqueta muestra la **propuesta** que daría el motor para Egresados · Ciclo de egreso con la cobertura del público (40 %): 14, 14, 15, 5, 8, 14, 9, 9, 9, 14 = 111 frente a 108.
- **Estados**: preparando → S1; sin variables elegibles → «La base de este público no tiene variables con 2 a 150 categorías».
- **Archivos**: mover el editor a `modelo/Cuotas.tsx`; `avanceCuotasModelo.ts` se reparte entre definición (aquí) y lectura (A3). Agregar el panel a `PANELES_POR_MODULO` deja de ser necesario: la cuota es un `foco` de esta pestaña.
- **Decisiones**: D7.

### M3 · Modelo › Ventana de campo

- **Dirección**: `…&seccion=modelo&pestana=ventana` · **Tablero**: `M3-Ventana.dc.html` (alterna)
- **Reemplaza**: Modelo › Cronograma (plan y ejecución en dos regiones, `strategy_phases`).
- **Composición**: franja de cifras (primer día con respuestas, último día, días con efectivas, fases declaradas) · «Ventana de cada público»: fila «Plan de campo» (fases declaradas o «Sin fases» con «Declarar fases») y una fila por público con su ventana real (primer día → última efectiva) y la intensidad diaria de efectivas dentro.
- **Datos**: `client_report.actors[].Primer día / Última efectiva`, `daily_actor`, `strategy_phases` (vacío en los dos proyectos). ACRDCONTA: 25 may → 22 jul, 45 de 59 días; Administrativos 25 may – 5 jun, Egresados 25 may – 16 jul. Institucional: piloto 21 oct; los 9 públicos 27 oct – 6 nov (simulado).
- **Archivos**: nuevo `modelo/VentanaDeCampo.tsx`, `modelo/ventanaModelo.ts`; el editor de fases (`PanelPlan`) vive aquí y A4 solo dibuja las fases.
- **Decisiones**: D11.

### Ctl1 · Control › Correo ◇ (grupo Contacto)

- **Dirección**: `…&seccion=control&pestana=correo` · **Tablero**: `Ctl1-Correo.dc.html` (institucional)
- **Reemplaza**: Avance › Correo (`AvanceCorreo*.tsx`, recién construido en T3/T2).
- **Composición**: izquierda: matriz «Secuencia de envíos por público» (filas = públicos, columnas Invitación + R1…R8, celda = entregados y respuestas atribuidas, celdas vacías con borde discontinuo, columnas Universo, Alcanzable y Ritmo) y debajo el embudo del público elegido, un embudo por envío (entregados → abrieron sin Apple → clic → respondieron, con rebotes/bajas/quejas). Derecha 340 px: Audiencia, Umbrales de ritmo, Tasa sobre la base alcanzable por público, Correos inválidos con Exportar.
- **Datos**: `monitoreo_mailchimp_modelo()`: piloto, invitación `6d3c158034` 7 enviados · 7 abrieron · 2 clics · 2 respuestas; recordatorio `eb505ad1d8` 5 · 4 · 0 · 0; 9 públicos «Sin envíos»; inválidos 0; tasas sobre alcanzable (simuladas salvo piloto 28.6 %).
- **Estados**: preparando = `preparando: true` del endpoint → S1; sin audiencia → la pestaña no existe.
- **Capacidad condicional**: toda la pestaña.
- **Archivos**: mover `AvanceCorreo*.tsx` a `control/contacto/`; `avanceCorreoMatriz.ts` ya da la matriz.
- **Aceptación**: el orden de envío sale de `envios[].orden` dentro del público (ADR 0111).
- **Decisiones**: D4.

### Ctl2 · Control › Barrido ◇

- **Dirección**: `…&seccion=control&pestana=barrido` · **Tablero**: `Ctl2-Barrido.dc.html` (ACRDCONTA)
- **Reemplaza**: Teléfono › Barrido + Kobo, Teléfono › Ritmo diario. Cierra: once mini-cards con tres huérfanas y paneles de cuota 70 % vacíos (censo §5.1); columna diaria de 7.9 px (pulido).
- **Composición**: «Del padrón al cruce» (embudo 270 → 254 → 141 → 140) · «Barridos por día» (barras de barridos con efectivos superpuestos, 3–15 jun + s/f) · «Barrido y plataforma» (matriz 2 × 2: 140 conciliadas, 1 efectiva solo al teléfono, 38 completas sin efectiva al teléfono) · «Efectivas de Egresados por canal» con la meta · derecha: estado de los 270 casos por familia (Efectivo 141, Reintentable 84, Cerrado sin efectiva 25, Rechazo 4, No barrido 16) y barridos acumulados.
- **Datos**: hoja `monitoreo_telefonico`: «Resumen general», «Distribución por estatus», «Avance efectivo por día», «Operación por responsable» (conciliadas 140; plataforma completa sin tel. efectiva 38).
- **Capacidad condicional**: solo con una fuente `barrido`; el eje es el público que la declara.
- **C5**: las fechas del barrido se normalizan antes de agrupar (H2).
- **Archivos**: nuevo `control/contacto/Barrido.tsx`; reutiliza `AcreditacionPhoneDailyTrend.ts` y `avance/ritmoDiario.ts`.
- **Realismo operativo**: la hoja solo guarda la fecha del último intento, así que el gráfico diario se rotula «Casos por fecha de su último intento» y no «Barridos por día»; lo mismo el acumulado.

### Ctl3 · Control › Reintentos ◇

- **Dirección**: `…&seccion=control&pestana=reintentos` · **Tablero**: `Ctl3-Reintentos.dc.html` (ACRDCONTA)
- **Pregunta**: en qué casos sigo insistiendo. La decisión de dejar un caso es del supervisor, mirando intentos, status y observación; la pestaña no la toma por él.
- **Reemplaza**: Teléfono › Sin efectiva (`AcreditacionPhonePendingInsistence`, `AcreditacionPhoneIncidenceInsights`). Cierra: desajuste de denominador de las barras de insistencia (pulido).
- **Composición**:
  1. **Por responsable**: una tarjeta por responsable con casos en cola sobre su carga, intentos promedio y el caso con más días sin contacto. Clic filtra la cola. ACRDCONTA: Responsable 1 67 de 113 (7.2 intentos, 41 días), Responsable 2 17 de 56 (5.5, 49 días), Responsables 3 a 6 sin casos en cola.
  2. **Cola de insistencia** (84: No contesta 61, Apagado 17, Contactar después 5, Contactado por WhatsApp 1). Al frente status, intentos y observación; después responsable, fecha del último intento, días sin contacto y teléfonos registrados. Filtros de status en la cabecera. Orden por intentos, rotulado «por definir» (P1). Pie: «Se asignan y anotan en la hoja; Monitoreo solo lee».
  3. **Intentos por caso**: distribución de 1 a 10 (mediana 7, máximo 10) y la nota de lo que la hoja no registra.
- **Componente común con Telefónico** (`ColaDeInsistencia`): lo rediseña Telefónico; Acreditación adopta su estructura cuando esté. Columnas que existen en las fuentes reales:

  | Columna | Tipo | Columna de la hoja | ACRDCONTA | ACNUR PDM | MEDVID | Medios de Vida 2026 |
  |---|---|---|---|---|---|---|
  | Caso | base | `CodPulso` / `CODPulso` | sí | sí | sí | sí |
  | Status | base | `Status` | sí | sí | sí | sí |
  | Intentos (acumulado) | base | `Intentos` | sí | sí | sí | sí |
  | Observación (una, libre, se sobrescribe) | base | `Observación` / `Observacion` | sí | sí | sí (y `Observación de rebarrido`) | sí |
  | Responsable | base | `Responsable` | sí | sí | sí | sí |
  | Último intento | base | `Fecha` | sí | sí | sí | sí |
  | Días sin contacto | base, derivada | corte menos `Fecha` | sí | sí | sí | sí |
  | Teléfonos registrados | propia | cuenta de `TELÉFONO 1–3` / `Tef1–2` / `NumTelefonos` | sí | no (un `Telefono`) | sí | sí |
  | Orden del teléfono y teléfonos intentados | propia | `OrdenTelefono`, `TelefonosIntentados` | no | no | no | sí |
  | Origen (muestra o reserva) | propia | `Origen` | no | sí | no | sí |

  Las columnas propias se muestran solo si la hoja las trae.
- **Lo que no tiene** (realismo operativo): historia de llamadas, próximo intento, número marcado en cada intento, regla de agotado o «regla cumplida», y acciones de escritura. La hoja guarda una fila por caso que se sobrescribe; asignar se hace en la hoja.
- **Archivos**: nuevo `control/contacto/Reintentos.tsx`, que monta el componente común con la configuración de Acreditación.

### Ctl4 · Control › Equipo ◇

- **Dirección**: `…&seccion=control&pestana=equipo` · **Tablero**: `Ctl4-Equipo.dc.html`
- **Reemplaza**: Teléfono › Responsables.
- **Composición**: tabla con barra apilada por responsable (estado de sus casos, escalada a la mayor carga), asignados, barridos, efectivas, conciliadas, % sin barrer · dispersión carga frente a efectividad (tamaño = barridos) · alertas del equipo.
- **Datos**: «Operación por responsable», «Estados por responsable». R1 113 asignados · 24 %, R3 33 · 94 %, R6 25 % sin barrer, 3 sin responsable.
- **Sin asignar**: los casos sin responsable se rotulan «Sin asignar», en gris; aún no están asignados y no cuentan como atraso.
- **Archivos**: nuevo `control/contacto/Equipo.tsx`; desduplica `AcreditacionPhoneOperationsWorkbench` (L33).

### Ctl5 · Control › Por resolver (grupo Casos)

- **Dirección**: `…&seccion=control&pestana=resolver` · panel `&panel=caso&foco=<response_id>`
- **Tablero**: `Ctl5-PorResolver.dc.html` (ACRDCONTA, con el panel abierto)
- **Reemplaza**: Consultas › Subsanación. Cierra: 109 rótulos recortados (pulido); decisiones con casilla en vez de switch.
- **Composición**: filtros 250 px (Esperan decisión 23: Llave fuera de base 11, Respuesta sin llave 2, Conflicto telefónico 1, Parcial no identificable 9 · Resueltos por regla: Caso duplicado 53, Parcial identificable 30, Rechazo de plataforma 12 · Decididos: Asignadas por el supervisor 3 (tipo `incluido_con_salvedad`) · público) · cola del tipo elegido (público, canal, id, llave enmascarada, completitud, fecha) · panel del caso (datos, línea de lo que pasó, buscador de persona del padrón, switch «Confirmo la asignación», motivo obligatorio, «Descartar» / «Asignar a esta persona»). Es el procedimiento real: el supervisor busca a mano y asigna a una persona del padrón o descarta, con decisión auditada.
- **Composición, ampliada**: el panel del caso muestra el estado de la guía («Sin coincidencia automática»), los tres pasos Llave, Candidato y Decisión, la llave por canal (código ••••29, correo, nombre vacío) con el aviso del motor «No se encontró coincidencia por código, correo ni nombre», y el candidato del `assignment_pool` (••••82, pendiente en Universo · Docentes, sin evidencia automática).
- **Datos**: `internal_queries.issues` (92 filas; `count` suma 121) unido a `cases` por `response_id`; candidatos = `assignment_pool` (T1.2). El caso del tablero: `115118926233`, Docentes, Enlace personalizado, 12 jun 18:09, 100 % respondido, llave `cód. ••••29` sin coincidencia en 53 personas.
- **Estados**: bandeja vacía: «Nada espera tu decisión» con los resueltos por regla visibles.
- **C5**: asignar recalcula el avance y lo dice en la píldora.
- **Archivos**: nuevo `control/casos/PorResolver.tsx`, `control/casos/PanelCaso.tsx` con `usePanelDireccionable`; reutiliza `AcreditacionAssistedReviewBlock` y `core/motivoDeNoCruce.ts`.
- **Decisiones**: D3.

### Ctl6 · Control › Cruce

- **Dirección**: `…&seccion=control&pestana=cruce` · **Tablero**: `Ctl6-Cruce.dc.html` (alterna)
- **Reemplaza**: Consultas › Cruces efectivos; flujo de nodos de Avance › Actores. Cierra: 45 recortes de «Cruzó por llave» (pulido).
- **Composición**: diagrama de flujo de 4 columnas (Origen → Canal → Plataforma → Resultado) a 930 × 700 · derecha: Llave usada, Cómo cruzó con la base, Estrategia por canal / Identidad.
- **Datos**: `internal_queries.flow.links` re-rotulado (H4). ACRDCONTA: 551 registros = 519 del padrón + 32 fuera de base; Resultado: Efectiva 418, En el universo sin contar 11, Excluida del avance 32, Pendiente 90. Institucional: 45,140 = 45,085 + 55; Efectiva 4,997 · no cuenta 873 · excluida 55 · pendiente 39,215.
- **Archivos**: nuevo `control/casos/Cruce.tsx`, `control/casos/flujoDeCruce.ts` (geometría del diagrama, pura y con test).
- **Decisiones**: D9.

### Ctl7 · Control › Calidad

- **Dirección**: `…&seccion=control&pestana=calidad` · **Tablero**: `Ctl7-Calidad.dc.html`
- **Reemplaza**: Teléfono › Alertas reales. Teléfono › Supervisión queda por definir (P3).
- **Composición**: histograma de duración (488 respuestas de SurveyMonkey; < 1 min 22, > 120 min 17, mediana 10.1 min; líneas de 60 s y 7,200 s) · señales de consistencia (duración fuera de rango 39, enlace distinto al código escrito 1 → Control › Por resolver, responsable con casos sin barrer 1 → Equipo) · lista completa de las 39 duraciones fuera de rango, de la más corta a la más larga.
- **Composición, ampliada**: señal de Kobo con 14 de 181 encuestas telefónicas entre 2 y 5 minutos. La señal «Código escrito distinto al del enlace con token» reemplaza a «enlace abierto»: no hay enlace sin token. Supervisión sin dibujar: no hay hoja donde el equipo registre lo verificado (P3).
- **Datos**: `total_time` del snapshot; `dashboard.inconsistencies` (39, todas tipadas `duracion_muy_corta`: H1); `config.supervision_n/seed`.
- **Archivos**: nuevo `control/casos/Calidad.tsx`.
- **Decisiones**: D3, D5.

### Ctl8 · Control › Personas

- **Dirección**: `…&seccion=control&pestana=personas&foco=<público>` · **Tablero**: `Ctl8-Personas.dc.html` (alterna)
- **Reemplaza**: Consultas › Estado de la base. Cierra: payload de 115 MB (T1.6 ya lo bajó; aquí se pagina).
- **Composición**: columna izquierda de 520 px que ocupa todo el alto y filtra la tabla: «Estado por público» (una fila por público y una de «Todos los públicos», con Efectiva, Sin respuesta, Parcial y Rechazo en columnas de una línea y una barra apilada por fila; el público elegido se marca en carmesí) y, debajo, para el público elegido, «Por canal» y «Cómo cruzó» de las personas con respuesta · derecha, tabla paginada filtrada por el público (llave o token, público, estado, canal, cómo cruzó, fecha) con buscador, chips y «Exportar XLSX».
- **Datos**: `case_rollup` (519 / 45,085). ACRDCONTA con Egresados elegido: 178 efectivas, 87 sin respuesta, 5 parciales; por canal Telefónico 121, Correo 41, Enlace personalizado 21; cómo cruzó: por barrido 143, por llave 40. Institucional con todos los públicos: Correo 5,870, cruzó por llave 5,870 (simulado). Llaves enmascaradas en ACRDCONTA; tokens visibles en el institucional.
- **Archivos**: nuevo `control/casos/Personas.tsx` y `control/casos/EstadoPorPublico.tsx` (filtro), paginación en servidor sobre el transporte compacto de T1.6.

### Ctl9 · Control › Respuestas

- **Dirección**: `…&seccion=control&pestana=respuestas` · **Tablero**: `Ctl9-Respuestas.dc.html` (alterna)
- **Reemplaza**: Consultas › Registros en plataforma (435 cadenas redundantes, pulido).
- **Composición**: facetas 280 px (Plataforma, Canal, Cruce, Cuenta en avance) · tabla (id, recibida, público, canal, plataforma, cruce, cuenta ✓) paginada, más recientes primero.
- **Datos**: `internal_queries.cases` sin las filas «Sin respuesta» (ACRDCONTA 488: Completa 437, Parcial 39, Rechazo 12; cuentan 418). Institucional 6,080 (Completa 5,204, Parcial 766, Rechazo 110; cuentan 4,997).
- **Archivos**: nuevo `control/casos/Respuestas.tsx`; reutiliza `facetasDeConsultas`.

### A1 · Avance › Resumen

- **Dirección**: `…&seccion=avance&pestana=resumen` · **Tablero**: `A1-Resumen.dc.html` (alterna)
- **Reemplaza**: Avance › Resumen (`mon-clarity-card`).
- **Composición**: «Efectivas acumuladas» (KPI 418 de 287 meta · 145.6 %, del universo, parciales, rechazos, sin respuesta; curva acumulada con línea de meta y marca del día que se cumplió —11 jun—; barras diarias en la franja inferior; chip «Meta cumplida» o «Faltan N · a X por día, D días») · «Por público» (barras de efectivas sobre el padrón con marca de meta, rezagados primero) · «Universo por estado» · «Últimos 14 días» · «Por resolver» (23 esperan decisión; resueltos como chips; «Abrir bandeja»).
- **Datos**: `client_report.summary`, `daily_general` (59 días ACRDCONTA; 17 días institucional), `goals`, `issues`. Proyección = promedio de los últimos 7 días (institucional: faltan 3,506 a 450/día, 8 días; simulado).
- **Archivos**: nuevo `avance/Resumen.tsx`, `avance/curvaAcumulada.ts`.

### A2 · Avance › Por público

- **Dirección**: `…&seccion=avance&pestana=publicos` · panel `&panel=publico&foco=<actor>` · **Tablero**: `A2-PorPublico.dc.html` (alterna)
- **Reemplaza**: Avance › Actores (7 recortes de «respuestas», pulido).
- **Composición**: tabla de públicos (universo, meta, efectivas, avance contra meta en barra, % universo, parciales, sin respuesta, últimos 14 días) con total · «Universo de cada público por estado» (barras 100 %) · inspector del público (efectivas y meta, embudo universo → respondieron → efectivas, acumulado, por canal, barrido o cuota y correo si existen, casos del público).
- **Datos**: `client_report.actors`, `daily_actor`, `sources`, `issues` por actor, cuotas del público.
- **Archivos**: nuevo `avance/PorPublico.tsx`, `avance/PanelPublico.tsx`.

### A3 · Avance › Por cuota

- **Dirección**: `…&seccion=avance&pestana=cuotas` · **Tablero**: `A3-Cuotas.dc.html` (alterna). «Editar en Modelo» lleva a `modelo/cuotas&foco=<id>` (M2).
- **Reemplaza**: Avance › Cuotas, Avance › Detalle, Modelo › Distribución (y su selector que guardaba al elegir y recalculaba ~2 min, A14–A16).
- **Composición**: lista «Variables» (cuotas con avance y cumplidas; variables de control con «sin meta» y máximo Δ pp), sin crear ni editar: eso es M2 · detalle: con meta (institucional, Estudiantes de pregrado · Unidad académica): franja de efectivas 2,658, meta por categorías 4,547, meta del público 4,542 (redondeo +5), 0 de 15 cumplidas, más atrasada Gastronomía 41 %; tabla con universo, % base, meta, efectivas, falta, avance con marca de meta, Δ de composición. Sin meta (ACRDCONTA, Egresados · Ciclo de egreso): diagrama de pesas % del universo frente a % de las efectivas por categoría, con Δ pp (máx. 2025-2 +2.4 pp) y «Definir cuota en Modelo».
- **Datos**: `monitoreo_cuotas_modelo()`; `cliente_variables_control`.
- **Archivos**: `AvanceCuotasVista.tsx`, `AvanceCuotasDetalle.tsx` y `AvanceCuotasResumen.tsx` se quedan aquí (el editor pasa a M2); `DistribucionPorActor.tsx` se retira; nuevo `avance/pesasDeComposicion.ts`.
- **Decisiones**: D7.

### A4 · Avance › Ritmo

- **Dirección**: `…&seccion=avance&pestana=ritmo` · **Tablero**: `A4-Ritmo.dc.html` (alterna)
- **Reemplaza**: Avance › Encuestas. Cierra: eje «may may may» (censo §5.1). Las fases se definen en M3; aquí solo se dibujan.
- **Composición**: «Efectivas por día» apiladas por público (institucional: por familia de público) con la franja «Plan de campo» encima (sin fases: «Declarar fases»; con fases, bandas sobre el eje) · mapa de calor fuente × semana (ACRDCONTA) o público × día (institucional) · «Pulso del campo»: promedio 7 días, mejor día, días con efectivas, canal que más aporta, promedio por día de la semana, efectivas por canal, última efectiva por público.
- **Datos**: `daily_actor`, «Avance diario por fuente», `strategy_phases` (vacío en los dos proyectos).
- **Archivos**: nuevo `avance/Ritmo.tsx`, `avance/mapaDeCalor.ts`; «Declarar fases» lleva a M3.
- **Decisiones**: D8.

### A5 · Avance › Salidas

- **Dirección**: `…&seccion=avance&pestana=salidas` · **Tablero**: `A5-Salidas.dc.html`; diálogo `P3-CerrarCampo.dc.html`
- **Reemplaza**: Avance › Salidas; «Marcar cierre» (A19, sin deshacer ni confirmación).
- **Composición**: «Publicaciones frente al corte» (línea de tiempo: 13 publicaciones del Sheets cliente 02/07–21/07, 1 del interno 02/07, PDF cliente 13/07; corte 23/07 18:09) · tarjetas de salida con «Anterior al corte» y un verbo (Revisar / Generar) · «Revisar antes de publicar» (7 pestañas controladas; filas nuevas, cambiadas, hojas que encogen; Publicar deshabilitado hasta revisar) · «Cierre del campo» (metas 4 de 4, 23 por resolver, salidas al día, aprobación metodológica) con «Cerrar campo».
- **Composición, ampliada**: seis tarjetas: Sheets del cliente, Sheets interno, Reporte de avance para cliente (título y portada, incluir metas), PDF de producción por responsable (ordenar por apellido), Entrega a Procesamiento (solo validada o validada y en revisión) y Soporte de publicación; el panel de revisión incluye la vista previa del resumen por actor.
- **Datos**: `monitoreo_publication_sheet_events_*`, `monitoreo_client_report_pdf`, `monitoreo_config.acreditacion.aprobacion_metodologica/cierre_at`.
- **Al cliente**: avance por público y avance por cuota; correo y barrido son internos. El Sheets del cliente no tiene pestaña de cuota (P5).
- **Archivos**: nuevo `avance/Salidas.tsx`, `avance/DialogoCerrarCampo.tsx`.
- **Decisiones**: D6.

### Paneles y estados

| # | Tablero | Qué fija |
|---|---|---|
| P1a–c | `P1a-ActualizarAbierto`, `P1b-ActualizarCorriendo`, `P1c-ActualizarRecibo` | G3 con las fuentes reales de los dos proyectos (alternan). |
| P2 | `P2-ConectarFuente` | Plataforma, cuenta, encuesta, papel (Padrón / Respuestas / Barrido), público, canal, llave detectada; «Conectar» deshabilitado hasta elegir encuesta. |
| P3 | `P3-CerrarCampo` | Diálogo con lo que queda fijo y lo pendiente; switch de conformidad; botón con la cifra. |
| S1 | `S1-Preparando` | Silueta de Cuotas, «Preparando el cruce del padrón · 45,085 personas», 0:42 de ≈ 1 min, pasos. |
| S2 | `S2-Vacio` | Proyecto sin fuentes: Insumos › Fuentes, tres pasos y «Conectar fuente». |
| S3 | `S3-Error` | Recibo de falla: SurveyMonkey leída, Sheets falló (`E_GOOGLE_SHEETS`, código existente en `errors_registry.R`; el `error_id` real lo da el job), «el corte 23/07 18:09 sigue vigente», Reintentar. El escenario es ilustrativo: ningún proyecto trae una falla registrada. |
| S4 | `S4-SinCapacidad` | Rail de Control según lo declarado: ACRDCONTA (Barrido, Reintentos, Equipo · Casos), institucional (Correo · Casos), proyecto sin contacto (solo Casos). Las cuatro secciones existen siempre. |

---

## 4. Hallazgos que salieron de los datos (para quien construya)

| # | Hallazgo | Evidencia | Dónde |
|---|---|---|---|
| H1 | Las 17 duraciones **por encima** del máximo se tipan `duracion_muy_corta`: las 39 «muy cortas» son 22 cortas (< 60 s) y 17 largas (> 7,200 s, hasta 9.9 días). | `dashboard.inconsistencies` de ACRDCONTA | motor de inconsistencias |
| H2 | El bloque «Avance efectivo por día» del barrido mezcla fechas `d/mm/yyyy` (del Sheets) y ISO (de la plataforma): el mismo día sale en dos filas. | hoja `monitoreo_telefonico` | normalizar fecha antes de agrupar |
| H3 | **«Faltantes_presencial»: 7 respuestas y 55 efectivas no cuadra porque son dos fuentes distintas.** El 7 es `collectors[].response_count`, metadato que SurveyMonkey devolvió al listar recopiladores y que solo se refresca con «Todo» (A-C2); el cruce actual cuenta 59 respuestas de ese recopilador (55 efectivas, 3 parciales, 1 rechazo) en `internal_queries.totals.collector`. Lo mismo «Email Invitation 10»: 0 en el metadato, 2 en el cruce. La maqueta I2 ya usa el conteo del cruce. | `monitoreo_sources[sm-contabilidad-estudiantes-web].collectors` frente a `totals.collector` | I2 y Recopiladores de hoy |
| H4 | El flujo rotula «Incluido en avance» a parciales y rechazos del padrón (8 + 3 en ACRDCONTA; 766 + 107 en el institucional), aunque no cuentan como efectivas. | `internal_queries.flow.links` | Ctl6 re-rotula: Efectiva / En el universo, no cuenta / Excluida / Pendiente |
| H5 | Las 6 hojas de ACRDCONTA se leyeron por última vez el 01/07 y SurveyMonkey el 23/07: el «Avance» del chrome no relee Sheets (censo de acciones, A-C1). | `monitoreo_sources[].last_sync_at` | G3 |
| H6 | `client_report.actors[].Meta` llega vacío aunque `config$goals` tiene metas en los dos proyectos. | `client_report` | reporte cliente |
| H7 | El vocabulario del barrido trae «Número Incorrrecto» (errata del Sheets); la app lo muestra tal cual porque es rótulo declarado. | «Distribución por estatus» | corregir en el Sheets o mapear en I3 |
| H9 | Los padrones de ACRDCONTA traen nombres, correos y teléfonos y viajan dentro del `.pulso` (en `state.rds`). El institucional solo trae token y variables de cuota, como recomienda el diagnóstico (B3). | columnas no vacías de las fuentes `universo` | I1, D10 |
| H8 | Dos taxonomías de alertas: la hoja «Alertas» (efectiva_sin_cruce_base 47, respuesta_sin_llave 19, parcial_plataforma 25…) y `issues` (fuera_base 11, sin_llave 2…). | ACRDCONTA | D3 |

## 5. Datos que no se pudieron obtener

| Dato | Dónde aparece | Por qué `—` |
|---|---|---|
| Tiempo de lectura por fuente (SurveyMonkey, Sheets) | P1a | No se mide hoy; el job debería registrarlo para aprenderlo del recibo anterior. |
| Tiempo del tablero del institucional | P1a | Medido solo junto con el warmup (≈ 76 s de Avance dentro de 103 s) en una máquina saturada (checklist T1). |
| Duración total y cambios del recibo | P1c | No hay recibos guardados en el proyecto; las cifras finales sí son reales. |
| Filas nuevas, cambiadas y hojas que encogen del ensayo | A5 | El ensayo «Revisar» aún no existe (L38). |
| Registro del PDF de producción | A5 | No hay evento de generación en el `.pulso`. |
| Muestra de supervisión y verificadas | Ctl7 | El `.pulso` guarda tamaño y semilla, no la muestra sorteada ni su resultado; panel quitado hasta P3. |
| `error_id` | S3 | Escenario ilustrativo. |
| Nombres de responsables | Ctl3, Ctl4 | Datos personales: se anonimizan como «Responsable 1…6» por carga. |

## 6. Falta tu decisión

| # | Decisión | Opciones |
|---|---|---|
| D1 | ¿«Público» o «Actor»? La maqueta usa «Público» (es la palabra del estudio institucional y de los ADR 0110–0112; «actor» se confunde con la persona). | (a) Público en la UI, `actor` en el código; (b) Actor en todo. |
| D2 | ~~¿Dónde aterriza el modo?~~ **Respondida**: en Avance › Por público, porque lo primero que mira el equipo es cuánto falta por público. | — |
| D3 | ¿Se unifican las alertas de la hoja «Alertas» con `issues` en Por resolver? | (a) Sí, una taxonomía; la hoja solo exporta; (b) se mantienen las dos (Calidad muestra las de la hoja). |
| D4 | Umbrales de ritmo del correo (0.5 % bajas, 0.1 / 0.3 % quejas). | (a) Fijos así; (b) editables por estudio en Reglas (maqueta I3). |
| D5 | Supervisión: pasa a P3. | — |
| D6 | ¿Cerrar campo exige 0 casos por resolver? | (a) Sí; (b) permite cerrar con conformidad explícita (maqueta P3). |
| D7 | Si las metas por categoría suman más que la meta del público por redondeo (812 frente a 811; 4,547 frente a 4,542), ¿cuál manda? | (a) La suma de categorías; (b) la del público y se avisa. |
| D8 | Ritmo del institucional con 9 públicos: ¿apilar por familia de público (maqueta) o pequeños múltiplos por público? | (a) Familia; (b) pequeños múltiplos. |
| D10 | ¿Se exige que el padrón llegue sin datos personales (solo llave y variables), como en el institucional? | (a) Sí: Insumos avisa y no guarda columnas de contacto en el `.pulso`; (b) se permiten y se marcan (maqueta I1). |
| D11 | ¿La ventana de campo (M3) es una fecha por estudio o por público? | (a) Por público, como la ventana real; (b) una por estudio con fases. |
| D12 | Acciones de escritura sobre el barrido (reasignar, reprogramar, marcar agotado) que quité de Reintentos. Hoy el equipo asigna en su hoja y Monitoreo solo lee. | (a) No se agregan: costo cero para el equipo. (b) Solo «Marcar agotado» como nota del supervisor guardada en el `.pulso`: el supervisor tendría que registrar en dos lugares, la hoja y la app, y las dos pueden contradecirse. (c) Reasignar desde la app escribiendo en la hoja: exige permiso de escritura sobre el Sheets del equipo, que hoy se edita en vivo, con riesgo de pisar a quien está anotando. |
| D9 | El diagrama de Cruce, ¿en personas o en registros? (la maqueta usa registros: padrón + respuestas fuera de base). | (a) Registros; (b) personas, con las respuestas fuera de base aparte. |
