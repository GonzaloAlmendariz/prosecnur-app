# Estudio de mecanismos de selección de manzanas titulares — 2026-10-29

Fase 1 (diagnóstico y simulación) del encargo de Gonzalo sobre el sesgo del PPS hacia manzanas grandes. No cambia
el sorteo. La propuesta de cambio está en el ADR 0120 (borrador, «Propuesto»).

- **Marco**: `acnur_acg` (proyecto de referencia anonimizado), `frame_source = current`. Son 6 distritos y 30 127
  manzanas con viviendas > 0, de 38 993 en total. Las demás tienen π = 0 en todo mecanismo (ADR 0117 §3).
- **Diseño**: 200 entrevistas por distrito, es decir, 25 rutas de 8 entrevistas.
- **Simulación**: [`api/scripts/estudio_mecanismos_seleccion_manzanas.R`](../../api/scripts/estudio_mecanismos_seleccion_manzanas.R).
  - **R = 2000** réplicas por mecanismo y distrito, con semilla base 20261029 y una semilla fija por
    (mecanismo, distrito). La corrida tardó 96 s en una sola sesión.
  - El mecanismo (a) usa las funciones del motor (`.hojas_ruta_sorteo_pi`, `.cm_aulas_recorrido_sistematico`) y
    la misma lista ordenada zona → manzana → `id_manzana`. Es el sorteo de hoy, no una réplica de él.

## 1. Diagnóstico

### Distribución de viviendas por manzana

| Distrito | Manzanas | p50 | p95 | p99 | Máx. | π en el 5 % más grande | π en el 1 % más grande | Manzanas ≥ 100 viv. | π en ellas | π máx. |
|---|---|---|---|---|---|---|---|---|---|---|
| Ate | 6 982 | 12 | 77 | 142 | 1 716 | 28,4 % | 10,5 % | 185 | 19,0 % | 0,275 |
| Chorrillos | 2 163 | 28 | 85 | 234 | 752 | 24,8 % | 10,8 % | 83 | 21,5 % | 0,238 |
| Los Olivos | 1 856 | 42 | 97 | 136 | 1 204 | 15,8 % | 6,1 % | 84 | 14,2 % | 0,337 |
| S. J. de Lurigancho | 11 820 | 12 | 71 | 111 | 804 | 23,4 % | 7,3 % | 182 | 9,9 % | 0,079 |
| S. J. de Miraflores | 3 107 | 23 | 65 | 90 | 195 | 16,1 % | 4,4 % | 21 | 3,1 % | 0,059 |
| S. Martín de Porres | 4 199 | 35 | 101 | 142 | 879 | 16,5 % | 5,5 % | 221 | 17,0 % | 0,125 |

En el conjunto de los 6 distritos:

- La mediana es de 18 viviendas, el p95 de 82, el p99 de 129 y el máximo de 1 716.
- Las 776 manzanas con 100 viviendas o más son el 2,6 % del marco y tienen el 14,0 % de las viviendas y el 12,6 %
  de la población.
- **No hay certezas.** Con 25 rutas por distrito, la π máxima es 0,34 (una manzana de 1 204 viviendas en Los
  Olivos). El problema no es de certezas: es que una de cada siete rutas cae en una manzana de 100 viviendas o más.

### ¿El PPS está sesgado?

Con la π exacta, no lo está: el sesgo de Horvitz-Thompson es cero dentro del error de Monte Carlo (sección 3). Lo
que Gonzalo observa es real, pero es otra cosa: la **composición de la carga de campo**. PPS por viviendas manda
las rutas a donde están las viviendas, y el 14 % de las viviendas vive en manzanas grandes. Además, PPS con toma
fija de 8 es casi autoponderado: sin pesos, el sesgo dentro de cada distrito es de 2,2 pp o menos. Esa es su mayor
virtud, y cualquier alternativa la paga.

### ¿Hay área o geometría para calcular densidad?

Sí. El marco `current` (`inei2017_lima_callao_manzanas_full.csv.gz`) trae `area_m2` para el 100 % de las
manzanas elegibles, porque sale de la cartografía INEI 2017. La densidad es viviendas por hectárea: mediana 75,
p95 167, p99 236 y máximo 1 755.

La densidad sola no distingue un condominio. En Lima popular, la vivienda autoconstruida de 2 a 4 pisos con
varias viviendas por lote ya da entre 150 y 250 viviendas por hectárea. Por eso se usan dos indicios combinados:

- **«Grande»**: 100 viviendas o más en la manzana. Son 776 manzanas, con el 14,0 % de las viviendas.
- **«Vertical probable»**: grande y con 200 viviendas por hectárea o más, que en la práctica son edificios
  multifamiliares o condominios. Son 108 manzanas, con el 2,2 % de las viviendas y el 1,7 % de la población.

Las manzanas enormes de baja densidad (Ate 04200, con 1 716 viviendas en 30,8 ha) suelen ser conjuntos
habitacionales o manzanas sin subdividir en la cartografía. Para una ruta de 8 entrevistas son igual de
problemáticas, pero por la distancia, no por el acceso.

**Ningún indicio está validado contra el campo.** Para validarlo hace falta una muestra de manzanas «vertical
probable» revisada en imágenes o por supervisores.

**La edad por manzana no existe en el marco.** `inei2017_lima_callao_edad_simple_distrito.csv` es distrital. Por
eso los estimadores por rango de edad no se pueden simular por manzana; la cuota de edad se controla en la segunda
etapa. El sexo (`poblacion_h`/`poblacion_m`) y el NSE (`nse_nivel`, GeoPerú/INEI) sí están por manzana.

## 2. Mecanismos comparados

Todos sortean 25 manzanas por distrito y publican la π exacta de su fórmula.

| Clave | Mecanismo | π |
|---|---|---|
| a | PPS sistemático actual (ADR 0117), M = viviendas | n·M_i/M_d, con certezas por iteración |
| b1 | PPS con tope: M' = min(M, p95 del distrito) | n·M'_i/ΣM' |
| b2 | PPS sobre √M | n·√M_i/Σ√M |
| c1 | Estratos «grande» (≥ 100) / resto. Asignación proporcional a viviendas; igual probabilidad en grandes, PPS en el resto | n_h·(1/N_G) o n_h·M_i/M_h |
| c2 | Igual que c1, pero el estrato grande a media tasa (n_G = ½ de lo proporcional) | ídem |
| d1 | Cubo (Deville-Tillé) con la π de (a), balanceado en π, viviendas, población por sexo y población por NSE | la de (a), por construcción |
| d2 | Cubo con la π de (b1), mismo balance | la de (b1) |
| e | MAS sistemático (igual probabilidad) | n/N_d |

El cubo de la simulación es `BalancedSampling::cube`, porque `sampling::samplecube` tarda unas 150 veces más
(2,3 s frente a 13 ms por sorteo en San Juan de Lurigancho). La reproducibilidad de los dos se mide en la sección 5.

### Estimadores

- La población total se estima con Horvitz-Thompson.
- Los porcentajes (mujeres y NSE) se estiman como razón de totales HT.
- El sexo incluye la segunda etapa: 8 personas por manzana, Binomial(8, p_mujer).
- El NSE es un atributo de la manzana, así que su segunda etapa no varía.
- El DEFF se calcula frente a un MAS de 200 personas por distrito, estratificado por distrito.
- La columna «sin pesos» mide el sesgo, en puntos porcentuales, de promediar las entrevistas sin ponderar dentro de
  cada distrito, con los distritos ponderados por su población. Es lo que obtiene un análisis que olvida los pesos.

## 3. Precisión

Sesgo relativo de HT (los 56 dentro de 3·SE de Monte Carlo y 52 dentro de 2·SE: insesgados, como corresponde a la π exacta) y ECM relativo al de (a):

| Objetivo (verdad) | a PPS | b1 tope | b2 raíz | c1 estr. | c2 estr. ½ | d1 cubo | d2 cubo+tope | e MAS |
|---|---|---|---|---|---|---|---|---|
| Población (3,11 M) — ECM vs (a) | 1,00 | 2,38 | 2,42 | 1,18 | 2,42 | **0,70** | 1,78 | 8,50 |
| % mujeres (51,1) | 1,00 | 1,29 | 1,31 | 0,96 | 1,31 | **0,90** | 1,15 | 1,61 |
| % NSE bajo (15,2) | 1,00 | 0,82 | 0,94 | 1,07 | 0,95 | **0,12** | 0,16 | 1,31 |
| % NSE medio bajo (26,4) | 1,00 | 1,21 | 1,38 | 1,05 | 1,21 | **0,26** | 0,40 | 2,06 |
| % NSE medio (38,3) | 1,00 | 1,07 | 1,30 | 0,95 | 1,27 | **0,13** | 0,27 | 2,36 |
| % NSE medio alto + alto (17,8) | 1,00 | 1,41 | 1,62 | 1,53 | 1,79 | **0,21** | 0,56 | 4,31 |

DEFF frente al MAS de personas, por estimador:

| Estimador | a | b1 | b2 | c1 | c2 | d1 | d2 | e |
|---|---|---|---|---|---|---|---|---|
| % mujeres | 1,79 | 2,32 | 2,35 | 1,71 | 2,34 | 1,62 | 2,06 | 2,88 |
| % NSE bajo | 6,2 | 5,1 | 5,9 | 6,7 | 5,9 | 0,75 | 1,02 | 8,1 |
| % NSE medio | 7,8 | 8,3 | 10,1 | 7,3 | 9,8 | 0,99 | 2,06 | 18,4 |

Sesgo sin pesos, en puntos porcentuales:

| Estimador | a | b1 | b2 | c1 | c2 | d1 | d2 | e |
|---|---|---|---|---|---|---|---|---|
| % NSE bajo | +0,9 | +2,1 | +8,6 | +1,2 | +2,3 | +1,0 | +2,2 | +18,1 |
| % NSE medio | −0,5 | −1,5 | −6,9 | −0,1 | −1,6 | −0,5 | −1,5 | −14,0 |
| % NSE medio alto + alto | +1,6 | +1,0 | −1,7 | +1,3 | +0,9 | +1,5 | +0,9 | −5,1 |

Kish deff_w por pesos desiguales: a 1,07 · b1 1,15 · b2 1,22 · c1 1,10 · c2 1,16 · d1 1,07 · d2 1,15 · e 1,88.

Lectura:

- El NSE es casi constante dentro de la manzana. Por eso el conglomerado infla su varianza (DEFF de 6 a 8 con
  PPS).
- El cubo balanceado en la población por NSE elimina casi todo ese efecto: el ECM del % por NSE baja entre 74 % y
  88 %. Es la mayor ganancia del estudio. **Pero es en parte tautológica**: balancear en la variable que se evalúa
  la acierta por construcción. Para una variable que el balance no contiene, como el sexo, la ganancia es de 10 %.
- El tope (b1) cuesta poco en proporciones (entre −18 % y +41 % de ECM, según el NSE) y mucho en totales (×2,4).
  La encuesta reporta proporciones, no totales.

## 4. Carga de campo y balance

| Mecanismo | Viv./ruta media | p50 | p90 | p99 | DE | % rutas en manzanas ≥ 100 viv. | % rutas en «vertical probable» | Zonas distintas por distrito (de 25 rutas) | RRMSE del total HT de viviendas |
|---|---|---|---|---|---|---|---|---|---|
| a PPS | 75 | 48 | 117 | 752 | 131 | **14,1** | **2,20** | 24,7 | 0,000 |
| b1 tope p95 | 54 | 46 | 95 | 208 | 55 | 8,5 | 1,11 | 24,9 | 0,078 |
| b2 raíz | 48 | 37 | 88 | 244 | 69 | 7,0 | 0,97 | 25,0 | 0,082 |
| c1 estratos | 61 | 48 | 110 | 283 | 67 | 14,0 | 1,84 | 23,5 | 0,051 |
| c2 estratos ½ | 53 | 45 | 91 | 200 | 50 | 6,7 | 0,83 | 24,2 | 0,074 |
| d1 cubo | 75 | 49 | 117 | 752 | 131 | 14,2 | 2,25 | **20,4** | 0,009 |
| d2 cubo+tope | 54 | 45 | 95 | 208 | 53 | 8,4 | 1,11 | **20,5** | 0,078 |
| e MAS | 33 | 25 | 70 | 136 | 39 | 3,0 | 0,38 | 24,9 | 0,222 |

Lectura:

- **El tope (b1) reduce a la mitad las rutas en manzanas grandes y en verticales.** El p99 de la carga baja de 752
  a 208 viviendas y la DE de la carga de 131 a 55. Además, conserva la dispersión por zonas del sistemático.
- **El cubo pierde el estrato implícito por zona.** Con 25 rutas cubre 20,4 zonas distintas, frente a 24,7: concentra
  rutas en las mismas zonas. En campo eso es más traslado concentrado y menos cobertura territorial.
- **El cubo sobre la π del PPS (d1) no resuelve el problema de Gonzalo**: tiene la misma carga que (a).
- c2 deja **π = 0** a las 21 manzanas grandes de San Juan de Miraflores, porque n_G = round(0,5·25·3,1 %) = 0. Viola
  el ADR 0117 y queda descartado tal como está.

## 5. Reproducibilidad multiplataforma

| Mecanismo | Lo que decide la muestra | Resultado |
|---|---|---|
| Sistemáticos (a, b1, b2, c1, c2, e) | Un `runif` y un `cumsum` en orden fijo | Aritmética IEEE con el mismo orden de operaciones; no depende de LAPACK/BLAS. Es el recorrido que el ADR 0073 no tuvo que reparar. |
| Cubo, `sampling::samplecube` | `svd` en cada paso del vuelo | Medido en San Juan de Miraflores con 5 semillas: con el signo del svd invertido (lo que puede devolver otro BLAS) sale **otra muestra en 5 de 5**. El svd canónico del ADR 0073 fija el signo, pero el rango deficiente sigue abierto en ese ADR. |
| Cubo, `BalancedSampling::cube` | Eliminación propia en C++, sin LAPACK | Reescalar una columna de balance, que es matemáticamente equivalente, cambia la muestra con la misma semilla: es sensible al redondeo. **Tampoco fija n**: en San Juan de Lurigancho, con 8 variables, salen entre 23 y 28 rutas, y sólo el 66 % de las réplicas da 25. El aterrizaje libera el tamaño. |

**Limitación:** no hay Linux ni Windows en esta máquina (ni docker), así que la comparación macOS/Linux real no se
corrió. La prueba de signo invertido es el mismo procedimiento con el que el ADR 0073 reprodujo el defecto.

## 6. Verificación de la π (ADR 0066)

La prueba recorre todas las manzanas de los 6 distritos, con R = 2000:

- **(i)** |frec − π| ≤ 4·SE en las manzanas con π ≥ 0,05.
- **(ii)** z de Poisson-binomial de Σ frec frente a R·Σπ por deciles de π (60 pruebas por mecanismo).
- **(iii)** Dos controles positivos: el mutante 1,3·π y la frecuencia de (a) contra la π de (b1).

| Mecanismo | Manzanas con π ≥ 0,05 | Fuera de 4·SE | z máx. por decil | Certezas siempre | Mutante 1,3·π: z máx. |
|---|---|---|---|---|---|
| a | 60 | 0 | 2,32 | sí | 38,6 |
| b1 | 0 | 0 | 2,62 | sí | 34,7 |
| b2 | 7 | 0 | 2,15 | sí | 28,4 |
| c1 | 83 | 0 | 1,89 | sí | 39,6 |
| c2 | 0 | 0 | 2,20 | sí | 34,1 |
| d1 | 60 | 0 | 2,21 | sí | 39,2 |
| d2 | 0 | 0 | 2,39 | sí | 35,3 |
| e | 0 | 0 | 0,97 | sí | 19,5 |

El control cruzado, que compara la frecuencia de (a) con la π de (b1), da un z máximo por decil de entre 12,3 y
41,4 en cada distrito. El arnés distingue un 30 % de error de escala y distingue entre (a) y (b1), y ningún
mecanismo publica una π distinta de la que ejecuta.

## 7. Recomendación

**Adoptar (b1), PPS sistemático con tope en la medida, como opción del sorteo.** La medida es M' = min(viviendas,
c_d), con c_d = p95 de viviendas del marco elegible del distrito. La π es n·M'/ΣM' y se publica igual que hoy. Los
argumentos:

1. Ataca el problema de campo: las rutas en manzanas de 100 viviendas o más bajan de 14,1 % a 8,5 %, las rutas en
   «vertical probable» de 2,2 % a 1,1 %, y el p99 de la carga de 752 a 208 viviendas.
2. Conserva todo lo que el ADR 0117 ganó: un solo sistemático por distrito, zona como estrato implícito, π exacta,
   reproducible en toda plataforma y sin álgebra lineal.
3. **Trade-off**:
   - El diseño deja de ser casi autoponderado (Kish de 1,07 a 1,15, unos 7 % de n efectivo).
   - Sin pesos, el NSE bajo sale +2,1 pp en vez de +0,9 pp.
   - Los totales empeoran (ECM ×2,4). Las proporciones quedan entre −18 % y +41 % de ECM.

   Exige analizar con los pesos 1/π, que ya se publican.

**No ahora:**

- **El cubo (d1/d2).** Da la mayor precisión en NSE, pero no corrige la carga si va sobre la π del PPS. Además:
  - pierde la dispersión por zona;
  - con `BalancedSampling` no fija las 25 rutas;
  - con `sampling` depende del signo del svd (ADR 0073 abierto);
  - es unas 150 veces más lento.

  Queda como fase posterior, condicionada a resolver el tamaño fijo y la reproducibilidad.
- **La raíz (b2).** Tiene un sesgo sin pesos de +8,6 pp en NSE bajo.
- **El MAS (e).** Kish 1,88 y ECM del total ×8,5.
- **c2, tal como está.** Da π = 0 a todas las manzanas grandes de un distrito. c1 casi no cambia la carga (14,0 %).

**Sobre excluir los condominios:** el marco elegible ya sabe excluir áreas (ADR 0115). Excluir todas las manzanas
«grandes» sacaría el 12,6 % de la población y movería el NSE bajo de 15,2 % a 17,1 %: un sesgo de cobertura
inaceptable. Excluir sólo las «vertical probable» saca el 1,7 % y mueve cada NSE 0,4 pp o menos. Se puede hacer, pero
sólo con el indicio validado en campo. Hasta entonces, conviene **marcarlas** en la hoja de ruta para que el
supervisor gestione el acceso. El reemplazo existente cubre el rechazo.

## Reproducir

```bash
unzip -p api/inst/reference_projects/acnur_acg/acnur_acg.pulso state.rds > /tmp/acg_state.rds
Rscript api/scripts/estudio_mecanismos_seleccion_manzanas.R /tmp/acg_state.rds /tmp/sim_manzanas 2000
```
