import React from 'react'

interface SearchBarProps {
  query: string
  onQueryChange: (query: string) => void
  categories: string[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
}

export const SearchBar = ({
  query,
  onQueryChange,
  categories,
  selectedCategory,
  onCategoryChange,
}: SearchBarProps) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Найдите документы по названию или описанию..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="input-field pl-10"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-gray-700">Категория:</span>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedCategory === category
                  ? 'bg-noso-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
