import React, { memo } from 'react';

export const ChatMessage = memo(({ msg }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
      alignItems: 'flex-start',
      gap: '10px',
    }}
  >
    {msg.type === 'bot' && (
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1D546C 0%, #0C2B4E 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '18px',
        }}
      >
        🤖
      </div>
    )}
    <div
      style={{
        maxWidth: '75%',
        padding: '12px 16px',
        borderRadius: msg.type === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: msg.type === 'user' ? '#667eea' : 'white',
        color: msg.type === 'user' ? 'white' : '#333',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        fontSize: '14px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
      }}
    >
      {msg.text}
    </div>
    {msg.type === 'user' && (
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: '#e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '18px',
        }}
      >
        👤
      </div>
    )}
  </div>
));

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