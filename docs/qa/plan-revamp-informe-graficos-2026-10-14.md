# Plan · rediseño de Vista general, Identidad, Estilo del informe y Word

Tipo: Plan y checklist de diseño
Estado: Vigente
Fecha: 2026-10-14
Autoridad: Gonzalo (2026-10-14): «vamos a diseñar Vista general, Identidad y Estilo de informe, necesitamos un revamp completo y planificarlo conceptualmente y a nivel de UI»; «el Word también falta muchísimo con la UI, y vista general como en el PPT de LibreOffice y cómo se vería en Word con diseño elegante». Sólo Gonzalo da por terminado un ítem

Propuesta con maquetas: https://claude.ai/artifact/8vtEx3LmE5V92FfqXxN8ZH (privada).

## Concepto

Cada pestaña responde una pregunta del analista y cada ajuste vive en un solo lugar:

- **Informe** (hoy Vista general): ¿cómo queda lo que voy a entregar? Vista PowerPoint (clasificador con miniaturas reales y estado por lámina) y vista Word (páginas A4).
- **Identidad**: ¿de quién es y cómo se ve? Línea visual, colores de las respuestas, logos, letra, íconos, con muestra viva.
- **Reglas** (hoy Estilo del informe): ¿qué dicen las cifras? Redondeo, casos, texto de la base, «Otros», nota de redondeo, cada una con su «cómo se lee».
- **Word**: ¿cómo sale como documento? Piezas del documento primero; sólo los tipos de gráfico que usa el informe.

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
| F1 | Informe, vista PowerPoint | bloqueado por D1 |
| F2 | Informe, vista Word | bloqueado por D2 |
| F3 | Identidad | bloqueado por D3 y D5 |
| F4 | Reglas | bloqueado por D1 y D4 |
| F5 | Word | pendiente de F2 |

## Decisiones

| # | Decisión | Propuesta | Estado |
|---|---|---|---|
| D1 | Nombres de las pestañas | Láminas · Informe · Identidad · Reglas · Word | bloqueado (decide Gonzalo) |
| D2 | Fidelidad de la vista Word | páginas compuestas en la app + «Ver el Word real» bajo pedido | bloqueado (decide Gonzalo) |
| D3 | Lugar de la línea visual | Identidad | bloqueado (decide Gonzalo) |
| D4 | «Otros» como regla del informe | pasa a Reglas, texto corregido | bloqueado (decide Gonzalo) |
| D5 | Logos y letra en el PPT | llevarlos o marcarlos «Sólo Word» | bloqueado (decide Gonzalo; decisión 16 de `decisiones-pendientes-f6-2026-10-10.md`) |
