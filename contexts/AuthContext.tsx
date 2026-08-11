import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for active session on mount
    const storedSession = localStorage.getItem('booksum_active_session');
    if (storedSession) {
      try {
        const sessionUser = JSON.parse(storedSession);
        setUser(sessionUser);
      } catch (e) {
        localStorage.removeItem('booksum_active_session');
      }
    }
    setIsLoading(false);
  }, []);

  const getUsers = (): any[] => {
    const users = localStorage.getItem('booksum_db_users');
    return users ? JSON.parse(users) : [];
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    // Simulate network delay for realism
    await new Promise(resolve => setTimeout(resolve, 800));

    const users = getUsers();
    const normalizedEmail = email.trim().toLowerCase();
    
    // Robust comparison: check whitespace-trimmed and lowercased email, and exact password
    const foundUser = users.find(u => 
      u.email.trim().toLowerCase() === normalizedEmail && 
      u.password === password
    );

    if (foundUser) {
      const userObj: User = {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        photoUrl: foundUser.photoUrl
      };
      setUser(userObj);
      localStorage.setItem('booksum_active_session', JSON.stringify(userObj));
    } else {
      setError("Invalid email or password.");
    }
    setIsLoading(false);
  };

  const signup = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    await new Promise(resolve => setTimeout(resolve, 800));

    const users = getUsers();
    const normalizedEmail = email.trim().toLowerCase();
    
    if (users.some(u => u.email.trim().toLowerCase() === normalizedEmail)) {
      setError("An account with this email already exists.");
      setIsLoading(false);
      return;
    }

    const newUser = {
      id: 'user_' + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      email: email.trim(),
      password, // In a real app, never store passwords in plain text!
      photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=f97316&color=fff&bold=true`
    };

    const updatedUsers = [...users, newUser];
    localStorage.setItem('booksum_db_users', JSON.stringify(updatedUsers));

    const userObj: User = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      photoUrl: newUser.photoUrl
    };

    setUser(userObj);
    localStorage.setItem('booksum_active_session', JSON.stringify(userObj));
    setIsLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('booksum_active_session');
    setUser(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, error, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};