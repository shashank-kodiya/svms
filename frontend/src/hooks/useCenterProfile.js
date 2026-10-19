import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

let catalogCache = null;

// Loads the logged-in center's profile and the standard service list.
// `save(method, url, body)` calls the API, stores the updated profile and keeps the header in sync.
export default function useCenterProfile() {
  const { setCenter } = useAuth();
  const [center, setLocal] = useState(null);
  const [catalog, setCatalog] = useState(catalogCache);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/center/profile').then(({ data }) => setLocal(data)).catch((e) => setError(errorMessage(e)));
    if (!catalogCache) {
      api.get('/meta/service-catalog').then(({ data }) => {
        catalogCache = data;
        setCatalog(data);
      }).catch(() => {});
    }
  }, []);

  const save = useCallback(async (method, url, body) => {
    const { data } = await api[method](url, body);
    setLocal(data);
    setCenter(data);
    return data;
  }, [setCenter]);

  return { center, catalog, error, save };
}

export const serviceName = (catalog, key) => catalog?.services.find((s) => s.key === key)?.name || key;
