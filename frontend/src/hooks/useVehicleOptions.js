import { useEffect, useState } from 'react';
import api from '../api/client.js';

let cache = null;

// Brands, types and fuels come from the server so the lists stay in one place.
export default function useVehicleOptions() {
  const [options, setOptions] = useState(cache);
  useEffect(() => {
    if (cache) return;
    api.get('/meta/vehicle-options').then(({ data }) => {
      cache = data;
      setOptions(data);
    }).catch(() => {});
  }, []);
  return options;
}
