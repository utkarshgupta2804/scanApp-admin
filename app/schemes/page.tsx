"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit, Plus, Eye, RefreshCw, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SchemeDialog } from "@/components/scheme-dialog"
import { useToast } from "@/hooks/use-toast"

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001"

// Types based on your backend schema (updated to match single image)
interface Scheme {
  _id: string
  title: string
  description: string
  image: string // Changed from images array to single image
  pointsRequired: number
  createdAt: string
  updatedAt: string
}

interface SchemesResponse {
  success: boolean
  data: Scheme[]
  pagination: {
    currentPage: number
    totalPages: number
    totalSchemes: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

interface SchemeCreateRequest {
  title: string
  description: string
  pointsRequired: number
  image?: File | null // For file upload
}

export default function SchemesPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedScheme, setSelectedScheme] = useState<Scheme | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalSchemes: 0,
    hasNextPage: false,
    hasPrevPage: false
  })
  const { toast } = useToast()

  // Fetch schemes from API
  const fetchSchemes = async (page: number = 1) => {
    try {
      setLoading(page === 1)
      setRefreshing(page !== 1)
      
      const response = await fetch(`${API_BASE_URL}/api/schemes?page=${page}&limit=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: SchemesResponse = await response.json()

      if (data.success) {
        setSchemes(data.data)
        setPagination(data.pagination)
        setCurrentPage(page)
      } else {
        throw new Error('Failed to fetch schemes')
      }
    } catch (error) {
      console.error('Error fetching schemes:', error)
      toast({
        title: "Error",
        description: "Failed to fetch schemes. Please check if the backend server is running.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Create scheme with FormData for file upload
  const createScheme = async (schemeData: SchemeCreateRequest): Promise<boolean> => {
    try {
      const formData = new FormData()
      formData.append('title', schemeData.title)
      formData.append('description', schemeData.description)
      formData.append('pointsRequired', schemeData.pointsRequired.toString())
      
      // Add image if provided
      if (schemeData.image) {
        formData.append('image', schemeData.image)
      }

      const response = await fetch(`${API_BASE_URL}/api/schemes`, {
        method: 'POST',
        body: formData // Don't set Content-Type header, let browser set it with boundary
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: "Scheme Created",
          description: "The new scheme has been successfully created.",
        })
        await fetchSchemes(currentPage) // Refresh the list
        return true
      } else {
        throw new Error(data.message || 'Failed to create scheme')
      }
    } catch (error) {
      console.error('Error creating scheme:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create scheme",
        variant: "destructive"
      })
      return false
    }
  }

  // Update scheme with FormData for file upload
  const updateScheme = async (schemeId: string, schemeData: SchemeCreateRequest): Promise<boolean> => {
    try {
      const formData = new FormData()
      formData.append('title', schemeData.title)
      formData.append('description', schemeData.description)
      formData.append('pointsRequired', schemeData.pointsRequired.toString())
      
      // Add image if provided
      if (schemeData.image) {
        formData.append('image', schemeData.image)
      }

      const response = await fetch(`${API_BASE_URL}/api/schemes/${schemeId}`, {
        method: 'PUT',
        body: formData
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: "Scheme Updated",
          description: "The scheme has been successfully updated.",
        })
        await fetchSchemes(currentPage) // Refresh the list
        return true
      } else {
        throw new Error(data.message || 'Failed to update scheme')
      }
    } catch (error) {
      console.error('Error updating scheme:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update scheme",
        variant: "destructive"
      })
      return false
    }
  }

  // Load schemes on component mount
  useEffect(() => {
    fetchSchemes()
  }, [])

  const handleCreateScheme = () => {
    setSelectedScheme(null)
    setDialogOpen(true)
  }

  const handleEditScheme = (scheme: Scheme) => {
    setSelectedScheme(scheme)
    setDialogOpen(true)
  }

  const handleSaveScheme = async (schemeData: SchemeCreateRequest) => {
    if (selectedScheme) {
      // Update existing scheme
      const success = await updateScheme(selectedScheme._id, schemeData)
      if (success) {
        setDialogOpen(false)
        setSelectedScheme(null) // Clear selected scheme after successful update
      }
    } else {
      // Create new scheme
      const success = await createScheme(schemeData)
      if (success) {
        setDialogOpen(false)
      }
    }
  }

  const handleRefresh = () => {
    fetchSchemes(currentPage)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchSchemes(newPage)
    }
  }

  // Helper function to get full image URL - FIXED WITH DEBUG
  const getImageUrl = (imagePath: string) => {
    if (!imagePath) {
      console.log("No image path provided, using placeholder")
      return "/placeholder.svg"
    }
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
      console.log(`Image path is full URL: ${imagePath}`)
      return imagePath
    }
    
    // Handle paths that start with /uploads or /public
    if (imagePath.startsWith('/uploads') || imagePath.startsWith('/public')) {
      const fullUrl = `${API_BASE_URL}${imagePath}`
      console.log(`Converting path ${imagePath} to full URL: ${fullUrl}`)
      return fullUrl
    }
    
    // For relative paths, prepend API base URL with /
    const fullUrl = `${API_BASE_URL}/${imagePath}`
    console.log(`Converting relative path ${imagePath} to full URL: ${fullUrl}`)
    return fullUrl
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Schemes</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={loading || refreshing}
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button onClick={handleCreateScheme}>
              <Plus className="mr-2 h-4 w-4" />
              Create Scheme
            </Button>
          </div>
        </div>

        {/* Schemes Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Schemes</CardTitle>
              {pagination.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={!pagination.hasPrevPage || loading}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!pagination.hasNextPage || loading}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading schemes...</span>
              </div>
            ) : schemes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No schemes found</p>
                <Button onClick={handleCreateScheme} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Scheme
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Points Required</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schemes.map((scheme) => (
                    <TableRow key={scheme._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <img
                            src={getImageUrl(scheme.image)}
                            alt={scheme.title}
                            className="h-12 w-12 rounded-lg object-cover border border-border"
                            onLoad={() => {
                              console.log(`Successfully loaded image: ${scheme.image}, full URL: ${getImageUrl(scheme.image)}`)
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              const originalSrc = target.src
                              target.src = "/placeholder.svg"
                              console.error(`Failed to load image: ${scheme.image}`)
                              console.error(`Full URL attempted: ${originalSrc}`)
                              console.error(`Falling back to placeholder`)
                              
                              // Test the URL directly
                              fetch(originalSrc)
                                .then(response => {
                                  console.error(`Direct fetch response status: ${response.status}`)
                                  console.error(`Response headers:`, response.headers)
                                })
                                .catch(err => {
                                  console.error(`Direct fetch failed:`, err)
                                })
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{scheme.title}</div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-muted-foreground">
                          {scheme.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{scheme.pointsRequired} pts</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {new Date(scheme.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEditScheme(scheme)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <SchemeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          scheme={selectedScheme}
          onSave={handleSaveScheme}
        />
      </div>
    </AdminLayout>
  )
}