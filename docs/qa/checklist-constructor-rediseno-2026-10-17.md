# Checklist · Rediseño completo del Constructor (2026-10-17)

Tipo: Checklist vivo
Estado: En curso
Fecha: 2026-10-17
Autoridad: Pedido de Gonzalo («rediseñar por completo todo el constructor»); sólo él da por terminado un ítem

Pedido de Gonzalo: «En resumen creo que tenemos que rediseñar por completo todo el constructor, confío en ti para
hacerlo, hazme todas las preguntas que consideres necesarias». Depende del trabajo conjunto en curso
(`checklist-senales-motor-2026-10-17.md`: sello, riel y motor de reglas en piezas), que se reutiliza aquí.

| # | Indicación (textual o casi) | Dónde vive | Estado |
|---|---|---|---|
| C1 | «Outline maestro» es un nombre cliché: renombrar | `outline/SurveyOutline.tsx` | hecho, por verificar: 704955ff8 |
| C2 | El arrastre del esquema es anticuado, no muestra bien qué se arrastra ni dónde va a caer; las demás filas deben moverse para «darle espacio» de forma fluida y elegante | `outline/` (dnd) | hecho, por verificar: 704955ff8 |
| C3 | Quitar la vista «Formulario completo» del Constructor: ya la tienen las otras pestañas | `canvas/FocusedWorkspace.tsx` (modo overview) | hecho, por verificar: c519e39e4 |
| C4 | Contenedores sin geometría de bordes, contenido estético ni armonía: contenedores profesionales | todo el Constructor | hecho, por verificar: c519e39e4 |
| C5 | «Listas» tiene un ícono de base de datos: íconos con sentido | inspector del Constructor | hecho, por verificar: c519e39e4 |
| C6 | La vista de trabajo no debe editar listas ni sus códigos: elegir una lista existente, ir a «Listas de opciones» a cambiarla o crear una nueva; si es la primera lista, explicar con amabilidad cómo funcionan | vista de trabajo / pestaña Respuesta | hecho, por verificar: c519e39e4 |
| C7 | Las notas «Cuándo aparece», «Qué acepta» suenan a texto generado: fuera | inspector del Constructor | hecho, por verificar: c519e39e4 |
| C8 | «Así se imprime» puede quedar, pero sin ser 100 % fiel: que no corte las opciones («… y 1 más») sólo por la representación | vista de trabajo | hecho, por verificar: c519e39e4 |
| C9 | Contenido, Listas de respuestas, Lógica, Datos y Presentación necesitan un revamp profundo; p. ej. Presentación da opciones de apariencia y no las muestra | inspector del Constructor | hecho, por verificar: c519e39e4 |
| C10 | Lo serio se construye en las subpestañas especializadas; aquí cada visor indica qué es cada cosa, lo muestra con profesionalismo y lleva a su pestaña | inspector del Constructor | decidido: en el Constructor se edita lo básico (texto, ayuda, tipo, código, obligatoria y elegir la lista); condiciones, restricciones, cálculos, filtros, apariencia y edición de listas se muestran con su lectura y llevan a su pestaña |
| C11 | Cabecera de la pregunta: tipo, número y «Obligatoria» como chips sueltos (captura) | vista de trabajo | hecho, por verificar: c519e39e4 |
| C13 | «Hay que distinguir apariencia en plataforma de apariencia en impresión; impresión ya tiene su propia subpestaña, en plataforma no» | ficha de la pregunta | hecho, por verificar: c519e39e4 |
| C14 | «Las secciones también están sometidas a lógica y otras cosas» | Estructura y ficha de sección | hecho, por verificar: c519e39e4 |
| C15 | Reglas interactivas: si la pregunta aún no tiene lógica, que lleve y explique | ficha de la pregunta | hecho, por verificar: c519e39e4 |
| C16 | «En el formato de impresión normalmente la obligatoriedad no se menciona porque se asume que todas lo son, pero evaluar ello, quizás indicar lo opuesto, cuando es opcional» | motor del impreso `api/R/reporte_formulario_pdf.R` / `_word.R` + opción en Impreso | pendiente (aparte del Constructor). Medido: el impreso hoy no marca obligatoriedad en ningún caso. La Vista del cuestionario ya usa «Todas son obligatorias salvo las marcadas opcional»: la propuesta es la misma convención en el impreso, una marca «(opcional)» junto a la pregunta, con un interruptor en Impreso > Contenido |
| C18 | Agregar en el lugar: «+» entre filas de la Estructura que abre el menú de tipos con sellos | Estructura | hecho, por verificar: 704955ff8 |
| C19 | Cambiar el tipo desde la cabecera de la ficha, avisando si la lista queda sin uso | ficha de la pregunta | hecho, por verificar: c519e39e4 |
| C20 | Duplicar, eliminar y mover a otra sección desde la ficha; teclado (flechas, atajos, deshacer) | ficha y Estructura | hecho, por verificar: 704955ff8 + c519e39e4 |
| C21 | Buscar y filtrar en la Estructura (texto o código; con condición, obligatorias, sin lista); plegar todo | Estructura | hecho, por verificar: 704955ff8 |
| C22 | Avisos de la pregunta en la ficha y marcados en su fila (sin lista, código repetido, fila rota) | ficha y Estructura | hecho, por verificar: 704955ff8 + c519e39e4 |
| C23 | Renombrar el código avisando cuántas referencias se actualizan | ficha de la pregunta | hecho, por verificar: c519e39e4 |
| C24 | Fichas propias para notas (sin respuesta) y cálculos (fórmula leída y dónde se usa) | ficha | hecho, por verificar: c519e39e4 |
| C12 | Editor de condición con selector de pregunta que muestra una nota como opción y un campo «valo» cortado (captura) | Lógica del Constructor | hecho, por verificar: c519e39e4 (retirado: lleva al Mapa) |

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
| C26 | Pasada de estrés por las subpestañas con el ACNUR en español: Restricciones, Filtros, Cálculos (pulldata, indexed-repeat, once, position), Lógica, Constructor, Cuestionario, Probar; medir qué sigue técnico y llevarlo a una UI profesional | todas las pestañas | hecho, por verificar: ui-quick-check final con ACNUR, 6 pestañas × 1440/1024, ok=true, 12 capturas distintas, geometryIssues=0 |
| C27 | Filtro «por opción» del hostigamiento: cada opción la habilita una pregunta distinta (Tipo 2: `filter_P14=${P14} or … or name = '0'`, ~40 columnas `filter_P*` en choices). Editor de filtros con una tabla opción → pregunta que la habilita, que arma las columnas y la expresión solo | `choiceFilters/` | hecho, por verificar: f1eecc9be |

## Hallazgos del estrés con ACNUR en español (2026-10-17)

Revisión independiente sobre `acnur_es.pulso` (form_id `ce69ae0a-…`), 9 pestañas × 1440/1024, 18 capturas distintas +
50 detalles. Matriz PASS 3 · FAIL 15. Evidencia: `scratchpad/form/estres1-out/`. Clase: (a) rediseño del Constructor,
(b) subpestaña, (c) motor de lectura.

| # | Hallazgo | Clase | Oleada | Estado |
|---|---|---|---|---|
| S1 | «Lo usan» ignora referencias dentro de etiquetas: `countryname` «Ninguna pregunta lo lee» y lo usan IDP01, REF10b, REF16; igual `name_ppl` | c | 1 · motor | hecho, por verificar: `logic/usos.ts` mira expresiones, etiquetas, ayudas, mensajes y etiquetas de opciones; `countryname` lo usan REF10b, REF16, IDP01 «en su etiqueta» |
| S2 | Filtro fijo `REF02CO= 'kk'` (REF02/04/05/07/08/14) se presenta como «dependen de respuestas que la persona dio antes», con «0 respuestas previas»: es un subconjunto fijo marcado en una columna | c | 1 · motor | hecho, por verificar: clases de filtro (cascada, fijo, por opción, mixto, rota, opaca); REF02 «Muestra siempre las mismas 230 opciones: las marcadas con kk en la columna REF02CO de la lista Country» |
| S3 | Opciones de una lista dinámica del roster (`${HH01_2_aux}`) se presenta como «Sin opciones… Agrega la primera» | c/b | 1 · motor | hecho, por verificar: «Las opciones son las respuestas a «Nombre del miembro del hogar», una por cada fila registrada en la repetición…», sin «Agregar opción»; título «Filas de «…»» (cableado del lead) |
| S4 | «Probar valores» de Restricciones: IDP01 y REG02 dicen «sólo se evalúan en el teléfono» (falso: comillas tipográficas y fila rota); Spent_5th da «Pide corregir» en todas las opciones con las demás vacías | c | 1 · motor | hecho, por verificar: IDP01 nombra las comillas tipográficas; REG02 dice fila rota; Spent_5th pasa de 6× «Pide corregir» a 6× «Se acepta» (la causa era `${Spent_5th}` no tratado como el valor probado) |
| S5 | La fila rota se lee distinto en cada vista (Constructor la marca, Restricciones «Validación técnica importada» con check verde de mensaje, Filtros inventa dependencia); ninguna dice que está rota | c | 1 · motor | hecho, por verificar: una sola fuente `reglas/motor/filaRota.ts` para lectura, diagnóstico, Restricciones, Probar y Filtros |
| S6 | Lógica: panel de detalle en semi-código monoespaciado, cortes a mitad de palabra; «Depende de / Condiciona a» en columnas de una sílaba | c/b | 1 · motor (lectura) + 2 · subpestañas (geometría) | hecho, por verificar: f1eecc9be |
| S7 | Lecturas sólo con códigos: indexed-repeat «HH01 en la fila selected_below5 del grupo S1», grupo con etiqueta citado por código, join/sum con códigos; choice-name con la etiqueta duplicada; mayúsculas del instrumento metidas en la frase; aviso de comillas tipográficas dentro de la frase en vez de alerta; Lógica/Constructor dicen «Regla técnica importada» del filtro que Filtros sí lee | c | 1 · motor | hecho, por verificar: indexed-repeat, join, sum y grupos con etiquetas; choice-name sin etiqueta duplicada; mayúsculas normalizadas respetando siglas; aviso de comillas aparte; Lógica y Constructor leen el filtro igual que Filtros. Alcance del riel enriquecido (cableado del lead) |
| S8 | Las preguntas dentro de una repetición no dicen que se repiten (HH06–08, EDU05); heredada duplicada en REG02 | a/c | 1 · motor (dato) + 2 · ficha | hecho, por verificar: c519e39e4 |
| S9 | Panel del riel fuera de pantalla a 1024 (EDU05: termina en y=988 con viewport 600): voltear o limitar alto con scroll propio | a | 1 · estructura | hecho, por verificar: 704955ff8 |
| S10 | Constructor a 1024: la Estructura muestra ~4 filas; cabecera «SI» se lee «sí» | a | 1 · estructura | hecho, por verificar: 704955ff8 |
| S11 | Lógica: `?foco=` desde otra pestaña no abre el detalle ni desplaza la lista (22.109 px) ni centra el mapa | b | 2 · subpestañas | hecho, por verificar: f1eecc9be |
| S12 | Restricciones: cada regla repite su código hasta 4 veces y ocupa 2–5 pantallas; insignias contradictorias («Regla avanzada» / «Regla técnica»); atajo «Fecha hasta hoy» ofrecido para `. = today()`; 1,2–2,4 s por elemento; código cortado a 4 caracteres; markdown crudo | b | 2 · subpestañas | hecho, por verificar: 2f6a490e9 + b252713df |
| S13 | Cálculos: tarjeta «Fórmula» vacía en todos; títulos repiten el código; `once(now())` en ISO/UTC crudo; contador «114» excluye cálculos de preguntas no calculadas; catálogo de funciones sin position/not/join/selected-at/choice-name/now/random | b | 2 · subpestañas | hecho, por verificar: f1eecc9be |
| S14 | Resumen: eje del recorrido ilegible (rótulos montados) y sin contrato; contadores que no cuadran (7 vs 22 sin resolver, 69 vs 70 secciones, 256 vs 259 listas); duración ≈301 min implausible | b | 2 · subpestañas | hecho, por verificar: 2f6a490e9 |
| S15 | Filtros: fila `Registered_person_reason` desborda; detalle no sticky; botones de alturas distintas; REF16 sin «Editar filtro» | b | 2 · subpestañas | hecho, por verificar: f1eecc9be |
| S16 | Cuestionario: start/end como preguntas 1 y 2, `${HH01}` crudo, secciones con código por título | b | 2 · subpestañas | hecho, por verificar: 2f6a490e9 |
| S17 | Ficha de un cálculo con marco de pregunta («La pregunta que verá el encuestado») | a | 2 · ficha (C24) | hecho, por verificar: c519e39e4 |
| S18 | Nombre doble del formulario (biblioteca vs `form_title`); foco desconocido cae en silencio al primero; tour «Paso 1 de 3» en cada sesión | b | 2 · subpestañas | hecho, por verificar: 2f6a490e9 |

Oleadas: 1 = motor que no afirma cosas falsas (S1–S8 lectura) + Estructura del Constructor (C1, C2, C14, C18, C20 teclado,
C21, C22 marca, S9, S10). 2 = Ficha del Constructor (C3, C5–C11, C13, C15, C19, C20 acciones, C22 avisos, C23, C24, S8,
S17, I7) + subpestañas (S6 geometría, S11–S16, S18, C27 filtro por opción).

- Cobertura de lectura tras S1–S8 en los seis formularios tipo: relevant 1117/1117, calculation 207/207, constraint 318/318, choice_filter 22/22, required 1/1 (la fila rota se lee como rota).
- Pendientes que deja el motor: ampliar el contrato `piezas.ts` con `avisos?` y `rota?` (hoy van como piezas de texto); `ChoiceFilterCard.tsx` y `ProbarCalculo.tsx` («Se calcula en el teléfono» para choice-name, join y sum); sitios que leen sin la fila: FocusedWorkspace, ObligatoriaControl, ResumenPregunta, TabRespuesta, ValidacionPaneles, BarraFormula y el chip compacto del Mapa. Van a la oleada 2.

## Generalidad y armado de patrones (Gonzalo, 2026-10-17)

«¿No te parece que estás generando redacción muy específica para un tipo de formulario cuando esta app va a recibir
XLSForms de todo tipo?» y «Todos estos regex conocidos y útiles nos van a servir sobremanera para tener una forma
didáctica en la UI de poder armarlos».

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| G1 | Auditoría de generalidad del motor: corpus variado (proyectos de referencia, formularios tipo, importados de SurveyMonkey, plantillas públicas de Kobo/ODK con pulldata, jr:choice-name, coalesce, once, position, cascadas de 3 niveles). Medir por columna: traducidas, «no la traduce» honesto con su código, y lecturas falsas (meta 0). Pruebas que no dependan del ACNUR | `reglas/motor/`, corpus fuera del repo | hecho, por verificar: ad92bdd15 (22 formularios reales/tipo 100 %, sintéticos sin lecturas falsas ni OOM) |
| G2 | Armar patrones de forma didáctica en Restricciones: galería de formatos comunes y genéricos (DNI 8 dígitos, celular de 9 que empieza en 9, RUC 11, año, hora HH:MM, correo, solo letras con tildes, código «2 letras + 4 dígitos») más un armador por bloques (dígitos × N, letras, separador, «uno de estos»), con la frase del motor en vivo y prueba con ejemplos que pasan y que no | `pestanas/` (Restricciones), lectura con `reglas/motor/regex.ts` | hecho, por verificar: 62198d3d5 + b252713df (propuesta https://claude.ai/artifact/6NLpyHgASg7AkAyH6KVUVo) |
