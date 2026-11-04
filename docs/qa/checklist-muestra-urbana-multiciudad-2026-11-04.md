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
| 1 | Repartir la muestra con la población 2025, no con los conteos 2017 | ADR 0131 §1–§2 · `hojas_ruta_engine.R:3912-3918` y `:4313` (congelado) + archivo nuevo · `territorios.json` | **postergado**: Gonzalo, 4/11: «el cálculo de la muestra puede ir después» |
| 2 | Selección probabilística de la persona en el hogar | ADR 0131 §4 | **descartado**: Gonzalo, 4/11: cuotas sólo de sexo y grupos de edad validados por el INEI. El motor ya trabaja así |
| 3 | Peso final por persona (manzana × vivienda) y calibración a 2025 | ADR 0131 §3, §5–§6 · `hojas_ruta_sorteo_pps.R:197-218`, `hojas_ruta_marco_elegible.R:540-623`, `ponderacion_engine.R`, `ponderacion_analitica.R` | **postergado** con el ítem 1 |
| 4 | Verificar si REDATAM CPV 2025 da sexo × edad × nivel educativo por provincia o distrito | fuente externa (`redatamcpv2025.inei.gob.pe`) | pendiente: probar desde el navegador |
| 5 | Decisión de cobertura urbana anotada en el brief interno de la propuesta | doc fuera del repo | hecho |
| 6 | Variante nacional urbana: repartir n por departamento con población urbana 2025 y sortear en la(s) ciudad(es) principal(es) de cada uno; hace falta marco de manzanas en los 6 departamentos sin ciudad (Amazonas, Apurímac, Huancavelica, Madre de Dios, Moquegua, Pasco) | `build_inei2017_ciudades.R` (`HOJAS_RUTA_CIUDADES_PROVINCIAS`) + ADR 0119 §1 (umbrales) + capa GeoPeru | **bloqueado**: exige descargar la capa GeoPeru (externo) y decidir si se aceptan ciudades bajo los umbrales del ADR 0119 |

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
