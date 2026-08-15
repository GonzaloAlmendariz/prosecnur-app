# El script y el informe deben quedar claros y reproducibles, sin exponer el caso

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

**Estado**: pendiente · es el hueco real

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

**Salvedad de la medición**: el PDF se generó sin reejecutar los criterios
personalizados en esa sesión, así que conviene repetirla antes de implementar
para separar lo que falta de lo que no se recalculó. Lo que sí es seguro es que
las decisiones de limpieza estaban en el proyecto —la base ya tenía 101 casos— y
la sección igual salió vacía.

---

## 3 · El plan de validación no sobrevive al `.pulso`

**Estado**: pendiente · fricción diaria

Abrir `ACNUR_V3_final.pulso` y pedir el informe devuelve:

```
E_NO_PLAN — "Primero construye el plan de validacion."
```

Hay que reconstruir el plan (442 reglas) y repetir la auditoría antes de generar
el informe, aunque el proyecto ya pasó por validación completa y tiene sus
decisiones tomadas. Para quien reabre un proyecto cerrado y solo quiere el PDF
para adjuntarlo, son dos pasos que devuelven lo ya calculado.

**A decidir**: persistir el plan en el `.pulso` —con su costo de tamaño y de
invalidación cuando cambia el instrumento— o que el informe lo reconstruya solo
en vez de exigírselo al usuario.

---

## Resumen

| | Estado |
|---|---|
| Script R reproduce la base exacta | ✅ funciona |
| Script R con el nivel de detalle correcto | ✅ no tocar |
| PDF con los conteos de la ficha | ❌ sección vacía |
| PDF sin detalle de casos ni motivos | ✅ así debe quedar |
| Informe disponible al reabrir el proyecto | ❌ exige reconstruir el plan |

El trabajo pendiente es más chico de lo que parecía: **poblar tres números en el
informe** y **decidir qué pasa con el plan al reabrir**. El script no necesita
nada.
