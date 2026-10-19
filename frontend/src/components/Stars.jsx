// Read-only stars, for example "★★★★☆ 4.2 (12)".
export function Stars({ value = 0, count }) {
  const full = Math.round(value);
  return (
    <span className="stars" role="img" aria-label={count === 0 ? 'No reviews yet' : `${value} out of 5 stars${count != null ? `, ${count} reviews` : ''}`}>
      {'★'.repeat(full)}<span className="dim">{'★'.repeat(5 - full)}</span>
      {count != null && <span className="small muted"> {count === 0 ? 'No reviews yet' : `${value.toFixed(1)} (${count})`}</span>}
    </span>
  );
}

// Click to choose 1 to 5 stars.
export function StarInput({ value, onChange }) {
  return (
    <div className="stars big" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= value ? 'on' : ''} onClick={() => onChange(n)}>★</button>
      ))}
    </div>
  );
}
