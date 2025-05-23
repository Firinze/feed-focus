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

  const { data: settings, error } = await supabase
    .from("user_settings")
    .select()
    .eq("user_id", session.user.id)
    .single()

  if (error && error.code !== "PGRST116") {
    // PGRST116 est le code d'erreur pour "aucun résultat trouvé"
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!settings) {
    // Créer des paramètres par défaut
    const { data: newSettings, error: createError } = await supabase
      .from("user_settings")
      .insert({
        user_id: session.user.id,
        focus_mode: false,
        content_type: "all",
      })
      .select()
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json({
      focusMode: newSettings.focus_mode,
      keywordFilter: newSettings.keyword_filter || "",
      contentType: newSettings.content_type,
      currentFeedId: newSettings.current_feed_id,
    })
  }

  return NextResponse.json({
    focusMode: settings.focus_mode,
    keywordFilter: settings.keyword_filter || "",
    contentType: settings.content_type,
    currentFeedId: settings.current_feed_id,
  })
}

export async function PUT(request: Request) {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const { focusMode, keywordFilter, contentType, currentFeedId } = await request.json()

    // Vérifier si les paramètres existent
    const { data: existingSettings } = await supabase
      .from("user_settings")
      .select()
      .eq("user_id", session.user.id)
      .single()

    if (existingSettings) {
      // Mettre à jour les paramètres existants
      const { data, error } = await supabase
        .from("user_settings")
        .update({
          focus_mode: focusMode,
          keyword_filter: keywordFilter || null,
          content_type: contentType || "all",
          current_feed_id: currentFeedId || null,
        })
        .eq("user_id", session.user.id)
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        focusMode: data[0].focus_mode,
        keywordFilter: data[0].keyword_filter || "",
        contentType: data[0].content_type,
        currentFeedId: data[0].current_feed_id,
      })
    } else {
      // Créer de nouveaux paramètres
      const { data, error } = await supabase
        .from("user_settings")
        .insert({
          user_id: session.user.id,
          focus_mode: focusMode,
          keyword_filter: keywordFilter || null,
          content_type: contentType || "all",
          current_feed_id: currentFeedId || null,
        })
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        focusMode: data[0].focus_mode,
        keywordFilter: data[0].keyword_filter || "",
        contentType: data[0].content_type,
        currentFeedId: data[0].current_feed_id,
      })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
