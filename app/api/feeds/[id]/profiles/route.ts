import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import jwt from "jsonwebtoken"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    const feedId = params.id
    const { name, title, imageUrl, linkedinUrl, uniqueId } = await request.json()

    if (!name || !linkedinUrl) {
      return NextResponse.json(
        {
          error: "Name and LinkedIn URL are required",
        },
        { status: 400 },
      )
    }

    const supabase = createClient()

    // Vérifier que le feed appartient à l'utilisateur
    const { data: feed, error: feedError } = await supabase
      .from("feeds")
      .select("id, user_id")
      .eq("id", feedId)
      .eq("user_id", decoded.sub)
      .single()

    if (feedError || !feed) {
      return NextResponse.json({ error: "Feed not found" }, { status: 404 })
    }

    // Vérifier si le profil existe déjà
    let profile = null
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .or(`linkedin_url.eq.${linkedinUrl}${uniqueId ? `,unique_id.eq.${uniqueId}` : ""}`)
      .single()

    if (existingProfile) {
      // Le profil existe, vérifier s'il est déjà dans ce feed
      const { data: existingRelation } = await supabase
        .from("feed_profiles")
        .select("id")
        .eq("feed_id", feedId)
        .eq("profile_id", existingProfile.id)
        .single()

      if (existingRelation) {
        return NextResponse.json(
          {
            error: "Profile already exists in this feed",
          },
          { status: 409 },
        )
      }

      profile = existingProfile
    } else {
      // Créer un nouveau profil
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          name: name.trim(),
          title: title?.trim() || "",
          image_url: imageUrl || "",
          linkedin_url: linkedinUrl,
          unique_id: uniqueId || null,
        })
        .select()
        .single()

      if (profileError) {
        console.error("Error creating profile:", profileError)
        return NextResponse.json(
          {
            error: "Failed to create profile",
            details: profileError.message,
          },
          { status: 500 },
        )
      }

      profile = newProfile
    }

    // Créer la relation feed-profile
    const { data: relation, error: relationError } = await supabase
      .from("feed_profiles")
      .insert({
        feed_id: feedId,
        profile_id: profile.id,
      })
      .select()
      .single()

    if (relationError) {
      console.error("Error creating feed-profile relation:", relationError)
      return NextResponse.json(
        {
          error: "Failed to add profile to feed",
          details: relationError.message,
        },
        { status: 500 },
      )
    }

    // Retourner le profil avec les informations de la relation
    return NextResponse.json(
      {
        id: profile.id,
        name: profile.name,
        title: profile.title,
        image_url: profile.image_url,
        linkedin_url: profile.linkedin_url,
        unique_id: profile.unique_id,
        feed_relation_id: relation.id,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error in POST /api/feeds/[id]/profiles:", error)
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

    const feedId = params.id
    const url = new URL(request.url)
    const profileId = url.searchParams.get("profileId")

    if (!profileId) {
      return NextResponse.json({ error: "Profile ID is required" }, { status: 400 })
    }

    const supabase = createClient()

    // Vérifier que le feed appartient à l'utilisateur
    const { data: feed, error: feedError } = await supabase
      .from("feeds")
      .select("id, user_id")
      .eq("id", feedId)
      .eq("user_id", decoded.sub)
      .single()

    if (feedError || !feed) {
      return NextResponse.json({ error: "Feed not found" }, { status: 404 })
    }

    // Supprimer la relation feed-profile
    const { error: deleteError } = await supabase
      .from("feed_profiles")
      .delete()
      .eq("feed_id", feedId)
      .eq("profile_id", profileId)

    if (deleteError) {
      console.error("Error deleting feed-profile relation:", deleteError)
      return NextResponse.json(
        {
          error: "Failed to remove profile from feed",
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ message: "Profile removed from feed successfully" })
  } catch (error) {
    console.error("Error in DELETE /api/feeds/[id]/profiles:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
