# ADR 0131: Muestra probabilística urbana multiciudad

Estado: Propuesto. Espera la decisión de Gonzalo. Revisión metodológica previa de `revisor-metodologico` (aprobado
con supuestos, incorporados aquí); falta la revisión de `guardian-contratos` sobre el texto final.

Implementación: paso 1 (reparto con la base 2025 y g_d) en backend desde el 2026-11-04, apagado por defecto; el resto, no iniciado. Estado vivo
en `docs/qa/checklist-muestra-urbana-multiciudad-2026-11-04.md`.

**Decisión de Gonzalo, 4/11, que corrige el §4:** la persona dentro de la vivienda se elige por **cuotas de sexo ×
grupo de edad validadas por el INEI**, que siguen siendo meta (ADR 0126). Se descarta el sorteo en tablet. Por eso
el diseño es probabilístico hasta la vivienda y por cuota en la persona, y el margen se informa como nominal en esa
etapa (ADR 0116 §2). La cadena del peso del §6 pierde el factor `min(A_j, 5)`. El §4 queda como registro de la
alternativa evaluada.

Fecha: 2026-11-04

Relación: extiende el [ADR 0117](0117-hojas-de-ruta-sorteo-pps-sistematico-por-distrito.md) (PPS sistemático) del
distrito a la provincia como estrato explícito. Usa la cobertura del
[ADR 0119](0119-hojas-de-ruta-cobertura-ciudades-principales.md) y el marco elegible del
[ADR 0115](0115-hojas-de-ruta-marco-elegible.md). En este modo deja sin efecto la cláusula de margen nominal por
cuotas del [ADR 0116](0116-hojas-de-ruta-no-respuesta-e-icc.md) §2. La cuota de sexo × edad pasa a referencial
según el [ADR 0126](0126-cada-cuota-declara-si-es-meta-o-referencial.md).

## Contexto

Hojas de ruta sortea manzanas por PPS dentro de cada distrito y elige a la persona por cuota de sexo × edad. La
última etapa no es probabilística y el margen que se informa es nominal. Para un estudio de hogares en Lima, Callao
y las 25 ciudades del ADR 0119 con 1.500–1.800 adultos, hacen falta cuatro cosas que hoy no existen:

1. **Un estrato que admita pocas rutas.** Con 1.800 entrevistas y 8 por ruta salen 225 rutas para 164 distritos.
   Repartir rutas enteras por distrito deja distritos con 0 rutas: sus manzanas quedan con π = 0, el defecto que
   el ADR 0117 corrigió a nivel de zona. Forzar al menos una ruta por distrito exige 164 rutas fijas.
2. **Un reparto con la población actual.** Hoy el reparto entre distritos usa la población 2017 de 18+ por edad
   simple (`hojas_ruta_engine.R:3912-3918`). El CPV 2025 (`pob25` en `territorios.json`, población total censada
   por distrito) llega a R pero nadie lo lee. Por manzana sólo existe el CPV 2017.
3. **Una selección probabilística dentro del hogar.** En el repo no hay Kish, cumpleaños ni sorteo de persona.
4. **Una cadena de pesos.** Hojas publica π de la manzana titular (`hojas_ruta_sorteo_pps.R:197-218`) sólo en el
   estado de la sesión. No calcula la probabilidad de vivienda ni la de los reemplazos. `ponderacion_engine.R` no
   puede partir de un peso de diseño por caso y después calibrar.

## Decisión

### 1. Estrato explícito: la provincia

- Las 27 provincias del registro son los estratos. Lima Metropolitana puede partirse en sus cinco áreas
  interdistritales, con Callao aparte.
- Dentro de cada estrato corre un PPS sistemático sobre la lista ordenada distrito → zona → manzana → `id_manzana`.
  Distrito y zona son estratos implícitos: cada distrito recibe ⌊Σπ⌋ o ⌈Σπ⌉ rutas.
- Cada estrato recibe al menos 2 rutas, para poder estimar la varianza. El resto se reparte en proporción.
- El modo actual (distrito como estrato) sigue disponible: es un modo nuevo, no un reemplazo.

### 2. Reparto y medida de tamaño con 2025

- **Entre estratos:** proporcional a los adultos urbanos estimados para 2025,
  `P̂_h = Σ_d pob25_d · u17_d · a17_d`, más el mínimo del §1.
  - `u17_d` es la fracción del distrito que en 2017 cae en manzanas del marco.
  - `a17_d` es la proporción de 18+ del distrito en 2017.
  - Los dos son supuestos que se declaran. `pob25` incluye la parte rural del distrito y todas las edades, así que
    no se usa sin ajustar.
- **Dentro del estrato:** la medida de tamaño de la manzana es `MOS_i = M_i^2017 · g_d`, con
  `g_d = P̂25_d / pob17_en_capa_d`.
  - g_d es un factor por distrito conocido antes del sorteo, así que π sigue siendo exacta.
  - Iguala el peso de cada distrito en la muestra con su peso en 2025.
  - Esto no reemplaza el marco calibrado con Open Buildings del ADR 0119 §5.
- **π de la manzana:** `π_i = n_h · MOS_i / Σ_{i∈h} MOS_i`, con las certezas resueltas por iteración. Con tope
  (ADR 0120) el tope se aplica sobre MOS.

### 3. Vivienda

- Por ruta se registra: el conteo de viviendas particulares en campo (`V_i_campo`) de la titular y de cada aledaña
  usada, el arranque, el salto y la disposición de cada visita (ADR 0116).
- La probabilidad es `π_j|i = c_i / Ê_i`, con `Ê_i = V_i_campo · ê_i`: c_i son las completas y ê_i la tasa
  observada de ocupación y elegibilidad.
- Si falta el conteo de campo se usa `M_i`, marcado con `fuente_V = "marco_2017"`.
- Las aledañas cuentan como parte del segmento de la UPM. Se informa el porcentaje de entrevistas hechas fuera de la
  titular, con aviso si supera el 25 %.

### 4. Persona: roster en tablet y sorteo aleatorio

- El formulario lista a los adultos residentes habituales (inicial, sexo, edad); A_j es el número de filas.
- Se sortea `sel = once(int(random() * A_j) + 1)`.
- Se guardan A_j, el valor crudo del sorteo, `sel` y el roster entero. Kobo no acepta semilla en `random()`, así que
  la reproducibilidad descansa en el valor guardado.
- No se sustituye a la persona seleccionada. Se hacen al menos 3 visitas en horarios distintos; si no se logra, la
  vivienda es no respuesta. A_j = 0 significa vivienda no elegible.
- La probabilidad es `π_p|j = 1/A_j`. Para el peso, A_j se recorta a 5; el valor crudo se conserva.
- En este modo la cuota de sexo × edad pasa a referencial (ADR 0126) y la ficha no la imprime como meta.
- Se descartan Kish en papel y los métodos de cumpleaños: los de cumpleaños eligen mal en un 20–30 % de los casos
  según la literatura, y el error favorece a quien abre la puerta.

### 5. Reemplazos

- Manzana no elegible (no residencial, demolida): no se reemplaza y se descuenta de la población.
- Manzana inaccesible o rechazo del bloque: se usa el reemplazo pareado de la misma zona, que **hereda la π y el
  estrato de la titular**, con el motivo registrado. El reemplazo en otra zona del mismo distrito cambia π y no va
  por defecto.
- Si un estrato supera el 10 % de reemplazos, se avisa. Sin reemplazo, se ajusta por no respuesta de UPM dentro del
  estrato.

### 6. Cadena del peso

1. Peso de diseño: `d = (ΣMOS_h / (n_h · MOS_i)) · (Ê_i / c_i) · min(A_j, 5)`.
2. Ajuste por no respuesta de UPM dentro del estrato.
3. Calibración por raking, partiendo de d, a:
   - adultos urbanos 2025 por provincia, o por distrito si tiene al menos 30 casos;
   - sexo × grupo de edad por macrorregión, cuando existan márgenes 2025. Si no, la estructura 2017 envejecida,
     declarando fuente y año.
4. Recorte a 5 veces la media, seguido de una nueva calibración, en ciclo.
5. Se publican `peso_diseno` (Horvitz-Thompson sobre el marco) y `peso_calibrado`, con deff de Kish y n efectivo.

Para esto `ponderacion_engine.R` tiene que:

- aceptar una columna de la base como peso base y luego calibrar (hoy los modos columna y calibración se excluyen);
- ofrecer un peso de expansión con Σw = N̂ además del normalizado a media 1;
- avisar cuando una categoría del margen no tiene casos, un estrato no está en `pop_sizes` o el raking no converge
  (hoy los tres pasan en silencio);
- calibrar después de recortar.

### 7. Margen y efecto de diseño

- Antes del campo el motor publica el margen con deff, a partir de un ICC de la biblioteca (ADR 0116 §2) y el
  1 + CV²_w esperado. El margen nominal sólo sale rotulado «bajo MAS».
- Después del campo, deff empírico con `survey::svydesign(ids = ~ruta, strata = ~estrato, weights = ~peso)`. La
  varianza del sistemático se aproxima como estratificado con reemplazo de UPM, y se declara así (ADR 0117 §4).
- Un estrato con una sola UPM se colapsa con una regla declarada, nunca con `lonely.psu` en silencio.

### 8. Lo que declara el informe metodológico

- Marco CPV 2017 de manzanas y viviendas, y NSE 2017.
- g_d, u17_d y a17_d con su fuente.
- Captación y cobertura cartográfica por distrito sorteado (ADR 0119 §7) y el porcentaje de `pob25` que queda
  fuera del marco.
- Protocolo de selección en el hogar.
- Tasas AAPOR a partir de las disposiciones.
- Reemplazos y entrevistas en aledañas.
- Pasos del peso y metas de calibración con fuente y año.
- El supuesto de cobertura: la población fuera del marco se parece a la de dentro en cada celda de calibración.

## Alternativas descartadas

- **Distrito como estrato explícito** (lo de hoy): deja distritos sin rutas o exige un mínimo de 164 rutas.
- **Repartir con `pob25` sin ajustar:** mezcla la parte rural y todas las edades en una muestra de adultos urbanos.
- **Repartir con 2025 y sortear con la medida 2017 sin g_d:** los distritos que crecieron quedan con menos muestra y
  la calibración los infla, lo que sube el deff.
- **Mantener la cuota de sexo × edad como meta:** la última etapa vuelve a ser por cuotas y el margen, nominal.

## Preguntas abiertas

- **Variante nacional urbana** (checklist ítem 6): estrato = departamento, con sus ciudades principales. Faltan
  marcos para Amazonas, Apurímac, Huancavelica, Madre de Dios, Moquegua y Pasco, y varias ciudades no pasan los
  umbrales del ADR 0119 §1.
- Entrevistas por ruta: k = 8 contra el valor por defecto del motor, que es 6.
- Márgenes 2025 de sexo × edad × educación: no se pudo leer REDATAM CPV 2025 de forma automática.

## Cumplimiento

Un commit por paso, cada uno con sus tests (invariantes en el checklist):

1. Reparto entre estratos y g_d, en un archivo nuevo llamado desde los dos puntos de reparto de
   `hojas_ruta_engine.R` (congelado; crece unas dos líneas). Debe cerrar la divergencia actual entre la vista previa
   del tamaño y la cuota que se sortea.
2. Estrato provincia con mínimo de 2 rutas y PPS sistemático con distrito y zona implícitos.
3. Publicación de π de titulares y reemplazos en la muestra exportada.
4. Selección en el hogar: declaración en el estudio, ficha, formulario y Monitoreo con la cuota referencial.
5. Peso base más calibración en `ponderacion_engine.R`, con sus avisos.
6. Margen con deff y varianza post-campo.
