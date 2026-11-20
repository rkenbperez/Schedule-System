// components/calendar/EventCard.tsx
import { formatCompactTime, modeStyle } from '../../utils/timeMapping';
import type { PublicClass } from '../../types/Types';

interface EventCardProps {
  cls: PublicClass;
  isSingleFilterMode: boolean;
  style?: React.CSSProperties;
}

export function EventCard({ cls, isSingleFilterMode, style }: EventCardProps) {
  const { start_time, end_time, day_name, subject, section, room, professor, mode_display, mode } = cls;
  const styles = modeStyle(mode || mode_display || null);

  return (
    <div
      className={`overflow-hidden rounded-md p-2 cursor-pointer transition-shadow hover:shadow-md ${styles.cardBg} ${styles.cardBorder} ${styles.cardBorderL}`}
      style={style}
      title={`${subject.code} - ${subject.title}\n${section.name} · ${professor.name}\n${room?.name ?? 'Unassigned'} · ${day_name}, ${formatCompactTime(start_time, end_time)}\nMode: ${mode_display ?? '—'}`}
    >
      {/* Header row: Subject Code (bold, color-matched) left + Mode badge pill right */}
      <div className='flex items-baseline justify-between gap-1 mb-0.5 leading-tight'>
        <span className={`font-bold text-[10px] truncate ${styles.titleText}`}>
          {subject.code}
        </span>
        <span
          className={`text-[9px] font-medium normal-case shrink-0 rounded-full px-1.5 py-0.5 ${styles.pillBg} ${styles.pillText} ${styles.pillBorder}`}
        >
          {mode_display ?? '—'}
        </span>
      </div>

      {/* Section · Compact Time */}
      <div className='flex items-center gap-1 leading-tight mb-0.5'>
        <span className='text-[9px] truncate font-medium text-text-primary'>
          {section.name}
        </span>
        <span className='text-[9px] text-text-tertiary'>·</span>
        <span className='text-[9px] truncate text-text-primary' style={{ whiteSpace: 'nowrap' }}>
          {formatCompactTime(start_time, end_time)}
        </span>
      </div>

      {/* Room (+ Professor when single-filter mode) */}
      <div className='flex items-center gap-1 leading-tight'>
        <span className='text-[9px] truncate text-text-secondary'>
          {room?.name ?? 'Unassigned'}
        </span>
        {isSingleFilterMode && professor.name && <span className='text-[9px] text-text-tertiary'>·</span>}
        {isSingleFilterMode && professor.name && (
          <span className='text-[9px] truncate text-text-secondary'>
            {professor.name}
          </span>
        )}
      </div>
    </div>
  );
}
