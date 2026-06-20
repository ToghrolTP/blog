import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { LoginModal } from '../components/LoginModal';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  loginWithGithub: () => void;
  loginWithPassword: (email: string, password: string) => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        setUser(await res.json());
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error(e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = () => {
    setIsModalOpen(true);
  };

  const loginWithGithub = () => {
    window.location.href = '/api/auth/github';
  };

  const loginWithPassword = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        setUser(await res.json());
        window.dispatchEvent(new Event('auth-change'));
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.dispatchEvent(new Event('auth-change'));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, loginWithGithub, loginWithPassword }}>
      {children}
      <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
