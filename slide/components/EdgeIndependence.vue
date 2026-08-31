<script setup lang="ts">
defineProps<{
  showBundle?: boolean
}>()
</script>

<template>
  <div class="ei-wrap">
    <div class="bp-grid">
      <div class="bp-side">
        <div class="bp-side-title">渡す役</div>
        <div class="bp-node">A</div>
        <div class="bp-node">B</div>
        <div class="bp-node">C</div>
      </div>
      <svg viewBox="0 0 100 180" class="bp-svg">
        <defs>
          <marker id="arrowEI" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#34d399" />
          </marker>
        </defs>
        <!-- A(渡す,y=30) -> B(受取,y=90) -->
        <line x1="4" y1="30" x2="96" y2="90" stroke="#34d399" stroke-width="2.5" marker-end="url(#arrowEI)" />
        <!-- B(渡す,y=90) -> C(受取,y=150) -->
        <line x1="4" y1="90" x2="96" y2="150" stroke="#34d399" stroke-width="2.5" marker-end="url(#arrowEI)" />
        <!-- C(渡す,y=150) -> A(受取,y=30) -->
        <line x1="4" y1="150" x2="96" y2="30" stroke="#34d399" stroke-width="2.5" marker-end="url(#arrowEI)" />

        <!-- バンドル囲み（セットで選ぶ/選ばないを示す点線） -->
        <path
          v-if="showBundle"
          d="M -6,20 C 40,50 40,130 -6,160 L 106,160 C 60,130 60,50 106,20 Z"
          fill="rgba(250,204,21,0.08)"
          stroke="#facc15"
          stroke-width="2"
          stroke-dasharray="6 5"
        />
      </svg>
      <div class="bp-side">
        <div class="bp-side-title">受け取る役</div>
        <div class="bp-node">A</div>
        <div class="bp-node">B</div>
        <div class="bp-node">C</div>
      </div>
    </div>

    <div class="ei-caption" :class="{ active: showBundle }">
      <template v-if="!showBundle">
        普通のマッチングは、この3本の線を<br/><b>1本ずつ独立に</b>選ぶかどうか決める
      </template>
      <template v-else>
        「3人の輪」にしたいなら、<br/>この3本を<b>セットで選ぶ／セットで選ばない</b>にする必要がある
      </template>
    </div>
  </div>
</template>

<style scoped>
.ei-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.bp-grid {
  display: grid;
  grid-template-columns: 4rem 8rem 4rem;
  align-items: center;
}
.bp-side {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}
.bp-side-title { font-size: 0.65rem; opacity: 0.7; text-align: center; margin-bottom: 0.2rem; }
.bp-node {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 999px;
  background: #064e3b;
  border: 2px solid #34d399;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  margin: 0 auto;
}
.bp-svg { width: 100%; height: 11rem; }
.ei-caption {
  text-align: center;
  font-size: 0.85rem;
  opacity: 0.75;
  line-height: 1.6;
  transition: opacity 0.3s;
}
.ei-caption.active { opacity: 1; color: #facc15; }
</style>
