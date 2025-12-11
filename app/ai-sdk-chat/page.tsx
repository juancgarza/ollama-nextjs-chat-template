"use client";

import { useChat } from "@ai-sdk/react";
import Markdown from "react-markdown";
import { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";

interface Model {
  value: string;
  label: string;
  size?: number;
  modifiedAt?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button onClick={handleCopy} className={styles.copyButton} title="Copy message">
      {copied ? "✓" : "📋"}
    </button>
  );
}

function MessageActions({ message }: { message: any }) {
  const getMessageContent = (msg: any) => {
    if (msg.parts && Array.isArray(msg.parts)) {
      return msg.parts
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text)
        .join("");
    }
    return msg.content || "";
  };

  return (
    <div className={styles.messageActions}>
      <CopyButton text={getMessageContent(message)} />
    </div>
  );
}

export default function AISDKChatPage() {
  const [model, setModel] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch available models from Ollama
  useEffect(() => {
    async function fetchModels() {
      try {
        setModelsLoading(true);
        setModelsError(null);
        const response = await fetch("/api/models");
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch models");
        }

        const data = await response.json();
        const fetchedModels: Model[] = data.models || [];
        
        if (fetchedModels.length > 0) {
          setModels(fetchedModels);
          // Set the first model as default if current model is not in the list
          setModel((currentModel) => {
            if (!currentModel || !fetchedModels.some(m => m.value === currentModel)) {
              return fetchedModels[0].value;
            }
            return currentModel;
          });
        } else {
          setModelsError("No models found. Please install models in Ollama.");
        }
      } catch (err) {
        console.error("Error fetching models:", err);
        setModelsError(err instanceof Error ? err.message : "Failed to load models");
        // Fallback to default models if API fails
        setModels([
          { value: "llama3", label: "llama3" },
          { value: "llama3:8b", label: "llama3:8b" },
        ]);
      } finally {
        setModelsLoading(false);
      }
    }

    fetchModels();
  }, []);

  const {
    messages,
    sendMessage,
    status,
    stop,
    regenerate,
    setMessages,
    error,
    clearError,
  } = useChat({
    api: "/api/chat-stream",
    body: {
      model,
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const handleClearChat = () => {
    if (confirm("Are you sure you want to clear all messages?")) {
      setMessages([]);
      clearError();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  const getMessageContent = (message: any) => {
    // New API uses parts array
    if (message.parts && Array.isArray(message.parts)) {
      return message.parts
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text)
        .join("");
    }
    // Fallback for old format
    return message.content || "";
  };

  const totalCharacters = messages.reduce(
    (acc, msg) => acc + getMessageContent(msg).length,
    0
  );
  const messageCount = messages.length;

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div>
              <h1 className={styles.title}>AI SDK Chat</h1>
              <p className={styles.subtitle}>
                Powered by Vercel AI SDK with Ollama
              </p>
            </div>
            <div className={styles.headerActions}>
              <div className={styles.modelSelectWrapper}>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={styles.modelSelect}
                  disabled={isLoading || modelsLoading}
                  title={modelsError ? modelsError : undefined}
                >
                  {modelsLoading ? (
                    <option value="">Loading models...</option>
                  ) : models.length === 0 ? (
                    <option value="">No models available</option>
                  ) : (
                    models.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))
                  )}
                </select>
                {modelsError && (
                  <span className={styles.modelError} title={modelsError}>
                    ⚠️
                  </span>
                )}
              </div>
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className={styles.clearButton}
                  disabled={isLoading}
                  title="Clear chat"
                >
                  🗑️ Clear
                </button>
              )}
            </div>
          </div>
          {messageCount > 0 && (
            <div className={styles.stats}>
              <span>{messageCount} messages</span>
              <span>•</span>
              <span>{totalCharacters.toLocaleString()} characters</span>
            </div>
          )}
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <span>⚠️ {error.message || "An error occurred"}</span>
            <button
              onClick={() => clearError()}
              className={styles.errorClose}
            >
              ×
            </button>
          </div>
        )}

        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateContent}>
                <h2>Start a conversation</h2>
                <p>Type a message below to begin chatting with the AI assistant.</p>
                <div className={styles.suggestions}>
                <button
                  className={styles.suggestionButton}
                  onClick={() => setInput("Explain quantum computing in simple terms")}
                >
                  Explain quantum computing
                </button>
                <button
                  className={styles.suggestionButton}
                  onClick={() => setInput("Write a Python function to calculate fibonacci")}
                >
                  Python fibonacci
                </button>
                <button
                  className={styles.suggestionButton}
                  onClick={() => setInput("What are the best practices for React?")}
                >
                  React best practices
                </button>
                </div>
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`${styles.message} ${
                message.role === "user" ? styles.userMessage : styles.assistantMessage
              }`}
            >
              <div className={styles.messageHeader}>
                <div className={styles.messageRole}>
                  {message.role === "user" ? "You" : "Assistant"}
                </div>
                <MessageActions message={message} />
              </div>
              <div className={styles.messageContent}>
                {message.role === "assistant" ? (
                  <Markdown>{getMessageContent(message)}</Markdown>
                ) : (
                  <p>{getMessageContent(message)}</p>
                )}
              </div>
              {message.role === "assistant" && (
                <button
                  onClick={() => {
                    const messageIndex = messages.indexOf(message);
                    if (messageIndex > 0) {
                      const previousMessages = messages.slice(0, messageIndex);
                      setMessages(previousMessages);
                      regenerate();
                    }
                  }}
                  className={styles.regenerateButton}
                  title="Regenerate response"
                >
                  🔄 Regenerate
                </button>
              )}
            </div>
          ))}
          {status === "streaming" && (
            <div className={`${styles.message} ${styles.assistantMessage}`}>
              <div className={styles.messageRole}>Assistant</div>
              <div className={styles.messageContent}>
                <div className={styles.typingIndicator}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputWrapper}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isLoading && input?.trim()) {
                    handleSubmit(e);
                  }
                }
              }}
              placeholder="Type your message... (Shift+Enter for new line)"
              className={styles.input}
              disabled={isLoading}
              rows={1}
            />
            <div className={styles.formActions}>
              {isLoading && (
                <button
                  type="button"
                  onClick={stop}
                  className={styles.stopButton}
                  title="Stop generation"
                >
                  ⏹️ Stop
                </button>
              )}
              <button
                type="submit"
                className={styles.button}
                disabled={isLoading || !input?.trim()}
              >
                {isLoading ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
          {input && input.length > 0 && (
            <div className={styles.inputStats}>
              {input.length} characters
            </div>
          )}
        </form>
      </div>
    </main>
  );
}

