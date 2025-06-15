// Fonctions d'authentification pour content.js

// Déclaration des variables globales
const chrome = window.chrome // Assuming chrome is available in the window object
const state = {} // Assuming state is an object that holds application state
const windowObj = window // Assuming window is available in the window object
const documentObj = document // Assuming document is available in the document object

// Fonction pour vérifier si c'est la page de profil
function isProfilePage() {
  // Logique pour déterminer si c'est la page de profil
  return windowObj.location.pathname.includes("/profile")
}

// Fonction pour obtenir les données du profil
function getProfileData() {
  // Logique pour obtenir les données du profil
  return windowObj.tempProfileData
}

// Fonction pour afficher une notification
function showNotification(message, type) {
  // Logique pour afficher une notification
  console.log(`Notification (${type}): ${message}`)
}

// Fonction pour masquer la sidebar
function hideSidebar() {
  const sidebar = documentObj.querySelector(".feed-focus-sidebar")
  if (sidebar) {
    sidebar.style.right = "-300px" // Assuming sidebar is initially positioned to the right
  }
}

// Fonction pour afficher la sidebar
function showSidebar() {
  const sidebar = documentObj.querySelector(".feed-focus-sidebar")
  if (sidebar) {
    sidebar.style.right = "0px" // Assuming sidebar should be visible on the right
  }
}

// Fonction pour masquer le sélecteur de feed
function hideFeedSelectorFn() {
  const feedSelector = documentObj.querySelector(".feed-focus-feed-selector")
  if (feedSelector) {
    feedSelector.style.display = "none"
  }
}

// Fonction pour afficher le sélecteur de feed
function showFeedSelectorFn(profileData) {
  const feedSelector = documentObj.querySelector(".feed-focus-feed-selector")
  if (feedSelector) {
    feedSelector.style.display = "block"
    // Logique pour afficher les feeds avec les données du profil
    console.log("Profile data:", profileData)
  }
}

// Vérifier l'authentification
async function checkAuth() {
  try {
    const { token, authToken } = await chrome.storage.local.get(["token", "authToken"])
    const accessToken = token || authToken
    return !!accessToken
  } catch (error) {
    console.error("Erreur lors de la vérification de l'authentification:", error)
    return false
  }
}

// Fonction pour obtenir le token
async function getToken() {
  try {
    const { token, authToken } = await chrome.storage.local.get(["token", "authToken"])
    return token || authToken || null
  } catch (error) {
    console.error("Erreur lors de la récupération du token:", error)
    return null
  }
}

// Fonction pour afficher la modale de connexion
function showAuthModal() {
  // Créer la modale si elle n'existe pas
  let authModal = documentObj.getElementById("feed-focus-auth-modal")

  if (!authModal) {
    authModal = documentObj.createElement("div")
    authModal.id = "feed-focus-auth-modal"
    authModal.className = "feed-focus-modal"
    authModal.style.display = "flex"

    authModal.innerHTML = `
      <div class="feed-focus-modal-content" style="max-width: 400px;">
        <div class="feed-focus-modal-header">
          <h2>Connexion requise</h2>
          <button class="feed-focus-close-modal">×</button>
        </div>
        <div class="feed-focus-modal-body">
          <p>Vous devez vous connecter à Feed Focus pour utiliser cette fonctionnalité.</p>
          <p>Cliquez sur le bouton ci-dessous pour vous connecter ou créer un compte.</p>
        </div>
        <div class="feed-focus-modal-footer">
          <button id="feed-focus-auth-cancel" class="feed-focus-button-secondary">Annuler</button>
          <button id="feed-focus-auth-login" class="feed-focus-button-primary">Se connecter</button>
        </div>
      </div>
    `

    documentObj.body.appendChild(authModal)

    // Ajouter les écouteurs d'événements
    documentObj.querySelector(".feed-focus-close-modal").addEventListener("click", hideAuthModal)
    documentObj.getElementById("feed-focus-auth-cancel").addEventListener("click", hideAuthModal)
    documentObj.getElementById("feed-focus-auth-login").addEventListener("click", () => {
      hideAuthModal()
      chrome.runtime.sendMessage({ action: "openLoginPage" })
    })
  } else {
    authModal.style.display = "flex"
  }
}

// Fonction pour masquer la modale de connexion
function hideAuthModal() {
  const authModal = documentObj.getElementById("feed-focus-auth-modal")
  if (authModal) {
    authModal.style.display = "none"
  }
}

// Écouter les messages d'authentification
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "authTokenUpdated") {
    console.log("Token d'authentification mis à jour")
    // Rafraîchir les éléments d'interface qui dépendent de l'authentification
    if (isProfilePage()) {
      setTimeout(() => {
        addProfileButtonFn()
      }, 500)
    }
    sendResponse({ success: true })
    return true
  }
})

// Modifier la fonction toggleSidebar pour vérifier l'authentification
async function toggleSidebar() {
  const sidebar = documentObj.querySelector(".feed-focus-sidebar")
  const overlay = documentObj.querySelector(".feed-focus-overlay")

  if (sidebar.style.right === "0px") {
    hideSidebar()
  } else {
    // Vérifier l'authentification avant d'afficher la sidebar
    const isAuthenticated = await checkAuth()
    if (!isAuthenticated) {
      showAuthModal()
      return
    }
    showSidebar()
  }
}

// Modifier la fonction addProfileToSelectedFeed pour vérifier l'authentification
async function addProfileToSelectedFeed() {
  // Vérifier l'authentification
  const isAuthenticated = await checkAuth()
  if (!isAuthenticated) {
    showAuthModal()
    return
  }

  const selectedFeed = documentObj.querySelector(".feed-focus-feed-item.active")
  if (!selectedFeed) {
    showNotification("Veuillez sélectionner un feed", "error")
    return
  }

  const feedId = selectedFeed.dataset.id
  const profileData = windowObj.tempProfileData

  if (!profileData) {
    showNotification("Données du profil non trouvées", "error")
    return
  }

  console.log("Tentative d'ajout du profil au feed:", feedId)
  console.log("Données du profil:", profileData)

  // Envoyer la demande au background script
  chrome.runtime.sendMessage(
    {
      action: "addProfileToFeed",
      profile: profileData,
      feedId: feedId,
    },
    (response) => {
      if (response && response.success) {
        showNotification("Profil ajouté avec succès", "success")
        hideFeedSelectorFn()
      } else {
        showNotification("Erreur lors de l'ajout du profil: " + (response?.error || "Erreur inconnue"), "error")
      }
    },
  )
}

// Modifier la fonction addCurrentProfile pour vérifier l'authentification
async function addCurrentProfile() {
  // Vérifier l'authentification
  const isAuthenticated = await checkAuth()
  if (!isAuthenticated) {
    showAuthModal()
    return
  }

  // Vérifier si des feeds existent
  if (!state.feeds || state.feeds.length === 0) {
    showNotification("Veuillez d'abord créer un feed.", "error")
    return
  }

  // Get profile data with retry mechanism
  let profileData = getProfileData()
  let attempts = 0
  const maxAttempts = 3

  const tryGetProfile = () => {
    if (!profileData || !profileData.name || !profileData.linkedinUrl) {
      if (attempts < maxAttempts) {
        attempts++
        setTimeout(() => {
          profileData = getProfileData()
          tryGetProfile()
        }, 500)
      } else {
        showNotification("Impossible d'extraire les données du profil", "error")
      }
    } else {
      // Show feed selector with valid profile data
      showFeedSelectorFn(profileData)
    }
  }

  tryGetProfile()
}

// Fonction pour ajouter le bouton de profil sur la page de profil
function addProfileButtonFn() {
  // Logique pour ajouter le bouton de profil
  console.log("Adding profile button to profile page")
}
