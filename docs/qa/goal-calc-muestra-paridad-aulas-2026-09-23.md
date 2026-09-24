# GOAL — Cálculo de muestra con paridad de aulas (loop de septiembre 2026)

Tipo: Registro QA fechado
Estado: Vigente
Fecha: 2026-09-24
Autoridad: Estado del loop; no reemplaza contratos ejecutables ni ADR aceptados

Loop indefinido abierto por Gonzalo el 2026-09-23. Sólo él lo cierra.

## Encargo y vara

- «configuremos un loop indefinido para ver el modulo de calculo de muestra
  validando que todo esta operativo, que funciones bien y que sea una
  herramienta para calculo y seleccion de muestra ideal.»
- «tienes que hacer muchisimos research para asegurarte de que sea
  estadisticamente robusto, asi como intuitivo.»
- «Guiate de apartados bastante desarrollados como calculo de muestra de aulas.»
- Territorial: «recuerda que territorial tiene su propio modulo» → vive en
  Hojas de ruta; aquí sólo se verifica el traspaso.

**Vara (aprobada):** «Cada modo calcula un n que cuadra con la fórmula de
referencia, sortea unidades de un marco real con semilla reproducible,
publica π y pesos, y entrega memoria de cálculo + listado — y un usuario nuevo
lo recorre sin ayuda.» Aplica a Muestra general y Acreditación; aulas es el
patrón y no cambia sus cifras.

## Tablero

| # | Etapa | Estado | Evidencia |
|---|---|---|---|
| E0 | Baseline (gates + recorrido visual) | ☑ | gate R 3568/0 · front 241/2185 · hallazgos G1–G6, A1–A2 |
| E1 | Research metodológico | ☑ | [research](research-calc-muestra-robustez-2026-09-23.md), 28 hallazgos |
| E2 | Fórmulas del motor general | ☑ | no respuesta, tope N, reparto por mayor resto, deff, avisos; verificador aprobado |
| E3 | Estratificado por estrato y Neyman | ☑ | Cochran 5.25/5.26; verificador aprobado; [Monte Carlo](montecarlo-muestra-general-2026-09-24.md) |
| E4 | Sorteo en Muestra general | ☑ | [ADR 0090](../adrs/0090-muestra-general-sortea-de-un-marco-real.md) (propuesto) |
| E5 | Sorteo por actor en Acreditación | ☑ | modalidad por técnica (probabilística / censo / sin π) |
| E6 | Entrega | ☑ | XLSX con memoria sustituida; reporte con memoria y sorteo |
| E7 | Intuitividad | ◐ | recorrido real de usuario nuevo hecho; fricciones F-a/c/d/e/f en curso |
| E8 | Monte Carlo a escala | ☑ | insesgado; error ≤ e 94,8–98,1 %; IC95 93,4–99,5 % |
| E9 | Regresión de aulas | ☑ | [hsvg2026 idéntico](regresion-aulas-hsvg2026-2026-09-24.md) |
| E10 | Traspaso territorial | ☑ | la mesa Territorial deriva a Hojas de ruta |

## Qué cambió para el usuario

- Muestra general carga su marco como archivo (id, estrato, tamaño); el N del
  cálculo sale del archivo.
- Sorteo reproducible (MAS, sistemático fraccional, PPS con certezas,
  estratificado) con π y peso por unidad, reservas como réplicas por lote,
  ficha de la corrida con semilla, RNG, run_id y huellas.
- Método muestra sólo los parámetros que la técnica consume, la confianza en
  90/95/99 %, los valores corregidos con su aviso y la memoria de cálculo.
- El estratificado usa la proporción de cada estrato y ofrece Neyman: en un
  marco de 5.000 con p .1/.3/.5/.7 el n baja de 537 a 407.
- Acreditación sortea por actor desde su propia sección.
- Libro XLSX (Corrida, Memoria, Estratos, Listado) y reporte con la memoria y
  el sorteo.

## Defectos del motor que el loop encontró (todos cerrados)

La tasa de respuesta no inflaba n · el reparto sumaba mal y vaciaba el estrato
mayor · el piso pasaba de N_h · deff 1,5 inventado en el estratificado ·
valores fuera de rango corregidos en silencio · π por estrato reciclada · ids
numéricos en notación científica · π redondeada a 4 decimales en el wire ·
subir un CSV desde la app daba 400 (y dos respaldos de multipart nunca
funcionaron) · Neyman dejaba estratos vacíos.

## Decisiones pendientes de Gonzalo

1. **Reparto en aulas** (research H01): llevar el mayor resto también a aulas
   (cambia cifras de corridas nuevas; se mediría el delta en hsvg2026) o
   dejarlo sólo en el motor general. Mientras tanto: sólo general.
2. **Ratificar el ADR 0090**, sobre todo las reservas como réplicas liberadas
   por lote en vez de reemplazos por puntaje.
3. **Reglas del cuadro maestro de acreditación** (research H16–H18): el salto
   de n entre N=3000 y 3001 en estudiantes, docentes con N ≥ 251 a cuotas aun
   con nómina completa, y que la inferencia sobrescriba la técnica elegida.
4. (Informativa) un conglomerado de aulas con p = 0 o 1 ya no da n = 0.

## Abierto

- Fricciones de UI del recorrido real: F-a (tarjetas del selector truncadas),
  F-c (id no propuesto para «codigo»), F-d (texto de memoria engañoso), F-e
  (ficha «MAS» en un estratificado Neyman), F-f («Estratificado
  proporcional» con Neyman).
- Research sin tocar: H21 (n para medias y error relativo), H24 (asignación de
  potencia), H25–H28 (bajos). H27 no aplica: el recomendador no tiene
  consumidor en la UI.
- Tareas aparte: π a 4 decimales en rutas de aulas; test del respaldo
  multipart de monitoreo.
