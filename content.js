// Fonction pour vérifier le chargement des styles CSS
function checkCSSLoaded() {
  console.log("Feed Focus: Vérification du chargement CSS")
  const testElement = document.createElement("div")
  testElement.className = "feed-focus-action-button"
  testElement.style.display = "none"
  document.body.appendChild(testElement)

  const styles = window.getComputedStyle(testElement)
  const isLoaded = styles.position === "fixed" && styles.zIndex === "9999" && styles.borderRadius === "50%"

  console.log("Feed Focus: État du chargement CSS -", {
    isLoaded,
    position: styles.position,
    zIndex: styles.zIndex,
    borderRadius: styles.borderRadius,
  })

  testElement.remove()
  return isLoaded
}

// Fonction pour vérifier l'injection du script et des styles
function checkInjection() {
  // Ajouter un élément de test dans le DOM
  const testElement = document.createElement("div")
  testElement.id = "feed-focus-test"
  testElement.style.display = "none"
  document.body.appendChild(testElement)

  // Vérifier si le script est injecté
  console.log("Feed Focus: Vérification de l'injection du script")
  console.log("Feed Focus: Test element présent:", !!document.getElementById("feed-focus-test"))

  // Vérifier si les styles sont chargés
  const computedStyle = window.getComputedStyle(testElement)
  console.log("Feed Focus: Styles calculés:", computedStyle)

  // Nettoyer
  testElement.remove()
}

// Modifier la fonction extractUniqueProfileId pour capturer l'URN complet avec tous les caractères spéciaux
function extractUniqueProfileId() {
  try {
    return (() => {
      const pageSource = document.documentElement.innerHTML

      // Étape 1 : Rechercher les lignes contenant 'targetInviteeResolutionResult'
      const regex = /^.*targetInviteeResolutionResult.*$/gm
      const targetLines = pageSource.match(regex) || []

      // Étape 2 : Extraire les IDs de profil au format 'urn:li:fsd_profile:xxxxx'
      // Modification du regex pour capturer l'ID complet avec tous les caractères spéciaux
      const profileRegex = /urn:li:fsd_profile:[A-Za-z0-9_-]+/g
      const profileMatches = targetLines.flatMap((line) => line.match(profileRegex) || [])

      if (profileMatches.length > 0) {
        // Retourner l'URN complet au lieu de juste l'ID
        console.log("✅ URN du profil visité trouvé (targetInvitee):", profileMatches[0])
        return profileMatches[0]
      }

      // Fallback : scanner les balises <script>
      const scripts = document.querySelectorAll("script")
      for (const script of scripts) {
        const content = script.textContent

        const targetScriptMatch = content.match(
          /targetInviteeResolutionResult":\s*"(urn:li:fsd_profile:[A-Za-z0-9_-]+)"/,
        )
        if (targetScriptMatch && targetScriptMatch[1]) {
          console.log("✅ URN du profil visité trouvé (script targetInvitee):", targetScriptMatch[1])
          return targetScriptMatch[1]
        }

        const fsdMatch = content.match(/"(urn:li:fsd_profile:[A-Za-z0-9_-]+)"/)
        if (fsdMatch && fsdMatch[1]) {
          console.log("✅ URN du profil trouvé (fsd_profile):", fsdMatch[1])
          return fsdMatch[1]
        }
      }

      console.warn("❌ Aucun ID de profil trouvé.")
      return null
    })()
  } catch (error) {
    console.error("Erreur lors de l'extraction de l'ID du profil:", error)
    return null
  }
}

// Modifier la fonction storeCurrentUserId pour capturer l'URN complet
async function storeCurrentUserId() {
  console.log("Feed Focus: Tentative d'extraction de l'ID utilisateur")

  try {
    // Extraire l'ID depuis le code source de la page
    const pageSource = document.documentElement.innerHTML
    let userId = null

    // Chercher d'abord dans les données globales
    if (window.hasOwnProperty("__INITIAL_STATE__")) {
      const state = window.__INITIAL_STATE__
      if (state && state.self && state.self.enterpriseMember && state.self.enterpriseMember.miniProfile) {
        const profileUrn = state.self.enterpriseMember.miniProfile.entityUrn
        // Modification du regex pour capturer l'ID complet avec tous les caractères spéciaux
        const match = profileUrn.match(/urn:li:fs_miniProfile:([A-Za-z0-9_-]+)/)
        if (match && match[1]) {
          userId = match[1]
          console.log("Feed Focus: ID utilisateur trouvé dans les données globales:", userId)
        }
      }
    }

    // Si pas trouvé, chercher dans le code source
    if (!userId) {
      // Modification du regex pour capturer l'ID complet avec tous les caractères spéciaux
      const inviterMatch = pageSource.match(/inviterResolutionResult":\s*"urn:li:fsd_profile:([A-Za-z0-9_-]+)"/)
      if (inviterMatch && inviterMatch[1]) {
        userId = inviterMatch[1]
        console.log("Feed Focus: ID utilisateur trouvé dans le code source:", userId)
      }
    }

    // Si toujours pas trouvé, chercher dans les scripts
    if (!userId) {
      const scripts = document.querySelectorAll("script")
      for (const script of scripts) {
        const content = script.textContent
        if (content && content.includes("inviterResolutionResult")) {
          // Modification du regex pour capturer l'ID complet avec tous les caractères spéciaux
          const match = content.match(/inviterResolutionResult":\s*"urn:li:fsd_profile:([A-Za-z0-9_-]+)"/)
          if (match && match[1]) {
            userId = match[1]
            console.log("Feed Focus: ID utilisateur trouvé dans les scripts:", match[1])
            break
          }
        }
      }
    }

    // Si un ID a été trouvé, le stocker
    if (userId) {
      state.currentUserId = userId
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ currentUserId: userId }, () => {
          if (chrome.runtime.lastError) {
            console.error("Feed Focus: Erreur lors du stockage de l'ID utilisateur:", chrome.runtime.lastError)
            reject(chrome.runtime.lastError)
          } else {
            console.log("Feed Focus: ID utilisateur stocké avec succès")
            resolve()
          }
        })
      })
    } else {
      console.warn("Feed Focus: Impossible de trouver l'ID utilisateur")
    }
  } catch (error) {
    console.error("Feed Focus: Erreur lors de l'extraction de l'ID utilisateur:", error)
  }
}

// State management
console.log("Feed Focus: Début du chargement du script")
checkInjection()

const state = {
  feeds: [],
  currentFeedId: null,
  focusMode: false,
  editingFeedId: null,
  currentPage: 1,
  resultsPerPage: 5,
  allProfiles: [], // All profiles across all feeds
  currentUserId: null, // ID unique de l'utilisateur courant
  authToken: null,
  isAuthenticated: false,
}

// Stats for focus mode
const stats = {
  totalItems: 0,
  relevantItems: 0,
}

// LinkedIn selectors for DOM manipulation
const LINKEDIN_SELECTORS = {
  // Main feed container
  feedContainer: ".core-rail",

  // Feed items
  feedItems: [
    ".feed-shared-update-v2",
    ".update-components-actor",
    ".artdeco-card",
    ".feed-shared-article",
    ".feed-shared-external-article",
    ".feed-shared-poll",
    ".feed-shared-document",
    ".feed-shared-image",
    ".feed-shared-video",
    ".feed-shared-carousel",
    ".feed-shared-text",
    ".feed-shared-event",
    ".feed-shared-job",
    ".feed-shared-newsletter",
    ".update-components-text",
    ".update-components-article",
    ".update-components-image",
    ".update-components-video",
    ".update-components-document",
    ".update-components-carousel",
    ".update-components-poll",
    ".update-components-event",
    ".update-components-job",
    ".update-components-newsletter",
    ".update-components-external-article",
    ".ember-view.occludable-update",
    ".feed-new-update-pill",
    ".relative.feed-shared-update-v2",
    ".feed-shared-update-v2__description-wrapper",
  ].join(", "),

  // Author information
  author: {
    container:
      ".feed-shared-actor, .update-components-actor, .update-components-actor__container, .feed-shared-actor__container",
    name: ".feed-shared-actor__name, .update-components-actor__name, .update-components-actor__title, .feed-shared-actor__title, .feed-shared-actor__name span, .update-components-actor__name span, .feed-shared-actor__meta a, .update-components-actor__meta a, .feed-shared-actor__sub-description a, .update-components-actor__sub-description a",
    link: ".feed-shared-actor__meta-link, .update-components-actor__meta-link, .feed-shared-actor__container-link, .update-components-actor__container-link, a[data-control-name='actor'], .feed-shared-actor__meta a, .update-components-actor__meta a, .feed-shared-actor__sub-description a, .update-components-actor__sub-description a",
    image:
      ".feed-shared-actor__avatar-image, .update-components-actor__avatar-image, .presence-entity__image, .feed-shared-actor__avatar, .update-components-actor__avatar, .feed-shared-actor__avatar img, .update-components-actor__avatar img",
  },

  // Elements to hide in focus mode
  distractions: [
    ".scaffold-layout__sidebar",
    ".scaffold-layout__aside",
    ".global-nav",
    "footer",
    ".scaffold-layout__header",
    ".ad-banner-container",
    ".feed-shared-update-v2__sponsorship",
    ".feed-shared-update--sponsored",
    ".right-rail",
    ".feed-follows-module",
    ".feed-shared-news-module",
    ".feed-shared-job-module",
    ".feed-shared-promo-module",
    ".global-nav__secondary-items",
    ".global-nav-settings",
    ".share-box-feed-entry__trigger",
    ".msg-overlay-bubble-header",
    ".msg-overlay-list-bubble",
    ".msg-overlay-conversation-bubble",
    ".msg-overlay-container",
    ".share-box__open",
    ".artdeco-card.p4",
    ".share-box",
    ".share-box__container",
    ".share-box-feed-entry",
    ".share-box-feed-entry__closed-share-box",
    ".share-box-feed-entry-toolbar__wrapper",
    ".share-box-feed-entry__tool-bar",
    ".share-box-feed-entry__top-bar",
  ].join(", "),

  // Profile page selectors
  profile: {
    name: [
      ".pv-top-card-section__name",
      ".text-heading-xlarge",
      "h1.text-heading-xlarge",
      ".pv-text-details__left-panel h1",
    ],
    title: [".pv-top-card-section__headline", ".text-body-medium", ".pv-text-details__left-panel .text-body-medium"],
    image: [
      ".pv-top-card-section__photo img",
      ".pv-top-card__photo img",
      ".profile-photo-edit__preview",
      ".profile-picture img",
      ".pv-top-card-profile-picture__image",
      ".presence-entity__image",
    ],
    actionButtons: [
      ".pv-top-card-v2__actions",
      ".pvs-profile-actions",
      ".ph5.pb5 .pv-top-card-v2__actions",
      ".pv-top-card--list + div",
      ".display-flex.mt2",
      ".pv-top-card-v2__actions-bar",
      ".artdeco-dropdown__content",
      ".pvs-profile-actions__action",
    ],
  },
}

// Force l'injection des styles CSS
function injectStyles() {
  return new Promise((resolve, reject) => {
    console.log("Feed Focus: Injection des styles CSS")

    // Vérifier si les styles sont déjà injectés
    const existingStyles = document.querySelector("link[data-feed-focus-styles]")
    if (existingStyles) {
      console.log("Feed Focus: Styles déjà injectés")
      resolve(true)
      return
    }

    // Créer le lien vers la feuille de style
    const linkElement = document.createElement("link")
    linkElement.setAttribute("rel", "stylesheet")
    linkElement.setAttribute("type", "text/css")
    linkElement.setAttribute("href", chrome.runtime.getURL("content.css"))
    linkElement.setAttribute("data-feed-focus-styles", "true")

    // Gérer le chargement
    linkElement.onload = () => {
      console.log("Feed Focus: Styles chargés avec succès")
      resolve(true)
    }
    linkElement.onerror = (error) => {
      console.error("Feed Focus: Erreur de chargement des styles", error)
      reject(error)
    }

    // Injecter dans le head
    document.head.appendChild(linkElement)
  })
}

// Ajouter un observateur pour gérer les changements dynamiques de la page
function setupProfileObserver() {
  // Déconnecter l'ancien observateur s'il existe
  if (window.profileObserver) {
    window.profileObserver.disconnect()
  }

  let lastUrl = location.href
  let retryCount = 0
  const maxRetries = 5

  function tryAddProfileSection() {
    if (isProfilePage() && window.location.pathname !== "/feed/") {
      const existingSection = document.getElementById("feed-focus-section")
      if (!existingSection) {
        // Vérifier si les éléments nécessaires sont présents
        const profileCard = document.querySelector(".pv-top-card") || document.querySelector(".artdeco-card")

        if (profileCard) {
          console.log("Éléments du profil trouvés, ajout de la section My Feed")
          addProfileButtonFn()
          retryCount = 0
        } else if (retryCount < maxRetries) {
          console.log(`Tentative ${retryCount + 1}/${maxRetries} d'ajout de la section My Feed`)
          retryCount++
          setTimeout(tryAddProfileSection, 1000)
        }
      }
    }
  }

  // Créer un nouvel observateur
  window.profileObserver = new MutationObserver((mutations) => {
    const currentUrl = location.href
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl
      console.log("Changement d'URL détecté:", currentUrl)
      retryCount = 0

      if (isProfilePage() && window.location.pathname !== "/feed/") {
        setTimeout(tryAddProfileSection, 500)
      } else {
        // Si nous sommes sur le feed, supprimer la section si elle existe
        const existingSection = document.getElementById("feed-focus-section")
        if (existingSection) {
          existingSection.remove()
        }
      }
    }
  })

  // Observer les changements dans le corps du document
  window.profileObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  })

  // Vérifier immédiatement si nous sommes sur une page de profil
  if (isProfilePage() && window.location.pathname !== "/feed/") {
    setTimeout(tryAddProfileSection, 500)
  }

  console.log("Observateur de profil configuré")
}

// Ajouter une fonction pour surveiller les changements d'URL
function setupUrlChangeObserver() {
  let lastUrl = location.href

  // Observer les changements dans l'historique
  window.addEventListener("popstate", () => {
    checkUrlChange()
  })

  // Créer un observateur pour les changements d'URL via pushState/replaceState
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      checkUrlChange()
    }
  })

  // Observer les changements dans le titre de la page (souvent modifié avec l'URL)
  observer.observe(document.querySelector("title"), {
    subtree: true,
    characterData: true,
    childList: true,
  })

  function checkUrlChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      console.log("URL changed to:", lastUrl)

      // Attendre que le DOM soit mis à jour
      setTimeout(() => {
        if (isProfilePage()) {
          updateProfileSection()
        } else {
          // Supprimer la section si on n'est pas sur une page de profil
          const existingSection = document.getElementById("feed-focus-section")
          if (existingSection) {
            existingSection.remove()
          }
        }
      }, 1000)
    }
  }
}

// Create UI elements
async function createUI() {
  console.log("Feed Focus: Début de la création de l'UI")

  try {
    // Create the floating action button
    await createFloatingButton()
    console.log("Feed Focus: Bouton flottant créé")

    // Create the sidebar
    const sidebar = await createSidebar()
    console.log("Feed Focus: Sidebar créée")

    // Create feed selector dialog
    const selector = await createFeedSelector()
    console.log("Feed Focus: Sélecteur de feed créé")

    // Create feed modal
    const modal = await createFeedModal()
    console.log("Feed Focus: Modal créée")

    // Verify all elements are present
    const elements = {
      button: document.querySelector(".feed-focus-action-button"),
      sidebar: document.querySelector(".feed-focus-sidebar"),
      selector: document.querySelector(".feed-focus-feed-selector"),
      modal: document.querySelector("#feed-focus-feed-modal"),
    }

    const missingElements = Object.entries(elements)
      .filter(([name, element]) => !element)
      .map(([name]) => name)

    if (missingElements.length > 0) {
      throw new Error(`Éléments manquants : ${missingElements.join(", ")}`)
    }

    console.log("Feed Focus: Tous les éléments UI ont été créés avec succès")
  } catch (error) {
    console.error("Feed Focus: Erreur lors de la création de l'UI:", error)
    throw error
  }
}

function createFloatingButton() {
  console.log("Feed Focus: Création du bouton flottant")

  return new Promise((resolve, reject) => {
    try {
      // Supprimer l'ancien bouton s'il existe
      const existingButton = document.querySelector(".feed-focus-action-button")
      if (existingButton) existingButton.remove()

      // Créer le bouton
      const button = document.createElement("div")
      button.className = "feed-focus-action-button"
      button.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #8a5cf6, #ec4899);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(138, 92, 246, 0.3);
        cursor: grab;
        z-index: 9999;
        font-size: 24px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        user-select: none;
      `

      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
            <path d="m22 12.18-8.58 3.91a2 2 0 0 1-1.66 0L2.6 12.18"/>
            <path d="m22 16.18-8.58 3.91a2 2 0 0 1-1.66 0L2.6 16.18"/>
          </svg>
      `

      document.body.appendChild(button)

      // Chargement de la position sauvegardée
      const savedPosition = JSON.parse(localStorage.getItem("feedFocusButtonPosition"))
      if (savedPosition) {
        button.style.left = savedPosition.x + "px"
        button.style.top = savedPosition.y + "px"
        button.style.bottom = "auto"
        button.style.right = "auto"
      } else {
        // Position initiale
        button.style.bottom = "24px"
        button.style.right = "24px"
      }

      // Variables pour drag
      let isDragging = false
      let offsetX = 0,
        offsetY = 0

      button.addEventListener("mousedown", (e) => {
        isDragging = true
        offsetX = e.clientX - button.getBoundingClientRect().left
        offsetY = e.clientY - button.getBoundingClientRect().top
        button.style.transition = "none"
        button.style.cursor = "grabbing"
      })

      document.addEventListener("mousemove", (e) => {
        if (isDragging) {
          const x = e.clientX - offsetX
          const y = e.clientY - offsetY

          button.style.left = x + "px"
          const y2 = e.clientY - offsetY

          button.style.left = x + "px"
          button.style.top = y2 + "px"
          button.style.right = "auto"
          button.style.bottom = "auto"
        }
      })

      document.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false
          button.style.transition = ""
          button.style.cursor = "grab"

          const rect = button.getBoundingClientRect()
          localStorage.setItem(
            "feedFocusButtonPosition",
            JSON.stringify({
              x: rect.left,
              y: rect.top,
            }),
          )
        }
      })

      // Mobile - touch support
      button.addEventListener("touchstart", (e) => {
        isDragging = true
        const touch = e.touches[0]
        offsetX = touch.clientX - button.getBoundingClientRect().left
        offsetY = touch.clientY - button.getBoundingClientRect().top
      })

      document.addEventListener("touchmove", (e) => {
        if (isDragging) {
          const touch = e.touches[0]
          const x = touch.clientX - offsetX
          const y = touch.clientY - offsetY

          button.style.left = x + "px"
          button.style.top = y + "px"
          button.style.right = "auto"
          button.style.bottom = "auto"
        }
      })

      document.addEventListener("touchend", () => {
        if (isDragging) {
          isDragging = false
          const rect = button.getBoundingClientRect()
          localStorage.setItem(
            "feedFocusButtonPosition",
            JSON.stringify({
              x: rect.left,
              y: rect.top,
            }),
          )
        }
      })

      button.addEventListener("click", () => {
        if (!isDragging) {
          console.log("Feed Focus: bouton cliqué")
          toggleSidebar?.() // à adapter selon ton app
        }
      })

      resolve(button)
    } catch (error) {
      console.error("Erreur création bouton flottant :", error)
      reject(error)
    }
  })
}

// Create the sidebar
function createSidebar() {
  // Remove existing sidebar if any
  const existingSidebar = document.querySelector(".feed-focus-sidebar")
  if (existingSidebar) {
    existingSidebar.remove()
  }

  const sidebar = document.createElement("div")
  sidebar.className = "feed-focus-sidebar"

  // Create sidebar content
  sidebar.innerHTML = `
    <div class="feed-focus-sidebar-header">
      <div class="feed-focus-logo-container">
        <div class="feed-focus-logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
            <path d="m22 12.18-8.58 3.91a2 2 0 0 1-1.66 0L2.6 12.18"/>
            <path d="m22 16.18-8.58 3.91a2 2 0 0 1-1.66 0L2.6 16.18"/>
          </svg>
        </div>
        <h1>Feed Focus</h1>
      </div>
      <button id="feed-focus-close-sidebar" class="feed-focus-icon-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18"/>
          <path d="m6 6 12 12"/>
        </svg>
      </button>
    </div>
    
    <div class="feed-focus-sidebar-navigation">
      <button class="feed-focus-nav-button active" data-tab="feeds">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="7" height="7" x="3" y="3" rx="1"/>
          <rect width="7" height="7" x="3" y="14" rx="1"/>
          <path d="M14 4h7"/>
          <path d="M14 9h7"/>
          <path d="M14 15h7"/>
          <path d="M14 20h7"/>
        </svg>
        My Feeds
      </button>
      <button class="feed-focus-nav-button" data-tab="people">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        People
      </button>
      <button class="feed-focus-nav-button" data-tab="settings">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        Settings
      </button>
    </div>
    
    <div class="feed-focus-tab-content active" id="feed-focus-feeds-tab">
      <div class="feed-focus-section-header">
        <h2>My feeds <span class="feed-focus-info-icon" title="Create feeds to organize LinkedIn profiles">ⓘ</span></h2>
      </div>
      
      <div class="feed-focus-main-actions">
        <button id="feed-focus-new-feed-button" class="feed-focus-main-action primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" x2="12" y1="5" y2="19"/>
            <line x1="5" x2="19" y1="12" y2="12"/>
          </svg>
          Create New Feed
        </button>
        
        <button id="feed-focus-add-profile-button" class="feed-focus-main-action secondary">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" x2="19" y1="8" y2="14"/>
            <line x1="22" x2="16" y1="11" y2="11"/>
          </svg>
          Add User to Feed
        </button>
      </div>
      
      <div id="feed-focus-feeds-list" class="feed-focus-feeds-list">
        <!-- Feeds will be added here dynamically -->
        <div class="feed-focus-empty-state" id="feed-focus-empty-feeds">
          <p>No feeds yet. Create your first feed!</p>
        </div>
      </div>
      
      <div class="feed-focus-upgrade-panel">
        <h3>With an upgrade, you can unlock:</h3>
        <ul class="feed-focus-upgrade-features">
          <li>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            Unlimited feeds
          </li>
          <li>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            Unlimited profiles
          </li>
          <li>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            Advanced analytics
          </li>
        </ul>
        <button id="feed-focus-upgrade-button" class="feed-focus-button-upgrade">Upgrade Now</button>
      </div>
    </div>
    
    <div class="feed-focus-tab-content" id="feed-focus-people-tab">
      <div class="feed-focus-section-header">
        <h2>People</h2>
        <button id="feed-focus-back-to-feeds" class="feed-focus-back-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back to feeds
        </button>
      </div>
      
      <div class="feed-focus-search-container">
        <input type="text" id="feed-focus-people-search" placeholder="Search people...">
        <button id="feed-focus-people-search-button" class="feed-focus-search-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
        </button>
      </div>
      
      <div id="feed-focus-people-list" class="feed-focus-people-list">
        <!-- People will be added here dynamically -->
        <div class="feed-focus-empty-state" id="feed-focus-empty-people">
          <p>No people found. Add profiles to your feeds first.</p>
        </div>
      </div>
    </div>
    
    <div class="feed-focus-tab-content" id="feed-focus-settings-tab">
      <div class="feed-focus-section-header">
        <h2>Settings</h2>
      </div>
      
      <div class="feed-focus-setting">
        <div class="feed-focus-setting-header">
          <label>Focus Mode</label>
          <div class="feed-focus-toggle-container">
            <label class="feed-focus-toggle">
              <input type="checkbox" id="feed-focus-focus-mode-toggle">
              <span class="feed-focus-slider"></span>
            </label>
          </div>
        </div>
        <p class="feed-focus-setting-description">Hide all UI elements except the feed (doesn't filter content)</p>
      </div>
      
      <div class="feed-focus-setting hidden">
        <label for="feed-focus-keyword-filter">Filter by keywords</label>
        <input type="text" id="feed-focus-keyword-filter" placeholder="Enter keywords separated by commas">
        <p class="feed-focus-setting-description">Filter content containing these keywords</p>
      </div>
      
      <div class="feed-focus-setting hidden">
        <label for="feed-focus-content-type">Content type</label>
        <select id="feed-focus-content-type">
          <option value="all">All content</option>
          <option value="posts">Posts only</option>
          <option value="articles">Articles only</option>
          <option value="jobs">Job listings only</option>
        </select>
        <p class="feed-focus-setting-description">Filter by content type</p>
      </div>
      
      <div class="feed-focus-actions hidden">
        <button id="feed-focus-save-settings" class="feed-focus-button-primary">Save</button>
        <button id="feed-focus-reset-settings" class="feed-focus-button-secondary">Reset</button>
      </div>
    </div>
  `

  document.body.appendChild(sidebar)

  // Create overlay
  const overlay = document.createElement("div")
  overlay.className = "feed-focus-overlay"
  overlay.style.display = "none"
  overlay.style.pointerEvents = "none" // Permet les clics de passer à travers
  document.body.appendChild(overlay)

  // Add click event to close sidebar when clicking on overlay
  overlay.addEventListener("click", () => {
    hideSidebar()
  })

  // Set up navigation
  setupSidebarNavigation()

  // Set up event listeners
  setupSidebarEventListeners()

  // Load initial content
  loadSidebarContent()
}

// Create feed modal
function createFeedModal() {
  // Supprimer la modale existante si elle existe
  const existingModal = document.querySelector("#feed-focus-feed-modal")
  if (existingModal) {
    existingModal.remove()
  }

  const modal = document.createElement("div")
  modal.id = "feed-focus-feed-modal"
  modal.className = "feed-focus-modal"
  modal.style.position = "fixed"
  modal.style.top = "0"
  modal.style.left = "0"
  modal.style.width = "100%"
  modal.style.height = "100%"
  modal.style.display = "none"
  modal.style.alignItems = "center"
  modal.style.justifyContent = "center"
  modal.style.zIndex = "9999"
  modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)"

  modal.innerHTML = `
    <div class="feed-focus-modal-content" style="position: relative; margin: auto; background: white; border-radius: 8px; width: 500px; max-width: 90%;">
      <div class="feed-focus-modal-header">
        <h2 id="feed-focus-modal-title">Create a new feed</h2>
        <button class="feed-focus-close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="feed-focus-modal-body">
        <div class="feed-focus-form-group">
          <label for="feed-focus-feed-name">Feed name</label>
          <input type="text" id="feed-focus-feed-name" placeholder="e.g., Mentors, Potential clients">
        </div>
        <div class="feed-focus-form-group">
          <label for="feed-focus-feed-description">Description (optional)</label>
          <textarea id="feed-focus-feed-description" placeholder="What is this feed for?"></textarea>
        </div>
      </div>
      <div class="feed-focus-modal-footer">
        <button id="feed-focus-cancel-feed" class="feed-focus-button-secondary">Cancel</button>
        <button id="feed-focus-save-feed" class="feed-focus-button-primary">Create</button>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  // Gérer la fermeture en cliquant en dehors de la modale
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeFeedModal()
    }
  })

  // Gérer la fermeture avec la croix
  const closeButton = modal.querySelector(".feed-focus-close-modal")
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      closeFeedModal()
    })
  }

  // Gérer le bouton Cancel
  const cancelButton = document.querySelector("#feed-focus-cancel-feed")
  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      closeFeedModal()
    })
  }

  // Gérer le bouton Save/Create
  const saveButton = document.querySelector("#feed-focus-save-feed")
  if (saveButton) {
    saveButton.addEventListener("click", () => {
      saveFeed()
    })
  }

  return modal
}

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

  try {
    if (!state.isAuthenticated) {
      showLoginModal(() => {
        saveFeedToServer(name, description)
      })
      return
    } else {
      saveFeedToServer(name, description)
    }
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du feed:", error)
    showNotification("Error saving feed: " + error.message, "error")
  }
}

async function saveFeedToServer(name, description) {
  try {
    const apiUrl = state.editingFeedId
      ? `https://feed-focus.vercel.app/api/feeds/${state.editingFeedId}`
      : "https://feed-focus.vercel.app/api/feeds"
    const method = state.editingFeedId ? "PUT" : "POST"

    const response = await fetch(apiUrl, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.authToken}`,
      },
      body: JSON.stringify({ name, description }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const feedData = await response.json()

    if (state.editingFeedId) {
      // Update existing feed
      const feedIndex = state.feeds.findIndex((f) => f.id === state.editingFeedId)
      if (feedIndex !== -1) {
        state.feeds[feedIndex].name = name
        state.feeds[feedIndex].description = description
      }
    } else {
      // Create new feed
      const newFeed = {
        id: feedData.id,
        name: name,
        description: description,
        profiles: [],
      }

      if (!state.feeds) {
        state.feeds = []
      }

      state.feeds.push(newFeed)

      // Set as current feed if it's the first one
      if (state.feeds.length === 1) {
        state.currentFeedId = newFeed.id
      }

      console.log("Nouveau feed créé:", newFeed)
    }

    // Save state
    saveStateFn()

    // Update UI
    renderFeeds()

    // Close modal with success message
    closeFeedModal()
    showNotification(state.editingFeedId ? "Feed updated" : "Feed created", "success")
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du feed:", error)
    showNotification("Error saving feed: " + error.message, "error")
  }
}

function openFeedModal(feedId = null) {
  let modal = document.getElementById("feed-focus-feed-modal")
  if (!modal) {
    modal = createFeedModal()
  }

  const modalContent = modal.querySelector(".feed-focus-modal-content")
  if (modalContent) {
    // Centrer la modale
    modalContent.style.transform = "translate(-50%, -50%)"
    modalContent.style.position = "fixed"
    modalContent.style.top = "50%"
    modalContent.style.left = "50%"
  }

  // Réinitialiser les champs
  const feedNameInput = document.querySelector("#feed-focus-feed-name")
  const feedDescriptionInput = document.querySelector("#feed-focus-feed-description")
  const modalTitle = document.querySelector("#feed-focus-modal-title")
  const saveButton = document.querySelector("#feed-focus-save-feed")

  if (feedId) {
    // Mode édition
    state.editingFeedId = feedId
    const feed = state.feeds.find((f) => f.id === feedId)
    if (feed) {
      if (feedNameInput) feedNameInput.value = feed.name || ""
      if (feedDescriptionInput) feedDescriptionInput.value = feed.description || ""
      if (modalTitle) modalTitle.textContent = "Edit feed"
      if (saveButton) saveButton.textContent = "Save"
    }
  } else {
    // Mode création
    state.editingFeedId = null
    if (feedNameInput) feedNameInput.value = ""
    if (feedDescriptionInput) feedDescriptionInput.value = ""
    if (modalTitle) modalTitle.textContent = "Create a new feed"
    if (saveButton) saveButton.textContent = "Create"
  }

  // Afficher la modale
  modal.style.display = "flex"
}

// Create feed selector dialog
function createFeedSelector() {
  console.log("Création du sélecteur de feed...")

  // Supprimer l'ancien sélecteur s'il existe
  const existingSelector = document.querySelector(".feed-focus-feed-selector")
  if (existingSelector) {
    existingSelector.remove()
  }

  // Créer le nouveau sélecteur avec une structure garantie
  const selector = document.createElement("div")
  selector.className = "feed-focus-feed-selector"
  selector.id = "feed-focus-selector"

  // Créer la structure complète
  selector.innerHTML = `
    <div class="feed-focus-selector-header">
      <h3>Select a Feed</h3>
      <button id="feed-focus-close-selector" class="feed-focus-selector-close">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18"/>
          <path d="m6 6 12 12"/>
        </svg>
      </button>
    </div>
    <div id="feed-focus-profile-container" class="feed-focus-selector-profile"></div>
    <div class="feed-focus-selector-label">Select a feed:</div>
    <div class="feed-focus-feed-list" id="feed-focus-feed-list">
      <div id="feed-focus-empty-feeds" class="feed-focus-selector-empty">No feeds available. Create one in the extension popup.</div>
    </div>
    <div class="feed-focus-selector-footer">
      <button id="feed-selector-cancel" class="feed-focus-selector-button secondary">Cancel</button>
      <button id="feed-selector-add" class="feed-focus-selector-button primary" disabled>Add to Feed</button>
    </div>
  `

  // Ajouter au body
  document.body.appendChild(selector)
  console.log("Sélecteur de feed créé avec succès")

  // Configurer les écouteurs d'événements
  setupFeedSelectorEventListeners(selector)

  return selector
}

function setupFeedSelectorEventListeners(selector) {
  console.log("Configuration des écouteurs d'événements du sélecteur...")

  // Fermeture du sélecteur
  const closeButton = selector.querySelector("#feed-focus-close-selector")
  const cancelButton = selector.querySelector("#feed-selector-cancel")

  if (closeButton) {
    closeButton.addEventListener("click", (e) => {
      e.stopPropagation()
      hideFeedSelectorFn()
    })
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", (e) => {
      e.stopPropagation()
      hideFeedSelectorFn()
    })
  }

  // Bouton d'ajout
  const addButton = selector.querySelector("#feed-selector-add")
  if (addButton) {
    addButton.addEventListener("click", (e) => {
      e.stopPropagation()
      addProfileToSelectedFeed()
    })
  }

  // Empêcher la propagation des clics
  selector.addEventListener("click", (e) => {
    e.stopPropagation()
  })
}

function showFeedSelectorFn(profileData) {
  console.log("Ouverture du sélecteur de feed...")

  // Fonction pour créer ou recréer le sélecteur
  const initializeSelector = () => {
    console.log("Initialisation du sélecteur...")
    let selector = document.querySelector(".feed-focus-feed-selector")

    if (selector) {
      console.log("Suppression de l'ancien sélecteur...")
      selector.remove()
    }

    console.log("Création d'un nouveau sélecteur...")
    selector = document.createElement("div")
    selector.className = "feed-focus-feed-selector"
    selector.id = "feed-focus-selector"

    selector.innerHTML = `
      <div class="feed-focus-selector-header">
        <h3>Select a Feed</h3>
        <button id="feed-focus-close-selector" class="feed-focus-selector-close">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18"/>
          <path d="m6 6 12 12"/>
        </svg>
      </button>
    </div>
    <div id="feed-focus-profile-container" class="feed-focus-selector-profile"></div>
    <div class="feed-focus-selector-label">Select a feed:</div>
    <div class="feed-focus-feed-list" id="feed-focus-feed-list">
      <div id="feed-focus-empty-feeds" class="feed-focus-selector-empty">No feeds available. Create one in the extension popup.</div>
    </div>
    <div class="feed-focus-selector-footer">
      <button id="feed-selector-cancel" class="feed-focus-selector-button secondary">Cancel</button>
      <button id="feed-selector-add" class="feed-focus-selector-button primary" disabled>Add to Feed</button>
    </div>
  `

    document.body.appendChild(selector)
    setupFeedSelectorEventListeners(selector)
    return selector
  }

  // Fonction pour vérifier les éléments nécessaires
  const verifyElements = (selector) => {
    const elements = {
      profileContainer: selector.querySelector("#feed-focus-profile-container"),
      feedList: selector.querySelector("#feed-focus-feed-list"),
      emptyFeeds: selector.querySelector("#feed-focus-empty-feeds"),
      addButton: selector.querySelector("#feed-selector-add"),
    }

    return Object.entries(elements).every(([name, element]) => {
      const exists = !!element
      if (!exists) {
        console.error(`Élément manquant: ${name}`)
      }
      return exists
    })
      ? elements
      : null
  }

  // Initialiser le sélecteur avec retry
  const initWithRetry = (maxAttempts = 3) => {
    return new Promise((resolve, reject) => {
      let attempts = 0

      const tryInit = () => {
        attempts++
        console.log(`Tentative d'initialisation ${attempts}/${maxAttempts}...`)

        const selector = initializeSelector()
        const elements = verifyElements(selector)

        if (elements) {
          console.log("Initialisation réussie")
          resolve({ selector, elements })
        } else if (attempts < maxAttempts) {
          console.log("Échec de l'initialisation, nouvelle tentative...")
          setTimeout(tryInit, 100 * attempts) // Délai croissant entre les tentatives
        } else {
          reject(new Error(`Échec de l'initialisation après ${maxAttempts} tentatives`))
        }
      }

      tryInit()
    })
  }

  // Fonction principale avec gestion des erreurs
  const showSelector = async () => {
    try {
      const { selector, elements } = await initWithRetry()

      // Récupérer les feeds depuis le stockage
      chrome.storage.local.get(["feeds"], (data) => {
        try {
          if (!data.feeds || data.feeds.length === 0) {
            showNotification("Please create a feed first in the extension popup", "error")
            return
          }

          // Mettre à jour le profil
          elements.profileContainer.innerHTML = `
            <img src="${profileData.imageUrl || ""}" alt="${profileData.name}" class="feed-focus-selector-profile-image" onerror="this.src='https://static.licdn.com/sc/h/1c5u578iilxfi4m4dvc4q810q';" />
            <div class="feed-focus-selector-profile-info">
              <div class="feed-focus-selector-profile-name">${profileData.name || "Unknown"}</div>
              <div class="feed-focus-selector-profile-title">${profileData.title || ""}</div>
            </div>
          `

          // Mettre à jour la liste des feeds
          if (data.feeds.length === 0) {
            elements.emptyFeeds.style.display = "block"
            elements.feedList.innerHTML = ""
          } else {
            elements.emptyFeeds.style.display = "none"
            elements.feedList.innerHTML = data.feeds
              .map(
                (feed) => `
                  <div class="feed-focus-feed-item" data-id="${feed.id}">
                    <div class="feed-focus-feed-item-name">${feed.name}</div>
                    <div class="feed-focus-feed-item-count">${feed.profiles?.length || 0} profiles</div>
                  </div>
                `,
              )
              .join("")

            // Ajouter les écouteurs d'événements aux éléments de la liste
            const feedItems = elements.feedList.querySelectorAll(".feed-focus-feed-item")
            feedItems.forEach((item) => {
              item.addEventListener("click", (e) => {
                e.stopPropagation()
                feedItems.forEach((i) => i.classList.remove("active"))
                item.classList.add("active")
                elements.addButton.disabled = false
              })
            })
          }

          // Stocker les données du profil
          window.tempProfileData = profileData

          // Afficher le sélecteur
          showOverlay()
          selector.style.display = "block"
        } catch (error) {
          console.error("Erreur lors de la mise à jour du contenu:", error)
          showNotification("Error updating feed selector content: " + error.message, "error")
          hideFeedSelectorFn()
        }
      })
    } catch (error) {
      console.error("Erreur lors de l'initialisation du sélecteur:", error)
      showNotification("Error initializing feed selector: " + error.message, "error")
      hideFeedSelectorFn()
    }
  }

  // Lancer l'affichage du sélecteur
  showSelector()
}

function hideFeedSelectorFn() {
  console.log("Fermeture du sélecteur de feed...")

  try {
    const selector = document.querySelector(".feed-focus-feed-selector")
    if (selector) {
      // Nettoyer les écouteurs d'événements
      const oldClone = selector.cloneNode(true)
      selector.parentNode.replaceChild(oldClone, selector)

      // Cacher le sélecteur
      oldClone.style.display = "none"
    }

    // Nettoyer les données temporaires
    window.tempProfileData = null

    // Cacher l'overlay
    hideOverlay()
  } catch (error) {
    console.error("Erreur lors de la fermeture du sélecteur:", error)
    // Forcer le nettoyage
    window.tempProfileData = null
    hideOverlay()
  }
}

// Fix the duplicate overlay declaration in createOverlay function
function createOverlay() {
  const existingOverlay = document.querySelector(".feed-focus-overlay")
  if (existingOverlay) {
    existingOverlay.remove()
  }

  const newOverlay = document.createElement("div")
  newOverlay.className = "feed-focus-overlay"
  newOverlay.style.display = "none"
  newOverlay.style.pointerEvents = "none" // Permet les clics de passer à travers
  document.body.appendChild(newOverlay)
  return newOverlay
}

function showOverlay() {
  const overlay = document.querySelector(".feed-focus-overlay") || createOverlay()
  overlay.style.display = "block"
  overlay.style.pointerEvents = "auto" // Active les interactions uniquement quand nécessaire
  setTimeout(() => {
    overlay.style.opacity = "1"
  }, 0)
}

function hideOverlay() {
  const overlay = document.querySelector(".feed-focus-overlay")
  if (overlay) {
    overlay.style.opacity = "0"
    overlay.style.pointerEvents = "none" // Désactive les interactions
    setTimeout(() => {
      overlay.style.display = "none"
    }, 300)
  }
}

function createProfileButton(profileData) {
  const button = document.createElement("button")
  button.id = "feed-focus-add-profile"
  button.className = "feed-focus-profile-button"
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="19" x2="19" y1="8" y2="14"/>
      <line x1="22" x2="16" y1="11" y2="11"/>
    </svg>
    Add to Feed
  `

  button.addEventListener("click", (e) => {
    e.stopPropagation()
    if (!state.feeds || state.feeds.length === 0) {
      showNotification("Please create a feed first", "error")
      return
    }
    showFeedSelectorFn(profileData)
  })

  return button
}

// Toggle sidebar visibility
function toggleSidebar() {
  const sidebar = document.querySelector(".feed-focus-sidebar")
  const overlay = document.querySelector(".feed-focus-overlay")

  if (sidebar.style.right === "0px") {
    hideSidebar()
  } else {
    showSidebar()
  }
}

// Show sidebar
function showSidebar() {
  const sidebar = document.querySelector(".feed-focus-sidebar")
  const overlay = document.querySelector(".feed-focus-overlay")

  sidebar.style.right = "0px"
  overlay.style.display = "block"

  // Trigger reflow before adding opacity for smooth transition
  overlay.offsetHeight // force reflow
  overlay.style.opacity = "1"

  // Disable body scroll when sidebar is open
  document.body.style.overflow = "hidden"
}

// Hide sidebar
function hideSidebar() {
  const sidebar = document.querySelector(".feed-focus-sidebar")
  const overlay = document.querySelector(".feed-focus-overlay")

  sidebar.style.right = "-380px"
  overlay.style.opacity = "0"

  // Wait for transition to complete before hiding
  setTimeout(() => {
    overlay.style.display = "none"
  }, 300)

  // Re-enable body scroll
  document.body.style.overflow = ""
}

// Set up sidebar navigation
function setupSidebarNavigation() {
  const navButtons = document.querySelectorAll(".feed-focus-nav-button")

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Deactivate all tabs
      navButtons.forEach((btn) => btn.classList.remove("active"))
      document.querySelectorAll(".feed-focus-tab-content").forEach((content) => content.classList.remove("active"))

      // Activate clicked tab
      button.classList.add("active")
      const tabId = button.getAttribute("data-tab")
      document.getElementById(`feed-focus-${tabId}-tab`).classList.add("active")

      // Special handling for people tab
      if (tabId === "people") {
        renderPeopleList()
      }
    })
  })

  // Back to feeds button
  document.getElementById("feed-focus-back-to-feeds").addEventListener("click", () => {
    // Switch to feeds tab
    document.querySelectorAll(".feed-focus-nav-button").forEach((btn) => btn.classList.remove("active"))
    document.querySelectorAll(".feed-focus-tab-content").forEach((content) => content.classList.remove("active"))

    document.querySelector('.feed-focus-nav-button[data-tab="feeds"]').classList.add("active")
    document.getElementById("feed-focus-feeds-tab").classList.add("active")
  })
}

// Fix the syntax error in setupSidebarEventListeners function
function setupSidebarEventListeners() {
  // Close sidebar button
  document.getElementById("feed-focus-close-sidebar").addEventListener("click", () => {
    hideSidebar()
  })

  // New Feed button
  document.getElementById("feed-focus-new-feed-button").addEventListener("click", () => {
    openFeedModal()
  })

  // Add Profile button
  document.getElementById("feed-focus-add-profile-button").addEventListener("click", () => {
    if (!state.feeds || state.feeds.length === 0) {
      showNotification("Please create a feed first", "error")
      return
    }
    if (isProfilePage()) {
      addCurrentProfile()
    } else {
      showNotification("Please navigate to a LinkedIn profile first", "error")
    }
  })

  // Focus Mode toggle
  const focusModeToggle = document.getElementById("feed-focus-focus-mode-toggle")
  if (focusModeToggle) {
    focusModeToggle.checked = state.focusMode
    focusModeToggle.addEventListener("change", () => {
      state.focusMode = focusModeToggle.checked
      saveStateFn()
      if (state.focusMode) {
        applyFocusMode()
      } else {
        removeFocusMode()
      }
    })
  }

  // Save Settings button
  const saveSettingsButton = document.getElementById("feed-focus-save-settings")
  if (saveSettingsButton) {
    saveSettingsButton.addEventListener("click", () => {
      saveSettings()
    })
  }

  // Reset Settings button
  const resetSettingsButton = document.getElementById("feed-focus-reset-settings")
  if (resetSettingsButton) {
    resetSettingsButton.addEventListener("click", () => {
      resetSettings()
    })
  }

  // Upgrade button (placeholder)
  const upgradeButton = document.getElementById("feed-focus-upgrade-button")
  if (upgradeButton) {
    upgradeButton.addEventListener("click", () => {
      showNotification("Upgrade feature coming soon!", "success")
    })
  }

  // Login button
  const loginButton = document.getElementById("feed-focus-login-button")
  if (loginButton) {
    loginButton.addEventListener("click", () => {
      showLoginModal()
    })
  }

  // Logout button
  const logoutButton = document.getElementById("feed-focus-logout-button")
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      logout()
    })
  }
}

// --- Correction de la séparation stricte entre filtrage et focus mode ---
// applyToLinkedIn : ne fait que filtrer les posts du feed, ne masque aucune distraction

// Fix the string literal in applyToLinkedIn function
function applyToLinkedIn() {
  console.log("=== Recherche de contenu LinkedIn ===")

  if (!state.currentFeedId) {
    showNotification("Veuillez sélectionner un feed d'abord", "error")
    return
  }

  const currentFeed = state.feeds.find((feed) => feed.id === state.currentFeedId)
  if (!currentFeed || !currentFeed.profiles || currentFeed.profiles.length === 0) {
    showNotification("Le feed sélectionné est vide", "error")
    return
  }

  console.log(`Feed sélectionné: "${currentFeed.name}" (${currentFeed.profiles.length} profils)`)

  // Map pour stocker les IDs uniques
  const uniqueIdsMap = new Map()

  currentFeed.profiles.forEach((profile) => {
    if (profile.uniqueId) {
      // Vérifier l'ID au format urn:li:fsd_profile:ID
      const urnMatch = profile.uniqueId.match(/urn:li:fsd_profile:([A-Za-z0-9_-]+)/)
      if (urnMatch && urnMatch[1]) {
        uniqueIdsMap.set(urnMatch[1], profile.name)
      }
      // Vérifier l'ID au format ACoAA...
      else if (profile.uniqueId.match(/^ACoAA[A-Za-z0-9_-]+$/)) {
        uniqueIdsMap.set(profile.uniqueId, profile.name)
      }
    }
  })

  if (uniqueIdsMap.size === 0) {
    showNotification("Aucun ID unique valide trouvé dans ce feed", "error")
    return
  }

  // Construire l'URL de recherche
  const uniqueIdsArray = Array.from(uniqueIdsMap.keys())
  const encodedMembers = uniqueIdsArray.map((id) => `"${id}"`).join(",")
  const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=&fromMember=[${encodedMembers}]&origin=FACETED_SEARCH&sortBy=%22date_posted%22`

  console.log(`URL de recherche créée avec ${uniqueIdsArray.length} IDs uniques`)

  // Ouvrir la recherche dans un nouvel onglet
  window.open(searchUrl, "_blank")
}

// removeFromLinkedIn : ne fait que réafficher tous les posts, ne montre aucune distraction
function removeFromLinkedIn() {
  console.log("Removing filtering from LinkedIn...")

  // Réafficher tous les posts
  showAllFeedItems()

  // Définir l'état
  state.isAppliedToLinkedIn = false
  chrome.storage.local.set({ isAppliedToLinkedIn: false })

  // Mettre à jour les boutons d'action LinkedIn
  updateLinkedInActionButtons()

  // Afficher une notification
  showNotification("Feed Focus removed from LinkedIn", "success")
}

// applyFilterToLinkedIn : ne fait que filtrer les posts du feed
function applyFilterToLinkedIn() {
  console.log("Applying filter to LinkedIn feed...")
  if (!state.currentFeedId) {
    showNotification("Please select a feed first", "error")
    return
  }
  const currentFeed = state.feeds.find((feed) => feed.id === state.currentFeedId)
  if (!currentFeed || !currentFeed.profiles || currentFeed.profiles.length === 0) {
    showNotification("Selected feed has no profiles", "error")
    return
  }
  filterFeedItemsFn()
  state.isAppliedToLinkedIn = true
  saveStateWithSizeLimit()
}

// removeFilterFromLinkedIn : ne fait que réafficher tous les posts
function removeFilterFromLinkedIn() {
  console.log("Removing filter from LinkedIn feed...")
  document.body.classList.remove("feed-focus-filter-active")
  const feedItems = document.querySelectorAll(LINKEDIN_SELECTORS.feedItems)
  feedItems.forEach((item) => {
    item.classList.remove("feed-focus-relevant")
    item.classList.remove("feed-focus-hidden")
    item.style.display = ""
  })
  state.isAppliedToLinkedIn = false
  saveStateWithSizeLimit()
}

// applyFocusMode : ne masque que les distractions, ne filtre jamais le feed
function applyFocusMode() {
  console.log("Applying Focus Mode...")
  document.body.classList.add("feed-focus-mode-active")
  hideDistractions()
  showNotification("Focus Mode enabled", "success")
}

// removeFocusMode : ne fait que réafficher les distractions
function removeFocusMode() {
  console.log("Removing Focus Mode...")
  document.body.classList.remove("feed-focus-mode-active")
  showDistractions()
  showNotification("Focus Mode disabled", "success")
}

// Load sidebar content
function loadSidebarContent() {
  // Render feeds
  renderFeeds()

  // Update settings fields
  updateSettingsFields()

  // Update LinkedIn action buttons
  updateLinkedInActionButtons()
}

// Update LinkedIn action buttons
function updateLinkedInActionButtons() {
  const applyButton = document.getElementById("feed-focus-apply-linkedin")
  const unapplyButton = document.getElementById("feed-focus-unapply-linkedin")

  if (!applyButton || !unapplyButton) return

  if (state.isAppliedToLinkedIn) {
    applyButton.style.display = "none"
    unapplyButton.style.display = "block"
  } else {
    applyButton.style.display = "block"
    unapplyButton.style.display = "none"
  }
}

// Render feeds as accordions
function renderFeeds() {
  const feedsList = document.getElementById("feed-focus-feeds-list")
  if (!feedsList) return

  // Vider la liste
  feedsList.innerHTML = ""

  // Vérifier si des feeds existent
  if (!state.feeds || state.feeds.length === 0) {
    feedsList.innerHTML = `
      <div class="feed-focus-empty-state">
        <p>No feeds created yet. Click "Create Feed" to get started.</p>
      </div>
    `
    return
  }

  // Ajouter chaque feed
  state.feeds.forEach((feed) => {
    const feedAccordion = document.createElement("div")
    feedAccordion.className = "feed-focus-feed-accordion"
    feedAccordion.dataset.feedId = feed.id
    feedAccordion.draggable = true

    const feedHeader = document.createElement("div")
    feedHeader.className = "feed-focus-feed-header"
    feedHeader.innerHTML = `
      <div class="feed-focus-feed-title">
        <span>${feed.name}</span>
        <span class="feed-focus-feed-count">${feed.profiles ? feed.profiles.length : 0} profiles</span>
      </div>
      <div class="feed-focus-feed-toggle">▼</div>
    `

    const feedContent = document.createElement("div")
    feedContent.className = "feed-focus-feed-content"

    // Créer le slider de profils
    const profilesSlider = document.createElement("div")
    profilesSlider.className = "feed-focus-profiles-slider"

    // Ajouter les profils au slider
    if (feed.profiles && feed.profiles.length > 0) {
      feed.profiles.forEach((profile) => {
        const profileCard = document.createElement("div")
        profileCard.className = "feed-focus-profile-card"
        profileCard.innerHTML = `
          <img class="feed-focus-profile-card-image" src="${profile.imageUrl || "https://static.licdn.com/sc/h/1c5u578iilxfi4m4dvc4q810q"}" alt="${profile.name}">
          <div class="feed-focus-profile-card-name">${profile.name}</div>
          <div class="feed-focus-profile-card-actions">
            <button class="feed-focus-profile-card-action view-profile" title="View profile">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button class="feed-focus-profile-card-action remove" title="Remove from feed">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `

        // Ajouter les écouteurs d'événements
        profileCard.querySelector(".view-profile").addEventListener("click", () => {
          viewProfile(profile.linkedinUrl)
        })

        profileCard.querySelector(".remove").addEventListener("click", () => {
          removeProfile(feed.id, profile.id)
        })

        profilesSlider.appendChild(profileCard)
      })
    }

    const feedActions = document.createElement("div")
    feedActions.className = "feed-focus-feed-actions"

    feedActions.innerHTML = `
      <button class="feed-focus-feed-action apply-feed" title="Apply">
        Apply to LinkedIn
      </button>
      <button class="feed-focus-feed-action edit-feed" title="Edit">Edit</button>
      <button class="feed-focus-feed-action delete-feed" title="Delete">Delete</button>
    `

    // Ajouter les écouteurs d'événements
    feedHeader.addEventListener("click", () => {
      toggleAccordion(feedAccordion)
    })

    feedActions.querySelector(".apply-feed").addEventListener("click", (e) => {
      e.stopPropagation()
      state.currentFeedId = feed.id
      applyToLinkedIn()
    })

    feedActions.querySelector(".edit-feed").addEventListener("click", (e) => {
      e.stopPropagation()
      editFeed(feed.id)
    })

    feedActions.querySelector(".delete-feed").addEventListener("click", (e) => {
      e.stopPropagation()
      deleteFeed(feed.id)
    })

    // Ajouter les éléments à l'accordéon
    feedContent.appendChild(profilesSlider)
    feedContent.appendChild(feedActions)
    feedAccordion.appendChild(feedHeader)
    feedAccordion.appendChild(feedContent)

    // Ajouter l'accordéon à la liste
    feedsList.appendChild(feedAccordion)
  })

  // Configurer le drag & drop après avoir ajouté tous les feeds
  setupDragAndDrop()
}

// Ajouter une nouvelle fonction pour basculer le filtre d'un feed
function toggleFeedFilter(feedId) {
  state.currentFeedId = feedId
  applyFeedToLinkedIn()
}

// Toggle accordion
function toggleAccordion(accordion) {
  const isOpen = accordion.classList.contains("open")

  // Close all accordions
  document.querySelectorAll(".feed-focus-feed-accordion").forEach((acc) => {
    acc.classList.remove("open")
  })

  // Open this accordion if it was closed
  if (!isOpen) {
    accordion.classList.add("open")

    // Set as current feed
    state.currentFeedId = accordion.dataset.feedId
    saveStateFn()
  }
}

// Render people list
function renderPeopleList() {
  const peopleTab = document.getElementById("feed-focus-people-tab")
  if (!peopleTab) return

  // Create search container
  const searchContainer = document.createElement("div")
  searchContainer.className = "feed-focus-search-container"
  searchContainer.innerHTML = `
    <input type="text" placeholder="Search profiles..." class="feed-focus-search-input">
  `

  // Add search event listener
  const searchInput = searchContainer.querySelector(".feed-focus-search-input")
  searchInput.addEventListener("input", (e) => {
    filterPeopleList(e.target.value)
  })

  // Get all profiles from all feeds
  const allProfiles = state.feeds.reduce((acc, feed) => {
    if (feed.profiles) {
      feed.profiles.forEach((profile) => {
        if (!acc.some((p) => p.id === profile.id)) {
          acc.push({ ...profile, feedName: feed.name })
        }
      })
    }
    return acc
  }, [])

  // Create people list
  const peopleList = document.createElement("div")
  peopleList.className = "feed-focus-people-list"

  if (allProfiles.length === 0) {
    peopleList.innerHTML = `
      <div class="feed-focus-empty-state">
        <p>No profiles added yet.</p>
      </div>
    `
  } else {
    allProfiles.forEach((profile) => {
      const profileElement = createProfileElement(profile)
      peopleList.appendChild(profileElement)
    })
  }

  // Clear and update tab content
  peopleTab.innerHTML = ""
  peopleTab.appendChild(searchContainer)
  peopleTab.appendChild(peopleList)
}

function createProfileElement(profile) {
  const element = document.createElement("div")
  element.className = "feed-focus-profile-item"
  element.innerHTML = `
      <div class="feed-focus-profile-info">
      <img src="${profile.imageUrl}" alt="${profile.name}" class="feed-focus-profile-image" />
        <div class="feed-focus-profile-details">
          <div class="feed-focus-profile-name">${profile.name}</div>
        <div class="feed-focus-profile-title">${profile.title}</div>
        <div class="feed-focus-profile-feed">${profile.feedName}</div>
        </div>
      </div>
      <div class="feed-focus-profile-actions">
      <button class="feed-focus-profile-action view-profile" title="View Profile">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      <button class="feed-focus-profile-action remove-profile" title="Remove Profile">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `

  // Add event listeners
  element.querySelector(".view-profile").addEventListener("click", () => {
    viewProfile(profile.linkedinUrl)
  })

  element.querySelector(".remove-profile").addEventListener("click", () => {
    const feed = state.feeds.find((f) => f.profiles?.some((p) => p.id === profile.id))
    if (feed) {
      removeProfile(feed.id, profile.id)
    }
  })

  return element
}

function filterPeopleList(query) {
  const peopleList = document.querySelector(".feed-focus-people-list")
  if (!peopleList) return

  const profiles = peopleList.querySelectorAll(".feed-focus-profile-item")
  const searchQuery = query.toLowerCase()

  profiles.forEach((profile) => {
    const profileName = profile.querySelector(".feed-focus-profile-name").textContent.toLowerCase()
    const profileTitle = profile.querySelector(".feed-focus-profile-title").textContent.toLowerCase()
    const feedName = profile.querySelector(".feed-focus-profile-feed").textContent.toLowerCase()

    if (profileName.includes(searchQuery) || profileTitle.includes(searchQuery) || feedName.includes(searchQuery)) {
      profile.style.display = "flex"
    } else {
      profile.style.display = "none"
    }
  })
}

// Update settings fields
function updateSettingsFields() {
  const keywordFilter = document.getElementById("feed-focus-keyword-filter")
  const contentType = document.getElementById("feed-focus-content-type")
  const focusModeToggle = document.getElementById("feed-focus-focus-mode-toggle")

  if (keywordFilter) keywordFilter.value = state.keywordFilter || ""
  if (contentType) contentType.value = state.contentType || "all"
  if (focusModeToggle) focusModeToggle.checked = state.focusMode
}

// Close feed modal
function closeFeedModal() {
  const modal = document.getElementById("feed-focus-feed-modal")
  if (modal) {
    // Ajouter une classe pour l'animation de fermeture
    modal.classList.add("feed-focus-modal-closing")

    // Attendre la fin de l'animation avant de cacher
    setTimeout(() => {
      modal.style.display = "none"
      modal.classList.remove("feed-focus-modal-closing")

      // Réinitialiser les champs
      const feedNameInput = document.getElementById("feed-focus-feed-name")
      const feedDescriptionInput = document.getElementById("feed-focus-feed-description")
      if (feedNameInput) feedNameInput.value = ""
      if (feedDescriptionInput) feedDescriptionInput.value = ""
    }, 300)
  }
}

// Delete feed
function deleteFeed(feedId) {
  if (!confirm("Are you sure you want to delete this feed?")) {
    return
  }

  if (!state.isAuthenticated) {
    showLoginModal(() => {
      deleteFeedFromServer(feedId)
    })
    return
  } else {
    deleteFeedFromServer(feedId)
  }
}

async function deleteFeedFromServer(feedId) {
  try {
    const apiUrl = `https://feed-focus.vercel.app/api/feeds/${feedId}`

    const response = await fetch(apiUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${state.authToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Remove feed
    state.feeds = state.feeds.filter((f) => f.id !== feedId)

    // Update current feed if needed
    if (state.currentFeedId === feedId) {
      state.currentFeedId = state.feeds.length > 0 ? state.feeds[0].id : null
    }

    // Save state
    saveStateFn()

    // Update UI
    renderFeeds()

    // Show success message
    showNotification("Feed deleted")
  } catch (error) {
    console.error("Erreur lors de la suppression du feed:", error)
    showNotification("Error deleting feed: " + error.message, "error")
  }
}

// Edit feed
function editFeed(feedId) {
  openFeedModal(feedId)
}

// Modifier la fonction applyFeedToLinkedIn pour capturer l'URN complet
function applyFeedToLinkedIn() {
  console.log("=== Application du feed à LinkedIn ===")

  if (!state.currentFeedId) {
    showNotification("Veuillez sélectionner un feed d'abord", "error")
    return
  }

  const currentFeed = state.feeds.find((feed) => feed.id === state.currentFeedId)
  if (!currentFeed || !currentFeed.profiles || currentFeed.profiles.length === 0) {
    showNotification("Le feed sélectionné est vide", "error")
    return
  }

  console.log(`Feed sélectionné: "${currentFeed.name}" (${currentFeed.profiles.length} profils)`)

  // Map pour stocker les IDs uniques avec leur source
  const uniqueIdsMap = new Map()
  const invalidProfiles = []
  const duplicateProfiles = []

  currentFeed.profiles.forEach((profile) => {
    console.log(`\nTraitement du profil: ${profile.name}`)
    let idFound = false

    // Vérifier l'ID au format urn:li:fsd_profile:ID
    if (profile.uniqueId) {
      // Modification du regex pour capturer l'ID complet avec tous les caractères spéciaux
      const urnMatch = profile.uniqueId.match(/urn:li:fsd_profile:([A-Za-z0-9_-]+)/)
      if (urnMatch && urnMatch[1]) {
        const id = urnMatch[1]
        if (uniqueIdsMap.has(id)) {
          console.log(`ID en double trouvé: ${id}`)
          duplicateProfiles.push({
            id: id,
            name: profile.name,
            existingName: uniqueIdsMap.get(id).name,
          })
        } else {
          uniqueIdsMap.set(id, { type: "urn", name: profile.name })
          idFound = true
        }
      }
    }

    // Vérifier l'ID au format ACoAA...
    if (profile.uniqueId && !idFound) {
      // Modification du regex pour capturer l'ID complet avec tous les caractères spéciaux
      const acoaaMatch = profile.uniqueId.match(/^(ACoAA[A-Za-z0-9_-]+)$/)
      if (acoaaMatch) {
        const id = profile.uniqueId
        if (uniqueIdsMap.has(id)) {
          console.log(`ID en double trouvé: ${id}`)
          duplicateProfiles.push({
            id: id,
            name: profile.name,
            existingName: uniqueIdsMap.get(id).name,
          })
        } else {
          uniqueIdsMap.set(id, { type: "acoaa", name: profile.name })
          idFound = true
        }
      }
    }

    if (!idFound) {
      console.log(`Aucun ID valide trouvé pour: ${profile.name}`)
      invalidProfiles.push({
        name: profile.name,
        uniqueId: profile.uniqueId,
        linkedinUrl: profile.linkedinUrl,
      })
    }
  })

  // Afficher les statistiques
  console.log("\n=== Statistiques ===")
  console.log({
    totalProfiles: currentFeed.profiles.length,
    validIds: uniqueIdsMap.size,
    invalidProfiles: invalidProfiles.length,
    duplicateProfiles: duplicateProfiles.length,
  })

  if (invalidProfiles.length > 0) {
    console.warn("\nProfils sans ID valide:", invalidProfiles)
  }

  if (duplicateProfiles.length > 0) {
    console.warn("\nProfils en double:", duplicateProfiles)
  }

  if (uniqueIdsMap.size === 0) {
    showNotification("Aucun ID unique valide trouvé dans ce feed", "error")
    return
  }

  // Construire l'URL de recherche avec les URNs
  const uniqueIdsArray = Array.from(uniqueIdsMap.entries()).map(([id, data]) => {
    // Si c'est un URN complet, l'utiliser tel quel
    if (data.type === "urn") {
      return `"urn:li:fsd_profile:${id}"`
    }
    // Sinon, utiliser l'ID tel quel (format ACoAA...)
    return `"${id}"`
  })

  console.log("\nURNs et IDs qui seront utilisés:", uniqueIdsArray)

  const encodedMembers = uniqueIdsArray.join(",")
  const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=&fromMember=[${encodedMembers}]&origin=FACETED_SEARCH&sortBy=%22date_posted%22`

  console.log(`\nURL de recherche créée avec ${uniqueIdsArray.length} IDs uniques`)

  // Ouvrir la recherche dans un nouvel onglet
  window.open(searchUrl, "_blank")
}

// Add profile to selected feed
function addProfileToSelectedFeed() {
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

  // Vérifier que les données du profil sont complètes et que ce n'est pas notre propre profil
  if (!profileData.name || !profileData.linkedinUrl || profileData.uniqueId === state.currentUserId) {
    showNotification("Impossible d'ajouter ce profil", "error")
    return
  }

  if (!state.isAuthenticated) {
    showLoginModal(() => {
      addProfileToFeedServer(feedId, profileData)
    })
    return
  } else {
    addProfileToFeedServer(feedId, profileData)
  }
}

async function addProfileToFeedServer(feedId, profileData) {
  try {
    const apiUrl = `https://feed-focus.vercel.app/api/feeds/${feedId}/profiles`

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.authToken}`,
      },
      body: JSON.stringify({
        id: profileData.uniqueId || `profile_${Date.now()}`,
        uniqueId: profileData.uniqueId, // Stocker l'ID unique
        name: profileData.name,
        title: profileData.title || "",
        imageUrl: profileData.imageUrl || "",
        linkedinUrl: profileData.linkedinUrl,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const newProfile = await response.json()

    // Add profile to selected feed
    chrome.storage.local.get(["feeds"], (data) => {
      if (!data.feeds) {
        showNotification("No feeds found", "error")
        return
      }

      const feedIndex = data.feeds.findIndex((feed) => feed.id === feedId)
      if (feedIndex === -1) {
        showNotification("Selected feed not found", "error")
        return
      }

      // Initialize profiles array if it doesn't exist
      if (!data.feeds[feedIndex].profiles) {
        data.feeds[feedIndex].profiles = []
      }

      // Check if profile already exists in the feed
      const profileExists = data.feeds[feedIndex].profiles.some(
        (p) => (p.uniqueId && p.uniqueId === profileData.uniqueId) || p.linkedinUrl === profileData.linkedinUrl,
      )

      if (profileExists) {
        showNotification("Profile already exists in this feed", "error")
        return
      }

      // Créer une copie des données du profil pour éviter les références circulaires
      const profileToAdd = {
        id: newProfile.id,
        uniqueId: profileData.uniqueId, // Stocker l'ID unique
        name: profileData.name,
        title: profileData.title || "",
        imageUrl: profileData.imageUrl || "",
        linkedinUrl: profileData.linkedinUrl,
      }

      // Add profile
      data.feeds[feedIndex].profiles.push(profileToAdd)

      // Update state first
      state.feeds = data.feeds

      // Mettre à jour la liste de tous les profils
      collectAllProfiles()

      // Save to storage with error handling
      try {
        chrome.storage.local.set({ feeds: data.feeds }, () => {
          if (chrome.runtime.lastError) {
            console.error("Erreur lors de la sauvegarde:", chrome.runtime.lastError)
            showNotification("Error saving profile to feed: " + chrome.runtime.lastError.message, "error")
            return
          }

          showNotification(`Profile added to "${data.feeds[feedIndex].name}"`, "success")

          // Update LinkedIn feed if applied
          if (state.isAppliedToLinkedIn) {
            applyToLinkedIn()
          }

          // Update UI
          renderFeeds()
          renderPeopleList()

          // Hide selector
          hideFeedSelectorFn()
        })
      } catch (error) {
        console.error("Exception lors de la sauvegarde:", error)
        showNotification("Error saving profile: " + error.message, "error")
      }
    })
  } catch (error) {
    console.error("Erreur lors de l'ajout du profil au feed:", error)
    showNotification("Error adding profile to feed: " + error.message, "error")
  }
}

// Remove profile from feed
function removeProfile(feedId, profileId) {
  if (!confirm("Are you sure you want to remove this profile from the feed?")) {
    return
  }

  if (!state.isAuthenticated) {
    showLoginModal(() => {
      removeProfileFromServer(feedId, profileId)
    })
    return
  } else {
    removeProfileFromServer(feedId, profileId)
  }
}

async function removeProfileFromServer(feedId, profileId) {
  try {
    const apiUrl = `https://feed-focus.vercel.app/api/feeds/${feedId}/profiles/${profileId}`

    const response = await fetch(apiUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${state.authToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log("=== Suppression de profil ===")
    console.log("Données de suppression:", { feedId, profileId })

    // Find feed
    const feedIndex = state.feeds.findIndex((f) => f.id === feedId)

    if (feedIndex === -1) {
      showNotification("Feed not found", "error")
      return
    }

    const feed = state.feeds[feedIndex]
    console.log(`Feed trouvé: "${feed.name}"`)

    // Trouver le profil à supprimer
    const profileToRemove = feed.profiles.find(
      (p) => p.id === profileId || p.uniqueId === profileId || p.linkedinUrl === profileId,
    )

    if (profileToRemove) {
      console.log("Profil à supprimer:", profileToRemove)
    }

    // Remove profile and all its references
    const initialCount = feed.profiles.length
    state.feeds[feedIndex].profiles = feed.profiles.filter((p) => {
      const shouldKeep = p.id !== profileId && p.uniqueId !== profileId && p.linkedinUrl !== profileId
      return shouldKeep
    })

    const removedCount = initialCount - state.feeds[feedIndex].profiles.length
    console.log(`${removedCount} profil(s) supprimé(s)`)

    // Save state
    saveStateFn()

    // Update UI
    renderFeeds()
    renderPeopleList()

    // Show success message
    showNotification("Profile removed from feed")

    // Nettoyer les feeds
    cleanupFeeds()
  } catch (error) {
    console.error("Erreur lors de la suppression du profil:", error)
    showNotification("Error removing profile: " + error.message, "error")
  }
}

// Améliorer la fonction addProfileButton pour qu'elle fonctionne de manière plus fiable
function addProfileButtonFn() {
  if (!isProfilePage() || window.location.pathname === "/feed/") {
    console.log("Not on a profile page or on feed page, skipping button addition")
    return
  }

  const existingSection = document.getElementById("feed-focus-section")
  if (existingSection) existingSection.remove()

  const existingButton = document.getElementById("feed-focus-add-profile")
  if (existingButton && existingButton.parentNode) existingButton.parentNode.removeChild(existingButton)

  try {
    const profileData = getProfileData()
    if (!profileData || !profileData.name) {
      console.log("Profile data not available, retrying in 1s...")
      setTimeout(addProfileButtonFn, 1000)
      return
    }
    createFeedSection(profileData)
  } catch (error) {
    console.error("Error adding profile button:", error)
  }
}

// Modifier la fonction createFeedSection pour corriger la vérification
function createFeedSection(profileData) {
  console.log("=== Début de la création de la section feed ===")
  console.log("Données du profil:", profileData)

  // Vérifier si le profil est dans un feed
  let foundFeed = null
  let foundProfile = null

  // Extraire l'ID du profil actuel et l'URL
  const currentProfileId = profileData.uniqueId
  const currentProfileUrl = profileData.linkedinUrl ? profileData.linkedinUrl.toLowerCase() : null

  // Extraire le vanity name de l'URL (le /in/nom-utilisateur)
  let currentVanityName = null
  if (currentProfileUrl) {
    const urlMatch = currentProfileUrl.match(/\/in\/([^/?]+)/)
    if (urlMatch) currentVanityName = urlMatch[1].toLowerCase()
  }

  // Vérification des feeds
  if (state.feeds && state.feeds.length > 0) {
    console.log("\n=== Vérification des feeds ===")

    for (const feed of state.feeds) {
      if (!feed.profiles || !Array.isArray(feed.profiles)) continue

      console.log(`\nVérification du feed "${feed.name}" (${feed.profiles.length} profils)`)

      // Chercher le profil dans ce feed
      const matchingProfile = feed.profiles.find((feedProfile) => {
        // Vérifier les correspondances d'ID unique (méthode la plus fiable)
        const idsMatch = feedProfile.uniqueId && currentProfileId && feedProfile.uniqueId === currentProfileId

        // Vérifier les correspondances d'URL de manière stricte
        let urlsMatch = false
        if (feedProfile.linkedinUrl && currentProfileUrl) {
          // Normaliser les URLs pour la comparaison
          const feedProfileUrl = feedProfile.linkedinUrl.toLowerCase()

          // Extraire le vanity name du profil dans le feed
          let feedVanityName = null
          const feedUrlMatch = feedProfileUrl.match(/\/in\/([^/?]+)/)
          if (feedUrlMatch) feedVanityName = feedUrlMatch[1].toLowerCase()

          // Comparer les URLs de manière stricte - les deux doivent avoir le même vanity name
          if (feedVanityName && currentVanityName) {
            urlsMatch = feedVanityName === currentVanityName
          } else {
            // Si on ne peut pas extraire les vanity names, comparer les URLs complètes
            // Mais seulement si elles sont dans le même format (avec ou sans paramètres)
            const feedUrlBase = feedProfileUrl.split("?")[0]
            const currentUrlBase = currentProfileUrl.split("?")[0]
            urlsMatch = feedUrlBase === currentUrlBase
          }
        }

        // Vérifier les correspondances de nom (moins fiable, désactivé pour éviter les faux positifs)
        // const namesMatch = feedProfile.name && profileData.name &&
        //   feedProfile.name.toLowerCase() === profileData.name.toLowerCase();
        const namesMatch = false // Désactivé pour éviter les faux positifs

        // Un profil correspond uniquement si l'ID ou l'URL correspond exactement
        const isMatch = idsMatch || urlsMatch

        if (isMatch) {
          console.log("Correspondance trouvée:", {
            urlsMatch,
            idsMatch,
            namesMatch,
            feedProfile,
            currentProfile: profileData,
          })
        }

        return isMatch
      })

      if (matchingProfile) {
        foundFeed = feed
        foundProfile = matchingProfile
        break
      }
    }
  }

  // Créer la section
  const feedSection = document.createElement("div")
  feedSection.id = "feed-focus-section"
  feedSection.className = "artdeco-card mb2"
  feedSection.style.marginTop = "8px"
  feedSection.style.marginBottom = "8px"

  const feedHeader = document.createElement("div")
  feedHeader.className = "display-flex align-items-center p4"
  feedHeader.innerHTML = `
    <div style="display: flex; align-items: center;">
      <div style="background-color: #8a5cf6; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 8px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
          <path d="m22 12.18-8.58 3.91a2 2 0 0 1-1.66 0L2.6 12.18"/>
          <path d="m22 16.18-8.58 3.91a2 2 0 0 1-1.66 0L2.6 16.18"/>
        </svg>
      </div>
      <span style="font-weight: 600; font-size: 16px;">My Feeds</span>
    </div>
  `

  const feedStatus = document.createElement("div")
  feedStatus.className = "feed-focus-status display-flex align-items-center justify-space-between p4 pt0"

  let feedStatusText = ""
  if (foundFeed && foundProfile) {
    feedStatusText = `<span style="color: #10b981;">${profileData.name} is in feed: <b>${foundFeed.name}</b></span>`
  } else {
    feedStatusText = `<span style="color: #ef4444;">${profileData.name} is not in any feed</span>`
  }

  feedStatus.innerHTML = `
    <div style="display: flex; align-items: center; color: #666;">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
        <path d="M18 6 6 18"/>
        <path d="m6 6 12 12"/>
      </svg>
      ${feedStatusText}
    </div>
    <button id="feed-focus-add-profile" class="artdeco-button artdeco-button--2 artdeco-button--primary">
      <span class="artdeco-button__text">${foundFeed ? "Change feed" : "Add to feed"}</span>
    </button>
  `

  feedSection.appendChild(feedHeader)
  feedSection.appendChild(feedStatus)

  // Insérer la section
  const profileCards = document.querySelectorAll("section.artdeco-card")
  let inserted = false

  for (let i = 0; i < profileCards.length - 1; i++) {
    const currentCard = profileCards[i]
    const nextCard = profileCards[i + 1]

    if (currentCard.matches("[data-member-id]") && nextCard.matches('[data-view-name="profile-card"]')) {
      currentCard.parentNode.insertBefore(feedSection, nextCard)
      inserted = true
      break
    }
  }

  if (!inserted) {
    const firstCard = document.querySelector("section.artdeco-card")
    if (firstCard) {
      firstCard.parentNode.insertBefore(feedSection, firstCard.nextSibling)
      inserted = true
    }
  }

  if (!inserted) {
    const main = document.querySelector(".scaffold-layout__main") || document.body
    main.appendChild(feedSection)
  }

  // Ajouter l'écouteur d'événements pour le bouton
  const addButton = document.getElementById("feed-focus-add-profile")
  if (addButton) {
    addButton.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!state.feeds || state.feeds.length === 0) {
        showNotification("Please create a feed first", "error")
        return
      }
      showFeedSelectorFn(profileData)
    })
  }

  console.log("=== Fin de la création de la section feed ===\n")
}

// Améliorer la fonction addProfileButtonFn pour forcer le rafraîchissement
function addProfileButtonFn() {
  if (!isProfilePage() || window.location.pathname === "/feed/") {
    console.log("Not on a profile page or on feed page, skipping button addition")
    return
  }

  // Supprimer toute section existante pour éviter les doublons
  const existingSection = document.getElementById("feed-focus-section")
  if (existingSection) existingSection.remove()

  const existingButton = document.getElementById("feed-focus-add-profile")
  if (existingButton && existingButton.parentNode) existingButton.parentNode.removeChild(existingButton)

  try {
    // Forcer une nouvelle récupération des données du profil
    const profileData = getProfileData()
    if (!profileData || !profileData.name) {
      console.log("Profile data not available, retrying in 1s...")
      setTimeout(addProfileButtonFn, 1000)
      return
    }

    // Vider le cache des profils pour forcer une nouvelle vérification
    window.feedFocusProfileCache = null

    // Créer la section avec les données fraîches
    createFeedSection(profileData)
  } catch (error) {
    console.error("Error adding profile button:", error)
  }
}

// Ajouter une fonction pour forcer le rafraîchissement de la section de profil
function forceRefreshProfileSection() {
  if (isProfilePage()) {
    // Supprimer la section existante
    const existingSection = document.getElementById("feed-focus-section")
    if (existingSection) existingSection.remove()

    // Vider tout cache potentiel
    window.feedFocusProfileCache = null

    // Forcer une nouvelle récupération des données
    setTimeout(() => {
      addProfileButtonFn()
    }, 100)
  }
}

// Ajouter un écouteur de message pour le rafraîchissement forcé
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "refreshProfileButton") {
    if (isProfilePage()) {
      forceRefreshProfileSection()
      sendResponse({ success: true })
    } else {
      sendResponse({ success: false, reason: "Not on profile page" })
    }
    return true
  }
  // Autres gestionnaires de messages existants...
})

// Helper function to check if we are on LinkedIn
function isLinkedIn() {
  return window.location.hostname.includes("linkedin.com")
}

// Helper function to check if we are on a profile page
function isProfilePage() {
  return window.location.href.includes("/in/") || window.location.href.includes("/pub/")
}

// Show notification
function showNotification(message, type = "success") {
  // Create notification element
  const notification = document.createElement("div")
  notification.className = `feed-focus-notification ${type}`
  notification.textContent = message

  // Add to body
  document.body.appendChild(notification)

  // Show notification
  setTimeout(() => {
    notification.classList.add("show")
  }, 10)

  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove("show")
    setTimeout(() => {
      notification.remove()
    }, 300)
  }, 3000)
}

// Save state to storage
function saveStateFn() {
  chrome.storage.local.set(state, () => {
    console.log("State saved:", state)

    // Send message to background script to update state
    chrome.runtime.sendMessage({ action: "updateState", state: state }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error updating state in background script:", chrome.runtime.lastError)
      }
    })
  })
}

// Initialisation de l'extension
// Cette fonction est cruciale pour que l'extension fonctionne
document.addEventListener("DOMContentLoaded", () => {
  console.log("Feed Focus: DOM complètement chargé")

  // Vérifier si nous sommes sur LinkedIn
  if (isLinkedIn()) {
    // Initialiser l'extension
    setTimeout(() => {
      init()
    }, 500)
  }
})

// Fonction d'initialisation
async function init() {
  console.log("Feed Focus: Début de l'initialisation")

  try {
    // Injecter les styles
    await injectStyles()

    // Charger les paramètres sauvegardés
    chrome.storage.local.get(
      {
        feeds: [],
        currentFeedId: null,
        focusMode: false,
        currentUserId: null,
        authToken: null,
        isAuthenticated: false,
      },
      async (items) => {
        // Mettre à jour l'état
        Object.assign(state, items)
        console.log("Feed Focus: État chargé", state)

        // Vérifier l'authentification
        await checkAuthentication()

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

// Fonction pour ajouter un profil au feed actuel
function addCurrentProfile() {
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

// Get profile data from profile page
function getProfileData() {
  let name = null
  let title = null
  let imageUrl = null
  const linkedinUrl = window.location.href
  let uniqueId = null

  // Extraire l'ID unique
  uniqueId = extractUniqueProfileId()

  // Si l'ID extrait est celui de l'utilisateur courant, on ne le prend pas
  if (uniqueId === state.currentUserId) {
    console.log("ID détecté est celui de l'utilisateur courant, ignoré")
    uniqueId = null
  }

  // Essayer d'extraire le nom avec différentes méthodes
  LINKEDIN_SELECTORS.profile.name.forEach((selector) => {
    if (!name) {
      try {
        const element = document.querySelector(selector)
        if (element) {
          name = element.textContent.trim()
        }
      } catch (error) {
        console.log(`Error finding name with selector ${selector}:`, error)
      }
    }
  })

  // Si on n'a toujours pas de nom, essayer avec une méthode plus générique
  if (!name) {
    try {
      // Essayer de trouver un h1 dans la page
      const h1Elements = document.querySelectorAll("h1")
      if (h1Elements.length > 0) {
        name = h1Elements[0].textContent.trim()
      }
    } catch (error) {
      console.log("Error finding name with generic method:", error)
    }
  }

  // Essayer d'extraire le titre avec différentes méthodes
  LINKEDIN_SELECTORS.profile.title.forEach((selector) => {
    if (!title) {
      try {
        const element = document.querySelector(selector)
        if (element) {
          title = element.textContent.trim()
        }
      } catch (error) {
        console.log(`Error finding title with selector ${selector}:`, error)
      }
    }
  })

  // Essayer d'extraire l'image avec différentes méthodes
  LINKEDIN_SELECTORS.profile.image.forEach((selector) => {
    if (!imageUrl) {
      try {
        const element = document.querySelector(selector)
        if (element && element.src) {
          imageUrl = element.src
        }
      } catch (error) {
        console.log(`Error finding image with selector ${selector}:`, error)
      }
    }
  })

  // Si on n'a toujours pas d'image, essayer avec une méthode plus générique
  if (!imageUrl) {
    try {
      // Essayer de trouver une image de profil
      const imgElements = document.querySelectorAll('img[alt*="profile"], img[alt*="photo"], img.profile-picture')
      if (imgElements.length > 0) {
        imageUrl = imgElements[0].src
      }
    } catch (error) {
      console.log("Error finding image with generic method:", error)
    }
  }

  // Utiliser des valeurs par défaut si nécessaire
  if (!name) name = "LinkedIn User"
  if (!title) title = "LinkedIn Profile"
  if (!imageUrl) imageUrl = "https://static.licdn.com/sc/h/1c5u578iilxfi4m4dvc4q810q"

  // Extract profile ID from URL
  const profileId = uniqueId || linkedinUrl.match(/\/in\/([^/]+)/)?.[1] || Date.now().toString()

  return {
    id: uniqueId ? uniqueId : `profile_${profileId}`,
    uniqueId: uniqueId, // Ajouter l'ID unique s'il existe
    name: name,
    title: title,
    imageUrl: imageUrl,
    linkedinUrl: linkedinUrl,
  }
}

// Fonction pour filtrer les éléments du feed
function filterFeedItemsFn() {
  console.log("Filtering feed items...")

  // Get feed items - utiliser une méthode plus efficace
  const feedItems = document.querySelectorAll(LINKEDIN_SELECTORS.feedItems)
  console.log(`Nombre d'éléments trouvés dans le fil: ${feedItems.length}`)

  // Get profiles from current feed
  const currentFeed = state.feeds.find((feed) => feed.id === state.currentFeedId)
  const profiles = currentFeed ? currentFeed.profiles : []

  if (!profiles || profiles.length === 0) {
    console.log("Aucun profil dans le feed actuel, désactivation du filtrage")
    showAllFeedItems()
    return
  }

  console.log(`Filtrage basé sur ${profiles.length} profils`)

  // Créer un ensemble d'URLs et d'IDs de profils pour une recherche plus rapide
  const profileUrls = new Set()
  const profileIds = new Set()
  const profileNames = new Set()

  profiles.forEach((profile) => {
    if (profile.linkedinUrl) {
      const baseUrl = profile.linkedinUrl.replace(/\/$/, "").toLowerCase()
      profileUrls.add(baseUrl)

      // Ajouter des variantes d'URL
      const urlWithoutParams = baseUrl.split("?")[0]
      profileUrls.add(urlWithoutParams)

      // Extraire et stocker l'ID du profil
      const profileIdMatch = baseUrl.match(/\/in\/([^/]+)/)
      if (profileIdMatch && profileIdMatch[1]) {
        const profileId = profileIdMatch[1]
        profileIds.add(profileId)

        // Ajouter toutes les variantes d'URL possibles
        profileUrls.add(`linkedin.com/in/${profileId}`)
        profileUrls.add(`www.linkedin.com/in/${profileId}`)
        profileUrls.add(`https://linkedin.com/in/${profileId}`)
        profileUrls.add(`https://www.linkedin.com/in/${profileId}`)
      }
    }

    // Stocker le nom du profil en minuscules pour la comparaison
    if (profile.name) {
      profileNames.add(profile.name.toLowerCase())
    }
  })

  // Reset stats
  stats.totalItems = feedItems.length
  stats.relevantItems = 0

  // Filter feed items
  feedItems.forEach((item) => {
    // Remove any existing classes
    item.classList.remove("feed-focus-relevant")
    item.classList.remove("feed-focus-hidden")

    // Get author info
    const author = getAuthorInfo(item)
    if (!author || !author.name) {
      item.classList.add("feed-focus-hidden")
      return
    }

    let isRelevant = false

    // Vérifier par URL
    if (author.link) {
      const authorUrl = author.link.replace(/\/$/, "").toLowerCase()

      // Vérifier si l'URL correspond à un profil du feed
      for (const profileUrl of profileUrls) {
        if (authorUrl.includes(profileUrl) || profileUrl.includes(authorUrl)) {
          isRelevant = true
          break
        }
      }

      // Vérifier par ID de profil
      if (!isRelevant) {
        const authorIdMatch = authorUrl.match(/\/in\/([^/]+)/)
        if (authorIdMatch && authorIdMatch[1]) {
          const authorId = authorIdMatch[1]
          if (profileIds.has(authorId)) {
            isRelevant = true
          }
        }
      }
    }

    // Vérifier par nom si pas encore trouvé
    if (!isRelevant && author.name) {
      const authorName = author.name.toLowerCase()
      isRelevant = profileNames.has(authorName)
    }

    // Appliquer le filtrage
    if (isRelevant) {
      item.classList.add("feed-focus-relevant")
      item.style.display = "" // S'assurer que le post est visible
      stats.relevantItems++
    } else {
      item.classList.add("feed-focus-hidden")
      item.style.display = "none" // Cacher explicitement le post
    }
  })

  console.log(`Filtrage terminé: ${stats.relevantItems} posts pertinents sur ${stats.totalItems} au total`)
}

// Fonction pour afficher tous les éléments du feed
function showAllFeedItems() {
  const feedItems = document.querySelectorAll(LINKEDIN_SELECTORS.feedItems)
  feedItems.forEach((item) => {
    item.classList.remove("feed-focus-relevant")
    item.classList.remove("feed-focus-hidden")
    item.style.display = "" // S'assurer que tous les posts sont visibles
  })
}

// Fonction pour masquer les distractions
function hideDistractions() {
  const distractions = document.querySelectorAll(LINKEDIN_SELECTORS.distractions)
  distractions.forEach((distraction) => {
    // Sauvegarder l'état d'affichage original si ce n'est pas déjà fait
    if (!distraction.dataset.originalDisplay) {
      distraction.dataset.originalDisplay = distraction.style.display || "block"
    }
    distraction.style.display = "none"
  })
}

// Fonction pour afficher les distractions
function showDistractions() {
  const distractions = document.querySelectorAll(LINKEDIN_SELECTORS.distractions)
  distractions.forEach((distraction) => {
    // Restaurer l'état d'affichage original
    if (distraction.dataset.originalDisplay) {
      distraction.style.display = distraction.dataset.originalDisplay
      delete distraction.dataset.originalDisplay
      if (!distraction.dataset.originalDisplay) distraction.removeAttribute("style")
    } else {
      distraction.style.display = ""
      distraction.removeAttribute("style")
    }
  })
}

// Fonction pour sauvegarder les paramètres
function saveSettings() {
  const focusMode = document.getElementById("feed-focus-focus-mode-toggle").checked

  // Update state
  state.focusMode = focusMode

  // Save state
  saveStateFn()

  // Apply focus mode if enabled
  if (state.focusMode) {
    applyFocusMode()
  } else {
    removeFocusMode()
  }

  // Show success message
  showNotification("Settings saved", "success")
}

// Fonction pour réinitialiser les paramètres
function resetSettings() {
  // Reset state to default values
  state.focusMode = false

  // Save state
  saveStateFn()

  // Update settings fields
  updateSettingsFields()

  // Show success message
  showNotification("Settings reset to default")
}

// Fonction pour voir un profil
function viewProfile(url) {
  // Vérifier si l'URL est valide
  if (!url) {
    showNotification("URL du profil non disponible", "error")
    return
  }

  // Nettoyer l'URL si nécessaire
  let profileUrl = url
  if (!profileUrl.startsWith("http")) {
    profileUrl = `https://www.linkedin.com/in/${profileUrl}`
  }

  // Ouvrir directement dans un nouvel onglet
  window.open(profileUrl, "_blank")

  // Afficher une notification de succès
  showNotification("Profil ouvert dans un nouvel onglet", "success")

  // Également envoyer un message au background script pour compatibilité
  try {
    chrome.runtime.sendMessage({ action: "openProfile", url: profileUrl }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("Message envoyé au background script, mais pas de réponse nécessaire")
      }
    })
  } catch (error) {
    console.error("Erreur lors de l'envoi du message au background script:", error)
    // L'onglet est déjà ouvert, donc pas besoin de gérer cette erreur
  }
}

// Fonction pour configurer le drag and drop
function setupDragAndDrop() {
  const feedsList = document.getElementById("feed-focus-feeds-list")
  if (!feedsList) return

  let draggedItem = null

  feedsList.addEventListener("dragstart", (e) => {
    draggedItem = e.target
    e.dataTransfer.setData("text/plain", draggedItem.dataset.feedId)
    e.target.classList.add("dragging")
  })

  feedsList.addEventListener("dragend", (e) => {
    e.target.classList.remove("dragging")
    draggedItem = null
  })

  feedsList.addEventListener("dragover", (e) => {
    e.preventDefault()
  })

  feedsList.addEventListener("drop", (e) => {
    e.preventDefault()
    const dropTarget = e.target.closest(".feed-focus-feed-accordion")

    if (draggedItem && dropTarget && draggedItem !== dropTarget) {
      const draggedIndex = Array.from(feedsList.children).indexOf(draggedItem)
      const dropIndex = Array.from(feedsList.children).indexOf(dropTarget)

      // Swap the feeds in the state
      const [removed] = state.feeds.splice(draggedIndex, 1)
      state.feeds.splice(dropIndex, 0, removed)

      // Save the state
      saveStateFn()

      // Re-render the feeds
      renderFeeds()
    }
  })
}

// Fonction pour collecter tous les profils
function collectAllProfiles() {
  state.allProfiles = []
  state.feeds.forEach((feed) => {
    if (feed.profiles) {
      feed.profiles.forEach((profile) => {
        state.allProfiles.push(profile)
      })
    }
  })
}

// Fonction pour nettoyer les feeds
function cleanupFeeds() {
  console.log("=== Nettoyage des feeds ===")

  if (!state.feeds || !Array.isArray(state.feeds)) {
    console.log("Aucun feed à nettoyer")
    return
  }

  state.feeds.forEach((feed, feedIndex) => {
    if (!feed.profiles || !Array.isArray(feed.profiles)) {
      console.log(`Le feed "${feed.name}" n'a pas de profils à nettoyer`)
      return
    }

    const initialCount = feed.profiles.length
    const uniqueProfiles = []
    const seen = new Set()

    feed.profiles = feed.profiles.filter((profile) => {
      const identifier = profile.uniqueId || profile.linkedinUrl
      if (!identifier) return true // Garder les profils sans identifiant

      if (seen.has(identifier)) {
        return false // Supprimer les doublons
      }

      seen.add(identifier)
      return true // Garder les profils uniques
    })

    const removedCount = initialCount - feed.profiles.length
    if (removedCount > 0) {
      console.log(`Suppression de ${removedCount} profils en double du feed "${feed.name}"`)
    }
  })

  saveStateFn()
}

// Fonction pour sauvegarder l'état avec limite de taille
function saveStateWithSizeLimit() {
  const stateString = JSON.stringify(state)
  const stateSize = stateString.length

  const maxSize = 5242880 // 5MB

  if (stateSize > maxSize) {
    console.warn("State size exceeds the maximum limit. Removing some data...")

    // Remove feeds one by one until the state size is within the limit
    while (state.feeds.length > 0 && JSON.stringify(state).length > maxSize) {
      state.feeds.pop()
    }

    // If even after removing all feeds, the state is still too large, reset the state
    if (JSON.stringify(state).length > maxSize) {
      console.warn("Even after removing all feeds, the state is still too large. Resetting state...")
      const state = {
        feeds: [],
        currentFeedId: null,
        focusMode: false,
        editingFeedId: null,
        currentPage: 1,
        resultsPerPage: 5,
        allProfiles: [],
        currentUserId: null,
        authToken: null,
        isAuthenticated: false,
      }
    }
  }

  saveStateFn()
}

// Fonction pour obtenir les informations de l'auteur d'un élément du feed
function getAuthorInfo(item) {
  try {
    // Essayer d'abord de trouver le lien de l'auteur
    const authorLink = item.querySelector(LINKEDIN_SELECTORS.author.link)
    if (authorLink) {
      const name = authorLink.textContent.trim()
      const link = authorLink.href
      return { name, link }
    }

    // Si pas de lien, chercher le nom de l'auteur
    const authorName = item.querySelector(LINKEDIN_SELECTORS.author.name)
    if (authorName) {
      const name = authorName.textContent.trim()
      // Chercher un lien parent qui pourrait contenir l'URL du profil
      const parentLink = authorName.closest("a")
      const link = parentLink ? parentLink.href : null
      return { name, link }
    }

    // Si toujours rien, chercher dans le conteneur de l'auteur
    const authorContainer = item.querySelector(LINKEDIN_SELECTORS.author.container)
    if (authorContainer) {
      const name = authorContainer.textContent.trim()
      const link = authorContainer.querySelector("a")?.href
      return { name, link }
    }

    return null
  } catch (error) {
    console.error("Error getting author info:", error)
    return null
  }
}

// Authentication functions
async function checkAuthentication() {
  console.log("Feed Focus: Checking authentication status")
  try {
    const token = await getAuthToken()
    if (token) {
      state.authToken = token
      state.isAuthenticated = true
      console.log("Feed Focus: User is authenticated")
    } else {
      state.isAuthenticated = false
      console.log("Feed Focus: User is not authenticated")
    }
  } catch (error) {
    console.error("Feed Focus: Error checking authentication:", error)
    state.isAuthenticated = false
  } finally {
    updateSidebarButtons()
  }
}

async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["authToken"], (result) => {
      if (chrome.runtime.lastError) {
        console.error("Feed Focus: Error getting auth token:", chrome.runtime.lastError)
        reject(chrome.runtime.lastError)
      } else {
        resolve(result.authToken)
      }
    })
  })
}

function setAuthToken(token) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ authToken: token }, () => {
      if (chrome.runtime.lastError) {
        console.error("Feed Focus: Error setting auth token:", chrome.runtime.lastError)
        reject(chrome.runtime.lastError)
      } else {
        resolve()
      }
    })
  })
}

async function clearAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(["authToken"], () => {
      if (chrome.runtime.lastError) {
        console.error("Feed Focus: Error clearing auth token:", chrome.runtime.lastError)
        reject(chrome.runtime.lastError)
      } else {
        resolve()
      }
    })
  })
}

function showLoginModal(callback = null) {
  // Check if modal already exists
  let loginModal = document.getElementById("feed-focus-login-modal")
  if (loginModal) {
    loginModal.remove()
  }

  // Create login modal
  loginModal = document.createElement("div")
  loginModal.id = "feed-focus-login-modal"
  loginModal.className = "feed-focus-modal"
  loginModal.style.position = "fixed"
  loginModal.style.top = "0"
  loginModal.style.left = "0"
  loginModal.style.width = "100%"
  loginModal.style.height = "100%"
  loginModal.style.display = "none"
  loginModal.style.alignItems = "center"
  loginModal.style.justifyContent = "center"
  loginModal.style.zIndex = "10000"
  loginModal.style.backgroundColor = "rgba(0, 0, 0, 0.5)"

  loginModal.innerHTML = `
    <div class="feed-focus-modal-content" style="position: relative; margin: auto; background: white; border-radius: 8px; width: 500px; max-width: 90%;">
      <div class="feed-focus-modal-header">
        <h2 id="feed-focus-modal-title">Login to Feed Focus</h2>
        <button class="feed-focus-close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="feed-focus-modal-body">
        <p>To use this feature, you need to log in to Feed Focus.</p>
        <button id="feed-focus-login-button-modal" class="feed-focus-button-primary">Log In</button>
      </div>
      <div class="feed-focus-modal-footer">
        <button id="feed-focus-cancel-login" class="feed-focus-button-secondary">Cancel</button>
      </div>
    </div>
  `

  document.body.appendChild(loginModal)

  // Event listeners
  const closeModalButton = loginModal.querySelector(".feed-focus-close-modal")
  closeModalButton.addEventListener("click", () => {
    closeLoginModal()
  })

  const cancelLoginButton = loginModal.querySelector("#feed-focus-cancel-login")
  cancelLoginButton.addEventListener("click", () => {
    closeLoginModal()
  })

  const loginButtonModal = loginModal.querySelector("#feed-focus-login-button-modal")
  loginButtonModal.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "openLoginPage" }, (response) => {
      if (response && response.success) {
        console.log("Feed Focus: Login page opened")
        // Optionally, set a listener for when the token is updated
        chrome.runtime.onMessage.addListener(function loginListener(message, sender, sendResponse) {
          if (message.action === "authTokenUpdated") {
            console.log("Feed Focus: Auth token updated, re-checking authentication")
            checkAuthentication().then(() => {
              closeLoginModal()
              if (callback) callback()
              // Remove the listener after it's used
              chrome.runtime.onMessage.removeListener(loginListener)
            })
          }
        })
      } else {
        showNotification("Could not open login page", "error")
      }
    })
  })

  // Show modal
  loginModal.style.display = "flex"
}

function closeLoginModal() {
  const loginModal = document.getElementById("feed-focus-login-modal")
  if (loginModal) {
    loginModal.style.display = "none"
  }
}

async function logout() {
  try {
    await clearAuthToken()
    state.authToken = null
    state.isAuthenticated = false
    saveStateFn()
    updateSidebarButtons()
    showNotification("Logged out successfully", "success")
  } catch (error) {
    console.error("Feed Focus: Error logging out:", error)
    showNotification("Error logging out", "error")
  }
}

function updateSidebarButtons() {
  const feedsTab = document.getElementById("feed-focus-feeds-tab")
  if (!feedsTab) return

  // Remove existing buttons
  const existingLoginButton = document.getElementById("feed-focus-login-button")
  if (existingLoginButton) existingLoginButton.remove()

  const existingLogoutButton = document.getElementById("feed-focus-logout-button")
  if (existingLogoutButton) existingLogoutButton.remove()

  let buttonContainer = document.querySelector(".feed-focus-main-actions")
  if (!buttonContainer) {
    buttonContainer = document.createElement("div")
    buttonContainer.className = "feed-focus-main-actions"
    feedsTab.insertBefore(buttonContainer, document.getElementById("feed-focus-feeds-list"))
  }

  let button

  if (!state.isAuthenticated) {
    button = document.createElement("button")
    button.id = "feed-focus-login-button"
    button.className = "feed-focus-main-action primary"
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
      </svg>
      Log In
    `
    button.addEventListener("click", () => {
      showLoginModal()
    })
  } else {
    button = document.createElement("button")
    button.id = "feed-focus-logout-button"
    button.className = "feed-focus-main-action secondary"
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H3v-6M15 3h6v6M21 3l-7 7M3 21l7-7"/>
      </svg>
      Log Out
    `
    button.addEventListener("click", () => {
      logout()
    })
  }

  buttonContainer.appendChild(button)
}

// Appeler init() au chargement de la page
if (document.readyState === "complete" || document.readyState === "interactive") {
  console.log("Feed Focus: Document déjà chargé")
  setTimeout(() => {
    if (isLinkedIn()) {
      init()
    }
  }, 500)
}
