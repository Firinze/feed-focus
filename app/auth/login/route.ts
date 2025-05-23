import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const formData = await request.formData()
  const email = String(formData.get("email"))
  const password = String(formData.get("password"))
  const isExtension = requestUrl.searchParams.get("extension") === "true"
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return NextResponse.redirect(
      `${requestUrl.origin}/login?message=${encodeURIComponent(error.message)}${isExtension ? "&extension=true" : ""}`,
      {
        status: 301,
      },
    )
  }

  // Create or update user record in our custom users table
  if (data.user) {
    // Check if user exists in our custom users table
    const { data: existingUser } = await supabase.from("users").select().eq("id", data.user.id).single()

    if (!existingUser) {
      // Create new user record
      await supabase.from("users").insert({
        id: data.user.id,
        email: data.user.email,
      })
    } else {
      // Update last login
      await supabase.from("users").update({ last_login: new Date().toISOString() }).eq("id", data.user.id)
    }
  }

  // Si c'est une connexion depuis l'extension, rediriger vers la page de callback
  if (isExtension) {
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

  return NextResponse.redirect(`${requestUrl.origin}/dashboard`, {
    status: 301,
  })
}
