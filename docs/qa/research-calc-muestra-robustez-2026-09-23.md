# E1 — Reglas de muestreo vs. motor de Cálculo de muestra (Muestra general y Acreditación)

Tipo: Registro QA fechado
Estado: Vigente
Fecha: 2026-09-24
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados

> Verificado el 2026-09-24 contra el motor en ejecución: H01 (5 sobre (100,1×6) → 0,1,1,1,1,1,1, suma 6; 10 sobre (1,1,1) → 2,4,4), H02 (piso 30 con N_h=20 → 31) y H03 (MAS N=5000, RR 0.6 → operativo 357 en vez de 595). Documento vivo del loop de Cálculo de muestra.

Fecha: 2026-09-24. Alcance: `api/R/calc_muestra_engine.R` (motor general), `api/R/helpers_calc_comunes.R` (fórmula y reparto compartidos), `api/R/calc_muestra_distribucion.R`, y como patrón de referencia `api/R/calc_muestra_aulas*.R`. Solo lectura; no se tocó el repo.

Método: lectura del código con línea exacta + ejecución aislada de las funciones del motor (`source("api/R/helpers_calc_comunes.R")` con `stop_api` simulado) para medir lo que devuelven hoy. Scripts en el scratchpad: `grid.R`, `grid2.R`. Contraste externo con `samplingbook::sample.size.prop` y `sampling::inclusionprobabilities` (instalados).

Convención: «motor» = lo que hace hoy el código; «regla» = lo que dice la literatura; severidad según el efecto sobre la muestra que se lleva a campo o sobre lo que se afirma de ella.

Hallazgo general: el motor **dimensiona** (n) pero **no selecciona** en Muestra general ni en Acreditación. Los endpoints de `api/R/router_calc_muestra.R` con sorteo son todos `/aulas/*` (líneas 967–1230); para los modos delgados solo existe `/calcular` (471), que llama a `calc_muestra_calcular_estudio` (engine:2179).

---

## R1 — n para proporción con MAS

**Regla.** Cochran (1977, §4.4): n0 = z²·p(1−p)/e²; con corrección por población finita n = n0 / (1 + (n0 − 1)/N). La variante n0/(1+n0/N) es una aproximación que da un n un poco menor (usa N en vez de N−1 en la varianza). Se redondea hacia arriba (ceiling): redondear hacia abajo entrega un e mayor al pedido. Lohr (2ª ed., §2.7) y Valliant, Dever & Kreuter (2018, cap. 3; `PracTools::nProp`) llegan a lo mismo. `samplingbook::sample.size.prop(e=.05, P=.5, N=1000)` = 278.

**Motor.** `api/R/helpers_calc_comunes.R:116-142`, `calc_n_muestra`:
```r
num <- z^2 * p * q * deff
n <- (N * num) / ((N - 1) * e^2 + num)      # :139
as.integer(ceiling(n))                        # :141
```
Algebraicamente idéntico a n0·deff / (1 + (n0·deff − 1)/N): usa **(n0−1)/N** (versión exacta de Cochran) y **ceiling**. Con N infinito o N ≤ 0 omite la FPC (:136-137). Verificado numéricamente en 21 casos (ver rejilla): coincide al entero con la fórmula de referencia y con `samplingbook` (278 para N=1000). La inversa `calc_e_desde_n_muestra` (:152-159) usa e = sqrt(z²pq·deff·(N−n)/(n(N−1))), también correcta.

Todos los caminos de n del motor pasan por esta función (`.cm_calc_n_muestra_redondeado`, engine:1991-1993, es un `max(…,1L)` sobre ella).

**Debería.** Está bien. Solo falta blindar la entrada (ver R15).
**Severidad:** sin hallazgo en la fórmula.

## R2 — n para media y para error relativo

**Regla.** Media con error absoluto e: n0 = z²S²/e² (Cochran §4.3). Con error relativo r sobre la media: n0 = z²·CV²/r², CV = S/Ȳ (Cochran §4.5). Para proporción con error relativo: n0 = z²(1−p)/(r²p). Misma FPC y ceiling. `PracTools::nCont(CV0=…, CVpop=…)` y `nProp(CV0=…)` resuelven por CV objetivo.

**Motor.** No lo soporta. `.cm_normalize_parametros` (engine:1123-1155) solo acepta z, p, e, deff y tasas; no existe S, CV ni tipo de indicador. `grep` de «relativ|sigma|varianza» en el motor no encuentra nada de cálculo (solo textos didácticos en :2710-2718).

**Debería.** Agregar `tipo_indicador ∈ {proporcion, media}` y `tipo_error ∈ {absoluto, relativo}` con S o CV declarado. Para indicadores raros (p = 0.05) el error absoluto de ±5 pp es inútil; el relativo es lo que corresponde (e=±5 pp alrededor de 5% ≡ ±100%).
**Severidad:** medio (limita la herramienta, no produce números errados).

## R3 — Efecto de diseño

**Regla.**
- Conglomerados de tamaño igual: deff = 1 + (m̄ − 1)ρ (Kish 1965, §5.4 y §8.2).
- Tamaños desiguales: deff ≈ 1 + [(1 + CV²_m)·m̄ − 1]ρ (Kish 1987; Eldridge, Ashby & Kerry 2006; Valliant et al. cap. 9, `PracTools::deffCR`).
- Pesos desiguales: deff_w = 1 + CV²_w, n_eff = n / (1 + CV²_w) (Kish 1992, *JOS* 8(2):183-200; `PracTools::deffK`).
- m̄ debe ser el número de **completas** por conglomerado (m̄·τ), no el tamaño de lista: el ρ actúa sobre quienes responden.
- En muestreo estratificado de elementos con asignación proporcional, deff ≤ 1 (Kish §3.4); usar deff = 1.5 ahí infla n sin motivo.

**Motor.**
- deff es un número exógeno: `par$deff` (engine:1129, default 1.5 en :198; 2.0 canónico estudiantes en :909). En conglomerados se aplica tal cual (:1343) y **no** se deriva de m̄, ρ ni τ: cambiar `promedio_conglomerado` cambia las aulas (:1348-1350) pero no el deff. No existe ρ/ICC en el motor (`grep icc|rho|intraclase` sin resultados).
- En `prob_estratificado` (:1664) y `prob_estratificado_independiente` (:1743) también se aplica `par$deff` (default 1.5) aunque la selección sea de elementos. Medido: N=10 000, e=5% → 545 con deff 1.5 frente a 370 con deff 1 (+47%).
- MAS fuerza deff = 1 (:1611, :1616): correcto.
- No se calcula deff por ponderación ni n_eff en ningún punto del motor general.

**Debería.** (a) Para conglomerados, pedir ρ (con default documentado y rango, p. ej. 0.02–0.10 para opinión en aulas) y calcular deff = 1 + [(1+CV²)·m̄·τ − 1]ρ, mostrando el deff resultante; dejar deff manual como override declarado. (b) Default deff = 1 en estratificado de elementos. (c) Publicar n_eff = n/deff junto a n.
**Severidad:** alto (conglomerados: deff desacoplado de m̄); alto (estratificado con deff 1.5 por defecto).

## R4 — Inflación por no respuesta, elegibilidad y cobertura

**Regla.** Sobre el n de **completas** requerido (ya con FPC): n_contactar = ⌈n / (RR × E × C)⌉, con RR = tasa de respuesta, E = tasa de elegibilidad, C = tasa de contacto (Lohr cap. 8; Valliant et al. cap. 6; AAPOR Standard Definitions para definir RR). La FPC se aplica **antes** de inflar, porque la precisión depende de las completas, no de las contactadas. Si n_contactar ≥ N, se va a censo y se reporta el e que dan las completas esperadas (N·RR·E), no el pedido. Sobremuestra para reemplazos ≠ ajuste por no respuesta: son dos cosas distintas y se suman solo si se declaran por separado.

**Motor.**
- `tasa_respuesta`, `tasa_elegibilidad`, `tasa_contacto` existen (engine:201-203, :1133-1138) pero **no se usan en ninguna técnica probabilística**: MAS (:1611-1622), estratificado (:1664-1675), sistemático (:1900-1911, hereda MAS) y conglomerado (:1342-1360) solo suman `sobremuestra = ceiling(n * oversample_pct)` (default 0.10, :200). Solo `no_prob_cuotas` (:1568), `no_prob_conveniencia` (:2105, :2127) y `listado_externo_meta_fija` (:2150-2154, la única que multiplica las tres tasas) usan tasas.
- El canónico de estudiantes rellena `tasa_respuesta = 0.70` (:910) que luego nada lee; en conglomerados el rendimiento vive en τ y en `oversample_pct = 0.50`.
- `n_operativo` no se capa en N: MAS con N=30 da n=28 y n_operativo = 28 + ⌈2.8⌉ = 31 > 30 (:1614, :1622).

Efecto medido: N=1000, e=5%, RR=0.6. Regla: ⌈278/0.6⌉ = 464 a contactar. Motor: 278 + 28 = 306. Con RR real 0.6 se esperan 184 completas → e ≈ 6.4% en vez de 5%.

**Debería.** n_operativo = min(N, ⌈n_completas / (RR·E·C)⌉) + reserva de reemplazos declarada aparte; si se capa en N, anunciar censo y el e esperado con las completas esperadas.
**Severidad:** crítico (las tasas que el usuario ve y edita no llegan al tamaño de campo); alto (sin tope N).

## R5 — Estratificado

**Regla.**
- **Error global** con asignación proporcional: V(p̂_st) = Σ W_h²(1−f_h)S_h²/n_h; con proporcional y S_h similares, el n global de MAS es buena aproximación (Cochran §5.5, §5.9).
- **Error por estrato (dominios independientes):** n_h de la fórmula R1 en cada estrato con su N_h; el total es Σn_h y el error global es menor que el de cada estrato.
- **Neyman:** n_h = n·N_hS_h/ΣN_kS_k. **Óptima con costos:** n_h ∝ N_hS_h/√c_h (Cochran §5.5; `PracTools::strAlloc`).
- **Piso mínimo:** n_h = max(piso, asignación), con el excedente descontado de los demás en iteración; nunca se suma el piso *encima* de la cuota proporcional.
- **Tope n_h ≤ N_h:** si la asignación pide n_h ≥ N_h, el estrato va a censo (n_h = N_h) y el excedente se reparte entre el resto; se itera hasta que ningún estrato supere N_h (Cochran §5.8 sobre sobreasignación en Neyman; Valliant et al. cap. 3).
- **Redondeo que suma exacto:** método del mayor resto (Hamilton): piso de cada cuota cruda y los k restos mayores reciben +1; o redondeo controlado de Cox (1987, *JASA* 82:520-524). Nunca volcar todo el residuo en un solo estrato.
- **n_h ≥ 2** en todo estrato para poder estimar varianza dentro del estrato (Cochran §5A.12; Lohr §3.5, «collapsed strata» si no se cumple).

**Motor.**
1. **Reparto «cuadratura»** (`helpers_calc_comunes.R:177-196` + `ajustar_cuadratura_residuo` :229-236): hace `ceiling()` de cada cuota (:186) y vuelca **todo** el residuo (casi siempre negativo) en el estrato de mayor peso (:232-233); si queda negativo lo pone en 0 (:234) sin volver a cuadrar. Medido:
   - 370 sobre N_h = (4000, 3500, 2500) → **147, 130, 93** (Hamilton: 148, 130, 92).
   - 10 sobre (1, 1, 1) → **2, 4, 4** (Hamilton: 4, 3, 3). Estratos iguales reciben la mitad o el doble.
   - 5 sobre (100, 1, 1, 1, 1, 1, 1) → **0, 1, 1, 1, 1, 1, 1**: el estrato con 94% del universo queda en 0 y la suma es **6 ≠ 5**.
   Lo usan `.cm_distribuir_con_piso` (engine:1995-2006 → estratificado :1689 y matriz territorio×servicio :1939) y el conglomerado para actores no universitarios (:1380-1384; `.cm_redondeo_distribucion_universitaria`, `calc_muestra_distribucion.R:14-19`). El conglomerado corrige la suma después (:1386-1389) echando la diferencia otra vez en el mayor; el estratificado no la corrige.
2. **Piso** (engine:1995-2006): si `n_total < piso·H` el piso se descarta en silencio (:1999); si no, da `piso + reparto_proporcional(resto)` a todos (:2002-2005), es decir suma el piso encima de la cuota proporcional. La etiqueta `regla = "piso_%d"` solo aparece si `n_i <= piso` (:1700), lo que casi nunca pasa.
3. **Sin tope N_h** en ningún reparto. Medido: piso 30, n=300, N_h=(20, 1000, 1000) → **33, 133, 134** (33 > 20). Con n=100 (piso descartado): 31, 34, 35 (31 > 20). En `prob_estratificado_independiente` el ajuste a meta vuelca `diff` entero en el estrato mayor (:1753-1758) y `cuota_fija` (:1739) tampoco se capa.
4. **Precisión por estrato** con n_h ≥ N_h: `calc_e_desde_n_muestra` da 0 por `pmax(N-n,0)` (:155), y el motor publica `precision_e = 0` (:1697-1699) en vez de marcar «imposible/censo».
5. **Dominios independientes:** usa `e$e_facultad %||% par$e` (:1743), pero `.cm_normalize_estratos` siempre llena `e_facultad` con default 0.05 (:1053), así que **el e global del usuario nunca llega a los estratos**. Si el usuario pone e=3% global y no toca los estratos, cada estrato se calcula a 5%. Además publica `precision_alcanzada = NA_real_` global (:1885).
6. **No hay Neyman ni asignación con costos** en el motor general (sin `grep` de neyman/S_h/costo).
7. **No se valida n_h ≥ 2.**

**Debería.** Un único repartidor: Hamilton con (i) tope N_h e iteración de excedente, (ii) piso como max(piso, cuota) con iteración, (iii) opción proporcional/Neyman/costos, (iv) aviso si algún n_h < 2 o si el piso no cabe. `.cm_aulas_quota_by_stratum` (aulas:1682-1705) ya es un mayor-resto con mínimo 1: es el punto de partida. En dominios independientes, `e_facultad` debe heredar `par$e` cuando el usuario no lo fijó (default NA, no 0.05), y publicar el e global vía varianza estratificada.
**Severidad:** crítico (reparto cuadratura; sin tope N_h); alto (piso; e global ignorado en dominios); medio (precision_e=0, sin Neyman, sin n_h≥2, e global NA).

## R6 — Sistemático

**Regla.** Intervalo k = N/n, que en general no es entero. Opciones correctas: (a) intervalo fraccional — arranque r ~ U(0, k], seleccionar ⌈r + (j−1)k⌉, j=1..n, que entrega exactamente n con π = n/N (Tillé 2006, cap. 7; Särndal et al. §3.6; equivale a `sampling::UPsystematic(rep(n/N, N))`); (b) sistemático circular (Lahiri). Con k = ⌊N/n⌋ el tamaño resultante es aleatorio y > n. Riesgo de periodicidad si la lista tiene un ciclo que coincide con k (Cochran §8.1, 8.7). Ordenar el marco por una variable correlacionada con el indicador produce estratificación implícita (Cochran §8.6; Kish §4.1); el orden del marco es parte del diseño y debe quedar registrado.

**Motor.** `.cm_calc_sistematico` (engine:1900-1911) llama a MAS y publica `intervalo_sistematico = floor(N / n)` (:1904). No selecciona. Medido: N=1000, n=300 → k=3 → según el arranque salen **334, 333 o 333** unidades, no 300.

**Debería.** Publicar k fraccional (3.333…) y, cuando exista sorteo, usar la caminata ya implementada para aulas con π = n/N iguales (`.cm_aulas_recorrido_sistematico`, `calc_muestra_aulas_recorrido.R:59-125`), que es exactamente el sistemático de intervalo fraccional y publica el arranque. Registrar la variable de orden.
**Severidad:** medio.

## R7 — PPS, certeza, π y π_ij

**Regla.**
- π_i = n·x_i/X. Unidades con n·x_i/X ≥ 1 son de **certeza** (π_i = 1); se sacan y se recalcula con n − (#certezas) sobre el resto, iterando hasta que ninguna supere 1 (Tillé 2006 §2.10; `sampling::inclusionprobabilities`).
- Métodos de tamaño fijo: sistemático PPS (simple, π_ij puede ser 0 → sin estimador de varianza insesgado; se aproxima con Hartley–Rao o tratando como con reemplazo), Brewer (1975), Sampford (1967; π_ij > 0 calculables), Pareto (Rosén 1997), cubo balanceado (Deville & Tillé 2004, *Biometrika* 91:893-912), pivotal local (Grafström, Lundström & Schelin 2012).
- Publicar π_i (y π_ij o el método de aproximación de varianza) porque el peso base es 1/π_i.

**Motor general.** No hay PPS ni selección.

**Motor de aulas (patrón).** `.cm_aulas_inclusion_probabilities` (calc_muestra_aulas.R:1891-~1920) hace la iteración de certezas; verificado que coincide con `sampling::inclusionprobabilities(c(50,30,10,5,5), 3)` = (1, 1, 0.5, 0.25, 0.25). Sistemático PPS propio (`calc_muestra_aulas_recorrido.R:59-125`), cubo determinista entre plataformas (`calc_muestra_aulas_cube_determinista.R:60`, `:135`; ADR 0073), pivotal local vía `BalancedSampling` (aulas:2005-2032), protección de certezas al cuadrar tamaño (`.cm_aulas_fix_pick_count`, aulas:1940-1980), π SRS = cuota/N para `estratificado_aleatorio` (aulas:2052-2058). No encontré cálculo de π_ij en ningún archivo (`grep` pi_ij/pikl/UPsystematicpi2 sin resultados).

**Debería.** Para Muestra general con MOS, reutilizar esas piezas. Declarar el estimador de varianza aproximado (con reemplazo / Hartley–Rao) ya que el sistemático PPS no da π_ij > 0.
**Severidad:** bajo (π_ij ausente también en aulas).

## R8 — Conglomerados bietápicos

**Regla.** Número de conglomerados a = n / m̄_completas, con n ya inflado por deff (R3). Diseño autoponderado: 1ª etapa PPS por tamaño M_i (π_i = a·M_i/ΣM), 2ª etapa tamaño fijo m̄ en cada conglomerado (π_j|i = m̄/M_i) ⇒ π = a·m̄/ΣM constante (Kish §7.5; Lohr cap. 6; INEI ENAHO usa estratificado bietápico con PPS en la primera etapa, ver fichas técnicas ENAHO). Si en la 2ª etapa se toma **todo** el conglomerado (aulas completas), el diseño es PPS de una etapa y los pesos no son constantes salvo MOS = tamaño real. `PracTools::BW2stagePPS` estima varianzas entre/dentro para dimensionar.

**Motor.** `unidades_operativas = ceiling(n_objetivo / (m̄ · τ))` (engine:1348-1350) y por estrato (:1423-1425). Correcto como aritmética, pero n_objetivo usa un deff que no depende de ese mismo m̄·τ (R3). Ejemplo: m̄=25, τ=0.7, ρ=0.04 → deff correcto 1 + (17.5−1)·0.04 = 1.66 → n=638 → 37 aulas; con deff fijo 1.96 (m̄ de lista) → 753 → 44 aulas.

**Debería.** Encadenar ρ → deff(m̄·τ, CV) → n → a, y publicar si el diseño es autoponderado o no.
**Severidad:** alto (se agrupa con R3).

## R9 — Dominios de estimación

**Regla.** Si se publicará por dominio (facultad, sexo), cada dominio necesita su n_d para el e deseado (R1 con N_d); la asignación proporcional puede dejar dominios chicos sin precisión. Compromisos: asignación de potencia (Bankier 1988, n_h ∝ N_h^q, 0 ≤ q ≤ 1), mínimo por dominio y luego proporcional con el resto, o Kish (1976/1988) con varianzas mixtas. Los estratos que son dominios planificados se manejan como estratos; los no planificados quedan con n aleatorio.

**Motor.** Dos técnicas separadas: `prob_estratificado` (proporcional + piso, :1643) y `prob_estratificado_independiente` (n por dominio, :1716). No hay una opción intermedia ni se reporta cuál es el e por dominio **antes** de elegir: el estratificado sí publica `precision_e` por estrato (:1697), que es la información correcta para ver la tensión, salvo el caso n_h ≥ N_h (R5.4).

**Debería.** Asignación de potencia con q ajustable, o «mínimo por dominio + proporcional», con tabla e_h vs e_global.
**Severidad:** medio.

## R10 — Reemplazos / sustitución

**Regla.** La sustitución de campo no corrige el sesgo de no respuesta: el sustituto se parece a quien sí responde (Chapman 1983, en Madow, Olkin & Rubin (eds.), *Incomplete Data in Sample Surveys* vol. 2; Vehovar 1999, *JOS* 15(2):335-350). Buenas prácticas si se usa: reemplazo del mismo estrato/celda, **sorteado de antemano** con orden fijo, registrado por unidad (titular → reemplazo, motivo), tasa de sustitución reportada como parte de la tasa de respuesta, y pesos calculados sobre el titular. Alternativa preferible: sobremuestra con réplicas liberadas por lotes (lotes aleatorios, se libera el siguiente solo si hace falta; todos los liberados se trabajan hasta el final), que mantiene π conocida.

**Motor general.** Solo `sobremuestra` como número (engine:1346, :1614); no hay reemplazos ni réplicas.

**Motor de aulas (patrón y advertencia).** `.cm_aulas_build_replacement_chains` (aulas:2484+) ordena candidatos por estrato, −elegibles y un `runif` de desempate (:2504-2505) y elige por **máximo puntaje** dentro de la celda, cayendo a la facultad como límite duro (`.cm_aulas_pick_chain_reserve_idx`, aulas:~2430-2470). Está pre-sorteado, registrado (`replacement_for`, `replacement_order`, aulas:2311-2336) y restringido a la facultad: bien. Pero el reemplazo se elige por puntaje, no por probabilidad, así que su π no está definida; el peso de un reemplazo debe heredar el del titular (o tratarse como no respuesta ajustada), no ser 1/π propio.

**Debería.** En Muestra general preferir réplicas liberadas; si se ofrecen reemplazos, que sean del mismo estrato, sorteados con la misma semilla y con peso del titular declarado.
**Severidad:** medio (para el diseño del sorteo nuevo).

## R11 — Reproducibilidad

**Regla.** Misma semilla + mismo marco (mismo orden) + mismo algoritmo + mismo RNG = misma muestra en cualquier máquina. Requisitos: fijar `RNGkind("Mersenne-Twister", "Inversion", "Rejection")` (desde R 3.6.0 `sample.kind="Rejection"` es default; muestras anteriores usaban "Rounding"), `set.seed()` inmediatamente antes del sorteo, orden estable del marco (ordenar por una clave explícita antes de sortear), hash del marco (SHA-256) y de la configuración publicados, y versión de R y paquetes. Aislar el RNG (guardar y restaurar `.Random.seed`) para no alterar el resto de la sesión. Cuidado con álgebra dependiente de BLAS (svd en el cubo).

**Motor de aulas.**
- Hash del marco: `.cm_aulas_hash` SHA-256 vía `digest` (aulas:66-72), `frame_hash_estable` sobre marco+filtros (aulas:1593) y `selection_run_id` con hash(frame_hash, seed) (aulas:4349). Semilla por defecto 20260619 (aulas:425).
- `set.seed(seed)` al entrar en cada selector (aulas:1941, 1989, 1997, 2006, 2083, 2094, 2156, 2486); semilla por estrato `seed + length(rows) + 13L` (aulas:2175-2177), que depende del **orden** de los estratos en el marco.
- Cubo determinista entre macOS/Linux (ADR 0073, `calc_muestra_aulas_cube_determinista.R`); el ADR se declara «parcial» (rango deficiente abierto).
- **No** se fija `RNGkind` en ningún archivo del repo (`grep RNGkind|sample.kind|RNGversion` en api/, launcher/, desktop/ sin resultados). La sesión local está en el default (Mersenne-Twister/Inversion/Rejection), pero depende de que nada lo cambie.
- Los selectores de aulas hacen `set.seed` sin restaurar `.Random.seed`; en cambio `calc_muestra_perfil.R:206-229` y `calc_muestra_asistencia_referencia.R:350-361` sí guardan y restauran (patrón a copiar).

**Motor general.** Sin sorteo. Ojo: `.cm_random_id` (engine:1168-1171) usa `sample()` y consume el RNG global; `calc_muestra_normalize_componente` la llama cuando falta id (:802). Un sorteo futuro que haga `set.seed` antes de normalizar obtendría otra muestra según haya o no ids.

**Debería.** En el sorteo general: `withr::with_seed`-equivalente local (guardar/restaurar), `RNGkind` fijado explícitamente dentro del bloque, marco ordenado por clave declarada, hash del marco ordenado, y publicar {semilla, RNGkind, versión R, versión de paquetes, hash, método}.
**Severidad:** medio (aulas: RNGkind no fijado, semillas por orden de estrato, estado global); bajo (`.cm_random_id`).

## R12 — Pesos de diseño

**Regla.** Peso base d_i = 1/π_i (Horvitz–Thompson; Särndal et al. cap. 2-3). Ajuste por no respuesta por clases de ponderación o propensión: w_i = d_i / r̂_c (Valliant et al. cap. 13). Calibración a totales conocidos: postestratificación o raking (Deville & Särndal 1992, *JASA* 87:376-382; `survey::calibrate`, `survey::rake`). Recortar pesos extremos con reporte de deff_w. Una herramienta de selección debe publicar por unidad: id, estrato, π_i (y etapa si es multietápico), peso base, semilla/método, orden de selección, estado (titular/reserva/réplica) y el marco (N_h) para la calibración posterior.

**Motor general.** No produce π ni pesos.

**Motor de aulas.** Publica `pi_design_candidate` (aulas:2194), `pi_final` y su rescate (aulas:3810), y pesos 1/π (aulas:3068-3069). Buen precedente.

**Debería.** El sorteo general debe salir con la misma tabla: id, estrato, N_h, n_h, π_i, d_i = 1/π_i, semilla, hash.
**Severidad:** alto (en cuanto exista sorteo en Muestra general; hoy no hay nada que ponderar).

## R13 — Muestreo no probabilístico (cuotas, conveniencia)

**Regla.** Sin probabilidades de selección conocidas no hay margen de error de muestreo de diseño. AAPOR (2013, Task Force on Non-probability Sampling; y declaración «Margin of Sampling Error/Credibility Interval», 2023) pide no reportar MoE para muestras opt-in/no probabilísticas; si se usa un «intervalo de credibilidad» bayesiano, debe declararse como tal, con sus supuestos de modelo, y no presentarse como MoE. Lo que sí se puede afirmar: descripción del grupo respondiente, composición lograda frente a cuotas, y comparaciones con benchmarks externos.

**Motor.** Correcto en lo esencial: `.CM_PERMITE_MARGEN_POR_TECNICA` pone FALSE para cuotas, conveniencia, censal, barrido y listado (engine:139-151), `calc_muestra_validar_inferencia` lo bloquea (:1182-1192) y las advertencias lo dicen (:1580-1581, :2137-2140). Dos matices:
- `intencion_censal` escribe «Aplica TCL: con n >= 30 la lectura es estable» (:1556-1557) y el comentario de defaults llama a 30 «mínimo TCL para análisis válido» (:208). El TCL habla de la distribución de una media bajo muestreo aleatorio; no protege contra sesgo de no respuesta, que es el riesgo de un censo con 60% de cobertura.
- Cuotas infla dos veces: /tasa_respuesta y luego + oversample sobre ese resultado (:1568-1569).

**Debería.** Reemplazar el texto del TCL por: «Censo con cobertura X%: no hay error de muestreo; el riesgo es sesgo por no respuesta. Reportar cobertura por estrato y comparar composición con el marco». Opcional: publicar un e «bajo supuesto de respuesta aleatoria» con FPC, rotulado explícitamente como supuesto.
**Severidad:** medio (texto TCL); bajo (doble inflación en cuotas).

## R14 — Acreditación universitaria (SINEACE / ICACIT / ABET)

**Lo encontrado.** Busqué en el repositorio de SINEACE (modelo de acreditación de programas universitarios, explicación de estándares) y en los criterios de ICACIT 2025: **no hallé ningún lineamiento con tamaños de muestra, mínimos de cobertura ni tasas de respuesta** para encuestas a estudiantes, docentes, egresados o empleadores. Los modelos piden evidencia de satisfacción y seguimiento de egresados (SINEACE: 34 estándares, dimensión de seguimiento a egresados) y que los objetivos educacionales reflejen a los «constituyentes» (ICACIT), pero dejan el diseño al programa. Según lo que conozco de ABET, tampoco prescribe tamaños de muestra (evalúa procesos de *assessment*); no lo verifiqué en la web en esta sesión. Por tanto, los umbrales del motor son **reglas internas de PULSO (cuadro maestro marzo 2026)**, no normas del acreditador, y así deberían rotularse.

Fuentes consultadas: [SINEACE – Explicación de estándares](https://repositorio.sineace.gob.pe/repositorio/handle/20.500.12982/5490), [SINEACE – Modelo de acreditación de programas universitarios](https://repositorio.sineace.gob.pe/repositorio/handle/20.500.12982/4086), [ICACIT – Criterios de acreditación](https://webicacit.com/es/acreditacion/criterios-de-acreditacion), [ICACIT – Criterios pregrado 2025](https://webicacit.com/archivos/2025_ICACIT_Criterios_Glosario.pdf).

**Motor.** `.cm_inferir_acreditacion` (engine:877-951):
- administrativos → censal 80% (:878-885); docentes N ≤ 250 → censal 60%, N ≥ 251 → cuotas 150 por dedicación (:886-902); estudiantes aula_qr y N ≥ 3001 → conglomerados z=1.96, e=2.5%, deff 2, sobremuestra 50% (:904-916), si no → censal 60% (:917-922); egresados N ≤ 300 → censal 50%, N ≥ 301 → conveniencia clamp(⌈0.5N⌉, 30, 150) (:924-946).
- La inferencia **sobrescribe la técnica elegida** por el usuario (:753-756).
- `fill_default` (:763-775) reemplaza un valor explícito cuando coincide con el default global (:769-772): un usuario que escribe e = 0.05 para estudiantes ≥ 3001 obtiene 0.025, porque el motor no distingue «puse 0.05» de «no puse nada».

Observaciones metodológicas:
- **Discontinuidad en N = 3000/3001**: N=3000 → meta censal ⌈0.6·3000⌉ = 1800 completas; N=3001 → n = 1519 (e=2.5%, deff 2). Un universo mayor recibe una meta menor.
- **Docentes N ≥ 251 a cuotas**: la nómina de docentes suele ser un marco completo (RR.HH.), así que un MAS o estratificado por dedicación es factible y daría margen de error. 150 docentes de N=400 por MAS darían e ≈ 6.3% (z=1.96, p=0.5); por cuotas no se puede afirmar nada de eso.
- Egresados: el tope de 150 es fijo para cualquier N > 300; con N=1000 y MAS serían ±7.4%. Como conveniencia, sin margen.

**Debería.** Rotular los umbrales como política interna; permitir que el usuario elija técnica probabilística cuando hay marco completo (docentes, egresados con padrón); suavizar el salto 3000/3001 (p. ej., a partir de N en que n_MAS < 0.6N, usar muestra); distinguir «no especificado» de «igual al default» (usar NULL/NA, no comparar contra el default).
**Severidad:** medio (sobrescritura de técnica y fill_default; discontinuidad; docentes a cuotas).

## R15 — Valores por defecto y validación de entradas

**Regla.** Defaults defendibles: z = 1.96 (95%), p = 0.5 (varianza máxima, conservador cuando no hay dato previo), e = 0.05 para la población total (0.03 si se exige más; 0.05–0.10 por dominio), deff = 1 en MAS/estratificado de elementos y derivado en conglomerados. Validaciones: 0 < e < 1 (y avisar si e ≥ 0.5 o si e > p para proporciones raras, R2), 0 < p < 1, z > 0 o nivel de confianza ∈ (0,1), N entero ≥ 1, deff ≥ 1 (o > 0 si se admite estratificado), tasas ∈ (0,1], n ≤ N. Un valor inválido se **rechaza con error**; no se sustituye en silencio.

**Motor.**
- `calc_num` (helpers:261-265) devuelve el default si el valor está fuera de rango, y `.cm_normalize_parametros` (engine:1126-1153) lo usa para z [0.5, 5], p [0, 1], e [0.001, 0.5], deff [1, 10], tasas [0.01, 1]. Consecuencias medidas por lectura:
  - e = 3 (el usuario quiso 3%) → fuera de rango → **0.05 en silencio**.
  - e = 0 → 0.05 en silencio. deff = 0.8 → 1.5 en silencio (en conglomerado, la validación de :1212 nunca ve el 0.8).
  - z = 0.3 → 1.96 en silencio.
- **p = 0 o 1 se aceptan** (engine:1127; helpers:125 valida [0,1]): `calc_n_muestra(1000, p=0)` = 0 (medido), y `.cm_aplicar_ajuste_objetivo` (:1631) cae a `meta_valor` (0) → componente con n=0 sin error.
- `calc_n_muestra` sí rechaza con `stop_api` NA, e ∉ (0,1), p ∉ [0,1], deff < 1 (helpers:117-132), pero la normalización llega antes y ya sustituyó.
- `.cm_aplicar_ajuste_objetivo` (:1629-1636): si hay `meta$valor > 0` manda **aunque sea menor** que n_teorico; `precision_alcanzada` sí refleja el e real (:1615-1617), pero no hay advertencia. `prob_estratificado_independiente` usa la regla opuesta, `max(meta, n_teorico)` (:1747-1751).
- n ≤ N: la fórmula lo garantiza, pero n_operativo no (R4) y n_h no (R5).
- Recomendador (`calc_muestra_recomendar`, :2202-2273): `marcoOrdenado` se evalúa antes que `tieneEstratos` (:2259-2266), así que un marco ordenado y estratificado recibe sistemático; aceptable si el orden implícito estratifica, pero no se explica.

**Debería.** Validación con `stop_api(400, "E_CALC_*")` en la normalización del componente (o, como mínimo, un campo `parametros_corregidos` con el valor recibido y el aplicado); p ∈ (0,1) abierto; heurística para e ≥ 1 («¿quisiste decir e/100?»); advertencia explícita cuando la meta queda por debajo de n_teorico.
**Severidad:** alto (sustitución silenciosa); medio (p=0/1; meta menor sin aviso); bajo (orden del recomendador).

---

## (a) Tabla de hallazgos priorizada

| id | regla | archivo:línea | qué pasa hoy | qué debería pasar | sev. |
|---|---|---|---|---|---|
| H01 | R5 | helpers_calc_comunes.R:186, :229-236; engine:1689, :1939, :1380 | Reparto «cuadratura»: ceiling + todo el residuo al estrato mayor; si queda negativo lo pone en 0 y la suma no cierra. 5 sobre (100,1×6) → 0,1,1,1,1,1,1 (suma 6); 10 sobre (1,1,1) → 2,4,4 | Mayor resto (Hamilton) o Cox; suma exacta; nunca vaciar el estrato mayor | crítico |
| H02 | R5 | engine:1995-2006, :1739, :1753-1758 | Ningún reparto capa n_h ≤ N_h; piso 30 con N_h=20 → n_h=33 | Censo del estrato y redistribución iterativa del excedente | crítico |
| H03 | R4 | engine:1611-1622, :1664-1675, :1342-1360 | tasa_respuesta/elegibilidad/contacto ignoradas en técnicas probabilísticas; solo +10% sobremuestra. N=1000, RR 0.6: 306 en vez de 464 | n_contactar = ⌈n/(RR·E·C)⌉ tras FPC; reserva aparte | crítico |
| H04 | R15 | helpers:261-265; engine:1126-1153 | Entradas fuera de rango se reemplazan por default en silencio (e=3 → 0.05; deff 0.8 → 1.5; z 0.3 → 1.96) | Rechazar con stop_api E_CALC_* o declarar la corrección | alto |
| H05 | R4 | engine:1614, :1622 (idem :1667, :1675, :1346) | n_operativo no se capa en N (N=30 → 31) | min(N, …) y aviso de censo con e esperado | alto |
| H06 | R3/R8 | engine:1129, :1343, :1348-1350 | deff exógeno en conglomerados, no depende de m̄, τ, CV ni ρ | deff = 1+[(1+CV²)m̄τ−1]ρ con override declarado | alto |
| H07 | R3 | engine:198, :1664, :1743 | Estratificado de elementos usa deff default 1.5 (N=10 000: 545 vs 370) | deff = 1 por defecto en estratificado | alto |
| H08 | R5 | engine:1053 vs :1743 | e global ignorado en dominios independientes: e_facultad siempre trae 0.05 | e_facultad NA por defecto y heredar par$e | alto |
| H09 | R5 | engine:1999, :2002-2005, :1700 | Piso descartado en silencio si no cabe; se suma encima de la cuota proporcional; etiqueta «piso» casi nunca aparece | max(piso, cuota) con iteración; aviso si no cabe | alto |
| H10 | R12/R11 | router_calc_muestra.R:471 (solo /calcular) | Muestra general y Acreditación no sortean: sin π, pesos, semilla ni hash | Sorteo con tabla id/estrato/π/peso/semilla/hash | alto |
| H11 | R6 | engine:1904 | Intervalo sistemático floor(N/n): N=1000, n=300 → 333/334 unidades | k fraccional N/n con arranque U(0,k] | medio |
| H12 | R15 | engine:1629-1636 vs :1747-1751 | Meta menor que n_teorico manda sin aviso; regla opuesta en dominios | Regla única y advertencia de e no alcanzado | medio |
| H13 | R5 | engine:1697-1699; helpers:155 | precision_e = 0 cuando n_h ≥ N_h | Marcar censo/imposible | medio |
| H14 | R5 | engine:1885 | Dominios independientes: precisión global NA | e global por varianza estratificada | medio |
| H15 | R5/R9 | engine:1643-1897 | Sin Neyman, costos, potencia ni control n_h ≥ 2 | Opciones de asignación + aviso n_h<2 | medio |
| H16 | R14 | engine:753-756, :763-775 | Inferencia de acreditación sobrescribe técnica; fill_default pisa valores explícitos iguales al default | Respetar elección; distinguir ausente de default | medio |
| H17 | R14 | engine:903-922 | Salto N=3000 (1800 completas) → N=3001 (1519) | Transición monótona. **Cerrado 2026-09-24** (ADR 0091): corte por precisión; censo mientras la muestra a ±2,5 % deff 2 pediría ≥ 60 % (N ≈ 2 052), luego el n de esa precisión; monótona y sin saltos | medio |
| H18 | R14 | engine:895-901 | Docentes N ≥ 251 → cuotas 150 aun con nómina completa | Ofrecer MAS/estratificado por dedicación. **Cerrado 2026-09-24** (ADR 0091): con nómina, MAS a ±5 % (estratificado por dedicación si el marco la trae) desde N ≈ 259; antes, censo 60 % | medio |
| H19 | R13 | engine:1556-1557, :208 | «Aplica TCL, n ≥ 30 estable» en censal | Texto sobre sesgo de no respuesta y cobertura | medio |
| H20 | R15 | engine:1127; helpers:125; engine:1631 | p = 0 o 1 aceptado → n = 0 sin error | p ∈ (0,1) abierto | medio |
| H21 | R2 | engine:1123-1155 | Sin n para medias ni error relativo | tipo_indicador/tipo_error | medio |
| H22 | R11 | aulas:1941…2486, :2175-2177; sin RNGkind en repo | RNGkind no fijado; set.seed sin restaurar estado global; semilla por estrato depende del orden | RNGkind explícito, RNG aislado, semilla por clave de estrato | medio |
| H23 | R10 | aulas:2484-2505, ~2430-2470 | Reemplazos elegidos por puntaje (π indefinida) | Peso del titular declarado; en general preferir réplicas | medio |
| H24 | R9 | engine:1643 vs :1716 | Proporcional o independiente, nada intermedio | Asignación de potencia / mínimo por dominio | medio |
| H25 | R11 | engine:1168-1171, :802 | .cm_random_id consume RNG global | Ids sin RNG o sorteo con RNG aislado | bajo |
| H26 | R13 | engine:1568-1569 | Cuotas: /RR y luego +oversample sobre eso | Declarar una sola inflación | bajo |
| H27 | R15 | engine:2259-2266 | Recomendador: sistemático antes que estratificado | Explicar o reordenar | bajo |
| H28 | R7 | (ausente en todo api/R) | Sin π_ij ni estimador de varianza declarado para sistemático PPS | Declarar aproximación (con reemplazo/Hartley–Rao) | bajo |

Conteo: **3 críticos, 7 altos, 14 medios, 4 bajos** (28 hallazgos). Sin hallazgo: la fórmula de n (R1) y su inversa.

---

## (b) Rejilla de casos para testthat (E2)

Todos con `calc_n_muestra(N, p, z, e, deff)`; «esperado» es la regla correcta; «motor hoy» es lo medido con los scripts. Fórmula: n0 = z²p(1−p)·deff/e²; n = n0/(1+(n0−1)/N); ceiling. Las tasas se aplican después: n_contactar = ⌈n/(RR·E)⌉ (ceiling sobre el n entero de completas, que es lo conservador), con tope N.

**B1. Tamaño base (debe pasar hoy: son el contrato de R1)**

| # | N | p | e | z | deff | aritmética | esperado | motor hoy |
|---|---|---|---|---|---|---|---|---|
| 1 | Inf | .5 | .05 | 1.96 | 1 | 3.8416·.25/.0025 = 384.16 | 385 | 385 |
| 2 | 1e6 | .5 | .05 | 1.96 | 1 | 384.16/(1+383.16/1e6) = 384.013 | 385 | 385 |
| 3 | 1000 | .5 | .05 | 1.96 | 1 | 384.16/(1+383.16/1000) = 277.741 | 278 | 278 |
| 4 | 30 | .5 | .05 | 1.96 | 1 | 384.16/(1+383.16/30) = 27.894 | 28 | 28 |
| 5 | 500 | .5 | .10 | 1.96 | 1 | n0 = 96.04; 96.04/(1+95.04/500) = 80.700 | 81 | 81 |
| 6 | Inf | .05 | .05 | 1.96 | 1 | 3.8416·.0475/.0025 = 72.990 | 73 | 73 |
| 7 | 10000 | .05 | .01 | 1.96 | 1 | n0 = 1824.76; /(1+1823.76/10000) = 1543.299 | 1544 | 1544 |
| 8 | Inf | .5 | .05 | 2.576 | 1 | 6.635776·.25/.0025 = 663.578 | 664 | 664 |
| 9 | Inf | .5 | .05 | 1.645 | 1 | 2.706025·.25/.0025 = 270.603 | 271 | 271 |
| 10 | Inf | .5 | .05 | 1.96 | 2 | 384.16·2 = 768.32 | 769 | 769 |
| 11 | 5000 | .5 | .05 | 1.96 | 1.5 | n0 = 576.24; /(1+575.24/5000) = 516.785 | 517 | 517 |
| 12 | 3001 | .5 | .025 | 1.96 | 2 | n0 = 3073.28; /(1+3072.28/3001) = 1518.605 | 1519 | 1519 |
| 13 | 1 | .5 | .05 | 1.96 | 1 | 384.16/(1+383.16/1) = 1.000 | 1 | 1 |
| 14 | 2 | .5 | .05 | 1.96 | 1 | 384.16/(1+383.16/2) = 1.995 | 2 | 2 |
| 15 | Inf | .5 | .03 | 1.96 | 1 | 3.8416·.25/.0009 = 1067.111 | 1068 | 1068 |
| 16 | 10000 | .5 | .03 | 1.96 | 1 | 1067.111/(1+1066.111/10000) = 964.305 | 965 | 965 |
| 17 | 200 | .3 | .05 | 1.96 | 1 | n0 = 3.8416·.21/.0025 = 322.694; /(1+321.694/200) = 123.710 | 124 | 124 |
| 18 | 30 | .5 | .05 | 1.96 | 2 | n0 = 768.32; /(1+767.32/30) = 28.909 | 29 | 29 |

Control de la variante n0/N (no debe usarse): caso 3 daría 277.540 → 278 (igual al entero), caso 12 daría 1518.355 → 1519; la diferencia no se ve al entero en estos casos, así que el test debe comparar el **valor sin redondear** de una función interna, o usar N chico: N=2 → 1.990 vs 1.995 (ambos 2). Recomendación: testear la fórmula exacta con `expect_equal(n_crudo, 277.7408, tolerance=1e-4)` si E2 expone el crudo.

**B2. Efecto de diseño derivado (R3/R8)**

| # | entrada | aritmética | esperado |
|---|---|---|---|
| 19 | N=Inf, m̄=25, ρ=.04, CV_m=0 | deff = 1+24·.04 = 1.96; 384.16·1.96 = 752.954 | 753 |
| 20 | N=Inf, m̄=25, ρ=.04, CV_m=.5 | deff = 1+[(1.25)·25−1]·.04 = 2.21; 384.16·2.21 = 848.994 | 849 |
| 21 | N=Inf, m̄=25, τ=.7, ρ=.04 | m̄τ = 17.5; deff = 1+16.5·.04 = 1.66; n = 637.7 → 638; aulas = ⌈638/17.5⌉ = ⌈36.46⌉ | n=638, a=37 (motor con deff fijo 1.96: 753 y 44) |
| 22 | pesos con CV_w = .5, n = 400 | deff_w = 1.25; n_eff = 400/1.25 | 320 |

**B3. Inflación y tope N (R4) — hoy fallan**

| # | entrada | aritmética | esperado | motor hoy |
|---|---|---|---|---|
| 23 | N=1000, p=.5, e=.05, RR=.6, E=1 | 278/.6 = 463.33 | 464 | 306 (278 + ⌈27.8⌉) |
| 24 | N=Inf, RR=.7, E=.9 | 385/.63 = 611.11 | 612 | 385 + 39 = 424 |
| 25 | N=30, RR=.6 | 28/.6 = 46.67 → 47 > 30 → censo 30; completas esperadas 18; e = sqrt(.9604·12/(18·29)) = 0.1486 | 30, aviso censo, e≈14.9% | 31 (sin tope) |
| 26 | N=30, oversample=.10, sin RR | 28 + 3 = 31 | ≤ 30 | 31 |

**B4. Estratificación (R5) — hoy fallan**

| # | entrada | aritmética | esperado | motor hoy |
|---|---|---|---|---|
| 27 | n=370, N_h=(4000,3500,2500), proporcional | crudo 148, 129.5, 92.5; pisos 148,129,92 = 369; resto 1 al primer 0.5 | 148, 130, 92 | 147, 130, 93 |
| 28 | n=10, N_h=(1,1,1) | crudo 3.33 c/u; pisos 9; resto 1 al primero | 4, 3, 3 | 2, 4, 4 |
| 29 | n=5, N_h=(100,1,1,1,1,1,1) | crudo 4.72, .047×6; pisos 4; resto 1 al 4.72 | 5, 0, 0, 0, 0, 0, 0 (+ aviso n_h<2) | 0, 1, 1, 1, 1, 1, 1 (suma 6) |
| 30 | n=300, N_h=(20,1000,1000), piso 30 | estrato 1: max(30, 2.97) = 30 > 20 → censo 20; resto 280 → 140, 140 | 20, 140, 140 | 33, 133, 134 |
| 31 | n=100, N_h=(20,1000,1000), piso 30 | censo 20; 80 → 40, 40 (piso cumple) | 20, 40, 40 | 31, 34, 35 |
| 32 | independiente, N_h=(30, 5000), e=.05, deff=1 | N=30: 27.894 → 28; N=5000: 384.16/(1+383.16/5000) = 356.8 → 357 | 28, 357 (suma 385) | con el deff default 1.5: 29 y 517 |
| 33 | Neyman, n=300, N_h=(2000,2000), p_h=(.5,.1) | S_h = .5, .3; 300·(1000, 600)/1600 = 187.5, 112.5; Hamilton | 188, 112 | no soportado |
| 34 | dominios, par$e = .03 global, estratos sin e_facultad, N_h=(5000) | n = 1067.111/(1+1066.111/5000) = 879.4 → 880 (deff 1) | 880 | usa e=.05 → 517 con deff 1.5 |

Cálculo del caso 32 con deff 1 (el motor hoy aplica 1.5): N=30 → 28; N=5000 → 356.8 → 357. Con deff 1.5 el motor da 29 y 517. El test debe fijar deff=1 explícito.

**B5. Sistemático (R6)**

| # | entrada | esperado | motor hoy |
|---|---|---|---|
| 35 | N=1000, n=300 | k = 3.333…; tamaño exacto 300 para cualquier arranque | k=3; 334/333 |

**B6. Validación (R15) — hoy fallan**

| # | entrada | esperado | motor hoy |
|---|---|---|---|
| 36 | e = 3 | error E_CALC_ERROR_RANGO (o aviso «¿0.03?») | e = 0.05 en silencio |
| 37 | p = 0 | error E_CALC_P_RANGO | n = 0 |
| 38 | deff = 0.8 en conglomerado | error o motivo de inferencia con 0.8 | 1.5 en silencio |
| 39 | N = 0 con técnica probabilística | error de marco | n NA/no permitido (engine:1596-1598) |

Egresados (control de política, pasa hoy): N=301 → clamp(⌈150.5⌉=151, 30, 150) = 150.

---

## (c) Paquetes R de referencia instalados

Ejecutado `Rscript` (R 4.5.1, RNGkind = Mersenne-Twister / Inversion / Rejection):

| paquete | instalado | versión |
|---|---|---|
| PracTools | **no** | — |
| samplingbook | sí | 1.2.4 |
| sampling | sí | 2.11 |
| survey | sí | 4.4.8 |
| BalancedSampling | sí | 2.1.1 |
| digest | sí | 0.6.39 |

`api/DESCRIPTION` declara `digest` (l.37), `sampling` (l.80) y `BalancedSampling` (l.81); `survey` y `samplingbook` no están declarados (sirven solo como oráculo en tests si se agregan a Suggests). PracTools no está: si E2 lo quiere como oráculo (`nProp`, `deffK`, `strAlloc`), hay que instalarlo o tomar sus fórmulas a mano.

---

## (d) Piezas del modo aulas para reutilizar en el sorteo de Muestra general

| pieza | dónde | para qué |
|---|---|---|
| `.cm_aulas_quota_by_stratum` | calc_muestra_aulas.R:1682-1705 | Mayor resto con mínimo 1 por estrato; base del repartidor único (falta agregarle tope N_h, piso e iteración) |
| `.cm_aulas_quota_estratos` (afijación en dos niveles, targets capados y sin redistribución silenciosa) | calc_muestra_aulas_afijacion.R:46-81 | Afijación declarada por dominio, con falla explícita si un estrato cruza dominios (:55-62) |
| `.cm_aulas_inclusion_probabilities` | calc_muestra_aulas.R:1891-~1920 | π con certezas iterativas (verificado = `sampling::inclusionprobabilities`) |
| `.cm_aulas_measure_of_size` | calc_muestra_aulas.R:1876-1889 | MOS con winsorización opcional y MOS 0 para unidades vacías |
| `.cm_aulas_recorrido_sistematico` | calc_muestra_aulas_recorrido.R:59-125 | Sistemático PPS / de intervalo fraccional con arranque publicado; con π = n/N resuelve R6 |
| `.cm_aulas_samplecube_estable` + `.cm_aulas_svd_canonico` | calc_muestra_aulas_cube_determinista.R:135, :60 | Cubo balanceado reproducible entre plataformas (ADR 0073) |
| `.cm_aulas_pick_local` | calc_muestra_aulas.R:2005-2032 | Pivotal local (BalancedSampling 2.x) encadenado por éxito |
| `.cm_aulas_pick_indices` (despachador, regla D1 π=n/N en SRS, «cuota ≥ estrato = censo») | calc_muestra_aulas.R:2034-~2125 | Estructura de despacho por método con avisos de fallback |
| `.cm_aulas_fix_pick_count` | calc_muestra_aulas.R:1940-1980 | Cuadrar tamaño sin recortar certezas y divulgando el ajuste |
| `.cm_aulas_hash`, `frame_hash_estable`, `selection_run_id` | calc_muestra_aulas.R:66-72, :1593, :4349 | Hash SHA-256 del marco+config y id de corrida |
| Guardar/restaurar `.Random.seed` | calc_muestra_perfil.R:206-229; calc_muestra_asistencia_referencia.R:350-361 | Aislar el RNG (lo que los selectores de aulas no hacen) |
| π publicado y pesos 1/π; rescate de π_final | calc_muestra_aulas.R:2194, :3068-3069, :3810 | Tabla de salida con π y peso base |
| Cadenas de reemplazo con facultad como límite duro y registro titular→reserva | calc_muestra_aulas.R:2484+, :2311-2336, ~:2430-2470 | Patrón de registro; para general, cambiar puntaje por orden aleatorio pre-sorteado o usar réplicas |
| Simulación de certeza de cobertura | calc_muestra_aulas_certeza.R:359 (`calc_muestra_aulas_certeza`) | Idea reutilizable: cuántas unidades para alcanzar la meta en el 95% de los sorteos cuando el rendimiento por unidad varía |
| Rerandomización con criterio de cobertura | calc_muestra_aulas_rerandomizacion.R:104 | Solo si se publica π_final por Monte Carlo (ya existe el mecanismo) |

Lo que **no** conviene copiar tal cual: semilla por estrato `seed + length(rows) + 13L` (aulas:2175-2177), que depende del orden de estratos; mejor derivar la semilla de estrato de un hash de (semilla, clave del estrato).

---

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques*, 3ª ed. Wiley. §4.3–4.5 (n para medias/proporciones), cap. 5 (estratificado, §5.5 Neyman/costos, §5.8), cap. 8 (sistemático), caps. 9–11 (conglomerados y submuestreo).
- Kish, L. (1965). *Survey Sampling*. Wiley. §5.4 y §8.2 (deff de conglomerados), §7.5 (autoponderación), §11.7 (pesos).
- Kish, L. (1992). Weighting for unequal P_i. *Journal of Official Statistics* 8(2):183-200.
- Lohr, S. (2019/2022). *Sampling: Design and Analysis*, 2ª/3ª ed. Caps. 2 (n), 3 (estratificado), 5–6 (conglomerados, PPS), 8 (no respuesta).
- Valliant, R., Dever, J. A., Kreuter, F. (2018). *Practical Tools for Designing and Weighting Survey Samples*, 2ª ed. Springer; paquete PracTools (`nProp`, `nCont`, `deffK`, `deffCR`, `strAlloc`, `BW2stagePPS`).
- Särndal, C.-E., Swensson, B., Wretman, J. (1992). *Model Assisted Survey Sampling*. Springer. Caps. 2–3 (π-estimador, sistemático).
- Tillé, Y. (2006). *Sampling Algorithms*. Springer; paquete `sampling`. Deville, J.-C., Tillé, Y. (2004). Efficient balanced sampling: the cube method. *Biometrika* 91:893-912.
- Grafström, A., Lundström, N., Schelin, L. (2012). Spatially balanced sampling through the pivotal method. *Biometrics* 68:514-520.
- Rosén, B. (1997). On sampling with probability proportional to size. *J. Stat. Planning and Inference* 62:159-191.
- Cox, L. H. (1987). A constructive procedure for unbiased controlled rounding. *JASA* 82:520-524.
- Deville, J.-C., Särndal, C.-E. (1992). Calibration estimators in survey sampling. *JASA* 87:376-382.
- Bankier, M. (1988). Power allocations. *Survey Methodology* 14:93-99.
- Chapman, D. W. (1983). The impact of substitution on survey estimates. En Madow, Olkin & Rubin (eds.), *Incomplete Data in Sample Surveys*, vol. 2. Academic Press.
- Vehovar, V. (1999). Field substitution and unit nonresponse. *Journal of Official Statistics* 15(2):335-350.
- AAPOR (2013). Report of the Task Force on Non-probability Sampling. AAPOR (2023). [Margin of Sampling Error/Credibility Interval](https://aapor.org/wp-content/uploads/2023/01/Margin-of-Sampling-Error-508.pdf); [Understanding a «credibility interval»](https://aapor.org/statements/understanding-a-credibility-interval-and-how-it-differs-from-the-margin-of-sampling-error-in-a-public-opinion-poll/).
- SINEACE: [Explicación de estándares](https://repositorio.sineace.gob.pe/repositorio/handle/20.500.12982/5490); [Modelo de acreditación de programas universitarios](https://repositorio.sineace.gob.pe/repositorio/handle/20.500.12982/4086). ICACIT: [Criterios de acreditación](https://webicacit.com/es/acreditacion/criterios-de-acreditacion). Ninguno fija tamaños de muestra.
- INEI, ENAHO — fichas técnicas (diseño probabilístico, estratificado, bietápico, PPS en la 1ª etapa). No consulté la ficha en esta sesión; cito solo el tipo de diseño.

Limitaciones de este borrador: los números de sección de Cochran/Kish/Lohr se citan de memoria (verificar antes de publicarlos en un entregable). No leí el frontend de los modos delgados más allá de `modules.ts` y `CalcMuestraPage.tsx:522-595`, así que no confirmé qué campos (tasa_respuesta, e_facultad) muestra la UI; H03 y H08 son hallazgos de motor independientes de eso.
