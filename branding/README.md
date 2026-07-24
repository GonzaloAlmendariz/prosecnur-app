# Identidad visual de Prosecnur — paquete canónico

Este directorio es la única fuente de verdad de la identidad. Todo lo demás
(CSS de la app, instaladores, PDFs, PPTs) se deriva de aquí.

**Dos capas con estados distintos — no confundirlas:**

| Capa | Documento | Estado |
| --- | --- | --- |
| **Marca** (concepto, isotipo, wordmark, color, tipografía, activos) | [`direccion-creativa.md`](direccion-creativa.md) v1.2 + [`identity.json`](identity.json) | **CONGELADA** (`frozen`, hash verificado) |
| **Shell y convergencia visual** (chrome de módulo, navegación, uniformidad, pulido) | [`direccion-creativa-v3.md`](direccion-creativa-v3.md) v3.1 | **VIGENTE y en ejecución** (modo evolución) |

La v3 **no reabre la marca**: conserva sin redibujo el isotipo, las diez
variantes de `logo/`, la marca de dos tintas y los ocho acentos modulares.
Gobierna desde el 24 de julio de 2026 el shell de la aplicación, donde manda
el ADR 0042 (chrome horizontal: top bar de secciones + rail de pestañas). El
ADR 0041 —sidebar unificado— quedó **reemplazado**; si un documento contradice
a la v3, la precedencia la fija `docs/plan-revamp-ui-2026-07-INDICE.md`.

## Por dónde empezar, según quién eres

| Si eres… | Empieza por |
| --- | --- |
| **Cualquiera** (ver la identidad completa, del logo a las animaciones) | El manual interactivo: [`manual-identidad.html`](manual-identidad.html) (se abre en cualquier navegador) o su Artifact publicado — misma pieza, URL estable |
| **Diseñador** (crear una pieza nueva de la marca) | [`direccion-creativa.md`](direccion-creativa.md) — el contrato normativo de marca — y [`logo/`](logo/) para los SVG (nunca redibujar) |
| **Diseñador o implementador** (tocar el shell, la navegación o uniformar un módulo) | [`direccion-creativa-v3.md`](direccion-creativa-v3.md) + ADR 0042 · maquetas de referencia en [`v3/shell-territories.html`](v3/shell-territories.html) |
| **Implementador** (tocar UI de la app) | Los tokens `--pulso-*` de `frontend/src/app/theme.css` (fuente operativa) + el capítulo 05/06 del manual + los patrones maestros #1–#3 (re-ratificados por la v3) |
| **Quien audita lo que la app dibuja hoy** | [`catalogo-visual/`](catalogo-visual/) — snapshot auditable generado del frontend real, con procedencia módulo → sección → pestaña |
| **Otro agente / otro chat** (continuar el rebranding) | [`plan-rebranding.md`](plan-rebranding.md) — backlog con estado y **protocolo de ejecución completo** |
| **Herramientas** (generar derivados) | [`identity.json`](identity.json) (manifiesto congelado) + `node identity/generate.mjs` |

## Mapa del paquete

```
branding/
├── README.md                 ← este índice
├── direccion-creativa.md     ← EL CONTRATO DE MARCA (v1.2): concepto, marca, color,
│                                tipografía, espaciado, patrones maestros, motion, voz
├── direccion-creativa-v3.md  ← LA DIRECCIÓN VIGENTE DEL SHELL (v3.1): anatomía del
│                                chrome horizontal, tokens v3, uniformidad de los 8
│                                módulos, composición, tema oscuro, gobierno por revisión
├── v3/
│   └── shell-territories.html   maquetas de los territorios evaluados (A vigente, B y C
│                                históricos) — referencia visual, no normativa
├── manual-identidad.html     ← manual interactivo de 11 capítulos (espejo del Artifact)
├── identity.json             ← manifiesto canónico CONGELADO (App Identity OS):
│                                hash, gates humanos, decisiones registradas
├── identity/                 ← derivados COMPILADOS (no editar a mano):
│   ├── tokens.css               172 tokens --prosecnur-* generados del manifiesto
│   ├── identity-reference.html  referencia técnica autocontenida
│   ├── generation-manifest.json sha256 de entradas/salidas
│   ├── generate.mjs             compilador (valida y se rehúsa si no está frozen)
│   └── validate-identity.mjs    validador (13 invariantes)
├── catalogo-visual/          ← catálogo GENERADO de la UI real (ver su propio README):
│   ├── data/                    snapshot auditable + transporte comprimido
│   └── docs/                    índice humano curado por módulo · sección · pestaña
├── logo/                     ← suite de producción: 10 SVG + preview.html (contact sheet)
├── tokens/
│   └── prosecnur-brand.css      espejo manual --prosecnur-* para piezas fuera de la app
└── plan-rebranding.md        ← backlog de aplicación por oleadas + protocolo handoff
```

`catalogo-visual/` describe **lo que la app dibuja hoy**; el resto del paquete
prescribe **lo que debe dibujar**. No sustituye a la dirección ni a los tokens.

## Reglas de oro del paquete

1. **La dirección manda**: una pieza de marca se revisa contra
   `direccion-creativa.md`; una pieza de shell, chrome o navegación se revisa
   contra `direccion-creativa-v3.md`. Si contradice, se reabre la dirección
   correspondiente (con gate humano), nunca se improvisa.
2. **El manifiesto es frozen**: cambios de identidad exigen recomputar el hash
   (método documentado en sus `extensions`) y re-validar
   (`node identity/validate-identity.mjs identity.json`).
3. **Derivados solo generados**: `identity/` se regenera con `generate.mjs`
   (determinista, doble corrida byte-idéntica); no se edita a mano.
4. **El manual vive en doble destino**: Artifact (republicar en la misma URL
   con etiqueta de versión) + esta copia versionada. Se republica cuando
   cambian NORMAS, no píxeles.
5. **Los logos no se redibujan**: toda reproducción parte de `logo/*.svg`
   (geometría congelada: squircle rx 24%, pastillas 7×{18,26,20,32}).
6. **El catálogo se regenera, no se edita**: `node scripts/build-visual-catalog.mjs`
   y su `--check` exigen paridad byte a byte. Si el snapshot no calza con el
   frontend, se corrige el generador; nunca el derivado.

## Contexto de gobierno

- Decisiones de arquitectura: `docs/adrs/0038-identidad-visual-v1-1.md` (marca
  e identidad v1.1/v1.2) y `docs/adrs/0042-chrome-modulo-uniforme-topbar.md`
  (shell canónico vigente, que reemplaza al ADR 0041).
- Contrato de layout que la v3 respeta: `docs/ui-layout-grammar.md`
  (PageFrame, breakpoints, No Scroll Jail).
- El taste macOS-like de la casa está destilado como capacidad reusable en el
  App Identity OS (`~/.claude/skills/create-app-identity/references/macos-taste-baseline.md`
  y hermanos): identidades del mismo nivel para cualquier app React nueva.
- Emisor: PULSO PUCP · Producto: Prosecnur · Concepto: «La señal ordenada».
