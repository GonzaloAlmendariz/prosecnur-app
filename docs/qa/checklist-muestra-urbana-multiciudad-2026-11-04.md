# Checklist — muestra probabilística urbana multiciudad (2026-11-04)

Encargo de Gonzalo: dejar Hojas de ruta en condiciones de diseñar una muestra **probabilística de hogares,
solo urbana, en las principales ciudades** (Lima, Callao y las 25 ciudades del ADR 0119), con 1.500–1.800
entrevistas a adultos de 18 a más. Lo rural queda fuera por decisión explícita.

Contexto que ya se verificó (no reinvestigar):

- El marco de manzanas es del CPV 2017 y es el único que existe por manzana; el CPV 2025 se publicó sólo hasta
  distrito (ADR 0119). El sorteo de manzanas **tiene** que hacerse sobre 2017.
- `api/inst/hojas_ruta/territorios.json` ya trae `pob25` (población censada total CPV 2025) para los 164
  distritos de las 27 provincias. Ningún archivo de `api/R` la lee: el reparto entre distritos sale hoy de los
  conteos del marco 2017.
- Dentro de la vivienda la persona se elige por cuota sexo × edad (`hojas_ruta_caracter_cuotas.R:8`,
  ADR 0116): la última etapa no es probabilística.
- Hojas publica π por manzana (`hojas_ruta_sorteo_pps.R:213`); no hay peso final por persona.
- `api/R/ponderacion_engine.R` tiene raking propio; los márgenes los teclea el usuario.
- Educación no está en ninguna capa embebida.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Repartir la muestra con la población 2025, no con los conteos 2017 | ADR 0131 §2 · `api/R/hojas_ruta_reparto_base.R` (nuevo) · enganches en `hojas_ruta_engine.R` (`.hojas_ruta_finalize_quota_cells` y `hojas_ruta_sample_size_preview`, +2 líneas netas), `hojas_ruta_sorteo_pps.R` (`.hojas_ruta_sorteo_medida`) y `hojas_ruta_tamano_extras.R` · `territorios.json` | **hecho en backend** (2026-11-04, aprobado por Gonzalo el 4/11): opción `sample_size$base_reparto = "cpv2025_adultos_urbanos"`, apagada por defecto (`cpv2017`). Evidencia: `test-hojas-ruta-reparto-base.R` (rojo antes del enganche, verde después) y salida apagada idéntica a la previa al cambio en 4 escenarios. UI hecha (commit `2bb73fe15`): interruptor «Repartir con la población 2025» en Tamaño y reparto, con fuente, supuestos y captación por distrito; la memoria de cálculo rotula y declara la fuente. QA visual en acnur_acg a 1440×1000 y 1024×600: `ok=true`, 0 issues, 0 columnas ocultas |
| 2 | Selección probabilística de la persona en el hogar | ADR 0131 §4 | **descartado**: Gonzalo, 4/11: cuotas sólo de sexo y grupos de edad validados por el INEI. El motor ya trabaja así |
| 3 | Peso final por persona (manzana × vivienda) y calibración a 2025 | ADR 0131 §3, §5–§6 · `hojas_ruta_pi_muestra.R`, `ponderacion_engine.R`, `ponderacion_faltantes.R` | **parcial**: π de titulares y reemplazos publicada (paso 3). Motor de ponderación hecho e integrado (merge `c0a754e62`): peso base desde columna, expansión, recorte con recalibración en ciclo, NA/98/99 fuera del margen por defecto o imputados por hot-deck si faltan ≤ 5 % (Gonzalo, 4/11). Falta la probabilidad de vivienda (§3) y la UI (sesión «UI de ponderación y metas CPV 2025») |
| 4 | Verificar si REDATAM CPV 2025 da sexo × edad × nivel educativo por provincia o distrito | `build_cpv2025_margenes.R` · `cpv2025_edad_simple_distrito.csv.gz` · `cpv2025_margenes_distrito.csv.gz` | **hecho** (merge `25a5f188f`): existe por distrito. Edad simple × sexo suma exacto `pob25`; sexo × quinquenio × nivel educativo 18+. Universo: población censada (sin los 1,45 M de omisión). Falta conectarlo a cuotas y calibración |
| 5 | Decisión de cobertura urbana anotada en el brief interno de la propuesta | doc fuera del repo | hecho |
| 6 | Variante nacional urbana: repartir n por departamento con población urbana 2025 y sortear en la(s) ciudad(es) principal(es) de cada uno; hace falta marco de manzanas en los 6 departamentos sin ciudad (Amazonas, Apurímac, Huancavelica, Madre de Dios, Moquegua, Pasco) | `build_inei2017_ciudades.R` (`HOJAS_RUTA_CIUDADES_PROVINCIAS`) + ADR 0119 §1 (umbrales) + capa GeoPeru | **bloqueado por decisión**: capa medida (`docs/qa/cobertura-geoperu-departamentos-faltantes-2026-11-04.md`). Los 6 tienen marco, ninguno llega a nivel 1 o 2; 5 capitales pasan los umbrales de calidad del nivel 2 y entrarían por el §7 con cobertura declarada. Gonzalo decide |
| 7 | Estrato explícito provincia, mínimo 2 rutas, distrito y zona implícitos (ADR 0131 paso 2) | `api/R/hojas_ruta_estrato.R` · `sample_size$estrato` · UI `EstratoMuestral.tsx` · memoria `reporte_muestra_territorial_estrato.R` | **hecho** (commits `ace1e979e`, `8e2eb5af4`, `be9515570`): `provincia` y `provincia_lima_areas` (Lima en 5 áreas, Callao aparte). Dentro del estrato las rutas se reparten con la medida del marco **elegible**, la misma del sorteo (Gonzalo, 4/11): con mínimo 60 viviendas, 070106 pasa de 4,74 a 0,80 rutas esperadas, y el estrato queda autoponderado. UI: selector en Tamaño y reparto, con el mínimo de 2 rutas y las rutas por estrato del último cálculo; el reparto por distrito se lee de R. Memoria: estrato, mínimo y rutas por estrato. Con N por distrito el estrato no rige y la π queda en la regla del distrito. Tests: Σ n_h = rutas, n_h ≥ 2, Σπ = n_h, π > 0, Monte Carlo, vista previa = cuota, medida elegible |
| 8 | Publicar π de titulares y reemplazos en la muestra (ADR 0131 paso 3) | `api/R/hojas_ruta_pi_muestra.R` · payload `blocks` / `replacement_blocks` · default en `hojas_ruta_integrada_normalize_config` | **hecho** (commits `da100cfd7`, `7155ef81f`): `estrato`, `pi`, `pi_regla` en titulares; `estrato`, `pi`, `pi_fuente` en reemplazos. Con estrato provincia el reemplazo por defecto es el pareado de la misma zona y hereda π (Gonzalo, 4/11); la UI lo fija al elegir provincia. «Otra zona» sigue disponible, explícita, con `W_REPLACEMENT_PI_OTRA_ZONA`. El modo distrito conserva `alternate_zone_same_district` |
| 9 | Cuotas sexo × edad con el CPV 2025 cuando se reparte con la base 2025 | `api/R/hojas_ruta_cuotas_cpv2025.R` (nuevo) · `hojas_ruta_reparto_base_escalar_celdas` · `cpv2025_edad_simple_distrito.csv.gz` · panel `BaseReparto2025.tsx` · memoria | **hecho** (commit del paso 4): la celda sale de la edad simple × sexo 2025 del distrito, llevada a P̂25 (pob_celda = P̂25 · P25(sexo, rango) / P25(18+)); con cuota por zona, la zona conserva su participación 2017. Ya no se escala la estructura 2017. Panel y memoria declaran «CPV 2025 (población censada)». Tests: Σ cuotas = n, cuotas proporcionales a la estructura 2025 (rojo con el enganche viejo), salida apagada idéntica |

## Aprendido en el camino

- **Revisión metodológica (2026-11-04):**
  - El distrito no sirve como estrato explícito: con 225 rutas para 164 distritos deja distritos con π = 0.
  - El estrato pasa a ser la provincia, con distrito y zona como estratos implícitos. Ver ADR 0131.
- **Divergencia que ya existe:**
  - La vista previa del tamaño (`hojas_ruta_sample_size_preview`, `engine.R:4298-4313`) reparte con la población
    total.
  - La cuota que de verdad se sortea (`engine.R:3912-3918`) reparte con la población de 18+ por sexo y edad.
  - El piso por distrito sólo existe en la vista previa. El paso 1 del ADR 0131 cierra esto.
- **Lo que hoy pasa en silencio en `ponderacion_engine.R`:**
  - Una categoría con 0 casos se salta (`cur_share <= 0`).
  - Un estrato ausente de `pop_sizes` conserva factor 1.
  - `converged = FALSE` no llega como aviso.
  - Recorta después del rake, lo que rompe los márgenes.
  - Siempre normaliza a media 1.
- **Lo que no se publica:**
  - La π de manzana sólo vive en `resultado$marco_elegible`, dentro del estado de la sesión. No sale en el
    Excel, el PDF ni el front.
  - Los reemplazos se sortean con `sample(prob = M)` secuencial y no tienen π.
- **Invariantes a cubrir con testthat:**
  - Reparto: Σ n_h = rutas, con n_h ≥ 2.
  - π de manzana: Σπ = n_h, π ∈ (0, 1].
  - g_d: finito y > 0, con error `E_*` si falta.
  - Monte Carlo: la frecuencia de inclusión cuadra con π.
  - Hogar: sel ∈ [1, A_j], con A_j = 0 → no elegible.
  - Peso de diseño: Σd ≈ N̂.
  - Calibración: Σw = Σ metas.
  - Recorte: tras recortar y recalibrar, los márgenes siguen dentro de la tolerancia.
  - Reemplazo: hereda π y estrato.
  - Cruce base ↔ muestra: reporta huérfanos y no los descarta.

- **Ítem 4 (2026-11-04):** la consulta automática a REDATAM CPV 2025 no dio nada legible. La portada es un
  frameset, `AreaList` de CPV2025DI devolvió la página de error y `gob.pe/inei` respondió 418. Queda probar
  desde el navegador.
- **Ítem 6 (2026-11-04):**
  - La capa GeoPeru `peru_estrato_nacional_` cubre 71 provincias.
  - Según el plan del 29 de octubre, incluye Mariscal Nieto (Moquegua) y Chaupimarca (Pasco). Mariscal Nieto
    tiene más población 2017 en la capa que en el CPV 2025, así que hay que revisar el cruce de ubigeo.
  - No está verificado si incluye Chachapoyas, Abancay/Andahuaylas, Huancavelica o Tambopata. La capa no está
    en el repo ni en `tmp/`.
  - Con reparto proporcional, un departamento chico recibe muy pocas entrevistas. La ciudad principal pasa a
    representar todo el urbano de su departamento, y eso es un supuesto: no lo vuelve probabilístico para ese
    departamento salvo que las ciudades se sorteen por PPS.

- **Ítem 1 (2026-11-04), cómo quedó:**
  - Con la base activa, P̂25_d = pob25 · u17 · a17 (u17 = pob17_en_capa / pob17_redatam; a17 = 18+ / total en la
    edad simple 2017). La vista previa reparte y calcula márgenes con P̂25; la cuota que se sortea usa la misma
    función, con el mismo piso por distrito. Vista previa = cuota por distrito (probado con n = 240 y 600, con y
    sin piso).
  - Las celdas sexo × edad 2017 se escalan por P̂25_d / pob18_17_d: la estructura de la cuota no cambia, cambia el
    peso entre distritos.
  - MOS_i = M_i · g_d en `pps` y `pps_tope` (el tope sobre M y luego g_d, que es lo mismo porque g_d es constante en
    el distrito). En `sistematico` (igual probabilidad) no aplica. **Mientras el estrato sea el distrito, g_d se
    cancela y la π no cambia**: empieza a pesar con el estrato provincia (ítem/paso 2).
  - La vista previa del tamaño publica `base_reparto` (código, fuente «CPV 2025 (supuestos u17, a17 de 2017)»,
    fórmula, supuestos y u17/a17/P̂25/g por distrito). Con la base apagada la clave no aparece.
  - Falta un dato → `E_HOJAS_RUTA_BASE_2025_INCOMPLETA` (422) con el ubigeo y el campo; nunca un factor 1. Los 164
    distritos del registro tienen los tres datos y edad simple: g_d finito y > 0 en todos.
  - **Divergencia que sigue con la base apagada:** la vista previa reparte con población total y piso; la cuota,
    con 18+ y sin piso. No se cerró ahí porque el encargo exige que la salida apagada sea idéntica a la de hoy
    (estudios y envíos existentes). Cerrarla en el modo 2017 cambia cuotas ya publicadas: es decisión de Gonzalo.
  - **UI, no hecha (exige más que un toggle):** `motorTamano.ts` es espejo en TS de la vista previa y recibe la
    población por distrito del marco 2017. Para mostrar la base 2025 hay que traer P̂25 del backend al espejo,
    regenerar `tamanoMuestra.golden.json` con un caso 2025 y añadir el control en `MuestraPaneles.tsx`. Mientras
    tanto la opción se fija en `sample_size` y el front la conserva al guardar (`desdeConfig.ts` esparce
    `config.sample_size`).

- **Pasos 2 y 3 (2026-11-04), cómo quedó:**
  - El estrato provincia no corre un sistemático único sobre todo el estrato: reparte primero n_h entre sus distritos
    con e_d = n_h·MOS_d/MOS_h y un redondeo sistemático aleatorio (⌊e_d⌋ o ⌈e_d⌉, E = e_d), y después corre el PPS
    por distrito de siempre. Es equivalente en π (la mezcla exacta de las dos ramas, que sin certezas da
    n_h·MOS_i/MOS_h) y deja intactos la cuota sexo × edad por distrito, la vista previa y el envío.
  - En modo estrato, `row_var = "zona"` da `E_HOJAS_RUTA_ESTRATO_CUOTA_ZONA`: la cuota por zona reparte con otra
    medida y la π dejaría de ser exacta.
  - Con cuota por zona (modo distrito) la π publicada es condicional a las rutas de la zona (`pi_regla` lo dice).
  - La π va en el payload de la muestra; el libro de campo (`Hojas_de_ruta`) no la lleva porque es para el equipo.
  - `hojas_ruta_engine.R` (congelado) creció 4 líneas netas en los tres pasos; la línea base del manifiesto
    (10.224) sigue holgada.
- **Verificador (2026-11-04):**
  - Paso 1: aprobado en el motor. El commit `91ddaaac2` aislado tiene en rojo el test de la memoria de cálculo, porque depende de `reporte_muestra_territorial_marco.R`, que entró en `2bb73fe15`. La rama está verde desde `2bb73fe15`.
  - UI y pasos 2–3: aprobado con pendientes.
- **Pendientes del paso 2 que deciden el diseño (para Gonzalo):**
  - **Medida del reparto entre distritos.** La MOS_d con que se reparten las rutas sale del marco INEI completo; el sorteo y la π, del marco elegible.
    - La π publicada sigue siendo exacta y Σπ = n_h.
    - Con `minimo_viviendas` > 1 o con áreas excluidas, el estrato deja de ser autoponderado. En la sonda del verificador, con mínimo 60, 070106 pasa de 4,7 a 0,8 rutas esperadas.
    - Hay dos salidas: repartir con la medida elegible o dejarlo declarado. Hoy está declarado en la regla publicada.
  - **Asignación en `hojas_ruta_pi_muestra`.** Se recalcula con `cfg$territorios`, mientras la cuota usa los ubigeos de las celdas.
    - Si un distrito confirmado se queda sin celdas, los dos conjuntos difieren.
    - Es un caso de borde, sin test.
  - **Aviso de reemplazos fuera de la zona.** `W_REPLACEMENT_PI_OTRA_ZONA` sale en toda muestra con la política por defecto (otra zona). Hay que decidir el valor por defecto de `replacement_policy`, o bajar el aviso a `info`.
  - **Estrato en la UI.** No hay control: hoy `sample_size$estrato` sólo se fija en la configuración.
- **Integración (2026-11-04):** las cuatro ramas entraron a main sin conflictos (merges `fedeede9b`, `c0a754e62`, `25a5f188f`, `7b4bb8702`). Gate combinado: hojas de ruta 2349 pass, ponderación 427 pass, frontend 913 pass, 0 fallas.
- **Tanda 2 (2026-11-04):**
  - Los ítems 7, 8 y 9 entraron en la rama `claude/reparto-cpv2025-10b43e`, después del merge de main (`960ba78f5`).
  - **P̂25 sigue usando a17** (proporción de 18+ de 2017), aunque ya existe la edad 2025. Las cuotas toman la estructura 2025, pero el total por distrito es el P̂25 del paso 1. Cambiar a17 por a25 movería el reparto entre distritos: es decisión de Gonzalo.
  - La pestaña Población sigue mostrando la estructura del marco 2017: sólo las cuotas cambian con la base 2025.
  - **Pendiente fuera de alcance:** en Tamaño y reparto con N total, la tabla de «Ajustes por distrito» marca `overflow-x` en «San Juan de Lurigancho» y «San Juan de Miraflores» (160 y 153 px en celdas de 150 px). Sale igual con el estrato distrito, así que viene de antes de esta tanda.
