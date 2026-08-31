<script setup lang="ts">
defineProps<{
  stage?: 'split' | 'match'
}>()
</script>

<template>
  <div class="vs-wrap">
    <!-- 元のグラフ：3人のサイクル -->
    <div class="orig-col">
      <div class="col-title">元のグラフ</div>
      <svg viewBox="0 0 220 220" class="orig-svg">
        <defs>
          <marker id="arrowO" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#a78bfa" />
          </marker>
        </defs>
        <path d="M 110 45 Q 175 65 175 140" fill="none" stroke="#a78bfa" stroke-width="3" marker-end="url(#arrowO)" />
        <path d="M 155 160 Q 110 205 65 160" fill="none" stroke="#a78bfa" stroke-width="3" marker-end="url(#arrowO)" />
        <path d="M 45 140 Q 45 65 90 45" fill="none" stroke="#a78bfa" stroke-width="3" marker-end="url(#arrowO)" />
      </svg>
      <div class="orig-labels">
        <div class="orig-node pos-top">A</div>
        <div class="orig-node pos-right">B</div>
        <div class="orig-node pos-left">C</div>
      </div>
      <div class="orig-caption">A→B→C→A<br/>「人」が1種類しかない</div>
    </div>

    <div class="transform-arrow">
      <div class="ta-text">頂点を<br/>2つに分裂</div>
      <div class="ta-glyph">⇒</div>
    </div>

    <!-- 二部グラフ -->
    <div class="bipartite-col">
      <div class="col-title">二部グラフ</div>
      <div class="bp-grid">
        <div class="bp-side">
          <div class="bp-side-title">渡す役</div>
          <div class="bp-node">A</div>
          <div class="bp-node">B</div>
          <div class="bp-node">C</div>
        </div>
        <svg viewBox="0 0 100 180" class="bp-svg">
          <defs>
            <marker id="arrowBP" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#34d399" />
            </marker>
          </defs>
          <!-- A(渡す,y=30) -> B(受取,y=90) -->
          <line x1="4" y1="30" x2="96" y2="90" stroke="#34d399" stroke-width="2.5" marker-end="url(#arrowBP)" :class="{ dim: stage !== 'match' }" />
          <!-- B(渡す,y=90) -> C(受取,y=150) -->
          <line x1="4" y1="90" x2="96" y2="150" stroke="#34d399" stroke-width="2.5" marker-end="url(#arrowBP)" :class="{ dim: stage !== 'match' }" />
          <!-- C(渡す,y=150) -> A(受取,y=30) -->
          <line x1="4" y1="150" x2="96" y2="30" stroke="#34d399" stroke-width="2.5" marker-end="url(#arrowBP)" :class="{ dim: stage !== 'match' }" />
        </svg>
        <div class="bp-side">
          <div class="bp-side-title">受け取る役</div>
          <div class="bp-node">A</div>
          <div class="bp-node">B</div>
          <div class="bp-node">C</div>
        </div>
      </div>
      <div class="bp-caption">
        左「渡す役」・右「受け取る役」の<br/>2グループに分かれた
      </div>
    </div>
  </div>
</template>

<style scoped>
.vs-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
}
.col-title {
  font-weight: 700;
  font-size: 0.9rem;
  text-align: center;
  margin-bottom: 0.5rem;
  opacity: 0.85;
}

/* 元のグラフ */
.orig-col { width: 13rem; }
.orig-svg { width: 100%; height: 11rem; }
.orig-labels { position: relative; width: 100%; height: 0; }
.orig-node {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 999px;
  background: #4c1d95;
  border: 2px solid #a78bfa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
}
.pos-top { left: 50%; top: -9.9rem; }
.pos-right { left: 79%; top: -6.3rem; }
.pos-left { left: 21%; top: -6.3rem; }
.orig-caption { text-align: center; font-size: 0.75rem; opacity: 0.7; margin-top: 0.5rem; line-height: 1.5; }

/* 変換矢印 */
.transform-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}
.ta-text { font-size: 0.7rem; text-align: center; opacity: 0.8; line-height: 1.4; }
.ta-glyph { font-size: 2rem; color: #facc15; }

/* 二部グラフ */
.bipartite-col { width: 16rem; }
.bp-grid {
  display: grid;
  grid-template-columns: 4rem 1fr 4rem;
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
.bp-svg line.dim { opacity: 0.25; }
.bp-caption { text-align: center; font-size: 0.75rem; opacity: 0.7; margin-top: 0.5rem; line-height: 1.5; }
</style>
