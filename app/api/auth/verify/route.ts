import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import jwt from "jsonwebtoken"

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const token = authHeader.substring(7)

    // Vérifier le token JWT
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as any

    if (!decoded || !decoded.sub) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const supabase = createClient()

    // Vérifier que l'utilisateur existe dans la base de données
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, created_at")
      .eq("id", decoded.sub)
      .single()

    if (userError || !user) {
      // Si l'utilisateur n'existe pas, le créer
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          id: decoded.sub,
          email: decoded.email || "",
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (createError) {
        console.error("Error creating user:", createError)
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
      }

      return NextResponse.json({
        valid: true,
        user: newUser,
        message: "User created and verified",
      })
    }

    return NextResponse.json({
      valid: true,
      user,
      message: "User verified",
    })
  } catch (error) {
    console.error("Token verification error:", error)
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }
}
