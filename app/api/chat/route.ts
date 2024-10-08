export const runtime = "nodejs"

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | string;
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream: boolean;
  format?: 'json'
}

interface OllamaChatResponse {
  model: string;
  created_at: Date;
  message: OllamaChatMessage;
  done: boolean;
}

async function ollamaChat(body: OllamaChatRequest): Promise<OllamaChatResponse> {
  const chatRequest = await fetch('http://localhost:11434/api/chat',
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  )
  
  if (!chatRequest.ok) {
    console.error('Error chatting with ollama:', await chatRequest.text());
      return;
  }
  const response = await chatRequest.json();
  
  return response
}

export async function POST(request: Request) {
  const req = await request.json();
  
  // Ensure the incoming request has a messages array
  if (!Array.isArray(req.messages)) {
    return new Response(JSON.stringify({ error: "Invalid messages format" }), { status: 400 });
  }

  // Include the system message if it's not already present
  if (req.messages[0]?.role !== 'system') {
    req.messages.unshift({
      role: 'system',
      content: "You are a helpful assistant"
    });
  }

  const chatRequest = await ollamaChat({
    model: req.model || "llama3",
    messages: req.messages,
    stream: false
  });

  const data = await chatRequest;

  // Return the full conversation history along with the new response
  return new Response(JSON.stringify({
    ...data,
    conversation: [...req.messages, data.message]
  }));
}