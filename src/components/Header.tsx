import { Link, useLocation } from 'react-router-dom'

const Header = () => {
  const location = useLocation()

  return (
    <header className="bg-gray-600 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-3">
            <img
              src="https://www.sronoso.ru/upload/iblock/cc4/5n62e3m1ow3llchi2t0d2iqqottjt6ad/noso_logo.gif"
              alt="СРО НОСО"
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-xl font-bold text-white">СРО НОСО</h1>
              <p className="text-sm text-gray-300">Объединение строителей</p>
            </div>
          </Link>

          <nav className="flex space-x-8">
            <Link
              to="/documents"
              className={`px-3 py-2 rounded-lg transition-colors ${
                location.pathname === '/documents' || location.pathname === '/'
                  ? 'bg-noso-primary text-white'
                  : 'text-white hover:text-blue-300 hover:bg-gray-800'
              }`}
            >
              Каталог документов
            </Link>
            <Link
              to="/chat"
              className={`px-3 py-2 rounded-lg transition-colors ${
                location.pathname === '/chat'
                  ? 'bg-noso-primary text-white'
                  : 'text-white hover:text-blue-300 hover:bg-gray-800'
              }`}
            >
              ИИ-консультант
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}

export default Header
