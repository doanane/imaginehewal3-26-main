"""French and Arabic text for the daily step: the action, why it works and its limits, the barrier tweaks, the circumstance wording and the safety notes.

English is the source (behavior_engine.py). Any language or any string not listed here falls back to English, so a missing translation can
never break a day's step. These texts were written for this project and NEED REVIEW by a native speaker and a clinician before real-world use;
Twi, Ewe, Hausa and Ga are accepted as language codes but have no text yet and show English.
"""
from typing import Dict, Optional, Tuple

LIMITS_LABEL = {"en": "Limits:", "fr": "Limites :", "ar": "الحدود:"}
FITTED = {"en": "Fitted to you:", "fr": "Adapté à vous :", "ar": "مُكيَّف لك:"}
COMEBACK_PREFIX = {"en": "A very small step to get going again. ", "fr": "Un tout petit pas pour repartir. ", "ar": "خطوة صغيرة جدًا لتعود. "}

# (behaviour, option index) -> (title with {t}, detail)
ACTIONS: Dict[str, Dict[Tuple[str, int], Tuple[str, str]]] = {
    "fr": {
        ("movement", 0): ("Marchez {t} pas aujourd'hui", "Essayez une marche de 10 minutes après un repas, puis ajoutez-en peu à peu."),
        ("movement", 1): ("Atteignez {t} pas aujourd'hui", "Décidez maintenant quand vous marcherez, par exemple « après le déjeuner, autour de la cour ou du marché »."),
        ("movement", 2): ("Vérifiez deux fois aujourd'hui votre nombre de pas et visez {t}", "Regardez votre compteur à midi et le soir."),
        ("nutrition", 0): ("Mangez {t} portion(s) de légumes ou de fruits aujourd'hui", "Par exemple kontomire, aubergines locales, gombo, chou, oranges ou papaye ajoutés à un repas habituel."),
        ("nutrition", 1): ("Ajoutez {t} portion(s) de légumes ou de fruits à vos repas", "Choisissez le repas : « avec le déjeuner »."),
        ("sleep", 0): ("Visez {t:g} heures de sommeil cette nuit", "Choisissez maintenant l'heure du coucher et évitez les écrans 30 minutes avant."),
        ("sleep", 1): ("Soyez au lit à temps pour {t:g} heures de sommeil", "Faites chaque soir le même geste de détente, par exemple vous laver puis éteindre la lumière."),
        ("smoking", 0): ("Limitez-vous à {t} cigarette(s) ou moins aujourd'hui", "Retardez la première de 30 minutes et notez quand l'envie arrive."),
        ("smoking", 1): ("Pas plus de {t} cigarette(s) aujourd'hui", "Remplacez une cigarette par de l'eau, une courte marche ou un chewing-gum."),
        ("activity", 0): ("Soyez actif {t} minutes aujourd'hui", "Tout mouvement compte : marche, exercices des bras et des jambes assis, étirements, danse ou tâches ménagères. De courtes périodes suffisent."),
        ("activity", 1): ("Bougez {t} minutes aujourd'hui, par courtes périodes", "Décidez quand : par exemple après chaque repas. Cinq minutes trois fois, ça compte."),
        ("activity", 2): ("Faites {t} minutes d'une activité que vous aimez et qui vous fait bouger", "De la musique, un exercice assis, une marche avec quelqu'un ou aider à la maison. Choisissez ce qui vous plaît."),
    },
    "ar": {
        ("movement", 0): ("امشِ {t} خطوة اليوم", "جرّب المشي 10 دقائق بعد الوجبة ثم زد تدريجيًا."),
        ("movement", 1): ("حقّق {t} خطوة اليوم", "قرّر الآن متى ستمشي، مثلًا «بعد الغداء، حول البيت أو السوق»."),
        ("movement", 2): ("تحقّق من عدد خطواتك مرتين اليوم واستهدف {t}", "انظر إلى العدّاد عند الظهر وفي المساء."),
        ("nutrition", 0): ("تناول {t} حصة من الخضار أو الفاكهة اليوم", "مثل الكونتوميري أو الباذنجان أو البامية أو الملفوف أو البرتقال أو البابايا، تُضاف إلى وجبة تأكلها أصلًا."),
        ("nutrition", 1): ("أضِف {t} حصة من الخضار أو الفاكهة إلى وجباتك", "حدّد أي وجبة ستحتويها: «مع الغداء»."),
        ("sleep", 0): ("استهدف {t:g} ساعات من النوم الليلة", "اختر موعد النوم الآن وابتعد عن الشاشات 30 دقيقة قبله."),
        ("sleep", 1): ("كن في السرير في الوقت المناسب لتنام {t:g} ساعات", "افعل الخطوة الهادئة نفسها كل ليلة، مثل الاغتسال ثم إطفاء الأضواء."),
        ("smoking", 0): ("التزم بـ {t} سيجارة أو أقل اليوم", "أخّر الأولى 30 دقيقة ودوّن متى تأتي الرغبة."),
        ("smoking", 1): ("لا أكثر من {t} سيجارة اليوم", "استبدل سيجارة بالماء أو بمشي قصير أو بعلكة."),
        ("activity", 0): ("كن نشيطًا {t} دقيقة اليوم", "كل حركة تُحسب: المشي، أو تمارين الذراعين والساقين وأنت جالس، أو التمدد، أو الرقص، أو أعمال البيت. فترات قصيرة تكفي."),
        ("activity", 1): ("تحرّك {t} دقيقة اليوم على فترات قصيرة", "قرّر متى: مثلًا بعد كل وجبة. خمس دقائق ثلاث مرات تتراكم."),
        ("activity", 2): ("قم بشيء تحبه ويحرّكك لمدة {t} دقيقة", "موسيقى، أو تمرين جالسًا، أو مشي مع شخص، أو مساعدة في البيت. اختر ما يعجبك."),
    },
}

TWEAK: Dict[str, Dict[str, str]] = {
    "fr": {
        "time": "Fractionnez en deux ou trois courtes périodes (5 minutes chacune).",
        "tired": "Choisissez la version la plus légère, même la moitié compte.",
        "forgot": "Réglez un rappel lié à une routine quotidienne, par exemple après le petit-déjeuner ou la prière.",
        "motivation": "Faites-le avec un ami ou un proche, ou récompensez-vous ensuite.",
        "weather": "Faites une version à l'intérieur : marchez dans la maison, étirez-vous ou préparez un repas.",
        "access": "Utilisez ce qui est proche : votre cour, une marche au marché, des plats faits maison.",
        "pain_sick": "Allez-y doucement. Si la douleur ou la maladie continue, parlez à votre soignant.",
        "stress": "Respirez lentement trois fois avant de commencer ; gardez-le très petit.",
        "craving": "Quand l'envie arrive, attendez 10 minutes, buvez de l'eau ou mâchez un chewing-gum, puis décidez.",
    },
    "ar": {
        "time": "قسّمها إلى فترتين أو ثلاث قصيرة (5 دقائق لكل منها).",
        "tired": "اختر النسخة الأخف، حتى النصف يُحسب.",
        "forgot": "اضبط تذكيرًا مرتبطًا بروتين يومي، مثل بعد الفطور أو بعد الصلاة.",
        "motivation": "افعلها مع صديق أو أحد أفراد العائلة، أو كافئ نفسك بعدها.",
        "weather": "افعل نسخة داخل البيت: امشِ في المنزل أو تمدّد أو حضّر الطعام.",
        "access": "استخدم ما هو قريب منك: ساحة بيتك أو المشي في السوق أو الطعام المنزلي.",
        "pain_sick": "خفّف الوتيرة. وإن استمر الألم أو المرض فتحدّث إلى طبيبك.",
        "stress": "خذ ثلاثة أنفاس بطيئة قبل أن تبدأ، واجعلها صغيرة جدًا.",
        "craving": "عندما تأتي الرغبة انتظر 10 دقائق واشرب الماء أو امضغ علكة ثم قرّر.",
    },
}

# technique -> (why it works, its limits)
TECHNIQUE: Dict[str, Dict[str, Tuple[str, str]]] = {
    "fr": {
        "Small steps (graded tasks)": ("Commencer par une version facile renforce la confiance, et la difficulté n'augmente que lorsque vous êtes régulier.", "Les progrès peuvent sembler lents. Vous pouvez changer le rythme vous-même à tout moment."),
        "Habit stacking": ("Relier une nouvelle action à quelque chose que vous faites déjà chaque jour aide à s'en souvenir.", "Fonctionne mieux avec des routines régulières ; le travail posté ou les voyages demandent un autre repère."),
        "Implementation intention": ("Décider précisément quand et où vous agirez (« après le déjeuner, au portail ») rend le passage à l'acte plus probable.", "Demande une journée assez prévisible."),
        "Self-monitoring": ("Voir vos propres chiffres aide à repérer des tendances et donne le sentiment de progresser.", "Compter peut être stressant pour certaines personnes ; désactivez-le dans ce cas."),
        "Substitution": ("Remplacer une habitude nuisible par une habitude proche et plus saine est plus facile que de simplement la supprimer.", "Ne remplace pas un avis médical, et les envies peuvent encore demander de l'aide."),
        "Coping planning": ("Prévoir à l'avance un obstacle connu (stress, envies, mauvais temps) aide à continuer.", "N'aide que pour les obstacles que vous pouvez prévoir."),
        "Social support": ("Partager un objectif avec quelqu'un de confiance peut renforcer l'engagement et rendre les rechutes plus faciles à vivre.", "Ne partagez que si vous le souhaitez ; cette application ne partage jamais vos données sans votre choix."),
        "Self-compassion after setbacks": ("Considérer une rechute comme normale, et non comme un échec, rend le retour plus probable.", "Ne remplace pas un accompagnement professionnel si vous avez des difficultés."),
    },
    "ar": {
        "Small steps (graded tasks)": ("البدء بنسخة سهلة يبني الثقة، ولا ترتفع الصعوبة إلا بعد أن تنتظم.", "قد يبدو التقدّم بطيئًا. يمكنك تغيير الوتيرة بنفسك في أي وقت."),
        "Habit stacking": ("ربط عمل جديد بشيء تفعله كل يوم يسهّل تذكّره.", "يعمل أفضل مع الروتين الثابت؛ العمل بنظام المناوبات أو السفر قد يحتاجان إلى إشارة أخرى."),
        "Implementation intention": ("تحديد متى وأين ستفعل بالضبط («بعد الغداء، عند البوابة») يزيد احتمال الالتزام.", "يحتاج إلى يوم متوقَّع إلى حدٍّ ما."),
        "Self-monitoring": ("رؤية أرقامك تساعدك على ملاحظة الأنماط وتمنحك إحساسًا بالتقدّم.", "قد يكون العدّ مرهقًا لبعض الناس؛ أوقفه إن كان كذلك."),
        "Substitution": ("استبدال عادة غير مفيدة بعادة مشابهة أصحّ أسهل من مجرد التخلّي عنها.", "لا يغني عن الاستشارة الطبية، وقد تحتاج الرغبة الملحّة إلى دعم."),
        "Coping planning": ("التخطيط مسبقًا لعقبة معروفة (توتر، رغبة ملحّة، طقس سيئ) يساعدك على الاستمرار.", "يفيد فقط في العقبات التي يمكنك توقّعها."),
        "Social support": ("مشاركة هدفك مع شخص تثق به قد تزيد الالتزام وتجعل الانتكاسات أسهل.", "شارك فقط إن أردت؛ هذا التطبيق لا يشارك بياناتك أبدًا دون اختيارك."),
        "Self-compassion after setbacks": ("التعامل مع التعثّر على أنه أمر طبيعي لا فشل يزيد احتمال العودة.", "لا يغني عن الدعم المتخصص إذا كنت تعاني."),
    },
}

# wording that fits the action to the person's circumstances
CONTEXT: Dict[str, Dict[str, str]] = {
    "en": {"shift": "Your hours change, so pick the time around your shift that is most reliable today.",
           "time": "You said the {x} suits you best.", "chair": "Chair-based or gentle movement counts in full.",
           "steps_hint": "If steps are not right for you, the Be active plan counts minutes of any movement.",
           "ask": "Ask {who} to join you.", "reason": "Remember your reason: “{why}”.",
           "morning": "morning", "midday": "midday", "evening": "evening",
           "family": "a family member", "friend": "a friend", "workplace": "a colleague"},
    "fr": {"shift": "Vos horaires changent : choisissez aujourd'hui le moment autour de votre service le plus fiable.",
           "time": "Vous avez dit que {x} vous convient le mieux.", "chair": "Les mouvements sur chaise ou doux comptent pleinement.",
           "steps_hint": "Si les pas ne vous conviennent pas, le plan Soyez actif compte les minutes de tout mouvement.",
           "ask": "Demandez à {who} de vous accompagner.", "reason": "Souvenez-vous de votre raison : « {why} ».",
           "morning": "le matin", "midday": "le milieu de journée", "evening": "le soir",
           "family": "un proche", "friend": "un ami", "workplace": "un collègue"},
    "ar": {"shift": "ساعات عملك تتغيّر، فاختر اليوم الوقت الأنسب حول مناوبتك.",
           "time": "قلتَ إن {x} هو الأنسب لك.", "chair": "الحركة من وضع الجلوس أو الحركة الخفيفة تُحسب بالكامل.",
           "steps_hint": "إن لم تناسبك الخطوات فخطة «كن نشيطًا» تحسب دقائق أي حركة.",
           "ask": "اطلب من {who} أن ينضم إليك.", "reason": "تذكّر سببك: «{why}».",
           "morning": "الصباح", "midday": "منتصف النهار", "evening": "المساء",
           "family": "أحد أفراد العائلة", "friend": "صديق", "workplace": "زميل"},
}

FITTED_PARTS: Dict[str, Dict[str, str]] = {
    "en": {"work": "your changing work hours", "mobility": "your mobility", "slow": "your wish to go slowly",
           "hold": "keeping the step the same size while your health is checked", "bp": "a very high blood pressure reading",
           "sleep": "about {h:g} hours of sleep", "data": "what your health data shows ({what})"},
    "fr": {"work": "vos horaires de travail changeants", "mobility": "votre mobilité", "slow": "votre souhait d'aller doucement",
           "hold": "le maintien de l'étape à la même taille pendant que votre santé est vérifiée", "bp": "une tension artérielle très élevée",
           "sleep": "environ {h:g} heures de sommeil", "data": "ce que montrent vos données de santé ({what})"},
    "ar": {"work": "ساعات عملك المتغيّرة", "mobility": "قدرتك على الحركة", "slow": "رغبتك في التقدّم ببطء",
           "hold": "إبقاء الخطوة بنفس الحجم ريثما تُراجَع حالتك الصحية", "bp": "قراءة ضغط دم مرتفعة جدًا",
           "sleep": "نحو {h:g} ساعات من النوم", "data": "ما تُظهره بياناتك الصحية ({what})"},
}

SAFETY: Dict[str, Dict[str, str]] = {
    "en": {"bp": "Your latest blood pressure reading was very high. Keep today's activity gentle, rest if you feel unwell, and speak to your clinician before doing more.",
           "heart": "Because of your heart condition, ask your clinician what level of activity is safe for you.",
           "diabetes": "Because you have diabetes, check with your clinician or dietitian before making big changes to what you eat.",
           "smoking": "Support is available. Ask your clinician about help to stop smoking, and do not change any medicine without advice."},
    "fr": {"bp": "Votre dernière mesure de tension était très élevée. Gardez l'activité douce aujourd'hui, reposez-vous si vous ne vous sentez pas bien et parlez à votre soignant avant d'en faire plus.",
           "heart": "En raison de votre problème cardiaque, demandez à votre soignant quel niveau d'activité est sûr pour vous.",
           "diabetes": "Comme vous avez du diabète, demandez conseil à votre soignant ou à un diététicien avant de changer beaucoup votre alimentation.",
           "smoking": "Une aide existe. Demandez à votre soignant comment arrêter de fumer et ne changez aucun médicament sans avis."},
    "ar": {"bp": "كانت آخر قراءة لضغط دمك مرتفعة جدًا. اجعل نشاط اليوم خفيفًا، وارتح إن شعرت بتوعّك، وتحدّث إلى طبيبك قبل أن تفعل أكثر.",
           "heart": "بسبب حالة قلبك، اسأل طبيبك عن مستوى النشاط الآمن لك.",
           "diabetes": "لأنك مصاب بالسكري، استشر طبيبك أو اختصاصي التغذية قبل إجراء تغييرات كبيرة في طعامك.",
           "smoking": "الدعم متاح. اسأل طبيبك عن المساعدة على الإقلاع عن التدخين، ولا تغيّر أي دواء دون استشارة."},
}


def pick(table: Dict[str, dict], lang: str, key, default=None):
    """The text for this language, or English/default when there is none, so nothing ever breaks for a missing translation."""
    return (table.get(lang) or {}).get(key, default)


def tech(lang: str, name: str) -> Optional[Tuple[str, str]]:
    return (TECHNIQUE.get(lang) or {}).get(name)
