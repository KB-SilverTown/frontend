<script setup>
import { Button } from '@/shared/components/ui/button'

defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  primaryLabel: { type: String, default: '' },
  secondaryLabel: { type: String, default: '' },
  busy: Boolean,
})
defineEmits(['back', 'primary', 'secondary'])
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell service-route-device">
      <header class="app-header">
        <Button
          aria-label="뒤로"
          class="app-header-button service-route-back"
          size="icon"
          variant="secondary"
          @click="$emit('back')"
          >‹</Button
        ><strong class="app-brand">귀편한 금융</strong><span class="app-header-spacer" />
      </header>
      <main class="app-main">
        <section class="screen-heading">
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
        </section>
        <slot />
        <p
          v-if="$slots.error"
          class="service-route-error"
          role="alert"
        >
          <slot name="error" />
        </p>
        <footer
          v-if="primaryLabel || secondaryLabel"
          class="app-actions service-route-actions"
        >
          <Button
            v-if="primaryLabel"
            class="service-route-primary"
            :disabled="busy"
            @click="$emit('primary')"
            >{{ busy ? '처리하고 있어요…' : primaryLabel }}</Button
          ><Button
            v-if="secondaryLabel"
            class="service-route-secondary"
            :disabled="busy"
            variant="secondary"
            @click="$emit('secondary')"
            >{{ secondaryLabel }}</Button
          >
        </footer>
      </main>
      <nav
        aria-label="주요 메뉴"
        class="app-bottom-nav four-items service-route-bottom-nav"
      >
        <RouterLink
          replace
          :to="{ name: 'transfer-home' }"
          >홈</RouterLink
        ><RouterLink
          replace
          :to="{ name: 'bills-home' }"
          >고지서</RouterLink
        ><RouterLink
          replace
          :to="{ name: 'living-home' }"
          >생활금융</RouterLink
        ><RouterLink
          replace
          :to="{ name: 'my-page' }"
          >마이페이지</RouterLink
        >
      </nav>
    </article>
  </div>
</template>
