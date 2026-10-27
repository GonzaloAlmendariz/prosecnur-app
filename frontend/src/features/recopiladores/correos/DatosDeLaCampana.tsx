import { useId, useState } from "react";

import type { MailConstant, MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { Plus, Trash2 } from "../../../vendor/lucide-react";
import { conConstantes, MAX_CONSTANTES, nuevaConstante, usosDeConstante } from "./modeloConstantes";
import "./correosPersonas.css";

type Props = {
  template: MailTemplate;
  onEditar: (update: (t: MailTemplate) => MailTemplate) => void;
};

/**
 * Datos fijos de la campaña (L6): valen lo mismo para toda la campaña y se usan
 * como un campo. Al duplicar la campaña para otro público, se cambian aquí.
 */
export function DatosDeLaCampana({ template, onEditar }: Props) {
  const id = useId();
  const [nuevo, setNuevo] = useState("");
  const datos = template.constants ?? [];
  const cambiar = (i: number, patch: Partial<MailConstant>) =>
    onEditar((t) => conConstantes(t, (t.constants ?? []).map((c, j) => (j === i ? { ...c, ...patch } : c))));
  const quitar = (i: number) => onEditar((t) => conConstantes(t, (t.constants ?? []).filter((_, j) => j !== i)));
  const agregar = () => {
    if (!nuevo.trim()) return;
    onEditar((t) => conConstantes(t, [...(t.constants ?? []), nuevaConstante(nuevo, t)]));
    setNuevo("");
  };

  return (
    <section className="rec-variables rec-datos-campana" aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`} className="rec-variables-titulo">Datos de la campaña</h3>
      <p className="rec-variables-intro">Iguales para toda la campaña. Se insertan como un campo.</p>
      {datos.length ? (
        <ul className="rec-datos-campana-lista">
          {datos.map((c, i) => {
            const usos = usosDeConstante(template, c.key);
            return (
              <li key={c.key} className="rec-datos-campana-fila">
                <input
                  className="rec-mail-input rec-mail-input--sm"
                  aria-label={`Nombre del dato ${c.label}`}
                  value={c.label}
                  onChange={(e) => cambiar(i, { label: e.target.value })}
                />
                <input
                  className="rec-mail-input rec-mail-input--sm"
                  aria-label={`Valor de ${c.label}`}
                  aria-invalid={!c.value.trim() || undefined}
                  placeholder="Valor"
                  value={c.value}
                  onChange={(e) => cambiar(i, { value: e.target.value })}
                />
                <span className="rec-datos-campana-usos">{usos ? `${usos} ${usos === 1 ? "uso" : "usos"}` : "Sin usar"}</span>
                <PulsoButton variant="icon" size="sm" aria-label={`Quitar ${c.label}`} title="Quitar" onClick={() => quitar(i)}>
                  <Trash2 size={13} aria-hidden />
                </PulsoButton>
              </li>
            );
          })}
        </ul>
      ) : null}
      {datos.length < MAX_CONSTANTES ? (
        <form className="rec-mail-nuevo-campo" onSubmit={(e) => { e.preventDefault(); agregar(); }}>
          <input
            className="rec-mail-input rec-mail-input--sm"
            aria-label="Nombre del dato nuevo"
            placeholder="Dato nuevo (p. ej. Premios)"
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
          />
          <PulsoButton variant="secondary" size="sm" type="submit" disabled={!nuevo.trim()}>
            <Plus size={14} aria-hidden /> Agregar
          </PulsoButton>
        </form>
      ) : null}
    </section>
  );
}
