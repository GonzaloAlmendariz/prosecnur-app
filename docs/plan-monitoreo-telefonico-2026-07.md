# Plan Monitoreo telefónico — que la operación de llamadas se gobierne desde la pantalla

Rediseño de fondo y superficie del modo Telefónico de Monitoreo (5 secciones · 15 pestañas).

| Campo | Valor |
| --- | --- |
| Versión | 1.0 |
| Fecha | 2026-07-26 |
| Estado | Vigente — **bucle de convergencia**, solo el usuario lo cierra |
| Alcance | `/monitoreo?modo=telefonico` completo: Fuentes, Modelo, Llamadas, Consultas, Avance — sus 15 pestañas — más los contratos R que las alimentan |
| Diagnóstico | Barrido en vivo del 2026-07-26 sobre `api/inst/reference_projects/acnur_pdm/acnur_pdm.pulso` (2.296 casos de base, 13 responsables, 423 efectivas Kobo), warm start completo, 1512×900 y 1280×800, cada sección y cada pestaña recorridas arriba/medio/final midiendo los contenedores de scroll; verificación cruzada contra el código R y TS |
| Normas | `CLAUDE.md` (reglas de la casa) · ADR 0044 (jerarquía y direcciones) · `docs/ui-layout-grammar.md` · `branding/direccion-creativa.md` |
| Hermano | `docs/plan-monitoreo-acreditacion-2026-07.md` — **comparten el mismo archivo** (`TelefonicoMonitoreoPage.tsx`, 21.296 líneas) y la misma causa raíz de fallbacks. Coordinar antes de tocar helpers compartidos |
| Gate | Toda fase termina en el agente `verificador` |

---

## 0. Tesis

El backend ya calcula lo más importante del campo telefónico. La interfaz no lo muestra.

| Bloque que produce el engine R | Qué contiene | Usos en el frontend |
| --- | --- | --- |
| `estatus_responsable` — *"Estados por responsable"* | matriz estado × encuestador, hasta 240 filas | **0** |
| `campo_vs_plataforma_responsable` — *"Barrido vs Kobo por responsable"* | `Efectivas telefónicas · Efectivas Kobo · Conciliadas por CodPulso · Tel. efectiva sin efectiva Kobo · Efectiva Kobo sin tel. efectiva` | **0** |
| `.monitoreo_report_phone_key_conflict_mask` | detecta que el código del **enlace** (`cv_id`) no coincide con el que el encuestador **escribió a mano** | **0** — solo se usa para descontar el caso en silencio |

Las tres son, respectivamente: la lectura de calidad de la base y del equipo, la detección temprana del descuadre plataforma↔Sheets, y la identificación del enlace equivocado. `campo_vs_plataforma_responsable` sí se consume en R — pero **solo para armar el PDF de publicación** (`monitoreo_telefonico.R:1375`). El coordinador ve en el entregable final lo que no pudo ver mientras el campo estaba abierto, que es cuando servía.

Sobre esa base, el módulo comete un segundo error, de marco: presenta **1.665 «por barrer»** como deuda en todas las pantallas, cuando la meta ya está cubierta (423 efectivas contra un mínimo de 400, las 5 sedes por encima del 100 %). La base no se barre al 100 %: llegar al mínimo basta. El resto es **reserva**, y solo se vuelve decisiva cuando hay brecha.

Por eso el orden es: **primero exponer lo que ya existe, después que los números dejen de mentir, después el marco de cumplimiento, y solo al final la superficie.** Pulir sobre denominadores contradictorios sería maquillaje.

---

## 1. El contrato de dominio (lo que la UI debe encarnar)

### 1.1 La meta es un mínimo; el barrido es reserva

La cuota **la define el usuario** y es un mínimo a alcanzar, no un objetivo exacto ni un techo. De ahí tres reglas:

1. **Cubrir el mínimo es un estado terminal limpio**, no una anomalía. Hoy `105,8 %` y `101,9 %` se presentan como si sobrar fuera un error.
2. **«Por barrer» no es el titular.** Es reserva. Baja a segundo plano cuando el mínimo está cubierto.
3. **Cuando hay brecha, la reserva asciende** y con la lectura que decide: *«faltan 37 · quedan 240 en reserva · a la tasa de efectividad actual alcanza»*. Ese cálculo hoy no existe y es justo el único momento en que el dato importa.

Consistente con `[[project-acreditacion-efectivas-minimos]]`: hay clientes y actores que sí quieren barrer todo el universo. El objetivo se **declara**, no se asume — ver §6.

### 1.2 Con cuotas y sin cuotas: una sola forma

Como la cuota es del usuario, la vista tiene que sostenerse igual en los tres casos. **Misma forma, mismo alto, misma jerarquía; cambia el contenido, no el layout:**

| Configuración | Qué ocupa el bloque de cumplimiento | Qué ocupa el bloque de detalle |
| --- | --- | --- |
| Metas por cuota | total arriba, categorías debajo ordenadas por brecha | ritmo por categoría |
| Meta total, sin cuotas | una sola barra | ritmo general, que toma el espacio de las categorías |
| Sin meta declarada | producción y ritmo, sin barra de cumplimiento | reserva y tasa de efectividad |

Regla innegociable: **la ausencia de cuotas no deja cajas vacías ni degrada la pantalla.** Hoy el modelo asume cuotas; por eso Avance › Cuotas se ve bien y el resto se ve a medias.

### 1.3 Los estados telefónicos son un diagnóstico de dos direcciones

Es la información más rica del campo telefónico y se lee en cruz:

- **Hacia abajo (calidad de la base):** concentración de *número no existe · incorrecto · suspendido* en un tramo = la base está mala ahí, no el equipo.
- **Hacia el lado (desempeño):** rechazo muy por encima de la mediana del equipo = trato o guion; *no contesta* muy alto = franja horaria equivocada.

Sin el corte por encuestador **y** el general en la misma pieza, ninguna de las dos lecturas es posible. El dato existe (`estatus_responsable`) y se descarta.

### 1.4 Dos registros de la verdad, y la diferencia importa a tiempo

La plataforma (Kobo/SurveyMonkey) dice una cosa y la base de Sheets dice otra. En `acnur_pdm`: **423 efectivas en plataforma, 222 declaradas en el barrido, 219 cruzadas, 204 con encuesta completa sin estado registrado, 3 al revés.** La aritmética cierra, pero la portada muestra 222 (9,7 %) como KPI de producción: subrepresenta el avance a menos de la mitad.

La diferencia no es un dato de cierre, es una **señal operativa temprana**: significa que alguien está entrevistando sin registrar. Se corrige pidiéndoselo a quien tiene los casos sin marcar, no «al equipo» — por eso el corte por responsable es el que sirve.

### 1.5 El enlace equivocado

Pasa que el encuestador abre el link de otro caso al levantar la encuesta. Entonces el código que viajaba en el enlace y el que se escribe a mano no coinciden, y el cruce contra la base apunta a la persona equivocada.

`.monitoreo_report_phone_key_conflict_mask` (`monitoreo_telefonico.R:108`) ya compara `cv_id` contra `q0034` / *«Código Pulso final»*. Cuando difieren, `monitoreo_engine.R:16333` marca el caso como **no conciliado** y lo descuenta. Nunca lo dice. Parte de los 204 «tel. pendiente» pueden ser conflictos de enlace y hoy es imposible separarlos de los simplemente no registrados.

Hay que distinguir dos familias que hoy están mezcladas:

- **Formato del código** (`PDM1197` vs `PDM 1197`) — cosmético.
- **Código que no cruza, o que cruza contra el caso equivocado** — crítico, es el enlace confundido.

---

## 2. Evidencia verificada

### 2.1 Causa raíz común: fallbacks que cambian el concepto

Mismo patrón que el plan de acreditación. `phoneOperationTotals` (`TelefonicoMonitoreoPage.tsx:5147-5160`) encadena orígenes incompatibles bajo una sola etiqueta:

```ts
const total = phoneSummaryValue(summaryRows, "total telefonico")
  ?? phoneSummaryValue(summaryRows, "total telefónico")
  ?? statusRows.reduce(...)
const effective = effectiveFromResponsible || effectiveFromDaily || statusRows.reduce(...)
const incidents = responsibleRows.reduce(...) || Math.max(0, swept - effective)
```

`effective` puede ser la suma por responsable, la suma diaria **o** la de estados «buenos» según qué bloque llegue primero. Son tres poblaciones distintas con el mismo rótulo. Es la misma clase de defecto que hace que «BASE TEL.» diga 270 y 519 en acreditación.

### 2.2 Denominadores mezclados en la misma grilla

`AcreditacionPhoneStorage` (`:5424-5428`) construye cuatro tarjetas contiguas donde dos usan la base y una usa el barrido:

| Tarjeta | Valor | Denominador |
| --- | --- | --- |
| Barridos | 631 · 27,5 % | base (2.296) |
| Efectivas tel. | 222 · 9,7 % | base |
| Sin efectiva | 409 · 64,8 % | **barrido (631)** |
| Por barrer | 1.665 · 72,5 % | base |

Se leen como comparables y no lo son. Nada en la UI lo advierte.

### 2.3 Alertas: 286 de 299 son la misma línea

`acreditacionQualityAlertGroupKey` (`TelefonicoPhoneAlerts.ts:251-263`) mantiene una lista blanca de tipos agrupables (`sin cruce base`, `respuesta sin llave`, `llave faltante respuesta`, `parcial plataforma`). **`formato codpulso` no está en esa lista**, así que cada código genera su propia alerta. Resultado medido: 299 «observaciones», de las cuales 286 son *«Sugerencia de formato CodPulso»* repetida caso por caso, y el panel arrastra 45.899 px de scroll interno. De ahí salen «3.129 casos impactados» (más que la base) y «Sin responsable 2.394» (1.197 contado dos veces).

### 2.4 Scroll anidado que oculta el contenido

Medido en vivo, alto de caja vs contenido:

| Vista | Contenedor | Contenido | Caja |
| --- | --- | --- | --- |
| Llamadas › Resumen | `mon-phone-responsibles` | 2.539 px | **250 px** — muestra 1 de 13 responsables |
| Llamadas › Sin efectiva | `mon-phone-pending-workbench-list` + **8** `mon-phone-noanswer-list` | 4.905 px + 8× (435–1.127 px) | 554 px + 8×190 px |
| Llamadas › Alertas | `mon-quality-alert-list` | 46.409 px | 510 px |
| Llamadas › Tiempos | `mon-phone-time-cases` | 4.696 px | 450 px |
| Consultas › CodPulso | `mon-query-table-wrap` | 11.228 px | 396 px |

Nueve contenedores anidados en una sola pestaña. La rueda del mouse sobre una card scrollea la lista interna, no la página.

### 2.5 Bugs y etiquetas con causa exacta

1. **«No efectivas» miente** (`:2932`): `nonEffectiveMargin = base.universe - meta`. En SJL, `614 − 107 = 507`. Es capacidad remanente de la base, no un resultado de campo. Etiquetado en `:3275`.
2. **Corte silencioso a 160 filas** (`:765`, `:4838`, `:14315`, `:14633`, `:14969`) contra un KPI que dice 424. La explicación —*«264 casos adicionales quedan en el reporte exportable»*— está al final de 4.246 px de scroll.
3. **«Casos que no contestan» incluye casos con 0 intentos** (PDM1273). Un caso sin intentos no tiene disposición.
4. **`105,8 % Kobo` junto a `Avance 0 meta cubierta`** en la misma fila de Modelo.
5. **El scroll no se resetea al cambiar de pestaña** — medido: `scrollTop` queda en 149/149 al saltar de «Base y barrido» a «Paquete». Se aterriza al pie de la vista nueva.
6. **La banda sticky decapita las cards**: en Llamadas › Sin efectiva y Avance › Cuotas el título de la card se mete bajo la banda y quedan métricas sin dueño.
7. **`Sin hora registrada` en todas las filas visibles** (160 de 423, arriba, al medio y al final) — la hora del intento, variable operativa central del CATI, no llega.
8. **Modelo › Cronograma**: la card «Corte observado» queda pisada por el formulario; lista de días con 410 px dentro de una caja de 178 px.
9. **Fuentes › Paquete repite las otras dos pestañas** y lista una fuente `INACTIVA` que no cuadra con el «3/3» del encabezado.

### 2.6 Oficio y densidad

- Cards de responsable con cada cifra repetida 2–3 veces (`28 efectivas` en título, chip y métrica).
- Consultas: el mismo párrafo en 5 columnas y el código 3 veces por fila.
- Orden por efectivas absolutas: quien exige acción hoy (53 asignados, 4 barridos, 2 efectivas) queda último.
- «Insistencia baja» aplicada a 13 de 13 responsables: no discrimina nada.
- Los 1.197 sin asignar —52 % de la base— reducidos a *«1 fila sin responsable»* al pie de un scroll interno.
- Cuatro nombres para lo mismo: modo *Telefónico*, sección *Llamadas*, panel *Barrido telefónico*, módulo *Monitoreo telefónico*.
- Chips de categoría truncados a `17…` en Modelo.
- `aria-label` del rail con contadores genéricos mal reutilizados («13 pendientes» para 13 responsables).

---

## 3. Fase 1 — Exponer lo que el backend ya calcula

La mayor utilidad por unidad de trabajo. No toca cálculos, no depende del rediseño.

1. **Matriz de estados por encuestador** desde `estatus_responsable`, con la fila del total como referencia y la desviación contra la mediana del equipo marcada visualmente. Se lee en cruz (§1.3). Componente propio, archivo propio.
2. **Plataforma vs Sheets por responsable** desde `campo_vs_plataforma_responsable`: `Efectivas Kobo · Efectivas tel. · Conciliadas · Tel. sin Kobo · Kobo sin tel.`, con la antigüedad de la brecha en días para que sea detección temprana.
3. **Cuadro de conciliación fijo en la portada** — `423 Kobo · 222 barrido · 219 cruzados · 204 pendientes` — hoy sepultado en Consultas › CodPulso.

**Salida esperada:** el coordinador ve en pantalla, durante el campo, lo que hoy solo aparece en el PDF final.

---

## 4. Fase 2 — Que los números dejen de mentir

1. **Prohibir el fallback entre denominadores.** Una métrica, un origen declarado. Donde hoy hay `??`/`||` encadenando poblaciones (`:5147-5160`), la métrica se resuelve desde un origen único y, si falta, se muestra como no disponible en vez de sustituirse por otra cosa.
2. **Un denominador por grilla, declarado en el rótulo.** `% de la base` y `% del barrido` nunca contiguos sin marcar (§2.2).
3. **El KPI de producción pasa a ser 423 (plataforma valida).** Las 222 declaradas se reetiquetan como *completitud del registro*, que es lo que son.
4. **Renombrar «No efectivas»** a lo que calcula: reserva de base sobre el mínimo.
5. **Declarar los cortes.** Cada tabla truncada dice cuánto oculta **arriba**, no al final del scroll.
6. **Corregir «no contestan» con 0 intentos.**

---

## 5. Fase 3 — Cumplimiento como espina dorsal

1. **Componente único de cumplimiento con las tres configuraciones de §1.2.** Misma forma con y sin cuotas.
2. **Embudo telefónico en la portada.** Ya existe, en Avance › Salidas y en letra chica: `2.726 snapshot → −430 fuera del universo → 2.296 procesables → −1.873 sin efectiva → 423 válidas`. Sube a la portada con las mermas nombradas.
3. **Reserva en vez de deuda.** «Por barrer» a segundo plano cuando el mínimo está cubierto; asciende con la lectura de suficiencia cuando hay brecha (§1.1).
4. **Proyección de cierre**: ritmo requerido contra ritmo real, días restantes, fecha estimada. Hoy no hay nada que responda «¿llegamos?».

---

## 6. Fase 4 — El objetivo se declara, no se asume

Alineado con el plan de acreditación: **barrido total** o **mínimo a llegar**, declarado por el usuario, ambas cifras siempre visibles y la declarada como titular. Estado nuevo persistido en `.pulso` con migración aditiva y herencia al reporte. Renombrar «meta» → «mínimo a llegar» donde corresponda.

---

## 7. Fase 5 — El enlace equivocado

1. **Exponer el conflicto de llave** como hallazgo de primera clase: cuántos son, de quién, y el par en conflicto lado a lado (`enlace: PDM1420 · escrito: PDM1042`).
2. **Separarlo de los 204 pendientes**, que hoy lo absorben sin distinguirlo.
3. **Bloque de reporte propio** en el engine, para que viaje al PDF y a Sheets.
4. **Resolución caso por caso** según la decisión pendiente de §9.

---

## 8. Fase 6 — Alertas que son alertas

1. **Agrupar por hecho, no por caso.** Añadir `formato codpulso` a la lista de agrupables (`TelefonicoPhoneAlerts.ts:254-262`). Objetivo medible: de 299 filas a ≤ 10 hechos.
2. **Evaluar si el formato del código debe ser alerta.** Probablemente no: es una convención de escritura, no un desvío operativo.
3. **Eliminar el doble conteo** de «casos impactados» y «dónde revisar primero».
4. **Suprimir las señales que aplican a todos** («Insistencia baja» en 13 de 13).

---

## 9. Fase 7 — Superficie, scroll y léxico

1. **La página scrollea; las cajas no.** Ninguna caja oculta más de una pantalla de contenido: top-N visible más «ver los 13». Elimina los nueve contenedores anidados de §2.4.
2. **Reset de scroll al cambiar de pestaña.**
3. **Offset del sticky** para que no decapite los títulos de card.
4. **Reordenar por urgencia, no por volumen** en responsables.
5. **Un solo nombre visible**: *Telefónico*. El resto en vocabulario de campo: caso, intento, contacto, disposición, cita. «Barrido» queda como término interno de la hoja.
6. **Deduplicar el oficio**: cada cifra una vez por card; Consultas de 5 columnas a las que informan.
7. **Fuentes › Paquete** deja de repetir las otras dos pestañas.
8. **Reconciliar las pestañas declaradas con las visibles**: `monitoreoSectionTabs.ts` declara `resumen · dia · responsables · pendientes · supervision` y la página renderiza `resumen · tiempos · incidencia · responsables · alertas`.
9. **Registrar las pestañas en el manifiesto de navegación**: hoy `window.__pulsoNav.manifiesto` no declara el nivel pestaña para monitoreo, e `ir()` a una pestaña inexistente falla en silencio. Incumple ADR 0044 («toda vista es enlazable»).

---

## 10. Decisiones que necesitan al usuario

1. **Conflicto de enlace: ¿cuál código gana?** ¿El del enlace (el caso que se pretendía llamar) o el escrito a mano (a quien realmente se entrevistó)? El backend no elige: descarta el cruce.
   **Asumido en la vuelta 1 (2026-07-26): reportar, no corregir.** Es la opción conservadora y reversible — el bloque `conflicto_enlace_codpulso` expone el par en conflicto para resolverlo caso por caso, y ninguna cifra de avance cambia por sí sola. Si la respuesta es que uno de los dos códigos debe ganar, se añade la corrección sobre esta base sin deshacer nada.
2. **Hora del intento.** ¿Kobo la trae y no se lee, o la hoja de barrido no la pide? Sin ella no hay ventana horaria ni control de citas. Habilita trabajo posterior, no bloquea nada de este plan.
3. **Objetivo por defecto** cuando el usuario no declara: ¿mínimo o barrido total?

---

## 11. ADRs que este plan necesita

1. **Vocabulario y denominadores del modo telefónico** — caso / intento / contacto / disposición / efectiva / reserva; prohibición de fallback entre denominadores; una métrica, un origen. Puede ser un ADR común con acreditación.
2. **Objetivo declarado (mínimo vs barrido total)** — compartido con el plan de acreditación, estado persistido en `.pulso`.
3. **Conflicto de llave telefónica** — semántica, resolución y persistencia de la decisión.

---

## 12. Gates

Ninguna fase se declara terminada sin evidencia. Mínimo por fase:

- `pnpm --dir frontend typecheck` y `pnpm --dir frontend test` si tocó TS.
- `testthat` focalizado del engine tocado; suite completa antes de cerrar una fase que tocó R.
- Recorrido visual de las pestañas afectadas con `acnur_pdm`, warm start completo, 1512×900 y 1280×800, **arriba/medio/final midiendo los contenedores de scroll** — sin ese barrido, los defectos de §2.4 y §2.5 son invisibles.
- **Chequeo de coherencia numérica**: ninguna métrica homónima difiere entre pestañas de la misma sección.
- **Chequeo de los dos estados de cuota**: cada vista afectada se revisa con cuotas declaradas y sin ellas.
- Agente `verificador` como gate final.

**Restricción de archivo:** `TelefonicoMonitoreoPage.tsx` tiene 21.296 líneas. Toda pieza nueva va en archivo propio que la página llama; el monolito no crece. Coordinar con el plan de acreditación antes de tocar helpers compartidos.

---

## 13. Bitácora de vueltas

### Vuelta 1 — 2026-07-26

Las siete fases aplicadas en una pasada. Evidencia: `tsc -b` limpio, `vitest` 1.768/1.768,
`testthat` telefónico 181/181, recorrido visual sobre `acnur_pdm`.

| Fase | Qué quedó |
| --- | --- |
| 1 | `estatus_responsable` y `campo_vs_plataforma_responsable` consumidos por fin: matriz estado × encuestador con desvío contra la mediana del equipo, panel de brecha plataforma↔barrido ordenado por casos sin registrar, y cuadro de conciliación en la portada. Piezas en `telefonicoTeamModel.ts` + `TelefonicoTeamDiagnostics.tsx` |
| 2 | `phoneOperationTotals` sin fallbacks entre poblaciones; métricas ausentes muestran «—» en vez de sustituirse; las cuatro tarjetas de portada comparten denominador; «No efectivas» pasa a «Reserva»; los cortes se declaran arriba; «no contesta» excluye casos con 0 intentos |
| 3 | `TelefonicoCumplimientoPanel` con las tres configuraciones, embudo desde el contrato de corte, reserva con estimación de suficiencia y proyección de cierre. Piezas en `telefonicoGoalModel.ts` + `TelefonicoGoalPanel.tsx` |
| 4 | Consume el `objetivo` (`barrido` \| `minimo`) que el modo Acreditación añadió al contrato: con barrido declarado la referencia es el universo, no el mínimo |
| 5 | `.monitoreo_report_phone_key_conflict_df` y bloque `conflicto_enlace_codpulso`: el conflicto de enlace deja de descontarse en silencio |
| 6 | `formato codpulso` entra a la lista de agrupables y las alertas derivadas de «sin responsable» se suprimen; la insistencia se califica contra la mediana del equipo |
| 7 | La página scrollea y las cajas no; `scrollResetKey` en el chrome; responsables ordenados por proporción sin trabajar; léxico unificado; Fuentes › Paquete deja de repetir las otras dos pestañas |

**Dos hallazgos de la vuelta:**

1. Al sumar efectivas por tono de estado, `includes("efectiv")` daba por buenas las
   negaciones y «No efectivo / No beneficiario» entraba como efectiva (245 en vez de 222).
   Corregido con `phoneStatusIsEffective`, estricta a propósito: «Contactado por WhatsApp»
   es contacto, no entrevista. El bug lo delató el `aria-label` del rail, no la vista.
2. Devolver el scroll a la página destapó que el resumen es un grid dimensionado a viewport
   que reparte sus filas como `1fr`: cada bloque recibía ~190 px sin importar cuánto midiera
   y el sobrante se pintaba **encima** del vecino. Con el panel recortando por
   `overflow: hidden` el defecto era invisible; al abrirlo, saltó. El resumen pasa a flex
   column con `flex: 0 0 auto`.

Pendiente para la vuelta 2: la hora del intento (§10.2) sigue sin llegar, así que no hay
ventana horaria ni control de citas.

### Vuelta 2 — 2026-07-26 · disposición y lenguaje

Segundo recorrido de las 15 pestañas, esta vez midiendo **recortes** además de scroll. La
vuelta 1 devolvió el scroll a la página pero dejó contenedores intermedios recortando en
silencio, y el lenguaje seguía siendo de ingeniería.

**Recortes que la vuelta 1 no cubrió** (contenedores intermedios con `overflow: hidden` y
altura de viewport, sin barra que delatara que había más):

| Pestaña | Contenedor | Contenido inalcanzable |
| --- | --- | --- |
| Sin efectiva | `mon-phone-ops-card--pending-workbench` | 8.568 px — se veía 1 de 13 responsables |
| Tiempos | `mon-phone-time-control` / `-workbench` | 4.230 px — 161 filas, ~13 visibles |
| Alertas | `mon-quality-alert-panel` | 1.643 px |

**Solapamiento**: la columna lateral de Alertas («Qué se está vigilando») se montaba sobre su
propia lista de responsables al perder la contención.

**Lenguaje reescrito.** La regla: nombrar lo que el coordinador ve, no lo que hace el código.

| Antes | Ahora |
| --- | --- |
| «Señales entrenadas» | «Qué se está vigilando» |
| «424 respuestas completas pasan filtro y no son prueba» | «Las 424 entrevistas completas duraron lo esperado» |
| «supervisión prioritaria» · «revisar saltos y consistencia» | «revisar primero» · «puede faltar respuesta» |
| «Tiempo leído / lectura lista» | *(eliminado: repetía la grilla de abajo)* |
| «Barrido pendiente y fuerza de contacto por responsable» | «Casos por llamar e insistencia, por responsable» |
| «filas agregadas» · «requieren lectura» | «para revisar» · «afectados» |
| «Kobo efectiva; telefono pendiente» | «Falta marcarla en la hoja» |
| «Código codigo:PDM1107» | «Código PDM1107» *(el prefijo venía en el dato)* |

**Disposición.** Cumplimiento por categoría pasó de lista a tabla con una sola cabecera —
repetía «logradas / mínimo / estado» en cada fila. Consultas bajó de cinco columnas a cuatro:
`Estado de la llamada · Qué pasa · Qué hacer` decían lo mismo en cuatro variantes, con faltas
de ortografía («telefono», «revision», «valida», «declaro»). Tiempos dejó de listar 161
entrevistas normales: la tabla es para lo que hay que mirar, y si no hay nada lo dice en una
línea. En las tarjetas de caso el CodPulso salía dos veces (título y subtítulo) junto al
nombre técnico de la fuente en cada fila.

**Hallazgo**: el panel de carga («Actualizando cache local» con fichas «Cache local», «Corte
reportes», «Vista Llamadas») reservaba media pantalla para decir nada. Ahora es una línea.

---

## 14. Loop

Este plan es un **bucle de convergencia**, no una lista que se agota. Cada fase itera auditar → ejecutar → verificar, y el plan entero **solo lo cierra el usuario**. Cada vuelta empieza recorriendo las 15 pestañas con `acnur_pdm` y termina con evidencia, no con una afirmación.
