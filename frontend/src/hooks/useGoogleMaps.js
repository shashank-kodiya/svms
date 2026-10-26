import { useEffect, useState } from 'react';

// Loads the Google Maps JavaScript API once, only when a page needs a map.
// Needs VITE_GOOGLE_MAPS_KEY in frontend/.env. Without it `enabled` is false and pages show lists only.
const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
export const mapsEnabled = !!KEY;

let loader = null;
const authListeners = new Set();
if (typeof window !== 'undefined') {
  // Google calls this when the key is wrong, not allowed for this address, or the API is not switched on.
  window.gm_authFailure = () => authListeners.forEach((fn) => fn());
}

// Advanced markers need a Map ID. DEMO_MAP_ID works for development; for a live site create one in
// Google Cloud (Maps Management) and put it in VITE_GOOGLE_MAP_ID.
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

// Google's recommended async loading: the script only sets up google.maps.importLibrary, then we load
// the parts the app uses (map, advanced markers, directions).
function load() {
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      if (window.google?.maps?.importLibrary) { resolve(); return; }
      window.__svmsMapsReady = resolve;
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&loading=async&callback=__svmsMapsReady&v=weekly`;
      s.async = true;
      s.onerror = () => { loader = null; reject(new Error('Could not load Google Maps. Check your internet connection.')); };
      document.head.appendChild(s);
    }).then(() => Promise.all(['core', 'maps', 'marker', 'routes'].map((lib) => window.google.maps.importLibrary(lib))))
      .catch((err) => { loader = null; throw err; });
  }
  return loader;
}

export default function useGoogleMaps() {
  const [state, setState] = useState({ ready: !!window.google?.maps?.marker?.AdvancedMarkerElement, error: '' });

  useEffect(() => {
    if (!mapsEnabled) return undefined;
    let alive = true;
    const onAuthFail = () => alive && setState({ ready: false, error: 'Google rejected the map key. Check VITE_GOOGLE_MAPS_KEY, its allowed websites, and that “Maps JavaScript API” is enabled.' });
    authListeners.add(onAuthFail);
    load().then(() => alive && setState((s) => (s.error ? s : { ready: true, error: '' }))).catch((e) => alive && setState({ ready: false, error: e.message }));
    return () => { alive = false; authListeners.delete(onAuthFail); };
  }, []);

  return { enabled: mapsEnabled, ...state };
}
