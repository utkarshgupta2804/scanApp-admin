"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Printer, Copy, Trash2, AlertCircle, CheckCircle2, Clock, Grid3x3, Eye, RefreshCw, Package } from "lucide-react"

import { QrCode } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Updated interfaces for batch structure with isScanned
interface QRItem {
  qrId: string
  qrCodeUrl: string
  isScanned: boolean // New property
}

interface QRBatch {
  _id: string
  batchId: string
  qrData: string // Contains "Batch ID: X\nPoints: Y\nURL: Z" - UPDATED FORMAT
  format: string
  size: string
  qrCodes: QRItem[]
  totalCount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ApiResponse {
  success: boolean
  message: string
  data?: any
  error?: string
}

interface QRBatchListResponse extends ApiResponse {
  data: QRBatch[]
  pagination: {
    currentPage: number
    totalPages: number
    totalBatches: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

interface JobStatus {
  id: string
  status: "pending" | "processing" | "completed" | "failed"
  progress: number
  total: number
  result?: {
    batchId: string
    qrData: string
    qrCodes: QRItem[]
    totalCount: number
    errors: any[]
    summary: {
      requested: number
      successful: number
      failed: number
    }
  }
  error?: string
  createdAt: string
}

interface QRStats {
  totalBatches: number
  totalQRCodes: number
  scannedQRCodes: number
  unscannedQRCodes: number
  scanRate: string
}

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001"

export default function GenerateQRPage() {
  const { toast } = useToast()
  const [qrBatches, setQRBatches] = useState<QRBatch[]>([])
  const [qrStats, setQRStats] = useState<QRStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [fetchingBatches, setFetchingBatches] = useState(false)
  const [currentJob, setCurrentJob] = useState<JobStatus | null>(null)
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
  const [viewingQR, setViewingQR] = useState<QRItem | null>(null)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalBatches: 0,
    hasNextPage: false,
    hasPrevPage: false,
  })
  const [formData, setFormData] = useState({
    points: "",
    url: "",
    format: "png",
    size: "200x200",
    quantity: "1",
  })

  // Parse batch ID, points, and URL from qrData string - UPDATED PARSER
  const parseQRData = (qrData: string) => {
    const lines = qrData.split("\n")
    const batchId = lines[0]?.replace("Batch ID: ", "") || "N/A"
    const points = lines[1]?.replace("Points: ", "") || "N/A"
    const url = lines[2]?.replace("URL: ", "") || "N/A"
    return { batchId, points, url }
  }

  // Helper function to truncate URL intelligently
  const truncateURL = (url: string, maxLength: number = 50) => {
    if (url.length <= maxLength) return url
    
    // Count slashes
    const slashes = (url.match(/\//g) || []).length
    
    // If more than 2 slashes (protocol + domain + path), truncate after second slash
    if (slashes > 2) {
      const parts = url.split('/')
      const protocol = parts[0] // http: or https:
      const domain = parts[2] // domain.com
      return `${protocol}//${domain}/...`
    }
    
    // Otherwise, simple truncation
    return url.length > maxLength ? `${url.substring(0, maxLength)}...` : url
  }

  // Fetch QR statistics
  const fetchQRStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/qr-stats`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse = await response.json()

      if (result.success) {
        setQRStats(result.data)
      } else {
        throw new Error(result.message || "Failed to fetch QR statistics")
      }
    } catch (error) {
      console.error("Error fetching QR statistics:", error)
    }
  }

  // Fetch QR batches from API
  const fetchQRBatches = async (page = 1) => {
    setFetchingBatches(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/qr-batches?page=${page}&limit=20&sortBy=createdAt&sortOrder=desc`,
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: QRBatchListResponse = await response.json()

      if (result.success) {
        setQRBatches(result.data)
        setPagination(result.pagination)
        await fetchQRStats() // Refresh stats after fetching batches
      } else {
        throw new Error(result.message || "Failed to fetch QR batches")
      }
    } catch (error) {
      console.error("Error fetching QR batches:", error)
      toast({
        title: "Error",
        description: "Failed to fetch QR batches. Please try again.",
        variant: "destructive",
      })
    } finally {
      setFetchingBatches(false)
    }
  }

  // Mark QR as scanned
  const markQRAsScanned = async (qrId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/qr/${qrId}/scan`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse = await response.json()

      if (result.success) {
        toast({
          title: "QR Code Scanned",
          description: `QR ${qrId} marked as scanned successfully`,
        })

        // Update the local state
        setQRBatches((prevBatches) =>
          prevBatches.map((batch) => ({
            ...batch,
            qrCodes: batch.qrCodes.map((qr) => (qr.qrId === qrId ? { ...qr, isScanned: true } : qr)),
          })),
        )

        // Update viewing QR if it's the same one
        if (viewingQR && viewingQR.qrId === qrId) {
          setViewingQR({ ...viewingQR, isScanned: true })
        }

        // Refresh stats
        await fetchQRStats()
      } else {
        throw new Error(result.message || "Failed to mark QR as scanned")
      }
    } catch (error: any) {
      console.error("Error marking QR as scanned:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to mark QR as scanned. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Poll job status
  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/job-status/${jobId}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setCurrentJob(result.data)

        if (result.data.status === "completed") {
          setBulkLoading(false)
          toast({
            title: "Bulk Generation Complete",
            description: `Successfully generated ${result.data.result.summary.successful} QR codes`,
          })

          await fetchQRBatches()

          setTimeout(() => {
            setCurrentJob(null)
          }, 3000)
        } else if (result.data.status === "failed") {
          setBulkLoading(false)
          toast({
            title: "Bulk Generation Failed",
            description: result.data.error || "An error occurred during bulk generation",
            variant: "destructive",
          })
          setCurrentJob(null)
        } else if (result.data.status === "processing") {
          setTimeout(() => pollJobStatus(jobId), 1000)
        }
      }
    } catch (error) {
      console.error("Error polling job status:", error)
      setBulkLoading(false)
      setCurrentJob(null)
      toast({
        title: "Error",
        description: "Failed to check generation status",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    fetchQRBatches()
  }, [])

  const handleGenerate = async () => {
    if (!formData.points || !formData.url) {
      toast({
        title: "Missing Information",
        description: "Please fill in points and URL fields.",
        variant: "destructive",
      })
      return
    }

    const quantity = Number.parseInt(formData.quantity)

    if (quantity < 1 || quantity > 100) {
      toast({
        title: "Invalid Quantity",
        description: "Quantity must be between 1 and 100.",
        variant: "destructive",
      })
      return
    }

    // Use async generation for large quantities
    if (quantity > 20) {
      await handleAsyncGenerate()
    } else {
      await handleSyncGenerate()
    }
  }

  const handleSyncGenerate = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-qr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          points: Number.parseInt(formData.points),
          url: formData.url,
          format: formData.format,
          size: formData.size,
          quantity: Number.parseInt(formData.quantity),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse = await response.json()

      if (result.success) {
        toast({
          title: "QR Codes Generated",
          description: `Successfully created batch: ${result.data.batchId} with unique QR IDs`,
        })

        setFormData({
          points: "",
          url: "",
          format: "png",
          size: "200x200",
          quantity: "1",
        })

        await fetchQRBatches()

        // Auto-expand the newly created batch
        setExpandedBatch(result.data.batchId)
      } else {
        throw new Error(result.message || "Failed to generate QR codes")
      }
    } catch (error: any) {
      console.error("Error generating QR codes:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR codes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAsyncGenerate = async () => {
    setBulkLoading(true)
    setCurrentJob(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-bulk-qr-async`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          points: Number.parseInt(formData.points),
          url: formData.url,
          format: formData.format,
          size: formData.size,
          quantity: Number.parseInt(formData.quantity),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Bulk Generation Started",
          description: `Generating ${formData.quantity} QR codes with unique IDs...`,
        })

        pollJobStatus(result.jobId)

        setFormData({
          points: "",
          url: "",
          format: "png",
          size: "200x200",
          quantity: "1",
        })
      } else {
        throw new Error(result.message || "Failed to start bulk generation")
      }
    } catch (error: any) {
      console.error("Error starting bulk generation:", error)
      setBulkLoading(false)
      toast({
        title: "Error",
        description: error.message || "Failed to start bulk generation. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleCopyQRId = (qrId: string) => {
    navigator.clipboard.writeText(qrId)
    toast({
      title: "Copied",
      description: `QR ID "${qrId}" copied to clipboard`,
    })
  }

  const handleDownloadQR = (qr: QRItem, batchFormat: string) => {
    // Create a new window with the QR code for printing
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print QR Code - ${qr.qrId}</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                font-family: Arial, sans-serif;
              }
              .qr-container {
                text-align: center;
                page-break-inside: avoid;
              }
              .qr-image {
                max-width: 300px;
                height: auto;
                margin: 20px 0;
              }
              .qr-info {
                margin: 10px 0;
                font-size: 14px;
              }
              @media print {
                body { margin: 0; padding: 10px; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <h3>QR Code: ${qr.qrId}</h3>
              <img src="${qr.qrCodeUrl}" alt="QR Code ${qr.qrId}" class="qr-image" />
              <div class="qr-info">
              </div>
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              };
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }

    toast({
      title: "Print Dialog Opened",
      description: `Printing QR code ${qr.qrId}`,
    })
  }

  const handleDownloadBatch = (batch: QRBatch) => {
    const { batchId, points, url } = parseQRData(batch.qrData)

    // Create a printable view of the batch
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      const qrCodesHtml = batch.qrCodes
        .map(
          (qr) => `
        <div class="qr-item">
          <div class="qr-details">
            <h4>${qr.qrId}</h4>
          </div>
          <img src="${qr.qrCodeUrl}" alt="QR Code ${qr.qrId}" class="qr-mini" />
        </div>
      `,
        )
        .join("")

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                margin: 0;
                padding: 20px;
                font-family: Arial, sans-serif;
                line-height: 1.4;
              }
              .batch-header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
              }
              .batch-info {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 30px;
              }
              .info-section {
                background: #f5f5f5;
                padding: 15px;
                border-radius: 5px;
              }
              .qr-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-top: 20px;
              }
              .qr-item {
                border: 1px solid #ddd;
                padding: 15px;
                text-align: center;
                border-radius: 5px;
                page-break-inside: avoid;
              }
              .qr-mini {
                width: 120px;
                height: 120px;
                margin: 10px 0;
              }
              .qr-details h4 {
                margin: 0 0 5px 0;
                font-size: 14px;
              }
              .qr-details p {
                margin: 0;
                font-size: 12px;
                color: #666;
              }
              @media print {
                body { margin: 0; padding: 10px; }
                .no-print { display: none; }
                .qr-grid { grid-template-columns: repeat(3, 1fr); }
              }
            </style>
          </head>
          <body>
            <div class="qr-grid">
              ${qrCodesHtml}
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              };
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }

    toast({
      title: "Print Dialog Opened",
      description: `Printing batch information: ${batch.batchId}`,
    })
  }

  const handleDeleteBatch = async (batch: QRBatch) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/qr-batches/${batch.batchId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse = await response.json()

      if (result.success) {
        toast({
          title: "Batch Deleted",
          description: `QR batch ${batch.batchId} has been removed`,
        })

        await fetchQRBatches(pagination.currentPage)

        // Close expanded view if this batch was expanded
        if (expandedBatch === batch.batchId) {
          setExpandedBatch(null)
        }
      } else {
        throw new Error(result.message || "Failed to delete QR batch")
      }
    } catch (error: any) {
      console.error("Error deleting QR batch:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete QR batch. Please try again.",
        variant: "destructive",
      })
    }
  }

  const toggleBatchExpansion = (batchId: string) => {
    setExpandedBatch(expandedBatch === batchId ? null : batchId)
  }

  const handleViewQRDetails = (qr: QRItem) => {
    setViewingQR(qr)
  }

  const QRDetailModal = () => {
    if (!viewingQR) return null

    // Find the batch that contains this QR code
    const containingBatch = qrBatches.find((batch) => batch.qrCodes.some((qr) => qr.qrId === viewingQR.qrId))

    // Extract batch ID, points, and URL from the batch data - UPDATED
    const { batchId, points, url } = containingBatch
      ? parseQRData(containingBatch.qrData)
      : { batchId: "N/A", points: "N/A", url: "N/A" }

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div
          className="bg-white dark:bg-black rounded-2xl p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-auto 
                        border border-gray-200 dark:border-gray-800 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">QR Code Details</h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
              onClick={() => setViewingQR(null)}
            >
              ✕
            </Button>
          </div>

          {/* QR Preview */}
          <div className="space-y-4">
            <div
              className="bg-gray-50 dark:bg-black p-4 rounded-lg 
                            border border-gray-200 dark:border-gray-800 
                            flex items-center justify-center relative"
            >
              <img
                src={viewingQR.qrCodeUrl || "/placeholder.svg"}
                alt={`QR Code ${viewingQR.qrId}`}
                className="w-40 h-40 sm:w-48 sm:h-48 object-contain"
                onError={(e) => {
                  const img = e.target as HTMLImageElement
                  img.src = "/placeholder.svg"
                }}
              />
              {/* Scan status overlay */}
              <div className="absolute top-2 right-2">
                {viewingQR.isScanned ? (
                  <Badge className="bg-green-600 text-white border-green-700 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Scanned
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-white text-gray-700 border-gray-300 text-xs
                                    dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Unscanned
                  </Badge>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="space-y-2 text-gray-600 dark:text-gray-300">
              <div
                className="flex items-center justify-between p-2 
                              bg-gray-50 dark:bg-black 
                              border border-gray-200 dark:border-gray-800 rounded"
              >
                <span className="font-medium text-gray-900 dark:text-white text-sm">QR ID:</span>
                <div className="flex items-center gap-2 min-w-0">
                  <code className="text-xs sm:text-sm font-mono truncate">{viewingQR.qrId}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white shrink-0"
                    onClick={() => handleCopyQRId(viewingQR.qrId)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div
                className="flex items-center justify-between p-2 
                              bg-gray-50 dark:bg-black 
                              border border-gray-200 dark:border-gray-800 rounded"
              >
                <span className="font-medium text-gray-900 dark:text-white text-sm">Batch ID:</span>
                <div className="flex items-center gap-2 min-w-0">
                  <code className="text-xs sm:text-sm font-mono truncate">{batchId}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white shrink-0"
                    onClick={() => handleCopyQRId(batchId)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div
                className="flex items-center justify-between p-2 
                              bg-gray-50 dark:bg-black 
                              border border-gray-200 dark:border-gray-800 rounded"
              >
                <span className="font-medium text-gray-900 dark:text-white text-sm">Status:</span>
                <div className="flex items-center gap-2">
                  {viewingQR.isScanned ? (
                    <Badge className="bg-green-600 text-white text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Scanned
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-gray-300 text-gray-600 text-xs
                                      dark:border-gray-600 dark:text-gray-300"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Unscanned
                    </Badge>
                  )}
                </div>
              </div>

              <div
                className="p-2 bg-gray-50 dark:bg-black 
                              border border-gray-200 dark:border-gray-800 rounded"
              >
                <span className="font-medium text-gray-900 dark:text-white text-sm">QR Contains:</span>
                <div
                  className="mt-2 text-xs sm:text-sm font-mono whitespace-pre-line break-all
                                text-gray-600 dark:text-gray-400"
                >
                  QR ID: {viewingQR.qrId}
                  {"\n"}Batch ID: {batchId}
                  {"\n"}Points: {points}
                  {"\n"}URL: {url}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={() => handleDownloadQR(viewingQR, containingBatch?.format || "png")}
                variant="outline"
                className="flex-1 border-gray-300 text-gray-900 hover:bg-gray-100 
                          dark:border-gray-700 dark:text-white dark:hover:bg-gray-800"
              >
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Generate QR Codes</h1>
          <Button 
            variant="outline" 
            onClick={() => fetchQRBatches(pagination.currentPage)} 
            disabled={fetchingBatches}
            className="w-full sm:w-auto"
          >
            {fetchingBatches ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {/* Bulk Generation Progress */}
        {currentJob && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200 text-base sm:text-lg">
                <Package className="h-4 w-4 sm:h-5 sm:w-5" />
                Bulk Generation Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                  <span>
                    Status: <span className="font-medium capitalize">{currentJob.status}</span>
                  </span>
                  <span className="font-mono">
                    {currentJob.progress} / {currentJob.total}
                  </span>
                </div>
                <div className="w-full bg-blue-100 dark:bg-blue-900/50 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-500 ease-out relative"
                    style={{ width: `${(currentJob.progress / currentJob.total) * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                  </div>
                </div>
                <div className="text-center text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {Math.round((currentJob.progress / currentJob.total) * 100)}% Complete
                </div>
                {currentJob.result && (
                  <div className="text-xs sm:text-sm space-y-1 pt-2 border-t border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <span className="text-base">✅</span>
                      <span>
                        Generated: <span className="font-semibold">{currentJob.result.summary.successful}</span> unique
                        QR codes
                      </span>
                    </div>
                    {currentJob.result.summary.failed > 0 && (
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <span className="text-base">❌</span>
                        <span>
                          Failed: <span className="font-semibold">{currentJob.result.summary.failed}</span>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">QR Code Generator</CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Each QR code will contain a unique QR ID, batch ID, points value, and target URL. All QR codes start as
              unscanned.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="points" className="text-sm">Points Value *</Label>
                  <Input
                    id="points"
                    type="number"
                    min="1"
                    placeholder="Enter points value"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="url" className="text-sm">Target URL *</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com/reward"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="quantity" className="text-sm">Quantity (1-100) *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max="100"
                    placeholder="Number of QR codes to generate"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="format" className="text-sm">Format</Label>
                  <Select
                    value={formData.format}
                    onValueChange={(value) => setFormData({ ...formData, format: value })}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="png">PNG</SelectItem>
                      <SelectItem value="jpg">JPG</SelectItem>
                      <SelectItem value="jpeg">JPEG</SelectItem>
                      <SelectItem value="svg">SVG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="size" className="text-sm">Size (Square)</Label>
                  <Select value={formData.size} onValueChange={(value) => setFormData({ ...formData, size: value })}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100x100">100x100</SelectItem>
                      <SelectItem value="150x150">150x150</SelectItem>
                      <SelectItem value="200x200">200x200</SelectItem>
                      <SelectItem value="250x250">250x250</SelectItem>
                      <SelectItem value="300x300">300x300</SelectItem>
                      <SelectItem value="400x400">400x400</SelectItem>
                      <SelectItem value="500x500">500x500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex justify-center mt-4 sm:mt-6">
              <Button onClick={handleGenerate} className="w-full sm:w-full md:max-w-xs" disabled={loading || bulkLoading}>
                {loading || bulkLoading ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-4 w-4" />
                    Generate QR Codes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Generated QR Batches */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg">Generated QR Batches</CardTitle>
              {fetchingBatches && <Clock className="h-4 w-4 animate-spin" />}
            </div>
            {pagination.totalBatches > 0 && (
              <div className="text-xs sm:text-sm text-muted-foreground">
                Showing {qrBatches.length} of {pagination.totalBatches} batches
              </div>
            )}
          </CardHeader>
          <CardContent>
            {qrBatches.length === 0 ? (
              <div className="text-center py-8">
                <QrCode className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                <h3 className="text-base sm:text-lg font-semibold mb-2">No QR batches found</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4">Generate your first QR codes using the form above.</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {qrBatches.map((batch) => {
                    const { batchId, points, url } = parseQRData(batch.qrData)
                    const isExpanded = expandedBatch === batch.batchId

                    return (
                      <div key={batch._id} className="border border-border rounded-lg overflow-hidden">
                        {/* Batch Header */}
                        <div className="p-3 sm:p-4 bg-muted/50">
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="space-y-2 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <h3 className="font-semibold text-sm sm:text-base lg:text-lg truncate">{batch.batchId}</h3>
                                <Badge variant="outline" className="text-xs shrink-0">
                                  <Grid3x3 className="h-3 w-3 mr-1" />
                                  {batch.totalCount} codes
                                </Badge>
                                <Badge variant={batch.isActive ? "default" : "secondary"} className="text-xs shrink-0">
                                  {batch.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                              <div className="text-xs sm:text-sm text-muted-foreground space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                  <span className="whitespace-nowrap">
                                    <strong>Batch ID:</strong> <span className="break-all">{batchId}</span>
                                  </span>
                                  <span className="whitespace-nowrap">
                                    <strong>Points:</strong> {points}
                                  </span>
                                  <span className="whitespace-nowrap">
                                    <strong>Format:</strong> {batch.format.toUpperCase()}
                                  </span>
                                  <span className="whitespace-nowrap">
                                    <strong>Size:</strong> {batch.size}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  <span className="text-xs">
                                    {new Date(batch.createdAt).toLocaleDateString()} at{" "}
                                    {new Date(batch.createdAt).toLocaleTimeString()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <strong>URL:</strong>{" "}
                                  <span className="text-blue-600 break-all" title={url}>
                                    {truncateURL(url)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 justify-end">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => toggleBatchExpansion(batch.batchId)}
                                className="whitespace-nowrap"
                              >
                                <Grid3x3 className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">{isExpanded ? "Hide" : "View"} QRs</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadBatch(batch)}
                                title="Print batch info"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteBatch(batch)}
                                title="Delete batch"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded QR Grid */}
                        {isExpanded && (
                          <div className="border-t border-border">
                            <div className="p-3 sm:p-4">
                              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                {batch.qrCodes.map((qr) => (
                                  <div key={qr.qrId} className="border border-border rounded-lg p-2 sm:p-3 space-y-2">
                                    <div className="aspect-square bg-white rounded-lg flex items-center justify-center p-1 relative">
                                      <img
                                        src={qr.qrCodeUrl || "/placeholder.svg"}
                                        alt={`QR Code ${qr.qrId}`}
                                        className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform"
                                        onClick={() => handleViewQRDetails(qr)}
                                        onError={(e) => {
                                          const img = e.target as HTMLImageElement
                                          img.src = "/placeholder.svg"
                                        }}
                                      />
                                      {/* Scan status indicator */}
                                      <div className="absolute top-1 right-1">
                                        {qr.isScanned ? (
                                          <div
                                            className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"
                                            title="Scanned"
                                          />
                                        ) : (
                                          <div
                                            className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gray-400 rounded-full border-2 border-white shadow-sm"
                                            title="Unscanned"
                                          />
                                        )}
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <div className="text-center">
                                        <div className="font-mono text-xs sm:text-sm font-medium text-blue-600 truncate" title={qr.qrId}>
                                          {qr.qrId}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {qr.isScanned ? "Scanned" : "Unscanned"}
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleViewQRDetails(qr)}
                                          title="View QR details"
                                          className="h-7 w-7 p-0"
                                        >
                                          <Eye className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDownloadQR(qr, batch.format)}
                                          title="Print QR"
                                          className="h-7 w-7 p-0"
                                        >
                                          <Printer className="h-3 w-3" />
                                        </Button>
                                        {!qr.isScanned && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => markQRAsScanned(qr.qrId)}
                                            title="Mark as scanned"
                                            className="text-green-600 hover:text-green-700 hover:bg-green-50 h-7 w-7 p-0"
                                          >
                                            <CheckCircle2 className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:space-x-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchQRBatches(pagination.currentPage - 1)}
                      disabled={!pagination.hasPrevPage || fetchingBatches}
                      className="w-full sm:w-auto"
                    >
                      Previous
                    </Button>

                    <span className="text-xs sm:text-sm text-muted-foreground">
                      Page {pagination.currentPage} of {pagination.totalPages}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchQRBatches(pagination.currentPage + 1)}
                      disabled={!pagination.hasNextPage || fetchingBatches}
                      className="w-full sm:w-auto"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* QR Detail Modal */}
        <QRDetailModal />
      </div>
    </AdminLayout>
  )
}