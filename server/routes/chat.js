import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import mammoth from 'mammoth'
import * as cheerio from 'cheerio'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Функция для логирования работы RAG в файл
const logRAGToFile = (entry) => {
  const logFilePath = path.join(__dirname, '..', '..', 'rag_log.txt')
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] ${entry}\n\n`
  try {
    fs.appendFileSync(logFilePath, logEntry)
  } catch (error) {
    console.error('Ошибка записи в лог RAG:', error.message)
  }
}

// Вспомогательные функции для BM25
const tokenize = (text) => {
  return text.toLowerCase().match(/\b\w+\b/g) || []
}

const termFrequency = (term, terms) => {
  return terms.filter(t => t === term).length
}

const documentFrequency = (term, chunks) => {
  return chunks.filter(chunk => tokenize(chunk.text).includes(term)).length
}

const averageDocLength = (chunks) => {
  const totalTerms = chunks.reduce((sum, chunk) => sum + tokenize(chunk.text).length, 0)
  return totalTerms / chunks.length
}

const computeBM25 = (query, chunks) => {
  if (!chunks || chunks.length === 0) return []

  const queryTerms = tokenize(query)
  const avdl = averageDocLength(chunks)

  const scores = chunks.map(chunk => {
    const docTerms = tokenize(chunk.text)
    const dl = docTerms.length

    let score = 0
    const termSet = new Set(queryTerms) // unique terms

    for (const term of termSet) {
      const tf = termFrequency(term, docTerms)
      if (tf === 0) continue

      const df = documentFrequency(term, chunks)
      const idf = Math.log((chunks.length - df + 0.5) / (df + 0.5))
      const k1 = 1.5
      const b = 0.75

      score += idf * ((k1 + 1) * tf) / (k1 * (1 - b + b * dl / avdl) + tf)
    }

    return { ...chunk, bm25Score: score }
  })

  return scores.sort((a, b) => b.bm25Score - a.bm25Score)
}

const router = express.Router()

// Загрузка эмбеддингов (обязательно)
let embeddings = null
try {
  const embeddingsPath = path.join(__dirname, '..', '..', 'public', 'data', 'embeddings.json')
  if (fs.existsSync(embeddingsPath)) {
    embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'))
  console.log(`✅ Загружено ${Object.keys(embeddings).length} эмбеддингов документов с чанками`)
  } else {
    throw new Error('Файл embeddings.json не найден')
  }
} catch (error) {
  console.error('❌ Критическая ошибка: не удалось загрузить эмбеддинги:', error.message)
  process.exit(1)
}

// Загрузка эмбеддингов документов (обязательно)
let embeddingsDocs = null
try {
  const embeddingsDocsPath = path.join(__dirname, '..', '..', 'public', 'data', 'embeddings_docs.json')
  if (fs.existsSync(embeddingsDocsPath)) {
    embeddingsDocs = JSON.parse(fs.readFileSync(embeddingsDocsPath, 'utf8'))
    console.log(`✅ Загружено ${Object.keys(embeddingsDocs).length} эмбеддингов документов`)
  } else {
    throw new Error('Файл embeddings_docs.json не найден')
  }
} catch (error) {
  console.error('❌ Критическая ошибка: не удалось загрузить эмбеддинги документов:', error.message)
  process.exit(1)
}

// Функция для чтения PDF и извлечения текста
const extractTextFromPDF = async (filePath) => {
  console.log('Extracting PDF text from path:', filePath)
  try {
    // Читаем файл в буфер
    const dataBuffer = fs.readFileSync(filePath)
    console.log('PDF buffer read, length:', dataBuffer.length)

    // Парсим PDF и извлекаем текст
    const data = await pdfParse(dataBuffer)

    // Возвращаем извлеченный текст
    return data.text || ''
  } catch (error) {
    console.error(`Ошибка парсинга PDF ${filePath}:`, error.message)
    console.error('Error details:', error)
    // В случае ошибки возвращаем пустую строку
    return ''
  }
}

// Функция для извлечения текста из документов
const extractTextFromDocument = async (filename) => {
  try {
    const filePath = path.join(__dirname, '..', '..', 'public', 'documents', filename)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл не найден: ${filename}`)
    }

    const ext = path.extname(filename).toLowerCase()

    if (ext === '.htm' || ext === '.html') {
      // Извлечение текста из HTML
      const html = fs.readFileSync(filePath, 'utf8')
      const $ = cheerio.load(html)
      // Убираем скрипты, стили и другие нежелательные элементы
      $('script, style, nav, header, footer, aside').remove()
      // Извлекаем текст из body
      const text = $('body').text().replace(/\s+/g, ' ').trim()
      return text
    } else if (ext === '.docx') {
      // Извлечение текста из DOCX
      const buffer = fs.readFileSync(filePath)
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    } else if (ext === '.pdf') {
      // Извлечение текста из PDF
      return await extractTextFromPDF(filePath)
    } else {
      return ''
    }
  } catch (error) {
    console.error(`Ошибка извлечения текста из ${filename}:`, error.message)
    return ''
  }
}

const getDocumentLength = async (filename) => {
  const text = await extractTextFromDocument(filename)
  return text.length
}

// Функция для генерации эмбеддинга текста через Yandex API
const generateEmbedding = async (text) => {
  try {
    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.YANDEX_API_KEY}`,
        'x-folder-id': process.env.YANDEX_FOLDER_ID,
      },
      body: JSON.stringify({
        modelUri: `emb://${process.env.YANDEX_FOLDER_ID}/text-search-query/latest`,
        text: text,
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return data.embedding
  } catch (error) {
    console.error('Ошибка генерации эмбеддинга:', error.message)
    return null
  }
}

// Функция для генерации ответа через YandexGPT
const generateAnswer = async (query, context) => {
  try {
    let prompt = ''
    if (context) {
      prompt = `На основе предоставленных документов СРО НОСО ответьте на вопрос пользователя. Если информация отсутствует, скажите об этом и предложите перефразировать вопрос или обратиться к специалистам.\n\nВопрос: ${query}\n\n${context}`
    } else {
      prompt = `Вопрос к системе СРО НОСО: ${query}\n\nК сожалению, мне не удалось найти релевантную информацию в документах. Рекомендую перефразировать вопрос или обратиться к специалистам.`
    }
    console.log('Prompt sent to YandexGPT:', prompt)

    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.YANDEX_API_KEY}`,
        'x-folder-id': process.env.YANDEX_FOLDER_ID,
      },
      body: JSON.stringify({
        modelUri: `gpt://${process.env.YANDEX_FOLDER_ID}/yandexgpt-lite`,
        completionOptions: {
          stream: false,
          temperature: 0.6,
          maxTokens: 2000,
        },
        messages: [
          {
            role: 'user',
            text: prompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`YandexGPT API error: ${response.status}`)
    }

    const data = await response.json()
    const generatedText = data.result.alternatives[0].message.text.trim()
    console.log('YandexGPT response:', generatedText)
    return generatedText
  } catch (error) {
    console.error('Ошибка генерации ответа через YandexGPT:', error.message)
    return 'Извините, произошла ошибка при генерации ответа. Попробуйте позже.'
  }
}

// Вычисление косинусного сходства
const cosineSimilarity = (vecA, vecB) => {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
  return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0
}

// Функция для расширения запроса через LLM
const generateQueryExpansions = async (query) => {
  try {
    const expansionPrompt = `Ваша задача - перефразировать вопрос пользователя несколькими способами (3-5) и выделить ключевые слова и синонимы. Формат ответа: список перефразировок через точку с запятой; ключевые слова.

    Вопрос пользователя: ${query}`

    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.YANDEX_API_KEY}`,
        'x-folder-id': process.env.YANDEX_FOLDER_ID,
      },
      body: JSON.stringify({
        modelUri: `gpt://${process.env.YANDEX_FOLDER_ID}/yandexgpt-lite`,
        completionOptions: {
          stream: false,
          temperature: 0.7,
          maxTokens: 500,
        },
        messages: [
          {
            role: 'user',
            text: expansionPrompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`YandexGPT API error: ${response.status}`)
    }

    const data = await response.json()
    const expandedText = data.result.alternatives[0].message.text.trim()

    // Парсим ответ
    const parts = expandedText.split(';').map(p => p.trim())
    const paraphrasesRaw = parts[0] ? parts[0].split(/\d+\.?\)?/).map(p => p.trim()).filter(p => p.length > 0) : []
    const paraphrases = paraphrasesRaw.slice(0, 2) // Берем до 2 перефраз

    const expandedQueries = [query, ...paraphrases.slice(0, 4)] // Берём до 4 перефраз
    console.log(`Расширенный запрос: ${expandedQueries.join(' | ')}`)
    return expandedQueries
  } catch (error) {
    console.error('Ошибка расширения запроса:', error.message)
    return [query] // Fallback к оригинальному
  }
}

// Функция для поиска релевантных документов через семантический поиск по эмбеддингам документов
const findRelevantDocumentsByDocs = async (query) => {
  try {
    // Расширяем запрос
    const expandedQueries = await generateQueryExpansions(query)
    console.log(`Расширено до ${expandedQueries.length} запросов`)

    // Генерируем эмбеддинги для всех расширенных запросов параллельно
    const embeddingsPromises = expandedQueries.map(q => generateEmbedding(q))
    const queryEmbeddings = await Promise.all(embeddingsPromises)

    // Фильтруем успешные
    const validEmbeddings = queryEmbeddings.filter(emb => emb !== null)
    if (validEmbeddings.length === 0) {
      console.warn('Не удалось сгенерировать эмбеддинги для запросов - используем текстовый поиск по документам')
      return await textBasedSearch(query)
    }

    // Загрузка метаданных документов
    const documentsPath = path.join(__dirname, '..', '..', 'public', 'data', 'documents.json')
    const documents = JSON.parse(fs.readFileSync(documentsPath, 'utf8'))

    // Собираем кандидатов документов из расширенных запросов
    const candidateMap = new Map() // key: docId -> {doc obj}
    for (const qEmbedding of validEmbeddings) {
      Object.keys(embeddingsDocs).forEach(docId => {
        const docEmbedding = embeddingsDocs[docId]
        if (docEmbedding.embedding) {
          const similarity = cosineSimilarity(qEmbedding, docEmbedding.embedding)
          if (similarity > 0.15) {
            const key = docId
            const docMetadata = documents.find(d => d.id.toString() === docId)
            if (!candidateMap.has(key)) {
              candidateMap.set(key, {
                docId: docId,
                title: docEmbedding.title,
                filename: docEmbedding.filename,
                category: docMetadata?.category || 'Неизвестно',
                description: docMetadata?.description || '',
                similarity: similarity
              })
            } else {
              // Обновляем максимальную similarity
              if (similarity > candidateMap.get(key).similarity) {
                candidateMap.get(key).similarity = similarity
              }
            }
          }
        }
      })
    }

    const candidateDocs = Array.from(candidateMap.values())

    // Семантический поиск по документам: топ-3
    const topDocs = candidateDocs
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .filter(doc => doc.similarity > 0.15)

    console.log(`Найдено ${topDocs.length} релевантных документов:`, topDocs.map(d => ({ title: d.title, sim: d.similarity.toFixed(3) })))

    // Извлекаем полный текст для найденных документов
    const documentsWithText = await Promise.all(
      topDocs.map(async (doc) => {
        const text = await extractTextFromDocument(doc.filename)
        return {
          id: doc.docId,
          title: doc.title,
          filename: doc.filename,
          category: doc.category,
          description: doc.description || '',
          similarity: doc.similarity,
          content: text.substring(0, 10000) // Усекаем до 10000 символов для избежания превышения лимита
        }
      })
    )

    // Логируем найденные документы
    let docsLog = `Найденные документы (${documentsWithText.length}):\n`
    documentsWithText.forEach((doc, i) => {
      docsLog += `Документ ${i+1} (sim: ${doc.similarity.toFixed(3)}) "${doc.title}":\n${doc.content.substring(0, 1000)}...\n\n`
    })
    logRAGToFile(docsLog)

    return documentsWithText
  } catch (error) {
    console.error('Ошибка семантического поиска по документам:', error.message)
    return await textBasedSearch(query)
  }
}

// Функция для поиска релевантных чанков через семантический поиск по эмбеддингам
const findRelevantDocuments = async (query) => {
  try {
    // Расширяем запрос
    const expandedQueries = await generateQueryExpansions(query)
    console.log(`Расширено до ${expandedQueries.length} запросов`)

    // Генерируем эмбеддинги для всех расширенных запросов параллельно
    const embeddingsPromises = expandedQueries.map(q => generateEmbedding(q))
    const queryEmbeddings = await Promise.all(embeddingsPromises)

    // Фильтруем успешные
    const validEmbeddings = queryEmbeddings.filter(emb => emb !== null)
    if (validEmbeddings.length === 0) {
      console.warn('Не удалось сгенерировать эмбеддинги для запросов - используем текстовый поиск')
      return await textBasedSearch(query)
    }

    // Загрузка метаданных документов
    const documentsPath = path.join(__dirname, '..', '..', 'public', 'data', 'documents.json')
    const documents = JSON.parse(fs.readFileSync(documentsPath, 'utf8'))

    // Собираем кандидатов чанков из расширенных запросов
    const candidateMap = new Map() // key: docId-chunkIndex -> {chunk obj}
    for (const qEmbedding of validEmbeddings) {
      Object.keys(embeddings).forEach(docId => {
        const docEmbeddingData = embeddings[docId]
        if (docEmbeddingData.chunks) {
          docEmbeddingData.chunks.forEach((chunk, index) => {
            const similarity = cosineSimilarity(qEmbedding, chunk.embedding)
            if (similarity > 0.05) {
              const key = `${docId}-${index}`
              const docMetadata = documents.find(d => d.id.toString() === docId)
              if (!candidateMap.has(key)) {
                candidateMap.set(key, {
                  docId: docId,
                  chunkIndex: index,
                  title: docEmbeddingData.title,
                  filename: docEmbeddingData.filename,
                  category: docMetadata?.category || 'Неизвестно',
                  text: chunk.text,
                  similarity: similarity,
                  bm25Score: 0
                })
              } else {
                // Обновляем максимальную similarity
                if (similarity > candidateMap.get(key).similarity) {
                  candidateMap.get(key).similarity = similarity
                }
              }
            }
          })
        }
      })
    }

    const allChunks = Array.from(candidateMap.values())

    // Семантический поиск: топ-5 чанков
    const topSemantic = allChunks
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .filter(chunk => chunk.similarity > 0.10)

    // BM25 поиск: топ-5 чанков
    const topBM25 = computeBM25(query, allChunks)
      .slice(0, 5)
      .filter(chunk => chunk.bm25Score > 0) // Фильтр по BM25 score > 0

    console.log(`Семантический поиск: ${topSemantic.length} чанков`)
    console.log(`BM25 поиск: ${topBM25.length} чанков`)

    // Комбинируем: топ-3 из семантического + топ-5 из BM25
    const selectedChunks = new Set()
    const topChunks = []

    // Добавляем из semantic: топ-3
    const topSemanticTop3 = topSemantic.slice(0, 3)
    topSemanticTop3.forEach(chunk => {
      const key = `${chunk.docId}-${chunk.chunkIndex}`
      if (!selectedChunks.has(key)) {
        selectedChunks.add(key)
        topChunks.push(chunk)
      }
    })

    // Добавляем из BM25: топ-5
    topBM25.forEach(chunk => {
      if (topChunks.length < 8) {
        const key = `${chunk.docId}-${chunk.chunkIndex}`
        if (!selectedChunks.has(key)) {
          selectedChunks.add(key)
          topChunks.push(chunk)
        }
      }
    })

    console.log(`Найдено ${topChunks.length} релевантных чанков после комбинации:`, topChunks.map(c => ({ title: c.title, sim: c.similarity.toFixed(3), bm25: (c.bm25Score || 0).toFixed(2) })))

    // Логируем найденные чанки с полными текстами
    let chunksLog = `Найденные чанки (${topChunks.length}):\n`
    topChunks.forEach((chunk, i) => {
      chunksLog += `Чанк ${i+1} (sim: ${chunk.similarity.toFixed(3)}, BM25: ${(chunk.bm25Score || 0).toFixed(2)}) из "${chunk.title}":\n${chunk.text}\n\n`
    })
    logRAGToFile(chunksLog)

    // Группируем чанки по документам для возврата
    const documentsWithText = topChunks.map(chunk => ({
      id: chunk.docId,
      title: chunk.title,
      filename: chunk.filename,
      category: chunk.category,
      similarity: chunk.similarity,
      content: chunk.text // Текст чанка
    }))

    return documentsWithText
  } catch (error) {
    console.error('Ошибка семантического поиска:', error.message)
    // Fallback to text search
    return await textBasedSearch(query)
  }
}

// Fallback функция для текстового поиска
const textBasedSearch = async (query) => {
  try {
    const documentsPath = path.join(__dirname, '..', '..', 'public', 'data', 'documents.json')
    const documents = JSON.parse(fs.readFileSync(documentsPath, 'utf8'))

    const queryLower = query.toLowerCase()
    const relevantDocs = documents.filter(doc =>
      doc.title.toLowerCase().includes(queryLower) ||
      doc.description.toLowerCase().includes(queryLower)
    ).slice(0, 3)

    const documentsWithText = await Promise.all(
      relevantDocs.map(async (doc) => {
        const text = await extractTextFromDocument(doc.filename)
        return {
          ...doc,
          content: text.substring(0, 3000)
        }
      })
    )

    return documentsWithText
  } catch (error) {
    console.error('Ошибка текстового поиска:', error.message)
    return []
  }
}

// Роут для чата
router.post('/', async (req, res) => {
  try {
    const { message, mode } = req.body

    if (!message) {
      return res.status(400).json({
        error: 'Missing message',
        message: 'Необходимо передать сообщение'
      })
    }

    console.log('Получено сообщение:', message, 'режим:', mode || 'chunks')
    logRAGToFile(`=== Новый запрос ===\nПользователь: ${message}\nРежим: ${mode || 'chunks'}`)

    // Находим релевантные документы в зависимости от режима
    const relevantDocuments = mode === 'documents'
      ? await findRelevantDocumentsByDocs(message)
      : await findRelevantDocuments(message)

    // Формируем контекст
    let context = ''
    if (relevantDocuments.length > 0) {
      context = '\n\nДокументы для справки:\n' + relevantDocuments.map(doc =>
        `Название: ${doc.title}\nКатегория: ${doc.category}\nОписание: ${doc.description}\nСодержание: ${doc.content}`
      ).join('\n\n')
    }
    console.log('Context length:', context.length, 'first 500 chars:', context.substring(0, 500))
    logRAGToFile(`Сформированный контекст (длина: ${context.length}):\n${context}`)

    // Генерируем ответ через YandexGPT на основе документов
    const response = await generateAnswer(message, context)
    logRAGToFile(`Ответ YandexGPT:\n${response}`)

    const responseData = {
      response: response,
      sources: relevantDocuments.map(doc => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        filename: doc.filename,
        similarity: doc.similarity || 0  // Добавляем схожесть если есть
      })),
      timestamp: new Date().toISOString()
    }

    res.json(responseData)

  } catch (error) {
    console.error('Ошибка обработки чата:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Произошла ошибка при обработке вашего запроса'
    })
  }
})

// Роут для проверки здоровья чата
router.get('/health', async (req, res) => {
  res.json({
    status: 'OK',
    embeddings_loaded: embeddings !== null,
    documents_available: await findRelevantDocuments('test').then(docs => docs.length > 0),
    timestamp: new Date().toISOString()
  })
})

export default router
