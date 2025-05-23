"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function ExtensionCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const user = searchParams.get("user")
  const [status, setStatus] = useState("Authentification en cours...")

  useEffect(() => {
    if (token && user) {
      // Méthode 1: Envoyer un message à l'extension via chrome.runtime
      const sendMessageToExtension = () => {
        if (window.chrome && window.chrome.runtime) {
          try {
            window.chrome.runtime.sendMessage(
              {
                action: "authCallback",
                token,
                user: JSON.parse(decodeURIComponent(user)),
              },
              (response) => {
                if (window.chrome.runtime.lastError) {
                  console.error("Erreur lors de l'envoi du message:", window.chrome.runtime.lastError)
                  setStatus("Erreur lors de la communication avec l'extension. Veuillez réessayer.")
                } else if (response && response.success) {
                  setStatus("Authentification réussie! Vous pouvez fermer cette fenêtre.")
                  setTimeout(() => {
                    window.close()
                  }, 2000)
                }
              },
            )
          } catch (error) {
            console.error("Exception lors de l'envoi du message:", error)
            // Fallback à la méthode 2
            sendMessageViaPostMessage()
          }
        } else {
          // Fallback à la méthode 2
          sendMessageViaPostMessage()
        }
      }

      // Méthode 2: Envoyer un message via window.postMessage
      const sendMessageViaPostMessage = () => {
        try {
          // Stocker les données dans le localStorage pour que l'extension puisse les récupérer
          localStorage.setItem("feedFocusAuthToken", token)
          localStorage.setItem("feedFocusUser", user)

          // Envoyer un message à toutes les fenêtres
          window.postMessage(
            {
              type: "FEED_FOCUS_AUTH",
              token,
              user: JSON.parse(decodeURIComponent(user)),
            },
            "*",
          )

          setStatus("Authentification réussie! Vous pouvez fermer cette fenêtre.")
          setTimeout(() => {
            window.close()
          }, 2000)
        } catch (error) {
          console.error("Exception lors de l'envoi du message via postMessage:", error)
          setStatus("Erreur lors de l'authentification. Veuillez réessayer.")
        }
      }

      // Essayer d'abord la méthode 1
      sendMessageToExtension()
    } else {
      setStatus("Paramètres d'authentification manquants. Veuillez réessayer.")
    }
  }, [token, user])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-secondary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
              <path d="m22 12.18-8.58 3.91a2 2 0 0 1-1.66 0L2.6 12.18" />
              <path d="m22 16.18-8.58 3.91a2 2 0 0 1-1.66 0L2.6 16.18" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Authentification Feed Focus</h1>
        <p className="mt-2 text-gray-600">{status}</p>
      </div>
    </div>
  )
}
