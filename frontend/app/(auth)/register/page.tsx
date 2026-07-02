import { RegisterForm } from "@/domains/auth/components/register-form"

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">RestackPattern</h1>
        <p className="text-sm text-muted-foreground mt-1">Full-stack monorepo starter</p>
      </div>
      <RegisterForm />
    </main>
  )
}
