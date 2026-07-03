import { LoginForm } from "@/domains/auth/components/login-form"

/**
 * Next.js Router Page: Login
 * 
 * Semi-DDD rules:
 * - Files in `frontend/app/` are strictly for layout, routing config, metadata, or entry gates.
 * - Do not implement custom JSX layouts, forms, state, or complex components here.
 * - Always import and delegate rendering to domain feature components (e.g. `<LoginForm />`).
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">RestackPattern</h1>
        <p className="text-sm text-muted-foreground mt-1">Full-stack monorepo starter</p>
      </div>
      <LoginForm />
    </main>
  )
}
