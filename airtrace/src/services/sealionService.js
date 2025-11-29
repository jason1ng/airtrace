export async function fetchSealionResponse(userMessage) {
    const typingIndicator = { type: 'bot', text: 'Typing...' };

    try {
        const response = await fetch('https://api.sea-lion.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'accept': 'text/plain',
                'Content-Type': 'application/json',
                Authorization: 'Bearer sk-8XFMP2T9nGIybi6Vkcs-Gg',
            },
            body: JSON.stringify({
                model: 'aisingapore/Gemma-SEA-LION-v4-27B-IT',
                messages: [
                    {
                        role: 'user',
                        content: userMessage,
                    },
                ],
                chat_template_kwargs: {
                    thinking_mode: 'off',
                },
                cache: {
                    'no-cache': true,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return { success: true, reply: data.choices[0].message.content };
    } catch (error) {
        console.error('Error communicating with Sealion API:', error);
        return { success: false, reply: 'Sorry, something went wrong. Please try again later.' };
    }
}