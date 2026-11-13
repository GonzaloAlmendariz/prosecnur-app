# Checklist: Material de campo › Correo, archivado, prueba de horarios y correo personal (2026-11-11)

Tipo: Checklist QA fechado
Estado: En curso
Fecha: 2026-11-11
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados

Pedido de Gonzalo, relevado desde la sesión de Acreditación Institucional PUCP 2026. Rama 1 (Construir) con UI.
Lo que hoy se hace con scripts sueltos (`actualizar_respondio.R`, `preparar_correos_personales.R`,
`cargar_correos_personales.R` y el protocolo de la prueba de horario) pasa a la app. Sólo Gonzalo da este
checklist por terminado.

## Restricciones

- La app NUNCA envía ni programa campañas en Mailchimp: deja borradores (`collection_mail_mailchimp_borrador.R`).
  Cambiarlo exige ADR y visto bueno de Gonzalo; si aparece, el ítem queda **bloqueado**.
- Tests con mocks y sin red. Nunca se escribe en la audiencia real de Mailchimp ni en SurveyMonkey.
- Archivos congelados intactos; lo nuevo va en archivos nuevos.
- El material del cliente no entra al repo (los .pulso y CSV del estudio se leen desde su carpeta, fuera del repo).

## Ítems

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Archivar en Mailchimp a quienes ya respondieron, en el mismo paso que "Respondió", para todos los públicos y para los dos correos de cada persona; "Respondió" sólo a suscriptores activos; opción para que corra antes de cada envío | motor `collection_mail_mailchimp_archivo.R` + `collection_mail_mailchimp.R` (sync) + UI Seguimiento › Quién respondió y Envíos › Quién ya respondió | hecho, por revisar con Gonzalo (sin probar contra Mailchimp real) |
| 1a | Mostrar quién dejó la encuesta a medias (respuesta parcial no cuenta como respondido) | `.cmail_respuestas_apply` (store `parcial`) + Contactos ("A medias") | hecho, por revisar |
| 2 | Prueba de horarios A/B: asignación al azar con semilla 50/50 por público y etiquetas "Envío mañana"/"Envío tarde"; plan de recordatorios cruzado con horario de oficina por público; análisis a igualdad de horas con CMH, IC y lectura por público; informe PDF con estética Pulso verificado con render | motores `collection_mail_prueba_horario*.R` + UI Seguimiento › Prueba de horarios | hecho, por revisar (análisis validado contra R1 y R2 reales) |
| 3 | Opcional: correo personal de egresados 80/20 al azar, estratificado por público × grupo, archivado de los dos correos, inválidos que fallan no se reintentan, lectura del efecto 80 contra 20 | motor `collection_mail_correo_personal.R` + UI Seguimiento › Correo personal | hecho, por revisar |
| 4 | Pasada de didáctica: ¿una persona del equipo puede hacerlo fácil? Recorrido con `/ver-ui` como alguien nuevo, fricciones anotadas y corregidas | sección "Didáctica" | hecho, por revisar |

## Diseño acordado en esta sesión

- **Dónde se cuelga.** Material de campo › modo correo gana la sección "Seguimiento" con tres pestañas:
  "Quién respondió", "Prueba de horarios" y "Correo personal". Son operaciones del estudio entero (todos los
  públicos a la vez), no de una campaña, por eso no van dentro del editor de una campaña.
- **Datos personales.** Grupo de horario, brazo 80/20, segundo correo, hora de la respuesta completa y respuesta
  parcial se guardan en el store de contactos de cada campaña (viaja en `files/contactos/`, ADR 0112), nunca en
  `state.rds`. En `state.rds` sólo va la configuración: semilla, etiquetas, plan de horas, ids de campañas de
  Mailchimp y la opción "antes de cada envío".
- **Archivar.** `DELETE /lists/{id}/members/{hash}` por `/batches`; reversible, lo archivado no se cobra. Antes de
  etiquetar "Respondió" se leen los suscriptores activos de la audiencia (un archivado da HTTP 400).
- **Antes de cada envío.** La app no programa nada: mientras está abierta, consulta las campañas que ya están
  programadas en Mailchimp y lanza "Quién respondió" (con archivado, si está marcado) unos minutos antes de cada
  una. El total de destinatarios se lee con el `GET` de cada campaña: el listado lo da en 0.
- **Denominador del análisis.** Quienes recibieron el recordatorio: personas del grupo con enlace personal que no
  habían completado antes del envío de su grupo. La completa se cuenta en la ventana de H horas desde el envío de
  su grupo (igual H para ambos grupos). Un público con la misma hora en los dos grupos no entra a la comparación de
  ese recordatorio.

## Evidencia

### Backend (2026-11-11)

- Motores nuevos: `collection_mail_mailchimp_archivo.R` (activos, archivado por `/batches`, programadas, decisión
  "antes de cada envío"), `collection_mail_seguimiento.R` (configuración, "Quién respondió" en todas las campañas),
  `collection_mail_prueba_horario.R` (sorteo, etiquetas, plan, borradores por grupo, lectura de envíos),
  `collection_mail_prueba_horario_analisis.R`, `collection_mail_prueba_estadistica.R` (Wilson, Newcombe, CMH),
  `collection_mail_prueba_horario_informe.R` (PDF), `collection_mail_correo_personal.R`; rutas en
  `router_recopiladores_seguimiento.R`. Cambios chicos: `.mc_sync_run` (sólo activos, archivar, hora de la completa,
  a medias), `.cmail_respuestas_apply` y la lista de Contactos (`a_medias`, filtro `respondio=parcial`), borrador con
  etiqueta de grupo y título "Campaña, recordatorio 1, grupo A (8:00 p. m.)" (sin "·").
- Tests: `test-collection-mail-seguimiento.R` (96 expectativas, sin red) y mocks de "activos" en los tests de
  Mailchimp existentes. `make gate-area AREA=correos` con el patrón de las suites de correo: 977 pass, 0 fail, exit 0.
- **Validación contra lo real** (sin red, sin escribir en el repo): asignación `ab_asignacion.rds` + respuestas del
  snapshot del .pulso de Monitoreo del estudio, con las horas del protocolo. A 24 horas: R1 4.20 % contra 4.03 %
  (CMH p = 0.43; lo real fue 4.22 % y 4.03 %, p = 0.40) y R2 2.04 % contra 2.57 % (p = 0.001, OR 0.79; lo real fue
  <0.001). A 40 horas: R1 4.62 % contra 4.25 % (p = 0.09) y R2 2.23 % contra 2.65 % (p = 0.01), igual que el
  protocolo. Por público en R2: Estudiantes de pregrado y Administrativos a favor de las 8:00 p. m., Profesores y
  Egresados de pregrado sin diferencia, como en el protocolo. Las décimas que difieren salen de usar la hora
  programada y no la de entrega. El CMH a mano coincide con `stats::mantelhaen.test` (test).
- **Informe PDF**: renderizado con esos datos y leído página por página (3 páginas: resumen y tabla de recordatorios
  con la diferencia y su intervalo; un bloque por recordatorio con tabla por público, diferencia por público y curva
  acumulada; "Cómo se midió"). Defectos vistos y corregidos en el render: el subtítulo pisaba el título y cada
  recordatorio ocupaba una página con media hoja vacía.

### Interfaz (2026-11-11)

- Sección nueva `/material-campo?modo=correo&seccion=seguimiento` con pestañas `respondieron`, `horarios` y
  `correo-personal` (la última en el grupo "Opcional" del rail). Entrada: botón "Seguimiento de correos" en la lista
  de campañas. Cliente `src/api/mailSeguimiento.ts`; vista en `features/recopiladores/seguimiento/`; el latido
  "antes de cada envío" vive en `AntesDeCadaEnvioHost` (montado en `Layout.tsx`, no corre en modo público ni sin
  proyecto).
- Envíos › "Quién ya respondió" ganó el Switch "Archivar a quienes respondieron"; Contactos muestra "A medias" en la
  fila, en el filtro y en el resumen.
- `tsc --noEmit`: exit 0. `make gate-front AREA=recopiladores`: 2,065 de 2,066 tests; el único rojo es ajeno
  (`inputsDelKit.contract.test.ts`, ratchet de casillas de `analitica/panes/CrucesPane.tsx`, modificado por otra
  sesión). Tests de `src/api/` de correo: 28 pass.
- Recorrido en pila aislada (backend en 8851 con `HOME` aparte, sin claves: no pudo escribir en Mailchimp ni leer
  SurveyMonkey) con un .pulso sintético fuera del repo (5 públicos, 2,960 contactos inventados). Vistos a 1440x1000
  y 1024x600: Quién respondió, Prueba de horarios (los seis pasos, grilla del plan, resultados), Correo personal
  (efecto), Contactos con "A medias" y la descarga del informe (genera el PDF y lo guarda en Entregables).
- No probado: cualquier llamada real a Mailchimp o SurveyMonkey (archivar, etiquetar, cargar, borradores, leer
  envíos y programadas). Sólo con mocks.

## Didáctica

**¿Lo puede hacer fácil una persona del equipo?** Sí para el seguimiento diario y con algo de guía para preparar la
prueba. Quién respondió es una pantalla con una tabla y un botón; la prueba de horarios va numerada en seis pasos
con su estado (hecho, sigue, pendiente), de modo que se ve dónde se quedó; el correo personal es opcional y queda
apartado. Lo que sigue pidiendo criterio no es de la interfaz sino del diseño: decidir las horas de cada recordatorio
y respetar el horario de oficina. Para eso la app propone el plan cruzado y avisa si una hora queda fuera de oficina
o si los dos grupos coinciden.

**¿Es intuitivo?** Casi. Lo que más ayuda es que cada paso dice qué le falta ("Asigna primero los grupos", "Elige la
audiencia en Quién respondió") y que la app nunca envía: el último paso de cada borrador es Mailchimp.

Fricciones del recorrido, como alguien nuevo:

| # | Fricción | Estado |
|---|---|---|
| D1 | El campo de la semilla cortaba el número (se veía "2026110"). | corregida (`.rec-seg-semilla`, 14ch) |
| D2 | En la grilla del plan, el enlace a Mailchimp se partía en dos líneas y se salía de la fila. | corregida: celda en una línea, columna de 400 px, la salida dice sólo la hora si fue el día programado ("Salió 10:25") |
| D3 | La cabecera "Grupo A, Envío mañana" sobre una celda de las 8:00 p. m. (por el cruce) confunde: el nombre de la etiqueta parece la hora. | corregida: la grilla dice "Grupo A" y "Grupo B"; el nombre de la etiqueta queda en el paso 3 |
| D4 | "8 horas de envío salen del plan" contaba las horas de un recordatorio que todavía no sale. | corregida en el motor (sólo cuenta las que entran al análisis) |
| D5 | El efecto del correo personal sin completas decía "no hay diferencia clara" y dejaba "()" vacío. | corregida en el motor: "Todavía no hay completas desde el primer envío al correo personal"; test nuevo |
| D6 | La fila Total de la tabla de resultados decía "Gana el grupo B" sin la hora, y las filas por público sí la decían. | corregida |
| D7 | Las pestañas del rail son íconos con nombre al pasar el mouse y el título de la pestaña no se ve. Es el patrón del rail de la casa (igual que Editor y Contactos), así que no se cambió aquí. | anotada, decisión de diseño de la casa |
| D8 | Dentro de un correo abierto no hay entrada a Seguimiento: el shell de la campaña no tiene barra de secciones. Se llega desde la lista de campañas. | anotada, por decidir |
| D9 | Los campos de hora muestran "08:30 AM" en el navegador de prueba (control nativo con el idioma del sistema). En la app de escritorio sale con el idioma del equipo. | anotada |
| D10 | "Horas desde el envío" en Resultados no se guarda en el proyecto (el informe usa el valor que se elige en ese momento). | anotada, por decidir |

**Decisión de redacción tomada al construir:** se dice "asignación al azar" y no "sorteo" en la interfaz (regla de
redacción de `CLAUDE.md`), también en los mensajes del motor ("Asigna primero los grupos al azar").

## Revamp visual de Seguimiento (pedido del 2026-11-11, "mejora el UI aún más")

**Dirección congelada.** Problema: Seguimiento se lee como un formulario largo de tarjetas iguales; el título de la
pestaña no se ve; los seis pasos tienen la misma jerarquía visual (hechos, el que sigue y los pendientes); los
resultados son tablas de texto ("+2.31 pp (IC 95 %: ...)") que no se leen de un vistazo; los vacíos son líneas
sueltas. Tarea primaria: saber en qué paso está la prueba y qué hora gana. Se conserva: navegación v3 (sección
`seguimiento` con tres pestañas), textos y contratos del motor. Patrón reutilizado: Aulas › Accesos
(`AccesosTablero`: `CifrasEnTarjeta` arriba, chequeos numerados con estado), `TabHeading`, `EstadoVacio`,
`BarraDeAvance`. Criterio de éxito: en 1440x1000 y 1024x600 se ve sin desplazarse el título, las cifras y el paso
que sigue; cada recordatorio muestra ganador, cifras e intervalo sin leer la tabla; ningún vacío es una línea suelta.

| # | Punto | Estado |
|---|---|---|
| R1 | Título visible y cifras por pestaña (`TabHeading` + `CifrasEnTarjeta`) | hecho, por revisar |
| R2 | Jerarquía de los seis pasos: línea de tiempo, paso que sigue abierto, hechos plegados en una línea con su resumen, pendientes atenuados | hecho, por revisar |
| R3 | Resultados de un vistazo: cifras grandes por grupo (A navy, B ocre) con barra, píldora de veredicto, intervalo dibujado por público | hecho, por revisar |
| R4 | Grilla del plan: banda por recordatorio con "Ya salió", punto de color por grupo, chip de estado de cada borrador, alto parejo | hecho, por revisar |
| R5 | Estados vacíos con `EstadoVacio`, con causa y acción ("Ir a Campañas", "Ir a Contactos", "Ir a Envíos") | hecho, por revisar (vistos en tests de render; el .pulso de QA no tiene vacíos) |
| R6 | D8: entrada a Seguimiento desde un correo abierto con el mismo `SectionPillbar` "Correo, Seguimiento" | hecho en commit aparte, **por decidir**: choca con el pedido del 2026-10-20 (el correo abierto sin banda propia, para que el editor gane alto); la banda resta unos 50 px al editor a 1024x600 |

**Defectos encontrados en la QA y corregidos.** (1) El paso 6 salía plegado aunque había envíos, y las cifras de
arriba decían "Sin resultados": los resultados sólo se leían al abrir el paso, que sólo se abría con resultados; ahora
se leen al entrar a la pestaña. (2) Las cifras grandes salían sin el color de su grupo y sin barra: los tokens
`--pulso-data-brazo-*` viven en `tokens-datos.css`, que no se cargaba en Seguimiento. (3) "Estudiantes de pregr…"
y luego las horas se cortaban en la tabla por público: anchos de columna. (4) A 1024x600 las cuatro cifras pasaban a
2x2 y los pasos hechos ocupaban dos líneas cada uno, y el paso que sigue quedaba bajo el pliegue: cifras en una fila
hasta 900 px y pasos hechos en una sola línea.

**Evidencia.** Capturas en 1440x1000 y 1024x600 de las tres pestañas, del paso 4 abierto con la grilla, de los
resultados y del editor de un correo abierto con la barra nueva, sobre el .pulso sintético (5 públicos). `tsc`
exit 0; `make gate-front AREA=recopiladores` exit 0 (168 archivos, 2,091 tests); redacción sin hallazgos.

**Anotado, no corregido.** Los campos "Fechas y horas" del plan muestran 09:30 y 20:00 por defecto aunque el plan
guardado use otras horas (sólo afectan a "Proponer plan cruzado"). Los tokens de los grupos son de un solo tema (el
modo oscuro no se revisó).

Pila de QA: backend aislado en 8851 con `HOME` aparte y una copia del lanzador **sin** el paso que reinstala el
paquete R (`load_all` solamente), por la prohibición de hoy de `R CMD INSTALL`. El 8787 no se tocó.
