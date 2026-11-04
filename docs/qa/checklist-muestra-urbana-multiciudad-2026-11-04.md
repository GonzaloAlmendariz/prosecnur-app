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
| 3 | Peso final por persona (manzana × vivienda) y calibración a 2025 | ADR 0131 §3, §5–§6 · `hojas_ruta_pi_muestra.R` (nuevo), `ponderacion_engine.R` | **parcial**: π de titulares y reemplazos publicada en la muestra (paso 3 del ADR, 2026-11-04). Falta la probabilidad de vivienda (§3) y el peso con calibración (paso 5, `ponderacion_*`, otra sesión) |
| 4 | Verificar si REDATAM CPV 2025 da sexo × edad × nivel educativo por provincia o distrito | fuente externa (`redatamcpv2025.inei.gob.pe`) | pendiente: probar desde el navegador |
| 5 | Decisión de cobertura urbana anotada en el brief interno de la propuesta | doc fuera del repo | hecho |
| 6 | Variante nacional urbana: repartir n por departamento con población urbana 2025 y sortear en la(s) ciudad(es) principal(es) de cada uno; hace falta marco de manzanas en los 6 departamentos sin ciudad (Amazonas, Apurímac, Huancavelica, Madre de Dios, Moquegua, Pasco) | `build_inei2017_ciudades.R` (`HOJAS_RUTA_CIUDADES_PROVINCIAS`) + ADR 0119 §1 (umbrales) + capa GeoPeru | **bloqueado**: exige descargar la capa GeoPeru (externo) y decidir si se aceptan ciudades bajo los umbrales del ADR 0119 |
| 7 | Estrato explícito provincia, mínimo 2 rutas, distrito y zona implícitos (ADR 0131 paso 2) | `api/R/hojas_ruta_estrato.R` (nuevo) · `sample_size$estrato` | **hecho en backend** (commit `ace1e979e`): `provincia` y `provincia_lima_areas` (Lima en 5 áreas, Callao aparte). Tests: Σ n_h = rutas, n_h ≥ 2, Σπ = n_h por estrato, π > 0 en toda manzana con medida, Monte Carlo (6.000 réplicas) contra π, vista previa = cuota. **Pendiente:** el control en la UI |
| 8 | Publicar π de titulares y reemplazos en la muestra (ADR 0131 paso 3) | `api/R/hojas_ruta_pi_muestra.R` (nuevo) · payload `blocks` / `replacement_blocks` | **hecho**: `estrato`, `pi`, `pi_regla` en titulares; `estrato`, `pi`, `pi_fuente` en reemplazos. El pareado de la misma zona hereda; el de otra zona queda sin π y avisa (`W_REPLACEMENT_PI_OTRA_ZONA`). **Decisión pendiente:** la política por defecto del motor es `alternate_zone_same_district` (otra zona), al revés de lo que supone el ADR §5 |

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
