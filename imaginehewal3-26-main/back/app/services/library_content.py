"""Original wellbeing articles written for HEWAL3. General information only; figures are the widely published public-health ones
(WHO physical activity, salt and sugar guidance; adult sleep 7 to 9 hours). Not medical advice, and they say so on screen.
No videos are listed: a video is added only when there is a link that has been checked and that we are allowed to show."""
from typing import Dict, List

CATEGORIES = {"physical": "Physical", "mental": "Mental", "nutrition": "Nutrition", "sleep": "Sleep and rest"}
NOTICE = "General health information written for HEWAL3. It is not personal medical advice. Talk to your clinician before changing treatment."

ARTICLES: List[Dict] = [
    {"key": "move-150", "category": "physical", "minutes": 3, "featured": True, "title": "How much movement is enough?",
     "summary": "The simple weekly target most adults are given, and easy ways to reach it.",
     "body": ["Health agencies such as the WHO suggest adults aim for 150 to 300 minutes of moderate activity a week, such as brisk walking, or 75 to 150 minutes of vigorous activity. That is about 20 to 40 minutes a day.",
              "You do not need a gym. A brisk walk where you can talk but not sing counts. Ten minutes three times a day counts the same as thirty minutes at once.",
              "Start from where you are. If you now walk 2,000 steps a day, add a few hundred this week. Small, steady changes last longer than big ones that you drop after ten days.",
              "Muscle-strengthening on two days a week, such as carrying shopping, climbing stairs or body-weight exercises, helps balance, bones and blood sugar.",
              "If you have a heart condition, chest pain, dizziness or a new health problem, ask your clinician what level is right for you before you increase."]},
    {"key": "sit-less", "category": "physical", "minutes": 2, "title": "Break up long sitting",
     "summary": "Why standing up every half hour matters, even on days you exercise.",
     "body": ["Sitting for hours in a row is linked with higher blood sugar and blood pressure, even in people who exercise. The risk is lower when the sitting is interrupted.",
              "Stand, stretch or walk for two to three minutes every 30 to 60 minutes. Taking phone calls on your feet and walking to a colleague instead of sending a message are easy ways to do it.",
              "Tie the break to something you already do: after each email batch, each cup of water, each meeting."]},
    {"key": "heart-walk", "category": "physical", "minutes": 3, "title": "Walking for a healthier heart",
     "summary": "Why regular walking helps blood pressure, and how to build the habit.",
     "body": ["Regular brisk walking is one of the most studied ways to support heart health. It can help lower blood pressure, improve cholesterol and help with weight.",
              "Choose a time that already exists in your day: before breakfast, after the evening meal, or on the way home. Habits stick best when they are attached to something that already happens.",
              "Track the result in the app: your steps, and your blood pressure readings if you measure them. Look at the weekly trend, not a single day.",
              "Stop and get help if you feel chest pain or pressure, severe breathlessness or faintness."]},
    {"key": "stress-reset", "category": "mental", "minutes": 3, "featured": True, "title": "A two minute stress reset",
     "summary": "A slow breathing exercise you can do anywhere.",
     "body": ["When you feel tense, breathing slowly tells your body it is safe. Try this for two minutes.",
              "Sit with your back supported. Breathe in through your nose for four counts. Breathe out slowly through your mouth for six counts. The longer out-breath is the part that calms you.",
              "Repeat about ten times. Let your shoulders drop on each out-breath. If you feel light-headed, breathe normally for a minute.",
              "This does not remove the cause of stress, but it lowers the intensity so you can think clearly. If worry or low mood lasts for weeks, please talk to a clinician or counsellor. That is a sign to ask for help, not a weakness."]},
    {"key": "talk-it-out", "category": "mental", "minutes": 3, "title": "Why talking helps, and who to tell",
     "summary": "Keeping worries inside makes them heavier. Small ways to start the conversation.",
     "body": ["Feeling low or anxious is common, and it is nothing to be ashamed of. Talking to someone you trust often makes a problem feel smaller.",
              "You can start simply: 'I have not been feeling like myself lately. Can I tell you about it?' Choose a person who listens without rushing to fix things.",
              "Staying connected also protects health: regular contact with friends, family or a group is linked with better mood and better long-term health.",
              "If you ever think about harming yourself, call your emergency number now (112 in Ghana) or tell someone near you. You deserve support right away."]},
    {"key": "mood-routine", "category": "mental", "minutes": 2, "title": "Small daily things that lift mood",
     "summary": "Four low-effort habits with good evidence.",
     "body": ["Daylight in the morning, a short walk, regular meals and a regular bedtime each help mood, and they work better together.",
              "Pick one. Do it for a week. Then add a second. Doing too much at once is the most common reason people stop.",
              "Do one small thing each day that you enjoy, even if it is ten minutes. Enjoyment is not a luxury, it is part of treatment for low mood."]},
    {"key": "plate", "category": "nutrition", "minutes": 3, "featured": True, "title": "Build a balanced plate",
     "summary": "A simple way to think about a meal without counting anything.",
     "body": ["Fill about half your plate with vegetables or fruit, a quarter with whole grains or starchy foods such as brown rice, millet, beans or yam, and a quarter with protein such as fish, eggs, beans or lean meat.",
              "Water is the best drink. Sugary drinks add a lot of sugar quickly. The WHO suggests keeping free sugars below 10 percent of daily energy, and below 5 percent for added benefit.",
              "You do not have to change everything. Swap one thing this week, such as a sugary drink for water, or white bread for a whole grain option.",
              "If you have diabetes, kidney disease or another condition with a special diet, follow your clinician's advice first."]},
    {"key": "salt", "category": "nutrition", "minutes": 2, "title": "Less salt, lower blood pressure",
     "summary": "Where the salt hides, and easy ways to use less.",
     "body": ["The WHO recommends adults have less than 5 grams of salt a day, about one level teaspoon. Eating less salt helps lower blood pressure.",
              "Much of the salt is not from the salt shaker. Stock cubes, seasoning powders, processed meat, salted fish and snacks add up quickly.",
              "Try herbs, onion, ginger, garlic, pepper and lemon for flavour. Taste your food before you add salt. Your taste adjusts within a few weeks."]},
    {"key": "log-meals", "category": "nutrition", "minutes": 2, "title": "Why logging meals works",
     "summary": "Noticing what you eat is the first step to changing it.",
     "body": ["People who write down what they eat tend to notice patterns they did not see before, such as late-night snacking or skipped breakfasts.",
              "You do not need to be perfect. In HEWAL3 you can take a photo of a meal and see an estimate. Estimates can be wrong, so use them as a guide to trends, not exact numbers.",
              "Look at your week, not a single meal. One heavy meal changes nothing; a pattern does."]},
    {"key": "sleep-basics", "category": "sleep", "minutes": 3, "featured": True, "title": "Sleep: the basics",
     "summary": "How much adults need and the habits that make the biggest difference.",
     "body": ["Most adults need 7 to 9 hours of sleep. Regularly sleeping much less is linked with higher blood pressure, weight gain and low mood.",
              "Keep a regular wake-up time, even at weekends. This steadies your body clock more than anything else.",
              "Keep the room dark, cool and quiet. Stop caffeine in the afternoon. Put the phone away for the last half hour before bed, or at least turn down its brightness.",
              "If you cannot sleep after about 20 minutes, get up and do something quiet in low light, then try again.",
              "If you snore loudly, stop breathing in your sleep, or feel exhausted despite long sleep, tell your clinician."]},
    {"key": "wind-down", "category": "sleep", "minutes": 2, "title": "A ten minute wind-down",
     "summary": "A short routine that tells your body night is coming.",
     "body": ["Dim the lights. Do something calm for ten minutes: gentle stretching, a warm shower, reading something light, or the slow breathing exercise in the Mental section.",
              "Write tomorrow's top three tasks on paper. Getting them out of your head helps many people stop worrying in bed.",
              "Do the same steps in the same order each night. The routine itself becomes the signal to sleep."]},
]


def by_key(key: str):
    return next((a for a in ARTICLES if a["key"] == key), None)


def listing(a: Dict) -> Dict:
    return {"key": a["key"], "category": a["category"], "category_label": CATEGORIES[a["category"]], "title": a["title"],
            "summary": a["summary"], "minutes": a["minutes"], "featured": bool(a.get("featured"))}
