interface TrafficLimitChartProps {
  label: string;
  type?: string;
  percentage: number;
  usedLabel: string;
  limitLabel: string;
}

export const TrafficLimitChart = ({
  label,
  type,
  percentage,
  usedLabel,
  limitLabel,
}: TrafficLimitChartProps) => {
  const clamped = Math.min(Math.max(percentage, 0), 100);

  return (
    <div className="node-detail-traffic">
      <div className="node-detail-traffic-head">
        <span className="node-detail-row-label">{label}</span>
        {type ? <span className="node-detail-traffic-type">{type}</span> : null}
      </div>
      <div
        className="node-detail-traffic-bar"
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${clamped}%` }} />
      </div>
      <div className="node-detail-traffic-meta">
        <span>{usedLabel}</span>
        <span>{limitLabel}</span>
        <span>{clamped.toFixed(1)}%</span>
      </div>
    </div>
  );
};
