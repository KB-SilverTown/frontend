<script setup>
import { useRouter } from 'vue-router'

import { Button } from '@/shared/components/ui/button'

defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  backRoute: { type: Object, required: true },
  primaryLabel: { type: String, default: '' },
  secondaryLabel: { type: String, default: '' },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['back', 'primary', 'secondary'])
const router = useRouter()

function openVoice() {
  window.dispatchEvent(new CustomEvent('gwipyeonhan:voice-assist'))
  router.push({ name: 'voice-screen', params: { screenKey: 'voice-enabled' } })
}
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell service-route-device">
      <header class="app-header">
        <RouterLink
          aria-label="이전 화면"
          class="app-header-button service-route-back"
          :to="backRoute"
          @click.prevent="emit('back')"
        >
          ‹
        </RouterLink>
        <strong class="app-brand">귀편한 금융</strong>
        <Button
          aria-label="음성 도움"
          class="app-header-button service-mic-button"
          size="icon"
          variant="secondary"
          @click="openVoice"
        >
          <span
            aria-hidden="true"
            class="service-mic-icon"
          >
            <span class="service-mic-stem" />
          </span>
        </Button>
      </header>

      <main class="app-main service-route-main">
        <section class="screen-heading service-route-heading">
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
        </section>

        <slot />

        <footer
          v-if="primaryLabel || secondaryLabel"
          class="app-actions service-route-actions"
        >
          <Button
            v-if="secondaryLabel"
            :disabled="busy"
            variant="secondary"
            @click="emit('secondary')"
          >
            {{ secondaryLabel }}
          </Button>
          <Button
            v-if="primaryLabel"
            :disabled="busy"
            @click="emit('primary')"
          >
            {{ primaryLabel }}
          </Button>
        </footer>
      </main>
    </article>
  </div>
</template>
