# API Integration Guide for HEWAL3

This document outlines where and how to integrate backend API calls into the HEWAL3 application.

## File Structure

```
hewal3/
├── services/
│   └── api.ts              # Centralized API service (CREATED)
├── .env.local              # Environment variables (CREATE THIS)
└── app/
    ├── (patient)/
    │   ├── signup.tsx      # Needs: signup API
    │   ├── login.tsx       # Needs: login API
    │   ├── verify.tsx      # Needs: verifyOTP API
    │   ├── profile-setup.tsx # Needs: completePatientProfile API
    │   ├── home.tsx        # Needs: getDailyMetrics, getPatientProfile APIs
    │   └── action-menu.tsx # Needs: Multiple APIs (AI, Leaderboard, etc.)
    └── (caregiver)/
        ├── signup.tsx      # Needs: signup API
        ├── login.tsx       # Needs: login API
        ├── verify.tsx      # Needs: verifyOTP, completeCaregiverProfile APIs
        └── caregiver-home.tsx # Needs: getCaregiverPatients, sendPatientRequest APIs
```

---

##  Setup Instructions

### 1. Create Environment File

Create `.env.local` in the project root:

```bash
# Backend API Configuration
EXPO_PUBLIC_API_URL=https://your-backend-api.com/api

# Optional: Authentication tokens
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
EXPO_PUBLIC_APPLE_CLIENT_ID=your-apple-client-id
```

> **Note**: Expo only exposes environment variables prefixed with `EXPO_PUBLIC_`

### 2. Install Additional Dependencies (if needed)

```bash
# For async storage (storing auth tokens)
npm install @react-native-async-storage/async-storage

# For secure token storage (recommended)
npm install expo-secure-store
```

---

## 📝 Integration Points by Screen

### Authentication Screens

#### 1. `(patient)/signup.tsx` & `(caregiver)/signup.tsx`

**Current State**: Form collects data but navigates directly to verify screen

**Integration Needed**:
```typescript
import { signup } from '../../services/api';

// Add state for form data
const [formData, setFormData] = useState({
  firstName: '',
  lastName: '',
  email: '',
  password: ''
});
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');

// Replace the signup button onPress
const handleSignup = async () => {
  try {
    setLoading(true);
    setError('');
    
    const result = await signup({
      ...formData,
      role: 'patient' // or 'caregiver' based on route
    });
    
    // Store user data or token
    // await SecureStore.setItemAsync('userToken', result.token);
    
    router.push('/(patient)/verify');
  } catch (err: any) {
    setError(err.message || 'Signup failed');
  } finally {
    setLoading(false);
  }
};
```

**Files to Update**:
- Line 49: Replace `router.push` with `handleSignup` function call
- Add form state management
- Add error display UI

---

#### 2. `(patient)/login.tsx` & `(caregiver)/login.tsx`

**Current State**: Navigates directly to home on button press

**Integration Needed**:
```typescript
import { login } from '../../services/api';
import * as SecureStore from 'expo-secure-store';

const [credentials, setCredentials] = useState({ email: '', password: '' });
const [loading, setLoading] = useState(false);

const handleLogin = async () => {
  try {
    setLoading(true);
    
    const result = await login({
      ...credentials,
      role: 'patient' // or 'caregiver'
    });
    
    // Store authentication token
    await SecureStore.setItemAsync('userToken', result.token);
    await SecureStore.setItemAsync('userId', result.userId);
    
    router.replace('/(patient)/home');
  } catch (err: any) {
    Alert.alert('Login Failed', err.message);
  } finally {
    setLoading(false);
  }
};
```

**Files to Update**:
- Line 35: Replace `router.push` with `handleLogin` function
- Add TextInput state bindings
- Add loading state UI

---

#### 3. `(patient)/verify.tsx` & `(caregiver)/verify.tsx`

**Current State**: Basic OTP validation (checks length only)

**Integration Needed**:
```typescript
import { verifyOTP } from '../../services/api';

const handleVerify = async () => {
  const code = otp.join('');
  
  if (code.length !== 4) {
    setIsError(true);
    return;
  }
  
  try {
    setLoading(true);
    
    // Get email from previous screen or storage
    const email = await SecureStore.getItemAsync('signupEmail');
    
    const result = await verifyOTP({ email, otp: code });
    
    if (result.verified) {
      setShowModal(true); // For patient
      // OR router.replace('/(caregiver)/caregiver-home') for caregiver
    }
  } catch (err: any) {
    setIsError(true);
    Alert.alert('Verification Failed', err.message);
  } finally {
    setLoading(false);
  }
};
```

**Files to Update**:
- Patient: Line 28-36
- Caregiver: Line 33-41
- Add resend OTP functionality

---

#### 4. `(patient)/profile-setup.tsx`

**Current State**: Form data stored locally, navigates to home

**Integration Needed**:
```typescript
import { completePatientProfile } from '../../services/api';
import * as SecureStore from 'expo-secure-store';

const nextStep = async () => {
  if (step < 5) {
    setStep(step + 1);
  } else {
    try {
      setLoading(true);
      
      const userId = await SecureStore.getItemAsync('userId');
      
      await completePatientProfile(userId!, formData);
      
      router.replace('/(patient)/home');
    } catch (err: any) {
      Alert.alert('Profile Setup Failed', err.message);
      setLoading(false);
    }
  }
};
```

**Files to Update**:
- Line 43-47: Replace with async API call

---

### Patient Dashboard Screens

#### 5. `(patient)/home.tsx`

**Current State**: Uses hardcoded mock data

**Integration Needed**:
```typescript
import { getDailyMetrics, getPatientProfile, getNotifications } from '../../services/api';

const [dailyData, setDailyData] = useState<any>(null);
const [notifications, setNotifications] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  loadDashboardData();
}, []);

const loadDashboardData = async () => {
  try {
    const userId = await SecureStore.getItemAsync('userId');
    
    const [metrics, profile, notifs] = await Promise.all([
      getDailyMetrics(userId!),
      getPatientProfile(userId!),
      getNotifications(userId!)
    ]);
    
    setDailyData(metrics);
    setUserData(profile);
    setNotifications(notifs);
  } catch (err) {
    console.error('Dashboard load failed:', err);
  } finally {
    setLoading(false);
  }
};
```

**Files to Update**:
- Line 24-97: Replace mock userData and dailyData with API state
- Add pull-to-refresh functionality
- Add loading skeleton UI

---

#### 6. `(patient)/action-menu.tsx`

**Current State**: Multiple tabs with mock data

**Integration Points by Tab**:

**Ask AI Tab**:
```typescript
import { sendAIMessage } from '../../services/api';

const sendAiMessage = async () => {
  if (!aiInput.trim()) return;
  
  const userMessage = { id: Date.now().toString(), text: aiInput, sender: 'user' };
  setAiMessages([...aiMessages, userMessage]);
  setAiInput('');
  
  try {
    const userId = await SecureStore.getItemAsync('userId');
    
    const response = await sendAIMessage({
      message: aiInput,
      userId: userId!,
      context: { recentMetrics: dailyData } // Optional context
    });
    
    const aiResponse = {
      id: (Date.now() + 1).toString(),
      text: response.message,
      sender: 'ai'
    };
    setAiMessages(prev => [...prev, aiResponse]);
  } catch (err) {
    console.error('AI message failed:', err);
  }
};
```

**Files to Update**:
- Line 110-128: Replace `generateAiResponse` with `sendAIMessage` API

**Leaderboard Tab**:
```typescript
import { getLeaderboard } from '../../services/api';

useEffect(() => {
  if (activeTab === 'Leaderboard') {
    loadLeaderboard();
  }
}, [activeTab]);

const loadLeaderboard = async () => {
  try {
    const data = await getLeaderboard();
    setLeaderboardData(data);
  } catch (err) {
    console.error('Leaderboard load failed:', err);
  }
};
```

**History Tab**:
```typescript
import { getHealthHistory } from '../../services/api';

const loadHistory = async (month: number, year: number) => {
  const userId = await SecureStore.getItemAsync('userId');
  const history = await getHealthHistory(userId!, month, year);
  setMonthlyScores(history);
};
```

**Devices Tab**:
```typescript
import { getConnectedDevices } from '../../services/api';

useEffect(() => {
  if (activeTab === 'Devices') {
    loadDevices();
  }
}, [activeTab]);

const loadDevices = async () => {
  const userId = await SecureStore.getItemAsync('userId');
  const devices = await getConnectedDevices(userId!);
  setDevices(devices);
};
```

**Messages Tab**:
```typescript
import { getConversations, sendMessage } from '../../services/api';

const loadConversations = async () => {
  const userId = await SecureStore.getItemAsync('userId');
  const convos = await getConversations(userId!);
  setConversations(convos);
};
```

---

### Caregiver Screens

on#### 7. `(caregiver)/caregiver-home.tsx`

**Current State**: Hardcoded patient list

**Integration Needed**:
```typescript
import { getCaregiverPatients, sendPatientRequest, removePatient } from '../../services/api';

const [patients, setPatients] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  loadPatients();
}, []);

const loadPatients = async () => {
  try {
    const caregiverId = await SecureStore.getItemAsync('userId');
    const patientsList = await getCaregiverPatients(caregiverId!);
    setPatients(patientsList);
  } catch (err) {
    console.error('Load patients failed:', err);
  } finally {
    setLoading(false);
  }
};

const sendRequest = async () => {
  try {
    const caregiverId = await SecureStore.getItemAsync('userId');
    await sendPatientRequest(caregiverId!, newPatientId);
    
    Alert.alert('Success', 'Connection request sent!');
    setAddModalVisible(false);
    setNewPatientId('');
  } catch (err: any) {
    Alert.alert('Error', err.message);
  }
};

const deletePatient = async (patientId: string) => {
  Alert.alert(
    'Remove Patient',
    'Are you sure?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const caregiverId = await SecureStore.getItemAsync('userId');
            await removePatient(caregiverId!, patientId);
            setPatients(prev => prev.filter(p => p.id !== patientId));
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        }
      }
    ]
  );
};
```

**Files to Update**:
- Line 35-123: Replace mock patients with API state
- Add sendRequest function
- Add deletePatient confirmation

---

## 🔐 Authentication Token Management

Create a helper file `services/auth.ts`:

```typescript
import * as SecureStore from 'expo-secure-store';

export async function saveAuthToken(token: string) {
  await SecureStore.setItemAsync('userToken', token);
}

export async function getAuthToken(): Promise<string | null> {
  return await SecureStore.getItemAsync('userToken');
}

export async function clearAuthToken() {
  await SecureStore.deleteItemAsync('userToken');
  await SecureStore.deleteItemAsync('userId');
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  return token !== null;
}
```

Update `services/api.ts` to include auth token:

```typescript
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await SecureStore.getItemAsync('userToken');
  
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  });
  
  // ... rest of error handling
}
```

---

## 📊 API Response Examples

### Signup Response
```json
{
  "success": true,
  "message": "User registered successfully",
  "userId": "user_12345",
  "email": "user@example.com"
}
```

### Login Response
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user_12345",
  "role": "patient",
  "profile": {
    "name": "Alex Morgan",
    "email": "alex@example.com"
  }
}
```

### Daily Metrics Response
```json
{
  "steps": { "current": 6240, "goal": 10000 },
  "sleep": { "current": 7.33, "goal": 8, "quality": "Good" },
  "water": { "current": 1250, "goal": 2500 },
  "bloodPressure": {
    "systolic": 128,
    "diastolic": 78,
    "timestamp": "2h ago"
  },
  "glucose": { "value": 145, "type": "post-meal" },
  "healthScore": 76
}
```

---

## Integration Checklist

- [ ] Create `.env.local` with backend URL
- [ ] Install `expo-secure-store`
- [ ] Update all signup screens with API calls
- [ ] Update all login screens with API calls
- [ ] Update verify screens with OTP API
- [ ] Update profile setup with API
- [ ] Replace mock data in patient home
- [ ] Replace mock data in action menu tabs
- [ ] Replace mock data in caregiver home
- [ ] Add error handling and loading states
- [ ] Add token refresh logic
- [ ] Add logout functionality
- [ ] Test all API integrations
- [ ] Add offline support (optional)

---

## 🧪 Testing API Integration

1. **Use a mock API first**: Tools like [JSON Server](https://github.com/typicode/json-server) or [MockAPI](https://mockapi.io)

2. **Test with Postman**: Verify all endpoints work before integrating

3. **Add console logs**: During development, log all API calls and responses

4. **Handle errors gracefully**: Always show user-friendly error messages

5. **Test edge cases**:
   - Network failures
   - Invalid credentials
   - Expired tokens
   - Server errors

---

## 📚 Additional Resources

- [Expo SecureStore Docs](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [React Native Fetch API](https://reactnative.dev/docs/network)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [JWT Authentication Guide](https://jwt.io/introduction)

---

**Next Steps**: Choose one screen (e.g., login) and integrate the API end-to-end as a proof of concept before scaling to all screens.
