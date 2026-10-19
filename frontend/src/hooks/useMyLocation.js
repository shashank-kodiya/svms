import { useCallback, useState } from 'react';

// "Use my location": asks the browser (the person must allow it). The point is kept for this
// browser tab only (sessionStorage), never saved on the server.
const KEY = 'svms.myLocation';

const read = () => {
  try { return JSON.parse(sessionStorage.getItem(KEY)) || null; } catch { return null; }
};
const write = (v) => {
  try { v ? sessionStorage.setItem(KEY, JSON.stringify(v)) : sessionStorage.removeItem(KEY); } catch { /* private window: keep it in memory only */ }
};

export default function useMyLocation() {
  const [loc, setLoc] = useState(read);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');

  const ask = useCallback(() => new Promise((resolve) => {
    setError('');
    if (!('geolocation' in navigator)) {
      setError('This browser cannot share your location.');
      return resolve(null);
    }
    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const v = { lat: Number(pos.coords.latitude.toFixed(5)), lng: Number(pos.coords.longitude.toFixed(5)) };
        write(v);
        setLoc(v);
        setAsking(false);
        resolve(v);
      },
      (err) => {
        setAsking(false);
        setError(err.code === 1
          ? 'Location permission was blocked. Allow it in the address bar, or search without it.'
          : err.code === 3 ? 'Finding your location took too long. Try again.' : 'Could not find your location.');
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }), []);

  const clear = useCallback(() => { write(null); setLoc(null); }, []);

  return { loc, asking, error, ask, clear };
}
