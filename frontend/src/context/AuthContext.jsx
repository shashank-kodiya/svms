import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { tokenStore } from '../api/client.js';
import { closeSocket } from '../api/socket.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [center, setCenter] = useState(null);
  const [loading, setLoading] = useState(true);

  // On page load / refresh, restore the session from the saved token.
  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then(({ data }) => {
        setUser(data.user);
        setCenter(data.center);
      })
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const applySession = useCallback((data) => {
    tokenStore.set(data.token);
    setUser(data.user);
    setCenter(data.center);
    return data.user;
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    return applySession(data);
  }, [applySession]);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    return applySession(data);
  }, [applySession]);

  // Pages call this after changing the center profile so the header and dashboard stay current.
  const refreshCenter = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setCenter(data.center);
    return data.center;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    closeSocket();
    setUser(null);
    setCenter(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, center, setCenter, refreshCenter, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const homeFor = (role) =>
  ({ customer: '/customer', service_center: '/center', admin: '/admin' })[role] || '/login';
