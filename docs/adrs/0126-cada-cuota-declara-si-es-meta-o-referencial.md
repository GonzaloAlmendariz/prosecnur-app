# ADR 0126: Cada cuota declara si es meta o referencial

Estado: Propuesto (coordinación, 3/11). Lo tomó Meta B como decisión reversible, siguiendo la regla de Gonzalo de que
nadie espere sus decisiones en lo reversible. Gonzalo puede revisarlo. Revisado por `guardian-contratos` y
`revisor-metodologico` (los dos: aprobado con cambios, incorporados en este texto).

Implementación: no iniciada. Un perfil por commit (ver «Cumplimiento»).

Fecha: 2026-11-03

Relación: generaliza a los cuatro perfiles de Monitoreo el §7 del
[ADR 0086](0086-el-eje-de-cuotas-lo-declara-el-estudio.md) («sexo y carrera son referenciales, y se describen sin
exigirles nada»). Respeta el [ADR 0079](0079-el-cumplimiento-se-mide-contra-la-cuota-del-diseno.md) (el cumplimiento
se mide contra la cuota del diseño y no se compensa entre celdas), el
[ADR 0121](0121-la-representatividad-la-declara-el-estudio-universo-y-variables.md) corregido por el
[ADR 0123](0123-el-planner-solo-define-el-tipo-y-el-camino-del-estudio.md) Q1 (aulas: la foto es
`design_targets.representatividad`, con su sello) y el reparto de dueños del
[ADR 0125](0125-material-arma-monitoreo-sigue.md). Diagnóstico y estado vivo:
`docs/qa/checklist-cuotas-monitoreo-2026-11-03.md`.

## Contexto

Gonzalo, 3 nov: «El avance de cuotas en todos los monitoreos aún le falta bastante pulido, mezcla conceptos y no deja
claro o permite que el modelo distinga claramente cuotas establecidas como metas de cuotas referenciales, y las vistas
de seguimiento de avance de cuotas mezclan vistas […]; esto aplica a todos los tipos de monitoreo».

El diagnóstico lo confirma. Ningún perfil puede declarar, cuota por cuota, si se exige o sólo se describe:

- Aulas lo resuelve por estructura: el eje es la meta y `category_profiles` lo referencial.
- Acreditación guarda las variables «sólo de seguimiento» en otro sitio (`operational_model$interest_variables`).
- Telefónico no tiene marca, y su campo `goals[].objetivo` nombra dos cosas: el enum barrido / mínimo y el respaldo
  numérico de la meta (`monitoreo_engine.R:3826`).
- Territorial no tiene marca.

Hay cinco motores de avance y ninguno comparte vocabulario de estado. Tres perfiles mezclan vistas: avance dentro de
Modelo (telefónico), o dos pestañas que llevan a la misma vista interna (territorial y aulas).

## Decisión

### 1. Cada cuota lleva `caracter`, con dos valores

- **`meta`**: un número que el estudio se compromete a alcanzar. Se exige: tiene faltante y veredicto. Una meta puede
  tener **niveles con nombre**, cada uno con su propio veredicto. Es el caso de aulas: muestra (2.500) y sobremuestra
  (3.750) son las dos metas del estudio (Gonzalo, 8/9), y ninguna se llama «referencial».
- **`referencial`**: describe la composición esperada y no se exige: no tiene faltante ni veredicto. Si trae un
  número, es una referencia que se muestra al lado de lo obtenido, nunca un piso.

Por qué este nombre: no reusa `objetivo`, que ya tiene dos sentidos, ni `tipo`, que lo usa `meta.tipo` de Cálculo de
muestra con otro vocabulario.

**No son cuotas, y quedan fuera de esta taxonomía**: la meta operativa, el techo y la meta por aula de aulas (ADR 0079),
y las celdas cruzadas «flexibles» que el motor territorial deriva al repartir déficits marginales
(`monitoreo_engine.R:11495-11516`), que son una guía de ruteo.

**La unidad de meta es la categoría declarada**, sea un marginal o una celda. No hay compensación dentro de un marginal
ni entre celdas declaradas.

### 2. Sin declaración, ninguna cifra cambia

Una cuota sin `caracter` conserva exactamente el veredicto que tiene hoy:

- Es **`meta`** todo lo que hoy recibe veredicto de cumple o brecha, aunque su número no lo haya declarado nadie:
  - la meta 0 de telefónico, que hoy sale «Cumple» (`monitoreo_telefonico.R:520,585`);
  - `objetivo = "barrido"` sin número, que se mide contra el universo (`telefonicoGoalModel.ts:101,115`);
  - la meta tomada de una columna de la base (`monitoreo_telefonico.R:400-419`);
  - el respaldo de 8 por UMP (`monitoreo_engine.R:23925-23952`).
- Es **`referencial`** lo que hoy no tiene veredicto: «Sin meta» de telefónico y «sólo seguimiento» de acreditación.

**Cada número publica su `fuente`**: `declarada`, `columna` o `respaldo`. La vista dice cuándo un veredicto se apoya en
un número que nadie declaró. Quitarle el veredicto a un respaldo cambia una cifra visible, así que no lo decide este
ADR: queda como ítem aparte con `revisor-metodologico`.

**Una cuota declarada `meta` sin ningún número** se publica `referencial`, con un aviso que lo dice. No se juzga
contra cero.

### 3. Se declara donde nace la cuota; Monitoreo lo lee y lo muestra

| Perfil | Quién lo escribe | Grano | Dónde se guarda y dónde se perdería |
|---|---|---|---|
| Telefónico | Monitoreo › Modelo (ADR 0125) | por goal | `config$goals[].caracter`. La lista blanca está en `monitoreo_engine.R:3813-3845` (congelado). El bloque `objetivo` se sustituye por una llamada a una función en archivo nuevo, sin crecimiento neto. Hoy esa lista descarta todo goal sin número (`:3826-3827`), así que, para guardar un referencial sin número, la función también lo conserva. Tipo `MonitoreoGoal` en `frontend/src/api/monitoreo.ts` |
| Acreditación | Monitoreo › Modelo | por cuota. Una categoría con 0 dentro de una meta sigue como `sin_meta` en esa meta | `s$monitoreo_cuotas.cuotas[].caracter`; se filtra al escribir en `.mcu_cuotas_entrada` (`router_monitoreo_cuotas.R:84-85`). `interest_variables` se lee como `referencial` |
| Territorial (UMP y por cuotas) | Hojas de ruta, donde nace la cuota territorial | por dimensión (territorio, sexo, edad), porque Hojas no edita por celda | La configuración de Hojas (`hojas_ruta_integrada_normalize_config`, congelado: un punto de llamada, sin crecimiento neto), `.hojas_ruta_zonas_de_cuotas` (`hojas_ruta_envio_cuotas.R`) y `.hojas_ruta_envio_normalize` (`hojas_ruta_envio.R`). Monitoreo lee la **foto del envío**: la marca llega cuando se reenvía |
| Aulas | Cálculo de muestra y representatividad, por estructura (foto `design_targets.representatividad`) | por nivel de meta y por variable | El eje y la representatividad son `meta`, con niveles `muestra` y `sobremuestra`; `category_profiles` es `referencial` |

**La marca territorial entra en la huella del envío** (`sample_fingerprint`), porque cambia lo que el campo debe
cumplir. Cuando no se declara se **omite** (no se escribe NULL), así que la huella de los envíos existentes no cambia
y nadie, tampoco Material, ve un envío «desactualizado» sólo por esta decisión.

**Toda clave nueva entra a la lista blanca de su normalizador en el mismo commit**, con un test de ida y vuelta.

**Los archivos congelados no crecen**: lo nuevo va en un archivo propio y el congelado sólo cambia una llamada por
otra, sin crecimiento neto.

### 4. Las cinco lecturas de avance publican la misma forma, de manera aditiva

Por cuota (o nivel) se añaden `caracter`, `fuente` y `estado_cuota`. Las claves que ya existen se quedan como están:
`estado` de acreditación y de aulas, `Estado cuota` de telefónico y `cumplimiento.estado`. Las leen el motor, el PDF,
el front y el conteo de brechas.

`estado_cuota` toma uno de estos valores:

| Valor | Cuándo | Equivale hoy a |
|---|---|---|
| `cumple` | meta y efectivas que cuentan ≥ meta | «Cumple», `cumplida`, `ok` |
| `falta` | meta y efectivas < meta | «Brecha», `en_curso`, `sin_avance` |
| `sin_base` | meta sin universo ni marco donde buscarla | «Sin base» de telefónico; `sin_aulas_en_plan` del ADR 0079 §6 |
| `referencial` | referencial con comparador | «Sin meta», «sólo seguimiento», `sin_cuota` |
| `sin_comparador` | referencial sin universo ni referencia declarada | — |

Además, para cada cuota:

- Las efectivas sin categoría conocida se publican aparte, como residual `sin_dato`. Celdas más `sin_dato` suman el
  total. «Sin dato» de acreditación deja de ir dentro de la composición.
- Una referencial publica la proporción obtenida frente al comparador, en puntos y siempre con su `n`. La calcula sobre
  efectivas y universo con categoría conocida. No lleva umbral ni tono de alarma.
- Una referencial con universo pero sin ninguna efectiva lleva la marca `celda_vacia`. Es un hecho, no una alarma: una
  celda vacía impide posestratificar o hacer raking.
- `fuera_del_diseno` de aulas no es un estado de cuota: es residual.

**Los comparadores son distintos según el perfil, y la vista los nombra**:

| Perfil | Comparador |
|---|---|
| Telefónico | la hoja de barrido (el marco, no la población) |
| Acreditación | el universo de actores; con universos pequeños, además la cobertura por categoría (efectivas / universo) |
| Territorial por cuotas | la parte de la celda dentro del `n` de la zona, que sale del reparto de Hojas de ruta, no de un universo observado |
| Aulas | la composición del marco (ADR 0086 §7) |

**Las efectivas que cuentan son las del avance oficial de cada perfil.** Este ADR no cambia ningún numerador. La merma
entre lo válido en campo y lo efectivo final no se descuenta (nota del ADR 0079).

### 5. Cada vista contesta una pregunta

- **Modelo declara**: qué cuotas hay, cuál es meta y cuál referencial, y su número. Nunca muestra avance.
- **Avance › Cuotas sigue el avance**: una sola vista por perfil con dos bloques fijos, siempre en el mismo orden.
  - «Metas»: faltante y veredicto, por nivel cuando hay niveles.
  - «Referenciales»: composición frente al comparador, sin tono de alarma.

  Un bloque sin cuotas dice por qué (C3), no desaparece. En el libro de cliente de aulas la palabra «referencial» sigue
  fuera; allí no se muestran referenciales.
- **Una dirección lleva a una sola vista.** Las pestañas que hoy llevan a la misma vista interna se separan:
  - territorial: `modelo/cuotas` y `avance/faltante`;
  - aulas: `modelo/metas` y `avance/porfacultad`.

### 6. La meta del proyecto suma una sola partición

`metaDelProyecto` (telefónico) suma sólo las metas con `caracter = meta` de una sola partición, o `objetivo_total`
cuando está declarado. No suma las metas por actor ni dos variables a la vez: hoy sexo más edad cuentan dos veces la
misma muestra.

## Lo que esta decisión NO cambia

- El numerador de avance de cada perfil ni sus fuentes.
- El eje de aulas (ADR 0086) ni el contrato congelado de `design_targets` (ADR 0079).
- La pregunta abierta de territorial sobre celdas cruzadas frente a marginales (pregunta 6 de
  `revamp-monitoreo/territorial.md`).
- `objetivo` (barrido / mínimo): sigue como está. Su choque de nombre queda anotado.
- La incoherencia de numerador entre el total y el ritmo de telefónico (`monitoreo_telefonico.R:905,923`): sigue
  abierta en el checklist (1b). Este ADR no la hereda como regla.

## Cumplimiento

Un perfil por commit, cada uno con su test y su captura:

1. **Contrato común**: función de `estado_cuota` en R (archivo nuevo) y su espejo en el front. Tests:
   - sin `caracter`, todas las cifras salen idénticas, incluidas la meta 0, «Sin base» y el KPI de brechas;
   - meta declarada sin número → referencial con aviso;
   - referencial sin universo → `sin_comparador`;
   - universo 0 → nulo, no 0 % ni Inf;
   - `celda_vacia`;
   - celdas más `sin_dato` suman el total.
2. **Telefónico**: `goals[].caracter` con ida y vuelta por `monitoreo_normalize_config` y el `.pulso`; avance en dos
   bloques; Modelo deja de pintar avance; `metaDelProyecto` sin doble conteo (test con sexo, edad y actor).
3. **Acreditación**: `cuotas[].caracter` con ida y vuelta por `.mcu_cuotas_entrada`; `interest_variables` como
   referencial; Avance › Por cuota en dos bloques.
4. **Aulas**: `caracter`, `fuente` y `estado_cuota` con niveles muestra y sobremuestra; «referencial» sigue fuera del
   libro de cliente; separar las direcciones dobles.
5. **Territorial**: la marca por dimensión en Hojas de ruta (motor y UI), con ida y vuelta por
   `.hojas_ruta_envio_normalize` y la huella sin cambio cuando no se declara; avance en dos bloques; separar las
   direcciones dobles.

Cada paso cierra con `make gate-area` (incluido el contrato `campos-declarados`) y `make gate-front`.
