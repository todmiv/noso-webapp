import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath)
    const data = await pdfParse(dataBuffer)
    return data.text || ''
  } catch (error) {
    console.error(`Ошибка парсинга PDF ${filePath}:`, error.message)
    return ''
  }
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function estimateTokens(text) {
  // Приближённая оценка: около 4.5 символов на токен для русского текста
  return Math.ceil(text.length / 4.5)
}

async function main() {
  const documentsDir = path.join(__dirname, '..', 'public', 'documents')
  const files = fs.readdirSync(documentsDir).filter(file => file.endsWith('.pdf'))

  console.log('Анализ PDF-файлов в папке public/documents...\n')

  const results = []
  let totalSymbols = 0
  let totalTokens = 0

  for (const filename of files) {
    const filePath = path.join(documentsDir, filename)
    const text = await extractTextFromPDF(filePath)
    const symbols = text.length
    const tokens = estimateTokens(text)
    results.push({ filename, symbols, tokens })
    totalSymbols += symbols
    totalTokens += tokens
  }

  // Вывод таблицы
  console.log('┌──────────────────────────────────────────────────────┬─────────────┬─────────────┐')
  console.log('│ Название файла                                       │ Символов    │ Токенов     │')
  console.log('├──────────────────────────────────────────────────────┼─────────────┼─────────────┤')

  for (const result of results) {
    const namePadded = result.filename.padEnd(54, ' ')
    const symPadded = formatNumber(result.symbols).padStart(11, ' ')
    const tokPadded = formatNumber(result.tokens).padStart(11, ' ')
    console.log(`│ ${namePadded} │ ${symPadded} │ ${tokPadded} │`)
  }

  console.log('├──────────────────────────────────────────────────────┼─────────────┼─────────────┤')
  console.log(`│ Всего в ${files.length} файлах${' '.repeat(39)} │ ${formatNumber(totalSymbols).padStart(11, ' ')} │ ${formatNumber(totalTokens).padStart(11, ' ')} │`)
  console.log('└──────────────────────────────────────────────────────┴─────────────┴─────────────┘')
}

// Запуск
main().catch(console.error)
