# ADR 0116: Hojas de ruta — la no respuesta pide más visitas, no más entrevistas; el ICC se traslada, no el DEFF

Estado: Aceptado (revisión metodológica del 2026-10-29: «aprobado con cambios»; los 12 cambios obligatorios están
incorporados)

Implementacion: Parcial (U12: 3944b2595, 1df09dac2, 85d904afe, af12a6128 y la revisión de implementación; el salto sobre visitas en la hoja impresa, la regla ante la no respuesta y el registro de disposiciones quedan para U14/U15/U18)

Fecha: 2026-10-29

Fecha de decision: 2026-10-29. La decisión D4 de Gonzalo pide ADR y revisión metodológica antes de tocar el N.

Reemplaza: —

Extiende: [ADR 0114](0114-hojas-de-ruta-el-mapa-es-el-lienzo.md) §6 y [ADR 0115](0115-hojas-de-ruta-marco-elegible.md)
(marco elegible).

## Contexto

El tamaño de muestra de Hojas de ruta (`hojas_ruta_sample_size_preview`, `api/R/hojas_ruta_engine.R` ~4296–4490) usa
dos supuestos que el plan U12 (B3) pide repensar:

1. **Tasa de respuesta** (`sample_size.response_rate`, por defecto 0,90). Hoy solo produce
   `contacts_suggested = ceil(N / respuesta)` (~4484). El plan pedía «inflar el N por no respuesta».
2. **Efecto de diseño** (`sample_size.design_effect`, por defecto **1,0** en el normalizador, ~3125 y ~3180). Con k
   entrevistas por ruta, el conglomerado existe y 1,0 lo ignora. Además, `.hojas_ruta_design_effect_for` usa 1,5
   como respaldo (~3192): dos valores por defecto distintos para lo mismo.

Hechos que condicionan la decisión:

- **Unidad, población y conglomerado.**
  - La unidad de análisis es la persona entrevistada.
  - La población es la del marco INEI de los territorios elegidos, con FPC (~3217–3231).
  - El conglomerado es la **ruta**: la titular y sus reemplazos. Su tamaño es `m = k = entrevistas_por_manzana`,
    constante por diseño (`.hojas_ruta_route_size`, ~3384).
  - Dentro de la vivienda la selección es por cuota de sexo y edad (~7505), no probabilística.
- **El protocolo de campo ante la no respuesta no está codificado.** El protocolo supuesto es este: el encuestador
  avanza con el salto hasta completar k y, si la manzana se agota, pasa al reemplazo pareado de la titular
  (`.hojas_ruta_assign_replacements`, ~5231).
  - El motor hoy no codifica qué hacer ante un rechazo, ni continúa a la manzana contigua.
  - El salto automático `floor(V / k)` (~4669) supone respuesta total.
  - La frase «seguir en la contigua» solo existe como texto en `seleccion/revisionMarco.ts`.

  Este ADR fija ese protocolo.
- **Hay casos de ruta cerrada.** Con `replacements_per_titular = 0` (permitido, ~3524), o al agotarse la titular y
  sus reemplazos, una UMP que no se puede trabajar pierde sus k entrevistas.
- **El ICC medido más cercano no es de rutas.** El de HSVG 2025 (`indice_vbg` 0,015; `indice_hs` 0,028) se midió con
  el aula (`collectorID`) como conglomerado, sobre índices continuos. Un ICC depende de la unidad de conglomeración y
  de la escala del indicador.

## Decisión

### 1. La no respuesta de viviendas no infla el N: dimensiona visitas y capacidad

- **El salto automático se calcula sobre visitas, no sobre entrevistas.**
  - `salto = max(1, floor(V / v))`, con `v = ceil(k / (r·e))`.
  - `e` es la tasa de ocupación y elegibilidad de viviendas: por defecto 1, declarable, porque el censo cuenta también
    las desocupadas.
  - La hoja de ruta incluye la regla ante la no respuesta: continuar con el salto; al agotar la manzana, segunda
    pasada por las viviendas no visitadas; después, las manzanas aledañas en el orden del esquema (1 a 8), con el
    mismo sentido y el mismo salto. *Enmienda (Gonzalo, 2026-10-29):* el tercer paso eran «el reemplazo»; el
    procedimiento de campo es seguir por las aledañas, no pasar a otra manzana sorteada. El texto vive en
    `HOJAS_RUTA_REGLA_NO_RESPUESTA` y lo imprimen la ficha y la hoja del día; va en lenguaje llano.
- **El N no cambia con r.** Inflarlo produciría más entrevistas completas que las diseñadas, y la precisión se
  calcula sobre las completas.
- **Contactos esperados** = `N / r` y **visitas planificadas** = `Σ_rutas ceil(k_b / r)`. Se publican los dos. Con
  un N que no es múltiplo de k, se usa el `k_b` de cada ruta.
- **Capacidad de manzana.** La manzana alcanza si:
  - con salto automático o apagado, `V ≥ v_cap`;
  - con salto manual `s`, `V ≥ s·v_cap`.

  `v_cap` es el percentil 90 de la binomial negativa de visitas hasta lograr k completas, con probabilidad de éxito
  `r·e` y `v_cap ≥ ceil(k / (r·e))`. *Enmienda de implementación (revisión A2):* `v_cap` ya cuenta las visitas a
  viviendas desocupadas, así que la ocupación no se vuelve a descontar sobre `V`.
  La media falla en la mitad de las rutas. El aviso de la revisión contra el marco usa ese umbral, y el inspector del
  marco elegible (ADR 0115) lo muestra como referencia, sin imponerlo.
- **Rutas sin reemplazo.** Con `replacements_per_titular = 0`, la no respuesta de la UMP sí reduce las completas. El
  motor emite `W_UMP_NONRESPONSE_UNCOVERED` y ofrece ajustar las rutas por la tasa de acceso a UMP.
- **El sesgo no se corrige con la sustitución.**
  - La sustitución dentro de la ruta conserva el N, pero reemplaza a quien no respondió por un vecino disponible.
  - La tasa supuesta se declara en la ficha técnica.
  - La hoja de ruta registra la disposición de cada visita: completa, rechazo, ausente, desocupada o no elegible.
    Con eso Monitoreo (U18) mide r y e reales por ruta y zona.
  - La política `alternate_zone_same_district` se declara como un cambio en la probabilidad de selección.

### 2. El ICC se guarda por estudio y se traslada; el DEFF se recalcula con el k de la ruta nueva

**Biblioteca de ICC.** Una entrada es un ICC medido, no un DEFF:

```json
{
  "id": "acnur-pdm-2025-ingreso",
  "estudio": "ACNUR PDM 2025",
  "indicador": "ingreso_hogar_bajo",
  "escala": "proporcion",
  "unidad_conglomerado": "ruta",
  "definicion_conglomerado": "ruta: titular + reemplazos",
  "estimador": "ANOVA, escala observada, m0 ajustado por tamaño desigual",
  "icc": 0.06,
  "icc_ic95": [0.02, 0.10],
  "m_medio": 7.8,
  "conglomerados": 142,
  "fecha": "2025-11-30",
  "fuente": "Base depurada del estudio"
}
```

- **Se traslada el ICC, no el DEFF.** El DEFF del estudio nuevo es `1 + (k − 1)·ICC` con su propio k. Copiar el DEFF
  de otro estudio arrastra el tamaño de conglomerado de ese estudio.
- **La fórmula tiene alcance limitado.** `1 + (k − 1)·ICC` es solo el componente de conglomeración, con k constante.
  No incluye el efecto de los pesos desiguales (`1 + CV_w²`, de PPS sobre un marco viejo más la posestratificación) ni
  el de la estratificación. Con selección final por cuotas, el margen es nominal, y así se declara.
- **Solo se aplica un ICC de la misma unidad y escala que el indicador de diseño (proporción).** Un ICC ≤ 0, NA o
  mayor que 1 se muestra pero no se aplica. Lo mismo para una entrada sin `conglomerados` o sin
  `unidad_conglomerado`.
- **`W_ICC_FEW_CLUSTERS`** cuando `conglomerados < 50` o cuando el IC 95 % del ICC es más ancho que el propio ICC. La
  experiencia de HSVG (3 a 6 aulas por facultad, DEFF de 0,23 a 3,67) es la razón de este criterio.
- **El usuario elige el indicador principal.** La interfaz preselecciona el mayor ICC compatible, lo rotula como
  conservador (el máximo de estimaciones ruidosas está sesgado hacia arriba) y no aplica nada sin confirmación.
- **Los overrides por distrito prevalecen.** `design_effect_overrides` por distrito prevalece sobre el ICC aplicado, y
  el distrito queda marcado.

**Dónde vive.** La biblioteca es transversal a los proyectos y no tiene datos de personas. Vive en el directorio de
datos de la app (`tools::R_user_dir("prosecnur", "data")/hojas_ruta/icc.json`), no dentro de un `.pulso`. Para que el
proyecto se pueda reproducir sin la biblioteca, la entrada aplicada **se copia** en la config del run, en
`sample_size.icc_aplicado`, con el `k` de la ruta y el DEFF resultante.

### 3. La procedencia del DEFF se declara

- Se agrega `sample_size.design_effect_fuente ∈ {legado, por_declarar, manual, icc_biblioteca}`.
- Un config sin el campo es `legado` y su N no cambia. Un proyecto nuevo nace en `por_declarar`.
- Con k > 1, fuente `legado` o `por_declarar` y **DEFF ≤ 1**, el motor emite `W_DEFF_IGNORES_CLUSTERING` y todo margen
  publicado se rotula «margen bajo MAS, no incluye conglomerado». *Enmienda de implementación:* un `legado` con DEFF
  mayor que 1 sí incluye algo del conglomerado en el número; rotularlo así sería falso. Su procedencia desconocida se
  declara como aviso informativo en la ficha técnica (U15).
- Con k = 1 no hay aviso de conglomerado. El DEFF no se fuerza a 1, porque puede incluir el efecto de los pesos. Un DEFF manual menor que 1 con k > 1 genera aviso.
- El respaldo de `.hojas_ruta_design_effect_for` se alinea con el valor por defecto del normalizador.

## Consecuencias

- Ningún N existente cambia. La tasa de respuesta deja de prometer algo que no hacía, y el DEFF de los proyectos
  existentes queda como `legado`.
- La hoja de ruta lleva el salto sobre visitas, las visitas esperadas, la regla ante la no respuesta y el registro de
  la disposición de cada visita. Es lo que el encuestador necesita y lo que Monitoreo podrá medir.
- Un ICC medido en un estudio sirve al siguiente sin arrastrar el tamaño de conglomerado del anterior. No se mezclan
  unidades de conglomeración ni escalas.
- El aviso «menos viviendas que entrevistas» se vuelve más estricto (`v_cap`). Aparecerán más rutas «a revisar», y es
  correcto.
- *Enmienda de implementación:* `contacts_suggested` se **conserva** (es `ceil(N / r)`, los contactos esperados), y
  las visitas planificadas se agregan aparte en `visitas`. Así ningún lector actual cambia. El espejo `motorTamano.ts`
  y su golden se extienden con las visitas en U14/U15.
- Con un ICC aplicado, el DEFF sigue al k actual: si cambian las entrevistas por ruta, se recalcula
  `1 + (k − 1)·ICC` (revisión A1). Si el DEFF se edita después de aplicarlo, la procedencia pasa a `manual`.

## Cumplimiento

`api/tests/testthat/test-hojas-ruta-tamano-extras.R` (archivo nuevo `api/R/hojas_ruta_tamano_extras.R`):

- **N y precisión:** el N, las completas y el margen no cambian con r, ni con r = 1.
- **Tasa de respuesta en el límite:** con `response_rate` en 0,01 (`.hojas_ruta_prop` divide entre 100 los valores
  mayores que 1), las visitas que resultan y el aviso.
- **Sin entrevistas:** con `n_used = 0`, contactos y visitas en 0, sin dividir entre cero.
- **N no múltiplo de k:** los contactos con `external_district` usan el `k_b` de cada ruta.
- **Salto y capacidad:**
  - el salto se calcula sobre visitas;
  - la capacidad por modo de salto (automático, manual, apagado), con V = 0, V < v y V = v;
  - los reemplazos usan las entrevistas de su titular.
- **DEFF:**
  - con k = 1, DEFF = 1 sin aviso;
  - un DEFF manual menor que 1 con k > 1 avisa.
- **ICC:**
  - se rechaza un ICC ≤ 0, NA o mayor que 1;
  - no se aplica una entrada incompleta, de otra unidad o de otra escala, y el config queda intacto;
  - gana el override por distrito, y queda marcado.
- **Reproducibilidad y legado:**
  - `icc_aplicado` reconstruye el DEFF sin la biblioteca;
  - `design_effect_fuente` sobrevive a guardar y abrir el `.pulso`;
  - un proyecto sin el campo da el N idéntico al golden actual;
  - el respaldo de `.hojas_ruta_design_effect_for` coincide con el valor por defecto del normalizador.
- **Rutas sin reemplazo:** `replacements_per_titular = 0` dispara `W_UMP_NONRESPONSE_UNCOVERED`.
- **Front:**
  - vitest de `revisionMarco.ts` con el umbral nuevo;
  - el espejo TS (`motorTamano.ts`) refleja contactos y visitas, y el contrato contra R
    (`tamanoMuestra.contract.test.ts`) se regenera.
- **Revisión:** `revisor-metodologico` revisa la implementación.

## Opcionales registrados

- Guardar en cada entrada de la biblioteca el ámbito (ciudad, urbano o rural, densidad), porque el ICC depende de la
  geografía.
- Mostrar, como análisis de sensibilidad, el DEFF con el ICC en el límite superior de su IC.
- Al cerrar el campo, recalcular el ICC con la ruta titular como conglomerado y ofrecerlo a la biblioteca (lazo con
  U18).
