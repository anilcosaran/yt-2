import { LoginForm } from './login-form'
import { LoginShowcase } from './login-showcase'

export function LoginPage() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="grid min-h-svh lg:grid-cols-[minmax(460px,0.78fr)_minmax(0,1.42fr)]">
        <LoginForm />
        <LoginShowcase />
      </div>
    </main>
  )
}
