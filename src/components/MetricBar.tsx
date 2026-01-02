interface MetricBarProps {
  value: number;
  compact?: boolean;
}

const getTone = (val: number) => {
  if (val > 90) return "red";
  if (val > 70) return "orange";
  if (val > 50) return "blue";
  return "green";
};

export const MetricBar = ({ value, compact = false }: MetricBarProps) => {
  const displayValue = Math.max(value, 0);
  const barWidth = Math.min(displayValue, 100);
  const tone = getTone(displayValue);

  return (
    <div className={`node-detail-mini-bar${compact ? " compact" : ""}`}>
      <span style={{ width: `${barWidth}%`, backgroundColor: `var(--${tone}-9)` }} />
    </div>
  );
};
