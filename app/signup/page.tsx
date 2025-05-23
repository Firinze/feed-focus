import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default async function SignUp({
  searchParams,
}: {
  searchParams: { message: string; extension?: string }
}) {
  const supabase = createClient()
  const isExtension = searchParams.extension === "true"

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    if (isExtension) {
      // Si c'est une inscription depuis l'extension, rediriger vers la page de callback
      const token = session.access_token
      const user = JSON.stringify({
        id: session.user.id,
        email: session.user.email,
      })

      redirect(`/auth/extension-callback?token=${token}&user=${encodeURIComponent(user)}`)
    } else {
      redirect("/dashboard")
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-secondary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
                <path d="m22 12.18-8.58 3.91a2 2 0 0 1-1.66 0L2.6 12.18" />
                <path d="m22 16.18-8.58 3.91a2 2 0 0 1-1.66 0L2.6 16.18" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Feed Focus</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inscription</CardTitle>
            <CardDescription>Créez un compte pour utiliser Feed Focus</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={`/auth/signup${isExtension ? "?extension=true" : ""}`} method="post" className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input id="email" name="email" type="email" placeholder="votre@email.com" required />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Mot de passe
                </label>
                <Input id="password" name="password" type="password" placeholder="••••••••" required />
              </div>
              {searchParams?.message && (
                <p className="mt-4 rounded-md bg-red-50 p-2 text-sm text-red-500">{searchParams.message}</p>
              )}
              <Button type="submit" className="w-full" variant="gradient">
                S'inscrire
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-gray-600">
              Déjà un compte?{" "}
              <Link href={`/login${isExtension ? "?extension=true" : ""}`} className="text-primary hover:underline">
                Se connecter
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
