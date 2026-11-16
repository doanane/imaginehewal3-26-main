import React, { useState, useEffect } from 'react';
import { StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { Ionicons, MaterialCommunityIcons, ScrollView, Text, TextInput, TouchableOpacity, View } from '../../components/themed';

export default function ProfileSetup() {
  const router = useRouter();
  const brandColor = 'rgb(173, 0, 35)';
  const [step, setStep] = useState(1);

  // FORM STATE
  const [formData, setFormData] = useState({
    personal: { name: '', gender: '', age: '' },
    conditions: [] as string[],
    familyHistory: '', // Added for Step 2
    behavioral: { water: 0, diet: 0, meds: 0, alcohol: 0, sugar: 0, oils: 0, exercise: 0 },
    metabolic: { bp: 5, cholesterol: 5, glucose: 5, weight: '', height: '', bmi: '' },
    environmental: { air: null as boolean | null, strokePast: null as boolean | null, strokeNow: null as boolean | null },
    linkedDevices: [] as string[]
  });

  // BMI Calculator Effect
  useEffect(() => {
    if (formData.metabolic.weight && formData.metabolic.height) {
      const w = parseFloat(formData.metabolic.weight);
      const h = parseFloat(formData.metabolic.height) / 100; 
      if (h > 0) {
        const bmiValue = (w / (h * h)).toFixed(1);
        setFormData(prev => ({ ...prev, metabolic: { ...prev.metabolic, bmi: bmiValue } }));
      }
    }
  }, [formData.metabolic.weight, formData.metabolic.height]);

  const toggleCondition = (c: string) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.includes(c) ? prev.conditions.filter(item => item !== c) : [...prev.conditions, c]
    }));
  };

  const nextStep = () => {
    if (step < 5) setStep(step + 1);
    else router.replace('/(patient)/(tabs)/today');
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.push('/(patient)/(tabs)/today')} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={20} color="#333" />
      </TouchableOpacity>
      <View style={styles.progressRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.progressDot, i <= step ? { backgroundColor: i === step ? brandColor : '#10B981' } : { backgroundColor: '#EEE' }]} />
        ))}
      </View>
      <Text style={styles.stepIndicator}>Step {step} of 5</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        
        {/* STEP 1: PERSONAL INFO */}
        {step === 1 && (
          <Animated.View entering={FadeInRight} exiting={FadeOutLeft}>
            <Text style={styles.title}>Personal Info</Text>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={formData.personal.name}
              onChangeText={(t) => setFormData({ ...formData, personal: { ...formData.personal, name: t } })}
            />
            <Text style={styles.label}>Gender</Text>
            <View style={styles.row}>
              {['Male', 'Female'].map(g => (
                <TouchableOpacity 
                  key={g} 
                  style={[styles.choiceBtn, formData.personal.gender === g && styles.activeChoice]} 
                  onPress={() => setFormData({...formData, personal: {...formData.personal, gender: g}})}
                >
                  <Text style={[styles.choiceText, formData.personal.gender === g && styles.activeChoiceText]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Age"
              keyboardType="numeric"
              value={formData.personal.age}
              onChangeText={(t) => setFormData({ ...formData, personal: { ...formData.personal, age: t } })}
            />
          </Animated.View>
        )}

        {/* STEP 2: EXISTING CONDITIONS & FAMILY HISTORY */}
        {step === 2 && (
          <Animated.View entering={FadeInRight}>
            <Text style={styles.title}>Health History</Text>
            
            <Text style={styles.label}>Current Conditions</Text>
            <Text style={styles.subtitle}>Select any existing conditions (Pick one or more)</Text>
            <View style={styles.conditionWrap}>
              {['Cardiovascular disease', 'Cancer', 'Chronic respiratory disease', 'Diabetes'].map(c => (
                <TouchableOpacity 
                  key={c} 
                  style={[styles.condBtn, formData.conditions.includes(c) && styles.activeCond]}
                  onPress={() => toggleCondition(c)}
                >
                  <Text style={[styles.condText, formData.conditions.includes(c) && styles.activeChoiceText]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ marginTop: 30 }}>
              <Text style={styles.label}>Family History</Text>
              <Text style={styles.subtitle}>Describe any hereditary health conditions in your family.</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Example: My father has hypertension and my maternal grandmother had diabetes..."
                multiline
                numberOfLines={4}
                value={formData.familyHistory}
                onChangeText={(t) => setFormData({ ...formData, familyHistory: t })}
                textAlignVertical="top"
              />
            </View>
          </Animated.View>
        )}

        {/* STEP 3: RISK FACTORS */}
        {step === 3 && (
          <Animated.View entering={FadeInRight}>
            <Text style={styles.title}>Daily Habits</Text>
            <Text style={styles.subtitle}>Tell us about your everyday routines so we can tailor your recommendations.</Text>

            <Text style={styles.sectionHeader}>1. Behavioral Factors (Days per week)</Text>
            <View style={styles.riskCard}>
              {Object.keys(formData.behavioral).map((key) => (
                <View key={key} style={{ marginBottom: 15 }}>
                  <Text style={styles.riskLabel}>{key.charAt(0).toUpperCase() + key.slice(1).replace('meds', 'Prescribed Medicine')}: {formData.behavioral[key as keyof typeof formData.behavioral]} days</Text>
                  <Slider
                    minimumValue={0} maximumValue={7} step={1}
                    value={formData.behavioral[key as keyof typeof formData.behavioral]}
                    onValueChange={(v) => setFormData({ ...formData, behavioral: { ...formData.behavioral, [key]: v } })}
                    minimumTrackTintColor={brandColor}
                  />
                </View>
              ))}
            </View>

            <Text style={styles.sectionHeader}>2. Metabolic Factors</Text>
            <View style={styles.riskCard}>
              <Text style={styles.riskLabel}>Blood Pressure (Scale 1-10)</Text>
              <Slider minimumValue={0} maximumValue={10} value={formData.metabolic.bp} onValueChange={(v) => setFormData({...formData, metabolic: {...formData.metabolic, bp: v}})} minimumTrackTintColor={brandColor} />
              
              <Text style={styles.riskLabel}>Glucose Level (Scale 1-10)</Text>
              <Slider minimumValue={0} maximumValue={10} value={formData.metabolic.glucose} onValueChange={(v) => setFormData({...formData, metabolic: {...formData.metabolic, glucose: v}})} minimumTrackTintColor={brandColor} />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Height (cm)</Text>
                  <TextInput style={styles.input} placeholder="170" keyboardType="numeric" onChangeText={(t) => setFormData({...formData, metabolic: {...formData.metabolic, height: t}})} />
                </View>
                <View style={{ width: 15 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Weight (kg)</Text>
                  <TextInput style={styles.input} placeholder="70" keyboardType="numeric" onChangeText={(t) => setFormData({...formData, metabolic: {...formData.metabolic, weight: t}})} />
                </View>
              </View>
              {formData.metabolic.bmi !== '' && <Text style={styles.bmiText}>Calculated BMI: {formData.metabolic.bmi}</Text>}
            </View>

            <Text style={styles.sectionHeader}>3. Environmental Factors</Text>
            <View style={styles.riskCard}>
              {[
                { label: 'Exposed to contaminated air?', key: 'air' },
                { label: 'Have you ever had a stroke?', key: 'strokePast' },
                { label: 'Currently having a stroke?', key: 'strokeNow' }
              ].map((q) => (
                <View key={q.key} style={styles.envRow}>
                  <Text style={{ flex: 1, fontSize: 14 }}>{q.label}</Text>
                  <View style={styles.row}>
                    <TouchableOpacity onPress={() => setFormData({...formData, environmental: {...formData.environmental, [q.key]: true}})} style={[styles.miniBtn, formData.environmental[q.key as keyof typeof formData.environmental] === true && {backgroundColor: brandColor}]}>
                      <Text style={{color: formData.environmental[q.key as keyof typeof formData.environmental] === true ? 'white' : 'black'}}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setFormData({...formData, environmental: {...formData.environmental, [q.key]: false}})} style={[styles.miniBtn, formData.environmental[q.key as keyof typeof formData.environmental] === false && {backgroundColor: brandColor}]}>
                      <Text style={{color: formData.environmental[q.key as keyof typeof formData.environmental] === false ? 'white' : 'black'}}>No</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* STEP 4: DEVICE LINKING */}
        {step === 4 && (
          <Animated.View entering={FadeInRight}>
            <Text style={styles.title}>Device Linking</Text>
            {[
              { name: 'Smartwatch', icon: 'watch' },
              { name: 'BP Monitor', icon: 'heart-pulse' },
              { name: 'Glucose Meter', icon: 'water' }
            ].map((d) => (
              <View key={d.name} style={styles.deviceItem}>
                <MaterialCommunityIcons name={d.icon as any} size={30} color={brandColor} />
                <Text style={styles.deviceName}>{d.name}</Text>
                <TouchableOpacity style={styles.connectBtn} onPress={() => Alert.alert("Bluetooth", `Searching for ${d.name}...`)}>
                  <Text style={styles.connectText}>Connect</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Animated.View>
        )}

        {/* STEP 5: SUMMARY */}
        {step === 5 && (
          <Animated.View entering={FadeInRight}>
            <Text style={styles.title}>Review Summary</Text>
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>Personal & Medical</Text>
              <Text>Name: {formData.personal.name || 'N/A'}</Text>
              <Text>Conditions: {formData.conditions.join(', ') || 'None'}</Text>
              <Text>Family History: {formData.familyHistory ? 'Provided' : 'None'}</Text>
            </View>
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>Health Metrics</Text>
              <Text>BMI: {formData.metabolic.bmi || 'Not calculated'}</Text>
              <Text>Physical Activity: {formData.behavioral.exercise} days/wk</Text>
              <Text>High BP Risk: {formData.metabolic.bp > 7 ? 'Yes' : 'No'}</Text>
            </View>
          </Animated.View>
        )}

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.mainBtn, { backgroundColor: brandColor }]} onPress={nextStep}>
          <Text style={styles.mainBtnText}>{step === 5 ? 'Complete Profile' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { paddingTop: 60, paddingHorizontal: 20, alignItems: 'center' },
  backBtn: { position: 'absolute', left: 20, top: 60, width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  progressRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  progressDot: { height: 4, width: 40, borderRadius: 2 },
  stepIndicator: { color: '#666', fontSize: 12 },
  scrollBody: { padding: 25 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: '#666', marginBottom: 15, fontSize: 13, lineHeight: 18 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8, marginTop: 10, color: '#333' },
  input: { backgroundColor: '#F8F9FA', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#EEE', marginBottom: 15 },
  textArea: { height: 100, paddingTop: 15 },
  row: { flexDirection: 'row', alignItems: 'center' },
  choiceBtn: { flex: 1, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#EEE', alignItems: 'center' },
  activeChoice: { backgroundColor: 'rgb(173, 0, 35)', borderColor: 'rgb(173, 0, 35)' },
  choiceText: { fontWeight: '600' },
  activeChoiceText: { color: 'white' },
  conditionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  condBtn: { padding: 12, borderRadius: 20, borderWidth: 1, borderColor: '#EEE' },
  activeCond: { backgroundColor: 'rgb(173, 0, 35)', borderColor: 'rgb(173, 0, 35)' },
  condText: { fontSize: 13 },
  sectionHeader: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10, color: 'rgb(173, 0, 35)' },
  riskCard: { backgroundColor: '#F8F9FA', padding: 15, borderRadius: 15, marginBottom: 15 },
  riskLabel: { fontSize: 13, color: '#444', marginBottom: 5, fontWeight: '500' },
  bmiText: { marginTop: 10, fontWeight: 'bold', color: '#10B981', textAlign: 'right' },
  envRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  miniBtn: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', marginLeft: 10 },
  deviceItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 18, borderRadius: 15, marginBottom: 12 },
  deviceName: { flex: 1, marginLeft: 15, fontWeight: '700', fontSize: 16 },
  connectBtn: { backgroundColor: 'rgba(11, 110, 110, 0.1)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 25 },
  connectText: { color: 'rgb(173, 0, 35)', fontWeight: 'bold' },
  summarySection: { backgroundColor: '#F8F9FA', padding: 15, borderRadius: 12, marginBottom: 10 },
  summaryTitle: { fontWeight: 'bold', color: 'rgb(173, 0, 35)', marginBottom: 5 },
  footer: { padding: 25 },
  mainBtn: { height: 55, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  mainBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});