"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { v4 as uuidv4 } from "uuid"
import Markdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Brain, User, Bot, Send, Heart, Smile, Wind } from "lucide-react"

type ConsultationResponse = {
  response: string
  history: string[]
  keyword?: string | string[]
}

type Message = {
  id: string
  type: "user" | "ai"
  content: string
  timestamp: Date
  isTyping?: boolean
  displayedContent?: string
}

const CONSULTATION_URL = "https://adeshjain-adesh-legal-test.hf.space/legal-consultation"

// Wellness conversation starters
const wellnessStarters = [
  "I'm feeling overwhelmed and need support",
  "How can I manage stress better?",
  "I'm struggling with anxiety",
  "How do I practice mindfulness?",
  "I need someone to talk to about my feelings",
  "What are healthy coping mechanisms?",
]

const wellnessTopics = [
  { icon: Heart, label: "Emotional Support", color: "bg-primary" },
  { icon: Wind, label: "Stress Relief", color: "bg-secondary" },
  { icon: Smile, label: "Wellbeing", color: "bg-accent" },
  { icon: Brain, label: "Mental Health", color: "bg-primary" },
]

export default function ConsultationPage() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [messages, setMessages] = useState([])
  const [userId, setUserId] = useState("")
  const [showInstructions, setShowInstructions] = useState(true)
  const [isTypingActive, setIsTypingActive] = useState(false)

  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const abortControllerRef = useRef(null)

  // Generate or retrieve user_id for this session
  useEffect(() => {
    try {
      let uid = localStorage.getItem("user_id")
      if (!uid) {
        uid = uuidv4()
        localStorage.setItem("user_id", uid)
      }
      setUserId(uid)
    } catch (err) {
      setUserId(uuidv4())
    }
  }, [])

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
      }
    }

    const timeoutId = setTimeout(scrollToBottom, 100)
    return () => clearTimeout(timeoutId)
  }, [messages, isTypingActive])

  // Hide instructions when user starts chatting
  useEffect(() => {
    if (messages.length > 0) {
      setShowInstructions(false)
    }
  }, [messages.length])

  // Cleanup function for typing timeouts
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

  const handleSampleQuestion = useCallback((question: string) => {
    setQuery(question)
    setError(null)
  }, [])

  // API consultation handler
  const handleConsult = useCallback(async () => {
    if (!query.trim() || loading || isTypingActive) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    const userMessage: Message = {
      id: uuidv4(),
      type: "user",
      content: query.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const currentQuery = query.trim()
    setQuery("")
    setLoading(true)
    setError(null)

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout")), 30000)
      })

      const response = await Promise.race([
        fetch(CONSULTATION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: currentQuery,
            user_id: userId,
          }),
          signal: abortControllerRef.current.signal,
        }),
        timeoutPromise,
      ])

      if (!response.ok) throw new Error("API response error")

      const data: ConsultationResponse = await response.json()
      const aiMessage: Message = {
        id: uuidv4(),
        type: "ai",
        content: data.response,
        timestamp: new Date(),
        isTyping: true,
        displayedContent: "",
      }

      setMessages((prev) => [...prev, aiMessage])
      simulateTyping(aiMessage.id, data.response)
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message || "Failed to get response. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }, [query, loading, isTypingActive, userId, simulateTyping])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      handleConsult()
    }
  }

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
        }}
      >
        {/* Sidebar - Wellness Topics */}
        <div style={{ width: "280px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Card
            style={{ border: "1px solid #e0d9d3", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", borderRadius: "1.25rem" }}
          >
            <CardHeader style={{ paddingBottom: "0.75rem" }}>
              <CardTitle style={{ fontSize: "1rem", color: "#1a1a1a" }}>Wellness Topics</CardTitle>
              <CardDescription style={{ color: "#7a7a7a", fontSize: "0.75rem" }}>
                What would you like to talk about?
              </CardDescription>
            </CardHeader>
            <CardContent style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {wellnessTopics.map((topic, idx) => {
                const Icon = topic.icon
                return (
                  <button
                    key={idx}
                    onClick={() => handleSampleQuestion(`Tell me about ${topic.label.toLowerCase()}`)}
                    style={{
                      padding: "0.75rem",
                      borderRadius: "0.875rem",
                      border: "1px solid #e0d9d3",
                      background: "white",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.875rem",
                      color: "#1a1a1a",
                      transition: "all 0.2s ease",
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f0ede8"
                      e.currentTarget.style.borderColor = "#2d8a8a"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "white"
                      e.currentTarget.style.borderColor = "#e0d9d3"
                    }}
                  >
                    <Icon style={{ width: "1rem", height: "1rem", color: "#2d8a8a", flexShrink: 0 }} />
                    <span style={{ textAlign: "left" }}>{topic.label}</span>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {/* Wellness Tips */}
          <Card
            style={{
              border: "1px solid #e0d9d3",
              background: "#fef5f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              borderRadius: "1.25rem",
            }}
          >
            <CardHeader style={{ paddingBottom: "0.75rem" }}>
              <CardTitle style={{ fontSize: "1rem", color: "#1a1a1a" }}>Quick Tip</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ fontSize: "0.875rem", color: "#7a7a7a", lineHeight: "1.5", margin: 0 }}>
                Remember to take breaks, stay hydrated, and be kind to yourself. Reaching out is a sign of strength.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
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
            {showInstructions && messages.length === 0 && (
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
                    background: "linear-gradient(135deg, #2d8a8a 0%, #4da9a0 100%)",
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
                    I'm here to listen and support you with your wellbeing journey. Share what's on your mind, and I'll
                    do my best to help.
                  </p>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                    width: "100%",
                    maxWidth: "400px",
                  }}
                >
                  {wellnessStarters.slice(0, 4).map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSampleQuestion(question)}
                      style={{
                        padding: "0.75rem",
                        borderRadius: "0.875rem",
                        border: "1px solid #e0d9d3",
                        background: "white",
                        color: "#1a1a1a",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#f0ede8"
                        e.currentTarget.style.borderColor = "#2d8a8a"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "white"
                        e.currentTarget.style.borderColor = "#e0d9d3"
                      }}
                    >
                      {question}
                    </button>
                  ))}
                </div>
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
                        h1: ({ node, ...props }) => (
                          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "1rem 0 0.5rem 0" }} {...props} />
                        ),
                        h2: ({ node, ...props }) => (
                          <h2
                            style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0.875rem 0 0.375rem 0" }}
                            {...props}
                          />
                        ),
                        h3: ({ node, ...props }) => (
                          <h3
                            style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0.75rem 0 0.25rem 0" }}
                            {...props}
                          />
                        ),
                        p: ({ node, ...props }) => <p style={{ margin: "0.5rem 0" }} {...props} />,
                        ul: ({ node, ...props }) => (
                          <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }} {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }} {...props} />
                        ),
                        li: ({ node, ...props }) => <li style={{ margin: "0.25rem 0" }} {...props} />,
                        blockquote: ({ node, ...props }) => (
                          <blockquote
                            style={{
                              borderLeft: "3px solid rgba(45,138,138,0.5)",
                              paddingLeft: "1rem",
                              margin: "0.75rem 0",
                              fontStyle: "italic",
                              opacity: 0.9,
                            }}
                            {...props}
                          />
                        ),
                        code: ({ node, inline, ...props }) =>
                          inline ? (
                            <code
                              style={{
                                background: "rgba(0,0,0,0.05)",
                                padding: "0.2rem 0.4rem",
                                borderRadius: "0.25rem",
                                fontFamily: "monospace",
                                fontSize: "0.9em",
                              }}
                              {...props}
                            />
                          ) : (
                            <code
                              style={{
                                background: "rgba(0,0,0,0.08)",
                                padding: "0.75rem",
                                borderRadius: "0.5rem",
                                fontFamily: "monospace",
                                fontSize: "0.9em",
                                display: "block",
                                overflow: "auto",
                                margin: "0.5rem 0",
                              }}
                              {...props}
                            />
                          ),
                        a: ({ node, ...props }) => (
                          <a style={{ color: "#2d8a8a", textDecoration: "underline", fontWeight: 500 }} {...props} />
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
            <div ref={messagesEndRef} />
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
                background: loading || isTypingActive || !query.trim() ? "#d1d5db" : "#2d8a8a",
                color: "white",
                borderRadius: "0.75rem",
                cursor: loading || isTypingActive || !query.trim() ? "not-allowed" : "pointer",
                border: "none",
                padding: "0.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              {loading || isTypingActive ? (
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
          0%, 100% {
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
      `}</style>
    </div>
  )
}
