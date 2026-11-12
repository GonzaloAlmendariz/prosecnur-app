# Validación usada por un practicante: lo que falta (2026-11-12)

> **Para quien retome esto (otra sesión, otra cuenta):** empieza aquí. Este documento es la lista viva; marca el
> estado de cada ítem al cerrarlo, con el commit y cómo se comprobó. Gonzalo es quien da un ítem por terminado.

Prueba: un agente hizo de practicante con la base digitada de un estudio real (1000 encuestas, sin XLSForm ni
`.pulso`), usando solo la interfaz de Procesamiento para cargar, escribir reglas, auditar y decidir. Referencia:
552 observaciones encontradas a mano. Resultado: la app encontró 245 (44 %), 180 sin trucos.

## Dónde está la evidencia

En este mismo checkout, carpeta **`tmp/validacion-practicante/`** (no versionada: tiene datos de cliente; no se
commitea ni se sube a ningún servicio):

- `QA_PRACTICANTE_VALIDACION.md`: el recorrido paso a paso, la tabla chequeo por chequeo (si se pudo expresar,
  con qué tipo de regla, casos de la app frente a la referencia y la causa) y los defectos con su archivo.
- `INVENTARIO_CHEQUEOS.md`: los chequeos hechos a mano, con su regla exacta y su conteo.
- `cap/`: capturas 01 a 40 del recorrido.
- `scripts/`: lo usado para crear reglas por la API y comparar contra la referencia.

Los datos NO están ahí. La base digitada (con y sin etiquetas), el Excel de 552 observaciones de referencia y el
Word de reglas del practicante viven en la carpeta Digitación del estudio, en el Drive del equipo: pídele la ruta
a Gonzalo. El XLSForm que se armó a mano para poder cargarla no se conservó; `INVENTARIO_CHEQUEOS.md` explica
cómo se arma desde la hoja "Codigo" de la base (emparejar las listas por orden, porque la numeración tiene huecos).

## Cómo repetir la prueba

1. Levanta una pila propia (nunca el puerto 8787, que es de Gonzalo): backend con `load_all` del árbol y Vite,
   como en el skill `/ver-ui`. Una sola corrida pesada a la vez.
2. Crea un proyecto y carga la base con su XLSForm. **El practicante ya armó ese XLSForm con la propia
   plataforma (editor de Formularios)**; no está al 100 %. También dejó su proyecto de prueba. Las rutas de los
   dos están en `tmp/validacion-practicante/RUTAS.md`; trabaja sobre copias. Úsalo en lugar de armar uno: así
   la prueba sigue el camino real del practicante, y lo que le falte a ese formulario es en sí un hallazgo.
   Solo si no está disponible, ármalo desde la hoja "Codigo" (ver `INVENTARIO_CHEQUEOS.md`).
3. En Validación escribe las reglas del inventario, audita y recorre Hallazgos y Cierre, abriendo cada
   desplegable, panel y diálogo a 1366x768 y 1024x600.
4. Compara lo que marca la app contra el Excel de observaciones de referencia. La meta es cubrir las 552, o decir con causa
   por qué alguna no se puede.

Truco que hoy usa el practicante y la interfaz no enseña: la regla "Dos respuestas que deben cuadrar" también
marca las respuestas vacías; con ella salen exactos los supervisores vacíos (411) y la regla 1.3 del Word (313).

Orden sugerido: primero los arreglos acotados (1, 2, 5, 6, 7, 8, 10, 17), después el motor nuevo (4, 11, 12).

Pedido de Gonzalo: "que la persona pueda entrar, establecer las reglas, correr el plan de reglas, que le salga y se
pueda entender de forma didáctica y visual qué inconsistencias se encuentran, qué hacer con cada una de ellas, cómo
analizarlas".

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | El error de carga se dibuja detrás del velo del diálogo: el usuario no ve nada | `frontend/src/features/carga/pestanas/AvisosDeCarga.tsx` | Pendiente |
| 2 | Subir un archivo sin hoja `survey` como formulario responde 500 `E_INTERNAL` en lugar de un 400 con causa | `api/R/codificacion_flujo_hibrido.R` (`leer_instrumento_xlsform`) | Pendiente |
| 3 | Un intento de carga fallido deja registrada como datos la hoja equivocada | Carga (motor) | Pendiente |
| 4 | Emparejar las columnas de la base por `label` además de por `name` (los encabezados de la base digitada son el texto de la pregunta). Cargar sin XLSForm baja de prioridad: el practicante ya armó el formulario con el editor de la plataforma; falta probar la carga con ese formulario | Carga (motor + UI) | Pendiente; primero repetir la carga con el XLSForm del practicante |
| 5 | Cada caso se identifica como `principal::idx::N`: falta el número de encuesta y columnas de control (entrevistador, digitador) en la tabla de casos | `api/R/limpieza_decision_engine.R` (~449) + Hallazgos | Pendiente |
| 6 | La cabecera dice "sin evaluar 0" con reglas nuevas nunca auditadas | `frontend/src/features/validacion/pestanas/cabeceraDeValidacion.ts` | Pendiente |
| 7 | El "Detalle" escrito en la regla no aparece en Hallazgos | `frontend/src/features/validacion/hallazgos/PestanaHallazgosMesa.tsx` | Pendiente |
| 8 | Operador "está vacía" en Condiciones (hoy solo se logra con un truco de "Dos respuestas que deben cuadrar") | Reglas (panel + motor) | Pendiente |
| 9 | Selector de pregunta con búsqueda (228 preguntas) y texto del ítem visible en baterías | `features/validacion/reglas/campos/CampoPregunta.tsx` | Pendiente |
| 10 | Mostrar los tipos "Respuesta obligatoria" y "Respuesta fuera de lista", que el motor ya tiene | Reglas (catálogo) | Pendiente |
| 11 | Tipo de regla "patrón en una batería" (misma respuesta en todos los ítems, conteo de un código, todas vacías): 156 casos | Motor de reglas + panel | Pendiente |
| 12 | Formato de fechas y horas declarable (dd.mm.aaaa), comparar fechas y medir duración; "Fecha fuera del operativo" debe decir por qué falla: 138 casos | Motor de reglas | Pendiente |
| 13 | Patrón o cantidad de dígitos (teléfono, texto en campo numérico): 12 casos | Motor de reglas | Pendiente |
| 14 | Códigos con cero inicial leídos como número ("080105" → 80105): 98 falsos positivos | Carga (tipos) | Pendiente |
| 15 | Hallazgos abre en Distribución; el prototipo abre en Casos, con id legible y contexto | Hallazgos | Pendiente |
| 16 | A 1024x600 la Decisión queda bajo la cola con scroll anidado | `hallazgos.css` | Pendiente |
| 17 | La banda dice "base limpia" con la base sin cerrar | `features/procesamiento/banda/casosQueCuentanModel.ts` | Pendiente |
| 18 | Tratamiento "revisar con la ficha física" y lista exportable de casos para digitación | Hallazgos + Cierre | Pendiente |
| 19 | Reglas "valor distinto de la moda dentro de un grupo" y catálogo de ubigeos | Motor de reglas | Pendiente |
