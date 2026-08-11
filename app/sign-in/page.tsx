import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'
export default function SignInPage() { return <main className="flex min-h-screen items-center justify-center bg-secondary px-5 py-16"><div className="w-full max-w-md bg-background p-8 shadow-sm"><Link href="/" className="font-serif text-3xl text-primary">fabulous</Link>
<h1 className="mt-3 font-serif text-4xl">Welcome back.</h1><p className="mt-3 text-sm text-muted-foreground">Sign in</p><div className="mt-8"><AuthForm mode="sign-in" /></div><p className="mt-6 text-sm text-muted-foreground">New User? <Link href="/sign-up" className="text-primary underline">Create an account</Link></p></div></main> }
