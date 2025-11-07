"use client"
import type React from "react"
import { useState, useEffect, useRef } from "react"
import axios, { type AxiosError } from "axios"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Upload,
  Send,
  Loader2,
  FileText,
  File,
  Brain,
  MessageCircle,
  Sparkles,
  CheckCircle,
  Zap,
  Scale,
  Flag,
  Crown,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ChatMessage {
  id: string
  content: string
  isUser: boolean
  timestamp: string
  files?: File[]
}

interface UploadResponse {
  status: string
  message: string
  collection_name: string
  document_count: number
}

interface ChatResponse {
  answer: string
  sources: string[]
  metadata: {
    collection_name: string
    message_count: number
  }
}

const API_BASE_URL = "https://adeshjain-adesh-legal-test.hf.space"

const ChatbotPage: React.FC = () => {
  const [pdfUrl, setPdfUrl] = useState<string>("")
  const [collectionName, setCollectionName] = useState<string>("")
  const [question, setQuestion] = useState<string>("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (chatContainerRef.current) {
      const scrollElement = chatContainerRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      } else {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
      }
    }
  }, [messages, isLoading])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files)
      setUploadedFiles((prev) => [...prev, ...newFiles])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setUploadedFiles((prev) => [...prev, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUploadPDF = async () => {
    if (!pdfUrl) {
      setError("Please enter a valid PDF URL")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await axios.post<UploadResponse>(`${API_BASE_URL}/upload-pdf`, {
        pdf_url: pdfUrl,
      })

      setCollectionName(response.data.collection_name)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          content: `PDF uploaded successfully. Collection: ${response.data.collection_name} (${response.data.document_count} documents)`,
          isUser: false,
          timestamp: new Date().toLocaleTimeString(),
        },
      ])
      setPdfUrl("")
    } catch (err) {
      const error = err as AxiosError
      setError(error.response?.data?.detail || "Failed to upload PDF")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendQuestion = async () => {
    if (!question.trim() && uploadedFiles.length === 0) {
      setError("Please enter a question or upload files")
      return
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      content: question || "Document analysis request",
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined,
    }

    setMessages((prev) => [...prev, userMessage])
    setQuestion("")
    setIsLoading(true)
    setError(null)

    try {
      let response

      if (collectionName && question.trim()) {
        // Use existing PDF chat functionality
        response = await axios.post<ChatResponse>(`${API_BASE_URL}/chat`, {
          question: userMessage.content,
          collection_name: collectionName,
        })

        const botMessage: ChatMessage = {
          id: crypto.randomUUID(),
          content: response.data.answer,
          isUser: false,
          timestamp: new Date().toLocaleTimeString(),
        }

        setMessages((prev) => [...prev, botMessage])
      } else {
        // Use Groq API for general questions
        const groqResponse = await fetch("/api/groq-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `You are an expert Indian document analyst. ${userMessage.content}`,
            model: "llama-3.1-70b-versatile",
          }),
        })

        if (!groqResponse.ok) {
          throw new Error(`HTTP error! status: ${groqResponse.status}`)
        }

        const groqData = await groqResponse.json()

        const botMessage: ChatMessage = {
          id: crypto.randomUUID(),
          content: groqData.response || "I apologize, but I couldn't process your request at this time.",
          isUser: false,
          timestamp: new Date().toLocaleTimeString(),
        }

        setMessages((prev) => [...prev, botMessage])
      }
    } catch (err) {
      const error = err as AxiosError
      setError(error.response?.data?.detail || "Failed to get response")

      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: "I apologize, but I encountered an error processing your request. Please try again later.",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setUploadedFiles([])
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendQuestion()
    }
  }

  return (
    <div className="min-h-screen bg-background mandala-pattern">
      <header className="indian-flag-gradient text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10 lotus-pattern"></div>
        <div className="absolute top-4 left-4 ashoka-wheel opacity-20">
          <div className="w-16 h-16 border-4 border-white/30 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/50 rounded-full relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-white/70 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 relative z-10">
          <div className="flex items-center gap-6 mb-6">
            <a href="/" className="block">
              <Button
                variant="outline"
                className="bg-white/20 backdrop-blur-sm border-white/40 text-white hover:bg-white/30 h-12 px-6"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                <span className="sanskrit-style">वापस जाएं • Back to Search</span>
              </Button>
            </a>
            <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-full p-4 indian-border">
              <Brain className="h-10 w-10 text-white" />
              <MessageCircle className="h-10 w-10 text-white" />
              <Sparkles className="h-8 w-8 text-white/80" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-3 text-white drop-shadow-2xl sanskrit-style devanagari-accent">
                PDF चैटबॉट विश्लेषण केंद्र
              </h1>
              <h2 className="text-2xl font-semibold mb-2 text-white/95 hindi-accent">PDF Chatbot Analysis Center</h2>
              <p className="text-white/90 text-xl flex items-center gap-2">
                <span className="text-2xl">📄</span>
                <span className="sanskrit-style">दस्तावेज़ विश्लेषण • Document Analysis</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-300px)]">
          {/* Chat Area */}
          <div className="lg:col-span-2">
            <Card className="h-full flex flex-col border-4 border-primary/30 shadow-2xl indian-card">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b">
                <CardTitle className="flex items-center gap-3 text-primary text-xl">
                  <div className="bg-primary/20 p-2 rounded-full">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <span className="sanskrit-style">📄 PDF Document Assistant • PDF सहायक</span>
                </CardTitle>
                <CardDescription className="text-lg">
                  Upload PDF documents via URL and chat with your documents using AI-powered analysis
                </CardDescription>
              </CardHeader>

              {/* PDF Upload Section */}
              <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-secondary/5">
                <div className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={pdfUrl}
                    onChange={(e) => setPdfUrl(e.target.value)}
                    placeholder="Enter PDF URL (e.g., https://example.com/document.pdf)"
                    className="flex-1 p-3 border-2 border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary indian-card"
                  />
                  <Button
                    onClick={handleUploadPDF}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg px-6 indian-hover pulse-saffron"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {isLoading ? "Uploading..." : "Upload PDF"}
                  </Button>
                </div>
                {collectionName && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded">
                    <CheckCircle className="h-4 w-4" />
                    <span>Current collection: {collectionName}</span>
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 p-2 rounded mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Messages Area */}
              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-full p-6" ref={chatContainerRef}>
                  {messages.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="bg-gradient-to-br from-primary/20 via-white to-secondary/20 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6 shadow-2xl indian-card ashoka-wheel">
                        <FileText className="h-12 w-12 text-primary" />
                      </div>
                      <h3 className="text-2xl font-bold mb-4 text-primary sanskrit-style">🙏 Welcome to PDF Chatbot</h3>
                      <p className="text-muted-foreground mb-6 max-w-2xl mx-auto text-lg">
                        Upload a PDF document using its URL and start chatting with your document. Ask questions, get
                        summaries, and extract insights from your documents.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Badge variant="outline" className="text-sm">
                          📄 PDF Analysis
                        </Badge>
                        <Badge variant="outline" className="text-sm">
                          💬 Document Chat
                        </Badge>
                        <Badge variant="outline" className="text-sm">
                          🔍 Content Search
                        </Badge>
                        <Badge variant="outline" className="text-sm">
                          📋 Summary Generation
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl p-4 ${
                              message.isUser
                                ? "bg-gradient-to-r from-primary to-secondary text-white"
                                : "bg-muted border-2 border-primary/20 indian-card"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-full ${message.isUser ? "bg-white/20" : "bg-primary/20"}`}>
                                {message.isUser ? (
                                  <MessageCircle className="h-4 w-4" />
                                ) : (
                                  <Brain className="h-4 w-4 text-primary" />
                                )}
                              </div>
                              <div className="flex-1">
                                {message.isUser ? (
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                ) : (
                                  <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                                    <ReactMarkdown
                                      components={{
                                        h1: ({ children }) => (
                                          <h1 className="text-lg font-bold mb-2 text-primary">{children}</h1>
                                        ),
                                        h2: ({ children }) => (
                                          <h2 className="text-base font-semibold mb-2 text-primary">{children}</h2>
                                        ),
                                        h3: ({ children }) => (
                                          <h3 className="text-sm font-medium mb-1 text-primary">{children}</h3>
                                        ),
                                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                        ul: ({ children }) => (
                                          <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
                                        ),
                                        ol: ({ children }) => (
                                          <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
                                        ),
                                        li: ({ children }) => <li className="text-sm">{children}</li>,
                                        code: ({ children, className }) => {
                                          const isInline = !className
                                          return isInline ? (
                                            <code className="bg-primary/10 px-1 py-0.5 rounded text-xs font-mono">
                                              {children}
                                            </code>
                                          ) : (
                                            <code className="block bg-primary/10 p-2 rounded text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                                              {children}
                                            </code>
                                          )
                                        },
                                        pre: ({ children }) => (
                                          <pre className="bg-primary/10 p-2 rounded text-xs font-mono whitespace-pre-wrap overflow-x-auto mb-2">
                                            {children}
                                          </pre>
                                        ),
                                        blockquote: ({ children }) => (
                                          <blockquote className="border-l-4 border-primary/30 pl-3 italic mb-2">
                                            {children}
                                          </blockquote>
                                        ),
                                        strong: ({ children }) => (
                                          <strong className="font-semibold text-primary">{children}</strong>
                                        ),
                                        em: ({ children }) => <em className="italic">{children}</em>,
                                      }}
                                    >
                                      {message.content}
                                    </ReactMarkdown>
                                  </div>
                                )}
                                {message.files && message.files.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {message.files.map((file, index) => (
                                      <div
                                        key={index}
                                        className="flex items-center gap-2 text-xs bg-white/20 rounded p-2"
                                      >
                                        <File className="h-3 w-3" />
                                        <span>{file.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {(file.size / 1024).toFixed(1)}KB
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <p className="text-xs opacity-70 mt-2">{message.timestamp}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-muted border-2 border-primary/20 indian-card rounded-2xl p-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/20 p-2 rounded-full">
                                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                              </div>
                              <p className="text-sm text-muted-foreground">AI is analyzing your request...</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>

              {/* Input Area */}
              <div className="border-t p-6 bg-gradient-to-r from-primary/5 to-secondary/5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask a question about the uploaded PDF or general document queries..."
                    className="flex-1 p-3 border-2 border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary indian-card"
                  />
                  <Button
                    onClick={handleSendQuestion}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg px-6 indian-hover pulse-saffron"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Features Card */}
            <Card className="border-4 border-secondary/30 shadow-2xl indian-card peacock-pattern">
              <CardHeader className="bg-gradient-to-r from-secondary/10 to-secondary/5">
                <CardTitle className="text-secondary text-lg sanskrit-style flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />🚀 PDF Features • PDF सुविधाएं
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">URL Upload</p>
                      <p className="text-sm text-muted-foreground">Upload PDFs directly from web URLs</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Document Chat</p>
                      <p className="text-sm text-muted-foreground">Ask questions about your PDF content</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Document Analysis</p>
                      <p className="text-sm text-muted-foreground">AI-powered document analysis</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Multi-language Support</p>
                      <p className="text-sm text-muted-foreground">English and Hindi terminology support</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-4 border-accent/30 shadow-2xl indian-card mandala-pattern">
              <CardHeader className="bg-gradient-to-r from-accent/10 to-accent/5">
                <CardTitle className="text-accent text-lg sanskrit-style flex items-center gap-2">
                  <Zap className="h-5 w-5" />⚡ Quick Actions • त्वरित कार्य
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start indian-hover bg-transparent"
                    onClick={() => setQuestion("Summarize the key points of this document")}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Summarize Document
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start indian-hover bg-transparent"
                    onClick={() => setQuestion("What are the implications mentioned in this document?")}
                  >
                    <Scale className="h-4 w-4 mr-2" />
                    Analysis
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start indian-hover bg-transparent"
                    onClick={() => setQuestion("Extract all important dates and deadlines")}
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Extract Dates
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start indian-hover bg-transparent"
                    onClick={() => setQuestion("Identify potential risks or issues in this document")}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Risk Assessment
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Alert className="border-primary/30 bg-primary/5 indian-card">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>💡 Pro Tip:</strong> Upload a PDF first using its URL, then ask specific questions about the
                content. The AI can analyze documents and provide detailed insights.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ChatbotPage
