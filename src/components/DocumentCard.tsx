import React from 'react'

interface Document {
  id: number
  title: string
  category: string
  filename: string
  description: string
}

interface DocumentCardProps {
  document: Document
  onOpenModal: (document: Document) => void
}

export const DocumentCard = ({ document, onOpenModal }: DocumentCardProps) => {
  const handleOpenDocument = () => {
    onOpenModal(document)
  }

  // Скачивание убрано, только просмотр

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 leading-tight">
            {document.title}
          </h3>
        </div>

        <div className="mb-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-noso-secondary text-noso-primary">
            {document.category}
          </span>
        </div>

        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {document.description}
        </p>

        <button
          onClick={handleOpenDocument}
          className="btn btn-primary w-full text-sm"
        >
          Открыть
        </button>
      </div>
    </div>
  )
}
