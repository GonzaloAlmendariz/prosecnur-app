// Tú o usted (GOAL editor, L16): el trato de la campaña escribe cada
// `[[forma de tú|forma de usted]]` del texto. Vive junto a los Datos de la
// campaña porque es lo otro que cambia de un público a otro.

import { useId, useState } from "react";

import type { MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { copiarTexto } from "../../../lib/portapapeles";
import { Copy } from "../../../vendor/lucide-react";
import { Segmented } from "../../xlsformEditor/kit";
import { conRegistro, registroDe, variante, variantesDelCorreo } from "./modeloRegistro";
import "./correosPersonas.css";

type Props = {
  template: MailTemplate;
  onEditar: (update: (t: MailTemplate) => MailTemplate) => void;
};

export function TratoDeLaCampana({ template, onEditar }: Props) {
  const id = useId();
  const registro = registroDe(template);
  const cuantas = variantesDelCorreo(template);
  const [tu, setTu] = useState("");
  const [usted, setUsted] = useState("");
  const [copiada, setCopiada] = useState(false);
  const lista = variante(tu, usted);
  const copiar = async () => {
    try {
      await copiarTexto(lista);
      setCopiada(true);
    } catch {
      setCopiada(false);
    }
  };

  return (
    <section className="rec-variables rec-trato-registro" aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`} className="rec-variables-titulo">Trato</h3>
      <p className="rec-variables-intro">
        Escribe <code className="xfk-mono">[[Responde|Responda]]</code> donde la frase cambia: la campaña usa la forma de su trato.
      </p>
      <Segmented
        aria-label="Trato de la campaña"
        size="sm"
        value={registro}
        options={[{ value: "usted", label: "Usted" }, { value: "tu", label: "Tú" }]}
        onChange={(r) => onEditar((t) => conRegistro(t, r))}
      />
      <p className="rec-trato-registro-cuenta" role="status">
        {cuantas
          ? `${cuantas} ${cuantas === 1 ? "frase cambia" : "frases cambian"} con el trato.`
          : "El correo todavía no tiene frases que cambien con el trato."}
      </p>
      <div className="rec-trato-registro-armar">
        <input
          className="rec-mail-input rec-mail-input--sm"
          aria-label="Forma de tú"
          placeholder="Tú: Responde"
          value={tu}
          onChange={(e) => { setTu(e.target.value); setCopiada(false); }}
        />
        <input
          className="rec-mail-input rec-mail-input--sm"
          aria-label="Forma de usted"
          placeholder="Usted: Responda"
          value={usted}
          onChange={(e) => { setUsted(e.target.value); setCopiada(false); }}
        />
        <PulsoButton variant="secondary" size="sm" disabled={!tu.trim() && !usted.trim()} onClick={() => void copiar()}>
          <Copy size={13} aria-hidden /> {copiada ? "Copiada" : "Copiar"}
        </PulsoButton>
      </div>
      {tu.trim() || usted.trim() ? <span className="xfk-mono rec-trato-registro-lista">{lista}</span> : null}
    </section>
  );
}
