// Feed Focus Lens - background.js (refactoré)
// Toutes les fonctionnalités essentielles : auth, feeds, profils, focus mode, communication, gestion onglets

const API_URL = "https://feed-focus.vercel.app/api"
const APP_URL = "https://feed-focus.vercel.app"

// Pour compatibilité Chrome/Firefox
const chromeApi = typeof window.chrome !== "undefined" ? window.chrome : window.browser

// --- État global ---
let state = {
  feeds: [],
  currentFeedId: null,
  focusMode: false,
  keywordFilter: "",
  contentType: "all",
  isAppliedToLinkedIn: false,
  token: null,
  user: null,
}

const activeTabs = {}

// --- Initialisation de l'état depuis le stockage ---
chromeApi.storage.local.get(
  {
    feeds: [],
    currentFeedId: null,
    focusMode: false,
    keywordFilter: "",
    contentType: "all",
    isAppliedToLinkedIn: false,
    token: null,
    user: null,
    authToken: null,
  },
  (items) => {
    state = { ...state, ...items }
    // Si token est null mais authToken existe, utiliser authToken
    if (!state.token && items.authToken) {
      state.token = items.authToken
    }
    console.log("[Feed Focus] Background initialisé avec état :", state)
    if (state.token) {
      // Vérifier que le token est valide
      verifyToken(state.token)
        .then((isValid) => {
          if (isValid) {
            console.log("[Feed Focus] Token valide, récupération des feeds")
            fetchFeeds()
            fetchSettings()
          } else {
            console.log("[Feed Focus] Token invalide, suppression")
            chromeApi.storage.local.remove(["token", "authToken", "user"])
            state.token = null
            state.user = null
          }
        })
        .catch((error) => {
          console.error("[Feed Focus] Erreur vérification token:", error)
        })
    }
  },
)

// --- Vérification du token ---
async function verifyToken(token) {
  try {
    const response = await fetch(`${API_URL}/auth/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.ok
  } catch (error) {
    console.error("[Feed Focus] Erreur vérification token:", error)
    return false
  }
}

// --- API helpers ---
async function fetchFeeds() {
  try {
    const response = await fetch(`${API_URL}/feeds`, {
      headers: { Authorization: `Bearer ${state.token}` },
    })
    if (response.ok) {
      const feeds = await response.json()
      state.feeds = feeds
      chromeApi.storage.local.set({ feeds })
    }
  } catch (error) {
    console.error("[Feed Focus] Erreur fetchFeeds:", error)
  }
}

async function fetchSettings() {
  try {
    const response = await fetch(`${API_URL}/settings`, {
      headers: { Authorization: `Bearer ${state.token}` },
    })
    if (response.ok) {
      const settings = await response.json()
      state.focusMode = settings.focusMode
      state.currentFeedId = settings.currentFeedId
      chromeApi.storage.local.set({
        focusMode: settings.focusMode,
        currentFeedId: settings.currentFeedId,
      })
    }
  } catch (error) {
    console.error("[Feed Focus] Erreur fetchSettings:", error)
  }
}

// --- Gestion du clic sur l'icône de l'extension ---
chromeApi.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes("linkedin.com")) {
    chromeApi.tabs.sendMessage(tab.id, { action: "toggleSidebar" }, (response) => {
      if (chromeApi.runtime.lastError) {
        console.error("[Feed Focus] Erreur envoi message:", chromeApi.runtime.lastError)
      }
    })
  } else {
    chromeApi.tabs.create({ url: "https://www.linkedin.com/feed/" }, (newTab) => {
      chromeApi.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === newTab.id && info.status === "complete") {
          chromeApi.tabs.onUpdated.removeListener(listener)
          setTimeout(() => {
            chromeApi.tabs.sendMessage(newTab.id, { action: "toggleSidebar" })
          }, 1000)
        }
      })
    })
  }
})

// --- Gestion des messages (API principale de l'extension) ---
chromeApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Feed Focus] Message reçu:", request.action)

  // Pour les handlers asynchrones
  let isAsync = false

  try {
    switch (request.action) {
      case "registerTab":
        if (sender.tab) {
          activeTabs[sender.tab.id] = { url: request.url, initialized: true }
        }
        sendResponse({ success: true })
        break

      case "getState":
        sendResponse({ state })
        break

      case "updateState":
        state = { ...state, ...request.state }
        chromeApi.storage.local.set(state, () => {
          sendResponse({ success: true })
        })
        isAsync = true
        break

      case "addCurrentProfileFromSidebar":
        chromeApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].url.includes("linkedin.com")) {
            chromeApi.tabs.sendMessage(tabs[0].id, { action: "addCurrentProfile" }, (response) => {
              if (chromeApi.runtime.lastError) {
                sendResponse({ success: false, error: chromeApi.runtime.lastError.message })
              } else {
                sendResponse({ success: true })
              }
            })
          } else {
            sendResponse({ success: false, error: "Aucun onglet LinkedIn actif trouvé" })
          }
        })
        isAsync = true
        break

      case "openLinkedInWithFocusMode":
        chromeApi.tabs.create({ url: "https://www.linkedin.com/feed/" }, (tab) => {
          chromeApi.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === "complete") {
              chromeApi.tabs.onUpdated.removeListener(listener)
              setTimeout(() => {
                chromeApi.tabs.sendMessage(tab.id, { action: "applyToLinkedIn" })
              }, 3000)
            }
          })
        })
        sendResponse({ success: true })
        break

      case "openProfile":
        chromeApi.tabs.create({ url: request.url }, (tab) => {
          sendResponse({ success: true, tabId: tab.id })
        })
        isAsync = true
        break

      case "checkTabStatus":
        if (sender.tab && activeTabs[sender.tab.id]) {
          sendResponse({ initialized: activeTabs[sender.tab.id].initialized })
        } else {
          sendResponse({ initialized: false })
        }
        break

      case "openSearchTab":
        chromeApi.tabs.create({ url: request.url, active: true }, (tab) => {
          sendResponse({ success: true, tabId: tab.id })
          chromeApi.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === tab.id && changeInfo.status === "complete") {
              chromeApi.tabs.onUpdated.removeListener(listener)
              setTimeout(() => {
                console.log("[Feed Focus] Nouvel onglet de recherche ouvert:", tab.id)
              }, 2000)
            }
          })
        })
        isAsync = true
        break

      case "openLoginPage":
        chromeApi.tabs.create({ url: `${APP_URL}/login?extension=true` }, (tab) => {
          sendResponse({ success: true, tabId: tab.id })
        })
        isAsync = true
        break

      case "createFeed":
        createFeed(request.name, request.description)
          .then((response) => sendResponse(response))
          .catch((error) => sendResponse({ success: false, error: error.message }))
        isAsync = true
        break

      case "updateFeed":
        updateFeed(request.feedId, request.name, request.description)
          .then((response) => sendResponse(response))
          .catch((error) => sendResponse({ success: false, error: error.message }))
        isAsync = true
        break

      case "deleteFeed":
        deleteFeed(request.feedId)
          .then((response) => sendResponse(response))
          .catch((error) => sendResponse({ success: false, error: error.message }))
        isAsync = true
        break

      case "addProfileToFeed":
        addProfileToFeed(request.profile, request.feedId)
          .then((response) => sendResponse(response))
          .catch((error) => sendResponse({ success: false, error: error.message }))
        isAsync = true
        break

      case "authCallback":
        handleAuthCallback(request.token, request.user)
        sendResponse({ success: true })
        break

      case "checkAuth":
        checkAuth()
          .then((isAuthenticated) => {
            sendResponse({ isAuthenticated })
          })
          .catch((error) => {
            console.error("[Feed Focus] Erreur checkAuth:", error)
            sendResponse({ isAuthenticated: false, error: error.message })
          })
        isAsync = true
        break

      default:
        sendResponse({ success: false, error: "Action inconnue" })
    }
  } catch (error) {
    console.error("[Feed Focus] Erreur handler message:", error)
    sendResponse({ success: false, error: error.message })
  }

  return isAsync
})

// --- Fonctions CRUD Feeds/Profils ---
async function createFeed(name, description) {
  try {
    const response = await fetch(`${API_URL}/feeds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, description }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Erreur lors de la création du feed")
    }
    const feed = await response.json()
    state.feeds.push(feed)
    chromeApi.storage.local.set({ feeds: state.feeds })
    return { success: true, feed }
  } catch (error) {
    console.error("[Feed Focus] Erreur createFeed:", error)
    return { success: false, error: error.message }
  }
}

async function updateFeed(feedId, name, description) {
  try {
    const response = await fetch(`${API_URL}/feeds/${feedId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${state.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, description }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Erreur lors de la mise à jour du feed")
    }
    const updatedFeed = await response.json()
    const feedIndex = state.feeds.findIndex((feed) => feed.id === feedId)
    if (feedIndex !== -1) {
      state.feeds[feedIndex] = updatedFeed
      chromeApi.storage.local.set({ feeds: state.feeds })
    }
    return { success: true, feed: updatedFeed }
  } catch (error) {
    console.error("[Feed Focus] Erreur updateFeed:", error)
    return { success: false, error: error.message }
  }
}

async function deleteFeed(feedId) {
  try {
    const response = await fetch(`${API_URL}/feeds/${feedId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` },
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Erreur lors de la suppression du feed")
    }
    state.feeds = state.feeds.filter((feed) => feed.id !== feedId)
    chromeApi.storage.local.set({ feeds: state.feeds })
    if (state.currentFeedId === feedId) {
      state.currentFeedId = null
      chromeApi.storage.local.set({ currentFeedId: null })
    }
    return { success: true }
  } catch (error) {
    console.error("[Feed Focus] Erreur deleteFeed:", error)
    return { success: false, error: error.message }
  }
}

async function addProfileToFeed(profile, feedId) {
  try {
    const response = await fetch(`${API_URL}/feeds/${feedId}/profiles`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: profile.name,
        title: profile.title,
        imageUrl: profile.imageUrl,
        linkedinUrl: profile.linkedinUrl,
        uniqueId: profile.uniqueId,
      }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Erreur lors de l'ajout du profil au feed")
    }
    const newProfile = await response.json()
    const feedIndex = state.feeds.findIndex((feed) => feed.id === feedId)
    if (feedIndex !== -1) {
      if (!state.feeds[feedIndex].profiles) state.feeds[feedIndex].profiles = []
      state.feeds[feedIndex].profiles.push(newProfile)
      chromeApi.storage.local.set({ feeds: state.feeds })
    }
    return { success: true, profile: newProfile }
  } catch (error) {
    console.error("[Feed Focus] Erreur addProfileToFeed:", error)
    return { success: false, error: error.message }
  }
}

// --- Authentification ---
async function checkAuth() {
  if (!state.token) return false

  try {
    const response = await fetch(`${API_URL}/auth/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${state.token}`,
      },
    })
    return response.ok
  } catch (error) {
    console.error("[Feed Focus] Erreur vérification auth:", error)
    return false
  }
}

function handleAuthCallback(token, user) {
  console.log("[Feed Focus] Callback d'authentification reçu:", { token: token ? "***" : null, user })

  if (!token) {
    console.error("[Feed Focus] Token manquant dans le callback d'authentification")
    return
  }

  state.token = token
  state.user = user

  // Stocker le token sous les deux clés pour compatibilité
  chromeApi.storage.local.set({ token, user, authToken: token }, () => {
    if (chromeApi.runtime.lastError) {
      console.error("[Feed Focus] Erreur lors du stockage du token:", chromeApi.runtime.lastError)
    } else {
      console.log("[Feed Focus] Token stocké avec succès")

      // Récupérer les données
      fetchFeeds()
      fetchSettings()

      // Notifier tous les scripts de l'authentification réussie
      chromeApi.runtime.sendMessage({ action: "authSuccess", token, user })

      // Notifier explicitement la mise à jour du token pour le content script
      chromeApi.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chromeApi.tabs.sendMessage(tab.id, { action: "authTokenUpdated", token }).catch(() => {
            /* Ignorer les erreurs pour les onglets qui ne peuvent pas recevoir de messages */
          })
        })
      })
    }
  })
}

// --- Gestion des onglets LinkedIn et callback d'auth ---
chromeApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // LinkedIn tab ready
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("linkedin.com") &&
    (!activeTabs[tabId] || !activeTabs[tabId].initialized)
  ) {
    activeTabs[tabId] = { url: tab.url, initialized: false }
    let attempts = 0
    const maxAttempts = 3
    const checkInit = () => {
      chromeApi.tabs.sendMessage(tabId, { action: "checkInit" }, (response) => {
        if (chromeApi.runtime.lastError) {
          attempts++
          if (attempts < maxAttempts) setTimeout(checkInit, 1000)
          return
        }
        if (response && response.initialized) {
          activeTabs[tabId].initialized = true
          if (tab.url.includes("/in/")) {
            chromeApi.tabs.sendMessage(tabId, { action: "refreshProfileButton" })
          }
          if (state.isAppliedToLinkedIn) {
            chromeApi.tabs.sendMessage(tabId, { action: "applyToLinkedIn" })
          }
        } else if (attempts < maxAttempts) {
          attempts++
          setTimeout(checkInit, 1000)
        }
      })
    }
    setTimeout(checkInit, 500)
  }

  // Auth callback
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes(`${APP_URL}/auth/callback`) &&
    tab.url.includes("extension=true")
  ) {
    const url = new URL(tab.url)
    const token = url.searchParams.get("token")
    const userJson = url.searchParams.get("user")
    if (token && userJson) {
      try {
        const user = JSON.parse(decodeURIComponent(userJson))
        handleAuthCallback(token, user)
        // Ne pas fermer l'onglet, laisser la page de callback le faire
      } catch (error) {
        console.error("[Feed Focus] Erreur callback auth:", error)
      }
    }
  }

  // Vérifier si l'onglet est la page de callback d'extension
  if (changeInfo.status === "complete" && tab.url && tab.url.includes(`${APP_URL}/auth/extension-callback`)) {
    console.log("[Feed Focus] Page de callback d'extension détectée")

    // Essayer de récupérer le token depuis le localStorage
    chromeApi.tabs.executeScript(
      tabId,
      {
        code: `
        {
          const token = localStorage.getItem("feedFocusAuthToken");
          const user = localStorage.getItem("feedFocusUser");
          if (token && user) {
            chrome.runtime.sendMessage({
              action: "authCallback",
              token,
              user: JSON.parse(decodeURIComponent(user))
            });
            localStorage.removeItem("feedFocusAuthToken");
            localStorage.removeItem("feedFocusUser");
            "Token récupéré avec succès";
          } else {
            "Aucun token trouvé";
          }
        }
      `,
      },
      (result) => {
        if (chromeApi.runtime.lastError) {
          console.error("[Feed Focus] Erreur lors de l'exécution du script:", chromeApi.runtime.lastError)
        } else if (result && result[0]) {
          console.log("[Feed Focus] Résultat de la récupération du token:", result[0])
        }
      },
    )
  }
})

// --- Nettoyage des onglets actifs ---
chromeApi.tabs.onRemoved.addListener((tabId) => {
  if (activeTabs[tabId]) delete activeTabs[tabId]
})

// --- Menu contextuel LinkedIn ---
chromeApi.runtime.onInstalled.addListener(() => {
  chromeApi.contextMenus.create({
    id: "addToFeedFocus",
    title: "Add to Feed Focus",
    contexts: ["link"],
    documentUrlPatterns: ["*://*.linkedin.com/*"],
  })
})

chromeApi.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "addToFeedFocus" && info.linkUrl && info.linkUrl.includes("linkedin.com")) {
    const profileUrl = info.linkUrl
    const profileId = profileUrl.match(/\/in\/([^/]+)/)?.[1]
    if (profileId) {
      chromeApi.tabs.sendMessage(tab.id, {
        action: "extractProfileFromLink",
        profileUrl,
        profileId,
      })
    }
  }
})
