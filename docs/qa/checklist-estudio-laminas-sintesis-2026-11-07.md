# Checklist: estudio de láminas de síntesis (2026-11-07)

Tipo: Checklist de trabajo
Estado: Vigente
Fecha: 2026-11-07
Autoridad: Encargo de Gonzalo del 2026-11-07, implementar la propuesta de láminas de síntesis; ADR 0134; maqueta `graficos-sintesis`

Pedido: que un analista arme desde cero un resumen ejecutivo profesional sin rehacer gráficos a mano y sin saber de
antemano cómo se llama cada tipo. Sólo Gonzalo da el checklist por terminado.

Decisiones de Gonzalo al empezar (2026-11-07):

1. Entra primero el selector «Resumir el estudio»; el mazo se monta encima, dentro de este encargo.
2. Los títulos los escribe siempre el analista. **No hay títulos sugeridos.**
3. La lámina de tendencia queda **fuera de este encargo** y su tarjeta no aparece.
4. El emparejado entre públicos vuelve a sugerir por el texto, para confirmar fila por fila (enmienda el ADR 0104 en Gráficos; ADR 0135 punto 7).
5. Las cifras del Cierre son referencia viva a su lámina de origen.
6. Gonzalo: «Sigue con el loop indefinido y no hagas más preguntas, usa el criterio». Desde aquí las decisiones de producto las toma el lead y quedan anotadas en el ADR 0135.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Función pura de selección por regla (todas las de escala, N de mayor diferencia, distancia o Sin información, umbral bajo X, comunes entre públicos), con el texto de la regla para la nota | `api/R/graficos_regla_preguntas.R` (ADR 0135 §2-3) | En curso |
| 2 | Lámina de resumen Fortalezas y alertas: especificación pura, lámina nativa, test | motor, por definir | Pendiente |
| 3 | Lámina de resumen Cobertura y participación: padrón y meta desde Cálculo de muestra o Monitoreo cuando exista | motor, por definir | Pendiente |
| 4 | Lámina de resumen Cierre con hallazgos: toma cifras de otras láminas, no recalcula | motor, por definir | Pendiente |
| 5 | Lámina de Tendencia | Fuera de este encargo (decisión 3) | Fuera |
| 6 | Títulos sugeridos | No se hacen (decisión 2) | Fuera |
| 7 | Selector por intención con miniaturas y la clase de cada tipo; «Ver por tipo de gráfico» como entrada secundaria | `laminas/selectores/` | En curso |
| 8 | Inspector uniforme Datos, Cálculo, Aspecto: primero los del resumen, luego los de uso general; cada control con rótulo y «?» | `DatosGrafico.tsx`, `gruposTarjeta.ts` | En curso |
| 9 | Control de regla con conteo en vivo y ajuste a mano de la lista | Gráficos, por definir | Pendiente |
| 10 | Grupos internos hasta cuatro, con padrón e interruptor de padrón confiable | Gráficos, por definir | Pendiente |
| 11 | Revisión del emparejado entre públicos: matriz de equivalencias, sugerido por texto para confirmar, sin par | Gráficos, ADR 0135 §7 (enmienda 0104) | Pendiente |
| 12 | Mazo «Resumen ejecutivo»: propone las láminas en orden con sus reglas; aceptar, editar o quitar | Gráficos, por definir | Pendiente |
| 13 | Mejoras a la maqueta que aparezcan al construir, dichas a Gonzalo; si cambia, publicar y regenerar la copia local | Maqueta `graficos-sintesis` | Pendiente |
| 14 | Renderizar láminas reales con las cifras de Arte y compararlas al lado del PDF | QA | Pendiente |
| 15 | Armar el resumen desde cero con `/ver-ui` en acrconta y otro proyecto de referencia | QA | Pendiente |
| 16 | `make gate-area`, `make gate-front AREA=graficos`, agente verificador | QA | Pendiente |

Aprendido:

- La rama base `claude/vigilant-poitras-f29198` nació el 2026-10-28 y estaba 2046 commits detrás de `main`. Se integró
  `main` en `claude/estudio-laminas-sintesis`. El número 0114 ya estaba tomado en `main`, así que el ADR del resumen
  ejecutivo pasó a 0134.
- En esta app una ola es una base del proyecto. En acrconta, 2021 no es una base: son cifras agregadas en `Matriz-2.xlsx`
  y en el mazo. Quien retome Tendencia debe decidir si admite cifras tecleadas de otra ola.
