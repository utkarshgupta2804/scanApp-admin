"use client"

import React from "react"

import { useState } from "react"
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

interface Customer {
  _id: string
  name: string
  city: string
  username: string
  points: number
  createdAt: string
  updatedAt: string
}

interface EditPointsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  onSave: (customerId: string, newPoints: number) => void
}

export function EditPointsDialog({ open, onOpenChange, customer, onSave }: EditPointsDialogProps) {
  const [points, setPoints] = useState(customer?.points || 0)

  const handleSave = () => {
    if (customer) {
      onSave(customer._id, points)
      onOpenChange(false)
    }
  }

  // Update points when customer changes
  React.useEffect(() => {
    setPoints(customer?.points || 0)
  }, [customer])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Customer Points</DialogTitle>
          <DialogDescription>
            Update points for {customer?.name} (@{customer?.username})
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="points">Points</Label>
            <Input
              id="points"
              type="number"
              min="0"
              value={points}
              onChange={(e) => setPoints(Number.parseInt(e.target.value) || 0)}
              placeholder="Enter points"
            />
          </div>

          <div className="text-sm text-muted-foreground">Current points: {customer?.points || 0}</div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Update Points</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
