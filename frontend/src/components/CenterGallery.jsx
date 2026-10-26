import { useState } from 'react';
import Lightbox from './Lightbox.jsx';

// A center's showroom photos, like a Google business listing: the cover photo large, a few more beside it,
// and "+N" for the rest. Click any photo to open the full-size viewer.
export default function CenterGallery({ photos, name, max = 4, className = '' }) {
  const [open, setOpen] = useState(null); // index of the photo being viewed
  const count = photos?.length || 0;
  if (!count) return null;
  const shown = photos.slice(0, max);
  const view = (i) => (e) => { e.stopPropagation(); setOpen(i); };

  return (
    <>
      <div className={`center-gallery n${shown.length} ${className}`}>
        {shown.map((p, i) => (
          <button key={p._id || p.url} type="button" className="center-gallery__tile" onClick={view(i)} aria-label={`View photo ${i + 1} of ${name}`}>
            <img src={p.url} alt={p.caption || `${name} photo ${i + 1}`} loading="lazy" />
            {i === shown.length - 1 && count > shown.length && <span className="center-gallery__more">+{count - shown.length}</span>}
          </button>
        ))}
      </div>
      <Lightbox photos={photos} index={open} onChange={setOpen} onClose={() => setOpen(null)} title={name} />
    </>
  );
}
