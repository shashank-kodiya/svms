import { useEffect } from 'react';

// Full-screen photo viewer. photos: [{ url, caption?, credit? }]. index: the photo shown, or null when closed.
// Arrow keys move between photos and Esc closes.
export default function Lightbox({ photos, index, onChange, onClose, title }) {
  const count = photos?.length || 0;

  useEffect(() => {
    if (index === null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onChange((index + 1) % count);
      if (e.key === 'ArrowLeft') onChange((index - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, onChange, onClose]);

  if (index === null || !count) return null;
  const p = photos[index];
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`${title} photos`} onClick={stop(onClose)}>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={p.url} alt={p.caption || title} />
        <figcaption>
          <span><b>{title}</b>{p.caption ? ` · ${p.caption}` : ''}{p.credit ? <span className="muted"> · {p.credit}</span> : null}</span>
          <span className="muted">{index + 1} / {count}</span>
        </figcaption>
      </figure>
      {count > 1 && (
        <>
          <button type="button" className="lightbox__nav prev" aria-label="Previous photo" onClick={stop(() => onChange((index - 1 + count) % count))}>‹</button>
          <button type="button" className="lightbox__nav next" aria-label="Next photo" onClick={stop(() => onChange((index + 1) % count))}>›</button>
        </>
      )}
      <button type="button" className="lightbox__close" aria-label="Close" onClick={stop(onClose)}>×</button>
    </div>
  );
}
