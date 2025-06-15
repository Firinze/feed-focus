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
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as any

    if (!decoded || !decoded.sub) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const supabase = createClient()

    // S'assurer que l'utilisateur existe
    const { data: user, error: userError } = await supabase.from("users").select("id").eq("id", decoded.sub).single()

    if (userError && userError.code === "PGRST116") {
      // L'utilisateur n'existe pas, le créer
      const { data: newUser, error: createUserError } = await supabase
        .from("users")
        .insert({
          id: decoded.sub,
          email: decoded.email || `user-${decoded.sub}@example.com`,
        })
        .select()
        .single()

      if (createUserError) {
        console.error("Error creating user:", createUserError)
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
      }
    }

    // Récupérer les feeds avec leurs profils
    const { data: feeds, error: feedsError } = await supabase
      .from("feeds")
      .select(`
        id,
        name,
        description,
        created_at,
        updated_at,
        feed_profiles (
          profile_id,
          profiles (
            id,
            name,
            title,
            image_url,
            linkedin_url,
            unique_id
          )
        )
      `)
      .eq("user_id", decoded.sub)
      .order("created_at", { ascending: false })

    if (feedsError) {
      console.error("Error fetching feeds:", feedsError)
      return NextResponse.json({ error: "Failed to fetch feeds" }, { status: 500 })
    }

    // Transformer les données pour correspondre au format attendu par le frontend
    const transformedFeeds = feeds.map((feed) => ({
      id: feed.id,
      name: feed.name,
      description: feed.description,
      created_at: feed.created_at,
      updated_at: feed.updated_at,
      profiles: feed.feed_profiles.map((fp) => ({
        id: fp.profiles.id,
        name: fp.profiles.name,
        title: fp.profiles.title,
        imageUrl: fp.profiles.image_url,
        linkedinUrl: fp.profiles.linkedin_url,
        uniqueId: fp.profiles.unique_id,
      })),
    }))

    return NextResponse.json(transformedFeeds)
  } catch (error) {
    console.error("Error in GET /api/feeds:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as any

    if (!decoded || !decoded.sub) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { name, description } = await request.json()

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        {
          error: "Feed name is required",
        },
        { status: 400 },
      )
    }

    const supabase = createClient()

    // S'assurer que l'utilisateur existe
    const { data: user, error: userError } = await supabase.from("users").select("id").eq("id", decoded.sub).single()

    if (userError && userError.code === "PGRST116") {
      // L'utilisateur n'existe pas, le créer
      const { data: newUser, error: createUserError } = await supabase
        .from("users")
        .insert({
          id: decoded.sub,
          email: decoded.email || `user-${decoded.sub}@example.com`,
        })
        .select()
        .single()

      if (createUserError) {
        console.error("Error creating user:", createUserError)
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
      }
    }

    // Créer le feed
    const { data: feed, error: feedError } = await supabase
      .from("feeds")
      .insert({
        name: name.trim(),
        description: description?.trim() || "",
        user_id: decoded.sub,
      })
      .select()
      .single()

    if (feedError) {
      console.error("Error creating feed:", feedError)
      return NextResponse.json(
        {
          error: "Failed to create feed",
          details: feedError.message,
        },
        { status: 500 },
      )
    }

    // Retourner le feed avec un tableau de profils vide
    return NextResponse.json(
      {
        id: feed.id,
        name: feed.name,
        description: feed.description,
        created_at: feed.created_at,
        updated_at: feed.updated_at,
        profiles: [],
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error in POST /api/feeds:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
