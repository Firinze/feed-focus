import { createClient } from "@/utils/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function Dashboard() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Récupérer les statistiques de l'utilisateur
  const { data: feeds } = await supabase.from("feeds").select("*").eq("user_id", user?.id)

  const { data: feedProfiles, count: totalProfiles } = await supabase
    .from("feed_profiles")
    .select("*", { count: "exact" })
    .in("feed_id", feeds?.map((feed) => feed.id) || [])

  const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", user?.id).single()

  const currentFeed = settings?.current_feed_id ? feeds?.find((feed) => feed.id === settings.current_feed_id) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Feeds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{feeds?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Collections de profils LinkedIn</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profils</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProfiles || 0}</div>
            <p className="text-xs text-muted-foreground">Profils LinkedIn suivis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Feed actif</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentFeed ? currentFeed.name : "Aucun"}</div>
            <p className="text-xs text-muted-foreground">Feed actuellement appliqué</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Feeds récents</CardTitle>
            <CardDescription>Vos collections de profils LinkedIn</CardDescription>
          </CardHeader>
          <CardContent>
            {feeds && feeds.length > 0 ? (
              <div className="space-y-2">
                {feeds.slice(0, 5).map((feed) => (
                  <div key={feed.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="font-medium">{feed.name}</div>
                      <div className="text-sm text-muted-foreground">{feed.description || "Aucune description"}</div>
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <Link href="/dashboard/feeds">
                    <Button variant="outline" className="w-full">
                      Voir tous les feeds
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                <div className="mb-2 rounded-full bg-primary/10 p-2">
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
                <h3 className="mb-1 text-lg font-medium">Aucun feed</h3>
                <p className="mb-4 text-sm text-muted-foreground">Vous n'avez pas encore créé de feed.</p>
                <Link href="/dashboard/feeds/new">
                  <Button variant="gradient">Créer un feed</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Extension Chrome</CardTitle>
            <CardDescription>Utilisez Feed Focus directement sur LinkedIn</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
              <div className="mb-2 rounded-full bg-primary/10 p-2">
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
                  <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
                  <path d="m22 12.18-8.58 3.91a2 2 0 0 1-1.66 0L2.6 12.18" />
                  <path d="m22 16.18-8.58 3.91a2 2 0 0 1-1.66 0L2.6 16.18" />
                </svg>
              </div>
              <h3 className="mb-1 text-lg font-medium">Extension Feed Focus</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Téléchargez notre extension pour utiliser Feed Focus directement sur LinkedIn.
              </p>
              <Button variant="gradient">Télécharger l'extension</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
