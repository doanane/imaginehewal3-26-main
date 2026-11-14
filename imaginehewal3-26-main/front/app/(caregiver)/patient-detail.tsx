import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';

export default function PatientDetailScreen() {
  const router = useRouter();
  
  // States
  const [isReviewed, setIsReviewed] = useState(false);
  // Added 'time' to the medication object state
  const [medications, setMedications] = useState([{ id: 1, name: '', dose: '', time: '' }]);
  const [mealTimes, setMealTimes] = useState({
    Breakfast: '08:00 AM',
    Lunch: '12:00 PM',
    Snack: '03:30 PM',
    Dinner: '07:00 PM'
  });

  // 1. Smart Time Formatter (Typing "9" -> "09:00 AM")
  const handleSmartTime = (type: 'meal' | 'med', key: string | number, value: string) => {
    let formatted = value;
    if (value.length === 1 && /^[1-9]$/.test(value)) {
      const hour = parseInt(value);
      if (hour >= 7 && hour <= 11) formatted = `0${hour}:00 AM`;
      else if (hour >= 1 && hour <= 6) formatted = `0${hour}:00 PM`;
      else if (hour === 12) formatted = `12:00 PM`;
    }
    
    if (type === 'meal') {
      setMealTimes({ ...mealTimes, [key]: formatted });
    } else {
      setMedications(medications.map(m => m.id === key ? { ...m, time: formatted } : m));
    }
  };

  // 2. Add Medication Logic
  const addMedication = () => {
    setMedications([...medications, { id: Date.now(), name: '', dose: '', time: '' }]);
  };

  // 3. Schedule Checkup Logic
  const handleSchedule = () => {
    Alert.alert(
      "Checkup Scheduled",
      "A notification has been sent to Alex Morgan to confirm this meeting.",
      [{ text: "OK" }]
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alex Morgan</Text>
        <TouchableOpacity onPress={() => router.push('/(caregiver)/messaging')}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
        
        {/* 1. ANALYTICAL HEALTH SCORE DONUT */}
        <View style={styles.analyticsContainer}>
          <View style={styles.donutBase}>
            <View style={styles.donutFill} />
            <View style={styles.donutInner}>
              <Text style={styles.bigScoreText}>62</Text>
              <Text style={styles.scoreSublabel}>Overall Health</Text>
            </View>
          </View>
          
          <View style={styles.analyticsMeta}>
             <View style={styles.metaRow}>
                <Ionicons name="trending-down" size={16} color={theme.COLORS.danger} />
                <Text style={styles.metaText}>4% from yesterday</Text>
             </View>
             <Text style={styles.statusBadge}>STABLE CONDITION</Text>
          </View>
        </View>

        {/* 2. DYNAMIC MEDICATION LIST */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Medication & Dosage</Text>
          <TouchableOpacity onPress={addMedication} style={styles.smallPlus}>
            <Ionicons name="add" size={20} color={theme.COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {medications.map((med, index) => (
          <View key={med.id} style={styles.medicationCard}>
            <View style={styles.inputRow}>
              <TextInput 
                style={styles.input} 
                placeholder="Drug Name" 
                placeholderTextColor={theme.COLORS.textTertiary}
                onChangeText={(val) => {
                  const newMeds = [...medications];
                  newMeds[index].name = val;
                  setMedications(newMeds);
                }}
              />
              <TextInput 
                style={[styles.input, { flex: 0.4 }]} 
                placeholder="Dose" 
                placeholderTextColor={theme.COLORS.textTertiary}
                onChangeText={(val) => {
                  const newMeds = [...medications];
                  newMeds[index].dose = val;
                  setMedications(newMeds);
                }}
              />
              <TextInput 
                style={[styles.input, { flex: 0.5, fontWeight: '600' }]} 
                placeholder="Time" 
                placeholderTextColor={theme.COLORS.textTertiary}
                value={med.time}
                onChangeText={(val) => {
                  const newMeds = [...medications];
                  newMeds[index].time = val;
                  setMedications(newMeds);
                }}
                onBlur={() => handleSmartTime('med', med.id, med.time)}
              />
            </View>
          </View>
        ))}

        {/* 3. SMART MEAL SCHEDULE */}
        <Text style={styles.sectionTitle}>Meal Schedule</Text>
        <View style={styles.card}>
          <View style={styles.mealGrid}>
            {Object.keys(mealTimes).map((meal) => (
              <View key={meal} style={styles.mealItem}>
                <Text style={styles.mealText}>{meal}</Text>
                <TextInput 
                  style={styles.timeInput} 
                  value={mealTimes[meal as keyof typeof mealTimes]}
                  onChangeText={(val) => setMealTimes({...mealTimes, [meal]: val})}
                  onBlur={() => handleSmartTime('meal', meal, mealTimes[meal as keyof typeof mealTimes])}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            ))}
          </View>
        </View>

        {/* 4. AI INSIGHTS */}
        <Animated.View entering={FadeInUp} style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <MaterialCommunityIcons name="robot" size={20} color={theme.COLORS.textOnDark} />
            <Text style={styles.aiTitle}>Care Insight</Text>
          </View>
          <Text style={styles.aiBody}>
            Alex&apos;s score of 62 is primarily impacted by irregular hydration. 
            Automated alerts are currently set for 09:00 AM and 02:00 PM.
          </Text>
        </Animated.View>

        {/* 5. ACTIONS */}
        <View style={styles.reviewRow}>
          <Text style={styles.reviewText}>Mark Logs as Reviewed</Text>
          <Switch 
            value={isReviewed} 
            onValueChange={setIsReviewed}
            trackColor={{ false: theme.COLORS.separator, true: theme.COLORS.primary }}
            thumbColor={theme.COLORS.card}
          />
        </View>

        <TouchableOpacity style={styles.scheduleBtn} onPress={handleSchedule}>
          <Ionicons name="calendar-outline" size={20} color={theme.COLORS.textOnPrimary} />
          <Text style={styles.scheduleBtnText}>Schedule Checkup</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.COLORS.background 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingTop: theme.SPACING.xxl + theme.SPACING.sm, 
    paddingHorizontal: theme.SPACING.lg, 
    paddingBottom: theme.SPACING.lg, 
    backgroundColor: theme.COLORS.card 
  },
  headerTitle: { 
    ...theme.TYPOGRAPHY.h2,
    color: theme.COLORS.textPrimary 
  },
  scrollBody: { 
    padding: theme.SPACING.lg 
  },
  analyticsContainer: { 
    backgroundColor: theme.COLORS.card, 
    borderRadius: theme.LAYOUT.borderRadius.xl, 
    padding: theme.SPACING.lg, 
    alignItems: 'center', 
    marginBottom: theme.SPACING.lg, 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    ...theme.SHADOWS.medium 
  },
  donutBase: { 
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    borderWidth: 10, 
    borderColor: theme.COLORS.separator,
    justifyContent: 'center', 
    alignItems: 'center', 
    position: 'relative' 
  },
  donutFill: { 
    position: 'absolute', 
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    borderWidth: 10, 
    borderColor: theme.COLORS.primary,
    borderTopColor: 'transparent', 
    borderRightColor: 'transparent', 
    top: -10, 
    left: -10,
    transform: [{ rotate: '45deg' }]
  },
  donutInner: { 
    alignItems: 'center' 
  },
  bigScoreText: { 
    fontSize: 32, 
    fontWeight: '800',
    color: theme.COLORS.primary
  },
  scoreSublabel: { 
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textTertiary, 
    fontWeight: '600', 
    textTransform: 'uppercase' 
  },
  analyticsMeta: { 
    alignItems: 'flex-start' 
  },
  metaRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 5, 
    marginBottom: 8 
  },
  metaText: { 
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textSecondary, 
    fontWeight: '500' 
  },
  statusBadge: { 
    backgroundColor: theme.COLORS.successLight, 
    color: theme.COLORS.success, 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8, 
    ...theme.TYPOGRAPHY.small,
    fontWeight: 'bold', 
    overflow: 'hidden' 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  sectionTitle: { 
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.sm
  },
  card: { 
    backgroundColor: theme.COLORS.card, 
    padding: theme.SPACING.md, 
    borderRadius: theme.LAYOUT.borderRadius.xl, 
    ...theme.SHADOWS.small,
    marginBottom: theme.SPACING.md
  },
  medicationCard: {
    backgroundColor: theme.COLORS.card,
    padding: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.xl,
    ...theme.SHADOWS.small,
    marginBottom: theme.SPACING.sm
  },
  smallPlus: { 
    backgroundColor: theme.COLORS.background, 
    padding: 5, 
    borderRadius: 8 
  },
  inputRow: { 
    flexDirection: 'row', 
    gap: 8 
  },
  input: { 
    flex: 1, 
    backgroundColor: theme.COLORS.background, 
    padding: 12, 
    borderRadius: 12, 
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textPrimary
  },
  mealGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10 
  },
  mealItem: { 
    width: '48%', 
    backgroundColor: theme.COLORS.background, 
    padding: 12, 
    borderRadius: 12 
  },
  mealText: { 
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary, 
    marginBottom: 5 
  },
  timeInput: { 
    ...theme.TYPOGRAPHY.body,
    fontWeight: 'bold', 
    color: theme.COLORS.textPrimary 
  },
  aiCard: { 
    backgroundColor: theme.COLORS.textPrimary, 
    padding: 15, 
    borderRadius: 20, 
    marginVertical: 15 
  },
  aiHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 8 
  },
  aiTitle: { 
    color: theme.COLORS.textOnDark, 
    fontWeight: 'bold' 
  },
  aiBody: { 
    color: theme.COLORS.textTertiary, 
    ...theme.TYPOGRAPHY.caption,
    lineHeight: 18 
  },
  reviewRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginVertical: 10 
  },
  reviewText: { 
    ...theme.TYPOGRAPHY.body,
    fontWeight: '500',
    color: theme.COLORS.textPrimary
  },
  scheduleBtn: { 
    backgroundColor: theme.COLORS.primary, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 15, 
    gap: 10, 
    marginBottom: 40 
  },
  scheduleBtnText: { 
    color: theme.COLORS.textOnPrimary, 
    fontWeight: 'bold', 
    fontSize: 16 
  }
});