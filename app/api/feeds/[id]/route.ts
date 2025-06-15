import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import jwt from "jsonwebtoken"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Récupérer le feed avec ses profils
    const { data: feed, error: feedError } = await supabase
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
      .eq("id", params.id)
      .eq("user_id", decoded.sub)
      .single()

    if (feedError) {
      return NextResponse.json({ error: "Feed not found" }, { status: 404 })
    }

    // Transformer les données
    const transformedFeed = {
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
    }

    return NextResponse.json(transformedFeed)
  } catch (error) {
    console.error("Error in GET /api/feeds/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Mettre à jour le feed
    const { data: feed, error: feedError } = await supabase
      .from("feeds")
      .update({
        name: name.trim(),
        description: description?.trim() || "",
      })
      .eq("id", params.id)
      .eq("user_id", decoded.sub)
      .select()
      .single()

    if (feedError) {
      return NextResponse.json({ error: "Feed not found or update failed" }, { status: 404 })
    }

    return NextResponse.json({
      id: feed.id,
      name: feed.name,
      description: feed.description,
      created_at: feed.created_at,
      updated_at: feed.updated_at,
    })
  } catch (error) {
    console.error("Error in PUT /api/feeds/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Supprimer le feed (les relations feed_profiles seront supprimées automatiquement grâce à ON DELETE CASCADE)
    const { error: feedError } = await supabase.from("feeds").delete().eq("id", params.id).eq("user_id", decoded.sub)

    if (feedError) {
      return NextResponse.json({ error: "Feed not found or delete failed" }, { status: 404 })
    }

    return NextResponse.json({ message: "Feed deleted successfully" })
  } catch (error) {
    console.error("Error in DELETE /api/feeds/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
