# ADR 0042: Chrome de módulo uniforme — top bar de secciones + rail de pestañas, pulido macOS-like

Estado: Aceptado

Fecha: 2026-07-24

Reemplaza a: ADR 0041 (Shell v3 con sidebar de navegación unificado)

## Contexto

El 2026-07-23 el dueño decidió migrar la navegación a un sidebar unificado
(ADR 0041); el shell llegó a implementarse detrás de un flag de desarrollo
(`AppSidebar`, `sidebar-v3.css`, `shellV3` en `Layout.tsx`), sin promoverse a
default. El 2026-07-24 el dueño revirtió esa decisión: el concepto vigente del
shell — **top bar superior con las secciones del módulo y sidebar de íconos
(rail icon-compressed) con las pestañas** — «está perfecto y funciona muy bien
a nivel conceptual». El problema real, confirmado por el baseline visual del
2026-07-23, no es el concepto sino su ejecución: cuatro lenguajes de sección
conviven, hay módulos que no usan el chrome o lo usan diferente, y la banda
superior colisiona con KPIs en anchos intermedios.

## Decisión

1. **El chrome de módulo canónico es horizontal**: command bar superior de
   tres zonas (contexto | secciones | acciones; patrón maestro #1 del ADR
   0038), con las secciones como pillbar (patrón #2) y las pestañas de tercer
   nivel en el rail icon-compressed con burbuja hover/foco y título compacto
   de pestaña activa (patrón #3). Los patrones #1–#3 del ADR 0038 quedan
   **re-ratificados** y la v3 los refina en vez de reemplazarlos.
2. **Uniformidad obligatoria**: los 8 módulos adoptan el mismo chrome mediante
   componentes compartidos (`ModuleCommandBar`, `SectionPillbar`, rail
   canónico) alimentados por el manifiesto de navegación. Las variaciones
   (densidad, con/sin numeración, progreso de pipeline) se declaran en el
   manifiesto, nunca ad-hoc en el page-file.
3. **Pulido macOS-like**: material translúcido solo en la capa de navegación,
   alturas/radios/tipografía por token, acento del módulo por variable
   (`--module-accent`), separación estricta navegar (secciones) / operar
   (KPIs, fase, acciones de la command surface) / identidad (proyecto,
   guardado, Home en el header global).
4. **Overflow con dignidad**: la command bar declara su degradación
   (envolver → compactar → menú) y se verifica a 1024×600; los chips de
   estado nunca desaparecen sin alternativa. Esto salda la evidencia de la
   indicación 2 (colisión KPIs↔recorrido, chips perdidos en compacto) dentro
   del concepto top bar.
5. **El gestor de módulos («+») se rediseña como modal** sobre la vista
   actual (nunca navegación que expulsa), con dock completo de 8+ módulos.
6. Sobreviven del trabajo v3: manifiesto de navegación total, tokens de roles
   completos, primitivos (`PulsoButton`, `PulsoDialog`/`PulsoPopover`, empty
   state/spinner únicos), semántica de links con `aria-current` (cero
   `role="tab"` sobre rutas) y la composición cartográfica de las
   indicaciones 3–4.

## Consecuencias

- ADR 0041 pasa a estado **Reemplazado por ADR 0042**; sus criterios de
  cumplimiento útiles (teclado, QA acumulativa, consola limpia, contrato de
  navegación) se heredan aplicados al chrome horizontal.
- El código del shell sidebar tras flag (`AppSidebar.tsx`, `sidebar-v3.css`,
  ramas `shellV3` de `Layout.tsx`) no se promociona; su retiro se ejecuta en
  una oleada de limpieza con confirmación explícita del dueño (regla de
  borrados de la casa).
- `branding/direccion-creativa-v3.md` se re-redacta en su capítulo de shell
  (anatomía horizontal); el resto de la evolución v3 (tokens, voz, motion,
  economía del chrome, cartografía) permanece.
- `docs/plan-revamp-ui-2026-07.md` y el índice del contrato reflejan el nuevo
  foco: programa de uniformidad módulo por módulo (Procesamiento como
  referencia viva → Hojas de ruta → Monitoreo → resto).
- El trabajo v3 de Hojas de ruta se conserva en lo cartográfico (indicaciones
  3–4) y se re-apunta al chrome canónico en lo navegacional.
