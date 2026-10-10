# Loop DEFINIDO — Monitoreo de aulas cierra lo que el simulacro destapó

Tipo: Checklist de loop definido
Estado: En curso
Fecha: 2026-08-28
Autoridad: Condición de término declarada; sólo Gonzalo la da por terminada

**Abierto** 2026-08-28 · **Sustituye** al loop indefinido de investigación /
creatividad / implementación, que ya entregó lo suyo: el diagnóstico está hecho
y lo que queda es construirlo.

**Condición de término.** Los diez ítems en verde y el gate del área corrido.
No lo cierra el reloj: lo cierra la lista, y sólo Gonzalo la da por terminada.

## De dónde sale la lista

De abrir el simulacro de semana y media en su peor escenario
(`HSVG2026_sem15_campo_malo.pulso`, factor 0,52 = el decil bajo de 2025) y
hacerle a la pantalla las tres preguntas de un coordinador. Medido sobre el DOM,
no a ojo:

| pregunta | qué contesta hoy la pantalla |
|---|---|
| ¿Ya decidimos ir a reemplazos? | «reemplaz» aparece **6 veces**, todas como etiqueta de estado. Las 18 decisiones están en los datos; ninguna superficie las presenta. |
| ¿Llegamos? | Ves el presente (45,6 %, 154 brechas, 974 por recoger). «no llega», «alcanza», «probabilidad», «proyección»: **cero coincidencias**. |
| ¿Se ven las τ? | **Cero menciones** de τ, rendimiento o efectividad en toda la vista de Avance. |

## La lista

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | El botón «Reemplazar» abre el popover en una fila real | `RegistroDeCampo.tsx` | **cerrado** `3e9b186c` |
| 2 | «Reemplazar con ésta» activa de verdad la elegida | `router_monitoreo.R` + contrato HTTP | **cerrado** `3e9b186c` |
| 3 | Las decisiones ya tomadas se ven como decisiones | pestaña `consultas/reemplazos` (ya existe) | **cerrado sin cambio** |
| 4 | Suficiencia en probabilidad por facultad | pestaña `avance/efectividad` (ya existía) | **cerrado** — ver abajo |
| 5 | τ de diseño / observado / operativo, visibles | pestaña `avance/efectividad` (ya existe) | **cerrado** — ver abajo |
| 6 | La meta sale del escenario ACTIVO | `.cm_estudio_componente_activo()` | **cerrado** `ce7203b2` |
| 7 | El conteo de aulas sale de la selección, no de `aulas_base_total` | `monitoreo_aulas_metas_diseno.R` | **cerrado sin cambio** — ver abajo |
| 8 | `TASA_DE_CAIDA` no reproduce del libro: retirar o rehacer | `kpisDeAulas.ts` | **bloqueado** — depende de A7 |
| 9 | Alertas específicas por sexo | pestaña `avance/cuotas` | **cerrado sin cambio** — ya existían: «19 de 30 celdas no van a llegar» y el detalle por celda |
| 10 | Un sexo en código (`1`/`2`) no puede dar cero mudo | `monitoreo_aulas_avance_cuota.R` + `AulasCuotasResumen.tsx` | **cerrado** — el motor ya publicaba la causa; faltaba pintarla donde se lee el cero, bitácora 38 |
| 11 | Un 500 transitorio deja «Preparando vista» para siempre | `AulasMonitoreoPage.tsx` | **falsificado** — `loadView` tiene `finally` que apaga `loading`; el efecto de montaje es incondicional |
| 12 | Registro coloquial en las etiquetas de estado | `.mac_etiqueta_estado()` + propuestas de tramos | **nuevo** — ver abajo |
| 13 | Alumnos con decimales («aporta 6,1») | `monitoreo_aulas_reserva_dirigida.R` | **cerrado** `1dbb99fb` |
| 14 | La probabilidad de cierre saturaba en 0/100 | `monitoreo_aulas_calibracion.R` | **cerrado** `1dbb99fb` |
| 15 | El gráfico llamaba «agendadas» al plan vivo entero | `AulasSexoPorFacultadChart.tsx` | **cerrado** — no era la contradicción que creí, ver bitácora 33b |
| 16 | Sin `--wait-selector` el runner da verde sobre un gráfico en blanco | `scripts/ui-quick-check.mjs` | **nuevo** — ver bitácora 34 |
| 17 | `proyeccionPorAgenda` proyecta con el parte de campo, no con la plataforma | `proyeccionPorAgenda.ts:135` | **bloqueado** — decisión tuya |
| 18 | «El avance que ve el cliente» llamaba muestra a la suma de cuotas | `AulasAvanceParaCliente.tsx` | **cerrado a medias** — rótulo corregido; el número sigue siendo 3.491 porque el total del motor ES esa suma, ver bitácora 40 |
| 19 | La tabla del cliente neteaba la cuota entre sexos dentro de la facultad | `avanceParaCliente.ts` | **cerrado** — era el ±1 de 2.824/2.825 |
| 20 | «Mujer» se contaba como hombre en dos superficies y se descartaba en una tercera | `avanceParaCliente.ts` · `brechaDeLaFacultad.ts` · `celdasPorFacultad.ts` | **cerrado** — ver bitácora 35 |
| 21 | El mismo defecto de sexo en R, en el camino del diseño | `sexo_por_facultad.R` · `libro_generar.R` · `certificacion.R` | **cerrado** — `.pulso_sexo_fm()`, ver bitácora 36 |
| 22 | Un `@export` mío se lo llevó el helper de al lado | `monitoreo_aulas_reserva_dirigida.R` | **cerrado** — ver bitácora 37 |
| 23 | `--pulso-warning-*` no existe: 16 usos, 6 sin respaldo | 16 archivos de CSS/TSX | **cerrado** — es `--pulso-warn-*`, ver bitácora 39 |
| 24 | ¿Qué número preside el panel del cliente: el objetivo (2.500) o el reparto (3.491)? | `metas_diseno.R:117` + `AulasAvanceParaCliente.tsx` | **bloqueado** — decisión tuya, bitácora 40 |
| 25 | Trazas de la serie pintadas sobre la tabla de «A quién hay que agendar» | `AulasSerieDeRendimiento.tsx` | **cerrado** — medido en el DOM (2.628 px fuera), se dibuja lo que cabe y se declara lo que no, bitácora 41 |
| 26 | La leyenda del acumulado mezcla dos universos: meta 67 y «Hombres 348/1.730» | `AulasSerieDeRendimiento.tsx` | **cerrado** — son las del estudio (1.730+1.761 = 3.491); los chips lo dicen y el pie dejó de prometer líneas que no están, bitácora 43 |
| 27 | Efectividad: «suponía que respondería el — de los alumnos» y una leyenda que promete una vara ausente | `AulasEfectividadSeguimiento.tsx` | **cerrado** — el guard tenía que ser `isFinite`, no `!= null`, bitácora 44 |
| 28 | «528 alumnos en riesgo» contra una columna que suma 535 | `AulasEfectividadSeguimiento.tsx` | **cerrado** — los dos eran correctos; se elige la suma de los techos, bitácora 45 |
| 29 | Decimales en respuestas en el pie del ritmo (sexta vez) | `AulasRitmoDiario.tsx` | **cerrado** — estaba una línea debajo de donde ya se arregló, bitácora 46 |
| 30 | Cifras del «cuánto falta» con granos distintos | varias superficies | **reducido** — el 2.825/3.492 era un redondeo mío y ya cuadra en 2.824/3.491 (bitácora 49); queda **bloqueado** sólo si la lectura por curso-horario (2.923 de 3.572) debe convivir con la de celda |
| 31 | Dos ceros que no se leían: leyenda de seis estados con tres segmentos, y un tramo de cobertura sin cifra | `AulasEstadoChart.tsx` · `AulasCoberturaChart.tsx` | **cerrado** — el conteo va en la leyenda y el cero va fuera de la barra, bitácora 47 |
| 32 | «Aplicada 0» en Status contra «APLICADAS 48» en la banda | `estadoDeAplicacion.ts` | **cerrado** — el tramo `en_aplicacion` estaba rotulado con el participio de terminado; ahora «En aplicación», con contrato que lo vigila, bitácora 48 |
| 33 | La tarjeta «Corte» daba `generated_at`, el reloj de la máquina | `kpisDeAulas.ts` | **cerrado** — usa `corteDelEstudio()`, que ya existía para esto; y arreglado un desfase de un día por parsear `YYYY-MM-DD` como UTC, bitácora 50 |
| 34 | El corte sale del parte de campo (2/9) y no de la plataforma (5/9) | `corteDelEstudio.ts` | **bloqueado** — decisión tuya, hermano del 17 |
| 35 | Un `capacity-drift` que SÍ declara su miembro | `ui-quick-check.mjs` | **cerrado** — era del GATE: `closest()` se incluye a sí mismo y declaraba invisible a un `<details>` cerrado que sí es visible, bitácora 52 |
| 36 | Español sin tildes en pantalla | `monitoreo_aulas_etiquetas.R` y siete archivos más | **cerrado** — cinco frases del archivo canónico con guard en su test, más las quince restantes una por una dejando intactos los alias `"validas"` y `"seleccion"`, bitácoras 54 y su commit `15e4e4f3` |
| 37 | Un contrato `equal` donde el gate medía el título contra el contenido | `AulasHistoriaCadena.tsx` | **cerrado** — son secciones independientes: `intrinsic`, bitácora 55 |
| 38 | «Días de campo» son dos ejes: 5 con respuestas y 2 con parte | `AulasRitmoDiario.tsx` · `AulasRitmoPorFacultad.tsx` | **cerrado** — «días de recolección» y «días con parte de campo», bitácora 57 |
| 39 | El mismo cociente con dos formatos en el mismo panel: «92%» junto a «89.3 %» | `embudoDelAula.ts` · `AulasEmbudoDelAula.tsx` | **cerrado** — el redondeo bajó del modelo a la vista, bitácora 58 |
| 40 | «SIN EMPEZAR 145 · agendadas» sobre 145 que no tienen fecha | `kpisDeAulas.ts` | **cerrado** — la pista declara el reparto, bitácora 59 |
| 41 | «A quién llamar» incluía 38 aulas ya aplicadas | `colaDeContacto.ts` | **cerrado** — se excluyen y se declaran; 183 → 145, que cuadra con «Sin empezar», bitácora 61 |
| 42 | `modelo/carga`: panel de ~1.000 px con un aviso de 60 y 940 de vacío | `cargaDeCampo.ts` · `AulasSeccionModelo.tsx` · `aulasMonitoreo.css` | **cerrado** — `hayHorarioDeCurso()` compartido y `align-self: start` sin malla; de 1.000 px a 125, bitácora 63 |
| 43 | Dos frases sin tilde en `monitoreo_texto_abierto.R` | `monitoreo_texto_abierto.R` | **cerrado** — «así que no se sabe qué» y «no están en la base»; el guard no se extiende a Monitoreo entero, con el motivo medido en la bitácora 64 |
| 44 | El banco de extras no decía su orden: con «Todas» parecía filtrado a una facultad | `AulasBancoExtras.tsx` | **cerrado** — «las que más mujeres traen primero», dicho donde está el `sort`, bitácora 65 |
| 45 | El avance salía «20%» o «19,6 %» según la fuente, y sin decir qué medía | `perfilPorFacultad.ts` · `AulasPerfilPorFacultad.tsx` · `kpisDeAulas.ts` | **cerrado** — un decimal en las dos rutas y un solo `pctPerfil()`, bitácora 66 |
| 46 | «falta 1 encuesta» junto a «faltan 3 y aportan 3» en la misma oración | `avanceProyectado.ts` · `kpisDeAulas.ts` | **cerrado** — el aporte se redondeaba hacia arriba; `fmtAporte()` va hacia abajo, bitácora 68 |
| 47 | «1 de 30 celdas … no van a llegar» | `AulasAvanceProyectado.tsx` | **cerrado** — concordancia |
| 48 | «déficit de 1 respuestas, repartido en 15 facultades» con el déficit en una sola | `AulasSexoPorFacultadChart.tsx` | **cerrado** — cuenta las que ponen déficit, bitácora 69 |
| 49 | La tabla de estratos mezcla «88.2» con «17» y «100» en la misma columna | `aulasPresentation.ts` | **cerrado** — no era el formato: las dos columnas faltaban en `COLUMNAS_DE_PORCENTAJE`; guard que cierra la familia, bitácora 70 |
| 50 | El acumulado contaba el parte (2.817) y no lo decía, junto a «2.668 válidas» | `AulasSerieDeRendimiento.tsx` | **cerrado** — «encuestas del parte contra la meta», bitácora 71 |
| 51 | En un mismo gráfico, la verde es del parte (2.817) y las de sexo de plataforma (2.668) | `AulasSerieDeRendimiento.tsx` | **cerrado** — son dos ramas y la nota sólo cubría una; el respaldo ya declara la suya, bitácora 72 |

**El 8 está bloqueado, no pendiente.** Necesita que se cierre A7 —qué evento
cuenta como «caída»—, y los términos de esa pregunta cambiaron cuando se
descubrió que `FECHA.DE.LLAMADA` registra cuándo el contacto tuvo éxito, no
cuándo se intentó. Preguntarlo antes de eso sería hacer decidir dos veces.

## Lo que el simulacro ya pagó

Tres defectos, y los tres sólo aparecen cuando el campo va mal:

1. **Mío, y la app lo cazó bien**: el `collectorID` llevaba el código operativo
   en vez del `classroom_id`, y la pantalla dijo «las respuestas llegan sin
   identificar su curso-horario». Nombró la causa en vez de mostrar un cero.
2. **Del producto**: el rótulo de Válidas decía «curso-horario» midiendo celdas
   sexo × facultad. Corregido en `cab2311d`.
3. **Del fixture, con pregunta abierta**: `.maac_sexo_key()` acepta etiquetas
   pero no los códigos del XLSForm. Es el ítem 10.

## Los tres escenarios

Mismo ritmo, misma fecha de corte, sólo cambia el rendimiento — así cualquier
diferencia entre las tres pantallas es del rendimiento y de nada más. Los
factores no son castigos inventados: son dos formas en que 2025 ya rindió.

| escenario | factor | origen | respuestas | por aula |
|---|---|---|---|---|
| como 2025 | 1,00 | la mediana | 2 817 | 18,5 |
| campo flojo | 0,73 | su p25 | 2 127 | 14,0 |
| campo malo | 0,52 | su p10 | 1 595 | 10,5 |


## Correcciones a la lista, con su evidencia

**El 5 estaba mal planteado y la culpa es de cómo lo medí.** Dije «las τ no
aparecen en absoluto» habiendo medido **sólo la pestaña Resumen**. Avance tiene
pestañas propias, y dos son exactamente esto: «Rendimiento — qué rinde más, por
facultad» y «Efectividad — la τ del diseño contra la del campo». Detrás hay
`AulasEfectividadSeguimiento.tsx` consumiendo `tau_observado` y
`facultades_bajo_su_tau`, y `AulasRendimientoPorFacultad.tsx` con encogimiento
hacia la media del estudio (`PESO_DEL_PRIOR`), que es la idea del τ operativo ya
construida. El ítem pasa de «construir» a «verificar qué muestran con el campo
malo y qué les falta» — construir un segundo motor de τ habría sido duplicar lo
que ya funciona.

**El 7 no necesitaba cambio y comprobarlo era el trabajo.** El diseño declara
165 aulas base y el sorteo tiene 174 titulares; la diferencia son +1 a +3 en
seis facultades —el sorteo redondeando hacia arriba para cubrir cuota— y nueve
cuadran exactas. Pero `aulas_base` **no viaja** a monitoreo: `design_targets`
lleva `facultad`, `faculty_key`, `cuota`, `cuota_sexo` y `tau`, sin conteo de
aulas, y `grep` en el frontend de monitoreo no lo encuentra. El lado de
calc-muestra ya publica las dos cifras a propósito y tiene test de contrato. El
165 que preocupó a Gonzalo salió de **mi reporte**, no de la app.

**El 6 sí era un defecto y estaba escondido.** Los dos selectores de la
certificación elegían «el primer componente que publica margen», cada uno por su
cuenta. HSVG2026 tiene dos con margen —2 500 y 4 050— y acertaban por ORDEN.

## Regla que sale de esta tanda

Dos de los diez ítems eran falsas ausencias, y las dos las escribí yo midiendo
la superficie equivocada o el denominador equivocado. Antes de construir, la
pregunta es **dónde vive ya**: `grep` del consumidor, y mirar la pestaña que
lleva el nombre de lo que se busca.


## El 4 y el 5, resueltos revelando en vez de construyendo

La pestaña **Efectividad** ya daba, por facultad: la τ del diseño contra la del
campo con banda (`52,7 % → 26,9 % ± 6 pts`), el veredicto de cierre, cuántos
alumnos van a faltar (`−188`) y cuántas aulas más hacen falta sobre las
disponibles (`14 de 311`). La disponibilidad usa la regla de dos ejes —reserva
dormida **y** no aplicada—, respeta la frontera de facultad, y proyecta las
reservas con la **τ observada**, no la prevista, razonado en el código: proyectar
al supuesto que ya falló diría que el hueco cierra con menos aulas de las que
hacen falta. Y el pie distingue lo que hay que distinguir: responder poco no es
no llegar, porque el diseño compró aulas de más.

Lo que faltaba no era motor. Era que la superficie **tiraba tres cosas que el
backend ya calculaba**:

**Un veredicto con cuatro estados dibujado con tres palabras.** `riesgo_firme`
(«no cierra ni en el mejor escenario del dato») y `riesgo` («la proyección
central no cierra, pero la banda todavía alcanza») salían los dos como «No
cierra». En el campo malo conviven 11 `riesgo_firme` y 1 `riesgo`: Artes
Escénicas con **1** alumno de déficit llevaba la misma insignia roja que Ciencias
e Ingeniería con **188**. Ahora la escalera tiene sus cuatro peldaños —Cubierta ·
Justo · Puede no cerrar · No cierra—, que es lo que dice cuánto correr.

**El caso «no alcanza» se descartaba en silencio.** Cuando activar todo el
respaldo todavía no cierra, la celda caía en `disponibles()`, que lista los
recursos sin decir que no bastan: la fila mostraba «49 en cadena» y quien la
leía entendía que estaba cubierta. Es justo el momento de escalar por encima de
los reemplazos, y era el que la pantalla no nombraba. Ahora dice «no alcanzan
las 49 que quedan: quedarían 120».

**`lectura()` estaba escrita y muerta.** La función que produce la frase de qué
hacer —«4 aulas de su cadena cierran los 59 que faltan»— se definía en la línea
95 y **no se llamaba desde ningún sitio**, ni la esperaba ningún test. Va en la
insignia.

Verificado revirtiendo: los cuatro tests nuevos se ponen rojos sin el arreglo y
verdes con él. 25 pass en el archivo.

**Nota sobre el campo malo**: las 12 facultades en riesgo muestran «hacen falta N
de M», o sea que aun en el escenario p10 **todas pueden cerrar activando
reservas**. Ninguna queda fuera de rescate. Eso responde la preocupación de
fondo: el problema del p10 no es que falten aulas, es que hay que decidir pronto.


## La corrección que ordena todo lo anterior

**Mis «tres huecos» eran un artefacto de haber medido una sola pestaña.** Medí
`avance/resumen` y generalicé a «la app no contesta esto». El perfil de aulas
tiene **cinco secciones y unas dieciocho pestañas**:

| sección | pestañas |
|---|---|
| `modelo` | Agenda · Por facultad · Contacto · Carga |
| `avance` | Resumen · Estratos · Cuotas · Rendimiento · Efectividad · Salidas |
| `calidad` | Registro de campo · Controles · Base de control · Respuestas abiertas |
| `consultas` | **Reemplazos** · Brechas · Parte de campo · Extras |

Las tres cosas que dije que faltaban existen, y una tiene pestaña propia:
`consultas/reemplazos`, «Cadena por curso-horario caído», que en el campo malo
ya publica «Cerraron con reemplazo 3» y «Cadenas sin cerrar 154 · 23 sin una
sola respuesta». Existe además `AulasConsumoDelBanco`, que mide el ritmo de
caídas por día de campo y cuántos días de reserva quedan.

Lo que sí valió fue mirar de cerca las pestañas que ya existían: los tres
descartes silenciosos del veredicto (`d3d47a5f`) y el escenario elegido por orden
(`ce7203b2`) son defectos reales que sólo se ven acercándose, no inventando
superficies nuevas.

**La regla, ya con tres casos**: antes de construir, abrir el catálogo de
navegación y leer los nombres de las pestañas. `frontend/src/lib/navegacion/
catalogos/monitoreo.ts` lista las dieciocho con su descripción de una línea; las
tres falsas ausencias estaban nombradas ahí, en castellano, esperando.

## El ítem 11, recién visto

Al abrir `consultas/reemplazos` la vista se quedó en «Preparando vista · Leyendo
cache local del proyecto…» indefinidamente, con cuatro 500 en la consola. Al
repetir las peticiones a mano, **los cinco scopes devolvieron 200**: el fallo fue
transitorio. Pero `loading` se quedó en `true` para siempre, sin reintento y sin
mostrar el error —el componente TIENE estado de `error` y una rama que lo pinta,
y no se usó—.

Si eso pasa en campo, el coordinador abre Reemplazos en el momento de decidir y
la pantalla se queda cargando sin decir por qué. **Es hipótesis, no hallazgo**:
falta comprobar que el 500 es la causa y no una coincidencia.


## El 10, confirmado contra el instrumento real

Ya no es hipótesis. La hoja `choices` de `Instrumento2026.xlsx` declara:

```
list_name  name   label
sex        1      Mujer
sex        2      Hombre
```

Kobo devuelve el **nombre** de la opción, no la etiqueta. Y el camino está
rastreado entero: para el perfil de aulas `display_data` es el snapshot **crudo**
—`monitoreo_state_cache.R` sólo aplica metadatos de fuente y, fuera de
territorial, pasa `data` tal cual—, así que no hay decodificación en ninguna
parte. En campo real las 30 celdas saldrían a cero, «cuota por recoger» diría
2 500 con 1 500 respuestas ya atribuidas a su aula, y nada fallaría.

**Cerrado**: el cero deja de ser mudo. Cuando la columna existe y ningún valor
resuelve, el aviso nombra la columna y los valores que llegaron. No se adivina
que `1` es mujer —otro estudio puede numerarlo al revés y eso sería inventar el
dato—: se dice la causa para que nadie salga a revisar el enlace del recopilador.

**Abierto, y necesita decisión**: decodificar de verdad. `source_mapping` declara
`classroom_id_var`, `collector_var`, `link_var`, `date_var` y `status_var` —
**no** la del sexo, que se adivina por nombre de columna y se normaliza por
palabras. La decisión es **dónde se declara la equivalencia**; el sitio natural
existe ya: Validación › «Qué es un caso en este estudio», que es donde se declara
quién recolecta.

### Una nota del código que estaba equivocada

`router_monitoreo.R:1132` explica que el instrumento no llega al tablero de aulas
y que arreglarlo exige abrir `monitoreo_aulas_normalize_config`, «y ese archivo
está CONGELADO a crecimiento». **No lo está**: `api/R/monitoreo_aulas_universitarias.R`
no aparece en `policy.frozen_growth_files` de `agentic/manifest.json` ni tiene
línea base. Son 2 339 líneas. El camino para decodificar con el instrumento está
abierto; lo que falta es la decisión, no el permiso.

## La auditoría de congelados está en rojo, y no es de esta tanda

`node agentic/sync-agentic-os.mjs --audit` falla por
`frontend/src/features/calcMuestra/CalcMuestraPage.tsx`: 3 930 líneas contra
3 878 de línea base (+52). Entró en `2f0c825f` desde otra sesión. No se le sube
la línea base a trabajo ajeno; queda dicho para que su autor decida.


## 12 · El registro no es el de un informe de investigación

**Gonzalo, 2026-08-29, y no es la primera vez que lo corrige**: «me preocupa
mucho el lenguaje que utilizas… cuando dices "va a llegar", "al filo", "no
llega". Tienes que ser consciente de que estamos en un contexto académico de
investigación.»

La corrección nace de una propuesta mía —tres tramos «va a llegar / al filo / no
llega»— pero **el problema ya está publicado**, no sólo en lo que propuse. Lo que
`.mac_etiqueta_estado()` emite hoy:

- «Va a llegar, con margen»
- «Va a llegar, sin margen: hay que vigilarla»
- «No va a llegar: faltan 7 encuestas»
- «No va a llegar y ya no quedan aulas: … y habrá que ponderar»

El vocabulario **interno** del motor sí es el correcto y ya existe:
`asegurada`, `ajustada`, `deficit_proyectado`, `deficit_no_subsanable`. Lo que
se degradó es la traducción a pantalla.

Mapeo propuesto, a confirmar por él antes de aplicarlo en bloque —son las frases
más visibles del perfil y se leen en cada celda:

| estado | hoy | propuesto |
|---|---|---|
| `asegurada` | Va a llegar, con margen | Cuota cubierta con margen |
| `ajustada` | Va a llegar, sin margen: hay que vigilarla | Cuota cubierta sin margen |
| `deficit_proyectado` | No va a llegar: faltan 7 encuestas | Déficit proyectado: 7 encuestas |
| `deficit_no_subsanable` | No va a llegar y ya no quedan aulas… habrá que ponderar | Déficit sin reserva disponible: requiere ponderación |
| `sin_cuota` | Sin cuota trazada | Sin cuota asignada |

**No se aplica hasta que él confirme el mapeo.** El registro es suyo, y cambiar
en bloque las frases más leídas del perfil por mi criterio es exactamente lo que
esta corrección señala.
