"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useProfile } from "../hooks/use-profile"

export function ProfileCard() {
  const { profile, isLoading, error } = useProfile()

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading profile...</p>
  if (error) return <p className="text-sm text-red-500">{error}</p>
  if (!profile) return null

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{profile.name}</CardTitle>
        <CardDescription>{profile.email}</CardDescription>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        User ID: {profile.id}
      </CardContent>
    </Card>
  )
}
