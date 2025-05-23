// Configuration
const API_URL = "https://feed-focus.vercel.app/api"
const APP_URL = "https://feed-focus.vercel.app"

// Éléments DOM
const statusLoading = document.getElementById("status-loading")
const statusConnected = document.getElementById("status-connected")
const statusDisconnected = document.getElementById("status-disconnected")
const notLoggedInSection = document.getElementById("not-logged-in")
const loggedInSection = document.getElementById("logged-in")
const loginButton = document.getElementById("login-button")
const logoutButton = document.getElementById("logout-button")
const openDashboardButton = document.getElementById("open-dashboard-button")
const openLinkedInButton = document.getElementById("open-linkedin-button")
const feedsCount = document.getElementById("feeds-count")
const focusModeToggle = document.getElementById("focus-mode-toggle")
const focusModeStatus = document.getElementById("focus-mode-status")

// État
const state = {
  isAuthenticated: false,
  token: null,
  user: null,
  feeds: [],
  focusMode: false,
}

// Initialisation
document.addEventListener("DOMContentLoaded", async () => {
  await checkAuthStatus()
  setupEventListeners()
})

// Vérifier le statut d'authentification
async function checkAuthStatus() {
  showLoadingState()

  try {
    // Récupérer le token depuis le stockage local
    const { token, user, authToken } = await window.chrome.storage.local.get(["token", "user", "authToken"])

    // Utiliser authToken si token n'existe pas
    const accessToken = token || authToken

    if (accessToken) {
      console.log("Token trouvé, vérification...")

      // Vérifier si le token est valide
      const response = await fetch(`${API_URL}/auth/verify`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        console.log("Token valide")
        state.isAuthenticated = true
        state.token = accessToken
        state.user = user

        // Charger les données de l'utilisateur
        await loadUserData()
        showLoggedInState()
      } else {
        console.log("Token invalide, suppression")
        // Token invalide, supprimer du stockage
        await window.chrome.storage.local.remove(["token", "user", "authToken"])
        showLoggedOutState()
      }
    } else {
      console.log("Aucun token trouvé")
      showLoggedOutState()
    }
  } catch (error) {
    console.error("Erreur lors de la vérification de l'authentification:", error)
    showLoggedOutState()
  }
}

// Charger les données de l'utilisateur
async function loadUserData() {
  try {
    // Charger les feeds
    const feedsResponse = await fetch(`${API_URL}/feeds`, {
      headers: {
        Authorization: `Bearer ${state.token}`,
      },
    })

    if (feedsResponse.ok) {
      const feeds = await feedsResponse.json()
      state.feeds = feeds
      feedsCount.textContent = `Vous avez ${feeds.length} feed${feeds.length !== 1 ? "s" : ""} configuré${feeds.length !== 1 ? "s" : ""}.`
    }

    // Charger les paramètres
    const settingsResponse = await fetch(`${API_URL}/settings`, {
      headers: {
        Authorization: `Bearer ${state.token}`,
      },
    })

    if (settingsResponse.ok) {
      const settings = await settingsResponse.json()
      state.focusMode = settings.focusMode
      focusModeToggle.checked = settings.focusMode
      focusModeStatus.textContent = settings.focusMode ? "Activé" : "Désactivé"

      // Mettre à jour le stockage local
      await window.chrome.storage.local.set({
        focusMode: settings.focusMode,
        currentFeedId: settings.currentFeedId,
      })
    }
  } catch (error) {
    console.error("Erreur lors du chargement des données utilisateur:", error)
  }
}

// Configurer les écouteurs d'événements
function setupEventListeners() {
  // Bouton de connexion
  loginButton.addEventListener("click", () => {
    window.chrome.tabs.create({ url: `${APP_URL}/login?extension=true` })
  })

  // Bouton de déconnexion
  logoutButton.addEventListener("click", async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${state.token}`,
        },
      })
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error)
    }

    // Supprimer les données locales
    await window.chrome.storage.local.remove(["token", "user", "authToken", "focusMode", "currentFeedId"])

    // Mettre à jour l'état
    state.isAuthenticated = false
    state.token = null
    state.user = null
    state.feeds = []

    showLoggedOutState()
  })

  // Bouton d'ouverture du tableau de bord
  openDashboardButton.addEventListener("click", () => {
    window.chrome.tabs.create({ url: `${APP_URL}/dashboard` })
  })

  // Bouton d'ouverture de LinkedIn
  openLinkedInButton.addEventListener("click", () => {
    window.chrome.tabs.create({ url: "https://www.linkedin.com/feed/" })
  })

  // Toggle du mode focus
  focusModeToggle.addEventListener("change", async () => {
    const focusMode = focusModeToggle.checked
    focusModeStatus.textContent = focusMode ? "Activé" : "Désactivé"

    // Mettre à jour le stockage local
    await window.chrome.storage.local.set({ focusMode })

    // Mettre à jour les paramètres sur le serveur
    try {
      await fetch(`${API_URL}/settings`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${state.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ focusMode }),
      })
    } catch (error) {
      console.error("Erreur lors de la mise à jour du mode focus:", error)
    }

    // Appliquer le mode focus aux onglets LinkedIn ouverts
    window.chrome.tabs.query({ url: "*://*.linkedin.com/*" }, (tabs) => {
      tabs.forEach((tab) => {
        window.chrome.tabs.sendMessage(tab.id, {
          action: focusMode ? "applyFocusMode" : "removeFocusMode",
        })
      })
    })
  })
}

// Afficher l'état de chargement
function showLoadingState() {
  statusLoading.classList.remove("hidden")
  statusConnected.classList.add("hidden")
  statusDisconnected.classList.add("hidden")
  notLoggedInSection.classList.add("hidden")
  loggedInSection.classList.add("hidden")
}

// Afficher l'état connecté
function showLoggedInState() {
  statusLoading.classList.add("hidden")
  statusConnected.classList.remove("hidden")
  statusDisconnected.classList.add("hidden")
  notLoggedInSection.classList.add("hidden")
  loggedInSection.classList.remove("hidden")
}

// Afficher l'état déconnecté
function showLoggedOutState() {
  statusLoading.classList.add("hidden")
  statusConnected.classList.add("hidden")
  statusDisconnected.classList.remove("hidden")
  notLoggedInSection.classList.remove("hidden")
  loggedInSection.classList.add("hidden")
}

// Écouter les messages du background script
window.chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message reçu dans popup.js:", message)

  if (message.action === "authSuccess") {
    console.log("Authentification réussie, mise à jour du token:", message.token ? "***" : null)

    // Mettre à jour le token et l'utilisateur
    window.chrome.storage.local.set(
      {
        token: message.token,
        authToken: message.token,
        user: message.user,
      },
      () => {
        console.log("Token stocké, rechargement de la popup")
        // Recharger la popup
        window.location.reload()
      },
    )
  }
})
