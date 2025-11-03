"use client"
import type React from "react"
import { useState, useEffect, useRef } from "react"
import axios, { type AxiosError } from "axios"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Send,
  Loader2,
  HeartPulse,
  Stethoscope,
  Pill,
  MessageCircle,
  Sparkles,
  CheckCircle,
  Zap,
  Activity,
  AlertCircle,
  Phone,
  ShieldCheck,
  PlusCircle,
  Brain,
  FileText
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
}

const API_BASE_URL = "https://aravsaxena884-trueRAG.hf.space"

const HealthChatbotPage: React.FC = () => {
  const [question, setQuestion] = useState<string>("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

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

  const handleSendQuestion = async () => {
    if (!question.trim()) {
      setError("Please enter a health query")
      return
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      content: question,
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setQuestion("")
    setIsLoading(true)
    setError(null)

    try {
      const response = await axios.post(`${API_BASE_URL}/health-chat`, {
        question: userMessage.content,
      })

      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: response.data.answer || "I'm here to assist you with your health queries.",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (err) {
      const error = err as AxiosError
      setError(error.response?.data?.detail || "Failed to get response")

      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: "I encountered an issue processing your request. Please try again later.",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
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
        <div className="container mx-auto px-4 py-8 relative z-10">
          <div className="flex items-center gap-6 mb-6">
            <a href="/" className="block">
              <Button
                variant="outline"
                className="bg-white/20 backdrop-blur-sm border-white/40 text-white hover:bg-white/30 h-12 px-6"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                <span className="sanskrit-style">वापस जाएं • Back</span>
              </Button>
            </a>
            <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-full p-4 indian-border">
              <Stethoscope className="h-10 w-10 text-white" />
              <HeartPulse className="h-10 w-10 text-white" />
              <Sparkles className="h-8 w-8 text-white/80" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-3 text-white drop-shadow-2xl sanskrit-style devanagari-accent">
                स्वास्थ्य सहायक चैटबॉट
              </h1>
              <h2 className="text-2xl font-semibold mb-2 text-white/95 hindi-accent">
                Health Assistant Chatbot
              </h2>
              <p className="text-white/90 text-xl flex items-center gap-2">
                <span>💬</span> <span className="sanskrit-style">Ask Health Questions • स्वास्थ्य परामर्श</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-300px)]">
          {/* Chat Section */}
          <div className="lg:col-span-2">
            <Card className="h-full flex flex-col border-4 border-primary/30 shadow-2xl indian-card">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b">
                <CardTitle className="flex items-center gap-3 text-primary text-xl">
                  <div className="bg-primary/20 p-2 rounded-full">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <span className="sanskrit-style">🩺 Health Chat Assistant</span>
                </CardTitle>
                <CardDescription className="text-lg">
                  Ask medical queries, symptoms, and health advice using our AI-powered assistant
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-full p-6" ref={chatContainerRef}>
                  {messages.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="bg-gradient-to-br from-primary/20 via-white to-secondary/20 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6 shadow-2xl indian-card">
                        <HeartPulse className="h-12 w-12 text-primary" />
                      </div>
                      <h3 className="text-2xl font-bold mb-4 text-primary sanskrit-style">🙏 Welcome to Health Chatbot</h3>
                      <p className="text-muted-foreground mb-6 max-w-2xl mx-auto text-lg">
                        Get quick, reliable, and safe health guidance from our AI-powered virtual assistant.
                      </p>
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
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                            <p className="text-xs opacity-70 mt-2">{message.timestamp}</p>
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-muted border-2 border-primary/20 indian-card rounded-2xl p-4">
                            <div className="flex items-center gap-3">
                              <Loader2 className="h-4 w-4 text-primary animate-spin" />
                              <p className="text-sm text-muted-foreground">Analyzing your health question...</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>

              {/* Input Section */}
              <div className="border-t p-6 bg-gradient-to-r from-primary/5 to-secondary/5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask a health-related question..."
                    className="flex-1 p-3 border-2 border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary indian-card"
                  />
                  <Button
                    onClick={handleSendQuestion}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-primary to-secondary text-white shadow-lg px-6"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-5 w-5 mr-2" />Send</>}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Features */}
            <Card className="border-4 border-secondary/30 shadow-2xl indian-card peacock-pattern">
              <CardHeader className="bg-gradient-to-r from-secondary/10 to-secondary/5">
                <CardTitle className="text-secondary text-lg sanskrit-style flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />🌿 Health Features • स्वास्थ्य सुविधाएं
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <Feature icon={<Stethoscope className="h-5 w-5 text-green-600" />} title="Medical Advice" desc="Get AI-guided answers to your health questions" />
                <Feature icon={<Pill className="h-5 w-5 text-green-600" />} title="Medicine Info" desc="Understand usage and side effects of medicines" />
                <Feature icon={<Activity className="h-5 w-5 text-green-600" />} title="Symptom Analysis" desc="Input symptoms to get probable health insights" />
                <Feature icon={<ShieldCheck className="h-5 w-5 text-green-600" />} title="Safe & Private" desc="Your data is handled securely and confidentially" />
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-4 border-accent/30 shadow-2xl indian-card mandala-pattern">
              <CardHeader className="bg-gradient-to-r from-accent/10 to-accent/5">
                <CardTitle className="text-accent text-lg sanskrit-style flex items-center gap-2">
                  <Zap className="h-5 w-5" />⚡ Quick Actions • त्वरित सुझाव
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-3">
                <QuickAction text="What could be causing headaches?" />
                <QuickAction text="Give me a healthy diet plan for stress" />
                <QuickAction text="Suggest home remedies for cold and cough" />
                <QuickAction text="When should I see a doctor?" />
              </CardContent>
            </Card>

            {/* WhatsApp Support */}
            <Card className="border-4 border-green-400/30 shadow-xl indian-card">
              <CardHeader className="bg-gradient-to-r from-green-100 to-white">
                <CardTitle className="text-green-600 text-lg flex items-center gap-2">
                  <Phone className="h-5 w-5" />📱 WhatsApp Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Chat with our AI Health Assistant directly on WhatsApp for 24×7 instant responses.
                </p>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white w-full"
                  onClick={() => window.open("https://wa.me/919876543210?text=Hi%20Health%20Bot", "_blank")}
                >
                  Chat on WhatsApp
                </Button>
              </CardContent>
            </Card>

            {/* Tip */}
            <Alert className="border-primary/30 bg-primary/5 indian-card">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                💡 <strong>Tip:</strong> Always verify AI answers with a licensed doctor for critical medical decisions.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </main>
    </div>
  )
}

// Reusable subcomponents
const Feature = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <div className="flex items-start gap-3">
    {icon}
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  </div>
)

const QuickAction = ({ text }: { text: string }) => (
  <Button
    variant="outline"
    className="w-full justify-start bg-transparent hover:bg-primary/5"
    onClick={() => alert(`Selected question: ${text}`)}
  >
    <FileText className="h-4 w-4 mr-2" />
    {text}
  </Button>
)

export default HealthChatbotPage
