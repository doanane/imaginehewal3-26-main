import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

const THEME = {
  primary: 'rgb(173, 0, 35)',
  primaryLight: 'rgba(173, 0, 35, 0.1)',
  success: '#10B981',
  successLight: 'rgba(16, 185, 129, 0.1)',
  danger: '#EF4444',
  warning: '#F59E0B',
  background: '#F8F9FA',
  card: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  separator: '#E5E7EB',
  mtnYellow: '#FFCC00',
  telecelRed: '#E31E24',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

type PaymentMethod = 'card' | 'mtn' | 'telecel' | 'paypal' | 'apple';

export default function PaymentScreen() {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>('card');
  
  // Card States
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [holder, setHolder] = useState('');
  const [cardType, setCardType] = useState<'visa' | 'mastercard' | 'other'>('visa');
  
  // Mobile Money States
  const [momoNumber, setMomoNumber] = useState('');
  const [momoName, setMomoName] = useState('');
  
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const amount = 5.00;

  // Format card number with spaces
  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    setCardNumber(formatted);
    
    // Detect card type
    if (cleaned.startsWith('4')) setCardType('visa');
    else if (cleaned.startsWith('5')) setCardType('mastercard');
    else setCardType('other');
  };

  // Format expiry date
  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      setExpiry(cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4));
    } else {
      setExpiry(cleaned);
    }
  };

  // Format mobile money number
  const formatMomoNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 10) {
      setMomoNumber(cleaned);
    }
  };

  const txnSummary = useMemo(() => {
    const id = 'TXN-' + Math.floor(Math.random() * 900000 + 100000);
    const date = new Date();
    return {
      id,
      date: `${date.getDate().toString().padStart(2, '0')} ${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`,
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      type: method === 'mtn' ? 'MTN Mobile Money' : 
            method === 'telecel' ? 'Telecel Cash' :
            method === 'paypal' ? 'PayPal' : 
            method === 'apple' ? 'Apple Pay' : 
            'Credit Card',
      amount: `$${amount.toFixed(2)}`,
      fee: '$2.50',
      total: `$${(amount + 2.50).toFixed(2)}`,
      status: 'Success',
    };
  }, [method, amount]);

  const handleBack = () => {
    router.push('/(patient)/home');
  };

  const validateCardPayment = () => {
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 13) {
      Alert.alert('Invalid Card', 'Please enter a valid card number');
      return false;
    }
    if (!expiry || expiry.length < 5) {
      Alert.alert('Invalid Expiry', 'Please enter expiry date (MM/YY)');
      return false;
    }
    if (!cvv || cvv.length < 3) {
      Alert.alert('Invalid CVV', 'Please enter a valid CVV');
      return false;
    }
    if (!holder || holder.length < 3) {
      Alert.alert('Invalid Name', 'Please enter card holder name');
      return false;
    }
    return true;
  };

  const validateMomoPayment = () => {
    if (!momoNumber || momoNumber.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
      return false;
    }
    if (!momoName || momoName.length < 3) {
      Alert.alert('Invalid Name', 'Please enter your full name');
      return false;
    }
    return true;
  };

  const confirmPayment = async () => {
    // Validate based on payment method
    if (method === 'card') {
      if (!validateCardPayment()) return;
    } else if (method === 'mtn' || method === 'telecel') {
      if (!validateMomoPayment()) return;
    }

    setProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setProcessing(false);
      setSuccess(true);
    }, 2000);
  };

  // Success Screen
  if (success) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={24} color={THEME.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Successful</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Animated.View entering={FadeInDown} style={styles.successIconWrap}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={64} color={THEME.success} />
            </View>
          </Animated.View>
          
          <Animated.View entering={FadeInDown.delay(200)}>
            <Text style={styles.successTitle}>Payment Successful!</Text>
            <Text style={styles.successSub}>Your transaction has been completed</Text>
            <Text style={styles.successAmount}>${(amount + 2.50).toFixed(2)}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400)} style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Transaction Details</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Transaction ID</Text>
              <Text style={[styles.summaryVal, { fontFamily: 'monospace' }]}>{txnSummary.id}</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Date & Time</Text>
              <Text style={styles.summaryVal}>{txnSummary.date} • {txnSummary.time}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Payment Method</Text>
              <Text style={styles.summaryVal}>{txnSummary.type}</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Amount</Text>
              <Text style={styles.summaryVal}>{txnSummary.amount}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Processing Fee</Text>
              <Text style={styles.summaryVal}>{txnSummary.fee}</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryKey, { fontWeight: '700' }]}>Total Paid</Text>
              <Text style={[styles.summaryVal, { fontWeight: '700', fontSize: 18, color: THEME.success }]}>
                {txnSummary.total}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Status</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{txnSummary.status}</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(600)}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleBack}>
              <Text style={styles.primaryBtnText}>Back to Home</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryBtn}>
              <MaterialCommunityIcons name="download" size={20} color={THEME.primary} />
              <Text style={styles.secondaryBtnText}>Download Receipt</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Payment Form Screen
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
          <Text style={styles.amountSub}>+ $2.50 support fee for the needy</Text>
        </View>

        {/* Payment Method Selection */}
        <Text style={styles.sectionTitle}>Select Payment Method</Text>
        <View style={styles.methodsGrid}>
          {/* Card Payment */}
          <TouchableOpacity 
            style={[styles.methodCard, method === 'card' && styles.methodActive]} 
            onPress={() => setMethod('card')}
          >
            <View style={[styles.methodIcon, method === 'card' && { backgroundColor: THEME.primaryLight }]}>
              <MaterialCommunityIcons name="credit-card" size={28} color={method === 'card' ? THEME.primary : THEME.textSecondary} />
            </View>
            <Text style={[styles.methodText, method === 'card' && { color: THEME.primary, fontWeight: '700' }]}>
              Credit/Debit Card
            </Text>
          </TouchableOpacity>

          {/* MTN Mobile Money */}
          <TouchableOpacity 
            style={[styles.methodCard, method === 'mtn' && styles.methodActive]} 
            onPress={() => setMethod('mtn')}
          >
            <View style={[styles.methodIcon, method === 'mtn' && { backgroundColor: 'rgba(255, 204, 0, 0.15)' }]}>
              <MaterialCommunityIcons name="cellphone" size={28} color={method === 'mtn' ? THEME.mtnYellow : THEME.textSecondary} />
            </View>
            <Text style={[styles.methodText, method === 'mtn' && { color: THEME.textPrimary, fontWeight: '700' }]}>
              MTN MoMo
            </Text>
          </TouchableOpacity>

          {/* Telecel Cash */}
          <TouchableOpacity 
            style={[styles.methodCard, method === 'telecel' && styles.methodActive]} 
            onPress={() => setMethod('telecel')}
          >
            <View style={[styles.methodIcon, method === 'telecel' && { backgroundColor: 'rgba(227, 30, 36, 0.15)' }]}>
              <MaterialCommunityIcons name="cellphone-wireless" size={28} color={method === 'telecel' ? THEME.telecelRed : THEME.textSecondary} />
            </View>
            <Text style={[styles.methodText, method === 'telecel' && { color: THEME.textPrimary, fontWeight: '700' }]}>
              Telecel Cash
            </Text>
          </TouchableOpacity>

          {/* PayPal */}
          <TouchableOpacity 
            style={[styles.methodCard, method === 'paypal' && styles.methodActive]} 
            onPress={() => setMethod('paypal')}
          >
            <View style={[styles.methodIcon, method === 'paypal' && { backgroundColor: 'rgba(0, 48, 135, 0.15)' }]}>
              <MaterialCommunityIcons name="cash" size={28} color={method === 'paypal' ? '#003087' : THEME.textSecondary} />
            </View>
            <Text style={[styles.methodText, method === 'paypal' && { color: THEME.textPrimary, fontWeight: '700' }]}>
              PayPal
            </Text>
          </TouchableOpacity>

          {/* Apple Pay */}
          <TouchableOpacity 
            style={[styles.methodCard, method === 'apple' && styles.methodActive]} 
            onPress={() => setMethod('apple')}
          >
            <View style={[styles.methodIcon, method === 'apple' && { backgroundColor: 'rgba(0, 0, 0, 0.1)' }]}>
              <Ionicons name="logo-apple" size={28} color={method === 'apple' ? '#000' : THEME.textSecondary} />
            </View>
            <Text style={[styles.methodText, method === 'apple' && { color: THEME.textPrimary, fontWeight: '700' }]}>
              Apple Pay
            </Text>
          </TouchableOpacity>
        </View>

        {/* Card Payment Form */}
        {method === 'card' && (
          <Animated.View entering={FadeInDown}>
            {/* Card Preview */}
            <View style={styles.cardPreview}>
              <View style={styles.cardChip}>
                <MaterialCommunityIcons name="chip" size={32} color="#FFD700" />
              </View>
              <Text style={styles.cardNumberDisplay}>
                {cardNumber || '•••• •••• •••• ••••'}
              </Text>
              <View style={styles.cardBottom}>
                <View>
                  <Text style={styles.cardLabel}>CARD HOLDER</Text>
                  <Text style={styles.cardHolderName}>{holder || 'YOUR NAME'}</Text>
                </View>
                <View>
                  <Text style={styles.cardLabel}>EXPIRES</Text>
                  <Text style={styles.cardHolderName}>{expiry || 'MM/YY'}</Text>
                </View>
                <View style={styles.cardBrandLogo}>
                  {cardType === 'visa' && <MaterialCommunityIcons name="contactless-payment-circle" size={40} color="rgba(255,255,255,0.3)" />}
                  {cardType === 'mastercard' && <MaterialCommunityIcons name="contactless-payment" size={40} color="rgba(255,255,255,0.3)" />}
                </View>
              </View>
            </View>

            {/* Card Inputs */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Card Number</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor={THEME.textSecondary}
                  value={cardNumber}
                  onChangeText={formatCardNumber}
                  keyboardType="number-pad"
                  maxLength={19}
                />
                {cardType === 'visa' && <MaterialCommunityIcons name="contactless-payment-circle" size={24} color="#1A1F71" />}
                {cardType === 'mastercard' && <MaterialCommunityIcons name="contactless-payment" size={24} color="#EB001B" />}
              </View>

              <View style={styles.inputRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.inputLabel}>Expiry Date</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="MM/YY"
                    placeholderTextColor={THEME.textSecondary}
                    value={expiry}
                    onChangeText={formatExpiry}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.inputLabel}>CVV</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123"
                    placeholderTextColor={THEME.textSecondary}
                    value={cvv}
                    onChangeText={setCvv}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Card Holder Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Kaycee"
                placeholderTextColor={THEME.textSecondary}
                value={holder}
                onChangeText={setHolder}
                autoCapitalize="words"
              />
            </View>
          </Animated.View>
        )}

        {/* Mobile Money Form (MTN & Telecel) */}
        {(method === 'mtn' || method === 'telecel') && (
          <Animated.View entering={FadeInDown}>
            <View style={[styles.momoCard, { 
              backgroundColor: method === 'mtn' ? 'rgba(255, 204, 0, 0.1)' : 'rgba(227, 30, 36, 0.1)',
              borderColor: method === 'mtn' ? THEME.mtnYellow : THEME.telecelRed
            }]}>
              <MaterialCommunityIcons 
                name={method === 'mtn' ? 'cellphone' : 'cellphone-wireless'} 
                size={48} 
                color={method === 'mtn' ? THEME.mtnYellow : THEME.telecelRed} 
              />
              <Text style={styles.momoTitle}>
                {method === 'mtn' ? 'MTN Mobile Money' : 'Telecel Cash'}
              </Text>
              <Text style={styles.momoSub}>
                You&apos;ll receive a prompt on your phone to authorize this payment
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.phonePrefix}>+233</Text>
                <TextInput
                  style={[styles.input, { paddingLeft: 50 }]}
                  placeholder="24 123 4567"
                  placeholderTextColor={THEME.textSecondary}
                  value={momoNumber}
                  onChangeText={formatMomoNumber}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <MaterialCommunityIcons name="phone" size={20} color={THEME.textSecondary} />
              </View>

              <Text style={styles.inputLabel}>Account Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter name registered on MoMo account"
                placeholderTextColor={THEME.textSecondary}
                value={momoName}
                onChangeText={setMomoName}
                autoCapitalize="words"
              />

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={THEME.warning} />
                <Text style={styles.infoText}>
                  Make sure your {method === 'mtn' ? 'MTN' : 'Telecel'} MoMo account has sufficient balance before proceeding.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* PayPal & Apple Pay Info */}
        {(method === 'paypal' || method === 'apple') && (
          <Animated.View entering={FadeInDown} style={styles.comingSoonCard}>
            <MaterialCommunityIcons name="rocket-launch" size={48} color={THEME.textSecondary} />
            <Text style={styles.comingSoonTitle}>Coming Soon!</Text>
            <Text style={styles.comingSoonText}>
              {method === 'paypal' ? 'PayPal' : 'Apple Pay'} integration is currently in development.
            </Text>
          </Animated.View>
        )}

        {/* Confirm Button */}
        {(method === 'card' || method === 'mtn' || method === 'telecel') && (
          <TouchableOpacity 
            style={[styles.primaryBtn, processing && { opacity: 0.6 }]} 
            onPress={confirmPayment} 
            disabled={processing}
          >
            {processing ? (
              <>
                <MaterialCommunityIcons name="loading" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Processing...</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="lock-check" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Pay ${(amount + 2.50).toFixed(2)}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'android' ? SPACING.md : 0,
    paddingBottom: SPACING.md,
    backgroundColor: THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.separator,
  },
  headerBtn: { padding: 8, width: 40 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: THEME.textPrimary },
  body: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  
  // Amount Card
  amountCard: {
    backgroundColor: THEME.primary,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  amountLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  amountValue: { color: '#fff', fontSize: 42, fontWeight: '800', marginVertical: 8 },
  amountSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },

  // Payment Methods
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: SPACING.lg,
  },
  methodCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME.separator,
  },
  methodActive: {
    borderColor: THEME.primary,
    backgroundColor: THEME.primaryLight,
  },
  methodIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  methodText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textSecondary,
    textAlign: 'center',
  },

  // Card Preview
  cardPreview: {
    backgroundColor: '#1A1F71',
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    minHeight: 200,
    justifyContent: 'space-between',
  },
  cardChip: {
    width: 50,
    height: 40,
  },
  cardNumberDisplay: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    marginVertical: SPACING.md,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginBottom: 4,
    letterSpacing: 1,
  },
  cardHolderName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardBrandLogo: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },

  // Mobile Money Card
  momoCard: {
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: 'center',
    borderWidth: 2,
  },
  momoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 12,
    marginBottom: 8,
  },
  momoSub: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Inputs
  inputGroup: { marginBottom: SPACING.lg },
  inputLabel: { 
    fontSize: 14, 
    fontWeight: '600',
    color: THEME.textPrimary, 
    marginBottom: 8,
    marginTop: 12,
  },
  inputWrapper: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: THEME.separator,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: { 
    flex: 1, 
    fontSize: 16,
    color: THEME.textPrimary,
    fontWeight: '500',
    backgroundColor: 'transparent',
  },
  inputRow: { flexDirection: 'row', marginTop: SPACING.sm },
  phonePrefix: {
    position: 'absolute',
    left: 16,
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 18,
  },

  // Coming Soon
  comingSoonCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: THEME.card,
    borderRadius: 16,
    marginVertical: SPACING.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: THEME.separator,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 16,
  },
  comingSoonText: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: THEME.card,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.22,
    borderColor: THEME.separator,
  },
  secondaryBtnText: {
    color: THEME.primary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Success Screen Styles
  successIconWrap: {
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: THEME.successLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.textPrimary,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  successSub: {
    fontSize: 16,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  successAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: THEME.success,
    textAlign: 'center',
    marginVertical: SPACING.lg,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: SPACING.lg,
    marginVertical: SPACING.lg,
    borderWidth: 1,
    borderColor: THEME.separator,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  summaryKey: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  summaryVal: {
    fontSize: 15,
    color: THEME.textPrimary,
    fontWeight: '600',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: THEME.separator,
    marginVertical: SPACING.sm,
  },

  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: THEME.successLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.success,
  },
  statusText: {
    fontSize: 13,
    color: THEME.success,
    fontWeight: '600',
  },
});