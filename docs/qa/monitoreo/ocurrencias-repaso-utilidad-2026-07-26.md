# Ocurrencias de campo — repaso de utilidad de las cinco pestañas

**Fecha:** 26 de julio de 2026
**Referente:** `acnur_acg` (ACNUR ACG) — 1.693 registros, 158 reportes de ocurrencia,
10.649 intentos, 138/150 UMP con registro, 7 distritos
**Encargo:** conservar las cinco pestañas y repasar a fondo para qué sirve cada una

---

## 0. Cómo se hizo este repaso

Se combinaron tres fuentes: la vista real de `states` y `alerts` con ACNUR ACG cargado,
la lectura completa de `TerritorialFieldOccurrencesWorkbench.tsx` (1.995 líneas), y la
medición en vivo del recorte de contenido en cada pestaña.

**Las cinco pestañas se vieron renderizadas con ACNUR ACG.** Una primera versión de este
documento juzgó `registro`, `ump` y `rhythm` solo por código; la pasada visual posterior
confirmó lo esencial pero **corrigió el veredicto de `rhythm`** y sacó a la luz dos
defectos de conteo que el código no delataba. Quedan marcados como «hallazgo de la pasada
visual».

---

## 1. El problema que comparten las cinco

Antes de mirar una por una: hay tres defectos que no son de ninguna pestaña sino del
contenedor, y que explican buena parte de la sensación de "mal planteado".

**La configuración cobra peaje cinco veces.** El bloque de formulario activo —código del
asset, 4 KPIs, 7 botones (Cambiar formulario, XLSForm, Subir Kobo, Campos, Excel UMP,
Actualizar, GO) y 3 chips de estado— se renderiza **antes** del `switch` de pestañas, así
que aparece idéntico en las cinco. Son ~180px de altura fija. En Alertas, con ACNUR ACG,
la primera alerta aparece pasado el 40% de la pantalla.

**Los KPIs de esa banda mezclan cinco granos distintos en una fila**: identidad del
formulario, volumen (158 reportes), cobertura (138/150 UMP), calidad (12 válidas sin
ocurrencias) y resultado (9.336 no efectivas, 88%). Tres de esos cinco son datos
operativos que no tienen nada que hacer en un bloque de configuración.

**La sección no tenía dueño de scroll.** Cuatro niveles de `overflow: hidden` encadenados
(`mon-workbench-content` → `mon-stage--ocurrencias` → `pulso-panel` → `mon-field-occurrences`)
sin que ninguno pudiera desplazarse. Medido: 394px inalcanzables en Alertas, 39px en
Resumen, una fila de grid colapsada a 0px. *Ya reparado* en esta sesión, pero el
planteamiento de "lienzo lleno con `height: 100%` en cascada" es lo que lo produjo y
sigue vigente en el resto del layout.

---

## 2. Pestaña por pestaña

### 2.1 `states` — «Resumen»

**Qué responde:** ¿cómo se está comportando el campo en agregado?

**Qué aporta que no esté en otro lado:**
- `OccurrenceStateComposition`: intentos, efectivas, no efectivas, tasa de no efectividad, días.
- `OccurrenceOutcomeBars`: los motivos de no efectividad rankeados (con ACNUR ACG:
  ausentes 4.487 · no quería participar 2.524 · fuera de cuota 1.202 · no cumple criterios 532
  · vivienda inaccesible 522 · migrante/refugiado 63 · encuesta inconclusa 6).
- `OccurrenceDistrictMatrix`: la lectura por distrito con estados consolidados.

**Qué duplica:** los motivos de no efectividad se repiten **literalmente** en el lateral
de `alerts` ("Tipos de ocurrencia", mismos siete valores).

**Qué falla:** la jerarquía está invertida. El número más grande de la pantalla es
"10.649 intentos reportados"; el dato que decide la operación es el 88% de no efectividad
y sus motivos, y va en letra chica. Un intento no es un logro: es el denominador.

**Veredicto: conservar, reenfocar.** Es la pestaña con más razón de ser. Debe liderar con
la tasa de no efectividad y sus motivos, no con el volumen de intentos.

---

### 2.2 `registro` — «Reporte UMP»

**Qué responde:** ¿qué UMP entregaron su reporte de ocurrencias y cuáles no?

**Qué aporta:** el eje de **cumplimiento documental**. Clasifica cada UMP en
`con_registro` / `sin_registro` / `sin_conciliacion`, y cuenta esperadas, reportadas,
faltantes, no conciliadas y reemplazos aplicados.

**Qué duplica:** consume exactamente las mismas `routeUmpRows` que `ump`, y repite tres de
sus filtros (búsqueda, estado, distrito). Su bloque de cobertura reaparece en el lateral
de `alerts` ("Sin reporte UMP", "Completas sin ocurrencias", "Incompletas sin ocurrencias").

**Hallazgo de la pasada visual — el denominador no cuadra.** El encabezado dice
literalmente **«151 visibles de 150 UMP oficiales»**: hay más filas en pantalla que
universo declarado. La causa está en el código: `counts.expected` excluye las filas
`is_unreconciled`, pero la lista sí las muestra. No es un error de cálculo, es un rótulo
que compara dos universos distintos como si fueran el mismo — la misma familia de defecto
que el contrato de corte vino a resolver en Avance.

**Veredicto: conservar, pero es la mitad de una pestaña.** El eje —cumplimiento de entrega—
es legítimo y distinto del de `ump`. El problema no es que exista, es que comparte tabla,
filtros y filas con su vecina sin que nada lo diga.

---

### 2.3 `ump` — «UMP»

**Qué responde:** ¿qué pasó dentro de cada UMP y cuál necesita atención?

**Qué aporta:** el eje de **contenido operativo**. Añade sobre `registro` dos filtros
propios (responsable y motivo dominante), el inspector de detalle por UMP y el export.

**Qué falla:**
- El inspector usa `detailSide: "left" | "right"` — es el que cambia de lado según la
  fila, el hallazgo de la auditoría. Confirmado en código.
- 25px de contenido inalcanzable medidos en `mon-field-occurrences-ump-index`.

**Hallazgo de la pasada visual — dos problemas de densidad:**
- **Diez KPIs en una sola fila**: UMP titulares, con registro, efectivas, no efectivas,
  completas sin ocurrencias, incompletas sin ocurrencias, válidas sin ocurrencias,
  reemplazo usado como titular, sin conciliación, sin reporte. Ninguno destaca porque
  todos pesan igual.
- **La duplicación con `registro` es literal, no conceptual**: el subtítulo de esta
  pestaña dice «138 con registro · 12 sin registro», que es exactamente el titular de
  Reporte UMP. El usuario ve el mismo par de números como encabezado de dos pestañas
  distintas y no tiene forma de saber en qué se diferencian.

**Veredicto: conservar, es la más rica.** Debería ser la pestaña de trabajo real. El
inspector necesita posición fija y los diez KPIs necesitan jerarquía.

---

### 2.4 `alerts` — «Alertas»

**Qué responde:** ¿qué casos concretos tengo que revisar hoy?

**Qué aporta:** la lista revisable con cuatro tipos accionables —sin reporte,
observaciones, fuera de ruta, no efectividad alta— con acción por fila
("Completa sin reporte"). Con ACNUR ACG: **113 alertas, 80 visibles**. Es la única
pestaña con verbo: las demás describen, esta pide hacer algo.

**Qué duplica:** su lateral es la suma de las otras dos pestañas. "Tipos de ocurrencia"
es idéntico al bloque de motivos de `states`; "Cobertura" repite los conteos de `registro`.
Ese lateral es el que empuja los 394px de contenido fuera de alcance.

**Veredicto: conservar, es la más valiosa. Vaciarla de duplicados.** Quitando el lateral,
la lista respira y la pestaña recupera su identidad: el sitio donde se trabaja, no donde
se vuelve a leer lo mismo.

---

### 2.5 `rhythm` — «Ritmo»

**Qué responde:** ¿cómo evolucionó la captura de ocurrencias y qué pasó con la fuente?

**Qué aporta:**
- Barras diarias de intentos (`OccurrenceDailyBars`).
- KPIs: intentos, días con reporte, pico diario, último día.
- **Historial operativo**: los eventos de sincronización de la fuente Kobo, con fecha,
  conteo de registros, asset y mensaje. Esto no existe en ninguna otra parte de Monitoreo.

**Qué duplica:** las barras diarias se solapan conceptualmente con Avance / Ritmo diario,
aunque cuentan cosas distintas —aquí intentos de ocurrencia, allá válidas de avance—. La
confusión es de nombre, no de dato.

**Qué falla:**
- Dos de sus seis KPIs son configuración pura ("Sincronizada / formulario", "6/07/26,
  12:50 p.m. / última sincronización") metidos en una pestaña operativa. Con la barra fina
  nueva, ahí ya no pintan nada.
- `history.slice(0, 18)` recorta el historial **sin avisar** — el mismo defecto de
  truncación silenciosa que ya se corrigió en las tablas de perfil.

**Hallazgo de la pasada visual — el reparto de espacio está invertido, y al revés de lo
que suponía el análisis por código.** El historial operativo **ya ocupa la columna ancha**
(con solo 6 eventos, cada uno con dos líneas de texto y mucho aire), mientras que
**«Ritmo diario · 16 días» está arrinconado en una columna de ~90px** donde las barras se
apilan ilegibles: "13 junio 367 intentos", "14 junio 168 intentos"… una debajo de otra,
sin poder compararse. La pestaña se llama *Ritmo* y el ritmo es lo único que no se puede
leer en ella.

**Veredicto: conservar, es la memoria de la fuente — pero invertir el reparto.** Las
barras diarias necesitan el ancho (son una serie temporal, se leen comparando), y el
historial —6 eventos— cabe perfectamente en la columna angosta. La recomendación previa de
«subir el historial» era incorrecta: ya está arriba y ocupando de más.

---

## 3. Resumen del repaso

| Pestaña | Eje propio | ¿Se sostiene? | Qué le sobra | Qué le falta |
|---|---|---|---|---|
| Resumen | Lectura agregada del campo | Sí | — | Liderar con no efectividad, no con intentos |
| Reporte UMP | Cumplimiento de entrega | Sí, aunque comparte tabla con UMP | Filtros repetidos | Cuadrar «151 de 150»; decir que comparte universo con UMP |
| UMP | Contenido operativo por UMP | Sí, la más rica | 10 KPIs sin jerarquía | Inspector fijo; dejar de repetir el titular de Reporte UMP |
| Alertas | Trabajo pendiente hoy | Sí, la más valiosa | **Todo el lateral** (duplica Resumen y Reporte UMP) | Espacio: hoy pierde 394px |
| Ritmo | Memoria de la fuente | Sí | Los 2 KPIs de configuración | **Invertir el reparto**: las barras al ancho, el historial al lateral; declarar el recorte de 18 |

**Ninguna de las cinco sobra.** Lo que sobra es lo que se repite entre ellas y la
configuración que las grava a todas. Quitando eso, cada una recupera un eje limpio:
*qué está pasando* (Resumen), *quién entregó* (Reporte UMP), *qué pasó en cada UMP* (UMP),
*qué hago ahora* (Alertas), *de dónde viene este corte* (Ritmo).

---

## 4. Qué implica para el revamp

Con las cinco pestañas conservadas y la barra fina + panel lateral ya aprobados:

1. **Barra fina de fuente** (~32px) con estado y acceso al panel `?panel=fuente`; los KPIs
   operativos que hoy viven ahí bajan a Resumen, que es su sitio.
2. **Alertas pierde el lateral**; los datos duplicados quedan solo en su pestaña propietaria,
   con enlace desde Alertas cuando haga falta contexto.
3. **Resumen invierte su jerarquía** para liderar con no efectividad y motivos.
4. **Ritmo invierte su reparto** —barras al ancho, historial al lateral— y declara el
   recorte de eventos.
5. **UMP fija la posición del inspector**, jerarquiza sus diez KPIs y deja de repetir el
   titular de Reporte UMP; Reporte UMP cuadra su denominador y declara que comparte
   universo con ella.
6. **Estado a un store del feature**, saliendo de los ~20 `useState` sueltos, y cada pestaña
   a su archivo propio.

---

## 5. Defectos de conteo detectados de paso

Dos que no son de layout y conviene reparar con el revamp, porque son de la misma familia
que los que ya cerró el contrato de corte en Avance:

1. **«151 visibles de 150 UMP oficiales»** en Reporte UMP — el conteo del universo excluye
   las filas no conciliadas y la lista no.
2. **El titular duplicado** «138 con registro · 12 sin registro» encabezando dos pestañas
   distintas sin decir en qué se diferencian.
