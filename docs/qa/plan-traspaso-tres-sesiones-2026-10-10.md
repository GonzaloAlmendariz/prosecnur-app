# Plan de traspaso: calidad primero y dos metas en sesiones separadas

Tipo: Plan de trabajo
Estado: Vigente
Fecha: 2026-10-10
Autoridad: pedido textual de Gonzalo (2026-10-10 ~22:05), que define el orden y el reparto de este documento.

## 1. Lo que pidió Gonzalo

> «este encargo debería tener dos metas a largo plazo principales, primero arreglar el CI y la calidad y luego las dos
> metas: la primera meta es finalizar el editor y todo lo pendiente en el módulo de Procesamiento con respecto a la sección
> Gráficos —aún hay mucho pendiente— y el otro goal es el revamp visual completo [de la sesión «Evaluación completa de
> UI»], que ha estado trabajando y documentando. Son los elementos que creo que cada uno merece su propia sesión y agentes
> independientes.»

## 2. Orden y reparto

| Fase | Qué cierra | Sesión | Documento rector | Puede empezar |
|---|---|---|---|---|
| **0. CI y calidad** | Quality en verde en `main` y la regla de mantenerlo verde | Sesión «Calidad» (corta) | [goal-ci-calidad-2026-10-10.md](goal-ci-calidad-2026-10-10.md) | Ya |
| **A. Gráficos** | El editor nuevo de Gráficos (F6.1–F6.5) y todo lo pendiente de Procesamiento › Gráficos, motor incluido | Sesión «Gráficos» | [encargo-loop-f6-2026-10-10.md](encargo-loop-f6-2026-10-10.md) | Cuando la Fase 0 deje Quality verde |
| **B. Revamp visual** | La remasterización completa de la UI (kit primero, luego las páginas) | Sesión «Revamp visual» | [encargo-loop-revamp-visual-2026-10-10.md](encargo-loop-revamp-visual-2026-10-10.md) (abre aquí), y como rectores [goal-modernizacion-ui-2026-10-10.md](goal-modernizacion-ui-2026-10-10.md), [plan-trabajo-remasterizacion-ui-2026-10-10.md](plan-trabajo-remasterizacion-ui-2026-10-10.md), [remasterizacion-ui-2026-10-10.md](remasterizacion-ui-2026-10-10.md) | Cuando la Fase 0 deje Quality verde |

A y B corren **en paralelo**, cada una con su sesión, su reloj, sus agentes y su propia rama. Ninguna sesión ejecuta
trabajo de la otra.

## 3. Cómo se integran sin pisarse

- **Ramas.** La Fase 0 trabaja sobre `main`. A y B trabajan cada una en su rama (`meta-a-graficos`, `meta-b-revamp`) y
  entran a `main` por PR con Quality verde en el SHA del PR. Antes de abrir el PR, cada rama trae `main` y vuelve a pasar su
  gate. Un PR rojo no se fusiona «para ver».
- **Dueños de archivos.**

  | Zona | Dueño | La otra sesión |
  |---|---|---|
  | `frontend/src/features/graficos/**` | A | No la toca; propone el cambio por escrito a A |
  | Motor: `api/R/graficos_*`, `lamina_*`, `reporte_plan_*`, `reporte_word_*`, `plantilla_*`, `api/inst/plantillas/`, `api/inst/recetario/`, `docs/qa/motor-ppt-2026-10-06/` | A | No la toca |
  | Kit compartido: `frontend/src/components/**`, `frontend/src/app/theme.css`, tokens e identidad (`branding/`) | B | A lo adopta cuando B lo publica; si A necesita un primitivo nuevo, lo pide a B |
  | El resto de `frontend/src/features/**` y sus páginas | B | No la toca |
  | `frontend/src/features/graficos/GraficosPage.tsx` (unidad L17 de B: `PageFrame` con `layout`/`scrollOwner`, sin `toolbar=`) | A, con el cambio de B | B entrega el cambio a A, o lo hace con aviso previo y A revisa |
  | Sistema de movimiento (unidad L37 de B) | B define los tokens globales | A migra sus `--motion-*` de `laminas/movimiento.css` a esos tokens cuando B los congele |
  | `frontend/src/lib/modules.ts`, `App.tsx` | Quien lo necesite, con aviso a la otra | — |

- **Coordinación.** Cada sesión deja escrito en su documento rector lo que necesita de la otra («pedidos a A», «pedidos
  a B»). Nada se coordina solo en la conversación.
- **Calidad continua.** Desde que la Fase 0 cierra, ninguna sesión fusiona a `main` con Quality rojo, y cada unidad cierra
  con verificador independiente.

## 4. Reglas comunes

- El reloj de cada loop es una tarea de fondo `sleep 180`, la cadencia que eligió Gonzalo; el encargo de cada sesión
  explica cómo se rearma.
- Máximo tres trabajadores y dos escritores por oleada; todo cierra con `verificador`.
- `api/R/reporte_plan_ppt.R` y `tokens.css` están congelados a crecimiento (`node agentic/sync-agentic-os.mjs --audit`).
- Commits solo por nombre de archivo; nada de datos de cliente; el `.pptx` «recetario-moderna - Repaired» no se usa ni se
  versiona.
- Construir no autoriza a etiquetar ni a publicar un release: eso lo pide Gonzalo.
