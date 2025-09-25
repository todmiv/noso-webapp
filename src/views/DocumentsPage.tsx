import React, { useState, useEffect } from 'react'

// Динамические импорты для избежания проблем с модулями
const DocumentCard = React.lazy(() => import('../components/DocumentCard').then(module => ({ default: module.DocumentCard })))
const SearchBar = React.lazy(() => import('../components/SearchBar').then(module => ({ default: module.SearchBar })))
const DocumentModal = React.lazy(() => import('../components/DocumentModal').then(module => ({ default: module.DocumentModal })))

export interface Document {
  id: number
  title: string
  category: string
  filename: string
  description: string
}

const DocumentsPage = () => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Все')
  const [loading, setLoading] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)

  const handleOpenModal = (document: Document) => {
    setSelectedDocument(document)
  }

  const handleCloseModal = () => {
    setSelectedDocument(null)
  }

  useEffect(() => {
    // Загрузка документов из статического JSON
    fetch('http://localhost:3001/data/documents.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return response.json()
      })
      .then(data => {
        setDocuments(data)
        setFilteredDocuments(data)
        setLoading(false)
      })
      .catch(error => {
        console.error('Ошибка при загрузке документов:', error)
        console.error('Проверьте что Express сервер запущен на порту 3001')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    let filtered = documents

    // Фильтрация по категории
    if (selectedCategory !== 'Все') {
      filtered = filtered.filter(doc => doc.category === selectedCategory)
    }

    // Фильтрация по поисковому запросу
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(query) ||
        doc.description.toLowerCase().includes(query)
      )
    }

    setFilteredDocuments(filtered)
  }, [documents, searchQuery, selectedCategory])

  const categories = ['Все', ...new Set(documents.map(doc => doc.category))]

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-noso-primary"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Каталог документов</h1>
        <p className="text-gray-600">
          Найдите нужные документы СРО НОСО для вашего проекта
        </p>
      </div>

      <div className="mb-6">
        <React.Suspense
          fallback={
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-center">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          }
        >
          <SearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </React.Suspense>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <React.Suspense
          fallback={
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="animate-pulse p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-3"></div>
                <div className="h-6 bg-gray-200 rounded"></div>
              </div>
            </div>
          }
        >
          {filteredDocuments.map(document => (
            <DocumentCard
              key={document.id}
              document={document}
              onOpenModal={handleOpenModal}
            />
          ))}
        </React.Suspense>
      </div>

      {filteredDocuments.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Документы не найдены</p>
          <p className="text-gray-400 mt-2">Попробуйте изменить параметры поиска</p>
        </div>
      )}

      {/* Modal for viewing documents */}
      <React.Suspense fallback={null}>
        <DocumentModal
          document={selectedDocument}
          onClose={handleCloseModal}
        />
      </React.Suspense>
    </div>
  )
}

export default DocumentsPage
