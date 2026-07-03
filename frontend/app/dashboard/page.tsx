import Link from "next/link"
import { LogoutButton } from "@/domains/auth/components/logout-button"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <LogoutButton />
      </div>
      <p className="text-muted-foreground mt-2">You are logged in.</p>
      <Button asChild className="mt-6">
        <Link href="/profile">Profile</Link>
      </Button>
    </main>
  )
}
