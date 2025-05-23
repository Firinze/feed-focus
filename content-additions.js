// Ajouter ces fonctions au début du fichier content.js

// Configuration
const API_URL = "https://feed-focus.vercel.app/api"
const APP_URL = "https://feed-focus.vercel.app"

// Déclaration des variables globales
let chrome
let hideSidebar
let showSidebar
let showNotification
let hideFeedSelectorFn
let state = {}
let getProfileData
let showFeedSelectorFn
let injectStyles
let createUI
let isProfilePage
let addProfileButtonFn
let setupProfileObserver
let setupUrlChangeObserver

// Vérifier l'authentification
async function checkAuth() {
  try {
    const { token } = await chrome.storage.local.get("token")
    return !!token
  } catch (error) {
    console.error("Erreur lors de la vérification de l'authentification:", error)
    return false
  }
}

// Fonction pour obtenir le token
async function getToken() {
  try {
    const { token } = await chrome.storage.local.get("token")
    return token
  } catch (error) {
    console.error("Erreur lors de la récupération du token:", error)
    return null
  }
}

// Fonction pour afficher la modale de connexion
function showAuthModal() {
  // Créer la modale si elle n'existe pas
  let authModal = document.getElementById("feed-focus-auth-modal")

  if (!authModal) {
    authModal = document.createElement("div")
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

    document.body.appendChild(authModal)

    // Ajouter les écouteurs d'événements
    document.querySelector(".feed-focus-close-modal").addEventListener("click", hideAuthModal)
    document.getElementById("feed-focus-auth-cancel").addEventListener("click", hideAuthModal)
    document.getElementById("feed-focus-auth-login").addEventListener("click", () => {
      hideAuthModal()
      chrome.runtime.sendMessage({ action: "openAuthPage" })
    })
  } else {
    authModal.style.display = "flex"
  }
}

// Fonction pour masquer la modale de connexion
function hideAuthModal() {
  const authModal = document.getElementById("feed-focus-auth-modal")
  if (authModal) {
    authModal.style.display = "none"
  }
}

// Modifier la fonction toggleSidebar pour vérifier l'authentification
async function toggleSidebar() {
  // Vérifier l'authentification
  const isAuthenticated = await checkAuth()

  if (!isAuthenticated) {
    showAuthModal()
    return
  }

  const sidebar = document.querySelector(".feed-focus-sidebar")
  const overlay = document.querySelector(".feed-focus-overlay")

  if (sidebar.style.right === "0px") {
    hideSidebar()
  } else {
    showSidebar()
  }
}

// Modifier la fonction addProfileToSelectedFeed pour utiliser l'API
async function addProfileToSelectedFeed() {
  // Vérifier l'authentification
  const isAuthenticated = await checkAuth()

  if (!isAuthenticated) {
    showAuthModal()
    return
  }

  const selectedFeed = document.querySelector(".feed-focus-feed-item.active")
  if (!selectedFeed) {
    showNotification("Please select a feed", "error")
    return
  }

  const feedId = selectedFeed.dataset.id
  const profileData = window.tempProfileData

  if (!profileData) {
    showNotification("Profile data not found", "error")
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

// Modifier la fonction saveFeed pour utiliser l'API
function saveFeed() {
  console.log("Tentative de sauvegarde du feed...")

  const feedNameInput = document.querySelector("#feed-focus-feed-name")
  const feedDescriptionInput = document.querySelector("#feed-focus-feed-description")

  if (!feedNameInput || !feedDescriptionInput) {
    console.error("Éléments du formulaire non trouvés")
    showNotification("Error: Form elements not found", "error")
    return
  }

  const name = feedNameInput.value.trim()
  const description = feedDescriptionInput.value.trim()

  console.log("Nom du feed:", name)
  console.log("Description:", description)

  if (!name) {
    showNotification("Please enter a feed name", "error")
    return
  }

  // Vérifier l'authentification
  checkAuth().then((isAuthenticated) => {
    if (!isAuthenticated) {
      showAuthModal()
      return
    }

    if (state.editingFeedId) {
      // Mettre à jour un feed existant
      chrome.runtime.sendMessage(
        {
          action: "updateFeed",
          feedId: state.editingFeedId,
          name: name,
          description: description,
        },
        (response) => {
          if (response && response.success) {
            closeFeedModal()
            showNotification("Feed mis à jour avec succès", "success")

            // Recharger les feeds
            chrome.runtime.sendMessage({ action: "getState" }, (response) => {
              if (response && response.state) {
                state = response.state
                renderFeeds()
              }
            })
          } else {
            showNotification(
              "Erreur lors de la mise à jour du feed: " + (response?.error || "Erreur inconnue"),
              "error",
            )
          }
        },
      )
    } else {
      // Créer un nouveau feed
      chrome.runtime.sendMessage(
        {
          action: "createFeed",
          name: name,
          description: description,
        },
        (response) => {
          if (response && response.success) {
            closeFeedModal()
            showNotification("Feed créé avec succès", "success")

            // Recharger les feeds
            chrome.runtime.sendMessage({ action: "getState" }, (response) => {
              if (response && response.state) {
                state = response.state
                renderFeeds()
              }
            })
          } else {
            showNotification("Erreur lors de la création du feed: " + (response?.error || "Erreur inconnue"), "error")
          }
        },
      )
    }
  })
}

// Modifier la fonction deleteFeed pour utiliser l'API
function deleteFeed(feedId) {
  if (!confirm("Are you sure you want to delete this feed?")) {
    return
  }

  // Vérifier l'authentification
  checkAuth().then((isAuthenticated) => {
    if (!isAuthenticated) {
      showAuthModal()
      return
    }

    chrome.runtime.sendMessage(
      {
        action: "deleteFeed",
        feedId: feedId,
      },
      (response) => {
        if (response && response.success) {
          showNotification("Feed supprimé avec succès", "success")

          // Recharger les feeds
          chrome.runtime.sendMessage({ action: "getState" }, (response) => {
            if (response && response.state) {
              state = response.state
              renderFeeds()
            }
          })
        } else {
          showNotification("Erreur lors de la suppression du feed: " + (response?.error || "Erreur inconnue"), "error")
        }
      },
    )
  })
}

// Modifier la fonction addCurrentProfile pour utiliser l'API
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

// Modifier la fonction init pour vérifier l'authentification
async function init() {
  console.log("Feed Focus: Début de l'initialisation")

  try {
    // Injecter les styles
    await injectStyles()

    // Vérifier l'authentification
    const isAuthenticated = await checkAuth()

    // Charger les paramètres sauvegardés
    chrome.storage.local.get(
      {
        feeds: [],
        currentFeedId: null,
        focusMode: false,
        currentUserId: null,
      },
      async (items) => {
        // Mettre à jour l'état
        Object.assign(state, items)
        console.log("Feed Focus: État chargé", state)

        // Créer l'interface utilisateur
        await createUI()

        // Ajouter le bouton de profil si on est sur une page de profil
        if (isProfilePage()) {
          setTimeout(() => {
            addProfileButtonFn()
          }, 1000)
        }

        // Configurer les observateurs
        setupProfileObserver()
        setupUrlChangeObserver()
      },
    )
  } catch (error) {
    console.error("Feed Focus: Erreur lors de l'initialisation", error)
  }
}
