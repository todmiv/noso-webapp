import React from 'react'

interface DocumentModalProps {
  document: {
    id: number
    title: string
    filename: string
    description: string
  } | null
  onClose: () => void
}

export const DocumentModal = ({ document, onClose }: DocumentModalProps) => {
  if (!document) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{document.title}</h2>
            <p className="text-sm text-gray-600 mt-1">{document.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Document Content Display */}
        <div className="flex-1 overflow-hidden">
          <iframe
            src={`http://localhost:3001/modal/${document.filename}`}
            className="w-full h-full min-h-[600px] border-0"
            title={document.title}
          />
        </div>
      </div>
    </div>
  )
}
