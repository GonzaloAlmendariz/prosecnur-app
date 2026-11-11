# Plan: rediseño de Procesamiento (Carga, Validación, Codificación y Analítica)

Tipo: Plan y checklist de diseño
Estado: En curso
Fecha: 2026-11-10
Autoridad: pedido de Gonzalo del 2026-11-10. Las decisiones de la sección 9 son suyas; nada de este plan se implementa hasta que las resuelva. Solo Gonzalo da por terminado un ítem

Prototipo con el CSS real de la app: https://claude.ai/artifact/S82u2QNoLCagBVTWiYN5VY (privado). Cincuenta y dos pantallas, medidas en 1710×1107, 1440×1000, 1366×768, 1280×720 y 1024×600 sin desbordes, tablas cortadas ni huecos exteriores. No se tocó código de la app.

## 1. Checklist del pedido

| # | Indicación de Gonzalo | Dónde queda resuelta | Estado |
|---|---|---|---|
| 1 | Revisar la función actual de todo el módulo | Sección 2 (inventario de las cuatro secciones, 27 pestañas, 16 paneles y sus endpoints) | hecho, por revisar |
| 2 | Definir bien las pestañas de cada sección | Sección 5 (mapa hoy y propuesto, con la pregunta que responde cada pestaña) | mapa aprobado (2026-11-10) |
| 3 | Rediseño visual completo | Sección 4.7 y prototipo (52 pantallas, las 21 pestañas) | maquetas completas, por revisar |
| 4 | Ordenamiento conceptual más claro | Secciones 4 y 5 | propuesto |
| 5 | Propuesta profunda, no un acomodo | Secciones 3 a 6 (cambia qué vive dónde, no solo cómo se ve) | propuesto |
| 6 | Todas las secciones y pestañas menos Gráficos | Sección 5 | propuesto |
| 7 | Cubrir los escenarios reales: fuentes de formato distinto, actualizar una fuente, tipos de base, multibase | Sección 6 y prototipo "Carga, actualizar una fuente" | propuesto, espera D7 y D8 |
| 8 | En línea con los demás módulos, sin romper sus conceptos | Sección 7 | propuesto |
| 9 | Coherente consigo mismo | Sección 4 (columna común de las cuatro secciones) | propuesto |
| 10 | Calidad de contenedores: definición, márgenes y botones | Sección 8.2 (contrato de geometría, segunda versión) y las 52 pantallas del prototipo | cinco tandas aplicadas, por revisar |
| 11 | Dinámicas que se conservan y suben de nivel (arrastre de Codificación y otras) | Sección 8.1 y prototipo "Codificación, Codificar" | propuesto |
| 12 | Entregables de Analítica con orden, agrupación, síntesis y recorrido | Sección 5.4 y prototipo "Analítica, Entrega" | propuesto, espera D5 |
| 13 | Sin acordeones: bloques a la vista | Sección 8.2 y prototipo "Carga, Equivalencias" | propuesto |
| 15 | Codificación: las cuatro pestañas maquetadas, con mejores contenedores | Prototipos "Codificación, Preguntas", "Codificar" y "Aplicar"; Matrices se retiró (fila 30) | hecho, por revisar |
| 14 | El plan automático del formulario, los casos a revisar por combinaciones sospechosas y su paso al panel de decisión, claro y bien resuelto | Sección 5.2 y prototipos "Validación, Reglas" y "Validación, Hallazgos" | propuesto, espera D3 |
| 16 | Explorador de variables con sus gráficos, sus filtros y sus cruces | Sección 5.2 y prototipos "Validación, Explorar", "Explorar con cruce" y "Explorar una numérica" | hecho, por revisar |
| 17 | Cinco tandas más de mejora visual | Sección 8.2 ("Cinco tandas") | hecho, por revisar |
| 18 | Codificación: qué pasa cuando un texto se vuelve opción única o múltiple | Sección 5.3 ("Única o múltiple") | propuesto; D12 decidida en su primer punto |
| 19 | Tabla de Preguntas: una línea gris en el medio y una pantalla poco dinámica | Prototipo "Codificación, Preguntas", rehecha como pares enlazados. La línea era la primera celda de cada fila, que una regla de otra lista convertía en caja no tabular | hecho, por revisar |
| 20 | El lazo "Unir" se ve feo | Prototipo "Codificación, Preguntas": nodo redondo punteado con el ícono de enlace, del mismo tamaño que el lazo ya unido | hecho, por revisar |
| 21 | Única o múltiple no se puede saber antes de ver las respuestas | Sección 5.3: el tipo no se pregunta; se hereda de la pregunta cerrada o sale de lo codificado. Prototipo "Codificación, Codificar una abierta" | hecho en el prototipo, por revisar |
| 22 | D12: un "Otro" de opción única que necesita dos códigos pasa a múltiple, con aviso | Sección 5.3 y prototipos "Codificación, un Otro de opción única con dos códigos", "Preguntas" y "Aplicar" | hecho en el prototipo, por revisar; exige cambio de motor en F4 |
| 23 | Revisar el evaluador y el alta de reglas para que sus resultados sean casos a revisar | Sección 5.2 ("Regla propia") y prototipos "Validación, nueva regla: qué revisar", "Validación, nueva regla", "Validación, regla que compara preguntas" y "Validación, reglas sin evaluar" | hecho en el prototipo, por revisar; D13 decidida |
| 24 | El explorador de respuestas no se veía en el artefacto | La página lo mostraba al final de Validación y en miniatura. Ahora Explorar abre la sección, con la captura de hoy al lado y las tres pantallas a todo el ancho | hecho |
| 25 | D13: las reglas propias comparan una pregunta con otra y unen condiciones con "o" ("las dos cosas") | Sección 5.2 ("Regla propia") y prototipo "Validación, regla que compara preguntas" | hecho en el prototipo, por revisar; exige cambio de motor en F3 |
| 26 | Al panel de regla le faltaban muchas pasadas para verse bien | Panel rehecho: la frase de la regla arriba, condiciones y resultado como bloques, y los casos que marca a todo el alto | hecho, por revisar |
| 27 | La misma pasada a fondo para las demás pantallas de Validación | Sección 5.2 ("Pasada a fondo de Validación") y prototipos de Explorar, Reglas, Hallazgos y Cierre | hecho, por revisar |
| 28 | La misma pasada a fondo para Codificación | Sección 5.3 ("Pasada a fondo de Codificación") y prototipos de Preguntas, Codificar y Aplicar | hecho, por revisar |
| 29 | Nombres muy claros; "adaptado" no encaja con la nomenclatura estándar para una base codificada | Sección 5.3 ("Nombres") y los archivos de Aplicar | hecho en el prototipo; "Registro de codificación" confirmado por Gonzalo el 2026-11-10 |
| 30 | La codificación con matriz se hace dentro de la app, sin Excel y sin importar ningún archivo | Sección 5.3 ("Codificar en tabla") y prototipo "Codificación, Codificar en tabla". Se retira la pestaña Matrices | hecho en el prototipo, por revisar |
| 31 | Quitar la varita mágica de la última vista | Aplicar usa el ícono de base de datos en el riel y en la cabecera; "Sugerir códigos" queda sin ícono | hecho |
| 32 | No retirar porque sí la entrada de variables hechas fuera (en SAV o en un procesamiento independiente) | Sección 5.3 (D14). Las variables hechas fuera siguen entrando por Carga › Variables ("anexadas" y "calculadas"); en Codificación una pregunta puede declararse "Ya viene codificada" | hecho en el prototipo, por revisar |
| 33 | Validar las reglas nuevas contra un informe real de inconsistencias y casos a revisar | Sección 5.2 ("Contraste con un informe real") | hecho: cinco de seis clases de regla se pueden escribir; falta una |
| 34 | El mostrador de inconsistencias completo: cómo detecta y cómo muestra | Sección 5.2 ("Mostrador de hallazgos") y prototipos "hallazgo de un salto del formulario", "de un valor fuera de rango con su distribución", "de respuestas casi iguales", "caso completo" y "reglas que salen del formulario" | hecho en el prototipo, por revisar |
| 35 | Dibujar el panel de "Combinación fuera de catálogo" y el de regla con la base vacía | Prototipos "Validación, regla de combinación fuera de catálogo" y "Validación, regla nueva con la base vacía" | hecho, por revisar |
| 36 | Seguir mejorando: pasada a fondo de Carga y de Analítica | Sección 5.1 ("Pasada a fondo de Carga") y sección 5.4 ("Pasada a fondo de Analítica") | hecho en lo que tenía defectos a la vista; Equivalencias, Formulario, Respuestas, Frecuencias, Cruces y Entrega se revisaron y no se rehicieron |
| 37 | Estados de carga y error | Sección 8.3 y siete prototipos con el rótulo "Estado" | hecho, por revisar |
| 38 | D9: una base puede juntar fuentes de formato distinto en un estudio de varias bases ("integrar por base") | Sección 9 ("D9, fuentes de formato distinto") y prototipo "Carga, agregar una fuente de otro formato" | decidida; hecho en el prototipo, exige cambio de motor en F2 |

## 2. Qué se revisó y cómo

- **Código**: las cuatro secciones completas (pestañas, navegación interna no declarada, paneles, capacidades y endpoints), el kit compartido y su adopción, los conceptos de los otros seis módulos, el ciclo de vida de una fuente en el backend y las dinámicas de interacción. Seis lecturas independientes, todas con cita de archivo y línea.
- **Pantalla**: 26 capturas del proyecto de referencia `acnur_acg` (una base desde archivo) y 63 más sobre copias de trabajo de siete estudios reales, elegidos por lo que cubren. Las copias viven fuera del repo. Se leyeron en imagen unas 35; las demás quedaron como respaldo y falta leerlas al maquetar cada sección.

| Escenario | Qué muestra |
|---|---|
| Nueve hermanas independientes de SurveyMonkey | Asistente de familia, actualización por plataforma, aprobación por base |
| Cuatro bases separadas con serie 2021 a 2026 | Equivalencias, segmentos, comparativos |
| Tres bases desde formulario publicado con SAV | El lazo con Formularios |
| Una base de Kobo traída de Monitoreo con hija de grupo repetido | Bases derivadas, universo |
| Una base con codificación aplicada | El recorrido completo hasta Analítica |
| Una base con columnas anexadas, variables calculadas y ponderación | Lo que hoy vive tras "Variables" |
| Dos olas de un mismo estudio | Tablas entre bases y base panel |

No se pudo ver en pantalla: una base integrada (ningún estudio en disco la usa) ni una auditoría con hallazgos reales (los proyectos guardados reabren sin la evaluación).

## 3. Diagnóstico

Siete causas, de la más estructural a la más visible.

**3.1 Las pestañas siguen la historia del motor, no la pregunta del analista.** Carga › Fuentes son cuatro pantallas distintas según cómo se relacionan las bases; con nueve hermanas la lista de bases no entra en la primera pantalla porque la preceden cinco bandas de contexto y un asistente de cuatro pasos. Validación › Reglas del formulario contiene tres pasos apilados. Analítica tiene trece pestañas en fila sin agrupar, y ocho de ellas mezclan preparar la base con generar un archivo. Frecuencias y Cruces no muestran ninguna tabla: son formularios que descargan un Excel.

**3.2 La misma decisión se toma en varios lugares.**

| Decisión | Dónde se toma hoy |
|---|---|
| Qué casos cuentan | Carga › Revisión (universo), reglas de respuesta efectiva del asistente de SurveyMonkey, Validación › Reglas (identidad y validez), Analítica (panel "Qué casos cuentan"), Validación › Cierre (excluir) |
| Columnas fuera del formulario | Carga › Revisión ("Variables extra") y panel "Variables de la base" |
| Si una lista es ordinal | Analítica › Orden de categorías y Analítica › Bases, tras un plegable (medida para SPSS) |
| Descargar la base | Carga › Fuentes, Validación › Cierre y Analítica › Bases |
| Tratamiento de un hallazgo | Al crear el criterio y otra vez al decidir; la lista de ocho tratamientos está escrita tres veces |
| Periodo de campo y duplicados | "Controles operativos" y dos tipos de criterio |

**3.3 El tipo de estudio cambia pantallas enteras en vez de cambiar datos.** No hay una base activa común: Carga tiene tres selectores sin sincronizar, Validación y Codificación usan un componente, Analítica y Gráficos otro. Con nueve bases Analítica muestra tres selectores a la vez y Validación rotula "Base única". Las hijas de un grupo repetido cuentan como bases: un Kobo con un repeat se trata como estudio de varias bases y abre "Comparativos".

**3.4 Actualizar una fuente es el punto más frágil del módulo.** Hay nueve caminos y cada uno existe solo en cierto tipo de estudio u origen: refrescar SurveyMonkey o Kobo solo en hermanas; una base nacida de formulario publicado no tiene ninguno. Solo tres muestran qué va a cambiar antes de aplicar. Al aplicar se borran el plan, la auditoría, los criterios propios, las variables fuera de auditoría y el borrador de limpieza; el aviso de "Nueva versión" solo menciona la limpieza. Después, Analítica vuelve a preparar en silencio y Gráficos no avisa. No existe "al día": las marcas por base significan "algo se hizo".

**3.5 No hay vista de conjunto.** El avance del Home es global, no por base; `/procesamiento` redirige con otras banderas; la banda usa una tercera definición. El estado por base y por fase que el backend ya publica solo se dibuja como cinco puntos dentro de un desplegable, y solo en hermanas.

**3.6 El vocabulario choca.** "Fuente" es la pestaña, una encuesta dentro de una base y, en "Comparar fuentes", una base. La misma estrategia se llama "Hermanas independientes", "Fuentes independientes" y "Mantener bases separadas" según la pantalla. "Recodificar" nombra tres cosas. La pestaña "Cierre de base" se titula por dentro "Limpieza y transformación"; "Preparar" se llama "Organizar" en los botones. Se muestran términos del motor ("Solitaria", "Auto", "Respaldo disponible si el motor principal no está").

**3.7 La composición no acompaña.** Cuatro patrones de cabecera en un módulo. Lienzos con una tarjeta y el 80 % vacío junto a otros saturados de prosa. 25 plegables en Carga. Cajas con receta propia: 258 en Carga, 60 en Analítica, 45 en Validación, 40 en Codificación. Estilos en línea: 452 en Validación, 390 en Analítica, 246 en Codificación. Siete `window.confirm`. Ningún atajo visible en todo el módulo.

## 4. Concepto

Un principio, el mismo que se aprobó para Gráficos: **cada pestaña responde una pregunta del analista y cada decisión vive en un solo lugar.** Sobre él, una columna común a las cuatro secciones.

**4.1 Un solo modelo: el estudio tiene bases y cada base tiene fuentes.** La relación entre bases (una, separadas, integrada, independientes) es un dato declarado del estudio, no una pantalla. Una base se dibuja siempre igual, venga de donde venga. Las hijas de un grupo repetido van anidadas bajo su madre y no cuentan como bases.

**4.2 Una base activa, en un solo lugar.** Zona de contexto de la banda del módulo (la zona izquierda del chrome de tres zonas, ADR 0042): selector de base y, a su lado, los casos que cuentan con su denominador ("288 de 293"). Reemplaza los cinco selectores actuales. La base entra a la dirección como alcance (`base=`), igual que `campana` en Material y `ciudad` en Hojas de ruta.

**4.3 Un vocabulario de estado, con causa.** Por iniciar, En curso, Al día, Requiere atención y Desactualizada. "Desactualizada" siempre dice qué cambió y cuándo. Lo usan las píldoras de sección (para la base activa), el riel, la cabecera, el Home y la vista de conjunto. Se calcula con huella, generalizando lo que ya hace la aprobación para informe de las hermanas.

**4.4 Estado del estudio.** `/procesamiento` deja de redirigir y pasa a ser la vista de conjunto: una matriz de base por fase con su dato, la lista de lo que falta en orden, los cambios recientes y los archivos del estudio.

**4.5 Un solo flujo para actualizar una fuente.** Tres pasos para cualquier origen y cualquier tipo de estudio: leer la fuente, qué cambia (en las respuestas, en el formulario y en el trabajo ya hecho, fase por fase: qué se conserva y qué hay que rehacer) y aplicar. Se guarda una copia para volver.

**4.6 Los casos de la base, en una sola cadena.** Recibidos, pruebas y parciales fuera, excluidos en limpieza, cuentan. Cada eslabón se decide en su lugar natural, pero la cadena completa se lee en un panel único abierto desde la cifra de la banda.

**4.7 Cuatro disposiciones y una cabecera.**

| Disposición | Para qué | Pestañas |
|---|---|---|
| Colección con inspector | Objetos del estudio | Bases |
| Mesa de tres columnas (lista, detalle, decisión o ajustes) | Recorrer muchos ítems | Explorar, Reglas, Hallazgos, Preguntas, Codificar, Variables, Categorías, Frecuencias, Cruces, Entrega |
| Tabla | Consultar datos | Formulario, Respuestas |
| Recorrido por pasos | Flujos largos con un final | Agregar base, Actualizar fuente, Dimensiones, Ponderación |

Cabecera única (`TabHeading`): sección, título, estado y cifras con denominador. Sin "pestaña n de m": las pestañas no son pasos. Reglas de composición: datos reales en el primer viewport; ninguna frase que explique lo que la vista ya muestra; ajustes a la vista con el Switch del kit, sin plegables; toda generación termina en el contenedor de archivo con su estado; todo trabajo largo con avance y cancelación; todo panel con dirección.

## 5. Mapa de pestañas

### 5.1 Carga

| Hoy | Propuesto | Pregunta que responde |
|---|---|---|
| Plan | se integra en Bases | |
| Fuentes | **Bases** | ¿Qué bases tiene el estudio y de dónde viene cada una? |
| Revisión | **Revisión** | ¿La carga quedó bien? |
| panel "Variables de la base" | **Variables** | ¿Qué columnas tiene la base además del formulario? |
| Equivalencias (condicional) | **Equivalencias** (condicional) | ¿Cuál es la misma pregunta en cada base? |
| Estructura | **Formulario** | ¿Qué pregunta el formulario y con qué lógica? |
| Datos | **Respuestas** | ¿Qué trae la base? |

- **Bases** absorbe Plan y las cuatro variantes de Fuentes. La relación entre bases es una línea declarada arriba. Cada base muestra sus fuentes (una o varias, de cualquier formato), su formulario y sus casos. "Agregar base" es un solo recorrido por pasos con seis orígenes; los asistentes de hermanas y de integración pasan a ser ese mismo recorrido con varias bases a la vez.
- **Revisión** queda solo con lo que bloquea o pide decisión: mapeo de códigos, emparejamiento entre fuentes, cambios de la última actualización. El universo pasa a la cadena de casos (4.6) y la base preparada fuera pasa a ser un dato de la base, en su inspector.
- **Variables** saca a la luz lo que hoy está tras un botón y solo en bases separadas: columnas fuera del formulario (un solo lugar), columnas anexadas, variables calculadas, "ya viene codificada".
- Formulario y Respuestas van en un segundo grupo del riel, de consulta.

**Pasada a fondo de Carga** (Gonzalo, 2026-11-10: "sigue mejorando"). Se aplicaron las dos reglas del módulo, una cifra una sola vez por pantalla y ningún bloque cortado:

| Pantalla | Defecto que se veía | Cómo quedó |
|---|---|---|
| Bases | La ficha de la base cortaba "Formulario" contra el pie y repetía la cadena de casos que ya dice la banda | Dos bloques compactos, "Cómo se unieron" y "Formulario"; la cadena de casos queda en la banda y en Cierre |
| Revisión | La cabecera repetía las cuentas de la lista; la columna "Decisión" decía "Por decidir" en todas las filas; el efecto de guardar flotaba en medio del panel | La tabla dice cómo se leería cada columna (tipo y valores), que es lo que hace falta para decidir. Se añade "Marcar como dato personal", opción nueva que Gonzalo confirmó el 2026-11-10: la columna entra a la base y no sale en ningún archivo. El efecto va fijo en el pie |
| Variables | La cabecera repetía los tres grupos; el panel de roles cortaba el interruptor "La base ya viene codificada" | Tres cifras en la cabecera; el panel de roles toma su alto completo |
| Formulario | Decía "En Excel" en la codificación de una pregunta | Corregido tras retirar ese camino |

Equivalencias, Respuestas y el panel para actualizar una fuente se revisaron en captura y no mostraron cortes ni cifras repetidas.

### 5.2 Validación

| Hoy | Propuesto | Pregunta que responde |
|---|---|---|
| Explorar respuestas | **Explorar** | ¿Cómo respondió la gente? |
| Reglas del formulario, paso 1, y Criterios de revisión | **Reglas** | ¿Qué se va a comprobar? |
| Reglas del formulario, pasos 2 y 3, y la cola de Cierre | **Hallazgos** | ¿Qué encontró la auditoría y qué hago con cada cosa? |
| Cierre de base | **Cierre** | ¿Qué cambia en la base y está lista? |

- **Reglas**: un catálogo con tres orígenes (del formulario, del operativo, propias), un interruptor por regla y un editor único en panel con dirección. Los controles operativos dejan de duplicar tipos de criterio.
- **Hallazgos**: una sola auditoría (hoy hay dos botones de ejecutar para una misma evaluación) y una mesa de cola, casos y decisión, con la geometría de Monitoreo › Control › "Por resolver". El tratamiento se elige una vez.
- **Cierre**: efecto de las decisiones, cadena de casos, "Cerrar la base", archivos del cierre y paquete metodológico (que hoy está entre los botones de preparar el plan).

**Regla propia** (Gonzalo, 2026-11-10: "falta revisar el tema del evaluador; ¿está rediseñado el añadir reglas para que sean casos a revisar?"). No lo estaba: el catálogo tenía el botón "Nueva regla" y nada detrás.

Qué hay hoy, leído el 2026-11-10 en `ReglaEditor.tsx`, `ReglasCustomTab.tsx`, `ClasificacionHallazgo.tsx`, `InstrumentoTab.tsx` y `api/R/router_validacion.R`:

| Hoy | Consecuencia |
|---|---|
| El editor es un bloque dentro de la pestaña "Criterios de revisión", en tres pasos (qué revisar, preguntas, condición y clasificación) | Mientras se edita, la lista de criterios se reduce a 220 px de alto |
| Ocho tipos de regla a la vista en tres grupos | Se conservan |
| No hay conteo ni ejemplos antes de guardar. No existe endpoint de prueba; solo las sugerencias traen `n_casos_afectados` | Se clasifica sin haber visto qué casos caen |
| Guardar no evalúa: hay que pulsar "Ejecutar", que vuelve a evaluar también el formulario y muestra un total que mezcla ambos | Dos botones para una misma auditoría |
| La clasificación (inconsistencia o caso a revisar) es nueva y está sin commitear en otra sesión. Por defecto, caso a revisar | La propuesta la adopta tal cual |
| "Caso a revisar" en el editor y "caso a validar" en la insignia del hallazgo | Un solo término: caso a revisar |
| Las condiciones solo se unen con "y"; cada lado se compara contra un valor fijo, nunca contra otra pregunta | Decisión D13 |
| Las reglas del formulario que la auditoría no pudo evaluar dicen "promuévela a criterio de revisión", pero no hay botón: hay que rehacerlas a mano en otra pestaña | La propuesta pone el botón |

Propuesta:

1. **Un panel con dirección** (`panel=regla`) que se abre sobre el catálogo, con dos estados: qué revisar (los ocho tipos con un ejemplo cada uno) y la regla.
2. **La regla se arma en una sola pantalla.** Arriba, la regla escrita como frase, con cada pregunta en el color de su tipo. Debajo, dos bloques: Condiciones (una fila por condición) y Resultado (qué produce y el tratamiento previsto con su alcance, con las mismas acciones y alcances de hoy). A la derecha y a todo el alto, los casos que marca hoy: cifra, proporción y ejemplos con el valor que falla resaltado. El nombre de la regla es el título del panel y se edita ahí.
3. **Los casos se ven antes de clasificar.** Es la misma lección de "única o múltiple": no se pide decidir si es inconsistencia o caso a revisar sin haber visto qué cae. Exige un endpoint nuevo que cuente y devuelva ejemplos sin guardar.
4. **"Guardar" y "Guardar y auditar".** La regla guardada sin auditar se marca en el catálogo; sus casos entran a Hallazgos con la clase elegida y el tratamiento previsto.
5. **Comparar preguntas y unir con "o" (D13, decidida por Gonzalo el 2026-11-10: "las dos cosas").** El valor de cada condición puede ser un valor fijo u otra pregunta. Un tipo nuevo, "Condiciones combinadas", admite varias condiciones y un solo interruptor "Todas" o "Alguna"; no se anidan grupos, para que no haya que adivinar la precedencia entre "y" y "o". "Solo revisar cuando" sigue siendo un filtro previo que siempre se suma. Es cambio de motor: hoy `coherencia_2v` compara cada pregunta contra un valor fijo y une con "and".
6. **Cuatro entradas al mismo panel:** el botón "Nueva regla", "Añadir" en una sugerida (llega armada, con su conteo), "Nueva regla sobre esta pregunta" desde Explorar y "Convertir en regla propia" desde una regla sin evaluar.
7. **Reglas sin evaluar** como familia propia del catálogo, con su conteo en la cabecera, la causa de cada una en lenguaje llano ("Expresión que no se pudo leer", "Falta la fecha de la encuesta") y el botón para convertirla. Hoy ese grupo mezcla las no evaluadas con los errores de ejecución.

**Mostrador de hallazgos** (Gonzalo, 2026-11-10: "no me has mostrado el revamp completo del mostrador de inconsistencias y cómo detecta inconsistencias y cómo las muestra"). Hasta aquí Hallazgos tenía una sola vista, la de una regla propia. La evidencia que sirve para decidir cambia con el tipo de hallazgo, así que el panel central cambia con él y la cola y la decisión se quedan iguales:

| Tipo de hallazgo | Cómo se detecta | Qué muestra | Qué se decide |
|---|---|---|---|
| Regla propia entre preguntas | La condición de la regla | La frase, la cifra sobre la base y los casos con el valor que falla resaltado | Dejar, vaciar, corregir o excluir |
| Salto del formulario | La pregunta se muestra bajo una condición; se marca en dos sentidos: le correspondía y está vacía, o no le correspondía y tiene respuesta | La cifra sobre quienes debían responder (no sobre toda la base), los dos sentidos con su cuenta y, por caso, la respuesta que abre el salto junto a la que falla | Dejar, asignar un valor, corregir o excluir |
| Valor fuera de rango (regla propia) | Un límite sobre una pregunta numérica | La distribución de todos los valores con el límite marcado, mediana y mitad central, y los casos con las respuestas que les dan contexto | Dejar, corregir, vaciar o excluir |
| Respuestas casi iguales (del operativo) | Dos respuestas que coinciden en el 90 % o más de las preguntas que se comparan | Un bloque por par, con fecha, duración y preguntas respondidas de cada respuesta, en cuántas coinciden y cuál se conserva | Cuál se conserva: la más completa, la más reciente, la primera o todas |

Desde cualquier caso se abre **el caso completo** en un panel: los hallazgos en que aparece, y sus respuestas por sección con las que fallan resaltadas. Hoy para ver el resto de un caso hay que salir de la pantalla.

**Qué detecta el motor hoy**, leído el 2026-11-10 en `validacion_ast_introspect.R`, `validacion_rule_factory.R`, `validacion_operational_controls.R`, `reglas_custom_semilla.R`, `limpieza_decision_engine.R` y las pestañas Instrumento y Limpieza. El prototipo se corrigió donde no coincidía:

| Lo que sale solo del formulario | De dónde | Qué marca |
|---|---|---|
| Obligatoria | `required` | Le correspondía responder y está vacía |
| Salto, en dos sentidos | `relevant` | Le correspondía y está vacía; o no le correspondía y tiene respuesta |
| Restricción | `constraint` | Tiene respuesta y no cumple la restricción |
| Filtro de opciones | `choice_filter` | La combinación de la opción con su pregunta anterior no está permitida |
| Valor calculado | `calculate` | Lo guardado no es igual al cálculo rehecho |
| Filas repetidas | `begin_repeat` | Faltan o sobran filas, filas sin persona, filas duplicadas |

| Corrección al prototipo | Motivo |
|---|---|
| Las familias "Rangos" y "Fuera de lista" pasaron a "Restricciones", "Filtros de opciones" y "Valores calculados" | Rango y fuera de lista no se generan solos: solo existen como regla propia o como sugerencia |
| Se quitó el hallazgo de duración | La duración, el GPS y las entrevistas simultáneas se dejaron a Monitoreo de forma explícita (`validacion_taxonomia_anomalias.R`) |
| "Respuestas repetidas" del operativo pasó a "Respuestas casi iguales" | El control del operativo compara por similitud sobre al menos diez preguntas; el repetido por clave es una regla propia |
| Las sugeridas son valores fuera de lista y negativos | Son dos de las siete que el motor propone de verdad (procedencia, dominio, agente, continuidad, periodo, rango numérico, fecha declarada) |
| La cabecera de Hallazgos cuenta casos distintos | Hoy "Total de inconsistencias" suma regla por regla y un caso con dos hallazgos cuenta dos veces |

Lo que la propuesta pide al motor en Hallazgos: devolver todas las respuestas de un caso (hoy solo las variables de la regla), guardar con qué otro caso coincide cada casi igual (hoy no se guarda), y enviar por caso el valor esperado junto al observado (el redactor `validacion_enunciado_hallazgo` existe y nadie lo llama). Desactivar una regla pide un motivo, como hoy.

**Contraste con un informe real** (Gonzalo pidió validar las reglas contra el informe de inconsistencias y casos a revisar de un estudio en curso; el documento es interno y no va al repo). El informe define inconsistencia y caso a revisar igual que la propuesta. Sus reglas, por clase:

| Clase de regla en el informe | Cómo se escribe en el panel | Estado |
|---|---|---|
| Un valor numérico dentro de un rango | Valor fuera de rango | Cubierta |
| Una opción única que no cuadra con una lista de opciones de otra | Dos respuestas que deben cuadrar, con "no está entre" | Cubierta |
| Una opción múltiple que no incluye algo, contra un ítem de escala | Dos respuestas que deben cuadrar, con "no incluye" | Cubierta |
| Un ítem de escala que se contradice con cualquiera de varios ítems | Condiciones combinadas: "Solo revisar cuando" el primero, y "Alguna" de los otros | Cubierta gracias a D13 |
| Un caso que "no es inconsistencia automáticamente, se evalúa" | Cualquier tipo, clasificado como caso a revisar | Cubierta |
| Tres preguntas territoriales cuya combinación debe existir (el distrito dentro de la provincia y esta dentro de la región) | Sale sola si el formulario declara el filtro de opciones. Si no lo declara, no había tipo | Cubierta a medias: se añadió "Combinación fuera de catálogo" al selector para el segundo caso, sin dibujar su panel. No se abrió el formulario de ese estudio para saber cuál de los dos es |

Tres cosas más que enseña el informe. Primero, se escribe **antes de tener respuestas**, a partir del instrumento; el panel de regla debe poder guardarse con la base vacía y decir que contará al cargar. Segundo, cada regla va con un **ejemplo**, que es lo que el panel ya muestra en "Casos que marca hoy". Tercero, el informe mismo es un entregable: Reglas ofrece "Informe de reglas, en Word", con cada regla, su frase y un ejemplo.

**Pasada a fondo de Validación** (Gonzalo, 2026-11-10: "sí, Validación", después de rehacer el panel de regla). Qué tenía cada pantalla y qué cambió:

| Pantalla | Defecto que se veía | Cómo quedó |
|---|---|---|
| Reglas | La cabecera repetía las cifras de la franja; las reglas iban en una tabla de cinco columnas con el texto partido en tres renglones; la ficha cortaba su último bloque contra el pie | Franja de recorrido en una línea (reglas, auditoría, hallazgos, por decidir). Cada regla es una fila de dos renglones con su frase, su clase, su tratamiento y sus casos. La ficha de la derecha lee la regla con las mismas piezas del panel y no edita: se edita en el panel |
| Hallazgos | Los filtros de la cola se partían en dos renglones; la explicación del hallazgo era un párrafo con fichas sueltas; el efecto de la decisión quedaba cortado | La cola filtra entre "Por decidir" y "Decididos", y las reglas que no encontraron casos pasan a un renglón al pie. El hallazgo abre con la frase de la regla y su cifra. El efecto de la decisión va fijo en el pie, junto a los botones |
| Cierre | La cabecera y la cadena de casos repetían cifras; la tabla de decisiones dejaba medio panel vacío | Franja con la cadena de casos y su proporción. Las decisiones se agrupan por efecto (casos excluidos, valores cambiados, sin cambios) y cada una muestra su motivo |
| Explorar | Los tipos ocupaban tres renglones; "7 opciones" se partía | Tipos en dos renglones; el dato va en su propia fila |
| Vacíos | Recuadro punteado a todo el alto | Sin punteado, que queda solo para donde se suelta o se agrega algo |

Una regla para todo el módulo salió de aquí: **una cifra aparece una sola vez por pantalla**. Si la franja dice "94 del formulario", la cabecera no lo repite. Los tratamientos usan los mismos nombres llanos en la regla, en la ficha y en la decisión ("Dejar como está", "Vaciar la respuesta", "Corregir el valor", "Excluir los casos"), que son las acciones de hoy con otro rótulo.

**Del plan automático a la decisión** (Gonzalo, 2026-11-10: cómo se integra el plan de consistencia del instrumento con los casos a revisar por combinaciones sospechosas, y cómo llega todo al panel de decisión). Hoy son dos pestañas, dos botones de ejecutar y dos listas de tratamientos, y solo se juntan en la cola de Cierre. La propuesta:

1. Una franja en Reglas dice el recorrido con sus cifras: tres orígenes (del formulario, que se arma solo; del operativo; propias), una auditoría, dos clases de resultado y una cola.
2. Las dos clases son las que ya introduce `ClasificacionHallazgo`: **inconsistencia** (la respuesta contradice al formulario) y **caso a revisar** (posible, pero conviene mirarlo). Las reglas del formulario producen inconsistencias; las del operativo y las propias declaran cuál producen.
3. Cada regla declara su **tratamiento previsto**. Llega marcado al panel de decisión con la etiqueta "Previsto en la regla" y se puede cambiar caso por caso. Se elige una vez.
4. Las sugerencias que salen de mirar la base se añaden desde Reglas, en un bloque a la vista.
5. Hallazgos muestra las dos clases en una sola cola, con su conteo, y la misma mesa de decisión para ambas.

### 5.3 Codificación

| Hoy | Propuesto | Pregunta que responde |
|---|---|---|
| Preparar | **Preguntas** | ¿Qué se codifica y por qué camino? |
| Codificar | **Codificar** | ¿Qué código lleva cada respuesta? |
| Matrices | Se retira: su trabajo pasa a la vista de tabla de **Codificar** | |
| Adaptación | **Aplicar** | ¿Qué cambia en la base? |

- **Preguntas**: lista de pares enlazados con inspector. Cada unidad muestra la pregunta cerrada, su texto, el lazo entre ambas, el tipo resultante con su evidencia y el avance. Cada pregunta declara si se codifica o no; ya no hay camino por Excel. El emparejamiento por arrastre se conserva y sube de nivel (8.1).
- **Codificar** tiene dos vistas de la misma pregunta, tarjetas y tabla, y es el único lugar donde se codifica.
- **Aplicar** reúne los archivos (base codificada, formulario codificado, matriz para el cliente, registro de codificación, respaldo) que hoy están repartidos entre Matrices y Adaptación. El término de la unidad es "código" en las tres pestañas.
- Se retira la ruta `/codificacion/preguntas/:parent`, que nada enlaza.

**Codificar en tabla** (Gonzalo, 2026-11-10: "una codificación con una matriz ya no tendría por qué hacerse en Excel; con el sistema y la interfaz que tenemos podemos hacerla en el mismo proceso, de forma profesional y elegante, de tal forma que no sea necesario importar un Excel de ningún tipo"). Se retira la pestaña Matrices, con su ida y vuelta y su mesa de conflictos entre la app y la matriz. Codificación queda en tres pestañas: Preguntas, Codificar y Aplicar, y el módulo en 21.

Lo que daba Excel y dónde queda:

| En Excel | En la vista de tabla de Codificar |
|---|---|
| Una fila por respuesta y una columna para el código | Una fila por texto distinto, con sus veces, y la celda del código |
| Escribir el código con el teclado y bajar | Se escribe el número o el nombre, la lista se filtra, Enter asigna y baja. Mayús y Enter suma otro código |
| Ordenar y filtrar | Orden por frecuencia o alfabético, búsqueda y filtro "Por codificar" o "Todas" |
| Rellenar hacia abajo | Marcar varias filas y asignar una vez |
| Tener el libro de códigos al lado | Panel "Libro de códigos" con sus cuentas, buscar y crear |
| Juntar a ojo los textos parecidos | "Agrupar parecidas" los junta en una fila y los lista debajo |
| Entregar la matriz al cliente | "Matriz de codificación" se genera en Aplicar, como archivo de salida |

Las sugerencias llegan como propuesta en la celda, con borde punteado, y se aceptan una por una o todas. La tabla y las tarjetas muestran la misma pregunta y el mismo avance. Queda por comprobar en el motor qué hacen hoy "Sugerir códigos" y el agrupado de textos parecidos antes de prometerlos; no se leyó ese código.

Lo que no se retira (D14): traer lo que se hizo fuera. Las variables creadas en SAV o en un procesamiento independiente siguen entrando por Carga › Variables, y en Preguntas una pregunta puede declararse "Ya viene codificada", con su columna emparejada por el identificador del caso.

**Nombres** (Gonzalo, 2026-11-10: "los nombres tienen que quedar superclaros; una base codificada, antes usábamos adaptado, pero creo que no encaja muy bien con las nomenclaturas estándar"). La base toma un nombre por cada fase que la cambia, y los archivos de Codificación siguen esa familia:

| Qué es | Nombre | Antes |
|---|---|---|
| La base tal como llegó | Base cargada | |
| La base después de Validación | Base limpia | |
| La base con las columnas de códigos | Base codificada | Respuestas adaptadas |
| El formulario con las listas de códigos nuevas | Formulario codificado | Formulario adaptado |
| El archivo con cada respuesta y su código, para entregar | Matriz de codificación | |
| El detalle de qué código recibió cada respuesta | Registro de codificación | Auditoría de codificación |
| La pestaña que lleva los códigos a la base | Aplicar | Adaptación |

"Registro de codificación" fue propuesta de esta sesión y Gonzalo la confirmó el 2026-11-10: sigue la forma de "Registro de limpieza" y deja la palabra "auditoría" solo para la corrida de reglas de Validación. No se abrió el archivo actual para confirmar qué contiene.

**Pasada a fondo de Codificación** (Gonzalo, 2026-11-10):

| Pantalla | Defecto que se veía | Cómo quedó |
|---|---|---|
| Matrices | Se rehízo en esta pasada y después se retiró entera (ver "Codificar en tabla") | |
| Aplicar | Un aviso, la cabecera y el panel de efecto repetían cifras; la lista apilaba tres etiquetas por pregunta; la tabla y Archivos quedaban cortados | Una franja dice qué se agrega, qué queda sin código propio y qué no entra todavía, con los avisos en una línea debajo. La lista muestra código, tipo y estado en un renglón. Archivos ocupa la columna derecha completa |
| Preguntas | La cabecera repetía el total y lo que ya dice el estado | Tres cifras: por camino |
| Codificar | Los ejemplos de cada código se cortaban en un renglón | Dos renglones |

**Única o múltiple.** Gonzalo (2026-11-10): "yo no puedo saber si es única o múltiple hasta no ver lo que responden". La primera maqueta lo pedía en Preguntas con dos opciones, antes de codificar; se retiró. La regla propuesta:

| Caso | De dónde sale el tipo | Qué muestra la interfaz |
|---|---|---|
| Texto unido a una pregunta cerrada | Lo hereda de esa pregunta, que es un dato del formulario | "Igual que p3" |
| Texto unido a una pregunta de opción única, con una respuesta de dos códigos | Pasa a múltiple (D12) | "Era única: 1 respuesta con dos códigos", con aviso |
| Abierta sin pregunta cerrada, sin codificar | Todavía no existe | "Por definir, se define al codificar" |
| Abierta sin pregunta cerrada, en curso | De lo codificado: única mientras cada respuesta lleve un código, múltiple desde que una recibe el segundo | "Ninguna respuesta con varios códigos" o "3 respuestas con varios códigos" |

En Codificar, una respuesta que menciona dos cosas se suelta con la tecla Opción (o Mayús y el número) y se queda en la lista con sus códigos a la vista hasta pulsar "Listo"; el aviso de asignación ofrece además "Sumar otro código". En el prototipo se probó con el navegador: soltar con Opción deja la fila, el segundo código sube el contador de 3 a 4 respuestas, Cmd+Z lo devuelve a 3 y "Listo" cierra la fila.

**D12, decidida por Gonzalo el 2026-11-10: "pasa a múltiple con aviso".** Cuando una respuesta "Otro" de una pregunta de opción única recibe un segundo código, la columna resultante de esa pregunta pasa a opción múltiple. El aviso aparece en tres lugares: al asignar el segundo código ("p3 pasa a opción múltiple: 1 respuesta lleva más de un código", con "Deshacer"), fijo en Codificar mientras dure esa condición (con la consecuencia: los porcentajes de la pregunta pueden sumar más de 100 %) y en Aplicar, dentro de "Efecto en la base". En Preguntas la unidad muestra "Múltiple" con "Era única: 1 respuesta con dos códigos". Si se quita el segundo código, la pregunta vuelve a única y el aviso desaparece. En el prototipo se probó con el navegador el ciclo completo: quitar el código devuelve "Única, igual que su pregunta p3" sin aviso; darlo otra vez muestra el aviso y el mensaje; Cmd+Z lo revierte.

Es cambio de motor y entra en F4: hoy `<padre>_recod` de una pregunta de opción única siempre sale de opción única y el frontend no deja asignar el segundo código. Al implementarlo lo revisa `revisor-metodologico` (denominador de las tablas de esa pregunta y su efecto en cruces y comparativos).

Qué hace hoy el motor, leído en el código el 2026-11-10: un texto unido a una pregunta de opción única produce `<padre>_recod` de opción única; unido a una de opción múltiple, `<padre>_recod` múltiple; una numérica, opción única por rangos; una abierta sin pregunta cerrada sale como opción única salvo que la base traiga columnas dummy (`is_text_sm` en `api/R/codificacion_aplicar_instrumento.R`). El frontend solo permite varios códigos por respuesta cuando la pregunta cerrada es múltiple (`esSM` en `RespuestasCodificador.tsx`). No se determinó si la matriz de Excel admite varios códigos para una abierta sin pregunta cerrada: no se abrió el generador de la matriz.

### 5.4 Analítica

**Pasada a fondo de Analítica** (Gonzalo, 2026-11-10: "sigue mejorando"). Cuatro cabeceras repetían "casos cuentan", que ya dice la banda del módulo; se quitó. En Ponderación la cabecera repetía las cuatro cifras del panel "Efecto de ponderar" y quedó con las variables de ajuste y el tamaño de la población. Frecuencias, Cruces y Entrega se revisaron en captura sin cambios.


| Hoy (13) | Propuesto (8) | Grupo |
|---|---|---|
| Datos | **Variables** | Preparación |
| Orden de categorías, códigos especiales (hoy en Libro de códigos), medida para SPSS (hoy en Bases) | **Categorías** | Preparación |
| Dimensiones | **Dimensiones** | Preparación |
| Ponderación | **Ponderación** | Preparación |
| Frecuencias | **Frecuencias** | Tablas |
| Cruces | **Cruces** | Tablas |
| Tablas multibase, Comparativos, "Unir bases", Base panel | **Comparativos** (condicional) | Tablas |
| Base final, Bases e instrumentos, Libro de códigos, Ficha técnica | **Entrega** | Entrega |

- El riel se ordena por dependencia y en tres grupos con separador. Hoy Orden de categorías y Dimensiones van al final aunque Frecuencias y Cruces dependen de ellas.
- **Frecuencias** y **Cruces** muestran la tabla tal como sale en el archivo, con los ajustes al lado y el archivo debajo.
- **Entrega** es la síntesis que hoy falta: los ocho entregables de la base en orden y en tres grupos (base de datos, documentación, tablas), cada uno con su estado, con qué se construye y sus archivos. "Generar lo que falta" y "Armar el paquete" actúan sobre todos.
- **Comparativos** muestra la variante que corresponde a la relación entre bases declarada en Carga. La base panel pasa a ser una base derivada más, con lo que deja de duplicar libro de códigos, frecuencias, cruces y ficha.
- Los tres controles de la cabecera actual se reparten: la versión de la base (original o codificada) va con el selector de base; la plantilla pasa al menú de acciones; "Cuentan N casos" es la cifra de la banda.

## 6. Escenarios

| Escenario | Cómo lo resuelve la misma estructura |
|---|---|
| Una base desde archivo | Bases con una tarjeta; sin selector en la banda |
| Bases separadas por público | Una tarjeta por base; Equivalencias y Comparativos aparecen |
| Hermanas independientes | Igual, más la aprobación para informe en Estado del estudio |
| Base integrada | Una tarjeta con varias fuentes y su emparejamiento |
| Dos fuentes de formato distinto en una base | Dos líneas de fuente en la tarjeta; "Cómo se unieron" en el inspector |
| Hija de grupo repetido | Fila anidada bajo la madre; no cuenta como base |
| Formulario publicado | Origen en "Agregar base"; la revisión se ve en el inspector |
| Traída de Monitoreo | Origen en "Agregar base" |
| Base limpiada fuera | Dato de la base en su inspector |
| Serie de mediciones | Equivalencias en Carga y Comparativos en Analítica |
| Actualizar cualquier fuente | Un solo flujo de tres pasos (4.5) |

## 7. Coherencia con los demás módulos

| Concepto | Pieza que ya existe y se reutiliza |
|---|---|
| Alcance en la dirección | `campana` (Material) y `ciudad` (Hojas de ruta); se suma `base` |
| Conectar un origen | Monitoreo "Conectar fuente": piezas en orden, con estado y verificación |
| Cola de decisiones | Monitoreo acreditación › Control › "Por resolver" (`panel=caso&foco=`) |
| Entrega | Sección "Entrega" de Cálculo, Material y Hojas; aquí es pestaña y grupo |
| Archivos | Contenedor de archivo, bandeja y nombres del ADR 0133 |
| Lista con inspector | `PulsoTable` con `?foco=` |
| Pasos internos | `StageStepper`, nunca junto a numeración de secciones |
| Estados | Los del Home, más "Desactualizada" |

Límites que se respetan: cinco niveles de navegación; chrome de tres zonas y una fila; riel de 56 px siempre presente; toda vista enlazable; `PageFrame` con disposición y dueño de scroll; Contrato de Superficie; datos en la secuencia navy; booleanos con Switch. Procesamiento no gana "modo": la relación entre bases es un atributo, no un juego de secciones distinto.

## 8. Dinámicas y contenedores

### 8.1 Dinámicas que se conservan y suben de nivel

| # | Hoy | Propuesta | Pieza existente |
|---|---|---|---|
| 1 | Emparejar preguntas por arrastre: fantasma con giro, sin destinos señalados, sin deshacer | Destinos válidos visibles al levantar, inválidos atenuados, fantasma que se asienta, "Deshacer" | `fantasma.ts` de Formularios, `--drag-valid-*`, toaster |
| 2 | Asignar respuestas a un código de una en una, con casilla | Selección múltiple, arrastre del lote con contador, tecla del código, "Deshacer" | `seleccionVistaGeneral.ts`, `BarraSeleccion` |
| 3 | Deshacer: un nivel o ninguno | Cmd+Z en Codificar, Hallazgos y Analítica | `historialAgrupado.ts` |
| 4 | Reordenar con flechas, sin movimiento | Reordenar con FLIP y Alt+flecha | `flip.ts`, `OrdenCategoriasGrafico` |
| 5 | Dos editores de orden casi iguales | Uno | |
| 6 | Arrastre como única vía en Dimensiones | Alternativa por teclado | `sortableKeyboardCoordinates` |
| 7 | Atajos sin rótulo | Atajos visibles junto al botón y ayuda con "?" | `lib/teclado.ts`, `ShortcutsModal` |
| 8 | Siete `window.confirm` | Diálogo del kit | `Dialog` |
| 9 | Cuatro progresos distintos | Uno, con cancelación | `JobProgress`, contenedor de archivo |
| 10 | Tres tablas más `<table>` a mano | `PulsoTable` | |
| 11 | 61 `select` nativos | `PulsoSelect` y el combobox de Equivalencias | `PreguntaCombobox` |
| 12 | Lista de respuestas sin virtualizar | Virtualizada | `PulsoTable` |

El arrastre de Codificación hoy existe solo en Preparar. El prototipo lo lleva también a Codificar, que es donde se hace el trabajo repetitivo.

### 8.2 Contenedores

Gonzalo (2026-11-10), sobre la primera versión del prototipo: "a los contenedores aún les falta mejor definición, márgenes más profesionales, algunos botones se muestran mejor centrados; cuando te digo mejorar es mejorar: veo cambios de disposición, pero no mejoras visuales". El prototipo se rehízo con este contrato, recuperado de `tokens.css`:

| Regla | Valor |
|---|---|
| Espacios | Solo la escala 4, 8, 12, 16, 20, 24, 32. Entre paneles, 20; entre secciones de un panel, 24 |
| Simetría | En mesas de tres columnas, las dos laterales miden lo mismo (320). El inspector de las mesas de dos columnas mide siempre 400 |
| Alto | Toda columna de paneles llega al borde inferior: el último panel se estira y el vacío queda dentro del contenedor, nunca fuera (comentario de Gonzalo sobre Estado del estudio; es la cláusula C3) |
| Riel interior | 20 px en todo panel: título, filtros, primera columna de la tabla, texto de las listas y pie caen sobre la misma línea |
| Panel | Radio 16, borde fino y sombra corta. Cabecera de 56 con línea inferior: ícono en tesela de 30, título de 15, conteo en píldora y acciones a la derecha en la misma fila |
| Pie de panel | Fondo un tono más bajo y línea superior. La acción principal ocupa el ancho, centrada, a 36 de alto y con su atajo dentro; la secundaria a su izquierda |
| Segundo nivel | Pozos de radio 10 sin sombra para cifras, opciones y sugerencias. Nunca una caja con sombra dentro de otra |
| Tablas | Cabecera de 38 con fondo, filas de 48, selección de borde a borde |
| Listas | 8 de margen y 12 de relleno, radio 10, selección con relleno y borde del acento |
| Letra | 11 rótulo, 12 dato secundario, 13 cuerpo, 15 título de panel, 18 objeto, 21 cifra. Peso 700 en títulos, 600 en énfasis y 800 solo en cifras |
| Punteado | Solo donde se suelta o se agrega algo |
| Color | Cuatro familias: neutros, acento del módulo para la selección, secuencia navy para los datos y un punto con el color del estado. Sin rellenos de color; los archivos usan la tesela neutra del kit (`TileFormato`). Comentario de Gonzalo: "los colores son algo intensos y rompen la paleta" |
| Cabecera de pestaña | Es un contenedor con la misma receta que los paneles. Las cifras van en una tira con divisores, sin píldoras, y la acción principal queda en el extremo derecho |
| Tamaños | Las mesas de tres columnas usan 320 y 400 de lado; desde 1600 de ancho, 360 y 440; hasta 1400, 264 y 330; hasta 1100 pasan a dos columnas y la página se desplaza |
| Movimiento | Los paneles entran con un desplazamiento corto y escalonado; tarjetas y botones responden al pasar y al presionar; el foco por teclado siempre se ve. Solo `transform` y `opacity`, y se apaga con movimiento reducido |
| Cifras | Una cifra aparece una sola vez por pantalla: la cabecera de pestaña no repite lo que dice la franja o el panel |
| Franja de recorrido | Una línea, sin cajas: grupos con rótulo, cifras separadas por divisores y el destino a la derecha como botón del acento. La usan Reglas y Cierre |
| Tipo de pregunta | Cada tipo lleva su color característico, el de `tokens.css` (`--tipo-so` celeste, `--tipo-sm` verde, `--tipo-int` morado, `--tipo-text` amarillo), que replica la plantilla de codificación en Excel. Presente pero suave: relleno al 60 % y borde fino en la etiqueta del tipo, tono medio en las marcas de columna. Gonzalo, 2026-11-10: "cada tipo de pregunta tiene un color característico que no siempre tiene que estar in your face" |
| Ancho | Ninguna tabla queda cortada a la derecha, salvo la de Respuestas, que se desplaza y lo dice en su pie. Lo vigila el control de capturas del prototipo, que antes no veía contenedores con desplazamiento |

Segunda versión (Gonzalo, 2026-11-10: "aún falta afinar para que todo se vea más fino y elegante y con contenedores más simétricos y mejor separados, pero vamos por buen camino"): columnas laterales iguales, más espacio entre paneles y entre secciones, pesos de letra más ligeros y chips de estado sin borde.

**Cinco tandas** (Gonzalo, 2026-11-10: "sigue mejorando en cinco tandas"). Primera: cabecera de pestaña y banda del módulo. Segunda: tablas y listas, con Explorar completo (lista filtrable por tipo, gráfico según el tipo, filtros y cruce como fichas, gráfico o tabla). Tercera: inspectores, campos y pies. Cuarta: una sola base, nueve bases y los vacíos (sin bases, sin auditar, sin hallazgos). Quinta: movimiento, foco y los cinco tamaños de la matriz. El punto de corte angosto subió de 1340 a 1400 porque a 1366 varias tablas caían entre dos juegos de medidas y se cortaban.

Al implementar, el contrato se cumple con las primitivas del kit (`Panel`, `PulsoButton`, `PulsoTable`) y se declara como geometría C1 de cada superficie; lo que el kit no tenga (pie de panel, pozo, conteo en píldora) entra primero al kit.

Una receta: el `Panel` del kit (radio 14, borde de 1 px, sombra suave). Dentro, filas separadas por una línea; nada de caja dentro de caja. Sin franja de acento a la izquierda, sin borde punteado salvo en zonas donde se suelta algo o en vacíos.

**Sin acordeones** (Gonzalo, 2026-11-10: "estos acordeones no me gustan nada, prefiero que sea un bloque elegante", sobre "¿Qué es armonizar?" de Equivalencias). Hoy hay 34 `<details>` en las cuatro secciones (25 en Carga). Cada uno se resuelve de una de dos formas: si el contenido hace falta, pasa a un bloque a la vista dentro del inspector o del panel, con un ejemplo dibujado y no un párrafo; si solo explica lo que la vista ya muestra, se retira. En Equivalencias la explicación de armonizar pasa a ser el inspector de la fila: las escalas de cada base y la escala común, dibujadas. Guard: un contrato que falla si aparece `<details>` o `Collapsible` en las cuatro secciones, con el caso que lo pone rojo. Meta de los ratchets `cajasPropias`: bajar a cero por sección al rediseñar cada una, y extender el detector a Validación y a los estilos en línea.

### 8.3 Estados de carga, trabajo en curso y error

Pedido por Gonzalo el 2026-11-10. Tres reglas, las mismas en las cuatro secciones:

| Estado | Regla | Cómo se ve |
|---|---|---|
| Pantalla cargando | El marco no cambia (cláusula C2): cabecera, riel y paneles están en su sitio desde el primer momento | Cada panel muestra bloques grises con la geometría de lo que va a traer. Nunca un indicador a pantalla completa. El botón de la cabecera queda deshabilitado |
| Trabajo en curso (auditar, leer una fuente, generar archivos, aplicar) | Avanza en su lugar y deja leer lo demás | Una franja bajo la cabecera dice qué hace, en qué va y cuánto lleva, con "Cancelar". Lo que había queda a la vista, atenuado y con su fecha. En una lista, cada fila lleva su propio avance |
| Error con causa conocida | Dice qué pasó, por qué, qué no cambió y qué se puede hacer | Título, causa en una frase, una línea con lo que sigue como estaba y dos acciones. Va dentro de la superficie que falló, no en un aviso flotante |
| Error inesperado | Lo mismo, y además el identificador del error para reportarlo | El identificador se puede copiar. Nunca se muestra el mensaje crudo del motor |
| Sin conexión con el motor | El marco se queda; el contenido se reemplaza por un solo estado | La app reintenta sola y lo dice; "Reintentar ahora" lo fuerza |

Los siete prototipos: pantalla cargando (Hallazgos), auditando, leyendo una fuente, no se pudo leer la fuente (conexión vencida), generando archivos con uno que falló (archivo abierto en otro programa), error inesperado en un panel y sin conexión con el motor.

Dos cosas se apoyan en lo que la app ya tiene y no se verificaron en el código para esta sección: los trabajos largos con avance (`jobs.R`, que el frontend consulta) y el identificador de error de `E_INTERNAL` (`errors.R`). Los textos de causa de los ejemplos son ilustrativos; al implementar salen del registro de errores, un texto por código `E_*`.

## 9. Decisiones

Aprobadas por Gonzalo el 2026-11-10 ("sí" al mapa de pestañas con las recomendaciones D1 a D11). D9 se decidió aparte el mismo día (integrar por base), y D12 a D14 se abrieron después; D5 se resuelve con una sola pestaña "Entrega".

| # | Decisión | Recomendación |
|---|---|---|
| D1 | Carga: retirar la pestaña Plan e integrarla en Bases | Sí |
| D2 | Carga: promover "Variables" a pestaña y renombrar Estructura y Datos a Formulario y Respuestas | Sí |
| D3 | Validación: unir reglas del formulario, del operativo y propias en "Reglas", y la auditoría con la cola en "Hallazgos" | Sí |
| D4 | Codificación: nombres "Preguntas" y "Aplicar" | Sí; los archivos conservan "adaptada" |
| D5 | Analítica: una pestaña "Entrega" en vez de cuatro pestañas de entregables | Sí; alternativa: tres pestañas (Base de datos, Libro de códigos, Ficha técnica) |
| D6 | Analítica: unir Tablas multibase, Comparativos y Base panel en "Comparativos" | Sí, con la base panel como base derivada (toca el ADR 0017) |
| D7 | `/procesamiento` como "Estado del estudio" en vez de redirigir | Sí |
| D8 | Al actualizar una fuente, conservar criterios propios y variables fuera de auditoría cuando solo cambian las respuestas | Sí; hoy se borran |
| D9 | Permitir fuentes de formato distinto dentro de una base, en un estudio de varias bases | Decidida por Gonzalo (2026-11-10): integrar por base. Cualquier base puede tener varias fuentes, con su comparación de formularios. Es cambio de motor |
| D10 | Que la Ficha del estudio proponga la relación entre bases | Sí, como sugerencia editable |
| D11 | Dónde se declaran identidad del caso y recopilador | Carga › Variables, como roles de la base |
| D12 | Qué pasa cuando una respuesta "Otro" de una pregunta de opción única necesita dos códigos | Decidida por Gonzalo (2026-11-10): la pregunta pasa a opción múltiple, con aviso. Queda abierto el segundo punto: si una abierta sin pregunta cerrada puede salir múltiple también por la matriz de Excel |
| D13 | Permitir en una regla propia comparar una pregunta con otra y unir condiciones con "o" | Decidida por Gonzalo (2026-11-10): las dos cosas. Sin grupos anidados: un interruptor "Todas" o "Alguna" por regla. Es cambio de motor |
| D14 | Importar lo hecho fuera de la app | Resuelta con la corrección de Gonzalo (2026-11-10: "alguien en SAV o en un procesamiento independiente agrega variables a partir de las existentes; eso no debería quitarse porque sí"). Se retira solo la ida y vuelta de la matriz de Excel. Las variables hechas fuera siguen entrando por Carga › Variables, y una pregunta puede declararse "Ya viene codificada" y traer su columna de un SAV o un Excel |

**D9, fuentes de formato distinto.** Cómo funciona hoy, leído el 2026-11-10 en `api/R/multi_integrated.R`, `frontend/src/features/carga/CargaSourcesModel.ts` y `CargaTopologyModel.ts`:

- El estudio declara una sola estrategia para todas sus fuentes: separadas, integrada o independientes. Con "integrada" todas las fuentes terminan en una base (`plannedResultBaseCount` devuelve 1); con las otras dos, cada fuente es una base.
- El motor de integración ya junta orígenes de formato distinto: cada origen es una encuesta de SurveyMonkey o un par de formulario y datos en archivo. Crea una variable que dice de qué origen viene cada caso, compara los formularios, y no deja importar con diferencias bloqueantes o decisiones pendientes.
- Lo que no se puede hoy es el caso intermedio: un estudio de cuatro bases donde una de ellas junta una encuesta en línea con un Excel. En Analítica, lo que depende del origen solo funciona si el estudio tiene una única base (`not_single_integrated`).
- La integración no acepta un SAV ni un Kobo como origen, y a cada origen en archivo le pide su propio formulario.

| Opción | Qué puede hacer el analista | Qué cuesta |
|---|---|---|
| A. Integrar por base (recomendada) | Cualquier base puede tener varias fuentes de formato distinto, con su comparación de formularios. La estrategia deja de ser del estudio y pasa a cada base | Dejar que la integración apunte a una base dentro de un estudio de varias; quitar en Analítica el supuesto de base única; actualizar una sola fuente de una base integrada; guardar la integración por base en el `.pulso` |
| B. Apilar con el mismo formulario | Una segunda fuente entra a una base solo si responde al mismo formulario; se emparejan columnas y no hay comparación de formularios | Un camino nuevo y más simple, pero deja fuera los casos en que las escalas o las preguntas difieren entre fuentes |
| C. Como hoy | En un estudio de varias bases, cada base tiene una fuente; lo demás se junta fuera de la app | Nada. El prototipo quitaría la segunda fuente de "Estudiantes" y "Agregar otra fuente" |

Gonzalo eligió la opción A el 2026-11-10 ("integrar por base"). El prototipo la dibuja: "Estudiantes" tiene una encuesta en línea y un Excel, con "61 de 63 preguntas emparejadas" y "4 escalas recodificadas". Se eligió porque reutiliza un motor que ya existe y quita una de las causas del diagnóstico: que el tipo de estudio cambie las pantallas de Carga. Consecuencias: "integrada" deja de ser un tipo de estudio y pasa a ser una base con varias fuentes; entre bases solo queda decidir si se comparan (equivalencias) o son independientes. El panel nuevo, "Agregar una fuente", tiene tres pasos (elegir, comparar con la base, unir): muestra las diferencias por resolver, las preguntas emparejadas, si algo impide unir, y la variable que dice de qué fuente viene cada caso. No se midió el esfuerzo; antes de implementar, `guardian-contratos` revisa cómo se guarda la integración por base en el `.pulso` y qué pasa en Analítica, que hoy supone una base única para todo lo que depende del origen.

## 10. Fases

| # | Fase | Contenido | Depende de |
|---|---|---|---|
| F0 | Limpieza | Código que nadie monta, vocabulario, `window.confirm`, copys con estudios concretos | nada |
| F1 | Columna común | Base activa única con `base=`, estados con causa, cabecera, Estado del estudio | D7 |
| F2 | Carga | Bases, Agregar base, Actualizar fuente, Variables | D1, D2, D8, D9 |
| F3 | Validación | Reglas con su panel de regla propia y el conteo previo, reglas sin evaluar, Hallazgos, Cierre | D3, D11, D13 |
| F4 | Codificación | Preguntas, Codificar con arrastre y en tabla, Aplicar, tipo resultante observado y cambio a múltiple, retiro de Matrices | D4, D12, D14 |
| F5 | Analítica | Riel en grupos, Categorías, tablas con vista, Entrega, Comparativos | D5, D6 |

Cada fase cambia claves de pestaña: las viejas se leen como alias y no se escriben, como se hizo con Gráficos. Las fases F2 a F5 necesitan su maqueta por pestaña antes de implementarse.

## 11. Pendiente

- Revisión de Gonzalo, pestaña por pestaña, de las 21 maquetas.
- Al implementar los estados, mapear cada código `E_*` del registro de errores a su texto de causa y a su acción.
- Seguir afinando el acabado hasta el visto bueno de Gonzalo.
- Ver en pantalla una base integrada y una auditoría con hallazgos reales.
- Confirmar en el motor cómo se combinan el universo de Carga y "Qué casos cuentan" de Analítica antes de dibujar la cadena de casos.
- Leer en el motor qué hacen hoy "Sugerir códigos" y el agrupado de textos parecidos.
- Dibujar el panel del tipo "Combinación fuera de catálogo" y el estado del panel de regla con la base vacía.

## 12. Implementación

Gonzalo pidió implementar la propuesta en un loop indefinido con un tick cada 5 minutos (2026-11-10). El prototipo aprobado es el del artefacto citado arriba, con 52 pantallas.

**Decisiones tomadas en el loop (para revisión de Gonzalo).** A las tres preguntas de arranque contestó sin preferencia, así que las decidió la coordinación:

| # | Decisión | Motivo |
|---|---|---|
| 1 | El loop va sin consultas | Una pregunta frena el reloj hasta que vuelva. Lo irreversible (borrar una página, publicar, push) se detiene y queda como pendiente suyo |
| 2 | Interfaz primero, motor después | Las pantallas se implementan con lo que el motor ya entrega; los cambios de motor exigen instalar el paquete y relanzar backends |
| 3 | Una pantalla se da por buena cuando iguala a su prototipo en los cinco tamaños, mirando la captura, y pasa typecheck, las pruebas de su área y el Contrato de Superficie C1 a C4 | Es la vara que la propuesta ya usó en el prototipo |
| 4 | Validación va al final | Otra sesión tiene sin commitear cuatro archivos de esa sección |
| 5 | La pestaña Matrices no se borra sin su confirmación | Borrar una página exige doble confirmación y un ADR aceptado |
| 6 | En Carga no se añade el selector de base de la banda, aunque el prototipo lo dibuja | El código tiene una regla escrita: todas las secciones llevan selector de base menos Carga, que es donde se dan de alta |

**Tablero de implementación.**

| Etapa | Alcance | Estado |
|---|---|---|
| P0 | Preparación: inventario de qué componente renderiza hoy cada pestaña, archivos congelados, línea base de gates y ADR propuesto del mapa de pestañas | hecho el 2026-11-10: ADR 0142 en Propuesto; typecheck en verde; contratos transversales 811 de 812, con un rojo ajeno (comillas angulares en dos archivos de Validación que otra sesión tiene sin commitear) |
| P1 | Piezas compartidas del kit, en `frontend/src/components/procesamiento/`: franja de recorrido, ficha de pregunta, frase de regla, pie con efecto y cifra de hallazgo. El error con causa es una extensión compatible de `ErrorBlock`. El esqueleto, la barra de avance, el sondeo de trabajos y el estado vacío ya existían y se reutilizan | hecho el 2026-11-10: 39 pruebas, typecheck en verde, contratos transversales 812 de 813 con el mismo rojo ajeno, veredicto PASA del verificador. Sin ver dentro de la app: se montan desde P2 |
| P2 | Columna común: cifras de cabecera sin repetir, selector de base común y "Estado del estudio" con lo que la app ya expone | hecho el 2026-11-10 (`f3a7c42fd`). `/procesamiento` muestra "Estado del estudio": una fila por base con sus cinco fases, tomadas del estado que el estudio ya publica por base, y el panel "Por hacer". Los rótulos son literales porque el dato dice que la fase tiene trabajo, no que terminó: "Cargada" o "Incompleta", "Iniciada" o "Por iniciar", "Aplicada", "Con informe" o "Sin informe". Codificación usa el selector de base de la banda. Ninguna cabecera de pestaña mostraba cifras, así que no había repetición que quitar. Comprobado con una, cuatro y nueve bases y con un grupo repetido, entre 1710x1107 y 1024x600; typecheck en verde, 285 pruebas del alcance y gate del área 892 de 893 con el rojo ajeno de la línea base. Queda fuera: el selector común en Validación (va con P6), el botón "Estado del estudio" en la banda, "Agregar base", "Aprobar para informe" y "Actualizar fuentes". Sin ver en vivo: los estados de vacío, error y carga de la página, y el uso con teclado |
| P3 | Codificación: Preguntas, Codificar (tarjetas y tabla) y Aplicar | en curso. Hecha la vista de tabla de Codificar (`9a931f42b`) y corregidos dos defectos anteriores (`d6379d0ad`): el texto de las respuestas abiertas se mostraba cortado en la preposición "a", y el contador de codificadas usaba una base distinta de su total. Hecha Preguntas (`4455684b4`): lista de unidades con bloques por tipo de pregunta (pieza nueva del kit, `116b65e82`) e inspector; abre en "Con texto"; emparejar da lo mismo por arrastre o por selector; el diálogo que queda solo pregunta cuál pregunta recibe los códigos. No tiene la columna de tipo resultante ni el anillo de avance del prototipo, que dependen del motor, ni el filtro de cerradas con "Otro", porque el motor solo informa las opciones de las preguntas múltiples. Hecha Aplicar (`7ab22e65a`): franja de recorrido, preguntas por aplicar con selección, tabla de códigos de la pregunta elegida y pie con el efecto; "adaptar" pasa a "aplicar" y "base adaptada" a "base codificada" en lo que lee el usuario. Matriz para el cliente, registro y respaldo siguen en Matrices. Las dos se vieron dentro de la app con proyectos de referencia a 1440x1000 y 1366x768 en tres pasadas, y lo encontrado se corrigió: entre ello, una pareja que dejaba de verse cuando el texto recibía los códigos (`8802bc9ed`) y el nombre del campo partido a media palabra (`60a9993bb`). La cifra de respuestas de una pareja coincide con la que lista Codificar. En curso: Codificar con tarjetas y arrastre (incluye la altura útil de la lista y un contador que queda en "26 de 27" sin filas pendientes). Queda: los rótulos de las pestañas en el catálogo ("Preguntas", "Aplicar") y el diálogo "Cambiar texto", que conserva los pasos numerados. El retiro de Matrices está bloqueado por la decisión 5. Los identificadores internos con "adaptad" se conservan porque cambiarlos obliga a migrar los `.pulso` guardados |
| P4 | Carga: Bases, Revisión, Variables, Equivalencias, Formulario, Respuestas y el panel de actualizar | pendiente |
| P5 | Analítica: las ocho pestañas en tres grupos | en curso. Hecha Ponderación (`fb48b4d54`): dos columnas a todo el alto, "Muestra frente a población" a la izquierda y "Efecto de ponderar" y "Ajustes" a la derecha; cada cifra en un solo sitio y con su base escrita; categorías con su etiqueta y su código. Ningún cálculo cambió (revisión metodológica contra el motor). El efecto ahora se vuelve a calcular al cambiar el universo de análisis, la base activa o la versión de la base; comprobado dentro de la app: con "Cuentan 426 de 1,283 casos" el panel dice "de 426 casos" en menos de un segundo, cerrando el panel con el botón, con Escape o con un clic fuera. Quedan fuera por falta de dato del motor el margen de error al 95 % y el peso por categoría. Sin flechas todavía los segmentados "De dónde sale el peso" y "Población". Pendientes: el riel en grupos y las otras siete pestañas |
| P6 | Validación: Explorar, Reglas con su panel, Hallazgos por tipo y Cierre | en espera por la decisión 4 |
| P7 | Estados de carga, trabajo en curso y error en las cuatro secciones | pendiente |
| M1 a M12 | Motor | en curso. Hechos: el nombre de los archivos que entrega la codificación aplicada, "Base_codificada" y "Formulario_codificado" (M9, `2cb28b093`), y la redacción de los avisos de ponderación, con tildes, comillas rectas y sin jerga, revisada frase por frase contra lo que el motor hace (M11, `ae352e43f`); el backend en ejecución no los ve hasta relanzarlo y los trabajos en segundo plano hasta reinstalar el paquete. En curso: la vista previa real de las tablas de frecuencias, calculada con las mismas funciones que escriben el archivo (M12). Pendientes: conteo previo de una regla (M1), caso completo (M2), pareja de las respuestas casi iguales (M3), D8 (M4), D12 (M5), D13 (M6), D9 (M7), el detalle por fase y por base de "Estado del estudio" (M8) y las metas en porcentaje sin población total, que el motor lee como conteos (M10) |

**Pendiente de Gonzalo:** aceptar el ADR 0142, que retira diez direcciones de pestaña, entre ellas Matrices. Mientras esté en Propuesto no se borra ninguna.
