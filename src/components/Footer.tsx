const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Телефоны */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Телефоны</h3>
            <div className="text-gray-300">
              <p>+7 (831) 433-15-27</p>
              <p>+7 (831) 419-72-25</p>
            </div>
          </div>

          {/* Email */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Email</h3>
            <div className="text-gray-300">
              <p>dsrpkkov.noso@mail.ru</p>
              <p>4331527@mail.ru</p>
            </div>
          </div>

          {/* Время работы */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Время работы</h3>
            <div className="text-gray-300">
              <p>Понедельник - пятница</p>
              <p>09:00 - 17:00</p>
            </div>
          </div>

          {/* Адрес */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Адрес</h3>
            <div className="text-gray-300">
              <p>603000, Н.Новгород</p>
              <p>ул. Большая Покровская, 15</p>
              <p>помещение (офис) 7</p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; 2009 - 2025 СРО Ассоциация «Нижегородское объединение строительных организаций (НОСО)»</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
