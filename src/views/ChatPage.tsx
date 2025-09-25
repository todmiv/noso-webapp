import React, { useState } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'documents' | 'chunks'>('documents') // по умолчанию документы

  const predefinedQuestions = [
    'Какие требования к квалификации для обязательных специалистов?',
    'Какие наказания за нарушение требований?',
    'Как проводится анализ деятельности членов?',
    'Какие документы нужны для получения разрешения?'
  ]

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          mode: mode, // Добавляем режим
          conversation_history: messages.slice(-20), // Отправляем последние 20 сообщений
        }),
      })

      if (!response.ok) {
        throw new Error('Не удалось получить ответ от сервера')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error)

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Извините, произошла ошибка при обработке вашего запроса. Попробуйте позже.',
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputMessage)
  }

  const handleQuickQuestion = (question: string) => {
    sendMessage(question)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">ИИ-консультант СРО НОСО</h1>
        <p className="text-gray-600">
          Задайте любой вопрос по документам СРО НОСО и получите подробный ответ
        </p>
      </div>

      {/* Режим поиска */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Режим обработки запросов:</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <button
            onClick={() => setMode('documents')}
            className={`p-3 text-center rounded-lg transition-colors ${
              mode === 'documents'
                ? 'bg-noso-primary text-white border-noso-primary'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div>
              Режим <code>documents</code>
              <br />Расширение запроса: 4 из 3–5, gpt-lite, t 0.7
              <br />Семантический поиск: косинус больше 0.15
              <br />Извлечение контекста: топ-3, до 10 000 симв.
              <br />Генерация ответа: yandexgpt-lite, t 0.6, до 2 000 ток.
            </div>
          </button>
          <button
            onClick={() => setMode('chunks')}
            className={`p-3 text-center rounded-lg transition-colors ${
              mode === 'chunks'
                ? 'bg-noso-primary text-white border-noso-primary'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div>
              Режим <code>chunks</code>
              <br />Расширение запроса: 4 из 3–5, gpt-lite, t 0.7
              <br />Семантический поиск: косинус больше 0.10, топ-5
              <br />BM25 поиск: порог больше 0, топ-5, k1 = 1.5, b = 0.75
              <br />Комбинация: семантика - топ-3 + BM25 - топ-5
              <br />Извлечение контекста: чанки без усечения, топ-8
              <br />Генерация ответа: yandexgpt-lite, t 0.6, до 2 000 ток.
            </div>
          </button>
        </div>
      </div>

      {/* Быстрые вопросы */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Популярные вопросы:</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {predefinedQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => handleQuickQuestion(question)}
              disabled={isLoading}
              className="p-3 text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-noso-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      {/* Чат */}
      <div className="bg-white rounded-lg shadow-lg">
        {/* Сообщения */}
        <div className="h-96 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-16">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2l3.09 6.26L22 15.74l-7.91 5.79L12 30l-3.09-7.47L1 15.74l7.91-5.79L12 2z" />
                </svg>
              </div>
              <p className="text-lg">Добро пожаловать!</p>
              <p className="text-sm mt-1">Задайте вопрос по документам СРО НОСО</p>
            </div>
          ) : (
            messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-noso-primary text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-noso-primary"></div>
                  <span className="text-gray-600 text-sm">Печатает...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Поле ввода */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Задайте вопрос..."
              disabled={isLoading}
              className="input-field flex-1"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="btn btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Отправка...' : 'Отправить'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ChatPage
