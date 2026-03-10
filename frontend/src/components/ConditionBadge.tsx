import { getConditionInfo } from '../types';

interface ConditionBadgeProps {
  condition: string;
  size?: 'sm' | 'md';
}

export default function ConditionBadge({ condition, size = 'sm' }: ConditionBadgeProps) {
  const info = getConditionInfo(condition);
  return (
    <span
      className={`condition-badge condition-badge-${size}`}
      style={{ backgroundColor: info.color + '22', color: info.color, borderColor: info.color }}
    >
      {info.value}
    </span>
  );
}
