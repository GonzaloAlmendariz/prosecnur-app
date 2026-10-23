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
