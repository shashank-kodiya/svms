import { DOC_LABELS, docStatus } from '../utils/format.js';

export default function DocChips({ documents = {} }) {
  return (
    <div className="row chips">
      {Object.entries(DOC_LABELS).map(([key, label]) => {
        const s = docStatus(documents?.[key]);
        return <span key={key} className={`chip ${s.tone}`}>{label}: {s.text}</span>;
      })}
    </div>
  );
}
