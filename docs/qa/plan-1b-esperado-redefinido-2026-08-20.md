# Plan 1b — el esperado redefinido, de punta a punta

Tipo: Plan de trabajo QA
Estado: Vigente
Fecha: 2026-08-20
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


Aprobación conceptual de Gonzalo (2026-08-20, cierre del loop de aulas).
Este plan ejecuta el rediseño completo tras la revisión exhaustiva
(campañas V1–V7 en `validez-cadena-esperado-2026-08-20.md`). El barrido
final del 2025 confirmó que ningún otro criterio medible mueve la
efectividad condicional (bloque horario, día, nivel, fatiga: IC ∋ 1;
tipo/modalidad constantes): **el modelo está completo**.

## 1 · El modelo final

**Escalera de indicadores** (el global 0,53 muere en superficies —
directiva explícita: «misleading»; queda solo en tests como control):

| Indicador | Ecuación | Grano | Uso |
|---|---|---|---|
| Tasa de efectividad de la facultad | medida del histórico (las 6) o derivada de su mix (las 9) | facultad | **dimensionar**: cupos = ceil(cuota ÷ (P25 × tasa_fac)) → **190** |
| Tasa de efectividad del aula | R(tamaño) × F(facultad) | aula | el multiplicador con nombre propio |
| **Efectivas esperadas** | Elegibles × tasa del aula | aula | certificación (Σ por facultad ÷ cuota) y **valor de validez** de Monitoreo |
| Tasa de aplicación | por tipo de docente (0,865 / 0,730 / 0,843 general) | operativa | presupuesto de VISITAS y profundidad de cadena — **nunca multiplica efectivas** (V7: residual condicional ≈ 1) |

**Valores sellables** (todos medidos, con k e IC en el doc de validez):
R por tramo: ≤15→0,809 · 16–25→0,642 · 26–35→0,566 · 36–50→0,500 ·
>50→0,409 (razón de sumas exacta; reproduce el agregado 2025).
F por facultad: C&I 0,972 (k40) · EGC 0,917 (k26) · EGL 0,985 (k23) ·
CCSS 0,960 (k17) · DER 1,115 (k16) · A&D 0,910 (k12); resto 1
(declarado «sin base»). Ejemplo canónico: Prospección = 24 × 0,642 ×
0,972 = **15,0**.

**Dimensionamiento resultante (V5, tasa condicional por facultad)**:
190 cupos — C&I 40 · EGC 30 · EGL 26 · DER 16 · A&D 14 · CCSS 12 ·
ARQ 11 · AE 9 · CyA 8 · GES 7 · PSI 6 · EDU 3 · LyCH 3 · GAS 3 · CONT 2.
Absorbe la corrección del guardián (EGL: 26 = ceil(397/(34,5 × 0,444))
con el P25 verdadero 34,5 — muere el mismatch 22/23).

## 2 · Cambios por capa

**Config (el sello — nada hardcodeado)**: `cfg$efectividad` v2 completa:
`{fuente: "historico", periodo: "2025", rendimiento_tramos: [...los 5
bins...], por_facultad: [...6 residuales con tau, k, suficiencia...],
tasa_aplicacion: [...por tipo de docente...]}`. El motor lee TODO de la
config; las constantes embebidas quedan solo como calibración declarada
para estudios que no sellan nada.

**Motor R** (`calc_muestra_aulas_efectividad.R` + hooks mínimos):
- Anotador: `efectivas_esperadas = E × R × F` (el × P SALE); columnas
  nuevas `tasa_efectividad_aula` (R×F) y `tasa_aplicacion_ref` (renombra
  conceptualmente a p_aplicada_ref: operativa); listas públicas al día.
- Dimensionamiento: el τ de cada estrato pasa a ser la tasa condicional
  de SU facultad (las 6 medidas; las 9 derivadas del mix de su marco).
- Certificación: margen = Σ efectivas esperadas ÷ cuota (muere la línea
  «tasa de asistencia esperada de 53,0 %»).
- Presupuesto de visitas: intentos esperados por facultad = cupos ÷ tasa
  de aplicación media de su marco (aquí SÍ vive el docente).

**Re-cálculo del proyecto**: recalcular estratos (190) → re-sorteo cube
→ certificación nueva → guardar. El reparto cambia: es un SORTEO NUEVO
(no se exige identidad con las 197; se exige reparto = tabla V5 exacta).

**Frontend**: radiografía con la ecuación de 3 pasos (E × R × F) y la
tasa de aplicación mostrada como dato OPERATIVO del aula (aparte, con su
glosa de visitas/cadena); tablas de referencia: tramos + ajuste por
facultad (la de docentes se muda a la tarjeta del Presupuesto de
visitas); el 0,53 desaparece de radiografía, certificación y sustento;
tests de contrato mudados.

**Monitoreo (aviso, 4ª meta del día)**: el valor de validez pasa a la
condicional (sube ~15–37 % según docente — el listón se corrige, no se
regala); campos: `efectivas_esperadas` (ya condicional),
`tasa_efectividad_aula`, `factor_facultad`, `facultad_k`,
`tasa_aplicacion_ref` (operativo), `meta_origen`. Cada reemplazo
activado se juzga contra SU condicional.

## 3 · Orden de ejecución y gates

1. Motor R: config v2 + anotador condicional + tests (suite efectividad,
   con mutantes: sin sello → embebida declarada; tau_global intacto).
2. Dimensionamiento por facultad + test del guardián (EGL 26 con 34,5).
3. `R CMD INSTALL` + relanzar + sellar config v2 + recalcular + re-sortear
   (runner con verificación: reparto == tabla V5 o NO SE GUARDA) + guardar.
4. Frontend: radiografía/certificación/presupuesto + vitest + tsc.
5. Verificación en vivo (radiografía de un aula de cada caso: con
   residual, sin base, y un reemplazo) + screenshots.
6. Aviso a Monitoreo + actualización de checklist y memoria.
Gate global: testthat efectividad + área aulas; vitest calcMuestra +
navegación; guardián del encabezado publica cifras de nuevo (Muestra
objetivo 2.500 visible — hoy dice «resultado inválido»).

## 4 · Lo que queda DESPUÉS de 1b (decisiones abiertas)

- Techo de visitas: con 190 cupos y la tasa de aplicación, intentos
  esperados ≈ 190/0,84 ≈ **226** vs techo declarado 200 — sigue excedido:
  decisión operativa de Gonzalo (subir techo o recortar).
- Certificación: umbral de margen aceptable por facultad (¿1,0? ¿1,1?).
- Motor cube vs local pivotal (re-sorteo es buen momento para decidir).
- ADR «un solo dueño» (8 apariciones de la familia).
- EEE (excluida declarada vs caer visible).
