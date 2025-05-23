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

  // Récupérer tous les profils associés aux feeds de l'utilisateur
  const { data: feedProfiles, error } = await supabase
    .from("feed_profiles")
    .select(`
      profiles(*)
    `)
    .in("feed_id", supabase.from("feeds").select("id").eq("user_id", session.user.id))

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transformer les données pour correspondre au format attendu par l'extension
  const profiles = feedProfiles
    .filter((fp: any) => fp.profiles)
    .map((fp: any) => ({
      id: fp.profiles.id,
      uniqueId: fp.profiles.unique_id,
      name: fp.profiles.name,
      title: fp.profiles.title,
      imageUrl: fp.profiles.image_url,
      linkedinUrl: fp.profiles.linkedin_url,
    }))

  // Éliminer les doublons
  const uniqueProfiles = Array.from(new Map(profiles.map((profile: any) => [profile.id, profile])).values())

  return NextResponse.json(uniqueProfiles)
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
    const { name, title, imageUrl, linkedinUrl, uniqueId, feedId } = await request.json()

    if (!name || !linkedinUrl) {
      return NextResponse.json({ error: "Le nom et l'URL LinkedIn sont requis" }, { status: 400 })
    }

    // Vérifier que le feed appartient à l'utilisateur
    if (feedId) {
      const { data: feed, error: feedError } = await supabase
        .from("feeds")
        .select()
        .eq("id", feedId)
        .eq("user_id", session.user.id)
        .single()

      if (feedError || !feed) {
        return NextResponse.json({ error: "Feed non trouvé" }, { status: 404 })
      }
    }

    // Vérifier si le profil existe déjà
    let profileId

    if (uniqueId) {
      const { data: existingProfile } = await supabase.from("profiles").select("id").eq("unique_id", uniqueId).single()

      if (existingProfile) {
        profileId = existingProfile.id

        // Mettre à jour le profil existant
        await supabase
          .from("profiles")
          .update({
            name,
            title,
            image_url: imageUrl,
            linkedin_url: linkedinUrl,
          })
          .eq("id", profileId)
      }
    }

    if (!profileId) {
      // Vérifier si le profil existe par URL LinkedIn
      const { data: existingProfileByUrl } = await supabase
        .from("profiles")
        .select("id")
        .eq("linkedin_url", linkedinUrl)
        .single()

      if (existingProfileByUrl) {
        profileId = existingProfileByUrl.id

        // Mettre à jour le profil existant
        await supabase
          .from("profiles")
          .update({
            name,
            title,
            image_url: imageUrl,
            unique_id: uniqueId || null,
          })
          .eq("id", profileId)
      }
    }

    // Créer un nouveau profil si nécessaire
    if (!profileId) {
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          name,
          title,
          image_url: imageUrl,
          linkedin_url: linkedinUrl,
          unique_id: uniqueId || null,
        })
        .select()

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 })
      }

      profileId = newProfile[0].id
    }

    // Ajouter le profil au feed si un feedId est fourni
    if (feedId) {
      // Vérifier si l'association existe déjà
      const { data: existingAssociation } = await supabase
        .from("feed_profiles")
        .select()
        .eq("feed_id", feedId)
        .eq("profile_id", profileId)
        .single()

      if (!existingAssociation) {
        const { error: associationError } = await supabase.from("feed_profiles").insert({
          feed_id: feedId,
          profile_id: profileId,
        })

        if (associationError) {
          return NextResponse.json({ error: associationError.message }, { status: 500 })
        }
      }
    }

    // Récupérer le profil complet
    const { data: profile, error: getProfileError } = await supabase
      .from("profiles")
      .select()
      .eq("id", profileId)
      .single()

    if (getProfileError) {
      return NextResponse.json({ error: getProfileError.message }, { status: 500 })
    }

    return NextResponse.json({
      id: profile.id,
      uniqueId: profile.unique_id,
      name: profile.name,
      title: profile.title,
      imageUrl: profile.image_url,
      linkedinUrl: profile.linkedin_url,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
