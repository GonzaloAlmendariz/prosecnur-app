# Anatomía de los tres Excel de un estudio de aulas

Fuente: `HSTVG2026/Historico 2025/Hostigamiento PUCP 2025_BD Aulas Agendadas-6.xlsx`
(19 hojas; tres son las que gobiernan el operativo). Leído el 2026-08-16.

**La regla que cambia el planteamiento**: estos Excel **se llenan en Excel** y la
app **los lee**. No al revés. Son el instrumento de trabajo del equipo —se llama
por teléfono con la hoja abierta, se anota en campo sobre ella— y la app no debe
pretender sustituirlos.

---

## 1. «Aulas Agendadas» — la dimensión de AGENDAMIENTO
171 filas × **241 columnas** = 1 columna de `ID MATCH` + **12 bloques de 20
columnas**: el titular y **once eslabones** de cadena de reemplazo, uno al lado
del otro en la misma fila.

Cada bloque repite la misma estructura:

| Campo | Qué es |
|---|---|
| MUESTRA | Ola (`Muestra 01`…) |
| CURSO-HORARIO | El código operativo |
| NOMBRE / TELÉFONO / CORREO PUCP DEL DOCENTE | **A quién se llama** |
| NOMBRE DEL CURSO · FACULTAD · NIVEL · SESIONES Y AULA | Identidad del aula |
| MATRICULADOS TOTAL DTI · MATRICULADOS POBLACIÓN | Los dos denominadores |
| MEDIO DE CONTACTO · FECHA DE LLAMADA · **NÚMERO DE INTENTOS** | **El ciclo de contacto** |
| STATUS MUESTRA | Resultado del contacto |
| FECHA DE APLICACIÓN · DÍA · HORA | Lo agendado |
| ENLACE DE LA FICHA | El QR/enlace de esa aula |
| OBSERVACIONES | Texto libre |

**Vocabulario observado de `STATUS MUESTRA`**: `AGENDADA` (119) · `REEMPLAZADA`
(24) · `EN RESERVA 1` (19) · `REAGENDADA` (8).
**`MEDIO DE CONTACTO`**: `Llamada` (123) · `Correo Electrónico` (33) · `-` (14).

---

## 2. «Base de control» — la dimensión de CONTROL DE CALIDAD
Una fila por aula, en **seis grupos** declarados en la fila 1:

| Grupo | Campos |
|---|---|
| INFORMACIÓN DEL CURSO | muestra, curso-horario, curso, aula, horario, matriculados totales y población |
| INFORMACIÓN DEL CAMPO | fecha agendada, hora, **aplicador**, fecha y hora de aplicación, STATUS DE APLICACIÓN |
| CONTROL · CUENTA | TOTAL ENVIADAS, VS TOTAL, VS POBLACIÓN, VALIDADOR 1/2/3, TOTAL CORTAS y su %, TOTAL LARGAS y su %, **70T**, **70P**, VALIDO TOTAL, VALIDO POBLACIÓN |
| CONTROL · DURACIÓN | ÚLTIMO DÍA DE RESPUESTA y derivados |
| CONTROL · CUOTAS | **N° ASISTENTES EN AULA**, **N° ASISTENTES QUE NO RESPONDIERON**, ASISTENCIA (%), CUOTA (%), FALTANTES CUOTA, N° MUJERES, N° HOMBRES y sus % |
| CONTROL · RANGO HORARIO | NORM-HORARIO, RANGO-HORARIO |

Es el control de calidad **por aula**: cuánto se recogió contra los dos
denominadores, cuántas respuestas son sospechosamente cortas o largas, si el
aula llega al 70%, cómo va la cuota por sexo y si la aplicación cayó en el rango
horario declarado.

---

## 3. «Aulas Aplicadas (Campo)» — la dimensión de PARTE DE CAMPO
1001 filas × 101 columnas, en **tres bloques**: `MUESTRA DE APLICACIÓN
PRINCIPAL`, `APLICACIÓN DE REEMPLAZO 2`, `APLICACIÓN DE REEMPLAZO 3`.

Cada bloque = el bloque de agenda **más el parte de lo que pasó en el aula**:

| Campo | Qué es |
|---|---|
| **CANTIDAD DE ASISTENTES** | Cuántos había de verdad |
| **% ASISTENCIA** | Contra matriculados |
| **CANTIDAD DE RECHAZOS** | Quien dijo que no |
| **DUPLICADOS (YA RESPONDIERON)** | Ya habían contestado en otra aula |
| **CANTIDAD DE EFECTIVAS** | **El número que manda** |
| APLICADOR | Quién estuvo |
| **AULA** | Dónde se aplicó **de verdad** — puede no ser la planificada |
| FECHA / HORA DE APLICACIÓN | Cuándo |
| STATUS DE APLICACIÓN | `APLICADA` (168) · `NO APLICADA` (2) |
| OBSERVACIONES SOBRE APLICACIONES | Texto libre |

Es el análogo de la **base de barrido telefónico** de los otros modos de
Monitoreo: una hoja que se llena mientras el campo ocurre.

---

## Qué implica para la app

1. **Son dos ejes de estado, no uno.** `STATUS MUESTRA` (agendamiento:
   AGENDADA · REAGENDADA · EN RESERVA n · REEMPLAZADA) y `STATUS DE APLICACIÓN`
   (campo: APLICADA · NO APLICADA) son **dimensiones independientes**. El modelo
   de la app tiene un solo `operational_status` que los mezcla.
2. **Falta el ciclo de contacto.** `MEDIO DE CONTACTO`, `FECHA DE LLAMADA` y
   sobre todo **`NÚMERO DE INTENTOS`** no existen en el modelo. Sin ellos no se
   puede decir por qué un aula no está agendada todavía.
3. **El parte de campo está incompleto en la app.** Faltan **duplicados** y
   **efectivas** —que es el número que manda, no «encuestas aplicadas»— y el
   **aula real** donde se aplicó.
4. **La cadena de reemplazo es ancha, no larga.** El Excel pone hasta once
   eslabones en la misma fila; el modelo de la app la representa como filas
   separadas con `replacement_for`. Ambas son válidas, pero el importador tiene
   que traducir de una a otra.
5. **La prioridad se invierte.** Lo urgente no es capturar en la app: es
   **leer estos tres Excel**. La superficie de captura que se construyó hoy
   sigue siendo útil para correcciones puntuales, pero no es el camino principal.
