const KIND = { before: ['warn', 'Before'], after: ['good', 'After'], other: ['', 'Photo'] };

export default function PhotoGrid({ photos, onDelete }) {
  if (!photos?.length) return null;
  return (
    <div className="photos">
      {photos.map((p) => (
        <figure key={p._id}>
          <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.caption || KIND[p.kind]?.[1]} loading="lazy" /></a>
          <figcaption>
            <span className={`chip ${KIND[p.kind]?.[0] || ''}`}>{KIND[p.kind]?.[1] || 'Photo'}</span> {p.caption}
            {onDelete && <button type="button" className="btn ghost sm" onClick={() => onDelete(p._id)}>Remove</button>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
