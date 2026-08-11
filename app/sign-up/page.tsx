import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'
export default function SignUpPage() { return <main className="flex min-h-screen items-center justify-center bg-secondary px-5 py-16"><div className="w-full max-w-md bg-background p-8 shadow-sm"><Link href="/" className="font-serif text-3xl text-primary">fabulous</Link>
<h1 className="mt-3 font-serif text-4xl">Set up your store.</h1><p className="mt-3 text-sm text-muted-foreground">Create a user account.</p><div className="mt-8"><AuthForm mode="sign-up" /></div><p className="mt-6 text-sm text-muted-foreground">Already have an account? <Link href="/sign-in" className="text-primary underline">Sign in</Link></p></div></main> }
