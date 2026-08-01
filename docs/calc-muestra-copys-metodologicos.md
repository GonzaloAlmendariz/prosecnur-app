# Copys estadísticos y metodológicos — recorrido "Muestra de aulas" (Cálculo de muestra)

**Fecha:** 2026-07-08
**Propósito:** reunir en un solo documento, sin necesidad de leer código, todo el contenido con carga estadística o metodológica que la app muestra al usuario en el recorrido "Muestra de aulas" (`frontend/src/features/calcMuestra/{universidad,didactica}/`), para que un metodólogo pueda revisarlo, corregirlo o aprobarlo.
**Alcance:** únicamente el recorrido "Muestra de aulas" (desk `universidad/` + capa didáctica `didactica/`). No incluye otros modos de Cálculo de muestra (territorial, EESS, etc.) ni copys puramente de navegación/UI sin contenido estadístico.
**Cómo marcar observaciones:** cada copy tiene un identificador `[C-##]`. Para observar un copy, cita su identificador y anota: (a) si el texto es correcto, impreciso o directamente erróneo, (b) la corrección propuesta si aplica, y (c) si falta o sobra una referencia a fuente. No es necesario tocar el código — las observaciones se centralizan en este documento o en el canal que use el equipo.

> Nota de método de esta extracción: las citas se tomaron leyendo directamente los archivos fuente (componentes `.tsx` en `universidad/` y `didactica/`, y `api/R/calc_muestra_engine.R` + `api/R/calc_muestra_aulas.R`). Las líneas indicadas son aproximadas al momento de esta extracción (2026-07-08); si el código se modifica después, los números de línea pueden desalinearse — el texto citado sigue siendo válido como referencia de contenido.

---

## Índice

- [A. Glosario de términos (componente `TerminoChip`)](#a-glosario-de-términos-componente-terminochip)
- [B. Fórmulas y captions (componente `FormulaLatex`)](#b-fórmulas-y-captions-componente-formulalatex)
- [C. Decision log del motor R (`/explicar` y endpoints relacionados)](#c-decision-log-del-motor-r-explicar-y-endpoints-relacionados)
- [D. Respaldos didácticos por pestaña — desk `universidad/`](#d-respaldos-didácticos-por-pestaña--desk-universidad)
  - [D.1 Definición](#d1-definición)
  - [D.2 Marco institucional](#d2-marco-institucional)
  - [D.3 Cálculo](#d3-cálculo)
  - [D.4 Aulas y selección](#d4-aulas-y-selección)
  - [D.5 Salida](#d5-salida)
- [E. Capa didáctica compartida y corpus narrativo](#e-capa-didáctica-compartida-y-corpus-narrativo)
- [F. Reporte metodológico (`ReporteMetodologicoCard` + plantillas Quarto)](#f-reporte-metodológico-reportemetodologicocard--plantillas-quarto)
- [Top 5 de mayor riesgo](#top-5-de-mayor-riesgo)

---

## A. Glosario de términos (componente `TerminoChip`)

Fuente única: `frontend/src/features/calcMuestra/universidad/ui/TerminoChip.tsx`. Cada chip busca en `GLOSARIO` (definido en `frontend/src/features/calcMuestra/didactica/referencia/corpus.ts:97-234`) el término cuyo `termino` empieza con el prefijo pasado como prop, y muestra `llano` + `tecnico` + (si se pasa) el valor vivo del motor. **Estas 15 entradas son la definición canónica de cada término en toda la app** — cualquier mención posterior del mismo término (en fórmulas, pestañas, popovers) remite a esta misma definición, no la repite.

Todas las entradas citan fuente del corpus (columna "Fuente corpus").

| # | Término (`GLOSARIO.termino`) | Definición llana | Definición técnica | Fuente corpus |
|---|---|---|---|---|
| C-A01 | **marco muestral** | "Es la lista completa de donde puedes elegir: todos los salones de clase (con sus alumnos matriculados) que existen en la universidad este semestre. Si un salón no está en la lista, nunca podrá salir sorteado." | "Registro exhaustivo de las unidades de muestreo disponibles. En estos estudios se construye a partir de la base de matrícula oficial del semestre, típicamente como dos bases relacionadas (alumno × curso-horario y curso-horario), depuradas con filtros de elegibilidad." | `metodologia-detallada` |
| C-A02 | **curso-horario** | "Un 'salón' concreto: la combinación de un curso, su sección, su día, su hora, su aula y su docente. Es la unidad que se sortea, porque ahí encuentras a 20-60 estudiantes juntos en un solo lugar y momento." | "Unidad primaria de muestreo del diseño por conglomerados de una etapa. Cada curso-horario agrupa a los estudiantes matriculados en esa sesión específica; la inferencia se realiza a nivel del universo de pregrado." | `propuesta-2026` |
| C-A03 | **estrato** | "Los 'cajones' en los que divides a la población antes de sortear, para asegurarte de que ningún grupo importante quede fuera. Aquí los cajones principales son facultad y sexo." | "Subdivisión de la población dentro de la cual se asigna y selecciona muestra de forma independiente. En los estudios de referencia se estratifica por facultad × sexo, con un estrato secundario operativo por tamaño de aula (G1 a G4)." | `propuesta-2026` |
| C-A04 | **cuota** | "La meta de encuestas que le toca a cada cajón. Si Derecho pesa 10.8% de la universidad, le toca aproximadamente 10.8% de la muestra, repartida entre hombres y mujeres según su composición real." | "Número de respuestas válidas asignado a cada combinación de estratos mediante asignación proporcional al tamaño poblacional, con redondeo hacia arriba en estratos pequeños para garantizar inferencia mínima. En un estudio de referencia se definieron 30 cuotas (15 facultades × 2 sexos)." | `metodologia-2025` |
| C-A05 | **p (proporción esperada)** | "Tu mejor apuesta sobre qué porcentaje de gente responderá 'sí' a la pregunta clave del estudio. Si no tienes ni idea, usas 0.50 (el peor caso, que exige la muestra más grande). Si un estudio anterior ya te dio una pista, puedes afinarla y ahorrar encuestas." | "Proporción poblacional asumida para el cálculo de varianza p(1-p). En los estudios de referencia se partió de p = 0.50 (máxima varianza) y se calibró a p = 0.30 en olas posteriores, al observarse una prevalencia del indicador principal de 30.2%. Pasar de 0.50 a 0.30 redujo la muestra teórica en ~8.5% al mismo margen de error." | `metodologia-2025` |
| C-A06 | **margen de error (e)** | "El 'más o menos' de tu resultado. Con e = ±2.5%, si obtienes 30%, el valor real de la población está muy probablemente entre 27.5% y 32.5%. Mientras más chico lo quieras, más encuestas necesitas." | "Semiamplitud del intervalo de confianza para una proporción. Los estudios de referencia usaron entre ±2.5% y ±5% según la representatividad buscada; con n = 2,500 sobre N = 22,037 el margen efectivo retrocalculado fue ±2.39%." | `metodologia-2025` |
| C-A07 | **nivel de confianza (z)** | "Cuánto quieres poder confiar en ese 'más o menos'. El estándar es 95%: si repitieras el estudio muchas veces, 95 de cada 100 veces el resultado caería dentro del margen." | "Probabilidad de cobertura del intervalo de confianza. Al 95% corresponde el valor crítico Z = 1.96 en la fórmula del tamaño muestral. Es el estándar en todos los estudios de referencia." | `metodologia-detallada` |
| C-A08 | **deff (efecto de diseño)** | "El 'castigo' estadístico por encuestar salones enteros en vez de personas al azar: los estudiantes que comparten un salón se parecen entre sí, así que 30 respuestas de una misma aula valen menos que 30 respuestas de 30 aulas distintas. Para compensar, agrandas la muestra." | "Razón entre la varianza del diseño por conglomerados y la de un muestreo aleatorio simple del mismo tamaño; refleja la correlación intra-aula. Los estudios de referencia usan deff = 2.0 como corrección estándar, lo que en la práctica duplica el componente de varianza en la fórmula." | `propuesta-2026` |
| C-A09 | **FPC (corrección por población finita)** | "Un descuento a tu favor: como la universidad no es infinita, encuestar a 2,500 de 22,000 ya cubre una porción apreciable del total, y eso te permite necesitar algo menos de muestra que si la población fuera enorme." | "Ajuste (N-n)/(N-1) que reduce la varianza estimada cuando la fracción de muestreo n/N no es despreciable. Está incorporado en la fórmula usada en los estudios de referencia a través del término (N-1)·e² del denominador." | `metodologia-2025` |
| C-A10 | **salto k** | "El ritmo del sorteo: si tienes 271 salones en una facultad y necesitas 39, ordenas la lista, sorteas un punto de partida y tomas un salón 'cada k' posiciones. Así la selección recorre toda la lista en vez de amontonarse." | "Intervalo del muestreo sistemático: k = floor(N_cursos_en_marco / aulas_a_coordinar), calculado por facultad. Se sortea un arranque aleatorio entre 0 y k con semilla fija y se toman las posiciones arranque, arranque + k, arranque + 2k, etc. La probabilidad de inclusión resultante es 1/k." | `propuesta-2026` |
| C-A11 | **pi (probabilidad de inclusión)** | "La probabilidad que tenía cada salón de salir sorteado. Se guarda junto a cada aula seleccionada como su 'partida de nacimiento': después sirve para reconstruir el sorteo y calcular pesos correctos." | "Probabilidad de que una unidad del marco entre a la muestra bajo el diseño; en selección sistemática equivale a 1/k dentro de su estrato. Los estudios de referencia preservan los campos `probabilidad` y `salto (k)` en la base operativa para trazabilidad y cálculo de factores de expansión." | `metodologia-2025` |
| C-A12 | **sobremuestra** | "El colchón: planificas más encuestas de las que necesitas porque en el camino habrá docentes que no den permiso, alumnos que falten y cuestionarios inválidos. En los estudios de referencia el colchón es del 50% (para una meta de 2,500 se prepara un techo de 3,750)." | "Cuota adicional sobre la muestra objetivo que cubre no respuesta y depuración posterior. Los estudios de referencia iniciaron con 100% y la calibraron a 50% tras verificar una cobertura de aulas de 93.5%; se materializa operativamente en bolsas de aulas de reemplazo priorizadas." | `metodologia-2025` |
| C-A13 | **tasa de rendimiento** | "De todos los alumnos elegibles matriculados en un salón, qué fracción termina entregando una encuesta válida el día de la visita. Combina tres cosas: que asistan, que acepten responder y que su cuestionario sea válido." | "Fracción de alumnos elegibles del curso-horario que aporta una respuesta válida: asistencia × aceptación intra-aula × validez del cuestionario. En la aplicación de referencia el promedio ponderado global fue 0.53 (3,296 respuestas sobre 6,232 elegibles en 194 aulas), con un rango por facultad de 0.39 (aulas masivas transversales) a 1.00 (facultades pequeñas)." | `propuesta-2026` |
| C-A14 | **cuota de aulas por facultad** | "Cuántos salones visitar en cada facultad. No basta un promedio único de la universidad: hay facultades con salones de 13 elegibles y otras con salones de 41, así que cada facultad se calcula con su propio tamaño de aula y su propia tasa de rendimiento." | "aulas_facultad = ceil(cuota_facultad / (promedio_matriculados_elegibles_facultad × tasa_rendimiento_facultad)). En el estudio de referencia el promedio de elegibles por aula varió de 12.9 a 41.4 según facultad, resultando en 170 aulas base." | `propuesta-2026` |
| C-A15 | **reemplazo (M1, M2, M3…)** | "El plan B ya sorteado: si un salón del plan principal falla (el docente no responde, cambió el horario), activas su 'gemelo' de la segunda lista, con el mismo perfil de facultad y tamaño. Nada se improvisa el día de campo." | "Bolsas de cursos-horario seleccionadas en cascada sobre el remanente del marco, con perfil equivalente a la muestra principal (M1). Se activan secuencialmente (M2, M3, …) ante fallas operativas; la cadena de sustituciones queda registrada para auditoría y ajuste de ponderadores." | `metodologia-2025` |
| C-A16 | **matriculados elegibles** | "No todos los matriculados de un salón cuentan para tu estudio: algunos son menores de edad o de otro nivel. Este número es el subconjunto que sí cumple los requisitos, y es el que debes usar para estimar cuántas respuestas te dará ese salón." | "Distinción entre `matriculados_total` (inscritos nominales del curso-horario) y `matriculados_poblacion` (subconjunto que cumple los criterios de la población objetivo: ≥18 años, pregrado, matrícula regular). Refinamiento incorporado en 2025 para no sobreestimar la cuota esperada por aula." | `metodologia-2025` |
| C-A17 | **ponderación (peso)** | "El ajuste final de la balanza: si un grupo quedó con menos encuestas de las planeadas, sus respuestas 'pesan' un poco más para que el total siga representando bien a la universidad. La mayoría de casos queda con peso 1 (sin ajuste)." | "Ajuste por celda facultad × sexo al cierre del campo: las celdas que sobrecumplen se recortan por downsample aleatorio con semilla fija (peso = 1) y las que no alcanzan la meta reciben peso = meta / n_cobrado (> 1). En el estudio de referencia el 83.6% de los casos quedó con peso 1.00 y el peso máximo fue 1.15." | `metodologia-2025` |

**Total sección A: 17 entradas de glosario**, todas con fuente del corpus.

### Sitios donde se invoca cada `TerminoChip` (primera explicación vs. referencia posterior)

Cada término se explica en detalle (con `TerminoChip` embebido en un párrafo) la primera vez que aparece en el recorrido; después solo se referencia como chip suelto. Mapa de invocaciones detectadas:

| Término | Primera explicación (párrafo completo) | Referencias posteriores (solo chip) |
|---|---|---|
| marco muestral | `DefBasesTab.tsx:392-395`, `AulasAuditoriaTab.tsx:84-102` (fórmula) | `DefBasesTab.tsx:84-90,93-100`, `MarcoAulasTab.tsx:66-71` |
| estrato | `DefVariablesTab.tsx:104-109`, `CalculoPropuestasTab.tsx:294-302` (fórmula) | `AulasAuditoriaTab.tsx:84-102` (fórmula) |
| curso-horario | `DefVariablesTab.tsx:104-109` | `MarcoAulasTab.tsx:66-71`, `AulasMetodoTab.tsx:50-63`, `CalculoSupuestosTab.tsx:345-396` (fórmula deff) |
| matriculados elegibles | `DefCategoriasTab.tsx:133-138` | `MarcoPoblacionTab.tsx:79-107` |
| tasa de rendimiento | `MarcoPoblacionTab.tsx:79-107` (con valor vivo) | `CalculoSupuestosTab.tsx:398-464` |
| deff | `ParametrosInteractivos.tsx:131` (control), `CalculoParametrosTab.tsx:163-168` (fórmula) | `CalculoSupuestosTab.tsx:345-396`, `AulasAuditoriaTab.tsx` |
| nivel de confianza (z) | `CalculoParametrosTab.tsx:151-160` (fórmula) | `CalculoSupuestosTab.tsx:279-312` |
| p (proporción esperada) | `CalculoParametrosTab.tsx:151-160` (fórmula) | `CalculoSupuestosTab.tsx:314-343` |
| margen de error (e) | `CalculoParametrosTab.tsx:151-160` (fórmula) | `CalculoSupuestosTab.tsx:279-312` |
| FPC (corrección por población finita) | `CalculoParametrosTab.tsx:171-176` (fórmula, term "N") | — |
| cuota de aulas por facultad | `AulasObjetivoTab.tsx:89-95` | — |
| reemplazo (M1, M2, M3…) | `AulasObjetivoTab.tsx:89-95` | `AulasReemplazosTab.tsx:148`, `CadenasReemplazoVisual.tsx:229-233` |
| salto k | `AulasMetodoTab.tsx:50-63` | `SaltoSistematicoRecta` (`AulasMetodoTab.tsx:129-176`), `SeleccionAulasVisual.tsx:178-183` |
| pi (probabilidad de inclusión) | `AulasMetodoTab.tsx:50-63` | `AulasAuditoriaTab.tsx:103-136`, `SeleccionAulasVisual.tsx:178-183` |
| ponderación (peso) | `AulasSimulacionTab.tsx:84-87` | `AulasAuditoriaTab.tsx:103-148` |
| sobremuestra | `CadenasReemplazoVisual.tsx:229-233` | `CalculoSupuestosTab.tsx:398-464` |
| cuota | `CalculoPropuestasTab.tsx:294-302` (fórmula) | — |

**Hallazgo de calidad de dato (no corregido, solo reportado):** en `AulasSeleccionTab`/`SeleccionAulasVisual.tsx:181` y en varios usos con prefijo `"pi (probabilidad"` (sin cerrar el paréntesis), el prop `termino` queda como `"pi (probabilidad"` — funciona porque `TerminoChip` usa `startsWith`, pero es un string con un paréntesis suelto que vale la pena limpiar en una revisión de código aparte (no es un problema de contenido metodológico, sino de higiene del literal).

---

## B. Fórmulas y captions (componente `FormulaLatex`)

Cada fórmula puede llevar `caption` (título corto), `expression` (LaTeX) y `terms` (chips de glosario con el valor vivo). El `badge` indica si los valores vienen del motor R validado (`validado`) o de un preview en TypeScript (`preview`).

### B.1 Pestaña Cálculo → Parámetros (`CalculoParametrosTab.tsx`)

| # | Ubicación | Caption | Expression | Terms |
|---|---|---|---|---|
| C-B01 | `:151-160` | "Paso 1 · Cuántas encuestas pide la estadística (Cochran)" | `n_0 = \dfrac{z^2\,p\,(1-p)}{e^2}` (con sustitución numérica cuando hay valores) | z → nivel de confianza; p → p (proporción); e → margen de error |
| C-B02 | `:163-168` | "Paso 2 · Castigo por encuestar aulas completas" | `n_{\mathit{deff}} = n_0 \cdot \mathit{deff}` | deff → deff |
| C-B03 | `:171-176` | "Paso 3 · Descuento por población finita (FPC)" | `n = \left\lceil \dfrac{n_{\mathit{deff}}}{1 + \frac{n_{\mathit{deff}} - 1}{N}} \right\rceil` | N → FPC (corrección por población finita) |

### B.2 Pestaña Cálculo → Propuestas (`CalculoPropuestasTab.tsx`)

| # | Ubicación | Caption | Expression | Terms |
|---|---|---|---|---|
| C-B04 | `:124-134` | "Fórmula del escenario (explicada paso a paso en Parámetros)" | `n=\dfrac{N\,z^2\,p\,(1-p)\,\mathit{deff}}{(N-1)\,e^2+z^2\,p\,(1-p)\,\mathit{deff}}` | N → marco muestral; z → nivel de confianza; p → p (proporción); e → margen de error; deff → deff |
| C-B05 | `:294-302` | "Afijación proporcional: cada facultad aporta según su peso en el marco" (badge `validado` fijo en el código) | `n_h = n \cdot \tfrac{N_h}{N}` | n_h → cuota; N_h → estrato |

Además, texto de apoyo directo sobre el piso mínimo del n (no es fórmula pero es afirmación cuantitativa fuerte):
- **C-B06** (`CalculoPropuestasTab.tsx:169`): "No puedes pedir menos que el n de fórmula" (título de popover).
- **C-B07** (`CalculoPropuestasTab.tsx:171-173`): "El n de fórmula es el mínimo que garantiza el margen de error y la confianza prometidos. Puedes redondear hacia arriba o fijar una meta mayor, pero un n menor rompería la precisión del diseño y no se puede aplicar."
- **C-B08** (`CalculoPropuestasTab.tsx:198`): "El n final no puede ser menor al mínimo calculado."

### B.3 Pestaña Cálculo → Supuestos (`CalculoSupuestosTab.tsx`)

| # | Ubicación | Caption | Expression | Terms |
|---|---|---|---|---|
| C-B09 | `:345-396` (bloque deff) | "De dónde sale el deff aplicado" | `\mathit{deff} = 1 + (\bar{m} - 1)\,\rho` | m̄ → curso-horario; ρ → deff |
| C-B10 | `:398-464` (bloque tasa de rendimiento) | "Lectura operativa sobre el n objetivo validado por la calculadora" (o "Se llena con el primer cálculo validado" si aún no hay dato) | `n_{\mathit{campo}} = \left\lceil \dfrac{n}{\tau} \right\rceil` | τ → tasa de rendimiento; sobremuestra → sobremuestra |

Notas cuantitativas asociadas a estas fórmulas (afirmaciones con carga estadística, sin ser fórmula per se):
- **C-B11** (`:302-312`, nota visual de z): `"z = {z} cubre ≈{confianza%}% de la campana: solo el {1−confianza%}% más extremo queda fuera."`
- **C-B12** (`:314-343`, nota visual de p): `"La varianza p·(1−p) es máxima en 0.5; con p = {p} el diseño trabaja con {4p(1-p)×100}% de esa exigencia."`
- **C-B13** (`:345-396`, nota deff): `"Con deff = {deff}, las {n_referencia} encuestas del diseño aportan la información de ≈{n_efectivo} entrevistas independientes."`
- **C-B14** (`:398-464`, nota tasa/sobremuestra): `"Para lograr {n_referencia} encuestas completas hay que intentar ≈{intentos} en aula: cada aula rinde alrededor del {tau%}% de sus matriculados elegibles."`
- **C-B15** (popover "Precisión", `:279-312`): "Baja el error solo si necesitas más precisión y aceptas un N mayor."
- **C-B16** (popover "Variabilidad", `:314-343`): "p y DEFF protegen incertidumbre y similitud dentro de aulas; subirlos incrementa N." (frase **repetida verbatim** en el popover de deff, `:345-396` — posible duplicación a revisar, no necesariamente un error).
- **C-B17** (popover p, `:314-343`): "p = 0.5 es el escenario más exigente (varianza máxima); una p calibrada con evidencia previa reduce el n sin perder respaldo."
- **C-B18** (popover deff, `:345-396`): "Supuesto sensible: al cambiarlo se debe recalcular antes de comparar métodos o generar la selección de aulas."
- **C-B19** (popover sobremuestra, `:398-464`): "La sobremuestra cubre no respuesta esperada; no reemplaza las rutas de reemplazo por aula."
- **C-B20** (popover sobremuestra, `:398-464`): "Sobremuestra no es reserva: las rutas Rn.1, Rn.2… son reemplazos trazables que Monitoreo activa sin rediseñar el marco."
- **C-B21** (pie de sección, `:467-472`): `"Reemplazos: {bolsas_reemplazo} niveles y +{aulas_extra_operativas_default} aulas extra por dominio — aulas equivalentes para campo que Monitoreo activa sin rediseñar el marco. El método de selección ({selectorLabel}) se decide después de fijar N y cuotas, en la sección Aulas."`

### B.4 Pestaña Aulas → Método (`AulasMetodoTab.tsx`, fórmulas inline sin `caption`, dentro de popovers)

| # | Ubicación | Método explicado | Texto llano | Expression |
|---|---|---|---|---|
| C-B22 | `:50-63` | Sistemático-PPS | "Ordena el marco por facultad, calcula el salto k y toma un aula cada k posiciones desde un arranque aleatorio con semilla fija." | `k = \tfrac{N_{aulas}}{n_{aulas}}` ; "Cada aula queda con su pi (probabilidad de inclusión) proporcional a su tamaño elegible": `\pi_i \propto m_i` |
| C-B23 | `:66-74` | Balanceado (cube) | "Sortea respetando las probabilidades del diseño, pero obliga a que los totales de la muestra reproduzcan los del marco en las variables de balance" — "Con x = facultad, sexo esperado, tamaño de aula y demás variables activas del objetivo." | `\sum_{i \in muestra} \tfrac{x_i}{\pi_i} \approx \sum_{i \in marco} x_i` |
| C-B24 | `:76-84` | Balance + dispersión (local pivotal) | "Método pivotal local: cuando dos aulas se parecen mucho, compiten entre sí, de modo que la muestra queda dispersa en programa, nivel y horario en vez de amontonarse." — "La suma de probabilidades se conserva en cada duelo local; ninguna aula gana probabilidad extra." | `\pi_i + \pi_j = cte.` |
| C-B25 | `:86-92` | Pool controlado (fallback/optimización) | "Genera muchas muestras candidatas válidas y elige la que menos estudiantes repetidos comparte. Las probabilidades finales ya no son las del diseño: se auditan por simulación." | `\pi_i^{MC} = \tfrac{veces\ seleccionada_i}{corridas}` |

### B.5 Pestaña Aulas → Sustento técnico (`AulasAuditoriaTab.tsx`)

| # | Ubicación | Caption | Expression | Terms |
|---|---|---|---|---|
| C-B26 | `:84-102` | "Brecha de balance por categoría" | `b(c) = \%_{\mathit{muestra}}(c) - \%_{\mathit{marco}}(c)` | c → estrato; b(c) → marco muestral |
| C-B27 | `:103-119` | "Peso de cada aula seleccionada" | `w_i = \tfrac{1}{\pi_i}` | π_i → pi (probabilidad de inclusión); w_i → ponderación (peso) |
| C-B28 | `:120-136` | "Probabilidad interna del estudiante" | `\pi_{est} = 1 - \prod_a \left(1 - \pi_a\right)` | π_a, π_est → pi (probabilidad de inclusión) |
| C-B29 | `:137-148` | "n efectivo tras ponderar" | `n_{\mathit{eff}} \approx \dfrac{\left(\sum_i w_i\right)^2}{\sum_i w_i^2}` | n_eff → ponderación (peso) |

### B.6 Pestaña Aulas → Simulación (`AulasSimulacionTab.tsx`)

| # | Ubicación | Caption | Expression | Terms |
|---|---|---|---|---|
| C-B30 | `:72-83` | "n efectivo de las aulas titulares" (badge `validado` fijo) | `n_{\mathit{eff}} = \dfrac{\left(\sum_i w_i\right)^2}{\sum_i w_i^2}` | w_i → ponderación (peso) |

Nota metodológica asociada (única explicación completa de la ponderación en el recorrido):
- **C-B31** (`:84-87`): "Cada aula pesa w_i = 1/π_i (el inverso de su probabilidad de inclusión). Si los pesos son muy desiguales, unas pocas aulas dominan la estimación y el n efectivo cae por debajo del nominal."
- **C-B32** (`:165-167`, nota sobre histograma π Monte Carlo): "Aulas concentradas cerca de 100% salen casi siempre (típico de aulas grandes o de celdas con pocas opciones); una cola larga cerca de 0% indica que el sorteo reparte oportunidades entre muchas aulas parecidas."

**Total sección B: 32 elementos** (10 fórmulas LaTeX con caption/terms + 22 notas cuantitativas o explicativas directamente asociadas a una fórmula).

---

## C. Decision log del motor R (`/explicar` y endpoints relacionados)

Esta sección documenta **texto que el backend R genera dinámicamente** (no un string fijo en el frontend) y que se muestra al usuario vía `MemoriaCalculoPanel.tsx` (`decision_log`), `ClassroomMethodSources` / popovers de `AulasMetodoTab.tsx` (fuentes y explicaciones del selector de aulas), y las plantillas Quarto del reporte. Es la sección más sensible porque son las justificaciones formales que un metodólogo externo revisaría primero.

### C.1 Endpoint `POST /api/calc-muestra/explicar` — `calc_muestra_explicar()`

**Archivo:** `api/R/calc_muestra_engine.R:2121-2274`. Devuelve un `decision_log` con hasta 7 pasos (2 condicionales). Verificado línea por línea contra el código fuente:

| Paso | Condición | `decision` (con placeholders `sprintf`) | `motivo` | `fuente` |
|---|---|---|---|---|
| **modelo** | siempre | "Fórmula clásica de proporción con corrección por población finita (FPC) y efecto de diseño (deff)." | "Es el estándar para encuestas por conglomerados (aulas) sobre un marco conocido de N unidades." | "Compendio metodológico PULSO §2" |
| **confianza** | siempre | `"Nivel de confianza %.1f%% → z = %.4f."` | "El z es el número de desviaciones estándar que cubre ese nivel de confianza en la curva normal." + fuente de z (`"z provisto directamente"` o `"qnorm(1 - (1 - {confianza}) / 2)"`) | "Compendio metodológico PULSO §2" |
| **p** | siempre | `"Proporción esperada p = {p} (q = {q})."` | Si p = 0.5: "p = 0.5 es el escenario más exigente: maximiza la varianza p·q y por lo tanto el tamaño requerido." Si no: "p calibrado con evidencia previa; reduce el n frente al escenario conservador p = 0.5." | "Estudios de referencia en universidades peruanas (2024-2026)" |
| **deff** | siempre | `"Efecto de diseño deff = {deff} (n pasa de {n_bruto} a {n_teorico})."` | "Encuestar por aulas agrupa a estudiantes que se parecen entre sí; el deff compensa esa pérdida de información aumentando el n." | "Estudios de referencia en universidades peruanas (2024-2026)" |
| **fpc** | siempre | `"Corrección por población finita con N = {N formateado con comas}."` | "Cuando la muestra es una fracción apreciable del universo, el n necesario baja." | "Compendio metodológico PULSO §2" |
| **objetivo** | solo si hay meta declarada (`meta_valor > 0`) | `"n objetivo fijado en {n_objetivo} por meta declarada (teórico: {n_teorico})."` | "Existe una meta contractual u operativa que manda sobre el tamaño teórico." | "Configuración del estudio" |
| **sobremuestra** | solo si `sobremuestra > 0` | `"Sobremuestra de {oversample_pct×100}% → +{sobremuestra} casos (operativo: {n_operativo})."` | "Cubre ausencias, cuestionarios incompletos y aulas que rinden menos de lo previsto sin sacrificar la precisión objetivo." | "Estudios de referencia en universidades peruanas (2024-2026)" |
| **retrocalculo** | siempre | `"Con n = {n_objetivo} el margen de error real es ±{precision_alcanzada}% (objetivo: ±{e}%)."` | "Verificación inversa: se despeja e de la misma fórmula para confirmar que el n elegido cumple." | "Compendio metodológico PULSO §2" |

Campo `fuentes` fijo adjunto a la respuesta (`:2265-2268`):
- "Compendio metodológico PULSO §2 (fórmula clásica con FPC y deff)"
- "Metodología de estudios HST en universidades peruanas (2024-2026)"

**C-C01 a C-C09**: cada fila de la tabla + el campo `fuentes` cuentan como un copy distinto (9 en total). **Ninguna referencia a "Compendio metodológico PULSO §2" ni a "Metodología de estudios HST en universidades peruanas (2024-2026)" tiene un documento fuente localizado en el repositorio** — son citas a documentos externos no versionados en `corpus.ts` ni en `docs/`. Esto es relevante para el metodólogo: la app cita una fuente formal ("§2") que no puede verificarse desde el código.

### C.2 Decision log por componente del estudio (`POST /api/calc-muestra/calcular`) — `.cm_decisiones_componente()`

**Archivo:** `api/R/calc_muestra_engine.R:2022-2104`. Se adjunta a `estudio$decision_log` y se imprime en el reporte Quarto (sección F). Por cada componente del estudio genera 3 filas fijas + 2 condicionales:

- **C-C10** Técnica `prob_conglomerado_multietapico`: "Diseño probabilístico por conglomerados; permite inferencia bajo supuestos declarados."
- **C-C11** Técnica `intencion_censal`: "Cobertura del universo elegible vía contacto multi-canal; reporta tasa de respuesta, no margen de error."
- **C-C12** Técnica `no_prob_cuotas`: "Control de composición por cuotas; sostiene representatividad teórica/controlada sin probabilidad conocida."
- **C-C13** Técnica `listado_externo_meta_fija`: "Operación sobre listado entregado por contraparte; meta contractual sin diseño probabilístico propio."
- **C-C14** Origen del tamaño `formula`: "Tamaño derivado de fórmula estadística con marco completo."
- **C-C15** Origen del tamaño `meta_contractual`: "Tamaño definido por acuerdo con la contraparte."
- **C-C16** Origen del tamaño `cobertura_esperada`: "Tamaño definido como % del universo a cubrir operativamente."
- **C-C17** Origen del tamaño `matriz_perfiles_cualitativa`: "Tamaño definido por matriz de perfiles/cuotas criteriales."
- **C-C18** Respaldo `representatividad_estadistica`: "Selección probabilística con marco completo y probabilidad conocida."
- **C-C19** Respaldo `representatividad_operacional`: "Cobertura alta del universo contactable o intención censal."
- **C-C20** Respaldo `representatividad_teorica_controlada`: "Cuotas por variables críticas sin selección aleatoria."
- **C-C21** Respaldo `cobertura_balanceada`: "Operación sobre listado o marco con seguimiento de cuotas."
- **C-C22** Respaldo `evidencia_descriptiva`: "Resultados describen al grupo respondiente, sin inferencia poblacional."
- **C-C23** (solo si técnica = conglomerados) "Efecto de diseño (deff)": "Refleja la pérdida de eficiencia esperada por correlación intra-conglomerado."
- **C-C24** (solo si técnica = conglomerados) "Tasa de rendimiento (τ)": "Producto de asistencia × aceptación × validez histórica."

Para el recorrido "Muestra de aulas" (universo típicamente > 3,000 estudiantes con marco de cursos-horario), la técnica activa es siempre `prob_conglomerado_multietapico` — es decir, C-C10, C-C14/C-C18 (según origen configurado) y C-C23/C-C24 son las que un metodólogo vería en la práctica.

### C.3 Cuadro maestro de inferencia/acreditación automática — `.cm_inferir_acreditacion()`

**Archivo:** `api/R/calc_muestra_engine.R:537-611`. Explica **por qué el sistema eligió automáticamente una técnica** según el actor (estudiantes, docentes, administrativos, egresados) y el tamaño del universo. Directamente relevante para "Muestra de aulas" es la regla de estudiantes:

- **C-C25** (`:574`, estudiantes con canal `aula_qr` y N ≥ 3,001): "Estudiantes con N ≥ 3001 y marco de cursos-horario: conglomerados multietápico con parámetros canónicos PUCP (95% confianza, ±2.5%, deff=2, p=0.5, sobremuestra 50%). Referencia operativa: 72 aulas × 25 estudiantes ≈ 1800 encuestas base." — **nota:** esta cifra de referencia (72 aulas × 25 = 1,800) es distinta de la cifra de referencia del corpus (170 aulas base, promedio 12.9-41.4 elegibles); son dos anclas numéricas distintas coexistiendo en la app (ver Top 5, C-C25 aparece ahí).
- **C-C26** (`:581`, estudiantes con N ≤ 3,000 o sin marco de cursos-horario): "Estudiantes con N ≤ 3000 (o sin marco de cursos-horario): intención censal con cobertura mínima 60%."
- **C-C27** (`:543`, administrativos): "Administrativos: intención censal con cobertura mínima 80% (alta disponibilidad y respuesta)."
- **C-C28** (`:552`, docentes N ≤ 250): "Docentes con N ≤ 250: intención censal con cobertura mínima 60%."
- **C-C29** (`:560`, docentes N ≥ 251): "Docentes con N ≥ 251: cuotas no aleatorias, mínimo 150 con control por dedicación docente."
- **C-C30** (`:590`, egresados N ≤ 300): "Egresados con N ≤ 300: intención censal con cobertura mínima 50%."
- **C-C31** (`:605`, egresados N ≥ 301): "Egresados con N ≥ 301: conveniencia con regla canónica clamp(N×50%, 30, 150). Si hay estratos por carrera, aplica por carrera y suma. Si no hay estratos, aplica al N total."
- **C-C32** (`:610`): "Actor cualitativo o sin clasificación canónica."

(C-C27 a C-C31 no pertenecen a estudiantes-en-aula pero comparten motor y podrían mostrarse si el estudio de universidad incluye componentes de docentes/administrativos/egresados junto al de estudiantes — se listan por completitud.)

### C.4 Recomendador de técnica — `POST /calc-muestra/recomendar`

**Archivo:** `api/R/calc_muestra_engine.R:1698-1769`. Campo `razon`, cascada de 10 condiciones (9 explícitas + default):

- **C-C33**: "Universo pequeño o búsqueda de cobertura censal."
- **C-C34**: "Listado externo entregado por contraparte con meta contractual."
- **C-C35**: "Control de composición por cuotas sin probabilidad conocida."
- **C-C36**: "Sin marco probabilístico operativamente viable."
- **C-C37**: "Marco operativo sin necesidad de inferencia formal."
- **C-C38**: "Aplicación periódica del mismo diseño en olas."
- **C-C39**: "Unidad operativa natural es el conglomerado (aulas, manzanas, EESS)." — la que dispara para el caso "aulas".
- **C-C40**: "Marco ordenado con probabilidad conocida — selección sistemática."
- **C-C41**: "Estratos bien definidos con marco completo por estrato."
- **C-C42**: "Marco completo enumerable, selección aleatoria simple."
- **C-C43** (default): "Default conservador: intentar cobertura censal del universo elegible."

### C.5 Validador de inferencia permitida — `calc_muestra_validar_inferencia()`

**Archivo:** `api/R/calc_muestra_engine.R:807-838`. Determina si el sistema permite reportar margen de error formal:

- **C-C44**: `"La técnica '{tecnica}' no admite margen de error formal (naturaleza: {naturaleza})."`
- **C-C45**: "Falta marco validado (cantidad de unidades elegibles)."
- **C-C46**: "El estado del marco debe ser 'validado' o superior."
- **C-C47**: "deff debe ser >= 1 para conglomerados."
- **C-C48**: "Tasa de rendimiento τ debe estar en (0, 1]."

### C.6 Advertencias por técnica en `resultado$advertencia`

**Archivo:** `api/R/calc_muestra_engine.R`, líneas dispersas (914-1666, ver detalle abajo). Estas strings acompañan el resultado numérico de cada componente calculado. Para "Muestra de aulas" (conglomerados) la relevante es la primera; el resto se lista por completitud porque el motor es compartido con otros modos de Cálculo de muestra:

- **C-C49** (conglomerados/MAS/estratificado sin inferencia permitida, `:914-915,1134-1135,1187-1188`): "Resultado calculado sin habilitar margen de error formal." + los `motivos` de C.5.
- **C-C50** (intención censal, `:1084-1085`): "Intención censal: se reporta cobertura, no margen de error. Aplica TCL: con n >= 30 la lectura es estable."
- **C-C51** (cuotas no probabilísticas, `:1108-1109`): "Diseño no probabilístico por cuotas: no admite margen de error formal. Reportar como representatividad teórica/controlada."
- **C-C52** (estratificado sin tabla de estratos, `:1211`): "Muestreo estratificado sin tabla de estratos: se calculó n total, pero falta la distribución por capas."
- **C-C53** (estratificado con estratos, `:1234`): "Muestreo estratificado proporcional: el margen de error formal corresponde al diseño probabilístico documentado."
- **C-C54** (dominios independientes, `:1380`): "Dominios independientes: cada facultad se dimensiona con su propio margen de error y proporción de éxito." — **esta sí aplica directamente a "Muestra de aulas"** cuando el cálculo se hace por facultad.
- **C-C55** (sistemático, `:1391-1394`): "Muestreo sistemático: requiere marco ordenado y arranque aleatorio documentado." — aplica al método de selección de aulas.

**Total sección C: 55 copys** (9 del `/explicar`, 15 del decision log por componente, 8 de acreditación automática, 11 del recomendador, 5 del validador de inferencia, 7 de advertencias por técnica).

### C.7 Motor de selección de aulas (`api/R/calc_muestra_aulas.R`) — sustento técnico del método

Este archivo (~4,360 líneas) alimenta directamente el componente `ClassroomMethodSources` (`aulasParts.tsx:1349-1354`) y los popovers de `AulasMetodoTab.tsx` (sección B.4). Es la justificación formal más citable del recorrido porque incluye referencias académicas y oficiales explícitas.

**C.7.1 — Tabla de 9 decisiones metodológicas del marco de aulas** (`.cm_aulas_methodological_sources()`, `:1203-1339`). Cada fila tiene `decision_metodologica` / `regla_app` / `implicancia_prosecnur` / `advertencia`, más referencias oficiales/académicas/de implementación (OECD/PISA, IEA TIMSS/PIRLS, NCES/NAEP, Statistics Canada, Deville & Tillé, Grafström & Tillé, AAPOR, Groves & Heeringa, Eurostat, paquetes R `sampling`/`BalancedSampling`):

| # | `decision_id` | Decisión metodológica | Regla que aplica la app | Implicancia para Prosecnur | Advertencia |
|---|---|---|---|---|---|
| C-C56 | `classroom_cluster` | "Aula o curso-horario como unidad seleccionable" | "No seleccionar filas alumno-curso como unidad final." | "El marco se colapsa por curso-horario y mantiene estudiantes solo para control interno." | "La encuesta puede ser anonima; no exportar PII estudiantil." |
| C-C57 | `pps_benchmark` | "Seleccion proporcional al tamano como benchmark" | "Mantener sistematico_pps como benchmark auditable y fallback." | "La app siempre puede comparar el selector avanzado contra una regla simple PPS." | "PPS sobrerrepresenta tamanos grandes si no hay balance adicional." |
| C-C58 | `cube_balanced` | "Muestreo balanceado como motor recomendado" | "Usar cube_balanceado cuando hay auxiliares confiables." | "La seleccion busca reproducir cuotas y auxiliares del marco, no solo tamano." | "Si se optimiza entre candidatas, las probabilidades finales no son cube puro." |
| C-C59 | `r_implementation` | "Implementacion reproducible en R" | "Preferir sampling::samplecube(); registrar version/fallback." | "La bitacora guarda motor, semilla, fallback y advertencias." | "Si falla el paquete, debe registrarse fallback." |
| C-C60 | `local_pivotal` | "Balance con dispersion multidimensional" | "Usar local_pivotal_balanceado solo si BalancedSampling esta disponible." | "Modo avanzado para reducir concentracion por programa, nivel u horario." | "Si BalancedSampling no esta disponible, caer a cube o PPS." |
| C-C61 | `weights` | "Probabilidades y pesos de diseno" | "Producir pi_base, pi_design, pi_final y pesos asociados." | "Las aulas seleccionadas salen con peso de aula y pesos estudiantiles agregados." | "Los pesos finales deben usar pi_final, no una probabilidad intermedia." |
| C-C62 | `nonresponse` | "No respuesta y codigos de disposicion" | "Registrar politica de no respuesta y ajustes posteriores." | "Monitoreo mide caidas y sesgos sin exigir identificador personal en respuestas." | "Los ajustes por no respuesta se documentan al cierre." |
| C-C63 | `replacement_reserves` | "Reservas coordinadas sin rediseno silencioso" | "Activar M2...Mk como reservas equivalentes, no como sobremuestra." | "Las reservas se trazan por ola y motivo, sin cambiar el marco base." | "Un reemplazo no debe confundirse con sobremuestra." |
| C-C64 | `quality_report` | "Reporte de calidad y trazabilidad" | "Exportar diagnosticos, errores, fuentes y advertencias." | "El workbook permite auditoria metodologica y operativa." | "La calidad se reporta incluso si hay fallback." |

**C.7.2 — `methodology` fija del marco de aulas** (`:1147-1152`):
- **C-C65** `unit_observation`: "estudiante"
- **C-C66** `sampling_unit`: "curso_horario_aula"
- **C-C67** `construction`: "Base madre estudiante x curso_horario o join estudiantes + inscripciones; colapso a aula por curso_horario."
- **C-C68** `anonymity`: "El marco puede contener identificadores internos para diseno; monitoreo no exige student_id en respuestas."

**C.7.3 — Explicación en lenguaje llano por método de selección** (`.cm_aulas_method_explanation()`, `:2660-2668` — es la fuente backend que respalda las notas ya citadas en B.4/ComparadorMetodosVisual):
- **C-C69** `sistematico_pps`: "Da más probabilidad a aulas con más estudiantes elegibles y funciona como benchmark simple."
- **C-C70** `cube_balanceado`: "Busca que las aulas seleccionadas reproduzcan el marco en facultad, programa, nivel, horario y tamaño."
- **C-C71** `local_pivotal_balanceado`: "Además de balancear, intenta dispersar la muestra para evitar concentración académica u operativa."
- **C-C72** `pool_controlado`: "Compara muestras candidatas y elige la que reduce mejor el solape, registrando probabilidades por simulación."
- **C-C73** `estratificado_aleatorio`: "Selecciona dentro de cada estrato sin optimización adicional."
- **C-C74** (fallback, cualquier motor no listado, p. ej. `manual_auditable`): "Requiere decisión documentada por el equipo metodológico."

**C.7.4 — `methodology` fija de la selección final** (`:3547-3555`):
- **C-C75** `design`: "Muestreo estratificado de conglomerados aula/curso_horario con PPS sobre elegibles efectivos y variables auxiliares de balance."
- **C-C76** `selector` (plantilla): `"Motor solicitado: {engine}. Motor usado: {engine_used}."`
- **C-C77** `probabilities` (plantilla): `"pi_base y pi_design desde el diseno; pi_final segun {probability_source}."`
- **C-C78** `weights`: "weight_classroom = 1/pi_final; weight_student se calcula como agregado interno desde pi_student."
- **C-C79** `representativity` (plantilla): `"Score de representatividad {score}; distancia ponderada {distancia}."`

**C.7.5 — Advertencia metodológica por selección (`methodological_warning`)** (`:3414-3429`):
- **C-C80** (default cuando no hay ningún fallback ni Monte Carlo posterior): "Sin advertencias metodologicas criticas."
- **C-C81** (si `probability_source == monte_carlo_after_optimization`, es decir, motor `pool_controlado`): "Se eligio la mejor muestra entre candidatas; pi_final usa simulacion Monte Carlo posterior a la optimizacion."
- **C-C82** (si se pidió `local_pivotal_balanceado` pero el motor final usó fallback): "Modo local pivotal solicitado, pero el motor final uso fallback."
- **C-C83** (fallback: `BalancedSampling` no disponible/falla): "BalancedSampling::lcube/lpm2 no disponible o fallo; se uso sampling::samplecube()."
- **C-C84** (fallback: `sampling::samplecube()` no disponible/falla): "sampling::samplecube() no disponible o fallo; se uso sistematico_pps."
- **C-C85** (motor `manual_auditable`): "manual_auditable no selecciona automaticamente; se uso sistematico_pps para producir una propuesta inicial."
- **C-C86** (ningún motor funcionó): "No se pudo usar el motor solicitado; se uso muestreo aleatorio ponderado."

**C.7.6 — Banderas de riesgo metodológico por selección** (`.cm_aulas_risk_flags()`, `:2786-2827`):
- **C-C87** `quota_not_feasible` (alta): `"{estrato} solicita {N} aulas, pero solo existen {N} elegibles."`
- **C-C88** `high_schedule_concentration` (media): `"La categoría {categoría} queda en {%} de M1 frente a {%} del marco."` — dispara si la brecha excede 15 puntos porcentuales.
- **C-C89** `low_reserve_depth` (media): `"{N} celda(s) tienen menos reservas que titulares."`
- **C-C90** `low_simulation_runs` (media, motor `pool_controlado` con <100 corridas): "La optimización por candidatas requiere al menos 100 corridas para una lectura preliminar."
- **C-C91** `method_fallback` (media): reutiliza el texto de C-C81 a C-C86 que haya aplicado.
- **C-C92** `balance_not_audited` (baja): "No se encontraron variables de balance suficientes para el diagnóstico."
- **C-C93** `no_critical_risk` (ok, solo si ninguna anterior aplicó): "La selección no presenta riesgos metodológicos críticos bajo los controles configurados."

**C.7.7 — Advertencias de representatividad** (`calc_muestra_aulas_representativity_objective()`, `:2500-2508`):
- **C-C94**: `"Se redistribuyo peso de {N} dimension(es) sin datos activos."`
- **C-C95**: `"Balance fuera de tolerancia severa en: {lista}."` — si el error máximo supera 2× la tolerancia configurada.
- **C-C96**: "La perdida por estudiantes repetidos supera la tolerancia configurada."
- **C-C97**: "CV de pesos critico; revisar probabilidades o postestratificacion."
- **C-C98**: "Profundidad de reservas menor al objetivo."
- **C-C99** (default): "Sin alertas de representatividad bajo los criterios activos."

**C.7.8 — Justificación operativa/metodológica por método en el comparador** (`calc_muestra_aulas_comparar_metodos()`, `:2953-3058`):
- **C-C100** `methodological_reason` para `pool_controlado`: "Optimización posterior: las probabilidades finales deben estimarse por simulación."
- **C-C101** `methodological_reason` para `sistematico_pps`: "Benchmark PPS con probabilidades prescritas."
- **C-C102** `methodological_reason` para el resto (`cube_balanceado`, `local_pivotal_balanceado`, `estratificado_aleatorio`): "Diseño probabilístico balanceado con probabilidades prescritas y fuentes auditables."
- **C-C103, C-C104, C-C105** (notas fijas de la comparación): "PPS se conserva como benchmark auditable." / "La optimizacion por solape cambia probability_source a monte_carlo_after_optimization." / "La comparacion no activa campo ni rediseña Monitoreo."

**Total sección C.7: 50 copys.** Sumando C.1-C.6: **el motor R (`calc_muestra_engine.R` + `calc_muestra_aulas.R`) expone 105 strings narrativos/justificativos distintos** hacia este recorrido. Por alcance y tiempo, esta extracción no cubrió el módulo de simulación de reemplazos ni el bloque de réplica histórica/demo del mismo archivo (`calc_muestra_aulas_demo_hsvg_2025`, líneas ~3640-4260) con el mismo detalle exhaustivo; si el metodólogo lo requiere, se puede ampliar en una pasada dedicada — se sabe que existen decenas de strings adicionales ahí (ver nota al final del documento).

---

## D. Respaldos didácticos por pestaña — desk `universidad/`

Copys de las pestañas del recorrido guiado, en el orden real de navegación (`universidadTabs.ts`).

### D.1 Definición

**Pestañas:** Estudio (`DefEstudioTab.tsx`) → Bases (`DefBasesTab.tsx`) → Variables (`DefVariablesTab.tsx`) → Categorías (`DefCategoriasTab.tsx`).

#### `DefEstudioTab.tsx`
- **C-D01** (`:242-245`, párrafo del hero inicial): "Todo el recorrido nace de un Excel institucional. Elige el que tienes a la mano; el resto — marco, cálculo y aulas — se construye aquí."
- **C-D02** (`:290-293`, guía del recorrido): "Seis pasos encadenados, del estudio a las aulas que se visitan. Cada pestaña del panel izquierdo cubre un tramo; la calculadora valida cada resultado antes de avanzar."
- **C-D03** (`:304-306` + `EJEMPLO_TRABAJADO` de `corpus.ts:424-443`, ver sección E.3): "Ejemplo trabajado: del cálculo a la aplicación en un caso real" — despliega la narrativa completa de 4 párrafos del corpus con las cifras reales del estudio de referencia (N=22,037, p=0.30, n≈2,310→2,500, 170 aulas, 194 aplicadas, etc.).
- Etapas del mapa del recorrido (`:84-121`, `FlujoVertical`): universo → elegibles → población (N) → muestra (n) → aulas M1, cada una con detalle metodológico corto (p. ej. "N · estudiantes únicos por representar", "n · objetivo calculado").
- **C-D04**: `<RespaldoMetodologico paso="definicion" />` (`:230`) — despliega el bloque completo `RESPALDOS.definicion` del corpus (ver sección E.1, 4 párrafos).
- **C-D05**: `<ContextoLlano paso="definicion" />` (`:175`) — despliega `PASOS.definicion.llano` (ver sección E.2).

#### `DefBasesTab.tsx`
- **C-D06** (`:392-395`, intro del panel): "Con estos archivos se construye el marco muestral: la lista completa de aulas y estudiantes de donde el sorteo puede elegir. Declara qué insumo tienes y de qué hoja se lee." (con `TerminoChip termino="marco muestral"`)
- **C-D07** (`:84-90`, justificación de rol `base_madre`): "Es el Excel institucional de matrícula: una fila por estudiante en cada curso y horario. Sin él no existe el marco muestral y ningún paso posterior — marco, cálculo, aulas — puede construirse."
- **C-D08** (`:93-100`, rol `estudiantes`): "Es la base principal de matrícula: estudiante elegible o, idealmente, estudiante por curso y horario. De aquí sale el marco muestral; si falta, no hay nada que construir."
- **C-D09** (`:102-108`, rol `catalogo_curso_horario`): "Es el catálogo de cursos y horarios: curso, horario, aula, docente y cupos. Si falta y la base principal ya trae curso y horario por estudiante, la lectura se completa igual."
- **C-D10** (`:110-115`, rol `muestra_previa`): "Es la muestra ya seleccionada: aulas titulares y reemplazos tal como fueron sorteados. Si falta, no hay selección que leer ni conservar."
- **C-D11** (`:117-122`, rol `agenda`): "Es la agenda operativa de las aulas: docente, fecha, responsable y estado. Si falta, la lectura no puede reconstruir el plan de campo de la selección."
- **C-D12** (`:429-432`, nota de modo dos bases): "Con el archivo 2025 basta usar MATRICULADO como base principal y CURSO Y HORARIO como catálogo. La hoja de inscripciones solo es necesaria si la base principal no trae curso y horario por estudiante."
- **C-D13** (`:463-468`, EmptyState modo selección existente): "Este modo lee una selección ya trabajada" — "Sube la muestra y la agenda operativa: el marco no se reconstruye aquí; la lectura conserva la selección tal como fue diseñada."
- **C-D14** (`:486-489`, hint construir marco): "La lectura deduplica estudiantes, aplica los criterios de inclusión y deja cada exclusión auditada."

#### `DefVariablesTab.tsx`
- **C-D15** (`:104-109`, intro): "Indica qué columna del Excel cumple cada función. Con facultad y sexo se forman los estratos y las cuotas de la muestra; con curso y horario se identifica cada curso-horario que el sorteo puede elegir." (con `TerminoChip termino="estrato"` y `termino="curso-horario"`)
- **C-D16** (`:39-44`, `MOTIVO_MOTOR`, rol `faculty`): "Con esta columna la calculadora arma los estratos por facultad y reparte las cuotas de la muestra en proporción al peso real de cada una en la población."
- **C-D17** (rol `sex`): "Es el control de cuota: la muestra final debe conservar la composición por sexo de la población, y el cierre estadístico se cuadra por celda facultad × sexo."
- **C-D18** (rol `course_id`): "Junto con el horario forma la unidad de selección: el aula (curso-horario) que se sortea y se visita en campo."
- **C-D19** (rol `schedule`): "Junto con el curso identifica cada aula seleccionable y permite balancear turnos y planificar la visita en campo."
- **C-D20** (rol `course_schedule_id`): "Si la base ya trae un código único de aula (por ejemplo NRC), la calculadora lo usa directamente como unidad de selección sin reconstruirla."

#### `DefCategoriasTab.tsx`
- **C-D21** (`:133-138`, intro elegibilidad): "El universo son todas las filas de la base; los matriculados elegibles son quienes cumplen los criterios de inclusión que fijas aquí. Todo lo que queda fuera se audita con su motivo, nunca se descarta en silencio." (con `TerminoChip termino="matriculados elegibles"`)
- **C-D22** (`:186-188`, hint chips de condición): "Cada chip es un valor real de la columna de condición con su conteo. Los marcados definen quién entra a la población objetivo."
- **C-D23** (`:217-220`, toggle pregrado): "Excluye posgrado cuando se detecta en nivel/ciclo."
- **C-D24** (`:225-228`, toggle presencial): "Excluye modalidades virtuales/remotas para selección de aulas."
- **C-D25** (`:233-236`, toggle mayoría de edad): "Útil cuando el protocolo exige filtrar por edad declarada."
- **C-D26** (`:248`, mínimo por aula): "Aulas menores quedan auditadas, pero no entran como titulares."
- **C-D27** (`:266`, nota de cierre): "Estos criterios no seleccionan aulas todavía. Solo definen quién pertenece al universo y qué filas pueden entrar al marco de aplicación."
- **C-D28** (`:35-44`, `MOTIVO_EXCLUSION_LABELS`, etiquetas de motivo de exclusión que reporta el motor): "sin identificador", "menores de edad", "condición no aceptada", "nivel fuera de pregrado", "modalidad no presencial", "tipo de sesión excluido", "sin aula identificable", "aula bajo el mínimo".

**Total D.1: 28 copys** (más las 2 remisiones a corpus, C-D04/C-D05, contadas en la sección E).

### D.2 Marco institucional

**Pestañas:** Población (`MarcoPoblacionTab.tsx`) → Aulas (`MarcoAulasTab.tsx`) → Consistencia (`MarcoConsistenciaTab.tsx`).

#### `MarcoPoblacionTab.tsx`
- **C-D29** (`:79-107`, párrafo metodológico principal): "Cada flecha es una decisión auditada: el universo se filtra con los criterios decididos en Definición → Categorías y las filas repetidas se consolidan en estudiantes únicos. La proporción que sobrevive al filtro ({X%}) alimenta la tasa de rendimiento con la que el cálculo convierte cuotas en aulas." (con `TerminoChip termino="matriculados elegibles"` y `termino="tasa de rendimiento"` con valor vivo)
- **C-D30** (popover "Universo vs población", `:87-98`): "El universo son todas las filas leídas del archivo institucional. La población son los matriculados elegibles únicos que quedan después de aplicar los criterios de inclusión." + "Esos criterios se decidieron en Definición → Categorías; esta pestaña solo audita su resultado."
- **C-D31**: `<ContextoLlano paso="marco" />` (`:74`) y `<RespaldoMetodologico paso="marco" />` (`:150`) — despliegan `PASOS.marco.llano` y `RESPALDOS.marco` (sección E).

#### `MarcoAulasTab.tsx`
- **C-D32** (`:66-71`, intro): "La unidad que se sortea no es el estudiante sino el curso-horario: cada aula agrupa a sus matriculados y aporta un tamaño esperado. Aquí se audita cuántas aulas quedan seleccionables y con qué capacidad." (con `TerminoChip termino="curso-horario"`)

#### `MarcoConsistenciaTab.tsx`
- **C-D33** (`:165-166`, encabezado): "Comprueba que las bases se puedan relacionar antes de calcular" — valida la relación entre base principal y catálogo de cursos-horario antes del cálculo (afirmación de prerrequisito metodológico).
- **C-D34** (`:36-44`, acciones sugeridas por hallazgo del motor R): 8 mensajes de diagnóstico de calidad del emparejamiento entre bases (p. ej. "Confirma que ambas hojas usan la misma llave de curso-horario y vuelve a construir el marco.").
- Escala del "gauge" de coincidencia base-catálogo (`:69-71`): umbrales en 70% ("revisar") y 90% ("sólido") — **es un umbral cuantitativo fijo sin justificación textual expuesta al usuario** (ver Top 5).

#### `marcoCards.tsx` / `marcoCharts.tsx` (visualizaciones de la sección Marco)
- **C-D35** (`marcoCards.tsx:574-576`, nota sobre el mínimo de elegibles por aula): "El mínimo de elegibles por aula es solo lectura aquí: se decide en Aulas → Objetivo."
- Estados vacíos accionables con contenido metodológico (`marcoCharts.tsx:712-753`, plantilla `descriptiveMissingState`, reutilizada en ~8 gráficos de `marcoCards.tsx`): explican qué variable falta mapear y por qué es necesaria para el gráfico (p. ej. "Este gráfico usa la carrera administrativa del estudiante. No se completa con aulas para evitar mezclar cursos de otra facultad.").
- Etiquetas de estado del marco (`marcoCharts.tsx:679-686`): "validado", "revisar", "crítico", "pendiente", "sin catálogo".

**Total D.2: 8 copys principales** (más las remisiones a corpus D2.31 contadas en sección E, y ~10 estados vacíos/etiquetas secundarias de menor densidad estadística).

### D.3 Cálculo

**Pestañas:** Parámetros (`CalculoParametrosTab.tsx`) → Propuestas (`CalculoPropuestasTab.tsx`) → Supuestos (`CalculoSupuestosTab.tsx`).

Las fórmulas y notas cuantitativas de estas tres pestañas ya están íntegramente citadas en la **sección B** (C-B01 a C-B21). Copys adicionales sin fórmula asociada:

- **C-D36** (`CalculoParametrosTab.tsx:113`, título del panel): "Mueve los supuestos y mira cómo respira el n" — encuadra la interacción como exploración válida del espacio de parámetros.
- **C-D37** (`CalculoParametrosTab.tsx:144-147`, nota bajo CTA): "El cálculo oficial corre con los parámetros aplicados al estudio y llena Propuestas con N, cuotas y aulas." — distingue explícitamente preview (TS) de cálculo validado (motor R).
- **C-D38**: `<ContextoLlano paso="calculo" />` (`:108`) y `<RespaldoMetodologico paso="calculo" />` (`:194`) — despliegan `PASOS.calculo.llano` y `RESPALDOS.calculo` (sección E).
- **C-D39** (`CalculoPropuestasTab.tsx:200-201`, nota de ajuste sobre la fórmula): `"Ajuste sobre la fórmula: {extra}. Cada facultad conserva su propio margen de error y p esperada."` (caso por facultad) o `"Ajuste sobre la fórmula: {extra} · precisión estimada con este n: {precisión}."` (caso agregado).

**Total D.3: 4 copys adicionales** (sumados a los 21 de la sección B que pertenecen a estas pestañas).

### D.4 Aulas y selección

**Pestañas (orden real, `CLASSROOM_LAB_TABS`):** Objetivo de muestra → Comparar métodos → Simulación → Cursos-horario titulares → Reemplazos por curso-horario → Sustento técnico.

Las fórmulas de Método, Sustento técnico y Simulación ya están citadas en la sección B (C-B22 a C-B32); las fuentes metodológicas del backend están en C.7. Copys adicionales:

#### Retiro de `AulasMarcoTab.tsx` y rehome en Sustento
- **C-D40 (retirado como bloque conjunto):** los cuatro popovers del antiguo
  overview no eran decisiones exclusivas. «Unidad seleccionable» vive en
  Marco/Cursos-horario; repetidos, en Método y Titulares; reemplazos frente a
  extra, en Objetivo y Reemplazos; privacidad, en Entregables. Se retiró la
  repetición conjunta al eliminar el tab que la spec marcaba como duplicado.
- **C-D41 (absorbido):** semilla, firma usada por la selección, firma del marco
  actual, fecha del marco actual, método y corrida ya forman el sello
  reproducible de `AulasAuditoriaTab.tsx`. Las dos firmas y la fecha se
  presentan como evidencias separadas para no atribuir la fecha vigente a una
  selección histórica; la nota separada dejó de aportar una decisión adicional.
- **C-D42** (`AulasAuditoriaTab.tsx`, alerta cuando el marco cambia después de
  la selección): "El marco cambió después de la selección." + `"La selección
  vigente ({método}) se sorteó sobre la firma {hash}, pero el marco actual tiene
  la firma {hash}. Vuelve a comparar métodos y seleccionar para que titulares y
  reemplazos correspondan al marco vigente."` — guard de integridad, no copy
  decorativo.
- **C-D43:** `<RespaldoMetodologico paso="aulas" />` se reubicó en
  `AulasAuditoriaTab.tsx`, el hogar de fuentes y defensa. El inventario anterior
  atribuía también un `<ContextoLlano paso="aulas" />`, pero ese montaje no
  existía en la fuente vigente.

#### `AulasObjetivoTab.tsx`
- **C-D44** (`:89-95`, párrafo introductorio, primera explicación de dos términos): "La cuota de aulas por facultad convierte el N calculado en salones a visitar: cada facultad usa su propio tamaño de aula y su tasa de rendimiento. Cada titular lleva sus reemplazos (M1, M2, M3…) equivalentes ya sorteados, y el extra operativo se presupuesta aparte." (con `TerminoChip termino="cuota de aulas por facultad"` y `termino="reemplazo (M1"`)
- **C-D45** (`:176`, nota mínimo por aula): "Descarta cursos demasiado pequeños para sostener una aplicación presencial."
- **C-D46** (`:181`, nota reemplazos por aula): "Crea Rn.1, Rn.2... como alternativas equivalentes para cada aula titular."
- **C-D47** (`:186` y `:212`, nota extra operativo, **repetida dos veces**): "El extra operativo no cambia el N estadístico: refuerza la agenda de campo sin alterar cuotas ni pesos del diseño." / "Refuerzo de agenda; no cambia el N estadístico ni la muestra titular."
- **C-D48** (`:195-197`, toggle grupos de tamaño): "Usar grupos de tamaño de aula" — "Recomendado cuando la selección puede sesgarse hacia cursos grandes."

#### `AulasMetodoTab.tsx` (además de las fórmulas de B.4)
- **C-D49** (`:293`, nota lateral con recomendación explícita de método): "El PPS queda como base auditable. El método balanceado es el recomendado cuando hay variables auxiliares; el pool controlado reduce estudiantes repetidos pero obliga a estimar probabilidades finales por simulación."
- Recta numérica del salto sistemático (`:129-176`), con texto dinámico real: `"k = {N} aulas del marco / {titulares} titulares = {k}"` (o versión ilustrativa cuando aún no hay selección).

#### `AulasSeleccionTab.tsx`, `AulasReemplazosTab.tsx`, `AulasSimulacionTab.tsx`, `aulasParts.tsx`
- **C-D50** (`AulasReemplazosTab.tsx:183`, nota lateral sobre el handoff a Monitoreo): "Calc-Muestra propone titulares y reemplazos; Monitoreo solo activa reemplazos, registra motivos y recalcula brechas sin rediseñar silenciosamente el marco base."
- **C-D51** (`aulasParts.tsx:885`, resumen del flujo operativo completo): "El cálculo de muestra de aulas produce titulares, reservas, pesos y códigos. El generador QR/PDF convierte esa agenda en fichas y Monitoreo de aulas registra aplicación, caídas y reemplazos."
- **C-D52** (`aulasParts.tsx:672-687`, `classroomReplacementMatchLabel`, taxonomía de equivalencia de reemplazos): "Mantiene la celda", "Celda cercana", "Misma facultad", "Mismo dominio", "Mismo programa", "Cambia programa", "Cambia carrera", "Cambia nivel", "Baja equivalencia", "Sin reemplazo viable".
- **C-D53** (`aulasParts.tsx:1349-1354`, `ClassroomMethodSources`, fallback si el backend no trae fuentes — ver también C.7.1): "Fuente oficial": "OECD/PISA, NCES/NAEP, UN, Eurostat, AAPOR"; "Fuente académica": "Deville & Tillé; Statistics Canada; Groves & Heeringa"; "Implementación": "sampling::samplecube(); BalancedSampling::lcube/lpm2"; "Pesos": "peso de aula = 1 / probabilidad final; probabilidad estudiantil agregada"; "No respuesta": "códigos de disposición y ajuste posterior por dominio".
- **C-D54** (`ComparadorMetodosVisual.tsx:14-50`, `METODO_COPY`, fortaleza/riesgo declarado por cada uno de los 7 métodos de selección — contenido metodológico central, ver detalle íntegro más abajo).
- **C-D55** (`ComparadorMetodosVisual.tsx:169-173`, nota de cierre): "Los métodos comparados son probabilísticos y auditables: cada aula entra con una probabilidad conocida y registrada, y la corrida completa puede reproducirse con la misma semilla. La recomendación no es una regla universal — sale de medir cada método contra este marco concreto (su tamaño, sus facultades, sus repetidos) y puede cambiar en otro proyecto."

**Detalle de C-D54 — `METODO_COPY` (`ComparadorMetodosVisual.tsx:14-50`):**

| Método | Nombre | Fortaleza declarada | Riesgo declarado |
|---|---|---|---|
| `cube_balanceado` | "Sorteo balanceado multidimensional" | "Sortea cuidando que la muestra conserve las proporciones del marco en varias variables a la vez." | "Necesita variables auxiliares confiables; si vienen sucias, el balance hereda ese ruido." |
| `pps_balanceado` | "Sorteo balanceado (alias legacy)" | "Compatibilidad con proyectos antiguos: se normaliza al mismo método balanceado recomendado." | "Es solo un alias; conviene migrar la configuración al nombre actual del método." |
| `local_pivotal_balanceado` | "Balance con dispersión local" | "Además del balance, evita que las aulas elegidas se concentren en un mismo programa u horario." | "Exige buenas variables de dispersión; con marcos pequeños puede sacrificar algo de balance." |
| `pool_controlado` | "Sorteo optimizado contra repetidos" | "Compara muestras candidatas y se queda con la que comparte menos estudiantes entre aulas." | "Las probabilidades finales dependen de simulación, así que requiere más corridas para auditarse." |
| `sistematico_pps` | "Salto sistemático proporcional al tamaño" | "Simple y transparente: ordena el marco y avanza con un salto fijo, dando más chance a aulas grandes." | "Si el orden del marco tiene un patrón oculto, el salto puede alinearse con él y sesgar la muestra." |
| `estratificado_aleatorio` | "Aleatorio estratificado simple" | "Fácil de explicar: sorteo puro dentro de cada facultad, sin supuestos adicionales." | "No controla repetidos ni balancea otras variables; puede quedar menos parejo que los métodos balanceados." |
| `manual_auditable` | "Selección manual auditable" | "Permite una decisión operativa documentada con responsable y motivo registrados." | "Al no ser un sorteo, pierde la defensa probabilística: úsalo solo como excepción justificada." |

**Total D.4: 14 copys principales de texto libre vigentes** (C-D42 a C-D55; C-D40 y C-D41 quedan trazados como retirado/absorbido) **+ las 11 fórmulas/notas de la sección B que pertenecen a Aulas** (C-B22 a C-B32) **+ las fuentes del motor R (C.7, 50 copys)**.

### D.5 Salida

**Pestañas:** Cierre (`SalidasCierreTab.tsx`) → Tablas/Resultados (`SalidasResultadosTab.tsx`) → Entregables (`SalidasEntregablesTab.tsx`) → Pase a Monitoreo (`SalidasMonitoreoTab.tsx`).

#### `SalidasCierreTab.tsx`
- **C-D56** (`:138-139`, encabezado): "El diseño completo, con las cifras que se defienden ante el cliente" — "El camino del diseño y lo que falta para cerrarlo".
- **C-D57** (`:165-169`, label "Margen real alcanzado"): detalle condicional "el n cubre todo el marco (nivel universidad)" (si `precisionCensal`) o "retrocálculo con el n final (nivel universidad)" — distingue explícitamente cuándo el margen de error es formal vs. cuándo es un caso censal.
- **C-D58** (`:216`, nota de reproducibilidad): "Con estos datos el sorteo se reconstruye exacto; el detalle completo vive en Aulas → Sustento técnico."
- **C-D59**: `<ContextoLlano paso="salidas" />` (`:130`) — despliega `PASOS.salidas.llano` (sección E), texto: "El diseño se convierte en entregables defendibles: el reporte metodológico con la memoria de cálculo completa y el anexo con las aulas seleccionadas, sus probabilidades y sus reemplazos. Cualquier revisor puede auditar cada decisión."

#### `SalidasEntregablesTab.tsx`
- **C-D60** (`:45-51`, opciones de política PII): "Cliente sin identificadores" → "El cliente recibe agregados y aulas sin códigos de estudiante ni datos de contacto." / "Trazabilidad interna" → "La versión interna conserva códigos operativos para controlar duplicados y cobertura."
- **C-D61** (`:57-60`, matriz PII por entregable): define qué columnas ve el cliente vs. el equipo interno para "Cálculo muestral", "Selección de aulas", "Rutas y agenda" y "Auditoría del marco" — 4 filas × 2 columnas de contenido metodológico/de privacidad.
- **C-D62** (`:154`, cierre del popover de columnas): "En ninguna política se publican nombres ni datos personales de estudiantes: los identificadores internos son códigos de aula y de selección."

#### `SalidasResultadosTab.tsx`
- **C-D63** (`:91-97`, encabezados de tabla de resultados finales por facultad — **contenido metodológico directo, no navegación**): "Facultad", "Marco", "Error usado", "p usada", "Mujeres", "Hombres", "Cuota total" — expone los parámetros efectivamente usados (N, e, p) por cada facultad, no solo el agregado.
- Comentario de cabecera (no visible al usuario, pero relevante): el gráfico solo usa "la distribución VALIDADA del motor" — confirma la regla de procedencia (nunca preview) para esta tabla de cierre.

#### `SalidasMonitoreoTab.tsx`
- **C-D64** (`:96-99`, nota central del handoff): "Monitoreo recibe la agenda cerrada (titulares, reservas, códigos y pesos). Si un aula titular cae, activa el reemplazo equivalente que dejó este diseño y registra el motivo: el marco y las probabilidades no se tocan durante el campo."
- **C-D65** (`:213-215`, nota de cierre): "Titulares, reservas y códigos quedaron cerrados. El seguimiento de campo vive en Monitoreo: allí se registra el avance y se activan los reemplazos equivalentes sin tocar el diseño."
- **C-D66** (`:88`, pill): "Monitoreo no rediseña la muestra".

**Total D.5: 11 copys principales.**

**Total sección D: ~76 copys de texto libre** en las pestañas del desk `universidad/` (no cuenta las fórmulas ya contabilizadas en B ni las fuentes del motor R ya contabilizadas en C).

---

## E. Capa didáctica compartida y corpus narrativo

Esta capa (`didactica/`) es el contenedor del contenido más extenso y más directamente trazable a fuente: **todo el texto viene de `corpus.ts`**, con excepción de las etiquetas cortas de `didacticaCopy.ts` y `PasoDidactico.tsx`.

### E.1 `RESPALDOS` — narrativas "para saber más" por paso (`corpus.ts:236-293`)

Se muestran vía `<RespaldoMetodologico paso="..." />`, un plegable presente en Definición, Marco, Cálculo y Aulas (no en Salidas — el paso `aplicacion` del corpus no tiene un `<RespaldoMetodologico>` que lo invoque directamente, solo `ContextoLlano paso="salidas"`, ver E.2). Cada bloque tiene 3-4 párrafos completos y una lista de `fuenteIds`.

- **C-E01** `definicion` — "Cómo se define la población en los estudios de referencia" (4 párrafos, fuentes: `metodologia-2025`, `metodologia-detallada`, `comparacion-estudios`). Contenido: definición fija de población objetivo (pregrado matriculado, mayores de 18 años); decisión de representatividad (universidad completa ±2.5%/2,500/170 aulas vs. por facultad ±5%/4,150/249 aulas, "~60% más costo operativo"); calibración de p (0.50→0.30 tras observar 30.2%, "redujo la muestra teórica en unas 250 encuestas"); universo cuantificado (14,728 a 22,037 estudiantes elegibles, 15 facultades, ejemplo 48.4%/51.6% por sexo).
- **C-E02** `marco` — "Cómo se construye y depura el marco muestral" (4 párrafos, fuentes: `metodologia-2025`, `propuesta-2026`, `metodologia-detallada`). Contenido: estructura de dos bases relacionadas; filtros a nivel de aula (solo teóricas/teórico-prácticas, presencial, pregrado, niveles 2-10, mínimo 15 matriculados, ≥80% mayoría de edad y ≥80% pregrado); filtros a nivel de alumno en tres momentos (marco/campo/procesamiento); ejemplo de escala (~22,000 matriculados → 1,097 cursos-horario válidos).
- **C-E03** `calculo` — "El cálculo del tamaño de muestra, paso a paso" (5 párrafos, fuentes: `metodologia-2025`, `propuesta-2026`). Contenido: fórmula completa con justificación de cada parámetro; ejemplo con N=22,037 → n≈2,310; ajustes teórico→operativo (÷92.4% tasa de respuesta intra-aula → 2,500); calibración de p y de sobremuestra (100%→50% tras 93.5% de cobertura de aulas); nota explícita sobre el deff ("omitirla produce muestras engañosamente pequeñas y márgenes de error reales mayores a los declarados").
- **C-E04** `aulas` — "De la muestra de personas a la lista de aulas" (4 párrafos, fuentes: `propuesta-2026`, `metodologia-2025`). Contenido: fórmula de aulas por facultad; tasa de rendimiento medida empíricamente (0.53 global, patrones 0.80-1.00 / 0.50-0.72 / 0.39-0.42 por tipo de facultad); muestreo sistemático con arranque aleatorio (k, semilla fija); cascada de reemplazo M1→M2→M3 (170 previstas, 194 aplicadas).
- **C-E05** `aplicacion` — "Qué pasa el día de campo y después" (4 párrafos, fuentes: `metodologia-2025`, `ruta-asignacion`, `speech-aplicadores`, `indicaciones-aplicadores`). Contenido: aplicación QR con collectorID por aula; protocolo de campo; funciones metodológicas del guion en voz alta; cierre estadístico (3,296 respuestas válidas, 27/30 celdas sobrecumplidas, pesos 1.02 y 1.15, base final 2,471 casos con suma de pesos = 2,500).

**Nota de mapeo:** `didacticaCopy.ts:17` mapea el paso `salidas` de la UI al `respaldoId: "aplicacion"` del corpus — es decir, si en algún punto se añade un `<RespaldoMetodologico paso="salidas">`, mostraría C-E05. Al momento de esta extracción no se encontró ese uso en `salidas/` (solo `ContextoLlano paso="salidas"`, que usa el texto corto de `didacticaCopy.ts`, no el párrafo largo del corpus).

### E.2 `PASOS` — copys cortos de orientación (`didacticaCopy.ts:20-61`)

Mostrados vía `<ContextoLlano paso="..." />` en Definición, Marco, Cálculo y Salidas. El paso `aulas` conserva su copy en el corpus, pero no tiene un montaje de `ContextoLlano`; su respaldo largo sí se muestra en Sustento mediante `RespaldoMetodologico` (C-D43).

- **C-E06** `definicion`: "Aquí acordamos qué información necesitamos de la universidad y por qué: la base de matriculados dice quiénes son los estudiantes, y la de curso-horario dice en qué salones podemos encontrarlos."
- **C-E07** `marco`: "La base cruda trae de todo: posgrado, cursos virtuales, alumnos retirados. En este paso la depuramos con filtros claros hasta quedarnos solo con la población que el estudio realmente quiere representar."
- **C-E08** `calculo`: "Con la población ya definida, calculamos a cuántos estudiantes necesitamos encuestar para que el resultado sea confiable. Puedes mover los parámetros y ver cómo cambia el tamaño; la cifra final siempre la valida la calculadora."
- **C-E09** `aulas`: "No encuestamos alumno por alumno: sorteamos salones completos. Aquí el laboratorio elige qué aulas entran, con qué probabilidad, y qué aulas de reserva usar si una falla — todo con reglas auditables, no a dedo."
- **C-E10** `salidas`: "El diseño se convierte en entregables defendibles: el reporte metodológico con la memoria de cálculo completa y el anexo con las aulas seleccionadas, sus probabilidades y sus reemplazos. Cualquier revisor puede auditar cada decisión." (mismo texto citado en C-D59)

### E.3 `EJEMPLO_TRABAJADO` — narrativa completa con cifras reales (`corpus.ts:424-443`)

Mostrado en `DefEstudioTab.tsx:304-306,353-354` (única invocación en el código). Descripción: "Ejemplo trabajado con los números reales de un estudio de referencia en una universidad peruana de ~22,000 estudiantes de pregrado (15 facultades), encuestados de manera presencial en aulas con código QR." Parámetros embebidos: N=22,037, p=0.3, confianza=95%, z=1.96, e=0.025, deff=2.0, n teórico=2,310, tasa de rendimiento=0.53, sobremuestra=50%.

- **C-E11** (párrafo 1): plantea el caso, la calibración de p (30.2% de la ola anterior) y el deff.
- **C-E12** (párrafo 2): desarrolla la fórmula con la sustitución numérica completa — "numerador es 22,037 × 3.8416 × 0.21 × 2 ≈ 35,548" y "denominador es (22,036 × 0.000625) + (3.8416 × 0.21 × 2) ≈ 15.39" → n≈2,310 → ÷0.924 → 2,500; verificación ±2.39%.
- **C-E13** (párrafo 3): reparto en 15 facultades × sexo (30 cuotas), tamaños de aula (12.9 a 41.4 elegibles), tasa de rendimiento (0.39 a 1.00), 170 aulas base, sobremuestra 50% (techo 3,750).
- **C-E14** (párrafo 4): muestreo sistemático (k, arranque aleatorio), QR con identificador de aula.
- **C-E15** (párrafo 5): cierre de campo — 194 aulas aplicadas, 3,296 respuestas válidas, 27/30 cuotas sobrecumplidas, pesos 1.02 y 1.15, base final 2,471 casos con suma de pesos = 2,500.

### E.4 `BADGE_COPY` — regla de procedencia de cifras (`didacticaCopy.ts:71-75`, vía `PasoDidactico.tsx:66-77`)

- **C-E16** `validado`: "cifra validada"
- **C-E17** `preview`: "vista previa · calculando…"
- **C-E18** `error`: "sin conexión con la calculadora"

Estos tres badges son omnipresentes (aparecen junto a casi cualquier cifra o fórmula del recorrido) y encarnan una regla metodológica explícita documentada en el comentario de cabecera de `PasoDidactico.tsx:61-64`: "ningún número se muestra como definitivo sin el badge 'motor R'; mientras el motor responde, la UI enseña la vista previa etiquetada."

### E.5 Otros componentes didácticos con nota metodológica propia (no derivada literalmente del corpus)

- **C-E19** (`DistribucionFacultadSexo.tsx:62-66`): "Cada facultad recibe una cuota proporcional a su peso en el marco; dentro de cada facultad, la cuota se reparte según la composición real por sexo. Así la muestra reproduce la estructura de la universidad en vez de sobre-representar a las facultades grandes o a un solo grupo."
- **C-E20** (`CadenasReemplazoVisual.tsx:229-233`, distinción reemplazo vs. sobremuestra — nota conceptual clave): "Ojo con no confundir dos ideas: el reemplazo sustituye un aula caída (cerrada, sin permiso del docente) por una equivalente ya sorteada — misma celda o misma facultad — de modo que el diseño de la muestra se mantiene intacto. La sobremuestra, en cambio, son casos extra planificados desde el inicio para absorber la no respuesta esperada. El reemplazo cambia 'quién', la sobremuestra ajusta 'cuántos'." (con `TerminoChip termino="reemplazo"` y `termino="sobremuestra"`)
- **C-E21** (`SeleccionAulasVisual.tsx:178-183`, nota central sobre diseño probabilístico): "Ninguna de estas aulas se eligió 'a dedo'. La calculadora ordenó el marco y avanzó con un salto k — como contar '1 de cada k' en una fila — de modo que cada aula entró con una probabilidad de inclusión conocida antes del sorteo. Esa probabilidad registrada es lo que permite defender la muestra ante cualquier auditoría: se puede reconstruir por qué salió cada aula y qué chance tenía cada una." (con `TerminoChip termino="salto k"` y `termino="pi (probabilidad"`)
- **C-E22** (`SeleccionAulasVisual.tsx:251-260`, interpretación del gráfico marco vs. muestra): "Si la muestra fuera sesgada, las barras de 'Muestra' se alejarían mucho de las del 'Marco'. Cuando van casi parejas, la selección reproduce la estructura real de la universidad en cada dimensión." + `"En esta corrida, {X de Y} categorías quedaron dentro de la tolerancia declarada por la calculadora."`
- **C-E23** (`MemoriaCalculoPanel.tsx:68-72`, verificación inversa mostrada al usuario): "Verificación inversa de la calculadora: con n = {N} el margen real es ±{X}% frente al objetivo de ±{Y}%" + condicional "el diseño cumple lo prometido." / "el diseño no llega al objetivo; ajusta parámetros." — este es el mismo cálculo que el paso `retrocalculo` del decision log (C-C09), mostrado aquí en prosa.

**Total sección E: 23 copys** (incluyendo los 5 bloques largos de RESPALDOS y los 5 párrafos de EJEMPLO_TRABAJADO, cada uno contado como una unidad).

---

## F. Reporte metodológico (`ReporteMetodologicoCard` + plantillas Quarto)

### F.1 `ReporteMetodologicoCard.tsx` (tarjeta que dispara la generación del reporte, en la pestaña Salidas → Cierre)

- **C-F01** (`:40-43`): "El reporte documenta todo el diseño —parámetros, fórmula, distribución y selección de aulas— para que cualquier revisor pueda auditarlo." — es la promesa explícita de completitud/auditabilidad del reporte generado.

### F.2 Plantillas Quarto (`api/inst/plantillas/calc_muestra/`)

Prosecnur genera el reporte con una de dos plantillas Quarto según la fase del proyecto: `propuesta_preliminar.qmd` (estimación inicial, antes de validar marco) o `diseno_validado.qmd` (diseño ya validado, listo para campo). `api/R/reporte_calc_muestra.R` solo orquesta el render — no inyecta prosa propia; todo el texto narrativo vive en los `.qmd`.

#### `diseno_validado.qmd`
- **C-F02** (`:3`, subtítulo): "Diseño metodológico validado — listo para campo"
- **C-F03** (`:57-61`, callout-tip): "Este reporte documenta el diseño **validado**: marcos confirmados, técnica seleccionada, parámetros declarados, metas definitivas. Es la pieza metodológica que respalda el levantamiento de campo."
- **C-F04** (`:227-231`, sección final "Confidencialidad y restricciones de uso de datos" — texto fijo completo, **cláusula formal de manejo de datos**): "Los datos generados para este estudio tienen uso exclusivo en el marco del proyecto contratado. Las bases cuantitativas se anonimizan antes de cualquier compartición. Las transcripciones cualitativas no son compartibles si identifican participantes."
- La sección "Decisiones documentadas" (`:83-101`) imprime el `decision_log` del motor (sección C.2) sin agregar prosa propia adicional más allá de etiquetas ("Técnica:", "Origen del tamaño:", "Nivel de respaldo:").
- Captions de tabla con contenido metodológico: "Resumen de componentes validados" (`:80`), "Cuota proporcional al N de cada estrato" (`:177`), `"Aulas: base {N} + reemplazo {N} = total {N}"` (`:199-202`), "Matriz de cuotas calculada desde el marco operativo" (`:222`).

#### `propuesta_preliminar.qmd`
- **C-F05** (`:3`, subtítulo): "Propuesta metodológica preliminar — estimación inicial"
- **C-F06** (`:58-62`, callout-note): "Este reporte corresponde a una **estimación preliminar**: los universos pueden no estar todavía validados y las metas son indicativas. El diseño debe refinarse en la fase `diseno_validado` con bases recibidas y limpiadas."
- **C-F07** (`:56`, condicional si `modo_sensible`): "**Consideraciones éticas:** estudio requiere protocolos de investigación con población especial."
- **C-F08** (`:128-133`, "Lineamientos metodológicos", lista fija de 4 principios de diseño):
  1. "Cada actor puede tener un diseño distinto: el estudio es contenedor de componentes."
  2. "Marco y unidad se separan: `unidad_seleccion` ≠ `unidad_analisis`."
  3. "Solo diseños probabilísticos con marco completo y probabilidad conocida producen margen de error formal."
  4. "Los demás diseños se reportan como cobertura operacional, representatividad teórica o validez interna."
- **C-F09** (`:135-139`, "Próximos pasos", lista fija de 3 pasos): "Validar marcos por actor: limpieza, deduplicación, validación de rol único." / "Confirmar canal de campo y tasa de respuesta esperada por componente." / "Avanzar a \"diseño validado\" cuando las bases estén listas para definir cuotas finales."

**Total sección F: 9 copys principales** (más las 4 advertencias por técnica del backend que se reimprimen aquí, ya contabilizadas en C.6).

---

## Resumen de conteo por sección

| Sección | Copys extraídos |
|---|---|
| A — Glosario (`TerminoChip` / `GLOSARIO`) | 17 |
| B — Fórmulas y notas asociadas (`FormulaLatex`) | 32 |
| C — Decision log y sustento del motor R (`calc_muestra_engine.R` + `calc_muestra_aulas.R`) | 105 (55 en C.1-C.6 + 50 en C.7) |
| D — Respaldos didácticos por pestaña (desk `universidad/`, texto libre no cubierto en B/C) | ~76 (D.1: 28, D.2: 8, D.3: 4, D.4: 14 vigentes, D.5: 11, más estados vacíos/etiquetas secundarias) |
| E — Capa didáctica compartida y corpus narrativo | 23 |
| F — Reporte metodológico (tarjeta + plantillas Quarto) | 9 |
| **Total aproximado** | **~262 copys con contenido estadístico/metodológico afirmativo** |

Nota sobre cobertura: esta cifra no incluye el detalle exhaustivo del bloque de réplica histórica/demo de `calc_muestra_aulas.R` (`calc_muestra_aulas_demo_hsvg_2025`, ~130 copys adicionales catalogados de forma preliminar durante la extracción, ver nota al cierre) ni las ~20-30 etiquetas cortas de estado/auditoría de menor densidad estadística en `marcoCharts.tsx`/`marcoCards.tsx` (nombres de ejes, leyendas de gráfico, aria-labels descriptivos) — se mencionan en el cuerpo del documento pero no se numeraron individualmente por ser de bajo riesgo interpretativo.

---

## Top 5 de mayor riesgo

1. **C-C25 — Cifra de referencia operativa duplicada e inconsistente con el corpus** (`api/R/calc_muestra_engine.R:574`): "Estudiantes con N ≥ 3001 y marco de cursos-horario: conglomerados multietápico con parámetros canónicos PUCP (95% confianza, ±2.5%, deff=2, p=0.5, sobremuestra 50%). Referencia operativa: 72 aulas × 25 estudiantes ≈ 1800 encuestas base." Esta ancla numérica (72 aulas × 25 = 1,800) convive con la cifra de referencia del corpus (170 aulas, 12.9-41.4 elegibles por aula, meta 2,500) que alimenta el resto del recorrido (glosario, `EJEMPLO_TRABAJADO`, `RESPALDOS`). Si un revisor externo compara ambas cifras dentro de la misma app llega a números de aulas y de muestra distintos para un caso similar, sin que la UI explique la diferencia. Es una afirmación cuantitativa fuerte y visible en el texto que justifica por qué el sistema recomienda automáticamente una técnica.

2. **C-C81/C-D54 (`pool_controlado`) — El motor "optimizado" invalida la interpretación probabilística estándar sin que quede igual de visible en todas las superficies**: el backend documenta con precisión que `pool_controlado` rompe las probabilidades prescritas del diseño ("las probabilidades finales ya no son las del diseño: se auditan por simulación", C-B25; "Se eligio la mejor muestra entre candidatas; pi_final usa simulacion Monte Carlo posterior a la optimizacion.", C-C81), pero el copy de UI en `ComparadorMetodosVisual.tsx` lo presenta con un riesgo relativamente suave ("Las probabilidades finales dependen de simulación, así que requiere más corridas para auditarse."). Un usuario que elija este método sin leer el Sustento técnico completo (pestaña aparte) puede reportar un margen de error formal que ya no está estrictamente respaldado por el diseño declarado. Es exactamente el tipo de simplificación didáctica que podría ser técnicamente incorrecta si se cita fuera de contexto.

3. **C-A08/C-B02/C-B09/C-E03 — deff = 2.0 presentado como estándar fijo, sin banda de incertidumbre ni condición de validez explícita al usuario**: el glosario, la fórmula y el corpus repiten "deff = 2.0 como corrección estándar" para el diseño en aula, y el copy de Supuestos llega a decir "omitirla produce muestras engañosamente pequeñas y márgenes de error reales mayores a los declarados" (C-E03, RESPALDOS.calculo). Es una recomendación de decisión metodológica de alto impacto en el tamaño de muestra (duplica la varianza) presentada como si fuera universalmente aplicable a "estudiantes en aula", sin mencionar que el deff real depende del coeficiente de correlación intraclase (ρ) y del tamaño medio de conglomerado de cada estudio concreto — la única fórmula que sí lo hace explícito (`deff = 1 + (m̄-1)·ρ`, C-B09) está en un popover secundario, no en la explicación principal.

4. **C-D57/C-E23/C-C09 — "Margen de error efectivo retrocalculado" presentado como verificación de cumplimiento sin distinguir siempre el caso censal**: en varias superficies (`SalidasCierreTab.tsx`, `MemoriaCalculoPanel.tsx`, el paso `retrocalculo` del motor) se le dice al usuario "el diseño cumple lo prometido" cuando el margen retrocalculado es ≤ el objetivo. Es una afirmación de validación que un cliente o revisor externo puede citar directamente como garantía formal. El único lugar que distingue explícitamente el caso censal (n cubre todo el marco) del caso muestral real es C-D57 (`SalidasCierreTab.tsx:165-169`); en el resto de superficies (memoria de cálculo, decision log) el mensaje de "cumple" no aclara esta distinción, lo que puede sobrerrepresentar la robustez del margen declarado en estudios pequeños o cuasi-censales.

5. **C-D34 y el umbral 70%/90% de "coincidencia base-catálogo" (`MarcoConsistenciaTab.tsx:69-71`) — umbral cuantitativo de calidad de datos sin justificación textual expuesta**: la app clasifica la relación entre la base principal y el catálogo de cursos-horario como "revisar" (<70%), "aceptable" (70-90%) o "sólido" (>90%), un corte que condiciona si el usuario confía en el marco muestral resultante — pero en ningún copy visible se explica de dónde salen esos dos umbrales (70% y 90%) ni qué implica estadísticamente cruzar de una categoría a otra. Es un caso de "simplificación didáctica potencialmente incorrecta": el gauge comunica certeza visual (semáforo de colores) sobre un umbral que no tiene respaldo metodológico citado en la UI, a diferencia de casi todos los demás valores fijos del recorrido (0.95, deff=2.0, 50% de sobremuestra) que sí remiten a un `TerminoChip` o a `RESPALDOS` con cifras de estudios de referencia.

---

*Documento generado por extracción directa de código fuente (solo lectura, sin modificaciones) el 2026-07-08. Si el equipo de producto cambia copys después de esta fecha, regenerar la extracción antes de una nueva ronda de revisión metodológica.*
