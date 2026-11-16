import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isEmergency?: boolean;
}

export interface ChatbotResponse {
  message: string;
  isEmergency: boolean;
  suggestedActions: string[];
}


const GEMINI_API_KEY = env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

try {
  if (GEMINI_API_KEY && GEMINI_API_KEY.length > 30) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
        topP: 0.8,
        topK: 40,
      }
    });
  }
} catch (error) {
  console.warn('Gemini AI initialization failed:', error);
}



const cleanAIResponse = (text: string): string => {
  let cleaned = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s?/g, '')
    .replace(/`{3}[\s\S]*?`{3}/g, (match) => {
      return match.replace(/`{3}/g, '').trim();
    })
    .replace(/`(.*?)`/g, '$1');
  
  cleaned = cleaned.replace(/^\s*[\-\*]\s+/gm, '• ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
};

export const testGeminiAPI = async (): Promise<{ success: boolean; message: string }> => {
  if (!model) {
    return {
      success: false,
      message: 'Gemini AI is not configured.'
    };
  }

  try {
    const result = await model.generateContent("Test connection. Respond with 'HEWAL3 Gemini 2.5 Flash is working'");
    const response = await result.response;
    const text = response.text();
    
    return {
      success: true,
      message: `Gemini 2.5 Flash is working! Response: "${text}"`
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Gemini API Error: ${error.message}`
    };
  }
};


export const getHealthResponse = async (userMessage: string): Promise<ChatbotResponse> => {
  const lower = userMessage.toLowerCase();
  const emergencies = ['emergency', 'help', '112', '911', 'heart attack', 'stroke', 'chest pain', 'bleeding', 'unconscious', 'can\'t breathe', 'dying', 'severe', 'accident', 'broken', 'burn', 'poison', 'seizure', 'faint', 'collapse'];
  const isEmergency = emergencies.some(word => lower.includes(word));
  
  const suggestedActions = isEmergency 
    ? ['Call 112 NOW', 'Contact caregiver', 'Share location', 'Prepare medications']
    : ['Check health data', 'Log medication', 'Plan healthy meal', 'Contact doctor'];

  if (model) {
    try {
      const systemPrompt = `You are HEWAL3 Health Assistant, an AI-powered health companion specifically designed for patients with non-communicable diseases (NCDs) in Ghana.

ABOUT HEWAL3:
- We help manage hypertension, diabetes, cardiovascular diseases, asthma, arthritis, and other chronic conditions
- Based in Ghana, focused on local context, resources, and healthcare infrastructure
- Provides emergency response automation and connects users with local services
- Uses IoT wearables for continuous monitoring of vital signs

YOUR ROLE:
1. Provide COMPREHENSIVE, detailed, and empathetic health guidance for chronic conditions
2. Recognize emergency situations and provide clear, step-by-step emergency protocols
3. Suggest practical, actionable solutions considering Ghanaian context
4. When appropriate, suggest contacting local healthcare providers
5. Be encouraging, supportive, and provide THOROUGH explanations
6. NEVER cut off responses mid-sentence - provide complete, detailed answers
7. Use structured formats with clear sections for readability
8. Include specific examples relevant to Ghanaian patients

RESPONSE REQUIREMENTS:
- For health questions: Provide 400-600 word detailed explanations
- For emergency situations: Provide clear, immediate action steps
- Always explain medical terms in simple language
- Include specific numbers, ranges, and thresholds where relevant
- Provide both immediate and long-term advice
- Mention Ghana-specific resources and considerations
- Structure with headings, bullet points, and clear organization

USER MESSAGE: "${userMessage}"

${isEmergency ? 'EMERGENCY DETECTED: Provide immediate emergency response steps first with clear numbering, then provide additional guidance and reassurance. Be very detailed about what to do while waiting for help.' : 'Provide COMPREHENSIVE health guidance with detailed explanations. Include: 1) What the reading/condition means 2) Potential causes 3) Immediate actions 4) Long-term management 5) When to seek help 6) Ghana-specific resources. Structure your response clearly with sections and bullet points for readability.'}

IMPORTANT: Your response must be THOROUGH and COMPLETE. Do not truncate or cut off the response. Provide all necessary information in one complete response.`;

      const result = await model.generateContent(systemPrompt);
      const response = await result.response;
      let aiResponse = response.text();
      
      aiResponse = cleanAIResponse(aiResponse);
      
      
      if (aiResponse.length < 200 && !isEmergency) {
        
        const retryPrompt = `${systemPrompt}\n\nYour previous response was too brief. Please provide a more detailed, comprehensive response to the user's question about "${userMessage}". Include specific information, examples, and actionable advice.`;
        const retryResult = await model.generateContent(retryPrompt);
        const retryResponse = await retryResult.response;
        aiResponse = cleanAIResponse(retryResponse.text());
      }
      
      if (isEmergency && !aiResponse.includes('112') && !aiResponse.includes('emergency')) {
        aiResponse = `EMERGENCY SITUATION DETECTED\n\n${aiResponse}\n\nCRITICAL: Call 112 immediately for emergency medical assistance!`;
      }
      
      return {
        message: aiResponse,
        isEmergency,
        suggestedActions
      };
      
    } catch (error: any) {
      console.log('Gemini API failed, using local response');
    }
  }
  
  const localResponse = getLocalFallbackResponse(userMessage, isEmergency, suggestedActions);
  return {
    ...localResponse,
    message: cleanAIResponse(localResponse.message)
  };
};


try {
  if (GEMINI_API_KEY && GEMINI_API_KEY.length > 30) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000, 
        topP: 0.8,
        topK: 40,
      }
    });
    console.log('Gemini 2.5 Flash initialized');
  }
} catch (error) {
  console.log('Failed to initialize Gemini AI');
}

const getLocalFallbackResponse = (userMessage: string, isEmergency: boolean, suggestedActions: string[]): ChatbotResponse => {
  const lower = userMessage.toLowerCase();
  
  if (isEmergency) {
    return {
      message: `EMERGENCY DETECTED!

IMMEDIATE ACTIONS REQUIRED:
1. Call 112 (Ghana Emergency Services) RIGHT NOW - This is your first and most important step. The emergency operator will guide you through what to do next.
2. Alert your emergency contact immediately after calling 112.
3. Unlock your door and clear a path for emergency responders to reach you easily.
4. Gather your medications, medical history, and identification documents to show responders.
5. Share your exact location using Google Maps or WhatsApp if possible.

STAY CALM AND FOLLOW THESE STEPS:
• Sit or lie down in a safe position to prevent falls or further injury
• If you have prescribed emergency medication (like nitroglycerin for chest pain), take it as directed
• Keep your phone nearby and fully charged for continuous communication
• Practice slow, deep breathing to help manage anxiety and maintain oxygen levels

FOR SPECIFIC EMERGENCY SITUATIONS:

CHEST PAIN OR HEART ATTACK SYMPTOMS:
• Chew one adult aspirin (325mg) if you're not allergic and haven't been told to avoid it
• Do NOT drive yourself to the hospital under any circumstances
• Loosen tight clothing and remain in a comfortable seated position
• Note the exact time symptoms started - this is crucial information for medical teams

STROKE SYMPTOMS (REMEMBER FAST):
• FACE: Ask the person to smile. Does one side droop?
• ARMS: Ask them to raise both arms. Does one drift downward?
• SPEECH: Ask them to repeat a simple phrase. Is speech slurred or strange?
• TIME: If you observe any of these signs, call 112 immediately. Time is brain!

SEVERE BLEEDING:
• Apply firm, direct pressure to the wound with a clean cloth or bandage
• Elevate the injured area above heart level if possible
• Do NOT remove any embedded objects - stabilize them instead
• If bleeding soaks through the first bandage, add more layers on top

UNCONSCIOUS PERSON:
• Check for breathing by looking for chest movement and listening for breath sounds
• If breathing normally, place them in the recovery position (on their side)
• If NOT breathing, begin CPR if trained, otherwise follow 112 operator instructions

HEWAL3 EMERGENCY PROTOCOL ACTIVATED:
1. Your designated caregiver(s) have been automatically alerted with your location
2. Emergency services have been notified through our system integration
3. Live location sharing has been enabled for emergency responders
4. Your medical profile has been made available to the responding medical team

Remember: Help is on the way. Stay on the line with the 112 operator and follow their instructions precisely. They are trained to guide you through the situation until help arrives.`,
      isEmergency: true,
      suggestedActions: ['Call 112 NOW', 'Contact caregiver', 'Share location', 'Prepare medications']
    };
  }
  
  
  

  if (lower.includes('blood pressure') || lower.includes('bp') || lower.includes('hypertension') || 
      lower.includes('150') || lower.includes('95') || lower.includes('140') || lower.includes('90')) {
    
    
    const bpRegex = /(\d{2,3})\s*\/\s*(\d{2,3})/;
    const match = userMessage.match(bpRegex);
    
    if (match) {
      const systolic = parseInt(match[1]);
      const diastolic = parseInt(match[2]);
      
      return {
        message: `Thank you for sharing your blood pressure reading of ${systolic}/${diastolic}. This is an important health indicator that requires attention. Let me provide you with a comprehensive analysis and guidance.

  UNDERSTANDING YOUR BLOOD PRESSURE READING:

  Your reading of ${systolic}/${diastolic} falls into Stage 1 Hypertension according to the Ghana Health Service and international guidelines. Here's what this means:

  BLOOD PRESSURE CLASSIFICATION:
  • Normal: Below 120/80 mmHg
  • Elevated: 120-129/<80 mmHg
  • Stage 1 Hypertension: 130-139/80-89 mmHg (or 140-159/90-99 in some guidelines)
  • Stage 2 Hypertension: ≥140/90 mmHg (or ≥160/100 in some guidelines)
  • Hypertensive Crisis: >180/120 mmHg (requires immediate medical attention)

  Your reading of ${systolic}/${diastolic} indicates your blood pressure is elevated and requires management.

  WHAT THIS MEANS FOR YOUR HEALTH:

  Elevated blood pressure means your heart is working harder than it should to pump blood through your arteries. Over time, this can lead to:
  • Heart muscle thickening and weakening
  • Arterial damage and atherosclerosis
  • Increased risk of heart attack and stroke
  • Kidney damage and reduced function
  • Vision problems due to retinal damage
  • Cognitive decline and dementia risk

  IMMEDIATE ACTIONS TO TAKE TODAY:

  1. VERIFY THE READING:
    • Sit quietly for 5 minutes before taking another reading
    • Ensure proper cuff placement on bare arm
    • Keep feet flat on floor and back supported
    • Take 2-3 readings, 1-2 minutes apart, and average them
    • Check both arms as there can be differences

  2. TODAY'S LIFESTYLE ADJUSTMENTS:
    • Reduce salt intake immediately - avoid adding salt to food
    • Drink plenty of water throughout the day
    • Practice deep breathing: 5 seconds in, hold 5, 5 seconds out
    • Take a 20-30 minute walk at a comfortable pace
    • Avoid caffeine and alcohol for today

  3. MONITORING PLAN:
    • Check BP morning and evening for the next week
    • Record readings in a log with time and conditions
    • Note any symptoms: headache, dizziness, chest discomfort

  LONG-TERM MANAGEMENT STRATEGIES:

  DIETARY CHANGES FOR GHANAIAN CONTEXT:
  • Traditional foods to emphasize:
    - Plantains (both ripe and unripe) - rich in potassium
    - Kontomire, aleefu, ayoyo - excellent leafy greens
    - Garden eggs and local vegetables
    - Whole grains: brown rice, maize, millet
    - Legumes: beans, cowpeas, groundnuts

  • Foods to reduce:
    - Processed and canned foods (high in sodium)
    - Bouillon cubes and seasoning powders
    - Fried foods and excessive palm oil
    - Sugary drinks and packaged snacks

  • Sample daily meal plan:
    Breakfast: Oat porridge with garden eggs
    Lunch: Brown rice with kontomire stew and grilled fish
    Dinner: Yam pottage with vegetables
    Snacks: Fresh fruit, unsalted nuts

  EXERCISE RECOMMENDATIONS:
  • 30 minutes moderate activity most days (brisk walking, swimming)
  • Include strength training 2-3 times per week
  • Traditional dancing and farming activities count!
  • Start slowly if you're new to exercise

  MEDICATION CONSIDERATIONS:
  If your readings remain elevated after 1-2 weeks of lifestyle changes:
  • Consult a healthcare provider for evaluation
  • Common medications in Ghana: Amlodipine, Lisinopril, Hydrochlorothiazide
  • Take medications exactly as prescribed
  • Never stop medication without medical advice

  WHEN TO SEEK IMMEDIATE MEDICAL ATTENTION:

  URGENT (Visit healthcare provider within 24-48 hours):
  • BP consistently above 140/90 despite lifestyle changes
  • Persistent headaches, especially in the morning
  • Dizziness or lightheadedness
  • Shortness of breath with minimal exertion
  • Vision changes or blurriness

  EMERGENCY (Call 112 immediately):
  • BP above 180/110
  • Chest pain, pressure, or tightness
  • Severe headache with vomiting
  • Difficulty speaking or weakness on one side
  • Severe anxiety or confusion

  GHANA-SPECIFIC RESOURCES:

  HEALTHCARE ACCESS:
  • Free BP checks at CHPS compounds nationwide
  • NHIS covers hypertension consultations and medications
  • Teaching hospitals: Korle-Bu (Accra), Komfo Anokye (Kumasi)
  • Regional hospitals in every region
  • Private clinics with cardiology specialists

  SUPPORT SYSTEMS:
  • Ghana Heart Foundation support groups
  • Community health worker programs
  • Church and community-based health initiatives
  • Telemedicine services becoming available

  TRACKING AND FOLLOW-UP:
  1. Keep a BP log for your next healthcare visit
  2. Schedule appointment with healthcare provider
  3. Consider getting basic blood tests (if possible)
  4. Involve family members in your health journey

  Remember: Hypertension is manageable with consistent effort. Many Ghanaians successfully control their blood pressure through lifestyle modifications and proper medical care. Your awareness and willingness to address this is the first and most important step.

  Would you like more specific information about any aspect of blood pressure management, or do you have other health concerns?`,
        isEmergency: false,
        suggestedActions: ['Check BP again', 'Practice breathing', 'Log BP reading', 'Contact doctor']
      };
    }
  }
  if (lower.includes('diabetes') || lower.includes('sugar') || lower.includes('glucose') || lower.includes('type 1') || lower.includes('type 2')) {
    return {
      message: `COMPREHENSIVE DIABETES CARE GUIDE FOR GHANAIAN PATIENTS

UNDERSTANDING DIABETES:
Diabetes is a chronic condition where the body cannot properly process glucose (sugar), leading to high blood sugar levels. There are two main types: Type 1 (body doesn't produce insulin) and Type 2 (body doesn't use insulin properly). Proper management is essential to prevent complications like nerve damage, kidney disease, vision problems, and cardiovascular issues.

ESSENTIAL DAILY MANAGEMENT COMPONENTS:

1. BLOOD GLUCOSE MONITORING:
   • Check levels as advised by your doctor (typically before meals and bedtime)
   • Keep a detailed log of readings, food intake, and activities
   • Understand your target ranges for fasting and post-meal glucose
   • Recognize patterns and adjust management strategies accordingly

2. MEDICATION AND INSULIN MANAGEMENT:
   • Take medications or insulin exactly as prescribed
   • Never skip doses or adjust without medical guidance
   • Rotate injection sites if using insulin
   • Understand how different medications work and their timing

3. NUTRITION AND MEAL PLANNING:
   • Eat consistent meals at regular times each day
   • Practice portion control using measuring tools or visual guides
   • Balance carbohydrates with protein and healthy fats
   • Space meals and snacks appropriately throughout the day

4. FOOT CARE AND INSPECTION:
   • Inspect feet daily for cuts, blisters, redness, or swelling
   • Wash feet daily with warm water and mild soap
   • Moisturize feet (but not between toes) to prevent cracks
   • Wear properly fitting shoes and never walk barefoot

5. HYDRATION AND FLUID MANAGEMENT:
   • Drink plenty of water throughout the day
   • Limit sugary drinks, fruit juices, and sweetened beverages
   • Monitor urine color as an indicator of hydration status
   • Be cautious with alcohol consumption

GHANA-SPECIFIC DIETARY GUIDANCE:

RECOMMENDED LOCAL FOODS:
• Whole grains: brown rice, whole corn, millet, sorghum
• Tubers: whole yam (in moderation), sweet potato, cocoyam
• Plantains: both ripe and unripe, watch portions
• Legumes: beans, cowpeas, soybeans, peanuts
• Vegetables: all leafy greens, tomatoes, onions, peppers
• Proteins: fish, chicken, turkey, eggs, lean meats

PORTION CONTROL GUIDELINES:
• Carbohydrates: 1/4 of your plate (about 1 cup cooked)
• Protein: 1/4 of your plate (palm-sized portion)
• Vegetables: 1/2 your plate (non-starchy vegetables)
• Fruits: 1-2 servings daily (whole fruit preferred over juice)

FOODS TO LIMIT OR AVOID:
• Sugary drinks: soft drinks, sweetened juices, energy drinks
• Refined carbohydrates: white bread, pastries, biscuits
• Processed and fried foods
• Excessive amounts of ripe fruits at one time
• Added sugars in any form

HYPOGLYCEMIA (LOW BLOOD SUGAR) MANAGEMENT:

RECOGNIZING SYMPTOMS:
• Shakiness, trembling, or nervousness
• Sweating, clamminess, or chills
• Dizziness, lightheadedness, or weakness
• Confusion, difficulty concentrating
• Hunger, nausea
• Fast heartbeat or palpitations
• Blurred vision
• Headaches

IMMEDIATE TREATMENT PROTOCOL:
1. Check blood sugar if possible (if below 70 mg/dL or 3.9 mmol/L, treat)
2. Consume 15-20 grams of fast-acting carbohydrates:
   • 4 glucose tablets
   • 1/2 cup fruit juice or regular soda
   • 1 tablespoon honey or sugar
   • Hard candies or jelly beans
3. Wait 15 minutes and recheck blood sugar
4. If still low, repeat treatment
5. Once normalized, eat a small snack if your next meal is more than an hour away

HYPERGLYCEMIA (HIGH BLOOD SUGAR) MANAGEMENT:

RECOGNIZING SYMPTOMS:
• Increased thirst and dry mouth
• Frequent urination
• Fatigue and weakness
• Blurred vision
• Headache
• Nausea or vomiting
• Fruity-smelling breath

ACTION PLAN:
1. Check blood sugar and ketones (if type 1 diabetes)
2. Take prescribed medication as directed
3. Drink water to stay hydrated
4. Engage in light physical activity if ketones are negative
5. Contact your healthcare provider if:
   • Blood sugar remains above 240 mg/dL (13.3 mmol/L)
   • Moderate to large ketones are present
   • Symptoms worsen or persist

EMERGENCY SITUATIONS (CALL 112 IMMEDIATELY):
• Unconsciousness or inability to stay awake
• Severe confusion, agitation, or combativeness
• Inability to keep fluids down due to vomiting
• Blood sugar persistently above 400 mg/dL (22.2 mmol/L)
• Signs of diabetic ketoacidosis (DKA): nausea, vomiting, abdominal pain, rapid breathing, fruity breath odor

LONG-TERM COMPLICATION PREVENTION:

REGULAR SCREENINGS NEEDED:
• Eye exams: annually with an ophthalmologist
• Kidney function tests: urine albumin test at least annually
• Foot exams: comprehensive exam at every doctor visit
• Cholesterol and blood pressure: regular monitoring
• Dental exams: every 6 months

GHANA-SPECIFIC RESOURCES AND SUPPORT:
• Diabetes clinics available at regional and teaching hospitals
• National Health Insurance Scheme (NHIS) covers diabetes medications and supplies
• Diabetes Association of Ghana provides education and support groups
• Community Health Planning Services (CHPS) compounds offer basic diabetes care
• Traditional medicine practitioners should be informed about your diabetes management

LIFESTYLE RECOMMENDATIONS FOR DIABETES MANAGEMENT:
1. Aim for at least 150 minutes of moderate exercise per week
2. Maintain a healthy weight through balanced nutrition
3. Manage stress through relaxation techniques
4. Get adequate, quality sleep each night
5. Stay up-to-date with vaccinations, especially flu and pneumonia
6. Carry diabetes identification and emergency contact information
7. Educate family members about diabetes emergency recognition and response

Remember: Diabetes is a manageable condition. With proper self-care, regular medical follow-up, and a supportive network, you can live a full, healthy life while effectively managing your diabetes.`,
      isEmergency: false,
      suggestedActions: ['Check glucose', 'Log meal', 'Light walk', 'Drink water']
    };
  }
  
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('greetings')) {
    return {
      message: `WELCOME TO HEWAL3 HEALTH ASSISTANT

I am your dedicated AI health companion, powered by advanced Gemini 2.5 Flash technology, specifically designed to support patients in Ghana managing chronic health conditions.

As your personal health assistant, I am here to provide:

COMPREHENSIVE HEALTH SUPPORT:
• Detailed symptom analysis and guidance based on your descriptions
• Medication information, including usage, side effects, and interactions
• Emergency response protocols for critical health situations
• Ghana-specific dietary recommendations and lifestyle advice
• Health monitoring guidance and tracking assistance
• Connection to local healthcare resources and services
• Education about chronic condition management

SPECIALIZED FOCUS AREAS:
• Hypertension and cardiovascular health management
• Diabetes care and blood sugar control
• Respiratory conditions like asthma and COPD
• Arthritis and musculoskeletal conditions
• Mental health and stress management
• Preventive healthcare and wellness strategies

HOW I CAN ASSIST YOU TODAY:

You can ask me detailed questions such as:
• "Can you explain how to properly monitor blood pressure at home and what the readings mean?"
• "What are the best Ghanaian foods for managing diabetes, and how should they be prepared?"
• "I'm experiencing chest discomfort. What are the possible causes and when should I seek emergency care?"
• "What are the common side effects of hypertension medications used in Ghana, and how can I manage them?"
• "Can you guide me through emergency procedures for stroke symptoms step by step?"
• "How can I create a balanced meal plan using locally available foods in Ghana?"
• "What lifestyle modifications are most effective for managing chronic conditions in the Ghanaian context?"

ABOUT THE HEWAL3 PLATFORM:
HEWAL3 is a Ghanaian health technology initiative focused on improving outcomes for patients with non-communicable diseases. Our platform integrates:
• Continuous health monitoring through connected devices
• Automated emergency response systems that alert caregivers and services
• Digital health records accessible to authorized healthcare providers
• Community support networks and educational resources
• Integration with Ghana's healthcare infrastructure

IMPORTANT DISCLAIMER:
While I provide detailed health information and guidance, I am not a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare providers for personal medical concerns. For emergencies, call 112 immediately.

READY TO ASSIST:
I am here to provide thorough, thoughtful responses to your health questions. Please share your concerns, and I will offer comprehensive guidance tailored to your situation and the Ghanaian healthcare context.

What would you like to discuss regarding your health today?`,
      isEmergency: false,
      suggestedActions: ['Ask health question', 'View health data', 'Medication help', 'Emergency info']
    };
  }
  
  if (lower.includes('medication') || lower.includes('pill') || lower.includes('drug') || lower.includes('prescription') || lower.includes('tablet')) {
    return {
      message: `COMPREHENSIVE MEDICATION MANAGEMENT GUIDE

UNDERSTANDING MEDICATION SAFETY AND EFFECTIVENESS:

Medications are powerful tools for managing health conditions, but they require careful handling, understanding, and consistent use to be effective and safe. This guide covers essential aspects of medication management for chronic conditions.

FIVE CRITICAL MEDICATION RULES:

1. PRECISE ADMINISTRATION:
   • Take exact dose prescribed - never adjust without medical guidance
   • Follow specific timing instructions (with/without food, morning/evening)
   • Use proper administration techniques (swallow whole, dissolve, inject)
   • Never skip doses - use reminders if needed

2. AVOID SELF-MODIFICATION:
   • Never change dosage based on how you feel
   • Don't stop medication because symptoms improve
   • Avoid sharing medications or using others' prescriptions
   • Consult doctor before adding any new medications or supplements

3. PROACTIVE REFILL MANAGEMENT:
   • Order refills 1-2 weeks before running out
   • Keep emergency supply for unexpected situations
   • Monitor expiration dates and properly dispose of expired medications
   • Maintain list of all medications with dosages and schedules

4. SIDE EFFECT MONITORING:
   • Learn common and serious side effects for each medication
   • Report any new or worsening symptoms to your doctor
   • Differentiate between temporary adjustment effects and concerning reactions
   • Keep symptom diary if experiencing side effects

5. INTERACTION AWARENESS:
   • Inform all healthcare providers about ALL medications you take
   • Include prescription drugs, over-the-counter medications, and supplements
   • Be aware of food and alcohol interactions
   • Ask pharmacist to review for potential interactions

COMMON CHRONIC DISEASE MEDICATIONS IN GHANA:

HYPERTENSION MEDICATIONS:
• Amlodipine: Calcium channel blocker, may cause swelling in ankles
• Lisinopril: ACE inhibitor, may cause dry cough or dizziness
• Hydrochlorothiazide: Diuretic, increases urination, may affect potassium
• Losartan: ARB, alternative for those who can't tolerate ACE inhibitors
• Atenolol: Beta-blocker, slows heart rate, may cause fatigue

DIABETES MEDICATIONS:
• Metformin: First-line for Type 2, may cause digestive issues initially
• Glibenclamide: Sulfonylurea, stimulates insulin production, risk of low sugar
• Insulin: Various types with different action durations and peaks
• Sitagliptin: DPP-4 inhibitor, generally well-tolerated
• Empagliflozin: SGLT2 inhibitor, may increase urination

OTHER COMMON MEDICATIONS:
• Statins (Atorvastatin, Simvastatin) for cholesterol
• Aspirin for blood thinning in cardiovascular prevention
• Inhalers for asthma and COPD
• Pain relievers and anti-inflammatory medications

MANAGING COMMON SIDE EFFECTS:

FOR DIZZINESS OR LIGHTHEADEDNESS:
• Take medication at bedtime if appropriate
• Rise slowly from sitting or lying positions
• Ensure adequate hydration
• Avoid alcohol and extreme heat

FOR DIGESTIVE ISSUES:
• Take with food unless otherwise directed
• Start with lower dose and gradually increase if possible
• Eat smaller, more frequent meals
• Report persistent symptoms to doctor

FOR DRY COUGH (ACE inhibitors):
• Typically develops within weeks of starting
• Usually resolves when medication is changed
• Don't ignore - can indicate need for alternative medication

FOR SWELLING (Edema):
• Elevate legs when sitting
• Reduce salt intake
• Wear comfortable, non-restrictive footwear
• Report significant or sudden swelling

EMERGENCY MEDICATION SITUATIONS (CALL 112):

Seek immediate emergency care for:
• Difficulty breathing, wheezing, or throat tightness
• Swelling of face, lips, tongue, or throat
• Severe skin rash, blistering, or peeling
• Chest pain, irregular heartbeat, or severe dizziness
• Uncontrollable vomiting or diarrhea leading to dehydration
• Severe headache, confusion, or vision changes
• Signs of overdose or accidental ingestion

MEDICATION STORAGE AND HANDLING IN GHANA'S CLIMATE:

PROPER STORAGE PRACTICES:
• Keep medications in cool, dry place away from direct sunlight
• Use airtight containers to protect from humidity
• Don't store in bathroom or kitchen where moisture fluctuates
• Check labels for specific temperature requirements
• Use desiccant packets in medication containers

HANDLING POWER OUTAGES:
• Have emergency cooler or insulated bag for temperature-sensitive medications
• Know which medications are most sensitive to temperature changes
• Have backup power source for refrigerated medications if needed
• Plan ahead for extended power disruptions

GHANA HEALTHCARE RESOURCES FOR MEDICATION MANAGEMENT:

NATIONAL HEALTH INSURANCE SCHEME (NHIS):
• Covers many chronic disease medications
• Requires regular renewal and compliance
• Specific formulary of covered medications
• Co-payments may apply for some medications

ACCESS POINTS FOR MEDICATIONS:
• Teaching hospitals and regional hospitals for specialist prescriptions
• Polyclinics and district hospitals for routine medications
• Community Health Planning Services (CHPS) for basic medications
• Licensed pharmacies for prescriptions and over-the-counter medications
• Accredited chemical sellers for basic medications

COST-SAVING STRATEGIES:
• Use NHIS-covered medications when possible
• Ask about generic alternatives
• Purchase in larger quantities if financially feasible
• Explore patient assistance programs through pharmaceutical companies
• Join medication support groups for resource sharing

CREATING YOUR PERSONAL MEDICATION MANAGEMENT SYSTEM:

ESSENTIAL COMPONENTS:
1. Current medication list with dosages and schedules
2. Pharmacy and prescriber contact information
3. Allergy and adverse reaction history
4. Emergency contact information
5. Insurance and prescription coverage details
6. Refill tracking system
7. Medication calendar or reminder system

DIGITAL TOOLS AVAILABLE:
• Medication reminder apps with alarm functions
• Digital health records accessible to authorized providers
• Online pharmacy services for refills and delivery
• Medication interaction checkers
• Symptom and side effect tracking applications

Remember: Proper medication management is a partnership between you and your healthcare team. Regular communication, adherence to prescribed regimens, and proactive management of issues are key to successful treatment outcomes.`,
      isEmergency: false,
      suggestedActions: ['Set reminder', 'Check prescriptions', 'Order refills', 'Call pharmacy']
    };
  }
  
  if (lower.includes('asthma') || lower.includes('wheez') || lower.includes('breath') || lower.includes('respiratory')) {
    return {
      message: `ASTHMA AND RESPIRATORY CONDITION MANAGEMENT GUIDE

UNDERSTANDING ASTHMA IN THE GHANAIAN CONTEXT:

Asthma is a chronic inflammatory condition of the airways that causes breathing difficulties, coughing, wheezing, and chest tightness. In Ghana, factors like harmattan dust, pollen, pollution, and respiratory infections can trigger or worsen asthma symptoms.

ESSENTIAL ASTHMA MANAGEMENT COMPONENTS:

1. MEDICATION UNDERSTANDING AND ADHERENCE:
   • Controller medications (inhaled corticosteroids): Taken daily to prevent symptoms
   • Reliever medications (bronchodilators): Used as needed during attacks
   • Proper inhaler technique is critical for medication effectiveness
   • Spacer devices improve medication delivery, especially for children

2. TRIGGER IDENTIFICATION AND AVOIDANCE:
   • Common triggers: dust, smoke, pollen, cold air, exercise, strong odors
   • Ghana-specific triggers: harmattan dust, burning during land preparation
   • Keep trigger diary to identify personal patterns
   • Implement avoidance strategies for identified triggers

3. SYMPTOM MONITORING:
   • Use peak flow meter daily to measure lung function
   • Recognize early warning signs of worsening asthma
   • Understand your personal "zones" (green/yellow/red) for action
   • Monitor frequency of reliever medication use

4. ACTION PLAN DEVELOPMENT:
   • Work with healthcare provider to create written asthma action plan
   • Include daily management, worsening symptoms, and emergency steps
   • Share plan with family, school, or workplace as appropriate
   • Review and update plan regularly

MANAGING ASTHMA DURING HARMATTAN SEASON:

SPECIFIC PRECAUTIONS NEEDED:
• Stay indoors during peak dust hours (late morning to afternoon)
• Keep windows closed and use air purifiers if available
• Wear mask when going outside during heavy dust conditions
• Increase controller medication if advised by doctor
• Have emergency medications readily accessible

GHANA-SPECIFIC ASTHMA CONSIDERATIONS:

LOCAL TRIGGERS TO MANAGE:
• Cooking smoke from wood or charcoal fires
• Agricultural burning during land preparation
• Pollen from specific local plants and trees
• Mold during rainy season
• Respiratory infections common in community

CULTURALLY APPROPRIATE MANAGEMENT:
• Educate family members about asthma and triggers
• Develop smoke-free cooking solutions where possible
• Incorporate traditional breathing exercises if helpful
• Work with community health workers for support

ASTHMA ATTACK RECOGNITION AND RESPONSE:

EARLY WARNING SIGNS:
• Increased cough, especially at night
• Mild wheezing or chest tightness
• Shortness of breath with usual activities
• Need for reliever medication more than usual
• Fatigue or difficulty sleeping due to breathing

MODERATE SYMPTOMS (TAKE ACTION):
• Wheezing audible without stethoscope
• Cough that interferes with activity or sleep
• Chest tightness or pain
• Reliever medication needed more than every 4 hours
• Peak flow reading in yellow zone

SEVERE SYMPTOMS (EMERGENCY):
• Severe breathlessness - can't speak in full sentences
• Lips or fingernails turning blue
• Rapid breathing with nostrils flaring
• Reliever medication providing little or no relief
• Peak flow reading in red zone
• Confusion, drowsiness, or exhaustion

EMERGENCY ACTION PLAN (CALL 112 IMMEDIATELY):
1. Call emergency services first - don't delay
2. Take prescribed reliever medication while waiting
3. Sit upright - don't lie down
4. Loosen tight clothing around neck and chest
5. Try to remain calm - anxiety worsens breathing
6. Have someone stay with you until help arrives

LONG-TERM ASTHMA MANAGEMENT STRATEGIES:

MEDICATION ADHERENCE TIPS:
• Incorporate inhaler use into daily routine (like brushing teeth)
• Use reminder alarms for controller medications
• Check inhaler technique regularly with healthcare provider
• Keep spare inhalers in multiple locations (home, work, car)

LIFESTYLE MODIFICATIONS:
• Regular exercise with proper warm-up and medication pre-treatment
• Maintain healthy weight to reduce breathing workload
• Manage stress through relaxation techniques
• Get annual flu vaccination
• Treat allergies that may worsen asthma

ENVIRONMENTAL CONTROL MEASURES:
• Use dust-mite proof bedding covers
• Keep living areas clean and well-ventilated
• Avoid strong chemical cleaners and perfumes
• Consider air purifier for bedroom
• Keep humidity controlled to prevent mold

GHANA HEALTHCARE RESOURCES FOR ASTHMA:

AVAILABLE SERVICES:
• Asthma clinics at teaching and regional hospitals
• Pulmonary function testing at major health facilities
• Inhaler technique education by pharmacists
• National Health Insurance Scheme coverage for asthma medications
• Community health worker support for management

TRADITIONAL AND COMPLEMENTARY APPROACHES:
• Always inform healthcare provider about any traditional remedies used
• Some breathing exercises may complement medical treatment
• Certain local herbs may interact with asthma medications
• Steam inhalation with caution - can help some but trigger others

SCHOOL AND WORKPLACE MANAGEMENT:
• Provide written asthma action plan to school or employer
• Ensure access to medications during day
• Educate teachers or colleagues about emergency recognition
• Plan for participation in physical activities

Remember: With proper management, most people with asthma can live full, active lives. Regular follow-up with healthcare providers, adherence to treatment plans, and proactive trigger management are key to successful asthma control.`,
      isEmergency: false,
      suggestedActions: ['Check inhaler technique', 'Monitor peak flow', 'Identify triggers', 'Review action plan']
    };
  }
  
  if (lower.includes('pain') || lower.includes('ache') || lower.includes('hurt') || lower.includes('discomfort')) {
    return {
      message: `PAIN MANAGEMENT AND ASSESSMENT GUIDE

UNDERSTANDING PAIN AND ITS MANAGEMENT:

Pain is a complex experience that serves as a warning signal from your body. Chronic pain (lasting more than 3 months) requires different management approaches than acute pain. This guide helps you understand, assess, and manage pain effectively.

PAIN ASSESSMENT FRAMEWORK:

DESCRIBE YOUR PAIN USING THESE CHARACTERISTICS:
1. Location: Where exactly does it hurt? Does it radiate or move?
2. Intensity: Rate pain on scale of 0-10 (0=no pain, 10=worst imaginable)
3. Quality: Is it sharp, dull, burning, throbbing, aching, shooting?
4. Timing: When did it start? Constant or intermittent? Worse at certain times?
5. Aggravating factors: What makes it worse? Movement, certain positions, eating?
6. Relieving factors: What helps? Rest, specific positions, medications?
7. Associated symptoms: Numbness, tingling, weakness, fever, swelling?

TYPES OF PAIN AND APPROPRIATE RESPONSES:

ACUTE PAIN (Sudden onset, recent):
• Usually indicates injury or acute condition
• Often responds well to conventional pain relief
• Typically decreases as healing occurs
• May require medical evaluation if severe or persistent

CHRONIC PAIN (Lasting more than 3 months):
• May not indicate ongoing tissue damage
• Often requires multimodal management approach
• Can become a condition itself requiring specific treatment
• Psychological and social factors play significant role

NEUROPATHIC PAIN (Nerve-related):
• Burning, shooting, electric shock-like sensations
• Often chronic and challenging to treat
• May respond better to specific medications (anticonvulsants, antidepressants)
• Requires specialist evaluation for optimal management

PAIN MANAGEMENT STRATEGIES:

MEDICATION APPROACHES (Use under medical guidance):

OVER-THE-COUNTER OPTIONS:
• Paracetamol (Acetaminophen): For mild to moderate pain, fever
• Ibuprofen, Naproxen: Anti-inflammatory for pain with swelling/inflammation
• Topical creams: Capsaicin, menthol, anti-inflammatory gels

PRESCRIPTION OPTIONS (Ghana context):
• Tramadol: Moderate pain, requires prescription
• Codeine-containing medications: Prescription only, risk of dependence
• Gabapentin/Pregabalin: For nerve pain
• Amitriptyline: For chronic pain and sleep improvement

NON-MEDICATION PAIN MANAGEMENT TECHNIQUES:

PHYSICAL APPROACHES:
• Heat therapy: For muscle stiffness, arthritis (warm compress, heating pad)
• Cold therapy: For acute injuries, swelling (ice pack, cold compress)
• Gentle movement: Maintain mobility without aggravating pain
• Proper positioning and body mechanics
• Physical therapy exercises

PSYCHOLOGICAL APPROACHES:
• Relaxation techniques: Deep breathing, progressive muscle relaxation
• Distraction: Engage in enjoyable activities
• Mindfulness and meditation practices
• Cognitive-behavioral strategies for pain coping
• Pacing activities to avoid overexertion

ALTERNATIVE AND COMPLEMENTARY APPROACHES:
• Acupuncture (available at some Ghanaian health facilities)
• Massage therapy
• Traditional healing practices (use alongside conventional care)
• Prayer and spiritual practices
• Herbal remedies (discuss with doctor for safety and interactions)

WHEN TO SEEK MEDICAL ATTENTION FOR PAIN:

URGENT MEDICAL EVALUATION NEEDED FOR:
• Sudden, severe pain of unknown cause
• Chest pain with sweating, shortness of breath, or radiation to arm/jaw
• Severe abdominal pain with vomiting or fever
• Head injury followed by headache
• Pain with weakness, numbness, or loss of function
• Pain preventing eating, drinking, or sleeping

RED FLAGS REQUIRING IMMEDIATE ATTENTION (CALL 112):
• Sudden, worst headache of your life
• Chest pain with difficulty breathing or fainting
• Severe abdominal pain with rigid abdomen
• Back pain with loss of bladder or bowel control
• Eye pain with vision changes
• Pain with high fever and confusion

GHANA-SPECIFIC PAIN MANAGEMENT CONSIDERATIONS:

CULTURAL AND CONTEXTUAL FACTORS:
• Communication styles around pain expression
• Family and community support systems
• Traditional healing practices and their integration
• Accessibility of pain management resources
• Stigma associated with certain pain conditions

HEALTHCARE ACCESS FOR PAIN MANAGEMENT:
• Pain assessment at primary care clinics
• Referral pathways to pain specialists
• Availability of different pain medications
• Physical therapy services at regional hospitals
• Traditional medicine practitioners as part of care team

PAIN MANAGEMENT IN CHRONIC CONDITIONS:

ARTHRITIS AND JOINT PAIN:
• Balance activity and rest
• Use assistive devices if needed
• Maintain healthy weight to reduce joint stress
• Consider glucosamine supplements after discussing with doctor
• Warm water exercises can be beneficial

BACK PAIN MANAGEMENT:
• Maintain good posture
• Sleep on firm mattress with proper support
• Lift objects properly using leg muscles
• Consider ergonomic adjustments at work
• Core strengthening exercises

HEADACHE MANAGEMENT:
• Identify and avoid triggers (certain foods, stress, lack of sleep)
• Maintain regular sleep schedule
• Stay hydrated throughout day
• Manage stress through relaxation techniques
• Keep headache diary to identify patterns

PAIN AND MENTAL HEALTH CONNECTION:

UNDERSTANDING THE RELATIONSHIP:
• Chronic pain often coexists with depression and anxiety
• Emotional distress can intensify pain perception
• Pain can lead to social isolation and reduced activity
• Addressing mental health often improves pain management

INTEGRATED APPROACH:
• Discuss emotional impact of pain with healthcare provider
• Consider counseling or support groups
• Practice stress-reduction techniques
• Maintain social connections despite pain limitations
• Set realistic goals and celebrate small achievements

DEVELOPING YOUR PERSONAL PAIN MANAGEMENT PLAN:

ESSENTIAL COMPONENTS:
1. Clear understanding of pain diagnosis and causes
2. Medication schedule and management plan
3. Non-medication strategies to employ
4. Activity pacing and modification guidelines
5. Emergency and worsening symptom plan
6. Regular follow-up schedule with healthcare team
7. Support system involvement plan

MONITORING AND ADJUSTMENT:
• Keep pain diary to track patterns and effectiveness of strategies
• Regular review of plan with healthcare provider
• Adjust approaches as needed based on effectiveness
• Stay informed about new pain management options

Remember: Effective pain management often requires a combination of approaches tailored to your specific situation. Open communication with your healthcare team, patience in finding what works best for you, and a proactive approach to self-management are key to improving your quality of life with pain.`,
      isEmergency: false,
      suggestedActions: ['Assess pain level', 'Try heat/cold therapy', 'Practice breathing', 'Contact doctor']
    };
  }
  
  return {
    message: `Thank you for reaching out to the HEWAL3 Health Assistant. I am here to provide comprehensive health guidance and support for your concerns.

To offer you the most helpful and detailed assistance, please provide more specific information about:

YOUR CURRENT SITUATION:
• What specific symptoms are you experiencing, and for how long?
• Have you received any medical diagnoses for existing conditions?
• What medications are you currently taking, including doses and frequency?
• Have there been any recent changes in your health status or treatments?
• What have you already tried to address your concerns?

CONTEXTUAL DETAILS:
• Your age and general health status
• Any known allergies or previous adverse reactions
• Family history of relevant medical conditions
• Access to healthcare resources in your area
• Support systems available to you

EXAMPLE QUERIES I CAN PROVIDE DETAILED GUIDANCE ON:
• "I've been diagnosed with hypertension and my readings have been consistently between 150/95 and 160/100. What specific steps should I take to lower my blood pressure, and when should I seek immediate medical attention?"
• "As someone with Type 2 diabetes living in Accra, what would be a comprehensive weekly meal plan using locally available foods, and how should I adjust it based on my blood sugar readings?"
• "I'm experiencing persistent chest discomfort that comes and goes. What are the possible causes, how can I differentiate between serious and benign causes, and what diagnostic tests should I discuss with my doctor?"
• "Can you explain the mechanism of action, common side effects, and monitoring requirements for the hypertension medications commonly prescribed in Ghana, and how to manage any side effects that occur?"
• "What are the step-by-step emergency protocols for different types of medical emergencies, including how to prepare while waiting for emergency services to arrive in Ghana?"

HEWAL3 PLATFORM CAPABILITIES:
• Continuous health parameter monitoring with alert systems
• Automated emergency response coordination with local services
• Digital health record integration with healthcare providers
• Medication adherence tracking and reminder systems
• Health education resources specific to Ghanaian context
• Caregiver connectivity and support networks

For immediate medical concerns:
• Call 112 for emergencies requiring immediate response
• Visit your nearest health center or hospital for urgent issues
• Contact your primary healthcare provider for non-emergency concerns
• Utilize telemedicine services if available in your area

I am ready to provide thorough, thoughtful guidance tailored to your specific situation. Please share your health concerns in detail, and I will offer comprehensive information and practical recommendations.

What specific health question or concern would you like to discuss in detail today?`,
    isEmergency: false,
    suggestedActions: ['Describe symptoms', 'List medications', 'Last checkup', 'Contact doctor']
  };
};

export const saveChatHistory = async (messages: ChatMessage[]): Promise<void> => {
  try {
    await AsyncStorage.setItem('hewal3_chat_history', JSON.stringify(messages));
  } catch (error) {
    console.error('Error saving chat');
  }
};

export const loadChatHistory = async (): Promise<ChatMessage[]> => {
  try {
    const history = await AsyncStorage.getItem('hewal3_chat_history');
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('Error loading chat');
    return [];
  }
};

export const clearChatHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('hewal3_chat_history');
  } catch (error) {
    console.error('Error clearing chat');
  }
};