// Small success / error message under a form.
export default function Notice({ msg }) {
  if (!msg) return null;
  return <div className={`alert ${msg.tone}`} role={msg.tone === 'bad' ? 'alert' : 'status'}>{msg.text}</div>;
}
