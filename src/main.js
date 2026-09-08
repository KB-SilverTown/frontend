import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { getRestoredSessionRoute } from './router/initialRoute.js'
import router from './router/index.js'
import { useOnboardingStore } from './stores/onboarding.js'
import './styles/globals.css'
import './styles/app-loading.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)

  const session = await useOnboardingStore(pinia).restoreAuthSession()
  await router.isReady()

  const restoredSessionRoute = getRestoredSessionRoute(session, router.currentRoute.value)
  if (restoredSessionRoute) {
    await router.replace(restoredSessionRoute)
  }

  app.mount('#app')
}

bootstrap()
