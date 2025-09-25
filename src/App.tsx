import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Динамические импорты для lazy loading
const DocumentsPage = React.lazy(() => import('./views/DocumentsPage'))
const ChatPage = React.lazy(() => import('./views/ChatPage'))
const Header = React.lazy(() => import('./components/Header'))
const Footer = React.lazy(() => import('./components/Footer'))

import './index.css'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <React.Suspense
          fallback={
            <div className="flex justify-center items-center h-16 bg-white shadow-sm">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-noso-primary"></div>
            </div>
          }
        >
          <Header />
        </React.Suspense>

        <main className="container mx-auto px-4 py-8">
          <React.Suspense
            fallback={
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-noso-primary"></div>
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Navigate to="/documents" replace />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/chat" element={<ChatPage />} />
            </Routes>
          </React.Suspense>
        </main>

        <React.Suspense fallback={<div />}>
          <Footer />
        </React.Suspense>
      </div>
    </BrowserRouter>
  )
}

export default App
