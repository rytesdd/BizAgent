/**
 * Kimi Service - Proxy through backend to avoid exposing API key in frontend
 * 
 * This service calls the backend /api/ai/chat endpoint which handles
 * the actual Kimi API communication securely.
 */

/**
 * Sends a message to the Kimi API via backend proxy.
 * @param {Array<{role: string, content: string}>} messages - Array of message objects
 * @returns {Promise<string>} - The content of the response message
 */
export async function sendMessageToKimi(messages) {
    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: messages,
                // Request JSON mode for structured output
                stream: false
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Backend AI API Error:", response.status, response.statusText, errorData);
            throw new Error(errorData.error || `API Request Failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Backend returns { success: true, data: { content: "..." } }
        if (data.success && data.data?.content) {
            return data.data.content;
        }

        // Fallback: If backend returns raw content
        if (data.content) {
            return data.content;
        }

        // If response format is unexpected
        console.warn("Unexpected response format:", data);
        return JSON.stringify(data);

    } catch (error) {
        console.error("Error calling AI API:", error);
        throw error;
    }
}

/**
 * Runs a connection test to verify integration.
 * Prints the response to the console.
 */
export async function runConnectionTest() {
    console.log("Starting Kimi Connection Test via Backend...");
    try {
        const testMessage = [{ role: "user", content: "你好，请简短回复确认连接成功。" }];
        const response = await sendMessageToKimi(testMessage);
        console.log("Kimi Connection Test Success! Response:", response);
        return response;
    } catch (error) {
        console.error("Kimi Connection Test Failed:", error.message);
        throw error;
    }
}
/**
 * Sends a message to the Persona Chat API (Narrative Engine).
 * @param {Array} messages - Message history
 * @param {string} persona - 'vendor' | 'client'
 * @param {Object} config - { role, goal, tone }
 * @returns {Promise<Object>} - { widgets: [], ... }
 */
export async function sendPersonaChat(messages, persona, config, intent = null) {
    try {
        const response = await fetch('/api/ai/persona-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: messages,
                persona: persona,
                persona_config: config,
                intent: intent
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API Request Failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data) {
            return data.data; // Returns { widgets: [...], _debug: ... }
        }

        throw new Error("Invalid response format");
    } catch (error) {
        console.error("Error calling Persona Chat API:", error);
        throw error;
    }
}
