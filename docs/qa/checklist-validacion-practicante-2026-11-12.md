# Validación usada por un practicante: lo que falta (2026-11-12)

Prueba: un agente hizo de practicante con la base digitada de un estudio real (1000 encuestas, sin XLSForm ni
`.pulso`), usando solo la interfaz de Procesamiento para cargar, escribir reglas, auditar y decidir. Referencia:
552 observaciones encontradas a mano. Resultado: la app encontró 245 (44 %), 180 sin trucos. El detalle y las
capturas están fuera del repo (datos de cliente).

Pedido de Gonzalo: "que la persona pueda entrar, establecer las reglas, correr el plan de reglas, que le salga y se
pueda entender de forma didáctica y visual qué inconsistencias se encuentran, qué hacer con cada una de ellas, cómo
analizarlas".

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | El error de carga se dibuja detrás del velo del diálogo: el usuario no ve nada | `frontend/src/features/carga/pestanas/AvisosDeCarga.tsx` | Pendiente |
| 2 | Subir un archivo sin hoja `survey` como formulario responde 500 `E_INTERNAL` en lugar de un 400 con causa | `api/R/codificacion_flujo_hibrido.R` (`leer_instrumento_xlsform`) | Pendiente |
| 3 | Un intento de carga fallido deja registrada como datos la hoja equivocada | Carga (motor) | Pendiente |
| 4 | Cargar una base sin XLSForm, o importar un libro de códigos posicional, y emparejar columnas por `label` además de por `name` | Carga (motor + UI) | Pendiente, el de más impacto |
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
