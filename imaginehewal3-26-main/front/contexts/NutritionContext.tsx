// contexts/NutritionContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: string;
  timestamp: number;
}

export interface DailyNutrition {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  foods: FoodItem[];
  waterIntake: number;
  waterGoal: number;
}

export interface NutritionGoal {
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFat: number;
  dailyFiber?: number;
  dailySugar?: number;
  dailySodium?: number;
  waterGoal: number;
}

export interface Workout {
  id: string;
  name: string;
  type: 'cardio' | 'strength' | 'flexibility' | 'balance';
  duration: number;
  caloriesBurned: number;
  date: string;
  timestamp: number;
  exercises?: Exercise[];
}

export interface Exercise {
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
}

export interface DailyActivity {
  steps: number;
  activeMinutes: number;
  standHours: number;
  caloriesBurned: number;
  date: string;
}

interface NutritionContextType {
  // Nutrition State
  todayNutrition: DailyNutrition;
  nutritionHistory: DailyNutrition[];
  nutritionGoals: NutritionGoal;
  
  // Fitness State
  todayActivity: DailyActivity;
  activityHistory: DailyActivity[];
  workouts: Workout[];
  
  // Methods
  addFood: (food: Omit<FoodItem, 'id' | 'timestamp'>) => Promise<void>;
  removeFood: (foodId: string) => Promise<void>;
  updateWaterIntake: (amount: number) => Promise<void>;
  setNutritionGoals: (goals: Partial<NutritionGoal>) => Promise<void>;
  
  // Fitness Methods
  addWorkout: (workout: Omit<Workout, 'id' | 'timestamp'>) => Promise<void>;
  removeWorkout: (workoutId: string) => Promise<void>;
  updateActivity: (activity: Partial<DailyActivity>) => Promise<void>;
  
  // Loading States
  loading: boolean;
}

const NutritionContext = createContext<NutritionContextType | undefined>(undefined);

const DEFAULT_GOALS: NutritionGoal = {
  dailyCalories: 2000,
  dailyProtein: 50,
  dailyCarbs: 250,
  dailyFat: 65,
  dailyFiber: 25,
  dailySugar: 50,
  dailySodium: 2300,
  waterGoal: 2000,
};

const DEFAULT_DAILY_NUTRITION: DailyNutrition = {
  date: new Date().toISOString().split('T')[0],
  totalCalories: 0,
  totalProtein: 0,
  totalCarbs: 0,
  totalFat: 0,
  foods: [],
  waterIntake: 0,
  waterGoal: 2000,
};

const DEFAULT_ACTIVITY: DailyActivity = {
  steps: 0,
  activeMinutes: 0,
  standHours: 0,
  caloriesBurned: 0,
  date: new Date().toISOString().split('T')[0],
};

export const NutritionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [todayNutrition, setTodayNutrition] = useState<DailyNutrition>(DEFAULT_DAILY_NUTRITION);
  const [nutritionHistory, setNutritionHistory] = useState<DailyNutrition[]>([]);
  const [nutritionGoals, setNutritionGoalsState] = useState<NutritionGoal>(DEFAULT_GOALS);
  const [todayActivity, setTodayActivity] = useState<DailyActivity>(DEFAULT_ACTIVITY);
  const [activityHistory, setActivityHistory] = useState<DailyActivity[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNutritionData();
  }, []);

  const loadNutritionData = async () => {
    try {
      setLoading(true);
      const [
        storedNutritionHistory,
        storedGoals,
        storedActivityHistory,
        storedWorkouts,
      ] = await Promise.all([
        AsyncStorage.getItem('nutritionHistory'),
        AsyncStorage.getItem('nutritionGoals'),
        AsyncStorage.getItem('activityHistory'),
        AsyncStorage.getItem('workouts'),
      ]);

      if (storedNutritionHistory) {
        const history = JSON.parse(storedNutritionHistory);
        setNutritionHistory(history);
        
        const today = new Date().toISOString().split('T')[0];
        const todayData = history.find((day: DailyNutrition) => day.date === today);
        setTodayNutrition(todayData || DEFAULT_DAILY_NUTRITION);
      }

      if (storedGoals) {
        setNutritionGoalsState(JSON.parse(storedGoals));
      }

      if (storedActivityHistory) {
        const activity = JSON.parse(storedActivityHistory);
        setActivityHistory(activity);
        
        const today = new Date().toISOString().split('T')[0];
        const todayAct = activity.find((day: DailyActivity) => day.date === today);
        setTodayActivity(todayAct || DEFAULT_ACTIVITY);
      }

      if (storedWorkouts) {
        setWorkouts(JSON.parse(storedWorkouts));
      }
    } catch (error) {
      console.error('Error loading nutrition data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveNutritionHistory = async (history: DailyNutrition[]) => {
    try {
      await AsyncStorage.setItem('nutritionHistory', JSON.stringify(history));
    } catch (error) {
      console.error('Error saving nutrition history:', error);
    }
  };

  const saveGoals = async (goals: NutritionGoal) => {
    try {
      await AsyncStorage.setItem('nutritionGoals', JSON.stringify(goals));
    } catch (error) {
      console.error('Error saving nutrition goals:', error);
    }
  };

  const saveActivityHistory = async (history: DailyActivity[]) => {
    try {
      await AsyncStorage.setItem('activityHistory', JSON.stringify(history));
    } catch (error) {
      console.error('Error saving activity history:', error);
    }
  };

  const saveWorkouts = async (workouts: Workout[]) => {
    try {
      await AsyncStorage.setItem('workouts', JSON.stringify(workouts));
    } catch (error) {
      console.error('Error saving workouts:', error);
    }
  };

  const addFood = async (foodData: Omit<FoodItem, 'id' | 'timestamp'>) => {
    const newFood: FoodItem = {
      ...foodData,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };

    const updatedFoods = [...todayNutrition.foods, newFood];
    const updatedNutrition = {
      ...todayNutrition,
      foods: updatedFoods,
      totalCalories: todayNutrition.totalCalories + newFood.calories,
      totalProtein: todayNutrition.totalProtein + newFood.protein,
      totalCarbs: todayNutrition.totalCarbs + newFood.carbs,
      totalFat: todayNutrition.totalFat + newFood.fat,
    };

    setTodayNutrition(updatedNutrition);

    const today = new Date().toISOString().split('T')[0];
    const updatedHistory = nutritionHistory.filter(day => day.date !== today);
    updatedHistory.push(updatedNutrition);
    setNutritionHistory(updatedHistory);
    await saveNutritionHistory(updatedHistory);
  };

  const removeFood = async (foodId: string) => {
    const foodToRemove = todayNutrition.foods.find(food => food.id === foodId);
    if (!foodToRemove) return;

    const updatedFoods = todayNutrition.foods.filter(food => food.id !== foodId);
    const updatedNutrition = {
      ...todayNutrition,
      foods: updatedFoods,
      totalCalories: todayNutrition.totalCalories - foodToRemove.calories,
      totalProtein: todayNutrition.totalProtein - foodToRemove.protein,
      totalCarbs: todayNutrition.totalCarbs - foodToRemove.carbs,
      totalFat: todayNutrition.totalFat - foodToRemove.fat,
    };

    setTodayNutrition(updatedNutrition);

    const today = new Date().toISOString().split('T')[0];
    const updatedHistory = nutritionHistory.filter(day => day.date !== today);
    updatedHistory.push(updatedNutrition);
    setNutritionHistory(updatedHistory);
    await saveNutritionHistory(updatedHistory);
  };

  const updateWaterIntake = async (amount: number) => {
    const updatedNutrition = {
      ...todayNutrition,
      waterIntake: amount,
    };

    setTodayNutrition(updatedNutrition);

    const today = new Date().toISOString().split('T')[0];
    const updatedHistory = nutritionHistory.filter(day => day.date !== today);
    updatedHistory.push(updatedNutrition);
    setNutritionHistory(updatedHistory);
    await saveNutritionHistory(updatedHistory);
  };

  const setNutritionGoals = async (newGoals: Partial<NutritionGoal>) => {
    const updatedGoals = { ...nutritionGoals, ...newGoals };
    setNutritionGoalsState(updatedGoals);
    await saveGoals(updatedGoals);
  };

  const addWorkout = async (workoutData: Omit<Workout, 'id' | 'timestamp'>) => {
    const newWorkout: Workout = {
      ...workoutData,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };

    const updatedWorkouts = [...workouts, newWorkout];
    setWorkouts(updatedWorkouts);
    await saveWorkouts(updatedWorkouts);
  };

  const removeWorkout = async (workoutId: string) => {
    const updatedWorkouts = workouts.filter(workout => workout.id !== workoutId);
    setWorkouts(updatedWorkouts);
    await saveWorkouts(updatedWorkouts);
  };

  const updateActivity = async (activityData: Partial<DailyActivity>) => {
    const updatedActivity = { ...todayActivity, ...activityData };
    setTodayActivity(updatedActivity);

    const today = new Date().toISOString().split('T')[0];
    const updatedHistory = activityHistory.filter(day => day.date !== today);
    updatedHistory.push(updatedActivity);
    setActivityHistory(updatedHistory);
    await saveActivityHistory(updatedHistory);
  };

  return (
    <NutritionContext.Provider
      value={{
        todayNutrition,
        nutritionHistory,
        nutritionGoals,
        todayActivity,
        activityHistory,
        workouts,
        addFood,
        removeFood,
        updateWaterIntake,
        setNutritionGoals,
        addWorkout,
        removeWorkout,
        updateActivity,
        loading,
      }}
    >
      {children}
    </NutritionContext.Provider>
  );
};

export const useNutrition = () => {
  const context = useContext(NutritionContext);
  if (!context) {
    throw new Error('useNutrition must be used within NutritionProvider');
  }
  return context;
};