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
| 1 | Función pura de selección por regla (todas las de escala, N de mayor diferencia, distancia o Sin información, umbral bajo X, comunes entre públicos), con el texto de la regla para la nota | `api/R/graficos_regla_preguntas.R`, `graficos_regla_indicadores.R`, `POST /api/graficos/resumenes/regla` (8aed0ca4d) | Hecho en motor; falta verlo en la UI |
| 2 | Lámina de resumen Fortalezas y alertas: especificación pura, lámina nativa, test | `p_fortalezas` (01caf81bf, 712d6e45d), render revisado | Hecho en motor; falta verlo en la UI |
| 3 | Lámina de resumen Cobertura y participación: padrón y meta desde Cálculo de muestra o Monitoreo cuando exista | `p_cobertura`, `.graficos_padron_por_base`, `GET /api/graficos/resumenes/padron` (4fafa0817), render revisado contra Arte p. 2 | Hecho en motor; falta verlo en la UI |
| 4 | Lámina de resumen Cierre con hallazgos: toma cifras de otras láminas, no recalcula | `p_slide_cierre_hallazgos` (a70a9369b), UI `laminas/cierreHallazgos/` (a96275795) | Hecho; falta QA visual y vista previa vacía |
| 5 | Lámina de Tendencia | Fuera de este encargo (decisión 3) | Fuera |
| 6 | Títulos sugeridos | No se hacen (decisión 2) | Fuera |
| 7 | Selector por intención con miniaturas y la clase de cada tipo; «Ver por tipo de gráfico» como entrada secundaria | `laminas/selectores/intencionesContar.ts` (acdb1f589) | Hecho; falta QA visual |
| 8 | Inspector uniforme Datos, Cálculo, Aspecto: primero los del resumen, luego los de uso general; cada control con rótulo y «?» | `DatosGrafico.tsx`, `gruposTarjeta.ts` (e7cc5e4fe); quedan ayudas por pasar al «?» | Hecho en parte; falta QA visual |
| 9 | Control de regla con conteo en vivo y ajuste a mano de la lista | `laminas/reglaPreguntas/` (703a4a64a) | Hecho; falta QA interactiva |
| 10 | Grupos internos hasta cuatro, con padrón e interruptor de padrón confiable | `laminas/gruposPadron/` (4076c434b, e718eec9f); arg `universos_no_confiables` en motor en curso | Hecho en UI; falta QA visual |
| 11 | Revisión del emparejado entre públicos: matriz de equivalencias, sugerido por texto para confirmar, sin par | `POST /api/graficos/resumenes/emparejado` (1e7571138), `laminas/emparejado/` (28699273d) | Hecho; falta QA visual |
| 12 | Mazo «Resumen ejecutivo»: propone las láminas en orden con sus reglas; aceptar, editar o quitar | `laminas/mazoResumen/`, `panel=resumen-ejecutivo` (bea24a026) | Hecho; falta QA visual e interactiva |
| 13 | Mejoras a la maqueta que aparezcan al construir, dichas a Gonzalo; si cambia, publicar y regenerar la copia local | Maqueta `graficos-sintesis` | Pendiente |
| 14 | Renderizar láminas reales con las cifras de Arte y compararlas al lado del PDF | QA en pila aislada con `Arte_v1-12` (copia) | En curso: cobertura igual al PDF (115/279/85); panorama difiere por preguntas demográficas que entran como escala (corrección en curso) |
| 15 | Armar el resumen desde cero con `/ver-ui` en acrconta y otro proyecto de referencia | QA | En curso: mazo armado e insertado sobre Arte real; 13 hallazgos repartidos; falta acrconta |
| 16 | `make gate-area`, `make gate-front AREA=graficos`, agente verificador | QA | Pendiente |

Aprendido:

- La escala pintaba «No tengo información suficiente» con código 9 como el verde más oscuro (acuerdo): sólo reconocía como especial los códigos 90 a 99. Tras seis revisiones metodológicas el detector decide sólo por lista declarada, 90 a 99 o rótulo de no respuesta (el rango de códigos dejó de decidir porque cada heurística rompía otro caso), con regla de hermanos para raíces ambiguas, y el reparto sin declarar es la mitad por lado. Aprobado el 2026-11-07 (f88160102).
- En Arte entraban como escala tres preguntas demográficas de docentes (edad, grado, categoría), dos de estudiantes y una de administrativos: ahora una pregunta es de escala si su lista forma batería o el estudio la declara ordinal (2a89266fc).

- La rama base `claude/vigilant-poitras-f29198` nació el 2026-10-28 y estaba 2046 commits detrás de `main`. Se integró
  `main` en `claude/estudio-laminas-sintesis`. El número 0114 ya estaba tomado en `main`, así que el ADR del resumen
  ejecutivo pasó a 0134.
- En esta app una ola es una base del proyecto. En acrconta, 2021 no es una base: son cifras agregadas en `Matriz-2.xlsx`
  y en el mazo. Quien retome Tendencia debe decidir si admite cifras tecleadas de otra ola.
