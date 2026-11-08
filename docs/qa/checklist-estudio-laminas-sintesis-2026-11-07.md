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
| 1 | Función pura de selección por regla (todas las de escala, N de mayor diferencia, distancia o Sin información, umbral bajo X, comunes entre públicos), con el texto de la regla para la nota | `graficos_regla_preguntas.R`, `POST /api/graficos/resumenes/regla` | Hecho; verificado con Arte real (157 preguntas, como el PDF) |
| 2 | Lámina de resumen Fortalezas y alertas: especificación pura, lámina nativa, test | `p_fortalezas` | Hecho; nativa con rótulos largos reales (render revisado) |
| 3 | Lámina de resumen Cobertura y participación: padrón y meta desde Cálculo de muestra o Monitoreo cuando exista | `p_cobertura`, `GET /api/graficos/resumenes/padron` | Hecho; Arte real 115/279/85 = PDF |
| 4 | Lámina de resumen Cierre con hallazgos: toma cifras de otras láminas, no recalcula | `p_slide_cierre_hallazgos`, `laminas/cierreHallazgos/` | Hecho; QA en Arte: cifras vivas del panorama, vista previa «16 de 73», láminas de origen con nombre propio (a891cdd47) |
| 5 | Lámina de Tendencia | Fuera de este encargo (decisión 3) | Fuera |
| 6 | Títulos sugeridos | No se hacen (decisión 2) | Fuera |
| 7 | Selector por intención con miniaturas y la clase de cada tipo; «Ver por tipo de gráfico» como entrada secundaria | `laminas/selectores/intencionesContar.ts` | Hecho; QA visual 1440x1000 y 1024x600 sin hallazgos |
| 8 | Inspector uniforme Datos, Cálculo, Aspecto: primero los del resumen, luego los de uso general; cada control con rótulo y «?» | `DatosGrafico.tsx`, `gruposTarjeta.ts` | Hecho; visto en Arte real |
| 9 | Control de regla con conteo en vivo y ajuste a mano de la lista | `laminas/reglaPreguntas/` | Hecho; probado a mano en Arte real (163→157 de 157, interruptores por pregunta) |
| 10 | Grupos internos hasta cuatro, con padrón e interruptor de padrón confiable | `laminas/gruposPadron/`, `universos_no_confiables` | Hecho; QA en Arte: grupos con respuesta encendidos solos, padrón, base en vivo, «Grupo chico: 24 docentes TC», lámina nativa de 10 filas (ac3019f9a, 33c08f04e, 34376bf7c) |
| 11 | Revisión del emparejado entre públicos: matriz de equivalencias, sugerido por texto para confirmar, sin par | `laminas/emparejado/`, `POST /api/graficos/resumenes/emparejado` (enmienda ADR 0104) | Hecho; QA en Arte: 133 / 104 / 29, confirmar funciona, sin recortes en 1440x1000 y 1024x600 (aab67f816) |
| 12 | Mazo «Resumen ejecutivo»: propone las láminas en orden con sus reglas; aceptar, editar o quitar | `laminas/mazoResumen/`, `panel=resumen-ejecutivo` | Hecho; QA visual sin hallazgos e insertado en Arte (10 láminas) y acrconta (7) |
| 13 | Mejoras a la maqueta que aparezcan al construir, dichas a Gonzalo; si cambia, publicar y regenerar la copia local | Maqueta `graficos-sintesis` | Copia local regenerada; publicar bloqueado: el artefacto es de otra cuenta |
| 14 | Renderizar láminas reales con las cifras de Arte y compararlas al lado del PDF | QA con `Arte_v1-12` (copia) | Hecho: panorama, cobertura, contraste y escala coinciden; diferencias explicadas abajo |
| 15 | Armar el resumen desde cero con `/ver-ui` en acrconta y otro proyecto de referencia | QA en pila aislada | Hecho en Arte (3 públicos) y acrconta (1 público) |
| 16 | `make gate-area`, `make gate-front AREA=graficos`, agente verificador | QA | Hecho: verificador APROBADO CON PENDIENTES (typecheck, gate-front 347/2951, gate-area 97 suites 6938 pass) |

Diferencias con el PDF de Arte, explicadas:

- Mediana de estudiantes 85% frente a 84%: con 60 preguntas es el promedio de las dos centrales, redondeado arriba.
- Mediana de administrativos 72% frente a 76%: el PDF tomó el elemento central superior a mano.
- La escala con varios públicos parte de 145 preguntas y no de 157: 12 usan otra escala de respuestas y quedan fuera
  de esa lámina. Deuda declarada.

Aprendido:


- La escala pintaba «No tengo información suficiente» con código 9 como el verde más oscuro (acuerdo): sólo reconocía como especial los códigos 90 a 99. Tras seis revisiones metodológicas el detector decide sólo por lista declarada, 90 a 99 o rótulo de no respuesta (el rango de códigos dejó de decidir porque cada heurística rompía otro caso), con regla de hermanos para raíces ambiguas, y el reparto sin declarar es la mitad por lado. Aprobado el 2026-11-07 (f88160102).
- En Arte entraban como escala tres preguntas demográficas de docentes (edad, grado, categoría), dos de estudiantes y una de administrativos: ahora una pregunta es de escala si su lista forma batería o el estudio la declara ordinal (2a89266fc).

- La rama base `claude/vigilant-poitras-f29198` nació el 2026-10-28 y estaba 2046 commits detrás de `main`. Se integró
  `main` en `claude/estudio-laminas-sintesis`. El número 0114 ya estaba tomado en `main`, así que el ADR del resumen
  ejecutivo pasó a 0134.
- En esta app una ola es una base del proyecto. En acrconta, 2021 no es una base: son cifras agregadas en `Matriz-2.xlsx`
  y en el mazo. Quien retome Tendencia debe decidir si admite cifras tecleadas de otra ola.
