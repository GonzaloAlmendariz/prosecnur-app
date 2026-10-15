# Plan · rediseño de Vista general, Identidad, Estilo del informe y Word

Tipo: Plan y checklist de diseño
Estado: Vigente
Fecha: 2026-10-14
Autoridad: Gonzalo (2026-10-14): «vamos a diseñar Vista general, Identidad y Estilo de informe, necesitamos un revamp completo y planificarlo conceptualmente y a nivel de UI»; «el Word también falta muchísimo con la UI, y vista general como en el PPT de LibreOffice y cómo se vería en Word con diseño elegante». Sólo Gonzalo da por terminado un ítem

Propuesta con maquetas: https://claude.ai/artifact/8vtEx3LmE5V92FfqXxN8ZH (privada).

## Concepto

Cada pestaña responde una pregunta del analista y cada ajuste vive en un solo lugar:

- **Informe** (hoy Vista general): ¿está bien armado lo que voy a entregar? Vista de **maquetas** (decisión de Gonzalo, 2026-10-14: «para la vista de informe el énfasis no es cómo se ve en PowerPoint sino las maquetas; el cómo se ve en PowerPoint se queda en Lámina y el botón cambia a "Previsualizar"») y vista Word en **maquetas de página** (portada, índice, capítulos, figuras numeradas con su glifo y su pie). El Word real sólo se previsualiza en la pestaña Word (Gonzalo, 2026-10-14: «para el Word es igual, con un sistema de maquetas que se muestran de forma elegante, pero que sólo se puede previsualizar en la subtab de Word; para Informe es sólo una maqueta profesional»). En cada tarjeta, el ícono del tipo de lámina va en la cabecera y el del tipo de gráfico dentro de su espacio, junto a su pregunta («los íconos de tipo de lámina y tipo de gráficos tienen que estar mejor puestos»).
- **Identidad**: ¿de quién es y cómo se ve? Línea visual, colores de las respuestas, logos, letra, íconos, con muestra viva.
- **Reglas** (hoy Estilo del informe): ¿qué dicen las cifras? Redondeo y decimales (método estándar o reparto a 100 %, sin decimales o un decimal, nota al pie), casos, texto de la base y «Otros», cada una con su «cómo se lee». Jerarquía explícita (Gonzalo, 2026-10-14: «en redondeo no estás poniendo las distintas posibilidades y en reglas no especificas las reglas generales y la posibilidad de tener una regla por gráfico en específico»): **informe › tipo de gráfico › un gráfico**, manda la más específica, y cada regla lista debajo los tipos y los gráficos que tienen la suya.
  - Hoy existen: método por tipo (apiladas, multiapiladas, categóricas, torta, dona), decimales por tipo (también respuesta múltiple, brechas y series, que no suman 100 %), casos por gráfico (agrupadas, torta, dona: `CasosGrafico.tsx`), nombre de cada público por gráfico (`NombresPorBase.tsx`), decimales por gráfico sólo en radar y media y rango.
  - Nuevo en la propuesta: método y decimales por gráfico para cualquier tipo. «Otros» sólo por informe.
  - Nota al pie de redondeo (Gonzalo, 2026-10-14: «indicar cuál va a ser la nota al pie y que podría aplicarse siempre o sólo si el gráfico no suma 100 %»): tres opciones, «Nunca», «Sólo si una barra no suma 100 %» (nuevo; hoy `.calculos_aplicar_nota` la pone en toda lámina con porcentajes si el interruptor está encendido) y «Siempre». Con el reparto a 100 % la opción condicional no aplica. La UI muestra el texto exacto de `.calculos_nota_texto` al pie de una lámina de ejemplo.
- **Word**: ¿cómo sale como documento? Piezas del documento primero; sólo los tipos de gráfico que usa el informe; «Previsualizar» genera el Word real y lo muestra por páginas.
  - Multiapiladas en el Word en tres formas (Gonzalo, 2026-10-14: «que todas las multiapiladas vayan en un gráfico, que vayan por temas o que cada barra sea un gráfico independiente»): un solo gráfico, un gráfico por tema, un gráfico por barra. El motor del Word hoy sólo hace la primera (`reporte_word_graficos_escala.R`); las otras dos son motor nuevo.

Las maquetas de página del Word siguen la convención de `docs/qa/motor-ppt-2026-10-06/4-recetario/propuesta-word.docx`: encabezado corrido con filete, títulos numerados («5.4.») en sans azul, cada gráfico sin marco con «Gráfico N» en negrita, la pregunta en cursiva encima y al pie la base y la fuente centradas; portada con PUCP a la izquierda y PULSO PUCP a la derecha, título azul y filete coral corto. Las maquetas usan los glifos e íconos de la app (`glifosGrafico.tsx`, `IconoTipo`), no dibujos propios.

## Fallas encontradas en el inventario (F0)

| # | Falla | Dónde vive | Estado |
|---|---|---|---|
| L1 | El interruptor «Otros» dice que el Word no las lleva; el motor sí las mete (`reporte_word_otros.R`, `router_graficos.R:3350`) | `vistaGeneral/interruptorOtrosModel.ts:11` | pendiente |
| L2 | Identidad se apaga entera en el compartido y con ella los colores de las respuestas, que valen para el PPT | `estilo/disponibilidadEstilo.ts` | pendiente |
| L3 | Código que nadie pinta: `SeccionWordRecetario.tsx`, `VistaPreviaWord.tsx`, cálculos sin uso en `PestanaEstiloInforme.tsx`, `documento_word` sin interfaz | `estilo/`, `estiloInforme/`, `word/` | pendiente (borrar exige confirmación) |
| L4 | La línea visual no se puede quitar salvo con Deshacer (`modificado={false}` fijo) | `estiloInforme/SeccionLineaVisual.tsx` | pendiente |
| L5 | Ayudas desfasadas: «estilo del cliente», «Cálculos o Paletas» | catálogo de navegación, Línea visual | pendiente |

## Fases

| # | Fase | Estado |
|---|---|---|
| F0 | Limpieza L1–L5 | pendiente |
| F1 | Informe, vista de maquetas (íconos de lámina en la cabecera, de gráfico en su espacio) | bloqueado por D1 |
| F1a | Botón «Previsualizar» en Láminas (antes «Ver cómo queda») | hecho, por verificar (019d0ad83) |
| F2 | Informe, vista Word en maquetas de página | bloqueado por D1 |
| F3 | Identidad | bloqueado por D3 y D5 |
| F4 | Reglas | bloqueado por D1 y D4 |
| F5 | Word: piezas del documento, gráficos del informe, multiapiladas en uno / por tema / por barra y «Previsualizar» del Word real | pendiente de F2 y D6 |

## Decisiones

| # | Decisión | Propuesta | Estado |
|---|---|---|---|
| D1 | Nombres de las pestañas | Láminas · Word · Informe · Identidad · Reglas (orden fijado por Gonzalo, 2026-10-14: «Láminas y Word deberían ir uno detrás de otro y luego lo demás»; los nombres siguen por decidir) | orden resuelto; nombres bloqueados (decide Gonzalo) |
| D2 | Fidelidad de la vista Word | maquetas de página en el Informe; Word real sólo en la pestaña Word con «Previsualizar» | **resuelta** (Gonzalo, 2026-10-14) |
| D3 | Lugar de la línea visual | Identidad | bloqueado (decide Gonzalo) |
| D4 | «Otros» como regla del informe | pasa a Reglas, texto corregido | bloqueado (decide Gonzalo) |
| D5 | Logos y letra en el PPT | llevarlos o marcarlos «Sólo Word» | bloqueado (decide Gonzalo; decisión 16 de `decisiones-pendientes-f6-2026-10-10.md`) |
| D6 | Multiapiladas en el Word: ¿una forma para todo el informe o por lámina con una por defecto? | por lámina, con «Un gráfico por tema» como valor del informe | bloqueado (decide Gonzalo) |
