import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Récupérer et vérifier l'utilisateur via le header Authorization
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Aucun token fourni" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    // Appelle Supabase pour vérifier l'authenticité du token
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error("Erreur de vérification Supabase :", userError);
      return NextResponse.json({ error: "Token invalide ou expiré" }, { status: 401 });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;

    // Vérifie si l'utilisateur existe dans ta table personnalisée (et non auth.users)
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, created_at")
      .eq("id", userId)
      .single();

    if (error || !user) {
      // Crée l'utilisateur s'il n'existe pas encore
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          id: userId,
          email: userEmail,
        })
        .select()
        .single();

      if (createError) {
        console.error("Erreur lors de la création de l'utilisateur :", createError);
        return NextResponse.json({ error: "Échec de la création de l'utilisateur" }, { status: 500 });
      }

      return NextResponse.json({
        valid: true,
        user: newUser,
        message: "Utilisateur créé et vérifié",
      });
    }

    return NextResponse.json({
      valid: true,
      user,
      message: "Utilisateur vérifié",
    });
  } catch (error) {
    console.error("Erreur serveur :", error);
    return NextResponse.json({ error: "Erreur lors de la vérification" }, { status: 500 });
  }
}
