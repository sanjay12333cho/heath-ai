/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Chat, FunctionDeclaration, Type, Content } from '@google/genai';

const chatContainer = document.getElementById('chat-container');
// FIX: Cast chatForm to HTMLFormElement to access requestSubmit method.
const chatForm = document.getElementById('chat-form') as HTMLFormElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const suggestedPromptsContainer = document.getElementById('suggested-prompts');
const themeToggleButton = document.getElementById('theme-toggle');

if (!chatContainer || !chatForm || !chatInput || !suggestedPromptsContainer || !themeToggleButton) {
  throw new Error('Missing required DOM elements');
}

let chat: Chat;
let ai: GoogleGenAI; // AI instance for sentiment analysis

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
    },
    required: ['userSentiment', 'suggestedTone']
  };

async function initializeChat() {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are "Your Friend," a warm, empathetic, and supportive friend. Your personality is that of a human, not an AI.
        Your purpose is to listen and help the user explore their feelings.
        Start by asking open-ended questions to understand how they're doing. For example, if they say they're anxious, ask them what's causing it or what it feels like. Gently guide the conversation to learn more about their situation.
        Your tone should be informal, caring, and non-judgmental, just like a close friend would talk. Use "I'm here for you" and similar phrases.
        
        You might receive internal instructions in parentheses before a message, like '(Internal instruction: be extra gentle)'. You MUST follow this instruction to guide your tone for that specific response, but DO NOT mention the instruction itself or the fact that you received it. It's a behind-the-scenes note for you.

        If a user is in serious distress or mentions self-harm, you MUST gently but firmly insist they contact a crisis hotline or a professional immediately.
        You can help find a therapist if they ask, but only if they ask.
        Never give medical diagnoses. Your role is to be a supportive friend, offering a listening ear, encouragement, and practical coping strategies.`,
        tools: [{ functionDeclarations: [findTherapist] }],
      },
    });
  } catch (error) {
    console.error('Initialization error:', error);
    appendMessage({sender: 'model', text: 'Sorry, I am having trouble connecting right now. Please try again later.'});
  }
}

function appendMessage({ sender, text, isLoading = false }: { sender: 'user' | 'model'; text?: string; isLoading?: boolean; }): HTMLElement {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', `${sender}-message`);

  const avatarDiv = document.createElement('div');
  if (sender === 'model') {
    avatarDiv.classList.add('avatar');
    messageDiv.appendChild(avatarDiv);
  }

  const messageP = document.createElement('p');

  if (isLoading) {
    messageDiv.classList.add('typing-indicator');
    messageP.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
  } else {
    messageP.textContent = text;
  }

  messageDiv.appendChild(messageP);
  chatContainer.insertBefore(messageDiv, suggestedPromptsContainer);

  chatContainer.scrollTop = chatContainer.scrollHeight;
  return messageDiv;
}

async function handleSendMessage(event: Event) {
  event.preventDefault();
  const messageText = chatInput.value.trim();

  if (!messageText || !chat || !ai) {
    return;
  }
  
  suggestedPromptsContainer.style.display = 'none';

  appendMessage({ sender: 'user', text: messageText });
  chatInput.value = '';
  chatInput.disabled = true;

  const loadingIndicator = appendMessage({ sender: 'model', isLoading: true });

  try {
    // Step 1: Internal sentiment analysis call
    let suggestedTone = '';
    try {
        const history: Content[] = await chat.getHistory();
        const lastFewMessages = history
            .slice(-4)
            .map(h => {
                const part = h.parts.find(p => 'text' in p);
                return part ? `${h.role}: ${(part as {text: string}).text}` : '';
            })
            .filter(Boolean)
            .join('\n');
        
        const sentimentPrompt = `Based on the recent conversation context below, analyze the user's latest message.
        Context:
        ${lastFewMessages}
        
        User's latest message: "${messageText}"
        
        What is the user's likely sentiment, and what tone should the AI adopt in its next response to be most helpful and empathetic? Provide your answer in JSON format.`;

        const sentimentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: sentimentPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: sentimentAnalysisSchema,
            },
        });
        
        const sentimentData = JSON.parse(sentimentResponse.text);
        if (sentimentData.suggestedTone) {
            suggestedTone = sentimentData.suggestedTone;
        }
    } catch (sentimentError) {
        console.error("Sentiment analysis failed:", sentimentError);
        // If sentiment fails, proceed without it.
    }

    // Step 2: Prepare message for the main chat model
    const messageForModel = suggestedTone 
        ? `(Internal instruction: ${suggestedTone}) ${messageText}`
        : messageText;

    // Step 3: Send message to the chat and get response
    let response = await chat.sendMessage({ message: messageForModel });
    
    // Step 4: Handle potential function calls
    if (response.functionCalls && response.functionCalls.length > 0) {
        const fc = response.functionCalls[0];
        if (fc.name === 'findTherapist') {
            loadingIndicator.querySelector('p')!.textContent = `Looking for therapists near ${fc.args.location}...`;
            
            // Simulate an API call and get a result
            const toolResult = {
                toolResponses: [{
                    id: fc.id,
                    name: fc.name,
                    response: { result: JSON.stringify([
                        { name: "Dr. Anya Sharma, PhD", specialty: "Anxiety & Depression", contact: "555-123-4567" },
                        { name: "Ken Adams, LMFT", specialty: "Relationship Counseling", contact: "555-987-6543" },
                        { name: "Thrive Wellness Center", specialty: "Holistic Mental Health", contact: "555-555-5555" }
                    ])}
                }]
            };
            
            // Send the result back to the model
            response = await chat.sendMessage(toolResult);
        }
    }

    // Step 5: Display the final text response
    loadingIndicator.classList.remove('typing-indicator');
    loadingIndicator.querySelector('p')!.textContent = response.text;

  } catch (error) {
    console.error('Error sending message:', error);
    loadingIndicator.classList.remove('typing-indicator');
    loadingIndicator.querySelector('p')!.textContent = 'I apologize, something went wrong. Please try again.';
  } finally {
    chatInput.disabled = false;
    chatInput.focus();
  }
}

function handleSuggestedPrompt(event: Event) {
    const target = event.target as HTMLButtonElement;
    if (target.classList.contains('prompt-btn')) {
        chatInput.value = target.textContent || '';
        chatForm.requestSubmit();
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


chatForm.addEventListener('submit', handleSendMessage);
suggestedPromptsContainer.addEventListener('click', handleSuggestedPrompt);
themeToggleButton.addEventListener('click', toggleTheme);

initializeTheme();
initializeChat();