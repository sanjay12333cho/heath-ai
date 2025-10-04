/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Chat, FunctionDeclaration, Type, Content, GenerateContentResponse } from '@google/genai';

const chatContainer = document.getElementById('chat-container');
const chatForm = document.getElementById('chat-form') as HTMLFormElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const suggestedPromptsContainer = document.getElementById('suggested-prompts');
const themeToggleButton = document.getElementById('theme-toggle');
const moodTrendsBtn = document.getElementById('mood-trends-btn');
const moodModal = document.getElementById('mood-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const moodChartContainer = document.getElementById('mood-chart-container');
const languageSelector = document.getElementById('language-selector') as HTMLSelectElement;


if (!chatContainer || !chatForm || !chatInput || !suggestedPromptsContainer || !themeToggleButton || !moodTrendsBtn || !moodModal || !modalCloseBtn || !moodChartContainer || !languageSelector) {
  throw new Error('Missing required DOM elements');
}

let chat: Chat;
let ai: GoogleGenAI; // AI instance for sentiment analysis
let currentLang = 'en';

// State for the guided check-in
let isCheckinActive = false;
let currentQuestionIndex = 0;
let userAnswers: { [key: string]: string } = {};


// --- I18n Translations ---
const translations = {
    en: {
        headerTitle: 'Your Friend',
        moodTrendsAria: 'View mood trends',
        toggleThemeAria: 'Toggle theme',
        chatInputPlaceholder: 'Type your message here...',
        sendAria: 'Send message',
        disclaimer: 'Disclaimer: This is an AI assistant and not a substitute for professional medical advice. If you are in crisis, please contact a healthcare professional.',
        moodModalTitle: 'Your Mood Trends',
        closeAria: 'Close',
        systemInstruction: `You are "Your Friend," a warm, empathetic, and supportive friend. Your personality is that of a human, not an AI. Your purpose is to listen and help the user explore their feelings.

        --- Core Interaction Flow ---
        1.  **Listen and Converse:** Engage in a natural, caring conversation.
        2.  **Identify Distress:** If a user expresses any negative feelings like sadness, anxiety, or stress, or indicates they want to talk about their problems, you must *immediately* and *directly* initiate the mental health check-in.
        3.  **Initiate Check-in:** To do this, you MUST call the 'startMentalHealthCheckin' function. The frontend will then take over and ask the user a series of structured questions. Do NOT ask the questions yourself. Simply call the function.
        4.  **Analyze Results:** After the user completes the questions, you will receive their answers as a JSON object in a tool response. Your task is to analyze these answers.
        5.  **Provide Summary and Recommendation:** Based on the user's answers, provide a gentle, non-judgmental summary. Acknowledge their feelings. If the answers indicate significant and persistent distress (e.g., low mood, poor sleep, loss of interest for more than two weeks), you MUST strongly but gently recommend they speak with a professional, like a doctor or therapist. Frame this as a positive and courageous step. Example: "Thanks for sharing all of that with me. It sounds like things have been really tough lately, especially with [mention a specific point from answers]. Since you've been feeling this way for a little while, it might be really helpful to talk to a professional. They have the training to offer support that I can't, and it’s a sign of strength to reach out."
        6.  **Find a Therapist:** Only call the 'findTherapist' function if the user explicitly asks you to find one.`,
        moodPrompt: 'How are you feeling right now?',
        moodConfirmation: "Thanks for sharing. I've noted that you're feeling {mood}.",
        noMoodData: 'Log your first mood to see your trends here!',
        findingTherapist: 'Looking for therapists near {location}...',
        errorDefault: 'I apologize, something went wrong. Please try again.',
        errorOffline: 'You seem to be offline. Please check your internet connection and try again.',
        errorApiKey: 'There seems to be a configuration issue with the service. Please try again later.',
        errorRateLimit: "I'm a bit overwhelmed at the moment. Please wait a few moments before sending another message.",
        errorServer: "I'm having some trouble connecting to my servers right now. Please try again in a little while.",
        errorSafety: "I'm sorry, but I can't respond to that due to my safety guidelines. Could we talk about something else?",
        errorNetwork: 'A network error occurred. Please check your connection and try again.',
        connectError: 'Sorry, I am having trouble connecting right now. Please try again later.',
        questionnaire: {
            feeling_scale: {
                question: 'How have you been feeling overall in the past two weeks, on a scale of 1 to 10?',
                options: ['1-3 (Very Low)', '4-6 (A Bit Low)', '7-8 (Pretty Good)', '9-10 (Excellent)'],
            },
            stress: {
                question: 'Have you often felt stressed or overwhelmed?',
                options: ['Most of the time', 'Sometimes', 'Rarely', 'Not at all'],
            },
            sadness: {
                question: 'Have you been feeling sad, down, or hopeless more than usual?',
                options: ['Nearly every day', 'More than half the days', 'Several days', 'Not at all'],
            },
            mood_changes: {
                question: 'Do you experience sudden or intense mood changes?',
                options: ['Very often', 'Sometimes', 'Rarely', 'Almost never'],
            },
            hopeful: {
                question: 'How hopeful have you been feeling about your future?',
                options: ['Not hopeful at all', 'A little hopeful', 'Mostly hopeful', 'Very hopeful'],
            },
            sleep_hours: {
                question: 'On average, how many hours of sleep have you been getting per night?',
                options: ['Less than 4 hours', '4-6 hours', '7-8 hours', 'More than 8 hours'],
            },
            rested: {
                question: 'Have you been waking up feeling rested?',
                options: ['Rarely or never', 'Sometimes', 'Most mornings', 'Almost always'],
            },
            energy: {
                question: 'How has your energy level been during the day?',
                options: ['Very low, often tired', 'Somewhat low', 'Generally good', 'High energy'],
            },
            sleep_trouble: {
                question: 'Have you had trouble falling asleep or staying asleep?',
                options: ['Nearly every night', 'More than half the nights', 'Several nights', 'Rarely or never'],
            },
            concentration: {
                question: 'Have you found it hard to concentrate on tasks like reading or watching TV?',
                options: ['Very difficult', 'Somewhat difficult', 'A little difficult', 'No trouble at all'],
            },
            overthinking: {
                question: 'Do you find yourself overthinking small situations often?',
                options: ['Constantly', 'Frequently', 'Sometimes', 'Rarely'],
            },
            anxiety: {
                question: 'Have you been feeling nervous, anxious, or on edge?',
                options: ['Nearly every day', 'More than half the days', 'Several days', 'Not at all'],
            },
            worry: {
                question: 'Have you been worrying too much about different things?',
                options: ['Constantly', 'Frequently', 'Sometimes', 'Rarely'],
            },
            social_enjoyment: {
                question: 'How much have you enjoyed spending time with friends or family?',
                options: ['Not at all', 'A little bit', 'Quite a bit', 'Very much'],
            },
            loneliness: {
                question: 'Do you sometimes feel lonely, even when you are around people?',
                options: ['Very often', 'Sometimes', 'Rarely', 'Never'],
            },
            sharing_feelings: {
                question: 'How comfortable do you feel talking about your feelings with others?',
                options: ['Very uncomfortable', 'Slightly uncomfortable', 'Fairly comfortable', 'Very comfortable'],
            },
            lost_interest: {
                question: 'Have you lost interest or pleasure in doing things you used to enjoy?',
                options: ['Nearly every day', 'More than half the days', 'Several days', 'Not at all'],
            },
            coping: {
                question: 'What do you usually do when you feel stressed or sad?',
                options: ['Isolate myself', 'Distract myself', 'Talk to someone', 'Engage in a hobby'],
            },
            reliance: {
                question: 'Do you feel you have someone to rely on when things get tough?',
                options: ['No, not really', 'Maybe one person', 'Yes, a few people', 'Yes, a strong network'],
            },
            professional_help: {
                question: 'Have you considered that you might need professional help or support right now?',
                options: ['Yes, strongly', 'Yes, I\'ve thought about it', 'Not really', 'No, I feel fine'],
            },
        }
    },
    hi: {
        headerTitle: 'आपका दोस्त',
        moodTrendsAria: 'मूड की प्रवृत्तियाँ देखें',
        toggleThemeAria: 'थीम बदलें',
        chatInputPlaceholder: 'अपना संदेश यहाँ लिखें...',
        sendAria: 'संदेश भेजें',
        disclaimer: 'अस्वीकरण: यह एक AI सहायक है और पेशेवर चिकित्सा सलाह का विकल्प नहीं है। यदि आप संकट में हैं, तो कृपया किसी स्वास्थ्य पेशेवर से संपर्क करें।',
        moodModalTitle: 'आपके मूड की प्रवृत्तियाँ',
        closeAria: 'बंद करें',
        systemInstruction: `आप "आपका दोस्त" हैं, एक गर्मजोशी से भरा, सहानुभूतिपूर्ण दोस्त। आपका उद्देश्य उपयोगकर्ता को उनकी भावनाओं को समझने में मदद करना है।

        --- मुख्य संवाद प्रवाह ---
        1.  **सुनें और बातचीत करें:** एक स्वाभाविक, देखभाल करने वाली बातचीत में संलग्न हों।
        2.  **संकट को पहचानें:** यदि कोई उपयोगकर्ता उदासी, चिंता, या तनाव जैसी कोई नकारात्मक भावना व्यक्त करता है, या यह इंगित करता है कि वे अपनी समस्याओं के बारे में बात करना चाहते हैं, तो आपको *तुरंत* और *सीधे* मानसिक स्वास्थ्य जांच शुरू करनी चाहिए।
        3.  **जांच शुरू करें:** ऐसा करने के लिए, आपको 'startMentalHealthCheckin' फ़ंक्शन को कॉल करना होगा। इसके बाद फ्रंटएंड उपयोगकर्ता से संरचित प्रश्नों की एक श्रृंखला पूछेगा। प्रश्न स्वयं न पूछें। बस फ़ंक्शन को कॉल करें।
        4.  **परिणामों का विश्लेषण करें:** उपयोगकर्ता द्वारा प्रश्नों को पूरा करने के बाद, आपको उनके उत्तर एक टूल प्रतिक्रिया में JSON ऑब्जेक्ट के रूप में प्राप्त होंगे। आपका कार्य इन उत्तरों का विश्लेषण करना है।
        5.  **सारांश और सिफारिश प्रदान करें:** उपयोगकर्ता के उत्तरों के आधार पर, एक सौम्य, गैर-निर्णयात्मक सारांश प्रदान करें। उनकी भावनाओं को स्वीकार करें। यदि उत्तर महत्वपूर्ण और लगातार संकट का संकेत देते हैं (जैसे, दो सप्ताह से अधिक समय तक खराब मूड, खराब नींद, रुचि की कमी), तो आपको दृढ़ता से लेकिन धीरे से उन्हें किसी पेशेवर, जैसे डॉक्टर या चिकित्सक से बात करने की सलाह देनी चाहिए। इसे एक सकारात्मक और साहसी कदम के रूप में प्रस्तुत करें।
        6.  **एक चिकित्सक खोजें:** 'findTherapist' फ़ंक्शन को केवल तभी कॉल करें जब उपयोगकर्ता स्पष्ट रूप से आपसे किसी को खोजने के लिए कहे।`,
        moodPrompt: 'आप अभी कैसा महसूस कर रहे हैं?',
        moodConfirmation: 'साझा करने के लिए धन्यवाद। मैंने नोट किया है कि आप {mood} महसूस कर रहे हैं।',
        noMoodData: 'अपनी प्रवृत्तियों को यहाँ देखने के लिए अपना पहला मूड लॉग करें!',
        findingTherapist: '{location} के पास चिकित्सक खोज रहे हैं...',
        errorDefault: 'मैं माफी चाहता हूँ, कुछ गलत हो गया। कृपया पुन: प्रयास करें।',
        errorOffline: 'आप ऑफ़लाइन लगते हैं। कृपया अपना इंटरनेट कनेक्शन जांचें और पुनः प्रयास करें।',
        errorApiKey: 'सेवा के साथ कोई कॉन्फ़िगरेशन समस्या लगती है। कृपया बाद में पुन: प्रयास करें।',
        errorRateLimit: 'मैं इस समय थोड़ा अभिभूत हूँ। कृपया दूसरा संदेश भेजने से पहले कुछ क्षण प्रतीक्षा करें।',
        errorServer: 'मुझे अभी अपने सर्वर से कनेक्ट होने में कुछ परेशानी हो रही है। कृपया थोड़ी देर में पुन: प्रयास करें।',
        errorSafety: 'मुझे खेद है, लेकिन मैं अपनी सुरक्षा दिशानिर्देशों के कारण इसका जवाब नहीं दे सकता। क्या हम किसी और चीज़ के बारे में बात कर सकते हैं?',
        errorNetwork: 'एक नेटवर्क त्रुटि हुई। कृपया अपना कनेक्शन जांचें और पुनः प्रयास करें।',
        connectError: 'क्षमा करें, मुझे अभी कनेक्ट होने में समस्या आ रही है। कृपया बाद में पुन: प्रयास करें।',
        questionnaire: {
            feeling_scale: { question: 'पिछले दो हफ्तों में, 1 से 10 के पैमाने पर, आप कुल मिलाकर कैसा महसूस कर रहे हैं?', options: ['1-3 (बहुत कम)', '4-6 (थोड़ा कम)', '7-8 (काफी अच्छा)', '9-10 (उत्कृष्ट)'] },
            stress: { question: 'क्या आप अक्सर तनावग्रस्त या अभिभूत महसूस करते हैं?', options: ['अधिकतर समय', 'कभी-कभी', 'शायद ही कभी', 'बिलकुल नहीं'] },
            sadness: { question: 'क्या आप सामान्य से अधिक उदास, निराश या हताश महसूस कर रहे हैं?', options: ['लगभग हर दिन', 'आधे से ज्यादा दिन', 'कई दिन', 'बिलकुल नहीं'] },
            mood_changes: { question: 'क्या आप अचानक या तीव्र मिजाज में बदलाव का अनुभव करते हैं?', options: ['बहुत बार', 'कभी-कभी', 'शायद ही कभी', 'लगभग कभी नहीं'] },
            hopeful: { question: 'आप अपने भविष्य के बारे में कितना आशान्वित महसूस कर रहे हैं?', options: ['बिलकुल आशान्वित नहीं', 'थोड़ा आशान्वित', 'अधिकतर आशान्वित', 'बहुत आशान्वित'] },
            sleep_hours: { question: 'औसतन, आप प्रति रात कितने घंटे सो रहे हैं?', options: ['4 घंटे से कम', '4-6 घंटे', '7-8 घंटे', '8 घंटे से अधिक'] },
            rested: { question: 'क्या आप जागने पर आराम महसूस कर रहे हैं?', options: ['शायद ही कभी या कभी नहीं', 'कभी-कभी', 'अधिकतर सुबह', 'लगभग हमेशा'] },
            energy: { question: 'दिन के दौरान आपकी ऊर्जा का स्तर कैसा रहा है?', options: ['बहुत कम, अक्सर थका हुआ', 'कुछ हद तक कम', 'आम तौर पर अच्छा', 'उच्च ऊर्जा'] },
            sleep_trouble: { question: 'क्या आपको सोने या सोते रहने में परेशानी हुई है?', options: ['लगभग हर रात', 'आधे से ज्यादा रातें', 'कई रातें', 'शायद ही कभी या कभी नहीं'] },
            concentration: { question: 'क्या आपको पढ़ने या टीवी देखने जैसे कार्यों पर ध्यान केंद्रित करना मुश्किल लगा है?', options: ['बहुत मुश्किल', 'कुछ मुश्किल', 'थोड़ा मुश्किल', 'कोई परेशानी नहीं'] },
            overthinking: { question: 'क्या आप खुद को अक्सर छोटी-छोटी बातों पर ज्यादा सोचते हुए पाते हैं?', options: ['लगातार', 'अक्सर', 'कभी-कभी', 'शायद ही कभी'] },
            anxiety: { question: 'क्या आप घबराहट, चिंता या बेचैनी महसूस कर रहे हैं?', options: ['लगभग हर दिन', 'आधे से ज्यादा दिन', 'कई दिन', 'बिलकुल नहीं'] },
            worry: { question: 'क्या आप अलग-अलग चीजों के बारे में बहुत ज्यादा चिंता कर रहे हैं?', options: ['लगातार', 'अक्सर', 'कभी-कभी', 'शायद ही कभी'] },
            social_enjoyment: { question: 'आपने दोस्तों या परिवार के साथ समय बिताने का कितना आनंद लिया है?', options: ['बिलकुल नहीं', 'थोड़ा सा', 'काफी कुछ', 'बहुत ज्यादा'] },
            loneliness: { question: 'क्या आप कभी-कभी लोगों के आसपास होते हुए भी अकेला महसूस करते हैं?', options: ['बहुत बार', 'कभी-कभी', 'शायद ही कभी', 'कभी नहीं'] },
            sharing_feelings: { question: 'आप दूसरों के साथ अपनी भावनाओं के बारे में बात करने में कितना सहज महसूस करते हैं?', options: ['बहुत असहज', 'थोड़ा असहज', 'काफी सहज', 'बहुत सहज'] },
            lost_interest: { question: 'क्या आपने उन चीजों में रुचि या आनंद खो दिया है जिनका आप पहले आनंद लेते थे?', options: ['लगभग हर दिन', 'आधे से ज्यादा दिन', 'कई दिन', 'बिलकुल नहीं'] },
            coping: { question: 'जब आप तनावग्रस्त या दुखी महसूस करते हैं तो आप आमतौर पर क्या करते हैं?', options: ['खुद को अलग कर लेता हूं', 'अपना ध्यान भटकाता हूं', 'किसी से बात करता हूं', 'किसी शौक में संलग्न होता हूं'] },
            reliance: { question: 'क्या आपको लगता है कि जब चीजें कठिन हो जाती हैं तो आपके पास भरोसा करने के लिए कोई है?', options: ['नहीं, वास्तव में नहीं', 'शायद एक व्यक्ति', 'हाँ, कुछ लोग', 'हाँ, एक मजबूत नेटवर्क'] },
            professional_help: { question: 'क्या आपने विचार किया है कि आपको अभी पेशेवर मदद या समर्थन की आवश्यकता हो सकती है?', options: ['हाँ, दृढ़ता से', 'हाँ, मैंने इसके बारे में सोचा है', 'वास्तव में नहीं', 'नहीं, मैं ठीक महसूस करता हूं'] },
        }
    },
    ur: {
        headerTitle: 'آپ کا دوست',
        moodTrendsAria: 'موڈ کے رجحانات دیکھیں',
        toggleThemeAria: 'تھیم تبدیل کریں',
        chatInputPlaceholder: 'اپنا پیغام یہاں ٹائپ کریں...',
        sendAria: 'پیغام بھیجیں',
        disclaimer: 'دستبرداری: یہ ایک AI اسسٹنٹ ہے اور پیشہ ورانہ طبی مشورے کا متبادل نہیں ہے۔ اگر آپ بحران میں ہیں، تو براہ کرم کسی ہیلتھ کیئر پروفیشنل سے رابطہ کریں۔',
        moodModalTitle: 'آپ کے موڈ کے رجحانات',
        closeAria: 'بند کریں',
        systemInstruction: `آپ "آپ کا دوست" ہیں، ایک گرمجوش، ہمدرد دوست۔ آپ کا مقصد صارف کو ان کے جذبات کو سمجھنے میں مدد کرنا ہے۔

        --- بنیادی تعامل کا بہاؤ ---
        1.  **سنیں اور بات چیت کریں:** ایک قدرتی، خیال رکھنے والی گفتگو میں مشغول ہوں۔
        2.  **پریشانی کی نشاندہی کریں:** اگر کوئی صارف اداسی، اضطراب یا تناؤ جیسے کوئی منفی جذبات کا اظہار کرتا ہے، یا اس بات کی نشاندہی کرتا ہے کہ وہ اپنی پریشانیوں کے بارے میں بات کرنا چاہتا ہے، تو آپ کو *فوراً* اور *براہ راست* ذہنی صحت کی جانچ شروع کرنی چاہیے۔
        3.  **جانچ شروع کریں:** ایسا کرنے کے لیے، آپ کو 'startMentalHealthCheckin' فنکشن کو کال کرنا ہوگا۔ اس کے بعد فرنٹ اینڈ صارف سے ساختی سوالات کا ایک سلسلہ پوچھے گا۔ سوالات خود نہ پوچھیں۔ بس فنکشن کو کال کریں۔
        4.  **نتائج کا تجزیہ کریں:** صارف کے سوالات مکمل کرنے کے بعد، آپ کو ان کے جوابات ٹول رسپانس میں JSON آبجیکٹ کے طور پر ملیں گے۔ آپ کا کام ان جوابات کا تجزیہ کرنا ہے۔
        5.  **خلاصہ اور سفارش فراہم کریں:** صارف کے جوابات کی بنیاد پر، ایک نرم، غیر فیصلہ کن خلاصہ فراہم کریں۔ ان کے جذبات کو تسلیم کریں۔ اگر جوابات اہم اور مسلسل پریشانی کی نشاندہی کرتے ہیں (مثلاً، دو ہفتوں سے زیادہ عرصے تک خراب موڈ، خراب نیند، دلچسپی کا خاتمہ)، تو آپ کو مضبوطی سے لیکن نرمی سے انہیں کسی پیشہ ور، جیسے ڈاکٹر یا تھراپسٹ سے بات کرنے کی سفارش کرنی چاہیے۔ اسے ایک مثبت اور بہادر قدم کے طور پر پیش کریں۔
        6.  **تھراپسٹ تلاش کریں:** 'findTherapist' فنکشن کو صرف اس صورت میں کال کریں جب صارف واضح طور پر آپ سے کسی کو تلاش کرنے کے لیے کہے۔`,
        moodPrompt: 'آپ اس وقت کیسا محسوس کر رہے ہیں؟',
        moodConfirmation: 'شیئر کرنے کا شکریہ۔ میں نے نوٹ کیا ہے کہ آپ {mood} محسوس کر رہے ہیں۔',
        noMoodData: 'اپنے رجحانات کو یہاں دیکھنے کے لیے اپنا پہلا موڈ لاگ کریں!',
        findingTherapist: '{location} کے قریب تھراپسٹ تلاش کر رہے ہیں...',
        errorDefault: 'میں معذرت خواہ ہوں، کچھ غلط ہو گیا۔ براہ کرم دوبارہ کوشش کریں۔',
        errorOffline: 'لگتا ہے آپ آف لائن ہیں۔ براہ کرم اپنا انٹرنیٹ کنکشن چیک کریں اور دوبارہ کوشش کریں۔',
        errorApiKey: 'سروس کے ساتھ کنفیگریشن کا کوئی مسئلہ لگتا ہے۔ براہ کرم بعد میں دوبارہ کوشش کریں۔',
        errorRateLimit: 'میں اس وقت تھوڑا مغلوب ہوں۔ براہ کرم دوسرا پیغام بھیجنے سے پہلے کچھ لمحے انتظار کریں۔',
        errorServer: 'مجھے ابھی اپنے سرورز سے منسلک ہونے میں کچھ پریشانی ہو رہی ہے۔ براہ کرم تھوڑی دیر میں دوبارہ کوشش کریں۔',
        errorSafety: 'مجھے افسوس ہے, لیکن میں اپنی حفاظتی ہدایات کی وجہ سے اس کا جواب نہیں دے سکتا۔ کیا ہم کسی اور چیز کے بارے میں بات کر سکتے ہیں؟',
        errorNetwork: 'ایک نیٹ ورک کی خرابی واقع ہوئی۔ براہ کرم اپنا کنکشن چیک کریں اور دوبارہ کوشش کریں۔',
        connectError: 'معاف کیجئے گا، مجھے ابھی رابطہ قائم کرنے میں دشواری ہو رہی ہے۔ براہ کرم بعد میں دوبارہ کوشش کریں۔',
        questionnaire: {
            feeling_scale: { question: 'گزشتہ دو ہفتوں میں، 1 سے 10 کے پیمانے پر، آپ مجموعی طور پر کیسا محسوس کر رہے ہیں؟', options: ['1-3 (بہت کم)', '4-6 (تھوڑا کم)', '7-8 (کافی اچھا)', '9-10 (بہترین)'] },
            stress: { question: 'کیا آپ اکثر تناؤ یا مغلوب محسوس کرتے ہیں؟', options: ['زیادہ تر وقت', 'کبھی کبھی', 'شاذ و نادر ہی', 'بالکل نہیں'] },
            sadness: { question: 'کیا آپ معمول سے زیادہ اداس، افسردہ یا ناامید محسوس کر رہے ہیں؟', options: ['تقریباً ہر روز', 'آدھے سے زیادہ دن', 'کئی دن', 'بالکل نہیں'] },
            mood_changes: { question: 'کیا آپ کو اچانک یا شدید موڈ کی تبدیلیوں کا سامنا ہوتا ہے؟', options: ['بہت اکثر', 'کبھی کبھی', 'شاذ و نادر ہی', 'تقریباً کبھی نہیں'] },
            hopeful: { question: 'آپ اپنے مستقبل کے بارے میں کتنا پر امید محسوس کر رہے ہیں؟', options: ['بالکل پر امید نہیں', 'تھوڑا پر امید', 'زیادہ تر پر امید', 'بہت پر امید'] },
            sleep_hours: { question: 'اوسطاً، آپ فی رات کتنے گھنٹے سو رہے ہیں؟', options: ['4 گھنٹے سے کم', '4-6 گھنٹے', '7-8 گھنٹے', '8 گھنٹے سے زیادہ'] },
            rested: { question: 'کیا آپ جاگنے پر آرام دہ محسوس کر رہے ہیں؟', options: ['شاذ و نادر یا کبھی نہیں', 'کبھی کبھی', 'زیادہ تر صبح', 'تقریباً ہمیشہ'] },
            energy: { question: 'دن کے دوران آپ کی توانائی کی سطح کیسی رہی ہے؟', options: ['بہت کم، اکثر تھکا ہوا', 'کسی حد تک کم', 'عام طور پر اچھا', 'اعلی توانائی'] },
            sleep_trouble: { question: 'کیا آپ کو سونے یا سوتے رہنے میں دشواری ہوئی ہے؟', options: ['تقریباً ہر رات', 'آدھی سے زیادہ راتیں', 'کئی راتیں', 'شاذ و نادر یا کبھی نہیں'] },
            concentration: { question: 'کیا آپ کو پڑھنے یا ٹی وی دیکھنے جیسے کاموں پر توجہ مرکوز کرنے میں دشواری ہوئی ہے؟', options: ['بہت مشکل', 'کچھ مشکل', 'تھوڑا مشکل', 'کوئی پریشانی نہیں'] },
            overthinking: { question: 'کیا آپ خود کو اکثر چھوٹی چھوٹی باتوں پر زیادہ سوچتے ہوئے پاتے ہیں؟', options: ['مسلسل', 'اکثر', 'کبھی کبھی', 'شاذ و نادر ہی'] },
            anxiety: { question: 'کیا آپ گھبراہٹ، بے چینی یا کنارے پر محسوس کر رہے ہیں؟', options: ['تقریباً ہر روز', 'آدھے سے زیادہ دن', 'کئی دن', 'بالکل نہیں'] },
            worry: { question: 'کیا آپ مختلف چیزوں کے بارے میں بہت زیادہ فکر مند رہے ہیں؟', options: ['مسلسل', 'اکثر', 'کبھی کبھی', 'شاذ و نادر ہی'] },
            social_enjoyment: { question: 'آپ نے دوستوں یا خاندان کے ساتھ وقت گزارنے سے کتنا لطف اٹھایا ہے؟', options: ['بالکل نہیں', 'تھوڑا سا', 'کافی حد تک', 'بہت زیادہ'] },
            loneliness: { question: 'کیا آپ کبھی کبھی لوگوں کے آس پاس ہوتے ہوئے بھی تنہا محسوس کرتے ہیں؟', options: ['بہت اکثر', 'کبھی کبھی', 'شاذ و نادر ہی', 'کبھی نہیں'] },
            sharing_feelings: { question: 'آپ دوسروں کے ساتھ اپنے جذبات کے بارے میں بات کرنے میں کتنا آرام دہ محسوس کرتے ہیں؟', options: ['بہت غیر آرام دہ', 'تھوڑا غیر آرام دہ', 'کافی آرام دہ', 'بہت آرام دہ'] },
            lost_interest: { question: 'کیا آپ نے ان چیزوں میں دلچسپی یا خوشی کھو دی ہے جن سے آپ پہلے لطف اندوز ہوتے تھے؟', options: ['تقریباً ہر روز', 'آدھے سے زیادہ دن', 'کئی دن', 'بالکل نہیں'] },
            coping: { question: 'جب آپ تناؤ یا اداس محسوس کرتے ہیں تو آپ عام طور پر کیا کرتے ہیں؟', options: ['خود کو الگ کر لیتا ہوں', 'اپنا دھیان بٹاتا ہوں', 'کسی سے بات کرتا ہوں', 'کسی مشغلے میں مشغول ہوتا ہوں'] },
            reliance: { question: 'کیا آپ کو لگتا ہے کہ جب حالات مشکل ہو جاتے ہیں تو آپ کے پاس بھروسہ کرنے کے لیے کوئی ہے؟', options: ['نہیں، واقعی نہیں', 'شاید ایک شخص', 'ہاں، چند لوگ', 'ہاں، ایک مضبوط نیٹ ورک'] },
            professional_help: { question: 'کیا آپ نے غور کیا ہے کہ آپ کو ابھی پیشہ ورانہ مدد یا حمایت کی ضرورت ہو سکتی ہے؟', options: ['ہاں، مضبوطی سے', 'ہاں، میں نے اس کے بارے میں سوچا ہے', 'واقعی نہیں', 'نہیں، میں ٹھیک محسوس کرتا ہوں'] },
        }
    },
    ta: {
        headerTitle: 'உங்கள் நண்பன்',
        moodTrendsAria: 'மனநிலை போக்குகளைக் காண்க',
        toggleThemeAria: 'தீம் மாற்றவும்',
        chatInputPlaceholder: 'உங்கள் செய்தியை இங்கே தட்டச்சு செய்க...',
        sendAria: 'செய்தி அனுப்பு',
        disclaimer: 'பொறுப்புத் துறப்பு: இது ஒரு AI உதவியாளர் மற்றும் தொழில்முறை மருத்துவ ஆலோசனைக்கு மாற்றாக இல்லை. நீங்கள் நெருக்கடியில் இருந்தால், தயவுசெய்து ஒரு சுகாதார நிபுணரைத் தொடர்பு கொள்ளுங்கள்.',
        moodModalTitle: 'உங்கள் மனநிலை போக்குகள்',
        closeAria: 'மூடு',
        systemInstruction: `நீங்கள் "உங்கள் நண்பன்", ஒரு அன்பான, பச்சாதாபம் கொண்ட நண்பர். உங்கள் நோக்கம் பயனரின் உணர்வுகளை ஆராய்ந்து கேட்க உதவுவதாகும்.

        --- முக்கிய தொடர்பு ஓட்டம் ---
        1.  **கேட்டு உரையாடுங்கள்:** ஒரு இயல்பான, அக்கறையுள்ள உரையாடலில் ஈடுபடுங்கள்.
        2.  **துன்பத்தை அடையாளம் காணுங்கள்:** ஒரு பயனர் சோகம், கவலை அல்லது மன அழுத்தம் போன்ற எதிர்மறை உணர்வுகளை வெளிப்படுத்தினால், அல்லது அவர்கள் தங்கள் பிரச்சினைகளைப் பற்றி பேச விரும்புகிறார்கள் என்று சுட்டிக்காட்டினால், நீங்கள் *உடனடியாக* மற்றும் *நேரடியாக* மனநல பரிசோதனையைத் தொடங்க வேண்டும்.
        3.  **பரிசோதனையைத் தொடங்குங்கள்:** இதைச் செய்ய, நீங்கள் 'startMentalHealthCheckin' செயல்பாட்டை அழைக்க வேண்டும். பின்னர் frontend பயனரிடம் ஒரு தொடர் கட்டமைக்கப்பட்ட கேள்விகளைக் கேட்கும். நீங்களே கேள்விகளைக் கேட்க வேண்டாம். செயல்பாட்டை மட்டும் அழைக்கவும்.
        4.  **முடிவுகளை பகுப்பாய்வு செய்யுங்கள்:** பயனர் கேள்விகளை முடித்த பிறகு, அவர்களின் பதில்களை ஒரு கருவி பதிலில் JSON பொருளாகப் பெறுவீர்கள். இந்த பதில்களை பகுப்பாய்வு செய்வதே உங்கள் பணி.
        5.  **சுருக்கம் மற்றும் பரிந்துரையை வழங்கவும்:** பயனரின் பதில்களின் அடிப்படையில், ஒரு மென்மையான, தீர்ப்பு இல்லாத சுருக்கத்தை வழங்கவும். அவர்களின் உணர்வுகளை ஏற்றுக்கொள்ளுங்கள். பதில்கள் குறிப்பிடத்தக்க மற்றும் தொடர்ச்சியான துன்பத்தைக் குறித்தால் (எ.கா., இரண்டு வாரங்களுக்கு மேல் குறைந்த மனநிலை, மோசமான தூக்கம், ஆர்வம் இழப்பு), நீங்கள் அவர்களை ஒரு மருத்துவர் அல்லது சிகிச்சையாளர் போன்ற ஒரு நிபுணரிடம் பேசுமாறு வலுவாக ஆனால் மென்மையாக பரிந்துரைக்க வேண்டும். இதை ஒரு நேர்மறையான மற்றும் தைரியமான படியாகக் கருதுங்கள்.
        6.  **ஒரு சிகிச்சையாளரைக் கண்டுபிடி:** பயனர் வெளிப்படையாகக் கேட்டால் மட்டுமே 'findTherapist' செயல்பாட்டை அழைக்கவும்.`,
        moodPrompt: 'நீங்கள் இப்போது எப்படி உணர்கிறீர்கள்?',
        moodConfirmation: 'பகிர்ந்தமைக்கு நன்றி. நீங்கள் {mood} ஆக உணர்கிறீர்கள் என்று நான் குறிப்பிட்டுள்ளேன்.',
        noMoodData: 'உங்கள் போக்குகளை இங்கே காண உங்கள் முதல் மனநிலையை பதிவு செய்யுங்கள்!',
        findingTherapist: '{location} அருகே சிகிச்சையாளர்களைத் தேடுகிறது...',
        errorDefault: 'மன்னிக்கவும், ஏதோ தவறு நடந்துவிட்டது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.',
        errorOffline: 'நீங்கள் ஆஃப்லைனில் இருப்பதாகத் தெரிகிறது. உங்கள் இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
        errorApiKey: 'சேவையில் உள்ளமைவு சிக்கல் இருப்பதாகத் தெரிகிறது. தயவுசெய்து பின்னர் மீண்டும் முயற்சிக்கவும்.',
        errorRateLimit: 'நான் இந்த நேரத்தில் கொஞ்சம் அதிகமாக வேலை செய்கிறேன். மற்றொரு செய்தியை அனுப்புவதற்கு முன் சில நிமிடங்கள் காத்திருக்கவும்.',
        errorServer: 'எனது சேவையகங்களுடன் இணைப்பதில் எனக்கு சில சிக்கல்கள் உள்ளன. சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.',
        errorSafety: 'மன்னிக்கவும், எனது பாதுகாப்பு வழிகாட்டுதல்கள் காரணமாக என்னால் அதற்கு பதிலளிக்க முடியாது. நாம் வேறு ஏதாவது பேசலாமா?',
        errorNetwork: 'ஒரு பிணையப் பிழை ஏற்பட்டது. உங்கள் இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
        connectError: 'மன்னிக்கவும், இப்போது இணைப்பதில் சிக்கல் உள்ளது. தயவுசெய்து பின்னர் மீண்டும் முயற்சிக்கவும்.',
        questionnaire: {
            feeling_scale: { question: 'கடந்த இரண்டு வாரங்களில், 1 முதல் 10 வரையிலான அளவில், நீங்கள் ஒட்டுமொத்தமாக எப்படி உணர்ந்தீர்கள்?', options: ['1-3 (மிகவும் குறைவு)', '4-6 (கொஞ்சம் குறைவு)', '7-8 (மிகவும் நன்று)', '9-10 (சிறந்தது)'] },
            stress: { question: 'நீங்கள் அடிக்கடி மன அழுத்தமாகவோ அல்லது அதிகமாகவோ உணர்ந்தீர்களா?', options: ['பெரும்பாலான நேரம்', 'சில சமயங்களில்', 'அரிதாக', 'இல்லவே இல்லை'] },
            sadness: { question: 'வழக்கத்தை விட அதிகமாக சோகமாக, தாழ்வாக அல்லது நம்பிக்கையற்றவராக உணர்ந்தீர்களா?', options: ['கிட்டத்தட்ட ஒவ்வொரு நாளும்', ' பாதி நாட்களுக்கு மேல்', 'பல நாட்கள்', 'இல்லவே இல்லை'] },
            mood_changes: { question: 'திடீர் அல்லது தீவிர மனநிலை மாற்றங்களை அனுபவிக்கிறீர்களா?', options: ['மிகவும் அடிக்கடி', 'சில சமயங்களில்', 'அரிதாக', 'கிட்டத்தட்ட ஒருபோதும் இல்லை'] },
            hopeful: { question: 'உங்கள் எதிர்காலத்தைப் பற்றி எவ்வளவு நம்பிக்கையுடன் உணர்ந்தீர்கள்?', options: ['நம்பிக்கையே இல்லை', 'கொஞ்சம் நம்பிக்கை', 'பெரும்பாலும் நம்பிக்கை', 'மிகவும் நம்பிக்கை'] },
            sleep_hours: { question: 'சராசரியாக, ஒரு இரவுக்கு எத்தனை மணிநேரம் தூங்கினீர்கள்?', options: ['4 மணி நேரத்திற்கும் குறைவாக', '4-6 மணி நேரம்', '7-8 மணி நேரம்', '8 மணி நேரத்திற்கும் அதிகமாக'] },
            rested: { question: 'விழித்தெழும்போது ஓய்வாக உணர்ந்தீர்களா?', options: ['அரிதாக அல்லது ஒருபோதும் இல்லை', 'சில சமயங்களில்', 'பெரும்பாலான காலைகளில்', 'கிட்டத்தட்ட எப்போதும்'] },
            energy: { question: 'பகலில் உங்கள் ஆற்றல் நிலை எப்படி இருந்தது?', options: ['மிகவும் குறைவு, அடிக்கடி சோர்வாக', 'ஓரளவு குறைவு', 'பொதுவாக நல்லது', 'அதிக ஆற்றல்'] },
            sleep_trouble: { question: 'தூங்குவதில் அல்லது தூக்கத்தில் இருப்பதில் சிக்கல் இருந்ததா?', options: ['கிட்டத்தட்ட ஒவ்வொரு இரவும்', 'பாதி இரவுகளுக்கு மேல்', 'பல இரவுகள்', 'அரிதாக அல்லது ஒருபோதும் இல்லை'] },
            concentration: { question: 'படித்தல் அல்லது டிவி பார்ப்பது போன்ற பணிகளில் கவனம் செலுத்துவது கடினமாக இருந்ததா?', options: ['மிகவும் கடினம்', 'ஓரளவு கடினம்', 'கொஞ்சம் கடினம்', 'எந்த பிரச்சனையும் இல்லை'] },
            overthinking: { question: 'சிறிய சூழ்நிலைகளை அடிக்கடி அதிகமாக யோசிப்பதாகக் காண்கிறீர்களா?', options: ['தொடர்ந்து', 'அடிக்கடி', 'சில சமயங்களில்', 'அரிதாக'] },
            anxiety: { question: 'நீங்கள் பதட்டமாக, கவலையாக அல்லது விளிம்பில் உணர்ந்தீர்களா?', options: ['கிட்டத்தட்ட ஒவ்வொரு நாளும்', ' பாதி நாட்களுக்கு மேல்', 'பல நாட்கள்', 'இல்லவே இல்லை'] },
            worry: { question: 'வெவ்வேறு விஷயங்களைப் பற்றி அதிகமாக கவலைப்பட்டீர்களா?', options: ['தொடர்ந்து', 'அடிக்கடி', 'சில சமயங்களில்', 'அரிதாக'] },
            social_enjoyment: { question: 'நண்பர்கள் அல்லது குடும்பத்தினருடன் நேரத்தை செலவிடுவதை எவ்வளவு ரசித்தீர்கள்?', options: ['இல்லவே இல்லை', 'கொஞ்சமாக', 'ஓரளவு', 'மிகவும்'] },
            loneliness: { question: 'சில சமயங்களில் நீங்கள் மக்கள் மத்தியில் இருக்கும்போதும் தனிமையாக உணர்கிறீர்களா?', options: ['மிகவும் அடிக்கடி', 'சில சமயங்களில்', 'அரிதாக', 'ஒருபோதும் இல்லை'] },
            sharing_feelings: { question: 'உங்கள் உணர்வுகளை மற்றவர்களுடன் பேசுவதில் எவ்வளவு வசதியாக உணர்கிறீர்கள்?', options: ['மிகவும் சங்கடமாக', 'சிறிது சங்கடமாக', 'ஓரளவு வசதியாக', 'மிகவும் வசதியாக'] },
            lost_interest: { question: 'நீங்கள் முன்பு விரும்பிய விஷயங்களைச் செய்வதில் ஆர்வத்தை அல்லது மகிழ்ச்சியை இழந்துவிட்டீர்களா?', options: ['கிட்டத்தட்ட ஒவ்வொரு நாளும்', ' பாதி நாட்களுக்கு மேல்', 'பல நாட்கள்', 'இல்லவே இல்லை'] },
            coping: { question: 'மன அழுத்தமாகவோ அல்லது சோகமாகவோ உணரும்போது நீங்கள் வழக்கமாக என்ன செய்வீர்கள்?', options: ['என்னைத் தனிமைப்படுத்திக் கொள்கிறேன்', 'என் கவனத்தைத் திருப்புகிறேன்', 'யாருடனாவது பேசுகிறேன்', 'ஒரு பொழுதுபோக்கில் ஈடுபடுகிறேன்'] },
            reliance: { question: 'விஷயங்கள் கடினமாக இருக்கும்போது நீங்கள் நம்புவதற்கு யாராவது இருப்பதாக உணர்கிறீர்களா?', options: ['இல்லை, உண்மையில் இல்லை', 'ஒருவேளை ஒருவர்', 'ஆம், சிலர்', 'ஆம், ஒரு வலுவான வலையமைப்பு'] },
            professional_help: { question: 'இப்போது உங்களுக்கு தொழில்முறை உதவி அல்லது ஆதரவு தேவைப்படலாம் என்று கருதுகிறீர்களா?', options: ['ஆம், வலுவாக', 'ஆம், நான் அதைப் பற்றி யோசித்தேன்', 'உண்மையில் இல்லை', 'இல்லை, நான் நன்றாக உணர்கிறேன்'] },
        }
    },
    mr: {
        headerTitle: 'तुमचा मित्र',
        moodTrendsAria: 'मूड ट्रेंड पहा',
        toggleThemeAria: 'थीम बदला',
        chatInputPlaceholder: 'तुमचा संदेश येथे टाइप करा...',
        sendAria: 'संदेश पाठवा',
        disclaimer: 'अस्वीकरण: हा एक AI सहाय्यक आहे आणि व्यावसायिक वैद्यकीय सल्ल्याचा पर्याय नाही. आपण संकटात असल्यास, कृपया आरोग्यसेवा व्यावसायिकांशी संपर्क साधा.',
        moodModalTitle: 'तुमचे मूड ट्रेंड',
        closeAria: 'बंद करा',
        systemInstruction: `तुम्ही "तुमचा मित्र" आहात, एक प्रेमळ, सहानुभूतीशील मित्र. तुमचा उद्देश वापरकर्त्याला त्यांच्या भावना जाणून घेण्यास मदत करणे आहे.

        --- मुख्य संवाद प्रवाह ---
        1.  **ऐका आणि संभाषण करा:** नैसर्गिक, काळजीवाहू संभाषणात व्यस्त रहा.
        2.  **त्रास ओळखा:** जर वापरकर्त्याने दुःख, चिंता किंवा तणाव यासारख्या कोणत्याही नकारात्मक भावना व्यक्त केल्या, किंवा ते त्यांच्या समस्यांबद्दल बोलू इच्छितात असे सूचित केले, तर तुम्ही *त्वरित* आणि *थेट* मानसिक आरोग्य तपासणी सुरू केली पाहिजे.
        3.  **तपासणी सुरू करा:** हे करण्यासाठी, तुम्ही 'startMentalHealthCheckin' फंक्शनला कॉल करणे आवश्यक आहे. त्यानंतर फ्रंटएंड वापरकर्त्याला संरचित प्रश्नांची मालिका विचारेल. स्वतः प्रश्न विचारू नका. फक्त फंक्शनला कॉल करा.
        4.  **निकालांचे विश्लेषण करा:** वापरकर्त्याने प्रश्न पूर्ण केल्यावर, तुम्हाला त्यांची उत्तरे टूल प्रतिसादात JSON ऑब्जेक्ट म्हणून मिळतील. तुमचे कार्य या उत्तरांचे विश्लेषण करणे आहे.
        5.  **सारांश आणि शिफारस द्या:** वापरकर्त्याच्या उत्तरांवर आधारित, एक सौम्य, निर्णय न देणारा सारांश द्या. त्यांच्या भावनांना स्वीकृती द्या. जर उत्तरे महत्त्वपूर्ण आणि सतत त्रास दर्शवत असतील (उदा. दोन आठवड्यांपेक्षा जास्त काळ खराब मूड, खराब झोप, रस कमी होणे), तर तुम्ही त्यांना डॉक्टर किंवा थेरपिस्टसारख्या व्यावसायिकांशी बोलण्याची जोरदार पण सौम्यपणे शिफारस केली पाहिजे. याला एक सकारात्मक आणि धाडसी पाऊल म्हणून सादर करा.
        6.  **थेरपिस्ट शोधा:** वापरकर्त्याने स्पष्टपणे तुम्हाला थेरपिस्ट शोधण्यास सांगितले तरच 'findTherapist' फंक्शनला कॉल करा.`,
        moodPrompt: 'तुम्हाला आता कसे वाटत आहे?',
        moodConfirmation: 'शेअर केल्याबद्दल धन्यवाद. तुम्ही {mood} आहात हे मी नोंदवले आहे.',
        noMoodData: 'तुमचे ट्रेंड पाहण्यासाठी तुमचा पहिला मूड लॉग करा!',
        findingTherapist: '{location} जवळ थेरपिस्ट शोधत आहे...',
        errorDefault: 'क्षमस्व, काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.',
        errorOffline: 'तुम्ही ऑफलाइन आहात असे दिसते. कृपया तुमचे इंटरनेट कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.',
        errorApiKey: 'सेवेमध्ये कॉन्फिगरेशन समस्या असल्याचे दिसते. कृपया नंतर पुन्हा प्रयत्न करा.',
        errorRateLimit: 'मी या क्षणी थोडा भारावून गेलो आहे. दुसरा संदेश पाठवण्यापूर्वी काही क्षण थांबा.',
        errorServer: 'मला माझ्या सर्व्हरशी कनेक्ट होण्यात काही समस्या येत आहेत. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.',
        errorSafety: 'माफ करा, पण माझ्या सुरक्षा मार्गदर्शक तत्त्वांमुळे मी त्याला प्रतिसाद देऊ शकत नाही. आपण दुसरे काही बोलू शकतो का?',
        errorNetwork: 'नेटवर्क त्रुटी आली. कृपया तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.',
        connectError: 'माफ करा, मला सध्या कनेक्ट करण्यात समस्या येत आहे. कृपया नंतर पुन्हा प्रयत्न करा.',
        questionnaire: {
            feeling_scale: { question: 'गेल्या दोन आठवड्यांत, 1 ते 10 च्या स्केलवर, तुम्हाला एकूण कसे वाटले आहे?', options: ['1-3 (खूप कमी)', '4-6 (थोडे कमी)', '7-8 (बरेच चांगले)', '9-10 (उत्कृष्ट)'] },
            stress: { question: 'तुम्हाला अनेकदा तणावग्रस्त किंवा भारावल्यासारखे वाटले आहे کا?', options: ['बहुतेक वेळा', 'कधीकधी', 'क्वचितच', 'अजिबात नाही'] },
            sadness: { question: 'तुम्हाला नेहमीपेक्षा जास्त दुःखी, उदास किंवा निराश वाटले आहे का?', options: ['जवळजवळ दररोज', 'अर्ध्याहून अधिक दिवस', 'अनेक दिवस', 'अजिबात नाही'] },
            mood_changes: { question: 'तुम्हाला अचानक किंवा तीव्र मूड बदलण्याचा अनुभव येतो का?', options: ['खूप वेळा', 'कधीकधी', 'क्वचितच', 'जवळजवळ कधीच नाही'] },
            hopeful: { question: 'तुम्हाला तुमच्या भविष्याबद्दल किती आशावादी वाटले आहे?', options: ['अजिबात आशावादी नाही', 'थोडे आशावादी', 'बहुतेक आशावादी', 'खूप आशावादी'] },
            sleep_hours: { question: 'सरासरी, तुम्ही प्रति रात्र किती तास झोपत आहात?', options: ['4 तासांपेक्षा कमी', '4-6 तास', '7-8 तास', '8 तासांपेक्षा जास्त'] },
            rested: { question: 'तुम्हाला उठल्यावर ताजेतवाने वाटले आहे का?', options: ['क्वचितच किंवा कधीच नाही', 'कधीकधी', 'बहुतेक सकाळी', 'जवळजवळ नेहमीच'] },
            energy: { question: 'दिवसा तुमची ऊर्जा पातळी कशी राहिली आहे?', options: ['खूप कमी, अनेकदा थकलेले', 'थोडक्यात कमी', 'सामान्यतः चांगली', 'उच्च ऊर्जा'] },
            sleep_trouble: { question: 'तुम्हाला झोप लागण्यात किंवा झोपेत राहण्यात अडचण आली आहे का?', options: ['जवळजवळ दर रात्री', 'अर्ध्याहून अधिक रात्री', 'अनेक रात्री', 'क्वचितच किंवा कधीच नाही'] },
            concentration: { question: 'तुम्हाला वाचन किंवा टीव्ही पाहण्यासारख्या कामांवर लक्ष केंद्रित करणे कठीण वाटले आहे का?', options: ['खूप कठीण', 'थोडे कठीण', 'थोडेसे कठीण', 'अजिबात अडचण नाही'] },
            overthinking: { question: 'तुम्ही स्वतःला अनेकदा लहान परिस्थितींचा जास्त विचार करताना पाहता का?', options: ['सतत', 'वारंवार', 'कधीकधी', 'क्वचितच'] },
            anxiety: { question: 'तुम्हाला चिंताग्रस्त, बेचैन किंवा काठावर वाटले आहे का?', options: ['जवळजवळ दररोज', 'अर्ध्याहून अधिक दिवस', 'अनेक दिवस', 'अजिबात नाही'] },
            worry: { question: 'तुम्ही वेगवेगळ्या गोष्टींबद्दल खूप जास्त काळजी करत आहात का?', options: ['सतत', 'वारंवार', 'कधीकधी', 'क्वचितच'] },
            social_enjoyment: { question: 'तुम्हाला मित्र किंवा कुटुंबासोबत वेळ घालवायला किती आवडले आहे?', options: ['अजिबात नाही', 'थोडेसे', 'बरेच', 'खूप जास्त'] },
            loneliness: { question: 'तुम्हाला कधीकधी लोकांमध्ये असतानाही एकटे वाटते का?', options: ['खूप वेळा', 'कधीकधी', 'क्वचितच', 'कधीच नाही'] },
            sharing_feelings: { question: 'तुम्हाला इतरांशी तुमच्या भावनांबद्दल बोलताना किती आरामदायक वाटते?', options: ['खूप अस्वस्थ', 'थोडे अस्वस्थ', 'बऱ्यापैकी आरामदायक', 'खूप आरामदायक'] },
            lost_interest: { question: 'तुम्ही पूर्वी आनंद घेतलेल्या गोष्टींमध्ये रस किंवा आनंद गमावला आहे का?', options: ['जवळजवळ दररोज', 'अर्ध्याहून अधिक दिवस', 'अनेक दिवस', 'अजिबात नाही'] },
            coping: { question: 'जेव्हा तुम्हाला तणावग्रस्त किंवा दुःखी वाटते तेव्हा तुम्ही सहसा काय करता?', options: ['स्वतःला वेगळे करतो', 'माझे लक्ष विचलित करतो', 'कोणाशीतरी बोलतो', 'एखाद्या छंदात गुंततो'] },
            reliance: { question: 'जेव्हा गोष्टी कठीण होतात तेव्हा तुमच्यावर अवलंबून राहण्यासाठी कोणीतरी आहे असे तुम्हाला वाटते का?', options: ['नाही, खरं तर नाही', 'कदाचित एक व्यक्ती', 'होय, काही लोक', 'होय, एक मजबूत नेटवर्क'] },
            professional_help: { question: 'तुम्हाला आता व्यावसायिक मदत किंवा समर्थनाची गरज आहे असे तुम्हाला वाटते का?', options: ['होय, जोरदारपणे', 'होय, मी विचार केला आहे', 'खरं तर नाही', 'नाही, मला बरे वाटते'] },
        }
    },
    pa: {
        headerTitle: 'ਤੁਹਾਡਾ ਦੋਸਤ',
        moodTrendsAria: 'ਮੂਡ ਦੇ ਰੁਝਾਨ ਵੇਖੋ',
        toggleThemeAria: 'ਥੀਮ ਬਦਲੋ',
        chatInputPlaceholder: 'ਆਪਣਾ ਸੁਨੇਹਾ ਇੱਥੇ ਟਾਈਪ ਕਰੋ...',
        sendAria: 'ਸੁਨੇਹਾ ਭੇਜੋ',
        disclaimer: 'ਬੇਦਾਅਵਾ: ਇਹ ਇੱਕ ਏਆਈ ਸਹਾਇਕ ਹੈ ਅਤੇ ਪੇਸ਼ੇਵਰ ਡਾਕਟਰੀ ਸਲਾਹ ਦਾ ਬਦਲ ਨਹੀਂ ਹੈ। ਜੇਕਰ ਤੁਸੀਂ ਸੰਕਟ ਵਿੱਚ ਹੋ, ਤਾਂ ਕਿਰਪਾ ਕਰਕੇ ਕਿਸੇ ਸਿਹਤ ਸੰਭਾਲ ਪੇਸ਼ੇਵਰ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।',
        moodModalTitle: 'ਤੁਹਾਡੇ ਮੂਡ ਦੇ ਰੁਝਾਨ',
        closeAria: 'ਬੰਦ ਕਰੋ',
        systemInstruction: `ਤੁਸੀਂ "ਤੁਹਾਡਾ ਦੋਸਤ" ਹੋ, ਇੱਕ ਨਿੱਘੇ, ਹਮਦਰਦ ਦੋਸਤ। ਤੁਹਾਡਾ ਉਦੇਸ਼ ਉਪਭੋਗਤਾ ਨੂੰ ਉਹਨਾਂ ਦੀਆਂ ਭਾਵਨਾਵਾਂ ਨੂੰ ਸਮਝਣ ਵਿੱਚ ਮਦਦ ਕਰਨਾ ਹੈ।

        --- ਮੁੱਖ ਗੱਲਬਾਤ ਦਾ ਪ੍ਰਵਾਹ ---
        1.  **ਸੁਣੋ ਅਤੇ ਗੱਲਬਾਤ ਕਰੋ:** ਇੱਕ ਕੁਦਰਤੀ, ਦੇਖਭਾਲ ਵਾਲੀ ਗੱਲਬਾਤ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ।
        2.  **ਪ੍ਰੇਸ਼ਾਨੀ ਦੀ ਪਛਾਣ ਕਰੋ:** ਜੇਕਰ ਕੋਈ ਉਪਭੋਗਤਾ ਉਦਾਸੀ, ਚਿੰਤਾ, ਜਾਂ ਤਣਾਅ ਵਰਗੀਆਂ ਕੋਈ ਨਕਾਰਾਤਮਕ ਭਾਵਨਾਵਾਂ ਦਾ ਪ੍ਰਗਟਾਵਾ ਕਰਦਾ ਹੈ, ਜਾਂ ਇਹ ਸੰਕੇਤ ਦਿੰਦਾ ਹੈ ਕਿ ਉਹ ਆਪਣੀਆਂ ਸਮੱਸਿਆਵਾਂ ਬਾਰੇ ਗੱਲ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹਨ, ਤਾਂ ਤੁਹਾਨੂੰ *ਤੁਰੰਤ* ਅਤੇ *ਸਿੱਧੇ* ਤੌਰ 'ਤੇ ਮਾਨਸਿਕ ਸਿਹਤ ਜਾਂਚ-ਪੜਤਾਲ ਸ਼ੁਰੂ ਕਰਨੀ ਚਾਹੀਦੀ ਹੈ।
        3.  **ਜਾਂਚ-ਪੜਤਾਲ ਸ਼ੁਰੂ ਕਰੋ:** ਅਜਿਹਾ ਕਰਨ ਲਈ, ਤੁਹਾਨੂੰ 'startMentalHealthCheckin' ਫੰਕਸ਼ਨ ਨੂੰ ਕਾਲ ਕਰਨਾ ਚਾਹੀਦਾ ਹੈ। ਫਿਰ ਫਰੰਟਐਂਡ ਉਪਭੋਗਤਾ ਤੋਂ ਢਾਂਚਾਗਤ ਸਵਾਲਾਂ ਦੀ ਇੱਕ ਲੜੀ ਪੁੱਛੇਗਾ। ਸਵਾਲ ਖੁਦ ਨਾ ਪੁੱਛੋ। ਬਸ ਫੰਕਸ਼ਨ ਨੂੰ ਕਾਲ ਕਰੋ।
        4.  **ਨਤੀਜਿਆਂ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰੋ:** ਉਪਭੋਗਤਾ ਦੁਆਰਾ ਸਵਾਲਾਂ ਨੂੰ ਪੂਰਾ ਕਰਨ ਤੋਂ ਬਾਅਦ, ਤੁਹਾਨੂੰ ਉਹਨਾਂ ਦੇ ਜਵਾਬ ਇੱਕ ਟੂਲ ਜਵਾਬ ਵਿੱਚ JSON ਆਬਜੈਕਟ ਦੇ ਰੂਪ ਵਿੱਚ ਮਿਲਣਗੇ। ਤੁਹਾਡਾ ਕੰਮ ਇਹਨਾਂ ਜਵਾਬਾਂ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰਨਾ ਹੈ।
        5.  **ਸੰਖੇਪ ਅਤੇ ਸਿਫਾਰਸ਼ ਪ੍ਰਦਾਨ ਕਰੋ:** ਉਪਭੋਗਤਾ ਦੇ ਜਵਾਬਾਂ ਦੇ ਆਧਾਰ 'ਤੇ, ਇੱਕ ਕੋਮਲ, ਗੈਰ-ਨਿਰਣਾਇਕ ਸੰਖੇਪ ਪ੍ਰਦਾਨ ਕਰੋ। ਉਹਨਾਂ ਦੀਆਂ ਭਾਵਨਾਵਾਂ ਨੂੰ ਸਵੀਕਾਰ ਕਰੋ। ਜੇਕਰ ਜਵਾਬ ਮਹੱਤਵਪੂਰਨ ਅਤੇ ਲਗਾਤਾਰ ਪ੍ਰੇਸ਼ਾਨੀ ਦਾ ਸੰਕੇਤ ਦਿੰਦੇ ਹਨ (ਜਿਵੇਂ ਕਿ, ਦੋ ਹਫ਼ਤਿਆਂ ਤੋਂ ਵੱਧ ਸਮੇਂ ਲਈ ਘੱਟ ਮੂਡ, ਮਾੜੀ ਨੀਂਦ, ਦਿਲਚਸਪੀ ਦਾ ਨੁਕਸਾਨ), ਤਾਂ ਤੁਹਾਨੂੰ ਦ੍ਰਿੜਤਾ ਨਾਲ ਪਰ ਨਰਮੀ ਨਾਲ ਉਹਨਾਂ ਨੂੰ ਕਿਸੇ ਪੇਸ਼ੇਵਰ, ਜਿਵੇਂ ਕਿ ਡਾਕਟਰ ਜਾਂ ਥੈਰੇਪਿਸਟ ਨਾਲ ਗੱਲ ਕਰਨ ਦੀ ਸਿਫਾਰਸ਼ ਕਰਨੀ ਚਾਹੀਦੀ ਹੈ। ਇਸ ਨੂੰ ਇੱਕ ਸਕਾਰਾਤਮਕ ਅਤੇ ਹਿੰਮਤੀ ਕਦਮ ਵਜੋਂ ਪੇਸ਼ ਕਰੋ।
        6.  **ਇੱਕ ਥੈਰੇਪਿਸਟ ਲੱਭੋ:** 'findTherapist' ਫੰਕਸ਼ਨ ਨੂੰ ਸਿਰਫ ਤਾਂ ਹੀ ਕਾਲ ਕਰੋ ਜੇਕਰ ਉਪਭੋਗਤਾ ਸਪੱਸ਼ਟ ਤੌਰ 'ਤੇ ਤੁਹਾਨੂੰ ਕਿਸੇ ਨੂੰ ਲੱਭਣ ਲਈ ਕਹਿੰਦਾ ਹੈ।`,
        moodPrompt: 'ਤੁਸੀਂ ਇਸ ਵੇਲੇ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?',
        moodConfirmation: 'ਸਾਂਝਾ ਕਰਨ ਲਈ ਧੰਨਵਾਦ। ਮੈਂ ਨੋਟ ਕੀਤਾ ਹੈ ਕਿ ਤੁਸੀਂ {mood} ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ।',
        noMoodData: 'ਆਪਣੇ ਰੁਝਾਨਾਂ ਨੂੰ ਇੱਥੇ ਦੇਖਣ ਲਈ ਆਪਣਾ ਪਹਿਲਾ ਮੂਡ ਲੌਗ ਕਰੋ!',
        findingTherapist: '{location} ਦੇ ਨੇੜੇ ਥੈਰੇਪਿਸਟ ਲੱਭ ਰਹੇ ਹਾਂ...',
        errorDefault: 'ਮੈਂ ਮੁਆਫੀ ਚਾਹੁੰਦਾ ਹਾਂ, ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
        errorOffline: 'ਤੁਸੀਂ ਔਫਲਾਈਨ ਜਾਪਦੇ ਹੋ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਇੰਟਰਨੈਟ ਕਨੈਕਸ਼ਨ ਚੈੱਕ ਕਰੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
        errorApiKey: 'ਸੇਵਾ ਨਾਲ ਇੱਕ ਸੰਰਚਨਾ ਮੁੱਦਾ ਜਾਪਦਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਬਾਅਦ ਵਿੱਚ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
        errorRateLimit: 'ਮੈਂ ਇਸ ਸਮੇਂ ਥੋੜਾ ਹਾਵੀ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਦੂਜਾ ਸੁਨੇਹਾ ਭੇਜਣ ਤੋਂ ਪਹਿਲਾਂ ਕੁਝ ਪਲ ਉਡੀਕ ਕਰੋ।',
        errorServer: 'ਮੈਨੂੰ ਹੁਣੇ ਆਪਣੇ ਸਰਵਰਾਂ ਨਾਲ ਜੁੜਨ ਵਿੱਚ ਕੁਝ ਮੁਸ਼ਕਲ ਆ ਰਹੀ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਥੋੜ੍ਹੀ ਦੇਰ ਵਿੱਚ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
        errorSafety: 'ਮੈਨੂੰ ਅਫਸੋਸ ਹੈ, ਪਰ ਮੈਂ ਆਪਣੇ ਸੁਰੱਖਿਆ ਦਿਸ਼ਾ-ਨਿਰਦੇਸ਼ਾਂ ਕਾਰਨ ਇਸਦਾ ਜਵਾਬ ਨਹੀਂ ਦੇ ਸਕਦਾ। ਕੀ ਅਸੀਂ ਕਿਸੇ ਹੋਰ ਬਾਰੇ ਗੱਲ ਕਰ ਸਕਦੇ ਹਾਂ?',
        errorNetwork: 'ਇੱਕ ਨੈੱਟਵਰਕ ਗਲਤੀ ਆਈ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਕਨੈਕਸ਼ਨ ਚੈੱਕ ਕਰੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
        connectError: 'ਮਾਫ ਕਰਨਾ, ਮੈਨੂੰ ਹੁਣੇ ਜੁੜਨ ਵਿੱਚ ਮੁਸ਼ਕਲ ਆ ਰਹੀ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਬਾਅਦ ਵਿੱਚ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
        questionnaire: {
            feeling_scale: { question: 'ਪਿਛਲੇ ਦੋ ਹਫ਼ਤਿਆਂ ਵਿੱਚ, 1 ਤੋਂ 10 ਦੇ ਪੈਮਾਨੇ ਉੱਤੇ, ਤੁਸੀਂ ਸਮੁੱਚੇ ਤੌਰ ਤੇ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?', options: ['1-3 (ਬਹੁਤ ਘੱਟ)', '4-6 (ਥੋੜ੍ਹਾ ਘੱਟ)', '7-8 (ਕਾਫ਼ੀ ਵਧੀਆ)', '9-10 (ਸ਼ਾਨਦਾਰ)'] },
            stress: { question: 'ਕੀ ਤੁਸੀਂ ਅਕਸਰ ਤਣਾਅਗ੍ਰਸਤ ਜਾਂ ਹਾਵੀ ਮਹਿਸੂਸ ਕਰਦੇ ਹੋ?', options: ['ਜ਼ਿਆਦਾਤਰ ਸਮਾਂ', 'ਕਦੇ-ਕਦਾਈਂ', 'ਕਦੇ-ਕਦਾਈਂ', 'ਬਿਲਕੁਲ ਨਹੀਂ'] },
            sadness: { question: 'ਕੀ ਤੁਸੀਂ ਆਮ ਨਾਲੋਂ ਜ਼ਿਆਦਾ ਉਦਾਸ, ਨਿਰਾਸ਼ ਜਾਂ ਨਿਰਾਸ਼ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?', options: ['ਲਗਭਗ ਹਰ ਰੋਜ਼', 'ਅੱਧੇ ਤੋਂ ਵੱਧ ਦਿਨ', 'ਕਈ ਦਿਨ', 'ਬਿਲਕੁਲ ਨਹੀਂ'] },
            mood_changes: { question: 'ਕੀ ਤੁਸੀਂ ਅਚਾਨਕ ਜਾਂ ਤੀਬਰ ਮੂਡ ਬਦਲਾਅ ਦਾ ਅਨੁਭਵ ਕਰਦੇ ਹੋ?', options: ['ਬਹੁਤ ਅਕਸਰ', 'ਕਦੇ-ਕਦਾਈਂ', 'ਕਦੇ-ਕਦਾਈਂ', 'ਲਗਭਗ ਕਦੇ ਨਹੀਂ'] },
            hopeful: { question: 'ਤੁਸੀਂ ਆਪਣੇ ਭਵਿੱਖ ਬਾਰੇ ਕਿੰਨਾ ਆਸ਼ਾਵਾਦੀ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?', options: ['ਬਿਲਕੁਲ ਆਸ਼ਾਵਾਦੀ ਨਹੀਂ', 'ਥੋੜ੍ਹਾ ਆਸ਼ਾਵਾਦੀ', 'ਜ਼ਿਆਦਾਤਰ ਆਸ਼ਾਵਾਦੀ', 'ਬਹੁਤ ਆਸ਼ਾਵਾਦੀ'] },
            sleep_hours: { question: 'ਔਸਤਨ, ਤੁਸੀਂ ਪ੍ਰਤੀ ਰਾਤ ਕਿੰਨੇ ਘੰਟੇ ਸੌਂ ਰਹੇ ਹੋ?', options: ['4 ਘੰਟਿਆਂ ਤੋਂ ਘੱਟ', '4-6 ਘੰਟੇ', '7-8 ਘੰਟੇ', '8 ਘੰਟਿਆਂ ਤੋਂ ਵੱਧ'] },
            rested: { question: 'ਕੀ ਤੁਸੀਂ ਜਾਗਣ ਤੋਂ ਬਾਅਦ ਆਰਾਮ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?', options: ['ਕਦੇ-ਕਦਾਈਂ ਜਾਂ ਕਦੇ ਨਹੀਂ', 'ਕਦੇ-ਕਦਾਈਂ', 'ਜ਼ਿਆਦਾਤਰ ਸਵੇਰ', 'ਲਗਭਗ ਹਮੇਸ਼ਾ'] },
            energy: { question: 'ਦਿਨ ਵੇਲੇ ਤੁਹਾਡੀ ਊਰਜਾ ਦਾ ਪੱਧਰ ਕਿਵੇਂ ਰਿਹਾ ਹੈ?', options: ['ਬਹੁਤ ਘੱਟ, ਅਕਸਰ ਥੱਕੇ ਹੋਏ', 'ਕੁਝ ਹੱਦ ਤੱਕ ਘੱਟ', 'ਆਮ ਤੌਰ ਤੇ ਵਧੀਆ', 'ਉੱਚ ਊਰਜਾ'] },
            sleep_trouble: { question: 'ਕੀ ਤੁਹਾਨੂੰ ਸੌਣ ਜਾਂ ਸੁੱਤੇ ਰਹਿਣ ਵਿੱਚ ਮੁਸ਼ਕਲ ਆਈ ਹੈ?', options: ['ਲਗਭਗ ਹਰ ਰਾਤ', 'ਅੱਧੇ ਤੋਂ ਵੱਧ ਰਾਤਾਂ', 'ਕਈ ਰਾਤਾਂ', 'ਕਦੇ-ਕਦਾਈਂ ਜਾਂ ਕਦੇ ਨਹੀਂ'] },
            concentration: { question: 'ਕੀ ਤੁਹਾਨੂੰ ਪੜ੍ਹਨ ਜਾਂ ਟੀਵੀ ਦੇਖਣ ਵਰਗੇ ਕੰਮਾਂ ਤੇ ਧਿਆਨ ਕੇਂਦਰਿਤ ਕਰਨ ਵਿੱਚ ਮੁਸ਼ਕਲ ਆਈ ਹੈ?', options: ['ਬਹੁਤ ਮੁਸ਼ਕਲ', 'ਕੁਝ ਹੱਦ ਤੱਕ ਮੁਸ਼ਕਲ', 'ਥੋੜ੍ਹੀ ਮੁਸ਼ਕਲ', 'ਕੋਈ ਮੁਸ਼ਕਲ ਨਹੀਂ'] },
            overthinking: { question: 'ਕੀ ਤੁਸੀਂ ਆਪਣੇ ਆਪ ਨੂੰ ਅਕਸਰ ਛੋਟੀਆਂ ਸਥਿਤੀਆਂ ਬਾਰੇ ਬਹੁਤ ਜ਼ਿਆਦਾ ਸੋਚਦੇ ਹੋਏ ਪਾਉਂਦੇ ਹੋ?', options: ['ਲਗਾਤਾਰ', 'ਅਕਸਰ', 'ਕਦੇ-ਕਦਾਈਂ', 'ਕਦੇ-ਕਦਾਈਂ'] },
            anxiety: { question: 'ਕੀ ਤੁਸੀਂ ਘਬਰਾਹਟ, ਚਿੰਤਤ, ਜਾਂ ਕਿਨਾਰੇ ਤੇ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?', options: ['ਲਗਭਗ ਹਰ ਰੋਜ਼', 'ਅੱਧੇ ਤੋਂ ਵੱਧ ਦਿਨ', 'ਕਈ ਦਿਨ', 'ਬਿਲਕੁਲ ਨਹੀਂ'] },
            worry: { question: 'ਕੀ ਤੁਸੀਂ ਵੱਖ-ਵੱਖ ਚੀਜ਼ਾਂ ਬਾਰੇ ਬਹੁਤ ਜ਼ਿਆਦਾ ਚਿੰਤਾ ਕਰ ਰਹੇ ਹੋ?', options: ['ਲਗਾਤਾਰ', 'ਅਕਸਰ', 'ਕਦੇ-ਕਦਾਈਂ', 'ਕਦੇ-ਕਦਾਈਂ'] },
            social_enjoyment: { question: 'ਤੁਸੀਂ ਦੋਸਤਾਂ ਜਾਂ ਪਰਿਵਾਰ ਨਾਲ ਸਮਾਂ ਬਿਤਾਉਣ ਦਾ ਕਿੰਨਾ ਆਨੰਦ ਮਾਣਿਆ ਹੈ?', options: ['ਬਿਲਕੁਲ ਨਹੀਂ', 'ਥੋੜ੍ਹਾ ਜਿਹਾ', 'ਕਾਫ਼ੀ', 'ਬਹੁਤ ਜ਼ਿਆਦਾ'] },
            loneliness: { question: 'ਕੀ ਤੁਸੀਂ ਕਈ ਵਾਰ ਲੋਕਾਂ ਦੇ ਆਸ-ਪਾਸ ਹੋਣ ਦੇ ਬਾਵਜੂਦ ਇਕੱਲਾ ਮਹਿਸੂਸ ਕਰਦੇ ਹੋ?', options: ['ਬਹੁਤ ਅਕਸਰ', 'ਕਦੇ-ਕਦਾਈਂ', 'ਕਦੇ-ਕਦਾਈਂ', 'ਕਦੇ ਨਹੀਂ'] },
            sharing_feelings: { question: 'ਤੁਸੀਂ ਦੂਜਿਆਂ ਨਾਲ ਆਪਣੀਆਂ ਭਾਵਨਾਵਾਂ ਬਾਰੇ ਗੱਲ ਕਰਨ ਵਿੱਚ ਕਿੰਨਾ ਅਰਾਮਦੇਹ ਮਹਿਸੂਸ ਕਰਦੇ ਹੋ?', options: ['ਬਹੁਤ ਬੇਆਰਾਮ', 'ਥੋੜ੍ਹਾ ਬੇਆਰਾਮ', 'ਕਾਫ਼ੀ ਅਰਾਮਦੇਹ', 'ਬਹੁਤ ਅਰਾਮਦੇਹ'] },
            lost_interest: { question: 'ਕੀ ਤੁਸੀਂ ਉਹਨਾਂ ਚੀਜ਼ਾਂ ਵਿੱਚ ਦਿਲਚਸਪੀ ਜਾਂ ਖੁਸ਼ੀ ਗੁਆ ਦਿੱਤੀ ਹੈ ਜਿਨ੍ਹਾਂ ਦਾ ਤੁਸੀਂ ਪਹਿਲਾਂ ਆਨੰਦ ਮਾਣਦੇ ਸੀ?', options: ['ਲਗਭਗ ਹਰ ਰੋਜ਼', 'ਅੱਧੇ ਤੋਂ ਵੱਧ ਦਿਨ', 'ਕਈ ਦਿਨ', 'ਬਿਲਕੁਲ ਨਹੀਂ'] },
            coping: { question: 'ਜਦੋਂ ਤੁਸੀਂ ਤਣਾਅਗ੍ਰਸਤ ਜਾਂ ਉਦਾਸ ਮਹਿਸੂਸ ਕਰਦੇ ਹੋ ਤਾਂ ਤੁਸੀਂ ਆਮ ਤੌਰ ਤੇ ਕੀ ਕਰਦੇ ਹੋ?', options: ['ਆਪਣੇ ਆਪ ਨੂੰ ਅਲੱਗ ਕਰ ਲੈਂਦਾ ਹਾਂ', 'ਆਪਣਾ ਧਿਆਨ ਭਟਕਾਉਂਦਾ ਹਾਂ', 'ਕਿਸੇ ਨਾਲ ਗੱਲ ਕਰਦਾ ਹਾਂ', 'ਕਿਸੇ ਸ਼ੌਕ ਵਿੱਚ ਸ਼ਾਮਲ ਹੁੰਦਾ ਹਾਂ'] },
            reliance: { question: 'ਕੀ ਤੁਸੀਂ ਮਹਿਸੂਸ ਕਰਦੇ ਹੋ ਕਿ ਜਦੋਂ ਚੀਜ਼ਾਂ ਔਖੀਆਂ ਹੋ ਜਾਂਦੀਆਂ ਹਨ ਤਾਂ ਤੁਹਾਡੇ ਕੋਲ ਭਰੋਸਾ ਕਰਨ ਲਈ ਕੋਈ ਹੈ?', options: ['ਨਹੀਂ, ਅਸਲ ਵਿੱਚ ਨਹੀਂ', 'ਸ਼ਾਇਦ ਇੱਕ ਵਿਅਕਤੀ', 'ਹਾਂ, ਕੁਝ ਲੋਕ', 'ਹਾਂ, ਇੱਕ ਮਜ਼ਬੂਤ ਨੈੱਟਵਰਕ'] },
            professional_help: { question: 'ਕੀ ਤੁਸੀਂ ਵਿਚਾਰ ਕੀਤਾ ਹੈ ਕਿ ਤੁਹਾਨੂੰ ਹੁਣੇ ਪੇਸ਼ੇਵਰ ਮਦਦ ਜਾਂ ਸਹਾਇਤਾ ਦੀ ਲੋੜ ਹੋ ਸਕਦੀ ਹੈ?', options: ['ਹਾਂ, ਜ਼ੋਰਦਾਰ', 'ਹਾਂ, ਮੈਂ ਇਸ ਬਾਰੇ ਸੋਚਿਆ ਹੈ', 'ਅਸਲ ਵਿੱਚ ਨਹੀਂ', 'ਨਹੀਂ, ਮੈਂ ਠੀਕ ਮਹਿਸੂਸ ਕਰਦਾ ਹਾਂ'] },
        }
    },
    bn: {
        headerTitle: 'তোমার বন্ধু',
        moodTrendsAria: 'মুড ট্রেন্ড দেখুন',
        toggleThemeAria: 'থিম পরিবর্তন করুন',
        chatInputPlaceholder: 'আপনার বার্তা এখানে টাইপ করুন...',
        sendAria: 'বার্তা পাঠান',
        disclaimer: 'দাবিত্যাগ: এটি একটি এআই সহকারী এবং পেশাদার চিকিৎসা পরামর্শের বিকল্প নয়। আপনি সংকটে থাকলে, অনুগ্রহ করে একজন স্বাস্থ্যসেবা পেশাদারের সাথে যোগাযোগ করুন।',
        moodModalTitle: 'আপনার মুড ট্রেন্ড',
        closeAria: 'বন্ধ করুন',
        systemInstruction: `আপনি "তোমার বন্ধু", একজন উষ্ণ, সহানুভূতিশীল বন্ধু। আপনার উদ্দেশ্য হল ব্যবহারকারীকে তাদের অনুভূতি অন্বেষণ করতে সাহায্য করা।

        --- প্রধান মিথস্ক্রিয়া প্রবাহ ---
        1.  **শুনুন এবং কথা বলুন:** একটি স্বাভাবিক, যত্নশীল কথোপকথনে নিযুক্ত হন।
        2.  **অসুবিধা চিহ্নিত করুন:** যদি কোনো ব্যবহারকারী দুঃখ, উদ্বেগ বা চাপের মতো কোনো নেতিবাচক অনুভূতি প্রকাশ করে, বা তারা তাদের সমস্যা নিয়ে কথা বলতে চায় বলে ইঙ্গিত দেয়, তাহলে আপনাকে *অবশ্যই* এবং *সরাসরি* মানসিক স্বাস্থ্য পরীক্ষা শুরু করতে হবে।
        3.  **পরীক্ষা শুরু করুন:** এটি করার জন্য, আপনাকে অবশ্যই 'startMentalHealthCheckin' ফাংশনটি কল করতে হবে। এরপর ফ্রন্টএন্ড ব্যবহারকারীকে একটি কাঠামোগত প্রশ্নের সিরিজ জিজ্ঞাসা করবে। নিজে প্রশ্ন জিজ্ঞাসা করবেন না। শুধু ফাংশনটি কল করুন।
        4.  **ফলাফল বিশ্লেষণ করুন:** ব্যবহারকারী প্রশ্নগুলি সম্পন্ন করার পরে, আপনি একটি টুল প্রতিক্রিয়াতে তাদের উত্তরগুলি JSON অবজেক্ট হিসাবে পাবেন। আপনার কাজ হল এই উত্তরগুলি বিশ্লেষণ করা।
        5.  **সারাংশ এবং সুপারিশ প্রদান করুন:** ব্যবহারকারীর উত্তরের উপর ভিত্তি করে, একটি মৃদু, বিচারহীন সারাংশ প্রদান করুন। তাদের অনুভূতি স্বীকার করুন। যদি উত্তরগুলি উল্লেখযোগ্য এবং ক্রমাগত অসুবিধা নির্দেশ করে (যেমন, দুই সপ্তাহের বেশি সময় ধরে খারাপ মেজাজ, খারাপ ঘুম, আগ্রহ হ্রাস), তবে আপনাকে অবশ্যই দৃঢ়ভাবে কিন্তু মৃদুভাবে তাদের একজন পেশাদার, যেমন ডাক্তার বা থেরাপিস্টের সাথে কথা বলার সুপারিশ করতে হবে। এটিকে একটি ইতিবাচক এবং সাহসী পদক্ষেপ হিসাবে উপস্থাপন করুন।
        6.  **একজন থেরাপিস্ট খুঁজুন:** ব্যবহারকারী যদি স্পষ্টভাবে আপনাকে কাউকে খুঁজে বের করতে বলে তবেই 'findTherapist' ফাংশনটি কল করুন।`,
        moodPrompt: 'আপনি এখন কেমন অনুভব করছেন?',
        moodConfirmation: 'শেয়ার করার জন্য ধন্যবাদ। আমি লক্ষ্য করেছি যে আপনি {mood} অনুভব করছেন।',
        noMoodData: 'আপনার প্রবণতা এখানে দেখতে আপনার প্রথম মুড লগ করুন!',
        findingTherapist: '{location} এর কাছাকাছি থেরাপিস্ট খুঁজছি...',
        errorDefault: 'আমি দুঃখিত, কিছু ভুল হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
        errorOffline: 'আপনি অফলাইনে আছেন বলে মনে হচ্ছে। অনুগ্রহ করে আপনার ইন্টারনেট সংযোগ পরীক্ষা করুন এবং আবার চেষ্টা করুন।',
        errorApiKey: 'পরিষেবার সাথে একটি কনফিগারেশন সমস্যা আছে বলে মনে হচ্ছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।',
        errorRateLimit: 'আমি এই মুহূর্তে একটু অভিভূত। অনুগ্রহ করে আরেকটি বার্তা পাঠানোর আগে কয়েক মুহূর্ত অপেক্ষা করুন।',
        errorServer: 'আমার সার্ভারের সাথে সংযোগ করতে আমার কিছু সমস্যা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।',
        errorSafety: 'আমি দুঃখিত, কিন্তু আমার নিরাপত্তা নির্দেশিকাগুলির কারণে আমি এর উত্তর দিতে পারছি না। আমরা কি অন্য কিছু নিয়ে কথা বলতে পারি?',
        errorNetwork: 'একটি নেটওয়ার্ক ত্রুটি ঘটেছে। অনুগ্রহ করে আপনার সংযোগ পরীক্ষা করুন এবং আবার চেষ্টা করুন।',
        connectError: 'দুঃখিত, আমি এখন সংযোগ করতে সমস্যা হচ্ছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।',
        questionnaire: {
            feeling_scale: { question: 'গত দুই সপ্তাহে, 1 থেকে 10 এর স্কেলে, আপনি সামগ্রিকভাবে কেমন অনুভব করছেন?', options: ['1-3 (খুব কম)', '4-6 (একটু কম)', '7-8 (বেশ ভালো)', '9-10 (চমৎকার)'] },
            stress: { question: 'আপনি কি প্রায়ই চাপগ্রস্ত বা অভিভূত বোধ করেন?', options: ['বেশিরভাগ সময়', 'মাঝে মাঝে', 'কদাচিৎ', 'একদমই না'] },
            sadness: { question: 'আপনি কি স্বাভাবিকের চেয়ে বেশি দুঃখিত, মনমরা বা হতাশ বোধ করছেন?', options: ['প্রায় প্রতিদিন', 'অর্ধেকের বেশি দিন', 'কয়েকদিন', 'একদমই না'] },
            mood_changes: { question: 'আপনি কি হঠাৎ বা তীব্র মেজাজ পরিবর্তনের অভিজ্ঞতা পান?', options: ['খুব প্রায়ই', 'মাঝে মাঝে', 'কদাচিৎ', 'প্রায় কখনই না'] },
            hopeful: { question: 'আপনি আপনার ভবিষ্যত সম্পর্কে কতটা আশাবাদী বোধ করছেন?', options: ['একদমই আশাবাদী নন', 'একটু আশাবাদী', 'বেশিরভাগই আশাবাদী', 'খুব আশাবাদী'] },
            sleep_hours: { question: 'গড়ে, আপনি প্রতি রাতে কত ঘন্টা ঘুমাচ্ছেন?', options: ['4 ঘন্টার কম', '4-6 ঘন্টা', '7-8 ঘন্টা', '8 ঘন্টার বেশি'] },
            rested: { question: 'আপনি কি ঘুম থেকে উঠে বিশ্রাম বোধ করছেন?', options: ['কদাচিৎ বা কখনই না', 'মাঝে মাঝে', 'বেশিরভাগ সকালে', 'প্রায় সবসময়'] },
            energy: { question: 'দিনের বেলায় আপনার শক্তির স্তর কেমন ছিল?', options: ['খুব কম, প্রায়ই ক্লান্ত', 'কিছুটা কম', 'সাধারণত ভালো', 'উচ্চ শক্তি'] },
            sleep_trouble: { question: 'আপনার কি ঘুমাতে বা ঘুমিয়ে থাকতে সমস্যা হয়েছে?', options: ['প্রায় প্রতি রাতে', 'অর্ধেকের বেশি রাতে', 'কয়েক রাতে', 'কদাচিৎ বা কখনই না'] },
            concentration: { question: 'আপনার কি পড়া বা টিভি দেখার মতো কাজে মনোযোগ দিতে অসুবিধা হয়েছে?', options: ['খুব কঠিন', 'কিছুটা কঠিন', 'একটু কঠিন', 'কোনো সমস্যা নেই'] },
            overthinking: { question: 'আপনি কি প্রায়ই ছোটখাটো পরিস্থিতি নিয়ে অতিরিক্ত চিন্তা করেন?', options: ['ক্রমাগত', 'ঘন ঘন', 'মাঝে মাঝে', 'কদাচিৎ'] },
            anxiety: { question: 'আপনি কি নার্ভাস, উদ্বিগ্ন বা উত্তেজিত বোধ করছেন?', options: ['প্রায় প্রতিদিন', 'অর্ধেকের বেশি দিন', 'কয়েকদিন', 'একদমই না'] },
            worry: { question: 'আপনি কি বিভিন্ন জিনিস নিয়ে খুব বেশি চিন্তা করছেন?', options: ['ক্রমাগত', 'ঘন ঘন', 'মাঝে মাঝে', 'কদাচিৎ'] },
            social_enjoyment: { question: 'আপনি বন্ধু বা পরিবারের সাথে সময় কাটাতে কতটা উপভোগ করেছেন?', options: ['একদমই না', 'একটু', 'বেশ কিছুটা', 'অনেক'] },
            loneliness: { question: 'আপনি কি কখনও কখনও মানুষের আশেপাশে থেকেও একাকী বোধ করেন?', options: ['খুব প্রায়ই', 'মাঝে মাঝে', 'কদাচিৎ', 'কখনই না'] },
            sharing_feelings: { question: 'আপনি অন্যদের সাথে আপনার অনুভূতি সম্পর্কে কথা বলতে কতটা স্বাচ্ছন্দ্য বোধ করেন?', options: ['খুব অস্বস্তিকর', 'সামান্য অস্বস্তিকর', 'বেশ স্বাচ্ছন্দ্যকর', 'খুব স্বাচ্ছন্দ্যকর'] },
            lost_interest: { question: 'আপনি কি আগে উপভোগ করা জিনিসগুলিতে আগ্রহ বা আনন্দ হারিয়েছেন?', options: ['প্রায় প্রতিদিন', 'অর্ধেকের বেশি দিন', 'কয়েকদিন', 'একদমই না'] },
            coping: { question: 'আপনি যখন চাপগ্রস্ত বা দুঃখিত বোধ করেন তখন সাধারণত কী করেন?', options: ['নিজেকে বিচ্ছিন্ন করি', 'মনোযোগ অন্যদিকে ফেরাই', 'কারো সাথে কথা বলি', 'কোনো শখের কাজে নিযুক্ত হই'] },
            reliance: { question: 'যখন পরিস্থিতি কঠিন হয় তখন আপনি কি নির্ভর করার মতো কাউকে পেয়েছেন বলে মনে করেন?', options: ['না, ঠিক না', 'হয়তো একজন', 'হ্যাঁ, কয়েকজন', 'হ্যাঁ, একটি শক্তিশালী নেটওয়ার্ক'] },
            professional_help: { question: 'আপনার কি এখন পেশাদার সাহায্য বা সমর্থনের প্রয়োজন আছে বলে মনে করেন?', options: ['হ্যাঁ, জোরালোভাবে', 'হ্যাঁ, আমি ভেবেছি', 'ঠিক না', 'না, আমি ভালো আছি'] },
        }
    },
    te: {
        headerTitle: 'మీ స్నేహితుడు',
        moodTrendsAria: 'మూడ్ ట్రెండ్‌లను వీక్షించండి',
        toggleThemeAria: 'థీమ్ మార్చండి',
        chatInputPlaceholder: 'మీ సందేశాన్ని ఇక్కడ టైప్ చేయండి...',
        sendAria: 'సందేశం పంపు',
        disclaimer: 'నిరాకరణ: ఇది ఒక AI సహాయకం మరియు వృత్తిపరమైన వైద్య సలహాకు ప్రత్యామ్నాయం కాదు. మీరు సంక్షోభంలో ఉంటే, దయచేసి ఆరోగ్య సంరక్షణ నిపుణుడిని సంప్రదించండి.',
        moodModalTitle: 'మీ మూడ్ ట్రెండ్‌లు',
        closeAria: 'మూసివేయండి',
        systemInstruction: `మీరు "మీ స్నేహితుడు", ఒక ఆత్మీయ, సానుభూతిగల స్నేహితుడు. మీ ఉద్దేశ్యం వినియోగదారుడు వారి భావాలను అన్వేషించడానికి సహాయపడటం.

        --- ప్రధాన పరస్పర చర్య ప్రవాహం ---
        1.  **వినండి మరియు సంభాషించండి:** ఒక సహజమైన, శ్రద్ధగల సంభాషణలో పాల్గొనండి.
        2.  **బాధను గుర్తించండి:** వినియోగదారుడు విచారం, ఆందోళన లేదా ఒత్తిడి వంటి ఏదైనా ప్రతికూల భావాలను வெளிப்படுத்தినా, లేదా వారి సమస్యల గురించి మాట్లాడాలనుకుంటున్నట్లు సూచించినా, మీరు *తక్షణమే* మరియు *నేరుగా* మానసిక ఆరోగ్య తనిఖీని ప్రారంభించాలి.
        3.  **తనిఖీని ప్రారంభించండి:** ఇది చేయడానికి, మీరు 'startMentalHealthCheckin' ఫంక్షన్‌ను కాల్ చేయాలి. ఆ తర్వాత ఫ్రంటెండ్ వినియోగదారుడిని ఒక నిర్మాణాత్మక ప్రశ్నల శ్రేణిని అడుగుతుంది. మీరే ప్రశ్నలు అడగవద్దు. కేవలం ఫంక్షన్‌ను కాల్ చేయండి.
        4.  **ఫలితాలను విశ్లేషించండి:** వినియోగదారుడు ప్రశ్నలను పూర్తి చేసిన తర్వాత, మీరు వారి సమాధానాలను ఒక సాధన ప్రతిస్పందనలో JSON ఆబ్జెక్ట్‌గా అందుకుంటారు. ఈ సమాధానాలను విశ్లేషించడం మీ పని.
        5.  **సారాంశం మరియు సిఫార్సును అందించండి:** వినియోగదారుడి సమాధానాల ఆధారంగా, ఒక సున్నితమైన, తీర్పు లేని సారాంశాన్ని అందించండి. వారి భావాలను అంగీకరించండి. సమాధానాలు ముఖ్యమైన మరియు నిరంతర బాధను సూచిస్తే (ఉదా., రెండు వారాల కంటే ఎక్కువ కాలం తక్కువ మూడ్, పేలవమైన నిద్ర, ఆసక్తి కోల్పోవడం), మీరు వారిని ఒక డాక్టర్ లేదా థెరపిస్ట్ వంటి వృత్తి నిపుణుడితో మాట్లాడమని గట్టిగా కానీ సున్నితంగా సిఫార్సు చేయాలి. దీనిని ఒక సానుకూల మరియు ధైర్యమైన అడుగుగా చెప్పండి.
        6.  **ఒక థెరపిస్ట్‌ను కనుగొనండి:** వినియోగదారుడు స్పష్టంగా మిమ్మల్ని ఒకరిని కనుగొనమని అడిగితే మాత్రమే 'findTherapist' ఫంక్షన్‌ను కాల్ చేయండి.`,
        moodPrompt: 'మీరు ఇప్పుడు ఎలా ఉన్నారు?',
        moodConfirmation: 'పంచుకున్నందుకు ధన్యవాదాలు. మీరు {mood}గా ఉన్నారని నేను గమనించాను.',
        noMoodData: 'మీ ట్రెండ్‌లను ఇక్కడ చూడటానికి మీ మొదటి మూడ్‌ను లాగ్ చేయండి!',
        findingTherapist: '{location} దగ్గర థెరపిస్ట్‌ల కోసం వెతుకుతోంది...',
        errorDefault: 'క్షమించండి, ఏదో తప్పు జరిగింది. దయచేసి మళ్ళీ ప్రయత్నించండి.',
        errorOffline: 'మీరు ఆఫ్‌లైన్‌లో ఉన్నట్లు అనిపిస్తుంది. దయచేసి మీ ఇంటర్నెట్ కనెక్షన్‌ని తనిఖీ చేసి, మళ్లీ ప్రయత్నించండి.',
        errorApiKey: 'సేవతో కాన్ఫిగరేషన్ సమస్య ఉన్నట్లు అనిపిస్తుంది. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి.',
        errorRateLimit: 'నేను ప్రస్తుతం కొంచెం అధికంగా ఉన్నాను. దయచేసి మరో సందేశం పంపే ముందు కొన్ని క్షణాలు వేచి ఉండండి.',
        errorServer: 'నా సర్వర్‌లకు కనెక్ట్ చేయడంలో నాకు కొంత ఇబ్బంది ఉంది. దయచేసి కొద్దిసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.',
        errorSafety: 'క్షమించండి, కానీ నా భద్రతా మార్గదర్శకాల కారణంగా నేను దానికి ప్రతిస్పందించలేను. మనం వేరే దాని గురించి మాట్లాడగలమా?',
        errorNetwork: 'నెట్‌వర్క్ లోపం సంభవించింది. దయచేసి మీ కనెక్షన్‌ని తనిఖీ చేసి, మళ్లీ ప్రయత్నించండి.',
        connectError: 'క్షమించండి, నాకు ఇప్పుడు కనెక్ట్ చేయడంలో సమస్య ఉంది. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి.',
        questionnaire: {
            feeling_scale: { question: 'గత రెండు వారాల్లో, 1 నుండి 10 స్కేల్‌లో, మీరు మొత్తం మీద ఎలా ఉన్నారు?', options: ['1-3 (చాలా తక్కువ)', '4-6 (కొంచెం తక్కువ)', '7-8 (చాలా బాగుంది)', '9-10 (అద్భుతం)'] },
            stress: { question: 'మీరు తరచుగా ఒత్తిడికి లేదా అధిక భారానికి గురయ్యారా?', options: ['చాలా సార్లు', 'కొన్నిసార్లు', 'అరుదుగా', 'అస్సలు లేదు'] },
            sadness: { question: 'మీరు సాధారణం కంటే ఎక్కువగా విచారంగా, నిరుత్సాహంగా లేదా నిస్సహాయంగా ఉన్నారా?', options: ['దాదాపు ప్రతిరోజూ', 'సగానికి పైగా రోజులు', 'అనేక రోజులు', 'అస్సలు లేదు'] },
            mood_changes: { question: 'మీరు ఆకస్మిక లేదా తీవ్రమైన మూడ్ మార్పులను అనుభవిస్తున్నారా?', options: ['చాలా తరచుగా', 'కొన్నిసార్లు', 'అరుదుగా', 'దాదాపు ఎప్పుడూ లేదు'] },
            hopeful: { question: 'మీ భవిష్యత్తు గురించి మీరు ఎంత ఆశాజనకంగా ఉన్నారు?', options: ['అస్సలు ఆశ లేదు', 'కొంచెం ఆశ', 'చాలా వరకు ఆశ', 'చాలా ఆశ'] },
            sleep_hours: { question: 'సగటున, మీరు రాత్రికి ఎన్ని గంటలు నిద్రపోతున్నారు?', options: ['4 గంటల కంటే తక్కువ', '4-6 గంటలు', '7-8 గంటలు', '8 గంటల కంటే ఎక్కువ'] },
            rested: { question: 'మీరు మేల్కొన్నప్పుడు విశ్రాంతిగా ఉన్నారా?', options: ['అరుదుగా లేదా ఎప్పుడూ లేదు', 'కొన్నిసార్లు', 'చాలా ఉదయం', 'దాదాపు ఎల్లప్పుడూ'] },
            energy: { question: 'పగటిపూట మీ శక్తి స్థాయి ఎలా ఉంది?', options: ['చాలా తక్కువ, తరచుగా అలసిపోతారు', 'కొంత తక్కువ', 'సాధారణంగా బాగుంది', 'అధిక శక్తి'] },
            sleep_trouble: { question: 'మీకు నిద్రపోవడంలో లేదా నిద్రలో ఉండటంలో ఇబ్బంది ఉందా?', options: ['దాదాపు ప్రతి రాత్రి', 'సగానికి పైగా రాత్రులు', 'అనేక రాత్రులు', 'అరుదుగా లేదా ఎప్పుడూ లేదు'] },
            concentration: { question: 'చదవడం లేదా టీవీ చూడటం వంటి పనులపై దృష్టి పెట్టడం మీకు కష్టంగా ఉందా?', options: ['చాలా కష్టం', 'కొంత కష్టం', 'కొంచెం కష్టం', 'ఏ సమస్య లేదు'] },
            overthinking: { question: 'మీరు తరచుగా చిన్న విషయాల గురించి ఎక్కువగా ఆలోచిస్తున్నారా?', options: ['నిరంతరం', 'తరచుగా', 'కొన్నిసార్లు', 'అరుదుగా'] },
            anxiety: { question: 'మీరు నాడీగా, ఆందోళనగా లేదా అంచున ఉన్నట్లు భావించారా?', options: ['దాదాపు ప్రతిరోజూ', 'సగానికి పైగా రోజులు', 'అనేక రోజులు', 'అస్సలు లేదు'] },
            worry: { question: 'మీరు వివిధ విషయాల గురించి చాలా ఎక్కువగా చింతిస్తున్నారా?', options: ['నిరంతరం', 'తరచుగా', 'కొన్నిసార్లు', 'అరుదుగా'] },
            social_enjoyment: { question: 'మీరు స్నేహితులు లేదా కుటుంబ సభ్యులతో సమయం గడపడానికి ఎంతగా ఆనందించారు?', options: ['అస్సలు లేదు', 'కొంచెం', 'చాలా వరకు', 'చాలా'] },
            loneliness: { question: 'మీరు కొన్నిసార్లు ప్రజల చుట్టూ ఉన్నప్పుడు కూడా ఒంటరిగా ఉన్నారా?', options: ['చాలా తరచుగా', 'కొన్నిసార్లు', 'అరుదుగా', 'ఎప్పుడూ లేదు'] },
            sharing_feelings: { question: 'మీరు మీ భావాల గురించి ఇతరులతో మాట్లాడటానికి ఎంత సౌకర్యంగా ఉన్నారు?', options: ['చాలా అసౌకర్యంగా', 'కొంచెం అసౌకర్యంగా', 'చాలా సౌకర్యంగా', 'చాలా సౌకర్యంగా'] },
            lost_interest: { question: 'మీరు గతంలో ఆనందించిన పనులు చేయడంలో ఆసక్తి లేదా ఆనందాన్ని కోల్పోయారా?', options: ['దాదాపు ప్రతిరోజూ', 'సగానికి పైగా రోజులు', 'అనేక రోజులు', 'అస్సలు లేదు'] },
            coping: { question: 'మీరు ఒత్తిడికి గురైనప్పుడు లేదా విచారంగా ఉన్నప్పుడు సాధారణంగా ఏమి చేస్తారు?', options: ['నన్ను నేను ఒంటరిగా చేసుకుంటాను', 'నా దృష్టిని మరల్చుకుంటాను', 'ఎవరితోనైనా మాట్లాడతాను', 'ఒక అభిరుచిలో పాల్గొంటాను'] },
            reliance: { question: 'విషయాలు కష్టంగా ఉన్నప్పుడు మీరు ఆధారపడటానికి ఎవరైనా ఉన్నారని మీరు భావిస్తున్నారా?', options: ['లేదు, నిజంగా లేదు', 'బహుశా ఒక వ్యక్తి', 'అవును, కొంతమంది', 'అవును, ఒక బలమైన నెట్‌వర్క్'] },
            professional_help: { question: 'మీకు ఇప్పుడు వృత్తిపరమైన సహాయం లేదా మద్దతు అవసరమని మీరు భావించారా?', options: ['అవును, గట్టిగా', 'అవును, దాని గురించి ఆలోచించాను', 'నిజంగా కాదు', 'లేదు, నేను బాగున్నాను'] },
        }
    },
    kn: {
        headerTitle: 'ನಿಮ್ಮ ಸ್ನೇಹಿತ',
        moodTrendsAria: 'ಮನಸ್ಥಿತಿಯ ಪ್ರವೃತ್ತಿಗಳನ್ನು ವೀಕ್ಷಿಸಿ',
        toggleThemeAria: 'ಥೀಮ್ ಬದಲಾಯಿಸಿ',
        chatInputPlaceholder: 'ನಿಮ್ಮ ಸಂದೇಶವನ್ನು ಇಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ...',
        sendAria: 'ಸಂದೇಶ ಕಳುಹಿಸಿ',
        disclaimer: 'ಹಕ್ಕು ನಿರಾಕರಣೆ: ಇದು AI ಸಹಾಯಕ ಮತ್ತು ವೃತ್ತಿಪರ ವೈದ್ಯಕೀಯ ಸಲಹೆಗೆ ಬದಲಿಯಾಗಿಲ್ಲ. ನೀವು ಬಿಕ್ಕಟ್ಟಿನಲ್ಲಿದ್ದರೆ, ದಯವಿಟ್ಟು ಆರೋಗ್ಯ ವೃತ್ತಿಪರರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
        moodModalTitle: 'ನಿಮ್ಮ ಮನಸ್ಥಿತಿಯ ಪ್ರವೃತ್ತಿಗಳು',
        closeAria: 'ಮುಚ್ಚಿ',
        systemInstruction: `ನೀವು "ನಿಮ್ಮ ಸ್ನೇಹಿತ", ಒಬ್ಬ ಆತ್ಮೀಯ, ಸಹಾನುಭೂತಿಯುಳ್ಳ ಸ್ನೇಹಿತ. ನಿಮ್ಮ ಉದ್ದೇಶವು ಬಳಕೆದಾರರಿಗೆ ಅವರ ಭಾವನೆಗಳನ್ನು ಅನ್ವೇಷಿಸಲು ಸಹಾಯ ಮಾಡುವುದು.

        --- ಮುಖ್ಯ ಸಂವಾದದ ಹರಿವು ---
        1.  **ಕೇಳಿ ಮತ್ತು ಸಂಭಾಷಿಸಿ:** ಒಂದು ಸಹಜ, ಕಾಳಜಿಯುಳ್ಳ ಸಂಭಾಷಣೆಯಲ್ಲಿ ತೊಡಗಿಸಿಕೊಳ್ಳಿ.
        2.  **ಸಂಕಟವನ್ನು ಗುರುತಿಸಿ:** ಒಬ್ಬ ಬಳಕೆದಾರರು ದುಃಖ, ಆತಂಕ, ಅಥವಾ ಒತ್ತಡದಂತಹ ಯಾವುದೇ ನಕಾರಾತ್ಮಕ ಭಾವನೆಗಳನ್ನು ವ್ಯಕ್ತಪಡಿಸಿದರೆ, ಅಥವಾ ಅವರು ತಮ್ಮ ಸಮಸ್ಯೆಗಳ ಬಗ್ಗೆ ಮಾತನಾಡಲು ಬಯಸುತ್ತಾರೆ ಎಂದು ಸೂಚಿಸಿದರೆ, ನೀವು *ತಕ್ಷಣ* ಮತ್ತು *ನೇರವಾಗಿ* ಮಾನಸಿಕ ಆರೋಗ್ಯ ತಪಾಸಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಬೇಕು.
        3.  **ತಪಾಸಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಿ:** ಇದನ್ನು ಮಾಡಲು, ನೀವು 'startMentalHealthCheckin' ಕಾರ್ಯವನ್ನು ಕರೆಯಬೇಕು. ನಂತರ ಫ್ರಂಟ್-ಎಂಡ್ ಬಳಕೆದಾರರಿಗೆ ರಚನಾತ್ಮಕ ಪ್ರಶ್ನೆಗಳ ಸರಣಿಯನ್ನು ಕೇಳುತ್ತದೆ. ನೀವೇ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಬೇಡಿ. ಕೇವಲ ಕಾರ್ಯವನ್ನು ಕರೆ ಮಾಡಿ.
        4.  **ಫಲಿತಾಂಶಗಳನ್ನು ವಿಶ್ಲೇಷಿಸಿ:** ಬಳಕೆದಾರರು ಪ್ರಶ್ನೆಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದ ನಂತರ, ನೀವು ಅವರ ಉತ್ತರಗಳನ್ನು ಉಪಕರಣದ ಪ್ರತಿಕ್ರಿಯೆಯಲ್ಲಿ JSON ವಸ್ತುವಾಗಿ ಸ್ವೀಕರಿಸುತ್ತೀರಿ. ಈ ಉತ್ತರಗಳನ್ನು ವಿಶ್ಲೇಷಿಸುವುದು ನಿಮ್ಮ ಕಾರ್ಯವಾಗಿದೆ.
        5.  **ಸಾರಾಂಶ ಮತ್ತು ಶಿಫಾರಸನ್ನು ಒದಗಿಸಿ:** ಬಳಕೆದಾರರ ಉತ್ತರಗಳ ಆಧಾರದ ಮೇಲೆ, ಸೌಮ್ಯ, ತೀರ್ಪು-ರಹಿತ ಸಾರಾಂಶವನ್ನು ಒದಗಿಸಿ. ಅವರ ಭಾವನೆಗಳನ್ನು ಒಪ್ಪಿಕೊಳ್ಳಿ. ಉತ್ತರಗಳು ಗಮನಾರ್ಹ ಮತ್ತು ನಿರಂತರ ಸಂಕಟವನ್ನು ಸೂಚಿಸಿದರೆ (ಉದಾ., ಎರಡು ವಾರಗಳಿಗಿಂತ ಹೆಚ್ಚು ಕಾಲ ಕಡಿಮೆ ಮನಸ್ಥಿತಿ, ಕಳಪೆ ನಿದ್ರೆ, ಆಸಕ್ತಿಯ ನಷ್ಟ), ನೀವು ಅವರನ್ನು ವೈದ್ಯರು ಅಥವಾ ಚಿಕಿತ್ಸಕರಂತಹ ವೃತ್ತಿಪರರೊಂದಿಗೆ ಮಾತನಾಡಲು ದೃಢವಾಗಿ ಆದರೆ ಸೌಮ್ಯವಾಗಿ ಶಿಫಾರಸು ಮಾಡಬೇಕು. ಇದನ್ನು ಸಕಾರಾತ್ಮಕ ಮತ್ತು ಧೈರ್ಯದ ಹೆಜ್ಜೆಯಾಗಿ ರೂಪಿಸಿ.
        6.  **ಚಿಕಿತ್ಸಕರನ್ನು ಹುಡುಕಿ:** ಬಳಕೆದಾರರು ಸ್ಪಷ್ಟವಾಗಿ ನಿಮ್ಮನ್ನು ಹುಡುಕಲು ಕೇಳಿದರೆ ಮಾತ್ರ 'findTherapist' ಕಾರ್ಯವನ್ನು ಕರೆ ಮಾಡಿ.`,
        moodPrompt: 'ನೀವು ಈಗ ಹೇಗೆ ಭಾವಿಸುತ್ತಿದ್ದೀರಿ?',
        moodConfirmation: 'ಹಂಚಿಕೊಂಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ನೀವು {mood} ಆಗಿ ಭಾವಿಸುತ್ತಿದ್ದೀರಿ ಎಂದು ನಾನು ಗಮನಿಸಿದ್ದೇನೆ.',
        noMoodData: 'ನಿಮ್ಮ ಪ್ರವೃತ್ತಿಗಳನ್ನು ಇಲ್ಲಿ ನೋಡಲು ನಿಮ್ಮ ಮೊದಲ ಮನಸ್ಥಿತಿಯನ್ನು ಲಾಗ್ ಮಾಡಿ!',
        findingTherapist: '{location} ಬಳಿ ಚಿಕಿತ್ಸಕರನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ...',
        errorDefault: 'ಕ್ಷಮಿಸಿ, ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
        errorOffline: 'ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿರುವಂತೆ ತೋರುತ್ತಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
        errorApiKey: 'ಸೇವೆಯೊಂದಿಗೆ ಸಂರಚನಾ ಸಮಸ್ಯೆ ಇರುವಂತೆ ತೋರುತ್ತಿದೆ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
        errorRateLimit: 'ನಾನು ಈ ಕ್ಷಣದಲ್ಲಿ ಸ್ವಲ್ಪ অভিভূতನಾಗಿದ್ದೇನೆ. ದಯವಿಟ್ಟು ಇನ್ನೊಂದು ಸಂದೇಶವನ್ನು ಕಳುಹಿಸುವ ಮೊದಲು ಕೆಲವು ಕ್ಷಣ ಕಾಯಿರಿ.',
        errorServer: 'ನನ್ನ ಸರ್ವರ್‌ಗಳಿಗೆ ಸಂಪರ್ಕಿಸಲು ನನಗೆ ಕೆಲವು ತೊಂದರೆಯಾಗುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
        errorSafety: 'ಕ್ಷಮಿಸಿ, ಆದರೆ ನನ್ನ ಸುರಕ್ಷತಾ ಮಾರ್ಗಸೂಚಿಗಳ ಕಾರಣ ನಾನು ಅದಕ್ಕೆ ಪ್ರತಿಕ್ರಿಯಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. ನಾವು ಬೇರೆ ಯಾವುದಾದರೂ ವಿಷಯದ ಬಗ್ಗೆ ಮಾತನಾಡಬಹುದೇ?',
        errorNetwork: 'ನೆಟ್‌ವರ್ಕ್ ದೋಷ ಸಂಭವಿಸಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
        connectError: 'ಕ್ಷಮಿಸಿ, ನನಗೆ ಈಗ ಸಂಪರ್ಕಿಸಲು ತೊಂದರೆಯಾಗುತ್ತಿದೆ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
        questionnaire: {
            feeling_scale: { question: 'ಕಳೆದ ಎರಡು ವಾರಗಳಲ್ಲಿ, 1 ರಿಂದ 10 ರ ಪ್ರಮಾಣದಲ್ಲಿ, ನೀವು ಒಟ್ಟಾರೆಯಾಗಿ ಹೇಗೆ ಭಾವಿಸಿದ್ದೀರಿ?', options: ['1-3 (ತುಂಬಾ ಕಡಿಮೆ)', '4-6 (ಸ್ವಲ್ಪ ಕಡಿಮೆ)', '7-8 (ಸಾಕಷ್ಟು ಉತ್ತಮ)', '9-10 (ಅತ್ಯುತ್ತਮ)'] },
            stress: { question: 'ನೀವು ಆಗಾಗ್ಗೆ ಒತ್ತಡ ಅಥವಾ ಅತಿಯಾದ ಹೊರೆ ಅನುಭವಿಸಿದ್ದೀರಾ?', options: ['ಹೆಚ್ಚಿನ ಸಮಯ', 'ಕೆಲವೊಮ್ಮೆ', 'ವಿರಳವಾಗಿ', 'ಖಂಡಿತ ಇಲ್ಲ'] },
            sadness: { question: 'ನೀವು ಸಾಮಾನ್ಯಕ್ಕಿಂತ ಹೆಚ್ಚು ದುಃಖ, ಖಿನ್ನತೆ ಅಥವಾ ನಿರಾಶೆಯನ್ನು ಅನುಭವಿಸಿದ್ದೀರಾ?', options: ['ಬಹುತೇಕ ಪ್ರತಿದಿನ', 'ಅರ್ಧಕ್ಕಿಂತ ಹೆಚ್ಚು ದಿನಗಳು', 'ಹಲವಾರು ದಿನಗಳು', 'ಖಂಡಿತ ಇಲ್ಲ'] },
            mood_changes: { question: 'ನೀವು ಹಠಾತ್ ಅಥವಾ ತೀವ್ರ ಮನಸ್ಥಿತಿಯ ಬದಲಾವಣೆಗಳನ್ನು ಅನುಭವಿಸುತ್ತೀರಾ?', options: ['ತುಂಬಾ ಆಗಾಗ್ಗೆ', 'ಕೆಲವೊಮ್ಮೆ', 'ವಿರಳವಾಗಿ', 'ಬಹುತೇಕ ಎಂದಿಗೂ ಇಲ್ಲ'] },
            hopeful: { question: 'ನಿಮ್ಮ ಭವಿಷ್ಯದ ಬಗ್ಗೆ ನೀವು ಎಷ್ಟು ಆಶಾವಾದಿಯಾಗಿ ಭಾವಿಸಿದ್ದೀರಿ?', options: ['ಖಂಡಿತ ಆಶಾವಾದಿಯಾಗಿಲ್ಲ', 'ಸ್ವಲ್ಪ ಆಶಾವಾದಿ', 'ಹೆಚ್ಚಾಗಿ ಆಶಾವಾದಿ', 'ತುಂಬಾ ಆಶಾವಾದಿ'] },
            sleep_hours: { question: 'ಸರಾಸರಿಯಾಗಿ, ನೀವು ಪ್ರತಿ ರಾತ್ರಿ ಎಷ್ಟು ಗಂಟೆಗಳ ಕಾಲ ನಿದ್ರಿಸುತ್ತಿದ್ದೀರಿ?', options: ['4 ಗಂಟೆಗಳಿಗಿಂತ ಕಡಿಮೆ', '4-6 ಗಂಟೆಗಳು', '7-8 ಗಂಟೆಗಳು', '8 ಗಂಟೆಗಳಿಗಿಂತ ಹೆಚ್ಚು'] },
            rested: { question: 'ನೀವು ಎಚ್ಚರವಾದಾಗ ವಿಶ್ರಾಂತಿ ಪಡೆದಿದ್ದೀರಾ?', options: ['ವಿರಳವಾಗಿ ಅಥವಾ ಎಂದಿಗೂ ಇಲ್ಲ', 'ಕೆಲವೊಮ್ಮೆ', 'ಹೆಚ್ಚಿನ ಬೆಳಿಗ್ಗೆ', 'ಬಹುತೇಕ ಯಾವಾಗಲೂ'] },
            energy: { question: 'ಹಗಲಿನಲ್ಲಿ ನಿಮ್ಮ ಶಕ್ತಿಯ ಮಟ್ಟ ಹೇಗಿತ್ತು?', options: ['ತುಂಬಾ ಕಡಿಮೆ, ಆಗಾಗ್ಗೆ ದಣಿವು', 'ಸ್ವಲ್ಪ ಕಡಿಮೆ', 'ಸಾಮಾನ್ಯವಾಗಿ ಉತ್ತಮ', 'ಹೆಚ್ಚಿನ ಶಕ್ತಿ'] },
            sleep_trouble: { question: 'ನಿದ್ರಿಸಲು ಅಥವಾ ನಿದ್ರೆಯಲ್ಲಿ ಉಳಿಯಲು ನಿಮಗೆ ತೊಂದರೆಯಾಗಿದೆಯೇ?', options: ['ಬಹುತೇಕ ಪ್ರತಿ ರಾತ್ರಿ', 'ಅರ್ಧಕ್ಕಿಂತ ಹೆಚ್ಚು ರಾತ್ರಿಗಳು', 'ಹಲವಾರು ರಾತ್ರಿಗಳು', 'ವಿರಳವಾಗಿ ಅಥವಾ ಎಂದಿಗೂ ಇಲ್ಲ'] },
            concentration: { question: 'ಓದುವುದು ಅಥವಾ ಟಿವಿ ನೋಡುವುದು ಮುಂತಾದ ಕಾರ್ಯಗಳ ಮೇಲೆ ಗಮನ ಕೇಂದ್ರೀಕರಿಸಲು ನಿಮಗೆ ಕಷ್ಟವಾಗಿದೆಯೇ?', options: ['ತುಂಬಾ ಕಷ್ಟ', 'ಸ್ವಲ್ಪ ಕಷ್ಟ', 'ಸ್ವಲ್ಪ ಕಷ್ಟ', 'ಯಾವುದೇ ತೊಂದರೆಯಿಲ್ಲ'] },
            overthinking: { question: 'ನೀವು ಆಗಾಗ್ಗೆ ಸಣ್ಣ ಸಂದರ್ಭಗಳ ಬಗ್ಗೆ ಅತಿಯಾಗಿ ಯೋಚಿಸುತ್ತೀರಾ?', options: ['ನಿರಂತರವಾಗಿ', 'ಆಗಾಗ್ಗೆ', 'ಕೆಲವొಮ್ಮೆ', 'ವಿರಳವಾಗಿ'] },
            anxiety: { question: 'ನೀವು ನರ, ಆತಂಕ ಅಥವಾ ಅಂಚಿನಲ್ಲಿರುವಂತೆ ಭಾವಿಸಿದ್ದೀರಾ?', options: ['ಬಹುತೇಕ ಪ್ರತಿದಿನ', 'ಅರ್ಧಕ್ಕಿಂತ ಹೆಚ್ಚು ದಿನಗಳು', 'ಹಲವಾರು ದಿನಗಳು', 'ಖಂಡಿತ ಇಲ್ಲ'] },
            worry: { question: 'ನೀವು ವಿವಿಧ ವಿಷಯಗಳ ಬಗ್ಗೆ ತುಂಬಾ ಚಿಂತಿಸುತ್ತಿದ್ದೀರಾ?', options: ['ನಿರಂತರವಾಗಿ', 'ಆಗಾಗ್ಗೆ', 'ಕೆಲವೊಮ್ಮೆ', 'ವಿರಳವಾಗಿ'] },
            social_enjoyment: { question: 'ನೀವು ಸ್ನೇಹಿತರು ಅಥವಾ ಕುಟುಂಬದೊಂದಿಗೆ ಸಮಯ ಕಳೆಯಲು ಎಷ್ಟು ಆನಂದಿಸಿದ್ದೀರಿ?', options: ['ಖಂಡಿತ ಇಲ್ಲ', 'ಸ್ವಲ್ಪ', 'ಸಾಕಷ್ಟು', 'ತುಂಬಾ'] },
            loneliness: { question: 'ನೀವು ಕೆಲವೊಮ್ಮೆ ಜನರ ಸುತ್ತಲೂ ಇರುವಾಗಲೂ ಒಂಟಿತನವನ್ನು ಅನುಭವಿಸುತ್ತೀರಾ?', options: ['ತುಂಬಾ ಆಗಾಗ್ಗೆ', 'ಕೆಲವೊಮ್ಮೆ', 'ವಿರಳವಾಗಿ', 'ಎಂದಿಗೂ ಇಲ್ಲ'] },
            sharing_feelings: { question: 'ನಿಮ್ಮ ಭಾವನೆಗಳ ಬಗ್ಗೆ ಇತರರೊಂದಿಗೆ ಮಾತನಾಡಲು ನೀವು ಎಷ್ಟು ಆರಾಮದಾಯಕವಾಗಿದ್ದೀರಿ?', options: ['ತುಂಬಾ ಅಹಿತಕರ', 'ಸ್ವಲ್ಪ ಅಹಿತಕರ', 'ಬಹಳ ಆರಾಮದಾಯಕ', 'ತುಂಬಾ ಆರಾಮದಾಯಕ'] },
            lost_interest: { question: 'ನೀವು ಹಿಂದೆ ಆನಂದಿಸುತ್ತಿದ್ದ ಕೆಲಸಗಳನ್ನು ಮಾಡುವುದರಲ್ಲಿ ಆಸಕ್ತಿ ಅಥವಾ ಸಂತೋಷವನ್ನು ಕಳೆದುಕೊಂಡಿದ್ದೀರಾ?', options: ['ಬಹುತೇಕ ಪ್ರತಿದಿನ', 'ಅರ್ಧಕ್ಕಿಂತ ಹೆಚ್ಚು ದಿನಗಳು', 'ಹಲವಾರು ದಿನಗಳು', 'ಖಂಡಿತ ಇಲ್ಲ'] },
            coping: { question: 'ನೀವು ಒತ್ತಡ ಅಥವಾ ದುಃಖವನ್ನು ಅನುಭವಿಸಿದಾಗ ನೀವು ಸಾಮಾನ್ಯವಾಗಿ ಏನು ಮಾಡುತ್ತೀರಿ?', options: ['ನನ್ನನ್ನು ಪ್ರತ್ಯೇಕಿಸಿಕೊಳ್ಳುತ್ತೇನೆ', 'ನನ್ನ ಗಮನವನ್ನು ಬೇರೆಡೆಗೆ ಸೆಳೆಯುತ್ತೇನೆ', 'ಯಾರೊಂದಿಗಾದರೂ ಮಾತನಾಡುತ್ತೇನೆ', 'ಒಂದು ಹವ್ಯಾಸದಲ್ಲಿ ತೊಡಗಿಸಿಕೊಳ್ಳುತ್ತೇನೆ'] },
            reliance: { question: 'ವಿಷಯಗಳು ಕಷ್ಟಕರವಾದಾಗ ನೀವು ಅವಲಂಬಿಸಲು ಯಾರಾದರೂ ಇದ್ದಾರೆಂದು ನೀವು ಭಾವಿಸುತ್ತೀರಾ?', options: ['ಇಲ್ಲ, ನಿಜವಾಗಿಯೂ ಇಲ್ಲ', 'ಬಹುಶಃ ಒಬ್ಬ ವ್ಯಕ್ತಿ', 'ಹೌದು, ಕೆಲವು ಜನರು', 'ಹೌದು, ಒಂದು ಬಲವಾದ ಜಾಲ'] },
            professional_help: { question: 'ನಿಮಗೆ ಇದೀಗ ವೃತ್ತಿಪರ ಸಹಾಯ ಅಥವಾ ಬೆಂಬಲ ಬೇಕಾಗಬಹುದು ಎಂದು ನೀವು ಪರಿಗಣಿಸಿದ್ದೀರಾ?', options: ['ಹೌದು, ಬಲವಾಗಿ', 'ಹೌದು, ನಾನು ಅದರ ಬಗ್ಗೆ ಯೋಚಿಸಿದ್ದೇನೆ', 'ನಿಜವಾಗಿಯೂ ಇಲ್ಲ', 'ಇಲ್ಲ, ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ'] },
        }
    }
};

const MENTAL_HEALTH_QUESTIONS = Object.keys(translations.en.questionnaire);


const MOODS = [
    { name: 'Happy', emoji: '😊', value: 5, color: '#4caf50' },
    { name: 'Calm', emoji: '😌', value: 4, color: '#2196f3' },
    { name: 'Neutral', emoji: '😐', value: 3, color: '#ffc107' },
    { name: 'Anxious', emoji: '😟', value: 2, color: '#ff9800' },
    { name: 'Sad', emoji: '😢', value: 1, color: '#f44336' },
];
const MAX_MOOD_VALUE = 5;

type MoodEntry = {
    mood: string;
    timestamp: number;
};


const findTherapist: FunctionDeclaration = {
    name: 'findTherapist',
    parameters: {
        type: Type.OBJECT,
        description: 'Finds a therapist based on location.',
        properties: {
            location: {
                type: Type.STRING,
                description: 'The city and state to search for a therapist, e.g., "San Francisco, CA"',
            },
        },
        required: ['location'],
    },
};

const startMentalHealthCheckin: FunctionDeclaration = {
    name: 'startMentalHealthCheckin',
    description: 'Initiates a structured mental health check-in when the user expresses significant or persistent distress. This function will guide the user through a series of questions on the frontend.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
};


// Schema for the internal sentiment analysis call
const sentimentAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
      userSentiment: {
        type: Type.STRING,
        description: "A brief summary of the user's likely emotional state (e.g., anxious, frustrated, happy, reflective)."
      },
      suggestedTone: {
        type: Type.STRING,
        description: "A short instruction for the AI's tone for the next response (e.g., 'be extra reassuring and gentle', 'maintain a positive and encouraging tone', 'offer practical advice calmly')."
      },
      isConversationEnding: {
        type: Type.BOOLEAN,
        description: "Set to true if the user's message suggests the conversation is concluding (e.g., they say 'thanks', 'bye', or seem resolved)."
      },
    },
    required: ['userSentiment', 'suggestedTone', 'isConversationEnding']
  };

async function initializeChat(lang: string) {
    // Clear chat content except for the suggested prompts container
    while (chatContainer.firstChild && chatContainer.firstChild !== suggestedPromptsContainer) {
        chatContainer.removeChild(chatContainer.firstChild);
    }
    
    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        chat = ai.chats.create({
          model: 'gemini-2.5-flash',
          config: {
            systemInstruction: translations[lang].systemInstruction,
            tools: [{ functionDeclarations: [findTherapist, startMentalHealthCheckin] }],
          },
        });
        // Immediately start the questionnaire on load
        beginQuestionnaire();
    } catch (error) {
        console.error('Initialization error:', error);
        appendMessage({sender: 'model', text: translations[lang].connectError});
    }
}


function appendMessage({ sender, text }: { sender: 'user' | 'model'; text?: string; }): HTMLElement {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', `${sender}-message`);

  if (sender === 'model') {
    const avatarDiv = document.createElement('div');
    avatarDiv.classList.add('avatar');
    messageDiv.appendChild(avatarDiv);
  }

  const messageP = document.createElement('p');
  messageP.textContent = text ?? '';

  messageDiv.appendChild(messageP);
  chatContainer.insertBefore(messageDiv, suggestedPromptsContainer);

  chatContainer.scrollTop = chatContainer.scrollHeight;
  return messageDiv;
}

// Helper function to process and display a streamed response
async function processStream(
    stream: AsyncGenerator<GenerateContentResponse>,
    messageP: HTMLParagraphElement
): Promise<{ text: string; functionCalls?: any[] }> {
    let text = '';
    let functionCalls: any[] | undefined = undefined;
    for await (const chunk of stream) {
        if (chunk.text) {
            text += chunk.text;
            messageP.textContent = text;
        }
        if (chunk.functionCalls) {
            functionCalls = chunk.functionCalls;
        }
        // Ensure scroll stays at the bottom during streaming
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    return { text, functionCalls };
}

async function handleSendMessage(event: Event) {
  event.preventDefault();
  
  if (isCheckinActive) return; // Don't allow sending messages during check-in

  const messageText = chatInput.value.trim();

  if (!messageText || !chat || !ai) {
    return;
  }
  
  let shouldPromptForMood = false;
  let errorOccurred = false;

  // Remove existing mood selectors before sending a new message
  document.querySelector('.mood-selector')?.remove();
  suggestedPromptsContainer.style.display = 'none';

  appendMessage({ sender: 'user', text: messageText });
  chatInput.value = '';
  chatInput.disabled = true;

  const modelMessageDiv = appendMessage({ sender: 'model', text: '' });
  const messageP = modelMessageDiv.querySelector('p')!;
  messageP.classList.add('streaming');

  try {
    // Step 1: Internal sentiment analysis (optional, can be simplified or removed if not central)
    let suggestedTone = '';
    // ... sentiment analysis logic ...

    // Step 2: Send message and get the stream
    let stream = await chat.sendMessageStream({ message: messageText });
    
    // Step 3: Process the stream for text and potential function calls
    const response = await processStream(stream, messageP);
    
    // Step 4: Handle function calls if they exist
    if (response.functionCalls && response.functionCalls.length > 0) {
        for (const fc of response.functionCalls) {
            if (fc.name === 'findTherapist') {
                const findingText = translations[currentLang].findingTherapist.replace('{location}', fc.args.location);
                messageP.textContent = findingText;
                
                const toolResult = {
                    functionResponse: {
                        name: fc.name,
                        response: { result: JSON.stringify([
                            { name: "Dr. Anya Sharma, PhD", specialty: "Anxiety & Depression", contact: "555-123-4567" },
                            { name: "Ken Adams, LMFT", specialty: "Relationship Counseling", contact: "555-987-6543" }
                        ])}
                    }
                };
                
                const finalStream = await chat.sendMessageStream({ message: [{functionResponse: toolResult.functionResponse}] });
                await processStream(finalStream, messageP);
            } else if (fc.name === 'startMentalHealthCheckin') {
                beginQuestionnaire();
            }
        }
    }
  } catch (error) {
    errorOccurred = true;
    console.error('Error sending message:', error);
    let errorKey = 'errorDefault';

    if (!navigator.onLine) {
        errorKey = 'errorOffline';
    } else if (error instanceof Error) {
        const lowerCaseErrorMessage = error.message.toLowerCase();
        if (lowerCaseErrorMessage.includes('api key not valid')) {
            errorKey = 'errorApiKey';
        } else if (lowerCaseErrorMessage.includes('429')) {
            errorKey = 'errorRateLimit';
        } else if (lowerCaseErrorMessage.includes('500') || lowerCaseErrorMessage.includes('503')) {
            errorKey = 'errorServer';
        } else if (lowerCaseErrorMessage.includes('safety')) {
            errorKey = 'errorSafety';
        } else if (lowerCaseErrorMessage.includes('network error') || lowerCaseErrorMessage.includes('failed to fetch')) {
             errorKey = 'errorNetwork';
        }
    }
    
    messageP.textContent = translations[currentLang][errorKey];
  } finally {
    messageP.classList.remove('streaming');
    if (!isCheckinActive) {
        chatInput.disabled = false;
        chatInput.focus();
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
    if (shouldPromptForMood && !errorOccurred && !isCheckinActive) {
      createMoodSelector();
    }
  }
}

// --- Questionnaire Logic ---
function beginQuestionnaire() {
    isCheckinActive = true;
    currentQuestionIndex = 0;
    userAnswers = {};
    chatInput.disabled = true;
    chatInput.placeholder = 'Please complete the check-in...';
    // This function call can come from a model response, so clear any "streaming" cursors
    document.querySelectorAll('.streaming').forEach(el => el.classList.remove('streaming'));
    displayCurrentQuestion();
}

function displayCurrentQuestion() {
    if (currentQuestionIndex >= MENTAL_HEALTH_QUESTIONS.length) {
        completeQuestionnaire();
        return;
    }

    const questionKey = MENTAL_HEALTH_QUESTIONS[currentQuestionIndex];
    const questionData = translations[currentLang].questionnaire[questionKey];

    appendMessage({ sender: 'model', text: questionData.question });

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'question-options-container';

    questionData.options.forEach(optionText => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = optionText;
        button.onclick = () => handleOptionClick(questionKey, optionText);
        optionsContainer.appendChild(button);
    });

    chatContainer.insertBefore(optionsContainer, suggestedPromptsContainer);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function handleOptionClick(questionKey: string, answer: string) {
    // Remove the options UI
    document.querySelector('.question-options-container')?.remove();

    // Show user's choice in the chat
    appendMessage({ sender: 'user', text: answer });

    userAnswers[questionKey] = answer;
    currentQuestionIndex++;
    
    // Use a small delay before showing the next question to make it feel more natural
    setTimeout(displayCurrentQuestion, 300);
}

async function completeQuestionnaire() {
    isCheckinActive = false;
    chatInput.disabled = false;
    chatInput.placeholder = translations[currentLang].chatInputPlaceholder;
    chatInput.focus();

    appendMessage({ sender: 'model', text: 'Thank you for sharing. Let me take a moment to reflect on what you\'ve told me...' });
    
    const toolResult = {
        functionResponse: {
            name: 'startMentalHealthCheckin',
            response: { answers: userAnswers },
        }
    };

    const modelMessageDiv = appendMessage({ sender: 'model', text: '' });
    const messageP = modelMessageDiv.querySelector('p')!;
    messageP.classList.add('streaming');

    try {
        const stream = await chat.sendMessageStream({ message: [{functionResponse: toolResult.functionResponse}] });
        await processStream(stream, messageP);
    } catch (error) {
        console.error('Error sending questionnaire results:', error);
        messageP.textContent = translations[currentLang].errorDefault;
    } finally {
        messageP.classList.remove('streaming');
    }
}


// --- Theme Toggling Logic ---
function applyTheme(theme: 'light' | 'dark') {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme(systemPrefersDark ? 'dark' : 'light');
    }
}

// --- Mood Data Logic ---
function getMoodData(): MoodEntry[] {
    const data = localStorage.getItem('moodHistory');
    return data ? JSON.parse(data) : [];
}

function addMoodData(mood: string) {
    const moods = getMoodData();
    moods.push({ mood, timestamp: Date.now() });
    localStorage.setItem('moodHistory', JSON.stringify(moods));
}

// --- Mood Selector UI ---
function createMoodSelector() {
    // Remove any existing selector
    const existingSelector = document.querySelector('.mood-selector');
    if (existingSelector) {
        existingSelector.remove();
    }
    
    const selectorDiv = document.createElement('div');
    selectorDiv.className = 'mood-selector';

    const promptP = document.createElement('p');
    promptP.textContent = translations[currentLang].moodPrompt;
    selectorDiv.appendChild(promptP);

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'mood-options';

    MOODS.forEach(mood => {
        const button = document.createElement('button');
        button.className = 'mood-btn';
        button.dataset.mood = mood.name;
        button.setAttribute('aria-label', `Select mood: ${mood.name}`);
        button.innerHTML = `
            <span class="emoji" aria-hidden="true">${mood.emoji}</span>
            <span>${mood.name}</span>
        `;
        button.addEventListener('click', () => {
            addMoodData(mood.name);
            selectorDiv.remove();
            const confirmationText = translations[currentLang].moodConfirmation.replace('{mood}', mood.name.toLowerCase());
            appendMessage({sender: 'model', text: confirmationText})
        });
        optionsDiv.appendChild(button);
    });

    selectorDiv.appendChild(optionsDiv);
    chatContainer.insertBefore(selectorDiv, suggestedPromptsContainer);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// --- Mood Visualization Modal Logic ---
function renderMoodChart() {
    moodChartContainer.innerHTML = ''; // Clear previous chart
    const data = getMoodData();

    if (data.length === 0) {
        moodChartContainer.innerHTML = `<p class="no-mood-data">${translations[currentLang].noMoodData}</p>`;
        return;
    }

    data.forEach(entry => {
        const moodInfo = MOODS.find(m => m.name === entry.mood);
        if (!moodInfo) return;

        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        const heightPercent = (moodInfo.value / MAX_MOOD_VALUE) * 100;
        bar.style.height = `${heightPercent}%`;
        bar.style.backgroundColor = moodInfo.color;

        const tooltip = document.createElement('span');
        tooltip.className = 'tooltip';
        const date = new Date(entry.timestamp);
        tooltip.textContent = `${moodInfo.emoji} ${moodInfo.name} - ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        
        bar.appendChild(tooltip);
        moodChartContainer.appendChild(bar);
    });
}

function openModal() {
    renderMoodChart();
    moodModal.classList.add('visible');
}

function closeModal() {
    moodModal.classList.remove('visible');
}

// --- Language Logic ---
function setLanguage(lang: string) {
    if (!translations[lang]) {
        console.error(`Language ${lang} not supported.`);
        return;
    }
    currentLang = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;

    const elements = document.querySelectorAll('[data-translate-key]');
    elements.forEach(el => {
        const key = el.getAttribute('data-translate-key');
        if (key && translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });

    const placeholders = document.querySelectorAll('[data-translate-key-placeholder]');
    placeholders.forEach(el => {
        const key = el.getAttribute('data-translate-key-placeholder');
        if (key && translations[lang][key]) {
            (el as HTMLInputElement).placeholder = translations[lang][key];
        }
    });

    const ariaLabels = document.querySelectorAll('[data-translate-key-aria]');
    ariaLabels.forEach(el => {
        const key = el.getAttribute('data-translate-key-aria');
        if (key && translations[lang][key]) {
            el.setAttribute('aria-label', translations[lang][key]);
        }
    });
    
    initializeChat(lang);
}

function initializeLanguage() {
    // Populate selector
    languageSelector.innerHTML = ''; // Clear existing
    Object.keys(translations).forEach(lang => {
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = new Intl.DisplayNames([lang], { type: 'language' }).of(lang) || lang;
        languageSelector.appendChild(option);
    });

    const savedLang = localStorage.getItem('language');
    const browserLang = navigator.language.split('-')[0];
    const langToUse = savedLang || (translations[browserLang] ? browserLang : 'en');
    
    languageSelector.value = langToUse;
    setLanguage(langToUse);
}


// --- Event Listeners ---
chatForm.addEventListener('submit', handleSendMessage);
themeToggleButton.addEventListener('click', toggleTheme);
moodTrendsBtn.addEventListener('click', openModal);
modalCloseBtn.addEventListener('click', closeModal);
languageSelector.addEventListener('change', (e) => setLanguage((e.target as HTMLSelectElement).value));
moodModal.addEventListener('click', (event) => {
    // Close if clicked on the overlay itself, not the content
    if (event.target === moodModal) {
        closeModal();
    }
});


initializeTheme();
initializeLanguage();