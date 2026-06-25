import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/pages/LandingPage.vue'),
      meta: { public: true },
    },
    {
      path: '/login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/register',
      component: () => import('@/pages/RegisterPage.vue'),
      meta: { public: true },
    },
    {
      path: '/onboarding',
      component: () => import('@/pages/OnboardingPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/map',
      component: () => import('@/pages/DashboardPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/contacts',
      component: () => import('@/pages/ContactsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      component: () => import('@/pages/ProfilePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/sos',
      component: () => import('@/pages/SOSPage.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/track/:token',
      name: 'TrackingPublic',
      component: () => import('@/pages/TrackingPublicPage.vue'),
      meta: { requiresAuth: false, layout: 'none' },
    },
    {
      path: '/verify-email',
      component: () => import('@/pages/VerifyEmailPage.vue'),
      meta: { public: true },
    },
    {
      path: '/admin',
      component: () => import('@/pages/admin/AdminDashboardPage.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/privacy',
      component: () => import('@/pages/PrivacyPage.vue'),
      meta: { public: true },
    },
    {
      path: '/terms',
      component: () => import('@/pages/TermsPage.vue'),
      meta: { public: true },
    },
    {
      path: '/support',
      component: () => import('@/pages/SupportPage.vue'),
      meta: { public: true },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()

  // Aspetta l'inizializzazione solo al primo avvio
  if (!auth.isInitialized) {
    await auth.init()
  }

  const requiresAuth = to.meta.requiresAuth as boolean | undefined
  const requiresAdmin = to.meta.requiresAdmin as boolean | undefined

  // Route che richiede auth
  if (requiresAuth && !auth.isAuthenticated) {
    return next('/login')
  }

  // Route admin
  if (requiresAdmin && !auth.isAdmin) {
    return next('/map')
  }

  // Redirect da login/register se già autenticato
  if (to.path === '/login' || to.path === '/register') {
    if (auth.isAuthenticated) {
      return next(auth.hasCompletedOnboarding ? '/map' : '/onboarding')
    }
  }

  // Onboarding: se completato, vai alla mappa
  if (to.path === '/onboarding' && auth.isAuthenticated && auth.hasCompletedOnboarding) {
    return next('/map')
  }

  // Route protetta ma onboarding non completato → vai a /onboarding
  if (requiresAuth && auth.isAuthenticated && !auth.hasCompletedOnboarding && to.path !== '/onboarding') {
    return next('/onboarding')
  }

  next()
})

export default router
