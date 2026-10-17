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
| C18 | Agregar en el lugar: «+» entre filas de la Estructura que abre el menú de tipos con sellos | Estructura | pendiente (Gonzalo: «Hagamos del 1 al 7») |
| C19 | Cambiar el tipo desde la cabecera de la ficha, avisando si la lista queda sin uso | ficha de la pregunta | pendiente |
| C20 | Duplicar, eliminar y mover a otra sección desde la ficha; teclado (flechas, atajos, deshacer) | ficha y Estructura | pendiente |
| C21 | Buscar y filtrar en la Estructura (texto o código; con condición, obligatorias, sin lista); plegar todo | Estructura | pendiente |
| C22 | Avisos de la pregunta en la ficha y marcados en su fila (sin lista, código repetido, fila rota) | ficha y Estructura | pendiente |
| C23 | Renombrar el código avisando cuántas referencias se actualizan | ficha de la pregunta | pendiente |
| C24 | Fichas propias para notas (sin respuesta) y cálculos (fórmula leída y dónde se usa) | ficha | pendiente |
| C12 | Editor de condición con selector de pregunta que muestra una nota como opción y un campo «valo» cortado (captura) | Lógica del Constructor | pendiente |

## Decisiones de Gonzalo

- Edición: «Lo básico aquí».
- Diseño: «Se queda la versión de dos columnas» (después de comparar dos y tres en la propuesta, versión 4: https://claude.ai/artifact/EyjSwf3hNwhSY2buDvTdmx).
- Nombre: «Estructura».
- Apariencia: la de plataforma se edita en el Constructor (no tiene pestaña); la impresa vive en Impreso.
- Proceso: «Propuesta primero»: página HTML navegable con preguntas reales; se aprueba y luego se implementa.

## Plan de implementación (congelado 2026-10-17)

Arranca cuando el frente I de `checklist-senales-motor-2026-10-17.md` (sello y riel) termine y pase su gate: toca la fila
del esquema y el kit que este rediseño reemplaza. Referencia visual aprobada: propuesta versión 4, dos columnas.

Hallazgos de la lectura del código:
- El arrastre ya usa `@dnd-kit` (core + sortable) con `onApplyMove(RowMovePlan)`: se conserva la librería y se
  rehace la experiencia (overlay elevado sin giro, hueco que se abre, filas que se corren, soltar en otra sección).
- No existe duplicar: es una acción nueva. Agregar (`addQuestion`), mover (`moveSelection`, `applyOutlineMove`),
  eliminar (`deleteCurrentSelection`), cambiar tipo (`updateQuestionType`) y renombrar con actualización de
  referencias (`updateSurveyField` con `name`) ya existen en `XlsformEditorPage.tsx`.
- Atajos actuales: Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Cmd/Ctrl+N.

Oleada 1, dos escritores con archivos disjuntos:

| Escritor | Ítems | Archivos |
|---|---|---|
| E · Estructura | C1, C2, C14 (elegir sección), C18, C21, C22 (marca en la fila), C20 (teclado en la lista) | `outline/` (árbol) |
| F · Ficha | C3, C5–C11, C13, C15, C19, C20 (acciones), C22 (avisos en la ficha), C23, C24 | `canvas/ficha/` (nuevo), `state/accionesConstructor.ts` (nuevo: duplicar, mover a sección, insertar en), `XlsformEditorPage.tsx` (cablea, dueño único) |

Contrato entre E y F (props nuevas de `SurveyOutline`, que F cablea en la página):
- `avisosPorFila?: ReadonlyMap<number, { nivel: "error" | "warn"; titulo: string }[]>`
- `onInsertar?: (destino: { despuesDeFila: number | null; seccionFila: number | null }, baseType: string) => void`
- Elegir una sección usa el `onSelect` existente con la fila de la sección.

Cierre: revisión visual y de contratos en paralelo → `verificador` → commits por nombre.

## Banco de prueba: ACNUR y el filtro de hostigamiento (Gonzalo, 2026-10-17)

«Un cuestionario de ACNUR, al tener tantos elementos bastante complejos como cálculos, pulldata y un montón de cosas, es
una buena oportunidad para ver qué tan bien se ven las subpestañas, trasladando todo ese contenido extremadamente
técnico a un contenido más profesional»; «que solo utilice el idioma español, porque está mezclando varios idiomas»;
«el formulario de hostigamiento 2026 tiene un buen ejemplo de cómo se hacen los filtros… se hizo utilizando un método
algo rústico… podríamos mejorarlo con el constructor que tenemos ahora».

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| C25 | ACNUR sólo en español como banco de prueba | copia de trabajo fuera del repo: `scratchpad/form/acnur_es.pulso` | hecho: el Tipo 3 junta dos instrumentos con columnas de idioma distintas (`label::Español (es)` y `label::Spanish (ES)`) más EN/FR/AR/RU/PT; cada etiqueta, ayuda y opción toma la primera columna en español y se quitan las demás. Sin español quedan 10 filas internas (cálculos auxiliares y títulos de grupo del módulo hogar), que se muestran por su código |
| C26 | Pasada de estrés por las subpestañas con el ACNUR en español: Restricciones, Filtros, Cálculos (pulldata, indexed-repeat, once, position), Lógica, Constructor, Cuestionario, Probar; medir qué sigue técnico y llevarlo a una UI profesional | todas las pestañas | pendiente: corre tras el gate del frente de identidad; sus hallazgos alimentan a los escritores del Constructor |
| C27 | Filtro «por opción» del hostigamiento: cada opción la habilita una pregunta distinta (Tipo 2: `filter_P14=${P14} or … or name = '0'`, ~40 columnas `filter_P*` en choices). Editor de filtros con una tabla opción → pregunta que la habilita, que arma las columnas y la expresión solo | `choiceFilters/` | pendiente. Medido: el instrumento final `Instrumentofinal_HSTVG2026_UNSA.xlsx` no trae filtros (la columna está vacía); el patrón vive en el Tipo 2 del corpus. El editor actual sólo arma la cascada simple (una pregunta madre) |
