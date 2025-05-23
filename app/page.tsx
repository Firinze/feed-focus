import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-secondary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
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
            <span className="text-xl font-bold">Feed Focus</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="outline">Se connecter</Button>
            </Link>
            <Link href="/signup">
              <Button variant="gradient">S'inscrire</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-gradient-to-b from-white to-gray-50 py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="mb-6 text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
              Organisez votre expérience{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">LinkedIn</span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600">
              Filtrez votre feed LinkedIn pour vous concentrer sur les profils et contenus qui comptent vraiment pour
              vous.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup">
                <Button size="lg" variant="gradient">
                  Commencer gratuitement
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline">
                  Découvrir les fonctionnalités
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section id="features" className="py-20">
          <div className="container mx-auto px-4">
            <h2 className="mb-12 text-center text-3xl font-bold">Fonctionnalités principales</h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-light">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary"
                  >
                    <rect width="7" height="7" x="3" y="3" rx="1" />
                    <rect width="7" height="7" x="3" y="14" rx="1" />
                    <path d="M14 4h7" />
                    <path d="M14 9h7" />
                    <path d="M14 15h7" />
                    <path d="M14 20h7" />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-semibold">Feeds personnalisés</h3>
                <p className="text-gray-600">
                  Créez des feeds thématiques pour organiser vos contacts LinkedIn par catégorie.
                </p>
              </div>

              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary-light">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-secondary"
                  >
                    <path d="M12 20v-6" />
                    <path d="M12 14v-2" />
                    <path d="M12 10V4" />
                    <path d="M6 20v-2" />
                    <path d="M6 14v-4" />
                    <path d="M6 8V4" />
                    <path d="M18 20v-4" />
                    <path d="M18 12V4" />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-semibold">Mode Focus</h3>
                <p className="text-gray-600">
                  Éliminez les distractions et concentrez-vous sur le contenu qui vous intéresse.
                </p>
              </div>

              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-light">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-semibold">Gestion des profils</h3>
                <p className="text-gray-600">
                  Ajoutez facilement des profils LinkedIn à vos feeds depuis n'importe quelle page.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-primary to-secondary py-20 text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="mb-6 text-3xl font-bold">Prêt à améliorer votre expérience LinkedIn?</h2>
            <p className="mx-auto mb-8 max-w-2xl">
              Inscrivez-vous gratuitement et commencez à organiser votre feed LinkedIn dès aujourd'hui.
            </p>
            <Link href="/signup">
              <Button size="lg" className="bg-white text-primary hover:bg-gray-100">
                Créer un compte
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-primary to-secondary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
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
              <span className="text-sm font-semibold">Feed Focus</span>
            </div>
            <div className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} Feed Focus. Tous droits réservés.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
