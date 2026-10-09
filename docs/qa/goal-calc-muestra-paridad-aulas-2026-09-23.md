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
| E4 | Sorteo en Muestra general | ☑ | [ADR 0090](../adrs/0090-muestra-general-sortea-de-un-marco-real.md) (aceptado) |
| E5 | Sorteo por actor en Acreditación | ☑ | modalidad por técnica (probabilística / censo / sin π) |
| E6 | Entrega | ☑ | XLSX con memoria sustituida; reporte con memoria y sorteo |
| E7 | Intuitividad | ☑ | recorrido real de usuario nuevo de punta a punta; fricciones F-a…F-g cerradas |
| E8 | Monte Carlo a escala | ☑ | insesgado; error ≤ e 94,8–98,1 %; IC95 93,4–99,5 % |
| E9 | Regresión de aulas | ☑ | [hsvg2026 idéntico](regresion-aulas-hsvg2026-2026-09-24.md) |
| E10 | Traspaso territorial | ☑ | la mesa Territorial deriva a Hojas de ruta |
| E11 | Paridad estética y de accesibilidad con aulas | ☑ | [checklist](checklist-calc-muestra-paridad-visual-2026-09-24.md) V1–V17 (V5, V10 ◐); QA visual 3 rondas, ronda 3 `ok=true` geometría 0 |
| E12 | Egresados con la regla por precisión | ☑ | 27d2d2607; censo hasta 385, MAS ±5 % desde 386; ADR 0091 ampliado |
| E13 | Defectos propios de aulas (baseline visual) | ☑ | 9d97a94cd; A1–A7 del [checklist de cierre](checklist-calc-muestra-cierre-2026-09-24.md) |
| E14 | Deuda de E11 y barra sin atajos | ☑ | c12e02a90; D1, D3, B1 (Reporte en Resultados, Cambiar tipo en la ficha), indicador de guardado honesto |

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
- Se puede dimensionar para una media (ingreso, horas) con error relativo y
  el coeficiente de variación, y el estratificado ofrece la asignación de
  potencia (Bankier) para proteger a los estratos chicos.
- La entrega dice cómo estimar la varianza según el método de sorteo.
- Libro XLSX (Corrida, Memoria, Estratos, Listado) y reporte con la memoria y
  el sorteo.

## Defectos del motor que el loop encontró (todos cerrados)

La tasa de respuesta no inflaba n · el reparto sumaba mal y vaciaba el estrato
mayor · el piso pasaba de N_h · deff 1,5 inventado en el estratificado ·
valores fuera de rango corregidos en silencio · π por estrato reciclada · ids
numéricos en notación científica · π redondeada a 4 decimales en el wire ·
subir un CSV desde la app daba 400 (y dos respaldos de multipart nunca
funcionaron) · Neyman dejaba estratos vacíos.

## Decisiones de Gonzalo (2026-09-24)

Respuesta textual: «1. Si 2. Si 3. Definir dos, acueros previos que se hayan
hecho o la muestra continua que porpones».

1. **Reparto en aulas → mayor resto.** `distribuir_proporcional_pesos`
   reparte por mayor resto en sus dos modos (`cuadratura` y
   `round_residuo_controlado`), igual que el motor general. Antes de
   adoptarlo se midió sobre hsvg2026: sus dos componentes, 15 estratos, aulas
   por estrato y la distribución por facultad y sexo salían idénticos (31
   llamadas al reparto).
2. **ADR 0090 ratificado**, reservas por lote incluidas.
3. **Cuadro maestro de acreditación → corte por precisión**
   ([ADR 0091](../adrs/0091-el-cuadro-de-acreditacion-corta-por-precision.md)).
   Primero se aplicó el acuerdo previo (documento PULSO de marzo 2026: 1 800
   fijos para estudiantes con N ≥ 3001), pero un n fijo degrada el margen con
   N (±3,1 % con 20 000). Gonzalo, después: «Para el tres mejor haz lo que
   estadísticamente sea más válido, no me hagas mucho caso sobre lo que te
   dije». Regla final: censo mientras la muestra a la precisión canónica
   pediría ≥ 60 %; desde ahí, el n de esa precisión.

   | Estudiantes (aula/QR) | técnica | completas | a campo | margen |
   |---|---|---|---|---|
   | N = 2.000 | cobertura censal 60 % | 1.200 | 2.000 | — |
   | N = 2.050 | conglomerado | 1.230 | 1.845 | ±2,5 % |
   | N = 3.000 / 3.001 | conglomerado | 1.519 / 1.519 | 2.279 | ±2,5 % |
   | N = 20.000 | conglomerado | 2.665 | 3.998 | ±2,5 % |

   | Docentes | técnica | completas | a campo | margen |
   |---|---|---|---|---|
   | N = 250 | cobertura censal 60 % | 150 | 250 | — |
   | N = 258 | MAS | 155 | 258 | ±5 % |
   | N = 1.000 | MAS | 278 | 464 | ±5 % |

   Muestra monótona, salto ≤ 1 entre N y N + 1, un único cambio de técnica.
   H16 (la inferencia fija la técnica) queda: la mesa no ofrece selector y
   rotula el origen. Egresados entró después con la misma regla (E12:
   censo hasta N = 385, MAS a ±5 % desde 386).

## Abierto

- Research: todo cerrado o descartado con motivo. H21 (medias), H24
  (potencia) y H28 (varianza) implementados; H25 y H26 no aplican (el sorteo
  aísla su RNG; la inflación de cuotas ya sigue la regla común); H27 no
  aplica (el recomendador no tiene consumidor en la UI).
- Cerrado (947e1c7e4): con una media la tabla de estratos ya no pide la p
  de cada estrato (`usaProporcionPorEstrato` mira `tipo_indicador`).
- Medido y descartado: π a 4 decimales en rutas de aulas no deforma nada en
  hsvg2026 ([medición](pi-wire-aulas-hsvg2026-2026-09-24.md)).
- Tarea aparte: test del respaldo multipart de monitoreo.
