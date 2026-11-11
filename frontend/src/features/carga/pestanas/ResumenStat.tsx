export function ResumenStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="pulso-resumen-stat">
      <span>{label}</span>
      <strong>
        {value}
      </strong>
    </div>
  );
}
