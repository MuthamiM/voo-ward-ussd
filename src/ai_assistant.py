#!/usr/bin/env python3
"""
VOO Ward AI Assistant - Python Implementation
Advanced conversational AI for VOO Ward Admin Dashboard
Part of comprehensive modernization strategy

Features:
- Natural Language Processing for USSD queries
- Intelligent response generation
- Context-aware conversations
- Multi-language support
- Intent recognition and entity extraction
- Knowledge base integration
"""

import os
import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from enum import Enum
import re

import openai
from transformers import pipeline, AutoTokenizer, AutoModel
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import redis
import pymongo
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ai_assistant.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class IntentType(Enum):
    """Intent classification for user queries"""
    BURSARY_APPLICATION = "bursary_application"
    ISSUE_REPORTING = "issue_reporting"
    INFORMATION_REQUEST = "information_request"
    STATUS_CHECK = "status_check"
    COMPLAINT = "complaint"
    GREETING = "greeting"
    GOODBYE = "goodbye"
    UNKNOWN = "unknown"
    AREA_INQUIRY = "area_inquiry"
    CONTACT_INFO = "contact_info"
    EMERGENCY = "emergency"

class LanguageCode(Enum):
    """Supported languages"""
    ENGLISH = "en"
    AFRIKAANS = "af"
    ZULU = "zu"
    XHOSA = "xh"

@dataclass
class ConversationContext:
    """Context for ongoing conversation"""
    user_id: str
    phone_number: str
    current_intent: Optional[IntentType] = None
    entities: Dict[str, Any] = None
    conversation_history: List[Dict] = None
    language: LanguageCode = LanguageCode.ENGLISH
    session_start: datetime = None
    last_interaction: datetime = None
    
    def __post_init__(self):
        if self.entities is None:
            self.entities = {}
        if self.conversation_history is None:
            self.conversation_history = []
        if self.session_start is None:
            self.session_start = datetime.now()
        if self.last_interaction is None:
            self.last_interaction = datetime.now()

@dataclass
class AIResponse:
    """AI Assistant response structure"""
    text: str
    intent: IntentType
    confidence: float
    entities: Dict[str, Any]
    next_actions: List[str]
    requires_human: bool = False
    language: LanguageCode = LanguageCode.ENGLISH

class KnowledgeBase:
    """Knowledge base for FAQ and information retrieval"""
    
    def __init__(self):
        self.knowledge_data = {}
        self.vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
        self.knowledge_vectors = None
        self.knowledge_texts = []
        self.load_knowledge_base()
    
    def load_knowledge_base(self):
        """Load knowledge base from JSON file"""
        try:
            with open('knowledge_base.json', 'r', encoding='utf-8') as f:
                self.knowledge_data = json.load(f)
            
            # Prepare vectors for similarity search
            self.knowledge_texts = []
            for category, items in self.knowledge_data.items():
                if isinstance(items, list):
                    for item in items:
                        if isinstance(item, dict) and 'question' in item:
                            self.knowledge_texts.append(item['question'])
                        elif isinstance(item, str):
                            self.knowledge_texts.append(item)
            
            if self.knowledge_texts:
                self.knowledge_vectors = self.vectorizer.fit_transform(self.knowledge_texts)
            
            logger.info(f"Knowledge base loaded with {len(self.knowledge_texts)} entries")
            
        except FileNotFoundError:
            logger.warning("Knowledge base file not found, creating default")
            self.create_default_knowledge_base()
        except Exception as e:
            logger.error(f"Error loading knowledge base: {e}")
            self.create_default_knowledge_base()
    
    def create_default_knowledge_base(self):
        """Create default knowledge base"""
        self.knowledge_data = {
            "bursary_info": [
                {
                    "question": "How do I apply for a bursary?",
                    "answer": "To apply for a bursary, dial *120*8001# and follow the prompts. You'll need your ID number and school details."
                },
                {
                    "question": "What documents do I need for bursary application?",
                    "answer": "You need: ID copy, proof of registration, academic transcript, and proof of income (if applicable)."
                },
                {
                    "question": "When will I know about my bursary application status?",
                    "answer": "Bursary applications are reviewed within 30 days. You can check status by dialing *120*8001# and selecting 'Check Status'."
                }
            ],
            "contact_info": [
                {
                    "question": "How can I contact the ward office?",
                    "answer": "Ward office: 021-XXX-XXXX\nEmail: ward@voo.gov.za\nOffice hours: Monday-Friday 8AM-4PM"
                },
                {
                    "question": "Where is the ward office located?",
                    "answer": "VOO Ward Office\n123 Main Street, Cape Town\nBuilding A, Ground Floor"
                }
            ],
            "services": [
                {
                    "question": "What services does the ward offer?",
                    "answer": "Services include: Bursary applications, Issue reporting, Information requests, Document assistance, Community programs"
                },
                {
                    "question": "How do I report a community issue?",
                    "answer": "Dial *120*8001#, select 'Report Issue', and provide details. Include location, description, and urgency level."
                }
            ],
            "areas": [
                {
                    "question": "Which areas does this ward cover?",
                    "answer": "The ward covers multiple areas. Use *120*8001# and select 'Area Information' for specific area details."
                }
            ]
        }
        
        # Save default knowledge base
        try:
            with open('knowledge_base.json', 'w', encoding='utf-8') as f:
                json.dump(self.knowledge_data, f, indent=2, ensure_ascii=False)
            logger.info("Default knowledge base created")
        except Exception as e:
            logger.error(f"Error creating default knowledge base: {e}")
    
    def search_knowledge(self, query: str, top_k: int = 3) -> List[Tuple[str, float]]:
        """Search knowledge base using TF-IDF similarity"""
        if not self.knowledge_vectors or not self.knowledge_texts:
            return []
        
        try:
            # Vectorize query
            query_vector = self.vectorizer.transform([query])
            
            # Calculate similarities
            similarities = cosine_similarity(query_vector, self.knowledge_vectors)[0]
            
            # Get top results
            top_indices = np.argsort(similarities)[::-1][:top_k]
            results = []
            
            for idx in top_indices:
                if similarities[idx] > 0.1:  # Minimum similarity threshold
                    results.append((self.knowledge_texts[idx], similarities[idx]))
            
            return results
            
        except Exception as e:
            logger.error(f"Error searching knowledge base: {e}")
            return []
    
    def get_answer(self, question: str) -> Optional[str]:
        """Get answer for a specific question"""
        for category, items in self.knowledge_data.items():
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict) and item.get('question', '').lower() == question.lower():
                        return item.get('answer')
        return None

class IntentClassifier:
    """Intent classification using NLP"""
    
    def __init__(self):
        self.intent_patterns = {
            IntentType.BURSARY_APPLICATION: [
                r"\b(bursary|scholarship|funding|financial aid|study help)\b",
                r"\b(apply|application|register)\b.*\b(bursary|funding)\b",
                r"\b(school|university|college)\b.*\b(money|help|assistance)\b"
            ],
            IntentType.ISSUE_REPORTING: [
                r"\b(problem|issue|complaint|report)\b",
                r"\b(broken|damaged|not working|faulty)\b",
                r"\b(water|electricity|road|street light|garbage)\b.*\b(problem|issue)\b",
                r"\b(report)\b.*\b(problem|issue|fault)\b"
            ],
            IntentType.STATUS_CHECK: [
                r"\b(status|check|progress|update)\b",
                r"\b(application)\b.*\b(status|progress)\b",
                r"\b(where is my|what happened to my|how is my)\b"
            ],
            IntentType.INFORMATION_REQUEST: [
                r"\b(information|info|details|help|how)\b",
                r"\b(what is|how do|where can|when will)\b",
                r"\b(explain|tell me|show me)\b"
            ],
            IntentType.AREA_INQUIRY: [
                r"\b(area|location|address|where)\b",
                r"\b(which area|what area|area code)\b",
                r"\b(boundaries|coverage|district)\b"
            ],
            IntentType.CONTACT_INFO: [
                r"\b(contact|phone|call|office|address)\b",
                r"\b(speak to|talk to|reach|get hold)\b",
                r"\b(office hours|when open|opening times)\b"
            ],
            IntentType.EMERGENCY: [
                r"\b(emergency|urgent|critical|help)\b",
                r"\b(immediately|right now|asap|quickly)\b",
                r"\b(fire|ambulance|police|danger)\b"
            ],
            IntentType.GREETING: [
                r"\b(hello|hi|hey|good morning|good afternoon|greetings)\b",
                r"\b(start|begin|menu|options)\b"
            ],
            IntentType.GOODBYE: [
                r"\b(bye|goodbye|exit|quit|stop|end|finish|thanks|thank you)\b",
                r"\b(that's all|nothing else|i'm done)\b"
            ]
        }
        
        # Compile regex patterns
        self.compiled_patterns = {}
        for intent, patterns in self.intent_patterns.items():
            self.compiled_patterns[intent] = [
                re.compile(pattern, re.IGNORECASE) for pattern in patterns
            ]
    
    def classify_intent(self, text: str) -> Tuple[IntentType, float]:
        """Classify intent from text"""
        text = text.lower().strip()
        
        # Score each intent
        intent_scores = {}
        for intent, patterns in self.compiled_patterns.items():
            score = 0
            for pattern in patterns:
                matches = len(pattern.findall(text))
                if matches > 0:
                    score += matches * 0.3  # Base score per match
                    # Bonus for exact matches
                    if pattern.search(text):
                        score += 0.2
            intent_scores[intent] = score
        
        # Find best intent
        if intent_scores:
            best_intent = max(intent_scores.items(), key=lambda x: x[1])
            if best_intent[1] > 0.2:  # Minimum confidence threshold
                return best_intent[0], min(best_intent[1], 1.0)
        
        return IntentType.UNKNOWN, 0.0

class EntityExtractor:
    """Extract entities from user input"""
    
    def __init__(self):
        # Common entity patterns
        self.patterns = {
            'phone_number': re.compile(r'\b(?:\+27|0)(?:6[0-9]|7[0-9]|8[0-9])\d{7}\b'),
            'id_number': re.compile(r'\b\d{13}\b'),
            'amount': re.compile(r'\b(?:R\s*)?(\d+(?:,\d{3})*(?:\.\d{2})?)\b'),
            'date': re.compile(r'\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{2,4})\b'),
            'area_code': re.compile(r'\b[A-Z]{2,3}\d{2,4}\b'),
            'email': re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
        }
    
    def extract_entities(self, text: str) -> Dict[str, Any]:
        """Extract entities from text"""
        entities = {}
        
        for entity_type, pattern in self.patterns.items():
            matches = pattern.findall(text)
            if matches:
                entities[entity_type] = matches[0] if len(matches) == 1 else matches
        
        return entities

class VOOWardAIAssistant:
    """Main AI Assistant class"""
    
    def __init__(self):
        self.knowledge_base = KnowledgeBase()
        self.intent_classifier = IntentClassifier()
        self.entity_extractor = EntityExtractor()
        
        # Initialize Redis for session management
        self.redis_client = None
        self.init_redis()
        
        # Initialize OpenAI if API key available
        self.openai_client = None
        self.init_openai()
        
        # Response templates
        self.response_templates = self.load_response_templates()
        
        logger.info("VOO Ward AI Assistant initialized")
    
    def init_redis(self):
        """Initialize Redis connection"""
        try:
            redis_host = os.getenv('REDIS_HOST', 'localhost')
            redis_port = int(os.getenv('REDIS_PORT', 6379))
            redis_password = os.getenv('REDIS_PASSWORD')
            
            self.redis_client = redis.Redis(
                host=redis_host,
                port=redis_port,
                password=redis_password,
                decode_responses=True
            )
            
            # Test connection
            self.redis_client.ping()
            logger.info("Redis connection established")
            
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            self.redis_client = None
    
    def init_openai(self):
        """Initialize OpenAI client"""
        api_key = os.getenv('OPENAI_API_KEY')
        if api_key:
            openai.api_key = api_key
            self.openai_client = openai
            logger.info("OpenAI client initialized")
        else:
            logger.warning("OpenAI API key not found")
    
    def load_response_templates(self) -> Dict[str, Dict]:
        """Load response templates for different intents"""
        return {
            IntentType.GREETING.value: {
                "en": "Hello! Welcome to VOO Ward services. How can I assist you today?\\n\\n1. Bursary Application\\n2. Report Issue\\n3. Check Status\\n4. Get Information",
                "af": "Hallo! Welkom by VOO Wyk dienste. Hoe kan ek jou vandag help?",
                "zu": "Sawubona! Wamukelekile kwiinkonzo zeVOO Ward. Ndingakunceda njani namhlanje?",
                "xh": "Molo! Wamkelekile kwiinkonzo zeVOO Ward. Ndingakunceda njani namhlanje?"
            },
            IntentType.BURSARY_APPLICATION.value: {
                "en": "I can help you with bursary applications. To apply, you'll need:\\n\\n1. ID document\\n2. Proof of registration\\n3. Academic records\\n\\nWould you like me to guide you through the application process?",
                "af": "Ek kan jou help met beurse aansoeke...",
                "zu": "Ngingakusiza ngesicelo sezibonelelo zemfundo...",
                "xh": "Ndingakunceda ngesicelo sezibonelelo zemfundo..."
            },
            IntentType.ISSUE_REPORTING.value: {
                "en": "I'm sorry to hear about the issue. To report it properly, please provide:\\n\\n1. Location/Area\\n2. Type of problem\\n3. Urgency level\\n\\nWhat type of issue would you like to report?",
                "af": "Jammer om van die probleem te hoor...",
                "zu": "Ngiyaxolisa ngenkinga...",
                "xh": "Ndiyaxolisa ngengxaki..."
            },
            IntentType.STATUS_CHECK.value: {
                "en": "I can help you check your application status. Please provide your reference number or ID number, and I'll look up your information.",
                "af": "Ek kan jou help om jou aansoek status na te gaan...",
                "zu": "Ngingakusiza ukuhlola isimo sakho sesicelo...",
                "xh": "Ndingakunceda ukukhangela isimo sesicelo sakho..."
            },
            IntentType.UNKNOWN.value: {
                "en": "I'm not sure I understand. Could you please rephrase your question? I can help with:\\n\\n• Bursary applications\\n• Issue reporting\\n• Status checks\\n• General information",
                "af": "Ek is nie seker ek verstaan nie...",
                "zu": "Angiqiniseki ukuthi ngiyaqonda...",
                "xh": "Andiqiniseki ukuba ndiyaqonda..."
            }
        }
    
    async def process_message(self, user_input: str, context: ConversationContext) -> AIResponse:
        """Process user message and generate response"""
        try:
            # Update context
            context.last_interaction = datetime.now()
            context.conversation_history.append({
                "timestamp": datetime.now().isoformat(),
                "role": "user",
                "content": user_input
            })
            
            # Extract entities
            entities = self.entity_extractor.extract_entities(user_input)
            context.entities.update(entities)
            
            # Classify intent
            intent, confidence = self.intent_classifier.classify_intent(user_input)
            context.current_intent = intent
            
            # Generate response based on intent
            response_text = await self.generate_response(intent, user_input, context)
            
            # Determine next actions
            next_actions = self.get_next_actions(intent, entities)
            
            # Check if human intervention needed
            requires_human = self.requires_human_intervention(intent, confidence, entities)
            
            # Create response
            response = AIResponse(
                text=response_text,
                intent=intent,
                confidence=confidence,
                entities=entities,
                next_actions=next_actions,
                requires_human=requires_human,
                language=context.language
            )
            
            # Add to conversation history
            context.conversation_history.append({
                "timestamp": datetime.now().isoformat(),
                "role": "assistant",
                "content": response_text,
                "intent": intent.value,
                "confidence": confidence
            })
            
            # Save context to Redis
            await self.save_context(context)
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return AIResponse(
                text="I'm experiencing technical difficulties. Please try again or contact support.",
                intent=IntentType.UNKNOWN,
                confidence=0.0,
                entities={},
                next_actions=["contact_support"],
                requires_human=True
            )
    
    async def generate_response(self, intent: IntentType, user_input: str, context: ConversationContext) -> str:
        """Generate appropriate response based on intent"""
        
        # Check if we have a template response
        template_key = intent.value
        if template_key in self.response_templates:
            template = self.response_templates[template_key].get(
                context.language.value, 
                self.response_templates[template_key]["en"]
            )
            
            # For information requests, try knowledge base first
            if intent == IntentType.INFORMATION_REQUEST:
                kb_results = self.knowledge_base.search_knowledge(user_input)
                if kb_results:
                    best_match = kb_results[0]
                    if best_match[1] > 0.5:  # High similarity
                        answer = self.knowledge_base.get_answer(best_match[0])
                        if answer:
                            return answer
            
            # Use OpenAI for enhanced responses if available
            if self.openai_client and intent in [IntentType.INFORMATION_REQUEST, IntentType.UNKNOWN]:
                enhanced_response = await self.get_openai_response(user_input, context)
                if enhanced_response:
                    return enhanced_response
            
            return template
        
        # Fallback response
        return self.response_templates[IntentType.UNKNOWN.value][context.language.value]
    
    async def get_openai_response(self, user_input: str, context: ConversationContext) -> Optional[str]:
        """Get enhanced response from OpenAI"""
        try:
            # Prepare conversation history for context
            messages = [
                {
                    "role": "system", 
                    "content": "You are a helpful assistant for VOO Ward services. Provide accurate, helpful information about bursaries, issue reporting, and community services. Keep responses concise and actionable."
                }
            ]
            
            # Add recent conversation history
            for msg in context.conversation_history[-5:]:  # Last 5 messages
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
            
            # Add current message
            messages.append({
                "role": "user",
                "content": user_input
            })
            
            response = await self.openai_client.ChatCompletion.acreate(
                model="gpt-3.5-turbo",
                messages=messages,
                max_tokens=200,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return None
    
    def get_next_actions(self, intent: IntentType, entities: Dict[str, Any]) -> List[str]:
        """Determine next actions based on intent and entities"""
        actions = []
        
        if intent == IntentType.BURSARY_APPLICATION:
            if 'id_number' not in entities:
                actions.append("collect_id_number")
            else:
                actions.append("start_bursary_application")
        
        elif intent == IntentType.ISSUE_REPORTING:
            if 'area_code' not in entities:
                actions.append("collect_location")
            actions.append("create_issue_report")
        
        elif intent == IntentType.STATUS_CHECK:
            if 'id_number' not in entities:
                actions.append("collect_reference")
            else:
                actions.append("check_application_status")
        
        elif intent == IntentType.EMERGENCY:
            actions.append("escalate_to_emergency_services")
            actions.append("notify_ward_office")
        
        return actions
    
    def requires_human_intervention(self, intent: IntentType, confidence: float, entities: Dict[str, Any]) -> bool:
        """Determine if human intervention is required"""
        # Low confidence responses need human review
        if confidence < 0.3:
            return True
        
        # Emergency situations need immediate human attention
        if intent == IntentType.EMERGENCY:
            return True
        
        # Complex complaints might need human review
        if intent == IntentType.COMPLAINT and confidence < 0.7:
            return True
        
        return False
    
    async def save_context(self, context: ConversationContext):
        """Save conversation context to Redis"""
        if not self.redis_client:
            return
        
        try:
            key = f"ai_context:{context.user_id}"
            context_data = asdict(context)
            
            # Convert datetime objects to strings
            context_data['session_start'] = context.session_start.isoformat()
            context_data['last_interaction'] = context.last_interaction.isoformat()
            context_data['current_intent'] = context.current_intent.value if context.current_intent else None
            context_data['language'] = context.language.value
            
            await self.redis_client.setex(
                key, 
                3600,  # 1 hour TTL
                json.dumps(context_data, default=str)
            )
            
        except Exception as e:
            logger.error(f"Error saving context: {e}")
    
    async def load_context(self, user_id: str) -> Optional[ConversationContext]:
        """Load conversation context from Redis"""
        if not self.redis_client:
            return None
        
        try:
            key = f"ai_context:{user_id}"
            context_data = await self.redis_client.get(key)
            
            if context_data:
                data = json.loads(context_data)
                
                # Convert string timestamps back to datetime
                data['session_start'] = datetime.fromisoformat(data['session_start'])
                data['last_interaction'] = datetime.fromisoformat(data['last_interaction'])
                data['current_intent'] = IntentType(data['current_intent']) if data['current_intent'] else None
                data['language'] = LanguageCode(data['language'])
                
                return ConversationContext(**data)
            
        except Exception as e:
            logger.error(f"Error loading context: {e}")
        
        return None

# Flask API for integration
app = Flask(__name__)
CORS(app)

# Initialize AI Assistant
ai_assistant = VOOWardAIAssistant()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    })

@app.route('/chat', methods=['POST'])
async def chat_endpoint():
    """Main chat endpoint"""
    try:
        data = request.get_json()
        user_input = data.get('message', '').strip()
        user_id = data.get('user_id')
        phone_number = data.get('phone_number')
        language = data.get('language', 'en')
        
        if not user_input or not user_id:
            return jsonify({
                "error": "Missing required fields: message, user_id"
            }), 400
        
        # Load or create context
        context = await ai_assistant.load_context(user_id)
        if not context:
            context = ConversationContext(
                user_id=user_id,
                phone_number=phone_number,
                language=LanguageCode(language)
            )
        
        # Process message
        response = await ai_assistant.process_message(user_input, context)
        
        return jsonify({
            "response": response.text,
            "intent": response.intent.value,
            "confidence": response.confidence,
            "entities": response.entities,
            "next_actions": response.next_actions,
            "requires_human": response.requires_human,
            "language": response.language.value
        })
        
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        return jsonify({
            "error": "Internal server error",
            "message": "I'm experiencing technical difficulties. Please try again."
        }), 500

@app.route('/context/<user_id>', methods=['GET'])
async def get_context(user_id: str):
    """Get conversation context for a user"""
    try:
        context = await ai_assistant.load_context(user_id)
        if context:
            return jsonify({
                "user_id": context.user_id,
                "current_intent": context.current_intent.value if context.current_intent else None,
                "language": context.language.value,
                "session_duration": str(datetime.now() - context.session_start),
                "interaction_count": len(context.conversation_history),
                "entities": context.entities
            })
        else:
            return jsonify({"error": "Context not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Run the Flask app
    app.run(
        host=os.getenv('AI_HOST', '0.0.0.0'),
        port=int(os.getenv('AI_PORT', 5000)),
        debug=os.getenv('DEBUG', 'False').lower() == 'true'
    )