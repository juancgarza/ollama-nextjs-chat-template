export const runtime = "nodejs";

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | string;
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream: boolean;
}

async function* ollamaChatStream(body: OllamaChatRequest): AsyncGenerator<string> {
  const chatRequest = await fetch('http://localhost:11434/api/chat', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!chatRequest.ok) {
    const errorText = await chatRequest.text();
    console.error('Error chatting with ollama:', errorText);
    throw new Error(`Ollama API error: ${errorText}`);
  }

  const reader = chatRequest.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const chunk = JSON.parse(line);
            if (chunk.message?.content) {
              yield chunk.message.content;
            }
            if (chunk.done) {
              return;
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  try {
    const { messages, model = "llama3" } = await request.json();

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract text content from messages (new AI SDK uses parts array)
    const extractText = (msg: any): string => {
      if (msg.parts && Array.isArray(msg.parts)) {
        return msg.parts
          .filter((part: any) => part.type === "text")
          .map((part: any) => part.text)
          .join("");
      }
      return msg.content || msg.text || "";
    };

    // Prepare messages for Ollama
    // Ollama doesn't support system role, so we convert system messages to user messages
    const ollamaMessages: OllamaChatMessage[] = messages
      .filter((msg: any) => extractText(msg)) // Filter out empty messages
      .map((msg: any) => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: extractText(msg),
      }));

    // Add system message as first user message if no system message exists
    const hasSystemMessage = messages.some((msg: any) => msg.role === 'system');
    if (!hasSystemMessage && ollamaMessages.length > 0) {
      ollamaMessages.unshift({
        role: 'user',
        content: "You are a helpful assistant. Please respond to the user's questions.",
      });
    }

    // Format stream for new AI SDK - it expects SSE format with specific structure
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          let fullText = "";
          for await (const chunk of ollamaChatStream({
            model,
            messages: ollamaMessages,
            stream: true,
          })) {
            fullText += chunk;
            // Format as SSE for new AI SDK
            const sseData = `0:"${chunk.replace(/"/g, '\\"')}"\n`;
            controller.enqueue(encoder.encode(sseData));
          }
          // Send final message
          controller.enqueue(encoder.encode(`d:{"type":"finish"}\n\n`));
          controller.close();
        } catch (error: any) {
          console.error('Streaming error:', error);
          const errorMsg = `e:${JSON.stringify({ error: error.message || "Streaming failed" })}\n\n`;
          controller.enqueue(encoder.encode(errorMsg));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error('Error in chat-stream route:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

