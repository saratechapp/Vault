import { Star } from 'lucide-react';

export function StarRating({ value = 0, onChange, size = 20, readOnly = false }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          className={`transition ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
        >
          <Star size={size} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-line-strong'} />
        </button>
      ))}
    </div>
  );
}

export default StarRating;
