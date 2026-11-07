# ADR 0121 — La representatividad la declara el estudio: universo y variables de cuota

- **Estado**: Aceptado (Gonzalo, 2026-10-31: «Aprobado, empieza F1»)
- **Implementación**: F1 completa (`monitoreo_aulas_representatividad_declarada()`, publicada como `representatividad_declarada`); F2 completa (`monitoreo_aulas_avance_por_celdas()`, publicada como `avance_cuota.celdas_declaradas`; sobre HSVG y CCSS reales da las mismas cifras que `avance_cuota` y `quotas_sex_faculty`, celda por celda); F3 completa en Avance (Por facultad cruza por las variables declaradas y el lateral sale de la atribución del eje; guard `ejeSinCablear`); F4 en curso: la LECTURA está hecha (`monitoreo_aulas_representatividad_planner.R`: Monitoreo toma universo y variables de lo declarado en el Planner —nunca de lo proyectado— y las celdas del escenario, y publica `discrepancias` sin cambiar cifras); la ESCRITURA también (`router_calc_muestra_representatividad.R`: `GET /api/calc-muestra/representatividad` da la vista previa y `POST …/declarar` manda universo y variables del escenario por `.planner_declarar_representatividad`, sin celdas y con la revisión vigente); falta el botón en la UI, con la decisión de dónde vive consultada a Meta B; F5 pendiente
- **Ámbito**: Cálculo de muestra (la declaración) · Monitoreo de cursos-horario
  (el avance) · todas las vistas de Avance, Modelo y Control del modo
- **Fecha**: 2026-10-31
- **Origen**: dictado de Gonzalo en sesión:

  > «De la misma forma que en Cálculo de muestra podemos ver representatividad a
  > nivel de toda una universidad, también a nivel de una sola facultad. Y la
  > variable de representatividad puede cambiar: a nivel de universidad la cuota
  > es el sexo y la facultad; a nivel de facultad puede ser el nivel curricular.
  > Tiene que tener esa generalidad, no hardcodear.»

  Y, preguntado si la app debe admitir combinaciones como nivel × sexo, carrera ×
  nivel o tres variables, con el universo declarado: «Sí».
- **Extiende**: [ADR 0086](0086-el-eje-de-cuotas-lo-declara-el-estudio.md) (un
  eje declarable) a N variables; conserva sus reglas de atribución y el catálogo
  cerrado de dimensiones.
- **Respeta**: [ADR 0079](0079-el-cumplimiento-se-mide-contra-la-cuota-del-diseno.md)
  (las celdas no se compensan; el contrato v1 de importación sigue leyéndose),
  [ADR 0081](0081-la-facultad-de-un-aula-no-es-la-de-sus-alumnos.md) y
  [ADR 0088](0088-el-numerador-de-una-celda-es-la-persona.md) (la persona es la
  unidad, el aula el vehículo).

## Contexto

Hoy la cuota es **un eje más el sexo opcional**:

- Cálculo de muestra reparte por un solo `estrato` con una partición binaria
  (`N_a`/`N_b`, que es el sexo) en `.cm_calc_conglomerado`.
- Monitoreo importa `design_targets` v1: `facultades[]` con `cuota` y
  `cuota_sexo {F, M}`. El eje (ADR 0086) puede ser facultad, carrera o nivel,
  pero el cruce con sexo sólo existe con facultad.
- El universo (toda la universidad o una facultad) no se declara: se deduce del
  plan.

Con eso no se puede expresar un estudio de una facultad con cuota por nivel ×
sexo, ni uno por carrera × nivel, ni tres variables. Y cada vista nueva tiende a
escribir «Facultad» como texto fijo.

## Decisión

### 1. El estudio declara su representatividad en un solo bloque

```
representatividad = {
  schema: "representatividad_v1",
  universo: {
    nivel: "universidad" | "facultad" | "carrera" | <otra unidad del catálogo>,
    valor: "Ciencias Sociales" | null,      # null cuando el universo es la universidad entera
    etiqueta: "PUCP" | "Facultad de Ciencias Sociales",
    poblacion: 1354                         # tamaño del universo, si se conoce
  },
  variables: [                              # en orden: la primera agrupa las vistas
    { clave: "facultad", etiqueta: "Facultad", plural: "Facultades",
      atribucion: "aula" | "persona", fuente: "plan" | "padron" | "respuesta",
      categorias: [ { valor, etiqueta, orden } ] },
    { clave: "sexo", ... }
  ],
  celdas: [                                 # el producto que el diseño fijó, no todo el producto cartesiano
    { valores: { facultad: "DERECHO", sexo: "F" }, cuota: 120, sobremuestra: 60, tau: 0.57 }
  ],
  agrupacion_operativa: "facultad" | "carrera"   # por qué se cuentan AULAS (no personas)
}
```

- `variables` sale del catálogo cerrado de dimensiones (ADR 0086: facultad,
  carrera, nivel), ampliado con `sexo` como dimensión de pleno derecho. Una
  dimensión nueva se agrega al catálogo, nunca como caso especial.
- `celdas` lista sólo las combinaciones con meta. Las que el diseño no fijó no
  existen; una respuesta que cae fuera va a `fuera_del_diseno`, como hoy.
- La cuota total es la suma de las celdas; la brecha también se suma **celda a
  celda** (ADR 0079): un hombre de más no cubre a una mujer que falta.

### 2. Cálculo de muestra la produce; Monitoreo la importa sin reinterpretarla

- El escenario activo de Cálculo de muestra declara el universo y las variables
  de cuota, y escribe `celdas` al repartir la muestra.
- `monitoreo_aulas_from_calc` copia el bloque a `design_targets.representatividad`.
- **Compatibilidad**: un `design_targets` v1 (sin el bloque) se traduce al leer:
  `facultades[] + cuota_sexo` → variables `[facultad, sexo]`; un eje por nivel
  sin sexo → `[nivel]`. Ningún proyecto existente cambia sus cifras.

### 3. El avance se calcula por celdas de N variables

- `avance_cuota` publica `celdas[]` con los mismos `valores` del diseño, más
  `logradas`, `brecha` y `proyeccion`. Publica también `marginales[clave]`:
  el avance por cada variable, sumando celdas, con su brecha sumada desde las
  celdas (nunca `meta − logradas` del marginal).
- La atribución de cada respuesta a cada variable sigue su declaración: `aula`
  (del plan), `persona` (del padrón) o `respuesta` (lo que declara el alumno,
  como el sexo).
- `quotas_sex_faculty` y `avance_sexo_facultad` quedan como **lecturas
  derivadas** del bloque nuevo para las vistas heredadas, hasta que se retiren.

### 4. Las vistas se arman con la declaración

- Ninguna vista nombra, agrupa ni cruza por una variable fija. Los rótulos y
  los plurales salen de `variables[].etiqueta` y `variables[].plural`.
- La primera variable agrupa (tarjetas de A1, filas de A2); la segunda, si
  existe, se muestra dentro de cada grupo (las barras por sexo de A2 pasan a
  ser «por la segunda variable»). Con tres o más, la vista ofrece elegir el par
  que se cruza, sin perder el total por celda.
- El foco es `foco=<clave>:<valor>` (hoy `foco=facultad:X`).
- Las variables que el estudio no declaró como cuota se muestran sólo como
  composición descriptiva (`avance_cuota.composicion`), sin umbrales ni avisos
  de desvío.
- Un guard de contrato falla si un modelo de Aulas usa «Facultad» como texto
  fijo fuera del respaldo de compatibilidad.

## Fases

| Fase | Qué | Cambia cifras |
|---|---|---|
| F1 | Contrato y traductor v1 → `representatividad` en el motor, con tests sobre HSVG y CCSS | No |
| F2 | `avance_cuota` por celdas de N variables y sus marginales; lecturas derivadas para lo heredado | No en HSVG ni CCSS (mismas celdas) |
| F3 | Vistas de Avance (A1–A5) y el foco leen la declaración; guard de contrato | No |
| F4 | Cálculo de muestra declara universo y variables en el escenario y escribe `celdas` | Sí, en estudios nuevos |
| F5 | Modelo › Metas (M1) muestra y explica la declaración; Insumos › Reglas deja elegirla | No |

### Coordinación (Meta B, 2026-10-31)

- F4 la hace la misma sesión que F1–F3, después de F3. Ninguna otra sesión toca
  `calc_muestra_*`, `design_targets` ni el foco.
- El foco nuevo `foco=<clave>:<valor>` lee `foco=facultad:` como alias y nunca lo
  vuelve a escribir (`lib/navegacion/direccion.ts`): hay enlaces y capturas de QA
  con la forma vieja.
- `monitoreo_engine.R` y `router_monitoreo.R` no crecen: el código nuevo va en
  archivos propios.
- Si F2 cambia `avance_pct` o la base del avance, revisar `project_overview.R` y
  `test-project-overview.R`: la tarjeta del Home no puede contradecir al módulo.
- F4 no cambia cifras ni la UI de Cálculo de muestra sin capturarla antes y
  después con HSVG 2026, y corre el gate de aulas más `test-calc-muestra*`. Una
  decisión de producto en la UI de Cálculo se consulta a Meta B antes.

### Enmienda del ADR 0122 (ratificado por Gonzalo, 8373777f4)

El [ADR 0122](0122-el-planner-define-el-estudio-y-fija-los-modos.md) enmienda el §2: la
declaración de universo y variables (F4) se escribe en el Planner, no en
`calc_muestra_*` como destino final. **F4 queda en espera** hasta que exista la P1 del
Planner. F1–F3 no cambian.

## Lo que no decide

- Cómo se reparte la muestra entre celdas de N variables en Cálculo de muestra
  (afijación). F4 necesita su propia decisión metodológica.
- Si la ponderación de Procesamiento usa las mismas celdas. Es lo esperable,
  pero queda para un ADR de ponderación.

## Consecuencias

- Un estudio puede ser «PUCP, facultad × sexo» o «Ciencias Sociales, nivel ×
  sexo» sin tocar código de vistas.
- Las vistas pierden su forma fija: cada una debe probarse con al menos dos
  declaraciones (las de HSVG y CCSS) y las maquetas se dibujan en ambas.
- El contrato v1 sigue leyéndose mientras exista un `.pulso` que lo traiga.
