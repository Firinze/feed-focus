import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const { data: feed, error } = await supabase
    .from("feeds")
    .select(`
      *,
      feed_profiles(
        profiles(*)
      )
    `)
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!feed) {
    return NextResponse.json({ error: "Feed non trouvé" }, { status: 404 })
  }

  // Transformer les données pour correspondre au format attendu par l'extension
  const profiles = feed.feed_profiles
    ? feed.feed_profiles
        .filter((fp: any) => fp.profiles)
        .map((fp: any) => ({
          id: fp.profiles.id,
          uniqueId: fp.profiles.unique_id,
          name: fp.profiles.name,
          title: fp.profiles.title,
          imageUrl: fp.profiles.image_url,
          linkedinUrl: fp.profiles.linkedin_url,
        }))
    : []

  const transformedFeed = {
    id: feed.id,
    name: feed.name,
    description: feed.description,
    profiles,
  }

  return NextResponse.json(transformedFeed)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const { name, description } = await request.json()

    if (!name) {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 })
    }

    // Vérifier que le feed appartient à l'utilisateur
    const { data: existingFeed, error: fetchError } = await supabase
      .from("feeds")
      .select()
      .eq("id", params.id)
      .eq("user_id", session.user.id)
      .single()

    if (fetchError || !existingFeed) {
      return NextResponse.json({ error: "Feed non trouvé" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("feeds")
      .update({
        name,
        description,
      })
      .eq("id", params.id)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  // Vérifier que le feed appartient à l'utilisateur
  const { data: existingFeed, error: fetchError } = await supabase
    .from("feeds")
    .select()
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .single()

  if (fetchError || !existingFeed) {
    return NextResponse.json({ error: "Feed non trouvé" }, { status: 404 })
  }

  const { error } = await supabase.from("feeds").delete().eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
