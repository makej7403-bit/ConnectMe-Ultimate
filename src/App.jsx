import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp,
  setDoc,
  query, 
  where
} from "firebase/firestore";
import { 
  MessageCircle, ThumbsUp, Share2, MoreHorizontal, Cpu, X, 
  ImageIcon, Video, Smile, LogOut, Send, Home, Users, Store, 
  Zap, Activity, Star, ShieldCheck, Lock, CreditCard, CheckCircle, 
  BookOpen, Tv, Award, Code, Database, Globe, Layers, MapPin, 
  Heart, Mic, Camera, Radio, Terminal, TrendingUp, DollarSign, 
  ShoppingBag, VideoOff, Menu, Gift, Loader2 
} from 'lucide-react';

// --- Configuration ---
// IMPORTANT: For Vercel/External Deployment, replace the DUMMY config below
// with your actual Firebase project configuration.
const firebaseConfig = {
  // Replace this object with your actual Firebase configuration
  apiKey: "AIzaSyC5hFB3ICxzyMrlvtnQl-n-2Dkr2RFsmqc", 
  authDomain: "fir-9b1f8.firebaseapp.com",
  projectId: "fir-9b1f8",
  storageBucket: "fir-9b1f8.firebasestorage.app",
  messagingSenderId: "539772525700",
  appId: "1:539772525700:web:25b5a686877ddbf6d176d1",
  measurementId: "G-7FWY3QB5MY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "connectme-ultimate-v3";
// --- ADMIN ACCOUNT: Use this email to log in as Admin ---
const ADMIN_EMAIL = "sokpahakinsaye@gmail.com"; 

// --- Gemini API Utility ---
// The API Key will be read from the Vercel environment variables (e.g., process.env.VITE_GEMINI_API_KEY)
// Note: In this environment, we still use the __initial_auth_token logic for the initial auth setup.
// For Vercel, the API_KEY needs to be set up manually in the function or environment.
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=`;
// IMPORTANT: In a real Vercel environment, you would use: 
// const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
// For this self-contained file to work in the Canvas environment, we must use the empty string.
const API_KEY = ""; 

/**
 * Utility function to make fetch calls with exponential backoff for resilience.
 */
async function fetchWithRetry(url, options, maxRetries = 5) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url + API_KEY, options);
            if (response.ok) {
                return response;
            }
            if (response.status === 429 && attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                const errorBody = await response.text();
                throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
            }
        } catch (error) {
            if (attempt === maxRetries - 1) {
                throw error;
            }
            console.warn(`Attempt ${attempt + 1} failed. Retrying...`);
        }
    }
    throw new Error("Maximum retry attempts reached.");
}

/**
 * Calls the Gemini API with optional grounding (Google Search) and system instructions.
 */
async function callGemini(userQuery, systemPrompt = null, useGrounding = false) {
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        tools: useGrounding ? [{ "google_search": {} }] : undefined,
    };

    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };

    try {
        const response = await fetchWithRetry(GEMINI_API_URL, options);
        const result = await response.json();
        
        const candidate = result.candidates?.[0];
        if (candidate && candidate.content?.parts?.[0]?.text) {
            const text = candidate.content.parts[0].text;
            let sources = [];
            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                    .map(attribution => ({
                        uri: attribution.web?.uri,
                        title: attribution.web?.title,
                    }))
                    .filter(source => source.uri && source.title);
            }
            return { text, sources };
        } else if (result.error) {
            throw new Error(result.error.message || "Gemini API returned an error.");
        }
        return { text: "Error: Could not process request from LLM.", sources: [] };
    } catch (e) {
        return { text: `Error connecting to AI: ${e.message}`, sources: [] };
    }
}


// --- Feature List Generation (300+ Features) ---
const FEATURE_ICONS = {
  ai: Cpu, social: Users, creative: Camera, utility: DollarSign, education: BookOpen, live: Tv
};

const generateFeatures = (baseName, count, prefix, isProFn) => Array.from({ length: count }, (_, i) => ({ 
  id: `${prefix}-${i}`, 
  name: `${baseName} ${i + 1}: ${['Neural Net Decoder', 'Quantum Encryption Suite', 'Holographic Projection Studio', 'Ethical AI Guardian', 'Telepathic Text Interface', 'Dream Synthesis Engine', 'Deep Fake Validator', 'Bio-Rhythm Scanner', 'Auto-Translation Matrix', 'Spatial Computing OS', 'Financial Prediction Model', 'Global Commerce Hub', 'Decentralized Identity Vault', 'Real-time Emotion Map', 'Time Travel Planner', 'Custom Emoji Creator', 'Augmented Reality Filters', 'Personalized News Feed', 'Virtual Pet Companion', 'Mood-Based Playlist Generator'][i % 20]}`, 
  isPro: isProFn(i),
  icon: FEATURE_ICONS[prefix] || Zap
}));

const AI_FEATURES = generateFeatures("AI Core", 100, 'ai', (i) => i >= 0); // All AI features are PRO
const SOCIAL_UTILITY_FEATURES = generateFeatures("Social/Utility", 100, 'social', (i) => i > 25);
const CREATIVE_LIVE_FEATURES = generateFeatures("Creative/Live", 50, 'creative', (i) => i > 10);
const EDUCATION_FEATURES = generateFeatures("Edu/Pro", 50, 'education', (i) => i > 10);

const ALL_FEATURES = {
    'AI Suite (100)': AI_FEATURES, 
    'Global Social & Utility (100)': SOCIAL_UTILITY_FEATURES, 
    'Creative Studio & Live (50)': CREATIVE_LIVE_FEATURES, 
    'Advanced Education (50)': EDUCATION_FEATURES
};
// Total features: 300+

// --- Component: AdminPanel ---
const AdminPanel = ({ onClose }) => {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    // Listen for pending payment requests
    const q = query(collection(db, 'artifacts', appId, 'admin', 'payment_requests'), where("status", "==", "pending"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const approveUser = async (req) => {
    try {
      // 1. Update user profile to Pro (Private Data)
      const userRef = doc(db, 'artifacts', appId, 'users', req.userId, 'profile', 'info');
      await setDoc(userRef, { isPro: true, proSince: serverTimestamp() }, { merge: true });
      
      // 2. Update request status (Admin Data)
      await updateDoc(doc(db, 'artifacts', appId, 'admin', 'payment_requests', req.id), { status: 'approved' });
      
      // Use console log for feedback
      console.log(`User ${req.userName} Approved!`);
    } catch (err) {
      console.error(err);
      console.log("Error approving user.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 text-white w-full max-w-2xl rounded-xl p-6 border border-red-500 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-red-400 flex items-center gap-2">
            <ShieldCheck /> ADMIN COMMAND CENTER
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded"><X /></button>
        </div>
        
        <h3 className="font-bold mb-4 border-b border-gray-700 pb-2">Pending Pro Approvals ({requests.length})</h3>
        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
          {requests.length === 0 ? <p className="text-gray-500">No pending requests.</p> : null}
          {requests.map(req => (
            <div key={req.id} className="bg-gray-800 p-4 rounded flex justify-between items-center">
              <div>
                <p className="font-bold text-lg">{req.userName || 'N/A'}</p>
                <p className="text-sm text-gray-400">UID: {req.userId}</p>
                <p className="text-xs text-yellow-500">Claimed Paid: {req.method}</p>
              </div>
              <button 
                onClick={() => approveUser(req)}
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full font-bold transition shadow-md"
              >
                Confirm PRO
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Component: LiveScreen ---
const LiveScreen = ({ isPro, onUpgrade }) => (
    <div className="p-4 animate-fade-in">
        <h2 className="text-3xl font-bold text-red-400 mb-6 flex items-center gap-3 border-b border-gray-700 pb-3">
            <Tv size={28} /> ConnectMe Live
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <LiveStreamCard title="Global AI Summit" host="ConnectMe Labs" viewers={987} isPro={false} isLive={true} />
            <LiveStreamCard title="Coding Bootcamp - Session 5" host="Jane Doe" viewers={123} isPro={false} isLive={false} />
            <LiveStreamCard title="Quantum Physics Q&A" host="Dr. K. Smith" viewers={34} isPro={true} isLive={true} onUpgrade={onUpgrade}/>
        </div>

        <div className="mt-10 p-6 bg-gray-800 rounded-xl border-t-4 border-red-500">
            <h3 className="text-2xl font-bold mb-3 text-red-400">Go Live! (PRO Feature)</h3>
            <p className="text-gray-400 mb-4">
                As a Pro user, you unlock Ultra-HD 4K streaming, multi-camera support, and real-time AI moderation.
            </p>
            {isPro ? (
                <button className="bg-green-600 text-white font-bold py-3 px-6 rounded-full flex items-center gap-2 hover:bg-green-500 transition">
                    <Mic /> Start 4K Broadcast
                </button>
            ) : (
                <button onClick={onUpgrade} className="bg-yellow-600 text-black font-bold py-3 px-6 rounded-full flex items-center gap-2 hover:bg-yellow-500 transition">
                    <Lock size={20} /> Upgrade to Stream in 4K
                </button>
            )}
        </div>
    </div>
);

const LiveStreamCard = ({ title, host, viewers, isPro, isLive, onUpgrade }) => (
    <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg relative group">
        <div className="h-40 bg-gray-900 flex items-center justify-center text-gray-500 relative">
            <img 
                src={`https://placehold.co/400x160/1a1a1a/cccccc?text=${isLive ? title : 'UP NEXT'}`} 
                onError={(e) => {e.target.onerror = null; e.target.src=`https://placehold.co/400x160/1a1a1a/cccccc?text=${isLive ? title : 'UP NEXT'}`}}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
            {isLive ? (
                <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div> LIVE
                </div>
            ) : (
                <div className="absolute top-2 left-2 bg-gray-600 text-white text-xs font-bold px-2 py-1 rounded-full">UP NEXT</div>
            )}
            
            {isPro && (
                <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Star size={12} fill="black" /> PRO
                </div>
            )}
            
            {isPro && !isLive && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                    <Lock size={32} className="text-yellow-500 mb-2"/>
                    <p className="text-yellow-400 font-bold">PRO CONTENT</p>
                    <button onClick={onUpgrade} className="mt-2 bg-yellow-600 text-black text-xs px-3 py-1 rounded-full hover:bg-yellow-500">Unlock</button>
                </div>
            )}
        </div>
        <div className="p-3">
            <p className="font-bold text-lg truncate">{title}</p>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{host}</span>
                <span className="flex items-center gap-1"><Users size={12}/> {viewers}</span>
            </div>
        </div>
    </div>
);

// --- Component: CoursesCatalog ---
const CoursesCatalog = ({ isPro, onUpgrade }) => {
    const COURSES = [
        { title: "Introduction to Neural Networks", level: "Beginner", duration: "4h", instructor: "AI Core Team", isProContent: false },
        { title: "Advanced Quantum Computing", level: "Expert", duration: "12h", instructor: "Dr. Leda", isProContent: true },
        { title: "Building a Decentralized App", level: "Intermediate", duration: "6h", instructor: "Blockchain Expert", isProContent: false },
        { title: "ConnectMe Platform Development", level: "Beginner", duration: "3h", instructor: "ConnectMe Staff", isProContent: true },
        { title: "Ethical AI Design", level: "Intermediate", duration: "5h", instructor: "Compliance Dept.", isProContent: false },
        { title: "Mastering Social Media Branding", level: "Intermediate", duration: "4h", instructor: "Marketing Guru", isProContent: true },
    ];

    return (
        <div className="p-4 animate-fade-in">
            <h2 className="text-3xl font-bold text-green-400 mb-6 flex items-center gap-3 border-b border-gray-700 pb-3">
                <BookOpen size={28} /> ConnectMe Academy (Free)
            </h2>
            
            <p className="text-gray-400 mb-6">
                Explore free micro-courses in technology and future skills. Get a **PRO Certification** for all courses by upgrading!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {COURSES.map((course, index) => (
                    <div key={index} className="bg-gray-800 rounded-xl overflow-hidden shadow-lg transition transform hover:scale-[1.02]">
                        <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-xl text-white">{course.title}</h3>
                                {course.isProContent && (
                                    <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Star size={12} fill="black" /> PRO
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-400">Instructor: {course.instructor}</p>
                            <div className="flex justify-between items-center mt-3 text-xs text-gray-500 border-t border-gray-700 pt-3">
                                <span>Level: {course.level}</span>
                                <span>Duration: {course.duration}</span>
                                
                                {isPro ? (
                                    <button className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                        <Award size={14} /> Start
                                    </button>
                                ) : course.isProContent ? (
                                    <button onClick={onUpgrade} className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                        <Lock size={14} /> Unlock
                                    </button>
                                ) : (
                                     <button className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                                        Free Enroll
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-10 p-6 bg-gray-800 rounded-xl border-t-4 border-yellow-500 text-center">
                <h3 className="text-2xl font-bold mb-2 text-yellow-400">Get Certified!</h3>
                <p className="text-gray-400 mb-4">
                    Upgrade to Pro to receive an officially verifiable certificate of completion for every course.
                </p>
                {!isPro && (
                    <button onClick={onUpgrade} className="bg-yellow-600 text-black font-bold py-3 px-8 rounded-full text-lg hover:bg-yellow-500 transition">
                        Get PRO Certification Access
                    </button>
                )}
            </div>
        </div>
    );
};


// --- Component: ProModal (Kept concise) ---
const ProModal = ({ user, onClose }) => {
  const [loading, setLoading] = useState(false);

  const handlePaymentClaim = async () => {
    setLoading(true);
    try {
      // Data saved to admin collection for approval
      await addDoc(collection(db, 'artifacts', appId, 'admin', 'payment_requests'), {
        userId: user.uid,
        userName: user.displayName || "Unknown",
        userEmail: user.email || "Anonymous",
        method: "Manual Transfer (UBA/MoMo)",
        status: "pending",
        timestamp: serverTimestamp()
      });
      // Use console log for feedback
      console.log("Payment claim submitted! Please email your screenshot to sokpahakinsaye@gmail.com for instant approval.");
      onClose();
    } catch (e) {
      console.error(e);
      // console.log instead of alert
      console.log("Error submitting claim.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gradient-to-br from-blue-900 to-black text-white w-full max-w-lg rounded-2xl p-6 border-2 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.3)]">
        <div className="text-center mb-6">
          <div className="inline-block bg-yellow-500 text-black font-bold px-3 py-1 rounded-full text-xs mb-2">PREMIUM ACCESS</div>
          <h2 className="text-3xl font-bold text-yellow-400">Upgrade to ConnectMe PRO</h2>
          <p className="text-gray-300 mt-2">Unlock 300+ Advanced AI & Features</p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-400" size={20} />
            <span>Ultimate AI Chat (Grounded) & AI Post Drafting</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-400" size={20} />
            <span>4K Live Streaming & PRO Certification Courses</span>
          </div>
        </div>

        <div className="bg-white/10 p-4 rounded-xl mb-6 border border-white/20">
          <h3 className="font-bold text-lg mb-2">Payment Details (Manual)</h3>
          <p className="text-sm text-gray-300 mb-1">Send <span className="text-yellow-400 font-bold">$9.80 USD</span> to:</p>
          <div className="bg-black/50 p-3 rounded mb-2">
            <p className="font-mono text-sm"><span className="text-blue-400">Bank:</span> UBA Liberia</p>
            <p className="font-mono text-lg font-bold text-white tracking-widest">530 207 100 153 94</p>
            <p className="text-xs text-gray-400">Name: Akin S. Sokpah</p>
          </div>
        </div>

        <button 
          onClick={handlePaymentClaim}
          disabled={loading}
          className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-black font-bold py-4 rounded-xl text-lg transition transform hover:scale-105 shadow-lg"
        >
          {loading ? <Loader2 className="animate-spin mx-auto" size={24}/> : "I Have Sent The Money"}
        </button>
        <p className="text-center text-xs text-gray-500 mt-4">
          After sending, email screenshot to: <span className="text-blue-400">sokpahakinsaye@gmail.com</span>
        </p>
        <button onClick={onClose} className="w-full text-center text-gray-500 mt-2 text-sm hover:text-white">Cancel</button>
      </div>
    </div>
  );
};

// --- Component: UltimateAI (Kept concise) ---
const UltimateAI = ({ onClose, isPro, onUpgrade }) => {
  const [messages, setMessages] = useState([
    { role: 'ai', text: "I am ConnectMe Ultimate AI. Ask me anything, I have real-time global knowledge." }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const handleSend = async () => {
    const userText = input.trim();
    if (!userText) return;

    setMessages(p => [...p, { role: 'user', text: userText }]);
    setInput('');
    setIsTyping(true);

    const systemPrompt = "You are ConnectMe Ultimate AI, a helpful, futuristic, and friendly assistant integrated into the world's most advanced social network. You have access to real-time information via Google Search. Keep your responses concise and highly relevant to the user's queries.";
    
    let query = userText;
    let useGrounding = true;
    let isProFeatureRequest = false;

    // Simulated Pro feature check
    if (!isPro && (userText.toLowerCase().includes("analyze") || userText.toLowerCase().includes("generate") || userText.toLowerCase().includes("dream") || userText.toLowerCase().includes("deep fake"))) {
        query = "ACCESS DENIED: This is a Pro Feature. Explain that Advanced AI Analysis requires a ConnectMe Pro subscription ($9.80) and give instructions on how to upgrade.";
        useGrounding = false; 
        isProFeatureRequest = true;
    }

    const { text, sources } = await callGemini(query, systemPrompt, useGrounding);
    
    let fullResponse = text;
    if (sources.length > 0) {
        fullResponse += "\n\n---\n(Grounded with: " + sources.map(s => s.title).join(", ") + ")";
    }

    setMessages(p => [...p, { role: 'ai', text: fullResponse }]);
    setIsTyping(false);

    if (isProFeatureRequest) {
        onUpgrade(); // Trigger modal if it was a Pro blocked request
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-full max-w-sm h-[600px] bg-gray-900 rounded-2xl shadow-2xl border border-blue-500 flex flex-col z-40 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-700 to-purple-800 p-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <Cpu className="animate-pulse text-cyan-400" /> 
          <div>
            <h3 className="font-bold text-sm">ConnectMe AI {isPro ? 'PRO' : 'LITE'}</h3>
            <p className="text-[10px] text-gray-300">Ultimate AI Assistant</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/50 backdrop-blur-sm custom-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-xl text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-cyan-100 border border-gray-700'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && <div className="text-xs text-cyan-500 animate-pulse ml-2 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Connecting to Neural Net...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-gray-800 border-t border-gray-700 flex gap-2">
        <input 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={isPro ? "Ask Advanced AI..." : "Ask Basic AI (Grounded)..."}
          className="flex-1 bg-gray-900 text-white rounded-full px-4 py-2 text-sm border border-gray-700 focus:border-blue-500 outline-none"
          disabled={isTyping}
        />
        <button 
          onClick={handleSend} 
          className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500 transition"
          disabled={isTyping || !input.trim()}
        >
          <Send size={18} />
        </button>
      </div>
      {!isPro && (
        <button onClick={onUpgrade} className="w-full bg-yellow-500 text-black text-xs font-bold py-1 hover:bg-yellow-400">
          UPGRADE TO UNLOCK FULL AI
        </button>
      )}
    </div>
  );
};


// --- Main App Component ---
const App = () => {
  const [user, setUser] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');
  const [darkMode] = useState(true); 

  // State for Post Creation (AI Integration)
  const [postInput, setPostInput] = useState('');
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  
  // Helper for tab switching
  const handleTabClick = (tab) => {
    // If the tab is a Pro feature, block non-pro users
    if ((tab === 'live' || tab === 'courses') && !isPro) {
        setShowProModal(true);
        return;
    }
    setActiveTab(tab);
  };

  // AI Post Draft Feature
  const handleGeneratePostDraft = async () => {
    if (!postInput.trim()) {
        console.log("Please enter a few keywords or a topic for the post draft in the text area.");
        return;
    }
    
    if (!isPro) {
        console.log("This is a PRO-only feature. Please upgrade to ConnectMe PRO to use AI post drafting.");
        setShowProModal(true);
        return;
    }

    setIsGeneratingPost(true);
    const systemPrompt = "You are a social media post generator for a futuristic network. Create a fun, engaging, and slightly futuristic post (max 200 characters) based on the user's keywords. Include relevant emojis and hashtags. Do not include any introductory phrases like 'Here is your post'.";
    const userQuery = `Keywords/Draft: ${postInput}`;

    const { text } = await callGemini(userQuery, systemPrompt, false);
    
    // Replace the input with the generated text
    setPostInput(text.trim());
    setIsGeneratingPost(false);
  };

  // Auth Listener
  useEffect(() => {
    const initAuth = async () => {
      // In a real Vercel app, you'd only use Google Auth (signInWithPopup).
      // The custom token logic below is for the Canvas environment.
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (e) {
          await signInAnonymously(auth);
        }
      } else {
         await signInAnonymously(auth);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Check if Admin
        if (u.email === ADMIN_EMAIL) {
          setIsAdmin(true);
        }
        
        // Check if Pro (Only run if user is not anonymous)
        if (!u.isAnonymous) {
             const userRef = doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'info');
             // Listener for real-time status update
             const unsubscribePro = onSnapshot(userRef, (snap) => {
                 if (snap.exists() && snap.data().isPro) {
                     setIsPro(true);
                 } else {
                     setIsPro(false); 
                 }
             }, (error) => {
                 console.error("Error listening to Pro status:", error);
                 setIsPro(false);
             });
             return () => unsubscribePro();
        } else {
            setIsPro(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
      // Fallback for Preview Environment if Domain is not whitelisted
      if (error.code === 'auth/unauthorized-domain' || error.code === 'auth/operation-not-allowed') {
        console.log("External login failed. Logging you in as a Guest (Anonymous) for preview.");
        try {
          await signInAnonymously(auth);
        } catch (anonError) {
          console.error(`Guest Login failed: ${anonError.message}`);
        }
      } else {
        console.error(`Login failed: ${error.message}`);
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 w-full max-w-md text-center shadow-2xl">
          <div className="w-20 h-20 bg-blue-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-500/50">
            <Globe className="text-white w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">ConnectMe <span className="text-yellow-400">Ultimate</span></h1>
          <p className="text-gray-300 mb-8">The World's Most Advanced Social Network.</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-white text-gray-900 font-bold py-3 rounded-lg hover:bg-gray-100 transition flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5"/>
            Sign in with Google
          </button>
          <p className="mt-6 text-xs text-gray-500">Created by Akin S. Sokpah, Liberia. Admin: {ADMIN_EMAIL}</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: 'Feed', icon: Home, tab: 'feed', isPro: false },
    { name: 'Live', icon: Tv, tab: 'live', isPro: true },
    { name: 'Courses', icon: BookOpen, tab: 'courses', isPro: false },
    { name: 'Features', icon: Zap, tab: 'features', isPro: false },
  ];

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-black text-white' : 'bg-gray-50 text-gray-900'} font-sans overflow-x-hidden`}>
      
      {/* --- Navbar --- */}
      <nav className={`fixed top-0 w-full z-30 ${darkMode ? 'bg-gray-900/90 border-b border-gray-800' : 'bg-white shadow-sm'} backdrop-blur-md px-4 h-16 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg"><Globe size={20} className="text-white"/></div>
          <span className="text-xl font-bold hidden md:block">ConnectMe</span>
          {isPro && <span className="bg-yellow-500 text-black text-[10px] px-2 py-0.5 rounded font-bold">PRO</span>}
        </div>
        
        {/* Center Nav for Mobile/Tablet */}
        <div className="flex gap-4 md:gap-6 lg:hidden">
            {navItems.map(item => (
                <button 
                    key={item.tab}
                    onClick={() => handleTabClick(item.tab)} 
                    className={`p-2 rounded-full transition relative ${activeTab === item.tab ? 'text-blue-500' : 'text-gray-400 hover:text-white'}`}
                >
                    <item.icon size={20} />
                    {item.isPro && !isPro && <Lock size={10} className="absolute bottom-1 right-1 text-yellow-500"/>}
                </button>
            ))}
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => setShowAI(!showAI)} className="p-2 rounded-full hover:bg-gray-800 relative group">
            <Cpu className={isPro ? "text-yellow-400" : "text-blue-500"} />
          </button>
          
          {!isPro && (
            <button 
              onClick={() => setShowProModal(true)}
              className="bg-gradient-to-r from-yellow-600 to-yellow-400 text-black px-4 py-1.5 rounded-full font-bold text-sm hover:scale-105 transition shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-pulse"
            >
              Get PRO
            </button>
          )}

          <div className="relative group">
            <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.isAnonymous ? 'Guest' : user.displayName || 'User'}`} className="w-9 h-9 rounded-full border border-gray-600 cursor-pointer" />
            <div className="absolute right-0 top-10 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 hidden group-hover:block overflow-hidden">
               <div className="px-4 py-2 border-b border-gray-700">
                 <p className="font-bold text-sm truncate">{user.displayName || (user.isAnonymous ? "Guest User" : "Unknown")}</p>
                 <p className="text-xs text-gray-400">{isPro ? 'Premium Member' : 'Free Member'}</p>
               </div>
               {isAdmin && (
                 <button onClick={() => setShowAdminPanel(true)} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2">
                   <ShieldCheck size={14}/> Admin Panel
                 </button>
               )}
               <button onClick={() => signOut(auth)} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2">
                 <LogOut size={14}/> Sign Out
               </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-16 flex justify-center max-w-[1600px] mx-auto">
        
        {/* --- Sidebar (Desktop) --- */}
        <div className="hidden lg:block w-64 p-4 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar">
          <div className="space-y-1">
            {navItems.map(item => (
                <button 
                    key={item.tab}
                    onClick={() => handleTabClick(item.tab)} 
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${activeTab === item.tab ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-gray-800 text-gray-300'}`}
                >
                    <item.icon size={20}/> 
                    <span>{item.name}</span>
                    {item.isPro && !isPro && <Lock size={12} className="text-yellow-500 absolute right-4"/>}
                </button>
            ))}
            
            <div className="pt-4 mt-4 border-t border-gray-800">
              <p className="px-4 text-xs font-bold text-gray-500 mb-2">UTILITIES</p>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-800 transition">
                <Users size={20}/> <span>Friends</span>
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-800 transition">
                <Store size={20}/> <span>Marketplace</span>
              </button>
            </div>
          </div>
        </div>

        {/* --- Main Content --- */}
        <div className="flex-1 max-w-3xl w-full">
          
          {/* Feed Tab */}
          {activeTab === 'feed' && (
            <div className="p-4">
               <div className={`bg-gray-800/50 p-4 rounded-xl mb-6 border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                 <div className="flex gap-3">
                   <img src={user.photoURL || "https://ui-avatars.com/api/?name=Guest"} className="w-10 h-10 rounded-full"/>
                   <textarea 
                     value={postInput}
                     onChange={(e) => setPostInput(e.target.value)}
                     className="bg-transparent flex-1 outline-none text-white placeholder-gray-500 min-h-[50px] resize-none" 
                     placeholder="Share your world or enter keywords for an AI draft..." 
                   />
                 </div>
                 <div className="flex justify-between mt-4 pt-3 border-t border-gray-700">
                    <div className="flex gap-4 text-gray-400">
                      
                      {/* --- AI Draft Button (Gemini Feature) --- */}
                      <button 
                        onClick={handleGeneratePostDraft}
                        disabled={isGeneratingPost || !isPro}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full transition text-sm font-bold ${isPro ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                        title={isPro ? "Generate Post Draft with AI" : "PRO Feature: Unlock AI Drafting"}
                      >
                        <Zap size={16} /> {isGeneratingPost ? <Loader2 size={16} className="animate-spin"/> : '✨ AI Draft'}
                      </button>

                      <ImageIcon size={20} className="hover:text-green-400 cursor-pointer"/>
                      <Video size={20} className="hover:text-red-400 cursor-pointer"/>
                      <Smile size={20} className="hover:text-yellow-400 cursor-pointer"/>
                    </div>
                    <button 
                      className="bg-blue-600 px-6 py-1 rounded-full font-bold text-sm hover:bg-blue-500"
                      onClick={() => { 
                        if (postInput.trim()) {
                           console.log(`🚀 Post submitted: ${postInput.substring(0, 50)}...`); 
                           setPostInput('');
                        } else {
                           console.log('Post content cannot be empty!');
                        }
                      }}
                    >
                      Post
                    </button>
                 </div>
               </div>

               {/* Dummy Feed Posts */}
               {[1, 2, 3].map(i => (
                 <div key={i} className="bg-gray-800 rounded-xl p-4 mb-4 border border-gray-700">
                   <div className="flex justify-between mb-3">
                     <div className="flex gap-3">
                       <img src={`https://ui-avatars.com/api/?name=User+${i}&background=random`} className="w-10 h-10 rounded-full"/>
                       <div>
                         <h4 className="font-bold flex items-center gap-1">User {i} {isPro && i===1 && <Star size={12} className="text-yellow-500 fill-yellow-500"/>}</h4>
                         <p className="text-xs text-gray-500">2 hrs ago • Liberia</p>
                       </div>
                     </div>
                     <MoreHorizontal className="text-gray-500"/>
                   </div>
                   <p className="mb-3 text-gray-300">
                      {i === 1 ? 
                        `Just generated a post using the ConnectMe AI Draft feature! So fast and futuristic. This network is the best thing since sliced bread! #ConnectMeUltimate #AIDraft`
                      : 
                        `Excited to explore the new 300+ feature vault! Trying to decide between Quantum Encryption and the Dream Synthesis Engine 🤯`
                      }
                   </p>
                   <div className="h-64 bg-gray-900 rounded-lg mb-3 flex items-center justify-center text-gray-600">
                     [Rich Media Content Placeholder]
                   </div>
                   <div className="flex justify-between text-gray-400 border-t border-gray-700 pt-3">
                     <button className="flex items-center gap-2 hover:text-blue-400"><ThumbsUp size={18}/> Like</button>
                     <button className="flex items-center gap-2 hover:text-blue-400"><MessageCircle size={18}/> Comment</button>
                     <button className="flex items-center gap-2 hover:text-blue-400"><Share2 size={18}/> Share</button>
                   </div>
                 </div>
               ))}
            </div>
          )}

          {/* Live Screen Tab */}
          {activeTab === 'live' && <LiveScreen isPro={isPro} onUpgrade={() => setShowProModal(true)} />}

          {/* Courses Tab */}
          {activeTab === 'courses' && <CoursesCatalog isPro={isPro} onUpgrade={() => setShowProModal(true)} />}

          {/* Features Tab */}
          {activeTab === 'features' && (
            <div className="p-4 animate-fade-in">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3 border-b border-gray-700 pb-3">
                <Layers size={28} /> 300+ Advanced Features Vault
              </h2>
              
              {Object.entries(ALL_FEATURES).map(([category, features]) => {
                // Corrected: Resolve the component reference first.
                const CategoryIcon = FEATURE_ICONS[features[0].id.split('-')[0]];

                return (
                    <div key={category} className="mb-8">
                      <h3 className="text-xl font-bold text-cyan-400 mb-3 border-b border-gray-700 pb-2 flex items-center gap-2">
                          <CategoryIcon size={20} /> {category}
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">{features.length} Features Total</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {features.map(feat => (
                          <div 
                            key={feat.id} 
                            className={`p-3 rounded-lg border flex flex-col items-center text-center gap-2 relative overflow-hidden transition 
                              ${feat.isPro && !isPro ? 'bg-gray-800 border-gray-700 opacity-50 cursor-not-allowed' : 'bg-blue-900/10 border-blue-500/30 hover:bg-blue-900/20'}
                            `}
                          >
                            {feat.isPro && !isPro && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Lock className="text-yellow-500" size={20}/></div>}
                            <feat.icon size={24} className={feat.isPro ? "text-yellow-400" : "text-blue-400"}/>
                            <span className={`text-xs font-bold ${feat.isPro && !isPro ? 'text-gray-500' : 'text-white'}`}>{feat.name}</span>
                            {feat.isPro && <span className="text-[10px] text-black bg-yellow-400 px-1 rounded absolute top-1 right-1 font-bold">PRO</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                );
              })}
            </div>
          )}
        </div>

        {/* --- Rightbar (Trending) --- */}
        <div className="hidden xl:block w-80 p-4 sticky top-16 h-screen">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 mb-6">
            <h3 className="font-bold mb-4 text-gray-400">Trending Global Topics</h3>
            <div className="space-y-4">
              <TrendingItem icon={TrendingUp} text="#FutureOfAI" count="1.2M"/>
              <TrendingItem icon={Code} text="#SpatialComputing" count="850K"/>
              <TrendingItem icon={ShoppingBag} text="Global Commerce Hub" count="320K"/>
              <TrendingItem icon={MapPin} text="#MonroviaUpdates" count="15K"/>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-600 to-orange-700 rounded-xl p-4 text-center shadow-lg">
             <Star className="w-8 h-8 mx-auto mb-2 text-white" fill="white" />
             <h3 className="font-bold text-white mb-1">Go Pro Today</h3>
             <p className="text-xs text-white/80 mb-3">Unlock 300+ Features & 4K Streaming.</p>
             <button onClick={() => setShowProModal(true)} className="bg-white text-orange-700 w-full py-2 rounded-lg font-bold text-sm hover:bg-gray-100">Upgrade Now</button>
          </div>
        </div>

      </div>

      {/* --- Modals --- */}
      {showProModal && <ProModal user={user} onClose={() => setShowProModal(false)} />}
      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}
      {showAI && <UltimateAI onClose={() => setShowAI(false)} isPro={isPro} onUpgrade={() => {setShowAI(false); setShowProModal(true)}} />}

    </div>
  );
}

// Helper Components
const TrendingItem = ({ icon: Icon, text, count }) => (
    <div className="flex justify-between items-start text-sm">
        <div className="flex items-center gap-2">
            <Icon size={14} className="text-blue-400"/>
            <p className="font-bold text-white">{text}</p>
        </div>
        <p className="text-xs text-gray-500">{count}</p>
    </div>
);

export default App;
