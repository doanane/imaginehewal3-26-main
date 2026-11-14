import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import api, { CaregiverSignupData, clearAuthData, PatientSignupData, saveAuthData } from '../services/api';

interface User {
  id: number | string;
  email: string;
  username?: string;
  full_name?: string;
  user_type: 'patient' | 'caregiver' | 'doctor';
  is_email_verified: boolean;
  profile_image?: string;
  phone_number?: string;
  patient_id?: string;
  caregiver_id?: string;
  is_caregiver?: boolean;
}

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signupPatient: (data: PatientSignupData) => Promise<{ success: boolean; message?: string }>;
  signupCaregiver: (data: CaregiverSignupData) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    
    const rootSegment = segments[0] as string | undefined;
    const inAuthGroup = rootSegment === '(auth)';
    const inOnboarding = rootSegment === 'onboarding' || rootSegment === 'index';
    
    if (!isAuthenticated) {
      if (rootSegment === '(patient)' || rootSegment === '(caregiver)') {
        router.replace('/onboarding');
      }
    } else if (isAuthenticated && user) {
      if (inAuthGroup || inOnboarding || rootSegment === undefined) {
        if (user.user_type === 'caregiver' || user.is_caregiver) {
          router.replace('/(caregiver)/dashboard');
        } else {
          router.replace('/(patient)/home');
        }
      } else {
        if (user.user_type === 'caregiver' && rootSegment !== '(caregiver)') {
          router.replace('/(caregiver)/dashboard');
        } else if (user.user_type === 'patient' && rootSegment !== '(patient)') {
          router.replace('/(patient)/home');
        }
      }
    }
  }, [isAuthenticated, isLoading, segments, user]);

  const persistProfileImage = async (url: string) => {
    if (url) {
      await AsyncStorage.setItem('profile_image', url);
    }
  };

  const fetchUserProfile = async (basicUser: User): Promise<User> => {
    try {
      const profileData = await api.getProfile();
      
      const mergedUser: User = {
        ...basicUser,
        full_name: profileData.full_name || basicUser.full_name,
        username: profileData.username || basicUser.username,
        profile_image: profileData.profile_image_url || basicUser.profile_image,
        patient_id: profileData.patient_id,
        is_caregiver: profileData.is_caregiver || basicUser.is_caregiver,
      };

      try {
        const userInfo = await api.getCurrentUserInfo() as any;
        mergedUser.phone_number = userInfo.phone_number;
        mergedUser.caregiver_id = userInfo.caregiver_id;
        mergedUser.is_caregiver = userInfo.is_caregiver || mergedUser.is_caregiver;
      } catch (error) {
        console.warn('Could not fetch user info:', error);
      }

      if (mergedUser.profile_image) {
        await persistProfileImage(mergedUser.profile_image);
      }

      return mergedUser;
    } catch (error) {
      console.warn('Failed to fetch detailed profile:', error);
      return basicUser;
    }
  };

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      const userData = await api.getCurrentUser();
      
      const basicUser: User = {
        id: userData.id || userData.user_id,
        email: userData.email,
        username: userData.username,
        full_name: userData.full_name,
        user_type: userData.user_type || 'patient',
        is_email_verified: userData.is_email_verified || false,
        profile_image: userData.profile_image,
        phone_number: userData.phone_number,
        patient_id: userData.patient_id,
        caregiver_id: userData.caregiver_id,
      };

      const detailedUser = await fetchUserProfile(basicUser);
      
      setUser(detailedUser);
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error('Auth check failed:', error);
      
      if (error.status === 401) {
        await clearAuthData();
        await AsyncStorage.removeItem('profile_image');
      }
      
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const response = await api.login({ email, password });
      await saveAuthData(response);
      
      const basicUser: User = {
        id: response.user_id,
        email: response.email,
        username: response.username,
        user_type: response.user_type as any,
        is_email_verified: response.is_email_verified,
      };

      const detailedUser = await fetchUserProfile(basicUser);
      
      setUser(detailedUser);
      setIsAuthenticated(true);
      
      return { success: true, message: 'Welcome back!' };
    } catch (error: any) {
      const message = error.message || 'Invalid email or password';
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  };

  const signupPatient = async (data: PatientSignupData) => {
    try {
      setIsLoading(true);
      
      const response = await api.signupPatient(data);
      await saveAuthData(response);
      
      const userInfo: User = {
        id: response.user_id,
        email: response.email,
        username: data.username,
        user_type: 'patient',
        is_email_verified: false,
      };
      
      setUser(userInfo);
      setIsAuthenticated(true);
      
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signupCaregiver = async (data: CaregiverSignupData) => {
    try {
      setIsLoading(true);
      
      const response = await api.signupCaregiver(data);
      await saveAuthData(response);
      
      const userInfo: User = {
        id: response.caregiver_id,
        email: response.email,
        full_name: `${response.first_name} ${response.last_name}`,
        user_type: 'caregiver',
        is_email_verified: true,
      };
      
      setUser(userInfo);
      setIsAuthenticated(true);
      
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout().catch(() => {});
    } finally {
      await clearAuthData();
      await AsyncStorage.removeItem('profile_image');
      
      setUser(null);
      setIsAuthenticated(false);
      
      router.replace('/onboarding');
    }
  };

  const updateUserProfile = async (data: Partial<User>) => {
    if (!user) return;
    
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    
    if (data.profile_image) {
      await persistProfileImage(data.profile_image);
    }
  };

  const refreshUserData = async () => {
    if (!user) return;
    
    try {
      const userData = await api.getCurrentUser();
      const basicUser: User = {
        id: userData.id || userData.user_id,
        email: userData.email,
        username: userData.username,
        full_name: userData.full_name,
        user_type: userData.user_type || 'patient',
        is_email_verified: userData.is_email_verified || false,
        profile_image: userData.profile_image,
        phone_number: userData.phone_number,
        patient_id: userData.patient_id,
        caregiver_id: userData.caregiver_id,
      };

      const detailedUser = await fetchUserProfile(basicUser);
      setUser(detailedUser);
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        user,
        login,
        signupPatient,
        signupCaregiver,
        logout,
        checkAuth,
        updateUserProfile,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};