"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Search, Download, Edit, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EditPointsDialog } from "@/components/edit-points-dialog"
import { useToast } from "@/hooks/use-toast"

// Interface for Customer data
interface Customer {
  _id: string
  name: string
  city: string
  username: string
  phone: string
  email?: string
  points: number
  createdAt: string
  updatedAt: string
}

// Interface for API response
interface CustomersResponse {
  success: boolean
  data: Customer[]
  pagination: {
    currentPage: number
    totalPages: number
    totalCustomers: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

function getPointsBadgeVariant(points: number) {
  if (points >= 2000) return "default" // High points
  if (points >= 1000) return "secondary" // Medium points
  return "outline" // Low points
}

function formatPhoneNumber(phone: string): string {
  // Format phone number as XXX-XXX-XXXX if it's 10 digits
  if (phone && phone.length === 10) {
    return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`
  }
  return phone
}

export default function ClientsPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [editPointsOpen, setEditPointsOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCustomers: 0,
    hasNextPage: false,
    hasPrevPage: false
  })
  const { toast } = useToast()

  // API base URL - adjust this to match your backend URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

  // Fetch customers from API
  const fetchCustomers = async (page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc') => {
    try {
      setLoading(true)
      const response = await fetch(
        `${API_BASE_URL}/api/customers?page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch customers')
      }

      const data: CustomersResponse = await response.json()
      
      if (data.success) {
        setCustomers(data.data)
        setPagination(data.pagination)
        setCurrentPage(page)
      } else {
        throw new Error('API returned error')
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast({
        title: "Error",
        description: "Failed to fetch customer data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Update customer points
  const updateCustomerPoints = async (customerId: string, newPoints: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/points`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ points: newPoints }),
      })

      if (!response.ok) {
        throw new Error('Failed to update points')
      }

      const data = await response.json()
      
      if (data.success) {
        // Update local state
        setCustomers((prev) =>
          prev.map((c) => (c._id === customerId ? { ...c, points: newPoints, updatedAt: new Date().toISOString() } : c)),
        )
        
        toast({
          title: "Points Updated",
          description: "Customer points have been successfully updated.",
        })
      } else {
        throw new Error('API returned error')
      }
    } catch (error) {
      console.error('Error updating points:', error)
      toast({
        title: "Error",
        description: "Failed to update customer points. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Load customers on component mount
  useEffect(() => {
    fetchCustomers()
  }, [])

  // Filter customers based on search term
  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleEditPoints = (customer: Customer) => {
    setSelectedCustomer(customer)
    setEditPointsOpen(true)
  }

  const handleSavePoints = (customerId: string, newPoints: number) => {
    updateCustomerPoints(customerId, newPoints)
  }

  const handleRefresh = () => {
    fetchCustomers(currentPage)
    toast({
      title: "Data Refreshed",
      description: "Customer data has been refreshed from the database.",
    })
  }

  const handlePageChange = (newPage: number) => {
    fetchCustomers(newPage)
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground">
              Manage customer information and loyalty points
            </p>
          </div>
        </div>

        {/* Search and Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Customer Directory</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name, username, city, phone..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading customers...</span>
              </div>
            )}

            {/* Customers Table */}
            {!loading && (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            {searchTerm ? "No customers match your search." : "No customers found."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCustomers.map((customer) => (
                          <TableRow key={customer._id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-sm font-medium">
                                  {customer.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium">{customer.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Joined {new Date(customer.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-muted-foreground">@{customer.username}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-sm">{formatPhoneNumber(customer.phone)}</div>
                            </TableCell>
                            <TableCell>
                              <div>{customer.city}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground">
                                {customer.email || "Not provided"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getPointsBadgeVariant(customer.points)}>
                                {customer.points.toLocaleString()} pts
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleEditPoints(customer)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {!searchTerm && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, pagination.totalCustomers)} of {pagination.totalCustomers} customers
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!pagination.hasPrevPage || loading}
                        onClick={() => handlePageChange(currentPage - 1)}
                      >
                        Previous
                      </Button>
                      <span className="flex items-center px-3 text-sm text-muted-foreground">
                        Page {currentPage} of {pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!pagination.hasNextPage || loading}
                        onClick={() => handlePageChange(currentPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <EditPointsDialog
          open={editPointsOpen}
          onOpenChange={setEditPointsOpen}
          customer={selectedCustomer}
          onSave={handleSavePoints}
        />
      </div>
    </AdminLayout>
  )
}