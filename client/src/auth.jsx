import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { adminAuthApi } from './api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    adminAuthApi.session()
      .then((session) => { if (active) setUser(session.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    const onExpired = () => setUser(null);
    window.addEventListener('admin-session-expired', onExpired);
    return () => {
      active = false;
      window.removeEventListener('admin-session-expired', onExpired);
    };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login: async (username, password) => {
      const result = await adminAuthApi.login(username, password);
      setUser(result.user);
      return result.user;
    },
    logout: async () => {
      try {
        await adminAuthApi.logout();
      } finally {
        setUser(null);
      }
    },
  }), [user, loading]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return context;
}
