# Cuotas en Monitoreo: metas frente a referenciales y vistas de avance (3 nov 2026)

Tipo: Checklist vivo (gate 5 de `CLAUDE.md`)
Estado: D1–D3 tomadas por coordinación (Meta B, 3/11, revisables por Gonzalo); contrato en ADR 0126. Telefónico hecho
Autoridad: dictado de Gonzalo, 3 nov 2026; coordinación con Meta B (plan conjunto)

> Gonzalo, textual: «El avance de cuotas en todos los monitoreos aún le falta bastante pulido, mezcla conceptos y no
> deja claro o permite que el modelo distinga claramente cuotas establecidas como metas de cuotas referenciales, y las
> vistas de seguimiento de avance de cuotas mezclan vistas y aún le falta mucho pulido; esto aplica a todos los tipos
> de monitoreo».

Límite de módulos (Meta B): que una cuota sea meta o referencial se declara **donde nace la cuota**. Monitoreo lo lee y
lo muestra; no lo decide donde no es el dueño. Toda escritura fuera de Monitoreo se propone a coordinación antes.

## Diagnóstico (3 nov)

Ningún perfil puede declarar hoy, cuota por cuota, si es **meta** (se exige: tiene faltante, cumple o no) o
**referencial** (se describe: composición frente al universo, sin faltante ni alarma). Hay cuatro piezas sueltas que
se le parecen:

- **Aulas** lo resuelve por estructura (ADR 0086 §7, ADR 0121): el eje y las celdas de `representatividad` son la
  meta; `quotas$category_profiles` es la composición referencial (`monitoreo_aulas_composicion_referencial.R`).
- **Acreditación** guarda «sólo seguimiento» en `operational_model$interest_variables`, aparte de las cuotas con meta
  (`s$monitoreo_cuotas`).
- **Telefónico y acreditación** tienen `goals[].objetivo ∈ {barrido, minimo}`, que dice si el actor se barre entero; no
  es la marca meta/referencial. Además `objetivo` también se lee como respaldo numérico de la meta
  (`monitoreo_engine.R:3826`), un choque de nombre. No encontramos ningún editor que lo escriba.
- **Cálculo de muestra** publica `meta.tipo ∈ {objetivo, cuota, cobertura, contractual}` (`calc_muestra_engine.R:1192`).
  Monitoreo lo copia (`monitoreo_engine.R:1722`) y nadie lo lee.

Los cinco motores de avance (acreditación, telefónico, territorial UMP, territorial por cuotas y aulas) no comparten
ninguna función.

### Dónde nace cada cuota y quién escribiría la marca

| Perfil | Dónde nace la cuota | Dónde se guarda | Quién escribe «meta / referencial» |
|---|---|---|---|
| Acreditación | Monitoreo › Modelo › Cuotas (ADR 0125) | `s$monitoreo_cuotas.cuotas[]` (`router_monitoreo_cuotas.R`); «sólo seguimiento» en `interest_variables` | Monitoreo |
| Telefónico | Monitoreo › Modelo › Cuotas y calendario (ADR 0125, línea 116) | `config$goals[]` (lista blanca `monitoreo_engine.R:3813-3845`) | Monitoreo |
| Territorial UMP | Hojas de ruta | `route_quota_progress` / plantilla de cuota | Hojas de ruta (**propuesta a coordinación**) |
| Territorial por cuotas | Hojas de ruta (envío `kind="cuotas"`) | `runs[[fase]]$envio.zonas[].cuotas` | Hojas de ruta (**propuesta a coordinación**) |
| Aulas | Cálculo de muestra + representatividad (ADR 0121) | `design_targets`, `representatividad.variables[]`, `quotas$category_profiles` | Ya existe por estructura; falta publicarlo con el mismo nombre que los demás |

## Checklist

Estados: ☐ pendiente · ◐ en curso · ☑ hecho · ⛔ bloqueado (espera una decisión).

| # | Indicación de Gonzalo | Perfil | Qué se ve hoy (evidencia) | Dónde vive | Estado |
|---|---|---|---|---|---|
| 1a | «mezcla conceptos» | Acreditación | Avance › Por cuota (`PorCuota.tsx:145-150`) pone en una lista las cuotas con meta (efectivas del rollup) y las variables sin meta con su Δ pp (de `client_report.controls`): dos motores y dos denominadores (meta frente a universo) | `profiles/acreditacion/avance/PorCuota.tsx`, `monitoreo_acreditacion_cuotas.R:73-80`, `monitoreo_engine.R:17084` | ☑ acreditación (ADR 0126): Avance › Por cuota en dos bloques, «Metas» y «Referenciales, sin meta»; una cuota declarada referencial se lee como composición frente al universo (cifras del motor de cuotas, sin «Sin dato»), igual que las variables de control. Los dos motores siguen siendo dos (cuotas y `client_report.controls`), cada uno en su bloque |
| 1b | «mezcla conceptos» | Telefónico | Modelo pinta «Avance de cada meta» con efectivas junto a «meta frente al reparto proporcional» (`modelo/Cuotas.tsx:138,172,216-228`); el total por cuota usa plataforma si hay respuestas y si no «Completa» de la hoja, pero la serie diaria siempre usa plataforma (`monitoreo_telefonico.R:463-465,905,923`); sin `goals` la meta sale de una columna de la base (`:411,505`); `metaDelProyecto.ts:12-15` suma también las metas por actor (posible doble conteo, sin verificar con datos) | `profiles/telefonico/modelo/Cuotas.tsx`, `monitoreo_telefonico.R`, `metaDelProyecto.ts` | ☑ telefónico (ADR 0126): Modelo ya no pinta avance; Avance › Cuotas separa «Metas» (con su total sin compensar entre celdas) de «Referenciales» (composición frente al listado, en puntos y con su n); `metaDelProyecto` suma una sola partición. **Sigue abierto**: el numerador distinto entre total y serie diaria (`monitoreo_telefonico.R:905,923`) y que Ritmo y Cuotas pueden elegir variables distintas |
| 1c | «mezcla conceptos» | Territorial | Celdas cruzadas frente a marginales sin resolver (pregunta 6 de `revamp-monitoreo/territorial.md`); la regla «sexo/edad flexible» se deduce de los déficits, no se declara (`monitoreo_engine.R:11502,11512`); cuota por UMP con respaldo fijo de 8 y 9 nombres de campo (`:23925-23952`) | `monitoreo_engine.R` (congelado), `territorial/avance/FaltantePorUmp.tsx` | ⛔ D1, D2 |
| 1d | «mezcla conceptos» | Cursos-horario (aulas) | «Muestra», «meta», «meta operativa», sobremuestra, techo y comprometido conviven; el Resumen mide contra la meta operativa aunque el ADR 0079 dice que el cumplimiento va contra la cuota (`resumenAulasModelo.ts:16-17,231-241`); la sobremuestra es «referencia» en `AulasSerieDeRendimiento.tsx:207-209,1444` y «una de las dos metas» en `:1316-1319` y `AulasAvanceParaCliente.tsx:314-319` | `profiles/aulas/avance/*`, `corte/corteContract.ts:46-59` | ⛔ D1 |
| 2a | «no permite que el modelo distinga cuotas establecidas como metas de cuotas referenciales» | Acreditación | Sin marca por cuota; «sólo seguimiento» vive en otro sitio (`interest_variables`) | `router_monitoreo_cuotas.R:62` (normalizador), `useConfiguracionDeCuotas.tsx:152-188` | ☑ `cuotas[].caracter` (entrada en `.mcu_cuotas_entrada`, omitido si no se declara); en el editor de cuota, «Meta / Referencial» con la columna «Del universo» para la referencial; Modelo muestra la referencia y su peso en el universo. Guardar otra cuota conserva los números de una referencial |
| 2b | ídem | Telefónico | Sin marca por cuota en `goals[]`; `objetivo` (barrido/mínimo) es otra cosa y choca de nombre | `monitoreo_engine.R:3813-3845`, `modelo/Cuotas.tsx` | ☑ `goals[].caracter` (lista blanca en `monitoreo_cuotas_caracter.R`, una línea en el congelado), control Meta / Referencial por categoría en Modelo; una referencial declarada publica su número en `Referencia` y deja de sumar a las brechas |
| 2c | ídem | Territorial | Sin marca; Modelo › Cuotas es de sólo lectura y `FaltantePorUmp.tsx:66` dice «se declara en Modelo › Cuotas» | Hojas de ruta (dueño); Monitoreo sólo lee | ⛔ D1, D2 (escritura fuera de Monitoreo) |
| 2d | ídem | Cursos-horario | Existe por estructura (eje = meta; `category_profiles` = referencial, ADR 0086 §7); el sexo es meta en HSVG y referencial en CCSS según el eje | `monitoreo_aulas_representatividad_declarada.R:20-35`, `monitoreo_aulas_composicion_referencial.R` | ☐ publicarlo con el nombre común de D1 |
| 3a | «las vistas de seguimiento de avance de cuotas mezclan vistas» | Acreditación | `AvanceCuotasEditorMetas` (editar desde Avance) sigue montado en una rama probablemente inalcanzable (`AcreditacionMonitoreoPage.tsx:14586`), mientras `PorCuota` dice «aquí no se crea ni se edita» | `profiles/acreditacion/avance/AvanceCuotasPanel.tsx:226` | ☐ verificar alcance y retirar (doble confirmación de borrado) |
| 3b | ídem | Telefónico | Avance dentro de Modelo (1b); Avance › Cuotas vive en la clave interna `actores` y reusa `buildAcreditacionPhoneQuotaEditorRows` | `TelefonicoMonitoreoPage.tsx:2533,17178` (congelado) | ☑ «Avance de cada meta» sale de Modelo |
| 3c | ídem | Territorial | `modelo/cuotas` y `avance/faltante` llevan a la misma vista interna `calidad/cuotas` (`navegacion/direccionTerritorial.ts:96,125`); una pestaña sirve a dos unidades (UMP o zona, `FaltantePorUmp.tsx:51-54`) | `navegacion/direccionTerritorial.ts`, `territorial/avance/FaltantePorUmp.tsx` | ◐ **Premisa corregida (3/11)**: no es la misma vista. `modelo/cuotas` monta `CuotasTab` y `avance/faltante` monta `FaltantePorUmp`, cada uno `propia: true`; lo único que comparten es el corte de datos que piden (`calidad/cuotas`). Queda lo real: una sola pestaña de Avance sirve a dos unidades (UMP o zona) y el texto «se declara en Modelo › Cuotas» apunta a una vista de sólo lectura. Va con el paso territorial |
| 3d | ídem | Cursos-horario | `modelo/metas` y `avance/porfacultad` llevan a la misma vista (`avance/cuotas`); lo mismo `modelo/metas&panel=efectividad` y `avance/rendimiento&panel=efectividad` (`navegacion/direccionAulas.ts:97-98,142,161`); Por facultad cambia de bloque según el eje (`porFacultadModelo.ts:20-25,221`) | `navegacion/direccionAulas.ts`, `aulas/avance/porFacultadModelo.ts` | ◐ **Premisa corregida (3/11)**: `modelo/metas` (`MetasAulas`) y `avance/porfacultad` (`PorFacultadAulas`) son componentes propios que comparten el corte `avance/cuotas`, no la vista. Lo que sí se repite es la sub-vista heredada «Efectividad», que cuelga de Modelo › Metas («Tasa del diseño») y de Avance › Rendimiento: ésa es la dirección doble a separar en el paso de aulas |
| 4 | «aplica a todos los tipos de monitoreo» | Los cuatro | Cinco motores de avance sin función compartida; el vocabulario y el estado (cumple / falta / referencial) se escriben distinto en cada perfil | `monitoreo_acreditacion_cuotas.R`, `monitoreo_telefonico.R:455`, `monitoreo_engine.R:10049`, `monitoreo_territorial_cuotas.R:85`, `monitoreo_aulas_avance_cuota.R:241` | ⛔ D1 (contrato común antes de tocar motores) |

## Decisiones que esperan a Gonzalo

| # | Pregunta | Propuesta (reversible) | Qué cambia con cada respuesta |
|---|---|---|---|
| D1 | ¿Qué distingue una meta de una referencial? | Generalizar el ADR 0086 §7 a los cuatro perfiles. **Meta**: tiene número que se exige; Avance muestra faltante, ritmo y cumple / no cumple, con tono. **Referencial**: no tiene faltante; Avance muestra composición obtenida frente al universo, sin umbral ni alarma. Un campo por cuota `caracter: "meta" \| "referencial"`; sin declarar, se queda como hoy (meta si tiene número) | Sí → contrato común (un ADR) y cada perfil lo publica igual. Otro criterio (p. ej. referencial con tolerancia) → se añade al contrato |
| D2 | ¿Dónde se declara? | Donde nace la cuota: telefónico y acreditación en Monitoreo › Modelo; territorial en Hojas de ruta (propuesta a coordinación); aulas ya lo trae de Cálculo y representatividad | Si territorial debe declararse en Monitoreo, cambia el dueño del dato (ADR 0125) |
| D3 | ¿Qué vista contesta qué? | **Modelo** declara (qué cuotas, cuáles son meta, cuáles referenciales); nunca muestra avance. **Avance › Cuotas** es una sola vista por perfil con dos bloques fijos: «Metas» (faltante) y «Referenciales» (composición). Las pestañas que hoy llevan a la misma vista interna se separan o se retira una | Sí → se quita el avance de Modelo telefónico y se separan las direcciones dobles de territorial y aulas |

## Orden propuesto (al tener D1–D3)

1. ADR del contrato común (D1–D3), revisado por `guardian-contratos` y `revisor-metodologico`.
2. Campo `caracter` en las listas blancas de Monitoreo (telefónico `goals[]`, acreditación `monitoreo_cuotas`), con test
   de ida y vuelta del `.pulso`. Territorial: propuesta a coordinación para Hojas de ruta.
3. Un bloque de avance común en el front (Metas / Referenciales) que cada perfil alimenta con su motor; perfil por
   perfil, un commit y una captura cada uno.
4. Modelo deja de pintar avance (telefónico) y se separan las direcciones dobles (territorial, aulas).
5. Lo que cambia qué cifra se presenta como avance contra meta (1b, 1d) pasa por `revisor-metodologico`.

## Decisiones tomadas (coordinación, 3/11)

D1, D2 y D3 se toman como propuestas, revisables por Gonzalo (Meta B). Contrato en
`docs/adrs/0126-cada-cuota-declara-si-es-meta-o-referencial.md`, revisado por `guardian-contratos` y
`revisor-metodologico`.

## Lo que queda (aulas y territorial)

| Paso | Qué | Dónde vive | Qué lo destraba |
|---|---|---|---|
| Aulas | Publicar `caracter`, `fuente` y `estado_cuota` con niveles `muestra` y `sobremuestra` sobre `avance_cuota` (aditivo), y que la vista los lea en vez de deducirlos; separar «Efectividad» de Modelo › Metas; el % del universo en las referenciales (composición) | `monitoreo_aulas_avance_cuota.R`, `monitoreo_aulas_composicion_referencial.R`, `profiles/aulas/avance/*`, `navegacion/direccionAulas.ts` | Nada técnico. El Resumen que mide contra la meta operativa (1d) cambia una cifra visible: pasa por `revisor-metodologico` y se le muestra a Gonzalo antes |
| Territorial | Marca por dimensión (territorio, sexo, edad) en la configuración de Hojas de ruta y en el envío, dentro de la huella y omitida si no se declara; Avance › Faltante en dos bloques | `hojas_ruta_envio_cuotas.R`, `hojas_ruta_envio.R`, `hojas_ruta_integrada_normalize_config` (congelado: un punto de llamada), UI de Hojas; `profiles/territorial/avance/*` | Autorizado por coordinación (Meta B, 3/11), con revisión de `guardian-contratos` |

## Pedidos de Gonzalo durante la ronda

| Pedido | Dónde vive | Estado |
|---|---|---|
| «Cuando es referencial debe estar el porcentaje del universo para poder referenciarlo» (3/11) | Telefónico: Modelo › Cuotas muestra «N % del universo» en la fila referencial; Avance › Referenciales, «Del listado». Acreditación: editor de cuota y Modelo con «Del universo»; Avance con la composición | ☑ telefónico y acreditación; ☐ aulas y territorial (van con sus pasos) |

## Observado al capturar (no tocado)

- Acreditación, copia `d1_acr` con cuotas sembradas: las cuotas leen 0 efectivas, también la de meta (0.0 %). Sale del
  cruce de la copia (llaves `codigo:` del `case_rollup`), no del ADR 0126; hay que mirarlo con un proyecto de acreditación
  con cuotas reales.
- Acreditación › Modelo › Cuotas: el botón «Usar este color» del popover de color del público desborda 4 px (detector
  `overflow-x`). Ya estaba; no lo toca esta ronda.

## Aprendido

- Una sola palabra, «objetivo», nombra dos cosas en `goals[]`: el enum barrido / mínimo y el respaldo numérico de la
  meta (`monitoreo_engine.R:3826`, `monitoreo_telefonico.R:547`). El campo nuevo no debe reusar ninguno de los dos
  nombres.
