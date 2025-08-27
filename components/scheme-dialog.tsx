"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X, Upload, ImageIcon } from "lucide-react"

interface Scheme {
  _id: string
  title: string
  description: string
  image: string // Changed from images array to single image
  pointsRequired: number
  createdAt: string
  updatedAt: string
}

interface SchemeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheme?: Scheme | null
  onSave: (scheme: {
    title: string
    description: string
    pointsRequired: number
    image?: File | null
  }) => void
}

export function SchemeDialog({ open, onOpenChange, scheme, onSave }: SchemeDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    pointsRequired: 0,
  })
  
  const [pointsInput, setPointsInput] = useState("") // Separate state for points input
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")

  // Reset form to initial state
  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      pointsRequired: 0,
    })
    setPointsInput("")
    setSelectedFile(null)
    setImagePreview("")
  }

  // Update form data when dialog opens or scheme prop changes
  useEffect(() => {
    if (open) {
      if (scheme) {
        // Editing existing scheme - populate form with scheme data
        setFormData({
          title: scheme.title,
          description: scheme.description,
          pointsRequired: scheme.pointsRequired,
        })
        setPointsInput(scheme.pointsRequired.toString())
        // Set existing image preview if editing
        if (scheme.image) {
          const API_BASE_URL = "http://localhost:4001"
          const imageUrl = scheme.image.startsWith('http') 
            ? scheme.image 
            : `${API_BASE_URL}/${scheme.image}`
          setImagePreview(imageUrl)
        } else {
          setImagePreview("")
        }
        setSelectedFile(null) // No new file selected when editing
      } else {
        // Creating new scheme - reset form to empty state
        resetForm()
      }
    }
  }, [open, scheme])

  // Also reset when dialog closes
  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open])

  // Handle points input with automatic zero removal
  const handlePointsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value
    
    // Remove any non-digit characters
    value = value.replace(/[^\d]/g, "")
    
    // If empty, keep it empty
    if (value === "") {
      setPointsInput("")
      setFormData(prev => ({
        ...prev,
        pointsRequired: 0
      }))
      return
    }
    
    // Remove ALL leading zeros and convert to number, then back to string
    // This handles cases like "0007" -> "7" and "0" + "7" -> "7"
    const numericValue = parseInt(value, 10)
    const cleanValue = numericValue.toString()
    
    setPointsInput(cleanValue)
    setFormData(prev => ({
      ...prev,
      pointsRequired: numericValue
    }))
  }

  const handleSave = () => {
    // Basic validation
    if (!formData.title.trim()) {
      alert('Please enter a title')
      return
    }
    if (!formData.description.trim()) {
      alert('Please enter a description')
      return
    }
    if (formData.pointsRequired < 0) {
      alert('Points required cannot be negative')
      return
    }

    console.log('Saving scheme with data:', {
      ...formData,
      image: selectedFile ? `File: ${selectedFile.name} (${selectedFile.size} bytes)` : 'No file'
    })

    onSave({
      ...formData,
      image: selectedFile
    })
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file)
      
      // Create preview URL
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
    
    // Reset input value to allow uploading the same file again
    event.target.value = ""
  }

  const removeImage = () => {
    setSelectedFile(null)
    setImagePreview("")
  }

  const handleCancel = () => {
    onOpenChange(false)
    // Form will be reset by the useEffect when open becomes false
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{scheme ? "Edit Scheme" : "Create New Scheme"}</DialogTitle>
          <DialogDescription>
            {scheme ? "Update the scheme details below." : "Fill in the details to create a new scheme."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Enter scheme title"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Enter scheme description"
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="points">Points Required</Label>
            <Input
              id="points"
              type="text"
              inputMode="numeric"
              value={pointsInput}
              onChange={handlePointsChange}
              placeholder="Enter points required"
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Image</Label>
              <div>
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("image-upload")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {imagePreview ? "Change Image" : "Upload Image"}
                </Button>
              </div>
            </div>

            {imagePreview && (
              <div className="grid gap-2">
                <div className="flex items-center gap-2 p-2 border rounded-lg">
                  <div className="flex-shrink-0">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-16 w-16 object-cover rounded border"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium">
                      {selectedFile ? selectedFile.name : "Current Image"}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : "Existing image"}
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={removeImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {!imagePreview && (
              <div className="text-sm text-muted-foreground border-2 border-dashed border-muted rounded-lg p-4 text-center">
                <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                No image uploaded yet. Click "Upload Image" to add an image.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!formData.title.trim() || !formData.description.trim() || formData.pointsRequired < 0}
          >
            {scheme ? "Update Scheme" : "Create Scheme"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}