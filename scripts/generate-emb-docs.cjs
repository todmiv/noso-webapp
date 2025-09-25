#!/usr/bin/env node

/**
 * Скрипт для генерации эмбеддингов документов целиком
 * Используется для режима 'documents' в системе RAG
 * Экспорт: public/data/embeddings_docs.json
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const pdfParse = require('pdf-parse')
const dotenv = require('dotenv')

// Загружаем переменные окружения из .env файла
dotenv.config()

// Настройки для Yandex Foundation Models
const YANDEX_API_KEY = process.env.YANDEX_API_KEY
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID
const DOCUMENTS_DIR = path.join(__dirname, '..', 'public', 'documents')
const DATA_DIR = path.join(__dirname, '..', 'public', 'data')
const DOCUMENTS_JSON = path.join(DATA_DIR, 'documents.json')
const EMBEDDINGS_JSON = path.join(DATA_DIR, 'embeddings_docs.json')
const LOG_FILE = path.join(DATA_DIR, 'embeddings_docs.log')

// Функция для записи в лог-файл
function logToFile(message, level = 'INFO') {
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] ${level}: ${message}\n`

  try {
    fs.appendFileSync(LOG_FILE, logEntry)
  } catch (error) {
    console.error('Ошибка записи в лог-файл:', error.message)
  }
}

// Функция для очистки лог-файла
function clearLogFile() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE)
    }
  } catch (error) {
    console.error('Ошибка очистки лог-файла:', error.message)
  }
}

// Проверка доступности Yandex API
async function checkAPIConnectivity() {
  console.log('🔍 Проверяем доступность Yandex API...')

  return new Promise((resolve) => {
    const options = {
      hostname: 'llm.api.cloud.yandex.net',
      port: 443,
      path: '/',
      method: 'HEAD',
      headers: {
        'User-Agent': 'NodeJS-Embedding-Script/1.0'
      }
    }

    const req = https.request(options, (res) => {
      console.log(`🌐 Ответ сервера: HTTP ${res.statusCode}`)

      if (res.statusCode >= 200 && res.statusCode < 400) {
        console.log('✅ Yandex API доступен')
        resolve(true)
      } else if (res.statusCode === 404) {
        console.log('✅ DNS разрешение работает, API эндпоинт найден')
        resolve(true)
      } else {
        console.log(`⚠️  Неожиданный статус ответа: ${res.statusCode}`)
        resolve(false)
      }
    })

    req.on('error', (error) => {
      if (error.code === 'ENOTFOUND') {
        console.log('❌ DNS ошибка: домен foundation-models.api.cloud.yandex.net не найден - проверьте DNS или реальный hostname')
      } else if (error.code === 'ECONNREFUSED') {
        console.log('❌ Отказ в подключении: возможно, геоблокировка или firewall')
      } else if (error.code === 'ETIMEDOUT') {
        console.log('❌ Таймаут подключения')
      } else {
        console.log(`❌ Сетевая ошибка: ${error.code} - ${error.message}`)
      }
      resolve(false)
    })

    req.setTimeout(10000, () => {
      console.log('❌ Превышен таймаут подключения к Yandex API (10 сек)')
      req.destroy()
      resolve(false)
    })

    req.end()
  })
}

// Проверка зависимостей
if (!YANDEX_API_KEY) {
  console.error('❌ Ошибка: YANDEX_API_KEY не найден в переменных окружения')
  console.error('Установите переменную: $env:YANDEX_API_KEY="ваш_ключ_яндекса"')
  process.exit(1)
}

if (!YANDEX_FOLDER_ID) {
  console.error('❌ Ошибка: YANDEX_FOLDER_ID не найден в переменных окружения')
  console.error('Установите переменную: $env:YANDEX_FOLDER_ID="ваш_folder_id"')
  process.exit(1)
}

if (!fs.existsSync(DOCUMENTS_DIR)) {
  console.error(`❌ Директория документов не найдена: ${DOCUMENTS_DIR}`)
  process.exit(1)
}

if (!fs.existsSync(DOCUMENTS_JSON)) {
  console.error(`❌ Файл documents.json не найден: ${DOCUMENTS_JSON}`)
  process.exit(1)
}

// Загрузка метаданных документов
let documents
try {
  documents = JSON.parse(fs.readFileSync(DOCUMENTS_JSON, 'utf8'))
} catch (error) {
  console.error('❌ Ошибка чтения documents.json:', error.message)
  process.exit(1)
}

// Функция для чтения PDF и извлечения текста
async function extractTextFromPDF(filePath) {
  try {
    // Читаем файл в буфер
    const dataBuffer = fs.readFileSync(filePath)
    logToFile(`Файл прочитан: ${filePath} (${dataBuffer.length} байт)`)

    // Парсим PDF и извлекаем текст
    const data = await pdfParse(dataBuffer)
    logToFile(`PDF разобран: ${data.numpages} страниц, ${data.text.length} символов`)

    // Возвращаем извлеченный текст
    return data.text || `Текст документа из файла: ${path.basename(filePath)}`
  } catch (error) {
    logToFile(`Ошибка парсинга PDF ${path.basename(filePath)}: ${error.message}`, 'ERROR')
    // В случае ошибки возвращаем заглушку
    return `Текст документа из файла: ${path.basename(filePath)}. Ошибка извлечения текста.`
  }
}

// Функция для генерации эмбеддинга через Yandex Foundation Models
async function generateEmbedding(text) {
  logToFile(`Отправка запроса на эмбеддинг документа: ${text.substring(0, 100)}...`);

  try {
    const options = {
      hostname: 'llm.api.cloud.yandex.net',
      port: 443,
      path: '/foundationModels/v1/textEmbedding',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${YANDEX_API_KEY}`,
        'x-folder-id': YANDEX_FOLDER_ID,
      },
    };

    const payload = {
      modelUri: `emb://${YANDEX_FOLDER_ID}t ext-search-doc/latest`,
      text: text,
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            logToFile(`Получен ответ API: ${res.statusCode}`);
            const response = JSON.parse(data);
            if (response.embedding) {
              logToFile(`Эмбеддинг получен, размер: ${response.embedding.length} измерений`);
              resolve(response.embedding);
            } else {
              logToFile(`Некорректный ответ API: ${data.substring(0, 200)}...`, 'ERROR');
              reject(new Error(`Неверный формат ответа: ${data}`));
            }
          } catch (error) {
            logToFile(`Ошибка парсинга ответа: ${error.message}`, 'ERROR');
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        logToFile(`Ошибка HTTP запроса: ${error.message}`, 'ERROR');
        reject(new Error(`Request error: ${error.message}`));
      });

      req.setTimeout(30000, () => {
        logToFile('Таймаут API запроса (30 сек)', 'ERROR');
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(JSON.stringify(payload));
      req.end()
    });
  } catch (error) {
    logToFile(`Неожиданная ошибка в generateEmbedding: ${error.message}`, 'ERROR');
    throw error;
  }
}

// Основная функция
async function main() {
  clearLogFile()

  console.log('🚀 Начинаем генерацию эмбеддингов документов (целые документы)...')
  logToFile('Начало генерации эмбеддингов документов')

  // Проверяем доступность Yandex API
  const isAPIAvailable = await checkAPIConnectivity()
  if (!isAPIAvailable) {
    console.log('❌ Yandex API недоступен. Обработка остановлена.')
    logToFile('Yandex API недоступен - завершение работы', 'ERROR')
    process.exit(1)
  } else {
    console.log('🎉 API доступен! Начинаем обработку документов.')
    logToFile('Yandex API доступен - начинаем обработку')
  }

  const embeddings = {}
  let processedCount = 0
  let errorCount = 0

  for (const doc of documents) {
    console.log(`📄 Обрабатываем: ${doc.filename}`)
    logToFile(`Начинаем обработку документа: ${doc.filename}`)

    const filePath = path.join(DOCUMENTS_DIR, doc.filename)
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Файл не найден: ${doc.filename}`)
      logToFile(`Файл не найден: ${doc.filename}`, 'WARN')
      continue
    }

    try {
      // Извлекаем полный текст из PDF
      logToFile(`Начало чтения PDF: ${doc.filename}`)
      const fullText = await extractTextFromPDF(filePath)
      logToFile(`Извлечен текст длиной: ${fullText.length} символов`)

      // Ограничиваем текст до 10000 символов для режима documents
      // (как в findRelevantDocumentsByDocs в chat.js)
      const truncatedText = fullText.substring(0, 10000)
      logToFile(`Текст ограничен до ${truncatedText.length} символов (максимум 10000)`)

      if (truncatedText.length === 0) {
        console.warn(`⚠️ Пустой текст в документе: ${doc.filename}`)
        logToFile(`Пустой текст в документе: ${doc.filename}`, 'WARN')
        continue
      }

      // Генерация эмбеддинга для всего документа
      logToFile('Генерация эмбеддинга для всего документа')
      const embedding = await generateEmbedding(truncatedText)

      // Сохраняем эмбеддинг документа
      embeddings[doc.id] = {
        filename: doc.filename,
        title: doc.title,
        embedding: embedding,
        text_length: truncatedText.length,
        processed_at: new Date().toISOString()
      }

      logToFile(`Эмбеддинг документа сохранен: ${doc.title}, размер: ${embedding.length}`, 'SUCCESS')

      processedCount++

      // Сохраняем промежуточные результаты
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true })
        logToFile('Создана директория данных')
      }

      fs.writeFileSync(EMBEDDINGS_JSON, JSON.stringify(embeddings, null, 2))
      logToFile(`Промежуточные данные сохранены в ${EMBEDDINGS_JSON}`)

      // Задержка между документами для предотвращения rate limiting
      if (documents.indexOf(doc) < documents.length - 1) {
        console.log('⏳ Ждем 2 секунды перед следующим документом...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

    } catch (error) {
      errorCount++
      logToFile(`Ошибка обработки ${doc.filename}: ${error.message}`, 'ERROR')
      console.error(`❌ Ошибка при обработке ${doc.filename}:`, error.message)
    }
  }

  // Финальное сохранение
  if (processedCount > 0) {
    fs.writeFileSync(EMBEDDINGS_JSON, JSON.stringify(embeddings, null, 2))
    logToFile(`Финальные данные сохранены в ${EMBEDDINGS_JSON}`)
  }

  logToFile(`Завершение: обработано ${processedCount} документов, ошибок ${errorCount}`)

  if (processedCount === 0) {
    console.log('❌ Ни один документ не был обработан. Проверьте логи.')
    logToFile('Генерация завершилась без обработки документов')
  } else if (errorCount === 0) {
    console.log('🎉 Все документы обработаны успешно!')
    logToFile(`Все документы обработаны успешно: ${processedCount}`, 'SUCCESS')
  } else {
    console.log(`⚡ Обработано ${processedCount} документов, ошибок: ${errorCount}`)
    logToFile(`Обработка завершена: ${processedCount} успешно, ${errorCount} ошибок`)
  }

  console.log(`📋 Детальная информация записана в ${LOG_FILE}`)
  logToFile('Генерация эмбеддингов документов завершена', 'SUCCESS')

  return { processedCount, errorCount }
}

// Запуск скрипта
if (require.main === module) {
  main()
    .then(({ processedCount, errorCount }) => {
      if (processedCount === 0) {
        console.log('❌ Генерация эмбеддингов завершилась с ошибками - проверьте API ключи и подключение')
        process.exit(1)
      } else {
        console.log('🎉 Генерация эмбеддингов документов завершена успешно!')
      }
    })
    .catch((error) => {
      console.error('💥 Критическая ошибка выполнения:', error.message)
      console.error(error.stack)
      process.exit(1)
    })
}

module.exports = { main }
