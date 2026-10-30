# ADR 0120: Hojas de ruta — PPS con tope en la medida para manzanas grandes

Estado: Aceptado (decisión de Gonzalo, 2026-10-29: «Opción, PPS por defecto»)

Implementación: Completa en `api/R/hojas_ruta_sorteo_tope.R` (rama `claude/mecanismos-seleccion-manzanas-9bf61c`), salvo el selector del método en la UI y la marca `acceso_dificil_probable` (ver «Pendiente»). La evidencia es `docs/qa/estudio-mecanismos-seleccion-manzanas-2026-10-29.md`.

Fecha: 2026-10-29

Enmienda: ADR 0117 (sistemático PPS por distrito). Aplica: ADR 0066 (la probabilidad publicada es la del sorteo
ejecutado) y ADR 0115 (marco elegible).

## Contexto

El sorteo PPS por viviendas (ADR 0117) es insesgado con su π exacta y casi autoponderado con toma fija de 8, pero
manda las rutas a donde están las viviendas. En `acnur_acg`:

- las 776 manzanas con 100 viviendas o más son el 2,6 % del marco y reciben el 14,1 % de las rutas;
- las 108 «vertical probable» (100 viviendas o más y 200 viv/ha o más) reciben el 2,2 %;
- el p99 de viviendas por manzana sorteada es 752.

Gonzalo lo planteó así: «los condominios son muy difíciles de acceder de cara al campo».

El estudio comparó ocho mecanismos con 2000 réplicas: PPS, tope p95, raíz, dos estratificaciones, dos cubos y MAS.
El tope p95 es el único que reduce la carga a la mitad y a la vez conserva las propiedades del ADR 0117:

- π exacta;
- zona como estrato implícito;
- reproducible en toda plataforma.

El cubo da más precisión en NSE, pero no fija las 25 rutas, pierde la dispersión por zona y arrastra el problema
abierto del ADR 0073.

## Decisión

1. **Nuevo método `pps_tope`** del sorteo de titulares, junto a `pps` y `sistematico`. La medida es
   M'_i = min(M_i, c_d), donde M es la `measure_var`, con NA o ≤ 0 → 0 como hoy. El tope c_d es el percentil
   95 de M (cuantil tipo 7) entre las manzanas del marco elegible del distrito con M > 0. Con cuota por zona, el
   tope sigue siendo el del distrito. El percentil es fijo en esta versión; un tope absoluto declarado queda
   como extensión, con su propia firma. El recorrido es el mismo sistemático por distrito,
   ordenado zona → manzana → `id_manzana`, y π_i = n_d·M'_i/ΣM' con certezas por iteración.
2. **Manzanas grandes o condominios: se pone tope, no se excluyen ni se estratifican.**
   - Excluir todas las grandes sacaría el 12,6 % de la población y sesgaría el NSE bajo en +1,9 pp.
   - La estratificación con tasa propia deja π = 0 en distritos con pocas grandes, y la proporcional no reduce la
     carga.
   - La exclusión de «vertical probable», que saca el 1,7 % de la población y mueve el NSE 0,4 pp o menos, sólo
     se habilita como área excluida declarada del ADR 0115 cuando el indicio esté validado en campo.
   - Mientras tanto, la hoja de ruta **marca** esas manzanas (`acceso_dificil_probable`) para el supervisor.
3. **π publicada (ADR 0066).**
   - `marco_elegible.zonas[*]` publica `regla_pi = "pps_tope_distrito"`, `probability_source = "formula"`, el tope
     aplicado (`tope_medida`, con su percentil o su valor declarado) y `manzanas_topadas`.
   - Cada seleccionada publica `medida` (M', la medida con que se sorteó, igual que en los otros métodos) y
     `medida_marco` (M).
   - Como el diseño deja de ser autoponderado (Kish deff_w ≈ 1,15), la salida avisa que el análisis exige los
     pesos 1/π: `W_DESIGN_NOT_SELF_WEIGHTING`.
4. **Firma.** `HOJAS_RUTA_ALGORITMO_SORTEO` sigue siendo `"pps_sistematico_distrito_v2"` para `pps` y
   `sistematico`, porque ese sorteo no cambia. Con `pps_tope`, la muestra lleva
   `algoritmo_sorteo = "pps_tope_sistematico_distrito_v1"`, constante `HOJAS_RUTA_ALGORITMO_SORTEO_TOPE`. El tope
   se recalcula del marco del distrito y se publica en `marco_elegible.zonas[*]`. `hojas_ruta_sorteo_aviso_v1` reconoce las dos firmas vigentes y no marca como v1 una
   muestra con tope.
5. **Por defecto: `pps`** (decisión de Gonzalo, opción i). `pps_tope` es un método elegible del catálogo
   (`.hojas_ruta_sampling_methods`). Los estudios en curso no cambian: sus muestras conservan su método y su firma,
   y nunca se vuelve a sortear en silencio.

## Consecuencias

- En `acnur_acg`:
  - las rutas en manzanas de 100 viviendas o más bajan de 14,1 % a 8,5 %;
  - las rutas en «vertical probable» bajan de 2,2 % a 1,1 %;
  - el p99 de la carga baja de 752 a 208 viviendas y la DE de 131 a 55.
- Costo:
  - Kish de 1,07 a 1,15;
  - ECM de las proporciones entre −18 % y +41 % según el NSE;
  - ECM del total poblacional ×2,4;
  - sin pesos, el NSE bajo sale +2,1 pp, frente a +0,9 pp con PPS.
- Ningún cambio de álgebra lineal: la reproducibilidad multiplataforma es la del sistemático actual.
- El cubo queda como trabajo futuro, sujeto a tres condiciones: tamaño fijo garantizado, reproducibilidad del ADR
  0073 cerrada y una forma de conservar la dispersión por zona (por ejemplo, el cubo estratificado por zona).

## Pendiente

- **UI.** El selector del método está fijo en el frontend: `METODOS` en
  `frontend/src/features/hojasRuta/mapa/manzanas/ManzanasPaneles.tsx`, el tipo `SamplingMethod` en
  `frontend/src/api/hojasRuta.ts` y la lista de `HojasRutaPage.tsx`. Ninguno lee el catálogo del backend, así que
  hay que agregar `pps_tope` («PPS con tope») a mano. Queda para la sesión de revamp de Hojas de ruta.
- **`acceso_dificil_probable`.** La marca en la hoja de ruta de las manzanas con 100 viviendas o más y 200 viv/ha
  o más (§2) no se implementó en esta tanda.

## Cumplimiento

- `api/tests/testthat/test-hojas-ruta-sorteo-tope.R`:
  - frecuencia empírica ≈ π publicada (4·SE), con control positivo: la π sin tope no pasa el arnés;
  - mutante: el sorteo que ignora el tope muere en el arnés (simulado con `with_mocked_bindings`; quitar el tope del
    código fuente da 8 fallas);
  - con cuota por zona, el tope es el del distrito, no el de la zona;
  - el valor por defecto sigue siendo `pps`, con la misma muestra, la misma firma v2 y sin aviso;
  - Σπ = n_d;
  - toda manzana con M > 0 tiene π > 0;
  - la firma, que `hojas_ruta_sorteo_aviso_v1` respeta, y el aviso de diseño no autoponderado, que es único e
    idempotente;
  - la misma semilla da la misma muestra.
- Gate: `make gate-area AREA=hojas GATE_ARGS='--patron "hojas-ruta"'`.
