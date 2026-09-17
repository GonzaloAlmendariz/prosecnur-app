# ADR 0086 — El eje de cuotas lo declara el estudio, no el tipo de estudio

- **Estado**: Aceptado
- **Implementación**: Completa para Monitoreo (perfil aulas); no iniciada para
  Cálculo de muestra, por decisión de alcance (ver «Lo que no decide»)
- **Ámbito**: Monitoreo de cursos-horario (perfil aulas) · `monitoreo_aulas_eje.R`
  · `monitoreo_aulas_avance_cuota.R` · config del estudio · la pestaña Metas
- **Fecha**: 2026-09-17 · **Ratificado**: 2026-09-17 (Gonzalo, plan del eje de
  cuotas declarable, decisiones 1, 2, 7 y 8)
- **Reemplaza parcialmente**: la cláusula 2 de
  [ADR 0085](0085-la-carrera-del-estudiante-es-un-eje-declarable.md), que fijaba
  la CARRERA como eje de CCSS. Sus cláusulas 1, 3 y 4 siguen vigentes.
- **Relación**: aplica al AVANCE el principio del
  [ADR 0081](0081-la-facultad-de-un-aula-no-es-la-de-sus-alumnos.md) («para un
  estudio de estudiantes la unidad es la persona; el aula es el vehículo»);
  respeta intacto el contrato congelado del
  [ADR 0079](0079-el-cumplimiento-se-mide-contra-la-cuota-del-diseno.md); y
  conserva la guarda de cardinalidad del
  [ADR 0082](0082-una-variable-casi-identificadora-no-balancea-degenera.md).

## Contexto

Monitoreo de aulas medía el avance contra metas **por facultad, con cuotas de
sexo dentro**. El ADR 0079 lo dejó escrito: «la cuota es por facultad Y por
sexo, y no se compensa entre celdas». Sirvió para HSVG, que cubre toda la
universidad con quince facultades.

CCSS Perfil 2026-II rompe ese molde: vive **dentro de una sola facultad** y sus
metas se prometieron **por nivel curricular**. Con el eje cableado en facultad
ese estudio tiene un solo estrato, y todas las superficies que reparten por
facultad caen a la vez en su caso degenerado. No lo sustituyen por otro eje: lo
colapsan. Medido en pantalla el 2026-09-17, con el estudio ya importado:

- el panel «Consumo de la reserva» se reducía a UNA fila con las 85 cadenas
  dentro, y dejaba de contestar su única pregunta —dónde se rompe la reserva—;
- la reserva dirigida devolvía **0 candidatos a las cuatro celdas del eje** con
  342 personas de brecha, porque filtraba el banco comparando «6» contra
  «CIENCIAS SOCIALES»;
- los rótulos hablaban de «esa facultad y ese sexo» en un estudio de una
  facultad y sin cuota de sexo.

Ninguna de esas tres fallaba. Es la propiedad que define el problema: **un eje
cableado no produce errores, produce ceros que se leen como mediciones.**

### Por qué el nivel, y no la carrera ni el ciclo

La base de la DTI trae tres candidatas y una no es un nivel. Sobre las 1.354
personas de la facultad:

| Variable | Qué es según el SQL de la DTI | Rango |
|---|---|---|
| `CICLO_ACTUAL` | `cicloano \|\| '-' \|\| ciclo` — el **periodo académico** | `2026-02` para todos |
| `NIVEL_CURRICULAR` | `ctrlcurr.pq_general_c.f_nivelcurricularalumno(alumno, ciclo)` | 5 a 12 |
| `NIVEL_CREDITOS` | `MAX(valor)` de `rendimi.varxaluxfxcic`, variable 10 | 1 a 7 |

Las dos últimas **coinciden en 11 de 1.354 casos**: no son la misma escala
corrida. Se fija `NIVEL_CURRICULAR` porque el formulario pregunta el ciclo con
opciones de Sexto a Noveno y `NIVEL_CREDITOS` no puede producir 8 ni 9 en esta
facultad, porque la propuesta dice «orientada a alumnos de nivel 6 a 9», y
porque es la función de control curricular que contesta esa pregunta.

**La app nunca lo preguntó.** El alias de `mapping$level`
([calc_muestra_aulas.R:266](../../api/R/calc_muestra_aulas.R)) acepta nueve
nombres para el mismo rol y toma el primero: que acertara fue suerte. Declarar
la columna del eje es parte de esta decisión, no un detalle de implementación.

La carrera se descarta como eje —contra la cláusula 2 del ADR 0085— por dictado
explícito del 2026-09-17: «Recuerda que la meta no es por sexo y nivel sino sólo
nivel». Las metas se prometieron por nivel curricular; carrera y sexo son
referenciales.

## Decisión

**1 · El eje de cuotas lo declara la CONFIGURACIÓN del estudio, y su vocabulario
es cerrado.** `cfg$aulas_universitarias$eje_cuota` toma una clave del catálogo
`.MONITOREO_AULAS_EJES` ([monitoreo_aulas_eje.R](../../api/R/monitoreo_aulas_eje.R)),
hoy `facultad` o `nivel`, con `eje_cuota_motivo` escrito al lado. Un valor que
el catálogo no conoce **cae a `facultad`**, no a un eje inventado.

**2 · No lo decide el tipo de estudio.** El antipatrón está en el repo y tiene
nombre: `study_macro_family` se escribe en
[monitoreo_aulas_universitarias.R:1376](../../api/R/monitoreo_aulas_universitarias.R)
y **nadie lo lee** —una sola ocurrencia en todo el árbol—. El patrón correcto es
el de `selector$strata_cols`: la configuración decide.

**3 · El eje nace en `facultad`, y sin declaración nada cambia.** Un estudio
existente no cambia un byte. Es una vara comprobable, no una intención: las 136
aserciones de `test-monitoreo-aulas-avance-cuota.R` pasaron sin tocar una sola al
generalizar el bloque.

**4 · El campo conserva su nombre; el significado viaja aparte.**
`design_targets`, `monitoreo_aulas_design_targets_v1`, `facultades` y
`faculty_key` **no se renombran** —el contrato está congelado por el ADR 0079 y
su propia suite lo declara «contrato congelado»—. El diseño es **aditivo**: un
campo hermano `eje` declara qué significan esos valores. Quien lee
`avance_cuota$facultades` sin mirar `avance_cuota$eje` obtiene lo mismo que
antes; quien quiera saber de qué son esas celdas, lo pregunta.

**5 · El eje declara sus palabras; no se derivan de su etiqueta.** El catálogo
lleva `etiqueta`, `etiqueta_plural`, `etiqueta_sin`, `frase_celda` («esa
facultad» / «ese nivel») y `frase_valor` (`"%s"` / `"nivel %s"`). Derivarlas de
la etiqueta obliga a acertar con el género del artículo y del demostrativo en
cada eje nuevo, y el resultado se lee en la pantalla más vista: «esa nivel». Con
`frase_valor = "%s"` las frases del eje facultad salen byte a byte como las lee
HSVG en campo.

**6 · El estrato del sorteo y el eje de cuotas son decisiones separadas.** No se
derivan una de la otra y no se deben confundir. Medido: el `stratum` del plan de
HSVG2026 es `FACULTAD / SEXO / GRUPO` y tiene **76 valores** sobre 1.392 aulas,
mientras su eje de cuotas tiene 15; en CCSS el `stratum` coincide con el nivel,
pero es una propiedad de ese diseño y no la regla. Agrupar una superficie por
`stratum` «porque es el estrato» convertiría 15 filas en 76 en un estudio que
está en campo.

**7 · Sexo y carrera son referenciales, y se describen sin exigirles nada.** El
motor publica `avance_cuota$composicion` —la composición obtenida contra la
población, calculada en el motor porque el payload del estado recorta
`quotas$category_profiles`— y la pantalla la enseña **sin umbrales, sin avisos
de desvío y sin tono de alarma**. Una diferencia de diez puntos entre población
y recogido se enseña, no se juzga: pintarla en rojo convertiría en
incumplimiento algo que el estudio no prometió.

## Lo que esta decisión NO cambia

- **HSVG y los estudios vigentes.** El eje nace en facultad; la identidad es la
  vara de aceptación de cada paso.
- **La guarda del ADR 0082.** `program` dentro de una facultad puede tener casi
  tantos niveles como aulas a sortear (Gestión: 44 columnas para 49 aulas), y
  esa guarda sigue decidiendo en tiempo de ejecución.
- **La atribución por aula del ADR 0079.** La cambia el
  [ADR 0088](0088-el-numerador-de-una-celda-es-la-persona.md), y sólo para el eje
  que lo declare.

## Lo que no decide, y por qué

- **Cálculo de muestra entero.** El sorteo de CCSS ya está hecho y no hace falta
  tocarlo para que el campo mida. Queda pendiente `_afijacion.R` —incluido su
  `stop()` plano, que debería pasar a `stop_api()`—, `_certificacion.R` —donde
  `.cm_certificacion_componente_facultad` **asume** que `f$estrato` es la
  etiqueta del eje y no lo pregunta—, los cuatro satélites «por facultad» y el
  frontend de `calcMuestra/universidad/`, que tiene una regla de diseño probada
  en contra (`adr0057Reglas.contract.test.ts`: «todos los criterios son por
  facultad»).
- **Renombrar `.cm_criterios_fac_key`.** 92 llamadas en 32 archivos por cero
  cambio de conducta. Se le pone alias (`monitoreo_aulas_eje_key`) y se sigue.
- **La afijación por valor del eje.** Cuántas encuestas van a cada nivel es
  dimensionamiento y lo resuelve el diseño del estudio, no este ADR.

## Consecuencias

- Toda superficie que AGRUPA filas del plan necesita la **columna** del eje, no
  sólo su rótulo: `EjeDeclarado` publica `columna` y `atribucion` por eso. Una
  superficie que sólo relabela sigue mostrando un eje colapsado.
- Los dos lados de una comparación tienen que normalizar con la MISMA función.
  `.maac_eje_key()` es esa función; usar dos normalizadores distintos es
  literalmente cómo se fabricó el cero de la reserva dirigida.
- El vocabulario cerrado es una restricción deliberada: un eje nuevo se añade al
  catálogo con sus frases, no se configura con texto libre. El coste es un
  commit por eje; el beneficio es que ninguna pantalla recibe una palabra que no
  sabe declinar.
- Quedan rótulos de NAVEGACIÓN sin seguir al eje —la pestaña «Por facultad»,
  dirección `monitoreo/aulas/modelo/facultad`—. Son nombres de pestaña, no de
  dato, y cambiarlos mueve una dirección enlazable: se deciden aparte.

## Cumplimiento

- **Identidad del eje facultad, que es la vara**: `test-monitoreo-aulas-avance-cuota.R`
  (136 aserciones) pasa sin modificación; `consumoDelBanco.test.ts` compara
  `toEqual` entre la llamada sin columna y con `"faculty"` explícito;
  `test-monitoreo-aulas-reserva-dirigida.R` fija la frase legada «a la cuota de
  mujeres de DERECHO» carácter a carácter.
- **El eje se resuelve en un solo sitio**: `monitoreo_aulas_eje(cfg)` acepta la
  config completa o el bloque de aulas, y una clave desconocida cae a
  `facultad`. Suite: `test-monitoreo-aulas-eje*.R`.
- **Ausencia de juicio en la composición**: prueba de ausencia en
  `composicionReferencial.test.tsx` sobre el markup —ni «desvío», ni «umbral»,
  ni `--pulso-warn`— y su pareja en el motor.
- Gate del área: `make gate-area AREA=aulas GATE_ARGS='--patron "avance|cuota|eje|metas|brecha|reserva|nivel|padron|composicion"'`
  y `make gate-front AREA=monitoreo/profiles/aulas`.
- **Lo que este ADR no puede probar**: que la columna declarada sea la correcta
  para el estudio. Eso lo decide quien configura, y por eso `eje_cuota_motivo`
  es obligatorio en la práctica: un eje sin motivo escrito es un eje que nadie
  podrá auditar.

## Notas

- Plan de origen: `~/.claude/plans/reactive-squishing-bubble.md`.
- Commits del recorrido: `6d9e84c5` (atribución por persona), `ca3d581b`
  (`avance_cuota` por el eje), `4eb66197` (composición referencial), `59961465`
  (el foco apunta al eje), `e63ddb5e`, `4d5b48a1`, `8506f6cb`, `0b5d1c2f`.
