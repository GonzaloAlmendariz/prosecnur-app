# Identidad visual de Prosecnur — paquete canónico

**v1.2 · julio 2026 · estado: CONGELADA y en aplicación.** Este directorio es
la única fuente de verdad de la identidad. Todo lo demás (CSS de la app,
instaladores, PDFs, PPTs) se deriva de aquí.

## Por dónde empezar, según quién eres

| Si eres… | Empieza por |
| --- | --- |
| **Cualquiera** (ver la identidad completa, del logo a las animaciones) | El manual interactivo: [`manual-identidad.html`](manual-identidad.html) (se abre en cualquier navegador) o su Artifact publicado — misma pieza, URL estable |
| **Diseñador** (crear una pieza nueva de la marca) | [`direccion-creativa.md`](direccion-creativa.md) — el contrato normativo — y [`logo/`](logo/) para los SVG (nunca redibujar) |
| **Implementador** (tocar UI de la app) | Los tokens `--pulso-*` de `frontend/src/app/theme.css` (fuente operativa) + el capítulo 05/06 del manual + los patrones maestros de la dirección |
| **Otro agente / otro chat** (continuar el rebranding) | [`plan-rebranding.md`](plan-rebranding.md) — backlog con estado y **protocolo de ejecución completo** |
| **Herramientas** (generar derivados) | [`identity.json`](identity.json) (manifiesto congelado) + `node identity/generate.mjs` |

## Mapa del paquete

```
branding/
├── README.md              ← este índice
├── direccion-creativa.md  ← EL CONTRATO (v1.2): concepto, marca, color, tipografía,
│                             espaciado, patrones maestros, motion, datos, voz
├── manual-identidad.html  ← manual interactivo de 10 capítulos (espejo del Artifact)
├── identity.json          ← manifiesto canónico CONGELADO (App Identity OS):
│                             hash, gates humanos, decisiones registradas
├── identity/              ← derivados COMPILADOS (no editar a mano):
│   ├── tokens.css             172 tokens --prosecnur-* generados del manifiesto
│   ├── identity-reference.html referencia técnica autocontenida
│   ├── generation-manifest.json sha256 de entradas/salidas
│   ├── generate.mjs           compilador (valida y se rehúsa si no está frozen)
│   └── validate-identity.mjs  validador (13 invariantes)
├── logo/                  ← suite de producción: 10 SVG + preview.html (contact sheet)
├── tokens/
│   └── prosecnur-brand.css    espejo manual --prosecnur-* para piezas fuera de la app
└── plan-rebranding.md     ← backlog de aplicación por oleadas + protocolo handoff
```

## Reglas de oro del paquete

1. **La dirección manda**: cualquier pieza nueva se revisa contra
   `direccion-creativa.md`; si contradice, se reabre la dirección (con gate
   humano), nunca se improvisa.
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

## Contexto de gobierno

- Decisión de arquitectura: `docs/adrs/0038-identidad-visual-v1-1.md`.
- El taste macOS-like de la casa está destilado como capacidad reusable en el
  App Identity OS (`~/.claude/skills/create-app-identity/references/macos-taste-baseline.md`
  y hermanos): identidades del mismo nivel para cualquier app React nueva.
- Emisor: PULSO PUCP · Producto: Prosecnur · Concepto: «La señal ordenada».
