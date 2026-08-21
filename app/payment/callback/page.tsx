'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'


type VerificationResult = {
  success?: boolean
  paid?: boolean

  order?: {
    id: number
    total: number
    customerEmail: string
    paymentStatus: string
    orderStatus: string
    paymentMethod: string
  }

  alreadyProcessed?: boolean

  notifications?: {
    customerEmailSent?: boolean
    ownerEmailSent?: boolean
    telegramSent?: boolean
  }

  reference?: string
  message?: string
  error?: string
}

function PaymentCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState<
    'verifying' | 'success' | 'failed'
  >('verifying')

  const [message, setMessage] = useState(
    'Verifying your payment...',
  )

  useEffect(() => {
    const reference =
      searchParams.get('reference') ||
      searchParams.get('trxref')

    if (!reference) {
      setStatus('failed')
      setMessage(
        'We could not find your payment reference.',
      )
      return
    }

    let cancelled = false

    async function verifyPayment() {
      try {
        const response = await fetch(
          `/api/payments/verify?reference=${encodeURIComponent(
            reference,
          )}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            cache: 'no-store',
          },
        )

        const data =
          (await response.json()) as VerificationResult

        if (cancelled) {
          return
        }

        if (
          response.ok &&
          (
            data.success === true ||
            data.paid === true
          )
        ) {
          setStatus('success')
          setMessage(
            'Payment successful. Redirecting...',
          )

          /*
           * Give the server a moment to finish the
           * response before navigating.
           *
           * The actual payment processing has already
           * happened server-side.
           */

      
window.setTimeout(() => {
  if (!data.order?.id) {
    setStatus('failed')
    setMessage(
      'Payment was successful, but we could not identify your order.',
    )
    return
  }

 const params = new URLSearchParams()

params.set(
  'payment',
  'success',
)

params.set(
  'order',
  String(data.order.id),
)

if (data.order.customerEmail) {
  params.set(
    'email',
    data.order.customerEmail,
  )
}

router.replace(
  `/checkout?${params.toString()}`,

  )
}, 800)

          return
        }

        setStatus('failed')
        setMessage(
          data.error ||
            data.message ||
            'Your payment could not be confirmed.',
        )
      } catch (error) {
        console.error(
          'Payment verification failed:',
          error,
        )

        if (!cancelled) {
          setStatus('failed')
          setMessage(
            'We could not verify your payment. Please try again.',
          )
        }
      }
    }

    verifyPayment()

    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  if (status === 'verifying') {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-foreground" />

          <h1 className="font-serif text-2xl">
            Verifying your payment
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            Please wait while we confirm your transaction.
          </p>
        </div>
      </main>
    )
  }

  if (status === 'success') {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
            ✓
          </div>

          <h1 className="font-serif text-3xl">
            Payment successful
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            {message}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-700">
          !
        </div>

        <h1 className="font-serif text-3xl">
          Payment could not be confirmed
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          {message}
        </p>

        <button
          type="button"
          onClick={() => router.push('/checkout')}
          className="mt-8 rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background"
        >
          Return to checkout
        </button>
      </div>
    </main>
  )
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[70vh] items-center justify-center px-6">
          <div className="text-center">
            <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-foreground" />

            <p className="text-sm text-muted-foreground">
              Loading payment confirmation...
            </p>
          </div>
        </main>
      }
    >
      <PaymentCallbackContent />
    </Suspense>
  )
}
