"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit, Plus, Eye, RefreshCw, Loader2, Calendar } from "lucide-react"
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

  // Helper function to get full image URL
  const getImageUrl = (imagePath: string) => {
    if (!imagePath) {
      return "/placeholder.svg"
    }
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
      return imagePath
    }
    
    // Handle paths that start with /uploads or /public
    if (imagePath.startsWith('/uploads') || imagePath.startsWith('/public')) {
      return `${API_BASE_URL}${imagePath}`
    }
    
    // For relative paths, prepend API base URL with /
    return `${API_BASE_URL}/${imagePath}`
  }

  return (
    <AdminLayout>
      <div className="space-y-4 md:space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Schemes</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Manage reward schemes and point requirements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="flex-1 sm:flex-none"
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button onClick={handleCreateScheme} className="flex-1 sm:flex-none">
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Button>
          </div>
        </div>

        {/* Schemes Content */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg md:text-xl">All Schemes</CardTitle>
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center sm:justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={!pagination.hasPrevPage || loading}
                  >
                    Previous
                  </Button>
                  <span className="text-xs sm:text-sm text-muted-foreground px-2 whitespace-nowrap">
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
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2 text-sm md:text-base mt-2">Loading schemes...</span>
              </div>
            ) : schemes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No schemes found</p>
                <Button onClick={handleCreateScheme}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Scheme
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop Table View - Hidden on mobile */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Image</th>
                        <th className="text-left py-3 px-4 font-medium">Title</th>
                        <th className="text-left py-3 px-4 font-medium">Description</th>
                        <th className="text-left py-3 px-4 font-medium">Points Required</th>
                        <th className="text-left py-3 px-4 font-medium">Created</th>
                        <th className="text-right py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schemes.map((scheme) => (
                        <tr key={scheme._id} className="border-b">
                          <td className="py-3 px-4">
                            <img
                              src={getImageUrl(scheme.image)}
                              alt={scheme.title}
                              className="h-12 w-12 rounded-lg object-cover border border-border"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.src = "/placeholder.svg"
                              }}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium">{scheme.title}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="max-w-xs truncate text-muted-foreground text-sm">
                              {scheme.description}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="secondary">{scheme.pointsRequired} pts</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm text-muted-foreground">
                              {new Date(scheme.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditScheme(scheme)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile/Tablet Card View */}
                <div className="lg:hidden space-y-4">
                  {schemes.map((scheme) => (
                    <Card key={scheme._id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {/* Image */}
                          <div className="flex-shrink-0">
                            <img
                              src={getImageUrl(scheme.image)}
                              alt={scheme.title}
                              className="h-20 w-20 sm:h-24 sm:w-24 rounded-lg object-cover border border-border"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.src = "/placeholder.svg"
                              }}
                            />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="font-semibold text-base sm:text-lg break-words flex-1">
                                {scheme.title}
                              </h3>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditScheme(scheme)}
                                className="flex-shrink-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {scheme.description}
                            </p>

                            <div className="flex flex-wrap items-center gap-3">
                              <Badge variant="secondary" className="text-xs sm:text-sm">
                                {scheme.pointsRequired} pts
                              </Badge>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {new Date(scheme.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Mobile Pagination (if not shown in header) */}
                {pagination.totalPages > 1 && (
                  <div className="lg:hidden flex items-center justify-center gap-2 mt-6 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!pagination.hasPrevPage || loading}
                    >
                      Previous
                    </Button>
                    <span className="text-xs sm:text-sm text-muted-foreground px-2">
                      {pagination.currentPage} / {pagination.totalPages}
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
              </>
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