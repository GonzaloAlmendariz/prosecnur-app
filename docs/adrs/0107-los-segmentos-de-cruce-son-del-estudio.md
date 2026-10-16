# ADR 0107 — Los segmentos de cruce son del estudio y tienen nombre estándar en todas las bases

- **Estado**: Propuesto — conversación con Gonzalo del 2026-10-15 («¿no se pueden llamar de una forma estandarizada como
  PX_cruce?»; «a Ulises no hay que prepararle un Word ni nada sino dejarle la app súper fina, entendible y didáctica y
  sobre todo consistente»).
- **Ámbito**: Carga › Equivalencias (series de mediciones), Analítica (cruces y comparativos)
- **Fecha**: 2026-10-15
- **Relación**: usa las variables calculadas del [ADR 0106](0106-la-base-declara-sus-variables-propias.md) y la fila
  armonizada de la matriz ([ADR 0104](0104-la-matriz-se-arma-en-la-app.md), contrato E4-E7). Checklist:
  `docs/qa/checklist-matriz-equivalencias-oigd-2026-10-15.md` (sección I).

## Contexto

Medido en HSyVbG: cada año guardó los mismos cruces con otro nombre y otra escala. 2024 los trae como `cruce_1` a
`cruce_9`; 2025 como `P1_recod`, `P4_recod2`, `P5_recod`, `P8_recod` (con el orden invertido), `P10_recod2` (0/1); 2026
no los tiene (sus `_recod` son la pregunta con los «Otro» codificados, no el segmento). El analista no tiene cómo saber
qué segmento le falta a qué año, y cada comparativo exige elegir a mano la variable de cruce de cada base.

## Decisión

1. **El estudio declara sus segmentos de cruce una vez**: clave, nombre estándar `cruce_<clave>`, etiqueta y escala
   estándar (p. ej. `cruce_edad` «Edad»: 1 «18 a 20 años», 2 «21 años a más»).
2. **Cada base dice de dónde sale cada segmento**: una variable de origen de esa base y el mapa de sus códigos a la
   escala estándar (varios a uno). Para un año de ingreso, el mapa se arma relativo al año de la medición (ayuda «tramos
   de antigüedad»).
3. **La app materializa el segmento en cada base** como variable calculada `cruce_<clave>` (regla `recodificar` del ADR
   0106) y mantiene su fila en la matriz armonizada (identidad sobre la escala estándar) marcada como cruce. El analista
   no arma esa fila a mano.
4. **Estado visible**: una tabla segmento × base dice qué está definido, qué falta y qué base no tiene variable de origen.
5. **Uso**: los comparativos de cruces proponen por defecto los segmentos del estudio como variables de cruce, y las
   tablas de una sola base los ofrecen con su nombre estándar.

## Contrato (API)

- `GET /api/carga/segmentos` → `{ ok, bases, segmentos: [{ clave, nombre, etiqueta, nota, escala: [{codigo, etiqueta}],
  por_base: { <base>: { origen, mapa, estado: "definido"|"sin_origen"|"incompleto", n_sin_mapa } }, fila_ref }] }`
- `POST /api/carga/segmentos` `{ clave, etiqueta, nota?, escala, por_base: { <base>: { origen, mapa } } }` (crea o reemplaza
  por `clave`; `nombre` = `cruce_<clave>` normalizado) → mismo payload que el GET.
- `DELETE /api/carga/segmentos?clave=` → quita el segmento, sus variables calculadas y su fila de la matriz.
- Errores `E_SEGMENTO_*` registrados (clave inválida o duplicada, escala vacía, base u origen inexistente, mapa a un
  código fuera de la escala, nombre que choca con una columna existente de alguna base).

## Consecuencias

- Las tres mediciones quedan con los mismos nombres de cruce; la base entregada los lleva.
- Los comparativos de cruces dejan de exigir elegir el cruce de cada base.
- Un segmento depende de las variables de origen: si una base cambia, su estado lo dice.

## Cumplimiento

- testthat: declarar, materializar en cada base, fila de matriz marcada, estados, borrado, ida y vuelta por `.pulso`,
  errores. Vitest del modelo y del panel; `make gate-area` del área equivalencias/carga y `make gate-front AREA=carga`.

## Notas

- **Defaults del comparativo (2026-10-15).** Sin `filas`, el comparativo armonizado —simple y de cruces— deja fuera
  de las preguntas las filas marcadas `cruce: true`, igual que la UI; una fila de segmento entra como pregunta sólo si
  se pide explícita. Sin `cruces`, el comparativo de cruces usa por defecto los segmentos marcados como cruce que son
  comparables (entrada `comparable` con variable y escala) en **al menos dos bases de la serie**: un segmento que sólo
  existe en una medición no compara nada y saldría «n.c.» en las demás. Pedido explícito, sí entra.
  (`.armz_preparar` en `analitica_armonizada.R`, `segmentos_cruces_por_defecto` en `segmentos_cruce.R`.)
- **Un código con 0 casos no se exige en el mapa.** El estado `definido`/`incompleto` de una base se mide contra los
  códigos observados en su data, no contra la lista del instrumento: una opción que nadie marcó (o una edad que no
  aparece) puede quedar fuera del mapa sin dejar el segmento incompleto.
- **Privacidad de los valores numéricos.** `GET /api/carga/codigos-observados` no lista valores de una columna
  numérica —declarada `integer`/`decimal`/`range`, sin declarar, o `text` con sólo números— cuyos valores parecen
  identificadores: si algún valor no vacío, como entero, tiene 7 o más dígitos (teléfono, DNI, código), o si los
  valores distintos superan 0,5 × `n_validos`. Responde `tipo: "identificador"` con `codigos: []` y conserva
  `n_validos` y `n_sin_dato`. La edad, el año de ingreso o un conteo (pocos dígitos y repetidos) siguen `numerica`
  con sus códigos. La regla vale también para todo editor que liste valores de una variable (segmentos, mapas de
  códigos): un identificador no se muestra como opción a mapear.
- **Nota al pie del segmento (2026-10-16).** Un segmento puede declarar `nota`: texto que va al pie de toda tabla
  cruzada por él (el comparativo de cruces la antepone a las notas generales; un segmento que no se usa como cruce no
  la agrega). Sirve cuando el rótulo abrevia la pregunta: en HSyVbG, "Presenta discapacidad" cita la pregunta del
  carné del CONADIS (acuerdo con la OIGD del 9 y 13 de octubre). (`segmentos_notas_de_cruces`.)
- **Origen calculado (2026-10-16).** El origen de un segmento puede ser una variable calculada de la base (ADR 0106),
  p. ej. una fórmula «2026 - P8» agrupada en rangos; no puede serlo otro segmento.
