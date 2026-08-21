
'use client'

import {
  useState,
} from 'react'

import {
  Eye,
  EyeOff,
} from 'lucide-react'

import {
  useRouter,
} from 'next/navigation'

import {
  signIn,
  signUp,
} from '@/lib/auth-client'

export function AuthForm({
  mode,
}: {
  mode:
    | 'sign-in'
    | 'sign-up'
}) {
  const router =
    useRouter()

  const [
    error,
    setError,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    showPassword,
    setShowPassword,
  ] = useState(false)

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setLoading(true)
    setError('')

    const data =
      Object.fromEntries(
        new FormData(
          event.currentTarget,
        ),
      )

    const result =
      mode === 'sign-in'
        ? await signIn.email({
            email: String(
              data.email,
            ),
            password: String(
              data.password,
            ),
          })
        : await signUp.email({
            email: String(
              data.email,
            ),
            password: String(
              data.password,
            ),
            name: String(
              data.name,
            ),
          })

    setLoading(false)

    if (result.error) {
      setError(
        result.error.message ||
          'Unable to continue',
      )
      return
    }

    if (
      mode === 'sign-up'
    ) {
      router.push('/')
      router.refresh()
      return
    }

    try {
      const response =
        await fetch(
          '/api/auth/redirect',
        )

      if (!response.ok) {
        throw new Error(
          'Unable to determine account role',
        )
      }

      const redirectData =
        await response.json()

      router.push(
        redirectData.destination,
      )

      router.refresh()
    } catch {
      setError(
        'Unable to determine account type',
      )
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5"
    >
      {mode === 'sign-up' && (
        <label className="flex flex-col gap-2 text-sm">
          Name

          <input
            name="name"
            required
            className="border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </label>
      )}

      <label className="flex flex-col gap-2 text-sm">
        Email

        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        Password

        <div className="relative">
          <input
            name="password"
            type={
              showPassword
                ? 'text'
                : 'password'
            }
            minLength={8}
            required
            autoComplete={
              mode === 'sign-in'
                ? 'current-password'
                : 'new-password'
            }
            className="w-full border border-border bg-background px-4 py-3 pr-11 text-sm outline-none focus:border-primary"
          />

          <button
            type="button"
            onClick={() =>
              setShowPassword(
                (current) =>
                  !current,
              )
            }
            aria-label={
              showPassword
                ? 'Hide password'
                : 'Show password'
            }
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </label>

      {error && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-primary px-5 py-3 text-xs font-medium uppercase tracking-[0.16em] text-primary-foreground disabled:opacity-60"
      >
        {loading
          ? 'Please wait…'
          : mode === 'sign-in'
            ? 'Sign in'
            : 'Create account'}
      </button>
    </form>
  )
}