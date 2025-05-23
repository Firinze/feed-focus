import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const formData = await request.formData()
  const email = String(formData.get("email"))
  const password = String(formData.get("password"))
  const isExtension = requestUrl.searchParams.get("extension") === "true"
  const supabase = createClient()

  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${requestUrl.origin}/auth/callback`,
    },
  })

  if (error) {
    return NextResponse.redirect(
      `${requestUrl.origin}/signup?message=${encodeURIComponent(error.message)}${isExtension ? "&extension=true" : ""}`,
      {
        status: 301,
      },
    )
  }

  // Create user record in our custom users table
  if (data.user) {
    await supabase.from("users").insert({
      id: data.user.id,
      email: data.user.email,
    })
  }

  // Si c'est une inscription depuis l'extension et que l'utilisateur est déjà confirmé
  if (isExtension && data.session) {
    const token = data.session.access_token
    const user = JSON.stringify({
      id: data.user.id,
      email: data.user.email,
    })

    return NextResponse.redirect(
      `${requestUrl.origin}/auth/extension-callback?token=${token}&user=${encodeURIComponent(user)}`,
      {
        status: 301,
      },
    )
  }

  return NextResponse.redirect(
    `${requestUrl.origin}/login?message=${encodeURIComponent(
      "Vérifiez votre email pour confirmer votre inscription.",
    )}${isExtension ? "&extension=true" : ""}`,
    {
      status: 301,
    },
  )
}
