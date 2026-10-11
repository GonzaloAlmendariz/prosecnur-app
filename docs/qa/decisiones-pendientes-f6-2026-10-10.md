# Decisiones pendientes de Gonzalo — loop F6 (motor nativo y editor de Gráficos)

Tipo: Registro de decisiones pendientes
Estado: En curso
Fecha: 2026-10-10
Autoridad: Recomendaciones del lead; decide Gonzalo

Esperando respuesta. Cada fila trae la recomendación del lead; basta contestar con el código
y «sí», «no» u otra opción («D3 sí, D7 descendente»). Lo que no dependa de estas respuestas ya está hecho y verificado.

## Bloque A — operación (desbloquean el uso en la app)

| Código | Pregunta | Recomendación | Qué bloquea |
|---|---|---|---|
| A1 | ¿Reinstalo el paquete R (`R CMD INSTALL`)? Los jobs de la app usan el paquete instalado (0.8.0) y no ven nada de lo hecho hoy. | Sí, con la app cerrada o sin exportaciones en curso. | Que la app exporte con el motor nuevo; el Word con `documento_word` falla hasta reinstalar. |
| A2 | ¿Reemplazo el fixture `acrconta_mazo` por la versión con Top Two Box declarado (carpeta local `n8/fixture/`)? | Sí. | 22 escalas sin Top Two Box en el mazo de referencia. |
| A3 | Release de Windows: ¿P8 (añadir `msitools` y `gcab` en `release.yml`) o revertir `f073f9eb9` antes de pushear? | P8. | Sin uno de los dos, `build-windows` falla y stable no publica. |

## Bloque B — base y metodología (docs/qa/hallazgo-base-ponderada-2026-10-10.md)

| Código | Pregunta | Recomendación |
|---|---|---|
| S1 | ¿La base es el n sin ponderar también en los tabulados XLSX, o sólo en láminas y Word? | Sólo láminas y Word. |
| S2 | ¿La ponderación se declara una vez por documento («Cómo leer» y ficha técnica)? | Sí. |
| S3 | ¿El umbral de bases chicas usa el n sin ponderar? | Sí. |
| S4 | ¿Se renombra «Base ponderada (n_eff = X)» a «Resultados ponderados (n efectivo = X)»? | Sí. |
| D11 | ¿La lámina de población nativa lleva «Base: 52 docentes» al pie, como el recetario p162/p164? | Sí. Además devuelve la vista al detector de «público cruzado» (B6), hoy ciego en la población nativa. |
| D12 | ¿Las láminas de población aplican la regla de menos de 30 casos («12 de 15»)? | Sí, como el recetario p132/p195. |

## Bloque C — orden de categorías

| Código | Pregunta | Recomendación |
|---|---|---|
| D1 | En una multilista, ¿las baterías sin actores se ordenan por Top Two Box (recetario p146/p224), en PPT y Word a la vez? | Sí, en la espec (para que el Word lo herede). |
| D5 | Los rangos de edad de acrconta salen en desorden (30–35 antes que 22–25) porque su instrumento adaptado es anterior al arreglo de codificación del 11-08. ¿Re-codifico el fixture o declaro el orden por lista en Analítica? | Re-codificar el fixture. |
| D6 | ¿Normalizo al cargar las listas `_recod` numéricas de proyectos codificados antes del 11-08 (con aviso y ADR)? | Sí, por código numérico, nunca por etiqueta. |
| D7 | Dirección de los rangos: el recetario p162 muestra docentes de mayor a menor; la codificación los deja de menor a mayor. ¿Cuál manda? | La que declare cada instrumento; ajustar la página del recetario si hace falta. |
| D8 | Nominales de más de dos categorías: ¿por frecuencia con «Otro» al final (p152) o en orden del instrumento? | Por frecuencia, como p152. |
| D9 | «Invertir orden» hoy es un artefacto de cómo dibuja ggplot. ¿Lo redefino en F6.1 como «invertir el orden de lectura» (falso por defecto), migrando los `.pulso` con ADR? | Sí. |
| D15 | La regla de residuales reconoce por prefijo y manda al final respuestas con contenido («Otro(a)s estudiantes me aconsejaron que no denuncie» en hsvg2026; «Otros países…», «Ninguna dificultad»). ¿Cierro la regla (palabra suelta o seguida de paréntesis/coma) o la acepto documentada? | Cerrarla. |

## Bloque D — láminas y plan

| Código | Pregunta | Recomendación |
|---|---|---|
| D2 | En una «(cont.)» con sólo algunos públicos, ¿el pie nombra sólo los presentes o repite el completo (p186–188)? | Repetir el completo, como el recetario. |
| D3 | ¿Aceptas que 6 multilistas de acrconta pasen de 1 a 2 láminas para seguir el recetario? | Sí. |
| D4 | Una torta de dos porciones dentro de una población de 4: ¿se dibuja como dicotomía (p164)? Cambia el tipo de gráfico elegido. | Sí, con aviso. |
| D10 | Paneles mal puestos en el plan de acrconta: lámina 9 (sexo con título «¿Se encuentra trabajando?»), 10 y 11 (panel de docentes en la de administrativos). ¿Los corriges tú en el `.pulso`? | Sí; el motor no debe adivinarlos. |
| D13 | Índice que no declara capítulos: ¿se toman de los separadores del plan (13, como p35)? | Sí. |
| D14 | Títulos del plan en MAYÚSCULAS que no caben en la columna del índice: ¿bajar la letra, dos líneas o tipo oración? | Tipo oración (es lo que dibuja el recetario). |
| D16 | El radar nativo omite «% De acuerdo + Totalmente de Acuerdo»: ¿lo pongo como subtítulo? | Sí. |
| D17 | Guías magenta en láminas por la ruta anterior: ¿la salida al cliente ignora las guías de depuración, o limpias la config del proyecto? | Ignorarlas en la salida (encaja con F6.1: «se van»). |

## Bloque E — editor (F6.1)

| Código | Pregunta | Recomendación |
|---|---|---|
| E1 | ¿El inspector abre por defecto en Gráficos o en Contenido? | Contenido. |
| E2 | ¿La composición del índice y del cierre va también en Estilo del cliente? | Sí. |

## Respuestas de Gonzalo (2026-10-10)

Principio, textual: «el recetario siempre manda; si algo va a cambiar en el recetario, cambia en los defaults por
defecto de la app; es como la constitución o como el libro de reglas de todos los defaults de la app».

| Código | Respuesta textual | Qué se hace |
|---|---|---|
| A1 | «A1 sí, reinstala el paquete» | Hecho (R CMD INSTALL OK) |
| K5 | «Sí, pero de manera profesional; quizás hasta más adelante podemos añadir más ejemplos con un recetario más pulido» | Empaquetar los ejemplos del recetario en la app con un formato extensible (catálogo por página, versionado), listo para crecer con un recetario más pulido |
| K6 | «El de Pulso es por defecto, pero te da la opción de subir los tuyos propios también» | Logos de PULSO por defecto; el cliente puede subir los suyos (estilo del cliente con procedencia «Del recetario» / «Propio») |
| Sello | «Vamos con lo que diga el recetario; el recetario es y seguirá siendo la fuente de verdad» | El sello «Del recetario» usa el azul del recetario (`--pulso-recetario-azul`), no el teal del módulo |
| Tipografía | «No, el recetario siempre manda» | No se registra la excepción 12,5/11,5: se usan los tamaños de la escala vigente (12/11); los defaults salen del recetario y de la identidad, no de la maqueta |
| Íconos | «Sí» | Pliego de muestras a 16/20/24 para aprobar antes de dibujar los 59 |
| E2 | (sin respuesta) | Provisional: composición en el inspector de cada lámina |
| FODA | «Sí, sácalo» | `p_dim_foda` no aparece en el recetario: sale del selector de tipos de gráfico; se sigue dibujando en planes que ya lo usan |
| Variantes | «De acuerdo» | Un ícono por tipo del recetario (55), sin marcas por variante; las variantes se eligen en el inspector con miniaturas |
| Corona | «Manda el recetario» | `p_slide_3_graficos_poblacion_corona` toma las ranuras dibujadas en la p. 160 (dos gráficos arriba + uno ancho abajo); se corrige `estandar_pulso.json` y se regeneran los íconos |
| Población antigua | «Sí, bórralos, porque en el recetario tampoco están ya» | `p_slide_2/3/4_graficos_poblacion` (ícono en medio de los gráficos): salen del selector; los planes existentes se migran al tipo vigente equivalente (2 gráficos, 3 en fila, 4 gráficos) con aviso; el código se borra después de la migración, con ADR (regla de borrados con doble confirmación) |
| Movimiento reducido | «Redúcelo como sea más conveniente, pero lo normal es que alguien no tenga esa configuración activada y que todas las animaciones y desplazamientos funcionen bien» | Con «Reducir movimiento» del sistema activo: sin desplazamientos, con fundidos y cambios de color suaves (se cambia la regla global de theme.css); sin la opción, todas las animaciones del contrato de movimiento F6 |
| K15 | «sí» (2026-10-10, ~18:47) | Alinear `estandar_pulso.json` y el motor con lo dibujado en las láminas de ejemplo del recetario en los 12 tipos con desfase (texto izq/der p140/p142, tipos 3, 4, 11, 13, 16, 18, 19, 20, 21, 22, ficha p159), con medición antes/después por tipo; se regeneran íconos si cambian ranuras |
| D8 | «ambas opciones deben ser posibles e incluso debe permitir orden personalizado» | Orden de categorías por gráfico con tres modos: por frecuencia, como el instrumento y personalizado (lista arrastrable). Por defecto, el que dibuja el recetario para ese tipo (principio «el recetario manda»). Vale en PPT y Word; se integra con «invertir orden» (D9) |
| Fichas | «sí, regenera las fichas del recetario» (2026-10-10, ~20:25) | `recetario_fichas.R` toma sus valores de `exportar_estandar.R` (K15) y se regenera `recetario-moderna.pptx`; diff visual por página antes/después. Se hace cuando termine el verificador de K15, que mide contra ese mismo archivo |
| Lote de decisiones 2026-10-11 | «1a, 2c, 3 sí, 4 sí, 5a, 6-12 ok, 13 todo ok» (2026-10-11, ~05:50 Perú) | Ver las filas siguientes; numeración de la lista entregada en el chat de la Meta A |
| 1 Default Word en el proyecto | «1a» | El `.pulso` guarda solo las diferencias contra `DEFAULT_WORD_PRESETS`; lo no tocado sigue al default de la app (si el recetario cambia, el proyecto lo hereda). Requiere ADR y revisión de `guardian-contratos` |
| 2 Batería con Bottom Two Box | «2c» | Según el largo de las premisas: corta → filas (lámina 97 del recetario); larga → bloque de premisas (221/222). El umbral lo fija el motor y se documenta |
| 3 Dependencias de prueba | «3 sí» | `jsdom` + `@testing-library/react` como devDependencies del frontend; `package.json` se comparte con la Meta B → se avisa en «Pedidos a B» |
| 4 Avisos en categorías | «4 sí» | Campo `avisos` en la respuesta de `/api/graficos/categorias` (contrato §7 del orden de categorías) |
| 5 «Modificado» en Word | «5a» | Se marca contra el default de la app, no contra lo último guardado |
| 6 Aviso de íconos | «ok» | El aviso nombra el ícono por su nombre del catálogo; nunca muestra el id |
| 7 Pendiente heredado «A3 release Windows» | «ok» | f073f9eb9 no existe en main: el pendiente «P8 o revertir f073f9eb9 antes de push» del loop anterior se cierra sin trabajo. No afecta a la etapa A3 «Guías del visor por capas», que sigue pendiente |
| 8 Rama | «ok» | Se sigue en `claude/meta-a-graficos-loop-f6-a0rabk` |
| 9 Reloj | «ok» | Cadencia de 180 s se mantiene |
| 10 Paridad A0 | «ok» | C1–C55 es la lista de paridad; C25 y C54 se retiran; C11 y C12 van al menú ⋯ de Láminas |
| 11 P2 | «ok» | Multilista con bloque sin variable: igual que el export |
| 12 Radar «arriba» | «ok» | La leyenda arriba pasa abajo sin aviso (manda lo dibujado) |
| 13 Heredadas | «13 todo ok» | Se adoptan todas las recomendaciones de este doc y de `hallazgo-base-ponderada-2026-10-10.md`: S1–S4, D1–D7, D9–D17 (D17: la salida ignora las guías de depuración), E1 (el inspector abre en Contenido), E2 (provisional en el inspector), etiquetas cortas por categoría, «Masculino (33)» y plantilla ACNUR. D6 y D9 con ADR |
| Lote de decisiones 14–26 (2026-10-11) | «14.Por base o por proyecto, depende del usuario. 15. a 16. si, a. 17. Ahi hay que tenrr cuidado porque tmabien depende de la amtriz de equivalencias en procesamiento. 18.a 19. a 20. a. 21. a apagadas, pero si seria interesante tener ocmo un featuray mostrarlas porque el recetairo ya tiene una forma de hacerlo pero por defecto no. 22. a pero permtirle hacerle cambios si lo considera neecsario 23. a. 24. a pero es solo una opcion por defecto apagada. 25. no hacerlo automatico, avisar. 26. a» (~08:20 Perú) | Ver filas siguientes |
| 14 Ámbito de `estilo_cliente` | «Por base o por proyecto, depende del usuario» | El usuario elige el ámbito (por base o por proyecto) en Estilo del cliente; A6 R3 lo modela como opción explícita, no como regla fija |
| 15 Perfil de letra K13 | «a» | Por proyecto, con el default del perfil del catálogo; no se guarda entre proyectos |
| 16 Logo propio en el PPT | «si, a» | Sí, en una rebanada posterior vía la plantilla, sin crecer `reporte_plan_ppt.R` |
| 17 «Armar desde…» en consolidado | «hay que tener cuidado porque también depende de la matriz de equivalencias en procesamiento» | Sin decisión cerrada: sigue deshabilitado con motivo (provisional) hasta estudiar cómo la matriz de equivalencias de Procesamiento alimenta el plan compartido; ningún endpoint nuevo antes de ese estudio |
| 18 Conflicto de revisión del borrador compartido | «a» | Recargar el borrador con aviso explícito |
| 19 Evidencia de consolidado y `/ppt-all` | «a» | Corrida en vivo ahora sobre un proyecto temporal `independent_siblings` rehecho desde los `.sav` de acrconta_mazo, sin commitear; el séptimo proyecto de referencia queda como deuda |
| 20 Compartir en consolidado | «a» | Deshabilitado con motivo |
| 21 Láminas de «Otros» automáticas | «a apagadas, pero sí sería interesante tener como un feature y mostrarlas porque el recetario ya tiene una forma de hacerlo pero por defecto no» | Apagadas por defecto; el interruptor queda como feature visible y las láminas de «Otros» deben salir con la forma que dibuja el recetario (ubicar esa lámina en el recetario y alinear el motor) |
| 22 Índice desde los capítulos | «a pero permitirle hacerle cambios si lo considera necesario» | Botón explícito «Tomar los capítulos del informe» + aviso de desfase; el analista puede editar el índice resultante |
| 23 Migrar `iconos_focos` | «a» | Sí, con la composición explícita para que la salida no cambie |
| 24 Fila Total por actores | «a pero es solo una opción por defecto apagada» | La fila Total es una opción apagada por defecto; cuando se enciende: misma base → suma de pesos, varias bases → casos sin ponderar |
| 25 Declarar la ponderación sin el sello por lámina | «no hacerlo automático, avisar» | No se enciende nada solo: un entregable ponderado que no declara su ponderación (sin «Cómo leer» ni ficha) da una advertencia al exportar |
| 26 Fallback «Base sin ponderar (ponderación configurada no aplicada)» | «a» | Pasa al nivel del documento con una advertencia de la corrida |

