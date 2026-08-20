
'use client'

import {
  Suspense,
  useEffect,
  useState,
} from 'react'

import {
  useSearchParams,
} from 'next/navigation'

function PaymentCallbackContent() {
  const searchParams =
    useSearchParams()

  const reference =
    searchParams.get(
      'reference',
    )

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null)

  useEffect(() => {
    if (!reference) {
      setError(
        'Payment reference is missing.',
      )

      return
    }

    let cancelled =
      false

    async function verifyPayment() {
      try {
        const response =
          await fetch(
            `/api/payments/verify?reference=${encodeURIComponent(
              reference,
            )}`,
            {
              method:
                'POST',

              credentials:
                'include',
            },
          )

        const data =
          await response.json()

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
              'Payment verification failed.',
          )
        }

        if (
          cancelled
        ) {
          return
        }

        window.location.href =
          `/thank-you?order=${encodeURIComponent(
            data.order.id,
          )}`
      } catch (error) {
        if (
          cancelled
        ) {
          return
        }

        setError(
          error instanceof Error
            ? error.message
            : 'Payment verification failed.',
        )
      }
    }

    verifyPayment()

    return () => {
      cancelled = true
    }
  }, [reference])

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-4xl">
            Payment could not be confirmed
          </h1>

          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            {error}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-6 size-10 animate-spin rounded-full border-2 border-muted border-t-primary" />

        <h1 className="font-serif text-3xl">
          Confirming your payment...
        </h1>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Please wait while we confirm your transaction.
        </p>
      </div>
    </main>
  )
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-6">
          <div className="text-center">
            <div className="mx-auto mb-6 size-10 animate-spin rounded-full border-2 border-muted border-t-primary" />

            <h1 className="font-serif text-3xl">
              Confirming your payment...
            </h1>
          </div>
        </main>
      }
    >
      <PaymentCallbackContent />
    </Suspense>
  )
}