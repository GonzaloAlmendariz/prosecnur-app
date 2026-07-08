// =============================================================================
// helpers/TechTerm.tsx — término técnico XLSForm entre paréntesis, gris suave
// =============================================================================
// La UI del editor habla en español para usuarios no técnicos; el nombre real
// del campo XLSForm acompaña entre paréntesis para que el usuario experto sepa
// a qué columna/hoja se refiere. Los paréntesis los pone el CSS (::before y
// ::after de .pulso-xf-tech) para que no se dupliquen al copiar microcopy.
//
//   <label>Condición para mostrarse <TechTerm t="relevant" /></label>
// =============================================================================

export function TechTerm({ t, title }: { t: string; title?: string }) {
  return (
    <span className="pulso-xf-tech" title={title ?? `Columna XLSForm: ${t}`}>
      {t}
    </span>
  );
}

export default TechTerm;
