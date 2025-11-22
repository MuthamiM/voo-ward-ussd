/**
 * AI Service
 * Handles AI-powered issue categorization using OpenAI
 */

const logger = require('../lib/logger');

let openaiClient = null;

// Initialize OpenAI client
function initializeOpenAI() {
    if (openaiClient) return openaiClient;

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        logger.warn('OpenAI API key not configured. AI features disabled.');
        return null;
    }

    try {
        const { OpenAI } = require('openai');
        openaiClient = new OpenAI({ apiKey });
        logger.info('✅ OpenAI client initialized');
        return openaiClient;
    } catch (err) {
        logger.error('Failed to initialize OpenAI:', err);
        return null;
    }
}

/**
 * Categorize issue using AI
 * @param {string} description - Issue description
 * @returns {Promise<object>} Category, confidence, and priority
 */
async function categorizeIssue(description) {
    const client = initializeOpenAI();
    if (!client) {
        return {
            success: false,
            category: 'Other',
            confidence: 0,
            priority: 'Medium',
            error: 'AI not configured'
        };
    }

    const categories = [
        'Roads & Infrastructure',
        'Water & Sanitation',
        'Security',
        'Health Services',
        'Education',
        'Electricity',
        'Waste Management',
        'Other'
    ];

    const prompt = `You are an AI assistant helping categorize citizen issues for a ward administration in Kenya.

Categories available:
${categories.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Issue description: "${description}"

Analyze this issue and respond with ONLY a JSON object (no markdown, no explanation):
{
  "category": "exact category name from the list",
  "confidence": 0.0 to 1.0,
  "priority": "High" or "Medium" or "Low",
  "reasoning": "brief explanation"
}

Priority guidelines:
- High: Safety risks, health emergencies, affecting many people
- Medium: Important but not urgent, affecting some people
- Low: Minor issues, cosmetic problems`;

    try {
        const response = await client.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 200
        });

        const content = response.choices[0].message.content.trim();

        // Remove markdown code blocks if present
        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const result = JSON.parse(jsonStr);

        logger.info(`AI categorized issue: ${result.category} (${result.confidence})`);

        return {
            success: true,
            category: result.category,
            confidence: result.confidence,
            priority: result.priority,
            reasoning: result.reasoning
        };
    } catch (err) {
        logger.error('AI categorization failed:', err.message);
        return {
            success: false,
            category: 'Other',
            confidence: 0,
            priority: 'Medium',
            error: err.message
        };
    }
}

/**
 * Analyze sentiment and urgency
 * @param {string} text - Issue text
 * @returns {Promise<object>} Sentiment and urgency score
 */
async function analyzeSentiment(text) {
    const client = initializeOpenAI();
    if (!client) {
        return { success: false, sentiment: 'neutral', urgency: 0.5 };
    }

    const prompt = `Analyze the sentiment and urgency of this citizen issue report:

"${text}"

Respond with ONLY a JSON object:
{
  "sentiment": "positive" or "neutral" or "negative" or "urgent",
  "urgency": 0.0 to 1.0,
  "keywords": ["keyword1", "keyword2"]
}`;

    try {
        const response = await client.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 150
        });

        const content = response.choices[0].message.content.trim();
        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const result = JSON.parse(jsonStr);

        return {
            success: true,
            sentiment: result.sentiment,
            urgency: result.urgency,
            keywords: result.keywords
        };
    } catch (err) {
        logger.error('Sentiment analysis failed:', err.message);
        return {
            success: false,
            sentiment: 'neutral',
            urgency: 0.5,
            keywords: []
        };
    }
}

/**
 * Detect duplicate issues
 * @param {string} newIssueDescription - New issue description
 * @param {Array} existingIssues - Array of existing issues
 * @returns {Promise<object>} Potential duplicates
 */
async function detectDuplicates(newIssueDescription, existingIssues) {
    const client = initializeOpenAI();
    if (!client || !existingIssues || existingIssues.length === 0) {
        return { success: false, duplicates: [] };
    }

    // Only check recent issues (last 50)
    const recentIssues = existingIssues.slice(0, 50);

    const prompt = `You are checking if a new issue is a duplicate of existing issues.

New issue: "${newIssueDescription}"

Existing issues:
${recentIssues.map((issue, i) => `${i + 1}. ${issue.ticket}: ${issue.message}`).join('\n')}

Respond with ONLY a JSON object:
{
  "isDuplicate": true or false,
  "duplicateTickets": ["ISS-001", "ISS-002"],
  "similarity": 0.0 to 1.0
}`;

    try {
        const response = await client.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 150
        });

        const content = response.choices[0].message.content.trim();
        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const result = JSON.parse(jsonStr);

        return {
            success: true,
            isDuplicate: result.isDuplicate,
            duplicateTickets: result.duplicateTickets || [],
            similarity: result.similarity
        };
    } catch (err) {
        logger.error('Duplicate detection failed:', err.message);
        return {
            success: false,
            duplicates: []
        };
    }
}

/**
 * Check if AI is enabled
 */
function isAIEnabled() {
    return !!process.env.OPENAI_API_KEY;
}

module.exports = {
    categorizeIssue,
    analyzeSentiment,
    detectDuplicates,
    isAIEnabled
};
