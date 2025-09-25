import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

import chatRoutes from './routes/chat.js'

// Helper function to get content type based on file extension
const getContentType = (filename) => {
  const ext = path.extname(filename).toLowerCase()
  const contentTypes = {
    '.htm': 'text/html; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.txt': 'text/plain; charset=utf-8'
  }

  return contentTypes[ext] || 'application/octet-stream'
}

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Serve documents with different dispositions based on URL parameter
app.get('/documents/*', (req, res) => {
  try {
    const fileName = path.basename(req.path)
    const filePath = path.join(__dirname, '..', 'public', 'documents', fileName)

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found')
    }

    // Set headers based on query parameter
    const disposition = req.query.action === 'download' ? 'attachment' : 'inline'

    res.set({
      'Content-Disposition': `${disposition}; filename="${fileName}"`,
      'Content-Type': getContentType(fileName)
    })

    console.log(`Serving document: ${fileName} (${disposition})`)
    res.sendFile(filePath)
  } catch (error) {
    console.error('Error serving document:', error.message)
    res.status(500).send('Error serving file')
  }
})

// Route for documents metadata
app.get('/data/documents.json', (req, res) => {
  try {
    const filePath = path.join(__dirname, '..', 'public', 'data', 'documents.json')
    console.log('Serving documents.json from:', filePath)
    res.type('application/json').sendFile(filePath)
  } catch (error) {
    console.error('Error serving documents.json:', error)
    res.status(500).send({ error: 'Failed to load documents' })
  }
})

// Routes
app.use('/api/chat', chatRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Modal document viewer route - serve files directly for iframe
app.get('/modal/*', (req, res) => {
  try {
    const fileName = path.basename(req.path)
    const filePath = path.join(__dirname, '..', 'public', 'documents', fileName)

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found')
    }

    // Set proper headers for iframe viewing
    const contentType = getContentType(fileName)
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': req.query.download === 'true' ? `attachment; filename="${fileName}"` : 'inline',
      'Cache-Control': 'public, max-age=3600',
      // X-Frame-Options убрана для разрешения iframe с других локальных портов
    })

    console.log(`Serving modal document: ${fileName} (Content-Type: ${contentType})`)
    res.sendFile(filePath)
  } catch (error) {
    console.error('Error serving modal document:', error.message)
    res.status(500).send('Error serving file')
  }
})

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`)
})
