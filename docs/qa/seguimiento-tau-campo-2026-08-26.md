# Seguimiento de τ en campo — diseño de la superficie

Tipo: Diseño de superficie y checklist
Estado: Vigente
Fecha: 2026-08-26
Autoridad: Diseño confirmado por Gonzalo el 2026-08-26; la decisión la gobierna el ADR 0082 y este documento no lo reemplaza

Gobierna: [ADR 0082](../adrs/0082-la-tau-del-diseno-es-un-supuesto-fechado-y-el-campo-lo-contrasta.md).
Estudio de referencia: HSVG2026.

## La pregunta que la superficie contesta

> ¿El campo está rindiendo la τ con la que se compró el aforo, y si no, en qué
> facultad y con cuántas reservas se cierra?

No es «qué facultad rinde más» —eso ya lo contesta la pestaña Rendimiento, y es
un ranking para decidir a dónde mandar gente mañana—. Es si el **supuesto que
dimensionó la muestra** se está cumpliendo, que es una pregunta del diseño
contra el campo y de la misma familia que `avance_cuota` (ADR 0079).

## Dónde vive: `Monitoreo > Avance > Efectividad`

Pestaña propia, confirmada por Gonzalo el 2026-08-26.

Descartado Validación: τ no es un control de calidad del dato. Validación
responde «¿esta aula está bien aplicada?»; esto responde «¿el estudio cierra su
cuota?».

Descartado apilarlo bajo Rendimiento: las dos superficies miden efectivas sobre
elegibles y ahí se acaba el parecido. Rendimiento ordena facultades por lo que
deja cada visita —un ranking para repartir gente mañana, con el numerador del
**parte**— y Efectividad contrasta la τ que dimensionó contra la que rinde el
campo, con el numerador de **plataforma**. Vecinas y sin nada que las separe, el
lector no tiene forma de saber cuál está leyendo. El rail las distingue por el
detalle («Qué rinde más, por facultad» contra «La τ del diseño contra la del
campo»), porque los rótulos cortos son sinónimos en castellano.

## Qué se dibuja

### 1. Encabezado del estudio — el supuesto, declarado
Una línea, no una tarjeta: **τ agregada prevista 0,53 · observada 0,51 (banda
0,48–0,54) sobre 68 de 196 aulas aplicadas · respaldo: campo 2025**. Con el
sello de procedencia visible: si la τ viene de `calibracion_embebida` o
`tau_global` en vez del histórico del estudio, lo dice ahí.

### 2. La tabla de decisión — una fila por facultad
Es la superficie principal. Quince filas, ordenadas por déficit proyectado
descendente (la que más riesgo tiene, arriba):

| Columna | Qué es | De dónde sale |
|---|---|---|
| Facultad | | `design_targets.facultades[].facultad` |
| τ prevista | El supuesto de esa facultad | `design_targets...tau` |
| — mix / residual | Los dos factores, en tooltip | `calc_muestra_aulas_tasas_facultad()` |
| τ observada | Efectivas de plataforma / elegibles de aulas aplicadas | bloque nuevo |
| Banda | Intervalo de la observada | bloque nuevo |
| k | Aulas aplicadas que la sostienen | bloque nuevo |
| Alumnos ± | Déficit/superávit acumulado al corte, en alumnos | `(τ_obs − τ_prev) × elegibles_aplicados` |
| Proyección al cierre | Déficit si lo que falta rinde como lo aplicado | `+ (τ_obs − τ_prev) × elegibles_pendientes` |
| Reservas | Libres en las cadenas de esa facultad | `colchonPorFacultad` / `consumoDeCadena` |
| Cierran | Cuántas reservas cubren el déficit proyectado | mismo cálculo que `alcanceDelBanco`, por facultad |

**Se señala una facultad cuando su banda excluye la τ prevista** — nunca cuando
sólo el punto la cruza. Las nueve facultades con residual 1,000 llevan marca de
«el histórico no le dio base propia», para que ese 1,000 no se lea como medido.

### 3. La serie — día y semana
- **Diaria, del estudio**: τ observada acumulada contra la τ prevista ponderada
  por los elegibles ya aplicados. Acumulada y no diaria porque la τ de un día
  es el promedio de una o dos aulas y salta sin significar nada.
- **Semanal, por facultad**: una tabla compacta —semana × facultad, celda con
  la τ de esa semana y su k—. Quince series diarias superpuestas no se leen.
- **`serieDeRendimiento.ts` gana una tercera línea de referencia**: hoy dibuja
  observado y esperado bayesiano (media encogida del propio estudio), y le
  falta el esperado **del diseño**, que es contra el que se compró el aforo.

## Contrato de backend

Bloque nuevo `monitoreo_aulas_efectividad_seguimiento_v1` en el dashboard,
motor en **archivo propio** `api/R/monitoreo_aulas_efectividad_seguimiento.R`
(`monitoreo_aulas_universitarias.R` ya pesa 118 KB y no crece).

`avance_cuota` gana `tau_prevista` **por fila de facultad**: hoy sólo publica la
τ compartida y la deja en `NA` justo cuando difiere por facultad, que es el
caso de HSVG2026.

## Checklist

**Regla del loop, instrucción de Gonzalo del 2026-08-26, textual: «debemos
tener un checklist para el loop y debemos poder comprobarlos en la UI, debe ser
una aplicación conjunta con un perfeccionamiento de la UI».**

Consecuencia, y cambia cómo se cierra cada ítem:

1. **Ningún ítem se cierra con tests.** Cada uno declara qué se mira en
   pantalla, con la dirección canónica, y no pasa a ☑ hasta que se vio ahí.
2. **Motor y UI van en la misma aplicación.** Nada de cerrar el backend y dejar
   la superficie para después: un bloque sin consumidor no es una capacidad.
3. Por eso **la fixture del operativo pasa a ser el primer ítem**, no el
   último: sin una superficie poblada no se puede comprobar ninguno de los
   demás, y eso convierte «bloqueado» en «lo primero».

Dirección de toda la columna de comprobación:
`/monitoreo?modo=aulas&seccion=avance&pestana=efectividad`, con `/ver-ui`.

| # | Ítem | Cómo se comprueba EN LA UI | Estado |
|---|---|---|---|
| **E11** | **Fixture sintética del operativo de aulas** — plan con titulares, reservas de cadena y banco; partes de campo; respuestas de plataforma; base de control | La pestaña deja de mostrar el vacío y lista las quince facultades con cifras | ☑ **por otra vía**: `~/Desktop/prosecnur-demo/HSVG2026-simulacion-15dias.pulso` cumple el criterio con datos reales reescalados en vez de sintéticos, y además reparte los tres casos (2 por debajo, 2 por encima, 11 conformes). Cómo se construye: sección «Los dos insumos» del checklist del registro académico |
| E0 | ADR 0082 + motor + `tau_prevista` por fila + tabla + marca de residual sin base | La tabla muestra τ prevista y observada por facultad, y las nueve sin base propia lo dicen en su fila | ☑ código · ◐ **UI**: la tabla SÍ muestra τ prevista y observada (verificado en pantalla el 2026-08-31), pero `AulasEfectividadSeguimiento.tsx` **no consume `residual_base` ni `residual_k`**, que el motor publica. Hoy es latente: sobre HSVG 2026 las 15 salen `sin_dato` porque el plan viene de libro y no trae `factor_facultad` (0 de 1.424), así que no habría nada que marcar |
| E10 | El disparador es el consumo del margen; la banda queda como guarda | Una facultad con `senal: bajo` y `riesgo: holgado` **no** sale pintada; la que no cierra, sí | ☑ **verificado en pantalla** el 2026-08-31: EE.GG. Ciencias sale «Puede no cerrar» siendo `conforme`, y EE.GG. Letras «No cierra» siendo `bajo`. El pintado sigue el riesgo, no la señal |
| E4 | El banco entra al conteo de reservas | Una facultad sin reservas de cadena pero con banco deja de decir «sin reservas libres» | ☑ `354ef628`, y el problema resultó ser el contrario del enunciado: la ficha mandaba al banco **siempre**, tuviera o no. Sobre HSVG 2026 el bolsón está en 3 facultades y **12 lo tienen vacío**. Tres frases distintas según haya extras, no haya, o el estudio no publique banco. `bolsonLibre` va aparte de `reservasLibres`: son dos recursos con procedimiento distinto |
| E2 | Ventana de reacción (7 días de anticipación) | La fila en riesgo dice «pedir antes del DD/MM»; sin margen, lo dice distinto | ☑ implementada (`pedirAntesDe` en `alertaDeAnticipacion.ts`). **Su rama no se alcanza con este estudio**: las 6 facultades que piden salen «ahora» o «sin agenda», ninguna con margen, así que la fecha no llega a pintarse |
| E3 | El sexo en la decisión de reservas | La fila dice de qué sexo es lo que falta, no sólo cuántos alumnos | ☑ **verificado en pantalla**: la tabla de «A quién hay que agendar» dice «48 · 38 hombres» y «3 · 2 mujeres» |
| E5 | Sesgo de agotamiento | La proyección muestra dos cifras: a la τ acumulada y a la de los últimos días | ☑ implementada en `serieDeRendimiento.ts` y `consumoDelBanco.ts` |
| E6 | Serie diaria acumulada + tabla semanal por facultad | Los dos paneles se ven y su eje temporal cuadra con el ritmo diario | ☑ `AulasSerieDeRendimiento.tsx`, montada bajo «Cómo rinde cada facultad, día a día» |
| E7 | Tercera línea (el esperado del diseño) en `serieDeRendimiento` | El gráfico dibuja tres líneas y la leyenda las nombra | ☑ el «esperado» está implementado como media posterior bayesiana, documentado en `serieDeRendimiento.ts` |
| E8 | Choque de rótulos «Del potencial» / banco | Ninguna pestaña llama igual a dos tasas con numeradores distintos | ☐ **espera a Gonzalo** |
| **E12** | **Perfeccionamiento de la UI de la pestaña** | `ui-quick-check` con `--require-geometry --fail-on-issues` en los cinco viewports (1710×1107, 1440×1000, 1366×768, 1280×720, 1024×600), vacíos clasificados y C1–C4 | ☑ 2026-08-31 sobre la simulación de 15 días: `captures=5 issues=0 geometryGroups=15 geometryIssues=0 geometryCoverageMisses=0`, con `--fail-on-issues`. Cobertura real, no verde por ausencia |

### E11, y por qué era «bloqueado» hasta hoy

Medido el 2026-08-26: **ningún proyecto en disco llega poblado a esta
superficie.** Los seis `.pulso` de `~/Documents/Pulso/HSTVG2026/` traen
`calc-muestra: ready` con `monitoreo: pending` —el estudio no ha salido a
campo—; `api/inst/reference_projects/hsvg2026/` declara `monitoreo: false`; y
sembrar la selección en el anonimizado se detiene porque el descuento
secuencial necesita los ids de alumno, que son PII y no viajan
(`make reference-project-seed-aulas REFERENCE_PROJECT=hsvg2026`).
`scripts/ui-quick-check.mjs` stubea el workspace de calc-muestra, no el
dashboard de Monitoreo.

**La salida es fabricar la fixture, y desbloquea todo el perfil de aulas, no un
ítem.** Es sintética y determinista: no lleva PII, puede vivir en el repo junto
a `api/inst/audit_reference/`, y da a las quince facultades un estado con
titulares aplicados, reservas dormidas, banco y respuestas de plataforma. Las
cifras del backtest de 2025 sirven de calibración para que el estado se parezca
a un campo real en vez de a números redondos.

### El ítem 4, dicho y no tocado

El numerador quedó fijado en plataforma, y eso deja dos rótulos que ahora
prometen otro número:

- **«Del potencial»** en `avance > rendimiento` es `effective_surveys /
  eligible_n`: la misma forma que τ, con el numerador del parte.
- **`alcanceDelBanco`** proyecta el banco con `sent_total` al 58,7 %: la misma
  forma, con el numerador de la hoja del equipo.

Ninguno es un defecto nuevo —los dos existían antes de este ADR y nadie los
reportó—, así que se señalan y no se reparan dentro de esta tanda. La opción de
realinear también el banco se ofreció y no fue la elegida: cambiaría una cifra
que el equipo ya viene leyendo.

## E1 — Backtest contra el campo 2025 (2026-08-26)

Se reprodujo el campo 2025 semana a semana contra `.maes_banda_razon()` y
`.maes_senal()`, sobre `calc_muestra_referencia_asistencia$cadenas_reemplazo`
del proyecto real (170 cadenas, **194 escalones aplicados con semana y
elegibles**, 15 facultades, 4 semanas). La τ prevista salió de
`calc_muestra_estudio$componentes[[1]]$aulas_por_estrato[[i]]$tau`.

**La pregunta NO es si converge al final.** La τ de 2026 se ajustó sobre estos
datos, así que la convergencia está garantizada por construcción. Lo que el
backtest mide es el camino: falsas alarmas, ancho de banda y oportunidad.

### Hallazgo 1 — La regla no puede disparar en el escenario que la motivó

La caída de τ que la banda al 95 % detecta es **la semi-amplitud de la banda**
(1,96 × SE), y ésta es la medida:

| Corte | Aulas | Caída detectable (mediana) | Mejor | Peor | Facultades donde −5 % sería detectable |
|---|---|---|---|---|---|
| Tras semana 1 | 86 | 16,3 pp | 5,7 | 26,6 | **0 de 12** |
| Tras semana 2 | 154 | 13,6 pp | 4,7 | 35,5 | **0 de 15** |
| Tras semana 3 | 190 | 12,7 pp | 3,6 | 26,6 | **0 de 15** |

El escenario de estrés que motivó todo esto —τ un 5 % por debajo— vale entre
**2,0 y 4,0 pp** según la facultad. **Ninguna facultad lo detectaría en ningún
corte.** Ni siquiera a nivel de estudio con 190 aulas: detectable 3,2 pp contra
2,6 pp necesarios.

### Hallazgo 2 — La única señal «bajo» del backtest fue falsa

**EE.GG. Ciencias, semana 1**: τ observada 0,332 contra 0,409 prevista, banda
[0,267 – 0,397] → señalada `bajo`. En la semana 2 volvió a `conforme` y ahí se
quedó hasta el final. Es la alarma que se desdice sola, y cayó justo sobre la
facultad de τ más baja — donde equivocarse es más caro.

### Hallazgo 3 — La τ compuesta no reproduce a dos facultades de su propio histórico

Dos señales `sobre` persistieron desde la semana 1 hasta el final, y **no son
ruido**:

| Facultad | τ prevista | τ observada 2025 | Banda | k | Brecha |
|---|---|---|---|---|---|
| Arquitectura y Urbanismo | 0,546 | 0,722 | [0,568 – 0,875] | 7 | **+17,6 pp** |
| Gastronomía, Hotelería y Turismo | 0,682 | 0,924 | [0,888 – 0,961] | 3 | **+24,2 pp** |

Las dos llevan residual 1,000 por `k < 12`. Es la advertencia del ADR con
número: **un 1,000 por falta de base no es «rinde según su mix»**, y aquí el
mix se equivoca por 17 y 24 puntos contra el histórico del que salió.

### Hallazgo 4 — La ventana de reacción se cierra antes que la evidencia llegue

El campo se concentra al principio: **86 · 68 · 36 · 4** aulas por semana. Para
el final de la semana 3 ya se aplicó el **98 %** (190 de 194). Con
`DIAS_DE_ANTICIPACION = 7`, una señal en la semana 2 llega con una semana útil
de agenda; en la semana 3 ya no queda nada que activar.

### Hallazgo 5 — El 4,1 % de las aulas rinde por encima de 1

8 de 194 tienen `efectivas > elegibles`, máximo **1,29**. Los dos campos no
comparten universo exacto. No invalida el τ agregado (0,5300 global 2025), pero
la pantalla puede llegar a mostrar una τ observada mayor que 1 y eso pide una
explicación que hoy no da.

### Agotamiento por semana, medido aquí

τ no acumulada: **0,5515 · 0,5007 · 0,5632 · 0,3239**. Confirma la no
monotonía ya documentada y que la cola de la semana 4 (4 aulas) es la que
arrastra el promedio.

### Qué exige esto decidir

La cláusula 5 del ADR —«la banda dispara la señal, el punto no»— **cumple bien
su mitad defensiva** (mantuvo callada a 13 de 15 facultades y evitó actuar
sobre ruido) y **falla su mitad ofensiva**: no detecta la caída que importa.
Las opciones medidas, para que Gonzalo decida:

- **(a) Cambiar el estadístico**: del test sobre τ al **consumo del margen** —
  el diseño compró aforo de más (`⌈cuota / (p25 × τ)⌉` más reservas), y la
  pregunta operativa es cuánto de ese margen se lleva gastado, no si τ difiere.
  Es la misma vara que ya usa `alcanceDelBanco`.
- **(b) Una cola al 80 %** en vez de dos al 95 %: z de 1,96 → 0,84 baja la
  detectable de 13,6 a ~5,8 pp de mediana. **No alcanza sola** (hacen falta
  2–4 pp) y sube la falsa alarma que el hallazgo 2 ya mostró.
- **(c) Agrupar por tramo de τ** en vez de por facultad: las de τ baja juntas
  (EGC + EGL) dan k=38 y banda mucho más estrecha. Detecta el fenómeno antes;
  la acción sigue siendo por facultad.
- **(d) Conservar la banda sólo como guarda contra el ruido** —para lo que sí
  funciona— y que el disparador sea (a).

Reproducible con los scripts del scratchpad de la sesión: `bt/backtest.R`,
`bt/poder2.R`.

**Trampa cazada al medir esto**: la primera versión calculó la caída detectable
como «distancia del extremo de la banda a la τ prevista», que es negativa
cuando la facultad conforma, y comparándola contra un umbral positivo dio
«15 de 15 detectarían» — exactamente lo contrario de la verdad. La banda se
centra en lo OBSERVADO: la caída detectable es su semi-amplitud.

## El criterio de la tabla se extiende al resto del perfil (E13)

Instrucción de Gonzalo del 2026-08-26, ya aprobada la tabla: **«ese mismo
criterio se le debe aplicar al resto de elementos de esta UI, para que estén
igual de estéticamente limpios»**.

El criterio, tal como quedó al reparar la tabla de Efectividad:

1. Datos tabulares en `<table>` con `<th scope>` y `caption`; nunca una lista
   con grid y el encabezado en `aria-hidden`.
2. Rótulos en castellano llano, sin jerga ni símbolos que el lector no comparta.
3. Sin `text-transform: uppercase` en texto pequeño: rompe letras griegas y
   compite con los datos.
4. Tasas en porcentaje; personas en enteros y por el lado cauto.
5. El estado nunca sólo por color: palabra además de tono.
6. Todo gráfico con alternativa textual (`role="img"` + `aria-label`), y la
   leyenda visual junto a la pieza, no en prosa al pie.
7. Cifras alineadas con su encabezado.

### Lo medido en el perfil, 2026-08-26

| Señal | Conteo | Qué exige |
|---|---|---|
| `aria-hidden="true"` en componentes del perfil | **12 archivos** | Triaje: distinguir el ícono decorativo (legítimo) de la fila de encabezados (defecto) |
| `grid-template-columns` en `aulasMonitoreo.css` | **61** | Triaje: cuáles son datos tabulares que deberían ser `<table>` |
| `text-transform: uppercase` en `aulasMonitoreo.css` | **21** | Revisar tamaño y contenido; es el defecto que convirtió «τ» en «Τ» |
| `title=` sin `aria-label` | **22** contra 39 `aria-label` | Los que dependen sólo del tooltip no son alcanzables por teclado |
| `Math.round(n * 10) / 10` | **8 sitios** | Varios proyectan encuestas, o sea personas: `proyeccionPorAgenda`, `pronosticoDeCierre`, `serieDeRendimiento` |

### Triaje hecho (E13a, 2026-08-26)

Se ejercitaron tres pestañas del perfil con la fixture del operativo completo
—`efectividad`, `rendimiento`, `cuotas`— con sus paneles montados y con datos.

**Los 8 redondeos a un decimal NO son un defecto de pantalla. Se cierran.**
Cero decimales sobre personas en las tres pestañas. La doctrina de la casa está
bien aplicada: los modelos conservan el decimal —`redondeoConservador.ts` lo
exige, porque un ranking que ordena por el número truncado empata 28,9 con
28,1— y las vistas eligen formateador según la magnitud. Hay **tres** y cada uno
tiene su regla:

| Formateador | Redondeo | Para qué |
|---|---|---|
| `fmt()` | conserva decimales | tasas y porcentajes |
| `fmtCuenta()` | hacia **arriba** | lo que hay que ALCANZAR: metas, faltantes |
| `personasPorAula()` | hacia **abajo** | lo que se PROMETE: rendimientos |

Dos falsos positivos por el camino, los dos por leer el texto sin su unidad:
«3,700 respuestas» es 3 700 con separador inglés, y «faltan · 80,2» resultó ser
«80,2 **%**». **Un número sin su unidad no se puede juzgar.**

**El `aria-hidden` SÍ es un defecto real, y son seis componentes.** Todos con la
misma forma: una lista de datos cuya fila de encabezados lleva
`aria-hidden="true"`, sin ningún ícono que lo justifique.

| Componente | Contenedor |
|---|---|
| `AulasAlertaDeAnticipacion` | `aulas-anticipacion-cabecera` |
| `AulasColchonPorFacultad` | `aulas-colchon-cabecera` |
| `AulasConsumoDelBanco` | `aulas-banco-consumo-lista` |
| `AulasMedioDeContacto` | `aulas-medio-lista` |
| `AulasRendimientoPorFacultad` | `aulas-rendimiento-lista` |
| `AulasRitmoPorFacultad` | `aulas-ritmofac-lista` |

Verificado en vivo sobre `AulasRendimientoPorFacultad`: es un `<UL>` de **21
filas** y su encabezado —«Facultad · Por aula · Ajustado · De los asistentes ·
Del potencial»— está oculto, así que un lector de pantalla recibe veintiún
juegos de cinco números sin un solo nombre de columna.

Legítimos y no se tocan: `AulasEfectividadSeguimiento` y `AulasPiramideCuota`
lo llevan en su **leyenda**, sobre marcas pintadas que sí son decorativas.

**Siguiente**: los seis, con la misma reparación que la tabla de Efectividad
—`<table>` con `<th scope>` y `caption`—, y cada uno cerrado viéndolo.

**No es una lista de defectos: es una lista de sitios que hay que mirar.** No
todo `aria-hidden` es un error ni toda rejilla es una tabla; el conteo dice
dónde buscar, y cada uno se decide viéndolo. La regla de cierre sigue siendo la
misma: no se cierra sin verlo en pantalla.

## E13b y E13c — las seis cabeceras, y el contraste medido (2026-08-26)

### Las seis, hechas y verificadas en vivo

`AulasRendimientoPorFacultad` · `AulasAlertaDeAnticipacion` ·
`AulasColchonPorFacultad` · `AulasConsumoDelBanco` · `AulasMedioDeContacto` ·
`AulasRitmoPorFacultad`.

**No se convirtieron en `<table>`, y es una decisión.** Sus rejillas están
afinadas —una de ellas la comparten cuatro instancias y una variante compacta
cuyos anchos salen de la palabra más larga de cada cabecera— y el defecto a
reparar era de NOMBRES, no de maquetación. Se resolvió con roles ARIA de tabla,
que no mueven un píxel. Medido tras el cambio, en cada una:

| Componente | Columnas | Celdas por fila | Desvío cabecera↔fila |
|---|---|---|---|
| Rendimiento por facultad | 5 | 5 | **0 px** |
| Consumo del banco | 4 | 4 | **0 px** |
| Ritmo por facultad | 3 | 3 | **0 px** |
| Alerta de anticipación | 5 | 5 | **0 px** |
| Colchón por facultad | 4 | 4 | **0 px** (20 filas) |
| Medio de contacto | 3 | 3 | **0 px** |

Ninguna página quedó con scroll horizontal. La comprobación que lo cazó todo es
contar **hijos de la fila** y **celdas con rol**: en `AulasMedioDeContacto`
salían 3 hijos y sólo 2 celdas, y así apareció una que se había quedado sin rol.

### Contraste: verde por conformidad, con el conteo

Nunca se había medido. Barrido sobre cinco direcciones con la fixture del
operativo completo, criterio WCAG AA (4,5:1 normal, 3:1 texto grande):

| Dirección | Elementos medidos | Incumplen | Peor ratio |
|---|---|---|---|
| `avance/efectividad` | 102 | 0 | 4,84 |
| `avance/rendimiento` | 191 | 0 | 5,01 |
| `avance/resumen` | 192 | 0 | 5,01 |
| `avance/cuotas` | 61 | 0 | 6,51 |
| `consultas/reemplazos` | 48 | 0 | 6,51 |

**594 elementos, cero incumplimientos.** Los más justos son de esta misma tanda:
`aulas-tau-error` y `aulas-tau-respaldo` a 10 px dan **4,84** contra un mínimo
de 4,5 — pasan con poco margen, así que si el tema aclara `--pulso-text-faint`
o el fondo, son los primeros que caen.

**El primer intento de `consultas/reemplazos` midió 0 elementos** por esperar
1,3 s en vez de 4: eso no es verde, es cobertura pendiente, y se repitió antes
de darlo por bueno. Un barrido que no midió nada informa cero incumplimientos
exactamente igual que uno conforme.

### Lo que NO se tocó, y por qué

Las tarjetas de KPI llevan `text-transform: uppercase` a 10 px, igual que las
cabeceras que se repararon. **No es el mismo caso**: ahí la etiqueta va sobre un
número grande dentro de una tarjeta —que es donde las versalitas funcionan— y no
compite con datos en la misma línea ni lleva letras griegas que romper. Es
decisión de diseño, no defecto.

## Lo aprendido que no hay que reinvestigar

- La τ del diseño **ya llega** a Monitoreo: `.monitoreo_aulas_metas_diseno()`
  la deja en `cfg$design_targets$facultades[[i]]$tau` desde H3. No hay que
  construir el puente, hay que consumirlo.
- `avance_cuota.tasa_esperada` es `NA` en HSVG2026 **por diseño**: el motor se
  niega a promediar quince τ distintas. La τ por fila hay que añadirla, no
  desbloquear la compartida.
- Las tres tasas homónimas (parte / hoja / plataforma) están medidas y
  localizadas en el ADR. `alcanceDelBanco` proyecta el banco con `sent_total`
  al 58,7 %: si el ítem 3 se cierra en «plataforma», esa proyección queda
  midiendo otra cosa que la τ y hay que decidir si se alinea o se rotula.
- El corte `k ≥ 12` y el prior de cinco aulas ya son decisiones argumentadas
  por escrito. La banda debe reusarlos, no inventar un tercer encogimiento.
