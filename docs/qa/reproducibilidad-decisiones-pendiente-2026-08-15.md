# El script y el informe deben quedar claros y reproducibles, sin exponer el caso

Tipo: Registro QA fechado
Estado: En curso
Fecha: 2026-08-15
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


**Fecha**: 2026-08-15 · **Medido sobre**: `ACNUR_V3_final.pulso` (PDM Medios de
Vida 2026), 103 casos recibidos, 101 entregados, 2 excluidos ·
**Relación**: [ADR 0076](../adrs/0076-una-base-depurada-se-promueve-no-se-recomienda.md)

Con el ADR 0076 la exclusión decidida en Limpieza llega a la base entregada.
Quedaba comprobar si llega a los dos artefactos que acompañan la entrega: el
script R de replicación y el informe metodológico en PDF. Se verificó generando
ambos sobre el proyecto final.

## El criterio que gobierna esto

**Al cliente no se le da el detalle de las exclusiones.** Ni los casos por su
identificador, ni el motivo que el analista escribió, ni el criterio que los
detectó. Eso es material de trabajo interno y vive en el Excel de decisiones de
limpieza, que se comparte solo si lo piden.

Lo que el cliente sí debe poder ver, porque hace a la calidad del entregable:

- **cuántas encuestas se recibieron y cuántas quedaron**, en agregado;
- que la base **se puede reconstruir** desde el crudo de forma independiente.

Nada más. Un informe que enumera qué encuestas se cayeron y por qué invita a una
discusión caso por caso que no aporta al estudio y desgasta la confianza en el
resto de la base.

---

## 1 · Script R de replicación — está bien como está

**Estado**: sin trabajo pendiente

Reproduce el universo final y filtra el crudo contra él:

```r
# (2) Universo final del estudio: los casos que superaron el control de
#     calidad. Se listan por su identificador de caso (ya presente en el
#     crudo), lo que permite reproducir la base exacta sin exponer nada más.
universo_final <- c("152c05df-…", …)          # 101 identificadores

message(sprintf("Casos en el crudo: %d | Universo final: %d | Fuera del universo final por control de calidad: %d", …))
```

Correrlo sobre el crudo de 103 devuelve exactamente los 101 entregados.

**El nivel de detalle es el correcto y no debe tocarse.** Dice que hubo un
control de calidad y cuántos casos quedaron fuera, sin nombrar a ninguno ni
explicar por qué. Los identificadores que lista son los que **permanecen**, que
es lo mínimo imprescindible para reconstruir la base; los excluidos no aparecen
en ninguna parte. El comentario del propio script ya lo dice: «sin exponer nada
más».

> Una versión anterior de este documento proponía agregar los motivos de
> exclusión como comentario. **Se descarta**: contradice el criterio de arriba.

---

## 2 · Informe metodológico PDF — la sección de conteos sale vacía

**Estado**: ✅ reparado el 2026-08-15 · seguimiento en
[goal-reproducibilidad-entrega-2026-08-15.md](goal-reproducibilidad-entrega-2026-08-15.md)

El informe tiene exactamente la sección que corresponde, y no trae números:

```
Encuestas recibidas
Reclasificadas
Pruebas retiradas
Otras exclusiones
Encuestas incluidas
```

Ninguna con valor. La portada declara `ENCUESTAS INCLUIDAS: -`.

**Qué debería mostrar**, y es justo el nivel agregado que sí corresponde:

```
Encuestas recibidas     103
Otras exclusiones         2
Encuestas incluidas     101
```

Sin identificadores, sin motivos, sin nombrar criterios. El cliente ve que de
103 recolectadas se analizan 101 y que hubo dos exclusiones por control de
calidad. Es lo que cualquier ficha técnica declara y hoy el informe no puede
decir, pese a que el motor tiene el dato: el linaje de la promoción guarda
`n_casos_antes` y `n_casos_despues`.

**Dónde vive**: el armado del informe metodológico · endpoint
`/api/validacion/v2/report/methodology/pdf`.

**Causa**: la ficha colgaba de `universe_filter`, el filtro que separa encuestas
de prueba. Un estudio que no separa pruebas no tenía de dónde sacar los
conteos, aunque hubiera excluido casos: `.validacion_upstream_universe()`
devolvía `NULL` y todas las ramas del informe cuelgan de `applied`.

**Reparado**: el linaje de la promoción (`bases[[x]]$limpieza`) alimenta la
ficha en agregado. Verificado sobre `ACNUR_V3_final.pulso` real —
`total=103 · excluded_cleaning=2 · included=101`— y sobre el PDF renderizado:
portada `ENCUESTAS INCLUIDAS 101` y embudo `103 · 2 · 101`. Cuando no hubo
filtro de pruebas el embudo baja a tres columnas en vez de dibujar dos ceros.
Sin regresión en `acnur_pdm`, que sí tiene filtro: sigue en
`430 · 2 · 1 · 3 · 426`.

---

## 3 · El plan no estaba — pero no porque el `.pulso` no lo guarde

**Estado**: diagnosticado el 2026-08-15 · **la premisa original era falsa**

Abrir `ACNUR_V3_final.pulso` y pedir el informe devuelve:

```
E_NO_PLAN — "Primero construye el plan de validacion."
```

El diagnóstico de que «el plan no sobrevive al `.pulso`» **no se sostiene**: el
plan sí viaja. `api/inst/reference_projects/acnur_acg` reabre con sus 94 reglas
intactas, y `ACNUR MDV AGOSTO SIN LIMPIAR.pulso` (v0.6.3) reabre con plan y
auditoría. `plan_result` se persiste en
`estudio$bases[[b]]$validacion$plan_result` y `.pulso_strip_caches()` no lo toca.

Lo que pasó en el proyecto final es otra cosa, y es peor. Su `state.rds` tiene
el workspace de validación **entero en blanco** —plan, auditoría, reglas custom,
decisiones de limpieza y artefactos— mientras conserva la base promovida
(`n_filas = 101`) y su linaje (`103 → 101`).

El único camino que produce ese estado es `.invalidate_processing_state()`
(`api/R/session_store.R:972`), que reemplaza `bases[[b]]$validacion` por un
scope vacío y **no toca `bases[[b]]$limpieza` ni `data_file_id`**. Se dispara al
recargar el XLSForm o la data de una base (`session_store.R:1136`). Recargar
sólo el instrumento deja exactamente lo observado: la base sigue siendo la
depurada de 101 casos y desaparece todo rastro de por qué.

**El problema real, entonces**: la exclusión sobrevive; su justificación no.
Un proyecto puede quedar diciendo «rige la base depurada, 103 → 101» sin poder
regenerar ni el informe ni el Excel de decisiones que lo explica.

**A decidir** (ver el GOAL): si al invalidar el workspace hay que revertir
también la promoción —porque su justificación ya no existe— o si las decisiones
de limpieza deben sobrevivir a una recarga de instrumento. Las dos son
decisiones de contrato del `.pulso`, no preferencias de implementación.

---

## Resumen

| | Estado |
|---|---|
| Script R reproduce la base exacta | ✅ funciona |
| Script R con el nivel de detalle correcto | ✅ no tocar |
| PDF con los conteos de la ficha | ✅ reparado 2026-08-15 |
| PDF sin detalle de casos ni motivos | ✅ así debe quedar |
| Informe disponible al reabrir el proyecto | ⛔ bloqueado — decisión de contrato |

Los tres números ya están. Lo que queda no es lo que parecía: no es que el plan
no se guarde —se guarda—, sino que **recargar el instrumento borra las
decisiones que justifican una base ya promovida y deja la promoción en pie**.
Eso exige una decisión de contrato, y el seguimiento vive en
[goal-reproducibilidad-entrega-2026-08-15.md](goal-reproducibilidad-entrega-2026-08-15.md).
