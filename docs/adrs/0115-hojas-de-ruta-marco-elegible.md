# ADR 0115: Hojas de ruta — el marco elegible se declara, se resuelve en R y se informa

Estado: Aceptado (revisión metodológica del 2026-10-29: «aprobado con cambios»; los 13 cambios obligatorios están
incorporados)

Implementacion: En curso (U11: backend 55df3d685, 50c150143, 14bae4f28; interfaz 08d56b355, b9256aded; revisión metodológica de la implementación D1–D7 en 21afc2e9f, ebf23f8b5, a9016f9c2, 6acf2b36c y siguientes)

Fecha: 2026-10-29

Fecha de decision: 2026-10-29. La decisión D4 de Gonzalo pide ADR y revisión metodológica antes de implementar
cualquier cambio del diseño muestral; esta versión ya incorpora esa revisión.

Reemplaza: —

Extiende: [ADR 0114](0114-hojas-de-ruta-el-mapa-es-el-lienzo.md) §6 («lo que cambia el diseño muestral necesita su
propio ADR») y [ADR 0009](0009-hojas-ruta-fases-piloto-campo-real.md) (exclusiones del piloto en Campo real).

## Contexto

Hoy el sorteo de manzanas usa como marco **todas** las manzanas INEI 2017 de los distritos confirmados
(`.hojas_ruta_filter_frame`, `api/R/hojas_ruta_engine.R` ~3631). La única depuración es la del ADR 0009: en Campo
real se quitan las titulares que ya salieron en el piloto (`excluded_titular_ids`).

Eso deja tres problemas que el equipo resuelve a mano y sin dejar rastro:

1. **Manzanas sin hogares a quién entrevistar.** En el marco por defecto (`frame_source = "current"`, engine ~3063),
   30.952 de 117.409 manzanas (26 %) tienen `viviendas = 0`. Además, `.hojas_ruta_sample_indices` (~4590) reemplaza
   `prob <= 0` por 1, así que esas manzanas se sortean con probabilidad positiva. En `acnur_acg`, el sorteo vigente
   tiene 1 titular y 5 reemplazos con 0 viviendas.
2. **Áreas que se sabe de antemano que no se pueden trabajar** (industriales, de alto riesgo, inaccesibles). Hoy se
   reemplazan después de sorteadas, sin motivo registrado.
3. **Zonas que no alcanzan, y entrevistas que se pierden en silencio.** `W_FRAME_INSUFFICIENT` (~5513) aparece
   *después* de sortear. Peor todavía, hay dos caminos que descartan n sin sumarlo a `unassigned_total`:
   - un distrito sin manzanas: `if (!nrow(district_frame)) next`, ~5470;
   - con `row_var = "zona"`, la cuota de una zona sin manzanas: `merge(zone_frame, zone_quota, all.x = TRUE)`, ~5490.

   Hoy casi no pasan. Con áreas excluidas, pasan a ser un caso realista.

Dos hechos del marco condicionan el diseño:

- En el marco `current`, el «0» de viviendas **mezcla cero censal y conteo faltante**: 30.421 de las 30.952
  manzanas en 0 tienen `match_level = "sin_conteo_redatam"`
  (`api/inst/hojas_ruta/build_inei2017_lima_callao_frame.R` ~271-291). La población que se pierde en el marco es
  mínima (940 de 9,03 M), pero se concentra en balnearios y en la periferia: Santa María del Mar 89 %, Punta Negra
  75 %, Punta Hermosa 74 %, Carabayllo 41 % y San Isidro 33 % de sus manzanas.
- El marco `current` **no trae coordenadas**: `lat` y `lon` son NA en las 117.409 filas. La geometría está en la
  cartografía (`cartografia_manzanas_inei2017_lima_callao.json`, por `cartografia_id`), que ya lee
  `api/R/hojas_ruta_geometria.R` (U1) para el lienzo.

## Decisión

### 1. Dos criterios, declarados en la config del run

`integrated_config` gana un objeto `marco_elegible`:

```json
{
  "declarado": true,
  "minimo_viviendas": 1,
  "areas_excluidas": [
    {
      "id": "exc-1",
      "motivo": "inseguridad",
      "detalle": "Cerro sin acceso vehicular",
      "fuente": "Informe de supervisión de campo 2025",
      "fecha_evidencia": "2025-11-14",
      "poligono": [[-77.010000, -12.050000], [-77.000000, -12.050000], [-77.000000, -12.060000], [-77.010000, -12.050000]],
      "creada": "2026-10-29T10:00:00Z"
    }
  ]
}
```

**`minimo_viviendas`** (entero ≥ 0). Una manzana entra al marco si tiene al menos esa cantidad de viviendas censales.

- Con 1 salen las manzanas sin viviendas registradas en el marco 2017. En el marco `current` ese cero mezcla cero
  censal y conteo faltante (`match_level = sin_conteo_redatam`, 30.421 de 30.952).
- La pérdida medida en el marco es mínima, pero **no es nula en la población real**: excluye manzanas vacías en
  2017 que hoy pueden estar habitadas, típicamente asentamientos de expansión como los de Carabayllo.
- El resumen informa por separado cuántas manzanas salen por cero censal y cuántas por falta de conteo.
- El mínimo se evalúa siempre sobre `viviendas`, nunca sobre `measure_var`. Con este criterio activo, el
  reemplazo `prob <= 0 → 1` de `.hojas_ruta_sample_indices` deja de aplicarse a manzanas sin viviendas, porque ya
  no están en el marco.
- La interfaz no propone «entrevistas por ruta» como techo del mínimo, porque la ruta continúa en manzanas
  contiguas. Para un mínimo mayor que 1, muestra antes la curva de cobertura: población perdida según *m*.

**`areas_excluidas`**: polígonos dibujados en el lienzo (lon/lat WGS84).

- Cada polígono lleva un **motivo** de una lista cerrada (`inseguridad`, `no_residencial`, `inaccesible`, `otro`) y
  un **detalle** en texto libre. El detalle es obligatorio con `otro`.
- Los motivos `inseguridad` e `inaccesible` llevan además, obligatoriamente, la **fuente** y la **fecha de la
  evidencia**.
- Una manzana queda fuera si su **punto interior garantizado** (*point-on-surface*, tomado de la geometría de la
  cartografía por `cartografia_id`) cae dentro de algún polígono o **sobre su borde**.
- Una manzana sin geometría se queda en el marco y se cuenta como `sin_geometria`.
- Los polígonos se validan en sus coordenadas: lon/lat dentro de Lima y Callao, con detección del orden invertido.
  Se guardan canonizados: anillo cerrado y coordenadas redondeadas a 1e-6.

**Precedencia.** Una manzana que cumple los dos criterios se cuenta una sola vez, en el primero que aplica en este
orden: área excluida, mínimo de viviendas, piloto (§5).

Las reglas se aplican igual a titulares y a reemplazos: los reemplazos se sortean del mismo marco elegible.

### 2. Se resuelve en R: un archivo nuevo y dos enganches en el motor congelado

Toda la lógica vive en un archivo nuevo, `api/R/hojas_ruta_marco_elegible.R`:

- `hojas_ruta_marco_elegible_normalizar(x)` valida, canoniza y descarta lo inválido con un aviso, sin fallar.
  Una corrida **sin la clave** se normaliza como legacy (`declarado = false`, `minimo_viviendas = 0`, sin áreas).
- `hojas_ruta_marco_elegible_aplicar(frame, me)` devuelve el marco filtrado y el resumen de lo excluido por
  distrito y por zona (manzanas, viviendas y población) separado por criterio, con el perfil NSE de lo excluido
  frente a lo elegible.
- `hojas_ruta_marco_elegible_preview(config)` arma el resumen y la capacidad por zona sin sortear (§3).
- `hojas_ruta_marco_elegible_completar(resultado, config)` es el posproceso del sorteo (§3).

`hojas_ruta_engine.R` está congelado a crecimiento, y su normalizador es una **lista cerrada**: un campo que no nombra
se pierde en silencio (~3621). Por eso el motor recibe exactamente **dos enganches**, y su línea base en
`agentic/manifest.json` sube por esas líneas y por ninguna otra:

1. en el normalizador: `marco_elegible = hojas_ruta_marco_elegible_normalizar(config$marco_elegible)`;
2. en `.hojas_ruta_filter_frame`, después del filtro por territorio y antes de las exclusiones del piloto:
   `frame <- hojas_ruta_marco_elegible_aplicar(frame, cfg$marco_elegible)$frame`.

Las n que hoy se descartan sin aviso (contexto, punto 3) **no** se corrigen dentro del motor. Las corrige el
posproceso del §3, que se llama desde el router al terminar el sorteo y que no toca el bucle congelado.

**Se descartó** traducir las exclusiones a ids y meterlas en `excluded_titular_ids`. Ese campo significa «titulares
del piloto» (ADR 0009) y alimenta su propio aviso. Mezclarlos borraría la diferencia entre las dos depuraciones,
que es justo lo que el informe tiene que contar.

### 3. Lo que no alcanza se avisa antes de sortear, y nada se pierde en silencio después

`POST /api/hojas-ruta/marco-elegible/preview` vive en un router nuevo registrado en `plumber_app.R` y devuelve:

- **Por distrito y por zona:** manzanas, viviendas y población del marco completo y del elegible, con su cobertura
  en %. Si la población del distrito es 0, la cobertura es NA y no hay división por cero.
- **Capacidad por zona:** manzanas elegibles frente a `rutas × (1 + reemplazos_por_titular)`, con el reparto
  que usa el sorteo.

  *Enmienda de implementación (2026-10-29, revisión metodológica D6).* El reparto vive en el bucle de
  `hojas_ruta_sample_preview_integrado`, dentro del motor congelado, y no es una función que se pueda llamar sola.
  Extraerlo exigiría hacer crecer el motor mucho más que los dos enganches del §2. Por eso
  `.hojas_ruta_me_reparto` lo **replica** con los mismos helpers (`.hojas_ruta_route_size`,
  `.hojas_ruta_allocate_integer`, el `merge` por zona con `row_var = "zona"`). La equivalencia no se supone: la
  fija un test de paridad contra sorteos reales, tanto en el caso base como en Campo real con exclusiones del piloto.
  Si el motor cambia su reparto, ese test se pone rojo. La paridad con `row_var = "zona"` queda pendiente.
- **`W_ZONE_SHORT_BEFORE_DRAW`** por cada zona que no alcanza. El aviso distingue si faltan titulares o solo
  reemplazos.
- Las alertas de normalización (polígono inválido o fuera del territorio, motivo desconocido, falta de fuente), lo
  que saca cada área (manzanas, viviendas, población) y el aviso de un área que no toca ninguna manzana de los
  distritos elegidos. *Pendiente:* contar las manzanas que **cruzan** cada borde, que exige la geometría completa de
  cada manzana y no sólo su punto interior.

`hojas_ruta_marco_elegible_completar` recorre, después del sorteo, la cuota por distrito y por zona frente a lo
asignado. **Si un distrito o una zona con cuota se queda sin manzanas elegibles, su n se suma a
`E_UNASSIGNED_INTERVIEWS` y no se descarta.** Esto cubre el `next` de un distrito vacío y el `merge(all.x = TRUE)`
de `row_var = "zona"`. El resto entero de `n_district / route_size` es un defecto anterior a este ADR y queda
anotado como hallazgo aparte.

`W_ZONE_SHORT_BEFORE_DRAW` es un **código de alerta** dentro del payload, igual que `W_FRAME_INSUFFICIENT`. No es un
error de API, así que no va a `errors_registry.R`, que registra los `E_*` de `stop_api`. La fila U11 del plan decía
otra cosa; queda corregida aquí.

**Modo opcional de reparto** (recomendación, no obligatorio en U11): `zone_allocation = "proportional_capped"`,
explícito en la config. La zona corta toma todas sus manzanas (π = 1) y el resto de sus rutas se reparte entre las
otras zonas del distrito en proporción a la medida elegible. Nunca se redistribuye en automático.

### 4. La cobertura se dice siempre

- El inspector de Manzanas muestra la cobertura del marco elegible frente al completo por distrito y por zona, en
  número y en %. Incluye la comparación NSE de lo excluido frente a lo elegible.
- **Ámbar** si la población excluida supera el **5 %** en un distrito o en una zona.
- Con **10 % o más** en un distrito, o con lo excluido concentrado en un NSE, se exige una **decisión registrada**
  antes de sortear: (a) redefinir la población objetivo en el informe, o (b) aceptar con justificación. Nunca es
  automático, y la decisión queda en la bitácora (U17).
- **Enmienda U17 (2026-10-29), la bitácora de Hojas de ruta.** «La bitácora» de este ADR es una clave propia de la
  sesión, `s$hojas_ruta_bitacora`, persistible (censada en `session_schema.R`), escrita sólo por
  `hojas_ruta_bitacora.R`. Cada entrada lleva `id`, `fecha`, `fase` (la activa al anotar), `accion`, `resumen` y
  `detalle`. Reglas:
  - **Vocabulario cerrado** (`HOJAS_RUTA_BITACORA_ACCIONES`): una acción desconocida se rechaza. Desde la interfaz
    sólo se anotan `decision_cobertura` y `nota`; el resto lo anotan los endpoints que mutan (territorio, población,
    tamaño (con el ICC aplicado en su detalle), sorteo, adopción del marco, reemplazos puntuales, plan de campo, `campo_desde_piloto` como separador de generación).
  - **Retención**: las 500 entradas más recientes. Sin versión de esquema: una clave ausente se lee como lista vacía.
  - **No es decisión lo que no se aplicó**: un cálculo con `origen = "restauracion"` (warm start o hidratación que
    rehacen salidas al abrir el proyecto) no anota, y una piloto bloqueada tampoco (su config se descarta). Una
    entrada igual a la última de la misma acción y fase no se repite.
  - **El detalle es un resumen**: para el marco elegible, mínimo, número de áreas, motivos y una huella; nunca los
    polígonos. Las notas y justificaciones son texto libre y pasan por el anonimizador antes de que un `.pulso` vaya
    a proyectos de referencia (ADR 0043).
  - **No son entradas de la Bitácora del proyecto** (`s$diseno_estudio_bitacora`, ADR 0027/0047/0108). Aquélla es la
    narrativa del estudio, escrita a mano y con su propio esquema versionado; ésta es el rastro que el motor deja de
    cada decisión del diseño muestral, por fase, para el informe de diseño (U16). Mezclarlas obligaría a la
    Bitácora del proyecto a filtrar ruido automático y a su migración a conocer un vocabulario ajeno. Si más
    adelante la Bitácora del proyecto quiere mostrarla, la lee por `GET /api/hojas-ruta/bitacora`; no la copia.
- El sorteo y las salidas llevan `sample.marco_elegible`: criterios, conteos, reparto por zona y las sumas de
  verificación del §5.
- El informe de diseño muestral (U16) publica la frase «La muestra representa a los hogares de manzanas con al
  menos *m* viviendas registradas en 2017, fuera de las áreas excluidas (*k* áreas, *x* % de la población del
  distrito)». También publica la lista de áreas con su motivo y el perfil NSE de lo excluido. Si la cobertura está
  bajo el umbral, el titular no usa el nombre del distrito solo.

### 5. Lo que NO cambia, y lo que se declara

- **El N y las cuotas no se recalculan contra el marco elegible.** Salen de la población INEI por distrito y edad,
  que describe la población objetivo, no el marco. Siguen siendo alcanzables, porque las rutas salen de
  `n_district / route_size` y no de la medida elegible. Cuando se acaban las manzanas, lo cubre el §3.
- **PPS.** La medida de tamaño es la de la manzana elegible. Por zona, `sample.marco_elegible` guarda:
  - el total de la medida elegible;
  - el número de manzanas sorteadas;
  - la medida de cada manzana seleccionada.

  Con eso se reconstruye **π ≈ n_z·M_i/ΣM_z**. Es una aproximación declarada, porque el sorteo es secuencial sin
  reemplazo.
- **Calibración.** Una calibración posterior a totales INEI completos supone que, dentro de cada celda
  edad × sexo, lo excluido se parece a lo cubierto. Así se declara.
- **Reproducibilidad.** Con la misma config y la misma versión del marco, R resuelve las mismas manzanas y sortea lo
  mismo. El resumen guarda:
  - el hash del archivo del marco;
  - el hash de `marco_elegible` canonizado;
  - una suma de verificación de los ids **elegibles** por distrito, que detecta manzanas agregadas, cosa que la
    suma de los excluidos no haría.
- **Reemplazos puntuales.** Los reemplazos puntuales posteriores al sorteo (`hojas_ruta_generar_reemplazos_manual_pdf`,
  ~4945) usan el `marco_elegible` guardado en la muestra, no la config actual. Si la config actual es distinta, se
  avisa y no se mezclan.
- **Fases.**
  - En Campo real, el marco elegible se aplica antes de las exclusiones del piloto.
  - Una titular del piloto que cae fuera del marco elegible se cuenta como exclusión por elegibilidad, no por
    piloto, para que el aviso del piloto no la sume dos veces.
  - Si el piloto y el campo usaron marcos elegibles distintos, sus probabilidades no son comparables, y las bases no
    se juntan sin declararlo.
  - Las áreas se copian a Campo real con `from-pilot`, igual que el resto de la config.

## Consecuencias

- El sorteo deja de mandar equipos a manzanas sin hogares registrados. Las exclusiones por criterio de campo quedan
  documentadas con motivo, fuente y fecha para el siguiente estudio.
- Ninguna entrevista se pierde en silencio: lo que no se asigna aparece en `E_UNASSIGNED_INTERVIEWS`.
- El riesgo de sesgo más serio, la exclusión por inseguridad o inaccesibilidad, que deja fuera a los hogares más
  vulnerables, queda visible: con cifra, con NSE y con una decisión registrada sobre el umbral.
- Sube la línea base de `hojas_ruta_engine.R` por dos enganches, de forma deliberada y documentada aquí.
- **Una corrida sin `marco_elegible` es legacy.** Se normaliza con `minimo_viviendas = 0` y `declarado = false`, y su
  marco no cambia. Las corridas nuevas y las copias `from-pilot` escriben el objeto de forma explícita, con
  `minimo_viviendas = 1`. La interfaz ofrece adoptar el criterio con su cifra, y
  `W_FRAME_CHANGED_BY_ELIGIBILITY` avisa solo cuando se adopta.

## Cumplimiento

`api/tests/testthat/test-hojas-ruta-marco-elegible.R`, con un fixture que incluye manzanas `sin_conteo_redatam` y
manzanas con `poblacion = 0, viviendas > 0`:

- **Conservación.** Elegibles más excluidas por cada criterio es igual al marco del territorio, por distrito y por
  zona, en manzanas, viviendas y población, **sin tolerancia**.
- **Precedencia.** Una manzana dentro de un polígono y con 0 viviendas se cuenta una sola vez.
- **Ninguna titular ni reemplazo**, incluidos los puntuales, cae fuera del marco elegible guardado en la muestra.
- **Casos límite:**

  | Caso | Resultado esperado |
  |---|---|
  | Distrito o zona sin manzanas elegibles | n en `E_UNASSIGNED_INTERVIEWS` |
  | `row_var = "zona"` con una zona vacía | n en `E_UNASSIGNED_INTERVIEWS` |
  | Polígono fuera del territorio | aviso |
  | Manzana sin geometría | queda en el marco, contada como `sin_geometria` |
  | Punto sobre el borde | excluida |
  | `minimo_viviendas = 0` | idéntico al comportamiento previo |
  | Lista de áreas vacía | idéntico al comportamiento previo |
  | Población del distrito en 0 | cobertura NA |
- **Paridad.** El preview y el sorteo dan el mismo reparto por zona.
- **Legacy.** Una corrida sin la clave reproduce byte a byte la muestra previa con la misma semilla.
- **Guard de la lista cerrada.** El normalizador del motor conserva `marco_elegible`.
- **Contratos transversales.** `make gate-area AREA=hojas GATE_ARGS='--patron "marco-elegible|hojas-ruta"'`.
- **Revisión de la implementación.** La hace `revisor-metodologico`, con los invariantes de `dominio-prosecnur` y
  `nucleo-metodologico` en el contrato.

## Supuestos declarados

- `viviendas` cuenta viviendas particulares, incluidas las desocupadas. No está verificado en el script de
  construcción del marco.
- ~~La ruta continúa en manzanas contiguas cuando la manzana no alcanza.~~ *Corregido por el
  [ADR 0116](0116-hojas-de-ruta-no-respuesta-e-icc.md):* el motor no continúa a la manzana contigua; al agotarse la
  manzana se pasa al reemplazo pareado de la titular, y la capacidad de una manzana se mide en visitas (`v_cap`).
- El piloto y el campo no se juntan en el análisis.

## Hallazgos fuera del alcance

- El resto entero de `as.integer(n_district / route_size)` se pierde (~5470-5475). Es anterior a este ADR.
- El reemplazo `prob <= 0 → 1` con `measure_var = "poblacion"` en el marco `inei2017_official` (35.255 manzanas con
  viviendas y población no cruzada) merece su propia revisión.
