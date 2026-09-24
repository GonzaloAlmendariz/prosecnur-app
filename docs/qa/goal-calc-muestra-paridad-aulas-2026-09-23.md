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
| E7 | Intuitividad | ☑ | recorrido real de usuario nuevo de punta a punta; fricciones F-a…F-g cerradas |
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

## Decisiones pendientes de Gonzalo

1. **Reparto en aulas** (research H01): llevar el mayor resto también a aulas
   o dejarlo sólo en el motor general. Mientras tanto: sólo general.
   **Delta medido (2026-09-24) sobre hsvg2026:** sustituyendo el reparto de
   aulas por el mayor resto, los dos componentes, sus 15 estratos, las aulas
   por estrato y la distribución por facultad y sexo salen **idénticos** (la
   única diferencia es el sello `computed_at`); el reparto se llama 31 veces
   en ese cálculo. Adoptarlo no movería este estudio: sólo evitaría los casos
   patológicos (suma que no cierra, estrato mayor en cero) en marcos futuros.
   Script: `scratchpad/p1_delta_aulas.R` y `p1_delta_dist.R` del loop.
2. **Ratificar el ADR 0090**, sobre todo las reservas como réplicas liberadas
   por lote en vez de reemplazos por puntaje.
3. **Reglas del cuadro maestro de acreditación** (research H16–H18): el salto
   de n entre N=3000 y 3001 en estudiantes, docentes con N ≥ 251 a cuotas aun
   con nómina completa, y que la inferencia sobrescriba la técnica elegida.
   **Curva medida (2026-09-24):**

   | Estudiantes (aula/QR) | técnica | completas | a campo |
   |---|---|---|---|
   | N = 2.800 | cobertura censal 60 % | 1.680 | 2.800 |
   | N = 3.000 | cobertura censal 60 % | 1.800 | 3.000 |
   | N = 3.001 | conglomerado (±2,5 %, deff 2) | 1.519 | 2.279 |
   | N = 5.000 | conglomerado | 1.904 | 2.856 |

   Al cruzar 3.000 la población crece y la muestra **baja** (−281 completas,
   −721 contactos), y el censo al 60 % pide más casos que el diseño que sí da
   margen de error. Una regla continua cambiaría de técnica cerca de
   N ≈ 2.530, donde el 60 % de N iguala al n del conglomerado. En docentes,
   N = 250 es censo de 250 y N = 251 son cuotas de 150 (no probabilístico)
   aun con la nómina completa, que permitiría un MAS con margen. (El n a campo
   de esas cuotas superaba al marco —275 con N = 251—; eso era un defecto y
   ya está corregido.)
4. (Informativa) un conglomerado de aulas con p = 0 o 1 ya no da n = 0.

## Abierto

- Research: todo cerrado o descartado con motivo. H21 (medias), H24
  (potencia) y H28 (varianza) implementados; H25 y H26 no aplican (el sorteo
  aísla su RNG; la inflación de cuotas ya sigue la regla común); H27 no
  aplica (el recomendador no tiene consumidor en la UI).
- Menor: en una media la tabla de estratos todavía ofrece la columna de p
  (el motor la ignora en ese caso).
- Tareas aparte: π a 4 decimales en rutas de aulas; test del respaldo
  multipart de monitoreo.
