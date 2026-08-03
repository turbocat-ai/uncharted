import React, { createContext, useState, useEffect, useContext } from 'react';
import { storage } from '../lib_render/storage';
import { initUserDatabase } from '../lib_render/db';
import { fetchRemoteHexes } from '../lib_render/sync';

interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const TOKEN_KEY = 'auth_jwt_token';
const USER_KEY = 'auth_user_data';

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await storage.getItem(TOKEN_KEY);
        const storedUser = await storage.getItem(USER_KEY);

        if (storedToken && storedUser) {
          const parsedUser: User = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);

          // 1. Initialize user-specific SQLite database ({userId}.db)
          await initUserDatabase(parsedUser.id);

          // 2. Hydrate local DB with latest hexes from backend
          fetchRemoteHexes().catch(console.error);
        }
      } catch (error) {
        console.error('Failed to load auth state from storage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredAuth();
  }, []);

  const login = async (newToken: string, newUser: User) => {
    try {
      await storage.setItem(TOKEN_KEY, newToken);
      await storage.setItem(USER_KEY, JSON.stringify(newUser));

      // 1. Initialize DB for new user
      await initUserDatabase(newUser.id);

      setToken(newToken);
      setUser(newUser);

      // 2. Fetch remote hex history
      fetchRemoteHexes().catch(console.error);
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const logout = async () => {
    try {
      await storage.removeItem(TOKEN_KEY);
      await storage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);