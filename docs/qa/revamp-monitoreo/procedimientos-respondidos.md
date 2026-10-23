# Procedimientos de campo respondidos por Gonzalo

Tipo: Registro de decisiones de dominio
Estado: Vivo
Fecha: 2026-10-22
Autoridad: respuestas textuales de Gonzalo en la sesión del revamp de Monitoreo. Manda sobre cualquier supuesto del
código, de un solo proyecto o de las maquetas. Regla: «si hay alguna duda sobre consentimiento o procedimiento,
pregunta; no adivines».

## Proyectos de ejemplo por tipo de monitoreo

| Tipo | Proyectos | Nota |
|---|---|---|
| Telefónico | ACNUR PDM Telefónico (`ACNUR_PDM.pulso`), ACNUR Medios de Vida (`MEDVID.pulso`, `PDM_MedVida2026.pulso`), ACNUR RMS 2026 | El RMS aún no tiene `.pulso`: solo `2026_ACNUR_RMS/Base/Listado Telefonico - RMS PULSO PUCP.xlsx` y su instrumento. CBI no se usa. |
| Acreditación | Contabilidad (`90_Pruebas/pruebas_monitoreo/ACRDCONTA.pulso`), Institucional PUCP 2026 (copia de la sesión «Monitoreo Acredita INST», respuestas simuladas) | Ningún `.pulso` de `2026_PUCP_Acreditacion_Contabilidad` tiene monitoreo configurado. |
| Territorial | ACNUR Comunidad de Acogida (`ACNURCG.pulso`) | |
| Cursos-horario | HSVG 2026 (`HSVG26ULT2*.pulso`), CCSS Perfil 2026 (`CCSS2026_campo_*.pulso`) | Pendiente de confirmar cuál. |

Cada tipo se diseña solo con proyectos de su tipo. El barrido telefónico de una acreditación es una capacidad de esa
acreditación, pero la pieza de insistencia se diseña con los telefónicos.

## Telefónico

| Pregunta | Respuesta | Consecuencia para el diseño |
|---|---|---|
| ¿Cómo registran los aplicadores cada intento? | Una fila por caso en el Sheets del barrido: status, número de intentos, fecha y una observación libre que se sobrescriben. | No hay historia de llamadas por caso ni próximo intento. La observación se muestra tal cual, una vez. |
| ¿Qué significan «Intentos» y «Fecha»? | Total acumulado de intentos y fecha del último intento. | «Días sin contacto» se calcula desde «Fecha». |
| ¿Dónde se asigna o reasigna un caso? | En la hoja del equipo; Monitoreo solo lee. | Sin acciones de reasignar, reprogramar ni marcar agotado en la app. |
| ¿Hay regla de agotado o reemplazable por intentos? | No; decide el supervisor. | La app no declara «agotado» ni «regla cumplida»: le da al supervisor lo que necesita para decidir. |
| ¿Qué manda para contar una efectiva? | Manda el Kobo con consentimiento, pero deben coincidir con el barrido; si no coinciden, es un caso a revisar. | La discrepancia barrido–Kobo es una cola de Control. |
| ¿«OrdenTelefono», «TelefonosIntentados» y varios teléfonos (Medios de Vida 2026)? | Propio de ese estudio. | Capacidad condicional: se muestra solo si la hoja trae esas columnas. |

| ¿Qué mira el supervisor para dejar de insistir un caso? | Intentos, status y la observación. | La cola muestra esas tres cosas con prioridad; no se le agregan días sin contacto ni cuota como criterio de decisión (pueden verse, pero no ordenan). |
| ¿El backup de ACNUR PDM (Origen Muestra 1,111, Backup 1,185) reemplaza como en el RMS? | Sí, igual que el RMS: se abre cuando un caso de la muestra no rinde y ocupa su cupo. | Reserva y reemplazos aplica a PDM y RMS como capacidad condicional declarada. |
| ¿«No barrido» sin responsable? | Aún no asignado; no es trabajo atrasado. | Se muestra como «Sin asignar», separado de los pendientes atrasados. |
| ¿Cómo se supervisan las efectivas? | Se rellama una muestra de efectivas. | La supervisión es una muestra sorteada de efectivas para rellamar, con su resultado. |

| ¿Dónde queda el resultado de cada rellamada de supervisión? | En una hoja aparte. | La supervisión es una fuente propia (Sheets de supervisión) que Monitoreo lee; condicional si el proyecto la conecta. |
| ¿Cuánto se rellama y quién sortea? | Un porcentaje por estudio, respetando la distribución de efectivas por enumerador. | Muestra estratificada por enumerador, proporcional a sus efectivas, con el porcentaje declarado por el proyecto. |
| ¿Sobre qué se fijan las cuotas? | Sobre una variable, como máximo dos, normalmente una. No hay meta por enumerador. | El Modelo admite una variable de cuota o el cruce de dos; nada de metas por enumerador. |
| ¿Qué ve primero el equipo en un día normal? | Cuánto falta por cuota. | El modo aterriza en el faltante por cuota (Avance), y esa lectura encabeza también Control. |
| ¿Quién usa Monitoreo telefónico a diario? | El coordinador y el supervisor de campo. El cliente no abre la app. | Densidad de herramienta interna; el cliente solo ve salidas. |
| ¿Qué lleva el reporte al cliente? | Avance por cuota. | La salida al cliente es el avance por cuota; el resto es interno. |
| ¿Quién resuelve una discrepancia barrido–Kobo? | El supervisor, en la app. | Es una decisión auditada que se guarda en el `.pulso`, como la subsanación de Acreditación. |

## Acreditación

| Pregunta | Respuesta | Consecuencia para el diseño |
|---|---|---|
| ¿Por qué canales llega una persona del padrón a responder? | Correo con enlace (token), barrido telefónico y ficha QR presencial. No hay enlace abierto sin token. | Tres canales, cada uno condicional a lo que el proyecto declara; el cruce siempre parte de una llave. |
| ¿Qué se hace con una respuesta «fuera de base»? | Se busca a mano: el supervisor la asigna a una persona del padrón o la descarta. | Cola de «Por resolver» con asignación asistida y decisión auditada. |
| ¿Qué ve primero el equipo un día normal? | Cuánto falta por público. | El modo aterriza en el faltante por público. |
| ¿Qué se entrega al cliente durante el campo? | Avance por público y avance por cuota. | Esas dos lecturas son la salida al cliente; correo y barrido son internos. |

## Territorial

| Pregunta | Respuesta | Consecuencia para el diseño |
|---|---|---|
| ¿Qué ve primero el equipo un día normal? | Las cuotas faltantes por UMP. | El modo aterriza en el faltante por UMP. |
| ¿Quién decide una subsanación? | El coordinador, en la app: revisa la sugerencia del motor y la aplica o la rechaza. | Subsanación con sugerencia, contabilidad por celda y decisión auditada. |
| ¿El parte de ocurrencias por UMP es siempre? | Sí, en este tipo de estudio es parte del protocolo. | En territorial ACNUR, Ocurrencias es parte del modo; sigue siendo condicional para otros clientes. |

## Cursos-horario

Ejemplos: HSVG 2026 y CCSS Perfil 2026, uno principal y el otro para contrastar.

## Columnas reales del barrido telefónico observadas

- ACNUR PDM: Origen (Muestra, Backup), CodPulso, Telefono, Sede, Atencion, Tramite, Género, Edad, País, Responsable,
  Status, Intentos, Fecha, Observación.
- Medios de Vida (MEDVID): CODPulso, Componente, COD.proGres, Telefono final, Tef1, Tef2, Whatsapp, Responsable, Status,
  Telefono de la encuesta, Intentos, Fecha, Observación de rebarrido, Observación.
- Medios de Vida 2026: CodPulso, Actor, Sexo, Edad, País, Estatus, Departamento, Telefono1 a 4, NumTelefonos,
  EstadoFinal, Origen, Telefono, OrdenTelefono, TelefonosIntentados, Responsable, Status, Intentos, Fecha, Observacion.

## Telefónico: discrepancias y supervisión (respuestas del 2026-10-23)

| Pregunta | Respuesta | Consecuencia para el diseño |
|---|---|---|
| P1. ¿Cuenta en el avance una efectiva cuya discrepancia sigue pendiente? | Sí, manda Kobo. | El avance no cambia; la discrepancia sólo puede sacar una efectiva cuando el supervisor decide que no cuenta. Discrepancias la marca «cuenta mientras tanto». |
| P2. ¿Qué decide el supervisor? | «Cuenta y no cuenta está bien, pero lo principal aquí es poder lanzar la alerta de qué casos no coinciden, ya sea por efectivos en Kobo que no están en la base de barrido o viceversa, poder saber el responsable y los códigos para identificar, ya sea el proGres o el Pulso, y poder avisarle al equipo la discrepancia rápidamente antes de decidir si cuenta o no.» | Lo primero de Discrepancias es la alerta en los dos sentidos (Kobo efectiva sin «Efectivo» en la hoja, y hoja «Efectivo» sin Kobo), con responsable, CodPulso y código proGres, y una salida rápida para avisar al equipo (lista copiable o exportable por responsable). La decisión Cuenta / No cuenta viene después. |
| P3. Hoja «Efectivo» sin envío de Kobo | Van a Avisos. | Salen de la cola de decisión; quedan como aviso con responsable y códigos (encaja con la alerta de P2). |
| P4. ¿Enumerador de Kobo y responsable de la hoja son la misma persona? | Sí, misma persona. | Hace falta una tabla de equivalencias de nombres en Insumos › Llave y filtros (sugerencia automática + confirmación). |
| P5. ¿Un enumerador con pocas efectivas puede quedar sin rellamada? | No: al menos 1 por persona. | Muestra proporcional con mínimo de un caso por enumerador con efectivas (PDM pasa de 20 a 26). |
| P6. ¿Se declara porcentaje o cantidad? | Cantidad. | Se mantiene `supervision_n`; la app muestra el porcentaje equivalente. |
| P7. Hoja de resultados de supervisión | Ejemplo: Sheets «Supervisión_Ronda3» (`12kfHvOnLGB4fE3ORxjHOQJhNutPw_QQSg8iKHpak24Q`, pestaña «supervision»). «Jala mucha información por un lado de la base de barrido y por otro de algunas preguntas y sus respuestas, porque va a ser la pregunta que el supervisor use para ver si las respuestas coinciden, pero además tiene sus propios campos como observaciones propias del supervisor y el resultado del status de su evaluación.» | Columnas: preguntas de control de Kobo con su respuesta (p. ej. «¿Acepta continuar con la encuesta?», «¿Es usted la persona que ha recibido la tarjeta prepago…?», «¿Recibió el efectivo el día que lo esperaba?», «¿Cuántas personas viven…?»), N, Fecha, COD.proGres, Código PULSO, Nombre del encuestador/a, nombre y teléfonos (Telefono_final, Tef1–Tef3), Observaciones, y los campos propios del supervisor: Responsable de la supervisión, Status (el del barrido), Status supervisión, Intentos supervisión, Observaciones re barrido, Status final. Supervisión lee esa hoja, cruza por Código PULSO o proGres, y muestra por caso el resultado de la rellamada y si las respuestas de control coinciden con Kobo. Solo lectura. |

## Control de tiempo (todas las modalidades, 2026-10-23)

| Pregunta | Respuesta | Consecuencia para el diseño |
|---|---|---|
| ¿Qué controla el control de duración? | «El control de tiempo no debe controlar tanto las encuestas largas, sino controlar las cortas.» | Solo las encuestas bajo el mínimo declarado son alerta y cuentan como casos a revisar. Las largas no son problema: a lo sumo un dato informativo neutro, sin color de alerta ni conteo en «a revisar». Aplica a Telefónico, Acreditación y Territorial. |
