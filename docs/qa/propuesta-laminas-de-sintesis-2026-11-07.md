# Propuesta: láminas de síntesis que se piden por la pregunta del estudio

Tipo: Propuesta de diseño
Estado: En curso
Fecha: 2026-11-07
Autoridad: Gonzalo, 2026-11-07, tras ver los gráficos del resumen ejecutivo en el motor: «algo que todavía le falta a la aplicación es tener slides o tipos de gráficos que traten de resumir información que no solo abarque un par de variables, sino muestre tendencias… no hay intuitividad en torno a qué tan fácil es hacerlo… y creo que ahí es precisamente el fallo». Relacionada con [ADR 0114](../adrs/0114-los-graficos-del-resumen-ejecutivo-son-nativos.md)

## Lo que se vio en la app (acrconta, Procesamiento › Gráficos, 2026-11-07)

1. **Se elige por forma, no por pregunta.** El selector de lámina pregunta «¿Qué quieres mostrar?» (una pregunta, dos juntas, varias de un tema, cifras, un mensaje, estructura) y el de gráfico agrupa por familia (Categorías, Escalas, Números, Comparar…). No hay ninguna entrada para «resumir el estudio», «dónde están las brechas» o «qué cambió»: quien quiere un cierre tiene que saber de antemano que eso se llama «Panorama de públicos» o «Brecha entre dos grupos» con estilo «Contraste de públicos».
2. **Las preguntas se agregan una por una.** La tarjeta del panorama ofrece «Agregar pregunta… base_1 · 87 disponibles», una por vez, de una sola base y mezclando consentimiento, edad, código y escalas. Un panorama de tres públicos con 60, 73 y 24 preguntas pide 157 clics. `base$*` existe en el motor pero la tarjeta no lo ofrece. La brecha entre bases pide la pareja de cada tema a mano.
3. **El estilo que define la lámina está escondido.** En la brecha, «Estilo: Recetario» aparece debajo del rótulo del corte; nada en el selector dice que existe la versión del resumen ejecutivo.
4. **El placeholder no dice qué falta.** El panorama recién puesto dice «Falta elegir la pregunta», en singular, cuando lo que pide es un conjunto de preguntas.
5. **El mazo «Reporte ejecutivo (10 láminas)» es estructural**: portada, índice y bloques de texto y gráficos sueltos. No arma ninguna lámina de síntesis.

## Principio

**El analista dice qué pregunta quiere contestar; el motor propone las preguntas, el orden y el gráfico; el analista edita.** La selección de preguntas pasa a ser una **regla** declarada («todas las de escala», «las 10 de mayor brecha», «las que quedan bajo 60%», «las de mayor Sin información»), visible en la lámina («Se muestran las 10 de 47 preguntas con mayor diferencia») y recalculada si cambian los datos.

## Las láminas de síntesis

| Pregunta del estudio | Lámina | Regla de selección por defecto | Estado |
|---|---|---|---|
| ¿Cómo valora cada público el servicio, en conjunto? | Panorama de públicos | todas las preguntas de escala de cada base | Motor listo (ADR 0114); falta la regla en la UI |
| ¿En qué preguntas difieren los públicos? | Contraste de públicos | preguntas comunes (matriz de equivalencias), las N de mayor diferencia | Motor listo; falta selección por regla y emparejado automático |
| ¿Qué queda bajo el umbral? | Escala con Sin información aparte | preguntas con Top Two Box bajo la referencia | Motor listo; falta la regla |
| ¿Qué se desconoce? | Escala ordenada por Sin información | las N de mayor Sin información | Motor listo; falta la regla |
| ¿Qué grupo interno es más crítico? | Aperturas internas | las N preguntas de mayor distancia entre grupos | Motor listo; falta la regla |
| ¿Qué cambió desde la medición anterior? | **Tendencia** (pendientes de dos o más olas, ordenadas por cambio) | preguntas comunes entre olas, las N de mayor cambio | Nuevo: hoy hay serie temporal por tema, no un resumen de tendencias |
| ¿Dónde está fuerte y dónde débil cada dimensión? | Mapa de calor dimensión × público | dimensiones de Analítica | Existe (heatmap por criterios) |
| ¿Cuál es el mensaje del estudio? | Cierre con 3 a 5 hallazgos, cada uno con su cifra | lo elige el analista desde las láminas anteriores | Nuevo: hoy «Cierre» es estructural |

## Cómo se vería en la UI

- Una entrada nueva en «¿Qué quieres mostrar?»: **Resumir el estudio**, con las preguntas de la tabla como opciones, cada una con su miniatura y una línea de «para qué sirve».
- La tarjeta abre con la **regla** ya puesta («Todas las preguntas de escala de: Docentes, Estudiantes, Administrativos») y un contador («157 preguntas»); se puede afinar a mano después.
- Un mazo **Resumen ejecutivo** que arma en orden: cobertura → panorama → brechas → bajo umbral → desconocimiento → aperturas → tendencia → cierre, con títulos sugeridos a partir de los datos («Los estudiantes valoran más; los docentes concentran las preguntas bajo 60%») que el analista corrige.

## Maqueta para aprobación

Gonzalo, 2026-11-07: «propón una vista moderna de UI para seleccionar tipos de gráficos… debe ser una propuesta coherente centrada en el producto… en la accesibilidad del analista de armarlas desde cero… debe estar en un artefacto para su aprobación». Maqueta: <https://claude.ai/artifact/QdTnLf95feciWxy2YDtt2X> (privada hasta que se comparta). Tres tableros: el estudio de láminas (eliges qué quieres contar, galería con miniaturas, regla de preguntas con conteo y lámina en vivo con título sugerido), el mazo «Resumen ejecutivo» en un clic y el catálogo de síntesis (existe, mejorada o nueva). Gonzalo («falta ver cómo se va a configurar en la UI, qué botones va a tener»): dos tableros más. Configurar la lámina en cuatro pasos (Públicos con orden e inversión de la resta y padrón; Preguntas con regla «las N de mayor diferencia», «diferencia de al menos X», «todas las comunes» o «a mano» y su lista con casillas; Indicador tocando las respuestas de la escala y qué hacer con «Sin información»; Aspecto con orden, dónde va la base, separador y títulos), con la lámina redibujándose en vivo. Y grupos internos (público, «dividir por», hasta cuatro grupos con padrón e interruptor de padrón confiable) más la revisión del emparejado entre públicos (matriz de equivalencias, sugerido por el texto para confirmar, sin par).

## Decisiones que necesita Gonzalo

1. ¿La entrada es una familia nueva en el selector («Resumir el estudio») o un mazo que arma todo de una vez? (Se pueden hacer las dos; la pregunta es cuál va primero.)
2. ¿Los títulos sugeridos los redacta el motor a partir de los datos, o el analista siempre escribe el título?
3. ¿La lámina de tendencia es prioritaria para el próximo estudio con dos olas, o va después de las demás?

Es trabajo de varias tandas: conviene abrirlo como GOAL (loop de convergencia) con este documento como norte y un estudio real (Arte y Diseño FG 2026) como banco de prueba.
