import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const supabase = createClient()

  // Récupérer le token d'autorisation
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Token d'autorisation manquant ou invalide" }, { status: 401 })
  }

  const token = authHeader.split(" ")[1]

  try {
    // Vérifier le token avec Supabase
    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
  } catch (error) {
    console.error("Erreur lors de la vérification du token:", error)
    return NextResponse.json({ error: "Erreur lors de la vérification du token" }, { status: 500 })
  }
}
