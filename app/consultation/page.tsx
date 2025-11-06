"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { v4 as uuidv4 } from "uuid"
import Markdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  AlertCircle,
  Brain,
  User,
  Bot,
  Send,
  Heart,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react"

// --- API Endpoints ---
const API_BASE_URL = "https://aravsaxena884-consult.hf.space";

const CONSULTATION_URL = `${API_BASE_URL}/legal-consultation`
const HISTORY_URL = `${API_BASE_URL}/get-session-history`

// --- Types ---
type Message = {
  id: string
  type: "user" | "ai"
  content: string
  timestamp: Date
  isTyping?: boolean
  displayedContent?: string
}

type Session = {
  id: string
  title: string
}

// Type for the response from /legal-consultation
type ConsultationResponse = {
  response: string // This is the JSON string of {consultation: "...", key_terms: "..."}
  history: string[] // This is just a list of content strings, not used for loading
}

// Type for the response from /get-session-history
// This matches the Pydantic model { "history": [ ... ] }
type HistoryResponse = {
  history: {
    type: "human" | "ai" | "system"
    data: {
      content: string
      additional_kwargs?: Record<string, any>
    }
  }[]
}

// --- LocalStorage Keys ---
const SESSION_LIST_KEY = "chat_session_list"
const CURRENT_SESSION_ID_KEY = "current_chat_session_id"

export default function ConsultationPage() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessionList, setSessionList] = useState<Session[]>([])
  const [isTypingActive, setIsTypingActive] = useState(false)

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // --- Session Management ---

  // Load sessions from localStorage on initial render
  useEffect(() => {
    try {
      const storedList = localStorage.getItem(SESSION_LIST_KEY)
      const sessions: Session[] = storedList ? JSON.parse(storedList) : []
      setSessionList(sessions)

      const storedId = localStorage.getItem(CURRENT_SESSION_ID_KEY)
      const validId = sessions.find((s) => s.id === storedId)

      if (validId) {
        loadSession(storedId!)
      } else if (sessions.length > 0) {
        // Load the most recent session
        loadSession(sessions[0].id)
      } else {
        // No sessions exist, create a new one
        handleNewChat()
      }
    } catch (err) {
      console.error("Failed to load from localStorage:", err)
      handleNewChat()
    }
  }, [])

  // Save session list to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessionList))
    } catch (err) {
      console.error("Failed to save session list:", err)
    }
  }, [sessionList])

  // Save current session ID
  const setActiveSession = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    try {
      localStorage.setItem(CURRENT_SESSION_ID_KEY, sessionId)
    } catch (err) {
      console.error("Failed to save current session ID:", err)
    }
  }

  // --- Core Chat Functions ---

  const handleNewChat = () => {
    if (isTypingActive) return

    const newId = uuidv4()
    const newSession: Session = { id: newId, title: "New Chat" }

    setSessionList((prev) => [newSession, ...prev])
    setActiveSession(newId)
    setMessages([])
    setError(null)
    setLoading(false)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const loadSession = useCallback(async (sessionId: string) => {
    if (isTypingActive) return
    if (sessionId === currentSessionId && messages.length > 0) return // Already loaded

    setActiveSession(sessionId)
    setMessages([])
    setError(null)
    setLoading(true)

    try {
      const response = await fetch(`${HISTORY_URL}/${sessionId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch history")
      }
      const data: HistoryResponse = await response.json()

      // Convert backend history format to frontend Message format
      const loadedMessages: Message[] = data.history.map((msg) => ({
        id: uuidv4(),
        type: msg.type === "human" ? "user" : "ai",
        // The backend /legal-consultation saves the *stringified JSON* as the AI message
        // The user message is saved as plain text.
        content:
          msg.type === "ai"
            ? JSON.parse(msg.data.content).consultation
            : msg.data.content,
        timestamp: new Date(),
        displayedContent:
          msg.type === "ai"
            ? JSON.parse(msg.data.content).consultation
            : msg.data.content,
      }))

      setMessages(loadedMessages)
    } catch (err) {
      console.error("Failed to load session:", err)
      setError("Failed to load chat history. Please try again.")
      // If loading fails, create a new chat to avoid being stuck
      if (sessionList.length === 0) {
        handleNewChat()
      }
    } finally {
      setLoading(false)
    }
  }, [currentSessionId, isTypingActive, messages.length, sessionList.length])

  const handleDeleteSession = (
    e: React.MouseEvent,
    sessionIdToDelete: string,
  ) => {
    e.stopPropagation() // Prevent click from loading the session

    setSessionList((prev) => prev.filter((s) => s.id !== sessionIdToDelete))

    if (currentSessionId === sessionIdToDelete) {
      const remainingSessions = sessionList.filter(
        (s) => s.id !== sessionIdToDelete,
      )
      if (remainingSessions.length > 0) {
        loadSession(remainingSessions[0].id)
      } else {
        handleNewChat()
      }
    }
  }

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight
      }
    }
    const timeoutId = setTimeout(scrollToBottom, 100)
    return () => clearTimeout(timeoutId)
  }, [messages, isTypingActive])

  // Cleanup function
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Optimized typing effect
  const simulateTyping = useCallback(
    (messageId: string, fullContent: string) => {
      if (isTypingActive) return

      setIsTypingActive(true)
      const words = fullContent.split(" ")
      let currentWordIndex = 0

      const typeNextBatch = () => {
        if (currentWordIndex >= words.length) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, isTyping: false, displayedContent: fullContent }
                : msg,
            ),
          )
          setIsTypingActive(false)
          return
        }

        const batchSize = Math.min(2, words.length - currentWordIndex)
        const wordsToShow = words.slice(0, currentWordIndex + batchSize).join(" ")

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, displayedContent: wordsToShow } : msg,
          ),
        )

        currentWordIndex += batchSize
        typingTimeoutRef.current = setTimeout(typeNextBatch, 100)
      }

      typeNextBatch()
    },
    [isTypingActive],
  )

  // API consultation handler
  const handleConsult = useCallback(async () => {
    if (!query.trim() || loading || isTypingActive || !currentSessionId) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    const userMessage: Message = {
      id: uuidv4(),
      type: "user",
      content: query.trim(),
      timestamp: new Date(),
      displayedContent: query.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    const currentQuery = query.trim()
    setQuery("")
    setLoading(true)
    setError(null)

    // Update session title with first message
    if (messages.length === 0) {
      const newTitle =
        currentQuery.length > 30
          ? currentQuery.substring(0, 30) + "..."
          : currentQuery
      setSessionList((prev) =>
        prev.map((s) =>
          s.id === currentSessionId ? { ...s, title: newTitle } : s,
        ),
      )
    }

    try {
      const response = await fetch(CONSULTATION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: currentQuery,
          user_id: currentSessionId, // Use the active session ID
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`API response error: ${errorData}`)
      }

      const data: ConsultationResponse = await response.json()

      // The 'response' field from the backend is a *stringified JSON*
      // We need to parse it to get the actual consultation text
      const parsedAiResponse = JSON.parse(data.response)
      const consultationText =
        parsedAiResponse.consultation || "I'm not sure how to respond to that."

      const aiMessage: Message = {
        id: uuidv4(),
        type: "ai",
        content: consultationText, // Store the clean text
        timestamp: new Date(),
        isTyping: true,
        displayedContent: "",
      }

      setMessages((prev) => [...prev, aiMessage])
      simulateTyping(aiMessage.id, consultationText)
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message || "Failed to get response. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }, [
    query,
    loading,
    isTypingActive,
    currentSessionId,
    messages.length,
    simulateTyping,
  ])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleConsult()
    }
  }

  // --- Render ---
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #fafaf8 0%, #f5f3f0 100%)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1.5rem 2rem",
          borderBottom: "1px solid #e0d9d3",
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #2d8a8a 0%, #4da9a0 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Heart style={{ color: "white", width: "1.25rem", height: "1.25rem" }} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0, color: "#1a1a1a" }}>Dashing BOT</h1>
              <p style={{ fontSize: "0.875rem", color: "#7a7a7a", margin: "0.25rem 0 0 0" }}>
                Your supportive wellness companion
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          maxWidth: "1200px",
          width: "100%",
          margin: "0 auto",
          gap: "1.5rem",
          padding: "1.5rem 2rem",
          overflow: "hidden", // Prevent page-level scroll
        }}
      >
        {/* === NEW CHAT HISTORY SIDEBAR === */}
        <div
          style={{
            width: "280px",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            flexShrink: 0,
          }}
        >
          <Button
            onClick={handleNewChat}
            disabled={isTypingActive}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem 1rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              background: "#2d8a8a",
              color: "white",
              borderRadius: "0.875rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            New Chat
            <Plus style={{ width: "1.1rem", height: "1.1rem" }} />
          </Button>
          <Card
            style={{
              flex: 1,
              border: "1px solid #e0d9d3",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              borderRadius: "1.25rem",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <CardContent
              style={{
                padding: "0.75rem",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {sessionList.length === 0 ? (
                <p style={{ textAlign: "center", color: "#7a7a7a", fontSize: "0.875rem", padding: "1rem" }}>
                  No chat history
                </p>
              ) : (
                sessionList.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    disabled={isTypingActive}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "0.875rem",
                      border: "none",
                      background:
                        currentSessionId === session.id ? "#f0ede8" : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.875rem",
                      color: "#1a1a1a",
                      transition: "all 0.2s ease",
                      fontWeight: currentSessionId === session.id ? 600 : 400,
                      width: "100%",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (currentSessionId !== session.id)
                        e.currentTarget.style.background = "#f5f3f0"
                    }}
                    onMouseLeave={(e) => {
                      if (currentSessionId !== session.id)
                        e.currentTarget.style.background = "transparent"
                    }}
                  >
                    <MessageSquare style={{ width: "1rem", height: "1rem", color: "#7a7a7a", flexShrink: 0 }} />
                    <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {session.title}
                    </span>
                    <Trash2
                      style={{
                        width: "0.9rem",
                        height: "0.9rem",
                        color: "#9a9a9a",
                        flexShrink: 0,
                        visibility: "hidden", // Hide by default
                      }}
                      className="delete-icon"
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#dc2626"
                        e.currentTarget.style.visibility = "visible"
                      }}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#9a9a9a")}
                    />
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* === CHAT AREA === */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            minWidth: 0, // Prevents flexbox overflow
          }}
        >
          {/* Messages Container */}
          <div
            ref={messagesContainerRef}
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              padding: "1rem",
              background: "white",
              borderRadius: "1.25rem",
              border: "1px solid #e0d9d3",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            {/* Welcome State */}
            {messages.length === 0 && !loading && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  gap: "1.5rem",
                  padding: "2rem 1rem",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: "4rem",
                    height: "4rem",
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, #2d8a8a 0%, #4da9a0 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Brain style={{ width: "2rem", height: "2rem", color: "white" }} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 0.5rem 0", color: "#1a1a1a" }}>
                    Welcome to Dashing BOT
                  </h2>
                  <p style={{ fontSize: "0.95rem", color: "#7a7a7a", margin: 0, lineHeight: "1.5" }}>
                    I'm here to listen and support you. Share what's on
                    your mind, or start a new chat.
                  </p>
                </div>
              </div>
            )}

            {/* Loading Spinner for History */}
            {loading && messages.length === 0 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
                <Loader2 style={{ width: "2rem", height: "2rem", color: "#2d8a8a", animation: "spin 1s linear infinite" }} />
              </div>
            )}

            {/* Messages */}
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  justifyContent: message.type === "user" ? "flex-end" : "flex-start",
                  gap: "0.75rem",
                }}
              >
                {message.type === "ai" && (
                  <div
                    style={{
                      width: "2rem",
                      height: "2rem",
                      borderRadius: "50%",
                      background: "#e8f4f2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Bot style={{ width: "1.25rem", height: "1.25rem", color: "#2d8a8a" }} />
                  </div>
                )}
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "0.875rem 1.125rem",
                    borderRadius: "1rem",
                    background: message.type === "user" ? "#2d8a8a" : "#f0ede8",
                    color: message.type === "user" ? "white" : "#1a1a1a",
                    fontSize: "0.95rem",
                    lineHeight: "1.5",
                    wordWrap: "break-word",
                  }}
                >
                  {message.isTyping && !message.displayedContent ? (
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <div
                        style={{
                          width: "0.5rem",
                          height: "0.5rem",
                          borderRadius: "50%",
                          background: "#7a7a7a",
                          animation: "pulse 1.5s ease-in-out infinite",
                        }}
                      />
                      <div
                        style={{
                          width: "0.5rem",
                          height: "0.5rem",
                          borderRadius: "50%",
                          background: "#7a7a7a",
                          animation: "pulse 1.5s ease-in-out infinite 0.2s",
                        }}
                      />
                      <div
                        style={{
                          width: "0.5rem",
                          height: "0.5rem",
                          borderRadius: "50%",
                          background: "#7a7a7a",
                          animation: "pulse 1.5s ease-in-out infinite 0.4s",
                        }}
                      />
                    </div>
                  ) : message.type === "ai" ? (
                    <Markdown
                      components={{
                        p: ({ node, ...props }) => <p style={{ margin: "0.5rem 0" }} {...props} />,
                        ul: ({ node, ...props }) => <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }} {...props} />,
                        ol: ({ node, ...props }) => <ol style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }} {...props} />,
                        li: ({ node, ...props }) => <li style={{ margin: "0.25rem 0" }} {...props} />,
                        a: ({ node, ...props }) => <a style={{ color: "#2d8a8a", textDecoration: "underline", fontWeight: 500 }} {...props} />,
                      }}
                    >
                      {message.displayedContent || message.content}
                    </Markdown>
                  ) : (
                    message.displayedContent || message.content
                  )}
                </div>
                {message.type === "user" && (
                  <div
                    style={{
                      width: "2rem",
                      height: "2rem",
                      borderRadius: "50%",
                      background: "#2d8a8a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <User style={{ width: "1.25rem", height: "1.25rem", color: "white" }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert style={{ borderRadius: "0.875rem", border: "1px solid #fecaca", background: "#fef2f2" }}>
              <AlertCircle style={{ width: "1rem", height: "1rem", color: "#dc2626" }} />
              <AlertDescription style={{ color: "#7a1a1a" }}>{error}</AlertDescription>
            </Alert>
          )}

          {/* Input Area */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              background: "white",
              padding: "1rem",
              borderRadius: "1.25rem",
              border: "1px solid #e0d9d3",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <Textarea
              placeholder="Share your thoughts or ask for support..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading || isTypingActive}
              style={{
                flex: 1,
                minHeight: "3rem",
                maxHeight: "6rem",
                padding: "0.75rem",
                border: "1px solid #e0d9d3",
                borderRadius: "0.75rem",
                fontSize: "0.95rem",
                color: "#1a1a1a",
                fontFamily: "inherit",
                resize: "none",
                backgroundColor: "#fafaf8",
                transition: "border-color 0.2s",
              }}
            />
            <Button
              onClick={handleConsult}
              disabled={loading || isTypingActive || !query.trim()}
              style={{
                width: "3.5rem",
                height: "auto",
                alignSelf: "flex-end",
                background:
                  loading || isTypingActive || !query.trim() ? "#d1d5db" : "#2d8a8a",
                color: "white",
                borderRadius: "0.75rem",
                cursor:
                  loading || isTypingActive || !query.trim()
                    ? "not-allowed"
                    : "pointer",
                border: "none",
                padding: "0.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              {loading && !isTypingActive ? ( // Show loader only on network request
                <Loader2 style={{ width: "1.25rem", height: "1.25rem", animation: "spin 1s linear infinite" }} />
              ) : (
                <Send style={{ width: "1.25rem", height: "1.25rem" }} />
              )}
            </Button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        /* Show delete icon on hover */
        button:hover .delete-icon {
          visibility: visible;
        }
      `}</style>
    </div>
  )
}