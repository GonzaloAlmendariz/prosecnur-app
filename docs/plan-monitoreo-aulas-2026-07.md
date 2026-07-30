# Especificación funcional de Monitoreo de cursos–horario

## Auditoría de `Base de control` — operación PUCP 2025

**Estado:** especificación derivada de evidencia histórica  
**Fecha de auditoría:** 27 de julio de 2026  
**Fuente:** `Hostigamiento PUCP 2025_BD Aulas Agendadas-5.xlsx`  
**Hoja principal:** `Base de control!A1:AU40580`  
**SHA-256 de la fuente:** `81c36b5d3f9c8ea88417563bc7c1cc0e4de60912b1b1106e36786ea279800ae8`

> **Incorporado al repositorio el 2026-07-30.** Se auditó fuera del repo y vivía
> como artefacto suelto; queda aquí como el plan del modo Aulas, junto a
> `plan-monitoreo-acreditacion-2026-07.md` y `plan-monitoreo-telefonico-2026-07.md`.
>
> El XLSX de origen **no entra al repositorio** (§2). Este documento no
> reproduce nombres, teléfonos, correos ni respuestas: solo estructura de
> columnas y cifras agregadas del corte histórico.
>
> **Distancia con el código, medida al incorporarlo:** el guion de conexión
> (`fuentes/guionDeConexion.ts`) declara para `aulas_universitarias` **dos**
> piezas —formulario del aula y marco de cursos-horario—, y la §5.1 de este
> documento exige **cuatro** fuentes versionadas por separado: plan de muestra,
> agenda/contacto, eventos de campo y respuestas. Las dos que faltan son
> justamente las que sostienen lo que el Excel hacía y la app todavía no:
> distinguir estado de contacto de estado de aplicación, y tomar la asistencia
> de eventos de campo en vez de un pegado manual.

> Este documento interpreta el libro como una herramienta operativa construida y utilizada íntegramente en Excel durante 2025. Su propósito no es descalificar ese flujo histórico, sino convertirlo en requisitos verificables para el módulo **Monitoreo**, perfil **Aulas**, de Prosecnur.

## 1. Conclusión ejecutiva

`Base de control` es el modelo operativo central del libro. No es una simple tabla resumen: agrega las respuestas por `curso-horario`, trae información del marco y del campo, reconstruye un embudo de consentimiento/elegibilidad, mide duración, compara asistencia y envíos, controla una cuota de 70 %, distribuye respuestas por sexo y clasifica la aplicación por franja horaria.

Su unidad lógica es el **curso–horario que produjo al menos una respuesta**, identificado mediante el Collector ID de la encuesta.

En el corte histórico de 2025 reconstruye exactamente:

```text
196 registros de aplicación en campo
├─ 2 no aplicados
└─ 194 aplicados
   └─ 194 curso–horario con al menos una respuesta
      └─ 3.698 respuestas atribuibles a curso–horario
         ├─ 236 sin consentimiento de participación
         ├─ 98 sin consentimiento de conservación/uso futuro
         ├─ 60 sin elegibilidad por antigüedad
         └─ 3.304 respuestas elegibles
            ├─ 1.741 mujeres
            └─ 1.563 hombres

Fuera de la agregación: 10 respuestas sin Collector ID.
```

La lógica debe conservarse en Prosecnur, pero con nombres explícitos, fechas tipadas, fuentes reconciliadas y separación entre estado de contacto, estado de aplicación y validez de la respuesta.

## 2. Alcance y reglas de lectura

- Se analizaron fórmulas y valores cacheados almacenados en el XLSX.
- No se recalculó ni modificó el libro.
- No se reproducen nombres, teléfonos, correos ni narrativas sensibles.
- Las cifras son una **línea base histórica de aceptación**, no valores que deban hardcodearse en el producto.
- El archivo real no debe convertirse en fixture del repositorio. Las pruebas deben usar datos sintéticos o anonimizados.
- Las definiciones de consentimiento futuro, respuesta “efectiva”, cuota de 70 % y reemplazo necesitan ratificación metodológica.

## 3. Arquitectura de la hoja

La hoja tiene seis bloques visuales:

| Rango | Grupo | Función |
|---|---|---|
| `A:G` | Información del curso | Identificación, muestra, aula/horario planificados y denominadores. |
| `H:M` | Información del campo | Agenda, aplicador y ejecución efectiva. |
| `N:AA` | Control de cuenta | Envíos, exclusiones, elegibles y umbrales de 70 %. |
| `AB:AI` | Control de duración | Última respuesta y distribución por duración. |
| `AJ:AS` | Control de cuotas | Facultad, asistencia, avance y sexo. |
| `AT:AU` | Control de rango horario | Normalización y clasificación de la hora de aplicación. |

### 3.1 Dimensiones reales

- Área física: `A1:AX40580`.
- Área funcional: `A1:AU197`.
- Posiciones del array: 195 filas entre `B3:B197`.
- Fila vacía dentro del derrame: `B78`.
- Llaves reales: 194, en `3:77` y `79:197`.
- Columnas funcionales: 47, de `A` a `AU`.
- Panel congelado: encabezados hasta la fila 2.

### 3.2 Fórmulas

La hoja contiene 162.354 nodos de fórmula:

- 42 fórmulas matriciales maestras.
- 40.578 fórmulas en `D`.
- 40.578 en `E`.
- 40.578 en `H`.
- 40.578 en `K`.

Las columnas D, E, H y K contienen 40.578 nodos cada una y usan `__xludf.DUMMYFUNCTION`. El patrón es compatible con una conversión desde otro motor de hoja de cálculo, pero el OOXML no permite probar su origen exacto. En el uso histórico de Excel los valores cacheados permitieron ver resultados; para Prosecnur interesa reproducir la regla de negocio, no importar esas fórmulas literalmente.

### 3.3 Linaje general

```text
BD Agenda - Matriz
  └─ muestra, curso, aula/horario planificado, facultad y denominadores

Aulas Aplicadas (Campo)
  └─ agenda, aplicador, ejecución y asistencia

Actualizar datos
  └─ curso–horario, consentimientos, elegibilidad y sexo

Fechas normalizadas
  └─ última respuesta y bins de duración

Base de control
  └─ embudo, tasas, cuota, alertas y franja

Tabla - Resumen / Progreso General
  └─ snapshots y agregados de presentación
```

## 4. Diccionario exhaustivo de `Base de control`

### 4.1 Información del curso — `A:G`

| Col. | Nombre histórico | Significado probado | Fuente/regla | Traducción recomendada |
|---|---|---|---|---|
| A | MUESTRA | Ola o nivel de reemplazo que produjo la aplicación. | Busca B en `BD Agenda - Matriz!C:C` y devuelve muestra. | `wave`, `replacement_level`, `sample_role`. |
| B | CURSO-HORARIO | Collector ID y llave de agregación de respuestas. | Valores únicos de `Actualizar datos!D:D`, limpiando comillas curvas. | `course_schedule_id` o `classroom_id`. |
| C | NOMBRE DEL CURSO | Nombre académico del curso. | Matriz de agenda por B. | `course_name`. |
| D | AULA | Aula planificada extraída de la cadena de sesiones. | Regex sobre `BD Agenda - Matriz!J:J`. | `planned_room`; nunca confundir con `actual_room`. |
| E | HORARIO | Primera sesión académica planificada. | Regex al inicio de la cadena de sesiones. | `planned_schedule`. |
| F | MATRICULADOS TOTALES | Matrícula administrativa total. | Matriz de agenda. Total histórico: 7.070. | `enrolled_total`. |
| G | MATRICULADOS POBLACIÓN | Población objetivo elegible del curso. | Matriz de agenda. Total histórico: 6.232. | `target_population`. |

Hallazgos:

- Las 194 llaves de B son únicas en este corte.
- `G <= F` en las 194 filas.
- D contiene ocho `No encontrado`; el formato de sesiones no siempre permite extraer el aula.
- D y E describen planificación académica, no necesariamente lo sucedido en campo.
- La muestra utilizada fue: 145 titulares, 28 muestra 02, 8 muestra 03, 5 muestra 04, 6 muestra 05, 1 muestra 06 y 1 muestra 07.

### 4.2 Información de campo — `H:M`

| Col. | Nombre histórico | Significado | Fuente/regla | Hallazgo |
|---|---|---|---|---|
| H | FECHA AGENDADA | Día acordado para la aplicación. | Busca el curso en el bloque principal de Campo. | Falla en los 26 reemplazos. |
| I | HORA | Hora acordada. | Busca solo en el bloque principal. | Falla en los mismos 26 reemplazos. |
| J | APLICADOR | Responsable de ejecutar la aplicación. | Busca principal, reemplazo 2 y reemplazo 3. | Funciona; normaliza espacios. |
| K | FECHA DE APLICACIÓN | Fecha efectiva de campo. | Busca en los tres bloques. | Existe para las 194 llaves. |
| L | HORA DE APLICACIÓN | Hora efectiva. | Busca en los tres bloques. | En reemplazo 3 usa la hora agendada, no la aplicada. |
| M | STATUS DE APLICACIÓN | Estado de ejecución. | Busca en los tres bloques. | En reemplazo 3 apunta al estado de contacto, no al estado de aplicación. |

Resultado histórico mostrado por M:

- 192 `APLICADA`.
- 1 `AGENDADA`.
- 1 `REAGENDADA`.

Resultado correcto en la hoja de campo:

- 194 `APLICADA`.

Los dos falsos estados corresponden al tercer bloque de reemplazo. Para esos mismos registros, L conserva horas agendadas en vez de las horas reales.

La fecha agendada conocida coincide con la fecha de aplicación en los 168 registros principales. Los 26 reemplazos aparecen como `No encontrado`, no como aplicaciones en otro día.

### 4.3 Embudo de cuenta y elegibilidad — `N:AA`

| Col. | Nombre histórico | Fórmula real | Total/resultado 2025 | Nombre recomendado |
|---|---|---|---:|---|
| N | TOTAL ENVIADAS | Respuestas cuyo Collector ID coincide con B. | 3.698 | `submitted_count`. |
| O | VS TOTAL | `N/F`. | Media por curso 58,0 %. | `submission_rate_enrolled`. |
| P | VS POBLACIÓN | `N/G`. | Media por curso 65,0 %. | `submission_rate_target_population`. |
| Q | VALIDADOR 1 | Participación = No. | 236 | `excluded_no_participation_consent`. |
| R | VALIDADOR 2 | Participación = Sí y uso futuro = No. | 98 | `excluded_no_future_use_consent`. |
| S | VALIDADOR 3 | G y H = Sí; antigüedad/elegibilidad = No. | 60 | `excluded_tenure`. |
| T | TOTAL CORTAS | `Q+R+S`. | 394 | `excluded_route_count`. |
| U | CORTAS VS TOTAL | `T/N`. | 10,7 % agregado. | `excluded_route_rate`. |
| V | TOTAL LARGAS | `N-T`. | 3.304 | `eligible_count`. |
| W | LARGAS VS TOTAL | `V/N`. | 89,3 % agregado. | `eligible_rate`. |
| X | 70T | `ceil(0,70*F)`. | — | `target_70_enrolled`. |
| Y | 70P | `ceil(0,70*G)`. | — | `target_70_population`. |
| Z | VALIDO TOTAL | `V>=X`. | 45 cumplen; 149 no. | `meets_70_enrolled`. |
| AA | VALIDO POBLACIÓN | `V>=Y`. | 58 cumplen; 136 no. | `meets_70_population`. |

#### Interpretación correcta

`CORTAS` y `LARGAS` no se refieren a minutos. Describen una ruta corta de exclusión y una ruta larga/elegible del cuestionario.

`VÁLIDO` tampoco equivale a “respuesta metodológicamente válida”. En Z y AA significa únicamente que un curso alcanzó el 70 % del denominador elegido.

Los 58 cursos que cumplen el 70 % de población incluyen:

- 45 que también cumplen el 70 % de matrícula total.
- 13 que cumplen población objetivo, pero no matrícula total.

#### Riesgo lógico

V se calcula restando tres negativas explícitas. Si en un corte futuro existieran consentimientos o elegibilidad vacíos dentro de una respuesta con curso–horario, podrían quedar clasificados como elegibles. Prosecnur debe definir `eligible_count` con una condición positiva explícita y versionada.

### 4.4 Última respuesta y duración — `AB:AI`

| Col. | Rótulo histórico | Significado real | Total 2025 | Nombre recomendado |
|---|---|---|---:|---|
| AB | ÚLTIMO DÍA DE RESPUESTA | Fecha final de la última respuesta del curso. | 194 cursos | `last_response_at.date`. |
| AC | CONTROL - DURACIÓN | Hora final de la última respuesta. | 194 cursos | `last_response_at.time`. |
| AD | Sin rótulo | Respuestas de menos de 1 minuto. | 315 | `duration_lt_1_count`. |
| AE | Sin rótulo | Respuestas de 1 a menos de 2 minutos. | 91 | `duration_1_lt_2_count`. |
| AF | Sin rótulo | Respuestas de 2 minutos o más. | 3.292 | `duration_ge_2_count`. |
| AG | Sin rótulo | `AD/N`. | 8,5 % agregado. | `duration_lt_1_rate`. |
| AH | Sin rótulo | `AE/N`. | 2,5 % agregado. | `duration_1_lt_2_rate`. |
| AI | Sin rótulo | `AF/N`. | 89,0 % agregado. | `duration_ge_2_rate`. |

Conciliación exacta:

`315 + 91 + 3.292 = 3.698`.

De las 194 aplicaciones, 190 recibieron su última respuesta el mismo día y cuatro tuvieron respuestas posteriores; la demora máxima fue de cinco días. No hay últimas respuestas anteriores a la fecha de aplicación.

El merge `AC2:AJ2` oculta los nombres de AD:AI y atraviesa el límite del bloque de cuotas. En Prosecnur cada métrica debe tener un nombre visible y un tooltip metodológico.

### 4.5 Facultad, asistencia, cuota y sexo — `AJ:AS`

| Col. | Nombre histórico | Significado real | Resultado 2025 | Traducción recomendada |
|---|---|---|---:|---|
| AJ | Sin rótulo | Facultad/unidad académica. | 15 etiquetas | `faculty`. |
| AK | N° ASISTENTES EN AULA | Asistencia observada pegada manualmente. | 4.846 en Base | `observed_attendance`. |
| AL | N° ASISTENTES QUE NO RESPONDIERON | Comparación entre AK y N. | 192 evaluables | Separar `attendance_response_gap` y `attendance_reconciliation_status`. |
| AM | ASISTENCIA (%) | `AK/F`. | Mediana 74,4 % | `attendance_rate_enrolled`. |
| AN | CUOTA (%) | `V/G`. | Mediana 56,3 % | `eligible_rate_target_population`. |
| AO | FALTANTES CUOTA | Si AN>=70 %, texto; si no, `Y-V`. | 58 cumplidas | Separar `quota_missing` y `quota_status`. |
| AP | N° MUJERES | Respuestas del Collector ID cuyo sexo es Mujer. | 1.741 | `women_count`; usar `eligible_women_count` solo con filtro explícito. |
| AQ | N° HOMBRES | Respuestas del Collector ID cuyo sexo es Hombre. | 1.563 | `men_count`; usar `eligible_men_count` solo con filtro explícito. |
| AR | MUJERES (%) | `AP/V`. | 52,7 % agregado | `women_rate_over_eligible_denominator`. |
| AS | HOMBRES (%) | `AQ/V`. | 47,3 % agregado | `men_rate_over_eligible_denominator`. |

AP y AQ no incluyen un predicado explícito de elegibilidad: cuentan por Collector ID y categoría de sexo. En este corte `AP+AQ=V` exactamente porque los saltos del cuestionario dejan el sexo disponible en la ruta que coincide con V. Prosecnur no debe depender de esa coincidencia implícita.

#### Reconciliación de asistencia

La fuente de campo suma 4.931 asistentes, mientras AK suma 4.846:

- Seis cursos presentan diferencias.
- Cuatro presentan valores no vacíos distintos entre Base y Campo; interpretarlos como desactualizados supone que Campo representa el corte más reciente.
- Dos reemplazos tienen AK vacío pese a registrar 36 y 42 asistentes.
- Diferencia neta: 85 asistentes.

AK debe migrar como dato derivado de eventos de campo, no como entrada manual aislada.

#### Envíos frente a asistentes

Entre 192 cursos con asistencia en Base:

- 144 tienen más asistentes que envíos.
- 26 tienen exactamente el mismo número.
- 22 tienen más envíos que asistentes y requieren revisión.
- La máxima diferencia de envíos sobre asistentes es 12.
- La máxima cantidad de asistentes que no enviaron respuesta es 61.

AL mezcla tres tipos de salida:

- `Revisar(n)` cuando hay más envíos que asistentes.
- `Completo` cuando coinciden.
- Un número cuando asistentes superan envíos.

La interfaz debe separar estado y magnitud para permitir ordenar, filtrar y agregar.

#### Tasas superiores a 100 %

- O, envíos/matrícula total: 6 cursos sobre 100 %.
- P, envíos/población objetivo: 17 sobre 100 %.
- AM, asistentes/matrícula total: 2 sobre 100 %.
- AN, elegibles/población objetivo: 9 sobre 100 %.

No son necesariamente errores: pueden expresar denominadores desactualizados, participación de otra sección o diferencias entre población administrativa y campo. Deben producir una alerta explicable, no bloquear automáticamente el curso.

#### “Efectivas” de campo

La hoja de campo suma 4.269 “efectivas”, mientras Base cuenta 3.698 envíos atribuibles. Existen diferencias en 153 de 194 cursos. El campo histórico es una estimación/manual operativo y no debe renombrarse como `submitted_count` ni `eligible_count`.

### 4.6 Franja horaria — `AT:AU`

| Col. | Nombre | Regla | Resultado 2025 |
|---|---|---|---:|
| AT | NORM - HORARIO | Convierte la hora textual de aplicación a una hora normalizada. | 194 valores. |
| AU | RANGO - HORARIO | Mañana 07:00–<09:00; regular 09:00–<19:00; noche 19:00–21:00. | 9 mañana, 165 regular, 20 noche. |

No hubo registros fuera de rango. Los dos reemplazos 3 usan una hora equivocada en L, pero permanecen dentro de la misma franja y no alteran el total histórico.

## 5. Qué debe representar Monitoreo

La jerarquía canónica del perfil Aulas tiene cinco secciones: **Fuentes, Agenda, Avance, Validación y Consultas**.

### 5.1 Fuentes

Debe declarar y versionar cuatro fuentes distintas:

1. **Plan de muestra**
   - `selection_run_id`, `frame_hash`, posición, titular, reservas y orden.
   - Curso, sección, horario, facultad, matrícula y población objetivo.

2. **Agenda/contacto**
   - Intentos, medio, estado de contacto, fecha programada, responsable y enlaces.

3. **Eventos de campo**
   - Estado de aplicación, fecha/hora real, aula real, asistencia e incidencias.

4. **Respuestas**
   - Collector ID, UUID, timestamps, filtros de elegibilidad y variables de cuota.

Controles de Fuentes:

- Fecha y hash del último corte.
- Cobertura del mapeo de curso–horario.
- Identificador de la corrida de muestra.
- Versión de las reglas de elegibilidad.
- Prohibición de guardar secretos o narrativas sensibles en el proyecto operativo.

### 5.2 Agenda

Una fila debe representar un candidato de la cadena de una posición muestral, no doce bloques horizontales.

Campos mínimos:

- `selection_slot_id`.
- `operational_code`.
- `titular_operational_code`.
- `replacement_order` y `sample_role`.
- `course_schedule_id`.
- `contact_status`.
- `application_status`.
- `scheduled_at`.
- `applied_at`.
- `planned_room` y `actual_room`.
- `responsible`.
- `replacement_reason`.
- `updated_at` y `updated_by`.

El estado de contacto y el estado de aplicación no pueden compartir la misma columna.

### 5.3 Avance

Debe mostrar, por curso–horario y agregado:

- Cursos planificados, contactados, agendados, aplicados, no aplicados y reemplazados.
- Respuestas recibidas, atribuibles, no atribuibles, elegibles y validadas.
- Exclusiones por cada filtro.
- Meta y brecha contra población objetivo.
- Asistencia, envíos y reconciliación entre ambos.
- Duración en bins configurables.
- Distribución por sexo/facultad.
- Cumplimiento frente a objetivo original y sobremuestra, cuando existan.

KPIs históricos que deben poder reproducirse:

| Indicador | Línea base 2025 |
|---|---:|
| Registros de campo | 196 |
| Aplicaciones reales | 194 |
| Curso–horario con respuestas | 194 |
| Respuestas crudas | 3.708 |
| Respuestas atribuibles | 3.698 |
| Respuestas sin curso–horario | 10 |
| Exclusiones de ruta | 394 |
| Elegibles | 3.304 |
| Mujeres elegibles | 1.741 |
| Hombres elegibles | 1.563 |
| Cursos que cumplen 70 % de población | 58 |

### 5.4 Validación

Debe generar controles explícitos, como mínimo:

- Respuesta sin `course_schedule_id`.
- UUID duplicado.
- Curso del plan sin evento de campo.
- Evento aplicado sin respuestas.
- Respuestas para curso no planificado.
- Reemplazo sin titular o posición muestral.
- Estado de contacto usado como estado de aplicación.
- Fecha/hora agendada o aplicada ausente.
- Aula planificada no extraíble.
- Asistencia faltante o desactualizada.
- Envíos superiores a asistentes.
- Tasas superiores a 100 %.
- Últimas respuestas muchos días después de la aplicación.
- Consentimiento/elegibilidad incompletos.
- Cuota no evaluable por denominador ausente.
- Categoría de sexo no contemplada en el desglose.

Cada alerta necesita:

- `check_code` estable.
- Severidad.
- Curso–horario o evento afectado.
- Valor observado y esperado.
- Fuente de evidencia.
- Acción sugerida.
- Estado de revisión, responsable y fecha.

### 5.5 Consultas

Debe convertir las excepciones del Excel en colas accionables:

- Agendadas pendientes de aplicación.
- Reagendadas.
- Reemplazos activados o pendientes.
- Aplicadas sin respuestas.
- Respuestas sin curso–horario.
- Cursos debajo del 70 %.
- Envíos mayores que asistencia.
- Asistencia mayor que matrícula.
- Duraciones atípicas.
- Diferencias entre dato de campo y dato calculado.
- Brechas por facultad, sexo y franja horaria.

Las consultas deben filtrar por fecha, facultad, muestra, aplicador, estado, reemplazo y franja.

## 6. Relación con el contrato actual de Prosecnur

El perfil Aulas actual ya contiene buena parte del vocabulario necesario:

- `selection_run_id`, `selection_slot_id` y códigos operativos.
- `sample_role`, `wave`, `replacement_order` y cadena de reemplazo.
- `classroom_id`, curso, sección, horario, facultad y estrato.
- `eligible_n`, `expected_valid` y estado operativo.
- `responses_total`, `respuestas_validas`, filtros, brecha y cuotas.
- Secciones Fuentes, Agenda, Avance, Validación y Consultas.

La lógica 2025 aporta requisitos que todavía deben quedar explícitos en el contrato:

| Necesidad histórica | Campo/entidad recomendada |
|---|---|
| Evento real de aplicación | `application_event_uuid`. |
| Diferenciar contacto y aplicación | `contact_status`, `application_status`. |
| Fecha/hora tipadas | `scheduled_at`, `applied_at`. |
| Aula planificada versus real | `planned_room`, `actual_room`. |
| Matrícula total | `enrolled_total`. |
| Población objetivo | `target_population`. |
| Asistencia observada | `observed_attendance`. |
| Estimación manual de campo | `field_reported_effective`. |
| Envíos reales | `submitted_count`. |
| Elegibles | `eligible_count`. |
| Validadas analíticamente | `validated_count`. |
| Causas de exclusión | Tres contadores separados y versionados. |
| Duración | Contadores y tasas por bins configurables. |
| Reconciliación asistencia/respuesta | Diferencia numérica + estado. |
| Auditoría | `source_updated_at`, `snapshot_at`, `review_status`. |

`expected_valid` puede representar el umbral histórico `ceil(0,70 * target_population)`, siempre que la metodología lo declare. No debe inferirse silenciosamente.

## 7. Modelo de datos mínimo

### 7.1 Unidad muestral

```text
sample_slot
  id
  selection_run_id
  stratum
  titular_candidate_id
  target_population
  expected_valid
```

### 7.2 Candidato y reemplazo

```text
sample_candidate
  id
  sample_slot_id
  replacement_order
  course_schedule_id
  sample_role
  activation_status
  replacement_reason
```

### 7.3 Intento y cita

```text
contact_attempt
  id
  candidate_id
  attempted_at
  medium
  result
  responsible

appointment
  id
  candidate_id
  scheduled_at
  planned_room
  status
```

### 7.4 Evento de aplicación

```text
application_event
  id
  candidate_id
  applied_at
  actual_room
  application_status
  observed_attendance
  field_reported_effective
  responsible
```

### 7.5 Respuesta agregada por curso–horario

```text
course_response_summary
  course_schedule_id
  snapshot_at
  submitted_count
  unmapped_count
  excluded_no_participation_consent
  excluded_no_future_use_consent
  excluded_tenure
  eligible_count
  validated_count
  duration_lt_1_count
  duration_1_lt_2_count
  duration_ge_2_count
  eligible_women_count
  eligible_men_count
```

## 8. Reglas que deben congelarse antes de implementar

1. ¿El rechazo al uso futuro excluye la participación o solo la conservación posterior?
2. ¿Qué significa exactamente “población” frente a “matriculados totales”?
3. ¿El 70 % es meta operativa, criterio de cierre o criterio de validez metodológica?
4. ¿Qué diferencia una respuesta elegible de una respuesta analíticamente validada?
5. ¿Qué significa “efectiva” en la planilla de campo?
6. ¿Cuál es la regla formal para activar un reemplazo?
7. ¿Qué atributos debe conservar el reemplazo respecto del titular?
8. ¿Cómo tratar categorías de sexo distintas de Mujer/Hombre en el control de cuota?
9. ¿Cuántos minutos definen una duración de revisión y depende de la ruta recorrida?
10. ¿Cuánto tiempo puede permanecer abierta la recepción después de aplicar un curso?

## 9. Criterios de aceptación usando la línea base 2025

Una implementación que reproduzca este corte —con los errores históricos corregidos— debe cumplir:

1. Importar 196 registros de campo y clasificarlos como 194 aplicados y 2 no aplicados.
2. Vincular 194 aplicaciones a 194 llaves únicas de curso–horario.
3. Contar 3.708 respuestas crudas.
4. Marcar 10 como no atribuibles por falta de Collector ID.
5. Agregar 3.698 respuestas atribuibles.
6. Obtener 236, 98 y 60 exclusiones en los tres filtros históricos.
7. Obtener 394 exclusiones totales y 3.304 elegibles.
8. Reconciliar 1.741 mujeres + 1.563 hombres = 3.304 elegibles.
9. Reconciliar 315 + 91 + 3.292 = 3.698 respuestas por duración.
10. Identificar 58 cursos que cumplen 70 % de población y 45 que cumplen 70 % de matrícula total.
11. Mostrar las 194 aplicaciones como aplicadas; no heredar los dos estados de contacto del tercer reemplazo.
12. Recuperar fecha y hora agendada para los 26 reemplazos.
13. Usar la hora real en los dos reemplazos de tercer nivel.
14. Tomar asistencia desde la fuente de campo y obtener 4.931, no el snapshot manual de 4.846.
15. Detectar los 22 cursos donde envíos superan asistencia.
16. Mantener separado `field_reported_effective` de envíos y elegibles.
17. No depender de fórmulas Excel, merges ni columnas completas.
18. Usar fixtures sintéticos que conserven la lógica sin incorporar información sensible.

## 10. Prioridades de implementación

### P0 — contrato y verdad operativa

- Definir `application_event_uuid`.
- Separar estado de contacto y aplicación.
- Modelar titular y reemplazos longitudinalmente.
- Definir explícitamente elegibilidad y meta de 70 %.
- Conectar asistencia directamente con eventos de campo.
- Controlar respuestas no atribuibles.

### P1 — paridad funcional con Base de control

- Embudo por curso–horario.
- Duración por bins.
- Reconciliación asistentes–envíos.
- Cuota y brecha por curso.
- Sexo por facultad.
- Última respuesta y franja horaria.
- Consultas accionables.

### P2 — gobierno y evolución

- Versionar reglas metodológicas.
- Registrar revisiones y decisiones.
- Sustituir snapshots manuales por vistas derivadas.
- Incorporar representatividad y ponderación de reemplazos sin confundirlas con avance operativo.
- Añadir exportaciones anonimizadas y política de retención.

## 11. Hallazgos históricos que no deben copiarse al producto

- Doce muestras dispuestas como 241 columnas horizontales.
- Copias manuales de agenda y planillas diarias.
- Estado de contacto y aplicación reutilizado en una misma salida.
- Fechas y horas almacenadas como texto.
- Salidas mixtas texto/número en AL y AO.
- Aula extraída por regex como si fuera el aula real.
- Asistencia pegada manualmente.
- Resúmenes estáticos sin fecha clara de corte.
- Fórmulas extendidas hasta la fila 40.580.
- Dependencia de columnas completas y `DUMMYFUNCTION`.
- Datos personales y respuestas sensibles dentro del mismo archivo operativo.

## 12. Decisión recomendada

Usar `Base de control` como **especificación empírica de requisitos** y como **oráculo histórico de aceptación**, no como esquema de importación literal.

La implementación de Monitoreo debe preservar cuatro capacidades del Excel:

1. Saber qué curso–horario se planificó, reemplazó y aplicó.
2. Reconciliar asistencia, envíos, elegibilidad y cuota.
3. Detectar rápidamente brechas y excepciones de campo.
4. Entregar un corte auditable por facultad, sexo, fecha y franja.

Al mismo tiempo debe eliminar los puntos frágiles del modelo histórico: bloques horizontales, fórmulas no portables, snapshots manuales, estados ambiguos y mezcla de información sensible con logística.
