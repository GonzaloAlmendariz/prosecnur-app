# Checklist — Acreditación: las vistas que aún se ven peor (2026-10-30, 07:3x)

Dictado de Gonzalo con capturas (panel del público en Avance › Por público,
lista de Por cuota, Pulso del campo de Ritmo): «lo que a mí me parece que aún
se ve peor de la UI», más un pedido para Ritmo y uno general. Sigue a
`checklist-monitoreo-acreditacion-contenedores-2026-10-30.md` (K1–K8).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| E1 | Avance › Por público, panel del público: los chips de «Casos de este público» y la curva acumulada en una columna angosta (captura) | `avance/PanelPublico.tsx`, `avance.css` | ☑ 0ca56d1c8: casos en lista agrupada (Esperan decisión, Decididos, Resueltos por regla); curva a 240 px sin vacío; canal único alineado |
| E2 | Avance › Por cuota: la lista de cuotas de la izquierda (captura) | `avance/PorCuota.tsx`, `avance.css` | ☑ cada cuota con el punto de su público y una pista de avance al pie |
| E3 | Avance › Ritmo › «Pulso del campo» (captura) | `avance/Ritmo.tsx`, `avance.css` | ☑ de450e566: Pulso del campo como lista rótulo–cifra; canal único en una fila; última efectiva común dicha una vez |
| E4 | Avance › Ritmo: «botones más elegantes y mejor alineados entre ellos» para intercalar entre el gráfico por público (apilado) y el ritmo diario con el acumulado en dos ejes, «como hacen otros monitoreos» | `avance/Ritmo.tsx`, `graficosDeAvance.tsx`; referencia: Telefónico/territorial (ritmo diario + acumulado) | ☑ 3cc13ff2f: selector «Por público \| Diario y acumulado» alineado con «Por fuente y recopilador»; doble eje con la meta |
| E5 | «En los demás noto aún que le faltan retoques o reconfiguración total sobre cómo se muestran» | todas las vistas | ◐ embudo en una fila (2843deaa8); Por público: «Universo por estado» pasa a «Cómo respondió cada público» (composición de los que respondieron, sin la barra 98 % gris). Siguen: Control › Correo, Modelo › Metas |

## Lo aprendido

- La barra del universo repetía «Del universo» y «Sin respuesta» de la tabla y el gris se comía todo; la tarjeta ahora cuenta lo que la tabla no dice.
- `ui-quick-check` dio ok=true con una captura en blanco a 1440 (la primera vista de la corrida, 6 KB). Mirar el peso de cada PNG antes de leer el ok.
