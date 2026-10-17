# Checklist · Rediseño completo del Constructor (2026-10-17)

Pedido de Gonzalo: «En resumen creo que tenemos que rediseñar por completo todo el constructor, confío en ti para
hacerlo, hazme todas las preguntas que consideres necesarias». Depende del trabajo conjunto en curso
(`checklist-senales-motor-2026-10-17.md`: sello, riel y motor de reglas en piezas), que se reutiliza aquí.

| # | Indicación (textual o casi) | Dónde vive | Estado |
|---|---|---|---|
| C1 | «Outline maestro» es un nombre cliché: renombrar | `outline/SurveyOutline.tsx` | decidido: «Estructura» (respuesta de Gonzalo) |
| C2 | El arrastre del esquema es anticuado, no muestra bien qué se arrastra ni dónde va a caer; las demás filas deben moverse para «darle espacio» de forma fluida y elegante | `outline/` (dnd) | pendiente |
| C3 | Quitar la vista «Formulario completo» del Constructor: ya la tienen las otras pestañas | `canvas/FocusedWorkspace.tsx` (modo overview) | pendiente |
| C4 | Contenedores sin geometría de bordes, contenido estético ni armonía: contenedores profesionales | todo el Constructor | pendiente |
| C5 | «Listas» tiene un ícono de base de datos: íconos con sentido | inspector del Constructor | pendiente |
| C6 | La vista de trabajo no debe editar listas ni sus códigos: elegir una lista existente, ir a «Listas de opciones» a cambiarla o crear una nueva; si es la primera lista, explicar con amabilidad cómo funcionan | vista de trabajo / pestaña Respuesta | pendiente |
| C7 | Las notas «Cuándo aparece», «Qué acepta» suenan a texto generado: fuera | inspector del Constructor | pendiente |
| C8 | «Así se imprime» puede quedar, pero sin ser 100 % fiel: que no corte las opciones («… y 1 más») sólo por la representación | vista de trabajo | pendiente |
| C9 | Contenido, Listas de respuestas, Lógica, Datos y Presentación necesitan un revamp profundo; p. ej. Presentación da opciones de apariencia y no las muestra | inspector del Constructor | pendiente |
| C10 | Lo serio se construye en las subpestañas especializadas; aquí cada visor indica qué es cada cosa, lo muestra con profesionalismo y lleva a su pestaña | inspector del Constructor | decidido: en el Constructor se edita lo básico (texto, ayuda, tipo, código, obligatoria y elegir la lista); condiciones, restricciones, cálculos, filtros, apariencia y edición de listas se muestran con su lectura y llevan a su pestaña |
| C11 | Cabecera de la pregunta: tipo, número y «Obligatoria» como chips sueltos (captura) | vista de trabajo | pendiente |
| C13 | «Hay que distinguir apariencia en plataforma de apariencia en impresión; impresión ya tiene su propia subpestaña, en plataforma no» | ficha de la pregunta | decidido: la apariencia en la plataforma se elige en el Constructor con cada opción dibujada; la impresa se ve y lleva a Impreso |
| C14 | «Las secciones también están sometidas a lógica y otras cosas» | Estructura y ficha de sección | en propuesta: la sección se elige en la Estructura y tiene su ficha (título, condición que vale para todas sus preguntas, se repite, apariencia una por pantalla o toda junta); sus preguntas muestran la condición heredada |
| C15 | Reglas interactivas: si la pregunta aún no tiene lógica, que lleve y explique | ficha de la pregunta | en propuesta: cada regla se despliega; ausente muestra «Agregar», qué hace en una línea y «Crear en <pestaña>» con la pregunta elegida |
| C16 | «En el formato de impresión normalmente la obligatoriedad no se menciona porque se asume que todas lo son, pero evaluar ello, quizás indicar lo opuesto, cuando es opcional» | motor del impreso `api/R/reporte_formulario_pdf.R` / `_word.R` + opción en Impreso | pendiente (aparte del Constructor). Medido: el impreso hoy no marca obligatoriedad en ningún caso. La Vista del cuestionario ya usa «Todas son obligatorias salvo las marcadas opcional»: la propuesta es la misma convención en el impreso, una marca «(opcional)» junto a la pregunta, con un interruptor en Impreso > Contenido |
| C12 | Editor de condición con selector de pregunta que muestra una nota como opción y un campo «valo» cortado (captura) | Lógica del Constructor | pendiente |

## Decisiones de Gonzalo

- Edición: «Lo básico aquí».
- Diseño: «Se queda la versión de dos columnas» (después de comparar dos y tres en la propuesta, versión 4: https://claude.ai/artifact/EyjSwf3hNwhSY2buDvTdmx).
- Nombre: «Estructura».
- Apariencia: la de plataforma se edita en el Constructor (no tiene pestaña); la impresa vive en Impreso.
- Proceso: «Propuesta primero»: página HTML navegable con preguntas reales; se aprueba y luego se implementa.
