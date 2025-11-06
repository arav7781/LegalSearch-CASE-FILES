"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { v4 as uuidv4 } from "uuid"
import Markdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Scale, User, Bot, Send, Shield, MessageSquare, Plus, Trash2 } from "lucide-react"

// --- API Endpoints ---
const API_BASE_URL = "https://aravsaxena884-consult.hf.space"

const CONSULTATION_URL = `${API_BASE_URL}/legal-consultation`
const HISTORY_URL = `${API_BASE_URL}/get-session-history`
const DELETE_SESSION_URL = `${API_BASE_URL}/delete-session`

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

type ConsultationResponse = {
  response: string
  history: string[]
}

type AiResponseContent = {
  consultation: string
  key_terms: string
}

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

export default function LegalTechPage() {
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
        loadSession(sessions[0].id)
      } else {
        handleNewChat()
      }
    } catch (err) {
      console.error("Failed to load from localStorage:", err)
      handleNewChat()
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessionList))
    } catch (err) {
      console.error("Failed to save session list:", err)
    }
  }, [sessionList])

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
    const newSession: Session = { id: newId, title: "New Consultation" }

    setSessionList((prev) => [newSession, ...prev])
    setActiveSession(newId)
    setMessages([])
    setError(null)
    setLoading(false)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const loadSession = useCallback(
    async (sessionId: string) => {
      if (isTypingActive) return
      if (sessionId === currentSessionId && messages.length > 0) return

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

        const loadedMessages: Message[] = data.history.map((msg) => {
          let content = msg.data.content
          if (msg.type === "ai") {
            try {
              const aiContent: AiResponseContent = JSON.parse(msg.data.content)
              content = aiContent.consultation
            } catch (e) {
              content = msg.data.content
            }
          }

          return {
            id: uuidv4(),
            type: msg.type === "human" ? "user" : "ai",
            content: content,
            timestamp: new Date(),
            displayedContent: content,
          }
        })

        setMessages(loadedMessages)
      } catch (err) {
        console.error("Failed to load session:", err)
        setError("Failed to load consultation history. Please try again.")
        if (sessionList.length === 0) {
          handleNewChat()
        }
      } finally {
        setLoading(false)
      }
    },
    [currentSessionId, isTypingActive, messages.length, sessionList.length],
  )

  const handleDeleteSession = async (e: React.MouseEvent, sessionIdToDelete: string) => {
    e.stopPropagation()

    const remainingSessions = sessionList.filter((s) => s.id !== sessionIdToDelete)
    setSessionList(remainingSessions)

    if (currentSessionId === sessionIdToDelete) {
      if (remainingSessions.length > 0) {
        loadSession(remainingSessions[0].id)
      } else {
        handleNewChat()
      }
    }

    try {
      await fetch(`${DELETE_SESSION_URL}/${sessionIdToDelete}`, {
        method: "DELETE",
      })
      console.log("Session deleted:", sessionIdToDelete)
    } catch (err) {
      console.warn("Failed to delete session:", err)
    }
  }

  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
      }
    }
    const timeoutId = setTimeout(scrollToBottom, 100)
    return () => clearTimeout(timeoutId)
  }, [messages, isTypingActive])

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
              msg.id === messageId ? { ...msg, isTyping: false, displayedContent: fullContent } : msg,
            ),
          )
          setIsTypingActive(false)
          return
        }

        const batchSize = Math.min(2, words.length - currentWordIndex)
        const wordsToShow = words.slice(0, currentWordIndex + batchSize).join(" ")

        setMessages((prev) =>
          prev.map((msg) => (msg.id === messageId ? { ...msg, displayedContent: wordsToShow } : msg)),
        )

        currentWordIndex += batchSize
        typingTimeoutRef.current = setTimeout(typeNextBatch, 100)
      }

      typeNextBatch()
    },
    [isTypingActive],
  )

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

    if (messages.length === 0) {
      const newTitle = currentQuery.length > 30 ? currentQuery.substring(0, 30) + "..." : currentQuery
      setSessionList((prev) => prev.map((s) => (s.id === currentSessionId ? { ...s, title: newTitle } : s)))
    }

    try {
      const response = await fetch(CONSULTATION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: currentQuery,
          user_id: currentSessionId,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`API response error: ${errorData}`)
      }

      const data: ConsultationResponse = await response.json()

      const parsedAiResponse: AiResponseContent = JSON.parse(data.response)
      const consultationText = parsedAiResponse.consultation || "I'm unable to provide guidance on this matter."

      const aiMessage: Message = {
        id: uuidv4(),
        type: "ai",
        content: consultationText,
        timestamp: new Date(),
        isTyping: true,
        displayedContent: "",
      }

      setMessages((prev) => [...prev, aiMessage])
      simulateTyping(aiMessage.id, consultationText)
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        let errorMsg = err.message || "Failed to get legal guidance. Please try again."
        if (errorMsg.includes("is not valid JSON")) {
          errorMsg = "Received an invalid response from the server. Please try again."
        }
        setError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }, [query, loading, isTypingActive, currentSessionId, messages.length, simulateTyping, loadSession])

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
        background: "linear-gradient(180deg, #FFFFFF 0%, #F8F9FA 100%)",
      }}
    >
      {/* Indian Flag Stripe */}
      <div
        style={{
          height: "4px",
          background: "linear-gradient(90deg, #FF9933 0%, #FFFFFF 33.33%, #138808 66.66%, #1F41B3 100%)",
        }}
      />

      {/* Header with Indian Flag Theme */}
      <div
        style={{
          padding: "1.5rem 2rem",
          background: "linear-gradient(135deg, #FFFFFF 0%, #FFFBF0 100%)",
          borderBottom: "2px solid #FF9933",
          boxShadow: "0 4px 20px rgba(31, 65, 179, 0.08)",
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* Flag-themed Icon */}
            <div
              style={{
                width: "3.5rem",
                height: "3.5rem",
                borderRadius: "1rem",
                background: "linear-gradient(135deg, #FF9933 0%, #FFFFFF 50%, #138808 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(31, 65, 179, 0.15)",
              }}
            >
              <Scale style={{ color: "#1F41B3", width: "1.75rem", height: "1.75rem", fontWeight: "bold" }} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  margin: 0,
                  background: "linear-gradient(135deg, #FF9933 0%, #1F41B3 50%, #138808 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                LexAI Assist
              </h1>
              <p style={{ fontSize: "0.9rem", color: "#666", margin: "0.25rem 0 0 0", fontWeight: 500 }}>
                Indian Legal Intelligence Platform
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
          maxWidth: "1400px",
          width: "100%",
          margin: "0 auto",
          gap: "1.5rem",
          padding: "1.5rem 2rem",
          overflow: "hidden",
        }}
      >
        {/* Chat History Sidebar */}
        <div
          style={{
            width: "300px",
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
              justifyContent: "center",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.875rem 1.25rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #FF9933 0%, #138808 100%)",
              color: "white",
              borderRadius: "0.875rem",
              border: "none",
              cursor: isTypingActive ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: "0 4px 12px rgba(255, 153, 51, 0.2)",
            }}
            onMouseEnter={(e) => {
              if (!isTypingActive) {
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 153, 51, 0.3)"
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(255, 153, 51, 0.2)"
            }}
          >
            <Plus style={{ width: "1.25rem", height: "1.25rem" }} />
            New Consultation
          </Button>

          <Card
            style={{
              flex: 1,
              border: "2px solid #E0E0E0",
              boxShadow: "0 4px 16px rgba(31, 65, 179, 0.08)",
              borderRadius: "1.25rem",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "#FFFFFF",
            }}
          >
            <div
              style={{
                padding: "0.75rem 1rem",
                borderBottom: "1px solid #F0F0F0",
                background: "linear-gradient(90deg, rgba(255, 153, 51, 0.05) 0%, rgba(19, 136, 8, 0.05) 100%)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "#138808",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Consultation History
              </p>
            </div>
            <CardContent
              style={{
                padding: "0.75rem",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                flex: 1,
                scrollbarWidth: "thin",
                scrollbarColor: "#FF9933 #F5F5F5",
              }}
              className="custom-scrollbar"
            >
              <style jsx>{`
                .custom-scrollbar {
                  scrollbar-width: thin;
                  scrollbar-color: #FF9933 #F5F5F5;
                }
                .custom-scrollbar::-webkit-scrollbar {
                  width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: #F5F5F5;
                  border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: #FF9933;
                  border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background: #E88A1F;
                }
              `}</style>
              {sessionList.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "#999",
                    fontSize: "0.85rem",
                    padding: "2rem 1rem",
                    fontStyle: "italic",
                  }}
                >
                  No consultations yet
                </p>
              ) : (
                sessionList.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    disabled={isTypingActive}
                    style={{
                      padding: "0.875rem 1rem",
                      borderRadius: "0.875rem",
                      border: currentSessionId === session.id ? "2px solid #FF9933" : "1px solid transparent",
                      background:
                        currentSessionId === session.id
                          ? "linear-gradient(135deg, #FFF3E0 0%, #E8F5E9 100%)"
                          : "transparent",
                      cursor: isTypingActive ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      fontSize: "0.9rem",
                      color: "#0F1419",
                      transition: "all 0.2s ease",
                      fontWeight: currentSessionId === session.id ? 600 : 500,
                      width: "100%",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (currentSessionId !== session.id && !isTypingActive) {
                        e.currentTarget.style.background = "#F8F8F8"
                        e.currentTarget.style.border = "1px solid #FF9933"
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentSessionId !== session.id) {
                        e.currentTarget.style.background = "transparent"
                        e.currentTarget.style.border = "1px solid transparent"
                      }
                    }}
                  >
                    <MessageSquare
                      style={{
                        width: "1.1rem",
                        height: "1.1rem",
                        color: currentSessionId === session.id ? "#FF9933" : "#1F41B3",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {session.title}
                    </span>

                    <Trash2
                      style={{
                        width: "0.95rem",
                        height: "0.95rem",
                        color: "#DDD",
                        flexShrink: 0,
                        visibility: "hidden",
                        transition: "all 0.2s",
                      }}
                      className="delete-icon"
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#FF6B6B"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#DDD"
                      }}
                    />
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat Area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            minWidth: 0,
          }}
        >
          {/* Messages Container with Custom Scrollbar */}
          <div
            ref={messagesContainerRef}
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              padding: "1.5rem",
              background: "linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)",
              borderRadius: "1.5rem",
              border: "2px solid #E8E8E8",
              boxShadow: "0 8px 32px rgba(31, 65, 179, 0.06)",
              scrollbarWidth: "thin",
              scrollbarColor: "#138808 #F0F0F0",
            }}
            className="messages-container"
          >
            <style jsx>{`
              .messages-container {
                scrollbar-width: thin;
                scrollbar-color: #138808 #F0F0F0;
              }
              .messages-container::-webkit-scrollbar {
                width: 8px;
              }
              .messages-container::-webkit-scrollbar-track {
                background: #F0F0F0;
                border-radius: 10px;
              }
              .messages-container::-webkit-scrollbar-thumb {
                background: #138808;
                border-radius: 10px;
                border: 2px solid #F0F0F0;
              }
              .messages-container::-webkit-scrollbar-thumb:hover {
                background: #0F6B04;
              }
            `}</style>
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
                    width: "4.5rem",
                    height: "4.5rem",
                    borderRadius: "1.5rem",
                    background: "linear-gradient(135deg, #FF9933 0%, #1F41B3 50%, #138808 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 8px 24px rgba(31, 65, 179, 0.2)",
                  }}
                >
                  <Shield style={{ width: "2.25rem", height: "2.25rem", color: "white" }} />
                </div>
                <div>
                  <h2
                    style={{
                      fontSize: "1.75rem",
                      fontWeight: 800,
                      margin: "0 0 0.75rem 0",
                      background: "linear-gradient(135deg, #FF9933 0%, #1F41B3 50%, #138808 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    Welcome to LexAI Assist
                  </h2>
                  <p style={{ fontSize: "1rem", color: "#666", margin: "0 0 1rem 0", lineHeight: "1.6" }}>
                    Expert legal guidance for Indian law matters. Ask about contracts, compliance,
                    <br />
                    constitutional rights, corporate law, and more.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      justifyContent: "center",
                      fontSize: "0.85rem",
                      color: "#999",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>⚖️ 24/7 Available</span>
                    <span>•</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>🛡️ Confidential</span>
                    <span>•</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>✓ Reliable</span>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Spinner */}
            {loading && messages.length === 0 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
                <Loader2
                  style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    background: "linear-gradient(90deg, #FF9933 0%, #138808 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    animation: "spin 1s linear infinite",
                  }}
                />
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
                  animation: "fadeIn 0.3s ease-in",
                }}
              >
                {message.type === "ai" && (
                  <div
                    style={{
                      width: "2.5rem",
                      height: "2.5rem",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 2px 8px rgba(19, 136, 8, 0.15)",
                    }}
                  >
                    <Bot style={{ width: "1.4rem", height: "1.4rem", color: "#138808" }} />
                  </div>
                )}
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "1rem 1.25rem",
                    borderRadius: "1.25rem",
                    background:
                      message.type === "user"
                        ? "linear-gradient(135deg, #FF9933 0%, #1F41B3 100%)"
                        : "linear-gradient(135deg, #F5F5F5 0%, #EBEBEB 100%)",
                    color: message.type === "user" ? "white" : "#0F1419",
                    fontSize: "0.95rem",
                    lineHeight: "1.6",
                    wordWrap: "break-word",
                    boxShadow:
                      message.type === "user" ? "0 4px 12px rgba(31, 65, 179, 0.15)" : "0 2px 8px rgba(0, 0, 0, 0.05)",
                    border: message.type === "user" ? "none" : "1px solid #E0E0E0",
                  }}
                >
                  {message.isTyping && !message.displayedContent ? (
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <div
                        style={{
                          width: "0.6rem",
                          height: "0.6rem",
                          borderRadius: "50%",
                          background: "#138808",
                          animation: "pulse 1.5s ease-in-out infinite",
                        }}
                      />
                      <div
                        style={{
                          width: "0.6rem",
                          height: "0.6rem",
                          borderRadius: "50%",
                          background: "#138808",
                          animation: "pulse 1.5s ease-in-out infinite 0.2s",
                        }}
                      />
                      <div
                        style={{
                          width: "0.6rem",
                          height: "0.6rem",
                          borderRadius: "50%",
                          background: "#138808",
                          animation: "pulse 1.5s ease-in-out infinite 0.4s",
                        }}
                      />
                    </div>
                  ) : message.type === "ai" ? (
                    <Markdown
                      components={{
                        p: ({ node, ...props }) => <p style={{ margin: "0.5rem 0" }} {...props} />,
                        ul: ({ node, ...props }) => (
                          <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }} {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }} {...props} />
                        ),
                        li: ({ node, ...props }) => <li style={{ margin: "0.25rem 0" }} {...props} />,
                        a: ({ node, ...props }) => (
                          <a
                            style={{
                              color: "#138808",
                              textDecoration: "underline",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            {...props}
                          />
                        ),
                        strong: ({ node, ...props }) => (
                          <strong style={{ color: "#FF9933", fontWeight: 700 }} {...props} />
                        ),
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
                      width: "2.5rem",
                      height: "2.5rem",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #FF9933 0%, #E88A1F 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 2px 8px rgba(255, 153, 51, 0.2)",
                    }}
                  >
                    <User style={{ width: "1.4rem", height: "1.4rem", color: "white" }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert
              style={{
                borderRadius: "1rem",
                border: "2px solid #FFB74D",
                background: "linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)",
                padding: "1rem",
              }}
            >
              <AlertCircle style={{ width: "1.2rem", height: "1.2rem", color: "#FF9933", flexShrink: 0 }} />
              <AlertDescription style={{ color: "#E65100", fontWeight: 500 }}>{error}</AlertDescription>
            </Alert>
          )}

          {/* Input Area */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              background: "linear-gradient(135deg, #FFFFFF 0%, #FAFAFA 100%)",
              padding: "1rem",
              borderRadius: "1.25rem",
              border: "2px solid #E8E8E8",
              boxShadow: "0 4px 16px rgba(31, 65, 179, 0.06)",
            }}
          >
            <Textarea
              placeholder="Ask your legal question about Indian law..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading || isTypingActive}
              style={{
                flex: 1,
                minHeight: "3rem",
                maxHeight: "6rem",
                padding: "0.875rem",
                border: "1.5px solid #E0E0E0",
                borderRadius: "0.875rem",
                fontSize: "0.95rem",
                color: "#0F1419",
                fontFamily: "inherit",
                resize: "none",
                backgroundColor: "#FAFAFA",
                transition: "all 0.2s",
                opacity: loading || isTypingActive ? 0.6 : 1,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#FF9933"
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255, 153, 51, 0.1)"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#E0E0E0"
                e.currentTarget.style.boxShadow = "none"
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
                  loading || isTypingActive || !query.trim()
                    ? "#DDD"
                    : "linear-gradient(135deg, #138808 0%, #0F6B04 100%)",
                color: "white",
                borderRadius: "0.875rem",
                cursor: loading || isTypingActive || !query.trim() ? "not-allowed" : "pointer",
                border: "none",
                padding: "0.875rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
                fontWeight: 600,
                boxShadow: loading || isTypingActive || !query.trim() ? "none" : "0 4px 12px rgba(19, 136, 8, 0.25)",
              }}
              onMouseEnter={(e) => {
                if (!loading && !isTypingActive && query.trim()) {
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(19, 136, 8, 0.35)"
                  e.currentTarget.style.transform = "translateY(-1px)"
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(19, 136, 8, 0.25)"
                e.currentTarget.style.transform = "translateY(0)"
              }}
            >
              {loading && !isTypingActive ? (
                <Loader2
                  style={{
                    width: "1.25rem",
                    height: "1.25rem",
                    animation: "spin 1s linear infinite",
                  }}
                />
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
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        button:hover .delete-icon {
          visibility: visible;
        }
      `}</style>
    </div>
  )
}
