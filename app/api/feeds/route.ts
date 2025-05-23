import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(request: Request) {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const { data: feeds, error } = await supabase
    .from("feeds")
    .select(`
      *,
      feed_profiles(
        profiles(*)
      )
    `)
    .eq("user_id", session.user.id)
    .order("position")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transformer les données pour correspondre au format attendu par l'extension
  const transformedFeeds = feeds.map((feed) => {
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

    return {
      id: feed.id,
      name: feed.name,
      description: feed.description,
      profiles,
    }
  })

  return NextResponse.json(transformedFeeds)
}

export async function POST(request: Request) {
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

    // Get the highest position
    const { data: feeds } = await supabase
      .from("feeds")
      .select("position")
      .eq("user_id", session.user.id)
      .order("position", { ascending: false })
      .limit(1)

    const position = feeds && feeds.length > 0 ? feeds[0].position + 1 : 0

    const { data, error } = await supabase
      .from("feeds")
      .insert({
        user_id: session.user.id,
        name,
        description,
        position,
      })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
