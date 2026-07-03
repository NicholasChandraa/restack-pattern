import { Button } from "@/components/ui/button";
import { ProfileCard } from "@/domains/user/components/profile-card"
import Link from "next/link";

export default function ProfilePage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>
      <ProfileCard />
      <Button className="mt-4">
        <Link href={"/dashboard"}>Back to Dashboard</Link>
      </Button>
    </main>
  )
}
